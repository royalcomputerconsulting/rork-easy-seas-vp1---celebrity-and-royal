import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { quotaSafeGetItem, quotaSafeGetJsonItem, quotaSafeSetItem, quotaSafeSetJsonItem } from "@/lib/storage/quotaSafeStorage";
import createContextHook from "@nkzw/create-context-hook";
import type { BookedCruise, ClubRoyaleTier, CrownAnchorLevel } from "@/types/models";
import { useCoreData } from "./CoreDataProvider";
import { useAuth } from "./AuthProvider";
import { 
  CLUB_ROYALE_TIERS, 
  getClubRoyaleTierRank,
  getTierByPoints, 
  getTierProgress,
  inferClubRoyaleTierValidThrough,
  normalizeClubRoyaleTier,
  normalizeClubRoyaleValidThrough,
  resolveClubRoyaleStatus,
} from "@/constants/clubRoyaleTiers";
import {
  CROWN_ANCHOR_LEVELS,
  getLevelByNights,
  getLevelProgress,
} from "@/constants/crownAnchor";
import { createDateFromString } from "@/lib/date";
import { isRoyalCaribbeanShip } from "@/constants/shipInfo";
import { isActiveBookedCruise, isCompletedBookedCruise } from "@/lib/bookedCruiseStatus";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";
import type { ExtendedLoyaltyData } from "@/lib/royalCaribbean/types";
import { mergeExtendedLoyaltyData } from "@/lib/royalCaribbean/loyaltyConverter";
import { dedupeBookedCruises } from "@/lib/dataIdentity";
import { applyUserConfirmedBookedCruiseManifest } from "@/lib/cruiseOverlapGuards";
import { CONFIRMED_CLUB_ROYALE_2025_POINTS } from "@/lib/knownProfileFallback";
import { hasOwnerScopedCasinoHistory } from '@/lib/casino/ownerScopedCasinoHistory';
import {
  buildClubRoyaleDiscrepancy,
  getBookedCruiseCasinoPoints,
  normalizeCruiseCasinoPerformance,
  type ClubRoyaleDiscrepancy,
} from "@/lib/casinoPointTruth";
import { getCelebrityCaptainsClubLevelProgress, getCelebrityCaptainsClubStatus } from "@/constants/celebrityCaptainsClub";
import { getCelebrityBlueChipProgress, getCelebrityBlueChipStatus } from "@/constants/celebrityBlueChipClub";
import { getCasinoProgramSeason } from '@/lib/casino/casinoProgramSeasons';
import { useUser } from "./UserProvider";
import type { UserProfile } from "./UserProvider";
import { filterRecordsForProfile } from '@/lib/profileIsolation';
import { projectCrownAnchorCruisePoints } from '@/lib/loyalty/crownAnchorCruisePoints';

interface PinnacleFutureCruiseBreakdownItem {
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  pointsEarned: number;
  pointsMultiplier: number;
  runningTotal: number;
  pointsRemainingAfterCruise: number;
  reachesPinnacle: boolean;
}

interface UpcomingTopTierStatusCruise {
  sailDate: Date;
  returnDate: Date;
  sailDateStr: string;
  returnDateStr: string;
  nights: number;
  shipName: string;
  statusLabel: string;
}

interface LoyaltyState {
  clubRoyalePoints: number;
  clubRoyaleTier: ClubRoyaleTier;
  clubRoyaleTierValidThrough: string | null;
  clubRoyaleTierIsProtected: boolean;
  clubRoyaleCurrentYearPoints: number;
  clubRoyaleHistoricalPoints: number;
  clubRoyaleHistoricalTier: ClubRoyaleTier;
  clubRoyalePointsSource: 'api' | 'manual' | 'historical' | 'app';
  clubRoyaleSyncDiscrepancy: ClubRoyaleDiscrepancy;
  clubRoyaleSeasonStartDate: Date;
  clubRoyaleNextResetDate: Date;
  crownAnchorPoints: number;
  crownAnchorLevel: CrownAnchorLevel;
  
  totalCompletedNights: number;
  totalBookedNights: number;
  projectedBookedPoints: number;
  projectedCrownAnchorPoints: number;
  projectedCrownAnchorLevel: CrownAnchorLevel;
  
  clubRoyaleProgress: {
    nextTier: string | null;
    pointsToNext: number;
    percentComplete: number;
  };
  
  crownAnchorProgress: {
    nextLevel: string | null;
    nightsToNext: number;
    percentComplete: number;
  };
  
  pinnacleProgress: {
    nightsToNext: number;
    currentPointsNeeded: number;
    soloNightsToNext: number;
    projectedPointsAfterBooked: number;
    projectedPointsNeededAfterBooked: number;
    percentComplete: number;
    projectedDate: Date | null;
    pinnacleShip: string | null;
    pinnacleSailDate: string | null;
    pinnacleStatusLabel: string | null;
    thresholdCrossedShip: string | null;
    thresholdCrossedSailDate: string | null;
    projectedPointsAtPinnacle: number;
    pointsFromBookedToPinnacle: number;
    bookedNightsToPinnacle: number;
    startingPoints: number;
    futureCruiseBreakdown: PinnacleFutureCruiseBreakdownItem[];
  };
  
  mastersProgress: {
    pointsToNext: number;
    percentComplete: number;
    currentYearPoints: number;
    resetDate: Date;
    projectedDate: Date | null;
  };
  
  extendedLoyalty: ExtendedLoyaltyData | null;
  
  venetianSociety: {
    tier: string | null;
    nextTier: string | null;
    memberNumber: string | null;
    enrolled: boolean;
  };
  
  captainsClub: {
    tier: string | null;
    earnedTier: string;
    statusMatchTier: string | null;
    isStatusMatched: boolean;
    points: number;
    nextTier: string | null;
    remainingPoints: number;
    trackerPercentage: number;
  };

  blueChip: {
    tier: string;
    earnedTier: string;
    reportedTier: string | null;
    isReportedTierRetained: boolean;
    points: number;
    nextTier: string | null;
    remainingPoints: number;
    trackerPercentage: number;
    seasonStartDate: string;
    seasonEndDateExclusive: string;
    nextResetDate: string;
  };
  
  isLoading: boolean;
  
  setManualClubRoyalePoints: (points: number) => Promise<void>;
  setManualCrownAnchorPoints: (points: number) => Promise<void>;
  setExtendedLoyaltyData: (data: ExtendedLoyaltyData) => Promise<void>;
  syncFromStorage: () => Promise<void>;
}


const DEFAULT_LOYALTY = {
  clubRoyalePoints: 0,
  crownAnchorPoints: 0,
};

function getTopTierStatusLabel(cruise: Pick<BookedCruise, 'shipName' | 'brand' | 'cruiseSource'>): string {
  const identity = `${cruise.brand ?? ''} ${cruise.cruiseSource ?? ''} ${cruise.shipName ?? ''}`.toLowerCase();
  if (identity.includes('celebrity')) {
    return 'Zenith on Celebrity via Royal Caribbean Pinnacle reciprocity';
  }
  if (isRoyalCaribbeanShip(cruise.shipName)) {
    return 'Pinnacle on Royal Caribbean';
  }
  return 'Top-tier reciprocal status active';
}

export const [LoyaltyProvider, useLoyalty] = createContextHook((): LoyaltyState => {
  const { bookedCruises: storedBookedCruises, isLoading: cruisesLoading } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const { currentUser, users, updateUser } = useUser();
  const lastEmailRef = useRef<string | null>(null);

  const loyaltyStorageOwner = `${authenticatedEmail || 'local'}::${currentUser?.id || 'primary'}`;
  const skRef = useRef({
    MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, loyaltyStorageOwner),
    MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, loyaltyStorageOwner),
    EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, loyaltyStorageOwner),
  });
  useEffect(() => {
    skRef.current = {
      MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, loyaltyStorageOwner),
      MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, loyaltyStorageOwner),
      EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, loyaltyStorageOwner),
    };
    console.log('[LoyaltyProvider] Scoped keys updated for active profile:', currentUser?.id);
  }, [currentUser?.id, loyaltyStorageOwner]);
  
  const [manualClubRoyalePoints, setManualClubRoyalePointsState] = useState<number | null>(null);
  const [manualCrownAnchorPoints, setManualCrownAnchorPointsState] = useState<number | null>(null);
  const [extendedLoyalty, setExtendedLoyaltyState] = useState<ExtendedLoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const bookedCruises = useMemo((): BookedCruise[] => {
    const ownerScopedCruises = filterRecordsForProfile(storedBookedCruises || [], currentUser, users);
    const dedupedCruises = dedupeBookedCruises(ownerScopedCruises, 'owner-scoped loyalty calculations booked cruises');
    return applyUserConfirmedBookedCruiseManifest(dedupedCruises);
  }, [currentUser, storedBookedCruises, users]);

  const loadManualPoints = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[LoyaltyProvider] ==================== LOADING MANUAL POINTS ====================');
      console.log('[LoyaltyProvider] Storage keys:', skRef.current);
      
      const [clubRoyale, crownAnchor, extendedData] = await Promise.all([
        quotaSafeGetItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS),
        quotaSafeGetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS),
        quotaSafeGetJsonItem<ExtendedLoyaltyData | null>(
          skRef.current.EXTENDED_LOYALTY_DATA,
          null,
          (value): value is ExtendedLoyaltyData | null => value === null || (typeof value === 'object' && !Array.isArray(value)),
        ),
      ]);
      
      console.log('[LoyaltyProvider] Raw storage values:', { 
        clubRoyale, 
        crownAnchor,
        clubRoyaleType: typeof clubRoyale,
        crownAnchorType: typeof crownAnchor
      });
      
      let loadedClubRoyale: number;
      if (clubRoyale !== null && clubRoyale !== undefined && clubRoyale !== '') {
        loadedClubRoyale = parseInt(clubRoyale, 10);
        if (isNaN(loadedClubRoyale)) {
          console.warn('[LoyaltyProvider] Invalid Club Royale value, using default:', clubRoyale);
          loadedClubRoyale = DEFAULT_LOYALTY.clubRoyalePoints;
        } else {
          console.log('[LoyaltyProvider] ✓ Loaded Club Royale points from storage:', loadedClubRoyale);
        }
      } else {
        loadedClubRoyale = DEFAULT_LOYALTY.clubRoyalePoints;
        console.log('[LoyaltyProvider] No stored Club Royale points, using default:', loadedClubRoyale);
        await quotaSafeSetItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, loadedClubRoyale.toString());
        console.log('[LoyaltyProvider] ✓ Persisted default Club Royale points to storage:', loadedClubRoyale);
      }
      
      let loadedCrownAnchor: number;
      if (crownAnchor !== null && crownAnchor !== undefined && crownAnchor !== '') {
        loadedCrownAnchor = parseInt(crownAnchor, 10);
        if (isNaN(loadedCrownAnchor)) {
          console.warn('[LoyaltyProvider] Invalid Crown & Anchor value, using default:', crownAnchor);
          loadedCrownAnchor = DEFAULT_LOYALTY.crownAnchorPoints;
        } else if (loadedCrownAnchor === 0 && DEFAULT_LOYALTY.crownAnchorPoints > 0) {
          loadedCrownAnchor = DEFAULT_LOYALTY.crownAnchorPoints;
          await quotaSafeSetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, loadedCrownAnchor.toString());
          console.log('[LoyaltyProvider] ✓ Migrated legacy Crown & Anchor default to confirmed baseline:', loadedCrownAnchor);
        } else {
          console.log('[LoyaltyProvider] ✓ Loaded Crown & Anchor points from storage:', loadedCrownAnchor);
        }
      } else {
        loadedCrownAnchor = DEFAULT_LOYALTY.crownAnchorPoints;
        console.log('[LoyaltyProvider] No stored Crown & Anchor points, using default:', loadedCrownAnchor);
        await quotaSafeSetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, loadedCrownAnchor.toString());
        console.log('[LoyaltyProvider] ✓ Persisted default Crown & Anchor points to storage:', loadedCrownAnchor);
      }
      
      setManualClubRoyalePointsState(loadedClubRoyale);
      setManualCrownAnchorPointsState(loadedCrownAnchor);
      
      if (extendedData) {
        setExtendedLoyaltyState(extendedData);
        console.log('[LoyaltyProvider] ✓ Loaded extended loyalty data from storage');
      } else {
        setExtendedLoyaltyState(null);
        console.log('[LoyaltyProvider] No scoped extended loyalty data found, using empty state');
      }
      
      console.log('[LoyaltyProvider] ✓ Manual points loaded successfully:', {
        clubRoyale: loadedClubRoyale,
        crownAnchor: loadedCrownAnchor,
        hasExtendedData: !!extendedData
      });
      console.log('[LoyaltyProvider] ==================== LOAD COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to load manual points:', error);
      setManualClubRoyalePointsState(DEFAULT_LOYALTY.clubRoyalePoints);
      setManualCrownAnchorPointsState(DEFAULT_LOYALTY.crownAnchorPoints);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticatedEmail !== lastEmailRef.current) {
      const previousEmail = lastEmailRef.current;
      lastEmailRef.current = authenticatedEmail;
      
      if (previousEmail !== null && previousEmail !== authenticatedEmail) {
        console.log('[LoyaltyProvider] User changed from', previousEmail, 'to', authenticatedEmail, '- resetting loyalty data');
        setManualClubRoyalePointsState(null);
        setManualCrownAnchorPointsState(null);
        setExtendedLoyaltyState(null);
      }
    }
    
    void loadManualPoints();
  }, [loadManualPoints, authenticatedEmail, loyaltyStorageOwner]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[LoyaltyProvider] Data cleared event detected, resetting loyalty data');
      setManualClubRoyalePointsState(null);
      setManualCrownAnchorPointsState(null);
      setExtendedLoyaltyState(null);
      setIsLoading(false);
    };

    const handleCloudRestore = () => {
      console.log('[LoyaltyProvider] Cloud data restored, reloading loyalty data');
      void loadManualPoints();
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('appDataCleared', handleDataCleared);
        window.addEventListener('cloudDataRestored', handleCloudRestore);
        return () => {
          window.removeEventListener('appDataCleared', handleDataCleared);
          window.removeEventListener('cloudDataRestored', handleCloudRestore);
        };
      }
    } catch (e) {
      console.log('[LoyaltyProvider] Could not set up event listeners:', e);
    }
  }, [loadManualPoints]);

  const setManualClubRoyalePoints = useCallback(async (points: number) => {
    try {
      console.log('[LoyaltyProvider] ==================== SAVING CLUB ROYALE POINTS ====================');
      console.log('[LoyaltyProvider] Points to save:', points);
      console.log('[LoyaltyProvider] Storage key:', skRef.current.MANUAL_CLUB_ROYALE_POINTS);
      
      setManualClubRoyalePointsState(points);
      console.log('[LoyaltyProvider] ✓ State updated with:', points);
      
      const stringValue = points.toString();
      await quotaSafeSetItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, stringValue);
      console.log('[LoyaltyProvider] ✓ Wrote to AsyncStorage:', stringValue);
      
      const verification = await quotaSafeGetItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS);
      console.log('[LoyaltyProvider] ✓ Verification read from storage:', verification);
      
      if (verification !== stringValue) {
        console.error('[LoyaltyProvider] ✗ VERIFICATION FAILED! Expected:', stringValue, 'Got:', verification);
        await quotaSafeSetItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, stringValue);
        console.log('[LoyaltyProvider] ⚠ Retried save operation');
      }

      if (currentUser?.id) {
        const tier = getTierByPoints(points);
        const now = new Date().toISOString();
        await updateUser(currentUser.id, {
          clubRoyalePoints: points,
          clubRoyaleTier: tier,
          clubRoyaleTierValidThrough: inferClubRoyaleTierValidThrough(tier, points, new Date(now)) ?? undefined,
          loyaltyManualOverrideAt: now,
        });
        console.log('[LoyaltyProvider] ✓ Mirrored Club Royale points to active user profile:', { userId: currentUser.id, points, tier });
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save Club Royale points:', error);
      throw error;
    }
  }, [currentUser?.id, updateUser]);

  const setManualCrownAnchorPoints = useCallback(async (points: number) => {
    try {
      console.log('[LoyaltyProvider] ==================== SAVING CROWN & ANCHOR POINTS ====================');
      console.log('[LoyaltyProvider] Points to save:', points);
      console.log('[LoyaltyProvider] Storage key:', skRef.current.MANUAL_CROWN_ANCHOR_POINTS);
      
      setManualCrownAnchorPointsState(points);
      console.log('[LoyaltyProvider] ✓ State updated with:', points);
      
      const stringValue = points.toString();
      await quotaSafeSetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, stringValue);
      console.log('[LoyaltyProvider] ✓ Wrote to AsyncStorage:', stringValue);
      
      const verification = await quotaSafeGetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS);
      console.log('[LoyaltyProvider] ✓ Verification read from storage:', verification);
      
      if (verification !== stringValue) {
        console.error('[LoyaltyProvider] ✗ VERIFICATION FAILED! Expected:', stringValue, 'Got:', verification);
        await quotaSafeSetItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, stringValue);
        console.log('[LoyaltyProvider] ⚠ Retried save operation');
      }

      if (currentUser?.id) {
        const level = getLevelByNights(points);
        await updateUser(currentUser.id, {
          loyaltyPoints: points,
          crownAnchorLevel: level,
          loyaltyManualOverrideAt: new Date().toISOString(),
        });
        console.log('[LoyaltyProvider] ✓ Mirrored Crown & Anchor points to active user profile:', { userId: currentUser.id, points, level });
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save Crown & Anchor points:', error);
      throw error;
    }
  }, [currentUser?.id, updateUser]);

  const setExtendedLoyaltyData = useCallback(async (data: ExtendedLoyaltyData) => {
    try {
      console.log('[LoyaltyProvider] ==================== SAVING EXTENDED LOYALTY DATA ====================');
      console.log('[LoyaltyProvider] Incoming data to save:', data);

      const mergedData = mergeExtendedLoyaltyData(extendedLoyalty, data);
      if (!mergedData) {
        console.warn('[LoyaltyProvider] No extended loyalty data available after merge');
        return;
      }

      console.log('[LoyaltyProvider] Merged loyalty data:', mergedData);
      setExtendedLoyaltyState(mergedData);

      await quotaSafeSetJsonItem(skRef.current.EXTENDED_LOYALTY_DATA, mergedData);
      console.log('[LoyaltyProvider] ✓ Extended loyalty data saved to storage');

      if (mergedData.clubRoyalePointsFromApi !== undefined) {
        // A provider sync is not a manual edit. Publish the synchronized value
        // into the same live state/storage used by every card without stamping
        // loyaltyManualOverrideAt, which previously allowed stale profile data
        // to outrank a later Club Royale sync.
        setManualClubRoyalePointsState(mergedData.clubRoyalePointsFromApi);
        await quotaSafeSetItem(
          skRef.current.MANUAL_CLUB_ROYALE_POINTS,
          mergedData.clubRoyalePointsFromApi.toString(),
        );
        console.log('[LoyaltyProvider] ✓ Published synced Club Royale points:', mergedData.clubRoyalePointsFromApi);
      }

      if (mergedData.crownAndAnchorPointsFromApi !== undefined) {
        setManualCrownAnchorPointsState(mergedData.crownAndAnchorPointsFromApi);
        await quotaSafeSetItem(
          skRef.current.MANUAL_CROWN_ANCHOR_POINTS,
          mergedData.crownAndAnchorPointsFromApi.toString(),
        );
        console.log('[LoyaltyProvider] ✓ Published synced Crown & Anchor points:', mergedData.crownAndAnchorPointsFromApi);
      }

      const royalUpdates: Partial<UserProfile> = {};
      const syncTimestamp = mergedData.lastSyncTimestamp || new Date().toISOString();
      if (mergedData.clubRoyalePointsFromApi !== undefined) {
        royalUpdates.clubRoyalePoints = mergedData.clubRoyalePointsFromApi;
      }
      if (typeof mergedData.clubRoyaleTierFromApi === 'string' && mergedData.clubRoyaleTierFromApi.trim().length > 0) {
        const syncedTier = normalizeClubRoyaleTier(mergedData.clubRoyaleTierFromApi);
        if (syncedTier) {
          royalUpdates.clubRoyaleTier = syncedTier;
          royalUpdates.clubRoyaleTierConfirmedAt = syncTimestamp;
          royalUpdates.clubRoyaleTierValidThrough = inferClubRoyaleTierValidThrough(
            syncedTier,
            mergedData.clubRoyalePointsFromApi ?? 0,
            new Date(syncTimestamp),
          ) ?? undefined;
        }
      }
      if (mergedData.clubRoyalePointsFromApi !== undefined || mergedData.crownAndAnchorPointsFromApi !== undefined) {
        royalUpdates.clubRoyaleLastSyncAt = syncTimestamp;
      }
      if (mergedData.loyaltySourceEndpoint) royalUpdates.clubRoyaleLoyaltySourceEndpoint = mergedData.loyaltySourceEndpoint;
      if (typeof mergedData.crownAndAnchorId === 'string' && mergedData.crownAndAnchorId.trim().length > 0) {
        royalUpdates.crownAnchorNumber = mergedData.crownAndAnchorId.trim();
        console.log('[LoyaltyProvider] ✓ Updated Crown & Anchor number:', mergedData.crownAndAnchorId.trim());
      }
      if (typeof mergedData.crownAndAnchorTier === 'string' && mergedData.crownAndAnchorTier.trim().length > 0) {
        royalUpdates.crownAnchorLevel = mergedData.crownAndAnchorTier.trim();
        console.log('[LoyaltyProvider] ✓ Updated Crown & Anchor level:', mergedData.crownAndAnchorTier.trim());
      }
      if (mergedData.crownAndAnchorPointsFromApi !== undefined) {
        royalUpdates.loyaltyPoints = mergedData.crownAndAnchorPointsFromApi;
      }

      const celebrityUpdates: Partial<UserProfile> = {};
      if (mergedData.celebrityBlueChipPoints !== undefined) {
        celebrityUpdates.celebrityBlueChipPoints = mergedData.celebrityBlueChipPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Blue Chip points:', mergedData.celebrityBlueChipPoints);
      }
      if (typeof mergedData.celebrityBlueChipTier === 'string' && mergedData.celebrityBlueChipTier.trim().length > 0) {
        celebrityUpdates.celebrityBlueChipTier = mergedData.celebrityBlueChipTier.trim();
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Blue Chip tier:', mergedData.celebrityBlueChipTier.trim());
      }
      if (mergedData.captainsClubPoints !== undefined) {
        celebrityUpdates.celebrityCaptainsClubPoints = mergedData.captainsClubPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Captains Club points:', mergedData.captainsClubPoints);
      }
      if (typeof mergedData.captainsClubTier === 'string' && mergedData.captainsClubTier.trim().length > 0) {
        celebrityUpdates.celebrityCaptainsClubTier = mergedData.captainsClubTier.trim();
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Captains Club tier:', mergedData.captainsClubTier.trim());
      }
      if (typeof mergedData.captainsClubId === 'string' && mergedData.captainsClubId.trim().length > 0) {
        celebrityUpdates.celebrityCaptainsClubNumber = mergedData.captainsClubId.trim();
      }
      if (
        mergedData.captainsClubPoints !== undefined
        || mergedData.celebrityBlueChipPoints !== undefined
        || mergedData.captainsClubTier
        || mergedData.celebrityBlueChipTier
      ) {
        celebrityUpdates.celebrityLastSyncAt = syncTimestamp;
      }
      if (mergedData.loyaltySourceEndpoint) celebrityUpdates.celebrityLoyaltySourceEndpoint = mergedData.loyaltySourceEndpoint;

      const silverseaUpdates: Partial<UserProfile> = {};
      if (mergedData.venetianSocietyTier !== undefined && mergedData.venetianSocietyTier !== null) {
        silverseaUpdates.silverseaVenetianTier = mergedData.venetianSocietyTier;
        console.log('[LoyaltyProvider] ✓ Updated Silversea Venetian tier:', mergedData.venetianSocietyTier);
      }

      if (Object.keys(royalUpdates).length > 0 || Object.keys(celebrityUpdates).length > 0 || Object.keys(silverseaUpdates).length > 0) {
        const allUpdates: Partial<UserProfile> = { ...royalUpdates, ...celebrityUpdates, ...silverseaUpdates };
        console.log('[LoyaltyProvider] ✓ Updating user profile with all cruise line data:', allUpdates);

        if (currentUser?.id) {
          // Update through UserProvider so the Offers-tab card changes in the
          // same render as the sync instead of waiting for an app restart.
          await updateUser(currentUser.id, allUpdates);
          console.log('[LoyaltyProvider] ✓ User profile and live UI updated with all cruise line loyalty data');
        }
      }

      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save extended loyalty data:', error);
      throw error;
    }
  }, [currentUser?.id, extendedLoyalty, updateUser]);

  const calculatedData = useMemo(() => {
    let calculatedClubRoyalePoints = 0;
    let completedNights = 0;
    let bookedNights = 0;
    let projectedBookedPoints = 0;
    const today = new Date();
    const currentYear = today.getFullYear();
    const lastApril1 = new Date(currentYear, 3, 1);
    if (today < lastApril1) {
      lastApril1.setFullYear(currentYear - 1);
    }
    const nextApril1 = new Date(lastApril1);
    nextApril1.setFullYear(lastApril1.getFullYear() + 1);

    let currentYearClubRoyalePoints = 0;
    const upcomingBookedCruises: {
      sailDate: Date;
      returnDate: Date;
      sailDateStr: string;
      returnDateStr: string;
      nights: number;
      shipName: string;
      estimatedCasinoPoints: number;
      crownAnchorPoints: number;
    }[] = [];
    const upcomingTopTierStatusCruises: UpcomingTopTierStatusCruise[] = [];
    
    const completedCruisesData: { nights: number; earnedPoints: number }[] = [];

    bookedCruises.forEach((rawCruise: BookedCruise) => {
      const cruise = normalizeCruiseCasinoPerformance(rawCruise);
      const nights = cruise.nights || 0;
      const sailDate = cruise.sailDate ? createDateFromString(cruise.sailDate) : (cruise.returnDate ? createDateFromString(cruise.returnDate) : new Date());
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : sailDate;
      const isCompleted = isCompletedBookedCruise(cruise, today);
      const isActiveBooking = isActiveBookedCruise(cruise, today);
      
      if (isActiveBooking) {
        upcomingTopTierStatusCruises.push({
          sailDate,
          returnDate,
          sailDateStr: cruise.sailDate,
          returnDateStr: cruise.returnDate || cruise.sailDate,
          nights,
          shipName: cruise.shipName,
          statusLabel: getTopTierStatusLabel(cruise),
        });
      }

      // Only count Royal Caribbean ships for loyalty/casino calculations
      const isRCI = isRoyalCaribbeanShip(cruise.shipName);
      
      if (!isRCI) {
        console.log('[LoyaltyProvider] Skipping non-RCI ship for loyalty calculations:', cruise.shipName);
        return; // Skip non-Royal Caribbean ships
      }
      
      const earnedPoints = getBookedCruiseCasinoPoints(cruise);
      
      if (earnedPoints > 0 && isCompleted) {
        calculatedClubRoyalePoints += earnedPoints;
        if (sailDate >= lastApril1 && sailDate < nextApril1 && returnDate <= today) {
          currentYearClubRoyalePoints += earnedPoints;
        }
      }
      
      if (isCompleted) {
        completedNights += nights;
        if (earnedPoints > 0 && nights > 0) {
          completedCruisesData.push({ nights, earnedPoints });
        }
      } else if (isActiveBooking) {
        bookedNights += nights;
        
        const crownAnchorProjection = projectCrownAnchorCruisePoints(cruise);
        const crownAnchorPointsForThisCruise = crownAnchorProjection.points ?? 0;
        if (crownAnchorProjection.points == null) {
          console.log('[LoyaltyProvider] C&A projection omitted for', cruise.shipName, 'because occupancy or nights are not known.');
        } else {
          console.log('[LoyaltyProvider] C&A points for', cruise.shipName, ':', crownAnchorProjection.explanation);
          projectedBookedPoints += crownAnchorPointsForThisCruise;
        }
        upcomingBookedCruises.push({
          sailDate,
          returnDate,
          sailDateStr: cruise.sailDate,
          returnDateStr: cruise.returnDate || cruise.sailDate,
          nights,
          shipName: cruise.shipName,
          estimatedCasinoPoints: 0,
          crownAnchorPoints: crownAnchorPointsForThisCruise,
        });
      }
    });

    upcomingBookedCruises.sort((a, b) => a.sailDate.getTime() - b.sailDate.getTime());
    upcomingTopTierStatusCruises.sort((a, b) => a.sailDate.getTime() - b.sailDate.getTime());

    // A matching, owner-scoped cruise import is the authority—not an email
    // address. Empty and unrelated accounts therefore never receive Scott's
    // private balances, while his restored cruise ledger remains consistent
    // across every loyalty and Casino surface.
    const usesKnownCasinoProfile = hasOwnerScopedCasinoHistory(bookedCruises);
    let historicalClubRoyalePoints = usesKnownCasinoProfile
      ? CONFIRMED_CLUB_ROYALE_2025_POINTS
      : calculatedClubRoyalePoints;
    const authoritativeCurrentYearClubRoyalePoints = currentYearClubRoyalePoints;
    const pointsHistoricalClubRoyaleTier = getTierByPoints(historicalClubRoyalePoints) as ClubRoyaleTier;
    const liveClubRoyalePoints = extendedLoyalty?.clubRoyalePointsFromApi;
    const hasLiveClubRoyalePoints = typeof liveClubRoyalePoints === 'number' && Number.isFinite(liveClubRoyalePoints);
    const profileClubRoyalePoints = currentUser?.clubRoyalePoints;
    const hasProfileClubRoyalePoints = typeof profileClubRoyalePoints === 'number'
      && Number.isFinite(profileClubRoyalePoints)
      && (profileClubRoyalePoints > 0 || Boolean(currentUser?.loyaltyManualOverrideAt));
    const hasManualClubRoyalePoints = typeof manualClubRoyalePoints === 'number'
      && Number.isFinite(manualClubRoyalePoints)
      && manualClubRoyalePoints >= 0;
    const hasProfileProviderSync = Boolean(currentUser?.clubRoyaleLastSyncAt);
    const daysSinceSeasonStart = Math.max(0, Math.floor((today.getTime() - lastApril1.getTime()) / (1000 * 60 * 60 * 24)));
    const shouldForceSeasonResetBalance = authoritativeCurrentYearClubRoyalePoints === 0
      && daysSinceSeasonStart <= 14
      && ((manualClubRoyalePoints ?? 0) > 0 || (hasLiveClubRoyalePoints && liveClubRoyalePoints > 0));

    // Royal sync and profile editing both update the saved point balance. That
    // balance is the cross-app authority; reconstructed points from historical
    // cruise rows are only a fallback and must never overwrite a newer sync.
    let effectiveClubRoyalePoints = authoritativeCurrentYearClubRoyalePoints;
    let clubRoyalePointsSource: 'api' | 'manual' | 'historical' | 'app' = authoritativeCurrentYearClubRoyalePoints > 0 ? 'app' : 'historical';

    if (!shouldForceSeasonResetBalance && hasProfileClubRoyalePoints && Boolean(currentUser?.loyaltyManualOverrideAt)) {
      effectiveClubRoyalePoints = Math.max(0, profileClubRoyalePoints);
      clubRoyalePointsSource = 'manual';
    } else if (!shouldForceSeasonResetBalance && hasLiveClubRoyalePoints) {
      effectiveClubRoyalePoints = Math.max(0, liveClubRoyalePoints);
      clubRoyalePointsSource = 'api';
    } else if (!shouldForceSeasonResetBalance && hasProfileClubRoyalePoints && hasProfileProviderSync) {
      // Secondary profiles do not share the active profile's scoped extended
      // payload. Their last verified provider snapshot therefore comes from
      // UserProvider and must outrank the initialized zero storage fallback.
      effectiveClubRoyalePoints = Math.max(0, profileClubRoyalePoints);
      clubRoyalePointsSource = 'api';
    } else if (!shouldForceSeasonResetBalance && hasManualClubRoyalePoints) {
      effectiveClubRoyalePoints = Math.max(0, manualClubRoyalePoints);
      clubRoyalePointsSource = 'manual';
    } else if (!shouldForceSeasonResetBalance && hasProfileClubRoyalePoints) {
      effectiveClubRoyalePoints = Math.max(0, profileClubRoyalePoints);
      clubRoyalePointsSource = 'app';
    }

    const clubRoyaleSyncDiscrepancy = buildClubRoyaleDiscrepancy(authoritativeCurrentYearClubRoyalePoints, hasLiveClubRoyalePoints ? liveClubRoyalePoints : null);
    if (clubRoyaleSyncDiscrepancy.hasDiscrepancy) {
      console.warn('[LoyaltyProvider] Club Royale reconstructed/synced balance discrepancy detected; the saved profile balance remains authoritative across the app:', clubRoyaleSyncDiscrepancy);
    }

    const currentClubRoyaleTier = getTierByPoints(effectiveClubRoyalePoints);
    const profileConfirmedTier = normalizeClubRoyaleTier(currentUser?.clubRoyaleTier);
    const profileConfirmationDateValue = currentUser?.clubRoyaleTierConfirmedAt
      ?? currentUser?.loyaltyManualOverrideAt
      ?? currentUser?.updatedAt;
    const profileConfirmationDate = profileConfirmationDateValue ? new Date(profileConfirmationDateValue) : today;
    const safeProfileConfirmationDate = Number.isNaN(profileConfirmationDate.getTime()) ? today : profileConfirmationDate;
    const profileValidThrough = normalizeClubRoyaleValidThrough(currentUser?.clubRoyaleTierValidThrough)
      ?? inferClubRoyaleTierValidThrough(
        profileConfirmedTier,
        currentUser?.clubRoyalePoints ?? effectiveClubRoyalePoints,
        safeProfileConfirmationDate,
      );

    let resolvedClubRoyaleStatus = resolveClubRoyaleStatus({
      currentSeasonPoints: effectiveClubRoyalePoints,
      confirmedTier: profileConfirmedTier,
      confirmedValidThrough: profileValidThrough,
      asOf: today,
    });

    const apiTier = normalizeClubRoyaleTier(extendedLoyalty?.clubRoyaleTierFromApi);
    if (apiTier) {
      const apiTimestamp = extendedLoyalty?.lastSyncTimestamp ? new Date(extendedLoyalty.lastSyncTimestamp) : today;
      const safeApiTimestamp = Number.isNaN(apiTimestamp.getTime()) ? today : apiTimestamp;
      const apiStatus = resolveClubRoyaleStatus({
        currentSeasonPoints: effectiveClubRoyalePoints,
        confirmedTier: apiTier,
        confirmedValidThrough: inferClubRoyaleTierValidThrough(
          apiTier,
          hasLiveClubRoyalePoints ? liveClubRoyalePoints : effectiveClubRoyalePoints,
          safeApiTimestamp,
        ),
        asOf: today,
      });
      if (
        getClubRoyaleTierRank(apiStatus.effectiveTier) > getClubRoyaleTierRank(resolvedClubRoyaleStatus.effectiveTier)
        || (
          apiStatus.effectiveTier === resolvedClubRoyaleStatus.effectiveTier
          && (apiStatus.validThrough ?? '') > (resolvedClubRoyaleStatus.validThrough ?? '')
        )
      ) {
        resolvedClubRoyaleStatus = apiStatus;
      }
    }

    if (usesKnownCasinoProfile) {
      const knownHistoricalStatus = resolveClubRoyaleStatus({
        currentSeasonPoints: effectiveClubRoyalePoints,
        confirmedTier: pointsHistoricalClubRoyaleTier,
        confirmedValidThrough: inferClubRoyaleTierValidThrough(
          pointsHistoricalClubRoyaleTier,
          historicalClubRoyalePoints,
          new Date(2025, 3, 1, 12, 0, 0),
        ),
        asOf: today,
      });
      if (
        getClubRoyaleTierRank(knownHistoricalStatus.effectiveTier) > getClubRoyaleTierRank(resolvedClubRoyaleStatus.effectiveTier)
        || (
          knownHistoricalStatus.effectiveTier === resolvedClubRoyaleStatus.effectiveTier
          && (knownHistoricalStatus.validThrough ?? '') > (resolvedClubRoyaleStatus.validThrough ?? '')
        )
      ) {
        resolvedClubRoyaleStatus = knownHistoricalStatus;
      }
    }

    const clubRoyaleTier = resolvedClubRoyaleStatus.effectiveTier;
    const historicalClubRoyaleTier = getClubRoyaleTierRank(clubRoyaleTier) > getClubRoyaleTierRank(pointsHistoricalClubRoyaleTier)
      ? clubRoyaleTier
      : pointsHistoricalClubRoyaleTier;
    // A confirmed retained tier proves the member crossed at least that tier's
    // threshold in a prior earning year even when individual historical cruise
    // sessions were not imported into this device.
    historicalClubRoyalePoints = Math.max(
      historicalClubRoyalePoints,
      CLUB_ROYALE_TIERS[historicalClubRoyaleTier]?.threshold ?? 0,
    );

    if (shouldForceSeasonResetBalance) {
      console.log('[LoyaltyProvider] Forcing Club Royale current-season balance to reset state', {
        manualClubRoyalePoints,
        liveClubRoyalePoints,
        currentYearClubRoyalePoints: authoritativeCurrentYearClubRoyalePoints,
        daysSinceSeasonStart,
      });
    }
    
    const liveCrownAnchorPoints = extendedLoyalty?.crownAndAnchorPointsFromApi;
    const hasLiveCrownAnchorPoints = typeof liveCrownAnchorPoints === 'number' && Number.isFinite(liveCrownAnchorPoints);
    // Profile editing writes the manual value and state immediately. It must
    // outrank an older API cache; an explicit Royal sync updates this same
    // manual value before publishing its refreshed extended data.
    const syncedProfileCrownAnchorPoints = currentUser?.loyaltyPoints;
    const hasSyncedProfileCrownAnchorPoints = hasProfileProviderSync
      && typeof syncedProfileCrownAnchorPoints === 'number'
      && Number.isFinite(syncedProfileCrownAnchorPoints);
    const rawCrownAnchorPoints = hasLiveCrownAnchorPoints
      ? liveCrownAnchorPoints
      : hasSyncedProfileCrownAnchorPoints
        ? syncedProfileCrownAnchorPoints
        : manualCrownAnchorPoints ?? completedNights;
    const effectiveCrownAnchorPoints = Math.max(0, rawCrownAnchorPoints);
    const crownAnchorLevel = getLevelByNights(effectiveCrownAnchorPoints) as CrownAnchorLevel;
    
    const projectedCrownAnchorPoints = effectiveCrownAnchorPoints + projectedBookedPoints;
    const projectedCrownAnchorLevel = getLevelByNights(projectedCrownAnchorPoints) as CrownAnchorLevel;

    const clubRoyaleProgress = getTierProgress(effectiveClubRoyalePoints, currentClubRoyaleTier);
    const crownAnchorProgress = getLevelProgress(effectiveCrownAnchorPoints, crownAnchorLevel);

    const pinnacleThreshold = CROWN_ANCHOR_LEVELS.Pinnacle.cruiseNights;
    const pointsNeededForPinnacle = Math.max(0, pinnacleThreshold - effectiveCrownAnchorPoints);
    let projectedPinnacleDate: Date | null = null;
    let pinnacleShip: string | null = null;
    let pinnacleSailDate: string | null = null;
    let pinnacleStatusLabel: string | null = null;
    let thresholdCrossedShip: string | null = null;
    let thresholdCrossedSailDate: string | null = null;
    let projectedPointsAtPinnacle = projectedCrownAnchorPoints;
    let pointsFromBookedToPinnacle = projectedBookedPoints;
    let bookedNightsToPinnacle = bookedNights;
    
    if (pointsNeededForPinnacle > 0 && upcomingBookedCruises.length > 0) {
      let runningTotal = effectiveCrownAnchorPoints;
      let bookedPointsThroughCurrent = 0;
      let bookedNightsThroughCurrent = 0;

      for (let i = 0; i < upcomingBookedCruises.length; i++) {
        const cruise = upcomingBookedCruises[i];
        bookedPointsThroughCurrent += cruise.crownAnchorPoints;
        bookedNightsThroughCurrent += cruise.nights;
        runningTotal += cruise.crownAnchorPoints;

        if (runningTotal >= pinnacleThreshold) {
          thresholdCrossedShip = cruise.shipName;
          thresholdCrossedSailDate = cruise.sailDateStr;
          projectedPinnacleDate = cruise.returnDate;
          projectedPointsAtPinnacle = runningTotal;
          pointsFromBookedToPinnacle = bookedPointsThroughCurrent;
          bookedNightsToPinnacle = bookedNightsThroughCurrent;

          const firstCruiseAfterPinnacle = upcomingTopTierStatusCruises.find((candidate) =>
            candidate.sailDate.getTime() >= cruise.returnDate.getTime()
          );

          if (firstCruiseAfterPinnacle) {
            pinnacleShip = firstCruiseAfterPinnacle.shipName;
            pinnacleSailDate = firstCruiseAfterPinnacle.sailDateStr;
            pinnacleStatusLabel = firstCruiseAfterPinnacle.statusLabel;
          } else {
            pinnacleShip = null;
            pinnacleSailDate = null;
            pinnacleStatusLabel = null;
          }

          console.log('[LoyaltyProvider] Pinnacle threshold crossed:', {
            crossedOnShip: thresholdCrossedShip,
            crossedOnSailDate: thresholdCrossedSailDate,
            pointsAfterCrossingCruise: runningTotal,
          });

          console.log('[LoyaltyProvider] Pinnacle status effective cruise (first AFTER crossing):', {
            effectiveShip: pinnacleShip,
            effectiveSailDate: pinnacleSailDate,
            effectiveStatusLabel: pinnacleStatusLabel,
            milestoneDateISO: projectedPinnacleDate?.toISOString(),
            i,
            hasNextCruise: Boolean(firstCruiseAfterPinnacle),
          });
          break;
        }
      }
      
      if (!thresholdCrossedShip && !projectedPinnacleDate) {
        const remainingPointsNeeded = pinnacleThreshold - runningTotal;
        const lastCruise = upcomingBookedCruises[upcomingBookedCruises.length - 1];
        const avgNightsPerMonth = 7;
        const avgPointsPerMonth = avgNightsPerMonth * 2;
        const monthsNeeded = Math.ceil(remainingPointsNeeded / avgPointsPerMonth);
        const estimatedDate = new Date(lastCruise.sailDate);
        estimatedDate.setMonth(estimatedDate.getMonth() + monthsNeeded);
        projectedPinnacleDate = estimatedDate;
        console.log('[LoyaltyProvider] Pinnacle projection extended beyond booked cruises:', {
          totalAfterBooked: runningTotal,
          remainingNeeded: remainingPointsNeeded,
          estimatedDate: estimatedDate.toISOString(),
        });
      }
    } else if (pointsNeededForPinnacle > 0) {
      const avgNightsPerMonth = 7;
      const avgPointsPerMonth = avgNightsPerMonth * 2;
      const monthsNeeded = Math.ceil(pointsNeededForPinnacle / avgPointsPerMonth);
      projectedPinnacleDate = new Date();
      projectedPinnacleDate.setMonth(projectedPinnacleDate.getMonth() + monthsNeeded);
    }

    const futureCruiseBreakdown: PinnacleFutureCruiseBreakdownItem[] = [];
    let breakdownRunningTotal = effectiveCrownAnchorPoints;
    let hasReachedPinnacleInBreakdown = effectiveCrownAnchorPoints >= pinnacleThreshold;

    for (const cruise of upcomingBookedCruises) {
      if (hasReachedPinnacleInBreakdown) break;

      breakdownRunningTotal += cruise.crownAnchorPoints;
      const reachesPinnacle = breakdownRunningTotal >= pinnacleThreshold;
      futureCruiseBreakdown.push({
        shipName: cruise.shipName,
        sailDate: cruise.sailDateStr,
        returnDate: cruise.returnDateStr,
        nights: cruise.nights,
        pointsEarned: cruise.crownAnchorPoints,
        pointsMultiplier: cruise.nights > 0 ? cruise.crownAnchorPoints / cruise.nights : 0,
        runningTotal: breakdownRunningTotal,
        pointsRemainingAfterCruise: Math.max(0, pinnacleThreshold - breakdownRunningTotal),
        reachesPinnacle,
      });

      if (reachesPinnacle) {
        hasReachedPinnacleInBreakdown = true;
      }
    }

    const projectedPointsNeededAfterBooked = Math.max(0, pinnacleThreshold - projectedCrownAnchorPoints);
    const pinnacleProgress = {
      nightsToNext: pointsNeededForPinnacle,
      currentPointsNeeded: pointsNeededForPinnacle,
      soloNightsToNext: Math.ceil(pointsNeededForPinnacle / 2),
      projectedPointsAfterBooked: projectedCrownAnchorPoints,
      projectedPointsNeededAfterBooked,
      percentComplete: Math.min(100, (effectiveCrownAnchorPoints / pinnacleThreshold) * 100),
      projectedDate: projectedPinnacleDate,
      pinnacleShip,
      pinnacleSailDate,
      pinnacleStatusLabel,
      thresholdCrossedShip,
      thresholdCrossedSailDate,
      projectedPointsAtPinnacle,
      pointsFromBookedToPinnacle,
      bookedNightsToPinnacle,
      startingPoints: effectiveCrownAnchorPoints,
      futureCruiseBreakdown,
    };

    let averageCasinoPointsPerNight = 150;
    if (completedCruisesData.length > 0) {
      const totalCasinoPoints = completedCruisesData.reduce((sum, c) => sum + c.earnedPoints, 0);
      const totalCruiseNights = completedCruisesData.reduce((sum, c) => sum + c.nights, 0);
      if (totalCruiseNights > 0) {
        averageCasinoPointsPerNight = totalCasinoPoints / totalCruiseNights;
      }
    }
    
    for (const cruise of upcomingBookedCruises) {
      cruise.estimatedCasinoPoints = cruise.nights * averageCasinoPointsPerNight;
    }

    const mastersThreshold = CLUB_ROYALE_TIERS.Masters.threshold;
    const effectiveCurrentYearPoints = effectiveClubRoyalePoints;
    
    const pointsNeededForMasters = Math.max(0, mastersThreshold - effectiveCurrentYearPoints);
    let projectedMastersDate: Date | null = null;
    
    if (pointsNeededForMasters > 0 && upcomingBookedCruises.length > 0) {
      let accumulatedCasinoPoints = 0;
      for (const cruise of upcomingBookedCruises) {
        accumulatedCasinoPoints += cruise.estimatedCasinoPoints;
        if (accumulatedCasinoPoints >= pointsNeededForMasters) {
          projectedMastersDate = cruise.sailDate;
          break;
        }
      }
      
      if (!projectedMastersDate && accumulatedCasinoPoints < pointsNeededForMasters) {
        const remainingPointsNeeded = pointsNeededForMasters - accumulatedCasinoPoints;
        const lastCruise = upcomingBookedCruises[upcomingBookedCruises.length - 1];
        const avgNightsPerMonth = 7;
        const avgPointsPerMonth = avgNightsPerMonth * averageCasinoPointsPerNight;
        const monthsNeeded = Math.ceil(remainingPointsNeeded / avgPointsPerMonth);
        const estimatedDate = new Date(lastCruise.sailDate);
        estimatedDate.setMonth(estimatedDate.getMonth() + monthsNeeded);
        projectedMastersDate = estimatedDate;
        console.log('[LoyaltyProvider] Masters projection extended beyond booked cruises:', {
          accumulatedFromBooked: accumulatedCasinoPoints,
          remainingNeeded: remainingPointsNeeded,
          avgPointsPerNight: averageCasinoPointsPerNight,
          estimatedDate: estimatedDate.toISOString(),
        });
      }
    } else if (pointsNeededForMasters > 0) {
      const avgNightsPerMonth = 7;
      const avgPointsPerMonth = avgNightsPerMonth * averageCasinoPointsPerNight;
      const monthsNeeded = Math.ceil(pointsNeededForMasters / avgPointsPerMonth);
      projectedMastersDate = new Date();
      projectedMastersDate.setMonth(projectedMastersDate.getMonth() + monthsNeeded);
    }
    
    const mastersProgress = {
      pointsToNext: pointsNeededForMasters,
      percentComplete: Math.min(100, (effectiveCurrentYearPoints / mastersThreshold) * 100),
      currentYearPoints: effectiveCurrentYearPoints,
      resetDate: nextApril1,
      projectedDate: projectedMastersDate,
    };

    console.log('[LoyaltyProvider] Calculated loyalty data:', {
      clubRoyalePoints: effectiveClubRoyalePoints,
      clubRoyaleTier,
      clubRoyaleTierValidThrough: resolvedClubRoyaleStatus.validThrough,
      clubRoyaleTierIsProtected: resolvedClubRoyaleStatus.isProtected,
      currentClubRoyaleTier,
      clubRoyaleCurrentYearPoints: effectiveCurrentYearPoints,
      clubRoyaleHistoricalPoints: historicalClubRoyalePoints,
      clubRoyaleHistoricalTier: historicalClubRoyaleTier,
      clubRoyalePointsSource,
      clubRoyaleSyncDiscrepancy,
      crownAnchorPoints: effectiveCrownAnchorPoints,
      crownAnchorLevel,
      completedNights,
      bookedNights,
      projectedBookedPoints,
      projectedCrownAnchorPoints,
      projectedCrownAnchorLevel,
      pinnacleProgress,
      mastersProgress,
      totalCruisesProcessed: bookedCruises.length,
      averageCasinoPointsPerNight,
      upcomingCruisesCount: upcomingBookedCruises.length,
    });

    const venetianSociety = {
      tier: extendedLoyalty?.venetianSocietyTier || null,
      nextTier: extendedLoyalty?.venetianSocietyNextTier || null,
      memberNumber: extendedLoyalty?.venetianSocietyMemberNumber || null,
      enrolled: extendedLoyalty?.venetianSocietyEnrolled || false,
    };
    
    const profileCaptainPoints = currentUser?.celebrityCaptainsClubPoints;
    // The latest provider snapshot may legitimately be lower after an account
    // correction. Never use Math.max here: it makes stale values permanent.
    const syncedCaptainPoints = extendedLoyalty?.captainsClubPoints;
    const captainPoints = Math.max(0,
      typeof syncedCaptainPoints === 'number' && Number.isFinite(syncedCaptainPoints)
        ? syncedCaptainPoints
        : (typeof profileCaptainPoints === 'number' && Number.isFinite(profileCaptainPoints) ? profileCaptainPoints : 0),
    );
    const captainStatus = getCelebrityCaptainsClubStatus(
      captainPoints,
      crownAnchorLevel,
      extendedLoyalty?.captainsClubTier || currentUser?.celebrityCaptainsClubTier,
    );
    const captainProgress = getCelebrityCaptainsClubLevelProgress(captainPoints, captainStatus.earnedLevel);
    const captainsClub = {
      tier: captainStatus.effectiveLevel,
      earnedTier: captainStatus.earnedLevel,
      statusMatchTier: captainStatus.statusMatchLevel,
      isStatusMatched: captainStatus.isStatusMatched,
      points: captainPoints,
      nextTier: captainProgress.nextLevel,
      remainingPoints: captainProgress.pointsToNext,
      trackerPercentage: captainProgress.percentComplete,
    };

    const profileBlueChipPoints = currentUser?.celebrityBlueChipPoints;
    const hasManualLoyaltyOverride = Boolean(currentUser?.loyaltyManualOverrideAt);
    const syncedBlueChipPoints = extendedLoyalty?.celebrityBlueChipPoints;
    const hasSyncedBlueChipPoints = typeof syncedBlueChipPoints === 'number' && Number.isFinite(syncedBlueChipPoints);
    const blueChipPoints = typeof profileBlueChipPoints === 'number'
      && Number.isFinite(profileBlueChipPoints)
      && hasManualLoyaltyOverride
      ? Math.max(0, profileBlueChipPoints)
      : hasSyncedBlueChipPoints
        ? Math.max(0, syncedBlueChipPoints)
        : Math.max(0, profileBlueChipPoints ?? 0);
    const blueChipStatus = getCelebrityBlueChipStatus(
      blueChipPoints,
      extendedLoyalty?.celebrityBlueChipTier || currentUser?.celebrityBlueChipTier,
    );
    const blueChipProgress = getCelebrityBlueChipProgress(blueChipPoints, blueChipStatus.earnedTier);
    const blueChipSeason = getCasinoProgramSeason('blue_chip', today);
    const blueChip = {
      tier: blueChipStatus.effectiveTier,
      earnedTier: blueChipStatus.earnedTier,
      reportedTier: blueChipStatus.reportedTier,
      isReportedTierRetained: blueChipStatus.isReportedTierRetained,
      points: blueChipPoints,
      nextTier: blueChipProgress.nextTier,
      remainingPoints: blueChipProgress.pointsToNext,
      trackerPercentage: blueChipProgress.percentComplete,
      seasonStartDate: blueChipSeason.startDate,
      seasonEndDateExclusive: blueChipSeason.endDateExclusive,
      nextResetDate: blueChipSeason.endDateExclusive,
    };

    return {
      clubRoyalePoints: effectiveClubRoyalePoints,
      clubRoyaleTier,
      clubRoyaleTierValidThrough: resolvedClubRoyaleStatus.validThrough,
      clubRoyaleTierIsProtected: resolvedClubRoyaleStatus.isProtected,
      clubRoyaleCurrentYearPoints: effectiveCurrentYearPoints,
      clubRoyaleHistoricalPoints: historicalClubRoyalePoints,
      clubRoyaleHistoricalTier: historicalClubRoyaleTier,
      clubRoyalePointsSource,
      clubRoyaleSyncDiscrepancy,
      clubRoyaleSeasonStartDate: lastApril1,
      clubRoyaleNextResetDate: nextApril1,
      crownAnchorPoints: effectiveCrownAnchorPoints,
      crownAnchorLevel,
      totalCompletedNights: completedNights,
      totalBookedNights: bookedNights,
      projectedBookedPoints,
      projectedCrownAnchorPoints,
      projectedCrownAnchorLevel,
      clubRoyaleProgress,
      crownAnchorProgress,
      pinnacleProgress,
      mastersProgress,
      venetianSociety,
      captainsClub,
      blueChip,
    };
  }, [authenticatedEmail, bookedCruises, currentUser, manualClubRoyalePoints, manualCrownAnchorPoints, extendedLoyalty]);

  return useMemo(() => ({
    ...calculatedData,
    extendedLoyalty,
    isLoading: isLoading || cruisesLoading,
    setManualClubRoyalePoints,
    setManualCrownAnchorPoints,
    setExtendedLoyaltyData,
    syncFromStorage: loadManualPoints,
  }), [calculatedData, extendedLoyalty, isLoading, cruisesLoading, setManualClubRoyalePoints, setManualCrownAnchorPoints, setExtendedLoyaltyData, loadManualPoints]);
});
