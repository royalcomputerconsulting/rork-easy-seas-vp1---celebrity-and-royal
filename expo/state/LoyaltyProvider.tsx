import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import type { BookedCruise, ClubRoyaleTier, CrownAnchorLevel } from "@/types/models";
import { useCoreData } from "./CoreDataProvider";
import { useAuth } from "./AuthProvider";
import { 
  CLUB_ROYALE_TIERS, 
  getTierByPoints, 
  getTierProgress,
} from "@/constants/clubRoyaleTiers";
import {
  CROWN_ANCHOR_LEVELS,
  getLevelByNights,
  getLevelProgress,
} from "@/constants/crownAnchor";
import { createDateFromString } from "@/lib/date";
import { isRoyalCaribbeanShip } from "@/constants/shipInfo";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";
import type { ExtendedLoyaltyData } from "@/lib/royalCaribbean/types";

interface LoyaltyState {
  clubRoyalePoints: number;
  clubRoyaleTier: ClubRoyaleTier;
  clubRoyaleCurrentYearPoints: number;
  clubRoyaleHistoricalPoints: number;
  clubRoyaleHistoricalTier: ClubRoyaleTier;
  clubRoyalePointsSource: 'api' | 'manual' | 'historical';
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
    percentComplete: number;
    projectedDate: Date | null;
    pinnacleShip: string | null;
    pinnacleSailDate: string | null;
    thresholdCrossedShip: string | null;
    thresholdCrossedSailDate: string | null;
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
    points: number;
    nextTier: string | null;
    remainingPoints: number;
    trackerPercentage: number;
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

export const [LoyaltyProvider, useLoyalty] = createContextHook((): LoyaltyState => {
  const { bookedCruises: storedBookedCruises, isLoading: cruisesLoading } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const lastEmailRef = useRef<string | null>(null);

  const skRef = useRef({
    MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail),
    MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail),
    EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail),
  });
  useEffect(() => {
    skRef.current = {
      MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail),
      MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail),
      EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail),
    };
    console.log('[LoyaltyProvider] Scoped keys updated for:', authenticatedEmail);
  }, [authenticatedEmail]);
  
  const [manualClubRoyalePoints, setManualClubRoyalePointsState] = useState<number | null>(null);
  const [manualCrownAnchorPoints, setManualCrownAnchorPointsState] = useState<number | null>(null);
  const [extendedLoyalty, setExtendedLoyaltyState] = useState<ExtendedLoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const bookedCruises = useMemo((): BookedCruise[] => {
    return storedBookedCruises || [];
  }, [storedBookedCruises]);

  const userStorageKeys = useMemo(() => ({
    USERS: getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail),
    CURRENT_USER: getUserScopedKey(ALL_STORAGE_KEYS.CURRENT_USER, authenticatedEmail),
  }), [authenticatedEmail]);

  const loadManualPoints = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[LoyaltyProvider] ==================== LOADING MANUAL POINTS ====================');
      console.log('[LoyaltyProvider] Storage keys:', skRef.current);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const [clubRoyale, crownAnchor, extendedData] = await Promise.all([
        AsyncStorage.getItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS),
        AsyncStorage.getItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS),
        AsyncStorage.getItem(skRef.current.EXTENDED_LOYALTY_DATA),
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
        await AsyncStorage.setItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, loadedClubRoyale.toString());
        console.log('[LoyaltyProvider] ✓ Persisted default Club Royale points to storage:', loadedClubRoyale);
      }
      
      let loadedCrownAnchor: number;
      if (crownAnchor !== null && crownAnchor !== undefined && crownAnchor !== '') {
        loadedCrownAnchor = parseInt(crownAnchor, 10);
        if (isNaN(loadedCrownAnchor)) {
          console.warn('[LoyaltyProvider] Invalid Crown & Anchor value, using default:', crownAnchor);
          loadedCrownAnchor = DEFAULT_LOYALTY.crownAnchorPoints;
        } else {
          console.log('[LoyaltyProvider] ✓ Loaded Crown & Anchor points from storage:', loadedCrownAnchor);
        }
      } else {
        loadedCrownAnchor = DEFAULT_LOYALTY.crownAnchorPoints;
        console.log('[LoyaltyProvider] No stored Crown & Anchor points, using default:', loadedCrownAnchor);
        await AsyncStorage.setItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, loadedCrownAnchor.toString());
        console.log('[LoyaltyProvider] ✓ Persisted default Crown & Anchor points to storage:', loadedCrownAnchor);
      }
      
      setManualClubRoyalePointsState(loadedClubRoyale);
      setManualCrownAnchorPointsState(loadedCrownAnchor);
      
      if (extendedData) {
        try {
          const parsed = JSON.parse(extendedData) as ExtendedLoyaltyData;
          setExtendedLoyaltyState(parsed);
          console.log('[LoyaltyProvider] ✓ Loaded extended loyalty data from storage');
        } catch (parseError) {
          console.warn('[LoyaltyProvider] Failed to parse extended loyalty data:', parseError);
        }
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
  }, [loadManualPoints, authenticatedEmail]);

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
      await AsyncStorage.setItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, stringValue);
      console.log('[LoyaltyProvider] ✓ Wrote to AsyncStorage:', stringValue);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const verification = await AsyncStorage.getItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS);
      console.log('[LoyaltyProvider] ✓ Verification read from storage:', verification);
      
      if (verification !== stringValue) {
        console.error('[LoyaltyProvider] ✗ VERIFICATION FAILED! Expected:', stringValue, 'Got:', verification);
        await AsyncStorage.setItem(skRef.current.MANUAL_CLUB_ROYALE_POINTS, stringValue);
        console.log('[LoyaltyProvider] ⚠ Retried save operation');
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save Club Royale points:', error);
      throw error;
    }
  }, []);

  const setManualCrownAnchorPoints = useCallback(async (points: number) => {
    try {
      console.log('[LoyaltyProvider] ==================== SAVING CROWN & ANCHOR POINTS ====================');
      console.log('[LoyaltyProvider] Points to save:', points);
      console.log('[LoyaltyProvider] Storage key:', skRef.current.MANUAL_CROWN_ANCHOR_POINTS);
      
      setManualCrownAnchorPointsState(points);
      console.log('[LoyaltyProvider] ✓ State updated with:', points);
      
      const stringValue = points.toString();
      await AsyncStorage.setItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, stringValue);
      console.log('[LoyaltyProvider] ✓ Wrote to AsyncStorage:', stringValue);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const verification = await AsyncStorage.getItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS);
      console.log('[LoyaltyProvider] ✓ Verification read from storage:', verification);
      
      if (verification !== stringValue) {
        console.error('[LoyaltyProvider] ✗ VERIFICATION FAILED! Expected:', stringValue, 'Got:', verification);
        await AsyncStorage.setItem(skRef.current.MANUAL_CROWN_ANCHOR_POINTS, stringValue);
        console.log('[LoyaltyProvider] ⚠ Retried save operation');
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save Crown & Anchor points:', error);
      throw error;
    }
  }, []);

  const setExtendedLoyaltyData = useCallback(async (data: ExtendedLoyaltyData) => {
    try {
      console.log('[LoyaltyProvider] ==================== SAVING EXTENDED LOYALTY DATA ====================');
      console.log('[LoyaltyProvider] Data to save:', data);
      
      setExtendedLoyaltyState(data);
      
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(skRef.current.EXTENDED_LOYALTY_DATA, jsonValue);
      console.log('[LoyaltyProvider] ✓ Extended loyalty data saved to storage');
      
      // Update Royal Caribbean loyalty data
      if (data.clubRoyalePointsFromApi !== undefined) {
        await setManualClubRoyalePoints(data.clubRoyalePointsFromApi);
        console.log('[LoyaltyProvider] ✓ Updated Club Royale points:', data.clubRoyalePointsFromApi);
      }
      
      if (data.crownAndAnchorPointsFromApi !== undefined) {
        await setManualCrownAnchorPoints(data.crownAndAnchorPointsFromApi);
        console.log('[LoyaltyProvider] ✓ Updated Crown & Anchor points:', data.crownAndAnchorPointsFromApi);
      }
      
      const royalUpdates: Record<string, string | number> = {};
      if (typeof data.crownAndAnchorId === 'string' && data.crownAndAnchorId.trim().length > 0) {
        royalUpdates.crownAnchorNumber = data.crownAndAnchorId.trim();
        console.log('[LoyaltyProvider] ✓ Updated Crown & Anchor number:', data.crownAndAnchorId.trim());
      }
      if (typeof data.crownAndAnchorTier === 'string' && data.crownAndAnchorTier.trim().length > 0) {
        royalUpdates.crownAnchorLevel = data.crownAndAnchorTier.trim();
        console.log('[LoyaltyProvider] ✓ Updated Crown & Anchor level:', data.crownAndAnchorTier.trim());
      }

      // Update Celebrity loyalty data
      const celebrityUpdates: Record<string, string | number> = {};
      if (data.celebrityBlueChipPoints !== undefined) {
        celebrityUpdates.celebrityBlueChipPoints = data.celebrityBlueChipPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Blue Chip points:', data.celebrityBlueChipPoints);
      }
      if (data.captainsClubPoints !== undefined) {
        celebrityUpdates.celebrityCaptainsClubPoints = data.captainsClubPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Captains Club points:', data.captainsClubPoints);
      }
      
      // Update Silversea loyalty data
      const silverseaUpdates: Record<string, string | number> = {};
      if (data.venetianSocietyTier !== undefined && data.venetianSocietyTier !== null) {
        silverseaUpdates.silverseaVenetianTier = data.venetianSocietyTier;
        console.log('[LoyaltyProvider] ✓ Updated Silversea Venetian tier:', data.venetianSocietyTier);
      }
      
      // Apply all updates to user profile if any exist
      if (Object.keys(royalUpdates).length > 0 || Object.keys(celebrityUpdates).length > 0 || Object.keys(silverseaUpdates).length > 0) {
        const allUpdates = { ...royalUpdates, ...celebrityUpdates, ...silverseaUpdates };
        console.log('[LoyaltyProvider] ✓ Updating user profile with all cruise line data:', allUpdates);
        
        // Store to AsyncStorage to persist across all three cruise lines
        const usersData = await AsyncStorage.getItem(userStorageKeys.USERS);
        if (usersData) {
          const users = JSON.parse(usersData);
          const currentUserId = await AsyncStorage.getItem(userStorageKeys.CURRENT_USER);
          if (currentUserId) {
            const updatedUsers = users.map((u: any) => 
              u.id === currentUserId 
                ? { ...u, ...allUpdates, updatedAt: new Date().toISOString() }
                : u
            );
            await AsyncStorage.setItem(userStorageKeys.USERS, JSON.stringify(updatedUsers));
            console.log('[LoyaltyProvider] ✓ User profile updated in scoped storage with all cruise line loyalty data');
          }
        }
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save extended loyalty data:', error);
      throw error;
    }
  }, [setManualClubRoyalePoints, setManualCrownAnchorPoints, userStorageKeys]);

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
      nights: number;
      shipName: string;
      estimatedCasinoPoints: number;
      crownAnchorPoints: number;
    }[] = [];
    
    const completedCruisesData: { nights: number; earnedPoints: number }[] = [];

    bookedCruises.forEach((cruise: BookedCruise) => {
      const nights = cruise.nights || 0;
      const sailDate = cruise.sailDate ? createDateFromString(cruise.sailDate) : (cruise.returnDate ? createDateFromString(cruise.returnDate) : new Date());
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : sailDate;
      const isCompleted = returnDate < today || cruise.completionState === 'completed';
      
      // Only count Royal Caribbean ships for loyalty/casino calculations
      const isRCI = isRoyalCaribbeanShip(cruise.shipName);
      
      if (!isRCI) {
        console.log('[LoyaltyProvider] Skipping non-RCI ship for loyalty calculations:', cruise.shipName);
        return; // Skip non-Royal Caribbean ships
      }
      
      const earnedPoints = cruise.earnedPoints || cruise.casinoPoints || 0;
      
      if (earnedPoints > 0) {
        calculatedClubRoyalePoints += earnedPoints;
        if (returnDate >= lastApril1 && returnDate <= today) {
          currentYearClubRoyalePoints += earnedPoints;
        }
      }
      
      if (isCompleted) {
        completedNights += nights;
        if (earnedPoints > 0 && nights > 0) {
          completedCruisesData.push({ nights, earnedPoints });
        }
      } else {
        bookedNights += nights;
        
        // Calculate Crown & Anchor points for booked cruises
        // Base: 1 point per night
        // Single occupancy bonus: +1 point per night (solo sailing)
        // Suite bonus: +1 point per night if in suite category
        // singleOccupancy defaults to true unless explicitly set to false
        const isSolo = cruise.singleOccupancy !== false;
        const cabinType = cruise.cabinType || cruise.cabinCategory || '';
        const isSuite = cabinType.toLowerCase().includes('suite');
        
        let crownAnchorPointsForThisCruise = isSolo ? nights * 2 : nights * 1; // solo = 2x, shared = 1x
        
        if (isSuite && isSolo) {
          crownAnchorPointsForThisCruise = nights * 3; // Base + single + suite
          console.log('[LoyaltyProvider] Suite bonus applied for', cruise.shipName, 'cabin:', cabinType);
        } else if (isSuite && !isSolo) {
          crownAnchorPointsForThisCruise = nights * 2; // Suite but not solo — no single bonus
          console.log('[LoyaltyProvider] Suite (shared occupancy) for', cruise.shipName, 'cabin:', cabinType);
        }
        
        console.log('[LoyaltyProvider] C&A points for', cruise.shipName, ':', nights, 'nights x', isSolo ? (isSuite ? 3 : 2) : (isSuite ? 2 : 1), '=', crownAnchorPointsForThisCruise, isSolo ? '(solo)' : '(shared)');
        
        projectedBookedPoints += crownAnchorPointsForThisCruise;
        upcomingBookedCruises.push({
          sailDate,
          returnDate,
          sailDateStr: cruise.sailDate,
          nights,
          shipName: cruise.shipName,
          estimatedCasinoPoints: 0,
          crownAnchorPoints: crownAnchorPointsForThisCruise,
        });
      }
    });

    upcomingBookedCruises.sort((a, b) => a.sailDate.getTime() - b.sailDate.getTime());

    const historicalClubRoyalePoints = calculatedClubRoyalePoints;
    const historicalClubRoyaleTier = getTierByPoints(historicalClubRoyalePoints) as ClubRoyaleTier;
    const liveClubRoyalePoints = extendedLoyalty?.clubRoyalePointsFromApi;
    const hasLiveClubRoyalePoints = typeof liveClubRoyalePoints === 'number' && Number.isFinite(liveClubRoyalePoints);
    const daysSinceSeasonStart = Math.max(0, Math.floor((today.getTime() - lastApril1.getTime()) / (1000 * 60 * 60 * 24)));
    const shouldForceSeasonResetBalance = currentYearClubRoyalePoints === 0
      && daysSinceSeasonStart <= 14
      && ((manualClubRoyalePoints ?? 0) > 0 || (hasLiveClubRoyalePoints && liveClubRoyalePoints > 0));

    let effectiveClubRoyalePoints = currentYearClubRoyalePoints;
    let clubRoyalePointsSource: 'api' | 'manual' | 'historical' = 'historical';

    if (!shouldForceSeasonResetBalance && hasLiveClubRoyalePoints) {
      effectiveClubRoyalePoints = liveClubRoyalePoints;
      clubRoyalePointsSource = 'api';
    } else if (!shouldForceSeasonResetBalance && manualClubRoyalePoints !== null) {
      effectiveClubRoyalePoints = manualClubRoyalePoints;
      clubRoyalePointsSource = 'manual';
    }

    const currentClubRoyaleTier = getTierByPoints(effectiveClubRoyalePoints) as ClubRoyaleTier;
    const tierFromApi = extendedLoyalty?.clubRoyaleTierFromApi;
    const clubRoyaleTier = (tierFromApi && CLUB_ROYALE_TIERS[tierFromApi])
      ? tierFromApi as ClubRoyaleTier
      : historicalClubRoyaleTier;

    if (shouldForceSeasonResetBalance) {
      console.log('[LoyaltyProvider] Forcing Club Royale current-season balance to reset state', {
        manualClubRoyalePoints,
        liveClubRoyalePoints,
        currentYearClubRoyalePoints,
        daysSinceSeasonStart,
      });
    }
    
    const effectiveCrownAnchorPoints = manualCrownAnchorPoints ?? completedNights;
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
    let thresholdCrossedShip: string | null = null;
    let thresholdCrossedSailDate: string | null = null;
    
    if (pointsNeededForPinnacle > 0 && upcomingBookedCruises.length > 0) {
      let runningTotal = effectiveCrownAnchorPoints;
      for (let i = 0; i < upcomingBookedCruises.length; i++) {
        const cruise = upcomingBookedCruises[i];
        runningTotal += cruise.crownAnchorPoints;

        if (runningTotal >= pinnacleThreshold) {
          thresholdCrossedShip = cruise.shipName;
          thresholdCrossedSailDate = cruise.sailDateStr;

          if (upcomingBookedCruises[i + 1]) {
            const earningCruise = upcomingBookedCruises[i + 1];
            projectedPinnacleDate = earningCruise.sailDate;
            pinnacleShip = earningCruise.shipName;
            pinnacleSailDate = earningCruise.sailDateStr;
          } else {
            projectedPinnacleDate = null;
            pinnacleShip = null;
            pinnacleSailDate = null;
          }

          console.log('[LoyaltyProvider] Pinnacle threshold crossed:', {
            crossedOnShip: thresholdCrossedShip,
            crossedOnSailDate: thresholdCrossedSailDate,
            pointsAfterCrossingCruise: runningTotal,
          });

          console.log('[LoyaltyProvider] Pinnacle status effective cruise (first AFTER crossing):', {
            effectiveShip: pinnacleShip,
            effectiveSailDate: pinnacleSailDate,
            effectiveDateISO: projectedPinnacleDate?.toISOString(),
            i,
            hasNextCruise: Boolean(upcomingBookedCruises[i + 1]),
          });
          break;
        }
      }
      
      if (!projectedPinnacleDate) {
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

    const pinnacleProgress = {
      nightsToNext: pointsNeededForPinnacle,
      percentComplete: Math.min(100, (effectiveCrownAnchorPoints / pinnacleThreshold) * 100),
      projectedDate: projectedPinnacleDate,
      pinnacleShip,
      pinnacleSailDate,
      thresholdCrossedShip,
      thresholdCrossedSailDate,
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
      currentClubRoyaleTier,
      clubRoyaleCurrentYearPoints: effectiveCurrentYearPoints,
      clubRoyaleHistoricalPoints: historicalClubRoyalePoints,
      clubRoyaleHistoricalTier: historicalClubRoyaleTier,
      clubRoyalePointsSource,
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
    
    const captainsClub = {
      tier: extendedLoyalty?.captainsClubTier || null,
      points: extendedLoyalty?.captainsClubPoints || 0,
      nextTier: extendedLoyalty?.captainsClubNextTier || null,
      remainingPoints: extendedLoyalty?.captainsClubRemainingPoints || 0,
      trackerPercentage: extendedLoyalty?.captainsClubTrackerPercentage || 0,
    };

    return {
      clubRoyalePoints: effectiveClubRoyalePoints,
      clubRoyaleTier,
      clubRoyaleCurrentYearPoints: effectiveCurrentYearPoints,
      clubRoyaleHistoricalPoints: historicalClubRoyalePoints,
      clubRoyaleHistoricalTier: historicalClubRoyaleTier,
      clubRoyalePointsSource,
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
    };
  }, [bookedCruises, manualClubRoyalePoints, manualCrownAnchorPoints, extendedLoyalty]);

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
