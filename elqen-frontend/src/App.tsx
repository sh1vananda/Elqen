// elqen-frontend/src/App.tsx
import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import ConnectWallet from './components/ConnectWallet';
import CreateCirclePlaceholder from './components/CreateCircle';
import CircleDashboard from './components/CircleDashboard';
import { ELQEN_CIRCLE_CONTRACT_ADDRESS } from './constants';
import './App.css';

function App() {
    const [currentAccount, setCurrentAccount] = useState<string | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [userMessage, setUserMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [activeCircleAddress, _setActiveCircleAddress] = useState<string | null>(ELQEN_CIRCLE_CONTRACT_ADDRESS);

    const handleAccountChanged = useCallback((account: string | null) => {
        setCurrentAccount(account);
        setUserMessage(null);
        if (!account) setSigner(null);
    }, []);

    const handleProviderReady = useCallback(
        (prov: ethers.BrowserProvider | null, sig: ethers.Signer | null) => {
            setProvider(prov);
            setSigner(sig);
            setUserMessage(null);
        },
        []
    );

    const handleCircleCreated = useCallback((newCircleAddress: string) => {
        _setActiveCircleAddress(newCircleAddress);
        setUserMessage({ type: 'success', text: `New circle active: ${newCircleAddress}` });
    }, [_setActiveCircleAddress]);

    useEffect(() => {
        if (userMessage) {
            const timer = setTimeout(() => setUserMessage(null), 7000);
            return () => clearTimeout(timer);
        }
    }, [userMessage]);

    return (
        <div className="App">
            <header className="App-header">
                <h1>Elqen</h1>
                <ConnectWallet
                    onAccountChanged={handleAccountChanged}
                    onProviderReady={handleProviderReady}
                />
            </header>

            <main>
                {userMessage && (
                    <div className={`message-box ${userMessage.type === 'error' ? 'error-message' : 'success-message'}`}>
                        {userMessage.text}
                    </div>
                )}
                {isLoading && <div className="section loading-indicator"><p>⏳ Processing...</p></div>}

                {!currentAccount || !provider || !signer ? (
                    <div className="section">
                        <p>Please connect your wallet to the XDC Apothem Network to use Elqen.</p>
                    </div>
                ) : (
                    <>
                        <CreateCirclePlaceholder
                            currentAccount={currentAccount}
                            setUserMessage={setUserMessage}
                            provider={provider}
                            signer={signer}
                            onCircleCreated={handleCircleCreated}
                            setIsLoading={setIsLoading}
                        />
                        <CircleDashboard
                            provider={provider}
                            signer={signer}
                            currentAccount={currentAccount}
                            circleAddress={activeCircleAddress}
                            isLoading={isLoading}
                            setIsLoading={setIsLoading}
                            setUserMessage={setUserMessage}
                        />
                    </>
                )}
            </main>
        </div>
    );
}

export default App;