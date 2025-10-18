import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get, log } = hre.deployments;

  const blood = await get("BloodChain");
  const thresholds = [1, 10, 20];
  const baseURI = "ipfs://"; // TODO: set later

  const d = await deploy("MedalNFT", {
    from: deployer,
    args: [blood.address, thresholds, baseURI],
    log: true,
  });

  log(`MedalNFT deployed at ${d.address}`);
};

export default func;
func.id = "deploy_medalnft";
func.tags = ["MedalNFT"];
func.dependencies = ["BloodChain"];


