pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../Utils/SafeMath.sol";
import "../Utils/Owned.sol";
import "../Utils/IBEP20.sol";

contract Faucet is Owned {
    using SafeMath for uint256;

    struct ClaimAssetsInfo {
        string asset;
        address addr;
        uint256 frozenDuration;
        uint256 maxToClaimed;
    }

    mapping(string => ClaimAssetsInfo) public assets;
    mapping(address=> mapping(string => uint256)) public lastClaimedStamp;

    function addAssets(ClaimAssetsInfo[] memory _assets) public onlyOwner {
        for(uint256 i = 0; i < _assets.length; i++){
            require(address(0) != _assets[i].addr, "INVALID_ADDRESS");
            assets[_assets[i].asset] = _assets[i];
        }
    }

    function claim(string memory _asset) public {
        ClaimAssetsInfo storage info = assets[_asset];
        require(address(0) != info.addr, "INVALID_ASSET");
        require(block.timestamp > info.frozenDuration.add(lastClaimedStamp[msg.sender][_asset]), "UNABLE_TO_CLAIM");
        IBEP20 asset = IBEP20(assets[_asset].addr);
        asset.transfer(msg.sender, info.maxToClaimed);
        lastClaimedStamp[msg.sender][_asset] = block.timestamp;
    }
}
