import { useMemo } from 'react';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useAuth } from '@/state/AuthProvider';
import { buildCruiseEconomicsSummary, normalizeCruisesWithCasinoEconomics, type CruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import { CONFIRMED_CLUB_ROYALE_2025_POINTS, getKnownCasinoProfileCruises, isKnownCasinoProfile } from '@/lib/knownProfileFallback';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import { normalizeCruiseCasinoPerformance } from '@/lib/casinoPointTruth';
import type { BookedCruise } from '@/types/models';

/**
 * Shared source of truth for the Casino section's real cruise/economics
 * data, extracted from the same logic the main Casino Portfolio screen
 * uses (known-profile cruise merge, casino-performance normalization,
 * annual-report reconciliation). Any screen calling this hook sees the
 * exact same totals (points, coin-in, win/loss, ship breakdowns) as the
 * Casino Portfolio screen.
 */
export function useCasinoEconomicsData(): {
  bookedCruises: BookedCruise[];
  cruiseEconomicsSummary: CruiseEconomicsSummary;
} {
  const { authenticatedEmail } = useAuth();
  const { localData } = useAppState();
  const { bookedCruises: storedBookedCruises } = useCoreData();

  const bookedCruises = useMemo(() => {
    const localBooked = localData.booked || [];
    const storedBooked = storedBookedCruises || [];
    const primaryBooked = localBooked.length > 0 ? localBooked : storedBooked;
    const knownProfileCruises = getKnownCasinoProfileCruises(authenticatedEmail);

    if (knownProfileCruises.length > 0) {
      const mergedCruises = dedupeBookedCruises(
        [...knownProfileCruises, ...primaryBooked].map(normalizeCruiseCasinoPerformance),
        'casino economics known-profile cruise merge',
      );
      return normalizeCruisesWithCasinoEconomics(mergedCruises, {
        includeKnownAnnualFacts: isKnownCasinoProfile(authenticatedEmail),
      });
    }

    if (primaryBooked.length > 0) {
      return normalizeCruisesWithCasinoEconomics(primaryBooked.map(normalizeCruiseCasinoPerformance));
    }

    return [];
  }, [authenticatedEmail, localData.booked, storedBookedCruises]);

  const cruiseEconomicsSummary = useMemo(() => {
    return buildCruiseEconomicsSummary(bookedCruises, new Date(), {
      useKnownAnnualReportFacts: isKnownCasinoProfile(authenticatedEmail),
      minimumTotalPoints: isKnownCasinoProfile(authenticatedEmail) ? CONFIRMED_CLUB_ROYALE_2025_POINTS : undefined,
      pointsAdjustmentNote: 'Historical Club Royale points use the confirmed 58,680-point 2025 season floor when imported per-cruise rows do not contain every point transaction.',
    });
  }, [authenticatedEmail, bookedCruises]);

  return { bookedCruises, cruiseEconomicsSummary };
}
