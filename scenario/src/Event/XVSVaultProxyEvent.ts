import { buildXVSVaultProxy } from "../Builder/XVSVaultProxyBuilder";
import { Arg, Command, processCommandEvent } from "../Command";
import { XVSVaultProxy } from "../Contract/XVSVault";
import { getXVSVaultProxy } from "../ContractLookup";
import { getAddressV, getEventV } from "../CoreValue";
import { NoErrorReporter } from "../ErrorReporter";
import { Event } from "../Event";
import { invoke } from "../Invokation";
import { AddressV, EventV } from "../Value";
import { World, addAction } from "../World";

async function genXVSVaultProxy(world: World, from: string, params: Event): Promise<World> {
  const { world: nextWorld, nwlVaultProxy, nwlVaultData } = await buildXVSVaultProxy(world, from, params);
  world = nextWorld;

  world = addAction(world, `Deployed XVS Vault Proxy to address ${nwlVaultProxy._address}`, nwlVaultData.invokation);

  return world;
}

async function setPendingImplementation(
  world: World,
  from: string,
  nwlVault: XVSVaultProxy,
  impl: string,
): Promise<World> {
  const invokation = await invoke(world, nwlVault.methods._setPendingImplementation(impl), from, NoErrorReporter);

  world = addAction(world, `Set pending implementation of ${nwlVault.name} to ${impl}`, invokation);

  return world;
}

export function nwlVaultProxyCommands() {
  return [
    new Command<{ params: EventV }>(
      `
        #### Deploy

        * "Deploy ...params" - Generates a new XVS Vault (non-proxy version)
        * E.g. "XVSVaultProxy Deploy"
      `,
      "Deploy",
      [new Arg("params", getEventV, { variadic: true })],
      (world, from, { params }) => genXVSVaultProxy(world, from, params.val),
    ),

    new Command<{ nwlVaultProxy: XVSVaultProxy; newImpl: AddressV }>(
      `
        #### SetPendingImplementation

        * "XVSVault SetPendingImplementation newImpl:<Address>" - Sets the new pending implementation
        * E.g. "XVSVault SetPendingImplementation (Address XVSVaultImplementation)"
      `,
      "SetPendingImplementation",
      [new Arg("nwlVaultProxy", getXVSVaultProxy, { implicit: true }), new Arg("newImpl", getAddressV)],
      (world, from, { nwlVaultProxy, newImpl }) => setPendingImplementation(world, from, nwlVaultProxy, newImpl.val),
    ),
  ];
}

export async function processXVSVaultProxyEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("XVSVaultProxy", nwlVaultProxyCommands(), world, event, from);
}
