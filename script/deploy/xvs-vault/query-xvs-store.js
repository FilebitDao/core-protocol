const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlStoreAddress = contractConfigData.Contracts.XVSStore;
  const nwlStoreContractInstance = await saddle.getContractAt("XVSStore", nwlStoreAddress);
  const admin = await nwlStoreContractInstance.methods.admin().call();
  const owner = await nwlStoreContractInstance.methods.owner().call();
  console.log(`XVSStore -> has admin: ${admin} and owner: ${owner}`);
})();
