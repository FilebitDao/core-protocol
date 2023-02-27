require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();
const network = process.env.NETWORK;
const contractConfigData = require(`../../../networks/${network}.json`);

const main = async () => {
  const narwhalLensAddress = contractConfigData.Contracts.NarwhalLens;
  const comptrollerAddress = contractConfigData.Contracts.Unitroller;
  const narwhalLensInstance = await ethers.getContractAt("NarwhalLens", narwhalLensAddress);
  await narwhalLensInstance.getDailyXVS("0x0D29D962Ce3ECc34B41E2885fb0296a1C2fD80fd", comptrollerAddress);
};

module.exports = main;
