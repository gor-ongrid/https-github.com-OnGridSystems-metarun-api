const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vesting", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.deployer = this.signers[0];
    this.beneficiary = this.signers[1];
    this.MetarunToken = await ethers.getContractFactory("MetarunToken");
    this.VestingMock = await ethers.getContractFactory("VestingMock");
    this.Vesting = await ethers.getContractFactory("Vesting");
  });

  it("should not deploy with wrong bps parameters", async function () {
    await expect(this.VestingMock.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 60001, 40000, 0, 0, 3, 2)).to.be.revertedWith(
      "sum of Lock and Vest bps should be 10000"
    );
    await expect(this.VestingMock.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 60001, 34567, 0, 0, 3, 2)).to.be.revertedWith(
      "sum of Lock and Vest bps should be 10000"
    );
  });

  it("should not deploy with wrong times", async function () {
    await expect(this.Vesting.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 6000, 4000, 123, 0, 3, 2)).to.be.revertedWith(
      "lockClaimTime should be in the future"
    );
  });

  it("should not deploy with vestStart earlier than lockClaimTime", async function () {
    await expect(this.Vesting.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 6000, 4000, 1800000000, 1700000000, 3, 2)).to.be.revertedWith(
      "vestStart earlier than lockClaimTime"
    );
  });

  it("should not deploy with interval equal to 0", async function(){
    await expect(this.Vesting.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 6000, 4000, 1800000000, 1700000000, 3, 0)).to.be.revertedWith(
        "interval should be greater than 0"
    );
  });

  it("should not deploy duration less than interval", async function(){
    await expect(this.Vesting.deploy("0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", 6000, 4000, 1800000000, 1700000000, 3, 5)).to.be.revertedWith(
        "duration should be greater than interval"
    );
  });

  describe("deploy", function () {
    const timeLockedBps = "1000"; // 10$
    const vestedBps = "9000"; // 90$
    const lockClaimTime = "1700000000";
    const vestStart = 1800000000;
    const vestDuration = 100000000;
    const vestInterval = 10000000;

    beforeEach(async function () {
      this.token = await this.MetarunToken.deploy();
      this.vesting = await this.VestingMock.deploy(
        this.token.address,
        timeLockedBps,
        vestedBps,
        lockClaimTime,
        vestStart,
        vestDuration,
        vestInterval
      );
    });

    it("constructor parameters passed correctly", async function () {
      expect(await this.vesting.lockBps()).to.be.eq("1000");
    });

    it("calculate allocation structure", async function () {
      expect(await this.vesting.lockBps()).to.be.eq("1000");
    });

    describe("add allocation", function () {
      before(async function () {
        this.totalAmount = "1700"; // MRUN
        this.beneficiaryAmount = "1000"; // MRUN
        let allocations = [];
        allocations.push(["0x36295d38F407C53FF19B9a69D291659CFd4852bd", "100"]);
        allocations.push(["0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", "200"]);
        allocations.push([this.beneficiary.address, this.beneficiaryAmount]);
        allocations.push(["0x0B423BE803987C3885EC9b3D4d17f38858B22351", "400"]);
        this.encodedAllocations = [];
        const abiEncoder = new ethers.utils.AbiCoder();
        for (let i = 0; i < allocations.length; i++) {
          let beneficiary = allocations[i][0];
          let amount = allocations[i][1];
          this.encodedAllocations.push(abiEncoder.encode(["address", "uint256"], [beneficiary, amount]));
        }
      });

      beforeEach(async function () {
        await this.token.mint(this.deployer.address, this.totalAmount);
        await this.token.approve(this.vesting.address, this.totalAmount);

        await this.vesting.setAllocations(this.encodedAllocations);
      });

      it("unable to add same allocation again", async function () {
        await expect(this.vesting.setAllocations(this.encodedAllocations)).to.be.revertedWith("Already allocated");
      });

      it("allocation was properly set", async function () {
        const allocation = await this.vesting.allocations(this.beneficiary.address);
        expect(allocation[0]).to.be.eq(this.beneficiaryAmount);
        expect(allocation[1]).to.be.eq("0"); // released
      });

      it("check allocation components with config from constructor", async function () {
        const allocation = await this.vesting.getAllocation(this.beneficiary.address);
        const alcAmount = allocation[0];
        const alcTimeLockedAmount = allocation[1];
        const alcVestedAmount = allocation[2];
        const alcReleased = allocation[3];
        const alcTimeLockedReleased = allocation[4];
        const alcVestedReleased = allocation[5];
        expect(alcAmount).to.be.eq(this.beneficiaryAmount);
        expect(alcTimeLockedAmount).to.be.eq("100");
        expect(alcVestedAmount).to.be.eq("900");
        expect(alcReleased).to.be.eq("0");
        expect(alcTimeLockedReleased).to.be.eq("0");
        expect(alcVestedReleased).to.be.eq("0");
      });

      it("check allocation components with different ratio", async function () {
        await this.vesting.setLockBps("4000");
        await this.vesting.setVestBps("6000");
        const allocation = await this.vesting.getAllocation(this.beneficiary.address);
        const alcAmount = allocation[0];
        const alcTimeLockedAmount = allocation[1];
        const alcVestedAmount = allocation[2];
        const alcReleased = allocation[3];
        const alcTimeLockedReleased = allocation[4];
        const alcVestedReleased = allocation[5];
        expect(alcAmount).to.be.eq(this.beneficiaryAmount);
        expect(alcTimeLockedAmount).to.be.eq("400");
        expect(alcVestedAmount).to.be.eq("600");
        expect(alcReleased).to.be.eq("0");
        expect(alcTimeLockedReleased).to.be.eq("0");
        expect(alcVestedReleased).to.be.eq("0");
      });

      it("check released structure for different released values", async function () {
        let allocation, alcReleased, alcTimeLockedReleased, alcVestedReleased;
        await this.vesting.setReleased(this.beneficiary.address, "10");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("10");
        expect(alcTimeLockedReleased).to.be.eq("0");
        expect(alcVestedReleased).to.be.eq("0");

        await this.vesting.setReleased(this.beneficiary.address, "99");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("99");
        expect(alcTimeLockedReleased).to.be.eq("0");
        expect(alcVestedReleased).to.be.eq("0");

        await this.vesting.setReleased(this.beneficiary.address, "100");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("100");
        expect(alcTimeLockedReleased).to.be.eq("100");
        expect(alcVestedReleased).to.be.eq("0");

        await this.vesting.setReleased(this.beneficiary.address, "101");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("101");
        expect(alcTimeLockedReleased).to.be.eq("100");
        expect(alcVestedReleased).to.be.eq("1");

        await this.vesting.setReleased(this.beneficiary.address, "999");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("999");
        expect(alcTimeLockedReleased).to.be.eq("100");
        expect(alcVestedReleased).to.be.eq("899");

        await this.vesting.setReleased(this.beneficiary.address, "1000");
        allocation = await this.vesting.getAllocation(this.beneficiary.address);
        alcReleased = allocation[3];
        alcTimeLockedReleased = allocation[4];
        alcVestedReleased = allocation[5];
        expect(alcReleased).to.be.eq("1000");
        expect(alcTimeLockedReleased).to.be.eq("100");
        expect(alcVestedReleased).to.be.eq("900");
      });

      it("check getLockUnfrozen amounts before and after lockClaimTime", async function () {
        // nothing unlocked before lockClaimTime
        let timeLockReleasable = await this.vesting.getLockUnfrozen("100");
        expect(timeLockReleasable).to.be.eq("0");

        // entire amount passed through argument unlocked after lockClaimTime
        await this.vesting.setCurrentBlockTime(lockClaimTime);
        timeLockReleasable = await this.vesting.getLockUnfrozen("100");
        expect(timeLockReleasable).to.be.eq("100");
      });

      it("check VestUnfrozen amounts", async function () {
        // nothing unlocked before vestStart
        let vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("0");

        // nothing unlocked when vesting just started
        await this.vesting.setCurrentBlockTime(vestStart);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("0");

        // first interval still locked
        // because it's not finished
        await this.vesting.setCurrentBlockTime(vestStart + vestInterval - 1);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("0");

        // after interval finished it gets unfrozen
        await this.vesting.setCurrentBlockTime(vestStart + vestInterval);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("10");

        // second interval ended
        await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 2);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("20");

        // entire vesting unlocked when last interval started
        await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 10);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("100");

        // unlocked amount never exceeds vestedAmount
        await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 1000);
        vestUnfrozen = await this.vesting.getVestUnfrozen("100");
        expect(vestUnfrozen).to.be.eq("100");
      });

      describe("releasing", function () {
        it("release", async function () {
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
        });

        it("release after lockClaimTime", async function () {
          await this.vesting.setCurrentBlockTime(lockClaimTime);
          const tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "LockRelease").withArgs(this.beneficiary.address, "100");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
        });

        it("release after vestStart passed", async function () {
          await this.vesting.setCurrentBlockTime(vestStart + 1);
          const tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "LockRelease").withArgs(this.beneficiary.address, "100");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
        });

        it("several sequential releases", async function () {
          await this.vesting.setCurrentBlockTime(lockClaimTime);
          let tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "LockRelease").withArgs(this.beneficiary.address, "100");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + 1);
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestInterval);
          tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "90");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestInterval + 1);
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 2);
          tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "90");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 3);
          tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "90");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestInterval * 4);
          tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "90");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Nothing to release yet");
          await this.vesting.setCurrentBlockTime(vestStart + vestDuration * 2);
          tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "540");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Amount already released");
          await this.vesting.setCurrentBlockTime(vestStart + vestDuration * 3);
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Amount already released");
        });

        it("release after vestEnd passed", async function () {
          await this.vesting.setCurrentBlockTime(vestStart + vestDuration);
          const tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "LockRelease").withArgs(this.beneficiary.address, "100");
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "900");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Amount already released");
        });

        it("release in the distant future", async function () {
          // doesn't release more than allocated
          await this.vesting.setCurrentBlockTime(vestStart + vestDuration * 100);
          const tx = this.vesting.release(this.beneficiary.address);
          await expect(tx).to.emit(this.vesting, "LockRelease").withArgs(this.beneficiary.address, "100");
          await expect(tx).to.emit(this.vesting, "VestRelease").withArgs(this.beneficiary.address, "900");
          await expect(this.vesting.release(this.beneficiary.address)).to.be.revertedWith("Amount already released");
        });
      });
    });

    describe("add single allocation", function () {

      allocatedAmount = ethers.utils.parseEther("400");
      
      beforeEach(async function () {
        await this.token.mint(this.deployer.address, allocatedAmount);
        await this.token.approve(this.vesting.address, allocatedAmount);
        await this.vesting.setAllocation(this.beneficiary.address, allocatedAmount);
      });

      it("allocations were properly set", async function () {
        let allocation = await this.vesting.allocations(this.beneficiary.address);
        expect(allocation[0]).to.be.eq(allocatedAmount);
        expect(allocation[1]).to.be.eq("0"); // released
      });
    });

    describe("add multiple allocations", function () {
      const amount = ethers.utils.parseEther("1000");
      let allocations = [];
      allocations.push(["0x36295d38F407C53FF19B9a69D291659CFd4852bd", "100"]);
      allocations.push(["0xE0E30B7E8D58e6a6b14C6bcDf56AAfcAe88ECfb0", "200"]);
      allocations.push(["0xe20dcDBB6B1B77B6f0E6a3D9d7a58Bc8BD04062B", "300"]);
      allocations.push(["0x0B423BE803987C3885EC9b3D4d17f38858B22351", "400"]);
      let encodedAllocations = [];
      const abiEncoder = new ethers.utils.AbiCoder();
      for (let i = 0; i < allocations.length; i++) {
        let beneficiary = allocations[i][0];
        let amount = ethers.utils.parseEther(allocations[i][1]);
        encodedAllocations.push(abiEncoder.encode(["address", "uint256"], [beneficiary, amount]));
      }

      beforeEach(async function () {
        await this.token.mint(this.deployer.address, amount);
        await this.token.approve(this.vesting.address, amount);

        await this.vesting.setAllocations(encodedAllocations);
      });

      it("allocations were properly set", async function () {
        let allocation = await this.vesting.allocations("0xe20dcDBB6B1B77B6f0E6a3D9d7a58Bc8BD04062B");
        expect(allocation[0]).to.be.eq(ethers.utils.parseEther("300"));
        expect(allocation[1]).to.be.eq("0"); // released
        allocation = await this.vesting.allocations("0x0B423BE803987C3885EC9b3D4d17f38858B22351");
        expect(allocation[0]).to.be.eq(ethers.utils.parseEther("400"));
        expect(allocation[1]).to.be.eq("0"); // released
      });
    });
  });
});
