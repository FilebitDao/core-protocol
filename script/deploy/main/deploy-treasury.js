const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    const [account] = await ethers.getSigners();
    //deploy NTreasury
    const NTreasury = await ethers.getContractFactory("NTreasury");
    const nTreasury = await NTreasury.deploy({maxPriorityFeePerGas: 1});

    await nTreasury.deployed();

    console.log("\tNTreasury deployed to:", nTreasury.address);

    const TreasuryPercent = ethers.utils.parseUnits("0.001")
    const NAIUnitrollerAddr = await getAddr("NAIUnitroller", network.name)
    const proxyNAIController = await ethers.getContractAt("NAIController", NAIUnitrollerAddr, account)
    await (await proxyNAIController._setTreasuryData(account.address, nTreasury.address, TreasuryPercent, {maxPriorityFeePerGas: 1})).wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
