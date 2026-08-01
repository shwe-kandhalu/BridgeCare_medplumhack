import type { RedFlagResult } from './contracts.js';

type Rule = {
  label: string;
  acuity: 'urgent' | 'emergency';
  patterns: RegExp[];
};

const emergencyRules: Rule[] = [
  {
    label: 'chest pain or pressure',
    acuity: 'emergency',
    patterns: [/\bchest (pain|pressure|tightness)\b/i, /\bpressure in my chest\b/i],
  },
  {
    label: 'difficulty breathing',
    acuity: 'emergency',
    patterns: [/\b(difficulty|trouble|hard) breathing\b/i, /\bcan't breathe\b/i, /\bshort of breath\b/i],
  },
  {
    label: 'stroke symptoms',
    acuity: 'emergency',
    patterns: [/\bface droop\b/i, /\barm weakness\b/i, /\bspeech difficulty\b/i, /\bslurred speech\b/i, /\bsudden confusion\b/i],
  },
  {
    label: 'suicidal ideation or intent',
    acuity: 'emergency',
    patterns: [/\bsuicidal\b/i, /\bkill myself\b/i, /\bwant to die\b/i],
  },
];

const urgentRules: Rule[] = [
  {
    label: 'high fever with immunosuppression or infection',
    acuity: 'urgent',
    patterns: [/\b(high\s+)?fever\b/i, /\b(prednisone|steroid|biologic|immunosuppress|immunocompromised|infection|infected)\b/i],
  },
  {
    label: 'severe abdominal pain or blood in stool/vomit',
    acuity: 'urgent',
    patterns: [/\bsudden severe abdominal pain\b/i, /\bblood in stool\b/i, /\bblood in vomit\b/i, /\bvomit(?:ing)? blood\b/i],
  },
  {
    label: 'new severe headache or vision loss',
    acuity: 'urgent',
    patterns: [/\bnew severe headache\b/i, /\bvision loss\b/i, /\bnew neurological change\b/i],
  },
];

function addMatch(matches: string[], label: string): void {
  if (!matches.includes(label)) {
    matches.push(label);
  }
}

export function detectRedFlags(rawText: string): RedFlagResult {
  const text = rawText.trim();
  const matches: string[] = [];
  let forcedAcuity: 'urgent' | 'emergency' | undefined;

  for (const rule of emergencyRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      addMatch(matches, rule.label);
      forcedAcuity = 'emergency';
    }
  }

  if (forcedAcuity !== 'emergency') {
    for (const rule of urgentRules) {
      if (rule.label === 'high fever with immunosuppression or infection') {
        const fever = rule.patterns[0]?.test(text) ?? false;
        const risk = rule.patterns[1]?.test(text) ?? false;
        if (fever && risk) {
          addMatch(matches, rule.label);
          forcedAcuity = 'urgent';
        }
        continue;
      }

      if (rule.patterns.some((pattern) => pattern.test(text))) {
        addMatch(matches, rule.label);
        forcedAcuity = 'urgent';
      }
    }
  }

  return forcedAcuity ? { triggered: matches.length > 0, matches, forcedAcuity } : { triggered: matches.length > 0, matches };
}
