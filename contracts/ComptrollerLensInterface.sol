pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./NToken.sol";

interface ComptrollerLensInterface {
    function liquidateCalculateSeizeTokens(
        address comptroller, 
        address nTokenBorrowed,
        address nTokenCollateral,
        uint actualRepayAmount
    ) external view returns (uint, uint);
    function liquidateNAICalculateSeizeTokens(
        address comptroller,
        address nTokenCollateral,
        uint actualRepayAmount
    ) external view returns (uint, uint);
    function getHypotheticalAccountLiquidity(
        address comptroller,
        address account,
        NToken nTokenModify,
        uint redeemTokens,
        uint borrowAmount) external view returns (uint, uint, uint);
}
