import { useMemo } from 'react';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { buildCruiseEconomicsSummary, normalizeCruisesWithCasinoEconomics, type CruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import { normalizeCruiseCasinoPerformance } from '@/lib/casinoPointTruth';
import type { BookedCruise } from '@/types/models';
import { hasCompleteOwnerScopedAnnualCasinoHistory } from '@/lib/casino/ownerScopedCasinoHistory';

/**
 * Shared source of truth for the Casino section's real cruise/economics
 * data, extracted from the same logic the main Casino Portfolio screen
 * uses (owner-scoped cruise merge and casino-performance normalization).
 * Any screen calling this hook sees the
 * exact same totals (points, coin-in, win/loss, ship breakdowns) as the
 * Casino Portfolio screen.
 */
export function useCasinoEconomicsData(): {
  bookedCruises: BookedCruise[];
  cruiseEconomicsSummary: CruiseEconomicsSummary;
  allCruiseEconomicsSummary: CruiseEconomicsSummary;
} {
  const { localData } = useAppState();
  const { bookedCruises: storedBookedCruises } = useCoreData();

  const bookedCruises = useMemo(() => {
    // Backups from older builds can briefly hydrate a missing or malformed
    // domain.  Casino must fail empty instead of throwing during navigation.
    const localBooked = Array.isArray(localData?.booked) ? localData.booked : [];
    const storedBooked = Array.isArray(storedBookedCruises) ? storedBookedCruises : [];
    // CoreData contains the current transactional records while localData is
    // retained for legacy imports. Choosing one collection discarded casino
    // closeouts whenever the other collection happened to be non-empty.
    // Merge both, with CoreData last so the current/manual per-cruise values
    // win during identity reconciliation.
    const primaryBooked = dedupeBookedCruises(
      [...localBooked, ...storedBooked]
        .filter((cruise): cruise is BookedCruise => Boolean(cruise && typeof cruise === 'object'))
        .map(normalizeCruiseCasinoPerformance),
      'casino economics local + transactional merge',
    );

    if (primaryBooked.length > 0) {
      return normalizeCruisesWithCasinoEconomics(primaryBooked.map(normalizeCruiseCasinoPerformance));
    }

    return [];
  }, [localData?.booked, storedBookedCruises]);

  const cruiseEconomicsSummary = useMemo(
    () => buildCruiseEconomicsSummary(bookedCruises, new Date(), {
      useKnownAnnualReportFacts: hasCompleteOwnerScopedAnnualCasinoHistory(bookedCruises),
    }),
    [bookedCruises],
  );

  const allCruiseEconomicsSummary = useMemo(() => buildCruiseEconomicsSummary(bookedCruises, new Date(), {
    scope: 'allCruises',
  }), [bookedCruises]);

  return { bookedCruises, cruiseEconomicsSummary, allCruiseEconomicsSummary };
}
