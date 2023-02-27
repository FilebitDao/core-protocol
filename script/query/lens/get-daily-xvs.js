const [network, acct] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const narwhalLensAddress = contractConfigData.Contracts.NarwhalLens;
  const narwhalLensContractInstance = await saddle.getContractAt("NarwhalLens", narwhalLensAddress);
  const comptrollerAddress = contractConfigData.Contracts.Unitroller;
  const dailyXVS = await narwhalLensContractInstance.methods.getDailyXVS(acct, comptrollerAddress).call();
  console.log(`dailyXVS of account: ${acct} is: ${dailyXVS}`);
})();
