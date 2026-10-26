import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function staticMesh(geometry, material, position, rotation = [-Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

function createFallbackIntersection() {
  const group = new THREE.Group();
  group.name = 'procedural-intersection';
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.96 });
  const pavement = new THREE.MeshStandardMaterial({ color: 0xaab0aa, roughness: 1 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xf4f0d9, roughness: 0.82 });

  group.add(staticMesh(new THREE.PlaneGeometry(16, 80), asphalt, [0, 0.025, 0]));
  group.add(staticMesh(new THREE.PlaneGeometry(80, 16), asphalt, [0, 0.03, 0]));

  for (const x of [-10, 10]) group.add(staticMesh(new THREE.PlaneGeometry(4, 80), pavement, [x, 0.04, 0]));
  for (const z of [-10, 10]) group.add(staticMesh(new THREE.PlaneGeometry(80, 4), pavement, [0, 0.045, z]));

  for (let x = -7; x <= 7; x += 2) {
    group.add(staticMesh(new THREE.PlaneGeometry(1.15, 4.2), paint, [x, 0.075, 8.1]));
  }

  const lineGeometry = new THREE.PlaneGeometry(0.12, 25);
  for (const z of [-26, 26]) group.add(staticMesh(lineGeometry, paint, [0, 0.065, z]));
  return group;
}

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc8d4);
  scene.fog = new THREE.Fog(0x9cc8d4, 70, 150);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 240);
  camera.position.set(34, 36, 54);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 2);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 18;
  controls.maxDistance = 75;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xdff5ff, 0x506046, 2.15));
  const sun = new THREE.DirectionalLight(0xfff1cf, 3.2);
  sun.position.set(20, 34, 17);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 75;
  sun.shadow.bias = -0.0007;
  scene.add(sun);

  const ground = staticMesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x76905d, roughness: 1 }),
    [0, -0.03, 0]
  );
  ground.name = 'ground';
  scene.add(ground);

  const fallback = createFallbackIntersection();
  scene.add(fallback);
  const environmentRoot = new THREE.Group();
  environmentRoot.name = 'asset-environment';
  scene.add(environmentRoot);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function installEnvironment(assets) {
    if (!assets?.environment) return;
    environmentRoot.clear();
    environmentRoot.add(assets.environment);
    fallback.visible = false;
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    controls.dispose();
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    renderer.dispose();
  }

  resize();
  return { scene, camera, renderer, controls, resize, render, installEnvironment, dispose };
}
