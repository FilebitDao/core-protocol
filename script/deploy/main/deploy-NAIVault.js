const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    const [account] = await ethers.getSigners();
    //deploy NAIVault
    const NAIVault = await ethers.getContractFactory("NAIVault");
    const naiVault = await NAIVault.deploy({maxPriorityFeePerGas: 1});

    await naiVault.deployed();

    console.log("\tNAIVault deployed to:", naiVault.address);

    const NAIVaultProxy = await ethers.getContractFactory("NAIVaultProxy");
    const naiVaultProxy = await NAIVaultProxy.deploy({maxPriorityFeePerGas: 1});

    await naiVaultProxy.deployed();

    console.log("\tNAIVaultProxy deployed to:", naiVaultProxy.address);

    await (await naiVaultProxy._setPendingImplementation(naiVault.address, {maxPriorityFeePerGas: 1})).wait()
    await (await naiVault._become(naiVaultProxy.address, {maxPriorityFeePerGas: 1})).wait()

    await writeAddr(naiVault.address, "NAIVault", network.name, account.address);
    await writeAddr(naiVaultProxy.address, "NAIVaultProxy", network.name, account.address);

    const NAI = await getAddr("NAI", network.name)
    const NWL = await getAddr("NWL", network.name)

    const proxyNAIVault = await ethers.getContractAt("NAIVault", naiVaultProxy.address, account)

    await (await proxyNAIVault.setNarwhalInfo(NWL, NAI, {maxPriorityFeePerGas: 1})).wait()

    //function _setNAIVaultInfo(address vault_, uint256 releaseStartBlock_, uint256 minReleaseAmount_)
    //function _setNarwhalNAIVaultRate(uint narwhalNAIVaultRate_) external
    const releaseStartBlock = 25299152
    const minReleaseAmount = "10000000000000000"
    const narwhalNAIVaultRate_ = "8680555555555560"
    const UnitrollerAddr = await getAddr("Unitroller", network.name)
    const proxyUnitroller = await ethers.getContractAt("Comptroller", UnitrollerAddr, account)
    await (await proxyUnitroller._setNAIVaultInfo(naiVaultProxy.address, releaseStartBlock, minReleaseAmount, {maxPriorityFeePerGas: 1})).wait();
    await (await proxyUnitroller._setNarwhalNAIVaultRate(narwhalNAIVaultRate_, {maxPriorityFeePerGas: 1})).wait();
}

// async function waitTx(txhash){
//     let a = true
//     while (a) {
//         const tx = await ethers.provider.getTransactionReceipt(txhash);
//         if (tx != null) {
//             a = false
//         }
//         await sleep(5000)
//     }
// }
//
// function sleep(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
