// ============================================================================
// AVATAR CUSTOMIZATION: OUTFITS MADE FOR A 3D CURSOR
// ============================================================================
// Before entering (and later from the dock button) devs dress their cursor
// like a Decentraland backpack: arrow color, classic pixel sunglasses, a
// jacket cut to the shape of the arrow, hats and more. The look is saved on
// the account (server) and every dev in the lobby sees it.
const Avatar = (() => {
  const OPTIONS = {
    color: ['#c7ceea', '#b5ead7', '#ffdac1', '#ff9aa2', '#e2f0cb', '#a0c4ff', '#ffd166', '#f1f3f5', '#2b2d42', '#ff70a6'],
    eyes: ['none', 'pixel', 'round', 'visor', 'heart'],
    body: ['none', 'leather', 'puffer', 'varsity', 'hoodie', 'tuxedo'],
    head: ['none', 'cap', 'beanie', 'tophat', 'crown', 'headphones', 'halo'],
    bodyColor: ['#212529', '#c92a2a', '#1864ab', '#2b8a3e', '#f08c00', '#862e9c', '#f8f9fa']
  };
  const LABELS = {
    none: 'None', pixel: 'Pixel shades', round: 'Round glasses', visor: 'Neon visor', heart: 'Heart shades',
    leather: 'Leather jacket', puffer: 'Puffer jacket', varsity: 'Varsity jacket', hoodie: 'Hoodie', tuxedo: 'Tuxedo',
    cap: 'Cap', beanie: 'Beanie', tophat: 'Top hat', crown: 'Crown', headphones: 'Headphones', halo: 'Halo'
  };
  const DEFAULT = { color: '#c7ceea', eyes: 'pixel', body: 'leather', head: 'none', bodyColor: '#212529' };

  function sanitize(look) {
    const clean = { ...DEFAULT };
    Object.keys(OPTIONS).forEach((key) => { if (look && OPTIONS[key].includes(look[key])) clean[key] = look[key]; });
    return clean;
  }

  // The arrow outline (same as the cursor in main.js): tip at (0, 0)
  function bandShape(top, bottom) {
    // Region of the arrow between two heights, used to cut jackets to its shape
    const right = (y) => Math.min(1.14, (-y) * (1.14 / 1.12));
    const shape = new THREE.Shape();
    shape.moveTo(-0.04, top);
    shape.lineTo(right(top) + 0.06, top);
    if (bottom > -1.12) shape.lineTo(right(bottom) + 0.06, bottom);
    else { shape.lineTo(1.2, -1.15); shape.lineTo(0.62, -1.17); shape.lineTo(0.42, -1.32); }
    shape.lineTo(-0.04, bottom > -1.12 ? bottom : -1.62);
    shape.closePath();
    return shape;
  }

  function buildOutfit(input) {
    const look = sanitize(input);
    const group = new THREE.Group();
    const part = (geometry, color, x, y, z, options = {}) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...options }));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    // ---- Jacket: extruded band shaped like the arrow, slightly thicker ----
    if (look.body !== 'none') {
      const fabric = { leather: { roughness: 0.35, metalness: 0.2 }, puffer: { roughness: 0.9 }, varsity: { roughness: 0.8 }, hoodie: { roughness: 1 }, tuxedo: { roughness: 0.5 } }[look.body];
      const color = look.body === 'tuxedo' ? '#111111' : look.bodyColor;
      const geometry = new THREE.ExtrudeGeometry(bandShape(-0.5, -1.7), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
      geometry.translate(0, 0, -0.18);
      const jacket = part(geometry, color, 0, 0, 0, fabric);
      jacket.userData.slot = 'body';
      // Collar and zipper on both faces
      [1, -1].forEach((side) => {
        part(new THREE.BoxGeometry(0.03, 0.75, 0.02), look.body === 'tuxedo' ? '#ffffff' : '#ced4da', 0.3, -0.95, side * 0.23, { metalness: 0.8 });
        part(new THREE.BoxGeometry(0.62, 0.08, 0.04), look.body === 'varsity' ? '#f8f9fa' : color, 0.33, -0.52, side * 0.22);
      });
      if (look.body === 'puffer') for (let i = 0; i < 4; i++) [1, -1].forEach((side) => part(new THREE.BoxGeometry(0.55 + i * 0.12, 0.05, 0.03), color, 0.3 + i * 0.05, -0.68 - i * 0.18, side * 0.23));
      if (look.body === 'varsity') [1, -1].forEach((side) => part(new THREE.BoxGeometry(0.35, 0.12, 0.02), '#f8f9fa', 0.75, -0.95, side * 0.23));
      if (look.body === 'hoodie') {
        const hood = part(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), color, 0.22, -0.42, -0.02, fabric);
        hood.rotation.z = 0.5;
      }
      if (look.body === 'tuxedo') [1, -1].forEach((side) => {
        part(new THREE.BoxGeometry(0.22, 0.7, 0.02), '#ffffff', 0.3, -0.9, side * 0.225);
        part(new THREE.BoxGeometry(0.2, 0.08, 0.04), '#c92a2a', 0.3, -0.6, side * 0.24);
      });
    }
    // ---- Eyes: worn across the upper part of the arrow ----
    const eyeY = -0.36;
    if (look.eyes === 'pixel') {
      // Classic "deal with it" pixel shades on both faces
      [1, -1].forEach((side) => {
        const z = side * 0.19;
        part(new THREE.BoxGeometry(0.62, 0.07, 0.04), '#000000', 0.26, eyeY + 0.04, z);
        [[0.06, 0], [0.13, -0.07], [0.33, 0], [0.4, -0.07]].forEach(([x, dy]) => part(new THREE.BoxGeometry(0.14, 0.07, 0.04), '#000000', x, eyeY - 0.03 + dy, z));
        part(new THREE.BoxGeometry(0.05, 0.035, 0.045), '#ffffff', 0.06, eyeY - 0.01, z + side * 0.005);
        part(new THREE.BoxGeometry(0.05, 0.035, 0.045), '#ffffff', 0.33, eyeY - 0.01, z + side * 0.005);
      });
    } else if (look.eyes === 'round' || look.eyes === 'heart') {
      [1, -1].forEach((side) => [0.1, 0.34].forEach((x) => {
        if (look.eyes === 'round') part(new THREE.TorusGeometry(0.08, 0.018, 6, 16), '#343a40', x, eyeY, side * 0.19, { metalness: 0.7 });
        else part(new THREE.CircleGeometry(0.09, 3), '#ff4d6d', x, eyeY, side * 0.2, { side: THREE.DoubleSide, emissive: '#ff4d6d', emissiveIntensity: 0.4 }).rotation.z = Math.PI;
      }));
    } else if (look.eyes === 'visor') {
      part(new THREE.BoxGeometry(0.6, 0.1, 0.44), '#4cc9f0', 0.24, eyeY, 0, { emissive: '#4cc9f0', emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
    }
    // ---- Head: on the tip of the arrow ----
    if (look.head === 'cap') {
      part(new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), look.bodyColor, 0.08, 0.02, 0);
      part(new THREE.BoxGeometry(0.42, 0.04, 0.3), look.bodyColor, 0.08, 0.02, 0.26);
    } else if (look.head === 'beanie') {
      part(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), look.bodyColor, 0.08, 0, 0, { roughness: 1 });
      part(new THREE.TorusGeometry(0.25, 0.05, 6, 16), '#f8f9fa', 0.08, 0.02, 0).rotation.x = Math.PI / 2;
      part(new THREE.SphereGeometry(0.08, 8, 6), '#f8f9fa', 0.08, 0.28, 0);
    } else if (look.head === 'tophat') {
      part(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), '#111111', 0.08, 0.05, 0);
      part(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 20), '#111111', 0.08, 0.28, 0);
      part(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 20), '#c92a2a', 0.08, 0.12, 0);
    } else if (look.head === 'crown') {
      part(new THREE.CylinderGeometry(0.26, 0.22, 0.18, 8, 1, true), '#ffd166', 0.08, 0.1, 0, { metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide, emissive: '#ffb703', emissiveIntensity: 0.3 });
      for (let i = 0; i < 6; i++) part(new THREE.ConeGeometry(0.05, 0.14, 4), '#ffd166', 0.08 + Math.cos(i) * 0.24, 0.25, Math.sin(i) * 0.24, { metalness: 0.9 });
    } else if (look.head === 'headphones') {
      const band = part(new THREE.TorusGeometry(0.3, 0.035, 6, 16, Math.PI), '#212529', 0.15, -0.2, 0);
      band.rotation.y = Math.PI / 2;
      [0.3, -0.3].forEach((z) => part(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), look.bodyColor, 0.15, -0.45, z).rotation.x = Math.PI / 2);
    } else if (look.head === 'halo') {
      const halo = part(new THREE.TorusGeometry(0.22, 0.03, 8, 24), '#fff3bf', 0.08, 0.3, 0, { emissive: '#ffd43b', emissiveIntensity: 1.4 });
      halo.rotation.x = Math.PI / 2;
    }
    group.traverse((node) => { node.raycast = () => {}; });
    return group;
  }

  // --------------------------------------------------------------------------
  // Customization screen (Decentraland-like backpack) with a live 3D preview
  // --------------------------------------------------------------------------
  function openCustomizer(current, onSave, buildCursor) {
    // Never stack two customization screens (first visit and the dock button)
    if (document.getElementById('avatar-screen')) return;
    let look = sanitize(current);
    const screen = document.createElement('div');
    screen.id = 'avatar-screen';
    screen.innerHTML = `<div class="avatar-card">
        <div class="avatar-preview"><canvas width="360" height="420"></canvas></div>
        <div class="avatar-options">
          <h2>Customize your cursor</h2>
          <p>Dress your 3D cursor before entering. You can change it later with the shirt button in the menu.</p>
          <div id="avatar-groups"></div>
          <button type="button" id="avatar-enter">Enter GitHub Multiverse</button>
        </div>
      </div>`;
    document.body.appendChild(screen);
    const groups = screen.querySelector('#avatar-groups');
    const sections = [['color', 'Cursor color'], ['eyes', 'Eyewear'], ['body', 'Jacket'], ['bodyColor', 'Jacket & hat color'], ['head', 'Head']];
    function renderOptions() {
      groups.innerHTML = '';
      sections.forEach(([key, title]) => {
        const row = document.createElement('div');
        row.className = 'avatar-row';
        row.innerHTML = `<b>${title}</b>`;
        const list = document.createElement('div');
        OPTIONS[key].forEach((value) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = value === look[key] ? 'active' : '';
          if (key.toLowerCase().includes('color')) { button.style.background = value; button.classList.add('swatch'); button.title = value; }
          else button.textContent = LABELS[value] || value;
          button.addEventListener('click', () => { look = { ...look, [key]: value }; renderOptions(); refresh(); });
          list.appendChild(button);
        });
        row.appendChild(list);
        groups.appendChild(row);
      });
    }
    // Small preview renderer
    const canvas = screen.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 50);
    camera.position.set(0, 0.2, 6);
    scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 0.8);
    sun.position.set(3, 4, 5);
    scene.add(sun);
    let model = null;
    function refresh() {
      if (model) scene.remove(model);
      model = buildCursor(look);
      model.position.set(-0.5, 0.6, 0);
      model.scale.setScalar(1.9);
      scene.add(model);
    }
    let running = true;
    const spin = (time) => {
      if (!running) return;
      if (model) model.rotation.y = Math.sin(time / 1200) * 0.9;
      renderer.render(scene, camera);
      requestAnimationFrame(spin);
    };
    renderOptions();
    refresh();
    requestAnimationFrame(spin);
    screen.querySelector('#avatar-enter').addEventListener('click', () => {
      running = false;
      renderer.dispose();
      screen.remove();
      onSave(look);
    });
  }

  return { OPTIONS, DEFAULT, sanitize, buildOutfit, openCustomizer };
})();
