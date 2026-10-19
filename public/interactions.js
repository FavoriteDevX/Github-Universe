// ============================================================================
// INTERACTIONS: ROBLOX-STYLE ACTIONS THAT MATCH EACH ENVIRONMENT
// ============================================================================
// Press E next to an object: work on a laptop, sit down, grab a coffee, play an
// arcade cabinet, fish at the pond, inspect showcase items or jump into a World.
// Also: emotes (/e wave, dance, cheer, clap, sit), parkour coins and timer.
const Interactions = (() => {
  const REACH = 3.2;
  const EMOTES = { wave: '*waves*', dance: '*dances*', cheer: '*cheers*', clap: '*claps*', sit: '*sits*', think: '*thinks*', ship: '*ships it*', coffee: '*coffee break*' };
  const FISH = [
    ['Null Pointer Pike', 'common'], ['Merge Conflict Carp', 'common'], ['Off-by-One Trout', 'common'],
    ['Async Anchovy', 'uncommon'], ['Regex Ray', 'uncommon'], ['Segfault Shark', 'rare'],
    ['Golden Semicolon Koi', 'epic'], ['Legendary 10x Whale', 'legendary']
  ];
  const CODE = `// GitHub Multiverse - simulated work session
import { Universe } from '@github/multiverse';

export async function shipFeature(dev) {
  const branch = await git.checkout('-b', 'feature/' + dev.idea);
  const tests = await runTests({ coverage: true });
  if (!tests.green) throw new Error('Write the tests first!');
  await git.commit('-m', 'feat: ' + dev.idea);
  await git.push('origin', branch);
  return openPullRequest({ reviewers: ['rubber-duck'] });
}

function fixBug(bug) {
  const cause = rubberDuck.explain(bug);
  return cause.fix().then(() => console.log('Fixed!', bug.id));
}
`;

  let hooks = null;
  let nearest = null;
  let seated = null;
  let fishing = null;
  let workSession = null;
  let parkour = { running: false, start: 0, coins: new Set() };
  let arcadeGame = null;
  let portalCooldown = 0;
  const ui = {
    prompt: document.getElementById('interact-prompt'),
    work: document.getElementById('work-overlay'),
    workCode: document.getElementById('work-code'),
    workStats: document.getElementById('work-stats'),
    workCommit: document.getElementById('work-commit'),
    workClose: document.getElementById('work-close'),
    arcade: document.getElementById('arcade-overlay'),
    arcadeCanvas: document.getElementById('arcade-canvas'),
    arcadeClose: document.getElementById('arcade-close'),
    timer: document.getElementById('parkour-timer')
  };

  // --------------------------------------------------------------------------
  // Proximity: find the closest interactable (laptop, seat, coffee...)
  // --------------------------------------------------------------------------
  const worldPosition = new THREE.Vector3();
  function findNearest(avatar) {
    let best = null;
    let bestDistance = REACH;
    PropKit.interactables.forEach((object) => {
      if (!object.parent || !object.visible) return;
      object.getWorldPosition(worldPosition);
      const distance = Math.hypot(worldPosition.x - avatar.x, worldPosition.z - avatar.z);
      if (distance < bestDistance && Math.abs(worldPosition.y - avatar.y) < 3) {
        best = object;
        bestDistance = distance;
      }
    });
    return best;
  }

  const PROMPTS = {
    laptop: 'Press E to work on the laptop · C to Codify',
    codeblock: 'Press E to edit your code block',
    land: 'Press E to buy this parcel (250 MVC)',
    bed: 'Press E to sleep (skips the night, sets your spawn point)',
    cafe_menu: 'Press E to see the menu and order',
    sit: 'Press E to sit',
    coffee: 'Press E for a coffee (run faster)',
    arcade: 'Press E to play',
    fish: 'Press E to fish',
    inspect: 'Press E to inspect',
    jump: 'Press E to JUMP IN',
    link: 'Press E to open the community link',
    warp: 'Press E to take the elevator',
    metro: 'Press E to open the Metro map',
    reward: 'Press E to claim your Gravity Flip reward',
    glass: 'Press E to change the smart glass',
    vehicle: 'Press E to ride',
    jukebox: 'Press E to start / stop the music'
  };

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------
  function interact(object) {
    if (window.Sound) Sound.play('interact');
    const { type, label } = object.userData.interactable;
    switch (type) {
      case 'laptop': openWork(object); break;
      case 'sit': sitOn(object); break;
      case 'coffee':
        hooks.buff('speed', 15);
        hooks.system(`You grabbed a coffee at the ${label}. Running faster for 15s!`);
        hooks.emote('coffee');
        break;
      case 'arcade': openArcade(label); break;
      case 'fish': startFishing(); break;
      case 'inspect': hooks.inspect(object.userData.label || label, object.userData.info || ''); break;
      case 'jump': hooks.jumpTo(label); break;
      case 'metro': hooks.openMetro(); break;
      case 'reward': hooks.claimReward(); break;
      case 'glass': hooks.system(`Smart glass: ${object.userData.cycle()}`); break;
      case 'vehicle': Vehicles.mount(object.userData.vehicleKey); break;
      case 'jukebox': hooks.system(object.userData.onInteract()); break;
      // Generic action for district builders: userData.onInteract(hooks) may
      // return a chat message; userData.prompt overrides the "Press E" text
      case 'action': {
        const message = object.userData.onInteract(hooks, object);
        if (message) hooks.system(message);
        break;
      }
      case 'codeblock': Codify.interact(object); break;
      case 'land': hooks.buyLand(object.userData.parcel); break;
      case 'bed': hooks.sleep(object); break;
      case 'cafe_menu': Cafe.open(); break;
      case 'link': {
        const url = object.userData.url;
        if (url && /^https:\/\//.test(url)) { window.open(url, '_blank', 'noopener'); hooks.system(`↗ Opened ${label} in a new tab.`); }
        break;
      }
      case 'warp': {
        const destination = object.parent.localToWorld(object.userData.destination.clone());
        hooks.setAvatarPosition(destination);
        hooks.system(`${label}`);
        break;
      }
      default: break;
    }
  }

  function sitOn(object) {
    object.getWorldPosition(worldPosition);
    seated = { position: worldPosition.clone() };
    hooks.setAvatarPosition(new THREE.Vector3(worldPosition.x, worldPosition.y + 0.4, worldPosition.z));
    hooks.emote('sit');
    hooks.system('You sat down. Move (W A S D) to stand up.');
  }

  // Simulated work: type any keys and real-looking code appears (hacker typer)
  function openWork(object) {
    object.getWorldPosition(worldPosition);
    sitNear(worldPosition);
    workSession = { typed: 0, lines: 0, startedAt: performance.now() };
    ui.workCode.textContent = '';
    updateWorkStats();
    ui.work.style.display = 'flex';
  }

  function sitNear(position) {
    seated = { position: position.clone() };
  }

  function updateWorkStats() {
    if (!workSession) return;
    const minutes = Math.floor((performance.now() - workSession.startedAt) / 60000);
    ui.workStats.textContent = `${workSession.lines} lines written · ${minutes} min focused · commits shipped: ${hooks.commitCount()}`;
  }

  function typeCode(count = 3) {
    if (!workSession) return;
    const next = CODE.slice(workSession.typed % CODE.length, (workSession.typed % CODE.length) + count);
    workSession.typed += count;
    workSession.lines += (next.match(/\n/g) || []).length;
    ui.workCode.textContent += next;
    ui.workCode.scrollTop = ui.workCode.scrollHeight;
    updateWorkStats();
  }

  function commitWork() {
    if (!workSession || workSession.lines < 3) {
      hooks.system('Write at least 3 lines of code before committing (just keep typing!).');
      return;
    }
    hooks.commit(workSession.lines);
    workSession.lines = 0;
    ui.workCode.textContent += '\n$ git commit -m "feat: ship it" && git push\npushed to origin/main\n\n';
    updateWorkStats();
  }

  function closeWork() {
    workSession = null;
    ui.work.style.display = 'none';
  }

  // Cozy fishing: cast, wait for the bite (!), press E again to reel in
  function startFishing() {
    if (fishing && fishing.biteAt && performance.now() > fishing.biteAt) {
      const roll = Math.random();
      const fish = roll > 0.97 ? FISH[7] : roll > 0.9 ? FISH[6] : roll > 0.78 ? FISH[5] : roll > 0.55 ? FISH[3 + Math.floor(Math.random() * 2)] : FISH[Math.floor(Math.random() * 3)];
      hooks.system(`You caught a ${fish[0]} (${fish[1]})!`);
      hooks.broadcast(`caught a ${fish[0]} (${fish[1]}) at the Cozy Pond`);
      fishing = null;
      hooks.emote('cheer');
      return;
    }
    if (fishing) { hooks.system('Patience... wait for the bite (!) before reeling in.'); return; }
    fishing = { biteAt: performance.now() + 3000 + Math.random() * 5000 };
    hooks.system('You cast your line. Wait for the bite, then press E!');
  }

  // Arcade: a tiny "Pac-Git snake" game in an overlay (arrow keys, eat the commits)
  function openArcade(label) {
    const ctx = ui.arcadeCanvas.getContext('2d');
    const size = 20;
    arcadeGame = { snake: [[10, 10]], direction: [1, 0], food: [15, 10], score: 0, timer: null, label };
    ui.arcade.style.display = 'flex';
    const tick = () => {
      const game = arcadeGame;
      if (!game) return;
      const head = [(game.snake[0][0] + game.direction[0] + size) % size, (game.snake[0][1] + game.direction[1] + size) % size];
      if (game.snake.some(([x, y]) => x === head[0] && y === head[1])) {
        hooks.system(`Game over on ${label}: ${game.score} commits eaten.`);
        if (game.score >= 5) hooks.broadcast(`scored ${game.score} on ${label}`);
        game.snake = [[10, 10]];
        game.score = 0;
      } else {
        game.snake.unshift(head);
        if (head[0] === game.food[0] && head[1] === game.food[1]) {
          game.score++;
          game.food = [Math.floor(Math.random() * size), Math.floor(Math.random() * size)];
        } else {
          game.snake.pop();
        }
      }
      ctx.fillStyle = '#05040f';
      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = '#f05032';
      ctx.beginPath(); ctx.arc(game.food[0] * 20 + 10, game.food[1] * 20 + 10, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd43b';
      game.snake.forEach(([x, y], index) => ctx.fillRect(x * 20 + 1, y * 20 + 1, 18, 18 - (index ? 2 : 0)));
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Consolas, monospace';
      ctx.fillText(`${label.toUpperCase()}  ·  COMMITS: ${game.score}`, 10, 390);
    };
    arcadeGame.timer = setInterval(tick, 110);
  }

  function closeArcade() {
    if (arcadeGame) clearInterval(arcadeGame.timer);
    arcadeGame = null;
    ui.arcade.style.display = 'none';
  }

  // --------------------------------------------------------------------------
  // Keyboard routing (called by main.js before game shortcuts)
  // --------------------------------------------------------------------------
  function handleKey(event) {
    if (workSession) {
      if (event.key === 'Escape') { closeWork(); return true; }
      if (event.key === 'Enter' && event.ctrlKey) { commitWork(); return true; }
      if (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace') { typeCode(event.key === 'Enter' ? 12 : 4); event.preventDefault(); return true; }
      return true;
    }
    if (arcadeGame) {
      const directions = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const next = directions[event.key.toLowerCase()];
      if (next) { arcadeGame.direction = next; event.preventDefault(); return true; }
      if (event.key === 'Escape') { closeArcade(); return true; }
      return true;
    }
    if (event.key.toLowerCase() === 'e' && nearest) {
      interact(nearest);
      return true;
    }
    return false;
  }

  // The firepit the avatar stands next to (Fry your Code uses F), or null
  const firepitProbe = new THREE.Vector3();
  function nearFirepit(avatar) {
    let best = null;
    let bestDistance = 9;
    (window.firepits || []).forEach((pit) => {
      if (!pit.parent) return;
      pit.getWorldPosition(firepitProbe);
      const distance = Math.hypot(firepitProbe.x - avatar.x, firepitProbe.z - avatar.z);
      if (distance < bestDistance && Math.abs(firepitProbe.y - avatar.y) < 3) { best = pit; bestDistance = distance; }
    });
    return best;
  }

  // --------------------------------------------------------------------------
  // Per frame: prompts, fishing bites, seated state, parkour coins and timer
  // --------------------------------------------------------------------------
  function update(avatar, moving) {
    if (seated && moving) { seated = null; hooks.emote(null); }
    nearest = workSession || arcadeGame ? null : findNearest(avatar);
    const biting = fishing && performance.now() > fishing.biteAt;
    if (biting) {
      ui.prompt.textContent = 'A fish is biting! Press E to reel in!';
      ui.prompt.style.display = 'block';
      if (!nearest) fishing = null;
    } else if (nearest) {
      const text = nearest.userData.prompt || PROMPTS[nearest.userData.interactable.type] || 'Press E';
      ui.prompt.textContent = nearFirepit(avatar) ? `${text} · F to Fry your Code` : text;
      ui.prompt.style.display = 'block';
    } else if (nearFirepit(avatar)) {
      ui.prompt.textContent = 'Press F to Fry your Code';
      ui.prompt.style.display = 'block';
    } else {
      ui.prompt.style.display = 'none';
    }

    // Teleport portals: walking through the arch jumps into a World
    if (performance.now() > portalCooldown) {
      (window.teleportPortals || []).forEach((portal) => {
        portal.group.getWorldPosition(worldPosition);
        if (Math.hypot(worldPosition.x - avatar.x, worldPosition.z - avatar.z) < 1.6 && avatar.y < worldPosition.y + 4) {
          portalCooldown = performance.now() + 4000;
          hooks.system('Through the portal...');
          hooks.jumpTo(portal.target);
        }
      });
    }
    // Jump pads in the Mini-Game Arena launch you into the air
    (window.jumpPads || []).forEach((pad) => {
      pad.getWorldPosition(worldPosition);
      if (Math.hypot(worldPosition.x - avatar.x, worldPosition.z - avatar.z) < 1.4 && Math.abs(avatar.y - worldPosition.y) < 0.8) hooks.launch(22);
    });

    // Parkour Park: start/finish pads and coins
    (window.parkourPads || []).forEach((pad) => {
      pad.getWorldPosition(worldPosition);
      if (Math.hypot(worldPosition.x - avatar.x, worldPosition.z - avatar.z) > 2.2 || Math.abs(worldPosition.y - avatar.y) > 1.5) return;
      if (pad.userData.parkourPad === 'start' && !parkour.running) {
        parkour = { running: true, start: performance.now(), coins: new Set() };
        (window.parkourCoins || []).forEach((coin) => { coin.visible = true; });
        hooks.system('Parkour started! Collect the coins and reach the FINISH flag.');
      } else if (pad.userData.parkourPad === 'finish' && parkour.running) {
        const seconds = ((performance.now() - parkour.start) / 1000).toFixed(1);
        parkour.running = false;
        hooks.broadcast(`finished Parkour Park in ${seconds}s with ${parkour.coins.size}/${(window.parkourCoins || []).length} coins`);
        hooks.emote('cheer');
      }
    });
    (window.parkourCoins || []).forEach((coin) => {
      if (!coin.visible) return;
      coin.getWorldPosition(worldPosition);
      if (worldPosition.distanceTo(avatar) < 1.8 || Math.hypot(worldPosition.x - avatar.x, worldPosition.z - avatar.z) < 1.2 && Math.abs(worldPosition.y - avatar.y - 1) < 1.6) {
        coin.visible = false;
        parkour.coins.add(coin.userData.collectible.id);
        hooks.system(`Coin ${parkour.coins.size}/${window.parkourCoins.length}`);
      }
    });
    ui.timer.style.display = parkour.running ? 'block' : 'none';
    if (parkour.running) ui.timer.textContent = `${((performance.now() - parkour.start) / 1000).toFixed(1)}s · ${parkour.coins.size}/${(window.parkourCoins || []).length}`;
  }

  function init(options) {
    hooks = options;
    ui.workCommit.addEventListener('click', commitWork);
    ui.workClose.addEventListener('click', closeWork);
    ui.arcadeClose.addEventListener('click', closeArcade);
  }

  return { init, update, handleKey, nearFirepit, EMOTES, isBusy: () => !!(workSession || arcadeGame), isSeated: () => !!seated };
})();
