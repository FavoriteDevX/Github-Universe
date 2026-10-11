// ============================================================================
// GENESIS CITY: CONTINUOUS LAND, ROADS, GENERATED NEIGHBORHOODS, SKY & WEATHER
// ============================================================================
// Every map from worlds.json becomes a district on one continuous parcel grid
// (like Decentraland's Genesis City). Cells that hold no district are filled
// with deterministic low-poly neighborhoods so the world feels endless.
const City = (() => {
  const PARCEL_SIZE = 16;
  const CELL_SIZE = 64; // 4x4 parcels per city block
  const ROAD_WIDTH = 8;
  const CITY_RADIUS = 4; // cells -4..4 => 576m x 576m city
  const GROUND_LEVEL = -0.3;
  const { material, glow, repeated, windowsTexture, roadTexture, textSprite } = PropKit.kit;

  const districts = [];
  const pickables = [];
  const sharedCollidables = []; // ground, roads and generated buildings
  const animatedCity = [];
  let scene;
  let sky;
  let sun;
  let hemisphere;
  let stars;
  let moon;
  let clouds;
  let rain;
  let snow;
  let streetLampHeads;
  let nightWindowMaterials = [];

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --------------------------------------------------------------------------
  // District layout
  // --------------------------------------------------------------------------
  function layoutFor(world) {
    if (world.region) {
      const [cx, cz] = world.region.center;
      const [sx, sz] = world.region.size;
      return { center: new THREE.Vector3(cx, world.elevation || 0, cz), size: [sx, sz] };
    }
    const [cellX, cellZ] = world.cell;
    const [spanX, spanZ] = world.span || [1, 1];
    return {
      center: new THREE.Vector3((cellX + (spanX - 1) / 2) * CELL_SIZE, world.elevation || 0, (cellZ + (spanZ - 1) / 2) * CELL_SIZE),
      size: [spanX * CELL_SIZE - ROAD_WIDTH, spanZ * CELL_SIZE - ROAD_WIDTH],
      cells: { minX: cellX, maxX: cellX + spanX - 1, minZ: cellZ, maxZ: cellZ + spanZ - 1 }
    };
  }

  function districtOwningCell(cellX, cellZ) {
    return districts.find((district) => district.layout.cells &&
      cellX >= district.layout.cells.minX && cellX <= district.layout.cells.maxX &&
      cellZ >= district.layout.cells.minZ && cellZ <= district.layout.cells.maxZ);
  }

  function districtAt(x, z) {
    for (const district of districts) {
      const { center, size } = district.layout;
      if (Math.abs(x - center.x) <= size[0] / 2 + ROAD_WIDTH / 2 && Math.abs(z - center.z) <= size[1] / 2 + ROAD_WIDTH / 2) return district;
    }
    return null;
  }

  // Builds one district from its map JSON on top of a tinted lot
  function addDistrict(world, mapData) {
    const layout = layoutFor(world);
    const root = new THREE.Group();
    root.position.copy(layout.center);
    root.userData.districtKey = world.key;

    if (!world.region) {
      const lot = new THREE.Mesh(new THREE.BoxGeometry(layout.size[0], 0.2, layout.size[1]), material(mapData.backgroundColor, { roughness: 1 }));
      lot.position.y = -0.2;
      lot.receiveShadow = true;
      if (!layout.center.y) root.add(lot);
    }

    // Separate Worlds (big maps) float on their own island of land, far from Genesis City
    if (world.world) root.add(buildWorldIsland(layout.size, world.key));

    mapData.blocks.forEach((blockData) => root.add(PropKit.buildBlock(blockData)));

    // District name floating above it, like Decentraland's scene titles
    const title = textSprite(world.name, { width: world.region ? 60 : 22, color: '#ffffff', background: hexToRgba(world.color, 0.85) });
    title.position.set(0, world.region ? 90 : 30, 0);
    title.material.transparent = true;
    title.userData.isDistrictTitle = true;
    root.add(title);

    scene.add(root);
    pickables.push(root);
    const district = { world, layout, root, mapData, title };
    districts.push(district);
    return district;
  }

  function buildWorldIsland(size, key) {
    const island = new THREE.Group();
    const radius = Math.max(size[0], size[1]) * 0.75 + 120;
    const grass = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), material('#7cb342', { roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = GROUND_LEVEL;
    grass.receiveShadow = true;
    island.add(grass);
    // A ring of trees frames the World
    const random = seededRandom(key.length * 977);
    const count = 120;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 1, 6).translate(0, 0.5, 0), material('#6d4c41'), count);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material('#ffffff', { flatShading: true }), count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.max(size[0], size[1]) * 0.62 + 10 + random() * (radius - Math.max(size[0], size[1]) * 0.62 - 20);
      const treeScale = 1 + random() * 1.2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      matrix.compose(new THREE.Vector3(x, GROUND_LEVEL, z), new THREE.Quaternion(), new THREE.Vector3(treeScale, treeScale * 2.6, treeScale));
      trunks.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(x, GROUND_LEVEL + treeScale * 3.6, z), new THREE.Quaternion(), new THREE.Vector3(treeScale * 2, treeScale * 2.2, treeScale * 2));
      crowns.setMatrixAt(i, matrix);
      crowns.setColorAt(i, color.setHSL(0.26 + random() * 0.08, 0.5, 0.3 + random() * 0.12));
    }
    trunks.castShadow = crowns.castShadow = true;
    island.add(trunks, crowns);
    return island;
  }

  function hexToRgba(hex, alpha) {
    const color = new THREE.Color(hex);
    return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
  }

  // --------------------------------------------------------------------------
  // Ground, roads, street lamps and generated neighborhoods
  // --------------------------------------------------------------------------
  function buildGround() {
    const grassTexture = PropKit.kit.canvasTexture('grass', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#7cb342';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = ['#8bc34a', '#689f38', '#7cb342', '#9ccc65'][i % 4];
        ctx.fillRect((i * 37) % w, (i * 91) % h, 3, 3);
      }
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: repeated(grassTexture, 600, 600), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_LEVEL;
    ground.receiveShadow = true;
    scene.add(ground);
    pickables.push(ground);
    sharedCollidables.push(ground);

  }

  function buildRoads() {
    const extent = (CITY_RADIUS + 0.5) * CELL_SIZE;
    const asphalt = roadTexture('#3d4247');
    const roads = new THREE.Group();
    const lampPositions = [];

    // Road segments run along cell edges; edges inside a multi-cell district are skipped
    for (let line = -CITY_RADIUS - 1; line <= CITY_RADIUS; line++) {
      const offset = (line + 0.5) * CELL_SIZE;
      for (let cell = -CITY_RADIUS; cell <= CITY_RADIUS; cell++) {
        const along = cell * CELL_SIZE;
        const westDistrict = districtOwningCell(line, cell);
        const eastDistrict = districtOwningCell(line + 1, cell);
        if (!(westDistrict && westDistrict === eastDistrict)) {
          const texture = repeated(asphalt, 1, (CELL_SIZE - ROAD_WIDTH) / 8);
          const segment = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.1, CELL_SIZE - ROAD_WIDTH), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
          segment.position.set(offset, GROUND_LEVEL + 0.1, along);
          segment.receiveShadow = true;
          roads.add(segment);
          lampPositions.push([offset + ROAD_WIDTH / 2 + 0.6, along - 12], [offset - ROAD_WIDTH / 2 - 0.6, along + 12]);
        }
        const northDistrict = districtOwningCell(cell, line);
        const southDistrict = districtOwningCell(cell, line + 1);
        if (!(northDistrict && northDistrict === southDistrict)) {
          const texture = repeated(asphalt, 1, (CELL_SIZE - ROAD_WIDTH) / 8);
          texture.rotation = Math.PI / 2;
          const segment = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE - ROAD_WIDTH, 0.1, ROAD_WIDTH), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
          segment.position.set(along, GROUND_LEVEL + 0.1, offset);
          segment.receiveShadow = true;
          roads.add(segment);
        }
      }
      // Intersections
      for (let other = -CITY_RADIUS - 1; other <= CITY_RADIUS; other++) {
        const intersection = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.1, ROAD_WIDTH), material('#3d4247', { roughness: 0.9 }));
        intersection.position.set(offset, GROUND_LEVEL + 0.1, (other + 0.5) * CELL_SIZE);
        roads.add(intersection);
      }
    }
    scene.add(roads);
    pickables.push(roads);
    sharedCollidables.push(roads);

    // Street lamps (instanced posts + glowing heads that light up at night)
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 6).translate(0, 2.5, 0), material('#37474f', { metalness: 0.6 }), lampPositions.length);
    streetLampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0.2 }), lampPositions.length);
    const matrix = new THREE.Matrix4();
    lampPositions.forEach(([x, z], index) => {
      matrix.makeTranslation(x, GROUND_LEVEL, z);
      posts.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, GROUND_LEVEL + 5.1, z);
      streetLampHeads.setMatrixAt(index, matrix);
    });
    scene.add(posts, streetLampHeads);

    // Colorful street banners hanging from every lamp post
    const bannerColors = ['#1877f2', '#2da44e', '#4dabf7', '#ffbe0b', '#0b4fa8', '#fb5607'];
    const banners = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }), lampPositions.length);
    const bannerColor = new THREE.Color();
    lampPositions.forEach(([x, z], index) => {
      matrix.makeRotationY(Math.PI / 2);
      matrix.setPosition(x, GROUND_LEVEL + 3.4, z + 0.62);
      banners.setMatrixAt(index, matrix);
      banners.setColorAt(index, bannerColor.set(bannerColors[index % bannerColors.length]));
    });
    banners.raycast = () => {};
    scene.add(banners);
  }

  // Deterministic Decentraland-style parcels for every cell without a district:
  // mostly grass and trees, plus small houses, art sculptures, kiosks, a few
  // mid-rise scenes and empty "for sale" parcels (no endless city-builder grid)
  function buildNeighborhoods() {
    const buildings = [];
    const houses = [];
    const trees = [];
    const tiles = [];
    const sculptures = [];
    const kiosks = [];
    const signs = [];
    for (let cellX = -CITY_RADIUS; cellX <= CITY_RADIUS; cellX++) {
      for (let cellZ = -CITY_RADIUS; cellZ <= CITY_RADIUS; cellZ++) {
        if (districtOwningCell(cellX, cellZ)) continue;
        const random = seededRandom((cellX + 50) * 1000 + (cellZ + 50));
        const plot = (CELL_SIZE - ROAD_WIDTH) / 3;
        for (let px = 0; px < 3; px++) {
          for (let pz = 0; pz < 3; pz++) {
            const x = cellX * CELL_SIZE - plot + px * plot;
            const z = cellZ * CELL_SIZE - plot + pz * plot;
            const roll = random();
            if (roll < 0.36) {
              const count = 3 + Math.floor(random() * 5);
              for (let t = 0; t < count; t++) trees.push({ x: x + (random() - 0.5) * (plot - 3), z: z + (random() - 0.5) * (plot - 3), size: 0.8 + random() * 0.8, shade: random() });
            } else if (roll < 0.56) {
              houses.push({ x, z, width: 6 + random() * 3, depth: 6 + random() * 3, height: 3.5 + random() * 2, hue: random(), roof: random() });
              tiles.push({ x, z: z + plot / 2 - 2.5, w: 2, d: 5, color: '#d7ccc8' });
              trees.push({ x: x + plot / 2 - 2.5, z: z - plot / 2 + 2.5, size: 1, shade: random() });
            } else if (roll < 0.68) {
              tiles.push({ x, z, w: 8, d: 8, color: '#e0e0e0' });
              sculptures.push({ x, z, hue: random(), kind: Math.floor(random() * 3), size: 1.5 + random() * 1.5 });
            } else if (roll < 0.78) {
              kiosks.push({ x, z, hue: random() });
              tiles.push({ x, z, w: 10, d: 8, color: '#cfd8dc' });
            } else if (roll < 0.88) {
              tiles.push({ x, z, w: plot - 3, d: plot - 3, color: '#a1887f' });
              signs.push({ x: x - plot / 2 + 3, z: z + plot / 2 - 3 });
            } else {
              buildings.push({ x, z, width: 8 + random() * 5, depth: 8 + random() * 5, height: 7 + random() * 9, hue: random() });
              tiles.push({ x, z, w: plot - 2, d: plot - 2, color: '#b0b7bf' });
            }
          }
        }
      }
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    const pastel = ['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#ffadad', '#f1faee'];
    const addInstanced = (instanced, castShadow = true) => {
      instanced.castShadow = castShadow;
      instanced.receiveShadow = true;
      scene.add(instanced);
      sharedCollidables.push(instanced);
      pickables.push(instanced);
    };

    // Mid-rise scenes: window texture that glows at night
    const windowMap = repeated(windowsTexture('#ffffff', '#ffe9a8'), 2, 3);
    const buildingMaterial = new THREE.MeshStandardMaterial({ map: windowMap, emissiveMap: windowMap, emissive: '#000000', roughness: 0.6 });
    nightWindowMaterials.push(buildingMaterial);
    const buildingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), buildingMaterial, Math.max(1, buildings.length));
    buildingMesh.count = buildings.length;
    buildings.forEach((building, index) => {
      matrix.compose(position.set(building.x, GROUND_LEVEL, building.z), quaternion.identity(), scale.set(building.width, building.height, building.depth));
      buildingMesh.setMatrixAt(index, matrix);
      buildingMesh.setColorAt(index, color.set(pastel[Math.floor(building.hue * pastel.length)]));
    });
    addInstanced(buildingMesh);

    // Small houses with pyramid roofs, doors and windows
    const houseMap = repeated(windowsTexture('#ffffff', '#ffe9a8'), 2, 1);
    const houseMaterial = new THREE.MeshStandardMaterial({ map: houseMap, emissiveMap: houseMap, emissive: '#000000', roughness: 0.8 });
    nightWindowMaterials.push(houseMaterial);
    const houseMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), houseMaterial, Math.max(1, houses.length));
    const roofMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), material('#ffffff', { flatShading: true }), Math.max(1, houses.length));
    const doorMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 2, 0.1).translate(0, 1, 0), material('#6d4c41'), Math.max(1, houses.length));
    houseMesh.count = roofMesh.count = doorMesh.count = houses.length;
    const roofColors = ['#c0392b', '#2c3e50', '#16a085', '#8e44ad', '#d35400'];
    houses.forEach((house, index) => {
      matrix.compose(position.set(house.x, GROUND_LEVEL, house.z), quaternion.identity(), scale.set(house.width, house.height, house.depth));
      houseMesh.setMatrixAt(index, matrix);
      houseMesh.setColorAt(index, color.set(pastel[Math.floor(house.hue * pastel.length)]));
      matrix.compose(position.set(house.x, GROUND_LEVEL + house.height, house.z), quaternion.identity(), scale.set(house.width * 1.15, house.height * 0.7, house.depth * 1.15));
      roofMesh.setMatrixAt(index, matrix);
      roofMesh.setColorAt(index, color.set(roofColors[Math.floor(house.roof * roofColors.length)]));
      matrix.makeTranslation(house.x, GROUND_LEVEL, house.z + house.depth / 2 + 0.05);
      doorMesh.setMatrixAt(index, matrix);
    });
    addInstanced(houseMesh);
    addInstanced(roofMesh);
    scene.add(doorMesh);

    // Trees
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6).translate(0, 0.5, 0), material('#6d4c41'), trees.length);
    const crownMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material('#ffffff', { flatShading: true }), trees.length);
    trees.forEach((tree, index) => {
      matrix.compose(position.set(tree.x, GROUND_LEVEL, tree.z), quaternion.identity(), scale.set(tree.size, tree.size * 2.5, tree.size));
      trunkMesh.setMatrixAt(index, matrix);
      matrix.compose(position.set(tree.x, GROUND_LEVEL + tree.size * 3.4, tree.z), quaternion.identity(), scale.set(tree.size * 1.8, tree.size * 2, tree.size * 1.8));
      crownMesh.setMatrixAt(index, matrix);
      // Mostly green, with Decentraland-style autumn pinks and oranges
      if (tree.shade > 0.7) crownMesh.setColorAt(index, color.set(['#ff7f50', '#f78fb3', '#ffb347', '#ff4d6d'][Math.floor(tree.shade * 100) % 4]));
      else crownMesh.setColorAt(index, color.setHSL(0.27 + tree.shade * 0.08, 0.5, 0.32 + tree.shade * 0.12));
    });
    addInstanced(trunkMesh);
    // Foliage is decorative: the avatar walks under it instead of landing on treetops
    crownMesh.castShadow = true;
    scene.add(crownMesh);

    // Paths and plazas
    const tileMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), material('#ffffff', { roughness: 1 }), tiles.length);
    tiles.forEach((tile, index) => {
      matrix.compose(position.set(tile.x, GROUND_LEVEL + 0.05, tile.z), quaternion.identity(), scale.set(tile.w, 1, tile.d));
      tileMesh.setMatrixAt(index, matrix);
      tileMesh.setColorAt(index, color.set(tile.color));
    });
    addInstanced(tileMesh, false);

    // Community art sculptures on pedestals, slowly spinning
    const pedestalMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 1.2, 2).translate(0, 0.6, 0), material('#f5f5f5'), Math.max(1, sculptures.length));
    const artGeometries = [new THREE.IcosahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.7, 0.22, 48, 8), new THREE.OctahedronGeometry(1, 0)];
    const artMeshes = artGeometries.map((geometry) => new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.3, flatShading: true }), Math.max(1, sculptures.length)));
    artMeshes.forEach((artMesh) => { artMesh.count = 0; });
    pedestalMesh.count = sculptures.length;
    sculptures.forEach((sculpture, index) => {
      matrix.makeTranslation(sculpture.x, GROUND_LEVEL, sculpture.z);
      pedestalMesh.setMatrixAt(index, matrix);
      const artMesh = artMeshes[sculpture.kind];
      const slot = artMesh.count++;
      sculpture.slot = slot;
      artMesh.setColorAt(slot, color.setHSL(sculpture.hue, 0.75, 0.55));
    });
    addInstanced(pedestalMesh);
    artMeshes.forEach((artMesh) => { artMesh.castShadow = true; scene.add(artMesh); });
    const spinQuaternion = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    animatedCity.push((time) => {
      sculptures.forEach((sculpture) => {
        spinQuaternion.setFromAxisAngle(yAxis, time * 0.5 + sculpture.hue * 6);
        matrix.compose(position.set(sculpture.x, GROUND_LEVEL + 2.4 + sculpture.size * 0.6 + Math.sin(time + sculpture.hue * 9) * 0.2, sculpture.z), spinQuaternion, scale.setScalar(sculpture.size * 0.6));
        artMeshes[sculpture.kind].setMatrixAt(sculpture.slot, matrix);
      });
      artMeshes.forEach((artMesh) => { artMesh.instanceMatrix.needsUpdate = true; });
    });

    // Market kiosks with striped awnings
    const kioskBody = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 2.4, 3).translate(0, 1.2, 0), material('#fafafa'), Math.max(1, kiosks.length));
    const kioskAwning = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 0.25, 4.2).translate(0, 3, 0.4), material('#ffffff'), Math.max(1, kiosks.length));
    kioskBody.count = kioskAwning.count = kiosks.length;
    kiosks.forEach((kiosk, index) => {
      matrix.makeTranslation(kiosk.x, GROUND_LEVEL, kiosk.z);
      kioskBody.setMatrixAt(index, matrix);
      kioskAwning.setMatrixAt(index, matrix);
      kioskAwning.setColorAt(index, color.setHSL(kiosk.hue, 0.8, 0.55));
    });
    addInstanced(kioskBody);
    addInstanced(kioskAwning);

    // "Parcel for sale" signs on empty land
    signs.forEach((sign) => {
      const post = new THREE.Group();
      post.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.15), material('#795548')));
      post.children[0].position.y = 1;
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 0.08), new THREE.MeshBasicMaterial({ map: PropKit.kit.labelTexture('PARCEL FOR SALE', { bg: '#fff3e0', fg: '#e65100', font: 'bold 52px Segoe UI, Arial, sans-serif' }) }));
      board.position.y = 2.2;
      post.add(board);
      post.position.set(sign.x, GROUND_LEVEL, sign.z);
      scene.add(post);
    });

    // A lake under the floating Zen temple
    const zen = districts.find((district) => district.world.elevation);
    if (zen) {
      const lake = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.2, 40), material('#4fc3f7', { roughness: 0.1, metalness: 0.2 }));
      lake.position.set(zen.layout.center.x, GROUND_LEVEL + 0.1, zen.layout.center.z);
      scene.add(lake);
    }
  }

  // --------------------------------------------------------------------------
  // Sky dome, sun, stars, clouds and weather
  // --------------------------------------------------------------------------
  function buildSky() {
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { topColor: { value: new THREE.Color('#3d8bfd') }, bottomColor: { value: new THREE.Color('#dff1ff') } },
        vertexShader: 'varying vec3 vWorld; void main() { vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main() { float h = normalize(vWorld - cameraPosition).y; gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), 0.55)), 1.0); }'
      })
    );
    scene.add(sky);

    hemisphere = new THREE.HemisphereLight('#dff1ff', '#5d7a4a', 0.75);
    scene.add(hemisphere);

    sun = new THREE.DirectionalLight('#fff4e0', 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
    scene.add(sun, sun.target);

    const starPositions = [];
    const random = seededRandom(7);
    for (let i = 0; i < 1500; i++) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(random() * 0.95);
      starPositions.push(Math.sin(phi) * Math.cos(theta) * 1200, Math.cos(phi) * 1200, Math.sin(phi) * Math.sin(theta) * 1200);
    }
    moon = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: '#f1f3ff', fog: false }));
    moon.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: '#9fb4ff', transparent: true, opacity: 0.12, fog: false, depthWrite: false })));
    scene.add(moon);
    stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(stars);

    clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material('#ffffff', { roughness: 1, transparent: true, opacity: 0.92, flatShading: true }), 60);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) {
      const cloudScale = new THREE.Vector3(18 + random() * 22, 5 + random() * 5, 12 + random() * 14);
      matrix.compose(new THREE.Vector3((random() - 0.5) * 1400, 90 + random() * 50, (random() - 0.5) * 1400 + 200), new THREE.Quaternion(), cloudScale);
      clouds.setMatrixAt(i, matrix);
    }
    clouds.castShadow = false;
    scene.add(clouds);

    rain = createPrecipitation(4000, '#a5c8ff', 0.35, true);
    snow = createPrecipitation(2500, '#ffffff', 1.4, false);
  }

  function createPrecipitation(count, color, size, isRain) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = Math.random() * 80;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: isRain ? 0.6 : 0.9, depthWrite: false }));
    points.visible = false;
    points.userData = { speed: isRain ? 60 : 6, isRain };
    scene.add(points);
    return points;
  }

  // Minecraft-style ticks: 0 = sunrise (06:00), 6000 = noon, 12000 = sunset, 18000 = midnight
  const skyKeys = [
    { tick: 0, top: '#5b7fcf', bottom: '#ffb38a', light: 0.55 },
    { tick: 2000, top: '#3d8bfd', bottom: '#dff1ff', light: 1 },
    { tick: 10000, top: '#3d8bfd', bottom: '#dff1ff', light: 1 },
    { tick: 12000, top: '#4b4a8f', bottom: '#ff8c5a', light: 0.5 },
    { tick: 13500, top: '#0b1430', bottom: '#2a2160', light: 0.14 },
    { tick: 22500, top: '#0b1430', bottom: '#2a2160', light: 0.14 },
    { tick: 24000, top: '#5b7fcf', bottom: '#ffb38a', light: 0.55 }
  ];

  function skyAt(ticks) {
    const t = ((ticks % 24000) + 24000) % 24000;
    for (let i = 0; i < skyKeys.length - 1; i++) {
      const a = skyKeys[i];
      const b = skyKeys[i + 1];
      if (t >= a.tick && t <= b.tick) {
        const k = (t - a.tick) / (b.tick - a.tick);
        return {
          top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), k),
          bottom: new THREE.Color(a.bottom).lerp(new THREE.Color(b.bottom), k),
          light: a.light + (b.light - a.light) * k
        };
      }
    }
    return { top: new THREE.Color(skyKeys[0].top), bottom: new THREE.Color(skyKeys[0].bottom), light: 0.5 };
  }

  function updateEnvironment({ ticks, weather, camera, focus, deltaSeconds, time }) {
    const colors = skyAt(ticks);
    const stormFactor = weather === 'clear' ? 1 : weather === 'thunder' ? 0.45 : 0.65;
    const gray = new THREE.Color('#7b8794');
    if (weather !== 'clear') {
      colors.top.lerp(gray, 0.55);
      colors.bottom.lerp(gray, 0.45);
    }
    sky.material.uniforms.topColor.value.copy(colors.top);
    sky.material.uniforms.bottomColor.value.copy(colors.bottom);
    sky.position.copy(camera.position);
    scene.fog.color.copy(colors.bottom);
    scene.fog.near = weather === 'clear' ? 140 : 60;
    scene.fog.far = weather === 'clear' ? 900 : 380;

    const daylight = colors.light * stormFactor;
    hemisphere.intensity = 0.15 + daylight * 0.5;
    hemisphere.color.copy(colors.bottom).lerp(new THREE.Color('#ffffff'), 0.5);
    const sunAngle = ((ticks % 24000) / 24000) * Math.PI * 2;
    const isDay = (ticks % 24000) < 12500 || (ticks % 24000) > 23500;
    sun.intensity = isDay ? daylight * 0.85 : 0.12;
    sun.color.set(isDay ? '#fff4e0' : '#9db4ff');
    const lightDirection = new THREE.Vector3(Math.cos(sunAngle) * 120, Math.abs(Math.sin(sunAngle)) * 160 + 30, 60);
    sun.position.copy(focus).add(lightDirection);
    sun.target.position.copy(focus);

    const night = 1 - Math.min(1, colors.light / 0.5);
    stars.material.opacity = weather === 'clear' ? Math.max(0, night) : 0;
    // The moon rises opposite the sun
    moon.position.set(camera.position.x - Math.cos(sunAngle) * 900, Math.max(-200, -Math.sin(sunAngle) * 700 + 150), camera.position.z - 500);
    moon.visible = night > 0.1 && weather === 'clear';
    stars.position.copy(camera.position);
    clouds.material.color.set(weather === 'clear' ? '#ffffff' : '#9aa5b1');
    clouds.position.x = (time * 2) % 200;
    nightWindowMaterials.forEach((windowMaterial) => { windowMaterial.emissive.setScalar(night * 0.9); });
    if (streetLampHeads) streetLampHeads.material.emissiveIntensity = 0.2 + night * 2.2;

    rain.visible = weather === 'rain' || weather === 'thunder';
    snow.visible = weather === 'snow';
    [rain, snow].forEach((points) => {
      if (!points.visible) return;
      points.position.set(camera.position.x, 0, camera.position.z);
      const positions = points.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) - points.userData.speed * deltaSeconds;
        if (y < 0) y += 80;
        positions.setY(i, y);
        if (!points.userData.isRain) positions.setX(i, positions.getX(i) + Math.sin(time + i) * 0.02);
      }
      positions.needsUpdate = true;
    });
    animatedCity.forEach((update) => update(time));
    return { flash: weather === 'thunder' && Math.random() < 0.004 };
  }

  function init(targetScene) {
    scene = targetScene;
    scene.fog = new THREE.Fog('#dff1ff', 140, 900);
    buildSky();
  }

  // --------------------------------------------------------------------------
  // Skyline ring: giant towers with LED billboards of big tech and dev tools,
  // plus blimps carrying banners over Genesis City
  // --------------------------------------------------------------------------
  const BRANDS = [
    ['GitHub', 'Where the world builds software', '#24292f', '#ffffff'],
    ['VS Code', 'Code editor', '#007acc', '#ffffff'],
    ['Docker', 'Containers', '#1d63ed', '#ffffff'],
    ['Kubernetes', 'Container orchestration', '#326ce5', '#ffffff'],
    ['Node.js', 'JavaScript runtime', '#3c873a', '#ffffff'],
    ['Python', 'Programming language', '#306998', '#ffd43b'],
    ['TypeScript', 'Typed JavaScript', '#3178c6', '#ffffff'],
    ['Rust', 'Systems programming', '#b7410e', '#ffffff'],
    ['React', 'UI library', '#20232a', '#61dafb'],
    ['Linux', 'Open source kernel', '#111111', '#fcc624'],
    ['Git', 'Version control', '#f05032', '#ffffff'],
    ['npm', 'Package registry', '#cb3837', '#ffffff'],
    ['Stack Overflow', 'Developer Q&A', '#f48024', '#ffffff'],
    ['Claude', 'AI assistant by Anthropic', '#d97757', '#ffffff'],
    ['OpenAI', 'AI research', '#10a37f', '#ffffff'],
    ['NVIDIA', 'GPUs & accelerated computing', '#76b900', '#000000'],
    ['AWS', 'Cloud computing', '#232f3e', '#ff9900'],
    ['Google Cloud', 'Cloud computing', '#4285f4', '#ffffff'],
    ['Microsoft Azure', 'Cloud computing', '#0078d4', '#ffffff'],
    ['Apple', 'WWDC & developer tools', '#1d1d1f', '#ffffff'],
    ['Meta', 'Open source AI & React', '#0866ff', '#ffffff'],
    ['Vercel', 'Frontend cloud', '#000000', '#ffffff'],
    ['Figma', 'Interface design', '#a259ff', '#ffffff'],
    ['Postman', 'API platform', '#ff6c37', '#ffffff']
  ];

  function brandTexture(name, tagline, background, foreground) {
    return PropKit.kit.canvasTexture(`brand|${name}`, 1024, 512, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, background);
      gradient.addColorStop(1, new THREE.Color(background).offsetHSL(0, 0, 0.12).getStyle());
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = foreground;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 6;
      ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.globalAlpha = 1;
      ctx.fillStyle = foreground;
      ctx.textAlign = 'center';
      ctx.font = `bold ${name.length > 10 ? 120 : 160}px Segoe UI, Helvetica, Arial, sans-serif`;
      ctx.fillText(name, w / 2, h / 2 + 20);
      ctx.font = '48px Segoe UI, Helvetica, Arial, sans-serif';
      ctx.globalAlpha = 0.85;
      ctx.fillText(tagline, w / 2, h / 2 + 110);
      ctx.globalAlpha = 1;
    });
  }

  function buildSkyline() {
    const ringRadius = (CITY_RADIUS + 0.5) * CELL_SIZE + 90;
    const random = seededRandom(4242);
    const towerTexture = repeated(windowsTexture('#2b2f3a', '#ffe9a8'), 3, 10);
    const towerMaterial = new THREE.MeshStandardMaterial({ map: towerTexture, emissiveMap: towerTexture, emissive: '#000000', roughness: 0.4, metalness: 0.4 });
    nightWindowMaterials.push(towerMaterial);
    BRANDS.forEach(([name, tagline, background, foreground], index) => {
      const angle = (index / BRANDS.length) * Math.PI * 2 + 0.07;
      const distance = ringRadius + random() * 70;
      const height = 70 + random() * 70;
      const width = 26 + random() * 10;
      const tower = new THREE.Group();
      tower.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, width), towerMaterial));
      tower.children[0].position.y = height / 2;
      // Giant LED billboard facing the city center, lit at night
      // Real logos (Simple Icons) when available, the brand wordmark otherwise
      const screenMaterial = new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture(name, { tagline, background, foreground }) });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.6, width * 0.8), screenMaterial);
      screen.position.set(0, height * 0.72, width / 2 + 0.6);
      tower.add(screen);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width * 1.66, width * 0.86, 0.8), material('#111111', { metalness: 0.6 }));
      frame.position.set(0, height * 0.72, width / 2 + 0.1);
      tower.add(frame);
      // Rooftop antenna with a blinking aviation light
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 18, 6), material('#9e9e9e'));
      antenna.position.y = height + 9;
      tower.add(antenna);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), glow('#ff3b30', 2));
      beacon.position.y = height + 18.5;
      tower.add(beacon);
      animatedCity.push((time) => { beacon.visible = Math.sin(time * 3 + index) > 0; });
      tower.position.set(Math.cos(angle) * distance, GROUND_LEVEL, Math.sin(angle) * distance);
      tower.rotation.y = Math.atan2(-tower.position.x, -tower.position.z);
      tower.traverse((node) => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; } });
      scene.add(tower);
    });

    // Blimps with banners circling above the city
    [['GitHub Multiverse', '#1877f2'], ['Ship it with Git', '#2da44e'], ['Join the Multiverse', '#0b4fa8']].forEach(([text, color], index) => {
      const blimp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material('#eceff1', { roughness: 0.4 }));
      body.scale.set(26, 8, 8);
      blimp.add(body);
      const gondola = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 3), material('#37474f'));
      gondola.position.y = -8.5;
      blimp.add(gondola);
      [-1, 1].forEach((side) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 6), material(color));
        fin.position.set(-24, 0, side * 3);
        fin.rotation.x = side * 0.6;
        blimp.add(fin);
      });
      const bannerTexture = PropKit.kit.labelTexture(text, { bg: color, fg: '#ffffff', width: 1024, height: 200, font: 'bold 110px Segoe UI, Helvetica, Arial, sans-serif' });
      [-1, 1].forEach((side) => {
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(36, 7), new THREE.MeshBasicMaterial({ map: bannerTexture, side: THREE.DoubleSide }));
        banner.position.set(0, -15, side * 0.2);
        blimp.add(banner);
      });
      const ropeMaterial = material('#90a4ae');
      [-14, 14].forEach((x) => {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 4), ropeMaterial);
        rope.position.set(x, -9, 0);
        blimp.add(rope);
      });
      blimp.traverse((node) => { node.raycast = () => {}; });
      scene.add(blimp);
      const radius = 160 + index * 70;
      const height = 75 + index * 15;
      animatedCity.push((time) => {
        const angle = time * (0.02 + index * 0.006) + index * 2.1;
        blimp.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        blimp.rotation.y = -angle - Math.PI / 2 * (index % 2 ? -1 : 1);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Horizon: red low-poly mesas with autumn trees, a sweeping arch landmark and
  // puffy cumulus clouds, so the sky around Genesis City never feels empty
  // --------------------------------------------------------------------------
  function buildHorizon() {
    const random = seededRandom(9001);
    const rock = new THREE.MeshStandardMaterial({ color: '#d9603b', roughness: 1, flatShading: true });
    const rockTop = new THREE.MeshStandardMaterial({ color: '#f08a5d', roughness: 1, flatShading: true });
    const autumn = ['#ff7f50', '#ff4d6d', '#ffb347', '#f78fb3', '#e84a5f', '#fdcb6e'];
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }), 220);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let crownIndex = 0;
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + random() * 0.15;
      const distance = 650 + random() * 250;
      const radius = 35 + random() * 50;
      const height = 30 + random() * 70;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius, height, 7), rock);
      mesa.position.set(Math.cos(angle) * distance, GROUND_LEVEL + height / 2, Math.sin(angle) * distance);
      mesa.rotation.y = random() * Math.PI;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.75, 3, 7), rockTop);
      cap.position.y = height / 2 + 1.5;
      mesa.add(cap);
      scene.add(mesa);
      for (let t = 0; t < 8 && crownIndex < 220; t++) {
        const treeAngle = random() * Math.PI * 2;
        const treeDistance = random() * radius * 0.6;
        const size = 5 + random() * 6;
        matrix.compose(new THREE.Vector3(mesa.position.x + Math.cos(treeAngle) * treeDistance, GROUND_LEVEL + height + 3 + size, mesa.position.z + Math.sin(treeAngle) * treeDistance), new THREE.Quaternion(), new THREE.Vector3(size, size * 1.2, size));
        crowns.setMatrixAt(crownIndex, matrix);
        crowns.setColorAt(crownIndex, color.set(autumn[Math.floor(random() * autumn.length)]));
        crownIndex++;
      }
    }
    crowns.count = crownIndex;
    scene.add(crowns);

    // Sweeping arch landmark on the northern horizon
    const arch = new THREE.Mesh(new THREE.TorusGeometry(160, 9, 12, 64, Math.PI), new THREE.MeshStandardMaterial({ color: '#e8d5c4', roughness: 0.6 }));
    arch.position.set(-120, GROUND_LEVEL, -760);
    arch.rotation.y = 0.3;
    scene.add(arch);
    for (let i = 0; i < 18; i++) {
      const t = (i + 0.5) / 18;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9.5, 1, 6, 16), glow('#ffb703', 0.6));
      ring.position.set(Math.cos(Math.PI * t) * 160, Math.sin(Math.PI * t) * 160, 0);
      ring.rotation.y = Math.PI / 2;
      arch.add(ring);
    }

    // Puffy cumulus clouds made of clustered spheres
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 });
    for (let i = 0; i < 18; i++) {
      const cloud = new THREE.Group();
      const puffs = 5 + Math.floor(random() * 4);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), cloudMaterial);
        const size = 14 + random() * 16;
        puff.scale.set(size, size * 0.8, size);
        puff.position.set((p - puffs / 2) * 14 + random() * 6, random() * 10 + (p % 2) * 8, random() * 10);
        cloud.add(puff);
      }
      const angle = random() * Math.PI * 2;
      const distance = 350 + random() * 450;
      cloud.position.set(Math.cos(angle) * distance, 130 + random() * 90, Math.sin(angle) * distance);
      cloud.traverse((node) => { node.raycast = () => {}; });
      scene.add(cloud);
      animatedCity.push((time) => { cloud.position.x += Math.sin(time * 0.01 + i) * 0.02; });
    }
  }

  // Called once every district is loaded
  function finalize() {
    buildGround();
    buildRoads();
    buildNeighborhoods();
    buildSkyline();
    buildHorizon();
  }

  return {
    PARCEL_SIZE, CELL_SIZE, CITY_RADIUS, GROUND_LEVEL,
    init, addDistrict, finalize, districtAt, updateEnvironment, layoutFor,
    // Objects the walking avatar can stand on or bump into around a point
    collidablesAt(x, z) {
      const district = districtAt(x, z);
      return district ? [district.root, ...sharedCollidables] : sharedCollidables;
    },
    get districts() { return districts; },
    get pickables() { return pickables; }
  };
})();
