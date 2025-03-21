import { readFileSync } from 'fs';
import { join } from 'path';

import dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import { parseUnits, formatUnits } from 'viem/utils';

// Load environment variables
dotenv.config();

// Load ABI
const abi = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../artifacts/contracts/protocol/contracts/ERC20/ScoutTokenERC20Implementation.sol/ScoutTokenERC20Implementation.json'
    )
  ).toString()
).abi;

async function main() {
  // Configuration
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || 'https://mainnet.optimism.io';

  if (!TOKEN_ADDRESS) {
    throw new Error('TOKEN_ADDRESS not set in environment variables');
  }

  if (!RECIPIENT_ADDRESS) {
    throw new Error('RECIPIENT_ADDRESS not set in environment variables');
  }

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not set in environment variables');
  }

  // Create account from private key
  const account = privateKeyToAccount(
    (PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`
  );
  console.log(`Using account: ${account.address}`);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: optimism, // Change to the appropriate chain
    transport: http(RPC_URL)
  });

  // Create public client
  const publicClient = createPublicClient({
    chain: optimism, // Change to the appropriate chain
    transport: http(RPC_URL)
  });

  try {
    // Get token details
    const tokenName = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'name'
    });

    const tokenSymbol = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'symbol'
    });

    const tokenDecimals = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'decimals'
    });

    console.log(`Connected to token: ${tokenName} (${tokenSymbol})`);

    // Calculate token amount with decimals (1 billion tokens)
    const amount = parseUnits('1000000000', Number(tokenDecimals));

    // Check balance
    const balance = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'balanceOf',
      args: [account.address]
    });

    console.log(`Your balance: ${formatUnits(balance, Number(tokenDecimals))} ${tokenSymbol}`);

    if (balance < amount) {
      console.error(
        `Insufficient balance. You have ${formatUnits(balance, Number(tokenDecimals))} ${tokenSymbol}, but trying to transfer ${formatUnits(amount, Number(tokenDecimals))} ${tokenSymbol}`
      );
      return;
    }

    console.log(`Transferring ${formatUnits(amount, Number(tokenDecimals))} ${tokenSymbol} to ${RECIPIENT_ADDRESS}...`);

    // Transfer tokens
    const hash = await walletClient.writeContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'transfer',
      args: [RECIPIENT_ADDRESS as `0x${string}`, amount]
    });

    console.log(`Transaction submitted: ${hash}`);
    console.log('Waiting for transaction confirmation...');

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash
    });

    console.log(`Transaction confirmed in block ${receipt.blockNumber}!`);

    // Verify new balances
    const newSenderBalance = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'balanceOf',
      args: [account.address]
    });

    const newRecipientBalance = await publicClient.readContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi,
      functionName: 'balanceOf',
      args: [RECIPIENT_ADDRESS as `0x${string}`]
    });

    console.log(`Your new balance: ${formatUnits(newSenderBalance, Number(tokenDecimals))} ${tokenSymbol}`);
    console.log(`Recipient balance: ${formatUnits(newRecipientBalance, Number(tokenDecimals))} ${tokenSymbol}`);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
