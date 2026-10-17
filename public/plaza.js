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
    // Round cobblestone plaza (no square block), with an optional square hole
    // for the underground entrance pool, a lighter inner circle and four paths
    plazaFloor(group, { w, h, data }) {
      const radius = w / 2;
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      ((data && data.holes) || []).forEach(([hx, hz, size]) => {
        const half = size / 2;
        const hole = new THREE.Path();
        hole.moveTo(hx - half, -(hz - half));
        hole.lineTo(hx + half, -(hz - half));
        hole.lineTo(hx + half, -(hz + half));
        hole.lineTo(hx - half, -(hz + half));
        hole.closePath();
        shape.holes.push(hole);
      });
      const floorTexture = repeated(cobbleTexture('#c98b5a'), 1, 1);
      floorTexture.repeat.set(1 / 6, 1 / 6);
      const top = mesh(new THREE.ShapeGeometry(shape, 64), new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 }), 0, h / 2, 0);
      top.rotation.x = -Math.PI / 2;
      top.castShadow = false;
      group.add(top);
      const curb = mesh(new THREE.CylinderGeometry(radius, radius + 0.6, h + 0.3, 96, 1, true), texturedMaterial(stuccoTexture('#d9b38c'), 40, 1), 0, 0, 0);
      group.add(curb);
      const inner = cylinder(42, 42, 0.06, texturedMaterial(cobbleTexture('#e0b27c'), 14, 14), 0, h / 2 + 0.03, 0, 64);
      inner.castShadow = false;
      group.add(inner);
      const ring = mesh(new THREE.RingGeometry(41.5, 43, 64), material('#8d5524'), 0, h / 2 + 0.07, 0);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      for (let i = 0; i < 4; i++) {
        const path = box(8, 0.05, radius - 43, texturedMaterial(cobbleTexture('#e0b27c'), 2, 8), 0, h / 2 + 0.03, -(43 + (radius - 43) / 2));
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
      const stageScreen = box(radius * 1.1, radius * 0.55, 0.2, new THREE.MeshBasicMaterial({ map: screenTexture }), 0, 1.4 + radius * 0.4, -radius * 0.86);
      inner.add(stageScreen);
      // The stage screen plays the official WWDC keynotes (muted autoplay, click for sound)
      VideoScreens.register(stageScreen, radius * 1.1, radius * 0.55, VideoScreens.youtubeEmbed(['GEZhD3J89ZE', '0TD96VTf0Xs', 'q5D55G7Ejs8', 'GYkq9Rgoj8E', 'RXeOiIDNNek', '0_DjDdfqtUE']));
      const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), material('#b5262b', { roughness: 0.9 }), 60);
      const matrix = new THREE.Matrix4();
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 12; col++) {
          matrix.makeTranslation(-radius * 0.55 + col * (radius * 1.1 / 11), 0.65, radius * 0.05 + row * 1.6 - radius * 0.15);
          seats.setMatrixAt(row * 12 + col, matrix);
          inner.add(PropKit.kit.seat(-radius * 0.55 + col * (radius * 1.1 / 11), 0.8, radius * 0.05 + row * 1.6 - radius * 0.15, 'Theatre seat', Math.PI));
        }
      }
      inner.add(seats);
      // Purple banners on both sides like the reference screenshot
      [-1, 1].forEach((side) => {
        inner.add(box(0.2, 8, 0.2, material('#9e9e9e'), side * radius * 1.05, 4, radius * 0.9));
        inner.add(facedBox(2.4, 5, 0.1, material('#6a2fb8'), new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture('GitHub', { tagline: 'Multiverse', background: '#3d1a78', foreground: '#ffffff', width: 512, height: 1024 }) }), side * radius * 1.05 + side * 1.3, 5, radius * 0.9));
      });
      // Wide front staircase like the Decentraland Theatre, with red flower planters,
      // brass handrails, warm lamps and stage spotlights on the marquee
      const stepMaterial = texturedMaterial(cobbleTexture('#c98b5a'), 6, 1);
      for (let i = 0; i < 5; i++) inner.add(box(radius * 1.2 - i * 0.6, 0.3 * (5 - i), 1.4, stepMaterial, 0, 0.15 * (5 - i), radius + 0.6 + i * 1.4));
      [-1, 1].forEach((side) => {
        inner.add(box(0.12, 0.12, 7, material('#d4a017', { metalness: 0.8, roughness: 0.3 }), side * radius * 0.55, 1.6, radius + 3.4));
        [radius + 1, radius + 6].forEach((z) => {
          inner.add(cylinder(0.9, 0.8, 1, texturedMaterial(stuccoTexture('#e9d8b4'), 2, 1), side * radius * 0.72, 0.5, z, 12));
          for (let f = 0; f < 6; f++) inner.add(sphere(0.3, material(f % 2 ? '#d62828' : '#ff4d6d'), side * radius * 0.72 + Math.cos(f) * 0.45, 1.15, z + Math.sin(f) * 0.45, 8));
        });
        const lamp = new THREE.Group();
        lamp.add(cylinder(0.08, 0.12, 4.5, material('#263238', { metalness: 0.6 }), 0, 2.25, 0, 8));
        lamp.add(sphere(0.35, glow('#fff3c4', 1.2), 0, 4.7, 0, 10));
        lamp.position.set(side * radius * 0.95, 0, radius + 4);
        inner.add(lamp);
        const spot = cylinder(0.3, 0.45, 0.8, material('#212529', { metalness: 0.6 }), side * radius * 0.5, h * 0.62 + 3.2, radius * 1.15, 10);
        spot.rotation.x = 0.8;
        inner.add(spot);
      });
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
    welcomeHall(group, { w, h, label, data }) {
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
      if (data && data.openCenter) tube.raycast = () => {}; // walk through it (underground landing spot)
      group.add(tube);
      const rainTexture = PropKit.kit.canvasTexture('hallRain', 128, 256, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 29) % cw, (i * 53) % ch, 2, 18 + (i % 4) * 6);
      });
      const rainMap = repeated(rainTexture, 4, 2);
      const rain = cylinder(2.9, 2.9, h - 0.4, new THREE.MeshBasicMaterial({ map: rainMap, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, h / 2, 0, 24);
      rain.castShadow = false;
      rain.raycast = () => {};
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

  // --------------------------------------------------------------------------
  // Underground: square pool with submerged doors, water tunnel and the hall
  // --------------------------------------------------------------------------
  Object.assign(builders, {
    // Square pool; its doors slide open when a cursor gets close, revealing a
    // square vertical water tunnel down to the underground hall (main.js runs the fall)
    squarePool(group, { w, data }) {
      const size = w;
      const depth = (data && data.depth) || 60;
      const stone = texturedMaterial(stuccoTexture('#e9d8b4'), 4, 1);
      // Rim around the opening
      [[0, size / 2 + 0.5, size + 2, 1], [0, -size / 2 - 0.5, size + 2, 1], [size / 2 + 0.5, 0, 1, size], [-size / 2 - 0.5, 0, 1, size]].forEach(([x, z, rw, rd]) => group.add(box(rw, 0.5, rd, stone, x, 0.25, z)));
      // Water surface (not solid) and glowing edge
      // Realistic water: reflective surface with animated ripples (normal map),
      // tiled pool walls and caustic light dancing on the submerged doors
      const ripples = PropKit.kit.canvasTexture('poolRipples', 256, 256, (ctx, cw, ch) => {
        // Normal map: soft bumps encoded as RGB slopes
        const image = ctx.createImageData(cw, ch);
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const nx = Math.sin((x / cw) * Math.PI * 6) * 0.5 + Math.sin(((x + y) / cw) * Math.PI * 10) * 0.3;
            const ny = Math.cos((y / ch) * Math.PI * 8) * 0.5 + Math.sin(((x - y) / ch) * Math.PI * 7) * 0.3;
            const index = (y * cw + x) * 4;
            image.data[index] = 128 + nx * 60;
            image.data[index + 1] = 128 + ny * 60;
            image.data[index + 2] = 255;
            image.data[index + 3] = 255;
          }
        }
        ctx.putImageData(image, 0, 0);
      });
      const normalMap = repeated(ripples, size / 6, size / 6);
      const waterMaterial = new THREE.MeshStandardMaterial({ color: '#1fa2c6', transparent: true, opacity: 0.72, roughness: 0.04, metalness: 0.25, normalMap, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.4 });
      const water = box(size, 0.1, size, waterMaterial, 0, -0.25, 0);
      water.castShadow = false;
      water.raycast = () => {};
      group.add(water);
      const tiles = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.gridTexture('#e3f6fb', '#9fd8e6', 8), size / 2, 1), roughness: 0.3 });
      [[0, size / 2, size, 0.1, 0], [0, -size / 2, size, 0.1, 0], [size / 2, 0, size, 0.1, Math.PI / 2], [-size / 2, 0, size, 0.1, Math.PI / 2]].forEach(([x, z, tw, td, rotation]) => {
        const wall = box(tw, 1.3, td, tiles, x, -0.75, z);
        wall.rotation.y = rotation;
        group.add(wall);
      });
      const caustics = PropKit.kit.canvasTexture('poolCaustics', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = 'rgba(190, 240, 255, 0.85)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 26; i++) {
          ctx.beginPath();
          const x = (i * 71) % cw;
          const y = (i * 43) % ch;
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(x + 30, y - 20, x + 50, y + 30, x + 80, y + 5);
          ctx.stroke();
        }
      });
      const causticMap = repeated(caustics, size / 5, size / 5);
      // Two submerged doors that slide apart
      const doorMaterial = new THREE.MeshStandardMaterial({ color: '#3d6f84', metalness: 0.4, roughness: 0.35, emissive: '#bfefff', emissiveMap: causticMap, emissiveIntensity: 0.6 });
      const doors = [-1, 1].map((side) => {
        const door = box(size / 2, 0.3, size, doorMaterial, side * size / 4, -1.4, 0);
        door.userData.side = side;
        group.add(door);
        return door;
      });
      // Square water tunnel walls going down, with streaming bubbles
      const bubbles = PropKit.kit.canvasTexture('tunnelBubbles', 128, 256, (ctx, cw, ch) => {
        ctx.fillStyle = 'rgba(30, 160, 214, 0.55)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 37) % cw, (i * 61) % ch, 1 + (i % 4), 0, Math.PI * 2); ctx.fill(); }
      });
      const bubbleMap = repeated(bubbles, 2, depth / 8);
      const tunnelMaterial = new THREE.MeshBasicMaterial({ map: bubbleMap, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
      [[0, size / 2, size, 0.1], [0, -size / 2, size, 0.1], [size / 2, 0, 0.1, size], [-size / 2, 0, 0.1, size]].forEach(([x, z, tw, td]) => {
        const wall = box(tw, depth, td, tunnelMaterial, x, -1.6 - depth / 2, z);
        wall.castShadow = false;
        wall.raycast = () => {};
        group.add(wall);
      });
      // Light shaft: sunlight entering through the pool water
      const shaft = box(size * 0.85, depth, size * 0.85, new THREE.MeshBasicMaterial({ color: '#bfeaff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -1.6 - depth / 2, 0);
      shaft.raycast = () => {};
      group.add(shaft);
      animate(group, (time) => {
        bubbleMap.offset.y = -time * 0.6;
        normalMap.offset.set(time * 0.03, time * 0.02);
        causticMap.offset.set(Math.sin(time * 0.4) * 0.2, time * 0.05);
        const avatarPosition = typeof avatar !== 'undefined' ? avatar.position : null;
        const center = group.getWorldPosition(new THREE.Vector3());
        const near = avatarPosition && Math.hypot(avatarPosition.x - center.x, avatarPosition.z - center.z) < 10;
        doors.forEach((door) => {
          const target = near ? door.userData.side * (size * 0.75 + 0.5) : door.userData.side * size / 4;
          door.position.x += (target - door.position.x) * 0.06;
        });
        group.userData.doorsOpen = Math.abs(doors[0].position.x) > size * 0.6;
      });
      group.userData.label = 'Underground entrance: step in and fall for 5 seconds';
      // Big floating sign so newcomers (who spawn right in front) find the entrance
      const sign = textSprite('UNDERGROUND · jump into the pool', { width: 11, background: 'rgba(24, 119, 242, 0.92)' });
      sign.position.set(0, 5.5, 0);
      group.add(sign);
      animate(sign, (time) => { sign.position.y = 5.5 + Math.sin(time * 1.6) * 0.25; });
      window.undergroundEntrances = window.undergroundEntrances || [];
      window.undergroundEntrances.push({ group, size, depth });
    },

    // Underground hall under the pool, styled like a Decentraland welcome
    // lounge, fully enclosed: a big round hall with warm plank floors, curved
    // wooden-slat walls and a sloped wooden ceiling whose "skylights" are
    // illuminated painted-sky panels (no real openings). A full UPPER FLOOR
    // (ring mezzanine, reached by stairs with 0.4 m steps or warp pads) holds a
    // reading lounge, a lookout over the glass water column, a small arcade and
    // a gallery express. Keeps the cafe, the elevator back to the surface and
    // the portal (+x) into the ring-shaped Hall of Internet History.
    undergroundHall(group, { w, h, label }) {
      const radius = w / 2;
      const outer = radius + 4; // wall radius
      const gapAngle = 2 * Math.asin(5.5 / outer); // portal opening at +x (angle PI/2)
      // In three.js cylinders, theta 0 points to +z and PI/2 to +x
      const openStart = Math.PI / 2 + gapAngle / 2;
      const openLength = Math.PI * 2 - gapAngle;
      const toXZ = (angle, r) => [Math.sin(angle) * r, Math.cos(angle) * r];
      const decor = new THREE.Group(); // static parts, merged at the end

      // Realistic wood planks (our own canvas): varied boards, grain, seams
      const planks = PropKit.kit.canvasTexture('lounge|planks', 512, 512, (ctx, cw, ch) => {
        const rows = 8;
        const rowH = ch / rows;
        for (let r = 0; r < rows; r++) {
          let x = -((r * 97) % 180);
          while (x < cw) {
            const length = 160 + ((r * 53 + x * 7) % 140);
            const tone = ((r * 31 + Math.abs(x) * 3) % 5) - 2;
            ctx.fillStyle = shade('#a8693a', tone * 0.035);
            ctx.fillRect(x, r * rowH, length, rowH);
            for (let g = 0; g < 7; g++) {
              ctx.strokeStyle = `rgba(60, 30, 10, ${0.08 + (g % 3) * 0.04})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              const gy = r * rowH + 6 + g * (rowH - 12) / 6;
              ctx.moveTo(x, gy);
              ctx.bezierCurveTo(x + length * 0.3, gy + 3, x + length * 0.6, gy - 3, x + length, gy + 1);
              ctx.stroke();
            }
            if ((r + x) % 3 === 0) { ctx.fillStyle = 'rgba(70, 35, 12, 0.35)'; ctx.beginPath(); ctx.ellipse(x + length * 0.6, r * rowH + rowH / 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = 'rgba(30, 15, 5, 0.55)';
            ctx.fillRect(x, r * rowH, 2, rowH);
            x += length;
          }
          ctx.fillStyle = 'rgba(30, 15, 5, 0.5)';
          ctx.fillRect(0, r * rowH, cw, 2);
        }
      });
      const slats = PropKit.kit.canvasTexture('lounge|slats', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#2a170b'; ctx.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = shade('#b9824f', ((i * 3) % 5 - 2) * 0.03);
          ctx.fillRect(i * 32 + 4, 0, 24, ch);
          ctx.fillStyle = 'rgba(80, 40, 10, 0.15)';
          for (let g = 0; g < 5; g++) ctx.fillRect(i * 32 + 6 + g * 4, 0, 1, ch);
        }
      });
      // Painted sky for the fake skylights (unlit, so it reads as daylight)
      const sky = PropKit.kit.canvasTexture('lounge|skypanel', 512, 256, (ctx, cw, ch) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, ch);
        gradient.addColorStop(0, '#8fd0ff'); gradient.addColorStop(1, '#d9f1ff');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 14; i++) {
          const cx = (i * 137) % cw;
          const cy = 30 + (i * 71) % (ch - 60);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          [0, 1, 2, 3].forEach((k) => { ctx.beginPath(); ctx.arc(cx + k * 16, cy + (k % 2) * 6, 14 + (k % 2) * 6, 0, Math.PI * 2); ctx.fill(); });
        }
        ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, cw, ch);
        ctx.fillStyle = '#3a2416'; for (let x = cw / 4; x < cw; x += cw / 4) ctx.fillRect(x - 3, 0, 6, ch);
      });
      const floorWood = new THREE.MeshStandardMaterial({ map: repeated(planks, outer / 4, outer / 4), roughness: 0.55, metalness: 0.02 });
      const upperWood = new THREE.MeshStandardMaterial({ map: repeated(planks, 7, 7), roughness: 0.55, side: THREE.DoubleSide });
      const slatWall = new THREE.MeshStandardMaterial({ map: repeated(slats, 26, 4), roughness: 0.75, side: THREE.DoubleSide });
      const ceilingWood = new THREE.MeshStandardMaterial({ map: repeated(slats, 30, 1), roughness: 0.8, side: THREE.DoubleSide });
      const skyPanel = new THREE.MeshBasicMaterial({ map: repeated(sky, 4, 1), side: THREE.DoubleSide });
      const darkWood = material('#3a2416', { roughness: 0.6 });
      const glass = material('#d7f0ff', { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide });
      const metal = material('#2b2d33', { metalness: 0.7, roughness: 0.4 });

      // Floor and the curved wooden-slat wall (open only toward the history portal)
      group.add(cylinder(outer, outer, 0.3, floorWood, 0, 0.15, 0, 64));
      group.add(mesh(new THREE.CylinderGeometry(outer, outer, h + 3, 64, 1, true, openStart, openLength), slatWall, 0, (h + 3) / 2, 0));
      [-1, 1].forEach((side) => {
        const [x, z] = toXZ(Math.PI / 2 + side * gapAngle / 2, outer);
        decor.add(box(0.8, h + 3, 0.8, darkWood, x, (h + 3) / 2, z));
      });
      decor.add(box(0.8, h + 3 - 6.2, 11.8, darkWood, outer, 6.2 + (h + 3 - 6.2) / 2, 0));

      // Solid sloped ceiling: wooden sectors alternating with illuminated
      // painted-sky skylights (no real openings anywhere)
      const ceilingLow = h + 1;
      const ceilingHigh = h + 3;
      const innerR = 10.4;
      const sectors = 8;
      for (let i = 0; i < sectors; i++) {
        const start = i * (Math.PI * 2 / sectors);
        const step = Math.PI * 2 / sectors;
        group.add(mesh(new THREE.CylinderGeometry(innerR, outer, ceilingHigh - ceilingLow, 12, 1, true, start, step * 0.6), ceilingWood, 0, (ceilingLow + ceilingHigh) / 2, 0));
        const panel = mesh(new THREE.CylinderGeometry(innerR, outer, ceilingHigh - ceilingLow, 8, 1, true, start + step * 0.6, step * 0.4), skyPanel, 0, (ceilingLow + ceilingHigh) / 2, 0);
        panel.castShadow = false;
        group.add(panel);
      }
      // Glulam ribs
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const [x1, z1] = toXZ(angle, outer);
        const [x2, z2] = toXZ(angle, innerR);
        const length = Math.hypot(x2 - x1, z2 - z1, ceilingHigh - ceilingLow);
        const rib = box(0.35, 0.5, length, darkWood, (x1 + x2) / 2, (ceilingLow + ceilingHigh) / 2 - 0.25, (z1 + z2) / 2);
        rib.rotation.set(0, Math.atan2(x2 - x1, z2 - z1), 0);
        rib.rotateX(-Math.atan2(ceilingHigh - ceilingLow, Math.hypot(x2 - x1, z2 - z1)));
        decor.add(rib);
      }
      // Flat wooden ring around the pool shaft (square hole for the jump-in)
      const ring = new THREE.Shape();
      ring.absarc(0, 0, innerR + 0.2, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.moveTo(-7.2, -7.2); hole.lineTo(7.2, -7.2); hole.lineTo(7.2, 7.2); hole.lineTo(-7.2, 7.2); hole.closePath();
      ring.holes.push(hole);
      const roof = mesh(new THREE.ShapeGeometry(ring, 32), ceilingWood, 0, ceilingHigh, 0);
      roof.rotation.x = Math.PI / 2;
      group.add(roof);
      const skylight = box(14.4, 0.2, 14.4, glow('#bfeaff', 1.2), 0, ceilingHigh + 0.1, 0);
      skylight.raycast = () => {};
      group.add(skylight);

      // Central glass column with falling water and the rotating ring sign
      // (the player lands here from the pool: nothing in it blocks walking)
      const tube = cylinder(3.2, 3.2, h, glass, 0, h / 2 + 0.3, 0, 32);
      tube.raycast = () => {};
      tube.castShadow = false;
      group.add(tube);
      const rainTexture = PropKit.kit.canvasTexture('hallRain', 128, 256, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 29) % cw, (i * 53) % ch, 2, 18 + (i % 4) * 6);
      });
      const rainMap = repeated(rainTexture, 4, 2);
      const rain = cylinder(2.9, 2.9, h - 0.4, new THREE.MeshBasicMaterial({ map: rainMap, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: '#bfe9ff' }), 0, h / 2 + 0.3, 0, 24);
      rain.castShadow = false;
      rain.raycast = () => {};
      group.add(rain);
      animate(rain, (time) => { rainMap.offset.y = time * 1.2; });
      const basin = cylinder(3.6, 3.8, 0.2, glow('#4dabf7', 0.5), 0, 0.35, 0, 32);
      basin.castShadow = false;
      group.add(basin);
      const signTexture = PropKit.kit.canvasTexture('loungeRing|multiverse', 2048, 128, (ctx, cw, ch) => {
        ctx.fillStyle = '#1b1208';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#ffb347';
        ctx.font = 'bold 80px Segoe UI, Arial, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ff8c00'; ctx.shadowBlur = 18;
        const text = 'Welcome to the Multiverse   •   ';
        ctx.fillText(text + text, 0, ch / 2);
      });
      const ringSign = new THREE.Group();
      ringSign.add(mesh(new THREE.CylinderGeometry(3.7, 3.7, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.FrontSide })));
      const mirrored = signTexture.clone();
      mirrored.needsUpdate = true;
      mirrored.wrapS = THREE.RepeatWrapping;
      mirrored.repeat.x = -1;
      ringSign.add(mesh(new THREE.CylinderGeometry(3.68, 3.68, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ map: mirrored, side: THREE.BackSide })));
      [-0.66, 0.66].forEach((y) => { const torus = mesh(new THREE.TorusGeometry(3.72, 0.06, 6, 64), glow('#ff9f1c', 1.8), 0, y, 0); torus.rotation.x = Math.PI / 2; ringSign.add(torus); });
      ringSign.traverse((node) => { node.raycast = () => {}; });
      ringSign.position.y = 9.6;
      group.add(ringSign);
      animate(ringSign, (time) => { ringSign.rotation.y = time * 0.25; });

      // ---- Upper floor: a full ring mezzanine (r 14 to the wall) -------------
      const upperY = 6.4;
      const upperIn = 14;
      const stairTop = Math.PI * 1.1; // the stairs arrive here (gap in the railing)
      const stairGap = 0.2;
      // RingGeometry angle phi maps to cylinder theta as phi = theta - PI/2
      const deck = mesh(new THREE.RingGeometry(upperIn, outer - 0.1, 96, 1), upperWood, 0, upperY, 0);
      deck.rotation.x = -Math.PI / 2;
      group.add(deck);
      decor.add(mesh(new THREE.CylinderGeometry(upperIn, upperIn, 0.5, 96, 1, true), darkWood, 0, upperY - 0.25, 0));
      const railing = (start, length) => {
        const pane = mesh(new THREE.CylinderGeometry(upperIn, upperIn, 1.1, 64, 1, true, start, length), glass, 0, upperY + 0.55, 0);
        pane.castShadow = false;
        group.add(pane);
        decor.add(mesh(new THREE.CylinderGeometry(upperIn + 0.06, upperIn + 0.06, 0.08, 64, 1, true, start, length), darkWood, 0, upperY + 1.12, 0));
      };
      railing(stairTop + stairGap, Math.PI * 2 - stairGap * 2);
      // Curved staircase in the atrium: 16 steps of 0.4 m up to the railing gap
      const steps = 16;
      const stairR = 12.6;
      for (let i = 0; i < steps; i++) {
        const angle = stairTop - 0.1 - (steps - i) * 0.072;
        const [x, z] = toXZ(angle, stairR);
        const step = box(1.2, 0.3, 2.4, upperWood, x, (upperY * (i + 1)) / steps - 0.15, z);
        step.rotation.y = angle;
        group.add(step);
        if (i % 2 === 0) {
          const [rx, rz] = toXZ(angle, stairR - 1.25);
          decor.add(box(0.06, 1.0, 0.06, metal, rx, (upperY * (i + 1)) / steps + 0.5, rz));
        }
      }
      const [lx, lz] = toXZ(stairTop, stairR + 0.3);
      const landing = box(2.6, 0.3, 3.2, upperWood, lx, upperY - 0.15, lz);
      landing.rotation.y = stairTop;
      group.add(landing);
      const stairSign = textSprite('Upper floor: reading lounge · lookout · arcade', { width: 7, background: 'rgba(58, 36, 22, 0.92)' });
      const [sx0, sz0] = toXZ(stairTop - 1.25, stairR);
      stairSign.position.set(sx0, 3, sz0);
      group.add(stairSign);
      // Under-floor downlights for the ground floor (instanced)
      const downlights = new THREE.InstancedMesh(new THREE.CircleGeometry(0.35, 12), new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffe0b0', emissiveIntensity: 2, side: THREE.DoubleSide }), 24);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      for (let i = 0; i < 24; i++) {
        const [x, z] = toXZ(i * Math.PI / 12, i % 2 ? 17 : 22);
        m.compose(new THREE.Vector3(x, upperY - 0.02, z), down, new THREE.Vector3(1, 1, 1));
        downlights.setMatrixAt(i, m);
      }
      downlights.raycast = () => {};
      downlights.castShadow = false;
      group.add(downlights);
      // Warp pads between the floors (shortcut next to the stairs)
      const [ux, uz] = toXZ(6.0, 9.5);
      const [bx, bz] = toXZ(6.0, 16.5);
      const warpUp = new THREE.Group();
      warpUp.add(cylinder(0.9, 0.9, 0.1, glow('#ff9f1c', 1), 0, 0.35, 0, 24));
      const upLabel = textSprite('Upper floor (E)', { width: 3.4, background: 'rgba(255, 159, 28, 0.9)' });
      upLabel.position.y = 2.4;
      warpUp.add(upLabel);
      warpUp.position.set(ux, 0, uz);
      warpUp.userData.destination = new THREE.Vector3(bx - ux, upperY + 0.5, bz - uz);
      group.add(PropKit.kit.interactive(warpUp, 'warp', 'Up to the upper floor'));
      const warpDown = new THREE.Group();
      warpDown.add(cylinder(0.9, 0.9, 0.1, glow('#ff9f1c', 1), 0, 0.08, 0, 24));
      warpDown.position.set(bx, upperY, bz);
      warpDown.userData.destination = new THREE.Vector3(ux - bx, 0.5 - upperY, uz - bz);
      group.add(PropKit.kit.interactive(warpDown, 'warp', 'Down to the lounge'));

      // Upper floor: reading lounge (bookshelves, armchairs, lamps, rug)
      const books = PropKit.kit.canvasTexture('lounge|books', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#3a2416'; ctx.fillRect(0, 0, cw, ch);
        const colors = ['#7a1f2b', '#1f4e79', '#2f6b3a', '#c9a227', '#5c3d7a', '#d9cbb3', '#8a5a33'];
        for (let shelf = 0; shelf < 4; shelf++) {
          let x = 6;
          while (x < cw - 10) {
            const bw = 8 + ((x * 7 + shelf * 13) % 9);
            const bh = 44 + ((x * 3 + shelf) % 12);
            ctx.fillStyle = colors[(x + shelf * 3) % colors.length];
            ctx.fillRect(x, shelf * 64 + 60 - bh, bw, bh);
            x += bw + 1;
          }
          ctx.fillStyle = '#24160c'; ctx.fillRect(0, shelf * 64 + 58, cw, 6);
        }
      });
      const bookMaterial = new THREE.MeshStandardMaterial({ map: books, roughness: 0.8 });
      const loungeChair = material('#7a1f2b', { roughness: 0.9 });
      [4.25, 4.55, 4.85, 5.15, 5.45].forEach((angle) => {
        const [x, z] = toXZ(angle, outer - 0.8);
        const shelf = new THREE.Group();
        shelf.add(box(2.6, 3, 0.6, darkWood, 0, 1.5, 0));
        shelf.add(mesh(new THREE.PlaneGeometry(2.4, 2.8), bookMaterial, 0, 1.5, 0.31));
        shelf.position.set(x, upperY, z);
        shelf.rotation.y = angle + Math.PI;
        decor.add(shelf);
      });
      const rugTexture = PropKit.kit.canvasTexture('lounge|rug', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#5c0f1a'; ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = '#8a1c2b'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, cw - 28, ch - 28);
        ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3; ctx.strokeRect(30, 30, cw - 60, ch - 60);
        for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(0,0,0,${(i % 5) * 0.03})`; ctx.fillRect((i * 37) % cw, (i * 71) % ch, 2, 2); }
      });
      const rug = new THREE.MeshStandardMaterial({ map: rugTexture, roughness: 1 });
      const addRug = (x, y, z, angle, rw = 6.5, rd = 5) => {
        const carpet = mesh(new THREE.PlaneGeometry(rw, rd), rug, x, y + 0.01, z);
        carpet.rotation.x = -Math.PI / 2;
        carpet.rotation.z = angle;
        carpet.castShadow = false;
        group.add(carpet);
      };
      {
        const [x, z] = toXZ(4.85, 20);
        addRug(x, upperY, z, 4.85, 7, 5);
        [4.55, 4.75, 4.95, 5.15].forEach((angle, i) => {
          const [cx, cz] = toXZ(angle, i % 2 ? 18.5 : 21.5);
          const chair = new THREE.Group();
          chair.add(box(1.0, 0.45, 0.9, loungeChair, 0, 0.45, 0));
          chair.add(box(1.0, 0.75, 0.22, loungeChair, 0, 0.9, -0.4));
          [-0.45, 0.45].forEach((ax) => chair.add(box(0.14, 0.6, 0.9, loungeChair, ax, 0.6, 0)));
          chair.position.set(cx, upperY, cz);
          chair.rotation.y = Math.atan2(x - cx, z - cz);
          group.add(PropKit.kit.interactive(chair, 'sit', 'Reading armchair'));
        });
        decor.add(cylinder(0.5, 0.5, 0.06, material('#c08a5b'), x, upperY + 0.6, z, 20));
        decor.add(cylinder(0.08, 0.2, 0.6, metal, x, upperY + 0.3, z, 8));
        [4.4, 5.3].forEach((angle) => {
          const [fx, fz] = toXZ(angle, 22.5);
          decor.add(cylinder(0.03, 0.03, 1.8, metal, fx, upperY + 0.9, fz, 6));
          decor.add(cylinder(0.25, 0.35, 0.4, glow('#ffd8a8', 1.4), fx, upperY + 1.9, fz, 12));
        });
      }
      const readingSign = textSprite('Reading Lounge', { width: 4, background: 'rgba(122, 31, 43, 0.92)' });
      const [rsx, rsz] = toXZ(4.85, 24);
      readingSign.position.set(rsx, upperY + 4.2, rsz);
      group.add(readingSign);
      // Lookout over the atrium: benches facing the water column + viewers
      [0.15, 0.75, 5.85].forEach((angle) => {
        const [x, z] = toXZ(angle, 15.6);
        const bench = new THREE.Group();
        bench.add(box(2.4, 0.1, 0.6, material('#8a5a33'), 0, 0.5, 0));
        bench.add(box(2.4, 0.5, 0.08, material('#8a5a33'), 0, 0.8, 0.28));
        [-1, 1].forEach((s) => bench.add(box(0.1, 0.45, 0.5, metal, s * 1.05, 0.25, 0)));
        bench.position.set(x, upperY, z);
        bench.rotation.y = angle + Math.PI;
        group.add(PropKit.kit.interactive(bench, 'sit', 'Lookout bench'));
      });
      [0.45, 6.15].forEach((angle) => {
        const [x, z] = toXZ(angle, 14.6);
        const viewer = new THREE.Group();
        viewer.add(cylinder(0.06, 0.1, 1.1, metal, 0, 0.55, 0, 8));
        viewer.add(box(0.5, 0.25, 0.3, material('#c9a227', { metalness: 0.8, roughness: 0.3 }), 0, 1.2, 0));
        viewer.position.set(x, upperY, z);
        viewer.rotation.y = angle + Math.PI;
        viewer.userData = { label: 'Lookout', info: 'From up here you can follow the water falling through the glass column and the "Welcome to the Multiverse" ring, with the whole lounge below.' };
        group.add(PropKit.kit.interactive(viewer, 'inspect', 'Lookout viewer'));
      });
      const lookoutSign = textSprite('Lookout', { width: 3, background: 'rgba(24, 119, 242, 0.9)' });
      const [lsx, lsz] = toXZ(0.45, 16);
      lookoutSign.position.set(lsx, upperY + 3.2, lsz);
      group.add(lookoutSign);
      // Small arcade: playable cabinets (E plays the snake mini game)
      const arcadeScreen = PropKit.kit.canvasTexture('lounge|arcade', 128, 128, (ctx, cw, ch) => {
        ctx.fillStyle = '#05051a'; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#51cf66'; [[20, 60], [28, 60], [36, 60], [44, 60], [44, 52]].forEach(([x, y]) => ctx.fillRect(x, y, 7, 7));
        ctx.fillStyle = '#ff6b6b'; ctx.fillRect(84, 36, 7, 7);
        ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 14px monospace'; ctx.fillText('INSERT COIN', 18, 110);
      });
      ['#e64980', '#4dabf7', '#fab005', '#7950f2'].forEach((color, i) => {
        const angle = 1.75 + i * 0.16;
        const [x, z] = toXZ(angle, outer - 1.2);
        const cabinet = new THREE.Group();
        cabinet.add(box(0.9, 1.9, 0.8, material(color, { roughness: 0.5 }), 0, 0.95, 0));
        const screen = mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.MeshBasicMaterial({ map: arcadeScreen }), 0, 1.45, 0.41);
        cabinet.add(screen);
        cabinet.add(box(0.8, 0.12, 0.3, material('#212529'), 0, 1.0, 0.5));
        cabinet.add(box(0.9, 0.25, 0.82, glow(color, 1.4), 0, 2.0, 0));
        cabinet.position.set(x, upperY, z);
        cabinet.rotation.y = angle + Math.PI;
        group.add(PropKit.kit.interactive(cabinet, 'arcade', 'Lounge Arcade'));
      });
      const arcadeSign = textSprite('Arcade', { width: 3, background: 'rgba(230, 73, 128, 0.92)' });
      const [asx, asz] = toXZ(1.99, outer - 2);
      arcadeSign.position.set(asx, upperY + 3.4, asz);
      group.add(arcadeSign);
      // Gallery express: warp to the Minimal Art Gallery entrance
      const gallery = new THREE.Group();
      gallery.add(cylinder(0.9, 0.9, 0.1, glow('#e8e6e1', 1.2), 0, 0.08, 0, 24));
      gallery.add(box(1.6, 2.4, 0.15, material('#e8e6e1'), 0, 1.4, -1.1));
      const galleryLabel = textSprite('Gallery express (E)', { width: 4, background: 'rgba(40, 40, 40, 0.9)' });
      galleryLabel.position.y = 3;
      gallery.add(galleryLabel);
      const [gx, gz] = toXZ(Math.PI / 2, 21);
      gallery.position.set(gx, upperY, gz);
      gallery.rotation.y = -Math.PI / 2;
      gallery.userData.destination = new THREE.Vector3(80, 0.6 - upperY, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      group.add(PropKit.kit.interactive(gallery, 'warp', 'Gallery express: Minimal Art Gallery'));

      // ---- Ground floor: rugs, round tables, palms, plants --------------------
      const tableTop = material('#c08a5b', { roughness: 0.4 });
      [4.6, 5.5, 3.9, 0.15].forEach((angle) => {
        const [x, z] = toXZ(angle, angle === 0.15 ? 18.5 : 10);
        addRug(x, 0.3, z, angle);
        decor.add(cylinder(0.8, 0.8, 0.06, tableTop, x, 1.12, z, 24));
        decor.add(cylinder(0.06, 0.3, 0.8, metal, x, 0.7, z, 10));
        [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]].forEach(([dx, dz]) => {
          const chair = new THREE.Group();
          chair.add(box(0.55, 0.08, 0.55, material('#8a5a33'), 0, 0.75, 0));
          chair.add(box(0.55, 0.6, 0.06, material('#8a5a33'), 0, 1.08, -0.25));
          chair.add(cylinder(0.04, 0.04, 0.45, metal, 0, 0.5, 0, 6));
          chair.position.set(x + dx, 0, z + dz);
          chair.rotation.y = Math.atan2(-dx, -dz);
          group.add(PropKit.kit.interactive(chair, 'sit', 'Lounge chair'));
        });
      });
      // Sofas around the wall under the upper floor
      [2.6, 3.3, 5.0, 5.7].forEach((angle) => {
        const [x, z] = toXZ(angle, outer - 1.4);
        const sofa = new THREE.Group();
        sofa.add(box(3.2, 0.45, 1.0, loungeChair, 0, 0.55, 0));
        sofa.add(box(3.2, 0.8, 0.25, loungeChair, 0, 1.0, -0.45));
        sofa.position.set(x, 0, z);
        sofa.rotation.y = angle + Math.PI;
        group.add(PropKit.kit.interactive(sofa, 'sit', 'Sofa'));
      });

      // Orange spotlight cans hanging on cables in the atrium (instanced)
      const spots = [];
      for (let i = 0; i < 12; i++) spots.push(toXZ(i * (Math.PI * 2 / 12) + 0.2, i % 2 ? 6.5 : 9.5));
      const cans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.4, 0.7, 12), new THREE.MeshStandardMaterial({ color: '#e8590c', metalness: 0.5, roughness: 0.4 }), spots.length);
      const cables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 4), new THREE.MeshStandardMaterial({ color: '#111111' }), spots.length);
      const lenses = new THREE.InstancedMesh(new THREE.CircleGeometry(0.33, 12), new THREE.MeshStandardMaterial({ color: '#ffd8a8', emissive: '#ffb347', emissiveIntensity: 2.2, side: THREE.DoubleSide }), spots.length);
      const beams = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), spots.length);
      spots.forEach(([x, z], i) => {
        const canY = 10 + (i % 3) * 0.7;
        const cableLength = ceilingHigh - canY;
        m.compose(new THREE.Vector3(x, canY + cableLength / 2, z), q.identity(), new THREE.Vector3(1, cableLength, 1));
        cables.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(x, canY, z), q.identity(), new THREE.Vector3(1, 1, 1));
        cans.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(x, canY - 0.36, z), down, new THREE.Vector3(1, 1, 1));
        lenses.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(x, canY - 3.4, z), q.identity(), new THREE.Vector3(1, 1, 1));
        beams.setMatrixAt(i, m);
      });
      [cans, cables, lenses, beams].forEach((instanced) => { instanced.raycast = () => {}; instanced.castShadow = false; group.add(instanced); });

      // Potted plants on both floors (instanced) and palm trees in the atrium
      const plantSpots = [];
      for (let i = 0; i < 14; i++) plantSpots.push([...toXZ(Math.PI / 2 + gapAngle / 2 + 0.2 + i * ((Math.PI * 2 - gapAngle - 0.4) / 13), outer - 1), 0]);
      for (let i = 0; i < 10; i++) plantSpots.push([...toXZ(0.9 + i * 0.5, outer - 1), upperY]);
      const pots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.38, 0.8, 12), new THREE.MeshStandardMaterial({ color: '#d9cbb3', roughness: 0.8 }), plantSpots.length);
      const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: '#2f9e44', roughness: 0.9, flatShading: true }), plantSpots.length);
      plantSpots.forEach(([x, z, y], i) => {
        m.makeTranslation(x, y + 0.7, z); pots.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(x, y + 1.5, z), q.identity(), new THREE.Vector3(1, 1.2 + (i % 3) * 0.2, 1)); leaves.setMatrixAt(i, m);
      });
      group.add(pots, leaves);
      const trunk = material('#8d6e4a', { roughness: 0.9 });
      const frond = material('#2b8a3e', { roughness: 0.8, side: THREE.DoubleSide });
      [0.3, 2.6, 3.4, 5.0].forEach((angle) => {
        const [x, z] = toXZ(angle, 7.5);
        const palm = new THREE.Group();
        palm.add(cylinder(0.7, 0.6, 0.7, material('#5c4033'), 0, 0.65, 0, 14));
        for (let s = 0; s < 6; s++) palm.add(cylinder(0.16 - s * 0.012, 0.19 - s * 0.012, 0.9, trunk, s * 0.06, 1.4 + s * 0.85, 0, 8));
        for (let f = 0; f < 7; f++) {
          const leaf = mesh(new THREE.PlaneGeometry(0.7, 2.6), frond, 0, 0, 0);
          leaf.position.set(0.3 + Math.cos(f / 7 * Math.PI * 2) * 1.0, 6.2, Math.sin(f / 7 * Math.PI * 2) * 1.0);
          leaf.rotation.set(-Math.PI / 2 + 0.5, -f / 7 * Math.PI * 2 + Math.PI / 2, 0, 'YXZ');
          leaf.castShadow = false;
          palm.add(leaf);
        }
        palm.position.set(x, 0, z);
        decor.add(palm);
      });

      // Signage toward the history portal
      const portalSign = textSprite('Hall of Internet History  >  Art Gallery · Gig Plaza', { width: 9, background: 'rgba(58, 36, 22, 0.92)' });
      portalSign.position.set(outer - 6, 4.6, 0);
      group.add(portalSign);

      // Underground cafe: curved counter with stools, espresso machine, menu board
      const counterWood = new THREE.MeshStandardMaterial({ map: repeated(plankTexture('#6b3f22'), 6, 1), side: THREE.DoubleSide });
      const counter = mesh(new THREE.CylinderGeometry(6, 6, 1.2, 32, 1, true, Math.PI * 0.15, Math.PI * 0.7), counterWood, radius * 0.45, 0.9, radius * 0.3);
      group.add(counter);
      group.add(PropKit.kit.interactive(box(0.7, 0.8, 0.5, material('#495057', { metalness: 0.7 }), radius * 0.45 + 2, 1.9, radius * 0.3 - 4.5), 'coffee', 'Underground Cafe espresso'));
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI * 0.2 + i * (Math.PI * 0.6 / 5);
        const stool = new THREE.Group();
        stool.add(cylinder(0.35, 0.35, 0.12, material('#212529'), 0, 0.9, 0, 16));
        stool.add(cylinder(0.05, 0.05, 0.9, material('#868e96', { metalness: 0.8 }), 0, 0.45, 0, 6));
        stool.position.set(radius * 0.45 + Math.cos(angle) * 7.2, 0.3, radius * 0.3 + Math.sin(angle) * 7.2);
        group.add(PropKit.kit.interactive(stool, 'sit', 'Cafe stool'));
      }
      const menu = facedBox(5, 2.4, 0.15, material('#2b1b12'), new THREE.MeshBasicMaterial({ map: labelTexture('UNDERGROUND CAFE · espresso · cold brew · git pull-over', { bg: '#2b1b12', fg: '#ffd166', font: 'bold 40px Georgia, serif' }) }), radius * 0.45 + 3, 4, radius * 0.3 - 6.5);
      group.add(PropKit.kit.interactive(menu, 'cafe_menu', 'Underground Cafe menu'));
      const orderSign = textSprite('Order here (E) · dishes are code packages', { width: 6, background: 'rgba(43, 27, 18, 0.9)' });
      orderSign.position.set(radius * 0.45 + 3, 5.5, radius * 0.3 - 6.3);
      group.add(orderSign);
      // Elevator back to Genesis Plaza
      const elevator = new THREE.Group();
      elevator.add(cylinder(1.6, 1.6, 0.3, glow('#1877f2', 0.8), 0, 0.45, 0, 24));
      elevator.add(mesh(new THREE.CylinderGeometry(1.7, 1.7, 4, 24, 1, true), material('#cfe8ff', { transparent: true, opacity: 0.25, side: THREE.DoubleSide }), 0, 2.4, 0));
      const caption = textSprite('Elevator · back to the surface (E)', { width: 6, background: 'rgba(24, 119, 242, 0.9)' });
      caption.position.y = 5.2;
      elevator.add(caption);
      elevator.position.set(-radius * 0.6, 0, -radius * 0.45);
      group.add(PropKit.kit.interactive(elevator, 'jump', 'plaza'));

      // Visitors (cheap decorative figures, see museum.js)
      if (window.MuseumVisitors) {
        window.MuseumVisitors(group, [
          [...toXZ(1.3, 9), 0, 4.0], [...toXZ(1.45, 9.6), 0, 3.6], [...toXZ(4.3, 5), 0, 1.2], [...toXZ(0.9, 15), 0, 4.5],
          [...toXZ(3.0, 20), 0, 0.3], [...toXZ(5.9, 20), upperY, 2.8], [...toXZ(0.3, 15.2), upperY, 3.4], [...toXZ(4.9, 23), upperY, 1.7],
          [...toXZ(1.85, 22.6), upperY, 1.85], [...toXZ(2.05, 22.8), upperY, 2.05], [...toXZ(3.6, 19), upperY, 0.4]
        ]);
      }

      group.add(PropKit.kit.mergeByMaterial(decor));
      group.userData.label = label || 'Welcome to the Underground';
    },

    // Firepit: circular fire surrounded by concentric rings of benches
    firepit(group, { w }) {
      const radius = w / 2;
      group.add(realCampfire());
      // Fry your Code: roast your code block over the fire to hunt bugs
      const roastSpot = new THREE.Object3D();
      roastSpot.position.set(0, 1, 3.2);
      group.add(PropKit.kit.interactive(roastSpot, 'roast', 'Fry your Code'));
      const roastSign = textSprite('Fry your Code (E)', { width: 5, background: 'rgba(201, 42, 42, 0.9)' });
      roastSign.position.set(0, 4.6, 0);
      group.add(roastSign);
      window.firepits = window.firepits || [];
      window.firepits.push(group);
      [radius * 0.45, radius * 0.75].forEach((ringRadius, ringIndex) => {
        const count = ringIndex ? 12 : 8;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + ringIndex * 0.2;
          const bench = new THREE.Group();
          const wood = texturedMaterial(plankTexture('#a8743f'), 1, 1);
          bench.add(box(2.6, 0.2, 0.8, wood, 0, 0.5 + ringIndex * 0.4, 0));
          bench.add(box(2.6, 0.5 + ringIndex * 0.4, 0.6, material('#8d5524'), 0, (0.5 + ringIndex * 0.4) / 2, 0));
          bench.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
          bench.rotation.y = -angle + Math.PI / 2;
          group.add(PropKit.kit.interactive(bench, 'sit', 'Firepit bench'));
        }
      });
      group.userData.label = 'The Firepit: sit around the fire and chat';
    },

    // Modular mini-game arena: floating blocks, jump pads and a goal ring
    miniGameArena(group, { w }) {
      const radius = w / 2;
      group.add(cylinder(radius, radius, 0.4, texturedMaterial(cobbleTexture('#7a5cff'), 10, 10), 0, 0.2, 0, 48));
      { const added = mesh(new THREE.TorusGeometry(radius, 0.3, 8, 64), glow('#9775fa', 1.4), 0, 0.5, 0); added.rotation.x = Math.PI / 2; group.add(added); }
      const colors = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const height = 1 + (i % 5) * 1.4;
        group.add(box(3, 0.8, 3, material(colors[i % colors.length], { roughness: 0.5 }), Math.cos(angle) * radius * 0.6, height, Math.sin(angle) * radius * 0.6));
      }
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const pad = cylinder(1.4, 1.4, 0.25, glow('#40c057', 1.2), Math.cos(angle) * radius * 0.3, 0.55, Math.sin(angle) * radius * 0.3, 20);
        group.add(pad);
        window.jumpPads = window.jumpPads || [];
        window.jumpPads.push(pad);
        animate(pad, (time) => { pad.material.emissiveIntensity = 0.8 + Math.abs(Math.sin(time * 4 + i)) * 1.2; });
      }
      const goal = mesh(new THREE.TorusGeometry(2.5, 0.3, 10, 32), glow('#ffd43b', 1.6), 0, 12, 0);
      group.add(goal);
      animate(goal, (time) => { goal.rotation.y = time; });
      const sign = textSprite('Mini-Game Arena · jump pads & floating blocks', { width: 14, background: 'rgba(119, 76, 255, 0.9)' });
      sign.position.y = 16;
      group.add(sign);
    },

    // Teleport portal: walk through the arch to jump into a World
    teleportPortal(group, { w, h, color, label, data, block }) {
      const facing = Math.atan2(-block.position[0], -block.position[2]);
      const inner = new THREE.Group();
      inner.rotation.y = facing;
      const stone = texturedMaterial(stuccoTexture('#e9d8b4'), 2, 2);
      inner.add(mesh(new THREE.TorusGeometry(w / 2, 0.6, 12, 40, Math.PI), stone, 0, 0.3, 0));
      const energy = mesh(new THREE.CircleGeometry(w / 2 - 0.6, 40, 0, Math.PI), new THREE.MeshBasicMaterial({ color: color || '#4dabf7', transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0, 0.3, 0);
      energy.raycast = () => {};
      inner.add(energy);
      animate(energy, (time) => { energy.material.opacity = 0.4 + Math.sin(time * 3) * 0.15; });
      const sign = textSprite(label || 'Portal', { width: 9, background: 'rgba(24, 119, 242, 0.9)' });
      sign.position.y = w / 2 + 2.2;
      inner.add(sign);
      group.add(inner);
      window.teleportPortals = window.teleportPortals || [];
      window.teleportPortals.push({ group, target: (data && data.target) || 'plaza', radius: w / 2 });
    },

    // Metro station: roundel sign, platform and a map kiosk (E opens the transit map)
    metroStation(group, { w, label }) {
      group.add(box(w, 0.4, 4, texturedMaterial(cobbleTexture('#b0a08a'), 4, 1), 0, 0.2, 0));
      group.add(box(w, 0.1, 0.4, material('#ffd43b'), 0, 0.42, 1.8));
      group.add(cylinder(0.12, 0.12, 4.5, material('#495057', { metalness: 0.6 }), -w / 2 + 1, 2.25, -1.4, 8));
      const roundel = new THREE.Group();
      roundel.add(mesh(new THREE.TorusGeometry(1, 0.28, 10, 32), material('#e03131')));
      roundel.add(facedBox(2.8, 0.55, 0.1, material('#1877f2'), new THREE.MeshBasicMaterial({ map: labelTexture('METRO', { bg: '#1877f2', fg: '#ffffff', width: 256, height: 64, font: 'bold 44px Segoe UI, Arial' }) }), 0, 0, 0.15));
      roundel.position.set(-w / 2 + 1, 4.6, -1.4);
      group.add(roundel);
      const kiosk = new THREE.Group();
      kiosk.add(box(2.2, 2.6, 0.3, material('#0d1b3e'), 0, 1.7, 0));
      kiosk.add(box(1.9, 2.2, 0.05, new THREE.MeshBasicMaterial({ map: labelTexture('Transit map · press E', { bg: '#ffffff', fg: '#0d1b3e', width: 256, height: 300, font: 'bold 30px Segoe UI, Arial' }) }), 0, 1.75, 0.18));
      kiosk.position.set(w / 2 - 1.5, 0.4, -1);
      group.add(PropKit.kit.interactive(kiosk, 'metro', label || 'Metro station'));
    },

    // Panoramic upper platform reachable by elevator, with Hall of Fame and Newsroom
    skyPlatform(group, { w, h }) {
      const radius = w / 2;
      const deck = cylinder(radius, radius * 0.92, 1, texturedMaterial(plankTexture('#c49a6c'), 10, 10), 0, h, 0, 48);
      group.add(deck);
      group.add(mesh(new THREE.CylinderGeometry(radius, radius, 1.2, 48, 1, true), material('#cfe8ff', { transparent: true, opacity: 0.3, side: THREE.DoubleSide }), 0, h + 1.1, 0));
      [0, 1, 2, 3, 4, 5].forEach((i) => {
        const angle = (i / 6) * Math.PI * 2;
        group.add(cylinder(0.6, 0.8, h, material('#e9d8b4'), Math.cos(angle) * radius * 0.7, h / 2, Math.sin(angle) * radius * 0.7, 12));
      });
      // Elevator shaft with pads at the bottom and at the top
      group.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, h + 4, 24, 1, true), material('#cfe8ff', { transparent: true, opacity: 0.2, side: THREE.DoubleSide }), 0, (h + 4) / 2, -radius - 1));
      const up = cylinder(1.6, 1.6, 0.3, glow('#1877f2', 0.9), 0, 0.15, -radius - 1, 24);
      up.userData.destination = new THREE.Vector3(0, h + 0.6, -radius * 0.6);
      group.add(PropKit.kit.interactive(up, 'warp', 'Elevator up to the Panorama Deck'));
      const down = cylinder(1.4, 1.4, 0.2, glow('#1877f2', 0.9), 0, h + 0.6, -radius * 0.75, 24);
      down.userData.destination = new THREE.Vector3(0, 0.3, -radius - 4);
      group.add(PropKit.kit.interactive(down, 'warp', 'Elevator down to the plaza'));
      // Hall of Fame (top committers) and Newsroom (dev news) boards on the deck
      const fame = TechBoards.board('hallOfFame');
      group.add(box(8, 4.5, 0.3, new THREE.MeshBasicMaterial({ map: fame }), -radius * 0.45, h + 3.3, radius * 0.2));
      group.children[group.children.length - 1].rotation.y = Math.PI / 2.5;
      const news = TechBoards.board('newsroom');
      group.add(box(8, 4.5, 0.3, new THREE.MeshBasicMaterial({ map: news }), radius * 0.45, h + 3.3, radius * 0.2));
      group.children[group.children.length - 1].rotation.y = -Math.PI / 2.5;
      const sign = textSprite('Panorama Deck · Hall of Fame · Newsroom', { width: 14, background: 'rgba(24, 119, 242, 0.9)' });
      sign.position.y = h + 8;
      group.add(sign);
    }
  });

  // Ads shown on the Decentraland-style ad cubes: real developer brands, factual taglines
  const AD_ROTATION = [
    ['GitHub', 'Where the world builds software', '#0d1117', '#ffffff'],
    ['Docker', 'Ship anywhere, run everywhere', '#1d63ed', '#ffffff'],
    ['Vercel', 'Deploy your frontend in seconds', '#000000', '#ffffff'],
    ['Figma', 'Design together, in real time', '#1e1e1e', '#ffffff'],
    ['Node.js', 'JavaScript on the server', '#215732', '#ffffff'],
    ['Rust', 'Fast, reliable, productive', '#2b1a12', '#f74c00'],
    ['TypeScript', 'JavaScript with syntax for types', '#3178c6', '#ffffff'],
    ['Claude', 'Your AI pair programmer', '#d97757', '#ffffff'],
    ['Kubernetes', 'Production-grade orchestration', '#326ce5', '#ffffff'],
    ['Python', 'Programming for everyone', '#1e415e', '#ffd43b'],
    ['Postman', 'Build and test your APIs', '#ff6c37', '#ffffff'],
    ['Stack Overflow', 'Every developer has a tab open', '#1b1b1b', '#f48024']
  ];
  const adTextures = [];
  function adTexture(index) {
    const i = index % AD_ROTATION.length;
    if (!adTextures[i]) {
      const [name, tagline, background, foreground] = AD_ROTATION[i];
      adTextures[i] = BrandLogos.billboardTexture(name, { tagline, background, foreground, width: 768, height: 768 });
    }
    return adTextures[i];
  }

  // Cube with an ad on each side, framed by glowing edges; faces rotate ads
  function adCube(size, frameColor, startIndex) {
    const cube = new THREE.Group();
    const faces = [0, 1, 2, 3].map((side) => new THREE.MeshBasicMaterial({ map: adTexture(startIndex + side) }));
    const dark = material('#111111');
    cube.add(mesh(new THREE.BoxGeometry(size, size, size), [faces[0], faces[1], dark, dark, faces[2], faces[3]]));
    const edge = glow(frameColor, 1.6);
    const t = 0.18;
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => cube.add(box(t, size + t, t, edge, sx * size / 2, 0, sz * size / 2))));
    [-1, 1].forEach((sy) => {
      [-1, 1].forEach((sz) => cube.add(box(size + t, t, t, edge, 0, sy * size / 2, sz * size / 2)));
      [-1, 1].forEach((sx) => cube.add(box(t, t, size + t, edge, sx * size / 2, sy * size / 2, 0)));
    });
    let current = startIndex;
    cube.userData.nextAd = () => { current += 4; faces.forEach((face, side) => { face.map = adTexture(current + side); face.needsUpdate = true; }); };
    return cube;
  }

  Object.assign(builders, {
    // Stack of ad cubes, each one twisted a little (like the ad towers in Decentraland)
    adCubeStack(group, { w, h, color, data }) {
      const count = Math.max(2, Math.round(h / w));
      const frame = color || '#b2f22c';
      const cubes = [];
      for (let i = 0; i < count; i++) {
        const size = w * (1 - i * 0.12);
        const cube = adCube(size, frame, ((data && data.seed) || 0) + i * 4);
        const below = cubes.reduce((sum, c) => sum + c.userData.size, 0);
        cube.userData.size = size;
        cube.position.y = below + size / 2;
        cube.rotation.y = i * 0.35;
        group.add(cube);
        cubes.push(cube);
      }
      let last = 0;
      animate(group, (time) => {
        if (time - last < 8) return;
        last = time;
        cubes.forEach((cube) => cube.userData.nextAd());
      });
      group.userData.label = 'Ad tower: developer brands';
    },

    // Big floating LED cube over a white pedestal with neon stripes and a door
    ledCubeKiosk(group, { w, h, data }) {
      const pedestalHeight = h * 0.28;
      group.add(roundedSlab(w * 0.8, pedestalHeight, w * 0.8, 0.4, material('#f1f3f5', { roughness: 0.4 })));
      group.children[group.children.length - 1].position.y = 0;
      ['#4dabf7', '#da77f2', '#ff8787'].forEach((stripe, i) => {
        const ring = box(w * 0.81, 0.12, w * 0.81, glow(stripe, 1.8), 0, pedestalHeight * (0.25 + i * 0.12), 0);
        ring.castShadow = false;
        group.add(ring);
      });
      group.add(box(1.4, 2.6, 0.1, material('#dee2e6'), w * 0.2, 1.3, w * 0.4 + 0.02));
      const cubeSize = h - pedestalHeight - 1;
      const cube = adCube(cubeSize, '#4cc9f0', (data && data.seed) || 2);
      cube.position.y = pedestalHeight + 0.6 + cubeSize / 2;
      cube.rotation.y = Math.PI / 4;
      group.add(cube);
      // Light cap on top
      group.add(box(cubeSize * 0.9, 0.6, cubeSize * 0.9, material('#e7e3ff', { roughness: 0.3 }), 0, pedestalHeight + 0.6 + cubeSize + 0.6, 0));
      // Neon side bars
      [['#38d9a9', 1], ['#ff6b6b', -1]].forEach(([neon, side]) => group.add(box(0.25, cubeSize * 0.9, 0.25, glow(neon, 2), side * cubeSize * 0.72, pedestalHeight + 0.6 + cubeSize / 2, 0)));
      let last = 0;
      animate(group, (time) => {
        cube.position.y = pedestalHeight + 0.6 + cubeSize / 2 + Math.sin(time * 0.8) * 0.3;
        cube.rotation.y = Math.PI / 4 + Math.sin(time * 0.2) * 0.25;
        if (time - last > 10) { last = time; cube.userData.nextAd(); }
      });
      group.userData.label = 'LED cube: developer ads';
    }
  });

  // Lattice texture (green steel mesh with transparent gaps) for the supertrees
  function latticeTexture() {
    return PropKit.kit.canvasTexture('supertreeLattice', 128, 128, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.strokeStyle = '#2f4a2c';
      ctx.lineWidth = 5;
      for (let i = -cw; i < cw * 2; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + ch, ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, ch); ctx.lineTo(i + ch, 0); ctx.stroke();
      }
      ctx.strokeStyle = '#4f7a49';
      ctx.lineWidth = 2;
      for (let y = 0; y < ch; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
    });
  }

  // A real campfire: stone ring, crossed logs with bark, glowing embers,
  // flickering layered flames (billboards), rising sparks, smoke and warm light
  function flameTexture(core, edge) {
    return PropKit.kit.canvasTexture(`flame|${core}|${edge}`, 128, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createRadialGradient(w / 2, h * 0.78, 4, w / 2, h * 0.62, h * 0.55);
      gradient.addColorStop(0, core);
      gradient.addColorStop(0.35, edge);
      gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.bezierCurveTo(w * 0.95, h * 0.45, w * 1.0, h * 0.85, w / 2, h);
      ctx.bezierCurveTo(0, h * 0.85, w * 0.05, h * 0.45, w / 2, 0);
      ctx.fill();
    });
  }

  function realCampfire() {
    const fire = new THREE.Group();
    // Stone ring
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const stone = mesh(new THREE.DodecahedronGeometry(0.42 + (i % 3) * 0.06, 0), material(['#8d8d8d', '#7a7268', '#9c9690'][i % 3], { roughness: 1, flatShading: true }), Math.cos(angle) * 1.7, 0.25, Math.sin(angle) * 1.7);
      stone.rotation.set(i, i * 2, i * 3);
      stone.scale.y = 0.7;
      fire.add(stone);
    }
    // Ash bed with glowing embers
    fire.add(cylinder(1.4, 1.5, 0.12, material('#3b3330', { roughness: 1 }), 0, 0.08, 0, 24));
    const embers = [];
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.4;
      const ember = sphere(0.12 + (i % 3) * 0.04, glow('#ff6a00', 2), Math.cos(angle) * (0.3 + (i % 4) * 0.25), 0.18, Math.sin(angle) * (0.3 + (i % 4) * 0.25), 6);
      ember.castShadow = false;
      fire.add(ember);
      embers.push(ember);
    }
    // Crossed logs with bark and bright cut ends
    const bark = material('#5d4037', { roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const log = cylinder(0.16, 0.2, 1.9, bark, 0, 0.45, 0, 8);
      log.rotation.set(Math.PI / 2 - 0.55, (i / 5) * Math.PI * 2, 0);
      log.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.35, 0.5, Math.sin((i / 5) * Math.PI * 2) * 0.35);
      fire.add(log);
    }
    // Layered flame billboards
    const flames = [];
    [['#fff7d6', '#ffb100', 1.6, 2.6], ['#ffe066', '#ff6a00', 1.3, 2.1], ['#ffd8a8', '#ff3d00', 1.0, 1.6], ['#ffffff', '#ffd43b', 0.6, 1.1]].forEach(([core, edge, width, height], i) => {
      for (let k = 0; k < 2; k++) {
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(core, edge), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        flame.scale.set(width, height, 1);
        flame.position.set((k - 0.5) * 0.35 * (i % 2 ? 1 : -1), height / 2 + 0.2, (k - 0.5) * 0.2);
        flame.userData.base = { width, height, phase: i * 1.7 + k * 0.9 };
        fire.add(flame);
        flames.push(flame);
      }
    });
    // Sparks and smoke
    const sparks = [];
    for (let i = 0; i < 18; i++) {
      const spark = sphere(0.05, glow('#ffd43b', 3), 0, 1, 0, 4);
      spark.castShadow = false;
      spark.userData.phase = i / 18;
      fire.add(spark);
      sparks.push(spark);
    }
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#9a9a9a', transparent: true, opacity: 0.25, depthWrite: false }));
      puff.userData.phase = i / 6;
      fire.add(puff);
      smoke.push(puff);
    }
    fire.traverse((node) => { if (node.isSprite) node.raycast = () => {}; });
    animate(fire, (time) => {
      flames.forEach((flame) => {
        const { width, height, phase } = flame.userData.base;
        const flicker = 0.85 + Math.sin(time * 11 + phase) * 0.1 + Math.sin(time * 23 + phase * 2) * 0.06;
        flame.scale.set(width * (0.9 + Math.sin(time * 7 + phase) * 0.08), height * flicker, 1);
        flame.position.y = (height * flicker) / 2 + 0.2;
      });
      embers.forEach((ember, i) => { ember.material.emissiveIntensity = 1.4 + Math.sin(time * 3 + i) * 0.8; });
      sparks.forEach((spark, i) => {
        const t = (time * 0.45 + spark.userData.phase) % 1;
        spark.position.set(Math.sin(i * 7 + t * 6) * 0.6 * t, 0.8 + t * 5, Math.cos(i * 5 + t * 5) * 0.6 * t);
        spark.visible = t < 0.85;
      });
      smoke.forEach((puff, i) => {
        const t = (time * 0.12 + puff.userData.phase) % 1;
        puff.position.set(Math.sin(time * 0.3 + i) * t * 1.5, 3 + t * 7, Math.cos(time * 0.2 + i) * t);
        puff.scale.setScalar(1 + t * 3);
        puff.material.opacity = 0.22 * (1 - t);
      });
    });
    return fire;
  }

  // Star-shaped floor pad texture (teleport pads of the spawn hub)
  function starPadTexture(color) {
    return PropKit.kit.canvasTexture(`starpad|${color}`, 256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f1f3f5';
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.25); ctx.lineTo(w * 0.9, h * 0.15); ctx.lineTo(w * 0.85, h * 0.85); ctx.lineTo(w * 0.15, h * 0.8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 ? w * 0.13 : w * 0.3;
        const x = w / 2 + Math.cos(angle) * radius;
        const y = h / 2 + Math.sin(angle) * radius;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    });
  }

  Object.assign(builders, {
    // Spawn hub around the square pool, organized like a modern game lobby:
    // low octagonal terraces with blue neon trims and water channels, octagonal
    // tree planters, hedges, star teleport pads and four activity corners
    // (card table, giant Connect Four, gazebo lounge, canopy tents)
    spawnHub(group, { w }) {
      const radius = w / 2;
      const terraceStone = material('#e9ecf2', { roughness: 0.6 });
      const trim = glow('#4dabf7', 1.4);
      const water = material('#4dabf7', { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85, emissive: '#1c7ed6', emissiveIntensity: 0.25 });
      // Octagonal terrace ring with openings towards the spawn (south), the plaza (east) and the path (west)
      const ringRadius = radius * 0.72; // outside the Events Explorer walls
      for (let k = 0; k < 8; k++) {
        const angle = (k * Math.PI) / 4;
        if (k === 0 || k === 2 || k === 4) continue;
        const side = 2 * ringRadius * Math.tan(Math.PI / 8);
        const segment = new THREE.Group();
        segment.add(box(side, 0.5, 3, terraceStone, 0, 0.25, 0));
        segment.add(box(side, 0.08, 0.12, trim, 0, 0.52, -1.5));
        segment.add(box(side, 0.08, 0.12, trim, 0, 0.52, 1.5));
        // Water channel just outside the terrace
        const channel = box(side, 0.1, 1.2, water, 0, 0.08, 2.2);
        channel.raycast = () => {};
        segment.add(channel);
        // Hedge along the terrace
        for (let i = -2; i <= 2; i++) {
          const hedge = sphere(0.7, material('#2f9e44', { roughness: 1, flatShading: true }), i * (side / 5), 1, 0.6, 8);
          hedge.scale.set(1.2, 0.8, 0.9);
          segment.add(hedge);
        }
        segment.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
        segment.rotation.y = -angle - Math.PI / 2;
        group.add(segment);
      }
      // Octagonal raised planters with big trees at the diagonals
      [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].forEach((angle) => {
        const x = Math.cos(angle) * radius * 0.96;
        const z = Math.sin(angle) * radius * 0.96;
        group.add(cylinder(2.6, 2.8, 1, material('#3b5bdb', { roughness: 0.5 }), x, 0.5, z, 8));
        group.add(cylinder(2.7, 2.7, 0.1, trim, x, 1.02, z, 8));
        group.add(cylinder(2.3, 2.3, 0.15, material('#5c940d'), x, 1.05, z, 8));
        group.add(cylinder(0.45, 0.65, 6, material('#6d4c41'), x, 4, z, 10));
        [[0, 7.6, 0, 2.6], [1.4, 6.6, 0.8, 1.8], [-1.3, 6.8, -0.6, 1.9]].forEach(([dx, y, dz, r]) => group.add(mesh(new THREE.IcosahedronGeometry(r, 1), material('#37b24d', { flatShading: true }), x + dx, y, z + dz)));
      });
      // Star teleport pads to the Worlds (E to jump in)
      const worlds = (window.MULTIVERSE_WORLDS || []).filter((world) => world.world).slice(0, 4);
      worlds.forEach((world, index) => {
        const angle = Math.PI * 0.3 + index * 0.13 + (index > 1 ? Math.PI * 0.4 - 0.26 : 0);
        const pad = mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: starPadTexture(world.color || '#1877f2'), transparent: true, roughness: 0.6 }), Math.cos(angle) * radius * 0.5, 0.06, Math.sin(angle) * radius * 0.5);
        pad.rotation.x = -Math.PI / 2;
        pad.receiveShadow = true;
        pad.userData.label = `${world.name} — JUMP IN`;
        group.add(PropKit.kit.interactive(pad, 'jump', world.key));
      });
      // Corner 1 (south-east): green card table with chairs
      const table = new THREE.Group();
      table.add(box(4.4, 0.15, 2, material('#2b8a3e', { roughness: 0.9 }), 0, 0.95, 0));
      table.add(box(4.6, 0.12, 2.2, material('#f1f3f5'), 0, 0.85, 0));
      table.add(box(0.4, 0.8, 1.2, material('#f1f3f5'), 0, 0.4, 0));
      [-1.5, 0, 1.5].forEach((dx) => [-1, 1].forEach((side) => {
        const chair = new THREE.Group();
        chair.add(box(0.8, 0.12, 0.8, material('#8ce99a'), 0, 0.6, 0));
        chair.add(box(0.8, 0.9, 0.12, material('#8ce99a', { transparent: true, opacity: 0.85 }), 0, 1.05, side * 0.4));
        chair.add(box(0.1, 0.6, 0.1, material('#dee2e6'), 0, 0.3, 0));
        chair.position.set(dx, 0, side * 1.6);
        table.add(PropKit.kit.interactive(chair, 'sit', 'Card table chair'));
      }));
      table.position.set(radius * 0.8, 0, radius * 0.46);
      table.rotation.y = -Math.PI / 6;
      group.add(table);
      // Corner 2 (south-west): giant Connect Four
      const game = new THREE.Group();
      const frame = material('#1c7ed6', { roughness: 0.4 });
      game.add(box(5, 0.3, 0.6, frame, 0, 0.15, 0));
      [-2.4, 2.4].forEach((x) => game.add(box(0.3, 4.4, 0.6, frame, x, 2.2, 0)));
      game.add(box(5, 0.3, 0.6, frame, 0, 4.3, 0));
      for (let column = 0; column < 7; column++) {
        for (let row = 0; row < 6; row++) {
          const filled = (column * 3 + row * 5) % 7 < 3 && row < 4 - (column % 3);
          if (!filled) continue;
          const disc = cylinder(0.28, 0.28, 0.3, material((column + row) % 2 ? '#fa5252' : '#fcc419'), -1.95 + column * 0.65, 0.6 + row * 0.62, 0, 16);
          disc.rotation.x = Math.PI / 2;
          game.add(disc);
        }
      }
      game.userData = { label: 'Giant Connect Four', info: 'Line up four discs of your color: a classic for waiting in the lobby with friends.' };
      game.position.set(-radius * 0.32, 0, radius * 0.87);
      game.rotation.y = 0.35;
      group.add(PropKit.kit.interactive(game, 'inspect', 'Giant Connect Four'));
      // Corner 3 (north-east): gazebo lounge with sofas
      const gazebo = new THREE.Group();
      [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => gazebo.add(cylinder(0.12, 0.12, 3.2, material('#5c3d2e'), x, 1.6, z, 8)));
      const roof = mesh(new THREE.ConeGeometry(3.6, 1.6, 4), material('#1c2a5a', { roughness: 0.7 }), 0, 4, 0);
      roof.rotation.y = Math.PI / 4;
      gazebo.add(roof);
      [[-1.2, 0], [1.2, 0]].forEach(([x], i) => {
        const sofa = new THREE.Group();
        sofa.add(box(1.8, 0.5, 1, material('#96f2d7'), 0, 0.35, 0));
        sofa.add(box(1.8, 0.7, 0.25, material('#96f2d7'), 0, 0.8, -0.45));
        sofa.position.set(x, 0, 0);
        sofa.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
        gazebo.add(PropKit.kit.interactive(sofa, 'sit', 'Gazebo sofa'));
      });
      gazebo.add(box(0.8, 0.5, 0.8, material('#ffd43b'), 0, 0.25, 0.9));
      gazebo.position.set(radius * 0.8, 0, -radius * 0.46);
      group.add(gazebo);
      // Corner 4 (north-west): canopy tents (red, white, navy) as little booths
      ['#e03131', '#f8f9fa', '#1c2a5a'].forEach((color, i) => {
        const tent = new THREE.Group();
        tent.add(mesh(new THREE.CylinderGeometry(0.1, 2.4, 1.6, 4, 1), material(color, { roughness: 0.8, side: THREE.DoubleSide }), 0, 3, 0)).children[0].rotation.y = Math.PI / 4;
        [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([x, z]) => tent.add(cylinder(0.06, 0.06, 2.2, material('#495057'), x, 1.1, z, 6)));
        tent.add(box(2.4, 0.9, 0.8, material('#f1f3f5'), 0, 0.45, 1));
        tent.position.set([-23, -24, -21][i], 0, [-11.5, -6, -0.5][i] * (radius / 26) - (i === 2 ? 0 : 0));
        group.add(tent);
      });
      // Game Portal sign
      const portalSign = textSprite('GAME PORTAL · star pads jump to the Worlds', { width: 6, background: 'rgba(43, 138, 62, 0.92)' });
      portalSign.position.set(radius * 0.3, 2.2, radius * 0.48);
      group.add(portalSign);
      group.userData.label = 'Genesis spawn hub';
    }
  });

  const GREEN_TIPS = [
    ['Measure first', 'Profile CPU and energy before optimizing: the biggest wins are rarely where you guess.'],
    ['Cache, don\'t recompute', 'Every repeated computation burns energy. Memoize and cache results.'],
    ['Lazy-load assets', 'Load images and scripts only when they are needed: less data, less power.'],
    ['Pick green regions', 'Run workloads in cloud regions powered by renewable energy.'],
    ['Delete unused data', 'Old logs, backups and buckets keep disks spinning. Clean them up.'],
    ['Dark mode on OLED', 'Dark pixels use less power on OLED screens.']
  ];

  Object.assign(builders, {
    // Multiverse Forest: a garden enclosed by hedges with a giant tree in the
    // middle, a screen counting the trees planted by devs, green-coding boards
    // on posts, flower beds and benches
    forestGarden(group, { w }) {
      const half = w / 2;
      const lawn = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.canvasTexture('forestLawn', 256, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#5f9e3f'; ctx.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 900; i++) { ctx.fillStyle = ['#6aad48', '#558f37', '#73b852'][i % 3]; ctx.fillRect((i * 37) % cw, (i * 91) % ch, 3, 5); }
      }), w / 8, w / 8), roughness: 1 });
      const ground = box(w, 0.25, w, lawn, 0, 0.12, 0);
      ground.castShadow = false;
      group.add(ground);
      // Hedge walls with an opening on each side
      const hedge = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.canvasTexture('hedgeLeaves', 128, 128, (ctx, cw, ch) => {
        ctx.fillStyle = '#2f6b2a'; ctx.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 400; i++) { ctx.fillStyle = ['#3d8035', '#285c24', '#4a9441'][i % 3]; ctx.beginPath(); ctx.arc((i * 29) % cw, (i * 53) % ch, 3 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
      }), 6, 1), roughness: 1 });
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => {
        [-1, 1].forEach((part) => {
          const length = half - 3;
          const x = sx ? sx * half : part * (3 + length / 2);
          const z = sz ? sz * half : part * (3 + length / 2);
          group.add(box(sx ? 1.4 : length, 2, sx ? length : 1.4, hedge, x, 1, z));
        });
      });
      // Giant tree with a dark round base
      const base = cylinder(5, 5, 0.1, material('#2b3a2e', { roughness: 1 }), 0, 0.28, 0, 40);
      base.castShadow = false;
      group.add(base);
      group.add(cylinder(1.1, 1.8, 9, material('#7a4a2b', { roughness: 1 }), 0, 4.6, 0, 10));
      [[2.5, 8, 0.6, 0.9], [-2.2, 7.6, -1, -0.8], [0.4, 8.6, 2.2, 0.3]].forEach(([x, y, z, tilt]) => {
        const branch = cylinder(0.35, 0.55, 5, material('#7a4a2b'), x * 0.6, y, z * 0.6, 8);
        branch.rotation.set(z * 0.25, 0, -tilt);
        group.add(branch);
      });
      [[0, 13, 0, 5], [4, 11.5, 1, 3.5], [-4, 11.8, -1, 3.6], [1, 11, -4, 3.2], [-1, 11, 4, 3.4]].forEach(([x, y, z, r]) => group.add(mesh(new THREE.IcosahedronGeometry(r, 0), material('#3f8f3a', { flatShading: true }), x, y, z)));
      // Screen counting the trees planted by devs
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 320;
      const texture = new THREE.CanvasTexture(canvas);
      const screen = box(6, 3.8, 0.2, [material('#111'), material('#111'), material('#111'), material('#111'), new THREE.MeshBasicMaterial({ map: texture }), material('#111')], 0, 4.6, 2.4);
      group.add(screen);
      const drawScreen = () => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f1a14'; ctx.fillRect(0, 0, 512, 320);
        ctx.fillStyle = '#f8f9fa'; ctx.fillRect(60, 40, 392, 150);
        ctx.fillStyle = '#2b8a3e'; ctx.font = 'bold 30px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('MULTIVERSE FOREST', 256, 85);
        ctx.fillStyle = '#1d1d1f'; ctx.font = 'bold 56px Segoe UI, Arial, sans-serif';
        ctx.fillText(`${window.multiverseTreeCount || 0} trees`, 256, 150);
        ctx.fillStyle = '#c3fae8'; ctx.font = '22px Segoe UI, Arial, sans-serif';
        ctx.fillText('planted by devs in the Green-Tech Sandbox', 256, 240);
        ctx.fillText('Plant yours: /world greentech then /plant', 256, 275);
        texture.needsUpdate = true;
      };
      drawScreen();
      setInterval(drawScreen, 5000);
      // Green-coding boards on posts around the garden
      GREEN_TIPS.forEach(([title, info], index) => {
        const angle = (index / GREEN_TIPS.length) * Math.PI * 2 + 0.3;
        const x = Math.cos(angle) * (half - 4.5);
        const z = Math.sin(angle) * (half - 4.5);
        const board = new THREE.Group();
        board.add(box(0.15, 2, 0.15, material('#5d4037'), 0, 1, 0));
        const panel = box(3.2, 1.6, 0.12, [material('#6741d9'), material('#6741d9'), material('#6741d9'), material('#6741d9'), new THREE.MeshBasicMaterial({ map: labelTexture(title, { bg: '#5f3dc4', fg: '#ffffff', width: 512, height: 256, font: 'bold 52px Segoe UI, Arial, sans-serif' }) }), material('#6741d9')], 0, 2.6, 0);
        panel.rotation.x = -0.25;
        board.add(panel);
        board.position.set(x, 0.25, z);
        board.rotation.y = Math.atan2(-x, -z);
        board.userData = { label: title, info };
        group.add(PropKit.kit.interactive(board, 'inspect', title));
      });
      // Flower beds and benches
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const x = Math.cos(angle) * half * 0.55;
        const z = Math.sin(angle) * half * 0.55;
        for (let f = 0; f < 10; f++) group.add(sphere(0.25, material(['#ff6b6b', '#ffd43b', '#f783ac', '#ffffff', '#b197fc'][f % 5]), x + Math.cos(f) * 1.2, 0.45, z + Math.sin(f) * 1.2, 6));
        const bench = new THREE.Group();
        bench.add(box(2.2, 0.15, 0.6, material('#a47148'), 0, 0.55, 0));
        bench.add(box(2.2, 0.6, 0.12, material('#a47148'), 0, 0.9, -0.28));
        [-0.9, 0.9].forEach((dx) => bench.add(box(0.12, 0.5, 0.5, material('#495057'), dx, 0.25, 0)));
        bench.position.set(x * 1.35, 0.25, z * 1.35);
        bench.rotation.y = Math.atan2(-x, -z);
        group.add(PropKit.kit.interactive(bench, 'sit', 'Forest bench'));
      }
      group.userData.label = 'Multiverse Forest';
    }
  });

  // Messages shown on the floating cube screens of the cowork plazas
  const COWORK_MESSAGES = ['THE WORLD IS YOURS', 'SHIP IT', 'CODE TOGETHER', 'HELLO, WORLD', 'MERGE WITH LOVE', 'IT WORKS ON MY MACHINE', 'GOOD FIRST ISSUE', 'GIT PUSH DREAMS'];
  function messageTexture(text) {
    return PropKit.kit.canvasTexture(`cowork|${text}`, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#111317';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.fillStyle = '#f8f9fa';
      ctx.font = '600 72px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const words = text.split(' ');
      const lines = [];
      words.forEach((word) => { const last = lines[lines.length - 1]; if (last && (last + ' ' + word).length <= 11) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word); });
      lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 84));
    });
  }

  Object.assign(builders, {
    // Mini plaza at every cowork/workspace: two-tier fountain with lily pads and
    // reeds, planters, red trees and a floating cube screen with messages
    coworkPlaza(group, { w, data }) {
      const radius = w / 2;
      const pavement = cylinder(radius, radius, 0.2, new THREE.MeshStandardMaterial({ map: repeated(cobbleTexture('#c9c2b8'), radius / 3, radius / 3), roughness: 0.9 }), 0, 0.1, 0, 48);
      pavement.castShadow = false;
      group.add(pavement);
      const stone = material('#b8a99a', { roughness: 0.7 });
      const darkStone = material('#7a6a5c', { roughness: 0.8 });
      // Lower basin with water, lily pads and reeds
      group.add(cylinder(radius * 0.42, radius * 0.45, 0.6, darkStone, 0, 0.4, 0, 40));
      const lip = mesh(new THREE.TorusGeometry(radius * 0.42, 0.25, 8, 48), stone, 0, 0.72, 0);
      lip.rotation.x = Math.PI / 2;
      group.add(lip);
      const water = cylinder(radius * 0.4, radius * 0.4, 0.05, material('#74c0fc', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9 }), 0, 0.62, 0, 40);
      water.raycast = () => {};
      group.add(water);
      for (let i = 0; i < 6; i++) {
        const angle = i * 1.1;
        const pad = cylinder(0.35, 0.35, 0.04, material('#40c057'), Math.cos(angle) * radius * 0.28, 0.66, Math.sin(angle) * radius * 0.28, 10);
        group.add(pad);
      }
      for (let i = 0; i < 8; i++) {
        const angle = i * 0.8 + 0.3;
        const reed = cylinder(0.03, 0.03, 1.2, material('#c9a227'), Math.cos(angle) * radius * 0.36, 1.2, Math.sin(angle) * radius * 0.36, 4);
        reed.rotation.z = (i % 2 ? 1 : -1) * 0.15;
        group.add(reed);
      }
      // Upper bowl on a pedestal with a little stream
      group.add(cylinder(0.35, 0.5, 2, stone, 0, 1.6, 0, 16));
      const bowlProfile = [new THREE.Vector2(0.4, 0), new THREE.Vector2(1.6, 0.5), new THREE.Vector2(1.8, 0.8), new THREE.Vector2(1.7, 0.85)];
      group.add(mesh(new THREE.LatheGeometry(bowlProfile, 32), material('#a8988a', { roughness: 0.7, side: THREE.DoubleSide }), 0, 2.5, 0));
      group.add(cylinder(1.55, 1.55, 0.05, material('#74c0fc', { transparent: true, opacity: 0.9 }), 0, 3.2, 0, 32));
      // Planters with low-poly shrubs and red/pink trees around
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const x = Math.cos(angle) * radius * 0.72;
        const z = Math.sin(angle) * radius * 0.72;
        group.add(box(1.8, 0.6, 1, material('#8d7b6b'), x, 0.5, z));
        group.add(mesh(new THREE.IcosahedronGeometry(0.6, 0), material('#2f9e44', { flatShading: true }), x, 1.1, z));
        const treeAngle = angle + Math.PI / 4;
        const tx = Math.cos(treeAngle) * radius * 0.85;
        const tz = Math.sin(treeAngle) * radius * 0.85;
        group.add(cylinder(0.18, 0.26, 2.6, material('#5d4037'), tx, 1.4, tz, 8));
        [[0, 3.2, 0, 1.4], [0.8, 2.9, 0.3, 1], [-0.7, 3, -0.4, 1]].forEach(([dx, y, dz, r]) => group.add(mesh(new THREE.IcosahedronGeometry(r, 0), material(i % 2 ? '#e03131' : '#f06595', { flatShading: true }), tx + dx, y, tz + dz)));
      }
      // Floating cube screen with rotating messages
      const cube = new THREE.Group();
      const start = (data && data.seed) || 0;
      const faces = [0, 1, 2, 3].map((i) => new THREE.MeshBasicMaterial({ map: messageTexture(COWORK_MESSAGES[(start + i) % COWORK_MESSAGES.length]) }));
      const bezel = material('#1b1d21', { metalness: 0.5, roughness: 0.4 });
      cube.add(mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), [faces[0], faces[1], bezel, bezel, faces[2], faces[3]]));
      const beam = mesh(new THREE.ConeGeometry(1.6, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#e7f5ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -4.6, 0);
      beam.raycast = () => {};
      cube.add(beam);
      cube.position.y = 9;
      group.add(cube);
      let shift = start;
      let last = 0;
      animate(cube, (time) => {
        cube.rotation.y = time * 0.25;
        cube.position.y = 9 + Math.sin(time * 0.9) * 0.4;
        if (time - last > 9) {
          last = time;
          shift += 1;
          faces.forEach((face, i) => { face.map = messageTexture(COWORK_MESSAGES[(shift + i) % COWORK_MESSAGES.length]); face.needsUpdate = true; });
        }
      });
      group.userData.label = 'Cowork plaza';
    }
  });

  Object.assign(builders, {
    // Supertree: a lattice steel tree with a flared canopy full of glowing bulbs
    supertree(group, { w, h }) {
      const radius = w / 2;
      const map = latticeTexture().clone();
      map.needsUpdate = true;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(6, h / 3);
      const lattice = new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 });
      // Trunk: a slim core wrapped in a lattice that widens towards the base
      group.add(cylinder(radius * 0.18, radius * 0.24, h * 0.7, material('#3a2f2a', { roughness: 0.9 }), 0, h * 0.35, 0, 16));
      const trunkProfile = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        trunkProfile.push(new THREE.Vector2(radius * (0.42 - 0.18 * Math.sin(t * Math.PI * 0.5)) + Math.pow(1 - t, 3) * radius * 0.25, t * h * 0.72));
      }
      group.add(mesh(new THREE.LatheGeometry(trunkProfile, 24), lattice));
      // Canopy: a flared umbrella of lattice branches
      const canopyProfile = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        canopyProfile.push(new THREE.Vector2(radius * 0.25 + Math.pow(t, 1.6) * radius * 0.95, h * 0.7 + t * h * 0.3));
      }
      const canopyMap = map.clone();
      canopyMap.repeat.set(10, 2);
      canopyMap.needsUpdate = true;
      group.add(mesh(new THREE.LatheGeometry(canopyProfile, 32), new THREE.MeshStandardMaterial({ map: canopyMap, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 })));
      // Climbing plants on the trunk
      for (let i = 0; i < 10; i++) {
        const angle = i * 1.7;
        const y = 1 + i * h * 0.06;
        group.add(sphere(radius * 0.12, material(i % 3 ? '#3f8f3a' : '#6abf4b', { roughness: 1 }), Math.cos(angle) * radius * 0.36, y, Math.sin(angle) * radius * 0.36, 8));
      }
      // Glowing bulbs along the rim and a light ring at the neck
      const bulbs = [];
      for (let i = 0; i < 26; i++) {
        const angle = (i / 26) * Math.PI * 2;
        const ring = i % 2 ? 1.18 : 0.9;
        const bulb = sphere(0.35, glow('#fffbe6', 2.2), Math.cos(angle) * radius * ring, h * (i % 2 ? 0.98 : 0.9), Math.sin(angle) * radius * ring, 10);
        bulb.castShadow = false;
        group.add(bulb);
        bulbs.push(bulb);
      }
      const neck = mesh(new THREE.TorusGeometry(radius * 0.3, 0.15, 8, 32), glow('#fffbe6', 2.2), 0, h * 0.7, 0);
      neck.rotation.x = Math.PI / 2;
      group.add(neck);
      animate(group, (time) => { bulbs.forEach((bulb, i) => { bulb.material.emissiveIntensity = 1.6 + Math.sin(time * 2 + i) * 0.6; }); });
      group.userData.label = 'Supertree';
    },

    // Neoclassical pink pavilion: steps, a row of columns and tall facade fins
    columnHall(group, { w, h, d, color }) {
      const pink = color || '#e8b4b8';
      const stone = material(pink, { roughness: 0.55 });
      const light = material(shade(pink, 0.08), { roughness: 0.5 });
      for (let i = 0; i < 3; i++) group.add(roundedSlab(w + 4 - i * 1.4, 0.45, d + 4 - i * 1.4, 0.3, light));
      group.children.slice(-3).forEach((step, i) => { step.position.y = i * 0.45; });
      const floorY = 1.35;
      const columns = Math.max(6, Math.round(w / 3));
      for (let i = 0; i < columns; i++) {
        const x = -w / 2 + 1 + i * ((w - 2) / (columns - 1));
        group.add(cylinder(0.55, 0.65, h - 2.4, stone, x, floorY + (h - 2.4) / 2, d / 2 - 1, 24));
        group.add(box(1.5, 0.35, 1.5, light, x, floorY + 0.17, d / 2 - 1));
        group.add(box(1.5, 0.35, 1.5, light, x, floorY + h - 2.6, d / 2 - 1));
      }
      // Back and side walls with tall vertical fins
      group.add(box(w, h - 1, 0.6, stone, 0, floorY + (h - 1) / 2, -d / 2 + 0.3));
      [-1, 1].forEach((side) => group.add(box(0.6, h - 1, d, stone, side * (w / 2 - 0.3), floorY + (h - 1) / 2, 0)));
      for (let i = 0; i < Math.round(w / 1.6); i++) group.add(box(0.35, h - 3, 0.5, light, -w / 2 + 1 + i * 1.6, floorY + (h - 3) / 2 + 0.5, -d / 2 + 0.75));
      // Entablature and a slightly set-back attic
      group.add(roundedSlab(w + 1, 1.2, d + 1, 0.3, light));
      group.children[group.children.length - 1].position.y = floorY + h - 2.4;
      group.add(roundedSlab(w - 3, 1.6, d - 3, 0.3, stone));
      group.children[group.children.length - 1].position.y = floorY + h - 1.2;
      group.userData.label = 'Hall of Builders';
    },

    // Smooth white marble statue of a developer on a pedestal
    marbleStatue(group, { h }) {
      const marble = material('#f3eee9', { roughness: 0.35 });
      const scale = h / 7;
      group.add(cylinder(1.3 * scale, 1.5 * scale, 1.2 * scale, material('#d9d2c9', { roughness: 0.5 }), 0, 0.6 * scale, 0, 32));
      const figure = new THREE.Group();
      figure.add(cylinder(0.55, 0.42, 2.4, marble, 0, 3.4, 0, 24));
      figure.add(sphere(0.55, marble, 0, 4.55, 0, 24));
      figure.add(sphere(0.45, marble, 0, 5.0, 0, 24));
      [-1, 1].forEach((side) => {
        const leg = cylinder(0.22, 0.18, 2.2, marble, side * 0.28, 1.8, 0, 16);
        leg.rotation.z = side * 0.05;
        figure.add(leg);
        const arm = cylinder(0.16, 0.13, 1.9, marble, side * 0.78, 3.6, 0, 16);
        arm.rotation.z = side * (side > 0 ? 0.25 : 2.6);
        figure.add(arm);
      });
      figure.add(box(0.7, 0.5, 0.06, marble, -1.2, 4.6, 0.2)); // holding a laptop up high
      figure.scale.setScalar(scale);
      figure.position.y = 1.2 * scale - 0.6 * scale;
      group.add(figure);
      group.userData.label = 'Statue of the Unknown Developer';
    },

    // Kinetic sculpture: curved steel tubes, spinning gears and a yellow blob
    kineticSculpture(group, { w, h }) {
      const steel = material('#9aa5b1', { metalness: 0.8, roughness: 0.3 });
      group.add(roundedSlab(w, 0.5, w * 0.6, 0.4, material('#dfe4ea', { roughness: 0.5 })));
      const curves = [
        [[-w * 0.35, 0.5, 0], [-w * 0.3, h * 0.5, 0.5], [0, h * 0.8, 0], [w * 0.3, h * 0.6, -0.4], [w * 0.4, h * 0.95, 0]],
        [[w * 0.3, 0.5, 0.6], [w * 0.15, h * 0.4, 1], [-w * 0.1, h * 0.55, 0.5], [-w * 0.45, h * 0.75, 0]],
        [[0, 0.5, -0.6], [0.4, h * 0.3, -0.8], [-0.6, h * 0.5, -0.2], [0.2, h * 0.7, 0.4]]
      ];
      curves.forEach((points, i) => {
        const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        group.add(mesh(new THREE.TubeGeometry(curve, 48, 0.22 - i * 0.04, 10, false), steel));
      });
      const gears = [['#f08c00', 0.9, -w * 0.15, h * 0.3], ['#1c7ed6', 0.6, w * 0.1, h * 0.22], ['#e64980', 0.5, w * 0.22, h * 0.42]].map(([color, size, x, y]) => {
        const gear = new THREE.Group();
        gear.add(mesh(new THREE.TorusGeometry(size, size * 0.28, 10, 28), material(color, { metalness: 0.4, roughness: 0.4 })));
        for (let t = 0; t < 10; t++) gear.add(box(size * 0.3, size * 0.3, size * 0.3, material(color), Math.cos((t / 10) * Math.PI * 2) * size * 1.3, Math.sin((t / 10) * Math.PI * 2) * size * 1.3, 0));
        gear.position.set(x, y, 0.6);
        group.add(gear);
        return gear;
      });
      const blob = mesh(new THREE.IcosahedronGeometry(1.2, 3), material('#ffe94d', { roughness: 0.4 }), w * 0.4, h * 0.95, 0);
      blob.scale.set(1.3, 0.8, 1);
      group.add(blob);
      animate(group, (time) => {
        gears.forEach((gear, i) => { gear.rotation.z = time * (i % 2 ? -1 : 1) * (0.6 + i * 0.3); });
        blob.rotation.y = time * 0.5;
        blob.position.y = h * 0.95 + Math.sin(time * 1.5) * 0.3;
      });
      group.userData.label = 'Kinetic sculpture: "Merge Conflict"';
    }
  });

  Object.assign(builders, {
    // Modern storefront: glass facade framed by glowing pink-gold light strips,
    // a slatted awning, display screens and a puffy cloud with the logo on the roof
    cloudStore(group, { w, h, d, label }) {
      const wall = material('#b89b8c', { roughness: 0.55 });
      const glass = material('#d9c2ff', { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3 });
      const strip = glow('#ffb3d9', 1.6);
      const gold = glow('#ffe8a3', 1.4);
      group.add(roundedSlab(w, 0.4, d, 0.3, material('#e9e3dc')));
      // Back, sides and roof
      group.add(box(w, h, 0.4, wall, 0, h / 2, -d / 2 + 0.2));
      [-1, 1].forEach((side) => group.add(box(0.4, h, d, wall, side * (w / 2 - 0.2), h / 2, 0)));
      group.add(roundedSlab(w + 1, 0.6, d + 1, 0.4, material('#a68a7b')));
      group.children[group.children.length - 1].position.y = h;
      // Glass storefront with an open entrance
      [-1, 1].forEach((side) => {
        const pane = box(w / 2 - 2.2, h - 0.6, 0.1, glass, side * (w / 4 + 1.1), h / 2, d / 2);
        pane.castShadow = false;
        group.add(pane);
      });
      group.add(box(4.4, h - 4.2, 0.1, glass, 0, 4.2 + (h - 4.2) / 2, d / 2));
      // Glowing frames: vertical striped light columns and a gold top strip
      [-1, 0, 1].forEach((column) => {
        for (let i = 0; i < 10; i++) group.add(box(0.5, 0.18, 0.3, i % 2 ? strip : gold, column * (w / 2 - 0.4), 0.6 + i * ((h - 1) / 10), d / 2 + 0.2));
      });
      group.add(box(w + 0.6, 0.35, 0.4, gold, 0, h - 0.1, d / 2 + 0.25));
      // Slatted awning
      for (let i = 0; i < 8; i++) group.add(box(w * 0.7, 0.08, 0.3, i % 2 ? strip : material('#fff4f9'), 0, h * 0.62 - i * 0.12, d / 2 + 0.4 + i * 0.35));
      // Display screens on the facade
      [-1, 1].forEach((side) => {
        const screen = box(3.4, 3.4, 0.1, new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture(side < 0 ? 'Figma' : 'GitHub', { tagline: side < 0 ? 'Design together' : 'Merch & stickers', background: side < 0 ? '#fdf2ff' : '#eef6ff', foreground: '#1d1d1f', width: 512, height: 512 }) }), side * (w / 2 - 3), h * 0.38, d / 2 + 0.15);
        group.add(screen);
      });
      // Counter and shelves inside
      group.add(box(5, 1.1, 1, material('#fff4f9'), 0, 0.95, -d / 2 + 2));
      group.add(box(w - 2, 0.1, 0.8, material('#e9e3dc'), 0, 2.4, -d / 2 + 0.7));
      // Puffy cloud on the roof with the shop name
      const cloud = new THREE.Group();
      const puff = material('#fbf7f2', { roughness: 0.9 });
      [[0, 0, 0, 2.6], [-2.4, -0.4, 0.3, 2], [2.4, -0.4, 0.2, 2.1], [-1.2, 1.2, 0, 1.9], [1.3, 1.1, 0.2, 1.8], [0, -0.8, 1, 2]].forEach(([x, y, z, r]) => cloud.add(sphere(r, puff, x, y, z, 20)));
      const name = textSprite(label || 'Cotton Cloud Shop', { width: 7, color: '#d6336c', background: 'rgba(255, 255, 255, 0)', font: 'bold 64px Georgia, serif' });
      name.position.set(0, 0.3, 3.2);
      cloud.add(name);
      cloud.position.set(0, h + 3.4, 0);
      group.add(cloud);
      animate(cloud, (time) => { cloud.position.y = h + 3.4 + Math.sin(time * 0.8) * 0.25; });
      group.userData.label = label || 'Cotton Cloud Shop';
    },

    // Brand pavilion of light: tiered round platforms with glowing edges, a
    // stacked arch of light, orbiting neon rings, billboards and a rainbow walk
    lightPavilion(group, { w, h, data }) {
      const radius = w / 2;
      const white = material('#f1f3f5', { roughness: 0.35 });
      const edge = glow('#ffffff', 1.8);
      [[radius, 0.6], [radius * 0.75, 3.6], [radius * 0.55, 6.6]].forEach(([r, y], i) => {
        group.add(cylinder(r, r, 0.6, white, 0, y, -i * 1.5, 48));
        const rim = mesh(new THREE.TorusGeometry(r, 0.08, 6, 64), edge, 0, y + 0.3, -i * 1.5);
        rim.rotation.x = Math.PI / 2;
        group.add(rim);
        if (i) for (let p = 0; p < 6; p++) group.add(cylinder(0.25, 0.25, 3, white, Math.cos(p) * r * 0.8, y - 1.5, -i * 1.5 + Math.sin(p) * r * 0.8, 10));
      });
      // Arch of light: nested half rings at the entrance
      for (let i = 0; i < 5; i++) {
        const arch = mesh(new THREE.TorusGeometry(radius * 0.55 - i * 0.7, 0.14, 8, 48, Math.PI), glow(i % 2 ? '#ffd8a8' : '#ffffff', 1.6 + i * 0.2), 0, 0.9, radius * 0.4 - i * 0.6);
        group.add(arch);
      }
      // Glowing core
      group.add(sphere(1.6, glow('#fff3bf', 2.6), 0, 7.6, -3, 24));
      // Orbiting neon rings
      const orbits = [0, 1, 2].map((i) => {
        const ring = mesh(new THREE.TorusGeometry(radius * (0.7 + i * 0.18), 0.07, 6, 96), glow('#ffffff', 2), 0, h * 0.55, -1.5);
        ring.rotation.set(Math.PI / 2 + 0.5 - i * 0.35, i * 0.6, 0);
        ring.raycast = () => {};
        group.add(ring);
        return ring;
      });
      // Billboards on tall posts
      const brands = (data && data.brands) || [['GitHub', 'Universe pavilion'], ['Claude', 'Build with AI']];
      brands.forEach(([name, tagline], i) => {
        const side = i ? 1 : -1;
        group.add(cylinder(0.3, 0.3, h * 0.7, material('#343a40', { metalness: 0.7 }), side * radius * 0.85, h * 0.35, radius * 0.1, 12));
        const board = box(7, 3, 0.3, new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture(name, { tagline, background: '#111111', foreground: '#ffffff', layout: 'sign', width: 1024, height: 440 }) }), side * radius * 0.85, h * 0.7, radius * 0.1);
        board.rotation.y = -side * 0.35;
        group.add(board);
      });
      // Rainbow walkway to the entrance
      ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].forEach((color, i) => {
        const stripe = box(0.6, 0.06, radius * 0.8, material(color), -1.5 + i * 0.6, 0.05, radius + radius * 0.4);
        stripe.castShadow = false;
        group.add(stripe);
      });
      animate(group, (time) => { orbits.forEach((ring, i) => { ring.rotation.z = time * (0.15 + i * 0.07) * (i % 2 ? -1 : 1); }); });
      group.userData.label = 'Pavilion of Light';
    }
  });

  Object.assign(builders, {
    // Open promenade (boulevard): wide pale pavers, planters with round shrubs
    // and autumn bushes down the middle, lamp posts and benches on both sides
    promenade(group, { w, d, color }) {
      const pavers = new THREE.MeshStandardMaterial({ map: repeated(cobbleTexture(color || '#b9b4d6'), w / 4, d / 4), roughness: 0.85 });
      const walk = box(w, 0.2, d, pavers, 0, 0.1, 0);
      walk.castShadow = false;
      group.add(walk);
      [-1, 1].forEach((side) => group.add(box(0.5, 0.35, d, material('#e9e6f5', { roughness: 0.6 }), side * (w / 2 - 0.25), 0.17, 0)));
      const shrubColors = ['#2f6f4f', '#e8590c', '#f08c00', '#c2255c', '#2b8a3e'];
      const count = Math.floor(d / 9);
      for (let i = 0; i < count; i++) {
        const z = -d / 2 + 4.5 + i * 9;
        // Middle planter: a long box of flowers, or a round pot with a big shrub
        if (i % 2) {
          group.add(roundedSlab(2.6, 0.6, 5, 0.5, material('#f1f3f5', { roughness: 0.5 })));
          group.children[group.children.length - 1].position.set(0, 0.2, z);
          for (let f = 0; f < 8; f++) group.add(sphere(0.35, material(shrubColors[(i + f) % shrubColors.length], { roughness: 1 }), (f % 2 - 0.5) * 1.1, 0.95, z - 2 + (f >> 1) * 1.3, 8));
        } else {
          group.add(cylinder(1.5, 1.3, 0.8, material('#f1f3f5', { roughness: 0.5 }), 0, 0.6, z, 28));
          const shrub = sphere(1.5, material(shrubColors[i % shrubColors.length], { roughness: 1, flatShading: true }), 0, 2, z, 12);
          shrub.scale.y = 0.85;
          group.add(shrub);
        }
        // Lamps and benches on both sides
        [-1, 1].forEach((side) => {
          const lamp = new THREE.Group();
          lamp.add(cylinder(0.1, 0.16, 4.5, material('#343a40', { metalness: 0.6 }), 0, 2.25, 0, 8));
          lamp.add(box(0.6, 0.7, 0.6, glow('#fff3bf', 1.4), 0, 4.7, 0));
          lamp.position.set(side * (w / 2 - 1.2), 0.2, z + 3);
          group.add(lamp);
          if (i % 2 === 0) {
            const bench = new THREE.Group();
            bench.add(box(2.2, 0.12, 0.6, material('#c9a27a'), 0, 0.55, 0));
            bench.add(box(2.2, 0.5, 0.08, material('#c9a27a'), 0, 0.85, -side * 0.28));
            [-0.9, 0.9].forEach((dz) => bench.add(box(0.1, 0.55, 0.5, material('#495057'), dz, 0.27, 0)));
            bench.position.set(side * (w / 2 - 2.4), 0.2, z - 1);
            bench.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            group.add(PropKit.kit.interactive(bench, 'sit', 'Promenade bench'));
          }
        });
      }
      group.userData.label = 'Genesis Promenade';
    }
  });

  Object.assign(builders, {
    // Ring of news and event walls around the square pool (like Decentraland's
    // Events Explorer by the spawn): Top Rated scenes, the Worlds as events and
    // live dev news, plus a diving board, a glowing rim and a floating arrow
    newsRing(group, { w, h }) {
      const radius = w / 2;
      const arc = Math.PI * 1.3;
      const start = Math.PI - arc / 2;
      // Curved backdrop band on posts
      const band = mesh(new THREE.CylinderGeometry(radius + 0.5, radius + 0.5, h, 64, 1, true, start, arc), material('#f4e1c1', { side: THREE.DoubleSide, roughness: 0.6 }), 0, h / 2 + 2, 0);
      group.add(band);
      const rim = mesh(new THREE.TorusGeometry(radius + 0.55, 0.12, 6, 96, arc), glow('#ffb703', 1.8), 0, 2, 0);
      rim.rotation.set(Math.PI / 2, 0, -start + Math.PI / 2 - arc);
      group.add(rim);
      // Round warm-paved plaza around the pool (with the square opening of the pool)
      const disc = new THREE.Shape();
      disc.absarc(0, 0, radius + 1.5, 0, Math.PI * 2, false);
      const opening = new THREE.Path();
      opening.moveTo(-8.1, -8.1); opening.lineTo(8.1, -8.1); opening.lineTo(8.1, 8.1); opening.lineTo(-8.1, 8.1); opening.closePath();
      disc.holes.push(opening);
      const pavement = mesh(new THREE.ShapeGeometry(disc, 64), new THREE.MeshStandardMaterial({ map: repeated(cobbleTexture('#e0995e'), 1 / 6, 1 / 6), roughness: 0.85 }), 0, 0.03, 0);
      pavement.rotation.x = -Math.PI / 2;
      pavement.castShadow = false;
      pavement.receiveShadow = true;
      group.add(pavement);
      // Glowing ring around the pool
      const poolGlow = mesh(new THREE.TorusGeometry(10.6, 0.18, 8, 64), glow('#ffd166', 2), 0, 0.12, 0);
      poolGlow.rotation.x = Math.PI / 2;
      group.add(poolGlow);
      const places = (window.MULTIVERSE_WORLDS || []);
      const sections = [
        { title: 'Top Rated', items: ['apple', 'festival', 'equalizer', 'techsquare', 'gamer'].map((key) => places.find((world) => world.key === key)).filter(Boolean) },
        { title: 'Events Explorer', items: places.filter((world) => world.world).slice(0, 5) },
        { title: 'Dev News', news: true }
      ];
      sections.forEach((section, index) => {
        const sectionStart = start + (index * arc) / 3;
        const sectionArc = arc / 3;
        const middle = sectionStart + sectionArc / 2;
        const title = textSprite(section.title, { width: 9, color: '#ffffff', background: 'rgba(0, 0, 0, 0)', font: 'bold 70px Segoe UI, Arial, sans-serif' });
        title.position.set(Math.sin(middle) * radius, h + 3.6, Math.cos(middle) * radius);
        group.add(title);
        if (section.news) {
          [-0.22, 0.22].forEach((offset) => {
            const angle = middle + offset;
            const screen = box(5.6, 3.2, 0.2, new THREE.MeshBasicMaterial({ map: TechBoards.board('newsroom') }), Math.sin(angle) * (radius - 0.2), h / 2 + 2, Math.cos(angle) * (radius - 0.2));
            screen.rotation.y = angle + Math.PI;
            group.add(screen);
          });
          return;
        }
        section.items.forEach((world, itemIndex) => {
          const angle = sectionStart + (itemIndex + 0.5) * (sectionArc / section.items.length);
          const card = box(2.6, 3.3, 0.15, new THREE.MeshBasicMaterial({ map: eventCardTexture(world) }), Math.sin(angle) * (radius - 0.2), h / 2 + 2, Math.cos(angle) * (radius - 0.2));
          card.rotation.y = angle + Math.PI;
          card.userData.label = `${world.name} — JUMP IN`;
          group.add(PropKit.kit.interactive(card, 'jump', world.key));
        });
        // Arrows between sections
        const arrow = mesh(new THREE.ConeGeometry(0.5, 1.2, 3), glow('#ffd166', 1.6), Math.sin(sectionStart) * (radius - 0.3), h / 2 + 2, Math.cos(sectionStart) * (radius - 0.3));
        arrow.rotation.z = Math.PI / 2;
        if (index) group.add(arrow);
      });
      // Diving board on the spawn side, leaning out over the pool
      const board = new THREE.Group();
      board.add(box(1.6, 0.2, 5, material('#ff6b35', { roughness: 0.5 }), 0, 1.6, 0));
      board.add(box(1.7, 0.08, 5.1, glow('#ffd166', 0.8), 0, 1.72, 0));
      const ramp = box(1.6, 0.2, 4.2, material('#3a3f4b', { metalness: 0.4 }), 0, 0.8, 4.3);
      ramp.rotation.x = Math.atan2(1.6, 4.2);
      board.add(ramp);
      [-0.8, 0.8].forEach((x) => board.add(cylinder(0.05, 0.05, 1.1, material('#ced4da', { metalness: 0.8 }), x, 2.2, 1.5, 6)));
      board.position.set(0, 0, 8.6);
      group.add(board);
      const sign = textSprite('DIVING ALLOWED ⤵', { width: 4, background: 'rgba(17, 17, 17, 0.9)' });
      sign.position.set(2.6, 2.6, 11);
      group.add(sign);
      // Floating golden arrow pointing down into the pool
      const pointer = mesh(new THREE.ConeGeometry(1.4, 1.8, 3), glow('#ffc94d', 1.8), 0, 9, 0);
      pointer.rotation.x = Math.PI;
      group.add(pointer);
      animate(pointer, (time) => { pointer.position.y = 9 + Math.sin(time * 2) * 0.5; pointer.rotation.y = time * 0.8; });
      group.userData.label = 'Events Explorer';
    }
  });

  const rules = [
    [/ad_cube_stack/, 'adCubeStack'], [/led_cube_kiosk/, 'ledCubeKiosk'], [/supertree/, 'supertree'], [/column_hall/, 'columnHall'],
    [/marble_statue/, 'marbleStatue'], [/kinetic_sculpture/, 'kineticSculpture'], [/cloud_store/, 'cloudStore'], [/light_pavilion/, 'lightPavilion'], [/promenade/, 'promenade'], [/news_ring/, 'newsRing'], [/cowork_plaza/, 'coworkPlaza'], [/spawn_hub/, 'spawnHub'], [/forest_garden/, 'forestGarden'],
    [/plaza_floor/, 'plazaFloor'], [/^fountain/, 'fountain'], [/theatre/, 'theatre'], [/round_tree/, 'roundTree'],
    [/lamp_post/, 'lampPost'], [/^bench/, 'bench'], [/flower_bed/, 'flowerBed'], [/^shop_/, 'shop'],
    [/neon_tower|aetheria/, 'neonTower'], [/casino|vegas/, 'casino'], [/arch_gate|plaza_gate/, 'archGate'],
    [/plaza_tower/, 'plazaTower'], [/hot_air_balloon/, 'hotAirBalloon'], [/hydrant/, 'hydrant'], [/info_kiosk/, 'infoKiosk'],
    [/welcome_hall/, 'welcomeHall'], [/events_wall/, 'eventsWall'], [/glow_ring/, 'glowRing'], [/announcement_kiosk/, 'announcementKiosk'],
    [/^pond/, 'pond'], [/poster_wall/, 'posterWall'], [/square_pool/, 'squarePool'], [/underground_hall/, 'undergroundHall'],
    [/^firepit/, 'firepit'], [/mini_game_arena/, 'miniGameArena'], [/teleport_portal/, 'teleportPortal'], [/sky_platform/, 'skyPlatform'], [/metro_station/, 'metroStation']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
