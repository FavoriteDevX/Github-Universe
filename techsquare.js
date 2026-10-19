// ============================================================================
// TECH SQUARE: TIMES SQUARE-STYLE DISTRICT WITH LIVE DATA BILLBOARDS
// ============================================================================
// Giant LED screens fed by the server (feeds.js): the GitHub Mural (latest
// commits & PRs of famous repos, flashing with fireworks on new commits), the
// Big Tech Scoreboard (3D stock bars, only with a FINNHUB_API_KEY) and the Dev
// Trends feed (Hacker News, Stack Overflow, r/programming).
const TechSquare = (() => {
  const { material, glow, mesh, box, cylinder, animate, textSprite, repeated, windowsTexture, roundedSlab } = PropKit.kit;
  const screens = { mural: [], scoreboard: [], trends: [], ticker: [] };
  let feeds = null;
  const stockBars = [];
  const fireworks = [];
  let fireworksScene = null;
  let flashUntil = 0;

  function ledCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return { canvas, ctx: canvas.getContext('2d'), texture };
  }

  function timeAgo(timestamp) {
    if (!timestamp) return 'waiting for data...';
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    return minutes < 1 ? 'updated just now' : `updated ${minutes} min ago`;
  }

  function header(ctx, w, title, color, updatedAt) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, 90);
    ctx.fillStyle = color;
    ctx.font = 'bold 54px Segoe UI, Arial, sans-serif';
    ctx.fillText(title, 30, 62);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(w - 210, 45, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '26px Segoe UI, Arial, sans-serif';
    ctx.fillText(`LIVE · ${timeAgo(updatedAt)}`.slice(0, 32), w - 190, 55);
  }

  function drawMural(screen) {
    const { ctx, canvas, texture } = screen;
    const w = canvas.width;
    const h = canvas.height;
    const flashing = performance.now() < flashUntil && Math.floor(performance.now() / 200) % 2 === 0;
    ctx.fillStyle = flashing ? '#1f6feb' : '#0d1117';
    ctx.fillRect(0, 0, w, h);
    const github = feeds && feeds.github;
    header(ctx, w, 'GitHub Mural', '#ffffff', github && github.updatedAt);
    ctx.font = '28px Consolas, monospace';
    if (!github || (!github.commits.length && github.error)) {
      ctx.fillStyle = '#8b949e';
      ctx.fillText(github && github.error ? github.error.slice(0, 60) : 'Connecting to the GitHub API...', 30, 160);
    } else {
      ctx.fillStyle = '#7ee787';
      ctx.fillText('Latest commits', 30, 140);
      github.commits.slice(0, 7).forEach((commit, index) => {
        ctx.fillStyle = '#d29922';
        ctx.fillText(commit.sha, 30, 185 + index * 40);
        ctx.fillStyle = '#58a6ff';
        ctx.fillText(commit.repo.split('/')[1].padEnd(7, ' ').slice(0, 7), 160, 185 + index * 40);
        ctx.fillStyle = '#e6edf3';
        ctx.fillText(commit.message.slice(0, 52), 300, 185 + index * 40);
      });
      ctx.fillStyle = '#a371f7';
      ctx.fillText('Open pull requests', 30, 480);
      github.pulls.slice(0, 3).forEach((pull, index) => {
        ctx.fillStyle = '#e6edf3';
        ctx.fillText(`#${pull.number} ${pull.repo.split('/')[1]}: ${pull.title}`.slice(0, 70), 30, 525 + index * 40);
      });
    }
    texture.needsUpdate = true;
  }

  function drawScoreboard(screen) {
    const { ctx, canvas, texture } = screen;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#071018';
    ctx.fillRect(0, 0, w, h);
    const stocks = feeds && feeds.stocks;
    header(ctx, w, 'Big Tech Scoreboard · Nasdaq', '#ffffff', stocks && stocks.updatedAt);
    if (!stocks || !stocks.quotes.length) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '30px Segoe UI, Arial, sans-serif';
      ctx.fillText(stocks && stocks.error ? stocks.error : 'Waiting for quotes...', 30, 170);
      ctx.fillText('Get a free key at finnhub.io and start the server with', 30, 230);
      ctx.fillStyle = '#7ee787';
      ctx.font = '28px Consolas, monospace';
      ctx.fillText('FINNHUB_API_KEY=your_key npm start', 30, 280);
    } else {
      stocks.quotes.forEach((quote, index) => {
        const y = 150 + index * 70;
        const up = quote.change >= 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px Segoe UI, Arial, sans-serif';
        ctx.fillText(quote.symbol, 30, y);
        ctx.font = '30px Segoe UI, Arial, sans-serif';
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(quote.name, 170, y);
        ctx.fillText(`$${quote.price.toFixed(2)}`, 470, y);
        ctx.fillStyle = up ? '#3fb950' : '#f85149';
        ctx.fillText(`${up ? '▲' : '▼'} ${quote.percent.toFixed(2)}%`, 690, y);
      });
    }
    texture.needsUpdate = true;
    updateStockBars();
  }

  function drawTrends(screen) {
    const { ctx, canvas, texture } = screen;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#140d1f';
    ctx.fillRect(0, 0, w, h);
    const trends = feeds && feeds.trends;
    header(ctx, w, 'Dev Trending Topics', '#ffffff', trends && trends.updatedAt);
    const colors = { 'Hacker News': '#ff6600', 'Stack Overflow': '#f48024', 'r/programming': '#ff4500' };
    if (!trends || !trends.items.length) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '30px Segoe UI, Arial, sans-serif';
      ctx.fillText(trends && trends.error ? trends.error : 'Loading trends...', 30, 170);
    } else {
      trends.items.slice(0, 11).forEach((item, index) => {
        const y = 140 + index * 44;
        ctx.fillStyle = colors[item.source] || '#ffffff';
        ctx.font = 'bold 24px Segoe UI, Arial, sans-serif';
        ctx.fillText(item.source, 30, y);
        ctx.fillStyle = '#f0f6fc';
        ctx.font = '26px Segoe UI, Arial, sans-serif';
        ctx.fillText(item.title.slice(0, 58), 230, y);
      });
    }
    texture.needsUpdate = true;
  }

  function drawTicker(screen, offset) {
    const { ctx, canvas, texture } = screen;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const parts = [];
    if (feeds) {
      (feeds.stocks.quotes || []).forEach((quote) => parts.push(`${quote.symbol} ${quote.price.toFixed(2)} ${quote.change >= 0 ? '▲' : '▼'}${Math.abs(quote.percent).toFixed(2)}%`));
      (feeds.github.commits || []).slice(0, 4).forEach((commit) => parts.push(`${commit.repo}: ${commit.message}`));
      (feeds.trends.items || []).slice(0, 4).forEach((item) => parts.push(`${item.source}: ${item.title}`));
    }
    const text = parts.length ? `${parts.join('   ◆   ')}   ◆   ` : 'GitHub Multiverse · Tech Square · live data loading...   ◆   ';
    ctx.font = 'bold 60px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = '#ffd43b';
    const textWidth = ctx.measureText(text).width;
    const x = -(offset % textWidth);
    ctx.fillText(text, x, h * 0.68);
    ctx.fillText(text, x + textWidth, h * 0.68);
    texture.needsUpdate = true;
  }

  // Boards used outside Tech Square (Panorama Deck): Hall of Fame and Newsroom
  const newsBoards = [];
  function board(kind) {
    const led = ledCanvas(1024, 576);
    if (kind === 'newsroom') {
      newsBoards.push(led);
      drawNewsroom(led);
    } else {
      const drawFame = (entries) => {
        const { ctx, canvas, texture } = led;
        ctx.fillStyle = '#1b1208';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 60px Georgia, serif';
        ctx.fillText('Hall of Fame', 40, 80);
        ctx.font = '28px Segoe UI, Arial, sans-serif';
        ctx.fillStyle = '#e9d8b4';
        ctx.fillText('Creators of the month · most commits shipped from laptops', 40, 130);
        ctx.font = 'bold 36px Segoe UI, Arial, sans-serif';
        const list = (entries || []).slice(0, 6);
        if (!list.length) { ctx.fillStyle = '#c9b48a'; ctx.fillText('Be the first: sit at a laptop (E) and commit!', 40, 220); }
        list.forEach(([name, commits], index) => {
          ctx.fillStyle = index === 0 ? '#ffd166' : '#ffffff';
          ctx.fillText(`${['🥇', '🥈', '🥉'][index] || `${index + 1}.`} ${name}`, 40, 210 + index * 58);
          ctx.fillText(`${commits} commits`, 720, 210 + index * 58);
        });
        texture.needsUpdate = true;
      };
      drawFame([]);
      window.commitBoards = window.commitBoards || [];
      window.commitBoards.push(drawFame);
    }
    return led.texture;
  }

  function drawNewsroom(led) {
    const { ctx, canvas, texture } = led;
    ctx.fillStyle = '#0d1b3e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Segoe UI, Arial, sans-serif';
    ctx.fillText('Newsroom', 40, 80);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(330, 40, 110, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Segoe UI, Arial, sans-serif';
    ctx.fillText('LIVE', 352, 74);
    const items = (feeds && feeds.trends && feeds.trends.items) || [];
    ctx.font = '30px Segoe UI, Arial, sans-serif';
    if (!items.length) ctx.fillText(feeds && feeds.trends && feeds.trends.error ? feeds.trends.error : 'Loading dev news...', 40, 170);
    items.slice(0, 8).forEach((item, index) => {
      ctx.fillStyle = '#7fb3ff';
      ctx.fillText(item.source, 40, 160 + index * 52);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.title.slice(0, 44), 260, 160 + index * 52);
    });
    texture.needsUpdate = true;
  }

  function redrawAll() {
    newsBoards.forEach(drawNewsroom);
    screens.mural.forEach(drawMural);
    screens.scoreboard.forEach(drawScoreboard);
    screens.trends.forEach(drawTrends);
  }

  function updateStockBars() {
    const quotes = (feeds && feeds.stocks.quotes) || [];
    stockBars.forEach((bar, index) => {
      const quote = quotes[index];
      const percent = quote ? quote.percent : 0;
      const height = quote ? Math.max(0.6, 4 + percent * 2.5) : 0.6;
      bar.mesh.scale.y = height;
      bar.mesh.position.y = height / 2;
      bar.mesh.material = glow(quote ? (percent >= 0 ? '#2ea043' : '#da3633') : '#30363d', 0.6);
      bar.label.material.map = PropKit.kit.labelTexture(quote ? `${quote.symbol} ${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%` : bar.symbol, { bg: '#0d1117', fg: '#ffffff', width: 256, height: 64, font: 'bold 34px Segoe UI, Arial' });
      bar.label.position.y = height + 1.2;
    });
  }

  // Simple particle fireworks above the mural when a famous repo gets a new commit
  function launchFireworks(origin) {
    if (!fireworksScene) return;
    for (let burst = 0; burst < 5; burst++) {
      const count = 80;
      const positions = new Float32Array(count * 3);
      const velocities = [];
      const center = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, 25 + Math.random() * 15, (Math.random() - 0.5) * 10));
      for (let i = 0; i < count; i++) {
        positions.set([center.x, center.y, center.z], i * 3);
        const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 6);
        velocities.push(direction);
      }
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6), size: 0.8, transparent: true }));
      fireworksScene.add(points);
      fireworks.push({ points, velocities, born: performance.now() + burst * 350 });
    }
  }

  function update(time, deltaSeconds) {
    screens.ticker.forEach((screen) => drawTicker(screen, time * 220));
    if (performance.now() < flashUntil) screens.mural.forEach(drawMural);
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const firework = fireworks[i];
      const age = (performance.now() - firework.born) / 1000;
      if (age < 0) { firework.points.visible = false; continue; }
      firework.points.visible = true;
      const positions = firework.points.geometry.attributes.position;
      firework.velocities.forEach((velocity, index) => {
        velocity.y -= 9 * deltaSeconds;
        positions.setXYZ(index, positions.getX(index) + velocity.x * deltaSeconds, positions.getY(index) + velocity.y * deltaSeconds, positions.getZ(index) + velocity.z * deltaSeconds);
      });
      positions.needsUpdate = true;
      firework.points.material.opacity = Math.max(0, 1 - age / 2.2);
      if (age > 2.2) { fireworksScene.remove(firework.points); fireworks.splice(i, 1); }
    }
  }

  // --------------------------------------------------------------------------
  // Builders
  // --------------------------------------------------------------------------
  const builders = {
    // A tower wrapped by a giant LED screen of the given kind
    ledTower(group, { w, h, d, color, data, block }) {
      const kind = (data && data.screen) || 'mural';
      const facing = Math.atan2(-block.position[0], -block.position[2]);
      const inner = new THREE.Group();
      inner.rotation.y = facing;
      const body = roundedSlab(w, h, d, Math.min(w, d) * 0.1, new THREE.MeshStandardMaterial({ map: repeated(windowsTexture('#1b2230', '#8ab4ff'), 3, Math.round(h / 4)), roughness: 0.3, metalness: 0.5 }));
      body.position.y = -h / 2;
      inner.add(body);
      const screenWidth = w * 0.95;
      const screenHeight = Math.min(h * 0.45, screenWidth * 0.62);
      const led = ledCanvas(1024, Math.round(1024 * screenHeight / screenWidth));
      const screenMesh = box(screenWidth, screenHeight, 0.3, new THREE.MeshBasicMaterial({ map: led.texture }), 0, h * 0.12, d / 2 + 0.3);
      inner.add(screenMesh);
      inner.add(box(screenWidth + 0.6, screenHeight + 0.6, 0.3, material('#111111', { metalness: 0.6 }), 0, h * 0.12, d / 2 + 0.1));
      // Neon trim
      const trim = box(w + 0.4, 0.3, d + 0.4, glow(color || '#1877f2', 1.4), 0, h * 0.12 - screenHeight / 2 - 0.8, 0);
      inner.add(trim);
      group.add(inner);
      screens[kind].push(led);
      if (kind === 'mural') { drawMural(led); screenMesh.userData.label = 'GitHub Mural: live commits and pull requests'; }
      if (kind === 'scoreboard') { drawScoreboard(led); screenMesh.userData.label = 'Big Tech Scoreboard (Finnhub quotes)'; }
      if (kind === 'trends') { drawTrends(led); screenMesh.userData.label = 'Dev Trending Topics: Hacker News, Stack Overflow, r/programming'; }
      group.userData.label = screenMesh.userData.label;
    },

    // Curved ticker band wrapping a round tower
    tickerTower(group, { w, h, color }) {
      const radius = w / 2;
      group.add(cylinder(radius, radius, h, new THREE.MeshStandardMaterial({ map: repeated(windowsTexture('#202838', '#ffd27a'), 6, Math.round(h / 4)), roughness: 0.3, metalness: 0.5 }), 0, 0, 0, 32));
      const led = ledCanvas(4096, 128);
      const band = mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.3, 2.4, 48, 1, true), new THREE.MeshBasicMaterial({ map: led.texture, side: THREE.DoubleSide }), 0, h * 0.2, 0);
      group.add(band);
      group.add(cylinder(radius + 0.5, radius + 0.5, 0.3, glow(color || '#ffd43b', 1.4), 0, h * 0.2 + 1.4, 0, 48));
      group.add(cylinder(radius + 0.5, radius + 0.5, 0.3, glow(color || '#ffd43b', 1.4), 0, h * 0.2 - 1.4, 0, 48));
      screens.ticker.push(led);
    },

    // 3D stock bars (height = today's % change), only real data
    stockPodium(group, { w, d }) {
      group.add(box(w, 0.6, d, material('#161b22'), 0, 0.3, 0));
      ['AAPL', 'GOOGL', 'NVDA', 'MSFT', 'META', 'AMZN'].forEach((symbol, index) => {
        const bar = box(1.8, 1, 1.8, glow('#30363d', 0.6), -w / 2 + 1.6 + index * ((w - 3.2) / 5), 0.5, 0);
        const holder = new THREE.Group();
        holder.position.y = 0.6;
        holder.add(bar);
        const label = textSprite(symbol, { width: 3, background: 'rgba(13, 17, 23, 0.9)' });
        label.position.set(bar.position.x, 2, 0);
        holder.add(label);
        group.add(holder);
        stockBars.push({ mesh: bar, label, symbol });
      });
      updateStockBars();
    },

    neonArch(group, { w, h, color, label }) {
      const arch = mesh(new THREE.TorusGeometry(w / 2, 0.35, 10, 48, Math.PI), glow(color || '#1877f2', 1.6));
      group.add(arch);
      const sign = textSprite(label || 'TECH SQUARE', { width: w * 0.7, background: 'rgba(24, 119, 242, 0.9)' });
      sign.position.y = w / 2 + 2;
      group.add(sign);
      animate(arch, (time) => { arch.material.emissiveIntensity = 1.2 + Math.sin(time * 3) * 0.5; });
    }
  };

  const rules = [[/led_tower/, 'ledTower'], [/ticker_tower/, 'tickerTower'], [/stock_podium/, 'stockPodium'], [/neon_arch/, 'neonArch']];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));

  function init(socket, scene, system) {
    fireworksScene = scene;
    if (!socket) {
      feeds = {
        github: { commits: [], pulls: [], error: 'Live data needs the Node server (npm start)' },
        stocks: { quotes: [], error: 'Live data needs the Node server (npm start)' },
        trends: { items: [], error: 'Live data needs the Node server (npm start)' }
      };
      redrawAll();
      return;
    }
    socket.on('tech_feeds', (snapshot) => { feeds = snapshot; redrawAll(); });
    socket.on('feed_highlight', ({ repo, message }) => {
      flashUntil = performance.now() + 6000;
      system(`🎆 New commit on ${repo}: ${message}`);
      const mural = City.districts.find((district) => district.world.key === 'techsquare');
      if (mural) launchFireworks(mural.layout.center);
    });
    setInterval(redrawAll, 60000); // keeps the "updated X min ago" labels fresh
  }

  return { init, update, board };
})();
const TechBoards = { board: (kind) => TechSquare.board(kind) };
