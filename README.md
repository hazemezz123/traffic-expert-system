# Traffic Expert System

A static, browser-based 3D traffic intersection for a second-year AI project. Eight cars are controlled by a rule-based expert system that is completely separate from the Three.js scene; twelve animated pedestrians wait and cross under the same signal.

No backend, package installation, or build step is required at runtime. Three.js and its addons are pinned to **0.180.0** through a jsDelivr import map.

## Run locally

Serve the folder over HTTP (opening `index.html` directly will block ES modules and model loading):

```powershell
cd traffic-expert-system
npx --yes serve . -l 8000
```

Then open <http://localhost:8000/>.

Python 3 works too:

```powershell
python -m http.server 8000 --directory traffic-expert-system
```

An internet connection is needed for the pinned Three.js modules and the Draco decoder CDN. All models, textures, and application code are local.

## Controls

| Control | Behavior |
|---|---|
| **Pause / Start** | Freezes or resumes simulation time. Camera orbit and the inspector stay responsive. |
| **Reset** | Restores the red signal, timers, all eight cars, all pedestrians, selection, and decision log. |
| **Next light** | Advances the signal immediately (RED → GREEN → YELLOW → RED). |
| **Speed** | Simulation speed from 0.5× to 3×, without changing render rate. |
| **Stats** | FPS and draw-call overlay (`renderer.info.render.calls`). |
| **العربية / English** | Switches all labels and explanations; Arabic sets `dir="rtl"`. |
| **Click a car** | Raycast selection, green ground ring, and a live inspector for that car. |
| **Why?** | Shows the fired rule, all matched rules, priority, and the facts used. |
| **× / ☰** | Collapses or opens the inspector. It starts collapsed on screens up to 760 px wide. |

## Architecture

```text
traffic-expert-system/
├─ index.html                 shell, import map, panel markup
├─ css/style.css              desktop side panel, mobile bottom sheet, RTL
├─ js/
│  ├─ main.js                 fixed-step loop, inference clock, selection, wiring
│  ├─ expert/                 pure rule engine — no Three.js imports
│  │  ├─ rules.js             R1–R10, actions, priorities, bilingual text
│  │  ├─ facts.js             fact extraction from a car and the world
│  │  ├─ engine.js            forward chaining + priority conflict resolution
│  │  └─ explain.js           50-entry log and explanation formatting
│  ├─ scene/
│  │  ├─ world.js             renderer, camera, lights, OrbitControls
│  │  ├─ assets.js            GLB cache, Kenney environment, instancing
│  │  ├─ traffic-light-state.js  pure RED/GREEN/YELLOW controller
│  │  ├─ traffic-light.js     model visuals and emissive bulbs
│  │  ├─ vehicles.js          eight-car pool, raycast targets, fact context
│  │  ├─ vehicle-motion.js    acceleration, braking, queueing, stop-line clamp
│  │  ├─ pedestrians.js       twelve animated SkeletonUtils clones
│  │  └─ pedestrian-motion.js crossing state machine
│  └─ ui/
│     ├─ panel.js             facts, rules, recent decisions, Why dialog, i18n
│     └─ controls.js          toolbar and speed/stats inputs
├─ assets/models/             CC0 GLBs and shared textures
├─ scripts/fetch-assets.mjs   reproducible download/extract/compress pipeline
├─ tests/                     31 Node tests
├─ CREDITS.md
└─ README.md
```

### Separation of concerns

The expert layer consumes plain fact objects and returns `STOP`, `GO`, or `SLOW_DOWN`. It never imports Three.js and has no knowledge of meshes, cameras, or animation. The scene layer turns those actions into motion; the UI only reads snapshots. This makes every rule testable in Node and keeps the "AI" visibly independent from the graphics.

Data flow each inference tick:

```text
traffic light + pedestrians + car positions
        ↓
fillFacts() → engine.evaluate() → highest-priority action
        ↓
vehicle motion (queueing, braking, stop line)
        ↓
selected-car snapshot → facts table, rule highlight, decision log, Why dialog
```

Timing:

- Physics and signal: fixed **1/60 s** step with a capped accumulator.
- Expert inference: **10 Hz** (every 0.1 s of simulation time).
- Rendering: `requestAnimationFrame`.
- Decision log: newest-first, capped at **50** records; the panel shows the latest **10**.

## Expert system

### Facts

Each car is evaluated with: `light`, `distToStopLine`, `carAhead`, `distToCarAhead`, `safeDistance`, `pedestrianWaiting`, `pedestrianCrossing`, `crosswalkAhead`, `carInIntersection`, `carClearedIntersection`, `canStopSafely`, and `speed`.

`canStopSafely` compares the remaining distance with a braking-distance estimate. `crosswalkAhead` prevents R6 from stopping a car that has already driven past the zebra.

### Rules and conflict resolution

All conditions are evaluated (forward chaining over the fact set), then the matched rule with the highest priority fires. If no rule matches, the safe default is `STOP`.

| Rule | Priority | Action | Condition |
|---|---:|:---:|---|
| **R6** | 100 | STOP | Pedestrian crossing ahead, before the zebra |
| **R7** | 90 | GO | Car is already inside the intersection; clear it |
| **R3** | 80 | SLOW_DOWN | Green, but car ahead is closer than the safe distance |
| **R10** | 70 | GO | Passed the stop line but not yet clear of the junction |
| **R1** | 60 | STOP | Red light and approaching the stop line |
| **R4** | 60 | STOP | Yellow light and safe braking is still possible |
| **R5** | 60 | GO | Yellow light and safe braking is no longer possible |
| **R2** | 50 | GO | Green light, no car ahead |
| **R8** | 50 | GO | Green light, car ahead beyond the safe distance |
| **R9** | 40 | GO | Car has cleared the intersection |

R8–R10 extend the required R1–R7 so following and junction-clearing are explicit rather than implied. Pedestrian safety (R6) always outranks junction clearing (R7), which outranks every light rule.

Every explanation and rule string exists in English and Arabic; the fired rule is highlighted in the rules list.

## Simulation behavior

- **Cars:** preallocated pool of eight, spaced along the south approach, with stop-line clamping, queue following, recycling, and `MOVING` / `SLOWING` / `STOPPED` states.
- **Signal:** RED 8 s, GREEN 8 s, YELLOW 2 s. Cars decide from the current state; the model bulbs follow the same controller.
- **Pedestrians:** preallocated pool of twelve. They wait at the curb and enter only on RED when no car body overlaps the crosswalk. `Idle` and `Walk` clips are blended per clone; mixers update only for visible walkers.
- **Selection:** a raycast picks a car; the inspector, ground ring, facts table, rule highlight, decision log, and Why dialog all update from that car's snapshot.

## Performance

Measured in headless Chrome at 1440×900 with the full scene running:

| Metric | Target | Measured |
|---|---|---|
| Runtime model bytes | < 5 MB | **0.80 MB** (837,739 bytes) |
| Visible triangles | < 150k | **98,724** |
| Draw calls | — | **128** |
| Model requests | one per URL | **8 unique, 0 duplicates** |
| Console errors | none | **none** |

Implementation choices:

- Pixel ratio capped at **1.5**.
- One directional shadow light with a **1024²** map; hemisphere light for fill.
- Static scene meshes use `matrixAutoUpdate = false`.
- Lamps and cones use `InstancedMesh`; road straight tiles are instanced.
- Cars share cached sedan/SUV models; pedestrians share a cached Rig via `SkeletonUtils`.
- Only visible pedestrian mixers are updated.
- No post-processing and no per-frame DOM allocation for stats.

## Tests

```powershell
npm test
```

**31/31 tests pass** using Node's built-in test runner:

- Rule isolation for R1–R7, STOP/GO/SLOW_DOWN outcomes, matched-rule IDs.
- Priority conflicts: pedestrian safety over junction clearing, clearing over light/following, safe green following.
- Stop-line boundary, cars already past the crosswalk, cars that cleared the junction.
- Decision-log cap, copied fact snapshots, Arabic explanation.
- Signal cycle, boundary carryover, manual advance, reset.
- Vehicle acceleration/braking/queue gap, nearest-ahead lookup, stop-line approach.
- Pedestrian entry gating, stagger, crossing completion, no turning back on green.

A separate browser interaction run (not committed, using Chrome DevTools Protocol) verified load, pause, signal advance, 3× speed, stats, Why dialog, Arabic RTL, raycast selection, reset, and the 390×844 bottom sheet: **10/10 checks**, no console exceptions.

## Assets

All runtime models are **CC0 1.0**. Author, license, source URL, access date, and exact files are listed in [`CREDITS.md`](CREDITS.md).

- Kenney City Kit (Roads) 2.2 — 4-way crossroad with zebra arms, straight tiles, traffic light, curved lamp, cone.
- Kenney Car Kit 3.1 — sedan and SUV.
- Quaternius Ultimate Animated Character Pack — Casual_Male with `Idle` and `Walk`.

### Rebuild the asset set

```powershell
npm run assets
```

The script downloads the two pinned Kenney archives, verifies the Quaternius pack from the supplied source when the Drive quota blocks a redownload, extracts only the selected files, compresses character geometry with Draco through `@gltf-transform/cli`, writes shared texture atlases, and regenerates `CREDITS.md`. It fails loudly on HTML error pages, missing entries, or failed conversion. Rebuild requires Node 18+, internet access, and npx.

To swap a model, keep the same output filename in `assets/models/`, or update `URLS` in `js/scene/assets.js`. Update the rebuild selections and credits when the source changes.

## Tuning

| What | Where |
|---|---|
| Rule conditions, priorities, bilingual text | `js/expert/rules.js` |
| Fact definitions and safe-stopping estimate | `js/expert/facts.js` |
| Inference rate and fixed timestep | `js/main.js` |
| Signal durations | `js/scene/traffic-light-state.js` |
| Speeds, gaps, stop line, crosswalk, spawn/recycle | `js/scene/vehicles.js` |
| Pedestrian count, speed, curb, stagger | `js/scene/pedestrians.js`, `js/scene/pedestrian-motion.js` |
| Camera, shadows, pixel ratio | `js/scene/world.js` |

Keep `stopLineZ`, `crosswalkStartZ`/`crosswalkEndZ`, and `intersectionExitZ` consistent with the visible road pieces if you move the junction.

## Deploy to GitHub Pages

The site is pure static files with relative paths, so no build or configuration is needed.

1. Push the repository, including `traffic-expert-system/`, to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. If the project stays nested, the site is served at `https://<user>.github.io/<repo>/traffic-expert-system/`.
5. To serve it at the repository root instead, copy the contents of `traffic-expert-system/` to the repository root and publish from `/ (root)`.

All asset and module paths are relative, so both layouts work. The page still needs HTTPS access to jsDelivr for Three.js and the Draco decoder.

## Credits

Asset credits and license verification: [`CREDITS.md`](CREDITS.md). The user-supplied Quaternius source pack outside this folder was preserved unchanged.
