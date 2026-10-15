// ============================================================================
// METABLOCK ESTATES: A HYPERMODERN HIGH-END NEIGHBORHOOD
// ============================================================================
// A quiet luxury suburb (not a tech fair): one central street with sidewalks,
// street trees and slim LED lamps, minimalist mansions in white concrete, wood
// slats and big glass with cantilevered upper floors, floating infinity pools
// (glass-edged slabs on pillars with animated rippling water), hedges, lawns
// and garden lights. Realistic proportions: rooms 4-6 m, ceilings 3.2 m,
// doors 2.6 m.
// - mb_streetscape: lawn, street, sidewalks, central plaza, trees, lamps,
//   entrance monoliths and the residents' garden.
// - mb_mansion (3 variants): "test drive" demo houses, enterable and
//   furnished. E on the faucet (running water), the bed (lie down), the sound
//   system (internet radio: SomaFM Groove Salad), the wall touch panel (cycles
//   the lighting scene by changing the lamp materials, no real lights). One
//   mansion has a glass hydraulic elevator to its rooftop terrace.
// - mb_totem: the "package" of each mansion (triangles, textures, price in
//   in-game MVC). E downloads a free sample: a valid glTF 2.0 file generated in
//   JS from simple boxes plus a README about Decentraland SDK limits.
// - mb_garage: "The Customization Garage", a clean construction site with a
//   model house; the glowing floor button opens a panel that swaps the facade,
//   floor and roof materials live.
// - mb_gate: the Residents Lane gate. It slides open only for players holding
//   the in-game "MetaBlock Resident" pass, plus a security camera kiosk with a
//   top view of the street and a local "who entered" log.
// - mb_hub: the Brokers Hub office building with portfolio murals of fictional
//   builder studios and a reception desk that grants the Resident pass.
// No real money, wallets, NFTs or smart contracts: everything is in-game.
const MetaBlock = (() => {
  const { mesh, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, labelTexture } = PropKit.kit;
  const DISTRICT_KEY = 'metablock';
  const BADGE = 'metablock-resident';
  const RADIO_URL = 'https://ice1.somafm.com/groovesalad-128-mp3';
  const FY = 0.15; // finished floor height of the mansions
  const CEILING = 3.2; // clear ceiling height
  const CY = FY + CEILING;

  // --------------------------------------------------------------------------
  // Small deterministic random, textures and materials (own caches: the kit's
  // material() serializes its options, which is not meant for texture maps)
  // --------------------------------------------------------------------------
  function seeded(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function tex(key, size, draw, height = size) {
    const texture = canvasTexture(`mb|${key}`, size, height, draw);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function speckle(ctx, w, h, count, colors, maxSize, seed) {
    const random = seeded(seed);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(random() * colors.length)];
      const s = 1 + random() * maxSize;
      ctx.fillRect(random() * w, random() * h, s, s);
    }
  }

  const TEX = {
    concrete: () => tex('concrete', 512, (ctx, w, h) => {
      ctx.fillStyle = '#bdbab3'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 9000, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.07)', 'rgba(120,110,100,0.08)'], 3, 11);
      // Formwork panels with seams and tie holes
      ctx.strokeStyle = 'rgba(70,68,64,0.35)'; ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += w / 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += h / 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(60,58,55,0.55)';
      [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * w, y * h, 5, 0, Math.PI * 2); ctx.fill(); });
    }),
    whiteConcrete: () => tex('whiteConcrete', 512, (ctx, w, h) => {
      ctx.fillStyle = '#ecebe7'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 7000, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.4)', 'rgba(150,140,130,0.05)'], 3, 23);
      ctx.strokeStyle = 'rgba(120,115,110,0.22)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    }),
    plaster: () => tex('plaster', 256, (ctx, w, h) => {
      ctx.fillStyle = '#f4f2ee'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 5000, ['rgba(0,0,0,0.03)', 'rgba(255,255,255,0.6)'], 2, 37);
    }),
    wood: () => tex('woodSlats', 256, (ctx, w, h) => {
      const slats = 8;
      const random = seeded(51);
      for (let i = 0; i < slats; i++) {
        const shade = 0.85 + random() * 0.25;
        ctx.fillStyle = `rgb(${Math.round(160 * shade)}, ${Math.round(108 * shade)}, ${Math.round(66 * shade)})`;
        ctx.fillRect(i * (w / slats), 0, w / slats, h);
        ctx.strokeStyle = 'rgba(80,45,20,0.25)';
        for (let g = 0; g < 6; g++) { const x = i * (w / slats) + 3 + random() * (w / slats - 6); ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 3, h / 3, x - 3, h * 0.66, x, h); ctx.stroke(); }
        ctx.fillStyle = 'rgba(20,12,6,0.85)';
        ctx.fillRect(i * (w / slats) + w / slats - 5, 0, 5, h); // shadow gap between slats
      }
    }),
    metal: () => tex('blackMetal', 256, (ctx, w, h) => {
      ctx.fillStyle = '#1d1f22'; ctx.fillRect(0, 0, w, h);
      const random = seeded(61);
      for (let y = 0; y < h; y++) { ctx.fillStyle = `rgba(255,255,255,${random() * 0.04})`; ctx.fillRect(0, y, w, 1); }
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let x = 0; x < w; x += w / 4) ctx.fillRect(x, 0, 3, h); // standing seams
    }),
    marble: () => tex('marble', 512, (ctx, w, h) => {
      ctx.fillStyle = '#f3f1ee'; ctx.fillRect(0, 0, w, h);
      const random = seeded(71);
      for (let v = 0; v < 14; v++) {
        ctx.strokeStyle = `rgba(110,110,120,${0.08 + random() * 0.22})`; ctx.lineWidth = 0.6 + random() * 2;
        let x = random() * w; let y = 0;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < h) { x += (random() - 0.5) * 40; y += 10 + random() * 30; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
    }),
    porcelain: () => tex('porcelain', 256, (ctx, w, h) => {
      ctx.fillStyle = '#c9c7c3'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3000, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.12)'], 2, 81);
      ctx.strokeStyle = 'rgba(90,88,84,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }),
    oak: () => tex('oak', 512, (ctx, w, h) => {
      const planks = 6;
      const random = seeded(91);
      for (let i = 0; i < planks; i++) {
        for (let j = 0; j < 2; j++) {
          const shade = 0.88 + random() * 0.2;
          const offset = (i % 2) * h / 4;
          ctx.fillStyle = `rgb(${Math.round(196 * shade)}, ${Math.round(152 * shade)}, ${Math.round(104 * shade)})`;
          ctx.fillRect(i * w / planks, (j * h / 2 + offset) % h, w / planks, h / 2);
          if ((j * h / 2 + offset) % h + h / 2 > h) ctx.fillRect(i * w / planks, 0, w / planks, ((j * h / 2 + offset) % h + h / 2) - h);
        }
        ctx.strokeStyle = 'rgba(90,60,30,0.18)';
        for (let g = 0; g < 8; g++) { const x = i * w / planks + random() * w / planks; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (random() - 0.5) * 6, h); ctx.stroke(); }
        ctx.fillStyle = 'rgba(60,40,20,0.4)'; ctx.fillRect(i * w / planks, 0, 2, h);
      }
    }),
    grass: () => tex('lawn', 256, (ctx, w, h) => {
      ctx.fillStyle = '#5f8f3a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, w / 2, h); // mowing stripes
      speckle(ctx, w, h, 9000, ['#6fa245', '#51802f', '#7cae4f', '#4a7a2a'], 2, 101);
    }),
    asphalt: () => tex('asphalt', 256, (ctx, w, h) => {
      ctx.fillStyle = '#2b2d30'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 6000, ['#3a3c40', '#232427', '#45474b'], 2, 111);
      ctx.fillStyle = 'rgba(235,235,230,0.85)';
      ctx.fillRect(4, 0, 5, h); ctx.fillRect(w - 9, 0, 5, h); // edge lines
      ctx.fillRect(w / 2 - 2, 0, 4, h * 0.45); // dashed center line
    }),
    pavers: () => tex('pavers', 256, (ctx, w, h) => {
      ctx.fillStyle = '#d9d5cd'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3000, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.2)'], 2, 121);
      ctx.strokeStyle = 'rgba(120,115,105,0.5)'; ctx.lineWidth = 2;
      for (let y = 0; y <= h; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let r = 0; r < 4; r++) for (let x = 0; x <= w; x += w / 2) { const xo = x + (r % 2) * w / 4; ctx.beginPath(); ctx.moveTo(xo, r * h / 4); ctx.lineTo(xo, (r + 1) * h / 4); ctx.stroke(); }
    }),
    hedge: () => tex('hedge', 256, (ctx, w, h) => {
      ctx.fillStyle = '#2f5a24'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 7000, ['#3f7330', '#264a1c', '#4d8a39', '#1d3a16'], 4, 131);
    }),
    sedum: () => tex('sedum', 256, (ctx, w, h) => {
      ctx.fillStyle = '#6a8a3a'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 8000, ['#9bb84a', '#c4683a', '#4f7a2f', '#d8c25a', '#7aa24a'], 4, 141);
    }),
    gravel: () => tex('gravel', 256, (ctx, w, h) => {
      ctx.fillStyle = '#9a968f'; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 9000, ['#b8b4ac', '#7d7a74', '#cfcbc3', '#8a8780'], 3, 151);
    }),
    // Glass ribbon of the upper floors: dark reflective glass, mullions and a
    // hint of warm interior light
    ribbon: () => tex('ribbon', 256, (ctx, w, h) => {
      ctx.fillStyle = '#e8e6e1'; ctx.fillRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.85);
      gradient.addColorStop(0, '#5b6d80'); gradient.addColorStop(0.5, '#2a3644'); gradient.addColorStop(1, '#1b2129');
      ctx.fillStyle = gradient; ctx.fillRect(0, h * 0.1, w, h * 0.75);
      ctx.fillStyle = 'rgba(255,214,150,0.18)'; ctx.fillRect(w * 0.15, h * 0.55, w * 0.5, h * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.1); ctx.lineTo(w * 0.35, h * 0.1); ctx.lineTo(w * 0.1, h * 0.6); ctx.fill();
      ctx.fillStyle = '#16181b'; ctx.fillRect(0, h * 0.1, 4, h * 0.75); ctx.fillRect(w - 4, h * 0.1, 4, h * 0.75);
    }),
    office: () => tex('officeGlass', 256, (ctx, w, h) => {
      ctx.fillStyle = '#26323f'; ctx.fillRect(0, 0, w, h);
      const random = seeded(171);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = random() > 0.4 ? 'rgba(255,236,200,0.35)' : 'rgba(140,170,200,0.25)';
        ctx.fillRect(i * w / 4 + 4, j * h / 2 + 10, w / 4 - 8, h / 2 - 30);
      }
      ctx.fillStyle = '#dcdad5'; for (let j = 0; j < 2; j++) ctx.fillRect(0, j * h / 2 + h / 2 - 16, w, 16);
      ctx.fillStyle = '#111'; for (let i = 0; i <= 4; i++) ctx.fillRect(i * w / 4 - 2, 0, 4, h);
    })
  };

  // Water normal map: a sum of tileable sine waves (integer frequencies), the
  // texture offset is animated so the surface ripples
  function waterNormal() {
    return tex('waterNormal', 256, (ctx, w, h) => {
      const image = ctx.createImageData(w, h);
      const waves = [[3, 1, 0.9, 0], [1, 4, 0.7, 1.3], [5, -2, 0.4, 2.1], [-2, 6, 0.3, 0.4], [7, 3, 0.2, 3.3]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let dx = 0; let dy = 0;
        waves.forEach(([kx, ky, a, p]) => {
          const phase = 2 * Math.PI * (kx * x / w + ky * y / h) + p;
          const c = Math.cos(phase) * a;
          dx += c * kx; dy += c * ky;
        });
        const nx = -dx * 0.05; const ny = -dy * 0.05;
        const len = Math.hypot(nx, ny, 1);
        const i = (y * w + x) * 4;
        image.data[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
        image.data[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
        image.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    });
  }

  const matCache = new Map();
  function M(key, factory) {
    if (!matCache.has(key)) matCache.set(key, factory());
    return matCache.get(key);
  }
  const std = (key, options) => M(key, () => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.02, ...options }));
  const MAT = {
    concrete: () => std('concrete', { map: TEX.concrete(), roughness: 0.85 }),
    whiteConcrete: () => std('whiteConcrete', { map: TEX.whiteConcrete(), roughness: 0.8 }),
    plaster: () => std('plaster', { map: TEX.plaster(), roughness: 0.9 }),
    wood: () => std('wood', { map: TEX.wood(), roughness: 0.75 }),
    metal: () => std('metal', { map: TEX.metal(), roughness: 0.45, metalness: 0.6 }),
    marble: () => std('marble', { map: TEX.marble(), roughness: 0.25 }),
    porcelain: () => std('porcelain', { map: TEX.porcelain(), roughness: 0.35 }),
    oak: () => std('oak', { map: TEX.oak(), roughness: 0.6 }),
    grass: () => std('grass', { map: TEX.grass(), roughness: 1 }),
    asphalt: () => std('asphalt', { map: TEX.asphalt(), roughness: 0.95 }),
    pavers: () => std('pavers', { map: TEX.pavers(), roughness: 0.9 }),
    hedge: () => std('hedge', { map: TEX.hedge(), roughness: 1 }),
    sedum: () => std('sedum', { map: TEX.sedum(), roughness: 1 }),
    gravel: () => std('gravel', { map: TEX.gravel(), roughness: 1 }),
    ribbon: () => std('ribbon', { map: TEX.ribbon(), roughness: 0.2, metalness: 0.3 }),
    office: () => std('office', { map: TEX.office(), roughness: 0.2, metalness: 0.4 }),
    // Glass walls: opacity >= 0.2 so the avatar bumps into them
    glass: () => std('glass', { color: '#a9c7d6', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.6, depthWrite: false }),
    poolGlass: () => std('poolGlass', { color: '#cfeef7', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.4, depthWrite: false }),
    water: () => std('water', { color: '#2fa9c9', transparent: true, opacity: 0.88, roughness: 0.08, metalness: 0.15, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.8, 0.8) }),
    dark: () => std('dark', { color: '#222428', roughness: 0.5, metalness: 0.3 }),
    steel: () => std('steel', { color: '#b8bcc2', roughness: 0.3, metalness: 0.85 }),
    fabric: (color) => std(`fabric${color}`, { color, roughness: 1 }),
    paint: (color) => std(`paint${color}`, { color, roughness: 0.6 }),
    screen: () => std('screenBlack', { color: '#0b0d10', roughness: 0.15, metalness: 0.5 }),
    glow: (color, intensity = 1.2) => std(`glow${color}${intensity}`, { color, emissive: color, emissiveIntensity: intensity })
  };

  // Architectural box: crisp edges and UVs scaled to real meters (tile size),
  // so one material per texture is enough for walls of any size
  const archCache = new Map();
  function archGeometry(w, h, d, tile) {
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${tile}`;
    if (archCache.has(key)) return archCache.get(key);
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let face = 0; face < 6; face++) {
      for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * dims[face][0] / tile, uv.getY(i) * dims[face][1] / tile);
    }
    uv.needsUpdate = true;
    archCache.set(key, geometry);
    return geometry;
  }
  function slab(w, h, d, slabMaterial, x, y, z, tile = 3) {
    return mesh(archGeometry(w, h, d, tile), slabMaterial, x, y, z);
  }
  const noRaycast = (object) => { object.raycast = () => {}; return object; };

  // --------------------------------------------------------------------------
  // Shared state: badge, player name, district center
  // --------------------------------------------------------------------------
  function readBadges() {
    try {
      const raw = JSON.parse(localStorage.getItem('multiverse-badges') || '[]');
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return Object.keys(raw).filter((key) => raw[key]);
      return [];
    } catch (error) { return []; }
  }
  // In-game pass (replaces NFT token-gating): a badge stored locally
  function hasPass() {
    try { return (localStorage.getItem('multiverse-badges') || '').includes(BADGE); } catch (error) { return false; }
  }
  function grantPass() {
    try {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem('multiverse-badges') || '[]'); } catch (error) { raw = []; }
      if (raw && !Array.isArray(raw) && typeof raw === 'object') { raw[BADGE] = true; localStorage.setItem('multiverse-badges', JSON.stringify(raw)); return; }
      const badges = readBadges();
      if (!badges.includes(BADGE)) badges.push(BADGE);
      localStorage.setItem('multiverse-badges', JSON.stringify(badges));
    } catch (error) { /* storage blocked: the pass lasts for this visit only */ }
  }
  function playerName() {
    const tag = document.getElementById('hud-devtag');
    return (tag && tag.textContent.trim()) || 'Guest';
  }
  const avatarRef = () => (typeof avatar !== 'undefined' ? avatar : null);
  function districtCenter() {
    const district = typeof City !== 'undefined' && City.districts ? City.districts.find((d) => d.world.key === DISTRICT_KEY) : null;
    return district ? district.layout.center : new THREE.Vector3();
  }
  function moveAvatarWithCamera(target) {
    const me = avatarRef();
    if (!me) return;
    const delta = target.clone().sub(me.position);
    me.position.copy(target);
    me.velocityY = 0;
    if (typeof camera !== 'undefined') camera.position.add(delta);
    if (typeof controls !== 'undefined' && controls.target) controls.target.add(delta);
  }

  // --------------------------------------------------------------------------
  // DOM panels (garage materials and security camera), CSS injected once
  // --------------------------------------------------------------------------
  let openPanel = null;
  function injectStyle() {
    if (document.getElementById('mb-style')) return;
    const style = document.createElement('style');
    style.id = 'mb-style';
    style.textContent = `
      .mb-panel { position: fixed; top: 50%; right: 24px; transform: translateY(-50%); width: 380px; max-width: calc(100vw - 32px); max-height: 86vh; overflow: auto;
        background: rgba(18, 20, 24, 0.92); color: #f1f3f5; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 18px 20px; z-index: 60;
        font: 14px/1.45 "Segoe UI", Arial, sans-serif; box-shadow: 0 18px 50px rgba(0,0,0,0.45); backdrop-filter: blur(6px); }
      .mb-panel h2 { margin: 0 0 2px; font-size: 18px; letter-spacing: 0.04em; }
      .mb-panel .mb-sub { margin: 0 0 14px; color: #adb5bd; font-size: 12px; }
      .mb-panel h3 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #63e6be; }
      .mb-options { display: flex; flex-wrap: wrap; gap: 6px; }
      .mb-options button, .mb-close { cursor: pointer; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: #f1f3f5;
        border-radius: 8px; padding: 7px 10px; font: 13px "Segoe UI", Arial, sans-serif; display: inline-flex; align-items: center; gap: 7px; }
      .mb-options button:hover, .mb-close:hover { background: rgba(255,255,255,0.14); }
      .mb-options button.active { border-color: #63e6be; background: rgba(99,230,190,0.18); }
      .mb-swatch { width: 14px; height: 14px; border-radius: 3px; display: inline-block; border: 1px solid rgba(255,255,255,0.3); }
      .mb-close { margin-top: 16px; width: 100%; justify-content: center; }
      .mb-panel canvas { width: 100%; border-radius: 8px; background: #0c0e10; display: block; }
      .mb-log { margin: 8px 0 0; padding: 0; list-style: none; max-height: 140px; overflow: auto; font: 12px Consolas, monospace; color: #ced4da; }
      .mb-log li { padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
    `;
    document.head.appendChild(style);
  }
  function showPanel(id, html, onOpen) {
    injectStyle();
    closePanel();
    const panel = document.createElement('div');
    panel.className = 'mb-panel';
    panel.id = id;
    panel.innerHTML = `${html}<button class="mb-close" type="button">Close (Esc)</button>`;
    panel.querySelector('.mb-close').addEventListener('click', closePanel);
    document.body.appendChild(panel);
    openPanel = { id, panel, onClose: null };
    if (onOpen) onOpen(panel, openPanel);
    return panel;
  }
  function closePanel() {
    if (!openPanel) return;
    if (openPanel.onClose) openPanel.onClose();
    openPanel.panel.remove();
    openPanel = null;
  }
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && openPanel) closePanel(); }, true);

  // --------------------------------------------------------------------------
  // Streetscape: lawn, street, sidewalks, plaza, trees, lamps, hedges
  // --------------------------------------------------------------------------
  function instanced(geometry, instanceMaterial, transforms) {
    const result = new THREE.InstancedMesh(geometry, instanceMaterial, transforms.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    transforms.forEach(([x, y, z, sx, sy, sz, ry = 0], index) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(sx, sy, sz));
      result.setMatrixAt(index, matrix);
    });
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  }

  // Trees as instanced trunks and two-layer crowns (one draw call each)
  function trees(group, spots, seed = 3) {
    const random = seeded(seed);
    const trunks = [];
    const crowns = [];
    spots.forEach(([x, z, size = 1]) => {
      const s = size * (0.85 + random() * 0.3);
      trunks.push([x, 0, z, s, s * 3.2, s]);
      crowns.push([x, 3.6 * s, z, 1.9 * s, 1.6 * s, 1.9 * s, random() * 6]);
      crowns.push([x + (random() - 0.5) * 0.6 * s, 4.9 * s, z + (random() - 0.5) * 0.6 * s, 1.4 * s, 1.3 * s, 1.4 * s, random() * 6]);
    });
    group.add(instanced(new THREE.CylinderGeometry(0.11, 0.17, 1, 7).translate(0, 0.5, 0), M('bark', () => new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 })), trunks));
    const crownMesh = instanced(new THREE.IcosahedronGeometry(1, 1), M('crown', () => new THREE.MeshStandardMaterial({ color: '#4f7f35', roughness: 0.95, flatShading: true })), crowns);
    const color = new THREE.Color();
    crowns.forEach((_, index) => crownMesh.setColorAt(index, color.setHSL(0.25 + random() * 0.06, 0.45, 0.3 + random() * 0.1)));
    group.add(crownMesh);
  }

  function hedge(group, w, h, d, x, z) {
    group.add(slab(w, h, d, MAT.hedge(), x, h / 2, z, 2));
  }

  function streetscape(group) {
    // Lawn base (top at y = 0) and the central street with sidewalks
    group.add(slab(220, 0.3, 160, MAT.grass(), 0, -0.15, 0, 6));
    [[-50, 60], [50, 60]].forEach(([zc, length]) => {
      group.add(slab(10, 0.04, length, MAT.asphalt(), 0, 0.02, zc, 10));
      [-7, 7].forEach((x) => {
        group.add(slab(4, 0.15, length, MAT.pavers(), x, 0.075, zc, 2));
        group.add(slab(0.2, 0.17, length, MAT.whiteConcrete(), x - Math.sign(x) * 1.95, 0.085, zc, 2)); // granite curb
      });
    });
    // Central plaza around the Brokers Hub, path to the garage
    group.add(slab(54, 0.06, 40, MAT.pavers(), 0, 0.03, 0, 3));
    group.add(slab(14, 0.05, 5, MAT.pavers(), -33, 0.025, 0, 2.5));
    // Entrance monoliths with the district name
    const nameTexture = labelTexture('METABLOCK ESTATES', { bg: '#1d1f22', fg: '#f1efe9', width: 1024, height: 160, font: '300 74px "Segoe UI", Arial, sans-serif' });
    [-13, 13].forEach((x) => {
      group.add(slab(1.2, 3.6, 7, MAT.concrete(), x, 1.8, -74, 3));
      const plate = mesh(new THREE.PlaneGeometry(6.4, 1), new THREE.MeshBasicMaterial({ map: nameTexture }), x - Math.sign(x) * 0.61, 2.4, -74);
      plate.rotation.y = -Math.sign(x) * Math.PI / 2;
      group.add(plate);
      group.add(noRaycast(slab(0.05, 0.06, 6.6, MAT.glow('#ffe8c2', 1.6), x - Math.sign(x) * 0.62, 0.5, -74, 1)));
    });
    // Street trees in tree pits along both sidewalks (skipping gates, paths, totems)
    const skip = { '7': [-53, -50, 51, 54], '-7': [-47, -50] };
    const spots = [];
    [-7.4, 7.4].forEach((x) => {
      for (let z = -70; z <= 76; z += 9) {
        if (Math.abs(z) < 22 || Math.abs(z - 26) < 5) continue;
        if ((skip[x > 0 ? '7' : '-7'] || []).some((zz) => Math.abs(z - zz) < 3)) continue;
        spots.push([x, z, 1.1]);
      }
    });
    trees(group, spots, 7);
    // Slim LED street lamps: pole, arm and a glowing bar (no real lights)
    const lamps = [];
    [-8.6, 8.6].forEach((x) => { for (let z = -66; z <= 72; z += 18) if (Math.abs(z) > 22 && Math.abs(z - 26) > 4) lamps.push([x, 0, z, 1, 1, 1, x > 0 ? 0 : Math.PI]); });
    group.add(instanced(new THREE.BoxGeometry(0.14, 6, 0.14).translate(0, 3, 0), MAT.metal(), lamps));
    group.add(instanced(new THREE.BoxGeometry(1.6, 0.12, 0.2).translate(-0.75, 6, 0), MAT.metal(), lamps));
    group.add(instanced(new THREE.BoxGeometry(1.2, 0.04, 0.14).translate(-0.9, 5.93, 0), MAT.glow('#fff1d6', 2), lamps));
    // Residents' garden (north-west, behind the gate) and green buffers
    const gardenTrees = [];
    const random = seeded(19);
    for (let i = 0; i < 18; i++) gardenTrees.push([-30 - random() * 70, 34 + random() * 40, 1 + random() * 0.5]);
    for (let i = 0; i < 10; i++) gardenTrees.push([35 + random() * 65, -12 + random() * 24, 1 + random() * 0.5]);
    for (let i = 0; i < 6; i++) gardenTrees.push([60 + random() * 40, -75 + random() * 50, 1 + random() * 0.4]);
    for (let i = 0; i < 6; i++) gardenTrees.push([-60 - random() * 40, -75 + random() * 50, 1 + random() * 0.4]);
    trees(group, gardenTrees, 29);
    // Reflecting pool and a pergola in the residents' garden
    group.add(slab(16, 0.35, 8, MAT.whiteConcrete(), -50, 0.175, 52, 3));
    group.add(slab(15.2, 0.05, 7.2, MAT.water(), -50, 0.33, 52, 4));
    [-56, -44].forEach((x) => [48.5, 55.5].forEach((z) => group.add(slab(0.25, 3, 0.25, MAT.metal(), x - 0, 1.5, z - 0, 1))));
    group.add(slab(13, 0.15, 7.6, MAT.wood(), -50, 3.07, 52, 2));
    // Garden bollard lights along the sidewalks
    const bollards = [];
    [-9.6, 9.6].forEach((x) => { for (let z = -72; z <= 78; z += 6) if (Math.abs(z) > 21 && Math.abs(z - 26) > 3 && !(skip[x > 0 ? '7' : '-7'] || []).some((zz) => Math.abs(z - zz) < 2.5)) bollards.push([x, 0, z, 1, 1, 1]); });
    group.add(instanced(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8).translate(0, 0.35, 0), MAT.dark(), bollards));
    group.add(instanced(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 8).translate(0, 0.62, 0), MAT.glow('#ffe3b0', 1.8), bollards));
    // Ripples on the shared water material
    const water = MAT.water();
    animate(group, (time) => {
      water.normalMap.offset.set(time * 0.03, time * 0.017);
      water.normalScale.set(0.7 + Math.sin(time * 0.8) * 0.15, 0.7 + Math.cos(time * 0.6) * 0.15);
    });
  }

  // --------------------------------------------------------------------------
  // Mansions
  // --------------------------------------------------------------------------
  const mansions = new Map(); // id -> { group, name, parts, stats }
  const radio = { audio: null, owner: null, interval: null };

  const VARIANTS = {
    cantilever: {
      name: 'Casa Cantilever', facade: 'whiteConcrete', accent: 'wood', floor: 'porcelain', sofa: '#d8d2c8', bed: '#c9b8a6',
      upper: { w: 20, d: 10, x: 4.5, z: -0.5, side: 'whiteConcrete' }, poolSide: -1, price: 4800
    },
    slat: {
      name: 'Slat House', facade: 'wood', accent: 'metal', floor: 'oak', sofa: '#4a5560', bed: '#8a9aa6',
      upper: { w: 9, d: 19, x: -4.5, z: 2.5, side: 'wood' }, poolSide: 1, price: 5200
    },
    sky: {
      name: 'Sky Terrace House', facade: 'plaster', accent: 'metal', floor: 'marble', sofa: '#b9a48a', bed: '#e8e2d8',
      upper: { w: 18.6, d: 13, x: 0, z: -3, side: 'plaster' }, poolSide: -1, price: 6900, elevator: true
    }
  };

  // Lighting scenes of the touch panel: they recolor the house lamp materials
  const SCENES = [
    { name: 'Warm', lamp: '#ffd49a', strip: '#ffb35c', intensity: 1.5, screen: '#ffb35c' },
    { name: 'Cool', lamp: '#e3f2ff', strip: '#9fd3ff', intensity: 1.5, screen: '#9fd3ff' },
    { name: 'Night', lamp: '#3b4d9a', strip: '#26307a', intensity: 0.45, screen: '#4c5bd4' },
    { name: 'Party', party: true, intensity: 1.9, screen: '#ff4fd8' }
  ];

  function mansion(group, { data }) {
    const variant = VARIANTS[data.variant] || VARIANTS.cantilever;
    const id = data.id || data.variant || 'house';
    const W = 18; const D = 13; const hw = W / 2; const hd = D / 2;
    const parts = [];
    // Adds a mesh and records a simplified box for the glTF sample package
    const part = (name, w, h, d, partMaterial, x, y, z, gltfMaterial, tile) => {
      const result = slab(w, h, d, partMaterial, x, y, z, tile);
      group.add(result);
      if (gltfMaterial) parts.push({ name, w, h, d, x, y, z, material: gltfMaterial });
      return result;
    };
    const facade = MAT[variant.facade]();
    const accent = MAT[variant.accent]();
    const floorMaterial = MAT[variant.floor]();
    const plaster = MAT.plaster();
    const glass = MAT.glass();
    const metal = MAT.metal();
    // House lamp materials (own instances: the touch panel recolors them)
    const lampMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffd49a', emissiveIntensity: 1.5, roughness: 0.4 });
    const stripMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffb35c', emissiveIntensity: 1.5, roughness: 0.4 });
    const screenMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffb35c', emissiveIntensity: 1.2 });

    // Plinth, ground floor slab and roof slab
    part('Terrace plinth', W + 6, 0.12, D + 4, MAT.whiteConcrete(), 0, 0.06, 1, 'concrete', 3);
    part('Ground floor', W - 0.2, 0.06, D - 0.2, floorMaterial, 0, FY - 0.03 + 0.001, 0, 'floor', 1.2);
    part('Roof slab', W + 0.8, 0.35, D + 0.8, MAT.whiteConcrete(), 0, CY + 0.175, 0, 'concrete', 3);
    // Exterior walls: solid back and west side, glass east side and front
    const wallY = FY + CEILING / 2;
    part('Back wall', W, CEILING, 0.3, facade, 0, wallY, -hd + 0.15, variant.facade === 'wood' ? 'wood' : 'concrete', 3);
    part('Side wall', 0.3, CEILING, D - 0.3, facade, -hw + 0.15, wallY, 0.15, variant.facade === 'wood' ? 'wood' : 'concrete', 3);
    part('Side glass', 0.08, CEILING, D - 0.6, glass, hw - 0.1, wallY, 0, 'glass');
    // Front: glass curtain wall with a 2.6 m wide, 2.6 m high door opening
    const doorX = -3;
    part('Front glass left', 4.7, CEILING, 0.08, glass, (-hw + doorX - 1.3) / 2, wallY, hd - 0.1, 'glass');
    part('Front glass right', hw - (doorX + 1.3), CEILING, 0.08, glass, (hw + doorX + 1.3) / 2, wallY, hd - 0.1, 'glass');
    part('Transom', 2.6, CEILING - 2.6, 0.08, glass, doorX, FY + 2.6 + (CEILING - 2.6) / 2, hd - 0.1);
    // Black metal mullions and door frame
    [-hw + 0.1, -6.5, doorX - 1.35, doorX + 1.35, 0.5, 3.5, 6.5, hw - 0.1].forEach((x) => group.add(slab(0.08, CEILING, 0.14, metal, x, wallY, hd - 0.1, 1)));
    group.add(slab(2.8, 0.08, 0.16, metal, doorX, FY + 2.6, hd - 0.1, 1));
    [-3, 0, 3].forEach((z) => group.add(slab(0.14, CEILING, 0.08, metal, hw - 0.1, wallY, z, 1)));
    // Sliding door leaf, parked open behind the left glass
    group.add(slab(1.3, 2.55, 0.05, accent, doorX - 1.3 - 0.66, FY + 1.28, hd - 0.2, 1));
    // Interior partitions (bedroom): x = 0 wall and z = 0 wall with a door gap
    part('Partition', 0.15, CEILING, 6.35, plaster, 0, wallY, -3.175, 'plaster', 3);
    part('Partition 2', 6.2, CEILING, 0.15, plaster, 5.8, wallY, 0, 'plaster', 3);
    group.add(slab(2.62, CEILING - 2.6, 0.15, plaster, 1.39, FY + 2.6 + (CEILING - 2.6) / 2, 0, 3));
    // Accent cladding band on the front fascia
    part('Fascia', W + 0.85, 0.36, 0.06, accent, 0, CY + 0.175, hd + 0.43, variant.accent === 'wood' ? 'wood' : 'metal', 2);

    // Upper floor: a cantilevered volume with a glass ribbon, roof slab on top
    const up = variant.upper;
    const upperY0 = CY + 0.35;
    const upperH = 3.3;
    const upperMats = [MAT[up.side](), MAT[up.side](), MAT.whiteConcrete(), MAT.whiteConcrete(), MAT.ribbon(), MAT.ribbon()];
    const upper = mesh(archGeometry(up.w, upperH, up.d, upperH), upperMats, up.x, upperY0 + upperH / 2, up.z);
    group.add(upper);
    parts.push({ name: 'Upper volume', w: up.w, h: upperH, d: up.d, x: up.x, y: upperY0 + upperH / 2, z: up.z, material: 'glass' });
    const roofTop = upperY0 + upperH + 0.3;
    part('Upper roof', up.w + 0.4, 0.3, up.d + 0.4, MAT.whiteConcrete(), up.x, upperY0 + upperH + 0.15, up.z, 'concrete', 3);
    // Soffit downlights under the cantilever (house lamp material)
    for (let i = 0; i < 4; i++) {
      const lx = up.x + (i - 1.5) * (up.w / 4.5);
      const lz = up.z + up.d / 2 - 0.8;
      if (Math.abs(lx) > hw + 0.5 || lz > hd + 0.5) group.add(noRaycast(cylinder(0.12, 0.12, 0.03, lampMat, lx, upperY0 - 0.02, lz, 12)));
    }

    // ------------------------------------------------------------------ Living
    // TV wall, sound system (internet radio), L sofa, coffee table, rug
    group.add(noRaycast(slab(4.4, 0.02, 3.2, MAT.fabric('#c8c1b4'), -4.5, FY + 0.01, -3.6, 1)));
    group.add(slab(3.4, 1.9, 0.1, accent, -4.5, FY + 1.75, -hd + 0.36, 1.5));
    const tv = mesh(new THREE.BoxGeometry(2.4, 1.36, 0.06), [MAT.screen(), MAT.screen(), MAT.screen(), MAT.screen(), new THREE.MeshBasicMaterial({ map: tvTexture(variant.name) }), MAT.screen()], -4.5, FY + 1.75, -hd + 0.45);
    group.add(tv);
    const media = new THREE.Group();
    media.position.set(-4.5, FY, -hd + 0.6);
    media.add(slab(3.2, 0.42, 0.5, MAT.paint('#2a2b2e'), 0, 0.27, 0, 1));
    media.add(slab(3.24, 0.04, 0.52, accent, 0, 0.5, 0, 1));
    const eqBars = [];
    for (let i = 0; i < 8; i++) {
      const bar = noRaycast(slab(0.06, 0.2, 0.02, MAT.glow('#63e6be', 1.6), 0.9 + i * 0.09, 0.27, 0.26, 1));
      bar.visible = false;
      eqBars.push(bar);
      media.add(bar);
    }
    [-1.95, 1.95].forEach((x) => {
      media.add(slab(0.32, 1.1, 0.3, MAT.paint('#1f2023'), x, 0.55, 0.02, 1));
      [[0.1, 0.8], [0.06, 0.45]].forEach(([r, y]) => {
        const driver = noRaycast(cylinder(r, r, 0.02, MAT.dark(), x, y, 0.18, 16));
        driver.rotation.x = Math.PI / 2;
        media.add(driver);
      });
    });
    media.userData.prompt = 'Press E to play the radio (SomaFM Groove Salad)';
    media.userData.onInteract = () => toggleRadio(id, media);
    interactive(media, 'action', `${variant.name} sound system`);
    group.add(media);
    animate(media, (time) => {
      const playing = radio.owner === id && radio.audio && !radio.audio.paused;
      eqBars.forEach((bar, i) => { bar.visible = playing; if (playing) bar.scale.y = 0.3 + Math.abs(Math.sin(time * (3 + i * 0.7) + i)) * 1.6; });
    });
    const sofa = MAT.fabric(variant.sofa);
    group.add(slab(3.4, 0.42, 1.0, sofa, -4.3, FY + 0.21, -2.2, 1));
    group.add(slab(3.4, 0.75, 0.24, sofa, -4.3, FY + 0.55, -1.6, 1));
    group.add(slab(1.0, 0.42, 1.9, sofa, -6.5, FY + 0.21, -3.6, 1));
    group.add(slab(0.24, 0.62, 2.9, sofa, -7.1, FY + 0.5, -3.1, 1));
    group.add(seat(-4.6, FY + 0.45, -2.3, 'Sofa', Math.PI));
    group.add(seat(-3.2, FY + 0.45, -2.3, 'Sofa', Math.PI));
    group.add(seat(-6.5, FY + 0.45, -4.0, 'Sofa chaise', -Math.PI / 2));
    group.add(slab(1.4, 0.06, 0.8, MAT.marble(), -4.3, FY + 0.38, -3.85, 1));
    group.add(slab(1.0, 0.33, 0.5, MAT.dark(), -4.3, FY + 0.17, -3.85, 1));
    // Floor lamp and the living room ring pendant
    group.add(cylinder(0.02, 0.02, 1.6, metal, -8.2, FY + 0.8, -1.4, 6));
    group.add(noRaycast(sphere(0.2, lampMat, -8.2, FY + 1.7, -1.4, 12)));
    const ring = mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 40), lampMat, -4.3, CY - 1.0, -3.4);
    ring.rotation.x = Math.PI / 2;
    group.add(noRaycast(ring));
    group.add(noRaycast(cylinder(0.006, 0.006, 1.0, metal, -4.3, CY - 0.5, -3.4, 4)));
    // Cove LED strips along the living room ceiling
    group.add(noRaycast(slab(8.6, 0.04, 0.06, stripMat, -4.5, CY - 0.06, -hd + 0.35, 1)));
    group.add(noRaycast(slab(0.06, 0.04, 12.2, stripMat, -hw + 0.35, CY - 0.06, 0, 1)));
    group.add(noRaycast(slab(8.6, 0.04, 0.06, stripMat, -4.5, CY - 0.06, hd - 0.25, 1)));
    // Wall touch panel (lighting scenes) on the partition, living side
    const panel = new THREE.Group();
    panel.position.set(-0.11, FY + 1.35, -1.0);
    panel.add(slab(0.03, 0.26, 0.17, MAT.dark(), 0, 0, 0, 1));
    panel.add(noRaycast(slab(0.012, 0.21, 0.13, screenMat, -0.02, 0, 0, 1)));
    let sceneIndex = 0;
    const applyScene = (index) => {
      const sceneDef = SCENES[index];
      [lampMat, stripMat].forEach((lampMaterial, i) => {
        if (!sceneDef.party) lampMaterial.emissive.set(i ? sceneDef.strip : sceneDef.lamp);
        lampMaterial.emissiveIntensity = sceneDef.intensity;
      });
      screenMat.emissive.set(sceneDef.screen);
    };
    panel.userData.prompt = 'Press E to change the lighting scene';
    panel.userData.onInteract = () => {
      sceneIndex = (sceneIndex + 1) % SCENES.length;
      applyScene(sceneIndex);
      if (window.Sound) Sound.play('click');
      return `${variant.name}: lighting scene "${SCENES[sceneIndex].name}".`;
    };
    interactive(panel, 'action', 'Touch panel');
    group.add(panel);
    animate(panel, (time) => {
      if (!SCENES[sceneIndex].party) return;
      lampMat.emissive.setHSL((time * 0.25) % 1, 1, 0.55);
      stripMat.emissive.setHSL((time * 0.25 + 0.5) % 1, 1, 0.5);
      screenMat.emissive.setHSL((time * 0.5) % 1, 1, 0.55);
    });
    applyScene(0);

    // ----------------------------------------------------------------- Kitchen
    // Back counter with upper cabinets, island with sink and a working faucet
    const cabinet = MAT.paint(variant.facade === 'wood' ? '#2e3033' : '#ecebe7');
    group.add(slab(5.8, 0.86, 0.62, cabinet, 5.85, FY + 0.43, 0.42, 1));
    group.add(slab(5.9, 0.04, 0.66, MAT.marble(), 5.85, FY + 0.88, 0.42, 1));
    group.add(slab(5.8, 0.75, 0.36, accent, 5.85, FY + 2.05, 0.26, 1.5));
    group.add(noRaycast(slab(5.6, 0.02, 0.04, stripMat, 5.85, FY + 1.66, 0.42, 1)));
    group.add(slab(0.8, 0.012, 0.5, MAT.screen(), 7.6, FY + 0.906, 0.42, 1)); // induction hob
    group.add(slab(0.9, 2.3, 0.65, cabinet, 8.4, FY + 1.15, 0.42, 1)); // fridge column
    group.add(slab(3.0, 0.88, 1.0, accent, 5.0, FY + 0.44, 2.6, 1));
    group.add(slab(3.1, 0.05, 1.1, MAT.marble(), 5.0, FY + 0.905, 2.6, 1));
    group.add(slab(0.6, 0.02, 0.4, MAT.steel(), 4.4, FY + 0.935, 2.6, 1)); // sink
    const faucet = new THREE.Group();
    faucet.position.set(4.4, FY + 0.93, 2.92);
    faucet.add(cylinder(0.025, 0.03, 0.42, MAT.steel(), 0, 0.21, 0, 10));
    faucet.add(slab(0.04, 0.035, 0.26, MAT.steel(), 0, 0.42, -0.12, 1));
    const stream = noRaycast(cylinder(0.018, 0.024, 0.4, waterStreamMaterial(), 0, 0.2, -0.24, 8));
    stream.visible = false;
    faucet.add(stream);
    const basinWater = noRaycast(slab(0.5, 0.01, 0.32, MAT.water(), 0, 0.012, -0.32, 1));
    basinWater.visible = false;
    faucet.add(basinWater);
    let waterUntil = 0;
    faucet.userData.prompt = 'Press E to open the faucet';
    faucet.userData.onInteract = () => {
      waterUntil = performance.now() + 5000;
      stream.visible = basinWater.visible = true;
      return 'The faucet runs for a few seconds (touchless sensor tap).';
    };
    interactive(faucet, 'action', 'Kitchen faucet');
    group.add(faucet);
    animate(faucet, (time) => {
      if (!stream.visible) return;
      stream.material.map.offset.y = -time * 2.5;
      stream.scale.x = stream.scale.z = 1 + Math.sin(time * 30) * 0.08;
      if (performance.now() > waterUntil) stream.visible = basinWater.visible = false;
    });
    // Dining table with chairs and pendant lamps
    group.add(slab(2.4, 0.05, 1.0, MAT.oak(), 5.0, FY + 0.75, 4.9, 1));
    [-0.95, 0.95].forEach((dx) => group.add(slab(0.06, 0.72, 0.8, MAT.dark(), 5.0 + dx, FY + 0.37, 4.9, 1)));
    [[4.3, 4.1, 0], [5.7, 4.1, 0], [4.3, 5.7, Math.PI], [5.7, 5.7, Math.PI]].forEach(([x, z, ry]) => {
      group.add(slab(0.45, 0.05, 0.45, MAT.fabric(variant.sofa), x, FY + 0.45, z, 1));
      group.add(slab(0.45, 0.5, 0.05, MAT.dark(), x, FY + 0.72, z + (ry ? 0.22 : -0.22), 1));
      group.add(slab(0.04, 0.43, 0.04, MAT.dark(), x, FY + 0.22, z, 1));
      group.add(seat(x, FY + 0.45, z, 'Dining chair', ry));
    });
    [4.2, 5.0, 5.8].forEach((x) => {
      group.add(noRaycast(cylinder(0.005, 0.005, 1.1, metal, x, CY - 0.55, 4.9, 4)));
      group.add(noRaycast(cylinder(0.1, 0.16, 0.24, lampMat, x, CY - 1.2, 4.9, 14)));
    });

    // ----------------------------------------------------------------- Bedroom
    group.add(slab(2.5, 1.1, 0.1, accent, 5.6, FY + 0.65, -hd + 0.36, 1.5));
    group.add(slab(2.0, 0.3, 2.2, MAT.dark(), 5.6, FY + 0.15, -5.0, 1));
    group.add(slab(1.92, 0.24, 2.08, MAT.fabric('#f6f4ef'), 5.6, FY + 0.42, -5.0, 1));
    group.add(slab(1.96, 0.06, 1.3, MAT.fabric(variant.bed), 5.6, FY + 0.56, -4.55, 1));
    [-0.45, 0.45].forEach((dx) => group.add(slab(0.7, 0.14, 0.38, MAT.fabric('#ffffff'), 5.6 + dx, FY + 0.6, -5.85, 1)));
    const bedSpot = seat(5.6, FY + 0.5, -4.8, 'Lie down', 0);
    bedSpot.userData.prompt = 'Press E to lie down';
    group.add(bedSpot);
    [4.1, 7.1].forEach((x) => {
      group.add(slab(0.5, 0.45, 0.4, accent, x, FY + 0.225, -5.9, 1));
      group.add(noRaycast(sphere(0.13, lampMat, x, FY + 0.6, -5.9, 12)));
    });
    group.add(slab(0.62, 2.4, 3.0, cabinet, 0.4, FY + 1.2, -3.4, 1)); // wardrobe
    group.add(slab(1.6, 0.42, 0.45, MAT.fabric(variant.bed), 5.6, FY + 0.21, -3.55, 1)); // bed bench
    group.add(noRaycast(slab(8.4, 0.04, 0.06, stripMat, 4.6, CY - 0.06, -hd + 0.35, 1)));
    group.add(noRaycast(slab(1.2, 0.02, 1.2, lampMat, 5.6, CY - 0.02, -3.2, 1)));

    // ------------------------------------------------------- Floating infinity pool
    const side = variant.poolSide;
    const poolX = side * (hw + 4.2);
    const poolY = 1.0;
    // Pool slab on pillars, glass edges, rippling water filled to the brim
    part('Pool slab', 5.4, 0.4, 12, MAT.whiteConcrete(), poolX, poolY + 0.2, -0.5, 'concrete', 3);
    [-1, 1].forEach((sx) => [-5, -0.5, 4].forEach((z) => {
      group.add(cylinder(0.18, 0.18, poolY, MAT.whiteConcrete(), poolX + sx * 1.9, poolY / 2, z, 12));
      parts.push({ name: 'Pool pillar', w: 0.36, h: poolY, d: 0.36, x: poolX + sx * 1.9, y: poolY / 2, z, material: 'concrete' });
    }));
    const edgeY = poolY + 0.4 + 0.55;
    [[5.4, 0.06, 0, 5.47], [5.4, 0.06, 0, -6.47]].forEach(([w, d, x, z]) => group.add(noRaycast(slab(w, 1.1, d, MAT.poolGlass(), poolX + x, edgeY, z, 1))));
    [-2.67, 2.67].forEach((dx) => group.add(noRaycast(slab(0.06, 1.1, 12, MAT.poolGlass(), poolX + dx, edgeY, -0.5, 1))));
    parts.push({ name: 'Pool glass', w: 5.4, h: 1.1, d: 12, x: poolX, y: edgeY, z: -0.5, material: 'glass' });
    const waterSurface = noRaycast(slab(5.28, 1.02, 11.88, MAT.water(), poolX, poolY + 0.4 + 0.51, -0.5, 4));
    group.add(waterSurface);
    parts.push({ name: 'Pool water', w: 5.2, h: 1.0, d: 11.8, x: poolX, y: poolY + 0.91, z: -0.5, material: 'water' });
    // Underwater LED line and floating steps up to the pool deck
    group.add(noRaycast(slab(0.04, 0.04, 11.6, MAT.glow('#7ff0ff', 2), poolX - side * 2.6, poolY + 0.5, -0.5, 1)));
    group.add(noRaycast(slab(5.2, 0.04, 0.04, MAT.glow('#7ff0ff', 2), poolX, poolY + 0.45, 5.4, 1)));
    // Sun loungers on the terrace next to the pool
    [-1, 1].forEach((k) => {
      const lx = poolX - side * 0.2 + k * 1.2;
      group.add(slab(0.75, 0.3, 1.9, MAT.paint('#f1efe9'), lx, 0.27, 8.6, 1));
      const backrest = slab(0.75, 0.08, 0.6, MAT.fabric('#e9e4da'), lx, 0.55, 9.4, 1);
      backrest.rotation.x = -0.5;
      group.add(backrest);
      group.add(seat(lx, 0.42, 8.4, 'Sun lounger', 0));
    });

    // ---------------------------------------------------------------- Garden
    const yard = data.yard || 14;
    group.add(slab(2.6, 0.05, yard, MAT.pavers(), doorX, 0.025, hd + yard / 2, 2.5)); // front path
    hedge(group, 0.9, 1.1, yard - 3, -16.5, hd + yard / 2 - 1.5);
    hedge(group, 0.9, 1.1, yard - 3, 16.5, hd + yard / 2 - 1.5);
    hedge(group, 33.9, 1.6, 0.9, 0, -hd - 4.5);
    [-16.5, 16.5].forEach((x) => hedge(group, 0.9, 1.6, 10, x, -hd + 1));
    // Planters with ornamental grass along the facade and garden lights
    [-7.5, 1.5, 6.5].forEach((x) => {
      group.add(slab(2.4, 0.45, 0.8, MAT.concrete(), x, 0.225, hd + 1.6, 2));
      group.add(noRaycast(slab(2.2, 0.3, 0.6, MAT.hedge(), x, 0.55, hd + 1.6, 1)));
    });
    for (let z = hd + 2.5; z < hd + yard - 1; z += 3) [-1, 1].forEach((k) => group.add(noRaycast(cylinder(0.06, 0.06, 0.5, MAT.glow('#ffe3b0', 1.5), doorX + k * 1.6, 0.25, z, 8))));

    // ----------------------------------------------------------- Rooftop terrace
    if (variant.elevator) skyTerrace(group, { up, roofTop, hw, parts, lampMat });

    const record = { id, group, name: variant.name, price: variant.price, parts, stats: null };
    mansions.set(id, record);
    group.userData.label = variant.name;
  }

  function tvTexture(name) {
    return canvasTexture(`mb|tv|${name}`, 512, 288, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#0f2a3d'); gradient.addColorStop(0.6, '#1d4d5c'); gradient.addColorStop(1, '#e0a96d');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(0, h * 0.75); ctx.lineTo(w * 0.3, h * 0.55); ctx.lineTo(w * 0.55, h * 0.7); ctx.lineTo(w * 0.8, h * 0.5); ctx.lineTo(w, h * 0.65); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '300 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText(name.toUpperCase(), 28, 50);
      ctx.font = '16px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('Home cinema  ·  Sound system: press E on the console', 28, 78);
    });
  }

  function waterStreamMaterial() {
    return M('waterStream', () => {
      const map = tex('waterStream', 32, (ctx, w, h) => {
        ctx.fillStyle = 'rgba(200,235,255,0.5)'; ctx.fillRect(0, 0, w, h);
        const random = seeded(201);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.6})`; ctx.fillRect(random() * w, random() * h, 2, 8 + random() * 20); }
      }, 128);
      return new THREE.MeshStandardMaterial({ map, color: '#d8f1ff', transparent: true, opacity: 0.8, roughness: 0.05, depthWrite: false });
    });
  }

  // Internet radio on the sound system (one stream at a time, stops when far)
  function toggleRadio(id, console3d) {
    if (radio.audio && radio.owner === id && !radio.audio.paused) {
      radio.audio.pause();
      console3d.userData.prompt = 'Press E to play the radio (SomaFM Groove Salad)';
      return 'Radio stopped.';
    }
    if (!radio.audio) {
      radio.audio = new Audio();
      radio.audio.preload = 'none';
      radio.audio.volume = 0.6;
    }
    if (radio.console && radio.console !== console3d) radio.console.userData.prompt = 'Press E to play the radio (SomaFM Groove Salad)';
    radio.owner = id;
    radio.console = console3d;
    radio.audio.src = RADIO_URL;
    console3d.userData.prompt = 'Press E to stop the radio';
    radio.audio.play().catch(() => {
      if (typeof appendSystemMessage === 'function') appendSystemMessage('The radio stream could not start (offline, or the browser blocked audio).');
      console3d.userData.prompt = 'Press E to play the radio (SomaFM Groove Salad)';
    });
    if (!radio.interval) {
      // Stop the music when the player walks away from the house
      radio.interval = setInterval(() => {
        const me = avatarRef();
        if (!me || !radio.audio || radio.audio.paused || !radio.console) return;
        const where = new THREE.Vector3();
        radio.console.getWorldPosition(where);
        if (where.distanceTo(me.position) > 45) {
          radio.audio.pause();
          radio.console.userData.prompt = 'Press E to play the radio (SomaFM Groove Salad)';
        }
      }, 1000);
    }
    return 'Radio: SomaFM Groove Salad (free internet radio, somafm.com). Press E again to stop.';
  }

  // Rooftop terrace on top of the Sky Terrace House, with a glass hydraulic
  // elevator (animated cabin; the avatar rides with it)
  function skyTerrace(group, { up, roofTop, hw, parts, lampMat }) {
    const railing = MAT.poolGlass();
    const x0 = up.x - up.w / 2; const x1 = up.x + up.w / 2;
    const z0 = up.z - up.d / 2; const z1 = up.z + up.d / 2;
    group.add(slab(up.w - 0.2, 0.06, up.d - 0.2, MAT.oak(), up.x, roofTop + 0.03, up.z, 1.5));
    // Glass railings (solid enough to stop a fall); gap toward the elevator
    group.add(slab(up.w, 1.1, 0.06, railing, up.x, roofTop + 0.55, z0 + 0.1, 1));
    group.add(slab(up.w, 1.1, 0.06, railing, up.x, roofTop + 0.55, z1 - 0.1, 1));
    group.add(slab(0.06, 1.1, up.d, railing, x0 + 0.1, roofTop + 0.55, up.z, 1));
    const elevatorZ = 0.5;
    group.add(slab(0.06, 1.1, (elevatorZ - 1.3) - z0, railing, x1 - 0.1, roofTop + 0.55, (z0 + elevatorZ - 1.3) / 2, 1));
    group.add(slab(0.06, 1.1, z1 - (elevatorZ + 1.3), railing, x1 - 0.1, roofTop + 0.55, (z1 + elevatorZ + 1.3) / 2, 1));
    // Pergola, loungers, planters with olive trees, outdoor kitchen counter
    [[-6, -6.5], [-6, -1.5], [-1, -6.5], [-1, -1.5]].forEach(([x, z]) => group.add(slab(0.16, 2.6, 0.16, MAT.metal(), x, roofTop + 1.3, z, 1)));
    group.add(slab(5.6, 0.12, 5.6, MAT.wood(), -3.5, roofTop + 2.66, -4, 1.5));
    for (let i = 0; i < 3; i++) {
      group.add(slab(0.8, 0.32, 1.9, MAT.paint('#f1efe9'), -5 + i * 1.4, roofTop + 0.16, -4.2, 1));
      group.add(seat(-5 + i * 1.4, roofTop + 0.36, -4.2, 'Rooftop lounger', 0));
    }
    [[4, -7], [6.5, -7], [-7.5, 2]].forEach(([x, z]) => {
      group.add(slab(1.1, 0.7, 1.1, MAT.concrete(), x, roofTop + 0.35, z, 2));
      group.add(noRaycast(sphere(0.7, M('olive', () => new THREE.MeshStandardMaterial({ color: '#7a8f5a', roughness: 1, flatShading: true })), x, roofTop + 1.6, z, 6)));
      group.add(cylinder(0.05, 0.07, 0.8, MAT.dark(), x, roofTop + 0.9, z, 6));
    });
    group.add(slab(3.2, 0.95, 0.7, MAT.dark(), 3, roofTop + 0.475, -2, 1));
    group.add(slab(3.3, 0.05, 0.75, MAT.marble(), 3, roofTop + 0.97, -2, 1));
    group.add(noRaycast(slab(up.w - 0.6, 0.03, 0.05, lampMat, up.x, roofTop + 0.08, z1 - 0.3, 1)));
    parts.push({ name: 'Roof deck', w: up.w, h: 0.06, d: up.d, x: up.x, y: roofTop + 0.03, z: up.z, material: 'wood' });

    // Elevator shaft: steel corner posts, fine glass panels (no collision so the
    // avatar steps in from the house side), a bridge to the roof deck
    const ex = x1 + 1.25;
    const shaftH = roofTop + 3.2;
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => group.add(slab(0.1, shaftH, 0.1, MAT.metal(), ex + sx * 1.05, shaftH / 2, elevatorZ + sz * 1.05, 1)));
    [[0, -1.05, 2.1, 0.03], [0, 1.05, 2.1, 0.03], [1.05, 0, 0.03, 2.1]].forEach(([dx, dz, w, d]) => group.add(noRaycast(slab(w, shaftH, d, M('shaftGlass', () => new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.5, depthWrite: false })), ex + dx, shaftH / 2, elevatorZ + dz, 1))));
    group.add(slab(2.4, 0.15, 2.4, MAT.metal(), ex, shaftH + 0.07, elevatorZ, 1));
    group.add(slab(ex - 1.05 - (x1 - 0.2), 0.3, 2.0, MAT.whiteConcrete(), (ex - 1.05 + x1 - 0.2) / 2, roofTop - 0.15, elevatorZ, 1));
    parts.push({ name: 'Elevator shaft', w: 2.2, h: shaftH, d: 2.2, x: ex, y: shaftH / 2, z: elevatorZ, material: 'glass' });
    // Cabin: floor, glass sides and a glowing ceiling ring
    const cabin = new THREE.Group();
    cabin.add(slab(1.95, 0.12, 1.95, MAT.metal(), 0, 0.06, 0, 1));
    cabin.add(noRaycast(slab(1.9, 0.02, 1.9, MAT.marble(), 0, 0.13, 0, 1)));
    [[0, -0.95, 1.9, 0.03], [0, 0.95, 1.9, 0.03], [0.95, 0, 0.03, 1.9]].forEach(([dx, dz, w, d]) => cabin.add(noRaycast(slab(w, 2.4, d, MAT.poolGlass(), dx, 1.32, dz, 1))));
    cabin.add(noRaycast(slab(1.95, 0.08, 1.95, MAT.steel(), 0, 2.56, 0, 1)));
    cabin.add(noRaycast(slab(1.6, 0.03, 0.05, MAT.glow('#e3f2ff', 2), 0, 2.5, 0.8, 1)));
    cabin.add(noRaycast(slab(1.6, 0.03, 0.05, MAT.glow('#e3f2ff', 2), 0, 2.5, -0.8, 1)));
    cabin.position.set(ex, 0, elevatorZ);
    group.add(cabin);
    const topY = roofTop - 0.13;
    const lift = { y: 0, from: 0, to: 0, start: 0, duration: 0, rider: false };
    const ride = (target, rider) => {
      lift.from = cabin.position.y; lift.to = target; lift.start = performance.now();
      lift.duration = Math.abs(target - cabin.position.y) / 2.2 * 1000 + 600; lift.rider = rider;
      if (window.Sound) Sound.play('teleport');
    };
    const avatarInCabin = () => {
      const me = avatarRef();
      if (!me) return false;
      const local = group.worldToLocal(me.position.clone());
      return Math.abs(local.x - ex) < 1.3 && Math.abs(local.z - elevatorZ) < 1.3 && Math.abs(local.y - cabin.position.y) < 1.5;
    };
    const callButton = (y, label) => {
      const button = new THREE.Group();
      button.position.set(ex - 1.2, y + 1.2, elevatorZ + 1.25);
      button.add(slab(0.08, 0.3, 0.16, MAT.dark(), 0, 0, 0, 1));
      button.add(noRaycast(sphere(0.04, MAT.glow('#63e6be', 2), -0.05, 0, 0, 8)));
      button.userData.prompt = 'Press E to use the glass elevator';
      button.userData.onInteract = () => {
        if (lift.duration && performance.now() - lift.start < lift.duration) return 'The elevator is moving...';
        const atLevel = Math.abs(cabin.position.y - (y === 0 ? 0 : topY)) < 0.05;
        if (!atLevel) { ride(y === 0 ? 0 : topY, false); return 'The cabin is on its way. Step in and press E again.'; }
        if (!avatarInCabin()) {
          // Pressing from the landing: step the player into the cabin first
          const me = avatarRef();
          if (me) moveAvatarWithCamera(group.localToWorld(new THREE.Vector3(ex, cabin.position.y + 0.14, elevatorZ)));
        }
        ride(y === 0 ? topY : 0, true);
        return y === 0 ? 'Going up to the rooftop terrace...' : 'Going down to the garden...';
      };
      interactive(button, 'action', label);
      group.add(button);
    };
    callButton(0, 'Elevator (garden)');
    callButton(roofTop, 'Elevator (rooftop)');
    animate(cabin, () => {
      if (!lift.duration) return;
      const t = Math.min(1, (performance.now() - lift.start) / lift.duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cabin.position.y = lift.from + (lift.to - lift.from) * eased;
      if (lift.rider) moveAvatarWithCamera(group.localToWorld(new THREE.Vector3(ex, cabin.position.y + 0.14, elevatorZ)));
      if (t >= 1) {
        if (lift.rider) {
          // Step out onto the landing
          const out = lift.to > 0 ? new THREE.Vector3(x1 - 1.2, roofTop + 0.06, elevatorZ) : new THREE.Vector3(ex, 0.15, elevatorZ + 2.4);
          moveAvatarWithCamera(group.localToWorld(out));
          if (typeof appendSystemMessage === 'function') appendSystemMessage(lift.to > 0 ? 'Rooftop terrace. Enjoy the view.' : 'Garden level.');
        }
        lift.duration = 0;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Package totems and the glTF sample exporter
  // --------------------------------------------------------------------------
  function meshStats(group) {
    let triangles = 0;
    const textures = new Set();
    group.traverse((node) => {
      if (!node.isMesh || !node.visible) return;
      const geometry = node.geometry;
      const count = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      triangles += count * (node.isInstancedMesh ? node.count : 1);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => ['map', 'normalMap'].forEach((key) => { if (m && m[key]) textures.add(m[key].image || m[key]); }));
    });
    return { triangles: Math.round(triangles), textures: textures.size };
  }

  const GLTF_MATERIALS = {
    concrete: [0.86, 0.85, 0.82, 1, 0, 0.85], plaster: [0.95, 0.94, 0.92, 1, 0, 0.9], wood: [0.6, 0.41, 0.25, 1, 0, 0.75],
    glass: [0.65, 0.8, 0.86, 0.3, 0.2, 0.05], metal: [0.12, 0.12, 0.13, 1, 0.8, 0.4], floor: [0.82, 0.8, 0.77, 1, 0, 0.4], water: [0.18, 0.66, 0.79, 0.85, 0, 0.05]
  };

  // A valid glTF 2.0 JSON: one shared unit box (POSITION, NORMAL, indices in an
  // embedded base64 buffer), one mesh per material, one node per box
  function buildGltf(record) {
    const positions = []; const normals = []; const indices = [];
    const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    faces.forEach(([n, u, v]) => {
      const base = positions.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
        positions.push(0.5 * (n[0] + a * u[0] + b * v[0]), 0.5 * (n[1] + a * u[1] + b * v[1]), 0.5 * (n[2] + a * u[2] + b * v[2]));
        normals.push(...n);
      });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const positionBytes = new Uint8Array(new Float32Array(positions).buffer);
    const normalBytes = new Uint8Array(new Float32Array(normals).buffer);
    const indexBytes = new Uint8Array(new Uint16Array(indices).buffer); // 72 bytes: already 4-byte aligned
    const bytes = new Uint8Array(positionBytes.length + normalBytes.length + indexBytes.length);
    bytes.set(positionBytes, 0); bytes.set(normalBytes, positionBytes.length); bytes.set(indexBytes, positionBytes.length + normalBytes.length);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const usedMaterials = [...new Set(record.parts.map((p) => p.material))];
    const round = (value) => Math.round(value * 1000) / 1000;
    const gltf = {
      asset: { version: '2.0', generator: 'MetaBlock Estates sample exporter (GitHub Multiverse)' },
      scene: 0,
      scenes: [{ name: record.name, nodes: [0] }],
      nodes: [{ name: record.name, children: record.parts.map((_, i) => i + 1) }].concat(record.parts.map((p) => ({
        name: p.name, mesh: usedMaterials.indexOf(p.material), translation: [round(p.x), round(p.y), round(p.z)], scale: [round(p.w), round(p.h), round(p.d)]
      }))),
      meshes: usedMaterials.map((name, i) => ({ name: `box_${name}`, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i, mode: 4 }] })),
      materials: usedMaterials.map((name) => {
        const [r, g, b, a, metallic, roughness] = GLTF_MATERIALS[name] || GLTF_MATERIALS.concrete;
        return { name, pbrMetallicRoughness: { baseColorFactor: [r, g, b, a], metallicFactor: metallic, roughnessFactor: roughness }, alphaMode: a < 1 ? 'BLEND' : 'OPAQUE', doubleSided: a < 1 };
      }),
      accessors: [
        { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
        { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
        { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' }
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
        { buffer: 0, byteOffset: positionBytes.length, byteLength: normalBytes.length, target: 34962 },
        { buffer: 0, byteOffset: positionBytes.length + normalBytes.length, byteLength: indexBytes.length, target: 34963 }
      ],
      buffers: [{ byteLength: bytes.length, uri: `data:application/octet-stream;base64,${btoa(binary)}` }]
    };
    return gltf;
  }

  function readmeText(record, stats) {
    const triangles = record.parts.length * 12;
    return [
      `${record.name} - MetaBlock Estates free sample package`,
      '='.repeat(60),
      '',
      `Files: metablock_${record.id}.gltf (glTF 2.0, embedded buffer) + this README.`,
      `Sample model: ${record.parts.length} boxes, ${triangles} triangles, ${Object.keys(GLTF_MATERIALS).length} or fewer flat PBR materials, no textures.`,
      `In-game model (for reference): ${stats.triangles.toLocaleString('en-US')} triangles, ${stats.textures} textures.`,
      'Units: meters, Y up, the house faces +Z. Ground floor ceiling 3.2 m, doors 2.6 m.',
      '',
      'Using it in a Decentraland scene (SDK 7)',
      '-----------------------------------------',
      'Decentraland limits every scene by the number of parcels it uses (n parcels,',
      'one parcel = 16 x 16 m). Check the current official documentation, the',
      'values below are the commonly documented ones:',
      '  - Triangles: n x 10,000',
      '  - Entities: n x 200      - Bodies (meshes): n x 300',
      '  - Materials: log2(n+1) x 20   - Textures: log2(n+1) x 10',
      '  - Height: log2(n+1) x 20 m',
      '  - File size: 15 MB per parcel (max 300 MB per scene)',
      '  - Textures should be power-of-two sizes (512 or 1024 px max recommended).',
      '  - Everything must stay inside the scene parcels (no overhangs outside).',
      `This house fits on a 2 x 2 parcel scene (32 x 32 m): the sample uses ${triangles} of 40,000 triangles.`,
      'Load it with GltfContainer.create(entity, { src: "models/metablock_' + record.id + '.gltf" }).',
      '',
      'Licensing: free sample for learning, made in GitHub Multiverse.',
      'No purchase, wallet, NFT or token is involved: the price shown in the game is',
      'in-game MVC coins only, and this sample package is free.'
    ].join('\n');
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function totemTexture(record, stats) {
    return canvasTexture(`mb|totem|${record.id}|${stats.triangles}`, 512, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#121417'; ctx.fillRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 0, 0, 420);
      gradient.addColorStop(0, '#2b3a45'); gradient.addColorStop(1, '#121417');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, 420);
      // Minimal house drawing
      ctx.strokeStyle = '#f1efe9'; ctx.lineWidth = 4;
      ctx.strokeRect(90, 230, 260, 110); ctx.strokeRect(170, 150, 270, 80);
      ctx.fillStyle = 'rgba(160,200,220,0.35)'; ctx.fillRect(180, 160, 250, 60); ctx.fillRect(100, 240, 160, 90);
      ctx.fillStyle = '#4fc3dc'; ctx.fillRect(360, 300, 110, 22);
      ctx.fillStyle = '#63e6be'; ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TEST DRIVE PACKAGE', 40, 60);
      ctx.fillStyle = '#ffffff'; ctx.font = '300 48px "Segoe UI", Arial, sans-serif';
      ctx.fillText(record.name, 40, 118);
      const rows = [['Triangles', stats.triangles.toLocaleString('en-US')], ['Textures', String(stats.textures)], ['Sample glTF', `${record.parts.length} boxes · ${record.parts.length * 12} tris`], ['Price', `${record.price.toLocaleString('en-US')} MVC`]];
      ctx.font = '28px "Segoe UI", Arial, sans-serif';
      rows.forEach(([key, value], i) => {
        const y = 480 + i * 74;
        ctx.fillStyle = '#868e96'; ctx.fillText(key, 40, y);
        ctx.fillStyle = '#f8f9fa'; ctx.textAlign = 'right'; ctx.fillText(value, w - 40, y); ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, y + 22, w - 80, 2);
      });
      ctx.fillStyle = '#868e96'; ctx.font = '20px "Segoe UI", Arial, sans-serif';
      ctx.fillText('MVC = in-game coins only. No NFT, no wallet.', 40, 800);
      ctx.fillStyle = '#63e6be'; ctx.fillRect(40, 840, w - 80, 120);
      ctx.fillStyle = '#0b1f19'; ctx.font = '600 32px "Segoe UI", Arial, sans-serif';
      ctx.fillText('FREE SAMPLE PACKAGE', 70, 892);
      ctx.font = '22px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Press E: glTF 2.0 + README', 70, 932);
    });
  }

  function totem(group, { data }) {
    const id = data.house;
    group.add(slab(1.0, 2.5, 0.36, MAT.dark(), 0, 1.25, 0, 1));
    group.add(slab(1.2, 0.08, 0.5, MAT.metal(), 0, 0.04, 0, 1));
    const screenMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const screen = mesh(new THREE.PlaneGeometry(0.88, 1.76), screenMaterial, 0, 1.38, 0.185);
    group.add(screen);
    const back = mesh(new THREE.PlaneGeometry(0.88, 1.76), screenMaterial, 0, 1.38, -0.185);
    back.rotation.y = Math.PI;
    group.add(back);
    group.add(noRaycast(slab(1.02, 0.03, 0.38, MAT.glow('#63e6be', 1.6), 0, 2.48, 0, 1)));
    let ready = false;
    animate(group, () => {
      if (ready) return;
      const record = mansions.get(id);
      if (!record || !record.group.parent) return;
      record.stats = meshStats(record.group);
      screenMaterial.map = totemTexture(record, record.stats);
      screenMaterial.needsUpdate = true;
      ready = true;
    });
    group.userData.prompt = 'Press E to download the free sample package (glTF + README)';
    group.userData.onInteract = () => {
      const record = mansions.get(id);
      if (!record) return 'This package is not available.';
      const stats = record.stats || meshStats(record.group);
      download(`metablock_${record.id}.gltf`, JSON.stringify(buildGltf(record), null, 1), 'model/gltf+json');
      setTimeout(() => download(`metablock_${record.id}_README.txt`, readmeText(record, stats), 'text/plain'), 600);
      if (window.Sound) Sound.play('coin');
      return `Free sample package of ${record.name}: metablock_${record.id}.gltf + README downloaded (no coins charged).`;
    };
    interactive(group, 'action', `${data.label || 'Package totem'}`);
  }

  // --------------------------------------------------------------------------
  // The Customization Garage
  // --------------------------------------------------------------------------
  const GARAGE_OPTIONS = {
    facade: [['concrete', 'Exposed concrete', '#bdbab3'], ['wood', 'Wood', '#a06c42'], ['plaster', 'White plaster', '#f4f2ee'], ['metal', 'Black metal', '#1d1f22']],
    floor: [['marble', 'Marble', '#f3f1ee'], ['porcelain', 'Porcelain', '#c9c7c3'], ['oak', 'Oak', '#c49868']],
    roof: [['flat', 'Flat roof', '#9a968f'], ['green', 'Green roof', '#6a8a3a']]
  };

  function garage(group) {
    // Clean construction site: concrete pad, barriers, scaffolding, a tower crane
    group.add(slab(50, 0.1, 32, MAT.concrete(), 0, 0.05, 0, 4));
    const stripes = canvasTexture('mb|barrier', 256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#f1efe9'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8590c';
      for (let x = -h; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 24, h); ctx.lineTo(x + 24 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
    });
    const barrier = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
    [[0, -15.6, 46, 0], [-24.6, 0, 30, Math.PI / 2]].forEach(([x, z, length, ry]) => {
      const rail = slab(length, 0.35, 0.12, barrier, x, 0.85, z, 1);
      rail.rotation.y = ry;
      group.add(rail);
    });
    group.add(slab(46, 0.35, 0.12, barrier, 0, 0.85, 15.6, 1));
    [[-22, -15.6], [0, -15.6], [22, -15.6], [-22, 15.6], [0, 15.6], [22, 15.6], [-24.6, -8], [-24.6, 8]].forEach(([x, z]) => group.add(slab(0.1, 1.0, 0.1, MAT.dark(), x, 0.5, z, 1)));
    // Tower crane (lattice textured mast and jib)
    const lattice = canvasTexture('mb|lattice', 64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h); ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, w - 4, h - 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.stroke();
    });
    lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping;
    const crane = new THREE.MeshStandardMaterial({ map: lattice, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    group.add(noRaycast(slab(1.4, 26, 1.4, crane, -20, 13, -11, 1.4)));
    group.add(noRaycast(slab(30, 1.2, 1.2, crane, -10, 26.6, -11, 1.2)));
    group.add(slab(3, 2, 2, MAT.paint('#3a3d42'), -27, 26.6, -11, 1));
    group.add(noRaycast(cylinder(0.02, 0.02, 14, MAT.dark(), 2, 19.5, -11, 4)));
    group.add(slab(2.4, 1.2, 1.2, MAT.paint('#868e96'), 2, 12, -11, 1));
    group.add(slab(4, 0.6, 4, MAT.concrete(), -20, 0.3, -11, 2));
    // Pallets and site containers
    group.add(slab(6, 2.6, 2.4, MAT.paint('#e9ecef'), 18, 1.3, -12, 2));
    group.add(slab(6, 2.6, 2.4, MAT.paint('#ced4da'), 18, 1.3, 12, 2));
    [[14, -6], [15.4, -6], [14.7, -4.6]].forEach(([x, z]) => group.add(slab(1.2, 0.15, 1.2, MAT.oak(), x, 0.18, z, 1)));
    [[14, 0.75, -6], [15.4, 0.75, -6]].forEach(([x, y, z]) => group.add(slab(1.0, 1.0, 1.0, MAT.concrete(), x, y, z, 1)));
    // Garage sign standing on two posts, facing the plaza (+x)
    const sign = mesh(new THREE.PlaneGeometry(10, 2), new THREE.MeshBasicMaterial({ map: labelTexture('THE CUSTOMIZATION GARAGE', { bg: '#1d1f22', fg: '#f1efe9', width: 1024, height: 200, font: '300 64px "Segoe UI", Arial, sans-serif' }) }), 24.1, 4.4, 0);
    sign.rotation.y = Math.PI / 2;
    group.add(slab(0.1, 2.4, 10.4, MAT.dark(), 24.0, 4.4, 0, 1));
    [-4.6, 4.6].forEach((z) => group.add(slab(0.2, 3.3, 0.2, MAT.metal(), 23.9, 1.65, z, 1)));
    group.add(sign);

    // Model house (front +x toward the street): cutaway front so the floor shows
    const house = new THREE.Group();
    house.position.set(-4, 0, 0);
    house.rotation.y = Math.PI / 2;
    group.add(house);
    const facadeMeshes = []; const floorMeshes = []; const roofMeshes = [];
    const addFacade = (...args) => { const m = slab(...args); facadeMeshes.push(m); house.add(m); return m; };
    house.add(slab(12, 0.15, 9, MAT.whiteConcrete(), 0, 0.075, 0.5, 3));
    const interiorFloor = slab(9.6, 0.05, 6.6, MAT.marble(), 0, 0.17, -0.2, 1.2);
    house.add(interiorFloor); floorMeshes.push(interiorFloor);
    const terraceDeck = slab(9.6, 0.05, 2.6, MAT.marble(), 0, 0.17, 4.4, 1.2);
    house.add(terraceDeck); floorMeshes.push(terraceDeck);
    addFacade(10, 3.4, 0.3, MAT.concrete(), 0, 1.85, -3.55, 3);
    addFacade(0.3, 3.4, 7, MAT.concrete(), -4.85, 1.85, -0.2, 3);
    addFacade(0.3, 3.4, 7, MAT.concrete(), 4.85, 1.85, -0.2, 3);
    addFacade(2.4, 3.4, 0.3, MAT.concrete(), -3.8, 1.85, 3.15, 3);
    house.add(slab(10.4, 0.3, 7.6, MAT.whiteConcrete(), 0, 3.7, -0.2, 3));
    // Upper volume, cantilevered toward the terrace
    addFacade(11, 3.0, 0.3, MAT.concrete(), 0.6, 5.35, -2.2, 3);
    addFacade(0.3, 3.0, 6, MAT.concrete(), -4.75, 5.35, 0.65, 3);
    addFacade(0.3, 3.0, 6, MAT.concrete(), 5.95, 5.35, 0.65, 3);
    house.add(noRaycast(slab(10.4, 3.0, 0.06, MAT.glass(), 0.6, 5.35, 3.6, 1)));
    house.add(slab(11.6, 0.15, 6.6, MAT.whiteConcrete(), 0.6, 3.9, 0.65, 3));
    const roof = slab(11.6, 0.3, 6.6, MAT.gravel(), 0.6, 7.0, 0.65, 2);
    house.add(roof); roofMeshes.push(roof);
    const greenery = new THREE.Group();
    [[-3, -1], [-1, 1.5], [2, 0], [4, 2], [3.5, -1.5], [-3.5, 2.5], [0.5, -1.8]].forEach(([x, z], i) => greenery.add(noRaycast(sphere(0.35 + (i % 3) * 0.12, M('shrub', () => new THREE.MeshStandardMaterial({ color: '#5b8a3a', roughness: 1, flatShading: true })), 0.6 + x, 7.25, 0.65 + z, 6))));
    greenery.visible = false;
    house.add(greenery);
    // Simple furniture so the floor reads as an interior
    house.add(slab(2.6, 0.45, 0.9, MAT.fabric('#d8d2c8'), -1.5, 0.42, -2.4, 1));
    house.add(slab(1.8, 0.05, 0.9, MAT.oak(), 2.4, 0.95, 0, 1));
    house.add(slab(0.1, 0.75, 0.7, MAT.dark(), 2.4, 0.55, 0, 1));
    house.add(noRaycast(sphere(0.25, MAT.glow('#ffd49a', 1.5), 2.4, 2.6, 0, 12)));

    const state = { facade: 'concrete', floor: 'marble', roof: 'flat' };
    const apply = () => {
      const facadeMaterial = MAT[state.facade]();
      facadeMeshes.forEach((m) => { m.material = facadeMaterial; });
      const floorMaterial = MAT[state.floor]();
      floorMeshes.forEach((m) => { m.material = floorMaterial; });
      roofMeshes.forEach((m) => { m.material = state.roof === 'green' ? MAT.sedum() : MAT.gravel(); });
      greenery.visible = state.roof === 'green';
    };
    const openGarage = () => {
      const section = (key, title) => `<h3>${title}</h3><div class="mb-options">${GARAGE_OPTIONS[key].map(([value, label, swatch]) =>
        `<button type="button" data-key="${key}" data-value="${value}" class="${state[key] === value ? 'active' : ''}"><span class="mb-swatch" style="background:${swatch}"></span>${label}</button>`).join('')}</div>`;
      showPanel('mb-garage-panel', `<h2>The Customization Garage</h2><p class="mb-sub">Swap the model house materials live. Changes apply instantly.</p>${section('facade', 'Facade')}${section('floor', 'Floor')}${section('roof', 'Roof')}`, (panel) => {
        panel.querySelectorAll('.mb-options button').forEach((button) => button.addEventListener('click', () => {
          state[button.dataset.key] = button.dataset.value;
          apply();
          panel.querySelectorAll(`button[data-key="${button.dataset.key}"]`).forEach((b) => b.classList.toggle('active', b === button));
          if (window.Sound) Sound.play('click');
          button.blur();
        }));
      });
    };
    // Glowing floor button: step on it (within 1.5 m) or press E
    const button = new THREE.Group();
    button.position.set(6, 0.1, 0);
    button.add(cylinder(1.0, 1.1, 0.06, MAT.dark(), 0, 0.03, 0, 32));
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#63e6be', emissive: '#63e6be', emissiveIntensity: 1.6 });
    const glowRing = mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 48), ringMaterial, 0, 0.07, 0);
    glowRing.rotation.x = Math.PI / 2;
    button.add(noRaycast(glowRing));
    button.add(noRaycast(cylinder(0.5, 0.5, 0.02, ringMaterial, 0, 0.065, 0, 32)));
    const beam = mesh(new THREE.CylinderGeometry(0.85, 0.85, 3, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#63e6be', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 1.55, 0);
    button.add(noRaycast(beam));
    const caption = textSprite('Step here: customize the model house', { width: 5, background: 'rgba(18, 20, 24, 0.85)' });
    caption.position.set(0, 3.4, 0);
    button.add(caption);
    button.userData.prompt = 'Press E (or step on the button) to customize the model house';
    button.userData.onInteract = () => { openGarage(); return null; };
    interactive(button, 'action', 'Customization button');
    group.add(button);
    let inside = false;
    const where = new THREE.Vector3();
    animate(button, (time) => {
      ringMaterial.emissiveIntensity = 1.3 + Math.sin(time * 3) * 0.5;
      const me = avatarRef();
      if (!me) return;
      button.getWorldPosition(where);
      const distance = Math.hypot(me.position.x - where.x, me.position.z - where.z);
      const near = distance < 1.5 && Math.abs(me.position.y - where.y) < 1.5;
      if (near && !inside) { inside = true; if (!openPanel || openPanel.id !== 'mb-garage-panel') openGarage(); }
      if (distance > 2.5) inside = false;
      if (distance > 10 && openPanel && openPanel.id === 'mb-garage-panel') closePanel();
    });
    group.userData.label = 'The Customization Garage';
  }

  // --------------------------------------------------------------------------
  // Residents Lane gate, security camera kiosk, top view
  // --------------------------------------------------------------------------
  const LOG_KEY = 'multiverse-metablock-gate-log';
  function readLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (error) { return []; } }
  function addLog(entry) {
    const log = readLog();
    log.unshift(entry);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 30))); } catch (error) { /* ignore */ }
  }
  const gateState = { open: 0 };
  const TOP_RECTS = [
    [-110, -80, 110, 80, '#3d5c2a'], [-5, -80, 5, -20, '#2b2d30'], [-5, 20, 5, 80, '#2b2d30'], [-9, -80, -5, -20, '#bdb8ae'], [5, -80, 9, -20, '#bdb8ae'],
    [-9, 20, -5, 80, '#bdb8ae'], [5, 20, 9, 80, '#bdb8ae'], [-27, -20, 27, 20, '#cfcac0'], [-15, -10, 15, 10, '#46525e'],
    [23.5, -59, 36.5, -41, '#ecebe7'], [-36.5, -59, -23.5, -41, '#a06c42'], [23.5, 45, 36.5, 63, '#f4f2ee'],
    [-87, -16, -37, 16, '#9c9890'], [-70.5, -6, -61.5, 6, '#d8d4cc'], [-110, 25.4, -9.6, 26.6, '#2f5a24'], [9.6, 25.4, 110, 26.6, '#2f5a24'],
    [24.5, -65.9, 36.5, -60.5, '#2fa9c9'], [-36.5, -65.9, -24.5, -60.5, '#2fa9c9'], [24.5, 38.1, 36.5, 43.5, '#2fa9c9'], [-58, 48, -42, 56, '#2fa9c9']
  ];
  const TOP_LABELS = [['Brokers Hub', 0, 0], ['Casa Cantilever', 30, -50], ['Slat House', -30, -50], ['Sky Terrace', 30, 54], ['Garage', -62, 0], ['Residents Lane', 0, 40]];
  function drawTopView(ctx, w, h) {
    const sx = w / 220; const sz = h / 160;
    const px = (x) => (x + 110) * sx; const pz = (z) => (z + 80) * sz;
    TOP_RECTS.forEach(([x0, z0, x1, z1, color]) => { ctx.fillStyle = color; ctx.fillRect(px(x0), pz(z0), (x1 - x0) * sx, (z1 - z0) * sz); });
    // Gate: green when open, red when closed
    ctx.fillStyle = gateState.open > 0.5 ? '#51cf66' : '#fa5252';
    ctx.fillRect(px(-9.6) + gateState.open * 18 * sx, pz(25.6), 19.2 * sx, Math.max(2, 1 * sz));
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `${Math.max(9, Math.round(w / 45))}px Consolas, monospace`; ctx.textAlign = 'center';
    TOP_LABELS.forEach(([label, x, z]) => ctx.fillText(label, px(x), pz(z) + 4));
    ctx.textAlign = 'left';
    const me = avatarRef();
    if (me) {
      const center = districtCenter();
      const lx = me.position.x - center.x; const lz = me.position.z - center.z;
      if (Math.abs(lx) <= 110 && Math.abs(lz) <= 80) {
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.arc(px(lx), pz(lz), Math.max(4, w / 90), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillText(playerName(), px(lx) + 8, pz(lz) - 6);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, Math.max(16, h / 14));
    ctx.fillStyle = '#ff6b6b'; ctx.fillText(`REC  CAM-01  ${new Date().toLocaleTimeString('en-US', { hour12: false })}`, 8, Math.max(12, h / 20));
  }

  function openSecurityPanel() {
    showPanel('mb-security-panel', '<h2>Security camera</h2><p class="mb-sub">Top view of MetaBlock Estates. Red dot: you. Log of who entered the Residents Lane (stored on this device only).</p><canvas width="440" height="320"></canvas><h3>Who entered</h3><ul class="mb-log"></ul>', (panel, state) => {
      const canvas = panel.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const list = panel.querySelector('.mb-log');
      let frame = 0;
      const renderLog = () => {
        const log = readLog();
        list.innerHTML = log.length ? log.map((entry) => `<li>${new Date(entry.time).toLocaleString('en-US', { hour12: false })} · ${String(entry.name).replace(/[<>&]/g, '')} · ${entry.pass ? 'Resident pass' : 'visitor'}</li>`).join('') : '<li>No entries yet.</li>';
      };
      renderLog();
      const loop = () => {
        if (openPanel !== state) return;
        drawTopView(ctx, canvas.width, canvas.height);
        if (++frame % 60 === 0) renderLog();
        requestAnimationFrame(loop);
      };
      loop();
    });
  }

  function gate(group) {
    // Hedge wall with a sliding gate across the street and both sidewalks.
    // Token-gating replacement: instead of checking an NFT in a wallet, the gate
    // checks the in-game "MetaBlock Resident" pass (badge 'metablock-resident'
    // in localStorage 'multiverse-badges', granted at the Brokers Hub reception).
    hedge(group, 100.4, 2.4, 1.2, -59.8, 0);
    hedge(group, 100.4, 2.4, 1.2, 59.8, 0);
    hedge(group, 1.2, 2.4, 54, -109.4, 27);
    hedge(group, 1.2, 2.4, 54, 109.4, 27);
    hedge(group, 217.6, 2.4, 1.2, 0, 53.4);
    const pillarGlow = new THREE.MeshStandardMaterial({ color: '#fa5252', emissive: '#fa5252', emissiveIntensity: 1.6 });
    [-9.9, 9.9].forEach((x) => {
      group.add(slab(0.7, 3.2, 1.4, MAT.concrete(), x, 1.6, 0, 2));
      group.add(noRaycast(slab(0.06, 2.6, 0.06, pillarGlow, x - Math.sign(x) * 0.36, 1.6, -0.5, 1)));
    });
    const slats = canvasTexture('mb|gateSlats', 256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#1d1f22';
      for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 9, h);
      ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    });
    slats.wrapS = THREE.RepeatWrapping;
    slats.repeat.set(10, 1);
    const gatePanel = mesh(new THREE.BoxGeometry(19.2, 2.4, 0.12), new THREE.MeshStandardMaterial({ map: slats, transparent: true, alphaTest: 0.5, metalness: 0.6, roughness: 0.4 }), 0, 1.3, -0.8);
    group.add(gatePanel);
    group.add(slab(19.2, 0.08, 0.2, MAT.steel(), 0, 0.04, -0.8, 1)); // track
    const sign = textSprite('Residents Lane · MetaBlock Resident pass required', { width: 8, background: 'rgba(18, 20, 24, 0.85)' });
    sign.position.set(0, 4.2, -1);
    group.add(sign);
    // Security kiosk with a live monitor (south-east of the gate)
    const kiosk = new THREE.Group();
    kiosk.position.set(14.5, 0, -6);
    group.add(kiosk);
    kiosk.add(slab(3.6, 0.15, 3.2, MAT.whiteConcrete(), 0, 0.075, 0, 2));
    kiosk.add(slab(3.6, 2.9, 0.2, MAT.concrete(), 0, 1.6, 1.5, 2));
    kiosk.add(slab(0.2, 2.9, 3.2, MAT.concrete(), 1.7, 1.6, 0, 2));
    kiosk.add(slab(4.2, 0.25, 3.8, MAT.whiteConcrete(), 0.2, 3.15, 0.1, 2));
    kiosk.add(slab(2.2, 0.9, 0.6, MAT.wood(), 0.2, 0.6, 1.0, 1));
    const monitorCanvas = document.createElement('canvas');
    monitorCanvas.width = 256; monitorCanvas.height = 186;
    const monitorTexture = new THREE.CanvasTexture(monitorCanvas);
    const monitor = mesh(new THREE.PlaneGeometry(1.3, 0.95), new THREE.MeshBasicMaterial({ map: monitorTexture }), 0.2, 1.75, 1.38);
    monitor.rotation.y = Math.PI;
    kiosk.add(monitor);
    kiosk.add(slab(1.4, 1.05, 0.06, MAT.dark(), 0.2, 1.75, 1.42, 1));
    const camera3d = new THREE.Group();
    camera3d.position.set(9.9, 3.4, 0);
    camera3d.add(slab(0.5, 0.25, 0.25, MAT.paint('#e9ecef'), 0, 0, 0, 1));
    camera3d.add(noRaycast(sphere(0.04, MAT.glow('#ff3b3b', 2), -0.26, 0, 0, 6)));
    camera3d.rotation.y = 0.6;
    group.add(camera3d);
    const panelSpot = new THREE.Group();
    panelSpot.position.set(0.2, 1.2, 0.6);
    panelSpot.userData.prompt = 'Press E to open the security camera panel';
    panelSpot.userData.onInteract = () => { openSecurityPanel(); return null; };
    interactive(panelSpot, 'action', 'Security camera panel');
    kiosk.add(panelSpot);

    const local = new THREE.Vector3();
    let previousZ = null;
    let lastWarning = 0;
    let lastMonitor = 0;
    animate(group, (time) => {
      const me = avatarRef();
      let wantOpen = false;
      if (me) {
        local.copy(me.position);
        group.worldToLocal(local);
        const near = Math.abs(local.x) < 14 && Math.abs(local.z) < 12 && local.y < 4;
        wantOpen = near && hasPass();
        if (near && !hasPass() && local.z < 0 && local.z > -6 && Math.abs(local.x) < 10 && performance.now() - lastWarning > 9000) {
          lastWarning = performance.now();
          if (typeof appendSystemMessage === 'function') appendSystemMessage('Gate closed: the Residents Lane needs the MetaBlock Resident pass. Get it free at the Brokers Hub reception.');
        }
        // Who entered: crossing the gate line from the street side
        if (previousZ !== null && previousZ < 0 && local.z >= 0 && Math.abs(local.x) < 10.5 && local.y < 4) addLog({ name: playerName(), time: Date.now(), pass: hasPass() });
        previousZ = local.z;
      }
      gateState.open += ((wantOpen ? 1 : 0) - gateState.open) * 0.04;
      if (Math.abs(gateState.open - (wantOpen ? 1 : 0)) < 0.002) gateState.open = wantOpen ? 1 : 0;
      gatePanel.position.x = gateState.open * 19.6;
      pillarGlow.emissive.set(gateState.open > 0.5 ? '#51cf66' : '#fa5252');
      pillarGlow.color.copy(pillarGlow.emissive);
      camera3d.rotation.y = 0.6 + Math.sin(time * 0.4) * 0.5;
      if (time - lastMonitor > 0.5) {
        lastMonitor = time;
        drawTopView(monitorCanvas.getContext('2d'), monitorCanvas.width, monitorCanvas.height);
        monitorTexture.needsUpdate = true;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Brokers Hub
  // --------------------------------------------------------------------------
  const STUDIOS = [
    ['Northlight Atelier', 'Nordic timber pavilions', '#20394a', '#f2c879', 'timber',
      'Northlight Atelier designs low timber pavilions with deep roofs and long glass walls, tuned for Decentraland scenes of 2 to 4 parcels. Known for clean triangle budgets and baked lighting.'],
    ['Monolith & Moss', 'Concrete with green roofs', '#2d3330', '#9bd17a', 'monolith',
      'Monolith & Moss builds brutalist concrete villas softened by green roofs and hanging gardens. Every model ships with LODs and a material sheet.'],
    ['Parametric Habitat Co.', 'Computational facades', '#1d1b3a', '#a78bfa', 'parametric',
      'Parametric Habitat Co. generates facades with code: fins, lattices and perforated skins that stay inside strict entity limits thanks to merged meshes.'],
    ['Kiln Studio', 'Warm brick courtyards', '#3a2219', '#f4a261', 'kiln',
      'Kiln Studio specializes in courtyard houses in hand-laid brick, terracotta and lime plaster, with patios built for social events.'],
    ['Atrium Nine', 'Glass atriums and vertical gardens', '#0f2e2e', '#63e6be', 'atrium',
      'Atrium Nine designs offices and homes around tall glass atriums with vertical gardens, ideal for galleries and showrooms.']
  ];

  function posterTexture([name, tagline, bg, accent, style]) {
    return canvasTexture(`mb|poster|${name}`, 512, 384, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, bg); gradient.addColorStop(1, '#0d0f12');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.strokeStyle = accent; ctx.lineWidth = 3;
      const gy = 250;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, gy, w, 3);
      ctx.fillStyle = accent;
      if (style === 'timber') {
        ctx.beginPath(); ctx.moveTo(80, gy - 70); ctx.lineTo(430, gy - 90); ctx.lineTo(430, gy - 80); ctx.lineTo(80, gy - 60); ctx.fill();
        for (let x = 110; x < 420; x += 18) ctx.fillRect(x, gy - 62, 6, 62);
      } else if (style === 'monolith') {
        ctx.fillRect(90, gy - 100, 200, 100); ctx.fillRect(220, gy - 150, 210, 60);
        ctx.fillStyle = '#4caf50'; ctx.fillRect(220, gy - 160, 210, 12);
      } else if (style === 'parametric') {
        for (let i = 0; i < 26; i++) { const x = 90 + i * 13; const hh = 80 + Math.sin(i * 0.5) * 40; ctx.fillRect(x, gy - hh, 7, hh); }
      } else if (style === 'kiln') {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 14; c++) ctx.fillRect(100 + c * 22 + (r % 2) * 11, gy - 12 - r * 12, 19, 9);
        ctx.clearRect(200, gy - 60, 70, 60); ctx.fillStyle = bg; ctx.fillRect(200, gy - 60, 70, 60);
      } else {
        ctx.strokeRect(150, gy - 160, 210, 160);
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(150 + i * 52, gy); ctx.lineTo(150 + i * 52, gy - 160); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(150, gy - 160); ctx.lineTo(255, gy - 210); ctx.lineTo(360, gy - 160); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.font = '300 38px "Segoe UI", Arial, sans-serif'; ctx.fillText(name, 32, 306);
      ctx.fillStyle = accent; ctx.font = '20px "Segoe UI", Arial, sans-serif'; ctx.fillText(tagline, 32, 338);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px "Segoe UI", Arial, sans-serif'; ctx.fillText('PORTFOLIO  ·  PRESS E', 32, 366);
    });
  }

  function hub(group) {
    const W = 30; const D = 20; const H = 4.6;
    const glass = MAT.glass();
    const metal = MAT.metal();
    group.add(slab(W, 0.12, D, MAT.marble(), 0, 0.06, 0, 2.5));
    // Glass lobby walls with 3 m doors front (z-) and back (z+)
    [-1, 1].forEach((sz) => {
      group.add(slab(13.5, H, 0.08, glass, -8.25, H / 2, sz * (D / 2 - 0.1), 1));
      group.add(slab(13.5, H, 0.08, glass, 8.25, H / 2, sz * (D / 2 - 0.1), 1));
      group.add(slab(3, H - 3, 0.08, glass, 0, 3 + (H - 3) / 2, sz * (D / 2 - 0.1), 1));
      [-1.5, 1.5].forEach((x) => group.add(slab(0.12, H, 0.2, metal, x, H / 2, sz * (D / 2 - 0.1), 1)));
    });
    [-1, 1].forEach((sx) => group.add(slab(0.3, H, D, MAT.concrete(), sx * (W / 2 - 0.15), H / 2, 0, 3)));
    // Exterior vertical fins on the long facades
    for (let i = -6; i <= 6; i++) if (Math.abs(i) > 0) [-1, 1].forEach((sz) => group.add(slab(0.12, H + 9, 0.7, MAT.whiteConcrete(), i * 2.3, (H + 9) / 2, sz * (D / 2 + 0.4), 1)));
    // Office floors above the lobby, roof and the name sign
    const officeMats = [MAT.concrete(), MAT.concrete(), MAT.whiteConcrete(), MAT.whiteConcrete(), MAT.office(), MAT.office()];
    group.add(mesh(archGeometry(W, 8.4, D, 4.2), officeMats, 0, H + 0.2 + 4.2, 0));
    group.add(slab(W, 0.4, D, MAT.whiteConcrete(), 0, H, 0, 3));
    group.add(slab(W + 1.4, 0.5, D + 1.4, MAT.whiteConcrete(), 0, H + 8.85, 0, 3));
    const nameTexture = labelTexture('BROKERS HUB', { bg: '#1d1f22', fg: '#f1efe9', width: 1024, height: 200, font: '300 96px "Segoe UI", Arial, sans-serif' });
    [-1, 1].forEach((sz) => {
      const sign = mesh(new THREE.PlaneGeometry(9, 1.75), new THREE.MeshBasicMaterial({ map: nameTexture }), 0, H + 1.5, sz * (D / 2 + 0.82));
      if (sz > 0) sign.rotation.y = 0; else sign.rotation.y = Math.PI;
      group.add(sign);
    });
    // Ceiling LED panels
    for (let x = -10; x <= 10; x += 5) for (let z = -6; z <= 6; z += 6) group.add(noRaycast(slab(2.4, 0.04, 0.6, MAT.glow('#fff4e0', 1.3), x, H - 0.24, z, 1)));
    // Reception desk and feature wall
    group.add(slab(10, H - 0.2, 0.4, MAT.wood(), -6, (H - 0.2) / 2 + 0.1, 6.5, 2));
    const logo = mesh(new THREE.PlaneGeometry(5, 1), new THREE.MeshBasicMaterial({ map: labelTexture('MetaBlock Brokers', { bg: '#a06c42', fg: '#fff8ee', width: 1024, height: 200, font: '300 80px "Segoe UI", Arial, sans-serif' }) }), -6, 2.8, 6.29);
    logo.rotation.y = Math.PI;
    group.add(logo);
    const desk = new THREE.Group();
    desk.position.set(-6, 0, 4.2);
    desk.add(slab(5, 1.08, 0.9, MAT.whiteConcrete(), 0, 0.6, 0, 1));
    desk.add(slab(5.2, 0.05, 1.05, MAT.marble(), 0, 1.15, 0, 1));
    desk.add(noRaycast(slab(4.8, 0.03, 0.04, MAT.glow('#ffd49a', 1.8), 0, 0.12, -0.47, 1)));
    desk.add(slab(0.6, 0.4, 0.04, MAT.screen(), -1.2, 1.4, 0.2, 1));
    desk.add(cylinder(0.02, 0.02, 0.25, MAT.steel(), -1.2, 1.25, 0.24, 6));
    const welcome = textSprite('Reception · Resident pass', { width: 4, background: 'rgba(18, 20, 24, 0.85)' });
    welcome.position.set(0, 2.4, 0);
    desk.add(welcome);
    desk.userData.prompt = 'Press E to talk to the reception';
    desk.userData.onInteract = (hooks) => {
      const already = hasPass();
      grantPass();
      if (window.Sound) Sound.play('coin');
      hooks.inspect('MetaBlock Brokers Hub', `${already ? 'You already hold' : 'You now hold'} the MetaBlock Resident pass (an in-game badge, saved on this device). The Residents Lane gate north of the Hub will open for you. Hiring one of the builder studios on the murals happens off-platform: contact them through their own channels. There are no smart contracts, wallets or payments in the game.`);
      return already ? 'Reception: welcome back, resident.' : 'Reception: MetaBlock Resident pass granted. The Residents Lane gate will now open for you.';
    };
    interactive(desk, 'action', 'Brokers Hub reception');
    group.add(desk);
    // Portfolio murals (inspect)
    const murals = [[W / 2 - 0.32, -4, -Math.PI / 2], [W / 2 - 0.32, 3.5, -Math.PI / 2], [-W / 2 + 0.32, -4, Math.PI / 2], [-W / 2 + 0.32, 1.5, Math.PI / 2], [-6, 6.72, 0]];
    STUDIOS.forEach((studio, i) => {
      const [x, z, ry] = murals[i];
      const frame = new THREE.Group();
      frame.position.set(x, 2.3, z);
      frame.rotation.y = ry;
      frame.add(slab(4.2, 3.2, 0.06, MAT.dark(), 0, 0, 0, 1));
      frame.add(mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ map: posterTexture(studio) }), 0, 0, 0.035));
      frame.userData.label = `${studio[0]} - ${studio[1]}`;
      frame.userData.info = `${studio[5]} Hiring happens off-platform (no smart contracts in game).`;
      interactive(frame, 'inspect', studio[0]);
      group.add(frame);
    });
    // Lounge seating
    [[6, -4], [9, -4], [6, 3], [9, 3]].forEach(([x, z]) => {
      group.add(slab(1.0, 0.42, 0.9, MAT.fabric('#5c6670'), x, 0.33, z, 1));
      group.add(slab(1.0, 0.5, 0.2, MAT.fabric('#5c6670'), x, 0.7, z + 0.4, 1));
      group.add(seat(x, 0.54, z, 'Lounge chair', Math.PI));
    });
    group.add(slab(1.4, 0.4, 0.8, MAT.marble(), 7.5, 0.32, -0.5, 1));
    // Planters with small trees on the plaza
    [[-20, -14], [20, -14], [-20, 14], [20, 14]].forEach(([x, z]) => group.add(slab(2.4, 0.6, 2.4, MAT.concrete(), x, 0.3, z, 2)));
    trees(group, [[-20, -14, 0.9], [20, -14, 0.9], [-20, 14, 0.9], [20, 14, 0.9]], 41);
    group.userData.label = 'Brokers Hub';
  }

  PropKit.registerBuilder(/^mb_streetscape$/, 'mbStreetscape', streetscape);
  PropKit.registerBuilder(/^mb_mansion$/, 'mbMansion', mansion);
  PropKit.registerBuilder(/^mb_totem$/, 'mbTotem', totem);
  PropKit.registerBuilder(/^mb_garage$/, 'mbGarage', garage);
  PropKit.registerBuilder(/^mb_gate$/, 'mbGate', gate);
  PropKit.registerBuilder(/^mb_hub$/, 'mbHub', hub);

  return { buildGltf: (id) => (mansions.has(id) ? buildGltf(mansions.get(id)) : null), hasPass, grantPass, mansions, gateState, closePanel };
})();
