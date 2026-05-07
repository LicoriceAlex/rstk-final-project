import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployManualLottery: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("ManualLottery", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployManualLottery;

deployManualLottery.tags = ["ManualLottery"];
