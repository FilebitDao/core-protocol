pragma solidity ^0.5.16;

import "./NBep20Delegate.sol";

interface NwlLike {
  function delegate(address delegatee) external;
}

/**
 * @title Narwhal's VNwlLikeDelegate Contract
 * @notice NTokens which can 'delegate votes' of their underlying BEP-20
 * @author Narwhal
 */
contract NNwlLikeDelegate is NBep20Delegate {
  /**
   * @notice Construct an empty delegate
   */
  constructor() public NBep20Delegate() {}

  /**
   * @notice Admin call to delegate the votes of the NWL-like underlying
   * @param nwlLikeDelegatee The address to delegate votes to
   */
  function _delegateNwlLikeTo(address nwlLikeDelegatee) external {
    require(msg.sender == admin, "only the admin may set the nwl-like delegate");
    NwlLike(underlying).delegate(nwlLikeDelegatee);
  }
}