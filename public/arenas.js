// ============================================================================
// ARENAS: THE PIT (HALF-SUNKEN FIGHT CLUB STADIUM) AND THE CANDLESTICK MAZE
// ============================================================================
// Two districts built from map blocks:
//
// 1) "pit_arena" (map_fight_arena.json): a gladiator pit that feels half
//    underground. A circular concrete floor with a radial pinwheel pattern and
//    two drain-grate rings sits at y=0, surrounded by a curved 6.5 m concrete
//    wall (panels + steel pilasters) with a red light line and red slit doors.
//    Dark stepped stands rise behind the wall, and a grass berm wraps the outside
//    so from the street the stadium reads as a low mound. A wide tunnel cuts
//    through the berm, stairs climb from the floor to the stands, and a lighting
//    truss with spotlights (fake additive cones, no real lights) hangs above.
//    E on the red gong starts a friendly sparring round with a countdown.
//
// 2) "candle_maze" (map_candlestick_maze.json): a seeded maze on a 4 m grid
//    whose walls are holographic glass panels drawn like a candlestick chart.
//    Three sectors follow MANA, ETH and BTC: wall heights follow each asset's
//    recent price history (CoinGecko public "simple price" endpoint, polled
//    every 60 s, small simulated ticks in between; if the feed fails, a smooth
//    simulated random walk is used and the boards say "SIMULATED"). Floors glow
//    green or red with the 24h change. Prices are informational only: there is
//    no trading, wallet or purchase anywhere in the game.
(() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, labelTexture } = PropKit.kit;

  // --------------------------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------------------------
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const noDecorRaycast = (object) => { object.traverse((node) => { node.raycast = () => {}; node.castShadow = false; }); return object; };

  function repeatTexture(texture, x, y) {
    const copy = texture.clone();
    copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
    copy.repeat.set(x, y);
    copy.needsUpdate = true;
    return copy;
  }

  // Board-formed concrete: speckle noise, soft stains, form-tie holes and seams
  function concreteTexture(key, base, { seams = true, ties = true, size = 512, seed = 7 } = {}) {
    return canvasTexture(`arena-concrete|${key}`, size, size, (ctx, w, h) => {
      const random = seeded(seed);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = random() * w;
        const y = random() * h;
        const r = 20 + random() * 90;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        const dark = random() < 0.5;
        gradient.addColorStop(0, dark ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.06)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = (random() - 0.5) * 26;
        image.data[i] += n; image.data[i + 1] += n; image.data[i + 2] += n;
      }
      ctx.putImageData(image, 0, 0);
      // Vertical rain streaks
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.03 + random() * 0.05})`;
        ctx.fillRect(random() * w, random() * h * 0.4, 1 + random() * 3, h * (0.2 + random() * 0.6));
      }
      if (seams) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      }
      if (ties) {
        for (let row = 1; row < 4; row++) {
          for (let col = 1; col < 4; col++) {
            const x = (col * w) / 4;
            const y = (row * h) / 4;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath(); ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    });
  }

  function radialTexture(key, inner, outer) {
    return canvasTexture(`arena-radial|${key}`, 256, 256, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.45)'));
      gradient.addColorStop(1, outer);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Light beam texture: bright at the top (lamp) fading to nothing at the floor
  function beamTexture() {
    return canvasTexture('arena-beam', 64, 256, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.35, 'rgba(200,205,215,0.55)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
  }

  const additive = (map, color, opacity) => new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });

  const dummy = new THREE.Object3D();
  const UP = new THREE.Vector3(0, 1, 0);
  function placeBetween(target, a, b, thickness) {
    const direction = b.clone().sub(a);
    const length = direction.length();
    target.position.copy(a).addScaledVector(direction, 0.5);
    target.quaternion.setFromUnitVectors(UP, direction.normalize());
    target.scale.set(thickness, length, thickness);
    target.updateMatrix();
    return target.matrix;
  }

  function instancedFrom(geometry, instanceMaterial, matrices, colors) {
    const instanced = new THREE.InstancedMesh(geometry, instanceMaterial, matrices.length);
    matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
    if (colors) {
      const color = new THREE.Color();
      colors.forEach((value, index) => instanced.setColorAt(index, color.set(value)));
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.frustumCulled = false; // instances spread far beyond the unit geometry
    instanced.receiveShadow = true;
    return instanced;
  }

  const polar = (angle, radius) => [Math.sin(angle) * radius, Math.cos(angle) * radius];
  const DEG = Math.PI / 180;

  // ==========================================================================
  // 1) THE PIT ARENA
  // ==========================================================================
  // Local layout (entrance tunnel along +z; the map block rotates it to face
  // the city). Angles: 0 = +z, increasing toward +x.
  const PIT = {
    floorR: 19,        // inner face of the perimeter wall (floor is 38 m wide)
    wallH: 6.5,
    wallT: 0.9,
    walkwayOuter: 20.6, // top of the wall walkway, then the stand tiers
    tiers: 8,          // 7 seated tiers + the top concourse
    rise: 0.45,
    backR: 29,         // back wall of the stands (outer stadium shell)
    bermTop: 6.3,
    bermFoot: 34.5,
    doorHalfAngle: 9 * DEG,
    tunnelHalf: 3
  };
  const tierTop = (i) => PIT.wallH + PIT.rise * (i + 1);
  const concourseY = tierTop(PIT.tiers - 1);

  function pinwheelTexture() {
    return canvasTexture('arena-pinwheel', 1024, 1024, (ctx, w, h) => {
      const random = seeded(31);
      const cx = w / 2;
      const cy = h / 2;
      const R = w / 2;
      const wedges = 16;
      const twist = 1.05;
      ctx.fillStyle = '#3f4042';
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < wedges; k++) {
        const a0 = (k / wedges) * Math.PI * 2;
        const a1 = ((k + 1) / wedges) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let s = 0; s <= 40; s++) {
          const r = (s / 40) * R;
          const a = a0 + twist * (r / R);
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        for (let s = 0; s <= 20; s++) {
          const a = a0 + twist + (a1 - a0) * (s / 20);
          ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        }
        for (let s = 40; s >= 0; s--) {
          const r = (s / 40) * R;
          const a = a1 + twist * (r / R);
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = k % 2 ? '#6f706d' : '#36383b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,20,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Concrete grain and stains (scuffs from sparring)
      for (let i = 0; i < 120; i++) {
        const x = random() * w;
        const y = random() * h;
        const r = 6 + random() * 60;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(0,0,0,${0.06 + random() * 0.1})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = (random() - 0.5) * 22;
        image.data[i] += n; image.data[i + 1] += n; image.data[i + 2] += n;
      }
      ctx.putImageData(image, 0, 0);
      // Two drain-grate rings (steel frames with radial bars)
      const floorRadius = PIT.floorR + PIT.wallT;
      [[6.2, 6.9], [12.6, 13.3]].forEach(([r0, r1]) => {
        const p0 = (r0 / floorRadius) * R;
        const p1 = (r1 / floorRadius) * R;
        ctx.fillStyle = '#121314';
        ctx.beginPath(); ctx.arc(cx, cy, p1, 0, Math.PI * 2); ctx.arc(cx, cy, p0, 0, Math.PI * 2, true); ctx.fill();
        const bars = Math.round(p1 * 1.6);
        ctx.strokeStyle = '#6d7175';
        ctx.lineWidth = 2;
        for (let b = 0; b < bars; b++) {
          const a = (b / bars) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * p0, cy + Math.sin(a) * p0);
          ctx.lineTo(cx + Math.cos(a) * p1, cy + Math.sin(a) * p1);
          ctx.stroke();
        }
        ctx.strokeStyle = '#9a9ea3';
        ctx.lineWidth = 4;
        [p0, p1].forEach((p) => { ctx.beginPath(); ctx.arc(cx, cy, p, 0, Math.PI * 2); ctx.stroke(); });
      });
      // Center mark: dark disc with a thin red ring
      ctx.fillStyle = '#26272a';
      ctx.beginPath(); ctx.arc(cx, cy, (2.2 / floorRadius) * R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d0242a';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, (2.0 / floorRadius) * R, 0, Math.PI * 2); ctx.stroke();
    });
  }

  function grassTexture() {
    return canvasTexture('arena-grass', 256, 256, (ctx, w, h) => {
      const random = seeded(5);
      ctx.fillStyle = '#4f6b2e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const shade = 30 + Math.floor(random() * 50);
        ctx.fillStyle = `rgba(${shade + 20}, ${shade + 60}, ${shade}, 0.7)`;
        ctx.fillRect(random() * w, random() * h, 1, 2 + random() * 4);
      }
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(92, 70, 45, 0.25)';
        ctx.beginPath(); ctx.ellipse(random() * w, random() * h, 6 + random() * 20, 3 + random() * 8, random() * 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function signTexture() {
    return canvasTexture('arena-sign-pit', 1024, 256, (ctx, w, h) => {
      ctx.fillStyle = '#121214';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3a3c40';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.font = 'bold 150px Impact, Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff2020';
      ctx.shadowBlur = 40;
      ctx.fillStyle = '#ff3b30';
      ctx.fillText('THE PIT', w / 2, h / 2 + 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd0cc';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('FRIENDLY SPARRING ARENA', w / 2, h - 26);
    });
  }

  // Jumbotron canvas (redrawn when the fight round changes state)
  const jumbo = { canvas: null, texture: null, last: '' };
  function drawJumbo(title, subtitle, accent = '#ff3b30') {
    const key = `${title}|${subtitle}|${accent}`;
    if (!jumbo.canvas || jumbo.last === key) return;
    jumbo.last = key;
    const ctx = jumbo.canvas.getContext('2d');
    const w = jumbo.canvas.width;
    const h = jumbo.canvas.height;
    ctx.fillStyle = '#070708';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.font = `bold ${title.length > 6 ? 70 : 110}px Impact, Arial Black, sans-serif`;
    ctx.fillText(title, w / 2, h * 0.44);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8e8ea';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText(subtitle, w / 2, h * 0.82);
    jumbo.texture.needsUpdate = true;
  }

  function pitArena(group) {
    const random = seeded(2024);
    const floorConcrete = concreteTexture('floor-side', '#55575a', { ties: false, seed: 3 });
    const wallTexture = concreteTexture('wall', '#606265', { seed: 11 });
    const darkTexture = concreteTexture('dark', '#3b3d41', { ties: false, seed: 19 });
    const steel = material('#26282c', { metalness: 0.75, roughness: 0.38 });
    const darkSteel = material('#16171a', { metalness: 0.7, roughness: 0.45 });
    const wallMaterial = material('#ffffff', { map: repeatTexture(wallTexture, 1, 2), roughness: 0.9 });
    const standMaterial = material('#ffffff', { map: repeatTexture(darkTexture, 24, 1), roughness: 0.92, side: THREE.DoubleSide });
    const riserMaterial = material('#c4c4c4', { map: repeatTexture(darkTexture, 30, 0.2), roughness: 0.92, side: THREE.DoubleSide });
    const redLine = new THREE.MeshBasicMaterial({ color: '#ff2a1f' });
    const redSoft = new THREE.MeshBasicMaterial({ color: '#c0100c' });

    // ---- Arena floor: pinwheel concrete with grate rings ----
    const floorRadius = PIT.floorR + PIT.wallT;
    const floor = mesh(new THREE.CylinderGeometry(floorRadius, floorRadius, 0.35, 96), [
      material('#ffffff', { map: repeatTexture(floorConcrete, 8, 0.3) }),
      new THREE.MeshStandardMaterial({ map: pinwheelTexture(), roughness: 0.82, metalness: 0.08 }),
      material('#222222')
    ], 0, -0.125, 0);
    floor.castShadow = false;
    group.add(floor);

    // ---- Perimeter wall: concrete panels between steel pilasters ----
    const panelCount = 40;
    const step = (Math.PI * 2) / panelCount;
    const panelRadius = PIT.floorR + PIT.wallT / 2;
    const panelWidth = 2 * panelRadius * Math.sin(step / 2) - 0.02;
    const doorPanels = [7, 13, 20, 26, 32];
    const panelMatrices = [];
    const pilasterMatrices = [];
    const doors = [];
    for (let k = 0; k < panelCount; k++) {
      const a = step / 2 + k * step;
      const isOpening = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < PIT.doorHalfAngle;
      const [x, z] = polar(a, panelRadius);
      if (!isOpening) {
        dummy.position.set(x, PIT.wallH / 2, z);
        dummy.rotation.set(0, a, 0);
        dummy.scale.set(panelWidth, PIT.wallH, PIT.wallT);
        dummy.updateMatrix();
        panelMatrices.push(dummy.matrix.clone());
      }
      if (doorPanels.includes(k)) doors.push(a);
      const pa = k * step;
      const [px, pz] = polar(pa, PIT.floorR + 0.3);
      dummy.position.set(px, (PIT.wallH + 0.5) / 2, pz);
      dummy.rotation.set(0, pa, 0);
      dummy.scale.set(0.5, PIT.wallH + 0.5, 1.3);
      dummy.updateMatrix();
      pilasterMatrices.push(dummy.matrix.clone());
    }
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const panelBox = new THREE.BoxGeometry(1, 1, 1);
    const panels = instancedFrom(panelBox, wallMaterial, panelMatrices);
    panels.castShadow = true;
    group.add(panels);
    group.add(instancedFrom(unitBox, steel, pilasterMatrices));
    // Lintel over the tunnel opening
    group.add(box(2 * PIT.floorR * Math.sin(PIT.doorHalfAngle) + 0.6, PIT.wallH - 4.6, PIT.wallT, wallMaterial, 0, (PIT.wallH + 4.6) / 2, panelRadius));
    group.add(box(6.2, 0.12, 0.08, redLine, 0, 4.5, PIT.floorR - 0.02));

    // Thin red light line running around the top of the wall
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PIT.floorR - 0.06, 0.05, 6, 180), redLine);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = PIT.wallH - 0.25;
    noDecorRaycast(ring);
    group.add(ring);
    const ringHalo = new THREE.Mesh(new THREE.CylinderGeometry(PIT.floorR - 0.08, PIT.floorR - 0.08, 0.6, 120, 1, true),
      additive(beamTexture(), '#ff2a1f', 0.22));
    ringHalo.position.y = PIT.wallH - 0.25;
    noDecorRaycast(ringHalo);
    group.add(ringHalo);

    // Red slit doorways in the wall
    const redWash = additive(radialTexture('red', 'rgba(255,40,30,0.9)', 'rgba(0,0,0,0)'), '#ff2a1f', 0.55);
    doors.forEach((a) => {
      const door = new THREE.Group();
      door.rotation.y = a;
      door.add(box(2.0, 5.2, 0.3, darkSteel, 0, 2.6, PIT.floorR - 0.1));
      door.add(box(1.5, 4.8, 0.12, material('#060606'), 0, 2.5, PIT.floorR - 0.28));
      const slit = box(0.7, 4.4, 0.1, redLine, 0, 2.3, PIT.floorR - 0.36);
      door.add(slit);
      door.add(box(2.4, 0.18, 0.35, steel, 0, 5.3, PIT.floorR - 0.15));
      const wash = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), redWash);
      wash.rotation.x = -Math.PI / 2;
      wash.position.set(0, 0.07, PIT.floorR - 2.2);
      noDecorRaycast(wash);
      door.add(wash);
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), additive(beamTexture(), '#ff2a1f', 0.12));
      haze.position.set(0, 2.6, PIT.floorR - 0.7);
      noDecorRaycast(haze);
      door.add(haze);
      group.add(door);
    });

    // ---- Wall-top walkway, stepped stands and the top concourse ----
    const walkway = new THREE.Mesh(new THREE.RingGeometry(PIT.floorR - 0.05, PIT.walkwayOuter, 120, 1), standMaterial);
    walkway.rotation.x = -Math.PI / 2;
    walkway.position.y = PIT.wallH + 0.02;
    walkway.receiveShadow = true;
    group.add(walkway);
    for (let i = 0; i < PIT.tiers; i++) {
      const inner = PIT.walkwayOuter + i;
      const outer = i === PIT.tiers - 1 ? PIT.backR : inner + 1;
      const top = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 120, 1), standMaterial);
      top.rotation.x = -Math.PI / 2;
      top.position.y = tierTop(i);
      top.receiveShadow = true;
      group.add(top);
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, PIT.rise, 120, 1, true), riserMaterial);
      riser.position.y = tierTop(i) - PIT.rise / 2;
      group.add(riser);
    }
    // Back shell of the stadium (parapet above the concourse)
    const shellHeight = concourseY + 1.15;
    const shell = mesh(new THREE.CylinderGeometry(PIT.backR, PIT.backR, shellHeight, 120, 1, true, 7 * DEG, 346 * DEG),
      material('#ffffff', { map: repeatTexture(wallTexture, 48, 2), roughness: 0.9, side: THREE.DoubleSide }), 0, shellHeight / 2, 0);
    group.add(shell);
    group.add(box(2 * PIT.backR * Math.sin(7 * DEG) + 0.4, shellHeight - 5, 0.4, wallMaterial, 0, 5 + (shellHeight - 5) / 2, PIT.backR * Math.cos(7 * DEG)));
    const backLine = new THREE.Mesh(new THREE.TorusGeometry(PIT.backR - 0.25, 0.04, 6, 200), redLine);
    backLine.rotation.x = Math.PI / 2;
    backLine.position.y = shellHeight - 0.05;
    noDecorRaycast(backLine);
    group.add(backLine);
    const outerLine = noDecorRaycast(new THREE.Mesh(new THREE.TorusGeometry(PIT.backR + 0.05, 0.05, 6, 200), redSoft));
    outerLine.rotation.x = Math.PI / 2;
    outerLine.position.y = shellHeight - 0.4;
    group.add(outerLine);

    // Railing on top of the wall (steel posts and a handrail ring)
    const railRing = new THREE.Mesh(new THREE.TorusGeometry(PIT.floorR + 0.1, 0.04, 6, 160), steel);
    railRing.rotation.x = Math.PI / 2;
    railRing.position.y = PIT.wallH + 1.0;
    noDecorRaycast(railRing);
    group.add(railRing);

    // ---- Seats (instanced) with spectators and a few usable seats ----
    const seatPans = [];
    const seatBacks = [];
    const seatColors = [];
    const bodies = [];
    const heads = [];
    const bodyColors = [];
    const aisles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((d) => d * DEG);
    for (let i = 0; i < PIT.tiers - 1; i++) {
      const radius = PIT.walkwayOuter + i + 0.42;
      const y = tierTop(i);
      const count = Math.floor((Math.PI * 2 * radius) / 0.62);
      for (let s = 0; s < count; s++) {
        const a = (s / count) * Math.PI * 2;
        const nearAisle = aisles.some((aisle) => Math.abs(Math.atan2(Math.sin(a - aisle), Math.cos(a - aisle))) * radius < 0.8);
        if (nearAisle) continue;
        const [x, z] = polar(a, radius);
        dummy.position.set(x, y + 0.42, z);
        dummy.rotation.set(0, a, 0);
        dummy.scale.set(0.48, 0.07, 0.44);
        dummy.updateMatrix();
        seatPans.push(dummy.matrix.clone());
        const [bx, bz] = polar(a, radius + 0.24);
        dummy.position.set(bx, y + 0.68, bz);
        dummy.rotation.set(-0.12, a, 0, 'YXZ');
        dummy.scale.set(0.48, 0.5, 0.06);
        dummy.updateMatrix();
        seatBacks.push(dummy.matrix.clone());
        seatColors.push(random() < 0.12 ? '#5a1416' : '#1e1f23');
        if (random() < 0.2) {
          const [sx, sz] = polar(a, radius + 0.05);
          dummy.rotation.set(0, a, 0);
          dummy.position.set(sx, y + 0.8, sz);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bodies.push(dummy.matrix.clone());
          dummy.position.set(sx, y + 1.28, sz - 0);
          dummy.updateMatrix();
          heads.push(dummy.matrix.clone());
          bodyColors.push(['#2b2d33', '#3a2a28', '#24303a', '#40403f', '#1f1f22', '#5b2a24'][Math.floor(random() * 6)]);
        }
      }
    }
    const plastic = material('#ffffff', { roughness: 0.55, metalness: 0.1 });
    const pans = instancedFrom(unitBox, plastic, seatPans, seatColors);
    const backs = instancedFrom(unitBox, plastic, seatBacks, seatColors);
    const crowd = instancedFrom(new THREE.CylinderGeometry(0.16, 0.22, 0.72, 8), material('#ffffff', { roughness: 0.85 }), bodies, bodyColors);
    const crowdHeads = instancedFrom(new THREE.SphereGeometry(0.12, 8, 6), material('#8a6a58', { roughness: 0.7 }), heads);
    [pans, backs, crowd, crowdHeads].forEach((object) => { object.raycast = () => {}; group.add(object); });
    // Usable seats on the front row next to each aisle
    aisles.forEach((aisle, index) => {
      [-1, 1].forEach((side) => {
        const radius = PIT.walkwayOuter + 0.42;
        const a = aisle + side * (1.25 / radius);
        const [x, z] = polar(a, radius);
        group.add(seat(x, tierTop(0) + 0.05, z, `Pit stand seat ${index * 2 + (side > 0 ? 2 : 1)}`, a + Math.PI));
      });
    });

    // ---- Stairs from the floor up to the wall walkway (both sides of the tunnel) ----
    const stepMaterial = material('#ffffff', { map: repeatTexture(wallTexture, 0.5, 0.5), roughness: 0.9 });
    const stepCount = 14;
    const stepRise = PIT.wallH / stepCount;
    const stepRun = 0.62;
    [-1, 1].forEach((side) => {
      const stair = new THREE.Group();
      stair.rotation.y = side * 28 * DEG;
      const zc = 17.4;
      const start = -stepCount * stepRun / 2;
      for (let k = 0; k < stepCount; k++) {
        const height = (k + 1) * stepRise;
        stair.add(box(stepRun + 0.02, height, 1.8, stepMaterial, side * (start + stepRun * (k + 0.5)), height / 2, zc));
      }
      const landingLength = 2.0;
      stair.add(box(landingLength, PIT.wallH, 2.6, stepMaterial, side * (-start + landingLength / 2), PIT.wallH / 2, zc + 0.4));
      // Sloped handrail on the open side and a few posts
      const railStart = new THREE.Vector3(side * start, 1.0, zc - 0.85);
      const railEnd = new THREE.Vector3(side * -start, PIT.wallH + 1.0, zc - 0.85);
      const handrail = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), steel);
      placeBetween(handrail, railStart, railEnd, 0.045);
      handrail.matrixAutoUpdate = true;
      noDecorRaycast(handrail);
      stair.add(handrail);
      for (let p = 0; p <= 4; p++) {
        const t = p / 4;
        const x = side * (start + (-2 * start) * t);
        const y = t * PIT.wallH;
        stair.add(noDecorRaycast(cylinder(0.035, 0.035, 1.0, steel, x, y + 0.5, zc - 0.85, 6)));
      }
      // Red step-edge lights
      stair.add(noDecorRaycast(box(stepCount * stepRun, 0.04, 0.04, redSoft, 0, 0.03, zc - 0.92)));
      group.add(stair);
    });

    // ---- Outer berm (grass mound) and the entrance tunnel ----
    const berm = mesh(new THREE.CylinderGeometry(PIT.backR + 0.2, PIT.bermFoot, PIT.bermTop + 0.3, 96, 1, true, 7 * DEG, 346 * DEG),
      material('#ffffff', { map: repeatTexture(grassTexture(), 46, 3), roughness: 1 }), 0, (PIT.bermTop + 0.3) / 2 - 0.3, 0);
    berm.castShadow = false;
    group.add(berm);
    const tunnelStart = PIT.floorR + 0.3;
    const tunnelEnd = PIT.bermFoot + 0.3;
    const tunnelLength = tunnelEnd - tunnelStart;
    const tunnelMid = (tunnelStart + tunnelEnd) / 2;
    const tunnelWall = material('#ffffff', { map: repeatTexture(wallTexture, 4, 1), roughness: 0.9 });
    [-1, 1].forEach((side) => {
      group.add(box(0.5, 5.0, tunnelLength, tunnelWall, side * (PIT.tunnelHalf + 0.25), 2.5, tunnelMid));
      // Red guide strips along the tunnel floor
      group.add(noDecorRaycast(box(0.08, 0.03, tunnelLength - 1, redLine, side * (PIT.tunnelHalf - 0.25), 0.07, tunnelMid)));
    });
    group.add(box(2 * PIT.tunnelHalf + 1.2, 0.4, tunnelLength, material('#ffffff', { map: repeatTexture(darkTexture, 2, 4) }), 0, 4.8, tunnelMid));
    group.add(box(2 * PIT.tunnelHalf + 0.2, 0.35, tunnelLength + 1, material('#ffffff', { map: repeatTexture(floorConcrete, 2, 6), roughness: 0.85 }), 0, -0.125, tunnelMid - 0.5));
    for (let i = 0; i < 5; i++) {
      group.add(noDecorRaycast(box(1.6, 0.06, 0.2, glow('#f4f4f6', 1.6), 0, 4.57, tunnelStart + 1.5 + i * (tunnelLength - 3) / 4)));
    }
    // Monumental portal at the tunnel mouth with the "THE PIT" sign
    const portalZ = PIT.bermFoot;
    const portalMaterial = material('#ffffff', { map: repeatTexture(wallTexture, 1, 1), roughness: 0.88 });
    [-1, 1].forEach((side) => {
      group.add(box(3.4, 7.6, 1.4, portalMaterial, side * (PIT.tunnelHalf + 0.5 + 1.7), 3.8, portalZ));
      group.add(box(0.35, 7.8, 1.6, steel, side * (PIT.tunnelHalf + 0.5), 3.9, portalZ));
    });
    group.add(box(2 * PIT.tunnelHalf + 7.8, 3.0, 1.4, portalMaterial, 0, 6.1, portalZ));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.6), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.position.set(0, 6.15, portalZ + 0.72);
    noDecorRaycast(sign);
    group.add(sign);
    group.add(noDecorRaycast(box(11.2, 0.08, 0.08, redLine, 0, 4.66, portalZ + 0.72)));
    const portalWash = new THREE.Mesh(new THREE.CircleGeometry(5, 32), redWash);
    portalWash.rotation.x = -Math.PI / 2;
    portalWash.position.set(0, -0.26, portalZ + 3);
    noDecorRaycast(portalWash);
    group.add(portalWash);

    // ---- Lighting truss ring, masts and spotlights ----
    const trussR = 12.5;
    const trussY = 17.4;
    const chord = (radius, y, thickness) => {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, 120), steel);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = y;
      noDecorRaycast(torus);
      group.add(torus);
    };
    chord(trussR, trussY, 0.09);
    chord(trussR, trussY + 0.9, 0.09);
    chord(trussR - 0.8, trussY + 0.45, 0.09);
    const strutMatrices = [];
    const segments = 64;
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      const a2 = ((k + 0.5) / segments) * Math.PI * 2;
      const [x, z] = polar(a, trussR);
      const [ix, iz] = polar(a2, trussR - 0.8);
      const [nx, nz] = polar(((k + 1) / segments) * Math.PI * 2, trussR);
      const bottom = new THREE.Vector3(x, trussY, z);
      const topPoint = new THREE.Vector3(x, trussY + 0.9, z);
      const innerPoint = new THREE.Vector3(ix, trussY + 0.45, iz);
      strutMatrices.push(placeBetween(dummy, bottom, topPoint, 0.05).clone());
      strutMatrices.push(placeBetween(dummy, bottom, innerPoint, 0.04).clone());
      strutMatrices.push(placeBetween(dummy, topPoint, innerPoint, 0.04).clone());
      strutMatrices.push(placeBetween(dummy, topPoint, new THREE.Vector3(nx, trussY, nz), 0.035).clone());
    }
    const struts = instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 5), steel, strutMatrices);
    struts.raycast = () => {};
    group.add(struts);

    // Spotlight heads under the truss, aimed at points on the floor
    const canMatrices = [];
    const lensMatrices = [];
    const beams = [];
    const beamMaterial = additive(beamTexture(), '#f2f4ff', 0.1);
    const poolMaterial = additive(radialTexture('white', 'rgba(255,255,255,0.85)', 'rgba(0,0,0,0)'), '#fbfbff', 0.2);
    const spots = 32;
    for (let k = 0; k < spots; k++) {
      const a = (k / spots) * Math.PI * 2;
      const [x, z] = polar(a, trussR);
      const lamp = new THREE.Vector3(x, trussY - 0.45, z);
      const aimRadius = 2 + random() * 12;
      const aimAngle = a + (random() - 0.5) * 1.2;
      const [tx, tz] = polar(aimAngle, aimRadius);
      const target = new THREE.Vector3(tx, 0, tz);
      const direction = target.clone().sub(lamp).normalize();
      dummy.position.copy(lamp);
      dummy.quaternion.setFromUnitVectors(UP, direction.clone().negate());
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      canMatrices.push(dummy.matrix.clone());
      dummy.position.copy(lamp).addScaledVector(direction, 0.27);
      dummy.updateMatrix();
      lensMatrices.push(dummy.matrix.clone());
      if (k % 2 === 0) {
        const length = lamp.distanceTo(target);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 2.4, length, 20, 1, true), beamMaterial);
        cone.position.copy(lamp).addScaledVector(direction, length / 2);
        cone.quaternion.setFromUnitVectors(UP, direction.clone().negate());
        noDecorRaycast(cone);
        group.add(cone);
        beams.push(cone);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(2.8, 28), poolMaterial);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(tx, 0.06 + k * 0.0005, tz);
        noDecorRaycast(pool);
        group.add(pool);
      }
    }
    const cans = instancedFrom(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 10), darkSteel, canMatrices);
    const lenses = instancedFrom(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }), lensMatrices);
    [cans, lenses].forEach((object) => { object.raycast = () => {}; group.add(object); });

    // Four masts on the concourse hold the truss with steel cables
    const cablePoints = [];
    [45, 135, 225, 315].forEach((degrees) => {
      const a = degrees * DEG;
      const [x, z] = polar(a, PIT.backR - 0.8);
      const mastHeight = 27 - concourseY;
      group.add(cylinder(0.32, 0.42, mastHeight, steel, x, concourseY + mastHeight / 2, z, 10));
      group.add(noDecorRaycast(sphere(0.22, new THREE.MeshBasicMaterial({ color: '#ff2a1f' }), x, 27.2, z, 8)));
      [-30, 0, 30].forEach((offset) => {
        const [tx, tz] = polar(a + offset * DEG, trussR);
        cablePoints.push(new THREE.Vector3(x, 26.6, z), new THREE.Vector3(tx, trussY + 0.9, tz));
      });
    });
    // Jumbotron hanging in the middle, held by four cables from the truss
    const jumboY = 13.5;
    [0, 90, 180, 270].forEach((degrees) => {
      const [tx, tz] = polar((degrees + 45) * DEG, trussR - 0.8);
      const [jx, jz] = polar((degrees + 45) * DEG, 2.6);
      cablePoints.push(new THREE.Vector3(jx, jumboY + 1.9, jz), new THREE.Vector3(tx, trussY + 0.45, tz));
    });
    const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePoints), new THREE.LineBasicMaterial({ color: '#4a4c52' }));
    cables.raycast = () => {};
    group.add(cables);
    jumbo.canvas = document.createElement('canvas');
    jumbo.canvas.width = 512;
    jumbo.canvas.height = 288;
    jumbo.texture = new THREE.CanvasTexture(jumbo.canvas);
    jumbo.last = '';
    drawJumbo('THE PIT', 'Ring the red gong to start a round');
    const jumboGroup = new THREE.Group();
    jumboGroup.position.y = jumboY;
    jumboGroup.add(box(5.4, 3.5, 5.4, darkSteel));
    const screenMaterial = new THREE.MeshBasicMaterial({ map: jumbo.texture });
    [0, 90, 180, 270].forEach((degrees) => {
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.8), screenMaterial);
      const a = degrees * DEG;
      screen.position.set(Math.sin(a) * 2.72, 0, Math.cos(a) * 2.72);
      screen.rotation.y = a;
      jumboGroup.add(screen);
    });
    jumboGroup.add(box(5.8, 0.12, 5.8, redLine, 0, -1.8, 0));
    noDecorRaycast(jumboGroup);
    group.add(jumboGroup);

    // ---- Haze layers (very faint, never block walking) ----
    const hazeTexture = canvasTexture('arena-haze', 256, 256, (ctx, w, h) => {
      const hazeRandom = seeded(77);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = hazeRandom() * w;
        const y = hazeRandom() * h;
        const r = 20 + hazeRandom() * 70;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    const hazeLayers = [];
    [3.2, 8.5, 13].forEach((y, index) => {
      const haze = new THREE.Mesh(new THREE.CircleGeometry(PIT.floorR - 0.5, 48), additive(hazeTexture, '#b8bcc8', 0.2 - index * 0.04));
      haze.rotation.x = -Math.PI / 2;
      haze.position.y = y;
      noDecorRaycast(haze);
      group.add(haze);
      hazeLayers.push(haze);
    });

    // ---- The red gong (starts a friendly sparring round) ----
    const gong = new THREE.Group();
    gong.position.set(0, 0, -(PIT.floorR - 3.2));
    gong.add(box(3.6, 0.3, 1.2, darkSteel, 0, 0.15, 0));
    [-1, 1].forEach((side) => gong.add(box(0.2, 3.8, 0.2, steel, side * 1.5, 2.0, 0)));
    gong.add(box(3.4, 0.2, 0.24, steel, 0, 3.8, 0));
    const disc = new THREE.Group();
    disc.position.set(0, 3.55, 0);
    const discFace = cylinder(1.05, 1.05, 0.08, material('#b3161a', { metalness: 0.65, roughness: 0.3, emissive: '#5a0000', emissiveIntensity: 0.6 }), 0, -1.3, 0, 32);
    discFace.rotation.x = Math.PI / 2;
    disc.add(discFace);
    const boss = sphere(0.28, material('#d63a2f', { metalness: 0.7, roughness: 0.25, emissive: '#7a0a05', emissiveIntensity: 0.8 }), 0, -1.3, 0.06, 16);
    boss.scale.z = 0.35;
    disc.add(boss);
    [-0.45, 0.45].forEach((x) => disc.add(box(0.03, 0.4, 0.03, steel, x * 0.6, -0.12, 0)));
    gong.add(disc);
    gong.add(box(0.08, 1.1, 0.08, material('#6b4a2f'), 1.25, 1.1, 0.4));
    gong.add(sphere(0.16, material('#2a2a2a', { roughness: 0.9 }), 1.25, 1.7, 0.4, 10));
    const gongPool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), redWash);
    gongPool.rotation.x = -Math.PI / 2;
    gongPool.position.y = 0.075;
    noDecorRaycast(gongPool);
    gong.add(gongPool);
    group.add(gong);

    const round = { phase: 'idle', start: 0, hooks: null, lastSecond: -1, number: 0 };
    gong.userData.prompt = 'Press E to ring the gong (friendly sparring round)';
    gong.userData.onInteract = (hooks) => {
      round.hooks = hooks;
      if (round.phase === 'countdown' || round.phase === 'fight') {
        return 'A round is already running. Wait for the bell.';
      }
      round.phase = 'countdown';
      round.start = performance.now();
      round.lastSecond = -1;
      round.number += 1;
      if (window.Sound) Sound.play('interact');
      if (hooks.broadcast) hooks.broadcast(`rang the gong at The Pit: round ${round.number} starts in 10 seconds`);
      return `GONG! Round ${round.number} starts in 10 seconds. Friendly sparring only: emotes and dodging, no real money.`;
    };
    interactive(gong, 'action', 'Red gong');

    // ---- Rules plaque near the tunnel mouth ----
    const plaque = new THREE.Group();
    plaque.position.set(PIT.tunnelHalf + 2.2, 0, PIT.floorR - 2.4);
    plaque.rotation.y = -0.5;
    plaque.add(box(0.12, 1.1, 0.12, steel, 0, 0.55, 0));
    const plaqueFace = labelTexture('THE PIT - RULES: friendly sparring only. No real money, no bets. Ring the gong to start a round.', {
      bg: '#18191c', fg: '#f1f1f1', width: 512, height: 320, font: 'bold 34px Arial, sans-serif', border: '#c0201a'
    });
    plaque.add(box(1.5, 0.95, 0.08, darkSteel, 0, 1.45, 0));
    const plaqueScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.86), new THREE.MeshBasicMaterial({ map: plaqueFace }));
    plaqueScreen.position.set(0, 1.45, 0.045);
    plaque.add(plaqueScreen);
    plaque.userData.label = 'The Pit: house rules';
    plaque.userData.info = 'Friendly sparring only. This is a social arena: ring the red gong to start a timed round, then dodge, jump and emote. There is no real money, no betting and nothing to buy here. Be kind, shake hands when the bell rings.';
    interactive(plaque, 'inspect', 'Rules plaque');
    group.add(plaque);

    // ---- Animation: round state, pulsing red line, flickering beams ----
    const baseRed = new THREE.Color('#ff2a1f');
    animate(group, (time) => {
      let pulseSpeed = 1.2;
      if (round.phase === 'countdown') {
        const elapsed = (performance.now() - round.start) / 1000;
        const left = Math.ceil(10 - elapsed);
        if (left !== round.lastSecond) {
          round.lastSecond = left;
          if (left > 0) {
            drawJumbo(String(left), `Round ${round.number} - get ready`, '#ffcc33');
            if (left <= 3 && round.hooks) round.hooks.system(`${left}...`);
          }
        }
        if (elapsed >= 10) {
          round.phase = 'fight';
          round.start = performance.now();
          round.lastSecond = -1;
          if (round.hooks) {
            round.hooks.system(`FIGHT! Round ${round.number}: 60 seconds of friendly sparring.`);
            if (round.hooks.emote) round.hooks.emote('cheer');
          }
          if (window.Sound) Sound.play('coin');
        }
        pulseSpeed = 4;
      } else if (round.phase === 'fight') {
        const elapsed = (performance.now() - round.start) / 1000;
        const left = Math.max(0, Math.ceil(60 - elapsed));
        if (left !== round.lastSecond) {
          round.lastSecond = left;
          drawJumbo(`0:${String(left).padStart(2, '0')}`, `ROUND ${round.number} - FIGHT`, '#ff3b30');
        }
        if (elapsed >= 60) {
          round.phase = 'idle';
          drawJumbo('BELL', `Round ${round.number} over - shake hands`, '#ffffff');
          if (round.hooks) round.hooks.system(`Round ${round.number} over. Shake hands. Ring the gong again for another round.`);
          if (window.Sound) Sound.play('interact');
        }
        pulseSpeed = 7;
      }
      const pulse = 0.65 + 0.35 * Math.sin(time * pulseSpeed);
      redLine.color.copy(baseRed).multiplyScalar(0.6 + pulse * 0.5);
      disc.rotation.z = round.phase === 'countdown' ? Math.sin(time * 18) * 0.05 * Math.max(0, 1 - (performance.now() - round.start) / 2500) : 0;
      beams.forEach((beam, index) => {
        const flicker = round.phase === 'fight' ? 0.6 + 0.4 * Math.abs(Math.sin(time * 3 + index)) : 1;
        beam.visible = flicker > 0.25;
      });
      hazeLayers.forEach((haze, index) => { haze.rotation.z = time * 0.01 * (index % 2 ? 1 : -1); });
    });
  }

  // ==========================================================================
  // 2) THE CANDLESTICK MAZE
  // ==========================================================================
  const MAZE = { cell: 4, n: 20, half: 40 };
  const HISTORY = 48;
  const FEED_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=decentraland,ethereum,bitcoin&vs_currencies=usd&include_24hr_change=true';
  const ASSETS = [
    { id: 'decentraland', symbol: 'MANA', name: 'Decentraland', color: '#ff4d6d', fallback: 0.3, vol: 0.0009 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#8c9cff', fallback: 3000, vol: 0.0006 },
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f7a531', fallback: 60000, vol: 0.0005 }
  ];

  // Price feed: real samples every 60 s, simulated ticks in between, and a
  // fully simulated walk when the public endpoint is unreachable.
  const Feed = {
    simulated: true,
    live: false,
    lastFetch: 0,
    lastOk: null,
    version: 0,
    started: false,
    state: ASSETS.map((asset) => ({ ...asset, price: asset.fallback, anchor: asset.fallback, change: 0, candles: [] })),

    // Rebuild a plausible path ending at the current price: 48 candles following
    // the 24h change (an estimate, not real intraday data) plus small noise
    backfill(entry, randomSource = Math.random) {
      const start = entry.price / (1 + entry.change / 100);
      const candles = [];
      let previous = start;
      for (let i = 0; i < HISTORY; i++) {
        const t = (i + 1) / HISTORY;
        const trend = start + (entry.price - start) * t;
        const noise = (randomSource() - 0.5) * entry.price * entry.vol * 18 * Math.sin(Math.PI * t);
        const close = i === HISTORY - 1 ? entry.price : trend + noise;
        const open = previous;
        const wiggle = Math.abs(close - open) * 0.5 + entry.price * entry.vol * 4 * randomSource();
        candles.push({ o: open, c: close, h: Math.max(open, close) + wiggle * randomSource(), l: Math.min(open, close) - wiggle * randomSource() });
        previous = close;
      }
      entry.candles = candles;
    },

    start() {
      if (this.started) return;
      this.started = true;
      const random = seeded(99);
      this.state.forEach((entry) => {
        entry.change = (random() - 0.45) * 6;
        this.backfill(entry, random);
      });
      this.version++;
      this.fetch();
      setInterval(() => this.tick(), 2000);
    },

    async fetch() {
      this.lastFetch = performance.now();
      let data = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(FEED_URL, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (response.ok) data = await response.json();
      } catch (error) {
        data = null;
      }
      const valid = data && this.state.every((entry) => data[entry.id] && Number.isFinite(data[entry.id].usd));
      if (valid) {
        const wasSimulated = this.simulated;
        this.simulated = false;
        this.live = true;
        this.lastOk = new Date();
        this.state.forEach((entry) => {
          const sample = data[entry.id];
          entry.anchor = sample.usd;
          entry.change = Number.isFinite(sample.usd_24h_change) ? sample.usd_24h_change : entry.change;
          if (wasSimulated) {
            entry.price = sample.usd;
            this.backfill(entry);
          } else {
            this.closeCandle(entry, sample.usd);
          }
        });
      } else {
        // Feed unavailable: keep a smooth simulated random walk
        this.simulated = true;
        this.state.forEach((entry) => {
          const drift = (Math.random() - 0.5) * entry.vol * 12;
          entry.anchor = entry.price * (1 + drift);
          entry.change = Math.max(-12, Math.min(12, entry.change + drift * 100));
          this.closeCandle(entry, entry.price);
        });
      }
      this.version++;
    },

    closeCandle(entry, price) {
      const last = entry.candles[entry.candles.length - 1];
      last.c = entry.price;
      entry.candles.push({ o: last.c, c: price, h: Math.max(last.c, price), l: Math.min(last.c, price) });
      while (entry.candles.length > HISTORY) entry.candles.shift();
      entry.price = price;
    },

    // Small realistic ticks between real samples (mean-reverting to the anchor)
    tick() {
      this.state.forEach((entry) => {
        const shock = (Math.random() + Math.random() + Math.random() - 1.5) * entry.vol;
        entry.price = entry.price * (1 + shock) + (entry.anchor - entry.price) * 0.08;
        const last = entry.candles[entry.candles.length - 1];
        last.c = entry.price;
        last.h = Math.max(last.h, entry.price);
        last.l = Math.min(last.l, entry.price);
      });
      this.version++;
      const due = performance.now() - this.lastFetch > 60000;
      if (due && document.visibilityState !== 'hidden' && this.nearDistrict()) this.fetch();
    },

    nearDistrict() {
      if (typeof avatar === 'undefined' || !this.anchorObject) return true;
      const position = new THREE.Vector3();
      this.anchorObject.getWorldPosition(position);
      return position.distanceTo(avatar.position) < 600;
    }
  };

  const formatPrice = (value) => (value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value >= 1 ? value.toFixed(2) : value.toFixed(4));

  function drawBoard(board) {
    const entry = Feed.state[board.index];
    const ctx = board.canvas.getContext('2d');
    const w = board.canvas.width;
    const h = board.canvas.height;
    const up = entry.change >= 0;
    const trend = up ? '#38d97a' : '#ff4b4b';
    ctx.clearRect(0, 0, w, h);
    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, 'rgba(8, 18, 30, 0.92)');
    background.addColorStop(1, 'rgba(4, 8, 16, 0.92)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = 'rgba(140, 220, 255, 0.05)';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = entry.color;
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.fillText(entry.symbol, 36, 78);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '30px Arial, sans-serif';
    ctx.fillText(`${entry.name} / USD`, 36 + ctx.measureText(entry.symbol).width * 1.85, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px Arial, sans-serif';
    ctx.fillText(`$${formatPrice(entry.price)}`, 36, 184);
    ctx.fillStyle = trend;
    ctx.font = 'bold 46px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${up ? '+' : ''}${entry.change.toFixed(2)}%`, w - 36, 120);
    ctx.font = '26px Arial, sans-serif';
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('24h change', w - 36, 160);
    // Mini candlestick chart of the rolling history
    const chart = { x: 36, y: 214, w: w - 72, h: 220 };
    const lows = entry.candles.map((c) => c.l);
    const highs = entry.candles.map((c) => c.h);
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const span = hi - lo || 1;
    const toY = (v) => chart.y + chart.h - ((v - lo) / span) * chart.h;
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(chart.x, chart.y + (chart.h * i) / 4); ctx.lineTo(chart.x + chart.w, chart.y + (chart.h * i) / 4); ctx.stroke();
    }
    const slot = chart.w / entry.candles.length;
    entry.candles.forEach((candle, index) => {
      const x = chart.x + slot * (index + 0.5);
      const color = candle.c >= candle.o ? '#38d97a' : '#ff4b4b';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, toY(candle.h)); ctx.lineTo(x, toY(candle.l)); ctx.stroke();
      const top = toY(Math.max(candle.o, candle.c));
      const bottom = toY(Math.min(candle.o, candle.c));
      ctx.fillRect(x - slot * 0.32, top, slot * 0.64, Math.max(2, bottom - top));
    });
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px Arial, sans-serif';
    if (Feed.simulated) {
      ctx.fillStyle = '#ffcc33';
      ctx.fillText('SIMULATED - live feed unavailable', 36, h - 30);
    } else {
      ctx.fillStyle = '#7fe3ff';
      const time = Feed.lastOk ? Feed.lastOk.toLocaleTimeString('en-US', { hour12: false }) : '';
      ctx.fillText(`LIVE - CoinGecko - ${time}`, 36, h - 30);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7a8a9c';
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('Information only. No trading.', w - 36, h - 30);
    board.texture.needsUpdate = true;
  }

  function generateMaze() {
    const { n } = MAZE;
    const random = seeded(4242);
    // hWalls[j][i]: wall along x at z line j (0..n), cell column i
    // vWalls[j][i]: wall along z at x line i (0..n), cell row j
    const hWalls = Array.from({ length: n + 1 }, () => Array(n).fill(true));
    const vWalls = Array.from({ length: n }, () => Array(n + 1).fill(true));
    const visited = Array.from({ length: n }, () => Array(n).fill(false));
    const stack = [[0, 0]];
    visited[0][0] = true;
    while (stack.length) {
      const [ci, cj] = stack[stack.length - 1];
      const options = [];
      if (ci > 0 && !visited[cj][ci - 1]) options.push([-1, 0]);
      if (ci < n - 1 && !visited[cj][ci + 1]) options.push([1, 0]);
      if (cj > 0 && !visited[cj - 1][ci]) options.push([0, -1]);
      if (cj < n - 1 && !visited[cj + 1][ci]) options.push([0, 1]);
      if (!options.length) { stack.pop(); continue; }
      const [di, dj] = options[Math.floor(random() * options.length)];
      if (di === -1) vWalls[cj][ci] = false;
      if (di === 1) vWalls[cj][ci + 1] = false;
      if (dj === -1) hWalls[cj][ci] = false;
      if (dj === 1) hWalls[cj + 1][ci] = false;
      visited[cj + dj][ci + di] = true;
      stack.push([ci + di, cj + dj]);
    }
    // A few extra openings so the maze has loops (less frustrating)
    for (let k = 0; k < 22; k++) {
      const i = 1 + Math.floor(random() * (n - 2));
      const j = 1 + Math.floor(random() * (n - 2));
      if (random() < 0.5) hWalls[j][i] = false; else vWalls[j][i] = false;
    }
    // Open 2x2 chamber in the middle for the ATH pedestal
    const mid = n / 2;
    vWalls[mid - 1][mid] = false;
    vWalls[mid][mid] = false;
    hWalls[mid][mid - 1] = false;
    hWalls[mid][mid] = false;
    // Entrance on the west edge (z 0..4), exit on the east edge (z -4..0)
    vWalls[mid][0] = false;
    vWalls[mid - 1][n] = false;
    const walls = [];
    const { cell, half } = MAZE;
    for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) if (hWalls[j][i]) walls.push({ x: -half + cell * (i + 0.5), z: -half + cell * j, along: 'x' });
    for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) if (vWalls[j][i]) walls.push({ x: -half + cell * i, z: -half + cell * (j + 0.5), along: 'z' });
    return walls;
  }

  // Sector bounds along x: MANA (west), ETH (middle), BTC (east)
  const SECTORS = [[-40, -12], [-12, 12], [12, 40]];
  const sectorOf = (x) => (x < -12 ? 0 : x < 12 ? 1 : 2);

  function tileTexture() {
    return canvasTexture('maze-tile', 256, 256, (ctx, w, h) => {
      const random = seeded(8);
      ctx.fillStyle = '#0d1014';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = `rgba(255,255,255,${random() * 0.04})`;
        ctx.fillRect(random() * w, random() * h, 2, 2);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, w - 40, h - 40);
    });
  }

  function glassTexture() {
    return canvasTexture('maze-glass', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#6f8fa8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      for (let y = h / 8; y < h; y += h / 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.setLineDash([6, 8]);
      for (let x = w / 3; x < w; x += w / 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      const sheen = ctx.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.1)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
    });
  }

  function candleMaze(group) {
    Feed.anchorObject = group;
    Feed.start();
    const walls = generateMaze();
    const count = walls.length;
    const CANDLES = 3;

    // ---- Floors: dark margin + one glowing tile floor per sector ----
    const margin = box(96, 0.12, 96, material('#15181d', { roughness: 0.6, metalness: 0.3 }), 0, -0.04, 0);
    margin.castShadow = false;
    group.add(margin);
    const sectorFloors = SECTORS.map(([x0, x1]) => {
      const width = x1 - x0;
      const tiles = repeatTexture(tileTexture(), width / 2, 40);
      const floorMaterial = new THREE.MeshStandardMaterial({ color: '#2a2f36', map: tiles, emissiveMap: tiles, emissive: '#22ff88', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 });
      const floor = box(width, 0.1, 80, floorMaterial, (x0 + x1) / 2, 0.04, 0);
      floor.castShadow = false;
      group.add(floor);
      return floorMaterial;
    });
    // Sector divider strips
    [-12, 12].forEach((x) => group.add(noDecorRaycast(box(0.12, 0.03, 80, new THREE.MeshBasicMaterial({ color: '#9fe8ff' }), x, 0.11, 0))));

    // ---- Instanced walls: glass panels, glowing top caps, steel base rails and candles ----
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff', map: glassTexture(), transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.2,
      emissive: '#0d2a3a', emissiveIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide
    });
    const panels = new THREE.InstancedMesh(unit, glassMaterial, count);
    const caps = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: '#ffffff' }), count);
    const bodies = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: '#ffffff' }), count * CANDLES);
    const wicks = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: '#ffffff' }), count * CANDLES);
    const railMatrices = [];
    const color = new THREE.Color();
    const sectorTint = ASSETS.map((asset) => new THREE.Color(asset.color).lerp(new THREE.Color('#bfefff'), 0.55));
    walls.forEach((wall, index) => {
      wall.sector = sectorOf(wall.x + (wall.along === 'z' ? 0.01 : 0));
      const [x0, x1] = SECTORS[wall.sector];
      const t = ((wall.x - x0) / (x1 - x0)) * 0.78 + ((wall.z + 40) / 80) * 0.22;
      wall.base = Math.max(0, Math.min(HISTORY - CANDLES, Math.floor(t * (HISTORY - CANDLES + 1))));
      wall.height = 2.2;
      wall.parts = Array.from({ length: CANDLES }, () => ({ b0: 1, b1: 1.4, w0: 0.8, w1: 1.8 }));
      panels.setColorAt(index, sectorTint[wall.sector]);
      caps.setColorAt(index, color.set(ASSETS[wall.sector].color));
      dummy.position.set(wall.x, 0.08, wall.z);
      dummy.rotation.set(0, wall.along === 'x' ? 0 : Math.PI / 2, 0);
      dummy.scale.set(MAZE.cell + 0.12, 0.2, 0.42);
      dummy.updateMatrix();
      railMatrices.push(dummy.matrix.clone());
    });
    const rails = instancedFrom(unit, material('#2a2f36', { metalness: 0.8, roughness: 0.35 }), railMatrices);
    rails.raycast = () => {};
    [panels, caps, bodies, wicks].forEach((object) => { object.frustumCulled = false; object.castShadow = false; });
    caps.raycast = () => {};
    bodies.raycast = () => {};
    wicks.raycast = () => {};
    panels.renderOrder = 2;
    group.add(rails, bodies, wicks, caps, panels);

    // Targets from the price history (recomputed when the feed changes)
    let seenVersion = -1;
    function computeTargets() {
      const ranges = Feed.state.map((entry) => {
        const lo = Math.min(...entry.candles.map((c) => c.l));
        const hi = Math.max(...entry.candles.map((c) => c.h));
        return { lo, span: hi - lo || 1 };
      });
      walls.forEach((wall) => {
        const entry = Feed.state[wall.sector];
        const { lo, span } = ranges[wall.sector];
        const map = (v) => 1.0 + ((v - lo) / span) * 4.6;
        let top = 0;
        wall.targets = [];
        for (let k = 0; k < CANDLES; k++) {
          const candle = entry.candles[Math.min(entry.candles.length - 1, wall.base + k)];
          const b0 = map(Math.min(candle.o, candle.c));
          const b1 = Math.max(b0 + 0.12, map(Math.max(candle.o, candle.c)));
          const w1 = map(candle.h);
          wall.targets.push({ b0, b1, w0: map(candle.l), w1, up: candle.c >= candle.o });
          top = Math.max(top, w1, b1);
        }
        wall.targetHeight = Math.max(2.2, Math.min(6, top + 0.35));
      });
    }

    const green = new THREE.Color('#33ff8a');
    const red = new THREE.Color('#ff3b3b');
    function writeMatrices(lerp) {
      walls.forEach((wall, index) => {
        wall.height += (wall.targetHeight - wall.height) * lerp;
        const rotationY = wall.along === 'x' ? 0 : Math.PI / 2;
        dummy.rotation.set(0, rotationY, 0);
        dummy.position.set(wall.x, 0.18, wall.z);
        dummy.scale.set(MAZE.cell, wall.height - 0.18, 0.3);
        dummy.updateMatrix();
        panels.setMatrixAt(index, dummy.matrix);
        dummy.position.set(wall.x, wall.height - 0.02, wall.z);
        dummy.scale.set(MAZE.cell + 0.02, 0.06, 0.34);
        dummy.updateMatrix();
        caps.setMatrixAt(index, dummy.matrix);
        for (let k = 0; k < CANDLES; k++) {
          const part = wall.parts[k];
          const target = wall.targets[k];
          part.b0 += (target.b0 - part.b0) * lerp;
          part.b1 += (target.b1 - part.b1) * lerp;
          part.w0 += (target.w0 - part.w0) * lerp;
          part.w1 += (target.w1 - part.w1) * lerp;
          const offset = (k - (CANDLES - 1) / 2) * 1.25;
          const x = wall.x + (wall.along === 'x' ? offset : 0);
          const z = wall.z + (wall.along === 'z' ? offset : 0);
          const top = Math.min(part.b1, wall.height - 0.1);
          dummy.position.set(x, Math.min(part.b0, top - 0.1), z);
          dummy.scale.set(0.62, Math.max(0.1, top - Math.min(part.b0, top - 0.1)), 0.16);
          dummy.updateMatrix();
          bodies.setMatrixAt(index * CANDLES + k, dummy.matrix);
          const wickTop = Math.min(part.w1, wall.height - 0.05);
          dummy.position.set(x, Math.min(part.w0, wickTop - 0.1), z);
          dummy.scale.set(0.07, Math.max(0.1, wickTop - Math.min(part.w0, wickTop - 0.1)), 0.07);
          dummy.updateMatrix();
          wicks.setMatrixAt(index * CANDLES + k, dummy.matrix);
          if (lerp === 1 || part.up !== target.up) {
            part.up = target.up;
            bodies.setColorAt(index * CANDLES + k, target.up ? green : red);
            wicks.setColorAt(index * CANDLES + k, target.up ? green : red);
          }
        }
      });
      [panels, caps, bodies, wicks].forEach((object) => { object.instanceMatrix.needsUpdate = true; });
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      if (wicks.instanceColor) wicks.instanceColor.needsUpdate = true;
    }
    computeTargets();
    walls.forEach((wall) => { wall.height = wall.targetHeight; });
    writeMatrices(1);
    if (panels.instanceColor) panels.instanceColor.needsUpdate = true;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;

    // ---- Holographic price boards at the entrance (west side, facing the city) ----
    const boards = [];
    const steel = material('#2b3038', { metalness: 0.8, roughness: 0.3 });
    const boardSpecs = [
      { index: 0, z: -7.5, y: 1.6, w: 8, h: 4 },
      { index: 1, z: 2, y: 5.4, w: 8, h: 4 },
      { index: 2, z: 11.5, y: 1.6, w: 8, h: 4 }
    ];
    const boardX = -44.5;
    boardSpecs.forEach((spec) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const texture = new THREE.CanvasTexture(canvas);
      const board = { index: spec.index, canvas, texture };
      boards.push(board);
      drawBoard(board);
      const holder = new THREE.Group();
      holder.position.set(boardX, spec.y, spec.z);
      holder.rotation.y = -Math.PI / 2;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.96, side: THREE.DoubleSide }));
      screen.position.y = spec.h / 2;
      holder.add(screen);
      holder.add(box(spec.w + 0.3, 0.12, 0.3, steel, 0, -0.06, 0));
      holder.add(box(spec.w + 0.3, 0.12, 0.3, steel, 0, spec.h + 0.06, 0));
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(spec.w + 1, 1.6), additive(beamTexture(), ASSETS[spec.index].color, 0.35));
      halo.rotation.x = Math.PI;
      halo.position.set(0, -0.8, 0.05);
      noDecorRaycast(halo);
      holder.add(halo);
      group.add(holder);
      // Posts down to the ground
      [-1, 1].forEach((side) => {
        group.add(box(0.25, spec.y + spec.h + 0.2, 0.25, steel, boardX + 0.05, (spec.y + spec.h + 0.2) / 2, spec.z + side * (spec.w / 2 + 0.1)));
      });
    });
    const gateLabel = textSprite('THE CANDLESTICK MAZE', { width: 14, background: 'rgba(8, 20, 34, 0.88)', color: '#9fe8ff' });
    gateLabel.position.set(boardX, 11, 2);
    group.add(gateLabel);
    const entryLabel = textSprite('ENTRANCE', { width: 4, background: 'rgba(8, 20, 34, 0.85)', color: '#7fffb0' });
    entryLabel.position.set(-41, 4.3, 2);
    group.add(entryLabel);
    const exitLabel = textSprite('EXIT', { width: 3.5, background: 'rgba(8, 20, 34, 0.85)', color: '#ffcc66' });
    exitLabel.position.set(41.5, 4.3, -2);
    group.add(exitLabel);
    ASSETS.forEach((asset, index) => {
      const [x0, x1] = SECTORS[index];
      const label = textSprite(`${asset.symbol} SECTOR`, { width: 9, background: 'rgba(8, 14, 24, 0.85)', color: asset.color });
      label.position.set((x0 + x1) / 2, 8.5, -44);
      group.add(label);
    });

    // Information plaque (inspect)
    const plaque = new THREE.Group();
    plaque.position.set(-46, 0, -14);
    plaque.rotation.y = -Math.PI / 2;
    plaque.add(box(0.12, 1.1, 0.12, steel, 0, 0.55, 0));
    plaque.add(box(1.6, 1.0, 0.08, material('#11151b', { metalness: 0.5 }), 0, 1.45, 0));
    const plaqueScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({
      map: labelTexture('Prices are shown for information only. No trading, no purchases.', { bg: '#0b121a', fg: '#dff6ff', width: 512, height: 300, font: 'bold 34px Arial, sans-serif', border: '#3fb6ff' })
    }));
    plaqueScreen.position.set(0, 1.45, 0.045);
    plaque.add(plaqueScreen);
    plaque.userData.label = 'About the Candlestick Maze';
    plaque.userData.info = 'Wall heights and the sector floors follow the public prices of MANA, ETH and BTC (CoinGecko simple price API, refreshed every 60 s, small simulated ticks in between; if the feed is unavailable the boards say SIMULATED). The history shape before the first live samples is estimated from the 24h change. Prices are shown for information only: there is no trading, wallet or purchase anywhere in the game.';
    interactive(plaque, 'inspect', 'Info plaque');
    group.add(plaque);

    // ---- ATH pedestal in the central chamber ----
    const pedestal = new THREE.Group();
    pedestal.add(cylinder(1.3, 1.5, 0.4, steel, 0, 0.3, 0, 6));
    pedestal.add(cylinder(0.8, 1.0, 1.0, material('#1b2028', { metalness: 0.7, roughness: 0.3 }), 0, 1.0, 0, 6));
    pedestal.add(cylinder(0.95, 0.95, 0.08, glow('#ffd166', 1.4), 0, 1.54, 0, 6));
    const gem = mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb703', emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.15 }), 0, 2.5, 0);
    noDecorRaycast(gem);
    pedestal.add(gem);
    const athBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 10, 20, 1, true), additive(beamTexture(), '#ffd166', 0.25));
    athBeam.rotation.x = Math.PI;
    athBeam.position.y = 6.6;
    noDecorRaycast(athBeam);
    pedestal.add(athBeam);
    const athLabel = textSprite('ATH', { width: 3, background: 'rgba(40, 26, 0, 0.85)', color: '#ffd166' });
    athLabel.position.y = 4.2;
    pedestal.add(athLabel);
    group.add(pedestal);

    const BEST_KEY = 'multiverse-candles-best-time';
    const run = { start: 0, wasOutside: true };
    pedestal.userData.prompt = 'Press E to touch the ATH pedestal';
    pedestal.userData.onInteract = (hooks) => {
      if (window.Sound) Sound.play('coin');
      if (!run.start) return 'All-time high reached! Enter through the west ENTRANCE to time your run.';
      const seconds = (performance.now() - run.start) / 1000;
      run.start = 0;
      let best = null;
      try { best = parseFloat(localStorage.getItem(BEST_KEY)); } catch (error) { best = null; }
      const record = !Number.isFinite(best) || seconds < best;
      if (record) { try { localStorage.setItem(BEST_KEY, seconds.toFixed(1)); } catch (error) { /* storage blocked */ } }
      if (hooks.emote) hooks.emote('cheer');
      if (record && hooks.broadcast) hooks.broadcast(`reached the ATH of the Candlestick Maze in ${seconds.toFixed(1)}s`);
      return record ? `ATH reached in ${seconds.toFixed(1)} s. New personal best!` : `ATH reached in ${seconds.toFixed(1)} s. Your best is ${best.toFixed(1)} s.`;
    };
    interactive(pedestal, 'action', 'ATH pedestal');

    // ---- Animation: wall heights, floor glow, boards, maze clock ----
    const local = new THREE.Vector3();
    const greenFloor = new THREE.Color('#1dff7a');
    const redFloor = new THREE.Color('#ff2d2d');
    let lastBoardDraw = 0;
    let lastWrite = 0;
    animate(group, (time) => {
      if (typeof avatar !== 'undefined') {
        local.copy(avatar.position);
        group.worldToLocal(local);
        const nearby = Math.abs(local.x) < 160 && Math.abs(local.z) < 160;
        const inside = Math.abs(local.x) < 40 && Math.abs(local.z) < 40;
        if (inside && run.wasOutside && local.x < -36 && local.z > -0.5 && local.z < 4.5 && !run.start) {
          run.start = performance.now();
          if (typeof appendSystemMessage === 'function') appendSystemMessage('Maze clock started: find the ATH pedestal in the center.');
        }
        run.wasOutside = !inside;
        if (!nearby) return;
      }
      if (Feed.version !== seenVersion) {
        seenVersion = Feed.version;
        computeTargets();
      }
      if (time - lastWrite > 0.05) {
        writeMatrices(Math.min(1, (time - lastWrite) * 2.5));
        lastWrite = time;
      }
      sectorFloors.forEach((floorMaterial, index) => {
        const up = Feed.state[index].change >= 0;
        floorMaterial.emissive.copy(up ? greenFloor : redFloor);
        floorMaterial.emissiveIntensity = 0.85 + 0.3 * Math.sin(time * 1.6 + index);
      });
      if (time - lastBoardDraw > 5) {
        lastBoardDraw = time;
        boards.forEach(drawBoard);
      }
      gem.rotation.y = time * 1.2;
      gem.position.y = 2.5 + Math.sin(time * 2) * 0.15;
    });
  }

  PropKit.registerBuilder(/^pit_arena$/, 'pitArena', pitArena);
  PropKit.registerBuilder(/^candle_maze$/, 'candleMaze', candleMaze);
})();
