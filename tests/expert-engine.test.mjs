import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, RULES } from '../js/expert/rules.js';
import { createEngine } from '../js/expert/engine.js';
import { createDecisionLog, explainDecision } from '../js/expert/explain.js';
import { fillFacts } from '../js/expert/facts.js';

function facts(overrides = {}) {
  return {
    light: 'GREEN',
    distToStopLine: 12,
    carAhead: false,
    distToCarAhead: Infinity,
    safeDistance: 5,
    pedestrianWaiting: false,
    pedestrianCrossing: false,
    crosswalkAhead: true,
    carInIntersection: false,
    carClearedIntersection: false,
    canStopSafely: true,
    speed: 4,
    ...overrides
  };
}

const cases = [
  ['R1 stops an approaching car at red', { light: 'RED' }, ACTIONS.STOP, 'R1'],
  ['R2 sends an unobstructed car on green', {}, ACTIONS.GO, 'R2'],
  ['R3 slows for a close car on green', { carAhead: true, distToCarAhead: 3 }, ACTIONS.SLOW_DOWN, 'R3'],
  ['R4 stops on yellow when braking is safe', { light: 'YELLOW', canStopSafely: true }, ACTIONS.STOP, 'R4'],
  ['R5 proceeds on yellow when braking is unsafe', { light: 'YELLOW', canStopSafely: false }, ACTIONS.GO, 'R5'],
  ['R6 stops for a crossing pedestrian', { pedestrianCrossing: true }, ACTIONS.STOP, 'R6'],
  ['R7 clears a car already in the intersection', { light: 'RED', distToStopLine: -2, carInIntersection: true }, ACTIONS.GO, 'R7']
];

for (const [name, input, action, ruleId] of cases) {
  test(name, () => {
    const result = createEngine(RULES).evaluate(facts(input), 'en');
    assert.equal(result.action, action);
    assert.equal(result.firedRuleId, ruleId);
    assert.ok(result.matchedRuleIds.includes(ruleId));
    assert.ok(result.explanation.length > 10);
  });
}

test('pedestrian safety outranks clearing the intersection', () => {
  const result = createEngine(RULES).evaluate(facts({
    light: 'RED', distToStopLine: -2, carInIntersection: true, pedestrianCrossing: true
  }));
  assert.equal(result.firedRuleId, 'R6');
  assert.deepEqual(result.matchedRuleIds.slice().sort(), ['R10', 'R6', 'R7']);
});

test('clearing the intersection outranks a close car and green light', () => {
  const result = createEngine(RULES).evaluate(facts({
    distToStopLine: -2, carInIntersection: true, carAhead: true, distToCarAhead: 2
  }));
  assert.equal(result.firedRuleId, 'R7');
  assert.ok(result.matchedRuleIds.includes('R3'));
});

test('a crossing pedestrian does not stop a car that is already past the crosswalk', () => {
  const result = createEngine(RULES).evaluate(facts({
    pedestrianCrossing: true, crosswalkAhead: false, light: 'RED', distToStopLine: -18, carClearedIntersection: true
  }));
  assert.equal(result.firedRuleId, 'R9');
  assert.equal(result.action, ACTIONS.GO);
});

test('a green car follows at speed when the car ahead is safely distant', () => {
  const result = createEngine(RULES).evaluate(facts({ carAhead: true, distToCarAhead: 9 }));
  assert.equal(result.action, ACTIONS.GO);
  assert.equal(result.firedRuleId, 'R8');
});

test('a car that cleared the intersection keeps going on red', () => {
  const result = createEngine(RULES).evaluate(facts({
    light: 'RED', distToStopLine: -18, carClearedIntersection: true
  }));
  assert.equal(result.action, ACTIONS.GO);
  assert.equal(result.firedRuleId, 'R9');
});

test('the engine safely stops when no rule matches', () => {
  const result = createEngine([]).evaluate(facts());
  assert.equal(result.action, ACTIONS.STOP);
  assert.equal(result.firedRuleId, null);
  assert.deepEqual(result.matchedRuleIds, []);
});

test('a car exactly at the stop line remains stopped on red', () => {
  assert.equal(createEngine().evaluate(facts({ light: 'RED', distToStopLine: 0 })).action, 'STOP');
  const f = {};
  fillFacts(f, { z: 8, speed: 0, ahead: null }, {
    light: 'RED', stopLineZ: 8, intersectionExitZ: -10, maxBraking: 6, safeDistance: 5,
    pedestrianWaiting: false, pedestrianCrossing: false
  });
  assert.equal(createEngine().evaluate(f).action, 'STOP');
});

test('Arabic explanation uses the fired rule Arabic text', () => {
  const input = facts({ pedestrianCrossing: true });
  const result = createEngine(RULES).evaluate(input, 'ar');
  assert.equal(result.explanation, RULES.find((rule) => rule.id === 'R6').text_ar);
  assert.match(explainDecision(result, input, 'ar'), /R6/);
  assert.match(explainDecision(result, input, 'ar'), /مشاة/);
});

test('decision log caps at 50 newest records and copies fact snapshots', () => {
  const log = createDecisionLog(50);
  const input = facts();
  for (let timestamp = 0; timestamp < 52; timestamp += 1) {
    log.add(timestamp, input, { action: ACTIONS.GO, firedRuleId: 'R2', explanation: 'go' });
  }
  input.light = 'RED';
  assert.equal(log.entries.length, 50);
  assert.equal(log.entries[0].timestamp, 51);
  assert.equal(log.entries.at(-1).timestamp, 2);
  assert.equal(log.entries[0].facts.light, 'GREEN');
});

test('fillFacts derives stopping and occupancy facts into the provided object', () => {
  const target = {};
  const ahead = { z: 4 };
  const result = fillFacts(target, { z: 10, speed: 6, ahead }, {
    light: 'YELLOW',
    stopLineZ: 8,
    intersectionExitZ: -10,
    safeDistance: 5,
    maxBraking: 6,
    carHalfLength: 2.04,
    crosswalkEndZ: 6.4,
    pedestrianWaiting: true,
    pedestrianCrossing: false
  });
  assert.equal(result, target);
  assert.deepEqual(target, {
    light: 'YELLOW',
    distToStopLine: 2,
    carAhead: true,
    distToCarAhead: 6,
    safeDistance: 5,
    pedestrianWaiting: true,
    pedestrianCrossing: false,
    crosswalkAhead: true,
    carInIntersection: false,
    carClearedIntersection: false,
    canStopSafely: false,
    speed: 6
  });
});
