import { DEFAULT_CERTIFICATE_FAMILIES, DEFAULT_CERTIFICATE_POINTS, type CertificateFamily } from '@/lib/certificates/certificatePdfParserCore';
export type CertificateBank = CertificateFamily;
export type CertificateFetchTarget = { monthCode: string; bank: CertificateBank; levelCode?: string; url: string; kind: 'index' | 'detail'; };
const BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const DEFAULT_LEVELS = Object.keys(DEFAULT_CERTIFICATE_POINTS);
export const INSTANT_CERTIFICATE_POINT_LADDER: Record<string, number> = { ...DEFAULT_CERTIFICATE_POINTS };
export function buildCertificateMonthCode(date: Date | string = new Date()): string { const parsed = date instanceof Date ? date : new Date(`${date}T00:00:00`); const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed; return `${String(safe.getFullYear()).slice(-2)}${String(safe.getMonth() + 1).padStart(2, '0')}`; }
export function buildCertificateIndexUrl(monthCode: string, bank: CertificateBank): string { return `${BASE_URL}/${monthCode}${String(bank).toUpperCase()}.pdf`; }
export function buildCertificateDetailUrl(monthCode: string, bank: CertificateBank, levelCode: string): string { return `${BASE_URL}/${monthCode}${String(bank).toUpperCase()}${levelCode}.pdf`; }
function addMonths(date: Date, months: number): Date { return new Date(date.getFullYear(), date.getMonth() + months, 1); }
export function getThisMonthCertificateTargets(today: Date | string = new Date()): CertificateFetchTarget[] { return buildMonthTargets(buildCertificateMonthCode(today)); }
export function getNextMonthCertificateTargets(today: Date | string = new Date()): CertificateFetchTarget[] { const base = today instanceof Date ? today : new Date(`${today}T00:00:00`); return buildMonthTargets(buildCertificateMonthCode(addMonths(Number.isNaN(base.getTime()) ? new Date() : base, 1))); }
export function buildMonthTargets(monthCode: string, levels: string[] = DEFAULT_LEVELS, banks: CertificateBank[] = DEFAULT_CERTIFICATE_FAMILIES): CertificateFetchTarget[] { const targets: CertificateFetchTarget[] = []; for (const bank of banks) { targets.push({ monthCode, bank, kind: 'index', url: buildCertificateIndexUrl(monthCode, bank) }); for (const levelCode of levels) targets.push({ monthCode, bank, levelCode, kind: 'detail', url: buildCertificateDetailUrl(monthCode, bank, levelCode) }); } return targets; }
