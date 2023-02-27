/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */
import { Contract } from "@ethersproject/contracts";

// Governance
export function deployGovernorBravoDelegate(): Contract {}
export function deployGovernorBravoDelegator(config: {
  timelockAddress: string;
  nwlVaultAddress: string;
  guardianAddress: string;
  governorBravoDelegateAddress: string;
}): Contract {}
export function verifyGovernorBravoDelegate() {}
export function verifyGovernorBravoDelegator() {}
export function deployGovernorAlpha(config: {
  timelockAddress: string;
  nwlVaultAddress: string;
  guardianAddress: string;
}): Contract {}
export function deployGovernorAlpha2(config: {
  timelockAddress: string;
  nwlVaultAddress: string;
  guardianAddress: string;
  lastProposalId: number;
}): Contract {}

// Vault
export function deployVrtVaultProxy(): Contract {}
export function deployVrtVault(): Contract {}
export function deployNwlStore(): Contract {}
export function deployNwlVaultProxy(): Contract {}
export function deployNwlVault(): Contract {}
export function queryVrtVaultViaVaultProxy() {}
export function verifyVrtVaultProxy() {}
export function verifyVrtVault() {}
export function verifyNwlStore() {}
export function verifyNwlVaultProxy() {}
export function verifyNwlVault() {}
export function vrtVaultAcceptAsImplForProxy() {}
export function vrtVaultSetImplForVaultProxy() {}

// Comptroller
export function deployNextComptrollerPrologue(): {
  vaiControllerContract: Contract;
  comptrollerLensContract: Contract;
  comptrollerContract: Contract;
  liquidatorContract: Contract;
} {}

// Lens
export function deploySnapshotLens(): Contract {}
export function deployNarwhalLens(): Contract {}
export function getDailyNwl() {}
export function getVtokenBalance() {}
export function verifySnapshotLens() {}
export function verifyNarwhalLens() {}

// VRT Conversion
export function deployVrtConverterPro(): Contract {}
export function deployVrtConverter(): Contract {}
export function queryVrtConverter() {}
export function setNwlVesting() {}
export function verifyVrtConverterPro() {}
export function verifyVrtConverter() {}

// XVS Vesting
export function deployNwlVestingProxy(): Contract {}
export function deployNwlVesting(): Contract {}
export function setVrtConverter() {}
export function verifyNwlVestingProxy() {}
export function verifyNwlVesting() {}
