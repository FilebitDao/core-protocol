const { ethers, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log.js");
const { getInitAllMarketsInfo } = require("./config.js");

async function main() {
    const [account] = await ethers.getSigners();
    let markets = getInitAllMarketsInfo();
    for (let i = 0; i < markets.length; i++) {
        let TokenName = markets[i].tokenName
        let NTokenName = "n" + TokenName

        const UnitrollerAddr = await getAddr("Unitroller", network.name)

        const JumpRateModel = await ethers.getContractFactory("JumpRateModel");
        const jumpRateModel = await JumpRateModel.deploy(markets[i].baseRatePerYear, markets[i].multiplierPerYear, markets[i].jumpMultiplierPerYear, markets[i].kink);
        await jumpRateModel.deployed();
        console.log("\tJumpRateModel deployed to:", jumpRateModel.address);
        await writeAddr(jumpRateModel.address, TokenName + "JumpRateModel", network.name, account.address);
        const proxyUnitroller = await ethers.getContractAt("Comptroller", UnitrollerAddr, account)


        const NTokenAddr = await getAddr(NTokenName, network.name);

        let nToken = await ethers.getContractAt("NBep20Delegator", NTokenAddr, account)

        //set reserveFactor
        await (await nToken._setReserveFactor(markets[i].reserveFactor)).wait();
        await (await nToken._setInterestRateModel(jumpRateModel.address, {gasLimit: 500000})).wait();

        console.log("\tnToken set success");
        await (await proxyUnitroller._supportMarket(nToken.address)).wait();
        await (await proxyUnitroller._setMarketSupplyCaps([nToken.address], [markets[i].supplyCap])).wait();
        await (await proxyUnitroller._setCollateralFactor(nToken.address, markets[i].collateralFactor)).wait();
        await (await proxyUnitroller._setNarwhalSpeed(nToken.address, markets[i].nwlBlockRate)).wait();

        console.log("\tproxyUnitroller set success");
        // await hre.run('compile');
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });