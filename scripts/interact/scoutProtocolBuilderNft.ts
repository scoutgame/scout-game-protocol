import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer'; // Importing inquirer for interactive CLI

import type { ContractDeploymentEnvironment } from '../../lib/connectors';
import { getConnectorFromHardhatRuntimeEnvironment } from '../../lib/connectors';
import { interactWithContract } from '../../lib/interactWithContract';

dotenv.config();

task('interactScoutProtocolBuilderNFT', 'Interact with Scout Protocol Builder NFT contract via CLI').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    const privateKey = process.env.PRIVATE_KEY?.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`);

    const choices: string[] = [];

    if (connector.scoutProtocolBuilderNFT?.prod) {
      choices.push(`🟢 Prod ${connector.scoutProtocolBuilderNFT.prod.slice(0, 6)}`);
    }

    if (connector.scoutProtocolBuilderNFT?.stg) {
      choices.push(`🟡 Stg ${connector.scoutProtocolBuilderNFT.stg.slice(0, 6)}`);
    }

    if (connector.scoutProtocolBuilderNFT?.dev) {
      choices.push(`🟡 Dev ${connector.scoutProtocolBuilderNFT.dev.slice(0, 6)}`);
    }

    // Prompt the user to choose between admin functions or user functions
    let { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Choose environment',
        choices
      }
    ]);

    if (String(mode).startsWith('🟢 Prod')) {
      mode = 'prod';
    } else if (String(mode).startsWith('🟡 Stg')) {
      mode = 'stg';
    } else {
      mode = 'dev';
    }

    // Prompt the user to choose between admin functions or user functions
    const { functionType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'functionType',
        message: 'Do you want to interact with admin functions or user functions?',
        choices: ['Admin Functions', 'User Functions']
      }
    ]);

    const contractAddress = connector.scoutProtocolBuilderNFT?.[mode as ContractDeploymentEnvironment];

    if (!contractAddress) {
      throw new Error('Proxy contract address not found in connector');
    }

    const contract = await hre.viem.getContractAt(
      (functionType === 'Admin Functions'
        ? 'ScoutProtocolNFTProxy'
        : 'ScoutProtocolNFTImplementation') as any,
      contractAddress as `0x${string}`
    );

    // Proceed to interact with the contract using the selected ABI and contract address
    await interactWithContract({ hre, contractAddress, privateKey, abi: contract.abi });
  }
);

module.exports = {};
