// ============================================================================
// THE AZURE CLOUD CORE: A GIANT DATA CLOUD FLOATING OVER AZURE ISLAND
// ============================================================================
// A 50 m wide glowing cloud hovers ten meters above the island. It is built
// from overlapping instanced spheres with a fresnel shader (cyan rim, deep
// blue core, digital scan bands), white data particles crawling over its
// surface and holographic data threads with animated dashes.
// - Upload Beam: a blue light beam on the ground. Stand in it (or press E) and
//   "Uploading... 100%" lifts you inside the hollow cloud.
// - Inside: three translucent floors (13 m, 18 m, 23 m) joined by glowing
//   helical ramps, and "The Data Stream", a swirling particle column in the
//   center that boosts you one level up (from the top it cycles to the bottom).
// - Voxel Sandbox Zone on the top fringe (33 m): a deck of cubes you can mine
//   (click / G) and build on (Shift+click / B / E on the build pad). The edits
//   are kept locally in localStorage "multiverse-azure-voxels".
// - Cloud Storage Lounge (third floor): walls of blinking data cubes, sync
//   totems that snapshot your local "multiverse-" progress and puffy sofas of
//   "solid cloud".
// Name only: no logos or brand assets are used.
const AzureCloud = (() => {
  const { material, glow, box, cylinder, sphere, animate, textSprite, interactive, seat, canvasTexture, labelTexture } = PropKit.kit;

  // Shared layout (district-local coordinates, y = 0 is the island ground)
  const CLOUD_Y = 23; // center of the cloud
  const FLOOR_Y = [13, 18, 23]; // walkable tops of the three inner floors
  const VOXEL_Y = 33; // top of the voxel deck
  const STOPS = [...FLOOR_Y, VOXEL_Y]; // Data Stream stops, bottom to top
  const FLOOR_RADIUS = 11;
  const RAMP_INNER = 11;
  const RAMP_OUTER = 13.6;
  const BEAM_RADIUS = 2;
  const ARRIVAL = new THREE.Vector3(0, FLOOR_Y[0] + 0.3, 5); // where the upload beam drops you
  const GROUND_EXIT = new THREE.Vector3(0, 0.9, 6.5); // next to the beam (island grass is ~0.48 m above y = 0)
  const VOXEL_KEY = 'multiverse-azure-voxels';
  const SYNC_KEY = 'multiverse-azure-sync';
  const VOXEL_CAP = 2000;

  const state = { core: null, uploading: null, cooldown: 0, lounge: null };
  const scratch = new THREE.Vector3();
  const scratch2 = new THREE.Vector3();
  const noRaycast = (object) => { object.traverse((node) => { node.raycast = () => {}; }); return object; };
  const now = () => performance.now();

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function say(text) {
    if (typeof appendSystemMessage === 'function') appendSystemMessage(text);
  }

  function playSound(name) {
    try { if (window.Sound) Sound.play(name); } catch (error) { /* audio is optional */ }
  }

  function moveAvatar(worldPosition) {
    if (typeof avatar === 'undefined') return;
    avatar.position.copy(worldPosition);
    avatar.velocityY = 0;
  }

  // Small HUD line in the middle of the screen (upload progress, whoosh, hints)
  let hud = null;
  let hint = null;
  let hudTimer = 0;
  function hudElements() {
    if (hud) return;
    const style = 'position:fixed;left:50%;transform:translateX(-50%);z-index:40;pointer-events:none;font:600 15px Segoe UI,Arial,sans-serif;color:#e6f7ff;' +
      'background:rgba(6,28,58,0.82);border:1px solid rgba(110,210,255,0.7);border-radius:10px;padding:8px 16px;box-shadow:0 0 18px rgba(60,180,255,0.45);display:none;letter-spacing:0.3px;';
    hud = document.createElement('div');
    hud.id = 'azure-hud';
    hud.style.cssText = `${style}top:22%;font-size:20px;`;
    hint = document.createElement('div');
    hint.id = 'azure-voxel-hint';
    hint.style.cssText = `${style}bottom:118px;font-size:13px;`;
    hint.textContent = 'Voxel Sandbox: Click a block to mine, Shift+click to place (or G to mine, B to build)';
    document.body.appendChild(hud);
    document.body.appendChild(hint);
  }
  function flashHud(text, milliseconds = 1600) {
    hudElements();
    hud.textContent = text;
    hud.style.display = 'block';
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { hud.style.display = 'none'; }, milliseconds);
  }

  // --------------------------------------------------------------------------
  // Shared textures and materials
  // --------------------------------------------------------------------------
  function dotTexture() {
    return canvasTexture('azure|dot', 64, 64, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.35, 'rgba(200,240,255,0.8)');
      gradient.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
  }

  function particleMaterial(size, color = '#ffffff') {
    return new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  }

  // Fresnel cloud shader: deep blue core, cyan rim, slow scan bands, breathing
  function cloudMaterial({ core, rim, opacity, rimPower = 2.2, side = THREE.DoubleSide, breathe = 0.05 }) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: { value: 0 },
        coreColor: { value: new THREE.Color(core) },
        rimColor: { value: new THREE.Color(rim) },
        opacity: { value: opacity },
        rimPower: { value: rimPower },
        breathe: { value: breathe }
      }]),
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        uniform float time;
        uniform float breathe;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vHeight;
        void main() {
          vec3 p = position * (1.0 + breathe * sin(time * 0.7 + position.x * 2.1 + position.y * 1.7));
          vec4 local = vec4(p, 1.0);
          vec3 n = normal;
          #ifdef USE_INSTANCING
            local = instanceMatrix * local;
            n = mat3(instanceMatrix) * n;
          #endif
          vHeight = local.y;
          vec4 mvPosition = modelViewMatrix * local;
          vNormalView = normalize(normalMatrix * n);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 coreColor;
        uniform vec3 rimColor;
        uniform float opacity;
        uniform float rimPower;
        uniform float time;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vHeight;
        void main() {
          float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
          float rim = pow(1.0 - facing, rimPower);
          float band = smoothstep(0.93, 1.0, 0.5 + 0.5 * sin(vHeight * 2.4 - time * 1.6));
          vec3 color = mix(coreColor, rimColor, rim) + rimColor * band * 0.35;
          float alpha = opacity * (0.3 + rim * 1.1) + band * 0.05;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side,
      fog: true
    });
  }

  // --------------------------------------------------------------------------
  // The cloud: puffs, data particles and data threads (decorative, no collisions)
  // --------------------------------------------------------------------------
  function puffLayout() {
    const random = seeded(4242);
    const puffs = [];
    // Bottom layer (local y -9), leaving a hole for the upload beam
    for (let x = -18; x <= 18; x += 6) {
      for (let z = -18; z <= 18; z += 6) {
        const jx = x + (random() - 0.5) * 2.5;
        const jz = z + (random() - 0.5) * 2.5;
        const r = Math.hypot(jx, jz);
        if (r > 19 || r < 4) continue;
        puffs.push([jx, -8.6 + random() * 1.2, jz, 4.2 + random() * 1.2]);
      }
    }
    // Side walls: rings of big puffs
    [[-5.5, 19.5, 5.2], [-0.5, 20, 6], [4.5, 19.5, 5.8], [8.5, 17.5, 5]].forEach(([y, ring, size], layer) => {
      const count = Math.round((Math.PI * 2 * ring) / (size * 1.15));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.4 + (random() - 0.5) * 0.15;
        const radius = ring + (random() - 0.5) * 2;
        puffs.push([Math.cos(angle) * radius, y + (random() - 0.5) * 1.6, Math.sin(angle) * radius, size * (0.85 + random() * 0.3)]);
      }
    });
    // Top rim around the voxel crater (the deck sits at local y 10)
    const topCount = 18;
    for (let i = 0; i < topCount; i++) {
      const angle = (i / topCount) * Math.PI * 2 + 0.2;
      const radius = 14 + random() * 1.5;
      puffs.push([Math.cos(angle) * radius, 9.5 + random() * 1.2, Math.sin(angle) * radius, 3.4 + random() * 1]);
    }
    return puffs;
  }

  function cloudShell(group) {
    const puffs = puffLayout();
    const geometry = new THREE.SphereGeometry(1, 22, 16);
    const outerMaterial = cloudMaterial({ core: '#0d3f8f', rim: '#7fe6ff', opacity: 0.32, rimPower: 2.0 });
    const innerMaterial = cloudMaterial({ core: '#0a2d6b', rim: '#3fb6ff', opacity: 0.18, rimPower: 1.4, side: THREE.BackSide, breathe: 0.03 });
    const outer = new THREE.InstancedMesh(geometry, outerMaterial, puffs.length);
    const inner = new THREE.InstancedMesh(geometry, innerMaterial, puffs.length);
    const matrix = new THREE.Matrix4();
    puffs.forEach(([x, y, z, r], index) => {
      matrix.makeScale(r, r * 0.86, r).setPosition(x, y, z);
      outer.setMatrixAt(index, matrix);
      matrix.makeScale(r * 0.72, r * 0.62, r * 0.72).setPosition(x * 1.02, y, z * 1.02);
      inner.setMatrixAt(index, matrix);
    });
    [outer, inner].forEach((cloud) => { cloud.frustumCulled = false; cloud.renderOrder = 2; group.add(noRaycast(cloud)); });
    inner.renderOrder = 1;

    // A faint gaseous core filling the hollow so the inside reads as "in a cloud"
    const haze = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), cloudMaterial({ core: '#08306e', rim: '#2aa8ff', opacity: 0.1, rimPower: 1.2, side: THREE.BackSide, breathe: 0.01 }));
    haze.scale.set(21, 12, 21);
    group.add(noRaycast(haze));

    // Data particles crawling over the puffs
    const random = seeded(99);
    const count = 420;
    const outerPuffs = puffs.filter(([x, y, z, r]) => Math.hypot(x, z) > 12 || y > 8 || y < -7);
    const specs = [];
    for (let i = 0; i < count; i++) {
      const [px, py, pz, pr] = outerPuffs[Math.floor(random() * outerPuffs.length)];
      const outward = new THREE.Vector3(px, py * 1.4, pz).normalize();
      const axis = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      let base = outward.clone().sub(axis.clone().multiplyScalar(outward.dot(axis)));
      if (base.lengthSq() < 0.01) base = new THREE.Vector3(1, 0, 0);
      base.normalize();
      specs.push({ center: new THREE.Vector3(px, py, pz), radius: pr * 1.03, axis, base, cross: axis.clone().cross(base), speed: (0.15 + random() * 0.35) * (random() < 0.5 ? -1 : 1), phase: (random() - 0.5) * 1.6 });
    }
    const positions = new Float32Array(count * 3);
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(pointsGeometry, particleMaterial(0.32));
    points.frustumCulled = false;
    group.add(noRaycast(points));

    // Holographic data threads with an animated dash texture
    const dashImage = canvasTexture('azure|dash', 256, 8, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        const gradient = ctx.createLinearGradient(x, 0, x + 22, 0);
        gradient.addColorStop(0, 'rgba(80,200,255,0)');
        gradient.addColorStop(0.7, 'rgba(160,240,255,0.95)');
        gradient.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, 22, h);
      }
    });
    const threads = [];
    const threadRandom = seeded(7);
    const threadCurves = [];
    // Latitude loops around the cloud
    [-6, -1.5, 3, 7].forEach((y, index) => {
      const points3 = [];
      const phase = threadRandom() * 6;
      const radius = index === 3 ? 19 : 24.2;
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        const r = radius + Math.sin(angle * 5 + phase) * 1.4;
        points3.push(new THREE.Vector3(Math.cos(angle) * r, y + Math.sin(angle * 3 + phase) * 1.3, Math.sin(angle) * r));
      }
      threadCurves.push({ curve: new THREE.CatmullRomCurve3(points3, true), closed: true });
    });
    // Meridian arcs from the bottom to the top rim
    for (let m = 0; m < 6; m++) {
      const angle = (m / 6) * Math.PI * 2 + 0.3;
      const points3 = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const theta = -1.2 + t * 2.3;
        const r = 20 + Math.cos(theta) * 5.2;
        const a = angle + Math.sin(t * Math.PI * 2) * 0.12;
        points3.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(theta) * 11.5, Math.sin(a) * r));
      }
      threadCurves.push({ curve: new THREE.CatmullRomCurve3(points3), closed: false });
    }
    threadCurves.forEach(({ curve, closed }, index) => {
      const texture = dashImage.clone();
      texture.needsUpdate = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.set(closed ? 18 : 8, 1);
      const thread = new THREE.Mesh(new THREE.TubeGeometry(curve, closed ? 160 : 60, 0.07, 4, closed),
        new THREE.MeshBasicMaterial({ map: texture, color: index % 3 === 0 ? '#9ff3ff' : '#6fc8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      thread.userData.speed = (0.2 + (index % 4) * 0.08) * (index % 2 ? 1 : -1);
      threads.push(thread);
      group.add(noRaycast(thread));
    });

    const materials = [outerMaterial, innerMaterial, haze.material];
    const angle = new THREE.Vector3();
    animate(group, (time) => {
      materials.forEach((m) => { m.uniforms.time.value = time; });
      for (let i = 0; i < count; i++) {
        const spec = specs[i];
        const theta = spec.phase + time * spec.speed;
        angle.copy(spec.base).multiplyScalar(Math.cos(theta)).addScaledVector(spec.cross, Math.sin(theta));
        positions[i * 3] = spec.center.x + angle.x * spec.radius;
        positions[i * 3 + 1] = spec.center.y + angle.y * spec.radius * 0.86;
        positions[i * 3 + 2] = spec.center.z + angle.z * spec.radius;
      }
      pointsGeometry.attributes.position.needsUpdate = true;
      threads.forEach((thread) => { thread.material.map.offset.x = (time * thread.userData.speed) % 1; });
    });
  }

  // --------------------------------------------------------------------------
  // Upload Beam (entrance by suction) on the ground under the cloud
  // --------------------------------------------------------------------------
  function beamTexture() {
    return canvasTexture('azure|beam', 64, 256, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, 'rgba(120,220,255,0.95)');
      gradient.addColorStop(0.5, 'rgba(60,160,255,0.45)');
      gradient.addColorStop(1, 'rgba(40,120,255,0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = 'rgba(220,250,255,0.22)';
        ctx.fillRect(0, y, w, 2);
      }
    });
  }

  function startUpload() {
    if (state.uploading || now() < state.cooldown) return;
    state.uploading = { start: now() };
    playSound('teleport');
  }

  function uploadBeam(group) {
    const steel = material('#2a3442', { metalness: 0.8, roughness: 0.35 });
    const pad = cylinder(BEAM_RADIUS + 0.5, BEAM_RADIUS + 0.7, 0.14, steel, 0, 0.07, 0, 40);
    group.add(pad);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#59d2ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(BEAM_RADIUS - 0.25, BEAM_RADIUS + 0.25, 48), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    group.add(noRaycast(ring));
    const halo = new THREE.Mesh(new THREE.RingGeometry(BEAM_RADIUS + 0.9, BEAM_RADIUS + 1.6, 48), new THREE.MeshBasicMaterial({ color: '#2a8cff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.04;
    group.add(noRaycast(halo));
    const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(BEAM_RADIUS - 0.25, 40), new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.15;
    group.add(noRaycast(floorGlow));

    // The beam block sits on the island grass; the beam reaches the bottom floor
    const height = FLOOR_Y[0] - 0.2 - group.position.y;
    const beamMaterial = new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#8fdcff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, height, 40, 1, true), beamMaterial);
    beam.position.y = height / 2 + 0.15;
    group.add(noRaycast(beam));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, height, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#ffffff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.y = height / 2 + 0.15;
    group.add(noRaycast(core));
    // Rising rings of light
    const rings = [];
    for (let i = 0; i < 5; i++) {
      const rising = new THREE.Mesh(new THREE.TorusGeometry(BEAM_RADIUS * 0.95, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      rising.rotation.x = Math.PI / 2;
      rings.push(rising);
      group.add(noRaycast(rising));
    }
    // Suction particles spiralling up
    const count = 140;
    const positions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, particleMaterial(0.18, '#dff7ff'));
    points.frustumCulled = false;
    group.add(noRaycast(points));
    const offsets = Array.from({ length: count }, (_, i) => [Math.random(), Math.random() * Math.PI * 2, 0.3 + Math.random() * (BEAM_RADIUS - 0.4)]);

    // Press E on the pad as an alternative to standing in the beam
    const trigger = new THREE.Object3D();
    trigger.position.set(0, 0.5, 0);
    trigger.userData.prompt = 'Press E to upload yourself into the cloud';
    trigger.userData.onInteract = () => { startUpload(); return null; };
    group.add(interactive(trigger, 'action', 'Upload Beam'));

    animate(group, (time) => {
      ringMaterial.opacity = 0.6 + Math.sin(time * 4) * 0.3;
      beamMaterial.opacity = 0.6 + Math.sin(time * 2.2) * 0.12;
      beamMaterial.map.offset.y = -(time * 0.4) % 1;
      rings.forEach((rising, i) => {
        const t = (time * 0.35 + i / rings.length) % 1;
        rising.position.y = 0.3 + t * height;
        rising.material.opacity = 0.9 * (1 - t);
        rising.scale.setScalar(1 - t * 0.25);
      });
      for (let i = 0; i < count; i++) {
        const [phase, angle, radius] = offsets[i];
        const t = (phase + time * 0.25) % 1;
        const a = angle + time * 1.5 + t * 4;
        const r = radius * (1 - t * 0.5);
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = 0.2 + t * height;
        positions[i * 3 + 2] = Math.sin(a) * r;
      }
      geometry.attributes.position.needsUpdate = true;

      if (typeof avatar === 'undefined') return;
      const local = group.worldToLocal(scratch.copy(avatar.position));
      if (!state.uploading && Math.hypot(local.x, local.z) < BEAM_RADIUS && local.y > -1 && local.y < 2 && now() > state.cooldown) startUpload();
      if (state.uploading) {
        const percent = Math.min(100, Math.floor(((now() - state.uploading.start) / 1500) * 100));
        flashHud(`Uploading... ${percent}%`, 900);
        if (percent >= 100) {
          state.uploading = null;
          state.cooldown = now() + 2500;
          moveAvatar(group.localToWorld(scratch2.copy(ARRIVAL).sub(group.position)));
          flashHud('Uploading... 100% - Welcome to the Azure Cloud Core', 2200);
          say('Uploading... 100%. You are inside the Azure Cloud Core. Step into the Data Stream in the center to rise.');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Inside the cloud: floors, ramps, the Data Stream and the way back down
  // --------------------------------------------------------------------------
  function floorTexture() {
    const texture = canvasTexture('azure|floor', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#163e78';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(140,220,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= w; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(190,245,255,0.55)';
      ctx.lineWidth = 3;
      for (let r = 40; r < w / 2; r += 56) {
        ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
      }
      const random = seeded(12);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(160,235,255,${0.2 + random() * 0.5})`;
        ctx.fillRect(Math.floor(random() * 16) * 32 + 2, Math.floor(random() * 16) * 32 + 2, 28, 28);
      }
    });
    return texture;
  }

  // Helical ramp strip between two angles and heights (walkable top surface)
  function rampGeometry(a0, a1, y0, y1, rInner, rOuter, thickness, segments = 48) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = a0 + (a1 - a0) * t;
      const y = y0 + (y1 - y0) * t;
      const c = Math.cos(a);
      const s = Math.sin(a);
      positions.push(c * rInner, y, s * rInner, c * rOuter, y, s * rOuter, c * rInner, y - thickness, s * rInner, c * rOuter, y - thickness, s * rOuter);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      indices.push(a, b, a + 1, a + 1, b, b + 1); // top
      indices.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // bottom
      indices.push(a, a + 2, b, a + 2, b + 2, b); // inner side
      indices.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // outer side
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function railGeometry(a0, a1, y0, y1, radius, height, segments = 48) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = a0 + (a1 - a0) * t;
      const y = y0 + (y1 - y0) * t;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius, Math.cos(a) * radius, y + height, Math.sin(a) * radius);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function edgeLine(a0, a1, y0, y1, radius, lineMaterial) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = a0 + (a1 - a0) * t;
      points.push(new THREE.Vector3(Math.cos(a) * radius, y0 + (y1 - y0) * t, Math.sin(a) * radius));
    }
    return noRaycast(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.06, 4, false), lineMaterial));
  }

  function boostFrom(stopIndex) {
    const core = state.core;
    if (!core) return null;
    const next = (stopIndex + 1) % STOPS.length;
    state.cooldown = now() + 1800;
    moveAvatar(core.localToWorld(scratch2.set(2.6, STOPS[next] + 0.4, 0)));
    playSound('teleport');
    const names = ['Data Hall (floor 1)', 'Archive Ring (floor 2)', 'Cloud Storage Lounge (floor 3)', 'Voxel Sandbox Zone (top)'];
    flashHud(next === 0 ? 'WHOOSH! Data Stream cycled you back to the bottom' : `WHOOSH! Data Stream: ${names[next]}`, 1800);
    return `Whoosh! The Data Stream carried you to the ${names[next]}.`;
  }

  function coreLevels(group) {
    state.core = group;
    const floorMaterial = material('#3c8ee0', { map: floorTexture(), transparent: true, opacity: 0.6, emissive: '#1a5fb0', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const floorGeometry = new THREE.CylinderGeometry(FLOOR_RADIUS, FLOOR_RADIUS, 0.3, 64);
    const edgeGeometry = new THREE.TorusGeometry(FLOOR_RADIUS, 0.09, 6, 80);
    FLOOR_Y.forEach((y) => {
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.y = y - 0.15;
      floor.renderOrder = 3;
      group.add(floor);
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = y;
      group.add(noRaycast(edge));
    });

    // Glowing light ramps: floor 1 -> 2 (0..100 deg) and floor 2 -> 3 (180..280 deg)
    const rampMaterial = material('#4fc3ff', { transparent: true, opacity: 0.55, emissive: '#2a9cff', emissiveIntensity: 0.8, roughness: 0.2, side: THREE.DoubleSide });
    const railMaterial = material('#9ae6ff', { transparent: true, opacity: 0.25, emissive: '#3aa8ff', emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const deg = Math.PI / 180;
    [[0, 100, 0], [180, 280, 1]].forEach(([from, to, level]) => {
      const a0 = from * deg;
      const a1 = to * deg;
      const y0 = FLOOR_Y[level];
      const y1 = FLOOR_Y[level + 1];
      const ramp = new THREE.Mesh(rampGeometry(a0, a1, y0, y1, RAMP_INNER - 0.1, RAMP_OUTER, 0.18), rampMaterial);
      ramp.renderOrder = 3;
      group.add(ramp);
      group.add(new THREE.Mesh(railGeometry(a0, a1, y0, y1, RAMP_OUTER - 0.05, 1.0), railMaterial));
      group.add(edgeLine(a0, a1, y0 + 0.03, y1 + 0.03, RAMP_OUTER - 0.1, edgeMaterial));
      group.add(edgeLine(a0, a1, y0 + 1.0, y1 + 1.0, RAMP_OUTER - 0.05, edgeMaterial));
      group.add(edgeLine(a0, a1, y0 + 0.03, y1 + 0.03, RAMP_INNER, edgeMaterial));
    });

    // The Data Stream: a swirling particle column through the center
    const bottom = FLOOR_Y[0] - 0.5;
    const top = VOXEL_Y - 0.1;
    const streamHeight = top - bottom;
    const columnMaterial = new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#6fd6ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, streamHeight, 32, 1, true), columnMaterial);
    column.position.y = bottom + streamHeight / 2;
    group.add(noRaycast(column));
    const count = 650;
    const positions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, particleMaterial(0.22, '#e8fbff'));
    points.frustumCulled = false;
    group.add(noRaycast(points));
    const offsets = Array.from({ length: count }, () => [Math.random(), Math.random() * Math.PI * 2, 0.15 + Math.random() * 1.1, 0.6 + Math.random() * 0.8]);
    // Stream vents on each stop, with E as an alternative to stepping in
    const ventMaterial = new THREE.MeshBasicMaterial({ color: '#9ff0ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ventGeometry = new THREE.RingGeometry(1.15, 1.45, 40);
    STOPS.forEach((y, index) => {
      const vent = new THREE.Mesh(ventGeometry, ventMaterial);
      vent.rotation.x = -Math.PI / 2;
      vent.position.y = y + 0.03;
      group.add(noRaycast(vent));
      const trigger = new THREE.Object3D();
      trigger.position.set(0, y + 0.8, 0);
      trigger.userData.prompt = index === STOPS.length - 1 ? 'Press E to ride the Data Stream back to the bottom' : 'Press E to ride the Data Stream up';
      trigger.userData.onInteract = () => boostFrom(index);
      group.add(interactive(trigger, 'action', 'The Data Stream'));
    });
    const streamSign = textSprite('THE DATA STREAM - step in to rise', { width: 6, background: 'rgba(6,30,70,0.8)', color: '#bff3ff' });
    streamSign.position.set(0, FLOOR_Y[0] + 3.6, 0);
    group.add(streamSign);

    // Way back down: a warp pad at the edge of the bottom floor
    const exitPad = cylinder(1.2, 1.2, 0.08, glow('#2fd0ff', 1.1, { transparent: true, opacity: 0.85 }), 0, 0, 0, 32);
    exitPad.raycast = () => {};
    const exit = new THREE.Group();
    exit.position.set(-9, FLOOR_Y[0] + 0.05, 0);
    exit.add(exitPad);
    const exitSign = textSprite('Download to the ground', { width: 4, background: 'rgba(6,30,70,0.8)', color: '#ffffff' });
    exitSign.position.set(0, 2.6, 0);
    exit.add(exitSign);
    exit.userData.destination = GROUND_EXIT.clone().sub(exit.position);
    exit.userData.prompt = 'Press E to download yourself back to the ground';
    group.add(interactive(exit, 'warp', 'Downloaded to Azure Island. The beam can upload you again.'));

    // Floor 1 info kiosk, floor 2 floating data crystals
    const kiosk = new THREE.Group();
    kiosk.position.set(6, FLOOR_Y[0], -6);
    kiosk.add(cylinder(0.25, 0.35, 1.1, material('#203a5c', { metalness: 0.7, roughness: 0.3 }), 0, 0.55, 0, 16));
    kiosk.add(box(1.2, 0.8, 0.06, glow('#59c8ff', 0.9), 0, 1.4, 0));
    kiosk.userData.label = 'Azure Cloud Core';
    kiosk.userData.info = 'You are inside a hollow data cloud. Floor 1 is the Data Hall, floor 2 the Archive Ring, floor 3 the Cloud Storage Lounge, and the Voxel Sandbox Zone sits on top. Ride the Data Stream in the center, or walk up the light ramps. The warp pad on the west edge of this floor takes you back to the ground.';
    kiosk.lookAt(0, FLOOR_Y[0], 0);
    group.add(interactive(kiosk, 'inspect', 'Cloud Core Kiosk'));

    const crystals = [];
    const crystalMaterial = glow('#7fd8ff', 1.0, { transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 });
    const crystalGeometry = new THREE.OctahedronGeometry(0.6, 0);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.5;
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      crystal.position.set(Math.cos(angle) * 6.5, FLOOR_Y[1] + 1.6, Math.sin(angle) * 6.5);
      crystal.scale.set(1, 1.6, 1);
      crystal.userData.base = crystal.position.y;
      crystals.push(crystal);
      group.add(noRaycast(crystal));
      const plinth = cylinder(0.5, 0.6, 0.4, material('#1d3a63', { metalness: 0.6, roughness: 0.35 }), crystal.position.x, FLOOR_Y[1] + 0.2, crystal.position.z, 12);
      group.add(plinth);
    }
    const archiveSign = textSprite('ARCHIVE RING', { width: 4, background: 'rgba(6,30,70,0.75)', color: '#bff3ff' });
    archiveSign.position.set(0, FLOOR_Y[1] + 3.8, -6);
    group.add(archiveSign);

    animate(group, (time) => {
      columnMaterial.map.offset.y = -(time * 0.6) % 1;
      ventMaterial.opacity = 0.6 + Math.sin(time * 5) * 0.25;
      for (let i = 0; i < count; i++) {
        const [phase, angle, radius, speed] = offsets[i];
        const t = (phase + time * 0.08 * speed) % 1;
        const a = angle + time * 2.2 * speed + t * 12;
        positions[i * 3] = Math.cos(a) * radius;
        positions[i * 3 + 1] = bottom + t * streamHeight;
        positions[i * 3 + 2] = Math.sin(a) * radius;
      }
      geometry.attributes.position.needsUpdate = true;
      crystals.forEach((crystal, i) => {
        crystal.rotation.y = time * 0.8 + i;
        crystal.position.y = crystal.userData.base + Math.sin(time * 1.3 + i) * 0.25;
      });

      if (typeof avatar === 'undefined' || now() < state.cooldown) return;
      const local = group.worldToLocal(scratch.copy(avatar.position));
      if (Math.hypot(local.x, local.z) > 1.2) return;
      const stopIndex = STOPS.findIndex((y) => Math.abs(local.y - y) < 1.2);
      if (stopIndex >= 0) {
        const message = boostFrom(stopIndex);
        if (message) say(message);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Voxel Sandbox Zone on the top fringe (mine and build, saved locally)
  // --------------------------------------------------------------------------
  function voxelTexture() {
    const texture = canvasTexture('azure|voxel', 64, 64, (ctx) => {
      const random = seeded(31);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const edge = x === 0 || y === 0 || x === 15 || y === 15;
          const shade = edge ? 170 : 205 + Math.floor(random() * 50);
          const data = !edge && random() < 0.08;
          ctx.fillStyle = data ? 'rgb(90,220,255)' : `rgb(${shade - 25},${shade - 5},${Math.min(255, shade + 20)})`;
          ctx.fillRect(x * 4, y * 4, 4, 4);
        }
      }
    });
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  function voxelZone(group) {
    const HALF = 7; // deck cells x, z in [-7, 6]
    const key = (x, y, z) => `${x},${y},${z}`;
    const base = new Map(); // cell key -> color for the original deck
    for (let x = -HALF; x < HALF; x++) {
      for (let z = -HALF; z < HALF; z++) {
        base.set(key(x, 0, z), (x + z) % 5 === 0 ? '#9fe6ff' : '#e9f5ff');
        base.set(key(x, -1, z), '#8db8e6');
      }
    }
    const PALETTE = ['#7fd6ff', '#ffffff', '#4f8dff', '#a9c4ff', '#2fb8e0'];
    let saved = { placed: {}, removed: [] };
    try {
      const raw = localStorage.getItem(VOXEL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') saved = { placed: parsed.placed || {}, removed: Array.isArray(parsed.removed) ? parsed.removed : [] };
      }
    } catch (error) { /* storage unavailable: start fresh */ }
    const removed = new Set(saved.removed);
    const placed = new Map(Object.entries(saved.placed));
    let paletteIndex = 0;

    const voxels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: voxelTexture(), roughness: 0.7, emissive: '#10345e', emissiveIntensity: 0.6 }), VOXEL_CAP);
    voxels.frustumCulled = false;
    group.add(voxels);
    const cells = []; // instance index -> cell key
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < VOXEL_CAP; i++) voxels.setColorAt(i, color.set('#ffffff'));

    function rebuild() {
      cells.length = 0;
      const all = new Map();
      base.forEach((value, cell) => { if (!removed.has(cell)) all.set(cell, value); });
      placed.forEach((value, cell) => all.set(cell, value));
      all.forEach((value, cell) => {
        if (cells.length >= VOXEL_CAP) return;
        const [x, y, z] = cell.split(',').map(Number);
        matrix.makeTranslation(x + 0.5, y - 0.5, z + 0.5);
        voxels.setMatrixAt(cells.length, matrix);
        voxels.setColorAt(cells.length, color.set(value));
        cells.push(cell);
      });
      voxels.count = cells.length;
      voxels.instanceMatrix.needsUpdate = true;
      if (voxels.instanceColor) voxels.instanceColor.needsUpdate = true;
    }

    function save() {
      try { localStorage.setItem(VOXEL_KEY, JSON.stringify({ placed: Object.fromEntries(placed), removed: [...removed] })); } catch (error) { /* ignore */ }
    }

    function exists(cell) { return placed.has(cell) || (base.has(cell) && !removed.has(cell)); }
    function inBounds(x, y, z) { return x >= -12 && x < 12 && z >= -12 && z < 12 && y >= -1 && y <= 10; }

    function avatarCell() {
      const local = group.worldToLocal(scratch.copy(avatar.position));
      return { local, x: Math.floor(local.x), z: Math.floor(local.z), feet: Math.floor(local.y + 0.05) + 1 };
    }

    function mine(cell) {
      if (!exists(cell)) return false;
      if (placed.has(cell)) placed.delete(cell); else removed.add(cell);
      rebuild();
      save();
      playSound('click');
      return true;
    }

    function place(x, y, z) {
      const cell = key(x, y, z);
      if (!inBounds(x, y, z) || exists(cell)) return false;
      if (cells.length >= VOXEL_CAP) { flashHud('Voxel limit reached (2000 blocks)'); return false; }
      const me = avatarCell();
      // Never place a block inside the avatar (cells of the feet and the head)
      if (x === me.x && z === me.z && (y === me.feet || y === me.feet + 1)) return false;
      placed.set(cell, PALETTE[paletteIndex++ % PALETTE.length]);
      rebuild();
      save();
      playSound('click');
      return true;
    }

    // Column in front of the avatar (camera direction projected on the ground)
    function frontColumn() {
      const me = avatarCell();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
      forward.normalize();
      const target = scratch2.copy(avatar.position).addScaledVector(forward, 1.4);
      group.worldToLocal(target);
      return { me, x: Math.floor(target.x), z: Math.floor(target.z) };
    }

    function placeInFront() {
      const { me, x, z } = frontColumn();
      let y = me.feet;
      while (exists(key(x, y, z)) && y < me.feet + 3) y++;
      if (!place(x, y, z)) return 'No room to place a block there.';
      return null;
    }

    function mineInFront() {
      const { me, x, z } = frontColumn();
      for (let y = me.feet + 1; y >= me.feet - 2; y--) {
        if (mine(key(x, y, z))) return true;
      }
      return false;
    }

    rebuild();

    // Glass rail around the deck and a glowing frame
    const railMaterial = material('#9ae6ff', { transparent: true, opacity: 0.25, emissive: '#3aa8ff', emissiveIntensity: 0.6, depthWrite: false });
    const frameMaterial = glow('#5fd8ff', 1.2);
    [[0, -HALF - 0.1, 2 * HALF + 0.4, 0.1], [0, HALF + 0.1, 2 * HALF + 0.4, 0.1], [-HALF - 0.1, 0, 0.1, 2 * HALF + 0.4], [HALF + 0.1, 0, 0.1, 2 * HALF + 0.4]].forEach(([x, z, w, d]) => {
      group.add(box(w, 1.1, d, railMaterial, x, 0.55, z));
      const frame = box(w + 0.05, 0.08, d + 0.05, frameMaterial, x, 1.12, z);
      frame.raycast = () => {};
      group.add(frame);
    });
    const title = textSprite('VOXEL SANDBOX ZONE', { width: 6, background: 'rgba(6,30,70,0.8)', color: '#bff3ff' });
    title.position.set(0, 4.2, -HALF);
    group.add(title);

    // Build pad: E places a block in front of you
    const padGroup = new THREE.Group();
    padGroup.position.set(5, 1.05, -5);
    const pedestal = cylinder(0.35, 0.45, 1.0, material('#1d3a63', { metalness: 0.6 }), 0, -0.5, 0, 12);
    padGroup.add(pedestal);
    const padTop = box(0.8, 0.12, 0.8, glow('#7fe8ff', 1.2), 0, 0.06, 0);
    padGroup.add(padTop);
    padGroup.userData.prompt = 'Press E to place a voxel block in front of you';
    padGroup.userData.onInteract = () => placeInFront();
    group.add(interactive(padGroup, 'action', 'Build Pad'));
    // Warp back into the lounge
    const drop = new THREE.Group();
    drop.position.set(-5, 1.0, 5);
    drop.add(cylinder(0.35, 0.45, 1.0, material('#1d3a63', { metalness: 0.6 }), 0, -0.5, 0, 12));
    drop.add(box(0.8, 0.12, 0.8, glow('#b48cff', 1.2), 0, 0.06, 0));
    drop.userData.destination = new THREE.Vector3(-3, FLOOR_Y[2] - VOXEL_Y + 0.3, 3).sub(drop.position);
    drop.userData.prompt = 'Press E to drop back into the Cloud Storage Lounge';
    group.add(interactive(drop, 'warp', 'Back in the Cloud Storage Lounge.'));

    // Mining and building with the mouse while the avatar is in the zone
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let inZone = false;
    window.addEventListener('pointerdown', (event) => {
      if (!inZone || event.button !== 0 || typeof camera === 'undefined') return;
      const canvas = typeof renderer !== 'undefined' && renderer ? renderer.domElement : null;
      if (!canvas || event.target !== canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      raycaster.far = 60;
      const hit = raycaster.intersectObject(voxels, false)[0];
      if (!hit || hit.instanceId === undefined || hit.point.distanceTo(avatar.position) > 9) return;
      const cell = cells[hit.instanceId];
      if (!cell) return;
      const [x, y, z] = cell.split(',').map(Number);
      if (event.shiftKey) {
        const n = hit.face.normal;
        place(x + Math.round(n.x), y + Math.round(n.y), z + Math.round(n.z));
      } else {
        mine(cell);
      }
    });
    window.addEventListener('keydown', (event) => {
      if (!inZone || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const k = event.key.toLowerCase();
      if (k === 'b') { const message = placeInFront(); if (message) flashHud(message, 1200); }
      if (k === 'g') { if (!mineInFront()) flashHud('No block in front of you to mine', 1200); }
    });

    animate(group, () => {
      if (typeof avatar === 'undefined') return;
      const local = group.worldToLocal(scratch.copy(avatar.position));
      const nowInZone = Math.abs(local.x) < 13 && Math.abs(local.z) < 13 && local.y > -3 && local.y < 12;
      if (nowInZone !== inZone) {
        inZone = nowInZone;
        hudElements();
        hint.style.display = inZone ? 'block' : 'none';
      }
    });
  }

  // --------------------------------------------------------------------------
  // Cloud Storage Lounge (floor 3): blinking data walls, sync totems, sofas
  // --------------------------------------------------------------------------
  function storageLounge(group) {
    const deg = Math.PI / 180;
    const arcs = [[-50, 40], [70, 160], [190, 250]];
    const radius = 10.2;
    const size = 0.36;
    const step = 0.42;
    const rows = 7;
    const spots = [];
    arcs.forEach(([from, to]) => {
      const length = (to - from) * deg * radius;
      const columns = Math.floor(length / step);
      for (let c = 0; c <= columns; c++) {
        const a = from * deg + (c / columns) * (to - from) * deg;
        for (let r = 0; r < rows; r++) spots.push([a, 0.25 + r * step]);
      }
    });
    const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color: '#ffffff' }), spots.length);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const baseColor = new THREE.Color('#0d3a72');
    const blinkColor = new THREE.Color('#c8f6ff');
    const color = new THREE.Color();
    spots.forEach(([a, y], index) => {
      rotation.setFromAxisAngle(up, -a);
      matrix.compose(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius), rotation, new THREE.Vector3(1, 1, 1));
      cubes.setMatrixAt(index, matrix);
      cubes.setColorAt(index, baseColor);
    });
    cubes.frustumCulled = false;
    group.add(cubes);
    const glowLevels = new Float32Array(spots.length);
    const blinkBurst = (amount) => { for (let i = 0; i < amount; i++) glowLevels[Math.floor(Math.random() * spots.length)] = 1; };
    state.lounge = { blinkBurst };

    // Sync totems: snapshot local achievements (localStorage keys "multiverse-")
    const totemMaterial = material('#1b3557', { metalness: 0.75, roughness: 0.3 });
    const totemGlow = glow('#59d8ff', 1.3);
    const totemRings = [];
    [[-5, -4.5], [5, -4.5]].forEach(([x, z], index) => {
      const totem = new THREE.Group();
      totem.position.set(x, 0, z);
      totem.add(cylinder(0.45, 0.6, 0.3, totemMaterial, 0, 0.15, 0, 16));
      totem.add(box(0.5, 2.2, 0.5, totemMaterial, 0, 1.4, 0));
      totem.add(box(0.52, 1.6, 0.06, totemGlow, 0, 1.5, 0.25));
      totem.add(box(0.52, 1.6, 0.06, totemGlow, 0, 1.5, -0.25));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#9ff0ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.y = 2.8;
      ring.rotation.x = Math.PI / 2;
      totem.add(noRaycast(ring));
      totemRings.push(ring);
      const label = textSprite(`SYNC TOTEM ${index + 1}`, { width: 2.6, background: 'rgba(6,30,70,0.8)', color: '#bff3ff' });
      label.position.y = 3.5;
      totem.add(label);
      totem.userData.prompt = 'Press E to sync your achievements to the cloud';
      totem.userData.onInteract = () => {
        const keys = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('multiverse-') && !k.startsWith('multiverse-azure-')) keys.push(k);
          }
          localStorage.setItem(SYNC_KEY, JSON.stringify({ savedAt: new Date().toISOString(), keys }));
        } catch (error) { /* storage unavailable */ }
        blinkBurst(spots.length * 0.6);
        flashHud(`Synced ${keys.length} achievements`, 2000);
        return `Cloud sync complete: Synced ${keys.length} achievements (snapshot saved locally).`;
      };
      group.add(interactive(totem, 'action', 'Sync Totem'));
    });

    // Sofas made of "solid cloud": puffy white-blue spheres with seats
    const puffMaterial = material('#e3f1ff', { roughness: 0.95, emissive: '#5a8fd6', emissiveIntensity: 0.18 });
    const sofas = [[-6, 3.5], [6, 3.5], [0, 7.5]];
    sofas.forEach(([x, z]) => {
      const sofa = new THREE.Group();
      sofa.position.set(x, 0, z);
      sofa.lookAt(0, 0, 0);
      const parts = [[-0.8, 0.28, 0, 0.62], [0, 0.3, 0, 0.66], [0.8, 0.28, 0, 0.62], [-0.75, 0.75, -0.55, 0.55], [0.05, 0.8, -0.6, 0.6], [0.8, 0.75, -0.55, 0.55], [-1.35, 0.55, 0.05, 0.42], [1.35, 0.55, 0.05, 0.42]];
      parts.forEach(([px, py, pz, r]) => {
        const puff = sphere(r, puffMaterial, px, py, pz, 14);
        puff.scale.set(1.15, 0.7, 1);
        sofa.add(puff);
      });
      [-0.6, 0.6].forEach((sx) => sofa.add(seat(sx, 0.45, 0.1, 'Solid Cloud Sofa', Math.PI)));
      group.add(sofa);
    });

    const title = textSprite('CLOUD STORAGE LOUNGE', { width: 6, background: 'rgba(6,30,70,0.8)', color: '#ffffff' });
    title.position.set(0, 4.2, 6);
    group.add(title);

    let lastSpark = 0;
    animate(group, (time) => {
      totemRings.forEach((ring, i) => { ring.position.y = 2.8 + Math.sin(time * 2 + i) * 0.2; ring.rotation.z = time; });
      if (time - lastSpark > 0.05) {
        lastSpark = time;
        for (let i = 0; i < 6; i++) glowLevels[Math.floor(Math.random() * spots.length)] = 0.6 + Math.random() * 0.4;
        // "Data is saved": a sweep every few seconds
        if (Math.random() < 0.02) blinkBurst(80);
      }
      for (let i = 0; i < spots.length; i++) {
        const level = glowLevels[i];
        if (level <= 0) continue;
        glowLevels[i] = Math.max(0, level - 0.035);
        cubes.setColorAt(i, color.copy(baseColor).lerp(blinkColor, level));
      }
      cubes.instanceColor.needsUpdate = true;
    });
  }

  // --------------------------------------------------------------------------
  // Name sign next to the beam (text only, no logos)
  // --------------------------------------------------------------------------
  function nameSign(group, { w = 7, h = 3 }) {
    const steel = material('#26313f', { metalness: 0.8, roughness: 0.35 });
    const texture = canvasTexture('azure|sign', 1024, 384, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#062048');
      gradient.addColorStop(1, '#0d4c8f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(127,230,255,0.9)';
      ctx.lineWidth = 8;
      ctx.strokeRect(14, 14, width - 28, height - 28);
      ctx.fillStyle = '#e8fbff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 72px Segoe UI, Arial, sans-serif';
      ctx.fillText('THE AZURE CLOUD CORE', width / 2, height * 0.4);
      ctx.fillStyle = '#7fe6ff';
      ctx.font = '600 34px Segoe UI, Arial, sans-serif';
      ctx.fillText('Stand in the Upload Beam to enter', width / 2, height * 0.72);
    });
    const panelMaterial = new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.55, roughness: 0.4 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), panelMaterial);
    const panelY = h - (w * 0.375) / 2 + 0.6;
    panel.position.set(0, panelY, 0.09);
    group.add(panel);
    group.add(box(w + 0.3, w * 0.375 + 0.3, 0.16, steel, 0, panelY, 0));
    [-1, 1].forEach((side) => group.add(box(0.22, panelY, 0.22, steel, side * (w / 2 - 0.3), panelY / 2, -0.1)));
    const trim = box(w + 0.32, 0.08, 0.2, glow('#5fd8ff', 1.4), 0, panelY + w * 0.1875 + 0.16, 0);
    trim.raycast = () => {};
    group.add(trim);
  }

  PropKit.registerBuilder(/^azure_cloud_shell$/, 'azureCloudShell', (group) => cloudShell(group));
  PropKit.registerBuilder(/^azure_core_levels$/, 'azureCoreLevels', (group) => coreLevels(group));
  PropKit.registerBuilder(/^azure_upload_beam$/, 'azureUploadBeam', (group) => uploadBeam(group));
  PropKit.registerBuilder(/^azure_voxel_zone$/, 'azureVoxelZone', (group) => voxelZone(group));
  PropKit.registerBuilder(/^azure_storage_lounge$/, 'azureStorageLounge', (group) => storageLounge(group));
  PropKit.registerBuilder(/^azure_name_sign$/, 'azureNameSign', (group, options) => nameSign(group, options));

  return { STOPS, boostFrom, startUpload };
})();
