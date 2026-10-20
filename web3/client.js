// ============================================================================
// WEB3 (BROWSER SIDE): IN-APP WALLET, CLAIM AND LAND PAYMENTS (THIRDWEB v5)
// ============================================================================
// Bundled by `npm run build:web3` into public/vendor/web3.js and loaded by
// main.js only when /api/web3/config says the server has the MVC token set up.
// - In-app wallet (thirdweb "embedded wallet"): email code or Google login, no
//   browser extension. After the first login the session is restored silently
//   on every visit (autoConnect).
// - EIP-7702 execution with sponsored gas: the player's wallet needs no ETH.
// - The wallet is linked to the game account with a free signature, so the
//   server knows where to mint and whose payments to accept.
// Every blockchain call is wrapped in try/catch and reported in the panel; the
// game never waits on the network to keep running.
import { createThirdwebClient, getContract, sendAndConfirmTransaction, toTokens } from 'thirdweb';
import { baseSepolia, defineChain, polygonAmoy } from 'thirdweb/chains';
import { inAppWallet, preAuthenticate } from 'thirdweb/wallets';
import { balanceOf, decimals as readDecimals, transfer } from 'thirdweb/extensions/erc20';

const CHAINS = { 'base-sepolia': baseSepolia, 'polygon-amoy': polygonAmoy };
const EXPLORERS = { 'base-sepolia': 'https://sepolia.basescan.org/tx/', 'polygon-amoy': 'https://amoy.polygonscan.com/tx/' };

let config = null;
let hooks = null;
let client = null;
let chain = null;
let token = null;
let wallet = null;
let account = null;
let linkedWallet = null;
let tokenDecimals = 18;
const ui = {};

const short = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const friendly = (error) => {
  const text = String((error && (error.shortMessage || error.message)) || error);
  if (/insufficient|exceeds balance|transfer amount exceeds/i.test(text)) return 'Not enough MVC in your wallet for this.';
  if (/user rejected|denied|cancel/i.test(text)) return 'Cancelled.';
  if (/network|fetch|timeout|rpc/i.test(text)) return 'The network is not responding right now. Try again in a moment.';
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
};

// ---------------------------------------------------------------------------
// UI: a small chip next to the coin counter and a panel
// ---------------------------------------------------------------------------
function buildUi() {
  const style = document.createElement('style');
  style.textContent = `
    #web3-chip { position: fixed; top: 14px; right: 150px; z-index: 30; padding: 7px 12px; border-radius: 12px; border: 0; cursor: pointer;
      background: rgba(22, 22, 32, 0.78); color: #e9ecef; font: 600 12px/1.2 "Segoe UI", Arial, sans-serif; backdrop-filter: blur(6px); }
    #web3-chip b { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 600; }
    #web3-panel { display: none; position: fixed; inset: 0; z-index: 70; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.45); }
    #web3-panel .box { width: min(400px, calc(100vw - 32px)); background: #1c1d26; color: #f1f3f5; border-radius: 16px; padding: 18px 20px; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    #web3-panel header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    #web3-panel header button { background: none; border: 0; color: #adb5bd; font-size: 22px; cursor: pointer; }
    #web3-panel .note { color: #adb5bd; font-size: 12px; margin: 6px 0 12px; }
    #web3-panel input { width: 100%; box-sizing: border-box; padding: 9px 11px; border-radius: 9px; border: 1px solid #343a40; background: #12131a; color: #fff; margin: 4px 0 8px; }
    #web3-panel button.action { width: 100%; padding: 10px; border: 0; border-radius: 10px; background: #ff2d55; color: #fff; font-weight: 700; cursor: pointer; margin-top: 4px; }
    #web3-panel button.secondary { background: rgba(255, 255, 255, 0.1); }
    #web3-panel button:disabled { opacity: 0.6; cursor: progress; }
    #web3-panel .address { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; color: #74c0fc; }
    #web3-panel .row { display: flex; gap: 8px; }
    #web3-panel .status { min-height: 18px; font-size: 13px; margin-top: 8px; }
    #web3-panel .status.error { color: #ff8787; }
    #web3-panel .status.ok { color: #8ce99a; }
    #web3-panel .status a { color: #74c0fc; }
    .web3-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%;
      animation: web3-spin 0.8s linear infinite; vertical-align: -2px; margin-right: 6px; }
    @keyframes web3-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
  ui.chip = document.createElement('button');
  ui.chip.id = 'web3-chip';
  ui.chip.type = 'button';
  ui.chip.title = 'MVC wallet (testnet)';
  ui.chip.addEventListener('click', openPanel);
  document.body.appendChild(ui.chip);
  ui.panel = document.createElement('div');
  ui.panel.id = 'web3-panel';
  ui.panel.innerHTML = `<div class="box">
      <header><b>MVC Wallet · ${config.chain === 'polygon-amoy' ? 'Polygon Amoy' : 'Base Sepolia'} testnet</b><button type="button" data-act="close" aria-label="Close">&times;</button></header>
      <div data-view="login">
        <p class="note">A wallet is created for you automatically: no extension, no seed phrase. Testnet only: these tokens have no real-money value.</p>
        <input type="email" data-field="email" placeholder="you@example.com" autocomplete="email">
        <button type="button" class="action" data-act="send">Send login code</button>
        <input type="text" data-field="code" placeholder="6-digit code" inputmode="numeric" style="display:none">
        <button type="button" class="action" data-act="verify" style="display:none">Enter</button>
        <button type="button" class="action secondary" data-act="google">Continue with Google</button>
      </div>
      <div data-view="wallet" style="display:none">
        <p class="note">Your wallet</p>
        <div class="address" data-field="address"></div>
        <p>On-chain balance: <b data-field="balance">...</b> MVC</p>
        <button type="button" class="action secondary" data-act="link" style="display:none">Link this wallet to my game account</button>
        <div data-field="claim-box">
          <p class="note">Claim turns in-game MVC (commits, chests, drops) into testnet MVC tokens in this wallet.</p>
          <div class="row"><input type="number" min="1" step="1" data-field="amount" placeholder="Amount"><button type="button" class="action" data-act="claim" style="width:auto;padding:0 16px">Claim</button></div>
        </div>
        <button type="button" class="action secondary" data-act="logout">Log out of the wallet</button>
      </div>
      <div class="status" data-field="status"></div>
    </div>`;
  document.body.appendChild(ui.panel);
  const $ = (selector) => ui.panel.querySelector(selector);
  ui.field = (name) => $(`[data-field="${name}"]`);
  ui.view = (name) => $(`[data-view="${name}"]`);
  ui.button = (name) => $(`[data-act="${name}"]`);
  ui.button('close').addEventListener('click', closePanel);
  ui.panel.addEventListener('click', (event) => { if (event.target === ui.panel) closePanel(); });
  ui.button('send').addEventListener('click', sendCode);
  ui.button('verify').addEventListener('click', verifyCode);
  ui.button('google').addEventListener('click', () => connect({ strategy: 'google' }));
  ui.button('link').addEventListener('click', link);
  ui.button('claim').addEventListener('click', claim);
  ui.button('logout').addEventListener('click', logout);
  ['email', 'code', 'amount'].forEach((name) => ui.field(name).addEventListener('keydown', (event) => event.stopPropagation()));
  render();
}

// "Loading..." pill shown while a transaction is on its way
function loading(text) {
  if (!ui.loading) {
    ui.loading = document.createElement('div');
    ui.loading.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:75;padding:9px 16px;border-radius:20px;background:rgba(22,22,32,0.9);color:#fff;font:600 13px "Segoe UI",Arial,sans-serif;display:none';
    document.body.appendChild(ui.loading);
  }
  ui.loading.style.display = text ? 'block' : 'none';
  if (text) ui.loading.innerHTML = `<span class="web3-spinner"></span>${text}`;
}

function status(text, kind = '') {
  ui.field('status').className = `status ${kind}`;
  ui.field('status').innerHTML = text;
}

function busy(button, text) {
  const target = ui.button(button);
  if (!target.dataset.label) target.dataset.label = target.textContent;
  target.disabled = Boolean(text);
  target.innerHTML = text ? `<span class="web3-spinner"></span>${text}` : target.dataset.label;
}

function render() {
  ui.chip.innerHTML = account ? `Wallet <b>${short(account.address)}</b>` : 'Connect wallet';
  ui.view('login').style.display = account ? 'none' : '';
  ui.view('wallet').style.display = account ? '' : 'none';
  if (!account) return;
  ui.field('address').textContent = account.address;
  const linked = linkedWallet && linkedWallet === account.address.toLowerCase();
  ui.button('link').style.display = linked ? 'none' : '';
  ui.field('claim-box').style.display = linked ? '' : 'none';
}

function openPanel() {
  hooks.releaseKeys();
  ui.panel.style.display = 'flex';
  render();
  refreshBalance();
}

function closePanel() {
  ui.panel.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
async function refreshBalance() {
  if (!account) return;
  try {
    const raw = await balanceOf({ contract: token, address: account.address });
    ui.field('balance').textContent = Number(toTokens(raw, tokenDecimals)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  } catch (error) {
    ui.field('balance').textContent = 'unavailable';
  }
}

async function sendCode() {
  const email = ui.field('email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status('Type a valid email.', 'error'); return; }
  busy('send', 'Sending...');
  try {
    await preAuthenticate({ client, strategy: 'email', email });
    ui.field('code').style.display = '';
    ui.button('verify').style.display = '';
    status(`Code sent to ${email}.`, 'ok');
  } catch (error) {
    status(friendly(error), 'error');
  } finally {
    busy('send', '');
  }
}

async function verifyCode() {
  const code = ui.field('code').value.trim();
  if (!/^\d{4,8}$/.test(code)) { status('Type the code from the email.', 'error'); return; }
  await connect({ strategy: 'email', email: ui.field('email').value.trim(), verificationCode: code });
}

async function connect(options) {
  busy(options.strategy === 'google' ? 'google' : 'verify', 'Creating your wallet...');
  try {
    account = await wallet.connect({ client, chain, ...options });
    status('Wallet ready.', 'ok');
    render();
    refreshBalance();
    if (!linkedWallet || linkedWallet !== account.address.toLowerCase()) link();
  } catch (error) {
    status(friendly(error), 'error');
  } finally {
    busy(options.strategy === 'google' ? 'google' : 'verify', '');
  }
}

async function logout() {
  try { await wallet.disconnect(); } catch (error) { /* already disconnected */ }
  account = null;
  status('');
  render();
}

// Links the wallet to the game account: the server sends a one-time message,
// the wallet signs it (free, no transaction) and the server verifies it
function link() {
  if (!account) return;
  busy('link', 'Waiting for signature...');
  hooks.socket.emit('web3_link_request');
}

async function onLinkMessage({ message }) {
  try {
    const signature = await account.signMessage({ message });
    hooks.socket.emit('web3_link', { address: account.address, message, signature });
    status('<span class="web3-spinner"></span>Linking...', '');
  } catch (error) {
    busy('link', '');
    status(friendly(error), 'error');
  }
}

function claim() {
  const amount = Math.floor(Number(ui.field('amount').value));
  if (!(amount >= 1)) { status('Type how many MVC to claim.', 'error'); return; }
  if (amount > hooks.wallet()) { status(`You have ${hooks.wallet()} MVC in the game.`, 'error'); return; }
  busy('claim', 'Minting...');
  status('<span class="web3-spinner"></span>Sending your MVC to the blockchain. This can take a few seconds.', '');
  hooks.socket.emit('web3_claim', { amount });
}

// Land: pays 250 MVC to the treasury from the player's wallet, then asks the
// server to verify the transaction. The parcel only changes on the map when
// the server confirms it (the "lands" event), so a failed payment never
// leaves a half-bought parcel.
let landPurchase = null;
async function buyLand(parcel) {
  if (!account) { openPanel(); status('Log in to your wallet to pay for land with MVC tokens.', ''); return; }
  if (!linkedWallet || linkedWallet !== account.address.toLowerCase()) { openPanel(); status('Link this wallet to your game account first.', 'error'); return; }
  if (landPurchase) { hooks.system('A land purchase is already being processed.'); return; }
  if (!window.confirm(`Buy parcel ${parcel} for ${config.landPrice} MVC (testnet tokens) from your wallet?`)) return;
  landPurchase = parcel;
  loading(`Paying ${config.landPrice} MVC for parcel ${parcel}...`);
  try {
    const raw = await balanceOf({ contract: token, address: account.address });
    if (Number(toTokens(raw, tokenDecimals)) < config.landPrice) throw new Error(`insufficient: you have ${toTokens(raw, tokenDecimals)} MVC on-chain. Claim more MVC first.`);
    const transaction = transfer({ contract: token, to: config.treasury, amount: String(config.landPrice) });
    const receipt = await sendAndConfirmTransaction({ transaction, account });
    loading(`Confirming parcel ${parcel} with the server...`);
    hooks.socket.emit('buy_land_onchain', { parcel, transactionHash: receipt.transactionHash });
  } catch (error) {
    landPurchase = null;
    loading('');
    hooks.system(`Land purchase failed: ${friendly(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init(serverConfig, gameHooks) {
  config = serverConfig;
  hooks = gameHooks;
  chain = CHAINS[config.chain];
  if (!chain) return false;
  if (config.rpc) chain = defineChain({ ...chain, rpc: config.rpc });
  client = createThirdwebClient({ clientId: config.clientId });
  token = getContract({ client, chain, address: config.token });
  wallet = inAppWallet({ auth: { options: ['email', 'google'] }, executionMode: { mode: 'EIP7702', sponsorGas: true } });
  buildUi();
  try { tokenDecimals = Number(await readDecimals({ contract: token })); } catch (error) { tokenDecimals = 18; }
  // Returning players: restore the wallet silently
  try {
    account = await wallet.autoConnect({ client, chain });
  } catch (error) {
    account = null;
  }
  render();
  const socket = hooks.socket;
  socket.on('web3_account', ({ wallet: address }) => { linkedWallet = address; busy('link', ''); render(); if (address && account) status('Wallet linked to your game account.', 'ok'); });
  socket.on('web3_link_message', onLinkMessage);
  socket.on('web3_claimed', ({ amount, transactionHash }) => {
    busy('claim', '');
    status(`Claimed ${amount} MVC. <a href="${EXPLORERS[config.chain]}${transactionHash}" target="_blank" rel="noopener">View transaction</a>`, 'ok');
    hooks.system(`${amount} MVC were minted to your wallet ${short(account ? account.address : linkedWallet)}.`);
    refreshBalance();
  });
  socket.on('web3_land_bought', ({ parcel }) => {
    landPurchase = null;
    loading('');
    hooks.system(`Parcel ${parcel} is yours: paid with ${config.landPrice} MVC on-chain.`);
    refreshBalance();
  });
  socket.emit('web3_account_request');
  socket.on('web3_error', ({ action, message }) => {
    if (action === 'claim') busy('claim', '');
    if (action === 'link') busy('link', '');
    if (action === 'land') { landPurchase = null; loading(''); hooks.system(`Land purchase failed: ${message}`); return; }
    status(message, 'error');
  });
  return true;
}

window.MultiverseWeb3 = {
  init,
  buyLand,
  open: openPanel,
  isReady: () => Boolean(account && linkedWallet && linkedWallet === account.address.toLowerCase())
};
