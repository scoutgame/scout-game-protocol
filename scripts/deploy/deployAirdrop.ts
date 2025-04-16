import fs from 'fs';
import path from 'path';

import { TxBuilder } from '@morpho-labs/gnosis-tx-builder';
import { erc20Abi, parseUnits, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';

import { createAirdropContract } from '../../lib/airdrop/createAirdropContract';

// Export the transaction to a JSON file

const chain = baseSepolia;
const safeAddress = '0x66525057AC951a0DB5C9fa7fAC6E056D6b8997E2' as const;
// official erc20: 0x047157cffb8841a64db93fd4e29fa3796b78466c
// scout erc20: 0xfcdc6813a75df7eff31382cb956c1bee4788dd34
const erc20Token = '0x0000000000000000000000000000000000000000' as const;
const decimals = 18;

const recipients = [
  {
    address: '0x66525057AC951a0DB5C9fa7fAC6E056D6b8997E2' as const,
    amount: parseUnits('5', decimals).toString()
  },
  {
    address: '0x0000000000000000000000000000000000000000' as const,
    amount: parseUnits('.0001', decimals).toString()
  }
];

async function main() {
  const { contractAddress, deployTxHash, totalAmount, merkleTree, blockNumber } = await createAirdropContract({
    chain,
    recipients,
    adminPrivateKey: process.env.PRIVATE_KEY as `0x${string}`,
    tokenAddress: erc20Token,
    expirationTimestamp: BigInt(new Date('2025-07-28').getTime() / 1000)
  });

  console.log('Airdrop deployed', { contractAddress, deployTxHash });

  // Create a Safe transaction to approve the airdrop contract
  const safeTransaction = {
    to: erc20Token,
    value: '0',
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractAddress, totalAmount]
    })
  };

  const metaFilePath = path.join(__dirname, '../../safe-transaction-meta.json');
  fs.writeFileSync(
    metaFilePath,
    JSON.stringify(
      { blockNumber, merkleTree, deployTxHash, contractAddress, totalAmount },
      (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      },
      2
    )
  );
  console.log(`\nSafe transaction meta exported to: ${metaFilePath}`);

  const batchJson = TxBuilder.batch(safeAddress, [safeTransaction], { chainId: chain.id });
  const filePath = path.join(__dirname, '../../safe-transaction.json');
  fs.writeFileSync(filePath, JSON.stringify(batchJson, null, 2));
  console.log(`\nSafe transaction exported to: ${filePath}`);
  console.log('Import this file in the Gnosis Safe web UI to execute the transaction');
}

main().catch((error) => {
  console.error('Error running script', error);
  process.exit(1);
});
