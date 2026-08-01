import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { analyzeRequest, bookAppointment, createAnalyzerState, createSampleAnalyzeRequest } from './core.js';
import { analyzeRequestSchema, appointmentRequestSchema, appointmentResultSchema, triageOutcomeSchema } from '../../../packages/shared/contracts.js';

const state = createAnalyzerState();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(payload, null, 2));
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: 'Invalid request' });
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/analyze') {
      const body = await readRequestBody(request);
      const parsed = analyzeRequestSchema.parse(JSON.parse(body));
      const outcome = await analyzeRequest(parsed, state);
      sendJson(response, 200, triageOutcomeSchema.parse(outcome));
      return;
    }

    if (request.method === 'POST' && request.url === '/api/book') {
      const body = await readRequestBody(request);
      const parsed = appointmentRequestSchema.parse(JSON.parse(body));
      const result = await bookAppointment(parsed, state);
      sendJson(response, 200, appointmentResultSchema.parse(result));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/sample-analyze-request') {
      sendJson(response, 200, createSampleAnalyzeRequest());
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Analysis service listening on http://localhost:${port}`);
});
