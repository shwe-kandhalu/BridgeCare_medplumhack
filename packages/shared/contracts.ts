import { z } from 'zod';

export const acuitySchema = z.enum(['self_manage', 'contact_provider', 'urgent', 'emergency']);
export type Acuity = z.infer<typeof acuitySchema>;

export const citationSchema = z.object({
  source: z.string().min(1),
  snippet: z.string().min(1),
});
export type Citation = z.infer<typeof citationSchema>;

export const requiredFieldSchema = z.enum([
  'primary_symptom',
  'severity',
  'onset_duration',
  'affected_areas',
  'compared_to_baseline',
  'red_flag_screen',
]);
export type RequiredField = z.infer<typeof requiredFieldSchema>;

const collectedSchema = z.object({
  primary_symptom: z.string().optional(),
  severity: z.string().optional(),
  onset_duration: z.string().optional(),
  affected_areas: z.string().optional(),
  compared_to_baseline: z.string().optional(),
  red_flag_screen: z.string().optional(),
});

export const intakeStateSchema = z.object({
  patientId: z.string().min(1),
  turns: z.array(z.object({ role: z.enum(['patient', 'agent']), text: z.string() })),
  collected: collectedSchema,
  turnCount: z.number().int().nonnegative(),
  startedAt: z.string().min(1),
});
export type IntakeState = z.infer<typeof intakeStateSchema>;

export const intakeDecisionSchema = z.union([
  z.object({ done: z.literal(true), reason: z.enum(['checklist_complete', 'max_turns', 'max_time', 'red_flag_interrupt']) }),
  z.object({ done: z.literal(false), nextQuestion: z.string().min(1), targetField: requiredFieldSchema, reason: z.string().min(1) }),
]);
export type IntakeDecision = z.infer<typeof intakeDecisionSchema>;

export const symptomObservationSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().min(1).optional(),
  onset: z.string().min(1).optional(),
});
export type SymptomObservation = z.infer<typeof symptomObservationSchema>;

export const structuredSymptomsSchema = z.object({
  patientId: z.string().min(1),
  observations: z.array(symptomObservationSchema),
  narrativeSummary: z.string(),
  rawText: z.string(),
});
export type StructuredSymptoms = z.infer<typeof structuredSymptomsSchema>;

export const groundingSchema = z.object({
  citations: z.array(citationSchema),
  candidateMappings: z.array(z.object({ pattern: z.string().min(1), acuity: acuitySchema })),
});
export type Grounding = z.infer<typeof groundingSchema>;

export const redFlagResultSchema = z.object({
  triggered: z.boolean(),
  matches: z.array(z.string()),
  forcedAcuity: z.enum(['urgent', 'emergency']).optional(),
});
export type RedFlagResult = z.infer<typeof redFlagResultSchema>;

export const triageResultSchema = z.object({
  acuity: acuitySchema,
  recommendedNextStep: z.string().min(1),
  recommendedSpecialty: z.string().min(1),
  rationale: z.string().min(1),
  citations: z.array(citationSchema),
  redFlagsTriggered: z.array(z.string()),
  confidence: z.enum(['high', 'low']),
  disclaimer: z.string().min(1),
});
export type TriageResult = z.infer<typeof triageResultSchema>;

export const modeSchema = z.enum(['auto', 'confirm', 'block']);
export type Mode = z.infer<typeof modeSchema>;

export const proposedActionSchema = z.union([
  z.object({ kind: z.literal('write_observations') }),
  z.object({ kind: z.literal('draft_summary') }),
  z.object({ kind: z.literal('propose_appointment'), specialty: z.string().min(1), reason: z.string().min(1) }),
  z.object({ kind: z.literal('advise_self_manage') }),
  z.object({ kind: z.literal('escalate_urgent') }),
  z.object({ kind: z.literal('escalate_emergency') }),
]);
export type ProposedAction = z.infer<typeof proposedActionSchema>;

export const gatedActionSchema = z.object({
  action: proposedActionSchema,
  reversibility: z.enum(['high', 'low']),
  impact: z.enum(['low', 'high']),
  mode: modeSchema,
});
export type GatedAction = z.infer<typeof gatedActionSchema>;

export const gateDecisionSchema = z.object({ actions: z.array(gatedActionSchema) });
export type GateDecision = z.infer<typeof gateDecisionSchema>;

export const mockCoverageSummarySchema = z.object({
  payer: z.string().min(1),
  planName: z.string().min(1),
  memberId: z.string().min(1),
  active: z.boolean(),
  copays: z.array(z.object({ serviceType: z.string().min(1), inNetwork: z.string().optional(), outOfNetwork: z.string().optional() })),
  deductible: z.object({ individual: z.string().optional(), family: z.string().optional(), remaining: z.string().optional() }).optional(),
  source: z.literal('stedi_sandbox'),
  raw271Ref: z.string().optional(),
});
export type MockCoverageSummary = z.infer<typeof mockCoverageSummarySchema>;

export const providerSuggestionSchema = z.object({
  name: z.string().min(1),
  npi: z.string().optional(),
  specialty: z.string().min(1),
  networkStatus: z.enum(['in_network', 'out_of_network']),
  rating: z.number().min(0).max(5).optional(),
  distanceMiles: z.number().nonnegative().optional(),
  isPreferred: z.boolean().optional(),
  source: z.literal('placeholder'),
});
export type ProviderSuggestion = z.infer<typeof providerSuggestionSchema>;

export const slotOptionSchema = z.object({
  slotId: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  practitionerDisplay: z.string().min(1),
});
export type SlotOption = z.infer<typeof slotOptionSchema>;

export const appointmentRequestSchema = z.object({
  patientId: z.string().min(1),
  slotId: z.string().min(1),
  specialty: z.string().min(1),
  reason: z.string().min(1),
});
export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;

export const appointmentResultSchema = z.object({
  appointmentId: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  practitionerDisplay: z.string().min(1),
  packetRef: z.string().optional(),
});
export type AppointmentResult = z.infer<typeof appointmentResultSchema>;

export const analyzeRequestSchema = z.object({
  patientId: z.string().min(1),
  structuredSymptoms: structuredSymptomsSchema,
  grounding: groundingSchema,
  transcript: z.array(z.object({ role: z.enum(['patient', 'agent']), text: z.string() })),
  redFlagSignals: redFlagResultSchema,
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const triageOutcomeSchema = z.object({
  triage: triageResultSchema,
  gate: gateDecisionSchema,
  insurance: mockCoverageSummarySchema,
  providers: z.array(providerSuggestionSchema),
  appointmentOptions: z.array(slotOptionSchema),
  disclaimerShown: z.boolean(),
});
export type TriageOutcome = z.infer<typeof triageOutcomeSchema>;
