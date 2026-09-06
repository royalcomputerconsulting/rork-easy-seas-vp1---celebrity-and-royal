import { Linking, Platform } from 'react-native';
import { classifyCertificateFamily, isCertificateCode, type CertificateFamily } from '@/lib/certificates/certificatePdfPipeline';

const CERTIFICATE_PDF_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const DIRECT_CERTIFICATE_CODE_REGEX = /\b(\d{4}[A-Z][A-Z0-9]{0,8})\b/i;

export interface CertificatePdfMatch {
  certificateCode: string;
  certificateType: CertificateFamily;
  certificateFamily: CertificateFamily;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

function normalizeCandidate(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function buildCertificatePdfUrl(code: string): string {
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

    if (!isCertificateCode(certificateCode)) {
      console.log('[CertificatePdf] Ignoring non-certificate offer code:', {
        offerCode: input.offerCode,
        offerName: input.offerName,
        code: certificateCode,
      });
      continue;
    }

    const certificateFamily = classifyCertificateFamily(certificateCode);
    const monthPrefix = certificateCode.slice(0, 4);

    console.log('[CertificatePdf] Matched certificate PDF:', {
      offerCode: input.offerCode,
      offerName: input.offerName,
      certificateCode,
      certificateFamily,
    });

    return {
      certificateCode,
      certificateType: certificateFamily,
      certificateFamily,
      pdfUrl: buildCertificatePdfUrl(certificateCode),
      monthlyIndexUrl: buildCertificatePdfUrl(`${monthPrefix}${certificateFamily === 'unclassified' ? certificateCode[4] : certificateFamily}`),
    };
  }

  console.log('[CertificatePdf] No certificate PDF match found:', {
    offerCode: input.offerCode,
    offerName: input.offerName,
  });

  return null;
}

export async function openCertificatePdf(url: string, fallbackUrl?: string): Promise<void> {
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

  if (url.startsWith('file://')) {
    const FileSystem = require('expo-file-system/legacy') as { getInfoAsync?: (uri: string) => Promise<{ exists?: boolean }> };
    const fileInfo = await FileSystem.getInfoAsync?.(url).catch(() => ({ exists: false }));
    if (!fileInfo?.exists) {
      if (fallbackUrl && !fallbackUrl.startsWith('file://')) {
        console.warn('[CertificatePdf] Retained PDF is missing; opening the official Royal source instead.', { url, fallbackUrl });
        await Linking.openURL(fallbackUrl);
        return;
      }
      throw new Error('The retained certificate PDF file is missing. Use Download Missing / Retry Failed to restore it.');
    }
    const Sharing = require('expo-sharing') as {
      isAvailableAsync: () => Promise<boolean>;
      shareAsync: (localUrl: string, options?: { mimeType?: string; UTI?: string; dialogTitle?: string }) => Promise<void>;
    };

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(url, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Open retained certificate PDF',
      });
      return;
    }
    throw new Error('The retained certificate PDF cannot be opened on this device.');
  }

  await Linking.openURL(url);
}
