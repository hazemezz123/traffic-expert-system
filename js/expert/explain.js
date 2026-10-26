import { RULES } from './rules.js';

export function createDecisionLog(limit = 50) {
  const entries = [];
  return {
    entries,
    add(timestamp, facts, result) {
      entries.unshift({
        timestamp,
        facts: { ...facts },
        action: result.action,
        firedRuleId: result.firedRuleId,
        explanation: result.explanation
      });
      if (entries.length > limit) entries.length = limit;
    },
    clear() {
      entries.length = 0;
    }
  };
}

export function explainDecision(result, facts, language = 'en') {
  const rule = RULES.find((candidate) => candidate.id === result.firedRuleId);
  const explanation = rule?.[language === 'ar' ? 'text_ar' : 'text_en'] ?? result.explanation;
  const factText = language === 'ar'
    ? `الإشارة: ${facts.light}، المسافة إلى خط التوقف: ${Number(facts.distToStopLine).toFixed(1)}، السرعة: ${Number(facts.speed).toFixed(1)}`
    : `Light: ${facts.light}, distance to stop line: ${Number(facts.distToStopLine).toFixed(1)}, speed: ${Number(facts.speed).toFixed(1)}`;
  return `${result.firedRuleId ?? 'DEFAULT'} — ${explanation}\n${factText}`;
}
