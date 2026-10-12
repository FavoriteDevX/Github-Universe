// ============================================================================
// GRAPHIC EQUALIZER: THE TOWER OF ICONS
// ============================================================================
// An abstract tower without walls: its facade is made of floating 3D app icons
// (real app logos from Simple Icons, drawn as rounded iOS-style squares). When
// the music plays the icon columns pulse like the bars of a giant equalizer.
// A spiral of flat icons climbs around the tower: every icon you step on plays
// its own sound or effect (WhatsApp dials, Messenger pops chat bubbles,
// Spotify throws music notes, Instagram flashes...).
const Equalizer = (() => {
  const { material, glow, mesh, box, cylinder, sphere, animate, textSprite, interactive } = PropKit.kit;
  // [Simple Icons slug, brand color, effect, glyph color]
  const APPS = [
    ['whatsapp', '#25D366', 'dial'], ['messenger', '#0084FF', 'bubbles'], ['spotify', '#1DB954', 'music'],
    ['instagram', '#E4405F', 'flash'], ['youtube', '#FF0000', 'play'], ['telegram', '#26A5E4', 'bubbles'],
    ['discord', '#5865F2', 'bubbles'], ['netflix', '#E50914', 'play'], ['tiktok', '#111111', 'music'],
    ['snapchat', '#FFFC00', 'flash', '#111111'], ['gmail', '#EA4335', 'bubbles'], ['googlemaps', '#4285F4', 'pop'],
    ['googlechrome', '#4285F4', 'pop'], ['firefoxbrowser', '#FF7139', 'pop'], ['zoom', '#0B5CFF', 'dial'],
    ['airbnb', '#FF5A5F', 'pop'], ['uber', '#000000', 'pop'], ['pinterest', '#BD081C', 'flash'],
    ['reddit', '#FF4500', 'bubbles'], ['twitch', '#9146FF', 'play'], ['duolingo', '#58CC02', 'pop'],
    ['shazam', '#0088FF', 'music'], ['applemusic', '#FA243C', 'music'], ['appstore', '#0D96F6', 'pop'],
    ['safari', '#006CFF', 'pop'], ['signal', '#3A76F0', 'dial'], ['wechat', '#07C160', 'bubbles'],
    ['paypal', '#003087', 'pop'], ['notion', '#000000', 'pop'], ['figma', '#F24E1E', 'pop'],
    ['github', '#181717', 'pop'], ['dropbox', '#0061FF', 'pop'], ['soundcloud', '#FF5500', 'music'],
    ['steam', '#171a21', 'play'], ['waze', '#33CCFF', 'pop'], ['line', '#00C300', 'bubbles']
  ];
  const materials = new Map();
  let audio = null;
  let music = null;

  function iconMaterial(app) {
    const [slug, color, , glyph = '#ffffff'] = app;
    if (!materials.has(slug)) {
      const map = BrandLogos.appIconTexture(slug, color, { glyph, letter: slug[0].toUpperCase() });
      materials.set(slug, new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.35, metalness: 0.1, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.35 }));
    }
    return materials.get(slug);
  }

  // --------------------------------------------------------------------------
  // Sound: tiny WebAudio synth (no recorded music, nothing copyrighted)
  // --------------------------------------------------------------------------
  function context() {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio = new AudioContext();
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }

  function tone(frequency, duration, { type = 'sine', volume = 0.15, delay = 0, slide = 0 } = {}) {
    const ctx = context();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise(duration, volume = 0.05) {
    const ctx = context();
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }

  // A simple electronic loop: kick, hi-hat and a bass arpeggio at 120 BPM
  const BASS = [55, 55, 65.4, 73.4, 55, 82.4, 73.4, 65.4];
  function startMusic() {
    if (music || !context()) return;
    music = { step: 0, beat: 0, timer: null };
    music.timer = setInterval(() => {
      const step = music.step++;
      if (step % 4 === 0) { tone(120, 0.25, { volume: 0.35, slide: -80 }); music.beat = 1; }
      if (step % 2 === 1) noise(0.05, 0.04);
      tone(BASS[Math.floor(step / 2) % BASS.length] * 2, 0.2, { type: 'sawtooth', volume: 0.05 });
      if (step % 8 === 6) tone(660, 0.15, { type: 'triangle', volume: 0.05 });
    }, 125);
  }

  function stopMusic() {
    if (!music) return;
    clearInterval(music.timer);
    music = null;
  }

  // --------------------------------------------------------------------------
  // Step effects: sounds plus floating visuals over the icon
  // --------------------------------------------------------------------------
  const particles = [];
  function spawn(group, object, life, update) {
    group.add(object);
    particles.push({ group, object, life, age: 0, update });
  }

  function effect(group, app, position, index) {
    const [, color, kind] = app;
    if (kind === 'dial') {
      tone(350, 0.6, { volume: 0.08 }); tone(440, 0.6, { volume: 0.08 });
      [0, 1, 2].forEach((i) => tone(941 + i * 120, 0.08, { volume: 0.08, delay: 0.7 + i * 0.15 }));
      const ring = mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 32), glow(color, 1.5, { transparent: true }), position.x, position.y + 1.2, position.z);
      spawn(group, ring, 1.2, (p, t) => { ring.scale.setScalar(1 + t * 3); ring.material.opacity = 1 - t; ring.rotation.y += 0.05; });
    } else if (kind === 'bubbles') {
      tone(880, 0.08, { type: 'triangle', volume: 0.1 }); tone(1320, 0.1, { type: 'triangle', volume: 0.1, delay: 0.09 });
      ['Hey! 👋', 'git push?', 'LGTM ✅'].forEach((text, i) => {
        const bubble = textSprite(text, { width: 2.6, color: '#111111', background: 'rgba(255, 255, 255, 0.95)' });
        bubble.position.set(position.x + (i - 1) * 1.2, position.y + 1.5, position.z);
        spawn(group, bubble, 2.2, (p, t) => { bubble.position.y = position.y + 1.5 + t * 4 + i * 0.6; bubble.material.opacity = 1 - t; });
      });
    } else if (kind === 'music') {
      [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', volume: 0.08, delay: i * 0.1 }));
      for (let i = 0; i < 4; i++) {
        const note = textSprite(i % 2 ? '♪' : '♫', { width: 1.6, color, background: 'rgba(0, 0, 0, 0)', font: 'bold 110px Segoe UI, Arial, sans-serif' });
        note.position.set(position.x, position.y + 1, position.z);
        spawn(group, note, 2, (p, t) => { note.position.set(position.x + Math.sin(t * 6 + i) * 1.4, position.y + 1 + t * 5, position.z + Math.cos(t * 6 + i) * 1.4); note.material.opacity = 1 - t; });
      }
    } else if (kind === 'flash') {
      noise(0.08, 0.12); tone(1800, 0.05, { type: 'square', volume: 0.04 });
      const flash = sphere(0.6, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }), position.x, position.y + 1.4, position.z, 16);
      spawn(group, flash, 0.6, (p, t) => { flash.scale.setScalar(1 + t * 6); flash.material.opacity = 1 - t; });
    } else if (kind === 'play') {
      tone(220, 0.3, { type: 'sawtooth', volume: 0.06, slide: 220 });
      const play = mesh(new THREE.ConeGeometry(0.9, 1.4, 3), glow(color, 1.6, { transparent: true }), position.x, position.y + 1.6, position.z);
      play.rotation.z = -Math.PI / 2;
      spawn(group, play, 1.2, (p, t) => { play.position.y = position.y + 1.6 + t * 2; play.material.opacity = 1 - t; play.rotation.x += 0.1; });
    } else {
      tone(392 * Math.pow(2, (index % 12) / 12), 0.2, { type: 'triangle', volume: 0.1 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const spark = box(0.25, 0.25, 0.25, glow(color, 1.6, { transparent: true }), position.x, position.y + 1, position.z);
        spawn(group, spark, 1, (p, t) => { spark.position.set(position.x + Math.cos(angle) * t * 3, position.y + 1 + Math.sin(t * Math.PI) * 2, position.z + Math.sin(angle) * t * 3); spark.material.opacity = 1 - t; });
      }
    }
  }

  // --------------------------------------------------------------------------
  // The tower
  // --------------------------------------------------------------------------
  function build(group, { w, h, label }) {
    const core = w / 2;
    const columns = 6;
    const rows = Math.max(8, Math.floor((h - 4) / 2.6));
    const spacing = (core * 2) / columns;
    // Glossy black base and a thin glowing spine (the tower has no walls)
    group.add(cylinder(core + 9, core + 9.5, 0.4, material('#0d0f1a', { metalness: 0.6, roughness: 0.25 }), 0, 0.2, 0, 64));
    { const added = mesh(new THREE.TorusGeometry(core + 9, 0.15, 8, 96), glow('#1877f2', 1.4), 0, 0.45, 0); added.rotation.x = Math.PI / 2; group.add(added); }
    group.add(box(1.2, h, 1.2, glow('#4dabf7', 0.6), 0, h / 2, 0));
    // Facade: 4 faces of upright icon tiles arranged as equalizer bars
    const tiles = [];
    const tileGeometry = new THREE.BoxGeometry(spacing * 0.82, spacing * 0.82, 0.35);
    const edge = material('#f1f3f5', { roughness: 0.3 });
    let appIndex = 0;
    for (let face = 0; face < 4; face++) {
      const side = new THREE.Group();
      side.rotation.y = face * Math.PI / 2;
      group.add(side);
      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          const app = APPS[(appIndex++ * 7) % APPS.length];
          const tile = new THREE.Mesh(tileGeometry, [edge, edge, edge, edge, iconMaterial(app), edge]);
          tile.castShadow = true;
          tile.position.set(-core + spacing * (column + 0.5), 2 + row * 2.6, core);
          tile.userData.eq = { column: face * columns + column, row };
          side.add(tile);
          tiles.push(tile);
        }
      }
    }
    // Spiral of flat icon platforms climbing around the tower
    const platforms = [];
    const steps = Math.floor((h - 2) / 0.85);
    const ringRadius = core + 4.2;
    for (let i = 0; i < steps; i++) {
      const app = APPS[i % APPS.length];
      const angle = i * 0.36;
      const top = iconMaterial(app);
      const platform = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.8), [edge, edge, top, edge, edge, edge]);
      platform.castShadow = true;
      platform.receiveShadow = true;
      const baseY = 0.6 + i * 0.85;
      platform.position.set(Math.cos(angle) * ringRadius, baseY, Math.sin(angle) * ringRadius);
      platform.rotation.y = -angle;
      platform.userData.eq = { baseY, app, index: i, stepped: false };
      group.add(platform);
      platforms.push(platform);
    }
    // Rooftop deck with a giant App Store icon
    const deckY = 0.6 + steps * 0.85;
    group.add(cylinder(core + 1, core + 1, 0.5, material('#0d0f1a', { metalness: 0.5, roughness: 0.3 }), 0, deckY, 0, 48));
    { const added = mesh(new THREE.TorusGeometry(core + 1, 0.12, 8, 64), glow('#4dabf7', 1.5), 0, deckY + 0.3, 0); added.rotation.x = Math.PI / 2; group.add(added); }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.4), [edge, edge, edge, edge, iconMaterial(APPS[23]), iconMaterial(APPS[23])]);
    crown.position.set(0, deckY + 3.5, 0);
    group.add(crown);
    // Jukebox at the base: start / stop the music
    const jukebox = new THREE.Group();
    jukebox.add(box(2.2, 3, 1.2, material('#2b1055', { metalness: 0.4 }), 0, 1.5, 0));
    jukebox.add(box(1.8, 1.2, 0.1, glow('#da77f2', 1.4), 0, 2.2, 0.62));
    { const added = cylinder(1.1, 1.1, 1.2, glow('#ffd43b', 0.8), 0, 3, 0, 24, 1, true); added.rotation.x = Math.PI / 2; jukebox.add(added); }
    const jukeboxLabel = textSprite('Jukebox · start the music (E)', { width: 6, background: 'rgba(43, 16, 85, 0.9)' });
    jukeboxLabel.position.y = 4.6;
    jukebox.add(jukeboxLabel);
    jukebox.position.set(0, 0.4, core + 7);
    jukebox.userData.onInteract = () => {
      if (music) { stopMusic(); return '🔇 Music stopped.'; }
      startMusic();
      return '🎶 The Graphic Equalizer is playing! Jump from icon to icon.';
    };
    group.add(interactive(jukebox, 'jukebox', 'Graphic Equalizer jukebox'));
    const title = textSprite(label || 'Graphic Equalizer · The Tower of Icons', { width: 12, background: 'rgba(24, 119, 242, 0.9)' });
    title.position.set(0, 5, core + 9);
    group.add(title);

    const center = new THREE.Vector3();
    const local = new THREE.Vector3();
    let last = 0;
    animate(group, (time) => {
      const delta = Math.min(0.1, time - last);
      last = time;
      group.getWorldPosition(center);
      const position = typeof avatar !== 'undefined' ? avatar.position : null;
      const near = position && Math.hypot(position.x - center.x, position.z - center.z) < 120;
      if (!near) { if (music) stopMusic(); return; }
      if (music) music.beat = Math.max(0, music.beat - delta * 2.5);
      const energy = music ? 0.55 + music.beat * 0.45 : 0.15;
      // Equalizer bars: each column has its own "frequency band"
      tiles.forEach((tile) => {
        const { column, row } = tile.userData.eq;
        const band = 0.5 + 0.5 * Math.sin(time * (2.2 + (column % 6) * 0.55) + column * 1.3);
        const level = energy * (0.35 + band * 0.65) * rows;
        const active = row < level;
        tile.position.y = 2 + row * 2.6 * (1 + (music ? band * 0.12 : 0));
        tile.position.z = core + (active ? 0.6 + energy * band : 0);
        tile.scale.setScalar(active ? 1 + (music ? 0.08 * music.beat : 0) : 0.8);
      });
      // Floating platforms bounce with the beat
      platforms.forEach((platform) => {
        const data = platform.userData.eq;
        platform.position.y = data.baseY + Math.sin(time * (music ? 4 : 1.2) + data.index * 0.6) * (music ? 0.35 : 0.12);
      });
      // Step detection: trigger the icon's sound/effect once per landing
      if (position) {
        local.copy(position);
        group.worldToLocal(local);
        platforms.forEach((platform) => {
          const data = platform.userData.eq;
          const onTop = Math.hypot(local.x - platform.position.x, local.z - platform.position.z) < 1.6 && local.y - (platform.position.y + 0.25) > -0.4 && local.y - (platform.position.y + 0.25) < 0.7;
          if (onTop && !data.stepped) effect(group, data.app, platform.position, data.index);
          data.stepped = onTop;
        });
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.age += delta;
        const t = Math.min(1, particle.age / particle.life);
        particle.update(particle, t);
        if (t >= 1) { particle.group.remove(particle.object); particles.splice(i, 1); }
      }
    });
  }

  PropKit.registerBuilder(/equalizer_tower/, 'equalizerTower', build);
  return { startMusic, stopMusic };
})();
