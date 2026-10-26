import { ACTIONS, RULES } from './rules.js';

export function createEngine(rules = RULES) {
  const matchedRuleIds = new Array(rules.length);
  const result = {
    action: ACTIONS.STOP,
    firedRuleId: null,
    matchedRuleIds,
    explanation: ''
  };

  return {
    evaluate(facts, language = 'en') {
      let matchedCount = 0;
      let firedRule = null;
      for (let index = 0; index < rules.length; index += 1) {
        const rule = rules[index];
        if (!rule.condition(facts)) continue;
        matchedRuleIds[matchedCount] = rule.id;
        matchedCount += 1;
        if (!firedRule || rule.priority > firedRule.priority) firedRule = rule;
      }
      matchedRuleIds.length = matchedCount;
      result.action = firedRule?.action ?? ACTIONS.STOP;
      result.firedRuleId = firedRule?.id ?? null;
      result.explanation = firedRule?.[language === 'ar' ? 'text_ar' : 'text_en']
        ?? (language === 'ar' ? 'لم تنطبق أي قاعدة؛ التوقف هو القرار الآمن.' : 'No rule matched; stopping is the safe default.');
      return result;
    }
  };
}
