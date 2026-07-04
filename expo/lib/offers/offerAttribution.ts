import { classifyOfferCode } from '@/lib/offers/offerCodeClassifier';

export function attributeOfferToCruise(cruise: Record<string, unknown>) {
  const code = String(cruise.offerCode ?? cruise.instantCertificateOfferCode ?? cruise.packageCode ?? '').trim();
  const classification = classifyOfferCode(code);
  return {
    cruiseId: String(cruise.id ?? ''),
    offerCode: code || null,
    classification,
    pointCost: classification.pointsRequired ?? 0,
    source: code ? 'cruise-offer-code' : 'missing',
    confidence: classification.confidence,
    warnings: code ? [] : ['No offer code was found on this cruise.'],
  };
}
