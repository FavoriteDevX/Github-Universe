const express = require('express');
const app = express();
const fs = require('fs');
const crypto = require('crypto');
const TechFeeds = require('./feeds');
const path = require('path'); // Core module to handle absolute system directory paths smoothly
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PUBLIC_DIR = path.join(__dirname, 'public');

// Serves all static layout assets (index.html, scripts, maps JSON directories) nested inside public folder
app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: '10kb' }));

// ----------------------------------------------------------------------------
// Accounts: usernames + scrypt-hashed passwords, persisted in data/users.json
// ----------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_INVENTORY = 20;
let accounts = { users: {}, sessions: {} };
try {
  accounts = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('[ACCOUNTS] Could not read users file:', error.message);
}

accounts.lands = accounts.lands || {}; // parcel "x,z" -> { owner, boughtAt }

// In-game economy (like Decentraland's MANA and LAND, but NOT real money):
// Multiverse Coins (MVC) are earned by playing and spent on land parcels.
const STARTING_COINS = 100;
const LAND_PRICE = 250;
const MAX_PARCEL = 40; // Genesis City spans parcels -40..40 (16 m each)
function walletOf(account) {
  if (typeof account.coins !== 'number') account.coins = STARTING_COINS;
  return account.coins;
}

let saveTimer = null;
function saveAccounts() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(USERS_FILE, JSON.stringify(accounts), (error) => {
      if (error) console.error('[ACCOUNTS] Could not save users file:', error.message);
    });
  }, 300);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSession(userKey) {
  const token = crypto.randomBytes(32).toString('hex');
  accounts.sessions[token] = { user: userKey, expiresAt: Date.now() + SESSION_TTL_MS };
  saveAccounts();
  return token;
}

function userFromToken(token) {
  const session = typeof token === 'string' ? accounts.sessions[token] : null;
  if (!session || session.expiresAt < Date.now()) return null;
  return accounts.users[session.user] || null;
}

// Simple per-IP rate limit for login and sign-up attempts
const authAttempts = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = authAttempts.get(ip) || { count: 0, resetAt: now + 5 * 60 * 1000 };
  if (entry.resetAt < now) { entry.count = 0; entry.resetAt = now + 5 * 60 * 1000; }
  entry.count++;
  authAttempts.set(ip, entry);
  return entry.count > 10;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

app.post('/api/signup', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const { username, password } = req.body || {};
  if (!USERNAME_PATTERN.test(username || '')) return res.status(400).json({ error: 'Usernames have 3-16 letters, numbers or _.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Passwords need at least 8 characters.' });
  const key = username.toLowerCase();
  if (accounts.users[key]) return res.status(409).json({ error: 'That username is taken. Log in instead?' });
  const salt = crypto.randomBytes(16).toString('hex');
  accounts.users[key] = { username, salt, hash: hashPassword(password, salt), createdAt: Date.now(), inventory: [] };
  res.json({ token: createSession(key), username });
});

app.post('/api/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const { username, password } = req.body || {};
  const user = typeof username === 'string' ? accounts.users[username.toLowerCase()] : null;
  const candidate = user && typeof password === 'string' ? Buffer.from(hashPassword(password, user.salt), 'hex') : null;
  if (!user || !crypto.timingSafeEqual(candidate, Buffer.from(user.hash, 'hex'))) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  res.json({ token: createSession(username.toLowerCase()), username: user.username });
});

app.get('/api/session', (req, res) => {
  const user = userFromToken(req.get('x-session-token'));
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  res.json({ username: user.username });
});

app.post('/api/logout', (req, res) => {
  delete accounts.sessions[req.get('x-session-token')];
  saveAccounts();
  res.json({ ok: true });
});

const MAX_CHAT_LENGTH = 200;
const MAX_COORDINATE = 3000;
const TICKS_PER_SECOND = 20; // Minecraft pace: a full day lasts 20 minutes
const MONSTER_RESPAWN_MS = 30000;
const ALLOWED_DAMAGE = new Set([10, 15, 40]);
const CHEST_RESPAWN_MS = 2 * 60 * 1000;
const SUPPLY_DROP_EVERY_MS = Number(process.env.SUPPLY_DROP_EVERY_MS) || 3 * 60 * 1000;
const SUPPLY_DROP_FALL_MS = 20000;
const LOOT_REACH = 7;
const DECOR_ITEMS = new Set(['tree', 'lamp', 'banner', 'fountain', 'duck', 'flag', 'neon', 'bench']);
const WEARABLES = new Set(['hoodie', 'mug', 'cap', 'headphones', 'hammer']); // the crown only comes from Legendary loot

// Active tracking memory for connected developers network clients
const activeDevelopers = {};

// ----------------------------------------------------------------------------
// Shared world state: time of day, weather and the interactive districts
// ----------------------------------------------------------------------------
const worldState = { ticks: 1000, cycle: true, weather: 'clear', changedAt: Date.now() };

function currentTicks() {
  const elapsed = worldState.cycle ? ((Date.now() - worldState.changedAt) / 1000) * TICKS_PER_SECOND : 0;
  return (worldState.ticks + elapsed) % 24000;
}

function worldStatePayload(extra = {}) {
  return { ticks: currentTicks(), cycle: worldState.cycle, weather: worldState.weather, elapsedMs: 0, ...extra };
}

// Debug Dungeon monsters are read from the map file so the server owns their health
const dungeonMap = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'maps', 'map_debug_dungeon.json'), 'utf8'));
const monsters = {};
dungeonMap.blocks.filter((block) => block.id && block.hp).forEach((block) => {
  monsters[block.id] = { name: block.label, maxHp: block.hp, hp: block.hp, alive: true };
});

const gameState = {
  scores: {},
  murals: {},
  decorations: { slot1: { item: 'tree' }, slot2: { item: 'lamp' }, slot3: { item: 'banner', color: '#8250df' }, slot4: { item: 'duck' }, slot5: { item: 'tree' }, slot6: { item: 'lamp' }, slot7: { item: 'flag', color: '#2da44e' }, slot8: { item: 'bench' } },
  pullRequests: [],
  stream: null,
  trees: []
};

// ----------------------------------------------------------------------------
// Fortnite-style loot: chests on the streets and supply drops from the sky
// ----------------------------------------------------------------------------
const lootTable = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'maps', 'loot.json'), 'utf8'));
const lootSpawns = {};
lootTable.spawns.forEach((spawn, index) => {
  lootSpawns[`chest${index}`] = { id: `chest${index}`, kind: 'chest', x: spawn.x, z: spawn.z, area: spawn.area, openUntil: 0 };
});
let supplyDropCounter = 0;

function publicLoot() {
  return Object.values(lootSpawns).map(({ id, kind, x, z, area, openUntil, landsAt }) => ({ id, kind, x, z, area, open: openUntil > Date.now(), landsAt }));
}

function rollItem(kind) {
  const weightKey = kind === 'drop' ? 'dropWeight' : 'chestWeight';
  const rarities = Object.entries(lootTable.rarities).filter(([, rarity]) => rarity[weightKey] > 0);
  let roll = Math.random() * rarities.reduce((sum, [, rarity]) => sum + rarity[weightKey], 0);
  const [rarityKey] = rarities.find(([, rarity]) => (roll -= rarity[weightKey]) < 0) || rarities[0];
  const options = lootTable.items.filter((item) => item.rarity === rarityKey);
  return options[Math.floor(Math.random() * options.length)];
}

function spawnSupplyDrop() {
  if (!Object.keys(activeDevelopers).length) return;
  const spot = lootTable.spawns[Math.floor(Math.random() * lootTable.spawns.length)];
  const id = `drop${++supplyDropCounter}`;
  lootSpawns[id] = { id, kind: 'drop', x: spot.x + (Math.random() - 0.5) * 6, z: spot.z + (Math.random() - 0.5) * 6, area: spot.area, openUntil: 0, landsAt: Date.now() + SUPPLY_DROP_FALL_MS };
  io.emit('loot_spawned', publicLoot().find((loot) => loot.id === id));
  io.emit('system_message', `📦 A SUPPLY DROP is falling over ${spot.area}! First dev to reach it gets Rare-to-Legendary loot.`);
  // Unopened drops disappear after five minutes
  setTimeout(() => {
    if (lootSpawns[id] && !lootSpawns[id].openUntil) { delete lootSpawns[id]; io.emit('loot_removed', id); }
  }, 5 * 60 * 1000);
}
setInterval(spawnSupplyDrop, SUPPLY_DROP_EVERY_MS);

const sharedCodeBlocks = new Map(); // Codify blocks their owners chose to share
const VEHICLES = new Set(['rosso', 'wedge', 'volt', 'cyberwedge', 'cycle', 'cycleRed']);
const EMOTES = new Set(['wave', 'dance', 'cheer', 'clap', 'sit', 'think', 'ship', 'coffee']);

function commitLeaderboard() {
  return Object.values(accounts.users).filter((user) => user.commits).map((user) => [user.username, user.commits]).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function publicGameState() {
  const monsterState = {};
  Object.entries(monsters).forEach(([id, monster]) => { monsterState[id] = { hp: monster.hp, alive: monster.alive }; });
  return { ...gameState, monsters: monsterState };
}

function sanitizePosition(position) {
  if (!position || typeof position !== 'object') return null;
  const axes = ['x', 'y', 'z'].map((axis) => Number(position[axis]));
  if (axes.some((value) => !Number.isFinite(value))) return null;
  const [x, y, z] = axes.map((value) => Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value)));
  return { x, y, z };
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maxLength) : '';
}

function pullRequestsPayload(message) {
  return { pullRequests: gameState.pullRequests.slice(-40), decorations: gameState.decorations, message };
}

// Only YouTube and Twitch embeds are accepted for the Keynote screen
function toEmbedUrl(rawUrl, hostForTwitch) {
  let url;
  try { url = new URL(rawUrl); } catch (error) { return null; }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const videoId = url.searchParams.get('v') || (url.pathname.startsWith('/live/') ? url.pathname.split('/')[2] : null);
    return videoId && /^[\w-]{6,20}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
  }
  if (host === 'youtu.be') {
    const videoId = url.pathname.slice(1);
    return /^[\w-]{6,20}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
  }
  if (host === 'twitch.tv') {
    const channel = url.pathname.split('/')[1];
    return /^\w{3,25}$/.test(channel || '') ? `https://player.twitch.tv/?channel=${channel}&parent=${hostForTwitch}` : null;
  }
  return null;
}

// Only logged-in developers can join the multiverse
io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth && socket.handshake.auth.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.userKey = user.username.toLowerCase();
  // Private lobbies: devs only see and hear others in the same lobby (default: public)
  const lobby = typeof socket.handshake.auth.lobby === 'string' ? socket.handshake.auth.lobby.replace(/[^a-z0-9]/gi, '').slice(0, 12) : '';
  socket.data.room = lobby ? `lobby:${lobby}` : 'lobby:public';
  next();
});

// This manages every developer that connects to your multiverse environment cluster
io.on('connection', (socket) => {
  const account = accounts.users[socket.data.userKey];
  const developerTag = account.username;

  // Assigns initial state parameters to the joining tridimensional cursor mesh pointer
  activeDevelopers[socket.id] = {
    id: socket.id,
    devTag: developerTag,
    position: { x: 0, y: 1, z: 0 },
    color: getRandomPastelColor(),
    wearable: null
  };

  console.log(`[NETWORK] Developer registered: ${developerTag} (${socket.id})`);

  socket.emit('local_registration_success', activeDevelopers[socket.id]);
  const room = socket.data.room;
  socket.join(room);
  activeDevelopers[socket.id].room = room;
  socket.emit('sync_entire_developer_pool', Object.values(activeDevelopers).filter((peer) => peer.room === room));
  socket.emit('commit_leaderboard', commitLeaderboard());
  socket.emit('world_state', worldStatePayload());
  socket.emit('game_state', publicGameState());
  socket.emit('loot_spawns', publicLoot());
  socket.emit('tech_feeds', TechFeeds.snapshot());
  socket.emit('inventory', account.inventory);
  socket.to(room).emit('new_developer_joined', activeDevelopers[socket.id]);

  const developer = () => activeDevelopers[socket.id];

  // Synchronizes real-time coordinates transform movements across the whole city
  socket.on('update_cursor_transform', (transformData) => {
    const position = sanitizePosition(transformData && transformData.position);
    if (!developer() || !position) return;
    developer().position = position;
    socket.to(room).emit('peer_cursor_transformed', { id: socket.id, position });
  });

  socket.on('chat_message', (rawText) => {
    const text = cleanText(rawText, MAX_CHAT_LENGTH);
    if (!developer() || !text) return;
    io.to(room).emit('chat_message', { id: socket.id, devTag: developer().devTag, color: developer().color, text, timestamp: Date.now() });
  });

  socket.on('private_message', ({ targetId, text } = {}) => {
    const target = activeDevelopers[targetId];
    const cleanMessage = cleanText(text, MAX_CHAT_LENGTH);
    if (!developer() || !target || !cleanMessage) return;
    const message = { fromId: socket.id, devTag: developer().devTag, toTag: target.devTag, color: developer().color, text: cleanMessage };
    io.to(targetId).emit('private_message', message);
    socket.emit('private_message', message);
  });

  socket.on('set_nick', () => {
    socket.emit('system_message', 'Your name is your account username. Create a new account to use another name.');
  });

  socket.on('set_wearable', (item) => {
    if (!developer()) return;
    developer().wearable = WEARABLES.has(item) ? item : null;
    io.to(room).emit('peer_updated', { id: socket.id, devTag: developer().devTag, wearable: developer().wearable });
  });

  // Minecraft-style /time, /gamerule doDaylightCycle and /weather (shared by everyone)
  socket.on('world_state_change', (change = {}) => {
    if (!developer()) return;
    let kind = null;
    if (typeof change.ticks === 'number' && Number.isFinite(change.ticks)) {
      worldState.ticks = ((change.ticks % 24000) + 24000) % 24000;
      worldState.changedAt = Date.now();
      kind = 'time';
    }
    if (typeof change.cycle === 'boolean') {
      worldState.ticks = currentTicks();
      worldState.changedAt = Date.now();
      worldState.cycle = change.cycle;
      kind = 'cycle';
    }
    if (['clear', 'rain', 'snow', 'thunder'].includes(change.weather)) {
      worldState.weather = change.weather;
      kind = 'weather';
    }
    if (kind) io.emit('world_state', worldStatePayload({ by: developer().devTag, kind }));
  });

  // Teleport requests always need the other player's consent (/tpa, /tpahere, /tpaccept)
  socket.on('teleport_request', ({ targetId, mode } = {}) => {
    if (!developer() || !activeDevelopers[targetId] || targetId === socket.id) return;
    io.to(targetId).emit('teleport_request', { fromId: socket.id, fromTag: developer().devTag, mode: mode === 'here' ? 'here' : 'to' });
  });
  socket.on('teleport_accept', ({ requesterId, mode } = {}) => {
    if (!developer() || !activeDevelopers[requesterId]) return;
    io.to(requesterId).emit('teleport_accepted', { byId: socket.id, byTag: developer().devTag, mode: mode === 'here' ? 'here' : 'to' });
  });
  socket.on('teleport_deny', ({ requesterId } = {}) => {
    if (!developer() || !activeDevelopers[requesterId]) return;
    io.to(requesterId).emit('teleport_denied', { byTag: developer().devTag });
  });

  // Debug Dungeon: co-op bug squashing with server-owned health
  socket.on('monster_hit', ({ id, damage } = {}) => {
    const monster = monsters[id];
    if (!developer() || !monster || !monster.alive || !ALLOWED_DAMAGE.has(damage)) return;
    if (developer().lensUntil > Date.now()) damage *= 2; // Debugger Lens buff
    monster.hp = Math.max(0, monster.hp - damage);
    monster.alive = monster.hp > 0;
    io.emit('monster_update', { id, hp: monster.hp, alive: monster.alive, by: developer().devTag, damage });
    if (!monster.alive) {
      gameState.scores[developer().devTag] = (gameState.scores[developer().devTag] || 0) + 1;
      io.emit('scores', gameState.scores);
      setTimeout(() => {
        monster.hp = monster.maxHp;
        monster.alive = true;
        io.emit('monster_update', { id, hp: monster.hp, alive: true });
      }, MONSTER_RESPAWN_MS);
    }
  });

  // Open Source HQ: code murals and visual pull requests
  socket.on('mural_post', ({ muralId, text } = {}) => {
    const cleanCode = cleanText(text, 80);
    if (!developer() || !/^mural[1-4]$/.test(muralId || '') || !cleanCode) return;
    gameState.murals[muralId] = [...(gameState.murals[muralId] || []), { devTag: developer().devTag, text: cleanCode }].slice(-30);
    io.emit('murals', gameState.murals);
  });

  socket.on('pr_open', ({ slot, item, color } = {}) => {
    if (!developer() || !(slot >= 1 && slot <= 8) || !DECOR_ITEMS.has(item)) return;
    const pr = {
      id: gameState.pullRequests.length + 1,
      slot: Math.floor(slot),
      item,
      color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : null,
      author: developer().devTag,
      authorId: socket.id,
      approvals: [],
      status: 'open'
    };
    gameState.pullRequests.push(pr);
    io.emit('pull_requests', pullRequestsPayload(`${pr.author} opened PR #${pr.id}: slot ${pr.slot} -> ${pr.item}. Another dev must /approve ${pr.id} before /merge.`));
  });

  socket.on('pr_review', ({ id, action } = {}) => {
    const pr = gameState.pullRequests.find((candidate) => candidate.id === id);
    if (!developer() || !pr) return;
    if (pr.status !== 'open') { socket.emit('system_message', `PR #${id} is already ${pr.status}.`); return; }
    const reviewer = developer().devTag;
    if (action === 'approve') {
      if (pr.authorId === socket.id) { socket.emit('system_message', 'You cannot approve your own pull request.'); return; }
      if (!pr.approvals.includes(reviewer)) pr.approvals.push(reviewer);
      io.emit('pull_requests', pullRequestsPayload(`${reviewer} approved PR #${id}.`));
    } else if (action === 'merge') {
      // Like a protected branch: one approval from someone else, unless the author is alone online
      const aloneOnline = Object.keys(activeDevelopers).length === 1;
      if (!pr.approvals.length && !aloneOnline) { socket.emit('system_message', `PR #${id} needs an approval from another dev first.`); return; }
      pr.status = 'merged';
      gameState.decorations[`slot${pr.slot}`] = { item: pr.item, color: pr.color };
      io.emit('pull_requests', pullRequestsPayload(`${reviewer} merged PR #${id}: slot ${pr.slot} is now a ${pr.item}!`));
    } else if (action === 'close') {
      pr.status = 'closed';
      io.emit('pull_requests', pullRequestsPayload(`${reviewer} closed PR #${id}.`));
    }
  });

  // Keynote Amphitheater live stream
  socket.on('stream_set', ({ url, title } = {}) => {
    if (!developer()) return;
    if (url === null) { gameState.stream = null; io.emit('stream', null); io.emit('system_message', `${developer().devTag} ended the live stream. The screen is back to the keynote playlist.`); return; }
    const host = (socket.handshake.headers.host || 'localhost').split(':')[0];
    const embedUrl = toEmbedUrl(url, host);
    if (!embedUrl) { socket.emit('system_message', 'Only YouTube and Twitch links are supported.'); return; }
    gameState.stream = { embedUrl, title: cleanText(title, 40) || 'Tech Keynote', by: developer().devTag };
    io.emit('stream', gameState.stream);
  });

  // Green-Tech Sandbox community trees
  socket.on('plant_tree', (position) => {
    const clean = sanitizePosition(position);
    if (!developer() || !clean) return;
    const planted = gameState.trees.filter((tree) => tree.devTag === developer().devTag).length;
    if (planted >= 10) { socket.emit('system_message', 'You already planted 10 trees. Let them grow!'); return; }
    gameState.trees = [...gameState.trees, { ...clean, devTag: developer().devTag }].slice(-150);
    io.emit('trees', gameState.trees);
    io.emit('system_message', `${developer().devTag} planted a tree in the Green-Tech Sandbox. Renewable energy: ${Math.min(100, 40 + gameState.trees.length * 2)}%`);
  });

  // Gravity Flip tower reward: a rare wearable, at most once every 30 minutes
  socket.on('tower_reward', () => {
    const dev = developer();
    if (!dev) return;
    const now = Date.now();
    if (now - (account.lastTowerReward || 0) < 30 * 60 * 1000) { socket.emit('system_message', '🏆 You already claimed the Gravity Flip reward. Come back in 30 minutes!'); return; }
    if (account.inventory.length >= MAX_INVENTORY) { socket.emit('system_message', 'Your inventory is full. Use or /drop something first.'); return; }
    account.lastTowerReward = now;
    account.inventory.push({ id: 'hoodie', foundAt: now });
    account.coins = walletOf(account) + 50;
    socket.emit('wallet', { coins: account.coins, earned: 50, reason: 'Gravity Flip reward' });
    saveAccounts();
    socket.emit('inventory', account.inventory);
    socket.emit('loot_result', { item: 'hoodie', from: 'drop' });
    io.to(room).emit('system_message', `🏆 ${dev.devTag} conquered the Gravity Flip tower and earned an Epic Senior Dev Hoodie!`);
  });

  // Vehicles from the Hypercar Showroom, shown to everyone in the lobby
  // Hotels: sleep in a bed at night; when at least half of the online devs are
  // asleep the night is skipped for everyone (like Minecraft)
  socket.on('sleep', (sleeping) => {
    const dev = developer();
    if (!dev) return;
    const ticks = currentTicks();
    const night = ticks > 12500 && ticks < 23500;
    if (sleeping && !night) { socket.emit('system_message', '🛏️ You can only sleep at night. Your spawn point was set to this bed.'); return; }
    dev.sleeping = !!sleeping;
    if (!sleeping) return;
    const online = Object.values(activeDevelopers);
    const asleep = online.filter((other) => other.sleeping).length;
    const needed = Math.max(1, Math.ceil(online.length / 2));
    if (asleep < needed) { io.emit('system_message', `🛏️ ${dev.devTag} is sleeping (${asleep}/${needed} devs needed to skip the night).`); return; }
    worldState.ticks = 0;
    worldState.changedAt = Date.now();
    online.forEach((other) => { other.sleeping = false; });
    io.emit('world_state', worldStatePayload({ by: dev.devTag, kind: 'time' }));
    io.emit('system_message', '🌅 Enough devs slept through the night. Good morning, Genesis City!');
    io.emit('wake_up');
  });

  // Codify: code blocks are private by default; only blocks the owner chose to
  // share are relayed to the devs of the same lobby (and to newcomers)
  socket.emit('code_blocks', [...sharedCodeBlocks.values()].filter((block) => block.room === room).map((block) => block.data));
  socket.on('code_block_share', (data) => {
    const dev = developer();
    if (!dev || !data || typeof data.id !== 'string' || typeof data.code !== 'string') return;
    const id = data.id.slice(0, 60);
    const existing = sharedCodeBlocks.get(id);
    if (existing && existing.socketId !== socket.id) return;
    const position = data.position || {};
    const clean = {
      id,
      owner: dev.devTag,
      language: String(data.language || 'javascript').replace(/[^a-z]/g, '').slice(0, 12),
      code: data.code.slice(0, 4000),
      position: { x: Number(position.x) || 0, y: Number(position.y) || 0, z: Number(position.z) || 0 }
    };
    if (!existing && [...sharedCodeBlocks.values()].filter((block) => block.socketId === socket.id).length >= 10) return;
    sharedCodeBlocks.set(id, { socketId: socket.id, room, data: clean });
    socket.to(room).emit('code_block', clean);
  });
  socket.on('code_block_remove', (id) => {
    const block = sharedCodeBlocks.get(id);
    if (!block || block.socketId !== socket.id) return;
    sharedCodeBlocks.delete(id);
    socket.to(room).emit('code_block_remove', id);
  });

  // Economy: wallet, land parcels and transfers between devs
  socket.emit('wallet', { coins: walletOf(account) });
  socket.emit('lands', accounts.lands);
  socket.on('buy_land', ({ parcel } = {}) => {
    const dev = developer();
    if (!dev || typeof parcel !== 'string' || !/^-?\d{1,3},-?\d{1,3}$/.test(parcel)) return;
    const [px, pz] = parcel.split(',').map(Number);
    if (Math.abs(px) > MAX_PARCEL || Math.abs(pz) > MAX_PARCEL) { socket.emit('system_message', 'That parcel is outside Genesis City.'); return; }
    if (accounts.lands[parcel]) { socket.emit('system_message', `Parcel ${parcel} already belongs to ${accounts.lands[parcel].owner}.`); return; }
    if (walletOf(account) < LAND_PRICE) { socket.emit('system_message', `You need ${LAND_PRICE} MVC to buy a parcel (you have ${account.coins}). Earn coins with commits, chests and supply drops.`); return; }
    account.coins -= LAND_PRICE;
    accounts.lands[parcel] = { owner: account.username, boughtAt: Date.now() };
    saveAccounts();
    socket.emit('wallet', { coins: account.coins, spent: LAND_PRICE, reason: `parcel ${parcel}` });
    io.emit('lands', accounts.lands);
    io.emit('system_message', `🏡 ${dev.devTag} bought parcel ${parcel} in Genesis City!`);
  });
  socket.on('pay', ({ to, amount } = {}) => {
    const dev = developer();
    const value = Math.floor(Number(amount));
    if (!dev || typeof to !== 'string' || !(value >= 1 && value <= 100000)) return;
    const target = accounts.users[to.toLowerCase()];
    if (!target || target === account) { socket.emit('system_message', 'Unknown developer.'); return; }
    if (walletOf(account) < value) { socket.emit('system_message', `Not enough MVC (you have ${account.coins}).`); return; }
    account.coins -= value;
    target.coins = walletOf(target) + value;
    saveAccounts();
    socket.emit('wallet', { coins: account.coins, spent: value, reason: `payment to ${target.username}` });
    Object.entries(activeDevelopers).forEach(([id, other]) => {
      if (other.devTag.toLowerCase() !== target.username.toLowerCase()) return;
      io.to(id).emit('wallet', { coins: target.coins, earned: value, reason: `payment from ${account.username}` });
    });
  });

  socket.on('set_vehicle', (key) => {
    const dev = developer();
    if (!dev) return;
    dev.vehicle = VEHICLES.has(key) ? key : null;
    io.to(room).emit('peer_updated', { id: socket.id, devTag: dev.devTag, vehicle: dev.vehicle });
  });

  // Roblox-style emotes, relayed to the lobby
  socket.on('emote', (emote) => {
    if (!developer() || !EMOTES.has(emote)) return;
    socket.to(room).emit('peer_emote', { id: socket.id, emote });
  });

  // Simulated work: every commit from a laptop is counted on the account
  socket.on('commit', ({ lines } = {}) => {
    const dev = developer();
    const now = Date.now();
    if (!dev || !(lines >= 3) || now - (dev.lastCommitAt || 0) < 5000) return;
    dev.lastCommitAt = now;
    account.commits = (account.commits || 0) + 1;
    account.coins = walletOf(account) + 3;
    socket.emit('wallet', { coins: account.coins, earned: 3, reason: 'commit' });
    saveAccounts();
    io.to(room).emit('system_message', `✔ ${dev.devTag} pushed commit #${account.commits} from a laptop (${Math.min(999, Math.floor(lines))} lines).`);
    io.emit('commit_leaderboard', commitLeaderboard());
  });

  // Sent by the client once its loot catalog is loaded
  socket.on('loot_sync', () => {
    socket.emit('loot_spawns', publicLoot());
    socket.emit('inventory', account.inventory);
  });

  // Loot: open a chest or supply drop next to your cursor
  socket.on('loot_open', ({ id } = {}) => {
    const loot = lootSpawns[id];
    const dev = developer();
    if (!dev || !loot) return;
    if (loot.openUntil > Date.now()) { socket.emit('system_message', 'Someone already looted this one.'); return; }
    if (loot.landsAt && loot.landsAt > Date.now()) { socket.emit('system_message', 'The supply drop is still falling!'); return; }
    if (Math.hypot(dev.position.x - loot.x, dev.position.z - loot.z) > LOOT_REACH) { socket.emit('system_message', 'Get closer to open it.'); return; }
    if (account.inventory.length >= MAX_INVENTORY) { socket.emit('system_message', `Your inventory is full (${MAX_INVENTORY}). Use or /drop something first.`); return; }

    const item = rollItem(loot.kind);
    account.inventory.push({ id: item.id, foundAt: Date.now() });
    const bonus = loot.kind === 'drop' ? 25 : 5;
    account.coins = walletOf(account) + bonus;
    socket.emit('wallet', { coins: account.coins, earned: bonus, reason: loot.kind === 'drop' ? 'supply drop' : 'chest' });
    saveAccounts();
    socket.emit('inventory', account.inventory);
    socket.emit('loot_result', { item: item.id, from: loot.kind });
    if (loot.kind === 'drop') {
      delete lootSpawns[id];
      io.emit('loot_removed', id);
    } else {
      loot.openUntil = Date.now() + CHEST_RESPAWN_MS;
      io.emit('loot_state', { id, open: true });
      setTimeout(() => io.emit('loot_state', { id, open: false }), CHEST_RESPAWN_MS);
    }
    if (item.rarity === 'legendary' || item.rarity === 'epic') {
      io.emit('system_message', `✨ ${dev.devTag} found a ${lootTable.rarities[item.rarity].name.toUpperCase()} ${item.name}!`);
    }
  });

  socket.on('item_use', ({ index } = {}) => {
    const dev = developer();
    const entry = account.inventory[index];
    const item = entry && lootTable.items.find((candidate) => candidate.id === entry.id);
    if (!dev || !item) return;
    if (item.kind === 'consumable') {
      account.inventory.splice(index, 1);
      saveAccounts();
      if (item.effect === 'lens') dev.lensUntil = Date.now() + item.seconds * 1000;
    }
    if (item.kind === 'wearable') {
      dev.wearable = dev.wearable === item.wearable ? null : item.wearable;
      io.to(room).emit('peer_updated', { id: socket.id, devTag: dev.devTag, wearable: dev.wearable });
    }
    socket.emit('inventory', account.inventory);
    socket.emit('item_effect', { item: item.id });
  });

  socket.on('item_drop', ({ index } = {}) => {
    if (!developer() || !account.inventory[index]) return;
    account.inventory.splice(index, 1);
    saveAccounts();
    socket.emit('inventory', account.inventory);
  });

  // Clean-up memory garbage collection sequence triggers when a laptop connection drops down
  socket.on('disconnect', () => {
    if (developer()) {
      console.log(`[NETWORK] Developer disconnected: ${developer().devTag}`);
      delete activeDevelopers[socket.id];
      io.to(room).emit('developer_left_network', socket.id);
      sharedCodeBlocks.forEach((block, id) => {
        if (block.socketId !== socket.id) return;
        sharedCodeBlocks.delete(id);
        io.to(room).emit('code_block_remove', id);
      });
    }
  });
});

// Utility function creating visual styling standards for distinct arrow meshes profiles
function getRandomPastelColor() {
  const pastelColors = ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#ff9aa2', '#a8e6cf'];
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

// Live data for the Tech Square billboards (GitHub, stocks, dev trends)
if (process.env.DISABLE_FEEDS !== '1') {
  TechFeeds.start({
    onUpdate: (snapshot) => io.emit('tech_feeds', snapshot),
    onHighlight: (highlight) => io.emit('feed_highlight', highlight)
  });
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`[ENGINE ACTIVE] GitHub Multiverse cluster rendering successfully deployed on: http://localhost:${PORT}`);
});
