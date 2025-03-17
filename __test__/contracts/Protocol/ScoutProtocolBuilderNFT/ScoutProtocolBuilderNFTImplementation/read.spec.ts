import { v4 as uuid } from 'uuid';
import { getAddress } from 'viem';

import type { ScoutProtocolBuilderNFTFixture } from '../../../../deployScoutProtocolBuilderNft';
import type { ScoutTokenERC20TestFixture } from '../../../../deployScoutTokenERC20';
import { loadScoutProtocolBuilderNFTFixtures } from '../../../../fixtures';
import type { GeneratedWallet } from '../../../../generateWallets';
import { generateWallets } from '../../../../generateWallets';

describe('ScoutProtocolNFTImplementation', function () {
  let scoutProtocolBuilderNFT: ScoutProtocolBuilderNFTFixture;
  let erc20: ScoutTokenERC20TestFixture;
  let builderNftContract: ScoutProtocolBuilderNFTFixture['builderNftContract'];

  let builderAccount1: GeneratedWallet;
  let builderAccount2: GeneratedWallet;

  beforeAll(async function () {
    ({ userAccount: builderAccount1, secondUserAccount: builderAccount2 } = await generateWallets());
  });

  beforeEach(async function () {
    const fixture = await loadScoutProtocolBuilderNFTFixtures();
    scoutProtocolBuilderNFT = fixture.scoutProtocolBuilderNft;
    erc20 = fixture.token;
    builderNftContract = scoutProtocolBuilderNFT.builderNftContract;
  });

  describe('balanceOf()', function () {
    describe('returns', function () {
      it('Returns the correct balance of tokens for an account and tokenId', async function () {
        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, builderAccount1.account.address]);

        const tokenId = BigInt(1);
        const amount = BigInt(10);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenId, amount]);

        await erc20.fundWallet({
          account: testUserAddress,
          amount: Number(price / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });
        await erc20.approveScoutTokenERC20({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await builderNftContract.write.mint([testUserAddress, tokenId, amount], {
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
  });

  describe('balanceOfBatch()', function () {
    describe('returns', function () {
      it('Returns correct balances for multiple accounts and tokenIds', async function () {
        const { userAccount: firstUserAccount, secondUserAccount } = await generateWallets();

        const user1Address = firstUserAccount.account.address;
        const user2Address = secondUserAccount.account.address;
        const builderId1 = uuid();
        const builderId2 = uuid();

        await builderNftContract.write.registerBuilderToken([builderId1, builderAccount1.account.address]);
        await builderNftContract.write.registerBuilderToken([builderId2, builderAccount2.account.address]);

        const tokenId1 = BigInt(1);
        const tokenId2 = BigInt(2);

        const amount1 = BigInt(5);
        const amount2 = BigInt(10);

        const price1 = await builderNftContract.read.getTokenPurchasePrice([tokenId1, amount1]);
        const price2 = await builderNftContract.read.getTokenPurchasePrice([tokenId2, amount2]);

        await erc20.fundWallet({
          account: user1Address,
          amount: Number(price1 / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });
        await erc20.approveScoutTokenERC20({
          wallet: firstUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price1) }
        });

        await builderNftContract.write.mint([user1Address, tokenId1, amount1], {
          account: firstUserAccount.account
        });

        await erc20.fundWallet({
          account: user2Address,
          amount: Number(price2 / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });
        await erc20.approveScoutTokenERC20({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price2) }
        });

        await builderNftContract.write.mint([user2Address, tokenId2, amount2], {
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
  });

  describe('ERC20Token()', function () {
    describe('returns', function () {
      it('Returns the address of USDC contract', async function () {
        const paymentTokenAddress = await builderNftContract.read.ERC20Token();

        expect(paymentTokenAddress).toBe(getAddress(erc20.ScoutTokenERC20.address));
      });
    });
  });

  describe('getTokenPurchasePrice()', function () {
    describe('returns', function () {
      it('Returns the correct price for purchasing a given amount of tokens, taking into account current supply and bonding curve formula of 2S + 2', async function () {
        const { userAccount } = await generateWallets();

        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, builderAccount1.account.address]);

        const tokenId = BigInt(1);

        const priceForOneToken = await builderNftContract.read.getTokenPurchasePrice([tokenId, BigInt(1)]);

        expect(priceForOneToken).toBe(BigInt(100) * erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER);

        const priceForTwoTokens = await builderNftContract.read.getTokenPurchasePrice([tokenId, BigInt(2)]);

        expect(priceForTwoTokens).toBe(BigInt(300) * erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER);

        const priceForThreeTokens = await builderNftContract.read.getTokenPurchasePrice([tokenId, BigInt(3)]);

        expect(priceForThreeTokens).toBe(BigInt(600) * erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER);

        const minted = BigInt(3);

        await erc20.fundWallet({
          account: userAccount.account.address,
          amount: Number(priceForThreeTokens / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        await erc20.approveScoutTokenERC20({
          wallet: userAccount,
          args: { spender: builderNftContract.address, amount: Number(priceForThreeTokens) }
        });

        await builderNftContract.write.mint([userAccount.account.address, tokenId, minted], {
          account: userAccount.account
        });

        const price = await builderNftContract.read.getTokenPurchasePrice([tokenId, BigInt(1)]);

        expect(price).toBe(BigInt(400) * erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER);

        await builderNftContract.write.burn([userAccount.account.address, tokenId, BigInt(2)], {
          account: userAccount.account
        });

        const priceAfterBurn = await builderNftContract.read.getTokenPurchasePrice([tokenId, BigInt(1)]);

        // Burned 2 tokens, 1 token remains in supply (S) so the price should be 40e18, which is 2S + 2
        expect(priceAfterBurn).toBe(BigInt(200) * erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER);
      });
    });
  });

  describe('totalSupply()', function () {
    describe('returns', function () {
      it('Returns the total supply of a given tokenId', async function () {
        const { secondUserAccount } = await generateWallets();
        const testUserAddress = secondUserAccount.account.address;

        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, builderAccount1.account.address]);

        const tokenId = BigInt(1);
        const amount = BigInt(10);
        const price = await builderNftContract.read.getTokenPurchasePrice([tokenId, amount]);

        await erc20.fundWallet({
          account: testUserAddress,
          amount: Number(price / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });
        await erc20.approveScoutTokenERC20({
          wallet: secondUserAccount,
          args: { spender: builderNftContract.address, amount: Number(price) }
        });

        await builderNftContract.write.mint([testUserAddress, tokenId, amount], {
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
  });

  describe('getBuilderIdForToken()', function () {
    describe('returns', function () {
      it('Returns the correct builderId for a given tokenId', async function () {
        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, builderAccount1.account.address]);

        const tokenId = BigInt(1);
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
  });

  describe('getTokenIdForBuilder()', function () {
    describe('returns', function () {
      it('Returns the correct tokenId for a given builderId', async function () {
        const builderId = uuid();
        await builderNftContract.write.registerBuilderToken([builderId, builderAccount1.account.address]);

        const tokenId = await builderNftContract.read.getTokenIdForBuilder([builderId]);
        expect(tokenId).toBe(BigInt(1));
      });

      it('Reverts if the builderId is not registered', async function () {
        const invalidBuilderId = uuid();
        await expect(builderNftContract.read.getTokenIdForBuilder([invalidBuilderId])).rejects.toThrow(
          'Builder not registered'
        );
      });
    });
  });

  describe('totalBuilderTokens()', function () {
    describe('returns', function () {
      it('Returns the total number of registered builder tokens', async function () {
        let totalBuilderTokens = await builderNftContract.read.totalBuilderTokens();
        expect(totalBuilderTokens).toBe(BigInt(0));

        const builderId1 = uuid();
        const builderId2 = uuid();
        await builderNftContract.write.registerBuilderToken([builderId1, builderAccount1.account.address]);
        await builderNftContract.write.registerBuilderToken([builderId2, builderAccount2.account.address]);

        totalBuilderTokens = await builderNftContract.read.totalBuilderTokens();
        expect(totalBuilderTokens).toBe(BigInt(2));
      });
    });
  });

  describe('getPriceIncrement()', function () {
    describe('returns', function () {
      it('Returns the price increment used for calculating token prices', async function () {
        const priceIncrement = await builderNftContract.read.getPriceIncrement();
        expect(priceIncrement).toBeGreaterThan(BigInt(0));
      });
    });
  });

  describe('uri()', function () {
    describe('returns', function () {
      it('Returns the correct URI for a given tokenId', async function () {
        const prefix = 'https://nft.scoutgame.xyz/seasons/2024-W40/beta';
        const suffix = 'artwork.png';
        const tokenId = BigInt(1);

        // Set the URI prefix and suffix
        await builderNftContract.write.setBaseUri([prefix, suffix]);

        const uri = await builderNftContract.read.uri([tokenId]);

        const expectedUri = `${prefix}/${tokenId}/${suffix}`;
        expect(uri).toBe(expectedUri);
      });
    });
  });

  describe('tokenURI()', function () {
    describe('returns', function () {
      it('Returns the correct token URI for a given tokenId', async function () {
        const prefix = 'https://nft.scoutgame.xyz/seasons/2024-W40/beta';
        const suffix = 'artwork.png';
        const tokenId = BigInt(1);

        // Set the URI prefix and suffix
        await builderNftContract.write.setBaseUri([prefix, suffix]);

        const uri = await builderNftContract.read.tokenURI([tokenId]);

        const expectedUri = `${prefix}/${tokenId}/${suffix}`;
        expect(uri).toBe(expectedUri);
      });
    });
  });
  describe('minter()', function () {
    describe('returns', function () {
      it('Should return the correct minter address', async function () {
        const { userAccount } = await generateWallets();
        const newMinter = userAccount.account.address;

        await builderNftContract.write.setMinter([newMinter]);

        const minter = await builderNftContract.read.minter();
        expect(getAddress(minter)).toBe(getAddress(newMinter));
      });
    });
  });

  describe('acceptUpgrade()', function () {
    describe('returns', function () {
      it('returns its own address', async function () {
        const address = await builderNftContract.read.acceptUpgrade();
        expect(getAddress(address)).toBe(getAddress(builderNftContract.address));
      });
    });
  });

  describe('supportsInterface()', function () {
    describe('returns', function () {
      it('Returns true for IERC1155 and IERC1155MetadataURI', async function () {
        const IERC1155Bytes = '0xd9b67a26';
        const IERC1155MetadataURIBytes = '0x0e89341c';
        const supportsIERC1155 = await builderNftContract.read.supportsInterface([IERC1155Bytes]);
        expect(supportsIERC1155).toBe(true);
        const supportsIERC1155MetadataURI = await builderNftContract.read.supportsInterface([IERC1155MetadataURIBytes]);
        expect(supportsIERC1155MetadataURI).toBe(true);
      });

      it('Returns false for ERC20 and ERC721 interfaces', async function () {
        const ERC20Bytes = '0x01ffc9a7';
        const ERC721Bytes = '0x80ac58cd';
        const supportsERC20 = await builderNftContract.read.supportsInterface([ERC20Bytes]);
        expect(supportsERC20).toBe(false);

        const supportsERC721 = await builderNftContract.read.supportsInterface([ERC721Bytes]);
        expect(supportsERC721).toBe(false);
      });
    });
  });
});
