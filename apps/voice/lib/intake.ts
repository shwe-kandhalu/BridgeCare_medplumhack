import {
  IntakeStateSchema, type IntakeDecision, type IntakeState, type RequiredField, type StructuredSymptoms,
  StructuredSymptomsSchema, type TranscriptTurn
} from '@bridgecare/shared';
import { detectRedFlags } from '@bridgecare/shared/redflags';

export const MAX_QUESTIONS = 6;
export const MAX_INTAKE_MS = 90_000;
export const DISCLAIMER = "This is not a diagnosis or medical advice. It's a triage aid to help you decide your next step. If you think this is an emergency, call 911 or go to the nearest ER.";

const QUESTIONS: Record<RequiredField, string> = {
  primary_symptom: 'What symptom is bothering you most right now?',
  severity: 'On a scale from 0 to 10, how severe is it?',
  onset_duration: 'When did this start, and has it changed?',
  affected_areas: 'Which areas or joints are affected?',
  compared_to_baseline: 'How does this compare with your usual baseline?',
  red_flag_screen: 'Before we continue: any chest pain, trouble breathing, high fever while on immune-suppressing medicine, sudden severe pain, new neurologic symptoms, or thoughts of harming yourself?'
};
const FIELDS = Object.keys(QUESTIONS) as RequiredField[];

export function createIntake(patientId: string, now = new Date()): IntakeState {
  return IntakeStateSchema.parse({ patientId, turns: [], collected: {}, turnCount: 0, startedAt: now.toISOString() });
}

function collectFrom(text: string, target: RequiredField | undefined): Partial<Record<RequiredField, string>> {
  if (!target) return { primary_symptom: text };
  return { [target]: text };
}

export function decideIntake(state: IntakeState, now = Date.now()): IntakeDecision {
  IntakeStateSchema.parse(state);
  if (now - Date.parse(state.startedAt) >= MAX_INTAKE_MS) return { done: true, reason: 'max_time' };
  if (state.turnCount >= MAX_QUESTIONS) return { done: true, reason: 'max_turns' };
  const missing = FIELDS.find((field) => !state.collected[field]);
  if (!missing) return { done: true, reason: 'checklist_complete' };
  return { done: false, targetField: missing, nextQuestion: QUESTIONS[missing], reason: `Collect ${missing.replaceAll('_', ' ')}.` };
}

export type TurnResult = { state: IntakeState; decision: IntakeDecision; redFlags: ReturnType<typeof detectRedFlags> };

/** Safety ordering is intentional: inspect raw utterance before extraction or question selection. */
export function processPatientTurn(state: IntakeState, text: string, now = Date.now()): TurnResult {
  const rawText = text.trim();
  if (!rawText) throw new Error('A patient message is required.');
  const redFlags = detectRedFlags(rawText);
  const patientTurn: TranscriptTurn = { role: 'patient', text: rawText };
  if (redFlags.triggered) {
    const interrupted = IntakeStateSchema.parse({ ...state, turns: [...state.turns, patientTurn], collected: { ...state.collected }, turnCount: state.turnCount });
    return { state: interrupted, decision: { done: true, reason: 'red_flag_interrupt' }, redFlags };
  }
  const lastAgent = [...state.turns].reverse().find((turn) => turn.role === 'agent');
  const target = lastAgent ? FIELDS.find((field) => QUESTIONS[field] === lastAgent.text) : undefined;
  const updated = IntakeStateSchema.parse({ ...state, turns: [...state.turns, patientTurn], collected: { ...state.collected, ...collectFrom(rawText, target) } });
  const decision = decideIntake(updated, now);
  if (decision.done) return { state: updated, decision, redFlags };
  const withQuestion = IntakeStateSchema.parse({ ...updated, turns: [...updated.turns, { role: 'agent', text: decision.nextQuestion }], turnCount: updated.turnCount + 1 });
  return { state: withQuestion, decision, redFlags };
}

export function extractStructuredSymptoms(state: IntakeState): StructuredSymptoms {
  const patientText = state.turns.filter((turn) => turn.role === 'patient').map((turn) => turn.text).join(' ');
  const observations: StructuredSymptoms['observations'] = [];
  const severity = state.collected.severity?.match(/\b(10|[0-9])\b/);
  if (severity) observations.push({ code: '72514-3', display: 'Pain severity', value: Number(severity[1]), unit: '0-10' });
  const fatigue = patientText.match(/fatigue\D{0,20}(10|[0-9])/i);
  if (fatigue) observations.push({ code: 'fatigue-0-10', display: 'Fatigue severity', value: Number(fatigue[1]), unit: '0-10' });
  const stiffness = patientText.match(/(?:morning\s+)?stiffness\D{0,20}(\d+)\s*(?:min|minutes?)/i);
  if (stiffness) observations.push({ code: 'morning-stiffness-min', display: 'Morning stiffness', value: Number(stiffness[1]), unit: 'min' });
  return StructuredSymptomsSchema.parse({ patientId: state.patientId, observations, narrativeSummary: patientText || 'No patient narrative supplied.', rawText: patientText || 'No patient narrative supplied.' });
}
