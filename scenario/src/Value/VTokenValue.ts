import { Arg, Fetcher, getFetcherValue } from "../Command";
import { VBep20Delegator } from "../Contract/VBep20Delegator";
import { NToken } from "../Contract/NToken";
import { getNTokenAddress, getWorldContractByAddress } from "../ContractLookup";
import { getAddressV, getCoreValue, getStringV, mapValue } from "../CoreValue";
import { Event } from "../Event";
import { AddressV, NumberV, StringV, Value } from "../Value";
import { World } from "../World";

export async function getNTokenV(world: World, event: Event): Promise<NToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    str => new AddressV(getNTokenAddress(world, str)),
    getCoreValue,
    AddressV,
  );

  return getWorldContractByAddress<NToken>(world, address.val);
}

export async function getVBep20DelegatorV(world: World, event: Event): Promise<VBep20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    str => new AddressV(getNTokenAddress(world, str)),
    getCoreValue,
    AddressV,
  );

  return getWorldContractByAddress<VBep20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(await vToken.methods.interestRateModel().call());
}

async function vTokenAddress(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(vToken._address);
}

async function getNTokenAdmin(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(await vToken.methods.admin().call());
}

async function getNTokenPendingAdmin(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(await vToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, vToken: NToken, user: string): Promise<NumberV> {
  return new NumberV(await vToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, vToken: NToken, user): Promise<NumberV> {
  return new NumberV(await vToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, vToken: NToken, user): Promise<NumberV> {
  return new NumberV(await vToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.totalReserves().call());
}

async function getComptroller(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(await vToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.getCash().call());
}

async function getInterestRate(world: World, vToken: NToken): Promise<NumberV> {
  return new NumberV(await vToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, vToken: NToken): Promise<AddressV> {
  return new AddressV(await (vToken as VBep20Delegator).methods.implementation().call());
}

export function vTokenFetchers() {
  return [
    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### Address

        * "NToken <NToken> Address" - Returns address of NToken contract
          * E.g. "NToken vZRX Address" - Returns vZRX's address
      `,
      "Address",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => vTokenAddress(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### InterestRateModel

        * "NToken <NToken> InterestRateModel" - Returns the interest rate model of NToken contract
          * E.g. "NToken vZRX InterestRateModel" - Returns vZRX's interest rate model
      `,
      "InterestRateModel",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getInterestRateModel(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### Admin

        * "NToken <NToken> Admin" - Returns the admin of NToken contract
          * E.g. "NToken vZRX Admin" - Returns vZRX's admin
      `,
      "Admin",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getNTokenAdmin(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### PendingAdmin

        * "NToken <NToken> PendingAdmin" - Returns the pending admin of NToken contract
          * E.g. "NToken vZRX PendingAdmin" - Returns vZRX's pending admin
      `,
      "PendingAdmin",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getNTokenPendingAdmin(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### Underlying

        * "NToken <NToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "NToken vZRX Underlying"
      `,
      "Underlying",
      [new Arg("vToken", getNTokenV)],
      async (world, { vToken }) => new AddressV(await vToken.methods.underlying().call()),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken; address: AddressV }, NumberV>(
      `
        #### UnderlyingBalance

        * "NToken <NToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "NToken vZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [new Arg("vToken", getNTokenV), new Arg<AddressV>("address", getAddressV)],
      (world, { vToken, address }) => balanceOfUnderlying(world, vToken, address.val),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken; address: AddressV }, NumberV>(
      `
        #### BorrowBalance

        * "NToken <NToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "NToken vZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [new Arg("vToken", getNTokenV), new Arg("address", getAddressV)],
      (world, { vToken, address }) => getBorrowBalance(world, vToken, address.val),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken; address: AddressV }, NumberV>(
      `
        #### BorrowBalanceStored

        * "NToken <NToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "NToken vZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [new Arg("vToken", getNTokenV), new Arg("address", getAddressV)],
      (world, { vToken, address }) => getBorrowBalanceStored(world, vToken, address.val),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### TotalBorrows

        * "NToken <NToken> TotalBorrows" - Returns the vToken's total borrow balance
          * E.g. "NToken vZRX TotalBorrows"
      `,
      "TotalBorrows",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getTotalBorrows(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### TotalBorrowsCurrent

        * "NToken <NToken> TotalBorrowsCurrent" - Returns the vToken's total borrow balance with interest
          * E.g. "NToken vZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getTotalBorrowsCurrent(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### Reserves

        * "NToken <NToken> Reserves" - Returns the vToken's total reserves
          * E.g. "NToken vZRX Reserves"
      `,
      "Reserves",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getTotalReserves(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### ReserveFactor

        * "NToken <NToken> ReserveFactor" - Returns reserve factor of NToken contract
          * E.g. "NToken vZRX ReserveFactor" - Returns vZRX's reserve factor
      `,
      "ReserveFactor",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getReserveFactor(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### Comptroller

        * "NToken <NToken> Comptroller" - Returns the vToken's comptroller
          * E.g. "NToken vZRX Comptroller"
      `,
      "Comptroller",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getComptroller(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### ExchangeRateStored

        * "NToken <NToken> ExchangeRateStored" - Returns the vToken's exchange rate (based on balances stored)
          * E.g. "NToken vZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getExchangeRateStored(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### ExchangeRate

        * "NToken <NToken> ExchangeRate" - Returns the vToken's current exchange rate
          * E.g. "NToken vZRX ExchangeRate"
      `,
      "ExchangeRate",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getExchangeRate(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### Cash

        * "NToken <NToken> Cash" - Returns the vToken's current cash
          * E.g. "NToken vZRX Cash"
      `,
      "Cash",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getCash(world, vToken),
      { namePos: 1 },
    ),

    new Fetcher<{ vToken: NToken }, NumberV>(
      `
        #### InterestRate

        * "NToken <NToken> InterestRate" - Returns the vToken's current interest rate
          * E.g. "NToken vZRX InterestRate"
      `,
      "InterestRate",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getInterestRate(world, vToken),
      { namePos: 1 },
    ),
    new Fetcher<{ vToken: NToken; signature: StringV }, NumberV>(
      `
        #### CallNum

        * "NToken <NToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "NToken vZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [new Arg("vToken", getNTokenV), new Arg("signature", getStringV)],
      async (world, { vToken, signature }) => {
        const res = await world.web3.eth.call({
          to: vToken._address,
          data: world.web3.eth.abi.encodeFunctionSignature(signature.val),
        });
        const resNum: any = world.web3.eth.abi.decodeParameter("uint256", res);
        return new NumberV(resNum);
      },
      { namePos: 1 },
    ),
    new Fetcher<{ vToken: NToken }, AddressV>(
      `
        #### Implementation

        * "NToken <NToken> Implementation" - Returns the vToken's current implementation
          * E.g. "NToken vDAI Implementation"
      `,
      "Implementation",
      [new Arg("vToken", getNTokenV)],
      (world, { vToken }) => getImplementation(world, vToken),
      { namePos: 1 },
    ),
  ];
}

export async function getNTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("vToken", vTokenFetchers(), world, event);
}
