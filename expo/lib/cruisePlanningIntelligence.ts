import type { CasinoOffer, Cruise, TravelerProfile } from '@/types/models';
import { createDateFromString, getDaysUntil } from '@/lib/date';
import { calculateCasinoAvailabilityForCruise } from '@/lib/casinoAvailability';
import { knownNightCount } from '@/lib/cruiseRecordIntegrity';

export type ShipFamiliarityRating = 'New Ship' | 'Familiar' | 'Very Familiar' | 'Home Ship';

export interface CruiseDayPlan {
  day: number;
  port: string;
  isSeaDay: boolean;
  isEmbarkation: boolean;
  isDisembarkation: boolean;
}

export interface SeaDayDensityResult {
  isItineraryKnown: boolean;
  seaDays: number;
  portDays: number;
  overnightPorts: number;
  embarkationValue: number;
  disembarkationValue: number;
  sailingLength: number;
  likelyCasinoOpenDays: number;
  casinoOpportunityScore: number;
  explanation: string;
}

export interface PortTrackerResult {
  visitedPorts: string[];
  embarkationPorts: string[];
  countriesVisited: string[];
  portVisitCounts: { port: string; count: number }[];
  newPorts: string[];
  repeatedItineraries: string[];
  itineraryNoveltyScore: number;
  unknownHistory: boolean;
}

export interface ShipFamiliarityResult {
  shipName: string;
  timesSailed: number;
  nightsOnboard: number;
  upcomingBookings: number;
  pastBookings: number;
  offersAvailable: number;
  cabinHistory: string[];
  machineNotes?: string;
  rating: ShipFamiliarityRating;
  score: number;
  explanation: string;
}

export interface ReplacementCandidate {
  cruise: Cruise;
  offerOwner: string;
  offerCode: string;
  offerScore: number;
  seaDayDensityScore: number;
  casinoPaysForSummary: string;
  reasonBetterWorse: string;
  warnings: string[];
  rankScore: number;
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

function dateOnly(value: string | undefined): string {
  if (!value) return '';
  const parsed = createDateFromString(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function profileMatches(record: Cruise | CasinoOffer, profile?: Partial<TravelerProfile> | null): boolean {
  if (!profile) return true;
  const owner = normalizeLower(record.ownerProfileId);
  const sourceEmail = normalizeLower(record.sourceEmail);
  const profileId = normalizeLower(profile.id);
  const profileEmail = normalizeLower(profile.email);
  if (!owner && !sourceEmail) return true;
  return owner === profileId || owner === profileEmail || sourceEmail === profileEmail;
}

function isSeaPort(port: string): boolean {
  const normalized = normalizeLower(port);
  return normalized === 'at sea' || normalized === 'sea day' || normalized === 'cruising' || normalized.includes('at sea') || normalized.includes('sea day');
}

function splitPortsAndTimes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|>/)
    .map((line) => line.split(/[;|\t]/)[0]?.trim() ?? '')
    .filter(Boolean);
}

export function deriveCruiseDayPlan(cruise: Cruise): CruiseDayPlan[] {
  const explicitItinerary = cruise.itinerary?.slice().sort((left, right) => left.day - right.day) ?? [];
  if (explicitItinerary.length > 0) {
    const maxDay = Math.max(...explicitItinerary.map((day) => day.day), cruise.nights + 1);
    return explicitItinerary.map((day) => ({
      day: day.day,
      port: day.port || (day.isSeaDay ? 'At Sea' : 'Port'),
      isSeaDay: day.isSeaDay || isSeaPort(day.port),
      isEmbarkation: day.day === 1,
      isDisembarkation: day.day === maxDay,
    }));
  }

  const rawPorts = cruise.itineraryRaw && cruise.itineraryRaw.length > 0
    ? cruise.itineraryRaw
    : splitPortsAndTimes(cruise.portsAndTimes);
  const ports = rawPorts.length > 0 ? rawPorts : (cruise.ports ?? []);
  const totalDays = Math.max(1, (cruise.nights || Math.max(ports.length - 1, 1)) + 1);

  if (ports.length > 0) {
    return ports.map((port, index) => ({
      day: index + 1,
      port,
      isSeaDay: isSeaPort(port),
      isEmbarkation: index === 0,
      isDisembarkation: index === ports.length - 1 || index + 1 === totalDays,
    }));
  }

  return Array.from({ length: totalDays }).map((_, index) => ({
    day: index + 1,
    port: index === 0 ? (cruise.departurePort || 'Embarkation') : index === totalDays - 1 ? (cruise.departurePort || 'Disembarkation') : 'Unknown day',
    isSeaDay: false,
    isEmbarkation: index === 0,
    isDisembarkation: index === totalDays - 1,
  }));
}

export function calculateSeaDayDensityScore(cruise: Cruise): SeaDayDensityResult {
  const casinoSummary = calculateCasinoAvailabilityForCruise(cruise, undefined, { quiet: true });
  const sailingLength = Math.max(1, cruise.nights || Math.max(casinoSummary.totalDays - 1, 1));
  const explicitSeaDays = Number.isFinite(Number(cruise.seaDays)) ? Math.max(0, Number(cruise.seaDays)) : null;
  const explicitPortDays = Number.isFinite(Number(cruise.portDays)) ? Math.max(0, Number(cruise.portDays)) : null;
  const hasOperationalItinerary = casinoSummary.totalDays > 0;
  const hasExplicitDayCounts = (explicitSeaDays ?? 0) + (explicitPortDays ?? 0) > 0;
  const isItineraryKnown = hasOperationalItinerary || hasExplicitDayCounts;
  const dayPlan = hasOperationalItinerary ? deriveCruiseDayPlan(cruise) : [];
  const voyageDays = dayPlan.filter((day) => !day.isDisembarkation && !/^unknown day$/i.test(day.port));
  const derivedSeaDays = voyageDays.filter((day) => day.isSeaDay).length;
  const derivedPortDays = voyageDays.filter((day) => !day.isSeaDay).length;
  const useDerivedCounts = hasOperationalItinerary && casinoSummary.seaDays + casinoSummary.portDays === 0 && voyageDays.length > 0;
  const seaDays = explicitSeaDays != null && explicitSeaDays + (explicitPortDays ?? 0) > 0
    ? explicitSeaDays
    : useDerivedCounts ? derivedSeaDays : casinoSummary.seaDays;
  const portDays = explicitPortDays != null && (explicitSeaDays ?? 0) + explicitPortDays > 0
    ? explicitPortDays
    : useDerivedCounts ? derivedPortDays : casinoSummary.portDays;
  const overnightPorts = casinoSummary.overnightPorts;
  const embarkationValue = casinoSummary.dailyAvailability[0]?.casinoOpen || voyageDays.some((day) => day.isEmbarkation) ? 0.5 : 0;
  const disembarkationValue = 0;
  const likelyCasinoOpenDays = hasExplicitDayCounts && !hasOperationalItinerary
    ? seaDays + portDays
    : useDerivedCounts ? seaDays + portDays : casinoSummary.casinoOpenDays;
  const maxCasinoHours = Math.max(1, sailingLength * 16);
  const estimatedCasinoHours = hasExplicitDayCounts && !hasOperationalItinerary
    ? (seaDays * 16) + (portDays * 6)
    : useDerivedCounts ? (seaDays * 16) + (portDays * 6) : casinoSummary.estimatedCasinoHours;
  const casinoOpportunityScore = clamp(Math.round((estimatedCasinoHours / maxCasinoHours) * 100), 0, 100);
  const sourceLabel = hasExplicitDayCounts && !hasOperationalItinerary
    ? 'saved day counts'
    : useDerivedCounts
    ? 'saved cruise itinerary'
    : casinoSummary.totalDays > 0
      ? 'operational itinerary'
      : 'missing itinerary';
  const explanation = `${seaDays} sea day${seaDays === 1 ? '' : 's'}, ${portDays} port day${portDays === 1 ? '' : 's'}, ${overnightPorts} overnight port${overnightPorts === 1 ? '' : 's'}; casino opportunity spans ${likelyCasinoOpenDays} voyage day${likelyCasinoOpenDays === 1 ? '' : 's'} for ~${estimatedCasinoHours} estimated hours (${sourceLabel}).`;

  return {
    isItineraryKnown,
    seaDays,
    portDays,
    overnightPorts,
    embarkationValue,
    disembarkationValue,
    sailingLength,
    likelyCasinoOpenDays,
    casinoOpportunityScore,
    explanation,
  };
}

function getPortCountry(port: string): string | null {
  const parts = port.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}

export function buildPortTracker(cruises: Cruise[], targetCruise?: Cruise, profile?: Partial<TravelerProfile> | null): PortTrackerResult {
  const scopedCruises = cruises.filter((cruise) => profileMatches(cruise, profile));
  const targetPorts = targetCruise ? deriveCruiseDayPlan(targetCruise).filter((day) => !day.isSeaDay).map((day) => day.port) : [];
  const targetPortSet = new Set(targetPorts.map(normalizeLower));
  const portCounts = new Map<string, { port: string; count: number }>();
  const embarkationPorts = new Set<string>();
  const countries = new Set<string>();
  const itineraryCounts = new Map<string, number>();

  scopedCruises.forEach((cruise) => {
    if (cruise.departurePort) embarkationPorts.add(cruise.departurePort);
    const ports = deriveCruiseDayPlan(cruise).filter((day) => !day.isSeaDay).map((day) => day.port).filter(Boolean);
    const itineraryKey = ports.map(normalizeLower).join('|');
    if (itineraryKey) itineraryCounts.set(itineraryKey, (itineraryCounts.get(itineraryKey) ?? 0) + 1);
    ports.forEach((port) => {
      const normalized = normalizeLower(port);
      if (!normalized) return;
      const current = portCounts.get(normalized) ?? { port, count: 0 };
      current.count += 1;
      portCounts.set(normalized, current);
      const country = getPortCountry(port);
      if (country) countries.add(country);
    });
  });

  const visitedPorts = Array.from(portCounts.values()).map((entry) => entry.port).sort();
  const newPorts = targetPorts.filter((port) => !portCounts.has(normalizeLower(port)) || (targetCruise && targetPortSet.has(normalizeLower(port)) && portCounts.get(normalizeLower(port))?.count === 1));
  const repeatedItineraries = Array.from(itineraryCounts.entries()).filter((entry) => entry[1] > 1).map((entry) => entry[0].split('|').join(' → '));
  const knownTargetPorts = targetPorts.filter((port) => portCounts.has(normalizeLower(port))).length;
  const itineraryNoveltyScore = targetCruise && targetPorts.length > 0 ? clamp(Math.round((newPorts.length / targetPorts.length) * 100), 0, 100) : 0;
  const unknownHistory = scopedCruises.length === 0 || visitedPorts.length === 0 || (targetCruise ? knownTargetPorts === 0 && newPorts.length === 0 : false);

  return {
    visitedPorts,
    embarkationPorts: Array.from(embarkationPorts).sort(),
    countriesVisited: Array.from(countries).sort(),
    portVisitCounts: Array.from(portCounts.values()).sort((left, right) => right.count - left.count),
    newPorts,
    repeatedItineraries,
    itineraryNoveltyScore,
    unknownHistory,
  };
}

export function calculateShipFamiliarityScore(shipName: string, cruises: Cruise[], offers: CasinoOffer[] = [], profile?: Partial<TravelerProfile> | null): ShipFamiliarityResult {
  const normalizedShip = normalizeLower(shipName);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const matchingCruises = cruises.filter((cruise) => normalizeLower(cruise.shipName) === normalizedShip && profileMatches(cruise, profile));
  const pastBookings = matchingCruises.filter((cruise) => {
    const returnDate = createDateFromString(cruise.returnDate || cruise.sailDate);
    return !Number.isNaN(returnDate.getTime()) && returnDate < now;
  }).length;
  const upcomingBookings = matchingCruises.length - pastBookings;
  const nightsOnboard = matchingCruises.reduce((sum, cruise) => sum + (cruise.nights || 0), 0);
  const offersAvailable = offers.filter((offer) => normalizeLower(offer.shipName) === normalizedShip && profileMatches(offer, profile)).length;
  const cabinHistory = Array.from(new Set(matchingCruises.map((cruise) => normalizeText(cruise.cabinType)).filter(Boolean)));
  const timesSailed = matchingCruises.length;
  const score = clamp(Math.round(timesSailed * 18 + nightsOnboard * 1.2 + upcomingBookings * 6 + offersAvailable * 4), 0, 100);
  const rating: ShipFamiliarityRating = score >= 80 ? 'Home Ship' : score >= 55 ? 'Very Familiar' : score >= 25 ? 'Familiar' : 'New Ship';
  const explanation = `${rating}: ${timesSailed} sailing${timesSailed === 1 ? '' : 's'}, ${nightsOnboard} night${nightsOnboard === 1 ? '' : 's'} onboard, ${upcomingBookings} upcoming booking${upcomingBookings === 1 ? '' : 's'}, ${offersAvailable} available offer${offersAvailable === 1 ? '' : 's'}.`;

  return {
    shipName,
    timesSailed,
    nightsOnboard,
    upcomingBookings,
    pastBookings,
    offersAvailable,
    cabinHistory,
    machineNotes: cabinHistory.length > 0 ? `Cabin history: ${cabinHistory.join(', ')}` : undefined,
    rating,
    score,
    explanation,
  };
}

function isUsableReplacementOffer(offer: CasinoOffer, profile?: Partial<TravelerProfile> | null): boolean {
  if (!profileMatches(offer, profile)) return false;
  const status = normalizeLower(offer.status);
  if (['expired', 'used', 'booked', 'archived', 'replaced', 'skipped'].includes(status)) return false;
  const expiryDate = offer.expiryDate || offer.expires || offer.offerExpiryDate || offer.validUntil;
  if (expiryDate) {
    const parsedExpiry = createDateFromString(expiryDate);
    if (!Number.isNaN(parsedExpiry.getTime()) && getDaysUntil(expiryDate) < 0) return false;
  }
  return true;
}

function isUsableReplacementCruise(cruise: Cruise, profile?: Partial<TravelerProfile> | null): boolean {
  if (!profileMatches(cruise, profile)) return false;
  const status = normalizeLower(cruise.status);
  return !['booked', 'completed', 'cancelled', 'archived'].includes(status);
}

type ReplacementSource = {
  cruise: Cruise;
  offer: CasinoOffer;
};

function isReplacementSource(source: { cruise: Cruise; offer?: CasinoOffer }, profile?: Partial<TravelerProfile> | null): source is ReplacementSource {
  if (!source.offer) return false;
  return isUsableReplacementCruise(source.cruise, profile) && isUsableReplacementOffer(source.offer, profile);
}

function estimateOutOfPocket(cruise: Cruise, offer?: CasinoOffer): number {
  const nights = knownNightCount(cruise.nights) ?? knownNightCount(offer?.nights);
  const taxes = cruise.taxes ?? offer?.taxesFees ?? offer?.portCharges ?? (nights ? Math.round(nights * 60) : 0);
  const cabin = cruise.price ?? cruise.totalPrice ?? 0;
  return Math.max(0, taxes + cabin);
}

function estimateOfferScore(cruise: Cruise, offer?: CasinoOffer): number {
  const seaScore = calculateSeaDayDensityScore(cruise).casinoOpportunityScore;
  const freePlay = offer?.freePlay ?? offer?.freeplayAmount ?? cruise.freePlay ?? 0;
  const obc = offer?.OBC ?? offer?.obcAmount ?? cruise.freeOBC ?? 0;
  const expiryDays = offer ? getDaysUntil(offer.expiryDate || offer.expires || offer.offerExpiryDate || '') : null;
  let score = 35 + Math.round(seaScore * 0.25);
  if (freePlay > 0) score += freePlay >= 500 ? 12 : 6;
  if (obc > 0) score += 6;
  if (cruise.tradeInValue && cruise.tradeInValue > 0) score += 8;
  if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 30) score += 5;
  if (expiryDays !== null && expiryDays < 0) score -= 35;
  return clamp(score, 0, 100);
}

export function findCruiseReplacementCandidates(currentCruise: Cruise, alternatives: Cruise[], offers: CasinoOffer[] = [], history: Cruise[] = [], profile?: Partial<TravelerProfile> | null): ReplacementCandidate[] {
  const addToIndex = <T>(index: Map<string, T[]>, key: string, value: T) => {
    if (!key) return;
    const existing = index.get(key);
    if (existing) existing.push(value);
    else index.set(key, [value]);
  };

  const usableOffers = offers.filter((offer) => isUsableReplacementOffer(offer, profile));
  const offersByCruiseId = new Map<string, CasinoOffer[]>();
  const offersByCode = new Map<string, CasinoOffer[]>();
  const offersBySailing = new Map<string, CasinoOffer[]>();
  usableOffers.forEach((offer) => {
    addToIndex(offersByCruiseId, normalizeLower(offer.cruiseId), offer);
    (offer.cruiseIds ?? []).forEach((cruiseId) => addToIndex(offersByCruiseId, normalizeLower(cruiseId), offer));
    addToIndex(offersByCode, normalizeLower(offer.offerCode), offer);
    addToIndex(offersBySailing, `${normalizeLower(offer.shipName)}|${dateOnly(offer.sailingDate)}`, offer);
  });

  const resolveIndexedOffer = (cruise: Cruise): CasinoOffer | undefined => {
    const cruiseIdMatches = offersByCruiseId.get(normalizeLower(cruise.id)) ?? [];
    if (cruiseIdMatches.length > 0) return cruiseIdMatches[0];

    const sailingKey = `${normalizeLower(cruise.shipName)}|${dateOnly(cruise.sailDate)}`;
    const codeMatches = offersByCode.get(normalizeLower(cruise.offerCode)) ?? [];
    if (codeMatches.length === 1) return codeMatches[0];
    if (codeMatches.length > 1) {
      const materialCodeMatch = codeMatches.find((offer) => `${normalizeLower(offer.shipName)}|${dateOnly(offer.sailingDate)}` === sailingKey);
      if (materialCodeMatch) return materialCodeMatch;
    }

    return (offersBySailing.get(sailingKey) ?? [])[0];
  };

  const historyPortTracker = buildPortTracker(history, undefined, profile);
  const visitedPortSet = new Set(historyPortTracker.visitedPorts.map(normalizeLower));
  const getNovelty = (cruise: Cruise): { newPorts: string[]; itineraryNoveltyScore: number } => {
    const targetPorts = deriveCruiseDayPlan(cruise)
      .filter((day) => !day.isSeaDay && !day.isEmbarkation && !day.isDisembarkation)
      .map((day) => day.port)
      .filter(Boolean);
    const newPorts = targetPorts.filter((port) => !visitedPortSet.has(normalizeLower(port)));
    return {
      newPorts,
      itineraryNoveltyScore: targetPorts.length > 0 ? clamp(Math.round((newPorts.length / targetPorts.length) * 100), 0, 100) : 0,
    };
  };

  const shipFamiliarityCache = new Map<string, ShipFamiliarityResult>();
  const getShipFamiliarity = (shipName: string): ShipFamiliarityResult => {
    const key = normalizeLower(shipName);
    const cached = shipFamiliarityCache.get(key);
    if (cached) return cached;
    const calculated = calculateShipFamiliarityScore(shipName, history, usableOffers, profile);
    shipFamiliarityCache.set(key, calculated);
    return calculated;
  };

  const currentSea = calculateSeaDayDensityScore(currentCruise);
  const currentOutOfPocket = estimateOutOfPocket(currentCruise, resolveIndexedOffer(currentCruise));
  const currentPorts = getNovelty(currentCruise);
  const currentShip = getShipFamiliarity(currentCruise.shipName);

  const candidates = alternatives
    .map((cruise) => ({ cruise, offer: resolveIndexedOffer(cruise) }))
    .filter((source): source is ReplacementSource => {
      const sailDate = createDateFromString(source.cruise.sailDate);
      return source.cruise.id !== currentCruise.id && !Number.isNaN(sailDate.getTime()) && getDaysUntil(source.cruise.sailDate) >= 0 && isReplacementSource(source, profile);
    })
    .map(({ cruise, offer }) => {
      const sea = calculateSeaDayDensityScore(cruise);
      const ports = getNovelty(cruise);
      const ship = getShipFamiliarity(cruise.shipName);
      const offerScore = estimateOfferScore(cruise, offer);
      const outOfPocket = estimateOutOfPocket(cruise, offer);
      const betterSeaDays = sea.casinoOpportunityScore - currentSea.casinoOpportunityScore;
      const betterCash = currentOutOfPocket - outOfPocket;
      const newPortDelta = ports.itineraryNoveltyScore - currentPorts.itineraryNoveltyScore;
      const shipDelta = ship.score - currentShip.score;
      const rankScore = clamp(offerScore + betterSeaDays * 0.25 + Math.min(20, betterCash / 50) + newPortDelta * 0.12 + shipDelta * 0.08, 0, 100);
      const warnings: string[] = [];
      if (outOfPocket > currentOutOfPocket) warnings.push(`Higher out-of-pocket by USD ${Math.round(outOfPocket - currentOutOfPocket).toLocaleString()}.`);
      if (sea.casinoOpportunityScore < currentSea.casinoOpportunityScore) warnings.push('Lower sea-day casino opportunity than the current booking.');
      const reasonParts = [
        betterSeaDays > 0 ? `better casino opportunity (+${Math.round(betterSeaDays)})` : betterSeaDays < 0 ? `lower casino opportunity (${Math.round(betterSeaDays)})` : 'similar sea-day profile',
        betterCash > 0 ? `lower out-of-pocket by $${Math.round(betterCash).toLocaleString()}` : betterCash < 0 ? `higher out-of-pocket by $${Math.round(Math.abs(betterCash)).toLocaleString()}` : 'similar out-of-pocket',
        ports.newPorts.length > 0 ? `${ports.newPorts.length} new port${ports.newPorts.length === 1 ? '' : 's'}` : 'no clear new-port gain',
        ship.rating,
      ];

      return {
        cruise,
        offerOwner: offer.sourceEmail || offer.ownerProfileId || cruise.sourceEmail || cruise.ownerProfileId || 'Unassigned',
        offerCode: offer.offerCode || cruise.offerCode || 'Offer record',
        offerScore,
        seaDayDensityScore: sea.casinoOpportunityScore,
        casinoPaysForSummary: `Casino opportunity ${sea.likelyCasinoOpenDays}/${sea.sailingLength}; estimated out-of-pocket ${Math.round(outOfPocket).toLocaleString()}.`,
        reasonBetterWorse: reasonParts.join(' • '),
        warnings,
        rankScore,
      };
    })
    .sort((left, right) => right.rankScore - left.rankScore)
    .slice(0, 6);

  console.log('[CruisePlanning] Replacement candidates built:', {
    currentCruiseId: currentCruise.id,
    alternatives: alternatives.length,
    usableOffers: usableOffers.length,
    candidates: candidates.length,
    source: 'indexed-usable-offer-records',
  });
  return candidates;
}
