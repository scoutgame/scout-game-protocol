import { viem } from 'hardhat';
import type { Address } from 'viem';

import { generateWallets } from './generateWallets';

export async function deployScoutProtocolBuilderNftContract({
  ScoutScoutTokenERC20Address,
  tokenName = 'ScoutGame (Season 01)',
  tokenSymbol = 'SCOUTGAME-S01'
}: {
  ScoutScoutTokenERC20Address: Address;
  tokenName?: string;
  tokenSymbol?: string;
}) {
  const { adminAccount: admin, thirdUserAccount: proceedsReceiverAccount } = await generateWallets();

  const implementation = await viem.deployContract('ScoutProtocolBuilderNFTImplementation', [], {
    client: { wallet: admin }
  });

  const proceedsReceiver = proceedsReceiverAccount.account.address;

  const proxy = await viem.deployContract(
    'ScoutProtocolBuilderNFTProxy',
    [implementation.address, ScoutScoutTokenERC20Address, proceedsReceiver, tokenName, tokenSymbol],
    {
      client: { wallet: admin }
    }
  );

  // Make the implementation ABI available to the proxy
  const proxyWithImplementationABI = await viem.getContractAt(
    'ScoutProtocolBuilderNFTImplementation', // Implementation ABI
    proxy.address, // Proxy address
    { client: { wallet: admin } } // Use the admin account for interaction
  );

  await proxyWithImplementationABI.write.setMaxSupplyPerToken([BigInt(50)]);

  return {
    builderProxyContract: proxy,
    builderNftContract: proxyWithImplementationABI,
    builderImplementationContract: implementation,
    builderNftAdminAccount: admin,
    proceedsReceiverAccount
  };
}

export type ScoutProtocolBuilderNFTFixture = Awaited<ReturnType<typeof deployScoutProtocolBuilderNftContract>>;
