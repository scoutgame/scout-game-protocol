import type { Address } from 'viem';
import { getAddress } from 'viem';

import type { ScoutProtocolBuilderNFTFixture } from '../../../../deployScoutProtocolBuilderNft';
import { loadScoutProtocolBuilderNFTFixtures } from '../../../../fixtures';

describe('ScoutProtocolNFTProxy', function () {
  let scoutProtocolBuilderNFT: ScoutProtocolBuilderNFTFixture;

  beforeEach(async () => {
    const fixtures = await loadScoutProtocolBuilderNFTFixtures();

    scoutProtocolBuilderNFT = fixtures.scoutProtocolBuilderNft;
  });

  describe('implementation()', function () {
    describe('returns', function () {
      it('Returns the current implementation address', async function () {
        const implementationAddress = await scoutProtocolBuilderNFT.builderProxyContract.read.implementation();
        expect(getAddress(implementationAddress as Address)).toEqual(
          getAddress(scoutProtocolBuilderNFT.builderImplementationContract.address)
        );
      });
    });
  });
});
