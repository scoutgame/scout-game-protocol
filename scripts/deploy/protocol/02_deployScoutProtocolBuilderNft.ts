import { execSync } from 'node:child_process';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import type { Address } from 'viem';
import { createPublicClient, createWalletClient, http, isAddress, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey, proceedsReceiver } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../../lib/constants';
import { outputContractAddress } from '../../../lib/outputContract';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployNft', 'Deploys or updates the Scout Protocol NftImplementation contract')
  .addOptionalParam('deployment', 'Deployment environment name for output directory structure', 'dev')
  .setAction(async (taskArgs, hre) => {
    await hre.run('compile');

    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);
    const deploymentName = taskArgs.deployment;

    const adminAddress = getScoutProtocolSafeAddress();

    const client = createPublicClient({
      chain: connector.chain,
      transport: http(connector.rpcUrl)
    });

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: connector.chain,
      transport: http(connector.rpcUrl)
    });

    // Deploy the implementation contract first

    const implementation = await hre.viem.deployContract('ScoutProtocolBuilderNFTImplementation', [], {
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
      name: 'ScoutProtocolBuilderNFTImplementation',
      address: implementationAddress.toLowerCase() as string,
      network: getConnectorKey(connector.chain.id),
      contractArtifactSource:
        'contracts/protocol/contracts/ERC1155/ScoutProtocolBuilderNFTImplementation.sol:ScoutProtocolBuilderNFTImplementation',
      deployArgs: [],
      deploymentName
    });

    let deployNew = true;

    // Prompt the user to update the implementation if the proxy already exists
    if (connector.scoutProtocolBuilderNFT) {
      const proxyOptions = [];

      const devProxy = connector.scoutProtocolBuilderNFT.dev;
      if (devProxy) {
        proxyOptions.push({ address: devProxy, env: 'dev' });
      }

      const stgProxy = connector.scoutProtocolBuilderNFT.stg;
      if (stgProxy) {
        proxyOptions.push({ address: stgProxy, env: 'stg' });
      }

      const prodProxy = connector.scoutProtocolBuilderNFT.prod;
      if (prodProxy) {
        proxyOptions.push({ address: prodProxy, env: 'prod' });
      }

      const newProxyOption = 'New Proxy';

      const { selectedProxy } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProxy',
          message: 'Select a proxy contract to use:',
          choices: [...proxyOptions.map((opt) => `${opt.env}:: ${opt.address!.slice(0, 6)}`), newProxyOption]
        }
      ]);

      if (selectedProxy !== newProxyOption) {
        deployNew = false;

        const proxyToUpdate = proxyOptions.find(
          (opt) => opt.env === ((selectedProxy as string).split('::').shift()?.trim() as string)
        )?.address as `0x${string}`;

        if (!isAddress(proxyToUpdate)) {
          throw new Error(`Proxy ${proxyToUpdate} is not an address`);
        }

        const { updateImplementation } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'updateImplementation',
            message: 'Do you want to update the proxy to use the new implementation?',
            default: false
          }
        ]);

        if (updateImplementation) {
          console.log('Updating proxy to use the new implementation...');

          const proxyAbi = [parseAbiItem('function setImplementation(address _newImplementation)')];

          const txHash = await walletClient.writeContract({
            address: proxyToUpdate,
            abi: proxyAbi,
            functionName: 'setImplementation',
            args: [implementationAddress]
          });

          const receipt = await client.waitForTransactionReceipt({ hash: txHash });
          console.log('Proxy implementation updated. Transaction hash:', receipt.transactionHash);
        } else {
          console.log('Proxy implementation not updated.');
          process.exit(0);
        }
      }
    }

    if (deployNew) {
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

      const newProxyContract = await hre.viem.deployContract('ScoutProtocolBuilderNFTProxy', deployArgs, {
        client: {
          wallet: walletClient
        }
      });

      const proxyAddress = newProxyContract.address;

      console.log('ERC1155 Proxy contract deployed at:', proxyAddress);

      outputContractAddress({
        name: 'ScoutProtocolBuilderNFTProxy',
        address: proxyAddress.toLowerCase() as string,
        contractArtifactSource:
          'contracts/protocol/contracts/ERC1155/ScoutProtocolBuilderNFTProxy.sol:ScoutProtocolBuilderNFTProxy',
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

      console.log(`Transferring ERC1155 Admin role to Safe Address: ${adminAddress}`);

      await newProxyContract.write.transferAdmin([adminAddress]);
    }
  });

module.exports = {};
