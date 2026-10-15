// ============================================================================
// THE ORCHARD NEXUS: A FLOATING GLASS CUBE OVER A CIRCULAR DIGITAL PARK
// ============================================================================
// An Apple-inspired district (a fan tribute: no real building plans are copied).
// A 24 m glass cube floats 8 m above a minimalist circular park, held up by
// vertical beams of white light. A glass elevator takes visitors inside, where
// the ceiling shows a soft sky and holographic products float in the air.
//   - The park: ring path, fountains with animated jets, benches and "digital
//     trees" whose leaves follow the real season (northern hemisphere).
//   - The Spatial Quest: a kiosk lends a spatial headset; while worn, hidden
//     floating platforms and portals appear over the park with 3 headset parts
//     to collect. All 3 grant the in-game "vision-headset" badge (localStorage,
//     no purchases, nothing tradable).
//   - Smart Home demos: a living room (Apple TV trailers on the TV, a smart
//     speaker playing generated ambient music) and a kitchen (lighting scenes
//     and a blueprint stand that downloads smart-home-scripts.js).
//   - The Genius Bar AI: holographic assistants answer questions about 3D
//     optimization, spatial audio and SDK scripting (POST /api/genius).
const Orchard = (() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, repeated } = PropKit.kit;

  const CUBE_SIZE = 24;
  const CUBE_BOTTOM = 8;
  const CUBE_TOP = CUBE_BOTTOM + CUBE_SIZE;
  const PARK_RADIUS = 66;
  const APPLE_TV_CHANNEL = 'UC1Myj674wRVXB9I4c6Hm5zA';
  const PARTS_KEY = 'multiverse-orchard-parts';
  const BADGES_KEY = 'multiverse-badges';
  const BADGE_ID = 'vision-headset';

  let lastHooks = null;
  const noRaycast = (object) => { object.traverse((node) => { node.raycast = () => {}; node.castShadow = false; }); return object; };

  // --------------------------------------------------------------------------
  // Helpers: seeded random, instancing, storage
  // --------------------------------------------------------------------------
  function seeded(seed) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  // One InstancedMesh for many copies: [{ x, y, z, rx, ry, rz, sx, sy, sz }]
  const dummy = new THREE.Object3D();
  function instanced(geometry, meshMaterial, transforms, { colors = null, solid = true } = {}) {
    const result = new THREE.InstancedMesh(geometry, meshMaterial, transforms.length);
    transforms.forEach((t, index) => {
      dummy.position.set(t.x || 0, t.y || 0, t.z || 0);
      dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
      dummy.scale.set(t.sx || t.s || 1, t.sy || t.s || 1, t.sz || t.s || 1);
      dummy.updateMatrix();
      result.setMatrixAt(index, dummy.matrix);
      if (colors) result.setColorAt(index, new THREE.Color(colors[index]));
    });
    result.instanceMatrix.needsUpdate = true;
    if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.frustumCulled = false; // instances spread far from the geometry's own bounds
    result.receiveShadow = true;
    if (!solid) result.raycast = () => {};
    return result;
  }

  function readJson(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (error) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage blocked */ }
  }
  function hasBadge() {
    const badges = readJson(BADGES_KEY, []);
    return Array.isArray(badges) ? badges.includes(BADGE_ID) : !!(badges && badges[BADGE_ID]);
  }
  function grantBadge() {
    let badges = readJson(BADGES_KEY, []);
    if (Array.isArray(badges)) { if (!badges.includes(BADGE_ID)) badges.push(BADGE_ID); } else { badges = { ...(badges || {}), [BADGE_ID]: true }; }
    writeJson(BADGES_KEY, badges);
  }

  // Where the district sits in the world (for per-frame checks in local space)
  const rootPosition = new THREE.Vector3();
  function avatarLocal(anchor) {
    if (typeof avatar === 'undefined') return null;
    anchor.getWorldPosition(rootPosition);
    return avatar.position.clone().sub(rootPosition);
  }

  // --------------------------------------------------------------------------
  // Season of the digital trees, from today's real date (northern hemisphere).
  // ?orchardSeason=winter in the URL previews another season.
  // --------------------------------------------------------------------------
  const SEASONS = {
    spring: { name: 'Spring', leaves: ['#8bd27a', '#a9e39b', '#f7b6d2', '#f48fb1', '#ffd1e3'], wire: '#ffc9de', particle: '#ffd1e3', ground: '#7fbf5f', fall: 0.6 },
    summer: { name: 'Summer', leaves: ['#1f7a3a', '#2b8a3e', '#237032', '#2f9e44', '#37b24d'], wire: '#b2f2bb', particle: '#e9fac8', ground: '#5c9e3f', fall: -0.15 },
    autumn: { name: 'Autumn', leaves: ['#e8590c', '#d9480f', '#c92a2a', '#f08c00', '#fd7e14'], wire: '#ffc078', particle: '#f76707', ground: '#8a9a4a', fall: 0.9 },
    winter: { name: 'Winter', leaves: ['#f8f9fa', '#e7f5ff', '#d0ebff', '#a5d8ff', '#c5f6fa'], wire: '#a5d8ff', particle: '#ffffff', ground: '#dfe8ee', fall: 0.7 }
  };
  function currentSeason() {
    const override = /[?&]orchardSeason=(spring|summer|autumn|winter)/.exec(window.location.search);
    if (override) return SEASONS[override[1]];
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return SEASONS.spring;
    if (month >= 5 && month <= 7) return SEASONS.summer;
    if (month >= 8 && month <= 10) return SEASONS.autumn;
    return SEASONS.winter;
  }

  // --------------------------------------------------------------------------
  // Canvas textures
  // --------------------------------------------------------------------------
  function grassTexture(season) {
    return canvasTexture(`orchard-grass-${season.name}`, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = season.ground;
      ctx.fillRect(0, 0, w, h);
      const random = seeded(7);
      for (let i = 0; i < 9000; i++) {
        const shade = random();
        ctx.fillStyle = shade < 0.5 ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 2 + random() * 4);
      }
    });
  }

  function stoneTexture(key, base, seams) {
    return canvasTexture(`orchard-stone-${key}`, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const random = seeded(11);
      for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
      }
      if (seams) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 4; i++) {
          ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
        }
      }
    });
  }

  // Concentric pavers for the plaza under the cube
  function plazaTexture() {
    return canvasTexture('orchard-plaza', 1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(0, 0, w, h);
      const random = seeded(23);
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(random() * w, random() * h, 2, 2);
      }
      ctx.strokeStyle = 'rgba(80, 90, 100, 0.18)';
      ctx.lineWidth = 2;
      for (let r = 40; r < w / 2; r += 44) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); }
      for (let a = 0; a < 48; a++) {
        const angle = (a / 48) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(angle) * 40, h / 2 + Math.sin(angle) * 40); ctx.lineTo(w / 2 + Math.cos(angle) * w / 2, h / 2 + Math.sin(angle) * h / 2); ctx.stroke();
      }
    });
  }

  // Frosted glass floor tiles of the cube
  function cubeFloorTexture() {
    return canvasTexture('orchard-cube-floor', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#f4f7f9';
      ctx.fillRect(0, 0, w, h);
      const random = seeded(31);
      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgba(160, 190, 210, ${random() * 0.08})`;
        ctx.fillRect(random() * w, random() * h, 2, 2);
      }
      ctx.strokeStyle = 'rgba(120, 140, 160, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    });
  }

  // A high-definition sky for the ceiling: deep blue zenith, bright horizon glow
  function skyTexture() {
    return canvasTexture('orchard-sky', 1024, 1024, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.72);
      gradient.addColorStop(0, '#2f7fd8');
      gradient.addColorStop(0.55, '#5aa6ee');
      gradient.addColorStop(0.85, '#a9d4f7');
      gradient.addColorStop(1, '#e3f1fc');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Soft cumulus clouds on a transparent layer (drifts over the sky)
  function cloudTexture() {
    const texture = canvasTexture('orchard-clouds', 1024, 1024, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const random = seeded(99);
      for (let c = 0; c < 14; c++) {
        const cx = random() * w;
        const cy = random() * h;
        const size = 60 + random() * 90;
        for (let puff = 0; puff < 12; puff++) {
          const px = cx + (random() - 0.5) * size * 2.2;
          const py = cy + (random() - 0.5) * size * 0.9;
          const radius = size * (0.4 + random() * 0.6);
          [0, w, -w].forEach((ox) => [0, h, -h].forEach((oy) => {
            const g = ctx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, radius);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
            g.addColorStop(0.6, 'rgba(255, 255, 255, 0.22)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(px + ox - radius, py + oy - radius, radius * 2, radius * 2);
          }));
        }
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // Iridescent sheen + faint outlines of floating products: the "reflections"
  function holoTexture() {
    const texture = canvasTexture('orchard-holo', 1024, 1024, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let band = 0; band < 5; band++) {
        const x = (band / 5) * w;
        const g = ctx.createLinearGradient(x, 0, x + 260, h);
        g.addColorStop(0, 'rgba(255, 120, 200, 0)');
        g.addColorStop(0.3, 'rgba(120, 200, 255, 0.10)');
        g.addColorStop(0.5, 'rgba(180, 255, 220, 0.12)');
        g.addColorStop(0.7, 'rgba(200, 160, 255, 0.10)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(x, 0);
        ctx.transform(1, 0, -0.35, 1, 0, 0);
        ctx.fillRect(0, 0, 120, h);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(220, 240, 255, 0.28)';
      ctx.lineWidth = 4;
      // Laptop
      ctx.strokeRect(120, 600, 260, 170); ctx.beginPath(); ctx.moveTo(90, 790); ctx.lineTo(410, 790); ctx.lineTo(390, 770); ctx.lineTo(110, 770); ctx.closePath(); ctx.stroke();
      // Phone
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(620, 160, 120, 240, 22) : ctx.rect(620, 160, 120, 240); ctx.stroke();
      // Headset
      ctx.beginPath(); ctx.ellipse(760, 720, 130, 60, 0, 0, Math.PI * 2); ctx.stroke();
      // Watch
      ctx.strokeRect(300, 180, 90, 110); ctx.strokeRect(318, 120, 54, 60); ctx.strokeRect(318, 290, 54, 60);
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function fabricTexture() {
    return canvasTexture('orchard-fabric', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(80, 90, 100, 0.25)';
      for (let y = 4; y < h; y += 8) for (let x = (y / 8) % 2 ? 8 : 4; x < w; x += 8) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    });
  }

  function woodTexture() {
    return canvasTexture('orchard-wood', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8a27a';
      ctx.fillRect(0, 0, w, h);
      const random = seeded(5);
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = `rgba(110, 70, 40, ${0.05 + random() * 0.12})`;
        ctx.lineWidth = 1 + random() * 3;
        const y = random() * h;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
        ctx.stroke();
      }
    });
  }

  function marbleTexture() {
    return canvasTexture('orchard-marble', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#f6f7f8';
      ctx.fillRect(0, 0, w, h);
      const random = seeded(17);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(120, 130, 140, ${0.08 + random() * 0.15})`;
        ctx.lineWidth = 0.5 + random() * 2;
        let x = random() * w;
        let y = 0;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < h) { x += (random() - 0.5) * 40; y += 20 + random() * 30; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    });
  }

  function cabinetTexture() {
    return canvasTexture('orchard-cabinets', 512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f1f3f5';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.fillStyle = 'rgba(60, 60, 60, 0.45)';
      for (let x = 32; x < w; x += 64) ctx.fillRect(x - 14, 12, 28, 3);
    });
  }

  function plasterTexture() {
    return stoneTexture('plaster', '#f8f9fa', false);
  }

  // --------------------------------------------------------------------------
  // THE PARK: lawn, plaza, ring path, radial paths, benches and slim lamps
  // --------------------------------------------------------------------------
  function park(group) {
    const season = currentSeason();
    const flat = (geometry, meshMaterial, y) => {
      const result = mesh(geometry, meshMaterial, 0, y, 0);
      result.rotation.x = -Math.PI / 2;
      result.castShadow = false;
      return result;
    };
    group.add(flat(new THREE.CircleGeometry(PARK_RADIUS, 96), material('#ffffff', { map: repeated(grassTexture(season), 18, 18), roughness: 1 }), 0.02));
    group.add(flat(new THREE.CircleGeometry(21, 72), material('#ffffff', { map: plazaTexture(), roughness: 0.75 }), 0.06));
    const pathMaterial = material('#ffffff', { map: repeated(stoneTexture('path', '#dee2e6', true), 8, 1), roughness: 0.85 });
    group.add(flat(new THREE.RingGeometry(40, 44, 128), pathMaterial, 0.05));
    // Four radial paths from the plaza to the park edge
    const radialMaterial = material('#ffffff', { map: repeated(stoneTexture('radial', '#dee2e6', true), 1, 10), roughness: 0.85 });
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((angle) => {
      const strip = flat(new THREE.PlaneGeometry(4, PARK_RADIUS - 20), radialMaterial, 0.04);
      strip.rotation.z = angle;
      const mid = 20 + (PARK_RADIUS - 20) / 2;
      strip.position.set(Math.sin(angle) * mid, 0.04, Math.cos(angle) * mid);
      group.add(strip);
    });
    // Low white stone curb around the park
    const curb = mesh(new THREE.CylinderGeometry(PARK_RADIUS, PARK_RADIUS, 0.35, 120, 1, true), material('#f1f3f5', { roughness: 0.6, side: THREE.DoubleSide }), 0, 0.17, 0);
    curb.castShadow = false;
    group.add(curb);
    // Glowing halo ring on the plaza, right under the cube
    const halo = flat(new THREE.RingGeometry(17.4, 17.8, 96), glow('#ffffff', 1.1), 0.07);
    halo.raycast = () => {};
    group.add(halo);

    // Benches along the inner edge of the ring path (instanced: 3 draw calls)
    const benchCount = 12;
    const seats = [];
    const backs = [];
    const legs = [];
    for (let i = 0; i < benchCount; i++) {
      const angle = ((i + 0.5) / benchCount) * Math.PI * 2;
      const r = 38.8;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const ry = -angle - Math.PI / 2; // faces outward, toward the path
      const back = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(0.25);
      seats.push({ x, y: 0.45, z, ry });
      backs.push({ x: x + back.x, y: 0.75, z: z + back.z, ry });
      const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
      [-0.75, 0.75].forEach((offset) => legs.push({ x: x + side.x * offset, y: 0.22, z: z + side.z * offset, ry }));
      group.add(seat(x, 0.45, z, 'Park bench', ry));
    }
    group.add(instanced(new THREE.BoxGeometry(1.9, 0.08, 0.5), material('#ffffff', { map: woodTexture(), roughness: 0.7 }), seats));
    group.add(instanced(new THREE.BoxGeometry(1.9, 0.5, 0.06), material('#ffffff', { map: woodTexture(), roughness: 0.7 }), backs));
    group.add(instanced(new THREE.BoxGeometry(0.08, 0.44, 0.5), material('#ced4da', { metalness: 0.8, roughness: 0.3 }), legs));

    // Slim white light poles along the ring path
    const poles = [];
    const heads = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const x = Math.cos(angle) * 45;
      const z = Math.sin(angle) * 45;
      poles.push({ x, y: 2.25, z });
      heads.push({ x, y: 4.6, z });
    }
    group.add(instanced(new THREE.CylinderGeometry(0.07, 0.1, 4.5, 8), material('#f1f3f5', { metalness: 0.6, roughness: 0.3 }), poles));
    group.add(instanced(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), glow('#fff9ec', 1.3), heads, { solid: false }));

    const title = textSprite('The Orchard Nexus', { width: 14, background: 'rgba(250, 250, 252, 0.88)', color: '#1d1d1f' });
    title.position.set(0, 5.2, 21.5);
    group.add(title);
  }

  // Entrance monolith with the Apple logo (Simple Icons, via BrandLogos)
  function entranceSign(group, { label }) {
    const stone = material('#ffffff', { map: stoneTexture('monolith', '#e9ecef', false), roughness: 0.5 });
    group.add(box(7, 3.2, 0.7, stone, 0, 1.6, 0));
    const texture = typeof BrandLogos !== 'undefined'
      ? BrandLogos.billboardTexture(label || 'The Orchard Nexus', { layout: 'sign', logoSlug: 'apple', background: '#f8f9fa', foreground: '#1d1d1f', width: 1024, height: 256 })
      : PropKit.kit.labelTexture(label || 'The Orchard Nexus', { bg: '#f8f9fa', fg: '#1d1d1f', width: 1024, height: 256 });
    [1, -1].forEach((side) => {
      const face = mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: texture }), 0, 1.9, side * 0.36);
      if (side < 0) face.rotation.y = Math.PI;
      face.castShadow = false;
      group.add(face);
    });
    const season = currentSeason();
    const info = textSprite(`A fan tribute district · Trees in ${season.name} mode (live date)`, { width: 9, background: 'rgba(29, 29, 31, 0.8)' });
    info.position.set(0, 4, 0);
    group.add(info);
  }

  // --------------------------------------------------------------------------
  // DIGITAL TREES: low-poly canopies in the current season's palette, a glowing
  // wireframe "data" shell and falling particles (petals, leaves or snow)
  // --------------------------------------------------------------------------
  function grove(group) {
    const season = currentSeason();
    const random = seeded(42);
    const spots = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + 0.17;
      spots.push([Math.cos(angle) * 54, Math.sin(angle) * 54]);
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      spots.push([Math.cos(angle) * 61, Math.sin(angle) * 61 * 0.98]);
    }
    const trunks = [];
    const canopies = [];
    const colors = [];
    const shells = [];
    const bases = [];
    spots.forEach(([x, z]) => {
      const height = 3.2 + random() * 1.4;
      trunks.push({ x, y: height / 2, z, sy: height / 4 });
      for (let k = 0; k < 3; k++) {
        const s = 1.5 + random() * 0.9 - k * 0.25;
        canopies.push({ x: x + (random() - 0.5) * 1.6, y: height + 0.6 + k * 0.9, z: z + (random() - 0.5) * 1.6, s, ry: random() * 3 });
        colors.push(season.leaves[Math.floor(random() * season.leaves.length)]);
      }
      shells.push({ x, y: height + 1.4, z, s: 2.5, ry: random() * 3 });
      bases.push({ x, y: 0.08, z, rx: -Math.PI / 2 });
    });
    group.add(instanced(new THREE.CylinderGeometry(0.16, 0.24, 4, 8), material('#e9ecef', { metalness: 0.5, roughness: 0.35 }), trunks));
    const leaves = instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.6, emissive: season.wire, emissiveIntensity: 0.08 }), canopies, { colors });
    leaves.castShadow = true;
    group.add(leaves);
    const wire = new THREE.MeshBasicMaterial({ color: season.wire, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false });
    const shellMesh = instanced(new THREE.IcosahedronGeometry(1, 1), wire, shells, { solid: false });
    group.add(shellMesh);
    group.add(instanced(new THREE.RingGeometry(0.9, 1.1, 32), glow(season.wire, 1), bases, { solid: false }));
    animate(shellMesh, (time) => { wire.opacity = 0.25 + Math.sin(time * 1.5) * 0.12; });

    // Falling particles around the trees (one instanced mesh, recycled)
    const count = 220;
    const particles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ color: season.particle, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), count);
    particles.frustumCulled = false;
    particles.raycast = () => {};
    const state = [];
    for (let i = 0; i < count; i++) {
      const [x, z] = spots[i % spots.length];
      state.push({ x: x + (random() - 0.5) * 6, y: random() * 6, z: z + (random() - 0.5) * 6, speed: 0.4 + random() * 0.6, phase: random() * 6 });
    }
    group.add(particles);
    let last = 0;
    animate(particles, (time) => {
      const delta = Math.min(0.1, time - last || 0);
      last = time;
      state.forEach((p, index) => {
        if (season.fall > 0) {
          p.y -= p.speed * season.fall * delta;
          if (p.y < 0.05) p.y = 5.5 + Math.random();
        } else {
          // Summer: fireflies floating around the canopies
          p.y = 2.5 + Math.sin(time * p.speed + p.phase) * 1.5;
        }
        dummy.position.set(p.x + Math.sin(time * 0.8 + p.phase) * 0.6, p.y, p.z + Math.cos(time * 0.6 + p.phase) * 0.6);
        dummy.rotation.set(time * p.speed, time * 0.7 + p.phase, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        particles.setMatrixAt(index, dummy.matrix);
      });
      particles.instanceMatrix.needsUpdate = true;
    });
  }

  // --------------------------------------------------------------------------
  // FOUNTAINS: stone basin, rippling water, a central jet and a ring of jets
  // --------------------------------------------------------------------------
  let waterTexture = null;
  function fountain(group) {
    const stone = material('#ffffff', { map: stoneTexture('basin', '#f1f3f5', false), roughness: 0.5 });
    group.add(cylinder(4, 4.2, 0.6, stone, 0, 0.3, 0, 40));
    if (!waterTexture) {
      waterTexture = canvasTexture('orchard-water', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#4dabf7';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + (i % 5) * 0.03})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc((i * 53) % w, (i * 97) % h, 10 + (i % 7) * 6, 0, Math.PI * 2); ctx.stroke();
        }
      });
      waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
    }
    const water = mesh(new THREE.CircleGeometry(3.7, 40), material('#ffffff', { map: waterTexture, transparent: true, opacity: 0.88, roughness: 0.05, metalness: 0.2 }), 0, 0.62, 0);
    water.rotation.x = -Math.PI / 2;
    group.add(water);
    group.add(cylinder(0.45, 0.6, 1.1, stone, 0, 0.55, 0, 20));
    const jetMaterial = material('#d0ebff', { transparent: true, opacity: 0.55, emissive: '#a5d8ff', emissiveIntensity: 0.6, depthWrite: false });
    const jet = noRaycast(mesh(new THREE.CylinderGeometry(0.08, 0.22, 1, 12, 1, true), jetMaterial, 0, 1.1, 0));
    group.add(jet);
    const crown = noRaycast(sphere(0.35, jetMaterial, 0, 4, 0, 12));
    group.add(crown);
    const ringJets = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ringJets.push({ x: Math.cos(angle) * 2.8, y: 1.3, z: Math.sin(angle) * 2.8, rz: Math.cos(angle) * 0.35, rx: -Math.sin(angle) * 0.35 });
    }
    const jets = instanced(new THREE.CylinderGeometry(0.04, 0.08, 1.4, 8, 1, true), jetMaterial, ringJets, { solid: false });
    group.add(jets);
    animate(group, (time) => {
      const height = 2.6 + Math.sin(time * 1.3) * 1.1;
      jet.scale.y = height;
      jet.position.y = 1.1 + height / 2;
      crown.position.y = 1.1 + height;
      crown.scale.setScalar(0.8 + Math.sin(time * 6) * 0.15);
      jets.scale.y = 0.8 + Math.abs(Math.sin(time * 2.2)) * 0.6;
      waterTexture.offset.set(time * 0.02, time * 0.015);
    });
  }

  // --------------------------------------------------------------------------
  // THE GLASS CUBE: light beams, frosted floor, glass walls with holographic
  // reflections, steel mullions, a sky ceiling, floating products, elevator
  // --------------------------------------------------------------------------
  function productHologram(kind, holo, edge) {
    const product = new THREE.Group();
    if (kind === 'laptop') {
      product.add(mesh(new THREE.BoxGeometry(3, 0.12, 2), holo));
      const lid = mesh(new THREE.BoxGeometry(3, 2, 0.1), holo, 0, 1, -1);
      lid.rotation.x = -0.2;
      product.add(lid);
      product.add(mesh(new THREE.PlaneGeometry(2.7, 1.7), edge, 0, 1, -0.93));
    } else if (kind === 'phone') {
      product.add(mesh(new THREE.BoxGeometry(1.1, 2.2, 0.12), holo));
      product.add(mesh(new THREE.PlaneGeometry(0.98, 2.05), edge, 0, 0, 0.07));
    } else if (kind === 'headset') {
      const visor = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 24, 1, true, -Math.PI / 2.4, Math.PI / 1.2), holo);
      product.add(visor);
      const strap = mesh(new THREE.TorusGeometry(1.15, 0.08, 6, 24, Math.PI), edge);
      strap.rotation.set(Math.PI / 2, 0, Math.PI);
      product.add(strap);
    } else {
      product.add(mesh(new THREE.BoxGeometry(0.9, 1.05, 0.25), holo));
      product.add(mesh(new THREE.BoxGeometry(0.6, 2.6, 0.06), edge, 0, 0, -0.14));
    }
    return noRaycast(product);
  }

  function glassCube(group) {
    const half = CUBE_SIZE / 2;
    const mid = CUBE_BOTTOM + half;

    // Beams of white light holding the cube (additive, never walkable)
    const beamOuter = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    const beamCore = new THREE.MeshBasicMaterial({ color: '#f1f8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const beamPositions = [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]];
    beamPositions.forEach(([x, z]) => {
      group.add(noRaycast(mesh(new THREE.CylinderGeometry(0.85, 1.1, CUBE_BOTTOM, 24, 1, true), beamOuter, x, CUBE_BOTTOM / 2, z)));
      group.add(noRaycast(mesh(new THREE.CylinderGeometry(0.22, 0.22, CUBE_BOTTOM, 12, 1, true), beamCore, x, CUBE_BOTTOM / 2, z)));
      group.add(cylinder(1.3, 1.4, 0.16, glow('#ffffff', 1.4), x, 0.08, z, 28));
    });
    animate(group, (time) => {
      beamOuter.opacity = 0.14 + Math.sin(time * 2) * 0.04;
      beamCore.opacity = 0.6 + Math.sin(time * 3.1) * 0.12;
    });

    // Frosted glass floor (solid: the avatar walks on it)
    const floor = box(CUBE_SIZE, 0.5, CUBE_SIZE, material('#ffffff', { map: repeated(cubeFloorTexture(), 8, 8), transparent: true, opacity: 0.9, roughness: 0.18, metalness: 0.1 }), 0, CUBE_BOTTOM - 0.25, 0);
    floor.castShadow = true;
    group.add(floor);

    // Glass walls + roof (very transparent) and the holographic reflection layer
    const glass = new THREE.MeshStandardMaterial({ color: '#e7f5ff', transparent: true, opacity: 0.09, roughness: 0.04, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const holoMap = holoTexture();
    const holo = new THREE.MeshBasicMaterial({ map: holoMap, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const faces = [
      { position: [0, mid, -half], rotation: [0, 0, 0] },
      { position: [0, mid, half], rotation: [0, Math.PI, 0] },
      { position: [-half, mid, 0], rotation: [0, Math.PI / 2, 0] },
      { position: [half, mid, 0], rotation: [0, -Math.PI / 2, 0] },
      { position: [0, CUBE_TOP, 0], rotation: [-Math.PI / 2, 0, 0] }
    ];
    faces.forEach((face, index) => {
      const pane = mesh(new THREE.PlaneGeometry(CUBE_SIZE, CUBE_SIZE), glass, ...face.position);
      pane.rotation.set(...face.rotation);
      group.add(noRaycast(pane));
      if (index < 4) {
        const sheen = mesh(new THREE.PlaneGeometry(CUBE_SIZE, CUBE_SIZE), holo, ...face.position);
        sheen.rotation.set(...face.rotation);
        sheen.translateZ(0.06);
        group.add(noRaycast(sheen));
      }
    });
    animate(floor, (time) => { holoMap.offset.set(time * 0.012, Math.sin(time * 0.2) * 0.03); });

    // Invisible colliders inside the walls (6 m high) so nobody falls off
    const collider = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    [[0, -half + 0.15, CUBE_SIZE, 0.3], [0, half - 0.15, CUBE_SIZE, 0.3], [-half + 0.15, 0, 0.3, CUBE_SIZE], [half - 0.15, 0, 0.3, CUBE_SIZE]].forEach(([x, z, w, d]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), collider);
      wall.position.set(x, CUBE_BOTTOM + 3, z);
      group.add(wall);
    });

    // Steel mullions: 12 edges + a 3-line grid on every face (one draw call)
    const bars = [];
    const edge = 0.32;
    [-half, half].forEach((a) => [-half, half].forEach((b) => {
      bars.push({ x: a, y: mid, z: b, sx: edge, sy: CUBE_SIZE + edge, sz: edge });
      bars.push({ x: 0, y: CUBE_BOTTOM + (a < 0 ? 0 : CUBE_SIZE), z: b, sx: CUBE_SIZE, sy: edge, sz: edge });
      bars.push({ x: b, y: CUBE_BOTTOM + (a < 0 ? 0 : CUBE_SIZE), z: 0, sx: edge, sy: edge, sz: CUBE_SIZE });
    }));
    const thin = 0.1;
    [-6, 0, 6].forEach((offset) => {
      [-half, half].forEach((side) => {
        bars.push({ x: offset, y: mid, z: side, sx: thin, sy: CUBE_SIZE, sz: thin });
        bars.push({ x: side, y: mid, z: offset, sx: thin, sy: CUBE_SIZE, sz: thin });
        bars.push({ x: 0, y: mid + offset, z: side, sx: CUBE_SIZE, sy: thin, sz: thin });
        bars.push({ x: side, y: mid + offset, z: 0, sx: thin, sy: thin, sz: CUBE_SIZE });
      });
      bars.push({ x: offset, y: CUBE_TOP, z: 0, sx: thin, sy: thin, sz: CUBE_SIZE });
      bars.push({ x: 0, y: CUBE_TOP, z: offset, sx: CUBE_SIZE, sy: thin, sz: thin });
    });
    const steel = instanced(new THREE.BoxGeometry(1, 1, 1), material('#f1f3f5', { metalness: 0.85, roughness: 0.22, emissive: '#ffffff', emissiveIntensity: 0.25 }), bars, { solid: false });
    steel.castShadow = true;
    group.add(steel);

    // Ceiling: a high-definition sky with drifting clouds (seen from inside)
    const sky = mesh(new THREE.PlaneGeometry(CUBE_SIZE - 0.4, CUBE_SIZE - 0.4), new THREE.MeshBasicMaterial({ map: skyTexture() }), 0, CUBE_TOP - 0.3, 0);
    sky.rotation.x = Math.PI / 2;
    group.add(noRaycast(sky));
    const clouds = cloudTexture();
    const cloudLayer = mesh(new THREE.PlaneGeometry(CUBE_SIZE - 0.4, CUBE_SIZE - 0.4), new THREE.MeshBasicMaterial({ map: clouds, transparent: true, depthWrite: false }), 0, CUBE_TOP - 0.45, 0);
    cloudLayer.rotation.x = Math.PI / 2;
    group.add(noRaycast(cloudLayer));
    animate(cloudLayer, (time) => { clouds.offset.set(time * 0.006, time * 0.003); });

    // The glowing logo hovering in the middle of the cube
    if (typeof BrandLogos !== 'undefined') {
      const logo = mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture('Apple', { layout: 'logo', foreground: '#ffffff', width: 512, height: 512 }), transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, CUBE_BOTTOM + 11, 0);
      group.add(noRaycast(logo));
      animate(logo, (time) => { logo.rotation.y = time * 0.3; logo.position.y = CUBE_BOTTOM + 11 + Math.sin(time * 0.8) * 0.3; });
    }

    // Floating product holograms (semi-transparent, slowly rotating)
    const holoBody = new THREE.MeshStandardMaterial({ color: '#d0ebff', emissive: '#74c0fc', emissiveIntensity: 0.6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, metalness: 0.3, roughness: 0.2 });
    const holoEdge = new THREE.MeshBasicMaterial({ color: '#e5dbff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    [['laptop', -6.5, 15, 5.5], ['phone', 6.5, 16.5, 5.5], ['headset', -6, 17, -5.5], ['watch', 6, 14.5, -5.5]].forEach(([kind, x, y, z], index) => {
      const product = productHologram(kind, holoBody, holoEdge);
      product.position.set(x, CUBE_BOTTOM + y - 8, z);
      group.add(product);
      animate(product, (time) => {
        product.rotation.y = time * 0.35 + index;
        product.position.y = CUBE_BOTTOM + y - 8 + Math.sin(time * 0.7 + index) * 0.4;
      });
    });

    // Glass elevator tube from the plaza to the cube floor (warp both ways)
    const tubeGlass = new THREE.MeshStandardMaterial({ color: '#e7f5ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
    group.add(noRaycast(mesh(new THREE.CylinderGeometry(1.6, 1.6, CUBE_BOTTOM - 0.5, 32, 1, true), tubeGlass, 0, (CUBE_BOTTOM - 0.5) / 2, 0)));
    group.add(noRaycast(mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 32, 1, true), tubeGlass, 0, CUBE_BOTTOM + 1.5, 0)));
    const ringSteel = material('#f1f3f5', { metalness: 0.85, roughness: 0.2 });
    [0.1, CUBE_BOTTOM - 0.5, CUBE_BOTTOM + 3].forEach((y) => {
      const ring = mesh(new THREE.TorusGeometry(1.6, 0.07, 8, 40), ringSteel, 0, y, 0);
      ring.rotation.x = Math.PI / 2;
      group.add(noRaycast(ring));
    });
    group.add(cylinder(1.55, 1.55, 0.14, material('#ffffff', { map: cubeFloorTexture(), roughness: 0.3 }), 0, 0.12, 0, 32));
    const cabin = noRaycast(mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 32), glow('#e7f5ff', 0.9, { transparent: true, opacity: 0.6 }), 0, 1, 0));
    group.add(cabin);
    animate(cabin, (time) => { cabin.position.y = 0.3 + (Math.sin(time * 0.6) * 0.5 + 0.5) * (CUBE_BOTTOM - 1); });

    const up = new THREE.Object3D();
    up.position.set(0, 0.8, 0);
    up.userData.destination = new THREE.Vector3(0, CUBE_BOTTOM + 0.2, 2.4);
    up.userData.prompt = 'Press E to ride the glass elevator up to the Cube';
    group.add(interactive(up, 'warp', 'Glass elevator: welcome to the Cube.'));
    const down = new THREE.Object3D();
    down.position.set(0, CUBE_BOTTOM + 0.8, 0);
    down.userData.destination = new THREE.Vector3(0, 0.3, 2.6);
    down.userData.prompt = 'Press E to ride the glass elevator down to the park';
    group.add(interactive(down, 'warp', 'Glass elevator: back in the park.'));

    const sign = textSprite('Glass elevator · E', { width: 4, background: 'rgba(29, 29, 31, 0.8)' });
    sign.position.set(0, 3.4, 1.7);
    group.add(sign);
  }

  // --------------------------------------------------------------------------
  // SMART HOME DEMOS: living room and kitchen showrooms inside the cube
  // --------------------------------------------------------------------------
  const LIGHT_SCENES = [
    { name: 'Daylight', panel: '#fff8e7', intensity: 1.0, accent: '#ffffff', pool: 0.1 },
    { name: 'Evening', panel: '#ffb36b', intensity: 0.8, accent: '#ff922b', pool: 0.16 },
    { name: 'Movie', panel: '#3b2f6b', intensity: 0.35, accent: '#7048e8', pool: 0.08 },
    { name: 'Focus', panel: '#dbe9ff', intensity: 1.3, accent: '#4dabf7', pool: 0.14 },
    { name: 'Party', panel: '#ff4d9d', intensity: 1.0, accent: '#ff4d9d', pool: 0.2, party: true }
  ];

  function lightsPanelTexture(sceneIndex) {
    return canvasTexture(`orchard-lights-${sceneIndex}`, 256, 384, (ctx, w, h) => {
      ctx.fillStyle = '#1d1d1f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lighting', w / 2, 40);
      LIGHT_SCENES.forEach((scene, index) => {
        const y = 66 + index * 62;
        ctx.fillStyle = index === sceneIndex ? scene.accent : '#2c2c2e';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(20, y, w - 40, 50, 14); else ctx.rect(20, y, w - 40, 50);
        ctx.fill();
        ctx.fillStyle = index === sceneIndex && scene.name !== 'Movie' ? '#1d1d1f' : '#ffffff';
        ctx.font = '24px Segoe UI, Arial, sans-serif';
        ctx.fillText(scene.name, w / 2, y + 33);
      });
    });
  }

  // Ceiling light canopy + accent strips + light pool, driven by a scene index
  function roomLighting(group, w, d, label) {
    const panelMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff8e7', emissiveIntensity: 1 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 });
    const poolMaterial = new THREE.MeshBasicMaterial({ color: '#fff8e7', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    group.add(box(w, 0.16, d, material('#f8f9fa', { roughness: 0.4 }), 0, 4.4, 0));
    const panel = mesh(new THREE.PlaneGeometry(w - 1.2, d - 1.2), panelMaterial, 0, 4.31, 0);
    panel.rotation.x = Math.PI / 2;
    group.add(noRaycast(panel));
    group.add(noRaycast(box(w - 0.4, 0.05, 0.05, accentMaterial, 0, 3.55, -d / 2 + 0.25)));
    group.add(noRaycast(box(w - 0.4, 0.05, 0.05, accentMaterial, 0, 0.12, -d / 2 + 0.25)));
    const pool = mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.45, 40), poolMaterial, 0, 0.06, 0);
    pool.rotation.x = -Math.PI / 2;
    group.add(noRaycast(pool));
    // Slim columns holding the canopy
    [[-w / 2 + 0.15, -d / 2 + 0.15], [w / 2 - 0.15, -d / 2 + 0.15], [-w / 2 + 0.15, d / 2 - 0.15], [w / 2 - 0.15, d / 2 - 0.15]].forEach(([x, z]) => group.add(cylinder(0.06, 0.06, 4.4, material('#dee2e6', { metalness: 0.8, roughness: 0.25 }), x, 2.2, z, 8)));

    const state = { index: 0 };
    const screenMaterial = new THREE.MeshBasicMaterial({ map: lightsPanelTexture(0) });
    function apply() {
      const scene = LIGHT_SCENES[state.index];
      panelMaterial.emissive.set(scene.panel);
      panelMaterial.emissiveIntensity = scene.intensity;
      accentMaterial.emissive.set(scene.accent);
      poolMaterial.color.set(scene.panel);
      poolMaterial.opacity = scene.pool;
      screenMaterial.map = lightsPanelTexture(state.index);
      screenMaterial.needsUpdate = true;
    }
    animate(panel, (time) => {
      if (!LIGHT_SCENES[state.index].party) return;
      const hue = (time * 0.15) % 1;
      panelMaterial.emissive.setHSL(hue, 0.85, 0.55);
      accentMaterial.emissive.setHSL((hue + 0.5) % 1, 0.9, 0.55);
      poolMaterial.color.setHSL(hue, 0.85, 0.55);
    });
    // The wall panel (action): cycles the lighting scene
    const control = new THREE.Group();
    control.add(box(0.5, 0.72, 0.06, material('#f8f9fa', { metalness: 0.3, roughness: 0.3 })));
    control.add(mesh(new THREE.PlaneGeometry(0.42, 0.63), screenMaterial, 0, 0, 0.035));
    control.userData.prompt = `Press E to change the ${label} lighting scene`;
    control.userData.onInteract = () => {
      state.index = (state.index + 1) % LIGHT_SCENES.length;
      apply();
      if (window.Sound) Sound.play('click');
      return `${label} lights: ${LIGHT_SCENES[state.index].name}.`;
    };
    interactive(control, 'action', `${label} lights`);
    apply();
    return control;
  }

  // Generated ambient music (WebAudio, royalty-free by construction): soft
  // chords, an arpeggio and a delay; volume follows the distance to the speaker
  const Music = (() => {
    let context = null;
    let master = null;
    let timer = null;
    let nextTime = 0;
    let step = 0;
    let playing = false;
    const CHORDS = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]];
    const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);

    function setup() {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      const delay = context.createDelay();
      delay.delayTime.value = 0.38;
      const feedback = context.createGain();
      feedback.gain.value = 0.32;
      master.connect(filter);
      filter.connect(context.destination);
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(context.destination);
    }

    function note(frequency, start, length, type, volume) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.4, length / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + length + 0.05);
    }

    function schedule() {
      while (nextTime < context.currentTime + 0.6) {
        const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
        if (step % 8 === 0) chord.forEach((n) => note(midi(n), nextTime, 4.2, 'triangle', 0.05));
        const arp = chord[(step * 3) % chord.length] + 12;
        if (step % 2 === 0 || step % 8 === 5) note(midi(arp), nextTime, 0.9, 'sine', 0.06);
        nextTime += 0.5;
        step++;
      }
    }

    function start() {
      if (!context) setup();
      if (context.state === 'suspended') context.resume();
      playing = true;
      nextTime = context.currentTime + 0.1;
      clearInterval(timer);
      timer = setInterval(schedule, 150);
      schedule();
    }

    function stop() {
      playing = false;
      clearInterval(timer);
      if (master) master.gain.setTargetAtTime(0, context.currentTime, 0.3);
    }

    function setVolume(volume) {
      if (master && playing) master.gain.setTargetAtTime(volume, context.currentTime, 0.2);
    }

    return { start, stop, setVolume, isPlaying: () => playing };
  })();

  function smartSpeaker(group, x, z) {
    group.add(cylinder(0.32, 0.32, 0.55, material('#ffffff', { map: woodTexture(), roughness: 0.6 }), x, 0.275, z, 20));
    const body = cylinder(0.15, 0.15, 0.3, material('#ffffff', { map: fabricTexture(), roughness: 0.95 }), x, 0.7, z, 24);
    const topMaterial = new THREE.MeshStandardMaterial({ color: '#2c2c2e', emissive: '#000000', emissiveIntensity: 1, roughness: 0.3 });
    const top = noRaycast(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), topMaterial, x, 0.86, z));
    group.add(body);
    group.add(top);
    const waveMaterial = new THREE.MeshBasicMaterial({ color: '#e599f7', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const waves = [0, 1, 2].map((i) => {
      const wave = noRaycast(mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 32), waveMaterial, x, 0.7, z));
      wave.rotation.x = Math.PI / 2;
      wave.userData.offset = i / 3;
      group.add(wave);
      return wave;
    });
    animate(body, (time) => {
      const on = Music.isPlaying();
      waveMaterial.opacity = on ? 0.5 : 0;
      if (on) {
        topMaterial.emissive.setHSL((time * 0.2) % 1, 0.8, 0.5);
        waves.forEach((wave) => {
          const phase = (time * 0.6 + wave.userData.offset) % 1;
          wave.scale.setScalar(1 + phase * 4);
        });
        // Distance-based volume (a simple spatial falloff around the speaker)
        const local = avatarLocal(body);
        if (local) {
          const distance = Math.hypot(local.x, local.y - 0.7, local.z);
          Music.setVolume(Math.max(0, Math.min(1, 1.6 / Math.max(1, distance * 0.35))) * (distance > 30 ? 0 : 1));
        }
      } else {
        topMaterial.emissive.set('#000000');
      }
    });
    body.userData.prompt = 'Press E to play / stop the smart speaker';
    body.userData.onInteract = () => {
      if (Music.isPlaying()) { Music.stop(); return 'Smart speaker stopped.'; }
      Music.start();
      return 'Smart speaker: playing "Orchard Ambient" (generated live, royalty-free). Walk away and it fades out.';
    };
    interactive(body, 'action', 'Smart speaker');
  }

  const SMART_HOME_SCRIPTS = [
    '// smart-home-scripts.js - sample automations from The Orchard Nexus (GitHub Multiverse)',
    '// A tiny event-driven smart home: devices, scenes and automations you can',
    '// adapt to any 3D SDK (e.g. call these from Decentraland SDK7 systems or',
    '// pointer events, or from a three.js click handler).',
    '',
    'class Device {',
    '  constructor(id, state = {}) { this.id = id; this.state = { ...state }; this.listeners = []; }',
    '  set(patch) {',
    '    this.state = { ...this.state, ...patch };',
    '    this.listeners.forEach((listener) => listener(this.state, patch));',
    '    return this;',
    '  }',
    '  onChange(listener) { this.listeners.push(listener); return () => { this.listeners = this.listeners.filter((l) => l !== listener); }; }',
    '}',
    '',
    'const home = {',
    '  frontDoor: new Device(\'front-door\', { open: false, locked: true }),',
    '  livingLights: new Device(\'living-lights\', { on: false, color: \'#fff8e7\', brightness: 0.8 }),',
    '  kitchenLights: new Device(\'kitchen-lights\', { on: false, color: \'#ffffff\', brightness: 1 }),',
    '  speaker: new Device(\'speaker\', { playing: false, volume: 0.4, track: null })',
    '};',
    '',
    '// Scenes: one call sets many devices',
    'const scenes = {',
    '  arrive: () => { home.livingLights.set({ on: true, color: \'#ffb36b\', brightness: 0.7 }); home.speaker.set({ playing: true, track: \'welcome\' }); },',
    '  movie: () => { home.livingLights.set({ on: true, color: \'#3b2f6b\', brightness: 0.2 }); home.kitchenLights.set({ on: false }); home.speaker.set({ volume: 0.2 }); },',
    '  leave: () => { Object.values(home).forEach((device) => device.set({ on: false, playing: false })); home.frontDoor.set({ open: false, locked: true }); }',
    '};',
    '',
    '// Door: unlocks and opens, then closes itself after a delay',
    'function openDoor(closeAfterMs = 5000) {',
    '  home.frontDoor.set({ locked: false, open: true });',
    '  setTimeout(() => home.frontDoor.set({ open: false, locked: true }), closeAfterMs);',
    '}',
    '',
    '// Automations: react to state changes',
    'home.frontDoor.onChange((state, patch) => { if (patch.open === true) scenes.arrive(); });',
    'home.speaker.onChange((state) => console.log(`[speaker] ${state.playing ? \'playing\' : \'stopped\'} at volume ${state.volume}`));',
    'home.livingLights.onChange((state) => console.log(`[lights] living room ${state.on ? state.color : \'off\'}`));',
    '',
    '// Lights follow the time of day (call every minute)',
    'function circadianLights(date = new Date()) {',
    '  const hour = date.getHours();',
    '  const color = hour < 7 || hour >= 21 ? \'#ff9f43\' : hour < 17 ? \'#ffffff\' : \'#ffd8a8\';',
    '  [home.livingLights, home.kitchenLights].forEach((lights) => lights.set({ color }));',
    '}',
    '',
    '// Example wiring in a 3D scene (pseudo-code for any SDK):',
    '//   doorEntity.onClick(() => openDoor());',
    '//   lightSwitch.onClick(() => home.livingLights.set({ on: !home.livingLights.state.on }));',
    '//   home.livingLights.onChange((s) => setEmissive(lampEntity, s.on ? s.color : \'#000000\'));',
    '',
    'if (typeof module !== \'undefined\') module.exports = { Device, home, scenes, openDoor, circadianLights };',
    ''
  ].join('\n');

  function downloadScripts() {
    const blob = new Blob([SMART_HOME_SCRIPTS], { type: 'text/javascript' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'smart-home-scripts.js';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
  }

  function blueprintTexture() {
    return canvasTexture('orchard-blueprint', 512, 384, (ctx, w, h) => {
      ctx.fillStyle = '#0b3d91';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = '#e7f5ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(60, 70, 390, 230);
      ctx.beginPath(); ctx.moveTo(250, 70); ctx.lineTo(250, 210); ctx.moveTo(60, 210); ctx.lineTo(180, 210); ctx.stroke();
      ctx.beginPath(); ctx.arc(250, 300, 40, Math.PI, Math.PI * 1.5); ctx.stroke();
      ctx.fillStyle = '#e7f5ff';
      ctx.font = 'bold 30px Consolas, monospace';
      ctx.fillText('smart-home-scripts.js', 60, 48);
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('LIVING', 120, 150); ctx.fillText('KITCHEN', 320, 150); ctx.fillText('door()', 270, 345); ctx.fillText('lights()', 90, 260); ctx.fillText('speaker()', 300, 260);
    });
  }

  function smartRoom(group, { w, d, data }) {
    const room = data.room === 'kitchen' ? 'kitchen' : 'living';
    const plaster = material('#ffffff', { map: plasterTexture(), roughness: 0.8 });
    const inner = data.innerSide || 1; // which side faces the cube center (x)
    group.add(box(w, 0.04, d, material('#ffffff', { map: repeated(woodTexture(), 3, 3), roughness: 0.55 }), 0, 0.02, 0));
    group.add(box(w, 3.8, 0.2, plaster, 0, 1.9, -d / 2 + 0.1));
    group.add(box(0.2, 3.8, d * 0.45, plaster, inner * (w / 2 - 0.1), 1.9, -d / 2 + d * 0.225));
    const lights = roomLighting(group, w, d, room === 'kitchen' ? 'Kitchen' : 'Living room');
    lights.position.set(inner * (w / 2 - 0.25), 1.4, -d / 2 + d * 0.3);
    lights.rotation.y = -inner * Math.PI / 2;
    group.add(lights);
    const name = textSprite(room === 'kitchen' ? 'Smart Home · Kitchen' : 'Smart Home · Living Room', { width: 5, background: 'rgba(29, 29, 31, 0.8)' });
    name.position.set(0, 5.2, d / 2);
    group.add(name);

    if (room === 'living') {
      // TV with official Apple TV trailers (YouTube embed of the official channel)
      group.add(box(3.4, 0.45, 0.5, material('#ffffff', { map: woodTexture(), roughness: 0.6 }), 0, 0.225, -d / 2 + 0.5));
      const tvFrame = box(3.9, 2.25, 0.08, material('#1d1d1f', { metalness: 0.6, roughness: 0.3 }), 0, 1.95, -d / 2 + 0.25);
      group.add(tvFrame);
      const screen = mesh(new THREE.PlaneGeometry(3.7, 2.08), new THREE.MeshBasicMaterial({ color: '#05070d' }), 0, 1.95, -d / 2 + 0.3);
      group.add(screen);
      const embed = VideoScreens.channelUploadsEmbed(APPLE_TV_CHANNEL);
      const video = VideoScreens.register(screen, 3.7, 2.08, null, { distance: 18 });
      // Only stream while the avatar is inside the cube
      let streaming = false;
      animate(screen, () => {
        const local = avatarLocal(screen);
        const inside = local && local.y > -1 && local.y < 6 && Math.abs(local.x) < 14 && Math.abs(local.z) < 14;
        if (inside !== streaming) { streaming = inside; video.setSource(inside ? embed : null); }
      });
      tvFrame.userData.prompt = 'Press E: Apple TV trailers (V toggles sound)';
      tvFrame.userData.onInteract = () => 'The TV plays trailers from the official Apple TV YouTube channel. Press V to turn the sound on.';
      interactive(tvFrame, 'action', 'Apple TV');

      // Sofa facing the TV, coffee table and rug
      const sofa = material('#ced4da', { map: fabricTexture(), roughness: 0.95 });
      group.add(box(3.4, 0.45, 1.0, sofa, 0, 0.225, 1.4));
      group.add(box(3.4, 0.85, 0.28, sofa, 0, 0.6, 1.95));
      [-1, 1].forEach((side) => group.add(box(0.28, 0.65, 1.0, sofa, side * 1.84, 0.33, 1.4)));
      [-1.1, 0, 1.1].forEach((x) => group.add(seat(x, 0.45, 1.3, 'Sofa', Math.PI)));
      const rug = mesh(new THREE.PlaneGeometry(4, 2.8), material('#e9ecef', { map: fabricTexture(), roughness: 1 }), 0, 0.05, 0.1);
      rug.rotation.x = -Math.PI / 2;
      rug.castShadow = false;
      group.add(rug);
      group.add(box(1.6, 0.06, 0.8, material('#e7f5ff', { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 0.42, -0.1));
      [-0.7, 0.7].forEach((x) => group.add(box(0.05, 0.4, 0.7, material('#adb5bd', { metalness: 0.8, roughness: 0.3 }), x, 0.2, -0.1)));
      smartSpeaker(group, 2.3, 1.4);
    } else {
      // Kitchen: back counter, upper cabinets, fridge, island with stools
      const cabinets = material('#ffffff', { map: repeated(cabinetTexture(), 2, 1), roughness: 0.5 });
      const top = material('#ffffff', { map: marbleTexture(), roughness: 0.25 });
      const counterX = inner * 0.75; // the counter starts at the inner side wall, the fridge stands on the outer side
      group.add(box(7.2, 0.9, 0.65, cabinets, counterX, 0.45, -d / 2 + 0.55));
      group.add(box(7.3, 0.06, 0.72, top, counterX, 0.93, -d / 2 + 0.55));
      group.add(box(5, 0.8, 0.38, cabinets, counterX, 2.35, -d / 2 + 0.4));
      group.add(box(0.7, 0.04, 0.45, material('#adb5bd', { metalness: 0.9, roughness: 0.2 }), counterX - 1.2, 0.97, -d / 2 + 0.55));
      group.add(box(1.0, 2.3, 0.75, material('#dee2e6', { metalness: 0.7, roughness: 0.25 }), -inner * 3.85, 1.15, -d / 2 + 0.6));
      // Smart display on the counter
      const displayTexture = canvasTexture('orchard-smart-display', 512, 320, (ctx, w2, h2) => {
        const g = ctx.createLinearGradient(0, 0, w2, h2);
        g.addColorStop(0, '#1c7ed6');
        g.addColorStop(1, '#7048e8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w2, h2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px Segoe UI, Arial, sans-serif';
        ctx.fillText('21:04', 30, 100);
        ctx.font = '30px Segoe UI, Arial, sans-serif';
        ctx.fillText('Kitchen · 21°C · Lights on', 30, 150);
        ['Door', 'Lights', 'Music'].forEach((label, index) => {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(30 + index * 155, 200, 140, 80);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, 50 + index * 155, 250);
        });
      });
      const display = mesh(new THREE.PlaneGeometry(0.7, 0.44), new THREE.MeshBasicMaterial({ map: displayTexture }), counterX + 1.6, 1.22, -d / 2 + 0.55);
      display.rotation.x = -0.25;
      group.add(display);
      group.add(box(3.4, 0.9, 1.1, cabinets, 0, 0.45, 0.6));
      group.add(box(3.5, 0.06, 1.2, top, 0, 0.93, 0.6));
      const stoolSeat = material('#1d1d1f', { roughness: 0.6 });
      const stoolPost = material('#adb5bd', { metalness: 0.85, roughness: 0.25 });
      [-0.9, 0.9].forEach((x) => {
        group.add(cylinder(0.22, 0.22, 0.07, stoolSeat, x, 0.75, 1.65, 16));
        group.add(cylinder(0.04, 0.04, 0.72, stoolPost, x, 0.37, 1.65, 8));
        group.add(cylinder(0.2, 0.2, 0.03, stoolPost, x, 0.02, 1.65, 16));
        group.add(seat(x, 0.75, 1.65, 'Kitchen stool', Math.PI));
      });
      // Pendant lights over the island
      [-1, 0, 1].forEach((x) => {
        group.add(noRaycast(cylinder(0.01, 0.01, 1.6, material('#1d1d1f'), x, 3.5, 0.6, 4)));
        group.add(noRaycast(sphere(0.16, glow('#fff3bf', 1.2), x, 2.65, 0.6, 12)));
      });

      // Blueprint stand: downloads smart-home-scripts.js
      const stand = new THREE.Group();
      stand.add(cylinder(0.04, 0.04, 1.2, stoolPost, 0, 0.6, 0, 8));
      stand.add(cylinder(0.3, 0.3, 0.04, stoolPost, 0, 0.02, 0, 16));
      const board = mesh(new THREE.PlaneGeometry(1.1, 0.82), new THREE.MeshBasicMaterial({ map: blueprintTexture(), side: THREE.DoubleSide }), 0, 1.45, 0);
      board.rotation.x = -0.35;
      stand.add(board);
      stand.position.set(inner * (w / 2 - 1.2), 0, d / 2 - 1);
      stand.rotation.y = inner * -0.5;
      stand.userData.prompt = 'Press E to download smart-home-scripts.js (blueprint)';
      stand.userData.onInteract = () => { downloadScripts(); return 'smart-home-scripts.js downloaded: door, lights and speaker automations you can adapt to your own scene.'; };
      group.add(interactive(stand, 'action', 'Blueprint stand'));
    }
  }

  // --------------------------------------------------------------------------
  // GENIUS BAR AI: long white table, stools, holographic assistants, DOM panel
  // --------------------------------------------------------------------------
  let geniusPanel = null;
  function injectGeniusStyles() {
    if (document.getElementById('orchard-styles')) return;
    const style = document.createElement('style');
    style.id = 'orchard-styles';
    style.textContent = `
      #orchard-genius { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(10, 12, 16, 0.45); z-index: 60; font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; }
      #orchard-genius.open { display: flex; }
      #orchard-genius .og-card { width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; background: rgba(250, 250, 252, 0.97); color: #1d1d1f; border-radius: 18px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35); padding: 20px 22px; }
      #orchard-genius header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
      #orchard-genius header b { font-size: 20px; flex: 1; }
      #orchard-genius header button { border: 0; background: #e9ecef; border-radius: 50%; width: 30px; height: 30px; font-size: 18px; cursor: pointer; color: #1d1d1f; }
      #orchard-genius .og-sub { margin: 0 0 12px; color: #6e6e73; font-size: 13px; }
      #orchard-genius .og-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      #orchard-genius .og-chips button { border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
      #orchard-genius .og-chips button:hover { border-color: #0071e3; color: #0071e3; }
      #orchard-genius textarea { width: 100%; box-sizing: border-box; min-height: 74px; resize: vertical; border: 1px solid #d2d2d7; border-radius: 12px; padding: 10px 12px; font: inherit; font-size: 14px; color: #1d1d1f; background: #fff; }
      #orchard-genius textarea:focus { outline: 2px solid #0071e3; border-color: transparent; }
      #orchard-genius .og-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
      #orchard-genius .og-count { flex: 1; font-size: 12px; color: #86868b; }
      #orchard-genius .og-ask { border: 0; background: #0071e3; color: #fff; border-radius: 999px; padding: 8px 20px; font-size: 14px; cursor: pointer; }
      #orchard-genius .og-ask:disabled { opacity: 0.5; cursor: default; }
      #orchard-genius .og-answer { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #eef4ff; font-size: 14px; line-height: 1.5; white-space: pre-wrap; display: none; }
      #orchard-genius .og-answer.show { display: block; }
      #orchard-genius .og-tag { display: inline-block; margin-bottom: 6px; font-size: 11px; color: #0071e3; text-transform: uppercase; letter-spacing: 0.06em; }
      #orchard-hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; display: none; background: radial-gradient(ellipse at center, rgba(120, 200, 255, 0) 55%, rgba(120, 200, 255, 0.16) 80%, rgba(60, 120, 220, 0.38) 100%); box-shadow: inset 0 0 0 3px rgba(190, 230, 255, 0.35); }
      #orchard-hud.on { display: block; }
      #orchard-hud span { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: rgba(29, 29, 31, 0.6); color: #fff; padding: 5px 14px; border-radius: 999px; font: 13px -apple-system, 'Segoe UI', Arial, sans-serif; backdrop-filter: blur(6px); white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function openGenius(topic) {
    injectGeniusStyles();
    if (!geniusPanel) {
      geniusPanel = document.createElement('div');
      geniusPanel.id = 'orchard-genius';
      geniusPanel.innerHTML = `<div class="og-card" role="dialog" aria-label="Genius Bar AI">
          <header><b>Genius Bar AI</b><button type="button" class="og-close" aria-label="Close">&times;</button></header>
          <p class="og-sub">Ask about 3D optimization, spatial audio or SDK interactions. Esc to close.</p>
          <div class="og-chips"></div>
          <textarea maxlength="500" placeholder="e.g. How do I make my glTF scene load faster?"></textarea>
          <div class="og-row"><span class="og-count">0 / 500</span><button type="button" class="og-ask">Ask</button></div>
          <div class="og-answer"></div>
        </div>`;
      document.body.appendChild(geniusPanel);
      const input = geniusPanel.querySelector('textarea');
      const count = geniusPanel.querySelector('.og-count');
      const chips = geniusPanel.querySelector('.og-chips');
      ['How do I optimize a glTF model?', 'What is Draco compression?', 'Spatial audio rolloff settings', 'SDK7 components and systems', 'Colliders for walkable scenes', 'When should I use instancing?'].forEach((question) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = question;
        chip.addEventListener('click', () => { input.value = question; count.textContent = `${question.length} / 500`; ask(); });
        chips.appendChild(chip);
      });
      input.addEventListener('input', () => { count.textContent = `${input.value.length} / 500`; });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { closeGenius(); event.preventDefault(); }
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); }
      });
      geniusPanel.querySelector('.og-ask').addEventListener('click', ask);
      geniusPanel.querySelector('.og-close').addEventListener('click', closeGenius);
      geniusPanel.addEventListener('click', (event) => { if (event.target === geniusPanel) closeGenius(); });
      window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && geniusPanel.classList.contains('open')) closeGenius(); });
    }
    if (typeof keysPressed !== 'undefined') keysPressed.clear();
    geniusPanel.classList.add('open');
    geniusPanel.querySelector('.og-sub').textContent = `${topic ? `${topic} assistant · ` : ''}Ask about 3D optimization, spatial audio or SDK interactions. Esc to close.`;
    // Focus after the E key press is done, so the "e" is not typed in the box
    setTimeout(() => geniusPanel.querySelector('textarea').focus(), 60);
  }

  function closeGenius() {
    if (!geniusPanel) return;
    geniusPanel.classList.remove('open');
    geniusPanel.querySelector('textarea').blur();
  }

  async function ask() {
    const input = geniusPanel.querySelector('textarea');
    const button = geniusPanel.querySelector('.og-ask');
    const answer = geniusPanel.querySelector('.og-answer');
    const question = input.value.trim().slice(0, 500);
    if (!question || button.disabled) return;
    button.disabled = true;
    answer.classList.add('show');
    answer.textContent = 'Thinking...';
    try {
      const response = await fetch('/api/genius', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await response.json().catch(() => ({}));
      answer.textContent = '';
      const tag = document.createElement('span');
      tag.className = 'og-tag';
      tag.textContent = response.ok ? (data.offline ? 'Curated tip (offline mode)' : 'Genius Bar AI') : 'Genius Bar';
      answer.appendChild(tag);
      answer.appendChild(document.createElement('br'));
      answer.appendChild(document.createTextNode(response.ok ? data.answer : (data.error || 'The Genius Bar could not answer right now.')));
    } catch (error) {
      answer.textContent = 'The Genius Bar needs the Multiverse server (node server.js) to answer.';
    }
    button.disabled = false;
  }

  function geniusBar(group, { w }) {
    const length = w || 14;
    const corian = material('#ffffff', { map: stoneTexture('corian', '#fbfbfd', false), roughness: 0.3 });
    group.add(box(length, 0.08, 1.1, corian, 0, 1.0, 0));
    [-length / 2 + 0.6, 0, length / 2 - 0.6].forEach((x) => group.add(box(0.12, 0.96, 0.9, corian, x, 0.48, 0)));
    // Stools on the visitors' side
    const stoolSeat = material('#ffffff', { map: woodTexture(), roughness: 0.55 });
    const stoolPost = material('#adb5bd', { metalness: 0.85, roughness: 0.25 });
    const stoolX = [-6, -3, 3, 6].filter((x) => Math.abs(x) < length / 2);
    stoolX.forEach((x) => {
      group.add(cylinder(0.24, 0.24, 0.07, stoolSeat, x, 0.75, -1.05, 16));
      group.add(cylinder(0.04, 0.04, 0.72, stoolPost, x, 0.37, -1.05, 8));
      group.add(cylinder(0.22, 0.22, 0.03, stoolPost, x, 0.02, -1.05, 16));
      group.add(seat(x, 0.75, -1.05, 'Genius Bar stool', 0));
    });
    // Backdrop panel behind the assistants
    const backdrop = canvasTexture('orchard-genius-backdrop', 1024, 256, (ctx, bw, bh) => {
      const g = ctx.createLinearGradient(0, 0, bw, 0);
      g.addColorStop(0, '#f5f5f7');
      g.addColorStop(1, '#e8f0fe');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bw, bh);
      ctx.fillStyle = '#1d1d1f';
      ctx.font = '600 78px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Genius Bar AI', bw / 2, 120);
      ctx.fillStyle = '#6e6e73';
      ctx.font = '34px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.fillText('3D optimization · Spatial audio · SDK interactions', bw / 2, 185);
    });
    group.add(box(length, 3, 0.15, material('#ffffff', { roughness: 0.5 }), 0, 1.5, 2.9));
    const backFace = mesh(new THREE.PlaneGeometry(length - 0.4, (length - 0.4) / 4), new THREE.MeshBasicMaterial({ map: backdrop }), 0, 1.6, 2.81);
    backFace.rotation.y = Math.PI;
    group.add(backFace);

    // Holographic assistants (stylized translucent figures)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#c5f6fa', emissive: '#66d9e8', emissiveIntensity: 0.7, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.2 });
    const coreMaterial = new THREE.MeshBasicMaterial({ color: '#e3fafc', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#99e9f2', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    [['3D Optimization', -4.5], ['Spatial Audio', 0], ['SDK Scripting', 4.5]].forEach(([topic, x], index) => {
      const figure = new THREE.Group();
      figure.add(mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.1, 20), bodyMaterial, 0, 0.55, 0));
      figure.add(mesh(new THREE.SphereGeometry(0.26, 20, 14), bodyMaterial, 0, 1.38, 0));
      figure.add(mesh(new THREE.SphereGeometry(0.09, 12, 8), coreMaterial, 0, 0.8, 0.12));
      const ring = mesh(new THREE.TorusGeometry(0.45, 0.015, 6, 40), ringMaterial, 0, 1.05, 0);
      ring.rotation.x = Math.PI / 2;
      figure.add(ring);
      figure.add(mesh(new THREE.CircleGeometry(0.5, 32), ringMaterial, 0, 0.02, 0));
      figure.children[figure.children.length - 1].rotation.x = -Math.PI / 2;
      figure.position.set(x, 0.3, 1.6);
      noRaycast(figure);
      group.add(figure);
      animate(figure, (time) => {
        figure.position.y = 0.3 + Math.sin(time * 1.4 + index) * 0.08;
        ring.rotation.z = time * 0.8;
        ring.scale.setScalar(1 + Math.sin(time * 2 + index) * 0.08);
      });
      const tag = textSprite(`Genius AI · ${topic}`, { width: 3.2, background: 'rgba(29, 29, 31, 0.75)' });
      tag.position.set(x, 2.55, 1.6);
      group.add(tag);
      // Ask spot on the table edge in front of the assistant
      const spot = new THREE.Object3D();
      spot.position.set(x, 1.0, -0.5);
      spot.userData.prompt = `Press E to ask the Genius AI (${topic})`;
      spot.userData.onInteract = () => { openGenius(topic); return null; };
      group.add(interactive(spot, 'action', `Genius AI ${topic}`));
    });
  }

  // --------------------------------------------------------------------------
  // THE SPATIAL QUEST: headset kiosk, hidden sky circuit, 3 parts, badge
  // --------------------------------------------------------------------------
  const quest = { worn: false, meshes: [], parts: [], portals: [], hud: null, headset: null, anchor: null };
  const PARTS = [
    { id: 'lenses', name: 'Lenses' },
    { id: 'strap', name: 'Strap' },
    { id: 'front-glass', name: 'Front glass' }
  ];

  function collectedParts() {
    const saved = readJson(PARTS_KEY, []);
    return Array.isArray(saved) ? saved.filter((id) => PARTS.some((part) => part.id === id)) : [];
  }

  function updateHud() {
    if (!quest.hud) {
      injectGeniusStyles();
      quest.hud = document.createElement('div');
      quest.hud.id = 'orchard-hud';
      quest.hud.innerHTML = '<span></span>';
      document.body.appendChild(quest.hud);
    }
    quest.hud.classList.toggle('on', quest.worn);
    const got = collectedParts().length;
    quest.hud.querySelector('span').textContent = hasBadge()
      ? 'Spatial mode · Vision Headset badge earned · platforms visible over the park'
      : `Spatial mode · Headset parts ${got}/3 · find the floating platforms over the park`;
  }

  // The headset worn on the avatar (on the same spot as the eyewear)
  function headsetModel() {
    const headset = new THREE.Group();
    headset.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: '#e9ecef', metalness: 0.9, roughness: 0.2 })));
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.54), new THREE.MeshStandardMaterial({ color: '#111418', metalness: 0.3, roughness: 0.05, emissive: '#4dabf7', emissiveIntensity: 0.4 }));
    headset.add(front);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.56), new THREE.MeshStandardMaterial({ color: '#495057', roughness: 0.9 }));
    strap.position.x = -0.32;
    headset.add(strap);
    headset.position.set(0.25, -0.36, 0);
    headset.userData.front = front;
    headset.traverse((node) => { node.raycast = () => {}; });
    return headset;
  }

  function syncHeadset() {
    if (typeof localCursor === 'undefined' || !localCursor || !localCursor.mesh) return;
    const pivot = localCursor.mesh.userData.arrowPivot;
    if (!pivot) return;
    if (!quest.headset) quest.headset = headsetModel();
    const show = quest.worn || hasBadge();
    if (show && quest.headset.parent !== pivot) pivot.add(quest.headset);
    if (!show && quest.headset.parent) quest.headset.parent.remove(quest.headset);
    quest.headset.userData.front.material.emissiveIntensity = quest.worn ? 1.1 : 0.2;
  }

  function setWorn(worn) {
    quest.worn = worn;
    const got = collectedParts();
    quest.meshes.forEach((object) => { object.visible = worn; });
    quest.parts.forEach((part) => { part.visible = worn && !got.includes(part.userData.partId); });
    updateHud();
    syncHeadset();
  }

  // Platform centers along an arc around the cube, rising step by step
  function arc(radius, startDeg, count, rise, startTop) {
    const step = 2 * Math.asin(2.6 / radius); // 5.2 m between centers: ~2 m gaps
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = THREE.MathUtils.degToRad(startDeg) - i * step;
      points.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, top: startTop + i * rise, angle });
    }
    return points;
  }

  function spatialQuest(group, { data }) {
    quest.anchor = group;
    const kiosk = data.kiosk || [-10, 0, 29];
    // Kiosk: white pillar with a headset on a glass dome
    const kioskGroup = new THREE.Group();
    kioskGroup.position.set(kiosk[0], kiosk[1], kiosk[2]);
    kioskGroup.add(box(1.2, 1.1, 0.8, material('#ffffff', { map: stoneTexture('kiosk', '#fbfbfd', false), roughness: 0.35 }), 0, 0.55, 0));
    const kioskScreen = canvasTexture('orchard-kiosk', 512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1d1d1f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '600 48px -apple-system, Segoe UI, Arial, sans-serif';
      ctx.fillText('The Spatial Quest', w / 2, 90);
      ctx.fillStyle = '#a1c6ff';
      ctx.font = '28px -apple-system, Segoe UI, Arial, sans-serif';
      ctx.fillText('Borrow a headset · find 3 parts in the sky', w / 2, 150);
      ctx.fillText('Press E', w / 2, 205);
    });
    const face = mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: kioskScreen }), 0, 0.75, 0.41);
    kioskGroup.add(face);
    kioskGroup.add(noRaycast(mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material('#e7f5ff', { transparent: true, opacity: 0.25, roughness: 0.05 }), 0, 1.1, 0)));
    const display = headsetModel();
    display.position.set(0, 1.28, 0);
    display.scale.setScalar(0.9);
    kioskGroup.add(display);
    animate(display, (time) => { display.rotation.y = time * 0.8; });
    const kioskTitle = textSprite('The Spatial Quest · Headset kiosk', { width: 5, background: 'rgba(29, 29, 31, 0.8)' });
    kioskTitle.position.y = 2.6;
    kioskGroup.add(kioskTitle);
    kioskGroup.userData.prompt = 'Press E to put on / take off the spatial headset';
    kioskGroup.userData.onInteract = (hooks) => {
      lastHooks = hooks;
      setWorn(!quest.worn);
      if (window.Sound) Sound.play(quest.worn ? 'teleport' : 'click');
      if (!quest.worn) return 'Headset returned. The floating platforms fade away.';
      const got = collectedParts().length;
      return hasBadge()
        ? 'Spatial mode on. You already own the Vision Headset badge: enjoy the sky circuit.'
        : `Spatial mode on: platforms and portals appeared over the park. Jump from platform to platform (Space) and collect the 3 headset parts (${got}/3).`;
    };
    group.add(interactive(kioskGroup, 'action', 'Headset kiosk'));

    // The hidden sky circuit: 3 segments linked by portals
    const segments = [
      arc(34, 100, 10, 0.9, 0.9),
      arc(26, -30, 9, 0.8, 12),
      arc(21, -150, 8, 0.6, 22)
    ];
    const platformTransforms = [];
    const edgeTransforms = [];
    segments.forEach((points) => points.forEach((point, index) => {
      const last = index === points.length - 1;
      const s = last ? 1.5 : 1;
      platformTransforms.push({ x: point.x, y: point.top - 0.2, z: point.z, sx: s, sz: s });
      edgeTransforms.push({ x: point.x, y: point.top - 0.2, z: point.z, sx: s * 1.02, sy: 1, sz: s * 1.02 });
    }));
    const platformMaterial = new THREE.MeshStandardMaterial({ color: '#f8f9fa', transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.2, emissive: '#a5d8ff', emissiveIntensity: 0.25 });
    const platforms = instanced(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 24), platformMaterial, platformTransforms);
    const rims = instanced(new THREE.TorusGeometry(1.6, 0.05, 6, 40), glow('#74c0fc', 1.4), edgeTransforms.map((t) => ({ ...t, y: t.y + 0.2, rx: Math.PI / 2 })), { solid: false });
    group.add(platforms);
    group.add(rims);
    quest.meshes.push(platforms, rims);

    // Portals at the end of each segment + the collectible part
    const portalMaterial = new THREE.MeshBasicMaterial({ color: '#b197fc', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const portalRing = glow('#d0bfff', 1.5);
    const partModels = [
      () => { const g = new THREE.Group(); [-0.22, 0.22].forEach((x) => { const lens = mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 24), glow('#74c0fc', 1.2), x, 0, 0); g.add(lens); }); return g; },
      () => { const g = new THREE.Group(); const band = mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 24, Math.PI * 1.4), material('#868e96', { roughness: 0.8, emissive: '#ffd43b', emissiveIntensity: 0.4 })); g.add(band); return g; },
      () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.7, 0.3, 0.08), material('#111418', { metalness: 0.4, roughness: 0.05, emissive: '#b197fc', emissiveIntensity: 0.6 }))); return g; }
    ];
    const destinations = [
      { ...segments[1][0], top: segments[1][0].top },
      { ...segments[2][0], top: segments[2][0].top },
      { x: kiosk[0] + 2.5, z: kiosk[2] - 2.5, top: 0.1 }
    ];
    segments.forEach((points, index) => {
      const end = points[points.length - 1];
      // Part floating above the end platform
      const part = partModels[index]();
      part.position.set(end.x, end.top + 1.2, end.z);
      part.userData.partId = PARTS[index].id;
      noRaycast(part);
      group.add(part);
      quest.parts.push(part);
      animate(part, (time) => { part.rotation.y = time * 1.5; part.position.y = end.top + 1.2 + Math.sin(time * 2) * 0.12; });
      const partLabel = textSprite(`Headset part: ${PARTS[index].name}`, { width: 3.2, background: 'rgba(29, 29, 31, 0.75)' });
      partLabel.position.set(0, 0.9, 0);
      part.add(partLabel);
      // Portal standing on the far edge of the end platform
      const tangent = new THREE.Vector3(Math.sin(end.angle), 0, -Math.cos(end.angle));
      const portal = new THREE.Group();
      portal.position.set(end.x + tangent.x * 1.4, end.top + 1.3, end.z + tangent.z * 1.4);
      portal.rotation.y = Math.atan2(tangent.x, tangent.z);
      portal.add(mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 40), portalRing));
      const disc = mesh(new THREE.CircleGeometry(1.05, 40), portalMaterial);
      portal.add(disc);
      noRaycast(portal);
      group.add(portal);
      quest.meshes.push(portal);
      quest.portals.push({ portal, destination: destinations[index], final: index === segments.length - 1 });
      animate(disc, (time) => { disc.rotation.z = time; portalMaterial.opacity = 0.35 + Math.sin(time * 3) * 0.12; });
    });
    // Start marker next to the first platform
    const start = segments[0][0];
    const startSign = textSprite('Spatial Quest start: jump!', { width: 3.6, background: 'rgba(76, 110, 245, 0.85)' });
    startSign.position.set(start.x, start.top + 2.2, start.z);
    group.add(startSign);
    quest.meshes.push(startSign);

    setWorn(false);

    // Per-frame checks: parts pickup and portals (only while the headset is on)
    let portalCooldown = 0;
    animate(kioskGroup, () => {
      syncHeadset();
      if (!quest.worn) return;
      const local = avatarLocal(group);
      if (!local) return;
      quest.parts.forEach((part) => {
        if (!part.visible) return;
        const p = part.position;
        if (Math.hypot(p.x - local.x, p.z - local.z) < 1.6 && Math.abs(p.y - 1 - local.y) < 2) {
          part.visible = false;
          const got = collectedParts();
          if (!got.includes(part.userData.partId)) got.push(part.userData.partId);
          writeJson(PARTS_KEY, got);
          if (window.Sound) Sound.play('coin');
          const name = PARTS.find((entry) => entry.id === part.userData.partId).name;
          if (got.length >= PARTS.length && !hasBadge()) {
            grantBadge();
            appendSystemMessage(`Collected: ${name}. All 3 parts found! You earned the permanent Vision Headset badge (in-game wearable).`);
            if (lastHooks) { lastHooks.emote('cheer'); lastHooks.broadcast('completed the Spatial Quest and earned the Vision Headset badge'); }
          } else {
            appendSystemMessage(`Collected: ${name} (${got.length}/3).`);
          }
          updateHud();
          syncHeadset();
        }
      });
      if (performance.now() < portalCooldown) return;
      quest.portals.forEach(({ portal, destination, final }) => {
        const p = portal.position;
        if (Math.hypot(p.x - local.x, p.z - local.z) < 1.2 && Math.abs(p.y - 1.3 - local.y) < 1.5) {
          portalCooldown = performance.now() + 1500;
          group.getWorldPosition(rootPosition);
          const target = new THREE.Vector3(destination.x, destination.top + 0.1, destination.z).add(rootPosition);
          if (lastHooks) lastHooks.setAvatarPosition(target);
          else { avatar.position.copy(target); avatar.velocityY = 0; }
          if (window.Sound) Sound.play('teleport');
          appendSystemMessage(final ? 'Portal: back to the park. Thanks for playing the Spatial Quest!' : 'Portal: next section of the sky circuit.');
        }
      });
    });
    // Leaving the district takes the headset off (checked even when far away)
    setInterval(() => {
      if (!quest.worn || typeof avatar === 'undefined') return;
      const local = avatarLocal(group);
      if (local && Math.hypot(local.x, local.z) > 140) { setWorn(false); appendSystemMessage('You left The Orchard Nexus: the spatial headset went back to the kiosk.'); }
    }, 1000);
  }

  PropKit.registerBuilder(/^orchard_park$/, 'orchardPark', park);
  PropKit.registerBuilder(/^orchard_sign$/, 'orchardSign', entranceSign);
  PropKit.registerBuilder(/^orchard_grove$/, 'orchardGrove', grove);
  PropKit.registerBuilder(/^orchard_fountain$/, 'orchardFountain', fountain);
  PropKit.registerBuilder(/^orchard_glass_cube$/, 'orchardGlassCube', glassCube);
  PropKit.registerBuilder(/^orchard_smart_room$/, 'orchardSmartRoom', smartRoom);
  PropKit.registerBuilder(/^orchard_genius_bar$/, 'orchardGeniusBar', geniusBar);
  PropKit.registerBuilder(/^orchard_spatial_quest$/, 'orchardSpatialQuest', spatialQuest);

  return { currentSeason, openGenius, closeGenius, setWorn, quest };
})();
