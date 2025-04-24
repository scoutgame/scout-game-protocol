import { waitForTransactionReceipt } from '@packages/blockchain/waitForTransactionReceipt';
import type {
  Abi,
  Account,
  Address,
  Chain,
  Client,
  PublicActions,
  PublicClient,
  RpcSchema,
  TransactionReceipt,
  Transport,
  WalletActions,
  WalletClient
} from 'viem';
import { encodeFunctionData, decodeFunctionResult, getAddress } from 'viem';

// ReadWriteWalletClient reflects a wallet client that has been extended with PublicActions
//  https://github.com/wevm/viem/discussions/1463#discussioncomment-7504732
type ReadWriteWalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> & WalletActions<chain, account>
>;

export class ImplementationStorageClient {
  public contractAddress: Address;

  private publicClient: PublicClient;

  private walletClient?: ReadWriteWalletClient;

  public abi: Abi = [];

  constructor({
    contractAddress,
    publicClient,
    walletClient
  }: {
    contractAddress: Address;
    publicClient?: PublicClient;
    walletClient?: ReadWriteWalletClient;
  }) {
    if (!publicClient && !walletClient) {
      throw new Error('At least one client is required.');
    }

    this.contractAddress = contractAddress;

    const client = publicClient || walletClient;

    if (publicClient) {
      this.publicClient = publicClient;
    } else {
      this.walletClient = walletClient;
      this.publicClient = walletClient as PublicClient;
    }
  }
}
