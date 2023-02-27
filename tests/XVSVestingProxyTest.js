const { address, bnbUnsigned, mergeInterface, freezeTime } = require("./Utils/BSC");

const BigNum = require("bignumber.js");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
let accounts = [];

describe("XVSVestingProxy", () => {
  let root;
  let vrtConversionAddress, vrtToken, nwlToken, nwlTokenAddress;
  let nwlVestingProxy, nwlVestingProxyAdmin;
  let blockTimestamp;
  let vrtConversion,
    vrtConverterProxy,
    vrtConverterProxyAddress,
    conversionStartTime,
    conversionPeriod,
    conversionRatio;
  let nwlVesting, nwlVestingAddress;

  beforeEach(async () => {
    [root, vrtConversionAddress, ...accounts] = saddle.accounts;
    blockTimestamp = bnbUnsigned(100);
    await freezeTime(blockTimestamp.toNumber());

    //deploy VRT
    vrtToken = await deploy("VRT", [root]);
    let vrtTokenAddress = vrtToken._address;

    //deploy XVS
    nwlToken = await deploy("XVS", [root]);
    nwlTokenAddress = nwlToken._address;

    //deploy XVSVesting
    nwlVesting = await deploy("XVSVestingHarness");
    nwlVestingAddress = nwlVesting._address;

    //deploy XVSVestingProxy
    nwlVestingProxy = await deploy("XVSVestingProxy", [nwlVestingAddress, nwlTokenAddress]);
    nwlVestingProxyAdmin = await call(nwlVestingProxy, "admin");
    mergeInterface(nwlVestingProxy, nwlVesting);

    //deploy VRTConversion
    vrtConversion = await deploy("VRTConverterHarness");
    vrtConversionAddress = vrtConversion._address;
    conversionStartTime = blockTimestamp;
    conversionPeriod = 360 * 24 * 60 * 60;
    // 12,000 VRT =  1 XVS
    // 1 VRT = 1/12,000 = 0.000083
    conversionRatio = new BigNum(0.000083e18);

    vrtConverterProxy = await deploy(
      "VRTConverterProxy",
      [vrtConversionAddress, vrtTokenAddress, nwlTokenAddress, conversionRatio, conversionStartTime, conversionPeriod],
      { from: root },
    );
    vrtConverterProxyAddress = vrtConverterProxy._address;
    mergeInterface(vrtConverterProxy, vrtConversion);

    //set VRTConverterProxy in XVSVesting
    await send(nwlVestingProxy, "setVRTConverter", [vrtConverterProxyAddress]);
  });

  describe("constructor", () => {
    it("sets admin to caller and addresses to 0", async () => {
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toBeAddressZero();
      expect(await call(nwlVestingProxy, "pendingImplementation")).toBeAddressZero();
      expect(await call(nwlVestingProxy, "implementation")).toEqual(nwlVestingAddress);

      const nwlAddressResp = await call(nwlVestingProxy, "nwl");
      expect(nwlAddressResp).toEqual(nwlTokenAddress);

      const vrtConversionAddressResp = await call(nwlVestingProxy, "vrtConversionAddress");
      expect(vrtConversionAddressResp).toEqual(vrtConverterProxyAddress);
    });
  });

  describe("_setPendingImplementation", () => {
    describe("Check caller is admin", () => {
      it("does not change pending implementation address", async () => {
        await expect(
          send(nwlVestingProxy, "_setPendingImplementation", [nwlVesting._address], { from: accounts[1] }),
        ).rejects.toRevert("revert Only admin can set Pending Implementation");
        expect(await call(nwlVestingProxy, "pendingImplementation")).toBeAddressZero();
      });
    });

    describe("succeeding", () => {
      it("stores pendingImplementation with value newPendingImplementation", async () => {
        const result = await send(nwlVestingProxy, "_setPendingImplementation", [nwlVesting._address], { from: root });
        expect(await call(nwlVestingProxy, "pendingImplementation")).toEqual(nwlVesting._address);
        expect(result).toHaveLog("NewPendingImplementation", {
          oldPendingImplementation: address(0),
          newPendingImplementation: nwlVestingAddress,
        });
      });
    });

    describe("ZeroAddress as pending implementation", () => {
      it("does not change pending implementation address", async () => {
        await expect(
          send(nwlVestingProxy, "_setPendingImplementation", [ZERO_ADDRESS], { from: accounts[1] }),
        ).rejects.toRevert("revert Address cannot be Zero");
        expect(await call(nwlVestingProxy, "pendingImplementation")).toBeAddressZero();
      });
    });
  });

  describe("_acceptImplementation", () => {
    it("Check caller is pendingImplementation  and pendingImplementation ≠ address(0) ", async () => {
      expect(await send(nwlVestingProxy, "_setPendingImplementation", [nwlVesting._address], { from: root }));
      await expect(send(nwlVestingProxy, "_acceptImplementation", { from: root })).rejects.toRevert(
        "revert only address marked as pendingImplementation can accept Implementation",
      );
      expect(await call(nwlVestingProxy, "implementation")).not.toEqual(nwlVestingProxy._address);
    });
  });

  describe("the XVSVestingImpl must accept the responsibility of implementation", () => {
    let result;
    beforeEach(async () => {
      await send(nwlVestingProxy, "_setPendingImplementation", [nwlVesting._address], { from: root });
      const pendingXVSVestingImpl = await call(nwlVestingProxy, "pendingImplementation");
      expect(pendingXVSVestingImpl).toEqual(nwlVesting._address);
    });

    it("Store implementation with value pendingImplementation", async () => {
      nwlVestingProxyAdmin = await call(nwlVestingProxy, "admin");
      result = await send(nwlVesting, "_become", [nwlVestingProxy._address], { from: nwlVestingProxyAdmin });
      expect(result).toSucceed();
      expect(await call(nwlVestingProxy, "implementation")).toEqual(nwlVesting._address);
      expect(await call(nwlVestingProxy, "pendingImplementation")).toBeAddressZero();
    });
  });

  describe("Upgrade nwlVesting", () => {
    it("should update the implementation and assert the existing-storage on upgraded implementation", async () => {
      nwlVesting = await deploy("XVSVestingHarness", [], { from: root });
      nwlVestingAddress = nwlVesting._address;

      await send(nwlVestingProxy, "_setPendingImplementation", [nwlVestingAddress], { from: root });
      await send(nwlVesting, "_become", [nwlVestingProxy._address], { from: nwlVestingProxyAdmin });

      const nwlVestingImplementationFromProxy = await call(nwlVestingProxy, "implementation", []);
      expect(nwlVestingImplementationFromProxy).toEqual(nwlVestingAddress);

      const nwlAddressResp = await call(nwlVestingProxy, "nwl");
      expect(nwlAddressResp).toEqual(nwlTokenAddress);

      const vrtConversionAddressResp = await call(nwlVestingProxy, "vrtConversionAddress");
      expect(vrtConversionAddressResp).toEqual(vrtConverterProxyAddress);
    });
  });

  describe("admin()", () => {
    it("should return correct admin", async () => {
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
    });
  });

  describe("pendingAdmin()", () => {
    it("should return correct pending admin", async () => {
      expect(await call(nwlVestingProxy, "pendingAdmin")).toBeAddressZero();
    });
  });

  describe("_setPendingAdmin()", () => {
    it("should only be callable by admin", async () => {
      await expect(send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]], { from: accounts[0] })).rejects.toRevert(
        "revert only admin can set pending admin",
      );

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toBeAddressZero();
    });

    it("should properly set pending admin", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toEqual(accounts[0]);
    });

    it("should properly set pending admin twice", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[1]])).toSucceed();

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toEqual(accounts[1]);
    });

    it("should emit event", async () => {
      const result = await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]]);
      expect(result).toHaveLog("NewPendingAdmin", {
        oldPendingAdmin: address(0),
        newPendingAdmin: accounts[0],
      });
    });
  });

  describe("_acceptAdmin()", () => {
    it("should fail when pending admin is zero", async () => {
      await expect(send(nwlVestingProxy, "_acceptAdmin")).rejects.toRevert(
        "revert only address marked as pendingAdmin can accept as Admin",
      );

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toBeAddressZero();
    });

    it("should fail when called by another account (e.g. root)", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      await expect(send(nwlVestingProxy, "_acceptAdmin")).rejects.toRevert(
        "revert only address marked as pendingAdmin can accept as Admin",
      );

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toEqual(accounts[0]);
    });

    it("should fail on attempt to set zeroAddress as admin", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      await expect(send(nwlVestingProxy, "_setPendingAdmin", [ZERO_ADDRESS])).rejects.toRevert(
        "revert Address cannot be Zero",
      );

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toEqual(accounts[0]);
    });

    it("should fail on multiple attempts of same address is set as PendingAdmin", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      await expect(send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).rejects.toRevert(
        "revert New pendingAdmin can not be same as the previous one",
      );
    });

    it("should succeed on multiple attempts of different address is set as PendingAdmin", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[1]])).toSucceed();

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(root);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toEqual(accounts[1]);
    });

    it("should succeed and set admin and clear pending admin", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      expect(await send(nwlVestingProxy, "_acceptAdmin", [], { from: accounts[0] })).toSucceed();

      // Check admin stays the same
      expect(await call(nwlVestingProxy, "admin")).toEqual(accounts[0]);
      expect(await call(nwlVestingProxy, "pendingAdmin")).toBeAddressZero();
    });

    it("should emit log on success", async () => {
      expect(await send(nwlVestingProxy, "_setPendingAdmin", [accounts[0]])).toSucceed();
      const result = await send(nwlVestingProxy, "_acceptAdmin", [], { from: accounts[0] });
      expect(result).toHaveLog("NewAdmin", {
        oldAdmin: root,
        newAdmin: accounts[0],
      });
      expect(result).toHaveLog("NewPendingAdmin", {
        oldPendingAdmin: accounts[0],
        newPendingAdmin: address(0),
      });
    });
  });
});
