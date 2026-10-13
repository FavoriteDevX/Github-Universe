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

  // ---------------------------------------------------------------------------
  // The Hotel: a two-floor log cabin (like Roblox horror cabins) with green
  // wallpaper, a stone chimney fireplace, a mezzanine with stairs and rooms,
  // pendant lamps and cobwebs; a back door to a fenced backyard with pine
  // trees, a concrete bunker and a round hatch that leads down to a maze of
  // metal ventilation ducts. The right path ends at a vent that drops you in
  // the Genesis Plaza Underground.
  // ---------------------------------------------------------------------------
  const textures = {};
  function woodTexture(base) {
    return textures[`wood${base}`] || (textures[`wood${base}`] = repeated(PropKit.kit.plankTexture(base), 1, 1));
  }
  function stoneTexture() {
    return textures.stone || (textures.stone = canvasTexture('chimneyStone', 256, 256, (ctx, cw, ch) => {
      ctx.fillStyle = '#3d3a37'; ctx.fillRect(0, 0, cw, ch);
      let seed = 3;
      const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = ['#5a5652', '#4a4744', '#66615c'][i % 3];
        ctx.beginPath(); ctx.ellipse(random() * cw, random() * ch, 18 + random() * 22, 12 + random() * 14, random() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }));
  }
  function metalTexture() {
    return textures.metal || (textures.metal = canvasTexture('ductMetal', 256, 256, (ctx, cw, ch) => {
      const gradient = ctx.createLinearGradient(0, 0, cw, ch);
      gradient.addColorStop(0, '#9aa3ab'); gradient.addColorStop(1, '#7d868e');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      for (let y = 0; y < ch; y += 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y + (y % 7)); ctx.stroke(); }
      ctx.strokeStyle = '#5c646b'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, cw - 4, ch - 4);
      ctx.fillStyle = '#4b5258';
      [[12, 12], [cw - 12, 12], [12, ch - 12], [cw - 12, ch - 12], [cw / 2, 12], [cw / 2, ch - 12]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
    }));
  }
  function cobwebTexture() {
    return textures.web || (textures.web = canvasTexture('cobweb', 128, 128, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(240, 240, 240, 0.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const angle = (i / 6) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * cw, Math.sin(angle) * ch); ctx.stroke(); }
      for (let r = 20; r < cw; r += 20) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI / 2); ctx.stroke(); }
    }));
  }

  function lodgeHotel(group, { w, h, d, data }) {
    const floorH = h / 2;
    const plank = new THREE.MeshStandardMaterial({ map: woodTexture('#9c7a3c'), roughness: 0.8 });
    plank.map.repeat.set(w / 4, d / 4);
    const darkWood = material('#4a2c17', { roughness: 0.8 });
    const logWall = new THREE.MeshStandardMaterial({ map: canvasTexture('logWall', 256, 256, (ctx, cw, ch) => {
      for (let y = 0; y < ch; y += 32) {
        const gradient = ctx.createLinearGradient(0, y, 0, y + 32);
        gradient.addColorStop(0, '#8a6a43'); gradient.addColorStop(0.5, '#b08b5c'); gradient.addColorStop(1, '#6e5233');
        ctx.fillStyle = gradient; ctx.fillRect(0, y, cw, 32);
      }
    }), roughness: 0.9, side: THREE.DoubleSide });
    logWall.map.wrapS = logWall.map.wrapT = THREE.RepeatWrapping;
    logWall.map.repeat.set(w / 6, h / 4);
    const wallpaper = new THREE.MeshStandardMaterial({ map: canvasTexture('lodgeWallpaper', 128, 128, (ctx, cw, ch) => {
      ctx.fillStyle = '#1f3b2c'; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#2b4d3a'; ctx.lineWidth = 3;
      for (let x = 0; x < cw; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    }), roughness: 0.9, side: THREE.DoubleSide });
    wallpaper.map.wrapS = wallpaper.map.wrapT = THREE.RepeatWrapping;
    wallpaper.map.repeat.set(w / 3, floorH / 3);
    // Floor, outer log walls (doors front +z and back -z), green wallpaper on the ground floor
    group.add(box(w, 0.3, d, plank, 0, 0.15, 0));
    [-1, 1].forEach((side) => {
      group.add(box(0.5, h, d, logWall, side * w / 2, h / 2, 0));
      group.add(box(0.05, floorH - 0.3, d - 1, wallpaper, side * (w / 2 - 0.3), floorH / 2 + 0.15, 0));
      [-1, 1].forEach((face) => {
        group.add(box(w / 2 - 1.6, h, 0.5, logWall, side * (w / 4 + 0.8), h / 2, face * d / 2));
      });
    });
    [-1, 1].forEach((face) => group.add(box(3.2, h - 3.4, 0.5, logWall, 0, 3.4 + (h - 3.4) / 2, face * d / 2)));
    // Gabled roof with exposed beams inside
    const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4), material('#3b2414', { roughness: 1 }), 0, h + h * 0.27, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    group.add(roof);
    group.add(box(w, 0.3, d, darkWood, 0, h, 0));
    for (let i = 0; i < 4; i++) {
      const beam = box(0.4, 0.4, d, darkWood, -w / 2 + (i + 0.5) * (w / 4), h - 0.5, 0);
      group.add(beam);
    }
    // Mezzanine (upper floor) along the back half, with railing, rooms and doors
    const mezzanineDepth = d * 0.42;
    group.add(box(w - 1, 0.35, mezzanineDepth, plank, 0, floorH, -d / 2 + mezzanineDepth / 2 + 0.25));
    const railZ = -d / 2 + mezzanineDepth + 0.25;
    group.add(box(w - 6, 0.12, 0.12, darkWood, 2.5, floorH + 1.1, railZ));
    for (let x = -w / 2 + 5; x <= w / 2 - 1; x += 1.1) group.add(box(0.08, 1.1, 0.08, darkWood, x, floorH + 0.55, railZ));
    // Staircase from the ground floor (left side) up to the mezzanine
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      group.add(box(2.4, 0.3, 0.9, plank, -w / 2 + 2, 0.3 + (i + 1) * (floorH / steps) - 0.15, railZ + 6 - i * 0.62));
    }
    const handrail = box(0.1, 0.1, 7.6, darkWood, -w / 2 + 3.25, floorH / 2 + 1.1, railZ + 2.6);
    handrail.rotation.x = Math.atan2(floorH, 7.4);
    group.add(handrail);
    // Rooms upstairs: doors and beds
    const rooms = Math.max(2, Math.floor(w / 7));
    for (let i = 0; i < rooms; i++) {
      const x = -w / 2 + 6 + i * ((w - 8) / rooms);
      group.add(box(1.6, 2.6, 0.12, material('#b4561f', { roughness: 0.6 }), x, floorH + 1.45, -d / 2 + 0.4));
      group.add(sphere(0.07, material('#ffd43b', { metalness: 0.8 }), x + 0.55, floorH + 1.4, -d / 2 + 0.5, 8));
      const hotelBed = bed('#f1ece4', ['#7b1e1e', '#1f3b2c', '#1c2a5a'][i % 3]);
      hotelBed.position.set(x, floorH + 0.2, -d / 2 + 2.6);
      hotelBed.scale.setScalar(0.85);
      group.add(hotelBed);
    }
    // Ground-floor doors (decor) and a cabinet
    [[-w / 4, 'left'], [w / 4, 'right']].forEach(([x]) => group.add(box(1.6, 2.6, 0.12, material('#b4561f', { roughness: 0.6 }), x, 1.45, -d / 2 + mezzanineDepth + 0.35)));
    group.add(box(2.2, 1.1, 0.8, material('#e9ecef', { roughness: 0.6 }), -w / 2 + 4.6, 0.85, railZ + 1.2));
    // Stone chimney fireplace in the middle of the room, up to the roof
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 1 });
    stone.map.wrapS = stone.map.wrapT = THREE.RepeatWrapping;
    stone.map.repeat.set(1, h / 3);
    group.add(box(2.6, h, 2.2, stone, w * 0.12, h / 2, -d * 0.02));
    group.add(box(1.6, 1.4, 0.4, material('#120b08'), w * 0.12, 1, -d * 0.02 + 1.05));
    group.add(box(2.8, 0.2, 0.5, darkWood, w * 0.12, 1.9, -d * 0.02 + 1.2));
    const flames = [];
    [['#ffd43b', 0.5, 0.8], ['#ff922b', 0.7, 1], ['#e8590c', 0.4, 0.6]].forEach(([color, width, height], i) => {
      const flame = mesh(new THREE.ConeGeometry(width / 2, height, 8), glow(color, 2.2, { transparent: true, opacity: 0.85 }), w * 0.12 + (i - 1) * 0.3, 0.4 + height / 2, -d * 0.02 + 1.05);
      flame.raycast = () => {};
      group.add(flame);
      flames.push(flame);
    });
    // Sofas facing the fire, a rug
    group.add(box(4, 0.05, 3, material('#7b1e1e', { roughness: 1 }), w * 0.12, 0.33, d * 0.2));
    [-1, 1].forEach((side) => {
      const sofa = new THREE.Group();
      sofa.add(box(2.6, 0.55, 1.1, material('#5c5a45', { roughness: 1 }), 0, 0.55, 0));
      sofa.add(box(2.6, 0.9, 0.3, material('#5c5a45', { roughness: 1 }), 0, 1, 0.45));
      sofa.position.set(w * 0.12 + side * 2.4, 0.3, d * 0.28);
      sofa.rotation.y = side * 0.5;
      group.add(interactive(sofa, 'sit', 'Cabin sofa'));
    });
    // Pendant lamps with warm light
    const lamps = [];
    [[-w * 0.2, 0], [w * 0.3, d * 0.15], [w * 0.05, -d * 0.3]].forEach(([x, z]) => {
      group.add(cylinder(0.02, 0.02, 1.5, darkWood, x, h - 1.3, z, 4));
      const shade = mesh(new THREE.ConeGeometry(0.6, 0.5, 16, 1, true), material('#c9a227', { side: THREE.DoubleSide, metalness: 0.4 }), x, h - 2.1, z);
      group.add(shade);
      const bulb = sphere(0.18, glow('#fff3bf', 2.5), x, h - 2.25, z, 10);
      group.add(bulb);
      lamps.push(bulb);
    });
    // Cobwebs in the upper corners
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const web = mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: cobwebTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }), sx * (w / 2 - 1.3), h - 1.3, sz * (d / 2 - 1.3));
      web.rotation.y = Math.atan2(sx, sz) + Math.PI;
      web.scale.x = sx;
      web.raycast = () => {};
      group.add(web);
    });
    const exitSign = textSprite('Back door → backyard', { width: 4, background: 'rgba(43, 138, 62, 0.9)' });
    exitSign.position.set(0, 3.6, -d / 2 + 0.6);
    group.add(exitSign);
    if (data && data.backyard !== false) buildBackyard(group, { w, d });
    const titleText = (data && data.title) || 'The Hotel';
    let inside = false;
    const center = new THREE.Vector3();
    animate(group, (time) => {
      flames.forEach((flame, i) => { flame.scale.set(1, 0.85 + Math.sin(time * (9 + i * 3)) * 0.15, 1); });
      lamps.forEach((bulb, i) => { bulb.material.emissiveIntensity = 2.3 + Math.sin(time * 2 + i) * 0.2; });
      if (typeof avatar === 'undefined') return;
      group.getWorldPosition(center);
      const local = avatar.position.clone().sub(center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -group.rotation.y);
      const nowInside = Math.abs(local.x) < w / 2 && Math.abs(local.z) < d / 2 && local.y > -1 && local.y < h;
      if (nowInside && !inside) showTitle(titleText);
      inside = nowInside;
    });
    group.userData.label = titleText;
  }

  // Backyard: wooden fence, pine trees, a concrete bunker gate and the hatch
  function buildBackyard(group, { w, d }) {
    const yardDepth = 22;
    const zBack = -d / 2;
    const centerZ = zBack - yardDepth / 2;
    const grass = box(w + 6, 0.2, yardDepth, material('#2f6b2a', { roughness: 1 }), 0, 0.1, centerZ);
    grass.castShadow = false;
    group.add(grass);
    // Wooden fence around the yard (open towards the cabin)
    const fenceWood = material('#a0603a', { roughness: 0.9 });
    const fenceSide = (length, x, z, alongX) => {
      for (let t = -length / 2; t <= length / 2; t += 0.45) group.add(box(0.3, 2 + ((t * 7) % 0.4), 0.1, fenceWood, alongX ? x + t : x, 1, alongX ? z : z + t));
      group.add(box(alongX ? length : 0.1, 0.12, alongX ? 0.1 : length, fenceWood, x, 1.5, z));
    };
    fenceSide(w + 6, 0, zBack - yardDepth, true);
    fenceSide(yardDepth, -(w / 2 + 3), centerZ, false);
    fenceSide(yardDepth, w / 2 + 3, centerZ, false);
    // Pine trees beyond the fence
    for (let i = 0; i < 10; i++) {
      const x = -w / 2 - 2 + (i / 9) * (w + 4);
      const z = zBack - yardDepth - 3 - (i % 3) * 2;
      group.add(cylinder(0.25, 0.35, 2, material('#4a2c17'), x, 1, z, 6));
      [0, 1, 2].forEach((k) => group.add(mesh(new THREE.ConeGeometry(2.2 - k * 0.6, 3, 7), material(k % 2 ? '#3b6b2f' : '#2f5a26', { flatShading: true }), x, 3 + k * 1.6, z)));
    }
    // Lamp post with a warm lantern
    group.add(cylinder(0.12, 0.15, 4, material('#3b2414'), -w / 2 + 1, 2, zBack - 2, 6));
    group.add(box(0.5, 0.6, 0.5, glow('#ffe066', 1.8), -w / 2 + 1, 4.2, zBack - 2));
    // Concrete bunker gate: two windows with red buttons and a boarded door
    const concrete = material('#8f9499', { roughness: 0.9 });
    const bunker = new THREE.Group();
    bunker.add(box(10, 4, 3, concrete, 0, 2, 0));
    bunker.add(box(10.4, 0.6, 3.4, material('#5c6066'), 0, 4.2, 0));
    [-3, 3].forEach((x) => {
      bunker.add(box(2.6, 1, 0.1, material('#1b1d21'), x, 2.8, 1.52));
      bunker.add(sphere(0.25, glow('#ff2b2b', 2.2), x, 1.6, 1.6, 10));
    });
    bunker.add(box(1.8, 3, 0.1, material('#2b2d33'), 0, 1.5, 1.52));
    [0.6, -0.6].forEach((tilt) => { const plankBoard = box(2.6, 0.3, 0.12, material('#8a5a33'), 0, 1.6, 1.62); plankBoard.rotation.z = tilt; bunker.add(plankBoard); });
    bunker.add(sphere(0.15, glow('#be4bdb', 2), 0, 2.9, 1.65, 8));
    bunker.position.set(w / 2 - 5, 0, zBack - yardDepth + 2.5);
    group.add(bunker);
    // The hatch: a concrete frame, a round lid and a red light; E to go down
    const hatch = new THREE.Group();
    hatch.add(box(4.4, 0.5, 4.4, concrete, 0, 0.25, 0));
    hatch.add(box(3, 0.1, 3, material('#3a1d1d'), 0, 0.52, 0));
    [-1, 1].forEach((side) => { const flap = box(0.8, 1.2, 2.6, material('#8b2525'), side * 2.4, 0.7, 0); flap.rotation.z = side * -0.4; hatch.add(flap); });
    const lid = cylinder(1.3, 1.3, 0.15, material('#c5c9cd', { metalness: 0.6, roughness: 0.3 }), 0, 1.6, -1.4, 24);
    lid.rotation.x = Math.PI / 2.4;
    hatch.add(lid);
    const redLight = box(0.4, 0.15, 0.4, glow('#ff1a1a', 3), 0, 0.6, 0.4);
    hatch.add(redLight);
    hatch.position.set(-w / 4, 0, zBack - yardDepth / 2 - 2);
    hatch.userData.label = 'Hatch · down to the ventilation ducts';
    // Maze lives 30 m below the yard; the hatch drops you at its entrance
    const mazeOrigin = new THREE.Vector3(-w / 4, -30, zBack - yardDepth / 2 - 2);
    hatch.userData.destination = new THREE.Vector3(mazeOrigin.x, mazeOrigin.y + 0.4, mazeOrigin.z);
    group.add(interactive(hatch, 'warp', 'Down the hatch: the ventilation ducts'));
    const hatchSign = textSprite('⚠ Hatch (E) · ventilation ducts', { width: 5, background: 'rgba(139, 37, 37, 0.92)' });
    hatchSign.position.set(-w / 4, 3, zBack - yardDepth / 2 - 2);
    group.add(hatchSign);
    buildDuctMaze(group, mazeOrigin);
  }

  // A not-too-hard maze of metal ventilation ducts (7 x 7 cells, generated
  // with a seeded depth-first search plus a few extra openings). The far
  // corner has a vent that drops you into the Genesis Plaza Underground.
  function buildDuctMaze(group, origin) {
    const size = 7;
    const cell = 4;
    const height = 3;
    let seed = 42;
    const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const walls = { h: [], v: [] }; // h[x][y]: wall south of (x,y); v[x][y]: wall east of (x,y)
    for (let x = 0; x < size; x++) { walls.h[x] = []; walls.v[x] = []; for (let y = 0; y < size; y++) { walls.h[x][y] = true; walls.v[x][y] = true; } }
    const visited = new Set(['3,0']);
    const stack = [[3, 0]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size && !visited.has(`${nx},${ny}`));
      if (!options.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = options[Math.floor(random() * options.length)];
      if (dx === 1) walls.v[x][y] = false;
      if (dx === -1) walls.v[nx][ny] = false;
      if (dy === 1) walls.h[x][y] = false;
      if (dy === -1) walls.h[nx][ny] = false;
      visited.add(`${nx},${ny}`);
      stack.push([nx, ny]);
    }
    // A few extra openings make it easier (loops instead of only dead ends)
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(random() * (size - 1));
      const y = Math.floor(random() * (size - 1));
      if (random() < 0.5) walls.v[x][y] = false; else walls.h[x][y] = false;
    }
    const maze = new THREE.Group();
    maze.position.copy(origin);
    const metal = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.4, metalness: 0.6 });
    const floorMetal = new THREE.MeshStandardMaterial({ map: repeated(metalTexture(), size, size), roughness: 0.5, metalness: 0.6 });
    // Cell (3, 0) is at the origin; x grows to the right, y grows away (-z)
    const cx = (x) => (x - 3) * cell;
    const cz = (y) => -y * cell;
    const spanX = size * cell;
    maze.add(box(spanX, 0.3, spanX, floorMetal, cx(3), -0.15, cz(3)));
    maze.add(box(spanX, 0.3, spanX, metal, cx(3), height + 0.15, cz(3)));
    // Outer walls
    maze.add(box(spanX, height, 0.3, metal, cx(3), height / 2, cz(0) + cell / 2));
    maze.add(box(spanX, height, 0.3, metal, cx(3), height / 2, cz(size - 1) - cell / 2));
    maze.add(box(0.3, height, spanX, metal, cx(0) - cell / 2, height / 2, cz(3)));
    maze.add(box(0.3, height, spanX, metal, cx(size - 1) + cell / 2, height / 2, cz(3)));
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (x < size - 1 && walls.v[x][y]) maze.add(box(0.3, height, cell, metal, cx(x) + cell / 2, height / 2, cz(y)));
        if (y < size - 1 && walls.h[x][y]) maze.add(box(cell, height, 0.3, metal, cx(x), height / 2, cz(y) - cell / 2));
        // Dim light strips along the ceiling, some flickering
        if ((x + y) % 2 === 0) maze.add(box(1.4, 0.06, 0.2, glow((x * y) % 5 === 0 ? '#ff6b6b' : '#c5f6fa', 1.2), cx(x), height - 0.05, cz(y)));
      }
    }
    // Fans at a few dead ends
    const fans = [];
    [[0, 6], [6, 0], [1, 3]].forEach(([x, y]) => {
      const fan = new THREE.Group();
      for (let i = 0; i < 4; i++) { const blade = box(1.6, 0.05, 0.4, material('#5c646b', { metalness: 0.7 }), 0, 0, 0); blade.rotation.y = (i / 4) * Math.PI; fan.add(blade); }
      fan.position.set(cx(x), height - 0.4, cz(y));
      maze.add(fan);
      fans.push(fan);
    });
    // Ladder back up at the entrance
    const ladder = new THREE.Group();
    for (let i = 0; i < 6; i++) ladder.add(box(1, 0.08, 0.08, material('#ced4da', { metalness: 0.8 }), 0, 0.4 + i * 0.45, 0));
    ladder.position.set(cx(3), 0, cz(0) + cell / 2 - 0.3);
    ladder.userData.destination = new THREE.Vector3(0, 30.6, 3.2);
    maze.add(interactive(ladder, 'warp', 'Ladder back up to the backyard'));
    // Exit vent at the far corner
    const exitCell = [6, 6];
    const vent = box(2.4, 0.1, 2.4, glow('#74c0fc', 1.4), cx(exitCell[0]), 0.08, cz(exitCell[1]));
    maze.add(vent);
    const exitSign = textSprite('↓ Vent to the Genesis Plaza Underground', { width: 5, background: 'rgba(24, 119, 242, 0.92)' });
    exitSign.position.set(cx(exitCell[0]), 2.3, cz(exitCell[1]));
    maze.add(exitSign);
    const startSign = textSprite('Find the blue vent · follow the light strips', { width: 3.2, background: 'rgba(17, 17, 17, 0.85)' });
    startSign.position.set(cx(3), 2.6, cz(0) - 1.6);
    maze.add(startSign);
    group.add(maze);
    const ventWorld = new THREE.Vector3();
    animate(maze, (time) => {
      fans.forEach((fan, i) => { fan.rotation.y = time * (3 + i); });
      if (typeof avatar === 'undefined') return;
      vent.getWorldPosition(ventWorld);
      if (Math.abs(avatar.position.x - ventWorld.x) < 1.2 && Math.abs(avatar.position.z - ventWorld.z) < 1.2 && Math.abs(avatar.position.y - ventWorld.y) < 1.5) {
        // Drop into the Genesis Plaza Underground (next to the history corridor)
        avatar.position.set(-46, -59.4, 22);
        avatar.velocityY = 0;
        showTitle('Genesis Plaza Underground');
      }
    });
  }

  PropKit.registerBuilder(/lodge_hotel/, 'lodgeHotel', lodgeHotel);
  PropKit.registerBuilder(/grand_hotel/, 'grandHotel', grandHotel);
  PropKit.registerBuilder(/mini_hotel/, 'miniHotel', miniHotel);
})();
