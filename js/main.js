import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { loadAssets, ROAD_SURFACE_Y, SIDEWALK_Y } from './scene/assets.js';
import { createTrafficLight } from './scene/traffic-light.js';
import { createVehicleSystem } from './scene/vehicles.js';
import { createPedestrianSystem } from './scene/pedestrians.js';
import { createEngine } from './expert/engine.js';
import { RULES } from './expert/rules.js';
import { createDecisionLog } from './expert/explain.js';
import { createPanel } from './ui/panel.js';
import { createControls } from './ui/controls.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const loadingText = document.querySelector('#loading-text');
const world = createWorld(canvas);
const engine = createEngine(RULES);
const decisionLog = createDecisionLog(50);
const panel = createPanel(document, RULES);
const simulation = {
  running: true,
  speed: 1,
  language: 'en',
  selectedIndex: 0,
  pedestrianWaiting: false,
  pedestrianCrossing: false,
  carInCrosswalk: false,
  timestamp: 0
};

let assets = null;
let trafficLight = null;
let vehicles = null;
let pedestrians = null;
let selectionRing = null;
let panelTimer = 0;
let statsVisible = false;
let statsTimer = 0;
let statsFrames = 0;
let previousTime = performance.now();
let accumulator = 0;
let inferenceAccumulator = 0;
const FIXED_STEP = 1 / 60;
const INFERENCE_STEP = 0.1;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;

function snapshot() {
  const car = vehicles?.vehicles[simulation.selectedIndex] ?? null;
  return {
    light: trafficLight?.state ?? 'RED',
    remaining: trafficLight?.remaining ?? 8,
    selectedCar: car ? { id: car.id, facts: car.facts, result: car.result, state: car.state } : null,
    log: decisionLog.entries,
    language: simulation.language
  };
}

function renderPanel() {
  panel.render(snapshot());
}

function syncSelectionRing() {
  if (!selectionRing || !vehicles) return;
  const car = vehicles.vehicles[simulation.selectedIndex];
  selectionRing.position.set(vehicles.config.laneX, ROAD_SURFACE_Y + 0.02, car.z);
  selectionRing.updateMatrix();
}

function frame(now = performance.now()) {
  const frameDelta = Math.min((now - previousTime) / 1000, 0.25);
  previousTime = now;

  if (trafficLight && vehicles && simulation.running) {
    accumulator = Math.min(accumulator + frameDelta * simulation.speed, 0.2);
    while (accumulator >= FIXED_STEP) {
      trafficLight.update(FIXED_STEP);
      vehicles.updateFixed(FIXED_STEP);
      if (pedestrians) {
        pedestrians.updateFixed(FIXED_STEP, {
          light: trafficLight.state,
          carInCrosswalk: vehicles.carInCrosswalk()
        });
        simulation.pedestrianCrossing = pedestrians.crossing;
        simulation.pedestrianWaiting = pedestrians.waiting;
      }
      simulation.carInCrosswalk = vehicles.carInCrosswalk();
      inferenceAccumulator += FIXED_STEP;
      simulation.timestamp += FIXED_STEP;
      if (inferenceAccumulator >= INFERENCE_STEP) {
        inferenceAccumulator -= INFERENCE_STEP;
        vehicles.decide({
          ...simulation,
          light: trafficLight.state,
          timestamp: simulation.timestamp
        });
      }
      accumulator -= FIXED_STEP;
    }
  }

  if (pedestrians) {
    pedestrians.updateAnimations(simulation.running ? frameDelta * simulation.speed : 0);
  }
  syncSelectionRing();
  world.render();

  panelTimer += frameDelta;
  if (panelTimer >= 0.2) {
    panelTimer = 0;
    renderPanel();
  }

  if (statsVisible) {
    statsFrames += 1;
    statsTimer += frameDelta;
    if (statsTimer >= 0.5) {
      controls.updateStats(statsFrames / statsTimer, world.renderer.info.render.calls);
      statsFrames = 0;
      statsTimer = 0;
    }
  }

  requestAnimationFrame(frame);
}

function resetSimulation() {
  trafficLight?.reset();
  vehicles?.reset();
  pedestrians?.reset();
  decisionLog.clear();
  simulation.timestamp = 0;
  simulation.selectedIndex = 0;
  simulation.pedestrianWaiting = false;
  simulation.pedestrianCrossing = false;
  simulation.carInCrosswalk = false;
  accumulator = 0;
  inferenceAccumulator = 0;
  if (vehicles) {
    vehicles.decide({ ...simulation, light: trafficLight.state, timestamp: 0 });
    if (pedestrians) {
      pedestrians.updateFixed(FIXED_STEP, { light: trafficLight.state, carInCrosswalk: false });
      simulation.pedestrianCrossing = pedestrians.crossing;
      simulation.pedestrianWaiting = pedestrians.waiting;
    }
  }
  syncSelectionRing();
  renderPanel();
}

const controls = createControls(document, {
  onRunning(nextRunning) {
    simulation.running = nextRunning;
  },
  onReset() {
    resetSimulation();
  },
  onNextLight() {
    trafficLight?.advance();
    renderPanel();
  },
  onSpeed(value) {
    simulation.speed = value;
  },
  onLanguage(language) {
    simulation.language = language;
    panel.setLanguage(language);
    if (vehicles && trafficLight) {
      vehicles.decide({ ...simulation, light: trafficLight.state, timestamp: simulation.timestamp });
    }
    renderPanel();
  },
  onStats(visible) {
    statsVisible = visible;
    statsFrames = 0;
    statsTimer = 0;
  }
});

function selectFromPointer(event) {
  if (!vehicles) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, world.camera);
  const hit = raycaster.intersectObjects(vehicles.raycastTargets, false)[0];
  if (!hit) return;
  simulation.selectedIndex = hit.object.userData.vehicleIndex;
  syncSelectionRing();
  renderPanel();
}

canvas.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved < 6) selectFromPointer(event);
});

window.addEventListener('resize', world.resize, { passive: true });
window.addEventListener('pagehide', () => {
  assets?.dispose();
  world.dispose();
}, { once: true });

frame();

try {
  assets = await loadAssets((progress) => {
    loadingText.textContent = `Loading models… ${Math.round(progress * 100)}%`;
  });
  world.installEnvironment(assets);

  trafficLight = createTrafficLight(assets.cloneSharedModel('trafficLight'));
  trafficLight.group.position.set(7.2, SIDEWALK_Y, 11.8);
  world.scene.add(trafficLight.group);

  vehicles = createVehicleSystem(assets, world.scene, engine, decisionLog);
  pedestrians = createPedestrianSystem(assets, world.scene, world.camera);

  selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.7, 32),
    new THREE.MeshBasicMaterial({ color: 0x49d8a3, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.matrixAutoUpdate = false;
  world.scene.add(selectionRing);

  vehicles.decide({ ...simulation, light: trafficLight.state, timestamp: 0 });
  pedestrians.updateFixed(FIXED_STEP, { light: trafficLight.state, carInCrosswalk: false });
  simulation.pedestrianCrossing = pedestrians.crossing;
  simulation.pedestrianWaiting = pedestrians.waiting;
  syncSelectionRing();
  panel.setLanguage(simulation.language);
  renderPanel();
  loading.hidden = true;
} catch (error) {
  loadingText.textContent = error.message;
  loading.dataset.error = 'true';
  console.error(error);
}
