require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const main = async () => {
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  const nwlVaultContract = await ethers.getContractFactory("XVSVault");
  const nwlVaultContractInstance = await nwlVaultContract.deploy();
  await nwlVaultContractInstance.deployed();
  console.log(`deployer: ${deployer} deployed XVSVault at address: ${nwlVaultContractInstance.address}`);
  return nwlVaultContractInstance;
};

module.exports = main;
