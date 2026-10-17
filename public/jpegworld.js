// ============================================================================
// .JPEG WORLD: A WORLD MADE OF PHOTOGRAPHS (AND THE WORLD BORDER THAT LEADS IN)
// ============================================================================
// A separate World (worlds.json key "jpegworld", region 160 x 160 m) built as a
// photo collage: floors, walls, towers and pixel cubes are covered with real
// photographs instead of drawn colors.
// - Photos: loaded at runtime by the player's browser from jsDelivr (CORS
//   enabled), out of the three.js r128 repository examples. Loading is lazy
//   (only when the camera gets near the World or the player enters the border)
//   and fails gracefully: every surface keeps a plain neutral material until
//   its photo arrives, and stays that way if the CDN is unreachable.
// - Decorative "JPEG artifact" panels (8 x 8 blocky compression drawn on a
//   canvas) and file-name labels ("IMG_0042.jpg") on some blocks.
// - Signs, labels and the DOM overlay: pure white background, plain black
//   system sans-serif text (no gradients, no shadows).
// - Solid: a 4 m thick floor slab and invisible (colorWrite: false, opacity 1)
//   walls around the edges, so the avatar never falls or walks out.
// - Entrance: a Minecraft-style world border (animated blue/purple diagonal
//   stripes) at the north edge of Genesis City (x = 0, z = -953). Walking up to
//   it turns the wall into a giant image-search result card (a monarch
//   butterfly PNG on a transparent checkerboard, "Visit >" button and a very
//   long redirect URL), then teleports the player into .jpeg World. A white
//   EXIT door inside warps back to just south of the border.
// Performance: shared unit geometries, InstancedMesh for the cubes, no lights,
// fewer than 120 meshes in total.
(() => {
  const { material, animate, interactive, canvasTexture } = PropKit.kit;

  const PHOTO_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/';
  // Only files that exist in the three.js r128 examples/textures folder
  const PHOTOS = {
    brick: 'brick_diffuse.jpg',
    wood: 'hardwood2_diffuse.jpg',
    grass: 'terrain/grasslight-big.jpg',
    rock: 'terrain/backgrounddetailed6.jpg',
    water: 'water.jpg',
    checker: 'floors/FloorsCheckerboard_S_Diffuse.jpg',
    crate: 'crate.gif',
    disturb: 'disturb.jpg',
    cloud: 'lava/cloud.png',
    lava: 'lava/lavatile.jpg',
    panorama: '2294472375_24a3b8ef46_o.jpg',
    earth: 'planets/earth_atmos_2048.jpg',
    moon: 'planets/moon_1024.jpg',
    uvgrid: 'uv_grid_opengl.jpg'
  };
  const SIGN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const BORDER = { x: 0, z: -953, width: 40, height: 60, triggerDistance: 3 };
  const RETURN_POINT = new THREE.Vector3(0, 0, -930);
  const FALLBACK_ENTRANCE = new THREE.Vector3(16500, 0, 62);

  // --------------------------------------------------------------------------
  // Photo materials: neutral until the photo loads (lazy, once per file)
  // --------------------------------------------------------------------------
  const photoMaterials = new Map(); // key -> { material, file, repeat }
  let photosRequested = false;
  let photoWarningShown = false;

  function photoMaterial(name, repeatX = 1, repeatY = repeatX, options = {}) {
    const key = `${name}|${repeatX}|${repeatY}|${JSON.stringify(options)}`;
    if (!photoMaterials.has(key)) {
      // Neutral placeholder: a light gray, slightly different per photo so
      // shapes stay readable before (or without) the photos
      const tone = 0.7 + ((name.length * 7 + name.charCodeAt(0)) % 9) * 0.02;
      const result = new THREE.MeshStandardMaterial({ color: new THREE.Color(tone, tone, tone * 1.02), roughness: 0.85, metalness: 0, ...options });
      photoMaterials.set(key, { material: result, file: PHOTOS[name], repeat: [repeatX, repeatY] });
    }
    return photoMaterials.get(key).material;
  }

  function applyPhoto(entry, texture) {
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(entry.repeat[0], entry.repeat[1]);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    entry.material.map = texture;
    entry.material.color.set('#ffffff');
    // The game renders in linear space with filmic tone mapping: a faint
    // self-lit copy of the photo keeps it reading as a bright image
    entry.material.emissive.set('#ffffff');
    entry.material.emissiveMap = texture;
    entry.material.emissiveIntensity = 0.22;
    entry.material.needsUpdate = true;
  }

  function loadPhotos() {
    if (photosRequested) return;
    photosRequested = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const byFile = new Map();
    photoMaterials.forEach((entry) => {
      if (!byFile.has(entry.file)) byFile.set(entry.file, []);
      byFile.get(entry.file).push(entry);
    });
    byFile.forEach((entries, file) => {
      const url = PHOTO_BASE + file;
      console.info(`[jpegworld] loading photo ${url}`);
      try {
        loader.load(url, (texture) => {
          entries.forEach((entry, index) => applyPhoto(entry, index === 0 ? texture : texture.clone()));
        }, undefined, () => {
          if (!photoWarningShown) {
            photoWarningShown = true;
            console.warn('[jpegworld] photo textures could not be loaded; keeping plain materials');
          }
        });
      } catch (error) { /* never break the world over a texture */ }
    });
  }

  // --------------------------------------------------------------------------
  // Canvas helpers: white signs, JPEG artifacts, the image-result card
  // --------------------------------------------------------------------------
  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    String(text).split('\n').forEach((paragraph) => {
      let line = '';
      paragraph.split(' ').forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
      });
      lines.push(line);
    });
    return lines;
  }

  // White sign texture: optional bold title, then plain body text, all black
  function signTexture(title, body, width = 1024, height = 512) {
    return canvasTexture(`jpeg-sign|${title}|${body}|${width}|${height}`, width, height, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let y = h * 0.1;
      if (title) {
        const size = Math.round(h * (body ? 0.17 : 0.4));
        ctx.font = `bold ${size}px ${SIGN_FONT}`;
        if (!body) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(title, w / 2, h / 2); return; }
        ctx.fillText(title, w * 0.06, y);
        y += size * 1.4;
      }
      const size = Math.round(h * 0.075);
      ctx.font = `${size}px ${SIGN_FONT}`;
      wrapLines(ctx, body, w * 0.88).forEach((line) => { ctx.fillText(line, w * 0.06, y); y += size * 1.35; });
    });
  }

  function flatMaterial(texture, options = {}) {
    // toneMapped: false keeps the white really #ffffff on screen
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, ...options });
  }

  // File-name label floating over a block (white box, black text)
  function nameLabel(text, width = 5) {
    const texture = canvasTexture(`jpeg-label|${text}`, 512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.font = `48px ${SIGN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 2);
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, toneMapped: false }));
    sprite.scale.set(width, width * 96 / 512, 1);
    sprite.raycast = () => {};
    return sprite;
  }

  // A photo-ish source scene, then an 8 x 8 block "compression" pass over it
  function artifactTexture(variant) {
    return canvasTexture(`jpeg-artifacts|${variant}`, 512, 384, (ctx, w, h) => {
      const random = seeded(4242 + variant * 97);
      const skies = [['#5d8fd6', '#f2c48d'], ['#2f3f73', '#e9846a'], ['#8fc3e8', '#ffffff'], ['#3b6e4f', '#d8e7a2']][variant % 4];
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      sky.addColorStop(0, skies[0]);
      sky.addColorStop(1, skies[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(w * (0.25 + random() * 0.5), h * 0.3, 34 + random() * 20, 0, Math.PI * 2); ctx.fill();
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['#4f6b3a', '#38502a', '#24361b'][layer];
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.5 + layer * 0.12) + Math.sin(x * 0.012 + layer * 2 + variant) * 30 + random() * 8);
        ctx.lineTo(w, h); ctx.fill();
      }
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(w * 0.62, h * 0.42, 60, 80);
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(w * 0.62 + 12, h * 0.42 + 14, 14, 14);
      // Compression: every 8 x 8 block becomes its average color plus a faint
      // cosine "DCT" ripple; 16 x 16 chroma blocks bleed color; strong
      // quantization makes the steps visible
      const image = ctx.getImageData(0, 0, w, h);
      const data = image.data;
      const q = 28;
      for (let by = 0; by < h; by += 8) {
        for (let bx = 0; bx < w; bx += 8) {
          let r = 0; let g = 0; let b = 0;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = ((by + y) * w + bx + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; }
          r /= 64; g /= 64; b /= 64;
          const fx = 1 + Math.floor(random() * 3);
          const fy = Math.floor(random() * 3);
          const amp = 6 + random() * 16;
          const tint = (Math.floor(bx / 16) + Math.floor(by / 16)) % 3 - 1;
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const i = ((by + y) * w + bx + x) * 4;
              const ripple = Math.cos(((x + 0.5) * fx * Math.PI) / 8) * Math.cos(((y + 0.5) * fy * Math.PI) / 8) * amp;
              data[i] = Math.round((r + ripple + tint * 10) / q) * q;
              data[i + 1] = Math.round((g + ripple) / q) * q;
              data[i + 2] = Math.round((b + ripple - tint * 10) / q) * q;
            }
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      // File strip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h - 44, w, 44);
      ctx.fillStyle = '#000000';
      ctx.font = `26px ${SIGN_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`IMG_00${42 + variant * 17}.jpg   quality: ${3 + variant}%`, 14, h - 22);
    });
  }

  // Deterministic, random-looking chain of redirect numbers
  function redirectUrl() {
    const random = seeded(0x8f3a9c);
    const hex = (digits) => Array.from({ length: digits }, () => Math.floor(random() * 16).toString(16)).join('');
    const parts = [`file:///C:/Users/dev/AppData/Local/Temp/redirect/8f3a9c${hex(10)}...`];
    for (let i = 0; i < 16; i++) {
      const kind = i % 4;
      if (kind === 0) parts.push(`0x7f12${hex(4)}...`);
      else if (kind === 1) parts.push(`hop=${String(Math.floor(random() * 99999)).padStart(5, '0')}`);
      else if (kind === 2) parts.push(`r${hex(12)}`);
      else parts.push(`${Math.floor(random() * 4294967295)}`);
    }
    return `${parts.join('/')}/0x7f12${hex(8)}.jpg`;
  }

  function drawButterfly(ctx, cx, cy, size) {
    // Monarch: orange wings with black veins and border, white dots, black body
    const wing = (side, upper) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(side, 1);
      ctx.beginPath();
      if (upper) {
        ctx.moveTo(size * 0.03, -size * 0.05);
        ctx.bezierCurveTo(size * 0.25, -size * 0.55, size * 0.8, -size * 0.62, size * 0.92, -size * 0.42);
        ctx.bezierCurveTo(size * 0.98, -size * 0.28, size * 0.8, -size * 0.05, size * 0.55, size * 0.04);
        ctx.bezierCurveTo(size * 0.35, size * 0.08, size * 0.12, size * 0.06, size * 0.03, size * 0.02);
      } else {
        ctx.moveTo(size * 0.03, size * 0.02);
        ctx.bezierCurveTo(size * 0.3, size * 0.02, size * 0.68, size * 0.12, size * 0.66, size * 0.38);
        ctx.bezierCurveTo(size * 0.64, size * 0.62, size * 0.32, size * 0.7, size * 0.14, size * 0.52);
        ctx.bezierCurveTo(size * 0.05, size * 0.42, size * 0.02, size * 0.2, size * 0.03, size * 0.02);
      }
      ctx.closePath();
      const fill = ctx.createRadialGradient(size * 0.3, 0, size * 0.05, size * 0.3, 0, size * 0.8);
      fill.addColorStop(0, '#f7a21b');
      fill.addColorStop(1, '#d9590b');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = size * 0.07;
      ctx.strokeStyle = '#111111';
      ctx.stroke();
      ctx.clip();
      // Veins
      ctx.lineWidth = size * 0.018;
      for (let i = 0; i < 6; i++) {
        const angle = upper ? -1.25 + i * 0.25 : 0.15 + i * 0.22;
        ctx.beginPath();
        ctx.moveTo(size * 0.06, 0);
        ctx.quadraticCurveTo(size * 0.35 * Math.cos(angle - 0.15), size * 0.35 * Math.sin(angle - 0.15), size * Math.cos(angle), size * Math.sin(angle));
        ctx.stroke();
      }
      ctx.restore();
      // White dots on the black border
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(side, 1);
      ctx.fillStyle = '#ffffff';
      const dots = upper
        ? [[0.86, -0.42], [0.9, -0.33], [0.84, -0.22], [0.76, -0.12], [0.66, -0.04], [0.7, -0.5], [0.58, -0.54]]
        : [[0.64, 0.32], [0.62, 0.44], [0.54, 0.55], [0.42, 0.62], [0.28, 0.6], [0.18, 0.52]];
      dots.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(size * x, size * y, size * 0.017, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };
    [-1, 1].forEach((side) => { wing(side, false); wing(side, true); });
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.08, size * 0.035, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - size * 0.24, size * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = size * 0.012;
    [-1, 1].forEach((side) => {
      ctx.beginPath(); ctx.moveTo(cx, cy - size * 0.27);
      ctx.quadraticCurveTo(cx + side * size * 0.08, cy - size * 0.45, cx + side * size * 0.14, cy - size * 0.52); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + side * size * 0.14, cy - size * 0.52, size * 0.016, 0, Math.PI * 2); ctx.fill();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The image-search result card (also reused as the DOM overlay picture)
  function cardTexture() {
    return canvasTexture('jpeg-result-card', 1024, 1152, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#202124';
      roundRect(ctx, 0, 0, w, h, 36);
      ctx.fill();
      // Source line
      ctx.fillStyle = '#3c4043';
      ctx.beginPath(); ctx.arc(64, 52, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8eaed';
      ctx.font = `bold 22px ${SIGN_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('P', 64, 53);
      ctx.textAlign = 'left';
      ctx.font = `28px ${SIGN_FONT}`;
      ctx.fillText('pngimages.example', 100, 52);
      ctx.fillStyle = '#9aa0a6';
      ctx.font = `bold 34px ${SIGN_FONT}`;
      ctx.fillText('X', w - 70, 52);
      // Image area: transparent checkerboard + butterfly
      const ix = 40; const iy = 96; const iw = w - 80; const ih = 640;
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, 18);
      ctx.clip();
      for (let y = 0; y < ih; y += 24) for (let x = 0; x < iw; x += 24) {
        ctx.fillStyle = ((x + y) / 24) % 2 ? '#cccccc' : '#ffffff';
        ctx.fillRect(ix + x, iy + y, 24, 24);
      }
      drawButterfly(ctx, ix + iw / 2, iy + ih / 2 + 10, 300);
      ctx.restore();
      // Size badge
      ctx.fillStyle = 'rgba(32, 33, 36, 0.85)';
      roundRect(ctx, ix + 18, iy + ih - 62, 150, 44, 10); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `26px ${SIGN_FONT}`;
      ctx.fillText('740 \u00d7 740', ix + 34, iy + ih - 39);
      // Lens icon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ix + iw - 52, iy + 52, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#202124'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(ix + iw - 56, iy + 48, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ix + iw - 46, iy + 58); ctx.lineTo(ix + iw - 36, iy + 68); ctx.stroke();
      // Title and button
      ctx.fillStyle = '#e8eaed';
      ctx.font = `bold 46px ${SIGN_FONT}`;
      ctx.fillText('PNG Images - Free Download', 48, 800);
      ctx.fillStyle = '#9aa0a6';
      ctx.font = `26px ${SIGN_FONT}`;
      ctx.fillText('Images may be subject to copyright.', 48, 850);
      ctx.fillStyle = '#8ab4f8';
      roundRect(ctx, w - 228, 772, 180, 60, 30); ctx.fill();
      ctx.fillStyle = '#202124';
      ctx.font = `bold 30px ${SIGN_FONT}`;
      ctx.fillText('Visit  >', w - 196, 803);
      // Long redirect URL
      ctx.fillStyle = '#8ab4f8';
      ctx.font = '22px Consolas, "Courier New", monospace';
      const url = redirectUrl();
      const perLine = 74;
      let y = 912;
      for (let i = 0; i < url.length && y < h - 20; i += perLine) { ctx.fillText(url.slice(i, i + perLine), 48, y); y += 32; }
    });
  }

  function stripeTexture() {
    const texture = canvasTexture('jpeg-border-stripes', 256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = -2; i < 6; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(90, 120, 255, 0.85)' : 'rgba(170, 80, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64 + 32, 0); ctx.lineTo(i * 64 + 32 + h, h); ctx.lineTo(i * 64 + h, h);
        ctx.closePath(); ctx.fill();
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(BORDER.width / 4, BORDER.height / 4);
    return texture;
  }

  // --------------------------------------------------------------------------
  // Shared geometries and small builders
  // --------------------------------------------------------------------------
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const invisibleMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const blackMaterial = new THREE.MeshBasicMaterial({ color: '#111111', toneMapped: false });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });

  function solid(geometry, meshMaterial, w, h, d, x, y, z, shadows = true) {
    const result = new THREE.Mesh(geometry, meshMaterial);
    result.scale.set(w, h, d);
    result.position.set(x, y, z);
    result.castShadow = shadows;
    result.receiveShadow = true;
    return result;
  }

  // Collidable but invisible (opacity 1 so the avatar rays count it)
  function invisibleWall(w, h, d, x, y, z) {
    const wall = solid(unitBox, invisibleMaterial, w, h, d, x, y, z, false);
    wall.receiveShadow = false;
    wall.userData.alwaysVisible = true;
    return wall;
  }

  // White sign on two black posts, facing +z
  function whiteSign(group, title, body, x, z, rotationY = 0, w = 6, h = 3) {
    const sign = new THREE.Group();
    const texture = signTexture(title, body, 1024, Math.round(1024 * h / w));
    sign.add(solid(unitBox, blackMaterial, 0.12, 1.4 + h, 0.12, -w / 2 + 0.3, (1.4 + h) / 2, -0.06, false));
    sign.add(solid(unitBox, blackMaterial, 0.12, 1.4 + h, 0.12, w / 2 - 0.3, (1.4 + h) / 2, -0.06, false));
    const panel = solid(unitBox, [whiteMaterial, whiteMaterial, whiteMaterial, whiteMaterial, flatMaterial(texture), whiteMaterial], w, h, 0.08, 0, 1.4 + h / 2, 0, false);
    sign.add(panel);
    sign.position.set(x, 0, z);
    sign.rotation.y = rotationY;
    group.add(sign);
    return sign;
  }

  function addLabel(group, text, width, x, y, z) {
    const label = nameLabel(text, width);
    label.position.set(x, y, z);
    group.add(label);
    return label;
  }

  // Instanced photo cubes: [x, y(bottom), z, w, h, d] per cube
  function photoCubes(group, name, cubes, options = {}) {
    const cubesMesh = new THREE.InstancedMesh(unitBox, photoMaterial(name, 1, 1), cubes.length);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    cubes.forEach(([x, y, z, w, h, d], index) => {
      matrix.compose(new THREE.Vector3(x, y + h / 2, z), rotation, new THREE.Vector3(w, h, d));
      cubesMesh.setMatrixAt(index, matrix);
    });
    cubesMesh.instanceMatrix.needsUpdate = true;
    cubesMesh.castShadow = options.shadows !== false;
    cubesMesh.receiveShadow = true;
    if (options.decorative) cubesMesh.raycast = () => {};
    group.add(cubesMesh);
    return cubesMesh;
  }

  // --------------------------------------------------------------------------
  // The World itself
  // --------------------------------------------------------------------------
  let entranceMarker = null;

  function buildWorld(group, { data }) {
    const half = 80;
    const entrance = data.entrance || [0, 0, 62];

    // Ground: a 4 m thick slab (top at y = 0) covered with a grass photo
    group.add(solid(unitBox, photoMaterial('grass', 16, 16), half * 2, 4, half * 2, 0, -2, 0, false));
    // Plaza (checkerboard photo) and hardwood paths, flush steps under 0.2 m
    group.add(solid(unitBox, photoMaterial('checker', 8, 8), 44, 0.2, 44, 0, 0.1, 0, false));
    group.add(solid(unitBox, photoMaterial('wood', 1, 8), 6, 0.12, 56, 0, 0.06, 49, false));
    group.add(solid(unitBox, photoMaterial('wood', 16, 1), 112, 0.12, 6, 0, 0.06, 0, false));
    // Low photo-brick wall at the edge (visible boundary)
    const brickEdge = photoMaterial('brick', 40, 0.5);
    group.add(solid(unitBox, brickEdge, half * 2, 1.4, 0.8, 0, 0.7, -half + 0.4));
    group.add(solid(unitBox, brickEdge, half * 2, 1.4, 0.8, 0, 0.7, half - 0.4));
    const brickSide = photoMaterial('brick', 0.5, 0.5);
    group.add(solid(unitBox, [brickEdge, brickEdge, brickEdge, brickEdge, brickSide, brickSide], 0.8, 1.4, half * 2 - 1.6, -half + 0.4, 0.7, 0));
    group.add(solid(unitBox, [brickEdge, brickEdge, brickEdge, brickEdge, brickSide, brickSide], 0.8, 1.4, half * 2 - 1.6, half - 0.4, 0.7, 0));
    // Invisible barriers all around (100 m high, 2 m thick)
    group.add(invisibleWall(half * 2 + 4, 100, 2, 0, 50, -half - 1));
    group.add(invisibleWall(half * 2 + 4, 100, 2, 0, 50, half + 1));
    group.add(invisibleWall(2, 100, half * 2 + 4, -half - 1, 50, 0));
    group.add(invisibleWall(2, 100, half * 2 + 4, half + 1, 50, 0));

    // Contact-sheet wall in the plaza: the panorama photo on both faces
    const pano = photoMaterial('panorama', 1, 1);
    const brickTop = photoMaterial('brick', 4, 0.25);
    group.add(solid(unitBox, [brickTop, brickTop, brickTop, brickTop, pano, pano], 30, 9, 1, 0, 4.7, -14));
    addLabel(group, 'IMG_0042.jpg', 6, 0, 10.4, -14);

    // Photo towers at the corners of the plaza
    [['earth', -30, -30, 20], ['moon', 30, -30, 16], ['uvgrid', -30, 30, 13], ['lava', 30, 30, 18]].forEach(([name, x, z, height], index) => {
      group.add(solid(unitBox, photoMaterial(name, 1, 1), 7, height, 7, x, height / 2, z));
      addLabel(group, ['DSC_1187.JPG', 'IMG_2001.jpg', 'uv_grid_final_v2.jpg', 'IMG_0666.jpg'][index], 6, x, height + 1.6, z);
    });

    // Pixel pyramid of crates (1 m steps, climbable)
    const crates = [];
    for (let level = 0; level < 5; level++) {
      const size = 9 - level * 2;
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) crates.push([-52 + i - size / 2 + 0.5, level, -52 + j - size / 2 + 0.5, 1, 1, 1]);
    }
    photoCubes(group, 'crate', crates);
    addLabel(group, 'crate.gif (not even a JPEG)', 7, -52, 7, -52);

    // Water pool photo with a brick rim
    group.add(solid(unitBox, photoMaterial('water', 3, 3), 24, 0.06, 24, 50, 0.03, -50, false));
    const rim = photoMaterial('brick', 8, 0.2);
    [[0, -12.25, 24.5, 0.5], [0, 12.25, 24.5, 0.5], [-12.25, 0, 0.5, 24], [12.25, 0, 0.5, 24]].forEach(([dx, dz, w, d]) => group.add(solid(unitBox, rim, w, 0.5, d, 50 + dx, 0.25, -50 + dz, false)));
    addLabel(group, 'water.jpg', 4, 50, 3, -50);

    // Scattered photo cubes (deterministic), away from paths, plaza and props
    const random = seeded(160);
    const blocked = (x, z, r) => (Math.abs(x) < 25 + r && Math.abs(z) < 25 + r) || (Math.abs(x) < 6 + r) || (Math.abs(z) < 6 + r) ||
      (Math.hypot(x + 52, z + 52) < 10 + r) || (Math.abs(x) < 22 + r && z > 24 - r) || (Math.abs(Math.abs(x) - 44) < 8 + r && Math.abs(z - 10) < 4 + r) || (Math.hypot(x - 50, z + 50) < 16 + r) || Math.abs(x) > 74 - r || Math.abs(z) > 74 - r;
    const cubeSets = { brick: [], rock: [], disturb: [], wood: [], panorama: [], uvgrid: [] };
    const names = Object.keys(cubeSets);
    const labelled = [];
    let tries = 0;
    while (tries++ < 2000 && names.reduce((sum, name) => sum + cubeSets[name].length, 0) < 84) {
      const size = 1 + Math.floor(random() * 4);
      const x = (random() * 2 - 1) * 74;
      const z = (random() * 2 - 1) * 74;
      if (blocked(x, z, size)) continue;
      const name = names[Math.floor(random() * names.length)];
      const tall = random() < 0.25 ? size * 2 : size;
      cubeSets[name].push([x, 0, z, size, tall, size]);
      if (random() < 0.5 && size > 1) cubeSets[name].push([x, tall, z, size * 0.6, size * 0.6, size * 0.6]); // a stacked smaller cube
      if (labelled.length < 8 && size >= 3) labelled.push([x, tall + 1.4, z]);
    }
    names.forEach((name) => photoCubes(group, name, cubeSets[name]));
    labelled.forEach(([x, y, z], index) => addLabel(group, `IMG_${String(1000 + index * 137).padStart(4, '0')}.jpg`, 4, x, y, z));

    // Floating cloud cubes, slowly bobbing (decorative, not collidable)
    const clouds = [];
    for (let i = 0; i < 14; i++) clouds.push([(random() * 2 - 1) * 70, 14 + random() * 10, (random() * 2 - 1) * 70, 4 + random() * 3, 2 + random() * 2, 4 + random() * 3]);
    const cloudMesh = photoCubes(group, 'cloud', clouds, { decorative: true, shadows: false });
    const cloudMatrix = new THREE.Matrix4();
    const cloudRotation = new THREE.Quaternion();
    animate(cloudMesh, (time) => {
      clouds.forEach(([x, y, z, w, h, d], index) => {
        cloudMatrix.compose(new THREE.Vector3(x, y + Math.sin(time * 0.4 + index) * 0.8, z), cloudRotation, new THREE.Vector3(w, h, d));
        cloudMesh.setMatrixAt(index, cloudMatrix);
      });
      cloudMesh.instanceMatrix.needsUpdate = true;
    });

    // Signs at the entrance (white, black text)
    whiteSign(group, '.jpeg World', 'Everything here is a photograph: floors, walls and blocks are real photos from the three.js examples. Gray surfaces are photos that have not loaded yet. The exit door is right behind you.', -9, entrance[2] - 2, 0.35, 7, 3.2);
    whiteSign(group, 'Photo credits', 'Textures: three.js r128 examples (MIT), served by jsDelivr. File names on the blocks are made up.', 9, entrance[2] - 2, -0.35, 6, 2.4);

    // Entrance point (the border teleports here) and the lazy photo loader
    entranceMarker = new THREE.Object3D();
    entranceMarker.position.set(entrance[0], entrance[1], entrance[2]);
    group.add(entranceMarker);
    animate(entranceMarker, () => loadPhotos()); // runs only when the camera is within ~180 m
  }

  // Artifact panel: a big "badly compressed" photo on a white frame
  function buildArtifactPanel(group, { w, h, data }) {
    const texture = artifactTexture(data.variant || 0);
    texture.magFilter = THREE.NearestFilter; // keep the 8 x 8 blocks crisp
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const face = flatMaterial(texture);
    group.add(solid(unitBox, blackMaterial, 0.2, 1.2, 0.2, -w / 2 + 0.6, 0.6, 0, false));
    group.add(solid(unitBox, blackMaterial, 0.2, 1.2, 0.2, w / 2 - 0.6, 0.6, 0, false));
    group.add(solid(unitBox, [whiteMaterial, whiteMaterial, whiteMaterial, whiteMaterial, face, face], w, h, 0.3, 0, 1.2 + h / 2, 0));
  }

  // Exit door: white frame, white door, black EXIT text; E warps back
  function buildExitDoor(group) {
    group.add(solid(unitBox, whiteMaterial, 0.4, 3.4, 0.5, -1.7, 1.7, 0));
    group.add(solid(unitBox, whiteMaterial, 0.4, 3.4, 0.5, 1.7, 1.7, 0));
    group.add(solid(unitBox, [whiteMaterial, whiteMaterial, whiteMaterial, whiteMaterial, flatMaterial(signTexture('EXIT', '', 512, 128)), whiteMaterial], 3.8, 0.9, 0.5, 0, 3.85, 0));
    const door = solid(unitBox, [whiteMaterial, whiteMaterial, whiteMaterial, whiteMaterial, flatMaterial(signTexture('Exit', 'Back to Genesis City (world border)', 512, 768)), whiteMaterial], 3, 3.3, 0.15, 0, 1.65, 0);
    group.add(door);
    const handle = new THREE.Object3D();
    handle.position.set(0, 1, 0.6);
    handle.userData.prompt = 'Press E to exit .jpeg World';
    handle.userData.onInteract = () => {
      leaveWorld();
      return null;
    };
    interactive(handle, 'action', 'Exit .jpeg World');
    group.add(handle);
  }

  function leaveWorld() {
    const target = RETURN_POINT.clone();
    const message = 'Back in Genesis City, just south of the world border.';
    if (typeof flyTo === 'function') flyTo(target, null, message);
    else { avatar.position.copy(target); avatar.velocityY = 0; appendSystemMessage(message); }
  }

  // --------------------------------------------------------------------------
  // The world border at the north edge of Genesis City
  // --------------------------------------------------------------------------
  let overlay = null;
  function showOverlay(texture) {
    try {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,0.55);pointer-events:none;';
        const image = document.createElement('img');
        image.alt = 'PNG Images - Free Download';
        image.style.cssText = 'max-width:min(560px,92vw);max-height:72vh;display:block;';
        const note = document.createElement('div');
        note.style.cssText = `background:#ffffff;color:#000000;font:15px ${SIGN_FONT};padding:10px 16px;max-width:min(560px,92vw);box-sizing:border-box;word-break:break-all;`;
        overlay.append(image, note);
      }
      overlay.firstChild.src = texture.image.toDataURL('image/png');
      overlay.lastChild.textContent = `Opening ${redirectUrl()}`;
      document.body.appendChild(overlay);
    } catch (error) { /* the 3D card is still shown */ }
  }
  function hideOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function enterWorld() {
    const target = entranceMarker ? entranceMarker.getWorldPosition(new THREE.Vector3()) : FALLBACK_ENTRANCE.clone();
    const message = 'You fell through the image search into .jpeg World. Everything here is a photo. The EXIT door is behind you.';
    if (typeof flyTo === 'function') flyTo(target, null, message);
    else { avatar.position.copy(target); avatar.velocityY = 0; appendSystemMessage(message); }
  }

  function buildBorderGate() {
    const gate = new THREE.Group();
    gate.position.set(BORDER.x, 0, BORDER.z);
    gate.userData.jpegBorder = true;
    const stripes = stripeTexture();
    const wallMaterial = new THREE.MeshBasicMaterial({ map: stripes, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const wall = solid(unitPlane, wallMaterial, BORDER.width, BORDER.height, 1, 0, BORDER.height / 2 - 0.3, 0, false);
    wall.receiveShadow = false;
    wall.raycast = () => {};
    gate.add(wall);
    const card = solid(unitPlane, new THREE.MeshBasicMaterial({ map: cardTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }), 36, 40.5, 1, 0, 20.3, 0.2, false);
    card.receiveShadow = false;
    card.raycast = () => {};
    card.visible = false;
    card.userData.alwaysVisible = true;
    gate.add(card);
    whiteSign(gate, 'World border', 'This way to .jpeg World, a world made of photos. Walk into the border to enter.', -25, 14, 0.4, 6, 2.6);

    let state = 'wall';
    let changedAt = 0;
    animate(gate, (time) => {
      stripes.offset.x = (time * 0.25) % 1;
      stripes.offset.y = (time * 0.12) % 1;
      const p = avatar.position;
      const near = Math.abs(p.x - BORDER.x) < BORDER.width / 2 + 1 && Math.abs(p.z - BORDER.z) < BORDER.triggerDistance && p.y < BORDER.height;
      if (state === 'wall') {
        wallMaterial.opacity = 0.45 + Math.sin(time * 2) * 0.1;
        if (near) {
          state = 'card'; changedAt = time;
          card.visible = true; card.scale.set(1, 0.01, 1);
          showOverlay(card.material.map);
          if (typeof Sound !== 'undefined') Sound.play('interact');
          loadPhotos(); // start fetching while the card is shown
        }
      } else if (state === 'card') {
        const t = Math.min(1, (time - changedAt) / 0.4);
        card.scale.set(36, 40.5 * t, 1);
        card.position.y = 20.3 * t;
        wallMaterial.opacity = 0.5 * (1 - t);
        if (time - changedAt > 2) { state = 'gone'; changedAt = time; hideOverlay(); enterWorld(); }
      } else if (time - changedAt > 3 && !near) {
        state = 'wall'; card.visible = false; card.scale.set(36, 40.5, 1);
      }
    });
    scene.add(gate);
    return gate;
  }

  let gateBuilt = false;
  PropKit.registerBuilder(/^jpeg_world$/, 'jpegWorld', buildWorld);
  PropKit.registerBuilder(/^jpeg_artifact_panel$/, 'jpegArtifactPanel', buildArtifactPanel);
  PropKit.registerBuilder(/^jpeg_exit_door$/, 'jpegExitDoor', buildExitDoor);
  // The border lives in Genesis City (world coordinates), so it is added
  // straight to the scene when this block is built
  PropKit.registerBuilder(/^jpeg_border_gate$/, 'jpegBorderGate', () => {
    if (gateBuilt) return;
    gateBuilt = true;
    try { buildBorderGate(); } catch (error) { console.error('[jpegworld] border gate failed', error); }
  });
})();
