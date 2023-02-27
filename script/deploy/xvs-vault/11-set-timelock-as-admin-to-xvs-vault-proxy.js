const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxyAddress;
  const nwlVaultProxyContractInstance = await saddle.getContractAt("XVSVaultProxy", nwlVaultProxyAddress);
  const timelockAddress = contractConfigData.Contracts.Timelock;
  const setPendingAdminToXVSVaultProxyTxn = await nwlVaultProxyContractInstance.methods
    ._setPendingAdmin(timelockAddress)
    .send();
  console.log(
    `Timelock -> ${timelockAddress} as PendingAdmin to XVSVaultProxy: ${nwlVaultProxyAddress} has txnStatus: ${setPendingAdminToXVSVaultProxyTxn.status}`,
  );
})();
