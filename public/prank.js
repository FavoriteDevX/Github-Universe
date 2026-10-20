// ============================================================================
// THE MAIL TIME PRANK: A HIDDEN SPOT IN GENESIS PLAZA
// ============================================================================
// Somewhere in Genesis Plaza there is an invisible spot. Walk over it and a
// classic "Mail time! You've got mail!" dialog pops up. Whatever you click,
// the "computer" starts to freeze: the screen stutters, random error dialogs
// pile up until they cover everything, and then a blue screen appears with a
// real progress percentage while it "repairs". At 100% everything goes back
// to normal. It is only an overlay: the game keeps running underneath and
// nothing is changed. It fires at most once every 10 minutes per browser.
const Prank = (() => {
  const SPOT_OFFSET = { x: 71, z: -63 }; // local to the Genesis Plaza center
  const SPOT_RADIUS = 2.2;
  const COOLDOWN_MS = 10 * 60 * 1000;
  const ERRORS = [
    ['Error', 'The instruction at 0x00007ff8 referenced memory at 0x00000000. The memory could not be "read".'],
    ['explorer.exe', 'explorer.exe has encountered a problem and needs to close. We are sorry for the inconvenience.'],
    ['Low Disk Space', 'You are running out of disk space on Local Disk (C:). Click here to see if you can free space on this drive.'],
    ['node.exe - Application Error', 'JavaScript heap out of memory. Allocation failed.'],
    ['Git', 'fatal: refusing to merge unrelated histories'],
    ['Windows', 'A required .DLL file, MULTIVERSE32.DLL, was not found.'],
    ['npm', 'npm ERR! code ERESOLVE: unable to resolve dependency tree'],
    ['Security Warning', 'Your cursor has performed an illegal operation and will be shut down.'],
    ['Error 404', 'Keyboard not found. Press F1 to continue.'],
    ['Visual Studio', 'Not Responding. If you close the program, you might lose information.'],
    ['System', 'Stack overflow in module CURSOR.SYS. Please ask Stack Overflow.'],
    ['Docker', 'Cannot connect to the Docker daemon. Is the docker daemon running?'],
    ['Internet Explorer', 'This page cannot be displayed. Try again later (or never).'],
    ['Critical Error', 'Task failed successfully.']
  ];

  let layer = null;
  let running = false;
  let lastRun = 0;
  const timers = [];

  try { lastRun = Number(localStorage.getItem('multiverse-prank-last')) || 0; } catch (error) { lastRun = 0; }

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function injectStyles() {
    if (document.getElementById('prank-styles')) return;
    const style = document.createElement('style');
    style.id = 'prank-styles';
    style.textContent = `
      #prank-layer { position: fixed; inset: 0; z-index: 9000; pointer-events: none; font-family: Tahoma, Verdana, "Segoe UI", sans-serif; }
      #prank-layer .xp { position: absolute; width: 320px; background: #ece9d8; border: 3px solid #0831d9; border-radius: 8px 8px 0 0;
        box-shadow: 2px 3px 10px rgba(0,0,0,0.45); pointer-events: auto; color: #000; font-size: 12px; }
      #prank-layer .xp .bar { height: 26px; display: flex; align-items: center; justify-content: space-between; padding: 0 4px 0 8px;
        background: linear-gradient(#0a5ff3, #0040d8 40%, #0a3cc8); color: #fff; font-weight: bold; font-size: 13px; border-radius: 5px 5px 0 0;
        text-shadow: 1px 1px #0a1e6e; }
      #prank-layer .xp .close { width: 21px; height: 21px; border: 1px solid #fff; border-radius: 3px; background: linear-gradient(#e46d4b, #c1381a);
        color: #fff; font-weight: bold; line-height: 18px; text-align: center; cursor: default; font-size: 13px; }
      #prank-layer .xp .body { display: flex; gap: 14px; align-items: center; padding: 16px 14px 10px; }
      #prank-layer .xp .buttons { display: flex; justify-content: center; gap: 10px; padding: 6px 12px 14px; }
      #prank-layer .xp button { min-width: 86px; padding: 4px 10px; background: linear-gradient(#fff, #ece9d8); border: 1px solid #003c74;
        border-radius: 3px; font: 12px Tahoma, Verdana, sans-serif; cursor: pointer; }
      #prank-layer .xp button:focus { outline: 1px dotted #000; outline-offset: -4px; }
      #prank-layer .icon { width: 36px; height: 36px; flex: none; }
      #prank-layer.frozen .xp { cursor: wait; }
      #prank-bsod { position: fixed; inset: 0; z-index: 9500; background: #0078d7; color: #fff; pointer-events: auto; cursor: none;
        font-family: "Segoe UI", "Segoe UI Light", Arial, sans-serif; padding: 9vh 10vw; box-sizing: border-box; }
      #prank-bsod .face { font-size: 120px; line-height: 1; margin-bottom: 30px; font-weight: 300; }
      #prank-bsod p { font-size: 24px; max-width: 900px; line-height: 1.35; margin: 0 0 28px; font-weight: 300; }
      #prank-bsod .percent { font-size: 24px; margin-bottom: 40px; font-weight: 300; }
      #prank-bsod small { display: block; font-size: 14px; line-height: 1.6; opacity: 0.95; }
      body.prank-freeze canvas { filter: saturate(0.6) contrast(1.1); }
    `;
    document.head.appendChild(style);
  }

  // The classic mailbox icon, drawn as SVG (no image files, no emoji)
  const MAILBOX = `<svg class="icon" viewBox="0 0 36 36" aria-hidden="true">
      <rect x="16" y="20" width="4" height="15" fill="#6b4a2f"/>
      <path d="M6 12a8 8 0 0 1 16 0v10H6z" fill="#9aa6b2" stroke="#4a5562"/>
      <path d="M14 4h10a8 8 0 0 1 8 8v10H22V12a8 8 0 0 0-8-8z" fill="#c4ccd6" stroke="#4a5562"/>
      <rect x="9" y="13" width="9" height="6" fill="#f8f9fa" stroke="#4a5562"/>
      <rect x="25" y="6" width="2" height="9" fill="#e03131"/><rect x="25" y="6" width="6" height="4" fill="#e03131"/>
    </svg>`;
  const ERROR_ICON = `<svg class="icon" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#e03131" stroke="#9b1c1c"/>
      <path d="M11 11l14 14M25 11L11 25" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

  function dialog({ title, text, icon, buttons, x, y }) {
    const box = document.createElement('div');
    box.className = 'xp';
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.innerHTML = `<div class="bar"><span></span><span class="close">&times;</span></div><div class="body">${icon}<span class="text"></span></div><div class="buttons"></div>`;
    box.querySelector('.bar span').textContent = title;
    box.querySelector('.text').textContent = text;
    const row = box.querySelector('.buttons');
    buttons.forEach((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      row.appendChild(button);
    });
    layer.appendChild(box);
    return box;
  }

  function errorBeep() {
    if (!window.Sound || !Sound.isEnabled()) return;
    const ctx = Sound.unlock();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 440 + Math.random() * 80;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  }

  // Step 1: "You've got mail!"
  function start() {
    running = true;
    lastRun = Date.now();
    try { localStorage.setItem('multiverse-prank-last', String(lastRun)); } catch (error) { /* storage blocked */ }
    injectStyles();
    layer = document.createElement('div');
    layer.id = 'prank-layer';
    document.body.appendChild(layer);
    const box = dialog({ title: 'Mail time!', text: "You've got mail!", icon: MAILBOX, buttons: ['OK.', 'Remind me later.'], x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 80 });
    if (window.Sound) Sound.play('click');
    box.querySelectorAll('button, .close').forEach((button) => button.addEventListener('click', freeze, { once: true }));
  }

  // Step 2: everything starts to freeze and errors pile up
  function freeze() {
    if (!layer || layer.classList.contains('frozen')) return;
    layer.classList.add('frozen');
    document.body.classList.add('prank-freeze');
    document.body.style.cursor = 'wait';
    let count = 0;
    const spawn = () => {
      if (!running) return;
      const [title, text] = ERRORS[Math.floor(Math.random() * ERRORS.length)];
      // A cascade that drifts down and right, then restarts somewhere else
      const x = (count * 24 + Math.random() * 40 + (Math.floor(count / 18) * 140)) % Math.max(200, window.innerWidth - 320);
      const y = (count * 22 + Math.random() * 30) % Math.max(160, window.innerHeight - 150);
      const box = dialog({ title, text, icon: ERROR_ICON, buttons: ['OK', 'Cancel'], x, y });
      // Clicking only makes it worse
      box.querySelectorAll('button, .close').forEach((button) => button.addEventListener('click', () => { for (let i = 0; i < 3; i++) later(spawn, i * 60); }));
      errorBeep();
      count++;
      if (count < 70 && !bsodShown) later(spawn, Math.max(45, 380 - count * 9));
    };
    spawn();
    // The blue screen comes after ~10 s whatever the frame rate (timers can be slow on weak PCs)
    later(blueScreen, 10000);
    // The screen stutters more and more
    let shake = 0;
    const stutter = () => {
      if (!running || !layer || bsodShown) { document.body.style.transform = ''; return; }
      shake = Math.min(6, shake + 0.25);
      document.body.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`;
      later(stutter, 90);
    };
    later(stutter, 600);
  }

  // Step 3: the blue screen with a real percentage, then back to the game
  let bsodShown = false;
  function blueScreen() {
    if (bsodShown) return;
    bsodShown = true;
    document.body.style.transform = '';
    const screen = document.createElement('div');
    screen.id = 'prank-bsod';
    screen.innerHTML = `<div class="face">:(</div>
      <p>Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</p>
      <div class="percent"><span>0</span>% complete</div>
      <small>For more information about this issue and possible fixes, visit the nearest rubber duck<br>
      If you call a support person, give them this info:<br>Stop code: CURSOR_GOT_MAIL (0x0000DEAD)</small>`;
    document.body.appendChild(screen);
    if (layer) layer.remove();
    layer = null;
    const label = screen.querySelector('.percent span');
    let percent = 0;
    const tick = () => {
      // Real progress: irregular steps, slow at the start and near the end, like the real thing
      percent = Math.min(100, percent + (percent < 20 ? 2 : percent > 85 ? 1 : 3 + Math.floor(Math.random() * 6)));
      label.textContent = String(percent);
      if (percent < 100) later(tick, 120 + Math.random() * 380);
      else later(() => finish(screen), 1200);
    };
    later(tick, 1500);
  }

  function finish(screen) {
    screen.remove();
    document.body.classList.remove('prank-freeze');
    document.body.style.cursor = '';
    document.body.style.transform = '';
    running = false;
    bsodShown = false;
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (window.appendSystemMessage) appendSystemMessage('Repair complete. You found the Mail Time prank! (It only happens once every 10 minutes.)');
  }

  const spot = new THREE.Vector3();
  let plaza = null;
  // Called every frame with the avatar position
  function update(position) {
    if (running || Date.now() - lastRun < COOLDOWN_MS) return;
    if (!plaza) plaza = City.districts.find((district) => district.world.key === 'plaza');
    if (!plaza) return;
    spot.set(plaza.layout.center.x + SPOT_OFFSET.x, position.y, plaza.layout.center.z + SPOT_OFFSET.z);
    if (Math.hypot(position.x - spot.x, position.z - spot.z) < SPOT_RADIUS && Math.abs(position.y) < 3) start();
  }

  return { update, start };
})();
