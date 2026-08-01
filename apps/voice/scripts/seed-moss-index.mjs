#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MossClient } from '@moss-dev/moss';

const projectId = process.env.MOSS_PROJECT_ID;
const projectKey = process.env.MOSS_PROJECT_KEY;
if (!projectId || !projectKey) {
  console.error('Set MOSS_PROJECT_ID and MOSS_PROJECT_KEY (e.g. in apps/voice/.env.local) before seeding.');
  process.exit(1);
}

const indexName = process.env.MOSS_INDEX_NAME || 'bridgecare-triage-knowledge';
const here = path.dirname(fileURLToPath(import.meta.url));
const docs = JSON.parse(await readFile(path.join(here, '../../../files/ra-grounding.json'), 'utf8'));

const client = new MossClient(projectId, projectKey);
try {
  await client.getIndex(indexName);
  console.log(`Index "${indexName}" already exists; deleting to re-seed with current documents.`);
  await client.deleteIndex(indexName);
} catch {
  // No existing index to delete.
}
await client.createIndex(indexName, docs, {
  onProgress: (progress) => console.log(`Indexing ${indexName}:`, progress)
});
console.log(`Seeded Moss index "${indexName}" with ${docs.length} documents.`);
