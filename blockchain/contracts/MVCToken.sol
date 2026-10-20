// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Multiverse Coin (MVC)
/// @notice ERC-20 token of GitHub Multiverse. New coins can only be minted by
///         the owner or by the game contract the owner sets. The total supply
///         has a fixed cap chosen at deployment, so not even the owner can
///         inflate it past that limit.
/// @dev Built on OpenZeppelin Contracts 5.x.
contract MVCToken is ERC20, ERC20Capped, ERC20Burnable, Ownable {
    /// @notice Address of the game contract allowed to mint (zero = none yet).
    address public gameContract;

    event GameContractUpdated(address indexed previousGame, address indexed newGame);

    error NotOwnerOrGame(address caller);

    modifier onlyOwnerOrGame() {
        if (msg.sender != owner() && msg.sender != gameContract) revert NotOwnerOrGame(msg.sender);
        _;
    }

    /// @param initialOwner Wallet that owns the contract (use a multisig in production).
    /// @param maxSupply Hard cap of the total supply, in the smallest unit (18 decimals).
    constructor(address initialOwner, uint256 maxSupply)
        ERC20("Multiverse Coin", "MVC")
        ERC20Capped(maxSupply)
        Ownable(initialOwner)
    {}

    /// @notice Sets (or clears, with address(0)) the game contract allowed to mint.
    function setGameContract(address newGame) external onlyOwner {
        emit GameContractUpdated(gameContract, newGame);
        gameContract = newGame;
    }

    /// @notice Mints `amount` MVC to `to`. Only the owner or the game contract.
    function mint(address to, uint256 amount) external onlyOwnerOrGame {
        _mint(to, amount);
    }

    // ERC20Capped enforces the cap inside _update; both parents define it.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}
