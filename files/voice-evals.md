# apps/voice/evals.md — Part A evals, guardrails, HITL

Governing principle (shared): **under-triage is catastrophic; over-triage is merely costly.** In this track that means: never let a red-flag utterance pass without interrupting, and never let extraction silently drop a critical symptom.

## Decision point A1 — Symptom extraction (LLM)
- **Definitions:** correct = all clinically-relevant symptoms + values captured. catastrophic = drops/misreads a red-flag symptom.
- **Evals (node):** labeled `transcript -> expected observations`. *Deterministic:* zod-valid; exact-match on numeric values; **recall on a red-flag-symptom list (~100%).** *LLM-judge:* captured all clinically-relevant content (validate judge vs human labels).
- **Guardrails:** structured-output validation (reject malformed, retry once, else fail safe to contact_provider); the shared `detectRedFlags` runs on **raw text** independent of extraction, so a missed extraction can't hide a red flag.
- **HITL:** offline review of every extraction miss on a red-flag case.

## Decision point A2 — Adaptive intake loop (the agentic step)
- **Definitions:** good = collects required fields in <= 6 relevant questions and terminates cleanly. bad = loops/never terminates, or keeps asking after a red flag. catastrophic = red flag mentioned mid-intake but the loop continues instead of interrupting.
- **Evals (session + system):** *Deterministic:* terminated within turn/time bounds; required fields collected; **planted mid-conversation red flag interrupts on that turn.** *LLM-judge:* question relevance / non-redundancy. *System:* turns, latency, tokens per session.
- **Guardrails:** circuit breaker (6 Q / 90s -> terminate to analyze with what's collected); red-flag interrupt every turn; question selection constrained to the required-fields checklist (no wandering).

## Decision point A3 — Local red-flag interrupt (shared module, run here)
- **Definitions:** correct = fires on every true red flag. catastrophic = a false negative.
- **Evals (deterministic):** the shared red-flag test set, run in the loop context; **recall on emergencies = 100%**, including obfuscated phrasings. (Authoritative recall is also graded in Part B; this checks the in-loop wiring.)
- **Guardrails:** runs pre-LLM every turn; interrupt cannot be suppressed by later turns.

## Decision point A4 — Moss retrieval quality
- **Definitions:** good = returns grounding that actually covers the reported symptoms. bad = empty/irrelevant grounding (forces Part B's conservative default, which is safe but blunt).
- **Evals:** retrieval relevance vs a labeled set (did the right candidateMappings/citations come back); latency p50/p95 within the voice budget.
- **Guardrails:** on empty/low-confidence retrieval, pass `grounding` through as-is and let Part B apply the conservative default — do not fabricate mappings.

## Decision point A5 — STT (voice)
- **Evals:** word-error-rate on a set of spoken symptom utterances, weighted on clinical terms and red-flag phrases; confirm red-flag phrases survive transcription.
- **Guardrails:** on low STT confidence for a turn, re-prompt ("could you say that again?") rather than guessing; keep the text fallback.

## Seam contract test (must pass to merge)
- Every `AnalyzeRequest` this track emits validates against the shared zod schema; every `TriageOutcome` it consumes is validated before rendering. Reject + fail safe on schema violation.

## System-level
Voice round-trip p50/p95 within budget; tokens/session; no loop wandering.

## Headline (this track): red-flag interrupt recall = 100%; extraction red-flag recall ~100%.
