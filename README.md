# 🌐 GitVerse — GitHub Multiverse

<img width="1370" height="768" alt="GitVerse screenshot" src="https://github.com/user-attachments/assets/33672bb3-ddbe-4782-8b29-527179559d01" />

A clean, Decentraland-like fully functional 3D collaborative metaverse workspace tailored specifically for developers. Instead of clunky 3D character avatars, users interact with their peers in real-time using custom **three-dimensional mouse pointers** across beautifully structured, low-poly workspace environments.

## 🚀 Features

- **Real-Time Multiplayer Sync**: Powered by Socket.io, every developer's movement is replicated instantaneously across all connected clients.
- **3D Cursor Representation**: No sci-fi or cyberpunk avatars. Everyone is represented by a clean, smooth, pastel-colored 3D arrow mesh with their own custom corporate developer tag (`Dev_XXXX`).
- **Interactive Chat Bubble System**: Type messages directly into the UI dashboard and watch your chat text hover as a neat, responsive bubble attached dynamically to your 3D cursor.
- **Decentraland-style World Instances**: Every map is its own instance (a Socket.io room) built on top of endless land split into 16m x 16m parcels. The HUD shows the parcel coordinate under your cursor, and the *Jump in* list shows how many devs are online in each world. Highlights:
  - 🌐 *Genesis Plaza*: The default spawn at parcel (0,0).
  - 🏢 *Main Headquarters Lobby*: The core social central desk room.
  - 📦 *The Repository Pavilion*: Exhibition layout featuring smooth green and blue blocks.
  - 📋 *Scrum & Agile Open Space*: A digital room containing low-poly Kanban whiteboards and sticky-notes.
  - …plus Districts, Sandbox, Social, Gallery, Mall, Zen Temple, Cyberpunk, Retro, Beach, Hacker House and Arcade (see `public/maps/worlds.json`).
- **Shareable Links**: `http://localhost:3000/#zen` drops whoever opens it straight into that world.
- **Immersive Lighting & Shadows**: Standard production-ready PCFSoftShadowMaps creating an organic maquette aesthetic.

---

## 🛠️ Architecture & Tech Stack

```text
gitverse/
├── package.json         # Node.js dependencies and run-scripts configs
├── server.js            # Express & Socket.io network synchronization engine (world rooms + chat)
└── public/
    ├── index.html       # Corporate layout interface overlay and core layout container
    ├── main.js          # Core Three.js render loops, Raycasting calculations, and meshes
    ├── maps/            # One JSON per world + worlds.json (the world registry)
    └── vendor/          # Three.js r128 + OrbitControls, served locally (MIT)
```

- **Frontend Core**: [Three.js](https://threejs.org) r128 (vendored in `public/vendor`)
- **Backend Hub**: Node.js & Express
- **Networking Protocol**: Socket.io

---

## 💻 Getting Started Locally

Follow these quick sequential steps to fire up your GitVerse engine local deployment:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) (v18 or higher recommended) installed on your laptop or computer.

### 2. Installation
Clone your repository or download the project files into your chosen directory, then navigate into the directory and install all required modules:
```bash
npm install
```

### 3. Execution
Launch the Node server environment using the standardized run script:
```bash
npm start
```

### 4. Open Interface
Once launched, open up any modern web browser and point your URL navigation directly to:
```text
http://localhost:3000
```

*💡 **Pro Tip**: To view the true real-time engine synchronization functionality on your own machine, open up an extra Incognito/Private window tab right next to your primary browser view. You will immediately see both 3D cursors interacting on the exact same plane coordinates!*

---

## 🎮 Controls & Chat Commands

| Input | Action |
| --- | --- |
| Mouse | Move your 3D cursor |
| Drag / Wheel | Orbit / zoom the camera |
| `W A S D` or arrows | Walk the camera across the land |
| Click | Inspect a labeled object |
| `Enter` | Focus the chat |

| Command | Action |
| --- | --- |
| `/world <name>` | Jump into another world (e.g. `/world agile`) |
| `/worlds` | List every world |
| `/who` | List the devs in your current world |
| `/clear` | Clear the chat log |
| `/help` | Show the commands |

### Available worlds

| Key (`/world <key>`) | World | Description |
| --- | --- | --- |
| `plaza` | Genesis Plaza | Default spawn at parcel (0,0), Decentraland style |
| `districts` | Distritos | Vegas, Fashion, Aetheria and private lots |
| `lobby` | HQ Lobby | Social room around the central desk |
| `pavilion` | Repository Pavilion | Exhibition of green and blue blocks |
| `agile` | Scrum & Agile | Kanban whiteboards and sticky notes |
| `sandbox` | Sandbox Voxels | Voxel cluster |
| `social` | Horizon & Somnium | Social hub |
| `gallery` | Upland Gallery | Real estate and art gallery |
| `mall` | GamiMall | Wearables mall |
| `apple` | House of MAC | Aluminum plaza |
| `zen` | Zen Temple | Private floating island |
| `cyberpunk` | Cyberpunk Repo | Neon pillars |
| `retro` | Retro Contributions | 3D contribution graph |
| `beach` | Tropical Beach | Beach island |
| `house` | Hacker House | Two-story house |
| `arcade` | Arcade Room | Arcade cabinets and pool table |

The first world in `worlds.json` (`plaza`) is where everyone spawns.

### Adding a world
Create `public/maps/map_<name>.json` with `themeName`, `backgroundColor` and a `blocks` array (`type`, `position: [x, y, z]`, `scale: [x, y, z]`, `color`, optional `label`), then register it in `public/maps/worlds.json`.

### Deploying
Multiplayer needs the Node server running (any host that keeps a Node process alive and supports WebSockets, e.g. Render, Railway or Fly.io). Static hosts such as Vercel only serve the `public/` folder: the worlds still load, but in **solo mode** without other devs.

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **GitHub API Core Integration**: Connect real GitHub personal access tokens to build custom blocks using active user directories and folders dynamically.
- [ ] **Proximity Voice Chat**: Leverage high-performance WebRTC streams so dev teams can speak natively just by dragging their mouse cursor pointers closer together.
- [ ] **Interactive File Editing Node**: Click specific objects on active maps to pull out code repositories trees or shared text note pads right in the 3D space view.
