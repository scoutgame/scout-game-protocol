import { v4 as uuid } from 'uuid';
import { getAddress } from 'viem';

import { randomBigIntFromInterval } from '../../../../../lib/utils';
import type { BuilderNftStarterPackFixture } from '../../../../deployBuilderStarterNft';
import type { USDCTestFixture } from '../../../../deployTestUSDC';
import { loadContractWithStarterPackFixtures } from '../../../../fixtures';
import type { GeneratedWallet } from '../../../../generateWallets';
import { generateWallets } from '../../../../generateWallets';

describe('ScoutProtocolStarterNFTImplementation', function () {
  let builderNftContract: BuilderNftStarterPackFixture['builderNftContract'];
  let builderNftAdminAccount: GeneratedWallet;
  let usdc: USDCTestFixture;

  const testContractName = 'ScoutGame Starter Pack Test Season';
  const testContractSymbol = '$TESTBUILDERS';

  beforeEach(async () => {
    ({
      builderNftStarterPack: { builderNftContract, builderNftAdminAccount },
      usdc
    } = await loadContractWithStarterPackFixtures({
      tokenName: testContractName,
      tokenSymbol: testContractSymbol
    }));
  });

  describe('balanceOf()', function () {
    it('Returns the correct balance of tokens for an account and tokenId', async function () {
      const { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER } = usdc;

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

      await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
        account: secondUserAccount.account
      });

      const balance = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
      expect(balance).toBe(amount);
    });

    it('Returns zero for accounts with no tokens', async function () {
      const { secondUserAccount } = await generateWallets();
      const testUserAddress = secondUserAccount.account.address;
      const tokenId = BigInt(1);

      const balance = await builderNftContract.read.balanceOf([testUserAddress, tokenId]);
      expect(balance).toBe(BigInt(0));
    });
  });

  describe('balanceOfBatch()', function () {
    it('Returns correct balances for multiple accounts and tokenIds', async function () {
      const { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER } = usdc;

      const { userAccount: firstUserAccount, secondUserAccount } = await generateWallets();

      const user1Address = firstUserAccount.account.address;
      const user2Address = secondUserAccount.account.address;
      const builderId1 = uuid();
      const builderId2 = uuid();

      const scoutId = uuid();
      const tokenId1 = randomBigIntFromInterval();
      const tokenId2 = randomBigIntFromInterval();

      await builderNftContract.write.registerBuilderToken([builderId1, tokenId1]);
      await builderNftContract.write.registerBuilderToken([builderId2, tokenId2]);

      const amount1 = BigInt(1);
      const amount2 = BigInt(1);

      const price1 = await builderNftContract.read.getTokenPurchasePrice([amount1]);
      const price2 = await builderNftContract.read.getTokenPurchasePrice([amount2]);

      await mintUSDCTo({
        account: user1Address,
        amount: Number(price1 / USDC_DECIMALS_MULTIPLIER)
      });
      await approveUSDC({
        wallet: firstUserAccount,
        args: { spender: builderNftContract.address, amount: Number(price1) }
      });

      await builderNftContract.write.mint([user1Address, tokenId1, amount1, scoutId], {
        account: firstUserAccount.account
      });

      await mintUSDCTo({
        account: user2Address,
        amount: Number(price2 / USDC_DECIMALS_MULTIPLIER)
      });
      await approveUSDC({
        wallet: secondUserAccount,
        args: { spender: builderNftContract.address, amount: Number(price2) }
      });

      await builderNftContract.write.mint([user2Address, tokenId2, amount2, scoutId], {
        account: secondUserAccount.account
      });

      const accounts = [user1Address, user2Address];
      const tokenIds = [tokenId1, tokenId2];

      const balances = await builderNftContract.read.balanceOfBatch([accounts, tokenIds]);

      expect(balances[0]).toBe(amount1);
      expect(balances[1]).toBe(amount2);
    });

    it('Returns zeros for accounts with no tokens', async function () {
      const { userAccount: firstUserAccount, secondUserAccount } = await generateWallets();

      const user1Address = firstUserAccount.account.address;
      const user2Address = secondUserAccount.account.address;
      const tokenIds = [BigInt(1), BigInt(2)];
      const accounts = [user1Address, user2Address];

      const balances = await builderNftContract.read.balanceOfBatch([accounts, tokenIds]);

      expect(balances[0]).toBe(BigInt(0));
      expect(balances[1]).toBe(BigInt(0));
    });
  });

  describe('getERC20Contract()', function () {
    it('Returns the address of USDC contract', async function () {
      const { USDC } = usdc;

      const paymentTokenAddress = await builderNftContract.read.getERC20Contract();

      expect(paymentTokenAddress).toBe(getAddress(USDC.address));
    });
  });

  describe('getTokenPurchasePrice()', function () {
    it('Returns the correct price for purchasing a given amount of tokens, taking into account current supply and of 2 USDC per token', async function () {
      const { userAccount } = await generateWallets();

      const builderId = uuid();
      const tokenId = randomBigIntFromInterval();
      await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

      const priceForOneToken = await builderNftContract.read.getTokenPurchasePrice([BigInt(1)]);

      expect(priceForOneToken).toBe(BigInt(2e6));

      const priceForTwoTokens = await builderNftContract.read.getTokenPurchasePrice([BigInt(2)]);

      expect(priceForTwoTokens).toBe(BigInt(4e6));

      const priceForThreeTokens = await builderNftContract.read.getTokenPurchasePrice([BigInt(3)]);

      expect(priceForThreeTokens).toBe(BigInt(6e6));

      const minted = BigInt(1);

      await builderNftContract.write.mintTo([userAccount.account.address, tokenId, minted, builderId], {
        account: builderNftAdminAccount.account
      });

      const price = await builderNftContract.read.getTokenPurchasePrice([BigInt(1)]);

      expect(price).toBe(BigInt(2e6));

      const burnAmount = BigInt(1);

      await builderNftContract.write.burn([userAccount.account.address, tokenId, burnAmount, builderId], {
        account: builderNftAdminAccount.account
      });

      const priceAfterBurn = await builderNftContract.read.getTokenPurchasePrice([BigInt(7)]);

      // Burned 2 tokens, 1 token remains in supply (S), price should be constant
      expect(priceAfterBurn).toBe(BigInt(14e6));
    });
  });

  describe('totalSupply()', function () {
    it('Returns the total supply of a given tokenId', async function () {
      const { mintUSDCTo, approveUSDC, USDC_DECIMALS_MULTIPLIER } = usdc;

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

      await builderNftContract.write.mint([testUserAddress, tokenId, amount, scoutId], {
        account: secondUserAccount.account
      });

      const totalSupply = await builderNftContract.read.totalSupply([tokenId]);
      expect(totalSupply).toBe(amount);
    });

    it('Returns zero for tokens with no supply', async function () {
      const tokenId = BigInt(1);
      const totalSupply = await builderNftContract.read.totalSupply([tokenId]);
      expect(totalSupply).toBe(BigInt(0));
    });
  });

  describe('getBuilderIdForToken()', function () {
    it('Returns the correct builderId for a given tokenId', async function () {
      const builderId = uuid();
      const tokenId = randomBigIntFromInterval();
      await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

      const returnedBuilderId = await builderNftContract.read.getBuilderIdForToken([tokenId]);
      expect(returnedBuilderId).toBe(builderId);
    });

    it('Reverts if the tokenId is not registered', async function () {
      const invalidTokenId = BigInt(999);
      await expect(builderNftContract.read.getBuilderIdForToken([invalidTokenId])).rejects.toThrow(
        'Token not yet allocated'
      );
    });
  });

  describe('getTokenIdForBuilder()', function () {
    it('Returns the correct tokenId for a given builderId', async function () {
      const builderId = uuid();
      const tokenId = randomBigIntFromInterval();
      await builderNftContract.write.registerBuilderToken([builderId, tokenId]);

      const tokenIdFromStorage = await builderNftContract.read.getTokenIdForBuilder([builderId]);
      expect(tokenIdFromStorage).toBe(tokenId);
    });

    it('Reverts if the builderId is not registered', async function () {
      const invalidBuilderId = uuid();
      await expect(builderNftContract.read.getTokenIdForBuilder([invalidBuilderId])).rejects.toThrow(
        'Builder not registered'
      );
    });
  });

  describe('totalBuilderTokens()', function () {
    it('Returns the total number of registered builder tokens', async function () {
      let totalBuilderTokens = await builderNftContract.read.totalBuilderTokens();
      expect(totalBuilderTokens).toBe(BigInt(0));

      const builderId1 = uuid();
      const builderId2 = uuid();
      const tokenId1 = randomBigIntFromInterval();
      const tokenId2 = randomBigIntFromInterval();
      await builderNftContract.write.registerBuilderToken([builderId1, tokenId1]);
      await builderNftContract.write.registerBuilderToken([builderId2, tokenId2]);

      totalBuilderTokens = await builderNftContract.read.totalBuilderTokens();
      expect(totalBuilderTokens).toBe(BigInt(2));
    });
  });

  describe('getPriceIncrement()', function () {
    it('Returns the price increment used for calculating token prices', async function () {
      const priceIncrement = await builderNftContract.read.getPriceIncrement();
      expect(priceIncrement).toBeGreaterThan(BigInt(0));
    });
  });

  describe('uri()', function () {
    it('Returns the correct URI for a given tokenId', async function () {
      const prefix = 'https://nft.scoutgame.xyz/seasons/2024-W40/beta';
      const suffix = 'artwork.png';
      const tokenId = BigInt(1);

      // Set the URI prefix and suffix
      await builderNftContract.write.setUriPrefix([prefix]);
      await builderNftContract.write.setUriSuffix([suffix]);

      const uri = await builderNftContract.read.uri([tokenId]);

      const expectedUri = `${prefix}/${tokenId}/${suffix}`;
      expect(uri).toBe(expectedUri);
    });
  });

  describe('tokenURI()', function () {
    it('Returns the correct token URI for a given tokenId', async function () {
      const prefix = 'https://nft.scoutgame.xyz/seasons/2024-W40/beta';
      const suffix = 'artwork.png';
      const tokenId = BigInt(1);

      // Set the URI prefix and suffix
      await builderNftContract.write.setUriPrefix([prefix]);
      await builderNftContract.write.setUriSuffix([suffix]);

      const uri = await builderNftContract.read.tokenURI([tokenId]);

      const expectedUri = `${prefix}/${tokenId}/${suffix}`;
      expect(uri).toBe(expectedUri);
    });
  });

  describe('isValidUUID()', function () {
    it('Returns true for valid UUIDs', async function () {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const isValid = await builderNftContract.read.isValidUUID([validUuid]);
      expect(isValid).toBe(true);
    });

    it('Returns false for invalid UUIDs', async function () {
      const invalidUuid = 'invalid-uuid-string';
      const isValid = await builderNftContract.read.isValidUUID([invalidUuid]);
      expect(isValid).toBe(false);
    });
  });

  describe('getMinter()', function () {
    it('Should return the correct minter address', async function () {
      const { userAccount } = await generateWallets();
      const newMinter = userAccount.account.address;

      await builderNftContract.write.setMinter([newMinter]);

      const minter = await builderNftContract.read.getMinter();
      expect(getAddress(minter)).toBe(getAddress(newMinter));
    });
  });

  describe('name', () => {
    it('should return the token name', async () => {
      const name = await builderNftContract.read.name();
      expect(name).toBe(testContractName);
    });
  });

  describe('symbol', () => {
    it('should return the token symbol', async () => {
      const symbol = await builderNftContract.read.symbol();
      expect(symbol).toBe(testContractSymbol);
    });
  });
});
