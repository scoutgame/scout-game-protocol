// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.22;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ud60x18} from "@prb/math/src/UD60x18.sol";
import {ud60x18} from "@prb/math/src/UD60x18.sol";
import {ISablierV2LockupTranched} from "@sablier/v2-core/src/interfaces/ISablierV2LockupTranched.sol";
import {Broker, LockupTranched} from "@sablier/v2-core/src/types/DataTypes.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Import here so that it is compiled and included in the hardhat artifacts
import {SablierV2NFTDescriptor} from "@sablier/v2-core/src/SablierV2NFTDescriptor.sol";
import {SablierV2LockupTranched} from "@sablier/v2-core/src/SablierV2LockupTranched.sol";

/// @dev This code is referenced in the docs: https://docs.sablier.com/contracts/v2/guides/create-stream/lockup-linear
contract LockupWeeklyStreamCreator is Context {
    using Strings for uint256;
    IERC20 public SCOUT;

    ISablierV2LockupTranched public LOCKUP_TRANCHED;

    uint8 public constant WEEKS_PER_STREAM = 13;

    constructor(address _erc20, address _lockupTranched) {
        SCOUT = IERC20(_erc20);
        LOCKUP_TRANCHED = ISablierV2LockupTranched(_lockupTranched);
    }

    function createStream(
        address recipient,
        uint128 totalAmount,
        uint128 _startDate
    ) public returns (uint256 streamId) {
        // Transfer the provided amount of SCOUT tokens to this contract
        SCOUT.transferFrom(_msgSender(), address(this), totalAmount);

        uint40 firstClaim = getStartDateOffset(_startDate);

        // Approve the Sablier contract to spend SCOUT
        SCOUT.approve(address(LOCKUP_TRANCHED), totalAmount);

        // Declare the params struct
        LockupTranched.CreateWithDurations memory params;

        // Declare the function parameters
        params.sender = _msgSender(); // The sender will be able to cancel the stream
        params.recipient = address(recipient); // The recipient of the streamed assets
        params.totalAmount = uint128(totalAmount); // Total amount is the amount inclusive of all fees
        params.asset = SCOUT; // The streaming asset
        params.cancelable = true; // Whether the stream will be cancelable or not
        params.transferable = true; // Whether the stream will be transferable or not

        // Declare the tranches array
        params.tranches = new LockupTranched.TrancheWithDuration[](
            WEEKS_PER_STREAM
        );

        // Track the amount streamed as we iterate through the weeks
        uint128 _streamed = 0;

        // Remove index 0 from the loop as we want to match the whitepaper schedule for 13 weeks
        for (
            uint256 weekIndex = 1;
            weekIndex <= WEEKS_PER_STREAM;
            weekIndex++
        ) {
            // Calculate the amount for the current week in the loop
            uint128 _amountPerWeek = streamAllocation(totalAmount, weekIndex);
            uint40 _duration = 1 weeks;

            if (weekIndex == 1) {
                _duration = uint40(firstClaim);
            }
            // If we are on the last week, set the amount to the remainder instead to avoid amount mismatch errors
            else if (weekIndex >= WEEKS_PER_STREAM) {
                _amountPerWeek = totalAmount - _streamed;
            }

            _streamed += _amountPerWeek;

            params.tranches[weekIndex - 1] = LockupTranched
                .TrancheWithDuration({
                    amount: _amountPerWeek,
                    duration: _duration
                });
        }
        // Wondering what's up with that ud60x18 function? It's a casting function that wraps a basic integer to the UD60x18 value type. This type is part of the math library PRBMath, which is used in Sablier for fixed-point calculations.
        params.broker = Broker(address(0), ud60x18(0)); // Optional parameter left undefined

        // Create the LockupTranched stream
        streamId = LOCKUP_TRANCHED.createWithDurations(params);
    }

    function claim(uint256 streamId) public {
        LockupTranched.StreamLT memory stream = LOCKUP_TRANCHED.getStream(
            streamId
        );

        LOCKUP_TRANCHED.withdrawMax(streamId, stream.recipient);
    }

    function getStartDateOffset(
        uint128 startDate
    ) internal view returns (uint40) {
        // Revert if the start date is in the past
        require(
            uint40(startDate) >= uint40(block.timestamp),
            "Start date must be in the future"
        );

        // Return the difference between startDate and block.timestamp
        return uint40(startDate - block.timestamp);
    }

    function streamAllocation(
        uint128 totalAmount,
        uint256 weekIndex
    ) internal pure returns (uint128) {
        // Define the allocation percentages for each week
        uint8[WEEKS_PER_STREAM] memory allocationPercentages = [
            5,
            5,
            6,
            6,
            7,
            7,
            8,
            8,
            9,
            9,
            10,
            10,
            10
        ];

        // Ensure the weekIndex is within range
        require(weekIndex > 0 && weekIndex <= 13, "Invalid week index");

        // Calculate the allocation for the specific week
        uint128 allocatedAmount = (totalAmount *
            allocationPercentages[weekIndex - 1]) / 100;

        return allocatedAmount;
    }
}
