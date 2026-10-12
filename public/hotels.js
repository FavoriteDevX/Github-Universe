// ============================================================================
// HOTELS: THE MULTIVERSE HOTEL DISTRICT AND MINI HOTELS ACROSS THE WORLDS
// ============================================================================
// Architectural hotels to sleep in at night (E on a bed): sleeping sets your
// spawn point, and when half of the online devs are asleep the night is
// skipped for everyone (like Minecraft).
// - grand_hotel: a glass tower wrapped by giant "M" letters with neon edges,
//   a lobby with red swirling tubes, a spiral staircase to a mezzanine, floating
//   beds, a reception with welcome screens, golden hexagon lamps and fireflies,
//   and a teal lounge with arched windows.
// - mini_hotel: small capsule hotels (teal vaulted pods or neon glass cubes).
(() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, windowsTexture, repeated, canvasTexture } = PropKit.kit;

  // A bed: mattress, pillows, blanket and a glowing base (E to sleep)
  function bed(color = '#f8f9fa', blanket = '#e64980') {
    const group = new THREE.Group();
    group.add(box(2.2, 0.35, 2.8, material('#3a3f4b', { metalness: 0.4 }), 0, 0.2, 0));
    group.add(box(2.1, 0.35, 2.7, material(color, { roughness: 0.9 }), 0, 0.55, 0));
    group.add(box(2.12, 0.12, 1.7, material(blanket, { roughness: 0.95 }), 0, 0.78, 0.45));
    [-0.5, 0.5].forEach((x) => {
      const pillow = sphere(0.45, material('#ffffff', { roughness: 1 }), x, 0.85, -1, 12);
      pillow.scale.set(1, 0.4, 0.7);
      group.add(pillow);
    });
    group.add(box(2.3, 0.05, 2.9, glow('#ff8fd8', 0.9), 0, 0.02, 0));
    group.userData.label = 'Hotel bed';
    return interactive(group, 'bed', 'Hotel bed');
  }

  // Vertical hotel name sign
  function verticalName(text, color, background) {
    return canvasTexture(`hotelname|${text}`, 128, 640, (ctx, w, h) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = color;
      ctx.font = 'bold 74px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
  }

  function welcomeScreen() {
    return canvasTexture('hotelWelcome', 512, 320, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#2b1a3a');
      gradient.addColorStop(1, '#5c1f3a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#ffb703', '#e63946', '#4cc9f0', '#f72585'][i % 4]; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc((i * 97) % w, (i * 61) % h, 20 + (i % 3) * 14, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '600 30px Georgia, serif';
      ctx.fillText('W E L C O M E   T O', w / 2, 90);
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillText('Multiverse', w / 2, 170);
      ctx.font = '600 24px Georgia, serif';
      ctx.fillText('H O T E L  ·  G E N E S I S  C I T Y', w / 2, 230);
    });
  }

  // Giant "M": an extruded letter with a dark face, white sides and neon edges
  function letterM(width, height, depth) {
    const t = width * 0.16;
    const shape = new THREE.Shape();
    const points = [[0, 0], [t, 0], [t, height * 0.62], [width / 2, height * 0.22], [width - t, height * 0.62], [width - t, 0], [width, 0], [width, height], [width - t * 0.85, height], [width / 2, height * 0.45], [t * 0.85, height], [0, height]];
    points.forEach(([x, y], index) => (index ? shape.lineTo(x - width / 2, y) : shape.moveTo(x - width / 2, y)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
    const letter = new THREE.Mesh(geometry, [material('#1b1220', { roughness: 0.25, metalness: 0.4 }), material('#f1ece4', { roughness: 0.5 })]);
    letter.castShadow = true;
    letter.receiveShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: '#ff8fd8' }));
    edges.raycast = () => {};
    letter.add(edges);
    return letter;
  }

  function grandHotel(group, { w, h, d }) {
    const towerW = w * 0.62;
    const towerD = d * 0.62;
    const glass = new THREE.MeshStandardMaterial({ map: repeated(windowsTexture('#1c2a5a', '#ffd8a8'), towerW / 8, h / 10), transparent: true, opacity: 0.88, roughness: 0.1, metalness: 0.5 });
    // Glass tower: back and side walls full height, front open at the lobby level
    group.add(box(towerW, h, 0.4, glass, 0, h / 2, -towerD / 2));
    [-1, 1].forEach((side) => group.add(box(0.4, h, towerD, glass, side * towerW / 2, h / 2, 0)));
    group.add(box(towerW, h - 9, 0.4, glass, 0, 9 + (h - 9) / 2, towerD / 2));
    group.add(box(towerW + 1, 1, towerD + 1, material('#22304f', { metalness: 0.6 }), 0, h, 0));
    // Floors: lobby, mezzanine and upper floors (slabs)
    group.add(box(towerW, 0.3, towerD, new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.gridTexture('#f3eee9', '#d6cfc4', 4), towerW / 6, towerD / 6), roughness: 0.4 }), 0, 0.15, 0));
    const mezzanineY = 6;
    group.add(box(towerW, 0.4, towerD * 0.45, material('#efe7df'), 0, mezzanineY, -towerD * 0.275));
    group.add(box(towerW, 1, 0.1, material('#cfe8ff', { transparent: true, opacity: 0.35 }), 0, mezzanineY + 0.7, -towerD * 0.05));
    for (let floor = 2; floor * 4.5 < h - 4; floor++) group.add(box(towerW - 0.8, 0.3, towerD - 0.8, material('#2b3550'), 0, floor * 4.5 + 3, 0));

    // Giant M letters on the front and back, V-shaped side fins
    const front = letterM(w, h * 0.72, 2.4);
    front.position.set(0, 0, towerD / 2 + 0.6);
    group.add(front);
    const back = letterM(w * 0.9, h * 0.6, 2);
    back.position.set(0, 0, -towerD / 2 - 2.6);
    group.add(back);
    [-1, 1].forEach((side) => {
      const fin = box(1.6, h * 0.55, towerD * 0.9, material('#f1ece4'), side * (w / 2 + 0.2), h * 0.275, 0);
      fin.rotation.z = side * 0.12;
      group.add(fin);
      group.add(box(0.1, h * 0.55, towerD * 0.9, glow('#ff8fd8', 1.4), side * (w / 2 - 0.65), h * 0.275, 0));
    });
    // Hotel name on the right leg of the M
    const name = box(1.4, 9, 0.1, new THREE.MeshBasicMaterial({ map: verticalName('MULTIVERSE HOTEL', '#e03131', '#1b1220') }), w / 2 - w * 0.08, h * 0.32, towerD / 2 + 3.25);
    group.add(name);

    // Lobby: red swirling tubes around the hall
    const red = material('#d62828', { roughness: 0.35, metalness: 0.15 });
    [[0, 4, -towerD * 0.2, 7, 0.5, [0.4, 0, 0]], [0, 5, 0, 8.5, 0.45, [1.2, 0.5, 0]], [-towerW * 0.2, 3.5, 2, 5.5, 0.4, [0.2, 1.3, 0.4]]].forEach(([x, y, z, radius, tube, rotation]) => {
      const swirl = mesh(new THREE.TorusGeometry(radius, tube, 12, 64, Math.PI * 1.4), red, x, y, z);
      swirl.rotation.set(...rotation);
      swirl.raycast = () => {};
      group.add(swirl);
    });
    // Spiral staircase up to the mezzanine
    const steps = 18;
    const stairX = towerW / 2 - 4;
    const stairZ = -towerD * 0.1;
    group.add(cylinder(0.4, 0.4, mezzanineY + 1, material('#e9ecef'), stairX, (mezzanineY + 1) / 2, stairZ, 12));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 1.6 + Math.PI / 2;
      const step = box(2.6, 0.25, 0.9, material(i % 2 ? '#8d1b2c' : '#a4161a'), stairX + Math.cos(angle) * 1.6, 0.3 + (i + 1) * (mezzanineY / steps), stairZ + Math.sin(angle) * 1.6);
      step.rotation.y = -angle;
      group.add(step);
    }
    // Reception desk with welcome screens
    group.add(box(6, 1.2, 1.2, material('#f8f9fa', { roughness: 0.3 }), -towerW * 0.15, 0.75, towerD * 0.25));
    [-1, 1].forEach((side) => {
      const screen = box(2.4, 1.5, 0.1, new THREE.MeshBasicMaterial({ map: welcomeScreen() }), -towerW * 0.15 + side * 1.4, 2.2, towerD * 0.25 + 0.4);
      screen.rotation.y = Math.PI + side * 0.25;
      group.add(screen);
      group.add(box(2.5, 1.6, 0.05, glow('#ff8fd8', 1.2), -towerW * 0.15 + side * 1.4, 2.2, towerD * 0.25 + 0.45));
    });
    group.add(PropKit.kit.textSprite('Reception · E on any bed to sleep', { width: 7, background: 'rgba(91, 31, 58, 0.9)' }));
    group.children[group.children.length - 1].position.set(-towerW * 0.15, 4, towerD * 0.25);
    // Floating beds on the mezzanine and in the lobby
    [[-towerW * 0.3, mezzanineY + 0.2, -towerD * 0.4], [-towerW * 0.05, mezzanineY + 0.2, -towerD * 0.4], [towerW * 0.15, mezzanineY + 0.2, -towerD * 0.4], [-towerW * 0.35, 0.3, towerD * 0.05], [-towerW * 0.35, 0.3, -towerD * 0.12]].forEach(([x, y, z], index) => {
      const hotelBed = bed('#fff4e6', ['#e64980', '#4dabf7', '#ffd43b', '#69db7c', '#9775fa'][index % 5]);
      hotelBed.position.set(x, y, z);
      group.add(hotelBed);
    });
    // Golden hexagon lamps hanging in the air
    const lamps = [];
    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.Group();
      lamp.add(cylinder(1.6, 1.6, 0.25, material('#c9a227', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 6));
      lamp.add(cylinder(1.65, 1.65, 0.05, glow('#ff8fd8', 1.6), 0, -0.15, 0, 6));
      lamp.position.set(-towerW * 0.3 + i * (towerW * 0.15), 9 + (i % 2) * 1.5, -towerD * 0.1 + (i % 3) * 2);
      lamp.rotation.z = (i % 2 ? 0.2 : -0.2);
      group.add(lamp);
      lamps.push(lamp);
    }
    // Fireflies drifting through the lobby
    const fireflies = [];
    for (let i = 0; i < 40; i++) {
      const firefly = sphere(0.06, glow('#ffe066', 3), 0, 0, 0, 4);
      firefly.castShadow = false;
      firefly.raycast = () => {};
      firefly.userData.seed = i * 1.37;
      group.add(firefly);
      fireflies.push(firefly);
    }
    // Teal lounge with arched windows at the back of the lobby
    const teal = material('#3bc9db', { roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const sofa = mesh(new THREE.TorusGeometry(1.6, 0.45, 8, 24, Math.PI * 1.2), teal, towerW * 0.18 + i * 3.6 - 3.6, 0.6, -towerD * 0.05);
      sofa.rotation.x = Math.PI / 2;
      group.add(sofa);
      group.add(PropKit.kit.seat(towerW * 0.18 + i * 3.6 - 3.6, 0.8, -towerD * 0.05 + 1, 'Lounge sofa'));
      group.add(cylinder(0.8, 0.8, 0.1, material('#f1f3f5'), towerW * 0.18 + i * 3.6 - 3.6, 0.9, -towerD * 0.05 + 1.2, 20));
    }
    for (let i = 0; i < 4; i++) {
      const arch = mesh(new THREE.TorusGeometry(1.4, 0.15, 8, 24, Math.PI), material('#f1ece4'), -towerW * 0.3 + i * (towerW * 0.2), 4.2, -towerD / 2 + 0.3);
      group.add(arch);
    }
    animate(group, (time) => {
      lamps.forEach((lamp, i) => { lamp.position.y = 9 + (i % 2) * 1.5 + Math.sin(time * 0.8 + i) * 0.3; lamp.rotation.y = time * 0.2 + i; });
      fireflies.forEach((firefly) => {
        const s = firefly.userData.seed;
        firefly.position.set(Math.sin(time * 0.3 + s) * towerW * 0.4, 2 + Math.abs(Math.sin(time * 0.5 + s * 2)) * 8, Math.cos(time * 0.25 + s * 1.3) * towerD * 0.4);
        firefly.material.emissiveIntensity = 2 + Math.sin(time * 6 + s) * 1.5;
      });
    });
    group.userData.label = 'Multiverse Hotel';
  }

  // Small capsule hotel: a teal vaulted pod with arched windows, or a neon cube
  function miniHotel(group, { w, h, d, data }) {
    const variant = (data && data.variant) || 'pod';
    if (variant === 'cube') {
      const glass = new THREE.MeshStandardMaterial({ color: '#2b2d5a', transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.5 });
      group.add(box(w, 0.3, d, material('#f1ece4'), 0, 0.15, 0));
      group.add(box(w, h, 0.2, glass, 0, h / 2, -d / 2));
      [-1, 1].forEach((side) => group.add(box(0.2, h, d, glass, side * w / 2, h / 2, 0)));
      group.add(box(w, 0.4, d, material('#1b1220'), 0, h, 0));
      const letter = letterM(w * 0.5, h * 0.55, 0.6);
      letter.position.set(0, h + 0.4, d / 2 - 1);
      group.add(letter);
    } else {
      const teal = material('#63c5c9', { roughness: 0.45, side: THREE.DoubleSide });
      group.add(cylinder(w / 2 + 0.6, w / 2 + 0.6, 0.3, material('#f1ece4'), 0, 0.15, 0, 32));
      const vault = mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 32, 1, true, -Math.PI / 2, Math.PI), teal, 0, 0.3, 0);
      vault.rotation.x = Math.PI / 2;
      group.add(vault);
      for (let i = -1; i <= 1; i++) group.add(mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 20, Math.PI), material('#ffffff'), i * w * 0.28, w * 0.28, -d / 2 + 0.2));
      group.add(box(w, w / 2, 0.2, material('#bfe3ff', { transparent: true, opacity: 0.3 }), 0, w / 4 + 0.3, -d / 2));
    }
    [-1, 1].forEach((side) => {
      const hotelBed = bed('#fff4e6', side < 0 ? '#3bc9db' : '#f06595');
      hotelBed.position.set(side * w * 0.22, 0.3, -d * 0.1);
      group.add(hotelBed);
    });
    const sign = textSprite(`🛏️ ${(data && data.name) || 'Mini Hotel'} · sleep here (E)`, { width: 7, background: 'rgba(91, 31, 58, 0.9)' });
    sign.position.set(0, h + 2.5, d / 2);
    group.add(sign);
    group.userData.label = (data && data.name) || 'Mini Hotel';
  }

  // Big title card shown when you walk into a place ("The Hotel")
  let titleCard = null;
  function showTitle(text) {
    if (!titleCard) {
      titleCard = document.createElement('div');
      titleCard.id = 'area-title';
      document.body.appendChild(titleCard);
    }
    titleCard.innerHTML = `<span>${text}</span>`;
    titleCard.classList.remove('show');
    void titleCard.offsetWidth;
    titleCard.classList.add('show');
  }

  // Cozy lodge hotel: dark wood, green wallpaper, a brick fireplace with a
  // real fire, warm wall sconces, reception, notice board and a corridor of rooms
  function lodgeHotel(group, { w, h, d, data }) {
    const wood = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.plankTexture('#5a3a24'), w / 4, 1), roughness: 0.8 });
    const darkWood = material('#3b2414', { roughness: 0.8 });
    const wallpaper = new THREE.MeshStandardMaterial({ map: canvasTexture('lodgeWallpaper', 128, 128, (ctx, cw, ch) => {
      ctx.fillStyle = '#1f3b2c'; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#2b4d3a'; ctx.lineWidth = 3;
      for (let x = 0; x < cw; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    }), roughness: 0.9, side: THREE.DoubleSide });
    wallpaper.map.wrapS = wallpaper.map.wrapT = THREE.RepeatWrapping;
    wallpaper.map.repeat.set(w / 3, h / 3);
    // Floor, ceiling and walls (entrance on the front, +z)
    group.add(box(w, 0.3, d, wood, 0, 0.15, 0));
    group.add(box(w, 0.3, d, darkWood, 0, h, 0));
    group.add(box(w, h, 0.4, wallpaper, 0, h / 2, -d / 2));
    [-1, 1].forEach((side) => group.add(box(0.4, h, d, wallpaper, side * w / 2, h / 2, 0)));
    [-1, 1].forEach((side) => group.add(box(w / 2 - 1.6, h, 0.4, wallpaper, side * (w / 4 + 0.8), h / 2, d / 2)));
    group.add(box(3.2, h - 3.4, 0.4, wallpaper, 0, 3.4 + (h - 3.4) / 2, d / 2));
    // Wainscoting (wood panels on the lower walls) and ceiling beams
    group.add(box(w - 0.9, 1.4, 0.1, darkWood, 0, 0.9, -d / 2 + 0.25));
    [-1, 1].forEach((side) => group.add(box(0.1, 1.4, d - 0.9, darkWood, side * (w / 2 - 0.25), 0.9, 0)));
    for (let i = 0; i < 5; i++) group.add(box(w, 0.35, 0.35, darkWood, 0, h - 0.3, -d / 2 + (i + 0.5) * (d / 5)));
    // Gabled roof outside
    const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.7, 4), material('#3b2414', { roughness: 1 }), 0, h + h * 0.35, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    group.add(roof);
    // Brick fireplace with a fire on the left wall
    const brick = new THREE.MeshStandardMaterial({ map: repeated(PropKit.kit.brickTexture('#7a3b2e'), 2, 2), roughness: 0.9 });
    group.add(box(1.4, h, 4, brick, -w / 2 + 0.9, h / 2, -d * 0.15));
    group.add(box(0.6, 1.6, 2.2, material('#120b08'), -w / 2 + 1.4, 1.1, -d * 0.15));
    group.add(box(0.9, 0.25, 4.4, darkWood, -w / 2 + 1.5, 2.2, -d * 0.15));
    const flames = [];
    [['#ffd43b', 0.9, 1.2], ['#ff922b', 1.2, 1.5], ['#e8590c', 0.7, 0.9]].forEach(([color, width, height], i) => {
      const flame = mesh(new THREE.ConeGeometry(width / 2, height, 8), glow(color, 2.2, { transparent: true, opacity: 0.85 }), -w / 2 + 1.5, 0.3 + height / 2, -d * 0.15 + (i - 1) * 0.4);
      flame.raycast = () => {};
      group.add(flame);
      flames.push(flame);
    });
    const fireLight = new THREE.PointLight('#ff9a3c', 1.4, 14, 2);
    fireLight.position.set(-w / 2 + 2.2, 1.4, -d * 0.15);
    group.add(fireLight);
    // Warm wall sconces along the walls
    const sconces = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -d / 2 + 2 + Math.floor(i / 2) * ((d - 4) / 2);
      const sconce = box(0.25, 0.3, 0.6, glow('#ffe8a3', 2.2), side * (w / 2 - 0.35), h * 0.62, z);
      group.add(sconce);
      sconces.push(sconce);
    }
    const lampLight = new THREE.PointLight('#ffd8a8', 0.8, 18, 2);
    lampLight.position.set(w * 0.2, h - 1, 0);
    group.add(lampLight);
    // Reception desk, notice board, rug and armchairs by the fire
    group.add(box(4, 1.2, 1.2, darkWood, w * 0.25, 0.75, -d / 2 + 2.4));
    group.add(box(4.2, 0.1, 1.4, material('#2b1a10'), w * 0.25, 1.4, -d / 2 + 2.4));
    group.add(box(0.5, 0.3, 0.3, glow('#ffd43b', 1), w * 0.25 + 1.2, 1.6, -d / 2 + 2.4));
    group.add(box(3, 2, 0.1, material('#6d4c41'), w / 2 - 0.3, 2.6, d * 0.1));
    group.children[group.children.length - 1].rotation.y = -Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const note = box(0.5, 0.6, 0.02, material('#f1ece4'), w / 2 - 0.36, 2.2 + (i % 2) * 0.8, d * 0.1 - 1.1 + Math.floor(i / 2) * 0.9);
      note.rotation.set(0, -Math.PI / 2, (i - 2.5) * 0.08);
      group.add(note);
    }
    const rug = box(5, 0.05, 3.5, material('#7b1e1e', { roughness: 1 }), -w / 2 + 5, 0.33, -d * 0.15);
    rug.castShadow = false;
    group.add(rug);
    [-1, 1].forEach((side) => {
      const chair = new THREE.Group();
      chair.add(box(1.2, 0.5, 1.1, material('#4a2c1a'), 0, 0.55, 0));
      chair.add(box(1.2, 1, 0.25, material('#4a2c1a'), 0, 1.1, -0.45));
      chair.position.set(-w / 2 + 5, 0.3, -d * 0.15 + side * 1.6);
      chair.rotation.y = -Math.PI / 2;
      group.add(interactive(chair, 'sit', 'Armchair by the fire'));
    });
    // Corridor of rooms along the back half with beds (E to sleep)
    const rooms = Math.max(2, Math.floor(w / 6) - 1);
    for (let i = 0; i < rooms; i++) {
      const x = -w / 2 + 4 + i * ((w - 6) / rooms) + 1;
      const hotelBed = bed('#f1ece4', ['#7b1e1e', '#1f3b2c', '#1c2a5a'][i % 3]);
      hotelBed.position.set(x, 0.3, d / 2 - 3.6);
      hotelBed.rotation.y = Math.PI;
      group.add(hotelBed);
      group.add(box(0.15, h * 0.6, 3, darkWood, x + (w - 6) / rooms / 2, h * 0.3, d / 2 - 3.4));
      group.add(box(0.35, 0.35, 0.35, glow('#ffe8a3', 1.6), x, 1.1, d / 2 - 1.4));
    }
    const titleText = (data && data.title) || 'The Hotel';
    let inside = false;
    const center = new THREE.Vector3();
    animate(group, (time) => {
      flames.forEach((flame, i) => { flame.scale.set(1, 0.85 + Math.sin(time * (9 + i * 3)) * 0.15, 1); });
      fireLight.intensity = 1.3 + Math.sin(time * 12) * 0.2 + Math.sin(time * 27) * 0.1;
      sconces.forEach((sconce, i) => { sconce.material.emissiveIntensity = 2 + Math.sin(time * 3 + i) * 0.15; });
      if (typeof avatar === 'undefined') return;
      group.getWorldPosition(center);
      const local = avatar.position.clone().sub(center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -group.rotation.y);
      const nowInside = Math.abs(local.x) < w / 2 && Math.abs(local.z) < d / 2 && local.y > -1 && local.y < h;
      if (nowInside && !inside) showTitle(titleText);
      inside = nowInside;
    });
    group.userData.label = titleText;
  }

  PropKit.registerBuilder(/lodge_hotel/, 'lodgeHotel', lodgeHotel);
  PropKit.registerBuilder(/grand_hotel/, 'grandHotel', grandHotel);
  PropKit.registerBuilder(/mini_hotel/, 'miniHotel', miniHotel);
})();
