require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();
const network = process.env.NETWORK;
const contractConfigData = require(`../../../networks/${network}.json`);

const main = async () => {
  const narwhalLensAddress = contractConfigData.Contracts.NarwhalLens;
  const narwhalLensInstance = await ethers.getContractAt("NarwhalLens", narwhalLensAddress);
  const vTokenBalance = await narwhalLensInstance.vTokenBalances(
    "0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7",
    "0x0D29D962Ce3ECc34B41E2885fb0296a1C2fD80fd",
  );
  console.log(`vTokenBalance is: ${JSON.stringify(vTokenBalance)}`);
};

module.exports = main;
