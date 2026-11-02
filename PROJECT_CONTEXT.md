# Traffic Expert System — Full Project Context & Architecture

This project is an **interactive 3D traffic intersection** demonstrating a classical **Rule-Based Expert System (Symbolic AI)**.

Rather than using a "black-box" machine learning model or neural network, each autonomous vehicle decides its actions (`STOP`, `GO`, `SLOW_DOWN`) through an explicit, transparent inference engine governed by formal rules and priority-based conflict resolution.

---

## 1. Core Architectural Philosophy

The application is strictly decoupled into three layers:

```text
┌────────────────────────────────────────────────────────┐
│                   Three.js Scene                       │
│  • World, lights, shadows, OrbitControls               │
│  • Vehicle physical motion (acceleration/braking)      │
│  • Pedestrian crossing state machine & skeletal walk   │
│  • Traffic light signal controller                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Extracts live facts
                           ▼
┌────────────────────────────────────────────────────────┐
│               Pure Expert System Engine                │
│  • 100% pure JavaScript (0 dependencies, no Three.js)  │
│  • Working Memory (Fact Extraction)                    │
│  • Rule Base (R1–R10 with priority ranking)            │
│  • Forward-chaining inference & Conflict Resolution    │
│  • Fully unit-testable in Node.js (31 tests pass)      │
└──────────────────────────┬─────────────────────────────┘
                           │ Returns action & explanation
                           ▼
┌────────────────────────────────────────────────────────┐
│                    UI & Inspector                      │
│  • Raycast car selection & live facts table            │
│  • Real-time rule highlighting & decision log          │
│  • "Why?" explainability dialog                        │
│  • Bilingual support (English / Arabic with RTL)       │
└────────────────────────────────────────────────────────┘
```

Because `js/expert/` has zero dependencies on Three.js or the DOM, the AI can be verified headlessly via `npm test` without loading any 3D assets or WebGL contexts.

---

## 2. File Organization

| Path | Purpose |
|---|---|
| **`index.html`** | Single-page shell, Three.js CDN import map, HUD layout. |
| **`css/style.css`** | Responsive styling (side panel on desktop, bottom sheet on mobile, RTL styling). |
| **`js/main.js`** | Orchestrator: fixed-step accumulator, 10 Hz inference clock, raycasting, selection. |
| **`js/expert/rules.js`** | Definitions of rules **R1–R10**, their priorities, conditions, and bilingual explanations. |
| **`js/expert/facts.js`** | Fact extraction function (`fillFacts`) converting physical scene state into symbolic facts. |
| **`js/expert/engine.js`** | Forward-chaining evaluator and priority-based conflict resolver. |
| **`js/expert/explain.js`** | Decision logger (capped at 50 entries) and formatting for the "Why?" dialog. |
| **`js/scene/world.js`** | Three.js renderer, camera, directional shadow light, hemisphere light, resize handler. |
| **`js/scene/assets.js`** | GLTF/Draco loader, environment tile instancing, car and pedestrian caching. |
| **`js/scene/traffic-light-state.js`** | Pure signal timing state machine (`RED 8s` → `GREEN 8s` → `YELLOW 2s`). |
| **`js/scene/traffic-light.js`** | 3D traffic light model and emissive bulb materials. |
| **`js/scene/vehicles.js`** | 8-car pool manager, spawn spacing, recycling, and fact bindings. |
| **`js/scene/vehicle-motion.js`** | Kinematic physics: acceleration, braking curves, stop-line clamp, minimum following gap. |
| **`js/scene/pedestrians.js`** | 12 animated pedestrian instances using `SkeletonUtils.clone` and animation mixers. |
| **`js/scene/pedestrian-motion.js`**| Curb-to-curb crossing state machine with staggered entry delays. |
| **`js/ui/panel.js`** | Inspector UI: live fact rows, rule list, decision log, "Why?" popup, language translations. |
| **`js/ui/controls.js`** | Toolbar event handlers: Pause/Start, Reset, Next Light, Speed slider, Stats toggle. |
| **`tests/*.test.mjs`** | 31 unit tests executing rule isolation, priority conflicts, signal states, and physics bounds. |

---

## 3. How the Expert System Works

### A. Working Memory: Fact Extraction (`facts.js`)
Every evaluation cycle, the system extracts a fact object for each vehicle:
- `light`: Current light color (`RED`, `GREEN`, `YELLOW`).
- `distToStopLine`: Signed distance along the Z-axis to the stop line.
- `carAhead`: Boolean indicating if another vehicle is directly in front.
- `distToCarAhead`: Distance to the car ahead (or `Infinity`).
- `safeDistance`: Target following distance (7.0 meters).
- `pedestrianCrossing`: `true` if any pedestrian is actively in the crosswalk.
- `crosswalkAhead`: `true` if the car hasn't yet driven past the crosswalk zebra lines.
- `carInIntersection`: `true` if the car is currently inside the 4-way box.
- `carClearedIntersection`: `true` once past the exit boundary.
- `canStopSafely`: Evaluates whether the car has enough stopping distance under maximum braking:
  $$\text{brakingDistance} = \frac{v^2}{2 \cdot a_{\text{max}}} + 0.5 \cdot v$$
- `speed`: Current car velocity.

### B. Knowledge Base: Rules & Priority Hierarchy (`rules.js`)
When multiple rules evaluate to `true`, the engine resolves the conflict using **priority** (higher number wins):

| Rule | Priority | Action | Condition Summary | Rationale |
|:---:|:---:|:---:|---|---|
| **R6** | **100** | `STOP` | `pedestrianCrossing && crosswalkAhead` | **Safety First:** Human life overrides all traffic signals and clearing rules. |
| **R7** | **90** | `GO` | `carInIntersection` | **Anti-Gridlock:** Never stop inside the junction box; clear the intersection. |
| **R3** | **80** | `SLOW_DOWN`| `light === 'GREEN' && carAhead && dist < safeDistance` | **Following Distance:** Green light, but car ahead is too close. |
| **R10**| **70** | `GO` | `distToStopLine < 0 && !carClearedIntersection` | **Commitment:** Past the stop line; proceed rather than blocking the crossing. |
| **R1** | **60** | `STOP` | `light === 'RED' && distToStopLine >= 0` | Approaching stop line on Red. |
| **R4** | **60** | `STOP` | `light === 'YELLOW' && canStopSafely` | Yellow light with adequate distance to brake safely. |
| **R5** | **60** | `GO` | `light === 'YELLOW' && !canStopSafely` | Yellow light, but braking would cause hard skid past the line ("dilemma zone"). |
| **R2** | **50** | `GO` | `light === 'GREEN' && !carAhead` | Clear path on Green. |
| **R8** | **50** | `GO` | `light === 'GREEN' && carAhead && dist >= safeDistance` | Green light with safe buffer to the car ahead. |
| **R9** | **40** | `GO` | `carClearedIntersection` | Free driving along the exit road. |

If no rule matches, the system fails closed with a safe default: `STOP`.

### C. Forward Chaining Inference (`engine.js`)
1. Loops through all 10 rules.
2. Evaluates each rule's boolean condition function against `car.facts`.
3. Records all matched rule IDs.
4. Identifies the rule with the highest `priority` as the **Fired Rule**.
5. Returns `{ action, firedRuleId, matchedRuleIds, explanation }`.

### D. Explainability & "Why?" Dialog (`explain.js`)
Because every decision retains its input facts and the set of matched rules, clicking any car and pressing **"Why?"** displays:
- The rule that fired and its human-readable explanation.
- Other candidate rules that were considered and overridden by priority.
- The exact numerical facts (speed, distance to stop line, signal state) that triggered the rule.

---

## 4. Simulation Loop & Timing

The main loop in `js/main.js` decouples physics, inference, and rendering:

1. **Fixed Timestep Physics ($60\text{ Hz}$ / $\approx 16.6\text{ ms}$):**
   - Uses an accumulator pattern: `accumulator += delta * speed`.
   - Steps `trafficLight.update(1/60)` and `vehicles.updateFixed(1/60)`.
   - Clamps braking cars precisely at the stop line without numerical jitter or overshoot.
   - Enforces a minimum physical gap ($5.6\text{ m}$) between queued cars.
2. **Inference Clock ($10\text{ Hz}$ / $100\text{ ms}$):**
   - Runs every 6 fixed steps.
   - Re-evaluates rules for all 8 cars at $10\text{ Hz}$, mirroring realistic vehicle controller response times without wasting CPU cycles.
3. **Continuous Rendering (`requestAnimationFrame`):**
   - Updates pedestrian skeletal animation mixers (`Idle` and `Walk` clips).
   - Updates Three.js camera OrbitControls and draws the frame.
   - Throttles UI DOM updates to $5\text{ Hz}$ ($200\text{ ms}$) so DOM manipulation doesn't stall the GPU.

---

## 5. Environment & Scene Subsystems

- **Vehicle Pool (8 Cars):** Alternates between Kenney sedan and SUV models. When a car drives far past the intersection ($Z < -70$), it is recycled to the rear of the spawn queue ($Z \le 85$) with zero memory reallocation.
- **Pedestrian System (12 Characters):**
  - Quaternius animated characters wait on both curbs.
  - Can only step onto the zebra crossing when `light === 'RED'` **and** no car is physically straddling the crosswalk.
  - Once walking, a pedestrian **never turns back**, even if the signal flips to Green mid-crossing (real-world safety rule).
- **Traffic Signal FSM:**
  - `RED` (8s) $\to$ `GREEN` (8s) $\to$ `YELLOW` (2s) $\to$ `RED`.
  - Can be manually stepped at any time with the "Next light" button.

---

## 6. Verification and Testing

You can run the full automated verification suite at any time:
```powershell
npm test
```
All 31 tests run directly in Node's native test runner (`node:test`), verifying:
- Rule isolation for R1–R7, STOP/GO/SLOW_DOWN outcomes.
- Priority conflict resolutions (e.g., pedestrian safety over junction clearing).
- Dilemma zone handling for yellow lights (`canStopSafely`).
- Signal cycle state transitions and resets.
- Car following gaps and stop-line clamping.
- Pedestrian crosswalk entry gating and stagger timers.
