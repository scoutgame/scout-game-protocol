// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libs/MemoryUtils.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libs/ScoutProtocolAccessControl.sol";
import "../../libs/StringUtils.sol";

library ImplementationStorage {
    struct Layout {
        mapping(uint256 => mapping(address => uint256)) balances;
        mapping(string => uint256) totalMinted;
        mapping(uint256 => uint256) totalSupply;
        mapping(uint256 => string) tokenToBuilderRegistry;
        mapping(string => uint256) builderToTokenRegistry;
        mapping(uint256 => address) tokenToAddressRegistry;
        string baseUri;
        string uriPrefix;
        string uriSuffix;
        uint256 totalBuilders;
        mapping(uint256 => mapping(string => uint256)) scoutBalances;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("builderNFT.implementation.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract ScoutProtocolStarterNFTImplementation is
    Context,
    ERC165,
    IERC1155,
    IERC1155MetadataURI,
    ScoutProtocolAccessControl
{
    using MemoryUtils for bytes32;
    using Address for address;

    // Events
    event BuilderScouted(uint256 tokenId, uint256 amount, string scout);
    event TokenRegistered(uint256 tokenId, string builderId);
    event ERC20ContractUpdated(
        address indexed previousContract,
        address indexed newContract
    );
    event MinterSet(address indexed previousMinter, address indexed newMinter);
    event BuilderAddressUpdated(
        uint256 indexed tokenId,
        address indexed previousAddress,
        address indexed newAddress
    );
    event ProceedsReceiverSet(
        address indexed previousReceiver,
        address indexed newReceiver
    );
    event PriceIncrementUpdated(
        uint256 previousIncrement,
        uint256 newIncrement
    );

    modifier onlyAdminOrMinter() {
        require(
            _isAdmin() || _hasRole(MemoryUtils.MINTER_SLOT),
            "Caller is not the admin or minter"
        );
        _;
    }

    constructor() {}

    function setBaseUri(string memory newBaseUri) external onlyAdmin {
        _setBaseUri(newBaseUri);
    }

    function _setBaseUri(string memory newBaseUri) internal {
        require(bytes(newBaseUri).length > 0, "Empty base URI not allowed");
        ImplementationStorage.layout().baseUri = newBaseUri;
    }

    function registerBuilderToken(
        string calldata builderId,
        uint256 builderTokenId,
        address builderWallet
    ) external onlyAdminOrMinter {
        require(
            StringUtils._isValidUUID(builderId),
            "Builder ID must be a valid UUID"
        );
        require(
            ImplementationStorage.layout().builderToTokenRegistry[builderId] ==
                0,
            "Builder already registered"
        );
        require(builderTokenId > 0, "Builder token ID must be greater than 0");
        require(
            builderWallet != address(0),
            "Invalid builder wallet address, must be non empty address"
        );

        string memory builderTokenIdString = ImplementationStorage
            .layout()
            .tokenToBuilderRegistry[builderTokenId];

        require(
            bytes(builderTokenIdString).length == 0,
            "Builder token ID already registered"
        );

        // Update mappings in storage
        ImplementationStorage.layout().tokenToBuilderRegistry[
            builderTokenId
        ] = builderId;
        ImplementationStorage.layout().builderToTokenRegistry[
            builderId
        ] = builderTokenId;

        // Store the builder wallet address
        ImplementationStorage.layout().tokenToAddressRegistry[
            builderTokenId
        ] = builderWallet;

        // Emit TokenRegistered event
        emit TokenRegistered(builderTokenId, builderId);

        ImplementationStorage.layout().totalBuilders++;
    }

    function balanceOf(
        address account,
        uint256 id
    ) external view override returns (uint256) {
        return _balanceOf(account, id);
    }

    function balanceOfScout(
        string calldata scout,
        uint256 tokenId
    ) public view returns (uint256) {
        return ImplementationStorage.layout().scoutBalances[tokenId][scout];
    }

    function scoutHasMintedNft(
        address account,
        uint256 id
    ) internal view returns (bool) {
        return _balanceOf(account, id) > 0;
    }

    function totalMinted(string calldata scout) public view returns (uint256) {
        return ImplementationStorage.layout().totalMinted[scout];
    }

    function _incrementTotalMinted(
        string calldata scout,
        uint256 amount,
        uint256 tokenId
    ) internal {
        ImplementationStorage.layout().totalMinted[scout] += amount;
        ImplementationStorage.layout().scoutBalances[tokenId][scout] += amount;
    }

    function _decrementTotalMinted(
        string calldata scout,
        uint256 amount,
        uint256 tokenId
    ) internal {
        uint256 alreadyMinted = totalMinted(scout);
        require(
            alreadyMinted >= amount,
            "Amount to burn exceeds already minted amount"
        );
        ImplementationStorage.layout().totalMinted[scout] -= amount;
        ImplementationStorage.layout().scoutBalances[tokenId][scout] -= amount;
    }

    function _balanceOf(
        address account,
        uint256 id
    ) internal view returns (uint256) {
        require(
            account != address(0),
            "ERC1155: balance query for the zero address"
        );
        return ImplementationStorage.layout().balances[id][account];
    }

    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    ) external view override returns (uint256[] memory) {
        return _balanceOfBatch(accounts, ids);
    }

    function _balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    ) internal view returns (uint256[] memory) {
        require(
            accounts.length == ids.length,
            "ERC1155: accounts and ids length mismatch"
        );
        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = _balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    function setApprovalForAll(address, bool) external pure override {
        revert("Approval not allowed for soulbound tokens");
    }

    function isApprovedForAll(
        address,
        address
    ) external pure override returns (bool) {
        return false; // Approvals are not allowed for soulbound tokens
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) external pure override {
        revert("Transfers not allowed for soulbound tokens");
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) external pure override {
        revert("Batch transfers not allowed for soulbound tokens");
    }

    function mint(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata scout
    ) external {
        _validateMint(account, tokenId, amount, scout);

        uint256 price = getTokenPurchasePrice(amount);
        address paymentToken = MemoryUtils._getAddress(
            MemoryUtils.CLAIMS_TOKEN_SLOT
        );
        address proceedsReceiver = MemoryUtils._getAddress(
            MemoryUtils.PROCEEDS_RECEIVER_SLOT
        );

        require(paymentToken != address(0), "Payment token not set");
        require(proceedsReceiver != address(0), "Proceeds receiver not set");

        forwardProceeds(tokenId, price);

        _mintTo(account, tokenId, amount, scout);
    }

    function forwardProceeds(uint256 tokenId, uint256 cost) internal {
        address _paymentToken = _getERC20Contract();

        // Transfer builder rewards to builder ----------------------------
        address _builderAddress = ImplementationStorage
            .layout()
            .tokenToAddressRegistry[tokenId];

        require(
            _builderAddress != address(0),
            "Builder does not have an address to forward proceeds to"
        );

        // Builder rewards are 20% of the purchase price
        uint256 _builderRewards = (cost * 2) / 10;

        uint256 _builderAddressBalance = IERC20(_paymentToken).balanceOf(
            _builderAddress
        );

        bool _transferSuccess = IERC20(_paymentToken).transferFrom(
            _msgSender(),
            _builderAddress,
            _builderRewards
        );

        require(_transferSuccess, "Builder transfer failed");

        uint256 _builderAddressBalanceAfterTransfer = IERC20(_paymentToken)
            .balanceOf(_builderAddress);

        require(
            _builderAddressBalanceAfterTransfer ==
                _builderAddressBalance + _builderRewards,
            "Builder transfer failed"
        );

        // Forward remaining 80% to proceeds receiver ---------------------
        address _proceedsReceiver = _getProceedsReceiver();

        uint256 _proceedsReceiverBalance = IERC20(_paymentToken).balanceOf(
            _proceedsReceiver
        );

        // Forward remaining 80% to proceeds receiver
        uint256 _proceedsReceiverAmount = cost - _builderRewards;

        // Transfer payment from user to proceeds receiver
        IERC20(_paymentToken).transferFrom(
            _msgSender(),
            _proceedsReceiver,
            _proceedsReceiverAmount
        );

        uint256 _proceedsReceiverBalanceAfterTransfer = IERC20(_paymentToken)
            .balanceOf(_proceedsReceiver);

        require(
            _proceedsReceiverBalanceAfterTransfer ==
                _proceedsReceiverBalance + _proceedsReceiverAmount,
            "Transfer failed"
        );
    }

    function burn(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata scout
    ) external onlyAdmin {
        ImplementationStorage.Layout storage s = ImplementationStorage.layout();

        // Check that the account has enough tokens to burn
        require(
            s.balances[tokenId][account] >= amount,
            "ERC1155: burn amount exceeds balance"
        );

        // Subtract the amount from the account's balance
        s.balances[tokenId][account] -= amount;

        // Decrease the total supply of the token
        s.totalSupply[tokenId] -= amount;

        // Decrease the total minted amount for the scout
        _decrementTotalMinted(scout, amount, tokenId);

        // Emit TransferSingle event with the burn details
        emit TransferSingle(msg.sender, account, address(0), tokenId, amount);
    }

    function setMinter(address minter) external onlyAdmin {
        require(minter != address(0), "Invalid address");
        address previousMinter = MemoryUtils._getAddress(
            MemoryUtils.MINTER_SLOT
        );
        MemoryUtils._setAddress(MemoryUtils.MINTER_SLOT, minter);
        emit MinterSet(previousMinter, minter);
    }

    function getMinter() external view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.MINTER_SLOT);
    }

    function mintTo(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata scout
    ) external onlyAdminOrMinter {
        _validateMint(account, tokenId, amount, scout);
        _mintTo(account, tokenId, amount, scout);
    }

    function _mintTo(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata scout
    ) internal {
        ImplementationStorage.Layout storage s = ImplementationStorage.layout();

        // Mint tokens
        s.balances[tokenId][account] += amount;

        // Update total supply
        s.totalSupply[tokenId] += amount;

        _incrementTotalMinted(scout, amount, tokenId);

        // Emit TransferSingle event
        emit TransferSingle(msg.sender, address(0), account, tokenId, amount);

        // Emit BuilderScouted event
        emit BuilderScouted(tokenId, amount, scout);
    }

    function _validateMint(
        address account,
        uint256 tokenId,
        uint256 amount,
        string calldata scout
    ) internal view {
        require(StringUtils._isValidUUID(scout), "Scout must be a valid UUID");
        require(amount == 1, "Can only mint 1 token per builder and scout");
        require(
            balanceOfScout(scout, tokenId) == 0,
            "Scout already minted this NFT"
        );
        require(account != address(0), "Invalid account address");

        _getBuilderIdForToken(tokenId);
    }

    function updateERC20Contract(address newContract) external onlyAdmin {
        require(newContract != address(0), "Invalid address");
        address previousContract = MemoryUtils._getAddress(
            MemoryUtils.CLAIMS_TOKEN_SLOT
        );
        MemoryUtils._setAddress(MemoryUtils.CLAIMS_TOKEN_SLOT, newContract);
        emit ERC20ContractUpdated(previousContract, newContract);
    }

    function getERC20Contract() external view returns (address) {
        return _getERC20Contract();
    }

    function _getERC20Contract() internal view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.CLAIMS_TOKEN_SLOT);
    }

    function getTokenPurchasePrice(
        uint256 amount
    ) public view returns (uint256) {
        uint256 priceIncrement = MemoryUtils._getUint256(
            MemoryUtils.PRICE_INCREMENT_SLOT
        );

        return amount * priceIncrement;
    }

    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return _totalSupply(tokenId);
    }

    function _totalSupply(uint256 tokenId) internal view returns (uint256) {
        return ImplementationStorage.layout().totalSupply[tokenId];
    }

    function getBuilderIdForToken(
        uint256 tokenId
    ) external view returns (string memory) {
        return _getBuilderIdForToken(tokenId);
    }

    function _getBuilderIdForToken(
        uint256 tokenId
    ) internal view returns (string memory) {
        string memory builderId = ImplementationStorage
            .layout()
            .tokenToBuilderRegistry[tokenId];
        require(bytes(builderId).length > 0, "Token not yet allocated");
        return builderId;
    }

    function getTokenIdForBuilder(
        string calldata builderId
    ) external view returns (uint256) {
        return _getTokenIdForBuilder(builderId);
    }

    function _getTokenIdForBuilder(
        string calldata builderId
    ) internal view returns (uint256) {
        uint256 tokenId = ImplementationStorage.layout().builderToTokenRegistry[
            builderId
        ];
        require(tokenId != 0, "Builder not registered");
        return tokenId;
    }

    function totalBuilderTokens() external view returns (uint256) {
        return _totalBuilderTokens();
    }

    function _totalBuilderTokens() internal view returns (uint256) {
        uint256 total = ImplementationStorage.layout().totalBuilders;
        return total;
    }

    function setUriPrefixAndSuffix(
        string memory newPrefix,
        string memory newSuffix
    ) external onlyAdmin {
        _setUriPrefixAndSuffix(newPrefix, newSuffix);
    }

    function _setUriPrefixAndSuffix(
        string memory newPrefix,
        string memory newSuffix
    ) internal {
        _setUriPrefix(newPrefix);
        _setUriSuffix(newSuffix);
    }

    function setUriPrefix(string memory newPrefix) external onlyAdmin {
        _setUriPrefix(newPrefix);
    }

    function _setUriPrefix(string memory newPrefix) internal {
        require(bytes(newPrefix).length > 0, "Empty URI prefix not allowed");
        ImplementationStorage.layout().uriPrefix = newPrefix;
    }

    function setUriSuffix(string memory newSuffix) external onlyAdmin {
        _setUriSuffix(newSuffix);
    }

    function _setUriSuffix(string memory newSuffix) internal {
        ImplementationStorage.layout().uriSuffix = newSuffix;
    }

    function getUriPrefix() external view returns (string memory) {
        return _getUriPrefix();
    }

    function _getUriPrefix() internal view returns (string memory) {
        return ImplementationStorage.layout().uriPrefix;
    }

    function getUriSuffix() external view returns (string memory) {
        return _getUriSuffix();
    }

    function _getUriSuffix() internal view returns (string memory) {
        return ImplementationStorage.layout().uriSuffix;
    }

    function uri(
        uint256 _tokenId
    ) external view override returns (string memory) {
        return _tokenURI(_tokenId);
    }

    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        return _tokenURI(_tokenId);
    }

    function _tokenURI(uint256 _tokenId) internal view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    _getUriPrefix(),
                    "/",
                    StringUtils._uint2str(_tokenId),
                    "/",
                    _getUriSuffix()
                )
            );
    }

    function isValidUUID(string memory uuid) external pure returns (bool) {
        return StringUtils._isValidUUID(uuid);
    }

    function name() external view returns (string memory) {
        return MemoryUtils._getString(MemoryUtils.TOKEN_NAME);
    }

    function symbol() external view returns (string memory) {
        return MemoryUtils._getString(MemoryUtils.TOKEN_SYMBOL);
    }

    function setProceedsReceiver(address receiver) external onlyAdmin {
        require(receiver != address(0), "Invalid address");
        address previousReceiver = _getProceedsReceiver();
        MemoryUtils._setAddress(MemoryUtils.PROCEEDS_RECEIVER_SLOT, receiver);
        emit ProceedsReceiverSet(previousReceiver, receiver);
    }

    function getProceedsReceiver() external view returns (address) {
        return _getProceedsReceiver();
    }

    function _getProceedsReceiver() internal view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.PROCEEDS_RECEIVER_SLOT);
    }

    function updatePriceIncrement(uint256 newIncrement) external onlyAdmin {
        uint256 previousIncrement = MemoryUtils._getUint256(
            MemoryUtils.PRICE_INCREMENT_SLOT
        );
        MemoryUtils._setUint256(MemoryUtils.PRICE_INCREMENT_SLOT, newIncrement);
        emit PriceIncrementUpdated(previousIncrement, newIncrement);
    }

    function getPriceIncrement() public view returns (uint256) {
        return MemoryUtils._getUint256(MemoryUtils.PRICE_INCREMENT_SLOT);
    }

    function getBuilderAddressForToken(
        uint256 tokenId
    ) external view returns (address) {
        return ImplementationStorage.layout().tokenToAddressRegistry[tokenId];
    }

    function updateBuilderTokenAddress(
        uint256 tokenId,
        address newAddress
    ) external {
        address currentBuilderAddress = ImplementationStorage
            .layout()
            .tokenToAddressRegistry[tokenId];

        require(
            _isAdmin() || currentBuilderAddress == _msgSender(),
            "Caller is not admin or builder"
        );

        require(newAddress != address(0), "Invalid address");

        string memory builderId = ImplementationStorage
            .layout()
            .tokenToBuilderRegistry[tokenId];
        require(bytes(builderId).length > 0, "Token not yet allocated");

        // Update the builder address
        ImplementationStorage.layout().tokenToAddressRegistry[
            tokenId
        ] = newAddress;

        emit BuilderAddressUpdated(tokenId, currentBuilderAddress, newAddress);
    }
}
