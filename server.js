const express = require('express');
const app = express();
const fs = require('fs');
const crypto = require('crypto');
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
  socket.emit('sync_entire_developer_pool', Object.values(activeDevelopers));
  socket.emit('world_state', worldStatePayload());
  socket.emit('game_state', publicGameState());
  socket.emit('loot_spawns', publicLoot());
  socket.emit('inventory', account.inventory);
  socket.broadcast.emit('new_developer_joined', activeDevelopers[socket.id]);

  const developer = () => activeDevelopers[socket.id];

  // Synchronizes real-time coordinates transform movements across the whole city
  socket.on('update_cursor_transform', (transformData) => {
    const position = sanitizePosition(transformData && transformData.position);
    if (!developer() || !position) return;
    developer().position = position;
    socket.broadcast.emit('peer_cursor_transformed', { id: socket.id, position });
  });

  socket.on('chat_message', (rawText) => {
    const text = cleanText(rawText, MAX_CHAT_LENGTH);
    if (!developer() || !text) return;
    io.emit('chat_message', { id: socket.id, devTag: developer().devTag, color: developer().color, text, timestamp: Date.now() });
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
    io.emit('peer_updated', { id: socket.id, devTag: developer().devTag, wearable: developer().wearable });
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
      io.emit('peer_updated', { id: socket.id, devTag: dev.devTag, wearable: dev.wearable });
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
      io.emit('developer_left_network', socket.id);
    }
  });
});

// Utility function creating visual styling standards for distinct arrow meshes profiles
function getRandomPastelColor() {
  const pastelColors = ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#ff9aa2', '#a8e6cf'];
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`[ENGINE ACTIVE] GitHub Multiverse cluster rendering successfully deployed on: http://localhost:${PORT}`);
});
