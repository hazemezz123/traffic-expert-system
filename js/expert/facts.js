export function fillFacts(target, car, simulation) {
  const distance = car.z - simulation.stopLineZ;
  const brakingDistance = (car.speed * car.speed) / (2 * simulation.maxBraking) + car.speed * 0.5;
  target.light = simulation.light;
  target.distToStopLine = distance;
  target.carAhead = Boolean(car.ahead);
  target.distToCarAhead = car.ahead ? car.z - car.ahead.z : Infinity;
  target.safeDistance = simulation.safeDistance;
  target.pedestrianWaiting = simulation.pedestrianWaiting;
  target.pedestrianCrossing = simulation.pedestrianCrossing;
  target.crosswalkAhead = car.z - simulation.carHalfLength > simulation.crosswalkEndZ;
  target.carInIntersection = distance < 0 && car.z >= simulation.intersectionExitZ;
  target.carClearedIntersection = car.z < simulation.intersectionExitZ;
  target.canStopSafely = distance >= brakingDistance;
  target.speed = car.speed;
  return target;
}
