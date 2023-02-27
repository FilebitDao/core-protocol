require("dotenv").config();
const contractConfigData = require("../../../networks/testnet.json");
const { bnbMantissa } = require("../../deploy/utils/web3-utils");
const hre = require("hardhat");

const main = async () => {
  const governorBravoDelegatorAddress = contractConfigData.Contracts.GovernorBravoDelegator;

  const timelockAddress = contractConfigData.Contracts.Timelock;
  const nwlVaultAddress = contractConfigData.Contracts.XVSVault;
  const admin = contractConfigData.Accounts.Guardian;
  const governorBravoDelegateAddress = contractConfigData.Contracts.GovernorBravoDelegate;
  const votingPeriod = 200;
  const votingDelay = 1;
  const proposalThreshold = bnbMantissa(1e4);
  const guardian = contractConfigData.Accounts.Guardian;

  const constructorArgumentArray = [
    timelockAddress,
    nwlVaultAddress,
    admin,
    governorBravoDelegateAddress,
    votingPeriod,
    votingDelay,
    proposalThreshold,
    guardian,
  ];
  console.log(
    `Verifying GovernorBravoDelegator with timelockAddress, nwlVaultAddress, admin, governorBravoDelegateAddress, votingPeriod, votingDelay, proposalThreshold, guardian in constructorArguments: ${constructorArgumentArray}`,
  );

  await hre.run("verify:verify", {
    address: governorBravoDelegatorAddress,
    constructorArguments: constructorArgumentArray,
  });
  return governorBravoDelegatorAddress;
};

module.exports = main;
