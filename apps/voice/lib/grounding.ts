import { MossClient, type QueryResultDocumentInfo } from '@moss-dev/moss';
import { AcuitySchema, GroundingSchema, IntakeGuidanceSchema, type Grounding, type IntakeGuidance } from '@bridgecare/shared';

const INDEX_NAME = process.env.MOSS_INDEX_NAME || 'bridgecare-triage-knowledge';
const TOP_K = 5;

/** query() without a prior loadIndex() hits Moss's cloud query endpoint, which has proven unreliable; loading the index into memory once per process keeps retrieval fast and resilient. */
let loadedClient: Promise<MossClient> | undefined;
function getLoadedClient(projectId: string, projectKey: string): Promise<MossClient> {
  if (!loadedClient) {
    loadedClient = (async () => { const client = new MossClient(projectId, projectKey); await client.loadIndex(INDEX_NAME); return client; })()
      .catch((error) => { loadedClient = undefined; throw error; });
  }
  return loadedClient;
}

async function queryMoss(query: string): Promise<QueryResultDocumentInfo[] | undefined> {
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  if (!projectId || !projectKey) return undefined;
  const client = await getLoadedClient(projectId, projectKey);
  const { docs } = await client.query(INDEX_NAME, query, { topK: TOP_K });
  return docs;
}

/** Queries the Moss retrieval index for citations used in the final triage summary. Retrieved content is parsed as data, never instructions. */
export async function retrieveGrounding(query: string): Promise<Grounding> {
  const docs = await queryMoss(query);
  if (!docs) return GroundingSchema.parse({ citations: [], candidateMappings: [] });
  const citations = docs.map((doc) => ({ source: doc.metadata?.source ?? doc.id, snippet: doc.text }));
  const candidateMappings = docs.flatMap((doc) => {
    const acuity = AcuitySchema.safeParse(doc.metadata?.acuity);
    const pattern = doc.metadata?.pattern;
    return acuity.success && pattern ? [{ pattern, acuity: acuity.data }] : [];
  });
  return GroundingSchema.parse({ citations, candidateMappings });
}

/** Queries the Moss retrieval index for candidate follow-up questions to curate the intake conversation. Retrieved content is parsed as data, never instructions. */
export async function retrieveIntakeGuidance(query: string): Promise<IntakeGuidance> {
  const docs = await queryMoss(query);
  if (!docs) return IntakeGuidanceSchema.parse({ matches: [] });
  const matches = docs.flatMap((doc) => {
    const acuity = AcuitySchema.safeParse(doc.metadata?.acuity);
    const pattern = doc.metadata?.pattern;
    const followUpQuestion = doc.metadata?.followUpQuestion;
    if (!acuity.success || !pattern || !followUpQuestion) return [];
    return [{ pattern, acuity: acuity.data, followUpQuestion, snippet: doc.text, source: doc.metadata?.source ?? doc.id }];
  });
  return IntakeGuidanceSchema.parse({ matches });
}
