// elqen-frontend/src/components/CircleDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers, formatUnits } from 'ethers';
import type { ElqenCircleInfo, ElqenMemberInfo } from '../services/elqenService';
import {
    fetchCircleInfo,
    fetchAllMemberAddresses,
    fetchMemberInfo,
    approveMXDC,
    joinElqenCircle,
    contributeToElqenCircle,
    processElqenCircleRound,
    withdrawElqenCollateral,
    checkMXDCAllowance,
    fetchGracePeriodSeconds,
} from '../services/elqenService';
import { shortenAddress } from '../constants';

interface CircleDashboardProps {
    provider: ethers.BrowserProvider | null;
    signer: ethers.Signer | null;
    currentAccount: string | null;
    circleAddress: string | null;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setUserMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
}

const getStatusString = (statusNumber: number | undefined): string => {
    if (statusNumber === undefined) return "Loading...";
    switch (statusNumber) {
        case 0: return "Forming";
        case 1: return "Active";
        case 2: return "Completed";
        case 3: return "Failed";
        default: return "Unknown";
    }
};

const CircleDashboard: React.FC<CircleDashboardProps> = ({
    provider,
    signer,
    currentAccount,
    circleAddress,
    isLoading,
    setIsLoading,
    setUserMessage,
}) => {
    const [circleInfo, setCircleInfo] = useState<ElqenCircleInfo | null>(null);
    const [members, setMembers] = useState<ElqenMemberInfo[]>([]);
    const [currentUserMemberInfo, setCurrentUserMemberInfo] = useState<ElqenMemberInfo | null>(null);
    const [gracePeriod, setGracePeriod] = useState<bigint | null>(null);

    const loadCircleData = useCallback(async () => {
        if (!provider || !circleAddress) {
            setCircleInfo(null); setMembers([]); setCurrentUserMemberInfo(null); setGracePeriod(null);
            return;
        }
        setIsLoading(true); setUserMessage(null);
        try {
            const [info, fetchedGracePeriod] = await Promise.all([
                fetchCircleInfo(circleAddress, provider),
                fetchGracePeriodSeconds(circleAddress, provider)
            ]);
            setCircleInfo(info);
            setGracePeriod(fetchedGracePeriod);
            if (info) {
                const addresses = await fetchAllMemberAddresses(circleAddress, provider);
                const memberDetailsPromises = addresses.map(addr => fetchMemberInfo(circleAddress, addr, provider));
                const loadedMemberDetails = (await Promise.all(memberDetailsPromises)).filter(m => m !== null) as ElqenMemberInfo[];
                setMembers(loadedMemberDetails);
                if (currentAccount) {
                    const currentUserInfo = loadedMemberDetails.find(m => m.addr.toLowerCase() === currentAccount.toLowerCase());
                    setCurrentUserMemberInfo(currentUserInfo || null);
                }
            } else {
                setUserMessage({ type: 'error', text: 'Failed to fetch circle details.' });
            }
        } catch (error) {
            console.error("Error loading circle data:", error);
            setUserMessage({ type: 'error', text: 'Could not load circle data.' });
        } finally {
            setIsLoading(false);
        }
    }, [provider, circleAddress, currentAccount, setIsLoading, setUserMessage]);

    useEffect(() => {
        if (provider && circleAddress) loadCircleData();
    }, [loadCircleData, provider, circleAddress]);

    const handleTransaction = async (
        action: () => Promise<ethers.TransactionResponse | void>,
        successMessage: string, actionName: string,
        requiresApproval?: { amount: bigint, spender: string }
    ) => {
        if (!signer || !currentAccount || !circleAddress || !provider) {
            setUserMessage({ type: 'error', text: 'Wallet not connected or circle not specified.' }); return;
        }
        setIsLoading(true); setUserMessage(null);
        try {
            if (requiresApproval) {
                const allowance = await checkMXDCAllowance(provider, currentAccount, requiresApproval.spender);
                if (allowance < requiresApproval.amount) {
                    setUserMessage({ type: 'success', text: `Approving mXDC for ${actionName}...` });
                    const approveTx = await approveMXDC(signer, requiresApproval.spender, requiresApproval.amount);
                    await approveTx.wait();
                    setUserMessage({ type: 'success', text: `mXDC Approved! Now ${actionName}...` });
                }
            }
            const tx = await action();
            if (tx) {
                setUserMessage({ type: 'success', text: `${actionName} tx submitted... awaiting confirmation.` });
                await tx.wait();
            }
            setUserMessage({ type: 'success', text: successMessage });
            loadCircleData();
        } catch (error) {
            const err = error as { message?: string; data?: { message?: string }; reason?: string };
            console.error(`Error ${actionName}:`, err);
            const displayError = err.data?.message || err.reason || err.message || 'Unknown error';
            setUserMessage({ type: 'error', text: `${actionName} failed: ${displayError}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!circleInfo || !circleAddress) return;
        await handleTransaction( () => joinElqenCircle(circleAddress, signer!),
            'Successfully joined the circle!', 'Joining Circle',
            { amount: circleInfo.collateralRequirement, spender: circleAddress }
        );
    };
    const handleContribute = async () => {
        if (!circleInfo || !circleAddress) return;
        await handleTransaction( () => contributeToElqenCircle(circleAddress, signer!),
            'Contribution successful!', 'Contributing',
            { amount: circleInfo.contributionAmount, spender: circleAddress }
        );
    };
    const handleProcessRound = async () => {
        if (!circleAddress) return;
        await handleTransaction( () => processElqenCircleRound(circleAddress, signer!),
            'Round processed successfully!', 'Processing Round'
        );
    };
     const handleWithdrawCollateral = async () => {
        if (!circleAddress) return;
        await handleTransaction( () => withdrawElqenCollateral(circleAddress, signer!),
            'Collateral withdrawn successfully!', 'Withdrawing Collateral'
        );
    };

    if (!circleAddress) return <div className="section"><p>No active circle selected.</p></div>;
    if (!provider && !isLoading) return <div className="section"><p>Connecting to wallet...</p></div>;
    if (isLoading && (!circleInfo || gracePeriod === null)) return <div className="section loading-indicator"><p>⏳ Loading circle data...</p></div>;
    if (!circleInfo || gracePeriod === null) return <div className="section"><p>Could not load circle data. Check console or try refreshing.</p></div>;

    const isMember = !!currentUserMemberInfo;
    const canContribute = isMember && !currentUserMemberInfo?.isDefaulted && !currentUserMemberInfo?.hasContributedThisRound && circleInfo.status === 1 && Date.now() / 1000 <= Number(circleInfo.roundDeadline);
    const canJoin = !isMember && circleInfo.status === 0 && circleInfo.memberCount < circleInfo.maxMembers;
    const canProcess = circleInfo.status === 1 && Date.now() / 1000 > (Number(circleInfo.roundDeadline) + Number(gracePeriod));
    const canWithdraw = isMember && currentUserMemberInfo && ( (circleInfo.status === 2 && !currentUserMemberInfo.isDefaulted && currentUserMemberInfo.collateralDeposited > BigInt(0)) || (circleInfo.status === 3 && currentUserMemberInfo.collateralDeposited > BigInt(0)) );

    return (
        <div className="section">
            <h2>Circle Dashboard: {shortenAddress(circleAddress)}</h2>
            <div className="info-grid">
                <span className="info-label">Status:</span><span className={`info-value status-${getStatusString(circleInfo.status).toLowerCase()}`}>{getStatusString(circleInfo.status)}</span>
                <span className="info-label">Creator:</span><span className="info-value">{shortenAddress(circleInfo.creator)}</span>
                <span className="info-label">Members:</span><span className="info-value">{circleInfo.memberCount.toString()}/{circleInfo.maxMembers.toString()}</span>
                <span className="info-label">Contribution:</span><span className="info-value">{formatUnits(circleInfo.contributionAmount, 18)} mXDC</span>
                <span className="info-label">Collateral:</span><span className="info-value">{formatUnits(circleInfo.collateralRequirement, 18)} mXDC</span>
                {circleInfo.status === 1 && (
                    <>
                        <span className="info-label">Current Round:</span><span className="info-value">{circleInfo.currentRound.toString()}</span>
                        <span className="info-label">Current Pot:</span><span className="info-value">{formatUnits(circleInfo.currentPot, 18)} mXDC</span>
                        <span className="info-label">Round Deadline:</span><span className="info-value">{new Date(Number(circleInfo.roundDeadline) * 1000).toLocaleString()}</span>
                        <span className="info-label">Grace Period Ends:</span><span className="info-value">{new Date((Number(circleInfo.roundDeadline) + Number(gracePeriod)) * 1000).toLocaleString()}</span>
                    </>
                )}
            </div>

            <div className="actions-container">
                {canJoin && <button onClick={handleJoin} disabled={!signer || !currentAccount || isLoading}>Join (Collateral: {formatUnits(circleInfo.collateralRequirement, 18)} mXDC)</button>}
                {canContribute && <button onClick={handleContribute} disabled={!signer || !currentAccount || isLoading}>Contribute ({formatUnits(circleInfo.contributionAmount, 18)} mXDC)</button>}
                {canProcess && <button onClick={handleProcessRound} disabled={!signer || isLoading}>Process Round</button>}
                {canWithdraw && currentUserMemberInfo && <button onClick={handleWithdrawCollateral} disabled={!signer || !currentAccount || isLoading}>Withdraw Collateral ({formatUnits(currentUserMemberInfo.collateralDeposited, 18)} mXDC)</button>}
            </div>

            <h3>Members:</h3>
            {members.length > 0 ? (
                <ul className="member-list">
                    {members.map((member) => (
                        <li key={member.addr}>
                            {shortenAddress(member.addr)}
                            {member.addr.toLowerCase() === currentAccount?.toLowerCase() && <strong> (You)</strong>}
                            <br />
                            <small>
                                Col: {formatUnits(member.collateralDeposited, 18)} | Rep: {member.reputationScore.toString()} |
                                {member.isDefaulted ? <span style={{color: 'red'}}> Def</span> :
                                 member.hasContributedThisRound && circleInfo.status === 1 ? <span style={{color: 'green'}}> Done</span> :
                                 circleInfo.status === 1 ? <span> Pend</span> : ""}
                            </small>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>{circleInfo.memberCount > BigInt(0) && isLoading ? "Loading member details..." : "No members have joined yet."}</p>
            )}
        </div>
    );
};

export default CircleDashboard;