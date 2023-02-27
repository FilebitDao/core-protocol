const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlStoreAddress = contractConfigData.Contracts.XVSStore;
  const nwlStoreContractInstance = await saddle.getContractAt("XVSStore", nwlStoreAddress);
  const timelockAddress = contractConfigData.Contracts.Timelock;
  const setNewAdminToXVSStoreTxn = await nwlStoreContractInstance.methods.setNewAdmin(timelockAddress).send();
  console.log(
    `Timelock -> ${timelockAddress} as NewAdmin to XVSStore: ${nwlStoreAddress} has txnStatus: ${setNewAdminToXVSStoreTxn.status}`,
  );
})();
