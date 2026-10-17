// ============================================================================
// CRYPTO VALLEY: A CRYPTO-FUTURIST WORLD NEXT TO SILICON VALLEY
// ============================================================================
// Inspired by Decentraland's Crypto Valley. Only the visual / spatial side is
// recreated: a zoned district with a central networking plaza (holographic
// sign, LED pillar ring, seating clusters), a corporate HQ sector of glass and
// concrete offices with walk-in lobbies, white-cube NFT-style art galleries
// (generative canvas art, in-game only: nothing is minted, sold or owned),
// a financial center whose towers are wrapped in LED screens with SIMULATED
// market data (random walk, no network calls), floating buildings on glowing
// pylons reached by warp pads and a spiral stair tower, a toy-like
// construction corner (cranes, excavator, scaffolding, cones), streets with
// lane markings, lamps and trees, and a bridge to Silicon Valley.
//
// There is no blockchain here: no wallets, tokens, trading or purchases. The
// "dApp" kiosks only show info cards; visiting all of them unlocks an in-game
// "Crypto Valley Explorer" badge stored in localStorage (instead of any
// token/NFT gating).
//
// Performance: everything repeated is instanced, no real lights (emissive
// materials and additive fake beams only), market screens redraw every 2 s.
(() => {
  const { material, glow, shade, mesh, box, cylinder, sphere, facedBox, animate, textSprite, interactive, seat, canvasTexture, labelTexture, repeated, windowsTexture, roundedSlab, roundedBoxGeometry } = PropKit.kit;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();
  const positionVector = new THREE.Vector3();
  const euler = new THREE.Euler();
  const tint = new THREE.Color();
  const noRaycast = (object) => { object.raycast = () => {}; return object; };

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < String(text).length; i++) hash = Math.imul(hash ^ String(text).charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  function instanced(geometry, instanceMaterial, count) {
    const result = new THREE.InstancedMesh(geometry, instanceMaterial, count);
    result.frustumCulled = false; // instances spread far from the geometry's own bounds
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  }

  // Plain (non rounded) box: per-face 0..1 UVs, good for tiled facades and ramps
  function plainBox(w, h, d, boxMaterial, x = 0, y = 0, z = 0) {
    return mesh(new THREE.BoxGeometry(w, h, d), boxMaterial, x, y, z);
  }

  function plane(w, h, planeMaterial, x = 0, y = 0, z = 0) {
    return mesh(new THREE.PlaneGeometry(w, h), planeMaterial, x, y, z);
  }

  const basic = (options) => new THREE.MeshBasicMaterial(options);
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // --------------------------------------------------------------------------
  // Realistic surface textures (concrete, pavers, asphalt, wood, water...)
  // --------------------------------------------------------------------------
  function noise(ctx, w, h, count, random, dark = 0.06, light = 0.05) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = random() < 0.5 ? `rgba(0,0,0,${dark})` : `rgba(255,255,255,${light})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
  }

  function concreteTexture(base = '#b8b5ae') {
    return canvasTexture(`cv-concrete|${base}`, 512, 512, (ctx, w, h) => {
      const random = seededRandom(hashString(base));
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = random() * w; const y = random() * h; const r = 30 + random() * 90;
        const blotch = ctx.createRadialGradient(x, y, 0, x, y, r);
        blotch.addColorStop(0, random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)');
        blotch.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blotch;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      noise(ctx, w, h, 9000, random);
      // Formwork panel seams and tie holes
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      for (let p = 0; p <= w; p += 256) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke(); }
      for (let p = 0; p <= h; p += 128) { ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let x = 64; x < w; x += 128) for (let y = 32; y < h; y += 64) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    });
  }

  function paversTexture(base = '#c9c7c2') {
    return canvasTexture(`cv-pavers|${base}`, 512, 512, (ctx, w, h) => {
      const random = seededRandom(hashString(`p${base}`));
      ctx.fillStyle = '#7d7b77';
      ctx.fillRect(0, 0, w, h);
      // 4 x 4 large-format slabs (1 m each when 512 px = 4 m), running bond
      for (let row = 0; row < 8; row++) {
        for (let col = -1; col < 4; col++) {
          const x = col * 128 + (row % 2) * 64;
          tint.set(base).offsetHSL(0, 0, (random() - 0.5) * 0.06);
          ctx.fillStyle = `#${tint.getHexString()}`;
          ctx.fillRect(x + 2, row * 64 + 2, 124, 60);
        }
      }
      noise(ctx, w, h, 7000, random, 0.07, 0.06);
    });
  }

  function asphaltTexture() {
    return canvasTexture('cv-asphalt', 256, 512, (ctx, w, h) => {
      const random = seededRandom(77);
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 6000, random, 0.12, 0.07);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(w * 0.18, 0, w * 0.12, h); // tire wear tracks
      ctx.fillRect(w * 0.7, 0, w * 0.12, h);
      // Solid edge lines and a dashed center line (3 m dash every 12 m)
      ctx.fillStyle = 'rgba(240,240,235,0.9)';
      ctx.fillRect(8, 0, 5, h);
      ctx.fillRect(w - 13, 0, 5, h);
      ctx.fillRect(w / 2 - 3, 0, 6, h * 0.25);
    });
  }

  function zebraTexture() {
    return canvasTexture('cv-zebra', 256, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(245,245,240,0.92)';
      for (let x = 6; x < w; x += 26) ctx.fillRect(x, 0, 14, h);
    });
  }

  function woodTexture() {
    return canvasTexture('cv-wood', 256, 256, (ctx, w, h) => {
      const random = seededRandom(5);
      ctx.fillStyle = '#b07c4f';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = random() < 0.5 ? 'rgba(80,45,20,0.25)' : 'rgba(230,190,140,0.2)';
        ctx.lineWidth = 1 + random() * 2;
        const y = random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,20,10,0.4)';
      for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 2);
    });
  }

  function latticeTexture() {
    return canvasTexture('cv-lattice', 128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#f2b705';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(w - 5, h - 5); ctx.moveTo(w - 5, 5); ctx.lineTo(5, h - 5); ctx.stroke();
    });
  }

  function fenceTexture() {
    return canvasTexture('cv-fence', 256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(190,195,200,0.95)';
      ctx.lineWidth = 1.5;
      for (let x = -h; x < w + h; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(0, 0, w, 6);
      ctx.fillRect(0, h - 6, w, 6);
      ctx.fillRect(0, 0, 6, h);
    });
  }

  function dirtTexture() {
    return canvasTexture('cv-dirt', 512, 512, (ctx, w, h) => {
      const random = seededRandom(91);
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        const x = random() * w; const y = random() * h; const r = 20 + random() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, random() < 0.5 ? 'rgba(60,40,25,0.25)' : 'rgba(190,160,120,0.2)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      noise(ctx, w, h, 12000, random, 0.18, 0.1);
      ctx.strokeStyle = 'rgba(50,35,20,0.25)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 6; i++) { // tire tracks
        const y = random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 60, w * 0.7, y - 60, w, y + 20); ctx.stroke();
      }
    });
  }

  function corrugatedTexture(color) {
    return canvasTexture(`cv-corrugated|${color}`, 256, 128, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, 0, 3, h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 4, 0, 2, h);
      }
    });
  }

  function waterTexture() {
    const texture = canvasTexture('cv-water', 512, 512, (ctx, w, h) => {
      const random = seededRandom(31);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2f6f8f'); g.addColorStop(1, '#245a78');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        ctx.strokeStyle = random() < 0.6 ? 'rgba(255,255,255,0.10)' : 'rgba(10,30,50,0.2)';
        ctx.lineWidth = 1 + random() * 2;
        const x = random() * w; const y = random() * h; const l = 10 + random() * 40;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 3, x + l, y); ctx.stroke();
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function tiled(texture, repeatX, repeatY) {
    return repeated(texture, repeatX, repeatY);
  }

  // Shared materials
  const MAT = {};
  function mats() {
    if (MAT.ready) return MAT;
    MAT.ready = true;
    MAT.concrete = material('#ffffff', { map: tiled(concreteTexture('#b8b5ae'), 2, 2), roughness: 0.9 });
    MAT.darkConcrete = material('#ffffff', { map: tiled(concreteTexture('#8f8c86'), 2, 2), roughness: 0.9 });
    MAT.white = material('#f3f3f0', { roughness: 0.85 });
    MAT.metal = material('#4b5560', { roughness: 0.35, metalness: 0.75 });
    MAT.darkMetal = material('#1f262e', { roughness: 0.4, metalness: 0.7 });
    MAT.steel = material('#aab4bd', { roughness: 0.3, metalness: 0.85 });
    MAT.glass = material('#8fb6cf', { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.6, depthWrite: false });
    MAT.railGlass = material('#bfe3f2', { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false });
    MAT.wood = material('#ffffff', { map: woodTexture(), roughness: 0.7 });
    MAT.stone = material('#e8e6e1', { roughness: 0.25, metalness: 0.05 });
    MAT.yellow = material('#f2b705', { roughness: 0.5, metalness: 0.2 });
    MAT.orange = material('#ff6d00', { roughness: 0.6 });
    MAT.soil = material('#4e3a2a', { roughness: 1 });
    MAT.cyan = glow('#22d3ee', 1.1);
    MAT.magenta = glow('#e040fb', 1.0);
    MAT.warmLight = glow('#fff1c9', 1.2);
    MAT.whiteLight = glow('#ffffff', 0.9);
    return MAT;
  }

  // --------------------------------------------------------------------------
  // Simulated market data for the financial center LED screens
  // --------------------------------------------------------------------------
  // A seeded random walk: NOT real prices and no network calls. Every screen
  // says "SIMULATED MARKET DATA".
  const market = (() => {
    const random = seededRandom(20260);
    const symbols = [
      { sym: 'BTC', name: 'Bitcoin', price: 64250, vol: 0.0035, color: '#f7931a' },
      { sym: 'ETH', name: 'Ether', price: 3180, vol: 0.005, color: '#8c9eff' },
      { sym: 'MANA', name: 'Decentraland', price: 0.42, vol: 0.009, color: '#ff5f7e' }
    ];
    symbols.forEach((s) => {
      s.candles = [];
      let price = s.price * (0.94 + random() * 0.04);
      for (let i = 0; i < 48; i++) {
        const open = price;
        let high = open; let low = open; let close = open;
        for (let k = 0; k < 6; k++) { close *= 1 + (random() - 0.48) * s.vol * 2; high = Math.max(high, close); low = Math.min(low, close); }
        s.candles.push({ open, high, low, close, volume: 0.3 + random() });
        price = close;
      }
      s.open24 = s.candles[0].open;
      s.ticks = 0;
    });
    const state = { symbols, last: -Infinity, textures: [], ticker: null };

    function step() {
      symbols.forEach((s) => {
        const candle = s.candles[s.candles.length - 1];
        candle.close *= 1 + (random() - 0.49) * s.vol * 2;
        candle.high = Math.max(candle.high, candle.close);
        candle.low = Math.min(candle.low, candle.close);
        candle.volume += random() * 0.2;
        s.ticks++;
        if (s.ticks % 4 === 0) { // new candle every 4 updates (8 s)
          s.candles.push({ open: candle.close, high: candle.close, low: candle.close, close: candle.close, volume: 0.2 + random() * 0.4 });
          if (s.candles.length > 48) s.candles.shift();
          s.open24 = s.candles[0].open;
        }
      });
    }

    function format(price) {
      if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (price >= 10) return price.toFixed(2);
      return price.toFixed(4);
    }

    function drawChart(ctx, w, h, s) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#050b18'); bg.addColorStop(1, '#0c1834');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const left = 30; const right = w - 130; const top = 120; const bottom = h - 120;
      ctx.strokeStyle = 'rgba(90,150,255,0.14)';
      ctx.lineWidth = 1;
      for (let x = left; x <= right; x += 62) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
      for (let y = top; y <= bottom; y += 45) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
      const last = s.candles[s.candles.length - 1].close;
      const change = (last / s.open24 - 1) * 100;
      const up = change >= 0;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = s.color;
      ctx.font = 'bold 54px Segoe UI, Arial, sans-serif';
      ctx.fillText(`${s.sym} / USD`, 30, 72);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 60px Consolas, Menlo, monospace';
      ctx.fillText(format(last), 330, 74);
      ctx.fillStyle = up ? '#2ee59d' : '#ff4d6a';
      ctx.font = 'bold 40px Consolas, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${up ? '+' : ''}${change.toFixed(2)}%`, w - 30, 72);
      // Candles
      let min = Infinity; let max = -Infinity;
      s.candles.forEach((c) => { min = Math.min(min, c.low); max = Math.max(max, c.high); });
      const pad = (max - min) * 0.08 || 1;
      min -= pad; max += pad;
      const toY = (price) => bottom - ((price - min) / (max - min)) * (bottom - top);
      const step = (right - left) / s.candles.length;
      s.candles.forEach((c, i) => {
        const x = left + i * step + step / 2;
        const color = c.close >= c.open ? '#2ee59d' : '#ff4d6a';
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, toY(c.high)); ctx.lineTo(x, toY(c.low)); ctx.stroke();
        const y0 = toY(Math.max(c.open, c.close)); const y1 = toY(Math.min(c.open, c.close));
        ctx.fillRect(x - step * 0.32, y0, step * 0.64, Math.max(2, y1 - y0));
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x - step * 0.32, h - 60 - c.volume * 26, step * 0.64, c.volume * 26);
        ctx.globalAlpha = 1;
      });
      // Moving average
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
      ctx.beginPath();
      s.candles.forEach((c, i) => {
        const window = s.candles.slice(Math.max(0, i - 7), i + 1);
        const average = window.reduce((sum, item) => sum + item.close, 0) / window.length;
        const x = left + i * step + step / 2;
        if (i === 0) ctx.moveTo(x, toY(average)); else ctx.lineTo(x, toY(average));
      });
      ctx.stroke();
      // Price axis and live price marker
      ctx.textAlign = 'left';
      ctx.font = '22px Consolas, Menlo, monospace';
      ctx.fillStyle = 'rgba(200,215,240,0.75)';
      for (let i = 0; i <= 4; i++) {
        const price = min + ((max - min) * i) / 4;
        ctx.fillText(format(price), right + 10, toY(price) + 7);
      }
      ctx.fillStyle = up ? '#2ee59d' : '#ff4d6a';
      ctx.fillRect(right, toY(last) - 16, 130, 32);
      ctx.fillStyle = '#04101e';
      ctx.font = 'bold 22px Consolas, Menlo, monospace';
      ctx.fillText(format(last), right + 6, toY(last) + 8);
      // Footer disclaimer
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, h - 44, w, 44);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 24px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SIMULATED MARKET DATA  -  IN-GAME DISPLAY ONLY  -  NOT REAL PRICES', w / 2, h - 14);
    }

    function drawTicker(ctx, w, h) {
      ctx.fillStyle = '#03070f';
      ctx.fillRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      let x = 16;
      symbols.forEach((s) => {
        const last = s.candles[s.candles.length - 1].close;
        const change = (last / s.open24 - 1) * 100;
        ctx.font = 'bold 50px Consolas, Menlo, monospace';
        ctx.fillStyle = s.color; ctx.fillText(s.sym, x, h / 2); x += ctx.measureText(s.sym).width + 14;
        ctx.fillStyle = '#ffffff'; const p = format(last); ctx.fillText(p, x, h / 2); x += ctx.measureText(p).width + 14;
        ctx.fillStyle = change >= 0 ? '#2ee59d' : '#ff4d6a';
        const c = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`; ctx.fillText(c, x, h / 2); x += ctx.measureText(c).width + 34;
      });
      ctx.font = 'bold 30px Segoe UI, Arial, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('SIMULATED DATA', x, h / 2);
    }

    function chartTexture(index) {
      if (!state.textures[index]) state.textures[index] = canvasTexture(`cv-market|${index}`, 1024, 512, (ctx, w, h) => drawChart(ctx, w, h, symbols[index]));
      return state.textures[index];
    }

    function tickerTexture() {
      if (!state.ticker) {
        state.ticker = canvasTexture('cv-ticker', 1024, 96, drawTicker);
        state.ticker.wrapS = THREE.RepeatWrapping;
      }
      return state.ticker;
    }

    // Called from every tower's animation; redraws at most every 2 seconds
    function update(time) {
      if (state.ticker) state.ticker.offset.x = (time * 0.04) % 1;
      if (time - state.last < 2) return;
      state.last = time;
      step();
      state.textures.forEach((texture, index) => {
        if (!texture) return;
        const canvas = texture.image;
        drawChart(canvas.getContext('2d'), canvas.width, canvas.height, symbols[index]);
        texture.needsUpdate = true;
      });
      if (state.ticker) {
        const canvas = state.ticker.image;
        drawTicker(canvas.getContext('2d'), canvas.width, canvas.height);
        state.ticker.needsUpdate = true;
      }
    }

    return { symbols, chartTexture, tickerTexture, update };
  })();

  // --------------------------------------------------------------------------
  // Generative art for the galleries (canvas-drawn, in-game art only)
  // --------------------------------------------------------------------------
  const PALETTES = [
    ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#f4f1de'],
    ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
    ['#f1faee', '#e63946', '#a8dadc', '#457b9d', '#1d3557'],
    ['#fefae0', '#283618', '#606c38', '#dda15e', '#bc6c25'],
    ['#10002b', '#5a189a', '#9d4edd', '#e0aaff', '#ff9e00'],
    ['#f8f9fa', '#212529', '#ffbe0b', '#fb5607', '#3a86ff']
  ];

  function artTexture(seed, style) {
    return canvasTexture(`cv-art|${seed}|${style}`, 512, 512, (ctx, w, h) => {
      const random = seededRandom(seed * 7919 + style);
      const palette = PALETTES[seed % PALETTES.length];
      const pick = () => palette[Math.floor(random() * palette.length)];
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, w, h);
      if (style === 0) { // flow field
        const f = 0.004 + random() * 0.004;
        for (let i = 0; i < 700; i++) {
          let x = random() * w; let y = random() * h;
          ctx.strokeStyle = pick(); ctx.globalAlpha = 0.6; ctx.lineWidth = 1 + random() * 2;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < 40; k++) {
            const angle = (Math.sin(x * f) + Math.cos(y * f * 1.3)) * Math.PI;
            x += Math.cos(angle) * 4; y += Math.sin(angle) * 4;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (style === 1) { // concentric rings
        for (let ring = 0; ring < 6; ring++) {
          const cx = random() * w; const cy = random() * h;
          for (let r = 220; r > 4; r -= 12) {
            ctx.strokeStyle = pick(); ctx.globalAlpha = 0.7; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          }
        }
      } else if (style === 2) { // nested jittered squares
        const n = 8; const cell = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          ctx.strokeStyle = pick(); ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
          for (let k = 0; k < 5; k++) {
            const s = cell * (0.9 - k * 0.16); const jx = (random() - 0.5) * 6 * (j / n) * 2; const jy = (random() - 0.5) * 6 * (j / n) * 2;
            ctx.save(); ctx.translate(i * cell + cell / 2 + jx, j * cell + cell / 2 + jy); ctx.rotate((random() - 0.5) * 0.5 * (j / n));
            ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
          }
        }
      } else if (style === 3) { // truchet arcs
        const n = 10; const cell = w / n;
        ctx.lineWidth = 7; ctx.strokeStyle = palette[3];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const x = i * cell; const y = j * cell;
          ctx.strokeStyle = (i + j) % 3 ? palette[3] : palette[4];
          ctx.beginPath();
          if (random() < 0.5) { ctx.arc(x, y, cell / 2, 0, Math.PI / 2); ctx.moveTo(x + cell, y + cell / 2); ctx.arc(x + cell, y + cell, cell / 2, -Math.PI / 2, Math.PI, true); }
          else { ctx.arc(x + cell, y, cell / 2, Math.PI / 2, Math.PI); ctx.moveTo(x + cell / 2, y + cell); ctx.arc(x, y + cell, cell / 2, -Math.PI / 2, 0); }
          ctx.stroke();
        }
      } else if (style === 4) { // recursive subdivision
        const split = (x, y, sw, sh, depth) => {
          if (depth > 5 || (depth > 1 && random() < 0.25)) {
            ctx.fillStyle = random() < 0.6 ? palette[0] : pick(); ctx.fillRect(x, y, sw, sh);
            ctx.strokeStyle = '#111111'; ctx.lineWidth = 6; ctx.strokeRect(x, y, sw, sh); return;
          }
          if (sw > sh) { const c = sw * (0.3 + random() * 0.4); split(x, y, c, sh, depth + 1); split(x + c, y, sw - c, sh, depth + 1); }
          else { const c = sh * (0.3 + random() * 0.4); split(x, y, sw, c, depth + 1); split(x, y + c, sw, sh - c, depth + 1); }
        };
        split(0, 0, w, h, 0);
      } else if (style === 5) { // halftone wave
        for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) {
          const v = (Math.sin(x * 0.02 + seed) + Math.cos(y * 0.025 - seed) + 2) / 4;
          ctx.fillStyle = palette[1 + Math.floor(v * 3.99)];
          ctx.beginPath(); ctx.arc(x, y, 1 + v * 7, 0, Math.PI * 2); ctx.fill();
        }
      } else if (style === 6) { // sine stripes
        for (let y = -20; y < h + 20; y += 14) {
          ctx.strokeStyle = palette[1 + (Math.floor(y / 14) % 4 + 4) % 4]; ctx.lineWidth = 9;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 8) { const yy = y + Math.sin(x * 0.02 + y * 0.03) * 18; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
          ctx.stroke();
        }
      } else { // hexagon field
        const r = 22; const hx = r * Math.sqrt(3);
        for (let row = 0; row < 16; row++) for (let col = 0; col < 14; col++) {
          const cx = col * hx + (row % 2) * hx / 2; const cy = row * r * 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); }
          ctx.closePath();
          ctx.fillStyle = random() < 0.35 ? pick() : palette[0];
          ctx.fill();
          ctx.strokeStyle = palette[4]; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // Fine canvas grain
      noise(ctx, w, h, 3000, random, 0.05, 0.05);
    });
  }

  // --------------------------------------------------------------------------
  // In-game "Crypto Valley Explorer" badge (replaces any token / NFT gating)
  // --------------------------------------------------------------------------
  const BADGE_KEY = 'multiverse-cryptovalley-kiosks';
  const KIOSK_ZONES = ['plaza', 'hq', 'galleries', 'finance', 'floating', 'construction'];
  function recordKioskVisit(zone) {
    let visited = [];
    try { visited = JSON.parse(localStorage.getItem(BADGE_KEY) || '[]'); } catch (error) { visited = []; }
    if (!Array.isArray(visited)) visited = [];
    const fresh = !visited.includes(zone);
    if (fresh) visited.push(zone);
    try { localStorage.setItem(BADGE_KEY, JSON.stringify(visited)); } catch (error) { /* storage blocked: progress is not saved */ }
    const done = KIOSK_ZONES.filter((key) => visited.includes(key)).length;
    if (done >= KIOSK_ZONES.length) return fresh ? 'Crypto Valley Explorer badge unlocked! (in-game achievement only)' : 'You already hold the Crypto Valley Explorer badge (in-game).';
    return `dApp panels visited: ${done}/${KIOSK_ZONES.length}. Visit them all for the in-game Crypto Valley Explorer badge.`;
  }

  const IN_GAME_NOTE = 'Everything in Crypto Valley is in-game only: there is no real trading, no wallets, no tokens and no purchases. Screens show simulated data.';

  function kioskTexture(kind, title, accent) {
    return canvasTexture(`cv-kiosk|${kind}|${title}`, 512, 320, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0a1020'); bg.addColorStop(1, '#16213e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = '#04101e'; ctx.font = 'bold 30px Segoe UI, Arial, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText(title, 20, 28);
      ctx.fillStyle = '#dfe7f5'; ctx.font = '22px Segoe UI, Arial, sans-serif';
      const rows = {
        plaza: ['Welcome to Crypto Valley', 'Zones: HQ sector (west)', 'Galleries (south-west)', 'Financial center (east)', 'Floating towers (south-east)'],
        hq: ['Project directory', 'Ledgerline Labs', 'Blockforge Foundation', 'Nodeway Protocol', 'Hashgrove Collective'],
        galleries: ['Gallery guide', 'White Cube Gallery', 'Generative Hall', 'Art is in-game only', 'Nothing here is for sale'],
        finance: ['Market wall (demo)', 'BTC  ETH  MANA', 'Prices are simulated', 'No trading available', 'Refresh: every 2 s'],
        floating: ['Warp pad map', 'Aether Pavilion: Lv 1-2', 'Helix Spire: spiral stairs', 'Pads glow cyan', 'Press E on a pad'],
        construction: ['Build permit #0042', 'Meridian Tower', 'Status: under construction', 'Hard hats required', 'Opening: soon (in-game)']
      }[kind] || ['dApp panel'];
      rows.forEach((row, index) => {
        ctx.fillStyle = index === 0 ? accent : '#dfe7f5';
        ctx.font = index === 0 ? 'bold 26px Segoe UI, Arial, sans-serif' : '22px Segoe UI, Arial, sans-serif';
        ctx.fillText(row, 24, 90 + index * 38);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, h - 40, w, 40);
      ctx.fillStyle = '#ffd166'; ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
      ctx.fillText('DEMO PANEL - NO REAL TRADING OR PURCHASES', 20, h - 20);
    });
  }

  // Standing dApp-style panel: E shows an info card and counts toward the badge
  function dappPanel(group, { kind, title, info, accent = '#22d3ee' }) {
    const m = mats();
    const panel = new THREE.Group();
    panel.add(box(0.8, 1.1, 0.5, m.darkMetal, 0, 0.55, 0));
    const screen = facedBox(1.9, 1.2, 0.12, m.darkMetal, basic({ map: kioskTexture(kind, title, accent) }), 0, 1.7, 0.05);
    screen.rotation.x = -0.18;
    panel.add(screen);
    panel.add(box(1.95, 0.06, 0.16, glow(accent, 1.2), 0, 2.33, 0.02));
    screen.userData.prompt = 'Press E to open the dApp panel';
    screen.userData.onInteract = (hooks) => {
      hooks.inspect(title, `${info} ${IN_GAME_NOTE}`);
      return recordKioskVisit(kind);
    };
    interactive(screen, 'action', title);
    group.add(panel);
    return panel;
  }

  // --------------------------------------------------------------------------
  // Builders
  // --------------------------------------------------------------------------
  const builders = {
    // Paved ground of the whole World, streets with lane markings,
    // crosswalks, street lamps and trees (all instanced)
    streets(group, { w, d, data }) {
      const m = mats();
      const pavers = tiled(paversTexture('#cdcbc5'), w / 4, d / 4);
      const ground = plainBox(w, 0.3, d, material('#ffffff', { map: pavers, roughness: 0.92 }), 0, -0.15, 0);
      ground.castShadow = false;
      group.add(ground);

      const roads = [
        { axis: 'x', at: -60, from: -w / 2, to: w / 2 },
        { axis: 'x', at: 60, from: -w / 2, to: w / 2 },
        { axis: 'z', at: -80, from: -d / 2, to: d / 2 },
        { axis: 'z', at: 80, from: -d / 2, to: d / 2 },
        { axis: 'z', at: 0, from: -d / 2, to: -32 },
        { axis: 'z', at: 0, from: 32, to: d / 2 }
      ];
      const roadWidth = 10;
      roads.forEach((road) => {
        const length = road.to - road.from;
        const texture = tiled(asphaltTexture(), 1, length / 12);
        const strip = plane(roadWidth, length, material('#ffffff', { map: texture, roughness: 0.95 }));
        strip.rotation.x = -Math.PI / 2;
        if (road.axis === 'x') strip.rotation.z = Math.PI / 2;
        const middle = (road.from + road.to) / 2;
        if (road.axis === 'x') strip.position.set(middle, 0.02, road.at); else strip.position.set(road.at, 0.02, middle);
        strip.castShadow = false;
        group.add(strip);
      });
      // Intersections: clean asphalt patches plus zebra crossings on every arm
      const crossings = [[-80, -60], [80, -60], [-80, 60], [80, 60], [0, -60], [0, 60]];
      const patchMaterial = material('#ffffff', { map: tiled(asphaltTexture(), 0.02, 0.02), roughness: 0.95 });
      const zebraSpots = [];
      crossings.forEach(([x, z]) => {
        const patch = plane(roadWidth, roadWidth, patchMaterial, x, 0.026, z);
        patch.rotation.x = -Math.PI / 2;
        patch.castShadow = false;
        group.add(patch);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => zebraSpots.push([x + dx * 7.5, z + dz * 7.5, dx !== 0]));
      });
      const zebras = instanced(new THREE.PlaneGeometry(roadWidth - 1, 3).rotateX(-Math.PI / 2), material('#ffffff', { map: zebraTexture(), transparent: true, depthWrite: false }), zebraSpots.length);
      zebraSpots.forEach(([x, z, alongX], index) => {
        matrix.compose(positionVector.set(x, 0.032, z), quaternion.setFromEuler(euler.set(0, alongX ? Math.PI / 2 : 0, 0)), scaleVector.set(1, 1, 1));
        zebras.setMatrixAt(index, matrix);
      });
      zebras.castShadow = false;
      noRaycast(zebras);
      group.add(zebras);
      // Sidewalk curbs along the asphalt (one instanced mesh)
      const curbSpots = [];
      roads.forEach((road) => {
        for (const side of [-1, 1]) {
          let start = road.from;
          const stops = [];
          crossings.forEach(([x, z]) => { const along = road.axis === 'x' ? x : z; const across = road.axis === 'x' ? z : x; if (across === road.at && along > road.from && along < road.to) stops.push(along); });
          stops.sort((a, b) => a - b).concat([road.to + roadWidth / 2]).forEach((stop) => {
            const end = stop - roadWidth / 2;
            if (end - start > 1) curbSpots.push({ road, side, start, end });
            start = stop + roadWidth / 2;
          });
        }
      });
      const curbs = instanced(new THREE.BoxGeometry(1, 0.14, 0.3), m.concrete, curbSpots.length);
      curbSpots.forEach(({ road, side, start, end }, index) => {
        const middle = (start + end) / 2; const length = end - start; const offset = road.at + side * (roadWidth / 2 + 0.15);
        if (road.axis === 'x') matrix.compose(positionVector.set(middle, 0.07, offset), quaternion.identity(), scaleVector.set(length, 1, 1));
        else matrix.compose(positionVector.set(offset, 0.07, middle), quaternion.setFromEuler(euler.set(0, Math.PI / 2, 0)), scaleVector.set(length, 1, 1));
        curbs.setMatrixAt(index, matrix);
      });
      group.add(curbs);

      // Street lamps and trees along every road (skipping intersections)
      const lampSpots = [];
      const treeSpots = [];
      const nearCrossing = (x, z, r) => crossings.some(([cx, cz]) => Math.abs(cx - x) < r && Math.abs(cz - z) < r);
      const blocked = (x, z) => ((data && data.avoid) || []).some(([ax, az, aw, ad]) => Math.abs(x - ax) < aw / 2 && Math.abs(z - az) < ad / 2);
      roads.forEach((road) => {
        for (const side of [-1, 1]) {
          for (let t = road.from + 6; t <= road.to - 6; t += 12) {
            const lamp = Math.round((t - road.from) / 12) % 2 === 0;
            const offset = road.at + side * (lamp ? 6.6 : 8.4);
            const x = road.axis === 'x' ? t : offset;
            const z = road.axis === 'x' ? offset : t;
            if (nearCrossing(x, z, 10) || Math.hypot(x, z) < 36 || blocked(x, z)) continue;
            if (lamp) lampSpots.push([x, z, road.axis === 'x' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2)]);
            else treeSpots.push([x, z]);
          }
        }
      });
      // A ring of trees framing the plaza
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + 0.11;
        const x = Math.cos(angle) * 44; const z = Math.sin(angle) * 44 * 0.95;
        if (Math.abs(x) < 9) continue; // keep the avenue axis open
        treeSpots.push([x, z]);
      }
      const poles = instanced(new THREE.CylinderGeometry(0.08, 0.12, 8, 8).translate(0, 4, 0), m.metal, lampSpots.length);
      const arms = instanced(new THREE.BoxGeometry(0.1, 0.1, 1.8).translate(0, 7.9, 0.9), m.metal, lampSpots.length);
      const heads = instanced(new THREE.BoxGeometry(0.42, 0.12, 0.9).translate(0, 7.82, 1.6), m.warmLight, lampSpots.length);
      lampSpots.forEach(([x, z, rotation], index) => {
        matrix.compose(positionVector.set(x, 0, z), quaternion.setFromEuler(euler.set(0, rotation, 0)), scaleVector.set(1, 1, 1));
        poles.setMatrixAt(index, matrix); arms.setMatrixAt(index, matrix); heads.setMatrixAt(index, matrix);
      });
      heads.castShadow = false;
      group.add(poles, arms, heads);
      addTrees(group, treeSpots, 404);
    },

    // Central arrival plaza: granite rings, holographic sign, LED pillar ring,
    // networking seating clusters around planters
    plaza(group, { w, label }) {
      const m = mats();
      const radius = w / 2;
      const floorTexture = canvasTexture('cv-plaza-floor', 1024, 1024, (ctx, size) => {
        const random = seededRandom(12);
        const c = size / 2;
        ctx.fillStyle = '#3d4249'; ctx.fillRect(0, 0, size, size);
        for (let r = c; r > 0; r -= 48) {
          tint.set('#4a5058').offsetHSL(0, 0, (random() - 0.5) * 0.05);
          ctx.fillStyle = `#${tint.getHexString()}`;
          ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
        for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * 96, c + Math.sin(a) * 96); ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); ctx.stroke(); }
        // Light granite inlay star and hexagon emblem in the middle
        ctx.fillStyle = '#d9d6cf';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a - 0.05) * c * 0.8, c + Math.sin(a - 0.05) * c * 0.8); ctx.lineTo(c + Math.cos(a + 0.05) * c * 0.8, c + Math.sin(a + 0.05) * c * 0.8); ctx.fill();
        }
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 10;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(c + Math.cos(a) * 80, c + Math.sin(a) * 80); }
        ctx.stroke();
        noise(ctx, size, size, 20000, random, 0.08, 0.06);
      });
      const floor = cylinder(radius, radius, 0.14, material('#ffffff', { map: floorTexture, roughness: 0.45, metalness: 0.1 }), 0, 0.07, 0, 64);
      floor.castShadow = false;
      group.add(floor);
      const ring = noRaycast(mesh(new THREE.RingGeometry(radius - 2.6, radius - 2.2, 64), m.cyan, 0, 0.15, 0));
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      // LED pillar ring: colors travel around the plaza (instance colors)
      const pillarCount = 16;
      const pillarRadius = radius - 5;
      const bases = instanced(new THREE.BoxGeometry(1, 0.5, 1).translate(0, 0.25, 0), m.darkMetal, pillarCount);
      const pillars = instanced(new THREE.BoxGeometry(0.5, 6, 0.5).translate(0, 3.5, 0), basic({ color: '#ffffff' }), pillarCount);
      for (let i = 0; i < pillarCount; i++) {
        const angle = (i / pillarCount) * Math.PI * 2 + Math.PI / pillarCount;
        matrix.compose(positionVector.set(Math.cos(angle) * pillarRadius, 0.14, Math.sin(angle) * pillarRadius), quaternion.setFromEuler(euler.set(0, -angle, 0)), scaleVector.set(1, 1, 1));
        bases.setMatrixAt(i, matrix);
        pillars.setMatrixAt(i, matrix);
        pillars.setColorAt(i, tint.setHSL(i / pillarCount, 0.85, 0.6));
      }
      pillars.castShadow = false;
      group.add(bases, pillars);
      let lastPillarUpdate = 0;
      animate(pillars, (time) => {
        if (time - lastPillarUpdate < 0.1) return;
        lastPillarUpdate = time;
        for (let i = 0; i < pillarCount; i++) {
          const wave = 0.5 + 0.5 * Math.sin(time * 2 - i * 0.8);
          pillars.setColorAt(i, tint.setHSL((0.5 + i / pillarCount * 0.35 + time * 0.03) % 1, 0.9, 0.35 + wave * 0.35));
        }
        pillars.instanceColor.needsUpdate = true;
      });

      // Big holographic "Crypto Valley" sign over an emitter, north side
      const signZ = -14;
      group.add(cylinder(2.4, 2.8, 0.6, m.darkMetal, 0, 0.44, signZ, 24));
      group.add(cylinder(1.9, 1.9, 0.06, m.cyan, 0, 0.77, signZ, 24));
      const cone = noRaycast(mesh(new THREE.CylinderGeometry(6, 1.9, 8, 24, 1, true), additive('#22d3ee', 0.08), 0, 4.8, signZ));
      cone.castShadow = false;
      group.add(cone);
      const holoTexture = canvasTexture('cv-holo-sign', 1024, 256, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        const gradient = ctx.createLinearGradient(0, 0, cw, 0);
        gradient.addColorStop(0, '#22d3ee'); gradient.addColorStop(0.5, '#a78bfa'); gradient.addColorStop(1, '#f472b6');
        ctx.font = 'bold 150px Segoe UI, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 30;
        ctx.fillStyle = gradient;
        ctx.fillText('CRYPTO VALLEY', cw / 2, ch / 2 - 6);
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = 0; y < ch; y += 6) ctx.fillRect(0, y, cw, 2); // scanlines
      });
      const holoMaterial = new THREE.MeshBasicMaterial({ map: holoTexture, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const holo = new THREE.Group();
      [0, Math.PI].forEach((rotation) => {
        const face = noRaycast(plane(20, 5, holoMaterial, 0, 0, rotation ? -0.05 : 0.05));
        face.rotation.y = rotation;
        face.castShadow = false;
        holo.add(face);
      });
      holo.position.set(0, 10, signZ);
      group.add(holo);
      animate(holo, (time) => {
        holo.position.y = 10 + Math.sin(time * 0.8) * 0.3;
        holoMaterial.opacity = 0.82 + Math.sin(time * 13) * 0.04 + (Math.sin(time * 1.7) > 0.97 ? -0.3 : 0);
      });

      // Networking seating clusters: planter with a tree and three benches
      for (let c = 0; c < 6; c++) {
        const angle = (c / 6) * Math.PI * 2;
        const cx = Math.cos(angle) * 17; const cz = Math.sin(angle) * 17;
        if (Math.abs(cz - signZ) < 6 && Math.abs(cx) < 6) continue;
        group.add(cylinder(1.5, 1.6, 0.6, m.concrete, cx, 0.44, cz, 20));
        group.add(cylinder(1.35, 1.35, 0.05, m.soil, cx, 0.75, cz, 20));
        group.add(cylinder(0.14, 0.2, 2.8, material('#5d4037'), cx, 2, cz, 6));
        group.add(mesh(new THREE.IcosahedronGeometry(1.7, 1), material('#4f8a3c', { flatShading: true, roughness: 0.9 }), cx, 3.9, cz));
        for (let b = 0; b < 3; b++) {
          const benchAngle = angle + (b / 3) * Math.PI * 2 + Math.PI / 3;
          const bx = cx + Math.cos(benchAngle) * 3.1; const bz = cz + Math.sin(benchAngle) * 3.1;
          const bench = box(2.6, 0.32, 0.7, m.wood, bx, 0.43, bz);
          bench.rotation.y = -benchAngle + Math.PI / 2;
          group.add(bench);
          const support = box(2.2, 0.28, 0.4, m.darkConcrete, bx, 0.24, bz);
          support.rotation.y = bench.rotation.y;
          group.add(support);
          group.add(seat(bx, 0.6, bz, 'Plaza bench', -benchAngle - Math.PI / 2));
        }
      }
      dappPanel(group, { kind: 'plaza', title: 'Crypto Valley Guide', info: 'Crypto Valley is a crypto-futurist district: corporate HQs to the north and west, NFT-style art galleries in the south-west, a financial center with LED market screens in the east and floating buildings in the south-east. The bridge to the north leads to Silicon Valley.', accent: '#22d3ee' }).position.set(9, 0.14, 22);
      const caption = textSprite(label || 'Crypto Valley Plaza', { width: 16, background: 'rgba(10, 16, 32, 0.8)' });
      caption.position.set(0, 16, signZ);
      group.add(caption);
    },

    // Glass + concrete office with a walk-in lobby (door on +z) and an info panel
    hq(group, { w, h, d, color, label, data }) {
      const m = mats();
      const lobbyH = 5;
      const door = 4.4;
      group.add(plainBox(w, 0.2, d, material('#ffffff', { map: tiled(paversTexture('#e7e4de'), w / 4, d / 4), roughness: 0.3 }), 0, 0.1, 0));
      group.add(box(w, lobbyH, 0.4, m.concrete, 0, lobbyH / 2, -d / 2 + 0.2));
      group.add(box(0.4, lobbyH, d, m.concrete, -w / 2 + 0.2, lobbyH / 2, 0));
      group.add(box(0.4, lobbyH, d, m.concrete, w / 2 - 0.2, lobbyH / 2, 0));
      const segment = (w - 0.8 - door) / 2;
      group.add(plainBox(segment, lobbyH, 0.12, m.glass, -(door / 2 + segment / 2), lobbyH / 2, d / 2 - 0.2));
      group.add(plainBox(segment, lobbyH, 0.12, m.glass, door / 2 + segment / 2, lobbyH / 2, d / 2 - 0.2));
      group.add(plainBox(door, lobbyH - 3.4, 0.12, m.glass, 0, 3.4 + (lobbyH - 3.4) / 2, d / 2 - 0.2));
      group.add(box(w, 0.4, d, m.concrete, 0, lobbyH + 0.2, 0));
      group.add(plainBox(w * 0.6, 0.05, d * 0.45, m.whiteLight, 0, lobbyH - 0.03, -1));
      // Office floors above: realistic curtain wall
      const bodyH = h - lobbyH - 0.4;
      const facade = tiled(windowsTexture('#c4c7cc', '#ffe9a8'), 4 / 6, 4 / 32);
      const body = roundedSlab(w, bodyH, d, Math.min(w, d) * 0.08, new THREE.MeshStandardMaterial({ map: facade, roughness: 0.25, metalness: 0.45 }));
      body.position.y = lobbyH + 0.4 + bodyH / 2;
      group.add(body);
      group.add(box(w + 0.6, 0.7, d + 0.6, m.darkConcrete, 0, h + 0.35, 0));
      // Concrete fins on the front facade
      const fins = instanced(new THREE.BoxGeometry(0.5, bodyH, 0.7), m.concrete, 5);
      for (let i = 0; i < 5; i++) {
        matrix.makeTranslation(-w / 2 + 1 + (i * (w - 2)) / 4, lobbyH + 0.4 + bodyH / 2, d / 2 + 0.3);
        fins.setMatrixAt(i, matrix);
      }
      group.add(fins);
      // Canopy with the project name, rooftop wordmark (text only, fictional)
      const nameTexture = labelTexture(label, { bg: '#20252b', fg: color, width: 1024, height: 128, font: 'bold 70px Segoe UI, Helvetica, Arial, sans-serif' });
      group.add(facedBox(door + 5, 0.7, 3, m.darkConcrete, basic({ map: nameTexture }), 0, 3.9, d / 2 + 1.4));
      const roofSign = facedBox(Math.min(w * 0.8, 22), Math.min(w * 0.8, 22) / 8, 0.3, m.darkMetal, basic({ map: labelTexture(label, { bg: '#0d1117', fg: color, width: 1024, height: 128, font: 'bold 76px Segoe UI, Helvetica, Arial, sans-serif' }) }), 0, h + 0.7 + Math.min(w * 0.8, 22) / 16, d / 2 - 1.2);
      group.add(roofSign);
      // Lobby interior: reception desk, logo wall, plants, a bench and the info panel
      group.add(box(5, 1.1, 1.2, m.stone, 0, 0.75, -d / 2 + 4.5));
      group.add(box(5.04, 0.12, 1.24, glow(color, 1), 0, 1.05, -d / 2 + 4.5));
      group.add(plane(9, 1.2, basic({ map: labelTexture(data.tagline || label, { bg: '#f2f1ed', fg: '#22262b', width: 1024, height: 128, font: 'bold 54px Segoe UI, Arial, sans-serif' }) }), 0, 3.2, -d / 2 + 0.41));
      group.add(plane(3, 0.12, glow(color, 1.2), 0, 2.45, -d / 2 + 0.42));
      [[-w / 2 + 1.6, -d / 2 + 1.6], [w / 2 - 1.6, -d / 2 + 1.6]].forEach(([x, z]) => {
        group.add(cylinder(0.45, 0.35, 0.8, m.darkConcrete, x, 0.6, z, 12));
        group.add(mesh(new THREE.IcosahedronGeometry(0.8, 1), material('#3f7d3a', { flatShading: true }), x, 1.6, z));
      });
      group.add(box(3, 0.45, 0.8, m.wood, -w / 2 + 3.5, 0.42, d / 2 - 3));
      group.add(seat(-w / 2 + 3.5, 0.65, d / 2 - 3, 'Lobby bench', Math.PI));
      const panel = new THREE.Group();
      panel.add(box(0.5, 1.1, 0.35, m.darkMetal, 0, 0.75, 0));
      const screen = facedBox(1.5, 0.95, 0.08, m.darkMetal, basic({ map: kioskTexture('hq', label, color) }), 0, 1.75, 0.04);
      screen.userData.label = label;
      screen.userData.info = `${data.info || `${label} is a fictional web3 project headquartered in Crypto Valley.`} ${IN_GAME_NOTE}`;
      panel.add(interactive(screen, 'inspect', label));
      panel.position.set(w / 2 - 3.5, 0, -1);
      panel.rotation.y = -0.5;
      group.add(panel);
    },

    // Financial tower wrapped in LED screens showing simulated candlestick charts
    finTower(group, { w, h, d, label, data }) {
      const m = mats();
      const podiumH = 8;
      const podium = plainBox(w + 8, podiumH, d + 8, new THREE.MeshStandardMaterial({ map: tiled(windowsTexture('#5d6670', '#ffe2a0'), (w + 8) / 6, podiumH / 8), roughness: 0.3, metalness: 0.5 }), 0, podiumH / 2 + 0.1, 0);
      group.add(podium);
      group.add(plainBox(w + 8.6, 0.6, d + 8.6, m.darkConcrete, 0, podiumH + 0.3, 0));
      const bodyH = h - podiumH;
      const tower = plainBox(w, bodyH, d, new THREE.MeshStandardMaterial({ map: tiled(windowsTexture('#3e4a57', '#cfe6ff'), w / 6, bodyH / 32), roughness: 0.15, metalness: 0.6 }), 0, podiumH + bodyH / 2, 0);
      group.add(tower);
      // LED band: four screens (one per symbol, rotating per tower)
      const bandBottom = podiumH + 6;
      const bandH = Math.min(22, bodyH * 0.35);
      const offset = data.symbolOffset || 0;
      const faces = [[0, 0, d / 2 + 0.35, 0, w], [Math.PI / 2, w / 2 + 0.35, 0, 0, d], [Math.PI, 0, -d / 2 - 0.35, 0, w], [-Math.PI / 2, -w / 2 - 0.35, 0, 0, d]];
      faces.forEach(([rotation, x, , , width], index) => {
        const z = faces[index][2];
        const screen = plane(width + 0.6, bandH, basic({ map: market.chartTexture((index + offset) % 3) }), x, bandBottom + bandH / 2, z);
        screen.rotation.y = rotation;
        screen.castShadow = false;
        group.add(screen);
        const ticker = plane(width + 0.6, 2.2, basic({ map: market.tickerTexture() }), x * 1.001, h - 6, z * 1.001);
        ticker.rotation.y = rotation;
        ticker.castShadow = false;
        group.add(ticker);
      });
      group.add(plainBox(w + 1.2, 0.5, d + 1.2, m.darkMetal, 0, bandBottom - 0.25, 0));
      group.add(plainBox(w + 1.2, 0.5, d + 1.2, m.darkMetal, 0, bandBottom + bandH + 0.25, 0));
      // Crown, antenna and a blinking aircraft light
      group.add(plainBox(w * 0.7, 5, d * 0.7, m.darkMetal, 0, h + 2.5, 0));
      group.add(plainBox(w * 0.72, 0.3, d * 0.72, m.cyan, 0, h + 4.4, 0));
      group.add(cylinder(0.25, 0.4, 14, m.steel, 0, h + 12, 0, 8));
      const beacon = sphere(0.5, basic({ color: '#ff3b30' }), 0, h + 19.2, 0, 10);
      group.add(beacon);
      animate(group, (time) => {
        market.update(time);
        beacon.visible = Math.sin(time * 3) > 0.3;
      });
      // Podium entrance with the tower name
      const nameTexture = labelTexture(label, { bg: '#0d1117', fg: '#ffd166', width: 1024, height: 128, font: 'bold 64px Segoe UI, Helvetica, Arial, sans-serif' });
      group.add(facedBox(Math.min(w + 4, 22), 1.6, 0.3, m.darkMetal, basic({ map: nameTexture }), 0, podiumH - 1.6, d / 2 + 4.2));
      group.add(plainBox(8, 3.4, 0.2, material('#1b2836', { roughness: 0.1, metalness: 0.7, emissive: '#ffe2a0', emissiveIntensity: 0.15 }), 0, 1.8, d / 2 + 4.1));
      const caption = textSprite(`${label} - simulated market data`, { width: 18, background: 'rgba(10, 16, 32, 0.8)' });
      caption.position.set(0, h + 26, 0);
      group.add(caption);
    },

    // White-cube gallery (door on +z) with framed generative art and benches
    gallery(group, { w, h, d, label, data }) {
      const m = mats();
      const door = 4.4;
      const t = 0.4;
      group.add(plainBox(w, 0.2, d, material('#ffffff', { map: tiled(concreteTexture('#d9d7d2'), w / 8, d / 8), roughness: 0.25, metalness: 0.05 }), 0, 0.1, 0));
      group.add(box(w, h, t, m.white, 0, h / 2, -d / 2 + t / 2));
      group.add(box(t, h, d, m.white, -w / 2 + t / 2, h / 2, 0));
      group.add(box(t, h, d, m.white, w / 2 - t / 2, h / 2, 0));
      const segment = (w - door) / 2;
      group.add(box(segment, h, t, m.white, -(door / 2 + segment / 2), h / 2, d / 2 - t / 2));
      group.add(box(segment, h, t, m.white, door / 2 + segment / 2, h / 2, d / 2 - t / 2));
      group.add(box(door, h - 3.4, t, m.white, 0, 3.4 + (h - 3.4) / 2, d / 2 - t / 2));
      group.add(box(w, 0.4, d, m.white, 0, h + 0.2, 0));
      group.add(plainBox(w * 0.75, 0.05, 1.4, m.whiteLight, 0, h - 0.03, -d / 4));
      group.add(plainBox(w * 0.75, 0.05, 1.4, m.whiteLight, 0, h - 0.03, d / 4));
      group.add(facedBox(14, 1.3, 0.12, m.white, basic({ map: labelTexture(label, { bg: '#f3f3f0', fg: '#111111', width: 1024, height: 96, font: '300 60px Segoe UI Light, Helvetica, Arial, sans-serif' }) }), 0, h - 1.4, d / 2 + 0.07));
      // Artworks: four on the back wall, two on each side wall
      const seed = data.seed || 1;
      const artists = ['R. Okafor', 'L. Sandvik', 'M. Ferreira', 'A. Kowalczyk', 'J. Tanaka', 'S. Haddad', 'E. Moreau', 'K. Lindqvist'];
      const titles = ['Flow Study', 'Orbit Rings', 'Square Drift', 'Truchet Garden', 'Divided Light', 'Halftone Tide', 'Sine Weave', 'Hex Ledger'];
      const spots = [];
      [-1.5, -0.5, 0.5, 1.5].forEach((k) => spots.push([k * (w / 4.3), -d / 2 + t + 0.06, 0]));
      [-0.25, 0.25].forEach((k) => { spots.push([-w / 2 + t + 0.06, k * d * 1.2, Math.PI / 2]); spots.push([w / 2 - t - 0.06, k * d * 1.2, -Math.PI / 2]); });
      const frameMaterial = material('#1d1b1a', { roughness: 0.5 });
      spots.forEach(([x, z, rotation], index) => {
        const style = (index + seed) % 8;
        const size = index % 3 === 0 ? 3.4 : 2.8;
        const piece = new THREE.Group();
        piece.add(plainBox(size + 0.24, size + 0.24, 0.08, frameMaterial, 0, 0, 0));
        const art = plane(size, size, material('#ffffff', { map: artTexture(seed * 10 + index, style), roughness: 0.85 }), 0, 0, 0.05);
        art.userData.label = `${titles[style]} #${seed * 10 + index}`;
        art.userData.info = `Generative study by ${artists[(index + seed) % artists.length]} (fictional artist), drawn live with canvas code. This piece is in-game art only: it is not an NFT, it is not minted and it cannot be bought or sold.`;
        piece.add(interactive(art, 'inspect', art.userData.label));
        piece.add(plane(0.7, 0.24, basic({ map: labelTexture(`${titles[style]} - ${artists[(index + seed) % artists.length]}`, { bg: '#ffffff', fg: '#333333', width: 512, height: 160, font: '34px Segoe UI, Arial, sans-serif' }) }), size / 2 + 0.6, -size / 2 + 0.3, 0.02));
        piece.position.set(x, 2.6, z);
        piece.rotation.y = rotation;
        group.add(piece);
      });
      // Benches (sit with E) and an optional rotating sculpture
      [-1, 1].forEach((side) => {
        group.add(box(3.2, 0.44, 0.7, m.wood, side * w * 0.18, 0.42, 1.5));
        group.add(seat(side * w * 0.18, 0.66, 1.5, 'Gallery bench', Math.PI));
      });
      if (data.sculpture) {
        group.add(box(1.4, 1, 1.4, m.white, 0, 0.7, -2));
        const knot = mesh(new THREE.TorusKnotGeometry(0.75, 0.22, 96, 12), material('#d4af37', { roughness: 0.2, metalness: 0.95 }), 0, 2.3, -2);
        group.add(knot);
        animate(knot, (time) => { knot.rotation.y = time * 0.4; knot.rotation.x = Math.sin(time * 0.3) * 0.3; });
      }
    },

    // Floating crypto-futurist building on glowing pylons, warp pads between
    // the ground and two levels; optionally a spiral stair tower with glowing steps
    floating(group, { w, label, data }) {
      const m = mats();
      const R = w / 2;
      const lift = data.lift || 14;
      const level2 = lift + 10;
      const hexRing = (radius, tube, materialRing, y) => {
        const ringMesh = noRaycast(mesh(new THREE.TorusGeometry(radius, tube, 6, 6), materialRing, 0, y, 0));
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.rotation.z = Math.PI / 2; // align torus vertices with the hexagonal slabs
        return ringMesh;
      };
      // Ground base, pylons and a fake energy beam
      group.add(cylinder(R * 0.8, R * 0.85, 0.3, m.darkMetal, 0, 0.15, 0, 6));
      group.add(hexRing(R * 0.82, 0.12, m.cyan, 0.32));
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
        group.add(cylinder(0.35, 0.8, lift - 1, glow('#22d3ee', 0.55, { metalness: 0.4, roughness: 0.3 }), Math.sin(angle) * R * 0.55, (lift - 1) / 2 + 0.3, Math.cos(angle) * R * 0.55, 8));
      }
      group.add(noRaycast(mesh(new THREE.CylinderGeometry(3, 4.5, lift - 1.2, 18, 1, true), additive('#22d3ee', 0.07), 0, (lift - 1.2) / 2 + 0.3, 0)));
      // Level 1: hex slab, glowing underside, glass pod with a door, balustrade
      group.add(cylinder(R, R * 0.9, 1, m.white, 0, lift - 0.5, 0, 6));
      const under = noRaycast(mesh(new THREE.CircleGeometry(R * 0.85, 6), m.cyan, 0, lift - 1.02, 0));
      under.rotation.x = Math.PI / 2;
      under.rotation.z = Math.PI / 2;
      group.add(under);
      const podR = R * 0.55;
      const apothem = podR * Math.cos(Math.PI / 6);
      for (let k = 0; k < 6; k++) {
        const theta = Math.PI / 6 + (k * Math.PI) / 3;
        if (k === 0) continue; // the door side
        const panel = plainBox(podR, 4.5, 0.15, m.glass, Math.sin(theta) * apothem, lift + 2.25, Math.cos(theta) * apothem);
        panel.rotation.y = theta;
        group.add(panel);
      }
      group.add(cylinder(podR + 0.4, podR + 0.4, 0.4, m.white, 0, lift + 4.7, 0, 6));
      group.add(hexRing(podR + 0.42, 0.08, m.magenta, lift + 4.5));
      const gap = data.spiral ? 1 : 0;
      const balustrade = mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 1.2, 6, 1, true, gap ? Math.PI / 3 : 0, gap ? (Math.PI * 5) / 3 : Math.PI * 2), m.railGlass, 0, lift + 0.6, 0);
      group.add(balustrade);
      group.add(hexRing(R - 0.2, 0.05, m.steel, lift + 1.22));
      // Lounge inside the pod
      group.add(box(2.6, 0.45, 0.8, m.wood, 0, lift + 0.22, -apothem + 1.2));
      group.add(seat(0, lift + 0.45, -apothem + 1.2, 'Sky lounge', 0));
      const info = new THREE.Group();
      info.add(box(0.5, 1.1, 0.35, m.darkMetal, 0, 0.55, 0));
      const screen = facedBox(1.4, 0.9, 0.08, m.darkMetal, basic({ map: kioskTexture('floating', label, '#a78bfa') }), 0, 1.5, 0.04);
      screen.userData.label = label;
      screen.userData.info = `${label} floats ${lift} m above the valley on three energy pylons. Warp pads (cyan discs) move you between the ground and each level${data.spiral ? '; the Helix stair tower next to it climbs to Level 1 on foot' : ''}. ${IN_GAME_NOTE}`;
      info.add(interactive(screen, 'inspect', label));
      info.position.set(apothem - 1.6, lift, -0.8);
      info.rotation.y = -Math.PI / 2;
      group.add(info);
      // Level 2: smaller slab above, with an abstract rotating sculpture
      const R2 = R * 0.62;
      group.add(cylinder(R2, R2 * 0.85, 0.8, m.white, 0, level2 - 0.4, 0, 6));
      const under2 = noRaycast(mesh(new THREE.CircleGeometry(R2 * 0.8, 6), m.magenta, 0, level2 - 0.82, 0));
      under2.rotation.x = Math.PI / 2;
      group.add(under2);
      group.add(mesh(new THREE.CylinderGeometry(R2 - 0.15, R2 - 0.15, 1.2, 6, 1, true), m.railGlass, 0, level2 + 0.6, 0));
      const sculpture = new THREE.Group();
      sculpture.add(mesh(new THREE.IcosahedronGeometry(2, 0), material('#c0c8d4', { roughness: 0.15, metalness: 0.9, flatShading: true })));
      sculpture.add(noRaycast(mesh(new THREE.IcosahedronGeometry(2.6, 0), new THREE.MeshBasicMaterial({ color: '#22d3ee', wireframe: true }))));
      sculpture.position.set(0, level2 + 5, 0);
      group.add(sculpture);
      animate(sculpture, (time) => { sculpture.rotation.y = time * 0.35; sculpture.rotation.x = time * 0.2; sculpture.position.y = level2 + 5 + Math.sin(time) * 0.4; });
      // Warp pads
      const padMaterial = glow('#22d3ee', 1.3);
      const beamMaterial = additive('#22d3ee', 0.12);
      const pad = (x, y, z, destination, text) => {
        const disc = cylinder(1.3, 1.3, 0.14, padMaterial, x, y + 0.07, z, 24);
        disc.userData.destination = destination;
        group.add(interactive(disc, 'warp', text));
        group.add(noRaycast(mesh(new THREE.CylinderGeometry(1.2, 1.3, 2.6, 20, 1, true), beamMaterial, x, y + 1.4, z)));
      };
      const terrace = (podR + R) / 2 - 0.2;
      pad(0, 0.3, R * 0.5, new THREE.Vector3(0, lift + 0.2, -terrace + 2.4), `Warp pad: up to ${label} Level 1`);
      pad(-2.4, lift, -terrace, new THREE.Vector3(0, 0.5, R * 0.5 + 2.4), 'Warp pad: down to the ground');
      pad(2.4, lift, -terrace, new THREE.Vector3(0, level2 + 0.2, 2.6), `Warp pad: up to ${label} Level 2`);
      pad(0, level2, 0, new THREE.Vector3(0, lift + 0.2, -terrace + 2.4), 'Warp pad: down to Level 1');
      const caption = textSprite(label, { width: 14, background: 'rgba(10, 16, 32, 0.8)' });
      caption.position.set(0, level2 + 11, 0);
      group.add(caption);

      if (data.spiral) {
        // Helix stair tower: 40 instanced steps around a column; a light wave
        // runs up the step edges. Its top step leads onto the Level 1 terrace.
        const towerDistance = R * Math.cos(Math.PI / 6) + 5.6;
        const tx = Math.sin(Math.PI / 6) * towerDistance;
        const tz = Math.cos(Math.PI / 6) * towerDistance;
        const helix = new THREE.Group();
        helix.position.set(tx, 0, tz);
        const steps = 40;
        const rise = lift / steps;
        const turn = (18 * Math.PI) / 180;
        const exitAngle = Math.PI / 6 + Math.PI; // direction from the tower to the platform
        const startAngle = exitAngle - (steps - 1) * turn;
        helix.add(cylinder(1, 1, lift + 4, m.concrete, 0, (lift + 4) / 2, 0, 16));
        const stepMesh = instanced(new THREE.BoxGeometry(1.6, 0.22, 3.4), material('#d6d9dd', { roughness: 0.4, metalness: 0.3 }), steps);
        const edgeMesh = instanced(new THREE.BoxGeometry(0.1, 0.04, 3.4), basic({ color: '#ffffff' }), steps);
        for (let i = 0; i < steps; i++) {
          const angle = startAngle + i * turn;
          const top = rise * (i + 1);
          const rotationY = angle;
          quaternion.setFromEuler(euler.set(0, rotationY, 0));
          matrix.compose(positionVector.set(Math.sin(angle) * 2.75, top - 0.11, Math.cos(angle) * 2.75), quaternion, scaleVector.set(1, 1, 1));
          stepMesh.setMatrixAt(i, matrix);
          const ex = Math.sin(angle) * 2.75 - Math.cos(angle) * 0.72;
          const ez = Math.cos(angle) * 2.75 + Math.sin(angle) * 0.72;
          matrix.compose(positionVector.set(ex, top + 0.01, ez), quaternion, scaleVector.set(1, 1, 1));
          edgeMesh.setMatrixAt(i, matrix);
          edgeMesh.setColorAt(i, tint.set('#22d3ee'));
        }
        edgeMesh.castShadow = false;
        noRaycast(edgeMesh);
        helix.add(stepMesh, edgeMesh);
        let lastWave = 0;
        animate(edgeMesh, (time) => {
          if (time - lastWave < 0.08) return;
          lastWave = time;
          for (let i = 0; i < steps; i++) {
            const wave = Math.max(0, Math.sin(time * 2.5 - i * 0.35));
            edgeMesh.setColorAt(i, tint.setHSL(0.52 + wave * 0.32, 0.9, 0.3 + wave * 0.45));
          }
          edgeMesh.instanceColor.needsUpdate = true;
        });
        // Glass shell with an opening toward the platform (entry at the bottom, exit at the top)
        const opening = (80 * Math.PI) / 180;
        helix.add(mesh(new THREE.CylinderGeometry(4.75, 4.75, lift + 1.4, 24, 1, true, exitAngle + opening / 2, Math.PI * 2 - opening), m.railGlass, 0, (lift + 1.4) / 2, 0));
        const helixRing = noRaycast(mesh(new THREE.TorusGeometry(4.75, 0.12, 6, 24), m.cyan, 0, lift + 1.45, 0));
        helixRing.rotation.x = Math.PI / 2;
        helix.add(helixRing);
        helix.add(cylinder(4.9, 4.9, 0.3, m.darkMetal, 0, 0.15, 0, 24));
        group.add(helix);
        // Short walkway from the top step onto the terrace (through the balustrade gap)
        const walkLength = 4.2;
        const walk = plainBox(2.6, 0.3, walkLength, m.white, 0, lift - 0.15, 0);
        walk.position.set(Math.sin(Math.PI / 6) * (towerDistance - 4.3 + walkLength / 2 - 1.4), lift - 0.15, Math.cos(Math.PI / 6) * (towerDistance - 4.3 + walkLength / 2 - 1.4));
        walk.rotation.y = Math.PI / 6;
        group.add(walk);
        const helixCaption = textSprite('Helix stairs', { width: 8, background: 'rgba(10, 16, 32, 0.8)' });
        helixCaption.position.set(tx, lift + 5, tz);
        group.add(helixCaption);
      }
    },

    // Toy-like construction corner: cranes, excavator, concrete frame with
    // scaffolding, fence, traffic cones, barriers, pipes and a site office
    construction(group, { w, d, label }) {
      const m = mats();
      group.add(plainBox(w, 0.12, d, material('#ffffff', { map: tiled(dirtTexture(), w / 16, d / 16), roughness: 1 }), 0, 0.06, 0));
      // Fence with a gate gap on the +z side (facing the street)
      const fence = (length, x, z, rotation) => {
        const texture = tiled(fenceTexture(), length / 4.4, 1);
        const panel = plane(length, 2.2, material('#ffffff', { map: texture, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }), x, 1.1, z);
        panel.rotation.y = rotation;
        panel.castShadow = false;
        group.add(panel);
      };
      const gate = 10;
      fence(w, 0, -d / 2, 0);
      fence(d, -w / 2, 0, Math.PI / 2);
      fence(d, w / 2, 0, Math.PI / 2);
      fence((w - gate) / 2, -(gate / 2 + (w - gate) / 4), d / 2, 0);
      fence((w - gate) / 2, gate / 2 + (w - gate) / 4, d / 2, 0);
      group.add(facedBox(12, 1.6, 0.1, m.white, basic({ map: labelTexture(`${label}`, { bg: '#ffd400', fg: '#111111', width: 1024, height: 128, font: 'bold 52px Segoe UI, Arial, sans-serif' }) }), -(gate / 2 + (w - gate) / 4), 1.3, d / 2 + 0.08));

      // Unfinished concrete frame (24 x 16, four storeys, top one partial)
      const fx = -12; const fz = -6; const fw = 24; const fd = 16; const storey = 4;
      const slabMaterial = m.concrete;
      for (let level = 0; level < 4; level++) {
        const partial = level === 3;
        group.add(plainBox(partial ? fw / 2 : fw, 0.35, fd, slabMaterial, fx - (partial ? fw / 4 : 0), level * storey + 0.3, fz));
      }
      const columnSpots = [];
      for (let level = 0; level < 4; level++) for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        if (level === 3 && i > 2) continue;
        columnSpots.push([fx - fw / 2 + 0.4 + (i * (fw - 0.8)) / 4, level * storey + 0.45, fz - fd / 2 + 0.4 + (j * (fd - 0.8)) / 2]);
      }
      const columns = instanced(new THREE.BoxGeometry(0.5, storey - 0.35, 0.5).translate(0, (storey - 0.35) / 2, 0), m.darkConcrete, columnSpots.length);
      columnSpots.forEach(([x, y, z], index) => { matrix.makeTranslation(x, y, z); columns.setMatrixAt(index, matrix); });
      group.add(columns);
      const rebar = instanced(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4).translate(0, 0.7, 0), material('#8d4f2a', { roughness: 0.8 }), 12);
      for (let i = 0; i < 12; i++) {
        matrix.makeTranslation(fx + 0.4 + (i % 4) * 0.12 + Math.floor(i / 4) * 5.8 - 0.5, 3 * storey + 0.45, fz - fd / 2 + 0.4 + (i % 3) * 0.1);
        rebar.setMatrixAt(i, matrix);
      }
      rebar.castShadow = false;
      group.add(rebar);
      group.add(box(fw - 1, storey - 0.4, 0.3, material('#a1503a', { roughness: 0.9 }), fx, 0.45 + (storey - 0.4) / 2, fz - fd / 2 + 0.2)); // brick infill, ground floor
      // Scaffolding on the front (+z) facade: tubes and boards (instanced)
      const tubeSpots = [];
      const scaffoldZ = fz + fd / 2 + 0.6;
      const scaffoldH = 14;
      for (let i = 0; i <= 12; i++) for (const row of [0, 1.2]) tubeSpots.push([[fx - fw / 2 + i * 2, scaffoldH / 2, scaffoldZ + row], [0, 0, 0], scaffoldH]);
      for (let level = 1; level <= 7; level++) for (const row of [0, 1.2]) tubeSpots.push([[fx, level * 2, scaffoldZ + row], [0, 0, Math.PI / 2], fw]);
      for (let i = 0; i < 12; i += 2) tubeSpots.push([[fx - fw / 2 + i * 2 + 1, scaffoldH / 2, scaffoldZ + 1.2], [0, 0, Math.atan2(2, scaffoldH) * 1.0 + 0.95], 15]);
      const tubes = instanced(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), m.steel, tubeSpots.length);
      tubeSpots.forEach(([[x, y, z], [rx, ry, rz], length], index) => {
        matrix.compose(positionVector.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, rz)), scaleVector.set(1, length, 1));
        tubes.setMatrixAt(index, matrix);
      });
      tubes.castShadow = false;
      group.add(tubes);
      const boards = instanced(new THREE.BoxGeometry(fw, 0.06, 1.1), m.wood, 4);
      for (let level = 0; level < 4; level++) { matrix.makeTranslation(fx, 2 + level * 4, scaffoldZ + 0.6); boards.setMatrixAt(level, matrix); }
      group.add(boards);
      const net = noRaycast(plane(fw * 0.5, 8, material('#2e7d32', { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }), fx + fw / 4, 10, scaffoldZ + 1.3));
      net.castShadow = false;
      group.add(net);

      // Tower cranes (lattice textures), jibs slowly turning
      const lattice = material('#ffffff', { map: tiled(latticeTexture(), 1, 1), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
      const crane = (x, z, height, jib, phase) => {
        const craneGroup = new THREE.Group();
        craneGroup.position.set(x, 0, z);
        craneGroup.add(box(5, 1, 5, m.darkConcrete, 0, 0.5, 0));
        const mast = plainBox(2, height, 2, lattice, 0, height / 2 + 1, 0);
        mast.geometry.attributes.uv.array.forEach((value, index, array) => { if (index % 2 === 1) array[index] = value * (height / 2); });
        craneGroup.add(mast);
        const top = new THREE.Group();
        top.position.y = height + 1;
        top.add(plainBox(2.8, 1.2, 2.8, m.yellow, 0, 0.6, 0));
        top.add(facedBox(1.8, 2, 2, m.yellow, material('#24323f', { roughness: 0.1, metalness: 0.6 }), 1.6, 1.6, 0.9));
        const jibMesh = plainBox(jib, 1.4, 1.4, lattice, jib / 2 + 1, 2.2, 0);
        jibMesh.geometry.attributes.uv.array.forEach((value, index, array) => { if (index % 2 === 0) array[index] = value * (jib / 1.4); });
        top.add(jibMesh);
        top.add(plainBox(11, 1, 1.4, lattice, -6, 2.2, 0));
        top.add(box(3, 2.6, 1.8, m.darkConcrete, -10, 1.2, 0));
        top.add(plainBox(1.2, 6, 1.2, lattice, 0, 4.4, 0));
        const tie = (tx, length, angle) => {
          const bar = cylinder(0.06, 0.06, length, m.steel, tx / 2, 5.2, 0, 4);
          bar.rotation.z = angle;
          top.add(bar);
        };
        tie(jib * 0.75, Math.hypot(jib * 0.75, 4.6), Math.atan2(jib * 0.75, 4.6));
        tie(-11, Math.hypot(11, 4.6), -Math.atan2(11, 4.6));
        const trolley = new THREE.Group();
        trolley.add(box(1.4, 0.5, 1.6, m.darkMetal, 0, 1.25, 0));
        trolley.add(cylinder(0.04, 0.04, 16, m.darkMetal, 0, -7, 0, 4));
        trolley.add(box(0.8, 1, 0.8, m.yellow, 0, -15.4, 0));
        trolley.add(box(1.8, 0.4, 1.8, material('#c62828'), 0, -16.4, 0)); // a beam in the hook
        top.add(trolley);
        craneGroup.add(top);
        animate(top, (time) => {
          top.rotation.y = phase + time * 0.06;
          trolley.position.x = jib * (0.45 + 0.3 * Math.sin(time * 0.15 + phase));
        });
        group.add(craneGroup);
      };
      crane(-w / 2 + 7, -d / 2 + 7, 34, 26, 0.6);
      crane(w / 2 - 9, -d / 2 + 9, 28, 20, 2.8);

      // Excavator digging next to a dirt pile
      const excavator = new THREE.Group();
      const tread = material('#ffffff', { map: tiled(corrugatedTexture('#2b2b2b'), 2, 1), roughness: 0.9 });
      excavator.add(box(1, 1, 5, tread, -1.4, 0.5, 0));
      excavator.add(box(1, 1, 5, tread, 1.4, 0.5, 0));
      excavator.add(box(2.4, 0.4, 3, m.darkMetal, 0, 1.15, 0));
      const upper = new THREE.Group();
      upper.position.y = 1.35;
      upper.add(box(3, 1.2, 3.6, m.yellow, 0, 0.6, -0.3));
      upper.add(box(3, 1, 1, material('#c99600'), 0, 0.7, -2.4));
      upper.add(facedBox(1.5, 1.7, 1.6, m.yellow, material('#24323f', { roughness: 0.1, metalness: 0.6 }), -0.7, 2, 0.6));
      const boomPivot = new THREE.Group();
      boomPivot.position.set(0.7, 1, 1.4);
      const boom = box(0.6, 0.6, 5, m.yellow, 0, 0, 2.3);
      boomPivot.add(boom);
      const armPivot = new THREE.Group();
      armPivot.position.set(0, 0, 4.6);
      armPivot.add(box(0.45, 0.45, 3.4, m.yellow, 0, 0, 1.6));
      armPivot.add(box(1.3, 0.9, 1, material('#3a3a3a', { metalness: 0.6 }), 0, -0.2, 3.4));
      boomPivot.add(armPivot);
      upper.add(boomPivot);
      excavator.add(upper);
      excavator.position.set(16, 0.12, 6);
      excavator.rotation.y = -2.2;
      group.add(excavator);
      animate(upper, (time) => {
        const cycle = Math.sin(time * 0.6);
        boomPivot.rotation.x = -0.45 + cycle * 0.25;
        armPivot.rotation.x = 0.9 + Math.sin(time * 0.6 + 1) * 0.35;
        upper.rotation.y = Math.sin(time * 0.3) * 0.5;
      });
      group.add(mesh(new THREE.ConeGeometry(4.5, 2.6, 9), material('#7a5a3a', { flatShading: true, roughness: 1 }), 22, 1.4, 12));
      group.add(mesh(new THREE.ConeGeometry(3, 1.8, 8), material('#d9c08f', { flatShading: true, roughness: 1 }), 24, 1, -6));

      // Traffic cones, jersey barriers and stacked pipes (instanced)
      const coneSpots = [];
      for (let i = 0; i < 8; i++) coneSpots.push([-gate / 2 + 1 + i * 1.3 * (gate - 2) / 9, d / 2 + 1.5]);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; coneSpots.push([16 + Math.cos(a) * 7, 6 + Math.sin(a) * 7]); }
      for (let i = 0; i < 6; i++) coneSpots.push([fx - fw / 2 + i * 4.5, fz + fd / 2 + 3.4]);
      const cones = instanced(new THREE.ConeGeometry(0.2, 0.75, 12).translate(0, 0.375, 0), MAT.orange, coneSpots.length);
      const bands = instanced(new THREE.CylinderGeometry(0.115, 0.135, 0.12, 12), material('#f5f5f5', { roughness: 0.4 }), coneSpots.length);
      coneSpots.forEach(([x, z], index) => {
        matrix.makeTranslation(x, 0.12, z); cones.setMatrixAt(index, matrix);
        matrix.makeTranslation(x, 0.12 + 0.42, z); bands.setMatrixAt(index, matrix);
      });
      cones.castShadow = bands.castShadow = false;
      group.add(cones, bands);
      const barriers = instanced(new THREE.BoxGeometry(2, 0.85, 0.55).translate(0, 0.42, 0), material('#e8e6e1', { roughness: 0.8 }), 8);
      for (let i = 0; i < 8; i++) { matrix.makeTranslation(w / 2 - 6, 0.12, -6 + i * 2.1); matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); barriers.setMatrixAt(i, matrix); }
      group.add(barriers);
      const pipes = instanced(new THREE.CylinderGeometry(0.5, 0.5, 6, 14), material('#7f8c8d', { metalness: 0.5, roughness: 0.5 }), 6);
      [[0, 0], [1.05, 0], [2.1, 0], [0.52, 0.9], [1.57, 0.9], [1.05, 1.8]].forEach(([px, py], index) => {
        matrix.compose(positionVector.set(4 + px, 0.62 + py, d / 2 - 6), quaternion.setFromEuler(euler.set(Math.PI / 2, 0, 0)), scaleVector.set(1, 1, 1));
        pipes.setMatrixAt(index, matrix);
      });
      group.add(pipes);
      // Site office container with a sign
      const office = facedBox(7, 2.7, 2.5, material('#ffffff', { map: tiled(corrugatedTexture('#2f6fa3'), 3, 1), roughness: 0.6, metalness: 0.4 }), material('#ffffff', { map: labelTexture('SITE OFFICE', { bg: '#2f6fa3', fg: '#ffffff', width: 512, height: 128, font: 'bold 54px Segoe UI, Arial, sans-serif' }) }), w / 2 - 6, 1.47, d / 2 - 4);
      group.add(office);
      dappPanel(group, { kind: 'construction', title: 'Build Permit Board', info: 'The Meridian Tower is still under construction: cranes, an excavator and scaffolding show the valley is growing. It is a decorative in-game building site.', accent: '#ffd400' }).position.set(gate / 2 + 2.5, 0.12, d / 2 + 2.2);
    },

    // Bridge / boulevard from the north edge of Crypto Valley to Silicon Valley
    // (built toward -z, beyond the World's region, over a decorative canal)
    bridge(group, { w, d, label }) {
      const m = mats();
      const L = d;
      const top = 3.4;
      const segments = [[0, -92, 0.3, 0.3], [-92, -112, 0.3, top], [-112, -168, top, top], [-168, -188, top, 0.3], [-188, -L, 0.3, 0.3]];
      const deckTop = (z) => {
        const s = segments.find(([z0, z1]) => z <= z0 && z >= z1) || segments[segments.length - 1];
        const k = (s[0] - z) / (s[0] - s[1]);
        return s[2] + (s[3] - s[2]) * k;
      };
      const deck = new THREE.Group(); // the walkable part (registered as collidable)
      segments.forEach(([z0, z1, y0, y1], index) => {
        const length = z0 - z1;
        const slope = Math.atan2(y1 - y0, length);
        const thickness = index === 2 ? 0.9 : 0.6;
        const real = length / Math.cos(slope) + 0.6;
        const texture = tiled(paversTexture('#d7d3cb'), w / 4, real / 4);
        const slab = plainBox(w, thickness, real, material('#ffffff', { map: texture, roughness: 0.8 }), 0, (y0 + y1) / 2 - thickness / 2, (z0 + z1) / 2);
        slab.rotation.x = slope;
        deck.add(slab);
        // Glowing inlay lines and (on the raised part) glass railings
        [-1, 1].forEach((side) => {
          const strip = noRaycast(plainBox(0.16, 0.03, real, m.cyan, side * (w / 2 - 1.4), (y0 + y1) / 2 + 0.02, (z0 + z1) / 2));
          strip.rotation.x = slope;
          strip.castShadow = false;
          deck.add(strip);
          if (index >= 1 && index <= 3) {
            const glass = plainBox(0.08, 1.15, real, m.railGlass, side * (w / 2 - 0.15), (y0 + y1) / 2 + 0.58, (z0 + z1) / 2);
            glass.rotation.x = slope;
            deck.add(glass);
            const rail = plainBox(0.14, 0.1, real, m.steel, side * (w / 2 - 0.15), (y0 + y1) / 2 + 1.2, (z0 + z1) / 2);
            rail.rotation.x = slope;
            deck.add(rail);
          }
        });
      });
      group.add(deck);
      // Steel arches over the canal span with instanced hangers
      const spanMid = -140; const chord = 64; const rise = 13;
      const archRadius = (chord * chord / 4 + rise * rise) / (2 * rise);
      const arc = 2 * Math.asin(chord / 2 / archRadius);
      const centerY = top + rise - archRadius;
      const hangerSpots = [];
      [-1, 1].forEach((side) => {
        const holder = new THREE.Group();
        holder.position.set(side * (w / 2 + 0.4), centerY, spanMid);
        holder.rotation.y = Math.PI / 2;
        const arch = mesh(new THREE.TorusGeometry(archRadius, 0.45, 8, 48, arc), material('#e9edf1', { roughness: 0.3, metalness: 0.7 }));
        arch.rotation.z = Math.PI / 2 - arc / 2;
        holder.add(arch);
        group.add(holder);
        group.add(box(1.6, 2, 2.4, m.darkConcrete, side * (w / 2 + 0.4), deckTop(spanMid + chord / 2) - 0.2, spanMid + chord / 2));
        group.add(box(1.6, 2, 2.4, m.darkConcrete, side * (w / 2 + 0.4), deckTop(spanMid - chord / 2) - 0.2, spanMid - chord / 2));
        for (let z = spanMid - 26; z <= spanMid + 26; z += 4) {
          const archY = centerY + Math.sqrt(archRadius * archRadius - (z - spanMid) * (z - spanMid));
          hangerSpots.push([side * (w / 2 + 0.4), deckTop(z), z, archY - deckTop(z)]);
        }
      });
      const hangers = instanced(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, 0.5, 0), m.steel, hangerSpots.length);
      hangerSpots.forEach(([x, y, z, length], index) => { matrix.compose(positionVector.set(x, y, z), quaternion.identity(), scaleVector.set(1, length, 1)); hangers.setMatrixAt(index, matrix); });
      hangers.castShadow = false;
      group.add(hangers);
      group.add(box(w - 2, 3.6, 2.4, m.darkConcrete, 0, top - 0.9 - 1.8, spanMid - 12));
      group.add(box(w - 2, 3.6, 2.4, m.darkConcrete, 0, top - 0.9 - 1.8, spanMid + 12));
      // Decorative canal between the two islands
      const canalWidth = 46; const canalLength = 520;
      const shape = new THREE.Shape();
      const half = canalLength / 2; const r = canalWidth / 2;
      shape.moveTo(-half + r, -r); shape.lineTo(half - r, -r); shape.absarc(half - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(-half + r, r); shape.absarc(-half + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      const waterMap = waterTexture();
      waterMap.repeat.set(1 / 24, 1 / 24);
      const water = noRaycast(mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', map: waterMap, roughness: 0.12, metalness: 0.35 }), 0, -0.2, spanMid));
      water.rotation.x = -Math.PI / 2;
      water.castShadow = false;
      group.add(water);
      animate(water, (time) => { waterMap.offset.set(time * 0.002, time * 0.0035); });
      [-1, 1].forEach((side) => {
        const bank = noRaycast(plainBox(canalLength - canalWidth, 0.35, 1.4, m.concrete, 0, -0.12, spanMid + side * (canalWidth / 2 + 0.5)));
        bank.castShadow = false;
        group.add(bank);
      });
      // Street lamps along the bridge (instanced)
      const lampSpots = [];
      for (let z = -10; z > -L + 4; z -= 16) [-1, 1].forEach((side) => lampSpots.push([side * (w / 2 - 0.6), deckTop(z), z, side > 0 ? -Math.PI / 2 : Math.PI / 2]));
      const poles = instanced(new THREE.CylinderGeometry(0.07, 0.1, 6, 8).translate(0, 3, 0), m.metal, lampSpots.length);
      const heads = instanced(new THREE.BoxGeometry(0.4, 0.12, 1.2).translate(0, 5.95, 0.5), m.warmLight, lampSpots.length);
      lampSpots.forEach(([x, y, z, rotation], index) => {
        matrix.compose(positionVector.set(x, y, z), quaternion.setFromEuler(euler.set(0, rotation, 0)), scaleVector.set(1, 1, 1));
        poles.setMatrixAt(index, matrix); heads.setMatrixAt(index, matrix);
      });
      heads.castShadow = false;
      deck.add(poles, heads);
      // Gateway portals at both ends (front faces Silicon Valley, back faces Crypto Valley)
      const portal = (z, frontText, backText) => {
        const gateGroup = new THREE.Group();
        gateGroup.position.set(0, deckTop(z), z);
        [-1, 1].forEach((side) => {
          gateGroup.add(box(1.4, 9, 1.4, m.darkMetal, side * (w / 2 + 1.2), 4.5, 0));
          gateGroup.add(plainBox(0.2, 8, 0.2, m.cyan, side * (w / 2 + 1.2) - side * 0.72, 4.5, 0));
        });
        const front = basic({ map: labelTexture(frontText, { bg: '#0b1020', fg: '#22d3ee', width: 1024, height: 128, font: 'bold 64px Segoe UI, Helvetica, Arial, sans-serif' }) });
        const back = basic({ map: labelTexture(backText, { bg: '#0b1020', fg: '#ffd166', width: 1024, height: 128, font: 'bold 64px Segoe UI, Helvetica, Arial, sans-serif' }) });
        const header = mesh(roundedBoxGeometry(w + 4, 2.2, 0.8), [m.darkMetal, m.darkMetal, m.darkMetal, m.darkMetal, back, front], 0, 9.6, 0);
        gateGroup.add(header);
        deck.add(gateGroup);
      };
      portal(-8, 'WELCOME TO CRYPTO VALLEY', 'TO SILICON VALLEY');
      portal(-L + 6, `${label || 'VALLEY LINK BRIDGE'} - CRYPTO VALLEY AHEAD`, 'SILICON VALLEY');

      // The bridge reaches outside the World's walkable region, so the deck is
      // registered as a shared collidable once City is ready; the island tree
      // rings of both Worlds are thinned out where they would poke through the
      // bridge or stand in the canal.
      let tries = 0;
      const finish = () => {
        tries++;
        const ready = typeof City !== 'undefined' && City.addCollidable && group.parent && City.districts && City.districts.some((district) => district.world.key === 'valley');
        if (!ready) { if (tries < 240) setTimeout(finish, 500); return; }
        City.addCollidable(deck);
        group.updateMatrixWorld(true);
        const start = group.localToWorld(new THREE.Vector3(0, 0, 4));
        const end = group.localToWorld(new THREE.Vector3(0, 0, -L - 6));
        const canal = group.localToWorld(new THREE.Vector3(0, 0, spanMid));
        const inside = (x, z) => (Math.abs(x - start.x) < w / 2 + 3 && z <= start.z && z >= end.z) ||
          (Math.abs(z - canal.z) < canalWidth / 2 + 2.5 && Math.abs(x - canal.x) < canalLength / 2 + 2);
        const roots = [group.parent, ...City.districts.filter((district) => district.world.key === 'valley').map((district) => district.root)];
        const probe = new THREE.Vector3();
        roots.forEach((root) => root.children.forEach((child) => {
          if (child.userData.blockType || !child.isGroup) return;
          child.children.forEach((node) => {
            if (!node.isInstancedMesh) return;
            node.updateMatrixWorld(true);
            let changed = false;
            for (let i = 0; i < node.count; i++) {
              node.getMatrixAt(i, matrix);
              probe.setFromMatrixPosition(matrix).applyMatrix4(node.matrixWorld);
              if (inside(probe.x, probe.z)) { matrix.makeScale(0, 0, 0); matrix.setPosition(0, -500, 0); node.setMatrixAt(i, matrix); changed = true; }
            }
            if (changed) node.instanceMatrix.needsUpdate = true;
          });
        }));
      };
      setTimeout(finish, 500);
    },

    // Standalone dApp-style kiosk (E opens the info card)
    kiosk(group, { color, label, data }) {
      dappPanel(group, { kind: data.kind || 'plaza', title: label, info: data.info || '', accent: color || '#22d3ee' });
    }
  };

  // Instanced trees with realistic two-tone crowns
  function addTrees(group, spots, seed) {
    const random = seededRandom(seed);
    const trunks = instanced(new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0), material('#5d4037', { roughness: 0.95 }), spots.length);
    const crowns = instanced(new THREE.IcosahedronGeometry(1, 1), material('#ffffff', { flatShading: true, roughness: 0.9 }), spots.length);
    spots.forEach(([x, z], index) => {
      const size = 0.9 + random() * 0.5;
      matrix.compose(positionVector.set(x, 0, z), quaternion.identity(), scaleVector.set(size, size * 3.2, size));
      trunks.setMatrixAt(index, matrix);
      matrix.compose(positionVector.set(x, size * 4.3, z), quaternion.setFromEuler(euler.set(0, random() * 3, 0)), scaleVector.set(size * 2, size * 2.3, size * 2));
      crowns.setMatrixAt(index, matrix);
      crowns.setColorAt(index, tint.setHSL(0.27 + random() * 0.06, 0.45, 0.28 + random() * 0.1));
    });
    group.add(trunks, crowns);
  }

  const rules = [
    [/^cv_streets/, 'streets'],
    [/^cv_plaza/, 'plaza'],
    [/^cv_hq/, 'hq'],
    [/^cv_fin_tower/, 'finTower'],
    [/^cv_gallery/, 'gallery'],
    [/^cv_floating/, 'floating'],
    [/^cv_construction/, 'construction'],
    [/^cv_bridge/, 'bridge'],
    [/^cv_kiosk/, 'kiosk']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, `cryptoValley_${name}`, builders[name]));
})();
