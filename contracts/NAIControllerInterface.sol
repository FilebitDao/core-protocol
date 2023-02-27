pragma solidity ^0.5.16;

import "./NToken.sol";

contract NAIControllerInterface {
    function getNAIAddress() public view returns (address);
    function getMintableNAI(address minter) public view returns (uint, uint);
    function mintNAI(address minter, uint mintNAIAmount) external returns (uint);
    function repayNAI(address repayer, uint repayNAIAmount) external returns (uint);
    function liquidateNAI(address borrower, uint repayAmount, NTokenInterface nTokenCollateral) external returns (uint, uint);

    function _initializeNarwhalNAIState(uint blockNumber) external returns (uint);
    function updateNarwhalNAIMintIndex() external returns (uint);
    function calcDistributeNAIMinterNarwhal(address naiMinter) external returns(uint, uint, uint, uint);
}
