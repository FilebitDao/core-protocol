import { Arg, Fetcher, getFetcherValue } from "../Command";
import { VBep20Delegate } from "../Contract/VBep20Delegate";
import { getNTokenDelegateAddress, getWorldContractByAddress } from "../ContractLookup";
import { getCoreValue, mapValue } from "../CoreValue";
import { Event } from "../Event";
import { AddressV, Value } from "../Value";
import { World } from "../World";

export async function getNTokenDelegateV(world: World, event: Event): Promise<VBep20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    str => new AddressV(getNTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV,
  );

  return getWorldContractByAddress<VBep20Delegate>(world, address.val);
}

async function vTokenDelegateAddress(world: World, vTokenDelegate: VBep20Delegate): Promise<AddressV> {
  return new AddressV(vTokenDelegate._address);
}

export function vTokenDelegateFetchers() {
  return [
    new Fetcher<{ vTokenDelegate: VBep20Delegate }, AddressV>(
      `
        #### Address

        * "NTokenDelegate <NTokenDelegate> Address" - Returns address of NTokenDelegate contract
          * E.g. "NTokenDelegate vDaiDelegate Address" - Returns vDaiDelegate's address
      `,
      "Address",
      [new Arg("vTokenDelegate", getNTokenDelegateV)],
      (world, { vTokenDelegate }) => vTokenDelegateAddress(world, vTokenDelegate),
      { namePos: 1 },
    ),
  ];
}

export async function getNTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("NTokenDelegate", vTokenDelegateFetchers(), world, event);
}
