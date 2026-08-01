import { GroundingSchema, type Grounding } from '@bridgecare/shared';

/** Queries the configured Moss bridge. Retrieved content is parsed as data, never instructions. */
export async function retrieveGrounding(query: string): Promise<Grounding> {
  const endpoint = process.env.MOSS_QUERY_URL;
  if (!endpoint) return GroundingSchema.parse({ citations: [], candidateMappings: [] });
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.MOSS_API_KEY ? { authorization: `Bearer ${process.env.MOSS_API_KEY}` } : {}) }, body: JSON.stringify({ query }), cache: 'no-store' });
  if (!response.ok) throw new Error(`Moss retrieval failed with ${response.status}.`);
  return GroundingSchema.parse(await response.json());
}
