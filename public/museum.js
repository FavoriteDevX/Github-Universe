// ============================================================================
// MUSEUM OF FORGOTTEN HARDWARE & SOFTWARE: GIANT WALKABLE RETRO TECH EXHIBITS
// ============================================================================
(() => {
  const { material, glow, shade, mesh, box, cylinder, sphere, facedBox, animate, orientation, textSprite, labelTexture, canvasTexture } = PropKit.kit;

  function retroScreenTexture(kind) {
    return canvasTexture(`retro|${kind}`, 512, 384, (ctx, w, h) => {
      ctx.font = '22px Consolas, Courier New, monospace';
      if (kind === 'dos') {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c0c0c0';
        ['Starting DOS...', '', 'HIMEM is testing extended memory...done.', '', 'C:\\>dir /w', ' Volume in drive C has no label', ' [GAMES]   [WORK]   AUTOEXEC.BAT', ' CONFIG.SYS   COMMAND.COM', '        640K ought to be enough', '', 'C:\\>_'].forEach((line, index) => ctx.fillText(line, 20, 40 + index * 30));
      } else if (kind === 'basic') {
        ctx.fillStyle = '#3e31a2'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#7c70da'; ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24);
        ctx.fillStyle = '#a5a5ff';
        ['**** RETRO BASIC V2 ****', '64K RAM SYSTEM  38911 BYTES FREE', 'READY.', '10 PRINT "HELLO WORLD"', '20 GOTO 10', 'RUN', 'HELLO WORLD', 'HELLO WORLD', 'HELLO WORLD', 'BREAK IN 10'].forEach((line, index) => ctx.fillText(line, 24, 60 + index * 30));
      } else if (kind === 'web') {
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000080'; ctx.fillRect(0, 0, w, 30);
        ctx.fillStyle = '#ffffff'; ctx.fillText('My Homepage - Web Browser 2.0', 10, 22);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 40, w - 20, h - 50);
        ctx.fillStyle = '#ff00ff'; ctx.font = 'bold 34px Times New Roman, serif'; ctx.fillText('WELCOME 2 MY PAGE!!', 40, 90);
        ctx.fillStyle = '#000000'; ctx.font = '20px Times New Roman, serif';
        ctx.fillText('You are visitor #000042', 40, 130);
        ctx.fillStyle = '#ffd700'; ctx.fillRect(40, 160, 220, 60);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Arial'; ctx.fillText('UNDER CONSTRUCTION', 48, 198);
        ctx.fillStyle = '#0000ee'; ctx.font = 'underline 20px Times New Roman, serif'; ctx.fillText('Sign my guestbook!', 40, 260);
      } else {
        ctx.fillStyle = '#008080'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, h - 34, w, 34);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 18px Arial'; ctx.fillText('Start', 14, h - 11);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(110, 70, 300, 160);
        ctx.fillStyle = '#000080'; ctx.fillRect(110, 70, 300, 26);
        ctx.fillStyle = '#ffffff'; ctx.fillText('Error', 118, 89);
        ctx.fillStyle = '#000000'; ctx.font = '18px Arial';
        ctx.fillText('This program has performed an', 130, 130);
        ctx.fillText('illegal operation and will be shut down.', 120, 156);
        ctx.fillStyle = '#c0c0c0'; ctx.strokeRect(220, 185, 80, 30); ctx.fillStyle = '#000'; ctx.fillText('OK', 248, 206);
      }
    });
  }

  function circuitTexture() {
    return canvasTexture('circuit', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 4;
      for (let i = 0; i < 40; i++) {
        let x = (i * 97) % w; let y = (i * 53) % h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) { if (s % 2) x = (x + 60 + i * 7) % w; else y = (y + 50 + i * 3) % h; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function placard(group, text, x, y, z, rotationY = 0) {
    const sign = new THREE.Group();
    sign.add(box(0.15, 1.2, 0.15, material('#424242'), 0, 0.6, 0));
    const plate = facedBox(2.6, 1.1, 0.1, material('#212121'), new THREE.MeshBasicMaterial({ map: labelTexture(text, { bg: '#fafafa', fg: '#212121', font: 'bold 34px Georgia, serif' }) }), 0, 1.5, 0);
    plate.rotation.x = -0.3;
    sign.add(plate);
    sign.position.set(x, y, z);
    sign.rotation.y = rotationY;
    group.add(sign);
  }

  const builders = {
    // A 3.5" floppy you can walk into through the open metal shutter
    giantFloppy(group, { w, h, d, color, label }) {
      const shell = material(color, { roughness: 0.5 });
      const t = 0.6;
      group.add(box(w, h, t, shell, 0, 0, -d / 2 + t / 2));
      group.add(box(w, h, t, shell, 0, 0, d / 2 - t / 2));
      group.add(box(t, h, d, shell, -w / 2 + t / 2, 0, 0));
      group.add(box(t, h, d, shell, w / 2 - t / 2, 0, 0));
      group.add(box(w, t, d, shell, 0, h / 2 - t / 2, 0));
      // Front face: metal shutter (open doorway), label and write-protect notch
      const front = d / 2 + 0.05;
      group.add(box(w * 0.5, h * 0.35, 0.1, material('#cfd8dc', { metalness: 0.9, roughness: 0.2 }), -w * 0.05, h * 0.3, front));
      group.add(box(w * 0.12, h * 0.25, 0.12, material('#263238'), -w * 0.12, h * 0.3, front + 0.02));
      group.add(facedBox(w * 0.7, h * 0.4, 0.1, material('#ffffff'), new THREE.MeshBasicMaterial({ map: labelTexture('DISK 1 of 1 — 1.44 MB', { bg: '#fffde7', fg: '#1a237e', font: 'bold 48px Comic Sans MS, cursive' }) }), 0, -h * 0.15, front));
      group.add(box(1.4, 1.4, 0.12, material('#111'), w * 0.4, h * 0.38, front));
      // Doorway cut into the side so visitors can walk inside to the magnetic disc
      group.add(box(0.7, h * 0.7, d * 0.4, material('#000000'), w / 2 + 0.01, -h * 0.15, 0));
      const disc = cylinder(Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.2, material('#4e342e', { metalness: 0.3, roughness: 0.3 }), 0, -h / 2 + 0.6, 0, 48);
      group.add(disc);
      group.add(cylinder(1.2, 1.2, 0.4, material('#b0bec5', { metalness: 0.9 }), 0, -h / 2 + 0.75, 0, 24));
      animate(disc, (time) => { disc.rotation.y = time * 0.6; });
      placard(group, label || '3.5" Floppy Disk', w / 2 + 2.5, -h / 2, d / 2 + 2, -0.6);
    },

    // A giant processor: ceramic package, golden pins and a walkable circuit die
    giantCpu(group, { w, h, d, label }) {
      group.add(box(w, h * 0.5, d, material('#455a64', { roughness: 0.4 }), 0, 0, 0));
      group.add(box(w * 0.98, 0.1, d * 0.98, new THREE.MeshStandardMaterial({ map: circuitTexture(), roughness: 0.5 }), 0, h * 0.25 + 0.05, 0));
      const die = box(w * 0.35, h * 0.3, d * 0.35, material('#b0bec5', { metalness: 0.95, roughness: 0.2 }), 0, h * 0.25 + h * 0.15, 0);
      group.add(die);
      group.add(facedBox(w * 0.3, h * 0.12, 0.05, material('#b0bec5', { metalness: 0.95 }), new THREE.MeshBasicMaterial({ map: labelTexture('CPU 66 MHz', { bg: '#cfd8dc', fg: '#263238' }) }), 0, h * 0.4, d * 0.175 + 0.03));
      const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, h * 0.5, 6), material('#ffca28', { metalness: 0.9, roughness: 0.2 }), 196);
      const matrix = new THREE.Matrix4();
      let index = 0;
      for (let i = 0; i < 14; i++) {
        for (let j = 0; j < 14; j++) {
          matrix.makeTranslation(-w * 0.45 + (i * w * 0.9) / 13, -h * 0.5, -d * 0.45 + (j * d * 0.9) / 13);
          pins.setMatrixAt(index++, matrix);
        }
      }
      group.add(pins);
      // Stairs up onto the chip
      for (let s = 0; s < 4; s++) group.add(box(3, (h * 0.75 * (s + 1)) / 4, 1.2, material('#78909c'), 0, -h / 2 + (h * 0.75 * (s + 1)) / 8, d / 2 + 4.6 - s * 1.2));
      placard(group, label || 'Giant Processor', -w / 2 - 2, -h / 2, d / 2 + 2, 0.5);
    },

    // CRT monitor parkour: a huge tube monitor with floating platforms spiraling to the top
    crtParkour(group, { w, h, d, label }) {
      const beige = material('#e8dcc4', { roughness: 0.8 });
      group.add(box(w, h * 0.75, d * 0.55, beige, 0, h * 0.075, d * 0.2));
      const tube = mesh(new THREE.CylinderGeometry(w * 0.25, w * 0.45, d * 0.45, 4), beige, 0, h * 0.05, -d * 0.25);
      tube.rotation.x = Math.PI / 2;
      tube.rotation.y = Math.PI / 4;
      group.add(tube);
      const screen = box(w * 0.8, h * 0.6, 0.1, new THREE.MeshBasicMaterial({ map: retroScreenTexture('dos') }), 0, h * 0.1, d * 0.475 + 0.06);
      group.add(screen);
      group.add(box(w * 0.4, h * 0.1, d * 0.4, beige, 0, -h * 0.45, 0));
      group.add(sphere(0.4, glow('#76ff03', 1.4), w * 0.4, -h * 0.25, d * 0.48, 8));
      // Parkour platforms climbing around the monitor
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2.2;
        const radius = Math.max(w, d) * 0.62;
        const platform = box(2.6, 0.4, 2.6, glow(`hsl(${(i * 26) % 360}, 80%, 55%)`, 0.35), Math.cos(angle) * radius, -h / 2 + 1 + (i * (h - 1)) / steps, Math.sin(angle) * radius);
        group.add(platform);
        animate(platform, (time) => { platform.position.y = -h / 2 + 1 + (i * (h - 1)) / steps + Math.sin(time * 1.5 + i) * 0.25; });
      }
      // Maze walls on top of the monitor
      const mazeMaterial = material('#7e57c2');
      [[0, -0.3, 0.8, 0.06], [-0.25, 0, 0.06, 0.6], [0.2, 0.1, 0.5, 0.06], [0.35, -0.15, 0.06, 0.4], [-0.1, 0.3, 0.6, 0.06]].forEach(([x, z, sw, sd]) =>
        group.add(box(w * sw, 1.6, d * 0.55 * sd * 1.6 + (sd > 0.1 ? 0 : 0.3), mazeMaterial, x * w, h * 0.45 + 0.8, d * 0.2 + z * d * 0.55)));
      placard(group, label || 'CRT Parkour', w / 2 + 3, -h / 2, d / 2 + 3, -0.4);
    },

    giantKeyboard(group, { w, h, d, label }) {
      group.add(box(w, h * 0.6, d, material('#d7ccc8', { roughness: 0.8 }), 0, -h * 0.2, 0));
      const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material('#efebe9', { roughness: 0.7 }), 90);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      let index = 0;
      const rows = 5;
      const cols = 18;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols && index < 90; c++) {
          const keyW = (w * 0.92) / cols - 0.25;
          const keyD = (d * 0.85) / rows - 0.25;
          const isSpace = r === rows - 1 && c >= 5 && c <= 12;
          if (r === rows - 1 && c > 5 && c <= 12) continue;
          scale.set(isSpace ? keyW * 8 + 1.75 : keyW, h * 0.4, keyD);
          position.set(-w * 0.46 + (isSpace ? (c + 3.5) : c) * ((w * 0.92) / cols) + keyW / 2, h * 0.3, -d * 0.425 + r * ((d * 0.85) / rows) + keyD / 2);
          matrix.compose(position, new THREE.Quaternion(), scale);
          keys.setMatrixAt(index++, matrix);
        }
      }
      keys.count = index;
      keys.castShadow = true;
      group.add(keys);
      placard(group, label || 'Mechanical Keyboard', -w / 2 - 2, -h / 2, d / 2 + 2, 0.4);
    },

    cassette(group, { w, h, d, color, label }) {
      group.add(box(w, h, d, material(color, { roughness: 0.4 })));
      group.add(facedBox(w * 0.8, h * 0.45, 0.1, material('#fafafa'), new THREE.MeshBasicMaterial({ map: labelTexture('MIXTAPE \'89 — SIDE A', { bg: '#fff8e1', fg: '#d84315', font: 'bold 44px Comic Sans MS, cursive' }) }), 0, h * 0.18, d / 2 + 0.05));
      [-1, 1].forEach((side) => {
        const reel = cylinder(h * 0.13, h * 0.13, 0.2, material('#fafafa'), side * w * 0.2, -h * 0.15, d / 2 + 0.1, 12);
        reel.rotation.x = Math.PI / 2;
        group.add(reel);
        animate(reel, (time) => { reel.rotation.y = time * 2; });
      });
      group.add(box(w * 0.5, h * 0.12, 0.12, material('#3e2723'), 0, -h * 0.15, d / 2 + 0.06));
      placard(group, label || 'Compact Cassette', w / 2 + 2, -h / 2, d / 2 + 2, -0.4);
    },

    cdrom(group, { w, h, d, label }) {
      group.add(box(w, h * 0.3, d, material('#cfd8dc', { roughness: 0.5 }), 0, -h * 0.35, 0));
      const disc = cylinder(w * 0.4, w * 0.4, 0.15, material('#e0f7fa', { metalness: 1, roughness: 0.05, emissive: '#80deea', emissiveIntensity: 0.2 }), 0, -h * 0.15, d * 0.2, 48);
      group.add(disc);
      group.add(cylinder(w * 0.06, w * 0.06, 0.2, material('#90a4ae'), 0, -h * 0.15, d * 0.2, 16));
      animate(disc, (time) => { disc.rotation.y = time * 3; });
      placard(group, label || 'CD-ROM Drive', -w / 2 - 2, -h / 2, d / 2 + 2, 0.4);
    },

    tubeWall(group, { w, h, d, label }) {
      group.add(box(w, h, d, material('#37474f', { metalness: 0.5 })));
      const tubes = Math.floor(w / 1.2);
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < tubes; i++) {
          const tube = cylinder(0.3, 0.3, 1, glow('#ff9800', 0.6, { transparent: true, opacity: 0.85 }), -w / 2 + 0.6 + i * 1.2, -h * 0.3 + row * (h / 4.5), d / 2 + 0.35, 8);
          group.add(tube);
          animate(tube, (time) => { tube.material = glow('#ff9800', 0.4 + Math.abs(Math.sin(time * 2 + i * 0.7 + row)) * 0.9, { transparent: true, opacity: 0.85 }); });
        }
      }
      placard(group, label || 'Vacuum Tube Computer', 0, -h / 2, d / 2 + 2.5);
    },

    punchCards(group, { w, h, d, label }) {
      const texture = canvasTexture('punchcard', 512, 256, (ctx, cw, ch) => {
        ctx.fillStyle = '#f3e5ab'; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#5d4037';
        for (let col = 0; col < 40; col++) for (let row = 0; row < 12; row++) if ((col * 7 + row * 3) % 5 === 0) ctx.fillRect(10 + col * 12.4, 10 + row * 20, 6, 12);
      });
      group.add(box(w, h, d, material('#795548')));
      const cards = Math.floor(w / 3.2);
      for (let i = 0; i < cards; i++) {
        for (let row = 0; row < 3; row++) {
          group.add(box(2.8, 1.3, 0.05, new THREE.MeshBasicMaterial({ map: texture }), -w / 2 + 1.6 + i * 3.2, -h * 0.3 + row * 1.8, d / 2 + 0.05));
        }
      }
      placard(group, label || 'Punch Cards', 0, -h / 2, d / 2 + 2.5);
    },

    softwareWall(group, { w, h, d, label, block }) {
      const o = orientation(block, w, d, true);
      const inner = new THREE.Group();
      inner.rotation.y = o.rotationY;
      inner.add(box(o.w, h, o.d, material('#263238')));
      ['dos', 'basic', 'desktop', 'web'].forEach((kind, index) => {
        const x = -o.w / 2 + (index + 0.5) * (o.w / 4);
        inner.add(box(o.w / 4 - 1, h * 0.55, 0.3, material('#e8dcc4'), x, h * 0.05, o.d / 2 + 0.15));
        inner.add(box(o.w / 4 - 1.8, h * 0.45, 0.05, new THREE.MeshBasicMaterial({ map: retroScreenTexture(kind) }), x, h * 0.05, o.d / 2 + 0.33));
      });
      inner.add(facedBox(o.w * 0.6, h * 0.15, 0.1, material('#263238'), new THREE.MeshBasicMaterial({ map: labelTexture('HALL OF FORGOTTEN SOFTWARE', { bg: '#263238', fg: '#76ff03', font: 'bold 44px Consolas, monospace' }) }), 0, h * 0.4, o.d / 2 + 0.06));
      group.add(inner);
      if (label) group.userData.label = label;
    },

    ballMouse(group, { w, h, d, label }) {
      const body = sphere(1, material('#e8dcc4', { roughness: 0.6 }), 0, 0, 0, 20);
      body.scale.set(w / 2, h / 2, d / 2);
      group.add(body);
      group.add(box(w * 0.05, h * 0.2, d * 0.3, material('#bcaaa4'), 0, h * 0.42, -d * 0.2));
      const cable = mesh(new THREE.TorusGeometry(d * 0.6, 0.15, 6, 20, Math.PI), material('#9e9e9e'), 0, -h * 0.3, -d * 0.5 - d * 0.6);
      cable.rotation.x = Math.PI / 2;
      group.add(cable);
      group.add(sphere(h * 0.15, material('#424242'), 0, -h * 0.45, d * 0.1, 12));
      placard(group, label || 'Ball Mouse', w / 2 + 2, -h / 2, d / 2 + 1, -0.4);
    },

    museumHall(group, { w, h, d, color, label }) {
      // Grand entrance arch with the museum name; the floor is drawn by the map ground
      const stone = material(color);
      [-1, 1].forEach((side) => group.add(box(2, h, 2, stone, side * (w / 2 - 1), 0, 0)));
      group.add(box(w, 2.2, 2.4, stone, 0, h / 2 - 1.1, 0));
      group.add(facedBox(w * 0.85, 1.6, 0.2, stone, new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Museum', { bg: '#1a1a2e', fg: '#ffd54f', font: 'bold 40px Georgia, serif' }) }), 0, h / 2 - 1.1, 1.25));
    }
  };

  // Illustrated recreations of early internet & software screens (not real screenshots)
  function historyTexture(kind) {
    return canvasTexture(`history|${kind}`, 512, 384, (ctx, w, h) => {
      const mono = '20px Consolas, Courier New, monospace';
      if (kind === 'arpanet') {
        ctx.fillStyle = '#f4ecd8'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 3;
        const nodes = [[90, 120, 'UCLA'], [90, 280, 'SRI'], [300, 90, 'UCSB'], [400, 260, 'UTAH']];
        [[0, 1], [0, 2], [1, 2], [1, 3]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[b][0], nodes[b][1]); ctx.stroke(); });
        nodes.forEach(([x, y, name]) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#222'; ctx.font = 'bold 18px Georgia'; ctx.fillText(name, x - 24, y + 6); });
        ctx.font = 'bold 26px Georgia'; ctx.fillText('ARPANET · 4 nodes · Dec 1969', 60, 40);
      } else if (kind === 'firstsite') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000'; ctx.font = 'bold 30px Times New Roman'; ctx.fillText('World Wide Web', 20, 50);
        ctx.font = '19px Times New Roman';
        ['The WorldWideWeb (W3) is a wide-area hypermedia', 'information retrieval initiative aiming to give', 'universal access to a large universe of documents.', '', 'Everything there is online about W3 is linked'].forEach((line, index) => ctx.fillText(line, 20, 95 + index * 28));
        ctx.fillStyle = '#0000ee'; ['What\'s out there?', 'Help', 'Software Products', 'Technical'].forEach((link, index) => { ctx.fillText(link, 30, 260 + index * 28); ctx.fillRect(30, 263 + index * 28, ctx.measureText(link).width, 1); });
      } else if (kind === 'bbs') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        ctx.font = mono;
        [['#ff5555', '╔══════════════════════════════════╗'], ['#55ffff', '║   WELCOME TO THE MIDNIGHT BBS    ║'], ['#ff5555', '╚══════════════════════════════════╝'], ['#ffff55', ' [M] Message Boards   [F] Files'], ['#ffff55', ' [D] Door Games       [C] Chat SysOp'], ['#55ff55', ' Connected at 2400 baud. Node 1 of 2'], ['#aaaaaa', ' Command >_']].forEach(([color, line], index) => { ctx.fillStyle = color; ctx.fillText(line, 20, 50 + index * 40); });
      } else if (kind === 'irc') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000080'; ctx.fillRect(0, 0, w, 28);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.fillText('#programming', 10, 19);
        ctx.font = '17px Consolas, monospace';
        [['#008000', '* Now talking in #programming'], ['#000', '<neo> anyone know how to exit vim?'], ['#000', '<ada> :q!'], ['#000', '<neo> thanks!!'], ['#800080', '* linus has joined #programming'], ['#000', '<turing> it compiles, ship it'], ['#000', '<grace> found a moth in the relay']].forEach(([color, line], index) => { ctx.fillStyle = color; ctx.fillText(line, 12, 60 + index * 40); });
      } else if (kind === 'usenet') {
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000'; ctx.font = '17px Courier New, monospace';
        ['From: a student in Helsinki', 'Newsgroups: comp.os.minix', 'Subject: What would you like to see most', '         in minix?', 'Date: 25 Aug 91', '', "I'm doing a (free) operating system (just", 'a hobby, won\'t be big and professional)...'].forEach((line, index) => ctx.fillText(line, 16, 40 + index * 38));
      } else if (kind === 'homepage') {
        ctx.fillStyle = '#000040'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect((i * 83) % w, (i * 47) % h, 2, 2); }
        ctx.fillStyle = '#ffff00'; ctx.font = 'bold 34px Comic Sans MS, cursive'; ctx.fillText('~*~ My Cool Homepage ~*~', 40, 60);
        ctx.fillStyle = '#00ff00'; ctx.font = '22px Times New Roman'; ctx.fillText('You are visitor #0001337', 120, 120);
        ctx.fillStyle = '#ffd700'; ctx.fillRect(120, 160, 270, 50); ctx.fillStyle = '#000'; ctx.font = 'bold 22px Arial'; ctx.fillText('UNDER CONSTRUCTION', 128, 193);
        ctx.fillStyle = '#ff00ff'; ctx.font = '22px Times New Roman'; ctx.fillText('Sign my guestbook! · My webring ->', 70, 270);
        ctx.fillStyle = '#00ffff'; ctx.fillText('Best viewed at 800x600', 140, 330);
      } else if (kind === 'browser') {
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000080'; ctx.fillRect(0, 0, w, 26);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.fillText('Early graphical web browser (1993)', 8, 18);
        ctx.fillStyle = '#fff'; ctx.fillRect(8, 36, w - 16, 26); ctx.fillStyle = '#000'; ctx.font = '15px Arial'; ctx.fillText('URL: http://www.example.edu/home.html', 14, 54);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(8, 72, w - 16, h - 110);
        ctx.fillStyle = '#000'; ctx.font = 'bold 26px Times New Roman'; ctx.fillText('Welcome to the Web!', 30, 115);
        ctx.fillStyle = '#9e9e9e'; ctx.fillRect(30, 140, 180, 120);
        ctx.fillStyle = '#0000ee'; ctx.font = '18px Times New Roman'; ctx.fillText('Images inline with text!', 230, 190);
        ctx.fillStyle = '#000'; ctx.fillRect(8, h - 30, (w - 16) * 0.6, 14); ctx.font = '13px Arial'; ctx.fillText('Transferring data... 60%', 10, h - 4);
      } else if (kind === 'email') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#33ff33'; ctx.font = mono;
        ['$ mail', 'Mail version 1.0. Type ? for help.', '> N 1 tomlinson  QWERTYUIOP', '', '& 1', 'Message 1:', 'From: tomlinson@bbn-tenexa', 'QWERTYUIOP', '&_'].forEach((line, index) => ctx.fillText(line, 20, 40 + index * 36));
      } else if (kind === 'search') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#333'; ctx.font = 'bold 40px Georgia'; ctx.fillText('WebSearch 98', 120, 110);
        ctx.strokeStyle = '#888'; ctx.strokeRect(80, 150, 350, 34);
        ctx.fillStyle = '#000'; ctx.font = '18px Arial'; ctx.fillText('how to make a website', 90, 173);
        ctx.fillStyle = '#ddd'; ctx.fillRect(160, 210, 190, 34); ctx.fillStyle = '#000'; ctx.fillText('Search the Web', 192, 233);
        ctx.fillStyle = '#0000ee'; ctx.font = '16px Arial'; ['Directory: Arts · Business · Computers', 'Internet · Science · Recreation'].forEach((line, index) => ctx.fillText(line, 110, 300 + index * 28));
      } else {
        retroScreenTexture(kind);
        const image = textureSource(kind);
        if (image) ctx.drawImage(image, 0, 0, w, h);
      }
    });
  }

  function textureSource(kind) {
    const texture = retroScreenTexture(kind);
    return texture && texture.image;
  }

  // Timeline of memorable screens (illustrated recreations, not real screenshots)
  function timelineTexture(kind) {
    return canvasTexture(`timeline|${kind}`, 512, 384, (ctx, w, h) => {
      const window95 = (title, color = '#000080') => {
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(40, 40, w - 80, h - 90);
        ctx.fillStyle = color; ctx.fillRect(44, 44, w - 88, 26);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Tahoma, Arial'; ctx.fillText(title, 52, 62);
      };
      if (kind === 'win1') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#0000aa'; ctx.fillRect(0, 0, w, 30); ctx.fillRect(0, 180, w, 26);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Courier New'; ctx.fillText('MS-DOS Executive', 180, 21); ctx.fillText('Clock', 230, 199);
        ctx.fillStyle = '#000'; ctx.font = '16px Courier New'; ['A:  C:  \\', 'CALC.EXE  CLOCK.EXE  NOTEPAD.EXE', 'PAINT.EXE  REVERSI.EXE  WRITE.EXE'].forEach((line, i) => ctx.fillText(line, 16, 60 + i * 26));
        ctx.beginPath(); ctx.arc(256, 290, 70, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(256, 290); ctx.lineTo(256, 240); ctx.moveTo(256, 290); ctx.lineTo(296, 300); ctx.stroke();
      } else if (kind === 'mosaic') {
        ctx.fillStyle = '#bdbdbd'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e0e0e0'; ctx.fillRect(10, 40, w - 20, 34);
        ctx.fillStyle = '#000'; ctx.font = '15px Arial'; ctx.fillText('URL: http://www.ncsa.uiuc.edu/', 18, 62);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 84, w - 20, h - 94);
        ctx.fillStyle = '#000'; ctx.font = 'bold 26px Times New Roman'; ctx.fillText('Welcome to NCSA Mosaic', 30, 130);
        ctx.fillStyle = '#d4a017'; ctx.fillRect(30, 150, 120, 90);
        ctx.fillStyle = '#0000ee'; ctx.font = '18px Times New Roman'; ['What\'s New', 'Starting Points', 'Internet Resources'].forEach((link, i) => ctx.fillText(link, 170, 175 + i * 30));
      } else if (kind === 'bsod') {
        ctx.fillStyle = '#0000aa'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#aaaaaa'; ctx.fillRect(200, 50, 112, 26);
        ctx.fillStyle = '#0000aa'; ctx.font = 'bold 18px Courier New'; ctx.fillText('Windows', 214, 69);
        ctx.fillStyle = '#ffffff'; ctx.font = '16px Courier New';
        ['A fatal exception 0E has occurred at', '0028:C0011E36 in VXD VMM(01) +', '00010E36. The current application', 'will be terminated.', '', '* Press any key to terminate the', '  current application.', '* Press CTRL+ALT+DEL again to restart', '  your computer.', '', '      Press any key to continue _'].forEach((line, i) => ctx.fillText(line, 40, 110 + i * 22));
      } else if (kind === 'apple97') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, w, 50);
        ['Store', 'Hot News', 'Products', 'Support'].forEach((tab, i) => { ctx.fillStyle = ['#7aa6d6', '#e5a24b', '#9bc46b', '#c58bd0'][i]; ctx.fillRect(20 + i * 120, 12, 110, 30); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.fillText(tab, 30 + i * 120, 33); });
        ctx.fillStyle = '#000'; ctx.font = 'bold 34px Georgia'; ctx.fillText('Think different.', 40, 140);
        ctx.fillStyle = '#5a5a5a'; ctx.font = '16px Arial'; ['The new Power Mac G3', 'Mac OS 8 is here', 'Developer Connection'].forEach((line, i) => ctx.fillText(`· ${line}`, 40, 200 + i * 30));
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(330, 170, 140, 150);
      } else if (kind === 'google98') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.font = 'bold 56px Georgia'; ['G', 'o', 'o', 'g', 'l', 'e', '!'].forEach((letter, i) => { ctx.fillStyle = ['#3369e8', '#d50f25', '#eeb211', '#3369e8', '#009925', '#d50f25', '#3369e8'][i]; ctx.fillText(letter, 120 + i * 40, 120); });
        ctx.fillStyle = '#000'; ctx.font = '14px Arial'; ctx.fillText('Search the web using Google!', 160, 160);
        ctx.strokeStyle = '#555'; ctx.strokeRect(120, 180, 270, 26);
        ctx.fillStyle = '#ddd'; ctx.fillRect(140, 225, 110, 26); ctx.fillRect(265, 225, 120, 26);
        ctx.fillStyle = '#000'; ctx.fillText('Google Search', 150, 243); ctx.fillText("I'm feeling lucky", 270, 243);
      } else if (kind === 'thefacebook') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3b5998'; ctx.fillRect(0, 0, w, 54);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Verdana'; ctx.fillText('[ thefacebook ]', 20, 38);
        ctx.fillStyle = '#6d84b4'; ctx.fillRect(0, 54, 120, h - 54);
        ctx.fillStyle = '#ffffff'; ctx.font = '13px Verdana'; ['login', 'register', 'about'].forEach((link, i) => ctx.fillText(link, 20, 90 + i * 24));
        ctx.fillStyle = '#3b5998'; ctx.font = 'bold 18px Verdana'; ctx.fillText('[ Welcome to Thefacebook ]', 140, 90);
        ctx.fillStyle = '#333'; ctx.font = '13px Verdana'; ['Thefacebook is an online directory that', 'connects people through social networks', 'at colleges.', '', 'You can use Thefacebook to:', '  • Search for people at your school', '  • Find out who are in your classes', '  • Look up your friends\' friends'].forEach((line, i) => ctx.fillText(line, 140, 125 + i * 22));
      } else if (kind === 'youtube05') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000'; ctx.font = 'bold 30px Arial'; ctx.fillText('You', 20, 46);
        ctx.fillStyle = '#cc0000'; ctx.fillRect(78, 18, 74, 38); ctx.fillStyle = '#fff'; ctx.fillText('Tube', 82, 46);
        ctx.fillStyle = '#666'; ctx.font = '13px Arial'; ctx.fillText('Broadcast Yourself', 160, 46);
        ctx.fillStyle = '#000'; ctx.fillRect(40, 80, 280, 200);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(160, 150); ctx.lineTo(160, 210); ctx.lineTo(210, 180); ctx.fill();
        ctx.fillStyle = '#03c'; ctx.font = 'bold 14px Arial'; ctx.fillText('Me at the zoo', 40, 305);
        ctx.fillStyle = '#666'; ctx.font = '12px Arial'; ctx.fillText('0:19 · Added: April 23, 2005', 40, 325);
      } else if (kind === 'win95') {
        ctx.fillStyle = '#008080'; ctx.fillRect(0, 0, w, h);
        window95('My Computer');
        ctx.fillStyle = '#000'; ctx.font = '14px Tahoma'; ['3½ Floppy (A:)', '(C:)', 'Control Panel', 'Printers'].forEach((item, i) => { ctx.fillStyle = '#ffd43b'; ctx.fillRect(70 + i * 95, 110, 40, 32); ctx.fillStyle = '#000'; ctx.fillText(item, 60 + i * 95, 165); });
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, h - 34, w, 34);
        ctx.fillStyle = '#000'; ctx.font = 'bold 16px Tahoma'; ctx.fillText('Start', 34, h - 11); ctx.strokeRect(6, h - 30, 74, 26);
      } else if (kind === 'winamp') {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2e2e3e'; ctx.fillRect(40, 60, w - 80, 160);
        ctx.fillStyle = '#00ff00'; ctx.font = '22px Courier New'; ctx.fillText('1. DJ Mike Llama - Llama Whippin', 52, 100);
        ctx.fillText('00:05   128kbps  44kHz', 52, 140);
        for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 3 ? '#00ff00' : '#ffff00'; const bar = 10 + ((i * 37) % 60); ctx.fillRect(60 + i * 18, 210 - bar, 12, bar); }
        ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 18px Arial'; ctx.fillText('"It really whips the llama\'s ass!"', 60, 280);
      } else if (kind === 'msn') {
        ctx.fillStyle = '#eaf2fb'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3a6ea5'; ctx.fillRect(0, 0, w, 40);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Tahoma'; ctx.fillText('Messenger - Online', 16, 27);
        ctx.fillStyle = '#000'; ctx.font = '15px Tahoma'; ['Online (3)', '  ● dev_friend  - shipping on friday', '  ● nerd_2006  - brb', '  ● coder_x  - ♪ Listening to: Coldplay', 'Offline (12)'].forEach((line, i) => ctx.fillText(line, 20, 80 + i * 30));
        ctx.fillStyle = '#ffd43b'; ctx.fillRect(330, 240, 150, 60); ctx.fillStyle = '#000'; ctx.fillText('*nudge*', 370, 275);
      } else if (kind === 'clippy') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffcc'; ctx.fillRect(40, 40, 300, 120); ctx.strokeRect(40, 40, 300, 120);
        ctx.fillStyle = '#000'; ctx.font = '17px Tahoma'; ["It looks like you're writing", 'a letter. Would you like help?', '', '○ Get help with writing the letter'].forEach((line, i) => ctx.fillText(line, 54, 72 + i * 24));
        ctx.strokeStyle = '#888'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(400, 260, 34, 80, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(388, 230, 6, 0, Math.PI * 2); ctx.arc(414, 230, 6, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'geocities') {
        ctx.fillStyle = '#000033'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 80; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect((i * 53) % w, (i * 97) % h, 2, 2); }
        ctx.fillStyle = '#ff00ff'; ctx.font = 'bold 30px Comic Sans MS, cursive'; ctx.fillText('Welcome 2 my homepage!!!', 30, 70);
        ctx.fillStyle = '#ffff00'; ctx.fillRect(140, 140, 230, 50); ctx.fillStyle = '#000'; ctx.font = 'bold 18px Arial'; ctx.fillText('UNDER CONSTRUCTION', 150, 172);
        ctx.fillStyle = '#00ff00'; ctx.font = '18px Courier New'; ctx.fillText('You are visitor #000451', 140, 250);
        ctx.fillStyle = '#00ffff'; ctx.fillText('[Sign my guestbook] [Webring >>]', 90, 300);
      } else if (kind === 'macos9') {
        ctx.fillStyle = '#6b78a6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, w, 24);
        ctx.fillStyle = '#000'; ctx.font = '14px Charcoal, Chicago, Arial'; ctx.fillText('  File  Edit  View  Special  Help', 20, 17);
        ctx.fillStyle = '#dddddd'; ctx.fillRect(60, 60, 300, 200);
        ctx.fillStyle = '#bbbbbb'; ctx.fillRect(60, 60, 300, 22);
        ctx.fillStyle = '#000'; ctx.fillText('Macintosh HD', 170, 76);
        ['Applications', 'System Folder', 'Documents'].forEach((item, i) => { ctx.fillStyle = '#8fb3e8'; ctx.fillRect(80 + i * 95, 110, 50, 40); ctx.fillStyle = '#000'; ctx.fillText(item, 70 + i * 95, 170); });
      } else {
        ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
      }
    });
  }

  const TIMELINE = [
    [1969, 'arpanet', 'ARPANET', 'The first packet-switched network: its first message, "LO", crashed while typing LOGIN.'],
    [1985, 'win1', 'Windows 1.0', 'Tiled windows on top of MS-DOS, with Calculator, Clock, Notepad and Reversi.'],
    [1989, 'aol', '"You\'ve got mail!"', 'A cheerful voice announced every new message, and millions of people discovered that hearing it was more exciting than reading the mail.', 'early'],
    [1991, 'firstsite', 'The first website', 'Tim Berners-Lee published the first web page at CERN.'],
    [1993, 'mosaic', 'NCSA Mosaic', 'The browser that showed images inline with text and made the web popular.'],
    [1995, 'win95', 'Windows 95', 'The Start button, the taskbar and plug and play reached millions of homes.'],
    [1995, 'geocities', 'Personal homepages', 'Starry backgrounds, visitor counters, guestbooks, webrings and "under construction" signs.'],
    [1997, 'apple97', 'Apple website (late 1990s)', '"Think different": colorful tabs and the Power Mac G3 era.'],
    [1997, 'winamp', 'Winamp', 'The MP3 player with skins, a spectrum analyzer and a famous llama.'],
    [1998, 'google98', 'Google (beta)', 'A search box, two buttons and a link-based ranking that changed the web.'],
    [1999, 'msn', 'Instant messengers', 'Status messages, nudges and "brb": how a generation chatted after school.'],
    [1999, 'macos9', 'Mac OS 9', 'Platinum windows, extensions conflicts and the last classic Mac OS.'],
    [2001, 'clippy', 'The office assistant', '"It looks like you\'re writing a letter." Loved by few, remembered by all.'],
    [2001, 'bsod', 'Blue Screen of Death', 'A fatal exception 0E has occurred... the most feared screen of the PC era.'],
    [2004, 'thefacebook', 'Thefacebook', 'An online directory that connected people through social networks at colleges.'],
    [2005, 'youtube05', 'YouTube', '"Me at the zoo", 19 seconds, the first video uploaded to the site.']
  ];

  const MEMORABLE_MENTIONS = [
    ['zipdisk', 'Zip disk (100 MB)', 'A chunky floppy successor that clicked ominously when it died.'],
    ['pager', 'Pager', 'Numeric messages and "call me back" codes, years before smartphones.'],
    ['pda', 'PDA with stylus', 'Handwriting recognition, a calendar and a stylus that was always lost.'],
    ['modem', '56k dial-up modem', 'The screeching handshake that meant you were going online (and nobody could call home).'],
    ['crt', 'CRT monitor', 'Heavy, warm and humming: degauss button included.'],
    ['joystick', 'Analog joystick', 'Calibrate before every game, drift forever after.'],
    ['floppy', '3.5" floppy disk', '1.44 MB of hope. Its icon still means "save".'],
    ['tamagotchi', 'Virtual pet keychain', 'Needed feeding during class. Many did not survive.']
  ];

  // --------------------------------------------------------------------------
  // HALL OF INTERNET HISTORY: a chronological museum walk from 1969 to today.
  // Inspired by the idea of an "internet artifacts" timeline; every
  // illustration below is an original canvas recreation drawn in code and
  // every description is our own short text. Blocks:
  //   history_ring  one ring corridor around the Underground Lounge, 1969 at
  //                 the lounge portal, all the way around to "You are here"
  //   gallery_link  promenade from the ring to the Minimal Art Gallery
  // --------------------------------------------------------------------------
  const ERAS = {
    early: { name: 'Early Internet', years: '1969 - 1994', frame: '#6b4423', accent: '#ffcf7a', sign: '#3a2416' },
    dotcom: { name: 'Dot-com Boom', years: '1995 - 2003', frame: '#8d99a6', accent: '#7fd8ff', sign: '#14324a' },
    web2: { name: 'Web 2.0', years: '2004 - 2006', frame: '#f1f3f5', accent: '#8ce99a', sign: '#1f5130' },
    mobile: { name: 'Mobile & Social', years: '2007 - 2015', frame: '#212529', accent: '#ff8fab', sign: '#4a1428' },
    modern: { name: 'Modern Web', years: '2016 - today', frame: '#3b2a63', accent: '#b197fc', sign: '#24164a' }
  };

  // [year, illustration kind, title, short description (our own words), era, optional 3D model on a plinth]
  const ARTIFACTS = [
    [1969, 'lo', 'ARPANET: "LO"', 'A UCLA student tried to log in to a computer at SRI, hundreds of miles away. The system crashed after two letters, so the first message ever sent over the network was simply "LO".', 'early'],
    [1969, 'unix', 'Unix', 'At Bell Labs, Ken Thompson and Dennis Ritchie built a small operating system on a spare minicomputer. Pipes, plain text files and little tools that do one thing well still shape every terminal.', 'early'],
    [1971, 'email', 'The first network email', 'Ray Tomlinson sent a throwaway test message between two machines standing side by side, and picked the @ sign to join the user name and the host.', 'early'],
    [1972, 'clang', 'The C language', 'Dennis Ritchie created C so Unix could be rewritten in something easier than assembly. Its "hello, world" became the first program almost every developer types.', 'early'],
    [1982, 'smiley', 'The smiley :-)', 'On a Carnegie Mellon message board, Scott Fahlman suggested marking jokes with a sideways face so nobody would take them literally. The face outlived the thread.', 'early'],
    [1984, 'macos', 'The Macintosh desktop', 'The first Macintosh shipped with windows, icons, menus and a mouse pointer. Drag a file to the trash: a whole generation learned computing by pointing and clicking.', 'early'],
    [1985, 'symbolics', 'symbolics.com', 'A Lisp machine maker registered the very first .com domain. For months almost nobody else bothered to get one.', 'early'],
    [1988, 'irc', 'Internet Relay Chat', 'A Finnish student wrote IRC to replace a bulletin board chat. Channels starting with # are still where many developer communities hang out.', 'early'],
    [1991, 'firstsite', 'The first website', 'Tim Berners-Lee put the first web page online at CERN. It explained what the World Wide Web was and how anyone could publish their own pages.', 'early'],
    [1991, 'linux', 'Linux', 'A Finnish student announced a free operating system kernel, "just a hobby, won\'t be big". Thousands of volunteers joined in, and today it runs most servers, phones and supercomputers.', 'early'],
    [1991, 'python', 'Python', 'Guido van Rossum released a language that reads almost like plain English, named after a comedy troupe rather than the snake. Indentation is the syntax.', 'early'],
    [1993, 'coffeepot', 'The Trojan Room coffee pot', 'Researchers at Cambridge pointed a camera at the shared coffee pot to avoid walking to an empty one. Once the picture went on the web, it became the first famous webcam.', 'early', 'coffeepot'],
    [1993, 'mosaic', 'Mosaic', 'A browser that placed pictures inline with text. Suddenly the web looked like a magazine anyone could flip through.', 'early'],
    [1993, 'dog', 'Nobody knows who you are', 'A 1993 magazine cartoon joked that online nobody can tell who (or what) is typing on the other side. It became the classic shorthand for internet anonymity.', 'early'],
    [1994, 'yahoo', 'A guide to the web', 'Two Stanford students kept a hand-made list of their favorite sites, sorted by topic. It grew into Yahoo!, the front door of the web for years.', 'early'],
    [1994, 'modem', 'The dial-up handshake', 'Screech, hiss, bong: two modems negotiating a connection. Nobody could use the phone, and a single photo loaded one stripe at a time.', 'early'],
    [1994, 'netscape', 'Netscape Navigator', 'The browser with a meteor shower logo. It came on floppy disks, cost money for businesses and made the web feel like a frontier.', 'early'],
    [1994, 'geocities', 'GeoCities', 'Free homepages sorted into themed "neighborhoods". Under-construction GIFs were not a phase, they were a lifestyle.', 'early'],
    [1995, 'win95', 'Windows 95', 'A Start button, a taskbar and long file names. People queued at midnight to buy an operating system, and the PC desktop took the shape it still has.', 'dotcom'],
    [1995, 'java', 'Java', 'A language meant for TV set-top boxes became the language of big business. "Write once, run anywhere": compile to bytecode and let a virtual machine do the rest.', 'dotcom'],
    [1995, 'javascript', 'JavaScript', 'Brendan Eich wrote the first version in about ten days so web pages could react to clicks. Today it runs in every browser on the planet, and far beyond it.', 'dotcom'],
    [1995, 'amazon', 'Amazon opens', 'An online bookstore started in a garage. Legend says a bell rang for every order, until there were far too many orders to ring it.', 'dotcom'],
    [1995, 'ebay', 'A broken laser pointer', 'One of the first sales on AuctionWeb, later eBay: a broken laser pointer for $14.83. The buyer said he collected broken laser pointers.', 'dotcom', 'laser'],
    [1996, 'spacejam', 'The Space Jam website', 'A movie promo site made of planet-shaped buttons on a starfield. It stayed online, almost untouched, for more than two decades.', 'dotcom'],
    [1996, 'icq', 'ICQ "Uh-oh!"', 'You were a nine-digit number and a little green flower. The "uh-oh" sound meant someone, somewhere, wanted to chat.', 'dotcom'],
    [1996, 'hotmail', 'Free webmail', 'Email you could read from any browser, for free. Every message ended with an invite to sign up: one of the first viral growth loops.', 'dotcom'],
    [1998, 'hampster', 'The Hampster Dance', 'A page of looping dancing hamster GIFs with a sped-up song. People forwarded it by email until it was one of the first viral web pages.', 'dotcom'],
    [1998, 'google98', 'Google (beta)', 'Two PhD students ranked pages by the links pointing to them. Behind a sparse beta page sat a better search engine than anyone else had.', 'dotcom'],
    [1999, 'msn', 'MSN Messenger', 'Away messages written like poetry, nudges that shook the window and song lyrics as status. Logging off was a dramatic act.', 'dotcom'],
    [1999, 'y2k', 'The Y2K bug', 'Two-digit years threatened to turn 2000 into 1900. Thousands of engineers patched it in time, so the end of the world quietly did not happen.', 'dotcom'],
    [1999, 'napster', 'Napster', 'Millions swapped MP3 files directly between their own computers. The service lost in court, but music distribution was never the same.', 'dotcom'],
    [2000, 'dotcomcrash', 'The dot-com bust', 'Investors poured money into anything ending in .com. When the bubble burst in March 2000 many startups vanished, but the cables and the ideas stayed.', 'dotcom'],
    [2000, 'flash', 'Flash games', 'Animated games played in the browser between classes. Every one started with a loading bar and a "skip intro" button.', 'dotcom'],
    [2001, 'wikipedia', 'Wikipedia', 'A free encyclopedia that anyone can edit sounded impossible. Volunteers turned it into one of the most visited sites on Earth.', 'dotcom'],
    [2002, 'friendster', 'Friendster', 'Profiles, testimonials and friends of friends. It grew so fast that its servers could not keep up with everybody logging in.', 'dotcom'],
    [2003, 'myspace', 'MySpace profiles', 'Custom HTML, glitter backgrounds, an auto-playing song and a ranked Top 8 of friends: the first web design project for a whole generation.', 'dotcom'],
    [2004, 'thefacebook', 'Thefacebook', 'Started in a college dorm as an online directory for students, then slowly opened up to everyone.', 'web2'],
    [2004, 'gmail', 'Gmail', 'Announced on April Fools\' Day with 1 GB of free storage, so many people thought it was a joke. Invites were traded like treasure.', 'web2'],
    [2004, 'orkut', 'Orkut', 'Scraps, testimonials and communities about everything. Huge in Brazil and India, where it felt like the whole country was online at once.', 'web2'],
    [2005, 'git', 'Git', 'Linus Torvalds wrote a new version control system in a couple of weeks when the Linux kernel lost its old one. Branches became cheap and every clone is a full backup.', 'web2'],
    [2005, 'youtube05', '"Me at the zoo"', 'The first video uploaded to YouTube: 19 seconds of a co-founder standing in front of the elephants.', 'web2'],
    [2006, 'tweet', 'The first tweet', 'A short status update, "just setting up my twttr". Real-time micro posts became a new way to spread news.', 'web2'],
    [2007, 'iphone', 'The iPhone', 'A phone, a music player and an internet communicator in one touch screen. When apps arrived, the web moved into every pocket.', 'mobile', 'phone'],
    [2007, 'charlie', 'Charlie bit my finger', 'A home video of a baby biting his big brother\'s finger, shared for the family, became one of the most watched clips of its time.', 'mobile'],
    [2007, 'chipmunk', 'Dramatic Chipmunk', 'Five seconds: a small rodent turns its head, the camera zooms, the music stings. Perfect comic timing.', 'mobile'],
    [2007, 'rickroll', 'Rickrolling', 'A link that promises something exciting but secretly opens a 1987 music video. The prank turned the song into an internet anthem.', 'mobile'],
    [2008, 'github', 'GitHub', 'Git hosting with pull requests, forks and profiles. Open source turned into a social network of millions of developers.', 'mobile'],
    [2008, 'appstore', 'The App Store', 'The iPhone opened to outside developers with about 500 apps on day one. Installing software became one tap, and a new kind of developer career began.', 'mobile'],
    [2008, 'stackoverflow', 'Stack Overflow', 'Questions, voted answers and a green check mark. The place every developer lands after pasting an error message into a search box.', 'mobile'],
    [2008, 'chrome', 'Google Chrome', 'A minimal browser with one box for addresses and searches, and every tab in its own process. Introduced with a comic book.', 'mobile'],
    [2009, 'genesis', 'Bitcoin genesis block', 'The first block of the Bitcoin blockchain carried a newspaper headline about bank bailouts. Shown here as a piece of history only, not as an investment.', 'mobile'],
    [2009, 'minecraft', 'Minecraft alpha', 'A tiny indie game about placing and breaking blocks. People built castles, computers and whole cities, one cube at a time.', 'mobile'],
    [2009, 'nodejs', 'Node.js', 'JavaScript left the browser and moved to the server. Suddenly front-end developers could ship a back end over the weekend.', 'mobile'],
    [2010, 'instagram', 'Instagram\'s first photo', 'A dog near a taco stand, posted in a square frame. Vintage filters made quick phone snapshots look like old film.', 'mobile'],
    [2012, 'gangnam', 'One billion views', 'A K-pop music video and its horse-riding dance became the first video to pass one billion views.', 'mobile'],
    [2013, 'slack', 'Slack', 'Team chat with channels, emoji reactions and integrations. Email inboxes got lighter, notification badges got heavier.', 'mobile'],
    [2013, 'react', 'React', 'A library that redraws the screen from data, with HTML-like syntax inside JavaScript. Controversial at launch, everywhere a few years later.', 'mobile'],
    [2014, 'icebucket', 'Ice Bucket Challenge', 'Film yourself under a bucket of ice water, nominate three friends. The chain raised awareness and funds for ALS research.', 'mobile'],
    [2015, 'dress', 'The Dress', 'A washed-out photo of a striped dress split the internet: blue and black, or white and gold? Scientists studied it too.', 'mobile'],
    [2015, 'vscode', 'Visual Studio Code', 'A free, lightweight code editor built with web technology, with extensions for every language. Within a few years it was the editor most developers used.', 'mobile'],
    [2016, 'pokemongo', 'Pokemon GO', 'An augmented reality game sent millions of players walking around parks and streets, phone in hand, looking for creatures.', 'modern'],
    [2017, 'fortnite', 'Fortnite Battle Royale', 'A free battle royale with building and dance emotes that doubled as a hangout and a stage for virtual concerts.', 'modern'],
    [2020, 'amongus', 'Among Us', 'A small 2018 game exploded during the 2020 lockdowns: friends on a call, trying to find the impostor on a spaceship.', 'modern'],
    [2021, 'wordle', 'Wordle', 'One five-letter word per day, six tries and a shareable grid of colored squares. A tiny game made as a gift became a daily ritual.', 'modern'],
    [2021, 'copilot', 'GitHub Copilot', 'An AI pair programmer that suggests whole lines and functions right inside the editor.', 'modern'],
    [2022, 'chatgpt', 'ChatGPT', 'A conversational AI that answers in plain language. It reached about 100 million users in two months.', 'modern'],
    [2026, 'here', 'You are here', 'Shared 3D worlds where developers meet, build and play together. You are standing inside the newest exhibit.', 'modern']
  ];

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Classic 90s browser window; returns the top of the page area
  function oldBrowser(ctx, w, h, title, url, page = '#ffffff') {
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000080'; ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.fillText(title, 8, 17);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(6, 30, w - 12, 22);
    ctx.fillStyle = '#000000'; ctx.font = '13px Arial'; ctx.fillText(`Location: ${url}`, 12, 46);
    ctx.fillStyle = page; ctx.fillRect(6, 58, w - 12, h - 64);
    return 58;
  }

  // Modern browser window with a rounded address bar
  function newBrowser(ctx, w, h, url, page = '#ffffff') {
    ctx.fillStyle = '#dee2e6'; ctx.fillRect(0, 0, w, h);
    ['#ff6b6b', '#fcc419', '#51cf66'].forEach((color, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(18 + i * 18, 18, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#ffffff'; roundRect(ctx, 80, 7, w - 100, 22, 11); ctx.fill();
    ctx.fillStyle = '#495057'; ctx.font = '13px Arial'; ctx.fillText(url, 94, 23);
    ctx.fillStyle = page; ctx.fillRect(0, 36, w, h - 36);
    return 36;
  }

  // Video player with a progress bar
  function videoPlayer(ctx, x, y, vw, vh, progress = 0.35) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, vw, vh);
    ctx.fillStyle = '#333333'; ctx.fillRect(x, y + vh - 14, vw, 14);
    ctx.fillStyle = '#e03131'; ctx.fillRect(x, y + vh - 14, vw * progress, 4);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 8, y + vh - 11); ctx.lineTo(x + 8, y + vh - 3); ctx.lineTo(x + 15, y + vh - 7); ctx.fill();
  }

  // Smartphone outline; returns the screen rectangle
  function phoneOutline(ctx, cx, cy, pw, ph) {
    ctx.fillStyle = '#111111'; roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 22); ctx.fill();
    ctx.strokeStyle = '#868e96'; ctx.lineWidth = 3; ctx.stroke();
    return [cx - pw / 2 + 10, cy - ph / 2 + 34, pw - 20, ph - 70];
  }

  const ARTIFACT_DRAWINGS = {
    lo(ctx, w, h) {
      ctx.fillStyle = '#0b0f0b'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9dff9d'; ctx.font = '22px Courier New, monospace';
      ['UCLA HOST 1  ->  SRI HOST 2', '29 OCT 1969  22:30', '', '> L', '  SRI: GOT THE L', '> O', '  SRI: GOT THE O', '> G'].forEach((line, i) => ctx.fillText(line, 24, 40 + i * 30));
      ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 26px Courier New, monospace'; ctx.fillText('*** SYSTEM CRASH ***', 24, 290);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 86px Georgia, serif'; ctx.fillText('LO', 360, 140);
      ctx.strokeStyle = '#9dff9d'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#9dff9d'; ctx.font = '16px Courier New'; ctx.fillText('IMP #1 ======== 50 kbit/s ======== IMP #2', 24, 350);
    },
    email(ctx, w, h) {
      ctx.fillStyle = '#efe6cf'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; for (let y = 0; y < h; y += 28) ctx.fillRect(0, y, w, 14);
      [20, w - 32].forEach((x) => { for (let y = 16; y < h; y += 28) { ctx.fillStyle = '#d6cbb0'; ctx.beginPath(); ctx.arc(x + 6, y, 6, 0, Math.PI * 2); ctx.fill(); } });
      ctx.fillStyle = '#222222'; ctx.font = '20px Courier New, monospace';
      ['TENEX MAIL', '', 'TO: TOMLINSON@BBN-TENEXB', 'FROM: TOMLINSON@BBN-TENEXA', '', 'QWERTYUIOP', '', '(SOMETHING LIKE THAT)'].forEach((line, i) => ctx.fillText(line, 50, 40 + i * 30));
      ctx.fillStyle = '#1864ab'; ctx.font = 'bold 120px Georgia, serif'; ctx.fillText('@', 360, 330);
    },
    smiley(ctx, w, h) {
      ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#212529'; ctx.font = '17px Courier New, monospace';
      ['19-Sep-82 11:44   Scott E Fahlman', 'Subject: joke markers', '', 'I propose the following character', 'sequence for joke markers:', '', '        :-)', '', 'Read it sideways.'].forEach((line, i) => ctx.fillText(line, 20, 34 + i * 26));
      ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(400, 270, 80, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#212529'; ctx.lineWidth = 6; ctx.stroke();
      ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.arc(372, 245, 9, 0, Math.PI * 2); ctx.arc(428, 245, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(400, 275, 44, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    },
    symbolics(ctx, w, h) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffb000'; ctx.font = '19px Courier New, monospace';
      ['$ whois symbolics.com', '', '   Domain Name: SYMBOLICS.COM', '   Created:     15-Mar-1985', '   Registrant:  Symbolics Inc.', '   Note:        first .com ever', '', '$ count *.com', '   6'].forEach((line, i) => ctx.fillText(line, 20, 40 + i * 30));
      ctx.font = 'bold 58px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText('.com', 330, 340);
    },
    coffeepot(ctx, w, h) {
      ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00007a'; ctx.fillRect(0, 0, w, 22);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'; ctx.fillText('XCoffee - Trojan Room camera', 8, 16);
      // A grainy grayscale "webcam" frame drawn in big pixels
      const size = 8;
      for (let y = 30; y < h - 30; y += size) {
        for (let x = 60; x < w - 60; x += size) {
          const dx = (x - 256) / 70;
          const dy = (y - 210) / 110;
          const inPot = dx * dx + dy * dy < 1 && y > 130;
          const coffee = inPot && y > 230;
          const handle = Math.abs(x - 340) < 12 && y > 150 && y < 260;
          const base = coffee ? 40 : inPot ? 170 : handle ? 60 : y > 300 ? 110 : 140;
          const value = Math.max(0, Math.min(255, base + ((x * 7 + y * 13) % 31) - 15));
          ctx.fillStyle = `rgb(${value}, ${value}, ${value})`; ctx.fillRect(x, y, size, size);
        }
      }
      ctx.fillStyle = '#000000'; ctx.font = '14px Courier New'; ctx.fillText('frame 128x128  grayscale  refresh: 1/sec', 60, h - 10);
    },
    dog(ctx, w, h) {
      ctx.fillStyle = '#fff9db'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#495057'; roundRect(ctx, 96, 40, 320, 230, 14); ctx.fill();
      ctx.fillStyle = '#e7f5ff'; ctx.fillRect(116, 60, 280, 190);
      ctx.fillStyle = '#212529'; ctx.font = '16px Courier New';
      ['> hello? who is this?', '< just a regular person', '< trust me', '', '> ...'].forEach((line, i) => ctx.fillText(line, 128, 90 + i * 28));
      ctx.fillStyle = '#868e96'; ctx.fillRect(220, 270, 72, 30); ctx.fillRect(180, 300, 152, 12);
      ctx.fillStyle = '#e8590c'; ctx.font = 'bold 120px Georgia'; ctx.fillText('?', 430, 200);
      ctx.fillStyle = '#495057'; ctx.font = 'italic 20px Georgia'; ctx.fillText('Online, anyone can be anyone.', 110, 350);
    },
    yahoo(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Guide to the World Wide Web', 'http://akebono.stanford.edu/');
      ctx.fillStyle = '#7b2cbf'; ctx.font = 'bold 34px Times New Roman'; ctx.fillText('Yahoo!', 24, top + 40);
      ctx.fillStyle = '#000000'; ctx.font = '14px Times New Roman'; ctx.fillText('A hand-made list of sites, sorted by topic', 150, top + 36);
      const topics = ['Art', 'Business', 'Computers', 'Economy', 'Education', 'Entertainment', 'Government', 'Health', 'News', 'Recreation', 'Science', 'Society'];
      topics.forEach((topic, i) => { ctx.fillStyle = '#0000ee'; ctx.font = 'bold 17px Times New Roman'; ctx.fillText(`${topic} (${(i * 37) % 90 + 12})`, 30 + (i % 2) * 230, top + 80 + Math.floor(i / 2) * 40); });
    },
    amazon(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Online Bookstore', 'http://www.amazon.com/', '#ffffff');
      ctx.fillStyle = '#1c7ed6'; ctx.fillRect(16, top + 10, 110, 70);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Times New Roman'; ctx.fillText('AMAZON', 32, top + 50);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Times New Roman'; ctx.fillText('Earth\'s Biggest Bookstore', 140, top + 40);
      ctx.font = '15px Times New Roman'; ctx.fillText('One million titles, consistently low prices.', 140, top + 64);
      ['Search our catalog', 'Spotlight: new arrivals', 'Gift certificates'].forEach((item, i) => { ctx.fillStyle = '#0000ee'; ctx.fillText(item, 30, top + 120 + i * 30); });
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#c92a2a', '#2b8a3e', '#5f3dc4', '#e67700'][i]; ctx.fillRect(280 + i * 50, top + 110, 38, 120); }
      ctx.fillStyle = '#555555'; ctx.font = '12px Arial'; ctx.fillText('ding! (one more order)', 290, top + 260);
    },
    ebay(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'AuctionWeb', 'http://www.ebay.com/aw/', '#ffffff');
      ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Times New Roman'; ctx.fillText('AuctionWeb: Item #1004', 20, top + 34);
      ctx.fillStyle = '#e9ecef'; ctx.fillRect(20, top + 50, 180, 140);
      ctx.fillStyle = '#343a40'; ctx.save(); ctx.translate(110, top + 120); ctx.rotate(-0.35); ctx.fillRect(-70, -8, 140, 16); ctx.fillStyle = '#c92a2a'; ctx.fillRect(66, -5, 10, 10); ctx.restore();
      ctx.strokeStyle = '#000000'; ctx.beginPath(); ctx.moveTo(90, top + 100); ctx.lineTo(120, top + 140); ctx.stroke();
      ctx.font = '16px Times New Roman'; ['Laser pointer', 'Condition: BROKEN', 'Bids: 3', 'Ends: today'].forEach((line, i) => ctx.fillText(line, 220, top + 70 + i * 26));
      ctx.fillStyle = '#2b8a3e'; ctx.font = 'bold 30px Arial'; ctx.fillText('$14.83', 220, top + 200);
      ctx.save(); ctx.translate(370, top + 220); ctx.rotate(-0.25); ctx.strokeStyle = '#c92a2a'; ctx.lineWidth = 5; ctx.strokeRect(-70, -26, 140, 52); ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 34px Arial'; ctx.fillText('SOLD', -44, 12); ctx.restore();
    },
    spacejam(ctx, w, h) {
      ctx.fillStyle = '#05051a'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) { ctx.fillStyle = i % 9 ? '#ffffff' : '#ffd43b'; ctx.fillRect((i * 97) % w, (i * 61) % h, i % 5 ? 1 : 2, i % 5 ? 1 : 2); }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.beginPath(); ctx.ellipse(256, 192, 200, 120, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(256, 192, 52, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(204, 192); ctx.lineTo(308, 192); ctx.moveTo(256, 140); ctx.lineTo(256, 244); ctx.stroke();
      const planets = [[90, 110, '#4dabf7', 'PRESS'], [430, 90, '#be4bdb', 'GAMES'], [440, 290, '#69db7c', 'JAM'], [80, 290, '#ffa94d', 'STARS'], [256, 60, '#ff6b6b', 'SITE MAP'], [256, 340, '#ffd43b', 'CREDITS']];
      planets.forEach(([x, y, color, name]) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Arial'; ctx.fillText(name, x - ctx.measureText(name).width / 2, y + 42); });
    },
    hotmail(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Free Web-Based Email', 'http://www.hotmail.com/', '#ffffff');
      ctx.fillStyle = '#e8590c'; ctx.font = 'bold 40px Arial'; ctx.fillText('HoTMaiL', 30, top + 56);
      ctx.fillStyle = '#000000'; ctx.font = '16px Arial'; ctx.fillText('The world\'s free web-based email', 30, top + 84);
      ctx.fillStyle = '#f1f3f5'; ctx.fillRect(30, top + 110, 250, 150);
      ctx.fillStyle = '#000000'; ctx.font = '14px Arial'; ctx.fillText('Login Name', 44, top + 140); ctx.fillText('Password', 44, top + 190);
      ctx.strokeRect(44, top + 148, 220, 22); ctx.strokeRect(44, top + 198, 220, 22);
      ctx.fillStyle = '#adb5bd'; ctx.fillRect(44, top + 228, 70, 22); ctx.fillStyle = '#000000'; ctx.fillText('Enter', 58, top + 244);
      ctx.fillStyle = '#1c7ed6'; ctx.font = 'italic 14px Arial'; ['P.S. Get your free', 'email at Hotmail'].forEach((line, i) => ctx.fillText(line, 310, top + 160 + i * 22));
    },
    hampster(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c2255c'; ctx.font = 'bold 24px Comic Sans MS, cursive'; ctx.fillText('Welcome to the Hamster Dance!', 70, 36);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
          const x = 30 + col * 80;
          const y = 70 + row * 74;
          const lean = (row + col) % 2 ? 6 : -6;
          ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.ellipse(x + 28, y + 34, 22, 26, lean * 0.03, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f5deb3'; ctx.beginPath(); ctx.ellipse(x + 28, y + 40, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.arc(x + 14 + lean, y + 10, 7, 0, Math.PI * 2); ctx.arc(x + 42 + lean, y + 10, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000000'; ctx.fillRect(x + 20, y + 22, 4, 4); ctx.fillRect(x + 32, y + 22, 4, 4);
          ctx.fillStyle = '#d9a066'; ctx.fillRect(x + 4 + lean, y + 26 - lean, 8, 4); ctx.fillRect(x + 44 + lean, y + 26 + lean, 8, 4);
        }
      }
      ctx.fillStyle = '#5c940d'; ctx.font = '14px Courier New'; ctx.fillText('(midi loop playing...)  visitors: 0017238', 80, h - 12);
    },
    napster(ctx, w, h) {
      ctx.fillStyle = '#3d3d3d'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, 44);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial'; ctx.fillText('napster', 20, 31);
      ctx.fillStyle = '#adb5bd'; ctx.font = '13px Arial'; ctx.fillText('Search  |  Hot List  |  Transfer  |  Chat', 150, 28);
      ctx.fillStyle = '#d0d0d0'; ctx.fillRect(14, 58, w - 28, 26);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 13px Arial'; ['Filename', 'Size', 'Bitrate', 'User'].forEach((head, i) => ctx.fillText(head, 22 + [0, 230, 300, 380][i], 76));
      ['band - track01.mp3', 'garage demo.mp3', 'live in 1998.mp3', 'unknown artist.mp3', 'cover song (rare).mp3'].forEach((file, i) => {
        ctx.fillStyle = i % 2 ? '#4a4a4a' : '#555555'; ctx.fillRect(14, 88 + i * 30, w - 28, 30);
        ctx.fillStyle = '#ffffff'; ctx.font = '13px Arial'; ctx.fillText(file, 22, 108 + i * 30); ctx.fillText(`${3 + i}.${i * 3} MB`, 252, 108 + i * 30); ctx.fillText('128', 322, 108 + i * 30); ctx.fillText(`user${i * 41 + 7}`, 402, 108 + i * 30);
      });
      ctx.fillStyle = '#ffffff'; ctx.fillText('Downloading 2 of 5', 22, 270);
      ctx.fillStyle = '#222222'; ctx.fillRect(22, 284, w - 44, 22); ctx.fillStyle = '#40c057'; ctx.fillRect(22, 284, (w - 44) * 0.62, 22);
      ctx.fillStyle = '#ffffff'; ctx.fillText('56k modem: 4.2 KB/s, 11 minutes left', 22, 336);
    },
    dotcomcrash(ctx, w, h) {
      ctx.fillStyle = '#0b1e33'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1;
      for (let x = 40; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke(); }
      for (let y = 40; y < h - 30; y += 40) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 20, y); ctx.stroke(); }
      const points = [[40, 300], [90, 290], [140, 270], [190, 250], [230, 200], [260, 150], [290, 70], [310, 110], [340, 190], [380, 250], [420, 280], [470, 300]];
      ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 4; ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText('TECH STOCK INDEX', 40, 30);
      ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 16px Arial'; ctx.fillText('peak: March 2000', 300, 64);
      ctx.fillStyle = '#adb5bd'; ctx.font = '14px Arial'; ['1995', '1997', '1999', '2001', '2002'].forEach((year, i) => ctx.fillText(year, 40 + i * 100, h - 16));
      ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 18px Courier New'; ctx.fillText('pets.example  -98%', 300, 330);
    },
    wikipedia(ctx, w, h) {
      const top = newBrowser(ctx, w, h, 'en.wikipedia.org/wiki/Main_Page');
      ctx.fillStyle = '#ced4da'; ctx.beginPath(); ctx.arc(80, top + 70, 50, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#495057'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(80, top + 70, Math.abs(i) * 12 + 4, 50, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(30, top + 70 + i * 18); ctx.lineTo(130, top + 70 + i * 18); ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(98, top + 20, 32, 30);
      ctx.fillStyle = '#000000'; ctx.font = '30px Georgia, serif'; ctx.fillText('WIKIPEDIA', 160, top + 70);
      ctx.font = 'italic 16px Georgia'; ctx.fillText('The Free Encyclopedia', 160, top + 96);
      ctx.fillStyle = '#868e96'; for (let i = 0; i < 6; i++) ctx.fillRect(30, top + 150 + i * 26, 300 + ((i * 53) % 140), 10);
      ctx.fillStyle = '#3366cc'; ctx.font = '15px Arial'; ctx.fillText('[edit]', 420, top + 160); ctx.fillText('[citation needed]', 360, top + 290);
    },
    friendster(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Friendster - profile', 'http://www.friendster.com/', '#f3f0ff');
      ctx.fillStyle = '#5f3dc4'; ctx.font = 'bold 28px Arial'; ctx.fillText('friendster', 20, top + 40);
      ctx.fillStyle = '#adb5bd'; ctx.fillRect(20, top + 60, 120, 140);
      ctx.fillStyle = '#495057'; ctx.beginPath(); ctx.arc(80, top + 110, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(48, top + 140, 64, 60);
      ctx.fillStyle = '#000000'; ctx.font = '15px Arial'; ['Who I want to meet: everyone', 'Status: online', 'Testimonials (4)', 'Friends of friends: 2,341'].forEach((line, i) => ctx.fillText(line, 160, top + 80 + i * 28));
      for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ffa8a8', '#a5d8ff', '#b2f2bb', '#ffec99', '#d0bfff', '#ffd8a8'][i]; ctx.fillRect(160 + i * 52, top + 210, 44, 44); }
      ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 13px Arial'; ctx.fillText('Server busy, please try again...', 160, top + 290);
    },
    myspace(ctx, w, h) {
      ctx.fillStyle = '#1a0026'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { ctx.fillStyle = ['#ff8cc6', '#ffffff', '#c0eb75'][i % 3]; ctx.fillRect((i * 71) % w, (i * 37) % h, 2, 2); }
      ctx.fillStyle = '#ff8cc6'; ctx.font = 'bold 26px Comic Sans MS, cursive'; ctx.fillText('~xX my profile Xx~', 30, 40);
      ctx.fillStyle = '#ffffff'; ctx.font = '14px Verdana'; ctx.fillText('Mood: creative   Online now!', 30, 64);
      ctx.fillStyle = '#343a40'; ctx.fillRect(30, 80, 200, 40); ctx.fillStyle = '#c0eb75'; ctx.fillRect(40, 96, 120, 8); ctx.fillStyle = '#ffffff'; ctx.font = '12px Verdana'; ctx.fillText('now playing', 40, 116);
      ctx.fillStyle = '#ff8cc6'; ctx.font = 'bold 18px Verdana'; ctx.fillText('My Top 8', 260, 100);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = ['#ffa8a8', '#a5d8ff', '#b2f2bb', '#ffec99', '#d0bfff', '#ffd8a8', '#99e9f2', '#eebefa'][i]; ctx.fillRect(260 + (i % 4) * 58, 116 + Math.floor(i / 4) * 64, 50, 50); ctx.fillStyle = '#ffffff'; ctx.font = '10px Verdana'; ctx.fillText(`#${i + 1}`, 262 + (i % 4) * 58, 178 + Math.floor(i / 4) * 64); }
      ctx.fillStyle = '#ffffff'; ctx.font = '13px Verdana'; ['About me: I learned HTML', 'to make this page sparkle.', 'Thanks 4 the add!!'].forEach((line, i) => ctx.fillText(line, 30, 160 + i * 22));
      ctx.fillStyle = '#ff8cc6'; ctx.fillText('<marquee>welcome</marquee>', 30, 330);
    },
    gmail(ctx, w, h) {
      const top = newBrowser(ctx, w, h, 'mail.google.com');
      ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 30px Arial'; ctx.fillText('Gmail', 20, top + 40);
      ctx.fillStyle = '#868e96'; ctx.font = '12px Arial'; ctx.fillText('BETA', 112, top + 26);
      ctx.fillStyle = '#e7f5ff'; ctx.fillRect(160, top + 16, 330, 32); ctx.fillStyle = '#1864ab'; ctx.font = 'bold 14px Arial'; ctx.fillText('1 GB of storage: stop deleting!', 176, top + 37);
      ['Inbox (3)', 'Starred', 'Sent Mail', 'Drafts', 'All Mail'].forEach((item, i) => { ctx.fillStyle = i ? '#1c7ed6' : '#000000'; ctx.font = i ? '14px Arial' : 'bold 14px Arial'; ctx.fillText(item, 20, top + 90 + i * 28); });
      ['You have been invited to Gmail', 'Re: can I get an invite?', 'Conversation view is great'].forEach((line, i) => { ctx.fillStyle = i % 2 ? '#ffffff' : '#f1f3f5'; ctx.fillRect(130, top + 70 + i * 40, 370, 36); ctx.fillStyle = '#000000'; ctx.font = 'bold 13px Arial'; ctx.fillText(line, 140, top + 93 + i * 40); });
      ctx.fillStyle = '#2b8a3e'; ctx.font = '13px Arial'; ctx.fillText('You are currently using 0 MB (0%) of your 1000 MB.', 130, top + 230);
    },
    tweet(ctx, w, h) {
      ctx.fillStyle = '#e7f5ff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 40, 70, w - 80, 220, 18); ctx.fill();
      ctx.strokeStyle = '#a5d8ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#74c0fc'; ctx.beginPath(); ctx.arc(90, 120, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.font = 'bold 18px Arial'; ctx.fillText('jack', 132, 114);
      ctx.fillStyle = '#868e96'; ctx.font = '15px Arial'; ctx.fillText('@jack', 132, 136);
      ctx.fillStyle = '#000000'; ctx.font = '28px Arial'; ctx.fillText('just setting up my twttr', 64, 200);
      ctx.fillStyle = '#868e96'; ctx.font = '14px Arial'; ctx.fillText('9:50 PM - 21 Mar 2006', 64, 250);
      ctx.fillStyle = '#1c7ed6'; ctx.font = 'bold 22px Arial'; ctx.fillText('twttr', 40, 40);
    },
    iphone(ctx, w, h) {
      ctx.fillStyle = '#1b1b1f'; ctx.fillRect(0, 0, w, h);
      const [sx, sy, sw, sh] = phoneOutline(ctx, 256, 192, 190, 360);
      const sky = ctx.createLinearGradient(0, sy, 0, sy + sh); sky.addColorStop(0, '#1c3d6e'); sky.addColorStop(1, '#0b1a33');
      ctx.fillStyle = sky; ctx.fillRect(sx, sy, sw, sh);
      const colors = ['#51cf66', '#339af0', '#fcc419', '#ff6b6b', '#ffffff', '#845ef7', '#20c997', '#fd7e14', '#e64980', '#868e96', '#94d82d', '#15aabf'];
      colors.forEach((color, i) => { ctx.fillStyle = color; roundRect(ctx, sx + 12 + (i % 4) * 40, sy + 14 + Math.floor(i / 4) * 52, 30, 30, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(sx, sy + sh - 48, sw, 48);
      ctx.strokeStyle = '#868e96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(256, 192 + 162, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial'; ctx.fillText('slide to unlock', 40, 40);
    },
    charlie(ctx, w, h) {
      ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, w, h);
      videoPlayer(ctx, 30, 30, 452, 260, 0.55);
      ctx.fillStyle = '#d8c3a5'; ctx.fillRect(30, 30, 452, 246);
      ctx.fillStyle = '#c3a789'; ctx.fillRect(30, 180, 452, 96);
      // Two simple figures on a sofa (big brother and the baby), soft home-video colors
      ctx.fillStyle = '#4c6ef5'; ctx.fillRect(140, 150, 90, 110); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(185, 120, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(290, 190, 70, 70); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(325, 168, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1c27d'; ctx.fillRect(225, 170, 75, 12);
      ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 22px Comic Sans MS, cursive'; ctx.fillText('ouch!', 230, 150);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 16px Arial'; ctx.fillText('Charlie bit my finger - again !', 30, 318);
      ctx.fillStyle = '#868e96'; ctx.font = '13px Arial'; ctx.fillText('0:56  ·  a family home video', 30, 340);
    },
    chipmunk(ctx, w, h) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
      const frames = [[16, 0.6], [180, 0.85], [344, 1.15]];
      frames.forEach(([x, zoom]) => {
        ctx.save(); ctx.beginPath(); ctx.rect(x, 60, 152, 220); ctx.clip();
        ctx.fillStyle = '#6b8e23'; ctx.fillRect(x, 60, 152, 220);
        ctx.translate(x + 76, 190); ctx.scale(zoom, zoom);
        ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.ellipse(0, 30, 50, 60, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -40, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5deb3'; ctx.beginPath(); ctx.ellipse(0, -28, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(-15, -50, 6, 0, Math.PI * 2); ctx.arc(15, -50, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px Georgia'; ctx.fillText('dun  dun  DUNNN', 140, 40);
      ctx.font = '14px Arial'; ctx.fillText('0:05   ·   the most dramatic head turn ever filmed', 40, 320);
    },
    rickroll(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0000ee'; ctx.font = 'underline 18px Arial'; ctx.fillText('>> EXCLUSIVE: leaked game trailer (click)', 20, 32);
      ctx.fillRect(20, 36, 370, 1);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(380, 40); ctx.lineTo(400, 70); ctx.lineTo(392, 72); ctx.stroke();
      videoPlayer(ctx, 30, 80, 452, 230, 0.12);
      ctx.fillStyle = '#ff922b'; ctx.fillRect(30, 80, 452, 216);
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(220, 140, 70, 130); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(255, 122, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(255, 104, 26, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px Georgia'; ctx.fillText('♪', 90, 170); ctx.fillText('♫', 380, 210);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 16px Arial'; ctx.fillText('You just got rickrolled (1987 music video)', 30, 345);
    },
    github(ctx, w, h) {
      const top = newBrowser(ctx, w, h, 'github.com/you/hello-world', '#0d1117');
      ctx.fillStyle = '#c9d1d9'; ctx.font = 'bold 20px Arial'; ctx.fillText('you / hello-world', 20, top + 36);
      ['Code', 'Issues 3', 'Pull requests 1', 'Network'].forEach((tab, i) => { ctx.fillStyle = i ? '#8b949e' : '#f78166'; ctx.font = '14px Arial'; ctx.fillText(tab, 20 + i * 100, top + 66); });
      ctx.fillStyle = '#161b22'; ctx.fillRect(16, top + 80, w - 32, 150);
      ctx.fillStyle = '#c9d1d9'; ctx.font = '14px Courier New'; ['README.md      Initial commit', 'index.js       Add hello world', '.gitignore     node_modules'].forEach((line, i) => ctx.fillText(line, 28, top + 110 + i * 30));
      ctx.fillStyle = '#238636'; roundRect(ctx, 360, top + 20, 120, 30, 6); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'; ctx.fillText('Fork  |  Star', 376, top + 40);
      ctx.fillStyle = '#7ee787'; ctx.font = '15px Courier New'; ctx.fillText('$ git push origin main', 20, top + 280);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'][(i * 7) % 5]; ctx.fillRect(20 + i * 12, top + 300, 10, 10); }
    },
    stackoverflow(ctx, w, h) {
      const top = newBrowser(ctx, w, h, 'stackoverflow.com/questions/...');
      ctx.fillStyle = '#f48024'; ctx.fillRect(20, top + 14, 6, 26); ctx.fillStyle = '#222222'; ctx.font = 'bold 20px Arial'; ctx.fillText('stack overflow', 34, top + 34);
      ctx.fillStyle = '#0a58ca'; ctx.font = 'bold 18px Arial'; ctx.fillText('How do I undo the most recent commit?', 20, top + 76);
      ctx.fillStyle = '#495057'; ctx.font = 'bold 26px Arial'; ctx.fillText('▲', 30, top + 130); ctx.fillText('2187', 16, top + 162); ctx.fillText('▼', 30, top + 192);
      ctx.fillStyle = '#2f9e44'; ctx.font = 'bold 40px Arial'; ctx.fillText('✓', 26, top + 240);
      ctx.fillStyle = '#f1f3f5'; ctx.fillRect(100, top + 110, 390, 70); ctx.fillStyle = '#212529'; ctx.font = '15px Courier New'; ctx.fillText('git reset --soft HEAD~1', 112, top + 152);
      ctx.fillStyle = '#868e96'; for (let i = 0; i < 4; i++) ctx.fillRect(100, top + 200 + i * 22, 300 - i * 40, 9);
      ctx.fillStyle = '#868e96'; ctx.font = '12px Arial'; ctx.fillText('answered by a stranger who saved your day', 100, top + 300);
    },
    genesis(ctx, w, h) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f59f00'; ctx.font = 'bold 22px Courier New'; ctx.fillText('BLOCK #0  (genesis)', 24, 40);
      ctx.fillStyle = '#ced4da'; ctx.font = '15px Courier New';
      for (let i = 0; i < 7; i++) {
        let line = '';
        for (let j = 0; j < 16; j++) line += ((i * 31 + j * 17) % 256).toString(16).padStart(2, '0') + ' ';
        ctx.fillText(line.trim(), 24, 80 + i * 24);
      }
      ctx.fillStyle = '#fff3bf'; ctx.fillRect(24, 260, 464, 70);
      ctx.fillStyle = '#212529'; ctx.font = 'bold 14px Georgia'; ['The Times 03/Jan/2009 Chancellor on brink', 'of second bailout for banks'].forEach((line, i) => ctx.fillText(line, 36, 288 + i * 22));
      ctx.fillStyle = '#868e96'; ctx.font = '12px Arial'; ctx.fillText('history exhibit only - no tokens, no wallets', 24, 360);
    },
    instagram(ctx, w, h) {
      ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(106, 14, 300, 356);
      ctx.strokeStyle = '#dee2e6'; ctx.strokeRect(106, 14, 300, 356);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 13px Arial'; ctx.fillText('kevin', 120, 36);
      const photo = ctx.createLinearGradient(0, 50, 0, 330); photo.addColorStop(0, '#f3d9a4'); photo.addColorStop(1, '#a87f4f');
      ctx.fillStyle = photo; ctx.fillRect(116, 48, 280, 280);
      ctx.fillStyle = '#7a4f2a'; ctx.fillRect(260, 100, 120, 110); ctx.fillStyle = '#c92a2a'; ctx.fillRect(250, 90, 140, 20); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'; ctx.fillText('TACOS', 290, 104);
      ctx.fillStyle = '#e2b670'; ctx.beginPath(); ctx.ellipse(190, 270, 54, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(160, 222, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(152, 216, 3, 0, Math.PI * 2); ctx.fill();
      const vignette = ctx.createRadialGradient(256, 188, 60, 256, 188, 200); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(60,30,0,0.55)');
      ctx.fillStyle = vignette; ctx.fillRect(116, 48, 280, 280);
      ctx.fillStyle = '#000000'; ctx.font = '12px Arial'; ctx.fillText('test  ·  filter: vintage', 120, 352);
    },
    gangnam(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      videoPlayer(ctx, 30, 20, 452, 250, 0.7);
      const sky = ctx.createLinearGradient(0, 20, 0, 256); sky.addColorStop(0, '#74c0fc'); sky.addColorStop(1, '#ffe066');
      ctx.fillStyle = sky; ctx.fillRect(30, 20, 452, 236);
      ctx.fillStyle = '#1c1c1c'; ctx.fillRect(228, 110, 56, 100); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(256, 92, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c1c1c'; ctx.fillRect(200, 130, 30, 12); ctx.fillRect(282, 130, 30, 12); ctx.fillRect(232, 210, 16, 40); ctx.fillRect(264, 210, 16, 30);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 34px Arial'; ctx.fillText('1,000,000,000 views', 40, 316);
      ctx.fillStyle = '#868e96'; ctx.font = '14px Arial'; ctx.fillText('first video to cross one billion  ·  December 2012', 40, 346);
    },
    icebucket(ctx, w, h) {
      ctx.fillStyle = '#d0ebff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8ce99a'; ctx.fillRect(0, 290, w, 94);
      ctx.save(); ctx.translate(250, 90); ctx.rotate(2.4);
      ctx.fillStyle = '#adb5bd'; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(40, -40); ctx.lineTo(30, 40); ctx.lineTo(-30, 40); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(77, 171, 247, 0.75)'; ctx.beginPath(); ctx.moveTo(220, 110); ctx.quadraticCurveTo(190, 200, 210, 260); ctx.lineTo(320, 260); ctx.quadraticCurveTo(320, 180, 280, 110); ctx.fill();
      for (let i = 0; i < 8; i++) { ctx.fillStyle = '#e7f5ff'; ctx.fillRect(210 + (i * 37) % 100, 140 + (i * 23) % 100, 14, 14); }
      ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(265, 210, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#495057'; ctx.fillRect(235, 234, 60, 70);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Arial'; ctx.fillText('I nominate... you!', 30, 40);
      ctx.fillStyle = '#c92a2a'; ctx.beginPath(); ctx.arc(470, 36, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000000'; ctx.font = '13px Arial'; ctx.fillText('REC', 420, 41);
    },
    dress(ctx, w, h) {
      ctx.fillStyle = '#f1f3f5'; ctx.fillRect(0, 0, w, h);
      const drawDress = (offset, body, stripe) => {
        ctx.save(); ctx.beginPath(); ctx.rect(offset, 0, w / 2, h); ctx.clip();
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(206, 50); ctx.lineTo(306, 50); ctx.lineTo(296, 140); ctx.lineTo(356, 330); ctx.lineTo(156, 330); ctx.lineTo(216, 140); ctx.closePath(); ctx.fill();
        ctx.fillStyle = stripe; [80, 150, 210, 270].forEach((y) => ctx.fillRect(140, y, 232, 16));
        ctx.restore();
      };
      drawDress(0, '#3b5bdb', '#1b1b1b');
      drawDress(w / 2, '#f8f0e3', '#b8913a');
      ctx.fillStyle = '#212529'; ctx.fillRect(255, 20, 2, 330);
      ctx.font = 'bold 20px Arial'; ctx.fillText('blue & black?', 20, 370); ctx.fillText('white & gold?', 370, 370);
    },
    pokemongo(ctx, w, h) {
      ctx.fillStyle = '#212529'; ctx.fillRect(0, 0, w, h);
      const [sx, sy, sw, sh] = phoneOutline(ctx, 256, 192, 200, 370);
      ctx.fillStyle = '#8ce99a'; ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#fff3bf'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(sx, sy + 60); ctx.lineTo(sx + sw, sy + 140); ctx.moveTo(sx + 60, sy); ctx.lineTo(sx + 100, sy + sh); ctx.stroke();
      [[sx + 40, sy + 40, '#4dabf7'], [sx + 140, sy + 80, '#be4bdb'], [sx + 120, sy + 200, '#4dabf7']].forEach(([x, y, color]) => { ctx.fillStyle = color; ctx.fillRect(x - 4, y, 8, 22); ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh - 50, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff922b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh - 50, 32, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.fillText('go outside!', 20, 40); ctx.fillText('AR + GPS', 410, 40);
    },
    fortnite(ctx, w, h) {
      ctx.fillStyle = '#1864ab'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#69db7c'; ctx.beginPath(); ctx.moveTo(90, 80); ctx.lineTo(380, 50); ctx.lineTo(450, 200); ctx.lineTo(400, 330); ctx.lineTo(120, 340); ctx.lineTo(60, 200); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8f5a2'; ctx.fillRect(140, 140, 50, 40); ctx.fillRect(300, 220, 60, 46); ctx.fillStyle = '#c0eb75'; ctx.fillRect(220, 90, 40, 30);
      ctx.fillStyle = 'rgba(132, 94, 247, 0.35)'; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(260, 200, 120, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(260, 200, 120, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(20, 360); ctx.lineTo(492, 20); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px Arial'; ctx.fillText('THE STORM IS SHRINKING', 20, 32); ctx.fillText('100 players', 380, 370);
    },
    amongus(ctx, w, h) {
      ctx.fillStyle = '#0b0b1e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 34px Arial'; ctx.fillText('EMERGENCY MEETING', 70, 50);
      const players = [['#e03131', 'Red'], ['#1971c2', 'Blue'], ['#2f9e44', 'Green'], ['#f08c00', 'Orange'], ['#ae3ec9', 'Purple'], ['#fcc419', 'Yellow']];
      players.forEach(([color, name], i) => {
        const x = 40 + (i % 2) * 230;
        const y = 80 + Math.floor(i / 2) * 80;
        ctx.fillStyle = '#e9ecef'; ctx.fillRect(x, y, 210, 64);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + 32, y + 32, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000000'; ctx.font = 'bold 18px Arial'; ctx.fillText(name, x + 64, y + 38);
        if (i === 2) { ctx.fillStyle = '#c92a2a'; ctx.font = 'bold 14px Arial'; ctx.fillText('VOTED x3', x + 130, y + 38); }
      });
      ctx.fillStyle = '#ffffff'; ctx.font = '16px Arial'; ctx.fillText('"I saw Green near the reactor..."', 110, 350);
    },
    wordle(ctx, w, h) {
      ctx.fillStyle = '#121213'; ctx.fillRect(0, 0, w, h);
      const rows = [['gray', 'yellow', 'gray', 'gray', 'green'], ['green', 'gray', 'yellow', 'gray', 'green'], ['green', 'green', 'gray', 'green', 'green'], ['green', 'green', 'green', 'green', 'green']];
      const letters = ['CRANE', 'SPICE', 'SHORE', 'SHAPE'];
      const palette = { gray: '#3a3a3c', yellow: '#b59f3b', green: '#538d4e' };
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 5; c++) {
          const x = 136 + c * 50;
          const y = 30 + r * 50;
          if (rows[r]) { ctx.fillStyle = palette[rows[r][c]]; ctx.fillRect(x, y, 44, 44); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px Arial'; ctx.fillText(letters[r][c], x + 12, y + 32); } else { ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 44, 44); }
        }
      }
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial'; ctx.fillText('Daily word  4/6', 186, 350);
    },
    copilot(ctx, w, h) {
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#252526'; ctx.fillRect(0, 0, w, 30); ctx.fillStyle = '#ffffff'; ctx.font = '13px Arial'; ctx.fillText('sort.js', 16, 20);
      ctx.font = '16px Courier New';
      const code = [['#569cd6', 'function '], ['#dcdcaa', 'sortByStars'], ['#d4d4d4', '(repos) {']];
      let x = 20; code.forEach(([color, text]) => { ctx.fillStyle = color; ctx.fillText(text, x, 70); x += ctx.measureText(text).width; });
      ctx.fillStyle = 'rgba(212, 212, 212, 0.45)';
      ['  return [...repos]', '    .sort((a, b) => b.stars - a.stars);', '}'].forEach((line, i) => ctx.fillText(line, 20, 100 + i * 28));
      ctx.fillStyle = '#d4d4d4'; ctx.fillRect(20, 84, 2, 20);
      ctx.fillStyle = '#2d2d30'; roundRect(ctx, 260, 230, 230, 60, 8); ctx.fill();
      ctx.fillStyle = '#c586c0'; ctx.font = 'bold 14px Arial'; ctx.fillText('AI suggestion', 276, 254); ctx.fillStyle = '#d4d4d4'; ctx.font = '13px Arial'; ctx.fillText('Tab to accept  ·  Esc to dismiss', 276, 276);
    },
    chatgpt(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f1f3f5'; roundRect(ctx, 200, 30, 290, 54, 14); ctx.fill();
      ctx.fillStyle = '#212529'; ctx.font = '15px Arial'; ['Explain the internet to me', 'like I am five'].forEach((line, i) => ctx.fillText(line, 216, 52 + i * 20));
      ctx.fillStyle = '#10a37f'; ctx.beginPath(); ctx.arc(40, 120, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#212529'; ['Imagine millions of computers holding', 'hands and passing notes to each other.', 'Every note has an address, so it always', 'finds the right friend...'].forEach((line, i) => ctx.fillText(line, 66, 126 + i * 24));
      ctx.strokeStyle = '#ced4da'; roundRect(ctx, 20, 310, 472, 50, 25); ctx.stroke();
      ctx.fillStyle = '#868e96'; ctx.fillText('Message...', 44, 341);
      ctx.fillStyle = '#212529'; roundRect(ctx, 446, 320, 32, 32, 16); ctx.fill();
    },
    aol(ctx, w, h) {
      ctx.fillStyle = '#0b3d91'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(60, 60, w - 120, h - 120);
      ctx.fillStyle = '#000080'; ctx.fillRect(60, 60, w - 120, 24);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.fillText('Welcome!', 70, 77);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(110, 130, 120, 80); ctx.strokeStyle = '#8a6d00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(110, 130); ctx.lineTo(170, 175); ctx.lineTo(230, 130); ctx.stroke();
      ctx.fillStyle = '#000000'; ctx.font = 'bold 26px Arial'; ctx.fillText("You've got mail!", 250, 180);
      ctx.font = '14px Arial'; ctx.fillText('3 new messages', 260, 210);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText('ONLINE SERVICE · 1989', 120, 40);
    },
    modem(ctx, w, h) {
      ctx.fillStyle = '#1b1b1f'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d9d2c3'; ctx.fillRect(90, 200, 330, 70); ctx.fillStyle = '#b8b1a3'; ctx.fillRect(90, 260, 330, 10);
      ['HS', 'AA', 'CD', 'OH', 'RD', 'SD', 'TR', 'MR'].forEach((led, i) => { ctx.fillStyle = i % 3 ? '#e03131' : '#51cf66'; ctx.beginPath(); ctx.arc(130 + i * 36, 225, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.font = '10px Arial'; ctx.fillText(led, 122 + i * 36, 248); });
      ctx.strokeStyle = '#74c0fc'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 20; x < w - 20; x += 4) ctx.lineTo(x, 110 + Math.sin(x * 0.21) * 30 * Math.sin(x * 0.013) + ((x * 7) % 13) - 6);
      ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Courier New'; ctx.fillText('EEEE-KRRRR-BONG', 120, 50);
      ctx.font = '16px Courier New'; ctx.fillStyle = '#adb5bd'; ctx.fillText('CONNECT 28800 · do not pick up the phone', 60, 330);
    },
    netscape(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Netscape Navigator', 'http://home.netscape.com/');
      const sky = ctx.createLinearGradient(0, top, 0, top + 200); sky.addColorStop(0, '#081a4a'); sky.addColorStop(1, '#2b6cb0');
      ctx.fillStyle = sky; ctx.fillRect(330, top + 14, 150, 150);
      ctx.fillStyle = '#0b1f3a'; ctx.fillRect(330, top + 124, 150, 40);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 96px Times New Roman'; ctx.fillText('N', 365, top + 140);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(470, top + 24); ctx.lineTo(420, top + 70); ctx.stroke();
      ctx.fillStyle = '#000000'; ctx.font = 'bold 24px Times New Roman'; ctx.fillText('Welcome to Netscape', 20, top + 40);
      ctx.font = '15px Times New Roman'; ['What\'s New!', 'What\'s Cool!', 'Net Search', 'Net Directory'].forEach((link, i) => { ctx.fillStyle = '#0000ee'; ctx.fillText(link, 30, top + 80 + i * 30); });
      ctx.fillStyle = '#555555'; ctx.fillText('Document: Done', 20, h - 14);
    },
    icq(ctx, w, h) {
      ctx.fillStyle = '#f1f3f5'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.fillStyle = i === 0 ? '#e03131' : '#40c057'; ctx.beginPath(); ctx.ellipse(130 + Math.cos(a) * 46, 170 + Math.sin(a) * 46, 30, 18, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(130, 170, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.font = 'bold 44px Arial'; ctx.fillText('Uh-oh!', 250, 150);
      ctx.font = '18px Courier New'; ctx.fillText('UIN: 123456789', 250, 200);
      ctx.fillStyle = '#2f9e44'; ctx.fillText('Online (4)', 250, 240); ctx.fillStyle = '#c92a2a'; ctx.fillText('Away (11)', 250, 270);
    },
    y2k(ctx, w, h) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 70px Courier New'; ctx.fillText('23:59:59', 90, 130);
      ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 40px Courier New'; ctx.fillText('31-12-99', 150, 190);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px Arial'; ctx.fillText('next: 01-01-00  =  1900 ?', 90, 260);
      ctx.fillStyle = '#51cf66'; ctx.font = '18px Courier New'; ctx.fillText('PATCHED. NOTHING HAPPENED. YOU\'RE WELCOME.', 30, 330);
    },
    flash(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      const sky = ctx.createLinearGradient(0, 30, 0, 280); sky.addColorStop(0, '#ffa94d'); sky.addColorStop(1, '#ffe066');
      ctx.fillStyle = sky; ctx.fillRect(30, 30, 452, 250);
      ctx.fillStyle = '#5c940d'; ctx.fillRect(30, 230, 452, 50);
      ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.arc(140, 210, 20, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(132, 200, 16, 30);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(130, 120, 252, 24); ctx.fillStyle = '#e03131'; ctx.fillRect(132, 122, 248 * 0.99, 20);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 16px Arial'; ctx.fillText('LOADING... 99%', 200, 110);
      ctx.fillStyle = '#343a40'; ctx.fillRect(370, 290, 112, 30); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.fillText('SKIP INTRO >>', 378, 310);
      ctx.fillStyle = '#495057'; ctx.font = '13px Arial'; ctx.fillText('Plugin required · right-click: About Flash Player', 30, 350);
    },
    orkut(ctx, w, h) {
      const top = newBrowser(ctx, w, h, 'www.orkut.com/Profile', '#f8f0f8');
      ctx.fillStyle = '#d6336c'; ctx.font = 'bold 34px Verdana'; ctx.fillText('orkut', 20, top + 44);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(20, top + 60, 140, 170); ctx.fillStyle = '#adb5bd'; ctx.beginPath(); ctx.arc(90, top + 120, 30, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(58, top + 152, 64, 60);
      ctx.fillStyle = '#000000'; ctx.font = '15px Verdana'; ['scraps (128)', 'fans: 42', 'cool: ★★★', 'communities (300)'].forEach((line, i) => ctx.fillText(line, 180, top + 90 + i * 30));
      ctx.fillStyle = '#d6336c'; ctx.font = 'bold 14px Verdana'; ctx.fillText('"I hate waking up early"', 180, top + 230);
    },
    chrome(ctx, w, h) {
      ctx.fillStyle = '#dee2e6'; ctx.fillRect(0, 0, w, h);
      ['New Tab', 'Docs', 'Maps'].forEach((tab, i) => { ctx.fillStyle = i ? '#ced4da' : '#ffffff'; ctx.beginPath(); ctx.moveTo(10 + i * 130, 40); ctx.lineTo(24 + i * 130, 10); ctx.lineTo(126 + i * 130, 10); ctx.lineTo(140 + i * 130, 40); ctx.fill(); ctx.fillStyle = '#212529'; ctx.font = '13px Arial'; ctx.fillText(tab, 40 + i * 130, 30); });
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 40, w, h - 40);
      ctx.strokeStyle = '#adb5bd'; ctx.strokeRect(20, 52, w - 40, 28); ctx.fillStyle = '#868e96'; ctx.font = '14px Arial'; ctx.fillText('Search or type a URL', 32, 71);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = ['#ffe3e3', '#e7f5ff', '#ebfbee', '#fff9db'][i % 4]; ctx.fillRect(40 + (i % 4) * 112, 110 + Math.floor(i / 4) * 110, 100, 90); }
      ctx.fillStyle = '#212529'; ctx.font = 'bold 14px Arial'; ctx.fillText('Most visited', 40, 102);
    },
    minecraft(ctx, w, h) {
      ctx.fillStyle = '#8ec5ff'; ctx.fillRect(0, 0, w, h);
      const s = 32;
      for (let x = 0; x < w; x += s) {
        const top = 200 + Math.round(Math.sin(x * 0.02) * 2) * s;
        for (let y = top; y < h; y += s) { ctx.fillStyle = y === top ? '#5c9e31' : y < top + s * 3 ? '#8b5a2b' : '#7a7a7a'; ctx.fillRect(x, y, s - 1, s - 1); }
      }
      ctx.fillStyle = '#6b4423'; ctx.fillRect(320, 104, 32, 64); ctx.fillStyle = '#2f9e44'; ctx.fillRect(288, 40, 96, 64);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Courier New'; ctx.fillText('Minecraft Alpha', 14, 30);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w - 60, 14, 16, 16);
    },
    nodejs(ctx, w, h) {
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3c873a'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(420 + Math.cos(a) * 50, 90 + Math.sin(a) * 50); }
      ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px Arial'; ctx.fillText('JS', 403, 100);
      ctx.font = '18px Courier New';
      [['#7ee787', '$ node server.js'], ['#c9d1d9', 'Server running at'], ['#79c0ff', 'http://127.0.0.1:8000/'], ['#c9d1d9', ''], ['#7ee787', '$ npm install left-pad'], ['#c9d1d9', 'added 1 package']].forEach(([color, line], i) => { ctx.fillStyle = color; ctx.fillText(line, 24, 60 + i * 32); });
      ctx.fillStyle = '#8b949e'; ctx.font = '14px Arial'; ctx.fillText('event loop · non-blocking I/O · 2009', 24, 350);
    },
    slack(ctx, w, h) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3f0e40'; ctx.fillRect(0, 0, 150, h);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.fillText('acme-team', 14, 30);
      ['# general', '# random', '# deploys', '# coffee'].forEach((ch, i) => { ctx.fillStyle = i === 0 ? '#1164a3' : '#3f0e40'; ctx.fillRect(0, 50 + i * 30, 150, 28); ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial'; ctx.fillText(ch, 16, 69 + i * 30); });
      [['Ana', 'shipped it'], ['Bo', 'which "it"?'], ['Ana', ':tada:'], ['Cy', 'reverting...']].forEach(([who, msg], i) => { ctx.fillStyle = '#212529'; ctx.font = 'bold 14px Arial'; ctx.fillText(who, 170, 50 + i * 60); ctx.font = '14px Arial'; ctx.fillText(msg, 170, 70 + i * 60); });
      ctx.fillStyle = '#868e96'; ctx.font = 'italic 13px Arial'; ctx.fillText('Your manager is typing...', 170, h - 20);
    },
    react(ctx, w, h) {
      ctx.fillStyle = '#20232a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#61dafb'; ctx.lineWidth = 6;
      [0, Math.PI / 3, -Math.PI / 3].forEach((a) => { ctx.beginPath(); ctx.ellipse(140, 190, 110, 40, a, 0, Math.PI * 2); ctx.stroke(); });
      ctx.fillStyle = '#61dafb'; ctx.beginPath(); ctx.arc(140, 190, 16, 0, Math.PI * 2); ctx.fill();
      ctx.font = '16px Courier New';
      [['#c678dd', 'function Hello() {'], ['#abb2bf', '  return ('], ['#e06c75', '    <h1>Hi</h1>'], ['#abb2bf', '  );'], ['#c678dd', '}']].forEach(([color, line], i) => { ctx.fillStyle = color; ctx.fillText(line, 290, 130 + i * 28); });
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.fillText('React · 2013', 300, 60);
    },
    unix(ctx, w, h) {
      ctx.fillStyle = '#f3ecd8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(18, 18, w - 36, h - 80);
      ctx.fillStyle = '#ffb000'; ctx.font = '19px Courier New, monospace';
      ['login: ken', '% who', 'ken      tty0   Nov  3', 'dmr      tty1   Nov  3', '% ls /usr/bin | wc -l', '      34', '% cat notes | grep pipe | sort', 'pipes: | joins small tools'].forEach((line, i) => ctx.fillText(line, 34, 50 + i * 30));
      ctx.fillStyle = '#5c4b2e'; ctx.font = 'bold 22px Georgia, serif'; ctx.fillText('Bell Labs · PDP-7 · 1969', 24, h - 28);
      ctx.fillStyle = '#ffb000'; ctx.fillRect(34 + 10 * 11.5, 260, 10, 18);
    },
    clang(ctx, w, h) {
      ctx.fillStyle = '#fbf8ef'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1c3f94'; ctx.font = 'bold 150px Georgia, serif'; ctx.fillText('C', 360, 170);
      ctx.fillStyle = '#212529'; ctx.font = '20px Courier New, monospace';
      ['#include <stdio.h>', '', 'main()', '{', '    printf("hello, world\\n");', '}'].forEach((line, i) => ctx.fillText(line, 28, 60 + i * 30));
      ctx.fillStyle = '#adb5bd'; ctx.fillRect(28, 250, 456, 2);
      ctx.fillStyle = '#495057'; ctx.font = '17px Courier New, monospace'; ctx.fillText('$ cc hello.c', 28, 290); ctx.fillText('$ ./a.out', 28, 316); ctx.fillText('hello, world', 28, 342);
    },
    macos(ctx, w, h) {
      ctx.fillStyle = '#9a9a9a';
      for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2 ? 0 : 1; x < w; x += 2) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, 26); ctx.fillStyle = '#000000'; ctx.fillRect(0, 26, w, 2);
      ctx.font = 'bold 16px Chicago, Geneva, Arial'; ['File', 'Edit', 'View', 'Special'].forEach((item, i) => ctx.fillText(item, 40 + i * 70, 19));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 70, 300, 200); ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.strokeRect(60, 70, 300, 200);
      for (let i = 0; i < 6; i++) ctx.fillRect(62, 74 + i * 3, 296, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(160, 72, 120, 16); ctx.fillStyle = '#000000'; ctx.font = 'bold 14px Geneva, Arial'; ctx.fillText('System Disk', 172, 85);
      [[90, 110, 'System'], [190, 110, 'MacPaint'], [290, 110, 'MacWrite']].forEach(([x, y, name]) => {
        ctx.strokeRect(x, y, 34, 42); ctx.fillRect(x + 6, y + 8, 22, 3); ctx.fillRect(x + 6, y + 16, 22, 3);
        ctx.font = '12px Geneva, Arial'; ctx.fillText(name, x - 6, y + 60);
      });
      ctx.fillStyle = '#ffffff'; ctx.fillRect(420, 300, 44, 50); ctx.strokeRect(420, 300, 44, 50); ctx.strokeRect(416, 296, 52, 6);
      for (let i = 0; i < 4; i++) ctx.fillRect(428 + i * 9, 308, 2, 36);
      ctx.fillStyle = '#000000'; ctx.font = '12px Geneva, Arial'; ctx.fillText('Trash', 426, 368);
      ctx.beginPath(); ctx.moveTo(250, 200); ctx.lineTo(250, 224); ctx.lineTo(256, 218); ctx.lineTo(262, 230); ctx.lineTo(266, 228); ctx.lineTo(260, 216); ctx.lineTo(268, 216); ctx.closePath();
      ctx.fillStyle = '#000000'; ctx.fill();
    },
    linux(ctx, w, h) {
      ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e9ecef'; ctx.font = '15px Courier New, monospace';
      ['From: torvalds (Linus Benedict Torvalds)', 'Newsgroups: comp.os.minix', 'Subject: What would you like to see most', '', 'I\'m doing a (free) operating system', '(just a hobby, won\'t be big and', 'professional...)'].forEach((line, i) => ctx.fillText(line, 20, 34 + i * 24));
      ctx.fillStyle = '#7ee787'; ctx.fillText('$ uname -sr', 20, 230); ctx.fillStyle = '#e9ecef'; ctx.fillText('Linux 0.01', 20, 254);
      const px = 410; const py = 270;
      ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.ellipse(px, py, 46, 62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8f9fa'; ctx.beginPath(); ctx.ellipse(px, py + 14, 30, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.arc(px, py - 62, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; [-10, 10].forEach((dx) => { ctx.beginPath(); ctx.arc(px + dx, py - 68, 7, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#111111'; [-10, 10].forEach((dx) => { ctx.beginPath(); ctx.arc(px + dx + 2, py - 67, 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#fab005'; ctx.beginPath(); ctx.moveTo(px - 12, py - 54); ctx.lineTo(px + 12, py - 54); ctx.lineTo(px, py - 42); ctx.fill();
      [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(px + s * 22, py + 64, 20, 8, 0, 0, Math.PI * 2); ctx.fill(); });
    },
    python(ctx, w, h) {
      ctx.fillStyle = '#1e2a3a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3776ab'; roundRect(ctx, 370, 30, 70, 70, 16); ctx.fill();
      ctx.fillStyle = '#ffd43b'; roundRect(ctx, 400, 60, 70, 70, 16); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(390, 48, 6, 0, Math.PI * 2); ctx.arc(452, 112, 6, 0, Math.PI * 2); ctx.fill();
      ctx.font = '18px Courier New, monospace';
      [['#8b949e', 'Python 0.9.0 (Feb 1991)'], ['#7ee787', '>>> print("Hello, world!")'], ['#e9ecef', 'Hello, world!'], ['#7ee787', '>>> for n in range(3):'], ['#7ee787', '...     print(n * "py ")'], ['#e9ecef', ''], ['#e9ecef', 'py'], ['#e9ecef', 'py py'], ['#7ee787', '>>> import this'], ['#ffd43b', 'Beautiful is better than ugly.']].forEach(([color, line], i) => { ctx.fillStyle = color; ctx.fillText(line, 22, 40 + i * 32); });
    },
    java(ctx, w, h) {
      ctx.fillStyle = '#f8f1e7'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e76f00'; ctx.beginPath(); ctx.moveTo(360, 150); ctx.lineTo(470, 150); ctx.lineTo(456, 250); ctx.quadraticCurveTo(415, 270, 374, 250); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e76f00'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(474, 190, 20, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.strokeStyle = '#5382a1'; ctx.lineWidth = 5;
      [385, 415, 445].forEach((x, i) => { ctx.beginPath(); ctx.moveTo(x, 135); ctx.bezierCurveTo(x - 14, 115, x + 14, 95, x, 70 - i * 4); ctx.stroke(); });
      ctx.fillStyle = '#5382a1'; ctx.font = 'bold 22px Georgia, serif'; ctx.fillText('Write once, run anywhere', 24, 44);
      ctx.fillStyle = '#212529'; ctx.font = '15px Courier New, monospace';
      ['public class Hello {', '  public static void', '      main(String[] args) {', '    System.out.println(', '        "Hello, world");', '  }', '}'].forEach((line, i) => ctx.fillText(line, 24, 92 + i * 26));
      ctx.fillStyle = '#868e96'; ctx.font = '15px Courier New, monospace'; ctx.fillText('Hello.java -> javac -> Hello.class -> JVM', 24, 350);
    },
    javascript(ctx, w, h) {
      const top = oldBrowser(ctx, w, h, 'Netscape Navigator 2.0', 'http://home.example/', '#ffffff');
      ctx.fillStyle = '#f7df1e'; ctx.fillRect(w - 120, top + 14, 96, 96); ctx.fillStyle = '#111111'; ctx.font = 'bold 44px Arial'; ctx.fillText('JS', w - 76, top + 98);
      ctx.fillStyle = '#212529'; ctx.font = '15px Courier New, monospace';
      ['<script language="JavaScript">', '  function hello() {', '    alert("Hello from 1995!");', '  }', '</script>', '<input type=button onclick="hello()">'].forEach((line, i) => ctx.fillText(line, 18, top + 30 + i * 24));
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(120, top + 180, 280, 110); ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.strokeRect(120, top + 180, 280, 110);
      ctx.fillStyle = '#000080'; ctx.fillRect(121, top + 181, 278, 20); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'; ctx.fillText('JavaScript Alert', 128, top + 196);
      ctx.fillStyle = '#000000'; ctx.font = '15px Arial'; ctx.fillText('Hello from 1995!', 190, top + 236);
      ctx.fillStyle = '#e9ecef'; ctx.fillRect(225, top + 252, 70, 26); ctx.strokeRect(225, top + 252, 70, 26); ctx.fillStyle = '#000000'; ctx.fillText('OK', 250, top + 270);
    },
    git(ctx, w, h) {
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 5;
      const node = (x, y, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); };
      ctx.strokeStyle = '#f05033'; ctx.beginPath(); ctx.moveTo(40, 80); ctx.lineTo(470, 80); ctx.stroke();
      ctx.strokeStyle = '#4dabf7'; ctx.beginPath(); ctx.moveTo(130, 80); ctx.quadraticCurveTo(160, 150, 210, 150); ctx.lineTo(330, 150); ctx.quadraticCurveTo(380, 150, 400, 80); ctx.stroke();
      ctx.strokeStyle = '#69db7c'; ctx.beginPath(); ctx.moveTo(250, 150); ctx.quadraticCurveTo(270, 210, 310, 210); ctx.lineTo(360, 210); ctx.stroke();
      [40, 130, 220, 310, 400, 470].forEach((x) => node(x, 80, '#f05033'));
      [210, 270, 330].forEach((x) => node(x, 150, '#4dabf7'));
      [310, 360].forEach((x) => node(x, 210, '#69db7c'));
      ctx.fillStyle = '#e9ecef'; ctx.font = '13px Arial'; ctx.fillText('main', 440, 60); ctx.fillText('feature', 300, 132); ctx.fillText('experiment', 330, 236);
      ctx.font = '16px Courier New, monospace';
      [['#7ee787', '$ git init'], ['#7ee787', '$ git commit -m "Initial revision"'], ['#7ee787', '$ git checkout -b feature'], ['#adb5bd', 'Switched to a new branch \'feature\'']].forEach(([color, line], i) => { ctx.fillStyle = color; ctx.fillText(line, 24, 268 + i * 26); });
    },
    appstore(ctx, w, h) {
      ctx.fillStyle = '#e7f1ff'; ctx.fillRect(0, 0, w, h);
      const [sx, sy, sw, sh] = phoneOutline(ctx, 150, h / 2, 190, 350);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, sw, sh);
      const colors = ['#ff6b6b', '#fcc419', '#51cf66', '#339af0', '#845ef7', '#f783ac', '#20c997', '#ff922b'];
      for (let i = 0; i < 16; i++) { ctx.fillStyle = colors[(i * 3) % colors.length]; roundRect(ctx, sx + 12 + (i % 4) * 41, sy + 14 + Math.floor(i / 4) * 52, 32, 32, 8); ctx.fill(); }
      ctx.fillStyle = '#1c7ed6'; roundRect(ctx, sx + 40, sy + sh - 52, sw - 80, 30, 15); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial'; ctx.fillText('INSTALL', sx + 58, sy + sh - 32);
      ctx.fillStyle = '#1d1b26'; ctx.font = 'bold 30px Arial'; ctx.fillText('500 apps', 290, 130);
      ctx.font = '20px Arial'; ctx.fillText('on day one', 290, 162);
      ctx.fillStyle = '#495057'; ctx.font = '16px Arial'; ['Games, maps, notes,', 'flashlights and lots', 'of tiny experiments.'].forEach((line, i) => ctx.fillText(line, 290, 220 + i * 24));
    },
    vscode(ctx, w, h) {
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#333333'; ctx.fillRect(0, 0, 40, h);
      ctx.fillStyle = '#252526'; ctx.fillRect(40, 0, 120, h);
      ctx.fillStyle = '#2d2d2d'; ctx.fillRect(160, 0, w - 160, 28); ctx.fillStyle = '#1e1e1e'; ctx.fillRect(160, 0, 110, 28);
      ctx.fillStyle = '#ffffff'; ctx.font = '13px Arial'; ctx.fillText('app.js', 176, 19);
      ctx.fillStyle = '#cccccc'; ctx.font = '12px Arial'; ['EXPLORER', '  src', '    app.js', '    utils.js', '  package.json', '  README.md'].forEach((line, i) => ctx.fillText(line, 48, 22 + i * 22));
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i ? '#858585' : '#ffffff'; ctx.fillRect(12, 16 + i * 44, 16, 16); }
      ctx.font = '14px Courier New, monospace';
      const code = [[['#c586c0', 'import '], ['#9cdcfe', 'express '], ['#c586c0', 'from '], ['#ce9178', "'express'"]], [], [['#569cd6', 'const '], ['#9cdcfe', 'app '], ['#d4d4d4', '= '], ['#dcdcaa', 'express'], ['#d4d4d4', '();']], [['#9cdcfe', 'app'], ['#d4d4d4', '.'], ['#dcdcaa', 'get'], ['#d4d4d4', '('], ['#ce9178', "'/'"], ['#d4d4d4', ', (req, res) =>']], [['#d4d4d4', '  res.'], ['#dcdcaa', 'send'], ['#d4d4d4', '('], ['#ce9178', "'hi'"], ['#d4d4d4', '));']], [['#9cdcfe', 'app'], ['#d4d4d4', '.'], ['#dcdcaa', 'listen'], ['#d4d4d4', '('], ['#b5cea8', '3000'], ['#d4d4d4', ');']]];
      code.forEach((tokens, i) => { let x = 196; ctx.fillStyle = '#858585'; ctx.fillText(String(i + 1), 170, 56 + i * 24); tokens.forEach(([color, text]) => { ctx.fillStyle = color; ctx.fillText(text, x, 56 + i * 24); x += ctx.measureText(text).width; }); });
      ctx.fillStyle = '#252526'; ctx.fillRect(196, 210, 230, 70); ctx.strokeStyle = '#454545'; ctx.strokeRect(196, 210, 230, 70);
      ctx.fillStyle = '#d4d4d4'; ctx.font = '13px Courier New, monospace'; ['listen', 'locals', 'lock'].forEach((s, i) => ctx.fillText(s, 206, 230 + i * 20));
      ctx.fillStyle = '#007acc'; ctx.fillRect(0, h - 24, w, 24); ctx.fillStyle = '#ffffff'; ctx.font = '12px Arial'; ctx.fillText('main  ·  Ln 6, Col 18  ·  JavaScript', 12, h - 8);
    },
    here(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#1b1036'); sky.addColorStop(1, '#3b5bdb');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 6; j++) {
          const x = 60 + i * 44 - j * 10;
          const y = 360 - j * 22 - ((i * 7 + j * 3) % 5) * 24;
          ctx.fillStyle = ['#845ef7', '#5c7cfa', '#22b8cf', '#f06595', '#fab005'][(i + j) % 5];
          ctx.fillRect(x, y, 36, 360 - y);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; for (let k = y + 6; k < 360; k += 12) ctx.fillRect(x + 6, k, 24, 4);
        }
      }
      ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.moveTo(256, 150); ctx.arc(256, 110, 30, Math.PI * 0.8, Math.PI * 2.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1b1036'; ctx.beginPath(); ctx.arc(256, 110, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px Arial'; ctx.fillText('YOU ARE HERE', 140, 50);
    }
  };

  function artifactTexture(kind) {
    return canvasTexture(`artifact|${kind}`, 512, 384, (ctx, w, h) => {
      if (ARTIFACT_DRAWINGS[kind]) ARTIFACT_DRAWINGS[kind](ctx, w, h);
      else if (['firstsite', 'irc'].includes(kind)) ctx.drawImage(historyTexture(kind).image, 0, 0, w, h);
      else ctx.drawImage(timelineTexture(kind).image, 0, 0, w, h);
    });
  }

  // Museum label: big year, title and a hint to inspect
  function plaqueTexture(year, title, era) {
    return canvasTexture(`plaque|${year}|${title}`, 512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f8f4ea'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = ERAS[era].sign; ctx.fillRect(0, 0, 18, h);
      ctx.fillStyle = '#1d1b26'; ctx.font = 'bold 84px Georgia, serif'; ctx.fillText(String(year === 2026 ? 'Today' : year), 44, 92);
      ctx.font = 'bold 34px Georgia, serif';
      const words = title.split(' ');
      let line = '';
      let y = 150;
      words.forEach((word) => {
        if (ctx.measureText(`${line} ${word}`).width > w - 70 && line) { ctx.fillText(line, 44, y); line = word; y += 40; } else line = line ? `${line} ${word}` : word;
      });
      ctx.fillText(line, 44, y);
      ctx.fillStyle = '#868e96'; ctx.font = 'italic 22px Georgia, serif'; ctx.fillText(`${ERAS[era].name}  ·  press E to inspect`, 44, h - 16);
    });
  }

  function eraSignTexture(era) {
    return canvasTexture(`eraSign|${era}`, 1024, 192, (ctx, w, h) => {
      const info = ERAS[era];
      ctx.fillStyle = info.sign; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = info.accent; ctx.lineWidth = 6; ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = info.accent; ctx.textAlign = 'center';
      ctx.font = 'bold 80px Georgia, serif'; ctx.fillText(info.name.toUpperCase(), w / 2, 104);
      ctx.fillStyle = '#ffffff'; ctx.font = '40px Georgia, serif'; ctx.fillText(info.years, w / 2, 160);
    });
  }

  // Shared geometries / materials of the exhibits
  const hallShared = {};
  function hallParts() {
    if (hallShared.picture) return hallShared;
    hallShared.picture = new THREE.PlaneGeometry(2.76, 2.07);
    hallShared.plaque = new THREE.PlaneGeometry(0.84, 0.42);
    hallShared.beam = new THREE.MeshBasicMaterial({ color: '#fff1c9', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    hallShared.dark = material('#1b1b1b', { metalness: 0.6, roughness: 0.4 });
    hallShared.brass = material('#c9a227', { metalness: 0.8, roughness: 0.3 });
    hallShared.plinth = material('#f1f3f5', { roughness: 0.5 });
    hallShared.vitrine = material('#dff3ff', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 });
    hallShared.lamp = glow('#fff3c4', 2);
    return hallShared;
  }

  // Small 3D models shown on plinths in front of a few frames
  function plinthModel(kind) {
    const model = new THREE.Group();
    if (kind === 'coffeepot') {
      model.add(cylinder(0.16, 0.13, 0.3, material('#dbe4ff', { transparent: true, opacity: 0.55, roughness: 0.05 }), 0, 0.15, 0, 16));
      model.add(cylinder(0.13, 0.12, 0.14, material('#3b1f0e'), 0, 0.08, 0, 16));
      model.add(cylinder(0.17, 0.17, 0.05, material('#212529'), 0, 0.32, 0, 16));
      model.add(box(0.04, 0.2, 0.06, material('#212529'), 0.19, 0.17, 0));
    } else if (kind === 'laser') {
      const body = cylinder(0.025, 0.025, 0.32, material('#343a40', { metalness: 0.7 }), 0, 0.06, 0, 10);
      body.rotation.z = Math.PI / 2;
      model.add(body);
      model.add(box(0.03, 0.03, 0.03, glow('#ff6b6b', 0.4), 0.17, 0.06, 0));
      model.add(box(0.06, 0.012, 0.04, material('#adb5bd'), -0.05, 0.088, 0));
    } else if (kind === 'phone') {
      const phone = box(0.16, 0.3, 0.02, material('#111111', { metalness: 0.5, roughness: 0.2 }), 0, 0.18, 0);
      phone.rotation.x = -0.25;
      model.add(phone);
      const screen = mesh(new THREE.PlaneGeometry(0.14, 0.24), new THREE.MeshBasicMaterial({ map: artifactTexture('iphone') }), 0, 0.18, 0.012);
      screen.rotation.x = -0.25;
      model.add(screen);
    }
    return model;
  }

  // One exhibit against a wall: frame + museum light + lectern with the plaque.
  // Static parts go to `decor` (merged later), unique parts to `group`.
  function placeExhibit(group, decor, beams, artifact, x, z, rotationY, h) {
    const [year, kind, title, info, era, model] = artifact;
    const parts = hallParts();
    const floor = 0.3;
    const place = (object, lx, ly, lz) => {
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = rotationY;
      object.position.set(lx, ly, lz);
      holder.add(object);
      return holder;
    };
    const frameMaterial = material(ERAS[era].frame, { metalness: era === 'dotcom' ? 0.7 : 0.2, roughness: 0.4 });
    decor.add(place(box(3.0, 2.3, 0.1, frameMaterial, 0, 0, 0), 0, floor + 2.35, 0.05));
    decor.add(place(box(0.28, 0.24, 0.42, parts.dark, 0, 0, 0), 0, h - 0.45, 1.7));
    decor.add(place(box(0.06, 0.3, 0.06, parts.dark, 0, 0, 0), 0, h - 0.2, 1.7));
    decor.add(place(box(0.1, 0.95, 0.1, parts.dark, 0, 0, 0), 0, floor + 0.47, 1.05));
    const top = box(0.95, 0.04, 0.52, parts.dark, 0, 0, 0);
    top.rotation.x = 0.6;
    decor.add(place(top, 0, floor + 0.98, 1.05));
    // Fake museum light: a soft additive cone from the ceiling spot to the frame
    const apex = new THREE.Vector3(0, h - 0.55, 1.7);
    const target = new THREE.Vector3(0, floor + 2.1, 0);
    const length = apex.distanceTo(target) + 0.4;
    const cone = mesh(new THREE.ConeGeometry(1.5, length, 20, 1, true), parts.beam);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(apex).normalize());
    beams.add(place(cone, (apex.x + target.x) / 2, (apex.y + target.y) / 2 - 0.2, (apex.z + target.z) / 2));
    const unique = new THREE.Group();
    unique.position.set(x, 0, z);
    unique.rotation.y = rotationY;
    unique.add(mesh(hallShared.picture, new THREE.MeshBasicMaterial({ map: artifactTexture(kind) }), 0, floor + 2.35, 0.115));
    const plaque = mesh(hallShared.plaque, new THREE.MeshBasicMaterial({ map: plaqueTexture(year, title, era) }), 0, floor + 1.0, 1.06);
    plaque.rotation.x = -0.97;
    plaque.position.y += 0.03;
    unique.add(plaque);
    if (model) {
      decor.add(place(box(0.8, 1.05, 0.8, parts.plinth, 0, 0, 0), 1.25, floor + 0.52, 0.9));
      const glass = box(0.7, 0.6, 0.7, parts.vitrine, 1.25, floor + 1.35, 0.9);
      glass.castShadow = false;
      unique.add(glass);
      const object = plinthModel(model);
      object.position.set(1.25, floor + 1.05, 0.9);
      unique.add(object);
    }
    // The E anchor sits at the lectern, at reach from the aisle
    const anchor = new THREE.Object3D();
    anchor.position.set(0, floor + 1, 1.3);
    anchor.userData = { label: `${year === 2026 ? 'Today' : year} · ${title}`, info };
    unique.add(PropKit.kit.interactive(anchor, 'inspect', title));
    group.add(unique);
  }

  // Era arch spanning an aisle between two walls (z1 < z2), sign readable from both sides
  function eraArch(group, decor, x, z1, z2, h, era) {
    const width = z2 - z1;
    const stone = material(ERAS[era].sign, { roughness: 0.6 });
    [z1 + 0.3, z2 - 0.3].forEach((z) => decor.add(box(0.6, h - 0.3, 0.6, stone, x, 0.3 + (h - 0.3) / 2, z)));
    decor.add(box(0.6, 0.6, width, stone, x, h - 0.6, (z1 + z2) / 2));
    const sign = new THREE.MeshBasicMaterial({ map: eraSignTexture(era) });
    [-1, 1].forEach((side) => {
      const plane = mesh(new THREE.PlaneGeometry(Math.min(width - 1.6, 6), Math.min(width - 1.6, 6) * 0.1875), sign, x + side * 0.31, h - 1.35, (z1 + z2) / 2);
      plane.rotation.y = side * Math.PI / 2;
      group.add(plane);
    });
    const line = box(0.12, 0.02, width - 0.8, glow(ERAS[era].accent, 1.2), x, 0.31, (z1 + z2) / 2);
    line.raycast = () => {};
    group.add(line);
  }

  // Merge static parts by material; light cones never cast shadows or block
  function finishHall(group, decor, beams) {
    group.add(PropKit.kit.mergeByMaterial(decor));
    const mergedBeams = PropKit.kit.mergeByMaterial(beams);
    mergedBeams.traverse((node) => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; node.raycast = () => {}; node.renderOrder = 2; } });
    group.add(mergedBeams);
  }

  function hallSurfaces(w, d) {
    return {
      wall: new THREE.MeshStandardMaterial({ map: PropKit.kit.repeated(PropKit.kit.stuccoTexture('#efe6d6'), Math.round(w / 4), 2), roughness: 0.85, side: THREE.DoubleSide }),
      floor: new THREE.MeshStandardMaterial({ map: PropKit.kit.repeated(PropKit.kit.plankTexture('#4a2f1b'), Math.round(w / 3), Math.round(d / 3)), roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide }),
      ceiling: material('#1d1712', { roughness: 0.9, side: THREE.DoubleSide })
    };
  }

  // Cheap decorative visitors (no AI): instanced legs, bodies and heads.
  // spots: [x, z, floorY, rotationY]. Shared by plaza.js and gigplaza.js.
  const VISITOR_COLORS = ['#1971c2', '#e8590c', '#2f9e44', '#ae3ec9', '#c92a2a', '#f08c00', '#0ca678', '#495057', '#d6336c'];
  const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
  function visitorFigures(group, spots) {
    const count = spots.length;
    if (!count) return;
    const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.85, 0.2), new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.8 }), count);
    const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.25, 0.68, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), count);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), count);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    spots.forEach(([x, z, y, angle], i) => {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle || 0);
      const base = (y || 0) + 0.3;
      legs.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, base + 0.43, z), rotation, one));
      bodies.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, base + 1.2, z), rotation, one));
      heads.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, base + 1.68, z), rotation, one));
      bodies.setColorAt(i, color.set(VISITOR_COLORS[i % VISITOR_COLORS.length]));
      heads.setColorAt(i, color.set(SKIN[(i * 3) % SKIN.length]));
    });
    [legs, bodies, heads].forEach((part) => { part.raycast = () => {}; part.castShadow = false; group.add(part); });
  }
  window.MuseumVisitors = visitorFigures;

  // Floor timeline on an arc: a ring strip whose texture runs along the angle
  function timelineArc(group, key, entries, thetaStart, thetaLength, radius) {
    const width = 1.4;
    const length = thetaLength * radius;
    const texture = canvasTexture(`timelineArc|${key}`, 1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#16120e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(0, h / 2 - 1, w, 2); ctx.fillRect(0, 2, w, 2); ctx.fillRect(0, h - 4, w, 2);
      // Pixels are stretched along the strip: squeeze text to compensate
      const squeeze = (width / h) / (length / w);
      entries.forEach(({ angle, text, color, font }) => {
        const px = ((angle - thetaStart) / thetaLength) * w;
        ctx.save(); ctx.translate(px, h / 2); ctx.scale(squeeze, 1);
        ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = '#16120e'; ctx.fillRect(-textWidth / 2 - 6, -18, textWidth + 12, 36);
        ctx.fillStyle = color; ctx.fillText(text, 0, 2); ctx.restore();
      });
    });
    const segments = 64;
    // RingGeometry angle phi = theta - PI/2 once laid flat (rotation.x = -PI/2)
    const geometry = new THREE.RingGeometry(radius - width / 2, radius + width / 2, segments, 1, thetaStart - Math.PI / 2, thetaLength);
    const uv = geometry.attributes.uv;
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= segments; i++) uv.setXY(j * (segments + 1) + i, i / segments, j);
    uv.needsUpdate = true;
    const strip = mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), 0, 0.32, 0);
    strip.rotation.x = -Math.PI / 2;
    strip.castShadow = false;
    strip.raycast = () => {};
    group.add(strip);
  }

  // Themed side alcoves off the ring (local frame: x across, z outward,
  // statics go to `still` (merged), interactive parts to `live`)
  function buildAlcove(still, live, door, start, length, height, wallMaterial) {
    const end = start + length + 0.4;
    still.add(box(door.width + 0.6, height, 0.3, wallMaterial, 0, height / 2, end - 0.15));
    const screen = (kind, w, h, x, y, z, rotationY = Math.PI) => {
      const plane = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: artifactTexture(kind) }), x, y, z);
      plane.rotation.y = rotationY;
      live.add(plane);
    };
    const back = end - 0.3;
    const info = (text, title) => {
      const anchor = new THREE.Object3D();
      anchor.position.set(0, 1.2, start + 1.2);
      anchor.userData = { label: title, info: text };
      live.add(PropKit.kit.interactive(anchor, 'inspect', title));
    };
    if (door.alcove === 'dialup') {
      still.add(box(2.6, 0.08, 1.0, material('#8a5a33'), 0, 1.05, back - 0.6));
      [-1.2, 1.2].forEach((x) => still.add(box(0.08, 0.75, 0.9, material('#5d4037'), x, 0.67, back - 0.6)));
      still.add(box(0.9, 0.75, 0.75, material('#d9d2c3'), 0, 1.47, back - 0.6));
      screen('aol', 0.7, 0.52, 0, 1.5, back - 0.98);
      still.add(box(0.5, 0.12, 0.3, material('#d9d2c3'), 0.9, 1.15, back - 0.8));
      still.add(box(0.45, 0.9, 0.5, material('#d9d2c3'), -1.0, 1.55, back - 0.6));
      screen('modem', 2.4, 1.8, 0, 3.0, back - 0.02);
      const chair = new THREE.Group();
      chair.add(box(0.55, 0.08, 0.55, material('#343a40'), 0, 0.75, 0));
      chair.add(box(0.55, 0.6, 0.06, material('#343a40'), 0, 1.08, -0.25));
      chair.position.set(0, 0, back - 1.7);
      live.add(PropKit.kit.interactive(chair, 'sit', 'Computer chair'));
      info('A beige PC, a CRT and a modem that sang before every session. Bonus points if someone picked up the phone mid-download.', 'Dial-up Corner');
    } else if (door.alcove === 'flash') {
      ['#e64980', '#4dabf7'].forEach((color, i) => {
        const cabinet = new THREE.Group();
        cabinet.add(box(0.9, 1.9, 0.8, material(color, { roughness: 0.5 }), 0, 0.95, 0));
        const plane = mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: artifactTexture('flash') }), 0, 1.45, 0.41);
        cabinet.add(plane);
        cabinet.add(box(0.9, 0.25, 0.82, glow(color, 1.4), 0, 2.0, 0));
        cabinet.position.set(i ? 1.4 : -1.4, 0.3, back - 0.6);
        cabinet.rotation.y = Math.PI;
        live.add(PropKit.kit.interactive(cabinet, 'arcade', 'Flash Games Arcade'));
      });
      screen('flash', 2.4, 1.8, 0, 3.0, back - 0.02);
      info('Browser games that loaded between classes. Press E at a cabinet to play.', 'Flash Games Arcade');
    } else if (door.alcove === 'browsers') {
      [['netscape', -2], ['mosaic', 0], ['chrome', 2]].forEach(([kind, x]) => {
        still.add(box(1.9, 1.5, 0.1, material('#212529'), x, 2.2, back - 0.05));
        screen(kind, 1.8, 1.35, x, 2.2, back - 0.11);
        still.add(box(0.8, 1.0, 0.8, material('#f1f3f5'), x, 0.8, back - 1.2));
      });
      info('Netscape, Internet Explorer, Firefox, Chrome: every few years a new browser promised the web would finally render the same everywhere.', 'Browser Wars');
    } else if (door.alcove === 'chat') {
      ['#ff922b', '#845ef7'].forEach((color, i) => {
        const bag = sphere(0.55, material(color, { roughness: 1 }), 0, 0.55, 0, 12);
        bag.scale.y = 0.65;
        const seat = new THREE.Group();
        seat.add(bag);
        seat.position.set(i ? 1.3 : -1.3, 0.3, back - 1.8);
        live.add(PropKit.kit.interactive(seat, 'sit', 'Beanbag'));
      });
      screen('icq', 1.8, 1.35, -1.2, 2.2, back - 0.02);
      screen('msn', 1.8, 1.35, 1.2, 2.2, back - 0.02);
      info('Buddy lists, away messages and the sound of someone coming online. Chat rooms were the first social networks.', 'Chat Room Nostalgia');
    }
    const title = { dialup: 'Dial-up Corner', flash: 'Flash Games Arcade', browsers: 'Browser Wars', chat: 'Chat Room Nostalgia' }[door.alcove];
    if (title) {
      const sign = textSprite(title, { width: 4, background: 'rgba(36, 22, 74, 0.92)' });
      sign.position.set(0, height - 0.6, end - 1.2);
      live.add(sign);
    }
    still.add(box(door.width - 0.4, 0.06, 0.4, glow('#ffd8a8', 1.2), 0, height - 0.05, end - 1.5));
  }

  Object.assign(builders, {
    // ONE ring corridor around the Underground Lounge (same center): the Hall
    // of Internet & Software History. The 67 artifacts run clockwise from 1969
    // next to the lounge portal (data.portal, degrees; 90 = +x) all the way
    // around to "You are here" on the other side of it. Outer doors
    // (data.doors) get short vestibules: the Minimal Art Gallery link, the Gig
    // Plaza tunnel and the themed alcoves.
    // Shared wall (data.bays, same values as the underground_hall block): the
    // lounge's ground-floor wall IS the inner wall of the ring. The lounge
    // builds it (solid wood piers between arched glass bays, open arches at
    // data.bays.openings, the first one is the portal); the ring adds only the
    // band above it and hangs its inner exhibits on the piers, so every lounge
    // window looks at the real corridor. Without data.bays the ring builds its
    // own inner wall with a single portal (exhibits alternate between walls).
    // Fully enclosed: floor, ceiling, both walls; plus a dark rock shell around
    // the whole underground so no gap can ever show the city or the sky.
    historyRing(group, { w, h, label, data }) {
      const outerR = w / 2;
      const innerR = (data && data.inner) || 26.25;
      const midR = (innerR + outerR) / 2;
      const deg = Math.PI / 180;
      const TAU = Math.PI * 2;
      const portal = ((data && data.portal) || 90) * deg;
      const bays = (data && data.bays) || null;
      const portalWidth = bays ? bays.openingWidth || 5 : 6;
      const portalHeight = bays ? bays.openingHeight || 4.6 : 5.4;
      const doors = ((data && data.doors) || []).map((door) => ({ ...door, theta: door.angle * deg }));
      const surfaces = hallSurfaces(outerR * 2, outerR * 2);
      const decor = new THREE.Group();
      const beams = new THREE.Group();
      const toXZ = (angle, r) => [Math.sin(angle) * r, Math.cos(angle) * r];
      const after = (angle) => (((angle - portal) % TAU) + TAU) % TAU; // clockwise distance from the portal
      // Floor and ceiling rings. With the shared wall they start at the lounge
      // wall, so nothing pokes into the lounge (no ledge, no z-fighting)
      const floor = mesh(new THREE.RingGeometry(bays ? innerR - 0.05 : innerR - 0.3, outerR + 0.2, 128, 1), surfaces.floor, 0, 0.3, 0);
      floor.rotation.x = -Math.PI / 2;
      group.add(floor);
      const ceiling = mesh(new THREE.RingGeometry(bays ? innerR : innerR - 0.3, outerR + 0.2, 128, 1), surfaces.ceiling, 0, h, 0);
      ceiling.rotation.x = -Math.PI / 2;
      group.add(ceiling);
      const lightRing = mesh(new THREE.RingGeometry(midR - 0.25, midR + 0.25, 128, 1), glow('#fff3c4', 1.1, { side: THREE.DoubleSide }), 0, h - 0.03, 0);
      lightRing.rotation.x = -Math.PI / 2;
      lightRing.raycast = () => {};
      group.add(lightRing);
      // Curved walls with gaps; lintels above every gap
      const curvedWall = (radius, gaps, doorHeight) => {
        const sorted = gaps.slice().sort((a, b) => a.start - b.start);
        let cursor = sorted.length ? sorted[sorted.length - 1].start + sorted[sorted.length - 1].length - TAU : 0;
        const pieces = [];
        sorted.forEach((gap) => { pieces.push([cursor, gap.start - cursor]); cursor = gap.start + gap.length; });
        if (!sorted.length) pieces.push([0, TAU]);
        pieces.forEach(([start, length]) => { if (length > 0.001) group.add(mesh(new THREE.CylinderGeometry(radius, radius, h, Math.max(8, Math.round(length * 40)), 1, true, start, length), surfaces.wall, 0, h / 2, 0)); });
        sorted.forEach((gap) => {
          const top = gap.height || doorHeight;
          group.add(mesh(new THREE.CylinderGeometry(radius, radius, h - top, 8, 1, true, gap.start, gap.length), surfaces.wall, 0, top + (h - top) / 2, 0));
        });
      };
      const portalHalf = Math.asin(portalWidth / 2 / innerR);
      if (bays) {
        // Band from the top of the lounge's ground-floor wall up to the ceiling
        const top = bays.top || 6.05;
        group.add(mesh(new THREE.CylinderGeometry(innerR, innerR, h - top, 128, 1, true), surfaces.wall, 0, top + (h - top) / 2, 0));
      } else {
        curvedWall(innerR, [{ start: portal - portalHalf, length: portalHalf * 2, height: portalHeight }], portalHeight);
      }
      curvedWall(outerR, doors.map((door) => {
        const half = Math.asin(door.width / 2 / outerR);
        return { start: door.theta - half, length: half * 2, height: door.height };
      }), 4.6);
      // Skirting and picture rail (the lounge wall has its own wood base)
      (bays ? [outerR - 0.05] : [innerR + 0.05, outerR - 0.05]).forEach((radius) => {
        decor.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.25, 128, 1, true), hallParts().dark, 0, 0.42, 0));
        decor.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.06, 128, 1, true), hallParts().brass, 0, h - 1.4, 0));
      });
      // Portal frame (both faces) with title signs
      const portalTitle = labelTexture(`${label || 'Hall of Internet History'} · 1969 to today`, { bg: '#3a2416', fg: '#ffe8a3', width: 1024, height: 160, font: 'bold 50px Georgia, serif' });
      if (!bays) {
        [-1, 1].forEach((side) => {
          const [x, z] = toXZ(portal + side * portalHalf, innerR);
          decor.add(box(0.7, 5.6, 0.7, material('#3a2416'), x, 2.8, z));
        });
      }
      [[innerR + 0.08, portal], [innerR - 0.3, portal + Math.PI]].forEach(([radius, facing]) => {
        const [x, z] = toXZ(portal, radius);
        const sign = mesh(new THREE.PlaneGeometry(6.4, 1.0), new THREE.MeshBasicMaterial({ map: portalTitle }), x, portalHeight + 0.55, z);
        sign.rotation.y = facing;
        group.add(sign);
      });
      // Vestibules behind the outer doors, ending where the next block starts
      doors.forEach((door) => {
        const holder = new THREE.Group();
        holder.rotation.y = door.theta;
        const length = door.length || 4;
        const doorHeight = door.height || 4.6;
        const start = outerR - 0.4;
        holder.add(box(door.width + 0.6, 0.3, length + 0.4, surfaces.floor, 0, 0.15, start + (length + 0.4) / 2));
        holder.add(box(door.width + 0.6, 0.3, length + 0.4, surfaces.ceiling, 0, doorHeight + 0.15, start + (length + 0.4) / 2));
        [-1, 1].forEach((side) => holder.add(box(0.3, doorHeight, length + 0.4, surfaces.wall, side * (door.width / 2 + 0.15), doorHeight / 2, start + (length + 0.4) / 2)));
        holder.add(box(door.width, 0.06, 0.4, glow('#fff3c4', 1), 0, doorHeight - 0.05, start + length / 2));
        decor.add(holder);
        const sign = new THREE.Group();
        sign.rotation.y = door.theta;
        const plane = mesh(new THREE.PlaneGeometry(4.6, 0.8), new THREE.MeshBasicMaterial({ map: labelTexture(door.label || 'Exit', { bg: '#111111', fg: '#ff9f1c', width: 512, height: 90, font: 'bold 40px Arial' }) }), 0, doorHeight + 0.6, outerR - 0.12);
        plane.rotation.y = Math.PI;
        sign.add(plane);
        group.add(sign);
        if (door.alcove) buildAlcove(holder, sign, door, start, length, doorHeight, surfaces.wall);
      });
      // Exhibit slots [angle, onOuter] in chronological (clockwise) order, and
      // the era arches between eras
      const items = ARTIFACTS;
      const slots = [];
      const arches = [];
      const doorClear = (theta, radius, width) => doors.some((door) => Math.abs(Math.atan2(Math.sin(theta - door.theta), Math.cos(theta - door.theta))) * radius < door.width / 2 + 1.8 + (width || 0));
      if (bays) {
        // One exhibit on every pier of the shared wall, the rest spread evenly
        // over the free outer wall between the doors (most of them face a window)
        const count = bays.count || 18;
        const module = TAU / count;
        for (let k = 0; k < count; k++) slots.push([portal + (k + 0.5) * module, false]);
        const outerCount = items.length - count;
        const free = [];
        for (let i = 0; i < 3000; i++) {
          const theta = portal + 0.05 + ((i + 0.5) / 3000) * (TAU - 0.1);
          if (!doorClear(theta, outerR)) free.push(theta);
        }
        for (let i = 0; i < outerCount; i++) slots.push([free[Math.floor(((i + 0.5) / outerCount) * free.length)], true]);
        slots.sort((a, b) => after(a[0]) - after(b[0]));
        items.forEach((artifact, i) => {
          if (i === 0 || artifact[4] === items[i - 1][4]) return;
          const a = slots[i - 1][0];
          const b = slots[i][0];
          if ((b - a) * midR > 1.2) arches.push([(a + b) / 2, artifact[4]]);
        });
      } else {
        const clear = 0.22;
        const gap = 2.8 / midR;
        const eraChanges = items.filter((item, i) => i > 0 && item[4] !== items[i - 1][4]).length;
        const step = (TAU - clear * 2 - gap * eraChanges) / (items.length - 1);
        let theta = portal + clear;
        items.forEach((artifact, i) => {
          if (i > 0) {
            if (artifact[4] !== items[i - 1][4]) { arches.push([theta + (step + gap) / 2, artifact[4]]); theta += gap; }
            theta += step;
          }
          let onOuter = i % 2 === 0;
          if (onOuter && doorClear(theta, outerR)) onOuter = false;
          slots.push([theta, onOuter]);
        });
      }
      // With the shared wall the arch posts stand free in the aisle, clear of
      // the lecterns on both walls
      const archInset = bays ? 1.4 : 0.25;
      const yearEntries = [];
      const addArch = (angle, era) => {
        const live = new THREE.Group();
        const still = new THREE.Group();
        [live, still].forEach((holder) => { holder.rotation.y = angle; });
        eraArch(live, still, 0, innerR + archInset, outerR - archInset, h, era);
        group.add(live);
        decor.add(still);
      };
      arches.forEach(([angle, era]) => {
        addArch(angle, era);
        yearEntries.push({ angle, text: ERAS[era].name.toUpperCase(), color: ERAS[era].accent, font: 'bold 22px Arial' });
      });
      slots.forEach(([theta, onOuter], i) => {
        const artifact = items[i];
        const radius = onOuter ? outerR - 0.02 : innerR + (bays ? -0.03 : 0.05);
        const [x, z] = toXZ(theta, radius);
        placeExhibit(group, decor, beams, artifact, x, z, onOuter ? theta + Math.PI : theta, h);
        yearEntries.push({ angle: theta, text: artifact[0] === 2026 ? 'TODAY' : String(artifact[0]), color: '#ffe8a3', font: 'bold 34px Georgia, serif' });
      });
      // First arch right after the portal; start / end markers
      addArch(portal + 0.12, 'early');
      yearEntries.push({ angle: portal + 0.06, text: 'START  >>', color: '#8ce99a', font: 'bold 26px Arial' });
      yearEntries.push({ angle: portal + TAU - 0.06, text: '<< END', color: '#ff8fab', font: 'bold 26px Arial' });
      for (let k = 0; k < 4; k++) {
        const start = portal + k * Math.PI / 2;
        const end = start + Math.PI / 2;
        timelineArc(group, `ring${k}`, yearEntries.filter((entry) => entry.angle >= start - 0.02 && entry.angle < end + 0.02), start, Math.PI / 2, midR);
      }
      // No decorative visitor figures in the underground (only real players)
      // Dark rock shell around the whole underground (decorative, never blocks):
      // whatever the camera sees through a gap is rock, never the city or sky
      // (sized so the ring, its alcoves, the Gig Plaza and the gallery all fit)
      const shellCenter = new THREE.Vector3(...((data && data.shellCenter) || [60, 12, -22]));
      const shell = new THREE.Mesh(new THREE.BoxGeometry(200, 25, 200), new THREE.MeshBasicMaterial({ color: '#0d0a08', side: THREE.BackSide }));
      shell.position.copy(shellCenter);
      shell.raycast = () => {};
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.frustumCulled = false;
      group.add(shell);
      finishHall(group, decor, beams);
    },

    // Promenade from the ring to the Minimal Art Gallery (along +x, open at
    // both ends: the ring vestibule on the west, the gallery door on the east)
    galleryLink(group, { w, h, d, label }) {
      const surfaces = hallSurfaces(w, d);
      const decor = new THREE.Group();
      decor.add(box(w, 0.3, d, surfaces.floor, 0, 0.15, 0));
      decor.add(box(w, 0.3, d, surfaces.ceiling, 0, h + 0.15, 0));
      [-1, 1].forEach((side) => decor.add(box(w, h, 0.3, surfaces.wall, 0, h / 2, side * (d / 2 - 0.15))));
      const strip = box(w - 1, 0.06, 0.5, glow('#fff3c4', 1), 0, h - 0.03, 0);
      strip.raycast = () => {};
      group.add(strip);
      const runner = mesh(new THREE.PlaneGeometry(w, 1.6), material('#2b2b2b', { roughness: 0.9 }), 0, 0.31, 0);
      runner.rotation.x = -Math.PI / 2;
      runner.castShadow = false;
      group.add(runner);
      // Generative posters (drawn in code) on both walls
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const x = -w / 2 + 5 + Math.floor(i / 2) * ((w - 10) / 3);
        const poster = canvasTexture(`linkPoster|${i}`, 256, 320, (ctx, cw, ch) => {
          const hue = (i * 47) % 360;
          ctx.fillStyle = `hsl(${hue}, 30%, 92%)`; ctx.fillRect(0, 0, cw, ch);
          for (let k = 0; k < 12; k++) {
            ctx.fillStyle = `hsla(${(hue + k * 25) % 360}, 70%, ${40 + (k % 3) * 12}%, 0.8)`;
            if (i % 3 === 0) { ctx.beginPath(); ctx.arc(cw / 2, ch / 2 - 20, 110 - k * 9, 0, Math.PI * 2); ctx.fill(); }
            else if (i % 3 === 1) ctx.fillRect(20 + k * 18, 40 + (k % 4) * 30, 14, 180);
            else { ctx.beginPath(); ctx.moveTo(0, 60 + k * 18); ctx.bezierCurveTo(80, k * 22, 170, 120 + k * 10, cw, 50 + k * 16); ctx.lineWidth = 6; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
          }
          ctx.fillStyle = '#222222'; ctx.font = 'bold 18px Arial'; ctx.fillText(`STUDY No.${i + 1}`, 20, ch - 20);
        });
        decor.add(box(2.2, 2.7, 0.08, material('#111111'), x, 2.3, side * (d / 2 - 0.34)));
        const art = mesh(new THREE.PlaneGeometry(2, 2.5), new THREE.MeshBasicMaterial({ map: poster }), x, 2.3, side * (d / 2 - 0.39));
        art.rotation.y = side > 0 ? Math.PI : 0;
        group.add(art);
      }
      // Benches and plants
      [-12, 4, 18].forEach((x) => {
        const bench = new THREE.Group();
        bench.add(box(2.4, 0.1, 0.6, material('#6b4423'), 0, 0.75, 0));
        [-1, 1].forEach((s) => bench.add(box(0.1, 0.45, 0.5, hallParts().dark, s * 1.05, 0.52, 0)));
        bench.position.set(x, 0, 1.6);
        group.add(PropKit.kit.interactive(bench, 'sit', 'Bench'));
      });
      [-20, -4, 11].forEach((x) => {
        decor.add(cylinder(0.4, 0.32, 0.7, material('#d9cbb3'), x, 0.65, -2, 12));
        decor.add(sphere(0.7, material('#2f9e44', { flatShading: true }), x, 1.5, -2, 8));
      });
      const sign = textSprite(label || 'Minimal Art Gallery  >>', { width: 7, background: 'rgba(40, 40, 40, 0.9)' });
      sign.position.set(-w / 2 + 4, h - 0.9, 0);
      group.add(sign);
      group.add(PropKit.kit.mergeByMaterial(decor));
    }
  });

  // Generative digital artworks for the minimalist gallery (drawn in code, no external images)
  const ARTWORKS = [
    ['flow', 'Flow Field #01', 'Thousands of particles following a noise field. Generative art, 2021.'],
    ['circles', 'Concentric Signal', 'Rings of color pulsing out from a single point, like a ping in the network.'],
    ['grid', 'Brutal Grid', 'A study of concrete, weight and negative space inspired by brutalist architecture.'],
    ['waves', 'Parametric Waves', 'Sine waves stacked with shifting phase: parametric design in two dimensions.'],
    ['voxels', 'Voxel Sunset', 'A low-resolution sunset made of floating cubes, a tribute to early 3D worlds.'],
    ['lines', 'Commit Lines', 'Each line is one commit of a fictional repository, colored by author.']
  ];

  function artworkTexture(kind) {
    return canvasTexture(`gallery|${kind}`, 512, 640, (ctx, w, h) => {
      let seed = kind.length * 977;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      ctx.fillStyle = kind === 'grid' ? '#e9e5dc' : '#0b0d17';
      ctx.fillRect(0, 0, w, h);
      if (kind === 'flow') {
        for (let i = 0; i < 700; i++) {
          let x = random() * w; let y = random() * h;
          ctx.strokeStyle = `hsla(${190 + random() * 80}, 90%, 60%, 0.5)`;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let step = 0; step < 30; step++) { const angle = Math.sin(x * 0.01) * 2 + Math.cos(y * 0.012) * 2; x += Math.cos(angle) * 4; y += Math.sin(angle) * 4; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      } else if (kind === 'circles') {
        for (let r = 300; r > 0; r -= 14) { ctx.strokeStyle = `hsl(${(r * 1.4) % 360}, 85%, 60%)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); }
      } else if (kind === 'grid') {
        for (let i = 0; i < 18; i++) { ctx.fillStyle = ['#1c1c1c', '#8a8a8a', '#c0392b', '#d6d2c4'][Math.floor(random() * 4)]; ctx.fillRect(Math.floor(random() * 6) * 85, Math.floor(random() * 8) * 80, 85 * (1 + Math.floor(random() * 2)), 80 * (1 + Math.floor(random() * 3))); }
      } else if (kind === 'waves') {
        for (let row = 0; row < 40; row++) { ctx.strokeStyle = `hsl(${280 + row * 2}, 80%, ${40 + row}%)`; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= w; x += 6) { const y = 40 + row * 15 + Math.sin(x * 0.02 + row * 0.3) * 30; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      } else if (kind === 'voxels') {
        const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#2b1055'); sky.addColorStop(1, '#ff7e5f'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffd166'; for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if (Math.hypot(x - 3.5, y - 3.5) < 4) ctx.fillRect(160 + x * 24, 200 + y * 24, 22, 22);
        for (let i = 0; i < 60; i++) { ctx.fillStyle = `hsl(${260 + random() * 40}, 50%, ${10 + random() * 20}%)`; const s = 20 + random() * 40; ctx.fillRect(random() * w, h * 0.6 + random() * h * 0.4, s, s); }
      } else {
        const colors = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'];
        for (let i = 0; i < 90; i++) { ctx.strokeStyle = colors[Math.floor(random() * colors.length)]; ctx.lineWidth = 3; const y = 20 + i * 6.8; ctx.beginPath(); ctx.moveTo(30 + random() * 60, y); ctx.lineTo(200 + random() * 280, y); ctx.stroke(); }
      }
    });
  }

  Object.assign(builders, {
    // Minimalist digital art gallery: white exposed concrete, very high ceiling,
    // floating glass walkways over a water mirror, black frames that show a
    // floating "View Details" button when you walk up to them
    minimalGallery(group, { w, h, d, label }) {
      const concrete = new THREE.MeshStandardMaterial({ map: PropKit.kit.repeated(PropKit.kit.stuccoTexture('#e8e6e1'), 6, 3), roughness: 0.95, side: THREE.DoubleSide });
      // Water mirror floor (slightly below the walkways)
      const water = box(w, 0.1, d, material('#0e1a24', { metalness: 0.9, roughness: 0.05 }), 0, -0.6, 0);
      water.castShadow = false;
      group.add(water);
      group.add(box(w, 0.2, d, material('#2a2a2a'), 0, -0.75, 0));
      // Walls (entrance in the -x wall), very high ceiling with a light slot
      [-1, 1].forEach((side) => group.add(box(w, h, 0.6, concrete, 0, h / 2, side * d / 2)));
      group.add(box(0.6, h, d, concrete, w / 2, h / 2, 0));
      [-1, 1].forEach((side) => group.add(box(0.6, h, (d - 4.4) / 2, concrete, -w / 2, h / 2, side * (d + 4.4) / 4)));
      group.add(box(0.6, h - 4.6, 4.4, concrete, -w / 2, 4.6 + (h - 4.6) / 2, 0));
      group.add(box(w, 0.6, d, concrete, 0, h, 0));
      const slot = box(w * 0.8, 0.1, 1.2, glow('#ffffff', 1.4), 0, h - 0.35, 0);
      slot.raycast = () => {};
      group.add(slot);
      // Glass walkways: a central spine plus side walks along the walls
      const glass = material('#cfe8ff', { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
      const walk = (x, z, ww, dd, y = 0) => { const slab = box(ww, 0.15, dd, glass, x, y, z); slab.castShadow = false; group.add(slab); group.add(box(ww, 0.04, 0.08, glow('#bfe3ff', 1), x, y + 0.1, z - dd / 2)); group.add(box(ww, 0.04, 0.08, glow('#bfe3ff', 1), x, y + 0.1, z + dd / 2)); };
      walk(0, 0, w, 3.4);
      [-1, 1].forEach((side) => walk(0, side * (d / 2 - 2.2), w - 2, 2.6));
      [-w / 4, w / 4].forEach((x) => [-1, 1].forEach((side) => walk(x, side * (d / 4 + 0.2), 2.4, d / 2 - 4.2)));
      // Upper floating walkway (mezzanine bridge) with a ramp
      walk(w / 2 - 4, 0, 5, d - 2, 6);
      const ramp = box(14, 0.15, 2.6, glass, w / 2 - 13.5, 3, -d / 2 + 2.2);
      ramp.rotation.z = -Math.atan2(6, 14);
      group.add(ramp);
      // Black frames on the long walls
      ARTWORKS.forEach(([kind, title, info], index) => {
        const side = index % 2 ? 1 : -1;
        const x = -w / 2 + w / 6 + Math.floor(index / 2) * (w / 3);
        const z = side * (d / 2 - 0.4);
        const frame = new THREE.Group();
        frame.add(box(3.8, 4.6, 0.25, material('#111111', { roughness: 0.4 }), 0, 0, 0));
        frame.add(box(3.2, 4, 0.05, new THREE.MeshBasicMaterial({ map: artworkTexture(kind) }), 0, 0, 0.14));
        frame.position.set(x, 3.4, z);
        frame.rotation.y = side > 0 ? Math.PI : 0;
        frame.userData = { label: title, info: `${info} (In-game artwork, not for sale.)` };
        group.add(PropKit.kit.interactive(frame, 'inspect', title));
        // Floating "View Details" button that appears when you walk up
        const button = textSprite('View Details  ·  E', { width: 3.6, background: 'rgba(17, 17, 17, 0.92)' });
        button.position.set(x, 0.9, z - side * 1.6);
        button.visible = false;
        group.add(button);
        animate(button, (time) => {
          const position = typeof avatar !== 'undefined' ? avatar.position : null;
          const world = button.getWorldPosition(new THREE.Vector3());
          button.visible = !!position && position.distanceTo(world) < 5;
          button.position.y = 0.9 + Math.sin(time * 2 + index) * 0.08;
        });
      });
      // Minimal sculpture: a floating white sphere above the water
      const orb = sphere(1.4, material('#f8f9fa', { roughness: 0.2 }), w / 4, 3, 0, 32);
      group.add(orb);
      animate(orb, (time) => { orb.position.y = 3 + Math.sin(time) * 0.4; });
      const title = textSprite(label || 'Minimal Art Gallery', { width: 8, background: 'rgba(17, 17, 17, 0.9)' });
      title.position.set(-w / 2 + 3, 6, 0);
      group.add(title);
    }
  });

  function hardwareModel(kind) {
    const item = new THREE.Group();
    const dark = material('#2b2d33', { roughness: 0.5 });
    const beige = material('#d8cfc0', { roughness: 0.6 });
    if (kind === 'zipdisk') { item.add(box(1, 0.15, 1, material('#1c7ed6'), 0, 0.08, 0)); item.add(box(0.6, 0.02, 0.4, material('#e9ecef'), 0, 0.17, 0.2)); }
    else if (kind === 'pager') { item.add(box(0.7, 0.25, 0.4, dark, 0, 0.15, 0)); item.add(box(0.5, 0.02, 0.2, glow('#94d82d', 0.8), 0, 0.28, 0)); }
    else if (kind === 'pda') { item.add(box(0.55, 0.12, 0.9, material('#868e96'), 0, 0.06, 0)); item.add(box(0.42, 0.02, 0.55, glow('#c3fae8', 0.4), 0, 0.13, -0.05)); item.add(cylinder(0.02, 0.02, 0.8, dark, 0.35, 0.1, 0, 6)).children; }
    else if (kind === 'modem') { item.add(box(1.2, 0.3, 0.8, beige, 0, 0.15, 0)); for (let i = 0; i < 6; i++) item.add(box(0.06, 0.04, 0.04, glow(i % 2 ? '#ff6b6b' : '#94d82d', 1.2), -0.4 + i * 0.16, 0.25, 0.41)); }
    else if (kind === 'crt') { item.add(box(1.2, 1, 1.1, beige, 0, 0.5, 0)); item.add(box(0.95, 0.75, 0.02, glow('#1864ab', 0.5), 0, 0.55, 0.56)); }
    else if (kind === 'joystick') { item.add(box(0.7, 0.2, 0.7, dark, 0, 0.1, 0)); item.add(cylinder(0.05, 0.07, 0.7, dark, 0, 0.5, 0, 8)); item.add(sphere(0.12, material('#e03131'), 0, 0.9, 0, 10)); }
    else if (kind === 'floppy') { item.add(box(0.9, 0.04, 0.9, dark, 0, 0.02, 0)); item.add(box(0.5, 0.045, 0.25, material('#adb5bd', { metalness: 0.8 }), 0, 0.03, -0.3)); item.add(box(0.6, 0.045, 0.35, material('#f8f9fa'), 0, 0.03, 0.22)); }
    else { const egg = sphere(0.35, material('#f783ac'), 0, 0.38, 0, 16); egg.scale.y = 1.25; item.add(egg); item.add(box(0.28, 0.2, 0.02, glow('#c3fae8', 0.4), 0, 0.42, 0.33)); }
    return item;
  }

  Object.assign(builders, {
    // A building inside a building: the Timeline Hall (stone walls, skylight,
    // a timeline on the floor and lit frames from 1969 to 2005) wraps the
    // white "Memorable Mentions" vault with forgotten hardware on pedestals
    timelineHall(group, { w, h, d, label }) {
      const stone = material('#c9b79c', { roughness: 0.8 });
      const floor = new THREE.MeshStandardMaterial({ map: PropKit.kit.repeated(PropKit.kit.gridTexture('#efe7db', '#d6cbb8', 4), w / 6, d / 6), roughness: 0.6 });
      group.add(box(w, 0.3, d, floor, 0, 0.15, 0));
      // Outer walls with an entrance on the front (+z)
      group.add(box(w, h, 0.8, stone, 0, h / 2, -d / 2));
      [-1, 1].forEach((side) => group.add(box(0.8, h, d, stone, side * w / 2, h / 2, 0)));
      [-1, 1].forEach((side) => group.add(box(w / 2 - 3, h, 0.8, stone, side * (w / 4 + 1.5), h / 2, d / 2)));
      group.add(box(6, h - 5, 0.8, stone, 0, 5 + (h - 5) / 2, d / 2));
      // Roof ring with a glass skylight and columns
      group.add(box(w + 1, 0.6, 4, stone, 0, h, -d / 2 + 2));
      group.add(box(w + 1, 0.6, 4, stone, 0, h, d / 2 - 2));
      [-1, 1].forEach((side) => group.add(box(4, 0.6, d - 8, stone, side * (w / 2 - 2), h, 0)));
      const skylight = box(w - 8, 0.2, d - 8, material('#cfe8ff', { transparent: true, opacity: 0.3, roughness: 0.05 }), 0, h, 0);
      skylight.castShadow = false;
      group.add(skylight);
      const title = PropKit.kit.textSprite(label || 'Timeline Hall · Forgotten Software & Hardware', { width: 14, background: 'rgba(93, 64, 55, 0.92)' });
      title.position.set(0, h + 2, d / 2 + 1);
      group.add(title);
      // Timeline line on the floor around the inner vault, with year markers
      const pathRadius = Math.min(w, d) / 2 - 4;
      const line = mesh(new THREE.RingGeometry(pathRadius - 0.15, pathRadius + 0.15, 64), glow('#ffb703', 1), 0, 0.32, 0);
      line.rotation.x = -Math.PI / 2;
      group.add(line);
      // Frames on the outer walls in chronological order (left wall, back wall, right wall)
      const wallSpots = [];
      const perSide = Math.ceil(TIMELINE.length / 3);
      for (let i = 0; i < TIMELINE.length; i++) {
        const sideIndex = Math.floor(i / perSide);
        const t = (i % perSide + 0.5) / perSide;
        if (sideIndex === 0) wallSpots.push([-w / 2 + 0.5, d / 2 - 3 - t * (d - 6), Math.PI / 2]);
        else if (sideIndex === 1) wallSpots.push([-w / 2 + 3 + t * (w - 6), -d / 2 + 0.5, 0]);
        else wallSpots.push([w / 2 - 0.5, -d / 2 + 3 + t * (d - 6), -Math.PI / 2]);
      }
      TIMELINE.forEach(([year, kind, name, info], index) => {
        const [x, z, rotation] = wallSpots[index];
        const frame = new THREE.Group();
        frame.add(box(3.6, 2.9, 0.15, material('#3e2723'), 0, 0, 0));
        frame.add(box(3.3, 2.5, 0.05, new THREE.MeshBasicMaterial({ map: timelineTexture(kind) }), 0, 0, 0.1));
        frame.add(box(2, 0.5, 0.05, new THREE.MeshBasicMaterial({ map: labelTexture(`${year} · ${name}`, { bg: '#3e2723', fg: '#ffe8a3', width: 512, height: 100, font: 'bold 34px Georgia, serif' }) }), 0, -1.75, 0.1));
        frame.add(box(1.8, 0.1, 0.3, glow('#fff3c4', 1.6), 0, 1.6, 0.3));
        frame.position.set(x, 3.4, z);
        frame.rotation.y = rotation;
        frame.userData = { label: `${year} · ${name}`, info };
        group.add(PropKit.kit.interactive(frame, 'inspect', name));
        // Year marker on the floor timeline
        const angle = Math.atan2(z, x);
        const marker = PropKit.kit.textSprite(String(year), { width: 1.6, background: 'rgba(255, 183, 3, 0.9)', color: '#3e2723' });
        marker.position.set(Math.cos(angle) * pathRadius, 0.9, Math.sin(angle) * pathRadius);
        group.add(marker);
      });
      // Inner building: the Memorable Mentions vault (white, with an open front)
      const vault = new THREE.Group();
      const vw = w * 0.42;
      const vd = d * 0.42;
      const vh = h * 0.55;
      const white = material('#f8f9fa', { roughness: 0.4 });
      vault.add(box(vw, vh, 0.4, white, 0, vh / 2, -vd / 2));
      [-1, 1].forEach((side) => vault.add(box(0.4, vh, vd, white, side * vw / 2, vh / 2, 0)));
      [-1, 1].forEach((side) => vault.add(box(vw / 2 - 1.6, vh, 0.4, white, side * (vw / 4 + 0.8), vh / 2, vd / 2)));
      vault.add(box(vw + 0.6, 0.4, vd + 0.6, white, 0, vh, 0));
      vault.add(box(vw * 0.8, 0.08, 0.5, glow('#4dabf7', 1.2), 0, vh - 0.3, vd / 2 + 0.25));
      const sign = box(vw * 0.6, 0.9, 0.1, new THREE.MeshBasicMaterial({ map: labelTexture('MEMORABLE MENTIONS', { bg: '#1c2a5a', fg: '#ffffff', width: 512, height: 100, font: 'bold 44px Segoe UI, Arial, sans-serif' }) }), 0, vh + 0.9, vd / 2 + 0.3);
      vault.add(sign);
      MEMORABLE_MENTIONS.forEach(([kind, name, info], index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = -vw / 2 + 1.6 + column * ((vw - 3.2) / 3);
        const z = -vd / 2 + 1.8 + row * 2.6;
        vault.add(cylinder(0.5, 0.6, 1, material('#dee2e6'), x, 0.5, z, 16));
        const model = hardwareModel(kind);
        model.position.set(x, 1, z);
        model.userData = { label: name, info };
        vault.add(PropKit.kit.interactive(model, 'inspect', name));
        vault.add(box(0.06, 0.06, 0.6, glow('#fff3c4', 1.2), x, vh - 0.6, z));
      });
      group.add(vault);
      group.userData.label = 'Timeline Hall';
    }
  });

  const rules = [
    [/giant_floppy/, 'giantFloppy'],
    [/giant_cpu/, 'giantCpu'],
    [/crt_parkour/, 'crtParkour'],
    [/giant_keyboard/, 'giantKeyboard'],
    [/cassette/, 'cassette'],
    [/cdrom/, 'cdrom'],
    [/tube_wall/, 'tubeWall'],
    [/punch_cards/, 'punchCards'],
    [/software_wall/, 'softwareWall'],
    [/ball_mouse/, 'ballMouse'],
    [/museum_entrance/, 'museumHall'],
    [/history_ring/, 'historyRing'],
    [/gallery_link/, 'galleryLink'],
    [/minimal_gallery/, 'minimalGallery'],
    [/timeline_hall/, 'timelineHall']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
