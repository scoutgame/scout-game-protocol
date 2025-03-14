import { execSync } from 'node:child_process';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import type { Address } from 'viem';
import { createWalletClient, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey, proceedsReceiver } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../../lib/constants';
import { outputContractAddress } from '../../../lib/outputContract';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task(
  'deployScoutProtocolBuilderStarterPackNFT',
  'Deploys or updates the Scout Protocol Starter Pack NftImplementation contract'
)
  .addOptionalParam('deployment', 'Deployment environment name for output directory structure', 'dev')
  .setAction(async (taskArgs, hre) => {
    await hre.run('compile');

    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);
    const deploymentName = taskArgs.deployment;

    const adminAddress = getScoutProtocolSafeAddress();

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: connector.chain,
      transport: http(connector.rpcUrl)
    });

    // Deploy the implementation contract first

    const implementation = await hre.viem.deployContract('ScoutGameStarterNFTImplementation', [], {
      client: {
        wallet: walletClient
      }
    });

    const implementationAddress = implementation.address;

    // Verify contract in the explorer
    try {
      execSync(`npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${implementationAddress}`);
    } catch (err) {
      console.warn('Error verifying contract', err);
    }

    outputContractAddress({
      name: 'ScoutGameStarterNFTImplementation',
      address: implementationAddress,
      network: getConnectorKey(connector.chain.id),
      contractArtifactSource:
        'contracts/protocol/contracts/StarterPack/ScoutGameStarterNFTImplementation.sol:ScoutGameStarterNFTImplementation',
      deployArgs: [],
      deploymentName
    });

    const { scoutToken } = await inquirer.prompt([
      {
        type: 'input',
        name: 'scoutToken',
        message: 'Enter the Scout token address:',
        validate: (input: string) => {
          if (!isAddress(input)) {
            return 'Please enter a valid Ethereum address';
          }
          return true;
        }
      }
    ]);

    const { season } = await inquirer.prompt([
      {
        type: 'input',
        name: 'season',
        message: 'Enter the season number ex. 01',
        validate: (input: string) => {
          const expectedMatch = /^\d{2}$/;

          if (!input.match(expectedMatch)) {
            return 'Season number must match the expected format: "XX"';
          }

          return true;
        }
      }
    ]);

    const tokenName = `ScoutGame (Season ${season})`;
    const tokenSymbol = `SCOUTGAME-S${season}`;

    const tokenDeployArgs = [implementationAddress as Address, scoutToken as Address, proceedsReceiver] as [
      Address,
      Address,
      Address
    ];

    const deployArgs = [...tokenDeployArgs, `"${tokenName}"`, `"${tokenSymbol}"`] as [
      Address,
      Address,
      Address,
      string,
      string
    ];

    const proxyContract = await hre.viem.deployContract('ScoutGameStarterNFTProxy', deployArgs, {
      client: {
        wallet: walletClient
      }
    });

    const proxyAddress = proxyContract.address;

    console.log('ERC1155 Starter Pack Proxy contract deployed at:', proxyAddress);

    outputContractAddress({
      name: 'ScoutGameStarterNFTProxy',
      address: proxyAddress,
      contractArtifactSource:
        'contracts/protocol/contracts/StarterPack/ScoutGameStarterNFTProxy.sol:ScoutGameStarterNFTProxy',
      network: getConnectorKey(connector.chain.id),
      deployArgs: deployArgs.slice(),
      deploymentName
    });

    try {
      execSync(
        `npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${proxyAddress} ${deployArgs.join(' ')}`
      );
    } catch (err) {
      console.warn('Error verifying contract', err);
    }

    console.log(`Transferring ERC1155 Starter Pack Admin role to Safe Address: ${adminAddress}`);

    await proxyContract.write.transferAdmin([adminAddress]);
  });

module.exports = {};
