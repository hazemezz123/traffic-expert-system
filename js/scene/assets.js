import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ROAD_SURFACE_Y = 0.22;
export const SIDEWALK_Y = 0.32;

const URLS = Object.freeze({
  crossroad: new URL('../../assets/models/roads/road-crossroad-path.glb', import.meta.url).href,
  straight: new URL('../../assets/models/roads/road-straight.glb', import.meta.url).href,
  trafficLight: new URL('../../assets/models/props/traffic-light.glb', import.meta.url).href,
  lamp: new URL('../../assets/models/props/light-curved.glb', import.meta.url).href,
  cone: new URL('../../assets/models/props/construction-cone.glb', import.meta.url).href,
  sedan: new URL('../../assets/models/cars/sedan.glb', import.meta.url).href,
  suv: new URL('../../assets/models/cars/suv.glb', import.meta.url).href,
  character: new URL('../../assets/models/characters/casual.glb', import.meta.url).href
});

const cache = new Map();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

function loadModelOnce(url) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).catch((error) => {
      cache.delete(url);
      throw new Error(`Could not load ${url.split('/').pop()}: ${error.message}`);
    }));
  }
  return cache.get(url);
}

function freezeStatic(root) {
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.updateMatrix();
    if (object.isMesh) {
      object.receiveShadow = true;
      object.castShadow = false;
    }
  });
  return root;
}

function roadTile(source, x, z, rotationY = 0) {
  const tile = source.clone(true);
  tile.position.set(x, 0, z);
  tile.rotation.y = rotationY;
  tile.scale.setScalar(16);
  tile.updateMatrixWorld(true);
  return freezeStatic(tile);
}

function firstMesh(root) {
  let mesh = null;
  root.traverse((object) => { if (!mesh && object.isMesh) mesh = object; });
  if (!mesh) throw new Error(`Model ${root.name || '(unnamed)'} contains no mesh`);
  return mesh;
}

function instancedProps(source, placements, scale) {
  const mesh = firstMesh(source);
  const instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const size = new THREE.Vector3(scale, scale, scale);
  const euler = new THREE.Euler();
  placements.forEach(([x, y, z, angle], index) => {
    position.set(x, y, z);
    rotation.setFromEuler(euler.set(0, angle, 0));
    matrix.compose(position, rotation, size);
    instances.setMatrixAt(index, matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.matrixAutoUpdate = false;
  instances.updateMatrix();
  instances.receiveShadow = true;
  return instances;
}

function instancedRoads(source, placements) {
  const mesh = firstMesh(source);
  const instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(16, 16, 16);
  const euler = new THREE.Euler();
  placements.forEach(([x, z, angle], index) => {
    position.set(x, 0, z);
    rotation.setFromEuler(euler.set(0, angle, 0));
    matrix.compose(position, rotation, scale);
    instances.setMatrixAt(index, matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.matrixAutoUpdate = false;
  instances.updateMatrix();
  instances.receiveShadow = true;
  return instances;
}

function createEnvironment(models) {
  const environment = new THREE.Group();
  environment.name = 'kenney-environment';
  environment.add(roadTile(models.crossroad.scene, 0, 0));

  // The straight tile runs along +X; rotate the north-south arms into place.
  const straights = [];
  for (const z of [-80, -64, -48, -32, -16, 16, 32, 48, 64, 80]) straights.push([0, z, Math.PI / 2]);
  for (const x of [-80, -64, -48, -32, -16, 16, 32, 48, 64, 80]) straights.push([x, 0, 0]);
  environment.add(instancedRoads(models.straight.scene, straights));

  const stopBar = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xf4f0dd, roughness: 0.9 })
  );
  stopBar.rotation.x = -Math.PI / 2;
  stopBar.position.set(3.4, ROAD_SURFACE_Y + 0.012, 8.46);
  stopBar.receiveShadow = true;
  environment.add(stopBar);

  environment.add(instancedProps(models.lamp.scene, [
    [-11, 0, -18, 0], [11, 0, -18, Math.PI], [-11, 0, 18, 0], [11, 0, 18, Math.PI],
    [-24, 0, -11, Math.PI / 2], [24, 0, 11, -Math.PI / 2]
  ], 10));
  environment.add(instancedProps(models.cone.scene, [
    [-8.8, 0, 12, 0], [-8.8, 0, 14, 0], [-8.8, 0, 16, 0], [-8.8, 0, 18, 0]
  ], 5));
  return freezeStatic(environment);
}

export async function loadAssets(onProgress = () => {}) {
  const entries = Object.entries(URLS);
  let completed = 0;
  const loaded = await Promise.all(entries.map(async ([key, url]) => {
    const gltf = await loadModelOnce(url);
    completed += 1;
    onProgress(completed / entries.length, key);
    return [key, gltf];
  }));
  const models = Object.fromEntries(loaded);

  return {
    models,
    environment: createEnvironment(models),
    cloneSharedModel(key) {
      const model = models[key];
      if (!model) throw new Error(`Unknown model key: ${key}`);
      return model.scene.clone(true);
    },
    cloneCharacter() {
      return { scene: SkeletonUtils.clone(models.character.scene), animations: models.character.animations };
    },
    dispose() {
      draco.dispose();
    }
  };
}
