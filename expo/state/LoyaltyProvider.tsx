import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import type { BookedCruise, ClubRoyaleTier, CrownAnchorLevel } from "@/types/models";
import { useCoreData } from "./CoreDataProvider";
import { useAuth } from "./AuthProvider";
import { useUser, type UserProfile } from "./UserProvider";
import { 
  CLUB_ROYALE_TIERS, 
  getTierByPoints, 
  getTierProgress,
  TIER_ORDER,
} from "@/constants/clubRoyaleTiers";
import {
  CROWN_ANCHOR_LEVELS,
  getLevelByNights,
  getLevelProgress,
} from "@/constants/crownAnchor";
import { createDateFromString } from "@/lib/date";
import { isRoyalCaribbeanShip } from "@/constants/shipInfo";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";
import { resolveRetainedTierState } from "@/lib/casinoProgram";
import type { ExtendedLoyaltyData } from "@/lib/royalCaribbean/types";

interface LoyaltyState {
  clubRoyalePoints: number;
  clubRoyaleTier: ClubRoyaleTier;
  clubRoyaleEarningTier: ClubRoyaleTier;
  clubRoyaleStatusExpiresAt: Date | null;
  clubRoyaleIsRetainedStatus: boolean;
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
  const { currentUser, updateUser } = useUser();
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
          setExtendedLoyaltyState(null);
        }
      } else {
        setExtendedLoyaltyState(null);
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
      console.log('[LoyaltyProvider] Data to save:', {
        hasRoyalData: Boolean(data.crownAndAnchorTier || data.clubRoyaleTierFromApi || data.clubRoyalePointsFromApi),
        hasCelebrityData: Boolean(data.captainsClubTier || data.captainsClubPoints || data.celebrityBlueChipTier || data.celebrityBlueChipPoints),
        hasSilverseaData: Boolean(data.venetianSocietyTier || data.venetianSocietyMemberNumber),
      });
      
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
      
      const profileUpdates: Partial<UserProfile> = {};
      if (data.celebrityBlueChipPoints !== undefined) {
        profileUpdates.celebrityBlueChipPoints = data.celebrityBlueChipPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Blue Chip points:', data.celebrityBlueChipPoints);
      }
      if (data.captainsClubPoints !== undefined) {
        profileUpdates.celebrityCaptainsClubPoints = data.captainsClubPoints;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Captains Club points:', data.captainsClubPoints);
      }
      if (data.captainsClubId !== undefined && data.captainsClubId !== null) {
        profileUpdates.celebrityCaptainsClubNumber = data.captainsClubId;
        console.log('[LoyaltyProvider] ✓ Updated Celebrity Captains Club number from sync payload');
      }
      if (data.venetianSocietyTier !== undefined && data.venetianSocietyTier !== null) {
        profileUpdates.silverseaVenetianTier = data.venetianSocietyTier;
        console.log('[LoyaltyProvider] ✓ Updated Silversea Venetian tier:', data.venetianSocietyTier);
      }
      if (data.venetianSocietyMemberNumber !== undefined && data.venetianSocietyMemberNumber !== null) {
        profileUpdates.silverseaVenetianNumber = data.venetianSocietyMemberNumber;
        console.log('[LoyaltyProvider] ✓ Updated Silversea Venetian member number from sync payload');
      }
      
      if (currentUser && Object.keys(profileUpdates).length > 0) {
        console.log('[LoyaltyProvider] ✓ Updating in-memory user profile with all cruise line data:', {
          userId: currentUser.id,
          updatedFields: Object.keys(profileUpdates),
        });
        await updateUser(currentUser.id, profileUpdates);
        console.log('[LoyaltyProvider] ✓ User profile updated live for loyalty progress refresh');
      }
      
      console.log('[LoyaltyProvider] ==================== SAVE COMPLETE ====================');
    } catch (error) {
      console.error('[LoyaltyProvider] ✗ Failed to save extended loyalty data:', error);
      throw error;
    }
  }, [currentUser, setManualClubRoyalePoints, setManualCrownAnchorPoints, updateUser]);

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
        const normalizedStatus = `${cruise.status ?? ''}`.trim().toLowerCase();
        const isCourtesyHold = cruise.isCourtesyHold === true || normalizedStatus === 'courtesy hold' || normalizedStatus === 'hold' || normalizedStatus === 'offer';
        const isCancelled = normalizedStatus === 'cancelled';

        if (isCourtesyHold || isCancelled) {
          console.log('[LoyaltyProvider] Skipping non-booked future cruise from loyalty projections:', {
            reservationNumber: cruise.reservationNumber,
            shipName: cruise.shipName,
            sailDate: cruise.sailDate,
            status: cruise.status ?? 'unknown',
            isCourtesyHold,
            isCancelled,
          });
          return;
        }

        bookedNights += nights;
        const isSolo = cruise.singleOccupancy !== false;
        const cabinType = cruise.cabinType || cruise.cabinCategory || '';
        const isSuite = cabinType.toLowerCase().includes('suite');
        
        let crownAnchorPointsForThisCruise = isSolo ? nights * 2 : nights * 1;
        
        if (isSuite && isSolo) {
          crownAnchorPointsForThisCruise = nights * 3;
          console.log('[LoyaltyProvider] Suite bonus applied for', cruise.shipName, 'cabin:', cabinType);
        } else if (isSuite && !isSolo) {
          crownAnchorPointsForThisCruise = nights * 2;
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

    const apiClubRoyalePoints = extendedLoyalty?.clubRoyalePointsFromApi;
    const effectiveClubRoyalePoints = typeof apiClubRoyalePoints === 'number'
      ? apiClubRoyalePoints
      : currentYearClubRoyalePoints;
    
    const effectiveCrownAnchorPoints = manualCrownAnchorPoints ?? completedNights;
    
    const fallbackClubRoyaleTier = (manualClubRoyalePoints !== null
      ? getTierByPoints(manualClubRoyalePoints)
      : getTierByPoints(effectiveClubRoyalePoints)) as ClubRoyaleTier;
    const resolvedClubRoyaleStatus = resolveRetainedTierState({
      currentPoints: effectiveClubRoyalePoints,
      activeTier: extendedLoyalty?.clubRoyaleTierFromApi ?? fallbackClubRoyaleTier,
      tierOrder: TIER_ORDER,
      thresholds: CLUB_ROYALE_TIERS,
      getTierByPoints,
      defaultTier: 'Choice',
      today,
    });
    const clubRoyaleTier = resolvedClubRoyaleStatus.displayTier as ClubRoyaleTier;
    const clubRoyaleEarningTier = resolvedClubRoyaleStatus.earnedTier as ClubRoyaleTier;
    const crownAnchorLevel = getLevelByNights(effectiveCrownAnchorPoints) as CrownAnchorLevel;
    
    const projectedCrownAnchorPoints = effectiveCrownAnchorPoints + projectedBookedPoints;
    const projectedCrownAnchorLevel = getLevelByNights(projectedCrownAnchorPoints) as CrownAnchorLevel;

    const clubRoyaleProgress = resolvedClubRoyaleStatus.isRetainedStatus
      ? {
          nextTier: resolvedClubRoyaleStatus.progressTargetTier,
          pointsToNext: resolvedClubRoyaleStatus.pointsToProgressTarget,
          percentComplete: resolvedClubRoyaleStatus.progressPercent,
        }
      : getTierProgress(effectiveClubRoyalePoints, clubRoyaleTier);
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
    const effectiveTotalPoints = effectiveClubRoyalePoints;
    
    const pointsNeededForMasters = Math.max(0, mastersThreshold - effectiveTotalPoints);
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
      percentComplete: Math.min(100, (effectiveTotalPoints / mastersThreshold) * 100),
      currentYearPoints: effectiveCurrentYearPoints,
      resetDate: nextApril1,
      projectedDate: projectedMastersDate,
    };

    console.log('[LoyaltyProvider] Calculated loyalty data:', {
      clubRoyalePoints: effectiveClubRoyalePoints,
      clubRoyaleTier,
      clubRoyaleEarningTier,
      clubRoyaleStatusExpiresAt: resolvedClubRoyaleStatus.retainedStatusExpiresAt,
      clubRoyaleIsRetainedStatus: resolvedClubRoyaleStatus.isRetainedStatus,
      crownAnchorPoints: effectiveCrownAnchorPoints,
      crownAnchorLevel,
      completedNights,
      bookedNights,
      projectedBookedPoints,
      projectedCrownAnchorPoints,
      projectedCrownAnchorLevel,
      pinnacleProgress,
      mastersProgress,
      currentYearClubRoyalePoints,
      calculatedClubRoyalePoints,
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
      clubRoyaleEarningTier,
      clubRoyaleStatusExpiresAt: resolvedClubRoyaleStatus.retainedStatusExpiresAt,
      clubRoyaleIsRetainedStatus: resolvedClubRoyaleStatus.isRetainedStatus,
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
