// ============================================================================
// GENESIS CITY MAP: DECENTRALAND-STYLE TOP VIEW OF EVERY PARCEL
// ============================================================================
// Press M to open it. Like Decentraland's map, everything is one grid of
// parcels: Genesis Plaza (red) in the middle, the districts as estates, the
// empty green parcels for sale all around them and a few long roads that
// stop at the estates. Owned parcels are purple. Drag to pan, scroll to zoom, hover a parcel to see its
// coordinates and status, click it to jump there or buy it (in-game MVC).
const CityMap = (() => {
  const DISTRICT_COLORS = ['#5f3dc4', '#1864ab', '#0b7285', '#2b8a3e', '#5c940d', '#e67700', '#d9480f', '#a61e4d', '#862e9c', '#364fc7', '#087f5b', '#495057'];
  let hooks = null;
  let overlay = null;
  let canvas = null;
  let base = null; // the static map, rendered once (2 px per meter)
  const BASE_SCALE = 2;
  const view = { x: 0, z: 0, scale: 0.5 };
  let hover = null;
  let selected = null;
  let drag = null;

  const parcelSize = () => City.PARCEL_SIZE;
  const limit = () => City.WORLD_LIMIT;

  function hash(a, b) {
    let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    h ^= h >>> 13;
    return ((h >>> 0) % 1000) / 1000;
  }

  // ---------------------------------------------------------------------------
  // Static layer: parcels, roads, the core with paths and districts
  // ---------------------------------------------------------------------------
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? r * 0.45 : r;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }

  function renderBase() {
    const size = limit() * 2 * BASE_SCALE;
    base = document.createElement('canvas');
    base.width = size;
    base.height = size;
    const ctx = base.getContext('2d');
    const toBase = (x, z) => [(x + limit()) * BASE_SCALE, (z + limit()) * BASE_SCALE];
    const step = parcelSize() * BASE_SCALE;
    const count = (limit() * 2) / parcelSize();
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        const px = i - count / 2;
        const pz = count / 2 - 1 - j; // parcel z grows to the north (-z)
        const [x, y] = [i * step, j * step];
        const cx = px * parcelSize() + parcelSize() / 2;
        const cz = -(pz * parcelSize() + parcelSize() / 2);
        const kind = City.landAt(cx, cz);
        if (kind === 'road') {
          ctx.fillStyle = '#c9c2b4';
          ctx.fillRect(x, y, step, step);
          continue;
        }
        const shade = hash(px, pz);
        ctx.fillStyle = `hsl(${100 + shade * 6}, ${44 + shade * 4}%, ${34 + hash(pz, px) * 3}%)`;
        ctx.fillRect(x, y, step, step);
        // Grass speckles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let k = 0; k < 3; k++) ctx.fillRect(x + hash(px + k, pz) * step, y + hash(px, pz + k) * step, 2, 2);
        // Parcel line (the stone edging seen in the world)
        ctx.strokeStyle = 'rgba(220, 214, 196, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, step - 1, step - 1);
      }
    }
    // Paths of the center
    ctx.strokeStyle = '#d6c7a8';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5 * BASE_SCALE;
    City.paths.forEach((path) => {
      ctx.beginPath();
      path.forEach(([x, z], index) => { const [mx, my] = toBase(x, z); if (index) ctx.lineTo(mx, my); else ctx.moveTo(mx, my); });
      ctx.stroke();
    });
    // Districts as estates: a paved border and rooftops seen from above
    City.districts.forEach((district, index) => {
      if (district.world.world) return; // separate worlds (Silicon Valley, Museum...) are not on the map
      const { center, size } = district.layout;
      const [x, y] = toBase(center.x - size[0] / 2, center.z - size[1] / 2);
      const w = size[0] * BASE_SCALE;
      const h = size[1] * BASE_SCALE;
      const plaza = district.world.key === 'plaza';
      ctx.fillStyle = '#c9c2b4';
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = plaza ? '#c0392b' : ['#3d5a80', '#5a3d80', '#2f6f4f', '#7a4b2a', '#4a4e69', '#22577a', '#6d597a'][index % 7];
      ctx.fillRect(x, y, w, h);
      const color = plaza ? '#ff8a5c' : DISTRICT_COLORS[index % DISTRICT_COLORS.length];
      for (let k = 0; k < (plaza ? 80 : 30); k++) {
        const bw = (0.06 + hash(index, k) * 0.18) * w;
        const bh = (0.06 + hash(k, index) * 0.18) * h;
        ctx.fillStyle = k % 4 === 0 ? '#f1f3f5' : k % 4 === 1 ? color : k % 4 === 2 ? '#adb5bd' : '#2b2d42';
        ctx.globalAlpha = 0.85;
        if (plaza && k % 3 === 0) {
          ctx.beginPath();
          ctx.arc(x + hash(index * 7, k) * w, y + hash(k * 7, index) * h, bw / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x + hash(index * 7, k) * (w - bw), y + hash(k * 7, index) * (h - bh), bw, bh);
      }
      ctx.globalAlpha = 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function toScreen(x, z) {
    return [(x - view.x) * view.scale + canvas.width / 2, (z - view.z) * view.scale + canvas.height / 2];
  }

  function toWorld(sx, sy) {
    return [(sx - canvas.width / 2) / view.scale + view.x, (sy - canvas.height / 2) / view.scale + view.z];
  }

  function parcelAt(x, z) {
    return [Math.floor(x / parcelSize()), Math.floor(-z / parcelSize())];
  }

  function parcelInfo(x, z) {
    const [px, pz] = parcelAt(x, z);
    const key = `${px},${pz}`;
    const district = City.districtAt(x, z);
    const kind = City.landAt(x, z);
    const owner = City.landOwner(key);
    let status;
    if (Math.abs(x) > limit() || Math.abs(z) > limit()) status = 'Outside Genesis City';
    else if (district) status = district.world.name;
    else if (kind === 'commons') status = owner ? `Owned by ${owner}` : 'Genesis City commons (buy at the PARCEL FOR SALE signs)';
    else if (kind === 'road') status = 'Road';
    else if (kind === 'scene') status = 'Community scene';
    else if (owner) status = `Owned by ${owner}`;
    else status = 'Empty parcel · for sale · 250 MVC';
    return { key, px, pz, x: px * parcelSize() + parcelSize() / 2, z: -(pz * parcelSize() + parcelSize() / 2), kind, owner, status, buyable: kind === 'land' && !owner };
  }

  function draw() {
    if (!overlay || overlay.style.display !== 'flex') return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#18191f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const [x0, y0] = toScreen(-limit(), -limit());
    const span = limit() * 2 * view.scale;
    ctx.imageSmoothingEnabled = view.scale < BASE_SCALE;
    ctx.drawImage(base, x0, y0, span, span);
    // Owned parcels
    Object.keys(City.landOwners).forEach((key) => {
      const [px, pz] = key.split(',').map(Number);
      const [sx, sy] = toScreen(px * parcelSize(), -(pz + 1) * parcelSize());
      const s = parcelSize() * view.scale;
      ctx.fillStyle = 'rgba(151, 117, 250, 0.85)';
      ctx.fillRect(sx, sy, s, s);
    });
    // Points of interest (every district)
    ctx.fillStyle = '#ff922b';
    City.districts.forEach((district) => {
      if (district.world.world) return;
      const [sx, sy] = toScreen(district.layout.center.x, district.layout.center.z);
      ctx.fillStyle = '#ffffff';
      star(ctx, sx, sy - 22, 9);
      ctx.fillStyle = '#ff922b';
      star(ctx, sx, sy - 22, 7);
    });
    // District names
    if (view.scale > 0.35) {
      ctx.font = `600 ${Math.max(10, Math.min(15, view.scale * 14))}px Segoe UI, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      City.districts.forEach((district) => {
        if (district.world.world) return;
        const [sx, sy] = toScreen(district.layout.center.x, district.layout.center.z);
        const label = district.world.name;
        const width = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(sx - width / 2, sy - 10, width, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, sx, sy);
      });
    }
    // Hovered and selected parcels
    [[hover, 'rgba(255, 255, 255, 0.9)'], [selected, '#ff6b6b']].forEach(([info, color]) => {
      if (!info) return;
      const [sx, sy] = toScreen(info.px * parcelSize(), -(info.pz + 1) * parcelSize());
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, parcelSize() * view.scale, parcelSize() * view.scale);
    });
    // Other devs and you
    hooks.peers().forEach(({ x, z, color }) => {
      const [sx, sy] = toScreen(x, z);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    const me = hooks.position();
    const [mx, my] = toScreen(me.x, me.z);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e03131'; ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
    overlay.querySelector('#citymap-coords').textContent = hover ? `${hover.key} · ${hover.status}` : 'Hover a parcel';
  }

  function showSelected() {
    const panel = overlay.querySelector('#citymap-selected');
    if (!selected) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    panel.querySelector('b').textContent = `Parcel ${selected.key}`;
    panel.querySelector('span').textContent = selected.status;
    panel.querySelector('[data-act="buy"]').style.display = selected.buyable ? '' : 'none';
  }

  // ---------------------------------------------------------------------------
  // Overlay and input
  // ---------------------------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, Math.round(rect.width));
    canvas.height = Math.max(200, Math.round(rect.height));
    draw();
  }

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'citymap-overlay';
    overlay.innerHTML = `
      <header><b>Genesis City</b><span id="citymap-coords"></span>
        <span class="citymap-legend"><i style="background:#c0392b"></i>Genesis Plaza <i style="background:#3d5a80"></i>Districts <i style="background:#5f9e3f"></i>Empty parcels <i style="background:#c9c2b4"></i>Roads <i style="background:#9775fa"></i>Owned</span>
        <button type="button" data-act="3d">3D view</button><button type="button" data-act="close" aria-label="Close">&times;</button></header>
      <canvas id="citymap-canvas"></canvas>
      <div id="citymap-selected"><b></b><span></span><div><button type="button" data-act="jump">Jump here</button><button type="button" data-act="buy">Buy · 250 MVC</button></div></div>`;
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('canvas');
    overlay.querySelector('[data-act="close"]').addEventListener('click', close);
    overlay.querySelector('[data-act="3d"]').addEventListener('click', () => { close(); hooks.overheadView(); });
    overlay.querySelector('[data-act="jump"]').addEventListener('click', () => { if (!selected) return; close(); hooks.jumpTo(selected.x, selected.z); });
    overlay.querySelector('[data-act="buy"]').addEventListener('click', () => { if (selected && selected.buyable) hooks.buy(selected.key); });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const [wx, wz] = toWorld(event.offsetX, event.offsetY);
      view.scale = Math.min(8, Math.max(0.2, view.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2)));
      // Zoom around the pointer
      const [nx, nz] = toWorld(event.offsetX, event.offsetY);
      view.x += wx - nx;
      view.z += wz - nz;
      draw();
    }, { passive: false });
    canvas.addEventListener('pointerdown', (event) => { drag = { x: event.clientX, y: event.clientY, vx: view.x, vz: view.z, moved: false }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', (event) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        view.x = drag.vx - dx / view.scale;
        view.z = drag.vz - dy / view.scale;
      }
      const [wx, wz] = toWorld(event.offsetX, event.offsetY);
      hover = parcelInfo(wx, wz);
      draw();
    });
    canvas.addEventListener('pointerup', (event) => {
      const clicked = drag && !drag.moved;
      drag = null;
      if (!clicked) return;
      const [wx, wz] = toWorld(event.offsetX, event.offsetY);
      selected = parcelInfo(wx, wz);
      showSelected();
      draw();
    });
    window.addEventListener('resize', () => { if (isOpen()) resize(); });
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && isOpen()) close(); });
  }

  function open() {
    if (!overlay) build();
    if (!base) renderBase();
    const me = hooks.position();
    view.x = me.x;
    view.z = me.z;
    view.scale = 1.1;
    selected = null;
    showSelected();
    overlay.style.display = 'flex';
    hooks.releaseKeys();
    resize();
  }

  function close() {
    if (overlay) overlay.style.display = 'none';
  }

  function isOpen() {
    return Boolean(overlay) && overlay.style.display === 'flex';
  }

  function toggle() {
    if (isOpen()) close(); else open();
  }

  function init(options) {
    hooks = options;
  }

  // Owned parcels change while the map is open
  function refresh() {
    if (isOpen()) draw();
  }

  return { init, open, close, toggle, isOpen, refresh, parcelInfo };
})();
