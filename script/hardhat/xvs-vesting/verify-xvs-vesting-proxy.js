require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();
const network = process.env.NETWORK;
const contractConfigData = require(`../../../networks/${network}.json`);
const hre = require("hardhat");

const main = async () => {
  const nwlVestingAddress = contractConfigData.Contracts.XVSVesting;
  const nwlAddress = contractConfigData.Contracts.XVS;

  const nwlVestingConstructorArgumentArray = [nwlVestingAddress, nwlAddress];
  console.log(`Verifying XVSVesting with constructorArguments: ${nwlVestingConstructorArgumentArray}`);

  const nwlVestingProxyAddress = contractConfigData.Contracts.XVSVestingProxy;
  await hre.run("verify:verify", {
    address: nwlVestingProxyAddress,
    constructorArguments: nwlVestingConstructorArgumentArray,
  });
};

module.exports = main;
