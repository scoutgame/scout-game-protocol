import fs from 'node:fs';
import path from 'node:path';

export type DeployedContractInfo = {
  name: string;
  address: string;
  network: string;
  contractArtifactSource: string;
  deploymentName: string;
  metadata?: any;
  deployArgs?: any[];
};

export function outputContractAddress({
  name,
  address,
  network,
  contractArtifactSource,
  deploymentName,
  metadata = {},
  deployArgs = []
}: DeployedContractInfo) {
  // Check if deployments directory exists, create if not
  const contractsDirRoot = path.resolve('deployments');
  if (!fs.existsSync(contractsDirRoot)) {
    fs.mkdirSync(contractsDirRoot);
  }
  const contractsDir = path.resolve(contractsDirRoot, deploymentName);
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  const contractWithNetworkDir = path.join(contractsDir, network);

  if (!fs.existsSync(contractWithNetworkDir)) {
    fs.mkdirSync(contractWithNetworkDir);
  }

  const contractFile = path.join(contractWithNetworkDir, `${name}.json`);
  fs.writeFileSync(
    contractFile,
    JSON.stringify({ name, address, network, contractArtifactSource, metadata, deployArgs }, null, 2)
  );
}
