const { bnbMantissa } = require("../Utils/BSC");
const { makeComptroller } = require("../Utils/Narwhal");

const RATE_PER_BLOCK = bnbMantissa(1).toFixed(0);
const MIN_RELEASE_AMOUNT = bnbMantissa(100).toFixed(0);
const START_BLOCK = 1;

describe("releaseToVault", () => {
  let root;
  let comptroller, vaiVault;

  async function checkBalance(account, balance) {
    expect(await call(comptroller.nwl, "balanceOf", [account])).toEqualNumber(balance);
  }

  beforeEach(async () => {
    [root] = saddle.accounts;
    comptroller = await makeComptroller();
    vaiVault = await deploy("VAIVault");
    await send(vaiVault, "setNarwhalInfo", [comptroller.nwl._address, comptroller.vai._address]);
    // startBlock = 0, minRelease = 100
    await send(comptroller, "_setVAIVaultInfo", [vaiVault._address, START_BLOCK, MIN_RELEASE_AMOUNT], {
      from: root,
    });
    // 1 nwl per block
    await send(comptroller, "_setNarwhalVAIVaultRate", [RATE_PER_BLOCK], {
      from: root,
    });
  });

  it("won't release before start block", async () => {
    await send(comptroller, "harnessSetReleaseStartBlock", [1000]);
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, 0);
  });

  it("releaseAmount < minReleaseAmount", async () => {
    await send(comptroller, "setBlockNumber", [1]);
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, 0);
  });

  it("nwlBalance < minReleaseAmount", async () => {
    await send(comptroller, "setBlockNumber", [10001]);

    // give comptroller 0.5 XVS
    // releaseAmount > minReleaseAmount && nwlBalance < minReleaseAmount
    await send(comptroller.nwl, "transfer", [comptroller._address, bnbMantissa(0.5).toFixed(0)], {
      from: root,
    });
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, bnbMantissa(0));
  });

  it("nwlBalance >= _releaseAmount", async () => {
    await send(comptroller, "setBlockNumber", [8001]);
    // give comptroller 1000 XVS
    // nwlBalance > minReleaseAmount && nwlBalance < _releaseAmount
    await send(comptroller.nwl, "transfer", [comptroller._address, bnbMantissa(10000).toFixed(0)], {
      from: root,
    });
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, bnbMantissa(8000));
  });

  it("nwlBalance < _releaseAmount", async () => {
    await send(comptroller, "setBlockNumber", [8001]);
    // give comptroller 1000 XVS
    // nwlBalance > minReleaseAmount && nwlBalance < _releaseAmount
    await send(comptroller.nwl, "transfer", [comptroller._address, bnbMantissa(7000).toFixed(0)], {
      from: root,
    });
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, bnbMantissa(7000));

    // multiple release has no effect
    await send(comptroller, "releaseToVault");
    await send(comptroller, "releaseToVault");
    await send(comptroller, "releaseToVault");
    await send(comptroller, "releaseToVault");
    await checkBalance(vaiVault._address, bnbMantissa(7000));
  });
});
