// ============================================================================
// LOOT: FORTNITE-STYLE CHESTS, SUPPLY DROPS, HOTBAR AND DEV ITEMS
// ============================================================================
// Chests sit on street corners all over Genesis City and Silicon Valley and
// respawn two minutes after being opened. Every three minutes a supply drop
// falls from the sky with Rare-to-Legendary loot. Instead of weapons, the
// items are things devs understand: coffee, rubber ducks, hoodies, jetpacks...
const LootSystem = (() => {
  const OPEN_DISTANCE = 4.5;
  const DEV_TIPS = [
    'Name things for the reader, not the writer.',
    'If it is not tested, it is broken. You just do not know it yet.',
    'Read the error message. Then read it again.',
    'Small commits, clear messages, happy reviewers.',
    'Delete code bravely: the best line is the one you never wrote.',
    'Measure before you optimize.',
    'Explain the bug to a rubber duck before you ask a human.',
    'Automate the thing you have done three times.'
  ];

  let catalog = null;
  let hooks = null;
  const loots = {};
  let inventory = [];
  const buffs = { speed: 0, jump: 0, jetpack: 0, lens: 0 };
  let duckPet = null;
  let nearestLoot = null;
  const ui = {
    hotbar: document.getElementById('hotbar'),
    prompt: document.getElementById('loot-prompt'),
    toast: document.getElementById('loot-toast'),
    inventoryPanel: document.getElementById('inventory-panel'),
    inventoryList: document.getElementById('inventory-list'),
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

  function buildDuck() {
    const { material, sphere, box } = PropKit.kit;
    const duck = new THREE.Group();
    duck.add(sphere(0.4, material('#ffd43b'), 0, 0.4, 0, 12));
    duck.add(sphere(0.25, material('#ffd43b'), 0, 0.85, 0.2, 12));
    duck.add(box(0.2, 0.08, 0.2, material('#ff922b'), 0, 0.82, 0.48));
    duck.add(sphere(0.05, material('#111111'), 0.1, 0.92, 0.4, 6));
    duck.add(sphere(0.05, material('#111111'), -0.1, 0.92, 0.4, 6));
    duck.traverse((node) => { node.raycast = () => {}; });
    return duck;
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

  function rarityColor(item) {
    return catalog.rarities[item.rarity].color;
  }

  // --------------------------------------------------------------------------
  // HUD: hotbar, inventory panel, prompts, toasts and buffs
  // --------------------------------------------------------------------------
  function renderInventory() {
    ui.hotbar.innerHTML = '';
    for (let slot = 0; slot < 5; slot++) {
      const entry = inventory[slot];
      const item = entry && itemDefinition(entry.id);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'hotbar-slot';
      cell.innerHTML = '<kbd></kbd><span class="icon"></span>';
      cell.querySelector('kbd').textContent = slot + 1;
      if (item) {
        cell.querySelector('.icon').textContent = item.icon;
        cell.style.borderColor = rarityColor(item);
        cell.style.background = `linear-gradient(180deg, ${rarityColor(item)}55, rgba(17, 15, 26, 0.85))`;
        cell.title = `${item.name} (${catalog.rarities[item.rarity].name}) — ${item.description}`;
        cell.addEventListener('click', () => useSlot(slot));
      }
      ui.hotbar.appendChild(cell);
    }

    ui.inventoryList.innerHTML = '';
    if (!inventory.length) ui.inventoryList.innerHTML = '<li class="empty">Empty. Open chests (E) and supply drops to find dev loot!</li>';
    inventory.forEach((entry, index) => {
      const item = itemDefinition(entry.id);
      if (!item) return;
      const row = document.createElement('li');
      row.style.borderLeftColor = rarityColor(item);
      const label = document.createElement('div');
      label.innerHTML = '<b></b><small></small>';
      label.querySelector('b').textContent = `${index + 1}. ${item.icon} ${item.name}`;
      label.querySelector('small').textContent = `${catalog.rarities[item.rarity].name} · ${item.description}`;
      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.textContent = item.kind === 'wearable' || item.kind === 'pet' || item.kind === 'tool' ? 'Equip' : 'Use';
      useButton.addEventListener('click', () => useSlot(index));
      const dropButton = document.createElement('button');
      dropButton.type = 'button';
      dropButton.className = 'secondary';
      dropButton.textContent = 'Drop';
      dropButton.addEventListener('click', () => dropSlot(index));
      row.append(label, useButton, dropButton);
      ui.inventoryList.appendChild(row);
    });
  }

  function showToast(item, from) {
    const rarity = catalog.rarities[item.rarity];
    ui.toast.innerHTML = '<span class="icon"></span><div><small></small><b></b></div>';
    ui.toast.querySelector('.icon').textContent = item.icon;
    ui.toast.querySelector('small').textContent = `${rarity.name.toUpperCase()} · from a ${from === 'drop' ? 'supply drop' : 'chest'}`;
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
    ui.buffs.textContent = active.map(([name, until]) => `${{ speed: '☕', jump: '⚡', jetpack: '🚀', lens: '🔍' }[name]} ${Math.ceil((until - now) / 1000)}s`).join('   ');
  }

  // --------------------------------------------------------------------------
  // Item effects
  // --------------------------------------------------------------------------
  function applyEffect(item) {
    const now = performance.now();
    switch (item.effect || item.kind) {
      case 'speed': buffs.speed = now + item.seconds * 1000; hooks.system('☕ Espresso kicked in: you run faster!'); break;
      case 'jump': buffs.jump = now + item.seconds * 1000; hooks.system('⚡ Energy Drink: you jump higher!'); break;
      case 'jetpack': buffs.jetpack = now + item.seconds * 1000; hooks.system('🚀 Jetpack.js loaded: hold Space to fly!'); break;
      case 'lens': buffs.lens = now + item.seconds * 1000; hooks.system('🔍 Debugger Lens: double damage against bugs for 60s.'); break;
      case 'tip': hooks.system(`${item.icon} ${DEV_TIPS[Math.floor(Math.random() * DEV_TIPS.length)]}`); break;
      case 'confetti': hooks.confetti(); hooks.system('✅ All checks passed!'); break;
      case 'teleport': hooks.teleportRandom(); break;
      case 'revert': hooks.revertTeleport(); break;
      case 'pet':
        if (duckPet) { hooks.scene.remove(duckPet); duckPet = null; hooks.system('🦆 Your duck waddles home.'); }
        else { duckPet = buildDuck(); duckPet.position.copy(hooks.avatarPosition()); hooks.scene.add(duckPet); hooks.system('🦆 Quack! Your Rubber Duck Debugger is following you.'); }
        break;
      case 'tool': hooks.equipHammer(); break;
      case 'wearable': hooks.toggleWearable(item.wearable); break;
      default: break;
    }
  }

  // --------------------------------------------------------------------------
  // Actions (server-authoritative, or simulated locally in solo mode)
  // --------------------------------------------------------------------------
  const local = {
    open(loot) {
      if (inventory.length >= 20) { hooks.system('Your inventory is full (20). Use or /drop something first.'); return; }
      const weightKey = loot.kind === 'drop' ? 'dropWeight' : 'chestWeight';
      const rarities = Object.entries(catalog.rarities).filter(([, rarity]) => rarity[weightKey] > 0);
      let roll = Math.random() * rarities.reduce((sum, [, rarity]) => sum + rarity[weightKey], 0);
      const [rarityKey] = rarities.find(([, rarity]) => (roll -= rarity[weightKey]) < 0) || rarities[0];
      const options = catalog.items.filter((item) => item.rarity === rarityKey);
      const item = options[Math.floor(Math.random() * options.length)];
      inventory.push({ id: item.id, foundAt: Date.now() });
      saveLocalInventory();
      renderInventory();
      showToast(item, loot.kind);
      if (loot.kind === 'drop') removeLoot(loot.id);
      else { upsertLoot({ id: loot.id, open: true }); setTimeout(() => upsertLoot({ id: loot.id, open: false }), 120000); }
    },
    use(index) {
      const item = inventory[index] && itemDefinition(inventory[index].id);
      if (!item) return;
      if (item.kind === 'consumable') { inventory.splice(index, 1); saveLocalInventory(); renderInventory(); }
      applyEffect(item);
    },
    drop(index) { inventory.splice(index, 1); saveLocalInventory(); renderInventory(); }
  };

  function saveLocalInventory() {
    try { localStorage.setItem(`github-multiverse-inventory-${hooks.localTag()}`, JSON.stringify(inventory)); } catch (error) { /* storage unavailable */ }
  }

  function online() {
    return hooks.socket && hooks.socket.connected;
  }

  function tryOpen() {
    if (!nearestLoot) return false;
    if (nearestLoot.landsAtLocal > performance.now()) { hooks.system('The supply drop is still falling!'); return true; }
    if (online()) hooks.socket.emit('loot_open', { id: nearestLoot.id });
    else local.open(nearestLoot);
    return true;
  }

  function useSlot(index) {
    if (!inventory[index]) return;
    if (online()) hooks.socket.emit('item_use', { index });
    else local.use(index);
  }

  function dropSlot(index) {
    if (!inventory[index]) return;
    if (online()) hooks.socket.emit('item_drop', { index });
    else local.drop(index);
  }

  // --------------------------------------------------------------------------
  // Per-frame update: falling drops, glow, duck pet and the "Press E" prompt
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

    if (duckPet) {
      const target = avatar.clone().add(new THREE.Vector3(1.6, 0, 1.6));
      duckPet.position.lerp(target, 1 - Math.exp(-deltaSeconds * 4));
      duckPet.position.y = avatar.y + Math.abs(Math.sin(time * 6)) * 0.15;
      duckPet.rotation.y = Math.atan2(avatar.x - duckPet.position.x, avatar.z - duckPet.position.z);
    }
    if (Math.floor(time * 4) !== Math.floor((time - deltaSeconds) * 4)) renderBuffs();
  }

  // Movement multipliers used by the avatar physics in main.js
  function modifiers() {
    const now = performance.now();
    return { speed: buffs.speed > now ? 1.6 : 1, jump: buffs.jump > now ? 1.6 : 1, jetpack: buffs.jetpack > now, lens: buffs.lens > now };
  }

  function command(name, args) {
    switch (name) {
      case 'inv':
      case 'inventory':
        toggleInventory();
        return true;
      case 'use':
        useSlot(parseInt(args[0], 10) - 1);
        return true;
      case 'drop':
        if (!(parseInt(args[0], 10) >= 1)) { hooks.system('Usage: /drop <slot number>'); return true; }
        dropSlot(parseInt(args[0], 10) - 1);
        return true;
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

  function toggleInventory(force) {
    const show = typeof force === 'boolean' ? force : ui.inventoryPanel.style.display !== 'block';
    ui.inventoryPanel.style.display = show ? 'block' : 'none';
  }

  async function init(options) {
    hooks = options;
    catalog = await (await fetch('maps/loot.json')).json();
    if (hooks.socket) {
      hooks.socket.on('loot_spawns', (list) => list.forEach(upsertLoot));
      hooks.socket.on('loot_spawned', upsertLoot);
      hooks.socket.on('loot_state', ({ id, open }) => { if (loots[id]) upsertLoot({ ...loots[id], id, open, landsAt: null }); });
      hooks.socket.on('loot_removed', removeLoot);
      hooks.socket.on('inventory', (list) => { inventory = list; renderInventory(); });
      hooks.socket.on('loot_result', ({ item, from }) => showToast(itemDefinition(item), from));
      hooks.socket.on('item_effect', ({ item }) => applyEffect(itemDefinition(item)));
      hooks.socket.on('connect', () => hooks.socket.emit('loot_sync'));
      hooks.socket.emit('loot_sync');
    } else {
      catalog.spawns.forEach((spawn, index) => upsertLoot({ id: `chest${index}`, kind: 'chest', x: spawn.x, z: spawn.z, area: spawn.area, open: false }));
      try { inventory = JSON.parse(localStorage.getItem(`github-multiverse-inventory-${hooks.localTag()}`)) || []; } catch (error) { inventory = []; }
      // Solo supply drops every three minutes too
      setInterval(() => {
        const spot = catalog.spawns[Math.floor(Math.random() * catalog.spawns.length)];
        upsertLoot({ id: `drop${Date.now()}`, kind: 'drop', x: spot.x, z: spot.z, area: spot.area, open: false, landsAt: Date.now() + 20000 });
        hooks.system(`📦 A SUPPLY DROP is falling over ${spot.area}!`);
      }, 180000);
    }
    renderInventory();
  }

  function addBuff(name, seconds) {
    buffs[name] = performance.now() + seconds * 1000;
  }

  return { init, update, tryOpen, useSlot, command, modifiers, toggleInventory, addBuff };
})();
