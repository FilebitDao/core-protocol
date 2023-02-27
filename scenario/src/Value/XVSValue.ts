import { Arg, Fetcher, getFetcherValue } from "../Command";
import { XVS } from "../Contract/XVS";
import { getXVS } from "../ContractLookup";
import { getAddressV, getNumberV } from "../CoreValue";
import { Event } from "../Event";
import { AddressV, ListV, NumberV, StringV, Value } from "../Value";
import { World } from "../World";

export function nwlFetchers() {
  return [
    new Fetcher<{ nwl: XVS }, AddressV>(
      `
        #### Address

        * "<XVS> Address" - Returns the address of XVS token
          * E.g. "XVS Address"
      `,
      "Address",
      [new Arg("nwl", getXVS, { implicit: true })],
      async (world, { nwl }) => new AddressV(nwl._address),
    ),

    new Fetcher<{ nwl: XVS }, StringV>(
      `
        #### Name

        * "<XVS> Name" - Returns the name of the XVS token
          * E.g. "XVS Name"
      `,
      "Name",
      [new Arg("nwl", getXVS, { implicit: true })],
      async (world, { nwl }) => new StringV(await nwl.methods.name().call()),
    ),

    new Fetcher<{ nwl: XVS }, StringV>(
      `
        #### Symbol

        * "<XVS> Symbol" - Returns the symbol of the XVS token
          * E.g. "XVS Symbol"
      `,
      "Symbol",
      [new Arg("nwl", getXVS, { implicit: true })],
      async (world, { nwl }) => new StringV(await nwl.methods.symbol().call()),
    ),

    new Fetcher<{ nwl: XVS }, NumberV>(
      `
        #### Decimals

        * "<XVS> Decimals" - Returns the number of decimals of the XVS token
          * E.g. "XVS Decimals"
      `,
      "Decimals",
      [new Arg("nwl", getXVS, { implicit: true })],
      async (world, { nwl }) => new NumberV(await nwl.methods.decimals().call()),
    ),

    new Fetcher<{ nwl: XVS }, NumberV>(
      `
        #### TotalSupply

        * "XVS TotalSupply" - Returns XVS token's total supply
      `,
      "TotalSupply",
      [new Arg("nwl", getXVS, { implicit: true })],
      async (world, { nwl }) => new NumberV(await nwl.methods.totalSupply().call()),
    ),

    new Fetcher<{ nwl: XVS; address: AddressV }, NumberV>(
      `
        #### TokenBalance

        * "XVS TokenBalance <Address>" - Returns the XVS token balance of a given address
          * E.g. "XVS TokenBalance Geoff" - Returns Geoff's XVS balance
      `,
      "TokenBalance",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("address", getAddressV)],
      async (world, { nwl, address }) => new NumberV(await nwl.methods.balanceOf(address.val).call()),
    ),

    new Fetcher<{ nwl: XVS; owner: AddressV; spender: AddressV }, NumberV>(
      `
        #### Allowance

        * "XVS Allowance owner:<Address> spender:<Address>" - Returns the XVS allowance from owner to spender
          * E.g. "XVS Allowance Geoff Torrey" - Returns the XVS allowance of Geoff to Torrey
      `,
      "Allowance",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("owner", getAddressV), new Arg("spender", getAddressV)],
      async (world, { nwl, owner, spender }) => new NumberV(await nwl.methods.allowance(owner.val, spender.val).call()),
    ),

    new Fetcher<{ nwl: XVS; account: AddressV }, NumberV>(
      `
        #### GetCurrentVotes

        * "XVS GetCurrentVotes account:<Address>" - Returns the current XVS votes balance for an account
          * E.g. "XVS GetCurrentVotes Geoff" - Returns the current XVS vote balance of Geoff
      `,
      "GetCurrentVotes",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV)],
      async (world, { nwl, account }) => new NumberV(await nwl.methods.getCurrentVotes(account.val).call()),
    ),

    new Fetcher<{ nwl: XVS; account: AddressV; blockNumber: NumberV }, NumberV>(
      `
        #### GetPriorVotes

        * "XVS GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current XVS votes balance at given block
          * E.g. "XVS GetPriorVotes Geoff 5" - Returns the XVS vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV), new Arg("blockNumber", getNumberV)],
      async (world, { nwl, account, blockNumber }) =>
        new NumberV(await nwl.methods.getPriorVotes(account.val, blockNumber.encode()).call()),
    ),

    new Fetcher<{ nwl: XVS; account: AddressV }, NumberV>(
      `
        #### GetCurrentVotesBlock

        * "XVS GetCurrentVotesBlock account:<Address>" - Returns the current XVS votes checkpoint block for an account
          * E.g. "XVS GetCurrentVotesBlock Geoff" - Returns the current XVS votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV)],
      async (world, { nwl, account }) => {
        const numCheckpoints = Number(await nwl.methods.numCheckpoints(account.val).call());
        const checkpoint = await nwl.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      },
    ),

    new Fetcher<{ nwl: XVS; account: AddressV }, NumberV>(
      `
        #### VotesLength

        * "XVS VotesLength account:<Address>" - Returns the XVS vote checkpoint array length
          * E.g. "XVS VotesLength Geoff" - Returns the XVS vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV)],
      async (world, { nwl, account }) => new NumberV(await nwl.methods.numCheckpoints(account.val).call()),
    ),

    new Fetcher<{ nwl: XVS; account: AddressV }, ListV>(
      `
        #### AllVotes

        * "XVS AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "XVS AllVotes Geoff" - Returns the XVS vote checkpoint array
      `,
      "AllVotes",
      [new Arg("nwl", getXVS, { implicit: true }), new Arg("account", getAddressV)],
      async (world, { nwl, account }) => {
        const numCheckpoints = Number(await nwl.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(
          new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
            const { fromBlock, votes } = await nwl.methods.checkpoints(account.val, i).call();

            return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
          }),
        );

        return new ListV(checkpoints);
      },
    ),
  ];
}

export async function getXVSValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("XVS", nwlFetchers(), world, event);
}
