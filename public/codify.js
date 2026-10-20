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
    docker: { name: 'Dockerfile', color: '#2496ed', keywords: ['FROM', 'RUN', 'COPY', 'WORKDIR', 'ENV', 'EXPOSE', 'CMD', 'USER', 'AS', 'ARG', 'ENTRYPOINT'] },
    yaml: { name: 'YAML', color: '#cb171e', keywords: ['name', 'on', 'jobs', 'steps', 'uses', 'run', 'with', 'apiVersion', 'kind', 'metadata', 'spec'] },
    shell: { name: 'Shell', color: '#4eaa25', keywords: ['alias', 'export', 'if', 'then', 'fi', 'for', 'do', 'done', 'cd', 'echo'] },
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
      <div class="codify-editor"><pre id="codify-highlight" aria-hidden="true"></pre><textarea id="codify-code" spellcheck="false" maxlength="${MAX_CODE}" placeholder="// Write some code...\nfunction hello(dev) {\n  return 'Hello, ' + dev;\n}"></textarea></div>
      <div class="codify-row">
        <button type="button" id="codify-add">Add to world</button>
        <label class="codify-share"><input type="checkbox" id="codify-share"> Visible to others</label>
      </div>
      <p id="codify-status">Your code blocks are private: only you can see them.</p>
      <div id="codify-report"></div>
      <div id="codify-packages"></div>`;
    document.body.appendChild(panel);
    ui = {
      panel,
      language: panel.querySelector('#codify-language'),
      code: panel.querySelector('#codify-code'),
      add: panel.querySelector('#codify-add'),
      share: panel.querySelector('#codify-share'),
      status: panel.querySelector('#codify-status'),
      report: panel.querySelector('#codify-report'),
      highlight: panel.querySelector('#codify-highlight')
    };
    // Colored code: a highlighted copy sits under the transparent textarea
    const repaint = () => { paintEditor(); };
    ui.code.addEventListener('input', repaint);
    ui.code.addEventListener('scroll', () => { ui.highlight.scrollTop = ui.code.scrollTop; ui.highlight.scrollLeft = ui.code.scrollLeft; });
    ui.language.addEventListener('change', repaint);
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

  // --------------------------------------------------------------------------
  // Editor syntax colors (GitHub dark palette), per language
  // --------------------------------------------------------------------------
  const CONSTANTS = ['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'this', 'self', 'super', 'NULL'];
  const EXTRA_KEYWORDS = {
    javascript: ['of', 'in', 'do', 'switch', 'case', 'break', 'continue', 'default', 'throw', 'finally', 'typeof', 'instanceof', 'delete', 'yield', 'extends', 'static', 'get', 'set'],
    typescript: ['var', 'of', 'in', 'switch', 'case', 'break', 'continue', 'default', 'throw', 'finally', 'typeof', 'extends', 'implements', 'enum', 'public', 'private', 'readonly', 'as', 'keyof', 'new', 'while'],
    python: ['in', 'is', 'not', 'and', 'or', 'pass', 'break', 'continue', 'raise', 'finally', 'global', 'yield', 'del', 'assert'],
    rust: ['const', 'static', 'trait', 'where', 'while', 'in', 'as', 'ref', 'move', 'mod', 'crate', 'dyn', 'async', 'await', 'break', 'continue'],
    go: ['switch', 'case', 'default', 'break', 'continue', 'interface', 'map', 'chan', 'select', 'goto', 'fallthrough'],
    java: ['protected', 'final', 'extends', 'implements', 'interface', 'throws', 'throw', 'finally', 'switch', 'case', 'break', 'continue', 'package', 'this', 'int', 'boolean', 'double', 'long', 'char', 'String'],
    c: ['const', 'static', 'unsigned', 'long', 'short', 'double', 'float', 'switch', 'case', 'break', 'continue', 'sizeof', 'typedef', 'enum', 'define'],
    shell: ['else', 'elif', 'while', 'case', 'esac', 'function', 'local', 'return', 'in', 'sudo', 'npm', 'git', 'cat', 'grep'],
    sql: ['CREATE', 'TABLE', 'AND', 'OR', 'NOT', 'NULL', 'AS', 'ON', 'LEFT', 'RIGHT', 'INNER', 'LIMIT', 'SET', 'PRIMARY', 'KEY', 'INT', 'TEXT', 'VARCHAR', 'COUNT', 'HAVING', 'DISTINCT']
  };
  const span = (kind, text) => `<span class="ck-${kind}">${escapeHtml(text)}</span>`;

  function highlightCode(code, language) {
    const lang = LANGUAGES[language] || LANGUAGES.javascript;
    if (language === 'html') {
      return code.replace(/(<!--[\s\S]*?(?:-->|$))|(<\/?)([\w-]+)([^>]*)(>?)|([^<]+)/g, (match, comment, open, tag, attrs, close, text) => {
        if (comment) return span('comment', comment);
        if (text) return escapeHtml(text);
        const attrHtml = attrs.replace(/([\w-:@]+)(=)?("[^"]*"|'[^']*')?|([^\w"']+)/g, (m, name, eq, value, rest) => (rest ? escapeHtml(rest) : span('attr', name) + (eq || '') + (value ? span('string', value) : '')));
        return escapeHtml(open) + span('tag', tag) + attrHtml + escapeHtml(close);
      });
    }
    const caseless = ['sql', 'docker'].includes(language);
    const keywords = new Set([...lang.keywords, ...(EXTRA_KEYWORDS[language] || [])].map((word) => (caseless ? word.toUpperCase() : word)));
    const hashComments = ['python', 'shell', 'yaml', 'docker'].includes(language);
    const pattern = new RegExp([
      '(\\/\\*[\\s\\S]*?(?:\\*\\/|$))', // block comment
      hashComments ? '(#[^\\n]*)' : language === 'sql' ? '(--[^\\n]*)' : '(\\/\\/[^\\n]*)', // line comment
      '("(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?|`(?:\\\\.|[^`\\\\])*`?)', // strings
      '(\\b\\d+(?:\\.\\d+)?\\b)', // numbers
      '(@[A-Za-z_]\\w*)', // decorators / annotations
      '([A-Za-z_$][\\w$]*)' // words
    ].join('|'), 'g');
    let html = '';
    let last = 0;
    code.replace(pattern, (match, block, line, string, number, decorator, word, offset) => {
      html += escapeHtml(code.slice(last, offset));
      last = offset + match.length;
      if (block && !hashComments) html += span('comment', block);
      else if (block) html += escapeHtml(block);
      else if (line) html += span('comment', line);
      else if (string) html += span('string', string);
      else if (number) html += span('number', number);
      else if (decorator) html += span('function', decorator);
      else if (word) {
        const after = code.slice(last).match(/^\s*(\(|:)/);
        if (keywords.has(caseless ? word.toUpperCase() : word)) html += span('keyword', word);
        else if (CONSTANTS.includes(word)) html += span('constant', word);
        else if (language === 'yaml' && after && after[1] === ':') html += span('attr', word);
        else if (after && after[1] === '(') html += span('function', word);
        else if (/^[A-Z][a-z]/.test(word)) html += span('type', word);
        else html += escapeHtml(word);
      }
      return match;
    });
    return html + escapeHtml(code.slice(last));
  }

  function paintEditor() {
    if (!ui || !ui.highlight) return;
    // A trailing newline needs a placeholder so the last empty line keeps its height
    ui.highlight.innerHTML = highlightCode(ui.code.value, ui.language.value) + '\n ';
    ui.highlight.scrollTop = ui.code.scrollTop;
    ui.highlight.scrollLeft = ui.code.scrollLeft;
  }

  function setStatus() {
    paintEditor();
    if (!active) { ui.status.textContent = 'Write some code and press "Add to world". Blocks are private unless you tick "Visible to others".'; return; }
    ui.status.textContent = active.shared ? 'Shared: devs near you can see this block and its code live.' : 'Private: only you can see this block. Edits appear in the world as you type.';
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
    hooks.system('Code block added to the world. Keep typing: it updates live. Press F next to any firepit to "Fry your Code".');
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
      hooks.system('Fry your Code: first write some code with Codify (C) and press "Add to world".');
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
    hooks.system(`Roasting your ${LANGUAGES[block.language].name} code over the fire... looking for bugs.`);
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
      const bug = PropKit.kit.textSprite('BUG', { width: 1.2, background: 'rgba(201, 42, 42, 0.9)' });
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
    const verdict = bugs.length === 0 ? 'Perfectly toasted: no bugs found!' : `${bugs.length} bug${bugs.length > 1 ? 's' : ''} burned out of your code:`;
    hooks.system(`Fry your Code — ${verdict}`);
    ui.report.innerHTML = `<h4>Roast report</h4><p>${verdict}</p>${bugs.length ? `<ul>${bugs.map((bug) => `<li>${bug.line ? `<b>line ${bug.line}</b> ` : ''}${escapeHtml(bug.message)}</li>`).join('')}</ul>` : ''}<p class="codify-note">A playful bug finder (simple checks + the JavaScript parser), not a full linter.</p>`;
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

  // Opens the editor with a ready-made template (e.g. a dish from the Underground Cafe)
  function loadTemplate(title, language, code) {
    active = null;
    ui.language.value = LANGUAGES[language] ? language : 'javascript';
    ui.code.value = code;
    ui.report.innerHTML = `<h4>${escapeHtml(title)}</h4><p>Your package is in the editor. Press "Add to world" to place it as a code block.</p>`;
    open();
  }


  // --------------------------------------------------------------------------
  // Night soundtrack: "Hand Covers Bruise" (The Social Network) plays only at
  // night while Codify is open or a block is roasting at a firepit. It is a
  // hidden YouTube player (no audio file is shipped); the video can be changed
  // with localStorage "multiverse-night-music" (a YouTube link or video id).
  // --------------------------------------------------------------------------
  // Default tracks: licensed orchestral recordings of "Hand Covers Bruise"
  // (The Original Movies Orchestra, The London Film Score Orchestra). Players
  // add more with /music add <YouTube link>.
  const NIGHT_MUSIC_DEFAULT = ['fVv5RnNM8hg', 'gG8S3_krTpI'];
  const music = { frame: null, ready: false, playing: false, volume: 0, target: 0, lastSent: -1 };

  function youtubeId(text) {
    const match = String(text || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || String(text || '').trim().match(/^([\w-]{11})$/);
    return match ? match[1] : null;
  }

  function customTracks() {
    let saved = '';
    try { saved = localStorage.getItem('multiverse-night-music') || ''; } catch (error) { saved = ''; }
    return saved.split(/[\s,]+/).map(youtubeId).filter(Boolean);
  }

  function nightMusicTracks() {
    const tracks = [...NIGHT_MUSIC_DEFAULT, ...customTracks()].filter((id, index, list) => list.indexOf(id) === index);
    // A different track first every time the player starts
    const first = Math.floor(Math.random() * tracks.length);
    return [...tracks.slice(first), ...tracks.slice(0, first)];
  }

  // /music add <link> | remove <link> | list | next | clear
  function musicChat(args, say) {
    const action = (args[0] || 'list').toLowerCase();
    const saveCustom = (list) => { try { localStorage.setItem('multiverse-night-music', list.join(',')); } catch (error) { /* storage blocked */ } };
    if (action === 'add' || action === 'remove') {
      const id = youtubeId(args[1]);
      if (!id) { say(`Usage: /music ${action} <YouTube link>`); return; }
      const list = customTracks().filter((track) => track !== id);
      if (action === 'add') list.push(id);
      saveCustom(list);
      resetMusicPlayer();
      say(action === 'add' ? `Night soundtrack: track added (${list.length + NIGHT_MUSIC_DEFAULT.length} in the playlist).` : 'Night soundtrack: track removed.');
    } else if (action === 'clear') {
      saveCustom([]);
      resetMusicPlayer();
      say('Night soundtrack: back to the default tracks.');
    } else if (action === 'next' || action === 'skip') {
      if (music.ready && music.playing) { musicCommand('nextVideo'); say('Night soundtrack: next track.'); } else say('The night soundtrack plays at night while Codify is open or your code is frying.');
    } else {
      const all = [...NIGHT_MUSIC_DEFAULT, ...customTracks()];
      say(`Night soundtrack (${all.length} tracks): ${all.map((id) => `youtu.be/${id}`).join(' · ')}. Use /music add <YouTube link>, /music remove <link>, /music next or /music clear.`);
    }
  }

  function resetMusicPlayer() {
    if (music.frame) music.frame.remove();
    music.frame = null;
    music.ready = false;
    music.playing = false;
    music.volume = 0;
    music.lastSent = -1;
  }

  function musicCommand(func, args = []) {
    if (!music.frame || !music.frame.contentWindow) return;
    music.frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }

  function createMusicPlayer() {
    const tracks = nightMusicTracks();
    const id = tracks[0];
    const frame = document.createElement('iframe');
    frame.title = 'Night soundtrack';
    frame.allow = 'autoplay';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:-10px;opacity:0;pointer-events:none;border:0';
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&loop=1&playlist=${tracks.join(',')}&controls=0&enablejsapi=1&playsinline=1`;
    frame.addEventListener('load', () => {
      music.ready = true;
      music.lastSent = -1;
      musicCommand('setVolume', [0]);
      musicCommand('playVideo');
      music.playing = true;
    });
    document.body.appendChild(frame);
    music.frame = frame;
  }

  // Called every frame: fades the soundtrack in (night + Codify/roast) or out
  function updateMusic(isNight, deltaSeconds = 1 / 60) {
    const soundOn = typeof Sound === 'undefined' || !Sound.isEnabled || Sound.isEnabled();
    const wanted = Boolean(isNight && soundOn && (isOpen() || roast));
    music.target = wanted ? 60 : 0;
    if (wanted && !music.frame) {
      try { createMusicPlayer(); } catch (error) { console.warn('Night music unavailable', error); }
    }
    if (!music.ready) return;
    const step = deltaSeconds * (wanted ? 25 : 40);
    music.volume = music.volume < music.target ? Math.min(music.target, music.volume + step) : Math.max(music.target, music.volume - step);
    const rounded = Math.round(music.volume);
    if (rounded !== music.lastSent) { musicCommand('setVolume', [rounded]); music.lastSent = rounded; }
    if (wanted && !music.playing) { musicCommand('playVideo'); music.playing = true; }
    if (!wanted && music.playing && music.volume <= 0) { musicCommand('pauseVideo'); music.playing = false; }
  }

  return { init, open, close, isOpen, update, updateMusic, musicChat, highlightCode, isRoasting: () => Boolean(roast), interact, startRoast, findBugs, loadTemplate };
})();
