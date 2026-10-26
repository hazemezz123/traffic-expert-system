export function canEnterCrosswalk(light, carInCrosswalk) {
  return light === 'RED' && !carInCrosswalk;
}

export function createPedestrianMotion(id, entryDelay = 0, curbX = 7.2) {
  const side = id % 2 === 0 ? 1 : -1;
  return {
    id,
    x: side * curbX,
    z: 5.6 + ((id % 6) - 2.5) * 0.3,
    phase: 'WAITING',
    targetX: 0,
    entryTimer: entryDelay,
    waitTimer: 0,
    facing: side > 0 ? -1 : 1
  };
}

export function stepPedestrian(pedestrian, deltaSeconds, mayCross, config) {
  if (pedestrian.phase === 'CROSSING') {
    const direction = Math.sign(pedestrian.targetX - pedestrian.x);
    pedestrian.facing = direction;
    pedestrian.x += direction * config.walkSpeed * deltaSeconds;
    if ((direction > 0 && pedestrian.x >= pedestrian.targetX)
      || (direction < 0 && pedestrian.x <= pedestrian.targetX)) {
      pedestrian.x = pedestrian.targetX;
      pedestrian.phase = 'RESTING';
      pedestrian.waitTimer = config.restMin + (pedestrian.id % 4) * config.restStep;
    }
    return;
  }

  if (pedestrian.phase === 'RESTING') {
    pedestrian.waitTimer -= deltaSeconds;
    if (pedestrian.waitTimer <= 0) pedestrian.phase = 'WAITING';
    return;
  }

  pedestrian.entryTimer = Math.max(0, pedestrian.entryTimer - deltaSeconds);
  if (mayCross && pedestrian.entryTimer <= 0) {
    pedestrian.targetX = -Math.sign(pedestrian.x) * config.curbX;
    pedestrian.phase = 'CROSSING';
  }
}
