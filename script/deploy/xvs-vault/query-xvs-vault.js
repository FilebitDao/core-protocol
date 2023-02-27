const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const XVSVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultProxyContractInstance = await saddle.getContractAt("XVSVault", XVSVaultProxyAddress);
  const nwlStoreAddress = await nwlVaultProxyContractInstance.methods.nwlStore().call();
  console.log(`XVSVault -> has nwlStore: ${nwlStoreAddress}`);
})();
