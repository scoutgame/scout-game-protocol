import { v4 as uuid } from 'uuid';
import { getAddress, parseEventLogs } from 'viem';

import { randomBigIntFromInterval } from '../../../../../lib/utils';
import { loadContractWithStarterPackFixtures } from '../../../../fixtures';
import { generateWallets, walletFromKey } from '../../../../generateWallets';

describe('ScoutProtocolStarterNFTImplementation', function () {
  describe('registerBuilderToken()', function () {
    describe('effects', function () {
      it('Register a new builder token using a builderId and a specific tokenId', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const builderId = uuid(); // Sample UUID
        const tokenId = randomBigIntFromInterval();
        await expect(builderNftContract.write.registerBuilderToken([builderId, tokenId])).resolves.toBeDefined();

        const tokenIdFromStorage = await builderNftContract.read.getBuilderIdForToken([tokenId]);
        expect(tokenIdFromStorage).toBe(builderId);

        const builderIdFromStorage = await builderNftContract.read.getBuilderIdForToken([tokenId]);
        expect(builderIdFromStorage).toBe(builderId);

        const totalBuilders = await builderNftContract.read.totalBuilderTokens();
        expect(totalBuilders).toBe(BigInt(1));
      });

      it('increments the total builders count', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const builders = [uuid(), uuid(), uuid()];

        for (let i = 0; i < builders.length; i++) {
          const builderId = builders[i];
          const tokenId = BigInt(i + 1);
          await expect(builderNftContract.write.registerBuilderToken([builderId, tokenId])).resolves.toBeDefined();
        }

        const totalBuilders = await builderNftContract.read.totalBuilderTokens();
        expect(totalBuilders).toBe(BigInt(3));
      });
    });

    describe('events', function () {
      it('Emits DevTokenRegistered event new tokenId and builderId', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount: account }
        } = await loadContractWithStarterPackFixtures();

        const builderId = uuid(); // Sample UUID
        const tokenId = randomBigIntFromInterval();
        const txResponse = await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        // Extract logs and parse events
        const receipt = await account.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['DevTokenRegistered']
        });

        const decodedEvent = parsedLogs.find((log) => log.eventName === 'DevTokenRegistered');

        expect(decodedEvent).toBeDefined();

        expect(decodedEvent!.args.tokenId).toEqual(tokenId);
        expect(decodedEvent!.args.builderId).toEqual(builderId);
      });
    });

    describe('permissions', function () {
      it('Only admin can register a builder token', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();

        const builderId = uuid();
        await expect(
          builderNftContract.write.registerBuilderToken([builderId, randomBigIntFromInterval()], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });

      it('Minter wallet can register a builder token', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const minterAccount = await walletFromKey();

        await expect(builderNftContract.write.setMinter([minterAccount.account.address])).resolves.toBeDefined();

        const tokenId = randomBigIntFromInterval();

        const builderId = uuid();
        await expect(
          builderNftContract.write.registerBuilderToken([builderId, tokenId], {
            account: minterAccount.account
          })
        ).resolves.toBeDefined();

        const tokenIdForBuilder = await builderNftContract.read.getBuilderIdForToken([tokenId]);
        expect(tokenIdForBuilder).toBe(builderId);
      });
    });

    describe('validations', function () {
      it('Revert if the builderId is already registered', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, randomBigIntFromInterval()]);

        await expect(
          builderNftContract.write.registerBuilderToken([builderId, randomBigIntFromInterval()])
        ).rejects.toThrow('Builder already registered');
      });

      it('Revert if the builderId is empty', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        await expect(
          builderNftContract.write.registerBuilderToken([null as any, randomBigIntFromInterval()])
        ).rejects.toThrow('Builder ID must be a valid UUID');
      });

      it('Revert if the builderId is an invalid uuid', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        await expect(builderNftContract.write.registerBuilderToken(['', randomBigIntFromInterval()])).rejects.toThrow(
          'Builder ID must be a valid UUID'
        );
      });
    });
  });

  describe('mint()', function () {
    describe('effects', function () {
      it('Accept USDC and mint the requested amount of tokens for an NFT', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const tokenAmount = BigInt(1);

        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: secondUserAccount.account.address,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).resolves.toBeDefined();

        const balance = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
        expect(balance).toBe(tokenAmount);
      });

      it('Forwards the full fees of the mint to the proceeds receiver', async function () {
        const {
          builderNftStarterPack: { builderNftContract, proceedsReceiverAccount },
          usdc: { mintUSDCTo, approveUSDC, balanceOfUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        const tokenAmount = BigInt(1);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: secondUserAccount.account.address,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
          account: secondUserAccount.account
        });

        const contractBalance = await balanceOfUSDC({ account: builderNftContract.address });

        const proceedsReceiverBalance = await balanceOfUSDC({ account: proceedsReceiverAccount.account.address });

        expect(contractBalance).toBe(0);
        expect(proceedsReceiverBalance).toBe(Number(price / USDC_DECIMALS_MULTIPLIER));
      });
    });

    describe('events', function () {
      it('Emits standard ERC1155 "TransferSingle" event', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        const price = await builderNftContract.read.getTokenPurchasePrice([amount]);

        await mintUSDCTo({
          account: testUserAddress,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        const txResponse = await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
          account: secondUserAccount.account
        });

        // Extract logs and parse events
        const receipt = await secondUserAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        });

        // Check for TransferSingle event
        const transferEvent = parsedLogs.find((log) => log.eventName === 'TransferSingle');
        expect(transferEvent).toBeDefined();

        expect(transferEvent!.args.operator).toEqual(getAddress(secondUserAccount.account.address));
        expect(transferEvent!.args.from).toEqual('0x0000000000000000000000000000000000000000');
        expect(transferEvent!.args.to).toEqual(getAddress(testUserAddress));
        expect(transferEvent!.args.id).toEqual(tokenId);
        expect(transferEvent!.args.value).toEqual(amount);
      });

      it('Emits BuilderScouted event with tokenId (number), amount of tokens purchased (), and scoutId (uuid)', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        const price = await builderNftContract.read.getTokenPurchasePrice([amount]);

        await mintUSDCTo({
          account: testUserAddress,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        const txResponse = await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
          account: secondUserAccount.account
        });

        // Extract logs and parse events
        const receipt = await secondUserAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['BuilderScouted']
        });

        // Check for BuilderScouted event
        const scoutedEvent = parsedLogs.find((log) => log.eventName === 'BuilderScouted');
        expect(scoutedEvent).toBeDefined();

        expect(scoutedEvent!.args.tokenId).toEqual(tokenId);
        expect(scoutedEvent!.args.amount).toEqual(amount);
        expect(scoutedEvent!.args.scout).toEqual(scoutId);
      });
    });

    describe('permissions', function () {
      it('Should revert if the caller has not provided USDC allowance to the contract', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const tokenAmount = BigInt(1);

        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: secondUserAccount.account.address,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        // Skip approval
        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('ERC20: transfer amount exceeds allowance');

        // Check balance unchanged
        const balance = await builderNftContract.read.balanceOf([testUserAddress, BigInt(1)]);
        expect(balance).toBe(BigInt(0));
      });
    });

    describe('validations', function () {
      it("Revert if the caller's USDC balance is insufficent", async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { approveUSDC }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();

        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        const tokenAmount = BigInt(1);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        // Important to still approve USDC, even if we don't have the balance to differentiate error messages
        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('ERC20: transfer amount exceeds balance');

        // Check balance unchanged
        const balance = await builderNftContract.read.balanceOf([testUserAddress, BigInt(1)]);
        expect(balance).toBe(BigInt(0));
      });

      it('Reverts if trying to mint more than 1 NFT', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        const tokenAmount = BigInt(2);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: secondUserAccount.account.address,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('Can only mint 1 token per builder and scout');
      });

      it('Reverts if user already minted a specific NFT', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();

        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        const tokenAmount = BigInt(1);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: secondUserAccount.account.address,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER) * 2
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).resolves.toBeDefined();

        await expect(
          builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('Scout already minted this NFT');
      });
    });
  });

  describe('setBaseUri()', function () {
    describe('effects', function () {
      it('Updates the base URI when called with a valid newBaseUri', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const newBaseUri = 'https://newbase.uri/';
        await expect(builderNftContract.write.setBaseUri([newBaseUri])).resolves.toBeDefined();

        // Since there's no getter for baseUri, we assume the call succeeds.
      });
    });

    describe('permissions', function () {
      it('Only admin can set the base URI', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();

        const newBaseUri = 'https://newbase.uri/';
        await expect(
          builderNftContract.write.setBaseUri([newBaseUri], { account: userAccount.account })
        ).rejects.toThrow('Caller is not the admin');
      });
    });

    describe('validations', function () {
      it('Reverts when called with an empty newBaseUri', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        await expect(builderNftContract.write.setBaseUri([''])).rejects.toThrow('Empty base URI not allowed');
      });
    });
  });

  describe('burn()', function () {
    describe('effects', function () {
      it('Burns the specified amount of tokens from the account, updating holder balance and total supply of a tokenID', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const tokenAmount = BigInt(1);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenAmount]);

        await mintUSDCTo({
          account: testUserAddress,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });
        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        // Mint tokens to the user
        await builderNftContract.write.mint([testUserAddress, tokenId, tokenAmount, scoutId], {
          account: secondUserAccount.account
        });

        const balanceBefore = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
        expect(balanceBefore).toBe(tokenAmount);

        const burnAmount = BigInt(1);

        // Burn tokens from the user (admin call)
        await expect(
          builderNftContract.write.burn([testUserAddress, tokenId, burnAmount, scoutId])
        ).resolves.toBeDefined();

        const balanceAfter = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
        expect(balanceAfter).toBe(tokenAmount - burnAmount);

        const totalSupply = await builderNftContract.read.totalSupply([tokenId]);
        expect(totalSupply).toBe(tokenAmount - burnAmount);
      });
    });

    // Events tests for 'burn()' method
    describe('events', function () {
      it('Emits TransferSingle event with correct parameters when burning tokens', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount: account },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        const price = await builderNftContract.read.getTokenPurchasePrice([amount]);

        await mintUSDCTo({
          account: testUserAddress,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });

        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        // Mint tokens to the user
        await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
          account: secondUserAccount.account
        });

        const burnAmount = BigInt(1);

        // Burn tokens from the user (admin call)
        const txResponse = await builderNftContract.write.burn([testUserAddress, tokenId, burnAmount, scoutId]);

        // Extract logs and parse events
        const receipt = await account.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        });

        // Check for TransferSingle event
        const burnEvent = parsedLogs.find((log) => log.eventName === 'TransferSingle');
        expect(burnEvent).toBeDefined();

        expect(burnEvent!.args.operator).toEqual(getAddress(account.account.address));
        expect(burnEvent!.args.from).toEqual(getAddress(testUserAddress));
        expect(burnEvent!.args.to).toEqual('0x0000000000000000000000000000000000000000');
        expect(burnEvent!.args.id).toEqual(tokenId);
        expect(burnEvent!.args.value).toEqual(burnAmount);
      });
    });

    describe('permissions', function () {
      it('Only admin can burn tokens', async function () {
        const {
          builderNftStarterPack: { builderNftContract },
          usdc: { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);
        const price = await builderNftContract.read.getTokenPurchasePrice([amount]);

        await mintUSDCTo({
          account: testUserAddress,
          amount: Number(price / USDC_DECIMALS_MULTIPLIER)
        });
        await approveUSDC({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        // Mint tokens to the user
        await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
          account: secondUserAccount.account
        });

        // Try to burn tokens from non-admin account
        await expect(
          builderNftContract.write.burn([testUserAddress, BigInt(1), BigInt(5), scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });
    });

    describe('validations', function () {
      it('Reverts when trying to burn more tokens than the account has', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        const tokenAmount = BigInt(1);

        // Mint tokens to the user
        await builderNftContract.write.mintTo([testUserAddress, tokenId, tokenAmount, scoutId], {
          account: builderNftAdminAccount.account
        });

        // Try to burn more tokens than the user has
        await expect(builderNftContract.write.burn([testUserAddress, BigInt(1), BigInt(3), scoutId])).rejects.toThrow(
          'ERC1155: burn amount exceeds balance'
        );
      });
    });
  });

  describe('mintTo()', function () {
    describe('effects', function () {
      it('Mints tokens to the specified account', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        const amount = BigInt(1);
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        // Admin mints tokens to the user
        await expect(
          builderNftContract.write.mintTo([testUserAddress, tokenId, amount, scoutId])
        ).resolves.toBeDefined();

        const balance = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
        expect(balance).toBe(amount);
      });
    });

    describe('events', function () {
      it('Emits TransferSingle event with correct parameters', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount: account }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        // Admin mints tokens to the user
        const txResponse = await builderNftContract.write.mintTo([testUserAddress, tokenId, amount, scoutId]);

        // Extract logs and parse events
        const receipt = await account.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        });

        // Check for TransferSingle event
        const transferEvent = parsedLogs.find((log) => log.eventName === 'TransferSingle');
        expect(transferEvent).toBeDefined();

        expect(transferEvent!.args.operator).toEqual(getAddress(account.account.address));
        expect(transferEvent!.args.from).toEqual('0x0000000000000000000000000000000000000000');
        expect(transferEvent!.args.to).toEqual(getAddress(testUserAddress));
        expect(transferEvent!.args.id).toEqual(tokenId);
        expect(transferEvent!.args.value).toEqual(amount);
      });

      it('Emits BuilderScouted event with correct parameters', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount: account }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        // Admin mints tokens to the user
        const txResponse = await builderNftContract.write.mintTo([testUserAddress, tokenId, amount, scoutId]);

        // Extract logs and parse events
        const receipt = await account.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['BuilderScouted']
        });

        // Check for BuilderScouted event
        const scoutedEvent = parsedLogs.find((log) => log.eventName === 'BuilderScouted');
        expect(scoutedEvent).toBeDefined();

        expect(scoutedEvent!.args.tokenId).toEqual(tokenId);
        expect(scoutedEvent!.args.amount).toEqual(amount);
        expect(scoutedEvent!.args.scout).toEqual(scoutId);
      });
    });

    describe('permissions', function () {
      it('Admin can mint tokens to an account', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        const amount = BigInt(1);
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        const scoutId = uuid();

        // Non-admin tries to mint tokens
        await expect(
          builderNftContract.write.mintTo([testUserAddress, tokenId, amount, scoutId], {
            account: secondUserAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });

      it('Minter can mint tokens to an account', async function () {
        const {
          builderNftStarterPack: { builderNftContract, builderNftAdminAccount }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount, thirdUserAccount: minterAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const builderId2 = uuid();
        const tokenId = randomBigIntFromInterval();
        const secondTokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);
        await builderNftContract.write.registerBuilderToken([builderId2, secondTokenId]);

        const scoutId = uuid();
        const amount = BigInt(1);

        await builderNftContract.write.setMinter([minterAccount.account.address]);

        await expect(
          builderNftContract.write.mintTo([testUserAddress, tokenId, amount, scoutId], {
            account: builderNftAdminAccount.account
          })
        ).resolves.toBeDefined();

        await expect(
          builderNftContract.write.mintTo([testUserAddress, secondTokenId, amount, scoutId], {
            account: minterAccount.account
          })
        ).resolves.toBeDefined();

        const balance = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
        const secondBalance = await builderNftContract.read.balanceOf([testUserAddress, secondTokenId]);

        expect(balance).toBe(amount);
        expect(secondBalance).toBe(amount);
      });
    });

    describe('validations', function () {
      it('Reverts when called with an invalid scout UUID', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        const tokenId = randomBigIntFromInterval();
        await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

        // Use an invalid scout UUID
        const invalidScoutId = '';

        await expect(
          builderNftContract.write.mintTo([testUserAddress, tokenId, BigInt(10), invalidScoutId])
        ).rejects.toThrow('Scout must be a valid UUID');
      });
    });
  });

  describe('setUriPrefix()', function () {
    describe('effects', function () {
      it('Updates the URI prefix when called with a valid newPrefix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const newPrefix = 'https://newprefix.uri/';
        await expect(builderNftContract.write.setUriPrefix([newPrefix])).resolves.toBeDefined();

        const updatedPrefix = await builderNftContract.read.getUriPrefix();
        expect(updatedPrefix).toBe(newPrefix);
      });
    });

    describe('permissions', function () {
      it('Only admin can set the URI prefix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();

        const newPrefix = 'https://newprefix.uri';
        await expect(
          builderNftContract.write.setUriPrefix([newPrefix], { account: userAccount.account })
        ).rejects.toThrow('Caller is not the admin');

        // Verify the prefix hasn't changed
        const currentPrefix = await builderNftContract.read.getUriPrefix();
        expect(currentPrefix).not.toBe(newPrefix);
      });
    });

    describe('validations', function () {
      it('Reverts when called with an empty newPrefix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const initialPrefix = await builderNftContract.read.getUriPrefix();

        await expect(builderNftContract.write.setUriPrefix([''])).rejects.toThrow('Empty URI prefix not allowed');

        // Verify the prefix hasn't changed
        const currentPrefix = await builderNftContract.read.getUriPrefix();
        expect(currentPrefix).toBe(initialPrefix);
      });
    });
  });

  describe('setUriSuffix()', function () {
    describe('effects', function () {
      it('Updates the URI suffix when called with a valid newSuffix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const newSuffix = 'metadata.json';
        await expect(builderNftContract.write.setUriSuffix([newSuffix])).resolves.toBeDefined();

        const updatedSuffix = await builderNftContract.read.getUriSuffix();
        expect(updatedSuffix).toBe(newSuffix);
      });
    });

    describe('permissions', function () {
      it('Only admin can set the URI suffix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();

        const newSuffix = 'metadata.json';
        await expect(
          builderNftContract.write.setUriSuffix([newSuffix], { account: userAccount.account })
        ).rejects.toThrow('Caller is not the admin');

        // Verify the suffix hasn't changed
        const currentSuffix = await builderNftContract.read.getUriSuffix();
        expect(currentSuffix).not.toBe(newSuffix);
      });
    });

    describe('validations', function () {
      it('Allows setting an empty URI suffix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        await expect(builderNftContract.write.setUriSuffix([''])).resolves.toBeDefined();

        const updatedSuffix = await builderNftContract.read.getUriSuffix();
        expect(updatedSuffix).toBe('');
      });
    });
  });

  describe('setUriPrefixAndSuffix()', function () {
    describe('effects', function () {
      it('Updates both URI prefix and suffix when called with valid values', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const newPrefix = 'https://newprefix.uri/';
        const newSuffix = 'metadata.json';
        await expect(builderNftContract.write.setUriPrefixAndSuffix([newPrefix, newSuffix])).resolves.toBeDefined();

        const updatedPrefix = await builderNftContract.read.getUriPrefix();
        const updatedSuffix = await builderNftContract.read.getUriSuffix();
        expect(updatedPrefix).toBe(newPrefix);
        expect(updatedSuffix).toBe(newSuffix);
      });
    });

    describe('permissions', function () {
      it('Only admin can set both URI prefix and suffix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();

        const newPrefix = 'https://newprefix.uri/';
        const newSuffix = 'metadata.json';
        await expect(
          builderNftContract.write.setUriPrefixAndSuffix([newPrefix, newSuffix], { account: userAccount.account })
        ).rejects.toThrow('Caller is not the admin');

        // Verify the prefix and suffix haven't changed
        const currentPrefix = await builderNftContract.read.getUriPrefix();
        const currentSuffix = await builderNftContract.read.getUriSuffix();
        expect(currentPrefix).not.toBe(newPrefix);
        expect(currentSuffix).not.toBe(newSuffix);
      });
    });

    describe('validations', function () {
      it('Reverts when called with an empty newPrefix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const initialPrefix = await builderNftContract.read.getUriPrefix();
        const initialSuffix = await builderNftContract.read.getUriSuffix();

        await expect(builderNftContract.write.setUriPrefixAndSuffix(['', 'metadata.json'])).rejects.toThrow(
          'Empty URI prefix not allowed'
        );

        // Verify the prefix and suffix haven't changed
        const currentPrefix = await builderNftContract.read.getUriPrefix();
        const currentSuffix = await builderNftContract.read.getUriSuffix();
        expect(currentPrefix).toBe(initialPrefix);
        expect(currentSuffix).toBe(initialSuffix);
      });

      it('Allows setting an empty URI suffix', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const newPrefix = 'https://newprefix.uri/';
        await expect(builderNftContract.write.setUriPrefixAndSuffix([newPrefix, ''])).resolves.toBeDefined();

        const updatedPrefix = await builderNftContract.read.getUriPrefix();
        const updatedSuffix = await builderNftContract.read.getUriSuffix();
        expect(updatedPrefix).toBe(newPrefix);
        expect(updatedSuffix).toBe('');
      });
    });
  });

  describe('setMinter()', function () {
    describe('effects', function () {
      it('Should set the minter address correctly', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();
        const newMinter = userAccount.account.address;

        await builderNftContract.write.setMinter([newMinter]);

        const minter = await builderNftContract.read.getMinter();
        expect(getAddress(minter)).toBe(getAddress(newMinter));
      });
    });

    describe('permissions', function () {
      it('Only admin can set the minter', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const { userAccount } = await generateWallets();
        const newMinter = userAccount.account.address;

        await expect(builderNftContract.write.setMinter([newMinter], { account: userAccount.account })).rejects.toThrow(
          'Caller is not the admin'
        );
      });
    });

    describe('validations', function () {
      it('Reverts when setting minter to zero address', async function () {
        const {
          builderNftStarterPack: { builderNftContract }
        } = await loadContractWithStarterPackFixtures();

        const zeroAddress = '0x0000000000000000000000000000000000000000';

        await expect(builderNftContract.write.setMinter([zeroAddress])).rejects.toThrow('Invalid address');
      });
    });
  });
});
