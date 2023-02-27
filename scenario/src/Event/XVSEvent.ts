import { buildXVS } from "../Builder/XVSBuilder";
import { Arg, Command, View, processCommandEvent } from "../Command";
import { XVS, XVSScenario } from "../Contract/XVS";
import { getXVS } from "../ContractLookup";
import { getAddressV, getEventV, getNumberV, getStringV } from "../CoreValue";
import { NoErrorReporter } from "../ErrorReporter";
import { Event } from "../Event";
import { invoke } from "../Invokation";
import { AddressV, EventV, NumberV, StringV } from "../Value";
import { verify } from "../Verify";
import { World, addAction } from "../World";

async function genXVS(world: World, from: string, params: Event): Promise<World> {
  const { world: nextWorld, nwl, tokenData } = await buildXVS(world, from, params);
  world = nextWorld;

  world = addAction(world, `Deployed XVS (${nwl.name}) to address ${nwl._address}`, tokenData.invokation);

  return world;
}

async function verifyXVS(
  world: World,
  nwl: XVS,
  apiKey: string,
  modelName: string,
  contractName: string,
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, nwl._address);
  }

  return world;
}

async function approve(world: World, from: string, nwl: XVS, address: string, amount: NumberV): Promise<World> {
  const invokation = await invoke(world, nwl.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(world, `Approved XVS token for ${from} of ${amount.show()}`, invokation);

  return world;
}

async function transfer(world: World, from: string, nwl: XVS, address: string, amount: NumberV): Promise<World> {
  const invokation = await invoke(world, nwl.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(world, `Transferred ${amount.show()} XVS tokens from ${from} to ${address}`, invokation);

  return world;
}

async function transferFrom(
  world: World,
  from: string,
  nwl: XVS,
  owner: string,
  spender: string,
  amount: NumberV,
): Promise<World> {
  const invokation = await invoke(
    world,
    nwl.methods.transferFrom(owner, spender, amount.encode()),
    from,
    NoErrorReporter,
  );

  world = addAction(world, `"Transferred from" ${amount.show()} XVS tokens from ${owner} to ${spender}`, invokation);

  return world;
}

async function transferScenario(
  world: World,
  from: string,
  nwl: XVSScenario,
  addresses: string[],
  amount: NumberV,
): Promise<World> {
  const invokation = await invoke(
    world,
    nwl.methods.transferScenario(addresses, amount.encode()),
    from,
    NoErrorReporter,
  );

  world = addAction(world, `Transferred ${amount.show()} XVS tokens from ${from} to ${addresses}`, invokation);

  return world;
}

async function transferFromScenario(
  world: World,
  from: string,
  nwl: XVSScenario,
  addresses: string[],
  amount: NumberV,
): Promise<World> {
  const invokation = await invoke(
    world,
    nwl.methods.transferFromScenario(addresses, amount.encode()),
    from,
    NoErrorReporter,
  );

  world = addAction(world, `Transferred ${amount.show()} XVS tokens from ${addresses} to ${from}`, invokation);

  return world;
}

async function delegate(world: World, from: string, nwl: XVS, account: string): Promise<World> {
  const invokation = await invoke(world, nwl.methods.delegate(account), from, NoErrorReporter);

  world = addAction(world, `"Delegated from" ${from} to ${account}`, invokation);

  return world;
}

async function setBlockNumber(world: World, from: string, nwl: XVS, blockNumber: NumberV): Promise<World> {
  return addAction(
    world,
    `Set XVS blockNumber to ${blockNumber.show()}`,
    await invoke(world, nwl.methods.setBlockNumber(blockNumber.encode()), from),
  );
}

export function nwlCommands() {
  return [
    new Command<{ params: EventV }>(
      `
        #### Deploy

        * "Deploy ...params" - Generates a new XVS token
          * E.g. "XVS Deploy"
      `,
      "Deploy",
      [new Arg("params", getEventV, { variadic: true })],
      (world, from, { params }) => genXVS(world, from, params.val),
    ),

    new View<{ nwl: XVS; apiKey: StringV; contractName: StringV }>(
      `
        #### Verify

        * "<XVS> Verify apiKey:<String> contractName:<String>=XVS" - Verifies XVS token in BscScan
          * E.g. "XVS Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("nwl", getXVS, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("XVS") }),
      ],
      async (world, { nwl, apiKey, contractName }) => {
        return await verifyXVS(world, nwl, apiKey.val, nwl.name, contractName.val);
      },
    ),

    new Command<{ nwl: XVS; spender: AddressV; amount: NumberV }>(
      `
        #### Approve

        * "XVS Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "XVS Approve Geoff 1.0e18"
      `,
      "Approve",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("spender", getAddressV), new Arg("amount", getNumberV)],
      (world, from, { nwl, spender, amount }) => {
        return approve(world, from, nwl, spender.val, amount);
      },
    ),

    new Command<{ nwl: XVS; recipient: AddressV; amount: NumberV }>(
      `
        #### Transfer

        * "XVS Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "XVS Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("recipient", getAddressV), new Arg("amount", getNumberV)],
      (world, from, { nwl, recipient, amount }) => transfer(world, from, nwl, recipient.val, amount),
    ),

    new Command<{ nwl: XVS; owner: AddressV; spender: AddressV; amount: NumberV }>(
      `
        #### TransferFrom

        * "XVS TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "XVS TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("nwl", getXVS, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV),
      ],
      (world, from, { nwl, owner, spender, amount }) => transferFrom(world, from, nwl, owner.val, spender.val, amount),
    ),

    new Command<{ nwl: XVSScenario; recipients: AddressV[]; amount: NumberV }>(
      `
        #### TransferScenario

        * "XVS TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "XVS TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("nwl", getXVS, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV),
      ],
      (world, from, { nwl, recipients, amount }) =>
        transferScenario(
          world,
          from,
          nwl,
          recipients.map(recipient => recipient.val),
          amount,
        ),
    ),

    new Command<{ nwl: XVSScenario; froms: AddressV[]; amount: NumberV }>(
      `
        #### TransferFromScenario

        * "XVS TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "XVS TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("nwl", getXVS, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV),
      ],
      (world, from, { nwl, froms, amount }) =>
        transferFromScenario(
          world,
          from,
          nwl,
          froms.map(_from => _from.val),
          amount,
        ),
    ),

    new Command<{ nwl: XVS; account: AddressV }>(
      `
        #### Delegate

        * "XVS Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "XVS Delegate Torrey"
      `,
      "Delegate",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV)],
      (world, from, { nwl, account }) => delegate(world, from, nwl, account.val),
    ),
    new Command<{ nwl: XVS; blockNumber: NumberV }>(
      `
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the XVS Harness
      * E.g. "XVS SetBlockNumber 500"
      `,
      "SetBlockNumber",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("blockNumber", getNumberV)],
      (world, from, { nwl, blockNumber }) => setBlockNumber(world, from, nwl, blockNumber),
    ),
  ];
}

export async function processXVSEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("XVS", nwlCommands(), world, event, from);
}
