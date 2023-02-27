const [network, tokenSymbol] = args;
const contractConfigData = require(`../../../networks/${network}.json`);
const { bnbUnsigned } = require("../utils/web3-utils");

(async () => {
  const nwlVaultProxyAddress = contractConfigData.Contracts.XVSVaultProxy;
  const nwlVaultContractInstance = await saddle.getContractAt("XVSVault", nwlVaultProxyAddress);
  const nwlVaultPoolConfig = contractConfigData.XVSVaultPools[tokenSymbol];

  const _rewardToken = contractConfigData.Contracts.XVS;
  const _allocPoint = nwlVaultPoolConfig.allocPoint;
  const _token = contractConfigData.Contracts[tokenSymbol];
  const _rewardPerBlock = bnbUnsigned(nwlVaultPoolConfig.rewardPerBlock);
  const _lockPeriod = nwlVaultPoolConfig.lockPeriod;
  const _withUpdate = nwlVaultPoolConfig.withUpdate;

  console.log(`XVSVault -> Adding ${tokenSymbol}: ${_token} as tokenPool 
  \n XVS :${_rewardToken} as RewardToken
  \n allocPoint: ${_allocPoint}
   \n rewardPerBlock: ${_rewardPerBlock}
   \n lockPeriod: ${_lockPeriod} 
   \n witnUpdate: ${_withUpdate}`);

  const createXVSTokenPoolOnXVSVaultTxn = await nwlVaultContractInstance.methods
    .add(_rewardToken, _allocPoint, _token, _rewardPerBlock, _lockPeriod)
    .send();

  console.log(`XVS -> created TokenPool for: ${_rewardToken} on nwlVaultProxyAddress: ${nwlVaultProxyAddress} 
    - with transactionStatus: ${createXVSTokenPoolOnXVSVaultTxn.status}`);
})();
