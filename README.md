# Desk '95

Seated, hands-first 1995 study-desk cockpit for the Meta VR Start Developer Competition.
Stack: @iwsdk/core 1.0.1, Three.js, TypeScript, Vite 7.

## Run it
```bash
npm install
npm run dev          # https://localhost:5173 (self-signed cert: click Advanced, then continue)
npm run typecheck
npm run build        # production build into dist/
```
No models yet? Open `https://localhost:5173/?placeholders=1` to get a bare CRT screen so you can test the shader.

## Test without a headset (desktop emulator)
The dev server loads the IWER Quest 3 emulator on localhost. Dev-only keyboard shortcuts (click the page first):

| Key | Does |
|---|---|
| 1 | CRT boot screen ("insert disk") |
| 2 | CRT task terminal (demo task) + floppy sound |
| 3 | CRT VHS mode (colour bars if no video) |
| 4 | CRT static glitch |
| s | clear static (like a slap) |
| g | degauss |
| p | CRT power on/off |
| k | ask the pager agent (cycles preset goals, dispenses floppies) |
| h | slap the CRT |

## Test on a Quest
1. Quest on the same Wi-Fi, open `https://<your-pc-ip>:5173` in the Quest browser, accept the certificate warning.
2. Turn hand tracking ON. The experience must work with hands only (competition rule).

## Make the models in the cloud (GitHub Codespaces + headless Blender)
Good for a low-RAM PC: Blender runs in the cloud, you only use a browser tab.
1. Push this project to a GitHub repo, then Code > Codespaces > Create codespace. The `.devcontainer` installs Node and Blender 4.0 (Ubuntu's package).
2. Make a model from a script (no GUI needed):
   ```bash
   blender -b -P blender/make_floppy.py      # -> public/models/floppy_disk.glb
   blender -b -P blender/make_cassette.py    # -> public/models/cassette_tape.glb
   blender -b -P blender/make_crt_pc.py      # -> public/models/crt_pc_combo.glb (PC case + 14" CRT)
   blender -b -P blender/make_boombox.py     # -> public/models/boombox_95.glb (hinged lid, 3 buttons, spindles)
   blender -b -P blender/make_pager.py       # -> public/models/pager_95.glb (translucent pager on a printer dock)
   blender -b -P blender/make_vcr.py         # -> public/models/vcr_deck.glb (top-loading, tape well, eject button)
   blender -b -P blender/make_vhs_tape.py    # -> public/models/vhs_tape.glb
   blender -b -P blender/make_room.py        # -> public/models/room_1995.glb (U-shaped desk, window, walls)
   blender -b -P blender/make_lamp.py        # -> public/models/desk_lamp.glb
   ```
3. Look at it: `blender -b -P blender/preview.py -- public/models/floppy_disk.glb out.png 30 32` renders a PNG (CPU, ~10 s). Open the PNG in the Codespaces file explorer. See `blender/previews/` for examples.
4. Check part names and size: `python3 blender/check_glb.py`
5. Commit the `.glb` files and pull them to your PC, or just run `npm run dev` in the Codespace and open the forwarded port in your browser.
To add a new model, copy `make_floppy.py` and use the helpers in `blender/lib.py` (`box`, `cylinder`, `plane`). Coordinates are the same as the game code: x right, y up, z towards the player, metres.
All nine models now exist as simple stand-ins; swap any of them for a nicer model that keeps the same part names.
Desk top is at y = 0.75 (the spec said 0.72, but its items sit at 0.75, so the room was built to match).
`blender -b -P blender/preview_scene.py -- out.png` renders the whole scene from the player's seat with Blender's own lights (a rough guide, not a game screenshot). See `blender/previews/scene_from_player_seat.png`.
`npm run check:layout` loads the real models at their game positions and checks for overlaps, desk edges, arm's reach, CRT distance and the VHS-in-VCR fit. Run it after moving anything.
Free Codespaces gives 120 core-hours a month (about 60 hours on a 2-core machine). Stop the codespace when you are not using it.
The devcontainer itself is untested; the Blender scripts were run with Blender 4.0.2 headless.

## Where to tune things
| Problem | File / constant |
|---|---|
| Floppy will not snap in | `FLOPPY_INSERT_AXIS`, `SNAP_DISTANCE`, `MIN_ALIGNMENT` in `systems/FloppyDriveSystem.ts` (console prints "misaligned (dot=...)") |
| Cassette door swings the wrong way | `DOOR_OPEN_ROT` in `systems/CassetteTimerSystem.ts` |
| Spools spin on the wrong axis | `SPOOL_AXIS` in `systems/CassetteTimerSystem.ts` |
| Button pushes the wrong direction | the `axis: [x, y, z]` passed to `buttons.add(...)` in each system |
| Too dark / too bright | light intensities in `scene/DeskEnvironment.ts` (`lights`), `toneMappingExposure` |
| Where things sit on the desk | `LAYOUT` in `scene/DeskEnvironment.ts`, `SPOTS` in `scene/DeskProps.ts` |
| Missing part names | read the console on load, then edit `PARTS` in `scene/AssetRegistry.ts` |
| Pager with an AI endpoint | set `VITE_AGENT_URL` (POST `{goal}` returns `{tasks:[{title,durationMinutes,colorHex,subtasks[]}]}`); without it an offline planner runs |

## Deploying for judges (Vercel)
The emulator is already switched on for production builds in `vite.config.ts`, so people without a headset can try the link in a desktop browser. It never starts inside a real Quest browser.
1. Push the project to a GitHub repo (do not commit `node_modules` or `dist`).
2. On vercel.com: Add New > Project > import the repo. It detects Vite on its own: build command `npm run build`, output folder `dist`. Click Deploy. If the build complains about the Node version, set Node 22.x in Project Settings > General.
3. Or from this folder: `npm i -g vercel`, then `vercel` (preview) and `vercel --prod`.
4. Open the Vercel link on your PC and on a Quest browser to check it. Put that link in your Devpost submission.
The dev-only keyboard shortcuts (1-4, s, g, p, k, h) do not exist in the deployed build; use the emulator's own controls there.
GitHub Pages also works but needs a `base` path in `vite.config.ts`; Vercel is simpler.

## Not built yet
Archive spike for finished floppies, Havok physics (a simple fall-to-desk system is used), DistanceGrabbable, voice input for the pager.

## Honest status
Typechecks and builds. The shader compiles in a GLSL validator and the finger-press math was tested headlessly.
It has NOT been run with real models or on a headset: light values, snap distances and axes are starting guesses.
