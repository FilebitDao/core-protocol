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
        const jumpRateModel = await JumpRateModel.deploy(markets[i].baseRatePerYear, markets[i].multiplierPerYear, markets[i].jumpMultiplierPerYear, markets[i].kink, {maxPriorityFeePerGas: 1});
        await jumpRateModel.deployed();
        console.log("\tJumpRateModel deployed to:", jumpRateModel.address);
        await writeAddr(jumpRateModel.address, TokenName + "JumpRateModel", network.name, account.address);
        const proxyUnitroller = await ethers.getContractAt("Comptroller", UnitrollerAddr, account)

        if (NTokenName === "nFIL") {
            const NBNB = await ethers.getContractFactory("NBNB");
            const nBNB = await NBNB.deploy(UnitrollerAddr, jumpRateModel.address, markets[i].initialExchangeRate, "Narwhal FIL", "nFIL", 8, account.address, {maxPriorityFeePerGas: 1});
            await nBNB.deployed();

            console.log("\tnFIL deployed to:", nBNB.address);
            await writeAddr(nBNB.address, "nFIL", network.name, account.address);

            await (await proxyUnitroller._supportMarket(nBNB.address, {maxPriorityFeePerGas: 1})).wait();
            await (await proxyUnitroller._setMarketSupplyCaps([nBNB.address], [markets[i].supplyCap], {maxPriorityFeePerGas: 1})).wait();
            await (await proxyUnitroller._setCollateralFactor(nBNB.address, markets[i].collateralFactor, {maxPriorityFeePerGas: 1})).wait();
            await (await proxyUnitroller._setNarwhalSpeed(nBNB.address, markets[i].nwlBlockRate, {maxPriorityFeePerGas: 1})).wait();

            //set reserveFactor
            await (await nBNB._setReserveFactor(markets[i].reserveFactor, {maxPriorityFeePerGas: 1})).wait();

            console.log("\tproxyUnitroller set success");

            continue
        }

        let tokenAddr = await getAddr(TokenName, network.name)
        if (tokenAddr === "") {
            const Token = await ethers.getContractFactory("MockToken");
            const token = await Token.deploy(account.address, TokenName, TokenName, {maxPriorityFeePerGas: 1});

            await token.deployed();
            await writeAddr(token.address, TokenName, network.name, account.address);
            console.log("\t" + TokenName +" deployed to:", token.address);
            tokenAddr = token.address
        }


        let NBep20DelegateAddr = await getAddr("NBep20Delegate", network.name)
        if (NBep20DelegateAddr === "") {
            const NBep20Delegate = await ethers.getContractFactory("NBep20Delegate");
            const nBep20Delegate = await NBep20Delegate.deploy({maxPriorityFeePerGas: 1});
            await nBep20Delegate.deployed();

            await writeAddr(nBep20Delegate.address, "NBep20Delegate", network.name, account.address);
            console.log("\tNBep20Delegate deployed to:", nBep20Delegate.address);
            NBep20DelegateAddr = nBep20Delegate.address
        }

        //const JumpRateModelAddr = await getAddr("JumpRateModel", network.name)
        //console.log(NBep20DelegateAddr, UnitrollerAddr, JumpRateModelAddr)
        const NBep20Delegator = await ethers.getContractFactory("NBep20Delegator");
        const nToken = await NBep20Delegator.deploy(tokenAddr, UnitrollerAddr, jumpRateModel.address, markets[i].initialExchangeRate, "Narwhal " + TokenName, NTokenName, 8, account.address, NBep20DelegateAddr, "0x", {maxPriorityFeePerGas: 1});
        await nToken.deployed();

        console.log("\t" + NTokenName +"deployed to:", nToken.address);
        await writeAddr(nToken.address, NTokenName, network.name, account.address);


        await (await proxyUnitroller._supportMarket(nToken.address, {maxPriorityFeePerGas: 1})).wait();
        await (await proxyUnitroller._setMarketSupplyCaps([nToken.address], [markets[i].supplyCap], {maxPriorityFeePerGas: 1})).wait();
        await (await proxyUnitroller._setCollateralFactor(nToken.address, markets[i].collateralFactor, {maxPriorityFeePerGas: 1})).wait();
        await (await proxyUnitroller._setNarwhalSpeed(nToken.address, markets[i].nwlBlockRate, {maxPriorityFeePerGas: 1})).wait();

        //set reserveFactor
        await (await nToken._setReserveFactor(markets[i].reserveFactor, {maxPriorityFeePerGas: 1})).wait();

        console.log("\tproxyUnitroller set success");
    }
    // await hre.run('compile');

}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });