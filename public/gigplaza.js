// ============================================================================
// THE GIG PLAZA: AN UNDERGROUND DISTRICT OF FUN MINI-JOBS (ROBLOX STYLE)
// ============================================================================
// Reached from the Genesis Plaza underground: the Hall of Internet History
// corridor has a door to a tunnel (gig_tunnel) that ends in a 50 x 50 m cavern
// (gig_plaza) with a central square and lively shops:
// - Pixel Pizza (pixel-art pizzeria) and the Gig Kitchen: Dough -> Toppings ->
//   Oven (timer) -> Packing, each station used with E, in order
// - Brew Lab (glass coffee shop): Grind -> Espresso (timer) -> Milk -> Cup & lid
// - Gig Mart 24/7 (neon convenience store) with The Reward Shop inside
// - Delivery Depot with a hover-bike: E at the dispatch terminal starts a
//   delivery; a glowing drop-off marker appears next to MetaBlock Estates and
//   reaching it (6 m) pays out.
// Rewards are "Gig Tokens": an in-game counter only (no money, no crypto),
// saved in localStorage (multiverse-gig-tokens). Purchases are recorded in
// localStorage too; outfits are a temporary tint of the player's cursor.
// Cooking state is local to each player (stations can be shared visually).
(() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, canvasTexture, repeated, plankTexture, mergeByMaterial } = PropKit.kit;

  // --------------------------------------------------------------------------
  // Persistence (always wrapped: storage can be blocked)
  // --------------------------------------------------------------------------
  const KEYS = { tokens: 'multiverse-gig-tokens', owned: 'multiverse-gig-owned', petFood: 'multiverse-gig-petfood', outfit: 'multiverse-gig-outfit' };
  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (error) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage unavailable */ }
  }
  const getTokens = () => Math.max(0, parseInt(load(KEYS.tokens, 0), 10) || 0);
  const setTokens = (value) => { save(KEYS.tokens, Math.max(0, Math.floor(value))); updateHud(); };

  function say(message) {
    if (typeof appendSystemMessage === 'function') appendSystemMessage(message);
  }
  function sound(name) {
    try { if (window.Sound) Sound.play(name); } catch (error) { /* no audio */ }
  }

  // --------------------------------------------------------------------------
  // Recipes and local job state
  // --------------------------------------------------------------------------
  const RECIPES = {
    pizza: {
      name: 'pizza', reward: 12,
      steps: [
        { label: 'Dough', done: 'You knead and stretch the dough into a round base.' },
        { label: 'Toppings', done: 'Tomato sauce, mozzarella and basil. Looking good!' },
        { label: 'Oven', timer: 5, start: 'Into the oven! Baking for 5 seconds...', ready: 'Ding! The pizza is baked. Press E at the oven to take it out.', done: 'You slide the hot pizza out of the oven.' },
        { label: 'Packing', done: 'Boxed and sealed. Take it to the Delivery Depot terminal (E).' }
      ]
    },
    coffee: {
      name: 'coffee', reward: 8,
      steps: [
        { label: 'Grind', done: 'Fresh beans ground. It smells amazing.' },
        { label: 'Espresso', timer: 4, start: 'Pulling the espresso shot: 4 seconds...', ready: 'The shot is ready. Press E at the espresso machine to take it.', done: 'A perfect crema. Shot pulled.' },
        { label: 'Milk', done: 'Silky steamed milk poured with a little heart on top.' },
        { label: 'Cup & lid', done: 'Lid on, sleeve on. Take it to the Delivery Depot terminal (E).' }
      ]
    }
  };
  const state = { recipe: null, step: 0, timerEnd: 0, timerAnnounced: false, carrying: null, delivery: null, cancelArmedAt: 0 };
  const stations = []; // { recipe, index, lamp, spot }
  const items = {}; // per recipe: { object, setStage(stage) }
  let gigRoot = null;
  let gigSize = [50, 10, 50];
  let deliveryBoard = null;

  function nextStepLabel() {
    if (state.delivery) return 'Delivering to MetaBlock Estates';
    if (state.carrying) return `Carrying a ${RECIPES[state.carrying].name}: go to the Delivery Depot`;
    if (!state.recipe) return 'No job: start at a Kitchen or Brew Lab station 1';
    const step = RECIPES[state.recipe].steps[state.step];
    if (state.timerEnd) return performance.now() < state.timerEnd ? `${step.label}: ${Math.ceil((state.timerEnd - performance.now()) / 1000)} s left` : `${step.label}: ready, press E`;
    return `${RECIPES[state.recipe].name}: next ${state.step + 1}. ${step.label}`;
  }

  function refreshVisuals() {
    stations.forEach((station) => {
      const active = state.recipe === station.recipe;
      const next = active ? state.step === station.index : !state.recipe && !state.carrying && !state.delivery && station.index === 0;
      const done = active && station.index < state.step;
      const color = state.timerEnd && active && next ? '#ff922b' : next ? '#ffd43b' : done ? '#51cf66' : '#495057';
      station.lamp.color.set(color);
      station.lamp.emissive.set(color);
      station.lamp.emissiveIntensity = next || done ? 1.6 : 0.2;
    });
    Object.keys(items).forEach((recipe) => {
      const item = items[recipe];
      if (state.recipe === recipe) {
        const station = stations.find((s) => s.recipe === recipe && s.index === (state.timerEnd ? state.step : Math.max(0, state.step - 1)));
        item.setStage(state.step, station);
      } else if (state.carrying === recipe) {
        item.setStage(RECIPES[recipe].steps.length, stations.find((s) => s.recipe === recipe && s.index === RECIPES[recipe].steps.length - 1));
      } else item.setStage(-1);
    });
    drawDeliveryBoard();
    updateHud();
  }

  function useStation(recipeKey, index) {
    const recipe = RECIPES[recipeKey];
    const step = recipe.steps[index];
    if (state.delivery) return `You are out on a delivery: follow the glowing marker near MetaBlock Estates (${deliveryDistance()} m).`;
    if (state.carrying) return `You are carrying a packed ${RECIPES[state.carrying].name}. Take it to the Delivery Depot terminal first.`;
    if (state.recipe && state.recipe !== recipeKey) return `You are making a ${RECIPES[state.recipe].name}. Finish it, or drop it in the bin to start over.`;
    if (!state.recipe) {
      if (index !== 0) return `Start at station 1 (${recipe.steps[0].label}). Every step must follow the order.`;
      state.recipe = recipeKey;
      state.step = 0;
    }
    if (index !== state.step) return `Wrong order! Next step is ${state.step + 1}. ${recipe.steps[state.step].label}.`;
    if (step.timer) {
      if (!state.timerEnd) {
        state.timerEnd = performance.now() + step.timer * 1000;
        state.timerAnnounced = false;
        sound('click');
        refreshVisuals();
        return step.start;
      }
      if (performance.now() < state.timerEnd) return `Still cooking... ${((state.timerEnd - performance.now()) / 1000).toFixed(1)} s left.`;
      state.timerEnd = 0;
    }
    state.step += 1;
    if (state.step >= recipe.steps.length) {
      state.carrying = recipeKey;
      state.recipe = null;
      state.step = 0;
    }
    sound('click');
    refreshVisuals();
    return step.done;
  }

  function discardJob() {
    if (!state.recipe && !state.carrying) return 'The bin is empty. Nothing to throw away.';
    const what = RECIPES[state.recipe || state.carrying].name;
    state.recipe = null; state.step = 0; state.timerEnd = 0; state.carrying = null;
    refreshVisuals();
    return `You threw the ${what} away. Start again at station 1.`;
  }

  // --------------------------------------------------------------------------
  // Delivery to MetaBlock Estates
  // --------------------------------------------------------------------------
  let marker = null;
  function dropOffPoint() {
    const districts = (window.City && City.districts) || [];
    const target = districts.find((d) => d.world.key === 'metablock');
    if (!target) return null;
    const center = target.layout.center;
    const [sizeX, sizeZ] = target.layout.size;
    const plaza = districts.find((d) => d.world.key === 'plaza');
    const from = plaza ? plaza.layout.center : new THREE.Vector3();
    const dx = from.x - center.x;
    const dz = from.z - center.z;
    // On the road at the edge of MetaBlock Estates that faces Genesis Plaza
    const point = Math.abs(dx) > Math.abs(dz)
      ? new THREE.Vector3(center.x + Math.sign(dx || 1) * (sizeX / 2 + 3), center.y, center.z)
      : new THREE.Vector3(center.x, center.y, center.z + Math.sign(dz || 1) * (sizeZ / 2 + 3));
    try {
      if (typeof groundHeightAt === 'function') {
        const ground = groundHeightAt(point.x, point.z, center.y + 80);
        if (Number.isFinite(ground)) point.y = ground;
      }
    } catch (error) { /* keep the district elevation */ }
    return point;
  }

  function buildMarker(point) {
    const group = new THREE.Group();
    const beamMaterial = new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 24, 1, true), beamMaterial);
    beam.position.y = 30;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.12;
    const parcel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#c08457' }));
    parcel.position.y = 3;
    const label = PropKit.kit.textSprite('GIG DELIVERY DROP-OFF', { width: 8, background: 'rgba(255, 159, 28, 0.92)', color: '#1a1a1a' });
    label.position.y = 6;
    [beam, ring, disc, parcel].forEach((part) => { part.raycast = () => {}; part.castShadow = false; group.add(part); });
    group.add(label);
    group.position.copy(point);
    group.userData = { ring, parcel };
    return group;
  }

  function startDelivery() {
    const point = dropOffPoint();
    if (!point) return 'MetaBlock Estates cannot be found on the map right now. Try again later.';
    if (typeof scene === 'undefined') return 'The dispatch system is offline.';
    marker = buildMarker(point);
    scene.add(marker);
    state.delivery = { recipe: state.carrying, startedAt: performance.now(), point };
    state.carrying = null;
    sound('teleport');
    refreshVisuals();
    animateMarker();
    return `Order dispatched! Hop on any ride (or fly) to the glowing drop-off next to MetaBlock Estates, ${deliveryDistance()} m away. Fast deliveries earn a bonus.`;
  }

  function deliveryDistance() {
    if (!state.delivery || typeof avatar === 'undefined') return 0;
    return Math.round(Math.hypot(avatar.position.x - state.delivery.point.x, avatar.position.z - state.delivery.point.z));
  }

  function clearMarker() {
    if (marker && marker.parent) marker.parent.remove(marker);
    marker = null;
  }

  function completeDelivery() {
    const recipe = RECIPES[state.delivery.recipe];
    const seconds = (performance.now() - state.delivery.startedAt) / 1000;
    const bonus = seconds < 150 ? 4 : 0;
    const earned = recipe.reward + bonus;
    setTokens(getTokens() + earned);
    clearMarker();
    state.delivery = null;
    sound('coin');
    say(`Delivered the ${recipe.name} in ${Math.round(seconds)} s! +${earned} Gig Tokens${bonus ? ` (fast bonus +${bonus})` : ''}. Balance: ${getTokens()}.`);
    refreshVisuals();
  }

  function useTerminal() {
    if (state.delivery) {
      if (performance.now() - state.cancelArmedAt < 4000) {
        clearMarker();
        state.delivery = null;
        refreshVisuals();
        return 'Delivery cancelled. The order went back to the kitchen (no tokens).';
      }
      state.cancelArmedAt = performance.now();
      return `Delivery in progress: ${deliveryDistance()} m to the drop-off. Press E again within 4 s to cancel it.`;
    }
    if (state.carrying) return startDelivery();
    if (state.recipe) return `The ${RECIPES[state.recipe].name} is not ready yet: next step ${state.step + 1}. ${RECIPES[state.recipe].steps[state.step].label}.`;
    return 'No order to deliver. Make a pizza in the Gig Kitchen or a coffee in the Brew Lab first.';
  }

  function animateMarker() {
    if (!marker) return;
    const time = performance.now() / 1000;
    marker.userData.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
    marker.userData.parcel.rotation.y = time;
    marker.userData.parcel.position.y = 3 + Math.sin(time * 2) * 0.4;
    requestAnimationFrame(animateMarker);
  }

  // --------------------------------------------------------------------------
  // The Reward Shop
  // --------------------------------------------------------------------------
  const SHOP = [
    { id: 'lava-lamp', kind: 'furniture', name: 'Neon Lava Lamp', price: 15, color: '#ff6bd6' },
    { id: 'beanbag', kind: 'furniture', name: 'Beanbag Chair', price: 25, color: '#ff922b' },
    { id: 'mini-arcade', kind: 'furniture', name: 'Mini Arcade Cabinet', price: 40, color: '#4dabf7' },
    { id: 'bonsai', kind: 'furniture', name: 'Desk Bonsai', price: 10, color: '#51cf66' },
    { id: 'outfit-cyan', kind: 'outfit', name: 'Neon Cyan Look (5 min)', price: 8, color: '#22d3ee' },
    { id: 'outfit-gold', kind: 'outfit', name: 'Golden Hour Look (5 min)', price: 12, color: '#fcc419' },
    { id: 'outfit-green', kind: 'outfit', name: 'Hacker Green Look (5 min)', price: 8, color: '#40c057' },
    { id: 'kibble', kind: 'petfood', name: 'Pet Kibble Pack', price: 5, color: '#c08457' },
    { id: 'fish-treats', kind: 'petfood', name: 'Premium Fish Treats', price: 7, color: '#74c0fc' }
  ];
  const tint = { original: null, applied: null };

  function cursorArrow() {
    try { return typeof localCursor !== 'undefined' && localCursor && localCursor.mesh && localCursor.mesh.userData.arrowMesh; } catch (error) { return null; }
  }
  function applyTint(color) {
    const arrow = cursorArrow();
    if (!arrow) return false;
    if (!tint.original || tint.applied !== arrow) tint.original = { color: `#${arrow.material.color.getHexString()}`, emissive: `#${arrow.material.emissive.getHexString()}` };
    arrow.material.color.set(color);
    arrow.material.emissive.set(color);
    tint.applied = arrow;
    return true;
  }
  function clearTint() {
    const arrow = cursorArrow();
    if (arrow && tint.original && tint.applied === arrow) { arrow.material.color.set(tint.original.color); arrow.material.emissive.set(tint.original.emissive); }
    tint.applied = null;
    tint.original = null;
  }

  function buy(item) {
    const tokens = getTokens();
    const owned = load(KEYS.owned, []);
    if (item.kind === 'furniture' && owned.includes(item.id)) return `You already own the ${item.name}.`;
    if (tokens < item.price) return `Not enough Gig Tokens: the ${item.name} costs ${item.price}, you have ${tokens}. Cook and deliver to earn more!`;
    setTokens(tokens - item.price);
    sound('coin');
    if (item.kind === 'furniture') {
      owned.push(item.id);
      save(KEYS.owned, owned);
      return `You bought the ${item.name} for ${item.price} Gig Tokens. It is saved in your furniture inventory.`;
    }
    if (item.kind === 'outfit') {
      save(KEYS.outfit, { color: item.color, until: Date.now() + 5 * 60 * 1000, name: item.name });
      const applied = applyTint(item.color);
      return applied ? `Looking sharp! ${item.name} applied to your avatar for 5 minutes.` : `${item.name} bought: it will show on your avatar for 5 minutes.`;
    }
    const food = load(KEYS.petFood, {});
    food[item.id] = (food[item.id] || 0) + 1;
    save(KEYS.petFood, food);
    return `You bought ${item.name} (you have ${food[item.id]}). Your pets will love it.`;
  }

  // --------------------------------------------------------------------------
  // HUD shown while inside the Gig Plaza (or during a job)
  // --------------------------------------------------------------------------
  let hud = null;
  function ensureHud() {
    if (hud || typeof document === 'undefined') return hud;
    hud = document.createElement('div');
    hud.id = 'gig-hud';
    hud.style.cssText = 'position:fixed;top:72px;right:16px;z-index:40;min-width:200px;max-width:280px;padding:10px 14px;border-radius:12px;background:rgba(20,16,30,0.86);border:2px solid #ff9f1c;color:#fff;font:600 13px/1.4 Segoe UI,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.35);display:none;pointer-events:none';
    hud.innerHTML = '<div style="color:#ff9f1c;font-size:11px;letter-spacing:1px">THE GIG PLAZA</div><div style="font-size:20px"><span id="gig-hud-tokens">0</span> <span style="font-size:12px;color:#ffd43b">GIG TOKENS</span></div><div id="gig-hud-job" style="color:#ced4da;font-weight:500"></div>';
    document.body.appendChild(hud);
    return hud;
  }
  function insideGigPlaza() {
    if (!gigRoot || !gigRoot.parent || typeof avatar === 'undefined') return false;
    const center = gigRoot.getWorldPosition(new THREE.Vector3());
    const p = avatar.position;
    return Math.abs(p.x - center.x) < gigSize[0] / 2 + 1 && Math.abs(p.z - center.z) < gigSize[2] / 2 + 1 && p.y > center.y - 3 && p.y < center.y + gigSize[1] + 2;
  }
  function updateHud() {
    if (!ensureHud()) return;
    const visible = insideGigPlaza() || state.delivery || state.carrying || state.recipe;
    hud.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    hud.querySelector('#gig-hud-tokens').textContent = getTokens();
    hud.querySelector('#gig-hud-job').textContent = state.delivery ? `Delivery: ${deliveryDistance()} m to the drop-off` : nextStepLabel();
  }

  // Background loop: timers, delivery arrival, outfit expiry, HUD
  setInterval(() => {
    if (state.timerEnd && !state.timerAnnounced && performance.now() >= state.timerEnd) {
      state.timerAnnounced = true;
      const recipe = RECIPES[state.recipe];
      if (recipe) { say(recipe.steps[state.step].ready); sound('coin'); }
      refreshVisuals();
    }
    if (state.delivery && typeof avatar !== 'undefined') {
      const p = state.delivery.point;
      if (Math.hypot(avatar.position.x - p.x, avatar.position.z - p.z) <= 6 && Math.abs(avatar.position.y - p.y) < 10) completeDelivery();
    }
    const outfit = load(KEYS.outfit, null);
    if (outfit && outfit.until <= Date.now()) {
      save(KEYS.outfit, null);
      clearTint();
      say('Your temporary Gig Plaza look wore off.');
    } else if (outfit && !tint.applied) applyTint(outfit.color);
    updateHud();
  }, 250);

  // --------------------------------------------------------------------------
  // Canvas textures (all drawn in code)
  // --------------------------------------------------------------------------
  function noise(ctx, w, h, count, alpha) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${((i * 13) % 7) * alpha})`;
      ctx.fillRect((i * 37) % w, (i * 91) % h, 2, 2);
    }
  }
  const floorTiles = () => canvasTexture('gig|tiles', 512, 512, (ctx, w, h) => {
    const tile = 64;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const v = 150 + ((x * 7 + y * 3) % 23);
        ctx.fillStyle = `rgb(${v}, ${v - 6}, ${v - 14})`;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    noise(ctx, w, h, 4000, 0.012);
    ctx.fillStyle = '#5c544a';
    for (let i = 0; i <= w; i += tile) { ctx.fillRect(i - 1, 0, 3, h); ctx.fillRect(0, i - 1, w, 3); }
  });
  const checkerTiles = () => canvasTexture('gig|checker', 256, 256, (ctx, w, h) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#1f1f1f' : '#eeeeee'; ctx.fillRect(x * 32, y * 32, 32, 32); }
    noise(ctx, w, h, 1200, 0.01);
  });
  const subwayTiles = () => canvasTexture('gig|subway', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9ced3'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 64 + (row % 2) * 32;
        ctx.fillStyle = '#f4f6f8'; ctx.fillRect(x + 2, row * 16 + 2, 60, 12);
      }
    }
  });
  const concrete = () => canvasTexture('gig|concrete', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6c6f73'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 6000, 0.02);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, 0, 2, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    [[40, 40], [216, 40], [40, 216], [216, 216]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });
  });

  // Pixel-art sign: drawn small, scaled up without smoothing
  function pixelSign(key, text, bg, fg, draw) {
    const texture = canvasTexture(`gigpix|${key}`, 512, 128, (ctx, w, h) => {
      const small = document.createElement('canvas');
      small.width = 128; small.height = 32;
      const s = small.getContext('2d');
      s.fillStyle = bg; s.fillRect(0, 0, 128, 32);
      s.fillStyle = fg; s.font = 'bold 13px monospace'; s.textBaseline = 'middle';
      s.fillText(text, 34, 17);
      if (draw) draw(s);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, w, h);
    });
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }
  const pizzaSign = () => pixelSign('pizza', 'PIXEL PIZZA', '#7a1010', '#ffe066', (s) => {
    // Pixel slice of pizza
    const px = [[2, 0, '#f2a93b'], [3, 0, '#f2a93b'], [4, 0, '#f2a93b'], [5, 0, '#f2a93b'], [6, 0, '#f2a93b'], [7, 0, '#f2a93b'], [3, 1, '#ffd43b'], [4, 1, '#e03131'], [5, 1, '#ffd43b'], [6, 1, '#ffd43b'], [3, 2, '#ffd43b'], [4, 2, '#ffd43b'], [5, 2, '#e03131'], [4, 3, '#ffd43b'], [5, 3, '#ffd43b'], [4, 4, '#ffd43b']];
    px.forEach(([x, y, color]) => { s.fillStyle = color; s.fillRect(8 + x * 2, 6 + y * 4, 2, 4); });
  });
  const pizzaMenu = () => {
    const texture = canvasTexture('gig|pizzamenu', 256, 192, (ctx, w, h) => {
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe066'; ctx.font = 'bold 18px monospace'; ctx.fillText('== MENU ==', 70, 26);
      ctx.font = '14px monospace';
      [['MARGHERITA', '#ffffff'], ['PEPPERONI', '#ffffff'], ['8-BIT VEGGIE', '#ffffff'], ['QUATTRO BYTES', '#ffffff'], ['GARLIC KNOTS', '#ffffff']].forEach(([name, color], i) => { ctx.fillStyle = color; ctx.fillText(name, 16, 58 + i * 24); ctx.fillStyle = '#69db7c'; ctx.fillText(`${3 + i} GT`, 200, 58 + i * 24); });
      ctx.fillStyle = '#ff6b6b'; ctx.fillText('JOBS: ASK THE KITCHEN', 30, 182);
    });
    texture.magFilter = THREE.NearestFilter;
    return texture;
  };
  const neonSign = (key, text, color, bg = '#0b0614', size = 70) => canvasTexture(`gigneon|${key}`, 1024, 192, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${size}px Arial Black, Arial, sans-serif`;
    ctx.shadowColor = color; ctx.shadowBlur = 30; ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2); ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillText(text, w / 2, h / 2);
  });
  const cleanSign = (key, title, subtitle, bg, fg, accent) => canvasTexture(`gigclean|${key}`, 1024, 192, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent; ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = fg; ctx.textAlign = 'center';
    ctx.font = '300 84px Helvetica Neue, Segoe UI, Arial, sans-serif'; ctx.fillText(title, w / 2, 104);
    ctx.font = '28px Segoe UI, Arial'; ctx.fillStyle = accent; ctx.fillText(subtitle, w / 2, 152);
  });
  const coffeeMenu = () => canvasTexture('gig|coffeemenu', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#26302b'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#f1f3f5'; ctx.font = 'italic 24px Georgia'; ctx.fillText('Brew Lab', 70, 40);
    ctx.font = '15px Georgia';
    ['Espresso', 'Flat white', 'Cortado', 'Cold brew', 'Oat latte', 'Debug mocha'].forEach((item, i) => { ctx.fillStyle = '#f1f3f5'; ctx.fillText(item, 24, 80 + i * 27); ctx.fillStyle = '#c9a227'; ctx.fillText(`${2 + (i % 3)} GT`, 190, 80 + i * 27); });
  });
  const stationSign = (number, label, bg) => canvasTexture(`gigstation|${number}|${label}|${bg}`, 256, 96, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(46, 48, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(number), 46, 61);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = 'bold 28px Arial'; ctx.fillText(label.toUpperCase(), 90, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '14px Arial'; ctx.fillText('press E', 90, 82);
  });
  const priceTag = (item) => canvasTexture(`gigprice|${item.id}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fff9db'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = item.color; ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    const words = item.name.split(' (')[0];
    ctx.fillText(words, w / 2, 52);
    ctx.font = '14px Arial'; ctx.fillStyle = '#495057'; ctx.fillText(item.kind === 'outfit' ? 'temporary look · 5 min' : item.kind === 'petfood' ? 'pet food' : 'furniture', w / 2, 76);
    ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#e8590c'; ctx.fillText(`${item.price} GT`, w / 2, 110);
  });
  const gigBoard = () => canvasTexture('gig|board', 512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#1a1424'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff9f1c'; ctx.font = 'bold 36px Arial'; ctx.fillText('GIG BOARD', 24, 48);
    ctx.fillStyle = '#ffffff'; ctx.font = '19px Arial';
    ['1. Pick a job: Gig Kitchen (pizza) or', '    Brew Lab (coffee).', '2. Use stations 1 to 4 in order (E).', '    The oven / espresso has a timer.', '3. E at the Delivery Depot terminal.', '4. Reach the drop-off marker next to', '    MetaBlock Estates (any ride works).', '5. Spend Gig Tokens at the Reward Shop', '    inside Gig Mart.'].forEach((line, i) => ctx.fillText(line, 24, 92 + i * 30));
  });
  const hazard = () => canvasTexture('gig|hazard', 128, 32, (ctx, w, h) => {
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    for (let x = -32; x < w + 32; x += 32) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 16, h); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 0); ctx.fill(); }
  });
  const shelfProducts = () => canvasTexture('gig|products', 256, 128, (ctx, w, h) => {
    const colors = ['#e03131', '#1971c2', '#f08c00', '#2f9e44', '#ae3ec9', '#fcc419', '#0ca678', '#f06595'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(i * 16 + 1, 20 + (i % 3) * 8, 14, 108 - (i % 3) * 8);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(i * 16 + 3, 50, 10, 12);
    }
  });

  // Live delivery board on the depot wall
  function drawDeliveryBoard() {
    if (!deliveryBoard) return;
    const { canvas, texture } = deliveryBoard;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff9f1c'; ctx.font = 'bold 30px Arial'; ctx.fillText('DISPATCH', 20, 40);
    ctx.fillStyle = '#69db7c'; ctx.font = '22px Courier New';
    const lines = state.delivery
      ? [`OUT FOR DELIVERY: ${RECIPES[state.delivery.recipe].name.toUpperCase()}`, 'DESTINATION: METABLOCK ESTATES', 'FOLLOW THE ORANGE BEAM']
      : state.carrying
        ? [`READY: 1 ${RECIPES[state.carrying].name.toUpperCase()}`, 'PRESS E AT THE TERMINAL', 'TO START THE DELIVERY']
        : ['NO PACKAGES WAITING', 'COOK A PIZZA OR BREW', 'A COFFEE TO EARN TOKENS'];
    lines.forEach((line, i) => ctx.fillText(line, 20, 90 + i * 34));
    ctx.fillStyle = '#ffd43b'; ctx.fillText(`PIZZA ${RECIPES.pizza.reward} GT · COFFEE ${RECIPES.coffee.reward} GT`, 20, 220);
    texture.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Building helpers
  // --------------------------------------------------------------------------
  function plane(texture, w, h, x, y, z, rotationY = 0, options = {}) {
    const result = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, ...options }), x, y, z);
    result.rotation.y = rotationY;
    result.castShadow = false;
    return result;
  }
  function noRaycast(object) { object.raycast = () => {}; object.castShadow = false; return object; }

  // Shop shell in a local frame whose front faces +z. Returns { statics, live, frame }:
  // add static parts to statics (merged later) and interactive ones to live.
  function shopShell(decor, group, { x, z, rotationY, width, depth, height = 4.6, wall, door = 4, doorAt = 0, skip = [], glass = false, roof }) {
    const statics = new THREE.Group();
    const live = new THREE.Group();
    [statics, live].forEach((g) => { g.position.set(x, 0, z); g.rotation.y = rotationY; });
    const hw = width / 2;
    const hd = depth / 2;
    if (!skip.includes('back')) statics.add(box(width, height, 0.3, wall, 0, height / 2, -hd));
    if (!skip.includes('left')) statics.add(box(0.3, height, depth, wall, -hw, height / 2, 0));
    if (!skip.includes('right')) statics.add(box(0.3, height, depth, wall, hw, height / 2, 0));
    const doorLeft = doorAt - door / 2;
    const doorRight = doorAt + door / 2;
    const frontParts = [[-hw, doorLeft], [doorRight, hw]];
    if (glass) {
      const pane = material('#cfe8ff', { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3 });
      const metal = material('#2b2f33', { metalness: 0.8, roughness: 0.3 });
      frontParts.forEach(([a, b]) => {
        if (b - a <= 0.05) return;
        const glassPane = box(b - a, height - 0.3, 0.06, pane, (a + b) / 2, (height - 0.3) / 2 + 0.15, hd);
        glassPane.castShadow = false;
        live.add(glassPane);
        for (let m = a; m <= b + 0.01; m += (b - a) / Math.max(1, Math.round((b - a) / 1.6))) statics.add(box(0.08, height, 0.12, metal, m, height / 2, hd));
      });
      statics.add(box(width, 0.2, 0.14, metal, 0, 0.1, hd));
      statics.add(box(width, 0.35, 0.3, metal, 0, height - 0.15, hd));
    } else {
      frontParts.forEach(([a, b]) => { if (b - a > 0.05) statics.add(box(b - a, height, 0.3, wall, (a + b) / 2, height / 2, hd)); });
      statics.add(box(door, height - 3.2, 0.3, wall, doorAt, 3.2 + (height - 3.2) / 2, hd));
    }
    statics.add(box(width + 0.4, 0.3, depth + 0.4, roof || wall, 0, height + 0.15, 0));
    decor.add(statics);
    group.add(live);
    return { statics, live, hw, hd };
  }

  function stool(x, z, seatColor = '#212529') {
    const seat = new THREE.Group();
    seat.add(cylinder(0.24, 0.24, 0.08, material(seatColor), 0, 0.76, 0, 14));
    seat.add(cylinder(0.04, 0.04, 0.72, material('#adb5bd', { metalness: 0.8 }), 0, 0.38, 0, 6));
    seat.add(cylinder(0.2, 0.2, 0.03, material('#adb5bd', { metalness: 0.8 }), 0, 0.33, 0, 12));
    seat.position.set(x, 0.3, z);
    return interactive(seat, 'sit', 'Stool');
  }

  function action(object, prompt, handler) {
    object.userData.prompt = prompt;
    object.userData.onInteract = () => handler();
    return interactive(object, 'action', prompt);
  }

  // A cooking station: counter body, a status lamp and the E spot
  function station(target, recipe, index, x, y, z, label, signBg) {
    const lamp = new THREE.MeshStandardMaterial({ color: '#495057', emissive: '#495057', emissiveIntensity: 0.2 });
    target.add(mesh(new THREE.SphereGeometry(0.11, 12, 8), lamp, x, y + 0.2, z + 0.42));
    const spot = new THREE.Object3D();
    spot.position.set(x, y, z + 0.9);
    spot.userData.gigStation = { recipe, index };
    action(spot, `Press E: ${index + 1}. ${label}`, () => useStation(recipe, index));
    target.add(spot);
    target.add(plane(stationSign(index + 1, label, signBg), 1.4, 0.52, x, y + 1.75, z - 0.25));
    stations.push({ recipe, index, lamp, spot });
  }

  // The item being cooked moves from station to station
  function cookingItem(target, recipe) {
    const holder = new THREE.Group();
    const stages = new THREE.Group();
    holder.add(stages);
    let parts;
    if (recipe === 'pizza') {
      const base = cylinder(0.3, 0.3, 0.04, material('#f1d9a7'), 0, 0.02, 0, 20);
      const sauce = cylinder(0.26, 0.26, 0.02, material('#c92a2a'), 0, 0.05, 0, 20);
      const cheese = cylinder(0.22, 0.22, 0.02, material('#ffe8a3'), 0, 0.065, 0, 20);
      const baked = cylinder(0.31, 0.31, 0.05, material('#d9822b'), 0, 0.03, 0, 20);
      const packed = box(0.66, 0.1, 0.66, material('#c49a6c', { roughness: 0.9 }), 0, 0.05, 0);
      parts = { 1: [base], 2: [base, sauce, cheese], 3: [baked, sauce, cheese], 4: [packed] };
      [base, sauce, cheese, baked, packed].forEach((p) => stages.add(p));
    } else {
      const beans = cylinder(0.12, 0.1, 0.12, material('#4a2c17'), 0, 0.06, 0, 12);
      const cup = cylinder(0.09, 0.07, 0.2, material('#f8f9fa'), 0, 0.1, 0, 14);
      const crema = cylinder(0.085, 0.085, 0.01, material('#c08457'), 0, 0.2, 0, 14);
      const lid = cylinder(0.095, 0.095, 0.03, material('#212529'), 0, 0.215, 0, 14);
      const sleeve = cylinder(0.095, 0.085, 0.07, material('#b5835a'), 0, 0.1, 0, 14);
      parts = { 1: [beans], 2: [cup, crema], 3: [cup, crema], 4: [cup, lid, sleeve] };
      [beans, cup, crema, lid, sleeve].forEach((p) => stages.add(p));
    }
    holder.visible = false;
    target.add(holder);
    items[recipe] = {
      object: holder,
      setStage(stage, stationInfo) {
        if (stage < 1 || !stationInfo) { holder.visible = false; return; }
        holder.visible = true;
        const position = stationInfo.spot.position;
        holder.position.set(position.x, position.y - 0.02, position.z - 0.75);
        // In the oven / machine while the timer runs
        const visible = parts[Math.min(stage, 4)] || [];
        stages.children.forEach((child) => { child.visible = visible.includes(child); });
      }
    };
  }

  // --------------------------------------------------------------------------
  // Builders
  // --------------------------------------------------------------------------
  const builders = {
    // Tunnel from the history corridor to the Gig Plaza (open at both ends)
    gigTunnel(group, { w, h, d, label }) {
      const decor = new THREE.Group();
      const wall = new THREE.MeshStandardMaterial({ map: repeated(concrete(), d / 3, 2), roughness: 0.9 });
      decor.add(box(w, 0.3, d, material('#3b3d40', { roughness: 0.9 }), 0, 0.15, 0));
      [-1, 1].forEach((side) => decor.add(box(0.4, h, d, wall, side * (w / 2 - 0.2), h / 2, 0)));
      decor.add(box(w, 0.3, d, material('#2a2c2f'), 0, h + 0.15, 0));
      for (let z = -d / 2 + 2; z < d / 2; z += 4) {
        decor.add(box(1.6, 0.06, 0.3, glow('#ffe8cc', 1.4), 0, h - 0.03, z));
        [-1, 1].forEach((side) => decor.add(box(0.06, 0.08, 1.2, glow('#ff9f1c', 1.2), side * (w / 2 - 0.42), 0.6, z)));
      }
      const arrows = canvasTexture('gig|arrows', 128, 512, (ctx, cw, ch) => {
        ctx.fillStyle = '#3b3d40'; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#ff9f1c';
        for (let y = 0; y < ch; y += 128) { ctx.beginPath(); ctx.moveTo(64, y + 110); ctx.lineTo(24, y + 40); ctx.lineTo(48, y + 40); ctx.lineTo(64, y + 70); ctx.lineTo(80, y + 40); ctx.lineTo(104, y + 40); ctx.fill(); }
      });
      const arrowFloor = mesh(new THREE.PlaneGeometry(1.2, d - 1), new THREE.MeshBasicMaterial({ map: repeated(arrows, 1, Math.round(d / 4)) }), 0, 0.31, 0);
      arrowFloor.rotation.x = -Math.PI / 2;
      arrowFloor.castShadow = false;
      group.add(arrowFloor);
      group.add(mergeByMaterial(decor));
      const sign = plane(neonSign('tunnel', label || 'TO THE GIG PLAZA', '#ff9f1c'), 4, 0.75, 0, h - 0.7, d / 2 - 1.5, 0);
      group.add(sign);
      const back = plane(neonSign('tunnelback', 'HALL OF INTERNET HISTORY', '#7fd8ff'), 4, 0.75, 0, h - 0.7, -d / 2 + 1.5, Math.PI);
      group.add(back);
    },

    gigPlaza(group, { w, h, d, label, data }) {
      gigRoot = group;
      gigSize = [w, h, d];
      stations.length = 0;
      const hw = w / 2;
      const hd = d / 2;
      const decor = new THREE.Group();
      const entranceX = (data && data.entranceX) || -hw + 4;
      // Cavern: tiled floor, concrete walls, ceiling with a grid of light panels
      const wall = new THREE.MeshStandardMaterial({ map: repeated(concrete(), w / 4, h / 4), roughness: 0.9 });
      decor.add(box(w, 0.3, d, new THREE.MeshStandardMaterial({ map: repeated(floorTiles(), w / 5, d / 5), roughness: 0.55 }), 0, 0.15, 0));
      decor.add(box(w, 0.4, d, material('#1c1d21', { roughness: 0.9 }), 0, h + 0.2, 0));
      decor.add(box(w, h, 0.4, wall, 0, h / 2, -hd));
      [-1, 1].forEach((side) => decor.add(box(0.4, h, d, wall, side * hw, h / 2, 0)));
      const doorWidth = 4.2;
      decor.add(box(entranceX - doorWidth / 2 + hw, h, 0.4, wall, (-hw + entranceX - doorWidth / 2) / 2, h / 2, hd));
      decor.add(box(hw - entranceX - doorWidth / 2, h, 0.4, wall, (hw + entranceX + doorWidth / 2) / 2, h / 2, hd));
      decor.add(box(doorWidth, h - 4.6, 0.4, wall, entranceX, 4.6 + (h - 4.6) / 2, hd));
      const panel = glow('#fff4e0', 1.1);
      for (let x = -hw + 5; x < hw; x += 10) for (let z = -hd + 5; z < hd; z += 10) decor.add(box(3, 0.08, 1.2, panel, x, h - 0.05, z));
      // Neon trims high on the cavern walls
      [['#ff4fd8', -hd + 0.25, 0], ['#22d3ee', hd - 0.25, 0]].forEach(([color, z]) => decor.add(box(w - 2, 0.12, 0.08, glow(color, 1.6), 0, 7.2, z)));
      [['#ffd43b', -hw + 0.25], ['#69db7c', hw - 0.25]].forEach(([color, x]) => decor.add(box(0.08, 0.12, d - 2, glow(color, 1.6), x, 7.2, 0)));
      // Entrance welcome sign
      group.add(plane(neonSign('welcome', label || 'THE GIG PLAZA', '#ff9f1c'), 6, 1.1, entranceX, 5.6, hd - 0.25, Math.PI));

      // ---- Central square: sign pylon, benches, planters -------------------
      const square = new THREE.Group();
      decor.add(cylinder(7.5, 7.5, 0.06, material('#8a7f72', { roughness: 0.6 }), 0, 0.33, 0, 40));
      decor.add(cylinder(7.6, 7.6, 0.05, glow('#ff9f1c', 0.8), 0, 0.315, 0, 40));
      decor.add(cylinder(1.4, 1.6, 0.6, material('#2b2f33', { metalness: 0.6 }), 0, 0.6, 0, 20));
      const pylon = new THREE.Group();
      pylon.add(box(1.4, 5, 1.4, material('#16121f', { metalness: 0.5 }), 0, 0, 0));
      const pylonTexture = neonSign('pylon', 'GIG PLAZA', '#ff9f1c', '#16121f', 110);
      for (let i = 0; i < 4; i++) {
        const face = plane(pylonTexture, 4.6, 1.2, Math.sin(i * Math.PI / 2) * 0.71, 0, Math.cos(i * Math.PI / 2) * 0.71, i * Math.PI / 2);
        face.rotation.z = Math.PI / 2;
        face.rotation.order = 'YXZ';
        pylon.add(face);
      }
      pylon.add(box(1.6, 0.15, 1.6, glow('#ff9f1c', 1.4), 0, 2.6, 0));
      pylon.position.set(0, 3.4, 0);
      square.add(pylon);
      animate(pylon, (time) => { pylon.rotation.y = time * 0.3; });
      const benchWood = material('#8a5a33', { roughness: 0.7 });
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const bench = new THREE.Group();
        bench.add(box(2.4, 0.1, 0.6, benchWood, 0, 0.75, 0));
        bench.add(box(2.4, 0.5, 0.08, benchWood, 0, 1.05, -0.28));
        [-1, 1].forEach((s) => bench.add(box(0.1, 0.45, 0.55, material('#2b2f33'), s * 1.05, 0.52, 0)));
        bench.position.set(Math.cos(angle) * 4.6, 0, Math.sin(angle) * 4.6);
        bench.rotation.y = -angle - Math.PI / 2;
        square.add(interactive(bench, 'sit', 'Bench'));
      }
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        const x = Math.cos(angle) * 6.6;
        const z = Math.sin(angle) * 6.6;
        decor.add(cylinder(0.8, 0.7, 0.8, material('#5c5f66', { roughness: 0.8 }), x, 0.7, z, 16));
        decor.add(cylinder(0.12, 0.16, 2, material('#5d4037'), x, 2, z, 8));
        decor.add(sphere(1.1, material('#2f9e44', { roughness: 0.9, flatShading: true }), x, 3.4, z, 10));
      }
      group.add(square);
      // String lights across the square (instanced bulbs)
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), glow('#ffe8a3', 2), 96);
      const matrix = new THREE.Matrix4();
      let bulb = 0;
      [[-hw + 1, -hd + 1, hw - 1, hd - 1], [-hw + 1, hd - 1, hw - 1, -hd + 1], [-hw + 1, 0, hw - 1, 0]].forEach(([x1, z1, x2, z2]) => {
        for (let i = 0; i < 32 && bulb < 96; i++, bulb++) {
          const t = i / 31;
          matrix.makeTranslation(x1 + (x2 - x1) * t, 8.4 - Math.sin(t * Math.PI) * 1.4, z1 + (z2 - z1) * t);
          bulbs.setMatrixAt(bulb, matrix);
        }
      });
      noRaycast(bulbs);
      group.add(bulbs);
      // Gig board near the entrance
      const board = new THREE.Group();
      board.add(box(3.2, 2.4, 0.2, material('#2b2f33', { metalness: 0.5 }), 0, 1.9, 0));
      board.add(plane(gigBoard(), 3, 2.25, 0, 1.9, 0.11));
      board.add(box(0.2, 0.8, 0.2, material('#2b2f33'), 0, 0.4, 0));
      board.position.set(entranceX + 4.5, 0.3, hd - 6);
      board.rotation.y = -0.5;
      board.userData = { label: 'Gig Board', info: 'Cook a pizza (Gig Kitchen) or a coffee (Brew Lab) using stations 1-4 in order, then start a delivery at the Delivery Depot terminal and reach the drop-off next to MetaBlock Estates. Spend Gig Tokens at the Reward Shop in Gig Mart.' };
      group.add(interactive(board, 'inspect', 'Gig Board'));

      // ---- Food court tables ---------------------------------------------
      [[-6, 15], [1, 17], [8, 15]].forEach(([x, z]) => {
        decor.add(cylinder(0.8, 0.8, 0.06, material('#f1f3f5', { roughness: 0.3 }), x, 1.35, z, 20));
        decor.add(cylinder(0.06, 0.25, 1.05, material('#2b2f33', { metalness: 0.7 }), x, 0.82, z, 8));
        decor.add(cylinder(0.05, 0.05, 2.6, material('#2b2f33', { metalness: 0.7 }), x, 2.6, z, 6));
        decor.add(cylinder(1.6, 1.6, 0.08, material('#ff922b', { roughness: 0.6 }), x, 3.9, z, 10));
        [[1.15, 0], [-1.15, 0], [0, 1.15], [0, -1.15]].forEach(([dx, dz]) => group.add(stool(x + dx, z + dz, '#e8590c')));
      });

      // ---- Pixel Pizza (front faces the square, +x) ------------------------
      const brick = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.brickTexture ? PropKit.kit.brickTexture('#8c3b2a') : concrete(), 4, 2), roughness: 0.85 });
      const pizza = shopShell(decor, group, { x: -hw + 6.5, z: 9, rotationY: Math.PI / 2, width: 16, depth: 13, wall: brick, door: 4, skip: ['back'], roof: material('#5c1a12') });
      pizza.live.add(plane(pizzaSign(), 7, 1.75, 0, 3.85, pizza.hd + 0.17));
      pizza.live.add(plane(pizzaMenu(), 2.6, 1.95, -3.5, 2.6, -pizza.hd + 0.4));
      const floorChecker = mesh(new THREE.PlaneGeometry(15.6, 12.6), new THREE.MeshStandardMaterial({ map: repeated(checkerTiles(), 6, 5), roughness: 0.4 }), 0, 0.312, 0);
      floorChecker.rotation.x = -Math.PI / 2;
      pizza.live.add(floorChecker);
      pizza.statics.add(box(9, 1.1, 0.9, material('#c92a2a', { roughness: 0.5 }), 1.5, 0.85, -3.6));
      pizza.statics.add(box(9.2, 0.08, 1.0, material('#f1f3f5', { roughness: 0.2 }), 1.5, 1.44, -3.6));
      pizza.statics.add(box(2.4, 1.6, 1.4, material('#9c5b3b'), 4.5, 1.1, -5.6));
      pizza.statics.add(box(1.4, 0.7, 0.1, glow('#ff6b00', 1.6), 4.5, 1.2, -4.88));
      [-1, 3].forEach((x) => pizza.statics.add(cylinder(0.32, 0.32, 0.04, material('#e8a33d'), x, 1.5, -3.6, 18)));
      [[-4, 2.5], [3, 2.5]].forEach(([x, z]) => {
        pizza.statics.add(box(1.2, 0.06, 1.2, material('#f1f3f5'), x, 1.1, z));
        pizza.statics.add(cylinder(0.05, 0.05, 0.8, material('#2b2f33'), x, 0.7, z, 6));
        [[-0.9, 0], [0.9, 0]].forEach(([dx]) => pizza.live.add(stool(x + dx, z, '#c92a2a')));
      });

      // ---- Gig Kitchen: industrial pizza line ------------------------------
      const steel = material('#c5ccd3', { metalness: 0.85, roughness: 0.3 });
      const tileWall = new THREE.MeshStandardMaterial({ map: repeated(subwayTiles(), 6, 2), roughness: 0.4 });
      const kitchen = shopShell(decor, group, { x: -hw + 6.5, z: -11.75, rotationY: Math.PI / 2, width: 24.5, depth: 13, wall: tileWall, door: 14, doorAt: 0, skip: ['back', 'left'], roof: material('#3b3f45') });
      kitchen.live.add(plane(neonSign('kitchen', 'GIG KITCHEN', '#ffd43b', '#1d1f22'), 6, 1.1, 0, 3.9, kitchen.hd + 0.17));
      const kfloor = mesh(new THREE.PlaneGeometry(24, 12.6), new THREE.MeshStandardMaterial({ map: repeated(checkerTiles(), 10, 5), roughness: 0.4 }), 0, 0.312, 0);
      kfloor.rotation.x = -Math.PI / 2;
      kitchen.live.add(kfloor);
      kitchen.live.add(plane(subwayTiles(), 24, 3, 0, 1.8, -kitchen.hd + 0.02));
      const counterZ = -kitchen.hd + 0.75;
      [-9, -4, 1, 6].forEach((sx, index) => {
        kitchen.statics.add(box(3.4, 1.0, 1.2, steel, sx, 0.8, counterZ));
        kitchen.statics.add(box(3.5, 0.06, 1.3, material('#e9ecef', { metalness: 0.6, roughness: 0.2 }), sx, 1.33, counterZ));
      });
      // Station props: flour sacks, topping trays, a pizza oven with a hood, boxes
      kitchen.statics.add(box(0.6, 0.8, 0.4, material('#efe6d6', { roughness: 1 }), -10.2, 1.76, counterZ));
      kitchen.statics.add(cylinder(0.25, 0.25, 0.25, material('#e9d8a6'), -8.5, 1.48, counterZ, 14));
      ['#c92a2a', '#ffe8a3', '#2f9e44', '#8a5a33', '#212529'].forEach((color, i) => kitchen.statics.add(box(0.45, 0.08, 0.35, material(color, { roughness: 0.8 }), -5.2 + i * 0.5, 1.4, counterZ - 0.25)));
      kitchen.statics.add(box(3.2, 1.6, 1.3, material('#6d4c41', { roughness: 0.9 }), 1, 2.15, counterZ));
      kitchen.statics.add(box(3.6, 0.9, 1.6, steel, 1, 3.9, counterZ + 0.1));
      const ovenGlow = new THREE.MeshStandardMaterial({ color: '#ff6b00', emissive: '#ff6b00', emissiveIntensity: 0.6 });
      kitchen.live.add(mesh(new THREE.PlaneGeometry(1.6, 0.6), ovenGlow, 1, 2.0, counterZ + 0.66));
      animate(kitchen.live, (time) => {
        const baking = state.recipe === 'pizza' && state.timerEnd && performance.now() < state.timerEnd;
        ovenGlow.emissiveIntensity = baking ? 2.2 + Math.sin(time * 12) * 0.5 : 0.6;
      });
      for (let i = 0; i < 6; i++) kitchen.statics.add(box(0.66, 0.1, 0.66, material('#c49a6c', { roughness: 0.9 }), 7.4, 1.41 + i * 0.1, counterZ));
      kitchen.statics.add(box(12, 0.06, 0.4, steel, -2, 3.0, -kitchen.hd + 0.3));
      ['Dough', 'Toppings', 'Oven', 'Packing'].forEach((stepLabel, index) => station(kitchen.live, 'pizza', index, [-9, -4, 1, 6][index], 1.36, counterZ, stepLabel, '#7a1010'));
      cookingItem(kitchen.live, 'pizza');
      const bin = cylinder(0.4, 0.35, 1.0, material('#495057', { metalness: 0.5 }), 10.5, 0.8, counterZ + 0.3, 14);
      kitchen.live.add(action(bin, 'Press E: throw the current order away', discardJob));
      kitchen.live.add(stool(-1.5, 3.5, '#212529'));

      // ---- Brew Lab: modern glass coffee shop (front faces -x) -------------
      const whiteWall = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.stuccoTexture('#f4f1ea'), 4, 2), roughness: 0.8 });
      const brew = shopShell(decor, group, { x: hw - 6.5, z: 14, rotationY: -Math.PI / 2, width: 16, depth: 13, wall: whiteWall, door: 3.6, glass: true, skip: ['back'], roof: material('#2b2f33', { metalness: 0.5 }) });
      brew.live.add(plane(cleanSign('brew', 'Brew Lab', 'specialty coffee · since 2026', '#111111', '#ffffff', '#c9a227'), 5.6, 1.05, 0, 4.0, brew.hd + 0.2));
      const wood = new THREE.MeshStandardMaterial({ map: repeated(plankTexture('#b07a45'), 6, 5), roughness: 0.6 });
      const bfloor = mesh(new THREE.PlaneGeometry(15.6, 12.6), wood, 0, 0.312, 0);
      bfloor.rotation.x = -Math.PI / 2;
      brew.live.add(bfloor);
      const marble = material('#f8f9fa', { roughness: 0.15, metalness: 0.1 });
      const bCounterZ = -brew.hd + 0.8;
      brew.statics.add(box(14, 1.0, 1.2, material('#3b2a20', { roughness: 0.6 }), 0, 0.8, bCounterZ));
      brew.statics.add(box(14.2, 0.07, 1.3, marble, 0, 1.33, bCounterZ));
      brew.statics.add(box(8, 0.05, 0.3, material('#5d4037'), -2, 3.0, -brew.hd + 0.3));
      for (let i = 0; i < 10; i++) brew.statics.add(cylinder(0.06, 0.05, 0.1, material(['#f8f9fa', '#212529', '#c9a227'][i % 3]), -5.6 + i * 0.4, 3.1, -brew.hd + 0.3, 10));
      brew.live.add(plane(coffeeMenu(), 2, 2, 4.8, 2.6, -brew.hd + 0.2));
      // Machines: grinder, espresso machine, steamer, cups
      brew.statics.add(cylinder(0.18, 0.12, 0.6, material('#212529', { metalness: 0.6 }), -6, 1.66, bCounterZ, 12));
      brew.statics.add(cylinder(0.22, 0.1, 0.3, material('#cfe8ff', { transparent: true, opacity: 0.6 }), -6, 2.1, bCounterZ, 12));
      brew.statics.add(box(1.4, 0.7, 0.7, material('#c5ccd3', { metalness: 0.9, roughness: 0.2 }), -2, 1.72, bCounterZ));
      brew.statics.add(box(1.2, 0.12, 0.5, material('#212529'), -2, 2.13, bCounterZ));
      brew.statics.add(cylinder(0.1, 0.1, 0.45, material('#c5ccd3', { metalness: 0.9 }), 2, 1.58, bCounterZ, 12));
      brew.statics.add(cylinder(0.02, 0.02, 0.4, material('#c5ccd3', { metalness: 0.9 }), 2.2, 1.75, bCounterZ + 0.1, 6));
      for (let i = 0; i < 4; i++) brew.statics.add(cylinder(0.09, 0.07, 0.2, material('#f8f9fa'), 5.6 + (i % 2) * 0.25, 1.47 + Math.floor(i / 2) * 0.2, bCounterZ, 12));
      ['Grind', 'Espresso', 'Milk', 'Cup & lid'].forEach((stepLabel, index) => station(brew.live, 'coffee', index, [-6, -2, 2, 6][index], 1.36, bCounterZ, stepLabel, '#2b2f33'));
      cookingItem(brew.live, 'coffee');
      const brewBin = cylinder(0.3, 0.26, 0.8, material('#212529'), 7.2, 0.7, bCounterZ + 0.9, 12);
      brew.live.add(action(brewBin, 'Press E: throw the current order away', discardJob));
      // Pendant lamps and a window bar with stools
      [-5, -1, 3].forEach((x) => {
        brew.statics.add(cylinder(0.01, 0.01, 1.4, material('#111111'), x, 3.9, bCounterZ + 1.2, 4));
        brew.statics.add(cylinder(0.08, 0.3, 0.3, material('#111111', { metalness: 0.5 }), x, 3.1, bCounterZ + 1.2, 14));
        brew.statics.add(cylinder(0.27, 0.27, 0.02, glow('#ffe8a3', 1.8), x, 2.95, bCounterZ + 1.2, 14));
      });
      brew.statics.add(box(14, 0.06, 0.5, material('#b07a45'), 0, 1.35, brew.hd - 0.5));
      [-6.5, -5, -3.5, 3.5, 5, 6.5].forEach((x) => brew.live.add(stool(x, brew.hd - 1.3, '#212529')));
      [-4, 4].forEach((x) => { brew.statics.add(cylinder(0.3, 0.25, 0.5, material('#e9ecef'), x, 0.55, 2, 12)); brew.statics.add(sphere(0.55, material('#2b8a3e', { flatShading: true }), x, 1.2, 2, 8)); });

      // ---- Gig Mart 24/7 with The Reward Shop (front faces -x) -------------
      const martWall = material('#1b1b2f', { roughness: 0.7 });
      const mart = shopShell(decor, group, { x: hw - 6.5, z: -5, rotationY: -Math.PI / 2, width: 18, depth: 13, wall: martWall, door: 6, skip: ['back'], roof: material('#141428') });
      mart.live.add(plane(neonSign('mart', 'GIG MART 24/7', '#ff4fd8'), 7.5, 1.4, 0, 3.85, mart.hd + 0.17));
      const neonBar = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#22d3ee', emissiveIntensity: 1.8 });
      mart.live.add(box(17, 0.1, 0.1, neonBar, 0, 4.5, mart.hd + 0.2));
      animate(mart.live, (time) => { neonBar.emissiveIntensity = Math.sin(time * 17) > 0.96 ? 0.3 : 1.8; });
      const mfloor = mesh(new THREE.PlaneGeometry(17.6, 12.6), material('#e9ecef', { roughness: 0.25 }), 0, 0.312, 0);
      mfloor.rotation.x = -Math.PI / 2;
      mart.live.add(mfloor);
      const products = new THREE.MeshStandardMaterial({ map: shelfProducts(), roughness: 0.6 });
      [-8.4, 8.4].forEach((x) => {
        mart.statics.add(box(0.7, 2.2, 8, material('#ced4da', { metalness: 0.4 }), x, 1.4, 1));
        for (let level = 0; level < 4; level++) {
          const row = mesh(new THREE.BoxGeometry(0.05, 0.42, 7.6), products, x - Math.sign(x) * 0.37, 0.75 + level * 0.5, 1);
          mart.live.add(row);
        }
      });
      mart.statics.add(box(3, 2.3, 0.8, material('#212529'), -5, 1.45, -5.8));
      mart.live.add(box(2.8, 2.0, 0.05, glow('#a5d8ff', 0.9), -5, 1.5, -5.37));
      mart.live.add(plane(neonSign('reward', 'THE REWARD SHOP', '#ffd43b', '#1b1b2f', 80), 7, 1.2, 2.5, 3.35, -mart.hd + 0.2));
      const rCounterZ = -mart.hd + 0.8;
      mart.statics.add(box(11, 1.0, 1.0, material('#ffd43b', { roughness: 0.5 }), 2.5, 0.8, rCounterZ));
      mart.statics.add(box(11.2, 0.06, 1.1, material('#212529'), 2.5, 1.33, rCounterZ));
      SHOP.forEach((item, i) => {
        const x = -2.2 + i * 1.18;
        const display = new THREE.Group();
        if (item.kind === 'furniture') {
          if (item.id === 'lava-lamp') { display.add(cylinder(0.08, 0.12, 0.4, glow(item.color, 1.4), 0, 0.2, 0, 10)); }
          else if (item.id === 'beanbag') { const bag = sphere(0.25, material(item.color, { roughness: 1 }), 0, 0.15, 0, 10); bag.scale.y = 0.6; display.add(bag); }
          else if (item.id === 'mini-arcade') { display.add(box(0.26, 0.45, 0.22, material('#212529'), 0, 0.22, 0)); display.add(box(0.2, 0.14, 0.01, glow(item.color, 1.4), 0, 0.3, 0.115)); }
          else { display.add(cylinder(0.1, 0.08, 0.1, material('#8a5a33'), 0, 0.05, 0, 10)); display.add(sphere(0.16, material(item.color, { flatShading: true }), 0, 0.24, 0, 8)); }
        } else if (item.kind === 'outfit') {
          display.add(box(0.3, 0.4, 0.12, glow(item.color, 0.8), 0, 0.25, 0));
          display.add(cylinder(0.01, 0.01, 0.3, material('#adb5bd'), 0, 0.5, 0, 4));
        } else {
          display.add(box(0.26, 0.34, 0.12, material(item.color, { roughness: 0.8 }), 0, 0.17, 0));
        }
        display.position.set(x, 1.36, rCounterZ - 0.15);
        mart.live.add(display);
        mart.live.add(plane(priceTag(item), 0.9, 0.45, x, 1.0, rCounterZ + 0.52));
        const buySpot = new THREE.Object3D();
        buySpot.position.set(x, 1.0, rCounterZ + 1.1);
        buySpot.userData.gigShopItem = item.id;
        mart.live.add(action(buySpot, `Press E: buy ${item.name} (${item.price} Gig Tokens)`, () => buy(item)));
      });

      // ---- Delivery Depot with a hover-bike (front faces +z) ----------------
      const depotWall = new THREE.MeshStandardMaterial({ map: repeated(concrete(), 4, 2), roughness: 0.85 });
      const depot = shopShell(decor, group, { x: 4, z: -hd + 5, rotationY: 0, width: 16, depth: 10, height: 5, wall: depotWall, door: 10, skip: ['back'], roof: material('#2b2f33') });
      depot.live.add(plane(cleanSign('depot', 'DELIVERY DEPOT', 'dispatch · hover-bikes · parcels', '#ff9f1c', '#1a1a1a', '#1a1a1a'), 6, 1.1, 0, 4.4, depot.hd + 0.17));
      depot.statics.add(box(10, 0.6, 0.4, material('#868e96', { metalness: 0.7 }), 0, 4.2, depot.hd - 0.4));
      const stripes = new THREE.MeshBasicMaterial({ map: repeated(hazard(), 8, 1) });
      const stripeFloor = mesh(new THREE.PlaneGeometry(10, 0.5), stripes, 0, 0.315, depot.hd - 0.3);
      stripeFloor.rotation.x = -Math.PI / 2;
      depot.live.add(stripeFloor);
      for (let s = 0; s < 3; s++) {
        depot.statics.add(box(5, 0.08, 0.9, material('#495057', { metalness: 0.6 }), -4.5, 0.9 + s * 1.1, -depot.hd + 0.7));
        for (let p = 0; p < 4; p++) depot.statics.add(box(0.8, 0.6, 0.6, material(['#c49a6c', '#b5835a', '#d9b38c'][(p + s) % 3], { roughness: 0.95 }), -6.3 + p * 1.2, 1.25 + s * 1.1, -depot.hd + 0.7));
      }
      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 512; boardCanvas.height = 256;
      deliveryBoard = { canvas: boardCanvas, texture: new THREE.CanvasTexture(boardCanvas) };
      depot.live.add(plane(deliveryBoard.texture, 3.6, 1.8, 3.5, 3.0, -depot.hd + 0.2));
      // Hover-bike: body, seat, handlebar, glowing hover pads (bobbing)
      const bike = new THREE.Group();
      bike.add(box(2.2, 0.35, 0.6, material('#ff9f1c', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0));
      bike.add(box(0.8, 0.15, 0.45, material('#212529'), -0.3, 0.25, 0));
      bike.add(box(0.1, 0.5, 0.08, material('#212529'), 0.8, 0.35, 0));
      bike.add(box(0.08, 0.06, 0.8, material('#212529'), 0.8, 0.6, 0));
      bike.add(box(0.5, 0.4, 0.5, material('#c49a6c'), -0.9, 0.38, 0));
      const padGlow = glow('#22d3ee', 2);
      [-0.8, 0.8].forEach((x) => { bike.add(cylinder(0.35, 0.35, 0.12, material('#2b2f33', { metalness: 0.7 }), x, -0.24, 0, 16)); bike.add(noRaycast(cylinder(0.3, 0.3, 0.02, padGlow, x, -0.31, 0, 16))); });
      bike.position.set(2, 1.0, 0);
      depot.live.add(bike);
      depot.live.add(noRaycast(cylinder(1.6, 1.6, 0.04, glow('#22d3ee', 0.6), 2, 0.33, 0, 24)));
      animate(bike, (time) => { bike.position.y = 1.0 + Math.sin(time * 2) * 0.08; bike.rotation.z = Math.sin(time * 1.3) * 0.03; });
      // Dispatch terminal
      const terminal = new THREE.Group();
      terminal.add(box(0.6, 1.1, 0.5, material('#2b2f33', { metalness: 0.6 }), 0, 0.55, 0));
      const screen = box(0.7, 0.5, 0.06, glow('#69db7c', 1.0), 0, 1.35, 0.1);
      screen.rotation.x = -0.4;
      terminal.add(screen);
      terminal.position.set(-5.5, 0.3, 2.5);
      terminal.userData.gigTerminal = true;
      depot.live.add(action(terminal, 'Press E: dispatch terminal (start / check delivery)', useTerminal));
      const terminalLabel = textSprite('Dispatch (E)', { width: 3, background: 'rgba(255, 159, 28, 0.92)', color: '#1a1a1a' });
      terminalLabel.position.set(-5.5, 2.4, 2.5);
      depot.live.add(terminalLabel);

      // Recycling corner and plants between the kitchen and the depot
      [[-9, -22], [-7.5, -22]].forEach(([x, z], i) => decor.add(box(1.2, 1.2, 1, material(i ? '#2f9e44' : '#1971c2', { roughness: 0.7 }), x, 0.9, z)));
      [[-hw + 1.5, hd - 1.5], [hw - 1.5, hd - 1.5], [hw - 1.5, -hd + 1.5]].forEach(([x, z]) => {
        decor.add(cylinder(0.5, 0.4, 0.8, material('#495057'), x, 0.7, z, 12));
        decor.add(sphere(0.9, material('#2b8a3e', { flatShading: true }), x, 1.8, z, 8));
      });

      group.add(mergeByMaterial(decor));
      refreshVisuals();
    }
  };

  PropKit.registerBuilder(/gig_tunnel/, 'gigTunnel', builders.gigTunnel);
  PropKit.registerBuilder(/gig_plaza/, 'gigPlaza', builders.gigPlaza);

  // Small API for debugging and tests
  window.GigPlaza = { state, getTokens, recipes: RECIPES, shop: SHOP, stations, useStation, useTerminal, buy, dropOffPoint };
})();
