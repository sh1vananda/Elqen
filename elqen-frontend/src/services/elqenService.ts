// elqen-frontend/src/services/elqenService.ts
import { ethers, Contract } from 'ethers';
import {
    ELQEN_CIRCLE_ABI,
    MXDC_TOKEN_ABI,
    MXDC_TOKEN_CONTRACT_ADDRESS
} from '../constants';

// Interface now matches the 9 items returned by getCircleInfo()
export interface ElqenCircleInfo {
    creator: string;
    status: number;
    currentRound: bigint;
    roundDeadline: bigint;
    currentPot: bigint;
    memberCount: bigint;
    maxMembers: bigint;
    contributionAmount: bigint;
    collateralRequirement: bigint;
}

export interface ElqenMemberInfo {
    addr: string;
    collateralDeposited: bigint;
    reputationScore: bigint;
    hasContributedThisRound: boolean;
    isDefaulted: boolean;
    joinTimestamp: bigint;
}

export const getElqenCircleContract = (circleAddress: string, providerOrSigner: ethers.Provider | ethers.Signer): Contract => {
    if (!ethers.isAddress(circleAddress)) throw new Error("Invalid circle address");
    return new ethers.Contract(circleAddress, ELQEN_CIRCLE_ABI, providerOrSigner);
};

export const getMXDCTokenContract = (providerOrSigner: ethers.Provider | ethers.Signer): Contract => {
    return new ethers.Contract(MXDC_TOKEN_CONTRACT_ADDRESS, MXDC_TOKEN_ABI, providerOrSigner);
};

export const checkMXDCAllowance = async (
    provider: ethers.Provider,
    ownerAddress: string,
    spenderAddress: string
): Promise<bigint> => {
    const tokenContract = getMXDCTokenContract(provider);
    return tokenContract.allowance(ownerAddress, spenderAddress);
};

export const approveMXDC = async (
    signer: ethers.Signer,
    spenderAddress: string,
    amount: bigint
): Promise<ethers.TransactionResponse> => {
    const tokenContract = getMXDCTokenContract(signer);
    const tx = await tokenContract.approve(spenderAddress, amount);
    return tx;
};

export const getMXDCBalance = async (
    provider: ethers.Provider,
    accountAddress: string
): Promise<bigint> => {
    const tokenContract = getMXDCTokenContract(provider);
    return tokenContract.balanceOf(accountAddress);
};

export const fetchCircleInfo = async (
    circleAddress: string,
    provider: ethers.Provider
): Promise<ElqenCircleInfo | null> => {
    try {
        const contract = getElqenCircleContract(circleAddress, provider);
        const infoResult = await contract.getCircleInfo();

        // Debugging log - REMOVE FOR PRODUCTION
        // console.log("Raw getCircleInfo result from service:", infoResult);

        // Handling both struct-like (Ethers v6 common) and array results
        if (infoResult && typeof infoResult === 'object' && 'creator' in infoResult) {
            // This assumes your Solidity struct returns fields like _status, _currentRound etc.
            // Adjust property names if your Solidity struct fields are different (e.g. no underscore)
            return {
                creator: infoResult.creator,
                status: Number(infoResult._status),
                currentRound: BigInt(infoResult._currentRound),
                roundDeadline: BigInt(infoResult._roundDeadline),
                currentPot: BigInt(infoResult._currentPot),
                memberCount: BigInt(infoResult._memberCount),
                maxMembers: BigInt(infoResult._maxMembers),
                contributionAmount: BigInt(infoResult._contributionAmount),
                collateralRequirement: BigInt(infoResult._collateralRequirement),
            };
        } else if (Array.isArray(infoResult) && infoResult.length >= 9) {
            return {
                creator: infoResult[0],
                status: Number(infoResult[1]),
                currentRound: BigInt(infoResult[2]),
                roundDeadline: BigInt(infoResult[3]),
                currentPot: BigInt(infoResult[4]),
                memberCount: BigInt(infoResult[5]),
                maxMembers: BigInt(infoResult[6]),
                contributionAmount: BigInt(infoResult[7]),
                collateralRequirement: BigInt(infoResult[8]),
            };
        }
        console.error("Unexpected structure or insufficient data from getCircleInfo for ElqenCircleInfo mapping:", infoResult);
        return null;

    } catch (error) {
        console.error("Error in fetchCircleInfo:", error);
        return null;
    }
};

export const fetchMemberInfo = async (
    circleAddress: string,
    memberAddress: string,
    provider: ethers.Provider
): Promise<ElqenMemberInfo | null> => {
    try {
        const contract = getElqenCircleContract(circleAddress, provider);
        const info = await contract.getMemberInfo(memberAddress);
        return {
            addr: memberAddress,
            collateralDeposited: BigInt(info.collateralDeposited),
            reputationScore: BigInt(info.reputationScore),
            hasContributedThisRound: info.hasContributedThisRound,
            isDefaulted: info.isDefaulted,
            joinTimestamp: BigInt(info.joinTimestamp),
        };
    } catch (error) {
        console.error(`Error fetching member info for ${memberAddress}:`, error);
        return null;
    }
};

export const fetchAllMemberAddresses = async (
    circleAddress: string,
    provider: ethers.Provider
): Promise<string[]> => {
    try {
        const contract = getElqenCircleContract(circleAddress, provider);
        return await contract.getAllMemberAddresses();
    } catch (error) {
        console.error("Error fetching all member addresses:", error);
        return [];
    }
};

export const joinElqenCircle = async (
    circleAddress: string,
    signer: ethers.Signer
): Promise<ethers.TransactionResponse> => {
    const contract = getElqenCircleContract(circleAddress, signer);
    return contract.joinCircle();
};

export const contributeToElqenCircle = async (
    circleAddress: string,
    signer: ethers.Signer
): Promise<ethers.TransactionResponse> => {
    const contract = getElqenCircleContract(circleAddress, signer);
    return contract.contribute();
};

export const processElqenCircleRound = async (
    circleAddress: string,
    signer: ethers.Signer
): Promise<ethers.TransactionResponse> => {
    const contract = getElqenCircleContract(circleAddress, signer);
    return contract.processRound();
};

export const withdrawElqenCollateral = async (
    circleAddress: string,
    signer: ethers.Signer
): Promise<ethers.TransactionResponse> => {
    const contract = getElqenCircleContract(circleAddress, signer);
    return contract.withdrawCollateral();
};

// Function to fetch immutable gracePeriodSeconds (if needed)
export const fetchGracePeriodSeconds = async (
    circleAddress: string,
    provider: ethers.Provider
): Promise<bigint | null> => {
    try {
        const contract = getElqenCircleContract(circleAddress, provider);
        return await contract.gracePeriodSeconds(); // Direct public variable read
    } catch (error) {
        console.error("Error fetching gracePeriodSeconds:", error);
        return null;
    }
};