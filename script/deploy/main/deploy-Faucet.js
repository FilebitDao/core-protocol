const { ethers, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const { getAllClaimInfo } = require("./config.js");

async function main() {
    const [account] = await ethers.getSigners();
    //deploy Faucet
    const Faucet = await ethers.getContractFactory("Faucet");
    const faucet = await Faucet.deploy({maxPriorityFeePerGas: 1});

    await faucet.deployed();

    console.log("\tFaucet deployed to:", faucet.address);

    await writeAddr(faucet.address, "Faucet", network.name, account.address);

    const assets = getAllClaimInfo()

    await (await faucet.addAssets(assets, {maxPriorityFeePerGas: 1})).wait()

    for (let i = 0; i < assets.length; i++) {
        const token = await ethers.getContractAt("MockToken", assets[i].addr, account)
        await (await token.transfer(faucet.address, ethers.utils.parseUnits("100000"), {maxPriorityFeePerGas: 1})).wait();
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

