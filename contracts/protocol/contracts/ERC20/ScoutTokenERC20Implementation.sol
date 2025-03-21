// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "../../libs/ScoutProtocolAccessControl.sol";
import "./IERC7802.sol";

contract ScoutTokenERC20Implementation is
    Context,
    ERC20,
    ScoutProtocolAccessControl,
    IERC7802
{
    uint256 public constant SUPPLY = 1e9 * 10 ** 18;

    modifier onlySuperchainBridgeOrMessenger() {
        require(
            _msgSender() == superchainBridge() || _msgSender() == l2Messenger(),
            "Must be superchain bridge or messenger to call this function"
        );
        _;
    }

    constructor() ERC20("Scout Protocol Token", "DEV") {}

    function isInitialized() public view returns (bool) {
        return MemoryUtils._getBool(MemoryUtils.INITIALIZED_SLOT);
    }

    function initialize() external onlyAdmin {
        require(!isInitialized(), "Already initialized");
        address _admin = MemoryUtils._getAddress(MemoryUtils.ADMIN_SLOT);
        _mint(_admin, SUPPLY);
        MemoryUtils._setBool(MemoryUtils.INITIALIZED_SLOT, true);
    }

    // Override ERC20 functions to have correct name and symbol
    function name() public pure override returns (string memory) {
        return "Scout Protocol Token";
    }

    function symbol() public pure override returns (string memory) {
        return "DEV";
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public returns (bool) {
        uint256 _currentAllowance = allowance(_msgSender(), spender);
        approve(spender, addedValue + _currentAllowance);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public returns (bool) {
        uint256 _currentAllowance = allowance(_msgSender(), spender);
        require(
            _currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        approve(spender, _currentAllowance - subtractedValue);
        return true;
    }

    // See example of crosschainMint and crosschainBurn in https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/L2/SuperchainERC20.sol
    function crosschainMint(
        address _account,
        uint256 _amount
    ) external onlySuperchainBridgeOrMessenger {
        _mint(_account, _amount);
        emit CrosschainMint(_account, _amount, _msgSender());
    }

    function crosschainBurn(
        address _from,
        uint256 _amount
    ) external onlySuperchainBridgeOrMessenger {
        _burn(_from, _amount);
        emit CrosschainBurn(_from, _amount, _msgSender());
    }

    function superchainBridge() public view returns (address) {
        return
            StorageSlot
                .getAddressSlot(MemoryUtils.SUPERCHAIN_BRIDGE_SLOT)
                .value;
    }

    function l2Messenger() public view returns (address) {
        return StorageSlot.getAddressSlot(MemoryUtils.L2_MESSENGER_SLOT).value;
    }

    function setSuperchainBridge(address _superchainBridge) external onlyAdmin {
        StorageSlot
            .getAddressSlot(MemoryUtils.SUPERCHAIN_BRIDGE_SLOT)
            .value = _superchainBridge;
    }

    function setL2Messenger(address _l2Messenger) external onlyAdmin {
        StorageSlot
            .getAddressSlot(MemoryUtils.L2_MESSENGER_SLOT)
            .value = _l2Messenger;
    }

    function supportsInterface(
        bytes4 _interfaceId
    ) public pure override returns (bool) {
        return
            _interfaceId == type(IERC7802).interfaceId ||
            _interfaceId == type(IERC20).interfaceId ||
            _interfaceId == type(IERC165).interfaceId;
    }

    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }

    function acceptUpgrade() external view returns (address) {
        return address(this);
    }
}
