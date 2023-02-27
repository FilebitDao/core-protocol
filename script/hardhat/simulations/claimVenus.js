// FORKING=true npx hardhat run script/hardhat/simulations/claimNarwhal.js

const { web3 } = require("hardhat");
const BigNumber = require("bignumber.js");
const { getContractAt, impersonate, mergeInterface } = require("../utils/misc");
const {
  Contracts: { Unitroller: comptrollerProxyAddress, NarwhalLens: narwhalLensAddress, XVS: nwlAddress },
} = require("../../../networks/mainnet.json");

// some testers
const bob = "0xd01119D0D32c8E943681D1f4688a14FE15AA35Bd";
const danny = "0x00509504178541edf8ea084d7095d9c46bf7c881";
const coco = "0x005b7f9127ac18c8da124bb0f58bffaa1952c983";
const dummy = "0xb3e7fa024c62218151552bc2397d6fb3ee855abc";

async function claimNarwhal() {
  await impersonate(bob);
  await impersonate(danny);
  await impersonate(coco);
  await impersonate(dummy);

  //
  console.log(">>>>>>>>>> prepare proxy contracts <<<<<<<<<<");
  const comptrollerProxyContract = getContractAt("Unitroller", comptrollerProxyAddress);
  mergeInterface(comptrollerProxyContract, getContractAt("Comptroller", comptrollerProxyAddress));

  const nwlToken = getContractAt("NToken", nwlAddress);
  const narwhalLensContract = getContractAt("NarwhalLens", narwhalLensAddress);

  console.log(`block number:`, await web3.eth.getBlockNumber());

  const target = dummy; // change this target
  const expectedNarwhalReward = await narwhalLensContract.methods.pendingNarwhal(target, comptrollerProxyAddress).call();
  console.log(`expected narwhal reward:`, expectedNarwhalReward);

  // simulating how many narwhal they are gonna get in real world
  const beforeNarwhalBalance = await nwlToken.methods.balanceOf(target).call();
  console.log(`claiming reward for: ${target}, before balance:`, beforeNarwhalBalance);
  await comptrollerProxyContract.methods.claimNarwhal(target).send({ from: target });
  const afterNarwhalBalance = await nwlToken.methods.balanceOf(target).call();
  console.log(
    `${target}, after balance: ${afterNarwhalBalance}, claimed: ${(
      new BigNumber(afterNarwhalBalance) - new BigNumber(beforeNarwhalBalance)
    ).toFixed(0)}`,
  );
}

claimNarwhal()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
