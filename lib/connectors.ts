import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Address, Chain } from 'viem';
import { base, baseSepolia, optimism, optimismSepolia, sepolia } from 'viem/chains';

import { NULL_EVM_ADDRESS } from './constants';

// https://app.ens.domains/scoutgame.eth
export const proceedsReceiver = '0x93326D53d1E8EBf0af1Ff1B233c46C67c96e4d8D';

export type ContractDeploymentEnvironment = 'dev' | 'stg' | 'prod';

type ContractDeployment<T extends string> = Partial<Record<ContractDeploymentEnvironment, Record<T, Address>>>;

type SingleContractDeployment = Partial<Record<ContractDeploymentEnvironment, Address | null>>;

type Connector = {
  chain: Chain;
  rpcUrl: string;
  // See https://docs.attest.org/docs/quick--start/contracts for full list
  easContract?: Address;
  foundryCreate2Deployer?: string;
  builderNFTContract?: Address;
  usdcContract?: Address;
  seasonOneProxy?: Address | null;
  devProxy?: Address | null;
  testDevProxy?: Address | null;
  easBaseUrl?: string;
  easAttestationContract?: Address | null;
  seasonOneStarterPack?: ContractDeployment<'starterPack'>;
  sablier?: {
    SablierV2LockupTranched: Address | null;
  };
  preseason02Nft?: SingleContractDeployment;
  preseason02StarterPack?: SingleContractDeployment;
  scoutProtocolBuilderNFT?: SingleContractDeployment;
  scoutProtocol?: ContractDeployment<'protocol' | 'easResolver' | 'sablierLockup'>;
  scoutERC20?: SingleContractDeployment;
  superchainBridge?: Address | null;
};

/**
 *
 * USDC Mainnet https://developers.circle.com/stablecoins/docs/usdc-on-main-networks
 * USDC Testnet https://developers.circle.com/stablecoins/docs/usdc-on-test-networks
 */

export const connectors = {
  opsepolia: {
    rpcUrl: 'https://opt-sepolia.g.alchemy.com/v2/0rLYBVk_UG9HAInXCNbYMX-gO5t1UxCM',
    foundryCreate2Deployer: '0x4e59b44847b379578588920ca78fbf26c0b4956c',
    chain: optimismSepolia,
    easContract: '0x4200000000000000000000000000000000000021',
    builderNFTContract: '0xbd7b21e803147e0dcb698f6f76ce6dd530a545dd',
    usdcContract: '0x101e1C9757C99867a39Ceb41117B44F2292cB253',
    seasonOneProxy: '0x743ec903fe6d05e73b19a6db807271bb66100e83',
    devProxy: '0x26d76d564910c063d0953d8636add5027c0337ce',
    seasonOneStarterPack: {
      dev: {
        starterPack: '0x2df3291c35526d4962476aa87b72ac4d99c0366a'
      }
    }
  } as Connector,
  optimism: {
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/0rLYBVk_UG9HAInXCNbYMX-gO5t1UxCM',
    chain: optimism,
    easContract: NULL_EVM_ADDRESS,
    luckyStarCoinContract: NULL_EVM_ADDRESS,
    builderNFTContract: '0x7df4d9f54a5cddfef50a032451f694d6345c60af',
    usdcContract: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    seasonOneProxy: '0x743ec903fe6d05e73b19a6db807271bb66100e83',
    devProxy: '0x1d305a06cb9dbdc32e08c3d230889acb9fe8a4dd',
    testDevProxy: '0x2cba9c6e0c14da826b0ec689cabf02a6f6b9808e',
    seasonOneStarterPack: {
      dev: {
        starterPack: '0xaed6174a1936a089df22f7eaf85ffddf37bd3ff4'
      },
      stg: {
        starterPack: '0xd85b1e922b70f4577aeff71c027efa5b6c1c9598'
      },
      prod: {
        starterPack: '0xd0b718589a51b07d05f03b8150e830d3627da972'
      }
    },
    preseason02Nft: {
      stg: '0xbec9119e3e31bcd88acfe949afe9ca3ab7d00d44',
      prod: '0x6fbbd55274169d67f6fe9c868327003c90143440'
    },
    preseason02StarterPack: {
      stg: '0xbecac59ad40691f0a5192d790fccc798854115a1',
      prod: '0xcbbdb9e378a4c33b1b202392b10e1be5e01a97f8'
    }
  } as Connector,
  sepolia: {
    rpcUrl: 'https://eth-sepolia-public.unifra.io',
    chain: sepolia,
    easContract: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    easAttestationContract: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    luckyStarCoinContract: NULL_EVM_ADDRESS,
    builderNFTContract: NULL_EVM_ADDRESS,
    usdcContract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  } as Connector,
  basesepolia: {
    rpcUrl: 'https://sepolia.base.org',
    chain: baseSepolia,
    easContract: NULL_EVM_ADDRESS,
    luckyStarCoinContract: NULL_EVM_ADDRESS,
    foundryCreate2Deployer: '0x4e59b44847b379578588920ca78fbf26c0b4956c',
    // This is the new version of the contract with a sudo-type mint
    builderNFTContract: '0xec66b6a6c2ce744543517776ff9906cd41c50a63',
    usdcContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    scoutgameEASResolver: '0x0cf1faf544bf98b062995848cc03cc8714bbca52',
    scoutgameErc20Token: '0x3fb476010cc55aca277e48e5a1f25fc096a21cc6',
    scoutgameScoutProtocolProxy: '0x2271eac711b718110996c2a5dceb3d50eca942b2',
    scoutgameEASResolverDev: '0xb9115c33820ce213449c38949c4e1927787ad902',
    scoutgameErc20TokenDev: '0x8a392ed8dafd051998fcba376468c6e2992b92f0',
    scoutgameScoutProtocolProxyDev: '0xdf6b022854cf0df9a15f923f0c3df55d099899e1',
    easAttestationContract: '0x4200000000000000000000000000000000000021',
    easBaseUrl: 'https://base-sepolia.easscan.org',
    preseason02Nft: {
      dev: '0xc028fbb5e521faf6641e3b5b091238887ba4f639',
      stg: '0x8f2d2de6e1a7227021ad0ee3095fa3159560f96c'
    },
    scoutERC20: {
      dev: '0xd7A8ba597DDbec8A4C1291B22163F836671DD9d1',
      stg: '0xa5a71c88478894077650f27dd7b14fdabe3a03f0',
      prod: '0xa0e70d2ab609ec1aff5d8ef3c69c081492ebba67'
    },
    scoutProtocolBuilderNFT: {
      dev: '0xf04166ce2d59286750482d2cb6af76db0c7d7f71',
      stg: '0x79fde83f36dd0946eba86bd69fc0ea146cd397d2',
      prod: '0x3a6f983b305decf178d073448c976337acecca9f'
    },
    scoutProtocol: {
      dev: {
        protocol: '0xdb8ed5951d51e31a2f6e751a45680c121e44f010',
        easResolver: '0x0cf1faf544bf98b062995848cc03cc8714bbca52',
        sablierLockup: '0x943f493d3b6c7a8d7e0b48f67f84c17b0177dba2'
      },
      stg: {
        protocol: '0x5ba1cf70b94592e21ff1b68b3c0e68c0c2279865',
        easResolver: '0x0cf1faf544bf98b062995848cc03cc8714bbca52',
        sablierLockup: '0xcea98f113eab979e3e9bce0053b8c45fe593e617'
      },
      prod: {
        protocol: '0x2ebc86991ddd234c0116c7e35acf81d4bf691376',
        easResolver: '0x0cf1faf544bf98b062995848cc03cc8714bbca52',
        sablierLockup: '0xF527180346De65A5982E35E354F28a8E86211763'
      }
    },
    sablier: {
      // https://docs.sablier.com/contracts/v2/deployments#base-sepolia
      SablierV2LockupTranched: '0xb8c724df3eC8f2Bf8fA808dF2cB5dbab22f3E68c'
    }
  } as Connector,
  base: {
    rpcUrl: 'https://mainnet.base.org',
    chain: base,
    foundryCreate2Deployer: '0x4e59b44847b379578588920ca78fbf26c0b4956c',
    easContract: NULL_EVM_ADDRESS,
    luckyStarCoinContract: NULL_EVM_ADDRESS,
    builderNFTContract: '0x278cc8861cfc93ea47c9e89b1876d0def2037c27',
    usdcContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    easAttestationContract: '0x4200000000000000000000000000000000000021',
    easBaseUrl: 'https://base.easscan.org',
    sablier: {
      SablierV2LockupTranched: '0xf4937657Ed8B3f3cB379Eed47b8818eE947BEb1e'
    }
  } as Connector,
  supersimL1: {
    rpcUrl: 'http://127.0.0.1:8545',
    chain: {
      ...optimismSepolia,
      id: 900,
      rpcUrls: {
        default: 'http://127.0.0.1:8545' as any
      }
    },
    scoutERC20: {
      dev: '0xa08d278fb5dcb212bf0274e2728a8ec5fd951829'
    }
  } as Connector,
  supersimL2A: {
    rpcUrl: 'http://127.0.0.1:9545',
    foundryCreate2Deployer: '0x7df4d9f54a5cddfef50a032451f694d6345c60af',
    chain: {
      ...optimismSepolia,
      name: 'Supersim L2A',
      id: 901,
      rpcUrls: {
        default: 'http://127.0.0.1:9545' as any
      }
    },
    scoutERC20: {
      dev: '0xa08d278fb5dcb212bf0274e2728a8ec5fd951829'
    },
    superchainBridge: '0x4200000000000000000000000000000000000028'
  } as Connector,
  supersimL2B: {
    rpcUrl: 'http://127.0.0.1:9546',
    foundryCreate2Deployer: '0x7df4d9f54a5cddfef50a032451f694d6345c60af',
    chain: {
      ...optimismSepolia,
      name: 'Supersim L2B',
      rpcUrls: {
        default: 'http://127.0.0.1:9546' as any
      },
      id: 902
    },
    scoutERC20: {
      dev: {
        scoutERC20: '0xa08d278fb5dcb212bf0274e2728a8ec5fd951829'
      } as any
    },
    superchainBridge: '0x4200000000000000000000000000000000000028'
  } as Connector
} as const;

export function getConnectorKey(chainId: number) {
  const key = Object.entries(connectors).find(([, val]) => val.chain.id === chainId)?.[0];

  if (!key) {
    throw new Error('Key not found');
  }

  return key;
}

export type SupportedChains = keyof typeof connectors;

export function getConnectorFromHardhatRuntimeEnvironment(hre: HardhatRuntimeEnvironment): Connector {
  const chainName = hre.hardhatArguments.network;

  if (!chainName) {
    throw new Error('No network specified');
  }

  const connector = connectors[chainName as SupportedChains];

  if (!connector) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  return connector;
}

export function getEasUrl({
  chain,
  type,
  uid
}: {
  chain: SupportedChains;
  type: 'schemas_list' | 'schema' | 'attestion';
  uid?: string;
}) {
  const baseUrl = connectors[chain].easBaseUrl || '';

  if (type === 'schemas_list') {
    return `${baseUrl}/schemas`;
  } else if (type === 'schema') {
    return `${baseUrl}/schema/view/${uid}`;
  } else if (type === 'attestion') {
    return `${baseUrl}/attestation/view/${uid}`;
  }

  throw new Error('Invalid type');
}
