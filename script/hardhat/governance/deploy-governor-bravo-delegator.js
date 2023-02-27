require("dotenv").config();

const { bnbMantissa } = require("../../deploy/utils/web3-utils");
const hre = require("hardhat");
const ethers = hre.ethers;

const main = async ({ timelockAddress, nwlVaultAddress, guardianAddress, governorBravoDelegateAddress }) => {
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();

  const GovernorBravoDelegatorContract = await ethers.getContractFactory("GovernorBravoDelegator");

  const votingPeriod = 3600;
  const votingDelay = 1;
  const proposalThreshold = bnbMantissa(15e4);

  const constructorArgumentArray = [
    timelockAddress,
    nwlVaultAddress,
    guardianAddress,
    governorBravoDelegateAddress,
    votingPeriod,
    votingDelay,
    proposalThreshold,
    guardianAddress,
  ];
  console.log(
    `Deploying GovernorBravoDelegator with timelockAddress, nwlVaultAddress, admin, governorBravoDelegateAddress, votingPeriod, votingDelay, proposalThreshold, guardian in constructorArguments: ${constructorArgumentArray}`,
  );

  const governorBravoDelegatorContractInstance = await GovernorBravoDelegatorContract.deploy(
    timelockAddress,
    nwlVaultAddress,
    guardianAddress,
    governorBravoDelegateAddress,
    votingPeriod,
    votingDelay,
    proposalThreshold,
    guardianAddress,
    { gasLimit: 10000000 },
  );

  await governorBravoDelegatorContractInstance.deployed();
  console.log(
    `deployer: ${deployer} deployed GovernorBravoDelegator at address: ${governorBravoDelegatorContractInstance.address}`,
  );
  return governorBravoDelegatorContractInstance;
};

module.exports = main;
