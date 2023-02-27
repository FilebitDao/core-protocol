const hre = require("hardhat");
const ethers = hre.ethers;

const main = async () => {
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  const nwlStoreContract = await ethers.getContractFactory("XVSStore");
  const nwlStoreContractInstance = await nwlStoreContract.deploy();
  await nwlStoreContractInstance.deployed();
  console.log(`deployer: ${deployer} deployed nwlStore at address: ${nwlStoreContractInstance.address}`);
  return nwlStoreContractInstance;
};

module.exports = main;
