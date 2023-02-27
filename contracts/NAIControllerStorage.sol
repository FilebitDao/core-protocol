pragma solidity ^0.5.16;

import "./ComptrollerInterface.sol";

contract NAIUnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of Unitroller
    */
    address public naiControllerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingNAIControllerImplementation;
}

contract NAIControllerStorageG1 is NAIUnitrollerAdminStorage {
    ComptrollerInterface public comptroller;

    struct NarwhalNAIState {
        /// @notice The last updated narwhalNAIMintIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice The Narwhal NAI state
    NarwhalNAIState public narwhalNAIState;

    /// @notice The Narwhal NAI state initialized
    bool public isNarwhalNAIInitialized;

    /// @notice The Narwhal NAI minter index as of the last time they accrued NWL
    mapping(address => uint) public narwhalNAIMinterIndex;
}

contract NAIControllerStorageG2 is NAIControllerStorageG1 {
    /// @notice Treasury Guardian address
    address public treasuryGuardian;

    /// @notice Treasury address
    address public treasuryAddress;

    /// @notice Fee percent of accrued interest with decimal 18
    uint256 public treasuryPercent;

    /// @notice Guard variable for re-entrancy checks
    bool internal _notEntered;
}
