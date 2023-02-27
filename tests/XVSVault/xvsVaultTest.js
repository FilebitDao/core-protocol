const { bnbUnsigned, freezeTime, address, minerStart, minerStop, mineBlock } = require("../Utils/BSC");

const rewardPerBlock = bnbUnsigned(1e16);
const defaultLockPeriod = 300;
const tokenAmount = bnbUnsigned(1e22);

let accounts = [];

describe("XVSVault", () => {
  let root, notAdmin, a1, a2, a3;
  let blockTimestamp;
  let nwlVault;
  let nwlStore;
  let nwl;
  let sxp;

  beforeEach(async () => {
    [root, notAdmin, a1, a2, a3] = accounts;

    nwlVault = await deploy("XVSVault", []);
    nwlStore = await deploy("XVSStore", []);
    nwl = await deploy("XVSScenario", [root]);
    sxp = await deploy("SXP", [root]);

    await send(nwlStore, "setNewOwner", [nwlVault._address], { from: root });
    await send(nwlVault, "setNwlStore", [nwl._address, nwlStore._address], { from: root });
    await send(nwl, "transfer", [nwlStore._address, tokenAmount], { from: root });
    await send(sxp, "transfer", [nwlStore._address, tokenAmount], { from: root });

    blockTimestamp = bnbUnsigned(100);
    await freezeTime(blockTimestamp.toNumber());
  });

  describe("nwl store", () => {
    it("check nwl balance", async () => {
      let nwlBalanceOfStore = await call(nwl, "balanceOf", [nwlStore._address]);
      expect(nwlBalanceOfStore).toEqual("10000000000000000000000");
    });

    it("set new reward token", async () => {
      await send(nwlStore, "setRewardToken", [nwl._address, true], { from: root });
      expect(await call(nwlStore, "rewardTokens", [nwl._address])).toEqual(true);
      expect(await call(nwlStore, "rewardTokens", [nwlVault._address])).toEqual(false);
      expect(await call(nwlStore, "rewardTokens", [nwlStore._address])).toEqual(false);

      await send(nwlStore, "setRewardToken", [nwl._address, false], { from: root });
      expect(await call(nwlStore, "rewardTokens", [nwlStore._address])).toEqual(false);
    });

    it("tranfer reward token", async () => {
      await expect(
        send(nwlStore, "safeRewardTransfer", [nwl._address, root, tokenAmount], { from: root }),
      ).rejects.toRevert("revert only owner can");
    });
  });

  describe("check nwl vault config", () => {
    it("check nwl vault admin", async () => {
      expect(await call(nwlVault, "getAdmin", [])).toEqual(root);
    });

    it("check nwl token address", async () => {
      expect(await call(nwlVault, "nwlAddress", [])).toEqual(nwl._address);
    });

    it("check nwl store address", async () => {
      expect(await call(nwlVault, "nwlStore", [])).toEqual(nwlStore._address);
    });
  });

  describe("test to manage reward pool config", () => {
    it("add nwl pool", async () => {
      const addTx = await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], {
        from: root,
      });

      expect(addTx).toHaveLog("PoolAdded", {
        rewardToken: nwl._address,
        pid: "0",
        token: nwl._address,
        allocPoints: "100",
        rewardPerBlock: rewardPerBlock.toString(),
        lockPeriod: "300",
      });

      const poolInfo = await call(nwlVault, "poolInfos", [nwl._address, 0]);
      expect(poolInfo["token"]).toEqual(nwl._address);
      expect(poolInfo["allocPoint"]).toEqual("100");
      expect(poolInfo["accRewardPerShare"]).toEqual("0");
      expect(poolInfo["lockPeriod"]).toEqual("300");

      expect(await call(nwlStore, "rewardTokens", [nwl._address])).toEqual(true);
    });

    it("update nwl pool alloc config", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });

      let poolInfo = await call(nwlVault, "poolInfos", [nwl._address, 0]);
      expect(poolInfo["allocPoint"]).toEqual("100");

      const setTx = await send(nwlVault, "set", [nwl._address, 0, 1000], { from: root });

      expect(setTx).toHaveLog("PoolUpdated", {
        rewardToken: nwl._address,
        pid: "0",
        oldAllocPoints: "100",
        newAllocPoints: "1000",
      });

      poolInfo = await call(nwlVault, "poolInfos", [nwl._address, 0]);
      expect(poolInfo["token"]).toEqual(nwl._address);
      expect(poolInfo["allocPoint"]).toEqual("1000");
      expect(poolInfo["accRewardPerShare"]).toEqual("0");

      expect(await call(nwlStore, "rewardTokens", [nwl._address])).toEqual(true);
    });

    it("sets the reward amount per block", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });

      const tx = await send(nwlVault, "setRewardAmountPerBlock", [nwl._address, rewardPerBlock.mul(2)], { from: root });

      expect(tx).toHaveLog("RewardAmountUpdated", {
        rewardToken: nwl._address,
        oldReward: rewardPerBlock.toString(),
        newReward: rewardPerBlock.mul(2).toString(),
      });
    });

    it("fails to update config for nonexistent pools", async () => {
      await expect(send(nwlVault, "set", [nwl._address, 0, 1000], { from: root })).rejects.toRevert(
        "revert vault: pool exists?",
      );
    });
  });

  describe("deposit nwl token", () => {
    it("add nwl pool", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwl, "transfer", [notAdmin, tokenAmount], { from: root });

      const notAdminNwlBal = await call(nwl, "balanceOf", [notAdmin]);
      expect(notAdminNwlBal).toEqual("10000000000000000000000");

      await send(nwl, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });

      const notAdminAppr = await call(nwl, "allowance", [notAdmin, nwlVault._address]);
      expect(notAdminAppr).toEqual("10000000000000000000000");

      await send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin });

      const depositedAmount = await call(nwl, "balanceOf", [nwlVault._address]);
      expect(depositedAmount).toEqual("10000000000000000000000");

      let userInfo = await call(nwlVault, "getUserInfo", [nwl._address, 0, notAdmin]);
      expect(userInfo["amount"]).toEqual("10000000000000000000000");
      expect(userInfo["rewardDebt"]).toEqual("0");

      await expect(call(nwlVault, "getUserInfo", [sxp._address, 0, notAdmin])).rejects.toRevert(
        "revert vault: pool exists?",
      );
    });
  });

  describe("claim nwl reward", () => {
    it("deposit and claim", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwl, "transfer", [notAdmin, tokenAmount], { from: root });
      await send(nwl, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });
      await send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin });

      await freezeTime(200);

      let nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("0");

      await send(nwlVault, "deposit", [nwl._address, 0, 0], { from: notAdmin });

      nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("20000000000000000");
    });

    it("reverts when trying to deposit to a nonexisting pool", async () => {
      await expect(send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin })).rejects.toRevert(
        "revert vault: pool exists?",
      );
    });
  });

  describe("withdrawals", () => {
    async function deposit() {
      await send(nwlVault, "add", [nwl._address, 100, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(sxp, "transfer", [notAdmin, tokenAmount], { from: root });
      await send(sxp, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });
      await send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin });
    }

    // To make sure updates to lock period do not affect the existing withdrawal requests,
    // and to correctly test the order of requests, we need to arbitrarily set the lock period.
    // This function makes our tests a bit more concise.
    async function requestWithdrawalWithLockPeriod({ amount, lockPeriod }) {
      await send(nwlVault, "setWithdrawalLockingPeriod", [nwl._address, 0, lockPeriod], { from: root });
      await send(nwlVault, "requestWithdrawal", [nwl._address, 0, amount], { from: notAdmin });
    }

    describe("request withdrawal", () => {
      it("reverts when trying to request a withdrawal from a nonexisting pool", async () => {
        await deposit();
        await expect(send(nwlVault, "requestWithdrawal", [nwl._address, 1, 0], { from: notAdmin })).rejects.toRevert(
          "revert vault: pool exists?",
        );
      });

      it("prohibits requests with zero amount", async () => {
        await deposit();
        await expect(send(nwlVault, "requestWithdrawal", [nwl._address, 0, 0], { from: notAdmin })).rejects.toRevert(
          "revert requested amount cannot be zero",
        );
      });

      it("orders the requests by unlock times", async () => {
        // Insert withdrawal requests in arbitrary order
        await deposit();
        // now = 100; lockedUntil = now + lock period
        await requestWithdrawalWithLockPeriod({ amount: "1000", lockPeriod: "500" }); // lockedUntil = 600
        await requestWithdrawalWithLockPeriod({ amount: "10", lockPeriod: "100" }); // lockedUntil = 200
        await requestWithdrawalWithLockPeriod({ amount: "1", lockPeriod: "300" }); // lockedUntil = 400
        await requestWithdrawalWithLockPeriod({ amount: "100", lockPeriod: "700" }); // lockedUntil = 800

        // We should get the requests ordered by lockedUntil desc (800, 600, 400, 200)
        const requests = await call(nwlVault, "getWithdrawalRequests", [nwl._address, 0, notAdmin]);
        expect(requests.map(v => v.lockedUntil)).toEqual(["800", "600", "400", "200"]);
        expect(requests.map(v => v.amount)).toEqual(["100", "1000", "1", "10"]);
      });

      it("increases pending withdrawals", async () => {
        // Insert withdrawal requests in arbitrary order
        await deposit();
        // now = 100; lockedUntil = now + lock period
        await requestWithdrawalWithLockPeriod({ amount: "1000", lockPeriod: "500" }); // lockedUntil = 600
        await requestWithdrawalWithLockPeriod({ amount: "10", lockPeriod: "100" }); // lockedUntil = 200
        await requestWithdrawalWithLockPeriod({ amount: "1", lockPeriod: "300" }); // lockedUntil = 400
        await requestWithdrawalWithLockPeriod({ amount: "100", lockPeriod: "700" }); // lockedUntil = 800

        expect(await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin])).toEqual("1111");
      });

      it("does not allow to request more than the current amount", async () => {
        await deposit();
        await send(nwlVault, "requestWithdrawal", [nwl._address, 0, tokenAmount], { from: notAdmin });
        await expect(send(nwlVault, "requestWithdrawal", [nwl._address, 0, "1"], { from: notAdmin })).rejects.toRevert(
          "revert requested amount is invalid",
        );
      });
    });

    describe("execute withdrawal", () => {
      it('fails with "nothing to withdraw" if there are no requests', async () => {
        await deposit();
        await expect(send(nwlVault, "executeWithdrawal", [nwl._address, 0], { from: notAdmin })).rejects.toRevert(
          "revert nothing to withdraw",
        );
      });

      it("reverts when trying to withdraw from a nonexisting pool", async () => {
        await deposit();
        await expect(send(nwlVault, "executeWithdrawal", [nwl._address, 1], { from: notAdmin })).rejects.toRevert(
          "revert vault: pool exists?",
        );
      });

      it('fails with "nothing to withdraw" if the requests are still pending', async () => {
        await deposit();
        await requestWithdrawalWithLockPeriod({ amount: "10", lockPeriod: "100" }); // lockedUntil = 200
        await requestWithdrawalWithLockPeriod({ amount: "1", lockPeriod: "300" }); // lockedUntil = 400
        await expect(send(nwlVault, "executeWithdrawal", [nwl._address, 0], { from: notAdmin })).rejects.toRevert(
          "revert nothing to withdraw",
        );
      });

      it("correctly computes the withdrawal amount for multiple withdrawal requests", async () => {
        await deposit();
        await requestWithdrawalWithLockPeriod({ amount: "1000", lockPeriod: "500" }); // lockedUntil = 600
        await requestWithdrawalWithLockPeriod({ amount: "10", lockPeriod: "100" }); // lockedUntil = 200
        await requestWithdrawalWithLockPeriod({ amount: "1", lockPeriod: "300" }); // lockedUntil = 400
        await requestWithdrawalWithLockPeriod({ amount: "100", lockPeriod: "700" }); // lockedUntil = 800

        await freezeTime(400); // requests locked until 200 & 400 should be unlocked now

        const eligibleAmount = await call(nwlVault, "getEligibleWithdrawalAmount", [nwl._address, 0, notAdmin]);
        const requestedAmount = await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin]);
        expect(eligibleAmount).toEqual("11");
        expect(requestedAmount).toEqual("1111");

        let sxpBalance = await call(sxp, "balanceOf", [notAdmin]);
        expect(sxpBalance).toEqual("0");
        await send(nwlVault, "executeWithdrawal", [nwl._address, 0], { from: notAdmin });
        sxpBalance = await call(sxp, "balanceOf", [notAdmin]);
        expect(sxpBalance).toEqual("11");
      });

      it("reverts when trying to compute the withdrawal amounts for a nonexisting pool", async () => {
        await deposit();

        await expect(call(nwlVault, "getEligibleWithdrawalAmount", [nwl._address, 1, notAdmin])).rejects.toRevert(
          "revert vault: pool exists?",
        );

        await expect(call(nwlVault, "getRequestedAmount", [nwl._address, 1, notAdmin])).rejects.toRevert(
          "revert vault: pool exists?",
        );
      });

      it("clears the eligible withdrawals from the queue", async () => {
        await deposit();
        await requestWithdrawalWithLockPeriod({ amount: "1000", lockPeriod: "500" }); // lockedUntil = 600
        await requestWithdrawalWithLockPeriod({ amount: "10", lockPeriod: "100" }); // lockedUntil = 200
        await requestWithdrawalWithLockPeriod({ amount: "1", lockPeriod: "300" }); // lockedUntil = 400
        await requestWithdrawalWithLockPeriod({ amount: "100", lockPeriod: "700" }); // lockedUntil = 800

        await freezeTime(400); // requests locked until 200 & 400 should be unlocked now
        await send(nwlVault, "executeWithdrawal", [nwl._address, 0], { from: notAdmin });

        const requests = await call(nwlVault, "getWithdrawalRequests", [nwl._address, 0, notAdmin]);
        const requestedAmount = await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin]);

        // requests locked until 600 and 800 should still be in the requests array
        expect(requests.map(v => v.lockedUntil)).toEqual(["800", "600"]);
        expect(requests.map(v => v.amount)).toEqual(["100", "1000"]);
        expect(requestedAmount).toEqual("1100");
      });
    });

    describe("lock period", () => {
      it("is possible to set lock period when a new pool is created", async () => {
        const lockPeriod1 = "123456";
        await send(nwlVault, "add", [nwl._address, 100, sxp._address, rewardPerBlock, lockPeriod1], { from: root });
        const lockPeriod2 = "654321";
        await send(nwlVault, "add", [sxp._address, 100, nwl._address, rewardPerBlock, lockPeriod2], { from: root });
        const pool1 = await call(nwlVault, "poolInfos", [nwl._address, 0]);
        const pool2 = await call(nwlVault, "poolInfos", [sxp._address, 0]);
        expect(pool1.lockPeriod).toEqual("123456");
        expect(pool2.lockPeriod).toEqual("654321");
      });

      it("reverts when trying to set lock period for a nonexisting pool", async () => {
        await expect(
          send(nwlVault, "setWithdrawalLockingPeriod", [nwl._address, 0, 42], { from: root }),
        ).rejects.toRevert("revert vault: pool exists?");
      });

      it("sets the lock period for a pool", async () => {
        await send(nwlVault, "add", [sxp._address, 100, nwl._address, rewardPerBlock, 0], { from: root });

        const tx = await send(nwlVault, "setWithdrawalLockingPeriod", [sxp._address, 0, "1111111"], { from: root });

        expect(tx).toHaveLog("WithdrawalLockingPeriodUpdated", {
          rewardToken: sxp._address,
          pid: "0",
          oldPeriod: "0",
          newPeriod: "1111111",
        });

        const pool = await call(nwlVault, "poolInfos", [sxp._address, 0]);
        expect(pool.lockPeriod).toEqual("1111111");
      });

      it("sets lock period separately for each pool", async () => {
        async function newPool(stakingToken, rewardToken, pid) {
          await send(nwlVault, "add", [rewardToken._address, 100, stakingToken._address, rewardPerBlock, 0], {
            from: root,
          });
          // pair (reward token, pid) uniquely identifies a pool
          return [rewardToken._address, pid];
        }
        const pool1Id = await newPool(nwl, nwl, 0);
        const pool2Id = await newPool(nwl, sxp, 0);
        const pool3Id = await newPool(sxp, nwl, 1);
        const pool4Id = await newPool(sxp, sxp, 1);

        await send(nwlVault, "setWithdrawalLockingPeriod", [...pool1Id, "1111111"], { from: root });
        await send(nwlVault, "setWithdrawalLockingPeriod", [...pool2Id, "2222222"], { from: root });
        await send(nwlVault, "setWithdrawalLockingPeriod", [...pool3Id, "3333333"], { from: root });
        await send(nwlVault, "setWithdrawalLockingPeriod", [...pool4Id, "4444444"], { from: root });

        const pool1 = await call(nwlVault, "poolInfos", pool1Id);
        const pool2 = await call(nwlVault, "poolInfos", pool2Id);
        const pool3 = await call(nwlVault, "poolInfos", pool3Id);
        const pool4 = await call(nwlVault, "poolInfos", pool4Id);

        expect(pool1.lockPeriod).toEqual("1111111");
        expect(pool2.lockPeriod).toEqual("2222222");
        expect(pool3.lockPeriod).toEqual("3333333");
        expect(pool4.lockPeriod).toEqual("4444444");
      });
    });
  });

  describe("withdraw nwl token", () => {
    it("request and execute withdrawal", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwl, "transfer", [notAdmin, tokenAmount], { from: root });
      await send(nwl, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });
      await send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin });

      await send(nwlVault, "requestWithdrawal", [nwl._address, 0, tokenAmount.div(2)], { from: notAdmin });

      let eligibleAmount = await call(nwlVault, "getEligibleWithdrawalAmount", [nwl._address, 0, notAdmin]);
      let requestAmount = await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin]);
      let withdrawalRequests = await call(nwlVault, "getWithdrawalRequests", [nwl._address, 0, notAdmin]);

      expect(eligibleAmount).toEqual("0");
      expect(requestAmount).toEqual("5000000000000000000000");

      expect(withdrawalRequests.length).toEqual(1);
      expect(withdrawalRequests[0]["amount"]).toEqual("5000000000000000000000");
      expect(withdrawalRequests[0]["lockedUntil"]).toEqual("400");

      await freezeTime(300);

      eligibleAmount = await call(nwlVault, "getEligibleWithdrawalAmount", [nwl._address, 0, notAdmin]);
      requestAmount = await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin]);
      expect(eligibleAmount).toEqual("0");
      expect(requestAmount).toEqual("5000000000000000000000");

      await freezeTime(400);

      eligibleAmount = await call(nwlVault, "getEligibleWithdrawalAmount", [nwl._address, 0, notAdmin]);
      requestAmount = await call(nwlVault, "getRequestedAmount", [nwl._address, 0, notAdmin]);
      expect(eligibleAmount).toEqual("5000000000000000000000");
      expect(requestAmount).toEqual("5000000000000000000000");

      let nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("0");

      await send(nwlVault, "executeWithdrawal", [nwl._address, 0], { from: notAdmin });

      nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("5000040000000000000000");
    });
  });

  describe("multiple pools", () => {
    it("add nwl and sxp reward pools", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwlVault, "add", [nwl._address, 100, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });

      await send(nwlVault, "add", [sxp._address, 200, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwlVault, "add", [sxp._address, 200, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });

      const totalAllocPoint1 = await call(nwlVault, "totalAllocPoints", [nwl._address]);
      expect(totalAllocPoint1).toEqual("200");

      const totalAllocPoint2 = await call(nwlVault, "totalAllocPoints", [sxp._address]);
      expect(totalAllocPoint2).toEqual("400");
    });

    it("deposit nwl and sxp reward pools", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwlVault, "add", [nwl._address, 100, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });

      await send(nwlVault, "add", [sxp._address, 200, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwlVault, "add", [sxp._address, 200, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });

      await send(nwl, "transfer", [notAdmin, tokenAmount], { from: root });
      await send(nwl, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });
      await send(nwlVault, "deposit", [nwl._address, 0, tokenAmount], { from: notAdmin });

      await send(sxp, "transfer", [notAdmin, tokenAmount], { from: root });
      await send(sxp, "approve", [nwlVault._address, tokenAmount], { from: notAdmin });
      await send(nwlVault, "deposit", [sxp._address, 1, tokenAmount], { from: notAdmin });

      let nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("0");

      await send(nwlVault, "deposit", [nwl._address, 0, 0], { from: notAdmin });

      nwlBalance = await call(nwl, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("20000000000000000");

      let sxpBalance = await call(sxp, "balanceOf", [notAdmin]);
      expect(sxpBalance).toEqual("0");

      await send(nwlVault, "deposit", [sxp._address, 1, 0], { from: notAdmin });

      nwlBalance = await call(sxp, "balanceOf", [notAdmin]);
      expect(nwlBalance).toEqual("10000000000000000");
    });

    it("fails when a pool does not exist", async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });

      await send(nwlVault, "add", [nwl._address, 100, sxp._address, rewardPerBlock, defaultLockPeriod], { from: root });

      await expect(send(nwlVault, "deposit", [nwl._address, 2, tokenAmount], { from: notAdmin })).rejects.toRevert(
        "revert vault: pool exists?",
      );
    });
  });

  describe("voting power", () => {
    beforeEach(async () => {
      await send(nwlVault, "add", [nwl._address, 100, nwl._address, rewardPerBlock, defaultLockPeriod], { from: root });
      await send(nwl, "transfer", [a1, bnbUnsigned("29000000000000000000000000")], { from: root });
      await send(nwl, "approve", [nwlVault._address, bnbUnsigned("29000000000000000000000000")], { from: a1 });
    });

    async function deposit(amount, { from }) {
      return await send(nwlVault, "deposit", [nwl._address, 0, amount], { from });
    }

    async function requestWithdrawal(amount, { from }) {
      return await send(nwlVault, "requestWithdrawal", [nwl._address, 0, amount], { from });
    }

    async function delegate(delegatee, { from }) {
      return await send(nwlVault, "delegate", [delegatee], { from });
    }

    describe("checkpoints", () => {
      it("correctly computes checkpoints", async () => {
        await deposit(1000, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a1])).resolves.toEqual("0");
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("0");

        const t1 = await delegate(a2, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a1])).resolves.toEqual("0");
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("1");

        const t2 = await requestWithdrawal(900, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a1])).resolves.toEqual("0");
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("2");

        const t3 = await requestWithdrawal(90, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a1])).resolves.toEqual("0");
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("3");

        const t4 = await deposit(42, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a1])).resolves.toEqual("0");
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("4");

        await expect(call(nwlVault, "checkpoints", [a2, 0])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: "1000" }),
        );
        await expect(call(nwlVault, "checkpoints", [a2, 1])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t2.blockNumber.toString(), votes: "100" }),
        );
        await expect(call(nwlVault, "checkpoints", [a2, 2])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t3.blockNumber.toString(), votes: "10" }),
        );
        await expect(call(nwlVault, "checkpoints", [a2, 3])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: "52" }),
        );
      });

      it("correctly computes checkpoints for multiple delegators", async () => {
        await send(nwl, "transfer", [a2, tokenAmount], { from: root });
        await send(nwl, "approve", [nwlVault._address, tokenAmount], { from: a2 });

        await deposit(4444, { from: a1 });
        await deposit(5555, { from: a2 });

        const t1 = await delegate(a3, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("1");

        const t2 = await delegate(a3, { from: a2 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("2");

        const t3 = await requestWithdrawal(444, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("3");

        const t4 = await requestWithdrawal(555, { from: a2 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("4");

        const t5 = await deposit(10, { from: a2 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("5");

        const t6 = await delegate(address(0), { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a3])).resolves.toEqual("6");

        await expect(call(nwlVault, "checkpoints", [a3, 0])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: "4444" }),
        );
        await expect(call(nwlVault, "checkpoints", [a3, 1])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t2.blockNumber.toString(), votes: "9999" }),
        );
        await expect(call(nwlVault, "checkpoints", [a3, 2])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t3.blockNumber.toString(), votes: "9555" }),
        );
        await expect(call(nwlVault, "checkpoints", [a3, 3])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: "9000" }),
        );
        await expect(call(nwlVault, "checkpoints", [a3, 4])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t5.blockNumber.toString(), votes: "9010" }),
        );
        await expect(call(nwlVault, "checkpoints", [a3, 5])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t6.blockNumber.toString(), votes: "5010" }),
        );
      });

      it("does not add more than one checkpoint in a block", async () => {
        await minerStop();

        await minerStart();

        const t1 = await delegate(a2, { from: a1 });
        await deposit(100, { from: a1 });
        await requestWithdrawal(10, { from: a1 });

        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("1");

        await expect(call(nwlVault, "checkpoints", [a2, 0])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: "90" }),
        );
        await expect(call(nwlVault, "checkpoints", [a2, 1])).resolves.toEqual(
          expect.objectContaining({ fromBlock: "0", votes: "0" }),
        );
        await expect(call(nwlVault, "checkpoints", [a2, 2])).resolves.toEqual(
          expect.objectContaining({ fromBlock: "0", votes: "0" }),
        );

        const t4 = await deposit(20, { from: a1 });
        await expect(call(nwlVault, "numCheckpoints", [a2])).resolves.toEqual("2");
        await expect(call(nwlVault, "checkpoints", [a2, 1])).resolves.toEqual(
          expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: "110" }),
        );
      });
    });

    describe("getPriorVotes", () => {
      it("reverts if block number >= current block", async () => {
        await expect(call(nwlVault, "getPriorVotes", [a1, 5e10])).rejects.toRevert(
          "revert NWLVault::getPriorVotes: not yet determined",
        );
      });

      it("returns 0 if there are no checkpoints", async () => {
        expect(await call(nwlVault, "getPriorVotes", [a1, 0])).toEqual("0");
      });

      it("returns the latest block if >= last checkpoint block", async () => {
        await deposit("20000000000000000000000000", { from: a1 });
        const t1 = await delegate(a1, { from: a1 });
        await mineBlock();
        await mineBlock();

        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber])).toEqual("20000000000000000000000000");
        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber + 1])).toEqual("20000000000000000000000000");
      });

      it("returns zero if < first checkpoint block", async () => {
        await deposit("20000000000000000000000000", { from: a1 });
        await mineBlock();
        const t1 = await delegate(a1, { from: a1 });
        await mineBlock();
        await mineBlock();

        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber - 1])).toEqual("0");
        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber + 1])).toEqual("20000000000000000000000000");
      });

      it("generally returns the voting balance at the appropriate checkpoint", async () => {
        await deposit("20000000000000000000000000", { from: a1 });

        await send(nwl, "transfer", [a2, "20"], { from: root });
        await send(nwl, "approve", [nwlVault._address, "20"], { from: a2 });
        await deposit("20", { from: a2 });

        const t1 = await delegate(a1, { from: a1 });
        await mineBlock();
        await mineBlock();
        const t2 = await requestWithdrawal("30", { from: a1 });
        await mineBlock();
        await mineBlock();
        const t3 = await delegate(a1, { from: a2 });
        await mineBlock();
        await mineBlock();
        const t4 = await deposit("10", { from: a1 });
        await mineBlock();
        await mineBlock();

        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber - 1])).toEqual("0");
        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber])).toEqual("20000000000000000000000000");
        expect(await call(nwlVault, "getPriorVotes", [a1, t1.blockNumber + 1])).toEqual("20000000000000000000000000");
        expect(await call(nwlVault, "getPriorVotes", [a1, t2.blockNumber])).toEqual("19999999999999999999999970");
        expect(await call(nwlVault, "getPriorVotes", [a1, t2.blockNumber + 1])).toEqual("19999999999999999999999970");
        expect(await call(nwlVault, "getPriorVotes", [a1, t3.blockNumber])).toEqual("19999999999999999999999990");
        expect(await call(nwlVault, "getPriorVotes", [a1, t3.blockNumber + 1])).toEqual("19999999999999999999999990");
        expect(await call(nwlVault, "getPriorVotes", [a1, t4.blockNumber])).toEqual("20000000000000000000000000");
        expect(await call(nwlVault, "getPriorVotes", [a1, t4.blockNumber + 1])).toEqual("20000000000000000000000000");
      });
    });
  });
});
