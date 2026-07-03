import type { BookedCruise } from '@/types/models';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { CRUISE_HISTORY_SUPPLEMENT_DATA } from '@/mocks/cruiseHistorySupplement';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import {
  applyFreeplayOBCData,
  applyKnownRetailValues,
  enrichCruisesWithMockItineraries,
  enrichCruisesWithReceiptData,
} from '@/state/coreData/dataEnrichment';
import { normalizeCruiseCasinoPerformance } from '@/lib/casinoPointTruth';

const KNOWN_CASINO_PROFILE_EMAILS = new Set<string>([
  'scott.merlis1@gmail.com',
  's@a.com',
]);

export { CONFIRMED_CLUB_ROYALE_2025_POINTS } from '@/lib/casinoPointTruth';

export function isKnownCasinoProfile(email?: string | null): boolean {
  const normalizedEmail = email?.toLowerCase().trim() ?? '';
  return KNOWN_CASINO_PROFILE_EMAILS.has(normalizedEmail);
}

export function getKnownCasinoProfileCruises(email?: string | null): BookedCruise[] {
  if (!isKnownCasinoProfile(email)) {
    return [];
  }

  const rawCruises: BookedCruise[] = [
    ...COMPLETED_CRUISES_DATA,
    ...BOOKED_CRUISES_DATA,
    ...CRUISE_HISTORY_SUPPLEMENT_DATA,
  ];

  const dedupedCruises = dedupeBookedCruises(rawCruises, 'known casino profile cruise fallback');
  const withItineraries = enrichCruisesWithMockItineraries(dedupedCruises);
  const withKnownRetail = applyKnownRetailValues(withItineraries);
  const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
  return enrichCruisesWithReceiptData(withFreeplayOBC).map(normalizeCruiseCasinoPerformance);
}
