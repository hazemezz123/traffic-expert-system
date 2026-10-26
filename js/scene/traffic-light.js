import * as THREE from 'three';
import { createSignalController } from './traffic-light-state.js';

const COLORS = Object.freeze({ RED: 0xff2d3f, YELLOW: 0xffc928, GREEN: 0x31e981 });

export function createTrafficLight(model) {
  const controller = createSignalController();
  const group = new THREE.Group();
  group.name = 'traffic-signal';

  model.scale.setScalar(12);
  model.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.updateMatrix();
    if (object.isMesh) object.receiveShadow = true;
  });
  group.add(model);

  const bulbs = {};
  const geometry = new THREE.SphereGeometry(0.19, 12, 8);
  for (const [state, y] of [['RED', 5.8], ['YELLOW', 5.35], ['GREEN', 4.9]]) {
    const material = new THREE.MeshStandardMaterial({
      color: 0x151515,
      emissive: COLORS[state],
      emissiveIntensity: 0,
      roughness: 0.35,
      toneMapped: false
    });
    const bulb = new THREE.Mesh(geometry, material);
    bulb.position.set(0, y, 0.53);
    bulb.matrixAutoUpdate = false;
    bulb.updateMatrix();
    bulbs[state] = bulb;
    group.add(bulb);
  }

  let visibleState = '';
  function syncVisuals() {
    if (visibleState === controller.state) return;
    visibleState = controller.state;
    for (const state of Object.keys(bulbs)) bulbs[state].material.emissiveIntensity = state === visibleState ? 2.6 : 0;
  }
  syncVisuals();

  return {
    group,
    get state() { return controller.state; },
    get remaining() { return controller.remaining; },
    update(deltaSeconds) {
      controller.update(deltaSeconds);
      syncVisuals();
    },
    advance() {
      controller.advance();
      syncVisuals();
    },
    reset() {
      controller.reset();
      syncVisuals();
    }
  };
}
