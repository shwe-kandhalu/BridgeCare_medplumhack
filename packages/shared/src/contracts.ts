import { z } from 'zod';

export const AcuitySchema = z.enum(['self_manage', 'contact_provider', 'urgent', 'emergency']);
export type Acuity = z.infer<typeof AcuitySchema>;
export const CitationSchema = z.object({ source: z.string().min(1), snippet: z.string().min(1) }).strict();
export type Citation = z.infer<typeof CitationSchema>;

export const RequiredFieldSchema = z.enum(['primary_symptom', 'severity', 'onset_duration', 'affected_areas', 'compared_to_baseline', 'red_flag_screen']);
export type RequiredField = z.infer<typeof RequiredFieldSchema>;
export const TranscriptTurnSchema = z.object({ role: z.enum(['patient', 'agent']), text: z.string().min(1) }).strict();
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export const IntakeStateSchema = z.object({
  patientId: z.string().min(1), turns: z.array(TranscriptTurnSchema),
  collected: z.object({ primary_symptom: z.string(), severity: z.string(), onset_duration: z.string(), affected_areas: z.string(), compared_to_baseline: z.string(), red_flag_screen: z.string() }).partial().strict(), turnCount: z.number().int().nonnegative(), startedAt: z.string().datetime()
}).strict();
export type IntakeState = z.infer<typeof IntakeStateSchema>;
export const IntakeDecisionSchema = z.discriminatedUnion('done', [
  z.object({ done: z.literal(true), reason: z.enum(['checklist_complete', 'max_turns', 'max_time', 'red_flag_interrupt']) }).strict(),
  z.object({ done: z.literal(false), nextQuestion: z.string().min(1), targetField: RequiredFieldSchema, reason: z.string().min(1) }).strict()
]);
export type IntakeDecision = z.infer<typeof IntakeDecisionSchema>;

export const SymptomObservationSchema = z.object({ code: z.string().min(1), display: z.string().min(1), value: z.union([z.number(), z.string()]), unit: z.string().min(1).optional(), onset: z.string().min(1).optional() }).strict();
export type SymptomObservation = z.infer<typeof SymptomObservationSchema>;
export const StructuredSymptomsSchema = z.object({ patientId: z.string().min(1), observations: z.array(SymptomObservationSchema), narrativeSummary: z.string().min(1), rawText: z.string().min(1) }).strict();
export type StructuredSymptoms = z.infer<typeof StructuredSymptomsSchema>;
export const GroundingSchema = z.object({ citations: z.array(CitationSchema), candidateMappings: z.array(z.object({ pattern: z.string().min(1), acuity: AcuitySchema }).strict()) }).strict();
export type Grounding = z.infer<typeof GroundingSchema>;

export const RedFlagResultSchema = z.object({ triggered: z.boolean(), matches: z.array(z.string().min(1)), forcedAcuity: z.enum(['urgent', 'emergency']).optional() }).strict();
export type RedFlagResult = z.infer<typeof RedFlagResultSchema>;
export const TriageResultSchema = z.object({ acuity: AcuitySchema, recommendedNextStep: z.string().min(1), recommendedSpecialty: z.string().min(1), rationale: z.string().min(1), citations: z.array(CitationSchema), redFlagsTriggered: z.array(z.string()), confidence: z.enum(['high', 'low']), disclaimer: z.string().min(1) }).strict();
export type TriageResult = z.infer<typeof TriageResultSchema>;

export const ProposedActionSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('write_observations') }).strict(), z.object({ kind: z.literal('draft_summary') }).strict(), z.object({ kind: z.literal('propose_appointment'), specialty: z.string().min(1), reason: z.string().min(1) }).strict(), z.object({ kind: z.literal('advise_self_manage') }).strict(), z.object({ kind: z.literal('escalate_urgent') }).strict(), z.object({ kind: z.literal('escalate_emergency') }).strict()]);
export type ProposedAction = z.infer<typeof ProposedActionSchema>;
export const GateDecisionSchema = z.object({ actions: z.array(z.object({ action: ProposedActionSchema, reversibility: z.enum(['high', 'low']), impact: z.enum(['low', 'high']), mode: z.enum(['auto', 'confirm', 'block']) }).strict()) }).strict();
export type GateDecision = z.infer<typeof GateDecisionSchema>;
export const MockCoverageSummarySchema = z.object({ payer: z.string().min(1), planName: z.string().min(1), memberId: z.string().min(1), active: z.boolean(), copays: z.array(z.object({ serviceType: z.string().min(1), inNetwork: z.string().optional(), outOfNetwork: z.string().optional() }).strict()), deductible: z.object({ individual: z.string().optional(), family: z.string().optional(), remaining: z.string().optional() }).strict().optional(), source: z.literal('stedi_sandbox'), raw271Ref: z.string().optional() }).strict();
export type MockCoverageSummary = z.infer<typeof MockCoverageSummarySchema>;
export const ProviderSuggestionSchema = z.object({ name: z.string().min(1), npi: z.string().optional(), specialty: z.string().min(1), networkStatus: z.enum(['in_network', 'out_of_network']), rating: z.number().optional(), distanceMiles: z.number().optional(), isPreferred: z.boolean().optional(), source: z.literal('placeholder') }).strict();
export type ProviderSuggestion = z.infer<typeof ProviderSuggestionSchema>;
export const SlotOptionSchema = z.object({ slotId: z.string().min(1), start: z.string().datetime(), end: z.string().datetime(), practitionerDisplay: z.string().min(1) }).strict();
export type SlotOption = z.infer<typeof SlotOptionSchema>;
export const AppointmentRequestSchema = z.object({ patientId: z.string().min(1), slotId: z.string().min(1), specialty: z.string().min(1), reason: z.string().min(1) }).strict();
export type AppointmentRequest = z.infer<typeof AppointmentRequestSchema>;
export const AppointmentResultSchema = z.object({ appointmentId: z.string().min(1), start: z.string().datetime(), end: z.string().datetime(), practitionerDisplay: z.string().min(1), packetRef: z.string().optional() }).strict();
export type AppointmentResult = z.infer<typeof AppointmentResultSchema>;
export const AnalyzeRequestSchema = z.object({ patientId: z.string().min(1), structuredSymptoms: StructuredSymptomsSchema, grounding: GroundingSchema, transcript: z.array(TranscriptTurnSchema), redFlagSignals: RedFlagResultSchema }).strict();
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export const TriageOutcomeSchema = z.object({ triage: TriageResultSchema, gate: GateDecisionSchema, insurance: MockCoverageSummarySchema, providers: z.array(ProviderSuggestionSchema), appointmentOptions: z.array(SlotOptionSchema), disclaimerShown: z.boolean() }).strict();
export type TriageOutcome = z.infer<typeof TriageOutcomeSchema>;
