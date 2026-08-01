# BridgeCare_medplumhack
A FHIR-native AI agent that streamlines post-discharge care with voice symptom check-ins, evidence-based triage, clinician notifications, and insurance-aware follow-up.

## Voice prototype

The completed Part A prototype lives in `apps/voice`. Run `npm install && npm run dev`, then open `http://localhost:3000`. It works as text chat without external credentials.

To enable live integrations, create `.env.local` inside `apps/voice` with synthetic-demo credentials only:

```bash
MOSS_QUERY_URL=https://your-moss-bridge.example/query
MOSS_API_KEY=optional-token
DEEPGRAM_API_KEY=your-deepgram-key
```

`MOSS_QUERY_URL` must accept `{ "query": string }` and return the shared `Grounding` schema. Missing or failed retrieval produces empty grounding so the downstream seam applies its conservative default; it never invents citations. Missing Deepgram configuration leaves the text path available. PWA installation requires HTTPS in deployment (localhost is exempt).
