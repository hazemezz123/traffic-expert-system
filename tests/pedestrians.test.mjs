import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnterCrosswalk, createPedestrianMotion, stepPedestrian } from '../js/scene/pedestrian-motion.js';

const config = { walkSpeed: 1.4, curbX: 12.5, restMin: 2, restStep: 0.5 };

test('pedestrians enter only on red when the crosswalk is clear', () => {
  assert.equal(canEnterCrosswalk('RED', false), true);
  assert.equal(canEnterCrosswalk('RED', true), false);
  assert.equal(canEnterCrosswalk('GREEN', false), false);
  assert.equal(canEnterCrosswalk('YELLOW', false), false);
});

test('a waiting pedestrian starts crossing after its stagger delay', () => {
  const ped = createPedestrianMotion(1, 0.5);
  ped.x = 12.5;
  stepPedestrian(ped, 0.4, true, config);
  assert.equal(ped.phase, 'WAITING');
  stepPedestrian(ped, 0.2, true, config);
  assert.equal(ped.phase, 'CROSSING');
  assert.ok(ped.targetX < 0);
});

test('crossing moves toward the opposite curb and then rests', () => {
  const ped = createPedestrianMotion(2, 0);
  ped.x = 12.5;
  ped.phase = 'CROSSING';
  ped.targetX = -12.5;
  for (let i = 0; i < 2000 && ped.phase === 'CROSSING'; i += 1) {
    stepPedestrian(ped, 0.05, false, config);
  }
  assert.equal(ped.phase, 'RESTING');
  assert.equal(ped.x, -12.5);
  assert.ok(ped.waitTimer >= 2);
});

test('a pedestrian on the road does not turn back while the light is green', () => {
  const ped = createPedestrianMotion(3, 0);
  ped.x = 4;
  ped.phase = 'CROSSING';
  ped.targetX = -12.5;
  stepPedestrian(ped, 1, false, config);
  assert.equal(ped.phase, 'CROSSING');
  assert.ok(ped.x < 4);
});
