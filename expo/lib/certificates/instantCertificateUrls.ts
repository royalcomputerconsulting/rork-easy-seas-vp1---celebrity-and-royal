export type CertificateBank = 'A' | 'C' | 'D';
export type CertificateFetchTarget = {
  monthCode: string;
  year: number;
  month: number;
  bank: CertificateBank;
  levelCode?: string;
  url: string;
  kind: 'index' | 'detail';
};

export const CERTIFICATE_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/';
export const INSTANT_CERTIFICATE_LEVEL_CODES = ['VIP2', '01', '02', '02A', '03', '03A', '04', '05', '06', '07', '08', '09', '10'] as const;
export type InstantCertificateLevelCode = typeof INSTANT_CERTIFICATE_LEVEL_CODES[number];

export const INSTANT_CERTIFICATE_POINTS: Record<InstantCertificateLevelCode, number> = {
  VIP2: 40000,
  '01': 25000,
  '02': 15000,
  '02A': 9000,
  '03': 6500,
  '03A': 4000,
  '04': 3000,
  '05': 2000,
  '06': 1500,
  '07': 1200,
  '08': 800,
  '09': 600,
  '10': 400,
};

function toDate(input?: Date | string): Date {
  if (!input) return new Date();
  if (input instanceof Date) return input;
  const parsed = new Date(`${input}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(input);
}

export function buildCertificateMonthCode(date: Date | string): string {
  const parsed = toDate(date);
  const year = String(parsed.getFullYear()).slice(-2);
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function parseCertificateMonthCode(monthCode: string): { year: number; month: number } {
  const match = String(monthCode).match(/^(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Invalid certificate month code: ${monthCode}`);
  return { year: 2000 + Number(match[1]), month: Number(match[2]) };
}

export function buildCertificateIndexUrl(monthCode: string, bank: CertificateBank): string {
  return `${CERTIFICATE_BASE_URL}${monthCode}${bank}.pdf`;
}

export function buildCertificateDetailUrl(monthCode: string, bank: CertificateBank, levelCode: string): string {
  return `${CERTIFICATE_BASE_URL}${monthCode}${bank}${String(levelCode).toUpperCase()}.pdf`;
}

function monthOffset(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function buildTargetsForMonth(date: Date | string, banks: CertificateBank[] = ['A', 'C', 'D']): CertificateFetchTarget[] {
  const monthCode = buildCertificateMonthCode(date);
  const parsed = parseCertificateMonthCode(monthCode);
  return banks.flatMap((bank) => [
    { monthCode, ...parsed, bank, url: buildCertificateIndexUrl(monthCode, bank), kind: 'index' as const },
    ...INSTANT_CERTIFICATE_LEVEL_CODES.map((levelCode) => ({
      monthCode,
      ...parsed,
      bank,
      levelCode,
      url: buildCertificateDetailUrl(monthCode, bank, levelCode),
      kind: 'detail' as const,
    })),
  ]);
}

export function getThisMonthCertificateTargets(today?: string): CertificateFetchTarget[] {
  return buildTargetsForMonth(toDate(today));
}

export function getNextMonthCertificateTargets(today?: string): CertificateFetchTarget[] {
  return buildTargetsForMonth(monthOffset(toDate(today), 1));
}
