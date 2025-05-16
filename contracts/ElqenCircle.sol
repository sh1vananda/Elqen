// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ElqenCircle is Ownable, ReentrancyGuard {
    enum CircleStatus { Forming, Active, Completed, Failed }

    struct Member {
        address payable addr;
        uint256 collateralDeposited;
        uint256 reputationScore;
        bool hasContributedThisRound;
        bool isDefaulted;
        uint256 joinTimestamp;
    }

    address public immutable stablecoinAddress;
    uint256 public immutable contributionAmount;
    uint256 public immutable maxMembers;
    uint256 public immutable collateralRequirement;
    uint256 public immutable contributionPeriodSeconds;
    uint256 public immutable gracePeriodSeconds;
    uint256 public immutable penaltyPercentageForMissed;

    CircleStatus public status;
    uint256 public currentRound;
    uint256 public currentPot;
    uint256 public roundDeadline;

    address[] public memberAddresses;
    mapping(address => Member) public membersData;
    // Note: Sismo related state (verifier, proofRequestBytes, configId, usedNullifiers, isSismoActive) removed

    event CircleCreated(address indexed creator, uint256 maxMembers, uint256 contributionAmount, uint256 collateralRequirement);
    event MemberJoined(address indexed member, uint256 collateralDeposited);
    event CircleActivated(uint256 firstRoundDeadline);
    event ContributionMade(address indexed member, uint256 round, uint256 amount);
    event CollateralSlashed(address indexed member, uint256 amountSlashed, uint256 penalty);
    event PotDistributed(address indexed recipient, uint256 round, uint256 amount);
    event MemberDefaulted(address indexed member);
    event CollateralWithdrawn(address indexed member, uint256 amount);
    event CircleCompleted();
    event CircleFailed();

    constructor(
        address _stablecoinAddress,
        uint256 _contributionAmount,
        uint256 _maxMembers,
        uint256 _collateralRequirement,
        uint256 _contributionPeriodSeconds,
        uint256 _gracePeriodSeconds,
        uint256 _penaltyPercentageForMissed
    ) Ownable(msg.sender) {
        require(_stablecoinAddress != address(0), "E01");
        require(_contributionAmount > 0, "E02");
        require(_maxMembers > 1 && _maxMembers <= 12, "E03");
        require(_collateralRequirement > 0, "E04");
        require(_contributionPeriodSeconds > 0, "E05");
        require(_penaltyPercentageForMissed <= 100, "E06");

        stablecoinAddress = _stablecoinAddress;
        contributionAmount = _contributionAmount;
        maxMembers = _maxMembers;
        collateralRequirement = _collateralRequirement;
        contributionPeriodSeconds = _contributionPeriodSeconds;
        gracePeriodSeconds = _gracePeriodSeconds;
        penaltyPercentageForMissed = _penaltyPercentageForMissed;

        status = CircleStatus.Forming;
        currentRound = 0;

        emit CircleCreated(msg.sender, _maxMembers, _contributionAmount, _collateralRequirement);
    }

    function joinCircle() external nonReentrant { // Sismo parameters removed
        require(status == CircleStatus.Forming, "E10");
        require(memberAddresses.length < maxMembers, "E11");
        require(membersData[msg.sender].addr == address(0), "E12"); // Basic Sybil: 1 address per circle

        IERC20 stable = IERC20(stablecoinAddress);
        require(stable.allowance(msg.sender, address(this)) >= collateralRequirement, "E16");
        stable.transferFrom(msg.sender, address(this), collateralRequirement);

        membersData[msg.sender] = Member({
            addr: payable(msg.sender),
            collateralDeposited: collateralRequirement,
            reputationScore: 100,
            hasContributedThisRound: false,
            isDefaulted: false,
            joinTimestamp: block.timestamp
        });
        memberAddresses.push(msg.sender);

        emit MemberJoined(msg.sender, collateralRequirement);

        if (memberAddresses.length == maxMembers) {
            _activateCircle();
        }
    }

    function contribute() external nonReentrant {
        require(status == CircleStatus.Active, "E20");
        Member storage member = membersData[msg.sender];
        require(member.addr != address(0), "E21");
        require(!member.isDefaulted, "E22");
        require(!member.hasContributedThisRound, "E23");
        require(block.timestamp <= roundDeadline, "E24");

        IERC20 stable = IERC20(stablecoinAddress);
        require(stable.allowance(msg.sender, address(this)) >= contributionAmount, "E26");

        stable.transferFrom(msg.sender, address(this), contributionAmount);
        member.hasContributedThisRound = true;
        member.reputationScore += 10;
        currentPot += contributionAmount;

        emit ContributionMade(msg.sender, currentRound, contributionAmount);
    }

    function processRound() external nonReentrant {
        require(status == CircleStatus.Active, "E30");
        require(block.timestamp > roundDeadline + gracePeriodSeconds, "E31");

        uint activeMembersCountInitial = 0;
        for (uint i = 0; i < memberAddresses.length; i++) {
            if (!membersData[memberAddresses[i]].isDefaulted) {
                activeMembersCountInitial++;
            }
        }
        if (activeMembersCountInitial == 0 && memberAddresses.length > 0) {
             _failCircle(); return;
        }


        for (uint i = 0; i < memberAddresses.length; i++) {
            Member storage member = membersData[memberAddresses[i]];
            if (!member.isDefaulted && !member.hasContributedThisRound) {
                _slashCollateral(memberAddresses[i]);
            }
        }
        
        uint currentActiveMembersFinal = 0;
        for (uint i = 0; i < memberAddresses.length; i++) {
            if(!membersData[memberAddresses[i]].isDefaulted) {
                currentActiveMembersFinal++;
            }
        }

        if (currentActiveMembersFinal == 0 && memberAddresses.length > 0) {
            _failCircle();
            return;
        }
        if (currentPot == 0 && currentActiveMembersFinal > 0) {
            // This implies no contributions and no collateral could cover anything.
            // Potentially skip round or fail. Failing is safer for MVP if rules are strict.
            // Consider if a round can proceed with 0 pot. For now, assume distribution needs >0 pot.
             _failCircle(); // Or adjust logic if 0 pot distribution makes sense (e.g., just advance round)
            return;
        }

        _distributePot();

        if (status == CircleStatus.Active) {
             if (currentRound > maxMembers) {
                _completeCircle();
            } else {
                _startNextRound();
            }
        }
    }

    function withdrawCollateral() external nonReentrant {
        require(status == CircleStatus.Completed || status == CircleStatus.Failed, "E40");
        Member storage member = membersData[msg.sender];
        require(member.addr != address(0), "E21");
        
        uint256 amountToWithdraw = 0;
        if (!member.isDefaulted && member.collateralDeposited > 0) {
            amountToWithdraw = member.collateralDeposited;
            member.collateralDeposited = 0;
        } else if (status == CircleStatus.Failed && member.collateralDeposited > 0) {
            // If circle failed, allow members to try withdraw their remaining collateral
            amountToWithdraw = member.collateralDeposited;
            member.collateralDeposited = 0;
        }

        require(amountToWithdraw > 0, "E41");

        IERC20(stablecoinAddress).transfer(member.addr, amountToWithdraw);
        emit CollateralWithdrawn(msg.sender, amountToWithdraw);
    }

    function _activateCircle() internal {
        status = CircleStatus.Active;
        currentRound = 1;
        roundDeadline = block.timestamp + contributionPeriodSeconds;
        emit CircleActivated(roundDeadline);
    }

    function _slashCollateral(address _memberAddress) internal {
        Member storage member = membersData[_memberAddress];

        uint256 amountToCover = contributionAmount;
        uint256 penalty = (amountToCover * penaltyPercentageForMissed) / 100;
        uint256 totalDeduction = amountToCover + penalty;

        if (member.collateralDeposited >= totalDeduction) {
            member.collateralDeposited -= totalDeduction;
            currentPot += amountToCover;
            currentPot += penalty;
            member.hasContributedThisRound = true; // Covered by collateral
            member.reputationScore = member.reputationScore > 50 ? member.reputationScore - 50 : 0;
            emit CollateralSlashed(_memberAddress, amountToCover, penalty);
        } else {
            currentPot += member.collateralDeposited;
            member.collateralDeposited = 0;
            member.isDefaulted = true;
            member.reputationScore = 0;
            emit MemberDefaulted(_memberAddress);
        }
    }

    function _distributePot() internal {
        if (currentPot == 0 && status == CircleStatus.Active) {
             // If pot is 0, but circle is active, it implies all active members might have defaulted
             // and their collateral was insufficient or already depleted.
             // Consider failing the circle or simply advancing the round without distribution.
             // For simplicity, if pot is 0, we might just skip distribution.
             // However, processRound already has checks for this. If we reach here with 0 pot,
             // it might mean no one contributed and no collateral was slashed successfully.
            bool anyActive = false;
            for(uint i=0; i<memberAddresses.length; ++i){
                if(!membersData[memberAddresses[i]].isDefaulted) anyActive = true;
            }
            if(!anyActive && memberAddresses.length > 0) _failCircle(); // all defaulted
            return; // No distribution if pot is zero
        }


        address recipient = address(0);
        uint recipientRoundIndex = currentRound; // Keep track of which round's turn it is

        for (uint i = 0; i < maxMembers; i++) {
            if (recipientRoundIndex > memberAddresses.length || recipientRoundIndex == 0) { // Round index out of bounds
                _failCircle(); // Should not happen with correct round logic
                return;
            }
            address potentialRecipient = memberAddresses[recipientRoundIndex - 1]; // -1 for 0-indexed array
            if (!membersData[potentialRecipient].isDefaulted) {
                recipient = potentialRecipient;
                break;
            }
            recipientRoundIndex++; // Try next member in line (effectively advancing round for distribution purposes)
            if (recipientRoundIndex > maxMembers) { // Checked all potential recipients
                _completeCircle(); // All remaining were defaulted
                return;
            }
        }

        if (recipient == address(0)) {
            // This means all members from currentRound onwards are defaulted.
            // Or currentPot became 0 before finding a recipient.
            _completeCircle();
            return;
        }
        
        uint256 amountToDistribute = currentPot;
        currentPot = 0;

        IERC20(stablecoinAddress).transfer(recipient, amountToDistribute);
        // The `currentRound` variable should reflect the actual round number for which distribution occurred.
        // If we skipped defaulted members, `recipientRoundIndex` holds that.
        emit PotDistributed(recipient, recipientRoundIndex, amountToDistribute);
        currentRound = recipientRoundIndex; // Update main currentRound to the one that just got paid
    }

    function _startNextRound() internal {
        currentRound++; // Advance to the next logical round number
        if (currentRound > maxMembers) {
            _completeCircle();
            return;
        }
        roundDeadline = block.timestamp + contributionPeriodSeconds;
        for (uint i = 0; i < memberAddresses.length; i++) {
            if (!membersData[memberAddresses[i]].isDefaulted) {
                membersData[memberAddresses[i]].hasContributedThisRound = false;
            }
        }
    }

    function _completeCircle() internal {
        status = CircleStatus.Completed;
        emit CircleCompleted();
    }
    
    function _failCircle() internal {
        status = CircleStatus.Failed;
        emit CircleFailed();
    }

    function getCircleInfo() external view returns (
        address creator,
        CircleStatus _status,
        uint256 _currentRound,
        uint256 _roundDeadline,
        uint256 _currentPot,
        uint256 _memberCount,
        uint256 _maxMembers,
        uint256 _contributionAmount,
        uint256 _collateralRequirement
    ) {
        return (
            owner(),
            status,
            currentRound,
            roundDeadline,
            currentPot,
            memberAddresses.length,
            maxMembers,
            contributionAmount,
            collateralRequirement
        );
    }

    function getMemberInfo(address _memberAddress) external view returns (Member memory) {
        require(membersData[_memberAddress].addr != address(0), "E50");
        return membersData[_memberAddress];
    }

    function getAllMemberAddresses() external view returns (address[] memory) {
        return memberAddresses;
    }
}