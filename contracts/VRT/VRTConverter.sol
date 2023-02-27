pragma solidity ^0.5.16;

import "../Utils/IBEP20.sol";
import "../Utils/SafeBEP20.sol";
import "./INWLVesting.sol";
import "./VRTConverterStorage.sol";
import "./VRTConverterProxy.sol";

/**
 * @title Narwhal's VRTConversion Contract
 * @author Narwhal
 */
contract VRTConverter is VRTConverterStorage {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice decimal precision for VRT
    uint256 public constant vrtDecimalsMultiplier = 1e18;

    /// @notice decimal precision for NWL
    uint256 public constant nwlDecimalsMultiplier = 1e18;

    /// @notice Emitted when an admin set conversion info
    event ConversionInfoSet(uint256 conversionRatio, uint256 conversionStartTime, uint256 conversionPeriod, uint256 conversionEndTime);

    /// @notice Emitted when token conversion is done
    event TokenConverted(address reedeemer, address vrtAddress, uint256 vrtAmount, address nwlAddress, uint256 nwlAmount);

    /// @notice Emitted when an admin withdraw converted token
    event TokenWithdraw(address token, address to, uint256 amount);

    /// @notice Emitted when NWLVestingAddress is set
    event NWLVestingSet(address nwlVestingAddress);

    constructor() public {}

    function initialize(address _vrtAddress,
                address _nwlAddress,
                uint256 _conversionRatio,
                uint256 _conversionStartTime,
                uint256 _conversionPeriod) public {
        require(msg.sender == admin, "only admin may initialize the VRTConverter");
        require(initialized == false, "VRTConverter is already initialized");

        require(_vrtAddress != address(0), "vrtAddress cannot be Zero");
        vrt = IBEP20(_vrtAddress);
        
        require(_nwlAddress != address(0), "nwlAddress cannot be Zero");
        nwl = IBEP20(_nwlAddress);
        
        require(_conversionRatio > 0, "conversionRatio cannot be Zero");
        conversionRatio = _conversionRatio;

        require(_conversionStartTime >= block.timestamp, "conversionStartTime must be time in the future");
        require(_conversionPeriod > 0, "_conversionPeriod is invalid");

        conversionStartTime = _conversionStartTime;
        conversionPeriod = _conversionPeriod;
        conversionEndTime = conversionStartTime.add(conversionPeriod);
        emit ConversionInfoSet(conversionRatio, conversionStartTime, conversionPeriod, conversionEndTime);
        
        totalVrtConverted = 0;
        _notEntered = true;
        initialized = true;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true; // get a gas-refund post-Istanbul
    }

    /**
     * @notice sets NWLVestingProxy Address
     * @dev Note: If NWLVestingProxy is not set, then Conversion is not allowed
     * @param _nwlVestingAddress The NWLVestingProxy Address
     */
    function setNWLVesting(address _nwlVestingAddress) public {
        require(msg.sender == admin, "only admin may initialize the Vault");
        require(_nwlVestingAddress != address(0), "nwlVestingAddress cannot be Zero");
        nwlVesting = INWLVesting(_nwlVestingAddress);
        emit NWLVestingSet(_nwlVestingAddress);
    }

    modifier isInitialized() {
        require(initialized == true, "VRTConverter is not initialized");
        _;
    }

    function isConversionActive() public view returns(bool) {
        uint256 currentTime = block.timestamp;
        if(currentTime >= conversionStartTime && currentTime <= conversionEndTime){
            return true;
        }
        return false;
    }

    modifier checkForActiveConversionPeriod(){
        uint256 currentTime = block.timestamp;
        require(currentTime >= conversionStartTime, "Conversion did not start yet");
        require(currentTime <= conversionEndTime, "Conversion Period Ended");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    modifier nonZeroAddress(address _address) {
        require(_address != address(0), "Address cannot be Zero");
        _;
    }

    /**
     * @notice Transfer VRT and redeem NWL
     * @dev Note: If there is not enough NWL, we do not perform the conversion.
     * @param vrtAmount The amount of VRT
     */
    function convert(uint256 vrtAmount) external isInitialized checkForActiveConversionPeriod nonReentrant
    {
        require(address(nwlVesting) != address(0) && address(nwlVesting) != DEAD_ADDRESS, "NWL-Vesting Address is not set");
        require(vrtAmount > 0, "VRT amount must be non-zero");
        totalVrtConverted = totalVrtConverted.add(vrtAmount);

        uint256 redeemAmount = vrtAmount
            .mul(conversionRatio)
            .mul(nwlDecimalsMultiplier)
            .div(1e18)
            .div(vrtDecimalsMultiplier);

        emit TokenConverted(msg.sender, address(vrt), vrtAmount, address(nwl), redeemAmount);
        vrt.safeTransferFrom(msg.sender, DEAD_ADDRESS, vrtAmount);
        nwlVesting.deposit(msg.sender, redeemAmount);
    }

    /*** Admin Functions ***/
    function _become(VRTConverterProxy vrtConverterProxy) public {
        require(msg.sender == vrtConverterProxy.admin(), "only proxy admin can change brains");
        vrtConverterProxy._acceptImplementation();
    }
}