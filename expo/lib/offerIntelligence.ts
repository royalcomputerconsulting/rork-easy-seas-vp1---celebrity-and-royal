import type { CasinoOffer, Cruise, TravelerProfile } from '@/types/models';
import { getCabinPriceFromEntity, getDoubleOccupancyRoomRetailValue } from '@/lib/valueCalculator';
import { getDaysUntil, formatDate } from '@/lib/date';
import { calculateSeaDayDensityScore, buildPortTracker, calculateShipFamiliarityScore } from '@/lib/cruisePlanningIntelligence';
import { knownGuestCount, knownNightCount } from '@/lib/cruiseRecordIntegrity';

export type OfferRatingLabel = 'Excellent' | 'Strong' | 'Average' | 'Weak' | 'Poor Use';
export type CommandCenterBucketId = 'expires7' | 'expires14' | 'expires30' | 'recentlyExpired' | 'needsReview';

export interface CertificateLike {
  id: string;
  type?: string;
  label?: string;
  value?: number;
  expiryDate?: string;
  status?: string;
  ownerProfileId?: string;
  sourceEmail?: string;
  casinoProgram?: string;
  offerCode?: string;
  cabinEntitlement?: string;
  description?: string;
}

export interface CasinoPaysForResult {
  retailCabinValue: number;
  taxesFees: number;
  upgradeCost: number;
  freePlay: number;
  onboardCredit: number;
  casinoCoveredValue: number;
  userOutOfPocket: number;
  effectiveSavingsPercentage: number;
  compEfficiencyRating: OfferRatingLabel;
  missingInputs: string[];
}

export interface OfferIntelligenceScore {
  score: number;
  rating: OfferRatingLabel;
  explanation: string;
  reasons: string[];
  casinoPaysFor: CasinoPaysForResult;
  daysUntilExpiration: number | null;
  profileMatch: boolean;
  brandLabel: string;
}

export interface DecodedOffer {
  title: string;
  bullets: string[];
  disclaimer: string;
}

export interface CertificateStackingNote {
  certificateId: string;
  label: string;
  recommendedAction: string;
  bestUseCases: string[];
  poorUseWarnings: string[];
  stackabilityNotes: string[];
  upgradeValueNotes: string[];
}

export interface CommandCenterOffer {
  offer: CasinoOffer;
  intelligence: OfferIntelligenceScore;
}

export interface CommandCenterBucket {
  id: CommandCenterBucketId;
  title: string;
  subtitle: string;
  offers: CommandCenterOffer[];
}

// Offer catalogs commonly contain hundreds or thousands of eligible sailing
// variants. Planning helpers such as buildPortTracker and
// calculateShipFamiliarityScore inspect the supplied collection, so mapping
// them over the entire collection turns a card score into O(n^2) work. That is
// enough to starve the JavaScript thread on a physical iPhone: native scrolling
// continues, but tab and button presses cannot be delivered. Use an evenly
// distributed, deterministic sample for planning-only factors while financial
// values and displayed sailing counts continue to use the complete catalog.
export const MAX_OFFER_PLANNING_SAMPLE_SIZE = 24;

function getRepresentativeCruiseSample(
  cruises: Cruise[],
  maximum = MAX_OFFER_PLANNING_SAMPLE_SIZE,
): Cruise[] {
  if (cruises.length <= maximum) return cruises;
  if (maximum <= 1) return cruises.slice(0, 1);

  const sampled: Cruise[] = [];
  const selectedIndexes = new Set<number>();
  const interval = (cruises.length - 1) / (maximum - 1);
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.round(index * interval);
    if (!selectedIndexes.has(sourceIndex)) {
      selectedIndexes.add(sourceIndex);
      sampled.push(cruises[sourceIndex]);
    }
  }
  return sampled;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRating(score: number): OfferRatingLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Average';
  if (score >= 30) return 'Weak';
  return 'Poor Use';
}

function getMoney(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function getOfferExpiryDate(offer: CasinoOffer | Cruise): string | undefined {
  return ('expiryDate' in offer ? offer.expiryDate : undefined) || ('expires' in offer ? offer.expires : undefined) || ('offerExpiryDate' in offer ? offer.offerExpiryDate : undefined) || ('offerExpiry' in offer ? offer.offerExpiry : undefined);
}

export function getOfferDisplayCode(offer: CasinoOffer | Cruise): string {
  return normalizeText(offer.offerCode) || normalizeText(offer.id) || 'Unknown';
}

export function getOfferDisplayName(offer: CasinoOffer | Cruise): string {
  return normalizeText(offer.offerName) || ('title' in offer ? normalizeText(offer.title) : '') || getOfferDisplayCode(offer);
}

export function getBrandLabel(brand: unknown): string {
  const normalized = normalizeLower(brand);
  if (normalized === 'royal') return 'Royal Caribbean / Club Royale';
  if (normalized === 'celebrity') return 'Celebrity / Blue Chip Club';
  if (normalized === 'carnival') return 'Carnival Players Club';
  if (normalized === 'silversea') return 'Silversea / Venetian Society';
  return 'Brand not identified';
}

function profileMatches(offer: CasinoOffer | Cruise, profile?: Partial<TravelerProfile> | null): boolean {
  if (!profile) return true;
  const owner = normalizeLower(offer.ownerProfileId);
  const sourceEmail = normalizeLower(offer.sourceEmail);
  const profileId = normalizeLower(profile.id);
  const profileEmail = normalizeLower(profile.email);
  if (!owner && !sourceEmail) return true;
  return owner === profileId || owner === profileEmail || sourceEmail === profileEmail;
}

function findAssociatedCruises(offer: CasinoOffer, cruises: Cruise[]): Cruise[] {
  const offerCode = normalizeLower(offer.offerCode);
  const explicitIds = new Set((offer.cruiseIds ?? []).map((id) => normalizeLower(id)));
  return cruises.filter((cruise) => {
    const cruiseCode = normalizeLower(cruise.offerCode);
    const cruiseId = normalizeLower(cruise.id);
    return (!!offerCode && cruiseCode === offerCode) || explicitIds.has(cruiseId) || cruise.id === offer.cruiseId;
  });
}

interface CruiseAssociationIndex {
  byId: Map<string, Cruise>;
  byInstance: Map<string, Cruise[]>;
  byCode: Map<string, Cruise[]>;
}

function appendIndexedCruise(index: Map<string, Cruise[]>, key: string, cruise: Cruise): void {
  if (!key) return;
  const rows = index.get(key);
  if (rows) rows.push(cruise);
  else index.set(key, [cruise]);
}

function getOfferInstanceKey(record: CasinoOffer | Cruise): string {
  return normalizeLower(record.playerOfferId || record.offerInstanceId || ('carnivalOfferId' in record ? record.carnivalOfferId : undefined));
}

function buildCruiseAssociationIndex(cruises: Cruise[]): CruiseAssociationIndex {
  const index: CruiseAssociationIndex = {
    byId: new Map<string, Cruise>(),
    byInstance: new Map<string, Cruise[]>(),
    byCode: new Map<string, Cruise[]>(),
  };

  for (const cruise of cruises) {
    const id = normalizeLower(cruise.id);
    if (id) index.byId.set(id, cruise);
    appendIndexedCruise(index.byInstance, getOfferInstanceKey(cruise), cruise);
    appendIndexedCruise(index.byCode, normalizeLower(cruise.offerCode), cruise);
  }

  return index;
}

function findAssociatedCruisesFromIndex(offer: CasinoOffer, index: CruiseAssociationIndex): Cruise[] {
  // Unique provider offer identity wins over a shared marketing code. This is
  // both faster and required for offers such as 2607TOR403 that legitimately
  // have multiple offer instances.
  const instanceKey = getOfferInstanceKey(offer);
  const instanceRows = instanceKey ? index.byInstance.get(instanceKey) ?? [] : [];
  if (instanceRows.length > 0) return instanceRows;

  const explicitIds = [offer.cruiseId, ...(offer.cruiseIds ?? [])]
    .map(normalizeLower)
    .filter(Boolean);
  if (explicitIds.length > 0) {
    const explicitRows = explicitIds
      .map((id) => index.byId.get(id))
      .filter((cruise): cruise is Cruise => Boolean(cruise));
    if (explicitRows.length > 0) return Array.from(new Map(explicitRows.map((cruise) => [cruise.id, cruise])).values());
  }

  const offerCode = normalizeLower(offer.offerCode);
  return offerCode ? index.byCode.get(offerCode) ?? [] : [];
}

function estimateTaxes(nights: number | undefined, guests: number | undefined): number {
  if (!nights || !guests) return 0;
  return Math.round(nights * 30 * guests);
}

function getCruiseRetailValue(cruise: Cruise, cabinType?: string): number {
  const targetCabin = cabinType || cruise.cabinType || 'Balcony';
  const roomCabinPrice = getCabinPriceFromEntity(cruise, targetCabin);
  if (roomCabinPrice && roomCabinPrice > 0) return roomCabinPrice;
  const explicitRoomValue = cruise.retailValue || cruise.originalPrice;
  if (explicitRoomValue && explicitRoomValue > 0) return explicitRoomValue;
  const roomValueFromPerPersonPrice = getDoubleOccupancyRoomRetailValue(cruise.price);
  if (roomValueFromPerPersonPrice && roomValueFromPerPersonPrice > 0) return roomValueFromPerPersonPrice;
  const baseNightly = normalizeLower(targetCabin).includes('suite') ? 350 : normalizeLower(targetCabin).includes('balcony') ? 180 : normalizeLower(targetCabin).includes('ocean') ? 140 : 100;
  const nights = knownNightCount(cruise.nights);
  const guests = knownGuestCount(cruise.guests);
  return nights && guests ? Math.round(baseNightly * nights * guests) : 0;
}

export function calculateCasinoPaysForOffer(offer: CasinoOffer, cruises: Cruise[] = []): CasinoPaysForResult {
  const associatedCruises = findAssociatedCruises(offer, cruises);
  const guests = knownGuestCount(offer.guests);
  const cabinType = offer.roomType || associatedCruises[0]?.cabinType || 'Balcony';
  const directCabinValue = getMoney(offer.retailCabinValue) || getMoney(offer.totalValue) || getMoney(offer.offerValue) || getMoney(offer.value);
  const cruiseCabinValues = associatedCruises.map((cruise) => getCruiseRetailValue(cruise, cabinType)).filter((value) => value > 0);
  const retailCabinValue = directCabinValue || (cruiseCabinValues.length > 0 ? Math.round(cruiseCabinValues.reduce((sum, value) => sum + value, 0) / cruiseCabinValues.length) : 0);
  const nights = knownNightCount(offer.nights) ?? knownNightCount(associatedCruises[0]?.nights);
  const taxesFees = getMoney(offer.taxesFees) || getMoney(offer.portCharges) || (associatedCruises[0] ? getMoney(associatedCruises[0].taxes) : 0) || estimateTaxes(nights, guests);
  const upgradeCost = getMoney((offer as unknown as Record<string, unknown>).upgradeCost) || Math.max(0, getMoney(offer.suitePrice) - getMoney(offer.balconyPrice));
  const freePlay = getMoney(offer.freePlay) || getMoney(offer.freeplayAmount);
  const onboardCredit = getMoney(offer.OBC) || getMoney(offer.obcAmount);
  const casinoCoveredValue = Math.max(0, retailCabinValue + freePlay + onboardCredit + getMoney(offer.tradeInValue));
  const userOutOfPocket = Math.max(0, taxesFees + upgradeCost);
  const denominator = casinoCoveredValue + userOutOfPocket;
  const effectiveSavingsPercentage = denominator > 0 ? Math.round((casinoCoveredValue / denominator) * 100) : 0;
  const missingInputs: string[] = [];
  if (!directCabinValue && cruiseCabinValues.length === 0) missingInputs.push('retail cabin value');
  if (!offer.taxesFees && !offer.portCharges && !associatedCruises[0]?.taxes) missingInputs.push(nights && guests ? 'exact taxes/fees (estimated)' : 'taxes/fees and duration or guest count');
  if (!offer.roomType && !associatedCruises[0]?.cabinType) missingInputs.push('included cabin type');
  const compEfficiencyRating = getRating(clamp(Math.round(effectiveSavingsPercentage * 0.9 + (freePlay + onboardCredit > 0 ? 8 : 0)), 0, 100));
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[OfferIntelligence] Casino Pays For calculated:', { offerCode: offer.offerCode, retailCabinValue, taxesFees, upgradeCost, freePlay, onboardCredit, casinoCoveredValue, userOutOfPocket, effectiveSavingsPercentage, missingInputs });
  return { retailCabinValue, taxesFees, upgradeCost, freePlay, onboardCredit, casinoCoveredValue, userOutOfPocket, effectiveSavingsPercentage, compEfficiencyRating, missingInputs };
}

function getCertificateFit(offer: CasinoOffer, certificates: CertificateLike[]): { score: number; count: number } {
  const offerCode = normalizeLower(offer.offerCode);
  const available = certificates.filter((certificate) => {
    const status = normalizeLower(certificate.status);
    const certOfferCode = normalizeLower(certificate.offerCode);
    const expiry = certificate.expiryDate ? getDaysUntil(certificate.expiryDate) : 999;
    return status !== 'used' && status !== 'expired' && expiry >= 0 && (!certOfferCode || certOfferCode === offerCode);
  });
  return { score: available.length > 0 ? 8 : 0, count: available.length };
}

function getSeaDayDensityScore(cruises: Cruise[]): number {
  if (cruises.length === 0) return 0;
  const representativeCruises = getRepresentativeCruiseSample(cruises);
  const scores = representativeCruises.map((cruise) => calculateSeaDayDensityScore(cruise).casinoOpportunityScore);
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length / 10);
}

function getPlanningIntelligenceBoost(cruises: Cruise[], offer: CasinoOffer, profile?: Partial<TravelerProfile> | null): { score: number; reasons: string[] } {
  if (cruises.length === 0) return { score: 0, reasons: [] };
  const representativeCruises = getRepresentativeCruiseSample(cruises);
  const seaScores = representativeCruises.map((cruise) => calculateSeaDayDensityScore(cruise).casinoOpportunityScore);
  const averageSeaScore = seaScores.reduce((sum, score) => sum + score, 0) / seaScores.length;
  const portTrackers = representativeCruises.map((cruise) => buildPortTracker(representativeCruises, cruise, profile));
  const bestNovelty = portTrackers.reduce((best, tracker) => Math.max(best, tracker.itineraryNoveltyScore), 0);
  const shipScores = representativeCruises.map((cruise) => calculateShipFamiliarityScore(cruise.shipName, representativeCruises, [offer], profile).score);
  const bestShipScore = shipScores.reduce((best, score) => Math.max(best, score), 0);
  const score = clamp(Math.round(averageSeaScore * 0.08 + bestNovelty * 0.04 + bestShipScore * 0.04), 0, 14);
  const reasons: string[] = [];
  if (averageSeaScore >= 65) reasons.push('Strong sea-day density improves casino opportunity.');
  if (bestNovelty >= 50) reasons.push('Itinerary includes meaningful new-port value.');
  if (bestShipScore >= 55) reasons.push('Ship familiarity supports easier planning.');
  if (representativeCruises.length < cruises.length) {
    reasons.push(`Planning factors use a representative sample of ${representativeCruises.length} of ${cruises.length} eligible sailings; counts and financial values still use the full catalog.`);
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[OfferIntelligence] Phase 3 planning boost:', { offerCode: offer.offerCode, averageSeaScore, bestNovelty, bestShipScore, score });
  return { score, reasons };
}

export function calculateOfferIntelligenceScore(
  offer: CasinoOffer,
  cruises: Cruise[] = [],
  certificates: CertificateLike[] = [],
  profile?: Partial<TravelerProfile> | null,
): OfferIntelligenceScore {
  const associatedCruises = findAssociatedCruises(offer, cruises);
  const casinoPaysFor = calculateCasinoPaysForOffer(offer, cruises);
  const expiryDate = getOfferExpiryDate(offer);
  const daysUntilExpiration = expiryDate ? getDaysUntil(expiryDate) : null;
  const reasons: string[] = [];
  let score = 35;
  score += clamp(Math.round(casinoPaysFor.effectiveSavingsPercentage * 0.35), 0, 35);
  if (casinoPaysFor.freePlay >= 500) score += 8;
  else if (casinoPaysFor.freePlay > 0) score += 4;
  if (casinoPaysFor.onboardCredit > 0) score += 4;
  if (casinoPaysFor.retailCabinValue >= 3000) score += 8;
  else if (casinoPaysFor.retailCabinValue >= 1500) score += 5;
  score += getSeaDayDensityScore(associatedCruises);
  const planningBoost = getPlanningIntelligenceBoost(associatedCruises, offer, profile);
  score += planningBoost.score;
  const certFit = getCertificateFit(offer, certificates);
  score += certFit.score;
  if (daysUntilExpiration !== null) {
    if (daysUntilExpiration < 0) score -= 45;
    else if (daysUntilExpiration <= 7) score += 5;
    else if (daysUntilExpiration <= 30) score += 3;
  } else {
    score -= 8;
  }
  if (offer.archiveStatus === 'archived' || offer.status === 'archived') score -= 40;
  if (offer.archiveStatus === 'reviewNeeded' || offer.status === 'reviewNeeded') score -= 10;
  const profileMatch = profileMatches(offer, profile);
  if (!profileMatch) score -= 12;
  const finalScore = clamp(Math.round(score), 0, 100);
  const rating = getRating(finalScore);
  if (casinoPaysFor.retailCabinValue > 0) reasons.push(`Cabin value estimated at $${casinoPaysFor.retailCabinValue.toLocaleString()}.`);
  if (casinoPaysFor.freePlay > 0) reasons.push(`Includes $${casinoPaysFor.freePlay.toLocaleString()} FreePlay.`);
  if (casinoPaysFor.onboardCredit > 0) reasons.push(`Includes $${casinoPaysFor.onboardCredit.toLocaleString()} onboard credit.`);
  if (daysUntilExpiration !== null && daysUntilExpiration >= 0) reasons.push(`Expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}.`);
  if (daysUntilExpiration !== null && daysUntilExpiration < 0) reasons.push('This offer is expired and should not be prioritized unless restored by the cruise line.');
  if (certFit.count > 0) reasons.push(`${certFit.count} available certificate${certFit.count === 1 ? '' : 's'} may fit, but stackability should be verified.`);
  if (!profileMatch) reasons.push('This offer appears to belong to a different selected profile or source email.');
  planningBoost.reasons.forEach((reason) => reasons.push(reason));
  if (casinoPaysFor.missingInputs.length > 0) reasons.push(`Missing ${casinoPaysFor.missingInputs.join(', ')}; score uses safe estimates.`);
  const explanation = `${rating} (${finalScore}/100): ${reasons[0] ?? 'Score is based on available cabin value, expiration, FreePlay, OBC, and profile ownership.'}`;
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[OfferIntelligence] Score calculated:', { offerCode: offer.offerCode, finalScore, rating, reasons });
  return {
    score: finalScore,
    rating,
    explanation,
    reasons,
    casinoPaysFor,
    daysUntilExpiration,
    profileMatch,
    brandLabel: getBrandLabel(offer.brand ?? offer.offerSource),
  };
}

export function decodeOffer(offer: CasinoOffer, cruises: Cruise[] = [], profile?: Partial<TravelerProfile> | null): DecodedOffer {
  const associatedCruises = findAssociatedCruises(offer, cruises);
  const paysFor = calculateCasinoPaysForOffer(offer, cruises);
  const expiryDate = getOfferExpiryDate(offer);
  const days = expiryDate ? getDaysUntil(expiryDate) : null;
  const owner = profileMatches(offer, profile) ? (profile?.displayName || profile?.email || 'selected profile') : (offer.sourceEmail || offer.ownerProfileId || 'another profile');
  const cabin = offer.roomType || associatedCruises[0]?.cabinType || 'included cabin not specified';
  const bullets = [
    `Cabin included: ${cabin}.`,
    `Owner/profile: ${owner}.`,
    `Who can sail: usually the named casino member plus eligible guest(s); verify exact guest rules with the cruise line.`,
    `You still pay about $${paysFor.userOutOfPocket.toLocaleString()} out of pocket based on available taxes/fees and upgrade data.`,
    `Casino-covered value is about $${paysFor.casinoCoveredValue.toLocaleString()} including cabin value, FreePlay, OBC, and trade-in value when present.`,
    paysFor.upgradeCost > 0 ? `Upgrade possibility: upgrade cost is estimated around $${paysFor.upgradeCost.toLocaleString()}.` : 'Upgrade possibility: no upgrade cost is currently recorded.',
    days === null ? 'Expiration: no exact expiration date was found.' : days < 0 ? `Expiration: expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.` : `Expiration: ${expiryDate ? formatDate(expiryDate, 'medium') : 'unknown'} (${days} day${days === 1 ? '' : 's'} left).`,
    `Strength/weakness: ${paysFor.compEfficiencyRating} comp efficiency with ${paysFor.effectiveSavingsPercentage}% effective savings.`,
  ];
  console.log('[OfferIntelligence] Offer decoded:', { offerCode: offer.offerCode, bullets });
  return {
    title: `Decoded ${getOfferDisplayCode(offer)}`,
    bullets,
    disclaimer: 'Cruise-line casino offers, certificate rules, blackout dates, taxes, fees, upgrades, and guest eligibility can change. Treat this as planning guidance and verify the official terms before booking.',
  };
}

export function buildCertificateStackingNotes(offer: CasinoOffer, certificates: CertificateLike[] = [], cruises: Cruise[] = []): CertificateStackingNote[] {
  const paysFor = calculateCasinoPaysForOffer(offer, cruises);
  const offerCode = normalizeLower(offer.offerCode);
  return certificates
    .filter((certificate) => normalizeLower(certificate.status) !== 'used')
    .map((certificate) => {
      const certOfferCode = normalizeLower(certificate.offerCode);
      const linkedToOffer = !!certOfferCode && certOfferCode === offerCode;
      const expiresSoon = certificate.expiryDate ? getDaysUntil(certificate.expiryDate) <= 30 : false;
      const label = certificate.label || certificate.type || 'Certificate';
      const value = getMoney(certificate.value);
      const recommendedAction = linkedToOffer
        ? 'Verify terms, then consider using this with the matching offer.'
        : value > 0 && paysFor.userOutOfPocket > 0
          ? 'Use only if the certificate can reduce taxes, fees, upgrade cost, or onboard spend.'
          : 'Keep as backup unless cruise-line terms confirm it stacks.';
      return {
        certificateId: certificate.id,
        label,
        recommendedAction,
        bestUseCases: [
          value > 0 ? `Best when it offsets at least $${value.toLocaleString()} of real cost.` : 'Best when it unlocks a cabin, FreePlay, OBC, or discount not already included.',
          linkedToOffer ? 'Best fit because the certificate references this offer code.' : 'Best fit after cruise-line confirmation that it applies to this sailing.',
          expiresSoon ? 'Use soon if the planned sailing is eligible before expiration.' : 'Save for higher out-of-pocket offers if this one is already heavily comped.',
        ],
        poorUseWarnings: [
          'Poor use if it replaces a stronger comp instead of stacking on top.',
          'Poor use if it forces a weaker cabin or worse sailing date.',
          'Do not assume certificates stack unless the terms or casino desk confirms it.',
        ],
        stackabilityNotes: [
          'Treat stacking as tentative until confirmed by Royal/Celebrity casino terms.',
          'Same-owner certificates are usually easier to apply than cross-profile certificates.',
          'If an offer is already fully comped, the best stack may be OBC, FreePlay, or upgrade value rather than cabin value.',
        ],
        upgradeValueNotes: [
          paysFor.upgradeCost > 0 ? `Potential upgrade offset target: $${paysFor.upgradeCost.toLocaleString()}.` : 'No upgrade cost is recorded yet.',
          'Compare certificate value against the lowest real cash cost, not only the headline cabin value.',
        ],
      };
    });
}

export function buildCommandCenterBuckets(offers: CasinoOffer[], cruises: Cruise[] = [], certificates: CertificateLike[] = [], profile?: Partial<TravelerProfile> | null): CommandCenterBucket[] {
  const buckets: CommandCenterBucket[] = [
    { id: 'expires7', title: 'Expires in 7 days', subtitle: 'Book, decode, archive, or skip now.', offers: [] },
    { id: 'expires14', title: 'Expires in 14 days', subtitle: 'High-priority offers that need a decision soon.', offers: [] },
    { id: 'expires30', title: 'Expires in 30 days', subtitle: 'Planning window for useful comps.', offers: [] },
    { id: 'recentlyExpired', title: 'Recently expired', subtitle: 'Review before archiving or asking the casino desk.', offers: [] },
    { id: 'needsReview', title: 'Needs review', subtitle: 'Missing dates, uncertain ownership, or import reconciliation flags.', offers: [] },
  ];
  const associationIndex = buildCruiseAssociationIndex(cruises);
  offers.forEach((offer) => {
    if (offer.archiveStatus === 'archived' || offer.status === 'archived' || offer.status === 'skipped' || offer.archiveStatus === 'replaced') return;
    const associatedCruises = findAssociatedCruisesFromIndex(offer, associationIndex);
    const intelligence = calculateOfferIntelligenceScore(offer, associatedCruises, certificates, profile);
    const item = { offer, intelligence };
    const days = intelligence.daysUntilExpiration;
    if (offer.archiveStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || days === null) buckets[4].offers.push(item);
    else if (days < 0 && days >= -30) buckets[3].offers.push(item);
    else if (days >= 0 && days <= 7) buckets[0].offers.push(item);
    else if (days <= 14) buckets[1].offers.push(item);
    else if (days <= 30) buckets[2].offers.push(item);
  });
  const sortedBuckets = buckets.map((bucket) => ({ ...bucket, offers: bucket.offers.sort((a, b) => b.intelligence.score - a.intelligence.score) }));
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[OfferIntelligence] Command Center buckets built:', sortedBuckets.map((bucket) => ({ id: bucket.id, count: bucket.offers.length })));
  return sortedBuckets;
}
