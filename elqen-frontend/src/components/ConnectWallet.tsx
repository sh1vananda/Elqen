// elqen-frontend/src/components/ConnectWallet.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { APOTHEM_NETWORK_CHAIN_ID } from '../constants';

// (Interfaces: EthereumProvider, WindowWithEthereum, AddEthereumChainParameter remain the same)
interface EthereumProvider {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: Array<unknown> | object }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface WindowWithEthereum extends Window {
    ethereum?: EthereumProvider;
}

interface AddEthereumChainParameter {
    chainId: string;
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: 18 };
    rpcUrls: string[];
    blockExplorerUrls?: string[];
}

interface ConnectWalletProps {
    onAccountChanged: (account: string | null) => void;
    onProviderReady: (provider: ethers.BrowserProvider | null, signer: ethers.Signer | null) => void; // Added signer
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ onAccountChanged, onProviderReady }) => {
    const [currentAccount, setCurrentAccount] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // No need to store provider in state here if onProviderReady handles it for the parent
    // const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

    const handleConnection = useCallback(async (ethereum: EthereumProvider) => {
        try {
            const browserProvider = new ethers.BrowserProvider(ethereum);
            const network = await browserProvider.getNetwork();

            if (network.chainId !== BigInt(APOTHEM_NETWORK_CHAIN_ID)) {
                setError(`Please switch to XDC Apothem Network (Chain ID: ${APOTHEM_NETWORK_CHAIN_ID}). Connected to: ${network.chainId}`);
                onProviderReady(null, null); // Not ready if wrong network
                onAccountChanged(null);
                setCurrentAccount(null);
                return false; // Indicate connection not fully successful
            }

            // Try to get accounts if already connected, otherwise request
            let accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
            if (accounts.length === 0) {
                accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            }

            if (accounts.length > 0) {
                const signer = await browserProvider.getSigner(accounts[0]);
                setCurrentAccount(accounts[0]);
                onAccountChanged(accounts[0]);
                onProviderReady(browserProvider, signer);
                setError(null);
                return true; // Indicate connection successful
            } else {
                console.log("No accounts found or authorized.");
                setCurrentAccount(null);
                onAccountChanged(null);
                onProviderReady(null, null);
                setError("No account authorized.");
                return false;
            }
        } catch (err) {
            const e = err as { code?: number; message?: string };
            console.error("Connection error:", e);
            setCurrentAccount(null);
            onAccountChanged(null);
            onProviderReady(null, null);
            if (e.code === 4001) {
                setError("Connection request rejected by user.");
            } else {
                setError(`Connection failed: ${e.message || "Unknown error"}`);
            }
            return false;
        }
    }, [onAccountChanged, onProviderReady]); // Dependencies are stable props

    const connectWalletHandler = useCallback(async () => {
        const typedWindow = window as WindowWithEthereum;
        if (typedWindow.ethereum) {
            await handleConnection(typedWindow.ethereum);
        } else {
            setError("MetaMask not found. Please install it.");
            onProviderReady(null, null);
            onAccountChanged(null);
        }
    }, [handleConnection, onAccountChanged, onProviderReady]);

    const attemptSwitchNetwork = useCallback(async () => {
        const typedWindow = window as WindowWithEthereum;
        if (!typedWindow.ethereum) {
            setError("MetaMask not available.");
            return;
        }
        try {
            await typedWindow.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ethers.toBeHex(APOTHEM_NETWORK_CHAIN_ID) }],
            });
            // After a successful switch, the 'chainChanged' event should trigger a reconnect
        } catch (switchError) {
            const err = switchError as { code?: number; message?: string };
            if (err.code === 4902) { // Chain not added
                try {
                    const addParams: AddEthereumChainParameter = {
                        chainId: ethers.toBeHex(APOTHEM_NETWORK_CHAIN_ID),
                        chainName: 'XDC Apothem Testnet',
                        nativeCurrency: { name: 'TXDC', symbol: 'TXDC', decimals: 18 },
                        rpcUrls: ['https://erpc.apothem.network'],
                        blockExplorerUrls: ['https://explorer.apothem.network/']
                    };
                    await typedWindow.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [addParams],
                    });
                } catch (addError) { // 'addError' is defined
                    console.error("Failed to add Apothem network to MetaMask:", addError); // Log it
                    setError("Failed to add Apothem. Please add manually via MetaMask.");
                }
            } else {
                setError("Failed to switch network.");
            }
        }
    }, []);


    useEffect(() => {
        const typedWindow = window as WindowWithEthereum;
        if (typedWindow.ethereum) {
            // Attempt to connect if already authorized (e.g., on page load)
            // This also handles the initial network check
            handleConnection(typedWindow.ethereum);

            const handleAccountsChanged = (accounts: unknown) => {
                console.log("Accounts changed:", accounts);
                if ((accounts as string[]).length === 0) {
                    setCurrentAccount(null);
                    onAccountChanged(null);
                    onProviderReady(null, null);
                    setError("Wallet disconnected.");
                } else {
                    // Re-handle connection to update signer and network check
                    handleConnection(typedWindow.ethereum!);
                }
            };

            const handleChainChanged = (_chainId: unknown) => {
                console.log("Chain changed to:", _chainId);
                // Re-handle connection to update provider, signer, and network check
                // This will also update the error message if now on wrong/right network
                handleConnection(typedWindow.ethereum!);
            };

            typedWindow.ethereum.on('accountsChanged', handleAccountsChanged);
            typedWindow.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                typedWindow.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
                typedWindow.ethereum?.removeListener('chainChanged', handleChainChanged);
            };
        } else {
            // No ethereum provider found on initial load
            setError("MetaMask not found. Please install it.");
            onProviderReady(null, null);
            onAccountChanged(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleConnection]); // `handleConnection` is memoized and its deps are stable props

    return (
        <div style={styles.container}>
            {currentAccount ? (
                <div style={styles.accountInfo}>
                    Connected: {`${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}`}
                </div>
            ) : (
                <button onClick={connectWalletHandler} style={styles.button}>
                    Connect Wallet
                </button>
            )}
            {error && (
                <div style={styles.errorContainer}>
                    <p style={styles.errorText}>{error}</p>
                    {error.includes("Please switch to XDC Apothem Network") && (
                         <button onClick={attemptSwitchNetwork} style={{...styles.button, ...styles.switchButton}}>
                             Switch to Apothem
                         </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Basic functional styling
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '10px',
        borderRadius: '8px',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        minWidth: '250px',
        maxWidth: '350px',
        margin: '10px auto',
    },
    accountInfo: {
        padding: '8px 12px',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        fontSize: '0.9em',
    },
    button: {
        padding: '10px 15px',
        fontSize: '1em',
        color: 'white',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
    },
    errorText: {
        color: 'red',
        fontSize: '0.9em',
        margin: 0,
    },
    switchButton: {
        backgroundColor: '#ffc107',
        color: '#333',
        fontSize: '0.8em',
        padding: '8px 12px',
    }
};


export default ConnectWallet;