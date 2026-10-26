export const ACTIONS = Object.freeze({
  STOP: 'STOP',
  GO: 'GO',
  SLOW_DOWN: 'SLOW_DOWN'
});

export const RULES = Object.freeze([
  {
    id: 'R6', priority: 100, action: ACTIONS.STOP,
    condition: (facts) => facts.pedestrianCrossing && facts.crosswalkAhead,
    text_en: 'A pedestrian is crossing ahead, so the car must stop before the crosswalk.',
    text_ar: 'يوجد مشاة يعبرون أمام السيارة، لذلك يجب أن تتوقف قبل معبر المشاة.'
  },
  {
    id: 'R7', priority: 90, action: ACTIONS.GO,
    condition: (facts) => facts.carInIntersection,
    text_en: 'The car is already inside the intersection, so it must continue and clear the junction.',
    text_ar: 'السيارة داخل التقاطع بالفعل، لذلك يجب أن تتابع لإخلاء التقاطع.'
  },
  {
    id: 'R10', priority: 70, action: ACTIONS.GO,
    condition: (facts) => facts.distToStopLine < 0 && !facts.carClearedIntersection,
    text_en: 'The car has already passed the stop line, so it continues through the crossing instead of blocking it.',
    text_ar: 'السيارة تجاوزت خط التوقف بالفعل، لذلك تتابع عبر المعبر بدلاً من إعاقته.'
  },
  {
    id: 'R3', priority: 80, action: ACTIONS.SLOW_DOWN,
    condition: (facts) => facts.light === 'GREEN' && facts.carAhead && facts.distToCarAhead < facts.safeDistance,
    text_en: 'The light is green, but the car ahead is inside the safe distance, so slow down.',
    text_ar: 'الإشارة خضراء، لكن السيارة الأمامية أقرب من مسافة الأمان، لذلك خفّف السرعة.'
  },
  {
    id: 'R1', priority: 60, action: ACTIONS.STOP,
    condition: (facts) => facts.light === 'RED' && facts.distToStopLine >= 0,
    text_en: 'The light is red and the car is approaching the stop line, so stop.',
    text_ar: 'الإشارة حمراء والسيارة تقترب من خط التوقف، لذلك يجب أن تتوقف.'
  },
  {
    id: 'R4', priority: 60, action: ACTIONS.STOP,
    condition: (facts) => facts.light === 'YELLOW' && facts.distToStopLine >= 0 && facts.canStopSafely,
    text_en: 'The light is yellow and there is enough braking distance, so stop safely.',
    text_ar: 'الإشارة صفراء وتوجد مسافة كافية للكبح، لذلك توقّف بأمان.'
  },
  {
    id: 'R5', priority: 60, action: ACTIONS.GO,
    condition: (facts) => facts.light === 'YELLOW' && facts.distToStopLine >= 0 && !facts.canStopSafely,
    text_en: 'The light is yellow but safe stopping is no longer possible, so continue.',
    text_ar: 'الإشارة صفراء لكن التوقف الآمن لم يعد ممكناً، لذلك تابع السير.'
  },
  {
    id: 'R2', priority: 50, action: ACTIONS.GO,
    condition: (facts) => facts.light === 'GREEN' && !facts.carAhead,
    text_en: 'The light is green and there is no car ahead, so go.',
    text_ar: 'الإشارة خضراء ولا توجد سيارة أمامك، لذلك تابع السير.'
  },
  {
    id: 'R8', priority: 50, action: ACTIONS.GO,
    condition: (facts) => facts.light === 'GREEN' && facts.carAhead && facts.distToCarAhead >= facts.safeDistance,
    text_en: 'The light is green and the car ahead is beyond the safe distance, so go.',
    text_ar: 'الإشارة خضراء والسيارة الأمامية أبعد من مسافة الأمان، لذلك تابع السير.'
  },
  {
    id: 'R9', priority: 40, action: ACTIONS.GO,
    condition: (facts) => facts.carClearedIntersection,
    text_en: 'The car has cleared the intersection, so it continues along the exit lane.',
    text_ar: 'غادرت السيارة التقاطع، لذلك تتابع في مسار الخروج.'
  }
]);
