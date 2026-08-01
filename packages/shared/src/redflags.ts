import type { RedFlagResult } from './contracts';

const EMERGENCY: Array<[RegExp, string]> = [
  [/\b(chest\s+(pain|pressure|tightness)|pressure\s+in\s+(my\s+)?chest)\b/i, 'chest pain or pressure'],
  [/\b(short(ness)?\s+of\s+breath|can'?t\s+breathe|difficulty\s+breathing)\b/i, 'difficulty breathing'],
  [/\b(face\s+droop|arm\s+weakness|slurred\s+speech|sudden\s+confusion)\b/i, 'possible stroke symptoms'],
  [/\b(kill\s+myself|suicid(al|e)|end\s+my\s+life|want\s+to\s+die)\b/i, 'suicidal ideation or intent'],
  [/\b(blood\s+in\s+(my\s+)?(stool|vomit)|vomit(ing)?\s+blood)\b/i, 'blood in stool or vomit']
];
const URGENT: Array<[RegExp, string]> = [
  [/\b(high\s+)?fever\b.*\b(biologic|steroid|immunosuppress)/i, 'fever with immunosuppression'],
  [/\b(biologic|steroid|immunosuppress).*\b(high\s+)?fever\b/i, 'fever with immunosuppression'],
  [/\b(sudden\s+)?severe\s+abdominal\s+pain\b/i, 'severe abdominal pain'],
  [/\b(new\s+)?severe\s+headache\b/i, 'new severe headache'],
  [/\b(vision\s+loss|new\s+neurological\s+change)\b/i, 'vision loss or neurological change'],
  [/\b(signs?\s+of\s+(a\s+)?serious\s+infection|severe\s+infection)\b/i, 'possible serious infection']
];

/** Deterministic safety monitor. It deliberately operates on unmodified patient text. */
export function detectRedFlags(rawText: string): RedFlagResult {
  const emergency = EMERGENCY.filter(([pattern]) => pattern.test(rawText)).map(([, label]) => label);
  if (emergency.length) return { triggered: true, matches: emergency, forcedAcuity: 'emergency' };
  const urgent = URGENT.filter(([pattern]) => pattern.test(rawText)).map(([, label]) => label);
  return urgent.length ? { triggered: true, matches: urgent, forcedAcuity: 'urgent' } : { triggered: false, matches: [] };
}
