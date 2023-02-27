require("@nomiclabs/hardhat-ethers");
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;
require("dotenv").config();
const network = process.env.NETWORK;
const contractConfigData = require(`../../../networks/${network}.json`);

const main = async () => {
  const nwlVestingProxyAddress = contractConfigData.Contracts.XVSVestingProxy;

  const nwlVestingProxy = await ethers.getContractAt("XVSVesting", nwlVestingProxyAddress);

  const vrtConverterProxyAddress = contractConfigData.Contracts.VRTConverterProxy;
  const setVRTConverterTxn = await nwlVestingProxy.setVRTConverter(vrtConverterProxyAddress);

  console.log(`completed setVRTConverter: ${vrtConverterProxyAddress} with txn: ${JSON.stringify(setVRTConverterTxn)}`);
};

module.exports = main;
