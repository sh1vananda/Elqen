import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // --- XDC Apothem Specifics ---
  console.log("Deploying MockStablecoin (mXDC)...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");

  // CORRECTED: Call deploy with only the arguments your MockERC20 constructor expects (name, symbol)
  // Decimals will default to 18 as per OpenZeppelin ERC20 standard.
  const mockStablecoin = await MockERC20Factory.deploy("Mock Stable XDC", "mXDC");
  await mockStablecoin.waitForDeployment();
  const stablecoinAddress = await mockStablecoin.getAddress();
  console.log("MockStablecoin (mXDC) deployed to:", stablecoinAddress);
  console.log("MockStablecoin decimals will be 18 (default).");


  // Mint some mXDC to the deployer for testing circle interactions
  // When parsing units, you use 18 because the mock token has 18 decimals by default
  const mintAmount = ethers.parseUnits("10000", 18);
  await mockStablecoin.mint(deployer.address, mintAmount);
  console.log(`Minted ${ethers.formatUnits(mintAmount, 18)} mXDC to ${deployer.address}`);
  // --- End Stablecoin ---

  // ... (rest of your ElqenCircle deployment logic) ...
  const contributionAmount = ethers.parseUnits("100", 18); // Assuming 18 decimals for mXDC
  const maxMembers = 3;
  const collateralRequirement = ethers.parseUnits("50", 18); // Assuming 18 decimals
  const contributionPeriodSeconds = 60 * 5;
  const gracePeriodSeconds = 60 * 1;
  const penaltyPercentage = 5;

  console.log("Deploying ElqenCircle...");
  const ElqenCircleFactory = await ethers.getContractFactory("ElqenCircle");
  const elqenCircle = await ElqenCircleFactory.deploy(
    stablecoinAddress,
    contributionAmount,
    maxMembers,
    collateralRequirement,
    contributionPeriodSeconds,
    gracePeriodSeconds,
    penaltyPercentage
  );

  await elqenCircle.waitForDeployment();
  const deployedAddress = await elqenCircle.getAddress();
  console.log("ElqenCircle deployed to:", deployedAddress, "on XDC Apothem Network");
  console.log("Using stablecoin (mXDC):", stablecoinAddress);
  console.log("Note: Sismo ZK-proof uniqueness is NOT active in this version.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});