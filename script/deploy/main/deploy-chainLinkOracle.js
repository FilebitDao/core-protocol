const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    //https://docs.chain.link/data-feeds/price-feeds/addresses?network=bnb-chain
    const ETHFeed = "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7"
    const BTCFeed = "0x5741306c21795FdCBb9b265Ea0255F499DFe515C"
    const BNBFeed = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526"
    const LTCFeed = "0x9Dcf949BCA2F4A8a62350E0065d18902eE87Dca3"
    const ADAFeed = "0x5e66a1775BbC249b5D51C13d29245522582E671C"
    const USDTFeed = "0xEca2605f0BCF2BA5966372C99837b1F182d3D620"
    const FILFeed = "0x17308A18d4a50377A4E1C37baaD424360025C74D"
    const maxStalePeriod = 360000
    const [account] = await ethers.getSigners();
    //deploy NarwhalChainlinkOracle
    const NarwhalChainlinkOracle = await ethers.getContractFactory("NarwhalChainlinkOracle");
    const narwhalChainlinkOracle = await NarwhalChainlinkOracle.deploy(maxStalePeriod);

    await narwhalChainlinkOracle.deployed();

    console.log("\tNarwhalChainlinkOracle deployed to:", narwhalChainlinkOracle.address);

    await writeAddr(narwhalChainlinkOracle.address, "NarwhalChainlinkOracle", network.name, account.address);

    await (await narwhalChainlinkOracle.setFeed("WETH", ETHFeed)).wait()
    await (await narwhalChainlinkOracle.setFeed("WBTC", BTCFeed)).wait()
    await (await narwhalChainlinkOracle.setFeed("nBNB", BNBFeed)).wait()
    await (await narwhalChainlinkOracle.setFeed("FIL", FILFeed)).wait()
    console.log("\tNarwhalChainlinkOracle set Feed  success")

    const UnitrollerAddr = await getAddr("Unitroller", network.name)
    const proxyUnitroller = await ethers.getContractAt("Comptroller", UnitrollerAddr, account)
    await (await proxyUnitroller._setPriceOracle(narwhalChainlinkOracle.address)).wait();

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
