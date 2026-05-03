import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  BarChart3, 
  TrendingUp, 
  Ship, 
  DollarSign, 
  Award, 
  MapPin, 
  Zap,
  PieChart,
  Coins,
  Target,
  ChevronDown,
  Brain,
  LineChart,
  Receipt,
  Calendar,
  Dices,
  Calculator,
  Download,
  Save,
  X,
  Ticket,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useAuth } from '@/state/AuthProvider';
import { formatCurrency, formatCurrencyDetailed, formatNumber, formatPercentage } from '@/lib/format';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { createDateFromString } from '@/lib/date';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { 
  CLUB_ROYALE_TIERS, 
  getTierProgress
} from '@/constants/clubRoyaleTiers';
import { 
  getLevelProgress
} from '@/constants/crownAnchor';
import { DOLLARS_PER_POINT, type BookedCruise } from '@/types/models';
import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import { TierProgressionChart } from '@/components/charts/TierProgressionChart';
import { ROIProjectionChart } from '@/components/charts/ROIProjectionChart';
import { RiskAnalysisChart } from '@/components/charts/RiskAnalysisChart';
import { 
  PlayerContext, 
  runSimulation
} from '@/lib/whatIfSimulator';
import { useAlerts } from '@/state/AlertsProvider';
import { AlertsCard } from '@/components/AlertsCard';
import { CasinoMetricsCard } from '@/components/CasinoMetricsCard';
import { AddSessionModal } from '@/components/AddSessionModal';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { CasinoIntelligenceCard } from '@/components/CasinoIntelligenceCard';
import { GamificationCard } from '@/components/GamificationCard';
import { useGamification } from '@/state/GamificationProvider';
import { PointsPerHourCard } from '@/components/PointsPerHourCard';
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { LivePPHTracker } from '@/components/LivePPHTracker';
import { PPHGoalsCard } from '@/components/PPHGoalsCard';
import { WeeklyGoalsCard } from '@/components/WeeklyGoalsCard';
import { PPHHistoryChart } from '@/components/PPHHistoryChart';
import { PPHSessionComparison } from '@/components/PPHSessionComparison';
import { PPHLeaderboard } from '@/components/PPHLeaderboard';
import { PPHAlertContainer } from '@/components/PPHAlertNotification';
import { useHaptics } from '@/lib/useHaptics';
import { useDeferredRender } from '@/hooks/useDeferredRender';
import { usePPHAlerts } from '@/state/PPHAlertsProvider';
import { W2GTracker } from '@/components/W2GTracker';
import { CompValueCalculator } from '@/components/CompValueCalculator';
import { useTax } from '@/state/TaxProvider';
import type { MachineType, Denomination } from '@/state/CasinoSessionProvider';
import { SessionsSummaryCard } from '@/components/SessionsSummaryCard';
import { CompactDashboardHeader } from '@/components/CompactDashboardHeader';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useEntitlement } from '@/state/EntitlementProvider';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { buildCruiseEconomicsSummary, normalizeCruisesWithCasinoEconomics, type CruiseEconomicsRow } from '@/lib/casinoCruiseEconomics';
import { CONFIRMED_CLUB_ROYALE_2025_POINTS, getKnownCasinoProfileCruises, isKnownCasinoProfile } from '@/lib/knownProfileFallback';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import {
  DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR,
  buildCurrentSeasonCasinoMetrics,
  getBookedCruiseCasinoPoints,
  normalizeCruiseCasinoPerformance,
} from '@/lib/casinoPointTruth';

type AnalyticsTab = 'intelligence' | 'charts' | 'session' | 'calcs';
type ROIFilter = 'all' | 'high' | 'medium' | 'low';

type CruisePerformanceForm = {
  winLoss: string;
  pointsEarned: string;
  instantCertificateWon: boolean;
  instantCertificateOfferCode: string;
  instantCertificateValue: string;
  instantCertificateNotes: string;
};

const EMPTY_PERFORMANCE_FORM: CruisePerformanceForm = {
  winLoss: '',
  pointsEarned: '',
  instantCertificateWon: false,
  instantCertificateOfferCode: '',
  instantCertificateValue: '',
  instantCertificateNotes: '',
};

function parseNumberInput(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateCruiseROI(cruise: BookedCruise): { roi: number; valuePerDollar: number } {
  const summary = buildCruiseEconomicsSummary([cruise], new Date(), { scope: 'allCruises' });
  const row = summary.rows[0];

  if (row) {
    return {
      roi: row.paid > 0 ? (row.netCash / row.paid) * 100 : (row.netCash > 0 ? 1000 : 0),
      valuePerDollar: row.paid > 0 ? row.totalEconomic / row.paid : (row.totalEconomic > 0 ? 9999 : 0),
    };
  }

  const breakdown = calculateCruiseValue(cruise);
  return {
    roi: breakdown.trueOutOfPocket > 0 
      ? (breakdown.totalProfit / breakdown.trueOutOfPocket) * 100 
      : (breakdown.totalProfit > 0 ? 1000 : 0),
    valuePerDollar: breakdown.valuePerDollar === Infinity ? 9999 : breakdown.valuePerDollar
  };
}

function getCruiseROILevel(roi: number): 'high' | 'medium' | 'low' {
  if (roi >= 500) return 'high';
  if (roi >= 200) return 'medium';
  return 'low';
}

export default function AnalyticsScreen() {
  useEntitlement();
  const { authenticatedEmail } = useAuth();
  const { analytics, casinoAnalytics } = useSimpleAnalytics();
  const { 
    activeAlerts, 
    insights, 
    dismissAlert, 
    snoozeAlert, 
    clearAllAlerts,
    runDetection,
  } = useAlerts();
  const { clubRoyaleProfile, localData } = useAppState();
  const {
    bookedCruises: storedBookedCruises,
    isLoading: storeLoading,
    updateBookedCruise,
    addBookedCruise,
  } = useCoreData();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    clubRoyaleCurrentYearPoints,
    clubRoyaleHistoricalPoints,
    clubRoyaleHistoricalTier,
    clubRoyaleNextResetDate,
    clubRoyaleSyncDiscrepancy,
    crownAnchorPoints: loyaltyCrownAnchorPoints,
    crownAnchorLevel: loyaltyCrownAnchorLevel,
  } = useLoyalty();
  
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('intelligence');
  const [roiFilter, setRoiFilter] = useState<ROIFilter>('high');
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCruises, setShowAllCruises] = useState(false);
  const [showAllEconomicsRows, setShowAllEconomicsRows] = useState<boolean>(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    title: string;
    subtitle?: string;
    type: 'achievement' | 'streak' | 'milestone';
  } | null>(null);
  const [targetPPH, setTargetPPH] = useState(100);
  const [calcsMode, setCalcsMode] = useState<'per-session' | 'historical'>('per-session');
  const [isGeneratingSessions, setIsGeneratingSessions] = useState(false);
  const [selectedPerformanceCruise, setSelectedPerformanceCruise] = useState<BookedCruise | null>(null);
  const [performanceForm, setPerformanceForm] = useState<CruisePerformanceForm>(EMPTY_PERFORMANCE_FORM);
  
  const {
    sessions,
    addSession,
    getSessionAnalytics,
    generateHistoricalSessions,
  } = useCasinoSessions();

  const {
    streak,
    updateStreakFromSession,
    updateWeeklyGoalProgress,
    checkAndUnlockAchievements,
  } = useGamification();

  const haptics = useHaptics();
  const isScreenReady = useDeferredRender();
  const { alerts: pphAlerts, dismissAlert: dismissPPHAlert } = usePPHAlerts();
  const { stats: crewStats } = useCrewRecognition();
  const {
    w2gRecords,
    addW2GRecord,
    removeW2GRecord,
    compItems,
  } = useTax();

  const sessionAnalytics = useMemo(() => {
    return getSessionAnalytics();
  }, [getSessionAnalytics]);

  const bookedCruises = useMemo(() => {
    const localBooked = localData.booked || [];
    const storedBooked = storedBookedCruises || [];
    const primaryBooked = localBooked.length > 0 ? localBooked : storedBooked;
    const knownProfileCruises = getKnownCasinoProfileCruises(authenticatedEmail);

    if (knownProfileCruises.length > 0) {
      const mergedCruises = dedupeBookedCruises([...knownProfileCruises, ...primaryBooked].map(normalizeCruiseCasinoPerformance), 'analytics known-profile cruise merge');
      const normalizedMergedCruises = normalizeCruisesWithCasinoEconomics(mergedCruises, {
        includeKnownAnnualFacts: isKnownCasinoProfile(authenticatedEmail),
      });
      console.log('[Analytics] Using known profile cruise history merge:', {
        primary: primaryBooked.length,
        knownProfile: knownProfileCruises.length,
        merged: normalizedMergedCruises.length,
      });
      return normalizedMergedCruises;
    }

    if (primaryBooked.length > 0) return normalizeCruisesWithCasinoEconomics(primaryBooked.map(normalizeCruiseCasinoPerformance));
    console.log('[Analytics] No booked cruises available, using empty array');
    return [];
  }, [authenticatedEmail, localData.booked, storedBookedCruises]);



  const currentSeasonMetrics = useMemo(() => buildCurrentSeasonCasinoMetrics(bookedCruises), [bookedCruises]);
  const currentPoints = Math.max(loyaltyClubRoyalePoints, currentSeasonMetrics.points);
  const currentYearPoints = Math.max(clubRoyaleCurrentYearPoints, currentSeasonMetrics.points);
  const historicalPoints = Math.max(
    casinoAnalytics.historicalPointsEarned || 0,
    clubRoyaleHistoricalPoints || 0,
    analytics.totalPoints || 0,
    isKnownCasinoProfile(authenticatedEmail) ? CONFIRMED_CLUB_ROYALE_2025_POINTS : 0,
  );
  const totalNights = loyaltyCrownAnchorPoints || clubRoyaleProfile?.lifetimeNights || analytics.totalNights || 0;
  const clubRoyaleTier = loyaltyClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';
  const historicalClubRoyaleTier = clubRoyaleHistoricalTier || clubRoyaleTier;
  const crownAnchorLevel = loyaltyCrownAnchorLevel || clubRoyaleProfile?.crownAnchorLevel || 'Gold';
  const resetDateLabel = clubRoyaleNextResetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const cruisesWithROI = useMemo(() => {
    if (activeTab !== 'intelligence') return [] as (BookedCruise & { calculatedROI: number; valuePerDollar: number; roiLevel: 'high' | 'medium' | 'low' })[];
    const today = new Date();
    return bookedCruises
      .filter(cruise => {
        // Only include completed cruises in portfolio
        const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
        if (!isCompleted) return false;
        
        const points = getBookedCruiseCasinoPoints(cruise);
        const breakdown = calculateCruiseValue(cruise);
        return points > 0 || breakdown.taxesFees > 0 || breakdown.totalRetailValue > 0;
      })
      .map(cruise => {
        const { roi, valuePerDollar } = calculateCruiseROI(cruise);
        return {
          ...cruise,
          calculatedROI: roi,
          valuePerDollar,
          roiLevel: getCruiseROILevel(roi)
        };
      })
      .sort((a, b) => {
        return b.valuePerDollar - a.valuePerDollar;
      });
  }, [activeTab, bookedCruises]);

  const filteredCruises = useMemo(() => {
    if (roiFilter === 'all') return cruisesWithROI;
    return cruisesWithROI.filter(c => c.roiLevel === roiFilter);
  }, [cruisesWithROI, roiFilter]);

  const portfolioMetrics = useMemo(() => {
    const highROI = cruisesWithROI.filter(c => c.roiLevel === 'high').length;
    const mediumROI = cruisesWithROI.filter(c => c.roiLevel === 'medium').length;
    const lowROI = cruisesWithROI.filter(c => c.roiLevel === 'low').length;

    return {
      highROI,
      mediumROI,
      lowROI,
      totalCruises: cruisesWithROI.length // Only count completed cruises in portfolio
    };
  }, [cruisesWithROI]);

  const playerContext: PlayerContext = useMemo(() => {
    if (activeTab !== 'charts') {
      return {
        currentPoints: 0,
        currentNights: 0,
        currentTier: 'Choice',
        currentLevel: 'Gold',
        averagePointsPerNight: 0,
        averageNightsPerMonth: 0,
        averageSpendPerCruise: 0,
      };
    }
    const avgPointsPerNight = bookedCruises.length > 0
      ? bookedCruises.reduce((sum, c) => sum + getBookedCruiseCasinoPoints(c), 0) / 
        Math.max(1, bookedCruises.reduce((sum, c) => sum + (c.nights || 0), 0))
      : 150;
    
    const avgSpend = bookedCruises.length > 0
      ? bookedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0) / bookedCruises.length
      : 2000;

    return {
      currentPoints,
      currentNights: totalNights,
      currentTier: clubRoyaleTier,
      currentLevel: crownAnchorLevel,
      averagePointsPerNight: avgPointsPerNight || 150,
      averageNightsPerMonth: 7,
      averageSpendPerCruise: avgSpend || 2000,
    };
  }, [activeTab, currentPoints, totalNights, clubRoyaleTier, crownAnchorLevel, bookedCruises]);

  const baselineSimulation = useMemo(() => {
    return runSimulation(playerContext, bookedCruises, { type: 'custom', customPoints: 0, customNights: 0 });
  }, [playerContext, bookedCruises]);

  const todayDateString = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  const goldenTimeSlots = useMemo(() => {
    return [
      {
        id: 'morning',
        startTime: '05:00',
        endTime: '08:00',
        durationMinutes: 180,
        label: 'Early Morning',
      },
      {
        id: 'afternoon',
        startTime: '14:00',
        endTime: '17:00',
        durationMinutes: 180,
        label: 'Afternoon',
      },
      {
        id: 'late_night',
        startTime: '23:00',
        endTime: '02:00',
        durationMinutes: 180,
        label: 'Late Night',
      },
    ];
  }, []);


  const handleAddSession = useCallback(async (sessionData: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
    buyIn?: number;
    cashOut?: number;
    winLoss?: number;
    machineType?: MachineType;
    denomination?: Denomination;
    pointsEarned?: number;
  }) => {
    await addSession({
      date: todayDateString,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      durationMinutes: sessionData.durationMinutes,
      notes: sessionData.notes,
      buyIn: sessionData.buyIn,
      cashOut: sessionData.cashOut,
      winLoss: sessionData.winLoss,
      machineType: sessionData.machineType,
      denomination: sessionData.denomination,
      pointsEarned: sessionData.pointsEarned,
    });
    
    await updateStreakFromSession(todayDateString);
    
    await updateWeeklyGoalProgress('sessions', 1);
    await updateWeeklyGoalProgress('time', sessionData.durationMinutes);
    if (sessionData.pointsEarned) {
      await updateWeeklyGoalProgress('points', sessionData.pointsEarned);
    }
    
    const newTotalSessions = sessions.length + 1;
    const totalPoints = sessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0) + (sessionData.pointsEarned || 0);
    const jackpotCount = sessions.filter(s => s.jackpotHit).length;
    
    const unlockedAchievements = await checkAndUnlockAchievements({
      totalSessions: newTotalSessions,
      totalPoints,
      totalJackpots: jackpotCount,
      totalWinnings: sessionData.winLoss && sessionData.winLoss > 0 ? sessionData.winLoss : 0,
      sessionDuration: sessionData.durationMinutes,
      sessionTime: sessionData.startTime,
      currentStreak: streak.currentDailyStreak + 1,
    });
    
    if (unlockedAchievements.length > 0) {
      void haptics.success();
      setCelebrationData({
        title: 'Achievement Unlocked!',
        subtitle: `You earned: ${unlockedAchievements[0].replace(/_/g, ' ').toUpperCase()}`,
        type: 'achievement',
      });
      setShowCelebration(true);
    }
    
    setShowAddSessionModal(false);
    console.log('[Analytics] Session added with gamification:', sessionData);
  }, [addSession, todayDateString, updateStreakFromSession, updateWeeklyGoalProgress, checkAndUnlockAchievements, sessions, streak.currentDailyStreak, haptics]);


  getTierProgress(currentPoints, clubRoyaleTier);
  getLevelProgress(totalNights, crownAnchorLevel);

  const signatureThreshold = CLUB_ROYALE_TIERS.Signature.threshold;
  void signatureThreshold;

  const resyncAnalytics = useCallback(() => {
    console.log('[Analytics] Resyncing casino analytics and data...');
    runDetection();
  }, [runDetection]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    resyncAnalytics();
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, [resyncAnalytics]);

  useEffect(() => {
    console.log('[Analytics] Page loaded, syncing casino analytics...');
    resyncAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('[Analytics] Data changed (bookedCruises, sessions), resyncing...');
    resyncAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedCruises.length, sessions.length]);

  const findCruiseForPerformanceEdit = useCallback((cruiseId: string): BookedCruise | null => {
    return bookedCruises.find((cruise) => cruise.id === cruiseId) ?? null;
  }, [bookedCruises]);

  const openCruisePerformanceEditor = useCallback((cruise: BookedCruise) => {
    const existingWinLoss = cruise.winningsBroughtHome ?? cruise.winnings ?? cruise.netResult ?? cruise.totalWinnings ?? cruise.cashResult;
    const existingPoints = getBookedCruiseCasinoPoints(cruise) || undefined;
    const hasInstantCertificate = Boolean(
      cruise.instantCertificateWon ||
      cruise.instantCertificateOfferCode ||
      cruise.instantCertificateValue ||
      cruise.instantCertificateNotes,
    );

    setSelectedPerformanceCruise(cruise);
    setPerformanceForm({
      winLoss: typeof existingWinLoss === 'number' && Number.isFinite(existingWinLoss) ? String(existingWinLoss) : '',
      pointsEarned: typeof existingPoints === 'number' && Number.isFinite(existingPoints) ? String(existingPoints) : '',
      instantCertificateWon: hasInstantCertificate,
      instantCertificateOfferCode: cruise.instantCertificateOfferCode ?? '',
      instantCertificateValue: typeof cruise.instantCertificateValue === 'number' && Number.isFinite(cruise.instantCertificateValue) ? String(cruise.instantCertificateValue) : '',
      instantCertificateNotes: cruise.instantCertificateNotes ?? '',
    });
    void haptics.selection();
  }, [haptics]);

  const openCruisePerformanceEditorById = useCallback((cruiseId: string) => {
    const cruise = findCruiseForPerformanceEdit(cruiseId);
    if (!cruise) {
      console.log('[Analytics] Cruise performance edit skipped; cruise not found:', cruiseId);
      return;
    }
    openCruisePerformanceEditor(cruise);
  }, [findCruiseForPerformanceEdit, openCruisePerformanceEditor]);

  const closeCruisePerformanceEditor = useCallback(() => {
    setSelectedPerformanceCruise(null);
    setPerformanceForm(EMPTY_PERFORMANCE_FORM);
  }, []);

  const handleSaveCruisePerformance = useCallback(() => {
    if (!selectedPerformanceCruise) return;

    const pointsEarned = Math.round(parseNumberInput(performanceForm.pointsEarned));
    const winLoss = parseNumberInput(performanceForm.winLoss);
    const certificateValue = parseNumberInput(performanceForm.instantCertificateValue);
    const instantCertificateWon = performanceForm.instantCertificateWon;
    const now = new Date().toISOString();
    const selectedSummary = buildCruiseEconomicsSummary([selectedPerformanceCruise], new Date(), { scope: 'allCruises' });
    const selectedEconomicsRow = selectedSummary.rows[0];
    const retailValue = selectedEconomicsRow?.retail ?? selectedPerformanceCruise.retailValue ?? selectedPerformanceCruise.totalRetailCost ?? selectedPerformanceCruise.originalPrice ?? 0;
    const netEffectivePaid = selectedEconomicsRow?.paid ?? selectedPerformanceCruise.netEffectivePaid ?? selectedPerformanceCruise.amountPaid ?? selectedPerformanceCruise.pricePaid ?? selectedPerformanceCruise.totalPrice ?? selectedPerformanceCruise.price ?? 0;
    const cruiseValueCaptured = Math.round((retailValue - netEffectivePaid + Number.EPSILON) * 100) / 100;
    const cashResult = Math.round((winLoss - netEffectivePaid + Number.EPSILON) * 100) / 100;
    const totalEconomicValue = Math.round((retailValue + winLoss - netEffectivePaid + Number.EPSILON) * 100) / 100;
    const updates: Partial<BookedCruise> = {
      earnedPoints: pointsEarned,
      casinoPoints: pointsEarned,
      pointsEarned,
      coinIn: pointsEarned * 5,
      retailValue,
      totalRetailCost: retailValue,
      amountPaid: netEffectivePaid,
      netEffectivePaid,
      winnings: winLoss,
      winningsBroughtHome: winLoss,
      totalWinnings: winLoss,
      netResult: winLoss,
      cashResult,
      cruiseValueCaptured,
      totalEconomicValue,
      instantCertificateWon,
      instantCertificateOfferCode: instantCertificateWon ? performanceForm.instantCertificateOfferCode.trim() : '',
      instantCertificateValue: instantCertificateWon ? certificateValue : 0,
      instantCertificateNotes: instantCertificateWon ? performanceForm.instantCertificateNotes.trim() : '',
      completionState: 'completed',
      status: 'completed',
      calculationConfidence: 'actual',
      updatedAt: now,
    };

    const existsInStoredCruises = (storedBookedCruises ?? []).some((cruise) => cruise.id === selectedPerformanceCruise.id);
    if (existsInStoredCruises) {
      updateBookedCruise(selectedPerformanceCruise.id, updates);
    } else {
      addBookedCruise({
        ...selectedPerformanceCruise,
        ...updates,
        id: selectedPerformanceCruise.id || `performance-${Date.now()}`,
        createdAt: selectedPerformanceCruise.createdAt ?? now,
      });
    }

    console.log('[Analytics] Saved cruise performance:', {
      cruiseId: selectedPerformanceCruise.id,
      pointsEarned,
      winLoss,
      instantCertificateWon,
      hasCertificateCode: Boolean(updates.instantCertificateOfferCode),
    });
    void haptics.success();
    closeCruisePerformanceEditor();
  }, [addBookedCruise, closeCruisePerformanceEditor, haptics, performanceForm, selectedPerformanceCruise, storedBookedCruises, updateBookedCruise]);

  const cruiseEconomicsSummary = useMemo(() => {
    return buildCruiseEconomicsSummary(bookedCruises, new Date(), {
      useKnownAnnualReportFacts: isKnownCasinoProfile(authenticatedEmail),
      minimumTotalPoints: isKnownCasinoProfile(authenticatedEmail) ? CONFIRMED_CLUB_ROYALE_2025_POINTS : undefined,
      pointsAdjustmentNote: 'Historical Club Royale points use the confirmed 58,680-point 2025 season floor when imported per-cruise rows do not contain every point transaction.',
    });
  }, [authenticatedEmail, bookedCruises]);

  const cruiseEconomicsRowById = useMemo(() => {
    return new Map(cruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row]));
  }, [cruiseEconomicsSummary.rows]);

  const realAnalytics = useMemo(() => {
    const scopedCruiseIds = new Set(cruiseEconomicsSummary.rows.map((row) => row.cruiseId));
    const destinationCounts: Record<string, number> = {};

    bookedCruises.forEach((cruise: BookedCruise) => {
      if (!scopedCruiseIds.has(cruise.id)) {
        return;
      }

      if (cruise.destination) {
        destinationCounts[cruise.destination] = (destinationCounts[cruise.destination] || 0) + 1;
      }
    });

    const destinationDistribution = Object.entries(destinationCounts)
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count);

    const valuePerDollar = cruiseEconomicsSummary.totals.totalPaid > 0
      ? cruiseEconomicsSummary.totals.totalEconomicValue / cruiseEconomicsSummary.totals.totalPaid
      : 0;

    console.log('[Analytics] realAnalytics calculated:', {
      totalCruises: cruiseEconomicsSummary.totals.cruises,
      totalNights: cruiseEconomicsSummary.totals.totalNights,
      totalPaid: cruiseEconomicsSummary.totals.totalPaid,
      totalRetailValue: cruiseEconomicsSummary.totals.totalRetailValue,
      totalCruiseValueCaptured: cruiseEconomicsSummary.totals.totalCruiseValueCaptured,
      totalWinnings: cruiseEconomicsSummary.totals.totalWinningsHome,
      totalCashResult: cruiseEconomicsSummary.totals.totalCashResult,
      totalEconomicValue: cruiseEconomicsSummary.totals.totalEconomicValue,
      totalCoinIn: cruiseEconomicsSummary.totals.totalCoinIn,
      valuePerDollar,
      cashROI: cruiseEconomicsSummary.roiStyle.cashROI,
    });

    return {
      totalCruises: cruiseEconomicsSummary.totals.cruises,
      completedCruisesCount: cruiseEconomicsSummary.totals.cruises,
      totalNights: cruiseEconomicsSummary.totals.totalNights,
      totalTaxesFees: cruiseEconomicsSummary.totals.totalPaid,
      totalOutOfPocket: cruiseEconomicsSummary.totals.totalPaid,
      totalRetailValue: cruiseEconomicsSummary.totals.totalRetailValue,
      totalCruiseValueCaptured: cruiseEconomicsSummary.totals.totalCruiseValueCaptured,
      totalCoinIn: cruiseEconomicsSummary.totals.totalCoinIn,
      totalWinnings: cruiseEconomicsSummary.totals.totalWinningsHome,
      netCasinoResult: cruiseEconomicsSummary.totals.totalCashResult,
      totalEconomicValue: cruiseEconomicsSummary.totals.totalEconomicValue,
      totalPoints: cruiseEconomicsSummary.totals.totalPoints,
      cashROI: cruiseEconomicsSummary.roiStyle.cashROI,
      valuePerDollar,
      destinationDistribution,
      completedTaxesFees: cruiseEconomicsSummary.totals.totalPaid,
      completedOutOfPocket: cruiseEconomicsSummary.totals.totalPaid,
      completedRetailValue: cruiseEconomicsSummary.totals.totalRetailValue,
      completedCruiseValueCaptured: cruiseEconomicsSummary.totals.totalCruiseValueCaptured,
      completedCoinIn: cruiseEconomicsSummary.totals.totalCoinIn,
      completedWinnings: cruiseEconomicsSummary.totals.totalWinningsHome,
      completedNetCasinoResult: cruiseEconomicsSummary.totals.totalCashResult,
      completedCashResult: cruiseEconomicsSummary.totals.totalCashResult,
      completedEconomicValue: cruiseEconomicsSummary.totals.totalEconomicValue,
      completedPoints: cruiseEconomicsSummary.totals.totalPoints,
      completedROI: cruiseEconomicsSummary.roiStyle.netRoiOnPaid,
    };
  }, [bookedCruises, cruiseEconomicsSummary]);

  const visibleEconomicsRows = useMemo((): CruiseEconomicsRow[] => {
    return showAllEconomicsRows
      ? cruiseEconomicsSummary.rows
      : cruiseEconomicsSummary.rows.slice(0, 8);
  }, [cruiseEconomicsSummary.rows, showAllEconomicsRows]);

  const formatSignedCurrencyDetailed = useCallback((amount: number): string => {
    return `${amount >= 0 ? '+' : '-'}${formatCurrencyDetailed(Math.abs(amount))}`;
  }, []);

  const stats = useMemo(() => {
    if (activeTab !== 'intelligence') return [] as { label: string; value: string; icon: any; color?: string }[];
    return [
      { label: 'Cruises', value: cruiseEconomicsSummary.totals.cruises.toString(), icon: Ship },
      { label: 'Status Tier', value: clubRoyaleTier, icon: Award },
      {
        label: 'Current Pts',
        value: formatNumber(currentYearPoints),
        icon: Calendar,
      },
      {
        label: 'Historical Pts',
        value: formatNumber(historicalPoints),
        icon: DollarSign,
      },
    ];
  }, [activeTab, clubRoyaleTier, cruiseEconomicsSummary, currentYearPoints, historicalPoints]);

  const perCruisePointsBreakdown = useMemo(() => {
    if (activeTab !== 'intelligence') return [] as { id: string; shipName: string; sailDate: string; nights: number; cruiseSource: string; casinoPoints: number; loyaltyPoints: number; casinoLabel: string; loyaltyLabel: string }[];
    const today = new Date();
    return bookedCruises
      .filter(cruise => {
        const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
        return isCompleted;
      })
      .map(cruise => {
        const casinoPoints = getBookedCruiseCasinoPoints(cruise);
        const nights = cruise.nights || 0;
        const isRCI = isRoyalCaribbeanShip(cruise.shipName);
        const source = cruise.cruiseSource || (isRCI ? 'royal' : 'celebrity');
        const isSolo = cruise.singleOccupancy !== false;
        const cabinType = cruise.cabinType || cruise.cabinCategory || '';
        const isSuite = cabinType.toLowerCase().includes('suite');
        let loyaltyPoints: number;
        if (isSuite && isSolo) loyaltyPoints = nights * 3;
        else if (isSuite) loyaltyPoints = nights * 2;
        else if (isSolo) loyaltyPoints = nights * 2;
        else loyaltyPoints = nights;
        const casinoLabel = source === 'royal' ? 'Club Royale' : source === 'celebrity' ? 'Blue Chip' : 'Casino';
        const loyaltyLabel = source === 'royal' ? 'Crown & Anchor' : source === 'celebrity' ? "Captain's Club" : 'Cruise Loyalty';
        return {
          id: cruise.id,
          shipName: cruise.shipName || 'Unknown',
          sailDate: cruise.sailDate || '',
          nights,
          cruiseSource: source,
          casinoPoints,
          loyaltyPoints,
          casinoLabel,
          loyaltyLabel,
        };
      })
      .sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime());
  }, [activeTab, bookedCruises]);

  const buildCasinoCruisesCsv = useCallback((cruises: BookedCruise[]): string => {
    console.log('[CasinoCruiseExport] Building CSV...', { cruiseCount: cruises.length });

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      const str = typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
      const needsQuotes = /[\n\r\t",]/.test(str);
      const escaped = str.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const header = [
      'shipName',
      'sailDate',
      'returnDate',
      'nights',
      'departurePort',
      'destination',
      'itineraryName',
      'offerCode',
      'cabinType',
      'stateroomNumber',
      'stateroomCategoryCode',
      'stateroomType',
      'cabinNumber',
      'deckNumber',
      'packageCode',
      'passengerStatus',
      'pointsEarned',
      'winLoss',
      'actualSpend',
      'totalRetailCost',
    ];

    const rows = cruises.map((cruise) => {
      const pointsEarned = getBookedCruiseCasinoPoints(cruise);
      const winLoss = cruise.winnings ?? cruise.netResult ?? cruise.totalWinnings ?? 0;

      return [
        cruise.shipName,
        cruise.sailDate,
        cruise.returnDate,
        cruise.nights,
        cruise.departurePort,
        cruise.destination,
        cruise.itineraryName,
        cruise.offerCode,
        cruise.cabinType,
        cruise.stateroomNumber,
        cruise.stateroomCategoryCode,
        cruise.stateroomType,
        cruise.cabinNumber,
        cruise.deckNumber,
        cruise.packageCode,
        cruise.passengerStatus,
        pointsEarned,
        winLoss,
        cruise.actualSpend,
        cruise.totalRetailCost,
      ].map(escapeCsv).join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }, []);

  const handleExportCruisePortfolio = useCallback(async () => {
    try {
      console.log('[CasinoCruiseExport] Export requested');

      const today = new Date();
      const completedCruises = bookedCruises.filter((c) => {
        if (c.completionState === 'completed' || c.status === 'completed') return true;
        if (c.returnDate) {
          const returnDate = createDateFromString(c.returnDate);
          return returnDate < today;
        }
        return false;
      });

      const cruisesToExport = completedCruises.filter((c) => {
        const points = getBookedCruiseCasinoPoints(c);
        const winLoss = c.winnings ?? c.netResult ?? c.totalWinnings ?? 0;
        return points > 0 || winLoss !== 0;
      });

      console.log('[CasinoCruiseExport] Filtered cruises to export', {
        completed: completedCruises.length,
        exportable: cruisesToExport.length,
      });

      if (cruisesToExport.length === 0) {
        console.log('[CasinoCruiseExport] No cruises with points or win/loss found - skipping export');
        return;
      }

      const filename = 'CasinoCruises.csv';
      const csv = buildCasinoCruisesCsv(cruisesToExport);

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[CasinoCruiseExport] Web download started');
        return;
      }

      const file = new ExpoFile(ExpoPaths.cache, filename);
      file.write(csv);

      const fileUri = file.uri;

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        console.log('[CasinoCruiseExport] Sharing not available on this device');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export CasinoCruises.csv',
      });

      console.log('[CasinoCruiseExport] Share sheet opened', { fileUri });
    } catch (e) {
      console.log('[CasinoCruiseExport] Export failed', e);
    }
  }, [bookedCruises, buildCasinoCruisesCsv]);

  const renderROIFilterTabs = () => (
    <View style={styles.filterTabsRow}>
      <View style={styles.filterTabs}>
        {(['all', 'high', 'medium', 'low'] as ROIFilter[]).map((filter) => {
          const isActive = roiFilter === filter;
          const count = filter === 'all'
            ? portfolioMetrics.totalCruises
            : portfolioMetrics[`${filter}ROI` as keyof typeof portfolioMetrics];
          const label = filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1);

          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setRoiFilter(filter)}
              activeOpacity={0.7}
              testID={`casino-portfolio-filter-${filter}`}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {label}
              </Text>
              <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.exportButton}
        activeOpacity={0.8}
        onPress={handleExportCruisePortfolio}
        testID="casino-portfolio-export"
      >
        <Download size={16} color={COLORS.navyDeep} />
        <Text style={styles.exportButtonText}>Export</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPortfolioCard = (cruise: typeof cruisesWithROI[0]) => {
    const breakdown = calculateCruiseValue(cruise);
    const economicsRow = cruiseEconomicsRowById.get(cruise.id);
    const winnings = economicsRow?.winningsHome ?? cruise.winnings ?? 0;
    const earnedPoints = economicsRow?.points ?? getBookedCruiseCasinoPoints(cruise);
    
    const roiColor = cruise.roiLevel === 'high' 
      ? COLORS.success 
      : cruise.roiLevel === 'medium' 
        ? COLORS.warning 
        : COLORS.error;

    const effectiveValuePerDollar = economicsRow && economicsRow.paid > 0
      ? economicsRow.totalEconomic / economicsRow.paid
      : cruise.valuePerDollar;
    const valuePerDollarDisplay = effectiveValuePerDollar >= 9999
      ? '∞'
      : `${effectiveValuePerDollar.toFixed(2)}`;

    const imageHash = cruise.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const cruiseImage = getImageForDestination(cruise.destination || '', imageHash + 1);

    const formatDateRange = (sailDate: string, returnDate?: string, nights?: number) => {
      const start = createDateFromString(sailDate);
      const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const startDay = start.getDate();
      const startYear = start.getFullYear();
      
      if (returnDate) {
        const end = createDateFromString(returnDate);
        const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        const endDay = end.getDate();
        
        if (startMonth === endMonth) {
          return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
        }
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
      }
      
      if (nights) {
        const end = new Date(start);
        end.setDate(end.getDate() + nights);
        const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        const endDay = end.getDate();
        
        if (startMonth === endMonth) {
          return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
        }
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
      }
      
      return `${startMonth} ${startDay}, ${startYear}`;
    };

    const getItineraryName = () => {
      if (cruise.itineraryName) {
        const parts = cruise.itineraryName.split(':');
        if (parts.length > 1) {
          return parts[1].trim();
        }
        return cruise.itineraryName;
      }
      return `${cruise.nights || 0} Night ${cruise.destination}`;
    };

    return (
      <TouchableOpacity
        key={cruise.id}
        style={styles.portfolioCard}
        onPress={() => openCruisePerformanceEditorById(cruise.id)}
        activeOpacity={0.85}
      >
        <View style={styles.portfolioImageContainer}>
          <Image 
            source={{ uri: cruiseImage }} 
            style={styles.portfolioCardImage}
            resizeMode="cover"
            defaultSource={{ uri: DEFAULT_CRUISE_IMAGE }}
          />
          {earnedPoints > 0 && (
            <View style={styles.pointsOverlay}>
              <Award size={14} color={COLORS.white} />
              <Text style={styles.pointsOverlayText}>{formatNumber(earnedPoints)} pts</Text>
            </View>
          )}
        </View>
        <View style={styles.portfolioCardContent}>
          <View style={styles.portfolioCardTopRow}>
            <View style={styles.portfolioCardShipRow}>
              <Ship size={13} color={COLORS.navyDeep} />
              <Text style={styles.portfolioCardShipName} numberOfLines={1}>
                {cruise.shipName || 'Unknown Ship'}
              </Text>
            </View>
            <View style={[styles.roiBadge, { backgroundColor: `${roiColor}15` }]}>
              <Text style={[styles.roiBadgeText, { color: roiColor }]}>
                {valuePerDollarDisplay}/$
              </Text>
            </View>
          </View>
          
          <Text style={styles.portfolioCardItinerary} numberOfLines={1}>
            {getItineraryName()}
          </Text>
          
          <Text style={styles.portfolioCardDestination} numberOfLines={1}>
            {cruise.departurePort ? `From ${cruise.departurePort}` : cruise.destination}
          </Text>
          
          <View style={styles.portfolioCardMetaRow}>
            <View style={styles.portfolioCardMeta}>
              <Calendar size={12} color={COLORS.navyDeep} />
              <Text style={styles.portfolioCardMetaText}>
                {cruise.sailDate ? formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights) : 'No date'}
              </Text>
            </View>
            <Text style={styles.portfolioCardNights}>{cruise.nights || 0}N</Text>
          </View>
          
          <View style={styles.portfolioCardMetrics}>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Retail</Text>
              <Text style={styles.portfolioMetricValue}>{formatCurrency(economicsRow?.retail ?? breakdown.cabinValueForTwo)}</Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Paid</Text>
              <Text style={styles.portfolioMetricValue}>{formatCurrency(economicsRow?.paid ?? breakdown.amountPaid)}</Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Cash Result</Text>
              <Text style={[styles.portfolioMetricValue, { color: (economicsRow?.netCash ?? winnings) >= 0 ? COLORS.success : COLORS.error }]}>
                {(economicsRow?.netCash ?? winnings) >= 0 ? '+' : ''}{formatCurrency(economicsRow?.netCash ?? winnings)}
              </Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Total Econ</Text>
              <Text style={[styles.portfolioMetricValue, { color: (economicsRow?.totalEconomic ?? breakdown.totalProfit) >= 0 ? COLORS.success : COLORS.error }]}>
                {formatCurrency(economicsRow?.totalEconomic ?? breakdown.totalProfit)}
              </Text>
            </View>
          </View>
          
          {cruise.cabinType ? (
            <View style={styles.portfolioCardFooter}>
              <Text style={styles.portfolioCardCabin}>{cruise.cabinType}</Text>
              {cruise.offerCode ? (
                <View style={styles.portfolioOfferBadge}>
                  <Zap size={10} color={COLORS.goldDark} />
                  <Text style={styles.portfolioOfferCode}>{cruise.offerCode}</Text>
                </View>
              ) : null}
              {cruise.instantCertificateWon ? (
                <View style={styles.portfolioCertificateBadge}>
                  <Ticket size={10} color="#047857" />
                  <Text style={styles.portfolioCertificateText}>Cert won</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderIntelligenceTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.quickStatsRow}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.quickStatItem}>
            <stat.icon size={16} color={stat.color || COLORS.navyDeep} />
            <Text style={[styles.quickStatValue, stat.color && { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.quickStatLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section} testID="casino-player-loyalty-section">
        <CompactDashboardHeader
          hideLogo={true}
          memberName={clubRoyaleProfile?.memberName || 'Player'}
          crownAnchorNumber={(clubRoyaleProfile as any)?.crownAnchorNumber}
          crewMemberCount={crewStats?.crewMemberCount || 0}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.cleanCard} testID="casino-current-vs-historical-card">
          <View style={styles.cleanCardHeader}>
            <Calendar size={16} color={COLORS.navyDeep} />
            <Text style={styles.cleanCardTitle}>Current vs Historical</Text>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Current Status Tier</Text>
              <Text style={[styles.dataValue, { color: COLORS.navyDeep }]}>{clubRoyaleTier}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Current Season Points</Text>
              <Text style={styles.dataValue}>{formatNumber(currentYearPoints)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Signature Retain Gap</Text>
              <Text style={[styles.dataValue, { color: currentSeasonMetrics.pointsNeededForSignature === 0 ? COLORS.success : COLORS.warning }]}>{formatNumber(currentSeasonMetrics.pointsNeededForSignature)} pts</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Current Season Coin-In</Text>
              <Text style={styles.dataValue}>{formatCurrencyDetailed(currentSeasonMetrics.coinIn)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Avg Points / Night</Text>
              <Text style={styles.dataValue}>{currentSeasonMetrics.averagePointsPerNight.toFixed(2)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Est. Casino Play</Text>
              <Text style={styles.dataValue}>{currentSeasonMetrics.estimatedPlayHours.toFixed(1)} hrs</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Est. Daily Play Hours</Text>
              <Text style={styles.dataValue}>{currentSeasonMetrics.averageDailyPlayHours.toFixed(2)} hrs/day</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Historical Points Earned</Text>
              <Text style={[styles.dataValue, { color: COLORS.goldDark }]}>{formatNumber(historicalPoints)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Historical Tier Earned</Text>
              <Text style={[styles.dataValue, { color: COLORS.success }]}>{historicalClubRoyaleTier}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Next Reset Date</Text>
              <Text style={styles.dataValue}>{resetDateLabel}</Text>
            </View>
          </View>
          <View style={styles.avgStatsRow}>
            <Text style={styles.avgStatText}>April 1 resets current-year Club Royale points only. Historical ROI, coin-in, cash result, and annual cruise analytics stay historical.</Text>
            <Text style={styles.avgStatText}>Current season uses {currentSeasonMetrics.cruises} completed Royal Caribbean cruise(s), {currentSeasonMetrics.nights} nights, and {formatNumber(currentSeasonMetrics.points)} app-entered points.</Text>
          </View>
          {clubRoyaleSyncDiscrepancy.hasDiscrepancy && clubRoyaleSyncDiscrepancy.message ? (
            <View style={styles.discrepancyNotice} testID="club-royale-discrepancy-notice">
              <Text style={styles.discrepancyTitle}>Club Royale sync discrepancy</Text>
              <Text style={styles.discrepancyText}>{clubRoyaleSyncDiscrepancy.message}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.cleanCard}>
          <View style={styles.cleanCardHeader}>
            <Receipt size={16} color={COLORS.navyDeep} />
            <Text style={styles.cleanCardTitle}>Financial Overview</Text>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Retail Value</Text>
              <Text style={[styles.dataValue, { color: COLORS.success }]}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalRetail)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Amount Paid</Text>
              <Text style={styles.dataValue}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Cruise Value Captured</Text>
              <Text style={[styles.dataValue, { color: COLORS.success }]}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Winnings Brought Home</Text>
              <Text style={[styles.dataValue, { color: cruiseEconomicsSummary.totals.totalWinningsHome >= 0 ? COLORS.success : COLORS.error }]}>
                {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome)}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Cash Result</Text>
              <Text style={[styles.dataValue, { color: cruiseEconomicsSummary.totals.totalCashResult >= 0 ? COLORS.success : COLORS.error }]}>
                {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult)}
              </Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowTotal]}>
              <Text style={styles.dataTotalLabel}>Total Economic Value</Text>
              <Text style={[styles.dataTotalValue, { color: cruiseEconomicsSummary.totals.totalEconomicValue >= 0 ? COLORS.success : COLORS.error }]}>
                {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {cruiseEconomicsSummary.rows.length > 0 && (
        <View style={styles.section}>
          <View style={styles.economicsCard} testID="casino-cruise-economics-card">
            <View style={styles.economicsHeader}>
              <View style={styles.economicsHeaderIcon}>
                <TrendingUp size={18} color={COLORS.navyDeep} />
              </View>
              <View style={styles.economicsHeaderContent}>
                <Text style={styles.economicsTitle}>Cruise Economics</Text>
                <Text style={styles.economicsSubtitle}>Completed Royal Caribbean annual report with retail, paid, cruise value, winnings, cash result, and total economic value</Text>
              </View>
            </View>

            <View style={styles.economicsHeroStatsRow}>
              <View style={styles.economicsHeroStat}>
                <Text style={styles.economicsHeroStatValue}>{cruiseEconomicsSummary.totals.cruises}</Text>
                <Text style={styles.economicsHeroStatLabel}>Cruises</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={styles.economicsHeroStatValue}>{formatCurrency(cruiseEconomicsSummary.totals.totalPaid)}</Text>
                <Text style={styles.economicsHeroStatLabel}>Paid</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={[styles.economicsHeroStatValue, { color: COLORS.success }]}>{formatCurrency(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)}</Text>
                <Text style={styles.economicsHeroStatLabel}>Cruise Value</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={[styles.economicsHeroStatValue, { color: cruiseEconomicsSummary.totals.totalCashResult >= 0 ? COLORS.success : COLORS.error }]}>
                  {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult)}
                </Text>
                <Text style={styles.economicsHeroStatLabel}>Cash Result</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={[styles.economicsHeroStatValue, { color: cruiseEconomicsSummary.totals.totalEconomicValue >= 0 ? COLORS.success : COLORS.error }]}>
                  {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue)}
                </Text>
                <Text style={styles.economicsHeroStatLabel}>Total Econ</Text>
              </View>
            </View>

            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.economicsTableContent}
              testID="casino-cruise-economics-table"
            >
              <View style={styles.economicsTable}>
                <View style={styles.economicsTableHeader}>
                  <Text style={[styles.economicsHeaderCell, styles.economicsDateCell]}>Sail Date</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsShipCell]}>Ship</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsNightsCell]}>Nights</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Retail</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Paid</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Cruise Value</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsPointsCell]}>Points</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Winnings</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Cash Result</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsMoneyCell]}>Total Econ</Text>
                  <Text style={[styles.economicsHeaderCell, styles.economicsStatusCell]}>Confidence</Text>
                </View>

                {visibleEconomicsRows.map((row, index) => {
                  const isLastVisibleRow = index === visibleEconomicsRows.length - 1;
                  const statusStyle = row.calculationConfidence === 'actual'
                    ? styles.economicsStatusKnown
                    : row.calculationConfidence === 'estimated'
                      ? styles.economicsStatusEstimated
                      : styles.economicsStatusPending;
                  const confidenceLabel = row.calculationConfidence === 'mixed'
                    ? 'Partial'
                    : row.calculationConfidence === 'actual'
                      ? 'Actual'
                      : 'Estimated';

                  return (
                    <TouchableOpacity
                      key={row.cruiseId}
                      style={[styles.economicsTableRow, isLastVisibleRow && styles.economicsTableRowLast]}
                      activeOpacity={0.75}
                      onPress={() => openCruisePerformanceEditorById(row.cruiseId)}
                      testID={`casino-economics-row-${row.cruiseId}`}
                    >
                      <Text style={[styles.economicsCell, styles.economicsDateCell]}>{row.sailDate}</Text>
                      <Text style={[styles.economicsCell, styles.economicsShipCell]} numberOfLines={1}>{row.ship}</Text>
                      <Text style={[styles.economicsCell, styles.economicsNightsCell]}>{row.nights}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.retail)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.paid)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.discount)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsPointsCell]}>{formatNumber(row.points)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell, { color: row.winningsHome >= 0 ? COLORS.success : COLORS.error }]}>{formatSignedCurrencyDetailed(row.winningsHome)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell, row.netCash >= 0 ? styles.economicsPositiveValue : styles.economicsNegativeValue]}>{formatSignedCurrencyDetailed(row.netCash)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell, row.totalEconomic >= 0 ? styles.economicsPositiveValue : styles.economicsNegativeValue]}>{formatSignedCurrencyDetailed(row.totalEconomic)}</Text>
                      <View style={[styles.economicsStatusPill, statusStyle]}>
                        <Text style={styles.economicsStatusText}>{confidenceLabel}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <View style={[styles.economicsTableRow, styles.economicsTotalsRow]}>
                  <Text style={[styles.economicsCell, styles.economicsDateCell]}>TOTAL</Text>
                  <Text style={[styles.economicsCell, styles.economicsShipCell]} numberOfLines={1}>Annual Totals</Text>
                  <Text style={[styles.economicsCell, styles.economicsNightsCell]}>{cruiseEconomicsSummary.totals.totalNights}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalRetailValue)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsPointsCell]}>{formatNumber(cruiseEconomicsSummary.totals.totalPoints)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell, { color: cruiseEconomicsSummary.totals.totalWinningsHome >= 0 ? COLORS.success : COLORS.error }]}>{formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell, cruiseEconomicsSummary.totals.totalCashResult >= 0 ? styles.economicsPositiveValue : styles.economicsNegativeValue]}>{formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult)}</Text>
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell, cruiseEconomicsSummary.totals.totalEconomicValue >= 0 ? styles.economicsPositiveValue : styles.economicsNegativeValue]}>{formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue)}</Text>
                  <View style={[styles.economicsStatusPill, cruiseEconomicsSummary.totals.hasEstimates ? styles.economicsStatusPending : styles.economicsStatusKnown]}>
                    <Text style={styles.economicsStatusText}>{cruiseEconomicsSummary.totals.hasEstimates ? 'Partial' : 'Actual'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {cruiseEconomicsSummary.rows.length > 8 && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                activeOpacity={0.7}
                onPress={() => setShowAllEconomicsRows(!showAllEconomicsRows)}
                testID="toggle-cruise-economics-rows"
              >
                <Text style={styles.viewMoreText}>
                  {showAllEconomicsRows ? 'Show fewer economics rows' : `View all ${cruiseEconomicsSummary.rows.length} rows`}
                </Text>
                <ChevronDown
                  size={16}
                  color={COLORS.navyDeep}
                  style={{ transform: [{ rotate: showAllEconomicsRows ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}

            {cruiseEconomicsSummary.footnotes.length > 0 && (
              <View style={styles.avgStatsRow}>
                <Text style={styles.avgStatText}>{cruiseEconomicsSummary.footnotes[0]}</Text>
              </View>
            )}

            <View style={styles.economicsSummarySection}>
              <Text style={styles.economicsSectionTitle}>Annual averages</Text>
              <View style={styles.economicsSummaryGrid}>
                {[
                  { label: 'Avg nights / cruise', value: cruiseEconomicsSummary.averages.nightsPerCruise.toFixed(2) },
                  { label: 'Avg retail / cruise', value: formatCurrencyDetailed(cruiseEconomicsSummary.averages.retailPerCruise) },
                  { label: 'Avg paid / cruise', value: formatCurrencyDetailed(cruiseEconomicsSummary.averages.paidPerCruise) },
                  { label: 'Avg winnings / cruise', value: formatCurrencyDetailed(cruiseEconomicsSummary.averages.winningsPerCruise) },
                  { label: 'Avg cash result / cruise', value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.averages.netCashPerCruise) },
                  { label: 'Avg total econ / cruise', value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.averages.totalEconomicValuePerCruise) },
                  { label: 'Avg points / night', value: cruiseEconomicsSummary.averages.pointsPerNight.toFixed(2) },
                ].map((item) => (
                  <View key={item.label} style={styles.economicsSummaryCard}>
                    <Text style={styles.economicsSummaryLabel}>{item.label}</Text>
                    <Text style={styles.economicsSummaryValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.economicsSummarySection}>
              <Text style={styles.economicsSectionTitle}>Annual KPI summary</Text>
              <View style={styles.economicsSummaryGrid}>
                {[
                  { label: 'Cash ROI', value: `${cruiseEconomicsSummary.roiStyle.cashROI.toFixed(2)}x` },
                  { label: 'Cruise value multiple', value: `${cruiseEconomicsSummary.roiStyle.cruiseValueMultiple.toFixed(2)}x` },
                  { label: 'Comp coverage rate', value: formatPercentage(cruiseEconomicsSummary.roiStyle.compCoverageRate * 100, 2) },
                  { label: 'Winnings multiple', value: `${cruiseEconomicsSummary.roiStyle.winningsMultiple.toFixed(2)}x` },
                  { label: 'Value per hour', value: cruiseEconomicsSummary.roiStyle.valuePerHour > 0 ? formatCurrencyDetailed(cruiseEconomicsSummary.roiStyle.valuePerHour) : '—' },
                ].map((item) => (
                  <View key={item.label} style={styles.economicsSummaryCard}>
                    <Text style={styles.economicsSummaryLabel}>{item.label}</Text>
                    <Text style={styles.economicsSummaryValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.economicsSummarySection}>
              <Text style={styles.economicsSectionTitle}>Best / worst snapshots</Text>
              <View style={styles.economicsSnapshotsList}>
                {[
                  {
                    label: 'Best cash cruise',
                    row: cruiseEconomicsSummary.snapshots.bestCashCruise,
                    value: cruiseEconomicsSummary.snapshots.bestCashCruise ? formatSignedCurrencyDetailed(cruiseEconomicsSummary.snapshots.bestCashCruise.netCash) : '—',
                    detail: cruiseEconomicsSummary.snapshots.bestCashCruise ? `Paid ${formatCurrencyDetailed(cruiseEconomicsSummary.snapshots.bestCashCruise.paid)} • Winnings ${formatCurrencyDetailed(cruiseEconomicsSummary.snapshots.bestCashCruise.winningsHome)}` : 'No data',
                  },
                  {
                    label: 'Biggest cruise-value capture',
                    row: cruiseEconomicsSummary.snapshots.biggestCompValueCruise,
                    value: cruiseEconomicsSummary.snapshots.biggestCompValueCruise ? formatCurrencyDetailed(cruiseEconomicsSummary.snapshots.biggestCompValueCruise.discount) : '—',
                    detail: cruiseEconomicsSummary.snapshots.biggestCompValueCruise ? `Retail ${formatCurrencyDetailed(cruiseEconomicsSummary.snapshots.biggestCompValueCruise.retail)} • Paid ${formatCurrencyDetailed(cruiseEconomicsSummary.snapshots.biggestCompValueCruise.paid)}` : 'No data',
                  },
                  {
                    label: 'Best points cruise',
                    row: cruiseEconomicsSummary.snapshots.bestPointsCruise,
                    value: cruiseEconomicsSummary.snapshots.bestPointsCruise ? formatNumber(cruiseEconomicsSummary.snapshots.bestPointsCruise.points) : '—',
                    detail: cruiseEconomicsSummary.snapshots.bestPointsCruise ? `${cruiseEconomicsSummary.snapshots.bestPointsCruise.nights} nights` : 'No data',
                  },
                  {
                    label: 'Best points-per-night',
                    row: cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise,
                    value: cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise ? cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise.pointsPerNight.toFixed(2) : '—',
                    detail: cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise ? `${formatNumber(cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise.points)} pts across ${cruiseEconomicsSummary.snapshots.bestPointsPerNightCruise.nights} nights` : 'No data',
                  },
                  {
                    label: 'Weakest points cruise',
                    row: cruiseEconomicsSummary.snapshots.weakestPointsCruise,
                    value: cruiseEconomicsSummary.snapshots.weakestPointsCruise ? formatNumber(cruiseEconomicsSummary.snapshots.weakestPointsCruise.points) : '—',
                    detail: cruiseEconomicsSummary.snapshots.weakestPointsCruise ? `${cruiseEconomicsSummary.snapshots.weakestPointsCruise.nights} nights` : 'No data',
                  },
                ].map((item) => (
                  <View key={item.label} style={styles.economicsSnapshotCard}>
                    <View style={styles.economicsSnapshotHeader}>
                      <Text style={styles.economicsSnapshotLabel}>{item.label}</Text>
                      <Text style={styles.economicsSnapshotValue}>{item.value}</Text>
                    </View>
                    <Text style={styles.economicsSnapshotShip}>{item.row ? `${item.row.ship} • ${item.row.sailDate}` : 'No cruise matched yet'}</Text>
                    <Text style={styles.economicsSnapshotDetail}>{item.detail}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.cleanCard}>
          <View style={styles.cleanCardHeader}>
            <PieChart size={16} color={COLORS.goldDark} />
            <Text style={styles.cleanCardTitle}>Historical Annual Casino Summary</Text>
          </View>
          <View style={styles.annualSummaryHero}>
            <Text style={styles.annualSummaryHeroLabel}>Cash Result</Text>
            <Text
              style={[
                styles.annualSummaryHeroValue,
                { color: cruiseEconomicsSummary.totals.totalCashResult >= 0 ? COLORS.success : COLORS.error },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult)}
            </Text>
            <Text style={styles.annualSummaryHeroSubtext}>
              {formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome)} winnings home minus {formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid)} paid
            </Text>
          </View>

          <View style={styles.annualSummaryGrid}>
            <View style={styles.annualSummaryMetric}>
              <Text style={styles.annualSummaryMetricLabel}>Retail Value</Text>
              <Text style={styles.annualSummaryMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalRetailValue)}
              </Text>
            </View>
            <View style={styles.annualSummaryMetric}>
              <Text style={styles.annualSummaryMetricLabel}>Value Captured</Text>
              <Text style={styles.annualSummaryMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)}
              </Text>
            </View>
            <View style={styles.annualSummaryMetric}>
              <Text style={styles.annualSummaryMetricLabel}>Economic Value</Text>
              <Text style={[styles.annualSummaryMetricValue, { color: COLORS.success }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue)}
              </Text>
            </View>
            <View style={styles.annualSummaryMetric}>
              <Text style={styles.annualSummaryMetricLabel}>Total Points</Text>
              <Text style={styles.annualSummaryMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(cruiseEconomicsSummary.totals.totalPoints)}
              </Text>
            </View>
          </View>
          {cruiseEconomicsSummary.totals.cruises > 0 && (
            <View style={styles.annualSummaryDetails}>
              <View style={styles.annualSummaryDetailRow}>
                <Text style={styles.annualSummaryDetailLabel}>Per cruise average</Text>
                <Text style={styles.annualSummaryDetailValue}>
                  {formatCurrencyDetailed(cruiseEconomicsSummary.averages.paidPerCruise)} paid • {formatCurrencyDetailed(cruiseEconomicsSummary.averages.winningsPerCruise)} won • {formatSignedCurrencyDetailed(cruiseEconomicsSummary.averages.netCashPerCruise)} cash
                </Text>
              </View>
              <Text style={styles.annualSummaryFootnote}>
                Historical totals stay fixed after the April 1 reset. Only the current-season point balance resets.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <CasinoMetricsCard
          summary={cruiseEconomicsSummary}
          alwaysExpanded={true}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.portfolioTitle}>Cruise Portfolio</Text>
        <Text style={styles.portfolioHintText}>Tap any cruise row to add/edit win-loss, points earned, and instant certificate results.</Text>
        {renderROIFilterTabs()}
        
        {filteredCruises.length > 0 ? (
          <View style={styles.portfolioList}>
            {(showAllCruises ? filteredCruises.slice(0, 25) : filteredCruises.slice(0, 5)).map(renderPortfolioCard)}
            {showAllCruises && filteredCruises.length > 25 && (
              <View style={styles.portfolioLimitNotice}>
                <Text style={styles.portfolioLimitText}>
                  Showing top 25 of {filteredCruises.length} cruises (sorted by value)
                </Text>
              </View>
            )}
            {filteredCruises.length > 5 && (
              <TouchableOpacity 
                style={styles.viewMoreButton} 
                activeOpacity={0.7}
                onPress={() => setShowAllCruises(!showAllCruises)}
              >
                <Text style={styles.viewMoreText}>
                  {showAllCruises ? 'Show fewer cruises' : `View ${Math.min(filteredCruises.length - 5, 20)} more cruises`}
                </Text>
                <ChevronDown 
                  size={16} 
                  color={COLORS.navyDeep} 
                  style={{ transform: [{ rotate: showAllCruises ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyPortfolio}>
            <Ship size={40} color={CLEAN_THEME.text.secondary} />
            <Text style={styles.emptyPortfolioText}>No cruises match this filter</Text>
          </View>
        )}
      </View>

      {realAnalytics.destinationDistribution.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={16} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Top Destinations</Text>
          </View>
          
          <View style={styles.destinationsCard}>
            {realAnalytics.destinationDistribution.slice(0, 5).map((item, index) => (
              <View key={index} style={[styles.destinationRow, index === realAnalytics.destinationDistribution.slice(0, 5).length - 1 && { marginBottom: 0 }]}>
                <View style={[styles.destinationRank, index === 0 && styles.destinationRankTop]}>
                  <Text style={[styles.rankNumber, index === 0 && styles.rankNumberTop]}>{index + 1}</Text>
                </View>
                <View style={styles.destinationContent}>
                  <View style={styles.destinationHeader}>
                    <Text style={styles.destinationLabel}>{item.destination}</Text>
                    <View style={styles.destinationBadge}>
                      <Text style={styles.destinationValue}>
                        {item.count} {item.count === 1 ? 'cruise' : 'cruises'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {perCruisePointsBreakdown.length > 0 && (
        <View style={styles.section}>
          <View style={styles.cleanCard}>
            <View style={styles.cleanCardHeader}>
              <Award size={16} color={COLORS.navyDeep} />
              <Text style={styles.cleanCardTitle}>Historical Points Breakdown by Cruise</Text>
            </View>
            <View style={styles.pointsBreakdownLegend}>
              <View style={styles.pointsBreakdownLegendItem}>
                <View style={[styles.pointsBreakdownLegendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.pointsBreakdownLegendText}>Casino Points (Club Royale / Blue Chip)</Text>
              </View>
              <View style={styles.pointsBreakdownLegendItem}>
                <View style={[styles.pointsBreakdownLegendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.pointsBreakdownLegendText}>{"Cruise Loyalty (Crown & Anchor / Captain's Club)"}</Text>
              </View>
            </View>
            {perCruisePointsBreakdown.slice(0, showAllCruises ? 50 : 10).map((entry) => {
              const sailDate = createDateFromString(entry.sailDate);
              const dateStr = sailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
              const _sourceColor = entry.cruiseSource === 'royal' ? COLORS.navyDeep : entry.cruiseSource === 'celebrity' ? '#1E3A5F' : '#0D47A1';
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.pointsBreakdownRow}
                  activeOpacity={0.75}
                  onPress={() => openCruisePerformanceEditorById(entry.id)}
                  testID={`points-breakdown-row-${entry.id}`}
                >
                  <View style={styles.pointsBreakdownShipCol}>
                    <Text style={styles.pointsBreakdownShipName} numberOfLines={1}>{entry.shipName}</Text>
                    <Text style={styles.pointsBreakdownDate}>{dateStr} · {entry.nights}N · Tap to edit casino results</Text>
                  </View>
                  <View style={styles.pointsBreakdownValuesCol}>
                    <View style={styles.pointsBreakdownValueRow}>
                      <View style={[styles.pointsBreakdownValueDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.pointsBreakdownValueLabel}>{entry.casinoLabel}</Text>
                      <Text style={[styles.pointsBreakdownValue, { color: '#92400E' }]}>{formatNumber(entry.casinoPoints)}</Text>
                    </View>
                    <View style={styles.pointsBreakdownValueRow}>
                      <View style={[styles.pointsBreakdownValueDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={styles.pointsBreakdownValueLabel}>{entry.loyaltyLabel}</Text>
                      <Text style={[styles.pointsBreakdownValue, { color: '#1D4ED8' }]}>{formatNumber(entry.loyaltyPoints)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {perCruisePointsBreakdown.length > 10 && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                activeOpacity={0.7}
                onPress={() => setShowAllCruises(!showAllCruises)}
              >
                <Text style={styles.viewMoreText}>
                  {showAllCruises ? 'Show fewer' : `View all ${perCruisePointsBreakdown.length} cruises`}
                </Text>
                <ChevronDown
                  size={16}
                  color={COLORS.navyDeep}
                  style={{ transform: [{ rotate: showAllCruises ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <AlertsCard
          alerts={activeAlerts}
          insights={insights}
          onDismiss={dismissAlert}
          onSnooze={snoozeAlert}
          onClearAll={clearAllAlerts}
          maxAlerts={5}
          showInsights={true}
          title="Pattern Recognition & Alerts"
        />
      </View>

      <View style={styles.section}>
        <W2GTracker
          records={w2gRecords}
          onAddRecord={addW2GRecord}
          onRemoveRecord={removeW2GRecord}
        />
      </View>

      <View style={styles.section}>
        <CompValueCalculator
          initialItems={compItems}
          onCompValueChange={(totalValue) => {
            console.log('[Analytics] Comp value changed:', totalValue);
          }}
        />
      </View>
    </View>
  );

  const handleLiveSessionComplete = useCallback((data: {
    durationMinutes: number;
    pointsEarned: number;
    pph: number;
  }) => {
    void handleAddSession({
      startTime: new Date(Date.now() - data.durationMinutes * 60 * 1000).toTimeString().slice(0, 5),
      endTime: new Date().toTimeString().slice(0, 5),
      durationMinutes: data.durationMinutes,
      pointsEarned: data.pointsEarned,
      notes: `Live tracked session - ${data.pph.toFixed(0)} pts/hr`,
    });
  }, [handleAddSession]);

  const handleGenerateHistoricalSessions = useCallback(async (forceRegenerate: boolean = false) => {
    setIsGeneratingSessions(true);
    try {
      const today = new Date();
      const annualEconomicsRows = cruiseEconomicsSummary.rows;
      const annualEconomicsIds = new Set(annualEconomicsRows.map((row) => row.cruiseId));
      const completedCruises = bookedCruises.filter(cruise => {
        const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
        const cruisePoints = getBookedCruiseCasinoPoints(cruise);
        const hasPointsData = cruisePoints > 0 || annualEconomicsIds.has(cruise.id);
        
        if (isCompleted && hasPointsData) {
          console.log('[Analytics] Found completed cruise with points:', {
            id: cruise.id,
            shipName: cruise.shipName,
            sailDate: cruise.sailDate,
            earnedPoints: cruisePoints,
            winningsBroughtHome: cruise.winningsBroughtHome ?? cruise.winnings,
            cashResult: cruise.cashResult,
          });
        }
        
        return isCompleted && hasPointsData;
      });

      console.log('[Analytics] ========== SESSION GENERATION REPORT ==========');
      console.log('[Analytics] Total booked cruises:', bookedCruises.length);
      console.log('[Analytics] Completed cruises with points:', completedCruises.length);
      console.log('[Analytics] Current total sessions:', sessions.length);
      console.log('[Analytics] Cruises list:', completedCruises.map(c => `${c.shipName} (${c.sailDate}) - ${getBookedCruiseCasinoPoints(c)} pts`));
      
      const sessionsPerCruise = completedCruises.map(cruise => {
        const existingSessions = sessions.filter(s => s.cruiseId === cruise.id);
        return {
          cruise: `${cruise.shipName} (${cruise.sailDate})`,
          existingSessions: existingSessions.length,
          willGenerate: existingSessions.length === 0,
        };
      });
      
      console.log('[Analytics] Sessions breakdown:', sessionsPerCruise);
      console.log('[Analytics] ===============================================');
      
      const count = await generateHistoricalSessions(completedCruises, 400, forceRegenerate);
      
      console.log('[Analytics] Generated', count, 'new sessions');
      console.log('[Analytics] Total sessions after generation:', sessions.length + count);
      
      if (count > 0) {
        void haptics.success();
        setCelebrationData({
          title: forceRegenerate ? 'Sessions Regenerated!' : 'Historical Sessions Generated!',
          subtitle: `Created ${count} session records from ${completedCruises.length} cruises`,
          type: 'milestone',
        });
        setShowCelebration(true);
      } else {
        console.log('[Analytics] No new sessions generated. All', completedCruises.length, 'cruises already have sessions.');
      }
    } catch (error) {
      console.error('[Analytics] Failed to generate historical sessions:', error);
    } finally {
      setIsGeneratingSessions(false);
    }
  }, [bookedCruises, cruiseEconomicsSummary.rows, generateHistoricalSessions, haptics, sessions]);

  const renderSessionTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <SessionsSummaryCard
          analytics={sessionAnalytics}
          sessions={sessions}
          targetPPH={targetPPH}
        />
      </View>

      <View style={styles.section}>
        <View style={[styles.alertsBanner, { backgroundColor: 'rgba(0, 31, 63, 0.05)' }]}>
          <View style={styles.alertsIconContainer}>
            <Calendar size={20} color={COLORS.navyDeep} />
          </View>
          <View style={styles.alertsContent}>
            <Text style={[styles.alertsTitle, { color: COLORS.navyDeep }]}>Calculate Past Sessions</Text>
            <Text style={[styles.alertsDescription, { color: COLORS.navyDeep, opacity: 0.7 }]}>
              Generate session history from completed cruises with points earned
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleGenerateHistoricalSessions(true)}
              style={[styles.regenerateButton, isGeneratingSessions && { opacity: 0.6 }]}
              disabled={isGeneratingSessions}
            >
              <Text style={styles.regenerateButtonText}>
                {isGeneratingSessions ? '...' : 'Regenerate'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleGenerateHistoricalSessions(false)}
              style={[styles.calculateButton, isGeneratingSessions && { opacity: 0.6 }]}
              disabled={isGeneratingSessions}
            >
              <Text style={styles.calculateButtonText}>
                {isGeneratingSessions ? 'Calculating...' : 'Calculate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <LivePPHTracker
          targetPPH={targetPPH}
          onSessionComplete={handleLiveSessionComplete}
          historicalAvgPPH={sessionAnalytics.pointsPerHour}
        />
      </View>

      <View style={styles.section}>
        <PPHGoalsCard
          analytics={sessionAnalytics}
          sessions={sessions}
          targetPPH={targetPPH}
          onTargetChange={setTargetPPH}
        />
      </View>

      <View style={styles.section}>
        <PointsPerHourCard 
          analytics={sessionAnalytics} 
          sessions={sessions}
        />
      </View>

      <View style={styles.section}>
        <PPHHistoryChart sessions={sessions} maxDataPoints={10} />
      </View>

      <View style={styles.section}>
        <PPHSessionComparison sessions={sessions} />
      </View>

      <View style={styles.section}>
        <PPHLeaderboard sessions={sessions} maxEntries={5} />
      </View>

      <View style={styles.section}>
        <WeeklyGoalsCard
          compact={true}
          onGoalComplete={(goal) => {
            void haptics.success();
            setCelebrationData({
              title: 'Goal Completed!',
              subtitle: `You completed: ${goal.type} goal`,
              type: 'milestone',
            });
            setShowCelebration(true);
          }}
        />
      </View>

      <View style={styles.section}>
        <GamificationCard compact={false} showAchievements={false} />
      </View>

      <View style={styles.section}>
        <CasinoIntelligenceCard 
          analytics={sessionAnalytics} 
          completedCruises={bookedCruises.filter(c => {
            if (c.completionState === 'completed' || c.status === 'completed') return true;
            if (c.returnDate) {
              const returnDate = new Date(c.returnDate);
              return returnDate < new Date();
            }
            return false;
          })}
          cruiseEconomicsSummary={cruiseEconomicsSummary}
        />
      </View>

      <View style={styles.sessionStatsSection}>
        <View style={styles.sectionHeader}>
          <Dices size={16} color={COLORS.navyDeep} />
          <Text style={styles.sectionTitle}>Session Summary</Text>
        </View>
        
        <View style={styles.sessionHistoryCard}>
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Total Sessions</Text>
            <Text style={styles.sessionHistoryValue}>{sessions.length}</Text>
          </View>
          <View style={styles.sessionHistoryDivider} />
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Total Time Played</Text>
            <Text style={styles.sessionHistoryValue}>
              {formatTotalMinutes(sessionAnalytics.totalPlayTimeMinutes)}
            </Text>
          </View>
          <View style={styles.sessionHistoryDivider} />
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Total Buy-In</Text>
            <Text style={styles.sessionHistoryValue}>
              {formatCurrency(sessionAnalytics.totalBuyIn)}
            </Text>
          </View>
          <View style={styles.sessionHistoryDivider} />
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Net Win/Loss</Text>
            <Text style={[
              styles.sessionHistoryValue,
              { color: sessionAnalytics.netWinLoss >= 0 ? COLORS.success : COLORS.error }
            ]}>
              {sessionAnalytics.netWinLoss >= 0 ? '+' : ''}{formatCurrency(sessionAnalytics.netWinLoss)}
            </Text>
          </View>
          <View style={styles.sessionHistoryDivider} />
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Win Rate</Text>
            <Text style={[
              styles.sessionHistoryValue,
              { color: sessionAnalytics.winRate >= 50 ? COLORS.success : COLORS.error }
            ]}>
              {sessionAnalytics.winRate.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {sessions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Recent Sessions ({sessions.length} total)</Text>
            <Text style={styles.sortLabelText}>Sorted by Points (High to Low)</Text>
          </View>
          
          <View style={styles.recentSessionsScrollContainer}>
            {sessions
              .sort((a, b) => (b.pointsEarned || 0) - (a.pointsEarned || 0))
              .map((session) => {
                const sessionPPH = session.pointsEarned && session.durationMinutes > 0 
                  ? ((session.pointsEarned || 0) / session.durationMinutes) * 60 
                  : 0;
                
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.recentSessionCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('[Analytics] Session pressed:', session.id);
                    }}
                  >
                    <View style={[
                      styles.recentSessionIndicator,
                      { backgroundColor: (session.winLoss || 0) >= 0 ? '#10B981' : '#EF4444' }
                    ]} />
                    <View style={styles.recentSessionContent}>
                      <Text style={styles.recentSessionDate}>
                        {new Date(session.date).toLocaleDateString('en-US', {
                          timeZone: 'UTC', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                      <Text style={styles.recentSessionTime}>
                        {session.startTime} - {session.endTime}
                      </Text>
                      {session.winLoss !== undefined && (
                        <Text style={[
                          styles.recentSessionWinLoss,
                          { color: session.winLoss >= 0 ? COLORS.success : COLORS.error }
                        ]}>
                          {session.winLoss >= 0 ? '+' : ''}{formatCurrency(session.winLoss)}
                        </Text>
                      )}
                      {session.notes ? (
                        <Text style={styles.recentSessionNotes} numberOfLines={2}>{session.notes}</Text>
                      ) : null}
                    </View>
                    <View style={styles.recentSessionStats}>
                      <View style={styles.recentSessionDuration}>
                        <Text style={styles.recentSessionDurationText}>
                          {formatTotalMinutes(session.durationMinutes)}
                        </Text>
                      </View>
                      {session.pointsEarned !== undefined && session.pointsEarned > 0 && (
                        <View style={styles.recentSessionPointsContainer}>
                          <Text style={styles.recentSessionPoints}>
                            {formatNumber(session.pointsEarned)} pts
                          </Text>
                          {sessionPPH > 0 && (
                            <Text style={styles.recentSessionPPH}>
                              {sessionPPH.toFixed(0)} pts/hr
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      )}
    </View>
  );

  const formatTotalMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const historicalCruiseData = useMemo(() => {
    if (activeTab !== 'calcs') return { totalCruises: 0, totalPoints: 0, totalSessions: 0, totalNights: 0, totalCoinIn: 0, totalWinLoss: 0, totalRetailValue: 0, totalTaxesFees: 0, totalProfit: 0, cruises: [] as { id: string; shipName: string; sailDate: string; points: number; sessionCount: number; nights: number }[] };
    const cruiseData = cruiseEconomicsSummary.rows.map((row) => {
      const cruiseSessions = sessions.filter(s => s.cruiseId === row.cruiseId);
      return {
        id: row.cruiseId,
        shipName: row.ship,
        sailDate: row.sailDate,
        points: row.points,
        sessionCount: cruiseSessions.length > 0 ? cruiseSessions.length : Math.max(1, row.nights * 2),
        nights: row.nights || 1,
      };
    });

    const totalSessions = cruiseData.reduce((sum, c) => sum + c.sessionCount, 0);

    return {
      totalCruises: cruiseEconomicsSummary.totals.cruises,
      totalPoints: cruiseEconomicsSummary.totals.totalPoints,
      totalSessions,
      totalNights: cruiseEconomicsSummary.totals.totalNights,
      totalCoinIn: cruiseEconomicsSummary.totals.totalCoinIn,
      totalWinLoss: cruiseEconomicsSummary.totals.totalCashResult,
      totalRetailValue: cruiseEconomicsSummary.totals.totalRetailValue,
      totalTaxesFees: cruiseEconomicsSummary.totals.totalPaid,
      totalProfit: cruiseEconomicsSummary.totals.totalEconomicValue,
      cruises: cruiseData,
    };
  }, [activeTab, cruiseEconomicsSummary, sessions]);

  const highValueCalculations = useMemo(() => {
    if (activeTab !== 'calcs') return [] as { id: number; label: string; value: string; description: string; color: string; icon: any }[];

    const isHistorical = calcsMode === 'historical';
    const assumedHold = 0.08;
    const pointDollarValue = 0.01;
    const roundMetric = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

    const defaultAvgSessionMinutes = 90;
    const avgSessionLength = sessionAnalytics.avgSessionLength > 0 ? sessionAnalytics.avgSessionLength : defaultAvgSessionMinutes;
    const avgSessionHours = avgSessionLength > 0 ? avgSessionLength / 60 : 1.5;

    const actualSessionMinutes = sessions.reduce((sum, s) => sum + Math.max(0, s.durationMinutes || 0), 0);
    const actualSessionHours = roundMetric(actualSessionMinutes / 60);
    const actualSessionPoints = sessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
    const actualSessionCoinIn = roundMetric(actualSessionPoints * DOLLARS_PER_POINT);
    const actualSessionPointValue = roundMetric(actualSessionPoints * pointDollarValue);
    const actualSessionValue = roundMetric(sessionAnalytics.netWinLoss + actualSessionPointValue);
    const hasSessionData = sessions.length > 0 && (actualSessionMinutes > 0 || actualSessionPoints > 0 || sessionAnalytics.netWinLoss !== 0);
    const useCurrentSeasonFallback = !isHistorical && !hasSessionData && currentSeasonMetrics.points > 0;

    const historicalHours = cruiseEconomicsSummary.totals.totalHours;
    const totalCoinIn = isHistorical
      ? cruiseEconomicsSummary.totals.totalCoinIn
      : (hasSessionData ? actualSessionCoinIn : currentSeasonMetrics.coinIn);
    const totalPointsForMode = isHistorical
      ? cruiseEconomicsSummary.totals.totalPoints
      : (hasSessionData ? actualSessionPoints : currentSeasonMetrics.points);
    const totalHoursForMode = isHistorical
      ? historicalHours
      : (hasSessionData ? actualSessionHours : currentSeasonMetrics.estimatedPlayHours);
    const totalProfit = isHistorical
      ? cruiseEconomicsSummary.totals.totalEconomicValue
      : (hasSessionData ? actualSessionValue : currentSeasonMetrics.winningsBroughtHome);
    const totalWinLoss = isHistorical
      ? cruiseEconomicsSummary.totals.totalCashResult
      : (hasSessionData ? sessionAnalytics.netWinLoss : currentSeasonMetrics.winningsBroughtHome);
    const totalTaxesFees = isHistorical ? cruiseEconomicsSummary.totals.totalPaid : sessionAnalytics.totalBuyIn;

    const completedCruiseCount = cruiseEconomicsSummary.totals.cruises;
    const estimatedHistoricalSessions = historicalHours > 0 ? Math.max(1, Math.round(historicalHours / avgSessionHours)) : historicalCruiseData.totalSessions;
    const totalSessions = isHistorical
      ? (historicalCruiseData.totalSessions > 0 ? historicalCruiseData.totalSessions : estimatedHistoricalSessions)
      : (hasSessionData ? sessions.length : Math.max(1, currentSeasonMetrics.cruises));
    const coinInIsEstimated = isHistorical ? cruiseEconomicsSummary.totals.hasEstimates : useCurrentSeasonFallback;
    const modeLabel = isHistorical ? 'historical annual' : (hasSessionData ? 'tracked session' : 'current season known-cruise');
    const historicalTotalPoints = totalPointsForMode;
    const avgCashResultPerCruise = completedCruiseCount > 0 ? cruiseEconomicsSummary.totals.totalCashResult / completedCruiseCount : 0;
    const divisorLabel = isHistorical
      ? `${totalSessions} ${historicalCruiseData.totalSessions > 0 ? 'tracked/derived' : 'estimated'} sessions across ${completedCruiseCount} cruises`
      : (hasSessionData ? `${sessions.length} tracked sessions` : `${currentSeasonMetrics.cruises} current-season cruises`);

    console.log('[Calcs] Mode:', calcsMode, 'hasSessionData:', hasSessionData, 'totalCoinIn:', totalCoinIn, 'coinInIsEstimated:', coinInIsEstimated, 'totalHoursForMode:', totalHoursForMode, 'totalSessions:', totalSessions, 'economics.totalCoinIn:', cruiseEconomicsSummary.totals.totalCoinIn);

    const coinInPerUnit = totalSessions > 0 ? totalCoinIn / totalSessions : 0;
    const theoPerUnit = coinInPerUnit * assumedHold;

    const parseSessionStartMinutes = (value: string): number | null => {
      const timeMatch = value.match(/^(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);
        return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : null;
      }

      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return (parsedDate.getHours() * 60) + parsedDate.getMinutes();
      }

      return null;
    };

    const blockDefinitions = [
      { label: 'Late Night', start: 0, end: 300 },
      { label: 'Morning', start: 300, end: 720 },
      { label: 'Afternoon', start: 720, end: 1020 },
      { label: 'Evening', start: 1020, end: 1380 },
      { label: 'Late Night', start: 1380, end: 1440 },
      { label: 'Late Night', start: 1440, end: 1740 },
      { label: 'Morning', start: 1740, end: 2160 },
      { label: 'Afternoon', start: 2160, end: 2460 },
      { label: 'Evening', start: 2460, end: 2820 },
      { label: 'Late Night', start: 2820, end: 2880 },
    ];

    const timeBlockMetrics = new Map<string, { label: string; minutes: number; points: number; coinIn: number; theoretical: number; theoreticalPerHour: number }>([
      ['Late Night', { label: 'Late Night', minutes: 0, points: 0, coinIn: 0, theoretical: 0, theoreticalPerHour: 0 }],
      ['Morning', { label: 'Morning', minutes: 0, points: 0, coinIn: 0, theoretical: 0, theoreticalPerHour: 0 }],
      ['Afternoon', { label: 'Afternoon', minutes: 0, points: 0, coinIn: 0, theoretical: 0, theoreticalPerHour: 0 }],
      ['Evening', { label: 'Evening', minutes: 0, points: 0, coinIn: 0, theoretical: 0, theoreticalPerHour: 0 }],
    ]);

    const historicalCruiseIds = new Set(cruiseEconomicsSummary.rows.map((row) => row.cruiseId));
    const sessionsForBlocks = isHistorical ? sessions.filter((session) => session.cruiseId && historicalCruiseIds.has(session.cruiseId)) : sessions;
    sessionsForBlocks.forEach((session) => {
      const startMinutes = parseSessionStartMinutes(session.startTime);
      const durationMinutes = Math.max(0, session.durationMinutes || 0);
      if (startMinutes === null || durationMinutes <= 0) {
        return;
      }

      const sessionEndMinutes = startMinutes + durationMinutes;
      const sessionPoints = session.pointsEarned || 0;
      blockDefinitions.forEach((block) => {
        const overlapMinutes = Math.max(0, Math.min(sessionEndMinutes, block.end) - Math.max(startMinutes, block.start));
        if (overlapMinutes <= 0) {
          return;
        }

        const metric = timeBlockMetrics.get(block.label);
        if (!metric) {
          return;
        }

        const allocatedPoints = sessionPoints * (overlapMinutes / durationMinutes);
        metric.minutes += overlapMinutes;
        metric.points += allocatedPoints;
        metric.coinIn += allocatedPoints * DOLLARS_PER_POINT;
      });
    });

    const blockMetrics = Array.from(timeBlockMetrics.values()).map((metric) => {
      const theoretical = roundMetric(metric.coinIn * assumedHold);
      const hours = metric.minutes / 60;
      return {
        ...metric,
        points: roundMetric(metric.points),
        coinIn: roundMetric(metric.coinIn),
        theoretical,
        theoreticalPerHour: hours > 0 ? roundMetric(theoretical / hours) : 0,
      };
    });
    const bestTheoBlock = blockMetrics
      .filter((metric) => metric.minutes > 0 && metric.theoretical > 0)
      .sort((a, b) => b.theoreticalPerHour - a.theoreticalPerHour)[0];
    const theoPerTimeBlock = bestTheoBlock?.label ?? 'No block data';
    const theoTimeBlockValue = bestTheoBlock?.theoreticalPerHour ?? 0;
    const theoTimeBlockDescription = bestTheoBlock
      ? `${formatCurrency(bestTheoBlock.theoretical)} theo over ${(bestTheoBlock.minutes / 60).toFixed(1)} hrs; based only on sessions with points + duration`
      : 'Add session start time, duration, and points to calculate exact block-level theo.';

    const theoValues = isHistorical && sessionsForBlocks.length === 0
      ? cruiseEconomicsSummary.rows.map((row) => row.theoreticalLoss ?? 0).filter((value) => value > 0)
      : Array.from(new Set(sessionsForBlocks.map((session) => session.date))).map((date) => {
          const daySessions = sessionsForBlocks.filter((session) => session.date === date);
          const dayCoinIn = daySessions.reduce((sum, session) => sum + ((session.pointsEarned || 0) * DOLLARS_PER_POINT), 0);
          return dayCoinIn * assumedHold;
        }).filter((value) => value > 0);
    const avgTheo = theoValues.length > 0 ? theoValues.reduce((a, b) => a + b, 0) / theoValues.length : 0;
    const theoVariance = theoValues.length > 0
      ? theoValues.reduce((sum, v) => sum + Math.pow(v - avgTheo, 2), 0) / theoValues.length
      : 0;
    const theoStdDev = Math.sqrt(theoVariance);
    const adtSmoothingFactor = avgTheo > 0 ? (theoStdDev / avgTheo) : 0;

    const totalEconomicRoiPercentage = totalTaxesFees > 0 ? (totalProfit / totalTaxesFees) * 100 : 0;
    void totalEconomicRoiPercentage;
    const profitPerUnit = totalSessions > 0 ? totalProfit / totalSessions : (totalProfit !== 0 ? totalProfit : 0);

    const stopGap = 200;
    const riskPerHour = avgSessionLength > 0 ? (stopGap / (avgSessionLength / 60)) : 0;

    const winSessions = sessions.filter(s => (s.winLoss || 0) > 0);
    const totalWinnings = winSessions.reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const pressExposure = winSessions.reduce((sum, s) => sum + ((s.buyIn || 0) * 0.3), 0);
    const pressEfficiencyRatio = pressExposure > 0 ? totalWinnings / pressExposure : 0;

    const sessionWinLoss = sessions.map(s => s.winLoss || 0);
    const avgWinLoss = sessionWinLoss.length > 0 ? sessionWinLoss.reduce((a, b) => a + b, 0) / sessionWinLoss.length : 0;
    const winLossVariance = sessionWinLoss.length > 0
      ? sessionWinLoss.reduce((sum, v) => sum + Math.pow(v - avgWinLoss, 2), 0) / sessionWinLoss.length
      : 0;
    const winLossStdDev = Math.sqrt(winLossVariance);
    const consistencyScore = avgWinLoss !== 0 ? (avgWinLoss / Math.max(winLossStdDev, 1)) : 0;
    const spikeRisk = sessionWinLoss.length > 0 ? (Math.max(...sessionWinLoss.map(Math.abs)) / Math.max(Math.abs(avgWinLoss), 1)) : 0;
    const offerSafetyIndex = consistencyScore > 0 && spikeRisk > 0 ? consistencyScore / spikeRisk : 0;

    const totalHistoricalHours = totalHoursForMode;
    const valuePerHourPlayed = totalHistoricalHours > 0 ? totalProfit / totalHistoricalHours : 0;

    const recentProfit = sessions.slice(-10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const earlyProfit = sessions.slice(0, 10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const trendScore = earlyProfit !== 0 ? (recentProfit / Math.max(Math.abs(earlyProfit), 1)) : 1;
    const variabilityScore = 1 - Math.min(adtSmoothingFactor, 1);
    const sustainabilityScore = (trendScore * 0.6 + variabilityScore * 0.4) * 100;

    const pointsPerSession = totalSessions > 0 ? totalPointsForMode / totalSessions : 0;

    return [
      {
        id: 1,
        label: isHistorical ? 'Coin-in (historical avg)' : 'Coin-in per session',
        value: formatCurrency(coinInPerUnit) + (coinInIsEstimated ? ' (est.)' : ''),
        description: coinInIsEstimated
          ? `Coin-in derived from points at ${formatCurrency(DOLLARS_PER_POINT)}/point; missing hours use ${DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR} PPH`
          : (isHistorical ? `Total coin-in ÷ ${divisorLabel}` : 'Total coin-in ÷ total sessions'),
        color: COLORS.navyDeep,
        icon: Coins,
      },
      {
        id: 2,
        label: isHistorical ? 'Theo (historical avg)' : 'Theo per session',
        value: formatCurrency(theoPerUnit) + (coinInIsEstimated ? ' (est.)' : ''),
        description: `Coin-in ${modeLabel} × ${(assumedHold * 100).toFixed(0)}% hold` + (coinInIsEstimated ? ' (estimated)' : ''),
        color: COLORS.royalPurple,
        icon: Target,
      },
      {
        id: 3,
        label: isHistorical ? 'Best theo/hour block (hist.)' : 'Best theo/hour block',
        value: theoTimeBlockValue > 0 ? `${formatCurrency(theoTimeBlockValue)}/hr • ${theoPerTimeBlock}` : '—',
        description: theoTimeBlockDescription,
        color: '#F59E0B',
        icon: Dices,
      },
      {
        id: 4,
        label: 'ADT smoothing factor',
        value: adtSmoothingFactor.toFixed(3),
        description: 'How evenly theo is spread across days',
        color: '#8B5CF6',
        icon: LineChart,
      },
      {
        id: 5,
        label: isHistorical ? 'Total Econ (historical avg)' : 'Total Econ per session',
        value: formatCurrency(profitPerUnit),
        description: `${formatCurrency(totalProfit)} ÷ ${totalSessions} ${isHistorical ? 'historical' : ''} sessions`,
        color: profitPerUnit >= 0 ? COLORS.success : COLORS.error,
        icon: TrendingUp,
      },
      {
        id: 6,
        label: 'Risk per hour',
        value: formatCurrency(riskPerHour),
        description: `${stopGap} stop-gap ÷ avg session length`,
        color: '#EF4444',
        icon: Zap,
      },
      {
        id: 7,
        label: 'Press efficiency ratio',
        value: pressEfficiencyRatio.toFixed(2) + 'x',
        description: 'Cash result during press spins ÷ press exposure',
        color: COLORS.success,
        icon: PieChart,
      },
      {
        id: 8,
        label: 'Offer safety index',
        value: offerSafetyIndex.toFixed(2),
        description: 'Consistency score vs spike risk',
        color: '#10B981',
        icon: Award,
      },
      {
        id: 9,
        label: isHistorical ? 'Total economic value/hr' : 'Casino value/hr',
        value: totalHistoricalHours > 0 ? formatCurrency(valuePerHourPlayed) : '—',
        description: isHistorical
          ? `Total economic value ÷ ${totalHistoricalHours.toFixed(2)} play hours from points/session data`
          : (hasSessionData ? 'Session cash result + point value ÷ tracked play hours' : `Known current-season winnings ÷ ${totalHistoricalHours.toFixed(2)} estimated play hours`),
        color: COLORS.goldDark,
        icon: DollarSign,
      },
      {
        id: 10,
        label: isHistorical ? 'Points per session (hist.)' : 'Sustainability score',
        value: isHistorical ? formatNumber(Math.round(pointsPerSession)) + ' pts' : `${sustainabilityScore.toFixed(1)}%`,
        description: isHistorical
          ? `${formatNumber(historicalTotalPoints)} pts ÷ ${totalSessions} sessions`
          : 'Likelihood offers persist unchanged',
        color: isHistorical ? '#8B5CF6' : (sustainabilityScore >= 70 ? COLORS.success : sustainabilityScore >= 40 ? '#F59E0B' : COLORS.error),
        icon: isHistorical ? Award : BarChart3,
      },
      ...(isHistorical ? [
        {
          id: 11,
          label: 'Avg Coin-In / Cruise',
          value: formatCurrency(completedCruiseCount > 0 ? cruiseEconomicsSummary.totals.totalCoinIn / completedCruiseCount : 0),
          description: `${formatCurrency(totalCoinIn)} ÷ ${completedCruiseCount} completed cruises`,
          color: COLORS.navyDeep,
          icon: Ship,
        },
        {
          id: 12,
          label: 'Avg Cash Result / Cruise',
          value: `${avgCashResultPerCruise >= 0 ? '+' : ''}${formatCurrency(avgCashResultPerCruise)}`,
          description: `${formatCurrency(totalWinLoss)} ÷ ${completedCruiseCount} completed cruises`,
          color: avgCashResultPerCruise >= 0 ? COLORS.success : COLORS.error,
          icon: TrendingUp,
        },
      ] : []),
    ];
  }, [activeTab, calcsMode, cruiseEconomicsSummary, sessions, sessionAnalytics, historicalCruiseData, currentSeasonMetrics]);

  const renderCalcsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.calcsHeader}>
          <View style={styles.calcsHeaderContent}>
            <View style={[styles.calcsHeaderIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Calculator size={20} color={COLORS.royalPurple} />
            </View>
            <View style={styles.calcsHeaderText}>
              <Text style={styles.calcsHeaderTitle}>High-Value Calculations</Text>
              <Text style={styles.calcsHeaderSubtitle}>10 advanced metrics now unlocked</Text>
            </View>
          </View>

          <View style={styles.calcsModeToggleContainer}>
            <TouchableOpacity
              style={[
                styles.calcsModeToggleBtn,
                calcsMode === 'per-session' && styles.calcsModeToggleBtnActive,
              ]}
              onPress={() => setCalcsMode('per-session')}
              activeOpacity={0.7}
              testID="calcs-mode-per-session"
            >
              <Dices size={13} color={calcsMode === 'per-session' ? COLORS.white : COLORS.navyDeep} />
              <Text style={[
                styles.calcsModeToggleText,
                calcsMode === 'per-session' && styles.calcsModeToggleTextActive,
              ]}>Per Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.calcsModeToggleBtn,
                calcsMode === 'historical' && styles.calcsModeToggleBtnActive,
              ]}
              onPress={() => setCalcsMode('historical')}
              activeOpacity={0.7}
              testID="calcs-mode-historical"
            >
              <Ship size={13} color={calcsMode === 'historical' ? COLORS.white : COLORS.navyDeep} />
              <Text style={[
                styles.calcsModeToggleText,
                calcsMode === 'historical' && styles.calcsModeToggleTextActive,
              ]}>Historical</Text>
            </TouchableOpacity>
          </View>

          {calcsMode === 'historical' && cruiseEconomicsSummary.totals.cruises > 0 && (
            <View style={styles.calcsModeSummary}>
              <Text style={styles.calcsModeSummaryText}>
                Historical: {formatNumber(cruiseEconomicsSummary.totals.totalPoints)} pts ({formatCurrency(cruiseEconomicsSummary.totals.totalCoinIn)} coin-in) • Current season: {formatNumber(currentYearPoints)} pts ({formatNumber(currentSeasonMetrics.pointsNeededForSignature)} to retain Signature) • Status: {clubRoyaleTier} • {realAnalytics.completedCashResult >= 0 ? '+' : ''}{formatCurrency(realAnalytics.completedCashResult)} cash result • {cruiseEconomicsSummary.totals.cruises} cruises
              </Text>
            </View>
          )}
        </View>

        <View style={styles.calcsGrid}>
          {highValueCalculations.map((calc) => (
            <View key={calc.id} style={styles.calcCard}>
              <View style={[styles.calcIconContainer, { backgroundColor: `${calc.color}15` }]}>
                <calc.icon size={20} color={calc.color} />
              </View>
              <View style={styles.calcContent}>
                <Text style={styles.calcLabel}>{calc.label}</Text>
                <Text style={[styles.calcValue, { color: calc.color }]}>{calc.value}</Text>
                <Text style={styles.calcDescription}>{calc.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.calcsInsightCard}>
          <View style={styles.calcsInsightHeader}>
            <Brain size={18} color={COLORS.navyDeep} />
            <Text style={styles.calcsInsightTitle}>Calculation Insights</Text>
          </View>
          <Text style={styles.calcsInsightText}>
            These calculations provide deeper understanding of your casino play patterns and efficiency. 
            High sustainability scores (70+) indicate stable offer patterns, while ADT smoothing factors 
            below 0.3 suggest consistent play distribution.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderChartsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <TierProgressionChart
          playerContext={playerContext}
          bookedCruises={bookedCruises}
          monthsAhead={24}
        />
      </View>

      <View style={styles.section}>
        <ROIProjectionChart
          roiProjection={baselineSimulation.roiProjection}
          comparisonROI={baselineSimulation.roiProjection.projectedROI}
          totalSpent={realAnalytics.totalOutOfPocket}
          totalRetailValue={realAnalytics.totalRetailValue}
          totalCruiseValueCaptured={realAnalytics.totalCruiseValueCaptured}
          totalCashResult={realAnalytics.completedCashResult}
          totalEconomicValue={realAnalytics.completedEconomicValue}
        />
      </View>

      <View style={styles.section}>
        <RiskAnalysisChart
          riskAnalysis={baselineSimulation.riskAnalysis}
          totalSpent={realAnalytics.completedOutOfPocket}
          totalRetailValue={realAnalytics.completedRetailValue}
          cruiseValueCaptured={realAnalytics.completedCruiseValueCaptured}
          cashResult={realAnalytics.completedCashResult || 0}
          totalEconomicValue={realAnalytics.completedEconomicValue}
          totalCruises={realAnalytics.completedCruisesCount}
          pointsEarned={historicalPoints}
        />
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#E3F2FD', '#90CAF9']}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ResponsiveContainer>
          <View style={styles.header}>
            <View style={styles.brandingRow}>
              <View style={styles.titleContainer}>
                <BarChart3 size={22} color={COLORS.navyDeep} />
                <Text style={styles.appTitle}>Analytics</Text>
              </View>
            </View>
            
            <View style={styles.tierBadges}>
              <TierBadgeGroup 
                clubRoyaleTier={clubRoyaleTier}
                crownAnchorLevel={crownAnchorLevel}
                size="small"
              />
            </View>
          </View>

          <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'intelligence' && styles.tabButtonActive]}
            onPress={() => setActiveTab('intelligence')}
            activeOpacity={0.7}
          >
            <Brain size={14} color={activeTab === 'intelligence' ? COLORS.white : CLEAN_THEME.text.secondary} />
            <Text style={[styles.tabButtonText, activeTab === 'intelligence' && styles.tabButtonTextActive]}>
              Intelligence
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'charts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('charts')}
            activeOpacity={0.7}
          >
            <LineChart size={14} color={activeTab === 'charts' ? COLORS.white : CLEAN_THEME.text.secondary} />
            <Text style={[styles.tabButtonText, activeTab === 'charts' && styles.tabButtonTextActive]}>
              Charts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'session' && styles.tabButtonActive]}
            onPress={() => setActiveTab('session')}
            activeOpacity={0.7}
          >
            <Dices size={14} color={activeTab === 'session' ? COLORS.white : CLEAN_THEME.text.secondary} />
            <Text style={[styles.tabButtonText, activeTab === 'session' && styles.tabButtonTextActive]}>
              Session
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'calcs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('calcs')}
            activeOpacity={0.7}
          >
            <Calculator size={14} color={activeTab === 'calcs' ? COLORS.white : CLEAN_THEME.text.secondary} />
            <Text style={[styles.tabButtonText, activeTab === 'calcs' && styles.tabButtonTextActive]}>
              Calcs
            </Text>
          </TouchableOpacity>
          </View>
        </ResponsiveContainer>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.navyDeep}
              colors={[COLORS.navyDeep]}
            />
          }
        >
          <ResponsiveContainer>
            {!isScreenReady ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.navyDeep} />
              </View>
            ) : (
              <>
                {activeTab === 'intelligence' && renderIntelligenceTab()}
                {activeTab === 'charts' && renderChartsTab()}
                {activeTab === 'session' && renderSessionTab()}
                {activeTab === 'calcs' && renderCalcsTab()}
              </>
            )}

            {realAnalytics.totalCruises === 0 && !storeLoading && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <BarChart3 size={56} color={COLORS.navyDeep} />
                </View>
                <Text style={styles.emptyTitle}>No Analytics Data Yet</Text>
                <Text style={styles.emptyText}>
                  Book and complete cruises to see your{'\n'}personalized statistics here
                </Text>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={Boolean(selectedPerformanceCruise)}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCruisePerformanceEditor}
      >
        <KeyboardAvoidingView
          style={styles.performanceModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.performanceModalBackdrop}
            activeOpacity={1}
            onPress={closeCruisePerformanceEditor}
          />
          <View style={styles.performanceModalCard}>
            <View style={styles.performanceModalHandle} />
            <View style={styles.performanceModalHeader}>
              <View style={styles.performanceModalTitleBlock}>
                <Text style={styles.performanceModalEyebrow}>Cruise casino results</Text>
                <Text style={styles.performanceModalTitle} numberOfLines={1}>
                  {selectedPerformanceCruise?.shipName || 'Selected Cruise'}
                </Text>
                <Text style={styles.performanceModalSubtitle} numberOfLines={1}>
                  {selectedPerformanceCruise?.sailDate || 'No sail date'} · {selectedPerformanceCruise?.nights || 0} nights
                </Text>
              </View>
              <TouchableOpacity
                style={styles.performanceCloseButton}
                onPress={closeCruisePerformanceEditor}
                activeOpacity={0.7}
                testID="close-cruise-performance-editor"
              >
                <X size={18} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.performanceModalScroll}
              contentContainerStyle={styles.performanceModalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.performanceInputGrid}>
                <View style={styles.performanceInputGroup}>
                  <Text style={styles.performanceInputLabel}>Win / Loss total</Text>
                  <TextInput
                    style={styles.performanceTextInput}
                    value={performanceForm.winLoss}
                    onChangeText={(value) => setPerformanceForm((prev) => ({ ...prev, winLoss: value }))}
                    placeholder="-1200 or 4500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                    testID="cruise-performance-win-loss-input"
                  />
                  <Text style={styles.performanceInputHint}>Use a negative number for a loss.</Text>
                </View>

                <View style={styles.performanceInputGroup}>
                  <Text style={styles.performanceInputLabel}>Points earned</Text>
                  <TextInput
                    style={styles.performanceTextInput}
                    value={performanceForm.pointsEarned}
                    onChangeText={(value) => setPerformanceForm((prev) => ({ ...prev, pointsEarned: value }))}
                    placeholder="2500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    testID="cruise-performance-points-input"
                  />
                  <Text style={styles.performanceInputHint}>Feeds historical points, coin-in, and tier analytics.</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.certificateToggle, performanceForm.instantCertificateWon && styles.certificateToggleActive]}
                activeOpacity={0.8}
                onPress={() => setPerformanceForm((prev) => ({ ...prev, instantCertificateWon: !prev.instantCertificateWon }))}
                testID="cruise-performance-certificate-toggle"
              >
                <View style={[styles.certificateToggleIcon, performanceForm.instantCertificateWon && styles.certificateToggleIconActive]}>
                  <Ticket size={18} color={performanceForm.instantCertificateWon ? COLORS.white : '#047857'} />
                </View>
                <View style={styles.certificateToggleTextBlock}>
                  <Text style={styles.certificateToggleTitle}>Instant certificate / offer won</Text>
                  <Text style={styles.certificateToggleSubtitle}>Track whether this sailing generated a new casino offer.</Text>
                </View>
                <View style={[styles.certificateTogglePill, performanceForm.instantCertificateWon && styles.certificateTogglePillActive]}>
                  <Text style={[styles.certificateTogglePillText, performanceForm.instantCertificateWon && styles.certificateTogglePillTextActive]}>
                    {performanceForm.instantCertificateWon ? 'Yes' : 'No'}
                  </Text>
                </View>
              </TouchableOpacity>

              {performanceForm.instantCertificateWon && (
                <View style={styles.certificateDetailsCard}>
                  <View style={styles.performanceInputGroup}>
                    <Text style={styles.performanceInputLabel}>Certificate / offer code</Text>
                    <TextInput
                      style={styles.performanceTextInput}
                      value={performanceForm.instantCertificateOfferCode}
                      onChangeText={(value) => setPerformanceForm((prev) => ({ ...prev, instantCertificateOfferCode: value }))}
                      placeholder="Example: 25RCLV123"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                      testID="cruise-performance-certificate-code-input"
                    />
                  </View>
                  <View style={styles.performanceInputGroup}>
                    <Text style={styles.performanceInputLabel}>Estimated certificate value</Text>
                    <TextInput
                      style={styles.performanceTextInput}
                      value={performanceForm.instantCertificateValue}
                      onChangeText={(value) => setPerformanceForm((prev) => ({ ...prev, instantCertificateValue: value }))}
                      placeholder="750"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      testID="cruise-performance-certificate-value-input"
                    />
                  </View>
                  <View style={styles.performanceInputGroup}>
                    <Text style={styles.performanceInputLabel}>Certificate notes</Text>
                    <TextInput
                      style={[styles.performanceTextInput, styles.performanceNotesInput]}
                      value={performanceForm.instantCertificateNotes}
                      onChangeText={(value) => setPerformanceForm((prev) => ({ ...prev, instantCertificateNotes: value }))}
                      placeholder="Free balcony, freeplay, expiry, restrictions..."
                      placeholderTextColor="#94A3B8"
                      multiline={true}
                      textAlignVertical="top"
                      testID="cruise-performance-certificate-notes-input"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.performanceModalActions}>
              <TouchableOpacity
                style={styles.performanceCancelButton}
                activeOpacity={0.8}
                onPress={closeCruisePerformanceEditor}
              >
                <Text style={styles.performanceCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.performanceSaveButton}
                activeOpacity={0.85}
                onPress={handleSaveCruisePerformance}
                testID="save-cruise-performance"
              >
                <Save size={16} color={COLORS.white} />
                <Text style={styles.performanceSaveText}>Save results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AddSessionModal
        visible={showAddSessionModal}
        onClose={() => setShowAddSessionModal(false)}
        onSave={handleAddSession}
        date={todayDateString}
        goldenTimeSlots={goldenTimeSlots}
      />

      {showCelebration && celebrationData && (
        <CelebrationOverlay
          visible={showCelebration}
          onDismiss={() => setShowCelebration(false)}
          type={celebrationData.type}
          title={celebrationData.title}
          subtitle={celebrationData.subtitle}
          iconType="trophy"
          autoHideDuration={4000}
        />
      )}

      {pphAlerts.length > 0 && (
        <PPHAlertContainer 
          alerts={pphAlerts} 
          onDismissAlert={dismissPPHAlert} 
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  quickStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  cleanCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  cleanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cleanCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  dataGrid: {
    gap: SPACING.xs,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dataLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  dataValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  dataRowTotal: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dataTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  dataTotalValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactMetricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  compactMetric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  compactMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  compactMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  annualSummaryHero: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  annualSummaryHeroLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  annualSummaryHeroValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  annualSummaryHeroSubtext: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  annualSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  annualSummaryMetric: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 132,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  annualSummaryMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 5,
  },
  annualSummaryMetricValue: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  annualSummaryDetails: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: SPACING.xs,
  },
  annualSummaryDetailRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  annualSummaryDetailLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  annualSummaryDetailValue: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  annualSummaryFootnote: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  avgStatsRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  avgStatText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  discrepancyNotice: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  discrepancyTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
    marginBottom: 2,
  },
  discrepancyText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: 'transparent',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  appTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    letterSpacing: 0.5,
  },
  tierBadges: {
    alignItems: 'flex-start',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.2)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    borderColor: '#D4A574',
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#000000',
  },
  tabButtonTextActive: {
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  tabContent: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: '48.5%',
    minWidth: 160,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  statCardGradient: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#64748B',
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.md,
  },
  statusCardGradient: {
    padding: SPACING.md,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressRow: {
    marginBottom: SPACING.xs,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  progressValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.md,
  },
  statusStatsRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusStat: {
    flex: 1,
    alignItems: 'center',
  },
  statusStatDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SPACING.md,
  },
  statusStatValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  statusStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  casinoPerformanceContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.goldDark,
    ...SHADOW.md,
  },
  casinoPerformanceHeader: {
    backgroundColor: '#FFFBEB',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.goldDark,
  },
  casinoPerformanceHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  casinoPerformanceHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoPerformanceTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  casinoPerformanceSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#92400E',
    opacity: 0.8,
  },
  casinoPerformanceContent: {
    padding: SPACING.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
    marginTop: SPACING.xs,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  avgMetricsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avgMetric: {
    flex: 1,
    alignItems: 'center',
  },
  avgMetricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'center',
  },
  avgMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  avgMetricDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SPACING.md,
  },
  portfolioTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    marginBottom: SPACING.sm,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(0, 31, 63, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  exportButtonText: {
    fontSize: 12,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  filterTabActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  filterTabText: {
    fontSize: 12,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  filterTabTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },
  portfolioList: {
    gap: SPACING.sm,
  },
  portfolioLimitNotice: {
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  portfolioLimitText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    fontStyle: 'italic' as const,
  },
  portfolioHintText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#475569',
    marginTop: -4,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  portfolioCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  portfolioImageContainer: {
    position: 'relative',
    width: 90,
    minHeight: 130,
  },
  portfolioCardImage: {
    width: 90,
    height: '100%',
    minHeight: 130,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  pointsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  pointsOverlayText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  portfolioCardContent: {
    flex: 1,
    padding: SPACING.sm,
    paddingRight: SPACING.md,
  },
  portfolioCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  portfolioCardShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  portfolioCardShipName: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
    marginRight: 4,
  },
  roiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roiBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  portfolioCardItinerary: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginBottom: 2,
  },
  portfolioCardDestination: {
    fontSize: 12,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  portfolioCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  portfolioCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  portfolioCardMetaText: {
    fontSize: 11,
    color: COLORS.navyDeep,
  },
  portfolioCardNights: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  portfolioCardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  portfolioMetric: {
    alignItems: 'center',
  },
  portfolioMetricLabel: {
    fontSize: 9,
    color: CLEAN_THEME.text.secondary,
    marginBottom: 1,
  },
  portfolioMetricValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  portfolioCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  portfolioCardCabin: {
    fontSize: 10,
    color: COLORS.navyDeep,
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portfolioOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portfolioOfferCode: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  portfolioCertificateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  portfolioCertificateText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#047857',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  viewMoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  emptyPortfolio: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.15)',
  },
  emptyPortfolioText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.sm,
  },
  destinationsCard: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  destinationsCardGradient: {
    padding: SPACING.md,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  destinationRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  destinationRankTop: {
    backgroundColor: '#D4A574',
  },
  rankNumber: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  rankNumberTop: {
    color: COLORS.white,
  },
  destinationBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  destinationContent: {
    flex: 1,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destinationLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  destinationValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 120,
  },
  financialCardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.navyDeep,
    ...SHADOW.md,
  },
  financialCardHeader: {
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
  },
  financialHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  financialHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  financialCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  financialCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  financialContent: {
    padding: SPACING.md,
  },
  financialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  financialIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  financialInfo: {
    flex: 1,
  },
  financialLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  financialSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  financialValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.xs,
  },
  financialTotalRow: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: -SPACING.md,
    marginBottom: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: COLORS.navyDeep,
  },
  financialTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  financialTotalValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sessionStatsSection: {
    marginBottom: SPACING.lg,
  },
  sessionHistoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  sessionHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  sessionHistoryLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  sessionHistoryValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  sessionHistoryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.xs,
  },
  recentSessionsContainer: {
    gap: SPACING.sm,
  },
  recentSessionsScrollContainer: {
    maxHeight: 400,
  },
  recentSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  sortLabelText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  recentSessionIndicator: {
    width: 3,
    height: 32,
    backgroundColor: '#10B981',
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  recentSessionContent: {
    flex: 1,
  },
  recentSessionDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E293B',
  },
  recentSessionTime: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  recentSessionNotes: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
  recentSessionStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentSessionDuration: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  recentSessionDurationText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#059669',
  },
  recentSessionWinLoss: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 1,
  },
  recentSessionPointsContainer: {
    alignItems: 'flex-end',
    gap: 1,
  },
  recentSessionPoints: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  recentSessionPPH: {
    fontSize: 9,
    color: '#F59E0B',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    ...SHADOW.sm,
  },
  alertsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertsContent: {
    flex: 1,
  },
  alertsTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 2,
  },
  alertsDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 16,
  },
  calculateButton: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  calculateButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  regenerateButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.goldDark,
  },
  regenerateButtonText: {
    color: COLORS.goldDark,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  calcsHeader: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.royalPurple,
    ...SHADOW.md,
  },
  calcsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  calcsHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcsHeaderText: {
    flex: 1,
  },
  calcsHeaderTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  calcsHeaderSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    marginTop: 2,
  },
  calcsModeToggleContainer: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    backgroundColor: '#F1F5F9',
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 3,
  },
  calcsModeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  calcsModeToggleBtnActive: {
    backgroundColor: COLORS.navyDeep,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  calcsModeToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  calcsModeToggleTextActive: {
    color: COLORS.white,
  },
  calcsModeSummary: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
  },
  calcsModeSummaryText: {
    fontSize: 11,
    color: '#6B21A8',
    textAlign: 'center',
    lineHeight: 16,
  },
  calcsGrid: {
    gap: SPACING.sm,
  },
  calcCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  calcIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcContent: {
    flex: 1,
  },
  calcLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  calcValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 4,
  },
  calcDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    lineHeight: 16,
  },
  calcsInsightCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calcsInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  calcsInsightTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  calcsInsightText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    lineHeight: 20,
  },
  pointsBreakdownLegend: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pointsBreakdownLegendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  pointsBreakdownLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointsBreakdownLegendText: {
    fontSize: 11,
    color: '#64748B',
  },
  pointsBreakdownRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pointsBreakdownShipCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  pointsBreakdownShipName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  pointsBreakdownDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  pointsBreakdownValuesCol: {
    alignItems: 'flex-end' as const,
    gap: 3,
  },
  pointsBreakdownValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  pointsBreakdownValueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pointsBreakdownValueLabel: {
    fontSize: 10,
    color: '#94A3B8',
    minWidth: 80,
  },
  pointsBreakdownValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  economicsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...SHADOW.sm,
  },
  economicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  economicsHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 58, 95, 0.08)',
    marginRight: SPACING.sm,
  },
  economicsHeaderContent: {
    flex: 1,
  },
  economicsTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  economicsSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#475569',
    marginTop: 2,
  },
  economicsHeroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  economicsHeroStat: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#F8FBFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  economicsHeroStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  economicsHeroStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  economicsTableContent: {
    paddingBottom: SPACING.sm,
  },
  economicsTable: {
    minWidth: 1040,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  economicsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  economicsHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  economicsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  economicsTableRowLast: {
    borderBottomColor: '#E2E8F0',
  },
  economicsTotalsRow: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    borderBottomWidth: 0,
  },
  economicsCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  economicsDateCell: {
    width: 98,
  },
  economicsShipCell: {
    width: 190,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  economicsNightsCell: {
    width: 58,
    textAlign: 'center',
  },
  economicsMoneyCell: {
    width: 116,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  economicsPointsCell: {
    width: 92,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  economicsStatusCell: {
    width: 110,
  },
  economicsStatusPill: {
    width: 98,
    marginHorizontal: 6,
    marginVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  economicsStatusKnown: {
    backgroundColor: 'rgba(5, 150, 105, 0.14)',
  },
  economicsStatusEstimated: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  economicsStatusPending: {
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  economicsStatusText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  economicsPositiveValue: {
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  economicsNegativeValue: {
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  performanceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  performanceModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  performanceModalCard: {
    maxHeight: '88%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  performanceModalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  performanceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  performanceModalTitleBlock: {
    flex: 1,
    marginRight: SPACING.md,
  },
  performanceModalEyebrow: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  performanceModalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  performanceModalSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    marginTop: 3,
  },
  performanceCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  performanceModalScroll: {
    maxHeight: 470,
  },
  performanceModalContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  performanceInputGrid: {
    gap: SPACING.md,
  },
  performanceInputGroup: {
    gap: 6,
  },
  performanceInputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  performanceTextInput: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#0F172A',
  },
  performanceNotesInput: {
    minHeight: 92,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    lineHeight: 20,
  },
  performanceInputHint: {
    fontSize: 11,
    color: '#64748B',
  },
  certificateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  certificateToggleActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  certificateToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
  },
  certificateToggleIconActive: {
    backgroundColor: '#059669',
  },
  certificateToggleTextBlock: {
    flex: 1,
  },
  certificateToggleTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  certificateToggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  certificateTogglePill: {
    minWidth: 42,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  certificateTogglePillActive: {
    backgroundColor: '#047857',
  },
  certificateTogglePillText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#475569',
  },
  certificateTogglePillTextActive: {
    color: COLORS.white,
  },
  certificateDetailsCard: {
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  performanceModalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: COLORS.white,
  },
  performanceCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  performanceCancelText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  performanceSaveButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
  },
  performanceSaveText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  economicsSummarySection: {
    marginTop: SPACING.md,
  },
  economicsSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  economicsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  economicsSummaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  economicsSummaryLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  economicsSummaryValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  economicsSnapshotsList: {
    gap: SPACING.sm,
  },
  economicsSnapshotCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  economicsSnapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  economicsSnapshotLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  economicsSnapshotValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  economicsSnapshotShip: {
    fontSize: 11,
    color: '#0F172A',
    marginTop: 6,
  },
  economicsSnapshotDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
