# สวนละมุน · Little Gentle Garden

A playable, self-contained cozy farming game. Thai UI, original procedural 2D artwork, Phaser 3, TypeScript and Vite. Desktop keyboard/mouse and mobile touch controls.

## Play

Open the production `dist/index.html` in a modern browser. It contains the game, fonts and artwork; no server or Internet connection is required after downloading. Some mobile file viewers do not execute HTML—serve the file from any static website in that case.

For development (Node.js 22.12+ or the tested Node.js 24):

```sh
npm ci
npm run dev -- --port 5173
```

Open the development server in your browser. Build a distributable single HTML file with `npm run build`.

## Controls and game loop

- Click/tap a plot: walk to it and use the selected tool.
- Click/tap open ground, use WASD / arrow keys, or use the mobile directional pad to walk.
- Keys 1–4 select hoe, seeds, watering can and harvest basket. E / Space uses the tool on the nearest plot. B opens inventory.
- Hoe grassy plots, select a seed, plant, then water once. Carrots take 18 seconds, strawberries 28, pumpkins 40. Crops never wilt.
- Harvest with the basket; sell produce from your inventory or the shop. Buy seeds and unlock four extra plots for 180 coins.
- Each successful plot action uses two energy. Rest at the house for free to refill energy and advance watered crops to the next day.
- Harvest three plants to earn a one-time 30-coin reward.
- Game time pauses while a dialog is open or the tab is hidden. On reload, watered crops gain up to ten minutes of offline growth.

Progress is saved locally every five seconds and after actions, under `little-gentle-garden:v1`. It belongs to this browser and origin; local-file and hosted copies have separate saves. Storage restrictions are reported in the HUD. No account or network service is required. Sound is optional and off by default.

## Validation

```sh
npm test
npm run build
# With the dev server running and Chromium installed:
npm run test:browser
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. Set `GAME_URL` to test another server. To validate the production build, start `npm run preview -- --port 4173`, then run `GAME_URL=http://127.0.0.1:4173 OFFLINE_PLAY=1 npm run test:browser`. This disconnects networking after each document load and restores it only for navigation. Browser playtests exercise real pointer/keyboard actions, a full crop loop, purchases, sales, quest rewards, save/reload, modal pause and touch harvest at 390 × 844. Screenshots are written to `test-results/`.

The managed Chromium in the cloud environment blocks `file://` navigation by administrator policy. Production validation therefore loads the standalone HTML through a local static server and tests gameplay with networking disabled. Direct file opening is intended for ordinary browsers without that policy.

## Architecture and online extension

- `src/farm.ts`: serializable state, crop definitions, validated commands, rewards, growth and save validation. No dependency on Phaser.
- `src/scene.ts`: input, movement, camera and visual feedback.
- `src/art.ts`: original canvas-generated world, character, crop and animal textures.
- `src/main.ts`: command dispatch, DOM HUD, dialogs, storage and sound.
- `src/style.css`: responsive Thai interface; fonts are bundled locally.

The current game is **single player**. No multiplayer connection, shared world, account system or cloud save is implemented. To add online play, place an authenticated WebSocket/API boundary around `Action`, validate proximity and command permissions on the server, and let the server own time, inventory and persistence. Add player IDs, sequence numbers/idempotency, room membership and replicated state snapshots. Client local saves and values are untrusted and must not be used as online authority. Keeping rules outside the renderer makes that integration possible without rebuilding the rendering layer.

The generated concept image is visual direction; the playable version uses lighter, original procedural artwork. All visual assets and fonts in the build work offline. Font packages retain their upstream OFL licensing; other dependencies retain their respective licenses.
