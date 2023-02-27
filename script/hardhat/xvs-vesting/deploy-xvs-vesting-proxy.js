require("@nomiclabs/hardhat-ethers");
require("dotenv").config();
const network = process.env.NETWORK;
const contractConfigData = require(`../../../networks/${network}.json`);
const { getDeployer } = require("../../deploy/utils/web3-utils");
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const main = async () => {
  const nwlVestingAddress = contractConfigData.Contracts.XVSVesting;
  const nwlAddress = contractConfigData.Contracts.XVS;

  console.log(`XVSVestingProxy with 
    nwlVestingAddress: ${nwlVestingAddress} 
    nwlAddress: ${nwlAddress}`);

  const XVSVestingProxy = await ethers.getContractFactory("XVSVestingProxy");

  const nwlVestingProxyInstance = await XVSVestingProxy.deploy(nwlVestingAddress, nwlAddress, { gasLimit: 10000000 });

  await nwlVestingProxyInstance.deployed();

  const deployer = await getDeployer(ethers);
  console.log(`deployer: ${deployer} has deployed XVSVestingProxy at address: ${nwlVestingProxyInstance.address}`);
  return nwlVestingProxyInstance;
};

module.exports = main;
