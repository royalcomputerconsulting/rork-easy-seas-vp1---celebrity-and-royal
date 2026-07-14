export type CertificateBank = 'A' | 'C';
export type CertificateFetchTarget = {
  monthCode: string;
  bank: CertificateBank;
  levelCode?: string;
  url: string;
  kind: 'index' | 'detail';
};

const BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const DEFAULT_LEVELS = ['VIP2', '01', '02', '02A', '03', '03A', '04', '05', '06', '07', '08', '09', '10'];

export const INSTANT_CERTIFICATE_POINT_LADDER: Record<string, number> = {
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

export function buildCertificateMonthCode(date: Date | string = new Date()): string {
  const parsed = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = String(safe.getFullYear()).slice(-2);
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function buildCertificateIndexUrl(monthCode: string, bank: CertificateBank): string {
  return `${BASE_URL}/${monthCode}${bank}.pdf`;
}

export function buildCertificateDetailUrl(monthCode: string, bank: CertificateBank, levelCode: string): string {
  return `${BASE_URL}/${monthCode}${bank}${levelCode}.pdf`;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return copy;
}

export function getThisMonthCertificateTargets(today: Date | string = new Date()): CertificateFetchTarget[] {
  const monthCode = buildCertificateMonthCode(today);
  return buildMonthTargets(monthCode);
}

export function getNextMonthCertificateTargets(today: Date | string = new Date()): CertificateFetchTarget[] {
  const base = today instanceof Date ? today : new Date(`${today}T00:00:00`);
  const monthCode = buildCertificateMonthCode(addMonths(Number.isNaN(base.getTime()) ? new Date() : base, 1));
  return buildMonthTargets(monthCode);
}

export function buildMonthTargets(monthCode: string, levels: string[] = DEFAULT_LEVELS): CertificateFetchTarget[] {
  const banks: CertificateBank[] = ['A', 'C'];
  const targets: CertificateFetchTarget[] = [];
  for (const bank of banks) {
    targets.push({ monthCode, bank, kind: 'index', url: buildCertificateIndexUrl(monthCode, bank) });
    for (const levelCode of levels) {
      targets.push({ monthCode, bank, levelCode, kind: 'detail', url: buildCertificateDetailUrl(monthCode, bank, levelCode) });
    }
  }
  return targets;
}
