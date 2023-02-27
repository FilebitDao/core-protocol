const { ethers, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const { getAllClaimInfo } = require("./config.js");
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    const [account] = await ethers.getSigners();

    const FaucetAddr = await getAddr("Faucet", network.name);
    const faucet = await ethers.getContractAt("Faucet", FaucetAddr, account)

    const assets = getAllClaimInfo()

    await (await faucet.addAssets(assets)).wait();
    console.log("\tFaucet set success");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

