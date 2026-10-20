// ============================================================================
// LOOT: FORTNITE-STYLE CHESTS AND SUPPLY DROPS WITH REAL CODE FILES
// ============================================================================
// Chests sit on street corners all over Genesis City and Silicon Valley and
// respawn two minutes after being opened. Every three minutes a supply drop
// falls from the sky with Rare-to-Legendary loot. Every item is a real,
// working file (a .gitignore, a Makefile, a GitHub Actions workflow, an Nginx
// config...) listed in maps/loot.json, and it is downloaded to your computer
// the moment you open the chest. There is no in-game inventory.
const LootSystem = (() => {
  const OPEN_DISTANCE = 4.5;
  let catalog = null;
  let hooks = null;
  const loots = {};
  const buffs = { speed: 0, jump: 0, jetpack: 0, lens: 0 };
  let nearestLoot = null;
  const ui = {
    prompt: document.getElementById('loot-prompt'),
    toast: document.getElementById('loot-toast'),
    buffs: document.getElementById('buff-bar')
  };

  // --------------------------------------------------------------------------
  // 3D models
  // --------------------------------------------------------------------------
  function buildChest() {
    const { material, glow, box, sphere } = PropKit.kit;
    const chest = new THREE.Group();
    const wood = material('#8d5524', { roughness: 0.8 });
    const gold = material('#ffd166', { metalness: 0.8, roughness: 0.3, emissive: '#ffb703', emissiveIntensity: 0.35 });
    chest.add(box(1.6, 0.9, 1, wood, 0, 0.45, 0));
    [-0.6, 0, 0.6].forEach((x) => chest.add(box(0.12, 0.92, 1.02, gold, x, 0.45, 0)));
    const lid = new THREE.Group();
    lid.add(box(1.64, 0.35, 1.04, wood, 0, 0.17, 0.52));
    lid.add(box(1.66, 0.08, 1.06, gold, 0, 0.36, 0.52));
    lid.add(box(0.25, 0.3, 0.1, gold, 0, 0.05, 1.06));
    lid.position.set(0, 0.9, -0.52);
    chest.add(lid);
    const light = sphere(0.9, glow('#ffd166', 1.2, { transparent: true, opacity: 0.25, depthWrite: false }), 0, 0.9, 0, 12);
    light.castShadow = false;
    chest.add(light);
    chest.userData = { lid, light };
    return chest;
  }

  function buildSupplyDrop() {
    const { material, glow, box, mesh, cylinder } = PropKit.kit;
    const drop = new THREE.Group();
    drop.add(box(2, 2, 2, material('#3a86ff', { roughness: 0.5 }), 0, 1, 0));
    drop.add(box(2.05, 0.3, 2.05, material('#ffbe0b'), 0, 1, 0));
    drop.add(box(0.3, 2.05, 2.05, material('#ffbe0b'), 0, 1, 0));
    const balloon = mesh(new THREE.SphereGeometry(2.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), material('#ff006e', { side: THREE.DoubleSide }), 0, 6, 0);
    drop.add(balloon);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const rope = cylinder(0.03, 0.03, 4.4, material('#ffffff'), sx * 0.9, 4, sz * 0.9, 4);
      rope.rotation.set(sz * 0.2, 0, -sx * 0.2);
      drop.add(rope);
    });
    // Tall beam of light so everyone can see where it is falling
    const beam = cylinder(1.2, 1.2, 160, glow('#3a86ff', 1, { transparent: true, opacity: 0.18, depthWrite: false }), 0, 80, 0, 16);
    beam.castShadow = false;
    drop.add(beam);
    drop.userData = { balloon, beam };
    return drop;
  }

  // --------------------------------------------------------------------------
  // Loot state
  // --------------------------------------------------------------------------
  function upsertLoot(data) {
    let loot = loots[data.id];
    if (!loot) {
      const model = data.kind === 'drop' ? buildSupplyDrop() : buildChest();
      model.traverse((node) => { node.raycast = () => {}; });
      const ground = hooks.groundHeightAt(data.x, data.z, 120);
      model.position.set(data.x, ground, data.z);
      hooks.scene.add(model);
      loot = loots[data.id] = { ...data, model, ground };
    }
    Object.assign(loot, data);
    loot.landsAtLocal = data.landsAt ? performance.now() + Math.max(0, data.landsAt - Date.now()) : 0;
    applyLootVisual(loot);
  }

  function applyLootVisual(loot) {
    if (loot.kind !== 'chest') return;
    loot.model.userData.lid.rotation.x = loot.open ? -1.9 : 0;
    loot.model.userData.light.visible = !loot.open;
    loot.model.visible = true;
  }

  function removeLoot(id) {
    const loot = loots[id];
    if (!loot) return;
    hooks.scene.remove(loot.model);
    delete loots[id];
  }

  function itemDefinition(id) {
    return catalog.items.find((item) => item.id === id);
  }

  // --------------------------------------------------------------------------
  // Opening loot: the item is a real code file, downloaded to your computer
  // --------------------------------------------------------------------------
  function download(item) {
    const blob = new Blob([item.content], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
  }

  function received(item, from) {
    if (!item) return;
    download(item);
    showToast(item, from);
    hooks.system(`Downloaded ${item.filename}: ${item.name} (${catalog.rarities[item.rarity].name}). ${item.description}${item.saveAs ? ` Rename it to ${item.saveAs} in your project (browsers do not save files starting with a dot).` : ''}`);
  }

  function showToast(item, from) {
    const rarity = catalog.rarities[item.rarity];
    ui.toast.innerHTML = '<span class="file"></span><div><small></small><b></b></div>';
    ui.toast.querySelector('.file').textContent = item.filename;
    ui.toast.querySelector('small').textContent = `${rarity.name.toUpperCase()} · from a ${from === 'drop' ? 'supply drop' : 'chest'} · downloaded`;
    ui.toast.querySelector('b').textContent = item.name;
    ui.toast.style.borderColor = rarity.color;
    ui.toast.style.boxShadow = `0 0 30px ${rarity.color}aa`;
    ui.toast.classList.remove('show');
    void ui.toast.offsetWidth;
    ui.toast.classList.add('show');
  }

  function renderBuffs() {
    const now = performance.now();
    const active = Object.entries(buffs).filter(([, until]) => until > now);
    ui.buffs.textContent = active.map(([name, until]) => `${{ speed: 'Speed', jump: 'Jump', jetpack: 'Jetpack', lens: 'Lens' }[name]} ${Math.ceil((until - now) / 1000)}s`).join('   ');
  }

  function rollLocal(kind) {
    const weightKey = kind === 'drop' ? 'dropWeight' : 'chestWeight';
    const rarities = Object.entries(catalog.rarities).filter(([, rarity]) => rarity[weightKey] > 0);
    let roll = Math.random() * rarities.reduce((sum, [, rarity]) => sum + rarity[weightKey], 0);
    const [rarityKey] = rarities.find(([, rarity]) => (roll -= rarity[weightKey]) < 0) || rarities[0];
    const options = catalog.items.filter((item) => item.rarity === rarityKey);
    return options[Math.floor(Math.random() * options.length)];
  }

  // Solo mode (no server): the chest is opened locally
  function openLocal(loot) {
    received(rollLocal(loot.kind), loot.kind);
    if (loot.kind === 'drop') removeLoot(loot.id);
    else { upsertLoot({ id: loot.id, open: true }); setTimeout(() => upsertLoot({ id: loot.id, open: false }), 120000); }
  }

  function online() {
    return hooks.socket && hooks.socket.connected;
  }

  function tryOpen() {
    if (!nearestLoot) return false;
    if (nearestLoot.landsAtLocal > performance.now()) { hooks.system('The supply drop is still falling!'); return true; }
    if (online()) hooks.socket.emit('loot_open', { id: nearestLoot.id });
    else openLocal(nearestLoot);
    return true;
  }

  // --------------------------------------------------------------------------
  // Per-frame update: falling drops, glow and the "Press E" prompt
  // --------------------------------------------------------------------------
  function update(time, deltaSeconds) {
    if (!catalog) return;
    const avatar = hooks.avatarPosition();
    nearestLoot = null;
    let nearestDistance = OPEN_DISTANCE;
    Object.values(loots).forEach((loot) => {
      if (loot.kind === 'drop') {
        const remaining = Math.max(0, loot.landsAtLocal - performance.now());
        loot.model.position.y = loot.ground + remaining / 1000 * 7;
        loot.model.rotation.y = time * 0.3;
        loot.model.userData.balloon.visible = remaining > 0;
      } else if (!loot.open) {
        loot.model.userData.light.scale.setScalar(1 + Math.sin(time * 3 + loot.x) * 0.15);
      }
      const distance = Math.hypot(avatar.x - loot.x, avatar.z - loot.z);
      if (!loot.open && distance < nearestDistance && Math.abs(avatar.y - loot.model.position.y) < 4) {
        nearestLoot = loot;
        nearestDistance = distance;
      }
    });
    ui.prompt.style.display = nearestLoot ? 'block' : 'none';
    if (nearestLoot) ui.prompt.textContent = nearestLoot.kind === 'drop' ? 'Press E to open the SUPPLY DROP' : 'Press E to open the chest';

    if (Math.floor(time * 4) !== Math.floor((time - deltaSeconds) * 4)) renderBuffs();
  }

  // Movement multipliers used by the avatar physics in main.js
  function modifiers() {
    const now = performance.now();
    return { speed: buffs.speed > now ? 1.6 : 1, jump: buffs.jump > now ? 1.6 : 1, jetpack: buffs.jetpack > now, lens: buffs.lens > now };
  }

  function command(name) {
    switch (name) {
      case 'loot': {
        const avatar = hooks.avatarPosition();
        const available = Object.values(loots).filter((loot) => !loot.open).map((loot) => ({ loot, distance: Math.hypot(avatar.x - loot.x, avatar.z - loot.z) })).sort((a, b) => a.distance - b.distance);
        if (!available.length) { hooks.system('No loot around right now.'); return true; }
        const { loot, distance } = available[0];
        hooks.system(`Nearest ${loot.kind === 'drop' ? 'SUPPLY DROP' : 'chest'}: ${Math.round(distance)}m away at x=${Math.round(loot.x)} z=${Math.round(loot.z)} (${loot.area}). Use /tp ${Math.round(loot.x)} ${Math.round(loot.z)} to get there.`);
        return true;
      }
      default:
        return false;
    }
  }

  async function init(options) {
    hooks = options;
    catalog = await (await fetch('maps/loot.json')).json();
    if (hooks.socket) {
      hooks.socket.on('loot_spawns', (list) => list.forEach(upsertLoot));
      hooks.socket.on('loot_spawned', upsertLoot);
      hooks.socket.on('loot_state', ({ id, open }) => { if (loots[id]) upsertLoot({ ...loots[id], id, open, landsAt: null }); });
      hooks.socket.on('loot_removed', removeLoot);
      hooks.socket.on('loot_result', ({ item, from }) => received(itemDefinition(item), from));
      hooks.socket.on('connect', () => hooks.socket.emit('loot_sync'));
      hooks.socket.emit('loot_sync');
    } else {
      catalog.spawns.forEach((spawn, index) => upsertLoot({ id: `chest${index}`, kind: 'chest', x: spawn.x, z: spawn.z, area: spawn.area, open: false }));
      // Solo supply drops every three minutes too
      setInterval(() => {
        const spot = catalog.spawns[Math.floor(Math.random() * catalog.spawns.length)];
        upsertLoot({ id: `drop${Date.now()}`, kind: 'drop', x: spot.x, z: spot.z, area: spot.area, open: false, landsAt: Date.now() + 20000 });
        hooks.system(`A SUPPLY DROP is falling over ${spot.area}!`);
      }, 180000);
    }
  }

  function addBuff(name, seconds) {
    buffs[name] = performance.now() + seconds * 1000;
  }

  return { init, update, tryOpen, command, modifiers, addBuff };
})();
