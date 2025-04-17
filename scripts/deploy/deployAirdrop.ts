import fs from 'fs';
import path from 'path';

import { TxBuilder } from '@morpho-labs/gnosis-tx-builder';
import { erc20Abi, parseUnits, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

import { createAirdropContract } from '../../lib/airdrop/createAirdropContract';

const airdropRecipients = JSON.parse(fs.readFileSync(path.join(__dirname, '../../airdrop_recipients.json'), 'utf8'));

// process.exit(0);
// Export the transaction to a JSON file

const chain = base;
// official safe: 0xC03a5f0352Ab5CC235B30976714AbfeA38772034
// matt dev safe: 0x93cc4a36D510B9D65325A795EE41201f9232fa4D
// matt/safwan safe: 0xc5F05D788BC3e5Bc4897FFc54D17d6B17f4E5700
const safeAddress = '0xc5F05D788BC3e5Bc4897FFc54D17d6B17f4E5700' as const;
// official erc20: 0x047157cffb8841a64db93fd4e29fa3796b78466c
// scout erc20: 0xfcdc6813a75df7eff31382cb956c1bee4788dd34
const erc20Token = '0xfcdc6813a75df7eff31382cb956c1bee4788dd34' as const;
const decimals = 18;

async function main() {
  const recipients = airdropRecipients.map((recipient: { address: string; amount: number }) => ({
    address: recipient.address as `0x${string}`,
    amount: parseUnits(recipient.amount.toString(), decimals).toString()
  }));

  if (recipients.length < 2) {
    console.error('No recipients found');
    process.exit(1);
  }

  const { contractAddress, deployTxHash, totalAmount, merkleTree, blockNumber } = await createAirdropContract({
    chain,
    recipients,
    adminPrivateKey: process.env.PRIVATE_KEY as `0x${string}`,
    tokenAddress: erc20Token,
    expirationTimestamp: BigInt(new Date('2025-07-28').getTime() / 1000),
    tokenHolderAddress: safeAddress
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
