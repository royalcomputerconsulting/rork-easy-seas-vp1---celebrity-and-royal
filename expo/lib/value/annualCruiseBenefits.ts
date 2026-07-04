import { diffDays, normalizeDateOnly, todayDateOnly } from '@/lib/dates/appDate';
import type { AnnualCruiseBenefit, CrownAnchorCruiseCertificate } from '@/types/models';
import type { CruiseValueLedgerItem } from '@/lib/value/cruiseValueLedger';
import type { FutureValueWalletItem } from '@/lib/value/futureValueWallet';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nowIso() {
  return new Date().toISOString();
}

export function createAnnualCruiseBenefit(input: Partial<AnnualCruiseBenefit> & { tier: AnnualCruiseBenefit['tier']; benefitYear: string }): AnnualCruiseBenefit {
  const cabinEntitlement = input.cabinEntitlement ?? (input.tier === 'masters' ? 'grand-suite' : input.tier === 'signature' ? 'balcony' : 'interior');
  return {
    id: input.id ?? `club-royale-${input.tier}-${input.benefitYear}`,
    program: 'club-royale',
    tier: input.tier,
    benefitYear: input.benefitYear,
    cabinEntitlement,
    maxNights: input.maxNights ?? 7,
    doubleOccupancy: input.doubleOccupancy ?? true,
    taxesAndFeesDue: input.taxesAndFeesDue ?? true,
    bookByDate: input.bookByDate,
    sailByDate: input.sailByDate,
    selectedCruiseId: input.selectedCruiseId,
    estimatedRetailValue: input.estimatedRetailValue,
    confirmedRetailValue: input.confirmedRetailValue,
    taxesFees: input.taxesFees,
    cashPaid: input.cashPaid,
    status: input.status ?? 'available',
    notes: input.notes,
  };
}

export function getAnnualCruiseBenefitValue(benefit: AnnualCruiseBenefit): number {
  return money(benefit.confirmedRetailValue) || money(benefit.estimatedRetailValue);
}

export function annualCruiseBenefitToWalletItem(benefit: AnnualCruiseBenefit): FutureValueWalletItem {
  return {
    id: benefit.id,
    type: 'annual-cruise',
    label: `Club Royale ${benefit.tier} annual cruise (${benefit.cabinEntitlement})`,
    amount: getAnnualCruiseBenefitValue(benefit),
    expirationDate: benefit.sailByDate ?? benefit.bookByDate,
    assignedCruiseId: benefit.selectedCruiseId,
    status: benefit.status === 'selected' || benefit.status === 'booked' ? 'assigned' : benefit.status === 'sailed' ? 'used' : benefit.status,
    source: 'club-royale',
    notes: benefit.notes,
  };
}

export function crownAnchorCertificateToWalletItem(certificate: CrownAnchorCruiseCertificate): FutureValueWalletItem {
  return {
    id: certificate.id,
    type: 'crown-anchor-certificate',
    label: `Crown & Anchor milestone certificate (${certificate.triggerPoints} pts)`,
    amount: money(certificate.confirmedValue) || money(certificate.estimatedValue),
    expirationDate: certificate.expirationDate,
    assignedCruiseId: certificate.selectedCruiseId,
    status: certificate.status === 'earned' ? 'available' : certificate.status === 'selected' || certificate.status === 'booked' ? 'assigned' : certificate.status === 'sailed' ? 'used' : certificate.status === 'not-yet-earned' ? 'unknown' : certificate.status,
    source: 'crown-anchor',
    notes: certificate.notes,
  };
}

export function buildAnnualAndMilestoneLedgerItems(input: {
  cruiseId: string;
  annualBenefits?: AnnualCruiseBenefit[];
  crownAnchorCertificates?: CrownAnchorCruiseCertificate[];
}): CruiseValueLedgerItem[] {
  const now = nowIso();
  const rows: CruiseValueLedgerItem[] = [];
  for (const benefit of input.annualBenefits ?? []) {
    if (benefit.selectedCruiseId && benefit.selectedCruiseId !== input.cruiseId) continue;
    const amount = getAnnualCruiseBenefitValue(benefit);
    if (!amount) continue;
    rows.push({
      id: `${benefit.id}-ledger`,
      cruiseId: input.cruiseId,
      category: 'club-royale-annual-cruise',
      label: `Club Royale ${benefit.tier} annual cruise value`,
      amount,
      currency: 'USD',
      source: 'club-royale',
      appliesTo: 'cruise-fare',
      isCashEquivalent: false,
      isRefundable: null,
      isStackable: null,
      paymentMethod: 'comp',
      status: benefit.status === 'booked' || benefit.status === 'sailed' ? 'confirmed' : 'expected',
      notes: benefit.notes,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const certificate of input.crownAnchorCertificates ?? []) {
    if (certificate.selectedCruiseId && certificate.selectedCruiseId !== input.cruiseId) continue;
    const amount = money(certificate.confirmedValue) || money(certificate.estimatedValue);
    if (!amount) continue;
    rows.push({
      id: `${certificate.id}-ledger`,
      cruiseId: input.cruiseId,
      category: 'crown-anchor-milestone-cruise',
      label: `Crown & Anchor milestone certificate value`,
      amount,
      currency: 'USD',
      source: 'crown-anchor',
      appliesTo: 'cruise-fare',
      isCashEquivalent: false,
      isRefundable: null,
      isStackable: null,
      paymentMethod: 'comp',
      status: certificate.status === 'booked' || certificate.status === 'sailed' ? 'confirmed' : 'expected',
      notes: certificate.notes,
      createdAt: now,
      updatedAt: now,
    });
  }
  return rows;
}

export function getFutureValueDateWarning(date?: string, today = todayDateOnly()): string | null {
  const normalized = normalizeDateOnly(date);
  if (!normalized) return null;
  const days = diffDays(today, normalized);
  if (days < 0) return `Expired ${Math.abs(days)} day(s) ago.`;
  if (days <= 30) return `Expires in ${days} day(s).`;
  return null;
}
