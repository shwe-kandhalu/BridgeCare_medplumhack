import {
  IntakeStateSchema, type IntakeDecision, type IntakeGuidance, type IntakeState, type StructuredSymptoms,
  StructuredSymptomsSchema, type TranscriptTurn
} from '@bridgecare/shared';
import { detectRedFlags } from '@bridgecare/shared/redflags';

export const MAX_QUESTIONS = 6;
export const MAX_INTAKE_MS = 90_000;
export const DISCLAIMER = "This is not a diagnosis or medical advice. It's a triage aid to help you decide your next step. If you think this is an emergency, call 911 or go to the nearest ER.";

/** Fetches Moss-grounded candidate follow-up questions for the patient narrative collected so far. */
export type RetrieveIntakeGuidance = (query: string) => Promise<IntakeGuidance>;

export function createIntake(patientId: string, now = new Date()): IntakeState {
  return IntakeStateSchema.parse({ patientId, turns: [], askedPatterns: [], turnCount: 0, startedAt: now.toISOString() });
}

function patientNarrative(state: IntakeState): string {
  return state.turns.filter((turn) => turn.role === 'patient').map((turn) => turn.text).join(' ');
}

export async function decideIntake(state: IntakeState, retrieve: RetrieveIntakeGuidance, now = Date.now()): Promise<IntakeDecision> {
  IntakeStateSchema.parse(state);
  if (now - Date.parse(state.startedAt) >= MAX_INTAKE_MS) return { done: true, reason: 'max_time' };
  if (state.turnCount >= MAX_QUESTIONS) return { done: true, reason: 'max_turns' };
  const guidance = await retrieve(patientNarrative(state));
  const next = guidance.matches.find((match) => !state.askedPatterns.includes(match.pattern));
  if (!next) return { done: true, reason: 'no_further_questions' };
  return { done: false, nextQuestion: next.followUpQuestion, matchedPattern: next.pattern, reason: `Moss retrieval matched "${next.pattern}".` };
}

export type TurnResult = { state: IntakeState; decision: IntakeDecision; redFlags: ReturnType<typeof detectRedFlags> };

/** Safety ordering is intentional: inspect raw utterance before any retrieval or question selection. This regex-based check is an independent safety net and never depends on Moss retrieval. */
export async function processPatientTurn(state: IntakeState, text: string, retrieve: RetrieveIntakeGuidance, now = Date.now()): Promise<TurnResult> {
  const rawText = text.trim();
  if (!rawText) throw new Error('A patient message is required.');
  const redFlags = detectRedFlags(rawText);
  const patientTurn: TranscriptTurn = { role: 'patient', text: rawText };
  if (redFlags.triggered) {
    const interrupted = IntakeStateSchema.parse({ ...state, turns: [...state.turns, patientTurn] });
    return { state: interrupted, decision: { done: true, reason: 'red_flag_interrupt' }, redFlags };
  }
  const updated = IntakeStateSchema.parse({ ...state, turns: [...state.turns, patientTurn] });
  const decision = await decideIntake(updated, retrieve, now);
  if (decision.done) return { state: updated, decision, redFlags };
  const withQuestion = IntakeStateSchema.parse({
    ...updated,
    turns: [...updated.turns, { role: 'agent', text: decision.nextQuestion }],
    askedPatterns: [...updated.askedPatterns, decision.matchedPattern],
    turnCount: updated.turnCount + 1
  });
  return { state: withQuestion, decision, redFlags };
}

export function extractStructuredSymptoms(state: IntakeState): StructuredSymptoms {
  const patientText = patientNarrative(state);
  const observations: StructuredSymptoms['observations'] = [];
  const severity = patientText.match(/\b(10|[0-9])\s*(?:\/|out of)\s*10\b/i);
  if (severity) observations.push({ code: '72514-3', display: 'Pain severity', value: Number(severity[1]), unit: '0-10' });
  const fatigue = patientText.match(/fatigue\D{0,20}(10|[0-9])/i);
  if (fatigue) observations.push({ code: 'fatigue-0-10', display: 'Fatigue severity', value: Number(fatigue[1]), unit: '0-10' });
  const stiffness = patientText.match(/(?:morning\s+)?stiffness\D{0,20}(\d+)\s*(?:min|minutes?)/i);
  if (stiffness) observations.push({ code: 'morning-stiffness-min', display: 'Morning stiffness', value: Number(stiffness[1]), unit: 'min' });
  return StructuredSymptomsSchema.parse({ patientId: state.patientId, observations, narrativeSummary: patientText || 'No patient narrative supplied.', rawText: patientText || 'No patient narrative supplied.' });
}
