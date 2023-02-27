pragma solidity ^0.5.16;
import "../Utils/SafeBEP20.sol";
import "../Utils/IBEP20.sol";
import "./NAIVaultProxy.sol";
import "./NAIVaultStorage.sol";
import "./NAIVaultErrorReporter.sol";

contract NAIVault is NAIVaultStorage {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    /// @notice Event emitted when NAI deposit
    event Deposit(address indexed user, uint256 amount);

    /// @notice Event emitted when NAI withrawal
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Event emitted when admin changed
    event AdminTransfered(address indexed oldAdmin, address indexed newAdmin);

    constructor() public {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    /*** Reentrancy Guard ***/

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
     * @notice Deposit NAI to NAIVault for NWL allocation
     * @param _amount The amount to deposit to vault
     */
    function deposit(uint256 _amount) public nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        updateVault();

        // Transfer pending tokens to user
        updateAndPayOutPending(msg.sender);

        // Transfer in the amounts from user
        if(_amount > 0) {
            nai.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(accNWLPerShare).div(1e18);
        emit Deposit(msg.sender, _amount);
    }

    /**
     * @notice Withdraw NAI from NAIVault
     * @param _amount The amount to withdraw from vault
     */
    function withdraw(uint256 _amount) public nonReentrant {
        _withdraw(msg.sender, _amount);
    }

    /**
     * @notice Claim NWL from NAIVault
     */
    function claim() public nonReentrant {
        _withdraw(msg.sender, 0);
    }

    /**
     * @notice Low level withdraw function
     * @param account The account to withdraw from vault
     * @param _amount The amount to withdraw from vault
     */
    function _withdraw(address account, uint256 _amount) internal {
        UserInfo storage user = userInfo[account];
        require(user.amount >= _amount, "withdraw: not good");

        updateVault();
        updateAndPayOutPending(account); // Update balances of account this is not withdrawal but claiming NWL farmed

        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            nai.safeTransfer(address(account), _amount);
        }
        user.rewardDebt = user.amount.mul(accNWLPerShare).div(1e18);

        emit Withdraw(account, _amount);
    }

    /**
     * @notice View function to see pending NWL on frontend
     * @param _user The user to see pending NWL
     */
    function pendingNWL(address _user) public view returns (uint256)
    {
        UserInfo storage user = userInfo[_user];

        return user.amount.mul(accNWLPerShare).div(1e18).sub(user.rewardDebt);
    }

    /**
     * @notice Update and pay out pending NWL to user
     * @param account The user to pay out
     */
    function updateAndPayOutPending(address account) internal {
        uint256 pending = pendingNWL(account);

        if(pending > 0) {
            safeNWLTransfer(account, pending);
        }
    }

    /**
     * @notice Safe NWL transfer function, just in case if rounding error causes pool to not have enough NWL
     * @param _to The address that NWL to be transfered
     * @param _amount The amount that NWL to be transfered
     */
    function safeNWLTransfer(address _to, uint256 _amount) internal {
        uint256 nwlBal = nwl.balanceOf(address(this));

        if (_amount > nwlBal) {
            nwl.transfer(_to, nwlBal);
            nwlBalance = nwl.balanceOf(address(this));
        } else {
            nwl.transfer(_to, _amount);
            nwlBalance = nwl.balanceOf(address(this));
        }
    }

    /**
     * @notice Function that updates pending rewards
     */
    function updatePendingRewards() public {
        uint256 newRewards = nwl.balanceOf(address(this)).sub(nwlBalance);

        if(newRewards > 0) {
            nwlBalance = nwl.balanceOf(address(this)); // If there is no change the balance didn't change
            pendingRewards = pendingRewards.add(newRewards);
        }
    }

    /**
     * @notice Update reward variables to be up-to-date
     */
    function updateVault() internal {
        uint256 naiBalance = nai.balanceOf(address(this));
        if (naiBalance == 0) { // avoids division by 0 errors
            return;
        }

        accNWLPerShare = accNWLPerShare.add(pendingRewards.mul(1e18).div(naiBalance));
        pendingRewards = 0;
    }

    /**
     * @dev Returns the address of the current admin
     */
    function getAdmin() public view returns (address) {
        return admin;
    }

    /**
     * @dev Burn the current admin
     */
    function burnAdmin() public onlyAdmin {
        emit AdminTransfered(admin, address(0));
        admin = address(0);
    }

    /**
     * @dev Set the current admin to new address
     */
    function setNewAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "new owner is the zero address");
        emit AdminTransfered(admin, newAdmin);
        admin = newAdmin;
    }

    /*** Admin Functions ***/

    function _become(NAIVaultProxy naiVaultProxy) public {
        require(msg.sender == naiVaultProxy.admin(), "only proxy admin can change brains");
        require(naiVaultProxy._acceptImplementation() == 0, "change not authorized");
    }

    function setNarwhalInfo(address _nwl, address _nai) public onlyAdmin {
        nwl = IBEP20(_nwl);
        nai = IBEP20(_nai);

        _notEntered = true;
    }
}
