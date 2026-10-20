// ============================================================================
// THE GLASS CUBE: A FIFTH AVENUE-STYLE STORE WITH THE UNDERGROUND TECH HUB
// ============================================================================
// A tribute to the famous glass cube on a granite plaza (no copied plans):
// - Plaza: light granite slabs, rows of fountains, planters with trees and
//   benches. In the middle, a ~10 m cube of clear glass panels held by
//   minimal steel fittings, with the GitHub Multiverse logo floating at the
//   top of the entrance face (instead of the original logo).
// - Inside the cube, a glass spiral staircase around a cylindrical glass
//   elevator goes down through a shaft into the Underground Tech Hub.
// - Tech Hub: a bright minimalist hall (white ceiling with round skylights,
//   steel columns, ficus trees, green walls) with oak tables and laptops.
//   Commits typed on these laptops give +5 MVC instead of +3 (checked by the
//   server from your position).
// Glass is collidable (solid panels), the stairs are real steps (0.25 m).
(() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, canvasTexture } = PropKit.kit;
  const HALL_Y = -12; // floor of the Tech Hub (local to the district)
  const SHAFT = 10; // the cube and its opening in the plaza are 10 x 10 m

  function graniteTexture() {
    return canvasTexture('glasscube-granite', 512, 512, (ctx, w) => {
      let seed = 77;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const slab = 128;
      for (let y = 0; y < w; y += slab) {
        for (let x = 0; x < w; x += slab) {
          ctx.fillStyle = `hsl(36, 6%, ${80 + random() * 6}%)`;
          ctx.fillRect(x, y, slab, slab);
          for (let i = 0; i < 260; i++) {
            ctx.fillStyle = ['rgba(60,60,60,0.25)', 'rgba(255,255,255,0.35)', 'rgba(120,100,90,0.2)'][i % 3];
            ctx.fillRect(x + random() * slab, y + random() * slab, 1 + random() * 2, 1 + random() * 2);
          }
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, slab - 2, slab - 2);
        }
      }
    });
  }

  function glassMaterial() {
    // Opacity >= 0.2 keeps the panels solid for the avatar's collision rays
    return new THREE.MeshStandardMaterial({ color: '#d8f1ff', transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0.6, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  }

  function oakMaterial() {
    const texture = canvasTexture('glasscube-oak', 512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#d9b48a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(140, 95, 55, 0.18)' : 'rgba(255, 240, 210, 0.2)';
        ctx.beginPath();
        const y = (i / 60) * h;
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 1.5);
        ctx.stroke();
      }
    });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 });
  }

  function laptop(x, y, z, turn) {
    const group = new THREE.Group();
    group.add(box(0.36, 0.02, 0.25, material('#c9ccd1', { metalness: 0.8, roughness: 0.3 }), 0, 0.01, 0));
    const lid = new THREE.Group();
    lid.add(box(0.36, 0.24, 0.015, material('#c9ccd1', { metalness: 0.8, roughness: 0.3 }), 0, 0.12, 0));
    lid.add(box(0.33, 0.21, 0.004, glow('#74c0fc', 1.1), 0, 0.12, 0.01));
    lid.position.set(0, 0.02, -0.12);
    lid.rotation.x = -0.25;
    group.add(lid);
    group.position.set(x, y, z);
    group.rotation.y = turn;
    group.userData.techHub = true;
    return interactive(group, 'laptop', 'Tech Hub laptop (+5 MVC per commit)');
  }

  function glassCubeStore(group, { label }) {
    const granite = new THREE.MeshStandardMaterial({ map: graniteTexture(), roughness: 0.75 });
    granite.map.wrapS = granite.map.wrapT = THREE.RepeatWrapping;
    granite.map.repeat.set(6, 6);
    const glass = glassMaterial();
    const steel = material('#d0d4d9', { metalness: 0.9, roughness: 0.2 });
    // --- Plaza: a granite deck around the opening (four slabs leave the 10 m hole)
    const deck = 52;
    const side = (deck - SHAFT) / 2;
    [[0, -(SHAFT / 2 + side / 2), deck, side], [0, SHAFT / 2 + side / 2, deck, side], [-(SHAFT / 2 + side / 2), 0, side, SHAFT], [SHAFT / 2 + side / 2, 0, side, SHAFT]].forEach(([x, z, w, d]) => {
      group.add(box(w, 0.2, d, granite, x, 0.1, z));
    });
    // Rows of fountains along two sides, with stone basins
    const jets = [];
    [-1, 1].forEach((sideX) => {
      group.add(box(2.4, 0.5, 30, material('#bfc3c7', { roughness: 0.6 }), sideX * 21, 0.45, 0));
      group.add(box(2, 0.1, 29.6, new THREE.MeshStandardMaterial({ color: '#7cc4e8', transparent: true, opacity: 0.85, roughness: 0.05 }), sideX * 21, 0.66, 0));
      for (let i = 0; i < 12; i++) {
        const jet = cylinder(0.05, 0.12, 1.2, new THREE.MeshStandardMaterial({ color: '#e7f5ff', transparent: true, opacity: 0.55, depthWrite: false }), sideX * 21, 1.2, -13.5 + i * 2.45, 6);
        jet.raycast = () => {};
        jets.push(jet);
        group.add(jet);
      }
    });
    // Planters with trees and benches
    [[-15, -18], [15, -18], [-15, 18], [15, 18]].forEach(([x, z]) => {
      group.add(box(4, 0.7, 4, material('#9aa0a6'), x, 0.55, z));
      group.add(cylinder(0.25, 0.32, 3, material('#6b4a2f'), x, 2.2, z, 7));
      group.add(sphere(2.1, material('#4f8f3a', { flatShading: true, roughness: 0.9 }), x, 4.4, z, 8));
      const bench = box(3.2, 0.45, 0.7, material('#b07d4f'), x, 0.42, z + (z < 0 ? 3 : -3));
      group.add(interactive(bench, 'sit', 'Plaza bench'));
    });
    // --- The cube: 3 x 3 glass panels per face held by small steel fittings
    const pane = SHAFT / 3;
    const height = SHAFT;
    for (let face = 0; face < 4; face++) {
      const faceGroup = new THREE.Group();
      faceGroup.rotation.y = (face * Math.PI) / 2;
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          // The entrance: the lower middle panel of the front face is the door opening
          if (face === 0 && col === 1 && row === 0) continue;
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(pane - 0.03, pane - 0.03), glass);
          panel.position.set(-SHAFT / 2 + pane / 2 + col * pane, 0.2 + pane / 2 + row * pane, SHAFT / 2);
          faceGroup.add(panel);
        }
      }
      // Fittings at every joint
      for (let col = 0; col <= 3; col++) {
        for (let row = 0; row <= 3; row++) faceGroup.add(box(0.18, 0.18, 0.08, steel, -SHAFT / 2 + col * pane, 0.2 + row * pane, SHAFT / 2 + 0.02));
      }
      group.add(faceGroup);
    }
    // Glass roof and the door frame
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(SHAFT, SHAFT).rotateX(-Math.PI / 2), glass);
    roof.position.y = height + 0.2;
    group.add(roof);
    group.add(box(pane, 0.12, 0.2, steel, 0, 0.2 + pane, SHAFT / 2 + 0.05));
    // The logo floating at the top of the entrance face (GitHub Multiverse)
    const logoMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    new THREE.TextureLoader().load('assets/logo.png', (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      logoMaterial.map = texture;
      logoMaterial.needsUpdate = true;
      const aspect = texture.image.width / texture.image.height;
      logo.scale.set(Math.min(1, aspect), Math.min(1, 1 / aspect), 1);
    });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), logoMaterial);
    logo.position.set(0, height - 1.9, SHAFT / 2 - 0.25);
    logo.raycast = () => {};
    group.add(logo);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }));
    halo.position.set(0, height - 1.9, SHAFT / 2 - 0.3);
    halo.raycast = () => {};
    group.add(halo);
    // Glow on the plaza at night: the cube is lit from inside
    const lightRing = box(SHAFT + 0.4, 0.04, SHAFT + 0.4, glow('#f8f9fa', 0.6, { transparent: true, opacity: 0.5 }), 0, 0.22, 0);
    lightRing.raycast = () => {};
    group.add(lightRing);

    // --- Shaft from the plaza down to the hall ceiling (white stone walls)
    const shaftTop = 0;
    const hallHeight = 5.2;
    const hallCeiling = HALL_Y + hallHeight;
    const shaftDepth = shaftTop - hallCeiling;
    const wallStone = material('#f1f0ec', { roughness: 0.8 });
    [[0, -SHAFT / 2, SHAFT, 0.3], [0, SHAFT / 2, SHAFT, 0.3], [-SHAFT / 2, 0, 0.3, SHAFT], [SHAFT / 2, 0, 0.3, SHAFT]].forEach(([x, z, w, d]) => {
      group.add(box(w, shaftDepth, d, wallStone, x, hallCeiling + shaftDepth / 2, z));
    });

    // --- Spiral staircase around the glass elevator (from the plaza to the hall)
    const stairMaterial = new THREE.MeshStandardMaterial({ color: '#e9f6ff', transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.3 });
    const steps = Math.round((0 - HALL_Y) / 0.25);
    const turnPerStep = (Math.PI * 2) / 18;
    const stepRadius = 3.1;
    for (let i = 0; i < steps; i++) {
      const angle = i * turnPerStep;
      const y = -0.25 * (i + 1) + 0.2;
      const step = box(2.2, 0.12, 1.05, stairMaterial, Math.cos(angle) * stepRadius, y, Math.sin(angle) * stepRadius);
      step.rotation.y = -angle;
      group.add(step);
    }
    // Glass balustrade along the outer edge (thin rings every half turn)
    for (let i = 0; i <= steps; i += 3) {
      const angle = i * turnPerStep;
      const post = cylinder(0.025, 0.025, 1.1, steel, Math.cos(angle) * (stepRadius + 1.15), -0.25 * i + 0.75, Math.sin(angle) * (stepRadius + 1.15), 6);
      post.raycast = () => {};
      group.add(post);
    }
    // Central glass elevator (E: up or down)
    const tube = cylinder(1.35, 1.35, -HALL_Y + 3, glassMaterial(), 0, HALL_Y + (-HALL_Y + 3) / 2, 0, 24);
    tube.material.side = THREE.DoubleSide;
    group.add(tube);
    const downCall = new THREE.Object3D();
    downCall.position.set(0, 1, 1.6);
    downCall.userData.destination = new THREE.Vector3(0, HALL_Y + 0.3, 2.2);
    group.add(interactive(downCall, 'warp', 'Glass elevator down to the Tech Hub'));
    const upCall = new THREE.Object3D();
    upCall.position.set(0, HALL_Y + 1, 1.6);
    upCall.userData.destination = new THREE.Vector3(0, 0.5, 7);
    group.add(interactive(upCall, 'warp', 'Glass elevator up to the plaza'));

    // --- Underground Tech Hub
    const hallW = 40;
    const hallD = 34;
    const floor = box(hallW, 0.3, hallD, material('#f3f1ec', { roughness: 0.35 }), 0, HALL_Y - 0.15, 0);
    group.add(floor);
    // Ceiling with the opening of the shaft and round skylights
    const ceilingMaterial = material('#fbfbf9', { roughness: 0.9 });
    const ring = (hallW - SHAFT) / 2;
    [[0, -(SHAFT / 2 + (hallD - SHAFT) / 4), hallW, (hallD - SHAFT) / 2], [0, SHAFT / 2 + (hallD - SHAFT) / 4, hallW, (hallD - SHAFT) / 2], [-(SHAFT / 2 + ring / 2), 0, ring, SHAFT], [SHAFT / 2 + ring / 2, 0, ring, SHAFT]].forEach(([x, z, w, d]) => {
      group.add(box(w, 0.4, d, ceilingMaterial, x, hallCeiling + 0.2, z));
    });
    [[-13, -11], [13, -11], [-13, 11], [13, 11], [0, -13], [0, 13]].forEach(([x, z]) => {
      const oculus = cylinder(1.4, 1.4, 0.05, glow('#e7f5ff', 1.8), x, hallCeiling - 0.03, z, 32);
      oculus.raycast = () => {};
      group.add(oculus);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.06, 6, 40).rotateX(Math.PI / 2), steel);
      rim.position.set(x, hallCeiling - 0.05, z);
      rim.raycast = () => {};
      group.add(rim);
    });
    // Walls: warm stone with green living walls
    [[0, -hallD / 2, hallW, 0.4], [0, hallD / 2, hallW, 0.4], [-hallW / 2, 0, 0.4, hallD], [hallW / 2, 0, 0.4, hallD]].forEach(([x, z, w, d]) => {
      group.add(box(w, hallHeight, d, material('#e8e2d6', { roughness: 0.8 }), x, HALL_Y + hallHeight / 2, z));
    });
    [[-hallW / 2 + 0.25, 0, 0.1, 18], [hallW / 2 - 0.25, 0, 0.1, 18]].forEach(([x, z, w, d]) => {
      const living = box(w, 2.6, d, material('#3f7d3a', { roughness: 1, flatShading: true }), x, HALL_Y + 1.8, z);
      group.add(living);
    });
    // Stainless steel round columns
    [[-9, -8], [9, -8], [-9, 8], [9, 8]].forEach(([x, z]) => group.add(cylinder(0.55, 0.55, hallHeight, steel, x, HALL_Y + hallHeight / 2, z, 24)));
    // Ficus trees in round planters
    [[-15, -5], [-15, 5], [15, -5], [15, 5]].forEach(([x, z]) => {
      group.add(cylinder(1, 1, 0.6, material('#d9d4c7'), x, HALL_Y + 0.3, z, 20));
      group.add(cylinder(0.12, 0.16, 2.4, material('#6b4a2f'), x, HALL_Y + 1.8, z, 6));
      group.add(sphere(1.3, material('#2f6b2f', { flatShading: true }), x, HALL_Y + 3.4, z, 8));
    });
    // Oak tables with laptops (+5 MVC per commit) and stools
    const oak = oakMaterial();
    const tables = [[-9, -1.5], [9, -1.5], [-9, 3.5], [9, 3.5], [0, -12], [0, 12]];
    tables.forEach(([x, z]) => {
      const length = 6;
      group.add(box(length, 0.08, 1.4, oak, x, HALL_Y + 0.92, z));
      [-length / 2 + 0.4, length / 2 - 0.4].forEach((lx) => group.add(box(0.12, 0.88, 1.2, oak, x + lx, HALL_Y + 0.44, z)));
      for (let i = 0; i < 4; i++) {
        const lx = x - length / 2 + 0.9 + i * 1.4;
        group.add(laptop(lx, HALL_Y + 0.96, z - 0.25, 0));
        const stool = cylinder(0.22, 0.22, 0.7, material('#495057', { metalness: 0.6 }), lx, HALL_Y + 0.35, z - 1.1, 12);
        group.add(interactive(stool, 'sit', 'Stool'));
      }
    });
    const sign = textSprite('Tech Hub · commits here give +5 MVC', { width: 9, background: 'rgba(43, 45, 66, 0.9)' });
    sign.position.set(0, HALL_Y + 4.2, -6);
    group.add(sign);
    const title = textSprite(label || 'The Glass Cube', { width: 7, background: 'rgba(20, 20, 24, 0.85)' });
    title.position.set(0, height + 2.2, 0);
    group.add(title);
    animate(group, (time) => {
      jets.forEach((jet, i) => { jet.scale.y = 0.75 + Math.abs(Math.sin(time * 2.2 + i * 0.6)) * 0.6; });
    });
  }

  PropKit.registerBuilder(/glass_cube_store/, 'glassCubeStore', glassCubeStore);
})();
