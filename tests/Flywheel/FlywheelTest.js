const {
  makeComptroller,
  makeNToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint,
  enterMarkets,
  makeToken,
  setMarketSupplyCap,
} = require("../Utils/Narwhal");
const { bnbExp, bnbDouble, bnbUnsigned, bnbMantissa } = require("../Utils/BSC");

const narwhalRate = bnbUnsigned(1e18);

async function narwhalAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, "narwhalAccrued", [user]));
}

async function nwlBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.nwl, "balanceOf", [user]));
}

async function totalNarwhalAccrued(comptroller, user) {
  return (await narwhalAccrued(comptroller, user)).add(await nwlBalance(comptroller, user));
}

describe("Flywheel", () => {
  let root, a1, a2, a3;
  let comptroller, vLOW, vREP, vZRX, vEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = { borrowRate: 0.000001 };
    [root, a1, a2, a3] = saddle.accounts;
    comptroller = await makeComptroller();
    vLOW = await makeNToken({ comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts });
    await setMarketSupplyCap(vLOW.comptroller, [vLOW._address], [1e15]);
    vREP = await makeNToken({ comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts });
    await setMarketSupplyCap(vREP.comptroller, [vREP._address], [1e15]);
    vZRX = await makeNToken({ comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts });
    await setMarketSupplyCap(vZRX.comptroller, [vZRX._address], [1e15]);
    vEVIL = await makeNToken({ comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts });
    await setMarketSupplyCap(vEVIL.comptroller, [vEVIL._address], [1e15]);
  });

  describe("_grantXVS()", () => {
    beforeEach(async () => {
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });
    });

    it("should award nwl if called by admin", async () => {
      const tx = await send(comptroller, "_grantXVS", [a1, 100]);
      expect(tx).toHaveLog("NarwhalGranted", {
        recipient: a1,
        amount: 100,
      });
    });

    it("should revert if not called by admin", async () => {
      await expect(send(comptroller, "_grantXVS", [a1, 100], { from: a1 })).rejects.toRevert("revert access denied");
    });

    it("should revert if insufficient nwl", async () => {
      await expect(send(comptroller, "_grantXVS", [a1, bnbUnsigned(1e20)])).rejects.toRevert(
        "revert insufficient nwl for grant",
      );
    });
  });

  describe("getNarwhalMarkets()", () => {
    it("should return the narwhal markets", async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      }
      expect(await call(comptroller, "getNarwhalMarkets")).toEqual([vLOW, vREP, vZRX].map(c => c._address));
    });
  });

  describe("_setNarwhalSpeed()", () => {
    it("should update market index when calling setNarwhalSpeed", async () => {
      const mkt = vREP;
      await send(comptroller, "setBlockNumber", [0]);
      await send(mkt, "harnessSetTotalSupply", [bnbUnsigned(10e18)]);

      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(1)]);

      const { index, block } = await call(comptroller, "narwhalSupplyState", [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it("should correctly drop a nwl market if called by admin", async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      }
      const tx = await send(comptroller, "_setNarwhalSpeed", [vLOW._address, 0]);
      expect(await call(comptroller, "getNarwhalMarkets")).toEqual([vREP, vZRX].map(c => c._address));
      expect(tx).toHaveLog("NarwhalSpeedUpdated", {
        vToken: vLOW._address,
        newSpeed: 0,
      });
    });

    it("should correctly drop a nwl market from middle of array", async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      }
      await send(comptroller, "_setNarwhalSpeed", [vREP._address, 0]);
      expect(await call(comptroller, "getNarwhalMarkets")).toEqual([vLOW, vZRX].map(c => c._address));
    });

    it("should not drop a nwl market unless called by admin", async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      }
      await expect(send(comptroller, "_setNarwhalSpeed", [vLOW._address, 0], { from: a1 })).rejects.toRevert(
        "revert access denied",
      );
    });

    it("should not add non-listed markets", async () => {
      const vBAT = await makeNToken({ comptroller, supportMarket: false });
      await expect(send(comptroller, "harnessAddNarwhalMarkets", [[vBAT._address]])).rejects.toRevert(
        "revert market not listed",
      );

      const markets = await call(comptroller, "getNarwhalMarkets");
      expect(markets).toEqual([]);
    });
  });

  describe("updateNarwhalBorrowIndex()", () => {
    it("should calculate nwl borrower index correctly", async () => {
      const mkt = vREP;
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await send(comptroller, "setBlockNumber", [100]);
      await send(mkt, "harnessSetTotalBorrows", [bnbUnsigned(11e18)]);
      await send(comptroller, "harnessUpdateNarwhalBorrowIndex", [mkt._address, bnbExp(1.1)]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        narwhalAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + narwhalAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const { index, block } = await call(comptroller, "narwhalBorrowState", [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it("should not revert or update narwhalBorrowState index if vToken not in Narwhal markets", async () => {
      const mkt = await makeNToken({
        comptroller: comptroller,
        supportMarket: true,
        addNarwhalMarket: false,
      });
      await send(comptroller, "setBlockNumber", [100]);
      await send(comptroller, "harnessUpdateNarwhalBorrowIndex", [mkt._address, bnbExp(1.1)]);

      const { index, block } = await call(comptroller, "narwhalBorrowState", [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, "narwhalSpeeds", [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it("should not update index if no blocks passed since last accrual", async () => {
      const mkt = vREP;
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await send(comptroller, "harnessUpdateNarwhalBorrowIndex", [mkt._address, bnbExp(1.1)]);

      const { index, block } = await call(comptroller, "narwhalBorrowState", [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it("should not update index if narwhal speed is 0", async () => {
      const mkt = vREP;
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await send(comptroller, "setBlockNumber", [100]);
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0)]);
      await send(comptroller, "harnessUpdateNarwhalBorrowIndex", [mkt._address, bnbExp(1.1)]);

      const { index, block } = await call(comptroller, "narwhalBorrowState", [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe("updateNarwhalSupplyIndex()", () => {
    it("should calculate nwl supplier index correctly", async () => {
      const mkt = vREP;
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await send(comptroller, "setBlockNumber", [100]);
      await send(mkt, "harnessSetTotalSupply", [bnbUnsigned(10e18)]);
      await send(comptroller, "harnessUpdateNarwhalSupplyIndex", [mkt._address]);
      /*
        suppyTokens = 10e18
        narwhalAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += narwhalAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const { index, block } = await call(comptroller, "narwhalSupplyState", [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it("should not update index on non-Narwhal markets", async () => {
      const mkt = await makeNToken({
        comptroller: comptroller,
        supportMarket: true,
        addNarwhalMarket: false,
      });
      await send(comptroller, "setBlockNumber", [100]);
      await send(comptroller, "harnessUpdateNarwhalSupplyIndex", [mkt._address]);

      const { index, block } = await call(comptroller, "narwhalSupplyState", [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, "narwhalSpeeds", [mkt._address]);
      expect(speed).toEqualNumber(0);
      // vtoken could have no narwhal speed or nwl supplier state if not in narwhal markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it("should not update index if no blocks passed since last accrual", async () => {
      const mkt = vREP;
      await send(comptroller, "setBlockNumber", [0]);
      await send(mkt, "harnessSetTotalSupply", [bnbUnsigned(10e18)]);
      await send(comptroller, "_setNarwhalSpeed", [mkt._address, bnbExp(0.5)]);
      await send(comptroller, "harnessUpdateNarwhalSupplyIndex", [mkt._address]);

      const { index, block } = await call(comptroller, "narwhalSupplyState", [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it("should not matter if the index is updated multiple times", async () => {
      const narwhalRemaining = narwhalRate.mul(100);
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");
      await quickMint(vLOW, a2, bnbUnsigned(1e12));
      await quickMint(vLOW, a3, bnbUnsigned(15e12));

      const a2Accrued0 = await totalNarwhalAccrued(comptroller, a2);
      const a3Accrued0 = await totalNarwhalAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(vLOW, a2);
      const a3Balance0 = await balanceOf(vLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(vLOW, "transfer", [a2, a3Balance0.sub(a2Balance0)], { from: a3 });

      const a2Accrued1 = await totalNarwhalAccrued(comptroller, a2);
      const a3Accrued1 = await totalNarwhalAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(vLOW, a2);
      const a3Balance1 = await balanceOf(vLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, "harnessUpdateNarwhalSupplyIndex", [vLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(vLOW, "transfer", [a3, a2Balance1.sub(a3Balance1)], { from: a2 });

      const a2Accrued2 = await totalNarwhalAccrued(comptroller, a2);
      const a3Accrued2 = await totalNarwhalAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(220000);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe("distributeBorrowerNarwhal()", () => {
    it("should update borrow index checkpoint but not narwhalAccrued for first time user", async () => {
      const mkt = vREP;
      await send(comptroller, "setNarwhalBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setNarwhalBorrowerIndex", [mkt._address, root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerNarwhal", [mkt._address, root, bnbExp(1.1)]);
      expect(await call(comptroller, "narwhalAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "narwhalBorrowerIndex", [mkt._address, root])).toEqualNumber(6e36);
    });

    it("should transfer nwl and update borrow index checkpoint correctly for repeat time user", async () => {
      const mkt = vREP;
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e18), bnbExp(1)]);
      await send(comptroller, "setNarwhalBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setNarwhalBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 narwhalBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 XVS
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerNarwhal", [mkt._address, a1, bnbUnsigned(1.1e18)]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog("DistributedBorrowerNarwhal", {
        vToken: mkt._address,
        borrower: a1,
        narwhalDelta: bnbUnsigned(25e18).toFixed(),
        narwhalBorrowIndex: bnbDouble(6).toFixed(),
      });
    });

    it("should not transfer nwl automatically", async () => {
      const mkt = vREP;
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e17), bnbExp(1)]);
      await send(comptroller, "setNarwhalBorrowState", [mkt._address, bnbDouble(1.0019), 10]);
      await send(comptroller, "setNarwhalBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < narwhalClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerNarwhal", [mkt._address, a1, bnbExp(1.1)]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);
    });

    it("should not revert or distribute when called with non-Narwhal market", async () => {
      const mkt = await makeNToken({
        comptroller: comptroller,
        supportMarket: true,
        addNarwhalMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerNarwhal", [mkt._address, a1, bnbExp(1.1)]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, "narwhalBorrowerIndex", [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe("distributeSupplierNarwhal()", () => {
    it("should transfer nwl and update supply index correctly for first time user", async () => {
      const mkt = vREP;
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setNarwhalSupplyState", [mkt._address, bnbDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 narwhalSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 XVS:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierNarwhal", [mkt._address, a1]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog("DistributedSupplierNarwhal", {
        vToken: mkt._address,
        supplier: a1,
        narwhalDelta: bnbUnsigned(25e18).toFixed(),
        narwhalSupplyIndex: bnbDouble(6).toFixed(),
      });
    });

    it("should update nwl accrued and supply index for repeat user", async () => {
      const mkt = vREP;
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setNarwhalSupplyState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setNarwhalSupplierIndex", [mkt._address, a1, bnbDouble(2)]);
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierNarwhal", [mkt._address, a1]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it("should not transfer when narwhalAccrued below threshold", async () => {
      const mkt = vREP;
      await send(comptroller.nwl, "transfer", [comptroller._address, bnbUnsigned(50e18)], { from: root });

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "setNarwhalSupplyState", [mkt._address, bnbDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierNarwhal", [mkt._address, a1]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);
    });

    it("should not revert or distribute when called with non-Narwhal market", async () => {
      const mkt = await makeNToken({
        comptroller: comptroller,
        supportMarket: true,
        addNarwhalMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierNarwhal", [mkt._address, a1]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, "narwhalBorrowerIndex", [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe("transferXVS", () => {
    it("should transfer nwl accrued when amount is above threshold", async () => {
      const narwhalRemaining = 1000,
        a1AccruedPre = 100,
        threshold = 1;
      const nwlBalancePre = await nwlBalance(comptroller, a1);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, a1AccruedPre]);
      await send(comptroller, "harnessTransferNarwhal", [a1, a1AccruedPre, threshold]);
      await narwhalAccrued(comptroller, a1);
      const nwlBalancePost = await nwlBalance(comptroller, a1);
      expect(nwlBalancePre).toEqualNumber(0);
      expect(nwlBalancePost).toEqualNumber(a1AccruedPre);
    });

    it("should not transfer when nwl accrued is below threshold", async () => {
      const narwhalRemaining = 1000,
        a1AccruedPre = 100,
        threshold = 101;
      const nwlBalancePre = await call(comptroller.nwl, "balanceOf", [a1]);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, a1AccruedPre]);
      await send(comptroller, "harnessTransferNarwhal", [a1, a1AccruedPre, threshold]);
      await narwhalAccrued(comptroller, a1);
      const nwlBalancePost = await nwlBalance(comptroller, a1);
      expect(nwlBalancePre).toEqualNumber(0);
      expect(nwlBalancePost).toEqualNumber(0);
    });

    it("should not transfer nwl if nwl accrued is greater than nwl remaining", async () => {
      const narwhalRemaining = 99,
        a1AccruedPre = 100,
        threshold = 1;
      const nwlBalancePre = await nwlBalance(comptroller, a1);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, a1AccruedPre]);
      await send(comptroller, "harnessTransferNarwhal", [a1, a1AccruedPre, threshold]);
      await narwhalAccrued(comptroller, a1);
      const nwlBalancePost = await nwlBalance(comptroller, a1);
      expect(nwlBalancePre).toEqualNumber(0);
      expect(nwlBalancePost).toEqualNumber(0);
    });
  });

  describe("claimNarwhal", () => {
    it("should accrue nwl and then transfer nwl accrued", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        mintAmount = bnbUnsigned(12e12),
        deltaBlocks = 10;
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, "_setNarwhalSpeed", [vLOW._address, bnbExp(0.5)]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");
      const speed = await call(comptroller, "narwhalSpeeds", [vLOW._address]);
      const a2AccruedPre = await narwhalAccrued(comptroller, a2);
      const nwlBalancePre = await nwlBalance(comptroller, a2);
      await quickMint(vLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, "claimNarwhal", [a2]);
      const a2AccruedPost = await narwhalAccrued(comptroller, a2);
      const nwlBalancePost = await nwlBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(narwhalRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(nwlBalancePre).toEqualNumber(0);
      expect(nwlBalancePost).toEqualNumber(narwhalRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it("should accrue nwl and then transfer nwl accrued in a single market", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        mintAmount = bnbUnsigned(12e12),
        deltaBlocks = 10;
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");
      const speed = await call(comptroller, "narwhalSpeeds", [vLOW._address]);
      const a2AccruedPre = await narwhalAccrued(comptroller, a2);
      const nwlBalancePre = await nwlBalance(comptroller, a2);
      await quickMint(vLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, "claimNarwhal", [a2, [vLOW._address]]);
      const a2AccruedPost = await narwhalAccrued(comptroller, a2);
      const nwlBalancePost = await nwlBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(220000);
      expect(speed).toEqualNumber(narwhalRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(nwlBalancePre).toEqualNumber(0);
      expect(nwlBalancePost).toEqualNumber(narwhalRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it("should claim when nwl accrued is below threshold", async () => {
      const narwhalRemaining = bnbExp(1),
        accruedAmt = bnbUnsigned(0.0009e18);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, accruedAmt]);
      await send(comptroller, "claimNarwhal", [a1, [vLOW._address]]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it("should revert when a market is not listed", async () => {
      const cNOT = await makeNToken({ comptroller });
      await expect(send(comptroller, "claimNarwhal", [a1, [cNOT._address]])).rejects.toRevert("revert market not listed");
    });
  });

  describe("claimNarwhal batch", () => {
    it("should revert when claiming nwl from non-listed market", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        deltaBlocks = 10,
        mintAmount = bnbMantissa(1, 12);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      let [_, __, ...claimAccts] = saddle.accounts;

      for (let from of claimAccts) {
        expect(await send(vLOW.underlying, "harnessSetBalance", [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, "approve", [vLOW._address, mintAmount], { from });
        send(vLOW, "mint", [mintAmount], { from });
      }

      await pretendBorrow(vLOW, root, 1, 1, bnbMantissa(1, 12));
      await send(comptroller, "harnessRefreshNarwhalSpeeds");

      await fastForward(comptroller, deltaBlocks);

      await expect(
        send(comptroller, "claimNarwhal", [claimAccts, [vLOW._address, vEVIL._address], true, true]),
      ).rejects.toRevert("revert market not listed");
    });

    it("should claim the expected amount when holders and vtokens arg is duplicated", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        deltaBlocks = 10,
        mintAmount = bnbMantissa(1, 12);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      let [_, __, ...claimAccts] = saddle.accounts;
      for (let from of claimAccts) {
        expect(await send(vLOW.underlying, "harnessSetBalance", [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, "approve", [vLOW._address, mintAmount], { from });
        send(vLOW, "mint", [mintAmount], { from });
      }
      await pretendBorrow(vLOW, root, 1, 1, bnbMantissa(1, 12));
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");

      await fastForward(comptroller, deltaBlocks);

      await send(comptroller, "claimNarwhal", [
        [...claimAccts, ...claimAccts],
        [vLOW._address, vLOW._address],
        false,
        true,
      ]);
      // nwl distributed => 10e18
      for (let acct of claimAccts) {
        const narwhalSupplierIndex_Actual = await call(comptroller, "narwhalSupplierIndex", [vLOW._address, acct]);
        expect(narwhalSupplierIndex_Actual.toString()).toEqualNumber(
          "104166666666666667666666666666666666666666666666666666",
        );
        const nwlBalance_Actual = await nwlBalance(comptroller, acct);
        expect(nwlBalance_Actual.toString()).toEqualNumber("1249999999999999999");
      }
    });

    it("claims nwl for multiple suppliers only", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        deltaBlocks = 10,
        mintAmount = bnbMantissa(1, 12);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      let [_, __, ...claimAccts] = saddle.accounts;
      for (let from of claimAccts) {
        expect(await send(vLOW.underlying, "harnessSetBalance", [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, "approve", [vLOW._address, mintAmount], { from });
        send(vLOW, "mint", [mintAmount], { from });
      }
      await pretendBorrow(vLOW, root, 1, 1, bnbMantissa(1, 12));
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");

      await fastForward(comptroller, deltaBlocks);

      await send(comptroller, "claimNarwhal", [claimAccts, [vLOW._address], false, true]);
      // nwl distributed => 1e18
      for (let acct of claimAccts) {
        const narwhalSupplierIndex_Actual = await call(comptroller, "narwhalSupplierIndex", [vLOW._address, acct]);
        expect(narwhalSupplierIndex_Actual.toString()).toEqual("104166666666666667666666666666666666666666666666666666");
        const nwlBalance_Actual = await nwlBalance(comptroller, acct);
        expect(nwlBalance_Actual.toString()).toEqualNumber("1249999999999999999");
      }
    });

    it("claims nwl for multiple borrowers only, primes uninitiated", async () => {
      const narwhalRemaining = narwhalRate.mul(100),
        borrowAmt = bnbMantissa(1, 12),
        borrowIdx = bnbMantissa(1, 12);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      let [_, __, ...claimAccts] = saddle.accounts;

      for (let acct of claimAccts) {
        await send(vLOW, "harnessIncrementTotalBorrows", [borrowAmt]);
        await send(vLOW, "harnessSetAccountBorrows", [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");

      await send(comptroller, "harnessFastForward", [10]);

      await send(comptroller, "claimNarwhal", [claimAccts, [vLOW._address], true, false]);
      for (let acct of claimAccts) {
        const narwhalBorrowerIndex_Actual = await call(comptroller, "narwhalBorrowerIndex", [vLOW._address, acct]);
        expect(narwhalBorrowerIndex_Actual.toString()).toEqualNumber(
          "104166666666666667666666666666666666666666666666666666",
        );
        expect(await call(comptroller, "narwhalSupplierIndex", [vLOW._address, acct])).toEqualNumber(0);
      }
    });

    it("should revert when a market is not listed", async () => {
      const cNOT = await makeNToken({ comptroller });
      await setMarketSupplyCap(cNOT.comptroller, [cNOT._address], [1e15]);
      await expect(send(comptroller, "claimNarwhal", [[a1, a2], [cNOT._address], true, true])).rejects.toRevert(
        "revert market not listed",
      );
    });

    it('should revert if user is blacklisted', async () => {
      let claimAccts = [
        "0xEF044206Db68E40520BfA82D45419d498b4bc7Bf",
        "0x7589dD3355DAE848FDbF75044A3495351655cB1A",
        "0x33df7a7F6D44307E1e5F3B15975b47515e5524c0",
        "0x24e77E5b74B30b026E9996e4bc3329c881e24968"
      ];

      for (const user of claimAccts) {
        await expect(
          send(comptroller, 'claimNarwhal', [[user], [vLOW._address], false, true, false])
        ).rejects.toRevert('revert Blacklisted');
        await expect(
          send(comptroller, 'claimNarwhal', [[user], [vLOW._address], false, true, true])
        ).rejects.toRevert('revert Blacklisted');
      }
    })
  });

  describe("harnessRefreshNarwhalSpeeds", () => {
    it("should start out 0", async () => {
      await send(comptroller, "harnessRefreshNarwhalSpeeds");
      const speed = await call(comptroller, "narwhalSpeeds", [vLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it("should get correct speeds with borrows", async () => {
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address]]);
      const tx = await send(comptroller, "harnessRefreshNarwhalSpeeds");
      const speed = await call(comptroller, "narwhalSpeeds", [vLOW._address]);
      expect(speed).toEqualNumber(narwhalRate);
      expect(tx).toHaveLog(["NarwhalSpeedUpdated", 0], {
        vToken: vLOW._address,
        newSpeed: speed,
      });
    });

    it("should get correct speeds for 2 assets", async () => {
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await pretendBorrow(vZRX, a1, 1, 1, 100);
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address, vZRX._address]]);
      await send(comptroller, "harnessRefreshNarwhalSpeeds");
      const speed1 = await call(comptroller, "narwhalSpeeds", [vLOW._address]);
      const speed2 = await call(comptroller, "narwhalSpeeds", [vREP._address]);
      const speed3 = await call(comptroller, "narwhalSpeeds", [vZRX._address]);
      expect(speed1).toEqualNumber(narwhalRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(narwhalRate.div(4).mul(3));
    });
  });

  describe("harnessAddNarwhalMarkets", () => {
    it("should correctly add a narwhal market if called by admin", async () => {
      const vBAT = await makeNToken({ comptroller, supportMarket: true });
      await setMarketSupplyCap(vBAT.comptroller, [vBAT._address], [1e15]);
      await send(comptroller, "harnessAddNarwhalMarkets", [[vLOW._address, vREP._address, vZRX._address]]);
      const tx2 = await send(comptroller, "harnessAddNarwhalMarkets", [[vBAT._address]]);
      const markets = await call(comptroller, "getNarwhalMarkets");
      expect(markets).toEqual([vLOW, vREP, vZRX, vBAT].map(c => c._address));
      expect(tx2).toHaveLog("NarwhalSpeedUpdated", {
        vToken: vBAT._address,
        newSpeed: 1,
      });
    });

    it("should not write over a markets existing state", async () => {
      const mkt = vLOW._address;
      const bn0 = 10,
        bn1 = 20;
      const idx = bnbUnsigned(1.5e36);

      await send(comptroller, "harnessAddNarwhalMarkets", [[mkt]]);
      await send(comptroller, "setNarwhalSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setNarwhalBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setNarwhalSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddNarwhalMarkets", [[mkt]]);

      const supplyState = await call(comptroller, "narwhalSupplyState", [mkt]);
      expect(supplyState.block).toEqual(bn1.toFixed());
      expect(supplyState.index).toEqual(idx.toFixed());

      const borrowState = await call(comptroller, "narwhalBorrowState", [mkt]);
      expect(borrowState.block).toEqual(bn1.toFixed());
      expect(borrowState.index).toEqual(idx.toFixed());
    });
  });

  describe("claimNarwhal bankrupt accounts", () => {
    let vToken, liquidity, shortfall, comptroller;
    const borrowed = 6666666;
    const minted = 1e6;
    const collateralFactor = 0.5,
      underlyingPrice = 1;
    beforeEach(async () => {
      // prepare a vToken
      comptroller = await makeComptroller();
      vToken = await makeNToken({ comptroller, supportMarket: true, collateralFactor, underlyingPrice });
      await setMarketSupplyCap(vToken.comptroller, [vToken._address], [1e15]);
      // enter market and make user borrow something
      await enterMarkets([vToken], a1);
      // mint vToken to get user some liquidity
      await quickMint(vToken, a1, minted);
      ({ 1: liquidity, 2: shortfall } = await call(vToken.comptroller, "getAccountLiquidity", [a1]));
      expect(liquidity).toEqualNumber(minted * collateralFactor);
      expect(shortfall).toEqualNumber(0);

      // borror some tokens and let user go bankrupt
      await pretendBorrow(vToken, a1, 1, 1, borrowed);
      ({ 1: liquidity, 2: shortfall } = await call(vToken.comptroller, "getAccountLiquidity", [a1]));
      expect(liquidity).toEqualNumber(0);
      expect(shortfall).toEqualNumber((borrowed - minted) * collateralFactor);
    });

    it("should stop bankrupt accounts from claiming", async () => {
      // claiming narwhal will fail
      const narwhalRemaining = bnbUnsigned(100e18);
      const accruedAmt = bnbUnsigned(10e18);
      await send(comptroller.nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, accruedAmt]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(accruedAmt);
      expect(await nwlBalance(comptroller, a1)).toEqualNumber(0);

      await expect(send(comptroller, "claimNarwhal", [a1, [vToken._address]])).rejects.toRevert(
        "revert bankrupt accounts can only collateralize their pending nwl rewards",
      );
    });

    it("should use the pending nwl reward of bankrupt accounts as collateral and liquidator can liquidate them", async () => {
      // set nwl and vXVS token
      const nwl = await makeToken();
      const vXVS = await makeNToken({
        comptroller,
        supportMarket: true,
        collateralFactor: 0.5,
        underlying: nwl,
        root,
        underlyingPrice: 1,
      });
      await setMarketSupplyCap(vXVS.comptroller, [vXVS._address], [1e15]);

      const narwhalRemaining = bnbUnsigned(1e12);

      // this small amount of accrued nwl couldn't save the user out of bankrupt...
      const smallAccruedAmt = bnbUnsigned(888);
      // ...but this can
      const bigAccruedAmt = bnbUnsigned(1e10);

      await enterMarkets([vXVS], a1);
      await send(comptroller, "setXVSAddress", [nwl._address]);
      await send(comptroller, "setXVSNTokenAddress", [vXVS._address]);
      await send(nwl, "transfer", [comptroller._address, narwhalRemaining], { from: root });
      await send(comptroller, "setNarwhalAccrued", [a1, smallAccruedAmt]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(smallAccruedAmt);

      // mintBehalf is called
      await send(comptroller, "claimNarwhalAsCollateral", [a1]);

      // balance check
      expect(bnbUnsigned(await call(nwl, "balanceOf", [a1]))).toEqualNumber(0);
      expect(bnbUnsigned(await call(vXVS, "balanceOf", [a1]))).toEqualNumber(smallAccruedAmt);
      expect(bnbUnsigned(await call(nwl, "balanceOf", [comptroller._address]))).toEqualNumber(
        narwhalRemaining.sub(smallAccruedAmt),
      );
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(0);

      // liquidity check, a part of user's debt is paid off but the user's
      // still bankrupt
      ({ 1: liquidity, 2: shortfall } = await call(comptroller, "getAccountLiquidity", [a1]));
      expect(liquidity).toEqualNumber(0);
      const shortfallBefore = bnbUnsigned(borrowed - minted);
      const shortfallAfter = shortfallBefore.sub(smallAccruedAmt) * collateralFactor;
      expect(shortfall).toEqualNumber(shortfallAfter);

      // give the user big amount of reward so the user can pay off the debt
      await send(comptroller, "setNarwhalAccrued", [a1, bigAccruedAmt]);
      expect(await narwhalAccrued(comptroller, a1)).toEqualNumber(bigAccruedAmt);

      await send(comptroller, "claimNarwhalAsCollateral", [a1]);
      ({ 1: liquidity, 2: shortfall } = await call(comptroller, "getAccountLiquidity", [a1]));
      expect(liquidity).toEqualNumber(bnbUnsigned(bigAccruedAmt * collateralFactor).sub(shortfallAfter));
      expect(shortfall).toEqualNumber(0);

      // balance check
      expect(bnbUnsigned(await call(nwl, "balanceOf", [a1]))).toEqualNumber(0);
      expect(bnbUnsigned(await call(vXVS, "balanceOf", [a1]))).toEqualNumber(smallAccruedAmt.add(bigAccruedAmt));
      expect(bnbUnsigned(await call(nwl, "balanceOf", [comptroller._address]))).toEqualNumber(
        narwhalRemaining.sub(smallAccruedAmt).sub(bigAccruedAmt),
      );
    });
  });
});
