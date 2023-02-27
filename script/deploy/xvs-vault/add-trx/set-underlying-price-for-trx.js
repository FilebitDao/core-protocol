const [network] = args;
const contractConfigData = require(`../../../../networks/${network}.json`);

(async () => {
  const narwhalChainlinkOracleAddress = contractConfigData.Contracts.NarwhalPriceOracle;

  //load narwhalChainlinkOracleContractInstance from narwhalChainlinkOracleAddress
  const narwhalChainlinkOracleContractInstance = await saddle.getContractAt(
    "NarwhalChainlinkOracle",
    narwhalChainlinkOracleAddress,
  );

  await narwhalChainlinkOracleContractInstance.methods
    .setUnderlyingPrice(contractConfigData.Contracts.vTRX, 1000000000000000000n)
    .send();
})();
