import { execSync } from 'node:child_process';

import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import type { Address } from 'viem';
import { createWalletClient, http, isAddress, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment, getConnectorKey } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../../lib/constants';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('deployEASResolver', 'Deploys or updates the EAS Resolver and scoutgame attestation schemas').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    await hre.run('compile');

    const adminAddress = getScoutProtocolSafeAddress();

    const viem = hre.viem;

    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: connector.chain,
      transport: http(connector.rpcUrl)
    }).extend(publicActions);

    console.log('Using account:', account.address, 'on chain:', connector.chain.name);

    if (!isAddress(connector.easAttestationContract as string)) {
      throw new Error(`No EAS Contract found for chain ${connector.chain.name}:${connector.chain.id}`);
    }

    console.log('Deploying the resolver contract...');

    const deployArgs = [connector.easAttestationContract as Address, account.address] as [Address, Address];

    const deployedResolver = await viem.deployContract('ProtocolEASResolver', deployArgs, {
      client: {
        wallet: walletClient
      }
    });

    const resolverAddress = deployedResolver.address;

    console.log('Verifying implementation with etherscan');
    try {
      execSync(
        `npx hardhat verify --network ${getConnectorKey(connector.chain.id)} ${resolverAddress} ${deployArgs.join(' ')}`
      );
    } catch (err) {
      console.warn('Error verifying contract', err);
    }

    console.log('EAS Resolver contract deployed at:', deployedResolver.address);

    console.log(`Transferring Admin role to Safe Address: ${adminAddress}`);

    await deployedResolver.write.transferAdmin([adminAddress], {
      account: walletClient.account
    });
  }
);

module.exports = {};
