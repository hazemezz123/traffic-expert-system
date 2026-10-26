const STATES = Object.freeze([
  Object.freeze({ name: 'RED', duration: 8 }),
  Object.freeze({ name: 'GREEN', duration: 8 }),
  Object.freeze({ name: 'YELLOW', duration: 2 })
]);

export function createSignalController() {
  let index = 0;
  let remaining = STATES[0].duration;

  function next() {
    index = (index + 1) % STATES.length;
    remaining = STATES[index].duration;
  }

  return {
    get state() { return STATES[index].name; },
    get remaining() { return remaining; },
    update(deltaSeconds) {
      let elapsed = Math.max(0, deltaSeconds);
      while (elapsed >= remaining) {
        elapsed -= remaining;
        next();
      }
      remaining -= elapsed;
    },
    advance: next,
    reset() {
      index = 0;
      remaining = STATES[0].duration;
    }
  };
}
