import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox"; // Includes ethers, waffle, etc.
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure essential environment variables are set
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.warn("WARNING: PRIVATE_KEY environment variable is not set. Using a default dummy key for local development only.");
  // Using a common default private key for Hardhat local nodes (NOT FOR MAINNET/TESTNET DEPLOYMENT)
  // Replace if you have a specific local setup or if deploying to a real testnet without .env
}


// You can add more environment variables here if needed, e.g., for block explorer API keys
// const XINFINSCAN_API_KEY = process.env.XINFINSCAN_API_KEY; // If a plugin supports it

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20", // Match the pragma version in your contracts
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Standard optimizer setting
      },
    },
  },
  networks: {
    hardhat: {
      // Configuration for the local Hardhat Network (forking, accounts, etc.)
      // chainId: 31337, // Default Hardhat chainId
    },
    apothem: {
      url: process.env.APOTHEM_RPC_URL || "https://erpc.apothem.network", // Fallback to public RPC
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [], // Use private key from .env if set
      chainId: 51, // XDC Apothem Testnet Chain ID
      // gasPrice: // Optional: set a specific gas price
      // gas: // Optional: set a specific gas limit for transactions
    },
    // You can add other networks here (e.g., mainnet, other testnets)
    // baseGoerli: {
    //   url: process.env.BASE_GOERLI_RPC_URL || "https://goerli.base.org",
    //   accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    //   chainId: 84531,
    // },
  },
  etherscan: {
    // Hardhat's built-in etherscan plugin might not directly support XinFin Scan (XDC's explorer)
    // Verification on Apothem is typically done manually via their block explorer interface.
    // If a community plugin for XinFin Scan verification becomes available, you can configure it here.
    // For now, this section might be minimal or commented out for Apothem.
    apiKey: {
      // No direct equivalent for Apothem unless a specific plugin requires it
      // mainnet: process.env.ETHERSCAN_API_KEY || "",
      // baseGoerli: process.env.BASESCAN_API_KEY || "",
    },
    // customChains: [ // If a plugin requires custom chain definition for Apothem
    //   {
    //     network: "apothem",
    //     chainId: 51,
    //     urls: {
    //       apiURL: "https://explorer.apothem.network/api", // This URL is hypothetical, check XinFin Scan docs
    //       browserURL: "https://explorer.apothem.network",
    //     }
    //   }
    // ]
  },
  gasReporter: { // Optional: for reporting gas usage of tests
    enabled: process.env.REPORT_GAS !== undefined, // Enable with `REPORT_GAS=true yarn test`
    currency: "USD",
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY, // If you want to get fiat estimates
    // outputFile: "gas-report.txt", // Optional: save report to a file
    // noColors: true, // Optional: if outputting to a file
  },
  paths: { // Optional: customize default paths
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: { // Optional: configure Mocha test runner
    timeout: 40000, // Increase timeout for tests if they involve many transactions or complex setups
  },
};

export default config;