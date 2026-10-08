# สวนละมุน 3D · Little Gentle Garden

Play at **https://lsdxo.github.io/xoxo/**.

An original cozy 3D farming game with a Thai interface, handmade procedural models, Three.js, TypeScript and Vite. This is a real WebGL world, not a background screenshot. Desktop mouse/keyboard and mobile touch are supported.

## Simple farming

- Tap any plot: plant a seed, water a dry crop, or harvest a ripe one automatically according to its state. Empty grassy plots are prepared automatically.
- Use **ปลูกทั้งหมด**, **รดน้ำทั้งหมด** and **เก็บทั้งหมด** to manage the whole farm in one click. These convenience actions are free and do not require energy.
- Choose carrot, strawberry or pumpkin seeds. Crops take 18, 28 or 40 seconds after watering and never wilt.
- Sell crops, fish and eggs from the basket or shop. Buy one or five seeds at a time.
- Rest at the house for free to advance crops, refill energy and receive a new daily order.

## Automation and progression

The equipment shop sells a farm-wide sprinkler (60 coins), automatic harvest helper (140), organic fertilizer for 40% faster crop growth (100), and an automatic shipping box (180). Sprinklers also water newly planted seeds. Helpers collect ripe crops; shipping boxes sell basket contents. Enable/disable automation using the status chip—pause it to retain produce for daily orders. Fertilizer remains a passive crop-growth upgrade.

Expand from 16 to 20 usable plots for 180 coins. Earn XP through harvests, fishing, decoration, orders and quests; the garden level is shown in the HUD. Seven achievement quests and rotating daily crop orders provide coin rewards. Rewards and order submissions cannot be claimed twice.

## Decoration, fishing and animals

- The decoration shop offers flower beds, benches, lanterns, fountains and windmills. One flower bed is free.
- Choose **วางเอง** to tap a clear grassy area, or **จัดให้** for automatic placement. Decorations can be moved or returned to the bag. Reserved farm/building/river areas and overlapping placements are rejected.
- Fishing needs only **หย่อนเบ็ด → wait three seconds → รับปลาเลย**. There is no timing meter or failure window. Collect four fish species and sell them, or work on collection quests.
- Collect two eggs from the chickens every 30 game seconds; rest advances the timer too. Eggs sell for eight coins each.

## Controls

Drag to orbit, scroll/pinch to zoom, or use the camera reset button. Click/tap clear ground, use WASD/arrows or the touch pad to walk. Keys 1–3 trigger plant-all, water-all and harvest-all; B opens the basket. Escape cancels decoration placement. Dialogs block movement/camera input. The fishing dialog keeps simulation time running; other dialogs pause it.

## Saves and compatibility

Progress saves every five seconds and after successful actions, under the existing `little-gentle-garden:v1` localStorage key. Version-one 2D saves migrate with coins, inventory, crops and player position preserved. A pre-migration backup is retained under `little-gentle-garden:v1:before-3d` when storage permits. Extended fields are validated before loading. On reload, watered crops gain up to ten minutes of offline growth; purchased harvest and shipping automation settles ready produce.

Saves belong to this browser and origin. Accounts, multiplayer and cloud saves are not implemented. No credentials or backend service are required to play. Storage failures are reported in the HUD. WebGL context loss is handled with a recovery notice; unsupported GPU/browser configurations get a readable fallback.

## Development and verification

Node.js 24 is tested. Use the existing checkout; cloud tasks already run in isolated environments.

```sh
npm ci
npm run dev -- --port 5173
npm test
npm run build
```

`npm run build` type-checks and emits a standalone `dist/index.html` with code, styles and locally bundled Thai fonts. Original models are generated in the browser; no model or texture downloads are needed. Serve the contents of `dist` from any static host, including `THIRD_PARTY_NOTICES.txt`.

With a dev server running, use `npm run test:browser`. The test uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. Set `GAME_URL` for the production site. `OFFLINE_PLAY=1` disconnects networking after each document load. Screenshots are written to `test-results/`.

Tests cover original crop rules, bulk actions, automation, reward idempotency, save migration/validation, decoration collisions, fishing, orders and eggs. Browser tests exercise real 3D rendering and actual UI interactions, full farming loops, automation upgrades, decorations/moving/removal, fishing, quests, eggs, reload, keyboard movement and mobile touch. They check runtime errors, viewport overflow and a draw-call budget.

## Code boundaries

- `src/farm.ts`: compatible original simulation and save validation.
- `src/systems.ts`: extended serializable state, automation, decoration, fishing, quests, daily orders and migration.
- `src/models.ts`: original procedural model factories, shared geometry/materials and static geometry batching.
- `src/scene3d.ts`: Three.js renderer, camera, scene, picking, movement and effects. Geometry is reused, resolution is capped, and shadows update only when needed.
- `src/main.ts`: DOM HUD, dialogs, persistence, sound and command dispatch.
- `src/style3d.css`: responsive interface and reduced-motion preferences.

Game rules do not live in meshes. For future online play, add authenticated server-side command validation, authoritative time/inventory, proximity checks, idempotent commands and replicated state. Browser saves must not become multiplayer authority. For future externally authored assets, use validated and optimized GLB/glTF; this release needs no shipped model files.

## Publishing

GitHub Pages is already enabled. `.github/workflows/pages.yml` runs tests, builds the standalone game and publishes `dist` when `main` is updated. Verify the real deployed URL before reporting a new version as available. See `DEPLOYMENT.md` for the hosting setup.

Three.js and bundled fonts retain their upstream MIT/OFL notices in `public/THIRD_PARTY_NOTICES.txt` and the production distribution.
