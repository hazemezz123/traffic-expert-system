const STRINGS = {
  en: {
    pause: 'Pause',
    start: 'Start',
    reset: 'Reset',
    nextLight: 'Next light',
    speed: 'Speed',
    stats: 'Stats',
    language: 'العربية',
    eyebrow: 'Rule-based AI',
    title: 'Traffic Expert System',
    light: 'Light',
    timer: 'Timer',
    car: 'Car',
    selectCar: 'Select a car',
    facts: 'Live facts',
    why: 'Why?',
    rules: 'Rules',
    log: 'Recent decisions',
    collapse: 'Collapse expert panel',
    expand: 'Expand expert panel',
    yes: 'Yes',
    no: 'No',
    none: '—',
    distToStopLine: 'Distance to stop line',
    carAhead: 'Car ahead',
    distToCarAhead: 'Distance to car ahead',
    safeDistance: 'Safe distance',
    pedWaiting: 'Pedestrian waiting',
    pedCrossing: 'Pedestrian crossing',
    crosswalkAhead: 'Crosswalk ahead',
    carInIntersection: 'Car in intersection',
    carCleared: 'Car cleared intersection',
    canStopSafely: 'Can stop safely',
    speedFacts: 'Speed',
    carState: 'Car state',
    decision: 'Decision',
    whyTitle: 'Why this decision?',
    firedRule: 'Fired rule',
    matchedRules: 'Matched rules',
    factsUsed: 'Facts used',
    priority: 'Priority',
    noSelection: 'Select a car to inspect its expert decision.',
    noDecisions: 'No decisions recorded yet.',
    close: 'Close explanation',
    actions: { STOP: 'STOP', GO: 'GO', SLOW_DOWN: 'SLOW_DOWN' },
    phases: { MOVING: 'MOVING', SLOWING: 'SLOWING', STOPPED: 'STOPPED' }
  },
  ar: {
    pause: 'إيقاف مؤقت',
    start: 'تشغيل',
    reset: 'إعادة ضبط',
    nextLight: 'تغيير الإشارة',
    speed: 'السرعة',
    stats: 'الإحصاءات',
    language: 'English',
    eyebrow: 'نظام خبير قائم على القواعد',
    title: 'نظام خبير المرور',
    light: 'الإشارة',
    timer: 'المؤقت',
    car: 'السيارة',
    selectCar: 'اختر سيارة',
    facts: 'الحقائق المباشرة',
    why: 'لماذا؟',
    rules: 'القواعد',
    log: 'أحدث القرارات',
    collapse: 'طي لوحة النظام الخبير',
    expand: 'توسيع لوحة النظام الخبير',
    yes: 'نعم',
    no: 'لا',
    none: '—',
    distToStopLine: 'المسافة إلى خط التوقف',
    carAhead: 'توجد سيارة أمامك',
    distToCarAhead: 'المسافة إلى السيارة الأمامية',
    safeDistance: 'مسافة الأمان',
    pedWaiting: 'مشاة ينتظرون',
    pedCrossing: 'مشاة يعبرون',
    crosswalkAhead: 'معبر المشاة أمام السيارة',
    carInIntersection: 'السيارة داخل التقاطع',
    carCleared: 'السيارة تجاوزت التقاطع',
    canStopSafely: 'يمكن التوقف بأمان',
    speedFacts: 'السرعة',
    carState: 'حالة السيارة',
    decision: 'القرار',
    whyTitle: 'لماذا هذا القرار؟',
    firedRule: 'القاعدة المطبقة',
    matchedRules: 'القواعد المطابقة',
    factsUsed: 'الحقائق المستخدمة',
    priority: 'الأولوية',
    noSelection: 'اختر سيارة لعرض قرار النظام الخبير.',
    noDecisions: 'لم تُسجّل أي قرارات بعد.',
    close: 'إغلاق الشرح',
    actions: { STOP: 'توقف', GO: 'سِر', SLOW_DOWN: 'خفّف' },
    phases: { MOVING: 'متحركة', SLOWING: 'تبطئ', STOPPED: 'متوقفة' }
  }
};

const FACT_ROWS = [
  ['light', 'light'],
  ['distToStopLine', 'distToStopLine'],
  ['carAhead', 'carAhead'],
  ['distToCarAhead', 'distToCarAhead'],
  ['safeDistance', 'safeDistance'],
  ['pedestrianWaiting', 'pedWaiting'],
  ['pedestrianCrossing', 'pedCrossing'],
  ['crosswalkAhead', 'crosswalkAhead'],
  ['carInIntersection', 'carInIntersection'],
  ['carClearedIntersection', 'carCleared'],
  ['canStopSafely', 'canStopSafely'],
  ['speed', 'speedFacts'],
  ['state', 'carState'],
  ['action', 'decision']
];

function formatValue(value, language, strings) {
  if (value === Infinity) return strings.none;
  if (typeof value === 'boolean') return value ? strings.yes : strings.no;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (value === 'STOP' || value === 'GO' || value === 'SLOW_DOWN') return strings.actions[value];
  if (value === 'MOVING' || value === 'SLOWING' || value === 'STOPPED') return strings.phases[value];
  return value ?? strings.none;
}

export function createPanel(document, rules) {
  const elements = {
    panel: document.querySelector('#expert-panel'),
    body: document.querySelector('#panel-body'),
    collapse: document.querySelector('#collapse-panel'),
    eyebrow: document.querySelector('#panel-eyebrow'),
    title: document.querySelector('#panel-title'),
    lightLabel: document.querySelector('#light-label'),
    timerLabel: document.querySelector('#timer-label'),
    carLabel: document.querySelector('#car-label'),
    lightState: document.querySelector('#light-state'),
    lightTimer: document.querySelector('#light-timer'),
    selectedCar: document.querySelector('#selected-car'),
    factsTitle: document.querySelector('#facts-title'),
    rulesTitle: document.querySelector('#rules-title'),
    logTitle: document.querySelector('#log-title'),
    whyButton: document.querySelector('#why'),
    factsBody: document.querySelector('#facts-body'),
    rulesList: document.querySelector('#rules-list'),
    decisionLog: document.querySelector('#decision-log'),
    whyDialog: document.querySelector('#why-dialog'),
    whyTitle: document.querySelector('#why-title'),
    whyContent: document.querySelector('#why-content')
  };

  const factCells = new Map();
  elements.factsBody.replaceChildren();
  for (const [key] of FACT_ROWS) {
    const row = document.createElement('tr');
    const label = document.createElement('td');
    const value = document.createElement('td');
    row.append(label, value);
    elements.factsBody.append(row);
    factCells.set(key, { label, value });
  }

  const logRows = [];
  for (let index = 0; index < 10; index += 1) {
    const row = document.createElement('li');
    row.hidden = true;
    elements.decisionLog.append(row);
    logRows.push(row);
  }

  let language = 'en';
  let strings = STRINGS.en;
  let lastSnapshot = null;
  let collapsed = window.matchMedia('(max-width: 760px)').matches;
  if (collapsed) {
    elements.panel.classList.add('collapsed');
    elements.collapse.setAttribute('aria-expanded', 'false');
    elements.collapse.textContent = '☰';
  }

  function renderRules(firedRuleId = null) {
    elements.rulesList.replaceChildren();
    const sorted = rules.slice().sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const rule of sorted) {
      const item = document.createElement('li');
      if (rule.id === firedRuleId) item.classList.add('fired');
      const heading = document.createElement('div');
      const id = document.createElement('span');
      id.className = 'rule-id';
      id.textContent = rule.id;
      const priority = document.createElement('span');
      priority.textContent = ` · ${strings.priority} ${rule.priority}`;
      heading.append(id, priority);
      const text = document.createElement('div');
      text.textContent = language === 'ar' ? rule.text_ar : rule.text_en;
      item.append(heading, text);
      elements.rulesList.append(item);
    }
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === 'ar' ? 'ar' : 'en';
    strings = STRINGS[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    elements.eyebrow.textContent = strings.eyebrow;
    elements.title.textContent = strings.title;
    elements.lightLabel.textContent = strings.light;
    elements.timerLabel.textContent = strings.timer;
    elements.carLabel.textContent = strings.car;
    elements.factsTitle.textContent = strings.facts;
    elements.rulesTitle.textContent = strings.rules;
    elements.logTitle.textContent = strings.log;
    elements.whyTitle.textContent = strings.whyTitle;
    elements.whyButton.textContent = strings.why;
    elements.collapse.setAttribute('aria-label', collapsed ? strings.expand : strings.collapse);
    document.querySelector('#speed-label').textContent = strings.speed;
    for (const [key, labelKey] of FACT_ROWS) factCells.get(key).label.textContent = strings[labelKey];
    if (lastSnapshot) render(lastSnapshot);
  }

  function render(snapshot) {
    lastSnapshot = snapshot;
    elements.lightState.textContent = snapshot.light;
    elements.lightTimer.textContent = `${snapshot.remaining.toFixed(1)}s`;
    const car = snapshot.selectedCar;
    elements.selectedCar.textContent = car ? `${car.id}` : strings.none;
    elements.whyButton.disabled = !car;

    if (!car) {
      elements.factsBody.parentElement.querySelectorAll('tr').forEach((row) => { row.hidden = true; });
      return;
    }
    elements.factsBody.parentElement.querySelectorAll('tr').forEach((row) => { row.hidden = false; });
    for (const [key] of FACT_ROWS) {
      const target = factCells.get(key).value;
      const value = key === 'action' ? car.result.action : key === 'state' ? car.state : car.facts[key];
      target.textContent = formatValue(value, language, strings);
    }
    renderRules(car.result.firedRuleId);

    for (let index = 0; index < logRows.length; index += 1) {
      const entry = snapshot.log[index];
      const row = logRows[index];
      if (!entry) {
        row.hidden = true;
        continue;
      }
      row.hidden = false;
      const rule = rules.find((candidate) => candidate.id === entry.firedRuleId);
      const explanation = rule ? (language === 'ar' ? rule.text_ar : rule.text_en) : entry.explanation;
      row.textContent = `${entry.timestamp.toFixed(1)}s · ${entry.firedRuleId ?? strings.none} · ${strings.actions[entry.action]} — ${explanation}`;
    }
    if (snapshot.log.length === 0) {
      logRows[0].hidden = false;
      logRows[0].textContent = strings.noDecisions;
      for (let index = 1; index < logRows.length; index += 1) logRows[index].hidden = true;
    }
  }

  function showWhy() {
    const car = lastSnapshot?.selectedCar;
    if (!car) return;
    elements.whyContent.replaceChildren();
    const summary = document.createElement('p');
    const rule = rules.find((candidate) => candidate.id === car.result.firedRuleId);
    summary.textContent = rule ? (language === 'ar' ? rule.text_ar : rule.text_en) : car.result.explanation;
    const meta = document.createElement('p');
    meta.textContent = `${strings.firedRule}: ${car.result.firedRuleId ?? strings.none} · ${strings.matchedRules}: ${car.result.matchedRuleIds.join(', ') || strings.none} · ${strings.priority}: ${rule?.priority ?? strings.none}`;
    const title = document.createElement('h3');
    title.textContent = strings.factsUsed;
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    for (const [key] of FACT_ROWS) {
      const row = document.createElement('tr');
      const label = document.createElement('td');
      const value = document.createElement('td');
      label.textContent = factCells.get(key).label.textContent;
      value.textContent = factCells.get(key).value.textContent;
      row.append(label, value);
      body.append(row);
    }
    table.append(body);
    elements.whyContent.append(summary, meta, title, table);
    elements.whyDialog.showModal();
  }

  elements.whyButton.addEventListener('click', showWhy);
  elements.collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    elements.panel.classList.toggle('collapsed', collapsed);
    elements.collapse.setAttribute('aria-expanded', String(!collapsed));
    elements.collapse.setAttribute('aria-label', collapsed ? strings.expand : strings.collapse);
    elements.collapse.textContent = collapsed ? '☰' : '×';
  });

  renderRules();
  return { render, setLanguage, showWhy };
}

export { STRINGS };
