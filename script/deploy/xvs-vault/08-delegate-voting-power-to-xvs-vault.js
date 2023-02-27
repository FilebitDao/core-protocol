const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultProxyAddress);
  const delegatee = contractConfigData.Accounts.Delegatee;
  const delegateTxn = await nwlVaultContractInstance.methods.delegate(delegatee).send();
  console.log(
    `nwlVault-> deleagted to: ${delegatee} on nwlVaultProxyAddress: ${nwlVaultProxyAddress} - with transactionStatus: ${delegateTxn.status}`,
  );
})();
