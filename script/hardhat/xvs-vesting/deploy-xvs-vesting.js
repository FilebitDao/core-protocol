require("@nomiclabs/hardhat-ethers");
require("dotenv").config();
const { getDeployer } = require("../../deploy/utils/web3-utils");
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const main = async () => {
  const XVSVestingContract = await ethers.getContractFactory("XVSVesting");
  const nwlVestingContractInstance = await XVSVestingContract.deploy();
  await nwlVestingContractInstance.deployed({ gasLimit: 10000000 });

  const deployer = await getDeployer(ethers);
  console.log(`deployer: ${deployer} has deployed nwlVesting at address: ${nwlVestingContractInstance.address}`);
  return nwlVestingContractInstance;
};

module.exports = main;
