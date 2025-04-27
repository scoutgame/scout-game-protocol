import 'solidity-coverage';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-ignition-viem';
import '@nomicfoundation/hardhat-toolbox-viem';
import '@nomicfoundation/hardhat-viem';
import 'hardhat-jest'; // Enable support for Jest: https://www.npmjs.com/package/hardhat-jest
import type { HardhatUserConfig } from 'hardhat/config';
import { vars } from 'hardhat/config';
import type { NetworksUserConfig } from 'hardhat/types';
import { base, baseSepolia, optimism, optimismSepolia, sepolia } from 'viem/chains';

import type { SupportedChains } from './lib/connectors';
import { connectors } from './lib/connectors';

// Deploys ------------------------------
import './scripts/deploy/nfts/deployBuilderNft';
import './scripts/deploy/nfts/deployBuilderNftPreSeason02';

// Deploy scripts
import './scripts/deploy/nfts/deployBuilderNftStarterPack';
import './scripts/deploy/deployFoundryCreate2Deployer';

// Scout Protocol Deploy Scripts
import './scripts/deploy/protocol/01_deployDeterministicScoutgameTokenERC20';
import './scripts/deploy/protocol/02_deployScoutProtocolStandardNft';
import './scripts/deploy/protocol/03_deployScoutProtocolStarterNft';
import './scripts/deploy/protocol/04_deployEASResolver';
import './scripts/deploy/protocol/05_deployScoutProtocol';
import './scripts/deploy/protocol/06_deployVesting';
import './scripts/deploy/protocol/prepareScoutGameLaunchSafeTransaction';
import './scripts/deploy/protocol/verifyContracts';

import './scripts/verifyViaTenderly';
// Interactions ------------------------------
import './scripts/interact/builderNftApp';
import './scripts/interact/scoutProtocol';
import './scripts/interact/scoutProtocolToken';
import './scripts/interact/scoutProtocolResolver';
import './scripts/interact/scoutProtocolBuilderNft';
import './scripts/interact/updateProxyImplementation';
import './scripts/interact/builderNftStarterPackApp';
import './scripts/interact/vesting';
import './scripts/interact/builderNftSeason02';
import './scripts/interact/superchainBridge';

// tdly.setup({ automaticVerifications: false });

const PRIVATE_KEY = vars.get('PRIVATE_KEY');

// Gas prices fetched from blockscout. Last refreshed Sep. 18th 2024
const config: Omit<HardhatUserConfig, 'networks'> & { networks: Record<SupportedChains, NetworksUserConfig[string]> } =
  {
    solidity: {
      compilers: [
        {
          version: '0.8.26', // Your contracts
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            }
          }
        },
        {
          version: '0.6.12', // USDC contracts
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            }
          }
        }
      ]
    },
    networks: {
      opsepolia: {
        url: connectors.opsepolia.rpcUrl,
        accounts: [PRIVATE_KEY],
        // add gas to avoid errros on deploy https://ethereum.stackexchange.com/questions/115223/cannot-estimate-gas-transaction-may-fail-or-may-require-manual-gas-limit
        gas: 2100000,
        gasPrice: 1e8,
        chainId: optimismSepolia.id
      },
      optimism: {
        url: connectors.optimism.rpcUrl,
        accounts: [PRIVATE_KEY],
        // add gas to avoid errros on deploy https://ethereum.stackexchange.com/questions/115223/cannot-estimate-gas-transaction-may-fail-or-may-require-manual-gas-limit
        gas: 2100000,
        gasPrice: 1e11,
        chainId: optimism.id
      },
      sepolia: {
        url: connectors.sepolia.rpcUrl,
        accounts: [PRIVATE_KEY],
        // add gas to avoid errros on deploy https://ethereum.stackexchange.com/questions/115223/cannot-estimate-gas-transaction-may-fail-or-may-require-manual-gas-limit
        gas: 8e9,
        chainId: sepolia.id
      },
      basesepolia: {
        url: connectors.basesepolia.rpcUrl,
        accounts: [PRIVATE_KEY],
        gasPrice: 4e8,
        chainId: baseSepolia.id
      },
      base: {
        url: connectors.base.rpcUrl,
        accounts: [PRIVATE_KEY],
        gasPrice: 3e7,
        chainId: base.id
      },
      // These are the default configs for the supersim chains in localhost
      supersimL1: {
        url: connectors.supersimL1.rpcUrl,
        accounts: [PRIVATE_KEY],
        gasPrice: 3e7,
        chainId: 900
      },
      supersimL2A: {
        url: connectors.supersimL2A.rpcUrl,
        accounts: [PRIVATE_KEY],
        gasPrice: 3e7,
        chainId: 901
      },
      supersimL2B: {
        url: connectors.supersimL2B.rpcUrl,
        accounts: [PRIVATE_KEY],
        gasPrice: 3e7,
        chainId: 902
      }
    } as Record<SupportedChains, NetworksUserConfig[string]>,
    paths: {
      tests: './__test__'
    },
    etherscan: {
      apiKey: {
        opsepolia: '97FJRW1Q7XF1ATMCRUUN372HNK25WNT6JJ',
        optimism: '97FJRW1Q7XF1ATMCRUUN372HNK25WNT6JJ',
        basesepolia: process.env.BASESCAN_API_KEY || '97FJRW1Q7XF1ATMCRUUN372HNK25WNT6JJ',
        sepolia: '97FJRW1Q7XF1ATMCRUUN372HNK25WNT6JJ',
        base: process.env.BASESCAN_API_KEY || '97FJRW1Q7XF1ATMCRUUN372HNK25WNT6JJ'
      },
      customChains: [
        {
          network: 'opsepolia',
          chainId: 11155420,
          urls: {
            apiURL: 'https://optimism-sepolia.blockscout.com/api',
            browserURL: 'https://optimism-sepolia.blockscout.com'
          }
        },
        {
          network: 'basesepolia',
          chainId: 84532,
          urls: {
            apiURL: 'https://base-sepolia.blockscout.com/api',
            browserURL: 'https://base-sepolia.blockscout.com'
          }
        },
        {
          network: 'base',
          chainId: 8453,
          urls: {
            // apiURL: 'https://base.blockscout.com/api',
            // browserURL: 'https://base.blockscout.com'

            apiURL: 'https://api.basescan.org/api',
            browserURL: 'https://basescan.org'
          }
        },
        {
          network: 'optimism',
          chainId: 10,
          urls: {
            apiURL: 'https://optimism.blockscout.com/api',
            browserURL: 'https://optimism.blockscout.com'
          }
        },
        {
          network: 'sepolia',
          chainId: 11155111,
          urls: {
            apiURL: 'https://sepolia.etherscan.io/api',
            browserURL: 'https://sepolia.etherscan.io'
          }
        }
        // {
        //   network: 'opsepolia',
        //   chainId: 11155420,
        //   urls: {
        //     apiURL: 'https://api-sepolia-optimism.etherscan.io/api',
        //     browserURL: 'https://sepolia-optimism.etherscan.io'
        //   }
        // },
        // {
        //   network: 'optimism',
        //   chainId: 10,
        //   urls: {
        //     apiURL: 'https://api-optimistic.etherscan.io/api',
        //     browserURL: 'https://optimistic.etherscan.io'
        //   }
        // }
      ]
    }
  };

export default config;
