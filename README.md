# core-protocol

## Narwhal deploy

```shell
npm run bsctest:deployment
```
## Detailed steps
### I、Deploy stable token NAI and protocol token NWL

Deployment script:
```shell
npx hardhat run ./script/deploy/main/deploy-nai.js --network bsctest
npx hardhat run ./script/deploy/main/deploy-nwl.js --network bsctest
```
Because the NAI and NWL addresses are hard coded in Comptroller and NAIController, they need to be replaced in the code after deployment

### II、Deploy Comptroller, NAIController, corresponding agents and related configurations

Deployment script：
```shell
npx hardhat run ./script/deploy/main/deploy-narwhal.js --network bsctest
```

The detailed configuration process can be seen in the script

The general process is：

1. Deploy Comptroller and Uniteller and configure agents

2. Uniteller configures the maximum clearing proportion, clearing reward and other parameters

3. Deploy ComptrollerLens (part of the calculation logic has been moved to this contract) contract and Uniteller configuration address

4. Deploy NAIController and NAIUnitroller and configure agents

5. NAIUnitroller and Unitroller are configured accordingly

Main configuration parameters：
```shell
const closeFactor = 0.5e18.toString();    //Maximum liquidation ratio, which is 50%
const liquidationIncentive = 1.1e18.toString(); //Liquidation reward, this value is 110%, equivalent to 10% of liquidation reward
const NAIMintRate = "5000"; //Proportion of NAI stable coins 50% 
```

### III、Deploy chainLinkOracle

Deployment script：
```shell
npx hardhat run ./script/deploy/main/deploy-chainLinkOracle.js --network bsctest
```

The detailed configuration process can be seen in the script

### IV、Deploy the corresponding token market and related configurations
Deployment script：
```shell
npx hardhat run ./script/deploy/main/add_Market.js --network bsctest
```

The detailed configuration process can be seen in the script

The general process is as follows:

1. Interest rate model contract for token deployment

2. Deploy corresponding asset token contracts (if any, deployment is not required)

3. Deploy NBep20Delegate and NBep20Delegate and configure agents (nBNB only needs to deploy NBNB contracts)

4. Information related to Unitroller token configuration

The general process is：

```shell
const CollateralFactor = 0.6e18.toString();  //Mortgage rate of the asset, which is 60%
const reserveFactor = 0.2e18.toString();     //The reserve ratio of the asset, which is 20%

//Relevant parameters of interest rate model
const baseRatePerYear = 0.01e18.toString();
const multiplierPerYear = 0.01e18.toString();
const jumpMultiplierPerYear = 0.2e18.toString();
const kink = 0.8e18.toString();
```

### V、Deploy VAIVault

Deployment script：
```shell
npx hardhat run script/deploy/main/deploy-NAIVault.js --network bsctest
```

The detailed configuration process can be seen in the script

The general process is：
1. Deploy NAIVault and NAIVaultProxy contracts and configure agents

2. NAIVaultProxy is configured accordingly

3. Unitroller configuration

Main configuration parameters

```shell
    //function _setNAIVaultInfo(address vault_, uint256 releaseStartBlock_, uint256 minReleaseAmount_)
    //function _setNarwhalNAIVaultRate(uint narwhalNAIVaultRate_) external
    const releaseStartBlock = 25299152    //Starting block of reward distribution
    const minReleaseAmount = "10000000000000000" //Minimum amount issued to the vault
    const narwhalNAIVaultRate_ = "10000000000000" //NAIVault's protocol token reward rate
```

### VI、Deploy NWLVault
Deployment script：
```shell
npx hardhat run script/deploy/main/deploy-NWLVault.js --network bsctest
```
The detailed configuration process can be seen in the script

The general process is：
1. Deploy NWLVVault and NWLVaultProxy contracts and configure agents

2. Deploy NWLStore fund management contract

3. Configure NWLStore and NWLVaultProxy contracts accordingly

4. NWLVaultProxy adds a pledge pool

Main configuration parameters
```shell
    //    function add(
    //         address _rewardToken,  
    //         uint256 _allocPoint,   
    //         IBEP20 _token,         
    //         uint256 _rewardPerBlock, 
    //         uint256 _lockPeriod    
    //     )
```