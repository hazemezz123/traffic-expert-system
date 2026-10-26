import { STRINGS } from './panel.js';

export function createControls(document, handlers) {
  const elements = {
    running: document.querySelector('#toggle-running'),
    reset: document.querySelector('#reset'),
    nextLight: document.querySelector('#next-light'),
    speed: document.querySelector('#speed'),
    speedValue: document.querySelector('#speed-value'),
    stats: document.querySelector('#toggle-stats'),
    statsOutput: document.querySelector('#stats'),
    language: document.querySelector('#toggle-language')
  };

  let language = 'en';
  let running = true;
  let statsVisible = false;
  let strings = STRINGS.en;

  function syncRunning() {
    elements.running.textContent = running ? strings.pause : strings.start;
  }

  function syncLanguage() {
    strings = STRINGS[language];
    elements.reset.textContent = strings.reset;
    elements.nextLight.textContent = strings.nextLight;
    elements.stats.textContent = strings.stats;
    elements.language.textContent = strings.language;
    elements.speedValue.value = `${elements.speed.value}×`;
    syncRunning();
  }

  elements.running.addEventListener('click', () => {
    running = !running;
    handlers.onRunning(running);
    syncRunning();
  });

  elements.reset.addEventListener('click', handlers.onReset);
  elements.nextLight.addEventListener('click', handlers.onNextLight);
  elements.speed.addEventListener('input', () => {
    const value = Number(elements.speed.value);
    elements.speedValue.value = `${value}×`;
    handlers.onSpeed(value);
  });
  elements.stats.addEventListener('click', () => {
    statsVisible = !statsVisible;
    elements.stats.setAttribute('aria-pressed', String(statsVisible));
    elements.statsOutput.classList.toggle('hidden', !statsVisible);
    handlers.onStats(statsVisible);
  });
  elements.language.addEventListener('click', () => {
    language = language === 'en' ? 'ar' : 'en';
    syncLanguage();
    handlers.onLanguage(language);
  });

  function updateStats(fps, calls) {
    if (!statsVisible) return;
    elements.statsOutput.value = `FPS: ${fps.toFixed(0)} · Calls: ${calls}`;
  }

  function setRunning(nextRunning) {
    running = nextRunning;
    syncRunning();
  }

  syncLanguage();
  return { updateStats, setRunning };
}
