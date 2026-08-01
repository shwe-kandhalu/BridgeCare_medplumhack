Final Codex prompt — Part A (person 1, in apps/voice)

Read /AGENTS.md, packages/shared/contracts.md, packages/shared/safety-rules.md, apps/voice/AGENTS.md, and apps/voice/evals.md. Build Part A (Voice/Chat, PWA) in apps/voice, importing all shared types and detectRedFlags from packages/shared — never redefine them.

Quality, not speed: strict TypeScript, zod validation on StructuredSymptoms, Grounding, and both seam payloads, explicit error handling, unit tests for the loop bounds and the red-flag interrupt. No stubs in the red-flag path.

Build and STOP after Phase 1 for review:

Text chat + adaptive intake loop against a stubbed /api/analyze returning a canned TriageOutcome. Implement the loop (IntakeState/IntakeDecision, max 6 Q / 90s), extraction → StructuredSymptoms, the per-turn local detectRedFlags interrupt, rendering of the outcome (acuity, next step, citations, disclaimer, mock insurance, mock providers, appointment options), and confirm → stubbed /api/book.
Moss retrieval → real Grounding in AnalyzeRequest.
Deepgram voice wrapping the loop (push-to-talk; keep the text box as fallback); read from Moss.
PWA shell — installable, mobile-first: web app manifest (display: standalone, icons, theme color) + service worker (@serwist/next) for the offline shell, over HTTPS. Single-column layout, large tap targets, safe-area insets. Request mic permission on an explicit tap, handle denial gracefully, keep the text input always available.
Evals from apps/voice/evals.md as a regression harness.

Honor safety-rules.md as hard constraints. Speak/show the disclaimer before any guidance. If the seam is unreachable, fail safe (tell the patient to contact their provider) — never fabricate a triage. Synthetic data only.

Final Codex prompt — Part B (person 2, in apps/analysis)

Read /AGENTS.md, packages/shared/contracts.md, packages/shared/safety-rules.md, apps/analysis/AGENTS.md, and apps/analysis/evals.md. Build Part B (Analysis + Outcome) in apps/analysis, importing shared types and detectRedFlags from packages/shared — never fork them.

Quality, not speed: strict TypeScript, validate every FHIR resource and every seam payload, explicit error handling, unit tests for the classifier cost matrix, the conservative default, the gate matrix, and FHIR validity. No stubs in the triage or gate paths.

Build and STOP after Phase 1 for review:

Deterministic decision core — POST /api/analyze running: authoritative detectRedFlags → write Observations (stub Medplum ok) → classifier (match grounding.candidateMappings; conservative default per safety-rules.md) → gate → mock MockCoverageSummary + placeholder ProviderSuggestion[] + seeded SlotOption[]. POST /api/book creates an Appointment + ContextPacket. Exercisable via curl with a sample AnalyzeRequest.
Real Medplum — Observation writes, seed script (Maya: Patient, RA Condition, CarePlan; HealthcareService/Schedule/Slots), ContextPacket Bundle linked via Appointment.supportingInformation.
Stedi sandbox eligibility (approved mock member) → MockCoverageSummary (source: 'stedi_sandbox'); expand the placeholder provider list.
Evals from apps/analysis/evals.md; wire the two ship-gate metrics first (under-triage rate → 0, red-flag recall → 100%).

Honor safety-rules.md. Acuity can only be raised by the monitor; coverage is display-only and must never influence acuity; providers/insurance clearly labeled mock. On Stedi/Medplum error, fail safe (return the triage with "coverage unavailable") — never fabricate coverage or drop the triage. Sandbox/synthetic data only. Validate every FHIR resource against R4.