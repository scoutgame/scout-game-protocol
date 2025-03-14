import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import type { Address } from 'viem';
import { createPublicClient, createWalletClient, http, isAddress, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey, proceedsReceiver } from '../../../lib/connectors';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployScoutGameStarterPackNFT', 'Deploys or updates the BuilderNFT Starter Pack contracts').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    await hre.run('compile');

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

    console.log('Using account:', account.address, 'on chain:', connector.chain.name);

    // Ask if user wants to use existing implementation
    const { useExistingImplementation } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExistingImplementation',
        message: 'Do you want to use an existing implementation contract?',
        default: false
      }
    ]);

    let implementationAddress: Address | undefined;
    let implementationABI: any;

    if (useExistingImplementation) {
      const { existingImplementationAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'existingImplementationAddress',
          message: 'Enter the existing implementation contract address:',
          validate: (input: string) => {
            if (!isAddress(input)) {
              return 'Please enter a valid Ethereum address';
            }
            return true;
          }
        }
      ]);
      implementationAddress = existingImplementationAddress as Address;
      const implementation = await hre.viem.getContractAt(
        'ScoutGameStarterPackNFTImplementation',
        implementationAddress
      );
      implementationABI = implementation.abi;
      console.log('Using existing implementation at:', implementationAddress);
    } else {
      // Deploy the implementation contract first
      console.log('Deploying the implementation contract...');

      const implementation = await hre.viem.deployContract('ScoutGameStarterPackNFTImplementation', [], {
        client: {
          wallet: walletClient
        }
      });

      implementationAddress = implementation.address;
      implementationABI = implementation.abi;

      console.log('Implementation contract deployed at address:', implementationAddress);

      // Verify contract in the explorer
      console.log('Verifying implementation with etherscan');
      try {
        execSync(`npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${implementationAddress}`);
      } catch (err) {
        console.warn('Error verifying contract', err);
      }

      fs.writeFileSync(
        path.resolve('abis', 'ScoutGameStarterPackNFTImplementation.json'),
        JSON.stringify(implementationABI, null, 2)
      );
    }

    let deployNew = true;

    const proxyOptions = [];

    if (connector.seasonOneStarterPack) {
      if (connector.seasonOneStarterPack.dev?.starterPack) {
        proxyOptions.push({ address: connector.seasonOneStarterPack.dev.starterPack, env: 'dev' });
      }

      if (connector.seasonOneStarterPack.stg?.starterPack) {
        proxyOptions.push({ address: connector.seasonOneStarterPack.stg.starterPack, env: 'stg' });
      }

      if (connector.seasonOneStarterPack.prod?.starterPack) {
        proxyOptions.push({ address: connector.seasonOneStarterPack.prod.starterPack, env: 'prod' });
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
      let paymentToken = connector.usdcContract;

      if (!isAddress(paymentToken as any)) {
        ({ paymentToken } = await inquirer.prompt([
          {
            type: 'input',
            name: 'paymentToken',
            message: 'Enter the address for scout protocol ERC20 token',
            validate: (input) => (isAddress(input) ? true : 'Invalid address')
          }
        ]));
      }

      const { tokenName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenName',
          message: 'Enter the token name',
          validate: (input) => {
            const expectedMatch = /^Scout Game Starter Pack \(PreSeason \d{1,2}\)/;

            if (!input.match(expectedMatch)) {
              return 'Token name must match the expected format: "Scout Game Starter Pack (PreSeason X)"';
            }

            return true;
          }
        }
      ]);

      const { tokenSymbol } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenSymbol',
          message: 'Enter the token symbol',
          validate: (input) => {
            const expectedMatch = /^SCOUTGAME-STARTER-P\d{1,2}$/;

            if (!input.match(expectedMatch)) {
              return 'Token symbol must match the expected format: "SCOUTGAME-STARTER-PX"';
            }

            return true;
          }
        }
      ]);

      const deployConfigArgs = [implementationAddress as Address, paymentToken as Address, proceedsReceiver] as [
        Address,
        Address,
        Address
      ];

      const tokenInfoArgs = [tokenName.trim(), tokenSymbol.trim()] as [string, string];

      const deployArgs = [...deployConfigArgs, ...tokenInfoArgs] as [Address, Address, Address, string, string];

      const newProxyContract = await hre.viem.deployContract('ScoutGameStarterPackNFTProxy', deployArgs, {
        client: {
          wallet: walletClient
        }
      });

      const proxyAddress = newProxyContract.address;

      console.log('Proxy contract deployed at address:', proxyAddress);

      console.log('Verifying proxy contract with etherscan..');
      try {
        execSync(
          `npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${proxyAddress} ${deployConfigArgs.join(' ')} ${[`'${tokenName.trim()}'`, `${tokenSymbol.trim()}`].join(' ')}`
        );
      } catch (err) {
        console.warn('Error verifying contract', err);
      }

      fs.writeFileSync(path.resolve('abis', 'ScoutProtocolProxy.json'), JSON.stringify(newProxyContract.abi, null, 2));
    }
  }
);

module.exports = {};
