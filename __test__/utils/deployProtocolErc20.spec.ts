import { deployProtocolERC20Token } from '../deployProtocolERC20Token';
import type { ProtocolERC20TestFixture } from '../deployProtocolERC20Token';
import { generateWallets } from '../generateWallets';

describe('deployProtocolERC20Token', () => {
  let ProtocolERC20: ProtocolERC20TestFixture;

  beforeAll(async () => {
    ProtocolERC20 = await deployProtocolERC20Token();
  });

  it('should deploy the ProtocolERC20 contract, with minting, approve, transfer, balanceOf and transferFrom enabled', async () => {
    const {
      mintProtocolERC20To,
      transferProtocolERC20,
      balanceOfProtocolERC20,
      approveProtocolERC20,
      transferProtocolERC20From
    } = ProtocolERC20;

    const { userAccount, secondUserAccount } = await generateWallets();

    const userBalance = await balanceOfProtocolERC20({ account: userAccount.account.address });

    expect(userBalance).toBe(0);

    const thousandProtocolERC20 = 1000;
    const fiftyProtocolERC20 = 50;
    const hundredProtocolERC20 = 100;

    // Mint 1000 ProtocolERC20 to the user
    await mintProtocolERC20To({ account: userAccount.account.address, amount: thousandProtocolERC20 });

    const newUserBalance = await balanceOfProtocolERC20({ account: userAccount.account.address });

    expect(newUserBalance).toBe(thousandProtocolERC20);

    // Test transfers
    await transferProtocolERC20({
      args: { to: secondUserAccount.account.address, amount: fiftyProtocolERC20 },
      wallet: userAccount
    });

    const userBalanceAfterTransfer = await balanceOfProtocolERC20({ account: userAccount.account.address });
    const secondUserBalance = await balanceOfProtocolERC20({ account: secondUserAccount.account.address });

    expect(userBalanceAfterTransfer).toBe(thousandProtocolERC20 - fiftyProtocolERC20);
    expect(secondUserBalance).toBe(fiftyProtocolERC20);

    // Check transferFrom transfers
    // We need to call approve() first
    await approveProtocolERC20({
      args: { spender: secondUserAccount.account.address, amount: hundredProtocolERC20 },
      wallet: userAccount
    });

    // test the transferFrom function
    await transferProtocolERC20From({
      args: { from: userAccount.account.address, to: secondUserAccount.account.address, amount: hundredProtocolERC20 },
      wallet: secondUserAccount
    });

    const userBalanceAfterTransferFrom = await balanceOfProtocolERC20({ account: userAccount.account.address });
    const secondUserBalanceAfterTransferFrom = await balanceOfProtocolERC20({
      account: secondUserAccount.account.address
    });

    expect(userBalanceAfterTransferFrom).toBe(thousandProtocolERC20 - (hundredProtocolERC20 + fiftyProtocolERC20));
    expect(secondUserBalanceAfterTransferFrom).toBe(fiftyProtocolERC20 + hundredProtocolERC20);
  });
});
