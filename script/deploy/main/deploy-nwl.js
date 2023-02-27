const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');

async function main() {
    const [account] = await ethers.getSigners();
    //deploy NWL
    const NWL = await ethers.getContractFactory("NWL");
    const nwl = await NWL.deploy(account.address, {maxPriorityFeePerGas: 1});

    await nwl.deployed();

    console.log("\tNWL deployed to:", nwl.address);

    await writeAddr(nwl.address, "NWL", network.name, account.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
