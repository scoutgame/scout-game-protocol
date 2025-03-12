import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Address } from 'viem';

import type { SupportedChains } from './connectors';
import { NULL_EVM_ADDRESS } from './constants';

const DEPLOY_SALT = 'deterministic-salt-03';

export function getDeterministicDeploySalt() {
  return `0x${Buffer.from(DEPLOY_SALT.padEnd(32, '0')).toString('hex')}`;
}

type Factory = {
  tokenFactory: Address;
  stargateFactory: Address;
};

export const factories: Record<Extract<SupportedChains, 'opsepolia' | 'sepolia'>, Factory> = {
  opsepolia: {
    stargateFactory: NULL_EVM_ADDRESS,
    tokenFactory: '0xcc572382158221b0baee53d6eb35b7c82de39b18'
  } as Factory,
  sepolia: {
    stargateFactory: NULL_EVM_ADDRESS,
    tokenFactory: '0xf7580046ca7c642e116b21f3d327f6debbaa8487'
  } as Factory
} as const;

export function getFactoryFromHardhatRuntimeEnvironment({
  hre,
  type
}: {
  hre: HardhatRuntimeEnvironment;
  type: keyof Factory;
}): Address {
  const chainName = hre.hardhatArguments.network;

  if (!chainName) {
    throw new Error('No network specified');
  }

  const factory = factories[chainName as Extract<SupportedChains, 'opsepolia' | 'sepolia'>];

  if (!factory) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  const factoryAddress = factory[type];

  if (factoryAddress === NULL_EVM_ADDRESS) {
    throw new Error(`Factory type "${type}" is not deployed on ${chainName}`);
  }

  return factory[type];
}
