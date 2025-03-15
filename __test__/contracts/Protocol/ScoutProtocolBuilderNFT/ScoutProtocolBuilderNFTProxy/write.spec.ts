import { viem } from 'hardhat';
import { getAddress } from 'viem';

import { deployEASContracts } from '../../../../deployEAS';
import type { ScoutProtocolBuilderNFTFixture } from '../../../../deployScoutProtocolBuilderNft';
import { loadScoutProtocolBuilderNFTFixtures } from '../../../../fixtures';
import { walletFromKey, type GeneratedWallet } from '../../../../generateWallets';

function deployImplementation() {
  return viem.deployContract('ScoutGamePreSeason02NFTImplementation', []);
}

type DeployedImplementation = Awaited<ReturnType<typeof deployImplementation>>;

describe('ScoutProtocolNFTProxy', function () {
  let scoutProtocolBuilderNFT: ScoutProtocolBuilderNFTFixture;
  let erc1155AdminAccount: GeneratedWallet;
  let userAccount: GeneratedWallet;
  let newImplementation: DeployedImplementation;

  beforeEach(async () => {
    const fixtures = await loadScoutProtocolBuilderNFTFixtures();

    scoutProtocolBuilderNFT = fixtures.scoutProtocolBuilderNft;
    erc1155AdminAccount = fixtures.scoutProtocolBuilderNft.builderNftAdminAccount;
    userAccount = await walletFromKey();
    newImplementation = await deployImplementation();
  });

  describe('setImplementation()', function () {
    describe('effects', function () {
      it('Updates the implementation address correctly', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([newImplementation.address], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();

        const implementationAddress = await scoutProtocolBuilderNFT.builderProxyContract.read.implementation();
        expect(getAddress(implementationAddress as string)).toEqual(getAddress(newImplementation.address));
      });
    });

    describe('permissions', function () {
      it('Allows admin to set implementation', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([newImplementation.address], {
            account: erc1155AdminAccount.account
          })
        ).resolves.toBeDefined();
      });

      it('Prevents non-admin from setting implementation', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([newImplementation.address], {
            account: userAccount.account
          })
        ).rejects.toThrow('Caller is not the admin');
      });
    });

    describe('validations', function () {
      it('Reverts if new implementation address is zero address', async function () {
        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation(
            ['0x0000000000000000000000000000000000000000'],
            { account: erc1155AdminAccount.account }
          )
        ).rejects.toThrow('Invalid implementation address');
      });

      it('Reverts if new implementation address is an EOA wallet', async function () {
        const wallet = await walletFromKey();

        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([wallet.account.address], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Invalid address, must be a smart contract');
      });

      it('Reverts if new implementation address does not accept the upgrade', async function () {
        const badContract = await deployEASContracts().then((c) => c.ProtocolEASResolverContract);

        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([badContract.address], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('Invalid address, must accept the upgrade');
      });

      it('Reverts if new implementation address is the same as current', async function () {
        const currentImplementation = await scoutProtocolBuilderNFT.builderProxyContract.read.implementation();

        await expect(
          scoutProtocolBuilderNFT.builderProxyContract.write.setImplementation([currentImplementation], {
            account: erc1155AdminAccount.account
          })
        ).rejects.toThrow('New implementation must be different');
      });
    });
  });
});
