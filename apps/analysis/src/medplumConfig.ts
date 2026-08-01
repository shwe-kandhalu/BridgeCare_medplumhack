export const MEDPLUM_ENABLED = process.env.MEDPLUM_ENABLED === 'true';
export const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com';
export const MEDPLUM_TOKEN = process.env.MEDPLUM_TOKEN ?? '';
export const MEDPLUM_ACCESS_TOKEN = process.env.MEDPLUM_ACCESS_TOKEN ?? process.env.MEDPLUM_BEARER_TOKEN ?? '';
export const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID ?? '';
export const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET ?? '';
export const MEDPLUM_TOKEN_ENDPOINT = process.env.MEDPLUM_TOKEN_ENDPOINT ?? '';

export function getMedplumApiBaseUrl(baseUrl: string = MEDPLUM_BASE_URL): string {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith('/fhir/R4') ? normalized.slice(0, -'/fhir/R4'.length) : normalized;
}

export function getMedplumFhirBaseUrl(baseUrl: string = MEDPLUM_BASE_URL): string {
  return `${getMedplumApiBaseUrl(baseUrl)}/fhir/R4`;
}

export function getMedplumTokenEndpoint(baseUrl: string = MEDPLUM_BASE_URL): string {
  if (MEDPLUM_TOKEN_ENDPOINT) {
    return MEDPLUM_TOKEN_ENDPOINT;
  }

  return `${getMedplumApiBaseUrl(baseUrl)}/oauth2/token`;
}

export function getMedplumClientId(): string {
  return MEDPLUM_CLIENT_ID;
}

export function getMedplumClientSecret(): string {
  if (MEDPLUM_CLIENT_SECRET) {
    return MEDPLUM_CLIENT_SECRET;
  }

  // Backwards-compatible fallback: if client credentials flow is enabled, treat MEDPLUM_TOKEN as the client secret.
  if (MEDPLUM_CLIENT_ID && MEDPLUM_TOKEN) {
    return MEDPLUM_TOKEN;
  }

  return '';
}

export function getMedplumBearerToken(): string {
  return MEDPLUM_ACCESS_TOKEN;
}

export function makeIdempotencyKey(prefix = 'medplum'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
