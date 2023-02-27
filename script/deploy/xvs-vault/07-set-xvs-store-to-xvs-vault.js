const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultProxyAddress);

  const nwlAddress = contractConfigData.Contracts.XVS;
  const nwlStoreAddress = contractConfigData.Contracts.XVSStore;
  const setXVSStoreTxn = await nwlVaultContractInstance.methods.setNwlStore(nwlAddress, nwlStoreAddress).send();

  console.log(`XVSVault -> set XVSStore: ${nwlStoreAddress} with XVS: ${nwlAddress} on XVSVaultProxy: ${nwlVaultProxyAddress} 
    - with transactionStatus: ${setXVSStoreTxn.status}`);
})();
