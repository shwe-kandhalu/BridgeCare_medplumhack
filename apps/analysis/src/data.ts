import type { MockCoverageSummary, ProviderSuggestion, SlotOption } from '../../../packages/shared/contracts.js';

export const DISCLAIMER =
  'This is not a diagnosis or medical advice. It\'s a triage aid to help you decide your next step. If you think this is an emergency, call 911 or go to the nearest ER.';

export const seededPatient = {
  resourceType: 'Patient' as const,
  id: 'maya',
  active: true,
  name: [{ use: 'official' as const, given: ['Maya'], family: 'Ramirez' }],
};

export const seededCondition = {
  resourceType: 'Condition' as const,
  id: 'ra-condition',
  clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
  code: { coding: [{ system: 'http://snomed.info/sct', code: '69896004', display: 'Rheumatoid arthritis' }] },
  subject: { reference: `Patient/${seededPatient.id}` },
};

export const seededCarePlan = {
  resourceType: 'CarePlan' as const,
  id: 'careplan-ra',
  status: 'active' as const,
  intent: 'plan' as const,
  subject: { reference: `Patient/${seededPatient.id}` },
  title: 'Rheumatoid arthritis care plan',
};

export const seededSlots: Array<SlotOption & { specialty: string; busy: boolean }> = [
  {
    slotId: 'slot-001',
    start: '2026-08-03T14:00:00Z',
    end: '2026-08-03T14:30:00Z',
    practitionerDisplay: 'Dr. Chen, Rheumatology',
    specialty: 'rheumatology',
    busy: false,
  },
  {
    slotId: 'slot-002',
    start: '2026-08-03T15:00:00Z',
    end: '2026-08-03T15:30:00Z',
    practitionerDisplay: 'Dr. Patel, Rheumatology',
    specialty: 'rheumatology',
    busy: false,
  },
  {
    slotId: 'slot-101',
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
