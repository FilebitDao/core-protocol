const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const XVSVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultProxyContractInstance = await saddle.getContractAt("XVSVaultProxy", XVSVaultProxyAddress);
  const implementationAddress = await nwlVaultProxyContractInstance.methods.nwlVaultImplementation().call();
  console.log(`XVSVaultProxy-> has Implementation: ${implementationAddress}`);
})();
