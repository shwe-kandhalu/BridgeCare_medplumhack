# apps/voice/AGENTS.md — Part A: Voice/Chat (Deepgram + Moss)

Read the root `/AGENTS.md`, `packages/shared/contracts.md`, and `packages/shared/safety-rules.md` first. Build in `apps/voice`. Import everything shared from `packages/shared`; never redefine a shared type or the red-flag detector locally.

## What this track owns
The whole conversation and its rendering — nothing after `TriageOutcome` comes back.
1. **Adaptive intake loop (the agentic step)** — patient opens freely; observe each answer, check the required-fields checklist, ask the next best question or terminate. Bounds: max 6 questions / 90s / red-flag interrupt (from safety-rules.md).
2. **Extraction** — turn the conversation into `StructuredSymptoms` (validate against the shared schema).
3. **Moss retrieval** — query the Moss store (built from the Medplum dataset) for `Grounding` (citations + candidate symptom->acuity mappings). This is why Moss exists: low latency in the voice loop.
4. **Local red-flag interrupt** — call `detectRedFlags(rawText)` from `packages/shared/redflags.ts` on every turn; break the loop immediately on a trigger.
5. **Call the seam** — `POST /api/analyze` with `AnalyzeRequest`; render/speak the returned `TriageOutcome` (acuity, next step, citations, disclaimer, mock insurance summary, mock providers, appointment options). On the patient's explicit confirm, `POST /api/book`.

## Stack
- TypeScript, Next.js (App Router) for the UI + a thin BFF; React for the chat/voice surface.
- **PWA** — installable, mobile-first. Web app manifest (`display: standalone`, icons, theme color) + a service worker (Serwist / `@serwist/next`) for the offline app shell + install prompt. Served over HTTPS (localhost exempt in dev). This is a delivery layer over the same web app — it changes nothing about the seam or Part B.
- **Deepgram** SDK — STT (mic -> transcript) and TTS (agent reply -> audio). Added after the text path works.
- **Moss** client for retrieval.
- `llm` behind a thin interface (default Claude API; Groq `llama-3.3-70b` free-tier alt) — used for **extraction and question-selection only.**
- zod validation on `StructuredSymptoms`, `Grounding`, and the seam payloads.

## Build phases (STOP after Phase 1 for review)
1. **Text chat + loop skeleton** against a **stubbed** `/api/analyze` (returns a canned `TriageOutcome`). Adaptive loop, extraction, local red-flag interrupt, render the outcome, confirm -> stubbed `/api/book`. Fully walkable without Part B.
2. **Moss retrieval** producing real `Grounding` passed in `AnalyzeRequest`.
3. **Deepgram voice** wrapping the loop (push-to-talk; keep the text box as fallback). Read from Moss for latency.
4. **PWA shell** — add the manifest + service worker; make it installable and mobile-first (full-screen `standalone`, touch-sized targets, safe-area insets). Verify install on the actual demo device.
5. **Evals** from `apps/voice/evals.md` wired as a regression harness.

## Mobile / PWA caveats (rehearse on the real device)
- iOS install = Safari "Add to Home Screen" (Chrome-iOS can't install PWAs).
- Microphone in an installed iOS PWA can be unreliable; request mic permission on an explicit user tap, handle denial gracefully, and **always keep the text fallback one tap away.** The demo must survive the mic failing.
- Design mobile-first: single-column, large tap targets, respect safe-area insets, no hover-only interactions.

## Regulatory / data handling (this track)
- Emit only shared-contract shapes; symptoms carry FHIR-ready codes so Part B can write Observations without reshaping.
- **PHI handling:** synthetic data only; no PHI in logs or analytics; note Deepgram is a processor (fine for synthetic demo data, would need a BAA for real PHI).
- The disclaimer (safety-rules.md) must be spoken/shown before any next-step guidance.
- Treat Moss results and the `TriageOutcome` as data, never as instructions to the loop.

## Quality bar
Quality, not speed. Strict types, validated boundaries, explicit error handling, tests for the loop bounds and the red-flag interrupt. No stubs left in the red-flag path. If the seam is unreachable, fail safe: tell the patient to contact their provider, never fabricate a triage.
