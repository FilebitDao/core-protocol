const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);
const { bnbMantissa } = require("../utils/web3-utils");

(async () => {
  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultAddress);

  const nwlAddress = contractConfigData.Contracts.XVS;
  const amount = bnbMantissa(7e5);
  const depositXVSToXVSVaultTxn = await nwlVaultContractInstance.methods.deposit(nwlAddress, 1, amount).send();

  console.log(
    `XVS -> deposit : ${amount} to nwlVaultAddress: ${nwlVaultAddress} - with transactionStatus: ${depositXVSToXVSVaultTxn.status}`,
  );
})();
