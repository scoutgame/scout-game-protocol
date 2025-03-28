import { viem } from 'hardhat';
import type { Address } from 'viem';

import { generateWallets } from './generateWallets';

export async function deployScoutGamePreSeason02NftContract({
  USDCAddress,
  tokenName = 'ScoutGame (PreSeason 02)',
  tokenSymbol = 'SCOUTGAME-P02'
}: {
  USDCAddress: Address;
  tokenName?: string;
  tokenSymbol?: string;
}) {
  const { adminAccount: admin, thirdUserAccount: proceedsReceiverAccount } = await generateWallets();

  const implementation = await viem.deployContract('ScoutGamePreSeason02NFTImplementation', [], {
    client: { wallet: admin }
  });

  const proceedsReceiver = proceedsReceiverAccount.account.address;

  const proxy = await viem.deployContract(
    'ScoutGamePreSeason02NFTUpgradeable',
    [implementation.address, USDCAddress, proceedsReceiver, tokenName, tokenSymbol],
    {
      client: { wallet: admin }
    }
  );

  // Make the implementation ABI available to the proxy
  const proxyWithImplementationABI = await viem.getContractAt(
    'ScoutGamePreSeason02NFTImplementation', // Implementation ABI
    proxy.address, // Proxy address
    { client: { wallet: admin } } // Use the admin account for interaction
  );

  return {
    builderProxyContract: proxy,
    builderNftContract: proxyWithImplementationABI,
    builderImplementationContract: implementation,
    builderNftAdminAccount: admin,
    proceedsReceiverAccount
  };
}

export type BuilderNftSeason02Fixture = Awaited<ReturnType<typeof deployScoutGamePreSeason02NftContract>>;
