// ============================================================================
// UNDERGROUND CAFE: ORDER DISHES AND DRINKS WITH MULTIVERSE COINS
// ============================================================================
// Like Roblox restaurants, but every dish is a package of code or tools: a
// Dockerfile, a CI workflow, a Kubernetes deployment... Ordering (paid in MVC,
// in-game coins) serves the dish on the counter and opens its package in
// Codify, ready to "Add to world". Drinks also give a short buff. The menu
// lives in maps/cafe_menu.json; the server reads the prices from the same file.
const Cafe = (() => {
  let hooks = null;
  let menu = null;
  let overlay = null;
  const served = [];

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'cafe-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box panel cafe-box">
        <header><b>☕ Underground Cafe · Menu</b><span id="cafe-wallet"></span><button type="button" id="cafe-close" aria-label="Close">&times;</button></header>
        <p class="cafe-intro">Every dish is a package of code or tools: it is served on the counter and opens in Codify. Paid with Multiverse Coins (in-game only).</p>
        <div id="cafe-sections"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cafe-close').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  function render() {
    const container = overlay.querySelector('#cafe-sections');
    container.innerHTML = '';
    menu.sections.forEach((section) => {
      const block = document.createElement('section');
      block.innerHTML = `<h3>${section.title}</h3>`;
      section.items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'cafe-item';
        card.innerHTML = `<div><b>${item.name}</b><p>${item.description}</p><small>📦 ${item.package}</small></div>`;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${item.price} MVC`;
        button.addEventListener('click', () => order(item));
        card.appendChild(button);
        block.appendChild(card);
      });
      container.appendChild(block);
    });
  }

  function open() {
    if (!menu) return;
    hooks.releaseKeys();
    overlay.querySelector('#cafe-wallet').textContent = `🪙 ${hooks.wallet()} MVC`;
    render();
    overlay.style.display = 'flex';
  }

  function close() {
    overlay.style.display = 'none';
  }

  function isOpen() {
    return overlay && overlay.style.display === 'flex';
  }

  function order(item) {
    if (!hooks.socket || !hooks.socket.connected) { hooks.system('The cafe needs the multiplayer server to take orders.'); return; }
    hooks.socket.emit('cafe_order', { id: item.id });
  }

  // A plate (or a glass) on the counter in front of you, slowly spinning
  function dishModel(item, sectionTitle) {
    const { box, cylinder, sphere, material, glow, textSprite } = PropKit.kit;
    const dish = new THREE.Group();
    const drink = sectionTitle.startsWith('Drinks');
    if (drink) {
      dish.add(cylinder(0.22, 0.16, 0.5, material('#e7f5ff', { transparent: true, opacity: 0.5, roughness: 0.05 }), 0, 0.25, 0, 16));
      dish.add(cylinder(0.2, 0.15, 0.35, material(item.buff === 'speed' ? '#e8590c' : item.buff === 'jetpack' ? '#f8f9fa' : item.buff === 'lens' ? '#69db7c' : '#c92a2a', { transparent: true, opacity: 0.85 }), 0, 0.2, 0, 16));
      dish.add(sphere(0.06, glow('#ffd43b', 1), 0.15, 0.5, 0, 8));
    } else {
      dish.add(cylinder(0.45, 0.38, 0.06, material('#f8f9fa', { roughness: 0.3 }), 0, 0.03, 0, 24));
      const pizza = sectionTitle.includes('Pizza');
      if (pizza) {
        dish.add(cylinder(0.4, 0.4, 0.05, material('#f4c27a'), 0, 0.09, 0, 24));
        dish.add(cylinder(0.36, 0.36, 0.02, material('#e03131'), 0, 0.12, 0, 24));
        for (let i = 0; i < 7; i++) dish.add(sphere(0.05, material(['#fff3bf', '#2b8a3e', '#862e9c'][i % 3]), Math.cos(i) * 0.2, 0.14, Math.sin(i) * 0.2, 6));
      } else {
        const food = sphere(0.28, material(sectionTitle.startsWith('Dessert') ? '#f3d9a4' : '#f2c14e', { roughness: 0.8 }), 0, 0.15, 0, 12);
        food.scale.y = 0.5;
        dish.add(food);
      }
      // A tiny code-package cube on the dish: the "tool" inside the food
      dish.add(box(0.14, 0.14, 0.14, glow('#4dabf7', 1.2), 0, 0.3, 0));
    }
    const label = textSprite(item.name, { width: 2.2, background: 'rgba(43, 27, 18, 0.9)' });
    label.position.y = 0.9;
    dish.add(label);
    return dish;
  }

  function serve(id) {
    const section = menu.sections.find((candidate) => candidate.items.some((item) => item.id === id));
    const item = section && section.items.find((candidate) => candidate.id === id);
    if (!item) return;
    close();
    const spot = hooks.spotInFront(1.2);
    const dish = dishModel(item, section.title);
    dish.position.set(spot.x, spot.y + 1.15, spot.z);
    dish.traverse((node) => { node.raycast = () => {}; });
    hooks.scene.add(dish);
    served.push({ dish, until: performance.now() + 60000 });
    hooks.system(`🍽️ Served: ${item.name}. ${item.package}`);
    if (item.buff) hooks.buff(item.buff, item.buffSeconds || 30);
    hooks.emote('coffee');
    Codify.loadTemplate(item.name, item.language, item.template);
    download(item);
  }

  // The package is really yours: it is saved as a file on your computer and
  // kept in "My packages" (in the Codify panel) to download again anytime
  function download(item) {
    const blob = new Blob([`${item.template}\n`], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = item.filename || `${item.id}.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
    hooks.system(`📦 ${link.download} downloaded to your computer. It is also in Codify → My packages.`);
  }

  function itemById(id) {
    if (!menu) return null;
    for (const section of menu.sections) {
      const found = section.items.find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  }

  function showPackages(ids) {
    const list = document.getElementById('codify-packages');
    if (!list) return;
    const items = ids.map(itemById).filter(Boolean);
    list.innerHTML = items.length ? '<h4>📦 My packages</h4>' : '';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'codify-package';
      row.innerHTML = `<span>${item.name}<small>${item.filename}</small></span>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = 'Open';
      open.addEventListener('click', () => Codify.loadTemplate(item.name, item.language, item.template));
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'Download';
      save.addEventListener('click', () => download(item));
      row.append(open, save);
      list.appendChild(row);
    });
  }

  function update(time) {
    for (let i = served.length - 1; i >= 0; i--) {
      const { dish, until } = served[i];
      dish.rotation.y = time * 0.6;
      if (performance.now() > until) { hooks.scene.remove(dish); served.splice(i, 1); }
    }
  }

  function init(options) {
    hooks = options;
    buildOverlay();
    let owned = [];
    fetch('maps/cafe_menu.json').then((response) => response.json()).then((data) => { menu = data; showPackages(owned); }).catch(() => { menu = null; });
    if (hooks.socket) {
      hooks.socket.on('cafe_served', ({ id }) => serve(id));
      hooks.socket.on('packages', (ids) => { owned = Array.isArray(ids) ? ids : []; showPackages(owned); });
    }
  }

  return { init, open, close, isOpen, update };
})();
