import dotenv from 'dotenv';
import { task } from 'hardhat/config';
import inquirer from 'inquirer'; // Importing inquirer for interactive CLI
import { privateKeyToAccount } from 'viem/accounts';

import { ScoutProtocolProxyClient as _ScoutProtocolProxyClient } from '../../lib/apiClients/protocol/contracts/ScoutProtocol/ScoutProtocolProxy.sol/ScoutProtocolProxy';
import { getConnectorFromHardhatRuntimeEnvironment } from '../../lib/connectors';
import { getWalletClient } from '../../lib/getWalletClient';
import { interactWithContract } from '../../lib/interactWithContract';

dotenv.config();

task('interactProtocol', 'Interact with ScoutGame Protocol contract via CLI').setAction(async (taskArgs, hre) => {
  const connector = getConnectorFromHardhatRuntimeEnvironment(hre);

  if (!connector.scoutProtocol) {
    throw new Error('Proxy contract address not found in connector');
  }

  const privateKey = process.env.PRIVATE_KEY?.startsWith('0x')
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`);

  let mode: 'realProxy' | 'stgProxy' | 'devProxy' = 'realProxy';

  // const choices: string[] = [`🟢 Prod ${connector.scoutgameScoutProtocolProxy!.slice(0, 6)}`];

  const choices: string[] = [];

  if (connector.scoutProtocol?.prod?.protocol) {
    choices.push(`🟢 Prod ${connector.scoutProtocol.prod.protocol.slice(0, 6)}`);
  }

  if (connector.scoutProtocol?.stg?.protocol) {
    choices.push(`🟡 Stg ${connector.scoutProtocol.stg.protocol.slice(0, 6)}`);
  }

  if (connector.scoutProtocol?.dev?.protocol) {
    choices.push(`🟡 Dev ${connector.scoutProtocol.dev.protocol.slice(0, 6)}`);
  }

  // Prompt the user to choose between admin functions or user functions
  const { devOrReal } = await inquirer.prompt([
    {
      type: 'list',
      name: 'devOrReal',
      message: 'Choose environment',
      choices
    }
  ]);

  if (String(devOrReal).startsWith('🟢 Prod')) {
    mode = 'realProxy';
  } else if (String(devOrReal).startsWith('🟡 Stg')) {
    mode = 'stgProxy';
  } else if (String(devOrReal).startsWith('🟡 Dev')) {
    mode = 'devProxy';
  }

  // Prompt the user to choose between admin functions or user functions
  const { functionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'functionType',
      message: 'Do you want to interact with admin functions or user functions?',
      choices: ['Admin Functions', 'User Functions']
    }
  ]);

  const contractAddress =
    mode === 'realProxy'
      ? connector.scoutProtocol?.prod?.protocol
      : mode === 'stgProxy'
        ? connector.scoutProtocol?.stg?.protocol
        : connector.scoutProtocol?.dev?.protocol;

  const contract = await hre.viem.getContractAt(
    (functionType === 'Admin Functions' ? 'ScoutProtocolProxy' : 'ScoutProtocolImplementation') as any,
    contractAddress as `0x${string}`
  );

  const abi = contract.abi;

  if (!contractAddress) {
    throw new Error('Proxy contract address not found in connector');
  }

  const ScoutProtocolProxyClient = new _ScoutProtocolProxyClient({
    contractAddress,
    walletClient: getWalletClient({ chain: connector.chain, privateKey, rpcUrl: connector.rpcUrl })
  });

  const currentAccount = privateKeyToAccount(privateKey);

  const currentAdmin = await ScoutProtocolProxyClient.admin();

  if (currentAccount.address === currentAdmin) {
    console.log('ℹ️ You are connected with the admin wallet. Please be careful with the actions you perform.');
  } else {
    console.log('🟡 You are connected with the test wallet');
  }

  // Proceed to interact with the contract using the selected ABI and contract address
  await interactWithContract({ hre, contractAddress, privateKey, abi });
});

module.exports = {};
