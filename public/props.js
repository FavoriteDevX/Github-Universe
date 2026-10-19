// ============================================================================
// PROP KIT: TURNS EVERY MAP BLOCK "type" INTO THE LOW-POLY OBJECT IT DESCRIBES
// ============================================================================
// Each map block keeps its JSON bounding box (position + scale). Instead of a
// plain cube, the block type decides what gets modeled inside that box: a palm
// tree, an arcade cabinet, a Kanban board, a building with windows, etc.
const PropKit = (() => {
  const animatedObjects = [];
  // Objects the avatar can use with E (laptops, seats, coffee machines, arcades...)
  const interactables = [];

  function interactive(object, type, label) {
    object.userData.interactable = { type, label };
    interactables.push(object);
    return object;
  }

  // --------------------------------------------------------------------------
  // Materials, geometry helpers and canvas textures (cached and shared)
  // --------------------------------------------------------------------------
  const materialCache = new Map();
  // A very soft grain on flat-colored surfaces so they read as painted
  // plaster/plastic instead of perfectly flat CG color
  let grainTexture = null;
  function grain() {
    if (!grainTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(128, 128);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = 238 + Math.floor(Math.random() * 17);
        image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      grainTexture = new THREE.CanvasTexture(canvas);
      grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
      grainTexture.repeat.set(3, 3);
    }
    return grainTexture;
  }

  function material(color, options = {}) {
    const key = `${color}|${JSON.stringify(options)}`;
    if (!materialCache.has(key)) {
      const flat = !options.map && !options.transparent && !options.emissive && !options.flatShading;
      materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...(flat ? { map: grain() } : {}), ...options }));
    }
    return materialCache.get(key);
  }

  function glow(color, intensity = 0.9, options = {}) {
    return material(color, { emissive: color, emissiveIntensity: intensity, ...options });
  }

  function shade(color, lightness) {
    const shaded = new THREE.Color(color);
    shaded.offsetHSL(0, 0, lightness);
    return `#${shaded.getHexString()}`;
  }

  function mesh(geometry, meshMaterial, x = 0, y = 0, z = 0) {
    const result = new THREE.Mesh(geometry, meshMaterial);
    result.position.set(x, y, z);
    // Only big things cast shadows: thousands of small shadow casters were the
    // main cost of the shadow pass (each one is drawn a second time)
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    result.castShadow = geometry.boundingSphere.radius > 0.9;
    result.receiveShadow = true;
    return result;
  }

  // Every box in the world has softly rounded edges (Decentraland-like, less
  // "blocky"). The geometry keeps BoxGeometry's 6 material groups and per-face
  // UVs, so textured faces still work; geometries are cached by size.
  // Light version: one bevel band per edge (96 vertices instead of ~300), and
  // small parts (where rounding is invisible) stay plain cached boxes.
  const roundedBoxCache = new Map();
  function roundedBoxGeometry(w, h, d) {
    const minDim = Math.min(w, h, d);
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
    if (roundedBoxCache.has(key)) return roundedBoxCache.get(key);
    if (minDim < 0.25) {
      const plain = new THREE.BoxGeometry(w, h, d);
      roundedBoxCache.set(key, plain);
      return plain;
    }
    const r = Math.min(0.18, Math.max(0.02, minDim * 0.16));
    const geometry = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const half = [w / 2, h / 2, d / 2];
    const v = new THREE.Vector3();
    const inner = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const coords = [position.getX(i), position.getY(i), position.getZ(i)].map((c, axis) => {
        // Remap so the outer segment of each axis becomes the rounded band
        const a = Math.abs(c);
        const mapped = a <= 1 / 6 ? a * 6 * (half[axis] - r) : (half[axis] - r) + (a - 1 / 6) * 3 * r;
        return Math.sign(c) * mapped;
      });
      v.set(coords[0], coords[1], coords[2]);
      inner.set(
        THREE.MathUtils.clamp(v.x, -(half[0] - r), half[0] - r),
        THREE.MathUtils.clamp(v.y, -(half[1] - r), half[1] - r),
        THREE.MathUtils.clamp(v.z, -(half[2] - r), half[2] - r)
      );
      const n = v.clone().sub(inner);
      if (n.lengthSq() < 1e-10) n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
      n.normalize();
      v.copy(inner).addScaledVector(n, r);
      position.setXYZ(i, v.x, v.y, v.z);
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    roundedBoxCache.set(key, geometry);
    return geometry;
  }

  const box = (w, h, d, boxMaterial, x, y, z) => mesh(roundedBoxGeometry(w, h, d), boxMaterial, x, y, z);
  const cylinder = (radiusTop, radiusBottom, h, cylinderMaterial, x, y, z, segments = 16) =>
    mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments), cylinderMaterial, x, y, z);
  const sphere = (radius, sphereMaterial, x, y, z, segments = 12) =>
    mesh(new THREE.SphereGeometry(radius, segments, Math.max(6, segments / 2)), sphereMaterial, x, y, z);

  const textureCache = new Map();
  function canvasTexture(key, width, height, draw) {
    if (textureCache.has(key)) return textureCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    textureCache.set(key, texture);
    return texture;
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function labelTexture(text, { bg = '#ffffff', fg = '#1d1b26', width = 512, height = 160, font = 'bold 46px Segoe UI, Arial, sans-serif', border = null } = {}) {
    return canvasTexture(`label|${text}|${bg}|${fg}|${width}|${height}|${font}|${border}`, width, height, (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, w - 10, h - 10);
      }
      ctx.fillStyle = fg;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapText(ctx, text, w - 40).slice(0, 3);
      const lineHeight = parseInt(font.match(/(\d+)px/)[1], 10) * 1.15;
      lines.forEach((line, index) => {
        ctx.fillText(line, w / 2, h / 2 + (index - (lines.length - 1) / 2) * lineHeight);
      });
    });
  }

  // Glass curtain wall: mullions, spandrel bands, sky reflections, a few lit offices
  // Realistic curtain wall: 4 x 8 windows per tile (same layout as before so
  // every building keeps its proportions). Each window shows depth (ceiling
  // light, floor shadow), blinds or curtains, furniture silhouettes in the lit
  // offices, a sky reflection with cloud streaks, metal mullions, spandrel
  // panels with seams and rain streaks under the sills.
  function windowsTexture(wallColor, litColor = '#ffe9a8') {
    return canvasTexture(`windows|${wallColor}|${litColor}`, 512, 1024, (ctx, w, h) => {
      let seed = wallColor.length * 131 + litColor.length * 17 + 7;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      ctx.fillStyle = wallColor;
      ctx.fillRect(0, 0, w, h);
      // Facade grain
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
      }
      const columns = 4;
      const rows = 8;
      const cw = w / columns;
      const rh = h / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const x = col * cw + 8;
          const y = row * rh + 18;
          const gw = cw - 16;
          const gh = rh - 34;
          const lit = random() < 0.18;
          if (lit) {
            // Lit office: warm ceiling glow fading to the floor, furniture silhouettes
            const room = ctx.createLinearGradient(0, y, 0, y + gh);
            room.addColorStop(0, shade(litColor, 0.08));
            room.addColorStop(0.55, litColor);
            room.addColorStop(1, shade(litColor, -0.35));
            ctx.fillStyle = room;
            ctx.fillRect(x, y, gw, gh);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(x + gw * 0.15, y + 3, gw * 0.7, 3);
            ctx.fillStyle = 'rgba(40, 30, 20, 0.45)';
            ctx.fillRect(x + gw * 0.1, y + gh * 0.68, gw * 0.45, gh * 0.08); // desk
            ctx.fillRect(x + gw * 0.18, y + gh * 0.5, gw * 0.12, gh * 0.18); // monitor
            if (random() < 0.5) { ctx.beginPath(); ctx.arc(x + gw * 0.8, y + gh * 0.7, gw * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + gw * 0.78, y + gh * 0.7, gw * 0.04, gh * 0.3); } // plant
          } else {
            // Dark glass reflecting the sky: a vertical gradient shared by the whole facade
            const sky = ctx.createLinearGradient(0, 0, 0, h);
            sky.addColorStop(0, 'rgba(196, 222, 242, 0.96)');
            sky.addColorStop(0.5, 'rgba(110, 146, 178, 0.96)');
            sky.addColorStop(1, 'rgba(58, 80, 108, 0.96)');
            ctx.fillStyle = sky;
            ctx.fillRect(x, y, gw, gh);
            // Interior depth seen through the glass
            ctx.fillStyle = 'rgba(20, 30, 45, 0.28)';
            ctx.fillRect(x, y + gh * 0.62, gw, gh * 0.38);
            // Cloud streaks in the reflection
            for (let c = 0; c < 2; c++) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
              ctx.beginPath();
              ctx.ellipse(x + random() * gw, y + random() * gh * 0.6, gw * (0.25 + random() * 0.3), 4 + random() * 6, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // Blinds (horizontal slats) or a curtain on some windows
          const cover = random();
          if (cover < 0.25) {
            const depth = gh * (0.2 + random() * 0.5);
            ctx.fillStyle = 'rgba(225, 222, 210, 0.85)';
            ctx.fillRect(x, y, gw, depth);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            for (let k = 4; k < depth; k += 5) ctx.fillRect(x, y + k, gw, 1);
          } else if (cover < 0.35) {
            ctx.fillStyle = 'rgba(240, 236, 225, 0.75)';
            ctx.fillRect(x, y, gw * 0.28, gh);
            ctx.fillRect(x + gw * 0.72, y, gw * 0.28, gh);
          }
          // Diagonal glare
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath(); ctx.moveTo(x, y + gh * 0.55); ctx.lineTo(x + gw * 0.5, y); ctx.lineTo(x + gw * 0.68, y); ctx.lineTo(x, y + gh * 0.8); ctx.fill();
          // Window frame and the vertical split of the pane
          ctx.strokeStyle = 'rgba(30, 34, 40, 0.75)';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, gw, gh);
          ctx.fillStyle = 'rgba(30, 34, 40, 0.6)';
          ctx.fillRect(x + gw / 2 - 1, y, 2, gh);
          // Sill and rain streaks under it
          ctx.fillStyle = shade(wallColor, 0.15);
          ctx.fillRect(x - 3, y + gh + 2, gw + 6, 4);
          for (let k = 0; k < 4; k++) {
            const sx = x + random() * gw;
            const streak = ctx.createLinearGradient(0, y + gh + 6, 0, y + gh + 22);
            streak.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
            streak.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = streak;
            ctx.fillRect(sx, y + gh + 6, 2, 16);
          }
        }
        // Spandrel band between floors, with panel seams
        ctx.fillStyle = shade(wallColor, 0.06);
        ctx.fillRect(0, row * rh, w, 10);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, row * rh + 10, w, 2);
      }
      // Mullions with a metallic highlight
      for (let col = 0; col <= columns; col++) {
        ctx.fillStyle = shade(wallColor, -0.12);
        ctx.fillRect(col * cw - 3, 0, 6, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(col * cw - 3, 0, 1, h);
      }
    });
  }

  // Large stone floor tiles with soft joints and mottled color (no neon grid lines)
  function gridTexture(baseColor, lineColor, cells = 8) {
    return canvasTexture(`grid|${baseColor}|${lineColor}|${cells}`, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      let seed = cells * 97 + baseColor.length;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const size = w / Math.max(2, Math.min(cells, 4));
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          ctx.fillStyle = shade(baseColor, (random() - 0.5) * 0.08);
          ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
          // Mottled stone grain
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(${random() < 0.5 ? '255, 255, 255' : '0, 0, 0'}, ${0.02 + random() * 0.03})`;
            ctx.beginPath();
            ctx.arc(x + random() * size, y + random() * size, 3 + random() * 14, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.strokeStyle = shade(lineColor, -0.05);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      for (let i = 0; i <= w; i += size) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function roadTexture(asphaltColor) {
    return canvasTexture(`road|${asphaltColor}`, 128, 256, (ctx, w, h) => {
      ctx.fillStyle = asphaltColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(w / 2 - 3, 20, 6, 90);
      ctx.fillRect(w / 2 - 3, 148, 6, 90);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, 0, 6, h);
      ctx.fillRect(w - 6, 0, 6, h);
    });
  }

  function repeated(texture, repeatX, repeatY) {
    const copy = texture.clone();
    copy.needsUpdate = true;
    copy.wrapS = THREE.RepeatWrapping;
    copy.wrapT = THREE.RepeatWrapping;
    copy.repeat.set(repeatX, repeatY);
    // Sharp at grazing angles (floors and roads seen from the avatar's height)
    copy.anisotropy = 8;
    return copy;
  }

  function codeScreenTexture(title) {
    return canvasTexture(`code|${title}`, 512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2d2d44';
      ctx.fillRect(0, 0, w, 34);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((dot, index) => {
        ctx.fillStyle = dot;
        ctx.beginPath(); ctx.arc(20 + index * 22, 17, 7, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#c7c7d9';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText(title.slice(0, 40), 90, 23);
      const palette = ['#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c', '#bd93f9', '#ffb86c'];
      for (let line = 0; line < 11; line++) {
        let x = 20 + (line % 4) * 18;
        const tokens = 2 + ((line * 5) % 4);
        for (let token = 0; token < tokens; token++) {
          const width = 30 + ((line * 13 + token * 29) % 70);
          ctx.fillStyle = palette[(line + token) % palette.length];
          ctx.fillRect(x, 52 + line * 24, width, 10);
          x += width + 12;
        }
      }
    });
  }

  function chartScreenTexture(title) {
    return canvasTexture(`chart|${title}`, 512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#101418';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
      ctx.fillText(title, 24, 40);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(30, 70 + i * 40); ctx.lineTo(w - 20, 70 + i * 40); ctx.stroke();
      }
      ctx.strokeStyle = '#4dabf7';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(30, 75); ctx.lineTo(w - 20, h - 30); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      [75, 90, 88, 130, 160, 170, 205, 230, 260].forEach((y, index) => {
        const x = 30 + index * ((w - 50) / 8);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  function arcadeScreenTexture(title, hue) {
    return canvasTexture(`arcade|${title}|${hue}`, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#05040f';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) ctx.strokeRect(20 + i * 10, 40 + i * 10, w - 40 - i * 20, h - 80 - i * 20);
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.moveTo(90, 130); ctx.arc(90, 130, 22, 0.25 * Math.PI, 1.75 * Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(135 + i * 22, 130, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = 'bold 20px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(title.toUpperCase().slice(0, 18), w / 2, 28);
    });
  }

  function artTexture(seed) {
    return canvasTexture(`art|${seed}`, 256, 256, (ctx, w, h) => {
      let state = seed * 9301 + 49297;
      const random = () => { state = (state * 9301 + 49297) % 233280; return state / 233280; };
      ctx.fillStyle = `hsl(${Math.floor(random() * 360)}, 60%, 85%)`;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = `hsla(${Math.floor(random() * 360)}, 75%, 55%, 0.85)`;
        const size = 30 + random() * 90;
        if (random() > 0.5) {
          ctx.beginPath(); ctx.arc(random() * w, random() * h, size / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(random() * w, random() * h, size, size * 0.7);
        }
      }
    });
  }

  function contributionTexture() {
    return canvasTexture('contributions', 512, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, w, h);
      const levels = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
      for (let week = 0; week < 30; week++) {
        for (let day = 0; day < 7; day++) {
          ctx.fillStyle = levels[(week * 7 + day * 3 + (week % 5) * day) % 5];
          ctx.fillRect(14 + week * 16.4, 18 + day * 18.5, 13, 14);
        }
      }
    });
  }

  function stripeTexture(color) {
    return canvasTexture(`stripes|${color}`, 64, 256, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (let i = 0; i < 12; i++) ctx.fillRect((i * 23) % w, i * 21, 4, 40);
    });
  }

  // Hand-painted style textures (cobblestone, brick, wood planks, stucco, roof tiles)
  // Irregular stone pavers in running bond, mottled, with soft grout lines
  function cobbleTexture(base = '#c98b5a') {
    return canvasTexture(`cobble|${base}`, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = shade(base, -0.16);
      ctx.fillRect(0, 0, w, h);
      let seed = 7;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const rowHeight = 64;
      for (let row = 0; row < h / rowHeight; row++) {
        let x = -(row % 2) * 40 - random() * 30;
        while (x < w) {
          const width = 70 + random() * 60;
          const y = row * rowHeight;
          const tone = shade(base, (random() - 0.5) * 0.14);
          const gradient = ctx.createLinearGradient(x, y, x, y + rowHeight);
          gradient.addColorStop(0, shade(tone, 0.05));
          gradient.addColorStop(1, shade(tone, -0.04));
          ctx.fillStyle = gradient;
          const r = 8;
          ctx.beginPath();
          ctx.moveTo(x + 3 + r, y + 3); ctx.lineTo(x + width - 3 - r, y + 3); ctx.quadraticCurveTo(x + width - 3, y + 3, x + width - 3, y + 3 + r);
          ctx.lineTo(x + width - 3, y + rowHeight - 3 - r); ctx.quadraticCurveTo(x + width - 3, y + rowHeight - 3, x + width - 3 - r, y + rowHeight - 3);
          ctx.lineTo(x + 3 + r, y + rowHeight - 3); ctx.quadraticCurveTo(x + 3, y + rowHeight - 3, x + 3, y + rowHeight - 3 - r);
          ctx.lineTo(x + 3, y + 3 + r); ctx.quadraticCurveTo(x + 3, y + 3, x + 3 + r, y + 3);
          ctx.fill();
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = `rgba(${random() < 0.5 ? '255, 255, 255' : '60, 40, 20'}, 0.05)`;
            ctx.beginPath(); ctx.arc(x + random() * width, y + random() * rowHeight, 4 + random() * 10, 0, Math.PI * 2); ctx.fill();
          }
          // Worn bevel: light on the top edge, shadow on the bottom edge
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.fillRect(x + 3 + r, y + 4, width - 6 - r * 2, 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
          ctx.fillRect(x + 3 + r, y + rowHeight - 6, width - 6 - r * 2, 3);
          // Fine grain of the stone
          for (let i = 0; i < 70; i++) {
            ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(x + 4 + random() * (width - 8), y + 4 + random() * (rowHeight - 8), 1 + random() * 2, 1 + random() * 2);
          }
          // An occasional crack
          if (random() < 0.12) {
            ctx.strokeStyle = 'rgba(40, 30, 20, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            let cx = x + 10 + random() * (width - 20);
            let cy = y + 6;
            ctx.moveTo(cx, cy);
            while (cy < y + rowHeight - 8) { cx += (random() - 0.5) * 8; cy += 4 + random() * 6; ctx.lineTo(cx, cy); }
            ctx.stroke();
          }
          x += width;
        }
      }
      // Moss and dirt in some joints
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = random() < 0.4 ? 'rgba(90, 110, 60, 0.18)' : 'rgba(50, 40, 30, 0.12)';
        const row = Math.floor(random() * (h / rowHeight));
        ctx.fillRect(random() * w, row * rowHeight - 1, 6 + random() * 14, 3);
      }
    });
  }

  function brickTexture(base = '#b5533c') {
    return canvasTexture(`brick|${base}`, 512, 512, (ctx, w, h) => {
      let seed = 13;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      // Mortar with sand grain
      ctx.fillStyle = '#cfc2ae';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(random() * w, random() * h, 1, 1);
      }
      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 5; col++) {
          const x = col * 112 + (row % 2) * 56 - 56;
          const y = row * 32 + 3;
          const tone = shade(base, ((row * 3 + col * 7) % 5 - 2) * 0.035 + (random() - 0.5) * 0.04);
          const gradient = ctx.createLinearGradient(x, y, x, y + 26);
          gradient.addColorStop(0, shade(tone, 0.05));
          gradient.addColorStop(1, shade(tone, -0.06));
          ctx.fillStyle = gradient;
          ctx.fillRect(x + 2, y, 104, 26);
          // Pores and chipped corners
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.07)';
            ctx.fillRect(x + 4 + random() * 98, y + 2 + random() * 22, 1 + random() * 2, 1 + random() * 2);
          }
          if (random() < 0.3) { ctx.fillStyle = '#cfc2ae'; ctx.fillRect(x + (random() < 0.5 ? 2 : 100), y, 6, 5); }
        }
      }
    });
  }

  // Wood planks with grain lines, knots, nail heads and varied boards
  function plankTexture(base = '#a8743f') {
    return canvasTexture(`plank|${base}`, 512, 512, (ctx, w, h) => {
      let seed = 17;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const boards = 8;
      const height = h / boards;
      for (let i = 0; i < boards; i++) {
        const y = i * height;
        const tone = shade(base, (random() - 0.5) * 0.12);
        ctx.fillStyle = tone;
        ctx.fillRect(0, y, w, height);
        // Grain: long wavy lines
        for (let g = 0; g < 14; g++) {
          ctx.strokeStyle = random() < 0.5 ? 'rgba(60, 35, 15, 0.12)' : 'rgba(255, 230, 190, 0.08)';
          ctx.lineWidth = 1 + random();
          ctx.beginPath();
          const gy = y + 4 + random() * (height - 8);
          ctx.moveTo(0, gy);
          for (let x = 0; x <= w; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.02 + g) * 2.5);
          ctx.stroke();
        }
        // Knots
        if (random() < 0.5) {
          const kx = random() * w;
          const ky = y + height / 2;
          const knot = ctx.createRadialGradient(kx, ky, 0, kx, ky, 9);
          knot.addColorStop(0, 'rgba(50, 25, 10, 0.55)');
          knot.addColorStop(1, 'rgba(50, 25, 10, 0)');
          ctx.fillStyle = knot;
          ctx.beginPath(); ctx.ellipse(kx, ky, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Board joints (seams) and end cuts with nails
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, y + height - 2, w, 2);
        const cut = ((i * 173) % (w - 60)) + 30;
        ctx.fillRect(cut, y, 2, height - 2);
        ctx.fillStyle = 'rgba(40, 40, 40, 0.6)';
        [[cut - 8, y + 10], [cut - 8, y + height - 14], [cut + 10, y + 10], [cut + 10, y + height - 14]].forEach(([nx, ny]) => { ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2); ctx.fill(); });
      }
    });
  }

  // Plaster with fine sand grain, soft stains and hairline cracks
  function stuccoTexture(base = '#f1e3c8') {
    return canvasTexture(`stucco|${base}`, 512, 512, (ctx, w, h) => {
      let seed = 29;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0, 0, 0, 0.045)' : 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(random() * w, random() * h, 1 + random() * 1.5, 1 + random() * 1.5);
      }
      for (let i = 0; i < 8; i++) {
        const x = random() * w;
        const y = random() * h;
        const r = 50 + random() * 110;
        const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
        stain.addColorStop(0, 'rgba(90, 70, 40, 0.06)');
        stain.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = stain;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.strokeStyle = 'rgba(60, 50, 40, 0.18)';
      ctx.lineWidth = 0.8;
      for (let c = 0; c < 3; c++) {
        let x = random() * w;
        let y = random() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 10; k++) { x += (random() - 0.5) * 16; y += 4 + random() * 8; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    });
  }

  // Clay roof tiles with rounded overlaps, shading and weathering
  function roofTileTexture(base = '#c0392b') {
    return canvasTexture(`rooftile|${base}`, 512, 512, (ctx, w, h) => {
      let seed = 41;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      ctx.fillStyle = shade(base, -0.2);
      ctx.fillRect(0, 0, w, h);
      const size = 64;
      for (let row = 0; row < h / size + 1; row++) {
        for (let col = -1; col < w / size + 1; col++) {
          const x = col * size + (row % 2) * size / 2;
          const y = row * size;
          const tone = shade(base, (random() - 0.5) * 0.12);
          const gradient = ctx.createLinearGradient(x - size / 2, 0, x + size / 2, 0);
          gradient.addColorStop(0, shade(tone, -0.08));
          gradient.addColorStop(0.5, shade(tone, 0.08));
          gradient.addColorStop(1, shade(tone, -0.1));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(x - size / 2 + 2, y);
          ctx.lineTo(x - size / 2 + 2, y + size * 0.7);
          ctx.quadraticCurveTo(x, y + size * 1.02, x + size / 2 - 2, y + size * 0.7);
          ctx.lineTo(x + size / 2 - 2, y);
          ctx.fill();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
          ctx.fillRect(x - size / 2 + 2, y + size * 0.86, size - 4, 3);
          if (random() < 0.15) { ctx.fillStyle = 'rgba(70, 80, 50, 0.25)'; ctx.beginPath(); ctx.arc(x + (random() - 0.5) * 20, y + size * 0.6, 6 + random() * 8, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Realistic trees: one texture atlas (bark | dense foliage | leaf cluster
  // with transparent gaps) and merged tree geometries with UVs into each
  // region. Crowns are an organic leafy core plus crossed "leaf cards" cut
  // out with alphaTest, like trees in real games. One material for all trees.
  // --------------------------------------------------------------------------
  const treeAtlases = new Map();
  const LEAF_PALETTES = {
    green: ['#2f5d23', '#3b7029', '#4a8532', '#5d9a3a', '#6fae46', '#2a4f1f', '#86bf55'],
    blossom: ['#d6336c', '#e64980', '#f06595', '#f783ac', '#faa2c1', '#c2255c', '#fcc2d7'],
    autumn: ['#a33a0b', '#c2410c', '#e8590c', '#f08c00', '#fab005', '#862e0b', '#ffd43b']
  };
  function treeAtlas(variant = 'green') {
    if (treeAtlases.has(variant)) return treeAtlases.get(variant);
    let treeAtlasTexture = null;
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    let seed = 99;
    const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // Bark (0..512): vertical fissures and plates
    ctx.fillStyle = '#5a4331';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const x = random() * 512;
      ctx.strokeStyle = random() < 0.5 ? 'rgba(30, 20, 12, 0.55)' : 'rgba(150, 125, 100, 0.25)';
      ctx.lineWidth = 1 + random() * 4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 4 + (random() - 0.5) * 3, y);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(90, 110, 60, 0.18)';
      ctx.beginPath(); ctx.ellipse(random() * 512, random() * 512, 6 + random() * 18, 3 + random() * 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Leaves are drawn as small pointed ellipses with a midrib
    const leaf = (x, y, size, angle, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.55, 0, 0, size);
      ctx.quadraticCurveTo(-size * 0.55, 0, 0, -size);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 230, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -size * 0.9); ctx.lineTo(0, size * 0.9); ctx.stroke();
      ctx.restore();
    };
    const greens = LEAF_PALETTES[variant] || LEAF_PALETTES.green;
    // Dense foliage (512..1024): fully covered, darker inside, light on top
    ctx.fillStyle = greens[0];
    ctx.fillRect(512, 0, 512, 512);
    for (let i = 0; i < 5200; i++) {
      const y = random() * 512;
      const shadeIndex = Math.min(greens.length - 1, Math.floor(random() * 4 + (1 - y / 512) * 3));
      leaf(512 + random() * 512, y, 5 + random() * 7, random() * Math.PI * 2, greens[shadeIndex]);
    }
    // Leaf cluster cut-out (1024..1536): a few twigs full of leaves, transparent gaps
    ctx.clearRect(1024, 0, 512, 512);
    ctx.save();
    ctx.beginPath(); ctx.rect(1024, 0, 512, 512); ctx.clip();
    for (let cluster = 0; cluster < 9; cluster++) {
      const cx = 1024 + 70 + random() * 372;
      const cy = 70 + random() * 372;
      ctx.strokeStyle = '#4a3726';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1024 + 256, 500); ctx.quadraticCurveTo(cx, cy + 120, cx, cy); ctx.stroke();
      for (let i = 0; i < 160; i++) {
        const angle = random() * Math.PI * 2;
        const distance = Math.pow(random(), 0.7) * 85;
        leaf(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, 7 + random() * 8, angle + Math.PI / 2, greens[Math.floor(random() * greens.length)]);
      }
    }
    ctx.restore();
    treeAtlasTexture = new THREE.CanvasTexture(canvas);
    treeAtlasTexture.encoding = THREE.sRGBEncoding;
    treeAtlasTexture.anisotropy = 4;
    treeAtlases.set(variant, treeAtlasTexture);
    return treeAtlasTexture;
  }

  // variant: 'green' (default), 'blossom' (pink cherry trees) or 'autumn'
  const treeMaterials = new Map();
  function treeMaterial(variant = 'green') {
    if (!treeMaterials.has(variant)) treeMaterials.set(variant, new THREE.MeshStandardMaterial({ map: treeAtlas(variant), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }));
    return treeMaterials.get(variant);
  }

  // Merges parts { geometry, region: 0 bark | 1 foliage | 2 leaf cards, color }
  function mergeTreeParts(parts) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    parts.forEach(({ geometry, region, color }) => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (!flat.attributes.normal) flat.computeVertexNormals();
      positions.push(...flat.attributes.position.array);
      normals.push(...flat.attributes.normal.array);
      const uv = flat.attributes.uv.array;
      for (let i = 0; i < uv.length; i += 2) uvs.push((region + Math.min(0.999, Math.max(0.001, uv[i]))) / 3, uv[i + 1]);
      const tint = new THREE.Color(color || '#ffffff');
      for (let i = 0; i < flat.attributes.position.count; i++) colors.push(tint.r, tint.g, tint.b);
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    merged.computeBoundingSphere();
    return merged;
  }

  // A lumpy, organic crown core (an icosphere pushed in and out)
  function leafyCore(radius, seed) {
    const core = new THREE.IcosahedronGeometry(radius, 1);
    const position = core.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const v = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
      const n = 1 + 0.16 * Math.sin(v.x * 2.1 + seed) * Math.cos(v.y * 1.7 + seed * 2) + 0.08 * Math.sin(v.z * 3.3 + seed);
      v.multiplyScalar(n);
      v.y *= 0.85;
      position.setXYZ(i, v.x, v.y, v.z);
    }
    core.computeVertexNormals();
    return core;
  }

  const treeGeometryCache = new Map();
  // kind: 'broadleaf' (round crown) or 'pine'. Height about 7-9 m at scale 1.
  function realisticTreeGeometry(kind = 'broadleaf') {
    if (treeGeometryCache.has(kind)) return treeGeometryCache.get(kind);
    const parts = [];
    if (kind === 'pine') {
      parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.38, 7.5, 8).translate(0, 3.75, 0), region: 0, color: '#d8cfc6' });
      [[2.9, 3.4, 2.6], [2.4, 3.1, 4.4], [1.9, 2.8, 6.0], [1.3, 2.4, 7.5]].forEach(([radius, height, y], i) => {
        parts.push({ geometry: new THREE.ConeGeometry(radius, height, 10, 1, true).translate(0, y, 0), region: 1, color: i % 2 ? '#a9c9a0' : '#c2dcb6' });
        // Drooping needle cards around each tier
        for (let k = 0; k < 6; k++) {
          const card = new THREE.PlaneGeometry(radius * 1.1, height * 0.8);
          card.rotateX(-0.5);
          card.translate(0, y - height * 0.15, radius * 0.55);
          card.rotateY((k / 6) * Math.PI * 2 + i * 0.4);
          parts.push({ geometry: card, region: 2, color: '#8fb07f' });
        }
      });
    } else {
      parts.push({ geometry: new THREE.CylinderGeometry(0.2, 0.34, 4.2, 8).translate(0, 2.1, 0), region: 0, color: '#ffffff' });
      // Branches reaching into the crown
      [[0.9, 0.6], [-0.8, 2.2], [0.3, 4.1]].forEach(([tilt, turn]) => {
        const branch = new THREE.CylinderGeometry(0.07, 0.13, 2.4, 6).translate(0, 1.2, 0);
        branch.rotateZ(tilt);
        branch.rotateY(turn);
        branch.translate(0, 3.4, 0);
        parts.push({ geometry: branch, region: 0, color: '#ffffff' });
      });
      parts.push({ geometry: leafyCore(2.5, 1.3).translate(0, 5.6, 0), region: 1, color: '#ffffff' });
      parts.push({ geometry: leafyCore(1.6, 2.7).translate(1.3, 6.4, 0.6), region: 1, color: '#e6f2d8' });
      parts.push({ geometry: leafyCore(1.5, 4.1).translate(-1.2, 6.2, -0.8), region: 1, color: '#d6e8c6' });
      // Leaf cards sticking out of the crown (they break the round silhouette)
      for (let k = 0; k < 14; k++) {
        const card = new THREE.PlaneGeometry(2.8, 2.8);
        card.rotateX((k % 3 - 1) * 0.6);
        card.rotateY((k / 14) * Math.PI * 2 * 3);
        const angle = (k / 14) * Math.PI * 2;
        card.translate(Math.cos(angle) * 2.2, 4.8 + (k % 4) * 0.7, Math.sin(angle) * 2.2);
        parts.push({ geometry: card, region: 2, color: '#ffffff' });
      }
    }
    const geometry = mergeTreeParts(parts);
    treeGeometryCache.set(kind, geometry);
    return geometry;
  }

  // A single (non-instanced) realistic tree, scaled to `height` meters
  function realisticTree(kind = 'broadleaf', height = 7, variant = 'green') {
    const tree = new THREE.Mesh(realisticTreeGeometry(kind), treeMaterial(variant));
    tree.scale.setScalar(height / (kind === 'pine' ? 8.8 : 8));
    tree.castShadow = true;
    tree.receiveShadow = true;
    return tree;
  }

  // Box with rounded vertical edges (softer, less "blocky" buildings)
  function roundedSlab(w, h, d, radius, slabMaterial) {
    const r = Math.min(radius, w / 2 - 0.01, d / 2 - 0.01);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 6 });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, h / 2, 0);
    // Planar UVs so tiled textures wrap around the walls
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + position.getZ(i)) / 4, position.getY(i) / 4);
    return mesh(geometry, slabMaterial);
  }

  // Unit-size rounded box (1 x 1 x 1, base at y=0) for instanced buildings.
  // UVs wrap around the perimeter so window textures tile cleanly on every wall.
  let roundedUnitGeometry = null;
  function roundedUnitBox() {
    if (roundedUnitGeometry) return roundedUnitGeometry;
    const r = 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(-0.5 + r, -0.5);
    shape.lineTo(0.5 - r, -0.5);
    shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
    shape.lineTo(0.5, 0.5 - r);
    shape.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
    shape.lineTo(-0.5 + r, 0.5);
    shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
    shape.lineTo(-0.5, -0.5 + r);
    shape.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 4 });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 1, 0);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const angle = Math.atan2(position.getZ(i), position.getX(i));
      uv.setXY(i, (angle / (Math.PI * 2) + 0.5) * 4, position.getY(i));
    }
    geometry.computeVertexNormals();
    roundedUnitGeometry = geometry;
    return geometry;
  }

  // Merges every mesh of a group into one mesh per material (fewer draw calls for big interiors)
  function mergeByMaterial(source) {
    source.updateMatrixWorld(true);
    const buckets = new Map();
    source.traverse((node) => {
      if (!node.isMesh || Array.isArray(node.material)) return;
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.applyMatrix4(node.matrixWorld);
      if (!buckets.has(node.material)) buckets.set(node.material, []);
      buckets.get(node.material).push(geometry);
    });
    const merged = new THREE.Group();
    buckets.forEach((geometries, bucketMaterial) => {
      const attributes = ['position', 'normal', 'uv'];
      const total = geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
      const output = new THREE.BufferGeometry();
      attributes.forEach((name) => {
        const size = name === 'uv' ? 2 : 3;
        const array = new Float32Array(total * size);
        let offset = 0;
        geometries.forEach((geometry) => {
          const attribute = geometry.attributes[name];
          if (attribute) array.set(attribute.array, offset);
          offset += geometry.attributes.position.count * size;
        });
        output.setAttribute(name, new THREE.BufferAttribute(array, size));
      });
      output.computeBoundingSphere();
      merged.add(mesh(output, bucketMaterial));
    });
    return merged;
  }

  // Floating text sprite (district names, pedestal captions, quest markers)
  function textSprite(text, { width = 8, color = '#ffffff', background = 'rgba(17, 15, 26, 0.78)', font = 'bold 44px Segoe UI, Arial, sans-serif' } = {}) {
    const texture = labelTexture(text, { bg: background, fg: color, width: 512, height: 128, font });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(width, width / 4, 1);
    sprite.raycast = () => {}; // Labels never block the 3D cursor
    return sprite;
  }

  // A box whose front face (+z) shows a texture
  function facedBox(w, h, d, bodyMaterial, frontMaterial, x, y, z) {
    const materials = [bodyMaterial, bodyMaterial, bodyMaterial, bodyMaterial, frontMaterial, bodyMaterial];
    return mesh(roundedBoxGeometry(w, h, d), materials, x, y, z);
  }

  // Invisible spot you can sit on (E) for seats drawn as merged or instanced meshes
  function seat(x, y, z, label = 'Seat', rotationY = 0) {
    const spot = new THREE.Object3D();
    spot.position.set(x, y, z);
    spot.rotation.y = rotationY;
    return interactive(spot, 'sit', label);
  }

  function animate(object, update) {
    object.userData.animate = update;
    animatedObjects.push(object);
  }

  // A laptop with a code editor on screen; press E next to it to start working
  function laptop(x, y, z, rotationY = 0) {
    const computer = new THREE.Group();
    computer.add(box(0.7, 0.04, 0.48, material('#b0b7c3', { metalness: 0.7, roughness: 0.3 }), 0, 0.02, 0));
    const lid = new THREE.Group();
    lid.add(box(0.7, 0.46, 0.03, material('#b0b7c3', { metalness: 0.7, roughness: 0.3 }), 0, 0.23, 0));
    lid.add(box(0.64, 0.4, 0.01, new THREE.MeshBasicMaterial({ map: codeScreenTexture('main.js') }), 0, 0.23, 0.02));
    lid.position.z = -0.23;
    lid.rotation.x = -0.25;
    computer.add(lid);
    computer.position.set(x, y, z);
    computer.rotation.y = rotationY;
    return interactive(computer, 'laptop', 'Laptop');
  }

  // --------------------------------------------------------------------------
  // Orientation: props are modeled facing +z, then turned toward the map center
  // --------------------------------------------------------------------------
  function orientation(block, w, d, thinOnly) {
    const [px, , pz] = block.position;
    let axis;
    if (thinOnly) {
      axis = w < d ? 'x' : 'z';
    } else {
      axis = Math.abs(px) > Math.abs(pz) ? 'x' : 'z';
    }
    if (axis === 'z') {
      return { rotationY: pz > 0.01 ? Math.PI : 0, w, d };
    }
    return { rotationY: px > 0.01 ? -Math.PI / 2 : Math.PI / 2, w: d, d: w };
  }

  // --------------------------------------------------------------------------
  // Builders (each receives the block bounding box: w along x, h, d along z)
  // --------------------------------------------------------------------------
  const builders = {
    floor(group, { w, h, d, color, type }) {
      let floorMaterial = material(color, { roughness: 0.9 });
      if (/grid_base|sandbox_land|somnium/.test(type)) {
        const lines = /sandbox/.test(type) ? shade(color, -0.18) : shade(color, 0.12);
        floorMaterial = new THREE.MeshStandardMaterial({ map: repeated(gridTexture(color, lines), w / 8, d / 8), roughness: 0.85 });
      } else if (/aluminum/.test(type)) {
        floorMaterial = material(color, { roughness: 0.3, metalness: 0.6 });
      } else if (/carpet/.test(type)) {
        floorMaterial = new THREE.MeshStandardMaterial({ map: repeated(gridTexture(color, shade(color, 0.06), 4), w / 4, d / 4), roughness: 1 });
      } else if (/office|pavilion|mall|concrete|museum/.test(type)) {
        floorMaterial = new THREE.MeshStandardMaterial({ map: repeated(gridTexture(color, shade(color, -0.06), 2), w / 3, d / 3), roughness: 0.7 });
      } else if (/^floor$/.test(type) && new THREE.Color(color).getHSL({}).l < 0.2) {
        floorMaterial = new THREE.MeshStandardMaterial({ map: repeated(gridTexture(color, shade(color, 0.12), 4), w / 4, d / 4), roughness: 0.8 });
      }
      group.add(box(w, h, d, floorMaterial));
    },

    slab(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { roughness: 0.6 })));
      const railMaterial = material('#9fb4c7', { transparent: true, opacity: 0.45, roughness: 0.1 });
      group.add(box(w, 1, 0.08, railMaterial, 0, h / 2 + 0.5, d / 2));
      group.add(box(0.08, 1, d, railMaterial, w / 2, h / 2 + 0.5, 0));
    },

    balcony(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color)));
      const glass = material('#bcd7ec', { transparent: true, opacity: 0.4, roughness: 0.05 });
      group.add(box(w, 1.1, 0.08, glass, 0, h / 2 + 0.55, d / 2));
      for (let x = -w / 2 + 2; x < w / 2; x += 6) group.add(cylinder(0.25, 0.25, 5.2, material('#ced6e0'), x, -2.6 - h / 2, d / 2 - 0.5));
    },

    road(group, { w, h, d, color, type }) {
      const alongX = w > d;
      const length = alongX ? w : d;
      // Warm paved promenades (Decentraland style) instead of asphalt with lane markings
      const texture = repeated(cobbleTexture('#d9a877'), alongX ? length / 6 : w / 6, alongX ? d / 6 : length / 6);
      const roadMaterial = /walkway/.test(type)
        ? material(color, { roughness: 0.8 })
        : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
      group.add(box(w, h, d, roadMaterial));
      if (/walkway/.test(type)) {
        const edge = glow('#39d353', 0.6);
        group.add(box(alongX ? w : 0.12, 0.05, alongX ? 0.12 : d, edge, alongX ? 0 : -w / 2, h / 2, alongX ? -d / 2 : 0));
        group.add(box(alongX ? w : 0.12, 0.05, alongX ? 0.12 : d, edge, alongX ? 0 : w / 2, h / 2, alongX ? d / 2 : 0));
      }
    },

    water(group, { w, h, d, color }) {
      const water = box(w, h, d, material(color, { transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.2 }));
      water.castShadow = false;
      group.add(water);
      animate(water, (time) => { water.position.y = Math.sin(time * 0.8) * 0.03; });
    },

    waterfall(group, { w, h, d, color }) {
      const texture = repeated(stripeTexture(color), 2, 1);
      const fall = box(w, h, d, new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: 0.25 }));
      group.add(fall);
      const pool = cylinder(w * 0.9, w, 0.4, material(color, { transparent: true, opacity: 0.7 }), 0, -h / 2, 0.6, 20);
      group.add(pool);
      animate(fall, (time) => { texture.offset.y = time * 0.8; });
    },

    floatingIsland(group, { w, h, color }) {
      const radius = w / 2;
      group.add(cylinder(radius, radius * 0.96, h * 0.3, material(color, { roughness: 1 }), 0, h / 2 - h * 0.15, 0, 28));
      group.add(cylinder(radius * 0.96, radius * 0.8, h * 0.5, material('#8d6e63', { roughness: 1 }), 0, h / 2 - h * 0.55, 0, 28));
      const rock = mesh(new THREE.ConeGeometry(radius * 0.8, h * 3.5, 14), material('#6d4c41', { roughness: 1, flatShading: true }), 0, h / 2 - h * 0.8 - h * 1.75, 0);
      rock.rotation.x = Math.PI;
      group.add(rock);
      // Cherry blossom trees and stone lanterns around the temple
      [[-8, -7], [8, -8], [-9, 6], [9, 7], [-4, 9]].forEach(([x, z]) => {
        group.add(cylinder(0.25, 0.35, 2.2, material('#5d4037'), x, h / 2 + 1.1, z, 8));
        group.add(mesh(new THREE.IcosahedronGeometry(1.6, 0), material('#ff9ff3', { flatShading: true }), x, h / 2 + 2.8, z));
      });
    },

    spawnPad(group, { w, h, color }) {
      group.add(cylinder(w / 2, w / 2, h, material('#24212f'), 0, 0, 0, 32));
      group.add(cylinder(w / 2 - 0.3, w / 2 - 0.3, h + 0.04, glow(color, 0.7), 0, 0, 0, 32));
      const ring = mesh(new THREE.TorusGeometry(w / 2 - 0.4, 0.08, 8, 48), glow('#ffffff', 1));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      animate(ring, (time) => { ring.position.y = 0.6 + Math.sin(time * 2) * 0.5; ring.scale.setScalar(0.85 + Math.sin(time * 2) * 0.1); });
    },

    hologram(group, { w, h, color }) {
      const beam = cylinder(w / 2, w / 2, h, glow(color, 1.2, { transparent: true, opacity: 0.55 }), 0, 0, 0, 20);
      beam.castShadow = false;
      group.add(beam);
      group.add(cylinder(w, w * 1.1, 0.4, material('#2c2a38'), 0, -h / 2 + 0.2, 0, 20));
      for (let i = 0; i < 3; i++) {
        const ring = mesh(new THREE.TorusGeometry(w * 1.4 + i * 0.4, 0.06, 8, 40), glow(color, 1.4));
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        animate(ring, (time) => { ring.position.y = -h / 2 + ((time * 1.5 + i * (h / 3)) % h); });
      }
    },

    monolith(group, { w, h, d, color }) {
      const body = box(w, h, d, material(color, { roughness: 0.3, metalness: 0.4 }));
      group.add(body);
      const edge = glow(shade(color, 0.25), 1.2);
      group.add(box(w + 0.06, 0.12, d + 0.06, edge, 0, h / 2 - 0.4, 0));
      group.add(box(w + 0.06, 0.12, d + 0.06, edge, 0, -h / 2 + 0.6, 0));
      group.add(cylinder(w, w * 1.2, 0.5, material('#2c3e50'), 0, -h / 2 - 0.05, 0, 6));
    },

    nftFrame(group, { w, h, d, color, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(box(o.w, h, o.d, material(color)));
      inner.add(facedBox(o.w * 0.8, h * 0.6, 0.06, material('#ffffff'), material('#ffffff', { map: artTexture(7) }), 0, h * 0.05, o.d / 2 + 0.03));
      inner.add(box(o.w * 1.6, 0.4, o.w * 1.2, material('#2d3436'), 0, -h / 2 + 0.2, 0));
      group.add(inner);
    },

    palmTrunk(group, { w, h, color }) {
      for (let i = 0; i < 4; i++) {
        const segment = cylinder(w * 0.42 - i * 0.04, w * 0.5 - i * 0.04, h / 4, material(color, { flatShading: true }), Math.sin(i * 0.4) * 0.25, -h / 2 + h / 8 + (i * h) / 4, 0, 7);
        segment.rotation.z = -0.06 * i;
        group.add(segment);
      }
    },

    palmLeaves(group, { w, h, color }) {
      const leafMaterial = material(color, { flatShading: true, side: THREE.DoubleSide });
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const leaf = mesh(new THREE.ConeGeometry(0.45, w * 0.75, 4), leafMaterial);
        leaf.position.set(Math.cos(angle) * w * 0.3, 0, Math.sin(angle) * w * 0.3);
        leaf.rotation.set(0, -angle, Math.PI / 2 + 0.35);
        leaf.scale.set(1, 1, 0.25);
        group.add(leaf);
      }
      [[0.3, 0], [-0.2, 0.25], [0, -0.3]].forEach(([x, z]) => group.add(sphere(0.22, material('#6d4c41'), x, -h * 0.3, z, 8)));
    },

    beachChair(group, { w, h, d, color }) {
      const frame = material('#ffffff');
      group.add(box(w, 0.12, d * 0.65, material(color), 0, 0, d * 0.15));
      const back = box(w, 0.12, d * 0.4, material(color), 0, 0.35, -d * 0.32);
      back.rotation.x = 0.7;
      group.add(back);
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => group.add(box(0.08, h, 0.08, frame, (sx * w) / 2.3, -h / 4, (sz * d) / 2.6)));
    },

    umbrellaPole(group, { h }) {
      group.add(cylinder(0.08, 0.08, h, material('#ffffff')));
    },

    umbrellaTop(group, { w, h, color }) {
      const canopy = mesh(new THREE.ConeGeometry(w / 2, h, 8, 1, true), material(color, { side: THREE.DoubleSide, flatShading: true }));
      group.add(canopy);
      group.add(sphere(0.12, material('#ffffff'), 0, h / 2, 0, 8));
    },

    poolTable(group, { w, h, d }) {
      const wood = material('#5d3a1a');
      group.add(box(w, h * 0.35, d, wood, 0, h * 0.32, 0));
      group.add(box(w - 0.3, 0.06, d - 0.3, material('#1e8449', { roughness: 1 }), 0, h / 2 + 0.03, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => group.add(box(0.35, h * 0.7, 0.35, wood, (sx * (w - 0.6)) / 2, -h * 0.15, (sz * (d - 0.6)) / 2)));
      const ballColors = ['#ffffff', '#f1c40f', '#2980b9', '#c0392b', '#8e44ad', '#e67e22', '#27ae60', '#111111'];
      ballColors.forEach((ballColor, index) => {
        const row = Math.floor(Math.sqrt(index * 2));
        group.add(sphere(0.11, material(ballColor, { roughness: 0.2 }), (index % 3) * 0.24 - 0.24 + row * 0.05, h / 2 + 0.17, -d * 0.2 + row * 0.22, 10));
      });
      const cue = cylinder(0.03, 0.05, d * 0.7, material('#d7b98e'), 0.6, h / 2 + 0.2, d * 0.15, 6);
      cue.rotation.x = Math.PI / 2;
      group.add(cue);
    },

    poolRails(group, { w, h, d, color }) {
      const rail = material(color);
      group.add(box(w, h, 0.3, rail, 0, 0, d / 2 - 0.15));
      group.add(box(w, h, 0.3, rail, 0, 0, -d / 2 + 0.15));
      group.add(box(0.3, h, d, rail, w / 2 - 0.15, 0, 0));
      group.add(box(0.3, h, d, rail, -w / 2 + 0.15, 0, 0));
      [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
        group.add(cylinder(0.14, 0.14, h + 0.02, material('#111111'), (sx * (w - 0.5)) / 2, 0.01, (sz * (d - 0.5)) / 2, 10)));
    },

    arcadeCabinet(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const body = material(color);
      inner.add(box(o.w, h, o.d * 0.7, body, 0, 0, -o.d * 0.15));
      inner.add(box(o.w, h * 0.45, o.d * 0.3, body, 0, -h * 0.275, o.d * 0.35));
      const panel = box(o.w, 0.12, o.d * 0.35, material('#1e1e2e'), 0, -h * 0.03, o.d * 0.33);
      panel.rotation.x = 0.25;
      inner.add(panel);
      inner.add(cylinder(0.05, 0.05, 0.3, material('#222'), -o.w * 0.2, 0.12 - h * 0.03, o.d * 0.33, 8));
      inner.add(sphere(0.1, material('#e74c3c'), -o.w * 0.2, 0.3 - h * 0.03, o.d * 0.33, 8));
      ['#f1c40f', '#3498db', '#2ecc71'].forEach((buttonColor, index) =>
        inner.add(cylinder(0.07, 0.07, 0.06, glow(buttonColor, 0.6), o.w * (0.05 + index * 0.12), 0.06 - h * 0.03, o.d * 0.33, 10)));
      const screen = box(o.w * 0.8, h * 0.32, 0.05, new THREE.MeshBasicMaterial({ map: arcadeScreenTexture(label || 'arcade', (color.length * 47) % 360) }), 0, h * 0.18, o.d * 0.2 + 0.03);
      inner.add(screen);
      inner.add(facedBox(o.w, h * 0.12, 0.1, body, new THREE.MeshBasicMaterial({ map: labelTexture(label || 'ARCADE', { bg: '#120f24', fg: '#ffe600', border: color }) }), 0, h * 0.44, o.d * 0.2 + 0.05));
      interactive(inner, 'arcade', label || 'Arcade');
      group.add(inner);
    },

    arcadeScreen(group, { w, h, d, color }) {
      group.add(box(w, h, d, glow(color, 0.9)));
    },

    kanban(group, { w, h, d, label, block }) {
      const title = (label || 'Kanban').replace(/^Kanban:\s*/, '');
      const texture = canvasTexture(`kanban|${title}`, 512, 420, (ctx, cw, ch) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 44px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase(), cw / 2, 56);
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(20, 80); ctx.lineTo(cw - 20, 80); ctx.stroke();
        ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.moveTo(cw / 2, 95); ctx.lineTo(cw / 2, ch - 20); ctx.stroke();
      });
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const frame = material('#495057', { metalness: 0.4 });
      inner.add(facedBox(o.w, h * 0.72, o.d, material('#dee2e6'), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 }), 0, h * 0.14, 0));
      inner.add(box(o.w + 0.2, 0.12, o.d + 0.1, frame, 0, h * 0.5, 0));
      inner.add(box(o.w + 0.2, 0.12, o.d + 0.1, frame, 0, -h * 0.22, 0));
      [-1, 1].forEach((side) => {
        inner.add(box(0.12, h, 0.12, frame, (side * (o.w + 0.1)) / 2, 0, 0));
        inner.add(box(0.12, 0.08, 1.2, frame, (side * (o.w + 0.1)) / 2, -h / 2 + 0.04, 0));
      });
      inner.add(box(o.w * 0.6, 0.08, 0.25, frame, 0, -h * 0.25, o.d / 2 + 0.12));
      [['#f03e3e', -0.15], ['#1971c2', 0], ['#2f9e44', 0.15]].forEach(([markerColor, offset]) =>
        inner.add(box(0.08, 0.08, 0.35, material(markerColor), o.w * offset, -h * 0.2, o.d / 2 + 0.15)));
      group.add(inner);
    },

    stickyNote(group, { w, h, d, color, label, block }) {
      const texture = labelTexture(label || '', { bg: color, fg: '#343a40', width: 256, height: 256, font: 'bold 30px Comic Sans MS, Segoe Print, cursive' });
      const o = orientation(block, w, d, true);
      const note = facedBox(o.w, h, o.d, material(color), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
      note.rotation.set(0, o.rotationY, ((label || '').length % 5 - 2) * 0.03);
      group.add(note);
    },

    display(group, { w, h, d, color, label, type, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      let screenTexture;
      if (/burndown/.test(type)) screenTexture = chartScreenTexture(label || 'Burndown');
      else if (/terminal/.test(type)) screenTexture = codeScreenTexture(label || 'Terminal');
      else screenTexture = codeScreenTexture(label || 'Station');
      const bezel = material(/terminal/.test(type) ? '#d0d3d8' : '#1d1d1f', { metalness: 0.5, roughness: 0.3 });
      inner.add(box(o.w, h * 0.85, o.d, bezel, 0, h * 0.075, 0));
      inner.add(box(o.w * 0.94, h * 0.75, 0.04, new THREE.MeshBasicMaterial({ map: screenTexture }), 0, h * 0.08, o.d / 2 + 0.02));
      if (/rgb/.test(type)) {
        const strip = box(o.w * 1.02, 0.06, o.d * 1.05, glow(color, 1.5), 0, -h * 0.35, 0);
        inner.add(strip);
        animate(strip, (time) => { strip.material = glow(`hsl(${Math.floor((time * 60) % 360)}, 90%, 60%)`, 1.5); });
      }
      inner.add(box(o.w * 0.08, h * 0.15, o.d * 0.6, bezel, 0, -h * 0.42, -o.d * 0.2));
      inner.add(box(o.w * 0.35, 0.06, Math.max(o.d * 2, 0.6), bezel, 0, -h / 2 + 0.03, 0));
      group.add(inner);
    },

    signPost(group, { w, h }) {
      group.add(cylinder(w / 2, w / 2, h, material('#dfe6e9', { metalness: 0.5 }), 0, 0, 0, 8));
      group.add(cylinder(w * 1.4, w * 1.6, 0.2, material('#636e72'), 0, -h / 2 + 0.1, 0, 8));
    },

    signBoard(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, true);
      const texture = labelTexture(label || '', { bg: '#14121f', fg: '#ffffff', border: color, font: 'bold 40px Segoe UI, Arial, sans-serif' });
      const face = new THREE.MeshBasicMaterial({ map: texture });
      const board = mesh(new THREE.BoxGeometry(o.w, h, o.d), [material(color), material(color), material(color), material(color), face, face]);
      board.rotation.y = o.rotationY;
      group.add(board);
    },

    desk(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      // Reception style desk: solid front, top slab, monitors and a lit logo strip
      inner.add(box(o.w, h * 0.92, o.d * 0.5, material(color), 0, -h * 0.04, o.d * 0.2));
      inner.add(box(o.w + 0.2, 0.08, o.d, material(shade(color, 0.2), { roughness: 0.3 }), 0, h / 2, 0));
      inner.add(box(o.w * 0.9, 0.12, 0.04, glow('#39d353', 1), 0, h * 0.15, o.d * 0.45 + 0.02));
      [-0.25, 0.25].forEach((offset) => {
        inner.add(box(0.9, 0.55, 0.06, material('#111'), o.w * offset, h / 2 + 0.4, -o.d * 0.15));
        { const added = box(0.84, 0.48, 0.02, new THREE.MeshBasicMaterial({ map: codeScreenTexture(label || 'Desk') }), o.w * offset, h / 2 + 0.4, -o.d * 0.15 - 0.04); added.rotation.y = Math.PI; inner.add(added); }
        inner.add(box(0.08, 0.2, 0.08, material('#111'), o.w * offset, h / 2 + 0.1, -o.d * 0.15));
      });
      inner.add(laptop(o.w * 0.35, h / 2 + 0.04, o.d * 0.05, Math.PI));
      group.add(inner);
    },

    battlestation(group, { w, h, d, color }) {
      group.add(box(w, 0.12, d, material(color), 0, h / 2 - 0.06, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => group.add(box(0.12, h - 0.12, 0.12, material('#111'), (sx * (w - 0.3)) / 2, -0.06, (sz * (d - 0.3)) / 2)));
      group.add(box(0.8, 0.05, 0.3, material('#222'), 0, h / 2 + 0.03, d * 0.15));
      group.add(laptop(-w * 0.3, h / 2, d * 0.1, 0.3));
      const chair = new THREE.Group();
      chair.add(box(0.8, 0.12, 0.8, material('#e84118'), 0, 0, 0));
      chair.add(box(0.8, 1.2, 0.12, material('#e84118'), 0, 0.6, 0.4));
      chair.add(cylinder(0.06, 0.06, 0.6, material('#222'), 0, -0.3, 0, 8));
      chair.position.set(0, -h / 2 + 0.6, d * 0.8);
      group.add(chair);
    },

    table(group, { w, h, d, color }) {
      const top = material(color, { roughness: 0.4 });
      group.add(box(w, Math.min(0.15, h), d, top, 0, h / 2 - 0.07, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => group.add(box(0.15, h, 0.15, material('#2d3436'), (sx * (w - 0.4)) / 2, -0.07, (sz * (d - 0.4)) / 2)));
      // Chairs around the long sides
      const chairMaterial = material('#2d3436');
      const along = w > d ? 'x' : 'z';
      const length = Math.max(w, d);
      const count = Math.max(2, Math.floor(length / 1.6));
      for (let i = 0; i < count; i++) {
        const t = -length / 2 + (length / count) * (i + 0.5);
        [-1, 1].forEach((side) => {
          const seat = box(0.7, 0.1, 0.7, chairMaterial);
          const offset = (along === 'x' ? d : w) / 2 + 0.6;
          if (along === 'x') seat.position.set(t, -h * 0.1, side * offset); else seat.position.set(side * offset, -h * 0.1, t);
          group.add(interactive(seat, 'sit', 'Chair'));
          // A laptop in front of every other seat, ready for simulated work
          if ((i + (side > 0 ? 1 : 0)) % 2 === 0) {
            const inset = (along === 'x' ? d : w) / 2 - 0.45;
            const facing = along === 'x' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
            group.add(along === 'x' ? laptop(t, h / 2, side * inset, facing) : laptop(side * inset, h / 2, t, facing));
          }
        });
      }
    },

    counter(group, { w, h, d, color }) {
      group.add(box(w, h - 0.1, d, material('#dcdde1'), 0, -0.05, 0));
      group.add(box(w + 0.1, 0.1, d + 0.1, material(color, { roughness: 0.2 }), 0, h / 2 - 0.05, 0));
      group.add(interactive(box(0.3, 0.35, 0.3, material('#57606f', { metalness: 0.6 }), 0, h / 2 + 0.17, -d * 0.3), 'coffee', 'Coffee machine'));
      group.add(cylinder(0.12, 0.1, 0.3, material('#e84118'), 0, h / 2 + 0.15, d * 0.2, 10));
    },

    sofa(group, { w, h, d, color, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const fabric = material(color, { roughness: 1 });
      inner.add(box(o.w, h * 0.45, o.d, fabric, 0, -h * 0.27, 0));
      inner.add(box(o.w, h * 0.9, o.d * 0.25, fabric, 0, -h * 0.05, -o.d * 0.38));
      [-1, 1].forEach((side) => inner.add(box(o.d * 0.2, h * 0.65, o.d, fabric, (side * (o.w - o.d * 0.2)) / 2, -h * 0.17, 0)));
      for (let i = 0; i < 3; i++) inner.add(interactive(box(o.w * 0.28, h * 0.15, o.d * 0.6, material(shade(color, 0.08), { roughness: 1 }), -o.w * 0.3 + i * o.w * 0.3, h * 0.03, o.d * 0.05), 'sit', 'Sofa'));
      group.add(inner);
    },

    stairStep(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color)));
      group.add(box(w, 0.06, 0.2, material(shade(color, 0.2)), 0, h / 2, d / 2 - 0.1));
    },

    escalator(group, { w, h, d, color }) {
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const stepHeight = (h / steps) * (i + 1);
        group.add(box(w * 0.7, stepHeight, d / steps, material('#a4b0be', { metalness: 0.5 }), 0, -h / 2 + stepHeight / 2, d / 2 - (d / steps) * (i + 0.5)));
      }
      [-1, 1].forEach((side) => {
        const rail = box(0.25, 0.9, Math.hypot(d, h), material(color, { metalness: 0.4 }), (side * w) / 2.3, 0.4, 0);
        rail.rotation.x = Math.atan2(h, d);
        group.add(rail);
      });
    },

    wall(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color)));
      const alongX = w > d;
      const glassMaterial = material('#a8d8ff', { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3 });
      const length = alongX ? w : d;
      for (let t = -length / 2 + 3; t < length / 2 - 2; t += 4) {
        const pane = box(alongX ? 2.6 : w + 0.04, h * 0.3, alongX ? d + 0.04 : 2.6, glassMaterial, alongX ? t : 0, h * 0.12, alongX ? 0 : t);
        pane.castShadow = false;
        group.add(pane);
      }
      group.add(box(alongX ? w : w + 0.1, 0.3, alongX ? d + 0.1 : d, material(shade(color, 0.15)), 0, h / 2 - 0.15, 0));
    },

    glassFacade(group, { w, h, d, color }) {
      const glass = box(w * 0.6, h, d * 0.98, material('#d6eaf8', { transparent: true, opacity: 0.35, roughness: 0.02, metalness: 0.6 }));
      glass.castShadow = false;
      group.add(glass);
      const frame = material(color, { metalness: 0.8, roughness: 0.25 });
      for (let t = -d / 2; t <= d / 2 + 0.01; t += d / 4) group.add(box(w, h, 0.15, frame, 0, 0, t));
      group.add(box(w, 0.2, d, frame, 0, h / 2, 0));
    },

    gate(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const stone = material(color);
      inner.add(box(o.w * 0.18, h, o.d, stone, -o.w * 0.41, 0, 0));
      inner.add(box(o.w * 0.18, h, o.d, stone, o.w * 0.41, 0, 0));
      inner.add(box(o.w, h * 0.2, o.d * 1.2, stone, 0, h * 0.4, 0));
      const sign = new THREE.MeshBasicMaterial({ map: labelTexture(label || 'GENESIS PLAZA', { bg: '#14121f', fg: '#4dabf7', font: 'bold 54px Segoe UI, Arial, sans-serif' }) });
      inner.add(facedBox(o.w * 0.6, h * 0.12, 0.1, stone, sign, 0, h * 0.4, o.d * 0.6 + 0.05));
      inner.add(box(o.w * 0.64, 0.08, 0.08, glow('#1877f2', 1.4), 0, h * 0.3, o.d * 0.6 + 0.05));
      group.add(inner);
    },

    neonPillar(group, { w, h, color }) {
      group.add(cylinder(w * 0.45, w * 0.5, h, material('#1a1a2e', { metalness: 0.6 }), 0, 0, 0, 8));
      for (let i = 0; i < 4; i++) {
        const ring = cylinder(w * 0.55, w * 0.55, 0.15, glow(color, 1.8), 0, -h / 2 + (i + 0.5) * (h / 4), 0, 8);
        group.add(ring);
        animate(ring, (time) => { ring.material = glow(color, 1.2 + Math.sin(time * 4 + i) * 0.8); });
      }
      group.add(cylinder(w * 0.7, w * 0.7, 0.3, glow(color, 1.5), 0, h / 2, 0, 8));
    },

    serverRack(group, { w, h, d, color }) {
      const units = 3;
      for (let i = 0; i < units; i++) {
        const rackWidth = w / units - 0.15;
        const x = -w / 2 + (i + 0.5) * (w / units);
        group.add(box(rackWidth, h, d, material('#0b0b14', { metalness: 0.6 })));
        group.children[group.children.length - 1].position.x = x;
        group.add(box(rackWidth * 0.9, h * 0.92, 0.05, material(color, { metalness: 0.3 }), x, 0, d / 2 + 0.02));
        for (let led = 0; led < 10; led++) {
          const light = box(0.12, 0.06, 0.05, glow(led % 3 ? '#00ffcc' : '#ff007f', 1.5), x - rackWidth * 0.3, -h / 2 + 0.3 + led * (h / 11), d / 2 + 0.06);
          group.add(light);
          animate(light, (time) => { light.visible = Math.sin(time * (3 + led) + i * 2) > -0.3; });
        }
      }
    },

    castleTower(group, { w, h, d, color }) {
      const stone = material(color, { flatShading: true });
      group.add(box(w, h, d, stone));
      const merlonSize = w / 5;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if ((i === 0 || i === 4 || j === 0 || j === 4) && (i + j) % 2 === 0) {
            group.add(box(merlonSize, merlonSize, merlonSize, stone, -w / 2 + merlonSize * (i + 0.5), h / 2 + merlonSize / 2, -d / 2 + merlonSize * (j + 0.5)));
          }
        }
      }
      const flagPole = cylinder(0.08, 0.08, 4, material('#ddd'), 0, h / 2 + 2, 0, 6);
      group.add(flagPole);
      const flag = box(1.6, 1, 0.05, glow('#00d2ff', 0.6), 0.8, h / 2 + 3.4, 0);
      group.add(flag);
      animate(flag, (time) => { flag.rotation.y = Math.sin(time * 2) * 0.3; });
      for (let y = -h / 2 + 2; y < h / 2 - 1; y += 3) group.add(box(0.8, 1.2, 0.1, glow('#f9ca24', 0.8), 0, y, d / 2 + 0.05));
    },

    bridge(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { flatShading: true })));
      const railMaterial = material(shade(color, -0.15));
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 1.5) {
        group.add(box(0.2, 1, 0.2, railMaterial, x, h / 2 + 0.5, d / 2 - 0.1));
        group.add(box(0.2, 1, 0.2, railMaterial, x, h / 2 + 0.5, -d / 2 + 0.1));
      }
      group.add(box(w, 0.15, 0.15, railMaterial, 0, h / 2 + 1, d / 2 - 0.1));
      group.add(box(w, 0.15, 0.15, railMaterial, 0, h / 2 + 1, -d / 2 + 0.1));
    },

    pedestal(group, { w, h, d, color, label }) {
      group.add(box(w, h * 0.9, d, material('#21262d', { roughness: 0.4 }), 0, -h * 0.05, 0));
      group.add(box(w * 1.05, h * 0.1, d * 1.05, glow(color, 0.8), 0, h * 0.45, 0));
      // Floating repository artifact: a file / folder / branch token spinning above the pedestal
      const isFolder = /\/$/.test(label || '');
      const isBranch = /^(feature|fix)\//.test(label || '');
      let artifact;
      if (isBranch) {
        artifact = new THREE.Group();
        artifact.add(cylinder(0.12, 0.12, 1.6, glow(color, 0.9), 0, 0, 0, 8));
        artifact.add(sphere(0.3, glow(color, 0.9), 0, 0.8, 0));
        artifact.add(sphere(0.3, glow(color, 0.9), 0, -0.8, 0));
        const branch = cylinder(0.1, 0.1, 0.9, glow(color, 0.9), 0.35, 0.2, 0, 8);
        branch.rotation.z = -0.8;
        artifact.add(branch);
        artifact.add(sphere(0.25, glow('#ffffff', 0.6), 0.7, 0.55, 0));
      } else if (isFolder) {
        artifact = box(1.4, 1, 0.3, glow(color, 0.7));
      } else {
        artifact = facedBox(1, 1.3, 0.15, glow(color, 0.5), new THREE.MeshBasicMaterial({ map: codeScreenTexture(label || 'file') }));
      }
      artifact.position.y = h / 2 + 1.4;
      group.add(artifact);
      animate(artifact, (time) => { artifact.rotation.y = time * 0.8; artifact.position.y = h / 2 + 1.4 + Math.sin(time * 2) * 0.15; });
      const caption = textSprite(label || '', { width: 4.5, color: '#ffffff', background: 'rgba(13, 17, 23, 0.85)', font: 'bold 40px Consolas, monospace' });
      caption.position.y = h / 2 + 3;
      group.add(caption);
    },

    commitWall(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(box(o.w, h, o.d, material(color)));
      inner.add(box(o.w * 0.94, h * 0.55, 0.05, new THREE.MeshBasicMaterial({ map: contributionTexture() }), 0, -h * 0.05, o.d / 2 + 0.03));
      inner.add(facedBox(o.w * 0.94, h * 0.18, 0.05, material(color), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Commits', { bg: '#0d1117', fg: '#39d353' }) }), 0, h * 0.35, o.d / 2 + 0.03));
      group.add(inner);
    },

    contributionBlock(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { roughness: 0.4 })));
      group.add(box(w + 0.04, 0.06, d + 0.04, glow(color, 1.2), 0, h / 2, 0));
    },

    contributionGraph(group, { w, d }) {
      // A full year of contributions as instanced voxels (7 days x N weeks)
      const levels = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
      const weeks = Math.floor(w / 0.6);
      const days = 7;
      const geometry = new THREE.BoxGeometry(0.45, 1, 0.45);
      geometry.translate(0, 0.5, 0);
      const voxels = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }), weeks * days);
      const matrix = new THREE.Matrix4();
      const tint = new THREE.Color();
      let index = 0;
      for (let week = 0; week < weeks; week++) {
        for (let day = 0; day < days; day++) {
          const level = (week * 7 + day * 3 + (week % 5) * day + (week * day) % 4) % 5;
          matrix.makeScale(1, 0.15 + level * 0.45, 1);
          matrix.setPosition(-w / 2 + week * 0.6 + 0.3, 0, -d / 2 + day * (d / days) + d / 14);
          voxels.setMatrixAt(index, matrix);
          voxels.setColorAt(index, tint.set(levels[level]));
          index++;
        }
      }
      voxels.castShadow = true;
      voxels.receiveShadow = true;
      group.add(voxels);
    },

    stage(group, { w, h, d, color, type, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(box(o.w, h, o.d, material('#1e1e24')));
      inner.add(box(o.w + 0.1, 0.08, o.d + 0.1, glow(color, 0.8), 0, h / 2, 0));
      for (let i = 0; i < 3; i++) inner.add(box(o.w * 0.3, h * (i + 1) / 4, 0.5, material('#2d3436'), 0, -h / 2 + (h * (i + 1)) / 8, o.d / 2 + 0.25 + (2 - i) * 0.5));
      // Truss with stage lights and a backdrop screen
      const truss = material('#b2bec3', { metalness: 0.7 });
      [-1, 1].forEach((side) => inner.add(box(0.25, 5, 0.25, truss, (side * o.w) / 2.1, h / 2 + 2.5, -o.d / 2 + 0.3)));
      inner.add(box(o.w, 0.25, 0.25, truss, 0, h / 2 + 5, -o.d / 2 + 0.3));
      ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7'].forEach((lightColor, index) => {
        const light = cylinder(0.2, 0.3, 0.5, glow(lightColor, 1.5), -o.w * 0.35 + index * o.w * 0.23, h / 2 + 4.6, -o.d / 2 + 0.6, 8);
        inner.add(light);
        animate(light, (time) => { light.rotation.x = 0.6 + Math.sin(time * 1.5 + index) * 0.3; });
      });
      const backdrop = /show|music/.test(type) ? artTexture(3) : labelTexture(/horizon/.test(type) ? 'Keynote' : 'Live', { bg: '#0b0b14', fg: color });
      inner.add(box(o.w * 0.8, 3.2, 0.1, new THREE.MeshBasicMaterial({ map: backdrop }), 0, h / 2 + 2.6, -o.d / 2 + 0.2));
      [-1, 1].forEach((side) => inner.add(box(0.8, 1.6, 0.8, material('#111'), (side * o.w) / 2.6, h / 2 + 0.8, o.d / 2 - 0.6)));
      group.add(inner);
    },

    lounge(group, { w, h, d, color }) {
      const radius = Math.min(w, d) / 2;
      group.add(cylinder(radius, radius, h, material(color, { roughness: 1 }), 0, 0, 0, 32));
      group.add(cylinder(radius * 0.25, radius * 0.25, 0.6, material('#ffffff', { roughness: 0.3 }), 0, h / 2 + 0.3, 0, 16));
      const seats = 6;
      for (let i = 0; i < seats; i++) {
        const angle = (i / seats) * Math.PI * 2;
        group.add(sphere(0.55, material(shade(color, (i % 2 ? 0.15 : -0.1)), { roughness: 1 }), Math.cos(angle) * radius * 0.7, h / 2 + 0.35, Math.sin(angle) * radius * 0.7, 10));
      }
    },

    aiAvatar(group, { w, h, color }) {
      const bodyMaterial = glow(color, 0.5, { transparent: true, opacity: 0.9 });
      group.add(cylinder(w * 0.3, w * 0.4, h * 0.5, bodyMaterial, 0, -h * 0.05, 0, 12));
      const head = sphere(w * 0.3, glow('#ffffff', 0.7), 0, h * 0.35, 0, 16);
      group.add(head);
      group.add(cylinder(w * 0.6, w * 0.7, 0.2, material('#2d3436'), 0, -h / 2 + 0.1, 0, 16));
      const halo = mesh(new THREE.TorusGeometry(w * 0.5, 0.05, 8, 32), glow(color, 1.5));
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      animate(halo, (time) => { halo.position.y = Math.sin(time * 2) * h * 0.3; });
      animate(head, (time) => { head.position.y = h * 0.35 + Math.sin(time * 3) * 0.08; });
    },

    questZone(group, { w, h, color, label }) {
      group.add(cylinder(w / 2, w / 2, h, glow(color, 0.6), 0, 0, 0, 24));
      const marker = textSprite('!', { width: 3, color: '#f1c40f', background: 'rgba(0,0,0,0)', font: 'bold 120px Arial, sans-serif' });
      marker.position.y = 3;
      group.add(marker);
      animate(marker, (time) => { marker.position.y = 3 + Math.sin(time * 3) * 0.3; });
      // Quest giver NPC
      const npc = new THREE.Group();
      npc.add(box(0.7, 1.2, 0.5, material('#e67e22'), 0, 0.8, 0));
      npc.add(box(0.6, 0.6, 0.6, material('#f5cba7'), 0, 1.7, 0));
      npc.add(box(0.25, 0.8, 0.25, material('#2c3e50'), -0.18, 0.05, 0));
      npc.add(box(0.25, 0.8, 0.25, material('#2c3e50'), 0.18, 0.05, 0));
      npc.position.y = h / 2 - 0.2;
      group.add(npc);
      if (label) npc.userData.label = label;
    },

    altar(group, { w, h, d, color }) {
      for (let tier = 0; tier < 3; tier++) {
        const scale = 1 - tier * 0.25;
        group.add(box(w * scale, h / 3, d * scale, material(shade(color, -tier * 0.05)), 0, -h / 2 + (tier + 0.5) * (h / 3), 0));
      }
      const bonsai = new THREE.Group();
      bonsai.add(cylinder(0.12, 0.18, 0.8, material('#5d4037'), 0, 0.4, 0, 6));
      bonsai.add(mesh(new THREE.IcosahedronGeometry(0.6, 0), material('#2ed573', { flatShading: true }), 0, 1, 0));
      bonsai.position.y = h / 2;
      group.add(bonsai);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const lantern = new THREE.Group();
        lantern.add(box(0.3, 1, 0.3, material('#b2bec3'), 0, 0.5, 0));
        lantern.add(box(0.45, 0.35, 0.45, glow('#ffa502', 1.2), 0, 1.2, 0));
        lantern.add(box(0.6, 0.12, 0.6, material('#636e72'), 0, 1.45, 0));
        lantern.position.set((sx * w) / 2 + sx * 0.6, -h / 2, (sz * d) / 2 + sz * 0.6);
        group.add(lantern);
      });
    },

    building(group, { w, h, d, color, label, type, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const wallTexture = windowsTexture(color);
      const sideMaterial = new THREE.MeshStandardMaterial({ map: repeated(wallTexture, Math.max(1, Math.round(o.w / 4)), Math.max(1, Math.round(h / 6))), roughness: 0.7 });
      const roofMaterial = material(shade(color, -0.08));
      inner.add(mesh(new THREE.BoxGeometry(o.w, h, o.d), [sideMaterial, sideMaterial, roofMaterial, roofMaterial, sideMaterial, sideMaterial]));
      inner.add(box(o.w + 0.3, 0.3, o.d + 0.3, material(shade(color, 0.12)), 0, h / 2 + 0.15, 0));

      const isShop = /shop|boutique|fashion|wearable/.test(type);
      const isCasino = /vegas|casino|east_district/.test(type);
      const isCyber = /aetheria|west_district/.test(type);
      const signColor = isCasino ? '#ffd32a' : isCyber ? '#00f0ff' : '#ffffff';

      if (isShop || h <= 3.5) {
        // Glass storefront, door and awning on the ground floor
        const storefront = box(o.w * 0.8, Math.min(2.4, h * 0.6), 0.08, material('#bcd7ec', { transparent: true, opacity: 0.55, roughness: 0.05 }), 0, -h / 2 + Math.min(1.2, h * 0.3), o.d / 2 + 0.04);
        storefront.castShadow = false;
        inner.add(storefront);
        if (isShop) {
          const awning = box(o.w * 0.85, 0.12, 1.4, material(isCasino ? '#c0392b' : '#1877f2'), 0, -h / 2 + 2.7, o.d / 2 + 0.7);
          awning.rotation.x = 0.25;
          inner.add(awning);
        }
      } else {
        inner.add(box(1.8, 2.4, 0.1, material('#2d3436'), 0, -h / 2 + 1.2, o.d / 2 + 0.05));
      }

      if (label) {
        const signText = label.split(/ - |\(/)[0].replace(/^Private Lot:\s*/, '').trim();
        const signWidth = Math.min(o.w * 0.9, 9);
        const sign = facedBox(signWidth, signWidth / 4, 0.15, material('#14121f'), new THREE.MeshBasicMaterial({ map: labelTexture(signText, { bg: '#14121f', fg: signColor, border: isCasino || isCyber ? signColor : null }) }), 0, Math.min(h / 2 - signWidth / 8 - 0.4, 2.5), o.d / 2 + 0.1);
        inner.add(sign);
      }
      if (isCasino) {
        const marquee = box(o.w * 0.9, 0.18, 0.18, glow('#ff3f34', 1.6), 0, h / 2 - 0.2, o.d / 2 + 0.12);
        inner.add(marquee);
        animate(marquee, (time) => { marquee.material = glow(Math.sin(time * 6) > 0 ? '#ff3f34' : '#ffd32a', 1.6); });
      }
      if (isCyber) {
        inner.add(cylinder(0.08, 0.08, 4, material('#dfe6e9'), o.w * 0.3, h / 2 + 2, 0, 6));
        const beacon = sphere(0.25, glow('#00f0ff', 2), o.w * 0.3, h / 2 + 4.1, 0, 8);
        inner.add(beacon);
        animate(beacon, (time) => { beacon.visible = Math.sin(time * 4) > 0; });
        inner.add(box(0.15, h * 0.9, 0.15, glow('#00f0ff', 1.2), -o.w / 2, 0, o.d / 2));
        inner.add(box(0.15, h * 0.9, 0.15, glow('#ff2d7a', 1.2), o.w / 2, 0, o.d / 2));
      }
      group.add(inner);
    },

    house(group, { w, h, d, color, label, type, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const locked = /unminted|locked/.test(type);
      const wallMaterial = locked
        ? material(color, { transparent: true, opacity: 0.35 })
        : new THREE.MeshStandardMaterial({ map: repeated(windowsTexture(color), 2, 1), roughness: 0.8 });
      inner.add(box(o.w, h * 0.65, o.d, wallMaterial, 0, -h * 0.175, 0));
      const roof = mesh(new THREE.ConeGeometry(Math.max(o.w, o.d) * 0.75, h * 0.45, 4), material(locked ? '#95a5a6' : '#c0392b', { flatShading: true, transparent: locked, opacity: locked ? 0.45 : 1 }), 0, h * 0.375, 0);
      roof.rotation.y = Math.PI / 4;
      inner.add(roof);
      inner.add(box(1.1, 1.8, 0.1, material('#5d4037'), 0, -h / 2 + 0.9, o.d / 2 + 0.05));
      const signText = locked ? 'FOR MINT' : 'MINTED';
      const sign = new THREE.Group();
      sign.add(box(0.1, 1.6, 0.1, material('#ecf0f1'), 0, 0.8, 0));
      sign.add(facedBox(1.8, 0.7, 0.08, material('#ecf0f1'), new THREE.MeshBasicMaterial({ map: labelTexture(signText, { bg: locked ? '#f39c12' : '#27ae60', fg: '#ffffff', font: 'bold 64px Segoe UI, Arial, sans-serif' }) }), 0, 1.6, 0.05));
      sign.position.set(o.w / 2 + 0.8, -h / 2, o.d / 2 + 0.8);
      inner.add(sign);
      if (locked) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(o.w, h * 0.65, o.d)), new THREE.LineBasicMaterial({ color: '#f39c12' }));
        edges.position.y = -h * 0.175;
        inner.add(edges);
      }
      group.add(inner);
    },

    galleryWall(group, { w, h, d, color, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(box(o.w, h, o.d, material(color)));
      const frames = Math.max(2, Math.floor(o.w / 3.5));
      for (let i = 0; i < frames; i++) {
        for (let row = 0; row < 2; row++) {
          const x = -o.w / 2 + (i + 0.5) * (o.w / frames);
          const y = row === 0 ? h * 0.15 : -h * 0.2;
          inner.add(box(2.4, 2, 0.12, material('#2d3436'), x, y, o.d / 2 + 0.06));
          inner.add(box(2.1, 1.7, 0.05, new THREE.MeshBasicMaterial({ map: artTexture(i * 2 + row + 11) }), x, y, o.d / 2 + 0.13));
        }
      }
      group.add(inner);
    },

    plant(group, { w, h, color, type }) {
      // Trees ("round_tree", "pine_tree"...) are realistic leafy trees standing on the ground
      if (/tree/.test(type || '')) {
        const tree = realisticTree(/pine|conifer|fir/.test(type) ? 'pine' : 'broadleaf', Math.max(3, h * 1.15));
        tree.position.y = -h / 2;
        group.add(tree);
        return;
      }
      group.add(cylinder(w * 0.35, w * 0.28, h * 0.3, material('#dfe4ea'), 0, -h * 0.35, 0, 10));
      group.add(mesh(new THREE.IcosahedronGeometry(w * 0.55, 0), material(color, { flatShading: true }), 0, h * 0.1, 0));
      group.add(mesh(new THREE.IcosahedronGeometry(w * 0.4, 0), material(shade(color, 0.08), { flatShading: true }), 0, h * 0.38, 0));
    },

    rug(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { roughness: 1 })));
    },

    beanbags(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { roughness: 1 })));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], index) =>
        group.add(sphere(0.6, material(['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'][index], { roughness: 1 }), (sx * w) / 3.5, h / 2 + 0.35, (sz * d) / 3.5, 10)));
      group.add(cylinder(0.5, 0.5, 0.5, material('#ffffff'), 0, h / 2 + 0.25, 0, 12));
    },

    platform(group, { w, h, d, color }) {
      if (Math.abs(w - d) < 0.5) {
        group.add(cylinder(w / 2, w / 2, h, material(color, { roughness: 0.5 }), 0, 0, 0, 40));
        const ring = mesh(new THREE.TorusGeometry(w / 2 - 0.4, 0.07, 6, 48), glow('#ffffff', 0.8));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = h / 2 + 0.02;
        group.add(ring);
      } else {
        group.add(box(w, h, d, material(color)));
      }
    },

    fallback(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color, { roughness: 0.5 })));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: shade(color, -0.2) }));
      group.add(edges);
    }
  };

  // Ordered type matchers: first match wins
  const typeRules = [
    [/waterfall/, 'waterfall'],
    [/water/, 'water'],
    [/floating_island/, 'floatingIsland'],
    [/teleport|spawn/, 'spawnPad'],
    [/hologram/, 'hologram'],
    [/nft_display/, 'nftFrame'],
    [/monolith/, 'monolith'],
    [/road|street|walkway|freeway/, 'road'],
    [/balcony|terrace/, 'balcony'],
    [/slab/, 'slab'],
    [/palm_trunk/, 'palmTrunk'],
    [/palm_leaves/, 'palmLeaves'],
    [/beach_chair/, 'beachChair'],
    [/umbrella_top/, 'umbrellaTop'],
    [/beach_umbrella/, 'umbrellaPole'],
    [/pool_table_base/, 'poolTable'],
    [/pool_table_edge/, 'poolRails'],
    [/arcade_cabinet/, 'arcadeCabinet'],
    [/arcade_screen/, 'arcadeScreen'],
    [/kanban/, 'kanban'],
    [/sticky_note/, 'stickyNote'],
    [/screen|monitor|terminal/, 'display'],
    [/wayfinding_board|sign_board/, 'signBoard'],
    [/wayfinding_sign|sign_post/, 'signPost'],
    [/battlestation/, 'battlestation'],
    [/desk/, 'desk'],
    [/table/, 'table'],
    [/counter/, 'counter'],
    [/sofa/, 'sofa'],
    [/stairs/, 'stairStep'],
    [/escalator/, 'escalator'],
    [/glass_facade/, 'glassFacade'],
    [/gate/, 'gate'],
    [/wall$|_wall|^wall/, 'wall'],
    [/neon_pillar|pillar/, 'neonPillar'],
    [/server_rack/, 'serverRack'],
    [/castle/, 'castleTower'],
    [/bridge/, 'bridge'],
    [/pedestal/, 'pedestal'],
    [/commit_monument/, 'commitWall'],
    [/contribution_graph/, 'contributionGraph'],
    [/grid_block/, 'contributionBlock'],
    [/stage|podium/, 'stage'],
    [/lounge|circle/, 'lounge'],
    [/retro_corner/, 'beanbags'],
    [/ai_avatar/, 'aiAvatar'],
    [/quest|npc/, 'questZone'],
    [/altar/, 'altar'],
    [/property/, 'house'],
    [/gallery/, 'galleryWall'],
    [/plant|tree/, 'plant'],
    [/rug/, 'rug'],
    [/genesis_plaza|plaza_disc/, 'platform'],
    [/floor|ground|land_base|base_land|grid_base|carpet/, 'floor'],
    [/tower|shop|district|private_land|block|boutique|store|building/, 'building']
  ];

  function builderFor(type) {
    const rule = typeRules.find(([pattern]) => pattern.test(type));
    return builders[rule ? rule[1] : 'fallback'];
  }

  function toVector(value, fallback) {
    if (Array.isArray(value) && value.length === 3) return value;
    if (typeof value === 'number') return [value, value, value];
    return [fallback, fallback, fallback];
  }

  const SEAT_TYPES = /bench|sofa|chair|stool|couch|beanbag|lounge|picnic|bleacher|cushion|hammock|throne|swing/;

  // Builds one map block as a group positioned at its JSON coordinates
  function buildBlock(blockData) {
    const [w, h, d] = toVector(blockData.scale, 1);
    const [x, y, z] = toVector(blockData.position, 0);
    const type = blockData.type || 'block';
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { blockType: type, label: blockData.label || null };

    builderFor(type)(group, {
      w, h, d,
      color: blockData.color || '#cccccc',
      label: blockData.label || '',
      type,
      block: { position: [x, y, z] },
      data: blockData
    });
    if (typeof blockData.rotationY === 'number') group.rotation.y = blockData.rotationY;
    // Roblox-style: anything that looks like a seat can be sat on (E)
    if (SEAT_TYPES.test(type)) {
      let hasSeat = false;
      group.traverse((node) => { if (node !== group && node.userData.interactable) hasSeat = true; });
      if (!hasSeat) interactive(group, 'sit', blockData.label || type.replace(/_/g, ' '));
    }
    return group;
  }

  // Lets other files (landmarks.js) add builders for new block types
  function registerBuilder(pattern, name, builder) {
    builders[name] = builder;
    typeRules.unshift([pattern, name]);
  }

  const kit = {
    material, glow, shade, mesh, box, cylinder, sphere, facedBox, animate, orientation, textSprite, seat, roundedBoxGeometry,
    labelTexture, windowsTexture, gridTexture, roadTexture, repeated, codeScreenTexture, artTexture, canvasTexture,
    cobbleTexture, brickTexture, plankTexture, stuccoTexture, roofTileTexture, roundedSlab, roundedUnitBox, mergeByMaterial, laptop, interactive,
    treeMaterial, realisticTreeGeometry, realisticTree
  };

  return { buildBlock, registerBuilder, kit, textSprite, material, glow, animatedObjects, interactables };
})();

// ============================================================================
// FIRE LIGHTS: FLICKERING FIRELIGHT AND SHADOWS AROUND FIREPITS AND CAMPFIRES
// ============================================================================
// Every fire registers here. Each one gets a warm pool of light painted on the
// ground (cheap, always on, brighter at night). On top of that a small pool of
// real point lights follows the fires nearest to the camera: they flicker like
// flames, and at night the closest one also casts soft shadows of the benches,
// logs and cursors around it (a point light shadow renders the scene six
// times, so only one fire casts them). By day the fires barely light anything.
const FireLights = (() => {
  const fires = [];
  const lights = [];
  const LIGHT_COUNT = 2;
  const RANGE = 70;
  const probe = new THREE.Vector3();
  let glowTexture = null;
  let scene = null;

  function groundGlowTexture() {
    if (glowTexture) return glowTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 170, 80, 1)');
    gradient.addColorStop(0.25, 'rgba(255, 120, 40, 0.55)');
    gradient.addColorStop(0.6, 'rgba(200, 70, 20, 0.16)');
    gradient.addColorStop(1, 'rgba(120, 40, 10, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    glowTexture = new THREE.CanvasTexture(canvas);
    return glowTexture;
  }

  // group: the fire (its origin is the center of the fire, on the ground)
  function register(group, { radius = 9, height = 1.2, strength = 1 } = {}) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: groundGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.06;
    glow.raycast = () => {};
    glow.renderOrder = 1;
    group.add(glow);
    fires.push({ group, glow, height, strength, phase: Math.random() * 10 });
  }

  function ensureLights() {
    if (lights.length || !scene) return;
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const light = new THREE.PointLight('#ff8a3d', 0, 26, 2);
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.004;
      light.shadow.radius = 4;
      light.shadow.camera.near = 0.3;
      light.shadow.camera.far = 26;
      light.userData.shadowCapable = false; // the quality governor leaves it alone
      scene.add(light);
      lights.push(light);
    }
  }

  function init(targetScene) {
    scene = targetScene;
  }

  // night: 0 by day, 1 at night; quality: 0 (minimum) .. 3 (high)
  function update(camera, time, night, quality = 2) {
    if (!scene) return;
    ensureLights();
    const flickerOf = (fire) => 0.78 + Math.sin(time * 9.7 + fire.phase) * 0.09 + Math.sin(time * 23.3 + fire.phase * 1.7) * 0.07 + Math.sin(time * 3.1 + fire.phase * 0.6) * 0.06;
    // Ground glow on every fire (stronger at night)
    const nearby = [];
    fires.forEach((fire) => {
      if (!fire.group.parent) return;
      const flicker = flickerOf(fire);
      fire.glow.material.opacity = Math.min(1, (0.12 + night * 0.85) * flicker * fire.strength);
      fire.glow.scale.setScalar(0.94 + flicker * 0.08);
      fire.group.getWorldPosition(probe);
      const distance = probe.distanceTo(camera.position);
      if (distance < RANGE) nearby.push({ fire, distance, position: probe.clone(), flicker });
    });
    nearby.sort((a, b) => a.distance - b.distance);
    // castShadow only flips at dusk and dawn (flipping it recompiles the shaders);
    // with no fire nearby the shadow map simply stops updating
    const castShadows = night > 0.5 && quality >= 2;
    lights.forEach((light, index) => {
      const entry = nearby[index];
      light.castShadow = castShadows && index === 0;
      light.shadow.autoUpdate = Boolean(entry) && light.castShadow;
      if (!entry) { light.intensity = 0; return; }
      const { fire, position, flicker } = entry;
      // The light dances a little with the flames
      light.position.set(position.x + Math.sin(time * 6.3 + fire.phase) * 0.12, position.y + fire.height + Math.sin(time * 8.1 + fire.phase) * 0.08, position.z + Math.cos(time * 5.7 + fire.phase) * 0.12);
      light.color.setHSL(0.07 + Math.sin(time * 4 + fire.phase) * 0.01, 1, 0.55);
      light.intensity = (0.25 + night * 4.2) * flicker * fire.strength;
      light.distance = 14 + night * 18;
    });
  }

  return { init, register, update };
})();
