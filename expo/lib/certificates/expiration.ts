import { daysBetweenDates, getTodayLocal, normalizeDateOnly } from '../dates/appDate';

export type CertificateExpirationStatus =
  | 'valid'
  | 'expiring-soon'
  | 'urgent'
  | 'expires-today'
  | 'expired'
  | 'unknown';

export type CertificateExpirationSeverity = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export type CertificateExpirationResult = {
  status: CertificateExpirationStatus;
  daysRemaining: number | null;
  expirationDate: string | null;
  sourceField: string | null;
  message: string;
  badgeLabel: string;
  severity: CertificateExpirationSeverity;
  sortPriority: number;
  warnings: string[];
};

const EXPIRATION_FIELD_PRIORITY = ['redeemByDate', 'expirationDate', 'expiresAt', 'expiryDate', 'sailByDate'] as const;

type ExpirationField = (typeof EXPIRATION_FIELD_PRIORITY)[number];

function readField(certificate: any, field: ExpirationField): unknown {
  if (!certificate || typeof certificate !== 'object') return undefined;
  return certificate[field] ?? certificate[field.toLowerCase()] ?? certificate[field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
}

export function getCertificateExpirationDate(certificate: any): {
  expirationDate: string | null;
  sourceField: string | null;
} {
  for (const field of EXPIRATION_FIELD_PRIORITY) {
    const rawValue = readField(certificate, field);
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') continue;
    const normalized = normalizeDateOnly(rawValue as string | Date);
    if (normalized) return { expirationDate: normalized, sourceField: field };
  }
  return { expirationDate: null, sourceField: null };
}

export function getCertificateDaysRemaining(certificate: any, today?: string): number | null {
  const { expirationDate } = getCertificateExpirationDate(certificate);
  const normalizedToday = normalizeDateOnly(today ?? getTodayLocal());
  if (!expirationDate || !normalizedToday) return null;
  return daysBetweenDates(normalizedToday, expirationDate);
}

export function getCertificateExpirationStatus(
  certificate: any,
  today?: string
): CertificateExpirationStatus {
  const daysRemaining = getCertificateDaysRemaining(certificate, today);
  if (daysRemaining === null) return 'unknown';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining === 0) return 'expires-today';
  if (daysRemaining <= 7) return 'urgent';
  if (daysRemaining <= 30) return 'expiring-soon';
  return 'valid';
}

export function getCertificateExpirationMessage(
  status: CertificateExpirationStatus,
  daysRemaining: number | null
): string {
  switch (status) {
    case 'valid':
      return 'Valid. No immediate action needed.';
    case 'expiring-soon':
      return 'Expiring soon. Review this certificate and decide whether to redeem it.';
    case 'urgent':
      return 'Urgent. This certificate expires within 7 days.';
    case 'expires-today':
      return 'Expires today. Redeem or contact your casino host now.';
    case 'expired':
      return 'Expired. Keep for records, but do not treat as usable unless verified by a host.';
    case 'unknown':
    default:
      return daysRemaining === null
        ? 'Expiration unknown. Add redeem-by or expiration date.'
        : 'Expiration status unknown. Review the certificate date.';
  }
}

function severityForStatus(status: CertificateExpirationStatus): CertificateExpirationSeverity {
  switch (status) {
    case 'valid':
      return 'green';
    case 'expiring-soon':
      return 'yellow';
    case 'urgent':
      return 'orange';
    case 'expires-today':
    case 'expired':
      return 'red';
    case 'unknown':
    default:
      return 'gray';
  }
}

function sortPriorityForStatus(status: CertificateExpirationStatus): number {
  switch (status) {
    case 'expires-today':
      return 1;
    case 'urgent':
      return 2;
    case 'expiring-soon':
      return 3;
    case 'valid':
      return 4;
    case 'unknown':
      return 5;
    case 'expired':
      return 6;
    default:
      return 99;
  }
}

function badgeForStatus(status: CertificateExpirationStatus, daysRemaining: number | null): string {
  switch (status) {
    case 'valid':
      return daysRemaining === null ? 'Valid' : `${daysRemaining} days left`;
    case 'expiring-soon':
      return daysRemaining === null ? 'Expiring soon' : `${daysRemaining} days left`;
    case 'urgent':
      return daysRemaining === null ? 'Urgent' : `${daysRemaining} days left`;
    case 'expires-today':
      return 'Expires today';
    case 'expired':
      return 'Expired';
    case 'unknown':
    default:
      return 'Expiration unknown';
  }
}

export function getCertificateExpirationResult(
  certificate: any,
  today?: string
): CertificateExpirationResult {
  const warnings: string[] = [];
  const { expirationDate, sourceField } = getCertificateExpirationDate(certificate);

  if (!expirationDate) {
    const hasBadDate = EXPIRATION_FIELD_PRIORITY.some((field) => {
      const rawValue = readField(certificate, field);
      return rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';
    });
    warnings.push(
      hasBadDate
        ? 'Expiration date field exists but could not be parsed.'
        : 'No certificate expiration date found.'
    );
  }

  const daysRemaining = getCertificateDaysRemaining(certificate, today);
  const status = getCertificateExpirationStatus(certificate, today);

  return {
    status,
    daysRemaining,
    expirationDate,
    sourceField,
    message: getCertificateExpirationMessage(status, daysRemaining),
    badgeLabel: badgeForStatus(status, daysRemaining),
    severity: severityForStatus(status),
    sortPriority: sortPriorityForStatus(status),
    warnings,
  };
}

export function sortCertificatesByExpirationUrgency<T>(certificates: T[], today?: string): T[] {
  return [...certificates].sort((a, b) => {
    const left = getCertificateExpirationResult(a, today);
    const right = getCertificateExpirationResult(b, today);
    if (left.sortPriority !== right.sortPriority) return left.sortPriority - right.sortPriority;
    const leftDays = left.daysRemaining ?? Number.POSITIVE_INFINITY;
    const rightDays = right.daysRemaining ?? Number.POSITIVE_INFINITY;
    return leftDays - rightDays;
  });
}
