const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log.js");

//const USDT = "0x43AA9aB6A1d0737Cc56F5E01a3DF3748c5A54717"

// Parameters
const closeFactor = 0.5e18.toString();
const liquidationIncentive = 1.1e18.toString();
const NAIMintRate = "5000"; //50%


async function main() {
    const [account] = await ethers.getSigners();

    //deploy Comptroller and Unitroller
    const Comptroller = await ethers.getContractFactory("Comptroller");
    const comptroller = await Comptroller.deploy({maxPriorityFeePerGas: 1});

    const Unitroller = await ethers.getContractFactory("Unitroller");
    const unitroller = await Unitroller.deploy({maxPriorityFeePerGas: 1});

    await comptroller.deployed();
    await unitroller.deployed();

    console.log("\tComptroller deployed to:", comptroller.address);
    console.log("\tUnitroller deployed to:", unitroller.address);
    await writeAddr(comptroller.address, "Comptroller", network.name, account.address);
    await writeAddr(unitroller.address, "Unitroller", network.name, account.address);

    //set Comptroller and Unitroller proxy
    await (await unitroller._setPendingImplementation(comptroller.address, {maxPriorityFeePerGas: 1})).wait();
    await (await comptroller._become(unitroller.address, {maxPriorityFeePerGas: 1})).wait();

    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const accessControlManager = await AccessControlManager.deploy({maxPriorityFeePerGas: 1});
    await accessControlManager.deployed();

    console.log("\tAccessControlManager deployed to:", accessControlManager.address);
    await writeAddr(accessControlManager.address, "AccessControlManager", network.name, account.address);

    await (await accessControlManager.giveCallPermission(unitroller.address, "_setCollateralFactor(address,uint256)", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_setLiquidationIncentive(uint256)", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_supportMarket(address)", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_setMarketBorrowCaps(address[],uint256[])", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_setMarketSupplyCaps(address[],uint256[])", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_setProtocolPaused(bool)", account.address, {maxPriorityFeePerGas: 1})).wait();
    await (await accessControlManager.giveCallPermission(unitroller.address, "_setActionsPaused(address[],uint256[],bool)", account.address, {maxPriorityFeePerGas: 1})).wait();

    const proxyUnitroller = await ethers.getContractAt("Comptroller", unitroller.address, account)

    //comptroller set
    await (await proxyUnitroller._setAccessControl(accessControlManager.address, {maxPriorityFeePerGas: 1})).wait();
    await (await proxyUnitroller._setLiquidationIncentive(liquidationIncentive, {maxPriorityFeePerGas: 1})).wait();
    await (await proxyUnitroller._setCloseFactor(closeFactor, {maxPriorityFeePerGas: 1})).wait();

    console.log("\tproxyUnitroller set success");
    //deploy NarwhalLens
    const NarwhalLens = await ethers.getContractFactory("NarwhalLens");
    const narwhalLens = await NarwhalLens.deploy({maxPriorityFeePerGas: 1});
    await narwhalLens.deployed();
    console.log("\tNarwhalLens deployed to:", narwhalLens.address);
    await writeAddr(narwhalLens.address, "NarwhalLens", network.name, account.address);

    //deploy compoundLens
    const ComptrollerLens = await ethers.getContractFactory("ComptrollerLens");
    const comptrollerLens = await ComptrollerLens.deploy({maxPriorityFeePerGas: 1});
    await comptrollerLens.deployed();
    console.log("\tComptrollerLens deployed to:", comptrollerLens.address);
    await writeAddr(comptrollerLens.address, "ComptrollerLens", network.name, account.address);

    //set comptrollerLens
    await (await proxyUnitroller._setComptrollerLens(comptrollerLens.address, {maxPriorityFeePerGas: 1})).wait();

    //deploy NAIComptroller and NAIUnitroller
    const NAIController = await ethers.getContractFactory("NAIController");
    const naiController = await NAIController.deploy({maxPriorityFeePerGas: 1});

    const NAIUnitroller = await ethers.getContractFactory("NAIUnitroller");
    const naiUnitroller = await NAIUnitroller.deploy({maxPriorityFeePerGas: 1});

    await naiController.deployed();
    await naiUnitroller.deployed();

    console.log("\tNAIController deployed to:", naiController.address);
    console.log("\tNAIUnitroller deployed to:", naiUnitroller.address);
    await writeAddr(naiController.address, "NAIController", network.name, account.address);
    await writeAddr(naiUnitroller.address, "NAIUnitroller", network.name, account.address);

    //set NAIComptroller and NAIUnitroller proxy
    await (await naiUnitroller._setPendingImplementation(naiController.address, {maxPriorityFeePerGas: 1})).wait();
    await (await naiController._become(naiUnitroller.address, {maxPriorityFeePerGas: 1})).wait();

    const proxyNAIUnitroller = await ethers.getContractAt("NAIController", naiUnitroller.address, account)

    await (await proxyNAIUnitroller._setComptroller(unitroller.address, {maxPriorityFeePerGas: 1})).wait();
    await (await proxyNAIUnitroller.initialize({maxPriorityFeePerGas: 1})).wait();
    //set NAIComptroller
    await (await proxyUnitroller._setNAIController(naiUnitroller.address, {maxPriorityFeePerGas: 1})).wait();

    await (await proxyUnitroller._setNAIMintRate(NAIMintRate, {maxPriorityFeePerGas: 1})).wait();

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

