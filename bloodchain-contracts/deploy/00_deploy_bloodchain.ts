import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const d = await deploy("BloodChain", {
    from: deployer,
    log: true,
  });
  log(`BloodChain deployed at ${d.address}`);
};

export default func;
func.id = "deploy_bloodchain";
func.tags = ["BloodChain"];



