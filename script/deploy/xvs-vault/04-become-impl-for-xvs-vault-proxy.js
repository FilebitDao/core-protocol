const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const XVSVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultAddress);

  //become Implementation of XVSVaultProxy
  console.log(`XVSVault: ${nwlVaultAddress} becoming implementation for XVSVaultProxy: ${XVSVaultProxyAddress}`);
  const becomeImplementationAddress = await nwlVaultContractInstance.methods._become(XVSVaultProxyAddress).send();
  console.log(`XVSVault-> becomeImplementationTxn has Status: ${becomeImplementationAddress.status}`);

  //query Implementation of XVSVaultProxy
  const nwlVaultProxyContractInstance = await saddle.getContractAt("XVSVaultProxy", XVSVaultProxyAddress);
  const implementationAddress = await nwlVaultProxyContractInstance.methods.implementation().call();
  console.log(`XVSVaultProxy-> has Implementation: ${implementationAddress}`);
})();
