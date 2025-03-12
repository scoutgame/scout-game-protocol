import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { log } from '@charmverse/core/log';
import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import type { Address } from 'viem';
import {
  createWalletClient,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  publicActions
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../../lib/constants';
import { outputContractAddress } from '../../../lib/outputContract';

/**
 * Computes the deterministic address for a contract using the CREATE2 formula.
 *
 * @param {string} deployerAddress - The address of the contract calling CREATE2 (deployer address)
 * @param {string} salt - A 32-byte value used as the "salt" in the CREATE2 address generation
 * @param {string} bytecode - The raw bytecode of the contract to deploy
 * @returns {string} The calculated deterministic contract address
 */
export function computeAddress(deployerAddress: string, salt: string, bytecode: string): Address {
  // 1. Ensure deployer address is 20 bytes (40 hex characters)
  const deployerAddressCleaned = deployerAddress.toLowerCase().replace(/^0x/, '');
  if (deployerAddressCleaned.length !== 40) {
    throw new Error(
      `Deployer address must be 20 bytes (40 hex characters), but got ${deployerAddressCleaned.length} characters`
    );
  }

  // 2. Ensure salt is 32 bytes (64 hex characters)
  const saltCleaned = salt.toLowerCase().replace(/^0x/, '');
  if (saltCleaned.length !== 64) {
    throw new Error(`Salt must be 32 bytes (64 hex characters), but got ${saltCleaned.length} characters`);
  }

  // 3. Calculate the keccak256 hash of the contract's bytecode
  const creationCodeHash = keccak256(bytecode as `0x${string}`);

  // 4. Concatenate the CREATE2 inputs (ff + deployerAddress + salt + creationCodeHash)
  const data = `ff${deployerAddressCleaned}${saltCleaned}${creationCodeHash.slice(2)}`;

  // 5. Hash the data with keccak256
  const hashedData = keccak256(`0x${data}`);

  // 6. Return the last 20 bytes of the hash (skip first 12 bytes = 24 hex characters)
  const contractAddress = `0x${hashedData.slice(26)}`; // Skip 24 hex chars (12 bytes)

  return contractAddress.toLowerCase() as Address;
}

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployDeterministicScoutGameERC20', 'Deploys or updates the Scout Game ERC20 contract')
  .addOptionalParam('deployment', 'Deployment environment name for output directory structure', 'dev')
  .addOptionalParam('salt', 'Salt for deterministic deployment', `0x${randomBytes(32).toString('hex')}`)
  .setAction(async (taskArgs, hre) => {
    await hre.run('compile');

    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);
    const deploymentName = taskArgs.deployment;

    const adminAddress = getScoutProtocolSafeAddress();

    if (!isAddress(connector.foundryCreate2Deployer as string)) {
      throw new Error('DETERMINISTIC_DEPLOYER_CONTRACT_DEPLOY_CODE is not a valid address');
    }

    const DETERMINISTIC_DEPLOYER_CONTRACT = connector.foundryCreate2Deployer as Address;

    const implementationFilePath =
      'artifacts/contracts/protocol/contracts/ERC20/ScoutTokenERC20Implementation.sol/ScoutTokenERC20Implementation.json';
    // const filePath = 'artifacts/contracts/Greeter.sol/Greeter.json';

    const implementationContract = JSON.parse(fs.readFileSync(path.resolve(implementationFilePath), 'utf8'));

    const implementationBytecode = implementationContract.bytecode;

    // In case it's just 0x
    if (implementationBytecode.length <= 2) {
      throw new Error('Bytecode is empty');
    }

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: connector.chain,
      transport: http(connector.rpcUrl)
    }).extend(publicActions);

    // Generate a random 32-byte salt for deterministic deployment
    const salt = taskArgs.salt as `0x${string}`;

    log.info(`Using account ${account.address} on chain ${connector.chain.name} with salt: ${salt}`);

    // Base will hold the supply, and other L2s will be compatible

    const expectedAddress = computeAddress(DETERMINISTIC_DEPLOYER_CONTRACT, salt, implementationBytecode);

    const existingContract = await hre.viem.getContractAt('ScoutTokenERC20Implementation', expectedAddress);

    const result = await existingContract.read.admin().catch(() => null);

    // We only need to check this for implementation contract, since the proxy will be deployed deterministically as well based on same salt
    if (result) {
      log.warn('ERC20 Implementation Contract already exists at address:', expectedAddress);
      log.warn(
        'Change the salt in scripts/deploy/protocol/01_deployDeterministicScoutgameTokenERC20.ts to a different value and try again'
      );
      throw new Error('Execution terminated');
    }

    const encodedData = encodePacked(['bytes32', 'bytes'], [salt, implementationBytecode]);

    // Send the transaction with the encoded data
    await walletClient
      .sendTransaction({
        to: DETERMINISTIC_DEPLOYER_CONTRACT,
        data: encodedData as `0x${string}`,
        from: account.address,
        value: BigInt(0)
      })
      .then((_tx) => walletClient.waitForTransactionReceipt({ hash: _tx }));

    // Skip verification for supersim chains
    if (connector.chain.id !== 901 && connector.chain.id !== 902) {
      try {
        execSync(`npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${getAddress(expectedAddress)}`);
      } catch (err) {
        log.error('Error verifying contract', err);
      }
    }

    outputContractAddress({
      name: 'ScoutTokenERC20Implementation',
      address: expectedAddress,
      network: getConnectorKey(connector.chain.id),
      contractArtifactSource:
        'contracts/protocol/contracts/ERC20/ScoutTokenERC20Implementation.sol:ScoutTokenERC20Implementation',
      metadata: {
        salt
      },
      deployArgs: [],
      deploymentName
    });

    const deployedImplementation = await hre.viem.getContractAt('ScoutTokenERC20Implementation', expectedAddress);

    const proxyFilePath =
      'artifacts/contracts/protocol/contracts/ERC20/ScoutTokenERC20Proxy.sol/ScoutTokenERC20Proxy.json';

    const proxyContract = JSON.parse(fs.readFileSync(path.resolve(proxyFilePath), 'utf8'));

    const proxyImplementationBytecode = proxyContract.bytecode;

    const proxyDeployArgs = [deployedImplementation.address, adminAddress] as const;

    const proxyEncodedArgs = encodeAbiParameters([{ type: 'address' }, { type: 'address' }], proxyDeployArgs);

    const proxyBytecodeWithArgs = String(proxyImplementationBytecode).concat(
      proxyEncodedArgs.slice(2)
    ) as `0x${string}`;

    const encodedProxyData = encodePacked(['bytes32', 'bytes'], [salt, proxyBytecodeWithArgs]);

    const expectedProxyAddress = computeAddress(DETERMINISTIC_DEPLOYER_CONTRACT, salt, proxyBytecodeWithArgs);

    // Send the transaction with the encoded data
    await walletClient
      .sendTransaction({
        to: DETERMINISTIC_DEPLOYER_CONTRACT,
        data: encodedProxyData as `0x${string}`,
        from: account.address,
        value: BigInt(0)
      })
      .then((_tx) => walletClient.waitForTransactionReceipt({ hash: _tx }));

    try {
      execSync(
        `npx hardhat verify --contract contracts/protocol/contracts/ERC20/ScoutTokenERC20Proxy.sol:ScoutTokenERC20Proxy --network ${getConnectorKey(connector.chain.id)} ${getAddress(expectedProxyAddress)} ${proxyDeployArgs.join(' ')}`
      );
    } catch (err) {
      log.error('Error verifying contract', err);
    }

    log.info(`Deployed Scout Token ERC20 proxy address: ${expectedProxyAddress}`);

    outputContractAddress({
      name: 'ScoutTokenERC20Proxy',
      address: expectedProxyAddress,
      network: getConnectorKey(connector.chain.id),
      contractArtifactSource: 'contracts/protocol/contracts/ERC20/ScoutTokenERC20Proxy.sol:ScoutTokenERC20Proxy',
      metadata: {
        deployer: account.address,
        salt
      },
      deployArgs: proxyDeployArgs.slice(),
      deploymentName
    });
  });

module.exports = {};
