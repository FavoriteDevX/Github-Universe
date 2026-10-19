// ============================================================================
// VEHICLES: FLOATING CYBER-HYPERCARS AND TRON-STYLE LIGHT CYCLES
// ============================================================================
// A showroom in Genesis Plaza displays concept vehicles inspired by real
// hypercars (Italian supercar curves, angular wedges, minimalist EVs) with no
// brand names or logos. Press E to ride one: hypercars hover 30cm above the
// ground on magnetic light, light cycles leave a solid neon trail.
const Vehicles = (() => {
  const { material, glow, mesh, box, cylinder, sphere, facedBox, animate, textSprite, labelTexture, repeated } = PropKit.kit;
  const MODELS = {
    rosso: { name: 'Rosso Hypercar', inspiration: 'Italian supercar curves', color: '#d00000', speed: 34, kind: 'car' },
    wedge: { name: 'Wedge GT', inspiration: 'sharp V12 wedge styling', color: '#c0ff00', speed: 36, kind: 'car' },
    volt: { name: 'Volt S', inspiration: 'minimalist electric sedan', color: '#e9ecef', speed: 32, kind: 'car' },
    cyberwedge: { name: 'Cyber Wedge', inspiration: 'stainless-steel electric truck', color: '#adb5bd', speed: 28, kind: 'car' },
    cycle: { name: 'Light Cycle', inspiration: 'neon light cycles', color: '#22d3ee', speed: 40, kind: 'cycle' },
    cycleRed: { name: 'Light Cycle (red)', inspiration: 'neon light cycles', color: '#ff2e63', speed: 40, kind: 'cycle' }
  };

  let hooks = null;
  let mounted = null;
  const trail = [];
  let lastTrailAt = 0;
  const remoteVehicles = new Map();

  // --------------------------------------------------------------------------
  // Models (front of the vehicle points to -z)
  // --------------------------------------------------------------------------
  function carBody(profile, length, width, bodyMaterial) {
    const shape = new THREE.Shape();
    shape.moveTo(profile[0][0], profile[0][1]);
    profile.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3 });
    geometry.translate(0, 0, -width / 2);
    geometry.rotateY(Math.PI / 2);
    geometry.scale(1, 1, length / 4.6);
    return mesh(geometry, bodyMaterial);
  }

  function buildModel(key) {
    const model = MODELS[key];
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    if (model.kind === 'cycle') {
      const neon = glow(model.color, 1.8);
      [-1, 1].forEach((side) => {
        const ring = mesh(new THREE.TorusGeometry(0.75, 0.16, 10, 32), material('#0b0b12', { metalness: 0.6, roughness: 0.3 }), 0, 0.85, side * 1.25);
        ring.rotation.y = Math.PI / 2;
        body.add(ring);
        const glowRing = mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 32), neon, 0, 0.85, side * 1.25);
        glowRing.rotation.y = Math.PI / 2;
        body.add(glowRing);
      });
      const shell = box(0.55, 0.7, 2.4, material('#0b0b12', { metalness: 0.8, roughness: 0.25 }), 0, 1.1, 0);
      body.add(shell);
      body.add(box(0.58, 0.08, 2.5, neon, 0, 1.45, 0));
      body.add(box(0.5, 0.3, 0.9, material('#1b1b2f', { metalness: 0.6, roughness: 0.2 }), 0, 1.55, -0.2));
    } else {
      const paint = new THREE.MeshStandardMaterial({ color: model.color, metalness: 0.95, roughness: 0.18 });
      const profiles = {
        rosso: [[-2.3, 0.35], [2.3, 0.35], [2.35, 0.75], [1.4, 0.95], [0.4, 1.35], [-0.6, 1.3], [-1.6, 0.95], [-2.35, 0.75]],
        wedge: [[-2.3, 0.3], [2.3, 0.3], [2.3, 0.85], [0.6, 1.25], [-0.2, 1.3], [-2.35, 0.55]],
        volt: [[-2.3, 0.35], [2.3, 0.35], [2.3, 0.8], [1.2, 1.0], [0.4, 1.45], [-0.9, 1.45], [-1.7, 1.0], [-2.35, 0.75]],
        cyberwedge: [[-2.4, 0.4], [2.4, 0.4], [2.4, 1.0], [0.2, 1.7], [-2.4, 0.95]]
      };
      const lengths = { rosso: 4.6, wedge: 4.7, volt: 4.8, cyberwedge: 5.6 };
      const car = carBody(profiles[key], lengths[key], 1.8, paint);
      body.add(car);
      // Cockpit glass, underglow light strips, neon headlights and tail bar
      body.add(box(1.4, 0.35, 1.2, material('#0b1a2a', { roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.85 }), 0, key === 'cyberwedge' ? 1.35 : 1.2, -0.1));
      const underglow = box(1.6, 0.05, lengths[key] * 0.85, glow(model.color === '#e9ecef' ? '#4dabf7' : model.color, 2), 0, 0.22, 0);
      body.add(underglow);
      [-0.6, 0.6].forEach((x) => body.add(box(0.4, 0.08, 0.05, glow('#ffffff', 2), x, 0.65, -lengths[key] / 2 - 0.05)));
      body.add(box(1.7, 0.08, 0.05, glow('#ff1e3c', 2), 0, 0.7, lengths[key] / 2 + 0.05));
      // Color shifting carbon/chrome paint "to the rhythm"
      animate(group, (time) => {
        if (key === 'volt' || key === 'cyberwedge') return;
        paint.color.setHSL((new THREE.Color(model.color).getHSL({}).h + Math.sin(time * 0.5) * 0.04 + 1) % 1, 0.9, 0.45);
      });
    }
    // Magnetic light strip under the floating vehicle
    const strip = box(model.kind === 'cycle' ? 0.5 : 1.8, 0.02, model.kind === 'cycle' ? 3.4 : 4.6, glow(model.color === '#e9ecef' ? '#4dabf7' : model.color, 1.2, { transparent: true, opacity: 0.6 }), 0, 0.02, 0);
    strip.castShadow = false;
    group.add(strip);
    group.userData.body = body;
    group.traverse((node) => { node.castShadow = true; });
    return group;
  }

  // --------------------------------------------------------------------------
  // Showroom builder
  // --------------------------------------------------------------------------
  function showroom(group, { w, h, d, label, block }) {
    const facing = Math.atan2(-block.position[0], -block.position[2]);
    const inner = new THREE.Group();
    inner.rotation.y = facing;
    const glass = material('#d0ebff', { transparent: true, opacity: 0.25, roughness: 0.03, metalness: 0.5, side: THREE.DoubleSide });
    const floorTexture = PropKit.kit.canvasTexture('showroomFloor', 256, 256, (ctx, cw, ch) => {
      ctx.fillStyle = '#1b1b24'; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#2f2f3d'; ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, ch); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(cw, i * 64); ctx.stroke(); }
    });
    inner.add(box(w, 0.3, d, new THREE.MeshStandardMaterial({ map: repeated(floorTexture, w / 6, d / 6), roughness: 0.15, metalness: 0.5 }), 0, 0.15, 0));
    // Glass walls on three sides (front open), flat roof with light panels
    const back = box(w, h, 0.15, glass, 0, h / 2, -d / 2);
    back.castShadow = false;
    inner.add(back);
    [-1, 1].forEach((side) => { const wall = box(0.15, h, d, glass, side * w / 2, h / 2, 0); wall.castShadow = false; inner.add(wall); });
    inner.add(box(w + 0.6, 0.5, d + 0.6, material('#f1f3f5'), 0, h + 0.25, 0));
    for (let i = 0; i < 3; i++) inner.add(box(w * 0.85, 0.05, 1, glow('#ffffff', 0.9), 0, h - 0.03, -d / 3 + i * d / 3));
    // Sign
    inner.add(facedBox(w * 0.6, 1.6, 0.2, material('#0b0b12'), new THREE.MeshBasicMaterial({ map: labelTexture(label || 'Hypercar Showroom', { bg: '#0b0b12', fg: '#22d3ee', border: '#ff2e63', font: 'bold 52px Segoe UI, Arial' }) }), 0, h + 1.4, d / 2));
    // Turntables with the vehicles on display
    const keys = Object.keys(MODELS);
    keys.forEach((key, index) => {
      const row = index < 4 ? 0 : 1;
      const column = row === 0 ? index : index - 4;
      const perRow = row === 0 ? 4 : 2;
      const x = -w / 2 + (column + 0.5) * (w / perRow);
      const z = row === 0 ? -d * 0.18 : d * 0.25;
      const turntable = new THREE.Group();
      turntable.add(cylinder(2.8, 2.8, 0.25, material('#2b2b36', { metalness: 0.7, roughness: 0.2 }), 0, 0.42, 0, 40));
      { const added = mesh(new THREE.TorusGeometry(2.8, 0.06, 6, 48), glow(MODELS[key].color === '#e9ecef' ? '#4dabf7' : MODELS[key].color, 1.6), 0, 0.56, 0); added.rotation.x = Math.PI / 2; turntable.add(added); }
      const vehicle = buildModel(key);
      vehicle.position.y = 0.55;
      turntable.add(vehicle);
      turntable.position.set(x, 0, z);
      const plate = textSprite(`${MODELS[key].name} · inspired by ${MODELS[key].inspiration} · E to ride`, { width: 7, background: 'rgba(11, 11, 18, 0.85)' });
      plate.position.y = 3.6;
      turntable.add(plate);
      turntable.userData.vehicleKey = key;
      inner.add(PropKit.kit.interactive(turntable, 'vehicle', MODELS[key].name));
      animate(turntable, (time) => {
        vehicle.rotation.y = time * 0.35 + index;
        vehicle.position.y = 0.85 + Math.sin(time * 2 + index) * 0.06; // hovering ~30cm
      });
    });
    group.add(inner);
  }

  PropKit.registerBuilder(/vehicle_showroom/, 'vehicleShowroom', showroom);

  // --------------------------------------------------------------------------
  // Riding
  // --------------------------------------------------------------------------
  function mount(key) {
    if (mounted) dismount();
    const model = buildModel(key);
    model.traverse((node) => { node.raycast = () => {}; });
    hooks.scene.add(model);
    mounted = { key, model, heading: 0, last: hooks.avatarPosition().clone() };
    hooks.setVehicle(key);
    hooks.system(`🏎️ You are riding the ${MODELS[key].name}. Hold Shift to boost, press E to get off.`);
  }

  function dismount() {
    if (!mounted) return;
    hooks.scene.remove(mounted.model);
    mounted = null;
    hooks.setVehicle(null);
  }

  function speedFor() {
    return mounted ? MODELS[mounted.key].speed : null;
  }

  function addTrailSegment(from, to, color) {
    const length = from.distanceTo(to);
    if (length < 0.05) return;
    const segment = box(0.12, 1.4, length + 0.1, glow(color, 2.2, { transparent: true, opacity: 0.85 }), 0, 0, 0);
    segment.position.copy(from).lerp(to, 0.5).add(new THREE.Vector3(0, 0.75, 0));
    segment.lookAt(to.x, segment.position.y, to.z);
    segment.raycast = () => {};
    segment.castShadow = false;
    hooks.scene.add(segment);
    trail.push({ segment, born: performance.now() });
  }

  function update(deltaSeconds) {
    const now = performance.now();
    if (mounted) {
      const position = hooks.avatarPosition();
      const moved = new THREE.Vector3(position.x - mounted.last.x, 0, position.z - mounted.last.z);
      if (moved.lengthSq() > 0.0004) mounted.heading = Math.atan2(moved.x, moved.z) + Math.PI;
      mounted.model.position.set(position.x, position.y + 0.3, position.z);
      mounted.model.rotation.y += ((mounted.heading - mounted.model.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, deltaSeconds * 10);
      if (MODELS[mounted.key].kind === 'cycle' && now - lastTrailAt > 60 && moved.lengthSq() > 0.0004) {
        addTrailSegment(mounted.last.clone(), position.clone(), MODELS[mounted.key].color);
        lastTrailAt = now;
        mounted.last.copy(position);
      } else if (MODELS[mounted.key].kind !== 'cycle') {
        mounted.last.copy(position);
      }
    }
    // Trails fade out after three seconds
    for (let i = trail.length - 1; i >= 0; i--) {
      const age = (now - trail[i].born) / 3000;
      trail[i].segment.material.opacity = Math.max(0, 0.85 * (1 - age));
      if (age >= 1) { hooks.scene.remove(trail[i].segment); trail.splice(i, 1); }
    }
    // Other devs' vehicles follow their cursors
    remoteVehicles.forEach((entry) => {
      const position = entry.record.mesh.position;
      const moved = position.x - entry.last.x || position.z - entry.last.z;
      if (moved) entry.heading = Math.atan2(position.x - entry.last.x, position.z - entry.last.z) + Math.PI;
      entry.model.position.set(position.x, position.y + 0.3, position.z);
      entry.model.rotation.y = entry.heading;
      if (MODELS[entry.key].kind === 'cycle' && now - entry.lastTrail > 80 && entry.last.distanceTo(position) > 0.2) {
        addTrailSegment(entry.last.clone(), position.clone(), MODELS[entry.key].color);
        entry.lastTrail = now;
      }
      entry.last.copy(position);
    });
  }

  function setRemote(id, record, key) {
    const existing = remoteVehicles.get(id);
    if (existing) { hooks.scene.remove(existing.model); remoteVehicles.delete(id); }
    if (!key || !MODELS[key] || !record) return;
    const model = buildModel(key);
    model.traverse((node) => { node.raycast = () => {}; });
    hooks.scene.add(model);
    remoteVehicles.set(id, { record, key, model, last: record.mesh.position.clone(), heading: 0, lastTrail: 0 });
  }

  function init(options) {
    hooks = options;
  }

  return { init, mount, dismount, update, speedFor, setRemote, isMounted: () => !!mounted, MODELS };
})();
