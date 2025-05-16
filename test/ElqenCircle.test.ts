import { ethers, network } from "hardhat"; // network for time manipulation
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ElqenCircle, MockERC20 } from "../typechain-types"; // Auto-generated types

describe("ElqenCircle Contract Tests", function () {
  // Contract instances
  let elqenCircle: ElqenCircle;
  let mockStablecoin: MockERC20;

  // Signers
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  // Circle parameters
  const contributionAmount: bigint = ethers.parseUnits("100", 18);
  const maxMembers: number = 3;
  const collateralRequirement: bigint = ethers.parseUnits("50", 18); // Bob's collateral is less than contribution + penalty
  const contributionPeriodSeconds: number = 60 * 5;
  const gracePeriodSeconds: number = 60 * 1;
  const penaltyPercentage: number = 5; // 5%

  async function increaseTime(seconds: number) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  beforeEach(async function () {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    const MockStablecoinFactory = await ethers.getContractFactory("MockERC20");
    mockStablecoin = await MockStablecoinFactory.deploy("Mock Stable XDC", "mXDC");
    await mockStablecoin.waitForDeployment();
    const stablecoinAddress = await mockStablecoin.getAddress();

    const initialMintAmount = ethers.parseUnits("1000", 18);
    await mockStablecoin.mint(deployer.address, initialMintAmount);
    await mockStablecoin.mint(alice.address, initialMintAmount);
    await mockStablecoin.mint(bob.address, initialMintAmount);
    await mockStablecoin.mint(charlie.address, initialMintAmount);

    const ElqenCircleFactory = await ethers.getContractFactory("ElqenCircle");
    elqenCircle = await ElqenCircleFactory.deploy(
      stablecoinAddress,
      contributionAmount,
      maxMembers,
      collateralRequirement,
      contributionPeriodSeconds,
      gracePeriodSeconds,
      penaltyPercentage
    );
    await elqenCircle.waitForDeployment();
    const elqenCircleAddress = await elqenCircle.getAddress();

    const approvalAmount = ethers.parseUnits("500", 18);
    const signersForApproval = [alice, bob, charlie, deployer]; // Include deployer just in case
    const uniqueSigners = [...new Set(signersForApproval.map(s => s.address))].map(addr => signersForApproval.find(s => s.address === addr)!);

    for (const signer of uniqueSigners) {
        await mockStablecoin.connect(signer).approve(elqenCircleAddress, approvalAmount);
    }
  });

  it("Should deploy with correct initial parameters", async function () {
    expect(await elqenCircle.owner()).to.equal(deployer.address);
    expect(await elqenCircle.stablecoinAddress()).to.equal(await mockStablecoin.getAddress());
    expect(await elqenCircle.contributionAmount()).to.equal(contributionAmount);
    expect(await elqenCircle.maxMembers()).to.equal(BigInt(maxMembers));
    expect(await elqenCircle.collateralRequirement()).to.equal(collateralRequirement);
    const circleInfo = await elqenCircle.getCircleInfo();
    expect(circleInfo._status).to.equal(0); // CircleStatus.Forming
  });

  describe("Joining a Circle", function () {
    it("Should allow a user to join a forming circle with correct collateral", async function () {
      await expect(elqenCircle.connect(alice).joinCircle())
        .to.emit(elqenCircle, "MemberJoined")
        .withArgs(alice.address, collateralRequirement);

      const memberData = await elqenCircle.getMemberInfo(alice.address);
      expect(memberData.collateralDeposited).to.equal(collateralRequirement);
      expect(memberData.isDefaulted).to.be.false;
      expect(await mockStablecoin.balanceOf(await elqenCircle.getAddress())).to.equal(collateralRequirement);
    });

    it("Should NOT allow joining if circle is full (and thus active)", async function () {
      await elqenCircle.connect(alice).joinCircle();
      await elqenCircle.connect(bob).joinCircle();
      await elqenCircle.connect(deployer).joinCircle(); // Circle is now full and active

      await expect(elqenCircle.connect(charlie).joinCircle())
        .to.be.revertedWith("E10"); // Corrected: "Not forming" as it activates
    });

    it("Should NOT allow joining if already a member", async function () {
      await elqenCircle.connect(alice).joinCircle();
      await expect(elqenCircle.connect(alice).joinCircle())
        .to.be.revertedWith("E12");
    });

    it("Should activate the circle when maxMembers have joined", async function () {
      await elqenCircle.connect(alice).joinCircle();
      await elqenCircle.connect(bob).joinCircle();
      await expect(elqenCircle.connect(deployer).joinCircle())
        .to.emit(elqenCircle, "CircleActivated");

      const circleInfo = await elqenCircle.getCircleInfo();
      expect(circleInfo._status).to.equal(1); // CircleStatus.Active
      expect(circleInfo._currentRound).to.equal(BigInt(1));
      expect(circleInfo._roundDeadline).to.be.gt(BigInt(0));
    });
  });

  describe("Circle Operations (Contributions, Processing, Distribution)", function () {
    // Setup: Fill the circle for these tests. Order: Alice, Bob, Deployer
    beforeEach(async function () {
      await elqenCircle.connect(alice).joinCircle(); // Member 1
      await elqenCircle.connect(bob).joinCircle();   // Member 2
      await elqenCircle.connect(deployer).joinCircle(); // Member 3 - Circle activates
    });

    it("Should allow members to contribute in an active round", async function () {
      await expect(elqenCircle.connect(alice).contribute())
        .to.emit(elqenCircle, "ContributionMade")
        .withArgs(alice.address, BigInt(1), contributionAmount);

      const aliceData = await elqenCircle.getMemberInfo(alice.address);
      expect(aliceData.hasContributedThisRound).to.be.true;
      const circleInfo = await elqenCircle.getCircleInfo();
      expect(circleInfo._currentPot).to.equal(contributionAmount);
    });

    it("Should NOT allow contribution if not active or outside contribution period", async function () {
        await increaseTime(contributionPeriodSeconds + 10); // Pass contribution deadline
        await expect(elqenCircle.connect(alice).contribute())
            .to.be.revertedWith("E24"); // Period ended
    });

    it("Should process a round correctly: all contribute, distribute pot (Round 1 - Alice receives)", async function () {
      await elqenCircle.connect(alice).contribute();
      await elqenCircle.connect(bob).contribute();
      await elqenCircle.connect(deployer).contribute();

      const potBeforeDistribution = (await elqenCircle.getCircleInfo())._currentPot;
      expect(potBeforeDistribution).to.equal(contributionAmount * BigInt(maxMembers));

      await increaseTime(contributionPeriodSeconds + gracePeriodSeconds + 10);

      const aliceBalanceBefore = await mockStablecoin.balanceOf(alice.address);

      await expect(elqenCircle.connect(deployer).processRound())
        .to.emit(elqenCircle, "PotDistributed")
        .withArgs(alice.address, BigInt(1), potBeforeDistribution);

      const aliceBalanceAfter = await mockStablecoin.balanceOf(alice.address);
      expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + potBeforeDistribution);

      const circleInfo = await elqenCircle.getCircleInfo();
      expect(circleInfo._status).to.equal(1); // Active
      expect(circleInfo._currentRound).to.equal(BigInt(2));
      expect(circleInfo._currentPot).to.equal(BigInt(0));
      expect((await elqenCircle.getMemberInfo(alice.address)).hasContributedThisRound).to.be.false;
    });

    it("Should process a round: Bob defaults (collateral insufficient), pot distributed to Alice (Round 1)", async function () {
      // Alice and Deployer contribute for Round 1
      await elqenCircle.connect(alice).contribute();
      await elqenCircle.connect(deployer).contribute();
      // Bob does NOT contribute

      const bobCollateralBefore = (await elqenCircle.getMemberInfo(bob.address)).collateralDeposited; // 50
      expect(bobCollateralBefore).to.equal(collateralRequirement);

      await increaseTime(contributionPeriodSeconds + gracePeriodSeconds + 10);

      const aliceBalanceBefore = await mockStablecoin.balanceOf(alice.address);
      // Pot = Alice's C + Deployer's C + Bob's entire collateral (since it's less than C + penalty)
      const potFromContributions = contributionAmount + contributionAmount;
      const expectedPotForAlice = potFromContributions + bobCollateralBefore;

      // Bob's collateral (50) < contribution (100) + penalty (5)
      // Expect Bob to be defaulted, his collateral added to pot.
      await expect(elqenCircle.processRound())
        .to.emit(elqenCircle, "MemberDefaulted").withArgs(bob.address) // Bob defaults
        .to.emit(elqenCircle, "PotDistributed").withArgs(alice.address, BigInt(1), expectedPotForAlice); // Alice receives

      const bobDataAfter = await elqenCircle.getMemberInfo(bob.address);
      expect(bobDataAfter.isDefaulted).to.be.true;
      expect(bobDataAfter.collateralDeposited).to.equal(BigInt(0)); // All collateral used

      const circleInfo = await elqenCircle.getCircleInfo();
      expect(circleInfo._currentPot).to.equal(BigInt(0));

      const aliceBalanceAfter = await mockStablecoin.balanceOf(alice.address);
      expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + expectedPotForAlice);

      expect(circleInfo._currentRound).to.equal(BigInt(2)); // Advanced to Round 2
    });


    it("Should complete the circle after all rounds with no defaults", async function () {
        const members = [alice, bob, deployer]; // Order of joining = order of payout

        for (let round = 1; round <= maxMembers; round++) {
            const currentDistributee = members[round - 1];
            // console.log(`Testing Round ${round}, ${currentDistributee.address} to receive pot.`);

            for (const member of members) {
                await elqenCircle.connect(member).contribute();
            }

            const potForRound = contributionAmount * BigInt(maxMembers);
            const distributeeBalanceBefore = await mockStablecoin.balanceOf(currentDistributee.address);

            await increaseTime(contributionPeriodSeconds + gracePeriodSeconds + 10);

            await expect(elqenCircle.processRound())
                .to.emit(elqenCircle, "PotDistributed")
                .withArgs(currentDistributee.address, BigInt(round), potForRound);

            const distributeeBalanceAfter = await mockStablecoin.balanceOf(currentDistributee.address);
            expect(distributeeBalanceAfter).to.equal(distributeeBalanceBefore + potForRound);

            if (round < maxMembers) {
                expect((await elqenCircle.getCircleInfo())._currentRound).to.equal(BigInt(round + 1));
            }
        }

        const circleInfo = await elqenCircle.getCircleInfo();
        expect(circleInfo._status).to.equal(2); // CircleStatus.Completed
        // currentRound should be maxMembers + 1 (e.g., 4 if maxMembers is 3) after completion
        expect(circleInfo._currentRound).to.equal(BigInt(maxMembers + 1));


        const aliceCollateral = (await elqenCircle.getMemberInfo(alice.address)).collateralDeposited;
        expect(aliceCollateral).to.equal(collateralRequirement);
        await expect(elqenCircle.connect(alice).withdrawCollateral())
            .to.emit(elqenCircle, "CollateralWithdrawn")
            .withArgs(alice.address, collateralRequirement);
        expect((await elqenCircle.getMemberInfo(alice.address)).collateralDeposited).to.equal(BigInt(0));
    });

    it("Should correctly handle a member (Bob) who defaulted in a previous round", async function () {
        // Order: Alice (R1), Bob (R2), Deployer (R3)
        // Collateral = 50. Contribution = 100. Penalty = 5.

        // --- Round 1 Processing ---
        // Alice contributes, Deployer contributes. Bob misses.
        await elqenCircle.connect(alice).contribute();
        await elqenCircle.connect(deployer).contribute();
        await increaseTime(contributionPeriodSeconds + gracePeriodSeconds + 10);

        const potForAliceR1 = contributionAmount + contributionAmount + collateralRequirement; // Alice's C + Deployer's C + Bob's full collateral
        await expect(elqenCircle.processRound()) // Process Round 1
            .to.emit(elqenCircle, "MemberDefaulted").withArgs(bob.address) // Bob defaults
            .to.emit(elqenCircle, "PotDistributed").withArgs(alice.address, BigInt(1), potForAliceR1); // Alice receives pot

        // Verify Bob is defaulted after Round 1 processing
        const bobDataAfterR1 = await elqenCircle.getMemberInfo(bob.address);
        expect(bobDataAfterR1.isDefaulted).to.be.true;
        expect(bobDataAfterR1.collateralDeposited).to.equal(BigInt(0));
        // Circle should be in Round 2 (Bob's original turn)
        expect((await elqenCircle.getCircleInfo())._currentRound).to.equal(BigInt(2));

        // --- Round 2 Processing ---
        // Bob was scheduled for R2 distribution, but is defaulted.
        // Deployer is the next non-defaulted member in line (originally R3).
        // Alice contributes for Round 2 processing period
        await elqenCircle.connect(alice).contribute();
        // Bob is defaulted, cannot contribute.
        // Deployer contributes for Round 2 processing period
        await elqenCircle.connect(deployer).contribute();
        await increaseTime(contributionPeriodSeconds + gracePeriodSeconds + 10);

        const deployerBalanceBeforeR2Pot = await mockStablecoin.balanceOf(deployer.address);
        // Pot for this round has Alice's and Deployer's contributions. Bob contributes nothing.
        const expectedPotForDeployerTakingBobsTurn = contributionAmount + contributionAmount;

        // NO "MemberDefaulted" event for Bob again.
        // PotDistributed event will have Deployer as recipient, and the round number should be Deployer's original turn (3).
        await expect(elqenCircle.processRound()) // Process for actual Round 2 slot
            .to.emit(elqenCircle, "PotDistributed")
            .withArgs(deployer.address, BigInt(3), expectedPotForDeployerTakingBobsTurn); // Deployer gets pot for their original turn (3)

        // Verify Bob is still defaulted
        const bobDataAfterR2Processing = await elqenCircle.getMemberInfo(bob.address);
        expect(bobDataAfterR2Processing.isDefaulted).to.be.true;
        expect(bobDataAfterR2Processing.collateralDeposited).to.equal(BigInt(0));

        const deployerBalanceAfterR2Pot = await mockStablecoin.balanceOf(deployer.address);
        expect(deployerBalanceAfterR2Pot).to.equal(deployerBalanceBeforeR2Pot + expectedPotForDeployerTakingBobsTurn);

        // After Deployer (last member) gets paid, circle should complete.
        // The contract's internal currentRound state (which tracks whose turn it IS) would have advanced to 3 for Deployer.
        // After distribution to Deployer (original round 3), the next round would be 4.
        expect((await elqenCircle.getCircleInfo())._status).to.equal(2); // CircleStatus.Completed
        expect((await elqenCircle.getCircleInfo())._currentRound).to.equal(BigInt(4)); // Round after last member's turn
    });
  });
});