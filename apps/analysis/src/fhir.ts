import { z } from 'zod';

const referenceSchema = z.object({ reference: z.string().min(1) });
const codeableConceptSchema = z.object({
  coding: z.array(z.object({ system: z.string().optional(), code: z.string().optional(), display: z.string().optional() })).optional(),
  text: z.string().optional(),
});

export const observationResourceSchema = z.object({
  resourceType: z.literal('Observation'),
  id: z.string().min(1),
  status: z.enum(['registered', 'preliminary', 'final', 'amended']),
  code: codeableConceptSchema,
  subject: referenceSchema,
  effectiveDateTime: z.string().min(1),
  valueQuantity: z.object({ value: z.number(), unit: z.string().optional(), system: z.string().optional(), code: z.string().optional() }).optional(),
  valueString: z.string().optional(),
});

export const patientResourceSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string().min(1),
  active: z.boolean().optional(),
  name: z.array(z.object({ use: z.string().optional(), given: z.array(z.string()).optional(), family: z.string().optional() })).optional(),
});

export const conditionResourceSchema = z.object({
  resourceType: z.literal('Condition'),
  id: z.string().min(1),
  clinicalStatus: codeableConceptSchema.optional(),
  code: codeableConceptSchema,
  subject: referenceSchema,
});

export const communicationResourceSchema = z.object({
  resourceType: z.literal('Communication'),
  id: z.string().min(1),
  status: z.literal('completed'),
  subject: referenceSchema,
  sent: z.string().min(1),
  payload: z.array(z.object({ contentString: z.string().min(1) })),
});

export const appointmentResourceSchema = z.object({
  resourceType: z.literal('Appointment'),
  id: z.string().min(1),
  status: z.literal('booked'),
  start: z.string().min(1),
  end: z.string().min(1),
  slot: z.array(referenceSchema).min(1),
  participant: z.array(z.object({ actor: referenceSchema, status: z.literal('accepted') })).min(1),
  supportingInformation: z.array(referenceSchema).optional(),
  description: z.string().min(1).optional(),
});

export const slotResourceSchema = z.object({
  resourceType: z.literal('Slot'),
  id: z.string().min(1),
  schedule: referenceSchema,
  start: z.string().min(1),
  end: z.string().min(1),
  status: z.enum(['busy', 'free', 'busy-unavailable', 'busy-tentative', 'entered-in-error']),
});

export const practitionerResourceSchema = z.object({
  resourceType: z.literal('Practitioner'),
  id: z.string().min(1),
  name: z.array(z.object({ family: z.string().optional(), given: z.array(z.string()).optional() })).optional(),
});

export const scheduleResourceSchema = z.object({
  resourceType: z.literal('Schedule'),
  id: z.string().min(1),
  actor: z.array(referenceSchema).min(1),
});

export const bundleEntrySchema = z.object({
  fullUrl: z.string().min(1).optional(),
  resource: z.unknown(),
});

export const bundleResourceSchema = z.object({
  resourceType: z.literal('Bundle'),
  id: z.string().min(1),
  type: z.literal('collection'),
  entry: z.array(bundleEntrySchema).min(1),
});

export type FhirObservationResource = z.infer<typeof observationResourceSchema>;
export type FhirPatientResource = z.infer<typeof patientResourceSchema>;
export type FhirConditionResource = z.infer<typeof conditionResourceSchema>;
export type FhirCommunicationResource = z.infer<typeof communicationResourceSchema>;
export type FhirAppointmentResource = z.infer<typeof appointmentResourceSchema>;
export type FhirSlotResource = z.infer<typeof slotResourceSchema>;
export type FhirPractitionerResource = z.infer<typeof practitionerResourceSchema>;
export type FhirScheduleResource = z.infer<typeof scheduleResourceSchema>;
export type FhirBundleResource = z.infer<typeof bundleResourceSchema>;

export function validateFhirResource(resource: unknown): void {
  if (!resource || typeof resource !== 'object' || !('resourceType' in resource)) {
    throw new Error('FHIR resource missing resourceType');
  }

  switch ((resource as { resourceType: string }).resourceType) {
    case 'Patient':
      patientResourceSchema.parse(resource);
      return;
    case 'Condition':
      conditionResourceSchema.parse(resource);
      return;
    case 'Observation':
      observationResourceSchema.parse(resource);
      return;
    case 'Communication':
      communicationResourceSchema.parse(resource);
      return;
    case 'Appointment':
      appointmentResourceSchema.parse(resource);
      return;
    case 'Slot':
      slotResourceSchema.parse(resource);
      return;
    case 'Practitioner':
      practitionerResourceSchema.parse(resource);
      return;
    case 'Schedule':
      scheduleResourceSchema.parse(resource);
      return;
    default:
      throw new Error(`Unsupported FHIR resourceType: ${(resource as { resourceType: string }).resourceType}`);
  }
}

export function validateBundle(bundle: unknown): FhirBundleResource {
  const parsed = bundleResourceSchema.parse(bundle);
  for (const entry of parsed.entry) {
    validateFhirResource(entry.resource);
  }
  return parsed;
}

export function makeBusySlotResource(input: { slotId: string; start: string; end: string; scheduleRef?: string }): FhirSlotResource {
  return slotResourceSchema.parse({
    resourceType: 'Slot',
    id: input.slotId,
    schedule: { reference: input.scheduleRef ?? 'Schedule/cb014c56-735d-4ff2-98d6-6050e5869a02' },
    start: input.start,
    end: input.end,
    status: 'busy',
  });
}

export function makeObservationResource(input: {
  id: string;
  patientId: string;
  code: string;
  display: string;
  value: number | string;
  unit?: string;
  onset?: string;
  effectiveDateTime: string;
}): FhirObservationResource {
  return observationResourceSchema.parse({
    resourceType: 'Observation',
    id: input.id,
    status: 'final',
    code: { text: input.display, coding: [{ code: input.code, display: input.display }] },
    subject: { reference: `Patient/${input.patientId}` },
    effectiveDateTime: input.effectiveDateTime,
    ...(typeof input.value === 'number'
      ? { valueQuantity: { value: input.value, unit: input.unit } }
      : { valueString: input.value }),
  });
}

export function makeAppointmentResource(input: {
  appointmentId: string;
  patientId: string;
  slotId: string;
  start: string;
  end: string;
  practitionerDisplay: string;
  packetRef: string;
  reason: string;
}): FhirAppointmentResource {
  return appointmentResourceSchema.parse({
    resourceType: 'Appointment',
    id: input.appointmentId,
    status: 'booked',
    start: input.start,
    end: input.end,
    slot: [{ reference: `Slot/${input.slotId}` }],
    participant: [{ actor: { reference: `Patient/${input.patientId}` }, status: 'accepted' }],
    supportingInformation: [{ reference: input.packetRef }],
    description: `${input.reason} with ${input.practitionerDisplay}`,
  });
}

export function makeBundleResource(input: {
  bundleId: string;
  patient: FhirPatientResource;
  condition: FhirConditionResource;
  observations: FhirObservationResource[];
  communication: FhirCommunicationResource;
  appointment: FhirAppointmentResource;
}): FhirBundleResource {
  return validateBundle({
    resourceType: 'Bundle',
    id: input.bundleId,
    type: 'collection',
    entry: [
      { fullUrl: `urn:uuid:${input.patient.id}`, resource: input.patient },
      { fullUrl: `urn:uuid:${input.condition.id}`, resource: input.condition },
      ...input.observations.map((observation) => ({ fullUrl: `urn:uuid:${observation.id}`, resource: observation })),
      { fullUrl: `urn:uuid:${input.communication.id}`, resource: input.communication },
      { fullUrl: `urn:uuid:${input.appointment.id}`, resource: input.appointment },
    ],
  });
}
