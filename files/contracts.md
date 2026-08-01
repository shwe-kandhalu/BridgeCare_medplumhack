# contracts.md (shared) — boundary types + the two-part seam

Source of truth for both tracks. Mirror these in `packages/shared/contracts.ts` and validate with zod at every boundary. **Do not change a shape without both track owners agreeing.**

## Acuity + core
```ts
type Acuity = 'self_manage' | 'contact_provider' | 'urgent' | 'emergency';
type Citation = { source: string; snippet: string };
```

## === PART A owns (voice/chat) ===

## Adaptive intake loop (the one agentic step)
```ts
type RequiredField =
  | 'primary_symptom' | 'severity' | 'onset_duration'
  | 'affected_areas' | 'compared_to_baseline' | 'red_flag_screen';
type IntakeState = {
  patientId: string;
  turns: { role: 'patient'|'agent'; text: string }[];
  collected: Partial<Record<RequiredField, string>>;
  turnCount: number; startedAt: string;
};
type IntakeDecision =
  | { done: true; reason: 'checklist_complete'|'max_turns'|'max_time'|'red_flag_interrupt' }
  | { done: false; nextQuestion: string; targetField: RequiredField; reason: string };
```
Bounds (safety-rules.md): max 6 questions, max 90s, red-flag interrupt breaks immediately.

## StructuredSymptoms (Extract output; maps to FHIR Observations)
```ts
type SymptomObservation = { code: string; display: string; value: number|string; unit?: string; onset?: string };
type StructuredSymptoms = { patientId: string; observations: SymptomObservation[]; narrativeSummary: string; rawText: string };
```
Codes (use where easy, local otherwise): pain 0-10 -> LOINC `72514-3`; morning stiffness -> local `morning-stiffness-min` (min); fatigue -> local `fatigue-0-10`; swollen joints -> local `swollen-joint-count`; flare self-report -> local `flare-selfreport`.

## Grounding (retrieved from Moss in Part A, passed to Part B)
```ts
type Grounding = { citations: Citation[]; candidateMappings: { pattern: string; acuity: Acuity }[] };
```

## === SHARED (packages/shared/redflags.ts) ===
```ts
type RedFlagResult = { triggered: boolean; matches: string[]; forcedAcuity?: 'urgent'|'emergency' };
// detectRedFlags(rawText: string): RedFlagResult   — deterministic; both parts import this.
```

## === PART B owns (analysis/outcome) ===

## TriageResult (deterministic classifier)
```ts
type TriageResult = {
  acuity: Acuity; recommendedNextStep: string; recommendedSpecialty: string; rationale: string;
  citations: Citation[];            // >=1; if empty -> acuity = contact_provider
  redFlagsTriggered: string[]; confidence: 'high'|'low'; disclaimer: string;
};
```
Rule: match to `candidateMappings`; red flag -> `forcedAcuity`; no confident match OR no citation -> conservative default (escalate one level, min contact_provider). Acuity is only ever RAISED by the red-flag monitor.

## GateDecision (reversibility x impact)
```ts
type Mode = 'auto'|'confirm'|'block';
type ProposedAction =
  | { kind:'write_observations' } | { kind:'draft_summary' }
  | { kind:'propose_appointment'; specialty:string; reason:string }
  | { kind:'advise_self_manage' } | { kind:'escalate_urgent' } | { kind:'escalate_emergency' };
type GatedAction = { action: ProposedAction; reversibility:'high'|'low'; impact:'low'|'high'; mode: Mode };
type GateDecision = { actions: GatedAction[] };
```

## Mock insurance (Stedi sandbox 271 -> CoverageEligibilityResponse-shaped; clearly labeled mock)
```ts
type MockCoverageSummary = {
  payer: string; planName: string; memberId: string; active: boolean;
  copays: { serviceType: string; inNetwork?: string; outOfNetwork?: string }[];
  deductible?: { individual?: string; family?: string; remaining?: string };
  source: 'stedi_sandbox'; raw271Ref?: string;
};
```

## Mock providers (placeholder, Plan-Net-shaped; clearly labeled mock)
```ts
type ProviderSuggestion = {
  name: string; npi?: string; specialty: string;
  networkStatus: 'in_network'|'out_of_network';
  rating?: number; distanceMiles?: number; isPreferred?: boolean;
  source: 'placeholder';
};
```

## Scheduling
```ts
type SlotOption = { slotId: string; start: string; end: string; practitionerDisplay: string };
type AppointmentRequest = { patientId: string; slotId: string; specialty: string; reason: string };
type AppointmentResult = { appointmentId: string; start: string; end: string; practitionerDisplay: string; packetRef?: string };
```
ContextPacket = FHIR `Bundle` (collection): Patient + Condition(RA) + session Observations + a Communication/DocumentReference (narrative+rationale+citations) + Appointment ref. Link via `Appointment.supportingInformation`.

## === THE SEAM (the only cross-track contract) ===
```ts
type AnalyzeRequest = {
  patientId: string;
  structuredSymptoms: StructuredSymptoms;
  grounding: Grounding;                 // from Moss (Part A)
  transcript: { role:'patient'|'agent'; text:string }[];
  redFlagSignals: RedFlagResult;        // A's local detection; B re-verifies authoritatively
};
type TriageOutcome = {
  triage: TriageResult;
  gate: GateDecision;
  insurance: MockCoverageSummary;
  providers: ProviderSuggestion[];
  appointmentOptions: SlotOption[];
  disclaimerShown: boolean;
};
// POST /api/analyze : AnalyzeRequest -> TriageOutcome
// POST /api/book    : AppointmentRequest -> AppointmentResult   (+ builds ContextPacket)
```
