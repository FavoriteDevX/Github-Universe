const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path'); // Core module to handle absolute system directory paths smoothly
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PUBLIC_DIR = path.join(__dirname, 'public');

// Serves all static layout assets (index.html, scripts, maps JSON directories) nested inside public folder
app.use(express.static(PUBLIC_DIR));

const MAX_CHAT_LENGTH = 200;
const MAX_COORDINATE = 3000;
const TICKS_PER_SECOND = 20; // Minecraft pace: a full day lasts 20 minutes
const MONSTER_RESPAWN_MS = 30000;
const ALLOWED_DAMAGE = new Set([10, 15, 40]);
const DECOR_ITEMS = new Set(['tree', 'lamp', 'banner', 'fountain', 'duck', 'flag', 'neon', 'bench']);
const WEARABLES = new Set(['hoodie', 'mug', 'cap', 'headphones', 'hammer']);

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

// This manages every developer that connects to your multiverse environment cluster
io.on('connection', (socket) => {
  // Generates a unique 4-digit corporate dev tag identifier
  const uniqueId = Math.floor(1000 + Math.random() * 9000);
  const developerTag = `Dev_${uniqueId}`;

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

  socket.on('set_nick', (rawNick) => {
    const nick = typeof rawNick === 'string' ? rawNick.trim() : '';
    if (!developer() || !/^[A-Za-z0-9_]{3,16}$/.test(nick)) return;
    const taken = Object.values(activeDevelopers).some((peer) => peer.id !== socket.id && peer.devTag.toLowerCase() === nick.toLowerCase());
    if (taken) { socket.emit('system_message', `The name ${nick} is already taken.`); return; }
    developer().devTag = nick;
    io.emit('peer_updated', { id: socket.id, devTag: nick });
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
  console.log(`[ENGINE ACTIVE] GitVerse cluster rendering successfully deployed on: http://localhost:${PORT}`);
});
