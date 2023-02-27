require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const main = async () => {
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  const nwlVaultProxyContract = await ethers.getContractFactory("XVSVaultProxy");
  const nwlVaultProxyContractInstance = await nwlVaultProxyContract.deploy();
  await nwlVaultProxyContractInstance.deployed();
  console.log(`deployer: ${deployer} deployed XVSVaultProxy at address: ${nwlVaultProxyContractInstance.address}`);
  return nwlVaultProxyContractInstance;
};

module.exports = main;
