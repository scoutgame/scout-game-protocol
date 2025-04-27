import fs from 'fs';
import path from 'path';

import { log } from '@charmverse/core/log';
import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import type { MetaTransactionData } from '@safe-global/types-kit';
import { OperationType } from '@safe-global/types-kit';
import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';
import { encodeFunctionData, getAddress, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment } from '../../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../../lib/constants';

dotenv.config();

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

const builderRegularNftAbi = [
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

const builderStarterNftAbi = [
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
        name: 'newUriPrefix',
        type: 'string'
      }
    ],
    name: 'setUriPrefix',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: 'newUriSuffix',
        type: 'string'
      }
    ],
    name: 'setUriSuffix',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'newMaxSupply',
        type: 'uint256'
      }
    ],
    name: 'setMaxSupplyPerToken',
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

task('prepareScoutGameLaunchSafeTransaction', 'Prepares a Safe transaction to launch the Scout Game').setAction(
  async (taskArgs, hre) => {
    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    // ---------------------------------------------------------------------
    // Enter the address of all the contracts here

    // !important: Change this to the season you want to launch
    const SEASON = '2025-W17';

    const {
      nftMaxSupply,
      scoutBuilderStandardNFTProxyAddress,
      scoutBuilderStarterNFTProxyAddress,
      scoutProtocolBuilderNftMinterAddress,
      transactionType
    } = await inquirer.prompt([
      {
        type: 'input',
        name: 'scoutBuilderStandardNFTProxyAddress',
        message: '[Contract] Enter the Scout NFT ERC1155 Proxy Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'scoutBuilderStarterNFTProxyAddress',
        message: '[Contract] Enter the Scout Starter NFT ERC1155 Proxy Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'input',
        name: 'scoutProtocolBuilderNftMinterAddress',
        message: '[Wallet]Enter the Scout Protocol NFT Minter Address:',
        validate: (input) => isAddress(input) || 'Please enter a valid address'
      },
      {
        type: 'number',
        name: 'nftMaxSupply',
        message: '[Max Supply] Enter the NFT max supply:',
        validate: (input) => (input ?? 0) > 0 || 'Please enter a valid max supply'
      },
      // {
      //   type: 'input',
      //   name: 'easResolverAddress',
      //   message: '[Contract] Enter the EAS Resolver Address:',
      //   validate: (input) => isAddress(input) || 'Please enter a valid address'
      // },
      // {
      //   type: 'input',
      //   name: 'easAttesterWalletAddress',
      //   message: '[Wallet] Enter the EAS Attester Wallet Address:',
      //   validate: (input) => isAddress(input) || 'Please enter a valid address'
      // },
      {
        type: 'list',
        name: 'transactionType',
        message: 'Select the type of transaction to perform:',
        choices: ['Propose', 'Export', 'Both']
      }
    ]);

    log.info('Collected all required addresses and parameters');

    // Get contract instances and verify implementations
    const ScoutProtocolNFTProxyContract = await hre.viem.getContractAt(
      'ScoutProtocolNFTProxy',
      scoutBuilderStandardNFTProxyAddress
    );
    const scoutProtocolBuilderStarterNftProxyContract = await hre.viem.getContractAt(
      'ScoutProtocolStarterNFTProxy',
      scoutBuilderStarterNFTProxyAddress
    );

    // Verify implementations resolves
    const builderNftImplementation = await ScoutProtocolNFTProxyContract.read.implementation().catch(() => {
      console.error('Error verifying Builder NFT implementation');
      return null;
    });
    if (!builderNftImplementation || !isAddress(builderNftImplementation)) {
      throw new Error(
        'Invalid Builder NFT proxy address. Make sure you passed the proxy, not the implementation address.'
      );
    }

    const builderStarterNftImplementation = await scoutProtocolBuilderStarterNftProxyContract.read
      .implementation()
      .catch(() => {
        console.error('Error verifying Builder Starter NFT implementation');
        return null;
      });
    if (!builderStarterNftImplementation || !isAddress(builderStarterNftImplementation)) {
      throw new Error(
        'Invalid Builder Starter NFT proxy address. Make sure you passed the proxy, not the implementation address.'
      );
    }

    // const erc20Implementation = await erc20Contract.read.implementation().catch(() => {
    //   console.error('Error verifying ERC20 implementation');
    //   return null;
    // });
    // if (!erc20Implementation || !isAddress(erc20Implementation)) {
    //   throw new Error('Invalid ERC20 proxy address. Make sure you passed the proxy, not the implementation address.');
    // }

    // const protocolImplementation = await protocolContract.read.implementation().catch(() => {
    //   console.error('Error verifying Protocol implementation');
    //   return null;
    // });
    // if (!protocolImplementation || !isAddress(protocolImplementation)) {
    //   throw new Error(
    //     'Invalid Protocol proxy address. Make sure you passed the proxy, not the implementation address.'
    //   );
    // }

    // log.info('Verified all contract implementations resolve correctly');

    // Safe Address which admins all contracts
    const safeAddress = getScoutProtocolSafeAddress();

    // ERC20

    // const erc20Decimals = BigInt(10) ** BigInt(18);
    // const season01ProtocolTokenAllocationWithDecimals = BigInt(season01ProtocolTokenAllocation) * erc20Decimals;

    // if (!isAddress(scoutTokenERC20ProxyAddress)) {
    //   throw new Error('Invalid Scout Token ERC20 Proxy Address');
    // }

    /// -------- Start Safe Code --------
    const protocolKitProposer = await Safe.init({
      provider: connector.rpcUrl,
      signer: PRIVATE_KEY,
      safeAddress
    });

    const apiKit = new SafeApiKit({
      chainId: BigInt(connector.chain.id)
    });

    const safeTransactionData: MetaTransactionData[] = [];

    // Phase 1 - Initialise the ERC20 to distribute the tokens
    // console.log('Preparing the ERC20 contract...');
    // const encodedERC20Data = encodeFunctionData({
    //   abi: erc20Abi,
    //   functionName: 'initialize',
    //   args: []
    // });

    // const erc20TxData = {
    //   to: getAddress(scoutTokenERC20ProxyAddress),
    //   data: encodedERC20Data,
    //   operation: OperationType.Call,
    //   value: '0'
    // };

    // const existingContract = await hre.viem.getContractAt('ScoutTokenERC20Implementation', scoutTokenERC20ProxyAddress);

    // const isERC20Initialized = await existingContract.read.isInitialized();

    // if (!isERC20Initialized) {
    //   // await apiKit.estimateSafeTransaction(safeAddress, erc20TxData);

    //   safeTransactionData.push(erc20TxData);
    // } else {
    //   console.log('ERC20 is already initialized');
    // }

    // Phase 2 - Prepare the Builder NFT contract

    const encodedBuilderNftSetMinterData = encodeFunctionData({
      abi: builderRegularNftAbi,
      functionName: 'setMinter',
      args: [scoutProtocolBuilderNftMinterAddress]
    });

    const builderNftSetMinterTxData = {
      to: getAddress(scoutBuilderStandardNFTProxyAddress),
      data: encodedBuilderNftSetMinterData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderNftSetMinterTxData);

    safeTransactionData.push(builderNftSetMinterTxData);

    const baseUri = `https://nft.scoutgame.xyz/seasons/${SEASON}`;

    const encodedBuilderNftSetBaseUriData = encodeFunctionData({
      abi: builderRegularNftAbi,
      functionName: 'setBaseUri',
      args: [`${baseUri}/${scoutBuilderStandardNFTProxyAddress}`, 'metadata.json']
    });

    const builderNftSetBaseUriTxData = {
      to: getAddress(scoutBuilderStandardNFTProxyAddress),
      data: encodedBuilderNftSetBaseUriData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderNftSetBaseUriTxData);

    safeTransactionData.push(builderNftSetBaseUriTxData);

    // Phase 4 - Prepare the Builder Starter NFT contract

    const encodedBuilderStarterNftSetMinterData = encodeFunctionData({
      abi: builderStarterNftAbi,
      functionName: 'setMinter',
      args: [scoutProtocolBuilderNftMinterAddress]
    });

    const builderStarterNftSetMinterTxData = {
      to: getAddress(scoutBuilderStarterNFTProxyAddress),
      data: encodedBuilderStarterNftSetMinterData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderStarterNftSetMinterTxData);

    safeTransactionData.push(builderStarterNftSetMinterTxData);

    const encodedBuilderStarterNftUpdatePriceIncrementData = encodeFunctionData({
      abi: builderStarterNftAbi,
      functionName: 'updatePriceIncrement',
      args: [100 * 10 ** 18]
    });

    const builderStarterNftUpdatePriceIncrementTxData = {
      to: getAddress(scoutBuilderStarterNFTProxyAddress),
      data: encodedBuilderStarterNftUpdatePriceIncrementData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderStarterNftUpdatePriceIncrementTxData);

    safeTransactionData.push(builderStarterNftUpdatePriceIncrementTxData);

    const encodedBuilderStarterNftSetUriPrefixData = encodeFunctionData({
      abi: builderStarterNftAbi,
      functionName: 'setUriPrefix',
      args: [`${baseUri}/${scoutBuilderStarterNFTProxyAddress}`]
    });

    const builderStarterNftSetUriPrefixTxData = {
      to: getAddress(scoutBuilderStarterNFTProxyAddress),
      data: encodedBuilderStarterNftSetUriPrefixData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderStarterNftSetUriPrefixTxData);

    const encodedERC1155SetMaxSupplyPerTokenData = encodeFunctionData({
      abi: builderRegularNftAbi,
      functionName: 'setMaxSupplyPerToken',
      args: [nftMaxSupply]
    });

    const nftSetMaxSupplyPerTokenTxData = {
      to: getAddress(scoutBuilderStandardNFTProxyAddress),
      data: encodedERC1155SetMaxSupplyPerTokenData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, nftSetMaxSupplyPerTokenTxData);

    safeTransactionData.push(nftSetMaxSupplyPerTokenTxData);

    const encodedBuilderStarterNftSetUriSuffixData = encodeFunctionData({
      abi: builderStarterNftAbi,
      functionName: 'setUriSuffix',
      args: ['starter-metadata.json']
    });

    const builderStarterNftSetUriSuffixTxData = {
      to: getAddress(scoutBuilderStarterNFTProxyAddress),
      data: encodedBuilderStarterNftSetUriSuffixData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, builderStarterNftSetUriSuffixTxData);

    safeTransactionData.push(builderStarterNftSetUriSuffixTxData);

    // Phase 3 - Configure the EAS Attester Wallet

    // const encodedEASResolverSetAttesterWalletData = encodeFunctionData({
    //   abi: easResolverAbi,
    //   functionName: 'setAttesterWallet',
    //   args: [easAttesterWalletAddress]
    // });

    // const easResolverSetAttesterWalletTxData = {
    //   to: getAddress(easResolverAddress),
    //   data: encodedEASResolverSetAttesterWalletData,
    //   operation: OperationType.Call,
    //   value: '0'
    // };

    // await apiKit.estimateSafeTransaction(safeAddress, easResolverSetAttesterWalletTxData);

    // safeTransactionData.push(easResolverSetAttesterWalletTxData);

    if (safeTransactionData.length === 0) {
      throw new Error('No valid transactions to propose');
    }

    const proposeTransaction = !!(transactionType === 'Propose' || transactionType === 'Both');
    const exportTransaction = !!(transactionType === 'Export' || transactionType === 'Both');

    if (exportTransaction) {
      // Create and export transaction batch JSON
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
    }

    if (proposeTransaction) {
      const safeTransaction = await protocolKitProposer.createTransaction({
        transactions: safeTransactionData
      });

      const safeTxHash = await protocolKitProposer.getTransactionHash(safeTransaction);
      const signature = await protocolKitProposer.signHash(safeTxHash);

      const proposerAddress = privateKeyToAccount(PRIVATE_KEY).address;

      // Propose transaction to the service
      await apiKit.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderAddress: proposerAddress,
        senderSignature: signature.data
      });

      log.info(`Transaction proposed to safe`, {
        safeTxHash,
        proposerAddress,
        safeAddress
      });
    }
  }
);

module.exports = {};
