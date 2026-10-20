const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

describe('MVCToken', () => {
  const CAP = ethers.parseUnits('1000000', 18); // 1,000,000 MVC

  async function deployFixture() {
    const [owner, game, player, stranger] = await ethers.getSigners();
    const token = await ethers.deployContract('MVCToken', [owner.address, CAP]);
    return { token, owner, game, player, stranger };
  }

  describe('deployment', () => {
    it('has the right name, symbol, decimals, cap and owner', async () => {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal('Multiverse Coin');
      expect(await token.symbol()).to.equal('MVC');
      expect(await token.decimals()).to.equal(18n);
      expect(await token.cap()).to.equal(CAP);
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.totalSupply()).to.equal(0n);
      expect(await token.gameContract()).to.equal(ethers.ZeroAddress);
    });
  });

  describe('mint', () => {
    it('lets the owner mint', async () => {
      const { token, player } = await loadFixture(deployFixture);
      await expect(token.mint(player.address, 100n)).to.changeTokenBalance(token, player, 100n);
    });

    it('lets the game contract mint once it is set', async () => {
      const { token, game, player } = await loadFixture(deployFixture);
      await token.setGameContract(game.address);
      await expect(token.connect(game).mint(player.address, 50n)).to.changeTokenBalance(token, player, 50n);
    });

    it('rejects anyone else', async () => {
      const { token, stranger, player } = await loadFixture(deployFixture);
      await expect(token.connect(stranger).mint(player.address, 1n))
        .to.be.revertedWithCustomError(token, 'NotOwnerOrGame')
        .withArgs(stranger.address);
    });

    it('stops the old game contract after it is replaced or cleared', async () => {
      const { token, game, stranger, player } = await loadFixture(deployFixture);
      await token.setGameContract(game.address);
      await token.setGameContract(stranger.address);
      await expect(token.connect(game).mint(player.address, 1n)).to.be.revertedWithCustomError(token, 'NotOwnerOrGame');
      await token.setGameContract(ethers.ZeroAddress);
      await expect(token.connect(stranger).mint(player.address, 1n)).to.be.revertedWithCustomError(token, 'NotOwnerOrGame');
    });

    it('never goes past the cap', async () => {
      const { token, player } = await loadFixture(deployFixture);
      await token.mint(player.address, CAP);
      await expect(token.mint(player.address, 1n)).to.be.revertedWithCustomError(token, 'ERC20ExceededCap');
    });
  });

  describe('game contract management', () => {
    it('only the owner can set it, and it emits an event', async () => {
      const { token, game, stranger } = await loadFixture(deployFixture);
      await expect(token.connect(stranger).setGameContract(game.address))
        .to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount')
        .withArgs(stranger.address);
      await expect(token.setGameContract(game.address))
        .to.emit(token, 'GameContractUpdated')
        .withArgs(ethers.ZeroAddress, game.address);
    });

    it('the game contract cannot change itself or other settings', async () => {
      const { token, game, stranger } = await loadFixture(deployFixture);
      await token.setGameContract(game.address);
      await expect(token.connect(game).setGameContract(stranger.address)).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });
  });

  describe('burn and transfers', () => {
    it('holders can transfer and burn their own coins', async () => {
      const { token, player, stranger } = await loadFixture(deployFixture);
      await token.mint(player.address, 100n);
      await expect(token.connect(player).transfer(stranger.address, 30n)).to.changeTokenBalances(token, [player, stranger], [-30n, 30n]);
      await token.connect(player).burn(20n);
      expect(await token.balanceOf(player.address)).to.equal(50n);
      expect(await token.totalSupply()).to.equal(80n);
    });
  });
});
