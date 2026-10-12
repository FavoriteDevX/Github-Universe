// ============================================================================
// GENESIS PLAZA: DECENTRALAND-STYLE BUILDERS AT HUMAN SCALE
// ============================================================================
// Warm cobblestone, a theatre with a bulb marquee, round trees, classic lamp
// posts, shops with awnings, a neon tower, a casino and a hot-air balloon.
// The avatar is ~2.5m tall: doors are 3.5m, buildings 12-35m.
(() => {
  const {
    material, glow, shade, mesh, box, cylinder, sphere, facedBox, animate, orientation, textSprite,
    labelTexture, windowsTexture, repeated, cobbleTexture, brickTexture, plankTexture, stuccoTexture, roofTileTexture, roundedSlab
  } = PropKit.kit;
  const ACCENT = '#1877f2';

  function texturedMaterial(texture, repeatX, repeatY, options = {}) {
    return new THREE.MeshStandardMaterial({ map: repeated(texture, repeatX, repeatY), roughness: 0.85, ...options });
  }

  // Row of glowing marquee bulbs along a straight line (instanced)
  function bulbRow(group, from, to, count, color = '#fff3c4') {
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), glow(color, 1.6), count);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      matrix.makeTranslation(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.z + (to.z - from.z) * t);
      bulbs.setMatrixAt(i, matrix);
    }
    group.add(bulbs);
    return bulbs;
  }

  function bulbArc(group, radius, startAngle, endAngle, y, count, color = '#fff3c4') {
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 8, 6), glow(color, 1.6), count);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / (count - 1));
      matrix.makeTranslation(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      bulbs.setMatrixAt(i, matrix);
    }
    group.add(bulbs);
    animate(bulbs, (time) => { bulbs.material.emissiveIntensity = 1.2 + Math.sin(time * 5) * 0.5; });
    return bulbs;
  }

  function door(group, x, y, z, rotationY = 0, color = '#5d4037') {
    const frame = new THREE.Group();
    frame.add(box(3.4, 0.3, 0.4, material('#e9d8b4'), 0, 3.6, 0));
    [-1.6, 1.6].forEach((side) => frame.add(box(0.3, 3.6, 0.4, material('#e9d8b4'), side, 1.8, 0)));
    frame.add(box(3, 3.4, 0.12, material(color, { roughness: 0.6 }), 0, 1.7, 0.08));
    frame.add(sphere(0.12, material('#ffd166', { metalness: 0.8 }), 1, 1.7, 0.2, 8));
    frame.position.set(x, y, z);
    frame.rotation.y = rotationY;
    group.add(frame);
  }

  function windowRow(group, width, y, z, count, glassColor = '#9fd3ff') {
    const step = width / count;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + step * (i + 0.5);
      group.add(box(step * 0.55, 2.2, 0.15, material('#e9d8b4'), x, y, z));
      group.add(box(step * 0.45, 1.9, 0.2, material(glassColor, { roughness: 0.1, metalness: 0.3, emissive: '#ffe9a8', emissiveIntensity: 0.15 }), x, y, z + 0.03));
    }
  }

  const builders = {
    // Cobblestone plaza with a lighter inner circle and radiating paths
    plazaFloor(group, { w, h, d }) {
      group.add(box(w, h, d, texturedMaterial(cobbleTexture('#c98b5a'), w / 6, d / 6)));
      const inner = cylinder(42, 42, 0.06, texturedMaterial(cobbleTexture('#e0b27c'), 14, 14), 0, h / 2 + 0.03, 0, 64);
      inner.castShadow = false;
      group.add(inner);
      const ring = mesh(new THREE.RingGeometry(41.5, 43, 64), material('#8d5524'), 0, h / 2 + 0.07, 0);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      for (let i = 0; i < 4; i++) {
        const path = box(8, 0.05, d / 2 - 43, texturedMaterial(cobbleTexture('#e0b27c'), 2, 8), 0, h / 2 + 0.03, -(43 + (d / 2 - 43) / 2));
        const pivot = new THREE.Group();
        pivot.rotation.y = (i * Math.PI) / 2;
        pivot.add(path);
        group.add(pivot);
      }
    },

    fountain(group, { w, h, color }) {
      const radius = w / 2;
      group.add(cylinder(radius, radius + 0.4, h, texturedMaterial(stuccoTexture('#e9d8b4'), 8, 1), 0, 0, 0, 48));
      const water = cylinder(radius - 0.6, radius - 0.6, h * 0.2, material(color, { transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.2 }), 0, h * 0.42, 0, 48);
      water.castShadow = false;
      group.add(water);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const jet = cylinder(0.08, 0.2, 2.2, glow('#bde0fe', 0.4, { transparent: true, opacity: 0.6 }), Math.cos(angle) * (radius - 1.2), h / 2 + 1, Math.sin(angle) * (radius - 1.2), 6);
        jet.rotation.z = Math.cos(angle) * -0.4;
        jet.rotation.x = Math.sin(angle) * 0.4;
        group.add(jet);
        animate(jet, (time) => jet.scale.set(1, 0.8 + Math.sin(time * 4 + i) * 0.2, 1));
      }
    },

    // The theatre with the curved marquee from Decentraland, here as the Multiverse Theatre
    theatre(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const radius = o.w / 2;
      const wall = texturedMaterial(brickTexture('#7b2d26'), 10, 4);
      // Curved back drum
      const drum = mesh(new THREE.CylinderGeometry(radius, radius, h, 48, 1, true, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ map: repeated(brickTexture('#7b2d26'), 12, 4), roughness: 0.9, side: THREE.DoubleSide }), 0, h / 2, 0);
      group.add(inner);
      inner.add(drum);
      // Roof dome
      const roof = mesh(new THREE.SphereGeometry(radius, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), material('#4a1d1a'), 0, h, 0);
      roof.scale.set(1, 0.18, 1);
      inner.add(roof);
      // Front facade pillars with an open entrance
      [-1, 1].forEach((side) => inner.add(box(radius * 0.45, h, 2, wall, side * radius * 0.78, h / 2, 0)));
      inner.add(box(radius * 2, h * 0.3, 2, wall, 0, h * 0.85, 0));
      // Marquee: curved band with bulbs and the big sign
      const marquee = mesh(new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 4, 48, 1, true, -Math.PI * 0.95, Math.PI * 0.9), material('#2b0f0d', { side: THREE.DoubleSide }), 0, h * 0.62, radius * 0.25);
      marquee.rotation.y = Math.PI;
      inner.add(marquee);
      const signText = (label || 'GITHUB MULTIVERSE THEATRE').toUpperCase();
      inner.add(facedBox(radius * 1.3, 3.2, 0.4, material('#2b0f0d'), new THREE.MeshBasicMaterial({ map: labelTexture(signText, { bg: '#fff8e7', fg: '#2b0f0d', width: 1024, height: 160, font: 'bold 78px Georgia, serif' }) }), 0, h * 0.62, radius * 1.16));
      bulbArc(inner, radius * 1.17, Math.PI * 0.12, Math.PI * 0.88, h * 0.62 + 2.1, 40);
      bulbArc(inner, radius * 1.17, Math.PI * 0.12, Math.PI * 0.88, h * 0.62 - 2.1, 40);
      // Interior: wooden floor, stage, seats and a screen with the logo
      inner.add(cylinder(radius - 0.5, radius - 0.5, 0.2, texturedMaterial(plankTexture('#8d5a2b'), 8, 8), 0, 0.1, -0.5, 32));
      inner.add(box(radius * 1.2, 1.4, radius * 0.45, texturedMaterial(plankTexture('#5d3a1a'), 4, 2), 0, 0.7, -radius * 0.65));
      for (let i = 0; i < 3; i++) inner.add(box(2.4, 0.35, 1, material('#5d3a1a'), 0, 0.18 + i * 0.35 * 0, -radius * 0.65 + radius * 0.225 + 0.5 + i * 0.01));
      const screenTexture = BrandLogos.billboardTexture('GitHub', { tagline: 'Multiverse Live', background: '#0d1117', foreground: '#ffffff' });
      inner.add(box(radius * 1.1, radius * 0.55, 0.2, new THREE.MeshBasicMaterial({ map: screenTexture }), 0, 1.4 + radius * 0.4, -radius * 0.86));
      const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), material('#b5262b', { roughness: 0.9 }), 60);
      const matrix = new THREE.Matrix4();
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 12; col++) {
          matrix.makeTranslation(-radius * 0.55 + col * (radius * 1.1 / 11), 0.65, radius * 0.05 + row * 1.6 - radius * 0.15);
          seats.setMatrixAt(row * 12 + col, matrix);
        }
      }
      inner.add(seats);
      // Purple banners on both sides like the reference screenshot
      [-1, 1].forEach((side) => {
        inner.add(box(0.2, 8, 0.2, material('#9e9e9e'), side * radius * 1.05, 4, radius * 0.9));
        inner.add(facedBox(2.4, 5, 0.1, material('#6a2fb8'), new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture('GitHub', { tagline: 'Multiverse', background: '#3d1a78', foreground: '#ffffff', width: 512, height: 1024 }) }), side * radius * 1.05 + side * 1.3, 5, radius * 0.9));
      });
      // Front steps
      for (let i = 0; i < 3; i++) inner.add(box(radius * 0.9, 0.3 * (3 - i), 1.2, texturedMaterial(cobbleTexture('#b0a08a'), 4, 1), 0, 0.15 * (3 - i), radius + 1 + i * 1.2));
    },

    roundTree(group, { w, h, color }) {
      group.add(cylinder(w * 0.08, w * 0.12, h * 0.55, material('#6d4c41'), 0, -h * 0.22, 0, 8));
      const crown = material(color, { roughness: 0.9, flatShading: false });
      [[0, 0.18, 0, 0.42], [0.22, 0.08, 0.1, 0.3], [-0.2, 0.1, -0.12, 0.32], [0.05, 0.36, -0.05, 0.3]].forEach(([x, y, z, r]) =>
        group.add(sphere(w * r, crown, x * w, h * y + h * 0.1, z * w, 14)));
    },

    lampPost(group, { h, color }) {
      const iron = material('#263238', { metalness: 0.6, roughness: 0.4 });
      group.add(cylinder(0.12, 0.2, h, iron, 0, 0, 0, 8));
      group.add(cylinder(0.35, 0.45, 0.6, iron, 0, -h / 2 + 0.3, 0, 8));
      [-1, 1].forEach((side) => {
        group.add(box(1.4, 0.1, 0.1, iron, side * 0.6, h / 2 - 0.3, 0));
        const globe = sphere(0.38, glow(color || '#fff3c4', 0.9), side * 1.25, h / 2 - 0.7, 0, 12);
        group.add(globe);
      });
    },

    bench(group, { w, color, block }) {
      const o = orientation(block, w, 1, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const wood = texturedMaterial(plankTexture(color || '#a8743f'), 1, 1);
      inner.add(box(w, 0.12, 0.7, wood, 0, 0.55, 0));
      inner.add(box(w, 0.6, 0.1, wood, 0, 0.95, -0.35));
      [-1, 1].forEach((side) => inner.add(box(0.12, 0.55, 0.7, material('#263238'), side * (w / 2 - 0.2), 0.27, 0)));
      group.add(inner);
    },

    flowerBed(group, { w, h, d }) {
      group.add(roundedSlab(w, h, d, 0.6, texturedMaterial(brickTexture('#9c6644'), w / 2, 1)));
      group.children[group.children.length - 1].position.y = -h / 2;
      group.add(box(w - 0.4, 0.1, d - 0.4, material('#5d4037'), 0, h / 2, 0));
      const colors = ['#ff6b6b', '#ffd43b', '#f783ac', '#ffffff', '#b197fc'];
      for (let i = 0; i < Math.floor(w * d / 2); i++) {
        group.add(sphere(0.22, material(colors[i % colors.length]), (((i * 37) % 100) / 100 - 0.5) * (w - 0.8), h / 2 + 0.25, (((i * 61) % 100) / 100 - 0.5) * (d - 0.8), 6));
      }
    },

    // Decentraland-style shop: stucco walls, tile roof, awning, sign, door, windows
    shop(group, { w, h, d, color, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const walls = roundedSlab(o.w, h, o.d, 1.2, texturedMaterial(stuccoTexture(shade(color, 0.3)), 2, 2));
      walls.position.y = -h / 2;
      inner.add(walls);
      const roof = mesh(new THREE.ConeGeometry(Math.max(o.w, o.d) * 0.72, h * 0.45, 4), texturedMaterial(roofTileTexture(color), 3, 2, { flatShading: true }), 0, h / 2 + h * 0.22, 0);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(o.w / Math.max(o.w, o.d), 1, o.d / Math.max(o.w, o.d));
      inner.add(roof);
      door(inner, 0, -h / 2, o.d / 2 + 0.05);
      windowRow(inner, o.w * 0.9, h * 0.15, o.d / 2 + 0.05, 3);
      // Striped awning
      const awningTexture = PropKit.kit.canvasTexture(`awning|${color}`, 128, 32, (ctx, cw, ch) => {
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : color; ctx.fillRect(i * 16, 0, 16, ch); }
      });
      const awning = box(o.w * 0.95, 0.15, 2.2, new THREE.MeshStandardMaterial({ map: awningTexture }), 0, -h / 2 + 4.4, o.d / 2 + 1.1);
      awning.rotation.x = 0.3;
      inner.add(awning);
      if (label) {
        inner.add(facedBox(o.w * 0.75, 1.6, 0.3, material('#3e2723'), new THREE.MeshBasicMaterial({ map: labelTexture(label, { bg: '#3e2723', fg: '#ffe8a3', font: 'bold 54px Georgia, serif' }) }), 0, h / 2 - 1.4, o.d / 2 + 0.2));
      }
      inner.add(box(1.2, 0.8, 0.8, material('#f8f9fa'), o.w * 0.35, -h / 2 + 0.4, o.d / 2 + 1.6));
      group.add(inner);
    },

    // Purple neon tower (Aetheria boundary), like the right side of Decentraland's plaza
    neonTower(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const body = roundedSlab(o.w, h, o.d, 2, new THREE.MeshStandardMaterial({ map: repeated(windowsTexture('#3b1a5a', '#ff6ec7'), 3, Math.round(h / 4)), emissiveMap: repeated(windowsTexture('#000000', '#ff6ec7'), 3, Math.round(h / 4)), emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.5 }));
      body.position.y = -h / 2;
      inner.add(body);
      for (let i = 0; i < 4; i++) {
        const strip = box(o.w + 0.3, 0.25, o.d + 0.3, glow(i % 2 ? '#ff6ec7' : '#8a5cff', 1.6), 0, -h / 2 + 4 + i * (h / 4.5), 0);
        inner.add(strip);
        animate(strip, (time) => { strip.material.emissiveIntensity = 1.1 + Math.sin(time * 3 + i) * 0.6; });
      }
      door(inner, 0, -h / 2, o.d / 2 + 0.05, 0, '#2a0f45');
      inner.add(facedBox(o.w * 0.9, 3, 0.3, material('#1b0b2e'), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Aetheria', { bg: '#1b0b2e', fg: '#ff6ec7', border: '#8a5cff', font: 'bold 56px Segoe UI, Arial, sans-serif' }) }), 0, h / 2 - 3, o.d / 2 + 0.2));
      group.add(inner);
    },

    casino(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const body = roundedSlab(o.w, h, o.d, 1.5, texturedMaterial(stuccoTexture('#d81159'), 3, 3));
      body.position.y = -h / 2;
      inner.add(body);
      inner.add(box(o.w + 1, 0.6, o.d + 1, material('#ffd166', { metalness: 0.6 }), 0, h / 2, 0));
      door(inner, 0, -h / 2, o.d / 2 + 0.05, 0, '#2b0f0d');
      const sign = facedBox(o.w * 0.9, 4, 0.4, material('#2b0f0d'), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Vegas', { bg: '#2b0f0d', fg: '#ffd166', font: 'bold 64px Georgia, serif' }) }), 0, h * 0.18, o.d / 2 + 0.3);
      inner.add(sign);
      const bulbs = bulbRow(inner, new THREE.Vector3(-o.w * 0.45, h * 0.18 + 2.2, o.d / 2 + 0.6), new THREE.Vector3(o.w * 0.45, h * 0.18 + 2.2, o.d / 2 + 0.6), 24, '#ffd166');
      bulbRow(inner, new THREE.Vector3(-o.w * 0.45, h * 0.18 - 2.2, o.d / 2 + 0.6), new THREE.Vector3(o.w * 0.45, h * 0.18 - 2.2, o.d / 2 + 0.6), 24, '#ffd166');
      animate(bulbs, (time) => { bulbs.material.emissiveIntensity = Math.sin(time * 8) > 0 ? 2 : 0.4; });
      windowRow(inner, o.w * 0.9, h * 0.38, o.d / 2 + 0.05, 4, '#ffe066');
      group.add(inner);
    },

    archGate(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const stone = texturedMaterial(stuccoTexture('#e9d8b4'), 2, 4);
      [-1, 1].forEach((side) => inner.add(roundedSlab(3, h * 0.6, o.d + 1, 0.8, stone)));
      inner.children[0].position.set(-o.w / 2 + 1.5, -h / 2, 0);
      inner.children[1].position.set(o.w / 2 - 1.5, -h / 2, 0);
      const arch = mesh(new THREE.TorusGeometry(o.w / 2 - 1.5, 1.4, 12, 40, Math.PI), stone, 0, -h / 2 + h * 0.6, 0);
      arch.scale.z = (o.d + 1) / 2.8;
      inner.add(arch);
      inner.add(facedBox(o.w * 0.6, 2.4, 0.5, material('#0d1b3e'), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'GENESIS PLAZA', { bg: '#0d1b3e', fg: '#ffffff', border: ACCENT, font: 'bold 60px Segoe UI, Arial, sans-serif' }) }), 0, -h / 2 + h * 0.6 + o.w / 2 - 1.5, (o.d + 1) / 2 + 0.3));
      group.add(inner);
    },

    plazaTower(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, false);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      const body = roundedSlab(o.w, h, o.d, 2.5, new THREE.MeshStandardMaterial({ map: repeated(windowsTexture('#d6dde8', '#ffe9a8'), 3, Math.round(h / 4)), roughness: 0.4, metalness: 0.2 }));
      body.position.y = -h / 2;
      inner.add(body);
      const crown = cylinder(o.w * 0.4, o.w * 0.55, 4, glow(ACCENT, 0.6), 0, h / 2 + 2, 0, 24);
      inner.add(crown);
      inner.add(cylinder(0.2, 0.2, 8, material('#b0bec5'), 0, h / 2 + 8, 0, 6));
      door(inner, 0, -h / 2, o.d / 2 + 0.05, 0, '#1b2a4a');
      inner.add(facedBox(o.w * 0.9, 2.6, 0.3, material('#0d1b3e'), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Info', { bg: '#0d1b3e', fg: '#ffffff', border: ACCENT, font: 'bold 50px Segoe UI, Arial, sans-serif' }) }), 0, -h / 2 + 6, o.d / 2 + 0.2));
      group.add(inner);
    },

    hotAirBalloon(group, { w, h, color }) {
      const balloon = new THREE.Group();
      const stripes = PropKit.kit.canvasTexture(`balloon|${color}`, 256, 64, (ctx, cw, ch) => {
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#ffd166' : color; ctx.fillRect(i * 32, 0, 32, ch); }
      });
      const envelope = mesh(new THREE.SphereGeometry(w / 2, 24, 18), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7 }));
      envelope.scale.y = 1.15;
      balloon.add(envelope);
      balloon.add(box(w * 0.25, w * 0.18, w * 0.25, texturedMaterial(plankTexture('#8d5a2b'), 1, 1), 0, -h / 2 + w * 0.09, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => balloon.add(cylinder(0.04, 0.04, h - w * 0.55, material('#5d4037'), sx * w * 0.11, -h / 2 + w * 0.18 + (h - w * 0.55) / 2 - 0.1, sz * w * 0.11, 4)));
      group.add(balloon);
      const baseY = group.position.y;
      animate(group, (time) => { group.position.y = baseY + Math.sin(time * 0.4) * 3; balloon.rotation.y = time * 0.1; });
    },

    hydrant(group, { h }) {
      group.add(cylinder(0.25, 0.3, h, material('#d62828'), 0, 0, 0, 10));
      group.add(sphere(0.27, material('#d62828'), 0, h / 2, 0, 10));
      [-1, 1].forEach((side) => { const nozzle = cylinder(0.1, 0.1, 0.3, material('#d62828'), side * 0.3, h * 0.15, 0, 8); nozzle.rotation.z = Math.PI / 2; group.add(nozzle); });
    },

    infoKiosk(group, { h, label }) {
      group.add(cylinder(0.6, 0.7, h, material('#0d1b3e'), 0, 0, 0, 12));
      group.add(cylinder(0.75, 0.75, 0.3, glow(ACCENT, 0.8), 0, h / 2, 0, 12));
      const caption = textSprite(label || 'Info', { width: 6, background: 'rgba(24, 119, 242, 0.85)' });
      caption.position.y = h / 2 + 1.6;
      group.add(caption);
    }
  };

  // Decentraland-style posters and event cards
  function posterTexture(title, subtitle, colors) {
    return PropKit.kit.canvasTexture(`poster|${title}`, 512, 768, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc((i * 97) % w, (i * 151) % h, 20 + (i % 4) * 18, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 76px Segoe UI, Arial, sans-serif';
      title.split(' ').forEach((word, index) => ctx.fillText(word.toUpperCase(), w / 2, 220 + index * 86));
      ctx.font = '36px Segoe UI, Arial, sans-serif';
      ctx.fillText(subtitle, w / 2, h - 150);
      ctx.font = 'bold 34px Segoe UI, Arial, sans-serif';
      ctx.fillText('GitHub Multiverse', w / 2, h - 70);
    });
  }

  function eventCardTexture(world) {
    return PropKit.kit.canvasTexture(`eventcard|${world.key}`, 512, 640, (ctx, w, h) => {
      ctx.fillStyle = '#0d1b3e';
      ctx.fillRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 0, w, 360);
      gradient.addColorStop(0, world.color);
      gradient.addColorStop(1, '#0d1b3e');
      ctx.fillStyle = gradient;
      ctx.fillRect(16, 16, w - 32, 360);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 72, 300 - ((i * 53) % 160), 52, 60 + ((i * 53) % 160));
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px Segoe UI, Arial, sans-serif';
      ctx.fillText(world.name.slice(0, 20), 28, 430);
      ctx.font = '26px Segoe UI, Arial, sans-serif';
      ctx.fillStyle = '#c9d6f2';
      const words = world.description.split(' ');
      let line = '';
      let y = 474;
      words.forEach((word) => {
        if (ctx.measureText(`${line} ${word}`).width > w - 60) { ctx.fillText(line, 28, y); line = word; y += 32; } else { line = line ? `${line} ${word}` : word; }
      });
      if (y < 540) ctx.fillText(line, 28, y);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(28, h - 82, 200, 56);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Segoe UI, Arial, sans-serif';
      ctx.fillText('JUMP IN', 62, h - 44);
    });
  }

  Object.assign(builders, {
    // Round Welcome Hall inspired by Decentraland's: wooden floor, glass waterfall
    // tube with a "Welcome" ring, curved mezzanine, hanging lamps, cafe tables
    welcomeHall(group, { w, h, label }) {
      const radius = w / 2;
      const wood = texturedMaterial(plankTexture('#b07a45'), 10, 10);
      const wall = new THREE.MeshStandardMaterial({ map: repeated(plankTexture('#8a5a33'), 16, 3), roughness: 0.8, side: THREE.DoubleSide });
      group.add(cylinder(radius, radius, 0.3, wood, 0, 0.15, 0, 64));
      // Curved walls with a wide entrance and big windows
      const wallSegment = mesh(new THREE.CylinderGeometry(radius, radius, h, 64, 1, true, Math.PI * 0.62, Math.PI * 1.76), wall, 0, h / 2, 0);
      group.add(wallSegment);
      const windows = mesh(new THREE.CylinderGeometry(radius - 0.05, radius - 0.05, h * 0.35, 64, 1, true, Math.PI * 0.62, Math.PI * 1.76), material('#bfe3ff', { transparent: true, opacity: 0.5, roughness: 0.05, side: THREE.DoubleSide, emissive: '#bfe3ff', emissiveIntensity: 0.2 }), 0, h * 0.3, 0);
      windows.castShadow = false;
      group.add(windows);
      // Ceiling ring with an open skylight
      const ceiling = mesh(new THREE.RingGeometry(radius * 0.45, radius + 0.5, 64), material('#3a2416', { side: THREE.DoubleSide }), 0, h, 0);
      ceiling.rotation.x = -Math.PI / 2;
      group.add(ceiling);
      const goldRing = mesh(new THREE.TorusGeometry(radius * 0.47, 0.25, 8, 64), glow('#ffb703', 1.2), 0, h - 0.2, 0);
      goldRing.rotation.x = Math.PI / 2;
      group.add(goldRing);
      // Mezzanine balcony (walkable) with a glass railing and a ramp up to it
      const mezzanine = mesh(new THREE.RingGeometry(radius * 0.72, radius - 0.3, 64, 1, Math.PI * 0.75, Math.PI * 1.5), wood, 0, h * 0.5, 0);
      mezzanine.rotation.x = -Math.PI / 2;
      group.add(mezzanine);
      const balconyEdge = mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.6, 64, 1, true, Math.PI * 0.75 + Math.PI / 2, Math.PI * 1.5), material('#5d3a1a', { side: THREE.DoubleSide }), 0, h * 0.5 - 0.3, 0);
      group.add(balconyEdge);
      const railing = mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 1.1, 64, 1, true, Math.PI * 0.75 + Math.PI / 2, Math.PI * 1.5), material('#cfe8ff', { transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, h * 0.5 + 0.55, 0);
      railing.castShadow = false;
      group.add(railing);
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const angle = Math.PI * 0.62 - (i / steps) * 0.9;
        group.add(box(3, 0.3, 1.6, wood, Math.cos(angle) * (radius - 2.2), (h * 0.5 * (i + 1)) / steps - 0.15, Math.sin(angle) * (radius - 2.2)));
        group.children[group.children.length - 1].rotation.y = -angle;
      }
      // Central glass tube with falling water and the welcome ring sign
      const tube = cylinder(3.2, 3.2, h - 0.3, material('#cfe8ff', { transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide }), 0, h / 2, 0, 32);
      tube.castShadow = false;
      group.add(tube);
      const rainTexture = PropKit.kit.canvasTexture('hallRain', 128, 256, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 29) % cw, (i * 53) % ch, 2, 18 + (i % 4) * 6);
      });
      const rainMap = repeated(rainTexture, 4, 2);
      const rain = cylinder(2.9, 2.9, h - 0.4, new THREE.MeshBasicMaterial({ map: rainMap, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, h / 2, 0, 24);
      rain.castShadow = false;
      group.add(rain);
      animate(rain, (time) => { rainMap.offset.y = time * 1.2; });
      group.add(cylinder(3.6, 3.8, 0.6, glow('#ffb703', 0.4), 0, 0.4, 0, 32));
      const signTexture = PropKit.kit.canvasTexture(`welcomeRing|${label}`, 2048, 128, (ctx, cw, ch) => {
        ctx.fillStyle = '#1b1208';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 84px Segoe UI, Arial, sans-serif';
        ctx.textBaseline = 'middle';
        const text = `${label || 'Welcome to GitHub Multiverse'}   ✦   `;
        ctx.fillText(text + text, 0, ch / 2);
      });
      // Readable from outside (front faces) and from inside (back faces with a mirrored texture)
      const ringSign = new THREE.Group();
      ringSign.add(mesh(new THREE.CylinderGeometry(3.7, 3.7, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.FrontSide })));
      const mirrored = signTexture.clone();
      mirrored.needsUpdate = true;
      mirrored.wrapS = THREE.RepeatWrapping;
      mirrored.repeat.x = -1;
      ringSign.add(mesh(new THREE.CylinderGeometry(3.68, 3.68, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ map: mirrored, side: THREE.BackSide })));
      ringSign.position.y = h * 0.55;
      group.add(ringSign);
      animate(ringSign, (time) => { ringSign.rotation.y = time * 0.25; });
      // Hanging lamps, cafe tables with chairs and laptops, rugs and plants
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const lamp = new THREE.Group();
        lamp.add(cylinder(0.05, 0.05, 3, material('#333'), 0, 1.5, 0, 4));
        lamp.add(cylinder(0.9, 1.1, 0.5, material('#2b2d42'), 0, 0, 0, 16));
        lamp.add(cylinder(0.85, 0.85, 0.1, glow('#ffd166', 1.5), 0, -0.25, 0, 16));
        lamp.position.set(Math.cos(angle) * radius * 0.6, h - 3, Math.sin(angle) * radius * 0.6);
        group.add(lamp);
      }
      const rugMaterial = material('#7a1f2b', { roughness: 1 });
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI * 0.95 + i * (Math.PI * 1.1 / 3);
        const x = Math.cos(angle) * radius * 0.55;
        const z = Math.sin(angle) * radius * 0.55;
        group.add(box(6, 0.04, 4, rugMaterial, x, 0.32, z));
        group.add(cylinder(1, 1, 0.08, material('#7d8597', { metalness: 0.5 }), x, 1.25, z, 20));
        group.add(cylinder(0.08, 0.15, 0.9, material('#555'), x, 0.8, z, 8));
        group.add(PropKit.kit.laptop(x, 1.29, z + 0.2, 0));
        [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]].forEach(([dx, dz]) => {
          const chair = new THREE.Group();
          chair.add(box(0.7, 0.1, 0.7, material('#8fa3bf'), 0, 0.75, 0));
          chair.add(box(0.7, 0.8, 0.1, material('#8fa3bf'), 0, 1.15, -0.3));
          chair.add(cylinder(0.05, 0.05, 0.5, material('#555'), 0, 0.45, 0, 6));
          chair.position.set(x + dx, 0, z + dz);
          chair.rotation.y = Math.atan2(-dx, -dz);
          group.add(PropKit.kit.interactive(chair, 'sit', 'Chair'));
        });
        group.add(sphere(0.6, material('#2f9e44'), x + 3.5, 1.2, z, 10));
        group.add(cylinder(0.4, 0.3, 0.8, material('#e9d8b4'), x + 3.5, 0.6, z, 10));
      }
    },

    // Curved wall of event cards: each card jumps into a World
    eventsWall(group, { w, h, label }) {
      const radius = w / 2;
      const worlds = (window.MULTIVERSE_WORLDS || []).filter((world) => world.world);
      const count = Math.max(worlds.length, 1);
      const arc = Math.PI * 0.7;
      group.add(mesh(new THREE.CylinderGeometry(radius + 0.4, radius + 0.4, h + 1, 48, 1, true, -arc / 2 - 0.08 + Math.PI, arc + 0.16), material('#2a1450', { side: THREE.DoubleSide }), 0, h / 2, 0));
      worlds.forEach((world, index) => {
        const angle = Math.PI - arc / 2 + (index + 0.5) * (arc / count);
        const card = box(4.2, 5.2, 0.2, new THREE.MeshBasicMaterial({ map: eventCardTexture(world) }), Math.sin(angle) * radius, h / 2, Math.cos(angle) * radius);
        card.rotation.y = angle + Math.PI;
        card.userData.label = `${world.name} — JUMP IN`;
        group.add(PropKit.kit.interactive(card, 'jump', world.key));
      });
      const title = textSprite(label || 'Events & Worlds', { width: 14, background: 'rgba(24, 119, 242, 0.9)' });
      title.position.set(0, h + 2.5, -radius);
      group.add(title);
    },

    glowRing(group, { w, color }) {
      [0, 1.4].forEach((offset, index) => {
        const ring = mesh(new THREE.TorusGeometry(w / 2 - offset, 0.12, 6, 96), glow(color || '#ffb703', 1.8), 0, 0.08, 0);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = false;
        group.add(ring);
        animate(ring, (time) => { ring.material.emissiveIntensity = 1.4 + Math.sin(time * 2 + index) * 0.5; });
      });
    },

    // Announcement kiosk with a big screen and purple hexagon glow panels
    announcementKiosk(group, { w, h, label }) {
      const frame = material('#3a3f4b', { metalness: 0.5 });
      [-1, 1].forEach((side) => group.add(box(0.4, h, 0.4, frame, side * (w / 2 - 0.2), 0, 0)));
      const screenTexture = PropKit.kit.canvasTexture(`announce|${label}`, 512, 384, (ctx, cw, ch) => {
        ctx.fillStyle = '#2a1450';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#1877f2';
        ctx.beginPath(); ctx.arc(cw / 2, 70, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.fillText('GM', cw / 2, 84);
        ctx.fillStyle = '#ffb3c7';
        ctx.font = 'bold 40px Segoe UI, Arial';
        (label || 'Get ready for the next Supply Drop!').split('|').forEach((line, index) => ctx.fillText(line, cw / 2, 170 + index * 52));
      });
      group.add(box(w, h * 0.42, 0.3, new THREE.MeshBasicMaterial({ map: screenTexture }), 0, h * 0.28, 0));
      group.add(box(w + 0.3, h * 0.46, 0.2, frame, 0, h * 0.28, -0.12));
      const hexTexture = PropKit.kit.canvasTexture('hexes', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#1a0b30';
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = '#c86bff';
        ctx.lineWidth = 3;
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 5; col++) {
            const cx = col * 52 + (row % 2) * 26 + 10;
            const cy = row * 45 + 10;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); }
            ctx.closePath();
            ctx.stroke();
          }
        }
      });
      group.add(box(w * 0.9, h * 0.35, 0.2, new THREE.MeshStandardMaterial({ map: hexTexture, emissiveMap: hexTexture, emissive: '#ffffff', emissiveIntensity: 0.9 }), 0, -h * 0.2, 0));
    },

    // Pond with lily pads (sit on them), cattails, a wooden bridge and fishing spots
    pond(group, { w, h, d, color }) {
      const water = mesh(new THREE.CylinderGeometry(1, 1, h, 48), material(color || '#3fb6c6', { transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }), 0, 0, 0);
      water.scale.set(w / 2, 1, d / 2);
      water.castShadow = false;
      group.add(water);
      const curb = mesh(new THREE.TorusGeometry(1, 0.06, 8, 48), texturedMaterial(stuccoTexture('#d9b38c'), 8, 1), 0, h / 2, 0);
      curb.scale.set(w / 2, d / 2, 8);
      curb.rotation.x = Math.PI / 2;
      group.add(curb);
      const padMaterial = material('#6ab04c', { roughness: 0.8, side: THREE.DoubleSide });
      [[-0.25, 0.1], [0.1, -0.2], [0.3, 0.2], [-0.05, 0.3], [-0.3, -0.25]].forEach(([px, pz], index) => {
        const pad = mesh(new THREE.CircleGeometry(1.4, 20, 0.3, Math.PI * 2 - 0.6), padMaterial, px * w, h / 2 + 0.05, pz * d);
        pad.rotation.x = -Math.PI / 2;
        group.add(PropKit.kit.interactive(pad, 'sit', 'Lily pad'));
        animate(pad, (time) => { pad.position.y = h / 2 + 0.05 + Math.sin(time + index) * 0.04; });
      });
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 + 0.2;
        const cattail = new THREE.Group();
        cattail.add(cylinder(0.04, 0.05, 2.4, material('#8d9440'), 0, 1.2, 0, 4));
        cattail.add(cylinder(0.12, 0.12, 0.5, material('#7a4b2a'), 0, 2.2, 0, 6));
        cattail.position.set(Math.cos(angle) * w * 0.47, 0, Math.sin(angle) * d * 0.47);
        cattail.rotation.z = (i % 3 - 1) * 0.1;
        group.add(cattail);
      }
      // Arched wooden bridge across the pond
      const bridge = new THREE.Group();
      const wood = texturedMaterial(plankTexture('#a8743f'), 1, 4);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const plank = box(3.2, 0.25, w * 0.95 / 12 + 0.05, wood, 0, Math.sin(t * Math.PI) * 2 + h / 2 + 0.2, -w * 0.475 + t * w * 0.95);
        plank.rotation.x = -Math.cos(t * Math.PI) * 0.25;
        bridge.add(plank);
        [-1.5, 1.5].forEach((x) => bridge.add(cylinder(0.08, 0.08, 1.1, wood, x, Math.sin(t * Math.PI) * 2 + h / 2 + 0.8, -w * 0.475 + t * w * 0.95, 6)));
      }
      bridge.rotation.y = Math.PI / 2;
      group.add(bridge);
      // Fishing spots on the shore
      [[w * 0.5 + 0.8, 0], [-w * 0.5 - 0.8, d * 0.15]].forEach(([x, z]) => {
        const spot = new THREE.Group();
        spot.add(box(1.6, 0.15, 1.6, wood, 0, 0.08, 0));
        const rod = cylinder(0.03, 0.05, 3, material('#5d3a1a'), 0, 1.3, 0, 6);
        rod.rotation.z = x > 0 ? 0.9 : -0.9;
        spot.add(rod);
        spot.add(sphere(0.12, material('#ff6b6b'), x > 0 ? -2.2 : 2.2, 0.15, 0, 8));
        spot.position.set(x, h / 2, z);
        spot.userData.label = 'Fishing spot (E)';
        group.add(PropKit.kit.interactive(spot, 'fish', 'Fishing spot'));
      });
    },

    posterWall(group, { w, h, d, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(roundedSlab(o.w, h, o.d, 0.3, texturedMaterial(brickTexture('#b5533c'), o.w / 3, h / 3)));
      inner.children[0].position.y = -h / 2;
      const posters = [
        ['Hackathon Fridays', '48h of shipping · prizes', ['#ff5f6d', '#6a2fb8']],
        ['Career Mondays', 'Meet hiring teams · 2PM UTC', ['#1877f2', '#0d1b3e']],
        ['Cozy Fishing', 'Relax at the pond (press E)', ['#ffb703', '#fb5607']],
        ['Open Source Sundays', 'Pair on good first issues', ['#2da44e', '#0d4429']]
      ];
      posters.forEach(([title, subtitle, colors], index) => {
        const x = -o.w / 2 + (index + 0.5) * (o.w / posters.length);
        inner.add(box(o.w / posters.length - 1, h * 0.75, 0.1, new THREE.MeshBasicMaterial({ map: posterTexture(title, subtitle, colors) }), x, 0, o.d / 2 + 0.06));
        inner.add(box(o.w / posters.length - 0.7, h * 0.78, 0.06, material('#3e2723'), x, 0, o.d / 2 + 0.02));
      });
      group.add(inner);
    }
  });

  const rules = [
    [/plaza_floor/, 'plazaFloor'], [/^fountain/, 'fountain'], [/theatre/, 'theatre'], [/round_tree/, 'roundTree'],
    [/lamp_post/, 'lampPost'], [/^bench/, 'bench'], [/flower_bed/, 'flowerBed'], [/^shop_/, 'shop'],
    [/neon_tower|aetheria/, 'neonTower'], [/casino|vegas/, 'casino'], [/arch_gate|plaza_gate/, 'archGate'],
    [/plaza_tower/, 'plazaTower'], [/hot_air_balloon/, 'hotAirBalloon'], [/hydrant/, 'hydrant'], [/info_kiosk/, 'infoKiosk'],
    [/welcome_hall/, 'welcomeHall'], [/events_wall/, 'eventsWall'], [/glow_ring/, 'glowRing'], [/announcement_kiosk/, 'announcementKiosk'],
    [/^pond/, 'pond'], [/poster_wall/, 'posterWall']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
