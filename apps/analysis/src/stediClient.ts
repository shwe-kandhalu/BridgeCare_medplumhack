import type { MockCoverageSummary } from '../../../packages/shared/contracts.js';

type AnyRecord = Record<string, unknown>;

export const STEDI_ENABLED = process.env.STEDI_ENABLED === 'true';
export const STEDI_BASE_URL = process.env.STEDI_BASE_URL ?? 'https://healthcare.us.stedi.com/2024-04-01';
export const STEDI_API_KEY = process.env.STEDI_API_KEY ?? '';

/**
 * Stedi's approved UnitedHealthcare test-mode fixture. This project has no
 * patient insurance identity in its seam contract, so eligibility is always
 * demonstrably synthetic. Do not substitute a BridgeCare patient ID here.
 */
export const STEDI_SANDBOX_ELIGIBILITY_REQUEST = {
  tradingPartnerServiceId: '87726',
  encounter: { serviceTypeCodes: ['30'] },
  provider: {
    organizationName: 'BridgeCare Rheumatology Center',
    npi: '1999999984',
  },
  subscriber: {
    firstName: 'John',
    lastName: 'Doe',
    memberId: 'UHC202649',
  },
  dependents: [
    {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '19521121',
    },
  ],
} as const;

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return trimmed.endsWith('/change/medicalnetwork/eligibility/v3') ? trimmed.replace(/\/change\/medicalnetwork\/eligibility\/v3$/, '') : trimmed;
}

export function getStediEligibilityUrl(baseUrl: string = STEDI_BASE_URL): string {
  return `${normalizeBaseUrl(baseUrl)}/change/medicalnetwork/eligibility/v3`;
}

function asRecord(value: unknown): AnyRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatBenefitValue(benefit: AnyRecord): string | undefined {
  const amount =
    asString(benefit.benefitAmount) ??
    asString(benefit.benefitPercent) ??
    asString(asRecord(benefit.benefitAmount)?.amount) ??
    asString(asRecord(benefit.benefitAmount)?.value) ??
    asString(asRecord(benefit.benefitAmount)?.formatted);

  if (amount) {
    return amount;
  }

  const numericAmount = asRecord(benefit.benefitAmount)?.amount;
  return typeof numericAmount === 'number' ? String(numericAmount) : undefined;
}

function formatCopay(benefit: AnyRecord): { serviceType: string; inNetwork?: string; outOfNetwork?: string } | null {
  const serviceTypeCode =
    asString(benefit.serviceTypeCode) ??
    asString(asArray(benefit.serviceTypeCodes)[0]) ??
    asString(asRecord(benefit.serviceType)?.code) ??
    asString(asRecord(benefit.serviceType)?.display) ??
    asString(benefit.code) ??
    'general benefits';

  const inNetwork = formatBenefitValue(benefit);
  const outOfNetwork =
    asString(asRecord(benefit.outOfNetwork)?.amount) ??
    asString(asRecord(benefit.outOfNetwork)?.value) ??
    asString(asRecord(benefit.outOfNetwork)?.formatted);

  if (!inNetwork && !outOfNetwork) {
    return null;
  }

  return {
    serviceType: serviceTypeCode,
    ...(inNetwork ? { inNetwork } : {}),
    ...(outOfNetwork ? { outOfNetwork } : {}),
  };
}

export function mapStediEligibilityResponse(response: unknown, fallbackMemberId: string): MockCoverageSummary {
  const payload = asRecord(response) ?? {};
  const payer = asRecord(payload.payer) ?? {};
  const planInformation = asRecord(payload.planInformation) ?? {};
  const subscriber = asRecord(payload.subscriber) ?? {};
  const benefitsInformation = asArray(payload.benefitsInformation).map(asRecord).filter((item): item is AnyRecord => Boolean(item));
  const warnings = asArray(payload.warnings).map(asRecord).filter((item): item is AnyRecord => Boolean(item));
  const errors = asArray(payload.errors).map(asRecord).filter((item): item is AnyRecord => Boolean(item));

  const copays = benefitsInformation
    .map(formatCopay)
    .filter((item): item is { serviceType: string; inNetwork?: string; outOfNetwork?: string } => Boolean(item));

  const deductibleBenefits = benefitsInformation.filter((benefit) => {
    const label = `${asString(benefit.code) ?? ''} ${asString(benefit.description) ?? ''} ${asString(benefit.serviceTypeCode) ?? ''} ${asArray(benefit.serviceTypeCodes).join(' ')}`.toLowerCase();
    return label.includes('deduct') || label.includes('out of pocket');
  });

  const firstDeductibleBenefit = deductibleBenefits[0];

  const deductible = deductibleBenefits.length > 0
    ? {
        individual:
          (firstDeductibleBenefit ? formatBenefitValue(firstDeductibleBenefit) : undefined) ??
          (firstDeductibleBenefit ? asString(asRecord(firstDeductibleBenefit.benefitAmount)?.formatted) : undefined) ??
          undefined,
        family: deductibleBenefits[1] ? formatBenefitValue(deductibleBenefits[1]) ?? undefined : undefined,
        remaining:
          (firstDeductibleBenefit ? asString(asRecord(firstDeductibleBenefit.benefitAmount)?.remaining) : undefined) ??
          (firstDeductibleBenefit ? asString(asRecord(firstDeductibleBenefit.benefitAmount)?.remainingAmount) : undefined) ??
          undefined,
      }
    : undefined;

  const memberId =
    asString(subscriber.memberId) ??
    asString(asRecord(asArray(payload.dependents)[0])?.memberId) ??
    fallbackMemberId;

  const planStatuses = asArray(payload.planStatus).map(asRecord).filter((item): item is AnyRecord => Boolean(item));

  const planName =
    asString(planInformation.planName) ??
    asString(planStatuses[0]?.planDetails) ??
    asString(planInformation.planNumber) ??
    asString(planInformation.groupName) ??
    asString(planInformation.name) ??
    'Stedi Sandbox Plan';

  const payerName =
    asString(payer.businessName) ??
    asString(payer.name) ??
    asString(payload.tradingPartnerName) ??
    asString(payload.tradingPartnerServiceId) ??
    'Stedi Sandbox Payer';

  const isActive =
    errors.length === 0 &&
    planStatuses.some((planStatus) => asString(planStatus.statusCode) === '1' || /active coverage/i.test(asString(planStatus.status) ?? ''));

  return {
    payer: payerName,
    planName,
    memberId,
    active: isActive,
    copays: copays.length > 0 ? copays : [{ serviceType: 'plan coverage and general benefits', inNetwork: isActive ? 'covered' : 'coverage unavailable' }],
    ...(deductible ? { deductible } : {}),
    source: 'stedi_sandbox',
    raw271Ref:
      asString(payload.id) ??
      asString(asRecord(payload.meta)?.traceId) ??
      asString(payload.reassociationKey) ??
      (warnings.length > 0 ? 'stedi-warning' : undefined),
  };
}

export async function fetchStediCoverageSummary(fallbackMemberId: string): Promise<MockCoverageSummary | null> {
  if (!STEDI_ENABLED) {
    return null;
  }

  if (!STEDI_API_KEY) {
    // eslint-disable-next-line no-console
    console.error('Stedi is enabled but STEDI_API_KEY is missing');
    return null;
  }

  try {
    const response = await fetch(getStediEligibilityUrl(), {
      method: 'POST',
      headers: {
        Authorization: STEDI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(STEDI_SANDBOX_ELIGIBILITY_REQUEST),
    });

    const text = await response.text();
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('Stedi eligibility request failed', response.status, text);
      return null;
    }

    const json = text ? (JSON.parse(text) as unknown) : {};
    return mapStediEligibilityResponse(json, fallbackMemberId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Stedi error';
    // eslint-disable-next-line no-console
    console.error('Stedi eligibility request error:', message);
    return null;
  }
}
