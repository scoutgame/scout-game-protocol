import { log } from '@charmverse/core/log';
import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import type { MetaTransactionData } from '@safe-global/types-kit';
import { OperationType } from '@safe-global/types-kit';
import { task } from 'hardhat/config';
import type { Address } from 'viem';
import { encodeFunctionData, getAddress, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getConnectorFromHardhatRuntimeEnvironment } from '../../lib/connectors';
import { getScoutProtocolSafeAddress } from '../../lib/constants';

const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

task('prepareScoutGameLaunchSafeTransaction', 'Deploys or updates the Scout Game ERC20 contract').setAction(
  async (taskArgs, hre) => {
    await hre.run('compile');

    const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

    // ---------------------------------------------------------------------
    // Enter the address of all the contracts here

    // Safe Address which admins all contracts
    const safeAddress = getScoutProtocolSafeAddress();

    // ERC20
    const scoutTokenERC20ProxyAddress = '' as Address;
    const erc20Decimals = BigInt(10) ** BigInt(18);

    if (!isAddress(scoutTokenERC20ProxyAddress)) {
      throw new Error('Invalid Scout Token ERC20 Proxy Address');
    }

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

    // ERC1155
    const scoutBuilderNFTERC1155ProxyAddress = '' as Address;
    const scoutProtocolBuilderNftMinterAddress = '' as Address;

    if (!isAddress(scoutBuilderNFTERC1155ProxyAddress)) {
      throw new Error('Invalid Scout Builder NFT ERC1155 Proxy Address');
    }

    if (!isAddress(scoutProtocolBuilderNftMinterAddress)) {
      throw new Error('Invalid Scout Builder NFT Minter Address');
    }

    const nftPrefix = 'https://awsresourcehere.com/';
    const nftSuffix = 'metadata.json';

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

    // EAS Resolver Config
    const easResolverAddress = '' as Address;
    const easAttesterWalletAddress = '' as Address;

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

    if (!isAddress(easResolverAddress)) {
      throw new Error('Invalid EAS Resolver Address');
    }

    if (!isAddress(easAttesterWalletAddress)) {
      throw new Error('Invalid EAS Attester Wallet Address');
    }

    // Protocol Funding Config
    // Make sure this is the actual allocation
    const _season01ProtocolTokenAllocationAsWholeNumber = 100;

    if (_season01ProtocolTokenAllocationAsWholeNumber <= 1_000) {
      throw new Error('Invalid Season 01 Protocol Token Allocation. Make sure this is the actual allocation');
    }

    const season01ProtocolTokenAllocation = BigInt(_season01ProtocolTokenAllocationAsWholeNumber) * erc20Decimals;

    const scoutProtocolAddress = '' as Address;

    if (!isAddress(scoutProtocolAddress)) {
      throw new Error('Invalid Scout Protocol Address');
    }

    // Sablier Lockup Tranched
    const sablierLockupTranchedAddress = '' as Address;

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

    // UTC Timestamp is be in seconds
    const firstTokenDistributionTimestamp = 1_743_984_000;

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

    await apiKit.estimateSafeTransaction(safeAddress, erc20TxData);

    safeTransactionData.push(erc20TxData);

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

    await apiKit.estimateSafeTransaction(safeAddress, nftSetMinterTxData);

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

    await apiKit.estimateSafeTransaction(safeAddress, nftSetBaseUriTxData);

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

    await apiKit.estimateSafeTransaction(safeAddress, easResolverSetAttesterWalletTxData);

    safeTransactionData.push(easResolverSetAttesterWalletTxData);

    // Phase 4 - Create the stream

    const encodedLockupApproveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [scoutProtocolAddress, season01ProtocolTokenAllocation]
    });

    const lockupApproveTxData = {
      to: getAddress(sablierLockupTranchedAddress),
      data: encodedLockupApproveData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, lockupApproveTxData);

    safeTransactionData.push(lockupApproveTxData);

    const encodedLockupCreateStreamData = encodeFunctionData({
      abi: lockupAbi,
      functionName: 'createStream',
      args: [scoutProtocolAddress, season01ProtocolTokenAllocation, BigInt(firstTokenDistributionTimestamp)]
    });

    const lockupCreateStreamTxData = {
      to: getAddress(sablierLockupTranchedAddress),
      data: encodedLockupCreateStreamData,
      operation: OperationType.Call,
      value: '0'
    };

    await apiKit.estimateSafeTransaction(safeAddress, lockupCreateStreamTxData);

    safeTransactionData.push(lockupCreateStreamTxData);

    if (safeTransactionData.length === 0) {
      throw new Error('No valid transactions to propose');
    }

    const safeTransaction = await protocolKitProposer.createTransaction({
      transactions: safeTransactionData
    });

    log.info('Generated safe transaction input data');

    const safeTxHash = await protocolKitProposer.getTransactionHash(safeTransaction);
    const signature = await protocolKitProposer.signHash(safeTxHash);

    const proposerAddress = privateKeyToAccount(PRIVATE_KEY).address;

    log.info(`Proposing transaction to safe with hash ${safeTxHash}`);

    // Propose transaction to the service
    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: proposerAddress,
      senderSignature: signature.data
    });

    log.info(`Transaction proposed to safe`, { safeTxHash, proposerAddress, safeAddress });
  }
);

module.exports = {};
