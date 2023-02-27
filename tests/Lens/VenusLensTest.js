const { address, encodeParameters } = require("../Utils/BSC");
const { makeComptroller, makeNToken } = require("../Utils/Narwhal");

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key],
      };
    } else {
      return acc;
    }
  }, {});
}

let accounts = [];

describe("NarwhalLens", () => {
  let NarwhalLens;
  let acct;

  beforeEach(async () => {
    NarwhalLens = await deploy("NarwhalLens");
    acct = accounts[0];
  });

  describe("vTokenMetadata", () => {
    it("is correct for a vBep20", async () => {
      let vBep20 = await makeNToken();
      expect(cullTuple(await call(NarwhalLens, "vTokenMetadata", [vBep20._address]))).toEqual({
        vToken: vBep20._address,
        exchangeRateCurrent: "1000000000000000000",
        supplyRatePerBlock: "0",
        borrowRatePerBlock: "0",
        reserveFactorMantissa: "0",
        totalBorrows: "0",
        totalReserves: "0",
        totalSupply: "0",
        totalCash: "0",
        isListed: false,
        collateralFactorMantissa: "0",
        underlyingAssetAddress: await call(vBep20, "underlying", []),
        vTokenDecimals: "8",
        underlyingDecimals: "18",
        narwhalSupplySpeed: "0",
        narwhalBorrowSpeed: "0",
        dailySupplyNwl: "0",
        dailyBorrowNwl: "0",
      });
    });

    it("is correct for vBnb", async () => {
      let vBnb = await makeNToken({ kind: "vbnb" });
      expect(cullTuple(await call(NarwhalLens, "vTokenMetadata", [vBnb._address]))).toEqual({
        borrowRatePerBlock: "0",
        vToken: vBnb._address,
        vTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
        narwhalSupplySpeed: "0",
        narwhalBorrowSpeed: "0",
        dailySupplyNwl: "0",
        dailyBorrowNwl: "0",
      });
    });
  });

  describe("vTokenMetadataAll", () => {
    it("is correct for a vBep20 and vBnb", async () => {
      let vBep20 = await makeNToken();
      let vBnb = await makeNToken({ kind: "vbnb" });
      expect((await call(NarwhalLens, "vTokenMetadataAll", [[vBep20._address, vBnb._address]])).map(cullTuple)).toEqual([
        {
          vToken: vBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed: false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(vBep20, "underlying", []),
          vTokenDecimals: "8",
          underlyingDecimals: "18",
          narwhalSupplySpeed: "0",
          narwhalBorrowSpeed: "0",
          dailySupplyNwl: "0",
          dailyBorrowNwl: "0",
        },
        {
          borrowRatePerBlock: "0",
          vToken: vBnb._address,
          vTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
          narwhalSupplySpeed: "0",
          narwhalBorrowSpeed: "0",
          dailySupplyNwl: "0",
          dailyBorrowNwl: "0",
        },
      ]);
    });
  });

  describe("vTokenBalances", () => {
    it("is correct for vBEP20", async () => {
      let vBep20 = await makeNToken();
      expect(cullTuple(await call(NarwhalLens, "vTokenBalances", [vBep20._address, acct]))).toEqual({
        balanceOf: "0",
        balanceOfUnderlying: "0",
        borrowBalanceCurrent: "0",
        vToken: vBep20._address,
        tokenAllowance: "0",
        tokenBalance: "10000000000000000000000000",
      });
    });

    it("is correct for vBNB", async () => {
      let vBnb = await makeNToken({ kind: "vbnb" });
      let bnbBalance = await web3.eth.getBalance(acct);
      expect(cullTuple(await call(NarwhalLens, "vTokenBalances", [vBnb._address, acct], { gasPrice: "0" }))).toEqual({
        balanceOf: "0",
        balanceOfUnderlying: "0",
        borrowBalanceCurrent: "0",
        vToken: vBnb._address,
        tokenAllowance: bnbBalance,
        tokenBalance: bnbBalance,
      });
    });
  });

  describe("vTokenBalancesAll", () => {
    it("is correct for vBnb and vBep20", async () => {
      let vBep20 = await makeNToken();
      let vBnb = await makeNToken({ kind: "vbnb" });
      let bnbBalance = await web3.eth.getBalance(acct);

      expect(
        (await call(NarwhalLens, "vTokenBalancesAll", [[vBep20._address, vBnb._address], acct], { gasPrice: "0" })).map(
          cullTuple,
        ),
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          vToken: vBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          vToken: vBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        },
      ]);
    });
  });

  describe("vTokenUnderlyingPrice", () => {
    it("gets correct price for vBep20", async () => {
      let vBep20 = await makeNToken();
      expect(cullTuple(await call(NarwhalLens, "vTokenUnderlyingPrice", [vBep20._address]))).toEqual({
        vToken: vBep20._address,
        underlyingPrice: "0",
      });
    });

    it("gets correct price for vBnb", async () => {
      let vBnb = await makeNToken({ kind: "vbnb" });
      expect(cullTuple(await call(NarwhalLens, "vTokenUnderlyingPrice", [vBnb._address]))).toEqual({
        vToken: vBnb._address,
        underlyingPrice: "1000000000000000000",
      });
    });
  });

  describe("vTokenUnderlyingPriceAll", () => {
    it("gets correct price for both", async () => {
      let vBep20 = await makeNToken();
      let vBnb = await makeNToken({ kind: "vbnb" });
      expect(
        (await call(NarwhalLens, "vTokenUnderlyingPriceAll", [[vBep20._address, vBnb._address]])).map(cullTuple),
      ).toEqual([
        {
          vToken: vBep20._address,
          underlyingPrice: "0",
        },
        {
          vToken: vBnb._address,
          underlyingPrice: "1000000000000000000",
        },
      ]);
    });
  });

  describe("getAccountLimits", () => {
    it("gets correct values", async () => {
      let comptroller = await makeComptroller();

      expect(cullTuple(await call(NarwhalLens, "getAccountLimits", [comptroller._address, acct]))).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0",
      });
    });
  });

  describe("governance", () => {
    let nwl, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let votingDelay;
    let votingPeriod;

    beforeEach(async () => {
      nwl = await deploy("XVS", [acct]);
      gov = await deploy("GovernorAlpha", [address(0), nwl._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(["address"], [acct])];
      await send(nwl, "delegate", [acct]);
      await send(gov, "propose", [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, "latestProposalIds", [acct]);
      votingDelay = Number(await call(gov, "votingDelay"));
      votingPeriod = Number(await call(gov, "votingPeriod"));
    });

    describe("getGovReceipts", () => {
      it("gets correct values", async () => {
        expect((await call(NarwhalLens, "getGovReceipts", [gov._address, acct, [proposalId]])).map(cullTuple)).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          },
        ]);
      });
    });

    describe("getGovProposals", () => {
      it("gets correct values", async () => {
        expect((await call(NarwhalLens, "getGovProposals", [gov._address, [proposalId]])).map(cullTuple)).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + votingDelay + votingPeriod).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + votingDelay).toString(),
            targets: targets,
          },
        ]);
      });
    });
  });

  describe("nwl", () => {
    let nwl, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      nwl = await deploy("XVS", [acct]);
    });

    describe("getXVSBalanceMetadata", () => {
      it("gets correct values", async () => {
        expect(cullTuple(await call(NarwhalLens, "getXVSBalanceMetadata", [nwl._address, acct]))).toEqual({
          balance: "30000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe("getXVSBalanceMetadataExt", () => {
      it("gets correct values", async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, "setNarwhalAccrued", [acct, 5]); // harness only

        expect(
          cullTuple(await call(NarwhalLens, "getXVSBalanceMetadataExt", [nwl._address, comptroller._address, acct])),
        ).toEqual({
          balance: "30000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5",
        });
      });
    });

    describe("getNarwhalVotes", () => {
      it("gets correct values", async () => {
        expect(
          (await call(NarwhalLens, "getNarwhalVotes", [nwl._address, acct, [currentBlock, currentBlock - 1]])).map(
            cullTuple,
          ),
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          },
        ]);
      });

      it("reverts on future value", async () => {
        await expect(call(NarwhalLens, "getNarwhalVotes", [nwl._address, acct, [currentBlock + 1]])).rejects.toRevert(
          "revert XVS::getPriorVotes: not yet determined",
        );
      });
    });
  });

  describe("dailyXVS", () => {
    it("can get dailyXVS for an account", async () => {
      let vBep20 = await makeNToken();
      let comptrollerAddress = await vBep20.comptroller._address;
      expect(await call(NarwhalLens, "getDailyXVS", [acct, comptrollerAddress])).toEqual("0");
    });
  });
});
