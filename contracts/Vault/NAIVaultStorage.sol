pragma solidity ^0.5.16;
import "../Utils/SafeMath.sol";
import "../Utils/IBEP20.sol";

contract NAIVaultAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of NAI Vault
    */
    address public naiVaultImplementation;

    /**
    * @notice Pending brains of NAI Vault
    */
    address public pendingNAIVaultImplementation;
}

contract NAIVaultStorage is NAIVaultAdminStorage {
    /// @notice The NWL TOKEN!
    IBEP20 public nwl;

    /// @notice The NAI TOKEN!
    IBEP20 public nai;

    /// @notice Guard variable for re-entrancy checks
    bool internal _notEntered;

    /// @notice NWL balance of vault
    uint256 public nwlBalance;

    /// @notice Accumulated NWL per share
    uint256 public accNWLPerShare;

    //// pending rewards awaiting anyone to update
    uint256 public pendingRewards;

    /// @notice Info of each user.
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    // Info of each user that stakes tokens.
    mapping(address => UserInfo) public userInfo;
}
