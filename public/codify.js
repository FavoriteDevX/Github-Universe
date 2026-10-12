// ============================================================================
// CODIFY: WRITE CODE AND PLACE IT IN THE WORLD
// ============================================================================
// C (or "Codify" near a laptop) opens a side panel on the right that replaces
// the map cards: pick a language, write code and press "Add to world". A soft
// spinning terminal block floats over the ground in front of you, with your
// code appearing above it in real time as you type. Blocks are PRIVATE: only
// you see them, unless you tick "Visible to others" (then the server relays
// the block to the devs in your lobby). At the Genesis Plaza firepit,
// "Fry your Code" puts your block on a stick and roasts it: a bug finder that
// reports suspicious code while the bugs pop out of the fire.
const Codify = (() => {
  const LANGUAGES = {
    javascript: { name: 'JavaScript', color: '#f7df1e', keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'async', 'await', 'import', 'export', 'try', 'catch'] },
    typescript: { name: 'TypeScript', color: '#3178c6', keywords: ['const', 'let', 'function', 'return', 'if', 'else', 'for', 'interface', 'type', 'class', 'async', 'await', 'import', 'export', 'try', 'catch'] },
    python: { name: 'Python', color: '#3776ab', keywords: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'try', 'except', 'with', 'as', 'lambda', 'async', 'await'] },
    rust: { name: 'Rust', color: '#f74c00', keywords: ['fn', 'let', 'mut', 'pub', 'struct', 'impl', 'enum', 'match', 'if', 'else', 'for', 'loop', 'return', 'use'] },
    go: { name: 'Go', color: '#00add8', keywords: ['func', 'var', 'const', 'return', 'if', 'else', 'for', 'range', 'type', 'struct', 'package', 'import', 'go', 'defer'] },
    java: { name: 'Java', color: '#e76f00', keywords: ['public', 'private', 'class', 'static', 'void', 'return', 'if', 'else', 'for', 'while', 'new', 'try', 'catch', 'import'] },
    c: { name: 'C', color: '#a8b9cc', keywords: ['int', 'char', 'void', 'return', 'if', 'else', 'for', 'while', 'struct', 'include', 'malloc', 'free'] },
    html: { name: 'HTML', color: '#e34f26', keywords: [] },
    sql: { name: 'SQL', color: '#336791', keywords: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'GROUP', 'BY', 'ORDER', 'INTO', 'VALUES'] }
  };
  const MAX_CODE = 4000;
  let hooks = null;
  let ui = null;
  let active = null; // the block being edited
  const blocks = new Map(); // id -> block (own and others' shared blocks)
  let roast = null;
  let syncTimer = null;

  // --------------------------------------------------------------------------
  // Side panel (built here so index.html stays simple)
  // --------------------------------------------------------------------------
  function buildPanel() {
    const panel = document.createElement('aside');
    panel.id = 'codify-panel';
    panel.innerHTML = `
      <header><b>&lt;/&gt; Codify</b><button type="button" id="codify-close" aria-label="Close">&times;</button></header>
      <label>Language <select id="codify-language">${Object.entries(LANGUAGES).map(([key, lang]) => `<option value="${key}">${lang.name}</option>`).join('')}</select></label>
      <textarea id="codify-code" spellcheck="false" maxlength="${MAX_CODE}" placeholder="// Write some code...\nfunction hello(dev) {\n  return 'Hello, ' + dev;\n}"></textarea>
      <div class="codify-row">
        <button type="button" id="codify-add">Add to world</button>
        <label class="codify-share"><input type="checkbox" id="codify-share"> Visible to others</label>
      </div>
      <p id="codify-status">Your code blocks are private: only you can see them.</p>
      <div id="codify-report"></div>`;
    document.body.appendChild(panel);
    ui = {
      panel,
      language: panel.querySelector('#codify-language'),
      code: panel.querySelector('#codify-code'),
      add: panel.querySelector('#codify-add'),
      share: panel.querySelector('#codify-share'),
      status: panel.querySelector('#codify-status'),
      report: panel.querySelector('#codify-report')
    };
    panel.querySelector('#codify-close').addEventListener('click', close);
    ui.add.addEventListener('click', () => {
      if (active) { active = null; ui.add.textContent = 'Add to world'; ui.code.value = ''; setStatus(); return; }
      addToWorld();
    });
    ui.code.addEventListener('input', () => { if (active) updateBlock(active, { code: ui.code.value }); });
    ui.language.addEventListener('change', () => { if (active) updateBlock(active, { language: ui.language.value }); });
    ui.share.addEventListener('change', () => { if (active) updateBlock(active, { shared: ui.share.checked }); setStatus(); });
    ui.code.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { close(); return; }
      if (event.key === 'Tab') { // indent instead of leaving the editor
        event.preventDefault();
        const { selectionStart, selectionEnd, value } = ui.code;
        ui.code.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
        ui.code.selectionStart = ui.code.selectionEnd = selectionStart + 2;
        ui.code.dispatchEvent(new Event('input'));
      }
    });
  }

  function setStatus() {
    if (!active) { ui.status.textContent = 'Write some code and press "Add to world". Blocks are private unless you tick "Visible to others".'; return; }
    ui.status.textContent = active.shared ? '👀 Shared: devs near you can see this block and its code live.' : '🔒 Private: only you can see this block. Edits appear in the world as you type.';
  }

  function open(block) {
    hooks.releaseKeys();
    document.body.classList.add('codify-open');
    if (block && block.own) {
      active = block;
      ui.code.value = block.code;
      ui.language.value = block.language;
      ui.share.checked = block.shared;
      ui.add.textContent = 'New block';
    } else if (!active) {
      ui.add.textContent = 'Add to world';
    }
    setStatus();
    ui.code.focus();
  }

  function close() {
    document.body.classList.remove('codify-open');
    ui.code.blur();
  }

  function isOpen() {
    return document.body.classList.contains('codify-open');
  }

  // --------------------------------------------------------------------------
  // Code blocks in the scene
  // --------------------------------------------------------------------------
  function terminalTexture(color) {
    return PropKit.kit.canvasTexture(`terminal|${color}`, 256, 256, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#2b3137');
      gradient.addColorStop(1, '#0d1117');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 120px Menlo, Consolas, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('>_', 40, h / 2 + 6);
    });
  }

  function highlight(ctx, line, x, y, keywords) {
    // Tiny syntax highlighter: strings, comments, keywords, numbers
    if (/^\s*(\/\/|#|--)/.test(line)) { ctx.fillStyle = '#8b949e'; ctx.fillText(line, x, y); return; }
    const tokens = line.split(/(\s+|[()[\]{};,.=+\-*/<>:'"`])/);
    let cursor = x;
    let inString = null;
    tokens.forEach((token) => {
      if (!token) return;
      if (inString) ctx.fillStyle = '#a5d6ff';
      else if (/^['"`]$/.test(token)) ctx.fillStyle = '#a5d6ff';
      else if (keywords.includes(token)) ctx.fillStyle = '#ff7b72';
      else if (/^\d+(\.\d+)?$/.test(token)) ctx.fillStyle = '#79c0ff';
      else if (/^[A-Za-z_]\w*$/.test(token)) ctx.fillStyle = '#e6edf3';
      else ctx.fillStyle = '#d2a8ff';
      if (/^['"`]$/.test(token)) inString = inString === token ? null : inString || token;
      ctx.fillText(token, cursor, y);
      cursor += ctx.measureText(token).width;
    });
  }

  function drawCodePanel(block) {
    const { ctx, canvas, texture } = block.panel;
    const lang = LANGUAGES[block.language] || LANGUAGES.javascript;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.94)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = lang.color;
    ctx.fillRect(0, 0, canvas.width, 44);
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 26px Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${lang.name} · ${block.owner}${block.shared ? ' · shared' : ' · private'}`, 16, 23);
    ctx.font = '22px Menlo, Consolas, monospace';
    const lines = (block.code || '').split('\n').slice(0, 18);
    lines.forEach((line, index) => {
      ctx.fillStyle = '#6e7681';
      ctx.fillText(String(index + 1).padStart(2, ' '), 12, 70 + index * 26);
      highlight(ctx, line.slice(0, 60), 54, 70 + index * 26, lang.keywords);
    });
    if (block.code.split('\n').length > 18) { ctx.fillStyle = '#8b949e'; ctx.fillText('…', 54, 70 + 18 * 26); }
    texture.needsUpdate = true;
  }

  function createBlock({ id, owner, own, position, language, code, shared }) {
    const lang = LANGUAGES[language] || LANGUAGES.javascript;
    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);
    const cube = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ map: terminalTexture(lang.color), roughness: 0.3, metalness: 0.2, emissive: '#ffffff', emissiveMap: terminalTexture(lang.color), emissiveIntensity: 0.25 });
    const edge = new THREE.MeshStandardMaterial({ color: '#0d1117', roughness: 0.4, metalness: 0.4 });
    const body = new THREE.Mesh(PropKit.kit.roundedUnitBox ? PropKit.kit.roundedUnitBox(1, 1, 1, 0.18) : new THREE.BoxGeometry(1, 1, 1), edge);
    cube.add(body);
    [[0, 0, 0.51, 0], [0, 0, -0.51, Math.PI], [0.51, 0, 0, Math.PI / 2], [-0.51, 0, 0, -Math.PI / 2]].forEach(([x, y, z, rotation]) => {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), face);
      plate.position.set(x, y, z);
      plate.rotation.y = rotation;
      cube.add(plate);
    });
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 6, 48), new THREE.MeshStandardMaterial({ color: lang.color, emissive: lang.color, emissiveIntensity: 1.6 }));
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = -0.9;
    group.add(glowRing);
    group.add(cube);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 560;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(3.2, 2.8, 1);
    sprite.position.y = 2.6;
    sprite.raycast = () => {};
    group.add(sprite);
    const block = { id, owner, own, group, cube, glowRing, language, code: code || '', shared: !!shared, panel: { ctx: canvas.getContext('2d'), canvas, texture }, sprite };
    if (own) PropKit.kit.interactive(cube, 'codeblock', 'Code block');
    cube.userData.codeBlockId = id;
    hooks.scene.add(group);
    blocks.set(id, block);
    drawCodePanel(block);
    return block;
  }

  function updateBlock(block, changes) {
    Object.assign(block, changes);
    if (typeof block.code === 'string') block.code = block.code.slice(0, MAX_CODE);
    if (changes.language) {
      const lang = LANGUAGES[block.language] || LANGUAGES.javascript;
      block.glowRing.material.color.set(lang.color);
      block.glowRing.material.emissive.set(lang.color);
    }
    drawCodePanel(block);
    if (!block.own) return;
    if ('shared' in changes && !changes.shared) hooks.emit('code_block_remove', block.id);
    if (block.shared) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => sync(block), 250);
    }
  }

  function sync(block) {
    const { x, y, z } = block.group.position;
    hooks.emit('code_block_share', { id: block.id, position: { x, y, z }, language: block.language, code: block.code });
  }

  function addToWorld() {
    const position = hooks.spotInFront(3);
    const block = createBlock({
      id: `${hooks.localTag()}-${Date.now().toString(36)}`,
      owner: hooks.localTag(),
      own: true,
      position: { x: position.x, y: position.y + 1.4, z: position.z },
      language: ui.language.value,
      code: ui.code.value,
      shared: ui.share.checked
    });
    active = block;
    ui.add.textContent = 'New block';
    if (block.shared) sync(block);
    setStatus();
    hooks.system('🧱 Code block added to the world. Keep typing: it updates live. Walk to the Genesis Plaza firepit to "Fry your Code".');
  }

  function removeBlock(id) {
    const block = blocks.get(id);
    if (!block) return;
    hooks.scene.remove(block.group);
    const index = PropKit.interactables.indexOf(block.cube);
    if (index >= 0) PropKit.interactables.splice(index, 1);
    blocks.delete(id);
    if (active === block) active = null;
  }

  // --------------------------------------------------------------------------
  // Fry your Code: a bug finder dressed as a campfire roast
  // --------------------------------------------------------------------------
  function findBugs(code, language) {
    const findings = [];
    const lines = code.split('\n');
    const add = (line, message) => findings.push({ line, message });
    // Balanced brackets and quotes (ignoring strings and comments roughly)
    const stack = [];
    const pairs = { ')': '(', ']': '[', '}': '{' };
    lines.forEach((raw, index) => {
      const withoutStrings = raw.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
      const line = withoutStrings.replace(language === 'python' ? /#.*$/ : /\/\/.*$/, '');
      for (const char of line) {
        if ('([{'.includes(char)) stack.push({ char, line: index + 1 });
        else if (pairs[char]) {
          const top = stack.pop();
          if (!top || top.char !== pairs[char]) add(index + 1, `Unexpected "${char}": brackets do not match`);
        }
      }
      if (((raw.match(/"/g) || []).length % 2) === 1 && !raw.includes('"""')) add(index + 1, 'Unclosed string (odd number of ")');
      if (raw.length > 120) add(index + 1, 'Very long line (over 120 characters)');
      if (/\s+$/.test(raw) && raw.trim()) add(index + 1, 'Trailing whitespace');
      if (/\b(TODO|FIXME|HACK)\b/.test(raw)) add(index + 1, `Leftover ${raw.match(/\b(TODO|FIXME|HACK)\b/)[1]}`);
      if (/(password|passwd|secret|api_?key|token)\s*[:=]\s*["'][^"']+["']/i.test(raw)) add(index + 1, 'Hardcoded secret: move it to an environment variable');
      if (/\/\s*0(?![.\d])/.test(raw)) add(index + 1, 'Division by zero');
      if (/while\s*\(\s*true\s*\)|while\s+True\s*:|loop\s*\{|for\s*\(\s*;\s*;\s*\)/.test(raw) && !/break|return/.test(code)) add(index + 1, 'Infinite loop with no break/return');
      if (['javascript', 'typescript'].includes(language)) {
        if (/[^=!<>]==[^=]/.test(raw)) add(index + 1, 'Use === instead of == (type coercion)');
        if (/!=[^=]/.test(raw)) add(index + 1, 'Use !== instead of !=');
        if (/\bvar\s/.test(raw)) add(index + 1, 'Prefer let/const over var');
        if (/\beval\s*\(/.test(raw)) add(index + 1, 'eval() is dangerous');
        if (/console\.log/.test(raw)) add(index + 1, 'console.log left in the code');
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(raw)) add(index + 1, 'Empty catch block swallows errors');
      }
      if (language === 'python') {
        if (/^\s*except\s*:/.test(raw)) add(index + 1, 'Bare except: catches everything, even KeyboardInterrupt');
        if (/def\s+\w+\(.*=\s*(\[\]|\{\})/.test(raw)) add(index + 1, 'Mutable default argument');
        if (/^\s*print\s+[^(]/.test(raw)) add(index + 1, 'print without parentheses (Python 2 syntax)');
        if (/^\t+ +|^ +\t/.test(raw)) add(index + 1, 'Mixed tabs and spaces');
      }
      if (language === 'c' && /\bgets\s*\(/.test(raw)) add(index + 1, 'gets() can overflow the buffer: use fgets()');
      if (language === 'sql' && /\bDELETE\s+FROM\s+\w+\s*;?\s*$/i.test(raw)) add(index + 1, 'DELETE without WHERE deletes every row');
      if (language === 'rust' && /\.unwrap\(\)/.test(raw)) add(index + 1, 'unwrap() panics on errors: handle the Result');
      if (language === 'go' && /,\s*_\s*:?=/.test(raw) && /err/.test(raw) === false && /\(/.test(raw)) add(index + 1, 'Ignored error value');
    });
    stack.forEach((open) => add(open.line, `"${open.char}" is never closed`));
    // JavaScript: let the browser parser check the syntax (compiled, never run)
    if (language === 'javascript' && code.trim()) {
      try { new Function(code); } catch (error) { if (error instanceof SyntaxError) add(0, `Syntax error: ${error.message}`); }
    }
    const unique = [];
    findings.forEach((finding) => { if (!unique.some((other) => other.line === finding.line && other.message === finding.message)) unique.push(finding); });
    return unique.slice(0, 12);
  }

  function startRoast(firepit) {
    const block = active || [...blocks.values()].reverse().find((candidate) => candidate.own);
    if (!block) {
      hooks.system('🔥 Fry your Code: first write some code with Codify (C) and press "Add to world".');
      open();
      return;
    }
    if (roast) return;
    const fire = firepit.getWorldPosition(new THREE.Vector3());
    const avatar = hooks.avatarPosition();
    const direction = new THREE.Vector3(fire.x - avatar.x, 0, fire.z - avatar.z).normalize();
    // A tree branch stick from the avatar to above the fire with the block on its tip
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 6), new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 1 }));
    stick.raycast = () => {};
    hooks.scene.add(stick);
    const original = { position: block.group.position.clone(), scale: block.group.scale.clone(), visible: block.sprite.visible };
    block.sprite.visible = false;
    roast = { block, stick, fire, direction, start: performance.now(), original, bugs: findBugs(block.code, block.language), popped: [] };
    hooks.system(`🔥 Roasting your ${LANGUAGES[block.language].name} code over the fire... looking for bugs.`);
  }

  function updateRoast() {
    if (!roast) return;
    const { block, stick, fire, direction } = roast;
    const t = (performance.now() - roast.start) / 1000;
    const avatar = hooks.avatarPosition();
    const hand = new THREE.Vector3(avatar.x, avatar.y + 1.4, avatar.z).add(direction.clone().multiplyScalar(0.6));
    const tip = new THREE.Vector3(fire.x, fire.y + 2.2, fire.z).sub(direction.clone().multiplyScalar(0.3));
    const length = hand.distanceTo(tip);
    stick.scale.set(1, length, 1);
    stick.position.copy(hand).lerp(tip, 0.5);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(hand).normalize());
    block.group.position.copy(tip);
    block.group.scale.setScalar(0.45);
    block.cube.rotation.y = t * 3;
    // The block turns from cool to toasted while it roasts
    const heat = Math.min(1, t / 5);
    block.glowRing.material.emissive.setRGB(1, 0.5 - heat * 0.3, 0.1);
    // Each bug pops out of the fire as a little bug that burns up
    const due = Math.floor(t / (5 / Math.max(1, roast.bugs.length)));
    while (roast.popped.length < Math.min(due, roast.bugs.length)) {
      const bug = PropKit.kit.textSprite('🐛', { width: 1.2, background: 'rgba(0, 0, 0, 0)', font: 'bold 96px Segoe UI Emoji, Apple Color Emoji, sans-serif' });
      bug.position.copy(tip);
      bug.userData.born = t;
      bug.userData.drift = new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
      hooks.scene.add(bug);
      roast.popped.push(bug);
    }
    roast.popped.forEach((bug) => {
      const age = t - bug.userData.born;
      bug.position.copy(tip).add(bug.userData.drift.clone().multiplyScalar(age * 0.6)).add(new THREE.Vector3(0, -age * age * 0.8, 0));
      bug.material.opacity = Math.max(0, 1 - age / 2);
    });
    if (t > 6) finishRoast();
  }

  function finishRoast() {
    const { block, stick, original, bugs, popped } = roast;
    hooks.scene.remove(stick);
    popped.forEach((bug) => hooks.scene.remove(bug));
    block.group.position.copy(original.position);
    block.group.scale.copy(original.scale);
    block.sprite.visible = original.visible;
    const lang = LANGUAGES[block.language] || LANGUAGES.javascript;
    block.glowRing.material.emissive.set(lang.color);
    roast = null;
    const verdict = bugs.length === 0 ? '✨ Perfectly toasted: no bugs found!' : `🐛 ${bugs.length} bug${bugs.length > 1 ? 's' : ''} burned out of your code:`;
    hooks.system(`🔥 Fry your Code — ${verdict}`);
    ui.report.innerHTML = `<h4>🔥 Roast report</h4><p>${verdict}</p>${bugs.length ? `<ul>${bugs.map((bug) => `<li>${bug.line ? `<b>line ${bug.line}</b> ` : ''}${escapeHtml(bug.message)}</li>`).join('')}</ul>` : ''}<p class="codify-note">A playful bug finder (simple checks + the JavaScript parser), not a full linter.</p>`;
    open(block.own ? block : null);
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  // --------------------------------------------------------------------------
  function update(time) {
    blocks.forEach((block) => {
      if (roast && roast.block === block) return;
      block.cube.rotation.y = time * 0.6;
      block.cube.rotation.x = Math.sin(time * 0.7) * 0.15;
      block.cube.position.y = Math.sin(time * 1.4 + block.group.position.x) * 0.15;
    });
    updateRoast();
  }

  function init(options) {
    hooks = options;
    buildPanel();
    setStatus();
    const socket = options.socket;
    if (!socket) return;
    socket.on('code_blocks', (list) => list.forEach((data) => receive(data)));
    socket.on('code_block', receive);
    socket.on('code_block_remove', removeBlock);
  }

  function receive(data) {
    if (!data || blocks.has(data.id) && blocks.get(data.id).own) return;
    const existing = blocks.get(data.id);
    if (existing) { updateBlock(existing, { code: data.code, language: data.language }); return; }
    createBlock({ ...data, own: false, shared: true });
  }

  function interact(object) {
    const block = blocks.get(object.userData.codeBlockId);
    if (block) open(block);
  }

  return { init, open, close, isOpen, update, interact, startRoast, findBugs };
})();
