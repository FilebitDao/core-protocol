import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { Signer } from "ethers";
import { ethers, network } from "hardhat";

import { XVS, XVSStore, XVSVault, XVSVault__factory } from "../../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

let root: Signer;
let nwlVault: MockContract<XVSVault>;

const typedData = (delegatee: string, nonce: number, expiry: number, vaultAddress: string) => ({
  types: {
    Delegation: [
      { name: "delegatee", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
  },
  primaryType: "Delegation",
  domain: {
    name: "XVS Vault",
    chainId: 1, // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    verifyingContract: vaultAddress,
  },
  message: { delegatee, nonce, expiry },
});

type XVSVaultFixture = {
  nwlVault: MockContract<XVSVault>;
  nwlStore: FakeContract<XVSStore>;
  nwlToken: FakeContract<XVS>;
};

async function nwlVaultFixture(): Promise<XVSVaultFixture> {
  const XVSVault = await smock.mock<XVSVault__factory>("NWLVault");
  const nwlVault = await XVSVault.deploy();
  const nwlStore = await smock.fake<XVSStore>("XVSStore");
  const nwlToken = await smock.fake<XVS>("XVS");
  return { nwlVault, nwlStore, nwlToken };
}

describe("XVS Vault Tests", () => {
  let rootAddress: string;

  beforeEach(async () => {
    [root] = await ethers.getSigners();
    rootAddress = await root.getAddress();
    const contracts = await loadFixture(nwlVaultFixture);
    ({ nwlVault } = contracts);
  });

  describe("delegateBySig", () => {
    it("reverts if the signatory is invalid", async () => {
      const signatureLike = await network.provider.send("eth_signTypedData_v4", [
        rootAddress,
        typedData(rootAddress, 0, 0, nwlVault.address),
      ]);
      const signature = ethers.utils.splitSignature(signatureLike);

      await expect(
        nwlVault.delegateBySig(
          rootAddress,
          0,
          0,
          signature.v,
          ethers.utils.formatBytes32String("r"),
          ethers.utils.formatBytes32String("s"),
        ),
      ).to.be.revertedWith("ECDSA: invalid signature");
    });
    it("reverts if the nonce is bad ", async () => {
      const signatureLike = await network.provider.send("eth_signTypedData_v4", [
        rootAddress,
        typedData(rootAddress, 1, 1, nwlVault.address),
      ]);
      const signature = ethers.utils.splitSignature(signatureLike);

      await expect(nwlVault.delegateBySig(rootAddress, 1, 0, signature.v, signature.r, signature.s)).to.be.revertedWith(
        "NWLVault::delegateBySig: invalid nonce",
      );
    });
    it("reverts if the signature has expired", async () => {
      const signatureLike = await network.provider.send("eth_signTypedData_v4", [
        rootAddress,
        typedData(rootAddress, 1, 1, nwlVault.address),
      ]);
      const signature = ethers.utils.splitSignature(signatureLike);

      await expect(nwlVault.delegateBySig(rootAddress, 0, 0, signature.v, signature.r, signature.s)).to.be.revertedWith(
        "NWLVault::delegateBySig: signature expired",
      );
    });
    // NOTE: Couldn't mock any mapping with address as a key using smock
    // TODO: investigate why we couldn't mock this
    // it("delegates on behalf of the signatory", async () => {
    //   const nwlAddress = nwlToken.address;

    //   await nwlVault.setVariable("nwlAddress", nwlToken.address);
    //   await nwlVault.setVariable("nwlStore", nwlStore.address);
    //   await nwlVault.add(nwlAddress,100,nwlAddress,10,100);

    //   await nwlVault.deposit(nwlAddress,0,100);

    //   await nwlVault.setVariable('userInfos',[{
    // 	nwlAddress: {
    // 		0: {
    // 			rootAddress: {
    // 				amount: 100,
    // 				rewardDebt: 10,
    // 				pendingWithdrawals: 10
    // 			}
    // 		}
    // 	}
    // }
    // ]);
    //   const customerAddress = await customer.getAddress();
    //   const signatureLike = await network.provider.send(
    //     "eth_signTypedData_v4",
    //     [rootAddress, typedData(customerAddress, 1, 10e9, nwlVault.address)]
    //   );
    //   const signature = ethers.utils.splitSignature(signatureLike);

    //   expect(await nwlVault.delegates(customerAddress)).to.equal(
    //     ethers.constants.AddressZero
    //   );
    //   //TODO: add gas used when smock has this feature
    //   //   expect(tx.gasUsed < 80000);

    //   await nwlVault.delegateBySig(
    //     customerAddress,
    //     0,
    //     10e9,
    //     signature.v,
    //     signature.r,
    //     signature.s
    //   );
    //   expect(await nwlVault.delegates(customerAddress)).to.equal(
    //     customerAddress
    //   );
    //   //   expect(await call(nwlVault, "delegates", [a1])).toEqual(root);
    // });
  });
});
