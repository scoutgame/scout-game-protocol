// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library BuilderNFTStorage {
    struct Layout {
        mapping(uint256 => mapping(address => uint256)) balances;
        mapping(uint256 => uint256) totalSupply;
        mapping(uint256 => string) tokenToBuilderRegistry;
        mapping(string => uint256) builderToTokenRegistry;
        // Mapping from account to operator approvals
        mapping(address => mapping(address => bool)) _operatorApprovals;
        uint256 nextTokenId;
        string uriPrefix;
        string uriSuffix;
    }

    bytes32 internal constant STORAGE_SLOT = keccak256("builderNFT.storage");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function setUriPrefix(string memory _uriPrefix) internal {
        layout().uriPrefix = _uriPrefix;
    }

    function getUriPrefix() internal view returns (string memory) {
        return layout().uriPrefix;
    }

    function setUriSuffix(string memory _uriSuffix) internal {
        layout().uriSuffix = _uriSuffix;
    }

    function getUriSuffix() internal view returns (string memory) {
        return layout().uriSuffix;
    }

    function setTokenToBuilderRegistry(
        uint256 tokenId,
        string memory builder
    ) internal {
        layout().tokenToBuilderRegistry[tokenId] = builder;
    }

    function getTokenToBuilderRegistry(
        uint256 tokenId
    ) internal view returns (string memory) {
        string memory _builderId = layout().tokenToBuilderRegistry[tokenId];

        if (bytes(_builderId).length == 0) {
            revert("Token id not found");
        }

        return _builderId;
    }

    function setBuilderToTokenRegistry(
        string memory builder,
        uint256 tokenId
    ) internal {
        layout().builderToTokenRegistry[builder] = tokenId;
    }

    function getBuilderToTokenRegistry(
        string memory builder
    ) internal view returns (uint256) {
        uint256 _tokenId = layout().builderToTokenRegistry[builder];

        if (_tokenId == 0) {
            revert("Builder not found");
        }

        return _tokenId;
    }

    function incrementNextTokenId() internal {
        layout().nextTokenId += 1;
    }

    function getNextTokenId() internal view returns (uint256) {
        return layout().nextTokenId;
    }

    function increaseTotalSupply(uint256 tokenId, uint256 _amount) internal {
        layout().totalSupply[tokenId] += _amount;
    }

    function decreaseTotalSupply(uint256 tokenId, uint256 _amount) internal {
        layout().totalSupply[tokenId] -= _amount;
    }

    function getTotalSupply(uint256 tokenId) internal view returns (uint256) {
        return layout().totalSupply[tokenId];
    }

    function increaseBalance(
        address account,
        uint256 tokenId,
        uint256 amount
    ) internal {
        layout().balances[tokenId][account] += amount;
        increaseTotalSupply(tokenId, amount);
    }

    function decreaseBalance(
        address account,
        uint256 tokenId,
        uint256 amount
    ) internal {
        uint256 _balance = getBalance(account, tokenId);
        require(_balance >= amount, "Cannot decrease balance below 0");

        layout().balances[tokenId][account] += amount;
        decreaseTotalSupply(tokenId, amount);
    }

    function getBalance(
        address account,
        uint256 tokenId
    ) internal view returns (uint256) {
        return layout().balances[tokenId][account];
    }

    function isApprovedForAll(
        address account,
        address operator
    ) internal view returns (bool) {
        return layout()._operatorApprovals[account][operator];
    }

    function setApprovalForAll(
        address account,
        address operator,
        bool approved
    ) internal {
        layout()._operatorApprovals[account][operator] = approved;
    }
}
