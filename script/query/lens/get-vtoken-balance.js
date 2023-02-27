const [network, acct, symbol] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const narwhalLensAddress = contractConfigData.Contracts.NarwhalLens;
  const narwhalLensContractInstance = await saddle.getContractAt("NarwhalLens", narwhalLensAddress);
  const vtokenAddress = contractConfigData.Contracts[symbol];
  const vTokenBalance = await narwhalLensContractInstance.methods.vTokenBalances(vtokenAddress, acct).call();
  console.log(`vTokenBalance of symbol: ${symbol} of account: ${acct} is: ${JSON.stringify(vTokenBalance)}`);
})();
