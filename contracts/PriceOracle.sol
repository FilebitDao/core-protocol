pragma solidity ^0.5.16;

import "./NToken.sol";

contract PriceOracle {
    /// @notice Indicator that this is a PriceOracle contract (for inspection)
    bool public constant isPriceOracle = true;

    /**
      * @notice Get the underlying price of a nToken asset
      * @param nToken The nToken to get the underlying price of
      * @return The underlying asset price mantissa (scaled by 1e18).
      *  Zero means the price is unanailable.
      */
    function getUnderlyingPrice(NToken nToken) external view returns (uint);
}
