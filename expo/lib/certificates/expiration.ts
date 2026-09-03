import { diffDays, todayDateOnly, normalizeDateOnly } from '@/lib/dates/appDate';

export type CertificateExpirationStatus = 'unknown' | 'expired' | 'expires-today' | 'urgent' | 'expiring-soon' | 'valid';

export type CertificateExpirationResult = {
  status: CertificateExpirationStatus;
  badgeLabel: string;
  message: string;
  severity: 'neutral' | 'danger' | 'warning' | 'info' | 'success';
  daysRemaining: number | null;
  sourceField: string | null;
  warnings: string[];
  sortPriority: number;
};

const DATE_FIELDS = ['redeemByDate', 'expirationDate', 'expiresAt', 'expiryDate', 'offerExpiryDate', 'expires', 'validUntil', 'sailByDate'] as const;

export function getCertificateExpirationResult(record: Record<string, unknown>, today = todayDateOnly()): CertificateExpirationResult {
  const warnings: string[] = [];
  let sourceField: string | null = null;
  let dateValue: string | null = null;

  const prioritized = ['redeemByDate', ...DATE_FIELDS.filter(field => field !== 'redeemByDate' && field !== 'sailByDate'), 'sailByDate'];
  for (const field of prioritized) {
    const normalized = normalizeDateOnly(record[field] as string | Date | null | undefined);
    if (normalized) {
      sourceField = field;
      dateValue = normalized;
      break;
    }
  }

  if (!dateValue) {
    return {
      status: 'unknown',
      badgeLabel: 'Unknown expiry',
      message: 'No usable certificate expiration date was found.',
      severity: 'neutral',
      daysRemaining: null,
      sourceField: null,
      warnings: ['Expiration date missing or unreadable.'],
      sortPriority: 900,
    };
  }

  const daysRemaining = diffDays(today, dateValue);
  if (daysRemaining === null) {
    return {
      status: 'unknown',
      badgeLabel: 'Unknown expiry',
      message: 'Certificate expiration date could not be compared safely.',
      severity: 'neutral',
      daysRemaining: null,
      sourceField,
      warnings: ['Expiration comparison failed.'],
      sortPriority: 900,
    };
  }

  if (sourceField === 'sailByDate') warnings.push('Using sail-by date because no redeem-by/expiration date was available.');
  if (daysRemaining < 0) {
    return { status: 'expired', badgeLabel: 'Expired', message: `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago.`, severity: 'danger', daysRemaining, sourceField, warnings, sortPriority: 1000 + Math.abs(daysRemaining) };
  }
  if (daysRemaining === 0) return { status: 'expires-today', badgeLabel: 'Expires today', message: 'Redeem today if you intend to use this certificate.', severity: 'danger', daysRemaining, sourceField, warnings, sortPriority: 0 };
  if (daysRemaining <= 7) return { status: 'urgent', badgeLabel: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`, message: 'Urgent certificate redemption window.', severity: 'warning', daysRemaining, sourceField, warnings, sortPriority: 10 + daysRemaining };
  if (daysRemaining <= 30) return { status: 'expiring-soon', badgeLabel: `${daysRemaining} days left`, message: 'Certificate is expiring soon.', severity: 'info', daysRemaining, sourceField, warnings, sortPriority: 100 + daysRemaining };
  return { status: 'valid', badgeLabel: `${daysRemaining} days left`, message: 'Certificate is currently valid.', severity: 'success', daysRemaining, sourceField, warnings, sortPriority: 300 + daysRemaining };
}
