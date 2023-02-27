import { buildNTokenDelegate } from "../Builder/NTokenDelegateBuilder";
import { Arg, Command, View, processCommandEvent } from "../Command";
import { VBep20Delegate } from "../Contract/VBep20Delegate";
import { getNTokenDelegateData } from "../ContractLookup";
import { getEventV, getStringV } from "../CoreValue";
import { Event } from "../Event";
import { EventV, StringV } from "../Value";
import { verify } from "../Verify";
import { World, addAction } from "../World";

async function genNTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  const { world: nextWorld, vTokenDelegate, delegateData } = await buildNTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added vToken ${delegateData.name} (${delegateData.contract}) at address ${vTokenDelegate._address}`,
    delegateData.invokation,
  );

  return world;
}

async function verifyNTokenDelegate(
  world: World,
  vTokenDelegate: VBep20Delegate,
  name: string,
  contract: string,
  apiKey: string,
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, vTokenDelegate._address);
  }

  return world;
}

export function vTokenDelegateCommands() {
  return [
    new Command<{ vTokenDelegateParams: EventV }>(
      `
        #### Deploy

        * "NTokenDelegate Deploy ...vTokenDelegateParams" - Generates a new NTokenDelegate
          * E.g. "NTokenDelegate Deploy VDaiDelegate vDAIDelegate"
      `,
      "Deploy",
      [new Arg("vTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { vTokenDelegateParams }) => genNTokenDelegate(world, from, vTokenDelegateParams.val),
    ),
    new View<{ vTokenDelegateArg: StringV; apiKey: StringV }>(
      `
        #### Verify

        * "NTokenDelegate <vTokenDelegate> Verify apiKey:<String>" - Verifies NTokenDelegate in BscScan
          * E.g. "NTokenDelegate vDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [new Arg("vTokenDelegateArg", getStringV), new Arg("apiKey", getStringV)],
      async (world, { vTokenDelegateArg, apiKey }) => {
        const [vToken, name, data] = await getNTokenDelegateData(world, vTokenDelegateArg.val);

        return await verifyNTokenDelegate(world, vToken, name, data.get("contract")!, apiKey.val);
      },
      { namePos: 1 },
    ),
  ];
}

export async function processNTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("NTokenDelegate", vTokenDelegateCommands(), world, event, from);
}
