# BridgeCare_medplumhack
A FHIR-native AI agent that streamlines post-discharge care with voice symptom check-ins, evidence-based triage, clinician notifications, and insurance-aware follow-up.

## Voice prototype

The completed Part A prototype lives in `apps/voice`. Run `npm install && npm run dev`, then open `http://localhost:3000`. It works as text chat without external credentials.

To enable live integrations, create `.env.local` inside `apps/voice` with synthetic-demo credentials only:

```bash
MOSS_PROJECT_ID=your-moss-project-id
MOSS_PROJECT_KEY=your-moss-project-key
MOSS_INDEX_NAME=bridgecare-triage-knowledge
DEEPGRAM_API_KEY=your-deepgram-key
```

Retrieval is powered directly by [Moss](https://docs.moss.dev/docs) via the `@moss-dev/moss` SDK (see `apps/voice/lib/grounding.ts`): the patient's transcript is used as the query against a Moss index, and matching documents are mapped into the shared `Grounding` schema (`citations` from each document's text, `candidateMappings` from `pattern`/`acuity` metadata). Deepgram remains the voice layer — it transcribes patient speech to text (`/api/voice/transcribe`) and speaks the resulting, Moss-grounded triage outcome back to the patient (`/api/voice/speak`); Moss is never in the audio path itself.

Seed the index once with the synthetic RA knowledge base before testing live retrieval:

```bash
npm run moss:seed --workspace=@bridgecare/voice
```

Missing Moss configuration produces empty grounding so the downstream seam applies its conservative default; it never invents citations. Missing Deepgram configuration leaves the text path available. PWA installation requires HTTPS in deployment (localhost is exempt).
