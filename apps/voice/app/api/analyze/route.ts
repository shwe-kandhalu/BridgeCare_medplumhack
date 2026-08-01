import { NextResponse } from 'next/server';
import { AnalyzeRequestSchema, TriageOutcomeSchema, type TriageOutcome } from '@bridgecare/shared';
import { DISCLAIMER } from '../../../lib/intake';

const CITATION = { source: 'Synthetic prototype protocol', snippet: 'This demo routes symptoms to an appropriate care setting and does not diagnose.' };

function cannedOutcome(redFlagSignals: { triggered: boolean; matches: string[]; forcedAcuity?: 'urgent' | 'emergency' | undefined }): TriageOutcome {
  const acute = redFlagSignals.triggered;
  return TriageOutcomeSchema.parse({
    triage: {
      acuity: redFlagSignals.forcedAcuity ?? 'contact_provider',
      recommendedNextStep: acute ? (redFlagSignals.forcedAcuity === 'emergency' ? 'Call 911 or go to the nearest ER now.' : 'Seek same-day evaluation or call your provider today.') : 'Contact your care team in the next 1–2 days.',
      recommendedSpecialty: acute ? 'Emergency / urgent evaluation' : 'Rheumatology',
      rationale: acute ? 'A deterministic safety signal requires immediate escalation.' : 'Phase 1 synthetic routing outcome; a care team should review these symptoms.',
      citations: [CITATION], redFlagsTriggered: redFlagSignals.matches, confidence: acute ? 'high' : 'low', disclaimer: DISCLAIMER
    },
    gate: { actions: acute ? [{ action: { kind: redFlagSignals.forcedAcuity === 'emergency' ? 'escalate_emergency' : 'escalate_urgent' }, reversibility: 'low', impact: 'high', mode: 'block' }] : [{ action: { kind: 'propose_appointment', specialty: 'Rheumatology', reason: 'Synthetic prototype follow-up' }, reversibility: 'high', impact: 'low', mode: 'confirm' }] },
    insurance: { payer: 'Demo Health Plan (mock)', planName: 'Synthetic PPO', memberId: 'DEMO-0001', active: true, copays: [{ serviceType: 'Specialist visit', inNetwork: '$35' }], source: 'stedi_sandbox', raw271Ref: 'mock-271-phase-1' },
    providers: acute ? [] : [{ name: 'Dr. Avery Chen (mock)', specialty: 'Rheumatology', networkStatus: 'in_network', rating: 4.8, distanceMiles: 2.4, isPreferred: true, source: 'placeholder' }],
    appointmentOptions: acute ? [] : [{ slotId: 'mock-rheum-1', start: '2026-08-03T16:00:00.000Z', end: '2026-08-03T16:30:00.000Z', practitionerDisplay: 'Dr. Avery Chen (mock)' }],
    disclaimerShown: true
  });
}

export async function POST(request: Request) {
  try {
    const payload = AnalyzeRequestSchema.parse(await request.json());
    return NextResponse.json(cannedOutcome(payload.redFlagSignals));
  } catch (error) {
    console.error('Analyze request rejected:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid analyze request.' }, { status: 400 });
  }
}
