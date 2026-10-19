// ============================================================================
// THE MOB MAZE: A BLOCKY VOXEL DUNGEON LABYRINTH
// ============================================================================
// A dark dungeon hall of blue-grey stone bricks (pixel-art canvas textures with
// nearest filtering, 16x16 texels scaled up). Inside, a seeded grid maze of 4 m
// cells with raised checkered floor tiles, tall carved glyph pillars, golden
// lanterns hanging on chains and a central altar room with a treasure chest.
// Gameplay (local to each player):
// - Yellow pressure plates toggle gate walls up and down (real moving, collidable
//   meshes). Every room gate is linked to one plate; the other gates are
//   shortcuts. Gates only sit on walls of the perfect maze, so the maze is always
//   solvable whatever their state.
// - Red lava tiles (in dead ends) and patrolling cube mobs send the player back
//   to the maze entrance. Mobs walk on the corridor center line: hug a wall to
//   slip past them.
// - Pressing E on the chest finishes the run: the time is shown, the best time
//   is stored in localStorage (multiverse-mobmaze-best) and a purple trail from
//   the entrance to the altar lights up.
// Performance: walls, posts, floor tiles, pillars, lanterns and the roof are
// InstancedMeshes; only the gates, mobs and the altar are separate meshes.
const MobMaze = (() => {
  const { material, glow, animate, interactive, canvasTexture } = PropKit.kit;

  const CELL = 4;           // maze cell size (m)
  const N = 16;             // cells per side: the maze spans 64 x 64 m
  const HALF = (N * CELL) / 2;
  const ROOM_MIN = 6;       // the central 4 x 4 cells are the altar room
  const ROOM_MAX = 9;
  const ENTRY_COL = 7;      // the maze opens on the south side at this column
  const WALL_H = 4.5;
  const WALL_T = 1;
  const FLOOR_Y = 0.15;     // top of the base slab
  const TILE_Y = 0.35;      // top of the raised floor tiles
  const HALL = 38;          // inner face of the hall walls
  const CEILING = 12;
  const BEST_KEY = 'multiverse-mobmaze-best';

  const state = {
    group: null, gates: [], plates: [], mobs: [], hazards: [], trail: null,
    started: null, completed: false, lastReset: -10, entrance: new THREE.Vector3(), solutionCells: []
  };

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cellX = (i) => -HALF + CELL / 2 + i * CELL;
  const cellZ = (j) => -HALF + CELL / 2 + j * CELL;
  const inRoom = (i, j) => i >= ROOM_MIN && i <= ROOM_MAX && j >= ROOM_MIN && j <= ROOM_MAX;

  // --------------------------------------------------------------------------
  // Pixel-art textures (16x16 texels, nearest filtering for the voxel look)
  // --------------------------------------------------------------------------
  function pixelTexture(key, size, draw, repeat = true) {
    const texture = canvasTexture(`mobmaze-${key}`, size, size, (ctx, w, h) => {
      ctx.imageSmoothingEnabled = false;
      draw(ctx, w, h, seeded(key.split('').reduce((sum, c) => sum * 31 + c.charCodeAt(0), 11)));
    });
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  function px(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
  function noiseFill(ctx, w, h, random, base, spread) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = base + Math.floor((random() - 0.5) * spread);
        px(ctx, x, y, `rgb(${v},${v},${v})`);
      }
    }
  }

  // Stone bricks: 4 rows of bricks with dark mortar, greyscale (tinted by color)
  const brickTex = () => pixelTexture('bricks', 16, (ctx, w, h, random) => {
    noiseFill(ctx, w, h, random, 200, 50);
    ctx.fillStyle = '#4a4a4a';
    for (let row = 0; row < 4; row++) {
      ctx.fillRect(0, row * 4 + 3, w, 1);
      const offset = row % 2 ? 4 : 0;
      for (let x = offset; x < w; x += 8) ctx.fillRect(x, row * 4, 1, 3);
    }
    // a few chipped highlights and cracks
    for (let i = 0; i < 10; i++) px(ctx, Math.floor(random() * 16), Math.floor(random() * 16), random() > 0.5 ? '#f2f2f2' : '#6a6a6a');
  });

  // Carved glyph block: a squared spiral (greek key) in relief
  function glyphPattern(ctx, w, h, random, line, deep) {
    noiseFill(ctx, w, h, random, 190, 30);
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = line;
    // squared spiral
    const spiral = [[3, 3, 10, 1], [12, 3, 1, 10], [3, 12, 10, 1], [3, 5, 1, 8], [5, 5, 6, 1], [10, 5, 1, 6], [5, 10, 6, 1], [5, 7, 1, 3], [7, 7, 2, 1], [8, 7, 1, 2]];
    spiral.forEach(([x, y, sw, sh]) => ctx.fillRect(x, y, sw, sh));
  }
  const glyphTex = () => pixelTexture('glyph', 16, (ctx, w, h, random) => glyphPattern(ctx, w, h, random, '#3c3c46', '#2a2a30'));
  // Glowing core version: the carved channels burn orange
  const coreTex = () => pixelTexture('glyph-core', 16, (ctx, w, h, random) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const spiral = [[3, 3, 10, 1], [12, 3, 1, 10], [3, 12, 10, 1], [3, 5, 1, 8], [5, 5, 6, 1], [10, 5, 1, 6], [5, 10, 6, 1], [5, 7, 1, 3], [7, 7, 2, 1], [8, 7, 1, 2]];
    spiral.forEach(([x, y, sw, sh]) => { ctx.fillStyle = random() > 0.4 ? '#ff7a1a' : '#ff3b1f'; ctx.fillRect(x, y, sw, sh); });
  }, false);

  // Raised floor tile: bevelled square with a pixel inlay (greyscale, tinted)
  const tileTex = () => pixelTexture('tile', 16, (ctx, w, h, random) => {
    noiseFill(ctx, w, h, random, 215, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 0, 1, 16);
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(0, 15, 16, 1); ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = '#a8a8a8';
    [[4, 4], [11, 4], [4, 11], [11, 11]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    ctx.fillRect(6, 6, 4, 1); ctx.fillRect(6, 9, 4, 1); ctx.fillRect(6, 6, 1, 4); ctx.fillRect(9, 6, 1, 4);
  });

  // Dark floor stone for the hall and the base slab
  const slabTex = () => pixelTexture('slab', 16, (ctx, w, h, random) => {
    noiseFill(ctx, w, h, random, 120, 40);
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 7, 16, 1); ctx.fillRect(7, 0, 1, 7); ctx.fillRect(15, 8, 1, 8);
  });

  // Pressure plate: gold frame with a pixel rune
  const plateTex = () => pixelTexture('plate', 16, (ctx) => {
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b8860b'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = '#fff3a0'; ctx.fillRect(2, 2, 12, 1); ctx.fillRect(2, 2, 1, 12);
    ctx.fillStyle = '#d99a00';
    [[7, 3, 2, 10], [3, 7, 10, 2], [5, 5, 1, 1], [10, 5, 1, 1], [5, 10, 1, 1], [10, 10, 1, 1]].forEach(([x, y, sw, sh]) => ctx.fillRect(x, y, sw, sh));
  }, false);

  // Lava hazard: red / black checker with glowing cracks (scrolled in animate)
  const lavaTex = () => pixelTexture('lava', 16, (ctx, w, h, random) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const checker = ((x >> 2) + (y >> 2)) % 2 === 0;
        const r = random();
        px(ctx, x, y, checker ? (r > 0.8 ? '#ffb000' : r > 0.35 ? '#ff4d1a' : '#c41d0c') : (r > 0.85 ? '#7a0f08' : '#1a0606'));
      }
    }
  });

  // Void tile: black with faint purple specks (visual pits)
  const voidTex = () => pixelTexture('void', 16, (ctx, w, h, random) => {
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 12; i++) px(ctx, Math.floor(random() * 16), Math.floor(random() * 16), random() > 0.5 ? '#3d1f66' : '#1c1233');
  });

  // Lantern: gold frame around a warm window
  const lanternTex = () => pixelTexture('lantern', 16, (ctx) => {
    ctx.fillStyle = '#ffe28a'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#8a5a12'; ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 14, 16, 2); ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16); ctx.fillRect(7, 0, 2, 16);
    ctx.fillStyle = '#d4a020'; ctx.fillRect(0, 2, 16, 1); ctx.fillRect(2, 0, 1, 16);
  }, false);

  // Mob skins: a greyscale body with a face on the front (tinted per mob)
  const mobBodyTex = () => pixelTexture('mob-body', 16, (ctx, w, h, random) => {
    noiseFill(ctx, w, h, random, 205, 60);
    for (let i = 0; i < 14; i++) px(ctx, Math.floor(random() * 16), Math.floor(random() * 16), '#ffffff');
  });
  const mobFaceTex = () => pixelTexture('mob-face', 16, (ctx, w, h, random) => {
    noiseFill(ctx, w, h, random, 205, 60);
    ctx.fillStyle = '#111';
    ctx.fillRect(3, 4, 3, 3); ctx.fillRect(10, 4, 3, 3);   // eyes
    ctx.fillStyle = '#ffec3d';
    ctx.fillRect(4, 5, 1, 1); ctx.fillRect(11, 5, 1, 1);    // glints
    ctx.fillStyle = '#111';
    ctx.fillRect(4, 10, 8, 2); ctx.fillRect(4, 9, 1, 1); ctx.fillRect(11, 9, 1, 1); // grin
    ctx.fillStyle = '#eee'; ctx.fillRect(6, 10, 1, 1); ctx.fillRect(9, 10, 1, 1);    // teeth
  }, false);

  // Chest: planks with gold trim and a lock
  const chestTex = () => pixelTexture('chest', 16, (ctx, w, h, random) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = random();
      px(ctx, x, y, y % 4 === 3 ? '#4a2a10' : v > 0.7 ? '#9a6232' : '#7d4a22');
    }
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    ctx.fillRect(7, 6, 2, 4);
    ctx.fillStyle = '#7a5a00'; ctx.fillRect(7, 8, 2, 1);
  }, false);

  // Box geometry whose UVs follow world size (1 texture repeat every `unit` m)
  function worldBox(w, h, d, unit = 2) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + w / 2;
      const y = pos.getY(i) + h / 2;
      const z = pos.getZ(i) + d / 2;
      const nx = Math.abs(nor.getX(i));
      const ny = Math.abs(nor.getY(i));
      if (nx > 0.5) uv.setXY(i, z / unit, y / unit);
      else if (ny > 0.5) uv.setXY(i, x / unit, z / unit);
      else uv.setXY(i, x / unit, y / unit);
    }
    uv.needsUpdate = true;
    return geometry;
  }

  function instanced(geometry, meshMaterial, count, { shadow = false, solid = true } = {}) {
    const result = new THREE.InstancedMesh(geometry, meshMaterial, Math.max(1, count));
    result.count = count;
    // Every instanced mesh gets an instance color (white by default): in r128 a
    // material shared with a colored instanced mesh crashes on one without it
    result.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3).fill(1), 3);
    result.frustumCulled = false; // r128 culls instances with the base geometry's bounds
    result.castShadow = shadow;
    result.receiveShadow = true;
    if (!solid) result.raycast = () => {};
    return result;
  }

  // Instance placement helper (shared scratch objects)
  const matrix = new THREE.Matrix4();
  const identity = new THREE.Quaternion();
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const scaleOne = new THREE.Vector3(1, 1, 1);
  const scratch = new THREE.Vector3();
  function place(target, index, x, y, z, rotated = false, scale = scaleOne) {
    target.setMatrixAt(index, matrix.compose(scratch.set(x, y, z), rotated ? turn : identity, scale));
  }

  // --------------------------------------------------------------------------
  // Maze generation (seeded recursive backtracker, the room is carved apart)
  // --------------------------------------------------------------------------
  function generate(seed) {
    const random = seeded(seed);
    // hWalls[j][i]: wall on the line z = -HALF + j * CELL, above cell (i, j)
    // vWalls[j][i]: wall on the line x = -HALF + i * CELL, left of cell (i, j)
    const hWalls = Array.from({ length: N + 1 }, () => Array(N).fill(true));
    const vWalls = Array.from({ length: N }, () => Array(N + 1).fill(true));
    const visited = Array.from({ length: N }, () => Array(N).fill(false));
    const links = Array.from({ length: N }, () => Array.from({ length: N }, () => []));
    const stack = [[ENTRY_COL, N - 1]];
    visited[N - 1][ENTRY_COL] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const options = [[0, -1], [1, 0], [0, 1], [-1, 0]]
        .map(([di, dj]) => [i + di, j + dj, di, dj])
        .filter(([ni, nj]) => ni >= 0 && nj >= 0 && ni < N && nj < N && !visited[nj][ni] && !inRoom(ni, nj));
      if (!options.length) { stack.pop(); continue; }
      const [ni, nj, di, dj] = options[Math.floor(random() * options.length)];
      if (di === 1) vWalls[j][i + 1] = false;
      if (di === -1) vWalls[j][i] = false;
      if (dj === 1) hWalls[j + 1][i] = false;
      if (dj === -1) hWalls[j][i] = false;
      links[j][i].push([ni, nj]);
      links[nj][ni].push([i, j]);
      visited[nj][ni] = true;
      stack.push([ni, nj]);
    }
    // Open the inside of the altar room
    for (let j = ROOM_MIN; j <= ROOM_MAX; j++) for (let i = ROOM_MIN; i <= ROOM_MAX; i++) {
      if (j > ROOM_MIN) hWalls[j][i] = false;
      if (i > ROOM_MIN) vWalls[j][i] = false;
    }
    hWalls[N][ENTRY_COL] = false; // maze entrance
    return { hWalls, vWalls, links, random };
  }

  // Tree path between two non-room cells (BFS over the carved links)
  function treePath(links, from, to) {
    const key = ([i, j]) => j * N + i;
    const previous = new Map([[key(from), null]]);
    const queue = [from];
    while (queue.length) {
      const cell = queue.shift();
      if (cell[0] === to[0] && cell[1] === to[1]) break;
      links[cell[1]][cell[0]].forEach((next) => {
        if (!previous.has(key(next))) { previous.set(key(next), cell); queue.push(next); }
      });
    }
    const path = [];
    for (let cell = to; cell; cell = previous.get(key(cell))) path.unshift(cell);
    return path;
  }

  // --------------------------------------------------------------------------
  // The dungeon builder
  // --------------------------------------------------------------------------
  function buildDungeon(group, { data }) {
    state.group = group;
    const maze = generate(data.seed || 7741);
    const { hWalls, vWalls, links, random } = maze;

    const brick = brickTex();
    const stoneMat = new THREE.MeshStandardMaterial({ map: brick, color: '#ffffff', roughness: 0.9, metalness: 0 });
    const hallMat = new THREE.MeshStandardMaterial({ map: brick, color: '#5a6a86', roughness: 0.92 });
    const glyphMat = new THREE.MeshStandardMaterial({ map: glyphTex(), color: '#ffffff', roughness: 0.85 });
    const coreMat = new THREE.MeshStandardMaterial({ map: glyphTex(), color: '#7d8aa3', emissive: '#ffffff', emissiveMap: coreTex(), emissiveIntensity: 1.4, roughness: 0.8 });
    const tileMat = new THREE.MeshStandardMaterial({ map: tileTex(), color: '#ffffff', roughness: 0.55, metalness: 0.05 });
    const slabTexture = slabTex();
    slabTexture.repeat.set(40, 40);
    const slabMat = new THREE.MeshStandardMaterial({ map: slabTexture, color: '#3a4256', roughness: 0.95 });
    const lavaTexture = lavaTex();
    const lavaMat = new THREE.MeshStandardMaterial({ map: lavaTexture, color: '#ffffff', emissive: '#ffffff', emissiveMap: lavaTexture, emissiveIntensity: 1.1, roughness: 0.6 });
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex(), color: '#ffffff', emissive: '#ffcc22', emissiveMap: plateTex(), emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.3 });
    const voidMat = new THREE.MeshStandardMaterial({ map: voidTex(), color: '#ffffff', emissive: '#5a2a99', emissiveMap: voidTex(), emissiveIntensity: 0.7, roughness: 1 });
    const gateMat = new THREE.MeshStandardMaterial({ map: brick, color: '#8a6a9e', emissive: '#3a1460', emissiveIntensity: 0.35, roughness: 0.8 });
    const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

    const color = new THREE.Color();

    // ---- Base slab and gallery floor ----
    const base = new THREE.Mesh(new THREE.BoxGeometry(80, 0.45, 80), slabMat);
    base.position.y = FLOOR_Y - 0.225;
    base.receiveShadow = true;
    group.add(base);
    // Dark grout layer under the maze tiles: the gaps read as dark seams, but
    // the floor stays continuous so the avatar never snags in a seam
    const grout = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, TILE_Y - 0.07 - FLOOR_Y, HALF * 2), material('#0e1020', { roughness: 1 }));
    grout.position.y = FLOOR_Y + (TILE_Y - 0.07 - FLOOR_Y) / 2;
    grout.receiveShadow = true;
    group.add(grout);

    // ---- Special cells: gates, plates, hazards, mobs ----
    const gateSpecs = [];
    const isRoomGateCell = new Set();
    // One gate per room side (on the middle segments)
    const roomGates = [
      { orient: 'h', j: ROOM_MIN, i: 7, outside: [7, ROOM_MIN - 1], inside: [7, ROOM_MIN] },
      { orient: 'h', j: ROOM_MAX + 1, i: 8, outside: [8, ROOM_MAX + 1], inside: [8, ROOM_MAX] },
      { orient: 'v', j: 8, i: ROOM_MIN, outside: [ROOM_MIN - 1, 8], inside: [ROOM_MIN, 8] },
      { orient: 'v', j: 7, i: ROOM_MAX + 1, outside: [ROOM_MAX + 1, 7], inside: [ROOM_MAX, 7] }
    ];
    roomGates.forEach((gate) => { gateSpecs.push({ ...gate, room: true }); isRoomGateCell.add(gate.outside.join(',')); });
    if (roomGates.some((g) => (g.orient === 'h' ? !hWalls[g.j][g.i] : !vWalls[g.j][g.i]))) console.warn('MobMaze: room gate on an open wall');
    roomGates.forEach((g) => { if (g.orient === 'h') hWalls[g.j][g.i] = false; else vWalls[g.j][g.i] = false; });

    // Dead ends (one link) feed hazards and plates
    const degree = (i, j) => links[j][i].length;
    const deadEnds = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (inRoom(i, j) || (i === ENTRY_COL && j === N - 1) || isRoomGateCell.has(`${i},${j}`)) continue;
      if (degree(i, j) === 1) deadEnds.push([i, j]);
    }
    const shuffled = (list) => list.map((item) => [random(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
    // Plates: one dead end per quadrant (linked to that side's room gate)
    const quadrantOf = ([i, j]) => (j < N / 2 ? (i < N / 2 ? 0 : 1) : (i < N / 2 ? 2 : 3));
    const plateCells = [];
    const used = new Set();
    [0, 1, 3, 2].forEach((quadrant) => {
      const candidates = shuffled(deadEnds.filter((cell) => quadrantOf(cell) === quadrant && Math.hypot(cell[0] - ENTRY_COL, cell[1] - (N - 1)) > 3));
      if (candidates.length) { plateCells.push(candidates[0]); used.add(candidates[0].join(',')); }
    });

    // Shortcut gates: existing walls between two non-room cells far apart on the tree
    const shortcutCandidates = [];
    for (let j = 1; j < N; j++) for (let i = 1; i < N - 1; i++) {
      if (hWalls[j][i] && !inRoom(i, j) && !inRoom(i, j - 1)) shortcutCandidates.push({ orient: 'h', j, i, a: [i, j - 1], b: [i, j] });
    }
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N; i++) {
      if (vWalls[j][i] && !inRoom(i, j) && !inRoom(i - 1, j)) shortcutCandidates.push({ orient: 'v', j, i, a: [i - 1, j], b: [i, j] });
    }
    const shortcuts = shuffled(shortcutCandidates)
      .map((gate) => ({ ...gate, gain: treePath(links, gate.a, gate.b).length }))
      .filter((gate) => gate.gain > 12)
      .slice(0, 8);
    shortcuts.forEach((gate) => {
      gateSpecs.push({ ...gate, room: false });
      if (gate.orient === 'h') hWalls[gate.j][gate.i] = false; else vWalls[gate.j][gate.i] = false;
      used.add(gate.a.join(',')); used.add(gate.b.join(','));
    });

    // Hazards: dead ends that hold nothing else
    const hazardCells = shuffled(deadEnds.filter((cell) => !used.has(cell.join(',')))).slice(0, 10);
    hazardCells.forEach((cell) => used.add(cell.join(',')));

    // ---- Maze walls (instanced segments + posts) ----
    const segmentList = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) if (hWalls[j][i]) segmentList.push([cellX(i), -HALF + j * CELL, false]);
    for (let j = 0; j < N; j++) for (let i = 0; i <= N; i++) if (vWalls[j][i]) segmentList.push([-HALF + i * CELL, cellZ(j), true]);
    const segments = instanced(worldBox(CELL - WALL_T, WALL_H, WALL_T, 1.5), stoneMat, segmentList.length, { shadow: true });
    segmentList.forEach(([x, z, rotated], index) => {
      place(segments, index, x, FLOOR_Y + WALL_H / 2, z, rotated);
      segments.setColorAt(index, color.setHSL(0.6 + random() * 0.03, 0.2 + random() * 0.08, 0.26 + random() * 0.06));
    });
    group.add(segments);

    const postList = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const touches = (i < N && hWalls[j][i]) || (i > 0 && hWalls[j][i - 1]) || (j < N && vWalls[j][i]) || (j > 0 && vWalls[j - 1][i]);
      const nearGate = gateSpecs.some((g) => (g.orient === 'h' ? g.j === j && (g.i === i || g.i + 1 === i) : g.i === i && (g.j === j || g.j + 1 === j)));
      if (touches || nearGate) postList.push([-HALF + i * CELL, -HALF + j * CELL]);
    }
    const posts = instanced(worldBox(WALL_T, WALL_H + 0.5, WALL_T, 1), glyphMat, postList.length, { shadow: true });
    postList.forEach(([x, z], index) => {
      place(posts, index, x, FLOOR_Y + (WALL_H + 0.5) / 2, z);
      posts.setColorAt(index, color.setHSL(0.6, 0.15, 0.3 + random() * 0.06));
    });
    group.add(posts);

    // ---- Floor tiles: checkered blue / white, raised above the dark base ----
    const tileCells = [];
    const voidCells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const key = `${i},${j}`;
      if (inRoom(i, j)) continue;
      if (hazardCells.some((c) => c.join(',') === key)) continue;
      if (!used.has(key) && !isRoomGateCell.has(key) && degree(i, j) === 2 && random() < 0.06) voidCells.push([i, j]);
      else tileCells.push([i, j]);
    }
    // Each cell holds 2 x 2 small tiles (1.85 m) with dark gaps between them
    const tileGeometry = worldBox(1.85, TILE_Y - FLOOR_Y + 0.05, 1.85, 1.85);
    const tiles = instanced(tileGeometry, tileMat, tileCells.length * 4);
    let tileIndex = 0;
    tileCells.forEach(([i, j]) => {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const checker = (i * 2 + (sx > 0 ? 1 : 0) + j * 2 + (sz > 0 ? 1 : 0)) % 2 === 0;
        place(tiles, tileIndex, cellX(i) + sx * 0.97, (TILE_Y + FLOOR_Y - 0.05) / 2, cellZ(j) + sz * 0.97);
        tiles.setColorAt(tileIndex, checker ? color.set('#dfe7f5') : color.set('#3d64c8').offsetHSL(0, 0, (random() - 0.5) * 0.06));
        tileIndex++;
      });
    });
    group.add(tiles);

    // Visual pits: dark sunken tiles with purple specks (shallow, walkable)
    const voids = instanced(new THREE.BoxGeometry(CELL - 0.3, 0.06, CELL - 0.3), voidMat, voidCells.length);
    voidCells.forEach(([i, j], index) => place(voids, index, cellX(i), TILE_Y - 0.06, cellZ(j)));
    group.add(voids);

    // Lava hazards
    const lava = instanced(worldBox(CELL - 0.2, 0.22, CELL - 0.2, CELL - 0.2), lavaMat, hazardCells.length);
    hazardCells.forEach(([i, j], index) => place(lava, index, cellX(i), FLOOR_Y + 0.11, cellZ(j)));
    group.add(lava);
    state.hazards = hazardCells.map(([i, j]) => ({ x: cellX(i), z: cellZ(j) }));

    // ---- Altar room floor: gold-trimmed dark tiles ----
    const roomTiles = instanced(tileGeometry, tileMat, 64);
    let roomIndex = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      place(roomTiles, roomIndex, -7 + i * 2, (TILE_Y + FLOOR_Y - 0.05) / 2, -7 + j * 2);
      const ring = Math.max(Math.abs(i - 3.5), Math.abs(j - 3.5));
      roomTiles.setColorAt(roomIndex, ring > 3 ? color.set('#c9a227') : (i + j) % 2 ? color.set('#2b2f4a') : color.set('#454a72'));
      roomIndex++;
    }
    group.add(roomTiles);

    // ---- Pressure plates ----
    plateCells.forEach(([i, j], index) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.2), plateMat);
      plate.position.set(cellX(i), TILE_Y + 0.06, cellZ(j));
      plate.receiveShadow = true;
      group.add(plate);
      state.plates.push({ mesh: plate, x: cellX(i), z: cellZ(j), inside: false, presses: 0, gates: [], index });
    });

    // ---- Gates: real meshes that slide into the floor ----
    const gateGeometry = worldBox(CELL - WALL_T, WALL_H, WALL_T, 1.5);
    gateSpecs.forEach((spec) => {
      const gate = new THREE.Mesh(gateGeometry, gateMat);
      const x = spec.orient === 'h' ? cellX(spec.i) : -HALF + spec.i * CELL;
      const z = spec.orient === 'h' ? -HALF + spec.j * CELL : cellZ(spec.j);
      gate.position.set(x, FLOOR_Y + WALL_H / 2, z);
      if (spec.orient === 'v') gate.rotation.y = Math.PI / 2;
      gate.castShadow = true;
      gate.receiveShadow = true;
      gate.userData.alwaysVisible = true;
      group.add(gate);
      state.gates.push({ mesh: gate, up: true, target: 1, level: 1, x, z, room: spec.room });
    });
    // Link: plate k -> room gate k + two shortcut gates
    const roomGateObjects = state.gates.filter((g) => g.room);
    const shortcutObjects = state.gates.filter((g) => !g.room);
    state.plates.forEach((plate, k) => {
      if (roomGateObjects[k]) plate.gates.push(roomGateObjects[k]);
      plate.gates.push(...shortcutObjects.filter((g, index) => index % state.plates.length === k));
    });
    // Quadrants without a plate (tiny mazes only): open their room gate
    roomGateObjects.slice(state.plates.length).forEach((gate) => { gate.up = false; gate.target = 0; });

    // ---- Patrolling mobs on straight corridor runs ----
    buildMobs(group, links, used, random);

    // ---- Hall: brick walls, door, pillars, roof ----
    buildHall(group, hallMat, glyphMat, coreMat, random);

    // ---- Altar ----
    buildAltar(group, glyphMat, coreMat);

    // ---- Purple trail: entrance -> nearest open-able room gate -> altar ----
    const entryCell = [ENTRY_COL, N - 1];
    let best = null;
    roomGates.forEach((gate) => {
      const path = treePath(links, entryCell, gate.outside);
      if (!best || path.length < best.length) best = path.concat([gate.inside]);
    });
    state.solutionCells = best;
    const trailPoints = [[cellX(ENTRY_COL), HALF + 2]];
    best.forEach(([i, j], index) => {
      if (index > 0) {
        const [pi, pj] = best[index - 1];
        trailPoints.push([(cellX(i) + cellX(pi)) / 2, (cellZ(j) + cellZ(pj)) / 2]);
      }
      trailPoints.push([cellX(i), cellZ(j)]);
    });
    trailPoints.push([0, 0]);
    const trail = instanced(new THREE.BoxGeometry(0.9, 0.04, 0.9), trailMat, trailPoints.length, { solid: false });
    trailPoints.forEach(([x, z], index) => {
      place(trail, index, x, TILE_Y + 0.03, z);
      trail.setColorAt(index, color.set(index < 4 ? '#a04dff' : '#000000'));
    });
    group.add(trail);
    state.trail = { mesh: trail, count: trailPoints.length };

    // ---- Lanterns hanging over the corridors ----
    buildLanterns(group, random);

    // ---- Game loop ----
    state.entranceLocal = new THREE.Vector3(cellX(ENTRY_COL), TILE_Y + 0.05, HALF + 3);
    const local = new THREE.Vector3();
    let lastTime = 0;
    animate(group, (time) => {
      const delta = Math.min(0.5, time - lastTime || 0.016);
      lastTime = time;
      lavaTexture.offset.set(Math.sin(time * 0.3) * 0.05, time * 0.08);
      lavaMat.emissiveIntensity = 0.9 + Math.sin(time * 3) * 0.3;
      plateMat.emissiveIntensity = 0.7 + Math.sin(time * 4) * 0.25;
      coreMat.emissiveIntensity = 1.2 + Math.sin(time * 1.7) * 0.4;
      updateGates(delta);
      updateMobs(time);
      updateTrail(time);
      if (typeof avatar === 'undefined') return;
      group.updateMatrixWorld();
      local.copy(avatar.position);
      group.worldToLocal(local);
      updatePlayer(local, time);
    });
  }

  // --------------------------------------------------------------------------
  // Hall: enclosing brick walls with a door, glyph pillars and a partial roof
  // --------------------------------------------------------------------------
  function buildHall(group, hallMat, glyphMat, coreMat, random) {
    const T = 1.2;
    const span = HALL * 2 + T * 2;
    const add = (geometry, x, y, z, meshMaterial = hallMat) => {
      const wall = new THREE.Mesh(geometry, meshMaterial);
      wall.position.set(x, y, z);
      wall.castShadow = wall.receiveShadow = true;
      group.add(wall);
      return wall;
    };
    add(worldBox(span, CEILING, T, 1.5), 0, FLOOR_Y + CEILING / 2, -HALL - T / 2);
    add(worldBox(T, CEILING, span, 1.5), -HALL - T / 2, FLOOR_Y + CEILING / 2, 0);
    add(worldBox(T, CEILING, span, 1.5), HALL + T / 2, FLOOR_Y + CEILING / 2, 0);
    // South wall around a 4 x 6 m door aligned with the maze entrance
    const doorX = cellX(ENTRY_COL);
    const doorW = 4;
    const doorH = 6;
    const leftW = doorX - doorW / 2 + HALL + T;
    const rightW = HALL + T - (doorX + doorW / 2);
    add(worldBox(leftW, CEILING, T, 1.5), -HALL - T + leftW / 2, FLOOR_Y + CEILING / 2, HALL + T / 2);
    add(worldBox(rightW, CEILING, T, 1.5), doorX + doorW / 2 + rightW / 2, FLOOR_Y + CEILING / 2, HALL + T / 2);
    add(worldBox(doorW, CEILING - doorH, T, 1.5), doorX, FLOOR_Y + doorH + (CEILING - doorH) / 2, HALL + T / 2);
    // Door frame of glyph blocks
    const frame = instanced(worldBox(1, 1, 1.6, 1), glyphMat, 15, { shadow: true });
    let f = 0;
    for (let y = 0; y < doorH; y++) {
      place(frame, f++, doorX - doorW / 2 - 0.5, FLOOR_Y + 0.5 + y, HALL + T / 2);
      place(frame, f++, doorX + doorW / 2 + 0.5, FLOOR_Y + 0.5 + y, HALL + T / 2);
    }
    for (let x = -1; x <= 1; x++) place(frame, f++, doorX + x * 1.5, FLOOR_Y + doorH + 0.5, HALL + T / 2);
    group.add(frame);

    // Battlements along the top of the hall
    const merlons = [];
    for (let s = -HALL; s <= HALL; s += 4) {
      merlons.push([s, -HALL - T / 2], [s, HALL + T / 2], [-HALL - T / 2, s], [HALL + T / 2, s]);
    }
    const crenels = instanced(worldBox(1.6, 1.2, 1.6, 1.5), hallMat, merlons.length, { shadow: true });
    merlons.forEach(([x, z], index) => place(crenels, index, x, FLOOR_Y + CEILING + 0.6, z));
    group.add(crenels);

    // Pillars along the gallery: brick shafts with glyph blocks (some glowing)
    const spots = [];
    for (let s = -32; s <= 32; s += 8) {
      spots.push([s, -HALL + 0.9], [-HALL + 0.9, s], [HALL - 0.9, s]);
      if (Math.abs(s - doorX) > 4) spots.push([s, HALL - 0.9]);
    }
    const shafts = instanced(worldBox(1.6, CEILING, 1.6, 1.5), hallMat, spots.length, { shadow: true });
    const glyphBlocks = [];
    const coreBlocks = [];
    spots.forEach(([x, z], index) => {
      place(shafts, index, x, FLOOR_Y + CEILING / 2, z);
      shafts.setColorAt(index, new THREE.Color('#ffffff').offsetHSL(0, 0, -random() * 0.08));
      [1, 5.5, 10.5].forEach((y, level) => (level === 1 && index % 3 === 0 ? coreBlocks : glyphBlocks).push([x, FLOOR_Y + y, z]));
    });
    group.add(shafts);
    const glyphs = instanced(worldBox(2, 2, 2, 2), glyphMat, glyphBlocks.length, { shadow: true });
    glyphBlocks.forEach(([x, y, z], index) => place(glyphs, index, x, y, z));
    group.add(glyphs);
    const cores = instanced(worldBox(2, 2, 2, 2), coreMat, coreBlocks.length);
    coreBlocks.forEach(([x, y, z], index) => place(cores, index, x, y, z));
    group.add(cores);

    // Partial roof: a beam lattice, a solid ring over the gallery and some bays
    const roofMat = material('#1a1d2b', { roughness: 1 });
    const beamMat = new THREE.MeshStandardMaterial({ map: brickTex(), color: '#3a425a', roughness: 0.95 });
    const beams = instanced(worldBox(1, 1, HALL * 2, 1.5), beamMat, 18, { shadow: true });
    let b = 0;
    for (let s = -32; s <= 32; s += 8) {
      place(beams, b++, s, FLOOR_Y + CEILING - 0.5, 0);
      place(beams, b++, 0, FLOOR_Y + CEILING - 0.5, s, true);
    }
    group.add(beams);
    const slabs = [];
    // Gallery ring
    slabs.push([0, -HALL + 3, HALL * 2, 6], [0, HALL - 3, HALL * 2, 6], [-HALL + 3, 0, 6, HALL * 2 - 12], [HALL - 3, 0, 6, HALL * 2 - 12]);
    // Some bays over the maze (the center stays open over the altar)
    for (let bz = 0; bz < 8; bz++) for (let bx = 0; bx < 8; bx++) {
      if ((bx + bz * 3) % 4 !== 0 || (bx >= 3 && bx <= 4 && bz >= 3 && bz <= 4)) continue;
      slabs.push([-28 + bx * 8, -28 + bz * 8, 8, 8]);
    }
    slabs.forEach(([x, z, w, d]) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), roofMat);
      slab.position.set(x, FLOOR_Y + CEILING + 0.25, z);
      slab.castShadow = true;
      group.add(slab);
    });

    // Entrance sign on the facade and a rules board inside the gallery
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false }));
    sign.position.set(doorX, FLOOR_Y + 8.6, HALL + T + 0.05);
    sign.raycast = () => {};
    group.add(sign);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: rulesTexture(), toneMapped: false }));
    board.position.set(doorX + 7, FLOOR_Y + 3, HALL - 0.02);
    board.rotation.y = Math.PI;
    board.raycast = () => {};
    group.add(board);
    // Fire bowls next to the door (outside)
    const fireMat = glow('#ff7a1a', 1.6);
    [-1, 1].forEach((side) => {
      const stand = new THREE.Mesh(worldBox(0.8, 1.6, 0.8, 1), glyphMat);
      stand.position.set(doorX + side * 3.6, FLOOR_Y + 0.8, HALL + T + 0.5);
      group.add(stand);
      const fire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), fireMat);
      fire.position.set(doorX + side * 3.6, FLOOR_Y + 1.85, HALL + T + 0.5);
      fire.raycast = () => {};
      group.add(fire);
      animate(fire, (time) => { fire.scale.y = 1 + Math.sin(time * 9 + side) * 0.25; fire.rotation.y = time * 1.5; });
    });
  }

  // 5x7 pixel font for the sign title
  const FONT = {
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
  };

  function signTexture() {
    const texture = canvasTexture('mobmaze-sign', 512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1b1530';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2c2350';
      for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) ctx.fillRect(x, y, 8, 8);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      const text = 'MOB MAZE';
      const cell = 8;
      const width = text.length * 6 * cell - cell;
      let ox = (w - width) / 2;
      const oy = 20;
      text.split('').forEach((char) => {
        FONT[char].forEach((row, ry) => row.split('').forEach((bit, rx) => {
          if (bit !== '1') return;
          ctx.fillStyle = '#5a1040';
          ctx.fillRect(ox + rx * cell + 4, oy + ry * cell + 4, cell, cell);
          ctx.fillStyle = (rx + ry) % 3 === 0 ? '#ffb3e0' : '#ff5fc8';
          ctx.fillRect(ox + rx * cell, oy + ry * cell, cell, cell);
        }));
        ox += 6 * cell;
      });
      // Subtitle in a crisp pixel style: draw small, threshold, scale up
      const small = document.createElement('canvas');
      small.width = 128;
      small.height = 10;
      const sctx = small.getContext('2d');
      sctx.font = 'bold 9px monospace';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillStyle = '#ffffff';
      sctx.fillText('A VOXEL DUNGEON', 64, 5);
      const image = sctx.getImageData(0, 0, 128, 10);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 128; x++) {
        if (image.data[(y * 128 + x) * 4 + 3] > 110) { ctx.fillStyle = '#ffd43b'; ctx.fillRect(x * 4, 84 + y * 3, 4, 3); }
      }
    });
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function rulesTexture() {
    return canvasTexture('mobmaze-rules', 512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#141024';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#ff5fc8';
      ctx.font = 'bold 30px monospace';
      ctx.fillText('RULES OF THE MAZE', 24, 46);
      const lines = [
        ['#ffd43b', 'Yellow plates move the purple gates.'],
        ['#ff4d1a', 'Red lava tiles send you back here.'],
        ['#9be37a', 'Mobs patrol the halls: hug a wall.'],
        ['#c39bff', 'Open the chest at the central altar.']
      ];
      ctx.font = '22px monospace';
      lines.forEach(([fill, line], index) => {
        ctx.fillStyle = fill;
        ctx.fillRect(24, 78 + index * 42, 14, 14);
        ctx.fillStyle = '#e8e8f0';
        ctx.fillText(line, 50, 92 + index * 42);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Altar room: stepped podium, chest, glyph pillars with burning cores
  // --------------------------------------------------------------------------
  function buildAltar(group, glyphMat, coreMat) {
    const podiumMat = new THREE.MeshStandardMaterial({ map: brickTex(), color: '#6f7fa0', roughness: 0.85 });
    const goldMat = material('#d4a020', { metalness: 0.7, roughness: 0.35 });
    [[8, 0.4], [6, 0.8], [4, 1.2]].forEach(([size, top]) => {
      const tier = new THREE.Mesh(worldBox(size, 0.4, size, 1.5), podiumMat);
      tier.position.set(0, TILE_Y + top - 0.2, 0);
      tier.receiveShadow = tier.castShadow = true;
      group.add(tier);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(size + 0.06, 0.08, size + 0.06), goldMat);
      trim.position.set(0, TILE_Y + top - 0.04, 0);
      trim.raycast = () => {};
      group.add(trim);
    });
    const topY = TILE_Y + 1.2;

    // Chest with an opening lid
    const chestMat = new THREE.MeshStandardMaterial({ map: chestTex(), roughness: 0.7 });
    const chest = new THREE.Group();
    chest.position.set(0, topY, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.95), chestMat);
    body.position.y = 0.375;
    body.castShadow = true;
    chest.add(body);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.75, -0.475);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.3, 0.97), chestMat);
    lid.position.set(0, 0.15, 0.485);
    lidPivot.add(lid);
    chest.add(lidPivot);
    const treasure = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.75), glow('#ffd43b', 1.4));
    treasure.position.y = 0.72;
    treasure.raycast = () => {};
    chest.add(treasure);
    group.add(chest);
    chest.userData.prompt = 'Press E to open the treasure chest';
    chest.userData.onInteract = () => completeRun(lidPivot);
    interactive(chest, 'action', 'Treasure chest');
    state.chest = { chest, lidPivot };
    animate(lidPivot, () => {
      const target = state.completed ? -1.9 : 0;
      lidPivot.rotation.x += (target - lidPivot.rotation.x) * 0.08;
    });

    // Room corner pillars: glyph blocks stacked, with burning cores
    [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, z]) => {
      for (let level = 0; level < 5; level++) {
        const block = new THREE.Mesh(worldBox(1.5, 1.5, 1.5, 1.5), level === 2 || level === 4 ? coreMat : glyphMat);
        block.position.set(x, FLOOR_Y + 0.75 + level * 1.5, z);
        block.castShadow = true;
        group.add(block);
      }
    });
    // Fake light column over the altar (additive, not solid)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#b07aff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(0, topY + 4.5, 0);
    beam.raycast = () => {};
    group.add(beam);
    state.altarBeam = beam;
  }

  // --------------------------------------------------------------------------
  // Lanterns: gold cages with glowing cores, hanging on chains from the beams
  // --------------------------------------------------------------------------
  function buildLanterns(group, random) {
    const spots = [];
    for (let s = -32; s <= 32; s += 8) for (let t = -28; t <= 28; t += 8) {
      if (random() < 0.45) spots.push([s, t, 6.5 + random() * 2]);
    }
    // Gallery lanterns
    for (let s = -30; s <= 30; s += 10) spots.push([s, -35, 7.5], [s, 35, 7.5], [-35, s, 7.5], [35, s, 7.5]);
    const chainMat = material('#3a3020', { metalness: 0.6, roughness: 0.5 });
    const cageMat = new THREE.MeshStandardMaterial({ map: lanternTex(), color: '#ffffff', emissive: '#ffb84d', emissiveMap: lanternTex(), emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.4 });
    const chains = instanced(new THREE.BoxGeometry(0.08, 1, 0.08), chainMat, spots.length, { solid: false });
    const cages = instanced(new THREE.BoxGeometry(0.6, 0.75, 0.6), cageMat, spots.length, { solid: false });
    const caps = instanced(new THREE.BoxGeometry(0.75, 0.15, 0.75), material('#8a5a12', { metalness: 0.6, roughness: 0.4 }), spots.length * 2, { solid: false });
    const halos = instanced(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb84d', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }), spots.length, { solid: false });
    spots.forEach(([x, z, y], index) => {
      const length = CEILING - 0.5 - y;
      place(chains, index, x, FLOOR_Y + y + length / 2, z, false, new THREE.Vector3(1, length, 1));
      place(cages, index, x, FLOOR_Y + y, z);
      place(caps, index * 2, x, FLOOR_Y + y + 0.45, z);
      place(caps, index * 2 + 1, x, FLOOR_Y + y - 0.45, z);
      place(halos, index, x, FLOOR_Y + y, z);
    });
    group.add(chains, cages, caps, halos);
  }

  // --------------------------------------------------------------------------
  // Mobs: boxy creatures pacing back and forth on straight corridor runs
  // --------------------------------------------------------------------------
  function buildMobs(group, links, used, random) {
    const linked = (a, b) => links[a[1]][a[0]].some(([i, j]) => i === b[0] && j === b[1]);
    const runs = [];
    // Horizontal and vertical runs of at least 3 linked cells
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const prev = [i - di, j - dj];
        if (prev[0] >= 0 && prev[1] >= 0 && linked(prev, [i, j])) continue; // not the start of a run
        const run = [[i, j]];
        let cell = [i, j];
        while (cell[0] + di < N && cell[1] + dj < N && linked(cell, [cell[0] + di, cell[1] + dj])) {
          cell = [cell[0] + di, cell[1] + dj];
          run.push(cell);
        }
        if (run.length >= 3 && !run.some(([ri, rj]) => ri === ENTRY_COL && rj >= N - 2)) runs.push(run);
      }
    }
    runs.sort((a, b) => b.length - a.length);
    const chosen = [];
    runs.forEach((run) => {
      if (chosen.length >= 6) return;
      const touches = chosen.some((other) => other.some(([oi, oj]) => run.some(([i, j]) => Math.abs(i - oi) + Math.abs(j - oj) <= 1)));
      if (!touches) chosen.push(run);
    });
    const tints = ['#7fd35a', '#b07aff', '#ff8a5a', '#5ad3c8', '#d35a8a', '#e3d35a'];
    const bodyTex = mobBodyTex();
    const faceTex = mobFaceTex();
    chosen.forEach((run, index) => {
      const tint = tints[index % tints.length];
      const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, color: tint, roughness: 0.8 });
      const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, color: tint, roughness: 0.8 });
      const darkMat = new THREE.MeshStandardMaterial({ map: bodyTex, color: new THREE.Color(tint).multiplyScalar(0.55), roughness: 0.9 });
      const mob = new THREE.Group();
      // Body: front face (+z) carries the face texture
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat]);
      body.position.y = 0.95;
      body.castShadow = true;
      mob.add(body);
      const legs = [];
      [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), darkMat);
        leg.geometry.translate(0, -0.25, 0);
        leg.position.set(x, 0.5, z);
        mob.add(leg);
        legs.push(leg);
      });
      mob.traverse((node) => { node.raycast = () => {}; });
      const a = run[0];
      const b = run[run.length - 1];
      const start = new THREE.Vector3(cellX(a[0]), TILE_Y, cellZ(a[1]));
      const end = new THREE.Vector3(cellX(b[0]), TILE_Y, cellZ(b[1]));
      mob.position.copy(start);
      group.add(mob);
      state.mobs.push({ mob, body, legs, start, end, speed: 1.6 + random() * 0.8, phase: random() * 10, axis: a[0] === b[0] ? 'z' : 'x' });
    });
  }

  function updateMobs(time) {
    state.mobs.forEach((m) => {
      const length = m.start.distanceTo(m.end);
      const cycle = (time * m.speed + m.phase * length) % (length * 2);
      const forward = cycle < length;
      const t = forward ? cycle / length : 2 - cycle / length;
      m.mob.position.lerpVectors(m.start, m.end, t);
      const direction = forward ? 1 : -1;
      m.mob.rotation.y = m.axis === 'x' ? direction * Math.PI / 2 : direction > 0 ? 0 : Math.PI;
      const step = Math.sin(time * m.speed * 6);
      m.legs.forEach((leg, index) => { leg.rotation.x = (index % 2 ? 1 : -1) * step * 0.6; });
      m.body.position.y = 0.95 + Math.abs(step) * 0.08;
    });
  }

  // --------------------------------------------------------------------------
  // Gates, trail and the player's progress
  // --------------------------------------------------------------------------
  function updateGates(delta) {
    state.gates.forEach((gate) => {
      // Never raise a gate onto the player: wait until they step away
      if (gate.target === 1 && gate.level < 1 && gate.blocked) return;
      if (gate.level === gate.target) return;
      gate.level = gate.target > gate.level ? Math.min(1, gate.level + delta * 0.8) : Math.max(0, gate.level - delta * 0.8);
      // Lowered: the whole wall slides below the floor
      gate.mesh.position.y = FLOOR_Y + WALL_H / 2 - (1 - gate.level) * (WALL_H + 0.3);
    });
  }

  function updateTrail(time) {
    const trail = state.trail;
    if (!trail) return;
    const color = new THREE.Color();
    const shown = state.completed ? trail.count : 4;
    for (let index = 0; index < trail.count; index++) {
      if (index >= shown) { trail.mesh.setColorAt(index, color.set('#000000')); continue; }
      const wave = 0.55 + 0.45 * Math.sin(time * 4 - index * 0.35);
      trail.mesh.setColorAt(index, color.setRGB(0.55 * wave, 0.22 * wave, 1 * wave));
    }
    trail.mesh.instanceColor.needsUpdate = true;
    if (state.altarBeam) state.altarBeam.material.opacity = state.completed ? 0.22 + Math.sin(time * 3) * 0.06 : 0.1;
  }

  function message(text) {
    if (typeof appendSystemMessage === 'function') appendSystemMessage(text);
  }
  function sound(name) {
    if (typeof Sound !== 'undefined' && Sound.play) Sound.play(name);
  }

  function sendToEntrance(reason, time) {
    if (time - state.lastReset < 1.5) return;
    state.lastReset = time;
    const target = state.entranceLocal.clone();
    state.group.localToWorld(target);
    avatar.position.copy(target);
    avatar.velocityY = 0;
    sound('teleport');
    message(`${reason} Back to the maze entrance!`);
  }

  function updatePlayer(local, time) {
    const insideMaze = Math.abs(local.x) < HALF && Math.abs(local.z) < HALF && local.y > -1 && local.y < WALL_H;
    if (insideMaze && state.started === null && !state.completed) {
      state.started = performance.now();
      message('The Mob Maze: find the chest at the central altar. Yellow plates move the purple gates; avoid lava and mobs.');
    }
    // Gates do not rise while the player stands in their wall line
    state.gates.forEach((gate) => {
      gate.blocked = Math.abs(local.x - gate.x) < 2.6 && Math.abs(local.z - gate.z) < 2.6;
    });
    const onFloor = local.y < TILE_Y + 1.2 && local.y > -1;
    // Pressure plates: toggle on entering
    state.plates.forEach((plate) => {
      const on = onFloor && Math.abs(local.x - plate.x) < 1.3 && Math.abs(local.z - plate.z) < 1.3;
      if (on && !plate.inside) {
        plate.presses++;
        plate.gates.forEach((gate) => { gate.target = gate.target === 1 ? 0 : 1; });
        plate.mesh.position.y = TILE_Y + 0.02;
        sound('click');
        const opened = plate.gates.filter((gate) => gate.target === 0).length;
        message(`Click! Stone grinds somewhere in the maze (${opened} of ${plate.gates.length} linked gates open).`);
      } else if (!on && plate.inside) {
        plate.mesh.position.y = TILE_Y + 0.06;
      }
      plate.inside = on;
    });
    if (!onFloor) return;
    // Lava
    if (state.hazards.some((h) => Math.abs(local.x - h.x) < 1.9 && Math.abs(local.z - h.z) < 1.9)) {
      sendToEntrance('Ouch, lava!', time);
      return;
    }
    // Mobs: their box (0.9 m) plus a little reach
    for (const m of state.mobs) {
      if (Math.abs(local.x - m.mob.position.x) < 0.8 && Math.abs(local.z - m.mob.position.z) < 0.8) {
        sendToEntrance('A mob caught you!', time);
        return;
      }
    }
  }

  function completeRun(lidPivot) {
    if (state.completed) return 'The chest is already open. The purple trail shows the way back.';
    state.completed = true;
    sound('coin');
    const seconds = state.started === null ? null : (performance.now() - state.started) / 1000;
    let best = null;
    try { best = parseFloat(localStorage.getItem(BEST_KEY)); } catch (error) { best = null; }
    let record = '';
    if (seconds !== null) {
      if (!best || seconds < best) {
        try { localStorage.setItem(BEST_KEY, seconds.toFixed(1)); } catch (error) { /* storage blocked */ }
        record = best ? ` New best time (previous ${best.toFixed(1)} s)!` : ' First clear: best time saved.';
      } else {
        record = ` Best time: ${best.toFixed(1)} s.`;
      }
    }
    lidPivot.userData.opened = true;
    return seconds === null
      ? 'Maze complete! The chest is open and a purple trail lights the way.'
      : `Maze complete in ${seconds.toFixed(1)} s!${record} A purple trail now lights the way from the entrance.`;
  }

  PropKit.registerBuilder(/^mobmaze_dungeon$/, 'mobmazeDungeon', buildDungeon);

  return { state };
})();
