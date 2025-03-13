// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../../SeasonOne/libs/MemoryUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ScoutProtocolBuilderStarterPackNFTUpgradeable {
    using MemoryUtils for bytes32;

    // Modifier to restrict access to admin functions
    modifier onlyAdmin() {
        require(
            MemoryUtils.isAdmin(msg.sender),
            "Proxy: caller is not the admin"
        );
        _;
    }

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
        MemoryUtils.setAddress(MemoryUtils.ADMIN_SLOT, msg.sender);
        MemoryUtils.setAddress(
            MemoryUtils.IMPLEMENTATION_SLOT,
            implementationAddress
        );
        MemoryUtils.setAddress(
            MemoryUtils.PAYMENT_ERC20_TOKEN_SLOT,
            paymentTokenAddress
        );
        MemoryUtils.setAddress(
            MemoryUtils.PROCEEDS_RECEIVER_SLOT,
            _proceedsReceiver
        );

        MemoryUtils.setUint256(MemoryUtils.PRICE_INCREMENT_SLOT, 2000000);

        MemoryUtils.setString(MemoryUtils.TOKEN_NAME, _tokenName);
        MemoryUtils.setString(MemoryUtils.TOKEN_SYMBOL, _tokenSymbol);

        // Init logic
        MemoryUtils.setUint256(MemoryUtils.NEXT_TOKEN_ID_SLOT, 1);
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
        MemoryUtils.setAddress(
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
        return MemoryUtils.getAddress(MemoryUtils.IMPLEMENTATION_SLOT);
    }

    function transferAdmin(
        address _newAdmin
    ) external onlyAdmin returns (address) {
        require(_newAdmin != address(0), "Invalid address");
        MemoryUtils.setAddress(MemoryUtils.ADMIN_SLOT, _newAdmin);
        return _newAdmin;
    }

    function admin() external view returns (address) {
        return MemoryUtils.getAddress(MemoryUtils.ADMIN_SLOT);
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
        address impl = MemoryUtils.getAddress(MemoryUtils.IMPLEMENTATION_SLOT);
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
