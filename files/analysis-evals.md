# apps/analysis/evals.md — Part B evals, guardrails, HITL

Governing principle (shared): **under-triage is catastrophic; over-triage is merely costly.** This track owns the clinical decision, so it owns the two headline metrics: **under-triage rate -> 0** and **red-flag recall -> ~100%.**

## Definitions ledger (proposed v1 — confirm before trusting scores)
| Level | Definition | Why |
|---|---|---|
| good/correct | acuity == ground truth; >=1 supporting citation; disclaimer present | safe + defensible |
| acceptable | over-triage by one level | safe, slightly costly |
| incorrect | wrong specialty; over-triage >1 level | recoverable |
| bad | under-triage by one level (non-emergency); ungrounded advice | harms goal |
| catastrophic | under-triage of true urgent/emergency; red flag not escalated; a diagnosis stated | irreversible harm |

## B1 — Authoritative red-flag monitor (deterministic)
- **Definitions:** catastrophic = false negative. False positive = acceptable.
- **Evals (deterministic):** shared red-flag test set incl. obfuscated phrasings; **recall on emergencies = 100%.** Also verify it can only RAISE acuity, never lower.
- **Guardrails:** runs first, on raw text; hard-override; independent of Part A's copy.
- **HITL:** review every miss; expand the clinician-reviewed rule set.

## B2 — Triage acuity classifier (the decision)
- **Definitions:** scored on a **cost matrix**, under-triage weighted ~10x over-triage. catastrophic = self_manage/contact_provider when truth is urgent/emergency.
- **Evals (node + session):** labeled acuity set (clinician-labeled where possible). *Deterministic:* confusion matrix; **primary = under-triage rate (~0);** secondary = accuracy; tertiary = over-triage rate. *Session:* acuity never below the monitor's `forcedAcuity`.
- **Guardrails:** conservative default (low confidence / no grounding -> escalate one level, min contact_provider); constrained to `candidateMappings` (no freelancing).
- **HITL:** any urgent/emergency surfaces immediately; offline review of **every** under-triage failure + a sample of correct traces.

## B3 — Grounding / citations
- **Definitions:** catastrophic = ungrounded clinical guidance.
- **Evals:** *deterministic* (>=1 citation; cited snippet exists in `grounding`) + *LLM-judge* faithfulness (rationale entailed by the snippet).
- **Guardrails:** no citation -> force contact_provider and say so; reject a rationale citing a snippet not in `grounding`.

## B4 — Policy gate
- **Definitions:** catastrophic = auto `advise_self_manage` on a red-flag case, or auto-booking without confirm.
- **Evals (deterministic):** each (action, context) mode equals the matrix; red-flag contexts -> `advise_self_manage` never `auto`.
- **Guardrails:** booking requires patient confirm (HITL); escalation never gated.

## B5 — FHIR validity (regulatory format)
- **Evals (deterministic):** every persisted resource validates against FHIR R4 (Observation, Condition, Appointment, Bundle, CoverageEligibilityResponse). ContextPacket references resolve; `Appointment.supportingInformation` links the packet.
- **Guardrails:** validate before persist; reject invalid resources rather than writing partial data.

## B6 — Stedi eligibility parsing (mock insurance)
- **Evals:** given a known sandbox 271, `MockCoverageSummary` fields (payer, plan, active, copays, in/out benefit levels) map correctly; `source: 'stedi_sandbox'`.
- **Guardrails:** approved mock members only; on Stedi error, return a clear "coverage unavailable" state — never fabricate coverage or block the triage. Coverage is display-only; it must never influence acuity.

## B7 — Mock providers + booking
- **Evals:** provider list filters to the recommended specialty; preferred-first ordering; `source: 'placeholder'` present. Booking: Appointment created, Slot marked busy, packet built + linked, `AppointmentResult` valid.
- **Guardrails:** providers clearly labeled mock; booking is the only side effect gated on patient confirm.

## Seam contract test (must pass to merge)
- Every `AnalyzeRequest` validated on entry; every `TriageOutcome`/`AppointmentResult` validated on exit. Reject + fail safe on violation.

## System-level
Latency p50/p95 of `/api/analyze`; token cost; the deterministic path adds no model loops.

## Test set + harness
Shared ~20-30 labeled transcripts (clean, borderline, clear/obfuscated red flags, ambiguous, off-topic); dev + withheld test. Regression harness on every change; **under-triage rate and red-flag recall are the ship gates.**
