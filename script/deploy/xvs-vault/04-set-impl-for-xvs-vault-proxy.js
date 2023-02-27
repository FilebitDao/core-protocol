const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const XVSVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultProxyContractInstance = await saddle.getContractAt("XVSVaultProxy", XVSVaultProxyAddress);

  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const setPendingImplementationTxn = await nwlVaultProxyContractInstance.methods
    ._setPendingImplementation(nwlVaultAddress)
    .send();

  console.log(`XVSVaultProxy-> set XVSVault: ${nwlVaultAddress} as PendingImplementation on XVSVaultProxyAddress: ${XVSVaultProxyAddress} 
    - with transactionStatus: ${setPendingImplementationTxn.status}`);
})();
