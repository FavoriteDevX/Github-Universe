const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path'); // Core module to handle absolute system directory paths smoothly
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PUBLIC_DIR = path.join(__dirname, 'public');

// Serves all static layout assets (index.html, main.js, maps JSON directories) nested inside public folder
app.use(express.static(PUBLIC_DIR));

// World instances registry shared with the client (public/maps/worlds.json)
const worldRegistry = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'maps', 'worlds.json'), 'utf8'));
const validWorldKeys = new Set(worldRegistry.map((world) => world.key));
const DEFAULT_WORLD = worldRegistry[0].key;

const MAX_CHAT_LENGTH = 200;
const MAX_COORDINATE = 500;

// Active tracking memory for connected developers network clients
const activeDevelopers = {};

// Every world instance is a Socket.io room: peers only see and hear who is in the same world
function worldRoom(worldKey) {
  return `world:${worldKey}`;
}

function sanitizePosition(position) {
  if (!position || typeof position !== 'object') return null;
  const axes = ['x', 'y', 'z'].map((axis) => Number(position[axis]));
  if (axes.some((value) => !Number.isFinite(value))) return null;
  const [x, y, z] = axes.map((value) => Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value)));
  return { x, y, z };
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
    activeWorld: DEFAULT_WORLD
  };

  console.log(`[NETWORK] Developer registered: ${developerTag} (${socket.id})`);

  // Sends the local client its own developer registration metadata attributes
  socket.emit('local_registration_success', activeDevelopers[socket.id]);

  joinWorld(socket, DEFAULT_WORLD);

  // Synchronizes real-time coordinates transform movements across the same world instance
  socket.on('update_cursor_transform', (transformData) => {
    const developer = activeDevelopers[socket.id];
    const position = sanitizePosition(transformData && transformData.position);
    if (!developer || !position) return;

    developer.position = position;
    socket.to(worldRoom(developer.activeWorld)).emit('peer_cursor_transformed', {
      id: socket.id,
      position
    });
  });

  // Listener to catch when a user alters their world instance using chat commands or the world list
  socket.on('user_changed_world_instance', (worldKey) => {
    const developer = activeDevelopers[socket.id];
    if (!developer || !validWorldKeys.has(worldKey) || developer.activeWorld === worldKey) return;

    const previousWorld = developer.activeWorld;
    socket.leave(worldRoom(previousWorld));
    socket.to(worldRoom(previousWorld)).emit('developer_left_network', socket.id);

    joinWorld(socket, worldKey);
  });

  // Chat messages are spoken inside the current world and rendered as bubbles over the sender cursor
  socket.on('chat_message', (rawText) => {
    const developer = activeDevelopers[socket.id];
    if (!developer || typeof rawText !== 'string') return;

    const text = rawText.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;

    io.to(worldRoom(developer.activeWorld)).emit('chat_message', {
      id: socket.id,
      devTag: developer.devTag,
      color: developer.color,
      text,
      timestamp: Date.now()
    });

