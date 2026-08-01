import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRequest, bookAppointment, buildGateDecision, createAnalyzerState, createSampleAnalyzeRequest, scoreTriage } from './core.js';
import { detectRedFlags } from '../../../packages/shared/redflags.js';
import { appointmentResultSchema, triageOutcomeSchema } from '../../../packages/shared/contracts.js';
import { appointmentResourceSchema, observationResourceSchema, validateBundle } from './fhir.js';

test('classifier cost matrix keeps conservative default', () => {
  const request = createSampleAnalyzeRequest();
  request.grounding.candidateMappings = [{ pattern: 'nonspecific', acuity: 'self_manage' }];

  const triage = scoreTriage(request);
  assert.equal(triage.acuity, 'contact_provider');
  assert.equal(triage.confidence, 'low');
});

test('red flags raise acuity above the grounding path', () => {
  const request = createSampleAnalyzeRequest();
  request.structuredSymptoms.rawText = 'I have chest pressure and trouble breathing.';
  request.transcript = [{ role: 'patient', text: 'I have chest pressure and trouble breathing.' }];

  const triage = scoreTriage(request);
  assert.equal(triage.acuity, 'emergency');
  assert.ok(triage.redFlagsTriggered.length > 0);
});

test('gate matrix blocks self-manage advice when red flags are present', () => {
  const gate = buildGateDecision(
    {
      acuity: 'self_manage',
      recommendedNextStep: 'Continue',
      recommendedSpecialty: 'rheumatology',
      rationale: 'x',
      citations: [{ source: 'Moss', snippet: 'x' }],
      redFlagsTriggered: ['chest pain'],
      confidence: 'high',
      disclaimer: 'disclaimer',
    },
    { triggered: true },
  );

  const selfManageAction = gate.actions.find((action) => action.action.kind === 'advise_self_manage');
  assert.ok(selfManageAction);
  assert.equal(selfManageAction?.mode, 'block');
});

test('FHIR bundle validation accepts the deterministic packet', () => {
  const observation = observationResourceSchema.parse({
    resourceType: 'Observation',
    id: 'obs-1',
    status: 'final',
    code: { text: 'Pain severity' },
    subject: { reference: 'Patient/maya' },
    effectiveDateTime: '2026-08-01T00:00:00Z',
    valueQuantity: { value: 6, unit: '10-point scale' },
  });

  const appointment = appointmentResourceSchema.parse({
    resourceType: 'Appointment',
    id: 'appointment-1',
    status: 'booked',
    start: '2026-08-03T14:00:00Z',
    end: '2026-08-03T14:30:00Z',
    slot: [{ reference: 'Slot/slot-1' }],
    participant: [{ actor: { reference: 'Patient/maya' }, status: 'accepted' }],
    supportingInformation: [{ reference: 'Bundle/packet-1' }],
  });

  const bundle = validateBundle({
    resourceType: 'Bundle',
    id: 'packet-1',
    type: 'collection',
    entry: [
      { fullUrl: 'urn:uuid:patient-1', resource: { resourceType: 'Patient', id: 'maya' } },
      { fullUrl: 'urn:uuid:condition-1', resource: { resourceType: 'Condition', id: 'ra', code: { text: 'Rheumatoid arthritis' }, subject: { reference: 'Patient/maya' } } },
      { fullUrl: 'urn:uuid:obs-1', resource: observation },
      { fullUrl: 'urn:uuid:appointment-1', resource: appointment },
      {
        fullUrl: 'urn:uuid:communication-1',
        resource: {
          resourceType: 'Communication',
          id: 'communication-1',
          status: 'completed',
          subject: { reference: 'Patient/maya' },
          sent: '2026-08-01T00:00:00Z',
          payload: [{ contentString: 'Context packet' }],
        },
      },
    ],
  });

  assert.equal(bundle.entry.length, 5);
});

test('analyze and book stay schema-valid', () => {
  const state = createAnalyzerState();
  const analyzeOutcome = analyzeRequest(createSampleAnalyzeRequest(), state);
  triageOutcomeSchema.parse(analyzeOutcome);

  const booking = bookAppointment({ patientId: 'maya', slotId: 'slot-001', specialty: 'rheumatology', reason: 'follow-up after triage' }, state);
  appointmentResultSchema.parse(booking);
});

test('detectRedFlags catches obvious emergencies', () => {
  const result = detectRedFlags('I have chest pain and I cannot breathe.');
  assert.equal(result.triggered, true);
  assert.equal(result.forcedAcuity, 'emergency');
});
