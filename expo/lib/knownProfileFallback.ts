import type { BookedCruise } from '@/types/models';
import { ANNUAL_CASINO_REPORT_FACTS } from '@/lib/casinoAnnualReportFacts';

export { CONFIRMED_CLUB_ROYALE_2025_POINTS } from '@/lib/casinoPointTruth';

/**
 * User-confirmed per-cruise results for the current Club Royale earning year.
 * These are fallback records only: transactional/manual records are merged
 * later and therefore remain authoritative when the user edits a cruise.
 */
export const CURRENT_CLUB_ROYALE_CONFIRMED_CRUISES: BookedCruise[] = [
  { id: 'confirmed-quantum-2026-04-07', shipName: 'Quantum of the Seas', sailDate: '2026-04-07', returnDate: '2026-04-10', nights: 3, itineraryName: '3 Night Quantum of the Seas', destination: 'Club Royale current-year result', departurePort: '', status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal', casinoProgram: 'clubRoyale', guestNames: ['Scott Merlis'], guests: 1, pointsEarned: 800, earnedPoints: 800, casinoPoints: 800, winningsBroughtHome: 1000, winnings: 1000, totalWinnings: 1000, cashResult: 1000, netResult: 1000, sourceAuthority: 'user_entered', calculationConfidence: 'actual', notes: 'User-confirmed casino result. Gaming cash result is separate from cruise fare.' },
  { id: 'confirmed-quantum-2026-04-10', shipName: 'Quantum of the Seas', sailDate: '2026-04-10', returnDate: '2026-04-15', nights: 5, itineraryName: '5 Night Quantum of the Seas', destination: 'Club Royale current-year result', departurePort: '', status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal', casinoProgram: 'clubRoyale', guestNames: ['Scott Merlis'], guests: 1, pointsEarned: 3000, earnedPoints: 3000, casinoPoints: 3000, winningsBroughtHome: 1000, winnings: 1000, totalWinnings: 1000, cashResult: 1000, netResult: 1000, sourceAuthority: 'user_entered', calculationConfidence: 'actual', notes: 'User-confirmed casino result. Gaming cash result is separate from cruise fare.' },
  { id: 'confirmed-quantum-2026-04-15', shipName: 'Quantum of the Seas', sailDate: '2026-04-15', returnDate: '2026-04-21', nights: 6, itineraryName: '6 Night Quantum of the Seas', destination: 'Club Royale current-year result', departurePort: '', status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal', casinoProgram: 'clubRoyale', guestNames: ['Scott Merlis'], guests: 1, pointsEarned: 2000, earnedPoints: 2000, casinoPoints: 2000, winningsBroughtHome: 1215, winnings: 1215, totalWinnings: 1215, cashResult: 1215, netResult: 1215, sourceAuthority: 'user_entered', calculationConfidence: 'actual', notes: 'User-confirmed casino result. Gaming cash result is separate from cruise fare.' },
  { id: 'confirmed-quantum-2026-04-21', shipName: 'Quantum of the Seas', sailDate: '2026-04-21', returnDate: '2026-04-23', nights: 2, itineraryName: '2 Night Quantum of the Seas', destination: 'Club Royale current-year result', departurePort: '', status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal', casinoProgram: 'clubRoyale', guestNames: ['Scott Merlis'], guests: 1, pointsEarned: 860, earnedPoints: 860, casinoPoints: 860, winningsBroughtHome: 3500, winnings: 3500, totalWinnings: 3500, cashResult: 3500, netResult: 3500, sourceAuthority: 'user_entered', calculationConfidence: 'actual', notes: 'User-confirmed casino result. Gaming cash result is separate from cruise fare.' },
];

/**
 * A recognizable email is never authority to inject casino history. The old
 * implementation seeded a private annual report for every matching address,
 * including an otherwise empty profile. Historical casino data must now come
 * from that account's saved cruise, receipt, session, or explicit import data.
 */
export function isKnownCasinoProfile(_email?: string | null): boolean {
  return false;
}

export function getKnownCasinoProfileCruises(email?: string | null): BookedCruise[] {
  // Kept as a compatibility export for legacy callers. Never silently seed
  // private cruise history into a newly signed-in account.
  if (!isKnownCasinoProfile(email)) return [];
  return [...ANNUAL_CASINO_REPORT_FACTS.map((fact): BookedCruise => ({
    id: `annual-casino-${fact.sailDate}-${fact.ship.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    shipName: fact.ship,
    sailDate: fact.sailDate,
    returnDate: fact.returnDate,
    nights: fact.nights,
    itineraryName: `${fact.nights} Night ${fact.ship}`,
    destination: 'Annual Royal Caribbean Casino Report',
    departurePort: '',
    status: 'completed',
    completionState: 'completed',
    brand: 'Royal Caribbean',
    cruiseSource: 'royal',
    guestNames: ['Scott Merlis'],
    guests: 1,
    retailValue: fact.retailValue,
    totalRetailCost: fact.retailValue,
    originalPrice: fact.retailValue,
    amountPaid: fact.amountPaid,
    pricePaid: fact.amountPaid,
    netEffectivePaid: fact.amountPaid,
    winningsBroughtHome: fact.winningsBroughtHome,
    pointsEarned: fact.pointsEarned,
    earnedPoints: fact.pointsEarned,
    casinoPoints: fact.pointsEarned,
    cashResult: Math.round((fact.winningsBroughtHome - fact.amountPaid) * 100) / 100,
    calculationConfidence: fact.calculationConfidence,
    notes: fact.notes,
  })), ...CURRENT_CLUB_ROYALE_CONFIRMED_CRUISES];
}
