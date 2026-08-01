import { analyzeRequest, bookAppointment, createAnalyzerState } from '../../analysis/src/core';

// Vercel keeps this module warm between requests when possible. Medplum remains
// the authoritative record of persisted observations, appointments, packets, and slots.
const state = createAnalyzerState();

export async function runPartBAnalysis(payload: unknown) {
  return analyzeRequest(payload as never, state);
}

export async function runPartBBooking(payload: unknown) {
  return bookAppointment(payload as never, state);
}
