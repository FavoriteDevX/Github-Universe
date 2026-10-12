// ============================================================================
// GENESIS CITY SCENES: HOLO WORKSPACE, PARKOUR PARK AND WELCOME HALL DETAILS
// ============================================================================
(() => {
  const { material, glow, shade, mesh, box, cylinder, sphere, facedBox, animate, textSprite, labelTexture, repeated, plankTexture, roundedSlab, laptop, interactive, canvasTexture } = PropKit.kit;

  function acrylic(color, opacity = 0.55) {
    return material(color, { transparent: true, opacity, roughness: 0.05, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 });
  }

  const builders = {
    // Pastel gradient floor for the futuristic workspace
    gradientFloor(group, { w, h, d }) {
      const texture = canvasTexture('gradientFloor', 512, 512, (ctx, cw, ch) => {
        const gradient = ctx.createLinearGradient(0, 0, cw, ch);
        gradient.addColorStop(0, '#f6c6ea');
        gradient.addColorStop(0.5, '#c4d7ff');
        gradient.addColorStop(1, '#ffd6a5');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, cw, ch);
      });
      group.add(box(w, h, d, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.25, metalness: 0.2 })));
    },

    glassWall(group, { w, h, d, color }) {
      const pane = box(w, h, d, acrylic(color || '#a5d8ff', 0.25));
      pane.castShadow = false;
      group.add(pane);
      group.add(box(w + 0.1, 0.2, d + 0.1, material('#dee2e6', { metalness: 0.7 }), 0, h / 2, 0));
    },

    // Translucent long table with acrylic chairs and laptops (simulated work)
    glassTable(group, { w, h, d, color }) {
      const along = w > d;
      group.add(box(w, 0.12, d, acrylic(color || '#74c0fc', 0.6), 0, h / 2, 0));
      [-1, 1].forEach((side) => group.add(box(along ? 0.15 : w * 0.9, h, along ? d * 0.9 : 0.15, acrylic(color || '#74c0fc', 0.45), along ? side * (w / 2 - 0.3) : 0, 0, along ? 0 : side * (d / 2 - 0.3))));
      const length = Math.max(w, d);
      const seats = Math.floor(length / 1.8);
      for (let i = 0; i < seats; i++) {
        const t = -length / 2 + (length / seats) * (i + 0.5);
        [-1, 1].forEach((side) => {
          const chair = new THREE.Group();
          chair.add(box(0.75, 0.1, 0.75, acrylic('#ff922b', 0.6), 0, 0.55, 0));
          chair.add(box(0.75, 0.9, 0.1, acrylic('#ff922b', 0.6), 0, 1, -0.35));
          [-0.3, 0.3].forEach((x) => chair.add(box(0.08, 0.55, 0.7, acrylic('#ff922b', 0.5), x, 0.27, 0)));
          const offset = (along ? d : w) / 2 + 0.7;
          if (along) chair.position.set(t, -h / 2, side * offset); else chair.position.set(side * offset, -h / 2, t);
          chair.rotation.y = along ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
          group.add(interactive(chair, 'sit', 'Acrylic chair'));
          const inset = (along ? d : w) / 2 - 0.4;
          const facing = along ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
          group.add(along ? laptop(t, h / 2 + 0.06, side * inset, facing) : laptop(side * inset, h / 2 + 0.06, t, facing));
        });
      }
    },

    roundSofa(group, { w, h, color }) {
      const radius = w / 2;
      const seat = mesh(new THREE.CylinderGeometry(radius, radius, h * 0.4, 48, 1, false, Math.PI * 0.2, Math.PI * 1.3), acrylic(color || '#1c7ed6', 0.8), 0, -h * 0.3, 0);
      group.add(interactive(seat, 'sit', 'Lounge sofa'));
      const back = mesh(new THREE.CylinderGeometry(radius + 0.2, radius + 0.2, h, 48, 1, true, Math.PI * 0.2, Math.PI * 1.3), acrylic(shade(color || '#1c7ed6', -0.1), 0.8), 0, 0, 0);
      back.material.side = THREE.DoubleSide;
      group.add(back);
      group.add(cylinder(radius * 0.45, radius * 0.45, h * 0.3, acrylic('#22b8cf', 0.7), radius * 0.9, -h * 0.35, radius * 0.4, 32));
    },

    // Live leaderboard of laptop commits (updated by main.js through window.updateCommitBoard)
    commitBoard(group, { w, h, d }) {
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 432;
      const texture = new THREE.CanvasTexture(canvas);
      const draw = (entries) => {
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 768, 432);
        gradient.addColorStop(0, '#0d1b3e');
        gradient.addColorStop(1, '#1877f2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 768, 432);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Segoe UI, Arial';
        ctx.fillText('Commit Leaderboard', 30, 60);
        ctx.font = '28px Consolas, monospace';
        const list = (entries || []).slice(0, 7);
        if (!list.length) ctx.fillText('Sit at a laptop (E) and ship some code!', 30, 140);
        list.forEach(([name, commits], index) => ctx.fillText(`${index + 1}. ${name.padEnd(16, ' ')} ${commits} commits`, 30, 120 + index * 42));
        texture.needsUpdate = true;
      };
      draw([]);
      window.commitBoards = window.commitBoards || [];
      window.commitBoards.push(draw);
      group.add(box(w, h, d, material('#212529')));
      group.add(box(w * 0.95, h * 0.9, 0.05, new THREE.MeshBasicMaterial({ map: texture }), 0, 0, d / 2 + 0.03));
      [-1, 1].forEach((side) => group.add(box(0.3, h, 0.3, material('#adb5bd', { metalness: 0.7 }), side * w * 0.4, -h, 0)));
    },

    // Parkour Park (Toki Land style): red platforms, spinning coins, start/finish pads
    parkourPlatform(group, { w, h, d, color }) {
      group.add(box(w, h, d, material(color || '#e03131', { roughness: 0.5 })));
      group.add(box(w + 0.05, 0.08, d + 0.05, material(shade(color || '#e03131', 0.15)), 0, h / 2, 0));
    },

    coin(group, { data }) {
      const coin = cylinder(0.45, 0.45, 0.1, material('#fcc419', { metalness: 0.8, roughness: 0.25, emissive: '#f59f00', emissiveIntensity: 0.4 }), 0, 0, 0, 20);
      coin.rotation.x = Math.PI / 2;
      group.add(coin);
      animate(group, (time) => { coin.rotation.z = time * 3; coin.position.y = Math.sin(time * 2 + group.position.x) * 0.15; });
      group.userData.collectible = { id: data.id || `${data.position}` };
      window.parkourCoins = window.parkourCoins || [];
      window.parkourCoins.push(group);
    },

    parkourPad(group, { w, h, label, type }) {
      const isStart = /start/.test(type);
      group.add(cylinder(w / 2, w / 2, h, glow(isStart ? '#40c057' : '#fab005', 0.7), 0, 0, 0, 24));
      const flag = new THREE.Group();
      flag.add(cylinder(0.06, 0.06, 4, material('#dee2e6'), 0, 2, 0, 6));
      const cloth = box(1.6, 1, 0.05, material(isStart ? '#40c057' : '#212529'), 0.8, 3.5, 0);
      flag.add(cloth);
      flag.position.set(w / 2 - 0.4, h / 2, 0);
      group.add(flag);
      animate(cloth, (time) => { cloth.rotation.y = Math.sin(time * 3) * 0.3; });
      const caption = textSprite(label || (isStart ? 'START' : 'FINISH'), { width: 6, background: isStart ? 'rgba(64, 192, 87, 0.9)' : 'rgba(250, 176, 5, 0.9)' });
      caption.position.y = 5;
      group.add(caption);
      group.userData.parkourPad = isStart ? 'start' : 'finish';
      window.parkourPads = window.parkourPads || [];
      window.parkourPads.push(group);
    },

    purpleRocks(group, { w, h, d }) {
      const rock = material('#7048e8', { flatShading: true, roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const peak = mesh(new THREE.ConeGeometry(w * (0.18 + (i % 3) * 0.05), h * (0.6 + (i % 2) * 0.4), 5), rock, ((i * 37) % 10 / 10 - 0.5) * w * 0.7, -h / 2 + h * 0.3, ((i * 53) % 10 / 10 - 0.5) * d * 0.7);
        group.add(peak);
      }
      const fall = box(w * 0.2, h * 0.8, 0.3, material('#99e9f2', { transparent: true, opacity: 0.75, emissive: '#99e9f2', emissiveIntensity: 0.3 }), 0, 0, d / 2);
      group.add(fall);
    },

    // Welcome Hall extras: round bar with stools, floating crystals, wall TV
    barCounter(group, { w, h }) {
      const radius = w / 2;
      const counter = mesh(new THREE.CylinderGeometry(radius, radius, h, 40, 1, true, 0, Math.PI * 1.4), new THREE.MeshStandardMaterial({ map: repeated(plankTexture('#6b3f22'), 6, 1), side: THREE.DoubleSide }), 0, 0, 0);
      group.add(counter);
      const top = mesh(new THREE.RingGeometry(radius - 0.6, radius + 0.2, 40, 1, 0, Math.PI * 1.4), material('#2b2d42', { side: THREE.DoubleSide, roughness: 0.3 }), 0, h / 2, 0);
      top.rotation.x = -Math.PI / 2;
      top.rotation.z = Math.PI;
      group.add(top);
      group.add(interactive(box(0.6, 0.7, 0.5, material('#495057', { metalness: 0.7 }), 0, h / 2 + 0.35, -radius + 0.3), 'coffee', 'Espresso bar'));
      for (let i = 0; i < 7; i++) {
        const angle = -Math.PI / 2 - 0.2 - i * 0.18 * Math.PI;
        const stool = new THREE.Group();
        stool.add(cylinder(0.35, 0.35, 0.12, material('#212529'), 0, 0.85, 0, 16));
        stool.add(cylinder(0.05, 0.05, 0.8, material('#868e96', { metalness: 0.8 }), 0, 0.4, 0, 6));
        stool.add(cylinder(0.3, 0.3, 0.04, material('#868e96'), 0, 0.02, 0, 12));
        stool.position.set(Math.cos(angle) * (radius + 1), -h / 2, Math.sin(angle) * (radius + 1));
        group.add(interactive(stool, 'sit', 'Bar stool'));
      }
      // Bottles shelf in the middle
      group.add(cylinder(0.8, 0.8, h * 2.2, material('#3a2416'), 0, h * 0.6, 0, 16));
      for (let i = 0; i < 10; i++) group.add(cylinder(0.08, 0.1, 0.4, material(['#e03131', '#fab005', '#2f9e44', '#1c7ed6'][i % 4], { transparent: true, opacity: 0.85 }), Math.cos(i) * 0.9, h * 1.2, Math.sin(i) * 0.9, 8));
    },

    floatingCrystal(group, { w, h, color }) {
      group.add(cylinder(w * 0.7, w * 0.85, h * 0.25, material('#2b2238', { roughness: 0.6 }), 0, -h / 2 + h * 0.125, 0, 7));
      group.add(cylinder(w * 0.62, w * 0.62, 0.06, glow('#d0bfff', 1.4), 0, -h / 2 + h * 0.25 + 0.03, 0, 7));
      const crystal = mesh(new THREE.OctahedronGeometry(w * 0.45, 0), material(color || '#7048e8', { roughness: 0.15, metalness: 0.3, emissive: color || '#7048e8', emissiveIntensity: 0.35, flatShading: true }), 0, h * 0.2, 0);
      crystal.scale.y = 1.6;
      group.add(crystal);
      animate(crystal, (time) => { crystal.rotation.y = time * 0.8; crystal.position.y = h * 0.2 + Math.sin(time * 1.5) * 0.3; });
    },

    wallTv(group, { w, h, d }) {
      group.add(box(w, h, d, material('#111111')));
      group.add(box(w * 0.94, h * 0.88, 0.04, new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture('GitHub', { tagline: 'Live from the Multiverse', background: '#0d1117', foreground: '#ffffff' }) }), 0, 0, d / 2 + 0.03));
    }
  };

  // Small low-poly models for showcase items
  function showcaseModel(kind) {
    const item = new THREE.Group();
    const beige = material('#e8dcc4');
    const dark = material('#2b2d42');
    switch (kind) {
      case 'computer':
        item.add(box(1.1, 0.25, 0.8, material('#a8743f'), 0, 0.12, 0));
        item.add(box(0.9, 0.7, 0.7, beige, 0, 0.6, -0.05));
        item.add(box(0.7, 0.5, 0.02, glow('#40c057', 0.6), 0, 0.62, 0.31));
        break;
      case 'handheld':
        item.add(box(0.6, 1, 0.15, material('#c9c9c1'), 0, 0.5, 0));
        item.add(box(0.45, 0.38, 0.02, material('#8bac0f'), 0, 0.72, 0.08));
        item.add(sphere(0.06, material('#9c1d48'), 0.15, 0.3, 0.08, 8));
        break;
      case 'mouse':
        item.add(box(0.5, 0.25, 0.75, material('#d7ccc8'), 0, 0.12, 0));
        item.add(cylinder(0.02, 0.02, 0.9, dark, 0, 0.1, -0.7, 4)).rotation.x = Math.PI / 2;
        break;
      case 'phone':
        item.add(box(0.35, 1, 0.2, material('#37474f'), 0, 0.5, 0));
        item.add(box(0.26, 0.28, 0.02, glow('#94d82d', 0.5), 0, 0.72, 0.11));
        break;
      case 'floppy':
        item.add(box(0.8, 0.8, 0.06, material('#1c7ed6'), 0, 0.4, 0));
        item.add(box(0.4, 0.25, 0.07, material('#ced4da', { metalness: 0.8 }), 0, 0.66, 0));
        break;
      case 'globe':
        item.add(sphere(0.45, material('#4dabf7', { wireframe: true }), 0, 0.55, 0, 12));
        item.add(sphere(0.4, material('#d0ebff', { transparent: true, opacity: 0.5 }), 0, 0.55, 0, 12));
        break;
      case 'envelope':
        item.add(box(0.9, 0.6, 0.06, material('#fff9db'), 0, 0.35, 0));
        item.add(facedBox(0.5, 0.5, 0.02, material('#fff9db'), new THREE.MeshBasicMaterial({ map: labelTexture('@', { bg: '#fff9db', fg: '#1877f2', width: 128, height: 128, font: 'bold 100px Arial' }) }), 0, 0.35, 0.04));
        break;
      case 'terminal':
        item.add(box(1, 0.7, 0.08, dark, 0, 0.4, 0));
        item.add(box(0.92, 0.6, 0.02, new THREE.MeshBasicMaterial({ map: labelTexture('$ hello, world_', { bg: '#0b0f14', fg: '#40c057', width: 256, height: 160, font: 'bold 26px Consolas, monospace' }) }), 0, 0.4, 0.05));
        break;
      case 'commit':
        item.add(cylinder(0.05, 0.05, 1, material('#f05032'), 0, 0.5, 0, 8));
        item.add(sphere(0.18, glow('#f05032', 0.6), 0, 0.5, 0, 12));
        break;
      case 'bug':
        item.add(sphere(0.35, material('#e03131'), 0, 0.4, 0, 12));
        item.add(facedBox(0.6, 0.3, 0.02, material('#e03131'), new THREE.MeshBasicMaterial({ map: labelTexture('Y2K', { bg: '#212529', fg: '#ffd43b', width: 128, height: 64, font: 'bold 44px Arial' }) }), 0, 0.85, 0));
        break;
      case 'duck':
        item.add(sphere(0.32, material('#ffd43b'), 0, 0.32, 0, 12));
        item.add(sphere(0.2, material('#ffd43b'), 0, 0.68, 0.15, 12));
        item.add(box(0.15, 0.06, 0.15, material('#ff922b'), 0, 0.66, 0.36));
        break;
      case 'trophy':
        item.add(cylinder(0.3, 0.12, 0.45, material('#fcc419', { metalness: 0.9, roughness: 0.2 }), 0, 0.6, 0, 16));
        item.add(cylinder(0.08, 0.08, 0.2, material('#fcc419', { metalness: 0.9 }), 0, 0.3, 0, 8));
        item.add(box(0.4, 0.15, 0.4, dark, 0, 0.1, 0));
        break;
      case 'keyboard':
        item.add(box(1.2, 0.1, 0.45, beige, 0, 0.1, 0));
        for (let i = 0; i < 12; i++) item.add(box(0.08, 0.06, 0.08, material('#f8f9fa'), -0.5 + (i % 12) * 0.09, 0.18, -0.1 + Math.floor(i / 12) * 0.1));
        break;
      case 'browser':
        item.add(box(1, 0.75, 0.06, material('#c0c0c0'), 0, 0.42, 0));
        item.add(box(0.9, 0.08, 0.02, material('#000080'), 0, 0.72, 0.04));
        item.add(box(0.9, 0.55, 0.02, material('#ffffff'), 0, 0.36, 0.04));
        break;
      default:
        item.add(box(0.6, 0.6, 0.6, material('#adb5bd'), 0, 0.3, 0));
    }
    return item;
  }

  Object.assign(builders, {
    // Classical column frame with a curved title and wooden shelves of rare items
    showcaseShelf(group, { w, h, d, label, data, block }) {
      const facingAngle = Math.atan2(-block.position[0], -block.position[2]);
      const inner = new THREE.Group();
      inner.rotation.y = facingAngle;
      const marble = material('#efe6d6', { roughness: 0.6 });
      [-1, 1].forEach((side) => {
        inner.add(cylinder(0.6, 0.7, h, marble, side * (w / 2 - 0.6), 0, 0, 16));
        inner.add(box(1.8, 0.5, 1.8, marble, side * (w / 2 - 0.6), -h / 2 + 0.25, 0));
        inner.add(box(1.6, 0.4, 1.6, marble, side * (w / 2 - 0.6), h / 2 - 0.2, 0));
      });
      inner.add(box(w + 0.6, 0.8, d + 0.4, marble, 0, h / 2 + 0.2, 0));
      // Curved title arch above the shelf
      const titleTexture = labelTexture(label || 'Showcase', { bg: '#efe6d6', fg: '#6b4f2a', width: 1024, height: 220, font: 'bold 150px Georgia, serif' });
      const title = mesh(new THREE.CylinderGeometry(w * 0.9, w * 0.9, 2.6, 32, 1, true, -0.55, 1.1), new THREE.MeshBasicMaterial({ map: titleTexture, side: THREE.DoubleSide }), 0, h / 2 + 2.2, -w * 0.9 + d);
      title.rotation.y = Math.PI;
      inner.add(title);
      // Wooden back and shelves with a light strip
      const wood = new THREE.MeshStandardMaterial({ map: repeated(plankTexture('#7a4a26'), 2, 4), roughness: 0.8 });
      inner.add(box(w - 2.2, h - 1, 0.3, wood, 0, 0, -d / 2 + 0.15));
      inner.add(box(w - 2.6, 0.12, 0.4, glow('#ffffff', 1.2), 0, h / 2 - 0.9, -d / 2 + 0.6));
      const items = (data && data.items) || [];
      const shelves = Math.max(1, Math.ceil(items.length / 2));
      for (let s = 0; s < shelves; s++) {
        const y = -h / 2 + 1.6 + s * ((h - 2.4) / shelves);
        inner.add(box(w - 2.2, 0.2, d - 0.3, wood, 0, y, 0));
        items.slice(s * 2, s * 2 + 2).forEach(([name, kind, fact], index) => {
          const x = (index === 0 ? -1 : 1) * (w - 2.2) / 4;
          const model = showcaseModel(kind);
          model.position.set(x, y + 0.1, 0.1);
          model.scale.setScalar(1.3);
          model.userData = { label: name, info: fact };
          inner.add(interactive(model, 'inspect', name));
          animate(model, (time) => { model.rotation.y = Math.sin(time * 0.6 + x) * 0.5; });
          const plaque = facedBox(1.6, 0.35, 0.05, material('#3e2723'), new THREE.MeshBasicMaterial({ map: labelTexture(name, { bg: '#3e2723', fg: '#ffe8a3', width: 512, height: 110, font: 'bold 40px Georgia, serif' }) }), x, y + 0.02, d / 2 - 0.1);
          inner.add(plaque);
        });
      }
      // Puffy cloud cushions at the base like the reference
      for (let i = 0; i < 6; i++) inner.add(sphere(0.9 + (i % 3) * 0.3, material('#f1ede6', { roughness: 1 }), -w / 2 + i * (w / 5), -h / 2 + 0.3, d / 2 + 0.8, 10));
      group.add(inner);
    }
  });

  // Apple-logo textures through BrandLogos (Simple Icons) on product boards
  function productBoard(name, tagline, background, foreground) {
    return BrandLogos.billboardTexture(name, { tagline, background, foreground, logoSlug: 'apple' });
  }

  Object.assign(builders, {
    // Apple Store: glass box with the real Apple logo, Avenue tables with
    // MacBooks/iPhones/iPads to try (E), a Genius Bar and a Today at Apple video wall
    appleStore(group, { w, h, d }) {
      const glass = material('#e9f2fb', { transparent: true, opacity: 0.28, roughness: 0.02, metalness: 0.4, side: THREE.DoubleSide });
      const steel = material('#d0d4d9', { metalness: 0.85, roughness: 0.25 });
      const stone = material('#ece7df', { roughness: 0.5 });
      group.add(box(w, 0.2, d, stone, 0, 0.1, 0));
      // Glass walls with an open sliding-door entrance at the front (+z)
      const back = box(w, h, 0.15, glass, 0, h / 2, -d / 2);
      back.castShadow = false;
      group.add(back);
      [-1, 1].forEach((side) => {
        const wall = box(0.15, h, d, glass, side * w / 2, h / 2, 0);
        wall.castShadow = false;
        group.add(wall);
        const front = box(w / 2 - 3, h, 0.15, glass, side * (w / 4 + 1.5), h / 2, d / 2);
        front.castShadow = false;
        group.add(front);
      });
      group.add(box(6, h - 4.5, 0.15, glass, 0, 4.5 + (h - 4.5) / 2, d / 2));
      // Steel frame and white ceiling with light panels
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) group.add(box(0.12, h, 0.12, steel, x, h / 2, d / 2));
      group.add(box(w + 0.4, 0.5, d + 0.4, material('#f5f5f7'), 0, h + 0.25, 0));
      for (let i = 0; i < 4; i++) group.add(box(w * 0.8, 0.05, 1.2, glow('#ffffff', 0.9), 0, h - 0.05, -d / 2 + (i + 0.5) * (d / 4)));
      // The real Apple logo floating on the front glass
      const logo = box(3.4, 3.4, 0.05, new THREE.MeshBasicMaterial({ map: BrandLogos.billboardTexture('Apple', { tagline: '', background: '#f5f5f7', foreground: '#1d1d1f', width: 512, height: 512, layout: 'logo' }), transparent: true }), 0, h - 2.6, d / 2 + 0.1);
      group.add(logo);
      // Avenue tables (light wood) with devices on display
      const tableWood = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.plankTexture('#d4b48c'), 4, 1), roughness: 0.6 });
      [[-w * 0.22, 0], [w * 0.22, 0], [-w * 0.22, -d * 0.28], [w * 0.22, -d * 0.28]].forEach(([x, z]) => {
        group.add(box(8, 0.12, 1.8, tableWood, x, 1.05, z));
        [-3.2, 3.2].forEach((dx) => group.add(box(0.5, 1, 1.4, tableWood, x + dx, 0.5, z)));
        // MacBooks to try (simulated work with E)
        group.add(laptop(x - 2.4, 1.11, z, 0));
        group.add(laptop(x - 0.8, 1.11, z, Math.PI));
        // iPhones and iPads on stands
        [0.9, 2.4].forEach((dx, index) => {
          const device = new THREE.Group();
          device.add(box(index ? 0.55 : 0.28, index ? 0.75 : 0.56, 0.03, material('#1d1d1f', { metalness: 0.6 }), 0, 0.3, 0));
          device.add(box(index ? 0.5 : 0.24, index ? 0.7 : 0.5, 0.01, new THREE.MeshBasicMaterial({ map: PropKit.kit.artTexture(31 + index + Math.round(x)) }), 0, 0.3, 0.02));
          device.add(box(0.1, 0.2, 0.1, steel, 0, 0.05, -0.05));
          device.rotation.x = -0.2;
          device.position.set(x + dx, 1.11, z);
          group.add(interactive(device, 'inspect', index ? 'iPad on display' : 'iPhone on display'));
          device.userData.info = index ? 'Try the iPad: drawing, coding with Swift Playgrounds and more.' : 'Try the latest iPhone right here at the Apple Store.';
        });
      });
      // Genius Bar along the back wall
      group.add(box(w * 0.5, 1.1, 1, material('#f5f5f7'), 0, 0.55, -d / 2 + 2));
      group.add(box(w * 0.5, 0.06, 1.1, tableWood, 0, 1.13, -d / 2 + 2));
      group.add(facedBox(w * 0.3, 1.2, 0.1, material('#f5f5f7'), new THREE.MeshBasicMaterial({ map: labelTexture('Genius Bar', { bg: '#f5f5f7', fg: '#1d1d1f', font: '600 60px Helvetica, Arial, sans-serif' }) }), 0, h * 0.62, -d / 2 + 0.2));
      for (let i = 0; i < 5; i++) {
        const stool = new THREE.Group();
        stool.add(cylinder(0.3, 0.3, 0.08, tableWood, 0, 0.9, 0, 16));
        stool.add(cylinder(0.04, 0.04, 0.9, steel, 0, 0.45, 0, 6));
        stool.position.set(-w * 0.2 + i * (w * 0.1), 0, -d / 2 + 3.2);
        group.add(interactive(stool, 'sit', 'Genius Bar stool'));
      }
      // Today at Apple video wall: click to watch the official keynotes
      const wall = box(w * 0.45, h * 0.45, 0.2, new THREE.MeshBasicMaterial({ map: productBoard('Today at Apple', 'Click to watch the WWDC keynotes', '#1d1d1f', '#ffffff') }), -w / 2 + 0.3, h * 0.42, d * 0.15);
      wall.rotation.y = Math.PI / 2;
      wall.userData.isKeynoteScreen = true;
      wall.userData.label = 'Today at Apple - click to watch';
      group.add(wall);
      for (let i = 0; i < 3; i++) group.add(box(6, 0.4 + i * 0.4, 1.4, tableWood, -w / 2 + 4, 0.2 + i * 0.2, d * 0.15 - 2 + i * 1.4));
      // Trees in planters like real Apple Stores
      [[w * 0.42, -d * 0.4], [-w * 0.1, d * 0.38], [w * 0.1, d * 0.38]].forEach(([x, z]) => {
        group.add(cylinder(0.9, 0.8, 0.8, stone, x, 0.4, z, 16));
        group.add(cylinder(0.1, 0.15, 3, material('#6d4c41'), x, 2, z, 6));
        group.add(sphere(1.4, material('#2f9e44'), x, 4, z, 12));
      });
    },

    // Freestanding ad boards for Mac and macOS (Apple logo + product names)
    appleBillboard(group, { w, h, label, data }) {
      const [title, tagline] = (label || 'Mac|').split('|');
      const dark = (data && data.dark) !== false;
      group.add(box(0.3, h * 0.4, 0.3, material('#adb5bd', { metalness: 0.8 }), 0, -h * 0.3, 0));
      const face = new THREE.MeshBasicMaterial({ map: productBoard(title, tagline || '', dark ? '#000000' : '#f5f5f7', dark ? '#ffffff' : '#1d1d1f') });
      const board = mesh(new THREE.BoxGeometry(w, h * 0.6, 0.3), [material('#1d1d1f'), material('#1d1d1f'), material('#1d1d1f'), material('#1d1d1f'), face, face]);
      board.position.y = h * 0.2;
      group.add(board);
    }
  });

  const rules = [
    [/gradient_floor/, 'gradientFloor'], [/glass_wall_panel/, 'glassWall'], [/glass_table/, 'glassTable'], [/round_sofa/, 'roundSofa'],
    [/commit_board/, 'commitBoard'], [/parkour_platform/, 'parkourPlatform'], [/^coin/, 'coin'], [/parkour_(start|finish)/, 'parkourPad'],
    [/purple_rocks/, 'purpleRocks'], [/bar_counter/, 'barCounter'], [/floating_crystal/, 'floatingCrystal'], [/wall_tv/, 'wallTv'],
    [/showcase_shelf/, 'showcaseShelf'], [/apple_store/, 'appleStore'], [/apple_billboard/, 'appleBillboard']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
