import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer'; // Importing inquirer for interactive CLI
import { privateKeyToAccount } from 'viem/accounts';

import { ProtocolEASResolverClient as _ScoutProtocolEASResolverClient } from '../../lib/apiClients/protocol/contracts/EAS/ProtocolEASResolver.sol/ProtocolEASResolver';
import { getConnectorFromHardhatRuntimeEnvironment } from '../../lib/connectors';
import type { ContractDeploymentEnvironment } from '../../lib/connectors';
import { getWalletClient } from '../../lib/getWalletClient';
import { interactWithContract } from '../../lib/interactWithContract';

dotenv.config();

task('interactProtocolEASResolver', 'Interact with ScoutGame Protocol EAS Resolver via CLI').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    if (!connector.scoutProtocol) {
      throw new Error('Protocol configuration not found in connector');
    }

    const privateKey = process.env.PRIVATE_KEY?.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`);

    const choices: string[] = [];

    if (connector.scoutProtocol.prod?.easResolver) {
      choices.push(`🟢 Prod ${connector.scoutProtocol.prod.easResolver.slice(0, 6)}`);
    }

    if (connector.scoutProtocol.stg?.easResolver) {
      choices.push(`🟡 Stg ${connector.scoutProtocol.stg.easResolver.slice(0, 6)}`);
    }

    if (connector.scoutProtocol.dev?.easResolver) {
      choices.push(`🟡 Dev ${connector.scoutProtocol.dev.easResolver.slice(0, 6)}`);
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
    } else if (String(mode).startsWith('🟡 Dev')) {
      mode = 'dev';
    }

    const contractAddress = connector.scoutProtocol[mode as ContractDeploymentEnvironment]?.easResolver;

    if (!contractAddress) {
      throw new Error('Proxy contract address not found in connector');
    }

    const ScoutScoutTokenERC20Client = new _ScoutProtocolEASResolverClient({
      contractAddress,
      walletClient: getWalletClient({ chain: connector.chain, privateKey, rpcUrl: connector.rpcUrl })
    });

    const currentAccount = privateKeyToAccount(privateKey);

    const currentAdmin = await ScoutScoutTokenERC20Client.admin();

    if (currentAccount.address === currentAdmin) {
      console.log('ℹ️ You are connected with the production wallet. Please be careful with the actions you perform.');
    } else {
      console.log('🟡 You are connected with the test wallet');
    }

    const implementationArtifactPath = path.resolve(
      __dirname,
      '../../artifacts/contracts/protocol/ProtocolEASResolver.sol/ProtocolEASResolver.json'
    );
    const implementationArtifact = JSON.parse(fs.readFileSync(implementationArtifactPath, 'utf8'));
    const abi = implementationArtifact.abi;

    // Proceed to interact with the contract using the selected ABI and contract address
    await interactWithContract({ hre, contractAddress, privateKey, abi });
  }
);

module.exports = {};
