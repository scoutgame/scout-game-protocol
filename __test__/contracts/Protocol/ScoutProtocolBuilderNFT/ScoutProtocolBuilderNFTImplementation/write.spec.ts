import { randomBytes } from 'node:crypto';

import { v4 as uuid } from 'uuid';
import type { Address } from 'viem';
import { parseEventLogs } from 'viem';

import type { ScoutProtocolBuilderNFTFixture } from '../../../../deployScoutProtocolBuilderNft';
import type { ScoutTokenERC20TestFixture } from '../../../../deployScoutTokenERC20';
import { loadScoutProtocolBuilderNFTFixtures } from '../../../../fixtures';
import { generateWallets, walletFromKey, type GeneratedWallet } from '../../../../generateWallets';

function randomEthereumAddress() {
  const randomAddress = `0x${randomBytes(20).toString('hex')}`;
  return randomAddress as Address;
}

async function registerBuilderToken({
  wallet,
  nft,
  builderAddress = randomEthereumAddress()
}: {
  wallet: GeneratedWallet;
  nft: ScoutProtocolBuilderNFTFixture;
  builderAddress?: Address;
}): Promise<{ builderId: string; builderAddress: Address; tokenId: bigint }> {
  const builderId = uuid();

  await nft.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
    account: wallet.account
  });

  const tokenId = await nft.builderNftContract.read.getTokenIdForBuilder([builderId]);

  return { builderId, builderAddress, tokenId };
}

async function mintNft({
  wallet,
  erc20,
  nft,
  amount,
  tokenId
}: {
  wallet: GeneratedWallet;
  erc20: ScoutTokenERC20TestFixture;
  nft: ScoutProtocolBuilderNFTFixture;
  amount: number | bigint;
  tokenId: number | bigint;
}) {
  // Get price
  const price = await nft.builderNftContract.read.getTokenPurchasePrice([
    typeof tokenId === 'number' ? BigInt(tokenId) : tokenId,
    typeof amount === 'number' ? BigInt(amount) : amount
  ]);

  // Fund wallet
  await erc20.fundWallet({
    account: wallet.account.address,
    amount: Number(price / erc20.ScoutTokenERC20_DECIMAL_MULTIPLIER)
  });

  // Approve the contract to spend ScoutTokenERC20
  await erc20.ScoutTokenERC20.write.approve([nft.builderNftContract.address, price], {
    account: wallet.account
  });

  // Mint NFT
  await nft.builderNftContract.write.mint([wallet.account.address, BigInt(tokenId), BigInt(amount)], {
    account: wallet.account
  });
}

describe('ScoutProtocolBuilderNFTImplementation', function () {
  let token: ScoutTokenERC20TestFixture;
  let scoutProtocolBuilderNFT: ScoutProtocolBuilderNFTFixture;
  let erc1155AdminAccount: GeneratedWallet;

  let userAccount: GeneratedWallet;
  let proceedsReceiverAccount: GeneratedWallet;

  beforeEach(async () => {
    const fixtures = await loadScoutProtocolBuilderNFTFixtures();

    token = fixtures.token;
    scoutProtocolBuilderNFT = fixtures.scoutProtocolBuilderNft;
    erc1155AdminAccount = fixtures.scoutProtocolBuilderNft.builderNftAdminAccount;
    proceedsReceiverAccount = fixtures.scoutProtocolBuilderNft.proceedsReceiverAccount;
    userAccount = await walletFromKey();
  });

  describe('registerBuilderToken()', function () {
    describe('effects', function () {
      it('Register a new builder token using a builderId', async function () {
        const builderId = uuid(); // Sample UUID

        const builderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const tokenId = await scoutProtocolBuilderNFT.builderNftContract.read.getBuilderIdForToken([BigInt(1)]);
        expect(tokenId).toBe(builderId);
      });
    });

    describe('events', function () {
      it('Emits BuilderTokenRegistered event new tokenId and builderId', async function () {
        const builderId = uuid(); // Sample UUID
        const builderAddress = randomEthereumAddress();
        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken(
          [builderId, builderAddress],
          {
            account: erc1155AdminAccount.account
          }
        );

        // Extract logs and parse events
        const receipt = await userAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['BuilderTokenRegistered']
        });

        const decodedEvent = parsedLogs.find((log) => log.eventName === 'BuilderTokenRegistered');

        expect(decodedEvent).toBeDefined();

        expect(decodedEvent!.args.tokenId).toEqual(BigInt(1));
        expect(decodedEvent!.args.builderId).toEqual(builderId);
      });
    });

    describe('permissions', function () {
      it('Normal users cannot register a builder token', async function () {
        const builderId = uuid();
        const builderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not the admin or minter');
      });

      it('Minter can register a builder token', async function () {
        await scoutProtocolBuilderNFT.builderNftContract.write.setMinter([userAccount.account.address], {
          account: erc1155AdminAccount.account
        });

        const builderId = uuid();

        const builderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();
      });
    });

    describe('validations', function () {
      it('Revert if the builderId is already registered', async function () {
        const builderId = uuid();
        const builderAddress = randomEthereumAddress();
        await scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
          account: erc1155AdminAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([builderId, builderAddress], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Builder already registered');
      });

      it('Revert if the builderId is empty', async function () {
        const builderAddress = randomEthereumAddress();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken([null as any, builderAddress], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Builder ID must be a valid UUID');
      });

      it('Revert if the builderId is an invalid uuid', async function () {
        const builderAddress = randomEthereumAddress();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken(['', builderAddress], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Builder ID must be a valid UUID');

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.registerBuilderToken(['abc', builderAddress], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Builder ID must be a valid UUID');
      });
    });
  });

  describe('mint()', function () {
    describe('effects', function () {
      it('Mints tokens to a user account', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Transfer tokens to user to cover mint price
        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          tokenId,
          BigInt(1)
        ]);
        await token.fundWallet({
          account: userAccount.account.address,
          amount: Number(mintPrice / token.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        // Approve NFT contract to spend user's tokens
        await token.ScoutTokenERC20.write.approve([scoutProtocolBuilderNFT.builderNftContract.address, mintPrice], {
          account: userAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint([userAccount.account.address, BigInt(1), BigInt(1)], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();

        // Check balance
        const balance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userAccount.account.address,
          BigInt(1)
        ]);
        expect(balance).toEqual(BigInt(1));
      });

      it('Mints tokens to a different address than the one paying for the transfer', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        const userReceivingGift = await walletFromKey();

        // Transfer tokens to user to cover mint price
        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          tokenId,
          BigInt(1)
        ]);
        await token.fundWallet({
          account: userAccount.account.address,
          amount: Number(mintPrice / token.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        // Approve NFT contract to spend user's tokens
        await token.ScoutTokenERC20.write.approve([scoutProtocolBuilderNFT.builderNftContract.address, mintPrice], {
          account: userAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint(
            [userReceivingGift.account.address, BigInt(1), BigInt(1)],
            {
              account: userAccount.account
            }
          )
        ).resolves.toBeDefined();

        // Check balance
        const balance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userReceivingGift.account.address,
          BigInt(1)
        ]);
        expect(balance).toEqual(BigInt(1));
      });

      it('Increments total supply of the token', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        const totalSupply = await scoutProtocolBuilderNFT.builderNftContract.read.totalSupply([BigInt(tokenId)]);

        expect(totalSupply).toEqual(BigInt(0));

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        const updatedTotalSupply = await scoutProtocolBuilderNFT.builderNftContract.read.totalSupply([BigInt(tokenId)]);

        expect(updatedTotalSupply).toEqual(BigInt(1));

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 3,
          tokenId
        });

        const finalTotalSupply = await scoutProtocolBuilderNFT.builderNftContract.read.totalSupply([BigInt(tokenId)]);

        expect(finalTotalSupply).toEqual(BigInt(4));
      });

      it('Forwards 20% of the $DEV to the builder, and the remaining 80% to the proceeds receiver', async function () {
        const { tokenId, builderAddress } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        const amountToMint = BigInt(7);

        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          BigInt(tokenId),
          amountToMint
        ]);

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: amountToMint,
          tokenId
        });

        const builderBalance = await token.ScoutTokenERC20.read.balanceOf([builderAddress]);

        const proceedsReceiverBalance = await token.ScoutTokenERC20.read.balanceOf([
          proceedsReceiverAccount.account.address
        ]);

        expect(proceedsReceiverBalance).toEqual((mintPrice * BigInt(80)) / BigInt(100));
        expect(builderBalance).toEqual((mintPrice * BigInt(20)) / BigInt(100));
      });
    });

    describe('events', function () {
      it('Emits TransferSingle event on mint', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        const userReceivingGift = await walletFromKey();

        const tokensToBuy = BigInt(22);

        // Transfer tokens to user to cover mint price
        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          tokenId,
          tokensToBuy
        ]);
        await token.fundWallet({
          account: userAccount.account.address,
          amount: Number(mintPrice / token.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        // Approve NFT contract to spend user's tokens
        await token.ScoutTokenERC20.write.approve([scoutProtocolBuilderNFT.builderNftContract.address, mintPrice], {
          account: userAccount.account
        });

        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.mint(
          [userReceivingGift.account.address, tokenId, tokensToBuy],
          {
            account: userAccount.account
          }
        );

        const receipt = await userAccount.getTransactionReceipt({ hash: txResponse });

        const transferEvent = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        })[0];

        expect(transferEvent).toBeDefined();
        expect(transferEvent!.args.operator).toEqual(userAccount.account.address);
        expect(transferEvent!.args.from).toEqual('0x0000000000000000000000000000000000000000');
        expect(transferEvent!.args.to).toEqual(userReceivingGift.account.address);
        expect(transferEvent!.args.id).toEqual(tokenId);
        expect(transferEvent!.args.value).toEqual(tokensToBuy);
      });
    });

    describe('permissions', function () {
      it('Allows any user to mint tokens if they pay the price', async function () {
        // Setup similar to effects test
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        proceedsReceiverAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setProceedsReceiver(
          [proceedsReceiverAccount.account.address],
          {
            account: erc1155AdminAccount.account
          }
        );

        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          tokenId,
          BigInt(1)
        ]);
        await token.fundWallet({
          account: userAccount.account.address,
          amount: Number(mintPrice / token.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        await token.ScoutTokenERC20.write.approve([scoutProtocolBuilderNFT.builderNftContract.address, mintPrice], {
          account: userAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint([userAccount.account.address, BigInt(1), BigInt(1)], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();
      });

      it('Cannot mint when contract is paused', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await scoutProtocolBuilderNFT.builderNftContract.write.pause({
          account: erc1155AdminAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint([userAccount.account.address, tokenId, BigInt(1)], {
            account: userAccount.account
          })
        ).rejects.toThrow('Contract is paused');

        await scoutProtocolBuilderNFT.builderNftContract.write.unPause({
          account: erc1155AdminAccount.account
        });

        await token.fundWallet({
          account: userAccount.account.address,
          amount: 100
        });

        await token.approveScoutTokenERC20({
          args: {
            amount: 100,
            spender: scoutProtocolBuilderNFT.builderNftContract.address
          },
          wallet: userAccount
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint([userAccount.account.address, tokenId, BigInt(1)], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([userAccount.account.address, tokenId], {
            account: userAccount.account
          })
        ).resolves.toEqual(BigInt(1));
      });
    });

    describe('validations', function () {
      it('Reverts if token supply limit is reached', async function () {
        await scoutProtocolBuilderNFT.builderNftContract.write.setMaxSupplyPerToken([BigInt(78)], {
          account: erc1155AdminAccount.account
        });

        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 78,
          tokenId
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint([userAccount.account.address, tokenId, BigInt(1)], {
            account: userAccount.account
          })
        ).rejects.toThrow('Token supply limit reached');
      });

      it('Reverts if tokenId is not registered', async function () {
        const unregisteredTokenId = BigInt(999);
        const mintPrice = await scoutProtocolBuilderNFT.builderNftContract.read.getTokenPurchasePrice([
          unregisteredTokenId,
          BigInt(1)
        ]);
        await token.fundWallet({
          account: userAccount.account.address,
          amount: Number(mintPrice / token.ScoutTokenERC20_DECIMAL_MULTIPLIER)
        });

        await token.ScoutTokenERC20.write.approve([scoutProtocolBuilderNFT.builderNftContract.address, mintPrice], {
          account: userAccount.account
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.mint(
            [userAccount.account.address, unregisteredTokenId, BigInt(1)],
            { account: userAccount.account }
          )
        ).rejects.toThrow('Token ID not registered');
      });
    });
  });

  describe('burn()', function () {
    describe('effects', function () {
      it('Burns tokens from a user account', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens first
        // Setup similar to mint test
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Burn tokens
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, tokenId, BigInt(1)], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();

        // Check balance
        const balance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userAccount.account.address,
          BigInt(1)
        ]);
        expect(balance).toEqual(BigInt(0));
      });

      it('Decrements total supply of the token', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 5,
          tokenId
        });

        const totalSupply = await scoutProtocolBuilderNFT.builderNftContract.read.totalSupply([BigInt(tokenId)]);

        expect(totalSupply).toEqual(BigInt(5));

        await scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, tokenId, BigInt(2)], {
          account: userAccount.account
        });

        const updatedTotalSupply = await scoutProtocolBuilderNFT.builderNftContract.read.totalSupply([BigInt(tokenId)]);

        expect(updatedTotalSupply).toEqual(BigInt(3));
      });
    });

    describe('events', function () {
      it('Emits TransferSingle event on burn', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens first
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Burn tokens
        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.burn(
          [userAccount.account.address, BigInt(1), BigInt(1)],
          { account: userAccount.account }
        );

        const receipt = await userAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        });

        const transferEvent = parsedLogs.find((log) => log.eventName === 'TransferSingle');

        expect(transferEvent).toBeDefined();
        expect(transferEvent!.args.operator).toEqual(userAccount.account.address);
        expect(transferEvent!.args.from).toEqual(userAccount.account.address);
        expect(transferEvent!.args.to).toEqual('0x0000000000000000000000000000000000000000');
        expect(transferEvent!.args.id).toEqual(BigInt(1));
        expect(transferEvent!.args.value).toEqual(BigInt(1));

        // Check balance
        const balance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userAccount.account.address,
          BigInt(1)
        ]);
        expect(balance).toEqual(BigInt(1));
      });
    });

    describe('permissions', function () {
      it('Allows token owner to burn tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens first
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Burn tokens
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, BigInt(1), BigInt(1)], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();
      });

      it('Allows approved operator to burn tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens first
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Approve operator
        const operatorAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Burn tokens as operator
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, BigInt(1), BigInt(1)], {
            account: operatorAccount.account
          })
        ).resolves.toBeDefined();
      });

      it('Prevents burning tokens if not owner nor approved', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens first
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Attempt to burn without approval
        const anotherAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, BigInt(1), BigInt(1)], {
            account: anotherAccount.account
          })
        ).rejects.toThrow('ERC1155: caller is not owner nor approved');
      });
    });

    describe('validations', function () {
      it('Reverts if burning more tokens than balance', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Attempt to burn more than balance
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.burn([userAccount.account.address, tokenId, BigInt(2)], {
            account: userAccount.account
          })
        ).rejects.toThrow('Cannot decrease balance below 0');
      });
    });
  });

  describe('setApprovalForAll()', function () {
    describe('effects', function () {
      it('Sets operator approval for the caller', async function () {
        const operatorAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll([operatorAccount.account.address, true], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();

        const isApproved = await scoutProtocolBuilderNFT.builderNftContract.read.isApprovedForAll([
          userAccount.account.address,
          operatorAccount.account.address
        ]);
        expect(isApproved).toEqual(true);
      });
    });

    describe('events', function () {
      it('Emits ApprovalForAll event', async function () {
        const operatorAccount = await walletFromKey();

        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          { account: userAccount.account }
        );

        const receipt = await userAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['ApprovalForAll']
        });

        const approvalEvent = parsedLogs.find((log) => log.eventName === 'ApprovalForAll');

        expect(approvalEvent).toBeDefined();
        expect(approvalEvent!.args.account).toEqual(userAccount.account.address);
        expect(approvalEvent!.args.operator).toEqual(operatorAccount.account.address);
        expect(approvalEvent!.args.approved).toEqual(true);
      });
    });

    describe('permissions', function () {
      it('Allows any user to set operator approval', async function () {
        const operatorAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll([operatorAccount.account.address, true], {
            account: userAccount.account
          })
        ).resolves.toBeDefined();
      });
    });

    describe('validations', function () {
      it('Reverts if setting approval for self', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll([userAccount.account.address, true], {
            account: userAccount.account
          })
        ).rejects.toThrow('ERC1155: setting approval status for self');
      });
    });
  });

  describe('safeTransferFrom()', function () {
    describe('effects', function () {
      it('Transfers tokens from one account to another', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Approve operator
        const operatorAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, BigInt(1), BigInt(1), '0x'],
            { account: operatorAccount.account }
          )
        ).resolves.toBeDefined();

        // Check balances
        const senderBalance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userAccount.account.address,
          BigInt(1)
        ]);
        expect(senderBalance).toEqual(BigInt(0));

        const recipientBalance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          recipientAccount.account.address,
          BigInt(1)
        ]);
        expect(recipientBalance).toEqual(BigInt(1));
      });
    });

    describe('events', function () {
      it('Emits TransferSingle event on transfer', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Setup similar to effects test
        const { userAccount: recipientAccount, secondUserAccount: operatorAccount } = await generateWallets();

        // Approve operator
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Perform transfer
        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
          [userAccount.account.address, recipientAccount.account.address, BigInt(1), BigInt(1), '0x'],
          { account: operatorAccount.account }
        );

        const receipt = await operatorAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferSingle']
        });

        const transferEvent = parsedLogs.find((log) => log.eventName === 'TransferSingle');

        expect(transferEvent).toBeDefined();
        expect(transferEvent!.args.operator).toEqual(operatorAccount.account.address);
        expect(transferEvent!.args.from).toEqual(userAccount.account.address);
        expect(transferEvent!.args.to).toEqual(recipientAccount.account.address);
        expect(transferEvent!.args.id).toEqual(BigInt(1));
        expect(transferEvent!.args.value).toEqual(BigInt(1));
      });
    });

    describe('permissions', function () {
      it('Allows token owner to transfer tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });
        // Setup similar to mint test

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, tokenId, BigInt(1), '0x'],
            { account: userAccount.account }
          )
        ).resolves.toBeDefined();
      });

      it('Allows approved operator to transfer tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Setup similar to previous test
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Approve operator
        const operatorAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, tokenId, BigInt(1), '0x'],
            { account: operatorAccount.account }
          )
        ).resolves.toBeDefined();
      });

      it('Prevents transferring tokens if not owner nor approved', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Setup similar to mint test
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Attempt transfer without approval
        const anotherAccount = await walletFromKey();
        const recipientAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, BigInt(1), BigInt(1), '0x'],
            { account: anotherAccount.account }
          )
        ).rejects.toThrow('ERC1155: caller is not owner nor approved');
      });
    });

    describe('validations', function () {
      it('Reverts if caller is not owner nor approved', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Attempt transfer without approval
        const anotherAccount = await walletFromKey();
        const recipientAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, tokenId, BigInt(1), '0x'],
            { account: anotherAccount.account }
          )
        ).rejects.toThrow('ERC1155: caller is not owner nor approved');
      });

      it('Reverts if transferring more tokens than balance', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 1,
          tokenId
        });

        // Attempt to transfer more than balance
        const recipientAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, BigInt(1), BigInt(2), '0x'],
            { account: userAccount.account }
          )
        ).rejects.toThrow('ERC1155: insufficient balance for transfer');
      });
    });
  });

  describe('safeBatchTransferFrom()', function () {
    describe('effects', function () {
      it('Transfers multiple tokens from one account to another', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Approve operator
        const operatorAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(1)], '0x'],
            { account: operatorAccount.account }
          )
        ).resolves.toBeDefined();

        // Check balances
        const senderBalance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          userAccount.account.address,
          BigInt(1)
        ]);
        expect(senderBalance).toEqual(BigInt(1));

        const recipientBalance = await scoutProtocolBuilderNFT.builderNftContract.read.balanceOf([
          recipientAccount.account.address,
          BigInt(1)
        ]);
        expect(recipientBalance).toEqual(BigInt(1));
      });
    });

    describe('events', function () {
      it('Emits TransferBatch event on transfer', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Setup similar to effects test
        const { userAccount: recipientAccount, secondUserAccount: operatorAccount } = await generateWallets();

        // Approve operator
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Perform transfer
        const txResponse = await scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
          [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(1)], '0x'],
          { account: operatorAccount.account }
        );

        const receipt = await operatorAccount.getTransactionReceipt({ hash: txResponse });

        const parsedLogs = parseEventLogs({
          abi: scoutProtocolBuilderNFT.builderNftContract.abi,
          logs: receipt.logs,
          eventName: ['TransferBatch']
        });

        const transferEvent = parsedLogs.find((log) => log.eventName === 'TransferBatch');

        expect(transferEvent).toBeDefined();

        expect(transferEvent!.args.operator).toEqual(operatorAccount.account.address);
        expect(transferEvent!.args.from).toEqual(userAccount.account.address);
        expect(transferEvent!.args.to).toEqual(recipientAccount.account.address);
        expect(transferEvent!.args.ids).toEqual([BigInt(1)]);
        expect(transferEvent!.args.values).toEqual([BigInt(1)]);
      });
    });

    describe('permissions', function () {
      it('Allows token owner to transfer tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });
        // Setup similar to mint test

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(1)], '0x'],
            { account: userAccount.account }
          )
        ).resolves.toBeDefined();
      });

      it('Allows approved operator to transfer tokens', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Setup similar to previous test
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Approve operator
        const operatorAccount = await walletFromKey();
        await scoutProtocolBuilderNFT.builderNftContract.write.setApprovalForAll(
          [operatorAccount.account.address, true],
          {
            account: userAccount.account
          }
        );

        // Transfer tokens
        const recipientAccount = await walletFromKey();
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(1)], '0x'],
            { account: operatorAccount.account }
          )
        ).resolves.toBeDefined();
      });

      it('Prevents transferring tokens if not owner nor approved', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Setup similar to mint test
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Attempt transfer without approval
        const anotherAccount = await walletFromKey();
        const recipientAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(1)], '0x'],
            { account: anotherAccount.account }
          )
        ).rejects.toThrow('ERC1155: caller is not owner nor approved');
      });
    });

    describe('validations', function () {
      it('Reverts if transferring more tokens than balance', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        // Mint tokens to userAccount
        await mintNft({
          wallet: userAccount,
          erc20: token,
          nft: scoutProtocolBuilderNFT,
          amount: 2,
          tokenId
        });

        // Attempt to transfer more than balance
        const recipientAccount = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.safeBatchTransferFrom(
            [userAccount.account.address, recipientAccount.account.address, [BigInt(1)], [BigInt(3)], '0x'],
            { account: userAccount.account }
          )
        ).rejects.toThrow('ERC1155: insufficient balance for transfer');
      });
    });
  });

  describe('setBaseUri()', function () {
    const newBaseUri = 'https://newbase.uri';
    const uriSuffix = 'metadata.json';
    describe('effects', function () {
      it('Updates the base URI when called with a valid newBaseUri', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setBaseUri([newBaseUri, uriSuffix], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const uri = await scoutProtocolBuilderNFT.builderNftContract.read.uri([BigInt(1)]);
        expect(uri).toEqual(`${newBaseUri}/${1}/${uriSuffix}`);
      });
    });

    describe('permissions', function () {
      it('Only admin can set the base URI', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setBaseUri([newBaseUri, uriSuffix], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });
    });
  });

  describe('updateBuilderTokenAddress()', function () {
    describe('effects', function () {
      it('Updates the builder address for a token', async function () {
        const builderAddress = randomEthereumAddress();

        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT,
          builderAddress
        });

        const newBuilderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress([tokenId, newBuilderAddress], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const updatedAddress = await scoutProtocolBuilderNFT.builderNftContract.read.getBuilderAddressForToken([
          tokenId
        ]);
        expect(updatedAddress.toLowerCase()).toEqual(newBuilderAddress.toLowerCase());
      });
    });

    describe('permissions', function () {
      it('Allows current builder to update their address', async function () {
        const builderAccount = await walletFromKey();

        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT,
          builderAddress: builderAccount.account.address
        });

        const newBuilderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress([tokenId, newBuilderAddress], {
            account: builderAccount.account
          })
        ).resolves.toBeDefined();

        const updatedAddress = await scoutProtocolBuilderNFT.builderNftContract.read.getBuilderAddressForToken([
          tokenId
        ]);
        expect(updatedAddress.toLowerCase()).toEqual(newBuilderAddress.toLowerCase());
      });

      it('Allows admin to update builder address', async function () {
        const builderAccount = await walletFromKey();

        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT,
          builderAddress: builderAccount.account.address
        });

        const newBuilderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress([tokenId, newBuilderAddress], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const updatedAddress = await scoutProtocolBuilderNFT.builderNftContract.read.getBuilderAddressForToken([
          tokenId
        ]);
        expect(updatedAddress.toLowerCase()).toEqual(newBuilderAddress.toLowerCase());
      });

      it('Reverts if caller is not admin or current builder', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        const newBuilderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress([tokenId, newBuilderAddress], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not admin or builder');
      });
    });

    describe('validations', function () {
      it('Reverts if new address is zero address', async function () {
        const { tokenId } = await registerBuilderToken({
          wallet: erc1155AdminAccount,
          nft: scoutProtocolBuilderNFT
        });

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress(
            [tokenId, '0x0000000000000000000000000000000000000000'],
            {
              account: erc1155AdminAccount.account
            }
          )
        ).rejects.toThrow('Invalid address');
      });

      it('Reverts if token is not yet allocated', async function () {
        const unallocatedTokenId = BigInt(999);
        const newBuilderAddress = randomEthereumAddress();

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.updateBuilderTokenAddress(
            [unallocatedTokenId, newBuilderAddress],
            {
              account: erc1155AdminAccount.account
            }
          )
        ).rejects.toThrow('Token not yet allocated');
      });
    });
  });

  describe('setMaxSupplyPerToken()', function () {
    describe('effects', function () {
      it('Updates the max supply per token', async function () {
        const newMaxSupply = BigInt(127);

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setMaxSupplyPerToken([newMaxSupply], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const maxSupply = await scoutProtocolBuilderNFT.builderNftContract.read.maxSupplyPerToken();
        expect(maxSupply).toEqual(newMaxSupply);
      });
    });

    describe('permissions', function () {
      it('Only admin can set the max supply per token', async function () {
        const newMaxSupply = BigInt(128);

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setMaxSupplyPerToken([newMaxSupply], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });
    });

    describe('validations', function () {
      it('Reverts if new max supply is zero', async function () {
        const newMaxSupply = BigInt(0);

        await expect(
          scoutProtocolBuilderNFT.builderNftContract.write.setMaxSupplyPerToken([newMaxSupply], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Max supply must be greater than 0');
      });
    });
  });
});
