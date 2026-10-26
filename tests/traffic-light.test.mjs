import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalController } from '../js/scene/traffic-light-state.js';

test('signal follows red 8s, green 8s, yellow 2s, then red', () => {
  const signal = createSignalController();
  assert.deepEqual([signal.state, signal.remaining], ['RED', 8]);
  signal.update(8);
  assert.deepEqual([signal.state, signal.remaining], ['GREEN', 8]);
  signal.update(8);
  assert.deepEqual([signal.state, signal.remaining], ['YELLOW', 2]);
  signal.update(2);
  assert.deepEqual([signal.state, signal.remaining], ['RED', 8]);
});

test('large updates carry elapsed time across state boundaries', () => {
  const signal = createSignalController();
  signal.update(19);
  assert.equal(signal.state, 'RED');
  assert.equal(signal.remaining, 7);
});

test('manual advance moves to the next state with its full timer', () => {
  const signal = createSignalController();
  signal.update(3);
  signal.advance();
  assert.deepEqual([signal.state, signal.remaining], ['GREEN', 8]);
  signal.advance();
  assert.deepEqual([signal.state, signal.remaining], ['YELLOW', 2]);
});

test('reset restores red and the eight-second timer', () => {
  const signal = createSignalController();
  signal.update(12);
  signal.reset();
  assert.deepEqual([signal.state, signal.remaining], ['RED', 8]);
});
