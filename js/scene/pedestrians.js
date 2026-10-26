import * as THREE from 'three';
import { ROAD_SURFACE_Y } from './assets.js';
import { canEnterCrosswalk, createPedestrianMotion, stepPedestrian } from './pedestrian-motion.js';

const COUNT = 12;
const CONFIG = Object.freeze({
  walkSpeed: 1.4,
  curbX: 7.2,
  restMin: 2.5,
  restStep: 0.6
});

export function createPedestrianSystem(asset, scene, camera) {
  const root = new THREE.Group();
  root.name = 'pedestrian-pool';
  scene.add(root);
  const pedestrians = [];
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 2.4);

  for (let index = 0; index < COUNT; index += 1) {
    const clone = asset.cloneCharacter();
    const group = clone.scene;
    group.name = `Pedestrian ${index + 1}`;
    group.scale.setScalar(0.55);
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = true;
    });
    root.add(group);

    const mixer = new THREE.AnimationMixer(group);
    const idleClip = THREE.AnimationClip.findByName(clone.animations, 'Idle');
    const walkClip = THREE.AnimationClip.findByName(clone.animations, 'Walk');
    if (!idleClip || !walkClip) throw new Error('Character is missing Idle or Walk clips');
    const idle = mixer.clipAction(idleClip);
    const walk = mixer.clipAction(walkClip);
    idle.play();
    walk.play();
    walk.setEffectiveWeight(0);
    mixer.setTime(index * 0.37);

    const motion = createPedestrianMotion(index + 1, (index % 6) * 0.45);
    pedestrians.push({ ...motion, group, mixer, idle, walk, walkWeight: 0, visible: true });
  }

  function applyTransforms() {
    for (const pedestrian of pedestrians) {
      pedestrian.group.position.set(pedestrian.x, ROAD_SURFACE_Y + 0.01, pedestrian.z);
      pedestrian.group.rotation.y = pedestrian.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      pedestrian.group.updateMatrixWorld();
    }
  }

  function updateFixed(deltaSeconds, context) {
    const mayCross = canEnterCrosswalk(context.light, context.carInCrosswalk);
    for (const pedestrian of pedestrians) {
      const before = pedestrian.phase;
      stepPedestrian(pedestrian, deltaSeconds, mayCross, CONFIG);
      if (before !== pedestrian.phase) {
        pedestrian.group.position.x = pedestrian.x;
        pedestrian.group.rotation.y = pedestrian.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    applyTransforms();
  }

  function updateAnimations(deltaSeconds) {
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    for (const pedestrian of pedestrians) {
      sphere.center.copy(pedestrian.group.position);
      pedestrian.visible = frustum.intersectsSphere(sphere);
      if (!pedestrian.visible) continue;
      const targetWeight = pedestrian.phase === 'CROSSING' ? 1 : 0;
      pedestrian.walkWeight += (targetWeight - pedestrian.walkWeight) * Math.min(1, deltaSeconds * 9);
      pedestrian.walk.setEffectiveWeight(pedestrian.walkWeight);
      pedestrian.idle.setEffectiveWeight(1 - pedestrian.walkWeight);
      pedestrian.mixer.update(deltaSeconds);
    }
  }

  function reset() {
    for (const pedestrian of pedestrians) {
      const fresh = createPedestrianMotion(pedestrian.id, (pedestrian.id % 6) * 0.45);
      Object.assign(pedestrian, fresh);
      pedestrian.walkWeight = 0;
      pedestrian.walk.setEffectiveWeight(0);
      pedestrian.idle.setEffectiveWeight(1);
    }
    applyTransforms();
  }

  applyTransforms();
  return {
    pedestrians,
    updateFixed,
    updateAnimations,
    reset,
    get crossing() { return pedestrians.some((pedestrian) => pedestrian.phase === 'CROSSING'); },
    get waiting() { return pedestrians.some((pedestrian) => pedestrian.phase === 'WAITING' || pedestrian.phase === 'RESTING'); }
  };
}
