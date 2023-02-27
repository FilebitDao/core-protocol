pragma solidity ^0.5.16;

import "./PriceOracle.sol";
import "./NBep20.sol";
import "./BEP20Interface.sol";
import "./SafeMath.sol";
import "./AggregatorV2V3Interface.sol";

contract NarwhalChainlinkOracleV2 is PriceOracle {
    using SafeMath for uint;
    uint public constant NAI_VALUE = 1e18;
    address public admin;

    uint public maxStalePeriod;

    mapping(address => uint) internal prices;
    mapping(bytes32 => AggregatorV2V3Interface) internal feeds;
    mapping(address => bool) public updater;

    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    event NewAdmin(address oldAdmin, address newAdmin);
    event FeedSet(address feed, string symbol);
    event MaxStalePeriodUpdated(uint oldMaxStalePeriod, uint newMaxStalePeriod);

    constructor(uint maxStalePeriod_) public {
        admin = msg.sender;
        maxStalePeriod = maxStalePeriod_;
    }

    function setMaxStalePeriod(uint newMaxStalePeriod) external onlyAdmin() {
        require(newMaxStalePeriod > 0, "stale period can't be zero");
        uint oldMaxStalePeriod = maxStalePeriod;
        maxStalePeriod = newMaxStalePeriod;
        emit MaxStalePeriodUpdated(oldMaxStalePeriod, newMaxStalePeriod);
    }

    function getUnderlyingPrice(NToken nToken) public view returns (uint) {
        string memory symbol = nToken.symbol();
        if (compareStrings(symbol, "NAI") || compareStrings(symbol, "nNAI")) {
            return NAI_VALUE;
        } else if (compareStrings(symbol, "NWL")) {
            return prices[address(nToken)];
        } else {
            return getPrice(nToken);
        }
    }

    function getPrice(NToken nToken) internal view returns (uint price) {
        string memory symbol = nToken.symbol();
        address asset;
        uint decimals;
        if (!compareStrings(symbol, "nFIL")) {
            BEP20Interface token = BEP20Interface(NBep20(address(nToken)).underlying());
            symbol = token.symbol();
            asset = address(token);
            decimals = token.decimals();
        } else {
            asset = address(nToken);
            decimals = 18;
        }

        AggregatorV2V3Interface feed = getFeed(symbol);
        if (address(feed) != address(0)) {
            price = getChainlinkPrice(feed);
        } else {
            price = prices[asset];
        }


        uint decimalDelta = uint(18).sub(uint(decimals));
        // Ensure that we don't multiply the result by 0
        if (decimalDelta > 0) {
            return price.mul(10**decimalDelta);
        } else {
            return price;
        }
    }

    function getChainlinkPrice(AggregatorV2V3Interface feed) internal view returns (uint) {
        // Chainlink USD-denominated feeds store answers at 8 decimals
        uint decimalDelta = uint(18).sub(feed.decimals());

        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        // Ensure that we don't multiply the result by 0
        if (block.timestamp.sub(updatedAt) > maxStalePeriod) {
            return 0;
        }

        if (decimalDelta > 0) {
            return uint(answer).mul(10**decimalDelta);
        } else {
            return uint(answer);
        }
    }

    function setUnderlyingPrice(NToken nToken, uint underlyingPriceMantissa) external onlyAdmin() {
        address asset = address(NBep20(address(nToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public onlyUpdater() {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function setMultipleDirectPrice(address[] calldata _assets, uint[] calldata _prices) external onlyUpdater() {
        for (uint i = 0; i < _assets.length; i++) {
            setDirectPrice(_assets[i], _prices[i]);
        }
    }

    function setFeed(string calldata symbol, address feed) external onlyAdmin() {
        require(feed != address(0) && feed != address(this), "invalid feed address");
        emit FeedSet(feed, symbol);
        feeds[keccak256(abi.encodePacked(symbol))] = AggregatorV2V3Interface(feed);
    }

    function getFeed(string memory symbol) public view returns (AggregatorV2V3Interface) {
        return feeds[keccak256(abi.encodePacked(symbol))];
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function setUpdater(address _updater, bool status) external onlyAdmin() {
        updater[_updater] = status;
    }

    function setAdmin(address newAdmin) external onlyAdmin() {
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }

    modifier onlyAdmin() {
      require(msg.sender == admin, "only admin may call");
      _;
    }

    modifier onlyUpdater() {
        require(updater[msg.sender] == true, "only updater may call");
        _;
    }
}
