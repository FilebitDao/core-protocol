pragma solidity ^0.5.16;

import "./NToken.sol";
import "./ErrorReporter.sol";
import "./PriceOracle.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerStorage.sol";
import "./Unitroller.sol";
import "./Governance/NWL.sol";
import "./NAI/NAI.sol";
import "./ComptrollerLensInterface.sol";
import "./IAccessControlManager.sol";

/**
 * @title Narwhal's Comptroller Contract
 * @author Narwhal
 */
contract Comptroller is ComptrollerV9Storage, ComptrollerInterfaceG2, ComptrollerErrorReporter, ExponentialNoError {
    /// @notice Emitted when an admin supports a market
    event MarketListed(NToken nToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(NToken nToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(NToken nToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(NToken nToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when NAI Vault info is changed
    event NewNAIVaultInfo(address vault_, uint releaseStartBlock_, uint releaseInterval_);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when an action is paused on a market
    event ActionPausedMarket(NToken indexed nToken, Action indexed action, bool pauseState);

    /// @notice Emitted when Narwhal NAI Vault rate is changed
    event NewNarwhalNAIVaultRate(uint oldNarwhalNAIVaultRate, uint newNarwhalNAIVaultRate);

    /// @notice Emitted when a new Narwhal speed is calculated for a market
    event NarwhalSpeedUpdated(NToken indexed nToken, uint newSpeed);

    /// @notice Emitted when NWL is distributed to a supplier
    event DistributedSupplierNarwhal(NToken indexed nToken, address indexed supplier, uint narwhalDelta, uint narwhalSupplyIndex);

    /// @notice Emitted when NWL is distributed to a borrower
    event DistributedBorrowerNarwhal(NToken indexed nToken, address indexed borrower, uint narwhalDelta, uint narwhalBorrowIndex);

    /// @notice Emitted when NWL is distributed to NAI Vault
    event DistributedNAIVaultNarwhal(uint amount);

    /// @notice Emitted when NAIController is changed
    event NewNAIController(NAIControllerInterface oldNAIController, NAIControllerInterface newNAIController);

    /// @notice Emitted when NAI mint rate is changed by admin
    event NewNAIMintRate(uint oldNAIMintRate, uint newNAIMintRate);

    /// @notice Emitted when protocol state is changed by admin
    event ActionProtocolPaused(bool state);

    /// @notice Emitted when borrow cap for a nToken is changed
    event NewBorrowCap(NToken indexed nToken, uint newBorrowCap);

    /// @notice Emitted when treasury guardian is changed
    event NewTreasuryGuardian(address oldTreasuryGuardian, address newTreasuryGuardian);

    /// @notice Emitted when treasury address is changed
    event NewTreasuryAddress(address oldTreasuryAddress, address newTreasuryAddress);

    /// @notice Emitted when treasury percent is changed
    event NewTreasuryPercent(uint oldTreasuryPercent, uint newTreasuryPercent);

    // @notice Emitted when liquidator adress is changed
    event NewLiquidatorContract(address oldLiquidatorContract, address newLiquidatorContract);

    /// @notice Emitted when Narwhal is granted by admin
    event NarwhalGranted(address recipient, uint amount);

    /// @notice Emitted whe ComptrollerLens address is changed
    event NewComptrollerLens(address oldComptrollerLens, address newComptrollerLens);

    /// @notice Emitted when supply cap for a nToken is changed
    event NewSupplyCap(NToken indexed nToken, uint newSupplyCap);

    /// @notice Emitted when access control address is changed by admin
    event NewAccessControl(address oldAccessControlAddress, address newAccessControlAddress);

    /// @notice The initial Narwhal index for a market
    uint224 public constant narwhalInitialIndex = 1e36;

    // closeFactorMantissa must be strictly greater than this value
    uint internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    constructor() public {
        admin = msg.sender;
    }

    /// @notice Reverts if the protocol is paused
    function checkProtocolPauseState() private view {
        require(!protocolPaused, "protocol is paused");
    }

    /// @notice Reverts if a certain action is paused on a market
    function checkActionPauseState(address market, Action action) private view {
        require(!actionPaused(market, action), "action is paused");
    }

    /// @notice Reverts if the caller is not admin
    function ensureAdmin() private view {
        require(msg.sender == admin, "only admin can");
    }

    /// @notice Checks the passed address is nonzero
    function ensureNonzeroAddress(address someone) private pure {
        require(someone != address(0), "can't be zero address");
    }

    /// @notice Reverts if the market is not listed
    function ensureListed(Market storage market) private view {
        require(market.isListed, "market not listed");
    }

    /// @notice Reverts if the caller is neither admin nor the passed address
    function ensureAdminOr(address privilegedAddress) private view {
        require(
            msg.sender == admin || msg.sender == privilegedAddress,
            "access denied"
        );
    }

    function ensureAllowed(string memory functionSig) private view {  // TODO: need to replace
        require(
            IAccessControlManager(accessControl).isAllowedToCall(msg.sender, functionSig),
            "access denied"
        );
    }

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (NToken[] memory) {
        return accountAssets[account];
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param nToken The nToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, NToken nToken) external view returns (bool) {
        return markets[address(nToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param nTokens The list of addresses of the nToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] calldata nTokens) external returns (uint[] memory) {
        uint len = nTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            results[i] = uint(addToMarketInternal(NToken(nTokens[i]), msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param nToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(NToken nToken, address borrower) internal returns (Error) {
        checkActionPauseState(address(nToken), Action.ENTER_MARKET);

        Market storage marketToJoin = markets[address(nToken)];
        ensureListed(marketToJoin);

        if (marketToJoin.accountMembership[borrower]) {
            // already joined
            return Error.NO_ERROR;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(nToken);

        emit MarketEntered(nToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param nTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address nTokenAddress) external returns (uint) {
        checkActionPauseState(nTokenAddress, Action.EXIT_MARKET);

        NToken nToken = NToken(nTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the nToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = nToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(nTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(nToken)];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set nToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete nToken from the account’s list of assets */
        // In order to delete nToken, copy last item in list to location of item to be removed, reduce length by 1
        NToken[] storage userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint i;
        for (; i < len; i++) {
            if (userAssetList[i] == nToken) {
                userAssetList[i] = userAssetList[len - 1];
                userAssetList.length--;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(i < len);

        emit MarketExited(nToken, msg.sender);

        return uint(Error.NO_ERROR);
    }


    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param nToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address nToken, address minter, uint mintAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        checkProtocolPauseState();
        checkActionPauseState(nToken, Action.MINT);

        // Shh - currently unused
        mintAmount;

        ensureListed(markets[nToken]);

        uint256 supplyCap = supplyCaps[nToken];

        // Supply cap of 0 corresponds to Minting notAllowed
        require(supplyCap != 0, "market supply cap is 0");

        uint256 nTokenSupply = NToken(nToken).totalSupply();
        Exp memory exchangeRate = Exp({ mantissa: NToken(nToken).exchangeRateStored() });
        uint256 nextTotalSupply = mul_ScalarTruncateAddUInt(exchangeRate, nTokenSupply, mintAmount);
        require(nextTotalSupply <= supplyCap, "market supply cap reached");

        // Keep the flywheel moving
        updateNarwhalSupplyIndex(nToken);
        distributeSupplierNarwhal(nToken, minter);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates mint and reverts on rejection. May emit logs.
     * @param nToken Asset being minted
     * @param minter The address minting the tokens
     * @param actualMintAmount The amount of the underlying asset being minted
     * @param mintTokens The number of tokens being minted
     */
    function mintVerify(address nToken, address minter, uint actualMintAmount, uint mintTokens) external {
        // Shh - currently unused
        nToken;
        minter;
        actualMintAmount;
        mintTokens;
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param nToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of nTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address nToken, address redeemer, uint redeemTokens) external returns (uint) {
        checkProtocolPauseState();
        checkActionPauseState(nToken, Action.REDEEM);

        uint allowed = redeemAllowedInternal(nToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateNarwhalSupplyIndex(nToken);
        distributeSupplierNarwhal(nToken, redeemer);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address nToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        ensureListed(markets[nToken]);

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[nToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, NToken(nToken), redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param nToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address nToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        // Shh - currently unused
        nToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        require(redeemTokens != 0 || redeemAmount == 0, "redeemTokens zero");
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param nToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address nToken, address borrower, uint borrowAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        checkProtocolPauseState();
        checkActionPauseState(nToken, Action.BORROW);

        ensureListed(markets[nToken]);

        if (!markets[nToken].accountMembership[borrower]) {
            // only nTokens may call borrowAllowed if borrower not in market
            require(msg.sender == nToken, "sender must be nToken");

            // attempt to add borrower to the market
            Error err = addToMarketInternal(NToken(nToken), borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }
        }

        if (oracle.getUnderlyingPrice(NToken(nToken)) == 0) {
            return uint(Error.PRICE_ERROR);
        }

        uint borrowCap = borrowCaps[nToken];
        // Borrow cap of 0 corresponds to unlimited borrowing
        if (borrowCap != 0) {
            uint totalBorrows = NToken(nToken).totalBorrows();
            uint nextTotalBorrows = add_(totalBorrows, borrowAmount);
            require(nextTotalBorrows < borrowCap, "market borrow cap reached");
        }

        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, NToken(nToken), 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: NToken(nToken).borrowIndex()});
        updateNarwhalBorrowIndex(nToken, borrowIndex);
        distributeBorrowerNarwhal(nToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates borrow and reverts on rejection. May emit logs.
     * @param nToken Asset whose underlying is being borrowed
     * @param borrower The address borrowing the underlying
     * @param borrowAmount The amount of the underlying asset requested to borrow
     */
    function borrowVerify(address nToken, address borrower, uint borrowAmount) external {
        // Shh - currently unused
        nToken;
        borrower;
        borrowAmount;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param nToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which borrowed the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address nToken,
        address payer,
        address borrower,
        uint repayAmount
    )
        external
        returns (uint)
    {
        checkProtocolPauseState();
        checkActionPauseState(nToken, Action.REPAY);
        // Shh - currently unused
        payer;
        borrower;
        repayAmount;

        ensureListed(markets[nToken]);

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: NToken(nToken).borrowIndex()});
        updateNarwhalBorrowIndex(nToken, borrowIndex);
        distributeBorrowerNarwhal(nToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates repayBorrow and reverts on rejection. May emit logs.
     * @param nToken Asset being repaid
     * @param payer The address repaying the borrow
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function repayBorrowVerify(
        address nToken,
        address payer,
        address borrower,
        uint actualRepayAmount,
        uint borrowerIndex
    )
        external
    {
        // Shh - currently unused
        nToken;
        payer;
        borrower;
        actualRepayAmount;
        borrowerIndex;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param nTokenBorrowed Asset which was borrowed by the borrower
     * @param nTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address nTokenBorrowed,
        address nTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount
    )
        external
        returns (uint)
    {
        checkProtocolPauseState();

        // if we want to pause liquidating to nTokenCollateral, we should pause seizing
        checkActionPauseState(nTokenBorrowed, Action.LIQUIDATE);

        if (liquidatorContract != address(0) && liquidator != liquidatorContract) {
            return uint(Error.UNAUTHORIZED);
        }

        ensureListed(markets[nTokenCollateral]);
        if (address(nTokenBorrowed) != address(naiController)) {
            ensureListed(markets[nTokenBorrowed]);
        }

        /* The borrower must have shortfall in order to be liquidatable */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, NToken(0), 0, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall == 0) {
            return uint(Error.INSUFFICIENT_SHORTFALL);
        }

        /* The liquidator may not repay more than what is allowed by the closeFactor */
        uint borrowBalance;
        if (address(nTokenBorrowed) != address(naiController)) {
            borrowBalance = NToken(nTokenBorrowed).borrowBalanceStored(borrower);
        } else {
            borrowBalance = mintedNAIs[borrower];
        }
        uint maxClose = mul_ScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
        if (repayAmount > maxClose) {
            return uint(Error.TOO_MUCH_REPAY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates liquidateBorrow and reverts on rejection. May emit logs.
     * @param nTokenBorrowed Asset which was borrowed by the borrower
     * @param nTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     * @param seizeTokens The amount of collateral token that will be seized
     */
    function liquidateBorrowVerify(
        address nTokenBorrowed,
        address nTokenCollateral,
        address liquidator,
        address borrower,
        uint actualRepayAmount,
        uint seizeTokens
    )
        external
    {
        // Shh - currently unused
        nTokenBorrowed;
        nTokenCollateral;
        liquidator;
        borrower;
        actualRepayAmount;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param nTokenCollateral Asset which was used as collateral and will be seized
     * @param nTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address nTokenCollateral,
        address nTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens
    )
        external
        returns (uint)
    {
        // Pausing is a very serious situation - we revert to sound the alarms
        checkProtocolPauseState();
        checkActionPauseState(nTokenCollateral, Action.SEIZE);

        // Shh - currently unused
        seizeTokens;

        // We've added NAIController as a borrowed token list check for seize
        ensureListed(markets[nTokenCollateral]);
        if (address(nTokenBorrowed) != address(naiController)) {
            ensureListed(markets[nTokenBorrowed]);
        }

        if (NToken(nTokenCollateral).comptroller() != NToken(nTokenBorrowed).comptroller()) {
            return uint(Error.COMPTROLLER_MISMATCH);
        }

        // Keep the flywheel moving
        updateNarwhalSupplyIndex(nTokenCollateral);
        distributeSupplierNarwhal(nTokenCollateral, borrower);
        distributeSupplierNarwhal(nTokenCollateral, liquidator);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates seize and reverts on rejection. May emit logs.
     * @param nTokenCollateral Asset which was used as collateral and will be seized
     * @param nTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeVerify(
        address nTokenCollateral,
        address nTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens
    )
        external
    {
        // Shh - currently unused
        nTokenCollateral;
        nTokenBorrowed;
        liquidator;
        borrower;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param nToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of nTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(address nToken, address src, address dst, uint transferTokens) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        checkProtocolPauseState();
        checkActionPauseState(nToken, Action.TRANSFER);

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(nToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateNarwhalSupplyIndex(nToken);
        distributeSupplierNarwhal(nToken, src);
        distributeSupplierNarwhal(nToken, dst);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates transfer and reverts on rejection. May emit logs.
     * @param nToken Asset being transferred
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of nTokens to transfer
     */
    function transferVerify(address nToken, address src, address dst, uint transferTokens) external {
        // Shh - currently unused
        nToken;
        src;
        dst;
        transferTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, NToken(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param nTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address nTokenModify,
        uint redeemTokens,
        uint borrowAmount
    )
        public
        view
        returns (uint, uint, uint)
    {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(
            account,
            NToken(nTokenModify),
            redeemTokens,
            borrowAmount
        );
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param nTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral nToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        NToken nTokenModify,
        uint redeemTokens,
        uint borrowAmount
    )
        internal
        view
        returns (Error, uint, uint)
    {
        (uint err, uint liquidity, uint shortfall) = comptrollerLens.getHypotheticalAccountLiquidity(
            address(this),
            account,
            nTokenModify,
            redeemTokens,
            borrowAmount
        );
        return (Error(err), liquidity, shortfall);
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in nToken.liquidateBorrowFresh)
     * @param nTokenBorrowed The address of the borrowed nToken
     * @param nTokenCollateral The address of the collateral nToken
     * @param actualRepayAmount The amount of nTokenBorrowed underlying to convert into nTokenCollateral tokens
     * @return (errorCode, number of nTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(
        address nTokenBorrowed,
        address nTokenCollateral,
        uint actualRepayAmount
    )
        external
        view
        returns (uint, uint)
    {
        (uint err, uint seizeTokens) = comptrollerLens.liquidateCalculateSeizeTokens(
            address(this),
            nTokenBorrowed,
            nTokenCollateral,
            actualRepayAmount
        );
        return (err, seizeTokens);
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in nToken.liquidateBorrowFresh)
     * @param nTokenCollateral The address of the collateral nToken
     * @param actualRepayAmount The amount of nTokenBorrowed underlying to convert into nTokenCollateral tokens
     * @return (errorCode, number of nTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateNAICalculateSeizeTokens(
        address nTokenCollateral,
        uint actualRepayAmount
    )
        external
        view
        returns (uint, uint)
    {
        (uint err, uint seizeTokens) = comptrollerLens.liquidateNAICalculateSeizeTokens(
            address(this),
            nTokenCollateral,
            actualRepayAmount
        );
        return (err, seizeTokens);
    }


    /*** Admin Functions ***/

    /**
      * @notice Sets a new price oracle for the comptroller
      * @dev Admin function to set a new price oracle
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setPriceOracle(PriceOracle newOracle) external returns (uint) {
        // Check caller is admin
        ensureAdmin();
        ensureNonzeroAddress(address(newOracle));

        // Track the old oracle for the comptroller
        PriceOracle oldOracle = oracle;

        // Set comptroller's oracle to newOracle
        oracle = newOracle;

        // Emit NewPriceOracle(oldOracle, newOracle)
        emit NewPriceOracle(oldOracle, newOracle);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise will revert
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
        ensureAdmin();

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, newCloseFactorMantissa);

        return uint(Error.NO_ERROR);
    }

     /**
      * @notice Sets the address of the access control of this contract
      * @dev Admin function to set the access control address
      * @param newAccessControlAddress New address for the access control
      * @return uint 0=success, otherwise will revert
      */
    function _setAccessControl(address newAccessControlAddress) external returns (uint) {
        // Check caller is admin
        ensureAdmin();
        ensureNonzeroAddress(newAccessControlAddress);

        address oldAccessControlAddress = accessControl;
        accessControl = newAccessControlAddress;
        emit NewAccessControl(oldAccessControlAddress, accessControl);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Restricted function to set per-market collateralFactor
      * @param nToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(NToken nToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is allowed by access control manager
        ensureAllowed("_setCollateralFactor(address,uint256)");
        ensureNonzeroAddress(address(nToken));

        // Verify market is listed
        Market storage market = markets[address(nToken)];
        ensureListed(market);

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && oracle.getUnderlyingPrice(nToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(nToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        ensureAllowed("_setLiquidationIncentive(uint256)");

        require(newLiquidationIncentiveMantissa >= 1e18, "incentive must be over 1e18");

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    function _setLiquidatorContract(address newLiquidatorContract_) external {
        // Check caller is admin
        ensureAdmin();
        address oldLiquidatorContract = liquidatorContract;
        liquidatorContract = newLiquidatorContract_;
        emit NewLiquidatorContract(oldLiquidatorContract, newLiquidatorContract_);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param nToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(NToken nToken) external returns (uint) {
        ensureAllowed("_supportMarket(address)");

        if (markets[address(nToken)].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        nToken.isNToken(); // Sanity check to make sure its really a NToken

        // Note that isNarwhal is not in active use anymore
        markets[address(nToken)] = Market({isListed: true, isNarwhal: false, collateralFactorMantissa: 0});

        _addMarketInternal(nToken);

        emit MarketListed(nToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(NToken nToken) internal {
        for (uint i = 0; i < allMarkets.length; i++) {
            require(allMarkets[i] != nToken, "market already added");
        }
        allMarkets.push(nToken);
    }

    /**
     * @notice Admin function to change the Pause Guardian
     * @param newPauseGuardian The address of the new Pause Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setPauseGuardian(address newPauseGuardian) external returns (uint) {
        ensureAdmin();
        ensureNonzeroAddress(newPauseGuardian);

        // Save current value for inclusion in log
        address oldPauseGuardian = pauseGuardian;

        // Store pauseGuardian with value newPauseGuardian
        pauseGuardian = newPauseGuardian;

        // Emit NewPauseGuardian(OldPauseGuardian, NewPauseGuardian)
        emit NewPauseGuardian(oldPauseGuardian, newPauseGuardian);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Set the given borrow caps for the given nToken markets. Borrowing that brings total borrows to or above borrow cap will revert.
      * @dev Access is controled by ACM. A borrow cap of 0 corresponds to unlimited borrowing.
      * @param nTokens The addresses of the markets (tokens) to change the borrow caps for
      * @param newBorrowCaps The new borrow cap values in underlying to be set. A value of 0 corresponds to unlimited borrowing.
      */
    function _setMarketBorrowCaps(NToken[] calldata nTokens, uint[] calldata newBorrowCaps) external {
        ensureAllowed("_setMarketBorrowCaps(address[],uint256[])");

        uint numMarkets = nTokens.length;
        uint numBorrowCaps = newBorrowCaps.length;

        require(numMarkets != 0 && numMarkets == numBorrowCaps, "invalid input");

        for(uint i = 0; i < numMarkets; i++) {
            borrowCaps[address(nTokens[i])] = newBorrowCaps[i];
            emit NewBorrowCap(nTokens[i], newBorrowCaps[i]);
        }
    }

    /**
      * @notice Set the given supply caps for the given nToken markets. Supply that brings total Supply to or above supply cap will revert.
      * @dev Admin function to set the supply caps. A supply cap of 0 corresponds to Minting NotAllowed.
      * @param nTokens The addresses of the markets (tokens) to change the supply caps for
      * @param newSupplyCaps The new supply cap values in underlying to be set. A value of 0 corresponds to Minting NotAllowed.
      */
    function _setMarketSupplyCaps(NToken[] calldata nTokens, uint256[] calldata newSupplyCaps) external {
        ensureAllowed("_setMarketSupplyCaps(address[],uint256[])");

        uint numMarkets = nTokens.length;
        uint numSupplyCaps = newSupplyCaps.length;

        require(numMarkets != 0 && numMarkets == numSupplyCaps, "invalid input");

        for(uint i; i < numMarkets; ++i) {
            supplyCaps[address(nTokens[i])] = newSupplyCaps[i];
            emit NewSupplyCap(nTokens[i], newSupplyCaps[i]);
        }
    }

    /**
     * @notice Set whole protocol pause/unpause state
     */
    function _setProtocolPaused(bool state) external returns(bool) {
        ensureAllowed("_setProtocolPaused(bool)");

        protocolPaused = state;
        emit ActionProtocolPaused(state);
        return state;
    }

    /**
     * @notice Pause/unpause certain actions
     * @param markets Markets to pause/unpause the actions on
     * @param actions List of action ids to pause/unpause
     * @param paused The new paused state (true=paused, false=unpaused)
     */
    function _setActionsPaused(
        address[] calldata markets,
        Action[] calldata actions,
        bool paused
    )
        external
    {
        ensureAllowed("_setActionsPaused(address[],uint256[],bool)");

        uint256 numMarkets = markets.length;
        uint256 numActions = actions.length;
        for (uint marketIdx; marketIdx < numMarkets; ++marketIdx) {
            for (uint actionIdx; actionIdx < numActions; ++actionIdx) {
                setActionPausedInternal(markets[marketIdx], actions[actionIdx], paused);
            }
        }
    }

    /**
     * @dev Pause/unpause an action on a market
     * @param market Market to pause/unpause the action on
     * @param action Action id to pause/unpause
     * @param paused The new paused state (true=paused, false=unpaused)
     */
    function setActionPausedInternal(address market, Action action, bool paused) internal {
        ensureListed(markets[market]);
        _actionPaused[market][uint(action)] = paused;
        emit ActionPausedMarket(NToken(market), action, paused);
    }

    /**
      * @notice Sets a new NAI controller
      * @dev Admin function to set a new NAI controller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setNAIController(NAIControllerInterface naiController_) external returns (uint) {
        // Check caller is admin
        ensureAdmin();
        ensureNonzeroAddress(address(naiController_));

        NAIControllerInterface oldNaiController = naiController;
        naiController = naiController_;
        emit NewNAIController(oldNaiController, naiController_);

        return uint(Error.NO_ERROR);
    }

    function _setNAIMintRate(uint newNAIMintRate) external returns (uint) {
        // Check caller is admin
        ensureAdmin();
        uint oldNAIMintRate = naiMintRate;
        naiMintRate = newNAIMintRate;
        emit NewNAIMintRate(oldNAIMintRate, newNAIMintRate);

        return uint(Error.NO_ERROR);
    }

    function _setTreasuryData(address newTreasuryGuardian, address newTreasuryAddress, uint newTreasuryPercent) external returns (uint) {
        // Check caller is admin
        ensureAdminOr(treasuryGuardian);

        require(newTreasuryPercent < 1e18, "treasury percent cap overflow");
        ensureNonzeroAddress(newTreasuryGuardian);
        ensureNonzeroAddress(newTreasuryAddress);

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

    function _become(Unitroller unitroller) external {
        require(msg.sender == unitroller.admin(), "only unitroller admin can");
        require(unitroller._acceptImplementation() == 0, "not authorized");
    }

    /*** Narwhal Distribution ***/

    function setNarwhalSpeedInternal(NToken nToken, uint narwhalSpeed) internal {
        uint currentNarwhalSpeed = narwhalSpeeds[address(nToken)];
        if (currentNarwhalSpeed != 0) {
            // note that NWL speed could be set to 0 to halt liquidity rewards for a market
            Exp memory borrowIndex = Exp({mantissa: nToken.borrowIndex()});
            updateNarwhalSupplyIndex(address(nToken));
            updateNarwhalBorrowIndex(address(nToken), borrowIndex);
        } else if (narwhalSpeed != 0) {
            // Add the NWL market
            ensureListed(markets[address(nToken)]);

            if (narwhalSupplyState[address(nToken)].index == 0 && narwhalSupplyState[address(nToken)].block == 0) {
                narwhalSupplyState[address(nToken)] = NarwhalMarketState({
                    index: narwhalInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            }


            if (narwhalBorrowState[address(nToken)].index == 0 && narwhalBorrowState[address(nToken)].block == 0) {
                narwhalBorrowState[address(nToken)] = NarwhalMarketState({
                    index: narwhalInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            }
        }

        if (currentNarwhalSpeed != narwhalSpeed) {
            narwhalSpeeds[address(nToken)] = narwhalSpeed;
            emit NarwhalSpeedUpdated(nToken, narwhalSpeed);
        }
    }

    /**
     * @dev Set ComptrollerLens contract address
     */
    function _setComptrollerLens(ComptrollerLensInterface comptrollerLens_) external returns (uint) {
        ensureAdmin();
        ensureNonzeroAddress(address(comptrollerLens_));
        address oldComptrollerLens = address(comptrollerLens);
        comptrollerLens = comptrollerLens_;
        emit NewComptrollerLens(oldComptrollerLens, address(comptrollerLens));

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Accrue NWL to the market by updating the supply index
     * @param nToken The market whose supply index to update
     */
    function updateNarwhalSupplyIndex(address nToken) internal {
        NarwhalMarketState storage supplyState = narwhalSupplyState[nToken];
        uint supplySpeed = narwhalSpeeds[nToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = NToken(nToken).totalSupply();
            uint narwhalAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(narwhalAccrued, supplyTokens) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: supplyState.index}), ratio);
            narwhalSupplyState[nToken] = NarwhalMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            supplyState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Accrue NWL to the market by updating the borrow index
     * @param nToken The market whose borrow index to update
     */
    function updateNarwhalBorrowIndex(address nToken, Exp memory marketBorrowIndex) internal {
        NarwhalMarketState storage borrowState = narwhalBorrowState[nToken];
        uint borrowSpeed = narwhalSpeeds[nToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(NToken(nToken).totalBorrows(), marketBorrowIndex);
            uint narwhalAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(narwhalAccrued, borrowAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: borrowState.index}), ratio);
            narwhalBorrowState[nToken] = NarwhalMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            borrowState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Calculate NWL accrued by a supplier and possibly transfer it to them
     * @param nToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute NWL to
     */
    function distributeSupplierNarwhal(address nToken, address supplier) internal {
        if (address(naiVaultAddress) != address(0)) {
            releaseToVault();
        }

        NarwhalMarketState memory supplyState = narwhalSupplyState[nToken];
        Double memory supplyIndex = Double({mantissa: supplyState.index});
        Double memory supplierIndex = Double({mantissa: narwhalSupplierIndex[nToken][supplier]});
        narwhalSupplierIndex[nToken][supplier] = supplyIndex.mantissa;

        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = narwhalInitialIndex;
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = NToken(nToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        uint supplierAccrued = add_(narwhalAccrued[supplier], supplierDelta);
        narwhalAccrued[supplier] = supplierAccrued;
        emit DistributedSupplierNarwhal(NToken(nToken), supplier, supplierDelta, supplyIndex.mantissa);
    }

    /**
     * @notice Calculate NWL accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param nToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute NWL to
     */
    function distributeBorrowerNarwhal(address nToken, address borrower, Exp memory marketBorrowIndex) internal {
        if (address(naiVaultAddress) != address(0)) {
            releaseToVault();
        }

        NarwhalMarketState memory borrowState = narwhalBorrowState[nToken];
        Double memory borrowIndex = Double({mantissa: borrowState.index});
        Double memory borrowerIndex = Double({mantissa: narwhalBorrowerIndex[nToken][borrower]});
        narwhalBorrowerIndex[nToken][borrower] = borrowIndex.mantissa;

        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(NToken(nToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            uint borrowerAccrued = add_(narwhalAccrued[borrower], borrowerDelta);
            narwhalAccrued[borrower] = borrowerAccrued;
            emit DistributedBorrowerNarwhal(NToken(nToken), borrower, borrowerDelta, borrowIndex.mantissa);
        }
    }

    /**
     * @notice Claim all the nwl accrued by holder in all markets and NAI
     * @param holder The address to claim NWL for
     */
    function claimNarwhal(address holder) public {
        return claimNarwhal(holder, allMarkets);
    }

    /**
     * @notice Claim all the nwl accrued by holder in the specified markets
     * @param holder The address to claim NWL for
     * @param nTokens The list of markets to claim NWL in
     */
    function claimNarwhal(address holder, NToken[] memory nTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimNarwhal(holders, nTokens, true, true);
    }

    /**
     * @notice Claim all nwl accrued by the holders
     * @param holders The addresses to claim NWL for
     * @param nTokens The list of markets to claim NWL in
     * @param borrowers Whether or not to claim NWL earned by borrowing
     * @param suppliers Whether or not to claim NWL earned by supplying
     */
     function claimNarwhal(address[] memory holders, NToken[] memory nTokens, bool borrowers, bool suppliers) public {
        claimNarwhal(holders, nTokens, borrowers, suppliers, false);
    }


    /**
     * @notice Claim all nwl accrued by the holders
     * @param holders The addresses to claim NWL for
     * @param nTokens The list of markets to claim NWL in
     * @param borrowers Whether or not to claim NWL earned by borrowing
     * @param suppliers Whether or not to claim NWL earned by supplying
     * @param collateral Whether or not to use NWL earned as collateral, only takes effect when the holder has a shortfall
     */
    function claimNarwhal(address[] memory holders, NToken[] memory nTokens, bool borrowers, bool suppliers, bool collateral) public {
        uint j;
        for (uint i = 0; i < nTokens.length; i++) {
            NToken nToken = nTokens[i];
            ensureListed(markets[address(nToken)]);
            if (borrowers) {
                Exp memory borrowIndex = Exp({mantissa: nToken.borrowIndex()});
                updateNarwhalBorrowIndex(address(nToken), borrowIndex);
                for (j = 0; j < holders.length; j++) {
                    distributeBorrowerNarwhal(address(nToken), holders[j], borrowIndex);
                }
            }
            if (suppliers) {
                updateNarwhalSupplyIndex(address(nToken));
                for (j = 0; j < holders.length; j++) {
                    distributeSupplierNarwhal(address(nToken), holders[j]);
                }
            }
        }

        for (j = 0; j < holders.length; j++) {
            address holder = holders[j];
            // If there is a positive shortfall, the NWL reward is accrued,
            // but won't be granted to this holder
            (, , uint shortfall) = getHypotheticalAccountLiquidityInternal(holder, NToken(0), 0, 0);
            narwhalAccrued[holder] = grantNWLInternal(holder, narwhalAccrued[holder], shortfall, collateral);
        }
    }

    /**
     * @notice Claim all the nwl accrued by holder in all markets, a shorthand for `claimNarwhal` with collateral set to `true`
     * @param holder The address to claim NWL for
     */
    function claimNarwhalAsCollateral(address holder) external {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimNarwhal(holders, allMarkets, true, true, true);
    }

    /**
     * @notice Transfer NWL to the user with user's shortfall considered
     * @dev Note: If there is not enough NWL, we do not perform the transfer all.
     * @param user The address of the user to transfer NWL to
     * @param amount The amount of NWL to (possibly) transfer
     * @param shortfall The shortfall of the user
     * @param collateral Whether or not we will use user's narwhal reward as collateral to pay off the debt
     * @return The amount of NWL which was NOT transferred to the user
     */
    function grantNWLInternal(address user, uint amount, uint shortfall, bool collateral) internal returns (uint) {

        NWL nwl = NWL(getNWLAddress());
        uint narwhalRemaining = nwl.balanceOf(address(this));
        //bool bankrupt = shortfall > 0;

        if (amount == 0 || amount > narwhalRemaining) {
            return amount;
        }

        // If user's not bankrupt, user can get the reward,
        // so the liquidators will have chances to liquidate bankrupt accounts
        nwl.transfer(user, amount);
        return 0;
//        if (!bankrupt) {
//            nwl.transfer(user, amount);
//            return 0;
//        }
        // If user's bankrupt and doesn't use pending nwl as collateral, don't grant
        // anything, otherwise, we will transfer the pending nwl as collateral to
        // vNWL token and mint vNWL for the user.
        //
        // If mintBehalf failed, don't grant any nwl

        // TODO: change by parker
//        require(collateral, "bankrupt accounts can only collateralize their pending nwl rewards");
//
//        nwl.approve(getNWLNTokenAddress(), amount);
//        require(
//            NBep20Interface(getNWLNTokenAddress()).mintBehalf(user, amount) == uint(Error.NO_ERROR),
//            "mint behalf error during collateralize nwl"
//        );
//
//        // set narwhalAccrue[user] to 0
//        return 0;
    }

    /*** Narwhal Distribution Admin ***/

    /**
     * @notice Transfer NWL to the recipient
     * @dev Note: If there is not enough NWL, we do not perform the transfer all.
     * @param recipient The address of the recipient to transfer NWL to
     * @param amount The amount of NWL to (possibly) transfer
     */
    function _grantNWL(address recipient, uint amount) external {
        ensureAdminOr(comptrollerImplementation);
        uint amountLeft = grantNWLInternal(recipient, amount, 0, false);
        require(amountLeft == 0, "insufficient nwl for grant");
        emit NarwhalGranted(recipient, amount);
    }

    /**
     * @notice Set the amount of NWL distributed per block to NAI Vault
     * @param narwhalNAIVaultRate_ The amount of NWL wei per block to distribute to NAI Vault
     */
    function _setNarwhalNAIVaultRate(uint narwhalNAIVaultRate_) external {
        ensureAdmin();

        uint oldNarwhalNAIVaultRate = narwhalNAIVaultRate;
        narwhalNAIVaultRate = narwhalNAIVaultRate_;
        emit NewNarwhalNAIVaultRate(oldNarwhalNAIVaultRate, narwhalNAIVaultRate_);
    }

    /**
     * @notice Set the NAI Vault infos
     * @param vault_ The address of the NAI Vault
     * @param releaseStartBlock_ The start block of release to NAI Vault
     * @param minReleaseAmount_ The minimum release amount to NAI Vault
     */
    function _setNAIVaultInfo(address vault_, uint256 releaseStartBlock_, uint256 minReleaseAmount_) external {
        ensureAdmin();
        ensureNonzeroAddress(vault_);

        naiVaultAddress = vault_;
        releaseStartBlock = releaseStartBlock_;
        minReleaseAmount = minReleaseAmount_;
        emit NewNAIVaultInfo(vault_, releaseStartBlock_, minReleaseAmount_);
    }

    /**
     * @notice Set NWL speed for a single market
     * @param nToken The market whose NWL speed to update
     * @param narwhalSpeed New NWL speed for market
     */
    function _setNarwhalSpeed(NToken nToken, uint narwhalSpeed) external {
        ensureAdminOr(comptrollerImplementation);
        ensureNonzeroAddress(address(nToken));
        setNarwhalSpeedInternal(nToken, narwhalSpeed);
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (NToken[] memory) {
        return allMarkets;
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the NWL token
     * @return The address of NWL
     */
    function getNWLAddress() public view returns (address) {
        return 0xEe49d7C3Bb1c7C73B1Dd6dbfCe684944aEBd9487;   // TODO: need to replace
    }

    /**
     * @notice Return the address of the NWL nToken
     * @return The address of NWL nToken
     */
//    function getNWLNTokenAddress() public view returns (address) {
//        return 0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D;  // TODO: need to replace
//    }

    /**
     * @notice Checks if a certain action is paused on a market
     * @param action Action id
     * @param market nToken address
     */
    function actionPaused(address market, Action action) public view returns (bool) {
        return _actionPaused[market][uint(action)];
    }


    /*** NAI functions ***/

    /**
     * @notice Set the minted NAI amount of the `owner`
     * @param owner The address of the account to set
     * @param amount The amount of NAI to set to the account
     * @return The number of minted NAI by `owner`
     */
    function setMintedNAIOf(address owner, uint amount) external returns (uint) {
        checkProtocolPauseState();

        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintNAIGuardianPaused && !repayNAIGuardianPaused, "NAI is paused");
        // Check caller is naiController
        if (msg.sender != address(naiController)) {
            return fail(Error.REJECTION, FailureInfo.SET_MINTED_NAI_REJECTION);
        }
        mintedNAIs[owner] = amount;

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Transfer NWL to NAI Vault
     */
    function releaseToVault() public {
        if(releaseStartBlock == 0 || getBlockNumber() < releaseStartBlock) {
            return;
        }

        NWL nwl = NWL(getNWLAddress());

        uint256 nwlBalance = nwl.balanceOf(address(this));
        if(nwlBalance == 0) {
            return;
        }

        uint256 actualAmount;
        uint256 deltaBlocks = sub_(getBlockNumber(), releaseStartBlock);
        // releaseAmount = narwhalNAIVaultRate * deltaBlocks
        uint256 _releaseAmount = mul_(narwhalNAIVaultRate, deltaBlocks);

        if (nwlBalance >= _releaseAmount) {
            actualAmount = _releaseAmount;
        } else {
            actualAmount = nwlBalance;
        }

        if (actualAmount < minReleaseAmount) {
            return;
        }

        releaseStartBlock = getBlockNumber();

        nwl.transfer(naiVaultAddress, actualAmount);
        emit DistributedNAIVaultNarwhal(actualAmount);

        INAIVault(naiVaultAddress).updatePendingRewards();
    }
}
