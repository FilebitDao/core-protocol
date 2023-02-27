pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../NBep20.sol";
import "../NToken.sol";
import "../EIP20Interface.sol";
import "../PriceOracle.sol";
import "../ErrorReporter.sol";
import "../Comptroller.sol";

contract ComptrollerLens is ComptrollerLensInterface, ComptrollerErrorReporter, ExponentialNoError {
    /** liquidate seize calculation **/
    function liquidateCalculateSeizeTokens(
        address comptroller, 
        address nTokenBorrowed,
        address nTokenCollateral,
        uint actualRepayAmount
    ) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = Comptroller(comptroller).oracle().getUnderlyingPrice(NToken(nTokenBorrowed));
        uint priceCollateralMantissa = Comptroller(comptroller).oracle().getUnderlyingPrice(NToken(nTokenCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = NToken(nTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;

        numerator = mul_(Exp({mantissa: Comptroller(comptroller).liquidationIncentiveMantissa()}), Exp({mantissa: priceBorrowedMantissa}));
        denominator = mul_(Exp({mantissa: priceCollateralMantissa}), Exp({mantissa: exchangeRateMantissa}));
        ratio = div_(numerator, denominator);

        seizeTokens = mul_ScalarTruncate(ratio, actualRepayAmount);

        return (uint(Error.NO_ERROR), seizeTokens);
    }


    function liquidateNAICalculateSeizeTokens(
        address comptroller,
        address nTokenCollateral,
        uint actualRepayAmount
    ) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = 1e18;  // Note: this is NAI
        uint priceCollateralMantissa = Comptroller(comptroller).oracle().getUnderlyingPrice(NToken(nTokenCollateral));
        if (priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = NToken(nTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;

        numerator = mul_(Exp({mantissa: Comptroller(comptroller).liquidationIncentiveMantissa()}), Exp({mantissa: priceBorrowedMantissa}));
        denominator = mul_(Exp({mantissa: priceCollateralMantissa}), Exp({mantissa: exchangeRateMantissa}));
        ratio = div_(numerator, denominator);

        seizeTokens = mul_ScalarTruncate(ratio, actualRepayAmount);

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /** liquidity calculation **/
    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `nTokenBalance` is the number of nTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
        uint sumBorrowPlusEffects;
        uint nTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    function getHypotheticalAccountLiquidity(
        address comptroller,
        address account,
        NToken nTokenModify,
        uint redeemTokens,
        uint borrowAmount) external view returns (uint, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;

        // For each asset the account is in
        NToken[] memory assets = Comptroller(comptroller).getAssetsIn(account);
        uint assetsCount = assets.length;
        for (uint i = 0; i < assetsCount; ++i) {
            NToken asset = assets[i];

            // Read the balances and exchange rate from the nToken
            (oErr, vars.nTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset.getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (uint(Error.SNAPSHOT_ERROR), 0, 0);
            }
            (, uint collateralFactorMantissa,) = Comptroller(comptroller).markets(address(asset));
            vars.collateralFactor = Exp({mantissa: collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = Comptroller(comptroller).oracle().getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (uint(Error.PRICE_ERROR), 0, 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> bnb (normalized price value)
            vars.tokensToDenom = mul_(mul_(vars.collateralFactor, vars.exchangeRate), vars.oraclePrice);

            // sumCollateral += tokensToDenom * nTokenBalance
            vars.sumCollateral = mul_ScalarTruncateAddUInt(vars.tokensToDenom, vars.nTokenBalance, vars.sumCollateral);

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);

            // Calculate effects of interacting with nTokenModify
            if (asset == nTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
            }
        }

        vars.sumBorrowPlusEffects = add_(vars.sumBorrowPlusEffects, Comptroller(comptroller).mintedNAIs(account));

        // These are safe, as the underflow condition is checked first
        if (vars.sumCollateral > vars.sumBorrowPlusEffects) {
            return (uint(Error.NO_ERROR), vars.sumCollateral - vars.sumBorrowPlusEffects, 0);
        } else {
            return (uint(Error.NO_ERROR), 0, vars.sumBorrowPlusEffects - vars.sumCollateral);
        }
    }

}

