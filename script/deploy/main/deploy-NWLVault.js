const { ethers, upgrades, network } = require("hardhat");
const { writeAddr } = require('../../../helpers/artifact_log.js');
const {getAddr} = require("../../../helpers/artifact_log");

async function main() {
    const [account] = await ethers.getSigners();
    //deploy NWLVault
    const NWLVault = await ethers.getContractFactory("NWLVault");
    const nwlVault = await NWLVault.deploy({maxPriorityFeePerGas: 1});

    await nwlVault.deployed();

    console.log("\tNWLVault deployed to:", nwlVault.address);

    const NWLVaultProxy = await ethers.getContractFactory("NWLVaultProxy");
    const nwlVaultProxy = await NWLVaultProxy.deploy({maxPriorityFeePerGas: 1});

    await nwlVaultProxy.deployed();

    console.log("\tNWLVaultProxy deployed to:", nwlVaultProxy.address);

    await (await nwlVaultProxy._setPendingImplementation(nwlVault.address, {maxPriorityFeePerGas: 1})).wait()
    await (await nwlVault._become(nwlVaultProxy.address, {maxPriorityFeePerGas: 1})).wait()

    await writeAddr(nwlVault.address, "NWLVault", network.name, account.address);
    await writeAddr(nwlVaultProxy.address, "NWLVaultProxy", network.name, account.address);

    const NWLStore = await ethers.getContractFactory("NWLStore");
    const nwlStore = await NWLStore.deploy({maxPriorityFeePerGas: 1});

    await nwlStore.deployed();

    console.log("\tNWLStore deployed to:", nwlStore.address);

    await writeAddr(nwlStore.address, "NWLStore", network.name, account.address);

    await (await nwlStore.setNewOwner(nwlVaultProxy.address, {maxPriorityFeePerGas: 1})).wait()

    const NWL = await getAddr("NWL", network.name)

    const proxyNWLVault = await ethers.getContractAt("NWLVault", nwlVaultProxy.address, account)


    await (await proxyNWLVault.setNwlStore(NWL, nwlStore.address, {maxPriorityFeePerGas: 1})).wait()
    //    function add(
    //         address _rewardToken,
    //         uint256 _allocPoint,
    //         IBEP20 _token,
    //         uint256 _rewardPerBlock,
    //         uint256 _lockPeriod
    //     )
    //添加质押池子
    await (await proxyNWLVault.add(NWL, 100, NWL, "83333333333333333", 300, {maxPriorityFeePerGas: 1})).wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
