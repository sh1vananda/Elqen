// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Ensure this matches your ElqenCircle.sol pragma

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For controlled minting

contract MockERC20 is ERC20, Ownable {

    // For OpenZeppelin Contracts v5.0+, decimals are handled differently.
    // If you need to set decimals other than the default 18,
    // you would override the decimals() function.
    // However, ERC20's constructor itself does not take decimals directly.
    // The name and symbol are passed to the ERC20 constructor.
    // The standard ERC20 implementation defaults to 18 decimals.

    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {
        // In OZ v5.x, ERC20 constructor only takes name and symbol.
        // Decimals default to 18. If you need different decimals, you'd override the `decimals()` view function.
        // For a mock, 18 is usually fine.
    }

    // If you absolutely need to set custom decimals for this MockERC20,
    // and it's not just for display but for how `parseUnits` and `formatUnits`
    // behave with it in tests, you would override the decimals function.
    // However, for most mock purposes, the default 18 is sufficient or you align
    // your `ethers.parseUnits("100", DESIRED_DECIMALS)` in your tests/scripts.

    // Example of overriding decimals if you needed something other than 18:
    // function decimals() public view virtual override returns (uint8) {
    //     return 6; // For example, if you want this mock to behave like USDC with 6 decimals
    // }


    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function publicMint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        // To burn tokens from msg.sender:
        // _burn(msg.sender, amount);

        // To allow burning from another address (if approved or if msg.sender is 'from'):
        if (msg.sender != from) {
            // Check allowance if msg.sender is not the 'from' address
            uint256 currentAllowance = allowance(from, msg.sender);
            require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
            _spendAllowance(from, msg.sender, amount);
        }
        _burn(from, amount);
    }
}