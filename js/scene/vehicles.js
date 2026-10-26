import * as THREE from 'three';
import { fillFacts } from '../expert/facts.js';
import { ACTIONS } from '../expert/rules.js';
import { ROAD_SURFACE_Y } from './assets.js';
import { advanceVehicle, assignCarsAhead } from './vehicle-motion.js';

const CONFIG = Object.freeze({
  maxSpeed: 9,
  slowSpeed: 3,
  acceleration: 3.5,
  maxBraking: 6,
  stopLineZ: 10.5,
  carHalfLength: 2.04,
  crosswalkStartZ: 4.8,
  crosswalkEndZ: 6.4,
  intersectionExitZ: -10.1,
  safeDistance: 7,
  minGap: 5.6,
  firstSpawnZ: 10.5,
  spawnSpacing: 7.5,
  maxSpawnZ: 85,
  recycleZ: -70,
  laneX: 3.4
});

function copyResult(target, source) {
  target.action = source.action;
  target.firedRuleId = source.firedRuleId;
  target.explanation = source.explanation;
  target.matchedRuleIds.length = source.matchedRuleIds.length;
  for (let index = 0; index < source.matchedRuleIds.length; index += 1) {
    target.matchedRuleIds[index] = source.matchedRuleIds[index];
  }
}

export function createVehicleSystem(assets, scene, engine, decisionLog) {
  const root = new THREE.Group();
  root.name = 'vehicle-pool';
  scene.add(root);
  const vehicles = [];
  const raycastTargets = [];

  for (let index = 0; index < 8; index += 1) {
    const group = assets.cloneSharedModel(index % 2 === 0 ? 'sedan' : 'suv');
    group.name = `Car ${index + 1}`;
    group.scale.setScalar(1.6);
    group.rotation.y = Math.PI;
    group.position.set(CONFIG.laneX, ROAD_SURFACE_Y, 0);
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.vehicleIndex = index;
      object.castShadow = index < 2;
      object.receiveShadow = true;
      raycastTargets.push(object);
    });
    root.add(group);
    vehicles.push({
      id: index + 1,
      group,
      active: true,
      z: CONFIG.firstSpawnZ + index * CONFIG.spawnSpacing,
      speed: 0,
      state: 'STOPPED',
      ahead: null,
      action: ACTIONS.STOP,
      facts: {},
      result: { action: ACTIONS.STOP, firedRuleId: null, matchedRuleIds: [], explanation: '' }
    });
  }

  function reset() {
    for (let index = 0; index < vehicles.length; index += 1) {
      const car = vehicles[index];
      car.active = true;
      car.z = CONFIG.firstSpawnZ + index * CONFIG.spawnSpacing;
      car.speed = 0;
      car.state = 'STOPPED';
      car.ahead = null;
      car.action = ACTIONS.STOP;
      car.facts = {};
      car.group.visible = true;
      car.group.position.set(CONFIG.laneX, ROAD_SURFACE_Y, car.z);
      car.group.updateMatrixWorld();
    }
    assignCarsAhead(vehicles);
  }

  function decide(context) {
    assignCarsAhead(vehicles);
    for (const car of vehicles) {
      fillFacts(car.facts, car, {
        light: context.light,
        stopLineZ: CONFIG.stopLineZ,
        intersectionExitZ: CONFIG.intersectionExitZ,
        safeDistance: CONFIG.safeDistance,
        maxBraking: CONFIG.maxBraking,
        carHalfLength: CONFIG.carHalfLength,
        crosswalkEndZ: CONFIG.crosswalkEndZ,
        pedestrianWaiting: context.pedestrianWaiting,
        pedestrianCrossing: context.pedestrianCrossing
      });
      const result = engine.evaluate(car.facts, context.language);
      car.action = result.action;
      copyResult(car.result, result);
    }
    const selected = vehicles[context.selectedIndex] ?? vehicles[0];
    decisionLog.add(context.timestamp, selected.facts, selected.result);
  }

  function updateFixed(deltaSeconds) {
    assignCarsAhead(vehicles);
    for (const car of vehicles) {
      advanceVehicle(car, car.action, deltaSeconds, CONFIG);
      if (car.z < CONFIG.recycleZ) {
        const backmost = vehicles.reduce((largest, candidate) => (
          candidate === car ? largest : Math.max(largest, candidate.z)
        ), CONFIG.firstSpawnZ);
        car.z = Math.min(CONFIG.maxSpawnZ, backmost + CONFIG.spawnSpacing);
        car.speed = 0;
        car.action = ACTIONS.STOP;
      }
      car.group.position.z = car.z;
      car.group.updateMatrixWorld();
    }
  }

  function carInCrosswalk() {
    return vehicles.some((car) => (
      car.z + CONFIG.carHalfLength > CONFIG.crosswalkStartZ
      && car.z - CONFIG.carHalfLength < CONFIG.crosswalkEndZ
    ));
  }

  reset();
  return { vehicles, raycastTargets, decide, updateFixed, reset, carInCrosswalk, config: CONFIG };
}
