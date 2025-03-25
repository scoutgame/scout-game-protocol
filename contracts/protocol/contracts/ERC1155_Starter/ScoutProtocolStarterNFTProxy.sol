// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libs/MemoryUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libs/ScoutProtocolAccessControl.sol";

contract ScoutProtocolStarterNFTProxy is ScoutProtocolAccessControl {
    using MemoryUtils for bytes32;

    constructor(
        address implementationAddress,
        address paymentTokenAddress,
        address _proceedsReceiver,
        string memory _tokenName,
        string memory _tokenSymbol
    ) {
        require(
            implementationAddress != address(0),
            "Invalid implementation address"
        );
        require(
            paymentTokenAddress != address(0),
            "Invalid payment token address"
        );
        MemoryUtils._setAddress(MemoryUtils.ADMIN_SLOT, _msgSender());
        MemoryUtils._setAddress(
            MemoryUtils.IMPLEMENTATION_SLOT,
            implementationAddress
        );
        MemoryUtils._setAddress(
            MemoryUtils.CLAIMS_TOKEN_SLOT,
            paymentTokenAddress
        );
        MemoryUtils._setAddress(
            MemoryUtils.PROCEEDS_RECEIVER_SLOT,
            _proceedsReceiver
        );

        MemoryUtils._setUint256(MemoryUtils.PRICE_INCREMENT_SLOT, 2000000);

        MemoryUtils._setString(MemoryUtils.TOKEN_NAME, _tokenName);
        MemoryUtils._setString(MemoryUtils.TOKEN_SYMBOL, _tokenSymbol);
    }

    // External wrapper for setting implementation
    function setImplementation(address newImplementation) external onlyAdmin {
        _setImplementation(newImplementation);
    }

    // Internal function for setting implementation
    function _setImplementation(address newImplementation) internal {
        require(
            newImplementation != address(0),
            "Invalid implementation address"
        );
        MemoryUtils._setAddress(
            MemoryUtils.IMPLEMENTATION_SLOT,
            newImplementation
        );
    }

    // External wrapper for getting implementation address
    function implementation() external view returns (address) {
        return _implementation();
    }

    // Internal function for getting implementation address
    function _implementation() internal view returns (address) {
        return MemoryUtils._getAddress(MemoryUtils.IMPLEMENTATION_SLOT);
    }

    // Helper function to extract revert message from delegatecall
    function _getRevertMsg(
        bytes memory _returnData
    ) internal pure returns (string memory) {
        if (_returnData.length < 68) return "Transaction reverted silently";
        assembly {
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }

    fallback() external payable {
        address impl = MemoryUtils._getAddress(MemoryUtils.IMPLEMENTATION_SLOT);
        require(impl != address(0), "Implementation not set");

        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
