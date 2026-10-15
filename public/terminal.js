// ============================================================================
// THE TERMINAL APEX (THE >_ ROOT): A BUILDING SHAPED LIKE THE TERMINAL ICON
// ============================================================================
// District "terminal" (96 x 96 m). The tower is a giant upright rounded slab
// (rounded in front, side AND top view) with a dark body, a lighter "title
// bar" band at the top and a glowing ">_" prompt (the underscore blinks).
// - Inside: floors every 4.5 m with smoked glass inner walls; behind the glass
//   real JavaScript, Python and Solidity code scrolls down (canvas textures,
//   only texture.offset moves). Each ceiling is an LED panel typing commands
//   in real time (redrawn only when a character changes, max ~12 fps, and
//   only when the avatar is within ~60 m).
// - main (ground): lobby + "Commit Pods": glass cabins where you type a git
//   command to travel (git checkout main / dev-branch / feature/jobs-board /
//   staging, git push origin production). Wrong commands answer like git.
// - dev-branch: "Bug Bounty Dungeons": five dark rooms with glitching bug
//   panels and force-field barriers; a security puzzle at each terminal
//   (reentrancy, overflow, tx.origin, front-running, unchecked call) clears
//   the room. All five grant the in-game "Certified Auditor" badge
//   (localStorage "multiverse-badges"). No POAP, no NFT.
// - feature/jobs-board: Stack Overflow Lounge, floating job board monitors
//   (real links) and a business card totem (cards stay in this browser).
// - staging: a build farm of server racks.
// - production (penthouse inside the title bar): a round table with seats
//   and architecture diagrams. Gated by the in-game badge.
// - Outside: forecourt, entrance stairs, benches, lamp posts and the sign.
(() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, roundedSlab } = PropKit.kit;

  // Building dimensions (local to the "terminal_apex" block)
  const W = 40;
  const H = 30;
  const D = 18;
  const R = 3.5; // corner radius of every edge (front, side and top view)
  const FRONT = D / 2;
  const BAND_Y = 21.2; // start of the lighter "title bar" band
  const SLAB = 0.4;
  const FLOORS = [
    { key: 'main', y: 3.6, name: 'main · Lobby & Commit Pods' },
    { key: 'dev-branch', y: 8.1, name: 'dev-branch · Bug Bounty Dungeons' },
    { key: 'feature/jobs-board', y: 12.6, name: 'feature/jobs-board · Stack Overflow Lounge' },
    { key: 'staging', y: 17.1, name: 'staging · Build Farm' },
    { key: 'production', y: 21.6, name: 'production · Penthouse' }
  ];
  const BADGE = 'Certified Auditor';
  const NEAR_DISTANCE = 60;
  const MONO = 'Consolas, "Cascadia Mono", "Courier New", monospace';

  // Windows Terminal "Campbell" palette
  const PALETTE = { green: '#16c60c', cyan: '#61d6d6', purple: '#b4009e', blue: '#3b78ff', yellow: '#f9f1a5', red: '#e74856', white: '#f2f2f2', gray: '#767676' };

  const noRaycast = (object) => { object.raycast = () => {}; return object; };
  const plane = (w, h, planeMaterial, x = 0, y = 0, z = 0) => mesh(new THREE.PlaneGeometry(w, h), planeMaterial, x, y, z);

  // --------------------------------------------------------------------------
  // In-game progress (localStorage, prefix "multiverse-")
  // --------------------------------------------------------------------------
  function readJSON(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (error) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private mode: progress only lasts this session */ }
  }
  // "multiverse-badges" may be an array (of names or {name}) or an object map
  function hasBadge(name) {
    const badges = readJSON('multiverse-badges', []);
    if (Array.isArray(badges)) return badges.some((badge) => badge === name || (badge && badge.name === name));
    return !!(badges && badges[name]);
  }
  function grantBadge(name) {
    const badges = readJSON('multiverse-badges', []);
    if (Array.isArray(badges)) {
      if (!badges.some((badge) => badge === name || (badge && badge.name === name))) badges.push(name);
    } else if (badges && typeof badges === 'object') {
      badges[name] = { earnedAt: new Date().toISOString(), where: 'The Terminal Apex' };
    }
    writeJSON('multiverse-badges', badges);
  }
  const clearedRooms = new Set(readJSON('multiverse-terminal-dungeon', []));
  const saveRooms = () => writeJSON('multiverse-terminal-dungeon', [...clearedRooms]);

  function playSound(name) { try { if (typeof Sound !== 'undefined') Sound.play(name); } catch (error) { /* audio is optional */ } }

  // --------------------------------------------------------------------------
  // Terminal-style DOM overlay (git prompt, multiple choice, text input)
  // --------------------------------------------------------------------------
  const Overlay = (() => {
    let root = null;
    let ui = null;
    let submitHandler = null;
    const CSS = `
      .tapx-overlay { position: fixed; inset: 0; z-index: 9999; display: none; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.45); }
      .tapx-window { width: min(640px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; background: #0c0c0c; color: #cccccc; border: 1px solid #3a3a42; border-radius: 10px; box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6); font: 14px ${MONO}; }
      .tapx-bar { display: flex; align-items: center; gap: 10px; background: #2b2b30; padding: 0 8px 0 0; border-radius: 10px 10px 0 0; }
      .tapx-tab { background: #0c0c0c; color: #f2f2f2; padding: 8px 14px; border-radius: 8px 8px 0 0; margin: 6px 0 0 8px; font: 12px "Segoe UI", Arial, sans-serif; }
      .tapx-tab b { color: #16c60c; margin-right: 6px; }
      .tapx-close { margin-left: auto; background: none; border: 0; color: #cccccc; font: 18px Arial, sans-serif; cursor: pointer; padding: 4px 10px; border-radius: 4px; }
      .tapx-close:hover { background: #c42b1c; color: #fff; }
      .tapx-body { padding: 14px 18px 18px; }
      .tapx-text { white-space: pre-wrap; line-height: 1.45; margin: 0 0 10px; }
      .tapx-code { white-space: pre; overflow-x: auto; background: #111318; border-left: 3px solid #b4009e; padding: 10px 12px; margin: 0 0 12px; color: #61d6d6; font-size: 13px; }
      .tapx-options { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 10px; }
      .tapx-options button, .tapx-chips button { text-align: left; background: #16171c; color: #e6e6e6; border: 1px solid #34363f; border-radius: 6px; padding: 8px 10px; font: 13px ${MONO}; cursor: pointer; }
      .tapx-options button:hover, .tapx-chips button:hover { border-color: #16c60c; color: #fff; }
      .tapx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
      .tapx-chips button { padding: 5px 8px; font-size: 12px; }
      .tapx-row { display: none; align-items: center; gap: 8px; background: #111318; border: 1px solid #34363f; border-radius: 6px; padding: 6px 10px; }
      .tapx-row span { color: #16c60c; white-space: nowrap; }
      .tapx-row input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: #f2f2f2; font: 14px ${MONO}; caret-color: #f2f2f2; }
      .tapx-out { white-space: pre-wrap; margin: 10px 0 0; min-height: 1em; font-size: 13px; line-height: 1.45; }
      .tapx-out.ok { color: #16c60c; } .tapx-out.err { color: #e74856; } .tapx-out.info { color: #f9f1a5; }
    `;

    function ensure() {
      if (root) return;
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);
      root = document.createElement('div');
      root.className = 'tapx-overlay';
      root.innerHTML = `<div class="tapx-window" role="dialog" aria-modal="true">
        <div class="tapx-bar"><div class="tapx-tab"><b>&gt;_</b><span class="tapx-title"></span></div><button class="tapx-close" title="Close (Esc)">&times;</button></div>
        <div class="tapx-body"><p class="tapx-text"></p><pre class="tapx-code"></pre><div class="tapx-options"></div><div class="tapx-chips"></div>
        <form class="tapx-row"><span class="tapx-prompt"></span><input type="text" autocomplete="off" spellcheck="false"></form><pre class="tapx-out"></pre></div></div>`;
      document.body.appendChild(root);
      ui = {
        title: root.querySelector('.tapx-title'), text: root.querySelector('.tapx-text'), code: root.querySelector('.tapx-code'),
        options: root.querySelector('.tapx-options'), chips: root.querySelector('.tapx-chips'), row: root.querySelector('.tapx-row'),
        prompt: root.querySelector('.tapx-prompt'), input: root.querySelector('.tapx-row input'), out: root.querySelector('.tapx-out')
      };
      root.querySelector('.tapx-close').addEventListener('click', close);
      // Clicks inside the window never reach the 3D view (no walk-to-click)
      ['pointerdown', 'mousedown', 'click', 'wheel'].forEach((name) => root.addEventListener(name, (event) => event.stopPropagation()));
      root.addEventListener('pointerdown', (event) => { if (event.target === root) close(); });
      ui.row.addEventListener('submit', (event) => {
        event.preventDefault();
        if (submitHandler) submitHandler(ui.input.value.trim());
      });
      window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && isOpen()) close(); }, true);
    }

    function isOpen() { return !!root && root.style.display === 'flex'; }

    // { title, text, code, options: [{ label, onPick }], chips: [{ label, onPick }], input: { prompt, placeholder, value, onSubmit } }
    function open({ title, text = '', code = '', options = [], chips = [], input = null }) {
      ensure();
      ui.title.textContent = title;
      ui.text.textContent = text;
      ui.text.style.display = text ? 'block' : 'none';
      ui.code.textContent = code;
      ui.code.style.display = code ? 'block' : 'none';
      [[ui.options, options], [ui.chips, chips]].forEach(([container, list]) => {
        container.textContent = '';
        container.style.display = list.length ? 'flex' : 'none';
        list.forEach((option) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = option.label;
          button.addEventListener('click', () => option.onPick(button));
          container.appendChild(button);
        });
      });
      submitHandler = input ? input.onSubmit : null;
      ui.row.style.display = input ? 'flex' : 'none';
      if (input) {
        ui.prompt.textContent = input.prompt || '>';
        ui.input.placeholder = input.placeholder || '';
        ui.input.value = input.value || '';
        // Focus after the E key event is over (so the "e" is not typed in)
        setTimeout(() => ui.input.focus(), 40);
      }
      output('', '');
      root.style.display = 'flex';
    }

    function output(message, kind = 'info') {
      ensure();
      ui.out.textContent = message;
      ui.out.className = `tapx-out ${kind}`;
    }

    function setInput(value) { ensure(); ui.input.value = value; ui.input.focus(); }

    function close() {
      if (!root) return;
      root.style.display = 'none';
      submitHandler = null;
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    }

    return { open, close, output, setInput, isOpen };
  })();

  // --------------------------------------------------------------------------
  // Textures: shell, facade, code rain, LED command lines
  // --------------------------------------------------------------------------
  function noise(ctx, w, h, amount, alpha) {
    for (let i = 0; i < amount; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }

  // Shell: v = height / H, dark charcoal body and the lighter title bar on top
  function shellTexture() {
    const texture = canvasTexture('terminalShell', 256, 512, (ctx, w, h) => {
      const bandRow = (1 - BAND_Y / H) * h;
      ctx.fillStyle = '#141418';
      ctx.fillRect(0, bandRow, w, h - bandRow);
      ctx.fillStyle = '#3c3c45';
      ctx.fillRect(0, 0, w, bandRow);
      noise(ctx, w, h, 5000, 0.035);
      // Panel seams: one per floor on the body, a fine bright edge under the band
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 4.5; y < BAND_Y; y += 4.5) ctx.fillRect(0, (1 - y / H) * h, w, 1);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, bandRow - 1, w, 2);
    });
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  function facadeTexture() {
    const fw = W - 2 * R;
    const fh = H - 2 * R;
    return canvasTexture('terminalFacade', 1024, Math.round(1024 * fh / fw), (ctx, w, h) => {
      const toRow = (y) => (1 - (y - R) / fh) * h;
      const bandRow = toRow(BAND_Y);
      const body = ctx.createLinearGradient(0, bandRow, 0, h);
      body.addColorStop(0, '#101014');
      body.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = body;
      ctx.fillRect(0, bandRow, w, h - bandRow);
      const band = ctx.createLinearGradient(0, 0, 0, bandRow);
      band.addColorStop(0, '#45454f');
      band.addColorStop(1, '#383841');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, bandRow);
      // Faint scanlines and floor lines behind the dark glass
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = bandRow; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = 'rgba(97,214,214,0.08)';
      FLOORS.slice(1, 4).forEach((floor) => ctx.fillRect(0, toRow(floor.y), w, 2));
      noise(ctx, w, h, 4000, 0.02);
      // Window title in the bar, like the app's tab
      ctx.fillStyle = '#26262c';
      ctx.beginPath();
      ctx.moveTo(40, bandRow);
      ctx.lineTo(40, bandRow * 0.42 + 10);
      ctx.quadraticCurveTo(40, bandRow * 0.42, 54, bandRow * 0.42);
      ctx.lineTo(420, bandRow * 0.42);
      ctx.quadraticCurveTo(434, bandRow * 0.42, 434, bandRow * 0.42 + 10);
      ctx.lineTo(434, bandRow);
      ctx.fill();
      ctx.fillStyle = '#d6d6dc';
      ctx.font = `bold ${Math.round(bandRow * 0.22)}px "Segoe UI", Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('THE TERMINAL APEX', 70, bandRow * 0.71);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(0, bandRow - 1, w, 2);
    });
  }

  // Real code snippets for the scrolling walls (short, correct and readable)
  const CODE = {
    js: {
      color: PALETTE.green, keyword: PALETTE.white,
      keywords: ['const', 'let', 'function', 'return', 'async', 'await', 'new', 'throw', 'if', 'require'],
      lines: [
        '// server.js - a tiny static server with a health check',
        "const express = require('express');",
        "const path = require('path');",
        'const app = express();',
        'const PORT = process.env.PORT || 3000;',
        '',
        "app.use(express.static(path.join(__dirname, 'public')));",
        '',
        "app.get('/api/health', (req, res) => {",
        '  res.json({ ok: true, uptime: process.uptime() });',
        '});',
        '',
        'function debounce(fn, ms) {',
        '  let timer = null;',
        '  return (...args) => {',
        '    clearTimeout(timer);',
        '    timer = setTimeout(() => fn(...args), ms);',
        '  };',
        '}',
        '',
        'async function fetchRepos(user) {',
        '  const url = `https://api.github.com/users/${user}/repos`;',
        '  const res = await fetch(url);',
        '  if (!res.ok) throw new Error(`HTTP ${res.status}`);',
        '  return res.json();',
        '}',
        '',
        'app.listen(PORT, () => {',
        '  console.log(`listening on http://localhost:${PORT}`);',
        '});',
        ''
      ]
    },
    py: {
      color: PALETTE.cyan, keyword: PALETTE.yellow,
      keywords: ['from', 'import', 'def', 'return', 'class', 'for', 'in', 'if', 'else', 'yield', 'self'],
      lines: [
        '# app.py - fibonacci and a tiny JSON endpoint',
        'from functools import lru_cache',
        'from http.server import BaseHTTPRequestHandler, HTTPServer',
        'import json',
        '',
        '@lru_cache(maxsize=None)',
        'def fib(n: int) -> int:',
        '    return n if n < 2 else fib(n - 1) + fib(n - 2)',
        '',
        'def chunks(items, size):',
        '    for i in range(0, len(items), size):',
        '        yield items[i:i + size]',
        '',
        'class Handler(BaseHTTPRequestHandler):',
        '    def do_GET(self):',
        '        body = json.dumps({"fib30": fib(30)}).encode()',
        '        self.send_response(200)',
        '        self.send_header("Content-Type", "application/json")',
        '        self.end_headers()',
        '        self.wfile.write(body)',
        '',
        'if __name__ == "__main__":',
        '    print(list(chunks([1, 2, 3, 4, 5], 2)))',
        '    HTTPServer(("", 8000), Handler).serve_forever()',
        ''
      ]
    },
    sol: {
      color: '#c678dd', keyword: PALETTE.cyan,
      keywords: ['pragma', 'contract', 'mapping', 'address', 'uint256', 'bool', 'modifier', 'function', 'external', 'payable', 'require', 'public', 'private'],
      lines: [
        '// SPDX-License-Identifier: MIT',
        'pragma solidity ^0.8.20;',
        '',
        'contract Vault {',
        '    mapping(address => uint256) public balances;',
        '    bool private locked;',
        '',
        '    modifier nonReentrant() {',
        '        require(!locked, "reentrant call");',
        '        locked = true;',
        '        _;',
        '        locked = false;',
        '    }',
        '',
        '    function deposit() external payable {',
        '        balances[msg.sender] += msg.value;',
        '    }',
        '',
        '    function withdraw() external nonReentrant {',
        '        uint256 amount = balances[msg.sender];',
        '        require(amount > 0, "nothing to withdraw");',
        '        balances[msg.sender] = 0; // effects first',
        '        (bool ok, ) = msg.sender.call{value: amount}("");',
        '        require(ok, "transfer failed");',
        '    }',
        '}',
        ''
      ]
    }
  };

  function codeCanvasTexture(lang) {
    const spec = CODE[lang];
    return canvasTexture(`terminalCode|${lang}`, 1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);
      const rows = 34;
      const lineHeight = h / rows;
      ctx.font = `22px ${MONO}`;
      ctx.textBaseline = 'middle';
      for (let row = 0; row < rows; row++) {
        const index = row % spec.lines.length;
        const line = spec.lines[index];
        const y = row * lineHeight + lineHeight / 2;
        ctx.fillStyle = '#3d424a';
        ctx.fillText(String(index + 1).padStart(3, ' '), 10, y);
        let x = 70;
        const comment = /^\s*(\/\/|#)/.test(line);
        line.split(/(\b\w+\b)/).forEach((token) => {
          if (!token) return;
          ctx.fillStyle = comment ? PALETTE.gray : spec.keywords.includes(token) ? spec.keyword : /^["'`]/.test(token.trim()) ? PALETTE.yellow : spec.color;
          ctx.fillText(token, x, y);
          x += ctx.measureText(token).width;
        });
      }
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    });
  }

  // One texture object per (language, wall size); offsets scroll in animate()
  const scrollingTextures = [];
  const codeTextureCache = new Map();
  function codeTexture(lang, wallWidth, wallHeight) {
    const key = `${lang}|${wallWidth}|${wallHeight}`;
    if (!codeTextureCache.has(key)) {
      const texture = codeCanvasTexture(lang).clone();
      texture.needsUpdate = true;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(wallWidth / 11, wallHeight / 11);
      texture.userData = { speed: lang === 'sol' ? 0.018 : lang === 'py' ? 0.024 : 0.03 };
      scrollingTextures.push(texture);
      codeTextureCache.set(key, texture);
    }
    return codeTextureCache.get(key);
  }

  const smokedGlass = () => material('#0b1016', { transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.7 });

  // A code wall: emissive code plane with smoked glass in front (normal +z)
  function codeWall(lang, width, height) {
    const wall = new THREE.Group();
    wall.add(plane(width, height, new THREE.MeshBasicMaterial({ map: codeTexture(lang, width, height) }), 0, 0, 0));
    wall.add(plane(width, height, smokedGlass(), 0, 0, 0.18));
    // Thin metal mullions every 3 m
    const mullion = material('#2a2d34', { metalness: 0.7, roughness: 0.35 });
    for (let x = -width / 2; x <= width / 2 + 0.01; x += width / Math.round(width / 3)) wall.add(box(0.08, height, 0.08, mullion, x, 0, 0.22));
    return wall;
  }

  // LED ceiling panel: commands typed in real time with a blinking cursor
  const ledPanels = [];
  function ledPanel(branch, commands) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    const prompt = `PS C:\\apex\\${branch.replace('feature/', '')}> `;
    const state = { index: 0, typed: 0, phase: 'type', until: 0, last: '', output: 'Windows Terminal · The Terminal Apex' };
    function draw(cursorOn) {
      const [command] = commands[state.index];
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(0, 0, 1024, 160);
      ctx.fillStyle = '#1f1f24';
      ctx.fillRect(0, 0, 1024, 30);
      ctx.fillStyle = '#9a9aa2';
      ctx.font = '18px "Segoe UI", Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`>_  ${branch}`, 14, 15);
      ctx.font = `30px ${MONO}`;
      ctx.fillStyle = PALETTE.gray;
      ctx.fillText(state.output.slice(0, 58), 18, 66);
      ctx.fillStyle = PALETTE.white;
      ctx.fillText(prompt, 18, 122);
      let x = 18 + ctx.measureText(prompt).width;
      const typed = command.slice(0, state.typed);
      ctx.fillStyle = PALETTE.yellow;
      ctx.fillText(typed, x, 122);
      x += ctx.measureText(typed).width;
      if (cursorOn) { ctx.fillStyle = PALETTE.white; ctx.fillRect(x + 2, 106, 16, 32); }
      texture.needsUpdate = true;
    }
    function tick(time) {
      const [command, output] = commands[state.index];
      if (state.phase === 'type') {
        if (time >= state.until) {
          state.typed++;
          state.until = time + 0.06 + Math.random() * 0.14;
          if (state.typed >= command.length) { state.phase = 'hold'; state.until = time + 2.4; }
        }
      } else if (time >= state.until) {
        state.output = output || `${prompt}${command}`;
        state.index = (state.index + 1) % commands.length;
        state.typed = 0;
        state.phase = 'type';
        state.until = time + 0.8;
      }
      const cursorOn = state.phase === 'type' ? true : Math.floor(time * 2) % 2 === 0;
      const key = `${state.index}|${state.typed}|${cursorOn}`;
      if (key !== state.last) { state.last = key; draw(cursorOn); }
    }
    draw(true);
    const panel = new THREE.Group();
    const screen = plane(18, 2.8, new THREE.MeshBasicMaterial({ map: texture }));
    screen.rotation.x = Math.PI / 2; // faces down
    panel.add(screen);
    panel.add(box(18.4, 0.12, 3.2, material('#1a1b20', { metalness: 0.6, roughness: 0.4 }), 0, 0.08, 0));
    ledPanels.push({ tick });
    return panel;
  }

  const LED_COMMANDS = {
    main: [['npm run dev', 'VITE ready in 312 ms  ->  http://localhost:5173/'], ['git status', 'On branch main. Your branch is up to date.'], ['git pull --rebase', 'Already up to date.'], ['git log --oneline -1', 'a1f9e2c (HEAD -> main) fixed meta']],
    'dev-branch': [['git checkout dev-branch', "Switched to branch 'dev-branch'"], ['forge test', '[PASS] testWithdrawIsNotReentrant() (gas: 48211)'], ['git commit -m "fixed meta"', '[dev-branch 3c4d5e6] fixed meta, 1 file changed'], ['git push origin dev-branch', 'dev-branch -> dev-branch']],
    'feature/jobs-board': [['gh repo clone you/portfolio', "Cloning into 'portfolio'... done."], ['npm run build', 'built in 2.41s'], ['git push origin main', 'main -> main']],
    staging: [['python -m http.server', 'Serving HTTP on :: port 8000 ...'], ['docker compose up -d', 'Container api  Started'], ['npm test', 'Tests: 42 passed, 42 total']],
    production: [['git push origin production', 'production -> production'], ['git tag v1.0.0 && git push --tags', '* [new tag] v1.0.0 -> v1.0.0'], ['npm run deploy', 'Deployed to production in 38s']]
  };

  // --------------------------------------------------------------------------
  // Geometry: the rounded slab (all 12 edges rounded) with the front face open
  // --------------------------------------------------------------------------
  function roundedShellGeometry(w, h, d, r, k = 5) {
    const n = 2 * k + 1;
    const geometry = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    const half = [w / 2, h / 2, d / 2];
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const v = new THREE.Vector3();
    const inner = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const coords = [position.getX(i), position.getY(i), position.getZ(i)].map((value, axis) => {
        const index = Math.round((value + 0.5) * n);
        const fromEdge = Math.min(index, n - index);
        const flat = half[axis] - r;
        // tan spacing gives equal angles along the rounded band after projection
        const offset = fromEdge >= k ? flat : flat + r * Math.tan(((k - fromEdge) / k) * Math.PI / 4);
        return index <= k ? -offset : offset;
      });
      v.set(coords[0], coords[1], coords[2]);
      inner.set(THREE.MathUtils.clamp(v.x, -(half[0] - r), half[0] - r), THREE.MathUtils.clamp(v.y, -(half[1] - r), half[1] - r), THREE.MathUtils.clamp(v.z, -(half[2] - r), half[2] - r));
      dir.copy(v).sub(inner);
      if (dir.lengthSq() > 1e-8) {
        dir.normalize();
        v.copy(inner).addScaledVector(dir, r);
        normal.setXYZ(i, dir.x, dir.y, dir.z);
      }
      position.setXYZ(i, v.x, v.y + h / 2, v.z);
    }
    // Planar UVs: u wraps around, v = height (title bar band in the texture)
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + position.getZ(i)) / 12, position.getY(i) / h);
    // Open the flat front face: the facade (with the door) fills it
    const isFrontFlat = (i) => position.getZ(i) > half[2] - 1e-4 && Math.abs(position.getX(i)) < half[0] - r + 1e-4 && Math.abs(position.getY(i) - h / 2) < half[1] - r + 1e-4;
    const index = geometry.index.array;
    const kept = [];
    for (let t = 0; t < index.length; t += 3) {
      if (isFrontFlat(index[t]) && isFrontFlat(index[t + 1]) && isFrontFlat(index[t + 2])) continue;
      kept.push(index[t], index[t + 1], index[t + 2]);
    }
    geometry.setIndex(kept);
    geometry.clearGroups();
    geometry.computeBoundingSphere();
    return geometry;
  }

  // Facade: flat dark glass filling the open front, with the entrance notch
  function facadeGeometry() {
    const fw = (W - 2 * R) / 2;
    const fh = (H - 2 * R) / 2;
    const doorHalf = 3.5;
    const doorTop = FLOORS[0].y + 3.3 - H / 2;
    const shape = new THREE.Shape();
    [[-fw, -fh], [-doorHalf, -fh], [-doorHalf, doorTop], [doorHalf, doorTop], [doorHalf, -fh], [fw, -fh], [fw, fh], [-fw, fh]].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + fw) / (2 * fw), (position.getY(i) + fh) / (2 * fh));
    geometry.translate(0, H / 2, FRONT);
    return geometry;
  }

  // The ">_" glyph: an extruded chevron and a blinking underscore
  function promptGlyph() {
    const glyph = new THREE.Group();
    const glyphMaterial = glow('#eef3f8', 1.5, { roughness: 0.3 });
    const chevron = new THREE.Shape();
    [[0, 6.8], [1.7, 8.4], [6.4, 4.2], [1.7, 0], [0, 1.6], [3.0, 4.2]].forEach(([x, y], i) => (i ? chevron.lineTo(x, y) : chevron.moveTo(x, y)));
    chevron.closePath();
    const extrude = { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 };
    const chevronMesh = noRaycast(mesh(new THREE.ExtrudeGeometry(chevron, extrude), glyphMaterial, -12, 9.2, FRONT + 0.05));
    glyph.add(chevronMesh);
    const underscoreShape = new THREE.Shape();
    [[0, 0], [7, 0], [7, 1.3], [0, 1.3]].forEach(([x, y], i) => (i ? underscoreShape.lineTo(x, y) : underscoreShape.moveTo(x, y)));
    const underscore = noRaycast(mesh(new THREE.ExtrudeGeometry(underscoreShape, extrude), glyphMaterial, -3.6, 9.2, FRONT + 0.05));
    glyph.add(underscore);
    // Soft halo on the glass behind the glyph (additive, never blocks walking)
    const halo = canvasTexture('terminalHalo', 256, 128, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(160,220,255,0.45)');
      gradient.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
    glyph.add(noRaycast(plane(26, 13, new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), -3, 13.4, FRONT + 0.03)));
    return { glyph, underscore };
  }

  function entranceStairs() {
    const rise = FLOORS[0].y;
    const steps = 14;
    const run = 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-0.8, 0);
    shape.lineTo(steps * run, 0);
    for (let i = 0; i < steps; i++) {
      shape.lineTo((steps - i) * run, (i + 1) * (rise / steps));
      shape.lineTo((steps - i - 1) * run, (i + 1) * (rise / steps));
    }
    shape.lineTo(-0.8, rise);
    shape.closePath();
    const width = 16;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, FRONT);
    const stoneTexture = canvasTexture('terminalStone', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#5b5e66';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 6000, 0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, w, 2);
      ctx.fillRect(0, 0, 2, h);
    });
    stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;
    stoneTexture.repeat.set(0.5, 0.5);
    return mesh(geometry, material('#ffffff', { map: stoneTexture, roughness: 0.85 }));
  }

  // --------------------------------------------------------------------------
  // Commit Pods: glass elevator cabins driven by git commands
  // --------------------------------------------------------------------------
  const DESTINATIONS = {
    'git checkout main': 0,
    'git checkout dev-branch': 1,
    'git checkout feature/jobs-board': 2,
    'git checkout staging': 3,
    'git push origin production': 4
  };
  const GIT_COMMANDS = ['add', 'commit', 'push', 'pull', 'fetch', 'merge', 'rebase', 'status', 'log', 'diff', 'branch', 'checkout', 'switch', 'clone', 'init', 'stash', 'reset', 'tag', 'remote'];

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }

  // Answers like a real git (or PowerShell) would; returns { ok, floor } or { error }
  function runGitCommand(raw, currentFloor) {
    const command = raw.replace(/\s+/g, ' ').trim();
    if (!command) return { error: '' };
    if (DESTINATIONS[command] !== undefined) {
      const floor = DESTINATIONS[command];
      if (floor === 4 && !hasBadge(BADGE)) {
        return { error: "remote: error: GH006: Protected branch update failed for refs/heads/production.\nremote: error: Required status check \"Certified Auditor\" is expected.\n ! [remote rejected] production -> production (protected branch hook declined)\nerror: failed to push some refs to 'origin'\n\nHint: clear the five Bug Bounty Dungeons on dev-branch to earn the Certified Auditor badge." };
      }
      if (floor === currentFloor) return { error: floor === 4 ? 'Everything up-to-date' : `Already on '${FLOORS[floor].key}'` };
      return { ok: true, floor };
    }
    const parts = command.split(' ');
    if (parts[0] !== 'git') return { error: `${parts[0]} : The term '${parts[0]}' is not recognized as the name of a cmdlet, function, script file, or operable program.\nTry: git checkout dev-branch` };
    const sub = parts[1] || '';
    if (!sub) return { error: 'usage: git [--version] [--help] <command> [<args>]' };
    if (!GIT_COMMANDS.includes(sub)) {
      const best = GIT_COMMANDS.map((name) => [name, levenshtein(sub, name)]).sort((a, b) => a[1] - b[1])[0];
      return { error: `git: '${sub}' is not a git command. See 'git --help'.${best[1] <= 3 ? `\n\nThe most similar command is\n\t${best[0]}` : ''}` };
    }
    if (sub === 'checkout' || sub === 'switch') {
      const target = parts.slice(2).join(' ');
      if (target === 'production') return { error: "production is deployed with a push, not a checkout.\nTry: git push origin production" };
      if (!target) return { error: `Your branch is up to date with 'origin/${FLOORS[currentFloor].key}'.` };
      return { error: sub === 'switch' ? `fatal: invalid reference: ${target}` : `error: pathspec '${target}' did not match any file(s) known to git` };
    }
    if (sub === 'push') {
      const remote = parts[2];
      const ref = parts.slice(3).join(' ');
      if (remote && remote !== 'origin') return { error: `fatal: '${remote}' does not appear to be a git repository\nfatal: Could not read from remote repository.` };
      if (!ref) return { error: 'fatal: The current branch has no upstream branch.\nTry: git push origin production' };
      return { error: `error: src refspec ${ref} does not match any\nerror: failed to push some refs to 'origin'` };
    }
    if (sub === 'status') return { error: `On branch ${FLOORS[currentFloor].key}\nnothing to commit, working tree clean` };
    if (sub === 'branch') return { error: FLOORS.map((floor, i) => `${i === currentFloor ? '* ' : '  '}${floor.key}`).join('\n') };
    return { error: `This Commit Pod only travels between branches.\nTry: git checkout dev-branch` };
  }

  function openPodChooser(pod, hooks) {
    const currentFloor = pod.userData.floor;
    const submit = (value) => {
      const result = runGitCommand(value, currentFloor);
      if (!result.ok) { if (result.error) { Overlay.output(result.error, /up-to-date|Already on|On branch|\*/.test(result.error) ? 'info' : 'err'); playSound('click'); } return; }
      const floor = FLOORS[result.floor];
      Overlay.output(result.floor === 4 ? 'Enumerating objects: 7, done.\nWriting objects: 100% (7/7), done.\n   3c4d5e6..a1f9e2c  production -> production' : `Switched to branch '${floor.key}'`, 'ok');
      setTimeout(() => {
        Overlay.close();
        const destination = pod.parent.localToWorld(new THREE.Vector3(POD_SPOTS[0][0] + 1.8, floor.y + 0.1, POD_SPOTS[0][1] + 2.6));
        hooks.setAvatarPosition(destination);
        playSound('teleport');
        hooks.system(`Commit Pod: you are now on ${floor.name}.`);
      }, 650);
    };
    Overlay.open({
      title: `Commit Pod · ${FLOORS[currentFloor].key}`,
      text: 'Type a git command to travel (or pick one):',
      chips: Object.keys(DESTINATIONS).map((command) => ({ label: command, onPick: () => Overlay.setInput(command) })),
      input: { prompt: `PS C:\\apex\\${FLOORS[currentFloor].key.replace('feature/', '')}>`, placeholder: 'git checkout dev-branch', onSubmit: submit }
    });
  }

  const POD_SPOTS = [[-16.4, -5.4], [-12.8, -5.4]];

  function commitPod(floorIndex, x, z) {
    const pod = new THREE.Group();
    pod.position.set(x, FLOORS[floorIndex].y, z);
    const metal = material('#2b2e36', { metalness: 0.8, roughness: 0.3 });
    pod.add(cylinder(1.25, 1.25, 0.14, metal, 0, 0.07, 0, 24));
    pod.add(noRaycast(cylinder(1.18, 1.18, 0.04, glow(PALETTE.green, 1.4), 0, 0.16, 0, 24)));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 3.3, 24, 1, true, Math.PI * 0.25, Math.PI * 1.5), material('#9fd8ff', { transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = 1.8;
    pod.add(noRaycast(glass));
    pod.add(cylinder(1.3, 1.3, 0.3, metal, 0, 3.55, 0, 24));
    pod.add(noRaycast(cylinder(1.31, 1.31, 0.06, glow(PALETTE.cyan, 1.2), 0, 3.4, 0, 24)));
    const label = plane(1.6, 0.4, new THREE.MeshBasicMaterial({ map: canvasTexture('terminalPodLabel', 256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.green; ctx.font = `bold 26px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('>_ COMMIT POD', w / 2, h / 2);
    }) }), 0, 3.55, 1.31);
    pod.add(label);
    pod.userData.floor = floorIndex;
    pod.userData.prompt = 'Press E to type a git command (Commit Pod)';
    pod.userData.onInteract = (hooks, object) => { openPodChooser(object, hooks); return null; };
    return interactive(pod, 'action', 'Commit Pod');
  }

  // --------------------------------------------------------------------------
  // Bug Bounty Dungeons: security puzzles (multiple choice)
  // --------------------------------------------------------------------------
  const BUGS = [
    {
      title: 'Reentrancy', code: 'function withdraw() external {\n    uint256 amount = balances[msg.sender];\n    (bool ok, ) = msg.sender.call{value: amount}("");\n    require(ok);\n    balances[msg.sender] = 0;\n}',
      question: 'An attacker calls withdraw() again from its receive() function and drains the vault. What is the fix?',
      options: ['Mark withdraw() as payable.', 'Set balances[msg.sender] = 0 BEFORE the external call (checks-effects-interactions), or add a nonReentrant guard.', 'Send the whole contract balance with transfer() instead.', 'Wrap the call in try/catch.'],
      answer: 1, explain: 'Checks, then effects (update state), then interactions (external calls). The balance is zero before the attacker can re-enter.'
    },
    {
      title: 'Integer overflow', code: 'pragma solidity ^0.7.6;\n\nuint8 public lives = 255;\n\nfunction extraLife() external {\n    lives += 1;\n}',
      question: 'What is `lives` after extraLife() runs once on this compiler?',
      options: ['256: uint8 grows automatically.', 'The call reverts with a panic error.', '0: before Solidity 0.8 arithmetic wraps around silently.', '255: the write is ignored.'],
      answer: 2, explain: 'Before 0.8 it wraps to 0. Use Solidity 0.8+ (checked math reverts) or SafeMath, and only use unchecked { } where overflow is impossible.'
    },
    {
      title: 'tx.origin authentication', code: 'function transferOwnership(address next) external {\n    require(tx.origin == owner, "not owner");\n    owner = next;\n}',
      question: 'Why is this ownership check unsafe?',
      options: ['tx.origin costs too much gas.', 'tx.origin is always the zero address.', 'It is safe: tx.origin can never be a contract.', 'If the owner calls a malicious contract, it can call transferOwnership and tx.origin is still the owner. Use msg.sender.'],
      answer: 3, explain: 'tx.origin is the wallet that started the whole transaction, not the direct caller. Authorize with msg.sender.'
    },
    {
      title: 'Front-running', code: 'function solve(string calldata answer) external {\n    require(keccak256(bytes(answer)) == solutionHash);\n    payable(msg.sender).transfer(prize);\n}',
      question: 'A bot watches the public mempool, copies your answer and pays more gas to be mined first. How do you stop it?',
      options: ['Store the answer in a private variable.', 'Commit-reveal: first submit keccak256(answer, salt, msg.sender), then reveal in a later block.', 'Raise the gas limit of your transaction.', 'Rename solve() to something obscure.'],
      answer: 1, explain: 'A commitment hides the answer (and binds it to your address) until it is too late to copy it.'
    },
    {
      title: 'Unchecked call return value', code: 'function payout(address payable to, uint256 amount) external onlyOwner {\n    to.send(amount);\n    paid[to] = true;\n}',
      question: 'Sometimes paid[to] is true but no ether arrived. What is the bug?',
      options: ['send() returns false on failure instead of reverting and the result is ignored. Check it: (bool ok, ) = to.call{value: amount}(""); require(ok);', 'paid should be a uint256 mapping.', 'onlyOwner blocks the transfer.', 'send() forwards all remaining gas.'],
      answer: 0, explain: 'Low-level send/call return a bool. Always check it (require) or the contract records a payment that never happened.'
    }
  ];

  // --------------------------------------------------------------------------
  // The building
  // --------------------------------------------------------------------------
  function terminalApex(group) {
    const inside = new THREE.Group();
    group.add(inside);

    // Shell, facade, glyph and entrance
    const shellMaterial = new THREE.MeshStandardMaterial({ map: shellTexture(), roughness: 0.42, metalness: 0.35, side: THREE.DoubleSide });
    const shell = mesh(roundedShellGeometry(W, H, D, R), shellMaterial);
    group.add(shell);
    const facade = mesh(facadeGeometry(), new THREE.MeshStandardMaterial({ map: facadeTexture(), roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.93, side: THREE.DoubleSide }));
    facade.castShadow = false;
    group.add(facade);
    const { glyph, underscore } = promptGlyph();
    group.add(glyph);
    group.add(entranceStairs());
    // Door frame glow around the entrance
    const frame = glow(PALETTE.green, 1.3);
    [-3.6, 3.6].forEach((x) => group.add(noRaycast(box(0.12, 3.3, 0.12, frame, x, FLOORS[0].y + 1.65, FRONT + 0.06))));
    group.add(noRaycast(box(7.3, 0.12, 0.12, frame, 0, FLOORS[0].y + 3.3, FRONT + 0.06)));

    // Floors (rounded slabs following the top-view rounded rectangle)
    const floorTexture = canvasTexture('terminalFloor', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#26282e';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 4000, 0.04);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    });
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(0.5, 0.5);
    const floorMaterial = material('#ffffff', { map: floorTexture, roughness: 0.35, metalness: 0.2 });
    const darkFloor = material('#0d0e12', { roughness: 0.6 });
    FLOORS.forEach((floor, index) => {
      const slab = roundedSlab(W - 0.6, SLAB, D - 0.6, R - 0.3, index === 1 ? darkFloor : floorMaterial);
      slab.position.y = floor.y - SLAB;
      inside.add(slab);
    });

    // Code walls on every floor (back + both sides), LED ceiling panels
    const wallHeight = 4.1;
    const languages = [['js', 'py', 'sol'], ['sol', 'sol', 'sol'], ['py', 'js', 'sol'], ['js', 'py', 'py'], ['sol', 'js', 'py']];
    FLOORS.forEach((floor, index) => {
      const [backLang, leftLang, rightLang] = languages[index];
      const height = index === 4 ? 5.2 : wallHeight;
      const back = codeWall(backLang, W - 2 * R - 1, height);
      back.position.set(0, floor.y + height / 2, -FRONT + 0.25);
      inside.add(back);
      if (index !== 1) {
        [[-1, leftLang], [1, rightLang]].forEach(([side, lang]) => {
          const wall = codeWall(lang, D - 2 * R - 0.6, height);
          wall.position.set(side * (W / 2 - 0.25), floor.y + height / 2, 0);
          wall.rotation.y = -side * Math.PI / 2;
          inside.add(wall);
        });
      }
      const panel = ledPanel(floor.key, LED_COMMANDS[floor.key]);
      panel.position.set(2, index === 4 ? floor.y + 5.6 : floor.y + 4.5 - SLAB - 0.15, -1);
      inside.add(panel);
      // Commit Pods: two on the ground floor, one on each upper floor
      (index === 0 ? POD_SPOTS : [POD_SPOTS[0]]).forEach(([x, z]) => inside.add(commitPod(index, x, z)));
      // Branch name sprite above the pod area
      const sign = textSprite(`>_ ${floor.key}`, { width: 4.5, background: 'rgba(12, 12, 12, 0.85)', color: PALETTE.green, font: `bold 40px ${MONO}` });
      sign.position.set(-14.6, floor.y + 3.6, -3.2);
      inside.add(sign);
    });

    buildLobby(inside, FLOORS[0].y);
    const dungeon = buildDungeon(inside, FLOORS[1].y);
    buildLounge(inside, FLOORS[2].y);
    buildBuildFarm(inside, FLOORS[3].y);
    buildPenthouse(inside, FLOORS[4].y);

    // Interiors are lit by their screens and the sky light, not by the sun's
    // shadow map (the shell would leave every floor pitch black)
    inside.traverse((node) => { if (node.isMesh) { node.receiveShadow = false; node.castShadow = false; } });

    // One animation callback for the whole tower
    const worldPosition = new THREE.Vector3();
    let lastTick = 0;
    animate(group, (time) => {
      underscore.visible = Math.floor(time / 0.55) % 2 === 0;
      if (typeof avatar === 'undefined') return;
      group.getWorldPosition(worldPosition);
      const near = Math.hypot(avatar.position.x - worldPosition.x, avatar.position.z - worldPosition.z) < NEAR_DISTANCE;
      if (!near) return;
      scrollingTextures.forEach((texture) => { texture.offset.y = (time * texture.userData.speed) % 1; });
      if (time - lastTick >= 1 / 12) {
        lastTick = time;
        // Only the floor the avatar is on (and the facade-visible ones nearby) need typing
        ledPanels.forEach((panel) => panel.tick(time));
      }
      dungeon.update(time);
    });
    group.userData.label = 'The Terminal Apex';
  }

  // Ground floor: lobby with reception, branch directory and plants
  function buildLobby(inside, y) {
    const white = material('#e9ecef', { roughness: 0.35 });
    const desk = box(7, 1.1, 1.4, material('#1b1c22', { metalness: 0.5, roughness: 0.3 }), 6, y + 0.55, -3);
    inside.add(desk);
    inside.add(noRaycast(box(7.05, 0.06, 1.45, glow(PALETTE.green, 1.2), 6, y + 1.12, -3)));
    inside.add(box(7.2, 0.08, 1.6, white, 6, y + 1.18, -3));
    // Branch directory: how to use the Commit Pods
    const directory = canvasTexture('terminalDirectory', 768, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = PALETTE.white; ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('>_  COMMIT PODS · BRANCH DIRECTORY', 22, 28);
      const rows = [
        ['git checkout main', 'Lobby (you are here)', PALETTE.green],
        ['git checkout dev-branch', 'Bug Bounty Dungeons', PALETTE.red],
        ['git checkout feature/jobs-board', 'Stack Overflow Lounge & Jobs', '#f48024'],
        ['git checkout staging', 'Build Farm', PALETTE.cyan],
        ['git push origin production', 'Penthouse (Certified Auditor only)', '#c678dd']
      ];
      rows.forEach(([command, place, color], i) => {
        const ry = 100 + i * 78;
        ctx.fillStyle = color; ctx.font = `bold 26px ${MONO}`; ctx.fillText(`$ ${command}`, 26, ry);
        ctx.fillStyle = '#9a9aa2'; ctx.font = '22px "Segoe UI", Arial, sans-serif'; ctx.fillText(place, 60, ry + 32);
      });
    });
    const board = plane(6, 4, new THREE.MeshBasicMaterial({ map: directory }), -8, y + 2.3, -7.2);
    inside.add(board);
    inside.add(box(6.3, 4.3, 0.2, material('#1b1c22', { metalness: 0.6 }), -8, y + 2.3, -7.35));
    // Lobby benches and planters
    const cushion = material('#2d2f37', { roughness: 0.8 });
    [[-2, 3.5], [2.6, 3.5]].forEach(([x, z]) => {
      inside.add(box(3, 0.45, 1, cushion, x, y + 0.25, z));
      inside.add(seat(x, y + 0.45, z, 'Lobby bench'));
    });
    const pot = material('#3a3d45', { roughness: 0.6 });
    const leaves = material('#2f7d4a', { roughness: 0.9 });
    [[-17, 6.5], [17, 6.5], [15.5, -6.5]].forEach(([x, z]) => {
      inside.add(cylinder(0.6, 0.45, 0.9, pot, x, y + 0.45, z, 12));
      inside.add(sphere(0.95, leaves, x, y + 1.6, z, 10));
    });
    const welcome = textSprite('THE TERMINAL APEX · lobby (main)', { width: 7, background: 'rgba(12,12,12,0.85)', color: PALETTE.white });
    welcome.position.set(6, y + 2.6, -3);
    inside.add(welcome);
  }

  // Floor 2: five dark rooms, glitching bug panels, barriers and terminals
  function buildDungeon(inside, y) {
    const wallMaterial = material('#121318', { roughness: 0.7 });
    const h = 4.1;
    const partitions = [-9, -3.5, 2, 7.5, 13];
    const doorZ = [-0.5, 2.5];
    const backZ = -FRONT + 0.45;
    partitions.forEach((x) => {
      inside.add(box(0.3, h, doorZ[0] - backZ, wallMaterial, x, y + h / 2, (backZ + doorZ[0]) / 2));
      inside.add(box(0.3, h, FRONT - 0.3 - doorZ[1], wallMaterial, x, y + h / 2, (doorZ[1] + FRONT - 0.3) / 2));
    });
    // Glitch frames (two per bug) and the patched state
    const glitchFrame = (index, frame) => canvasTexture(`terminalGlitch|${index}|${frame}`, 256, 160, (ctx, w, hh) => {
      ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, w, hh);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = [PALETTE.red, '#ff00ff', PALETTE.cyan, PALETTE.green, '#ffffff'][(i + frame + index) % 5];
        ctx.globalAlpha = 0.25 + Math.random() * 0.6;
        ctx.fillRect(Math.random() * w, Math.random() * hh, 10 + Math.random() * 90, 2 + Math.random() * 7);
      }
      ctx.globalAlpha = 1;
      ctx.font = `bold 22px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = frame ? PALETTE.cyan : PALETTE.red;
      ctx.fillText(`BUG #${index + 1}`, w / 2 + (frame ? 4 : -3), 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 17px ${MONO}`;
      ctx.fillText(BUGS[index].title.toUpperCase(), w / 2 + (frame ? -3 : 2), 88);
      ctx.fillStyle = PALETTE.red;
      ctx.fillText(frame ? '0xDEADBEEF' : 'SEGFAULT (core dumped)', w / 2, 122);
    });
    const patched = (index) => canvasTexture(`terminalPatched|${index}`, 256, 160, (ctx, w, hh) => {
      ctx.fillStyle = '#04140a'; ctx.fillRect(0, 0, w, hh);
      ctx.font = `bold 22px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.green;
      ctx.fillText(`BUG #${index + 1} PATCHED`, w / 2, 56);
      ctx.font = `16px ${MONO}`;
      ctx.fillText(BUGS[index].title, w / 2, 92);
      ctx.fillText('[PASS] all tests', w / 2, 122);
    });
    const barrierTexture = canvasTexture('terminalBarrier', 128, 256, (ctx, w, hh) => {
      ctx.clearRect(0, 0, w, hh);
      ctx.strokeStyle = 'rgba(231,72,86,0.9)';
      ctx.lineWidth = 2;
      for (let i = -hh; i < hh; i += 18) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i + w); ctx.stroke(); }
      ctx.fillStyle = 'rgba(231,72,86,0.9)';
      ctx.font = `bold 13px ${MONO}`; ctx.textAlign = 'center';
      ctx.fillText('ACCESS DENIED', w / 2, hh / 2);
    });
    // Barrier: faint but collidable (opacity >= 0.2 counts as solid)
    const barrierMaterial = material('#ff4d5e', { map: barrierTexture, transparent: true, opacity: 0.24, emissive: '#e74856', emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const roomCenters = [-6.25, -0.75, 4.75, 10.25, 16.2];
    const rooms = BUGS.map((bug, index) => {
      const x = roomCenters[index];
      const frames = [0, 1].map((frame) => new THREE.MeshBasicMaterial({ map: glitchFrame(index, frame) }));
      const fixedMaterial = new THREE.MeshBasicMaterial({ map: patched(index) });
      const panel = plane(4, 2.5, frames[0], x, y + 2.3, backZ + 0.32);
      inside.add(panel);
      // Barrier: in the next doorway (rooms 1-4) or in front of the vault (room 5)
      const barrier = index < 4
        ? box(0.12, h, doorZ[1] - doorZ[0], barrierMaterial, partitions[index + 1], y + h / 2, (doorZ[0] + doorZ[1]) / 2)
        : box(6.2, h, 0.12, barrierMaterial, 16.3, y + h / 2, -2.6);
      inside.add(barrier);
      // Terminal kiosk
      const kiosk = new THREE.Group();
      kiosk.position.set(x, y, index < 4 ? 4.6 : 3.2);
      kiosk.add(box(0.5, 1.1, 0.5, material('#1b1c22', { metalness: 0.6 }), 0, 0.55, 0));
      const screen = box(1.1, 0.75, 0.08, new THREE.MeshBasicMaterial({ map: canvasTexture(`terminalKiosk|${index}`, 256, 160, (ctx, w, hh) => {
        ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, hh);
        ctx.fillStyle = PALETTE.green; ctx.font = `bold 20px ${MONO}`; ctx.textBaseline = 'middle';
        ctx.fillText(`> audit room_${index + 1}`, 14, 40);
        ctx.fillStyle = PALETTE.yellow; ctx.font = `16px ${MONO}`;
        ctx.fillText(bug.title, 14, 80);
        ctx.fillStyle = PALETTE.white; ctx.fillText('Press E to answer_', 14, 118);
      }) }), 0, 1.45, 0);
      screen.rotation.x = -0.35;
      kiosk.add(screen);
      kiosk.rotation.y = Math.PI;
      kiosk.userData.prompt = `Press E to audit bug #${index + 1}: ${bug.title}`;
      const room = { index, panel, frames, fixedMaterial, barrier, kiosk, cleared: false };
      kiosk.userData.onInteract = (hooks) => { openPuzzle(room, hooks); return null; };
      inside.add(interactive(kiosk, 'action', `Bug #${index + 1}`));
      return room;
    });

    function clearRoom(room) {
      room.cleared = true;
      room.panel.material = room.fixedMaterial;
      room.panel.position.x = roomCenters[room.index];
      room.panel.scale.set(1, 1, 1);
      room.barrier.visible = false;
      if (room.barrier.parent) room.barrier.parent.remove(room.barrier);
    }
    rooms.forEach((room) => { if (clearedRooms.has(room.index)) clearRoom(room); });

    function openPuzzle(room, hooks) {
      const bug = BUGS[room.index];
      if (room.cleared) {
        Overlay.open({ title: `Bug #${room.index + 1} · ${bug.title}`, text: `Patched. ${bug.explain}`, code: bug.code });
        Overlay.output('[PASS] this room is clear.', 'ok');
        return;
      }
      Overlay.open({
        title: `Bug #${room.index + 1} · ${bug.title}`,
        text: bug.question,
        code: bug.code,
        options: bug.options.map((option, optionIndex) => ({
          label: `${String.fromCharCode(65 + optionIndex)}) ${option}`,
          onPick: () => {
            if (optionIndex !== bug.answer) {
              Overlay.output(`[FAIL] Not quite. The exploit still works. Try again.`, 'err');
              playSound('click');
              return;
            }
            clearRoom(room);
            clearedRooms.add(room.index);
            saveRooms();
            playSound('coin');
            Overlay.output(`[PASS] ${bug.explain}\nThe firewall is down.`, 'ok');
            const done = rooms.every((r) => r.cleared);
            if (done && !hasBadge(BADGE)) {
              grantBadge(BADGE);
              hooks.system('Congratulations! You cleared all five Bug Bounty Dungeons and earned the "Certified Auditor" badge (in-game, saved in this browser). git push origin production now opens the penthouse.');
            } else {
              hooks.system(`Bug #${room.index + 1} (${bug.title}) patched. ${rooms.filter((r) => r.cleared).length}/5 rooms clear.`);
            }
          }
        }))
      });
    }

    // Vault behind the last barrier: the Certified Auditor trophy
    const trophy = new THREE.Group();
    trophy.position.set(16.3, y, -5.6);
    trophy.add(cylinder(0.7, 0.85, 1, material('#1b1c22', { metalness: 0.6 }), 0, 0.5, 0, 16));
    const crest = sphere(0.45, glow(PALETTE.green, 1.6), 0, 1.6, 0, 12);
    trophy.add(crest);
    trophy.userData.label = 'Certified Auditor';
    trophy.userData.info = 'Awarded for clearing the five Bug Bounty Dungeons: reentrancy, integer overflow, tx.origin, front-running and unchecked call return values. In-game badge stored in this browser (multiverse-badges). It unlocks the production penthouse.';
    inside.add(interactive(trophy, 'inspect', 'Certified Auditor'));

    const entrySign = textSprite('BUG BOUNTY DUNGEONS · answer each terminal to drop the firewall', { width: 9, background: 'rgba(40, 6, 10, 0.88)', color: '#ff8a95' });
    entrySign.position.set(-12, y + 3.4, 1);
    inside.add(entrySign);

    let nextGlitch = 0;
    return {
      update(time) {
        crest.position.y = 1.6 + Math.sin(time * 2) * 0.12;
        if (time < nextGlitch) return;
        nextGlitch = time + 0.07 + Math.random() * 0.16;
        rooms.forEach((room) => {
          if (room.cleared) return;
          room.panel.material = room.frames[Math.random() > 0.5 ? 1 : 0];
          room.panel.position.x = roomCenters[room.index] + (Math.random() - 0.5) * 0.12;
          room.panel.scale.set(1 + (Math.random() - 0.5) * 0.06, 1 + (Math.random() > 0.85 ? 0.15 : 0), 1);
        });
      }
    };
  }

  // Floor 3: Stack Overflow Lounge & Jobs Board
  function buildLounge(inside, y) {
    const orange = material('#f48024', { roughness: 0.7 });
    const fabric = material('#30323a', { roughness: 0.9 });
    // Three sofas around a coffee table
    [[-4, 4, 0], [0, 6.6, Math.PI], [4, 4, 0]].forEach(([x, z, rotation], i) => {
      const sofa = new THREE.Group();
      sofa.position.set(x, y, z);
      sofa.rotation.y = rotation + (i === 1 ? 0 : (i === 0 ? 0.35 : -0.35));
      sofa.add(box(3, 0.45, 1, fabric, 0, 0.25, 0));
      sofa.add(box(3, 0.6, 0.25, fabric, 0, 0.75, -0.45));
      sofa.add(box(3.02, 0.08, 1.02, orange, 0, 0.5, 0));
      sofa.add(seat(-0.7, 0.45, 0, 'Lounge sofa'));
      sofa.add(seat(0.7, 0.45, 0, 'Lounge sofa'));
      inside.add(sofa);
    });
    inside.add(cylinder(1, 1, 0.08, material('#d9dde3', { roughness: 0.25 }), 0, y + 0.45, 5.3, 20));
    inside.add(cylinder(0.12, 0.2, 0.42, material('#1b1c22'), 0, y + 0.21, 5.3, 8));
    const loungeSign = textSprite('STACK OVERFLOW LOUNGE & JOBS BOARD', { width: 8, background: 'rgba(30, 18, 8, 0.88)', color: '#f48024' });
    loungeSign.position.set(0, y + 3.5, 6.8);
    inside.add(loungeSign);

    // Floating job board monitors (E opens the real site in a new tab)
    const JOBS = [
      ['web3.career', 'https://web3.career', 'Web3 & crypto developer jobs'],
      ['CryptoJobsList', 'https://cryptojobslist.com', 'Blockchain jobs board'],
      ['GitHub Careers', 'https://github.com/about/careers', 'Work at GitHub'],
      ['LinkedIn Jobs', 'https://www.linkedin.com/jobs/', 'Search developer roles'],
      ['Remote OK', 'https://remoteok.com', 'Remote developer jobs']
    ];
    const monitors = [];
    JOBS.forEach(([name, url, tagline], i) => {
      const monitor = new THREE.Group();
      monitor.position.set(-7 + i * 5, y + 2.3, -5.2);
      const texture = canvasTexture(`terminalJob|${name}`, 512, 288, (ctx, w, h) => {
        ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, w, 40);
        ctx.fillStyle = '#f48024'; ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
        ctx.fillText('JOBS BOARD', 16, 21);
        ctx.fillStyle = PALETTE.white; ctx.font = 'bold 46px "Segoe UI", Arial, sans-serif';
        ctx.fillText(name, 22, 108);
        ctx.fillStyle = '#9a9aa2'; ctx.font = '24px "Segoe UI", Arial, sans-serif';
        ctx.fillText(tagline, 22, 160);
        ctx.fillStyle = PALETTE.cyan; ctx.font = `22px ${MONO}`;
        ctx.fillText(url.replace('https://', ''), 22, 214);
        ctx.fillStyle = PALETTE.green; ctx.fillText('Press E to open >_', 22, 252);
      });
      monitor.add(box(3.4, 2, 0.12, material('#15161b', { metalness: 0.6 }), 0, 0, -0.07));
      monitor.add(plane(3.2, 1.8, new THREE.MeshBasicMaterial({ map: texture }), 0, 0, 0.0));
      monitor.add(noRaycast(box(3.42, 0.04, 0.14, glow('#f48024', 1.2), 0, -1.02, -0.07)));
      monitor.userData.url = url;
      monitor.userData.prompt = `Press E to open ${name} (new tab)`;
      inside.add(interactive(monitor, 'link', name));
      monitors.push(monitor);
    });
    animate(monitors[0], (time) => {
      monitors.forEach((monitor, i) => { monitor.position.y = y + 2.3 + Math.sin(time * 1.2 + i) * 0.12; });
    });

    // Business card totem + card wall (stored only in this browser)
    const totem = new THREE.Group();
    totem.position.set(14.5, y, 4);
    totem.add(box(0.9, 2.2, 0.9, material('#1b1c22', { metalness: 0.6 }), 0, 1.1, 0));
    totem.add(noRaycast(box(0.92, 0.08, 0.92, glow(PALETTE.green, 1.4), 0, 2.2, 0)));
    totem.add(plane(0.7, 0.45, new THREE.MeshBasicMaterial({ map: canvasTexture('terminalTotem', 256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.green; ctx.font = `bold 24px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DEV CARD', w / 2, 50); ctx.fillStyle = PALETTE.white; ctx.font = `18px ${MONO}`; ctx.fillText('Press E: pin your', w / 2, 92); ctx.fillText('GitHub username', w / 2, 120);
    }) }), 0, 1.6, 0.46));
    totem.userData.prompt = 'Press E to pin your GitHub card on the wall';

    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 1024;
    cardCanvas.height = 512;
    const cardTexture = new THREE.CanvasTexture(cardCanvas);
    const drawCards = () => {
      const ctx = cardCanvas.getContext('2d');
      const cards = readJSON('multiverse-terminal-cards', []);
      ctx.fillStyle = '#17181d'; ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, 1024, 56);
      ctx.fillStyle = PALETTE.white; ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('DEV CARD WALL', 24, 28);
      ctx.fillStyle = '#9a9aa2'; ctx.font = '18px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Cards are saved in this browser only (local)', 600, 28);
      if (!cards.length) { ctx.fillStyle = '#6a6a72'; ctx.font = `24px ${MONO}`; ctx.fillText('No cards yet. Use the totem to pin yours.', 160, 280); }
      cards.slice(-12).forEach((user, i) => {
        const cx = 24 + (i % 4) * 248;
        const cy = 76 + Math.floor(i / 4) * 142;
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(cx, cy, 228, 124);
        ctx.fillStyle = ['#16c60c', '#3b78ff', '#f48024', '#b4009e'][i % 4]; ctx.fillRect(cx, cy, 228, 10);
        ctx.fillStyle = '#d6d6dc'; ctx.beginPath(); ctx.arc(cx + 114, cy + 4, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d1b26'; ctx.font = `bold 20px ${MONO}`;
        ctx.fillText(user.length > 18 ? `${user.slice(0, 17)}...` : user, cx + 14, cy + 50);
        ctx.fillStyle = '#4a4f57'; ctx.font = `15px ${MONO}`;
        ctx.fillText(`github.com/${user}`.slice(0, 26), cx + 14, cy + 90);
      });
      cardTexture.needsUpdate = true;
    };
    drawCards();
    const cardWall = plane(7, 3.5, new THREE.MeshBasicMaterial({ map: cardTexture }), 14.5, y + 2.2, 8.35);
    cardWall.rotation.y = Math.PI;
    inside.add(cardWall);
    inside.add(box(7.3, 3.8, 0.15, material('#2a2b31', { metalness: 0.5 }), 14.5, y + 2.2, 8.5));
    totem.userData.onInteract = () => {
      Overlay.open({
        title: 'Dev Card Totem',
        text: 'Enter your GitHub username to pin a card with github.com/<user> on the wall.\nIt is stored locally in this browser only (not shared with other players).',
        input: {
          prompt: 'github.com/', placeholder: 'octocat',
          onSubmit: (value) => {
            if (!/^[A-Za-z0-9-]{1,39}$/.test(value)) { Overlay.output('Invalid username: use 1-39 letters, numbers or hyphens.', 'err'); return; }
            const cards = readJSON('multiverse-terminal-cards', []).filter((user) => user.toLowerCase() !== value.toLowerCase());
            cards.push(value);
            writeJSON('multiverse-terminal-cards', cards.slice(-24));
            drawCards();
            playSound('coin');
            Overlay.output(`Pinned github.com/${value} to the card wall (saved in this browser).`, 'ok');
            if (typeof appendSystemMessage === 'function') appendSystemMessage(`Your dev card github.com/${value} is on the wall of the Stack Overflow Lounge.`);
          }
        }
      });
      return null;
    };
    inside.add(interactive(totem, 'action', 'Dev Card Totem'));
  }

  // Floor 4: staging build farm (instanced server racks)
  function buildBuildFarm(inside, y) {
    const rackTexture = canvasTexture('terminalRack', 128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#121318'; ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 14; row++) {
        ctx.fillStyle = '#1d1f26'; ctx.fillRect(8, 10 + row * 17, w - 16, 13);
        ctx.fillStyle = row % 3 ? PALETTE.green : PALETTE.cyan; ctx.fillRect(14, 14 + row * 17, 6, 4);
        ctx.fillStyle = '#3b78ff'; ctx.fillRect(26, 14 + row * 17, 4, 4);
      }
    });
    const geometry = new THREE.BoxGeometry(1.2, 3, 1);
    const rackMaterial = material('#ffffff', { map: rackTexture, emissive: '#ffffff', emissiveMap: rackTexture, emissiveIntensity: 0.5, roughness: 0.5 });
    const positions = [];
    for (let i = 0; i < 8; i++) { positions.push([-6 + i * 1.5, -3.5], [-6 + i * 1.5, 3.2]); }
    const racks = new THREE.InstancedMesh(geometry, rackMaterial, positions.length);
    const matrix = new THREE.Matrix4();
    positions.forEach(([x, z], i) => { matrix.makeTranslation(x, y + 1.5, z); racks.setMatrixAt(i, matrix); });
    racks.instanceMatrix.needsUpdate = true;
    inside.add(racks);
    const sign = textSprite('STAGING · BUILD FARM (CI runners)', { width: 6, background: 'rgba(8, 24, 28, 0.88)', color: PALETTE.cyan });
    sign.position.set(4.5, y + 3.6, 0);
    inside.add(sign);
  }

  // Floor 5: production penthouse inside the title bar.
  // The original brief asked for an NFT-gated room: it is replaced by the
  // in-game "Certified Auditor" badge (earned in the Bug Bounty Dungeons).
  function buildPenthouse(inside, y) {
    const tableX = 3;
    const tableZ = 0;
    inside.add(cylinder(3.2, 3.2, 0.12, material('#e9ecef', { roughness: 0.2, metalness: 0.2 }), tableX, y + 0.78, tableZ, 40));
    inside.add(noRaycast(cylinder(3.22, 3.22, 0.04, glow('#c678dd', 1.4), tableX, y + 0.7, tableZ, 40)));
    inside.add(cylinder(0.8, 1.1, 0.72, material('#1b1c22', { metalness: 0.6 }), tableX, y + 0.36, tableZ, 20));
    const chair = material('#2a2b31', { roughness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const cx = tableX + Math.cos(angle) * 4.2;
      const cz = tableZ + Math.sin(angle) * 4.2;
      const chairGroup = new THREE.Group();
      chairGroup.position.set(cx, y, cz);
      chairGroup.rotation.y = -angle - Math.PI / 2;
      chairGroup.add(box(0.7, 0.45, 0.7, chair, 0, 0.23, 0));
      chairGroup.add(box(0.7, 0.8, 0.12, chair, 0, 0.8, 0.32));
      chairGroup.add(seat(0, 0.45, 0, 'Penthouse seat'));
      inside.add(chairGroup);
    }
    // Hanging four-sided display with architecture diagrams
    const DIAGRAMS = [
      ['REQUEST PATH', ['Browser', 'CDN', 'Load balancer', 'API (Node)', 'Postgres']],
      ['CI / CD PIPELINE', ['git push', 'Actions CI', 'Tests', 'Build image', 'Deploy']],
      ['ROLLUP ARCHITECTURE', ['Users', 'Sequencer', 'Batch', 'L1 contract', 'Proofs']],
      ['GENESIS CITY NETWORK', ['Clients', 'Socket.io', 'Game server', 'World state', 'Districts']]
    ];
    const cube = new THREE.Group();
    cube.position.set(tableX, y + 4.6, tableZ);
    DIAGRAMS.forEach(([title, nodes], i) => {
      const texture = canvasTexture(`terminalDiagram|${title}`, 512, 320, (ctx, w, h) => {
        ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let gx = 0; gx < w; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
        ctx.fillStyle = PALETTE.white; ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle';
        ctx.fillText(title, 20, 30);
        const points = nodes.map((_, n) => [70 + (n % 3) * 180, 110 + Math.floor(n / 3) * 120 + (n % 2) * 18]);
        ctx.strokeStyle = PALETTE.cyan; ctx.lineWidth = 3;
        for (let n = 1; n < points.length; n++) { ctx.beginPath(); ctx.moveTo(...points[n - 1]); ctx.lineTo(...points[n]); ctx.stroke(); }
        points.forEach(([px, py], n) => {
          ctx.fillStyle = '#1b1c22'; ctx.fillRect(px - 62, py - 22, 124, 44);
          ctx.strokeStyle = [PALETTE.green, PALETTE.cyan, '#c678dd', PALETTE.yellow, PALETTE.blue][n]; ctx.strokeRect(px - 62, py - 22, 124, 44);
          ctx.fillStyle = PALETTE.white; ctx.font = '16px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(nodes[n], px, py);
          ctx.textAlign = 'left';
        });
      });
      const face = plane(3.6, 2.25, new THREE.MeshBasicMaterial({ map: texture }));
      const angle = (i / 4) * Math.PI * 2;
      face.position.set(Math.sin(angle) * 1.85, 0, Math.cos(angle) * 1.85);
      face.rotation.y = angle;
      cube.add(face);
    });
    cube.add(box(3.6, 2.3, 3.6, material('#15161b', { metalness: 0.6 }), 0, 0, 0));
    cube.add(noRaycast(cylinder(0.05, 0.05, 2.5, material('#8a8f98', { metalness: 0.8 }), 0, 2.4, 0, 6)));
    inside.add(cube);
    animate(cube, (time) => { cube.rotation.y = time * 0.12; });
    const sign = textSprite('PRODUCTION · Certified Auditors only', { width: 7, background: 'rgba(26, 8, 30, 0.88)', color: '#e599f7' });
    sign.position.set(-8, y + 3.2, 3);
    inside.add(sign);
  }

  // --------------------------------------------------------------------------
  // Forecourt, benches, lamps and the name sign
  // --------------------------------------------------------------------------
  function forecourt(group, { w, d }) {
    const paving = canvasTexture('terminalPaving', 512, 512, (ctx, tw, th) => {
      ctx.fillStyle = '#3d4047';
      ctx.fillRect(0, 0, tw, th);
      noise(ctx, tw, th, 14000, 0.05);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * tw / 4, 0); ctx.lineTo(i * tw / 4, th); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * th / 4); ctx.lineTo(tw, i * th / 4); ctx.stroke(); }
    });
    const texture = paving.clone();
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(w / 8, d / 8);
    group.add(box(w, 0.1, d, material('#ffffff', { map: texture, roughness: 0.8 }), 0, 0.05, 0));
    // Glowing green inlays leading to the entrance stairs
    [-4, 4].forEach((x) => group.add(noRaycast(box(0.18, 0.04, 34, glow(PALETTE.green, 1.1), x, 0.11, 12))));
  }

  function bench(group, { w }) {
    const wood = material('#4a3a2c', { roughness: 0.8 });
    const metal = material('#2b2e36', { metalness: 0.7, roughness: 0.35 });
    group.add(box(w, 0.1, 0.5, wood, 0, 0.45, 0));
    group.add(box(w, 0.45, 0.08, wood, 0, 0.75, -0.24));
    [-w / 2 + 0.2, w / 2 - 0.2].forEach((x) => group.add(box(0.08, 0.45, 0.5, metal, x, 0.22, 0)));
    group.add(seat(0, 0.45, 0, 'Bench'));
  }

  const lightCone = new THREE.ConeGeometry(1.6, 4.2, 18, 1, true);
  function lampPost(group, { h }) {
    const metal = material('#24262d', { metalness: 0.7, roughness: 0.35 });
    group.add(cylinder(0.09, 0.12, h, metal, 0, h / 2, 0, 8));
    group.add(box(0.9, 0.18, 0.3, metal, 0.35, h, 0));
    group.add(noRaycast(box(0.7, 0.06, 0.22, glow('#d8f5ff', 2.2), 0.4, h - 0.11, 0)));
    const cone = new THREE.Mesh(lightCone, new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.position.set(0.4, h - 2.2, 0);
    group.add(noRaycast(cone));
  }

  function nameSign(group, { w, h, d }) {
    const face = canvasTexture('terminalNameSign', 1024, 256, (ctx, tw, th) => {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, tw, th);
      ctx.fillStyle = '#3c3c45'; ctx.fillRect(0, 0, tw, 44);
      ctx.fillStyle = PALETTE.white; ctx.font = 'bold 92px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText('THE TERMINAL APEX', tw / 2 - 90, 140);
      ctx.fillStyle = PALETTE.green; ctx.font = `bold 72px ${MONO}`;
      ctx.fillText('>_ ROOT', tw / 2 + 380, 210);
    });
    const body = material('#1b1c22', { metalness: 0.6, roughness: 0.35 });
    const front = new THREE.MeshBasicMaterial({ map: face });
    group.add(mesh(new THREE.BoxGeometry(w, h, d), [body, body, body, body, front, front], 0, h / 2 + 0.6, 0));
    group.add(box(w + 0.6, 0.6, d + 0.6, material('#2a2b31', { roughness: 0.6 }), 0, 0.3, 0));
    group.add(noRaycast(box(w + 0.1, 0.06, d + 0.1, glow(PALETTE.green, 1.4), 0, h + 0.62, 0)));
  }

  PropKit.registerBuilder(/^terminal_apex$/, 'terminalApex', terminalApex);
  PropKit.registerBuilder(/^terminal_forecourt$/, 'terminalForecourt', forecourt);
  PropKit.registerBuilder(/^terminal_bench$/, 'terminalBench', bench);
  PropKit.registerBuilder(/^terminal_lamp$/, 'terminalLamp', lampPost);
  PropKit.registerBuilder(/^terminal_sign$/, 'terminalSign', nameSign);
})();
