const [network] = args;
const contractConfigData = require(`../../../networks/${network}.json`);
const { bnbMantissa } = require("../utils/web3-utils");

(async () => {
  const nwlAddress = contractConfigData.Contracts.XVS;
  const nwlInstance = await saddle.getContractAt("XVS", nwlAddress);

  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const approvalAmount = bnbMantissa(1e10);
  const approveXVSSpendingTxn = await nwlInstance.methods.approve(nwlVaultAddress, approvalAmount).send();

  console.log(
    `XVS -> approved spending for : ${approvalAmount} to nwlVaultAddress: ${nwlVaultAddress} - with transactionStatus: ${approveXVSSpendingTxn.status}`,
  );
})();
