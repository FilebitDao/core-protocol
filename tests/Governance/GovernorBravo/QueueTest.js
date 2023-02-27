const {
  both,
  bnbMantissa,
  encodeParameters,
  advanceBlocks,
  freezeTime,
  mineBlock,
  bnbUnsigned,
} = require("../../Utils/BSC");

describe("GovernorBravo#queue/1", () => {
  let root, a1, a2, guardian;

  async function enfranchise(nwl, nwlVault, actor, amount) {
    await send(nwlVault, "delegate", [actor], { from: actor });
    await send(nwl, "approve", [nwlVault._address, bnbMantissa(1e10)], { from: actor });
    // in test cases, we transfer enough token to actor for convenience
    await send(nwl, "transfer", [actor, bnbMantissa(amount)]);
    await send(nwlVault, "deposit", [nwl._address, 0, bnbMantissa(amount)], { from: actor });
  }

  async function makeVault(nwl, actor) {
    const nwlVault = await deploy("XVSVault", []);
    const nwlStore = await deploy("XVSStore", []);
    await send(nwlStore, "setNewOwner", [nwlVault._address], { from: actor });
    await send(nwlVault, "setNwlStore", [nwl._address, nwlStore._address], { from: actor });
    await send(nwlVault, "add", [nwl._address, 100, nwl._address, bnbUnsigned(1e16), 300], { from: actor }); // lock period 300s
    return nwlVault;
  }

  beforeAll(async () => {
    [root, a1, a2, guardian] = saddle.accounts;
  });

  describe("overlapping actions", () => {
    it("reverts on queueing overlapping actions in same proposal", async () => {
      const timelock = await deploy("TimelockHarness", [root, 86400 * 2]);
      const nwl = await deploy("XVS", [root]);
      const nwlVault = await makeVault(nwl, root);
      const gov = await deploy("GovernorBravoImmutable", [
        timelock._address,
        nwlVault._address,
        root,
        86400,
        1,
        "100000000000000000000000",
        guardian,
      ]);
      await send(gov, "_initiate");
      await send(timelock, "harnessSetAdmin", [gov._address]);

      await enfranchise(nwl, nwlVault, a1, 3e6);
      await mineBlock();

      const targets = [nwl._address, nwl._address];
      const values = ["0", "0"];
      const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
      const calldatas = [encodeParameters(["address"], [root]), encodeParameters(["address"], [root])];
      const { reply: proposalId1 } = await both(
        gov,
        "propose",
        [targets, values, signatures, calldatas, "do nothing"],
        { from: a1 },
      );
      await mineBlock();

      await send(gov, "castVote", [proposalId1, 1], { from: a1 });
      await advanceBlocks(90000);

      await expect(send(gov, "queue", [proposalId1])).rejects.toRevert(
        "revert GovernorBravo::queueOrRevertInternal: identical proposal action already queued at eta",
      );
    });

    it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
      const timelock = await deploy("TimelockHarness", [root, 86400 * 2]);
      const nwl = await deploy("XVS", [root]);
      const nwlVault = await makeVault(nwl, root);
      const gov = await deploy("GovernorBravoImmutable", [
        timelock._address,
        nwlVault._address,
        root,
        86400,
        1,
        "100000000000000000000000",
        guardian,
      ]);
      await send(gov, "_initiate");
      await send(timelock, "harnessSetAdmin", [gov._address]);

      await enfranchise(nwl, nwlVault, a1, 3e6);
      await enfranchise(nwl, nwlVault, a2, 3e6);
      await mineBlock();

      const targets = [nwl._address];
      const values = ["0"];
      const signatures = ["getBalanceOf(address)"];
      const calldatas = [encodeParameters(["address"], [root])];
      const { reply: proposalId1 } = await both(
        gov,
        "propose",
        [targets, values, signatures, calldatas, "do nothing"],
        { from: a1 },
      );
      const { reply: proposalId2 } = await both(
        gov,
        "propose",
        [targets, values, signatures, calldatas, "do nothing"],
        { from: a2 },
      );
      await mineBlock();

      await send(gov, "castVote", [proposalId1, 1], { from: a1 });
      await send(gov, "castVote", [proposalId2, 1], { from: a2 });
      await advanceBlocks(90000);
      await freezeTime(100);

      await send(gov, "queue", [proposalId1]);
      await expect(send(gov, "queue", [proposalId2])).rejects.toRevert(
        "revert GovernorBravo::queueOrRevertInternal: identical proposal action already queued at eta",
      );

      await freezeTime(101);
      await send(gov, "queue", [proposalId2]);
    });
  });
});
