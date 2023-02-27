const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    const [account] = await ethers.getSigners();
    //deploy NarwhalChainlinkOracle
    const SimplePriceOracle = await ethers.getContractFactory("SimplePriceOracle");
    const simplePriceOracle = await SimplePriceOracle.deploy({maxPriorityFeePerGas: 1});

    await simplePriceOracle.deployed();

    console.log("\tSimplePriceOracle deployed to:", simplePriceOracle.address);

    await writeAddr(simplePriceOracle.address, "SimplePriceOracle", network.name, account.address);

    const UnitrollerAddr = await getAddr("Unitroller", network.name)
    const proxyUnitroller = await ethers.getContractAt("Comptroller", UnitrollerAddr, account)
    await (await proxyUnitroller._setPriceOracle(simplePriceOracle.address, {maxPriorityFeePerGas: 1})).wait();

    console.log("\tUnitroller set NarwhalChainlinkOracle  success")
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
