import fs from 'fs';
import path from 'path';

import { log } from '@charmverse/core/log';
import type { MetaTransactionData } from '@safe-global/types-kit';
import { OperationType } from '@safe-global/types-kit';
import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import { encodeFunctionData, getAddress, isAddress } from 'viem';

import { getConnectorFromHardhatRuntimeEnvironment } from '../../../lib/connectors';

dotenv.config();

const erc20Abi = [
  {
    inputs: [],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'approve',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const erc1155Abi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_minter',
        type: 'address'
      }
    ],
    name: 'setMinter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_prefix',
        type: 'string'
      },
      {
        internalType: 'string',
        name: '_suffix',
        type: 'string'
      }
    ],
    name: 'setBaseUri',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const easResolverAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_attesterWallet',
        type: 'address'
      }
    ],
    name: 'setAttesterWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const lockupAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'recipient',
        type: 'address'
      },
      {
        internalType: 'uint128',
        name: 'totalAmount',
        type: 'uint128'
      },
      {
        internalType: 'uint128',
        name: '_startDate',
        type: 'uint128'
      }
    ],
    name: 'createStream',
    outputs: [
      {
        internalType: 'uint256',
        name: 'streamId',
        type: 'uint256'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

task('prepareScoutGameLaunchSafeTransaction', 'Prepares a Safe transaction to launch the Scout Game').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    // ---------------------------------------------------------------------
    // Enter the address of all the contracts here

    const {
      easAttesterWalletAddress,
      easResolverAddress,
      // UTC Timestamp is be in seconds
      // https://www.epochconverter.com/ is a great tool for getting a timestamp for a date
      // The timestamp should be lower than or equal to midnight of the start of week 02 of the season
      firstTokenDistributionTimestamp,
      nftPrefix,
      nftSuffix,
      sablierLockupTranchedAddress,
      scoutBuilderNFTERC1155ProxyAddress,
      scoutProtocolAddress,
      scoutProtocolBuilderNftMinterAddress,
      scoutTokenERC20ProxyAddress,
      season01ProtocolTokenAllocation
    } = await inquirer.prompt([
      {
        type: 'input',
        name: 'scoutTokenERC20ProxyAddress',
        message: '[Contract] Enter the Scout Token ERC20 Proxy Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'scoutBuilderNFTERC1155ProxyAddress',
        message: '[Contract] Enter the Scout Builder NFT ERC1155 Proxy Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'scoutProtocolBuilderNftMinterAddress',
        message: '[Wallet]Enter the Scout Protocol Builder NFT Minter Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'nftPrefix',
        message: '[Base URL] Enter the NFT metadata prefix URL:',
        validate: (input) => {
          try {
            // eslint-disable-next-line no-new
            new URL(input);
            return !input.includes('awsresourcehere') || 'Please enter the actual AWS URL for storing the NFT images';
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'nftSuffix',
        message: '[Filename] Enter the NFT metadata suffix:',
        default: 'metadata.json'
      },
      {
        type: 'input',
        name: 'easResolverAddress',
        message: '[Contract] Enter the EAS Resolver Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'easAttesterWalletAddress',
        message: '[Wallet] Enter the EAS Attester Wallet Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'number',
        name: 'season01ProtocolTokenAllocation',
        message: '[Token Amount] Enter the Season 01 Protocol Token Allocation (whole number without 18 decimals):',
        validate: (input) => (input ?? 0) > 1000 || 'Allocation must be greater than 1000'
      },
      {
        type: 'input',
        name: 'scoutProtocolAddress',
        message: '[Contract] Enter the Scout Protocol Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'sablierLockupTranchedAddress',
        message: '[Contract] Enter the Sablier Lockup Tranched Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'number',
        name: 'firstTokenDistributionTimestamp',
        message: '[Date] Enter the first token distribution timestamp (UTC in seconds):',
        validate: (input) => (input ?? 0) > 0 || 'Please enter a valid timestamp'
      }
    ]);

    log.info('Collected all required addresses and parameters');

    // Get contract instances and verify implementations
    const erc1155Contract = await hre.viem.getContractAt(
      'ScoutProtocolBuilderNFTProxy',
      scoutBuilderNFTERC1155ProxyAddress
    );
    const erc20Contract = await hre.viem.getContractAt('ScoutTokenERC20Proxy', scoutTokenERC20ProxyAddress);
    const protocolContract = await hre.viem.getContractAt('ScoutProtocolProxy', scoutProtocolAddress);

    // Verify implementations resolves
    const erc1155Implementation = await erc1155Contract.read.implementation().catch(() => {
      console.error('Error verifying ERC1155 implementation');
      return null;
    });
    if (!erc1155Implementation || !isAddress(erc1155Implementation)) {
      throw new Error('Invalid ERC1155 proxy address. Make sure you passed the proxy, not the implementation address.');
    }

    const erc20Implementation = await erc20Contract.read.implementation().catch(() => {
      console.error('Error verifying ERC20 implementation');
      return null;
    });
    if (!erc20Implementation || !isAddress(erc20Implementation)) {
      throw new Error('Invalid ERC20 proxy address. Make sure you passed the proxy, not the implementation address.');
    }

    const protocolImplementation = await protocolContract.read.implementation().catch(() => {
      console.error('Error verifying Protocol implementation');
      return null;
    });
    if (!protocolImplementation || !isAddress(protocolImplementation)) {
      throw new Error(
        'Invalid Protocol proxy address. Make sure you passed the proxy, not the implementation address.'
      );
    }

    log.info('Verified all contract implementations resolve correctly');

    // ERC20

    const erc20Decimals = BigInt(10) ** BigInt(18);
    const season01ProtocolTokenAllocationWithDecimals = BigInt(season01ProtocolTokenAllocation) * erc20Decimals;

    if (!isAddress(scoutTokenERC20ProxyAddress)) {
      throw new Error('Invalid Scout Token ERC20 Proxy Address');
    }

    /// -------- Start Safe Code --------
    const safeTransactionData: MetaTransactionData[] = [];

    // Phase 1 - Initialise the ERC20 to distribute the tokens
    console.log('Preparing the ERC20 contract...');
    const encodedERC20Data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'initialize',
      args: []
    });

    const erc20TxData = {
      to: getAddress(scoutTokenERC20ProxyAddress),
      data: encodedERC20Data,
      operation: OperationType.Call,
      value: '0'
    };

    const existingContract = await hre.viem.getContractAt('ScoutTokenERC20Implementation', scoutTokenERC20ProxyAddress);

    const isERC20Initialized = await existingContract.read.isInitialized();

    if (!isERC20Initialized) {
      // await apiKit.estimateSafeTransaction(safeAddress, erc20TxData);

      safeTransactionData.push(erc20TxData);
    } else {
      console.log('ERC20 is already initialized');
    }

    // Phase 2 - Prepare the Builder NFT contract

    const encodedERC1155SetMinterData = encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setMinter',
      args: [scoutProtocolBuilderNftMinterAddress]
    });

    const nftSetMinterTxData = {
      to: getAddress(scoutBuilderNFTERC1155ProxyAddress),
      data: encodedERC1155SetMinterData,
      operation: OperationType.Call,
      value: '0'
    };

    // await apiKit.estimateSafeTransaction(safeAddress, nftSetMinterTxData);

    safeTransactionData.push(nftSetMinterTxData);

    const encodedERC1155SetBaseUriData = encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setBaseUri',
      args: [nftPrefix, nftSuffix]
    });

    const nftSetBaseUriTxData = {
      to: getAddress(scoutBuilderNFTERC1155ProxyAddress),
      data: encodedERC1155SetBaseUriData,
      operation: OperationType.Call,
      value: '0'
    };

    // await apiKit.estimateSafeTransaction(safeAddress, nftSetBaseUriTxData);

    safeTransactionData.push(nftSetBaseUriTxData);

    // Phase 3 - Configure the EAS Attester Wallet

    const encodedEASResolverSetAttesterWalletData = encodeFunctionData({
      abi: easResolverAbi,
      functionName: 'setAttesterWallet',
      args: [easAttesterWalletAddress]
    });

    const easResolverSetAttesterWalletTxData = {
      to: getAddress(easResolverAddress),
      data: encodedEASResolverSetAttesterWalletData,
      operation: OperationType.Call,
      value: '0'
    };

    // await apiKit.estimateSafeTransaction(safeAddress, easResolverSetAttesterWalletTxData);

    safeTransactionData.push(easResolverSetAttesterWalletTxData);

    // Phase 4 - Approve the Sablier Lockup to transfer the tokens

    const encodedLockupApproveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [sablierLockupTranchedAddress, season01ProtocolTokenAllocationWithDecimals]
    });

    const lockupApproveTxData = {
      to: getAddress(scoutTokenERC20ProxyAddress),
      data: encodedLockupApproveData,
      operation: OperationType.Call,
      value: '0'
    };

    // await apiKit.estimateSafeTransaction(safeAddress, lockupApproveTxData);

    safeTransactionData.push(lockupApproveTxData);

    const encodedLockupCreateStreamData = encodeFunctionData({
      abi: lockupAbi,
      functionName: 'createStream',
      args: [scoutProtocolAddress, season01ProtocolTokenAllocationWithDecimals, BigInt(firstTokenDistributionTimestamp)]
    });

    const lockupCreateStreamTxData = {
      to: getAddress(sablierLockupTranchedAddress),
      data: encodedLockupCreateStreamData,
      operation: OperationType.Call,
      value: '0'
    };

    // await apiKit.estimateSafeTransaction(safeAddress, lockupCreateStreamTxData);

    safeTransactionData.push(lockupCreateStreamTxData);

    if (safeTransactionData.length === 0) {
      throw new Error('No valid transactions to propose');
    }

    // const safeTransaction = await protocolKitProposer.createTransaction({
    //   transactions: safeTransactionData
    // });

    // log.info('Generated safe transaction input data');

    // const safeTxHash = await protocolKitProposer.getTransactionHash(safeTransaction);
    // const signature = await protocolKitProposer.signHash(safeTxHash);

    // const proposerAddress = privateKeyToAccount(PRIVATE_KEY).address;

    // Create and export transaction batch JSON
    const exportTransactionBatch = async () => {
      // Extract contract methods when possible
      const transactionsWithMethods = safeTransactionData.map((tx) => {
        // Basic transaction data
        const txData = {
          to: tx.to,
          value: tx.value,
          data: tx.data || null,
          contractMethod: null,
          contractInputsValues: null
        };

        // Try to extract method information if available
        // This is a simplified approach - in a production environment you might want to
        // decode the function call more precisely using the ABI
        return txData;
      });

      const txBatchData = {
        version: '1.0',
        chainId: connector.chain.id.toString(),
        createdAt: Date.now(),
        meta: {
          txBuilderVersion: '1.17.1'
        },
        transactions: transactionsWithMethods
      };

      // Write to file
      const filePath = path.join(process.cwd(), 'scout-protocol-tx-batch.json');

      fs.writeFileSync(filePath, JSON.stringify(txBatchData, null, 2));

      log.info(`Transaction batch exported to ${filePath}`);
      return filePath;
    };

    const exportedFilePath = await exportTransactionBatch();
    log.info(`Exported transaction batch to ${exportedFilePath}`);

    // // Propose transaction to the service
    // await apiKit.proposeTransaction({
    //   safeAddress,
    //   safeTransactionData: safeTransaction.data,
    //   safeTxHash,
    //   senderAddress: proposerAddress,
    //   senderSignature: signature.data
    // });

    // log.info(`Transaction proposed to safe`, { safeTxHash, proposerAddress, safeAddress });
  }
);

module.exports = {};
