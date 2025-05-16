# Elqen - Decentralized Rotating Savings Circles 🏦🔗

**Elqen brings traditional community-based savings and lending circles (like Susu, Tanda, Chit Funds) to the blockchain era, enabling small, trusted groups to securely pool funds and access micro-loans.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Add other badges if applicable: build status, deployed link, etc. -->
<!-- e.g., ![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_NETLIFY_BADGE_ID/deploy-status) -->

<!-- Optional: Add a GIF or Screenshot of the DApp here -->
<!-- <p align="center">
  <img src="path/to/your/dapp_demo.gif" alt="Elqen DApp Demo" width="600"/>
</p> -->

## 🌟 Core Concept

Elqen empowers small groups (3-12 members) to create "Circles" where members contribute a fixed amount of stablecoins regularly. The pooled sum is then distributed to one member of the Circle in each round, following a predetermined order. This process repeats until every member has received the pot once.

The system is built on smart contracts, ensuring transparency, automation of payouts, and rule enforcement. A collateral mechanism is in place to incentivize commitment and mitigate risks from defaults.

## ✨ Key Features (MVP)

*   **Circle Creation (via script for MVP):** Define circle parameters like contribution amount, member size, and collateral.
*   **Member Onboarding:** Users can join a forming circle by depositing the required collateral.
    *   _(Basic Sybil Resistance: One wallet address per circle in current MVP)._
*   **Collateralized Participation:** Members deposit collateral (in stablecoins) to secure their spot and commitment.
*   **Automated Contributions & Distributions:**
    *   Smart contract manages regular stablecoin contributions from members.
    *   Automated distribution of the pooled funds to the designated member for the current round (FIFO order).
*   **Default Handling:**
    *   Missed contributions are covered by the member's collateral.
    *   Penalties are applied to the defaulter's collateral.
    *   Members who exhaust their collateral are marked as defaulted and forfeit future distributions.
*   **Collateral Withdrawal:** Non-defaulted members can withdraw their remaining collateral upon circle completion or failure.
*   **Transparent Operations:** All circle activities (joins, contributions, distributions, defaults) are recorded on the blockchain.
*   **Functional UI:** A clean, retro-styled web interface for:
    *   Connecting wallets (MetaMask, configured for XDC Apothem Testnet).
    *   Viewing Circle status, member details, contribution deadlines, and pot size.
    *   Interacting with the Circle: Join, Contribute, Process Round, Withdraw Collateral.

## 💡 Why Elqen?

*   **Modernizes Tradition:** Digitizes and automates proven community finance models.
*   **Financial Inclusion:** Provides an alternative, accessible micro-financing tool for small groups.
*   **Trust & Transparency:** Leverages blockchain for secure and transparent fund management.
*   **Community Focused:** Designed for small, trusted networks to support each other financially.
*   **Reduced Counterparty Risk:** Collateral and automated rules reduce reliance on a single administrator and risk of mismanagement compared to informal groups.

## 🛠️ Tech Stack

*   **Blockchain:** XDC Apothem Testnet (`chainId: 51`)
*   **Smart Contracts:**
    *   Solidity (`^0.8.20`)
    *   Hardhat (Development, Testing, Deployment Framework)
    *   OpenZeppelin Contracts (ERC20, Ownable, ReentrancyGuard)
*   **Frontend:**
    *   React (with Vite and TypeScript)
    *   Ethers.js (v6 for blockchain interaction)
    *   CSS for styling (retro, functional theme)
*   **Stablecoin (Mock):** A mock ERC20 token (`mXDC`) deployed on Apothem for testing contributions and collateral.
