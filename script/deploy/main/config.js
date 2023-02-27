const {ethers} = require("hardhat");

function getInitAllMarketsInfo() {
    return [{
        tokenName: "WBTC",
        supplyCap: ethers.utils.parseUnits("1000000000"),
        collateralFactor: ethers.utils.parseUnits("0.8"),
        reserveFactor:ethers.utils.parseUnits("0.2"),
        initialExchangeRate:'200000000000000000000000000',
        nwlBlockRate: "13020833333333333",
        baseRatePerYear: "0",
        multiplierPerYear: ethers.utils.parseUnits("0.1267"),
        jumpMultiplierPerYear: ethers.utils.parseUnits("2"),
        kink: ethers.utils.parseUnits("0.75")
    },
        {
            tokenName: "WETH",
            supplyCap: ethers.utils.parseUnits("1000000000"),
            collateralFactor: ethers.utils.parseUnits("0.8"),
            reserveFactor:ethers.utils.parseUnits("0.2"),
            initialExchangeRate:'200000000000000000000000000',
            nwlBlockRate: "6510416666666667",
            baseRatePerYear: "0",
            multiplierPerYear: ethers.utils.parseUnits("0.1267"),
            jumpMultiplierPerYear: ethers.utils.parseUnits("2"),
            kink: ethers.utils.parseUnits("0.75")
        },
        {
            tokenName: "FIL",
            supplyCap: ethers.utils.parseUnits("1000000000"),
            collateralFactor: ethers.utils.parseUnits("0.5"),
            reserveFactor:ethers.utils.parseUnits("0.2"),
            initialExchangeRate:'200000000000000000000000000',
            nwlBlockRate: "217013888888889",
            baseRatePerYear: ethers.utils.parseUnits("0.02"),
            multiplierPerYear: ethers.utils.parseUnits("0.2"),
            jumpMultiplierPerYear: ethers.utils.parseUnits("3"),
            kink: ethers.utils.parseUnits("0.5")
        },
        // {
        //     tokenName: "BNB",
        //     supplyCap: ethers.utils.parseUnits("1000000000"),
        //     collateralFactor: ethers.utils.parseUnits("0.8"),
        //     reserveFactor:ethers.utils.parseUnits("0.2"),
        //     initialExchangeRate:'200000000000000000000000000',
        //     nwlBlockRate: ethers.utils.parseUnits("0.0001"),
        //     baseRatePerYear: "0",
        //     multiplierPerYear: ethers.utils.parseUnits("0.12"),
        //     jumpMultiplierPerYear: ethers.utils.parseUnits("2"),
        //     kink: ethers.utils.parseUnits("0.75")
        // },
        {
            tokenName: "NAI",
            supplyCap: ethers.utils.parseUnits("1000000000"),
            collateralFactor: ethers.utils.parseUnits("0.8"),
            reserveFactor:ethers.utils.parseUnits("0.1"),
            initialExchangeRate:'200000000000000000000000000',
            nwlBlockRate: "5425347222222222",
            baseRatePerYear: "0",
            multiplierPerYear: ethers.utils.parseUnits("0.05"),
            jumpMultiplierPerYear: ethers.utils.parseUnits("1.09"),
            kink: ethers.utils.parseUnits("0.8")
        }
    ]
};

function getAllClaimInfo() {
    return [{
        asset: "WBTC",
        addr: '0x6B97F370B6f5E053287D47cE4283eA7976793c5E',
        frozenDuration: '86400',
        decimals:18,
        maxToClaimed: ethers.utils.parseUnits("0.1"),
    },
        {
            asset: "WETH",
            addr: '0xDa64243e1E8a0B3E0E0225EdF211307303A2c306',
            frozenDuration: '86400',
            decimals:18,
            maxToClaimed: ethers.utils.parseUnits("0.5"),
        },
        {
            asset: "NWL",
            addr: '0xEe49d7C3Bb1c7C73B1Dd6dbfCe684944aEBd9487',
            frozenDuration: '86400',
            decimals:18,
            maxToClaimed: ethers.utils.parseUnits("200"),
        },
        {
            asset: "NAI",
            addr: '0xF2f098c0912133B21B3206c626A2b57820330aBC',
            frozenDuration: '86400',
            decimals:18,
            maxToClaimed: ethers.utils.parseUnits("200"),
        }
    ]
};

module.exports = {
    getInitAllMarketsInfo,
    getAllClaimInfo
}