pragma solidity ^0.5.16;

import "./NToken.sol";
import "./PriceOracle.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./NAIControllerStorage.sol";
import "./NAIUnitroller.sol";
import "./NAI/NAI.sol";

interface ComptrollerImplInterface {
    function protocolPaused() external view returns (bool);
    function mintedNAIs(address account) external view returns (uint);
    function naiMintRate() external view returns (uint);
    function narwhalAccrued(address account) external view returns(uint);
    function getAssetsIn(address account) external view returns (NToken[] memory);
    function oracle() external view returns (PriceOracle);
}

/**
 * @title Narwhal's NAI Comptroller Contract
 * @author Narwhal
 */
contract NAIController is NAIControllerStorageG2, NAIControllerErrorReporter, Exponential {

    /// @notice Emitted when Comptroller is changed
    event NewComptroller(ComptrollerInterface oldComptroller, ComptrollerInterface newComptroller);

    /**
     * @notice Event emitted when NAI is minted
     */
    event MintNAI(address minter, uint mintNAIAmount);

    /**
     * @notice Event emitted when NAI is repaid
     */
    event RepayNAI(address payer, address borrower, uint repayNAIAmount);

    /// @notice The initial Narwhal index for a market
    uint224 public constant narwhalInitialIndex = 1e36;

    /**
     * @notice Event emitted when a borrow is liquidated
     */
    event LiquidateNAI(address liquidator, address borrower, uint repayAmount, address nTokenCollateral, uint seizeTokens);

    /**
     * @notice Emitted when treasury guardian is changed
     */
    event NewTreasuryGuardian(address oldTreasuryGuardian, address newTreasuryGuardian);

    /**
     * @notice Emitted when treasury address is changed
     */
    event NewTreasuryAddress(address oldTreasuryAddress, address newTreasuryAddress);

    /**
     * @notice Emitted when treasury percent is changed
     */
    event NewTreasuryPercent(uint oldTreasuryPercent, uint newTreasuryPercent);

    /**
     * @notice Event emitted when NAIs are minted and fee are transferred
     */
    event MintFee(address minter, uint feeAmount);

    /*** Main Actions ***/
    struct MintLocalVars {
        uint oErr;
        MathError mathErr;
        uint mintAmount;
        uint accountMintNAINew;
        uint accountMintableNAI;
    }

    function mintNAI(uint mintNAIAmount) external nonReentrant returns (uint) {
        if(address(comptroller) != address(0)) {
            require(mintNAIAmount > 0, "mintNAIAmount cannt be zero");

            require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            MintLocalVars memory vars;

            address minter = msg.sender;

            (vars.oErr, vars.accountMintableNAI) = getMintableNAI(minter);
            if (vars.oErr != uint(Error.NO_ERROR)) {
                return uint(Error.REJECTION);
            }

            // check that user have sufficient mintableNAI balance
            if (mintNAIAmount > vars.accountMintableNAI) {
                return fail(Error.REJECTION, FailureInfo.NAI_MINT_REJECTION);
            }

            (vars.mathErr, vars.accountMintNAINew) = addUInt(ComptrollerImplInterface(address(comptroller)).mintedNAIs(minter), mintNAIAmount);
            require(vars.mathErr == MathError.NO_ERROR, "NAI_MINT_AMOUNT_CALCULATION_FAILED");
            uint error = comptroller.setMintedNAIOf(minter, vars.accountMintNAINew);
            if (error != 0 ) {
                return error;
            }

            uint feeAmount;
            uint remainedAmount;
            vars.mintAmount = mintNAIAmount;
            if (treasuryPercent != 0) {
                (vars.mathErr, feeAmount) = mulUInt(vars.mintAmount, treasuryPercent);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                (vars.mathErr, feeAmount) = divUInt(feeAmount, 1e18);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                (vars.mathErr, remainedAmount) = subUInt(vars.mintAmount, feeAmount);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                NAI(getNAIAddress()).mint(treasuryAddress, feeAmount);

                emit MintFee(minter, feeAmount);
            } else {
                remainedAmount = vars.mintAmount;
            }

            NAI(getNAIAddress()).mint(minter, remainedAmount);

            emit MintNAI(minter, remainedAmount);

            return uint(Error.NO_ERROR);
        }
    }

    /**
     * @notice Repay NAI
     */
    function repayNAI(uint repayNAIAmount) external nonReentrant returns (uint, uint) {
        if(address(comptroller) != address(0)) {
            require(repayNAIAmount > 0, "repayNAIAmount cannt be zero");

            require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address payer = msg.sender;

            return repayNAIFresh(msg.sender, msg.sender, repayNAIAmount);
        }
    }

    /**
     * @notice Repay NAI Internal
     * @notice Borrowed NAIs are repaid by another user (possibly the borrower).
     * @param payer the account paying off the NAI
     * @param borrower the account with the debt being payed off
     * @param repayAmount the amount of NAI being returned
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment amount.
     */
    function repayNAIFresh(address payer, address borrower, uint repayAmount) internal returns (uint, uint) {
        uint actualBurnAmount;

        uint naiBalanceBorrower = ComptrollerImplInterface(address(comptroller)).mintedNAIs(borrower);

        if(naiBalanceBorrower > repayAmount) {
            actualBurnAmount = repayAmount;
        } else {
            actualBurnAmount = naiBalanceBorrower;
        }

        MathError mErr;
        uint accountNAINew;

        NAI(getNAIAddress()).burn(payer, actualBurnAmount);

        (mErr, accountNAINew) = subUInt(naiBalanceBorrower, actualBurnAmount);
        require(mErr == MathError.NO_ERROR, "NAI_BURN_AMOUNT_CALCULATION_FAILED");

        uint error = comptroller.setMintedNAIOf(borrower, accountNAINew);
        if (error != 0) {
            return (error, 0);
        }
        emit RepayNAI(payer, borrower, actualBurnAmount);

        return (uint(Error.NO_ERROR), actualBurnAmount);
    }

    /**
     * @notice The sender liquidates the nai minters collateral.
     *  The collateral seized is transferred to the liquidator.
     * @param borrower The borrower of nai to be liquidated
     * @param nTokenCollateral The market in which to seize collateral from the borrower
     * @param repayAmount The amount of the underlying borrowed asset to repay
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment amount.
     */
    function liquidateNAI(address borrower, uint repayAmount, NTokenInterface nTokenCollateral) external nonReentrant returns (uint, uint) {
        require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

        uint error = nTokenCollateral.accrueInterest();
        if (error != uint(Error.NO_ERROR)) {
            // accrueInterest emits logs on errors, but we still want to log the fact that an attempted liquidation failed
            return (fail(Error(error), FailureInfo.NAI_LIQUIDATE_ACCRUE_COLLATERAL_INTEREST_FAILED), 0);
        }

        // liquidateNAIFresh emits borrow-specific logs on errors, so we don't need to
        return liquidateNAIFresh(msg.sender, borrower, repayAmount, nTokenCollateral);
    }

    /**
     * @notice The liquidator liquidates the borrowers collateral by repay borrowers NAI.
     *  The collateral seized is transferred to the liquidator.
     * @param liquidator The address repaying the NAI and seizing collateral
     * @param borrower The borrower of this NAI to be liquidated
     * @param nTokenCollateral The market in which to seize collateral from the borrower
     * @param repayAmount The amount of the NAI to repay
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment NAI.
     */
    function liquidateNAIFresh(address liquidator, address borrower, uint repayAmount, NTokenInterface nTokenCollateral) internal returns (uint, uint) {
        if(address(comptroller) != address(0)) {
            /* Fail if liquidate not allowed */
            uint allowed = comptroller.liquidateBorrowAllowed(address(this), address(nTokenCollateral), liquidator, borrower, repayAmount);
            if (allowed != 0) {
                return (failOpaque(Error.REJECTION, FailureInfo.NAI_LIQUIDATE_COMPTROLLER_REJECTION, allowed), 0);
            }

            /* Verify nTokenCollateral market's block number equals current block number */
            //if (nTokenCollateral.accrualBlockNumber() != accrualBlockNumber) {
            if (nTokenCollateral.accrualBlockNumber() != getBlockNumber()) {
                return (fail(Error.REJECTION, FailureInfo.NAI_LIQUIDATE_COLLATERAL_FRESHNESS_CHECK), 0);
            }

            /* Fail if borrower = liquidator */
            if (borrower == liquidator) {
                return (fail(Error.REJECTION, FailureInfo.NAI_LIQUIDATE_LIQUIDATOR_IS_BORROWER), 0);
            }

            /* Fail if repayAmount = 0 */
            if (repayAmount == 0) {
                return (fail(Error.REJECTION, FailureInfo.NAI_LIQUIDATE_CLOSE_AMOUNT_IS_ZERO), 0);
            }

            /* Fail if repayAmount = -1 */
            if (repayAmount == uint(-1)) {
                return (fail(Error.REJECTION, FailureInfo.NAI_LIQUIDATE_CLOSE_AMOUNT_IS_UINT_MAX), 0);
            }


            /* Fail if repayNAI fails */
            (uint repayBorrowError, uint actualRepayAmount) = repayNAIFresh(liquidator, borrower, repayAmount);
            if (repayBorrowError != uint(Error.NO_ERROR)) {
                return (fail(Error(repayBorrowError), FailureInfo.NAI_LIQUIDATE_REPAY_BORROW_FRESH_FAILED), 0);
            }

            /////////////////////////
            // EFFECTS & INTERACTIONS
            // (No safe failures beyond this point)

            /* We calculate the number of collateral tokens that will be seized */
            (uint amountSeizeError, uint seizeTokens) = comptroller.liquidateNAICalculateSeizeTokens(address(nTokenCollateral), actualRepayAmount);
            require(amountSeizeError == uint(Error.NO_ERROR), "NAI_LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED");

            /* Revert if borrower collateral token balance < seizeTokens */
            require(nTokenCollateral.balanceOf(borrower) >= seizeTokens, "NAI_LIQUIDATE_SEIZE_TOO_MUCH");

            uint seizeError;
            seizeError = nTokenCollateral.seize(liquidator, borrower, seizeTokens);

            /* Revert if seize tokens fails (since we cannot be sure of side effects) */
            require(seizeError == uint(Error.NO_ERROR), "token seizure failed");

            /* We emit a LiquidateBorrow event */
            emit LiquidateNAI(liquidator, borrower, actualRepayAmount, address(nTokenCollateral), seizeTokens);

            /* We call the defense hook */
            comptroller.liquidateBorrowVerify(address(this), address(nTokenCollateral), liquidator, borrower, actualRepayAmount, seizeTokens);

            return (uint(Error.NO_ERROR), actualRepayAmount);
        }
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new comptroller
      * @dev Admin function to set a new comptroller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setComptroller(ComptrollerInterface comptroller_) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        ComptrollerInterface oldComptroller = comptroller;
        comptroller = comptroller_;
        emit NewComptroller(oldComptroller, comptroller_);

        return uint(Error.NO_ERROR);
    }

    function _become(NAIUnitroller unitroller) external {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        require(unitroller._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account total supply balance.
     *  Note that `nTokenBalance` is the number of nTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountAmountLocalVars {
        uint oErr;
        MathError mErr;
        uint sumSupply;
        uint sumBorrowPlusEffects;
        uint nTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    function getMintableNAI(address minter) public view returns (uint, uint) {
        PriceOracle oracle = ComptrollerImplInterface(address(comptroller)).oracle();
        NToken[] memory enteredMarkets = ComptrollerImplInterface(address(comptroller)).getAssetsIn(minter);

        AccountAmountLocalVars memory vars; // Holds all our calculation results

        uint accountMintableNAI;
        uint i;

        /**
         * We use this formula to calculate mintable NAI amount.
         * totalSupplyAmount * NAIMintRate - (totalBorrowAmount + mintedNAIOf)
         */
        for (i = 0; i < enteredMarkets.length; i++) {
            (vars.oErr, vars.nTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = enteredMarkets[i].getAccountSnapshot(minter);
            if (vars.oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (uint(Error.SNAPSHOT_ERROR), 0);
            }
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(enteredMarkets[i]);
            if (vars.oraclePriceMantissa == 0) {
                return (uint(Error.PRICE_ERROR), 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            (vars.mErr, vars.tokensToDenom) = mulExp(vars.exchangeRate, vars.oraclePrice);
            if (vars.mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumSupply += tokensToDenom * nTokenBalance
            (vars.mErr, vars.sumSupply) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.nTokenBalance, vars.sumSupply);
            if (vars.mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (vars.mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (vars.mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }
        }

        (vars.mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, ComptrollerImplInterface(address(comptroller)).mintedNAIs(minter));
        if (vars.mErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (vars.mErr, accountMintableNAI) = mulUInt(vars.sumSupply, ComptrollerImplInterface(address(comptroller)).naiMintRate());
        require(vars.mErr == MathError.NO_ERROR, "NAI_MINT_AMOUNT_CALCULATION_FAILED");

        (vars.mErr, accountMintableNAI) = divUInt(accountMintableNAI, 10000);
        require(vars.mErr == MathError.NO_ERROR, "NAI_MINT_AMOUNT_CALCULATION_FAILED");


        (vars.mErr, accountMintableNAI) = subUInt(accountMintableNAI, vars.sumBorrowPlusEffects);
        if (vars.mErr != MathError.NO_ERROR) {
            return (uint(Error.REJECTION), 0);
        }

        return (uint(Error.NO_ERROR), accountMintableNAI);
    }

    function _setTreasuryData(address newTreasuryGuardian, address newTreasuryAddress, uint newTreasuryPercent) external returns (uint) {
        // Check caller is admin
        if (!(msg.sender == admin || msg.sender == treasuryGuardian)) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_TREASURY_OWNER_CHECK);
        }

        require(newTreasuryPercent < 1e18, "treasury percent cap overflow");

        address oldTreasuryGuardian = treasuryGuardian;
        address oldTreasuryAddress = treasuryAddress;
        uint oldTreasuryPercent = treasuryPercent;

        treasuryGuardian = newTreasuryGuardian;
        treasuryAddress = newTreasuryAddress;
        treasuryPercent = newTreasuryPercent;

        emit NewTreasuryGuardian(oldTreasuryGuardian, newTreasuryGuardian);
        emit NewTreasuryAddress(oldTreasuryAddress, newTreasuryAddress);
        emit NewTreasuryPercent(oldTreasuryPercent, newTreasuryPercent);

        return uint(Error.NO_ERROR);
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the NAI token
     * @return The address of NAI
     */
    function getNAIAddress() public view returns (address) {
        return 0xF2f098c0912133B21B3206c626A2b57820330aBC;   // TODO: need to replace
    }

    function initialize() onlyAdmin public {
        // The counter starts true to prevent changing it from zero to non-zero (i.e. smaller cost/refund)
        _notEntered = true;
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
}
