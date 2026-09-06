import type { LocalCertificateLevel, LocalCertificateSailingMatch } from '@/lib/certificates/certificateSailingIndex';
import type { RecommendationConfidence } from '@/types/intelligence';

export interface CertificateRedemptionPreference {
  certificateCode: string;
  expiryDate?: string;
  airfareBySailing?: Record<string, number>;
  taxesBySailing?: Record<string, number>;
  upgradeBySailing?: Record<string, number>;
  blackoutSailingKeys?: string[];
  preferredShips?: string[];
  preferredItineraries?: string[];
  excludedShips?: string[];
  excludedDeparturePorts?: string[];
  scheduleConflictSailingKeys?: string[];
  maxTravelCost?: number;
  requiredGuestCount?: number;
  weights?: Partial<Record<'cabin' | 'guests' | 'itinerary' | 'travelCost' | 'schedule' | 'expiration' | 'scarcity' | 'ship', number>>;
}

export interface CertificateRedemptionRecommendation {
  sailingKey: string;
  shipName: string;
  sailDate: string;
  certificateCode: string;
  cabinLabel: string | null;
  guestCount: number | null;
  departurePort: string | null;
  itinerary: string | null;
  expectedOutOfPocket: number;
  benefitValue: number;
  opportunityScore: number;
  confidence: RecommendationConfidence;
  reasons: string[];
  missingData: string[];
  rankingFactors: Array<{ id: string; label: string; score: number; weight: number; explanation: string }>;
  hardExclusionReasons: string[];
  scarcity: number;
  alternativeReason: string;
}

export interface CertificateRedemptionEvaluation {
  recommendations: CertificateRedemptionRecommendation[];
  excluded: CertificateRedemptionRecommendation[];
}

const amount = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const keyFor = (match: Pick<LocalCertificateSailingMatch, 'shipName' | 'sailDate'>) => `${match.shipName.trim().toLowerCase()}__${match.sailDate.slice(0, 10)}`;

function findLevel(match: LocalCertificateSailingMatch, code: string): LocalCertificateLevel | undefined {
  return match.levels.find((level) => level.certificateCode.trim().toUpperCase() === code.trim().toUpperCase());
}

export function evaluateCertificateRedemptions(
  sailings: LocalCertificateSailingMatch[],
  preference: CertificateRedemptionPreference,
  now = new Date(),
): CertificateRedemptionEvaluation {
  const blackouts = new Set(preference.blackoutSailingKeys ?? []);
  const preferredShips = new Set((preference.preferredShips ?? []).map((ship) => ship.trim().toLowerCase()));
  const preferredItineraries = (preference.preferredItineraries ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  const excludedShips = new Set((preference.excludedShips ?? []).map((ship) => ship.trim().toLowerCase()));
  const excludedPorts = new Set((preference.excludedDeparturePorts ?? []).map((port) => port.trim().toLowerCase()));
  const conflicts = new Set(preference.scheduleConflictSailingKeys ?? []);
  const weights = { cabin: 1, guests: 1, itinerary: 1, travelCost: 1, schedule: 1, expiration: 1, scarcity: 1, ship: 1, ...(preference.weights ?? {}) };
  const expiry = preference.expiryDate ? Date.parse(preference.expiryDate) : null;
  const codeSailingCount = Math.max(1, sailings.filter((match) => Boolean(findLevel(match, preference.certificateCode))).length);
  const evaluated = sailings.flatMap((match): CertificateRedemptionRecommendation[] => {
    const level = findLevel(match, preference.certificateCode);
    if (!level) return [];
    const sailingKey = keyFor(match);
    const sailTime = Date.parse(match.sailDate);
    const hardExclusionReasons: string[] = [];
    if (blackouts.has(sailingKey)) hardExclusionReasons.push('Sailing is on the user exclusion list.');
    if (expiry !== null && Number.isFinite(sailTime) && sailTime > expiry) hardExclusionReasons.push('Sailing begins after certificate expiration.');
    if (excludedShips.has(match.shipName.trim().toLowerCase())) hardExclusionReasons.push('Ship is excluded by the user.');
    if (level.departurePort && excludedPorts.has(level.departurePort.trim().toLowerCase())) hardExclusionReasons.push('Departure port is excluded by the user.');
    if (conflicts.has(sailingKey)) hardExclusionReasons.push('Sailing conflicts with the saved schedule.');
    if (preference.requiredGuestCount && (level.guestCount == null || level.guestCount < preference.requiredGuestCount)) hardExclusionReasons.push(`Offer does not confirm eligibility for ${preference.requiredGuestCount} guests.`);
    const airfare = preference.airfareBySailing?.[sailingKey];
    const taxes = preference.taxesBySailing?.[sailingKey];
    const upgrade = preference.upgradeBySailing?.[sailingKey];
    const missingData = [airfare == null ? 'airfare' : '', taxes == null ? 'taxes and fees' : '', upgrade == null ? 'incremental upgrade cost' : ''].filter(Boolean);
    const expectedOutOfPocket = amount(airfare) + amount(taxes) + amount(upgrade);
    if (preference.maxTravelCost != null && expectedOutOfPocket > preference.maxTravelCost) hardExclusionReasons.push(`Recorded trip cost exceeds the ${preference.maxTravelCost.toLocaleString('en-US',{style:'currency',currency:'USD'})} limit.`);
    const benefitValue = amount(level.freePlay) + amount(level.onBoardCredit);
    const scarcity = Math.max(0, Math.min(100, Math.round(100 / codeSailingCount)));
    if (hardExclusionReasons.length) return [{
      sailingKey,
      shipName: match.shipName,
      sailDate: match.sailDate,
      certificateCode: level.certificateCode,
      cabinLabel: level.cabinLabel,
      guestCount: level.guestCount,
      departurePort: level.departurePort,
      itinerary: level.itinerary,
      expectedOutOfPocket,
      benefitValue,
      opportunityScore: 0,
      confidence: missingData.length === 0 ? 'high' : missingData.length <= 1 ? 'medium' : 'low',
      reasons: [`${level.cabinLabel || 'Cabin entitlement not recorded'} · ${level.guestCount == null ? 'guest eligibility not recorded' : `${level.guestCount} guest(s)`}.`],
      missingData,
      rankingFactors: [
        { id: 'cabin', label: 'Cabin entitlement', score: level.cabinLabel ? 12 : 0, weight: weights.cabin, explanation: level.cabinLabel ?? 'Cabin missing' },
        { id: 'guests', label: 'Guest eligibility', score: level.guestCount ? Math.min(12, level.guestCount * 6) : 0, weight: weights.guests, explanation: level.guestCount ? `${level.guestCount} guest(s)` : 'Guest count missing' },
        { id: 'travelCost', label: 'Travel cost', score: 0, weight: weights.travelCost, explanation: missingData.length ? `Incomplete cost: ${missingData.join(', ')}` : `Recorded trip cost ${expectedOutOfPocket.toLocaleString('en-US',{style:'currency',currency:'USD'})}.` },
      ],
      hardExclusionReasons,
      scarcity,
      alternativeReason: 'Excluded before ranking; change the saved constraint only if this option should become eligible.',
    }];
    const preferredBonus = preferredShips.has(match.shipName.trim().toLowerCase()) ? 12 : 0;
    const soonBonus = Number.isFinite(sailTime) ? Math.max(0, 12 - Math.max(0, sailTime - now.getTime()) / 86_400_000 / 30) : 0;
    const valueScore = Math.min(55, Math.max(0, (benefitValue - expectedOutOfPocket) / 25));
    const itineraryMatch = preferredItineraries.length > 0 && preferredItineraries.some((term) => String(level.itinerary ?? '').toLowerCase().includes(term));
    const factorRows = [
      { id:'cabin',label:'Cabin entitlement',score:level.cabinLabel?12:0,weight:weights.cabin,explanation:level.cabinLabel??'Cabin missing' },
      { id:'guests',label:'Guest eligibility',score:level.guestCount?Math.min(12,level.guestCount*6):0,weight:weights.guests,explanation:level.guestCount?`${level.guestCount} guest(s)`:'Guest count missing' },
      { id:'itinerary',label:'Itinerary fit',score:itineraryMatch?12:preferredItineraries.length?0:6,weight:weights.itinerary,explanation:itineraryMatch?'Matches a preferred itinerary.':preferredItineraries.length?'No preferred-itinerary match.':'No itinerary preference set.' },
      { id:'travelCost',label:'Travel cost',score:Math.max(0,15-expectedOutOfPocket/100),weight:weights.travelCost,explanation:missingData.length?`Incomplete cost: ${missingData.join(', ')}`:`Recorded trip cost ${expectedOutOfPocket.toLocaleString('en-US',{style:'currency',currency:'USD'})}.` },
      { id:'schedule',label:'Schedule fit',score:12,weight:weights.schedule,explanation:'No saved conflict or hard exclusion.' },
      { id:'expiration',label:'Expiration fit',score:soonBonus,weight:weights.expiration,explanation:expiry==null?'Expiration not recorded.':'Sailing is inside the expiration window.' },
      { id:'scarcity',label:'Scarcity',score:scarcity/10,weight:weights.scarcity,explanation:`${codeSailingCount} eligible option(s) at this certificate level.` },
      { id:'ship',label:'Ship preference',score:preferredBonus,weight:weights.ship,explanation:preferredBonus?'Matches a preferred ship.':'No preferred-ship bonus applied.' },
      { id:'value',label:'Recorded benefit less cost',score:valueScore,weight:1,explanation:`Recorded FreePlay/OBC less recorded trip costs.` },
    ];
    const weightedTotal=factorRows.reduce((sum,factor)=>sum+factor.score*Math.max(0,factor.weight),0);
    const weightTotal=factorRows.reduce((sum,factor)=>sum+Math.max(0,factor.weight),0);
    const opportunityScore = Math.round(Math.max(0, Math.min(100, weightTotal?weightedTotal/weightTotal*6:0)));
    return [{
      sailingKey,
      shipName: match.shipName,
      sailDate: match.sailDate,
      certificateCode: level.certificateCode,
      cabinLabel: level.cabinLabel,
      guestCount: level.guestCount,
      departurePort: level.departurePort,
      itinerary: level.itinerary,
      expectedOutOfPocket,
      benefitValue,
      opportunityScore,
      confidence: missingData.length === 0 ? 'high' : missingData.length <= 1 ? 'medium' : 'low',
      reasons: [
        `${level.cabinLabel || 'Saved cabin entitlement'} on ${match.shipName}.`,
        `${benefitValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} saved free play/OBC value.`,
        preferredBonus ? 'Matches a preferred ship.' : 'No preferred-ship bonus applied.',
      ],
      missingData,
      rankingFactors: factorRows,
      hardExclusionReasons,
      scarcity,
      alternativeReason: 'Alternative retained because the highest-ranked option may be impractical after travel, schedule, or availability verification.',
    }];
  });
  const recommendations = evaluated
    .filter((result) => result.hardExclusionReasons.length === 0)
    .sort((left, right) => right.opportunityScore - left.opportunityScore || left.sailDate.localeCompare(right.sailDate))
    .map((result,index)=>({...result,alternativeReason:index===0?'Highest-ranked practical option from currently saved evidence.':`Alternative #${index+1}; compare its travel, schedule, cabin, and guest tradeoffs with the top option.`}));
  const excluded = evaluated
    .filter((result) => result.hardExclusionReasons.length > 0)
    .sort((left, right) => left.sailDate.localeCompare(right.sailDate));
  return { recommendations, excluded };
}

export function optimizeCertificateRedemption(
  sailings: LocalCertificateSailingMatch[],
  preference: CertificateRedemptionPreference,
  now = new Date(),
): CertificateRedemptionRecommendation[] {
  return evaluateCertificateRedemptions(sailings, preference, now).recommendations;
}
