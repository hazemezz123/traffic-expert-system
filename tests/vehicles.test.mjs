import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../js/expert/rules.js';
import { advanceVehicle, assignCarsAhead } from '../js/scene/vehicle-motion.js';

const config = { maxSpeed: 8, slowSpeed: 2.5, acceleration: 3, maxBraking: 6, stopLineZ: 22, minGap: 3 };

test('GO accelerates a vehicle along the negative Z lane', () => {
  const car = { z: 35, speed: 0, state: 'STOPPED', ahead: null };
  advanceVehicle(car, ACTIONS.GO, 1, config);
  assert.equal(car.speed, 3);
  assert.equal(car.z, 32);
  assert.equal(car.state, 'MOVING');
});

test('STOP brakes and clamps an approaching vehicle at the stop line', () => {
  const car = { z: 23, speed: 4, state: 'MOVING', ahead: null };
  advanceVehicle(car, ACTIONS.STOP, 1, config);
  assert.equal(car.speed, 0);
  assert.equal(car.z, 22);
  assert.equal(car.state, 'STOPPED');
});

test('SLOW_DOWN reduces speed toward the configured slow speed', () => {
  const car = { z: 30, speed: 7, state: 'MOVING', ahead: null };
  advanceVehicle(car, ACTIONS.SLOW_DOWN, 0.5, config);
  assert.equal(car.speed, 4);
  assert.equal(car.state, 'SLOWING');
});

test('a physical gap prevents overlap with the car ahead', () => {
  const ahead = { z: 20, speed: 0, active: true };
  const car = { z: 23.5, speed: 4, state: 'MOVING', ahead };
  advanceVehicle(car, ACTIONS.GO, 1, config);
  assert.equal(car.z, 23);
  assert.equal(car.speed, 0);
});

test('assignCarsAhead selects the closest active car in the same lane', () => {
  const cars = [
    { z: 30, active: true },
    { z: 18, active: true },
    { z: 22, active: true },
    { z: 25, active: false }
  ];
  assignCarsAhead(cars);
  assert.equal(cars[0].ahead, cars[2]);
  assert.equal(cars[2].ahead, cars[1]);
  assert.equal(cars[1].ahead, null);
  assert.equal(cars[3].ahead, null);
});

test('a stopped car approaches a distant red stop line, then holds without crossing', () => {
  const car = { z: 40, speed: 0, state: 'STOPPED', ahead: null };
  for (let i = 0; i < 600; i += 1) advanceVehicle(car, ACTIONS.STOP, 1 / 60, config);
  assert.ok(car.z <= 22.05, `stopped too early at ${car.z}`);
  assert.ok(car.z >= 22);
  assert.equal(car.speed, 0);
});
