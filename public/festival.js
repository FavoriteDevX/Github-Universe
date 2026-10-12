// ============================================================================
// SOUNDWAVE FESTIVAL: A MUSIC DISTRICT AMPLIFYING SPOTIFY
// ============================================================================
// A big-event district: an entrance gate made of LED screens on steel truss
// with a walkable bridge and stairs, flame cannons, a main stage with an LED
// equalizer wall, lasers, sound waves rippling over the ground and a crowd of
// dancing 3D cursors. Spotify's official embedded player plays the music on
// the stage screen (press play on it; Spotify embeds do not autoplay). The
// show runs on a shared 124 BPM clock: browsers cannot read the audio of a
// Spotify embed, so the lights follow the tempo, not the actual waveform.
const Festival = (() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive } = PropKit.kit;
  const BPM = 124;
  // Spotify's "Today's Top Hits" playlist, played through Spotify's official embed
  const SPOTIFY_EMBED = 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0';
  const screenTextures = [];

  function beatAt(time) {
    const beats = (time * BPM) / 60;
    return { beats, pulse: Math.pow(1 - (beats % 1), 3) };
  }

  // Animated LED screen textures: nebulas, fire and equalizer bars
  function ledScreen(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    screenTextures.push({ canvas, texture, kind, seed: screenTextures.length * 1.7 });
    return texture;
  }

  function drawScreens(time) {
    const { beats, pulse } = beatAt(time);
    screenTextures.forEach(({ canvas, texture, kind, seed }) => {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      if (kind === 'bars') {
        ctx.fillStyle = '#0b0614';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 12; i++) {
          const level = (0.25 + 0.75 * Math.abs(Math.sin(time * (1.5 + i * 0.37) + i + seed))) * (0.5 + pulse * 0.5);
          const gradient = ctx.createLinearGradient(0, h, 0, 0);
          gradient.addColorStop(0, '#1db954');
          gradient.addColorStop(0.6, '#ffd43b');
          gradient.addColorStop(1, '#ff6b6b');
          ctx.fillStyle = gradient;
          ctx.fillRect(4 + i * 10, h - level * h, 8, level * h);
        }
      } else {
        const hue = kind === 'fire' ? 20 + Math.sin(time + seed) * 15 : (200 + Math.sin(time * 0.3 + seed) * 80 + 360) % 360;
        const gradient = ctx.createRadialGradient(w * (0.5 + Math.sin(time * 0.7 + seed) * 0.3), h * (0.5 + Math.cos(time * 0.5 + seed) * 0.3), 4, w / 2, h / 2, w);
        gradient.addColorStop(0, `hsl(${hue + 40}, 100%, ${70 + pulse * 20}%)`);
        gradient.addColorStop(0.4, `hsl(${hue}, 90%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue - 60}, 80%, 12%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        if (Math.floor(beats) % 8 === 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.6})`;
          ctx.fillRect(0, 0, w, h);
        }
      }
      texture.needsUpdate = true;
    });
  }

  // A truss cell: steel frame around an LED screen
  function screenCell(size, kind) {
    const cell = new THREE.Group();
    const steel = material('#2b2d33', { metalness: 0.8, roughness: 0.35 });
    cell.add(box(size * 0.92, size * 0.92, 0.15, new THREE.MeshBasicMaterial({ map: ledScreen(kind) })));
    cell.add(box(size * 0.92, size * 0.92, 0.1, material('#111111'), 0, 0, -0.12));
    [-1, 1].forEach((side) => {
      cell.add(box(0.14, size, 0.14, steel, side * size / 2, 0, 0.1));
      cell.add(box(size, 0.14, 0.14, steel, 0, side * size / 2, 0.1));
    });
    return cell;
  }

  // Entrance gate: two towers of LED screens joined by a walkable bridge with
  // stairs on both sides, flame cannons and pipes
  function gate(group, { w, h }) {
    const size = 3.2;
    const towerColumns = 3;
    const towerRows = Math.round(h / size);
    const towerX = w / 2 - (towerColumns * size) / 2;
    [-1, 1].forEach((side) => {
      for (let column = 0; column < towerColumns; column++) {
        for (let row = 0; row < towerRows; row++) {
          const cell = screenCell(size, (row + column) % 3 === 0 ? 'nebula' : 'fire');
          cell.position.set(side * towerX + (column - 1) * size, size / 2 + row * size, 0);
          group.add(cell);
          const back = screenCell(size, 'nebula');
          back.position.set(side * towerX + (column - 1) * size, size / 2 + row * size, -size * 2);
          back.rotation.y = Math.PI;
          group.add(back);
        }
      }
      // Side walls of the tower (truss)
      group.add(box(0.2, towerRows * size, size * 2, material('#2b2d33', { metalness: 0.8 }), side * (towerX + size * 1.5), (towerRows * size) / 2, -size));
    });
    // Top row of screens across the whole gate and the bridge deck below it
    const span = towerX * 2 - size * 3;
    const topY = towerRows * size + size / 2;
    for (let x = -towerX - size; x <= towerX + size + 0.01; x += size) {
      const cell = screenCell(size, 'nebula');
      cell.position.set(x, topY, 0);
      group.add(cell);
    }
    const deckY = towerRows * size - 0.2;
    group.add(box(span + size * 3, 0.4, size * 2, material('#3a3d45', { metalness: 0.6, roughness: 0.4 }), 0, deckY, -size));
    group.add(box(span + size * 3, 1.1, 0.08, material('#9fb4ff', { transparent: true, opacity: 0.35 }), 0, deckY + 0.75, -size * 2 + 0.1));
    // Stairs up to the bridge on both sides (behind the towers)
    const steps = Math.ceil(deckY / 0.5);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < steps; i++) {
        group.add(box(2.4, 0.25, 0.9, material('#4a4e57', { metalness: 0.5 }), side * (towerX + size * 1.5 + 1.4), 0.25 + i * (deckY / steps), -size * 2 - 2 - (steps - i) * 0.85 + steps * 0.85));
      }
    });
    // Flame cannons and curved pipes
    const flames = [];
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i++) {
        const x = side * (towerX + size * 2 + 2 + i * 1.6);
        group.add(cylinder(0.4, 0.5, 4 + i, material('#1b1c20', { metalness: 0.7 }), x, (4 + i) / 2, 2, 12));
        const flame = mesh(new THREE.ConeGeometry(0.8, 4, 10), glow('#ff922b', 2.5, { transparent: true, opacity: 0.9 }), x, 4 + i + 2, 2);
        flame.castShadow = false;
        group.add(flame);
        flames.push(flame);
      }
    });
    const sign = textSprite('SOUNDWAVE FESTIVAL · powered by Spotify', { width: 16, background: 'rgba(29, 185, 84, 0.92)' });
    sign.position.set(0, topY + size, 0.5);
    group.add(sign);
    animate(group, (time) => {
      const { beats, pulse } = beatAt(time);
      const burst = Math.floor(beats) % 4 === 0;
      flames.forEach((flame, i) => {
        flame.visible = burst || pulse > 0.85;
        flame.scale.set(1, 0.6 + pulse * 1.2 + (i % 2) * 0.2, 1);
      });
    });
    group.userData.label = 'Soundwave Festival entrance';
  }

  // Main stage: LED equalizer wall, truss roof, speakers, lasers, spotlights,
  // the Spotify player and sound waves rippling over the floor
  function stage(group, { w, h, d }) {
    const steel = material('#2b2d33', { metalness: 0.8, roughness: 0.35 });
    group.add(box(w, 1.6, d, material('#15161b', { roughness: 0.6 }), 0, 0.8, 0));
    group.add(box(w + 0.2, 0.12, d + 0.2, glow('#1db954', 1.4), 0, 1.62, 0));
    // LED wall made of screen cells
    const size = 3;
    const columns = Math.floor(w / size) - 2;
    const rows = Math.floor((h - 4) / size);
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const cell = screenCell(size, row === 0 || column % 4 === 1 ? 'bars' : 'nebula');
        cell.position.set(-((columns - 1) * size) / 2 + column * size, 1.6 + size / 2 + row * size, -d / 2 + 0.6);
        group.add(cell);
      }
    }
    // Truss roof and pillars
    [-1, 1].forEach((side) => group.add(box(0.5, h, 0.5, steel, side * w / 2, h / 2, d / 2 - 0.5)));
    group.add(box(w + 1, 0.6, 0.6, steel, 0, h, d / 2 - 0.5));
    group.add(box(w + 1, 0.6, d, steel, 0, h, 0));
    // Speaker stacks
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 4; i++) {
        const speaker = new THREE.Group();
        speaker.add(box(2.4, 1.6, 1.6, material('#18191d')));
        speaker.add(cylinder(0.55, 0.55, 0.1, material('#3a3d45'), 0, 0, 0.82, 20)).children[1].rotation.x = Math.PI / 2;
        speaker.position.set(side * (w / 2 + 2), 1 + i * 1.7, d / 2 - 1);
        group.add(speaker);
      }
    });
    // DJ booth with the Spotify player
    group.add(box(6, 1.4, 1.6, material('#1b1c20'), 0, 2.3, d / 2 - 2.5));
    group.add(box(6.1, 0.1, 1.7, glow('#1db954', 1.6), 0, 3.05, d / 2 - 2.5));
    const player = box(8, 3.2, 0.1, material('#000000'), 0, h - 2.5, d / 2 - 0.4);
    group.add(player);
    VideoScreens.register(player, 8, 3.2, SPOTIFY_EMBED, { distance: 90 });
    const playerLabel = textSprite('Spotify · press ▶ on the player to start the music', { width: 10, background: 'rgba(0, 0, 0, 0.85)' });
    playerLabel.position.set(0, h - 0.4, d / 2);
    group.add(playerLabel);
    // Lasers fanning out from the stage
    const lasers = [];
    for (let i = 0; i < 10; i++) {
      const laser = cylinder(0.06, 0.06, 60, new THREE.MeshBasicMaterial({ color: i % 2 ? '#00f5d4' : '#f15bb5', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, 6);
      laser.geometry.translate(0, 30, 0);
      laser.position.set(-w / 2 + (i + 0.5) * (w / 10), h, d / 2 - 0.5);
      laser.raycast = () => {};
      laser.castShadow = false;
      group.add(laser);
      lasers.push(laser);
    }
    // Sound waves rippling out over the floor in front of the stage
    const waves = [];
    for (let i = 0; i < 5; i++) {
      const wave = mesh(new THREE.RingGeometry(0.95, 1, 64), new THREE.MeshBasicMaterial({ color: '#1db954', transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.08, d / 2 + 2);
      wave.rotation.x = -Math.PI / 2;
      wave.raycast = () => {};
      group.add(wave);
      waves.push(wave);
    }
    // A crowd of dancing 3D cursors (holograms) in front of the stage
    const crowd = [];
    const cursorShape = new THREE.Shape();
    cursorShape.moveTo(0, 0); cursorShape.lineTo(0, -1.6); cursorShape.lineTo(0.4, -1.2); cursorShape.lineTo(0.7, -1.8); cursorShape.lineTo(0.95, -1.7); cursorShape.lineTo(0.65, -1.1); cursorShape.lineTo(1.15, -1.1); cursorShape.closePath();
    const cursorGeometry = new THREE.ExtrudeGeometry(cursorShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    const hues = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#63e6be'];
    for (let i = 0; i < 40; i++) {
      const dancer = mesh(cursorGeometry, material(hues[i % hues.length], { transparent: true, opacity: 0.85, emissive: hues[i % hues.length], emissiveIntensity: 0.4 }));
      const row = Math.floor(i / 10);
      dancer.position.set(-w / 2 + 3 + (i % 10) * ((w - 6) / 9) + (row % 2) * 1.2, 2.4, d / 2 + 6 + row * 3.5);
      dancer.userData.phase = i * 0.7;
      dancer.raycast = () => {};
      group.add(dancer);
      crowd.push(dancer);
    }
    animate(group, (time) => {
      drawScreensThrottled(time);
      const { beats, pulse } = beatAt(time);
      lasers.forEach((laser, i) => {
        laser.rotation.z = Math.sin(time * 0.9 + i * 0.6) * 0.9;
        laser.rotation.x = -0.5 + Math.cos(time * 0.7 + i) * 0.35;
        laser.visible = (Math.floor(beats / 4) + i) % 3 !== 0;
      });
      waves.forEach((wave, i) => {
        const t = ((beats / 2 + i / waves.length) % 1);
        wave.scale.setScalar(2 + t * 40);
        wave.material.opacity = (1 - t) * 0.35;
      });
      crowd.forEach((dancer) => {
        const phase = dancer.userData.phase;
        dancer.position.y = 2.4 + pulse * 1.2 * (0.6 + 0.4 * Math.sin(phase));
        dancer.rotation.y = Math.sin(time * 2 + phase) * 0.8;
        dancer.rotation.z = Math.sin(beats * Math.PI + phase) * 0.25;
      });
    });
    group.userData.label = 'Soundwave main stage';
  }

  let lastDraw = 0;
  function drawScreensThrottled(time) {
    if (time - lastDraw < 0.08) return;
    lastDraw = time;
    drawScreens(time);
  }

  // Light towers with moving spotlights around the festival grounds
  function lightTower(group, { h }) {
    group.add(box(1.2, h, 1.2, material('#2b2d33', { metalness: 0.8 }), 0, h / 2, 0));
    const head = new THREE.Group();
    head.add(cylinder(0.6, 0.9, 1.2, material('#1b1c20'), 0, 0, 0, 12));
    const beam = mesh(new THREE.ConeGeometry(4, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3bf', transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 20, 0);
    beam.raycast = () => {};
    head.add(beam);
    head.position.y = h + 0.6;
    group.add(head);
    animate(group, (time) => {
      head.rotation.z = Math.sin(time * 0.6 + h) * 0.6;
      head.rotation.x = Math.cos(time * 0.4 + h) * 0.4;
    });
  }

  // Festival grounds: dark pavers with glowing seams
  function grounds(group, { w, d }) {
    const pavers = new THREE.MeshStandardMaterial({ map: PropKit.kit.repeated(PropKit.kit.cobbleTexture('#3b3350'), w / 6, d / 6), roughness: 0.8 });
    const floor = box(w, 0.4, d, pavers);
    floor.castShadow = false;
    group.add(floor);
  }

  PropKit.registerBuilder(/toki_floor_festival/, 'festivalGrounds', grounds);
  PropKit.registerBuilder(/festival_gate/, 'festivalGate', gate);
  PropKit.registerBuilder(/festival_stage/, 'festivalStage', stage);
  PropKit.registerBuilder(/light_tower/, 'lightTower', lightTower);
  return { beatAt };
})();
