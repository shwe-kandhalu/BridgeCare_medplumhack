import dotenv from 'dotenv';
import path from 'node:path';

// `next dev` runs from apps/voice, while the existing local integration
// credentials live in the repository root. Vercel supplies its own process
// environment, and dotenv never overrides those values.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

// Vercel keeps this module warm between requests when possible. Medplum remains
// the authoritative record of persisted observations, appointments, packets, and slots.
type PartB = typeof import('../../analysis/src/core');
type AnalyzerState = ReturnType<PartB['createAnalyzerState']>;

let partBPromise: Promise<PartB> | undefined;
let state: AnalyzerState | undefined;

async function getPartB(): Promise<PartB> {
  partBPromise ??= import('../../analysis/src/core');
  return partBPromise;
}

async function getState(): Promise<AnalyzerState> {
  const partB = await getPartB();
  state ??= partB.createAnalyzerState();
  return state;
}

export async function runPartBAnalysis(payload: unknown) {
  const [partB, analyzerState] = await Promise.all([getPartB(), getState()]);
  return partB.analyzeRequest(payload as never, analyzerState);
}

export async function runPartBBooking(payload: unknown) {
  const [partB, analyzerState] = await Promise.all([getPartB(), getState()]);
  return partB.bookAppointment(payload as never, analyzerState);
}
