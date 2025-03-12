import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';

import type { DeployedContractInfo } from '../../../lib/outputContract';

dotenv.config();

task('verifyContracts', 'Verifies contracts on the block explorer')
  .addOptionalParam('deployment', 'Deployment environment name for output directory structure', 'dev')
  .setAction(async (taskArgs, hre) => {
    const deploymentName = taskArgs.deployment;
    const contracts = fs.readdirSync(path.resolve('deployments', deploymentName, hre.network.name));

    for (const contract of contracts) {
      const contractData = JSON.parse(
        fs.readFileSync(path.resolve('deployments', deploymentName, hre.network.name, contract), 'utf8')
      ) as DeployedContractInfo;

      console.log(`\r\n-------- START VERIFYING CONTRACT ${contractData.name} --------\r\n`);

      const command = `npx hardhat verify --force --network ${hre.network.name} --contract ${contractData.contractArtifactSource} ${contractData.address} ${contractData.deployArgs?.join(' ')}`;

      try {
        console.log(`Verifying contract ${contractData.name} at address ${contractData.address}`);
        console.log(command);
        execSync(command);
      } catch (err: any) {
        const stdout = err.stdout ? Buffer.from(err.stdout).toString() : '';
        const stderr = err.stderr ? Buffer.from(err.stderr).toString() : '';

        if (stdout.match(/already.*verified/) || stderr.match(/already.*verified/)) {
          console.log(`Contract ${contractData.name} at address ${contractData.address} already verified`);
        } else {
          console.warn('Error verifying contract', err);
        }
      }

      console.log(`\r\n-------- END VERIFYING CONTRACT ${contractData.name} --------\r\n`);
    }
  });

module.exports = {};
