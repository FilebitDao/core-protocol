require("dotenv").config();
const contractConfigData = require("../../../networks/testnet.json");
const hre = require("hardhat");

const main = async () => {
  const nwlStoreAddress = contractConfigData.Contracts.XVSStore;

  await hre.run("verify:verify", {
    address: nwlStoreAddress,
  });
};

module.exports = main;
