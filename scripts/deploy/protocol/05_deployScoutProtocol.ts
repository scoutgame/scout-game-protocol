import { execSync } from 'node:child_process';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import type { Address } from 'viem';
import { createPublicClient, createWalletClient, http, isAddress, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress, getClaimsManagerAddress } from '../../../lib/constants';
import { outputContractAddress } from '../../../lib/outputContract';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployScoutProtocol', 'Deploys the Scout Protocol contract')
  .addOptionalParam('deployment', 'Deployment environment name for output directory structure', 'dev')
  .setAction(async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);
    const deploymentName = taskArgs.deployment;

    const adminAddress = getScoutProtocolSafeAddress();
    const claimsManagerAddress = getClaimsManagerAddress();

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

    // Deploy the implementation contract first

    const deployedImplementation = await hre.viem.deployContract('ScoutProtocolImplementation', [], {
      client: {
        wallet: walletClient
      }
    });

    const implementationAddress = deployedImplementation.address;

    outputContractAddress({
      name: 'ScoutProtocolImplementation',
      contractArtifactSource:
        'contracts/protocol/contracts/ScoutProtocol/ScoutProtocolImplementation.sol:ScoutProtocolImplementation',
      address: implementationAddress,
      network: getConnectorKey(connector.chain.id),
      deployArgs: [],
      deploymentName
    });

    if (!implementationAddress) {
      throw new Error('Failed to deploy implementation contract');
    }

    // Verify contract in the explorer
    try {
      execSync(`npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${implementationAddress}`);
    } catch (err) {
      console.warn('Error verifying contract', err);
    }

    const proxyOptions: { address?: string; env: string }[] = [];

    if (connector.scoutProtocol?.prod?.protocol) {
      proxyOptions.push({ address: connector.scoutProtocol?.prod.protocol, env: 'prod' });
    }

    if (connector.scoutProtocol?.stg?.protocol) {
      proxyOptions.push({ address: connector.scoutProtocol?.stg.protocol, env: 'stg' });
    }

    if (connector.scoutProtocol?.dev?.protocol) {
      proxyOptions.push({ address: connector.scoutProtocol?.dev.protocol, env: 'dev' });
    }

    let deployNew = true;

    // Prompt the user to update the implementation if the proxy already exists
    if (proxyOptions.length > 0) {
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
      const { paymentTokenAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'paymentTokenAddress',
          message: 'Enter the address for scout protocol ERC20 token',
          validate: (input) => (isAddress(input) ? true : 'Invalid address')
        }
      ]);

      if (!paymentTokenAddress) {
        throw new Error('Payment token address (Scout ERC20 contract) not specified in the connector');
      }

      const deployArgs = [implementationAddress, paymentTokenAddress] as [Address, Address];

      const deployedProxy = await hre.viem.deployContract('ScoutProtocolProxy', deployArgs, {
        client: {
          wallet: walletClient
        }
      });
      const proxyAddress = deployedProxy.address;

      if (!proxyAddress) {
        throw new Error(`Failed to deploy proxy`);
      }

      console.log('Scout Protocol Proxy contract deployed at:', proxyAddress);

      try {
        execSync(
          `npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${proxyAddress} ${deployArgs.join(' ')} --contract contracts/protocol/contracts/ScoutProtocol/ScoutProtocolProxy.sol:ScoutProtocolProxy`
        );
      } catch (err) {
        console.warn('Error verifying contract', err);
      }

      outputContractAddress({
        name: 'ScoutProtocolProxy',
        address: proxyAddress,
        network: getConnectorKey(connector.chain.id),
        contractArtifactSource: 'contracts/protocol/contracts/ScoutProtocol/ScoutProtocolProxy.sol:ScoutProtocolProxy',
        deployArgs: deployArgs.slice(),
        deploymentName
      });

      // Create a contract instance for the proxy to interact with the implementation
      const scoutProtocolContract = await hre.viem.getContractAt('ScoutProtocolImplementation', proxyAddress);

      console.log(`Setting Claims Manager to: ${claimsManagerAddress}`);

      try {
        // Call setClaimsManager through the proxy
        const tx = await scoutProtocolContract.write.setClaimsManager([claimsManagerAddress], {
          account: walletClient.account
        });

        console.log(`Claims Manager set successfully. Transaction hash: ${tx}`);

        // Wait for transaction receipt to confirm
        await client.waitForTransactionReceipt({ hash: tx });
      } catch (error) {
        console.error('Failed to set Claims Manager:', error);
        throw error;
      }
      console.log(`Transferring Admin role to Safe Address: ${adminAddress}`);

      await deployedProxy.write.transferAdmin([adminAddress]);
    }
  });

module.exports = {};
