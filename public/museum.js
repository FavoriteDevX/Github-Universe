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
    [/museum_entrance/, 'museumHall']
  ];
  rules.slice().reverse().forEach(([pattern, name]) => PropKit.registerBuilder(pattern, name, builders[name]));
})();
