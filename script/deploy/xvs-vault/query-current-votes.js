const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);

(async () => {
  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultAddress);
  const address = "0x2Ce1d0ffD7E869D9DF33e28552b12DdDed326706";
  const currentVotes = await nwlVaultContractInstance.methods.getCurrentVotes(address).call();
  console.log(`XVSVault -> has votes: ${currentVotes} for accont: ${address}`);
})();
