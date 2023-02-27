import { Arg, Fetcher, getFetcherValue } from "../Command";
import { getContract, getTestContract } from "../Contract";
import {
  VBep20Delegator as IVBep20Delegator,
  VBep20DelegatorScenario as IVBep20DelegatorScenario,
} from "../Contract/VBep20Delegator";
import { NToken } from "../Contract/NToken";
import { getAddressV, getExpNumberV, getNumberV, getStringV } from "../CoreValue";
import { Event } from "../Event";
import { Invokation } from "../Invokation";
import { storeAndSaveContract } from "../Networks";
import { AddressV, NumberV, StringV } from "../Value";
import { World } from "../World";

const VBep20Contract = getContract("VBep20Immutable");
const VBep20Delegator = getContract("VBep20Delegator");
const VBep20DelegatorScenario = getTestContract("VBep20DelegatorScenario");
const VBNBContract = getContract("VBNB");
const VBep20ScenarioContract = getTestContract("VBep20Scenario");
const VBNBScenarioContract = getTestContract("VBNBScenario");
const CEvilContract = getTestContract("VEvil");

export interface TokenData {
  invokation: Invokation<NToken>;
  name: string;
  symbol: string;
  decimals?: number;
  underlying?: string;
  address?: string;
  contract: string;
  initial_exchange_rate_mantissa?: string;
  admin?: string;
}

export async function buildNToken(
  world: World,
  from: string,
  params: Event,
): Promise<{ world: World; vToken: NToken; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
        admin: AddressV;
        implementation: AddressV;
        becomeImplementationData: StringV;
      },
      TokenData
    >(
      `
      #### VBep20Delegator

      * "VBep20Delegator symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address> implementation:<Address> becomeImplementationData:<String>" - The real deal NToken
        * E.g. "NToken Deploy VBep20Delegator vDAI \"Narwhal DAI\" (Bep20 DAI Address) (Comptroller Address) (InterestRateModel Address) 1.0 8 Geoff (NToken VDaiDelegate Address) "0x0123434anyByTes314535q" "
    `,
      "VBep20Delegator",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
        new Arg("implementation", getAddressV),
        new Arg("becomeImplementationData", getStringV),
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          comptroller,
          interestRateModel,
          initialExchangeRate,
          decimals,
          admin,
          implementation,
          becomeImplementationData,
        },
      ) => {
        return {
          invokation: await VBep20Delegator.deploy<IVBep20Delegator>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            implementation.val,
            becomeImplementationData.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: "VBep20Delegator",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
        admin: AddressV;
        implementation: AddressV;
        becomeImplementationData: StringV;
      },
      TokenData
    >(
      `
      #### VBep20DelegatorScenario

      * "VBep20DelegatorScenario symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address> implementation:<Address> becomeImplementationData:<String>" - A NToken Scenario for local testing
        * E.g. "NToken Deploy VBep20DelegatorScenario vDAI \"Narwhal DAI\" (Bep20 DAI Address) (Comptroller Address) (InterestRateModel Address) 1.0 8 Geoff (NToken VDaiDelegate Address) "0x0123434anyByTes314535q" "
    `,
      "VBep20DelegatorScenario",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
        new Arg("implementation", getAddressV),
        new Arg("becomeImplementationData", getStringV),
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          comptroller,
          interestRateModel,
          initialExchangeRate,
          decimals,
          admin,
          implementation,
          becomeImplementationData,
        },
      ) => {
        return {
          invokation: await VBep20DelegatorScenario.deploy<IVBep20DelegatorScenario>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            implementation.val,
            becomeImplementationData.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: "VBep20DelegatorScenario",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
        admin: AddressV;
      },
      TokenData
    >(
      `
        #### Scenario

        * "Scenario symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A NToken Scenario for local testing
          * E.g. "NToken Deploy Scenario vZRX \"Narwhal ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "Scenario",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (
        world,
        { symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin },
      ) => {
        return {
          invokation: await VBep20ScenarioContract.deploy<NToken>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: "VBep20Scenario",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        admin: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
      },
      TokenData
    >(
      `
        #### VBNBScenario

        * "VBNBScenario symbol:<String> name:<String> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A NToken Scenario for local testing
          * E.g. "NToken Deploy VBNBScenario vBNB \"Narwhal BNB\" (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "VBNBScenario",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (world, { symbol, name, comptroller, interestRateModel, initialExchangeRate, decimals, admin }) => {
        return {
          invokation: await VBNBScenarioContract.deploy<NToken>(world, from, [
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: "VBNBScenario",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        admin: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
      },
      TokenData
    >(
      `
        #### VBNB

        * "VBNB symbol:<String> name:<String> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A NToken Scenario for local testing
          * E.g. "NToken Deploy VBNB vBNB \"Narwhal BNB\" (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "VBNB",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (world, { symbol, name, comptroller, interestRateModel, initialExchangeRate, decimals, admin }) => {
        return {
          invokation: await VBNBContract.deploy<NToken>(world, from, [
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: "VBNB",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        admin: AddressV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
      },
      TokenData
    >(
      `
        #### VBep20

        * "VBep20 symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A official NToken contract
          * E.g. "NToken Deploy VBep20 vZRX \"Narwhal ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "VBep20",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (
        world,
        { symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin },
      ) => {
        return {
          invokation: await VBep20Contract.deploy<NToken>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: "VBep20",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        admin: AddressV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
      },
      TokenData
    >(
      `
        #### VEvil

        * "VEvil symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A malicious NToken contract
          * E.g. "NToken Deploy VEvil vEVL \"Narwhal EVL\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "VEvil",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (
        world,
        { symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin },
      ) => {
        return {
          invokation: await CEvilContract.deploy<NToken>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: "VEvil",
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val,
        };
      },
    ),

    new Fetcher<
      {
        symbol: StringV;
        name: StringV;
        decimals: NumberV;
        admin: AddressV;
        underlying: AddressV;
        comptroller: AddressV;
        interestRateModel: AddressV;
        initialExchangeRate: NumberV;
      },
      TokenData
    >(
      `
        #### Standard

        * "symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A official NToken contract
          * E.g. "NToken Deploy Standard vZRX \"Narwhal ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "Standard",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV),
        new Arg("underlying", getAddressV),
        new Arg("comptroller", getAddressV),
        new Arg("interestRateModel", getAddressV),
        new Arg("initialExchangeRate", getExpNumberV),
        new Arg("decimals", getNumberV),
        new Arg("admin", getAddressV),
      ],
      async (
        world,
        { symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin },
      ) => {
        // Note: we're going to use the scenario contract as the standard deployment on local networks
        if (world.isLocalNetwork()) {
          return {
            invokation: await VBep20ScenarioContract.deploy<NToken>(world, from, [
              underlying.val,
              comptroller.val,
              interestRateModel.val,
              initialExchangeRate.val,
              name.val,
              symbol.val,
              decimals.val,
              admin.val,
            ]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: "VBep20Scenario",
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            admin: admin.val,
          };
        } else {
          return {
            invokation: await VBep20Contract.deploy<NToken>(world, from, [
              underlying.val,
              comptroller.val,
              interestRateModel.val,
              initialExchangeRate.val,
              name.val,
              symbol.val,
              decimals.val,
              admin.val,
            ]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: "VBep20Immutable",
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            admin: admin.val,
          };
        }
      },
      { catchall: true },
    ),
  ];

  const tokenData = await getFetcherValue<any, TokenData>("DeployNToken", fetchers, world, params);
  const invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const vToken = invokation.value!;
  tokenData.address = vToken._address;

  world = await storeAndSaveContract(world, vToken, tokenData.symbol, invokation, [
    { index: ["vTokens", tokenData.symbol], data: tokenData },
    { index: ["Tokens", tokenData.symbol], data: tokenData },
  ]);

  return { world, vToken, tokenData };
}
