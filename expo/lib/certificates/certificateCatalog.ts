export type CertificateType = 'A' | 'C';

export interface CertificateCatalogEntry {
  certificateCode: string;
  certificateType: CertificateType;
  level: string;
  points: number;
  pdfUrl: string;
  monthlyIndexUrl: string;
  sailingsFound?: number;
  status?: string;
}

export const CERTIFICATE_CATALOG_VERSION = 'v12.3.8-certificate-offer-catalog-chat';

export const CERTIFICATE_LEVELS: { suffix: string; points: number }[] = [
  { suffix: 'VIP2', points: 40000 },
  { suffix: '01', points: 25000 },
  { suffix: '02', points: 15000 },
  { suffix: '02A', points: 9000 },
  { suffix: '03', points: 6500 },
  { suffix: '03A', points: 4000 },
  { suffix: '04', points: 3000 },
  { suffix: '05', points: 2000 },
  { suffix: '06', points: 1500 },
  { suffix: '07', points: 1200 },
  { suffix: '08', points: 800 },
  { suffix: '09', points: 600 },
  { suffix: '10', points: 400 },
];

export const ROYAL_CERTIFICATE_BROAD_SHIP_QUERY = 'Star, Legend, Icon, Wonder, Utopia, Symphony, Harmony, Allure, Oasis, Odyssey, Anthem, Ovation, Quantum, Spectrum, Navigator, Voyager, Mariner, Explorer, Adventure, Freedom, Liberty, Independence, Enchantment, Grandeur, Rhapsody, Vision, Radiance, Brilliance, Serenade, Jewel';

export function buildCertificatePdfUrl(code: string): string {
  return `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/${code.toUpperCase()}.pdf`;
}

export function getMonthCodeForTarget(target: 'thisMonth' | 'nextMonth', now = new Date()): string {
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  const year = String(base.getFullYear()).slice(-2);
  const month = String(base.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function getMonthLabelForTarget(target: 'thisMonth' | 'nextMonth', now = new Date()): string {
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function buildCertificateCatalog(monthCode: string, certificateType: CertificateType): CertificateCatalogEntry[] {
  const normalizedMonth = monthCode.toUpperCase().replace(/[^0-9]/g, '').slice(0, 4);
  const monthlyIndexUrl = buildCertificatePdfUrl(`${normalizedMonth}${certificateType}`);
  return CERTIFICATE_LEVELS.map(({ suffix, points }) => {
    const certificateCode = `${normalizedMonth}${certificateType}${suffix}`.toUpperCase();
    return {
      certificateCode,
      certificateType,
      level: suffix,
      points,
      pdfUrl: buildCertificatePdfUrl(certificateCode),
      monthlyIndexUrl,
    };
  });
}

export function formatCertificatePoints(points: number | null | undefined): string {
  if (points == null) return 'Points unknown';
  return `${points.toLocaleString()} Points`;
}
