import type { CruiseValueLedgerItem } from './cruiseValueLedger';

export type FutureValueStatus = 'available' | 'assigned' | 'applied' | 'partially-used' | 'used' | 'expired' | 'cancelled' | 'unknown';

export type NextCruiseCertificate = {
  id: string;
  bookingType: 'book-now' | 'book-later' | 'unknown';
  certificateNumber?: string;
  createdOnShip?: string;
  createdDuringCruiseId?: string;
  createdDate: string;
  selectionDeadline?: string;
  depositPaid: number;
  depositPerPerson?: number;
  selectedCruiseId?: string;
  selectedShipName?: string;
  selectedSailDate?: string;
  offerType: 'obc' | 'instant-savings' | 'unknown';
  estimatedValue: number;
  confirmedValue?: number;
  status: 'unassigned' | 'assigned' | 'applied' | 'expired' | 'cancelled' | 'unknown';
  notes?: string;
};

export type FutureCruiseCredit = {
  id: string;
  fccNumber?: string;
  guestName?: string;
  originalReservationNumber?: string;
  originalCruiseId?: string;
  issueDate?: string;
  expirationDate?: string;
  amountOriginal: number;
  amountRemaining: number;
  currency: 'USD';
  appliedCruiseIds: string[];
  status: 'available' | 'partially-used' | 'used' | 'expired' | 'unknown';
  source: 'manual' | 'email' | 'invoice' | 'unknown';
  notes?: string;
};

export type AnnualCruiseBenefit = {
  id: string;
  program: 'club-royale';
  tier: 'prime' | 'signature' | 'masters';
  benefitYear: string;
  cabinEntitlement: 'interior' | 'balcony' | 'grand-suite';
  maxNights: number;
  doubleOccupancy: boolean;
  taxesAndFeesDue: boolean;
  bookByDate?: string;
  sailByDate?: string;
  selectedCruiseId?: string;
  estimatedRetailValue?: number;
  confirmedRetailValue?: number;
  taxesFees?: number;
  cashPaid?: number;
  status: 'available' | 'selected' | 'booked' | 'sailed' | 'expired' | 'unknown';
  notes?: string;
};

export type CrownAnchorCruiseCertificate = {
  id: string;
  program: 'crown-anchor';
  triggerPoints: number;
  certificateType:
    | 'pinnacle-700-balcony'
    | 'pinnacle-1050-balcony'
    | 'pinnacle-1400-junior-suite'
    | 'pinnacle-350-increment-junior-suite'
    | 'unknown';
  cabinValueBasis: '7-night-balcony' | 'junior-suite' | 'unknown';
  earnedDate?: string;
  expirationDate?: string;
  selectedCruiseId?: string;
  estimatedValue?: number;
  confirmedValue?: number;
  status: 'not-yet-earned' | 'earned' | 'selected' | 'booked' | 'sailed' | 'expired' | 'unknown';
  notes?: string;
};

export type UserBenefitOverride = {
  id: string;
  userId: string;
  benefitType: 'signature-obc' | 'masters-obc' | 'internet' | 'other';
  amount: number;
  validFrom?: string;
  validThrough?: string;
  appliesTo: 'all-qualifying-cruises' | 'specific-cruises';
  source: 'manual-user-confirmed' | 'invoice' | 'email' | 'unknown';
  notes?: string;
};

export type FutureValueWallet = {
  nextCruiseCertificates: NextCruiseCertificate[];
  futureCruiseCredits: FutureCruiseCredit[];
  annualCruiseBenefits: AnnualCruiseBenefit[];
  crownAnchorCertificates: CrownAnchorCruiseCertificate[];
  unassignedLedgerItems: CruiseValueLedgerItem[];
  expiringSoon: Array<{ id: string; label: string; expirationDate?: string; value: number; type: string }>;
  warnings: string[];
};

function n(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function dateLessOrEqual(a?: string, b?: string): boolean { return Boolean(a && b && a <= b); }
function todayString(today?: string): string { return today ?? new Date().toISOString().slice(0, 10); }

export function getScottSignatureObcOverride(userId = 'scott-merlis'): UserBenefitOverride {
  return {
    id: `${userId}-signature-obc-through-2026-02-28`,
    userId,
    benefitType: 'signature-obc',
    amount: 75,
    validThrough: '2026-02-28',
    appliesTo: 'all-qualifying-cruises',
    source: 'manual-user-confirmed',
    notes: 'Scott user override: $75 Signature OBC per qualifying cruise through 2026-02-28.',
  };
}

export function isBenefitOverrideActive(override: UserBenefitOverride, sailingDate: string): boolean {
  if (override.validFrom && sailingDate < override.validFrom) return false;
  if (override.validThrough && sailingDate > override.validThrough) return false;
  return true;
}

export function applyFccToCruise(fcc: FutureCruiseCredit, cruiseId: string, amount: number): FutureCruiseCredit {
  const applied = Math.max(0, Math.min(n(amount), n(fcc.amountRemaining)));
  const remaining = Math.max(0, n(fcc.amountRemaining) - applied);
  return {
    ...fcc,
    amountRemaining: remaining,
    appliedCruiseIds: [...new Set([...(fcc.appliedCruiseIds ?? []), cruiseId])],
    status: remaining <= 0 ? 'used' : 'partially-used',
  };
}

export function buildFutureValueWallet(input: {
  nextCruiseCertificates?: NextCruiseCertificate[];
  futureCruiseCredits?: FutureCruiseCredit[];
  annualCruiseBenefits?: AnnualCruiseBenefit[];
  crownAnchorCertificates?: CrownAnchorCruiseCertificate[];
  ledgerItems?: CruiseValueLedgerItem[];
  today?: string;
  expiringWithinDays?: number;
}): FutureValueWallet {
  const today = todayString(input.today);
  const days = input.expiringWithinDays ?? 90;
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffText = cutoff.toISOString().slice(0, 10);
  const warnings: string[] = [];

  const fccs = (input.futureCruiseCredits ?? []).map((fcc) => ({
    ...fcc,
    status: (fcc.expirationDate && fcc.expirationDate < today ? 'expired' : fcc.status) as FutureCruiseCredit['status'],
  }));
  const nextCruise = (input.nextCruiseCertificates ?? []).map((cert) => ({
    ...cert,
    status: (cert.selectionDeadline && cert.selectionDeadline < today && cert.status === 'unassigned' ? 'expired' : cert.status) as NextCruiseCertificate['status'],
  }));

  const expiringSoon = [
    ...fccs.filter((fcc) => fcc.status !== 'used' && dateLessOrEqual(fcc.expirationDate, cutoffText)).map((fcc) => ({ id: fcc.id, label: fcc.fccNumber ? `FCC ${fcc.fccNumber}` : 'Future Cruise Credit', expirationDate: fcc.expirationDate, value: n(fcc.amountRemaining), type: 'future-cruise-credit' })),
    ...nextCruise.filter((cert) => cert.status === 'unassigned' && dateLessOrEqual(cert.selectionDeadline, cutoffText)).map((cert) => ({ id: cert.id, label: cert.certificateNumber ? `NextCruise ${cert.certificateNumber}` : 'NextCruise Certificate', expirationDate: cert.selectionDeadline, value: n(cert.confirmedValue ?? cert.estimatedValue), type: 'nextcruise' })),
  ];

  if (expiringSoon.length) warnings.push(`${expiringSoon.length} future value item(s) expire within ${days} days.`);

  return {
    nextCruiseCertificates: nextCruise,
    futureCruiseCredits: fccs,
    annualCruiseBenefits: input.annualCruiseBenefits ?? [],
    crownAnchorCertificates: input.crownAnchorCertificates ?? [],
    unassignedLedgerItems: (input.ledgerItems ?? []).filter((item) => !item.cruiseId || item.status === 'expected'),
    expiringSoon,
    warnings,
  };
}
