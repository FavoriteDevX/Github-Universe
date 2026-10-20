// ============================================================================
// SOUND EFFECTS: CURSOR GLIDE AND SMALL UI SOUNDS (OPTIONAL)
// ============================================================================
// Everything is synthesized with the Web Audio API (no audio files): the hiss
// of a mouse gliding on a mousepad while the cursor moves, jump and landing,
// coins, teleports, clicks, a crackling fire and crickets at night. Toggle with the dock button or /sound on|off; the
// choice is remembered in this browser.
const Sound = (() => {
  let context = null;
  let master = null;
  let enabled = true;
  let airborneFor = 0;
  let cricketTimer = 0;
  try { enabled = localStorage.getItem('multiverse-sound') !== 'off'; } catch (error) { enabled = true; }

  function ensure() {
    if (!enabled) return null;
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function noiseBurst({ duration = 0.08, volume = 0.3, filter = 1200, type = 'lowpass', echo = false }) {
    const ctx = ensure();
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = type;
    biquad.frequency.value = filter;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(biquad).connect(gain).connect(master);
    if (echo) {
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.12;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35;
      gain.connect(delay).connect(feedback).connect(master);
      feedback.connect(delay);
    }
    source.start();
  }

  function tone(frequency, duration, { type = 'sine', volume = 0.2, slide = 0, delay = 0 } = {}) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  const vary = (value, amount) => value * (1 - amount / 2 + Math.random() * amount);
  const EFFECTS = {
    // A faint plastic tick of the mouse shell / scroll wheel while gliding
    mouseTick: () => noiseBurst({ duration: 0.012, volume: vary(0.05, 0.5), filter: vary(5200, 0.2), type: 'highpass' }),
    bird: () => {
      const base = 2200 + Math.random() * 1600;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(base + Math.random() * 400, 0.09, { type: 'sine', volume: 0.025, slide: 600 - Math.random() * 1200, delay: i * 0.13 });
    },
    // A quick, bright "bwip": a rising sine with a soft air puff (an original
    // sound in the spirit of classic platformer jumps; no game audio is copied)
    jump: () => {
      tone(320, 0.11, { type: 'sine', volume: 0.16, slide: 520 });
      tone(640, 0.08, { type: 'triangle', volume: 0.05, slide: 700, delay: 0.015 });
      noiseBurst({ duration: 0.07, volume: 0.06, filter: 2600, type: 'highpass' });
    },
    land: () => { noiseBurst({ duration: 0.12, volume: 0.25, filter: 400 }); tone(90, 0.12, { volume: 0.15 }); },
    coin: () => { tone(988, 0.08, { type: 'square', volume: 0.06 }); tone(1319, 0.25, { type: 'square', volume: 0.06, delay: 0.08 }); },
    teleport: () => { tone(200, 0.5, { type: 'sawtooth', volume: 0.05, slide: 1200 }); noiseBurst({ duration: 0.4, volume: 0.1, filter: 3000, type: 'highpass' }); },
    click: () => tone(660, 0.05, { type: 'triangle', volume: 0.08 }),
    interact: () => { tone(520, 0.06, { volume: 0.1 }); tone(780, 0.08, { volume: 0.08, delay: 0.05 }); },
    cricket: () => { for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 300, 0.03, { type: 'square', volume: 0.015, delay: i * 0.06 }); }
  };

  function play(name, argument) {
    if (!enabled || !EFFECTS[name]) return;
    EFFECTS[name](argument);
  }

  // Crackling campfire: a looping bed of low rumble and random pops and
  // crackles (generated once), louder as you get closer to a firepit
  let fire = null;
  function fireLoop() {
    const ctx = ensure();
    if (!ctx) return null;
    if (fire) return fire;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02; // brown noise: the roar of the flames
      data[i] = brown * 3.2;
    }
    // Crackles: short bright bursts at random moments
    for (let c = 0; c < 70; c++) {
      const at = Math.floor(Math.random() * (data.length - 2000));
      const length = 150 + Math.floor(Math.random() * 900);
      const loud = 0.15 + Math.random() * 0.5;
      for (let i = 0; i < length; i++) data[at + i] += (Math.random() * 2 - 1) * loud * Math.pow(1 - i / length, 3);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    fire = { gain };
    return fire;
  }

  // Cursor glide: instead of footsteps, the soft hiss of a mouse sliding on a
  // cloth mousepad (filtered white noise with a slow, uneven texture), plus a
  // faint plastic tick now and then. It swells while you move and fades when
  // you stop.
  let glide = null;
  let glideTickTimer = 0;
  function glideLoop() {
    const ctx = ensure();
    if (!ctx) return null;
    if (glide) return glide;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let texture = 0;
    for (let i = 0; i < data.length; i++) {
      // The weave of the mousepad: the noise level wobbles a little
      if (i % 600 === 0) texture = 0.55 + Math.random() * 0.45;
      data[i] = (Math.random() * 2 - 1) * texture;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400;
    band.Q.value = 0.7;
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 5200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(band).connect(soft).connect(gain).connect(master);
    source.start();
    glide = { gain, band };
    return glide;
  }

  let birdTimer = 3;
  // Called every frame with the avatar state
  function update(deltaSeconds, { moving, grounded, running, surface, night, fireDistance = Infinity, day = false }) {
    if (!enabled) { if (fire) fire.gain.gain.value = 0; if (glide) glide.gain.gain.value = 0; return; }
    // Fire volume: full at the fire, silent beyond 22 m
    const fireVolume = fireDistance < 22 ? Math.pow(1 - fireDistance / 22, 2) * 0.55 : 0;
    if (fireVolume > 0 || fire) {
      const loop = fireLoop();
      if (loop) loop.gain.gain.setTargetAtTime(fireVolume, context.currentTime, 0.3);
    }
    if (day) {
      birdTimer -= deltaSeconds;
      if (birdTimer <= 0) { play('bird'); birdTimer = 4 + Math.random() * 9; }
    }
    if (!grounded) airborneFor += deltaSeconds;
    else {
      if (airborneFor > 0.45) play('land');
      airborneFor = 0;
    }
    // Mouse glide while the cursor moves on the ground (brighter when running)
    const gliding = moving && grounded;
    const loop = gliding || glide ? glideLoop() : null;
    if (loop) {
      loop.gain.gain.setTargetAtTime(gliding ? (running ? 0.16 : 0.1) : 0, context.currentTime, gliding ? 0.06 : 0.12);
      loop.band.frequency.setTargetAtTime(running ? 3200 : 2400, context.currentTime, 0.2);
    }
    glideTickTimer -= deltaSeconds;
    if (gliding && glideTickTimer <= 0) {
      play('mouseTick');
      glideTickTimer = 0.8 + Math.random() * 1.6;
    }
    if (night) {
      cricketTimer -= deltaSeconds;
      if (cricketTimer <= 0) { play('cricket'); cricketTimer = 1.5 + Math.random() * 3; }
    }
  }

  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem('multiverse-sound', value ? 'on' : 'off'); } catch (error) { /* storage blocked */ }
    if (value) ensure();
    return enabled;
  }

  return { play, update, setEnabled, isEnabled: () => enabled, unlock: ensure };
})();
