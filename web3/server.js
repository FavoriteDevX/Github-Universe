// ============================================================================
// WEB3 (SERVER SIDE): MVC TOKEN ON A TESTNET WITH THIRDWEB v5
// ============================================================================
// Optional. Everything here is OFF unless these environment variables are set
// (see .env.example); without them the game keeps its in-game coins only.
//
//   THIRDWEB_CLIENT_ID      public client id (dashboard -> project)
//   THIRDWEB_SECRET_KEY     secret key of the same project (server only)
//   MVC_CHAIN               base-sepolia (default) or polygon-amoy. TESTNETS ONLY.
//   MVC_TOKEN_ADDRESS       ERC-20 contract of the MVC token
//   GAME_ADMIN_PRIVATE_KEY  wallet allowed to mint (MINTER_ROLE / owner)
//   GAME_TREASURY_ADDRESS   receives the MVC paid for land (default: admin wallet)
//   MVC_MINT_METHOD         mintTo (thirdweb TokenERC20, default) or mint (blockchain/contracts/MVCToken.sol)
//   MVC_MAX_CLAIM           most MVC one claim can mint (default 500)
//   MVC_RPC_URL             optional custom RPC for the same testnet (or a local
//                           Hardhat node started with that chain id, for tests)
//
// Security model: the admin key never leaves the server; the client only
// signs its own transactions. A player first proves the wallet is theirs by
// signing a one-time message; claims reserve the in-game coins before minting
// and refund them if the transaction fails; land purchases are accepted only
// after the server reads the receipt on-chain and finds an MVC Transfer of at
// least the land price from the player's wallet to the treasury (each
// transaction hash can be used once).
const crypto = require('crypto');

const CHAINS = { 'base-sepolia': 'baseSepolia', 'polygon-amoy': 'polygonAmoy' };

let thirdweb = null;
let state = { enabled: false, reason: 'not configured' };

function init() {
  const env = process.env;
  const chainKey = (env.MVC_CHAIN || 'base-sepolia').toLowerCase();
  if (!CHAINS[chainKey]) {
    state = { enabled: false, reason: `MVC_CHAIN must be one of: ${Object.keys(CHAINS).join(', ')} (testnets only)` };
    return state;
  }
  const missing = ['THIRDWEB_CLIENT_ID', 'THIRDWEB_SECRET_KEY', 'MVC_TOKEN_ADDRESS', 'GAME_ADMIN_PRIVATE_KEY'].filter((key) => !env[key]);
  if (missing.length) {
    state = { enabled: false, reason: `missing ${missing.join(', ')}` };
    return state;
  }
  try {
    thirdweb = {
      core: require('thirdweb'),
      chains: require('thirdweb/chains'),
      wallets: require('thirdweb/wallets'),
      erc20: require('thirdweb/extensions/erc20'),
      auth: require('thirdweb/auth')
    };
    const client = thirdweb.core.createThirdwebClient({ secretKey: env.THIRDWEB_SECRET_KEY });
    const testnet = thirdweb.chains[CHAINS[chainKey]];
    const chain = env.MVC_RPC_URL ? thirdweb.chains.defineChain({ ...testnet, rpc: env.MVC_RPC_URL }) : testnet;
    const admin = thirdweb.wallets.privateKeyToAccount({ client, privateKey: env.GAME_ADMIN_PRIVATE_KEY });
    const token = thirdweb.core.getContract({ client, chain, address: env.MVC_TOKEN_ADDRESS });
    state = {
      enabled: true,
      client,
      chain,
      chainKey,
      admin,
      token,
      treasury: (env.GAME_TREASURY_ADDRESS || admin.address).toLowerCase(),
      mintMethod: env.MVC_MINT_METHOD === 'mint' ? 'mint' : 'mintTo',
      maxClaim: Math.max(1, Number(env.MVC_MAX_CLAIM) || 500),
      decimals: null,
      usedTransactions: new Set()
    };
    console.log(`[WEB3] MVC on ${chainKey}: token ${env.MVC_TOKEN_ADDRESS}, admin ${admin.address}`);
  } catch (error) {
    state = { enabled: false, reason: `init failed: ${error.message}` };
  }
  if (!state.enabled) console.warn('[WEB3] disabled:', state.reason);
  return state;
}

// What the browser needs (never the secret key or the admin key)
function publicConfig() {
  if (!state.enabled) return { enabled: false };
  return {
    enabled: true,
    clientId: process.env.THIRDWEB_CLIENT_ID,
    chain: state.chainKey,
    chainId: state.chain.id,
    rpc: process.env.MVC_RPC_URL || null,
    token: state.token.address,
    treasury: state.treasury,
    landPrice: null // filled by server.js
  };
}

async function tokenDecimals() {
  if (state.decimals === null) state.decimals = Number(await thirdweb.erc20.decimals({ contract: state.token }));
  return state.decimals;
}

// One-time message the player signs to link the wallet to the game account
const pendingNonces = new Map();
function bindingMessage(username) {
  const nonce = crypto.randomBytes(16).toString('hex');
  pendingNonces.set(username, { nonce, expires: Date.now() + 10 * 60 * 1000 });
  return `GitHub Multiverse: link this wallet to the game account "${username}".\nNonce: ${nonce}\nThis signature costs nothing and sends no transaction.`;
}

async function verifyBinding(username, address, message, signature) {
  const pending = pendingNonces.get(username);
  if (!pending || pending.expires < Date.now() || !message.includes(pending.nonce)) throw new Error('The link request expired. Try again.');
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid wallet address.');
  const valid = await thirdweb.auth.verifySignature({ message, signature, address, client: state.client, chain: state.chain });
  if (!valid) throw new Error('The signature does not match this wallet.');
  pendingNonces.delete(username);
  return address.toLowerCase();
}

// Mints `amount` whole MVC to `to` with the admin wallet. Returns the tx hash.
async function mint(to, amount) {
  const units = thirdweb.core.toUnits(String(amount), await tokenDecimals());
  const transaction = state.mintMethod === 'mintTo'
    ? thirdweb.erc20.mintTo({ contract: state.token, to, amount: String(amount) })
    : thirdweb.core.prepareContractCall({ contract: state.token, method: 'function mint(address to, uint256 amount)', params: [to, units] });
  const receipt = await thirdweb.core.sendAndConfirmTransaction({ transaction, account: state.admin });
  if (receipt.status !== 'success') throw new Error('The mint transaction reverted.');
  return receipt.transactionHash;
}

// Checks that `txHash` moved at least `price` MVC from `from` to the treasury
async function verifyPayment(txHash, from, price) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('Invalid transaction hash.');
  const hash = txHash.toLowerCase();
  if (state.usedTransactions.has(hash)) throw new Error('This transaction was already used.');
  const receipt = await thirdweb.core.waitForReceipt({ client: state.client, chain: state.chain, transactionHash: txHash });
  if (receipt.status !== 'success') throw new Error('The payment transaction failed on-chain.');
  const transfers = thirdweb.core.parseEventLogs({ logs: receipt.logs.filter((log) => log.address.toLowerCase() === state.token.address.toLowerCase()), events: [thirdweb.erc20.transferEvent()] });
  const needed = thirdweb.core.toUnits(String(price), await tokenDecimals());
  const paid = transfers.some((event) => event.args.from.toLowerCase() === from && event.args.to.toLowerCase() === state.treasury && event.args.value >= needed);
  if (!paid) throw new Error(`No transfer of ${price} MVC from your wallet to the game treasury was found in that transaction.`);
  state.usedTransactions.add(hash);
  return true;
}

// Remembers used payment hashes across restarts (stored by server.js)
function loadUsedTransactions(list) {
  if (state.enabled && Array.isArray(list)) list.forEach((hash) => state.usedTransactions.add(hash));
}

function usedTransactions() {
  return state.enabled ? [...state.usedTransactions] : [];
}

module.exports = {
  init,
  publicConfig,
  bindingMessage,
  verifyBinding,
  mint,
  verifyPayment,
  loadUsedTransactions,
  usedTransactions,
  get enabled() { return state.enabled; },
  get maxClaim() { return state.maxClaim || 0; },
  get reason() { return state.reason; }
};
