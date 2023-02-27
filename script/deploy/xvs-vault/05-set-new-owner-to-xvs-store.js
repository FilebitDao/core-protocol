const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlStoreAddress = contractConfigData.Contracts.XVSStore;
  const nwlStoreContractInstance = await saddle.getContractAt("XVSStore", nwlStoreAddress);
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const setNewOwnerToXVSStoreTxn = await nwlStoreContractInstance.methods.setNewOwner(nwlVaultProxyAddress).send();
  console.log(
    `XVSStore -> ${nwlVaultProxyAddress} as NewOwner to XVSStore: ${nwlStoreAddress} has txnStatus: ${setNewOwnerToXVSStoreTxn.status}`,
  );
})();
