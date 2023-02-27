import { Fetcher, getFetcherValue } from "../Command";
import { getContract } from "../Contract";
import { XVSVaultProxy } from "../Contract/XVSVault";
import { Event } from "../Event";
import { Invokation } from "../Invokation";
import { storeAndSaveContract } from "../Networks";
import { World } from "../World";

const XVSVaultProxyContract = getContract("XVSVaultProxy");

export interface XVSVaultProxyData {
  invokation: Invokation<XVSVaultProxy>;
  name: string;
  contract: string;
  address?: string;
}

export async function buildXVSVaultProxy(
  world: World,
  from: string,
  params: Event,
): Promise<{ world: World; nwlVaultProxy: XVSVaultProxy; nwlVaultData: XVSVaultProxyData }> {
  const fetchers = [
    new Fetcher<Record<string, any>, XVSVaultProxyData>(
      `
      #### XVSVaultProxy
      * "XVSVaultProxy Deploy" - Deploys XVS Vault proxy contract
      * E.g. "XVSVaultProxy Deploy"
      `,
      "XVSVaultProxy",
      [],
      async world => {
        return {
          invokation: await XVSVaultProxyContract.deploy<XVSVaultProxy>(world, from, []),
          name: "XVSVaultProxy",
          contract: "XVSVaultProxy",
        };
      },
      { catchall: true },
    ),
  ];

  const nwlVaultData = await getFetcherValue<any, XVSVaultProxyData>("DeployXVSVaultProxy", fetchers, world, params);
  const invokation = nwlVaultData.invokation!;
  delete nwlVaultData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const nwlVaultProxy = invokation.value!;
  nwlVaultData.address = nwlVaultProxy._address;

  world = await storeAndSaveContract(world, nwlVaultProxy, nwlVaultData.name, invokation, [
    { index: ["XVSVaultProxy", nwlVaultData.name], data: nwlVaultData },
  ]);

  return { world, nwlVaultProxy, nwlVaultData };
}
