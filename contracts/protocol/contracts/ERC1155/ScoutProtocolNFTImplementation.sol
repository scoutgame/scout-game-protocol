// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libs/MemoryUtils.sol";
import "../../libs/ScoutProtocolAccessControl.sol";
import "./libs/ScoutProtocolNFTStorage.sol";
import "../../libs/StringUtils.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ScoutProtocolNFTImplementation is
    Context,
    ERC165,
    ScoutProtocolAccessControl,
    IERC1155,
    IERC1155MetadataURI
{
    using MemoryUtils for bytes32;
    using ScoutProtocolNFTStorage for bytes32;
    using StringUtils for string;
    using Address for address;

    // Events
    event TokenRegistered(uint256 tokenId, string builderId);
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
    event MaxSupplyPerTokenSet(uint256 previousMaxSupply, uint256 newMaxSupply);

    modifier onlyAdminOrMinter() {
        require(
            _isAdmin() || _hasRole(MemoryUtils.MINTER_SLOT),
            "Caller is not the admin or minter"
        );
        _;
    }

    constructor() {}

    // ERC1155 methods grouped together
    function balanceOf(
        address account,
        uint256 tokenId
    ) public view override returns (uint256) {
        require(
            account != address(0),
            "ERC1155: balance query for the zero address"
        );
        return ScoutProtocolNFTStorage.getBalance(account, tokenId);
    }

    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory tokenIds
    ) external view override returns (uint256[] memory) {
        require(
            accounts.length == tokenIds.length,
            "ERC1155: accounts and ids length mismatch"
        );
        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], tokenIds[i]);
        }

        return batchBalances;
    }

    function setApprovalForAll(
        address operator,
        bool approved
    ) external override {
        require(
            operator != _msgSender(),
            "ERC1155: setting approval status for self"
        );

        ScoutProtocolNFTStorage.setApprovalForAll(
            _msgSender(),
            operator,
            approved
        );

        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(
        address account,
        address operator
    ) public view override returns (bool) {
        return ScoutProtocolNFTStorage.isApprovedForAll(account, operator);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external override onlyWhenNotPaused {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );
        require(to != address(0), "ERC1155: transfer to the zero address");

        uint256 fromBalance = ScoutProtocolNFTStorage.getBalance(from, tokenId);
        require(
            fromBalance >= amount,
            "ERC1155: insufficient balance for transfer"
        );

        ScoutProtocolNFTStorage.decreaseBalance(from, tokenId, amount);
        ScoutProtocolNFTStorage.increaseBalance(to, tokenId, amount);

        emit TransferSingle(_msgSender(), from, to, tokenId, amount);

        _doSafeTransferAcceptanceCheck(
            _msgSender(),
            from,
            to,
            tokenId,
            amount,
            data
        );
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        bytes memory data
    ) external override onlyWhenNotPaused {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            tokenIds.length == amounts.length,
            "ERC1155: ids and amounts length mismatch"
        );

        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            uint256 amount = amounts[i];

            uint256 fromBalance = ScoutProtocolNFTStorage.getBalance(from, id);
            require(
                fromBalance >= amount,
                "ERC1155: insufficient balance for transfer"
            );

            ScoutProtocolNFTStorage.decreaseBalance(from, id, amount);
            ScoutProtocolNFTStorage.increaseBalance(to, id, amount);
        }

        emit TransferBatch(_msgSender(), from, to, tokenIds, amounts);

        _doSafeBatchTransferAcceptanceCheck(
            _msgSender(),
            from,
            to,
            tokenIds,
            amounts,
            data
        );
    }

    function uri(
        uint256 _tokenId
    ) external view override returns (string memory) {
        return _tokenURI(_tokenId);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) private {
        if (MemoryUtils._isContract(to)) {
            try
                IERC1155Receiver(to).onERC1155Received(
                    operator,
                    from,
                    tokenId,
                    amount,
                    data
                )
            returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (MemoryUtils._isContract(to)) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(
                    operator,
                    from,
                    tokenIds,
                    amounts,
                    data
                )
            returns (bytes4 response) {
                if (
                    response != IERC1155Receiver.onERC1155BatchReceived.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    // Implement ERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public pure override(ERC165, IERC165) returns (bool) {
        if (
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId
        ) {
            return true;
        }
        return false;
    }

    // Rest of the contract methods
    function setBaseUri(
        string memory _prefix,
        string memory _suffix
    ) external onlyAdminOrMinter {
        require(bytes(_prefix).length > 0, "Empty base URI prefix not allowed");
        require(bytes(_suffix).length > 0, "Empty base URI suffix not allowed");
        ScoutProtocolNFTStorage.setUriPrefix(_prefix);
        ScoutProtocolNFTStorage.setUriSuffix(_suffix);
    }

    function registerBuilderToken(
        string calldata builderId,
        address account
    ) external onlyAdminOrMinter {
        require(
            StringUtils._isValidUUID(builderId),
            "Builder ID must be a valid UUID"
        );
        require(
            ScoutProtocolNFTStorage.getBuilderToTokenRegistry(builderId) == 0,
            "Builder already registered"
        );

        require(
            account != address(0),
            "Invalid account address, must be non empty address"
        );

        require(
            ScoutProtocolNFTStorage.getAddressToTokenRegistry(account) == 0,
            "Account already linked to a builder"
        );

        uint256 _nextTokenId = ScoutProtocolNFTStorage.getNextTokenId();

        // Update mappings in storage
        ScoutProtocolNFTStorage.setBuilderToTokenRegistry(
            builderId,
            _nextTokenId
        );
        ScoutProtocolNFTStorage.setTokenToBuilderRegistry(
            _nextTokenId,
            builderId
        );

        _updateBuilderTokenAddress(_nextTokenId, account);

        // Emit TokenRegistered event
        emit TokenRegistered(_nextTokenId, builderId);

        // Increment the next token ID
        ScoutProtocolNFTStorage.incrementNextTokenId();
    }

    function mint(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external onlyWhenNotPaused {
        _validateMint(account, tokenId, amount);

        uint256 _price = getTokenPurchasePrice(tokenId, amount);
        address _paymentToken = MemoryUtils._getAddress(
            MemoryUtils.CLAIMS_TOKEN_SLOT
        );

        require(_paymentToken != address(0), "Payment token not set");
        require(proceedsReceiver() != address(0), "Proceeds receiver not set");

        forwardProceeds(tokenId, _price);

        _mintTo(account, tokenId, amount);
    }

    function forwardProceeds(uint256 tokenId, uint256 cost) internal {
        address _paymentToken = ERC20Token();

        // Transfer builder rewards to builder ----------------------------
        address _builderAddress = ScoutProtocolNFTStorage
            .getTokenToAddressRegistry(tokenId);

        require(
            _builderAddress != address(0),
            "Builder does not have an address to forward proceeds to"
        );

        // Builder rewards are 20% of the purchase price
        uint256 _builderRewards = (cost * 2) / 10;

        uint256 _builderAddressBalance = IERC20(_paymentToken).balanceOf(
            _builderAddress
        );

        bool _transferToBuilderSuccess = IERC20(_paymentToken).transferFrom(
            _msgSender(),
            _builderAddress,
            _builderRewards
        );

        require(_transferToBuilderSuccess, "Builder transfer failed");

        uint256 _builderAddressBalanceAfterTransfer = IERC20(_paymentToken)
            .balanceOf(_builderAddress);

        require(
            _builderAddressBalanceAfterTransfer ==
                _builderAddressBalance + _builderRewards,
            "Builder transfer failed"
        );

        // Forward remaining 80% to proceeds receiver ---------------------
        address _proceedsReceiver = proceedsReceiver();

        uint256 _proceedsReceiverBalance = IERC20(_paymentToken).balanceOf(
            _proceedsReceiver
        );

        // Forward remaining 80% to proceeds receiver
        uint256 _proceedsReceiverAmount = cost - _builderRewards;

        // Transfer payment from user to proceeds receiver
        bool _transferToProceedsSuccess = IERC20(_paymentToken).transferFrom(
            _msgSender(),
            _proceedsReceiver,
            _proceedsReceiverAmount
        );

        require(
            _transferToProceedsSuccess,
            "Transfer to proceeds receiver failed"
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
        uint256 amount
    ) external onlyWhenNotPaused {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );
        ScoutProtocolNFTStorage.decreaseBalance(account, tokenId, amount);
        // Emit TransferSingle event with the burn details
        emit TransferSingle(_msgSender(), account, address(0), tokenId, amount);
    }

    function setMinter(address _minter) external onlyAdmin {
        require(_minter != address(0), "Invalid address");
        address previousMinter = MemoryUtils._getAddress(
            MemoryUtils.MINTER_SLOT
        );
        _setRole(MemoryUtils.MINTER_SLOT, _minter);
        emit MinterSet(previousMinter, _minter);
    }

    function minter() public view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.MINTER_SLOT);
    }

    function mintTo(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external onlyAdminOrMinter {
        _validateMint(account, tokenId, amount);
        _mintTo(account, tokenId, amount);
    }

    function _mintTo(
        address account,
        uint256 tokenId,
        uint256 amount
    ) internal {
        // Mint tokens
        ScoutProtocolNFTStorage.increaseBalance(account, tokenId, amount);

        // Emit TransferSingle event
        emit TransferSingle(_msgSender(), address(0), account, tokenId, amount);
    }

    function ERC20Token() public view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.CLAIMS_TOKEN_SLOT);
    }

    function getTokenPurchasePrice(
        uint256 tokenId,
        uint256 amount
    ) public view returns (uint256) {
        uint256 priceIncrement = MemoryUtils._getUint256(
            MemoryUtils.PRICE_INCREMENT_SLOT
        );
        uint256 currentSupply = totalSupply(tokenId);
        uint256 totalCost = 0;
        for (uint256 i = 0; i < amount; i++) {
            totalCost += (currentSupply + i + 1) * priceIncrement;
        }
        return totalCost;
    }

    function totalSupply(uint256 tokenId) public view returns (uint256) {
        return ScoutProtocolNFTStorage.getTotalSupply(tokenId);
    }

    function getBuilderIdForToken(
        uint256 tokenId
    ) public view returns (string memory) {
        string memory builderId = ScoutProtocolNFTStorage
            .getTokenToBuilderRegistry(tokenId);
        require(bytes(builderId).length > 0, "Token not yet allocated");
        return builderId;
    }

    function getTokenIdForBuilder(
        string calldata builderId
    ) external view returns (uint256) {
        uint256 tokenId = ScoutProtocolNFTStorage.getBuilderToTokenRegistry(
            builderId
        );
        require(tokenId != 0, "Builder not registered");
        return tokenId;
    }

    function getBuilderAddressForToken(
        uint256 tokenId
    ) public view returns (address) {
        return ScoutProtocolNFTStorage.getTokenToAddressRegistry(tokenId);
    }

    function updateBuilderTokenAddress(
        uint256 tokenId,
        address newAddress
    ) public {
        address _currentBuilderAddress = getBuilderAddressForToken(tokenId);

        require(
            _isAdmin() || _currentBuilderAddress == _msgSender(),
            "Caller is not admin or builder"
        );

        _updateBuilderTokenAddress(tokenId, newAddress);

        emit BuilderAddressUpdated(tokenId, _currentBuilderAddress, newAddress);
    }

    function _updateBuilderTokenAddress(
        uint256 tokenId,
        address newAddress
    ) internal {
        require(newAddress != address(0), "Invalid address");

        string memory builderId = ScoutProtocolNFTStorage
            .getTokenToBuilderRegistry(tokenId);
        require(bytes(builderId).length > 0, "Token not yet allocated");

        address _currentBuilderAddress = ScoutProtocolNFTStorage
            .getTokenToAddressRegistry(tokenId);

        ScoutProtocolNFTStorage.setTokenToAddressRegistry(tokenId, newAddress);

        ScoutProtocolNFTStorage.setAddressToTokenRegistry(newAddress, tokenId);

        // Remove old builder address from address to token registry
        ScoutProtocolNFTStorage.setAddressToTokenRegistry(
            _currentBuilderAddress,
            0
        );
    }

    function totalBuilderTokens() external view returns (uint256) {
        uint256 nextTokenId = ScoutProtocolNFTStorage.getNextTokenId();

        return nextTokenId - 1;
    }

    function getPriceIncrement() external view returns (uint256) {
        return MemoryUtils._getUint256(MemoryUtils.PRICE_INCREMENT_SLOT);
    }

    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        return _tokenURI(_tokenId);
    }

    function _tokenURI(uint256 _tokenId) internal view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    ScoutProtocolNFTStorage.getUriPrefix(),
                    "/",
                    StringUtils._uint2str(_tokenId),
                    "/",
                    ScoutProtocolNFTStorage.getUriSuffix()
                )
            );
    }

    function setProceedsReceiver(address receiver) external onlyAdmin {
        require(receiver != address(0), "Invalid address");
        address previousReceiver = MemoryUtils._getAddress(
            MemoryUtils.PROCEEDS_RECEIVER_SLOT
        );
        MemoryUtils._setAddress(MemoryUtils.PROCEEDS_RECEIVER_SLOT, receiver);
        emit ProceedsReceiverSet(previousReceiver, receiver);
    }

    function proceedsReceiver() public view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.PROCEEDS_RECEIVER_SLOT);
    }

    function name() external view returns (string memory) {
        return MemoryUtils._getString(MemoryUtils.TOKEN_NAME);
    }

    function symbol() external view returns (string memory) {
        return MemoryUtils._getString(MemoryUtils.TOKEN_SYMBOL);
    }

    function updatePriceIncrement(uint256 newIncrement) external onlyAdmin {
        uint256 previousIncrement = MemoryUtils._getUint256(
            MemoryUtils.PRICE_INCREMENT_SLOT
        );
        MemoryUtils._setUint256(MemoryUtils.PRICE_INCREMENT_SLOT, newIncrement);
        emit PriceIncrementUpdated(previousIncrement, newIncrement);
    }

    function acceptUpgrade() public view returns (address) {
        return address(this);
    }

    function setMaxSupplyPerToken(uint256 newMaxSupply) external onlyAdmin {
        require(newMaxSupply > 0, "Max supply must be greater than 0");

        uint256 previousMaxSupply = MemoryUtils._getUint256(
            ScoutProtocolNFTStorage.MAX_SUPPLY_SLOT
        );
        MemoryUtils._setUint256(
            ScoutProtocolNFTStorage.MAX_SUPPLY_SLOT,
            newMaxSupply
        );

        emit MaxSupplyPerTokenSet(previousMaxSupply, newMaxSupply);
    }

    function maxSupplyPerToken() public view returns (uint256) {
        return MemoryUtils._getUint256(ScoutProtocolNFTStorage.MAX_SUPPLY_SLOT);
    }

    function _validateMint(
        address account,
        uint256 tokenId,
        uint256 amount
    ) internal view {
        uint256 totalSupplyForTokenId = totalSupply(tokenId);

        require(
            totalSupplyForTokenId + amount <= maxSupplyPerToken(),
            "Token supply limit reached"
        );
        require(account != address(0), "Invalid account address");
        getBuilderIdForToken(tokenId);
    }
}
