// ============================================================================
// GITVERSE CLIENT: ENGINE, 3D CURSORS, TELEPORTS, MINIMAP, CHAT COMMANDS, NETWORK
// ============================================================================
const CURSOR_EMIT_INTERVAL_MS = 50;
const CHAT_BUBBLE_DURATION_MS = 7000;
const WALK_SPEED = 6;
const RUN_SPEED = 12;
const JUMP_SPEED = 10;
const GRAVITY = 26;
const STEP_HEIGHT = 1.15; // the avatar climbs stairs and ledges up to this height
const AVATAR_RADIUS = 0.6;
const MAP_VIEW = new THREE.Vector3(0, 170, 150);
const TICKS_PER_SECOND = 20; // Minecraft pace: a full day lasts 20 minutes
const MINIMAP_RADIUS = 180;

let scene, camera, renderer, controls;
let worldRegistry = [];
const places = []; // every teleport destination: districts + Silicon Valley landmarks

let localDeveloperData = null;
let localCursor = null;
let localWearable = null;
const remoteMeshPointers = {};

const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.05;
raycaster.params.Points.threshold = 0;
const pointerNDC = new THREE.Vector2();
const clock = new THREE.Clock();
const keysPressed = new Set();
let pointerInsideCanvas = false;
let pointerDirty = false;
let pointerDownAt = null;
let hoveredObject = null;
let hoverPoint = null;
let lastEmitTime = 0;
const lastEmittedPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
// The local 3D cursor is the avatar: it walks, jumps and climbs like a Decentraland avatar
const avatar = { position: new THREE.Vector3(0, 0, 0), velocityY: 0, grounded: true };
let viewMode = 'explore'; // 'explore' (third person) or 'map' (aerial overview)
const downRay = new THREE.Raycaster();
const wallRay = new THREE.Raycaster();
let lastWhisperFrom = null;
let pendingTeleportRequest = null;
let lightningUntil = 0;

const worldClock = { ticks: 1000, at: performance.now(), cycle: true, weather: 'clear' };

// Socket.io only exists when served by server.js; static hosts (e.g. Vercel) fall back to solo mode
const socket = typeof io === 'function' ? io() : null;

const ui = {
  overlay: document.getElementById('ui-overlay-container'),
  district: document.getElementById('hud-world'),
  parcel: document.getElementById('hud-parcel'),
  devTag: document.getElementById('hud-devtag'),
  clock: document.getElementById('hud-clock'),
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
  infoClose: document.getElementById('info-close'),
  minimap: document.getElementById('minimap'),
  streamModal: document.getElementById('stream-modal'),
  streamFrame: document.getElementById('stream-frame'),
  streamTitle: document.getElementById('stream-title'),
  streamClose: document.getElementById('stream-close'),
  flash: document.getElementById('lightning-flash')
};

// ============================================================================
// ENGINE BOOTSTRAP
// ============================================================================
function initEngine() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 2600);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 40;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 1.85;
  controls.rotateSpeed = 0.7;
  controls.addEventListener('change', () => { pointerDirty = true; });

  City.init(scene);
  localCursor = createCursorRecord('Dev_....', '#c7ceea', true);
  bindInputEvents();
  animate();
}

// ============================================================================
// WORLD LOADING: EVERY MAP BECOMES A DISTRICT OF ONE CONTINUOUS CITY
// ============================================================================
async function loadUniverse() {
  worldRegistry = await (await fetch('maps/worlds.json')).json();
  const maps = await Promise.all(worldRegistry.map((world) => fetch(`maps/${world.file}`).then((response) => response.json())));
  worldRegistry.forEach((world, index) => {
    try {
      const district = City.addDistrict(world, maps[index]);
      registerPlaces(district);
    } catch (error) {
      console.error(`Could not build ${world.file}:`, error);
      appendSystemMessage(`Could not build ${world.name}.`);
    }
  });
  City.finalize();
  renderWorldList();
}

function registerPlaces(district) {
  const { world, layout } = district;
  const view = world.view ? new THREE.Vector3(...world.view) : world.span ? new THREE.Vector3(0, 55, 75) : new THREE.Vector3(0, 30, 42);
  places.push({ key: world.key, name: world.name, description: world.description, target: layout.center.clone(), view, color: world.color });
  (world.places || []).forEach((place) => {
    places.push({
      key: place.key,
      name: place.name,
      parent: world.key,
      target: new THREE.Vector3(layout.center.x + place.at[0], 0, layout.center.z + place.at[1]),
      view: new THREE.Vector3(0, 45, 70),
      color: world.color
    });
  });
}

function findPlace(key) {
  const query = key.toLowerCase();
  return places.find((place) => place.key === query) || places.find((place) => place.name.toLowerCase().startsWith(query));
}

function renderWorldList() {
  const population = {};
  [localCursor, ...Object.values(remoteMeshPointers)].forEach((record) => {
    const district = City.districtAt(record.target.x, record.target.z);
    if (district) population[district.world.key] = (population[district.world.key] || 0) + 1;
  });
  ui.worldsList.innerHTML = '';
  places.forEach((place) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.title = place.description || place.name;
    if (place.parent) button.classList.add('sub-place');
    const name = document.createElement('span');
    name.textContent = place.name;
    const count = document.createElement('small');
    count.textContent = !place.parent && population[place.key] ? `${population[place.key]} here` : `/${place.key}`;
    button.append(name, count);
    button.addEventListener('click', () => teleportToPlace(place));
    item.appendChild(button);
    ui.worldsList.appendChild(item);
  });
}

// ============================================================================
// TELEPORTS & CAMERA FLIGHT
// ============================================================================
// Teleports the avatar (with a short white fade, like Decentraland's jump-in)
function flyTo(target, view, announce) {
  avatar.position.set(target.x, 0, target.z);
  avatar.position.y = groundHeightAt(target.x, target.z, Math.max(target.y, 0) + 80);
  avatar.velocityY = 0;
  localCursor.mesh.position.copy(avatar.position);
  setViewMode('explore');
  const behind = new THREE.Vector3(0, 4, 10);
  controls.target.copy(avatar.position).add(new THREE.Vector3(0, 1.8, 0));
  camera.position.copy(controls.target).add(behind);
  lightningUntil = performance.now() + 250;
  emitCursor(true);
  if (announce) appendSystemMessage(announce);
}

function setViewMode(mode) {
  viewMode = mode;
  if (mode === 'map') {
    controls.maxDistance = 600;
    controls.minDistance = 40;
    controls.maxPolarAngle = Math.PI / 2.3;
    controls.enablePan = true;
    controls.target.copy(avatar.position);
    camera.position.copy(avatar.position).add(MAP_VIEW);
    appendSystemMessage('Map view: click anywhere to jump there. Press M to walk again.');
  } else {
    controls.maxDistance = 40;
    controls.minDistance = 3;
    controls.maxPolarAngle = Math.PI / 1.85;
    controls.enablePan = false;
    if (camera.position.distanceTo(avatar.position) > 45) {
      controls.target.copy(avatar.position).add(new THREE.Vector3(0, 1.8, 0));
      camera.position.copy(controls.target).add(new THREE.Vector3(0, 4, 10));
    }
  }
}

// Highest walkable surface under (x, z), searching downward from fromY
function groundHeightAt(x, z, fromY) {
  downRay.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
  downRay.far = fromY + 50;
  const hit = downRay.intersectObjects(City.collidablesAt(x, z), true).find(isSolidHit);
  return hit ? hit.point.y : City.GROUND_LEVEL;
}

function isSolidHit(hit) {
  const object = hit.object;
  if (!object.visible || object.isSprite || object.isLine || object.isPoints) return false;
  const objectMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
  return !(objectMaterial && objectMaterial.opacity < 0.2);
}

// Walking physics: WASD relative to the camera, gravity, jumping, stairs and walls
function updateAvatar(deltaSeconds) {
  if (viewMode !== 'explore') return;
  const forwardInput = (keysPressed.has('w') || keysPressed.has('arrowup') ? 1 : 0) - (keysPressed.has('s') || keysPressed.has('arrowdown') ? 1 : 0);
  const strafeInput = (keysPressed.has('d') || keysPressed.has('arrowright') ? 1 : 0) - (keysPressed.has('a') || keysPressed.has('arrowleft') ? 1 : 0);
  const previous = avatar.position.clone();

  if (forwardInput || strafeInput) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const move = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(strafeInput)).normalize().multiplyScalar((keysPressed.has('shift') ? RUN_SPEED : WALK_SPEED) * deltaSeconds);
    // Try the full move, then slide along each axis when a wall blocks it
    [move, new THREE.Vector3(move.x, 0, 0), new THREE.Vector3(0, 0, move.z)].some((attempt) => {
      if (attempt.lengthSq() === 0 || isBlocked(attempt)) return false;
      avatar.position.add(attempt);
      return true;
    });
  }

  if (keysPressed.has(' ') && avatar.grounded) {
    avatar.velocityY = JUMP_SPEED;
    avatar.grounded = false;
  }
  avatar.velocityY -= GRAVITY * deltaSeconds;
  avatar.position.y += avatar.velocityY * deltaSeconds;

  const ground = groundHeightAt(avatar.position.x, avatar.position.z, Math.max(previous.y, avatar.position.y) + STEP_HEIGHT);
  if (avatar.position.y <= ground) {
    avatar.position.y = ground;
    avatar.velocityY = 0;
    avatar.grounded = true;
  } else {
    avatar.grounded = avatar.position.y - ground < 0.05;
  }
  if (avatar.position.y < City.GROUND_LEVEL - 20) flyTo(places[0].target, null, 'You fell out of the world. Back to spawn!');

  // The camera follows the avatar in third person
  const delta = avatar.position.clone().sub(previous);
  camera.position.add(delta);
  controls.target.copy(avatar.position).add(new THREE.Vector3(0, 1.8, 0));
  const cameraGround = groundHeightAt(camera.position.x, camera.position.z, camera.position.y + 1);
  if (camera.position.y < cameraGround + 0.6) camera.position.y = cameraGround + 0.6;
  localCursor.target.copy(avatar.position);
}

function isBlocked(move) {
  const direction = move.clone().normalize();
  for (const height of [STEP_HEIGHT + 0.1, 2.2]) {
    wallRay.set(avatar.position.clone().add(new THREE.Vector3(0, height, 0)), direction);
    wallRay.far = move.length() + AVATAR_RADIUS;
    const objects = City.collidablesAt(avatar.position.x + move.x, avatar.position.z + move.z);
    if (wallRay.intersectObjects(objects, true).some(isSolidHit)) return true;
  }
  return false;
}

function teleportToPlace(place) {
  flyTo(place.target.clone().add(new THREE.Vector3(0, 0, place.parent ? 14 : 8)), null, `Teleported to ${place.name}.`);
  history.replaceState(null, '', `#${place.key}`);
}

// ============================================================================
// 3D CURSORS, WEARABLES, TAGS AND CHAT BUBBLES
// ============================================================================
function create3DMousePointerMesh(hexagonalColor) {
  const pointerGroup = new THREE.Group();
  const outline = [[0, 0], [0, -1.6], [0.38, -1.22], [0.66, -1.86], [0.92, -1.74], [0.64, -1.12], [1.14, -1.12]];
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  outline.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();

  const arrowGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  arrowGeometry.translate(0, 0, -0.11);
  const arrowMesh = new THREE.Mesh(arrowGeometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(hexagonalColor), roughness: 0.3, metalness: 0.1, emissive: new THREE.Color(hexagonalColor), emissiveIntensity: 0.15 }));
  arrowMesh.castShadow = true;
  arrowMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(arrowGeometry, 30), new THREE.LineBasicMaterial({ color: 0x1d1b26 })));

  const arrowPivot = new THREE.Group();
  arrowPivot.add(arrowMesh);
  arrowPivot.position.y = 0.25;
  pointerGroup.add(arrowPivot);

  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.38, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(hexagonalColor), transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.03;
  pointerGroup.add(ringMesh);

  pointerGroup.userData.arrowPivot = arrowPivot;
  pointerGroup.scale.setScalar(1.1);
  pointerGroup.traverse((node) => { node.raycast = () => {}; });
  return pointerGroup;
}

// Dev wearables attached to the arrow (hoodie, mug, cap, headphones, hammer)
function buildWearable(item, color) {
  const group = new THREE.Group();
  const add = (geometry, meshColor, x, y, z, options = {}) => {
    const part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: meshColor, roughness: 0.7, ...options }));
    part.position.set(x, y, z);
    part.raycast = () => {};
    group.add(part);
    return part;
  };
  if (item === 'hoodie') {
    const hood = add(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), '#495057', 0.15, 0.15, 0);
    hood.rotation.z = 0.3;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), '#f8f9fa', 0.05, -0.25, 0.15);
  } else if (item === 'mug') {
    add(new THREE.CylinderGeometry(0.25, 0.22, 0.5, 12), color || '#ffffff', 1.2, -0.9, 0);
    const handle = add(new THREE.TorusGeometry(0.13, 0.04, 6, 12), color || '#ffffff', 1.48, -0.9, 0);
    handle.rotation.y = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 12), '#6f4e37', 1.2, -0.66, 0);
  } else if (item === 'cap') {
    add(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e63946', 0.1, 0.12, 0);
    add(new THREE.BoxGeometry(0.5, 0.04, 0.35), '#e63946', 0.1, 0.12, 0.3);
  } else if (item === 'headphones') {
    const band = add(new THREE.TorusGeometry(0.42, 0.05, 6, 16, Math.PI), '#212529', 0.4, -0.5, 0);
    band.rotation.y = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), '#ef233c', 0.4, -0.85, 0.42).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), '#ef233c', 0.4, -0.85, -0.42).rotation.x = Math.PI / 2;
  } else if (item === 'hammer') {
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), '#6d4c41', 1.3, -1, 0).rotation.z = 0.6;
    add(new THREE.BoxGeometry(0.6, 0.3, 0.3), '#ffd54f', 1.0, -0.55, 0, { metalness: 0.7 }).rotation.z = 0.6;
  }
  return group;
}

function setCursorWearable(record, item) {
  if (record.wearable) record.mesh.userData.arrowPivot.remove(record.wearable);
  record.wearable = item ? buildWearable(item) : null;
  if (record.wearable) record.mesh.userData.arrowPivot.add(record.wearable);
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
  return { mesh, target: mesh.position.clone(), domElement: createDeveloperHTMLOverlayTag(isLocal ? `${devTag} (you)` : devTag, color), bubble: null, bubbleTimer: null, isLocal, wearable: null };
}

function disposeCursorRecord(record) {
  scene.remove(record.mesh);
  record.domElement.remove();
  if (record.bubble) record.bubble.remove();
  clearTimeout(record.bubbleTimer);
}

function restyleLocalCursor(devTag, color) {
  const position = localCursor.target.clone();
  disposeCursorRecord(localCursor);
  localCursor = createCursorRecord(devTag, color, true);
  localCursor.mesh.position.copy(position);
  localCursor.target.copy(position);
  setCursorWearable(localCursor, localWearable);
}

function instantiateNetworkPeerCursor(peerData) {
  if (!localDeveloperData || peerData.id === localDeveloperData.id || remoteMeshPointers[peerData.id]) return;
  const record = createCursorRecord(peerData.devTag, peerData.color, false);
  record.metadata = peerData;
  record.mesh.position.set(peerData.position.x, peerData.position.y, peerData.position.z);
  record.target.copy(record.mesh.position);
  setCursorWearable(record, peerData.wearable || null);
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
  anchor.y += 2.9;
  const distance = anchor.distanceTo(camera.position);
  anchor.project(camera);
  const isVisible = anchor.z < 1 && Math.abs(anchor.x) < 1.2 && Math.abs(anchor.y) < 1.2 && (record.isLocal || distance < 220);
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
  clearTimeout(record.bubbleTimer);
  record.bubbleTimer = setTimeout(() => {
    if (!record.bubble) return;
    record.bubble.remove();
    record.bubble = null;
  }, CHAT_BUBBLE_DURATION_MS);
}

// ============================================================================
// INPUT: CURSOR RAYCASTING, CAMERA WALKING, CLICKS
// ============================================================================
function bindInputEvents() {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (event) => {
    pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
    pointerInsideCanvas = true;
    pointerDirty = true;
    ui.tooltip.style.left = `${event.clientX}px`;
    ui.tooltip.style.top = `${event.clientY}px`;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInsideCanvas = false;
    ui.tooltip.style.display = 'none';
  });
  canvas.addEventListener('pointerdown', (event) => { pointerDownAt = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDownAt) return;
    const dragDistance = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (dragDistance >= 5 || !hoveredObject) return;
    if (viewMode === 'map' && hoverPoint) { flyTo(hoverPoint, null, 'Jumped in.'); return; }
    if (GameSystems.handleClick(hoveredObject)) return;
    const labeled = findLabeledAncestor(hoveredObject);
    if (labeled) openInfoCard(labeled.userData);
  });

  window.addEventListener('keydown', (event) => {
    if (document.activeElement === ui.chatInput) {
      if (event.key === 'Escape') ui.chatInput.blur();
      return;
    }
    if (event.key === 'Enter' || event.key === '/' || event.key.toLowerCase() === 't') {
      event.preventDefault();
      ui.chatInput.focus();
      if (event.key === '/') ui.chatInput.value = '/';
      return;
    }
    if (event.key === 'Escape') { closeInfoCard(); closeStream(); }
    if (event.key.toLowerCase() === 'm') { setViewMode(viewMode === 'map' ? 'explore' : 'map'); return; }
    if (event.key === ' ') event.preventDefault();
    keysPressed.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => keysPressed.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keysPressed.clear());

  ui.infoClose.addEventListener('click', closeInfoCard);
  ui.streamClose.addEventListener('click', closeStream);
  ui.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = ui.chatInput.value.trim();
    ui.chatInput.value = '';
    ui.chatInput.blur();
    if (text) handleChatInput(text);
  });

  ui.minimap.addEventListener('click', (event) => {
    const rect = ui.minimap.getBoundingClientRect();
    const scale = (MINIMAP_RADIUS * 2) / rect.width;
    const target = new THREE.Vector3(controls.target.x + (event.clientX - rect.left - rect.width / 2) * scale, 0, controls.target.z + (event.clientY - rect.top - rect.height / 2) * scale);
    flyTo(target, null, 'Jumped in.');
  });

  window.addEventListener('hashchange', () => {
    const place = findPlace(location.hash.slice(1));
    if (place) teleportToPlace(place);
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function findLabeledAncestor(object) {
  let node = object;
  while (node) {
    if (node.userData && node.userData.label) return node;
    node = node.parent;
  }
  return null;
}

function updateLocalCursorFromPointer() {
  if (!pointerInsideCanvas || !pointerDirty) return;
  pointerDirty = false;
  raycaster.setFromCamera(pointerNDC, camera);
  const hit = raycaster.intersectObjects(City.pickables, true).find((candidate) => candidate.object.visible && !(candidate.object.material && candidate.object.material.opacity < 0.1));
  hoveredObject = hit ? hit.object : null;
  const labeled = hoveredObject ? findLabeledAncestor(hoveredObject) : null;
  renderer.domElement.style.cursor = hit ? (labeled ? 'pointer' : 'none') : 'default';
  if (labeled) {
    ui.tooltip.textContent = labeled.userData.label;
    ui.tooltip.style.display = 'block';
  } else {
    ui.tooltip.style.display = 'none';
  }
  hoverPoint = hit ? hit.point.clone() : null;
}

function walkCamera(deltaSeconds) {
  const forwardInput = (keysPressed.has('w') || keysPressed.has('arrowup') ? 1 : 0) - (keysPressed.has('s') || keysPressed.has('arrowdown') ? 1 : 0);
  const strafeInput = (keysPressed.has('d') || keysPressed.has('arrowright') ? 1 : 0) - (keysPressed.has('a') || keysPressed.has('arrowleft') ? 1 : 0);
  const verticalInput = (keysPressed.has('e') ? 1 : 0) - (keysPressed.has('q') ? 1 : 0);
  if (!forwardInput && !strafeInput && !verticalInput) return;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const speed = 60 * (keysPressed.has('shift') ? 3 : 1) * deltaSeconds;
  const step = forward.multiplyScalar(forwardInput * speed).add(right.multiplyScalar(strafeInput * speed));
  step.y = verticalInput * speed;
  camera.position.add(step);
  controls.target.add(step);
  pointerDirty = true;
}

function emitCursor(force) {
  if (!socket || !socket.connected || !localDeveloperData) return;
  const now = performance.now();
  if (!force && now - lastEmitTime < CURSOR_EMIT_INTERVAL_MS) return;
  if (!force && lastEmittedPosition.distanceToSquared(localCursor.target) < 0.0004) return;
  lastEmitTime = now;
  lastEmittedPosition.copy(localCursor.target);
  socket.emit('update_cursor_transform', { position: { x: localCursor.target.x, y: localCursor.target.y, z: localCursor.target.z } });
}

function openInfoCard(userData) {
  const district = City.districtAt(localCursor.target.x, localCursor.target.z);
  ui.infoTitle.textContent = userData.label;
  ui.infoType.textContent = `${userData.blockType || 'object'} · ${district ? district.world.name : 'Genesis City'}`;
  ui.infoCard.style.display = 'block';
}

function closeInfoCard() {
  ui.infoCard.style.display = 'none';
}

function openStream(stream) {
  ui.streamTitle.textContent = stream.title;
  ui.streamFrame.src = stream.embedUrl;
  ui.streamModal.style.display = 'flex';
}

function closeStream() {
  ui.streamModal.style.display = 'none';
  ui.streamFrame.src = 'about:blank';
}

// ============================================================================
// HUD: DISTRICT, PARCEL, CLOCK AND MINIMAP
// ============================================================================
function currentTicks() {
  const elapsed = worldClock.cycle ? ((performance.now() - worldClock.at) / 1000) * TICKS_PER_SECOND : 0;
  return (((worldClock.ticks + elapsed) % 24000) + 24000) % 24000;
}

function ticksToClock(ticks) {
  const hours = (Math.floor(ticks / 1000) + 6) % 24;
  const minutes = Math.floor(((ticks % 1000) / 1000) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function zoneName(district, position) {
  if (!district.world.region) return district.world.name;
  const local = position.clone().sub(district.layout.center);
  const zone = district.mapData.blocks.find((block) => block.type === 'city_zone' &&
    Math.abs(local.x - block.position[0]) <= block.scale[0] / 2 && Math.abs(local.z - block.position[2]) <= block.scale[2] / 2);
  return zone ? `${district.world.name} · ${zone.label}` : district.world.name;
}

let hudFrame = 0;
function updateHud() {
  if (hudFrame++ % 10) return;
  const position = localCursor.target;
  const district = City.districtAt(position.x, position.z);
  ui.district.textContent = district ? zoneName(district, position) : 'Genesis City';
  ui.parcel.textContent = `${Math.floor(position.x / City.PARCEL_SIZE)},${Math.floor(-position.z / City.PARCEL_SIZE)}`;
  ui.clock.textContent = `${ticksToClock(currentTicks())} · ${worldClock.weather}`;
  if (hudFrame % 60 === 1) renderWorldList();
  drawMinimap();
}

function drawMinimap() {
  const ctx = ui.minimap.getContext('2d');
  const size = ui.minimap.width;
  const scale = size / (MINIMAP_RADIUS * 2);
  const focus = controls.target;
  const toMap = (x, z) => [(x - focus.x) * scale + size / 2, (z - focus.z) * scale + size / 2];
  ctx.fillStyle = '#6a9a3a';
  ctx.fillRect(0, 0, size, size);
  // City blocks and roads
  ctx.fillStyle = '#4a4f55';
  const extent = (City.CITY_RADIUS + 0.5) * City.CELL_SIZE;
  for (let line = -City.CITY_RADIUS - 1; line <= City.CITY_RADIUS; line++) {
    const offset = (line + 0.5) * City.CELL_SIZE;
    const [ax, ay] = toMap(offset - 4, -extent);
    ctx.fillRect(ax, ay, 8 * scale, extent * 2 * scale);
    const [bx, by] = toMap(-extent, offset - 4);
    ctx.fillRect(bx, by, extent * 2 * scale, 8 * scale);
  }
  City.districts.forEach((district) => {
    const { center, size: districtSize } = district.layout;
    const [x, y] = toMap(center.x - districtSize[0] / 2, center.z - districtSize[1] / 2);
    ctx.fillStyle = district.world.color;
    ctx.globalAlpha = district.world.region ? 0.35 : 0.8;
    ctx.fillRect(x, y, districtSize[0] * scale, districtSize[1] * scale);
    ctx.globalAlpha = 1;
    if (district.world.region) {
      district.mapData.blocks.filter((block) => /^hq_|campus|apple_park|googleplex|factory|stadium/.test(block.type)).forEach((block) => {
        const [bx, by] = toMap(center.x + block.position[0], center.z + block.position[2]);
        ctx.fillStyle = block.color;
        ctx.fillRect(bx - 2, by - 2, 4, 4);
      });
    }
  });
  Object.values(remoteMeshPointers).forEach((record) => {
    const [x, y] = toMap(record.target.x, record.target.z);
    ctx.fillStyle = record.metadata.color;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
  });
  const [lx, ly] = toMap(localCursor.target.x, localCursor.target.z);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Camera view direction
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size / 2, size / 2);
  ctx.lineTo(size / 2 + direction.x * 22, size / 2 + direction.z * 22);
  ctx.stroke();
}

// ============================================================================
// CHAT & MINECRAFT-STYLE COMMANDS
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

function findPeer(name) {
  if (!name) return null;
  const query = name.toLowerCase();
  const records = Object.entries(remoteMeshPointers);
  const exact = records.find(([, record]) => record.metadata.devTag.toLowerCase() === query);
  const partial = records.find(([, record]) => record.metadata.devTag.toLowerCase().startsWith(query));
  const match = exact || partial;
  return match ? { id: match[0], record: match[1] } : null;
}

function parseCoordinate(value, current) {
  if (value === undefined) return NaN;
  if (value.startsWith('~')) return current + (parseFloat(value.slice(1)) || 0);
  return parseFloat(value);
}

const TIME_PRESETS = { sunrise: 0, day: 1000, morning: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000 };

const HELP_PAGES = [
  ['Teleport', '/tp <player> | /tp <x> <z> | /tp <x> <y> <z> (supports ~ relative) | /tpa <player> | /tpahere <player> | /tpaccept | /tpdeny'],
  ['Places', '/world <place> (alias /warp /goto) | /worlds | /spawn | /sethome | /home'],
  ['World', '/time set <day|noon|sunset|night|midnight|ticks> | /time add <ticks> | /time query | /gamerule doDaylightCycle <true|false> | /weather <clear|rain|snow|thunder>'],
  ['Social', '/nick <name> | /msg <player> <text> (alias /tell /w) | /r <text> | /me <action> | /list | /coords | /clear'],
  ['Dungeon', '/bugs | /script <gc|try-catch|break|mutex|unit-test|reboot> | click bugs with the Git Commit Hammer'],
  ['Open Source HQ', '/mural <1-4> <code> | /pr <slot 1-8> <tree|lamp|banner|fountain|duck|flag|neon|bench> [hex] | /prs | /approve <n> | /merge <n> | /close <n>'],
  ['Keynote & Green-Tech', '/keynotes | /watch [n] | /stream <YouTube/Twitch URL> [title] | /endstream | /wear <hoodie|mug|cap|headphones|none> | /plant | /energy']
];

function interpretChatCommand(inputBuffer) {
  const [rawCommand, ...args] = inputBuffer.slice(1).trim().split(/\s+/);
  const command = (rawCommand || '').toLowerCase();
  const context = { cursorPosition: localCursor.target.clone(), greenTechContains: (position) => { const district = City.districtAt(position.x, position.z); return district && district.world.key === 'greentech'; } };

  switch (command) {
    case 'help':
    case '?': {
      const page = parseInt(args[0], 10);
      if (page >= 1 && page <= HELP_PAGES.length) {
        const [title, text] = HELP_PAGES[page - 1];
        appendSystemMessage(`— ${title} (${page}/${HELP_PAGES.length}) — ${text}`);
      } else {
        HELP_PAGES.forEach(([title, text]) => appendSystemMessage(`${title}: ${text}`));
      }
      break;
    }
    case 'tp':
    case 'teleport': {
      if (args.length === 1) {
        const peer = findPeer(args[0]);
        if (!peer) { appendSystemMessage(`No player named "${args[0]}". Type /list.`); break; }
        flyTo(peer.record.target, new THREE.Vector3(0, 22, 30), `Teleported to ${peer.record.metadata.devTag}.`);
      } else if (args.length === 2 && findPeer(args[0])) {
        appendSystemMessage('Moving another player needs their consent: use /tpahere <player>.');
      } else if (args.length === 2 || args.length === 3) {
        const x = parseCoordinate(args[0], localCursor.target.x);
        const y = args.length === 3 ? parseCoordinate(args[1], localCursor.target.y) : 0;
        const z = parseCoordinate(args[args.length - 1], localCursor.target.z);
        if ([x, y, z].some(Number.isNaN)) { appendSystemMessage('Usage: /tp <x> <z> or /tp <x> <y> <z>'); break; }
        flyTo(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 30, 42), `Teleported to ${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}.`);
      } else {
        appendSystemMessage('Usage: /tp <player> | /tp <x> <z> | /tp <x> <y> <z>');
      }
      break;
    }
    case 'tpa':
    case 'tpahere': {
      const peer = findPeer(args[0]);
      if (!peer) { appendSystemMessage(`Usage: /${command} <player>. Type /list to see who is online.`); break; }
      if (!socket || !socket.connected) { appendSystemMessage('Teleport requests need the multiplayer server.'); break; }
      socket.emit('teleport_request', { targetId: peer.id, mode: command === 'tpa' ? 'to' : 'here' });
      appendSystemMessage(`Teleport request sent to ${peer.record.metadata.devTag}.`);
      break;
    }
    case 'tpaccept': {
      if (!pendingTeleportRequest) { appendSystemMessage('You have no pending teleport requests.'); break; }
      const request = pendingTeleportRequest;
      pendingTeleportRequest = null;
      socket.emit('teleport_accept', { requesterId: request.fromId, mode: request.mode });
      if (request.mode === 'here') {
        const requester = remoteMeshPointers[request.fromId];
        if (requester) flyTo(requester.target, new THREE.Vector3(0, 22, 30), `Teleported to ${request.fromTag}.`);
      } else {
        appendSystemMessage(`${request.fromTag} is teleporting to you.`);
      }
      break;
    }
    case 'tpdeny':
      if (pendingTeleportRequest) {
        socket.emit('teleport_deny', { requesterId: pendingTeleportRequest.fromId });
        appendSystemMessage(`Denied ${pendingTeleportRequest.fromTag}'s request.`);
        pendingTeleportRequest = null;
      } else {
        appendSystemMessage('You have no pending teleport requests.');
      }
      break;
    case 'world':
    case 'warp':
    case 'goto': {
      const place = args[0] ? findPlace(args.join(' ')) : null;
      if (!place) { appendSystemMessage(`Usage: /${command} <place>. Places: ${places.map((candidate) => candidate.key).join(', ')}`); break; }
      teleportToPlace(place);
      break;
    }
    case 'worlds':
    case 'warps':
      appendSystemMessage(`Places: ${places.map((place) => place.key).join(', ')}`);
      break;
    case 'spawn':
      teleportToPlace(places[0]);
      break;
    case 'sethome':
      try { localStorage.setItem('gitverse-home', JSON.stringify(localCursor.target.toArray())); appendSystemMessage('Home set at your cursor. Use /home to come back.'); } catch (error) { appendSystemMessage('Could not save your home in this browser.'); }
      break;
    case 'home': {
      let home = null;
      try { home = JSON.parse(localStorage.getItem('gitverse-home')); } catch (error) { home = null; }
      if (!Array.isArray(home)) { appendSystemMessage('No home set. Point at a spot and type /sethome.'); break; }
      flyTo(new THREE.Vector3(...home), new THREE.Vector3(0, 26, 36), 'Welcome home.');
      break;
    }
    case 'time': {
      const action = (args[0] || '').toLowerCase();
      if (action === 'query' || !action) { appendSystemMessage(`It is ${ticksToClock(currentTicks())} (tick ${Math.floor(currentTicks())}).`); break; }
      let ticks;
      if (action === 'set') ticks = TIME_PRESETS[(args[1] || '').toLowerCase()] ?? parseInt(args[1], 10);
      else if (action === 'add') ticks = currentTicks() + parseInt(args[1], 10);
      if (!Number.isFinite(ticks)) { appendSystemMessage('Usage: /time set <day|noon|sunset|night|midnight|0-24000> | /time add <ticks> | /time query'); break; }
      requestWorldState({ ticks: ((ticks % 24000) + 24000) % 24000 });
      break;
    }
    case 'gamerule': {
      if ((args[0] || '').toLowerCase() !== 'dodaylightcycle' || !['true', 'false'].includes(args[1])) { appendSystemMessage('Usage: /gamerule doDaylightCycle <true|false>'); break; }
      requestWorldState({ cycle: args[1] === 'true', ticks: currentTicks() });
      break;
    }
    case 'weather': {
      const weather = (args[0] || '').toLowerCase();
      if (!['clear', 'rain', 'snow', 'thunder'].includes(weather)) { appendSystemMessage('Usage: /weather <clear|rain|snow|thunder>'); break; }
      requestWorldState({ weather });
      break;
    }
    case 'nick': {
      if (!/^[A-Za-z0-9_]{3,16}$/.test(args[0] || '')) { appendSystemMessage('Usage: /nick <name> (3-16 letters, numbers or _)'); break; }
      if (socket && socket.connected) socket.emit('set_nick', args[0]);
      else { localDeveloperData.devTag = args[0]; restyleLocalCursor(args[0], localDeveloperData.color); ui.devTag.textContent = args[0]; }
      break;
    }
    case 'msg':
    case 'tell':
    case 'w':
    case 'r': {
      const isReply = command === 'r';
      const peer = isReply ? (lastWhisperFrom ? { id: lastWhisperFrom } : null) : findPeer(args[0]);
      const text = (isReply ? args : args.slice(1)).join(' ');
      if (!peer || !text) { appendSystemMessage(isReply ? 'Nobody to reply to.' : 'Usage: /msg <player> <text>'); break; }
      if (!socket || !socket.connected) { appendSystemMessage('Private messages need the multiplayer server.'); break; }
      socket.emit('private_message', { targetId: peer.id, text });
      break;
    }
    case 'me': {
      const text = args.join(' ');
      if (!text) { appendSystemMessage('Usage: /me <action>'); break; }
      if (socket && socket.connected) socket.emit('chat_message', `/me ${text}`);
      else displayChatMessage({ id: localDeveloperData.id, devTag: localDeveloperData.devTag, color: localDeveloperData.color, text: `/me ${text}` });
      break;
    }
    case 'list':
    case 'who':
    case 'online': {
      const names = Object.values(remoteMeshPointers).map((record) => {
        const district = City.districtAt(record.target.x, record.target.z);
        return `${record.metadata.devTag} (${district ? district.world.name : 'Genesis City'})`;
      });
      appendSystemMessage(`Online (${names.length + 1}): ${localDeveloperData ? localDeveloperData.devTag : 'you'} (you)${names.length ? ', ' + names.join(', ') : ''}`);
      break;
    }
    case 'coords':
    case 'pos': {
      const { x, y, z } = localCursor.target;
      appendSystemMessage(`Cursor at x=${x.toFixed(1)} y=${y.toFixed(1)} z=${z.toFixed(1)} · parcel ${ui.parcel.textContent}`);
      break;
    }
    case 'clear':
      ui.chatLog.innerHTML = '';
      break;
    default:
      if (!GameSystems.command(command, args, context)) appendSystemMessage(`Unknown command "/${command}". Type /help.`);
  }
}

function requestWorldState(change) {
  if (socket && socket.connected) {
    socket.emit('world_state_change', change);
  } else {
    applyWorldState({ ...worldClock, ...change, by: 'You', kind: change.weather ? 'weather' : 'cycle' in change ? 'cycle' : 'time' });
  }
}

function applyWorldState(stateUpdate) {
  worldClock.ticks = stateUpdate.ticks;
  worldClock.cycle = stateUpdate.cycle;
  worldClock.weather = stateUpdate.weather;
  worldClock.at = performance.now() - (stateUpdate.elapsedMs || 0);
  if (stateUpdate.by && stateUpdate.kind) {
    if (stateUpdate.kind === 'weather') appendSystemMessage(`${stateUpdate.by} set the weather to ${stateUpdate.weather}.`);
    else if (stateUpdate.kind === 'cycle') appendSystemMessage(`${stateUpdate.by} set doDaylightCycle to ${stateUpdate.cycle}.`);
    else appendSystemMessage(`${stateUpdate.by} set the time to ${ticksToClock(stateUpdate.ticks)}.`);
  }
}

function displayChatMessage(message) {
  const item = document.createElement('li');
  const district = City.districtAt(...(message.id === (localDeveloperData && localDeveloperData.id) ? [localCursor.target.x, localCursor.target.z] : remoteMeshPointers[message.id] ? [remoteMeshPointers[message.id].target.x, remoteMeshPointers[message.id].target.z] : [0, 0]));
  const isAction = message.text.startsWith('/me ');
  if (district && !message.private) {
    const place = document.createElement('span');
    place.className = 'place-tag';
    place.textContent = `[${district.world.name}] `;
    item.appendChild(place);
  }
  const author = document.createElement('span');
  author.className = 'author';
  author.style.color = message.color;
  author.textContent = message.private ? `${message.devTag} whispers: ` : isAction ? `* ${message.devTag} ` : `${message.devTag}: `;
  item.append(author, document.createTextNode(isAction ? message.text.slice(4) : message.text));
  if (message.private) item.classList.add('whisper');
  appendChatItem(item);

  const isLocal = localDeveloperData && message.id === localDeveloperData.id;
  const record = isLocal ? localCursor : remoteMeshPointers[message.id];
  if (record && !message.private) showChatBubble(record, isAction ? `* ${message.text.slice(4)}` : message.text);
}

function appendSystemMessage(text) {
  const item = document.createElement('li');
  item.className = 'system';
  item.textContent = text;
  appendChatItem(item);
}

function appendChatItem(item) {
  ui.chatLog.appendChild(item);
  while (ui.chatLog.children.length > 150) ui.chatLog.firstChild.remove();
  ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

// ============================================================================
// NETWORK LAYER
// ============================================================================
function setConnectionStatus(state, label) {
  ui.connectionDot.className = state;
  ui.connection.textContent = label;
}

function updateOnlineCounter() {
  ui.online.textContent = `${Object.keys(remoteMeshPointers).length + 1} online`;
}

function registerLocalDeveloper(identity) {
  localDeveloperData = identity;
  ui.devTag.textContent = identity.devTag;
  restyleLocalCursor(identity.devTag, identity.color);
}

function setLocalWearable(item) {
  localWearable = item;
  setCursorWearable(localCursor, item);
  if (socket && socket.connected) socket.emit('set_wearable', item);
}

function setupNetwork() {
  GameSystems.init({
    socket,
    scene,
    system: appendSystemMessage,
    localTag: () => (localDeveloperData ? localDeveloperData.devTag : 'you'),
    setWearable: setLocalWearable,
    openStream
  });

  if (!socket) {
    setConnectionStatus('offline', 'Solo mode (no server)');
    registerLocalDeveloper({ id: 'local', devTag: `Dev_${Math.floor(1000 + Math.random() * 9000)}`, color: '#b5ead7' });
    appendSystemMessage('Multiplayer server not found: run "npm start" to explore with other devs.');
    return;
  }

  socket.on('connect', () => setConnectionStatus('online', 'Connected'));
  socket.on('disconnect', () => { setConnectionStatus('offline', 'Reconnecting...'); clearRemotePeers(); });

  socket.on('local_registration_success', (assignedIdentity) => {
    clearRemotePeers();
    registerLocalDeveloper(assignedIdentity);
    lastEmittedPosition.set(Infinity, Infinity, Infinity);
    emitCursor(true);
    if (localWearable) socket.emit('set_wearable', localWearable);
  });
  socket.on('sync_entire_developer_pool', (developers) => developers.forEach(instantiateNetworkPeerCursor));
  socket.on('new_developer_joined', (peer) => {
    instantiateNetworkPeerCursor(peer);
    appendSystemMessage(`${peer.devTag} joined the multiverse.`);
  });
  socket.on('peer_cursor_transformed', ({ id, position }) => {
    const peer = remoteMeshPointers[id];
    if (peer) peer.target.set(position.x, position.y, position.z);
  });
  socket.on('developer_left_network', (peerId) => {
    const peer = remoteMeshPointers[peerId];
    if (peer) appendSystemMessage(`${peer.metadata.devTag} left the multiverse.`);
    removeNetworkPeerCursor(peerId);
  });
  socket.on('peer_updated', (update) => {
    if (localDeveloperData && update.id === localDeveloperData.id) {
      if (update.devTag !== localDeveloperData.devTag) {
        localDeveloperData.devTag = update.devTag;
        ui.devTag.textContent = update.devTag;
        restyleLocalCursor(update.devTag, localDeveloperData.color);
      }
      return;
    }
    const peer = remoteMeshPointers[update.id];
    if (!peer) return;
    if (update.devTag && update.devTag !== peer.metadata.devTag) {
      appendSystemMessage(`${peer.metadata.devTag} is now known as ${update.devTag}.`);
      peer.metadata.devTag = update.devTag;
      peer.domElement.textContent = update.devTag;
    }
    if ('wearable' in update) setCursorWearable(peer, update.wearable);
  });
  socket.on('chat_message', displayChatMessage);
  socket.on('private_message', (message) => {
    if (message.fromId !== localDeveloperData.id) lastWhisperFrom = message.fromId;
    displayChatMessage({ ...message, private: true, devTag: message.fromId === localDeveloperData.id ? `You -> ${message.toTag}` : message.devTag });
  });
  socket.on('system_message', appendSystemMessage);
  socket.on('world_state', applyWorldState);
  socket.on('teleport_request', (request) => {
    pendingTeleportRequest = request;
    appendSystemMessage(request.mode === 'to'
      ? `${request.fromTag} wants to teleport to you. Type /tpaccept or /tpdeny.`
      : `${request.fromTag} wants you to teleport to them. Type /tpaccept or /tpdeny.`);
  });
  socket.on('teleport_accepted', ({ byId, byTag, mode }) => {
    if (mode !== 'to') { appendSystemMessage(`${byTag} accepted and is coming to you.`); return; }
    const target = remoteMeshPointers[byId];
    if (target) flyTo(target.target, new THREE.Vector3(0, 22, 30), `Teleported to ${byTag}.`);
  });
  socket.on('teleport_denied', ({ byTag }) => appendSystemMessage(`${byTag} denied your teleport request.`));
}

// ============================================================================
// RUNTIME LOOP
// ============================================================================
function animate() {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  const smoothing = 1 - Math.exp(-deltaSeconds * 12);

  if (viewMode === 'explore') updateAvatar(deltaSeconds); else walkCamera(deltaSeconds);
  controls.update();
  updateLocalCursorFromPointer();
  emitCursor(false);

  const { flash } = City.updateEnvironment({ ticks: currentTicks(), weather: worldClock.weather, camera, focus: controls.target, deltaSeconds, time: elapsed });
  if (flash) lightningUntil = performance.now() + 120;
  ui.flash.style.opacity = performance.now() < lightningUntil ? '0.55' : '0';

  PropKit.animatedObjects.forEach((object) => object.userData.animate(elapsed));
  // District titles fade out when the camera gets close, so they never block the view
  City.districts.forEach((district) => {
    const titlePosition = district.title.getWorldPosition(new THREE.Vector3());
    const distance = titlePosition.distanceTo(camera.position);
    const fadeStart = district.world.region ? 160 : 55;
    district.title.material.opacity = Math.max(0, Math.min(1, (distance - fadeStart) / 40));
    district.title.visible = district.title.material.opacity > 0.01;
  });

  [localCursor, ...Object.values(remoteMeshPointers)].forEach((record, index) => {
    record.mesh.position.lerp(record.target, record.target.distanceTo(record.mesh.position) > 60 ? 1 : smoothing);
    record.mesh.rotation.y = Math.atan2(camera.position.x - record.mesh.position.x, camera.position.z - record.mesh.position.z);
    record.mesh.userData.arrowPivot.position.y = 1.9 + Math.sin(elapsed * 3 + index) * 0.08;
    projectToScreen(record);
  });

  updateHud();
  renderer.render(scene, camera);
}

// ============================================================================
// BOOT
// ============================================================================
initEngine();
setupNetwork();
loadUniverse()
  .then(() => {
    const requested = findPlace(location.hash.slice(1) || 'plaza') || places[0];
    flyTo(requested.target.clone().add(new THREE.Vector3(0, 0, requested.parent ? 12 : 6)), null);
    appendSystemMessage('Welcome to GitVerse! Walk with W A S D, jump with Space, run with Shift, drag to look around, M for the map.');
    appendSystemMessage('Press Enter (or T, or /) to chat. Type /help for every command.');
  })
  .catch((error) => {
    console.error('Could not load the universe:', error);
    appendSystemMessage('Could not load maps/worlds.json.');
  });
