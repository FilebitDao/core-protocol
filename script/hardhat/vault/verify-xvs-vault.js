require("dotenv").config();
const contractConfigData = require("../../../networks/testnet.json");
const hre = require("hardhat");

const main = async () => {
  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;

  await hre.run("verify:verify", {
    address: nwlVaultAddress,
  });
};

module.exports = main;
