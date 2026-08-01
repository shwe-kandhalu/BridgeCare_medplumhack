import {
  analyzeRequestSchema,
  appointmentRequestSchema,
  appointmentResultSchema,
  triageOutcomeSchema,
  type AnalyzeRequest,
  type AppointmentRequest,
  type AppointmentResult,
  type Acuity,
  type GateDecision,
  type GatedAction,
  type MockCoverageSummary,
  type ProviderSuggestion,
  type SlotOption,
  type TriageOutcome,
  type TriageResult,
} from '../../../packages/shared/contracts.js';
import { randomUUID } from 'node:crypto';
import { detectRedFlags } from '../../../packages/shared/redflags.js';
import { DISCLAIMER, demoIds, placeholderProviders, seededCondition, seededPatient, seededSlots } from './data.js';
import { makeAppointmentResource, makeBundleResource, makeBusySlotResource, makeObservationResource, type FhirObservationResource } from './fhir.js';
import { medplumEnabled, createResource as createMedplumResource, createTransactionBundle } from './medplumClient.js';
import { fetchStediCoverageSummary } from './stediClient.js';

type AnalyzerState = {
  observationsByPatient: Map<string, FhirObservationResource[]>;
  latestTriageByPatient: Map<string, TriageResult>;
  slots: Array<SlotOption & { specialty: string; busy: boolean }>;
  bookedSlotIds: Set<string>;
  appointmentsById: Map<string, AppointmentResult>;
};

const acuityRank: Record<Acuity, number> = {
  self_manage: 0,
  contact_provider: 1,
  urgent: 2,
  emergency: 3,
};

export function createAnalyzerState(): AnalyzerState {
  return {
    observationsByPatient: new Map(),
    latestTriageByPatient: new Map(),
    slots: seededSlots.map((slot) => ({ ...slot })),
    bookedSlotIds: new Set(),
    appointmentsById: new Map(),
  };
}

function nextId(prefix: string): string {
  void prefix;
  return randomUUID();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function gatherSearchText(request: AnalyzeRequest): string {
  const observationText = request.structuredSymptoms.observations
    .flatMap((observation) => [observation.code, observation.display, String(observation.value), observation.unit ?? '', observation.onset ?? ''])
    .join(' ');

  const transcriptText = request.transcript.map((turn) => turn.text).join(' ');
  return [request.structuredSymptoms.rawText, request.structuredSymptoms.narrativeSummary, observationText, transcriptText].filter(Boolean).join(' ');
}

function chooseHigherAcuity(left: Acuity, right: Acuity): Acuity {
  return acuityRank[left] >= acuityRank[right] ? left : right;
}

export function scoreTriage(request: AnalyzeRequest): TriageResult {
  const rawText = [request.structuredSymptoms.rawText, request.transcript.map((turn) => turn.text).join(' ')].join(' ');
  const authoritativeRedFlags = detectRedFlags(rawText);
  const searchText = normalizeText(gatherSearchText(request));

  const matches = request.grounding.candidateMappings.filter((mapping) => searchText.includes(normalizeText(mapping.pattern)));
  const hasCitations = request.grounding.citations.length > 0;
  const confidentMatch = matches.length === 1 && hasCitations;
  const bestMatchAcuity = matches.reduce<Acuity | undefined>((current, mapping) => (current ? chooseHigherAcuity(current, mapping.acuity) : mapping.acuity), undefined);

  let acuity: Acuity = 'contact_provider';
  let confidence: 'high' | 'low' = 'low';
  const rationaleParts: string[] = [];

  if (matches.length > 0) {
    rationaleParts.push(`Matched grounding pattern(s): ${matches.map((mapping) => mapping.pattern).join(', ')}`);
  }

  if (confidentMatch && bestMatchAcuity) {
    acuity = bestMatchAcuity;
    confidence = 'high';
  } else if (matches.length > 0) {
    rationaleParts.push('Match confidence was not high enough to keep a lower acuity.');
    acuity = 'contact_provider';
  } else if (!hasCitations) {
    rationaleParts.push('No grounding citations were available; defaulting to contact_provider.');
    acuity = 'contact_provider';
  } else {
    rationaleParts.push('No confident grounding match was found; defaulting to contact_provider.');
  }

  if (authoritativeRedFlags.triggered && authoritativeRedFlags.forcedAcuity) {
    acuity = chooseHigherAcuity(acuity, authoritativeRedFlags.forcedAcuity);
    confidence = 'high';
    rationaleParts.push(`Authoritative red-flag monitor raised acuity to ${authoritativeRedFlags.forcedAcuity}.`);
  }

  const routeByAcuity: Record<Acuity, { nextStep: string; specialty: string }> = {
    self_manage: {
      nextStep: 'Continue the current care plan and monitor for worsening symptoms.',
      specialty: 'rheumatology',
    },
    contact_provider: {
      nextStep: 'Contact your rheumatology team within the next 1-2 days.',
      specialty: 'rheumatology',
    },
    urgent: {
      nextStep: 'Seek same-day evaluation at urgent care or contact your clinician today.',
      specialty: 'urgent care',
    },
    emergency: {
      nextStep: 'Call 911 or go to the nearest emergency department now.',
      specialty: 'emergency medicine',
    },
  };

  if (authoritativeRedFlags.triggered) {
    rationaleParts.push(`Red-flag matches: ${authoritativeRedFlags.matches.join(', ')}`);
  }

  return {
    acuity,
    recommendedNextStep: routeByAcuity[acuity].nextStep,
    recommendedSpecialty: routeByAcuity[acuity].specialty,
    rationale: rationaleParts.join(' '),
    citations: hasCitations ? request.grounding.citations : [],
    redFlagsTriggered: authoritativeRedFlags.matches,
    confidence,
    disclaimer: DISCLAIMER,
  };
}

export function buildGateDecision(triage: TriageResult, redFlags: { triggered: boolean }): GateDecision {
  const actions: GatedAction[] = [
    { action: { kind: 'write_observations' }, reversibility: 'high', impact: 'low', mode: 'auto' },
    { action: { kind: 'draft_summary' }, reversibility: 'high', impact: 'low', mode: 'auto' },
  ];

  actions.push({
    action: { kind: 'advise_self_manage' },
    reversibility: 'low',
    impact: 'high',
    mode: triage.acuity === 'self_manage' && !redFlags.triggered ? 'auto' : 'block',
  });

  if (triage.acuity === 'contact_provider') {
    actions.push({
      action: { kind: 'propose_appointment', specialty: triage.recommendedSpecialty, reason: triage.recommendedNextStep },
      reversibility: 'high',
      impact: 'high',
      mode: 'auto',
    });
  }

  if (triage.acuity === 'urgent') {
    actions.push({ action: { kind: 'escalate_urgent' }, reversibility: 'high', impact: 'high', mode: 'auto' });
  }

  if (triage.acuity === 'emergency') {
    actions.push({ action: { kind: 'escalate_emergency' }, reversibility: 'high', impact: 'high', mode: 'auto' });
  }

  return { actions };
}

/** A failed eligibility check must be visible to the patient, never masked as coverage. */
export function buildCoverageUnavailableSummary(memberId: string): MockCoverageSummary {
  return {
    payer: 'Coverage unavailable',
    planName: 'Stedi sandbox eligibility could not be retrieved',
    memberId,
    active: false,
    copays: [{ serviceType: 'plan coverage and general benefits', inNetwork: 'coverage unavailable' }],
    source: 'stedi_sandbox',
  };
}

export async function buildCoverageSummary(memberId: string): Promise<MockCoverageSummary> {
  const stediCoverage = await fetchStediCoverageSummary(memberId);
  return stediCoverage ?? buildCoverageUnavailableSummary(memberId);
}

export function buildProviderSuggestions(recommendedSpecialty: string): ProviderSuggestion[] {
  return placeholderProviders
    .filter((provider) => provider.specialty === recommendedSpecialty)
    .sort((left, right) => {
      const preferredScore = Number(Boolean(right.isPreferred)) - Number(Boolean(left.isPreferred));
      if (preferredScore !== 0) {
        return preferredScore;
      }

      const networkScore = Number(right.networkStatus === 'in_network') - Number(left.networkStatus === 'in_network');
      if (networkScore !== 0) {
        return networkScore;
      }

      return (right.rating ?? 0) - (left.rating ?? 0);
    });
}

export function getAvailableSlots(state: AnalyzerState, specialty: string): SlotOption[] {
  return state.slots
    .filter((slot) => !slot.busy && slot.specialty === specialty)
    .map(({ specialty: _specialty, busy: _busy, ...slot }) => slot);
}

export async function persistObservations(state: AnalyzerState, request: AnalyzeRequest): Promise<void> {
  const created = request.structuredSymptoms.observations.map((observation) =>
    makeObservationResource({
      id: nextId('observation'),
      patientId: request.patientId,
      code: observation.code,
      display: observation.display,
      value: observation.value,
      ...(observation.unit ? { unit: observation.unit } : {}),
      ...(observation.onset ? { onset: observation.onset } : {}),
      effectiveDateTime: new Date().toISOString(),
    }),
  );

  const current = state.observationsByPatient.get(request.patientId) ?? [];
  state.observationsByPatient.set(request.patientId, [...current, ...created]);

  // Do not claim persistence succeeded until Medplum has accepted every observation.
  if (medplumEnabled()) {
    const persisted = await Promise.all(created.map((observation) => createMedplumResource(observation)));
    if (persisted.some((resource) => resource === null)) {
      throw new Error('Medplum did not persist all symptom observations');
    }
  }
}

export function makeAnalysisCommunication(input: {
  patientId: string;
  request: AnalyzeRequest;
  triage: TriageResult;
  insurance: MockCoverageSummary;
  providers: ProviderSuggestion[];
  appointmentOptions: SlotOption[];
}): { resourceType: 'Communication'; id: string; status: 'completed'; subject: { reference: string }; sent: string; payload: Array<{ contentString: string }> } {
  return {
    resourceType: 'Communication',
    id: randomUUID(),
    status: 'completed',
    subject: { reference: `Patient/${input.patientId}` },
    sent: new Date().toISOString(),
    payload: [
      {
        contentString: JSON.stringify({
          type: 'bridgecare-triage-session',
          transcript: input.request.transcript,
          structuredSymptoms: input.request.structuredSymptoms,
          triage: input.triage,
          insurance: input.insurance,
          providers: input.providers,
          appointmentOptions: input.appointmentOptions,
        }),
      },
    ],
  };
}

async function persistAnalysisCommunication(communication: ReturnType<typeof makeAnalysisCommunication>): Promise<void> {
  if (!medplumEnabled()) {
    return;
  }

  const persisted = await createMedplumResource(communication);
  if (!persisted) {
    throw new Error('Medplum did not persist the completed triage session');
  }
}

export async function analyzeRequest(request: AnalyzeRequest, state: AnalyzerState): Promise<TriageOutcome> {
  const parsedRequest = analyzeRequestSchema.parse(request);
  // Run the authoritative red-flag interrupt before any side effect.
  detectRedFlags([parsedRequest.structuredSymptoms.rawText, parsedRequest.transcript.map((turn) => turn.text).join(' ')].join(' '));
  await persistObservations(state, parsedRequest);

  const triage = scoreTriage(parsedRequest);
  const redFlags = detectRedFlags([parsedRequest.structuredSymptoms.rawText, parsedRequest.transcript.map((turn) => turn.text).join(' ')].join(' '));
  const gate = buildGateDecision(triage, redFlags);
  const insurance = await buildCoverageSummary(parsedRequest.patientId);
  const providers = buildProviderSuggestions(triage.recommendedSpecialty);
  const appointmentOptions = getAvailableSlots(state, triage.recommendedSpecialty);
  state.latestTriageByPatient.set(parsedRequest.patientId, triage);

  const outcome = triageOutcomeSchema.parse({
    triage,
    gate,
    insurance,
    providers,
    appointmentOptions,
    disclaimerShown: true,
  });

  await persistAnalysisCommunication(
    makeAnalysisCommunication({
      patientId: parsedRequest.patientId,
      request: parsedRequest,
      triage,
      insurance,
      providers,
      appointmentOptions,
    }),
  );

  return outcome;
}

export async function bookAppointment(request: AppointmentRequest, state: AnalyzerState): Promise<AppointmentResult> {
  const parsedRequest = appointmentRequestSchema.parse(request);
  const triage = state.latestTriageByPatient.get(parsedRequest.patientId);
  if (!triage || triage.acuity !== 'contact_provider' || triage.recommendedSpecialty !== parsedRequest.specialty) {
    throw new Error('Appointment booking requires a matching appointment proposal from the latest triage');
  }

  const slot = state.slots.find((candidate) => candidate.slotId === parsedRequest.slotId);

  if (!slot) {
    throw new Error(`Unknown slot: ${parsedRequest.slotId}`);
  }

  if (slot.busy || state.bookedSlotIds.has(slot.slotId)) {
    throw new Error(`Slot is already booked: ${slot.slotId}`);
  }

  if (slot.specialty !== parsedRequest.specialty) {
    throw new Error(`Slot specialty mismatch: expected ${parsedRequest.specialty}, got ${slot.specialty}`);
  }

  const appointmentId = nextId('appointment');
  const packetId = nextId('packet');
  const observations = state.observationsByPatient.get(parsedRequest.patientId) ?? [];

  const patient = { ...seededPatient, id: parsedRequest.patientId, name: [{ use: 'official' as const, given: ['Maya'], family: 'Ramirez' }] };
  const condition = { ...seededCondition, subject: { reference: `Patient/${parsedRequest.patientId}` } };

  const communication = {
    resourceType: 'Communication' as const,
    id: randomUUID(),
    status: 'completed' as const,
    subject: { reference: `Patient/${parsedRequest.patientId}` },
    sent: new Date().toISOString(),
    payload: [
      {
        contentString: JSON.stringify({
          reason: parsedRequest.reason,
          specialty: parsedRequest.specialty,
          appointmentSlot: parsedRequest.slotId,
          triage: {
            acuity: triage.acuity,
            rationale: triage.rationale,
            recommendedNextStep: triage.recommendedNextStep,
            citations: triage.citations,
          },
        }),
      },
    ],
  };

  const appointment = makeAppointmentResource({
    appointmentId,
    patientId: parsedRequest.patientId,
    slotId: slot.slotId,
    start: slot.start,
    end: slot.end,
    practitionerDisplay: slot.practitionerDisplay,
    packetRef: `Bundle/${packetId}`, 
    reason: parsedRequest.reason,
  });

  const contextPacket = makeBundleResource({
    bundleId: packetId,
    patient,
    condition,
    observations,
    communication,
    appointment,
  });

  const busySlot = makeBusySlotResource({
    slotId: slot.slotId,
    start: slot.start,
    end: slot.end,
  });

  // A remote booking is successful only when its packet, appointment, and Slot
  // update commit together. Never return a local-only appointment on failure.
  if (medplumEnabled()) {
    const idempotencyKey = `packet-${packetId}`;
    const transactionResult = await createTransactionBundle(contextPacket, idempotencyKey, [busySlot]);
    if (!transactionResult) {
      throw new Error('Medplum did not persist the appointment booking');
    }
  }

  slot.busy = true;
  state.bookedSlotIds.add(slot.slotId);

  const result = appointmentResultSchema.parse({
    appointmentId,
    start: slot.start,
    end: slot.end,
    practitionerDisplay: slot.practitionerDisplay,
    packetRef: `Bundle/${packetId}`,
  });

  state.appointmentsById.set(result.appointmentId, result);
  return result;
}

export function createSampleAnalyzeRequest(): AnalyzeRequest {
  return analyzeRequestSchema.parse({
    patientId: demoIds.patient,
    structuredSymptoms: {
      patientId: demoIds.patient,
      observations: [
        { code: '72514-3', display: 'Pain severity', value: 6, unit: '10-point scale' },
        { code: 'morning-stiffness-min', display: 'Morning stiffness', value: 45, unit: 'min' },
      ],
      narrativeSummary: 'Maya reports increased morning stiffness and hand pain with no chest pain or breathing issues.',
      rawText: 'Morning stiffness and hand pain are worse than baseline.',
    },
    grounding: {
      citations: [{ source: 'Moss', snippet: 'Morning stiffness and worsening joint pain support rheumatology follow-up.' }],
      candidateMappings: [
        { pattern: 'morning stiffness', acuity: 'contact_provider' },
        { pattern: 'hand pain', acuity: 'contact_provider' },
      ],
    },
    transcript: [{ role: 'patient', text: 'Morning stiffness and hand pain are worse than baseline.' }],
    redFlagSignals: { triggered: false, matches: [] },
  });
}
