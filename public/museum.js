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
        ctx.fillStyle = '#ffd700'; ctx.fillRect(120, 160, 270, 50); ctx.fillStyle = '#000'; ctx.font = 'bold 22px Arial'; ctx.fillText('🚧 UNDER CONSTRUCTION 🚧', 128, 193);
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

  const HISTORY = [
    ['arpanet', 'ARPANET (1969)', 'The first packet-switched network connected UCLA, SRI, UCSB and the University of Utah. Its first message, "LO", crashed while typing "LOGIN".'],
    ['email', 'First network email (1971)', 'Ray Tomlinson sent the first email between two computers and chose the @ sign to separate user and host.'],
    ['basic', 'Home computers & BASIC (1977-1985)', 'Computers booted straight into BASIC: millions of people wrote their first program at a blinking READY prompt.'],
    ['bbs', 'Bulletin Board Systems (1978-1995)', 'Dial-up BBSes with ANSI art hosted message boards, file libraries and door games, one caller at a time.'],
    ['dos', 'The command line era (1981)', 'DOS prompts, AUTOEXEC.BAT and CONFIG.SYS: tuning memory to run one more program.'],
    ['usenet', 'Usenet & the birth of Linux (1991)', 'On comp.os.minix a student announced "just a hobby" operating system. It became Linux.'],
    ['firstsite', 'The first website (1991)', 'At CERN, Tim Berners-Lee published the first web page, explaining what the World Wide Web was.'],
    ['browser', 'Graphical browsers (1993)', 'Browsers that showed images inline with text made the web accessible to everyone.'],
    ['irc', 'IRC chat rooms (1988-2000s)', 'Internet Relay Chat channels were where developers met, helped each other and shipped open source.'],
    ['homepage', 'Personal homepages (1995-2000)', 'Starry backgrounds, visitor counters, guestbooks, webrings and "under construction" banners.'],
    ['search', 'Web directories & search (1994-1998)', 'Before ranking algorithms, hand-curated directories and early engines helped people find pages.'],
    ['desktop', 'The desktop GUI (1990s)', 'Start menus, title bars and error dialogs: the windows-and-mouse era went mainstream.']
  ];

  Object.assign(builders, {
    // Long, wide museum corridor: red carpet, lit frames with the early internet & software
    historyCorridor(group, { w, h, d, label }) {
      const length = w;
      const width = d;
      const wall = material('#f1e6d2', { roughness: 0.8 });
      const wood = material('#5d3a1a', { roughness: 0.6 });
      group.add(box(length, 0.3, width, material('#3a2416'), 0, 0.15, 0));
      group.add(box(length, 0.05, width * 0.55, material('#b3001b', { roughness: 1 }), 0, 0.32, 0));
      [-1, 1].forEach((side) => group.add(box(length, 0.06, 0.18, material('#d4a017', { metalness: 0.8, roughness: 0.3 }), 0, 0.34, side * width * 0.28)));
      [-1, 1].forEach((side) => {
        group.add(box(length, h, 0.4, wall, 0, h / 2, side * (width / 2)));
        group.add(box(length, 0.5, 0.5, wood, 0, 0.25, side * (width / 2 - 0.3)));
      });
      // End wall with a doorway into the art gallery
      const door = 4.4;
      [-1, 1].forEach((side) => group.add(box(0.4, h, (width - door) / 2, wall, length / 2, h / 2, side * (width + door) / 4)));
      group.add(box(0.4, h - 4.6, door, wall, length / 2, 4.6 + (h - 4.6) / 2, 0));
      group.add(box(length, 0.3, width, material('#2b1d14'), 0, h + 0.15, 0));
      // Ceiling light strip
      group.add(box(length * 0.95, 0.08, 0.6, glow('#fff3c4', 1.2), 0, h - 0.05, 0));
      const perSide = Math.ceil(HISTORY.length / 2);
      const spacing = (length - 8) / perSide;
      HISTORY.forEach(([kind, title, info], index) => {
        const side = index % 2 ? 1 : -1;
        const x = -length / 2 + 6 + Math.floor(index / 2) * spacing;
        const z = side * (width / 2 - 0.25);
        const frame = new THREE.Group();
        frame.add(box(4.6, 3.6, 0.2, material('#d4a017', { metalness: 0.7, roughness: 0.3 }), 0, 0, 0));
        frame.add(box(4.2, 3.2, 0.05, new THREE.MeshBasicMaterial({ map: historyTexture(kind) }), 0, 0, 0.12));
        frame.add(facedBox(3.4, 0.7, 0.05, material('#2b1d14'), new THREE.MeshBasicMaterial({ map: labelTexture(title, { bg: '#2b1d14', fg: '#ffe8a3', width: 512, height: 100, font: 'bold 34px Georgia, serif' }) }), 0, -2.4, 0.1));
        // Picture light above each frame
        frame.add(box(2.4, 0.12, 0.4, material('#1b1b1b', { metalness: 0.6 }), 0, 2.2, 0.35));
        frame.add(box(2.2, 0.04, 0.3, glow('#fff3c4', 2), 0, 2.13, 0.4));
        frame.position.set(x, h * 0.48, z);
        frame.rotation.y = side > 0 ? Math.PI : 0;
        frame.userData = { label: title, info };
        group.add(PropKit.kit.interactive(frame, 'inspect', title));
        // Velvet rope stanchions in front of every frame
        [-1.6, 1.6].forEach((dx) => group.add(cylinder(0.08, 0.12, 1, material('#d4a017', { metalness: 0.8 }), x + dx, 0.8, z - side * 1.4, 8)));
        const rope = cylinder(0.05, 0.05, 3.2, material('#8b0000'), x, 1.15, z - side * 1.4, 6);
        rope.rotation.z = Math.PI / 2;
        group.add(rope);
      });
      const title = textSprite(label || 'Hall of Internet History', { width: 10, background: 'rgba(179, 0, 27, 0.9)' });
      title.position.set(-length / 2 + 3, h - 1, 0);
      group.add(title);
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
    [/history_corridor/, 'historyCorridor'],
    [/minimal_gallery/, 'minimalGallery']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
