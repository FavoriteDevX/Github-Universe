### GitHub Multiverse

<img width="1370" height="768" alt="GitVerse screenshot" src="https://github.com/user-attachments/assets/33672bb3-ddbe-4782-8b29-527179559d01" />

A Decentraland-like, fully functional 3D collaborative metaverse built for developers. Instead of clunky character avatars, every developer walks the world as a custom **three-dimensional mouse pointer**, through one continuous low-poly universe: a Genesis City of themed districts, interactive resources, and a stylized recreation of Silicon Valley.

---

## 🚀 Features

- **Real-Time Multiplayer Sync**: Powered by Socket.io. Every developer's movement, chat, name and wearables are replicated instantly to all connected clients.
- **3D Cursor Avatars**: Everyone is a clean, pastel-colored 3D arrow with a developer tag (`Dev_XXXX`, or your own name with `/nick`). You walk, run and jump in third person, like in Decentraland.
- **Chat Bubbles**: Messages float as bubbles above the sender's cursor and appear in the chat log, tagged with the district where they were said.
- **Minecraft-Style Chat Commands**: Teleports, a shared day/night cycle, weather, warps, homes, whispers and more (see [Chat commands](#-chat-commands)).
- **One Continuous Universe**: Every map is a district on a 16m × 16m parcel grid (Genesis City style), connected by roads, surrounded by generated parcels with gardens, houses, art sculptures, market kiosks and "parcel for sale" lots.
- **Interactive Districts**: a co-op dungeon crawler against famous bugs, an Open Source HQ where Pull Requests change the map, a keynote amphitheater showing Apple's WWDC keynotes, a museum of forgotten tech and a Green-Tech sandbox.
- **Silicon Valley**: a stylized recreation of the valley, from the Golden Gate Bridge to San Jose, with Apple Park, Googleplex, Anthropic, Tesla, EA, Meta, NVIDIA, Oracle, Stanford and more.
- **Living World**: a 20-minute day/night cycle with stars and lit windows, rain, snow and thunderstorms, drifting clouds, traffic on US-101 and a Caltrain running along the peninsula.
- **Immersive Lighting & Shadows**: PCF soft shadow maps give the whole world an organic architectural-maquette look.
- **Solo Mode**: on static hosts with no server, the world still loads and every single-player feature works.

---

## 🎮 Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrow keys | Walk |
| `Shift` | Run |
| `Space` | Jump (climb stairs, platforms and the CRT parkour) |
| Mouse drag | Look around (third-person camera) |
| Mouse wheel | Zoom the camera in and out |
| Click | Inspect an object, or interact (monsters, screens, booths, hammer) |
| `M` | Toggle the map view; click anywhere on the map to jump there |
| Minimap click | Jump to that spot |
| `Enter`, `T` or `/` | Open the chat |
| `Esc` | Close the chat, info cards and the video player |

---

## 💬 Chat commands

Type `/help` in game for the full list, or `/help <page>` for one section.

### Teleport and places
| Command | Action |
| --- | --- |
| `/tp <player>` | Teleport to another developer |
| `/tp <x> <z>` or `/tp <x> <y> <z>` | Teleport to coordinates (`~` for relative values, e.g. `/tp ~10 ~ ~-5`) |
| `/tpa <player>` | Ask to teleport to a player |
| `/tpahere <player>` | Ask a player to teleport to you |
| `/tpaccept` / `/tpdeny` | Answer a teleport request |
| `/world <place>` (also `/warp`, `/goto`) | Jump to a district or a Silicon Valley landmark |
| `/worlds` (also `/warps`) | List every place |
| `/spawn` | Back to Genesis Plaza |
| `/sethome` / `/home` | Save your current spot and come back to it later (stored in your browser) |

> Moving **another** player always requires their consent (`/tpahere` + `/tpaccept`). There is no server operator, so nobody can drag other players around.

### World
| Command | Action |
| --- | --- |
| `/time set <day\|noon\|sunset\|night\|midnight\|0-24000>` | Set the shared time of day (Minecraft ticks: 0 = 06:00, 6000 = noon, 18000 = midnight) |
| `/time add <ticks>` / `/time query` | Advance or read the clock |
| `/gamerule doDaylightCycle <true\|false>` | Freeze or resume the day/night cycle |
| `/weather <clear\|rain\|snow\|thunder>` | Change the weather for everyone |

### Social
| Command | Action |
| --- | --- |
| `/nick <name>` | Rename yourself (3-16 letters, numbers or `_`) |
| `/msg <player> <text>` (also `/tell`, `/w`) | Private message |
| `/r <text>` | Reply to the last private message |
| `/me <action>` | Action message (`* Dev_1234 waves`) |
| `/list` (also `/who`) | Who is online and in which district |
| `/coords` | Your position and parcel |
| `/clear` | Clear the chat log |

### District mini-games
| Command | Where | Action |
| --- | --- | --- |
| `/bugs` | Debug Dungeon | List the bugs that are alive, their HP and weakness |
| `/script <gc\|try-catch\|break\|mutex\|unit-test\|reboot>` | Debug Dungeon | Cast a script on the nearest bug (super effective against its weakness) |
| `/mural <1-4> <code>` | Open Source HQ | Post a line of code on a mural |
| `/pr <slot 1-8> <tree\|lamp\|banner\|fountain\|duck\|flag\|neon\|bench> [hexcolor]` | Open Source HQ | Open a Pull Request that changes a decoration |
| `/prs` | Open Source HQ | List open Pull Requests |
| `/approve <n>` / `/merge <n>` / `/close <n>` | Open Source HQ | Review, merge or close a Pull Request |
| `/keynotes` / `/watch [n]` | Keynote Amphitheater | List the keynote playlist and play one |
| `/stream <YouTube or Twitch URL> [title]` / `/endstream` | Keynote Amphitheater | Put a live event on the big screen for everyone, or go back to the playlist |
| `/wear <hoodie\|mug\|cap\|headphones\|none>` | Anywhere | Dress your cursor with a dev wearable |
| `/plant` | Green-Tech Sandbox | Plant a tree where your cursor stands (up to 10 per dev) |
| `/energy` | Green-Tech Sandbox | Show the district's renewable energy level |

---

## 🗺️ Maps

Every map is a JSON file in `public/maps/` and is registered in `public/maps/worlds.json`, which places it on the city grid. Each `type` in a map is turned into the object it describes (a palm tree, an arcade cabinet, a Kanban board...) by the builders in `public/props.js`, `landmarks.js`, `museum.js` and `games.js`.

### Genesis City districts
| `/world` key | District | What you'll find |
| --- | --- | --- |
| `plaza` | **Genesis Plaza** | The spawn at parcel (0,0): teleport pad, hologram pillar, plaza gate, Marketplace tower, Aetheria and Vegas boundaries |
| `districts` | **Genesis Districts** | Roads, the Vegas casino (blinking marquee), Fashion Street, Aetheria cyber tower and private lots (GitHub Enterprise HQ, Vercel Deploy Zone, StackOverflow Lab) |
| `lobby` | **HQ Lobby** | The core social room around the central reception desk, lounge sofas and the Infinite Coffee Bar |
| `pavilion` | **Repository Pavilion** | Exhibition of green and blue pedestals with floating files, folders and branches, plus a commit history wall |
| `agile` | **Scrum & Agile Open Space** | Kanban whiteboards with sticky notes, a stand-up table, a retro corner and a burndown screen |
| `social` | **Horizon & Somnium** | Keynote podium, avatar lounge ring and an AI companion |
| `gallery` | **Upland Gallery** | Minted and locked NFT houses and a voxel art wall |
| `mall` | **GamiMall** | Wearables stores with storefronts, an upper terrace and an escalator |
| `apple` | **House of MAC** | Aluminum plaza, an interactive terminal and a live music stage |
| `cyberpunk` | **Cyberpunk Repo** | Pulsing neon pillars and server racks with blinking LEDs |
| `arcade` | **Arcade Room** | Arcade cabinets, a pool table and a battlestation |
| `house` | **Hacker House** | A two-story house with stairs, a sofa and a kitchen |
| `sandbox` | **Sandbox Voxels** | A castle tower, a voxel bridge, an NFT showcase and a quest NPC |
| `retro` | **Retro Contributions** | A full year of contributions as 3D voxels |
| `beach` | **Tropical Beach** | Palm trees, beach chairs and umbrellas by the water |
| `zen` | **Zen Temple** | A private floating island above a lake, with a waterfall, cherry trees and a meditation altar |

### Interactive districts
| `/world` key | District | How it works |
| --- | --- | --- |
| `museum` | **Museum of Forgotten Hardware & Software** | Walk inside a giant 3.5" floppy disk, climb the stairs onto a Pentium-era processor and its circuits, parkour up a giant CRT monitor, and browse a clicky keyboard, a cassette, a spinning CD-ROM, a vacuum-tube wall, punch cards, a ball mouse and the Hall of Forgotten Software (DOS, BASIC, early desktops, 90s homepages) |
| `dungeon` | **Debug Dungeon (Labyrinth of Bugs)** | A co-op dungeon crawler. Grab the **Git Commit Hammer** at the entrance and click bugs to hit them, or cast `/script`s. Monsters: Memory Leak, NullPointerException, Infinite Loop, Race Condition, Off-By-One Error and the **Blue Screen of Death** boss. Health is owned by the server, so everyone fights the same bugs; defeated bugs respawn after 30 s, and kills go to the **Bug Bounty Leaderboard** |
| `opensource` | **Open Source HQ** | A 3D home for repositories: code murals anyone can post to, floating meeting rooms and 8 decoration slots. Changing a decoration takes a real review flow: `/pr`, then another dev runs `/approve`, then `/merge`. The Pull Request board shows what is open |
| `keynote` | **Keynote Amphitheater** | A permanent arena inspired by WWDC and Google I/O stages. The big screen rotates through Apple's official WWDC keynotes (2023, 2024 and 2025, played through YouTube's embedded player from Apple's own channel); click a screen or `/watch` to play. `/stream` puts any YouTube or Twitch live event on the screen for everyone. The wearables booths dress your cursor with a hoodie or an endless coffee mug |
| `greentech` | **Green-Tech Sandbox** | Green IT: a solar farm, spinning wind turbines, a liquid-cooled data center with a living roof, a vertical farm, EV chargers, battery storage and a Code Efficiency Lab comparing the energy cost of algorithms. Plant trees with `/plant` to raise the district's renewable energy meter |

### Silicon Valley (`/world valley`)
A large region south of the city, reached by the avenue that becomes **US-101**. Distances are compressed, but the geography keeps the real north-to-south order: San Francisco → Redwood City → Menlo Park → Palo Alto → Mountain View → Sunnyvale → Cupertino / Santa Clara → San Jose, with Fremont across the bay. It includes US-101 with moving traffic, I-280, El Camino Real, Sand Hill Road, a running Caltrain, the Dumbarton Bridge and billboards along the freeway.

| `/world` key | Landmark |
| --- | --- |
| `goldengate` | Golden Gate Bridge (Art Deco towers, catenary cables, suspender ropes) |
| `sf`, `anthropic`, `openai`, `github` | San Francisco: Salesforce Tower, Transamerica Pyramid, Anthropic, OpenAI, GitHub and Uber |
| `oracle`, `ea` | Redwood Shores: Oracle's cylindrical glass towers around the lagoon, Electronic Arts |
| `meta` | Menlo Park: Meta's MPK 20 with its rooftop park and the 1 Hacker Way sign; the Sand Hill Road VC row |
| `stanford`, `tesla` | Palo Alto: Stanford (Main Quad, Memorial Church, Hoover Tower), the HP Garage, HP, Tesla's Global Engineering HQ with Superchargers |
| `google`, `chm` | Mountain View: Googleplex with Bay View's dragonscale canopies and campus bikes, Computer History Museum, Microsoft |
| `nasa` | Sunnyvale: NASA Ames Hangar One, LinkedIn |
| `applepark` | Cupertino: Apple Park's ring with its solar roof and inner park, Steve Jobs Theater and the Visitor Center |
| `nvidia`, `levis` | Santa Clara: NVIDIA's triangular Endeavor and Voyager buildings, Intel, Levi's Stadium |
| `sanjose` | San Jose: Adobe towers, SAP Center, downtown skyline, Cisco, eBay, Netflix (Los Gatos) |
| `fremont` | Tesla Fremont Factory with its parking lots |

---

## 🛠️ Architecture & Tech Stack

```text
gitverse/
├── package.json         # Node.js dependencies and run scripts
├── server.js            # Express + Socket.io: cursors, chat, world clock & weather, teleports, game state
└── public/
    ├── index.html       # HUD, chat, minimap, video player overlay
    ├── main.js          # Engine, avatar physics, third-person camera, teleports, chat commands, network
    ├── city.js          # Genesis City: parcel grid, roads, generated parcels, sky, day/night, weather
    ├── props.js         # Turns every map block "type" into a low-poly object
    ├── landmarks.js     # Silicon Valley headquarters, highways, traffic, Caltrain, billboards
    ├── museum.js        # Museum of Forgotten Hardware & Software exhibits
    ├── games.js         # Debug Dungeon, Open Source HQ, Keynote Amphitheater, Green-Tech Sandbox
    ├── maps/            # One JSON per map + worlds.json (layout of the city)
    └── vendor/          # Three.js r128 + OrbitControls, served locally (MIT)
```

- **Frontend Core**: [Three.js](https://threejs.org) r128 (vendored in `public/vendor`, no CDN needed)
- **Backend Hub**: Node.js & Express
- **Networking Protocol**: Socket.io

---

## 💻 Getting Started Locally

### 1. Prerequisites
[Node.js](https://nodejs.org) v18 or higher.

### 2. Installation
```bash
npm install
```

### 3. Execution
```bash
npm start
```

### 4. Open Interface
```text
http://localhost:3000
```

*💡 **Pro Tip**: Open a second Incognito/Private window next to the first one to see two developers walking, chatting and squashing bugs together.*

Deep links drop you straight into a place, e.g. `http://localhost:3000/#applepark` or `http://localhost:3000/#dungeon`.

---

## 🧱 Adding a map

1. Create `public/maps/map_<name>.json`:
   ```json
   {
     "themeName": "My District",
     "backgroundColor": "#1e1e24",
     "blocks": [
       { "type": "floor", "position": [0, -0.5, 0], "scale": [40, 1, 40], "color": "#2d2d34" },
       { "type": "kanban_board_todo", "position": [0, 3, -10], "scale": [6, 5, 0.3], "color": "#ffffff", "label": "Kanban: To Do" }
     ]
   }
   ```
   `position` and `scale` are `[x, y, z]` in meters relative to the district center. `label` shows on hover and in the info card.
2. Register it in `public/maps/worlds.json` with a free `cell` on the city grid (each cell is 64m = 4×4 parcels) and an optional `span` for bigger districts:
   ```json
   { "key": "mydistrict", "file": "map_my_district.json", "name": "My District", "description": "...", "cell": [-3, 2], "span": [1, 1], "color": "#ff2d7a" }
   ```

The block `type` decides the model. Some of the recognized types: `floor`, `wall`, `road`, `water`, `desk`, `table`, `sofa`, `stairs_step`, `kanban_board_*`, `sticky_note`, `palm_trunk`, `palm_leaves`, `arcade_cabinet_*`, `pool_table_base`, `server_rack`, `neon_pillar`, `stage`, `pedestal`, `plant`, `billboard`, `hq_<company>`, and many more (see the rule lists at the end of each builder file). Unknown types fall back to an outlined block.

---

## ☁️ Deploying

Multiplayer needs the Node server running on a host that keeps a Node process alive and supports WebSockets (e.g. Render, Railway or Fly.io). Static hosts such as Vercel only serve the `public/` folder: the universe still loads, but in **solo mode** (no other devs; mini-game state stays local).

Game state (leaderboard, murals, Pull Requests, planted trees, live stream) lives in the server's memory and resets when the server restarts.

---

## ⚖️ Trademarks & media

Company names appear as plain text wordmarks in brand colors to identify the landmarks they represent; no trademarked logo artwork is reproduced, and the buildings are stylized recreations. The WWDC keynotes are not stored in this repository: they are played through YouTube's official embedded player from Apple's own YouTube channel, and the screen shows YouTube's thumbnails. All trademarks belong to their respective owners; this project is not affiliated with or endorsed by any of these companies.

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **GitHub API Core Integration**: Connect GitHub personal access tokens to build districts from real repositories and contribution data.
- [ ] **Proximity Voice Chat**: WebRTC voice that fades in as cursors get closer.
- [ ] **Interactive File Editing Node**: Click objects to open repository trees or shared notepads in 3D.
- [ ] **Persistent Game State**: Save leaderboards, murals and merged Pull Requests to a database.

## LICENSES

Check the LICENSE.md file on the tree of the repository to more info about the licenses of this repo.

