import dotenv from 'dotenv';
import path from 'node:path';
import { analyzeRequest, bookAppointment, createAnalyzerState } from '../../analysis/src/core';

// `next dev` runs from apps/voice, while the existing local integration
// credentials live in the repository root. Vercel supplies its own process
// environment, and dotenv never overrides those values.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

// Vercel keeps this module warm between requests when possible. Medplum remains
// the authoritative record of persisted observations, appointments, packets, and slots.
const state = createAnalyzerState();

export async function runPartBAnalysis(payload: unknown) {
  return analyzeRequest(payload as never, state);
}

export async function runPartBBooking(payload: unknown) {
  return bookAppointment(payload as never, state);
}
