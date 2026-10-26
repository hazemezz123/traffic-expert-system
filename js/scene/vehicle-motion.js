import { ACTIONS } from '../expert/rules.js';

export function assignCarsAhead(cars) {
  for (let index = 0; index < cars.length; index += 1) {
    const car = cars[index];
    car.ahead = null;
    if (!car.active) continue;
    let closestDistance = Infinity;
    for (let candidateIndex = 0; candidateIndex < cars.length; candidateIndex += 1) {
      const candidate = cars[candidateIndex];
      const distance = car.z - candidate.z;
      if (candidate !== car && candidate.active && distance > 0 && distance < closestDistance) {
        closestDistance = distance;
        car.ahead = candidate;
      }
    }
  }
}

export function advanceVehicle(car, action, deltaSeconds, config) {
  const previousSpeed = car.speed;
  let targetSpeed = 0;
  if (action === ACTIONS.GO) targetSpeed = config.maxSpeed;
  else if (action === ACTIONS.SLOW_DOWN) targetSpeed = config.slowSpeed;
  else if (action === ACTIONS.STOP && car.z >= config.stopLineZ) {
    const remaining = Math.max(0, car.z - config.stopLineZ - 0.015);
    targetSpeed = Math.min(config.maxSpeed, Math.sqrt(2 * config.maxBraking * remaining));
  }

  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + config.acceleration * deltaSeconds);
  else if (car.speed > targetSpeed) car.speed = Math.max(targetSpeed, car.speed - config.maxBraking * deltaSeconds);

  let nextZ = car.z - car.speed * deltaSeconds;
  if (action === ACTIONS.STOP && car.z >= config.stopLineZ
    && car.z - Math.max(previousSpeed, car.speed) * deltaSeconds <= config.stopLineZ) {
    nextZ = config.stopLineZ;
    car.speed = 0;
  }
  if (car.ahead && nextZ < car.ahead.z + config.minGap) {
    nextZ = car.ahead.z + config.minGap;
    car.speed = Math.min(car.speed, car.ahead.speed);
  }
  car.z = nextZ;
  car.state = car.speed < 0.05 ? 'STOPPED' : action === ACTIONS.SLOW_DOWN || action === ACTIONS.STOP ? 'SLOWING' : 'MOVING';
}
