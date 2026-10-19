// ============================================================================
// DEVELOPERS DAILY LIFE: AN OPEN-AIR GALLERY OF EVERYDAY ENGINEERING CHAOS
// ============================================================================
// A 70 x 50 m open pergola gallery near Genesis Plaza (region district
// "devlife" in worlds.json, map "map_devlife_museum.json" in districts.json),
// in the style of a metaverse art pavilion:
// - A light grey polished concrete floor under an open grid of thick white
//   beams on tall white pillars (no roof: sky and light come through), white
//   gallery walls at the back, a row of walk-through black portal frames at
//   the entrance and a long LED banner hanging from the beams with a
//   scrolling dev ticker.
// - 32 exhibits drawn with canvas textures (no external images; every app,
//   browser and tool is a generic drawn recreation): Too Many Tabs, Mission
//   Control Chaos, the Blue Screen of Death, node_modules, merge conflicts,
//   Vim, regex, 3 AM incidents... framed on the walls or on freestanding
//   black-framed panels scattered at angles across the floor.
// - Every exhibit has a label readable on approach; press E on it to inspect
//   the full (humorous) description.
// - Mascots and props: a giant rubber duck, a plush octocat-like cat (an
//   original design, not the GitHub logo), a desk with a mountain of coffee
//   cups, a giant keyboard with worn Ctrl/C/V keys, a battle station with six
//   monitors, and dark sofas.
// Performance: canvases are drawn lazily (one per frame, only when the camera
// comes near), labels share 4-per-atlas textures merged into one mesh per
// atlas, static parts are merged by material and the interior is hidden when
// the camera is far away (the usual DistanceCulling still handles the rest).
(() => {
  const { material, glow, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, mergeByMaterial, repeated } = PropKit.kit;
  const W = 70; // gallery width (x)
  const D = 50; // gallery depth (z); the portal entrance faces +z

  // --------------------------------------------------------------------------
  // Exhibits: [key, title, short blurb (on the wall label), full description]
  // --------------------------------------------------------------------------
  const EXHIBITS = {
    tabs: ['Too Many Tabs', 'Six windows, 187 tabs, zero idea which one is playing music.',
      'Every tab was opened with the sincere intention of reading it later. Later never came, but the RAM bill did. Researchers believe the average developer keeps 40 tabs open as a form of external memory, and 3 more as a form of emotional support. Closing one at random is considered an extreme sport. The music, by the way, was in the tab you just closed.'],
    mission: ['Mission Control Chaos', 'One laptop, four desktops, eleven windows, one Launchpad you opened by accident.',
      'Swipe up with three fingers and behold: every window you have ever opened, shrunk to the size of a postage stamp. Somewhere in there is the terminal you need, hiding behind two meeting notes and a calculator. The Launchpad grid opened by accident, again, with apps you have not used since installation. Experts recommend closing windows; developers recommend buying a bigger screen.'],
    bsod: ['The Blue Screen of Death', 'Your PC ran into a problem. So did your deadline.',
      'A sad face, a progress bar and a QR code nobody has ever scanned: the most honest error message in computing. It arrives exactly 30 seconds before you press Save, and it is always 0% complete for longer than it is 100% complete. The stop code is printed in capitals so you can search for it on your phone, which is now your only working computer. Collecting error info since forever, restarting for you any minute now.'],
    machine: ['It Works on My Machine', 'Certified by the only machine that matters: mine.',
      'The official seal of quality of software engineering. It is awarded after the code runs once, on one laptop, with seventeen environment variables nobody remembers setting. When QA reports a bug, the certificate is presented as evidence for the defense. The proposed fix, shipping the developer laptop to production, was rejected by finance but never by the developer.'],
    nodemodules: ['node_modules', 'The heaviest object in the known universe.',
      'Astronomers once believed black holes were the densest objects in existence, until someone ran npm install on a to-do app. This exhibit holds a scale replica of a node_modules folder; the original would collapse the museum into a singularity. It contains 1,400 packages, 3 of which you asked for, and one that only adds left padding. Do not delete it in front of the guards: the reinstall takes the rest of the afternoon.'],
    stackoverflow: ['Copy, Paste, Closed as Duplicate', 'The answer was already there. So was the question, in 2011.',
      'Here you can admire the most important keyboard workflow in history: find the question, skip the question, copy the accepted answer. Your own question, asked with care, was closed as a duplicate of a thread about a different language in 2011. The top answer has 4,000 upvotes and a comment saying it is deprecated. You used it anyway, and it worked, and nobody may ever know why.'],
    merge: ['Merge Conflict', '<<<<<<< HEAD: where two right answers meet and both lose.',
      'Two developers changed the same line on the same day with the same confidence. Git, a neutral observer, refuses to pick a side and writes angle brackets all over your file instead. Accept Current, Accept Incoming or Accept Both: the museum audio guide recommends a fourth option, walking away. The conflict markers were committed to main in 2019 and are now considered part of the architecture.'],
    friday: ['git push --force, Friday, 16:59', 'A bold move. A short weekend.',
      'This exhibit captures the exact second before history was rewritten, literally. The developer typed the command, felt a cold breeze, and pressed Enter anyway because the train leaves at 17:15. Three teammates lost their commits, and the incident channel gained a new member. The museum keeps the terminal behind glass so that nobody can press the up arrow again.'],
    bugs: ['99 Little Bugs in the Code', 'Take one down, patch it around: 127 little bugs in the code.',
      'The traditional work song of software engineering, sung at standups since the dawn of the compiler. Each verse fixes one bug and, through the mysterious mathematics of dependencies, introduces several new ones. Scholars have tried to reach the final verse, but the song is believed to be infinite, like the backlog. Please hum quietly: the bugs can hear you.'],
    darkmode: ['Dark Mode vs Light Mode', 'The longest war in the history of user interfaces.',
      'On the left, a calm night sky of syntax colors; on the right, the surface of the sun with line numbers. Dark mode users claim it saves their eyes, light mode users claim they can see things, and both claim the other is a phase. Opening a white web page at 2 AM after six hours in dark mode is classified as a workplace accident. The museum lighting is set to auto to avoid a riot.'],
    duck: ['The Rubber Duck', 'The most senior engineer in the building. Never once wrote code.',
      'Rubber duck debugging is simple: explain your code line by line to a duck, and halfway through you discover the bug yourself. The duck never interrupts, never schedules a follow-up and never asks for a ticket number. This specimen has solved more production incidents than most staff engineers and has been promoted to Principal Duck twice. It does not accept pull requests, only explanations.'],
    coffee: ['Coffee to Code', 'An input of coffee yields an output of code. The ratio is classified.',
      'The core build pipeline of the industry: beans go in, features come out, and mug rings are left on every printout as a watermark. The desk on this floor shows a typical week of fuel, stacked by a senior developer who refused to walk to the bin during a sprint. Decaf is displayed in a separate room, which is permanently empty. Please do not drink the exhibits.'],
    vim: ['How to Exit Vim', 'Visitors trapped since 1991: countless. Escape route: :q!',
      'Vim is a beautiful, efficient editor that some people have never been able to leave. The exit is simple once you know it: press Escape, type a colon, a q and an exclamation mark, then press Enter and feel the sun again. Many visitors instead close the terminal, restart the computer or move to a new apartment. The cursor on this screen has been blinking since the museum opened.'],
    regex: ['The Regex Nobody Understands', 'Written once, understood never, edited at your own risk.',
      'This pattern validates email addresses, or phone numbers, or summons something ancient; the original author is no longer reachable to confirm. It was copied from a forum, tested against one string and deployed to production, where it has rejected valid customers ever since. Changing a single character breaks four services in different time zones. Now you have two problems, and a museum exhibit.'],
    localhost: ['localhost:3000', 'The most visited website on earth. Available on one machine only.',
      'Every great product started here, on a port that was already in use. When the page loads, it is the best website in the world; when it does not, the dev server crashed twenty minutes ago and nobody noticed. Developers send this link to their managers about once a year, with predictable results. Try 3001. Then 3002. Then restart the computer.'],
    slack: ['47 Unread Notifications', 'Some were urgent. The rest said "quick question".',
      'You looked away for a coffee and came back to 47 notifications across 12 channels, 3 threads and one huddle you were pulled into by accident. Half of them are @channel announcements about the parking lot, the other half are "hey, got a sec?" with no follow-up. Focus mode was invented, then immediately disabled by a mention. This exhibit refreshes forever: the red badge never reaches zero.'],
    meeting: ['The Meeting That Could Have Been an Email', '60 minutes, 14 people, 1 decision: schedule another meeting.',
      'A calendar recovered from a real sprint, kept in a climate-controlled case. Notice the classic species: the sync about the sync, the quick 30-minute catch-up that lasts an hour and the meeting to plan the planning. Cameras were off, the decision was postponed and the action items were assigned to someone who left early. The email it could have been is displayed next to it, three lines long.'],
    center: ['Centering a Div', 'A thirty-year research program in two dimensions.',
      'Humans have landed on the Moon and decoded the genome, yet centering a box inside another box remained an open problem for decades. Generations tried margin auto, absolute positioning, tables and negative margins, and some simply moved the monitor. Flexbox finally solved it in three lines, which nobody remembers, so they search for it every single time. The box on this panel is centered. Probably.'],
    prod3am: ['Production Is Down, 03:07', 'The phone rings. The on-call engineer becomes a legend, or a cautionary tale.',
      'Every on-call rotation ends with this scene: a bright phone in a dark room, a red graph and a pager that does not care about your dreams. The incident was caused by a config change merged with the comment "tiny fix, no review needed". The fix took four minutes; finding it took three hours and two pots of coffee. The post-mortem was blameless, but everybody knows.'],
    semicolon: ['The Missing Semicolon', 'One character. Six hours. No witnesses.',
      'The smallest exhibit in the museum and the most expensive. A single missing semicolon produced an error message pointing to a completely different line, in a completely different file. Three developers, one architect and a rubber duck searched for it until sunset. When it was found, nobody spoke; the commit message simply said "fix".'],
    safari: ['Works in Chrome, Broken in Safari', 'Same code. Same page. Different universe.',
      'On the left, the page as designed: perfect spacing, smooth animations, joy. On the right, the exact same code in another browser, where the buttons float, the dates are invalid and the layout is held together by hope. The developer swore it was tested everywhere, which meant in two tabs of the same browser. The bug report arrived from the CEO phone, naturally.'],
    docker: ['It Works in the Container', '"Then we will ship your machine." And so, Docker.',
      'Born from the ashes of "it works on my machine", containers promised that software would run the same everywhere. Now it works in the container, but not in the other container, and the image is 4 GB because someone installed a whole operating system to print hello world. The whale on this panel carries 73 layers, two of them important. Docker compose up, and pray.'],
    todo: ['The TODO from 2014', '// TODO: refactor this later. Later: still pending.',
      'Discovered deep in a legacy file, this comment is one of the oldest living artifacts of the codebase. Its author left the company in 2016, and the function it promised to refactor now powers billing, login and, somehow, the coffee machine. Carbon dating of the indentation confirms it predates the current framework, the previous one and the one before that. Do not touch it: it is load-bearing.'],
    jira: ['Story Points and Estimates', 'Estimated: 1 point. Actual: three sprints and a reorg.',
      'Planning poker is a sacred ritual in which engineers hold up numbered cards to predict the unpredictable. The ticket said "change the button color", which turned out to require a new design system, a database migration and a meeting with legal. The coffee cup card was played four times. The estimate was accurate, the universe was not.'],
    ctrlcv: ['Ctrl+C / Ctrl+V', 'The two most worn keys on the planet, followed closely by Ctrl+Z.',
      'Archaeologists can date a developer keyboard by the shine on three keys: Control, C and V. The letters wore off years ago, but the fingers remember. Studies estimate that 40% of all code was typed exactly once and copied everywhere else, including the bugs. The giant keyboard on this floor is a faithful replica: please do not press Ctrl+V, the gift shop is already full of duplicates.'],
    keyboard: ['Mechanical Keyboard Noise', 'Clicky blue switches: 94 dB of pure productivity.',
      'To its owner, every keystroke is a symphony of tactile feedback and craftsmanship. To the rest of the open space, it is a hailstorm on a tin roof that starts at 9 AM sharp. The owner can talk about switches, keycaps and lubricants for an entire lunch break, and frequently does. Noise-canceling headphones were invented shortly after.'],
    monitors: ['The Evolution of Monitor Setups', 'From one laptop to six screens. Productivity: unchanged.',
      'Every developer begins the journey with a single laptop and the dream of more pixels. Then comes the second monitor, the vertical one for logs, the ultrawide for "context" and finally a wall of screens worthy of a space agency. At peak setup, one screen shows the code, one shows chat, and four show the same error message from different angles. The chair is the only part of the setup that ever gets used fully.'],
    tools: ['The Developer Toolbelt', 'Ten apps, opened every day, all at once, all the time.',
      'An honest portrait of a working day: the editor, the terminal, Git, Docker, an API client, the browser DevTools, chat, the ticket tracker, the design tool and npm, all open simultaneously. Each one is essential, each one wants an update, and each one has a different shortcut for search. Together they consume more memory than the first space missions combined. Drawn here as generic recreations, because the real icons are busy updating.'],
    naming: ['The Two Hard Problems', 'Cache invalidation, naming things and off-by-one errors.',
      'There are only two hard things in computer science, and this exhibit lists three of them, which proves the point. Visitors can admire variables named data, data2, newData, finalData and finalDataReal, in their natural habitat. The cache on this panel was invalidated during installation, so you may be seeing yesterday. Naming this exhibit took the curators four weeks.'],
    commits: ['Commit Messages', 'fix, fix again, final fix, final final fix, please work.',
      'A git log is a diary written by someone who is very tired. The early commits are poetic and descriptive; by Thursday night they are single words, then single letters, then "asdf". Historians use them to reconstruct the emotional state of the team during release week. The last entry, "revert everything", is considered a masterpiece of the late-sprint style.'],
    consolelog: ['console.log Debugging', 'Who needs a debugger when you have "here", "here2" and "WHY"?',
      'Debuggers have breakpoints, watches and call stacks; this method has the word "here" printed forty times. It is the oldest and most trusted diagnostic tool, passed down from senior to junior like a family recipe. Some of these logs reached production and now greet every customer in the browser console. The last one simply says "it should not be possible to reach this line". It was reached.'],
    tabsspaces: ['Tabs vs Spaces', 'A friendship ended over invisible characters.',
      'Two teams, one codebase and an argument about whitespace that has outlived three tech leads. Tabs people say it is about accessibility and choice; spaces people say it is about consistency and alignment. The formatter settled it automatically, and both sides were equally furious. Lines of code changed by the migration: 48,000. Lines of actual logic changed: zero.'],
    deskProp: ['The Coffee Mountain', 'A week of fuel, stacked by a developer during one sprint.',
      'This desk belonged to a senior engineer who believed the walk to the recycling bin was a context switch. Each cup represents roughly 40 lines of code, or one very long code review. The ring stains on the desk were analyzed by experts and form a perfect Gantt chart of the release. Visitors may sit nearby, but the cups are load-bearing.'],
    keyboardProp: ['The Giant Keyboard', 'A 7-meter replica. Notice the worn Ctrl, C and V.',
      'Built at 18 times the original scale so you can finally see what a career of copying and pasting does to a keyboard. Control, C and V are polished to a mirror finish, while F12 and Scroll Lock remain in mint condition. The space bar is worn on the left, where the thumb rests while thinking. Please do not climb on the Escape key: nobody ever finds it in time anyway.'],
    monitorProp: ['The Battle Station', 'Six monitors, one chair, one tiny terminal window in the corner.',
      'This setup cost more than the first car of its owner and is used mostly to watch logs scroll. The vertical screen on the side is for code, the ultrawide is for the chat, and the others show dashboards nobody reads. The chair is ergonomic, lumbar-supported and leaned back to the exact angle of "my build is running". Press E on the chair and see the world from the top of the career ladder.'],
    catProp: ['The Plush Octo-Cat', 'Half cat, half octopus, fully in charge of the pull request queue.',
      'This plush mascot has five soft legs, which is exactly enough to approve, request changes, comment, merge and close at the same time. It sits in the gallery as a reminder that open source is built by strange, friendly creatures working together across time zones. Visitors report it watches their commits with mild disappointment. It is not the logo of anything; any resemblance to a famous code-hosting cat is a coincidence the lawyers enjoyed.'],
    duckProp: ['Principal Duck', 'Four meters of debugging power. Explain your code to it.',
      'The largest rubber duck ever deployed for debugging purposes, standing under the atrium skylight. Walk up to it, explain your bug out loud from the beginning, and somewhere in the middle you will hear yourself say "oh wait". The duck has never written a line of code and has never been wrong. Its calendar is completely empty, which is the true mark of seniority.']
  };

  // --------------------------------------------------------------------------
  // Canvas helpers
  // --------------------------------------------------------------------------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRR(ctx, x, y, w, h, r, color) { ctx.fillStyle = color; rr(ctx, x, y, w, h, r); ctx.fill(); }
  function text(ctx, value, x, y, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(ctx, value, maxWidth) {
    const words = String(value).split(' ');
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
    });
    if (line) lines.push(line);
    return lines;
  }
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const SANS = 'Segoe UI, Helvetica, Arial, sans-serif';
  const MONO = 'Consolas, Menlo, monospace';

  // Caption strip at the bottom of every billboard: "EXHIBIT 07 · TITLE"
  let exhibitNumber = 0; // set right before each billboard is drawn
  function caption(ctx, w, h, title) {
    const number = exhibitNumber;
    const g = ctx.createLinearGradient(0, h - 70, 0, h);
    g.addColorStop(0, 'rgba(8, 10, 18, 0)');
    g.addColorStop(1, 'rgba(8, 10, 18, 0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 70, w, 70);
    text(ctx, `EXHIBIT ${String(number).padStart(2, '0')}`, 24, h - 20, `bold 20px ${SANS}`, '#7ee0ff');
    text(ctx, title.toUpperCase(), 150, h - 20, `bold 24px ${SANS}`, '#ffffff');
  }

  // Generic favicon-like glyphs (drawn recreations, not copied logos)
  function favicon(ctx, kind, x, y, s) {
    const c = x + s / 2;
    const m = y + s / 2;
    switch (kind) {
      case 0: fillRR(ctx, x, y + s * 0.15, s, s * 0.7, s * 0.2, '#ff0033'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(c - s * 0.12, m - s * 0.18); ctx.lineTo(c + s * 0.2, m); ctx.lineTo(c - s * 0.12, m + s * 0.18); ctx.fill(); break;
      case 1: fillRR(ctx, x, y, s, s, 3, '#ffffff'); text(ctx, 'W', c, m + s * 0.3, `${Math.round(s * 0.8)}px Georgia, serif`, '#111', 'center'); break;
      case 2: ['#4285f4', '#ea4335', '#fbbc05', '#34a853'].forEach((color, i) => { ctx.strokeStyle = color; ctx.lineWidth = s * 0.2; ctx.beginPath(); ctx.arc(c, m, s * 0.36, i * Math.PI / 2 + 0.3, (i + 1) * Math.PI / 2 + 0.1); ctx.stroke(); }); break;
      case 3: ['#36c5f0', '#2eb67d', '#ecb22e', '#e01e5a'].forEach((color, i) => { ctx.fillStyle = color; const a = (i * Math.PI) / 2; ctx.save(); ctx.translate(c, m); ctx.rotate(a); rr(ctx, -s * 0.1, -s * 0.45, s * 0.2, s * 0.55, s * 0.1); ctx.fill(); ctx.restore(); }); break;
      case 4: ctx.fillStyle = '#ff4500'; ctx.beginPath(); ctx.arc(c, m, s * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(c, m + s * 0.06, s * 0.3, s * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff4500'; ctx.fillRect(c - s * 0.15, m, s * 0.07, s * 0.07); ctx.fillRect(c + s * 0.08, m, s * 0.07, s * 0.07); break;
      case 5: fillRR(ctx, x, y + s * 0.15, s, s * 0.7, 2, '#ffffff'); ctx.strokeStyle = '#ea4335'; ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s * 0.8); ctx.lineTo(x + s * 0.1, y + s * 0.25); ctx.lineTo(c, m + s * 0.08); ctx.lineTo(x + s * 0.9, y + s * 0.25); ctx.lineTo(x + s * 0.9, y + s * 0.8); ctx.stroke(); break;
      case 6: fillRR(ctx, x, y, s, s, 3, '#111111'); text(ctx, 'M', c, m + s * 0.3, `bold ${Math.round(s * 0.78)}px Georgia, serif`, '#fff', 'center'); break;
      case 7: fillRR(ctx, x, y, s, s, 3, '#111111'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(c, y + 3); ctx.lineTo(x + 3 + i * (s - 6) / 3, y + s - 3); ctx.stroke(); } break;
      default: fillRR(ctx, x, y, s, s, 4, '#2d6cdf'); text(ctx, 'ux', c, m + s * 0.22, `bold ${Math.round(s * 0.55)}px ${SANS}`, '#fff', 'center');
    }
  }

  function browserWindow(ctx, x, y, w, h, { tabs = 0, url = '', dark = false, title = '' } = {}) {
    fillRR(ctx, x, y, w, h, 12, dark ? '#202124' : '#dee1e6');
    fillRR(ctx, x, y + 42, w, h - 42, 0, dark ? '#35363a' : '#ffffff');
    if (tabs) {
      const tw = Math.min(160, (w - 120) / tabs);
      for (let i = 0; i < tabs; i++) {
        favicon(ctx, i % 9, x + 30 + i * tw + (tw - 16) / 2, y + 13, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 30 + (i + 1) * tw - 1, y + 14, 1, 16);
      }
    } else if (title) {
      fillRR(ctx, x + 14, y + 8, 220, 34, 8, dark ? '#35363a' : '#ffffff');
      text(ctx, title, x + 30, y + 31, `15px ${SANS}`, dark ? '#e8eaed' : '#202124');
    }
    fillRR(ctx, x + 70, y + 50, w - 100, 28, 14, dark ? '#202124' : '#f1f3f4');
    text(ctx, url, x + 90, y + 70, `16px ${SANS}`, dark ? '#e8eaed' : '#3c4043');
    ['#9aa0a6', '#9aa0a6'].forEach((color, i) => text(ctx, i ? '>' : '<', x + 20 + i * 22, y + 70, `bold 18px ${SANS}`, color));
  }

  function terminal(ctx, x, y, w, h, lines, { title = 'zsh', size = 22 } = {}) {
    fillRR(ctx, x, y, w, h, 12, '#15171e');
    fillRR(ctx, x, y, w, 36, 12, '#2a2d37');
    ctx.fillStyle = '#2a2d37';
    ctx.fillRect(x, y + 24, w, 12);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((dot, i) => { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 22 + i * 22, y + 18, 7, 0, Math.PI * 2); ctx.fill(); });
    text(ctx, title, x + w / 2, y + 24, `15px ${SANS}`, '#aab', 'center');
    lines.forEach(([value, color], i) => text(ctx, value, x + 20, y + 70 + i * (size + 10), `${size}px ${MONO}`, color || '#d7dae0'));
  }

  // --------------------------------------------------------------------------
  // Billboard drawings (1024 x 640 each)
  // --------------------------------------------------------------------------
  const DRAW = {
    tabs(ctx, w, h) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(260, 220); ctx.lineTo(0, 560); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w, 40); ctx.lineTo(w, 180); ctx.lineTo(680, 150); ctx.fill();
      const rows = [[150, 70, 13], [205, 120, 14], [110, 170, 13], [130, 220, 13], [60, 270, 14], [140, 320, 13]];
      rows.forEach(([x, y, count], r) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 12;
        fillRR(ctx, x, y, w - x + 40, 72, 14, '#dfe1e7');
        ctx.restore();
        fillRR(ctx, x + 14, y + 12, 34, 34, 8, '#f8f9fb');
        text(ctx, 'v', x + 24, y + 36, `bold 18px ${SANS}`, '#333');
        for (let i = 0; i < count; i++) {
          const tx = x + 62 + i * 46;
          favicon(ctx, (i + r * 4) % 9 === 8 ? 8 : Math.floor((i + r * 3) / 3) % 8, tx, y + 18, 22);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(tx + 34, y + 20, 1, 20);
        }
        const close = x + 62 + count * 46;
        fillRR(ctx, close, y + 8, 50, 44, 10, '#ffffff');
        text(ctx, 'x', close + 25, y + 38, `22px ${SANS}`, '#333', 'center');
        text(ctx, '+', close + 78, y + 40, `28px ${SANS}`, '#444', 'center');
      });
      fillRR(ctx, 140, 392, w - 100, 120, 0, '#ffffff');
      fillRR(ctx, 300, 410, 560, 50, 25, '#ffffff');
      ctx.strokeStyle = '#c4c7cc'; ctx.lineWidth = 2; rr(ctx, 300, 410, 560, 50, 25); ctx.stroke();
      favicon(ctx, 2, 318, 422, 26);
      text(ctx, 'Search or type a URL', 360, 444, `24px ${SANS}`, '#3c4043');
      text(ctx, '<   >   C', 170, 444, `bold 24px ${SANS}`, '#5f6368');
      text(ctx, 'Tabs open: 187', 160, 520, `bold 34px ${SANS}`, '#d93025');
      text(ctx, 'RAM used: all of it', 470, 520, `bold 34px ${SANS}`, '#202124');
      caption(ctx, w, h, 'Too Many Tabs');
    },
    mission(ctx, w, h) {
      ctx.fillStyle = '#0b0b0e';
      ctx.fillRect(0, 0, w, h);
      // Laptop lid and screen
      fillRR(ctx, 70, 16, 884, 540, 26, '#1b1c20');
      const g = ctx.createLinearGradient(0, 40, 0, 520);
      g.addColorStop(0, '#2b3a55'); g.addColorStop(1, '#1d2433');
      ctx.fillStyle = g;
      ctx.fillRect(92, 36, 840, 500);
      fillRR(ctx, 452, 30, 120, 22, 8, '#0b0b0e');
      const random = seeded(25);
      // Mission Control: shrunken windows everywhere
      for (let i = 0; i < 16; i++) {
        const side = i % 2;
        const x = side ? 760 + random() * 120 : 100 + random() * 120;
        const y = 60 + Math.floor(i / 2) * 56 + random() * 10;
        const ww = 90 + random() * 60;
        fillRR(ctx, x, y, ww, 50, 4, ['#e9ecef', '#f8f9fa', '#343a40', '#fff3bf', '#d0ebff'][i % 5]);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y, ww, 7);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(90,90,110,0.5)'; ctx.fillRect(x + 6, y + 14 + k * 8, ww * (0.3 + random() * 0.6), 3); }
      }
      // Desktop strip on top
      for (let i = 0; i < 5; i++) fillRR(ctx, 290 + i * 92, 50, 80, 46, 4, i === 2 ? '#5c7cfa' : '#3b4a6b');
      // Launchpad panel with app grid
      fillRR(ctx, 300, 112, 424, 380, 22, 'rgba(25,25,30,0.92)');
      text(ctx, 'Applications', 330, 150, `bold 24px ${SANS}`, '#fff');
      const colors = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#845ef7', '#20c997', '#ff922b', '#f06595', '#868e96', '#339af0', '#94d82d', '#e64980'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        const x = 330 + c * 64;
        const y = 172 + r * 74;
        fillRR(ctx, x, y, 48, 48, 12, colors[(r * 6 + c) % colors.length]);
        fillRR(ctx, x + 12, y + 12, 24, 24, 6, 'rgba(255,255,255,0.45)');
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + 4, y + 54, 40, 4);
      }
      // Dock
      fillRR(ctx, 200, 500, 624, 32, 10, 'rgba(255,255,255,0.22)');
      for (let i = 0; i < 22; i++) fillRR(ctx, 210 + i * 27.5, 504, 23, 23, 6, colors[i % colors.length]);
      // Keyboard deck
      ctx.fillStyle = '#2a2b30';
      ctx.beginPath(); ctx.moveTo(40, 560); ctx.lineTo(984, 560); ctx.lineTo(1010, 584); ctx.lineTo(14, 584); ctx.fill();
      caption(ctx, w, h, 'Mission Control Chaos');
    },
    bsod(ctx, w, h) {
      ctx.fillStyle = '#0a5fd0';
      ctx.fillRect(0, 0, w, h);
      text(ctx, ':(', 90, 210, `150px ${SANS}`, '#ffffff');
      ctx.font = `30px ${SANS}`;
      ctx.fillStyle = '#ffffff';
      wrap(ctx, 'Your PC ran into a problem and needs to restart. We\'re just collecting some error info, and then we\'ll restart for you.', 820).forEach((line, i) => ctx.fillText(line, 90, 280 + i * 40));
      text(ctx, '20% complete', 90, 390, `30px ${SANS}`, '#ffffff');
      const random = seeded(7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(90, 420, 120, 120);
      ctx.fillStyle = '#0a5fd0';
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (random() < 0.5) ctx.fillRect(96 + x * 9, 426 + y * 9, 9, 9);
      [[96, 426], [168, 426], [96, 498]].forEach(([x, y]) => { ctx.fillStyle = '#0a5fd0'; ctx.fillRect(x, y, 36, 36); ctx.fillStyle = '#fff'; ctx.fillRect(x + 6, y + 6, 24, 24); ctx.fillStyle = '#0a5fd0'; ctx.fillRect(x + 12, y + 12, 12, 12); });
      text(ctx, 'For more information about this issue and possible fixes,', 236, 446, `18px ${SANS}`, '#e7f0ff');
      text(ctx, 'visit the page you will never visit.', 236, 470, `18px ${SANS}`, '#e7f0ff');
      text(ctx, 'If you call a support person, give them this info:', 236, 508, `18px ${SANS}`, '#e7f0ff');
      text(ctx, 'Stop code: CRITICAL_DEADLINE_DIED', 236, 534, `18px ${SANS}`, '#ffffff');
      caption(ctx, w, h, 'The Blue Screen of Death');
    },
    machine(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 600);
      g.addColorStop(0, '#fff8e1'); g.addColorStop(1, '#e9d8a6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a07c2c'; ctx.lineWidth = 10; ctx.strokeRect(24, 24, w - 48, h - 118);
      ctx.lineWidth = 2; ctx.strokeRect(40, 40, w - 80, h - 150);
      text(ctx, 'CERTIFICATE OF QUALITY', w / 2, 110, `bold 34px Georgia, serif`, '#6d4c11', 'center');
      text(ctx, 'IT WORKS', w / 2, 220, `bold 92px Georgia, serif`, '#2b2b2b', 'center');
      text(ctx, 'ON MY MACHINE', w / 2, 310, `bold 66px Georgia, serif`, '#2b2b2b', 'center');
      text(ctx, 'Tested once, on one laptop, with 17 mystery env vars', w / 2, 370, `italic 26px Georgia, serif`, '#5a4a2a', 'center');
      // Seal
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; const r = i % 2 ? 70 : 82; ctx.lineTo(820 + Math.cos(a) * r, 450 + Math.sin(a) * r); }
      ctx.fill();
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(820, 450, 56, 0, Math.PI * 2); ctx.stroke();
      text(ctx, '100%', 820, 448, `bold 30px ${SANS}`, '#fff', 'center');
      text(ctx, 'LOCAL', 820, 478, `bold 18px ${SANS}`, '#fff', 'center');
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, 480); ctx.lineTo(420, 480); ctx.stroke();
      text(ctx, 'Signed: the developer', 270, 508, `22px Georgia, serif`, '#333', 'center');
      caption(ctx, w, h, 'It Works on My Machine');
    },
    nodemodules(ctx, w, h) {
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, w, h);
      const random = seeded(3);
      for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${random() * 0.8})`; ctx.fillRect(random() * w, random() * h, 2, 2); }
      text(ctx, 'HEAVIEST OBJECTS IN THE UNIVERSE', w / 2, 60, `bold 32px ${SANS}`, '#ffffff', 'center');
      const items = [['Sun', 60, '#ffd43b'], ['Neutron star', 110, '#a5d8ff'], ['Black hole', 190, '#9775fa'], ['node_modules', 600, '#e03131']];
      items.forEach(([name, value, color], i) => {
        const y = 110 + i * 100;
        text(ctx, name, 40, y + 44, `bold 28px ${i === 3 ? MONO : SANS}`, '#e9ecef');
        ctx.fillStyle = color;
        ctx.fillRect(280, y + 14, Math.min(value, 700), 44);
        if (i === 3) text(ctx, 'off the chart', 840, y + 46, `bold 26px ${SANS}`, '#ffffff');
      });
      // Folder icon falling into a black hole
      ctx.fillStyle = '#e03131';
      fillRR(ctx, 760, 140, 180, 120, 10, '#f59f00');
      fillRR(ctx, 760, 124, 80, 30, 8, '#f59f00');
      text(ctx, 'node_modules', 850, 214, `bold 22px ${MONO}`, '#3b2a00', 'center');
      text(ctx, '1,400 packages · 3 you asked for', w / 2, 540, `24px ${SANS}`, '#ced4da', 'center');
      caption(ctx, w, h, 'node_modules');
    },
    stackoverflow(ctx, w, h) {
      ctx.fillStyle = '#f8f9f9';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f48024';
      ctx.fillRect(0, 0, w, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 8, w, 56);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#f48024'; ctx.fillRect(30 + i * 3, 46 - i * 6, 24, 4); }
      ctx.fillStyle = '#bcbbbb'; ctx.fillRect(26, 50, 34, 4);
      text(ctx, 'stack overflow', 70, 46, `26px ${SANS}`, '#232629');
      text(ctx, 'How do I center a div? (it worked yesterday)', 40, 112, `bold 30px ${SANS}`, '#0c0d0e');
      fillRR(ctx, 40, 130, 944, 92, 6, '#fdf7e2');
      ctx.strokeStyle = '#e6cf79'; ctx.lineWidth = 2; rr(ctx, 40, 130, 944, 92, 6); ctx.stroke();
      text(ctx, 'This question already has answers here:', 60, 162, `bold 22px ${SANS}`, '#3b4045');
      text(ctx, 'How do I do the thing? (14 answers) - asked 2011, different language', 60, 194, `20px ${SANS}`, '#0074cc');
      text(ctx, 'Closed as duplicate 3 minutes ago.', 60, 214, `16px ${SANS}`, '#6a737c');
      // Accepted answer with code and copy button
      text(ctx, '4,012', 70, 300, `bold 30px ${SANS}`, '#3b4045', 'center');
      ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.moveTo(70, 250); ctx.lineTo(90, 270); ctx.lineTo(50, 270); ctx.fill();
      ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(54, 330); ctx.lineTo(66, 344); ctx.lineTo(90, 314); ctx.stroke();
      fillRR(ctx, 130, 250, 840, 190, 6, '#e3e6e8');
      ['.parent {', '  display: flex;', '  justify-content: center;', '  align-items: center;  /* deprecated? see comments */', '}'].forEach((line, i) => text(ctx, line, 150, 290 + i * 32, `24px ${MONO}`, '#0c0d0e'));
      fillRR(ctx, 840, 262, 116, 40, 6, '#0a95ff');
      text(ctx, 'Copy', 898, 290, `bold 22px ${SANS}`, '#fff', 'center');
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(900, 296); ctx.lineTo(900, 334); ctx.lineTo(910, 324); ctx.lineTo(918, 340); ctx.lineTo(924, 337); ctx.lineTo(916, 321); ctx.lineTo(930, 321); ctx.closePath(); ctx.fill();
      text(ctx, 'Copied 1,204,331 times · read 12 times', 130, 480, `22px ${SANS}`, '#6a737c');
      caption(ctx, w, h, 'Copy, Paste, Closed as Duplicate');
    },
    merge(ctx, w, h) {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#252526'; ctx.fillRect(0, 0, w, 44);
      text(ctx, 'checkout.js  (merge conflict)', 24, 30, `18px ${SANS}`, '#cccccc');
      text(ctx, 'Accept Current Change | Accept Incoming Change | Accept Both Changes | Cry', 70, 76, `16px ${SANS}`, '#9d9d9d');
      const lines = [
        ['<<<<<<< HEAD (Current Change)', '#2ea04366', '#7ee787'],
        ['const total = price * quantity * 1.0;', '#2ea04333', '#d4d4d4'],
        ['const discount = user.isVip ? 0.2 : 0;', '#2ea04333', '#d4d4d4'],
        ['=======', null, '#c586c0'],
        ['const total = (price - coupon) * qty;', '#1f6feb33', '#d4d4d4'],
        ['const discount = 0; // TODO ask product', '#1f6feb33', '#d4d4d4'],
        ['>>>>>>> feature/new-checkout (Incoming)', '#1f6feb66', '#79c0ff']
      ];
      lines.forEach(([value, bg, color], i) => {
        const y = 100 + i * 52;
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(60, y, w - 60, 52); }
        text(ctx, String(41 + i), 40, y + 36, `20px ${MONO}`, '#858585', 'right');
        text(ctx, value, 76, y + 36, `28px ${MONO}`, color);
      });
      caption(ctx, w, h, 'Merge Conflict');
    },
    friday(ctx, w, h) {
      ctx.fillStyle = '#2b1d0e';
      ctx.fillRect(0, 0, w, h);
      // Calendar page
      fillRR(ctx, 40, 60, 260, 300, 12, '#ffffff');
      fillRR(ctx, 40, 60, 260, 80, 12, '#e03131');
      ctx.fillStyle = '#e03131'; ctx.fillRect(40, 120, 260, 20);
      text(ctx, 'FRIDAY', 170, 120, `bold 44px ${SANS}`, '#fff', 'center');
      text(ctx, '13', 170, 270, `bold 130px ${SANS}`, '#212529', 'center');
      text(ctx, '16:59', 170, 340, `bold 40px ${MONO}`, '#e03131', 'center');
      terminal(ctx, 340, 40, 650, 420, [
        ['$ git push --force origin main', '#ffd43b'],
        ['Enumerating objects: 3, done.', '#adb5bd'],
        ['Writing objects: 100% (3/3), done.', '#adb5bd'],
        [' + 3f2a9c1...e81b77d main -> main', '#ff6b6b'],
        ['   (forced update)', '#ff6b6b'],
        ['$ shutdown -h now   # see you Monday', '#69db7c'],
        ['', null],
        ['3 teammates lost their commits.', '#ffa8a8'],
        ['Weekend status: cancelled', '#ffa8a8']
      ], { title: 'release-day' });
      caption(ctx, w, h, 'git push --force on Friday');
    },
    bugs(ctx, w, h) {
      ctx.fillStyle = '#0f1a12';
      ctx.fillRect(0, 0, w, h);
      const verses = ['99 little bugs in the code,', '99 little bugs.', 'Take one down, patch it around,', '127 little bugs in the code.'];
      verses.forEach((line, i) => text(ctx, line, 60, 110 + i * 70, `${i === 3 ? 'bold ' : ''}46px Georgia, serif`, i === 3 ? '#ff6b6b' : '#e9fbe9'));
      const random = seeded(99);
      for (let i = 0; i < 46; i++) {
        const x = 60 + (i % 23) * 40;
        const y = 420 + Math.floor(i / 23) * 50;
        ctx.save(); ctx.translate(x + 14, y + 14); ctx.rotate(random() * 6);
        ctx.fillStyle = i > 40 ? '#ff6b6b' : '#69db7c';
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-8, k * 6); ctx.lineTo(-15, k * 8); ctx.moveTo(8, k * 6); ctx.lineTo(15, k * 8); ctx.stroke(); }
        ctx.restore();
      }
      caption(ctx, w, h, '99 Little Bugs in the Code');
    },
    darkmode(ctx, w, h) {
      ctx.fillStyle = '#16181d'; ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2, 0, w / 2, h);
      const code = ['function sleep() {', '  return coffee', '    .map(brew)', '    .filter(hot);', '}'];
      code.forEach((line, i) => {
        text(ctx, line, 40, 140 + i * 44, `28px ${MONO}`, ['#c678dd', '#e5c07b', '#61afef', '#98c379', '#abb2bf'][i]);
        text(ctx, line, w / 2 + 40, 140 + i * 44, `28px ${MONO}`, ['#a626a4', '#986801', '#4078f2', '#50a14f', '#383a42'][i]);
      });
      // The sun of light mode
      ctx.fillStyle = 'rgba(255, 212, 59, 0.35)';
      for (let i = 0; i < 12; i++) { ctx.save(); ctx.translate(900, 470); ctx.rotate((i * Math.PI) / 6); ctx.fillRect(-6, -110, 12, 50); ctx.restore(); }
      ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(900, 470, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9ecef'; ctx.beginPath(); ctx.arc(110, 470, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16181d'; ctx.beginPath(); ctx.arc(132, 455, 42, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'DARK', w / 4, 70, `bold 44px ${SANS}`, '#e9ecef', 'center');
      text(ctx, 'LIGHT', (w * 3) / 4, 70, `bold 44px ${SANS}`, '#212529', 'center');
      fillRR(ctx, w / 2 - 50, 300, 100, 70, 35, '#e03131');
      text(ctx, 'VS', w / 2, 349, `bold 38px ${SANS}`, '#fff', 'center');
      caption(ctx, w, h, 'Dark Mode vs Light Mode');
    },
    duck(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#3a8fd6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(160 + i * 140, 520, 80, 10, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath(); ctx.ellipse(300, 420, 190, 110, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(380, 250, 100, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff922b'; ctx.beginPath(); ctx.ellipse(490, 270, 60, 26, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(410, 220, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(415, 215, 5, 0, Math.PI * 2); ctx.fill();
      fillRR(ctx, 560, 80, 420, 200, 30, '#ffffff');
      ctx.beginPath(); ctx.moveTo(600, 270); ctx.lineTo(540, 320); ctx.lineTo(650, 275); ctx.fill();
      ctx.font = `30px ${SANS}`;
      ctx.fillStyle = '#212529';
      wrap(ctx, '"...and then this line calls itself, which... oh. OH. Never mind, thanks duck."', 360).forEach((line, i) => ctx.fillText(line, 590, 135 + i * 40));
      text(ctx, 'Bugs solved: 1,024 · Lines written: 0', 600, 360, `bold 26px ${SANS}`, '#0b3a66');
      caption(ctx, w, h, 'The Rubber Duck');
    },
    coffee(ctx, w, h) {
      ctx.fillStyle = '#f4ead8';
      ctx.fillRect(0, 0, w, h);
      // A printout with mug rings
      ctx.fillStyle = '#ffffff'; ctx.fillRect(560, 40, 400, 500);
      for (let i = 0; i < 16; i++) { ctx.fillStyle = '#ced4da'; ctx.fillRect(590, 80 + i * 26, 200 + ((i * 47) % 140), 8); }
      [[700, 200, 70], [820, 380, 64], [650, 430, 58]].forEach(([x, y, r]) => {
        ctx.strokeStyle = 'rgba(120, 72, 30, 0.55)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(x, y, r, 0.2, Math.PI * 1.9); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 3, y + 2, r - 8, 0, Math.PI * 2); ctx.stroke();
      });
      // Mug top view
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(250, 250, 150, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 8; ctx.stroke();
      ctx.fillStyle = '#5c3a1e'; ctx.beginPath(); ctx.arc(250, 250, 124, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c08a5a'; ctx.beginPath(); ctx.arc(250, 250, 50, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 26; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(410, 250, 50, -1.2, 1.2); ctx.stroke();
      text(ctx, 'COFFEE  ->  { code }', 60, 480, `bold 44px ${MONO}`, '#5c3a1e');
      text(ctx, 'Conversion rate: 1 cup = 40 lines', 60, 530, `26px ${SANS}`, '#7a5b3a');
      caption(ctx, w, h, 'Coffee to Code');
    },
    vim(ctx, w, h) {
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(0, 0, w, h);
      text(ctx, '  1 hello world', 20, 50, `26px ${MONO}`, '#d0d0d0');
      for (let i = 0; i < 9; i++) text(ctx, '~', 20, 90 + i * 34, `26px ${MONO}`, '#5f87ff');
      text(ctx, 'HOW TO EXIT', 620, 140, `bold 46px ${SANS}`, '#ffffff', 'center');
      fillRR(ctx, 470, 170, 300, 150, 16, '#1c7c3a');
      text(ctx, ':q!', 620, 280, `bold 110px ${MONO}`, '#ffffff', 'center');
      text(ctx, 'Esc, colon, q, !, Enter', 620, 360, `26px ${SANS}`, '#b2f2bb', 'center');
      ctx.fillStyle = '#d70000'; ctx.fillRect(0, 470, w, 40);
      text(ctx, 'E37: No write since last change (add ! to override)', 16, 499, `24px ${MONO}`, '#ffffff');
      text(ctx, ':wq  :x  ZZ  :help  ^C  ^C  ^C  restart laptop', 16, 545, `22px ${MONO}`, '#aaaaaa');
      caption(ctx, w, h, 'How to Exit Vim');
    },
    regex(ctx, w, h) {
      ctx.fillStyle = '#1a1033';
      ctx.fillRect(0, 0, w, h);
      const pattern = ['/^(?=.*[A-Z])(?=.*\\d)(?!.*(.)\\1{2})', '[\\w.+-]+@[a-z\\d-]+(\\.[a-z\\d-]+)*', '\\.(?:[a-z]{2,}|xn--[a-z\\d]+)', '(?<!\\.)(?:\\?[^\\s#]*)?$/gimu'];
      pattern.forEach((line, i) => text(ctx, line, 50, 110 + i * 64, `bold 40px ${MONO}`, ['#ff79c6', '#8be9fd', '#f1fa8c', '#50fa7b'][i]));
      [['???', 120, 400], ['why is there a lookbehind', 330, 430], ['do not touch', 760, 400]].forEach(([value, x, y]) => {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y - 30); ctx.lineTo(x + 40, y - 110); ctx.stroke();
        text(ctx, value, x, y, `italic 28px ${SANS}`, '#ffffff');
      });
      text(ctx, 'Matches: email? phone? the void?', 50, 520, `bold 30px ${SANS}`, '#bd93f9');
      caption(ctx, w, h, 'The Regex Nobody Understands');
    },
    localhost(ctx, w, h) {
      ctx.fillStyle = '#e8eaed'; ctx.fillRect(0, 0, w, h);
      browserWindow(ctx, 30, 24, 964, 520, { url: 'localhost:3000', title: 'localhost' });
      ctx.fillStyle = '#5f6368';
      ctx.fillRect(140, 150, 60, 50); ctx.fillStyle = '#fff'; ctx.fillRect(148, 158, 44, 30);
      text(ctx, 'This site can\'t be reached', 140, 260, `bold 38px ${SANS}`, '#202124');
      text(ctx, 'localhost refused to connect.', 140, 310, `26px ${SANS}`, '#5f6368');
      text(ctx, 'ERR_CONNECTION_REFUSED', 140, 360, `22px ${MONO}`, '#5f6368');
      terminal(ctx, 560, 330, 410, 190, [['Error: Port 3000 is', '#ff6b6b'], ['already in use.', '#ff6b6b'], ['Try 3001? (Y/n)', '#ffd43b']], { title: 'npm run dev', size: 22 });
      caption(ctx, w, h, 'localhost:3000');
    },
    slack(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3f0e40'; ctx.fillRect(0, 0, 320, h);
      text(ctx, 'Acme Engineering', 24, 50, `bold 24px ${SANS}`, '#ffffff');
      const channels = [['# general', 12], ['# random', 9], ['# incidents', 7], ['# deploys', 5], ['# standup', 4], ['# parking-lot', 6], ['Huddle: quick sync', 1], ['DM: manager', 3]];
      channels.forEach(([name, count], i) => {
        const y = 110 + i * 54;
        text(ctx, name, 30, y, `bold 22px ${SANS}`, '#ffffff');
        fillRR(ctx, 250, y - 22, 46, 28, 14, '#e01e5a');
        text(ctx, String(count), 273, y - 1, `bold 18px ${SANS}`, '#ffffff', 'center');
      });
      ctx.fillStyle = '#e01e5a'; ctx.beginPath(); ctx.arc(680, 220, 120, 0, Math.PI * 2); ctx.fill();
      text(ctx, '47', 680, 262, `bold 120px ${SANS}`, '#ffffff', 'center');
      text(ctx, '@channel: who parked in my spot?', 360, 420, `24px ${SANS}`, '#1d1c1d');
      text(ctx, 'hey, got a sec? quick question', 360, 460, `24px ${SANS}`, '#1d1c1d');
      text(ctx, 'hi', 360, 500, `24px ${SANS}`, '#1d1c1d');
      caption(ctx, w, h, '47 Unread Notifications');
    },
    meeting(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
      days.forEach((day, i) => text(ctx, day, 140 + i * 175, 44, `bold 22px ${SANS}`, '#495057', 'center'));
      for (let i = 0; i < 9; i++) { ctx.fillStyle = '#e9ecef'; ctx.fillRect(50, 60 + i * 56, 950, 1); text(ctx, `${9 + i}:00`, 10, 80 + i * 56, `14px ${SANS}`, '#868e96'); }
      const names = ['Sync about the sync', 'Quick catch-up', 'Planning the planning', 'Standup (long)', 'Alignment', 'Retro of the retro', 'All hands', '1:1:1', 'Kickoff', 'Pre-meeting'];
      const colors = ['#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d'];
      const random = seeded(11);
      for (let d = 0; d < 5; d++) {
        let y = 62;
        while (y < 540) {
          const hgt = 40 + Math.floor(random() * 3) * 28;
          fillRR(ctx, 62 + d * 175, y, 160, hgt - 4, 6, colors[Math.floor(random() * colors.length)]);
          text(ctx, names[Math.floor(random() * names.length)], 70 + d * 175, y + 22, `bold 14px ${SANS}`, '#1b1e23');
          y += hgt;
        }
      }
      fillRR(ctx, 640, 380, 330, 150, 10, '#fff9db');
      ctx.strokeStyle = '#495057'; ctx.lineWidth = 3; rr(ctx, 640, 380, 330, 150, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(640, 380); ctx.lineTo(805, 470); ctx.lineTo(970, 380); ctx.stroke();
      text(ctx, 'Could have been', 805, 500, `bold 24px ${SANS}`, '#212529', 'center');
      text(ctx, 'an email.', 805, 525, `bold 24px ${SANS}`, '#212529', 'center');
      caption(ctx, w, h, 'The Meeting That Could Have Been an Email');
    },
    center(ctx, w, h) {
      ctx.fillStyle = '#f1f3f5'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#adb5bd'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeRect(560, 60, 420, 440); ctx.setLineDash([]);
      fillRR(ctx, 735, 245, 90, 90, 8, '#e64980');
      text(ctx, 'div', 780, 300, `bold 28px ${MONO}`, '#fff', 'center');
      const attempts = [['margin: 0 auto;', true], ['text-align: center;', true], ['position: absolute; top: 50%;', true], ['transform: translate(-50%, -50%);', true], ['display: table-cell;', true], ['vertical-align: middle;', true], ['display: flex;', false], ['justify-content: center;', false], ['align-items: center;', false]];
      attempts.forEach(([value, crossed], i) => {
        const y = 80 + i * 50;
        text(ctx, value, 40, y, `24px ${MONO}`, crossed ? '#868e96' : '#2b8a3e');
        if (crossed) { ctx.strokeStyle = '#e03131'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(36, y - 8); ctx.lineTo(40 + value.length * 13.5, y - 8); ctx.stroke(); }
      });
      text(ctx, 'Searched 2,381 times', 40, 545, `bold 26px ${SANS}`, '#495057');
      caption(ctx, w, h, 'Centering a Div');
    },
    prod3am(ctx, w, h) {
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, w, h);
      fillRR(ctx, 80, 30, 300, 520, 40, '#1c1f26');
      fillRR(ctx, 94, 44, 272, 492, 30, '#0d1b2a');
      text(ctx, '03:07', 230, 150, `200 84px ${SANS}`, '#ffffff', 'center');
      text(ctx, 'Tuesday', 230, 190, `22px ${SANS}`, '#adb5bd', 'center');
      ['CRITICAL: checkout 500s', 'CRITICAL: p99 latency 41s', 'You are on call. Ack?'].forEach((value, i) => {
        fillRR(ctx, 110, 230 + i * 86, 240, 72, 14, 'rgba(255,255,255,0.14)');
        text(ctx, 'ON-CALL', 124, 256 + i * 86, `bold 14px ${SANS}`, '#ff8787');
        text(ctx, value, 124, 284 + i * 86, `15px ${SANS}`, '#ffffff');
      });
      // Error graph
      ctx.strokeStyle = '#343a40'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(440, 120 + i * 70); ctx.lineTo(980, 120 + i * 70); ctx.stroke(); }
      ctx.strokeStyle = '#fa5252'; ctx.lineWidth = 5; ctx.beginPath();
      for (let x = 0; x <= 540; x += 10) { const y = x < 360 ? 450 - Math.sin(x * 0.08) * 8 : 450 - (x - 360) * 1.8; ctx.lineTo(440 + x, Math.max(110, y)); }
      ctx.stroke();
      text(ctx, 'errors / min', 440, 100, `bold 24px ${SANS}`, '#ffa8a8');
      text(ctx, 'PRODUCTION IS DOWN', 710, 540, `bold 40px ${SANS}`, '#ff6b6b', 'center');
      caption(ctx, w, h, 'Production Is Down, 03:07');
    },
    semicolon(ctx, w, h) {
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, w, h);
      const lines = ['const user = getUser(id)', 'const cart = loadCart(user);', 'checkout(cart);'];
      lines.forEach((value, i) => { text(ctx, String(1336 + i), 30, 90 + i * 50, `22px ${MONO}`, '#858585'); text(ctx, value, 110, 90 + i * 50, `28px ${MONO}`, '#d4d4d4'); });
      ctx.strokeStyle = '#f14c4c'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 0; x < 380; x += 12) { ctx.lineTo(110 + x, 100 + (x % 24 ? 5 : 0)); }
      ctx.stroke();
      fillRR(ctx, 30, 250, 620, 90, 8, '#5a1d1d');
      text(ctx, 'SyntaxError: Unexpected token (line 2847)', 50, 290, `22px ${MONO}`, '#ffb3b3');
      text(ctx, 'in a completely different file', 50, 322, `22px ${MONO}`, '#ffb3b3');
      text(ctx, ';', 830, 420, `bold 420px ${MONO}`, '#ffd43b', 'center');
      text(ctx, 'Time to find it: 6 hours', 30, 420, `bold 30px ${SANS}`, '#ffffff');
      caption(ctx, w, h, 'The Missing Semicolon');
    },
    safari(ctx, w, h) {
      ctx.fillStyle = '#ced4da'; ctx.fillRect(0, 0, w, h);
      const page = (x, broken) => {
        browserWindow(ctx, x, 30, 480, 480, { title: broken ? 'Other browser' : 'Chrome-ish', url: 'shop.example.com' });
        if (!broken) {
          fillRR(ctx, x + 30, 110, 420, 50, 6, '#4c6ef5');
          for (let i = 0; i < 3; i++) fillRR(ctx, x + 30 + i * 145, 180, 130, 160, 8, '#e7f5ff');
          fillRR(ctx, x + 150, 380, 180, 54, 27, '#2f9e44');
          text(ctx, 'Buy now', x + 240, 415, `bold 22px ${SANS}`, '#fff', 'center');
        } else {
          ctx.save(); ctx.translate(x + 60, 120); ctx.rotate(-0.08); fillRR(ctx, 0, 0, 420, 50, 6, '#4c6ef5'); ctx.restore();
          fillRR(ctx, x + 20, 200, 130, 160, 8, '#e7f5ff');
          fillRR(ctx, x + 90, 240, 130, 160, 8, '#d0ebff');
          fillRR(ctx, x + 330, 160, 130, 260, 8, '#e7f5ff');
          fillRR(ctx, x + 300, 440, 180, 54, 27, '#2f9e44');
          text(ctx, 'Invalid Date', x + 40, 450, `bold 22px ${SANS}`, '#e03131');
        }
        ctx.lineWidth = 12;
        ctx.strokeStyle = broken ? '#e03131' : '#2f9e44';
        ctx.beginPath();
        if (broken) { ctx.moveTo(x + 400, 60); ctx.lineTo(x + 460, 120); ctx.moveTo(x + 460, 60); ctx.lineTo(x + 400, 120); } else { ctx.moveTo(x + 400, 90); ctx.lineTo(x + 420, 115); ctx.lineTo(x + 465, 60); }
        ctx.stroke();
      };
      page(20, false);
      page(524, true);
      caption(ctx, w, h, 'Works in Chrome, Broken in Safari');
    },
    docker(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#d0ebff'); g.addColorStop(1, '#1c7ed6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // A generic whale carrying containers (drawn recreation)
      ctx.fillStyle = '#1864ab';
      ctx.beginPath(); ctx.moveTo(140, 330); ctx.quadraticCurveTo(200, 500, 520, 480); ctx.quadraticCurveTo(760, 470, 820, 330); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(820, 330); ctx.quadraticCurveTo(880, 300, 900, 250); ctx.quadraticCurveTo(870, 320, 940, 320); ctx.quadraticCurveTo(880, 350, 820, 360); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(250, 380, 9, 0, Math.PI * 2); ctx.fill();
      const colors = ['#f76707', '#2f9e44', '#e03131', '#f59f00', '#7048e8', '#0c8599'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6 - r; c++) {
        const x = 240 + c * 86 + r * 43;
        const y = 270 - r * 62;
        ctx.fillStyle = colors[(r * 3 + c) % colors.length]; ctx.fillRect(x, y, 80, 56);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 1; k < 6; k++) ctx.fillRect(x + k * 13, y + 4, 3, 48);
      }
      text(ctx, '"It works in the container."', 40, 70, `bold 38px ${SANS}`, '#0b3a66');
      text(ctx, 'Image size: 4.2 GB · Layers: 73 · Important: 2', 40, 560, `24px ${SANS}`, '#ffffff');
      caption(ctx, w, h, 'It Works in the Container');
    },
    todo(ctx, w, h) {
      ctx.fillStyle = '#272822'; ctx.fillRect(0, 0, w, h);
      text(ctx, 'billing/legacy/core_v2_final.js', 30, 40, `18px ${SANS}`, '#a6a6a6');
      const lines = [['function computeEverything(x) {', '#f8f8f2'], ['  // TODO: refactor this later (2014-03-11)', '#75715e'], ['  // HACK: do not remove, breaks login', '#75715e'], ['  return x && x.y && x.y.z || 42;', '#f8f8f2'], ['}', '#f8f8f2']];
      lines.forEach(([value, color], i) => text(ctx, value, 40, 120 + i * 52, `${i === 1 ? 'bold ' : ''}30px ${MONO}`, color));
      fillRR(ctx, 40, 400, 700, 110, 8, '#3e3d32');
      text(ctx, 'git blame: a.dev (left the company in 2016)', 60, 444, `22px ${MONO}`, '#e6db74');
      text(ctx, 'Last modified: 12 years ago · Called by: everything', 60, 484, `22px ${MONO}`, '#e6db74');
      // Cobwebs in the corner
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - 200 * Math.cos(i * 0.25), 200 * Math.sin(i * 0.25)); ctx.stroke(); }
      for (let r = 40; r <= 200; r += 40) { ctx.beginPath(); ctx.arc(w, 0, r, Math.PI / 2, Math.PI); ctx.stroke(); }
      caption(ctx, w, h, 'The TODO from 2014');
    },
    jira(ctx, w, h) {
      ctx.fillStyle = '#f4f5f7'; ctx.fillRect(0, 0, w, h);
      fillRR(ctx, 40, 40, 520, 300, 8, '#ffffff');
      ctx.fillStyle = '#0052cc'; ctx.fillRect(40, 40, 8, 300);
      text(ctx, 'DEV-4521', 70, 84, `bold 20px ${SANS}`, '#5e6c84');
      text(ctx, 'Change the button color', 70, 130, `bold 32px ${SANS}`, '#172b4d');
      text(ctx, 'Estimate: 1 story point', 70, 190, `26px ${SANS}`, '#172b4d');
      text(ctx, 'Actual: 3 sprints, 1 migration,', 70, 236, `26px ${SANS}`, '#de350b');
      text(ctx, '1 meeting with legal', 70, 272, `26px ${SANS}`, '#de350b');
      fillRR(ctx, 70, 292, 120, 32, 4, '#ffab00');
      text(ctx, 'IN PROGRESS', 130, 315, `bold 16px ${SANS}`, '#172b4d', 'center');
      ['1', '2', '3', '5', '8', '13', '?', 'cup'].forEach((value, i) => {
        const x = 50 + i * 120;
        ctx.save(); ctx.translate(x + 50, 470); ctx.rotate((i - 3.5) * 0.06);
        fillRR(ctx, -50, -70, 100, 140, 10, '#ffffff');
        ctx.strokeStyle = '#0052cc'; ctx.lineWidth = 3; rr(ctx, -50, -70, 100, 140, 10); ctx.stroke();
        if (value === 'cup') {
          ctx.fillStyle = '#6f4e37'; ctx.fillRect(-22, -14, 36, 40); ctx.strokeStyle = '#6f4e37'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(18, 6, 12, -1.2, 1.2); ctx.stroke();
        } else text(ctx, value, 0, 20, `bold 56px ${SANS}`, '#0052cc', 'center');
        ctx.restore();
      });
      text(ctx, 'Planning poker', 600, 100, `bold 34px ${SANS}`, '#172b4d');
      text(ctx, 'Consensus: "it depends"', 600, 150, `26px ${SANS}`, '#5e6c84');
      caption(ctx, w, h, 'Story Points and Estimates');
    },
    ctrlcv(ctx, w, h) {
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, 0, w, h);
      const key = (x, y, kw, label, worn) => {
        fillRR(ctx, x, y + 10, kw, 150, 18, '#1a1d22');
        fillRR(ctx, x, y, kw, 150, 18, worn ? '#f1f3f5' : '#ced4da');
        if (worn) { const g = ctx.createRadialGradient(x + kw / 2, y + 70, 5, x + kw / 2, y + 70, kw / 2); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; rr(ctx, x, y, kw, 150, 18); ctx.fill(); }
        ctx.globalAlpha = worn ? 0.22 : 1;
        text(ctx, label, x + 22, y + 60, `bold 44px ${SANS}`, '#343a40');
        ctx.globalAlpha = 1;
      };
      key(60, 140, 260, 'Ctrl', true);
      text(ctx, '+', 365, 250, `bold 70px ${SANS}`, '#ffffff', 'center');
      key(410, 140, 160, 'C', true);
      key(640, 140, 160, 'V', true);
      key(840, 140, 140, 'F12', false);
      text(ctx, 'Shine level: mirror · Letters: gone since 2019', 60, 420, `bold 30px ${SANS}`, '#ffd43b');
      text(ctx, 'Runner-up: Ctrl+Z', 60, 470, `26px ${SANS}`, '#ced4da');
      caption(ctx, w, h, 'Ctrl+C / Ctrl+V');
    },
    keyboard(ctx, w, h) {
      ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, w, h);
      // Keyboard rows
      for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) fillRR(ctx, 60 + c * 46 + r * 10, 300 + r * 46, 40, 40, 6, ['#ff8787', '#f1f3f5', '#74c0fc', '#ffd43b'][(r + c) % 4]);
      // Sound waves
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6;
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(420, 300, 60 + i * 50, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      text(ctx, 'CLACK CLACK CLACK', 380, 90, `bold 54px ${SANS}`, '#ffffff', 'center');
      // Decibel meter
      fillRR(ctx, 800, 80, 180, 380, 16, '#212529');
      for (let i = 0; i < 10; i++) fillRR(ctx, 830, 420 - i * 34, 120, 26, 4, i < 6 ? '#51cf66' : i < 8 ? '#fcc419' : '#ff6b6b');
      text(ctx, '94 dB', 890, 70, `bold 34px ${SANS}`, '#ff6b6b', 'center');
      text(ctx, 'Blue switches, 9:00 sharp', 60, 560, `24px ${SANS}`, '#adb5bd');
      caption(ctx, w, h, 'Mechanical Keyboard Noise');
    },
    monitors(ctx, w, h) {
      ctx.fillStyle = '#e9ecef'; ctx.fillRect(0, 0, w, h);
      const screen = (x, y, sw, sh, color) => { fillRR(ctx, x, y, sw, sh, 6, '#212529'); ctx.fillStyle = color; ctx.fillRect(x + 6, y + 6, sw - 12, sh - 12); };
      const stages = [
        ['2008', () => { screen(80, 300, 110, 70, '#4dabf7'); ctx.fillStyle = '#adb5bd'; ctx.fillRect(66, 370, 138, 10); }],
        ['2012', () => { screen(270, 270, 100, 70, '#4dabf7'); screen(375, 270, 100, 70, '#69db7c'); }],
        ['2018', () => { screen(520, 230, 80, 120, '#ffd43b'); screen(605, 260, 110, 80, '#4dabf7'); screen(720, 260, 110, 80, '#69db7c'); }],
        ['2026', () => { for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) screen(860 + c * 52 - 30, 200 + r * 64, 50, 60, ['#ff6b6b', '#4dabf7', '#69db7c'][c]); }]
      ];
      stages.forEach(([year, draw], i) => { draw(); text(ctx, year, [135, 372, 675, 905][i], 440, `bold 34px ${SANS}`, '#343a40', 'center'); });
      ctx.strokeStyle = '#868e96'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(60, 470); ctx.lineTo(980, 470); ctx.stroke();
      text(ctx, 'Pixels: x24 · Productivity: unchanged', w / 2, 120, `bold 40px ${SANS}`, '#212529', 'center');
      caption(ctx, w, h, 'The Evolution of Monitor Setups');
    },
    naming(ctx, w, h) {
      ctx.fillStyle = '#fff4e6'; ctx.fillRect(0, 0, w, h);
      text(ctx, 'There are 2 hard problems', 50, 90, `bold 46px Georgia, serif`, '#5f3dc4');
      text(ctx, 'in computer science:', 50, 150, `bold 46px Georgia, serif`, '#5f3dc4');
      ['1. Cache invalidation', '2. Naming things', '3. Off-by-one errors'].forEach((value, i) => text(ctx, value, 80, 240 + i * 60, `38px ${SANS}`, '#212529'));
      ['data', 'data2', 'newData', 'finalData', 'finalDataReal', 'thing', 'temp', 'foo'].forEach((value, i) => {
        fillRR(ctx, 620 + (i % 2) * 190, 220 + Math.floor(i / 2) * 64, 176, 50, 8, '#ffffff');
        text(ctx, value, 708 + (i % 2) * 190, 254 + Math.floor(i / 2) * 64, `22px ${MONO}`, '#c92a2a', 'center');
      });
      caption(ctx, w, h, 'The Two Hard Problems');
    },
    commits(ctx, w, h) {
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h);
      const log = [['a1b2c3d', 'feat: implement payment flow with retries', 'Mon'], ['b7e9f01', 'refactor checkout state machine', 'Tue'], ['c3d4e5f', 'fix', 'Wed'], ['d9a8b7c', 'fix again', 'Thu'], ['e1f2a3b', 'final fix', 'Thu'], ['f4c5d6e', 'final final fix', 'Thu'], ['0a1b2c3', 'please work', 'Fri'], ['1d2e3f4', 'asdf', 'Fri'], ['2f3a4b5', 'revert everything', 'Fri']];
      log.forEach(([hash, message, day], i) => {
        const y = 60 + i * 54;
        ctx.fillStyle = '#30363d'; ctx.fillRect(48, y - 30, 4, 54);
        ctx.fillStyle = i > 5 ? '#f85149' : '#3fb950'; ctx.beginPath(); ctx.arc(50, y - 8, 9, 0, Math.PI * 2); ctx.fill();
        text(ctx, hash, 80, y, `24px ${MONO}`, '#d29922');
        text(ctx, message, 220, y, `${i > 5 ? 'bold ' : ''}26px ${MONO}`, '#e6edf3');
        text(ctx, day, 960, y, `20px ${SANS}`, '#7d8590', 'right');
      });
      caption(ctx, w, h, 'Commit Messages');
    },
    consolelog(ctx, w, h) {
      ctx.fillStyle = '#242424'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#333'; ctx.fillRect(0, 0, w, 44);
      ['Elements', 'Console', 'Sources', 'Network'].forEach((tab, i) => text(ctx, tab, 30 + i * 130, 30, `${i === 1 ? 'bold ' : ''}18px ${SANS}`, i === 1 ? '#8ab4f8' : '#bdc1c6'));
      const logs = ['here', 'here2', 'here 3', 'HERE???', 'user undefined', 'WHY', 'it should not be possible to reach this line', 'asdfgh', 'it works?!'];
      logs.forEach((value, i) => {
        const y = 80 + i * 50;
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, y + 14, w, 1);
        text(ctx, value, 30, y + 2, `26px ${MONO}`, value === 'WHY' ? '#ff8080' : '#e8eaed');
        text(ctx, `app.js:${120 + i * 37}`, 990, y, `18px ${MONO}`, '#9aa0a6', 'right');
      });
      caption(ctx, w, h, 'console.log Debugging');
    },
    tabsspaces(ctx, w, h) {
      ctx.fillStyle = '#212529'; ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = '#343a40'; ctx.fillRect(w / 2, 0, w / 2, h);
      text(ctx, 'TABS', w / 4, 90, `bold 64px ${SANS}`, '#74c0fc', 'center');
      text(ctx, 'SPACES', (w * 3) / 4, 90, `bold 64px ${SANS}`, '#ffa94d', 'center');
      for (let i = 0; i < 6; i++) {
        const y = 160 + i * 56;
        for (let k = 0; k < (i % 3) + 1; k++) { ctx.fillStyle = '#4dabf7'; ctx.fillRect(40 + k * 70, y, 60, 6); ctx.beginPath(); ctx.moveTo(100 + k * 70, y - 6); ctx.lineTo(110 + k * 70, y + 3); ctx.lineTo(100 + k * 70, y + 12); ctx.fill(); }
        for (let k = 0; k < ((i % 3) + 1) * 4; k++) { ctx.fillStyle = '#ffa94d'; ctx.beginPath(); ctx.arc(w / 2 + 50 + k * 26, y + 3, 5, 0, Math.PI * 2); ctx.fill(); }
      }
      text(ctx, 'Lines changed by the formatter: 48,000', w / 2, 540, `bold 30px ${SANS}`, '#ffffff', 'center');
      caption(ctx, w, h, 'Tabs vs Spaces');
    },
    // The toolbelt: generic recreations of ten everyday tools (1024 x 640, wide panel)
    tools(ctx, w, h) {
      ctx.fillStyle = '#11151c'; ctx.fillRect(0, 0, w, h);
      text(ctx, 'OPEN ALL DAY, EVERY DAY', w / 2, 60, `bold 36px ${SANS}`, '#ffffff', 'center');
      const tools = ['VS Code', 'Terminal', 'Git', 'Docker', 'Postman', 'DevTools', 'Slack', 'Jira', 'Figma', 'npm'];
      tools.forEach((name, i) => {
        const x = 40 + (i % 5) * 192;
        const y = 100 + Math.floor(i / 5) * 230;
        fillRR(ctx, x, y, 170, 200, 18, '#1d2430');
        const cx = x + 85;
        const cy = y + 80;
        switch (name) {
          case 'VS Code': ctx.fillStyle = '#2489ca'; ctx.beginPath(); ctx.moveTo(cx + 34, cy - 50); ctx.lineTo(cx + 46, cy - 42); ctx.lineTo(cx + 46, cy + 42); ctx.lineTo(cx + 34, cy + 50); ctx.lineTo(cx - 20, cy + 6); ctx.lineTo(cx - 38, cy + 22); ctx.lineTo(cx - 48, cy + 16); ctx.lineTo(cx - 48, cy - 16); ctx.lineTo(cx - 38, cy - 22); ctx.lineTo(cx - 20, cy - 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1d2430'; ctx.beginPath(); ctx.moveTo(cx + 22, cy - 22); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx + 22, cy + 22); ctx.fill(); break;
          case 'Terminal': fillRR(ctx, cx - 50, cy - 40, 100, 80, 10, '#000'); text(ctx, '>_', cx - 34, cy + 14, `bold 40px ${MONO}`, '#e9ecef'); break;
          case 'Git': ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); fillRR(ctx, -38, -38, 76, 76, 10, '#f05133'); ctx.restore(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 24); ctx.lineTo(cx - 10, cy + 24); ctx.moveTo(cx - 10, cy - 10); ctx.lineTo(cx + 16, cy + 8); ctx.stroke(); [[cx - 10, cy - 24], [cx - 10, cy + 24], [cx + 16, cy + 8]].forEach(([px, py]) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); }); break;
          case 'Docker': ctx.fillStyle = '#2496ed'; ctx.beginPath(); ctx.moveTo(cx - 54, cy + 4); ctx.quadraticCurveTo(cx - 40, cy + 46, cx + 10, cy + 42); ctx.quadraticCurveTo(cx + 46, cy + 36, cx + 54, cy + 4); ctx.closePath(); ctx.fill(); for (let r = 0; r < 2; r++) for (let c = 0; c < 4 - r; c++) { ctx.fillRect(cx - 44 + c * 22 + r * 11, cy - 16 - r * 20, 18, 16); } break;
          case 'Postman': ctx.fillStyle = '#ff6c37'; ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 20, cy + 20); ctx.lineTo(cx + 24, cy - 24); ctx.lineTo(cx + 6, cy + 24); ctx.closePath(); ctx.fill(); break;
          case 'DevTools': ctx.strokeStyle = '#8ab4f8'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke(); for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((k * Math.PI) / 4); ctx.fillStyle = '#8ab4f8'; ctx.fillRect(-7, -50, 14, 16); ctx.restore(); } break;
          case 'Slack': favicon(ctx, 3, cx - 45, cy - 45, 90); break;
          case 'Jira': ctx.fillStyle = '#2684ff'; [0, 1, 2].forEach((k) => { ctx.save(); ctx.translate(cx - 20 + k * 20, cy - 20 + k * 20); ctx.rotate(Math.PI / 4); ctx.globalAlpha = 1 - k * 0.25; fillRR(ctx, -22, -22, 44, 44, 6, '#2684ff'); ctx.restore(); }); ctx.globalAlpha = 1; break;
          case 'Figma': [['#f24e1e', -14, -34], ['#ff7262', 14, -34], ['#a259ff', -14, -6], ['#1abcfe', 14, -6], ['#0acf83', -14, 22]].forEach(([color, dx, dy]) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 14, 0, Math.PI * 2); ctx.fill(); }); break;
          default: ctx.fillStyle = '#cb3837'; ctx.fillRect(cx - 60, cy - 24, 120, 48); text(ctx, 'npm', cx, cy + 14, `bold 40px ${SANS}`, '#ffffff', 'center');
        }
        text(ctx, name, cx, y + 180, `bold 24px ${SANS}`, '#e9ecef', 'center');
      });
      caption(ctx, w, h, 'The Developer Toolbelt');
    }
  };

  // --------------------------------------------------------------------------
  // Lazy canvas jobs: materials start dark; their canvases are drawn one per
  // frame once the camera comes near the museum
  // --------------------------------------------------------------------------
  const jobs = [];
  function lazyMaterial(key, width, height, draw, options = {}) {
    const result = options.standard
      ? new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: options.roughness || 0.6 })
      : new THREE.MeshBasicMaterial({ color: '#0d1118', toneMapped: false });
    jobs.push({ result, key, width, height, draw, repeat: options.repeat });
    return result;
  }
  function paintNext() {
    const job = jobs.find((candidate) => !candidate.done);
    if (!job) return false;
    job.done = true;
    const texture = canvasTexture(`devlife-${job.key}`, job.width, job.height, job.draw);
    if (job.repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(job.repeat[0], job.repeat[1]); }
    job.result.map = texture;
    job.result.color.set('#ffffff');
    job.result.needsUpdate = true;
    return true;
  }

  // Wall labels: four 512 x 512 labels per 1024 x 1024 atlas
  function drawLabel(ctx, x, y, number, [title, blurb, info]) {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(x, y, 512, 512);
    ctx.fillStyle = '#1b1f27';
    ctx.fillRect(x, y, 512, 8);
    text(ctx, `EXHIBIT ${String(number).padStart(2, '0')}`, x + 30, y + 52, `bold 22px ${SANS}`, '#0b7285');
    ctx.font = `bold 34px ${SANS}`;
    ctx.fillStyle = '#14171c';
    const titleLines = wrap(ctx, title, 452);
    titleLines.forEach((line, i) => ctx.fillText(line, x + 30, y + 98 + i * 40));
    let cursor = y + 98 + titleLines.length * 40;
    ctx.font = `italic 22px ${SANS}`;
    ctx.fillStyle = '#495057';
    wrap(ctx, blurb, 452).forEach((line) => { ctx.fillText(line, x + 30, cursor); cursor += 28; });
    ctx.fillStyle = '#ced4da';
    ctx.fillRect(x + 30, cursor - 6, 452, 2);
    cursor += 24;
    ctx.font = `19px ${SANS}`;
    ctx.fillStyle = '#212529';
    const lines = wrap(ctx, info, 452);
    const room = Math.floor((y + 470 - cursor) / 24);
    lines.slice(0, room).forEach((line, i) => ctx.fillText(i === room - 1 && lines.length > room ? `${line} ...` : line, x + 30, cursor + i * 24));
    text(ctx, 'Press E to read more', x + 482, y + 494, `bold 18px ${SANS}`, '#0b7285', 'right');
  }

  // --------------------------------------------------------------------------
  // Shared materials and textures
  // --------------------------------------------------------------------------
  // Light grey polished concrete in 2 m tiles with subtle seams
  function floorMaterial() {
    const texture = canvasTexture('devlife-floor', 512, 512, (ctx, w) => {
      ctx.fillStyle = '#d3d5d8';
      ctx.fillRect(0, 0, w, w);
      const random = seeded(1234);
      for (let i = 0; i < 26; i++) {
        const x = random() * w; const y = random() * w; const r = 40 + random() * 120;
        const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
        patch.addColorStop(0, random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,124,130,0.12)');
        patch.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = patch;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(random() * w, random() * w, 1 + random() * 2, 1 + random() * 2);
      }
      ctx.strokeStyle = 'rgba(70, 74, 80, 0.28)';
      ctx.lineWidth = 2;
      for (let k = 0; k <= w; k += 256) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, w); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(w, k); ctx.stroke();
      }
    });
    // 512 px = 2 tiles of 2 m
    return new THREE.MeshStandardMaterial({ map: repeated(texture, (W + 4) / 4, (D + 4) / 4), roughness: 0.22, metalness: 0.05 });
  }

  // --------------------------------------------------------------------------
  // Layout (local to the gallery; the open entrance side faces +z)
  // --------------------------------------------------------------------------
  const PERGOLA_H = 10; // underside of the beam grid
  const BIG = { w: 5.6, h: 3.5 }; // framed pieces on the white walls
  const FREE = { w: 4.8, h: 3.0, base: 1.6 }; // freestanding panels on black bases

  function exhibitSlots() {
    const slots = [];
    // Back white wall: eight framed pieces
    for (let i = 0; i < 8; i++) slots.push({ kind: 'wall', x: -27.3 + i * 7.8, z: -D / 2 + 0.5, ry: 0 });
    // Short white walls at the back of both sides: two pieces each
    [-19.5, -11.5].forEach((z) => slots.push({ kind: 'wall', x: -W / 2 + 0.5, z, ry: Math.PI / 2 }));
    [-11.5, -19.5].forEach((z) => slots.push({ kind: 'wall', x: W / 2 - 0.5, z, ry: -Math.PI / 2 }));
    // Freestanding black-framed panels scattered at angles across the floor
    const rows = [-12, -3, 6, 15];
    rows.forEach((z, r) => [-28, -20, -12, 12, 20, 28].forEach((x, c) => {
      if (r === 0 && Math.abs(x) === 28) return; // keeps the side walls in view
      const turn = (x < 0 ? 1 : -1) * (0.18 + ((r + c) % 3) * 0.16);
      slots.push({ kind: 'free', x, z, ry: turn });
    }));
    return slots;
  }

  // The order exhibits take (back wall first, then the side walls and the floor)
  const WALL_ORDER = [
    'tabs', 'mission', 'bsod', 'machine', 'nodemodules', 'stackoverflow', 'merge', 'tools',
    'friday', 'bugs', 'darkmode', 'duck',
    'coffee', 'vim', 'regex', 'localhost', 'slack', 'meeting',
    'center', 'prod3am', 'semicolon', 'safari', 'docker', 'todo',
    'jira', 'ctrlcv', 'keyboard', 'monitors', 'naming', 'commits',
    'consolelog', 'tabsspaces'
  ];
  // --------------------------------------------------------------------------
  // Physical props
  // --------------------------------------------------------------------------
  function rubberDuck(x, z, scale) {
    const duck = new THREE.Group();
    const yellow = material('#ffd43b', { roughness: 0.35 });
    duck.add(cylinder(2.6, 2.8, 0.6, material('#495057', { roughness: 0.5 }), 0, 0.3, 0, 32));
    const body = sphere(1.6, yellow, 0, 0.6 + 1.3, 0, 24);
    body.scale.set(1.35, 0.85, 1);
    duck.add(body);
    const tail = sphere(0.6, yellow, -1.9, 2.4, 0, 12);
    tail.scale.set(1, 0.7, 0.8);
    duck.add(tail);
    duck.add(sphere(1.05, yellow, 1.0, 3.6, 0, 20));
    const beak = sphere(0.55, material('#ff922b', { roughness: 0.4 }), 1.95, 3.4, 0, 14);
    beak.scale.set(1.2, 0.45, 0.9);
    duck.add(beak);
    [-0.45, 0.45].forEach((side) => {
      duck.add(sphere(0.2, material('#ffffff', { roughness: 0.2 }), 1.75, 3.95, side, 10));
      duck.add(sphere(0.11, material('#111111', { roughness: 0.2 }), 1.92, 3.98, side, 8));
    });
    duck.scale.setScalar(scale);
    duck.position.set(x, 0, z);
    duck.rotation.y = Math.PI / 2;
    duck.traverse((node) => { node.castShadow = false; });
    return duck;
  }

  function coffeeDesk(x, z, mats) {
    const desk = new THREE.Group();
    const wood = mats.ringWood;
    desk.add(box(3.2, 0.08, 1.5, wood, 0, 0.76, 0));
    [[-1.5, -0.65], [1.5, -0.65], [-1.5, 0.65], [1.5, 0.65]].forEach(([lx, lz]) => desk.add(box(0.07, 0.72, 0.07, mats.steel, lx, 0.36, lz)));
    // Mountain of paper cups (instanced pyramid)
    const cupGeometry = new THREE.CylinderGeometry(0.045, 0.034, 0.12, 10).translate(0, 0.06, 0);
    const placements = [];
    for (let layer = 0; layer < 8; layer++) {
      const n = 8 - layer;
      for (let i = 0; i < n; i++) for (let k = 0; k < Math.max(1, n - 3); k++) placements.push([-0.6 + i * 0.1 + layer * 0.05, 0.8 + layer * 0.12, -0.25 + k * 0.1 + layer * 0.05]);
    }
    // Scattered cups across the desk
    const random = seeded(42);
    for (let i = 0; i < 18; i++) placements.push([-1.4 + random() * 2.8, 0.8, -0.6 + random() * 1.2]);
    // Own materials (never shared with instanced meshes that use setColorAt)
    const cups = new THREE.InstancedMesh(cupGeometry, new THREE.MeshStandardMaterial({ color: '#f8f1e5', roughness: 0.7 }), placements.length);
    const sleeves = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.047, 0.04, 0.05, 10).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.8 }), placements.length);
    const matrix = new THREE.Matrix4();
    placements.forEach(([px, py, pz], i) => {
      matrix.makeTranslation(px, py, pz);
      cups.setMatrixAt(i, matrix);
      sleeves.setMatrixAt(i, matrix);
    });
    desk.add(cups, sleeves);
    // Laptop and an office chair
    desk.add(box(0.36, 0.02, 0.25, mats.steel, 0.9, 0.81, 0.2));
    const lid = box(0.36, 0.24, 0.015, mats.steel, 0.9, 0.93, 0.08);
    lid.rotation.x = -0.25;
    desk.add(lid);
    desk.add(officeChair(0, 1.1, 0, mats));
    desk.position.set(x, 0, z);
    return desk;
  }

  function officeChair(x, z, rotation, mats) {
    const chair = new THREE.Group();
    const fabric = material('#25262b', { roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const leg = box(0.32, 0.04, 0.05, mats.steel, Math.cos((i * Math.PI * 2) / 5) * 0.16, 0.06, Math.sin((i * Math.PI * 2) / 5) * 0.16);
      leg.rotation.y = -(i * Math.PI * 2) / 5;
      chair.add(leg);
    }
    chair.add(cylinder(0.03, 0.03, 0.36, mats.steel, 0, 0.26, 0, 8));
    chair.add(box(0.5, 0.08, 0.48, fabric, 0, 0.47, 0));
    const back = box(0.46, 0.62, 0.06, fabric, 0, 0.84, 0.24);
    back.rotation.x = 0.12;
    chair.add(back);
    [-0.26, 0.26].forEach((side) => chair.add(box(0.05, 0.04, 0.32, fabric, side, 0.66, 0.02)));
    chair.position.set(x, 0, z);
    chair.rotation.y = rotation;
    return chair;
  }

  function giantKeyboard(x, z, mats) {
    const group = new THREE.Group();
    const scale = 0.42; // one key = 42 cm (about 18x real)
    group.add(box(7.2, 0.6, 2.8, mats.dark, 0, 0.7, 0));
    group.add(box(7.6, 0.4, 3.2, mats.stone, 0, 0.2, 0));
    const keys = [];
    const rows = [15, 14, 13, 12, 8];
    rows.forEach((count, r) => {
      const width = (7 - 0.1) / count;
      for (let c = 0; c < count; c++) {
        const kx = -3.45 + width / 2 + c * width;
        const kz = -1.05 + r * 0.5;
        // Ctrl (bottom-left), C and V (bottom letter row) are modeled apart, worn and shiny
        if ((r === 4 && c === 0) || (r === 3 && (c === 3 || c === 4))) { keys.push({ kx, kz, width, worn: r === 4 ? 'Ctrl' : c === 3 ? 'C' : 'V' }); continue; }
        keys.push({ kx, kz, width });
      }
    });
    const plain = keys.filter((key) => !key.worn);
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, scale * 0.6, scale), new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.6 }), plain.length);
    const matrix = new THREE.Matrix4();
    const scaleVector = new THREE.Vector3();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    plain.forEach((key, i) => {
      matrix.compose(position.set(key.kx, 1.1, key.kz), quaternion, scaleVector.set(key.width - 0.06, 1, 1));
      caps.setMatrixAt(i, matrix);
    });
    group.add(caps);
    keys.filter((key) => key.worn).forEach((key) => {
      const face = canvasTexture(`devlife-key-${key.worn}`, 256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ced4da');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 0.18;
        text(ctx, key.worn, 30, 90, `bold ${key.worn === 'Ctrl' ? 70 : 110}px ${SANS}`, '#212529');
        ctx.globalAlpha = 1;
      });
      const shiny = new THREE.MeshStandardMaterial({ color: '#ffffff', map: face, roughness: 0.08, metalness: 0.2 });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(key.width - 0.06, scale * 0.6, scale), shiny);
      cap.position.set(key.kx, 1.08, key.kz);
      group.add(cap);
    });
    group.position.set(x, 0, z);
    group.rotation.x = 0;
    return group;
  }

  function monitorWall(x, z, mats) {
    const group = new THREE.Group();
    group.add(box(3.6, 0.07, 1.2, mats.dark, 0, 0.76, 0));
    [[-1.7, -0.5], [1.7, -0.5], [-1.7, 0.5], [1.7, 0.5]].forEach(([lx, lz]) => group.add(box(0.07, 0.72, 0.07, mats.steel, lx, 0.36, lz)));
    const screens = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) screens.push([-1.1 + c * 1.1, 1.35 + r * 0.66, -0.35, 1.04, 0.62, 0]);
    screens.push([-1.95, 1.65, -0.15, 0.5, 0.9, 0.5]);
    screens.push([1.95, 1.65, -0.15, 0.5, 0.9, -0.5]);
    const bezel = material('#16181d', { roughness: 0.4 });
    const codeScreen = new THREE.MeshBasicMaterial({ map: PropKit.kit.codeScreenTexture('battle-station.js'), toneMapped: false });
    screens.forEach(([sx, sy, sz, sw, sh, ry], i) => {
      const monitor = new THREE.Group();
      monitor.add(box(sw, sh, 0.05, bezel, 0, 0, 0));
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.06, sh - 0.06), i % 3 === 1 ? mats.logScreen : codeScreen);
      panel.position.z = 0.03;
      monitor.add(panel);
      monitor.position.set(sx, sy, sz);
      monitor.rotation.y = ry;
      group.add(monitor);
    });
    group.add(box(0.08, 1.4, 0.08, mats.steel, 0, 1.4, -0.45));
    group.add(box(1.0, 0.03, 0.3, material('#212529'), 0, 0.81, 0.15));
    group.add(officeChair(0, 1.0, 0, mats));
    group.position.set(x, 0, z);
    return group;
  }

  // A plush octocat-like cat (an original take: round cat head with ears,
  // a soft body and five little curly legs; not the GitHub logo)
  function plushCat(x, z, scale) {
    const cat = new THREE.Group();
    const fur = material('#f783ac', { roughness: 0.95 });
    const face = material('#ffe3ec', { roughness: 0.9 });
    cat.add(cylinder(2.2, 2.4, 0.5, material('#495057', { roughness: 0.5 }), 0, 0.25, 0, 28));
    const body = sphere(1.2, fur, 0, 1.75, 0, 20);
    body.scale.set(1, 0.8, 0.9);
    cat.add(body);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3;
      const leg = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.17, 8, 14, Math.PI * 1.2), fur);
      leg.position.set(Math.cos(angle) * 1.1, 0.95, Math.sin(angle) * 1.1);
      leg.rotation.set(0, -angle, Math.PI * 0.9);
      cat.add(leg);
    }
    const head = sphere(1.45, fur, 0, 3.6, 0, 22);
    head.scale.set(1.15, 0.92, 1);
    cat.add(head);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 10), fur);
      ear.position.set(side * 0.95, 4.75, 0);
      ear.rotation.z = -side * 0.35;
      cat.add(ear);
    });
    const mask = sphere(1.05, face, 0, 3.45, 0.62, 18);
    mask.scale.set(1.15, 0.72, 0.6);
    cat.add(mask);
    [-0.42, 0.42].forEach((side) => {
      const eye = sphere(0.2, material('#2b2b33', { roughness: 0.3 }), side, 3.55, 1.22, 10);
      eye.scale.set(0.8, 1.1, 0.5);
      cat.add(eye);
    });
    cat.add(sphere(0.08, material('#c2255c'), 0, 3.25, 1.27, 8));
    cat.scale.setScalar(scale);
    cat.position.set(x, 0, z);
    cat.traverse((node) => { node.castShadow = false; });
    return cat;
  }

  // A dark low sofa (static parts go into the merged fixtures)
  function sofa(fixtures, x, z, ry, interior) {
    const piece = new THREE.Group();
    const leather = material('#26282e', { roughness: 0.55 });
    piece.add(box(2.6, 0.42, 0.95, leather, 0, 0.21, 0));
    piece.add(box(2.6, 0.55, 0.25, leather, 0, 0.62, -0.38));
    [-1.2, 1.2].forEach((side) => piece.add(box(0.25, 0.62, 0.95, leather, side, 0.31, 0)));
    piece.position.set(x, 0, z);
    piece.rotation.y = ry;
    fixtures.add(piece);
    [-0.6, 0.6].forEach((offset) => interior.add(seat(x + Math.cos(ry) * offset, 0.45, z - Math.sin(ry) * offset, 'Gallery sofa', ry)));
  }

  // --------------------------------------------------------------------------
  // The gallery builder
  // --------------------------------------------------------------------------
  function devlifeMuseum(group, { label }) {
    const hw = W / 2;
    const hd = D / 2;
    const white = material('#f4f4f2', { roughness: 0.6 });
    const black = material('#141519', { roughness: 0.5, metalness: 0.2 });
    const mats = {
      dark: material('#2b2f36', { roughness: 0.6 }),
      steel: material('#aeb4bb', { metalness: 0.85, roughness: 0.3 }),
      stone: material('#cfcac2', { roughness: 0.7 }),
      ringWood: lazyMaterial('ringwood', 512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#b98a5c';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) { ctx.strokeStyle = i % 2 ? 'rgba(110,70,40,0.18)' : 'rgba(255,230,200,0.15)'; ctx.beginPath(); ctx.moveTo(0, i * 6.4); ctx.bezierCurveTo(w / 3, i * 6.4 + 4, (w * 2) / 3, i * 6.4 - 4, w, i * 6.4); ctx.stroke(); }
        const random = seeded(5);
        for (let i = 0; i < 22; i++) {
          const x = random() * w; const y = random() * h; const r = 14 + random() * 6;
          ctx.strokeStyle = `rgba(80, 45, 20, ${0.25 + random() * 0.3})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, r, random() * 6, random() * 6 + 5.2); ctx.stroke();
        }
      }, { standard: true }),
      logScreen: lazyMaterial('logs', 256, 160, (ctx, w) => {
        ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, w, 160);
        for (let i = 0; i < 14; i++) text(ctx, ['INFO', 'WARN', 'ERROR'][i % 5 === 4 ? 2 : i % 3 === 2 ? 1 : 0] + ' ' + 'x'.repeat(4 + (i * 7) % 18), 6, 12 + i * 11, `10px ${MONO}`, i % 5 === 4 ? '#ff6b6b' : i % 3 === 2 ? '#ffd43b' : '#8ce99a');
      })
    };

    // --- Static structure (always visible), merged by material
    const stat = new THREE.Group();
    stat.add(box(W + 4, 0.34, D + 4, floorMaterial(), 0, -0.15, 0));
    // Open pergola: tall white pillars carrying a grid of thick white beams
    const pillars = [];
    for (let x = -hw; x <= hw + 0.01; x += 10) pillars.push([x, -hd], [x, hd]);
    [-15, -5, 5, 15].forEach((z) => pillars.push([-hw, z], [hw, z]));
    pillars.forEach(([x, z]) => stat.add(box(0.8, PERGOLA_H, 0.8, white, x, PERGOLA_H / 2, z)));
    for (let z = -hd; z <= hd + 0.01; z += 5) stat.add(box(W + 1.2, 0.9, 0.45, white, 0, PERGOLA_H + 0.45, z));
    for (let x = -hw; x <= hw + 0.01; x += 5) stat.add(box(0.45, 0.6, D + 1.2, white, x, PERGOLA_H + 0.3, 0));
    // White gallery walls at the back and the back half of both sides
    stat.add(box(W - 6, 7, 0.5, white, 0, 3.5, -hd + 0.25));
    [-1, 1].forEach((side) => stat.add(box(0.5, 7, 19, white, side * (hw - 0.25), 3.5, -hd + 9.5)));
    group.add(mergeByMaterial(stat));

    // Gallery name on a black board hanging under the front beam
    const marquee = lazyMaterial('marquee', 1024, 256, (ctx, w, h) => {
      ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, w, h);
      text(ctx, 'DEVELOPERS DAILY LIFE', w / 2, 128, `bold 92px ${SANS}`, '#ffffff', 'center');
      text(ctx, 'AN OPEN-AIR GALLERY OF EVERYDAY ENGINEERING CHAOS', w / 2, 196, `bold 30px ${SANS}`, '#7ee0ff', 'center');
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), marquee);
    sign.position.set(0, 7.6, hd + 0.3);
    sign.raycast = () => {};
    group.add(sign);
    group.add(box(16.4, 4.4, 0.25, black, 0, 7.6, hd + 0.12));

    // --- Interior (hidden when the camera is far away)
    const interior = new THREE.Group();
    group.add(interior);
    const fixtures = new THREE.Group(); // frames, bases, label posts, portals, sofas (merged below)

    // Walk-through black portal frames in a row: the gallery entrance
    [hd - 1, hd - 4.5, hd - 8].forEach((z) => {
      fixtures.add(box(0.5, 4.6, 0.5, black, -1.85, 2.3, z));
      fixtures.add(box(0.5, 4.6, 0.5, black, 1.85, 2.3, z));
      fixtures.add(box(4.2, 0.5, 0.5, black, 0, 4.35, z));
    });

    // Exhibits: framed on the walls or freestanding on black bases
    const slots = exhibitSlots();
    const atlasPlanes = [];
    const labelEntries = [];
    let number = 0;
    WALL_ORDER.forEach((key, index) => {
      const slot = slots[index];
      if (!slot) return;
      number += 1;
      const exhibit = EXHIBITS[key];
      const size = slot.kind === 'wall' ? BIG : FREE;
      const centerY = slot.kind === 'wall' ? 3.6 : FREE.base + 0.2 + FREE.h / 2;
      const holder = new THREE.Group();
      holder.position.set(slot.x, 0, slot.z);
      holder.rotation.y = slot.ry;
      const twin = new THREE.Group();
      twin.position.copy(holder.position);
      twin.rotation.y = slot.ry;
      fixtures.add(twin);
      const exhibitIndex = number;
      const art = lazyMaterial(`panel-${key}`, 1024, 640, (ctx, w, h) => { exhibitNumber = exhibitIndex; DRAW[key](ctx, w, h); });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), art);
      if (slot.kind === 'wall') {
        twin.add(box(size.w + 0.4, size.h + 0.4, 0.16, black, 0, centerY, 0.08));
        front.position.set(0, centerY, 0.17);
        holder.add(front);
      } else {
        // Thick black frame on a black base, with the art on both faces
        twin.add(box(size.w + 0.5, size.h + 0.5, 0.36, black, 0, centerY, 0));
        twin.add(box(size.w * 0.55, FREE.base + 0.2, 0.9, black, 0, (FREE.base + 0.2) / 2, 0));
        const both = new THREE.Group();
        front.position.set(0, centerY, 0.19);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), art);
        back.position.set(0, centerY, -0.19);
        back.rotation.y = Math.PI;
        both.add(front, back);
        holder.add(mergeByMaterial(both));
      }
      // Label: on the wall next to framed pieces, on a post next to freestanding ones
      const labelX = size.w / 2 + (slot.kind === 'wall' ? 0.95 : 1.4);
      if (slot.kind === 'wall') {
        twin.add(box(1.12, 1.12, 0.04, mats.dark, labelX, 1.55, 0.02));
        atlasPlanes.push({ holder, x: labelX, y: 1.55, z: 0.06, index: labelEntries.length });
      } else {
        twin.add(box(0.08, 1.2, 0.08, mats.dark, labelX, 0.6, 0.6));
        atlasPlanes.push({ holder, x: labelX, y: 1.55, z: 0.64, index: labelEntries.length, tilt: -0.2 });
      }
      labelEntries.push({ number, exhibit });
      const anchor = new THREE.Object3D();
      anchor.position.set(labelX - 0.3, 1.0, 1.4);
      anchor.userData.label = exhibit[0];
      anchor.userData.info = exhibit[2];
      holder.add(interactive(anchor, 'inspect', exhibit[0]));
      interior.add(holder);
    });

    // Physical props in the central aisle, each with a label on a post
    const props = [
      ['duckProp', rubberDuck(0, -4, 1), [3.6, -7.4, 0]],
      ['catProp', plushCat(-6.2, 6.5, 1), [-3.4, 8.6, 0]],
      ['deskProp', coffeeDesk(-6, 15, mats), [-2.9, 15.4, 0]],
      ['keyboardProp', giantKeyboard(0, -14, mats), [4.6, -11.6, 0]],
      ['monitorProp', monitorWall(6, 14.5, mats), [2.6, 15.6, 0]]
    ];
    props.forEach(([key, object, [lx, lz, ry]]) => {
      interior.add(object);
      number += 1;
      const stand = new THREE.Group();
      stand.position.set(lx, 0, lz);
      stand.rotation.y = ry;
      const post = new THREE.Group();
      post.position.copy(stand.position);
      post.rotation.y = ry;
      post.add(box(0.08, 1.2, 0.08, mats.dark, 0, 0.6, -0.04));
      fixtures.add(post);
      interior.add(stand);
      atlasPlanes.push({ holder: stand, x: 0, y: 1.55, z: 0.02, index: labelEntries.length, tilt: -0.2 });
      labelEntries.push({ number, exhibit: EXHIBITS[key] });
      const anchor = new THREE.Object3D();
      anchor.position.set(0, 1.0, 0.8);
      anchor.userData.label = EXHIBITS[key][0];
      anchor.userData.info = EXHIBITS[key][2];
      stand.add(interactive(anchor, 'inspect', EXHIBITS[key][0]));
    });
    interior.add(seat(6, 0.47, 15.5, 'The Battle Station chair', 0));
    interior.add(seat(-6, 0.47, 16.1, 'The Coffee Mountain chair', 0));

    // Dark sofas facing the duck and the back wall
    sofa(fixtures, 3.4, 0.2, -2.46, interior);
    sofa(fixtures, -3.6, 0, 2.4, interior);
    sofa(fixtures, 6, -18.6, Math.PI, interior);
    sofa(fixtures, -14, -18.6, Math.PI, interior);

    interior.add(mergeByMaterial(fixtures));

    // Long LED banner hanging from the beams at the back, scrolling a dev ticker
    const ticker = lazyMaterial('ticker', 1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, w, h);
      const items = ['git push --force detected', '47 unread Slack messages', 'build failed: works on my machine', 'node_modules: 1.2 GB', 'merge conflict in main', 'prod is down (again)', 'coffee level: critical'];
      ctx.font = `bold 30px ${MONO}`;
      let x = 10;
      items.forEach((item, i) => {
        ctx.fillStyle = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4];
        ctx.fillText(item, x, 43);
        x += ctx.measureText(item).width + 18;
        ctx.fillStyle = '#868e96';
        ctx.fillText('//', x, 43);
        x += 48;
      });
    }, { repeat: [1, 1] });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(32, 2), ticker);
    banner.position.set(0, 8.2, -16.8);
    banner.raycast = () => {};
    interior.add(banner);
    interior.add(box(32.4, 2.4, 0.2, black, 0, 8.2, -16.92));
    [-14, 14].forEach((x) => {
      const cable = box(0.04, 1.3, 0.04, mats.steel, x, 10.05, -16.9);
      cable.raycast = () => {};
      interior.add(cable);
    });

    // Label atlases: four labels per 1024 x 1024 canvas, merged into one mesh per atlas
    group.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
    for (let a = 0; a * 4 < labelEntries.length; a++) {
      const entries = labelEntries.slice(a * 4, a * 4 + 4);
      const atlas = lazyMaterial(`labels-${a}`, 1024, 1024, (ctx) => {
        entries.forEach((entry, k) => drawLabel(ctx, (k % 2) * 512, Math.floor(k / 2) * 512, entry.number, entry.exhibit));
      });
      const merged = new THREE.Group();
      atlasPlanes.filter((plane) => Math.floor(plane.index / 4) === a).forEach((plane) => {
        const k = plane.index % 4;
        const geometry = new THREE.PlaneGeometry(1.0, 1.0);
        const uv = geometry.attributes.uv;
        const u0 = (k % 2) * 0.5;
        const v0 = 0.5 - Math.floor(k / 2) * 0.5;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
        const piece = new THREE.Mesh(geometry, atlas);
        plane.holder.updateMatrixWorld(true);
        const local = new THREE.Matrix4().makeRotationX(plane.tilt || 0).setPosition(plane.x, plane.y, plane.z);
        piece.matrix.copy(inverse).multiply(plane.holder.matrixWorld).multiply(local);
        piece.matrix.decompose(piece.position, piece.quaternion, piece.scale);
        merged.add(piece);
      });
      const mesh = mergeByMaterial(merged);
      mesh.traverse((node) => { node.raycast = () => {}; });
      interior.add(mesh);
    }

    // Title sprite above the pergola
    const title = textSprite(label || 'Developers Daily Life', { width: 16, background: 'rgba(11, 18, 32, 0.88)' });
    title.position.set(0, PERGOLA_H + 5, hd - 4);
    group.add(title);

    // Interior details never cast shadows (only the pergola and walls do)
    interior.traverse((node) => { node.castShadow = false; });

    // Lazy drawing, the ticker and interior visibility by camera distance
    const center = new THREE.Vector3();
    interior.visible = false;
    let painted = false;
    animate(group, (time) => {
      if (typeof camera === 'undefined') return;
      group.getWorldPosition(center);
      const distance = center.distanceTo(camera.position);
      interior.visible = distance < 150;
      if (!interior.visible) return;
      if (!painted && distance < 160) painted = !paintNext();
      if (ticker.map) ticker.map.offset.x = (time * 0.04) % 1;
    });
  }

  PropKit.registerBuilder(/devlife_museum/, 'devlifeMuseum', devlifeMuseum);
})();
