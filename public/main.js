// ============================================================================
// GLOBAL RENDER ENGINE & NETWORK MEMORY STATE REGISTRIES
// ============================================================================
const PARCEL_SIZE = 16; // Decentraland-style parcels: 16m x 16m land plots
const LAND_LEVEL = -1.2; // Endless land surface the world maps are built on top of
const CURSOR_EMIT_INTERVAL_MS = 50;
const CHAT_BUBBLE_DURATION_MS = 6000;
const CAMERA_WALK_SPEED = 18;

let scene, camera, renderer, controls;
let worldGroup, landMesh, parcelGrid;
let worldRegistry = [];
let currentWorldKey = null;
let worldLoadToken = 0;
let lastPopulation = {};

let localDeveloperData = null;
let localCursor = null;
const remoteMeshPointers = {};
const interactiveMeshes = [];

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const clock = new THREE.Clock();
const keysPressed = new Set();
let pointerInsideCanvas = false;
let pointerDownAt = null;
let hoveredBlock = null;
let lastEmitTime = 0;
const lastEmittedPosition = new THREE.Vector3(Infinity, Infinity, Infinity);

// Socket.io only exists when served by server.js; static hosts (e.g. Vercel) fall back to solo mode
const socket = typeof io === 'function' ? io() : null;

const ui = {
  overlay: document.getElementById('ui-overlay-container'),
  world: document.getElementById('hud-world'),
  parcel: document.getElementById('hud-parcel'),
  devTag: document.getElementById('hud-devtag'),
  connection: document.getElementById('hud-connection'),
  connectionDot: document.getElementById('connection-dot'),
  online: document.getElementById('hud-online'),
  worldsList: document.getElementById('worlds-list'),
  chatLog: document.getElementById('chat-log'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  tooltip: document.getElementById('hover-tooltip'),
  infoCard: document.getElementById('info-card'),
  infoTitle: document.getElementById('info-title'),
  infoType: document.getElementById('info-type'),
  infoClose: document.getElementById('info-close')
};

// ============================================================================
// ENGINE BOOTSTRAP
// ============================================================================
function initEngine() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#110f1a');
  scene.fog = new THREE.Fog('#110f1a', 70, 240);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 18, 28);

  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444466, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(18, 30, 14);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -35;
  directionalLight.shadow.camera.right = 35;
  directionalLight.shadow.camera.top = 35;
  directionalLight.shadow.camera.bottom = -35;
  directionalLight.shadow.camera.far = 100;
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI / 2.08;
  controls.update();

  buildLand();

  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  localCursor = createCursorRecord('Dev_....', '#c7ceea', true);

  bindInputEvents();
  animate();
}

// Endless land with parcel lines around every world, like the Decentraland map
function buildLand() {
  landMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: '#1b1828', roughness: 1 })
  );
  landMesh.rotation.x = -Math.PI / 2;
  landMesh.position.y = LAND_LEVEL;
  landMesh.receiveShadow = true;
  scene.add(landMesh);

  parcelGrid = new THREE.GridHelper(PARCEL_SIZE * 40, 40, 0xffffff, 0xffffff);
  parcelGrid.position.y = LAND_LEVEL + 0.01;
  parcelGrid.material.transparent = true;
  parcelGrid.material.opacity = 0.12;
  scene.add(parcelGrid);
}

function applyWorldPalette(backgroundHex) {
  const background = new THREE.Color(backgroundHex);
  const hsl = {};
  background.getHSL(hsl);
  const isBright = hsl.l > 0.5;

  scene.background = background;
  scene.fog.color.copy(background);
  landMesh.material.color.copy(background).lerp(new THREE.Color(isBright ? '#5c6578' : '#ffffff'), isBright ? 0.45 : 0.06);
  parcelGrid.material.color.set(isBright ? '#000000' : '#ffffff');
  parcelGrid.material.opacity = isBright ? 0.15 : 0.12;
}

// ============================================================================
// WORLD INSTANCES (MAP JSON LOADING)
// ============================================================================
async function loadWorldRegistry() {
  const response = await fetch('maps/worlds.json');
  worldRegistry = await response.json();
  renderWorldList({});
}

function findWorld(worldKey) {
  return worldRegistry.find((world) => world.key === worldKey);
}

function renderWorldList(population) {
  ui.worldsList.innerHTML = '';
  worldRegistry.forEach((world) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.title = world.description;
    button.className = world.key === currentWorldKey ? 'active' : '';

    const name = document.createElement('span');
    name.textContent = world.name;
    const count = document.createElement('small');
    count.textContent = population[world.key] ? `${population[world.key]} online` : `/${world.key}`;

    button.append(name, count);
    button.addEventListener('click', () => enterWorld(world.key));
    item.appendChild(button);
    ui.worldsList.appendChild(item);
  });
}

async function enterWorld(worldKey) {
  const world = findWorld(worldKey);
  if (!world) {
    appendSystemMessage(`Unknown world "${worldKey}". Type /worlds to list them.`);
    return;
  }
  if (worldKey === currentWorldKey) return;

  currentWorldKey = worldKey;
  if (location.hash !== `#${worldKey}`) history.replaceState(null, '', `#${worldKey}`);

  // Peers belong to the world instance we are leaving; the server syncs the new ones
  if (socket && localDeveloperData && localDeveloperData.activeWorld !== worldKey) {
    clearRemotePeers();
    localDeveloperData.activeWorld = worldKey;
    socket.emit('user_changed_world_instance', worldKey);
  }

  localCursor.mesh.position.set(0, 1, 0);
  localCursor.target.set(0, 1, 0);
  controls.target.set(0, 0, 0);
  camera.position.set(0, 18, 28);

  ui.world.textContent = world.name;
  renderWorldList(lastPopulation);
  updateOnlineCounter();

  await loadSpecificWorldInstance(`maps/${world.file}`);
  appendSystemMessage(`You jumped into ${world.name}.`);
}

async function loadSpecificWorldInstance(mapFilePath) {
  const loadToken = ++worldLoadToken;
  try {
    const networkResponse = await fetch(mapFilePath);
    const mapConfigData = await networkResponse.json();
    if (loadToken !== worldLoadToken) return; // A newer world was requested meanwhile

    clearWorldGeometry();
    document.title = `GitVerse - ${mapConfigData.themeName}`;
    applyWorldPalette(mapConfigData.backgroundColor);

    mapConfigData.blocks.forEach((blockData) => {
      worldGroup.add(buildBlockMesh(blockData));
    });
  } catch (runtimeError) {
    console.error('Critical rendering failure processing selected world instance geometry:', runtimeError);
    appendSystemMessage(`Could not load ${mapFilePath}.`);
  }
}

function buildBlockMesh(blockData) {
  const [sizeX, sizeY, sizeZ] = toVector(blockData.scale, 1);
  const [coordinateX, coordinateY, coordinateZ] = toVector(blockData.position, 0);
  const type = blockData.type || 'block';

  const material = new THREE.MeshStandardMaterial({
    color: blockData.color,
    roughness: 0.55,
    metalness: 0.05
  });
  // Small visual hints derived from the block type name
  if (/water|glass/.test(type)) {
    material.transparent = true;
    material.opacity = /water/.test(type) ? 0.75 : 0.45;
  }
  if (/neon|hologram|screen|monitor|teleport|waterfall/.test(type)) {
    material.emissive = new THREE.Color(blockData.color);
    material.emissiveIntensity = 0.55;
  }

  const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), material);
  blockMesh.position.set(coordinateX, coordinateY, coordinateZ);
  blockMesh.castShadow = true;
  blockMesh.receiveShadow = true;
  blockMesh.userData = { label: blockData.label || null, type };

  interactiveMeshes.push(blockMesh);
  return blockMesh;
}

function toVector(value, fallback) {
  if (Array.isArray(value) && value.length === 3) return value;
  if (typeof value === 'number') return [value, value, value];
  return [fallback || 1, fallback || 1, fallback || 1];
}

function clearWorldGeometry() {
  worldGroup.children.slice().forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
    worldGroup.remove(mesh);
  });
  interactiveMeshes.length = 0;
  hoveredBlock = null;
  ui.tooltip.style.display = 'none';
}

// ============================================================================
// REAL-TIME 3D CURSOR MULTIPLAYER GEOMETRIES MAPPING
// ============================================================================
function create3DMousePointerMesh(hexagonalColor) {
  const pointerGroup = new THREE.Group();

  // Classic arrow cursor outline; the tip sits at the group origin
  const outline = [[0, 0], [0, -1.6], [0.38, -1.22], [0.66, -1.86], [0.92, -1.74], [0.64, -1.12], [1.14, -1.12]];
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  outline.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();

  const arrowGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2
  });
  arrowGeometry.translate(0, 0, -0.11);

  const arrowMesh = new THREE.Mesh(arrowGeometry, new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexagonalColor),
    roughness: 0.3,
    metalness: 0.1
  }));
  arrowMesh.castShadow = true;
  arrowMesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(arrowGeometry, 30),
    new THREE.LineBasicMaterial({ color: 0x1d1b26 })
  ));

  // The arrow floats above a flat ring marking the exact spot it points at
  const arrowPivot = new THREE.Group();
  arrowPivot.add(arrowMesh);
  arrowPivot.position.y = 0.25;
  pointerGroup.add(arrowPivot);

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.38, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(hexagonalColor), transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.03;
  pointerGroup.add(ringMesh);

  pointerGroup.userData.arrowPivot = arrowPivot;
  pointerGroup.scale.setScalar(1.5);
  return pointerGroup;
}

function createDeveloperHTMLOverlayTag(devTag, pastelColor) {
  const overlayNode = document.createElement('div');
  overlayNode.className = 'dev-floating-tag';
  overlayNode.textContent = devTag;
  overlayNode.style.border = `1px solid ${pastelColor}`;
  ui.overlay.appendChild(overlayNode);
  return overlayNode;
}

function createCursorRecord(devTag, color, isLocal) {
  const mesh = create3DMousePointerMesh(color);
  mesh.position.set(0, 1, 0);
  scene.add(mesh);

  return {
    mesh,
    target: mesh.position.clone(),
    domElement: createDeveloperHTMLOverlayTag(isLocal ? `${devTag} (you)` : devTag, color),
    bubble: null,
    bubbleTimer: null,
    isLocal
  };
}

function restyleLocalCursor(devTag, color) {
  disposeCursorRecord(localCursor);
  const position = localCursor.mesh.position.clone();
  localCursor = createCursorRecord(devTag, color, true);
  localCursor.mesh.position.copy(position);
  localCursor.target.copy(position);
}

function disposeCursorRecord(record) {
  scene.remove(record.mesh);
  record.mesh.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
  });
  record.domElement.remove();
  if (record.bubble) record.bubble.remove();
  clearTimeout(record.bubbleTimer);
}

function instantiateNetworkPeerCursor(peerData) {
  if (!localDeveloperData || peerData.id === localDeveloperData.id) return;
  if (peerData.activeWorld !== localDeveloperData.activeWorld) return;
  if (remoteMeshPointers[peerData.id]) return;

  const record = createCursorRecord(peerData.devTag, peerData.color, false);
  record.metadata = peerData;
  record.mesh.position.set(peerData.position.x, peerData.position.y, peerData.position.z);
  record.target.copy(record.mesh.position);
  remoteMeshPointers[peerData.id] = record;
  updateOnlineCounter();
}

function removeNetworkPeerCursor(peerId) {
  const record = remoteMeshPointers[peerId];
  if (!record) return;
  disposeCursorRecord(record);
  delete remoteMeshPointers[peerId];
  updateOnlineCounter();
}

function clearRemotePeers() {
  Object.keys(remoteMeshPointers).forEach(removeNetworkPeerCursor);
}

function projectToScreen(record) {
  const anchor = record.mesh.position.clone();
  anchor.y += 3.2;
  anchor.project(camera);

  const isVisible = anchor.z < 1 && Math.abs(anchor.x) < 1.2 && Math.abs(anchor.y) < 1.2;
  const left = `${(anchor.x * 0.5 + 0.5) * window.innerWidth}px`;
  const top = `${(anchor.y * -0.5 + 0.5) * window.innerHeight}px`;

  [record.domElement, record.bubble].forEach((element) => {
    if (!element) return;
    element.style.display = isVisible ? 'block' : 'none';
    element.style.left = left;
    element.style.top = top;
  });
}

function showChatBubble(record, text) {
  if (!record.bubble) {
    record.bubble = document.createElement('div');
    record.bubble.className = 'chat-bubble';
    ui.overlay.appendChild(record.bubble);
  }
  record.bubble.textContent = text;
  record.bubble.style.opacity = '1';

  clearTimeout(record.bubbleTimer);
  record.bubbleTimer = setTimeout(() => {
    if (!record.bubble) return;
    record.bubble.remove();
    record.bubble = null;
  }, CHAT_BUBBLE_DURATION_MS);
}

// ============================================================================
// LOCAL INPUT: CURSOR RAYCASTING, CAMERA WALKING & OBJECT INSPECTION
// ============================================================================
function bindInputEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointermove', (event) => {
    pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
    pointerInsideCanvas = true;
    ui.tooltip.style.left = `${event.clientX}px`;
    ui.tooltip.style.top = `${event.clientY}px`;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInsideCanvas = false;
    ui.tooltip.style.display = 'none';
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDownAt) return;
    const dragDistance = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (dragDistance < 5 && hoveredBlock) openInfoCard(hoveredBlock.userData);
  });

  window.addEventListener('keydown', (event) => {
    if (document.activeElement === ui.chatInput) {
      if (event.key === 'Escape') ui.chatInput.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      ui.chatInput.focus();
      return;
    }
    if (event.key === 'Escape') closeInfoCard();
    keysPressed.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => keysPressed.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keysPressed.clear());

  ui.infoClose.addEventListener('click', closeInfoCard);
  ui.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = ui.chatInput.value.trim();
    ui.chatInput.value = '';
    if (text) handleChatInput(text);
  });

  window.addEventListener('hashchange', () => {
    const worldKey = location.hash.slice(1);
    if (worldKey) enterWorld(worldKey);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateLocalCursorFromPointer() {
  if (!pointerInsideCanvas) return;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects([...interactiveMeshes, landMesh], false);
  const hit = hits.find((candidate) => candidate.object.visible);

  hoveredBlock = hit && hit.object.userData.label ? hit.object : null;
  renderer.domElement.style.cursor = hit ? (hoveredBlock ? 'pointer' : 'none') : 'default';
  if (hoveredBlock) {
    ui.tooltip.textContent = hoveredBlock.userData.label;
    ui.tooltip.style.display = 'block';
  } else {
    ui.tooltip.style.display = 'none';
  }

  if (!hit) return;
  localCursor.target.copy(hit.point);
  ui.parcel.textContent = `${Math.floor(hit.point.x / PARCEL_SIZE)},${Math.floor(-hit.point.z / PARCEL_SIZE)}`;
}

function walkCamera(deltaSeconds) {
  const forwardInput = (keysPressed.has('w') || keysPressed.has('arrowup') ? 1 : 0) - (keysPressed.has('s') || keysPressed.has('arrowdown') ? 1 : 0);
  const strafeInput = (keysPressed.has('d') || keysPressed.has('arrowright') ? 1 : 0) - (keysPressed.has('a') || keysPressed.has('arrowleft') ? 1 : 0);
  if (!forwardInput && !strafeInput) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

  const step = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(strafeInput));
  step.normalize().multiplyScalar(CAMERA_WALK_SPEED * deltaSeconds);
  camera.position.add(step);
  controls.target.add(step);
}

function broadcastLocalTransformUpdate() {
  if (!socket || !socket.connected || !localDeveloperData) return;

  const now = performance.now();
  if (now - lastEmitTime < CURSOR_EMIT_INTERVAL_MS) return;
  if (lastEmittedPosition.distanceToSquared(localCursor.target) < 0.0004) return;

  lastEmitTime = now;
  lastEmittedPosition.copy(localCursor.target);
  socket.emit('update_cursor_transform', {
    position: { x: localCursor.target.x, y: localCursor.target.y, z: localCursor.target.z }
  });
}

function openInfoCard(userData) {
  ui.infoTitle.textContent = userData.label;
  ui.infoType.textContent = `${userData.type} · ${findWorld(currentWorldKey).name}`;
  ui.infoCard.style.display = 'block';
}

function closeInfoCard() {
  ui.infoCard.style.display = 'none';
}

// ============================================================================
// CHAT INTERPRETER & INSTANCE NAVIGATOR CONTROLLERS
// ============================================================================
function handleChatInput(text) {
  if (text.startsWith('/')) {
    interpretChatCommand(text);
    return;
  }
  if (!localDeveloperData) {
    appendSystemMessage('Still connecting to the multiverse, try again in a moment.');
  } else if (socket && socket.connected) {
    socket.emit('chat_message', text);
  } else {
    displayChatMessage({ id: localDeveloperData.id, devTag: localDeveloperData.devTag, color: localDeveloperData.color, text });
  }
}

function interpretChatCommand(inputBuffer) {
  const [command, ...args] = inputBuffer.slice(1).split(/\s+/);
  switch (command.toLowerCase()) {
    case 'world':
    case 'goto':
      if (!args[0]) {
        appendSystemMessage(`Usage: /world <name>. Worlds: ${worldRegistry.map((world) => world.key).join(', ')}`);
      } else {
        enterWorld(args[0].toLowerCase());
      }
      break;
    case 'worlds':
      appendSystemMessage(`Worlds: ${worldRegistry.map((world) => world.key).join(', ')}`);
      break;
    case 'who': {
      const names = Object.values(remoteMeshPointers).map((record) => record.metadata.devTag);
      appendSystemMessage(names.length ? `Here with you: ${names.join(', ')}` : 'Nobody else is in this world right now.');
      break;
    }
    case 'clear':
      ui.chatLog.innerHTML = '';
      break;
    case 'help':
      appendSystemMessage('Commands: /world <name>, /worlds, /who, /clear, /help');
      break;
    default:
      appendSystemMessage(`Unknown command "/${command}". Type /help.`);
  }
}

function displayChatMessage(message) {
  const item = document.createElement('li');
  const author = document.createElement('span');
  author.className = 'author';
  author.style.color = message.color;
  author.textContent = `${message.devTag}: `;
  item.append(author, document.createTextNode(message.text));
  appendChatItem(item);

  const isLocal = localDeveloperData && message.id === localDeveloperData.id;
  const record = isLocal ? localCursor : remoteMeshPointers[message.id];
  if (record) showChatBubble(record, message.text);
}

function appendSystemMessage(text) {
  const item = document.createElement('li');
  item.className = 'system';
  item.textContent = text;
  appendChatItem(item);
}

function appendChatItem(item) {
  ui.chatLog.appendChild(item);
  while (ui.chatLog.children.length > 100) ui.chatLog.firstChild.remove();
  ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

// ============================================================================
// NETWORK LAYER LISTENERS COUPLING
// ============================================================================
function setConnectionStatus(state, label) {
  ui.connectionDot.className = state;
  ui.connection.textContent = label;
}

function updateOnlineCounter() {
  const peersHere = Object.keys(remoteMeshPointers).length + 1;
  ui.online.textContent = `${peersHere} here`;
}

function registerLocalDeveloper(identity) {
  localDeveloperData = identity;
  ui.devTag.textContent = identity.devTag;
  restyleLocalCursor(identity.devTag, identity.color);
}

function setupNetwork() {
  if (!socket) {
    setConnectionStatus('offline', 'Solo mode (no server)');
    const uniqueId = Math.floor(1000 + Math.random() * 9000);
    registerLocalDeveloper({ id: 'local', devTag: `Dev_${uniqueId}`, color: '#b5ead7', activeWorld: null });
    appendSystemMessage('Multiplayer server not found: run "npm start" to explore with other devs.');
    return;
  }

  socket.on('connect', () => setConnectionStatus('online', 'Connected'));
  socket.on('disconnect', () => {
    setConnectionStatus('offline', 'Reconnecting...');
    clearRemotePeers();
  });

  socket.on('local_registration_success', (assignedIdentity) => {
    clearRemotePeers();
    registerLocalDeveloper(assignedIdentity);
    lastEmittedPosition.set(Infinity, Infinity, Infinity);
    console.log(`[CORE] Connected to multiverse as local node: ${assignedIdentity.devTag}`);

    // Every (re)connection lands in the default world; move back to the one being explored
    if (currentWorldKey && currentWorldKey !== assignedIdentity.activeWorld) {
      localDeveloperData.activeWorld = currentWorldKey;
      socket.emit('user_changed_world_instance', currentWorldKey);
    }
  });

  socket.on('sync_entire_developer_pool', ({ world, developers }) => {
    if (!localDeveloperData || world !== localDeveloperData.activeWorld) return;
    developers.forEach(instantiateNetworkPeerCursor);
  });

  socket.on('new_developer_joined', (incomingPeerData) => {
    instantiateNetworkPeerCursor(incomingPeerData);
    if (remoteMeshPointers[incomingPeerData.id]) appendSystemMessage(`${incomingPeerData.devTag} joined this world.`);
  });

  socket.on('peer_cursor_transformed', (transformUpdate) => {
    const peerRecord = remoteMeshPointers[transformUpdate.id];
    if (peerRecord) {
      peerRecord.target.set(transformUpdate.position.x, transformUpdate.position.y, transformUpdate.position.z);
    }
  });

  socket.on('developer_left_network', removeNetworkPeerCursor);

  socket.on('chat_message', displayChatMessage);

  socket.on('world_population', (population) => {
    lastPopulation = population;
    renderWorldList(population);
  });
}

// ============================================================================
// RUNTIME ENGINE LOOP ANIMATION LOOP
// ============================================================================
function animate() {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  const smoothing = 1 - Math.exp(-deltaSeconds * 14);

  walkCamera(deltaSeconds);
  controls.update();
  updateLocalCursorFromPointer();
  broadcastLocalTransformUpdate();

  [localCursor, ...Object.values(remoteMeshPointers)].forEach((record, index) => {
    record.mesh.position.lerp(record.target, smoothing);
    // Keep the arrow facing the camera and gently bobbing above its target point
    record.mesh.rotation.y = Math.atan2(camera.position.x - record.mesh.position.x, camera.position.z - record.mesh.position.z);
    record.mesh.userData.arrowPivot.position.y = 0.25 + Math.sin(elapsed * 3 + index) * 0.08;
    projectToScreen(record);
  });

  renderer.render(scene, camera);
}

// Fire up the entire runtime infrastructure as soon as the overlay markup is parsed
initEngine();
setupNetwork();
loadWorldRegistry()
  .then(() => {
    const requestedWorld = location.hash.slice(1);
    enterWorld(findWorld(requestedWorld) ? requestedWorld : worldRegistry[0].key);
    appendSystemMessage('Welcome to GitVerse! Press Enter to chat, /help for commands.');
  })
  .catch((runtimeError) => {
    console.error('Could not load the worlds registry:', runtimeError);
    appendSystemMessage('Could not load maps/worlds.json.');
  });
