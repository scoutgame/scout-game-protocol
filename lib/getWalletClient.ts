import type { Chain } from 'viem';
import { createPublicClient, createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export function getWalletClient({ privateKey, chain, rpcUrl }: { privateKey: string; chain: Chain; rpcUrl?: string }) {
  return createWalletClient({
    account: privateKeyToAccount((privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`),
    chain,
    transport: http(rpcUrl)
  }).extend(publicActions);
}

export function getPublicClient({ chain, rpcUrl }: { chain: Chain; rpcUrl?: string }) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
}
