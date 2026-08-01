import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRequest, bookAppointment, buildCoverageUnavailableSummary, buildGateDecision, createAnalyzerState, createSampleAnalyzeRequest, makeAnalysisCommunication, scoreTriage } from './core.js';
import { detectRedFlags } from '../../../packages/shared/redflags.js';
import { appointmentResultSchema, triageOutcomeSchema } from '../../../packages/shared/contracts.js';
import { appointmentResourceSchema, observationResourceSchema, validateBundle } from './fhir.js';
import { mapStediEligibilityResponse, STEDI_SANDBOX_ELIGIBILITY_REQUEST } from './stediClient.js';

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

test('analyze and book stay schema-valid', async () => {
  const state = createAnalyzerState();
  const request = createSampleAnalyzeRequest();
  const analyzeOutcome = await analyzeRequest(request, state);
  triageOutcomeSchema.parse(analyzeOutcome);

  const booking = await bookAppointment({ patientId: request.patientId, slotId: analyzeOutcome.appointmentOptions[0]!.slotId, specialty: 'rheumatology', reason: 'follow-up after triage' }, state);
  appointmentResultSchema.parse(booking);
});

test('booking requires a matching completed triage and returns specialty-matched slots', async () => {
  const state = createAnalyzerState();
  const request = createSampleAnalyzeRequest();
  await assert.rejects(
    () => bookAppointment({ patientId: request.patientId, slotId: 'c592246d-d566-4c59-a0cf-1f56879275b7', specialty: 'rheumatology', reason: 'follow-up' }, state),
    /matching appointment proposal/,
  );

  const outcome = await analyzeRequest(request, state);
  assert.ok(outcome.appointmentOptions.length > 0);
  assert.equal(outcome.appointmentOptions.length, 2);
});

test('completed analysis can be persisted as a FHIR Communication with the full result', () => {
  const request = createSampleAnalyzeRequest();
  const triage = scoreTriage(request);
  const communication = makeAnalysisCommunication({
    patientId: request.patientId,
    request,
    triage,
    insurance: buildCoverageUnavailableSummary(request.patientId),
    providers: [],
    appointmentOptions: [],
  });

  const stored = JSON.parse(communication.payload[0]!.contentString) as { transcript: unknown[]; triage: { acuity: string }; insurance: { active: boolean } };
  assert.equal(communication.subject.reference, `Patient/${request.patientId}`);
  assert.equal(stored.transcript.length, request.transcript.length);
  assert.equal(stored.triage.acuity, triage.acuity);
  assert.equal(stored.insurance.active, false);
});

test('detectRedFlags catches obvious emergencies', () => {
  const result = detectRedFlags('I have chest pain and I cannot breathe.');
  assert.equal(result.triggered, true);
  assert.equal(result.forcedAcuity, 'emergency');
});

test('stedi eligibility responses map into the mock coverage summary shape', () => {
  const summary = mapStediEligibilityResponse(
    {
      id: 'ec_550e8400-e29b-41d4-a716-446655440000',
      payer: { businessName: 'UnitedHealthcare' },
      planInformation: { planName: 'Choice Plus' },
      subscriber: { memberId: 'UHC202649' },
      planStatus: [{ statusCode: '1', status: 'Active Coverage', planDetails: 'Choice Plus' }],
      benefitsInformation: [
        {
          code: '30',
          serviceTypeCodes: ['30'],
          benefitAmount: { formatted: '$25' },
        },
        {
          code: '49',
          serviceTypeCodes: ['30'],
          benefitAmount: { formatted: '$500' },
        },
      ],
    },
    'fallback-member',
  );

  assert.equal(summary.payer, 'UnitedHealthcare');
  assert.equal(summary.planName, 'Choice Plus');
  assert.equal(summary.memberId, 'UHC202649');
  assert.equal(summary.source, 'stedi_sandbox');
  assert.ok(summary.copays.length > 0);
});

test('Stedi uses the documented synthetic test fixture, never the BridgeCare patient ID', () => {
  assert.equal(STEDI_SANDBOX_ELIGIBILITY_REQUEST.subscriber.memberId, 'UHC202649');
  assert.equal(STEDI_SANDBOX_ELIGIBILITY_REQUEST.subscriber.firstName, 'John');
  assert.equal(STEDI_SANDBOX_ELIGIBILITY_REQUEST.dependents[0]?.dateOfBirth, '19521121');
});

test('an unavailable Stedi result is explicit and never presents as active coverage', () => {
  const summary = buildCoverageUnavailableSummary('maya');
  assert.equal(summary.active, false);
  assert.equal(summary.payer, 'Coverage unavailable');
  assert.equal(summary.copays[0]?.inNetwork, 'coverage unavailable');
});
