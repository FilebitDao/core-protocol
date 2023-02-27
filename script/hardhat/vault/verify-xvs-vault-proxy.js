require("dotenv").config();
const contractConfigData = require("../../../networks/testnet.json");
const hre = require("hardhat");

const main = async () => {
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;

  await hre.run("verify:verify", {
    address: nwlVaultProxyAddress,
  });
};

module.exports = main;
