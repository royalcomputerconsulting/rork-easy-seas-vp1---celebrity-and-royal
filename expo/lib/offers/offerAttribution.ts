import { classifyOfferCode, formatOfferType, type OfferCodeClassification } from './offerCodeClassifier';

export type BookedCruiseOfferAttribution = {
  cruiseId: string;
  shipName: string;
  sailDate: string;
  reservationNumber?: string;
  offerCode: string | null;
  offerName: string | null;
  offerType: string;
  classification: OfferCodeClassification;
  isInstantCertificate: boolean;
  certificateLevel?: string;
  certificateBank?: 'A' | 'C' | 'D';
  pointsRequired: number;
  marketingOffer: boolean;
  annualCruiseBenefit: boolean;
  fccApplied: boolean;
  nextCruiseApplied: boolean;
  source: 'invoice' | 'booking' | 'offer-row' | 'certificate-row' | 'manual' | 'inferred' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
};

function firstString(...values: any[]): string | null {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
}

export function extractOfferCodeFromCruise(cruise: any): { code: string | null; source: BookedCruiseOfferAttribution['source'] } {
  const fields: [string, BookedCruiseOfferAttribution['source']][] = [
    ['bookingOfferCode', 'booking'],
    ['offerCode', 'booking'],
    ['certificateCode', 'certificate-row'],
    ['instantCertificateOfferCode', 'certificate-row'],
    ['casinoOfferCode', 'offer-row'],
    ['promoCode', 'invoice'],
    ['bookingCode', 'invoice'],
    ['cruiseOfferCode', 'offer-row'],
    ['offer', 'booking'],
    ['cruiseOffer', 'booking'],
  ];
  for (const [field, source] of fields) {
    const text = String(cruise?.[field] ?? '').trim();
    if (text) return { code: text, source };
  }
  const notes = `${cruise?.notes || ''} ${cruise?.invoiceNotes || ''} ${cruise?.bookingNotes || ''}`;
  const match = notes.match(/\b(\d{4}[ACD](?:VIP2|0[1-9]A?|10)|\d{2}[A-Z]{2,}[0-9]{3}|[A-Z]{2,}\d{3,})\b/i);
  if (match) return { code: match[1], source: 'inferred' };
  return { code: null, source: 'unknown' };
}

export function buildBookedCruiseOfferAttribution(cruise: any): BookedCruiseOfferAttribution {
  const extracted = extractOfferCodeFromCruise(cruise);
  const offerName = firstString(cruise?.bookingOfferName, cruise?.offerName, cruise?.certificateName, cruise?.promotionName);
  const classification = classifyOfferCode(extracted.code, {
    offerName,
    notes: `${cruise?.notes || ''} ${cruise?.bookingNotes || ''} ${cruise?.invoiceNotes || ''}`,
    explicitType: cruise?.bookingOfferType || cruise?.offerType,
  });
  const warnings = [...classification.warnings];
  if (!extracted.code) warnings.push('Offer code missing for this booked cruise.');
  return {
    cruiseId: String(cruise?.id || `${cruise?.shipName || 'cruise'}-${cruise?.sailDate || cruise?.startDate || ''}`),
    shipName: String(cruise?.shipName || cruise?.ship || 'Unknown ship'),
    sailDate: String(cruise?.sailDate || cruise?.startDate || cruise?.departureDate || ''),
    reservationNumber: firstString(cruise?.reservationNumber, cruise?.reservationId, cruise?.bookingNumber) || undefined,
    offerCode: extracted.code,
    offerName,
    offerType: formatOfferType(classification.offerType),
    classification,
    isInstantCertificate: classification.isInstantCertificate,
    certificateLevel: classification.level,
    certificateBank: classification.bank,
    pointsRequired: classification.pointsCost || 0,
    marketingOffer: classification.offerType === 'marketing-offer',
    annualCruiseBenefit: classification.offerType === 'annual-cruise' || Boolean(cruise?.annualCruiseBenefitType || cruise?.annualCruiseValue),
    fccApplied: classification.offerType === 'fcc' || Number(cruise?.fccApplied || cruise?.futureCruiseCreditApplied || 0) > 0,
    nextCruiseApplied: classification.offerType === 'nextcruise' || Number(cruise?.nextCruiseApplied || cruise?.nextCruiseCertificateValue || 0) > 0,
    source: extracted.source,
    confidence: extracted.source === 'unknown' ? 'low' : classification.confidence,
    warnings,
  };
}

export function buildBookedCruiseOfferAttributions(cruises: any[] = []): BookedCruiseOfferAttribution[] {
  return cruises.map(buildBookedCruiseOfferAttribution);
}
