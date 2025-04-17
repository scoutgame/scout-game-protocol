import dotenv from 'dotenv';
import { isAddress } from 'ethers';
import type { Address } from 'viem';

dotenv.config();

export const PRIVATE_KEY = (
  process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`
) as `0x${string}`;

export const NULL_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';

export const NULL_EAS_REF_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function getScoutProtocolSafeAddress(): Address {
  const address = process.env.SCOUT_PROTOCOL_SAFE_ADDRESS;
  if (!isAddress(address)) {
    throw new Error('SCOUT_PROTOCOL_SAFE_ADDRESS is required to set as the admin of the ScoutProtocol contracts');
  }
  return address as Address;
}

export function getClaimsManagerAddress(): Address {
  const address = process.env.SCOUT_PROTOCOL_CLAIMS_MANAGER_ADDRESS;
  if (!isAddress(address)) {
    throw new Error(
      'SCOUT_PROTOCOL_CLAIMS_MANAGER_ADDRESS is required to set as the claims manager of the ScoutProtocol contracts'
    );
  }
  return address as Address;
}

// From foundry docs https://book.getfoundry.sh/tutorials/create2-tutorial#introduction
// https://base-sepolia.blockscout.com/address/0x4e59b44847b379578588920cA78FbF26c0B4956C?tab=contract
export const DETERMINISTIC_DEPLOYER_CONTRACT_DEPLOY_CODE =
  '0x604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3';
