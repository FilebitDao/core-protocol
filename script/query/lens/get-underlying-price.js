const [network, symbol] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const narwhalLensAddress = contractConfigData.Contracts.NarwhalLens;
  const narwhalLensContractInstance = await saddle.getContractAt("NarwhalLens", narwhalLensAddress);
  const vtokenAddress = contractConfigData.Contracts[symbol];
  const underlyingPriceResponse = await narwhalLensContractInstance.methods.vTokenUnderlyingPrice(vtokenAddress).call();
  console.log(`underlyingPriceResponse of symbol: ${symbol} is: ${JSON.stringify(underlyingPriceResponse)}`);
})();
