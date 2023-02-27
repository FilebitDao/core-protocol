require("@nomiclabs/hardhat-ethers");
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;
const { getDeployer } = require("../../deploy/utils/web3-utils");

const main = async () => {
  const NarwhalLensContract = await ethers.getContractFactory("NarwhalLens");
  const venuLensContractInstance = await NarwhalLensContract.deploy({ gasLimit: 10000000 });
  await venuLensContractInstance.deployed();
  const deployer = await getDeployer(ethers);
  console.log(`deployer: ${deployer} has deployed NarwhalLens at address: ${venuLensContractInstance.address}`);
  return venuLensContractInstance;
};

module.exports = main;
