pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../NToken.sol";
import "../SafeMath.sol";
import "../Comptroller.sol";
import "../EIP20Interface.sol";
import "../NBep20.sol";

contract SnapshotLens is ExponentialNoError {
    using SafeMath for uint256;

    struct AccountSnapshot {
        address account;
        string assetName;
        address nTokenAddress;
        address underlyingAssetAddress;
        uint256 supply;
        uint256 supplyInUsd;
        uint256 collateral;
        uint256 borrows;
        uint256 borrowsInUsd;
        uint256 assetPrice;
        uint256 accruedInterest;
        uint nTokenDecimals;
        uint underlyingDecimals;
        uint exchangeRate;
        bool isACollateral;
    }

    /** Snapshot calculation **/
    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account snapshot.
     *  Note that `nTokenBalance` is the number of nTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountSnapshotLocalVars {
        uint collateral;
        uint nTokenBalance;
        uint borrowBalance;
        uint borrowsInUsd;
        uint balanceOfUnderlying;
        uint supplyInUsd;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
        bool isACollateral;
    }

    function getAccountSnapshot(
        address payable account,
        address comptrollerAddress
    )  public returns (AccountSnapshot[] memory) {

        // For each asset the account is in
        NToken[] memory assets = Comptroller(comptrollerAddress).getAllMarkets();
        AccountSnapshot[] memory accountSnapshots = new AccountSnapshot[](assets.length);
        for (uint256 i = 0; i < assets.length; ++i){
            accountSnapshots[i] = getAccountSnapshot(account, comptrollerAddress, assets[i]);
        }
        return accountSnapshots;
    }

    function isACollateral(address account, address asset, address comptrollerAddress) public view returns (bool){
        NToken[] memory assetsAsCollateral = Comptroller(comptrollerAddress).getAssetsIn(account);
        for(uint256 j = 0; j < assetsAsCollateral.length ; ++j){
            if(address(assetsAsCollateral[j]) == asset){
                return true;
            }
        }

        return false;
    }

    function getAccountSnapshot(
        address payable account,
        address comptrollerAddress,
        NToken nToken
    ) public returns (AccountSnapshot memory) {

        AccountSnapshotLocalVars memory vars; // Holds all our calculation results
        uint oErr;

        // Read the balances and exchange rate from the nToken
        (oErr, vars.nTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = nToken.getAccountSnapshot(account);
        require(oErr == 0, "Snapshot Error");
        vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

        Comptroller comptrollerInstance = Comptroller(comptrollerAddress);

        (, uint collateralFactorMantissa,) = comptrollerInstance.markets(address(nToken));
        vars.collateralFactor = Exp({mantissa: collateralFactorMantissa});

        // Get the normalized price of the asset
        vars.oraclePriceMantissa = comptrollerInstance.oracle().getUnderlyingPrice(nToken);
        vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

        // Pre-compute a conversion factor from tokens -> bnb (normalized price value)
        vars.tokensToDenom = mul_(mul_(vars.collateralFactor, vars.exchangeRate), vars.oraclePrice);

        //Collateral = tokensToDenom * nTokenBalance
        vars.collateral = mul_ScalarTruncate(vars.tokensToDenom, vars.nTokenBalance);

        vars.balanceOfUnderlying = nToken.balanceOfUnderlying(account);
        vars.supplyInUsd = mul_ScalarTruncate(vars.oraclePrice, vars.balanceOfUnderlying);

        vars.borrowsInUsd = mul_ScalarTruncate(vars.oraclePrice, vars.borrowBalance);

        address underlyingAssetAddress;
        uint underlyingDecimals;

        if (compareStrings(nToken.symbol(), "nFIL")) {
            underlyingAssetAddress = address(0);
            underlyingDecimals = 18;
        } else {
            NBep20 vBep20 = NBep20(address(nToken));
            underlyingAssetAddress = vBep20.underlying();
            underlyingDecimals = EIP20Interface(vBep20.underlying()).decimals();
        }

        vars.isACollateral = isACollateral(account, address(nToken), comptrollerAddress);

        return AccountSnapshot({
            account: account,
            assetName: nToken.name(),
            nTokenAddress: address(nToken),
            underlyingAssetAddress: underlyingAssetAddress,
            supply: vars.balanceOfUnderlying,
            supplyInUsd: vars.supplyInUsd,
            collateral: vars.collateral,
            borrows: vars.borrowBalance,
            borrowsInUsd: vars.borrowsInUsd,
            assetPrice: vars.oraclePriceMantissa,
            accruedInterest: nToken.borrowIndex(),
            nTokenDecimals: nToken.decimals(),
            underlyingDecimals: underlyingDecimals,
            exchangeRate: nToken.exchangeRateCurrent(),
            isACollateral: vars.isACollateral
        });
    }

    // utilities
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
