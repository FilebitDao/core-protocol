pragma solidity ^0.5.16;

import "../Utils/SafeMath.sol";
import "../Utils/IBEP20.sol";

contract NWLVestingAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of NWLVesting
    */
    address public implementation;

    /**
    * @notice Pending brains of NWLVesting
    */
    address public pendingImplementation;
}

contract NWLVestingStorage is NWLVestingAdminStorage {

    struct VestingRecord {
        address recipient;
        uint256 startTime;
        uint256 amount;
        uint256 withdrawnAmount;
    }

    /// @notice Guard variable for re-entrancy checks
    bool public _notEntered;

    /// @notice indicator to check if the contract is initialized
    bool public initialized;

    /// @notice The NWL TOKEN!
    IBEP20 public nwl;

    /// @notice VRTConversion Contract Address
    address public vrtConversionAddress;

    /// @notice mapping of VestingRecord(s) for user(s)
    mapping(address => VestingRecord[]) public vestings;
}