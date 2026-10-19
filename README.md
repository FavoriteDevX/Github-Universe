 ## GitHub Multiverse

<img width="1000" height="561" alt="image" src="https://github.com/user-attachments/assets/1c7a81c7-6897-4ce4-bc3c-422fa9a61cfe" />

A fully functional 3D collaborative metaverse built for developers. Instead of avatars, players explore a low-poly universe as custom **3D mouse pointers**, discovering themed districts, mini-games, and a stylized recreation of Silicon Valley.

So, imagine to have a fun, useful and 3D virtual dimension world, just for devs like you. Meet new friends, code like a pro, discover who uses the same tools that you do, invite friends to dynamic workspaces and explore your world.
---

## 🚀 Features

- **Real-Time Multiplayer**: Synchronized movement, chat, and wearables via Socket.io.
- **3D Cursor Avatars**: Pastel-colored arrows with custom dev tags (`/nick`).
- **Interactive Districts**: Co-op dungeon crawler, Open Source HQ, Keynote Amphitheater, and a Green-Tech sandbox.
- **Silicon Valley**: Compressed 3D recreation of tech headquarters (Apple, Google, OpenAI, etc.).
- **Living World**: 20-minute day/night cycle, dynamic weather (rain, snow), and highway/train traffic.
- **Solo Mode**: Works completely offline/static without a multiplayer server.

---

## 🖼️ 📸 Screenshots & Gameplay

<img width="1200" height="700" alt="image-1792007569618" src="https://github.com/user-attachments/assets/3d3c7549-26b5-4b45-9a7e-883f6ea83521" />
<img width="1100" height="620" alt="image-1791929585609" src="https://github.com/user-attachments/assets/743ebdc4-6b07-4556-b61d-887e15694b89" />
<img width="595" height="260" alt="rfdsgdf" src="https://github.com/user-attachments/assets/32569009-eb9b-4c19-a433-8bdc1b150ce2" />
<img width="1100" height="620" alt="image-1792008718931" src="https://github.com/user-attachments/assets/9d41054a-ac18-45e6-b4b4-f02114069e44" />
<img width="1360" height="435" alt="Screenshot 2026-10-14 172729" src="https://github.com/user-attachments/assets/2001835a-9662-41ce-8bde-8367d90bc86e" />
<img width="1354" height="560" alt="Screenshot 2026-10-14 172842" src="https://github.com/user-attachments/assets/4d084e22-9f8b-4389-a829-22c391f140f2" />

## 🎮 Controls & Commands

### Basic Controls
- `W A S D` / Arrows: Walk | `Shift`: Run | `Space`: Jump
- Mouse Drag: Camera Look | Mouse Wheel: Zoom | Click: Interact
- `M` / Minimap Click: Toggle map and fast travel
- `Enter` / `T` / `/`: Chat | `Esc`: Close UI / Chat

<details>
<summary>💬 Click to view Chat Commands (Teleport, Social & Mini-games)</summary>

### Teleport & Places
- `/tp <player>` or `/tp <x> <y> <z>`: Teleport
- `/tpa <player>` / `/tpahere <player>`: Request teleport (requires consent)
- `/world <place>` (or `/warp`): Jump to a district or landmark
- `/spawn`: Return to Genesis Plaza
- `/sethome` / `/home`: Save/load local checkpoints

### World & Social
- `/time set <day|night|0-24000>`: Change world time
- `/weather <clear|rain|snow|thunder>`: Change weather
- `/nick <name>`: Change username
- `/msg <player> <text>`: Private whisper
- `/list`: See online developers

### District Mini-games
- `/bugs` & `/script <type>`: Fight monsters in Debug Dungeon
- `/pr <slot> <prop> [color]`: Open a Pull Request to change map props in Open Source HQ
- `/approve <n>` / `/merge <n>`: Review and merge live map changes
- `/stream <URL>` / `/watch [n]`: Control the Keynote Amphitheater big screen
- `/wear <item>`: Equip cursor wearables
- `/plant`: Plant trees in the Green-Tech Sandbox
</details>

---

## 🗺️ Universe Maps

The city is a grid of 16m × 16m parcels defined via JSON files in `public/maps/`.

<details>
<summary>🏙️ Click to view all Districts & Silicon Valley Landmarks</summary>

### Districts
- **Genesis Plaza & Districts**: Main spawn, Marketplace tower, and private corporate lots.
- **HQ Lobby & Pavilion**: Social hubs, Infinite Coffee Bar, and visual commit histories.
- **Scrum & Agile Space**: Interactive Kanban boards and burndown screens.
- **Museum of Forgotten Hardware**: Parkour inside a giant floppy disk, CRT monitor, and retro components.
- **Debug Dungeon**: Co-op RPG. Grab the **Git Commit Hammer** to fight bugs (Memory Leak, BSOD) for leaderboard points.
- **Open Source HQ**: Submit map adjustments via `/pr` and let other players review/merge them in real-time.

### Silicon Valley (`/world valley`)
- **San Francisco**: Golden Gate, Salesforce Tower, OpenAI, Anthropic, GitHub.
- **Peninsula**: Oracle, Meta (MPK 20), Stanford University, Tesla HQ, Googleplex, NASA Ames.
- **South Bay**: Apple Park (Ring & Steve Jobs Theater), NVIDIA, Adobe, Tesla Fremont Factory.
</details>

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: [Three.js](https://threejs.org) r128 (vanilla JavaScript, local vendor)
- **Backend**: Node.js + Express + Socket.io

```text
gitverse/
├── server.js            # Node/Socket.io backend (multiplayer sync & state)
└── public/
    ├── index.html       # UI HUD, chat, and video overlays
    ├── main.js          # Core engine, physics, network, and camera
    ├── city.js          # Day/night cycle, environment, and roads
    ├── props.js         # 3D block & model generator
    ├── maps/            # Worlds positioning layout (JSON)
    └── landmarks.js/museum.js/games.js # District-specific scripts
```

---

## 💻 Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the local server
npm start

# 3. Open in your browser
http://localhost:3000
```
*💡 **Pro Tip**: Open a second window in Incognito mode to test multiplayer interactions locally.*

---

## ☁️ Deployment & Roadmap

- **Hosting**: Requires a platform supporting WebSockets (Render, Railway, Fly.io) for multiplayer. Static hosts (Vercel) will auto-fallback to **Solo Mode**.
- **Roadmap**: 
  - [ ] Real GitHub API integration (generate maps from actual repo data).
  - [ ] WebRTC Proximity Voice Chat.
  - [ ] Persistent database storage for murals and leaderboards.

---

## Can I Contribute?

Contributions are welcome on this repo! Please fork, share the web link to your Discord servers, star this repo and make this get popular.
Obs.: Read the contributing.txt file before for more info :)

## 🤝 Contributors & Partners

This project is proudly supported and built in collaboration with:

- Apple Official
- Decentraland.org

---

## Also rip Zuckerberg's metaverse lol



<details>
<summary>🪦 Open Letter to Mark Zuckerberg (Click to expand)</summary>

Dear Mark, 

We saw what you tried to do with Horizon Worlds. We appreciated the effort, but devs don't need expensive VR goggles to look at low-poly empty plazas. They just need a terminal, a browser, and a way to judge each other's code. 

Rest in peace, corporate metaverse. The open-source community takes it from here.
</details>

---

## ⚖️ Disclaimer
Company names and structures are stylized wordmark recreations for identification purposes. Keynotes are streamed directly from official Apple/Google YouTube embeds. All trademarks belong to their respective owners.
