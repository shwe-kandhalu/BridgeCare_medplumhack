/* Lightweight Medplum client wrapper.
   Usage: set MEDPLUM_ENABLED=true and either:
   - provide a bearer token in MEDPLUM_BEARER_TOKEN / MEDPLUM_ACCESS_TOKEN, or
   - provide MEDPLUM_CLIENT_ID + MEDPLUM_CLIENT_SECRET (or MEDPLUM_TOKEN as a legacy secret fallback)
   This module uses direct fetch calls and OAuth client-credentials exchange.
*/
type AnyResource = Record<string, unknown>;

import {
  MEDPLUM_BASE_URL,
  MEDPLUM_ENABLED,
  getMedplumBearerToken,
  getMedplumClientId,
  getMedplumClientSecret,
  getMedplumFhirBaseUrl,
  getMedplumTokenEndpoint,
  makeIdempotencyKey,
} from './medplumConfig.js';
import { validateBundle, validateFhirResource } from './fhir.js';

type OAuthTokenResponse = {
  token_type?: string;
  access_token?: string;
  expires_in?: number;
};

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

export function medplumEnabled(): boolean {
  return MEDPLUM_ENABLED;
}

async function getAccessToken(): Promise<string | null> {
  const bearerToken = getMedplumBearerToken();
  if (bearerToken) {
    return bearerToken;
  }

  const clientId = getMedplumClientId();
  const clientSecret = getMedplumClientSecret();
  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(getMedplumTokenEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    // eslint-disable-next-line no-console
    console.error('Medplum token exchange failed', response.status, text);
    return null;
  }

  const tokenResponse = (await response.json()) as OAuthTokenResponse;
  if (!tokenResponse.access_token) {
    // eslint-disable-next-line no-console
    console.error('Medplum token exchange returned no access_token');
    return null;
  }

  const expiresInMs = Math.max(0, (tokenResponse.expires_in ?? 3600) * 1000);
  cachedAccessToken = tokenResponse.access_token;
  cachedAccessTokenExpiresAt = Date.now() + expiresInMs;
  return cachedAccessToken;
}

async function getMedplumHeaders(): Promise<Record<string, string> | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  return {
    'content-type': 'application/fhir+json',
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function createResource(resource: AnyResource): Promise<AnyResource | null> {
  if (!medplumEnabled()) return null;

  try {
    const resourceType = String(resource.resourceType ?? '');
    validateFhirResource(resource);
    const resourceId = typeof resource.id === 'string' ? resource.id : '';
    const url = resourceId ? `${getMedplumFhirBaseUrl(MEDPLUM_BASE_URL)}/${resourceType}/${resourceId}` : `${getMedplumFhirBaseUrl(MEDPLUM_BASE_URL)}/${resourceType}`;
    const headers = await getMedplumHeaders();
    if (!headers) {
      return null;
    }

    let res = await fetch(url, { method: resourceId ? 'PUT' : 'POST', headers, body: JSON.stringify(resource) });
    // Medplum creates server-assigned IDs. A client-chosen ID may be valid FHIR
    // but unavailable for a first PUT, so create the resource instead.
    if (resourceId && res.status === 404) {
      const { id: _id, ...resourceForCreate } = resource;
      res = await fetch(`${getMedplumFhirBaseUrl(MEDPLUM_BASE_URL)}/${resourceType}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(resourceForCreate),
      });
    }
    if (!res.ok) {
      const text = await res.text();
      // eslint-disable-next-line no-console
      console.error('Medplum createResource failed', res.status, text);
      return null;
    }

    return (await res.json()) as AnyResource;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Medplum createResource error:', (e as Error).message ?? e);
    return null;
  }
}

export async function createResources(resources: AnyResource[]): Promise<(AnyResource | null)[]> {
  const results: (AnyResource | null)[] = [];
  for (const r of resources) {
    // create sequentially to avoid overwhelming remote API for small seed runs
    // eslint-disable-next-line no-await-in-loop
    results.push(await createResource(r));
  }
  return results;
}

// Create a FHIR transaction bundle by POSTing to the Medplum FHIR endpoint.
export async function createTransactionBundle(bundle: AnyResource, idempotencyKey?: string, additionalResources: AnyResource[] = []): Promise<AnyResource | null> {
  if (!medplumEnabled()) return null;

  try {
    // Validate bundle locally using our FHIR validators (throws on invalid)
    validateBundle(bundle);
    for (const resource of additionalResources) {
      validateFhirResource(resource);
    }

    const resources = [bundle, ...(bundle.entry as Array<{ resource: AnyResource }>).map((entry) => entry.resource), ...additionalResources];

    // Persist the context packet itself as well as its referenced resources.
    const transaction = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: resources.map((resource) => ({
        resource,
        request: { method: 'PUT', url: `${resource.resourceType}/${resource.id}` },
      })),
    };

    const url = getMedplumFhirBaseUrl(MEDPLUM_BASE_URL);
    const authHeaders = await getMedplumHeaders();
    if (!authHeaders) {
      return null;
    }

    const headers: Record<string, string> = {
      ...authHeaders,
    };
    headers['x-idempotency-key'] = idempotencyKey ?? makeIdempotencyKey('tx');

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(transaction) });
    if (!res.ok) {
      const text = await res.text();
      // eslint-disable-next-line no-console
      console.error('Medplum transaction failed', res.status, text);
      return null;
    }

    const json = await res.json();
    return json as AnyResource;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('createTransactionBundle error:', (e as Error).message ?? e);
    return null;
  }
}
