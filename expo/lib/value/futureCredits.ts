import { diffDays, normalizeDateOnly, todayDateOnly } from '@/lib/dates/appDate';
import type { FutureCruiseCredit, NextCruiseCertificate } from '@/types/models';
import type { FutureValueWalletItem } from '@/lib/value/futureValueWallet';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function getFutureCruiseCreditStatus(fcc: FutureCruiseCredit, today = todayDateOnly()): FutureCruiseCredit['status'] {
  const expiration = normalizeDateOnly(fcc.expirationDate);
  if (expiration && diffDays(today, expiration) < 0) return 'expired';
  if (money(fcc.amountRemaining) <= 0) return 'used';
  if (money(fcc.amountRemaining) < money(fcc.amountOriginal)) return 'partially-used';
  return fcc.status ?? 'available';
}

export function applyFutureCruiseCredit(fcc: FutureCruiseCredit, cruiseId: string, amountToApply: number): FutureCruiseCredit {
  const amount = Math.max(0, Math.min(money(amountToApply), money(fcc.amountRemaining)));
  const amountRemaining = Math.max(0, money(fcc.amountRemaining) - amount);
  const appliedCruiseIds = Array.from(new Set([...(fcc.appliedCruiseIds ?? []), cruiseId].filter(Boolean)));
  const status: FutureCruiseCredit['status'] = amountRemaining <= 0 ? 'used' : amountRemaining < money(fcc.amountOriginal) ? 'partially-used' : fcc.status;
  return { ...fcc, amountRemaining, appliedCruiseIds, status };
}

export function nextCruiseCertificateToWalletItem(cert: NextCruiseCertificate): FutureValueWalletItem {
  const amount = money(cert.confirmedValue) || money(cert.estimatedValue);
  return {
    id: cert.id,
    type: 'nextcruise',
    label: `NextCruise ${cert.offerType === 'instant-savings' ? 'instant savings' : cert.offerType === 'obc' ? 'OBC' : 'certificate'}`,
    amount,
    expirationDate: cert.selectionDeadline,
    assignedCruiseId: cert.selectedCruiseId,
    status: cert.status === 'unassigned' ? 'available' : cert.status,
    source: 'nextcruise',
    notes: cert.notes,
  };
}

export function futureCruiseCreditToWalletItem(fcc: FutureCruiseCredit, today = todayDateOnly()): FutureValueWalletItem {
  return {
    id: fcc.id,
    type: 'fcc',
    label: `Future Cruise Credit${fcc.fccNumber ? ` ${fcc.fccNumber}` : ''}`,
    amount: money(fcc.amountRemaining),
    expirationDate: fcc.expirationDate,
    assignedCruiseId: fcc.appliedCruiseIds?.[0],
    status: getFutureCruiseCreditStatus(fcc, today) === 'available' || getFutureCruiseCreditStatus(fcc, today) === 'partially-used' ? 'available' : getFutureCruiseCreditStatus(fcc, today),
    source: 'fcc',
    notes: fcc.notes,
  };
}

export function buildFutureCreditWalletItems(input: { fccs?: FutureCruiseCredit[]; nextCruiseCertificates?: NextCruiseCertificate[] }, today = todayDateOnly()): FutureValueWalletItem[] {
  return [
    ...(input.fccs ?? []).map((fcc) => futureCruiseCreditToWalletItem(fcc, today)),
    ...(input.nextCruiseCertificates ?? []).map(nextCruiseCertificateToWalletItem),
  ];
}
