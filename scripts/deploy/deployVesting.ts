import { execSync } from 'node:child_process';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import type { Address } from 'viem';
import { createWalletClient, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey } from '../../lib/connectors';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployVesting', 'Deploys or updates the Sablier Vesting contract').setAction(async (taskArgs, hre) => {
  const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

  await hre.run('compile');

  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: connector.chain,
    transport: http(connector.rpcUrl)
  });

  // Deploy the implementation contract first
  const { erc20Address } = await inquirer.prompt([
    {
      type: 'input',
      name: 'erc20Address',
      message: 'Enter the address for the Scout ERC20 token',
      validate: (input) => (isAddress(input) ? true : 'Invalid address')
    }
  ]);

  const deployArgs = [erc20Address, connector.sablier?.SablierV2LockupTranched as Address] as [Address, Address];

  const deployedSablierLockup = await hre.viem.deployContract('LockupWeeklyStreamCreator', deployArgs, {
    client: {
      wallet: walletClient
    }
  });

  const sablierLockupAddress = deployedSablierLockup.address;

  if (!sablierLockupAddress) {
    throw new Error('Failed to deploy erc20 contract');
  }

  console.log('Sablier Vesting contract deployed at:', sablierLockupAddress);

  // Verify contract in the explorer

  try {
    execSync(
      `npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${sablierLockupAddress} ${deployArgs.join(' ')}`
    );
  } catch (err) {
    console.warn('Error verifying contract', err);
  }
});

module.exports = {};
