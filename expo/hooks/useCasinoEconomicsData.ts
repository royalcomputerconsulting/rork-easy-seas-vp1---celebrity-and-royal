import { useMemo } from 'react';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { buildCruiseEconomicsSummary, normalizeCruisesWithCasinoEconomics, type CruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import { normalizeCruiseCasinoPerformance } from '@/lib/casinoPointTruth';
import type { BookedCruise } from '@/types/models';
import { hasCompleteOwnerScopedAnnualCasinoHistory } from '@/lib/casino/ownerScopedCasinoHistory';
import { useUser } from '@/state/UserProvider';
import { filterRecordsForProfile } from '@/lib/profileIsolation';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';

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
  isHydrating: boolean;
} {
  const { localData, isLoading } = useAppState();
  const { bookedCruises: storedBookedCruises } = useCoreData();
  const { currentUser, users } = useUser();
  const { selectedProfileId } = useIntelligenceFilters();
  const scopedProfile = selectedProfileId !== 'all' && selectedProfileId !== 'unassigned'
    ? users.find((profile) => profile.id === selectedProfileId) ?? currentUser
    : currentUser;

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
    const ownerScopedBooked = filterRecordsForProfile(
      [...localBooked, ...storedBooked]
        .filter((cruise): cruise is BookedCruise => Boolean(cruise && typeof cruise === 'object'))
        .map(normalizeCruiseCasinoPerformance),
      scopedProfile,
      users,
    );
    const primaryBooked = dedupeBookedCruises(
      ownerScopedBooked,
      'casino economics local + transactional merge',
    );

    if (primaryBooked.length > 0) {
      return normalizeCruisesWithCasinoEconomics(primaryBooked.map(normalizeCruiseCasinoPerformance));
    }

    return [];
  }, [localData?.booked, scopedProfile, storedBookedCruises, users]);

  const cruiseEconomicsSummary = useMemo(
    () => buildCruiseEconomicsSummary(bookedCruises, new Date(), {
      useKnownAnnualReportFacts: hasCompleteOwnerScopedAnnualCasinoHistory(bookedCruises),
    }),
    [bookedCruises],
  );

  const allCruiseEconomicsSummary = useMemo(() => buildCruiseEconomicsSummary(bookedCruises, new Date(), {
    scope: 'allCruises',
  }), [bookedCruises]);

  return {
    bookedCruises,
    cruiseEconomicsSummary,
    allCruiseEconomicsSummary,
    // Consumers must distinguish repository hydration from a genuinely empty
    // owner profile.  Rendering zero-valued casino cards during this window
    // previously made loaded completed-cruise history look as if it vanished.
    isHydrating: isLoading,
  };
}
