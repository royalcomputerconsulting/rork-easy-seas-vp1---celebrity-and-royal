import { Linking, Platform } from 'react-native';

const CERTIFICATE_PDF_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const DIRECT_CERTIFICATE_CODE_REGEX = /\b(\d{4}[AC][A-Z0-9]{1,8})\b/i;

export interface CertificatePdfMatch {
  certificateCode: string;
  certificateType: 'A' | 'C';
  pdfUrl: string;
  monthlyIndexUrl: string;
}

function normalizeCandidate(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

function buildCertificatePdfUrl(code: string): string {
  return `${CERTIFICATE_PDF_BASE_URL}/${code}.pdf`;
}

export function getCertificatePdfMatch(input: {
  offerCode?: string | null;
  offerName?: string | null;
}): CertificatePdfMatch | null {
  const candidates = [normalizeCandidate(input.offerCode), normalizeCandidate(input.offerName)].filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(DIRECT_CERTIFICATE_CODE_REGEX);
    const certificateCode = match?.[1]?.toUpperCase();

    if (!certificateCode) {
      continue;
    }

    const certificateType = certificateCode[4] === 'C' ? 'C' : 'A';
    const monthPrefix = certificateCode.slice(0, 4);

    console.log('[CertificatePdf] Matched certificate PDF:', {
      offerCode: input.offerCode,
      offerName: input.offerName,
      certificateCode,
      certificateType,
    });

    return {
      certificateCode,
      certificateType,
      pdfUrl: buildCertificatePdfUrl(certificateCode),
      monthlyIndexUrl: buildCertificatePdfUrl(`${monthPrefix}${certificateType}`),
    };
  }

  console.log('[CertificatePdf] No certificate PDF match found:', {
    offerCode: input.offerCode,
    offerName: input.offerName,
  });

  return null;
}

export async function openCertificatePdf(url: string): Promise<void> {
  console.log('[CertificatePdf] Opening certificate PDF:', url);

  if (Platform.OS === 'web') {
    const webGlobal = globalThis as typeof globalThis & {
      open?: (url?: string | URL, target?: string, features?: string) => Window | null;
    };

    if (typeof webGlobal.open === 'function') {
      webGlobal.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
  }

  await Linking.openURL(url);
}
