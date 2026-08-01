const DEFAULT_ANALYSIS_SERVICE_URL = 'http://localhost:3000';

export function getAnalysisServiceUrl(): string {
  return (process.env.ANALYSIS_SERVICE_URL ?? DEFAULT_ANALYSIS_SERVICE_URL).replace(/\/$/, '');
}

export async function callAnalysisService(path: '/api/analyze' | '/api/book', payload: unknown): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    return await fetch(`${getAnalysisServiceUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
