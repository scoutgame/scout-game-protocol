export type Recipient = {
  address: `0x${string}`;
  amount: string;
};
export const THIRDWEB_AIRDROP_IMPLEMENTATION_ADDRESS = '0x0f2f02D8fE02E9C14A65A5A33073bD1ADD9aa53B';
export const THIRDWEB_AIRDROP_PROXY_FACTORY_ADDRESS = '0x25548ba29a0071f30e4bdcd98ea72f79341b07a1';

export type ThirdwebFullMerkleTree = {
  rootHash: string;
  recipients: Recipient[];
  layers: string[];
  totalAirdropAmount: string;
  totalRecipients: number;
};

export const THIRDWEB_ERC20_AIRDROP_PROXY_ABI = [
  {
    inputs: [
      { type: 'address', name: 'implementation' },
      { type: 'bytes', name: 'data' },
      { type: 'bytes32', name: 'salt' },
      { type: 'bytes', name: 'extraData' }
    ],
    name: 'deployProxyByImplementationV2',
    outputs: [{ type: 'address', name: 'proxy' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

export const THIRDWEB_ERC20_AIRDROP_IMPLEMENTATION_ABI = [
  {
    inputs: [
      { type: 'address[]', name: '_trustedForwarders' },
      { type: 'address', name: '_tokenOwner' },
      { type: 'address', name: '_airdropTokenAddress' },
      { type: 'uint256', name: '_airdropAmount' },
      { type: 'uint256', name: '_expirationTimestamp' },
      { type: 'uint256', name: '_openClaimLimitPerWallet' },
      { type: 'bytes32', name: '_merkleRoot' }
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    name: 'verifyClaim',
    inputs: [
      { type: 'address', name: '_claimer' },
      { type: 'uint256', name: '_quantity' },
      { type: 'bytes32[]', name: '_proofs' },
      { type: 'uint256', name: '_proofMaxQuantityForWallet' }
    ],
    outputs: [],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'claim',
    inputs: [
      { type: 'address', name: '_receiver' },
      { type: 'uint256', name: '_quantity' },
      { type: 'bytes32[]', name: '_proofs' },
      { type: 'uint256', name: '_proofMaxQuantityForWallet' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    name: 'airdropTokenAddress',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'tokenOwner',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'availableAmount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'expirationTimestamp',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'openClaimLimitPerWallet',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'merkleRoot',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'supplyClaimedByWallet',
    inputs: [{ type: 'address', name: 'wallet' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'isTrustedForwarder',
    inputs: [{ type: 'address', name: 'forwarder' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    type: 'event',
    name: 'TokensClaimed',
    inputs: [
      { type: 'address', name: 'claimer', indexed: true },
      { type: 'address', name: 'receiver', indexed: true },
      { type: 'uint256', name: 'quantityClaimed', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [{ type: 'uint8', name: 'version', indexed: false }]
  }
];
