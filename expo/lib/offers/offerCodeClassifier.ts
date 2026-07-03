export type OfferType =
  | 'instant-certificate'
  | 'marketing-offer'
  | 'annual-cruise'
  | 'fcc'
  | 'nextcruise'
  | 'freeplay-perk'
  | 'unknown';

export type OfferCodeClassification = {
  rawCode: string;
  normalizedCode: string;
  offerType: OfferType;
  isInstantCertificate: boolean;
  year?: number;
  month?: number;
  bank?: 'A' | 'C' | 'D';
  bankMeaning?: string;
  level?: string;
  requiredPoints?: number;
  pointsCost: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
};

export const INSTANT_CERTIFICATE_POINTS_LADDER: Record<string, number> = {
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

export function normalizeOfferCode(code?: string | null): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function getInstantCertificateBankMeaning(bank?: string): string | undefined {
  switch (String(bank || '').toUpperCase()) {
    case 'A': return 'Short-cruise monthly instant certificate bank';
    case 'C': return '7-night-or-longer monthly instant certificate bank';
    case 'D': return 'Europe / destination-specific monthly instant certificate bank';
    default: return undefined;
  }
}

function looksLikeAnnualCruise(text: string): boolean {
  return /ANNUAL|PINNACLE|SIGNATUREANNUAL|MASTERSANNUAL/.test(text);
}

function looksLikeFcc(text: string): boolean {
  return /FCC|FUTURECRUISECREDIT/.test(text);
}

function looksLikeNextCruise(text: string): boolean {
  return /NEXTCRUISE|NEXTCR/.test(text);
}

function looksLikeFreeplayPerk(text: string): boolean {
  return /FREEPLAY|FREEPLAY|FP\d+|CASINO\d+FP|CASINOFP|TBB\d*FP|OBC|CASINO75FP/.test(text);
}

export function classifyOfferCode(code?: string | null, context?: { offerName?: string | null; notes?: string | null; explicitType?: string | null }): OfferCodeClassification {
  const rawCode = String(code || '').trim();
  const normalizedCode = normalizeOfferCode(rawCode);
  const contextText = normalizeOfferCode(`${context?.explicitType || ''} ${context?.offerName || ''} ${context?.notes || ''}`);
  const warnings: string[] = [];

  if (!normalizedCode && !contextText) {
    return {
      rawCode,
      normalizedCode,
      offerType: 'unknown',
      isInstantCertificate: false,
      pointsCost: 0,
      confidence: 'low',
      warnings: ['No offer or certificate code is attached yet.'],
    };
  }

  const joined = `${normalizedCode} ${contextText}`;
  if (looksLikeAnnualCruise(joined)) {
    return { rawCode, normalizedCode, offerType: 'annual-cruise', isInstantCertificate: false, pointsCost: 0, confidence: 'high', warnings };
  }
  if (looksLikeFcc(joined)) {
    return { rawCode, normalizedCode, offerType: 'fcc', isInstantCertificate: false, pointsCost: 0, confidence: 'high', warnings: ['Future Cruise Credit is treated as a payment credit, not casino comp value.'] };
  }
  if (looksLikeNextCruise(joined)) {
    return { rawCode, normalizedCode, offerType: 'nextcruise', isInstantCertificate: false, pointsCost: 0, confidence: 'high', warnings };
  }
  if (looksLikeFreeplayPerk(joined) && !/^[0-9]{4}[ACD]/.test(normalizedCode)) {
    return { rawCode, normalizedCode, offerType: 'freeplay-perk', isInstantCertificate: false, pointsCost: 0, confidence: 'medium', warnings: ['This appears to be a FreePlay/OBC perk code, not a cruise booking certificate.'] };
  }

  const instantMatch = normalizedCode.match(/^([0-9]{2})([0-9]{2})([ACD])(VIP2|0[1-9]A?|10)$/);
  if (instantMatch) {
    const [, yy, mm, bankRaw, levelRaw] = instantMatch;
    const level = levelRaw.toUpperCase();
    const requiredPoints = INSTANT_CERTIFICATE_POINTS_LADDER[level];
    if (!requiredPoints) warnings.push(`Instant certificate level ${level} is not in the known point ladder.`);
    return {
      rawCode,
      normalizedCode,
      offerType: 'instant-certificate',
      isInstantCertificate: true,
      year: 2000 + Number(yy),
      month: Number(mm),
      bank: bankRaw as 'A' | 'C' | 'D',
      bankMeaning: getInstantCertificateBankMeaning(bankRaw),
      level,
      requiredPoints,
      pointsCost: requiredPoints || 0,
      confidence: requiredPoints ? 'high' : 'medium',
      warnings,
    };
  }

  if (normalizedCode) {
    return {
      rawCode,
      normalizedCode,
      offerType: 'marketing-offer',
      isInstantCertificate: false,
      pointsCost: 0,
      confidence: 'high',
      warnings: ['Non-instant certificate code classified as a marketing offer unless explicitly marked otherwise.'],
    };
  }

  return { rawCode, normalizedCode, offerType: 'unknown', isInstantCertificate: false, pointsCost: 0, confidence: 'low', warnings: ['No offer code found.'] };
}

export function formatOfferType(type: OfferType): string {
  switch (type) {
    case 'instant-certificate': return 'Instant Certificate';
    case 'marketing-offer': return 'Marketing Offer';
    case 'annual-cruise': return 'Annual Cruise';
    case 'fcc': return 'Future Cruise Credit';
    case 'nextcruise': return 'NextCruise';
    case 'freeplay-perk': return 'FreePlay / OBC Perk';
    default: return 'Unknown';
  }
}
