// ============================================================================
// SCENES & BUILDER: DECENTRALAND-STYLE WORLD BUILDING ON OWNED LAND
// ============================================================================
// Genesis City is a grid of 16 m LAND parcels (x,y). Like Decentraland:
// - Estates: adjacent parcels owned by the same dev merge into one estate
//   (built as one scene, no stone edging between them; see city.js).
// - Scenes: each parcel or estate holds one scene, described by a manifest
//   shaped like Decentraland's scene.json:
//     { display: { title, description }, owner,
//       scene: { parcels: ["x,y", ...], base: "x,y" },
//       spawnPoints: [{ name, default, position: { x, y, z } }],
//       entities: [{ id, item, position, rotation, scale, props }] }
//   Entity positions are in meters relative to the south-west corner of the
//   base parcel: x grows east, z grows north, y up from the ground.
// - Scene limits (per Decentraland rules, n = parcels in the scene):
//   height <= log2(n+1) * 20 m, entities <= 200 n, triangles <= 10000 n,
//   materials <= log2(n+1) * 20, textures <= log2(n+1) * 10. Content must
//   stay inside the scene parcels; anything else is refused with a message.
// - The Builder (press B on a parcel you own): catalog of placeable items,
//   ghost preview with grid snapping, move / rotate / scale / delete,
//   undo / redo, Save (draft) and Publish (everyone sees it).
// - Runtime: published scenes are built lazily near the avatar, are walkable
//   and collidable, and show their title in the location chip and the maps.
//
// This file has two parts:
// 1. SceneRules: pure validation shared by the browser and server.js
//    (require('./public/scenes-builder.js')), so both sides apply the same
//    bounds and limits.
// 2. SceneBuilder (browser only): catalog builders, runtime and Builder UI.
// ============================================================================

const SceneRules = (() => {
  const PARCEL = 16;
  const MAX_PARCELS = 25; // largest estate one scene can span
  const PARCEL_RE = /^-?\d{1,3},-?\d{1,3}$/;
  const TOLERANCE = 0.02;

  // Placeable items. size: [w, h, d] in meters at scale 1 (origin at the
  // bottom center); tris: triangles (measured); colorable: the item has one
  // material per color; shared: materials reused by every copy of the item
  // (and by other items with the same key); tex: textures it loads.
  const CATALOG = {
    floor: { name: 'Concrete floor', category: 'Structure', size: [4, 0.2, 4], tris: 12, shared: [], tex: 1, color: '#b9b4aa' },
    tile: { name: 'Floor tiles', category: 'Structure', size: [2, 0.1, 2], tris: 12, shared: [], tex: 1, color: '#e9ecef' },
    wall: { name: 'Wall', category: 'Structure', size: [4, 3, 0.3], tris: 120, shared: ['wall-cap'], tex: 0, color: '#e3ded4' },
    glass: { name: 'Glass panel', category: 'Structure', size: [4, 3, 0.12], tris: 60, shared: ['glass'], tex: 0, color: '#5c677d' },
    stairs: { name: 'Stairs', category: 'Structure', size: [2, 2, 4], tris: 96, shared: [], tex: 0, color: '#adb5bd' },
    platform: { name: 'Platform', category: 'Structure', size: [4, 0.6, 4], tris: 120, shared: ['glow-white'], tex: 0, color: '#868e96' },
    column: { name: 'Column', category: 'Structure', size: [0.8, 3, 0.8], tris: 104, shared: [], tex: 0, color: '#f1ede4' },
    cube: { name: 'Color cube', category: 'Structure', size: [1, 1, 1], tris: 108, shared: [], tex: 0, color: '#4dabf7' },
    tree: { name: 'Tree', category: 'Nature', size: [4.6, 6, 4.6], tris: 372, colorable: false, shared: ['bark', 'leaves'], tex: 1, color: '#2f9e44' },
    pine: { name: 'Pine', category: 'Nature', size: [3.4, 7, 3.4], tris: 160, colorable: false, shared: ['bark', 'needles'], tex: 1, color: '#2b8a3e' },
    plant: { name: 'Potted plant', category: 'Nature', size: [0.8, 1.3, 0.8], tris: 144, shared: ['terracotta'], tex: 0, color: '#37b24d' },
    bench: { name: 'Bench', category: 'Furniture', size: [2.2, 1.3, 0.8], tris: 48, shared: ['dark-metal'], tex: 1, color: '#a8743f' },
    table: { name: 'Table', category: 'Furniture', size: [1.8, 0.8, 1], tris: 60, shared: ['dark-metal'], tex: 0, color: '#c8956d' },
    chair: { name: 'Chair', category: 'Furniture', size: [0.6, 1, 0.6], tris: 72, shared: [], tex: 0, color: '#495057' },
    lamp: { name: 'Lamp', category: 'Furniture', size: [0.6, 3.8, 0.6], tris: 264, shared: ['glow-warm'], tex: 0, color: '#263238' },
    firepit: { name: 'Fire pit', category: 'Furniture', size: [2, 1.2, 2], tris: 528, shared: ['wood', 'flame'], tex: 0, color: '#7c7c7c' },
    sign: { name: 'Sign', category: 'Media', size: [2.4, 2.2, 0.2], tris: 76, shared: ['dark-metal'], tex: 1, color: '#4dabf7', text: 'Welcome to my scene' },
    screen: { name: 'Video / image screen', category: 'Media', size: [4.2, 3.2, 0.6], tris: 102, shared: ['screen'], tex: 1, color: '#1d1d1f', url: '' },
    laptop: { name: 'Laptop', category: 'Media', size: [0.7, 0.5, 0.5], tris: 48, shared: ['laptop', 'code-screen'], tex: 1, color: '#3d4148' },
    portal: { name: 'Portal', category: 'Media', size: [2.6, 3.6, 0.4], tris: 326, shared: ['dark-frame'], tex: 1, color: '#9775fa', place: 'plaza' }
  };

  const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
  const finite = (value, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const sameName = (a, b) => Boolean(a) && Boolean(b) && String(a).toLowerCase() === String(b).toLowerCase();
  const clean = (text, max) => String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const parse = (key) => key.split(',').map(Number);

  function limitsFor(parcelCount) {
    const n = Math.max(1, parcelCount);
    const factor = Math.log2(n + 1);
    return {
      parcels: n,
      height: round(factor * 20, 2),
      entities: 200 * n,
      triangles: 10000 * n,
      materials: Math.floor(factor * 20),
      textures: Math.floor(factor * 10)
    };
  }

  // Parcels touching by an edge, all reachable from the first one
  function connected(parcels) {
    if (!parcels.length) return false;
    const set = new Set(parcels);
    const seen = new Set([parcels[0]]);
    const queue = [parcels[0]];
    while (queue.length) {
      const [x, y] = parse(queue.pop());
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const next = `${x + dx},${y + dy}`;
        if (set.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      });
    }
    return seen.size === set.size;
  }

  // The estate a parcel belongs to: every parcel connected to it with the same owner
  function estateOf(parcel, ownerOf) {
    const owner = ownerOf(parcel);
    if (!owner) return [];
    const seen = new Set([parcel]);
    const queue = [parcel];
    while (queue.length && seen.size < 400) {
      const [x, y] = parse(queue.pop());
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const next = `${x + dx},${y + dy}`;
        if (!seen.has(next) && sameName(ownerOf(next), owner)) { seen.add(next); queue.push(next); }
      });
    }
    return [...seen];
  }

  // Base parcel: the south-west-most one (lowest y, then lowest x)
  function baseOf(parcels) {
    return parcels.slice().sort((a, b) => { const [ax, ay] = parse(a); const [bx, by] = parse(b); return ay - by || ax - bx; })[0];
  }

  function youtubeId(url) {
    const text = String(url || '').trim();
    const match = text.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#].*)?$/);
    return match ? match[1] : null;
  }
  const isImageUrl = (url) => /^https:\/\/[^\s"'<>]+\.(png|jpe?g|webp|gif)(\?[^\s"'<>]*)?$/i.test(String(url || ''));

  // Footprint of an entity: axis-aligned box (local scene meters) after rotation and scale
  function extentOf(entity) {
    const item = CATALOG[entity.item];
    const [w, h, d] = item.size;
    const [sx, sy, sz] = entity.scale;
    const angle = (entity.rotation[1] * Math.PI) / 180;
    const hw = (w * sx) / 2;
    const hd = (d * sz) / 2;
    const ex = Math.abs(hw * Math.cos(angle)) + Math.abs(hd * Math.sin(angle));
    const ez = Math.abs(hw * Math.sin(angle)) + Math.abs(hd * Math.cos(angle));
    const [x, y, z] = entity.position;
    return { minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez, minY: y, maxY: y + h * sy };
  }

  // Why an entity cannot stay where it is (null when it fits).
  // context: { parcels: Set of "x,y", base: [bx, by], limits }
  function entityProblem(entity, context) {
    const item = CATALOG[entity.item];
    if (!item) return `Unknown item "${entity.item}".`;
    const box = extentOf(entity);
    const name = `"${item.name}"`;
    if (box.minY < -TOLERANCE) return `Out of bounds: ${name} goes under the ground.`;
    if (box.maxY > context.limits.height + TOLERANCE) return `Too tall: ${name} reaches ${box.maxY.toFixed(1)} m; the height limit for ${context.limits.parcels} parcel${context.limits.parcels > 1 ? 's' : ''} is ${context.limits.height} m.`;
    // Sample the footprint (every 4 m and its edges): each point must be on a scene parcel
    const [bx, by] = context.base;
    const xs = [];
    const zs = [];
    const minX = box.minX + TOLERANCE;
    const maxX = box.maxX - TOLERANCE;
    const minZ = box.minZ + TOLERANCE;
    const maxZ = box.maxZ - TOLERANCE;
    for (let x = minX; x < maxX; x += 4) xs.push(x);
    xs.push(maxX);
    for (let z = minZ; z < maxZ; z += 4) zs.push(z);
    zs.push(maxZ);
    for (const x of xs) {
      for (const z of zs) {
        if (!context.parcels.has(`${bx + Math.floor(x / PARCEL)},${by + Math.floor(z / PARCEL)}`)) {
          return `Out of bounds: ${name} at (${entity.position[0].toFixed(1)}, ${entity.position[2].toFixed(1)}) leaves the scene parcels.`;
        }
      }
    }
    return null;
  }

  // Usage of an entity list against the limits
  function statsOf(entities) {
    const materials = new Set();
    const textures = new Set();
    let triangles = 0;
    let height = 0;
    entities.forEach((entity) => {
      const item = CATALOG[entity.item];
      if (!item) return;
      triangles += item.tris;
      height = Math.max(height, extentOf(entity).maxY);
      const color = (entity.props && entity.props.color) || item.color;
      if (item.colorable !== false) materials.add(`${entity.item}:${color}`);
      item.shared.forEach((key) => materials.add(`shared:${key}`));
      for (let k = 0; k < item.tex; k++) {
        const unique = entity.item === 'sign' ? entity.props.text : entity.item === 'screen' ? entity.props.url : '';
        textures.add(`${entity.item}:${k}:${unique}:${entity.item === 'floor' || entity.item === 'tile' ? color : ''}`);
      }
    });
    return { entities: entities.length, triangles, height: round(height, 2), materials: materials.size, textures: textures.size };
  }

  // First limit the stats go over (null when everything fits)
  function limitProblem(stats, limits) {
    const n = `${limits.parcels} parcel${limits.parcels > 1 ? 's' : ''}`;
    if (stats.entities > limits.entities) return `Too many entities: ${stats.entities} of ${limits.entities} allowed for ${n}.`;
    if (stats.triangles > limits.triangles) return `Too many triangles: ${stats.triangles} of ${limits.triangles} allowed for ${n}.`;
    if (stats.materials > limits.materials) return `Too many materials: ${stats.materials} of ${limits.materials} allowed for ${n}.`;
    if (stats.textures > limits.textures) return `Too many textures: ${stats.textures} of ${limits.textures} allowed for ${n}.`;
    if (stats.height > limits.height + TOLERANCE) return `Too tall: ${stats.height} m of ${limits.height} m allowed for ${n}.`;
    return null;
  }

  // Normalizes one entity (null when it is not a valid entity)
  function sanitizeEntity(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const item = CATALOG[raw.item];
    if (!item) return null;
    const id = String(raw.id || '');
    if (!/^[\w-]{1,24}$/.test(id)) return null;
    const vector = (value, fallback) => (Array.isArray(value) ? [0, 1, 2].map((i) => finite(value[i], fallback)) : [fallback, fallback, fallback]);
    const position = vector(raw.position, 0).map((value) => round(value));
    const rotationY = ((round(finite(Array.isArray(raw.rotation) ? raw.rotation[1] : raw.rotation, 0), 2) % 360) + 360) % 360;
    const scale = vector(raw.scale, 1).map((value) => round(Math.min(20, Math.max(0.1, value))));
    const input = raw.props && typeof raw.props === 'object' ? raw.props : {};
    const props = {};
    props.color = /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color.toLowerCase() : item.color;
    if (raw.item === 'sign') props.text = clean(input.text, 120) || item.text;
    if (raw.item === 'screen') props.url = youtubeId(input.url) || isImageUrl(input.url) ? String(input.url).trim().slice(0, 300) : '';
    if (raw.item === 'portal') props.place = /^[\w ,.-]{1,40}$/.test(String(input.place || '').trim()) ? String(input.place).trim() : item.place;
    return { id, item: raw.item, position, rotation: [0, rotationY, 0], scale, props };
  }

  // Full validation of a manifest sent by a client.
  // options: { owner, ownerOf(parcelKey) -> owner name or null }
  function validate(input, { owner, ownerOf }) {
    const fail = (error) => ({ ok: false, error });
    if (!input || typeof input !== 'object') return fail('Invalid scene.');
    const info = input.scene && typeof input.scene === 'object' ? input.scene : {};
    const parcels = Array.isArray(info.parcels) ? [...new Set(info.parcels.map(String))] : [];
    if (!parcels.length) return fail('The scene has no parcels.');
    if (parcels.length > MAX_PARCELS) return fail(`A scene can span at most ${MAX_PARCELS} parcels.`);
    if (!parcels.every((parcel) => PARCEL_RE.test(parcel))) return fail('Invalid parcel coordinates.');
    const notOwned = parcels.find((parcel) => !sameName(ownerOf(parcel), owner));
    if (notOwned) return fail(`Parcel ${notOwned} is not yours: you can only build on land you own.`);
    if (!connected(parcels)) return fail('The parcels of a scene must be adjacent (one estate).');
    const base = parcels.includes(String(info.base)) ? String(info.base) : null;
    if (!base) return fail('The base parcel must be one of the scene parcels.');
    const limits = limitsFor(parcels.length);
    const context = { parcels: new Set(parcels), base: parse(base), limits };
    const rawEntities = Array.isArray(input.entities) ? input.entities : [];
    if (rawEntities.length > limits.entities) return fail(`Too many entities: ${rawEntities.length} of ${limits.entities} allowed for ${parcels.length} parcel${parcels.length > 1 ? 's' : ''}.`);
    const entities = [];
    const ids = new Set();
    for (const raw of rawEntities) {
      const entity = sanitizeEntity(raw);
      if (!entity) return fail('The scene has an invalid entity.');
      if (ids.has(entity.id)) return fail(`Duplicate entity id "${entity.id}".`);
      ids.add(entity.id);
      const problem = entityProblem(entity, context);
      if (problem) return fail(problem);
      entities.push(entity);
    }
    const stats = statsOf(entities);
    const overLimit = limitProblem(stats, limits);
    if (overLimit) return fail(overLimit);
    const spawnPoints = [];
    (Array.isArray(input.spawnPoints) ? input.spawnPoints : []).slice(0, 4).forEach((spawn, index) => {
      const p = spawn && spawn.position;
      if (!p) return;
      const point = { x: round(finite(p.x)), y: round(Math.max(0, finite(p.y))), z: round(finite(p.z)) };
      const [bx, by] = context.base;
      if (!context.parcels.has(`${bx + Math.floor(point.x / PARCEL)},${by + Math.floor(point.z / PARCEL)}`) || point.y > limits.height) return;
      spawnPoints.push({ name: clean(spawn.name, 24) || `spawn${index + 1}`, default: spawnPoints.length === 0, position: point });
    });
    const display = input.display && typeof input.display === 'object' ? input.display : {};
    return {
      ok: true,
      stats,
      limits,
      manifest: {
        display: { title: clean(display.title, 60) || 'Untitled scene', description: clean(display.description, 280) },
        owner,
        scene: { parcels: parcels.slice().sort(), base },
        spawnPoints,
        entities
      }
    };
  }

  return { PARCEL, MAX_PARCELS, CATALOG, limitsFor, connected, estateOf, baseOf, youtubeId, isImageUrl, extentOf, entityProblem, statsOf, limitProblem, sanitizeEntity, validate, sameName, parse };
})();

if (typeof module === 'object' && module.exports) module.exports = SceneRules;

// ============================================================================
// Browser part: catalog builders, scene runtime and the in-game Builder
// ============================================================================
if (typeof window !== 'undefined') window.SceneBuilder = (() => {
  const P = SceneRules.PARCEL;
  const LOAD_DISTANCE = 150; // scenes closer than this are built (Decentraland loads nearby scenes only)
  const HIDE_DISTANCE = 230;
  const SNAP = 0.5;
  const SOLO_KEY = 'multiverse-scenes';
  const SOLO_LANDS_KEY = 'multiverse-solo-lands';
  let hooks = null;
  let published = {}; // id (base parcel) -> manifest
  const built = new Map(); // id -> { root, manifest }
  let scenesRoot = null;
  let editor = null;
  let currentSceneId = null;
  let banner = null;
  let solo = { published: {}, drafts: {} };

  const kit = () => PropKit.kit;
  const ground = () => City.GROUND_LEVEL;
  const online = () => Boolean(hooks && hooks.socket && hooks.socket.connected);
  const me = () => (hooks ? hooks.username() : '');
  const parcelKeyAt = (x, z) => `${Math.floor(x / P)},${Math.floor(-z / P)}`;
  const ownerOf = (key) => City.landOwner(key);

  // --------------------------------------------------------------------------
  // Catalog builders: each returns a group with its origin at the bottom center
  // --------------------------------------------------------------------------
  const geometryCache = new Map();
  const plainBox = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geometryCache.get(key);
  };
  const materialCache = new Map();
  const cachedMaterial = (key, create) => { if (!materialCache.has(key)) materialCache.set(key, create()); return materialCache.get(key); };

  const BUILDERS = {
    floor(group, props) {
      const { mesh, repeated, concreteTexture } = kit();
      const surface = cachedMaterial(`floor|${props.color}`, () => new THREE.MeshStandardMaterial({ map: repeated(concreteTexture(props.color), 1, 1), roughness: 0.9 }));
      group.add(mesh(plainBox(4, 0.2, 4), surface, 0, 0.1, 0));
    },
    tile(group, props) {
      const { mesh, repeated, gridTexture, shade } = kit();
      const surface = cachedMaterial(`tile|${props.color}`, () => new THREE.MeshStandardMaterial({ map: repeated(gridTexture(props.color, shade(props.color, -0.12), 4), 1, 1), roughness: 0.55 }));
      group.add(mesh(plainBox(2, 0.1, 2), surface, 0, 0.05, 0));
    },
    wall(group, props) {
      const { box, mesh, material, shade } = kit();
      group.add(box(4, 2.9, 0.3, material(props.color, { surface: 'matte' }), 0, 1.45, 0));
      group.add(mesh(plainBox(4.04, 0.1, 0.34), material(shade(props.color, -0.15)), 0, 2.95, 0));
    },
    glass(group, props) {
      const { mesh, material } = kit();
      const pane = mesh(plainBox(3.9, 2.9, 0.04), material('#cfe8ff', { transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0.6 }), 0, 1.5, 0);
      pane.castShadow = false;
      group.add(pane);
      const frame = material(props.color, { metalness: 0.8, roughness: 0.3 });
      group.add(mesh(plainBox(4, 0.08, 0.12), frame, 0, 0.04, 0));
      group.add(mesh(plainBox(4, 0.08, 0.12), frame, 0, 2.96, 0));
      [-1, 1].forEach((side) => group.add(mesh(plainBox(0.08, 3, 0.12), frame, side * 1.96, 1.5, 0)));
    },
    stairs(group, props) {
      const { mesh, material } = kit();
      const stone = material(props.color, { surface: 'stone' });
      // Eight solid steps of 25 cm (walkable: the avatar climbs steps up to ~0.5 m)
      for (let i = 0; i < 8; i++) group.add(mesh(plainBox(2, 0.25 * (i + 1), 0.5), stone, 0, 0.125 * (i + 1), 1.75 - i * 0.5));
    },
    platform(group, props) {
      const { box, mesh, material, glow } = kit();
      group.add(box(4, 0.6, 4, material(props.color, { surface: 'stone' }), 0, 0.3, 0));
      const trim = mesh(plainBox(4.02, 0.05, 4.02), glow('#e9ecef', 0.4), 0, 0.585, 0);
      trim.raycast = () => {};
      group.add(trim);
    },
    column(group, props) {
      const { cylinder, mesh, material } = kit();
      const stone = material(props.color, { surface: 'stone' });
      group.add(cylinder(0.28, 0.3, 2.6, stone, 0, 1.5, 0, 20));
      group.add(mesh(plainBox(0.8, 0.2, 0.8), stone, 0, 0.1, 0));
      group.add(mesh(plainBox(0.8, 0.2, 0.8), stone, 0, 2.9, 0));
    },
    cube(group, props) {
      const { box, material } = kit();
      group.add(box(1, 1, 1, material(props.color, { roughness: 0.45 }), 0, 0.5, 0));
    },
    tree(group) {
      group.add(kit().realisticTree('broadleaf', 6));
    },
    pine(group) {
      group.add(kit().realisticTree('pine', 7));
    },
    plant(group, props) {
      const { cylinder, mesh, material } = kit();
      group.add(cylinder(0.3, 0.22, 0.5, material('#c9a27e', { surface: 'stone' }), 0, 0.25, 0, 16));
      group.add(mesh(new THREE.IcosahedronGeometry(0.4, 1), material(props.color, { flatShading: true, roughness: 0.9 }), 0, 0.9, 0));
    },
    bench(group, props) {
      // Genesis Plaza bench (PropKit builder): sit on it with E
      group.add(PropKit.buildBlock({ type: 'bench', position: [0, 0, 0], scale: [2.2, 1, 0.8], color: props.color }));
    },
    table(group, props) {
      const { mesh, material } = kit();
      group.add(mesh(plainBox(1.8, 0.06, 1), material(props.color, { surface: 'wood' }), 0, 0.77, 0));
      const leg = material('#2d3436', { metalness: 0.5 });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => group.add(mesh(plainBox(0.07, 0.74, 0.07), leg, sx * 0.8, 0.37, sz * 0.4)));
    },
    chair(group, props) {
      const { mesh, material, seat } = kit();
      const body = material(props.color, { roughness: 0.6 });
      group.add(mesh(plainBox(0.5, 0.06, 0.5), body, 0, 0.45, 0));
      group.add(mesh(plainBox(0.5, 0.5, 0.05), body, 0, 0.73, -0.225));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => group.add(mesh(plainBox(0.05, 0.45, 0.05), body, sx * 0.22, 0.225, sz * 0.22)));
      group.add(seat(0, 0.45, 0, 'Chair'));
    },
    lamp(group, props) {
      const { cylinder, sphere, material, glow } = kit();
      const iron = material(props.color, { metalness: 0.6, roughness: 0.4 });
      group.add(cylinder(0.22, 0.28, 0.2, iron, 0, 0.1, 0, 12));
      group.add(cylinder(0.06, 0.09, 3.2, iron, 0, 1.7, 0, 12));
      group.add(sphere(0.28, glow('#fff1c1', 1.1), 0, 3.42, 0, 12));
      group.add(cylinder(0.05, 0.3, 0.15, iron, 0, 3.72, 0, 12));
    },
    firepit(group, props) {
      const { mesh, cylinder, material, animate } = kit();
      const stone = material(props.color, { flatShading: true, surface: 'stone' });
      const rock = geometryCache.get('rock') || new THREE.DodecahedronGeometry(0.22, 0);
      geometryCache.set('rock', rock);
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const stoneMesh = mesh(rock, stone, Math.cos(angle) * 0.8, 0.16, Math.sin(angle) * 0.8);
        stoneMesh.rotation.set(i, i * 2, 0);
        group.add(stoneMesh);
      }
      const wood = material('#5d4037', { surface: 'wood' });
      [0, 1, 2].forEach((k) => {
        const log = cylinder(0.08, 0.08, 1.1, wood, 0, 0.15, 0, 8);
        log.rotation.set(Math.PI / 2 - 0.3, (k * Math.PI) / 3, 0);
        group.add(log);
      });
      const flame = cachedMaterial('flame', () => new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      [[0, 0.75, 0.22], [0.12, 0.55, 0.16], [-0.1, 0.6, 0.15]].forEach(([x, h, r], index) => {
        const cone = mesh(new THREE.ConeGeometry(r, h, 8), flame, x, 0.25 + h / 2, index ? 0.08 : 0);
        cone.raycast = () => {};
        cone.castShadow = false;
        animate(cone, (time) => { cone.scale.y = 0.85 + Math.sin(time * 11 + index * 2) * 0.15; });
        group.add(cone);
      });
      // Fry your Code (F) and the fire glow work with every fire pit
      window.firepits = window.firepits || [];
      window.firepits.push(group);
      group.userData.sceneFirepit = true;
    },
    sign(group, props) {
      const { mesh, cylinder, material, labelTexture, interactive } = kit();
      const face = new THREE.MeshBasicMaterial({ map: labelTexture(props.text || '', { bg: '#14121f', fg: '#ffffff', border: props.color, width: 512, height: 256, font: 'bold 44px Segoe UI, Arial, sans-serif' }) });
      const edge = material(props.color);
      const board = mesh(plainBox(2.4, 1.2, 0.08), [edge, edge, edge, edge, face, face], 0, 1.6, 0);
      board.userData.label = props.text;
      board.userData.info = props.text;
      interactive(board, 'inspect', 'Sign');
      group.add(board);
      [-1, 1].forEach((side) => group.add(cylinder(0.05, 0.05, 1.05, material('#495057', { metalness: 0.5 }), side * 1, 0.52, 0, 8)));
    },
    screen(group, props, { live }) {
      const { mesh, cylinder, material, labelTexture } = kit();
      const body = material(props.color, { metalness: 0.4, roughness: 0.35 });
      group.add(mesh(plainBox(4.2, 2.45, 0.1), body, 0, 1.9, 0));
      [-1, 1].forEach((side) => {
        group.add(cylinder(0.06, 0.06, 0.7, body, side * 1.6, 0.35, 0, 8));
        group.add(mesh(plainBox(0.25, 0.04, 0.6), body, side * 1.6, 0.02, 0));
      });
      const videoId = SceneRules.youtubeId(props.url);
      let surface;
      if (videoId) surface = new THREE.MeshBasicMaterial({ color: '#000000' });
      else if (SceneRules.isImageUrl(props.url)) {
        surface = new THREE.MeshBasicMaterial({ map: labelTexture('Loading image...', { bg: '#101014', fg: '#ced4da', width: 512, height: 288 }) });
        if (live) {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin('anonymous');
          loader.load(props.url, (texture) => { surface.map = texture; surface.needsUpdate = true; }, undefined, () => {
            surface.map = labelTexture('Image could not be loaded', { bg: '#101014', fg: '#ff8787', width: 512, height: 288 });
            surface.needsUpdate = true;
          });
        }
      } else surface = new THREE.MeshBasicMaterial({ map: labelTexture('Screen: paste a YouTube or image link in the Builder', { bg: '#101014', fg: '#ced4da', width: 512, height: 288, font: 'bold 30px Segoe UI, Arial, sans-serif' }) });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.25), surface);
      plane.position.set(0, 1.9, 0.056);
      group.add(plane);
      if (videoId && live) {
        VideoScreens.register(plane, 4, 2.25, VideoScreens.youtubeEmbed([videoId]));
        plane.userData.videoAnchor = true;
      }
    },
    laptop(group, props) {
      const { mesh, material } = kit();
      group.add(mesh(plainBox(0.7, 0.02, 0.5), material(props.color, { metalness: 0.4 }), 0, 0.01, 0));
      group.add(kit().laptop(0, 0.02, 0.02, 0));
    },
    portal(group, props) {
      const { box, mesh, material, glow, animate, textSprite, interactive } = kit();
      const frame = material('#2b2d42', { metalness: 0.5, roughness: 0.35 });
      [-1, 1].forEach((side) => group.add(box(0.3, 3.3, 0.4, frame, side * 1.15, 1.65, 0)));
      group.add(box(2.6, 0.3, 0.4, frame, 0, 3.45, 0));
      const field = mesh(new THREE.PlaneGeometry(2, 3.2), glow(props.color, 1.4, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), 0, 1.6, 0);
      field.raycast = () => {};
      field.castShadow = false;
      group.add(field);
      animate(field, (time) => { field.material.opacity = 0.45 + Math.sin(time * 2.4) * 0.12; });
      const label = textSprite(`To ${props.place}`, { width: 3.2 });
      label.position.y = 4.2;
      group.add(label);
      group.userData.onInteract = () => travel(props.place);
      group.userData.prompt = `Press E to travel to ${props.place}`;
      interactive(group, 'action', `Portal to ${props.place}`);
    }
  };

  // Portals go to a place key (plaza, apple...) or to a parcel "x,y"
  function travel(place) {
    if (/^-?\d+,-?\d+$/.test(place)) { gotoParcel(place); return null; }
    if (hooks.jumpTo(place)) return null;
    return `This portal leads to "${place}", which does not exist.`;
  }

  function buildEntity(entity, { live = true } = {}) {
    const group = new THREE.Group();
    const item = SceneRules.CATALOG[entity.item];
    try {
      BUILDERS[entity.item](group, { ...item, ...entity.props }, { live });
    } catch (error) {
      console.error(`Could not build scene item ${entity.item}:`, error);
    }
    kit().enhanceSurfaces(group);
    group.userData.entityId = entity.id;
    return group;
  }

  // World placement of an entity of a scene with base parcel [bx, by]
  function placeGroup(group, entity, base) {
    const [x, y, z] = entity.position;
    group.position.set(base[0] * P + x, ground() + y, -(base[1] * P + z));
    group.rotation.set(0, (entity.rotation[1] * Math.PI) / 180, 0);
    group.scale.set(entity.scale[0], entity.scale[1], entity.scale[2]);
  }

  // Detaches what other systems keep track of (interactables, fires, video screens)
  function release(group) {
    const doomed = new Set();
    group.traverse((node) => {
      doomed.add(node);
      if (node.userData.videoAnchor && node.parent) node.parent.remove(node);
    });
    [PropKit.interactables, PropKit.animatedObjects].forEach((list) => {
      for (let i = list.length - 1; i >= 0; i--) if (doomed.has(list[i])) list.splice(i, 1);
    });
    if (window.firepits) window.firepits = window.firepits.filter((pit) => !doomed.has(pit));
  }

  // --------------------------------------------------------------------------
  // Runtime: published scenes, built lazily by distance
  // --------------------------------------------------------------------------
  function sceneValid(manifest) {
    return manifest.scene.parcels.every((parcel) => SceneRules.sameName(ownerOf(parcel), manifest.owner));
  }

  function sceneAt(parcel) {
    return Object.values(published).find((manifest) => manifest.scene.parcels.includes(parcel) && sceneValid(manifest)) || null;
  }

  function titleAt(parcel) {
    if (editor && editor.parcels.has(parcel)) return editor.manifest.display.title;
    const manifest = sceneAt(parcel);
    return manifest ? manifest.display.title : null;
  }

  function sceneCenter(manifest) {
    let x = 0;
    let z = 0;
    manifest.scene.parcels.forEach((parcel) => { const [px, py] = SceneRules.parse(parcel); x += px * P + P / 2; z -= py * P + P / 2; });
    return { x: x / manifest.scene.parcels.length, z: z / manifest.scene.parcels.length };
  }

  function buildScene(manifest) {
    const root = new THREE.Group();
    root.name = `scene:${manifest.scene.base}`;
    const base = SceneRules.parse(manifest.scene.base);
    manifest.entities.forEach((entity) => {
      const group = buildEntity(entity);
      placeGroup(group, entity, base);
      root.add(group);
    });
    return root;
  }

  function unbuild(id) {
    const entry = built.get(id);
    if (!entry) return;
    release(entry.root);
    if (entry.root.parent) entry.root.parent.remove(entry.root);
    built.delete(id);
  }

  let lastUpdate = 0;
  function update() {
    if (!scenesRoot || typeof avatar === 'undefined') return;
    const position = avatar.position;
    // Scenes removed, replaced or no longer owned
    built.forEach((entry, id) => {
      if (published[id] !== entry.manifest || !sceneValid(entry.manifest)) unbuild(id);
    });
    let builtThisTick = false;
    // Nearest scenes first (one is built per tick)
    const distanceTo = (manifest) => { const c = sceneCenter(manifest); return Math.hypot(c.x - position.x, c.z - position.z); };
    Object.entries(published).sort((a, b) => distanceTo(a[1]) - distanceTo(b[1])).forEach(([id, manifest]) => {
      const editing = editor && manifest.scene.parcels.some((parcel) => editor.parcels.has(parcel));
      const center = sceneCenter(manifest);
      const distance = Math.hypot(center.x - position.x, center.z - position.z);
      const entry = built.get(id);
      if (!entry) {
        // One scene per tick so loading never stalls a frame for long
        if (!editing && !builtThisTick && distance < LOAD_DISTANCE && sceneValid(manifest)) {
          const root = buildScene(manifest);
          scenesRoot.add(root);
          built.set(id, { root, manifest });
          builtThisTick = true;
        }
        return;
      }
      // Being edited: the Builder shows the draft instead
      if (editing) { unbuild(id); return; }
      // Far: detached, so it neither draws nor collides
      const show = distance < HIDE_DISTANCE;
      if (show && entry.root.parent !== scenesRoot) scenesRoot.add(entry.root);
      else if (!show && entry.root.parent) scenesRoot.remove(entry.root);
    });
    // Decentraland-style scene name when entering a scene
    const parcel = parcelKeyAt(position.x, position.z);
    const scene = sceneAt(parcel);
    const id = scene ? scene.scene.base : null;
    if (id !== currentSceneId) {
      currentSceneId = id;
      if (scene && !editor) showBanner(scene.display.title, `by ${scene.owner}${scene.display.description ? ` · ${scene.display.description}` : ''}`);
    }
  }

  function showBanner(title, subtitle) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sb-scene-banner';
      banner.innerHTML = '<b></b><span></span>';
      document.body.appendChild(banner);
    }
    banner.querySelector('b').textContent = title;
    banner.querySelector('span').textContent = subtitle;
    banner.classList.add('show');
    clearTimeout(showBanner.timer);
    showBanner.timer = setTimeout(() => banner.classList.remove('show'), 3500);
  }

  // The owner sign of a plot gives way to the scene built on it
  function scenesChanged() {
    if (typeof CityMap !== 'undefined') CityMap.refresh();
    City.refreshOwnedParcels();
  }

  function setPublished(list) {
    published = {};
    (list || []).forEach((manifest) => { published[manifest.scene.base] = manifest; });
    scenesChanged();
  }

  function applyPublished({ scene, replaced = [] }) {
    replaced.forEach((id) => { delete published[id]; });
    if (scene) published[scene.scene.base] = scene;
    scenesChanged();
  }

  // --------------------------------------------------------------------------
  // Persistence: the server (socket.io) or, in solo mode, this browser
  // --------------------------------------------------------------------------
  function loadSolo() {
    try { solo = JSON.parse(localStorage.getItem(SOLO_KEY)) || solo; } catch (error) { /* storage blocked */ }
    solo.published = solo.published || {};
    solo.drafts = solo.drafts || {};
  }
  function saveSolo() {
    try { localStorage.setItem(SOLO_KEY, JSON.stringify(solo)); } catch (error) { /* storage blocked */ }
  }
  function soloLands() {
    try { return JSON.parse(localStorage.getItem(SOLO_LANDS_KEY)) || {}; } catch (error) { return {}; }
  }

  // Same rules as the server, in solo mode
  function storeSolo(manifest, publish) {
    const result = SceneRules.validate(manifest, { owner: me(), ownerOf });
    if (!result.ok) return result;
    const scene = { ...result.manifest, updatedAt: Date.now() };
    const parcels = new Set(scene.scene.parcels);
    const replaced = [];
    [solo.drafts, ...(publish ? [solo.published] : [])].forEach((bucket) => {
      Object.keys(bucket).forEach((id) => {
        if (id !== scene.scene.base && bucket[id].scene.parcels.some((parcel) => parcels.has(parcel))) {
          if (bucket === solo.published) replaced.push(id);
          delete bucket[id];
        }
      });
    });
    solo.drafts[scene.scene.base] = scene;
    if (publish) {
      solo.published[scene.scene.base] = scene;
      applyPublished({ scene, replaced });
    }
    saveSolo();
    return { ok: true, scene, stats: result.stats };
  }

  function request(event, payload) {
    return new Promise((resolve) => {
      if (!online()) { resolve({ ok: false, error: 'Not connected to the server.' }); return; }
      const timer = setTimeout(() => resolve({ ok: false, error: 'The server did not answer. Try again.' }), 10000);
      hooks.socket.emit(event, payload, (response) => { clearTimeout(timer); resolve(response || { ok: false, error: 'No answer.' }); });
    });
  }

  // Saved drafts and published scenes that overlap these parcels
  async function loadExisting(parcels) {
    if (hooks.socket) {
      const response = await request('scene_load', { parcels });
      return response.ok ? response.scenes : [];
    }
    const set = new Set(parcels);
    const found = {};
    [solo.published, solo.drafts].forEach((bucket) => Object.values(bucket).forEach((scene) => {
      if (scene.scene.parcels.some((parcel) => set.has(parcel))) found[scene.scene.base] = scene;
    }));
    return Object.values(found);
  }

  // --------------------------------------------------------------------------
  // Builder
  // --------------------------------------------------------------------------
  const newId = () => `e${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
  const snapshot = () => JSON.stringify({ entities: editor.manifest.entities, spawnPoints: editor.manifest.spawnPoints });

  async function tryEnter() {
    const position = avatar.position;
    if (City.districtAt(position.x, position.z)) return false; // districts keep their own keys
    const parcel = parcelKeyAt(position.x, position.z);
    let owner = ownerOf(parcel);
    if (!hooks.socket && !owner && City.landAt(position.x, position.z) === 'land') {
      // Solo mode: empty parcels can be claimed in this browser to try the Builder
      const lands = soloLands();
      lands[parcel] = { owner: me(), boughtAt: Date.now(), paidWith: 'solo' };
      try { localStorage.setItem(SOLO_LANDS_KEY, JSON.stringify(lands)); } catch (error) { /* storage blocked */ }
      City.setLandOwners(lands);
      owner = me();
      hooks.system(`Solo mode: parcel ${parcel} is yours in this browser. Run "npm start" to build on real land with other devs.`);
    }
    if (!SceneRules.sameName(owner, me())) {
      hooks.system(owner ? `Parcel ${parcel} belongs to ${owner}. You can only build on land you own (B on your parcel).` : `You do not own parcel ${parcel}. Buy it first (/buyland, 250 MVC), then press B to build.`);
      return true;
    }
    const parcels = SceneRules.estateOf(parcel, ownerOf);
    if (parcels.length > SceneRules.MAX_PARCELS) { hooks.system(`Your estate has ${parcels.length} parcels; a scene can span at most ${SceneRules.MAX_PARCELS}.`); return true; }
    enter(parcels, await loadExisting(parcels));
    return true;
  }

  // Merges the scenes found on the estate into one draft (re-based on the estate base)
  function enter(parcels, existing) {
    if (editor) return;
    const base = SceneRules.baseOf(parcels);
    const [bx, by] = SceneRules.parse(base);
    const primary = existing.find((scene) => scene.scene.base === base) || existing[0];
    const manifest = {
      display: { title: primary ? primary.display.title : `${me()}'s scene`, description: primary ? primary.display.description : '' },
      owner: me(),
      scene: { parcels: parcels.slice().sort(), base },
      spawnPoints: [],
      entities: []
    };
    existing.forEach((scene) => {
      const [ox, oy] = SceneRules.parse(scene.scene.base);
      const dx = (ox - bx) * P;
      const dz = (oy - by) * P;
      scene.entities.forEach((entity) => manifest.entities.push({ ...entity, id: manifest.entities.some((other) => other.id === entity.id) ? newId() : entity.id, position: [entity.position[0] + dx, entity.position[1], entity.position[2] + dz], props: { ...entity.props } }));
      if (!manifest.spawnPoints.length && scene.spawnPoints && scene.spawnPoints[0]) {
        const p = scene.spawnPoints[0].position;
        manifest.spawnPoints.push({ name: 'spawn1', default: true, position: { x: p.x + dx, y: p.y, z: p.z + dz } });
      }
    });
    editor = {
      manifest,
      parcels: new Set(parcels),
      base: [bx, by],
      limits: SceneRules.limitsFor(parcels.length),
      root: new THREE.Group(),
      groups: new Map(),
      undo: [],
      redo: [],
      selected: null,
      placing: null, // { item } for a new item, or { moveId } while moving one
      ghost: null,
      ghostEntity: null,
      dirty: false,
      helpers: new THREE.Group(),
      selectionBox: null
    };
    editor.root.name = 'scene-editor';
    scenesRoot.add(editor.root);
    scene.add(editor.helpers);
    manifest.entities.forEach((entity) => addEntityGroup(entity));
    drawBounds();
    drawSpawn();
    openUi();
    renderAll();
    controls.maxDistance = 90;
    document.body.classList.add('scene-building');
    hooks.system(`Builder: ${parcels.length > 1 ? `estate of ${parcels.length} parcels` : `parcel ${base}`}. Pick an item in the catalog and click to place it. B exits.`);
  }

  function exit() {
    if (!editor) return;
    if (editor.dirty) save(false);
    clearGhost();
    editor.groups.forEach((group) => release(group));
    scenesRoot.remove(editor.root);
    scene.remove(editor.helpers);
    editor = null;
    controls.maxDistance = 40;
    document.body.classList.remove('scene-building');
    if (ui.panel) ui.panel.style.display = 'none';
    if (ui.limits) ui.limits.style.display = 'none';
    if (ui.hint) ui.hint.style.display = 'none';
    currentSceneId = undefined;
    hooks.system('Builder closed.');
  }

  function addEntityGroup(entity) {
    const group = buildEntity(entity);
    placeGroup(group, entity, editor.base);
    editor.root.add(group);
    editor.groups.set(entity.id, group);
  }

  function refreshEntity(entity) {
    const old = editor.groups.get(entity.id);
    if (old) { release(old); editor.root.remove(old); }
    addEntityGroup(entity);
  }

  function entityById(id) {
    return editor.manifest.entities.find((entity) => entity.id === id) || null;
  }

  function commit() {
    editor.undo.push(editor.pending || snapshot());
    if (editor.undo.length > 100) editor.undo.shift();
    editor.redo = [];
    editor.pending = null;
    editor.dirty = true;
  }

  function restore(state) {
    const parsed = JSON.parse(state);
    editor.groups.forEach((group) => { release(group); editor.root.remove(group); });
    editor.groups.clear();
    editor.manifest.entities = parsed.entities;
    editor.manifest.spawnPoints = parsed.spawnPoints;
    editor.manifest.entities.forEach((entity) => addEntityGroup(entity));
    if (editor.selected && !entityById(editor.selected)) editor.selected = null;
    editor.dirty = true;
    drawSpawn();
    renderAll();
  }

  function undo() {
    if (!editor.undo.length) { status('Nothing to undo.'); return; }
    editor.redo.push(snapshot());
    restore(editor.undo.pop());
    status('Undo.');
  }

  function redo() {
    if (!editor.redo.length) { status('Nothing to redo.'); return; }
    editor.undo.push(snapshot());
    restore(editor.redo.pop());
    status('Redo.');
  }

  function context() {
    return { parcels: editor.parcels, base: editor.base, limits: editor.limits };
  }

  // Problem with the scene if this entity were placed / changed (null when it fits)
  function problemWith(entity) {
    const problem = SceneRules.entityProblem(entity, context());
    if (problem) return problem;
    const others = editor.manifest.entities.filter((other) => other.id !== entity.id);
    return SceneRules.limitProblem(SceneRules.statsOf([...others, entity]), editor.limits);
  }

  // Applies a change to an entity; refused (and reverted) when out of bounds or over limits
  function changeEntity(id, change) {
    const entity = entityById(id);
    if (!entity) return false;
    const next = SceneRules.sanitizeEntity({ ...entity, ...change, props: { ...entity.props, ...(change.props || {}) } });
    if (!next) { status('Invalid value.', true); return false; }
    const problem = problemWith(next);
    if (problem) { status(`Refused. ${problem}`, true); renderSelected(); return false; }
    editor.pending = snapshot();
    commit();
    Object.assign(entity, next);
    refreshEntity(entity);
    renderAll();
    return true;
  }

  function placeEntity(entity) {
    const problem = problemWith(entity);
    if (problem) { status(`Refused. ${problem}`, true); if (typeof Sound !== 'undefined') Sound.play('click'); return false; }
    editor.pending = snapshot();
    commit();
    editor.manifest.entities.push(entity);
    addEntityGroup(entity);
    editor.selected = entity.id;
    renderAll();
    status(`Placed ${SceneRules.CATALOG[entity.item].name}.`);
    return true;
  }

  function deleteSelected() {
    if (!editor.selected) return;
    const entity = entityById(editor.selected);
    editor.pending = snapshot();
    commit();
    editor.manifest.entities = editor.manifest.entities.filter((other) => other.id !== editor.selected);
    const group = editor.groups.get(editor.selected);
    if (group) { release(group); editor.root.remove(group); }
    editor.groups.delete(editor.selected);
    editor.selected = null;
    renderAll();
    status(`Deleted ${entity ? SceneRules.CATALOG[entity.item].name : 'item'}.`);
  }

  function startPlacing(item) {
    clearGhost();
    editor.placing = { item, rotation: 0, scale: 1, lift: 0 };
    editor.selected = null;
    renderAll();
    status(`Placing ${SceneRules.CATALOG[item].name}: click to place, R rotates, [ ] scale, Esc stops.`);
  }

  function startMoving() {
    const entity = editor.selected && entityById(editor.selected);
    if (!entity) { status('Select an item first (click it).'); return; }
    clearGhost();
    editor.placing = { moveId: entity.id, item: entity.item, rotation: entity.rotation[1], scale: entity.scale[0], lift: 0 };
    const group = editor.groups.get(entity.id);
    if (group) group.visible = false;
    status('Moving: click to drop it, Esc cancels.');
  }

  function clearGhost() {
    if (!editor) return;
    if (editor.ghost) { release(editor.ghost); scene.remove(editor.ghost); }
    editor.ghost = null;
    editor.ghostEntity = null;
    editor.ghostProblem = null;
    if (editor.placing && editor.placing.moveId) {
      const group = editor.groups.get(editor.placing.moveId);
      if (group) group.visible = true;
    }
    editor.placing = null;
  }

  const ghostMaterials = {};
  function ghostMaterial(valid) {
    const key = valid ? 'ok' : 'bad';
    if (!ghostMaterials[key]) ghostMaterials[key] = new THREE.MeshBasicMaterial({ color: valid ? '#51cf66' : '#ff6b6b', transparent: true, opacity: 0.42, depthWrite: false });
    return ghostMaterials[key];
  }

  // Ghost preview under the pointer (snapped to the grid)
  function updateGhost(point) {
    const placing = editor.placing;
    if (!placing || !point) return;
    const snap = (value) => (ui.snap && !ui.snap.checked ? Math.round(value * 100) / 100 : Math.round(value / SNAP) * SNAP);
    const localX = snap(point.x - editor.base[0] * P);
    const localZ = snap(-point.z - editor.base[1] * P);
    const localY = Math.max(0, Math.round((point.y - ground() + placing.lift) * 20) / 20);
    const source = placing.moveId ? entityById(placing.moveId) : null;
    const entity = SceneRules.sanitizeEntity({
      id: placing.moveId || 'ghost',
      item: placing.item,
      position: [localX, localY, localZ],
      rotation: [0, placing.rotation, 0],
      scale: source ? source.scale : [placing.scale, placing.scale, placing.scale],
      props: source ? source.props : {}
    });
    if (!editor.ghost || editor.ghost.userData.item !== placing.item) {
      if (editor.ghost) { release(editor.ghost); scene.remove(editor.ghost); }
      editor.ghost = buildEntity(entity, { live: false });
      release(editor.ghost);
      editor.ghost.userData.item = placing.item;
      editor.ghost.traverse((node) => { node.raycast = () => {}; node.castShadow = false; });
      scene.add(editor.ghost);
    }
    const problem = problemWith(entity);
    editor.ghost.traverse((node) => { if (node.isMesh) node.material = ghostMaterial(!problem); if (node.isSprite) node.visible = false; });
    placeGroup(editor.ghost, entity, editor.base);
    editor.ghostEntity = entity;
    editor.ghostProblem = problem;
  }

  function dropGhost() {
    const placing = editor.placing;
    const entity = editor.ghostEntity;
    if (!placing || !entity) return;
    if (placing.moveId) {
      const moved = changeEntity(placing.moveId, { position: entity.position, rotation: entity.rotation });
      if (moved) { clearGhost(); status('Moved.'); }
      return;
    }
    placeEntity({ ...entity, id: newId() });
  }

  // --------------------------------------------------------------------------
  // Pointer: ghost, place, select
  // --------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let lastPointer = null;
  let pointerDown = null;

  function pointerHit(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.camera = camera;
    const hits = raycaster.intersectObject(editor.root, true).filter((hit) => hit.object.visible && !hit.object.isSprite && !hit.object.isLine);
    let selectable = null;
    for (let node = hits[0] && hits[0].object; node; node = node.parent) if (node.userData.entityId) { selectable = node.userData.entityId; break; }
    groundPlane.constant = -ground();
    const groundPoint = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    const point = hits[0] && (!groundPoint || hits[0].distance < raycaster.ray.origin.distanceTo(groundPoint)) ? hits[0].point : groundPoint;
    return { point, entityId: selectable };
  }

  function onPointerMove(event) {
    if (!editor || !editor.placing) return;
    lastPointer = event;
    updateGhost(pointerHit(event).point);
  }

  function onPointerDown(event) {
    pointerDown = editor ? { x: event.clientX, y: event.clientY } : null;
  }

  function onPointerUp(event) {
    if (!editor || !pointerDown || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 5) return;
    if (editor.placing) {
      updateGhost(pointerHit(event).point);
      dropGhost();
      return;
    }
    const hit = pointerHit(event);
    editor.selected = hit.entityId;
    renderAll();
    if (hit.entityId) status(`Selected ${SceneRules.CATALOG[entityById(hit.entityId).item].name}: G moves, R rotates, [ ] scale, PageUp/PageDown raise, Delete removes.`);
  }

  // --------------------------------------------------------------------------
  // Keys (main.js calls handleKey first; true = handled)
  // --------------------------------------------------------------------------
  function handleKey(event) {
    const key = event.key.toLowerCase();
    if (!editor) {
      if (key === 'b' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && typeof avatar !== 'undefined' && !City.districtAt(avatar.position.x, avatar.position.z)) {
        tryEnter();
        return true;
      }
      return false;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return true; }
    if (ctrl && key === 'y') { event.preventDefault(); redo(); return true; }
    if (ctrl && key === 's') { event.preventDefault(); save(false); return true; }
    if (ctrl && key === 'd') { event.preventDefault(); duplicate(); return true; }
    if (ctrl) return false;
    const target = editor.placing || null;
    const selected = editor.selected && entityById(editor.selected);
    switch (key) {
      case 'b': exit(); return true;
      case 'escape':
        if (editor.placing) { clearGhost(); status('Placement cancelled.'); } else if (editor.selected) { editor.selected = null; renderAll(); } else exit();
        return true;
      case 'r': {
        const step = event.shiftKey ? -45 : 45;
        if (target) { target.rotation = (target.rotation + step + 360) % 360; if (lastPointer) onPointerMove(lastPointer); } else if (selected) changeEntity(selected.id, { rotation: [0, selected.rotation[1] + step, 0] });
        return true;
      }
      case 'g': startMoving(); return true;
      case 'delete':
      case 'backspace': event.preventDefault(); deleteSelected(); return true;
      case '[':
      case ']':
      case '-':
      case '=': {
        const factor = key === ']' || key === '=' ? 1.1 : 1 / 1.1;
        if (target && !target.moveId) { target.scale = Math.min(20, Math.max(0.1, Math.round(target.scale * factor * 100) / 100)); if (lastPointer) onPointerMove(lastPointer); } else if (selected) changeEntity(selected.id, { scale: selected.scale.map((value) => Math.round(value * factor * 100) / 100) });
        return true;
      }
      case 'pageup':
      case 'pagedown': {
        event.preventDefault();
        const step = key === 'pageup' ? 0.25 : -0.25;
        if (target) { target.lift += step; if (lastPointer) onPointerMove(lastPointer); } else if (selected) changeEntity(selected.id, { position: [selected.position[0], Math.max(0, selected.position[1] + step), selected.position[2]] });
        return true;
      }
      default: return false;
    }
  }

  function duplicate() {
    const entity = editor.selected && entityById(editor.selected);
    if (!entity) { status('Select an item to duplicate.'); return; }
    const copy = { ...JSON.parse(JSON.stringify(entity)), id: newId() };
    copy.position[0] += 1;
    if (placeEntity(copy)) status('Duplicated (moved 1 m east).');
  }

  function setSpawn() {
    const local = { x: Math.round((avatar.position.x - editor.base[0] * P) * 100) / 100, y: Math.max(0, Math.round((avatar.position.y - ground()) * 100) / 100), z: Math.round((-avatar.position.z - editor.base[1] * P) * 100) / 100 };
    const parcel = `${editor.base[0] + Math.floor(local.x / P)},${editor.base[1] + Math.floor(local.z / P)}`;
    if (!editor.parcels.has(parcel)) { status('Refused. Stand inside your scene to set its spawn point.', true); return; }
    editor.pending = snapshot();
    commit();
    editor.manifest.spawnPoints = [{ name: 'spawn1', default: true, position: local }];
    drawSpawn();
    status(`Spawn point set at (${local.x}, ${local.y}, ${local.z}). /goto ${editor.manifest.scene.base} lands here.`);
  }

  // --------------------------------------------------------------------------
  // Bounds outline, height limit and spawn marker (Builder only)
  // --------------------------------------------------------------------------
  function drawBounds() {
    const { parcels, limits } = editor;
    const ground0 = ground() + 0.06;
    const top = ground() + limits.height;
    const points = [];
    const walls = [];
    parcels.forEach((parcel) => {
      const [px, py] = SceneRules.parse(parcel);
      const x0 = px * P;
      const x1 = x0 + P;
      const z0 = -py * P; // south edge (larger z)
      const z1 = z0 - P; // north edge
      [[`${px - 1},${py}`, [x0, z0], [x0, z1]], [`${px + 1},${py}`, [x1, z0], [x1, z1]], [`${px},${py - 1}`, [x0, z0], [x1, z0]], [`${px},${py + 1}`, [x0, z1], [x1, z1]]].forEach(([neighbor, a, b]) => {
        if (parcels.has(neighbor)) return;
        points.push(a[0], ground0, a[1], b[0], ground0, b[1]);
        points.push(a[0], top, a[1], b[0], top, b[1]);
        points.push(a[0], ground0, a[1], a[0], top, a[1]);
        walls.push([a, b]);
      });
    });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color: '#ffd43b' }));
    lines.raycast = () => {};
    editor.helpers.add(lines);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false });
    const strip = new THREE.MeshBasicMaterial({ color: '#ffd43b' });
    const add = (object) => { object.raycast = () => {}; object.castShadow = false; editor.helpers.add(object); };
    walls.forEach(([a, b]) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const alongZ = a[0] === b[0];
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, limits.height), wallMaterial);
      wall.position.set((a[0] + b[0]) / 2, ground() + limits.height / 2, (a[1] + b[1]) / 2);
      if (alongZ) wall.rotation.y = Math.PI / 2;
      add(wall);
      // Bright strips on the ground and at the height limit (lines are 1 px wide)
      [[0.07, 0.25, 0.06], [limits.height, 0.12, 0.12]].forEach(([y, width, thick]) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? width : length, thick, alongZ ? length : width), strip);
        edge.position.set((a[0] + b[0]) / 2, ground() + y, (a[1] + b[1]) / 2);
        add(edge);
      });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, limits.height, 0.12), strip);
      post.position.set(a[0], ground() + limits.height / 2, a[1]);
      add(post);
    });
    // Grid on the ground of the scene (1 m cells)
    parcels.forEach((parcel) => {
      const [px, py] = SceneRules.parse(parcel);
      const grid = new THREE.GridHelper(P, P, '#ffe066', '#ffffff');
      grid.material.transparent = true;
      grid.material.opacity = 0.18;
      grid.position.set(px * P + P / 2, ground() + 0.05, -(py * P + P / 2));
      grid.raycast = () => {};
      editor.helpers.add(grid);
    });
    const label = kit().textSprite(`Height limit ${limits.height} m`, { width: 5, background: 'rgba(230, 160, 0, 0.85)' });
    const [bx, by] = editor.base;
    label.position.set(bx * P + 2.5, top + 0.8, -(by * P) - 0.5);
    editor.helpers.add(label);
  }

  function drawSpawn() {
    if (!editor) return;
    if (editor.spawnMarker) editor.helpers.remove(editor.spawnMarker);
    editor.spawnMarker = null;
    const spawn = editor.manifest.spawnPoints[0];
    if (!spawn) return;
    const { cylinder, glow, textSprite } = kit();
    const marker = new THREE.Group();
    const disc = cylinder(0.6, 0.6, 0.05, glow('#51cf66', 1), 0, 0.03, 0, 24);
    disc.raycast = () => {};
    marker.add(disc);
    const label = textSprite('Spawn point', { width: 2.6, background: 'rgba(43, 138, 62, 0.9)' });
    label.position.y = 2.2;
    marker.add(label);
    marker.position.set(editor.base[0] * P + spawn.position.x, ground() + spawn.position.y, -(editor.base[1] * P + spawn.position.z));
    editor.spawnMarker = marker;
    editor.helpers.add(marker);
  }

  function drawSelection() {
    if (editor.selectionBox) { editor.helpers.remove(editor.selectionBox); editor.selectionBox = null; }
    const group = editor.selected && editor.groups.get(editor.selected);
    if (!group) return;
    group.updateMatrixWorld(true);
    editor.selectionBox = new THREE.BoxHelper(group, 0x4dabf7);
    editor.selectionBox.raycast = () => {};
    editor.helpers.add(editor.selectionBox);
  }

  // --------------------------------------------------------------------------
  // Builder UI: catalog, scene info, selected item, limits HUD
  // --------------------------------------------------------------------------
  const ui = {};
  function injectStyle() {
    if (document.getElementById('sb-style')) return;
    const style = document.createElement('style');
    style.id = 'sb-style';
    style.textContent = `
      #sb-panel { position: fixed; left: 12px; top: 54px; bottom: 12px; width: 300px; z-index: 60; display: none; flex-direction: column; gap: 8px; overflow-y: auto;
        background: rgba(22, 21, 32, 0.94); color: #f1f3f5; border: 1px solid #3a3755; border-radius: 12px; padding: 12px; font: 13px 'Segoe UI', Arial, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
      #sb-panel h3 { margin: 0; font-size: 15px; letter-spacing: .04em; color: #ff6b86; }
      #sb-panel h4 { margin: 6px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #a5a3c2; }
      #sb-panel .sb-sub { color: #a5a3c2; font-size: 12px; }
      #sb-panel input[type=text], #sb-panel textarea, #sb-panel input[type=number] { width: 100%; box-sizing: border-box; background: #25233a; color: #fff; border: 1px solid #3a3755; border-radius: 6px; padding: 5px 7px; font: inherit; }
      #sb-panel textarea { resize: vertical; min-height: 44px; }
      #sb-catalog { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
      #sb-catalog button { background: #25233a; color: #f1f3f5; border: 1px solid #3a3755; border-radius: 7px; padding: 5px 2px; font: 600 10px 'Segoe UI', Arial, sans-serif; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; line-height: 1.1; }
      #sb-catalog button i { width: 20px; height: 10px; border-radius: 3px; display: block; }
      #sb-panel .sb-foot { position: sticky; bottom: -12px; margin: auto -12px -12px; padding: 8px 12px 12px; background: rgba(22, 21, 32, 0.98); border-top: 1px solid #3a3755; display: flex; flex-direction: column; gap: 6px; }
      #sb-catalog button:hover, #sb-catalog button.active { border-color: #ff6b86; background: #3a2340; }
      #sb-catalog .sb-cat { grid-column: 1 / -1; font-size: 10px; color: #a5a3c2; text-transform: uppercase; letter-spacing: .1em; margin-top: 4px; }
      #sb-panel .sb-row { display: flex; gap: 5px; flex-wrap: wrap; }
      #sb-panel .sb-row button { flex: 1; min-width: 60px; background: #3a3755; color: #fff; border: 0; border-radius: 7px; padding: 7px 6px; font: 600 12px 'Segoe UI', Arial, sans-serif; cursor: pointer; }
      #sb-panel .sb-row button.primary { background: #e0254f; }
      #sb-panel .sb-row button.go { background: #2b8a3e; }
      #sb-panel .sb-grid3 { display: grid; grid-template-columns: 18px 1fr 1fr 1fr; gap: 4px; align-items: center; font-size: 11px; color: #a5a3c2; }
      #sb-status { min-height: 32px; font-size: 12px; color: #c3fae8; background: #1b2b2a; border-radius: 6px; padding: 6px 8px; }
      #sb-status.error { color: #ffc9c9; background: #3b1d22; }
      #sb-limits { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 60; display: none; gap: 14px; background: rgba(22, 21, 32, 0.92); color: #fff;
        border: 1px solid #3a3755; border-radius: 10px; padding: 8px 14px; font: 12px 'Segoe UI', Arial, sans-serif; }
      #sb-limits div { min-width: 92px; } #sb-limits b { display: block; font-size: 10px; color: #a5a3c2; text-transform: uppercase; letter-spacing: .08em; }
      #sb-limits s { display: block; height: 4px; background: #3a3755; border-radius: 2px; margin-top: 3px; text-decoration: none; overflow: hidden; }
      #sb-limits s i { display: block; height: 100%; background: #51cf66; }
      #sb-limits div.warn s i { background: #fcc419; } #sb-limits div.over s i { background: #ff6b6b; } #sb-limits div.over { color: #ff8787; }
      #sb-hint { position: fixed; bottom: 72px; left: 330px; right: 12px; margin: 0 auto; width: max-content; max-width: calc(100vw - 345px); z-index: 60; display: none; background: rgba(22, 21, 32, 0.88); color: #dee2e6; border-radius: 8px; padding: 6px 12px; font: 12px/1.9 'Segoe UI', Arial, sans-serif; text-align: center; }
      #sb-hint kbd { background: #3a3755; border-radius: 4px; padding: 1px 5px; font: 600 11px monospace; color: #fff; }
      #sb-scene-banner { position: fixed; top: 84px; left: 50%; transform: translate(-50%, -10px); z-index: 55; opacity: 0; pointer-events: none; transition: opacity .5s, transform .5s;
        background: rgba(17, 15, 26, 0.82); color: #fff; padding: 10px 22px; border-radius: 12px; text-align: center; font: 13px 'Segoe UI', Arial, sans-serif; max-width: 70vw; }
      #sb-scene-banner.show { opacity: 1; transform: translate(-50%, 0); }
      #sb-scene-banner b { display: block; font-size: 20px; letter-spacing: .02em; } #sb-scene-banner span { color: #ced4da; }
      body.scene-building #chat-panel { opacity: 0.35; }
    `;
    document.head.appendChild(style);
  }

  function openUi() {
    injectStyle();
    if (!ui.panel) buildUi();
    ui.panel.style.display = 'flex';
    ui.limits.style.display = 'flex';
    ui.hint.style.display = 'block';
    ui.title.value = editor.manifest.display.title;
    ui.description.value = editor.manifest.display.description;
    const parcels = [...editor.parcels];
    ui.where.textContent = parcels.length > 1 ? `Estate of ${parcels.length} parcels · base ${editor.manifest.scene.base}` : `Parcel ${editor.manifest.scene.base}`;
    status(online() || !hooks.socket ? 'Pick an item, then click inside the yellow outline.' : 'Offline: reconnect to save.');
  }

  function buildUi() {
    const panel = document.createElement('div');
    panel.id = 'sb-panel';
    const categories = {};
    Object.entries(SceneRules.CATALOG).forEach(([key, item]) => { (categories[item.category] = categories[item.category] || []).push([key, item]); });
    panel.innerHTML = `
      <h3>SCENE BUILDER</h3><div class="sb-sub" data-id="where"></div>
      <h4>Scene</h4>
      <input type="text" data-id="title" maxlength="60" placeholder="Scene title">
      <textarea data-id="description" maxlength="280" placeholder="Description"></textarea>
      <h4>Selected</h4>
      <div data-id="selected" class="sb-sub">Nothing selected. Click an item in the scene.</div>
      <h4>Catalog</h4>
      <div id="sb-catalog">${Object.entries(categories).map(([category, items]) => `<span class="sb-cat">${category}</span>${items.map(([key, item]) => `<button type="button" data-item="${key}" title="${item.size.join(' x ')} m"><i style="background:${item.color}"></i>${item.name}</button>`).join('')}`).join('')}</div>
      <label class="sb-sub"><input type="checkbox" data-id="snap" checked> Snap to 0.5 m grid</label>
      <div class="sb-foot">
        <div class="sb-row"><button type="button" data-act="undo">Undo</button><button type="button" data-act="redo">Redo</button><button type="button" data-act="spawn">Set spawn here</button></div>
        <div class="sb-row"><button type="button" data-act="save">Save</button><button type="button" data-act="publish" class="primary">Publish</button><button type="button" data-act="exit">Exit (B)</button></div>
        <div id="sb-status"></div>
      </div>`;
    document.body.appendChild(panel);
    const pick = (id) => panel.querySelector(`[data-id="${id}"]`);
    Object.assign(ui, { panel, where: pick('where'), title: pick('title'), description: pick('description'), snap: pick('snap'), selected: pick('selected'), status: panel.querySelector('#sb-status') });
    ui.title.addEventListener('change', () => { editor.manifest.display.title = ui.title.value.trim().slice(0, 60); editor.dirty = true; });
    ui.description.addEventListener('change', () => { editor.manifest.display.description = ui.description.value.trim().slice(0, 280); editor.dirty = true; });
    panel.querySelectorAll('[data-item]').forEach((button) => button.addEventListener('click', () => { startPlacing(button.dataset.item); renderCatalog(); button.blur(); }));
    const actions = { undo, redo, spawn: setSpawn, save: () => save(false), publish: () => save(true), exit };
    panel.querySelectorAll('[data-act]').forEach((button) => button.addEventListener('click', () => { actions[button.dataset.act](); button.blur(); }));
    // Keys typed in the panel fields never trigger shortcuts (main.js skips
    // inputs); buttons give the focus back so R, G, B... keep working
    ui.limits = document.createElement('div');
    ui.limits.id = 'sb-limits';
    document.body.appendChild(ui.limits);
    ui.hint = document.createElement('div');
    ui.hint.id = 'sb-hint';
    ui.hint.innerHTML = 'Click: place / select · <kbd>G</kbd> move · <kbd>R</kbd> rotate · <kbd>[</kbd> <kbd>]</kbd> scale · <kbd>PgUp</kbd> <kbd>PgDn</kbd> height · <kbd>Del</kbd> delete · <kbd>Ctrl+Z</kbd> undo · <kbd>Ctrl+Y</kbd> redo · <kbd>Ctrl+D</kbd> duplicate · <kbd>Esc</kbd> cancel · <kbd>B</kbd> exit';
    document.body.appendChild(ui.hint);
  }

  function status(text, error = false) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.toggle('error', error);
  }

  function renderCatalog() {
    ui.panel.querySelectorAll('[data-item]').forEach((button) => button.classList.toggle('active', Boolean(editor.placing && !editor.placing.moveId && editor.placing.item === button.dataset.item)));
  }

  function renderLimits() {
    const stats = SceneRules.statsOf(editor.manifest.entities);
    const limits = editor.limits;
    const rows = [['Entities', stats.entities, limits.entities], ['Triangles', stats.triangles, limits.triangles], ['Height', stats.height, limits.height, ' m'], ['Materials', stats.materials, limits.materials], ['Textures', stats.textures, limits.textures]];
    ui.limits.innerHTML = rows.map(([label, value, max, unit = '']) => {
      const ratio = max ? value / max : 0;
      return `<div class="${ratio > 1 ? 'over' : ratio > 0.8 ? 'warn' : ''}"><b>${label}</b>${value}${unit} / ${max}${unit}<s><i style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></i></s></div>`;
    }).join('');
  }

  // Inspector of the selected item: properties, position, rotation, scale
  function renderSelected() {
    const entity = editor.selected && entityById(editor.selected);
    if (!entity) { ui.selected.textContent = 'Nothing selected. Click an item in the scene.'; return; }
    const item = SceneRules.CATALOG[entity.item];
    const field = (name, value, placeholder = '') => `<input type="text" data-prop="${name}" value="${String(value || '').replace(/"/g, '&quot;')}" placeholder="${placeholder}">`;
    ui.selected.innerHTML = `
      <div style="color:#fff;font-weight:600;margin-bottom:4px">${item.name}</div>
      <label>Color <input type="color" data-prop="color" value="${entity.props.color}"></label>
      ${entity.item === 'sign' ? `<div>Text ${field('text', entity.props.text, 'Sign text')}</div>` : ''}
      ${entity.item === 'screen' ? `<div>YouTube or image link (https) ${field('url', entity.props.url, 'https://www.youtube.com/watch?v=...')}</div>` : ''}
      ${entity.item === 'portal' ? `<div>Destination (place or parcel x,y) ${field('place', entity.props.place, 'plaza or 30,-12')}</div>` : ''}
      <div class="sb-grid3" style="margin-top:6px"><span>Pos</span>${[0, 1, 2].map((i) => `<input type="number" step="0.5" data-pos="${i}" value="${entity.position[i]}">`).join('')}
      <span>Rot</span><input type="number" step="15" data-rot="1" value="${entity.rotation[1]}"><span></span><span></span>
      <span>Scl</span>${[0, 1, 2].map((i) => `<input type="number" step="0.1" min="0.1" max="20" data-scale="${i}" value="${entity.scale[i]}">`).join('')}</div>
      <div class="sb-row" style="margin-top:6px"><button type="button" data-do="move">Move (G)</button><button type="button" data-do="dup">Duplicate</button><button type="button" data-do="del">Delete</button></div>`;
    ui.selected.querySelectorAll('[data-prop]').forEach((input) => input.addEventListener('change', () => changeEntity(entity.id, { props: { [input.dataset.prop]: input.value } })));
    ui.selected.querySelectorAll('[data-pos]').forEach((input) => input.addEventListener('change', () => { const position = entity.position.slice(); position[Number(input.dataset.pos)] = Number(input.value); changeEntity(entity.id, { position }); }));
    ui.selected.querySelector('[data-rot]').addEventListener('change', (event) => changeEntity(entity.id, { rotation: [0, Number(event.target.value), 0] }));
    ui.selected.querySelectorAll('[data-scale]').forEach((input) => input.addEventListener('change', () => { const scale = entity.scale.slice(); scale[Number(input.dataset.scale)] = Number(input.value); changeEntity(entity.id, { scale }); }));
    ui.selected.querySelector('[data-do="move"]').addEventListener('click', startMoving);
    ui.selected.querySelector('[data-do="dup"]').addEventListener('click', duplicate);
    ui.selected.querySelector('[data-do="del"]').addEventListener('click', deleteSelected);
  }

  function renderAll() {
    if (!editor || !ui.panel) return;
    renderLimits();
    renderSelected();
    renderCatalog();
    drawSelection();
  }

  async function save(publish) {
    if (!editor) return;
    editor.manifest.display.title = ui.title.value.trim().slice(0, 60) || editor.manifest.display.title;
    editor.manifest.display.description = ui.description.value.trim().slice(0, 280);
    const manifest = JSON.parse(JSON.stringify(editor.manifest));
    status(publish ? 'Publishing...' : 'Saving...');
    const result = hooks.socket ? await request(publish ? 'scene_publish' : 'scene_save', manifest) : storeSolo(manifest, publish);
    if (!result.ok) { status(`Refused. ${result.error}`, true); hooks.system(`Scene not ${publish ? 'published' : 'saved'}: ${result.error}`); return; }
    if (editor) editor.dirty = false;
    const where = hooks.socket ? '' : ' (solo mode: stored in this browser)';
    status(publish ? `Published "${result.scene.display.title}": everyone can see it now${where}.` : `Draft saved${where}. Publish to show it to everyone.`);
    if (publish) hooks.system(`Scene "${result.scene.display.title}" published on ${result.scene.scene.parcels.length} parcel(s).`);
  }

  // --------------------------------------------------------------------------
  // /goto x,y: the scene spawn point when there is one, else the parcel center
  // --------------------------------------------------------------------------
  function gotoParcel(parcel) {
    const [px, py] = SceneRules.parse(parcel);
    const manifest = sceneAt(`${px},${py}`);
    const spawn = manifest && manifest.spawnPoints && manifest.spawnPoints[0];
    if (spawn) {
      const [bx, by] = SceneRules.parse(manifest.scene.base);
      hooks.flyTo(new THREE.Vector3(bx * P + spawn.position.x, ground() + spawn.position.y, -(by * P + spawn.position.z)), `Teleported to "${manifest.display.title}" (${parcel}).`);
    } else {
      hooks.flyTo(new THREE.Vector3(px * P + P / 2, 0, -(py * P + P / 2)), `Teleported to parcel ${px},${py}${manifest ? ` · "${manifest.display.title}"` : ''}.`);
    }
  }

  // --------------------------------------------------------------------------
  // Maps: scene outlines and titles on the city map (M) and the minimap
  // --------------------------------------------------------------------------
  function visibleScenes() {
    const list = Object.values(published).filter(sceneValid);
    if (editor) list.push(editor.manifest);
    return list;
  }

  function outline(ctx, manifest, toScreen) {
    const parcels = new Set(manifest.scene.parcels);
    ctx.beginPath();
    manifest.scene.parcels.forEach((parcel) => {
      const [px, py] = SceneRules.parse(parcel);
      const corners = { sw: toScreen(px * P, -py * P), se: toScreen(px * P + P, -py * P), nw: toScreen(px * P, -(py + 1) * P), ne: toScreen(px * P + P, -(py + 1) * P) };
      [[`${px - 1},${py}`, 'sw', 'nw'], [`${px + 1},${py}`, 'se', 'ne'], [`${px},${py - 1}`, 'sw', 'se'], [`${px},${py + 1}`, 'nw', 'ne']].forEach(([neighbor, a, b]) => {
        if (parcels.has(neighbor)) return;
        ctx.moveTo(corners[a][0], corners[a][1]);
        ctx.lineTo(corners[b][0], corners[b][1]);
      });
    });
    ctx.stroke();
  }

  function drawMap(ctx, toScreen, scale) {
    visibleScenes().forEach((manifest) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      outline(ctx, manifest, toScreen);
      if (scale < 0.7) return;
      const center = sceneCenter(manifest);
      const [sx, sy] = toScreen(center.x, center.z);
      ctx.font = `600 ${Math.max(10, Math.min(14, scale * 7))}px Segoe UI, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = manifest.display.title;
      const width = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(sx - width / 2, sy - 9, width, 18);
      ctx.fillStyle = '#ffe066';
      ctx.fillText(label, sx, sy);
    });
  }

  function drawMinimap(ctx, toMap, scale) {
    const mine = me();
    Object.entries(City.landOwners).forEach(([parcel, land]) => {
      const [px, py] = SceneRules.parse(parcel);
      const [x, y] = toMap(px * P, -(py + 1) * P);
      ctx.fillStyle = SceneRules.sameName(land.owner, mine) ? 'rgba(224, 37, 79, 0.85)' : 'rgba(47, 209, 122, 0.85)';
      ctx.fillRect(x, y, P * scale, P * scale);
    });
    visibleScenes().forEach((manifest) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      outline(ctx, manifest, toMap);
    });
  }

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  function init(options) {
    hooks = options;
    scenesRoot = new THREE.Group();
    scenesRoot.name = 'community-scenes';
    scenesRoot.userData.alwaysVisible = true;
    scene.add(scenesRoot);
    City.addCollidable(scenesRoot); // scenes are walkable and solid
    const canvas = renderer.domElement;
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    if (hooks.socket) {
      hooks.socket.on('scenes', setPublished);
      hooks.socket.on('scene_published', applyPublished);
      hooks.socket.on('lands', () => { if (typeof CityMap !== 'undefined') CityMap.refresh(); });
    } else {
      loadSolo();
      const lands = soloLands();
      if (Object.keys(lands).length) City.setLandOwners(lands);
      setPublished(Object.values(solo.published));
    }
    setInterval(() => {
      const now = performance.now();
      if (now - lastUpdate < 400) return;
      lastUpdate = now;
      update();
    }, 500);
  }

  return {
    init, handleKey, titleAt, sceneAt, gotoParcel, drawMap, drawMinimap,
    isBuilding: () => Boolean(editor),
    get published() { return published; },
    // For tests and tools
    _editor: () => editor,
    _enter: tryEnter,
    _place: (item, position, props = {}, rotation = 0, scale = 1) => (editor ? placeEntity(SceneRules.sanitizeEntity({ id: newId(), item, position, rotation: [0, rotation, 0], scale: [scale, scale, scale], props })) : false),
    _save: save,
    _check: (item, position, scale = 1) => (editor ? problemWith(SceneRules.sanitizeEntity({ id: 'probe', item, position, rotation: [0, 0, 0], scale: [scale, scale, scale], props: {} })) : 'not building'),
    _built: () => built,
    _buildEntity: (item) => buildEntity(SceneRules.sanitizeEntity({ id: 'probe', item, position: [0, 0, 0], props: {} }), { live: false })
  };
})();
