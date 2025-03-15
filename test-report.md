# Test Report

## Contract: LockupWeeklyStreamCreator

### Write Methods

#### createStream()

- **Effects**:
  - creates a claimable, cancellable, non-transferable stream for the protocol
  - immediately deducts the balance from the stream creator

#### claim()

- **Effects**:
  - allows the protocol contract to receive a stream in 13 tranches with the first tranche unlockable at the target timestamp and the 12 increments spread out by 1 week each following the allocation percentages: 5%, 5%, 6%, 6%, 7%, 7%, 8%, 8%, 9%, 9%, 10%, 10%, 10%
- **Validations**:
  - throws an error if there are no tokens to claim

#### (SablierLockupTranched) cancel()

- **Effects**:
  - allows the stream creator to cancel the stream and receive a refund for the remaining assets

## Contract: MemoryUtils

### Read Methods

#### IMPLEMENTATION_SLOT

- **Returns**:
  - the correct value, compliant with EIP 1967

#### PROCEEDS_RECEIVER_SLOT

- **Returns**:
  - the correct value

#### CLAIMS_TOKEN_SLOT

- **Returns**:
  - the correct value

#### MINTER_SLOT

- **Returns**:
  - the correct value

#### CLAIMS_HISTORY_SLOT

- **Returns**:
  - the correct value

#### WEEKLY_MERKLE_ROOTS_SLOT

- **Returns**:
  - the correct value

#### ADMIN_SLOT

- **Returns**:
  - the correct value

#### PAUSER_SLOT

- **Returns**:
  - the correct value

#### CLAIM_MANAGER_SLOT

- **Returns**:
  - the correct value

#### EAS_ATTESTER_SLOT

- **Returns**:
  - the correct value

#### SECONDARY_EAS_ATTESTER_SLOT

- **Returns**:
  - the correct value

#### IS_PAUSED_SLOT

- **Returns**:
  - the correct value

## Contract: ProtocolAccessControl

### Write Methods

#### transferAdmin

- **Effects**:
  - allows admin to transfer admin
- **Permissions**:
  - reverts when not called by admin
- **Validations**:
  - reverts when setting to zero address

#### setRole

- **Effects**:
  - sets a role to a new account
- **Validations**:
  - reverts when setting to zero address
- **Events**:
  - emits a RoleTransferred event with roleName, previous and new holder if the new holder is different from the previous one

#### pause

- **Effects**:
  - marks the contract as paused
- **Permissions**:
  - can be paused by the pauser role
  - reverts when called by non-pauser and non-admin
- **Events**:
  - emits Paused event when paused

#### unPause

- **Effects**:
  - allows admin to unpause the contract
- **Permissions**:
  - reverts when called by non-admin
- **Events**:
  - emits Unpaused event when unpaused

#### testPaused

#### setPauser

- **Effects**:
  - allows admin to set a new pauser
- **Permissions**:
  - reverts when not called by admin
- **Validations**:
  - reverts when setting to zero address
- **Events**:
  - emits a RoleTransferred event when pauser is changed

## Contract: ProtocolEASResolver

### Write Methods

#### setAttesterWallet

- **Effects**:
  - updates the attester wallet correctly
- **Permissions**:
  - allows authorized users
  - denies unauthorized users
- **Validations**:
  - reverts when input is invalid

#### rolloverAttesterWallet

- **Effects**:
  - updates the attester wallets correctly and sets the current attester as secondary attester
- **Permissions**:
  - allows authorized users
  - denies unauthorized users
- **Validations**:
  - reverts when input is invalid

#### transferAdmin

- **Effects**:
  - updates the admin correctly
- **Permissions**:
  - allows authorized users
  - denies unauthorized users
- **Validations**:
  - reverts when input is invalid

#### onAttest

- **Validations**:
  - allows the attester wallet to attest
  - prevents other wallets than the attester wallet from attesting

## Contract: ScoutProtocolNFTImplementation

### Write Methods

#### registerBuilderToken()

- **Effects**:
  - Register a new builder token using a builderId
- **Permissions**:
  - Normal users cannot register a builder token
  - Minter can register a builder token
- **Validations**:
  - Revert if the builderId is already registered
  - Revert if the builderId is empty
  - Revert if the builderId is an invalid uuid
- **Events**:
  - Emits DevTokenRegistered event new tokenId and builderId

#### rolloverMinterWallet()

- **Effects**:
  - Updates minter and secondary minter roles
- **Permissions**:
  - Can only be called by the admin
- **Validations**:
  - Rejects zero address as new minter
- **Events**:
  - Emits RoleTransferred event

#### mint()

- **Effects**:
  - Mints tokens to a user account
  - Mints tokens to a different address than the one paying for the transfer
  - Increments total supply of the token
  - Forwards 20% of the $DEV to the builder, and the remaining 80% to the proceeds receiver
- **Permissions**:
  - Allows any user to mint tokens if they pay the price
  - Cannot mint when contract is paused
- **Validations**:
  - Reverts if tokenId is not registered
- **Events**:
  - Emits TransferSingle event on mint

#### burn()

- **Effects**:
  - Burns tokens from a user account
  - Decrements total supply of the token
- **Permissions**:
  - Allows token owner to burn tokens
  - Allows approved operator to burn tokens
  - Prevents burning tokens if not owner nor approved
- **Validations**:
  - Reverts if burning more tokens than balance
- **Events**:
  - Emits TransferSingle event on burn

#### setApprovalForAll()

- **Effects**:
  - Sets operator approval for the caller
- **Permissions**:
  - Allows any user to set operator approval
- **Validations**:
  - Reverts if setting approval for self
- **Events**:
  - Emits ApprovalForAll event

#### safeTransferFrom()

- **Effects**:
  - Transfers tokens from one account to another
- **Permissions**:
  - Allows token owner to transfer tokens
  - Allows approved operator to transfer tokens
  - Prevents transferring tokens if not owner nor approved
- **Validations**:
  - Reverts if caller is not owner nor approved
  - Reverts if transferring more tokens than balance
- **Events**:
  - Emits TransferSingle event on transfer

#### safeBatchTransferFrom()

- **Effects**:
  - Transfers multiple tokens from one account to another
- **Permissions**:
  - Allows token owner to transfer tokens
  - Allows approved operator to transfer tokens
  - Prevents transferring tokens if not owner nor approved
- **Validations**:
  - Reverts if transferring more tokens than balance
- **Events**:
  - Emits TransferBatch event on transfer

#### setBaseUri()

- **Effects**:
  - Updates the base URI when called with a valid newBaseUri
- **Permissions**:
  - Only admin can set the base URI

#### updateBuilderTokenAddress()

- **Effects**:
  - Updates the builder address for a token
- **Permissions**:
  - Allows current builder to update their address
  - Allows admin to update builder address
  - Reverts if caller is not admin or current builder
- **Validations**:
  - Reverts if new address is zero address
  - Reverts if token is not yet allocated

### Read Methods

#### balanceOf()

- **Returns**:
  - Returns the correct balance of tokens for an account and tokenId
  - Returns zero for accounts with no tokens

#### balanceOfBatch()

- **Returns**:
  - Returns correct balances for multiple accounts and tokenIds
  - Returns zeros for accounts with no tokens

#### ERC20Token()

- **Returns**:
  - Returns the address of USDC contract

#### getTokenPurchasePrice()

- **Returns**:
  - Returns the correct price for purchasing a given amount of tokens, taking into account current supply and bonding curve formula of 2S + 2

#### totalSupply()

- **Returns**:
  - Returns the total supply of a given tokenId
  - Returns zero for tokens with no supply

#### getBuilderIdForToken()

- **Returns**:
  - Returns the correct builderId for a given tokenId
  - Reverts if the tokenId is not registered

#### getTokenIdForBuilder()

- **Returns**:
  - Returns the correct tokenId for a given builderId
  - Reverts if the builderId is not registered

#### totalBuilderTokens()

- **Returns**:
  - Returns the total number of registered builder tokens

#### getPriceIncrement()

- **Returns**:
  - Returns the price increment used for calculating token prices

#### uri()

- **Returns**:
  - Returns the correct URI for a given tokenId

#### tokenURI()

- **Returns**:
  - Returns the correct token URI for a given tokenId

#### minter()

- **Returns**:
  - Should return the correct minter address

#### acceptUpgrade()

- **Returns**:
  - returns its own address

#### supportsInterface()

- **Returns**:
  - Returns true for IERC1155 and IERC1155MetadataURI
  - Returns false for ERC20 and ERC721 interfaces

## Contract: ScoutProtocolNFTProxy

### Write Methods

#### setImplementation()

- **Effects**:
  - Updates the implementation address correctly
- **Permissions**:
  - Allows admin to set implementation
  - Prevents non-admin from setting implementation
- **Validations**:
  - Reverts if new implementation address is zero address
  - Reverts if new implementation address is an EOA wallet
  - Reverts if new implementation address does not accept the upgrade
  - Reverts if new implementation address is the same as current

### Read Methods

#### implementation()

- **Returns**:
  - Returns the current implementation address

## Contract: ScoutProtocolImplementation

### Write Methods

#### multiClaim

- **Effects**:
  - allows a user to perform multiple claims in a single call
  - does not have any effect if a single claim is invalid
- **Events**:
  - emits a TokensClaimed event for each claim

#### claim

- **Effects**:
  - allows a user to claim tokens correctly
- **Permissions**:
  - reverts when the contract is paused
- **Validations**:
  - denies claims if user has already claimed
  - denies claims if user is at a time too far in the future
  - reverts with invalid merkle proof
  - reverts when merkle root is not set
  - reverts when contract balance is insufficient
- **Events**:
  - emits a TokensClaimed event

#### setWeeklyMerkleRoot

- **Effects**:
  - allows admin to set merkle root correctly
  - sets the merkle root with a unique key
- **Permissions**:
  - reverts when the contract is paused
  - reverts when not called by admin
  - allows the claims manager to set the merkle root
- **Validations**:
  - reverts when the validUntil is in the past
- **Events**:
  - emits a WeeklyMerkleRootSet event

#### setClaimsManager()

- **Effects**:
  - Sets the claims manager
- **Permissions**:
  - reverts when not called by admin

## Contract: ScoutProtocolProxy

### Write Methods

#### setImplementation()

- **Effects**:
  - Updates the implementation address correctly
- **Permissions**:
  - Allows admin to set implementation
  - Prevents non-admin from setting implementation
- **Validations**:
  - Reverts if new implementation address is zero address
  - Reverts if new implementation address is an EOA wallet
  - Reverts if new implementation address cannot accept the upgrade
  - Reverts if new implementation address is the same as current

## Contract: ScoutTokenERC20Implementation

### Write Methods

#### transfer

- **Effects**:
  - transfers tokens correctly
- **Permissions**:
  - allows token holders to transfer their tokens
- **Validations**:
  - prevents transferring more tokens than balance
- **Events**:
  - emits Transfer event on transfer

#### approve

- **Effects**:
  - approves allowance correctly
- **Events**:
  - emits Approval event on approve

#### transferFrom

- **Effects**:
  - transfers tokens correctly using allowance
- **Permissions**:
  - allows spender to transfer within allowance
  - prevents spender from transferring more than allowance
  - prevents spender from transferring more than balance
- **Events**:
  - emits Transfer event on transferFrom

#### increaseAllowance

- **Effects**:
  - increases allowance correctly
- **Events**:
  - emits Approval event on increaseAllowance

#### decreaseAllowance

- **Effects**:
  - decreases allowance correctly
- **Validations**:
  - reverts when decreasing allowance below zero

## Contract: ScoutTokenERC20Proxy

### Write Methods

#### setImplementation()

- **Effects**:
  - updates the implementation address correctly, preserving balances and initialized state
- **Permissions**:
  - prevents non-admin from setting the implementation
