import type { MockCoverageSummary, ProviderSuggestion, SlotOption } from '../../../packages/shared/contracts.js';

export const demoIds = {
  patient: '154e90b3-3562-4b02-8e46-4e62df95ed8e',
  condition: 'd0684a9f-5689-4d8a-ad40-d42123cfcad7',
  practitioner: 'e84191a9-b571-4b5a-97e2-1ab3d24966b1',
  schedule: 'cb014c56-735d-4ff2-98d6-6050e5869a02',
  rheumatologySlotOne: 'c592246d-d566-4c59-a0cf-1f56879275b7',
  rheumatologySlotTwo: '68abbe6b-43b4-49e3-bfcd-ff01a6be4129',
  urgentCareSlot: '48eaaa75-d28d-42b4-a17a-93e2e8a26ec1',
} as const;

export const DISCLAIMER =
  'This is not a diagnosis or medical advice. It\'s a triage aid to help you decide your next step. If you think this is an emergency, call 911 or go to the nearest ER.';

export const seededPatient = {
  resourceType: 'Patient' as const,
  id: demoIds.patient,
  active: true,
  name: [{ use: 'official' as const, given: ['Maya'], family: 'Ramirez' }],
};

export const seededCondition = {
  resourceType: 'Condition' as const,
  id: demoIds.condition,
  clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
  code: { coding: [{ system: 'http://snomed.info/sct', code: '69896004', display: 'Rheumatoid arthritis' }] },
  subject: { reference: `Patient/${seededPatient.id}` },
};

export const seededCarePlan = {
  resourceType: 'CarePlan' as const,
  id: '5fa758a7-1478-4d15-90c3-7d1bbd7d2c6c',
  status: 'active' as const,
  intent: 'plan' as const,
  subject: { reference: `Patient/${seededPatient.id}` },
  title: 'Rheumatoid arthritis care plan',
};

export const seededSlots: Array<SlotOption & { specialty: string; busy: boolean }> = [
  {
    slotId: demoIds.rheumatologySlotOne,
    start: '2026-08-03T14:00:00Z',
    end: '2026-08-03T14:30:00Z',
    practitionerDisplay: 'Dr. Chen, Rheumatology',
    specialty: 'rheumatology',
    busy: false,
  },
  {
    slotId: demoIds.rheumatologySlotTwo,
    start: '2026-08-03T15:00:00Z',
    end: '2026-08-03T15:30:00Z',
    practitionerDisplay: 'Dr. Patel, Rheumatology',
    specialty: 'rheumatology',
    busy: false,
  },
  {
    slotId: demoIds.urgentCareSlot,
    start: '2026-08-03T16:00:00Z',
    end: '2026-08-03T16:20:00Z',
    practitionerDisplay: 'Urgent Care Team',
    specialty: 'urgent care',
    busy: false,
  },
];

export const placeholderProviders: ProviderSuggestion[] = [
  { name: 'BridgeCare Rheumatology Center', npi: '1111111111', specialty: 'rheumatology', networkStatus: 'in_network', rating: 4.9, distanceMiles: 2.1, isPreferred: true, source: 'placeholder' },
  { name: 'Northside Rheumatology Group', npi: '2222222222', specialty: 'rheumatology', networkStatus: 'in_network', rating: 4.6, distanceMiles: 6.8, source: 'placeholder' },
  { name: 'Downtown Urgent Care', specialty: 'urgent care', networkStatus: 'in_network', rating: 4.5, distanceMiles: 1.7, source: 'placeholder' },
  { name: 'Emergency Department', specialty: 'emergency medicine', networkStatus: 'out_of_network', rating: 4.2, distanceMiles: 4.4, source: 'placeholder' },
];

export const mockCoverageSummary: MockCoverageSummary = {
  payer: 'BridgeCare Mock Health',
  planName: 'RA Advantage Demo',
  memberId: 'MOCK-MAYA-271',
  active: true,
  copays: [
    { serviceType: 'primary care', inNetwork: '$25', outOfNetwork: '$60' },
    { serviceType: 'specialist', inNetwork: '$40', outOfNetwork: '$90' },
    { serviceType: 'urgent care', inNetwork: '$55', outOfNetwork: '$120' },
  ],
  deductible: { individual: '$500', family: '$1,000', remaining: '$125' },
  source: 'stedi_sandbox',
  raw271Ref: '271-mock-maya-001',
};
