import { normalizeDateOnly } from '@/lib/dates/appDate';

type ItineraryDayLike = {
  day?: number;
  port?: string;
  isSeaDay?: boolean;
  arrival?: string;
  departure?: string;
};

type CruiseLike = {
  shipName?: string;
  sailDate?: string;
  returnDate?: string;
  nights?: number;
  itinerary?: ItineraryDayLike[];
  ports?: string[];
  itineraryName?: string;
  departurePort?: string;
};

export type CasinoOpportunityScore = {
  score: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  label: string;
  reasons: string[];
  warnings: string[];
  seaDays: number;
  restrictedDays: number;
  privateIslandDays: number;
};

function isPrivateIsland(port: string): boolean {
  const p = port.toLowerCase();
  return p.includes('perfect day') || p.includes('cococay') || p.includes('labadee') || p.includes('hideaway');
}

function isLikelyUSRestricted(port: string): boolean {
  const p = port.toLowerCase();
  return p.includes('miami') || p.includes('port canaveral') || p.includes('cape liberty') || p.includes('los angeles') || p.includes('seattle') || p.includes('san juan') || p.includes('key west') || p.includes('honolulu') || p.includes('alaska') || p.includes('boston');
}

export function calculateCasinoOpportunityScore(cruise?: CruiseLike | null): CasinoOpportunityScore {
  if (!cruise) {
    return { score: null, confidence: 'unknown', label: 'Unknown', reasons: [], warnings: ['No cruise data available.'], seaDays: 0, restrictedDays: 0, privateIslandDays: 0 };
  }

  const warnings: string[] = [];
  const reasons: string[] = [];
  const trustedDays = Array.isArray(cruise.itinerary) ? cruise.itinerary.filter(day => day && typeof day === 'object') : [];
  const nights = Number(cruise.nights ?? 0) || 0;
  let confidence: CasinoOpportunityScore['confidence'] = 'medium';

  if (trustedDays.length === 0) {
    warnings.push('No trusted day-by-day itinerary is available; loose port labels were not converted into a fabricated itinerary.');
    const baseScore = nights >= 7 ? 58 : nights >= 4 ? 48 : 38;
    return { score: baseScore, confidence: 'low', label: 'Needs itinerary detail', reasons: ['Score is based only on cruise length until day-by-day itinerary data is available.'], warnings, seaDays: 0, restrictedDays: 0, privateIslandDays: 0 };
  }

  let score = 50;
  let seaDays = 0;
  let restrictedDays = 0;
  let privateIslandDays = 0;

  trustedDays.forEach((day, index) => {
    const port = String(day.port ?? '').trim();
    const isEmbarkDebark = index === 0 || index === trustedDays.length - 1;
    if (day.isSeaDay || /sea day/i.test(port)) {
      seaDays += 1;
      score += 8;
    }
    if (isPrivateIsland(port)) {
      privateIslandDays += 1;
      score -= 5;
      reasons.push(`${port || 'Private island'} usually reduces full casino opportunity.`);
    }
    if (isEmbarkDebark || isLikelyUSRestricted(port)) {
      restrictedDays += 1;
      score -= isEmbarkDebark ? 6 : 4;
    }
    if (port && !day.arrival && !day.departure && !day.isSeaDay) warnings.push(`Missing port times for ${port}.`);
  });

  if (seaDays > 0) reasons.push(`${seaDays} sea day${seaDays === 1 ? '' : 's'} improve casino opportunity.`);
  if (restrictedDays > 0) reasons.push(`${restrictedDays} embarkation/debarkation or U.S.-restricted day${restrictedDays === 1 ? '' : 's'} reduce opportunity.`);
  if (warnings.length > 2) confidence = 'low';
  if (warnings.length === 0 && trustedDays.length >= Math.max(1, nights)) confidence = 'high';

  const normalizedSail = normalizeDateOnly(cruise.sailDate);
  if (cruise.shipName?.toLowerCase().includes('star') && normalizedSail === '2026-07-05') {
    reasons.push('Star of the Seas July 5, 2026 scoring must use Basseterre, St. Kitts & Nevis when itinerary data is present; Philipsburg is not fabricated.');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const label = finalScore >= 75 ? 'Strong casino opportunity' : finalScore >= 55 ? 'Good casino opportunity' : finalScore >= 40 ? 'Moderate casino opportunity' : 'Limited casino opportunity';
  return { score: finalScore, confidence, label, reasons, warnings, seaDays, restrictedDays, privateIslandDays };
}
