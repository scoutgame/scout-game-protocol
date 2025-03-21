import { parseEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';

import { getWalletClient } from '../lib/getWalletClient';
// console.log('current week', getCurrentWeek());

const account = process.env.SCOUT_PROTOCOL_SAFE_ADDRESS as `0x${string}`;
const privateKey = process.env.PRIVATE_KEY as `0x${string}`;

const tokenAddress = '0x047157CfFB8841A64DB93fd4E29fA3796B78466c'; // '0x15b3134cd5c84a59e0338745ac5e63f66abdb651';
const recipientAddress = '0x8F4f94A6aA61612f6B97EBE2d50dB7e141Dcd658';

const network = base;

async function query() {
  const walletClient = getWalletClient({
    chain: network,
    privateKey: privateKey as `0x${string}`,
    rpcUrl: network.rpcUrls.default.http[0]
  });

  const transactionCount = await walletClient.getTransactionCount({
    address: account
  });
  console.log('transactionCount', transactionCount);

  // const tx = await walletClient.writeContract({
  //   address: tokenAddress,
  //   abi: [
  //     {
  //       name: 'initialize',
  //       type: 'function',
  //       stateMutability: 'nonpayable',
  //       inputs: [],
  //       outputs: []
  //     }
  //   ],
  //   functionName: 'initialize',
  //   args: [],
  //   nonce: transactionCount + 2
  // });

  // console.log('Initialize transaction hash:', tx);
  // Poll until balance is greater than 0
  const balance = 0n;
  console.log('Waiting for token balance to be greater than 0...');

  while (balance <= 0n) {
    const implementation = await walletClient.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [],
          name: 'implementation',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address'
            }
          ],
          stateMutability: 'view',
          type: 'function'
        }
      ],
      functionName: 'implementation',
      args: []
    });
    console.log('Implementation address:', implementation);

    // if (balance <= 0n) {
    //   console.log('Current balance is still 0, waiting 2 seconds...');
    //   await new Promise((resolve) => {
    //     setTimeout(resolve, 2000);
    //   });
    // }
  }

  console.log('Token balance:', balance);

  const approvetx = await walletClient.writeContract({
    address: tokenAddress,
    abi: [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
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
        outputs: [{ type: 'bool' }]
      }
    ],
    functionName: 'approve',
    args: [account, parseEther('1000000000')],
    nonce: transactionCount + 3
  });

  console.log('Approve transaction hash:', approvetx);

  const transferTx = await walletClient.writeContract({
    address: tokenAddress,
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'from',
            type: 'address'
          },
          {
            internalType: 'address',
            name: 'to',
            type: 'address'
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256'
          }
        ],
        name: 'transferFrom',
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
    ],
    functionName: 'transferFrom',
    args: [account, recipientAddress, parseEther('1000000000')],
    nonce: transactionCount + 4
  });

  console.log('Transfer transaction hash:', transferTx);
}

query();
