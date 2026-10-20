// ============================================================================
// LIVE EVENTS: COMMUNITY EVENTS BOARD, STAGES WITH STREAMS, ATTENDANCE REWARD
// ============================================================================
// Like Decentraland Events. Data comes from /api/events (public/maps/events.json).
// - Community Events Board next to the Genesis Plaza spawn: E opens a modal
//   with two tabs, "Live now" and "Upcoming", with "Jump In" buttons.
// - A stage with a giant screen at every event location. While an event is
//   live and you are near, its stream plays (YouTube or Twitch); otherwise the
//   screen shows a static card ("Stream ended or offline", "Starts in 2h").
//   V toggles the sound (only the nearest screen ever plays audio).
// - Attendance: the SERVER checks your position every 15 s; 5 continuous
//   minutes inside a live event's stage area gives +100 MVC once per event.
// Times are ISO with a time zone, shown in the player's own time zone; the
// countdowns use the server clock, so a wrong computer clock does not matter.
const CommunityEvents = (() => {
  const BOARD_OFFSET = { x: -92, z: 58 }; // local to the Genesis Plaza center, next to the spawn
  let hooks = null;
  let data = { attendance: { radius: 28, minutes: 5, reward: 100 }, events: [] };
  let clockSkew = 0;
  const stages = new Map(); // "x,y" -> stage
  let board = null;
  let overlay = null;
  let activeTab = 'live';
  let presence = null; // { eventId, title, since, minutes }

  const now = () => Date.now() + clockSkew;
  const startOf = (event) => Date.parse(event.dataHoraInicio);
  const endOf = (event) => Date.parse(event.dataHoraFim);
  const isLive = (event, t = now()) => startOf(event) <= t && t < endOf(event);
  const liveEvents = () => data.events.filter((event) => isLive(event)).sort((a, b) => endOf(a) - endOf(b));
  const upcomingEvents = () => data.events.filter((event) => startOf(event) > now()).sort((a, b) => startOf(a) - startOf(b));

  // "in 2 d 3 h", "in 45 min", "ends in 12 min"
  function duration(ms) {
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} h ${minutes % 60} min`;
    return `${Math.floor(hours / 24)} d ${hours % 24} h`;
  }

  // Local date and time of the player (any time zone)
  function localTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(timestamp));
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  // ---------------------------------------------------------------------------
  // Stream links -> embeddable players (null when the link cannot be embedded)
  // ---------------------------------------------------------------------------
  function embedFor(url) {
    try {
      const link = new URL(url);
      const host = link.hostname.replace(/^www\.|^m\./, '');
      if (host === 'youtu.be') return youtube(link.pathname.slice(1));
      if (host === 'youtube.com') {
        const channelLive = link.pathname.match(/^\/channel\/(UC[\w-]{22})\/live/);
        if (channelLive) return `https://www.youtube.com/embed/live_stream?channel=${channelLive[1]}&autoplay=1&mute=1&playsinline=1`;
        if (link.searchParams.get('v')) return youtube(link.searchParams.get('v'));
        const path = link.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{11})/);
        if (path) return youtube(path[1]);
        return null;
      }
      if (host === 'twitch.tv') {
        const parent = window.location.hostname || 'localhost';
        const video = link.pathname.match(/^\/videos\/(\d+)/);
        if (video) return `https://player.twitch.tv/?video=${video[1]}&parent=${parent}&autoplay=true&muted=true`;
        const channel = link.pathname.match(/^\/([A-Za-z0-9_]{3,25})\/?$/);
        if (channel) return `https://player.twitch.tv/?channel=${channel[1]}&parent=${parent}&autoplay=true&muted=true`;
      }
    } catch (error) { /* not a valid URL: the stage shows the offline card */ }
    return null;
  }

  function youtube(id) {
    return /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1` : null;
  }

  // ---------------------------------------------------------------------------
  // 3D: the board and the stages
  // ---------------------------------------------------------------------------
  function cardTexture(key, width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.userData = { key };
    return texture;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(/\s+/);
    let line = '';
    let lines = 0;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        line = word;
        if (++lines >= maxLines) return;
      } else line = next;
    }
    if (line) ctx.fillText(line, x, y + lines * lineHeight);
  }

  function drawBoard() {
    const live = liveEvents();
    const upcoming = upcomingEvents().slice(0, Math.max(0, 4 - live.length));
    return cardTexture('board', 1024, 640, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#1b1f3b');
      gradient.addColorStop(1, '#3b1452');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Community Events', 40, 78);
      ctx.fillStyle = '#ced4da';
      ctx.font = '26px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Press E to see all events and Jump In', 40, 118);
      const rows = [...live.map((event) => [event, true]), ...upcoming.map((event) => [event, false])];
      if (!rows.length) { ctx.fillText('No events scheduled yet.', 40, 200); return; }
      rows.forEach(([event, isNow], index) => {
        const y = 160 + index * 116;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(30, y, w - 60, 100);
        ctx.fillStyle = isNow ? '#ff2d55' : '#4c6ef5';
        ctx.fillRect(30, y, 10, 100);
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.fillText(isNow ? 'LIVE' : `IN ${duration(startOf(event) - now()).toUpperCase()}`, 60, y + 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
        ctx.fillText(event.titulo.slice(0, 48), 60, y + 70);
        ctx.fillStyle = '#adb5bd';
        ctx.font = '22px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${event.tipo} · ${event.organizador}`.slice(0, 60), 600, y + 32);
      });
    });
  }

  function buildBoard() {
    const plaza = City.districts.find((district) => district.world.key === 'plaza');
    if (!plaza) return;
    const { box, material, glow, interactive } = PropKit.kit;
    const group = new THREE.Group();
    group.position.set(plaza.layout.center.x + BOARD_OFFSET.x, City.GROUND_LEVEL, plaza.layout.center.z + BOARD_OFFSET.z);
    // Face the spawn
    group.rotation.y = Math.atan2(-62 - BOARD_OFFSET.x, 42 - BOARD_OFFSET.z);
    [-5.6, 5.6].forEach((x) => group.add(box(0.5, 9, 0.5, material('#2b2d42', { metalness: 0.6 }), x, 4.5, 0)));
    group.add(box(11.6, 7.4, 0.4, material('#14151f', { metalness: 0.4 }), 0, 5.2, 0));
    const screen = new THREE.MeshBasicMaterial({ map: drawBoard() });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.875), screen);
    face.position.set(0, 5.2, 0.22);
    group.add(face);
    group.add(box(11.8, 0.18, 0.5, glow('#ff2d55', 1.6), 0, 9, 0));
    const trigger = new THREE.Object3D();
    trigger.position.set(0, 1, 1.4);
    trigger.userData.prompt = 'Press E for the Community Events Board';
    trigger.userData.onInteract = () => { open(); return ''; };
    group.add(interactive(trigger, 'action', 'Community Events Board'));
    hooks.scene.add(group);
    board = { group, screen };
  }

  function offlineCard(event, message) {
    return cardTexture(`offline|${message}`, 1280, 720, (ctx, w, h) => {
      ctx.fillStyle = '#101218';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
      ctx.fillText(message, w / 2, h / 2 - 20);
      if (event) {
        ctx.fillStyle = '#adb5bd';
        ctx.font = '36px "Segoe UI", Arial, sans-serif';
        ctx.fillText(event.titulo.slice(0, 60), w / 2, h / 2 + 50);
      }
    });
  }

  function buildStage(x, z) {
    const { box, cylinder, material, glow, interactive } = PropKit.kit;
    const group = new THREE.Group();
    group.position.set(x, City.GROUND_LEVEL, z);
    // Face the screen towards Genesis Plaza (the audience comes from there)
    group.rotation.y = Math.atan2(-x, -z) + Math.PI;
    const platform = cylinder(9, 9.4, 0.6, material('#2b2d42', { roughness: 0.6 }), 0, 0.3, -6, 40);
    group.add(platform);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.1, 0.08, 6, 64).rotateX(Math.PI / 2), glow('#ff2d55', 1.6));
    ring.position.set(0, 0.62, -6);
    ring.raycast = () => {};
    group.add(ring);
    // Screen with its frame and the truss
    group.add(box(17, 10, 0.5, material('#111318', { metalness: 0.5 }), 0, 7.2, -12));
    const screenMaterial = new THREE.MeshBasicMaterial({ map: offlineCard(null, 'Stage') });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), screenMaterial);
    screen.position.set(0, 7.2, -11.7);
    group.add(screen);
    [-8.8, 8.8].forEach((tx) => group.add(box(0.5, 13, 0.5, material('#495057', { metalness: 0.7 }), tx, 6.5, -12)));
    group.add(box(18.2, 0.5, 0.5, material('#495057', { metalness: 0.7 }), 0, 12.8, -12));
    for (let i = 0; i < 6; i++) group.add(cylinder(0.25, 0.3, 0.5, glow('#fff3bf', 2), -7 + i * 2.8, 12.4, -11.6, 10));
    // Audience benches
    for (let row = 0; row < 3; row++) {
      for (let col = -2; col <= 2; col++) {
        const bench = box(3, 0.45, 0.7, material('#8d6e63'), col * 3.6, 0.23, 6 + row * 3);
        group.add(interactive(bench, 'sit', 'Audience bench'));
      }
    }
    // Info / link point (opens streams that cannot be embedded, like X Spaces or Discord)
    const info = new THREE.Object3D();
    info.position.set(9.5, 1, -4);
    info.userData.prompt = 'Press E for the event info';
    group.add(interactive(info, 'action', 'Event info'));
    hooks.scene.add(group);
    City.addCollidable(platform);
    const handle = VideoScreens.register(screen, 16, 9, null, { distance: data.attendance.radius + 14 });
    return { group, screen, screenMaterial, handle, info, current: null, cardKey: '' };
  }

  function updateStages() {
    const t = now();
    stages.forEach((stage, key) => {
      const here = data.events.filter((event) => `${event.coordenadasDestino.x},${event.coordenadasDestino.y}` === key);
      const live = here.find((event) => isLive(event, t));
      const next = here.filter((event) => startOf(event) > t).sort((a, b) => startOf(a) - startOf(b))[0];
      const shown = live || next || null;
      const embed = live ? embedFor(live.urlTransmissao) : null;
      if (stage.current !== (live && embed)) {
        stage.current = live && embed ? embed : null;
        try { stage.handle.setSource(stage.current); } catch (error) { stage.handle.setSource(null); }
      }
      // Static card when nothing can play
      let message;
      if (live && !embed) message = 'Live now · press E to open the stream';
      else if (live) message = 'Live now';
      else if (next) message = `Starts in ${duration(startOf(next) - t)}`;
      else message = 'Stream ended or offline';
      if (stage.cardKey !== `${message}|${shown && shown.id}`) {
        stage.cardKey = `${message}|${shown && shown.id}`;
        if (stage.screenMaterial.map) stage.screenMaterial.map.dispose();
        stage.screenMaterial.map = offlineCard(shown, message);
        stage.screenMaterial.needsUpdate = true;
      }
      stage.info.userData.onInteract = () => {
        if (!shown) return 'No event scheduled on this stage.';
        if (live && /^https:\/\//.test(shown.urlTransmissao)) window.open(shown.urlTransmissao, '_blank', 'noopener');
        return `${shown.titulo} · ${shown.organizador} · ${localTime(startOf(shown))} to ${localTime(endOf(shown))}. ${shown.descricao}`;
      };
    });
    if (board && Math.floor(t / 30000) !== board.drawnAt) {
      board.drawnAt = Math.floor(t / 30000);
      if (board.screen.map) board.screen.map.dispose();
      board.screen.map = drawBoard();
      board.screen.needsUpdate = true;
    }
    if (overlay && overlay.style.display === 'flex') renderModal();
    renderPresence();
  }

  // ---------------------------------------------------------------------------
  // Modal with tabs
  // ---------------------------------------------------------------------------
  function buildModal() {
    const style = document.createElement('style');
    style.textContent = `
      #events-overlay { display: none; position: fixed; inset: 0; z-index: 65; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); }
      #events-overlay .box { width: min(640px, calc(100vw - 32px)); max-height: 82vh; display: flex; flex-direction: column; background: #16171f; color: #f1f3f5;
        border-radius: 18px; font: 14px/1.45 "Segoe UI", Arial, sans-serif; overflow: hidden; }
      #events-overlay header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 8px; }
      #events-overlay header b { font-size: 19px; }
      #events-overlay header button { background: none; border: 0; color: #adb5bd; font-size: 24px; cursor: pointer; }
      #events-overlay .tabs { display: flex; gap: 6px; padding: 0 20px 10px; }
      #events-overlay .tabs button { border: 0; border-radius: 20px; padding: 7px 14px; background: rgba(255, 255, 255, 0.08); color: #dee2e6; cursor: pointer; font-weight: 600; }
      #events-overlay .tabs button.active { background: #ff2d55; color: #fff; }
      #events-overlay .list { overflow-y: auto; padding: 4px 20px 20px; }
      #events-overlay .card { background: rgba(255, 255, 255, 0.05); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; border-left: 4px solid #4c6ef5; }
      #events-overlay .card.live { border-left-color: #ff2d55; }
      #events-overlay .card .meta { color: #adb5bd; font-size: 12px; margin: 2px 0 6px; }
      #events-overlay .card .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
      #events-overlay .badge { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #ff2d55; }
      #events-overlay .badge.soon { color: #74c0fc; }
      #events-overlay .jump { border: 0; border-radius: 10px; padding: 8px 16px; background: #ff2d55; color: #fff; font-weight: 700; cursor: pointer; }
      #events-overlay .jump:disabled { background: rgba(255, 255, 255, 0.1); color: #868e96; cursor: default; }
      #events-overlay .empty { color: #adb5bd; padding: 24px 0; text-align: center; }
      #events-toast { position: fixed; left: 50%; top: 90px; transform: translate(-50%, -20px); z-index: 66; opacity: 0; pointer-events: none;
        padding: 14px 22px; border-radius: 16px; background: linear-gradient(135deg, #ff2d55, #7048e8); color: #fff; font: 700 17px "Segoe UI", Arial, sans-serif;
        box-shadow: 0 10px 40px rgba(112, 72, 232, 0.5); }
      #events-toast.show { animation: events-pop 4.5s ease forwards; }
      @keyframes events-pop { 0% { opacity: 0; transform: translate(-50%, -20px) scale(0.85); } 10% { opacity: 1; transform: translate(-50%, 0) scale(1.06); }
        16% { transform: translate(-50%, 0) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -12px); } }
      #events-presence { position: fixed; left: 16px; top: 64px; z-index: 30; padding: 8px 12px; border-radius: 12px; background: rgba(22, 22, 32, 0.8);
        color: #fff; font: 600 12px "Segoe UI", Arial, sans-serif; display: none; min-width: 220px; }
      #events-presence i { display: block; height: 4px; border-radius: 2px; background: #ff2d55; margin-top: 6px; transition: width 1s linear; }
    `;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'events-overlay';
    overlay.innerHTML = `<div class="box" role="dialog" aria-label="Community Events">
        <header><b>Community Events</b><button type="button" aria-label="Close">&times;</button></header>
        <div class="tabs"><button type="button" data-tab="live">Live now</button><button type="button" data-tab="upcoming">Upcoming</button></div>
        <div class="list"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('header button').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => { activeTab = tab.dataset.tab; renderModal(); }));
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.style.display === 'flex') close(); });
    const toast = document.createElement('div');
    toast.id = 'events-toast';
    document.body.appendChild(toast);
    const presenceBar = document.createElement('div');
    presenceBar.id = 'events-presence';
    document.body.appendChild(presenceBar);
  }

  function renderModal() {
    overlay.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === activeTab));
    const list = overlay.querySelector('.list');
    const events = activeTab === 'live' ? liveEvents() : upcomingEvents();
    list.innerHTML = '';
    if (!events.length) {
      list.innerHTML = `<div class="empty">${activeTab === 'live' ? 'Nothing live right now. Check the Upcoming tab.' : 'No upcoming events yet.'}</div>`;
      return;
    }
    const t = now();
    events.forEach((event) => {
      const live = isLive(event, t);
      const card = document.createElement('article');
      card.className = `card${live ? ' live' : ''}`;
      card.innerHTML = `<div class="badge"></div><b class="title"></b><div class="meta"></div><div class="desc"></div>
        <div class="row"><span class="when"></span><button type="button" class="jump">Jump In</button></div>`;
      card.querySelector('.badge').textContent = live ? `LIVE · ends in ${duration(endOf(event) - t)}` : `STARTS IN ${duration(startOf(event) - t).toUpperCase()}`;
      if (!live) card.querySelector('.badge').classList.add('soon');
      card.querySelector('.title').textContent = event.titulo;
      card.querySelector('.meta').textContent = `${event.tipo} · by ${event.organizador}`;
      card.querySelector('.desc').textContent = event.descricao;
      card.querySelector('.when').textContent = `${localTime(startOf(event))} to ${localTime(endOf(event))}`;
      const jump = card.querySelector('.jump');
      jump.disabled = !live;
      jump.title = live ? 'Teleport to the event' : 'Jump In opens when the event starts';
      jump.addEventListener('click', () => jumpTo(event));
      list.appendChild(card);
    });
  }

  function jumpTo(event) {
    if (!isLive(event)) return;
    close();
    const { x, y } = event.coordenadasDestino;
    // Land in the audience area, facing the stage
    const stage = stages.get(`${x},${y}`);
    const target = stage ? stage.group.localToWorld(new THREE.Vector3(0, 0, 8)) : new THREE.Vector3(x, 0, y);
    hooks.flyTo(new THREE.Vector3(target.x, 0, target.z), `Jumped in: ${event.titulo}`);
  }

  function open() {
    hooks.releaseKeys();
    activeTab = liveEvents().length ? 'live' : 'upcoming';
    overlay.style.display = 'flex';
    renderModal();
  }

  function close() {
    overlay.style.display = 'none';
  }

  function toast(text) {
    const element = document.getElementById('events-toast');
    element.textContent = text;
    element.classList.remove('show');
    void element.offsetWidth;
    element.classList.add('show');
  }

  function renderPresence() {
    const bar = document.getElementById('events-presence');
    if (!bar) return;
    if (!presence) { bar.style.display = 'none'; return; }
    const elapsed = Math.min(1, (Date.now() - presence.since) / (presence.minutes * 60000));
    bar.style.display = 'block';
    bar.innerHTML = `Attending: ${presence.title.replace(/[<>&]/g, '')}<br>Stay ${Math.max(0, Math.ceil(presence.minutes * (1 - elapsed)))} min more for ${data.attendance.reward} MVC<i style="width:${Math.round(elapsed * 100)}%"></i>`;
    // Leaving the stage area cancels the local bar (the server resets its own timer)
    const event = data.events.find((candidate) => candidate.id === presence.eventId);
    if (!event || !isLive(event) || Math.hypot(hooks.avatarPosition().x - event.coordenadasDestino.x, hooks.avatarPosition().z - event.coordenadasDestino.y) > data.attendance.radius) presence = null;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  async function load() {
    try {
      const response = await fetch('/api/events', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      clockSkew = Number(json.serverTime) - Date.now() || 0;
      data = { attendance: json.attendance || data.attendance, events: Array.isArray(json.events) ? json.events : [] };
    } catch (error) {
      // Static hosting or offline: read the file directly (no rewards without the server)
      try { data = await (await fetch('maps/events.json')).json(); } catch (inner) { data = { attendance: data.attendance, events: [] }; }
    }
    data.events = data.events.filter((event) => event && event.coordenadasDestino && !Number.isNaN(Date.parse(event.dataHoraInicio)) && !Number.isNaN(Date.parse(event.dataHoraFim)));
  }

  async function init(options) {
    hooks = options;
    buildModal();
    await load();
    buildBoard();
    data.events.forEach((event) => {
      const key = `${event.coordenadasDestino.x},${event.coordenadasDestino.y}`;
      if (!stages.has(key)) {
        try { stages.set(key, buildStage(event.coordenadasDestino.x, event.coordenadasDestino.y)); } catch (error) { console.warn('[EVENTS] stage failed:', error); }
      }
    });
    updateStages();
    setInterval(updateStages, 1000);
    setInterval(async () => { await load(); }, 5 * 60 * 1000); // new events appear without reloading
    if (hooks.socket) {
      hooks.socket.on('event_presence', ({ eventId, title, minutes }) => {
        presence = { eventId, title, minutes, since: Date.now() };
        hooks.system(`You are attending "${title}". Stay ${minutes} minutes to earn ${data.attendance.reward} MVC.`);
      });
      hooks.socket.on('event_reward', ({ title, reward }) => {
        presence = null;
        toast(`Attendance confirmed! You earned ${reward} MVC`);
        hooks.system(`Attendance confirmed at "${title}": +${reward} MVC.`);
        if (window.Sound) Sound.play('coin');
      });
    }
  }

  return { init, open, close, embedFor };
})();
