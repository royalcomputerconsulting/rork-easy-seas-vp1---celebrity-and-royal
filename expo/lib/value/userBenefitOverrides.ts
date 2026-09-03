import { normalizeDateOnly, todayDateOnly } from '@/lib/dates/appDate';
import type { UserBenefitOverride } from '@/types/models';

export const SCOTT_SIGNATURE_OBC_OVERRIDE: UserBenefitOverride = {
  id: 'scott-signature-obc-through-2026-02-28',
  userId: 'scott',
  benefitType: 'signature-obc',
  amount: 75,
  validThrough: '2026-02-28',
  appliesTo: 'all-qualifying-cruises',
  source: 'manual-user-confirmed',
  notes: 'Scott-specific EasySeas override: $75 Signature OBC per qualifying cruise through 2026-02-28 unless invoice/user confirmation says otherwise.',
};

function amount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function isBenefitOverrideActive(override: UserBenefitOverride, date = todayDateOnly()): boolean {
  const checkDate = normalizeDateOnly(date) ?? todayDateOnly();
  const from = normalizeDateOnly(override.validFrom);
  const through = normalizeDateOnly(override.validThrough);
  if (from && checkDate < from) return false;
  if (through && checkDate > through) return false;
  return true;
}

export function getExpectedBenefitOverrideAmount(input: {
  cruise?: Record<string, unknown>;
  override: UserBenefitOverride;
  date?: string;
  alreadyConfirmedAmount?: number;
}): { amount: number; status: 'expected' | 'confirmed' | 'not-applicable'; warnings: string[] } {
  const sailingDate = normalizeDateOnly(input.date ?? String(input.cruise?.sailDate ?? input.cruise?.sailingDate ?? '')) ?? todayDateOnly();
  const confirmed = amount(input.alreadyConfirmedAmount ?? input.cruise?.signatureObcConfirmed ?? input.cruise?.signatureOBCConfirmed);
  if (confirmed > 0) return { amount: confirmed, status: 'confirmed', warnings: [] };
  if (!isBenefitOverrideActive(input.override, sailingDate)) return { amount: 0, status: 'not-applicable', warnings: [`Override ${input.override.id} is not active for ${sailingDate}.`] };
  return { amount: input.override.amount, status: 'expected', warnings: ['Expected benefit should become confirmed/applied when supported by invoice, folio, or user entry.'] };
}

export function buildDefaultUserBenefitOverrides(userId = 'scott'): UserBenefitOverride[] {
  return [{ ...SCOTT_SIGNATURE_OBC_OVERRIDE, userId }];
}
