// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WeeklyTokenStaking is ReentrancyGuard {
    IERC20 public immutable stakingToken;   // 0 Decimals (D.INVEST)
    IERC20 public immutable rewardToken;    // 2 Decimals (D.FAITH)

    uint256 public constant WEEK = 7 days;
    uint256 public constant MIN_CLAIM_AMOUNT = 1; // 0.01 D.FAITH (1 wei = 0.01 token with 2 decimals)
    
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;

    struct StakeInfo {
        uint256 amount;
        uint256 lastRewardUpdate;
        uint256 stakeTimestamp;
        uint256 accumulatedRewards;
    }

    struct RewardStage {
        uint256 maxTotalDistributed;
        uint256 rewardRatePercent; // Rate pro Woche in Prozent (10 = 10%)
    }

    RewardStage[] public stages;
    mapping(address => StakeInfo) public stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    constructor(address _stakingToken, address _rewardToken) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        require(_stakingToken != _rewardToken, "Tokens must be different");

        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);

        // Halving Stages: 10% -> 5% -> 2.5% -> 1.25% -> 0.625% -> 0.3125%
        // Alle Raten * 100 für konsistente Skalierung
        stages.push(RewardStage(10000 * 100, 1000));   // 0-10,000 D.FAITH: 10% (1000/100)
        stages.push(RewardStage(20000 * 100, 500));    // 10,000-20,000: 5% (500/100)
        stages.push(RewardStage(40000 * 100, 250));    // 20,000-40,000: 2.5% (250/100)
        stages.push(RewardStage(60000 * 100, 125));    // 40,000-60,000: 1.25% (125/100)
        stages.push(RewardStage(80000 * 100, 63));     // 60,000-80,000: 0.63% (63/100, rounded from 62.5)
        stages.push(RewardStage(type(uint256).max, 31)); // 80,000+: 0.31% (31/100, rounded from 31.25)
    }

    function getCurrentRewardRate() public view returns (uint256) {
        for (uint i = 0; i < stages.length; i++) {
            if (totalRewardsDistributed < stages[i].maxTotalDistributed) {
                return stages[i].rewardRatePercent;
            }
        }
        return stages[stages.length - 1].rewardRatePercent;
    }

    function getCurrentStage() public view returns (uint8) {
        for (uint8 i = 0; i < stages.length; i++) {
            if (totalRewardsDistributed < stages[i].maxTotalDistributed) {
                return i + 1;
            }
        }
        return uint8(stages.length);
    }

    function _updateRewards(address _user) internal {
        StakeInfo storage user = stakers[_user];
        if (user.amount == 0 || user.lastRewardUpdate == 0) {
            return;
        }

        uint256 timeElapsed = block.timestamp - user.lastRewardUpdate;
        if (timeElapsed > 0) {
            uint256 rewardRate = getCurrentRewardRate();
            
            // Verbesserte Berechnung mit höherer Präzision
            // Formula: (stakedAmount * rewardRate * timeElapsed) / (604800 * 100)
            uint256 newRewards = (user.amount * rewardRate * timeElapsed) / (604800 * 100);
            
            user.accumulatedRewards += newRewards;
            user.lastRewardUpdate = block.timestamp;
        }
    }

    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        StakeInfo storage user = stakers[msg.sender];

        // Update rewards before changing stake amount
        _updateRewards(msg.sender);

        if (user.amount == 0) {
            user.stakeTimestamp = block.timestamp;
            user.lastRewardUpdate = block.timestamp;
        }

        user.amount += _amount;
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external nonReentrant {
        StakeInfo storage user = stakers[msg.sender];
        require(user.amount >= _amount, "Not enough tokens staked");
        require(_amount > 0, "Amount must be > 0");

        // Update rewards first
        _updateRewards(msg.sender);

        user.amount -= _amount;
        totalStaked -= _amount;

        // If unstaking everything, reset user data
        if (user.amount == 0) {
            user.lastRewardUpdate = 0;
            user.stakeTimestamp = 0;
        } else {
            user.lastRewardUpdate = block.timestamp;
        }

        require(stakingToken.transfer(msg.sender, _amount), "Transfer failed");
        emit Unstaked(msg.sender, _amount);
    }

    function claimReward() external nonReentrant {
        StakeInfo storage user = stakers[msg.sender];
        require(user.amount > 0, "Nothing staked");

        // Update rewards to current time
        _updateRewards(msg.sender);
        
        // 1. Rewards werden aktualisiert (accumulatedRewards wird erhöht)
        uint256 reward = user.accumulatedRewards;
        
        // 2. Alle akkumulierten Rewards werden ausgezahlt
        // 3. RESET: accumulatedRewards wird auf 0 gesetzt
        user.accumulatedRewards = 0;
        
        // 4. lastRewardUpdate wird NICHT zurückgesetzt (bleibt current timestamp)

        require(reward >= MIN_CLAIM_AMOUNT, "Minimum claim amount not reached");
        require(rewardToken.balanceOf(address(this)) >= reward, "Insufficient reward tokens");

        totalRewardsDistributed += reward;

        require(rewardToken.transfer(msg.sender, reward), "Reward transfer failed");
        emit RewardClaimed(msg.sender, reward);
    }

    // View Functions
    function getClaimableReward(address _user) external view returns (uint256) {
        StakeInfo storage user = stakers[_user];
        if (user.amount == 0 || user.lastRewardUpdate == 0) {
            return user.accumulatedRewards;
        }

        uint256 timeElapsed = block.timestamp - user.lastRewardUpdate;
        uint256 rewardRate = getCurrentRewardRate();
        
        // Verbesserte Berechnung: direkte Multiplikation vermeidet Präzisionsverlust
        uint256 pendingRewards = (user.amount * rewardRate * timeElapsed) / (604800 * 100);

        return user.accumulatedRewards + pendingRewards;
    }

    // Detaillierte Reward-Anzeige für UI
    function getDetailedRewardInfo(address _user) external view returns (
        uint256 claimableReward,           // Normale claimable rewards (2 decimals)
        uint256 nextClaimTimestamp,        // Timestamp wann nächster Claim möglich ist
        uint256 secondsPerClaim,           // Sekunden pro 0.01 D.FAITH für die gestakten Tokens des Users
        uint256 currentRatePercent,        // Aktuelle Rate in Prozent
        bool canClaimNow                   // Kann jetzt claimen?
    ) {
        StakeInfo storage user = stakers[_user];
        currentRatePercent = getCurrentRewardRate();
        
        // Berechne secondsPerClaim für die tatsächlich gestakten Tokens des Users
        if (currentRatePercent > 0 && user.amount > 0) {
            // Berechnung: (MIN_CLAIM_AMOUNT * 604800 * 100) / (user.amount * currentRatePercent)
            uint256 numerator = MIN_CLAIM_AMOUNT * 604800 * 100;
            uint256 denominator = user.amount * currentRatePercent;
            secondsPerClaim = numerator / denominator;
        } else {
            secondsPerClaim = type(uint256).max;
        }
        
        if (user.amount == 0) {
            return (0, 0, secondsPerClaim, currentRatePercent, false);
        }
        
        // Berechne claimableReward basierend auf timeElapsed seit letztem Update
        uint256 timeElapsed = block.timestamp - user.lastRewardUpdate;
        uint256 pendingRewards = 0;
        
        if (timeElapsed > 0 && user.lastRewardUpdate > 0) {
            pendingRewards = (user.amount * currentRatePercent * timeElapsed) / (604800 * 100);
        }
        
        claimableReward = user.accumulatedRewards + pendingRewards;
        canClaimNow = claimableReward >= MIN_CLAIM_AMOUNT;
        
        // Berechne nextClaimTimestamp
        if (canClaimNow) {
            nextClaimTimestamp = block.timestamp; // Sofort möglich
        } else if (user.amount > 0 && currentRatePercent > 0) {
            uint256 remainingWei = MIN_CLAIM_AMOUNT - claimableReward;
            uint256 secondsToNextClaim = (remainingWei * 604800 * 100) / (user.amount * currentRatePercent);
            nextClaimTimestamp = block.timestamp + secondsToNextClaim;
        } else {
            nextClaimTimestamp = 0; // Nie möglich
        }
    }

    function getUserInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 claimableReward,
        uint256 stakeTimestamp,
        bool canUnstake,
        bool canClaim
    ) {
        StakeInfo storage user = stakers[_user];
        stakedAmount = user.amount;
        claimableReward = this.getClaimableReward(_user);
        stakeTimestamp = user.stakeTimestamp;
        
        canUnstake = user.amount > 0; // Jederzeit möglich wenn Token gestaked sind
        canClaim = claimableReward >= MIN_CLAIM_AMOUNT;
    }

    function getContractInfo() external view returns (
        uint256 totalStakedTokens,
        uint256 rewardBalance,
        uint8 currentStage,
        uint256 currentRate
    ) {
        totalStakedTokens = totalStaked;
        rewardBalance = rewardToken.balanceOf(address(this));
        currentStage = getCurrentStage();
        currentRate = getCurrentRewardRate();
    }
}