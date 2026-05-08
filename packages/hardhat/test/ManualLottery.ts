import { expect } from "chai";
import { ethers } from "hardhat";

describe("ManualLottery", function () {
  // Подготавливает новый экземпляр контракта и тестовые аккаунты для каждого сценария.
  async function deployManualLotteryFixture() {
    const [owner, participant, secondParticipant, outsider] = await ethers.getSigners();
    const manualLotteryFactory = await ethers.getContractFactory("ManualLottery");
    const manualLottery = await manualLotteryFactory.deploy();
    await manualLottery.waitForDeployment();

    return { manualLottery, owner, participant, secondParticipant, outsider };
  }

  describe("joinLottery", function () {
    it("Should allow a participant to join and emit an event", async function () {
      const { manualLottery, participant } = await deployManualLotteryFixture();

      // Участник входит в лотерею, контракт должен сохранить адрес и выпустить событие.
      await expect(manualLottery.connect(participant).getFunction("joinLottery")())
        .to.emit(manualLottery, "ParticipantJoined")
        .withArgs(participant.address);

      expect(await manualLottery.getFunction("hasJoined")(participant.address)).to.equal(true);
      expect(await manualLottery.getFunction("getParticipants")()).to.deep.equal([participant.address]);
    });

    it("Should reject the same participant twice", async function () {
      const { manualLottery, participant } = await deployManualLotteryFixture();

      // Один и тот же адрес не может зарегистрироваться повторно.
      await manualLottery.connect(participant).getFunction("joinLottery")();

      await expect(manualLottery.connect(participant).getFunction("joinLottery")()).to.be.revertedWith(
        "Participant already joined",
      );
    });

    it("Should reject new participants after the lottery is finished", async function () {
      const { manualLottery, participant, secondParticipant } = await deployManualLotteryFixture();

      // После выбора победителя лотерея считается завершенной, новые участники не принимаются.
      await manualLottery.connect(participant).getFunction("joinLottery")();
      await manualLottery.getFunction("selectWinner")(participant.address);

      await expect(manualLottery.connect(secondParticipant).getFunction("joinLottery")()).to.be.revertedWith(
        "Lottery is finished",
      );
    });
  });

  describe("selectWinner", function () {
    it("Should allow the owner to select a participant as winner and emit an event", async function () {
      const { manualLottery, participant } = await deployManualLotteryFixture();

      // Владелец может выбрать победителем только уже зарегистрированного участника.
      await manualLottery.connect(participant).getFunction("joinLottery")();

      await expect(manualLottery.getFunction("selectWinner")(participant.address))
        .to.emit(manualLottery, "WinnerSelected")
        .withArgs(participant.address);

      expect(await manualLottery.getFunction("winner")()).to.equal(participant.address);
      expect(await manualLottery.getFunction("isFinished")()).to.equal(true);
    });

    it("Should reject winner selection from a non-owner account", async function () {
      const { manualLottery, participant } = await deployManualLotteryFixture();

      // Участник без прав владельца не может выбирать победителя.
      await manualLottery.connect(participant).getFunction("joinLottery")();

      await expect(
        manualLottery.connect(participant).getFunction("selectWinner")(participant.address),
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should reject selecting an address that did not join", async function () {
      const { manualLottery, outsider } = await deployManualLotteryFixture();

      // Нельзя назначить победителем адрес, который не входил в лотерею.
      await expect(manualLottery.getFunction("selectWinner")(outsider.address)).to.be.revertedWith(
        "Winner must be a participant",
      );
    });

    it("Should reject selecting a winner twice", async function () {
      const { manualLottery, participant, secondParticipant } = await deployManualLotteryFixture();

      // После первого выбора победителя повторный выбор запрещен.
      await manualLottery.connect(participant).getFunction("joinLottery")();
      await manualLottery.connect(secondParticipant).getFunction("joinLottery")();
      await manualLottery.getFunction("selectWinner")(participant.address);

      await expect(manualLottery.getFunction("selectWinner")(secondParticipant.address)).to.be.revertedWith(
        "Lottery is already finished",
      );
    });
  });
});
