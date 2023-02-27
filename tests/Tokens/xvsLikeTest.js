const { makeNToken, setMarketSupplyCap } = require("../Utils/Narwhal");

describe("VNwlLikeDelegate", function () {
  describe("_delegateNwlLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts; // eslint-disable-line @typescript-eslint/no-unused-vars
      const vToken = await makeNToken({ kind: "vnwl" });
      await setMarketSupplyCap(vToken.comptroller, [vToken._address], [100000000000]);
      await expect(send(vToken, "_delegateNwlLikeTo", [a1], { from: a1 })).rejects.toRevert(
        "revert only the admin may set the nwl-like delegate",
      );
    });

    it("delegates successfully if the admin", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [root, a1] = saddle.accounts,
        amount = 1;
      const vXVS = await makeNToken({ kind: "vnwl" }),
        XVS = vXVS.underlying;
      await send(vXVS, "_delegateNwlLikeTo", [a1]);
      await send(XVS, "transfer", [vXVS._address, amount]);
      await expect(await call(XVS, "getCurrentVotes", [a1])).toEqualNumber(amount);
    });
  });
});
