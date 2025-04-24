import fs from 'fs';
import path from 'path';

import { log } from '@charmverse/core/log';
import type { Abi } from 'viem';

// Helper to convert Solidity types to TypeScript types
function solidityTypeToTsType(solType: string): string {
  if (solType.startsWith('address')) return solType.endsWith('[]') ? 'Address[]' : 'Address';
  if (solType.startsWith('bytes')) return solType.endsWith('[]') ? 'string[]' : 'string';
  if (solType.startsWith('bytes')) return 'string';
  if (solType.startsWith('uint') || solType.startsWith('int')) {
    return solType.endsWith('[]') ? 'bigint[]' : 'bigint';
  }
  if (solType === 'bool' || solType === 'bool[]') {
    return solType === 'bool[]' ? 'boolean[]' : 'boolean';
  }
  if (solType === 'string' || solType === 'string[]') {
    return solType === 'string[]' ? 'string[]' : 'string';
  }
  return 'any'; // Fallback for unsupported types
}

// Generate TypeScript function parameter type from ABI inputs
function generateInputTypes(abiItem: any): string {
  const inputs = abiItem.inputs || [];
  return inputs.map((input: any) => `${input.name}: ${solidityTypeToTsType(input.type)}`).join(', ');
}

function generateMethodImplementation(abiItem: any): string {
  const functionName = abiItem.name;
  const inputs = abiItem.inputs || [];
  const outputs = abiItem.outputs || [];

  const inputNames = inputs.map((input: any) => `params.args.${input.name}`).join(', ');

  // Function to handle the output parsing based on ABI output types
  function getReturnType(returnOutputs: any[]): string {
    if (!returnOutputs.length) return 'null';
    if (returnOutputs.length === 1) return solidityTypeToTsType(returnOutputs[0].type);
    return `{ ${returnOutputs.map((output: any, i: number) => `${output.name || `output${i}`}: ${solidityTypeToTsType(output.type)}`).join(', ')} }`;
  }

  const isReadOperation = abiItem.stateMutability === 'view' || abiItem.stateMutability === 'pure';

  const transactionConfig = isReadOperation ? '' : 'value?: bigint, gasPrice?: bigint';

  // Define the parameter type based on inputs
  const paramsType =
    inputs.length > 0
      ? `{ args: { ${generateInputTypes(abiItem)} }, ${isReadOperation ? 'blockNumber?: bigint, ' : ''}${transactionConfig} }`
      : transactionConfig
        ? `{ ${transactionConfig} }`
        : '{ blockNumber?: bigint } = {}';

  // Handle read methods (view/pure) with output type parsing
  if (isReadOperation) {
    const returnType = getReturnType(outputs);

    return `
    async ${functionName}(${paramsType ? `params: ${paramsType}` : ''}): Promise<${returnType}> {
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "${functionName}",
        args: [${inputNames}]
      });

      const { data } = await this.publicClient.call({
        to: this.contractAddress,
        data: txData,
        blockNumber: params.blockNumber
      });

      // Decode the result based on the expected return type
      const result = decodeFunctionResult({
        abi: this.abi,
        functionName: "${functionName}",
        data: data as \`0x\${string}\`,
      });

      // Parse the result based on the return type
      return result as ${returnType};
    }
    `;
  } else {
    // Handle write methods (payable/nonpayable) and return the transaction receipt
    return `
    async ${functionName}(params: ${paramsType}): Promise<TransactionReceipt> {
      if (!this.walletClient) {
        throw new Error('Wallet client is required for write operations.');
      }
      
      const txData = encodeFunctionData({
        abi: this.abi,
        functionName: "${functionName}",
        args: [${inputNames}],
      });

      const txInput: Omit<Parameters<WalletClient['sendTransaction']>[0], 'account' | 'chain'> = {
        to: getAddress(this.contractAddress),
        data: txData,
        value: params.value ?? BigInt(0), // Optional value for payable methods
        gasPrice: params.gasPrice, // Optional gasPrice
      };

      // This is necessary because the wallet client requires account and chain, which actually cause writes to throw
      const tx = await this.walletClient.sendTransaction(txInput as any);

      // Return the transaction receipt
      return waitForTransactionReceipt(this.publicClient, tx);
    }
    `;
  }
}

// Main function to generate the API client
export async function generateApiClient({
  abi,
  selectedFunctionIndices,
  abiPath,
  writeClient = true
}: {
  abi: Abi;
  selectedFunctionIndices?: number[];
  abiPath: string;
  writeClient?: boolean;
}) {
  // If no selectedFunctionIndices are provided, select all functions

  const selectedFunctions = (
    !selectedFunctionIndices
      ? Array.from({ length: abi.length }).map((_, index) => abi[index])
      : selectedFunctionIndices.map((index) => abi[index])
  ).filter((value) => {
    if (value.type === 'function' && value.inputs.every((input) => !!input.name)) {
      return true;
    } else if (value.type === 'function') {
      log.warn(`Function ${value.name} has unnamed inputs. Skipping...`);
    }
    return false;
  });

  const events = abi.filter((value) => value.type === 'event');

  const apiClientName = `${abiPath.split('/').pop()?.replace('.json', '')}Client`;

  // Generate TypeScript class code
  const classCode = `
  import type { Abi, Account, Address, Chain, Client, PublicActions, PublicClient, RpcSchema, TransactionReceipt, Transport, WalletActions, WalletClient } from 'viem';
  import { encodeFunctionData, decodeFunctionResult, getAddress } from 'viem';
  import { waitForTransactionReceipt } from '@packages/blockchain/waitForTransactionReceipt';

  // ReadWriteWalletClient reflects a wallet client that has been extended with PublicActions
  //  https://github.com/wevm/viem/discussions/1463#discussioncomment-7504732
  type ReadWriteWalletClient<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
    account extends Account | undefined = Account | undefined,
  > = Client<
    transport,
    chain,
    account,
    RpcSchema,
    PublicActions<transport, chain, account> & WalletActions<chain, account>
  >;

  export class ${apiClientName} {

    public contractAddress: Address;
    private publicClient: PublicClient;
    private walletClient?: ReadWriteWalletClient;

    public abi: Abi = ${JSON.stringify([...selectedFunctions, ...events], null, 2)};

    constructor({
      contractAddress,
      publicClient,
      walletClient
    }: {
      contractAddress: Address,
      publicClient?: PublicClient,
      walletClient?: ReadWriteWalletClient,
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

    ${selectedFunctions.map(generateMethodImplementation).join('\n')}
  }
  `;

  if (writeClient) {
    // Write to a separate file
    const outputPath = path.join(__dirname, `/apiClients/${apiClientName}.ts`);
    fs.writeFileSync(outputPath, classCode);
    console.log(`API Client written to ${outputPath}`);
  }

  return classCode;
}

// Function to load the ABI from a file
export function loadAbiFromFile(abiFilePath: string): any[] {
  try {
    const resolvedPath = path.resolve(abiFilePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`ABI file not found at path: ${resolvedPath}`);
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    const abi = JSON.parse(fileContent);

    if (abi.abi && Array.isArray(abi.abi)) {
      return abi.abi;
    }

    if (!Array.isArray(abi)) {
      throw new Error('Invalid ABI format. Expected an array.');
    }

    return abi;
  } catch (error) {
    throw new Error(`Failed to load ABI: ${error}`);
  }
}
