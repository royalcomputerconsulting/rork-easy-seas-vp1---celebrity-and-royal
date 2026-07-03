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
  useWindowDimensions,
} from 'react-native';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Ship,
  DollarSign,
  Award,
  MapPin,
  Zap,
  PieChart,
  Coins,
  Target,
  ChevronDown,
  ChevronRight,
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
  Info,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  ClipboardList,
  RefreshCw,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useAuth } from '@/state/AuthProvider';
import { useUserDataSync } from '@/state/UserDataSyncProvider';
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
import { DOLLARS_PER_POINT, type BookedCruise, type CasinoOffer } from '@/types/models';
import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { getCertificatePdfMatch } from '@/lib/royalCaribbean/certificatePdf';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
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
import { buildDataHealthSummary, isActiveUpcomingCruise } from '@/lib/easySeasAdvisor';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS, darkRoyalDashboardStyles as casinoDashboardStyles, darkRoyalValueColor as casinoValueColor } from '@/constants/darkRoyalTheme';
import { useDrillDown, type CalculationDrillDownData } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoDonutChart } from '@/components/casino-dashboard/CasinoDonutChart';
import { CasinoGroupedBarChart } from '@/components/casino-dashboard/CasinoGroupedBarChart';
import { CasinoLineChart } from '@/components/casino-dashboard/CasinoLineChart';
import { useCertificates } from '@/state/CertificatesProvider';

type AnalyticsTab = 'portfolio' | 'value' | 'action' | 'history';
type ROIFilter = 'all' | 'high' | 'medium' | 'low';

type CruisePerformanceForm = {
  winLoss: string;
  pointsEarned: string;
  instantCertificateWon: boolean;
  instantCertificateOfferCode: string;
  instantCertificateValue: string;
  instantCertificateNotes: string;
};

type DetailModalRow = { label: string; value: string };

type DetailModalState = {
  title: string;
  subtitle?: string;
  rows: DetailModalRow[];
} | null;

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

function formatTotalMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function AnalyticsScreen() {
  useEntitlement();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const { authenticatedEmail } = useAuth();
  const { lastSyncTime, isSyncing: isCloudSyncing, forceSyncNow } = useUserDataSync();
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
    cruises: availableCruises,
    casinoOffers,
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

  const [activeTab, setActiveTabState] = useState<AnalyticsTab>(() => {
    const paramTab = (Array.isArray(tabParam) ? tabParam[0] : tabParam) as AnalyticsTab | undefined;
    return paramTab && ['portfolio', 'value', 'action', 'history'].includes(paramTab) ? paramTab : 'portfolio';
  });
  const setActiveTab = useCallback((tab: AnalyticsTab) => {
    setActiveTabState(tab);
    if (Platform.OS === 'web') {
      router.setParams({ tab });
    }
  }, [router]);
  const { width: windowWidth } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && windowWidth >= LARGE_SCREEN_BREAKPOINT;
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
  const [simulatorPresetKey, setSimulatorPresetKey] = useState<'conservative' | 'stay' | 'aggressive' | 'highRoller'>('stay');
  const [isGeneratingSessions, setIsGeneratingSessions] = useState(false);
  const [selectedPerformanceCruise, setSelectedPerformanceCruise] = useState<BookedCruise | null>(null);
  const [performanceForm, setPerformanceForm] = useState<CruisePerformanceForm>(EMPTY_PERFORMANCE_FORM);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);

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
  const { certificates } = useCertificates();
  const cruiseValueDrill = useDrillDown();

  const showDetail = useCallback((title: string, rows: DetailModalRow[], subtitle?: string) => {
    void haptics.trigger('selection');
    setDetailModal({ title, subtitle, rows });
  }, [haptics]);

  const closeDetail = useCallback(() => setDetailModal(null), []);

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
  }, [bookedCruises]);

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
  }, [currentPoints, totalNights, clubRoyaleTier, crownAnchorLevel, bookedCruises]);

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

  const handleSyncNowPress = useCallback(() => {
    resyncAnalytics();
    if (authenticatedEmail) {
      forceSyncNow().catch((error) => console.error('[Analytics] Sync Now failed:', error));
    }
  }, [resyncAnalytics, forceSyncNow, authenticatedEmail]);

  const dataAsOfLabel = useMemo(() => {
    if (!lastSyncTime) return 'Data as of your last local update';
    const parsed = new Date(lastSyncTime);
    if (Number.isNaN(parsed.getTime())) return 'Data as of your last local update';
    return `Data as of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [lastSyncTime]);

  const renderScreenHeader = useCallback((title: string, subtitle: string) => (
    <View style={styles.screenHeaderRow}>
      <View style={styles.screenHeaderTextCol}>
        <Text style={casinoDashboardStyles.screenTitle}>{title}</Text>
        <Text style={casinoDashboardStyles.screenSubtitle}>{subtitle}</Text>
      </View>
      <View>
        <Text style={styles.dataAsOfText} numberOfLines={1}>{dataAsOfLabel}</Text>
        <TouchableOpacity style={styles.syncNowButton} activeOpacity={0.75} onPress={handleSyncNowPress} testID="casino-sync-now">
          <RefreshCw size={12} color={CASINO_DASHBOARD_COLORS.royalBlue} style={isCloudSyncing ? { transform: [{ rotate: '45deg' }] } : undefined} />
          <Text style={styles.syncNowButtonText}>{isCloudSyncing ? 'Syncing…' : 'Sync Now'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [dataAsOfLabel, handleSyncNowPress, isCloudSyncing]);

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
    void haptics.trigger('selection');
  }, [haptics]);

  const openCruisePerformanceEditorById = useCallback((cruiseId: string) => {
    const cruise = findCruiseForPerformanceEdit(cruiseId);
    if (!cruise) {
      console.log('[Analytics] Cruise performance edit skipped; cruise not found:', cruiseId);
      return;
    }
    openCruisePerformanceEditor(cruise);
  }, [findCruiseForPerformanceEdit, openCruisePerformanceEditor]);

  const openCruiseDetailFromPortfolio = useCallback((cruise: BookedCruise) => {
    router.push({
      pathname: '/cruise-details' as any,
      params: buildCruiseDetailsParams(cruise, { source: 'casino-portfolio' }),
    });
  }, [router]);

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
    const preservedAmountPaid = selectedPerformanceCruise.amountPaid ?? selectedPerformanceCruise.depositPaid ?? netEffectivePaid;
    const updates: Partial<BookedCruise> = {
      earnedPoints: pointsEarned,
      casinoPoints: pointsEarned,
      pointsEarned,
      coinIn: pointsEarned * DOLLARS_PER_POINT,
      retailValue,
      totalRetailCost: retailValue,
      amountPaid: preservedAmountPaid,
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

  const tierGoalsProgress = useMemo(() => {
    const signatureThreshold = CLUB_ROYALE_TIERS.Signature.threshold;
    const mastersThreshold = CLUB_ROYALE_TIERS.Masters.threshold;
    const signaturePct = Math.min(100, Math.max(0, (currentYearPoints / signatureThreshold) * 100));
    const mastersPct = Math.min(100, Math.max(0, (currentYearPoints / mastersThreshold) * 100));
    const daysRemaining = Math.max(0, Math.round((clubRoyaleNextResetDate.getTime() - Date.now()) / 86400000));
    const pointsToSignature = Math.max(0, signatureThreshold - currentYearPoints);
    const pointsToMasters = Math.max(0, mastersThreshold - currentYearPoints);
    const avgPtsPerDayForSignature = daysRemaining > 0 ? pointsToSignature / daysRemaining : 0;
    const avgPtsPerDayForMasters = daysRemaining > 0 ? pointsToMasters / daysRemaining : 0;
    const avgPointsPerCruiseReal = cruiseEconomicsSummary.rows.length > 0
      ? cruiseEconomicsSummary.totals.totalPoints / cruiseEconomicsSummary.rows.length
      : 0;
    const cruisesNeededForSignature = avgPointsPerCruiseReal > 0 ? Math.ceil(pointsToSignature / avgPointsPerCruiseReal) : null;
    const cruisesNeededForMasters = avgPointsPerCruiseReal > 0 ? Math.ceil(pointsToMasters / avgPointsPerCruiseReal) : null;
    return {
      signaturePct, mastersPct, signatureThreshold, mastersThreshold, daysRemaining,
      pointsToSignature, pointsToMasters, avgPtsPerDayForSignature, avgPtsPerDayForMasters,
      cruisesNeededForSignature, cruisesNeededForMasters,
    };
  }, [currentYearPoints, clubRoyaleNextResetDate, cruiseEconomicsSummary]);

  const cruiseEconomicsRowById = useMemo(() => {
    return new Map(cruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row]));
  }, [cruiseEconomicsSummary.rows]);

  const realMonthlyCoinIn = useMemo(() => {
    const totalCoinIn = cruiseEconomicsSummary.totals.totalCoinIn;
    const monthsActive = Math.max(1, cruiseEconomicsSummary.rows.length * (cruiseEconomicsSummary.averages.nightsPerCruise || 7) / 30);
    return totalCoinIn > 0 ? totalCoinIn / monthsActive : playerContext.averageSpendPerCruise;
  }, [cruiseEconomicsSummary, playerContext.averageSpendPerCruise]);

  const simulatorPresets = useMemo(() => {
    return [
      { key: 'conservative' as const, label: 'Conservative', monthlyCoinIn: realMonthlyCoinIn * 0.6, multiplier: 0.6, assumption: 'Assumes 40% less monthly coin-in than your real historical average, with the same real win % and cruise frequency.' },
      { key: 'stay' as const, label: 'Stay the Course', monthlyCoinIn: realMonthlyCoinIn, multiplier: 1, assumption: 'Uses your real historical average monthly coin-in, win %, points/night, and cruises/year exactly as recorded.' },
      { key: 'aggressive' as const, label: 'Aggressive', monthlyCoinIn: realMonthlyCoinIn * 1.5, multiplier: 1.5, assumption: 'Assumes 50% more monthly coin-in than your real historical average, with the same real win % and cruise frequency.' },
      { key: 'highRoller' as const, label: 'High Roller', monthlyCoinIn: realMonthlyCoinIn * 2.5, multiplier: 2.5, assumption: 'Assumes 150% more monthly coin-in than your real historical average — a high-end projection, not a guarantee.' },
    ];
  }, [realMonthlyCoinIn]);

  const simulatorProjection = useMemo(() => {
    const preset = simulatorPresets.find((p) => p.key === simulatorPresetKey) ?? simulatorPresets[1];
    const realCruisesPerYear = cruiseEconomicsSummary.averages.nightsPerCruise > 0
      ? (12 * 30) / Math.max(1, (cruiseEconomicsSummary.rows.length > 0 ? 365 / Math.max(1, cruiseEconomicsSummary.rows.length) : 90))
      : 4;
    const realWinPct = cruiseEconomicsSummary.totals.totalCoinIn > 0
      ? cruiseEconomicsSummary.totals.totalWinningsHome / cruiseEconomicsSummary.totals.totalCoinIn
      : 0;
    const yearlyCoinIn = preset.monthlyCoinIn * 12;
    const projectedCoinIn = yearlyCoinIn * 5;
    const projectedPoints = Math.round((projectedCoinIn / Math.max(1, DOLLARS_PER_POINT)));
    const projectedWinLoss = projectedCoinIn * realWinPct;
    const yearlyPaid = cruiseEconomicsSummary.averages.paidPerCruise * realCruisesPerYear;
    const projectedPaid = yearlyPaid * 5;
    const projectedCompValue = cruiseEconomicsSummary.averages.netCashPerCruise * realCruisesPerYear * 5 - projectedWinLoss;
    const projectedNetMakeOut = projectedCompValue + projectedWinLoss;
    const projectedValuePerDollar = projectedPaid > 0 ? (projectedPaid + projectedNetMakeOut) / projectedPaid : 0;
    const projectedROI = projectedPaid > 0 ? (projectedNetMakeOut / projectedPaid) * 100 : 0;
    return {
      projectedPoints,
      projectedCoinIn,
      projectedWinLoss,
      projectedNetMakeOut,
      projectedValuePerDollar,
      projectedROI,
      realCruisesPerYear,
    };
  }, [simulatorPresets, simulatorPresetKey, cruiseEconomicsSummary]);

  const formatSignedCurrencyDetailed = useCallback((amount: number): string => {
    return `${amount >= 0 ? '+' : '-'}${formatCurrencyDetailed(Math.abs(amount))}`;
  }, []);

  const simulatorResultTiles = useMemo(() => {
    const activePreset = simulatorPresets.find((p) => p.key === simulatorPresetKey) ?? simulatorPresets[1];
    const buildDrill = (label: string, value: string): CalculationDrillDownData => ({
      title: label,
      subtitle: '5-year projection',
      summary: `Projected using the "${activePreset.label}" monthly coin-in assumption, your real historical points-per-night, and your real average cruises/year.`,
      formula: 'Projection = Real per-cruise averages × projected cruises over 5 years, using your real historical win rate',
      inputs: [
        { label: 'Avg points / night (real)', value: playerContext.averagePointsPerNight.toFixed(1) },
        { label: 'Avg cruises / year (real)', value: simulatorProjection.realCruisesPerYear.toFixed(1) },
        { label: 'Monthly coin-in assumption', value: formatCurrencyDetailed(activePreset.monthlyCoinIn) },
        { label: 'Result', value },
      ],
      assumptions: [activePreset.assumption],
    });
    return [
      { key: 'points', label: 'Points Earned', value: formatNumber(simulatorProjection.projectedPoints), color: CASINO_DASHBOARD_COLORS.orange, drill: () => buildDrill('Points Earned', formatNumber(simulatorProjection.projectedPoints)) },
      { key: 'coinIn', label: 'Coin-in', value: formatCurrencyDetailed(simulatorProjection.projectedCoinIn), color: CASINO_DASHBOARD_COLORS.royalBlue, drill: () => buildDrill('Coin-in', formatCurrencyDetailed(simulatorProjection.projectedCoinIn)) },
      { key: 'winLoss', label: 'Win / Loss', value: formatSignedCurrencyDetailed(simulatorProjection.projectedWinLoss), color: casinoValueColor(simulatorProjection.projectedWinLoss), drill: () => buildDrill('Win / Loss', formatSignedCurrencyDetailed(simulatorProjection.projectedWinLoss)) },
      { key: 'netMakeOut', label: 'Net Make-Out', value: formatSignedCurrencyDetailed(simulatorProjection.projectedNetMakeOut), color: casinoValueColor(simulatorProjection.projectedNetMakeOut), drill: () => buildDrill('Net Make-Out', formatSignedCurrencyDetailed(simulatorProjection.projectedNetMakeOut)) },
      { key: 'valuePerDollar', label: 'Value Per $1', value: `${simulatorProjection.projectedValuePerDollar.toFixed(2)}x`, color: CASINO_DASHBOARD_COLORS.teal, drill: () => buildDrill('Value Per $1', `${simulatorProjection.projectedValuePerDollar.toFixed(2)}x`) },
      { key: 'roi', label: 'ROI', value: `${simulatorProjection.projectedROI.toFixed(0)}%`, color: casinoValueColor(simulatorProjection.projectedROI), drill: () => buildDrill('ROI', `${simulatorProjection.projectedROI.toFixed(0)}%`) },
    ];
  }, [simulatorPresets, simulatorPresetKey, simulatorProjection, playerContext.averagePointsPerNight]);

  const pointProgressionData = useMemo(() => {
    const stayPreset = simulatorPresets.find((p) => p.key === 'stay') ?? simulatorPresets[1];
    const activePreset = simulatorPresets.find((p) => p.key === simulatorPresetKey) ?? stayPreset;
    const avgPointsPerCruise = cruiseEconomicsSummary.rows.length > 0
      ? cruiseEconomicsSummary.totals.totalPoints / cruiseEconomicsSummary.rows.length
      : 0;
    const currentPathYearlyPoints = avgPointsPerCruise * simulatorProjection.realCruisesPerYear;
    const scenarioYearlyPoints = (activePreset.monthlyCoinIn * 12) / Math.max(1, DOLLARS_PER_POINT);
    const years = [1, 2, 3, 4, 5].map((year) => ({
      year,
      label: `Year ${year}`,
      currentPath: Math.round(currentPoints + currentPathYearlyPoints * year),
      scenario: Math.round(currentPoints + scenarioYearlyPoints * year),
    }));
    return { years, currentPathYearlyPoints, scenarioYearlyPoints, activePresetLabel: activePreset.label };
  }, [simulatorPresets, simulatorPresetKey, cruiseEconomicsSummary, simulatorProjection.realCruisesPerYear, currentPoints]);

  const scenarioComparisonData = useMemo(() => {
    const realCruisesPerYear = simulatorProjection.realCruisesPerYear;
    const realWinPct = cruiseEconomicsSummary.totals.totalCoinIn > 0
      ? cruiseEconomicsSummary.totals.totalWinningsHome / cruiseEconomicsSummary.totals.totalCoinIn
      : 0;
    const project = (monthlyCoinIn: number) => {
      const yearlyCoinIn = monthlyCoinIn * 12;
      const projectedCoinIn = yearlyCoinIn * 5;
      const projectedPoints = Math.round(projectedCoinIn / Math.max(1, DOLLARS_PER_POINT));
      const projectedWinLoss = projectedCoinIn * realWinPct;
      const yearlyPaid = cruiseEconomicsSummary.averages.paidPerCruise * realCruisesPerYear;
      const projectedPaid = yearlyPaid * 5;
      const projectedCompValue = cruiseEconomicsSummary.averages.netCashPerCruise * realCruisesPerYear * 5 - projectedWinLoss;
      const projectedNetMakeOut = projectedCompValue + projectedWinLoss;
      const projectedROI = projectedPaid > 0 ? (projectedNetMakeOut / projectedPaid) * 100 : 0;
      return { projectedPoints, projectedCoinIn, projectedWinLoss, projectedNetMakeOut, projectedROI };
    };
    const stayPreset = simulatorPresets.find((p) => p.key === 'stay') ?? simulatorPresets[1];
    const aggressivePreset = simulatorPresets.find((p) => p.key === 'aggressive') ?? simulatorPresets[2];
    const activePreset = simulatorPresets.find((p) => p.key === simulatorPresetKey) ?? stayPreset;
    const currentPathProj = project(stayPreset.monthlyCoinIn);
    const scenarioAProj = project(activePreset.monthlyCoinIn);
    const scenarioBProj = project(aggressivePreset.monthlyCoinIn);
    const rows = [
      {
        metric: 'Points Earned',
        currentPath: formatNumber(currentPathProj.projectedPoints),
        scenarioA: formatNumber(scenarioAProj.projectedPoints),
        scenarioB: formatNumber(scenarioBProj.projectedPoints),
      },
      {
        metric: 'Coin-in',
        currentPath: formatCurrencyDetailed(currentPathProj.projectedCoinIn),
        scenarioA: formatCurrencyDetailed(scenarioAProj.projectedCoinIn),
        scenarioB: formatCurrencyDetailed(scenarioBProj.projectedCoinIn),
      },
      {
        metric: 'Win / Loss',
        currentPath: formatSignedCurrencyDetailed(currentPathProj.projectedWinLoss),
        scenarioA: formatSignedCurrencyDetailed(scenarioAProj.projectedWinLoss),
        scenarioB: formatSignedCurrencyDetailed(scenarioBProj.projectedWinLoss),
        color: (v: number) => casinoValueColor(v),
        raw: [currentPathProj.projectedWinLoss, scenarioAProj.projectedWinLoss, scenarioBProj.projectedWinLoss],
      },
      {
        metric: 'Net Make-Out',
        currentPath: formatSignedCurrencyDetailed(currentPathProj.projectedNetMakeOut),
        scenarioA: formatSignedCurrencyDetailed(scenarioAProj.projectedNetMakeOut),
        scenarioB: formatSignedCurrencyDetailed(scenarioBProj.projectedNetMakeOut),
        raw: [currentPathProj.projectedNetMakeOut, scenarioAProj.projectedNetMakeOut, scenarioBProj.projectedNetMakeOut],
      },
      {
        metric: 'ROI',
        currentPath: `${currentPathProj.projectedROI.toFixed(0)}%`,
        scenarioA: `${scenarioAProj.projectedROI.toFixed(0)}%`,
        scenarioB: `${scenarioBProj.projectedROI.toFixed(0)}%`,
        raw: [currentPathProj.projectedROI, scenarioAProj.projectedROI, scenarioBProj.projectedROI],
      },
    ];
    return { rows, scenarioALabel: `Scenario A (${activePreset.label})`, scenarioBLabel: 'Scenario B (Aggressive)' };
  }, [simulatorPresets, simulatorPresetKey, cruiseEconomicsSummary, simulatorProjection.realCruisesPerYear, formatSignedCurrencyDetailed]);

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

  const valueByYear = useMemo(() => {
    const byYear = new Map<string, { year: string; retail: number; paid: number; rows: CruiseEconomicsRow[] }>();
    cruiseEconomicsSummary.rows.forEach((row) => {
      const year = row.sailDate && /^\d{4}/.test(row.sailDate) ? row.sailDate.slice(0, 4) : 'Unknown';
      const bucket = byYear.get(year) ?? { year, retail: 0, paid: 0, rows: [] };
      bucket.retail += row.retail;
      bucket.paid += row.paid;
      bucket.rows.push(row);
      byYear.set(year, bucket);
    });
    return Array.from(byYear.values()).sort((a, b) => a.year.localeCompare(b.year));
  }, [cruiseEconomicsSummary.rows]);

  const futureValueWallet = useMemo(() => {
    const availableCerts = certificates.filter((c) => c.status === 'available');
    const activeOffers = (casinoOffers || []).filter((offer) => {
      if (!offer.expiryDate) return true;
      const expiry = createDateFromString(offer.expiryDate);
      return expiry >= new Date();
    });
    return {
      certificateCount: availableCerts.length,
      certificateValue: availableCerts.reduce((sum, c) => sum + (c.value || 0), 0),
      activeOfferCount: activeOffers.length,
      itemCount: availableCerts.length + activeOffers.length,
    };
  }, [certificates, casinoOffers]);

  const futureValueCreated = useMemo(() => {
    const wonCertsFromCruises = bookedCruises.filter((c) => c.instantCertificateWon);
    const wonValueFromCruises = wonCertsFromCruises.reduce((sum, c) => sum + (c.instantCertificateValue || 0), 0);
    return {
      total: wonValueFromCruises + futureValueWallet.certificateValue,
      wonCount: wonCertsFromCruises.length,
      walletValue: futureValueWallet.certificateValue,
    };
  }, [bookedCruises, futureValueWallet.certificateValue]);

  const w2gTotals = useMemo(() => {
    return {
      totalAmount: w2gRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
      count: w2gRecords.length,
    };
  }, [w2gRecords]);

  const stats = useMemo(() => {
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
  }, [clubRoyaleTier, cruiseEconomicsSummary, currentYearPoints, historicalPoints]);

  const perCruisePointsBreakdown = useMemo(() => {
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
  }, [bookedCruises]);

  const shipPerformance = useMemo(() => {
    const map = new Map<string, { ship: string; cruises: number; nights: number; paid: number; retail: number; cashResult: number; totalEconomic: number; points: number }>();
    cruiseEconomicsSummary.rows.forEach((row) => {
      const key = row.ship || 'Unknown Ship';
      const existing = map.get(key) ?? { ship: key, cruises: 0, nights: 0, paid: 0, retail: 0, cashResult: 0, totalEconomic: 0, points: 0 };
      existing.cruises += 1;
      existing.nights += row.nights;
      existing.paid += row.paid;
      existing.retail += row.retail;
      existing.cashResult += row.netCash;
      existing.totalEconomic += row.totalEconomic;
      existing.points += row.points;
      map.set(key, existing);
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        valuePerDollar: entry.paid > 0 ? entry.totalEconomic / entry.paid : 0,
      }))
      .sort((a, b) => b.totalEconomic - a.totalEconomic)
      .slice(0, 8);
  }, [cruiseEconomicsSummary.rows]);

  const dataHealthSummary = useMemo(
    () => buildDataHealthSummary(availableCruises ?? [], bookedCruises, casinoOffers ?? []),
    [availableCruises, bookedCruises, casinoOffers],
  );
  const dataHealthIssueCount = dataHealthSummary.duplicateAvailableRows + dataHealthSummary.duplicateOfferCodes + dataHealthSummary.possiblyMisclassifiedUpcoming;

  const upcomingCruisesList = useMemo(() => {
    const today = new Date();
    return bookedCruises
      .filter((cruise) => isActiveUpcomingCruise(cruise))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime())
      .slice(0, 8)
      .map((cruise) => {
        const sail = createDateFromString(cruise.sailDate);
        const daysUntil = Math.max(0, Math.round((sail.getTime() - today.getTime()) / 86400000));
        return { cruise, daysUntil };
      });
  }, [bookedCruises]);

  const expiringOffersList = useMemo(() => {
    const now = Date.now();
    const horizon = now + 45 * 86400000;
    return (casinoOffers ?? [])
      .map((offer: CasinoOffer) => {
        const expiryRaw = offer.offerExpiryDate || offer.expiryDate || offer.expires || offer.validUntil;
        const expiryDate = expiryRaw ? createDateFromString(expiryRaw) : null;
        return { offer, expiryDate };
      })
      .filter((entry): entry is { offer: CasinoOffer; expiryDate: Date } => {
        if (!entry.expiryDate || Number.isNaN(entry.expiryDate.getTime())) return false;
        if (entry.offer.status === 'expired' || entry.offer.status === 'used') return false;
        const time = entry.expiryDate.getTime();
        return time >= now - 86400000 && time <= horizon;
      })
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
      .slice(0, 6)
      .map(({ offer, expiryDate }) => ({
        id: offer.id,
        title: offer.offerName || offer.title || offer.offerCode || 'Casino offer',
        offerCode: offer.offerCode || '',
        daysLeft: Math.max(0, Math.round((expiryDate.getTime() - now) / 86400000)),
        expiryLabel: expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      }));
  }, [casinoOffers]);

  const instantCertBank = useMemo(() => {
    return bookedCruises
      .filter((cruise) => cruise.instantCertificateWon)
      .sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime())
      .slice(0, 10)
      .map((cruise) => {
        const pdfMatch = getCertificatePdfMatch({ offerCode: cruise.instantCertificateOfferCode, offerName: cruise.instantCertificateNotes });
        const certType: 'A' | 'C' | 'D' = pdfMatch?.certificateType ?? ((cruise.nights ?? 0) >= 6 ? 'D' : 'A');
        return {
          id: cruise.id,
          shipName: cruise.shipName || 'Unknown Ship',
          sailDate: cruise.sailDate,
          offerCode: cruise.instantCertificateOfferCode || '',
          value: cruise.instantCertificateValue || 0,
          notes: cruise.instantCertificateNotes || '',
          certType,
        };
      });
  }, [bookedCruises]);

  const instantCertBankByType = useMemo(() => {
    const groups: Record<'A' | 'C' | 'D', { count: number; value: number; certs: typeof instantCertBank }> = {
      A: { count: 0, value: 0, certs: [] },
      C: { count: 0, value: 0, certs: [] },
      D: { count: 0, value: 0, certs: [] },
    };
    instantCertBank.forEach((cert) => {
      const bucket = groups[cert.certType];
      bucket.count += 1;
      bucket.value += cert.value;
      bucket.certs.push(cert);
    });
    const labels: Record<'A' | 'C' | 'D', string> = { A: 'A Certificates', C: 'C Certificates', D: 'D Certificates' };
    return (['A', 'C', 'D'] as const)
      .map((type) => ({ type, label: labels[type], ...groups[type] }))
      .filter((group) => group.count > 0);
  }, [instantCertBank]);

  const actionChecklist = useMemo(() => {
    const missingResultsCount = cruiseEconomicsSummary.rows.filter((row) => row.calculationConfidence !== 'actual').length;
    return [
      {
        id: 'log-results',
        label: missingResultsCount > 0 ? `Log actual win/loss + points for ${missingResultsCount} cruise(s)` : 'All completed cruises have logged results',
        done: missingResultsCount === 0,
        detail: 'Tap any row in the value ledger or a portfolio card to enter real numbers instead of estimates.',
      },
      {
        id: 'upcoming',
        label: upcomingCruisesList.length > 0 ? `${upcomingCruisesList.length} upcoming cruise(s) on the books` : 'No upcoming cruises booked',
        done: upcomingCruisesList.length === 0,
        detail: 'Review upcoming sailings below and confirm casino offer codes are attached.',
      },
      {
        id: 'expiring',
        label: expiringOffersList.length > 0 ? `${expiringOffersList.length} offer(s) expiring within 45 days` : 'No offers expiring soon',
        done: expiringOffersList.length === 0,
        detail: 'Book or extend the offers below before they expire.',
      },
      {
        id: 'data-health',
        label: dataHealthIssueCount > 0 ? `${dataHealthIssueCount} data-health signal(s) to review` : 'Data health looks clean',
        done: dataHealthIssueCount === 0,
        detail: 'Open Data Health to review duplicate rows or misclassified cruises.',
      },
    ];
  }, [cruiseEconomicsSummary.rows, upcomingCruisesList, expiringOffersList, dataHealthIssueCount]);

  const freePlaySummary = useMemo(() => {
    const cruisesWithFreePlay = bookedCruises.filter((c) => (c.freePlay || 0) > 0);
    const total = cruisesWithFreePlay.reduce((sum, c) => sum + (c.freePlay || 0), 0);
    return { total, cruiseCount: cruisesWithFreePlay.length, cruises: cruisesWithFreePlay };
  }, [bookedCruises]);

  const actionCenterDrill = useDrillDown();

  const keepPlayingRecommendation = useMemo(() => {
    const rows = cruiseEconomicsSummary.rows;
    if (rows.length < 2) {
      return {
        verdict: 'not-enough-data' as const,
        headline: 'Not enough completed cruises yet',
        detail: 'Log results from at least 2 completed cruises to get a keep-playing recommendation.',
        recentAvg: 0,
        earlierAvg: 0,
      };
    }
    const half = Math.floor(rows.length / 2);
    const earlier = rows.slice(0, half);
    const recent = rows.slice(half);
    const avg = (list: typeof rows) => list.length > 0 ? list.reduce((sum, r) => sum + (r.netCash ?? 0), 0) / list.length : 0;
    const earlierAvg = avg(earlier);
    const recentAvg = avg(recent);
    const trendDelta = recentAvg - earlierAvg;
    const recentCashPositive = recentAvg >= 0;
    const verdict: 'keep-playing' | 'watch-closely' | 'reassess' = recentCashPositive && trendDelta >= 0
      ? 'keep-playing'
      : recentCashPositive || trendDelta > -200
        ? 'watch-closely'
        : 'reassess';
    const headline = verdict === 'keep-playing'
      ? 'Keep playing at current pace'
      : verdict === 'watch-closely'
        ? 'Watch closely before your next trip'
        : 'Reassess offers before booking again';
    const detail = `Recent ${recent.length} cruise(s) averaged ${formatSignedCurrencyDetailed(recentAvg)} cash result vs ${formatSignedCurrencyDetailed(earlierAvg)} for the earlier ${earlier.length}. ${cruiseEconomicsSummary.totals.hasEstimates ? 'Some rows use estimated values.' : 'All rows use actual entered results.'}`;
    return { verdict, headline, detail, recentAvg, earlierAvg };
  }, [cruiseEconomicsSummary.rows, cruiseEconomicsSummary.totals.hasEstimates, formatSignedCurrencyDetailed]);

  const pointsPerNightTrend = useMemo(() => {
    return cruiseEconomicsSummary.rows.slice(-8).map((row) => ({
      id: row.cruiseId,
      ship: row.ship,
      sailDate: row.sailDate,
      pointsPerNight: row.pointsPerNight,
    }));
  }, [cruiseEconomicsSummary.rows]);

  const chronologicalEconomicsRows = useMemo(() => {
    return [...cruiseEconomicsSummary.rows].sort(
      (a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime(),
    );
  }, [cruiseEconomicsSummary.rows]);

  const pointsByYearData = useMemo(() => {
    const map = new Map<string, { points: number; rows: typeof cruiseEconomicsSummary.rows }>();
    chronologicalEconomicsRows.forEach((row) => {
      const parsed = row.sailDate ? createDateFromString(row.sailDate) : null;
      const year = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getUTCFullYear()) : 'Unknown';
      const existing = map.get(year) ?? { points: 0, rows: [] };
      existing.points += row.points;
      existing.rows = [...existing.rows, row];
      map.set(year, existing);
    });
    return Array.from(map.entries())
      .filter(([year]) => year !== 'Unknown')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, data]) => ({ year, points: data.points, rows: data.rows }));
  }, [chronologicalEconomicsRows]);

  const winLossHistoryData = useMemo(() => {
    return chronologicalEconomicsRows.slice(-10).map((row) => ({
      id: row.cruiseId,
      ship: row.ship,
      sailDate: row.sailDate,
      winningsHome: row.winningsHome,
    }));
  }, [chronologicalEconomicsRows]);

  const pointsPerNightChartData = useMemo(() => {
    return chronologicalEconomicsRows.slice(-10).map((row) => ({
      id: row.cruiseId,
      ship: row.ship,
      sailDate: row.sailDate,
      pointsPerNight: row.pointsPerNight,
    }));
  }, [chronologicalEconomicsRows]);

  const shipPerformanceHistory = useMemo(() => {
    return shipPerformance.map((ship) => ({
      ...ship,
      avgPointsPerCruise: ship.cruises > 0 ? ship.points / ship.cruises : 0,
      avgWinLossPerCruise: ship.cruises > 0 ? ship.cashResult / ship.cruises : 0,
      avgValuePerCruise: ship.cruises > 0 ? ship.totalEconomic / ship.cruises : 0,
      netMakeOut: ship.totalEconomic,
    }));
  }, [shipPerformance]);

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
      'retailValue',
      'amountPaid',
      'taxesFeesEstimate',
      'netEffectivePaid',
      'pointsEarned',
      'winningsBroughtHome',
      'coinIn',
      'houseEdge',
      'pointDollarValue',
      'hoursPlayed',
      'casinoChargesRoomBilled',
      'cashResult',
      'cruiseValueCaptured',
      'totalEconomicValue',
      'theoreticalLoss',
      'netTheoretical',
      'coinInPerHour',
      'pointsPerHour',
      'valuePerHour',
      'instantCertificateWon',
      'instantCertificateOfferCode',
      'instantCertificateValue',
      'instantCertificateNotes',
      'calculationConfidence',
      'notes',
    ];

    const rows = cruises.map((cruise) => {
      const summary = buildCruiseEconomicsSummary([cruise], new Date(), { scope: 'allCruises' });
      const row = summary.rows[0];
      const pointsEarned = row?.points ?? getBookedCruiseCasinoPoints(cruise);
      const winningsBroughtHome = row?.winningsHome ?? cruise.winningsBroughtHome ?? cruise.winnings ?? cruise.totalWinnings ?? cruise.netResult ?? 0;

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
        row?.retail ?? cruise.retailValue ?? cruise.totalRetailCost,
        cruise.amountPaid,
        row?.taxesFeesEstimate ?? cruise.taxesFeesEstimate ?? cruise.taxes,
        row?.paid ?? cruise.netEffectivePaid,
        pointsEarned,
        winningsBroughtHome,
        row?.coinIn ?? cruise.coinIn,
        row?.houseEdge ?? cruise.houseEdge,
        row?.pointDollarValue ?? cruise.pointDollarValue,
        row?.hoursPlayed ?? cruise.hoursPlayed,
        row?.casinoChargesRoomBilled ?? cruise.casinoChargesRoomBilled ?? cruise.actualSpend,
        row?.cashResult ?? cruise.cashResult,
        row?.cruiseValueCaptured ?? cruise.cruiseValueCaptured,
        row?.totalEconomicValue ?? cruise.totalEconomicValue,
        row?.theoreticalLoss ?? cruise.theoreticalLoss,
        row?.netTheoretical ?? cruise.netTheoretical,
        row?.coinInPerHour ?? cruise.coinInPerHour,
        row?.pointsPerHour ?? cruise.pointsPerHour,
        row?.valuePerHour ?? cruise.valuePerHour,
        cruise.instantCertificateWon ?? false,
        cruise.instantCertificateOfferCode,
        cruise.instantCertificateValue,
        cruise.instantCertificateNotes,
        row?.calculationConfidence ?? cruise.calculationConfidence,
        row?.notes ?? cruise.notes,
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
        <Download size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
      ? CASINO_DASHBOARD_COLORS.green
      : cruise.roiLevel === 'medium'
        ? CASINO_DASHBOARD_COLORS.orange
        : CASINO_DASHBOARD_COLORS.red;

    const effectiveValuePerDollar = economicsRow && economicsRow.paid > 0
      ? economicsRow.totalEconomic / economicsRow.paid
      : cruise.valuePerDollar;
    const valuePerDollarDisplay = effectiveValuePerDollar >= 9999
      ? '∞'
      : `${effectiveValuePerDollar.toFixed(2)}`;

    const imageHash = String(cruise.id ?? '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      if (cruise.itineraryName && typeof cruise.itineraryName === 'string') {
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
        onPress={() => openCruiseDetailFromPortfolio(cruise)}
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
              <Ship size={13} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
              <Calendar size={12} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
              <Text style={[styles.portfolioMetricValue, { color: (economicsRow?.netCash ?? winnings) >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
                {(economicsRow?.netCash ?? winnings) >= 0 ? '+' : ''}{formatCurrency(economicsRow?.netCash ?? winnings)}
              </Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Total Economic Value</Text>
              <Text style={[styles.portfolioMetricValue, { color: (economicsRow?.totalEconomic ?? breakdown.totalProfit) >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
                {formatCurrency(economicsRow?.totalEconomic ?? breakdown.totalProfit)}
              </Text>
            </View>
          </View>

          {cruise.cabinType ? (
            <View style={styles.portfolioCardFooter}>
              <Text style={styles.portfolioCardCabin}>{cruise.cabinType}</Text>
              {cruise.offerCode ? (
                <View style={styles.portfolioOfferBadge}>
                  <Zap size={10} color={CASINO_DASHBOARD_COLORS.gold} />
                  <Text style={styles.portfolioOfferCode}>{cruise.offerCode}</Text>
                </View>
              ) : null}
              {cruise.instantCertificateWon ? (
                <View style={styles.portfolioCertificateBadge}>
                  <Ticket size={10} color={CASINO_DASHBOARD_COLORS.green} />
                  <Text style={styles.portfolioCertificateText}>Cert won</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.portfolioEditButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  openCruisePerformanceEditorById(cruise.id);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.portfolioEditButtonText}>Edit play</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderPortfolioTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.quickStatsRow}>
        {stats.map((stat, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickStatItem}
            activeOpacity={0.7}
            onPress={() => showDetail(stat.label, [
              { label: 'Value', value: stat.value },
              { label: 'Source', value: stat.label === 'Cruises' ? 'Count of completed cruises in the value ledger below.' : stat.label === 'Status Tier' ? 'Your current Club Royale tier from loyalty sync or manual entry.' : stat.label === 'Current Pts' ? 'Current-season points, resets every April 1.' : 'Lifetime historical points earned, never resets.' },
            ])}
          >
            <stat.icon size={16} color={(stat as { color?: string }).color || CASINO_DASHBOARD_COLORS.textPrimary} />
            <Text style={styles.quickStatValue}>{stat.value}</Text>
            <Text style={styles.quickStatLabel}>{stat.label}</Text>
          </TouchableOpacity>
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
            <Calendar size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
            <Text style={styles.cleanCardTitle}>Current vs Historical</Text>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Current Status Tier</Text>
              <Text style={[styles.dataValue, { color: CASINO_DASHBOARD_COLORS.textPrimary }]}>{clubRoyaleTier}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Current Season Points</Text>
              <Text style={styles.dataValue}>{formatNumber(currentYearPoints)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Signature Retain Gap</Text>
              <Text style={[styles.dataValue, { color: currentSeasonMetrics.pointsNeededForSignature === 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.orange }]}>{formatNumber(currentSeasonMetrics.pointsNeededForSignature)} pts</Text>
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
              <Text style={[styles.dataValue, { color: CASINO_DASHBOARD_COLORS.gold }]}>{formatNumber(historicalPoints)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Historical Tier Earned</Text>
              <Text style={[styles.dataValue, { color: CASINO_DASHBOARD_COLORS.green }]}>{historicalClubRoyaleTier}</Text>
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
        <TierProgressionChart
          playerContext={playerContext}
          bookedCruises={bookedCruises}
          monthsAhead={24}
        />
      </View>

      {shipPerformance.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ship size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
            <Text style={styles.sectionTitle}>Ship-by-Ship Performance</Text>
          </View>
          <View style={{ gap: SPACING.sm }}>
            {shipPerformance.map((ship) => (
              <TouchableOpacity
                key={ship.ship}
                style={styles.shipCard}
                activeOpacity={0.8}
                onPress={() => showDetail(`${ship.ship} performance`, [
                  { label: 'Completed cruises', value: String(ship.cruises) },
                  { label: 'Total nights', value: String(ship.nights) },
                  { label: 'Retail value', value: formatCurrencyDetailed(ship.retail) },
                  { label: 'Amount paid', value: formatCurrencyDetailed(ship.paid) },
                  { label: 'Cash result', value: formatSignedCurrencyDetailed(ship.cashResult) },
                  { label: 'Total economic value', value: formatSignedCurrencyDetailed(ship.totalEconomic) },
                  { label: 'Points earned', value: formatNumber(ship.points) },
                  { label: 'Value per dollar', value: `${ship.valuePerDollar.toFixed(2)}x` },
                ], 'Tap any ship on this list to see the full breakdown.')}
              >
                <View style={styles.shipCardTop}>
                  <Text style={styles.shipCardName} numberOfLines={1}>{ship.ship}</Text>
                  <View style={styles.shipCardBadge}>
                    <Text style={styles.shipCardBadgeText}>{ship.cruises} {ship.cruises === 1 ? 'cruise' : 'cruises'}</Text>
                  </View>
                </View>
                <View style={styles.shipMetricsRow}>
                  <View style={styles.shipMetric}>
                    <Text style={styles.shipMetricLabel}>Paid</Text>
                    <Text style={styles.shipMetricValue}>{formatCurrency(ship.paid)}</Text>
                  </View>
                  <View style={styles.shipMetric}>
                    <Text style={styles.shipMetricLabel}>Cash Result</Text>
                    <Text style={[styles.shipMetricValue, { color: ship.cashResult >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
                      {formatSignedCurrencyDetailed(ship.cashResult)}
                    </Text>
                  </View>
                  <View style={styles.shipMetric}>
                    <Text style={styles.shipMetricLabel}>Total Econ</Text>
                    <Text style={[styles.shipMetricValue, { color: ship.totalEconomic >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
                      {formatSignedCurrencyDetailed(ship.totalEconomic)}
                    </Text>
                  </View>
                  <View style={styles.shipMetric}>
                    <Text style={styles.shipMetricLabel}>Value/$</Text>
                    <Text style={styles.shipMetricValue}>{ship.valuePerDollar.toFixed(2)}x</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.dataHealthCard, dataHealthIssueCount > 0 ? styles.dataHealthCardWarning : styles.dataHealthCardGood]}
          activeOpacity={0.8}
          onPress={() => router.push('/data-health' as any)}
          testID="casino-data-health-indicator"
        >
          {dataHealthIssueCount > 0 ? <AlertTriangle size={20} color={CASINO_DASHBOARD_COLORS.orange} /> : <Activity size={20} color={CASINO_DASHBOARD_COLORS.green} />}
          <View style={styles.dataHealthTextBlock}>
            <Text style={styles.dataHealthTitle}>{dataHealthIssueCount > 0 ? `${dataHealthIssueCount} data-health signal(s) found` : 'Data health looks clean'}</Text>
            <Text style={styles.dataHealthSubtitle}>
              {dataHealthSummary.completedCruises} completed · {dataHealthSummary.activeUpcoming} upcoming · {dataHealthSummary.royalOffers + dataHealthSummary.celebrityOffers} offers tracked
            </Text>
          </View>
          <ChevronRight size={18} color={dataHealthIssueCount > 0 ? CASINO_DASHBOARD_COLORS.goldText : CASINO_DASHBOARD_COLORS.green} />
        </TouchableOpacity>
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
                  color={CASINO_DASHBOARD_COLORS.textPrimary}
                  style={{ transform: [{ rotate: showAllCruises ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyPortfolio}>
            <Ship size={40} color={CASINO_DASHBOARD_COLORS.textSecondary} />
            <Text style={styles.emptyPortfolioText}>No cruises match this filter</Text>
          </View>
        )}
      </View>

      {realAnalytics.destinationDistribution.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
    </View>
  );

  const renderValueTab = () => (
    <View style={styles.tabContent}>
      {cruiseValueDrill.element}
      <View style={styles.section}>
        {renderScreenHeader('Cruise Value', 'Track the real value of your cruises and your true make-out.')}
      </View>

      <View style={styles.section}>
        <View style={styles.valueHeroGrid}>
          {[
            {
              key: 'retail',
              label: 'Total Retail Value',
              value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalRetailValue),
              color: CASINO_DASHBOARD_COLORS.royalBlue,
              drill: (): CalculationDrillDownData => ({
                title: 'Total Retail Value',
                subtitle: 'What these cruises would have cost at published brochure rates',
                summary: 'The full published cabin price for every completed cruise counted in your value ledger, before any casino comp, offer, or discount is applied.',
                formula: 'Total Retail Value = Sum of each completed cruise\'s retail cabin price',
                inputs: [
                  { label: 'Cruises counted', value: String(cruiseEconomicsSummary.totals.cruises) },
                  { label: 'Total nights', value: String(cruiseEconomicsSummary.totals.totalNights) },
                ],
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({
                  label: `${row.ship} — ${row.sailDate}`,
                  value: formatCurrencyDetailed(row.retail),
                  confidence: row.calculationConfidence === 'actual' ? 'verified-invoice' : row.calculationConfidence === 'mixed' ? 'imported-csv' : 'estimated-default',
                })),
                assumptions: cruiseEconomicsSummary.totals.hasEstimates ? ['Cabin category and passenger count use the values captured for each cruise; where a live retail price wasn\'t available, EasySeas estimates from comparable sailings.'] : [],
                missing: cruiseEconomicsSummary.rows.length === 0 ? ['No completed cruises with retail pricing yet.'] : [],
              }),
            },
            {
              key: 'comp',
              label: 'Total Comp Value',
              value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalCruiseValueCaptured),
              color: CASINO_DASHBOARD_COLORS.purple,
              drill: (): CalculationDrillDownData => ({
                title: 'Total Comp Value',
                subtitle: 'The value the casino comped you off retail price',
                summary: 'The gap between what each cruise would have cost at retail and what you actually paid — the discount your casino offer/certificate covered.',
                formula: 'Comp Value = Retail Value − Cash Paid (summed per cruise)',
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({
                  label: `${row.ship} — ${row.sailDate}`,
                  value: formatCurrencyDetailed(row.discount),
                  detail: `Retail ${formatCurrencyDetailed(row.retail)} minus paid ${formatCurrencyDetailed(row.paid)}`,
                  confidence: row.calculationConfidence === 'actual' ? 'verified-invoice' : 'calculated',
                })),
                assumptions: ['Comp value reflects the offer/certificate on file for each cruise (cabin comp, trade-in, or annual cruise benefit).'],
              }),
            },
            {
              key: 'cash',
              label: 'Total Cash Paid',
              value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid),
              color: CASINO_DASHBOARD_COLORS.brightBlue,
              drill: (): CalculationDrillDownData => ({
                title: 'Total Cash Paid',
                subtitle: 'Taxes, fees, and out-of-pocket costs across your cruises',
                summary: 'The net amount you paid out of pocket for these cruises — taxes & fees, deposits, upgrades, and add-ons — excluding casino wagering volume, which is tracked separately.',
                formula: 'Cash Paid = Taxes & Fees + Deposits + Upgrades + Add-ons (summed per cruise)',
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({
                  label: `${row.ship} — ${row.sailDate}`,
                  value: formatCurrencyDetailed(row.paid),
                  confidence: row.calculationConfidence === 'actual' ? 'verified-invoice' : 'estimated-default',
                })),
                missing: cruiseEconomicsSummary.totals.hasEstimates ? ['Some cruises are missing an itemized invoice, so taxes/fees use an estimated baseline for that sailing.'] : [],
              }),
            },
            {
              key: 'netMakeOut',
              label: 'Total Net Make-Out',
              value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult),
              color: casinoValueColor(cruiseEconomicsSummary.totals.totalCashResult),
              drill: (): CalculationDrillDownData => ({
                title: 'Total Net Make-Out',
                subtitle: 'Your true cash result across every completed cruise',
                summary: 'What you actually came out ahead (or behind) once casino winnings, comps, and cash paid are all netted together.',
                formula: 'Net Make-Out = Comp Value + FreePlay + OBC + FCC Used + Cruise Planner Value + VOOM Value + Specialty Dining Value + Spa Value + Casino Win/Loss − Cash Paid − Taxes & Fees − Gratuities − Out-of-Pocket Add-ons',
                inputs: [
                  { label: 'Winnings brought home', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome) },
                  { label: 'Total cash paid', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid) },
                ],
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({
                  label: `${row.ship} — ${row.sailDate}`,
                  value: formatSignedCurrencyDetailed(row.netCash),
                  detail: `Winnings ${formatCurrencyDetailed(row.winningsHome)} minus paid ${formatCurrencyDetailed(row.paid)}`,
                  confidence: row.calculationConfidence === 'actual' ? 'verified-invoice' : 'calculated',
                })),
              }),
            },
            {
              key: 'toteValue',
              label: 'Tote Per $1 Paid',
              value: `${realAnalytics.valuePerDollar.toFixed(2)}x`,
              color: CASINO_DASHBOARD_COLORS.teal,
              drill: (): CalculationDrillDownData => ({
                title: 'Tote Per $1 Paid',
                subtitle: 'How much total value you receive per dollar you actually pay',
                summary: `You receive ${formatCurrencyDetailed(realAnalytics.valuePerDollar)} in value for every $1 paid.`,
                formula: 'Tote Per $1 Paid = Total Real Value Received ÷ Total Cash Paid',
                inputs: [
                  { label: 'Total real value received', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue) },
                  { label: 'Total cash paid', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid) },
                  { label: 'Cash ROI', value: `${cruiseEconomicsSummary.roiStyle.cashROI.toFixed(2)}x` },
                ],
                assumptions: ['Cruises with $0 cash paid are excluded from this ratio\'s denominator but their value is still counted in totals shown elsewhere.'],
              }),
            },
          ].map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[casinoDashboardStyles.card, styles.valueHeroTileV2]}
              activeOpacity={0.8}
              onPress={() => cruiseValueDrill.open(tile.drill())}
              testID={`cruise-value-kpi-${tile.key}`}
            >
              <Text style={casinoDashboardStyles.cardLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={[casinoDashboardStyles.bigNumber, { color: tile.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {tile.value}
              </Text>
              <Info size={12} color={CASINO_DASHBOARD_COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.avgStatsRow}>
          <Text style={styles.avgStatText}>
            {cruiseEconomicsSummary.totals.hasEstimates ? 'Some numbers above include estimated rows where actual data was missing.' : 'All numbers above come from actual entered cruise results.'} Tap any card to see exactly how it was calculated.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Value Breakdown (All Time)</Text>
          <View style={{ marginTop: 12 }}>
            <CasinoDonutChart
              centerLabel="Total Value"
              centerValue={formatCurrency(
                cruiseEconomicsSummary.totals.totalRetailValue +
                cruiseEconomicsSummary.totals.totalCruiseValueCaptured +
                Math.max(0, cruiseEconomicsSummary.totals.totalWinningsHome)
              )}
              segments={[
                { key: 'retail', label: 'Retail Value', value: cruiseEconomicsSummary.totals.totalRetailValue, color: CASINO_DASHBOARD_COLORS.royalBlue, onPress: () => cruiseValueDrill.open({ title: 'Retail Value Segment', summary: 'The portion of total value made up of published brochure prices.', sourceRecords: cruiseEconomicsSummary.rows.slice(0, 8).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatCurrencyDetailed(row.retail) })) }) },
                { key: 'comp', label: 'Comp Value', value: cruiseEconomicsSummary.totals.totalCruiseValueCaptured, color: CASINO_DASHBOARD_COLORS.purple, onPress: () => cruiseValueDrill.open({ title: 'Comp Value Segment', summary: 'Value comped off retail by your casino offers/certificates.', sourceRecords: cruiseEconomicsSummary.rows.slice(0, 8).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatCurrencyDetailed(row.discount) })) }) },
                { key: 'cash', label: 'Cash Paid', value: cruiseEconomicsSummary.totals.totalPaid, color: CASINO_DASHBOARD_COLORS.green, onPress: () => cruiseValueDrill.open({ title: 'Cash Paid Segment', summary: 'Actual out-of-pocket cash paid across these cruises.', sourceRecords: cruiseEconomicsSummary.rows.slice(0, 8).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatCurrencyDetailed(row.paid) })) }) },
                { key: 'winloss', label: 'Win / Loss', value: Math.max(0, cruiseEconomicsSummary.totals.totalWinningsHome), color: CASINO_DASHBOARD_COLORS.teal, onPress: () => cruiseValueDrill.open({ title: 'Win / Loss Segment', summary: 'Casino winnings brought home across these cruises.', sourceRecords: cruiseEconomicsSummary.rows.slice(0, 8).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatSignedCurrencyDetailed(row.winningsHome) })) }) },
              ]}
            />
          </View>
        </View>
      </View>

      {valueByYear.length > 0 && (
        <View style={styles.section}>
          <View style={casinoDashboardStyles.card}>
            <Text style={styles.economicsTitle}>Value vs. Cash Paid</Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>All Time — tap a year to see its cruises</Text>
            <View style={{ marginTop: 8 }}>
              <CasinoGroupedBarChart
                barLabels={[
                  { key: 'value', label: 'Value Received', color: CASINO_DASHBOARD_COLORS.royalBlue },
                  { key: 'cash', label: 'Cash Paid', color: CASINO_DASHBOARD_COLORS.green },
                ]}
                groups={valueByYear.map((bucket) => ({
                  key: bucket.year,
                  label: bucket.year,
                  bars: [
                    { key: 'value', value: bucket.retail, color: CASINO_DASHBOARD_COLORS.royalBlue },
                    { key: 'cash', value: bucket.paid, color: CASINO_DASHBOARD_COLORS.green },
                  ],
                  onPress: () => cruiseValueDrill.open({
                    title: `${bucket.year} Cruises`,
                    summary: `${bucket.rows.length} cruise(s) sailed in ${bucket.year}.`,
                    sourceRecords: bucket.rows.map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: `${formatCurrencyDetailed(row.retail)} value / ${formatCurrencyDetailed(row.paid)} paid` })),
                  }),
                }))}
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={casinoDashboardStyles.card}
          activeOpacity={0.85}
          onPress={() => cruiseValueDrill.open({
            title: 'ROI / Value Per Dollar',
            subtitle: 'Return on Investment',
            summary: `You receive ${formatCurrencyDetailed(realAnalytics.valuePerDollar)} in value for every $1 paid.`,
            formula: 'ROI = (Total Value Received − Total Cash Paid) ÷ Total Cash Paid',
            inputs: [
              { label: 'Total value used', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalEconomicValue) },
              { label: 'Total cash paid used', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid) },
            ],
            sourceRecords: [...cruiseEconomicsSummary.rows]
              .sort((a, b) => (b.paid > 0 ? b.totalEconomic / b.paid : 0) - (a.paid > 0 ? a.totalEconomic / a.paid : 0))
              .slice(0, 6)
              .map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: row.paid > 0 ? `${(row.totalEconomic / row.paid).toFixed(2)}x` : '—' })),
          })}
        >
          <Text style={styles.economicsTitle}>ROI / Value Per Dollar</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>All Time</Text>
          <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 34, color: CASINO_DASHBOARD_COLORS.green, textAlign: 'center', marginTop: 10 }]}>
            {realAnalytics.valuePerDollar.toFixed(2)}x
          </Text>
          <Text style={[casinoDashboardStyles.screenSubtitle, { textAlign: 'center' }]}>Return on Investment</Text>
          <Text style={[styles.avgStatText, { textAlign: 'center', marginTop: 8 }]}>
            You receive {formatCurrencyDetailed(realAnalytics.valuePerDollar)} in value for every $1 paid
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <CasinoMetricsCard
          summary={cruiseEconomicsSummary}
          alwaysExpanded={true}
        />
      </View>

      {cruiseEconomicsSummary.rows.length > 0 && (
        <View style={styles.section}>
          <View style={styles.economicsCard} testID="casino-cruise-economics-card">
            <View style={styles.economicsHeader}>
              <View style={styles.economicsHeaderIcon}>
                <TrendingUp size={18} color={CASINO_DASHBOARD_COLORS.textPrimary} />
              </View>
              <View style={styles.economicsHeaderContent}>
                <Text style={styles.economicsTitle}>Full Value Ledger</Text>
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
                <Text style={[styles.economicsHeroStatValue, { color: CASINO_DASHBOARD_COLORS.green }]}>{formatCurrency(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)}</Text>
                <Text style={styles.economicsHeroStatLabel}>Cruise Value</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={[styles.economicsHeroStatValue, { color: cruiseEconomicsSummary.totals.totalCashResult >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
                  {formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult)}
                </Text>
                <Text style={styles.economicsHeroStatLabel}>Cash Result</Text>
              </View>
              <View style={styles.economicsHeroStat}>
                <Text style={[styles.economicsHeroStatValue, { color: cruiseEconomicsSummary.totals.totalEconomicValue >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>
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
                      onLongPress={() => showDetail(`${row.ship} — ${row.sailDate}`, [
                        { label: 'Retail', value: formatCurrencyDetailed(row.retail) },
                        { label: 'Paid', value: formatCurrencyDetailed(row.paid) },
                        { label: 'Cruise value', value: formatCurrencyDetailed(row.discount) },
                        { label: 'Points', value: formatNumber(row.points) },
                        { label: 'Winnings', value: formatSignedCurrencyDetailed(row.winningsHome) },
                        { label: 'Cash result', value: formatSignedCurrencyDetailed(row.netCash) },
                        { label: 'Total economic value', value: formatSignedCurrencyDetailed(row.totalEconomic) },
                        { label: 'Confidence', value: confidenceLabel },
                        ...(row.notes ? [{ label: 'Notes', value: row.notes }] : []),
                      ], 'Tap the row to edit, or long-press to see the calculation notes.')}
                      testID={`casino-economics-row-${row.cruiseId}`}
                    >
                      <Text style={[styles.economicsCell, styles.economicsDateCell]}>{row.sailDate}</Text>
                      <Text style={[styles.economicsCell, styles.economicsShipCell]} numberOfLines={1}>{row.ship}</Text>
                      <Text style={[styles.economicsCell, styles.economicsNightsCell]}>{row.nights}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.retail)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.paid)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell]}>{formatCurrencyDetailed(row.discount)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsPointsCell]}>{formatNumber(row.points)}</Text>
                      <Text style={[styles.economicsCell, styles.economicsMoneyCell, { color: row.winningsHome >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>{formatSignedCurrencyDetailed(row.winningsHome)}</Text>
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
                  <Text style={[styles.economicsCell, styles.economicsMoneyCell, { color: cruiseEconomicsSummary.totals.totalWinningsHome >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>{formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome)}</Text>
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
                  color={CASINO_DASHBOARD_COLORS.textPrimary}
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
        <View style={styles.valueHeroGrid}>
          {[
            {
              key: 'futureValueCreated',
              label: 'Future Value Created',
              value: formatCurrencyDetailed(futureValueCreated.total),
              color: CASINO_DASHBOARD_COLORS.green,
              drill: (): CalculationDrillDownData => ({
                title: 'Future Value Created',
                subtitle: 'New certificates and offer value earned for future cruises',
                summary: 'Instant certificates won on completed cruises, plus the value of certificates currently sitting in your wallet.',
                formula: 'Future Value Created = Instant Certificates Won on Cruises + Available Certificate Wallet Value',
                sourceRecords: [
                  { label: 'Instant certificates won on cruises', value: `${futureValueCreated.wonCount} certificate(s)` },
                  { label: 'Available certificate wallet value', value: formatCurrencyDetailed(futureValueCreated.walletValue) },
                ],
                missing: futureValueCreated.total === 0 ? ['No instant certificates or wallet certificates recorded yet.'] : [],
              }),
            },
            {
              key: 'futureValueWallet',
              label: 'Future Value Wallet',
              value: String(futureValueWallet.itemCount),
              subLabel: 'Certificates, FCCs & Offers',
              color: CASINO_DASHBOARD_COLORS.purple,
              drill: (): CalculationDrillDownData => ({
                title: 'Future Value Wallet',
                subtitle: 'Certificates, FCCs & offers you can still use',
                summary: `${futureValueWallet.certificateCount} available certificate(s) worth ${formatCurrencyDetailed(futureValueWallet.certificateValue)}, plus ${futureValueWallet.activeOfferCount} active casino offer(s).`,
                formula: 'Future Value Wallet = Available Certificates + Active Casino Offers',
                sourceRecords: [
                  { label: 'Available certificates', value: String(futureValueWallet.certificateCount), confidence: 'user-entered' },
                  { label: 'Certificate value', value: formatCurrencyDetailed(futureValueWallet.certificateValue), confidence: 'calculated' },
                  { label: 'Active casino offers', value: String(futureValueWallet.activeOfferCount), confidence: 'imported-csv' },
                ],
              }),
            },
            {
              key: 'w2g',
              label: 'W2G / Taxable Jackpots',
              value: formatCurrencyDetailed(w2gTotals.totalAmount),
              subLabel: 'Total Taxable Amount',
              color: CASINO_DASHBOARD_COLORS.orange,
              drill: (): CalculationDrillDownData => ({
                title: 'W2G / Taxable Jackpots',
                subtitle: 'Total taxable jackpot amount recorded',
                summary: `${w2gTotals.count} W2G-reportable jackpot(s) totaling ${formatCurrencyDetailed(w2gTotals.totalAmount)}.`,
                formula: 'Total Taxable Amount = Sum of every recorded W2G jackpot amount',
                sourceRecords: w2gRecords.slice(0, 6).map((record) => ({ label: `${record.description || 'Jackpot'} — ${record.date}`, value: formatCurrencyDetailed(record.amount), confidence: 'user-entered' })),
                missing: w2gTotals.count === 0 ? ['No W2G records entered yet.'] : [],
              }),
            },
            {
              key: 'avgNetMakeOut',
              label: 'Avg. Net Make-Out / Cruise',
              value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.averages.netCashPerCruise),
              subLabel: 'All Time',
              color: casinoValueColor(cruiseEconomicsSummary.averages.netCashPerCruise),
              drill: (): CalculationDrillDownData => ({
                title: 'Avg. Net Make-Out / Cruise',
                subtitle: 'Average cash result per completed cruise',
                summary: 'Total net make-out divided evenly across every completed cruise counted.',
                formula: 'Avg. Net Make-Out / Cruise = Total Net Make-Out ÷ Number of Completed Cruises',
                inputs: [
                  { label: 'Total net make-out', value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalCashResult) },
                  { label: 'Completed cruises', value: String(cruiseEconomicsSummary.totals.cruises) },
                ],
              }),
            },
            {
              key: 'breakEven',
              label: 'Break-Even Value / Cruise',
              value: formatCurrencyDetailed(cruiseEconomicsSummary.averages.paidPerCruise),
              subLabel: 'All Time',
              color: CASINO_DASHBOARD_COLORS.deepNavy,
              drill: (): CalculationDrillDownData => ({
                title: 'Break-Even Value / Cruise',
                subtitle: 'Average cash you need back to break even on a cruise',
                summary: 'The average amount you pay out of pocket per cruise — the minimum in comps/winnings you\'d need to come out even.',
                formula: 'Break-Even Value / Cruise = Total Cash Paid ÷ Number of Completed Cruises',
                inputs: [
                  { label: 'Total cash paid', value: formatCurrencyDetailed(cruiseEconomicsSummary.totals.totalPaid) },
                  { label: 'Completed cruises', value: String(cruiseEconomicsSummary.totals.cruises) },
                ],
              }),
            },
          ].map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[casinoDashboardStyles.card, styles.valueHeroTileV2]}
              activeOpacity={0.8}
              onPress={() => cruiseValueDrill.open(tile.drill())}
              testID={`cruise-value-summary-${tile.key}`}
            >
              <Text style={casinoDashboardStyles.cardLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 20, color: tile.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {tile.value}
              </Text>
              {tile.subLabel ? <Text style={styles.economicsSummaryLabel} numberOfLines={1}>{tile.subLabel}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LineChart size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
          <Text style={styles.sectionTitle}>Future Value Projections</Text>
        </View>
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
    </View>
  );

  const renderActionTab = () => (
    <View style={styles.tabContent}>
      {actionCenterDrill.element}
      <View style={styles.section}>
        {renderScreenHeader('Casino Action Center', 'Manage your upcoming cruises, offers, certificates, and daily actions.')}
      </View>

      <View style={styles.section}>
        <View style={styles.valueHeroGrid}>
          {[
            {
              key: 'upcoming',
              label: 'Upcoming Cruises',
              value: String(upcomingCruisesList.length),
              subLabel: upcomingCruisesList[0] ? `Next: ${upcomingCruisesList[0].cruise.sailDate}` : 'None booked',
              color: CASINO_DASHBOARD_COLORS.royalBlue,
              drill: (): CalculationDrillDownData => ({
                title: 'Upcoming Cruises',
                summary: `${upcomingCruisesList.length} upcoming cruise(s) currently booked.`,
                sourceRecords: upcomingCruisesList.map(({ cruise, daysUntil }) => ({ label: `${cruise.shipName || 'Unknown Ship'} — ${cruise.sailDate}`, value: `${daysUntil}d out`, confidence: 'imported-csv' })),
                missing: upcomingCruisesList.length === 0 ? ['No upcoming cruises booked yet.'] : [],
              }),
            },
            {
              key: 'expiringOffers',
              label: 'Offers Expiring Soon',
              value: String(expiringOffersList.length),
              subLabel: 'Within 45 Days',
              color: CASINO_DASHBOARD_COLORS.purple,
              drill: (): CalculationDrillDownData => ({
                title: 'Offers Expiring Soon',
                summary: `${expiringOffersList.length} casino offer(s) expiring within 45 days.`,
                sourceRecords: expiringOffersList.map((offer) => ({ label: offer.title, value: `${offer.daysLeft}d left`, detail: offer.offerCode, confidence: 'imported-csv' })),
                missing: expiringOffersList.length === 0 ? ['No offers expiring within 45 days.'] : [],
              }),
            },
            {
              key: 'instantCerts',
              label: 'Instant Certificates',
              value: String(instantCertBank.length),
              subLabel: 'Available to Use',
              color: CASINO_DASHBOARD_COLORS.orange,
              drill: (): CalculationDrillDownData => ({
                title: 'Instant Certificates',
                summary: `${instantCertBank.length} instant certificate(s) won from completed cruises.`,
                sourceRecords: instantCertBank.map((cert) => ({ label: `${cert.shipName} — ${cert.sailDate}`, value: formatCurrency(cert.value), detail: cert.offerCode, confidence: 'user-entered' })),
              }),
            },
            {
              key: 'freePlay',
              label: 'FreePlay Available',
              value: formatCurrencyDetailed(freePlaySummary.total),
              subLabel: `Across ${freePlaySummary.cruiseCount} Cruises`,
              color: CASINO_DASHBOARD_COLORS.brightBlue,
              drill: (): CalculationDrillDownData => ({
                title: 'FreePlay Available',
                summary: `${formatCurrencyDetailed(freePlaySummary.total)} in FreePlay across ${freePlaySummary.cruiseCount} cruise(s).`,
                formula: 'FreePlay Available = Sum of FreePlay amounts recorded on each cruise/offer',
                sourceRecords: freePlaySummary.cruises.map((c) => ({ label: `${c.shipName || 'Unknown Ship'} — ${c.sailDate}`, value: formatCurrencyDetailed(c.freePlay || 0), confidence: 'imported-csv' })),
                missing: freePlaySummary.total === 0 ? ['No FreePlay recorded on any cruise or offer yet.'] : [],
              }),
            },
            {
              key: 'tasksDue',
              label: 'Tasks Due',
              value: String(actionChecklist.filter((item) => !item.done).length),
              subLabel: 'Action Items',
              color: CASINO_DASHBOARD_COLORS.green,
              drill: (): CalculationDrillDownData => ({
                title: 'Tasks Due',
                summary: `${actionChecklist.filter((item) => !item.done).length} of ${actionChecklist.length} checklist item(s) still need attention.`,
                sourceRecords: actionChecklist.map((item) => ({ label: item.label, value: item.done ? 'Done' : 'Due', detail: item.detail })),
              }),
            },
          ].map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[casinoDashboardStyles.card, styles.valueHeroTileV2]}
              activeOpacity={0.8}
              onPress={() => actionCenterDrill.open(tile.drill())}
              testID={`action-center-kpi-${tile.key}`}
            >
              <Text style={casinoDashboardStyles.cardLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 22, color: tile.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {tile.value}
              </Text>
              <Text style={styles.economicsSummaryLabel} numberOfLines={1}>{tile.subLabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {freePlaySummary.total > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={casinoDashboardStyles.card}
            activeOpacity={0.85}
            onPress={() => actionCenterDrill.open({
              title: 'FreePlay & Benefits',
              subtitle: `Available FreePlay across ${freePlaySummary.cruiseCount} cruises`,
              formula: 'FreePlay Available = Sum of FreePlay amounts recorded on each cruise/offer',
              sourceRecords: freePlaySummary.cruises.map((c) => ({ label: `${c.shipName || 'Unknown Ship'} — ${c.sailDate}`, value: formatCurrencyDetailed(c.freePlay || 0), detail: c.offerCode, confidence: 'imported-csv' })),
            })}
          >
            <Text style={styles.economicsTitle}>FreePlay & Benefits</Text>
            <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 28, color: CASINO_DASHBOARD_COLORS.brightBlue, marginTop: 8 }]}>
              {formatCurrencyDetailed(freePlaySummary.total)}
            </Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>Available FreePlay across {freePlaySummary.cruiseCount} cruises</Text>
          </TouchableOpacity>
        </View>
      )}

      {upcomingCruisesList.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ship size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
            <Text style={styles.sectionTitle}>Upcoming Cruises</Text>
          </View>
          <View style={{ gap: SPACING.sm }}>
            {upcomingCruisesList.map(({ cruise, daysUntil }) => (
              <TouchableOpacity
                key={cruise.id}
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => openCruiseDetailFromPortfolio(cruise)}
              >
                <View style={styles.actionRowIcon}>
                  <Ship size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
                </View>
                <View style={styles.actionRowContent}>
                  <Text style={styles.actionRowTitle} numberOfLines={1}>{cruise.shipName || 'Unknown Ship'}</Text>
                  <Text style={styles.actionRowSubtitle} numberOfLines={1}>
                    {cruise.sailDate} · {cruise.nights || 0}N · {cruise.offerCode || 'No offer code'}
                  </Text>
                </View>
                <View style={styles.actionRowBadge}>
                  <Text style={styles.actionRowBadgeText}>{daysUntil === 0 ? 'Today' : `${daysUntil}d`}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {expiringOffersList.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={16} color={CASINO_DASHBOARD_COLORS.orange} />
            <Text style={styles.sectionTitle}>Offers Expiring Soon</Text>
          </View>
          <View style={{ gap: SPACING.sm }}>
            {expiringOffersList.map((offer) => (
              <TouchableOpacity
                key={offer.id}
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => showDetail(offer.title, [
                  { label: 'Offer code', value: offer.offerCode || '—' },
                  { label: 'Expires', value: offer.expiryLabel },
                  { label: 'Days left', value: String(offer.daysLeft) },
                ])}
              >
                <View style={[styles.actionRowIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Clock size={16} color={CASINO_DASHBOARD_COLORS.orange} />
                </View>
                <View style={styles.actionRowContent}>
                  <Text style={styles.actionRowTitle} numberOfLines={1}>{offer.title}</Text>
                  <Text style={styles.actionRowSubtitle} numberOfLines={1}>{offer.offerCode || 'No code'} · Expires {offer.expiryLabel}</Text>
                </View>
                <View style={[styles.actionRowBadge, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                  <Text style={[styles.actionRowBadgeText, { color: CASINO_DASHBOARD_COLORS.goldText }]}>{offer.daysLeft}d</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ClipboardList size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
          <Text style={styles.sectionTitle}>Today's Checklist</Text>
        </View>
        <View style={styles.cleanCard}>
          {actionChecklist.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.checklistRow, index === actionChecklist.length - 1 && { marginBottom: 0, borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              onPress={() => showDetail(item.label, [{ label: 'Detail', value: item.detail }])}
            >
              {item.done ? <CheckCircle size={18} color={CASINO_DASHBOARD_COLORS.green} /> : <AlertTriangle size={18} color={CASINO_DASHBOARD_COLORS.orange} />}
              <View style={styles.checklistTextBlock}>
                <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>{item.label}</Text>
                <Text style={styles.checklistDetail} numberOfLines={2}>{item.detail}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {instantCertBank.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ticket size={16} color={CASINO_DASHBOARD_COLORS.green} />
            <Text style={styles.sectionTitle}>Instant Certificate Bank</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            {instantCertBankByType.map((group) => (
              <TouchableOpacity
                key={group.type}
                style={[casinoDashboardStyles.card, { flex: 1, paddingVertical: 14, alignItems: 'center' }]}
                activeOpacity={0.8}
                onPress={() => actionCenterDrill.open({
                  title: group.label,
                  subtitle: `${group.count} certificate(s) - ${formatCurrency(group.value)} total value`,
                  formula: `${group.label} total value = Sum of instant-certificate values won on cruises classified as type ${group.type}`,
                  sourceRecords: group.certs.map((c) => ({ label: `${c.shipName} — ${c.sailDate}`, value: formatCurrency(c.value), detail: c.offerCode || 'No code', confidence: 'user-entered' })),
                  assumptions: group.type === 'D' ? ['No PDF-matched certificate code was found for these, so type was estimated from cruise length (6+ nights).'] : undefined,
                })}
                testID={`cert-bank-type-${group.type}`}
              >
                <Text style={[casinoDashboardStyles.cardLabel, { textAlign: 'center' }]} numberOfLines={1}>{group.label}</Text>
                <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 22, color: CASINO_DASHBOARD_COLORS.green, marginTop: 4 }]}>{group.count}</Text>
                <Text style={styles.economicsSummaryLabel} numberOfLines={1}>{formatCurrency(group.value)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ gap: SPACING.sm }}>
            {instantCertBank.map((cert) => (
              <TouchableOpacity
                key={cert.id}
                style={styles.actionRow}
                activeOpacity={0.8}
                onPress={() => openCruisePerformanceEditorById(cert.id)}
              >
                <View style={[styles.actionRowIcon, { backgroundColor: 'rgba(51, 199, 126, 0.14)' }]}>
                  <Ticket size={16} color={CASINO_DASHBOARD_COLORS.green} />
                </View>
                <View style={styles.actionRowContent}>
                  <Text style={styles.actionRowTitle} numberOfLines={1}>{cert.shipName} · {cert.certType} Cert · {cert.offerCode || 'No code'}</Text>
                  <Text style={styles.actionRowSubtitle} numberOfLines={1}>{cert.sailDate}{cert.notes ? ` · ${cert.notes}` : ''}</Text>
                </View>
                <View style={[styles.actionRowBadge, { backgroundColor: 'rgba(51, 199, 126, 0.22)' }]}>
                  <Text style={[styles.actionRowBadgeText, { color: CASINO_DASHBOARD_COLORS.green }]}>{formatCurrency(cert.value)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Casino Goals &amp; Progress</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>Tap a bar for points needed, pace required, and cruises remaining</Text>
          {[
            {
              key: 'signature',
              label: 'Signature Progress',
              pct: tierGoalsProgress.signaturePct,
              color: CASINO_DASHBOARD_COLORS.royalBlue,
              threshold: tierGoalsProgress.signatureThreshold,
              pointsRemaining: tierGoalsProgress.pointsToSignature,
              avgPerDay: tierGoalsProgress.avgPtsPerDayForSignature,
              cruisesNeeded: tierGoalsProgress.cruisesNeededForSignature,
            },
            {
              key: 'masters',
              label: 'Masters Progress',
              pct: tierGoalsProgress.mastersPct,
              color: CASINO_DASHBOARD_COLORS.purple,
              threshold: tierGoalsProgress.mastersThreshold,
              pointsRemaining: tierGoalsProgress.pointsToMasters,
              avgPerDay: tierGoalsProgress.avgPtsPerDayForMasters,
              cruisesNeeded: tierGoalsProgress.cruisesNeededForMasters,
            },
          ].map((goal) => (
            <TouchableOpacity
              key={goal.key}
              activeOpacity={0.8}
              style={{ marginTop: 14 }}
              onPress={() => actionCenterDrill.open({
                title: goal.label,
                summary: `${formatNumber(currentYearPoints)} of ${formatNumber(goal.threshold)} points needed (${goal.pct.toFixed(0)}%).`,
                formula: 'Progress % = Current-season points ÷ tier point target',
                inputs: [
                  { label: 'Current-season points', value: formatNumber(currentYearPoints) },
                  { label: 'Target points', value: formatNumber(goal.threshold) },
                  { label: 'Points remaining', value: formatNumber(Math.round(goal.pointsRemaining)) },
                  { label: 'Days remaining in tier year', value: `${tierGoalsProgress.daysRemaining}d` },
                  { label: 'Avg points/day needed', value: formatNumber(Math.round(goal.avgPerDay)) },
                  { label: 'Est. cruises remaining needed', value: goal.cruisesNeeded !== null ? String(goal.cruisesNeeded) : 'Needs Data' },
                ],
                assumptions: ['Tier year is assumed to reset on the next Club Royale reset date shown on the Portfolio tab. Cruises-remaining estimate uses your real average points per completed cruise.'],
                missing: goal.cruisesNeeded === null ? ['Not enough completed-cruise point history yet to estimate cruises remaining.'] : [],
              })}
              testID={`tier-goal-progress-${goal.key}`}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.dataLabel}>{goal.label}</Text>
                <Text style={[styles.dataValue, { color: goal.color }]}>{goal.pct.toFixed(0)}%</Text>
              </View>
              <View style={styles.goalProgressTrack}>
                <View style={[styles.goalProgressFill, { width: `${goal.pct}%`, backgroundColor: goal.color }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <LivePPHTracker
          targetPPH={targetPPH}
          onSessionComplete={(data) => {
            void handleAddSession({
              startTime: new Date(Date.now() - data.durationMinutes * 60 * 1000).toTimeString().slice(0, 5),
              endTime: new Date().toTimeString().slice(0, 5),
              durationMinutes: data.durationMinutes,
              pointsEarned: data.pointsEarned,
              notes: `Live tracked session - ${data.pph.toFixed(0)} pts/hr`,
            });
          }}
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
        <CompValueCalculator
          initialItems={compItems}
          onCompValueChange={(totalValue) => {
            console.log('[Analytics] Comp value changed:', totalValue);
          }}
        />
      </View>
    </View>
  );

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

  const historicalCruiseData = useMemo(() => {
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
      totalEconomicValue: cruiseEconomicsSummary.totals.totalEconomicValue,
      cruises: cruiseData,
    };
  }, [cruiseEconomicsSummary, sessions]);

  const highValueCalculations = useMemo(() => {
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
    const totalValueForMode = isHistorical
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

    const totalEconomicRoiPercentage = totalTaxesFees > 0 ? (totalValueForMode / totalTaxesFees) * 100 : 0;
    void totalEconomicRoiPercentage;
    const valuePerUnit = totalSessions > 0 ? totalValueForMode / totalSessions : (totalValueForMode !== 0 ? totalValueForMode : 0);

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
    const valuePerHourPlayed = totalHistoricalHours > 0 ? totalValueForMode / totalHistoricalHours : 0;

    const recentCashResult = sessions.slice(-10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const earlyCashResult = sessions.slice(0, 10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const trendScore = earlyCashResult !== 0 ? (recentCashResult / Math.max(Math.abs(earlyCashResult), 1)) : 1;
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
        color: CASINO_DASHBOARD_COLORS.textPrimary,
        icon: Coins,
      },
      {
        id: 2,
        label: isHistorical ? 'Theo (historical avg)' : 'Theo per session',
        value: formatCurrency(theoPerUnit) + (coinInIsEstimated ? ' (est.)' : ''),
        description: `Coin-in ${modeLabel} × ${(assumedHold * 100).toFixed(0)}% hold` + (coinInIsEstimated ? ' (estimated)' : ''),
        color: CASINO_DASHBOARD_COLORS.purple,
        icon: Target,
      },
      {
        id: 3,
        label: isHistorical ? 'Best theo/hour block (hist.)' : 'Best theo/hour block',
        value: theoTimeBlockValue > 0 ? `${formatCurrency(theoTimeBlockValue)}/hr • ${theoPerTimeBlock}` : '—',
        description: theoTimeBlockDescription,
        color: CASINO_DASHBOARD_COLORS.orange,
        icon: Dices,
      },
      {
        id: 4,
        label: 'ADT smoothing factor',
        value: adtSmoothingFactor.toFixed(3),
        description: 'How evenly theo is spread across days',
        color: CASINO_DASHBOARD_COLORS.purple,
        icon: LineChart,
      },
      {
        id: 5,
        label: isHistorical ? 'Total economic value / session' : 'Casino value / session',
        value: formatCurrency(valuePerUnit),
        description: `${formatCurrency(totalValueForMode)} ÷ ${totalSessions} ${isHistorical ? 'historical/derived' : ''} sessions. Coin-In is excluded from value.`,
        color: valuePerUnit >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red,
        icon: TrendingUp,
      },
      {
        id: 6,
        label: 'Risk per hour',
        value: formatCurrency(riskPerHour),
        description: `${stopGap} stop-gap ÷ avg session length`,
        color: CASINO_DASHBOARD_COLORS.red,
        icon: Zap,
      },
      {
        id: 7,
        label: 'Press efficiency ratio',
        value: pressEfficiencyRatio.toFixed(2) + 'x',
        description: 'Cash result during press spins ÷ press exposure',
        color: CASINO_DASHBOARD_COLORS.green,
        icon: PieChart,
      },
      {
        id: 8,
        label: 'Offer safety index',
        value: offerSafetyIndex.toFixed(2),
        description: 'Consistency score vs spike risk',
        color: CASINO_DASHBOARD_COLORS.green,
        icon: Award,
      },
      {
        id: 9,
        label: isHistorical ? 'Total economic value / hour' : 'Casino value / hour',
        value: totalHistoricalHours > 0 ? formatCurrency(valuePerHourPlayed) : '—',
        description: isHistorical
          ? `Total economic value ÷ ${totalHistoricalHours.toFixed(2)} play hours. Coin-In is not included in value.`
          : (hasSessionData ? 'Session cash result + point value ÷ tracked play hours' : `Known current-season winnings ÷ ${totalHistoricalHours.toFixed(2)} estimated play hours`),
        color: CASINO_DASHBOARD_COLORS.gold,
        icon: DollarSign,
      },
      {
        id: 10,
        label: isHistorical ? 'Points per session (hist.)' : 'Sustainability score',
        value: isHistorical ? formatNumber(Math.round(pointsPerSession)) + ' pts' : `${sustainabilityScore.toFixed(1)}%`,
        description: isHistorical
          ? `${formatNumber(historicalTotalPoints)} pts ÷ ${totalSessions} sessions`
          : 'Likelihood offers persist unchanged',
        color: isHistorical ? CASINO_DASHBOARD_COLORS.purple : (sustainabilityScore >= 70 ? CASINO_DASHBOARD_COLORS.green : sustainabilityScore >= 40 ? CASINO_DASHBOARD_COLORS.orange : CASINO_DASHBOARD_COLORS.red),
        icon: isHistorical ? Award : BarChart3,
      },
      ...(isHistorical ? [
        {
          id: 11,
          label: 'Avg Coin-In / Cruise',
          value: formatCurrency(completedCruiseCount > 0 ? cruiseEconomicsSummary.totals.totalCoinIn / completedCruiseCount : 0),
          description: `${formatCurrency(totalCoinIn)} ÷ ${completedCruiseCount} completed cruises`,
          color: CASINO_DASHBOARD_COLORS.textPrimary,
          icon: Ship,
        },
        {
          id: 12,
          label: 'Avg Cash Result / Cruise',
          value: `${avgCashResultPerCruise >= 0 ? '+' : ''}${formatCurrency(avgCashResultPerCruise)}`,
          description: `${formatCurrency(totalWinLoss)} ÷ ${completedCruiseCount} completed cruises`,
          color: avgCashResultPerCruise >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red,
          icon: TrendingUp,
        },
      ] : []),
    ];
  }, [calcsMode, cruiseEconomicsSummary, sessions, sessionAnalytics, historicalCruiseData, currentSeasonMetrics]);

  const historyInsightsDrill = useDrillDown();

  const bestShipByPoints = useMemo(() => {
    return [...shipPerformance].sort((a, b) => b.points - a.points)[0] ?? null;
  }, [shipPerformance]);

  const bestShipByWinLoss = useMemo(() => {
    return [...shipPerformance].sort((a, b) => b.cashResult - a.cashResult)[0] ?? null;
  }, [shipPerformance]);

  const formatMonthLabel = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const monthIndex = Number(month) - 1;
    if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return monthKey;
    const date = new Date(Date.UTC(Number(year), monthIndex, 1));
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const historyInsightsOverview = useMemo(() => {
    const monthTotals = new Map<string, { points: number; cashResult: number }>();
    const dayTotals = new Map<string, { points: number; buyIn: number; cashResult: number }>();

    sessions.forEach((session) => {
      if (!session.date) return;
      const monthKey = session.date.slice(0, 7);
      const monthEntry = monthTotals.get(monthKey) ?? { points: 0, cashResult: 0 };
      monthEntry.points += session.pointsEarned || 0;
      monthEntry.cashResult += session.winLoss || 0;
      monthTotals.set(monthKey, monthEntry);

      const dayEntry = dayTotals.get(session.date) ?? { points: 0, buyIn: 0, cashResult: 0 };
      dayEntry.points += session.pointsEarned || 0;
      dayEntry.buyIn += session.buyIn || 0;
      dayEntry.cashResult += session.winLoss || 0;
      dayTotals.set(session.date, dayEntry);
    });

    const dayEntries = Array.from(dayTotals.entries());
    const monthEntries = Array.from(monthTotals.entries());
    const bestMonth = [...monthEntries].sort((a, b) => b[1].cashResult - a[1].cashResult)[0] ?? null;
    const bestDayByCash = [...dayEntries].sort((a, b) => b[1].cashResult - a[1].cashResult)[0] ?? null;
    const bestDayByPoints = [...dayEntries].sort((a, b) => b[1].points - a[1].points)[0] ?? null;
    const bestDayByBuyIn = [...dayEntries].sort((a, b) => b[1].buyIn - a[1].buyIn)[0] ?? null;
    const biggestJackpot = [...w2gRecords].sort((a, b) => b.amount - a.amount)[0] ?? null;

    return { bestMonth, bestDayByCash, bestDayByPoints, bestDayByBuyIn, biggestJackpot, hasSessionData: sessions.length > 0 };
  }, [sessions, w2gRecords]);

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {historyInsightsDrill.element}
      <View style={styles.section}>
        {renderScreenHeader('History & Insights', 'Dive into your casino history, trends, and performance insights.')}
      </View>

      <View style={styles.section}>
        <View style={styles.valueHeroGrid}>
          {[
            {
              key: 'historicalPoints',
              label: 'Historical Casino Points',
              value: formatNumber(historicalPoints),
              subLabel: 'All Time',
              color: CASINO_DASHBOARD_COLORS.orange,
              drill: (): CalculationDrillDownData => ({
                title: 'Historical Casino Points',
                summary: `${formatNumber(historicalPoints)} total Club Royale points earned across your casino history.`,
                formula: 'Historical Casino Points = Sum of points earned on every completed cruise',
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatNumber(row.points), confidence: row.calculationConfidence === 'actual' ? 'verified-invoice' : 'estimated-default' })),
              }),
            },
            {
              key: 'completedCruises',
              label: 'Completed Cruises',
              value: String(cruiseEconomicsSummary.totals.cruises),
              subLabel: 'All Time',
              color: CASINO_DASHBOARD_COLORS.royalBlue,
              drill: (): CalculationDrillDownData => ({
                title: 'Completed Cruises',
                summary: `${cruiseEconomicsSummary.totals.cruises} completed cruise(s) with casino results on file.`,
                sourceRecords: cruiseEconomicsSummary.rows.map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: `${row.nights}N` })),
              }),
            },
            {
              key: 'totalWinLoss',
              label: 'Total Win / Loss',
              value: formatSignedCurrencyDetailed(cruiseEconomicsSummary.totals.totalWinningsHome),
              subLabel: 'All Time',
              color: casinoValueColor(cruiseEconomicsSummary.totals.totalWinningsHome),
              drill: (): CalculationDrillDownData => ({
                title: 'Total Win / Loss',
                summary: 'Casino winnings brought home, summed across every completed cruise.',
                formula: 'Total Win / Loss = Sum of winnings brought home per cruise',
                sourceRecords: cruiseEconomicsSummary.rows.slice(0, 6).map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatSignedCurrencyDetailed(row.winningsHome) })),
              }),
            },
            {
              key: 'bestShipPoints',
              label: 'Best Ship (Points)',
              value: bestShipByPoints ? bestShipByPoints.ship : '—',
              subLabel: bestShipByPoints ? `${formatNumber(bestShipByPoints.points)} pts` : 'Needs Data',
              color: CASINO_DASHBOARD_COLORS.teal,
              drill: (): CalculationDrillDownData => ({
                title: 'Best Ship (Points)',
                summary: bestShipByPoints ? `${bestShipByPoints.ship} leads with ${formatNumber(bestShipByPoints.points)} total points across ${bestShipByPoints.cruises} cruise(s).` : 'No ship data yet.',
                sourceRecords: shipPerformance.map((ship) => ({ label: ship.ship, value: formatNumber(ship.points) })),
                missing: !bestShipByPoints ? ['No completed cruises with points recorded yet.'] : [],
              }),
            },
            {
              key: 'bestShipWinLoss',
              label: 'Best Ship (Win/Loss)',
              value: bestShipByWinLoss ? bestShipByWinLoss.ship : '—',
              subLabel: bestShipByWinLoss ? formatSignedCurrencyDetailed(bestShipByWinLoss.cashResult) : 'Needs Data',
              color: CASINO_DASHBOARD_COLORS.green,
              drill: (): CalculationDrillDownData => ({
                title: 'Best Ship (Win/Loss)',
                summary: bestShipByWinLoss ? `${bestShipByWinLoss.ship} has your best cash result at ${formatSignedCurrencyDetailed(bestShipByWinLoss.cashResult)}.` : 'No ship data yet.',
                sourceRecords: shipPerformance.map((ship) => ({ label: ship.ship, value: formatSignedCurrencyDetailed(ship.cashResult) })),
                missing: !bestShipByWinLoss ? ['No completed cruises with cash results recorded yet.'] : [],
              }),
            },
          ].map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[casinoDashboardStyles.card, styles.valueHeroTileV2]}
              activeOpacity={0.8}
              onPress={() => historyInsightsDrill.open(tile.drill())}
              testID={`history-insights-kpi-${tile.key}`}
            >
              <Text style={casinoDashboardStyles.cardLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 18, color: tile.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {tile.value}
              </Text>
              <Text style={styles.economicsSummaryLabel} numberOfLines={1}>{tile.subLabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={[
          styles.keepPlayingCard,
          keepPlayingRecommendation.verdict === 'keep-playing' ? styles.keepPlayingCardGood
            : keepPlayingRecommendation.verdict === 'watch-closely' ? styles.keepPlayingCardWatch
              : keepPlayingRecommendation.verdict === 'reassess' ? styles.keepPlayingCardReassess
                : styles.keepPlayingCardNeutral,
        ]}>
          <TouchableOpacity
            style={styles.keepPlayingTouchable}
            activeOpacity={0.8}
            onPress={() => showDetail('Keep-playing recommendation', [
              { label: 'Verdict', value: keepPlayingRecommendation.headline },
              { label: 'Recent avg cash result', value: formatSignedCurrencyDetailed(keepPlayingRecommendation.recentAvg) },
              { label: 'Earlier avg cash result', value: formatSignedCurrencyDetailed(keepPlayingRecommendation.earlierAvg) },
              { label: 'Method', value: 'Compares the most recent half of completed cruises to the earlier half by cash result (winnings minus paid).' },
            ])}
          >
            {keepPlayingRecommendation.verdict === 'keep-playing' ? <TrendingUp size={20} color={CASINO_DASHBOARD_COLORS.green} />
              : keepPlayingRecommendation.verdict === 'reassess' ? <TrendingDown size={20} color={CASINO_DASHBOARD_COLORS.red} />
                : <Activity size={20} color={CASINO_DASHBOARD_COLORS.orange} />}
            <View style={styles.keepPlayingTextBlock}>
              <Text style={styles.keepPlayingHeadline}>{keepPlayingRecommendation.headline}</Text>
              <Text style={styles.keepPlayingDetail} numberOfLines={3}>{keepPlayingRecommendation.detail}</Text>
            </View>
            <Info size={14} color={CASINO_DASHBOARD_COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {pointsByYearData.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={casinoDashboardStyles.card}
            activeOpacity={0.9}
            onPress={() => historyInsightsDrill.open({
              title: 'Historical Casino Points',
              subtitle: 'By Calendar Year',
              summary: 'Points earned on completed cruises, grouped by the calendar year they were sailed.',
              sourceRecords: pointsByYearData.map((y) => ({ label: y.year, value: formatNumber(y.points) })),
            })}
          >
            <Text style={styles.economicsTitle}>Historical Casino Points</Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>By Calendar Year — tap a bar or a year to see its cruises</Text>
            <View style={{ marginTop: 12 }}>
              <CasinoGroupedBarChart
                groups={pointsByYearData.map((y) => ({
                  key: y.year,
                  label: y.year,
                  bars: [{ key: 'points', value: y.points, color: CASINO_DASHBOARD_COLORS.royalBlue }],
                  onPress: () => historyInsightsDrill.open({
                    title: `${y.year} Casino Points`,
                    summary: `${formatNumber(y.points)} points earned across ${y.rows.length} cruise(s) sailed in ${y.year}.`,
                    sourceRecords: y.rows.map((row) => ({ label: `${row.ship} — ${row.sailDate}`, value: formatNumber(row.points) })),
                  }),
                }))}
                barLabels={[{ key: 'points', label: 'Casino Points', color: CASINO_DASHBOARD_COLORS.royalBlue }]}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {winLossHistoryData.length > 0 && (
        <View style={styles.section}>
          <View style={casinoDashboardStyles.card}>
            <Text style={styles.economicsTitle}>Win / Loss History</Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>All Time — tap a point for that cruise's numbers</Text>
            <View style={{ marginTop: 12 }}>
              <CasinoLineChart
                series={[{
                  key: 'winLoss',
                  label: 'Win / Loss',
                  color: CASINO_DASHBOARD_COLORS.green,
                  points: winLossHistoryData.map((row) => ({ x: row.sailDate.slice(5), y: row.winningsHome })),
                }]}
                onPointPress={(index) => {
                  const row = winLossHistoryData[index];
                  if (!row) return;
                  historyInsightsDrill.open({
                    title: `${row.ship} — ${row.sailDate}`,
                    summary: `Casino win/loss brought home on this cruise: ${formatSignedCurrencyDetailed(row.winningsHome)}.`,
                    sourceRecords: [{ label: 'Win / Loss', value: formatSignedCurrencyDetailed(row.winningsHome) }],
                  });
                }}
              />
            </View>
          </View>
        </View>
      )}

      {pointsPerNightChartData.length > 0 && (
        <View style={styles.section}>
          <View style={casinoDashboardStyles.card}>
            <Text style={styles.economicsTitle}>Points Per Night Trend</Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>All Time — tap a point for that sailing</Text>
            <View style={{ marginTop: 12 }}>
              <CasinoLineChart
                series={[{
                  key: 'pointsPerNight',
                  label: 'Points / Night',
                  color: CASINO_DASHBOARD_COLORS.purple,
                  points: pointsPerNightChartData.map((row) => ({ x: row.sailDate.slice(5), y: row.pointsPerNight })),
                }]}
                onPointPress={(index) => {
                  const row = pointsPerNightChartData[index];
                  if (!row) return;
                  historyInsightsDrill.open({
                    title: `${row.ship} — ${row.sailDate}`,
                    summary: `${row.pointsPerNight.toFixed(1)} points earned per night on this sailing.`,
                    sourceRecords: [{ label: 'Points / Night', value: row.pointsPerNight.toFixed(1) }],
                  });
                }}
              />
            </View>
          </View>
        </View>
      )}

      {shipPerformanceHistory.length > 0 && (
        <View style={styles.section}>
          <View style={casinoDashboardStyles.card}>
            <Text style={styles.economicsTitle}>Ship Performance History</Text>
            <Text style={casinoDashboardStyles.screenSubtitle}>Tap a ship for its full sailing-by-sailing history</Text>
            <View style={{ marginTop: 10 }}>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { flex: 1.4, fontWeight: '700' as const }]} numberOfLines={1}>Ship</Text>
                <Text style={[styles.economicsSummaryLabel, { width: 46, textAlign: 'right' }]}>Sail</Text>
                <Text style={[styles.economicsSummaryLabel, { width: 62, textAlign: 'right' }]}>Avg Pts</Text>
                <Text style={[styles.economicsSummaryLabel, { width: 74, textAlign: 'right' }]}>Net Out</Text>
              </View>
              {shipPerformanceHistory.map((ship) => (
                <TouchableOpacity
                  key={ship.ship}
                  style={styles.dataRow}
                  activeOpacity={0.75}
                  onPress={() => historyInsightsDrill.open({
                    title: ship.ship,
                    subtitle: `${ship.cruises} sailing(s)`,
                    summary: `Ship-level history aggregated from every completed cruise on ${ship.ship}.`,
                    sourceRecords: [
                      { label: 'Sailings', value: String(ship.cruises) },
                      { label: 'Avg Pts / Cruise', value: formatNumber(Math.round(ship.avgPointsPerCruise)) },
                      { label: 'Avg Win / Loss', value: formatSignedCurrencyDetailed(ship.avgWinLossPerCruise) },
                      { label: 'Avg Value / Cruise', value: formatSignedCurrencyDetailed(ship.avgValuePerCruise) },
                      { label: 'Net Make-Out', value: formatSignedCurrencyDetailed(ship.netMakeOut) },
                    ],
                  })}
                >
                  <Text style={[styles.dataLabel, { flex: 1.4 }]} numberOfLines={1}>{ship.ship}</Text>
                  <Text style={[styles.dataValue, { width: 46, textAlign: 'right', fontSize: 12.5 }]}>{ship.cruises}</Text>
                  <Text style={[styles.dataValue, { width: 62, textAlign: 'right', fontSize: 12.5 }]}>{formatNumber(Math.round(ship.avgPointsPerCruise))}</Text>
                  <Text style={[styles.dataValue, { width: 74, textAlign: 'right', fontSize: 12.5, color: ship.netMakeOut >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }]}>{formatSignedCurrencyDetailed(ship.netMakeOut)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {perCruisePointsBreakdown.length > 0 && (
        <View style={styles.section}>
          <View style={styles.cleanCard}>
            <View style={styles.cleanCardHeader}>
              <Award size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
              <Text style={styles.cleanCardTitle}>Historical Points &amp; Win/Loss Trends</Text>
            </View>
            <View style={styles.pointsBreakdownLegend}>
              <View style={styles.pointsBreakdownLegendItem}>
                <View style={[styles.pointsBreakdownLegendDot, { backgroundColor: CASINO_DASHBOARD_COLORS.orange }]} />
                <Text style={styles.pointsBreakdownLegendText}>Casino Points (Club Royale / Blue Chip)</Text>
              </View>
              <View style={styles.pointsBreakdownLegendItem}>
                <View style={[styles.pointsBreakdownLegendDot, { backgroundColor: CASINO_DASHBOARD_COLORS.brightBlue }]} />
                <Text style={styles.pointsBreakdownLegendText}>{"Cruise Loyalty (Crown & Anchor / Captain's Club)"}</Text>
              </View>
            </View>
            {perCruisePointsBreakdown.slice(0, showAllCruises ? 50 : 10).map((entry) => {
              const sailDate = createDateFromString(entry.sailDate);
              const dateStr = sailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
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
                      <View style={[styles.pointsBreakdownValueDot, { backgroundColor: CASINO_DASHBOARD_COLORS.orange }]} />
                      <Text style={styles.pointsBreakdownValueLabel}>{entry.casinoLabel}</Text>
                      <Text style={[styles.pointsBreakdownValue, { color: CASINO_DASHBOARD_COLORS.goldText }]}>{formatNumber(entry.casinoPoints)}</Text>
                    </View>
                    <View style={styles.pointsBreakdownValueRow}>
                      <View style={[styles.pointsBreakdownValueDot, { backgroundColor: CASINO_DASHBOARD_COLORS.brightBlue }]} />
                      <Text style={styles.pointsBreakdownValueLabel}>{entry.loyaltyLabel}</Text>
                      <Text style={[styles.pointsBreakdownValue, { color: CASINO_DASHBOARD_COLORS.brightBlue }]}>{formatNumber(entry.loyaltyPoints)}</Text>
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
                  color={CASINO_DASHBOARD_COLORS.textPrimary}
                  style={{ transform: [{ rotate: showAllCruises ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {pointsPerNightTrend.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
            <Text style={styles.sectionTitle}>Points-per-Night Trend</Text>
          </View>
          <View style={styles.cleanCard}>
            {pointsPerNightTrend.map((entry, index) => {
              const previous = pointsPerNightTrend[index - 1];
              const delta = previous ? entry.pointsPerNight - previous.pointsPerNight : 0;
              return (
                <View key={entry.id} style={[styles.dataRow, index === pointsPerNightTrend.length - 1 && { paddingBottom: 0 }]}>
                  <Text style={styles.dataLabel} numberOfLines={1}>{entry.ship} · {entry.sailDate}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.dataValue}>{entry.pointsPerNight.toFixed(1)}/night</Text>
                    {index > 0 && (delta >= 0
                      ? <TrendingUp size={13} color={CASINO_DASHBOARD_COLORS.green} />
                      : <TrendingDown size={13} color={CASINO_DASHBOARD_COLORS.red} />)}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Insights Overview</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>Why EasySeas picked each one — tap any row for the full comparison</Text>
          {[
            {
              key: 'bestMonth',
              label: 'Best Month',
              value: historyInsightsOverview.bestMonth ? formatMonthLabel(historyInsightsOverview.bestMonth[0]) : 'Needs Data',
              detail: historyInsightsOverview.bestMonth ? formatSignedCurrencyDetailed(historyInsightsOverview.bestMonth[1].cashResult) : 'No sessions logged yet',
              color: historyInsightsOverview.bestMonth ? casinoValueColor(historyInsightsOverview.bestMonth[1].cashResult) : undefined,
              why: 'Sessions are grouped by calendar month, and the month with the highest total cash result (win/loss) wins.',
            },
            {
              key: 'bestDay',
              label: 'Best Day',
              value: historyInsightsOverview.bestDayByCash ? historyInsightsOverview.bestDayByCash[0] : 'Needs Data',
              detail: historyInsightsOverview.bestDayByCash ? formatSignedCurrencyDetailed(historyInsightsOverview.bestDayByCash[1].cashResult) : 'No sessions logged yet',
              color: historyInsightsOverview.bestDayByCash ? casinoValueColor(historyInsightsOverview.bestDayByCash[1].cashResult) : undefined,
              why: 'Every session is grouped by calendar day; the single day with the highest total cash result (win/loss) wins.',
            },
            {
              key: 'mostPoints',
              label: 'Most Points in a Day',
              value: historyInsightsOverview.bestDayByPoints ? `${formatNumber(historyInsightsOverview.bestDayByPoints[1].points)} pts` : 'Needs Data',
              detail: historyInsightsOverview.bestDayByPoints ? historyInsightsOverview.bestDayByPoints[0] : 'No sessions logged yet',
              why: 'Every session is grouped by calendar day; the single day with the most total points earned wins — tracked separately from "Best Day" above, which ranks by cash result instead of points.',
            },
            {
              key: 'biggestJackpot',
              label: 'Biggest Jackpot (W2G)',
              value: historyInsightsOverview.biggestJackpot ? formatCurrencyDetailed(historyInsightsOverview.biggestJackpot.amount) : 'Needs Data',
              detail: historyInsightsOverview.biggestJackpot ? historyInsightsOverview.biggestJackpot.date : 'No W2G records entered yet',
              why: 'Compares the amount field on every W2G record you\'ve entered; the largest single jackpot wins.',
            },
            {
              key: 'mostBuyIn',
              label: 'Most Coin-in in a Day',
              value: historyInsightsOverview.bestDayByBuyIn ? formatCurrencyDetailed(historyInsightsOverview.bestDayByBuyIn[1].buyIn) : 'Needs Data',
              detail: historyInsightsOverview.bestDayByBuyIn ? historyInsightsOverview.bestDayByBuyIn[0] : 'No session buy-in recorded yet',
              why: 'Coin-in is estimated from the buy-in total you logged per session on that day; EasySeas doesn\'t track machine-metered coin-in directly.',
            },
          ].map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.dataRow}
              activeOpacity={0.75}
              onPress={() => historyInsightsDrill.open({
                title: row.label,
                summary: row.why,
                inputs: [{ label: row.label, value: row.value }, { label: 'Context', value: row.detail }],
                missing: row.value === 'Needs Data' ? ['Not enough logged session or W2G data yet to determine this.'] : [],
              })}
            >
              <Text style={styles.dataLabel} numberOfLines={1}>{row.label}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.dataValue, row.color ? { color: row.color } : null]}>{row.value}</Text>
                <Text style={styles.economicsSummaryLabel} numberOfLines={1}>{row.detail}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.viewMoreButton}
            activeOpacity={0.7}
            onPress={() => historyInsightsDrill.open({
              title: 'All Insights',
              summary: 'Every insight EasySeas currently tracks from your session, ship, and jackpot history, gathered in one place.',
              sourceRecords: [
                { label: 'Best Month', value: historyInsightsOverview.bestMonth ? `${formatMonthLabel(historyInsightsOverview.bestMonth[0])} — ${formatSignedCurrencyDetailed(historyInsightsOverview.bestMonth[1].cashResult)}` : 'Needs Data' },
                { label: 'Best Day', value: historyInsightsOverview.bestDayByCash ? `${historyInsightsOverview.bestDayByCash[0]} — ${formatSignedCurrencyDetailed(historyInsightsOverview.bestDayByCash[1].cashResult)}` : 'Needs Data' },
                { label: 'Most Points in a Day', value: historyInsightsOverview.bestDayByPoints ? `${historyInsightsOverview.bestDayByPoints[0]} — ${formatNumber(historyInsightsOverview.bestDayByPoints[1].points)} pts` : 'Needs Data' },
                { label: 'Biggest Jackpot (W2G)', value: historyInsightsOverview.biggestJackpot ? `${historyInsightsOverview.biggestJackpot.date} — ${formatCurrencyDetailed(historyInsightsOverview.biggestJackpot.amount)}` : 'Needs Data' },
                { label: 'Most Coin-in in a Day', value: historyInsightsOverview.bestDayByBuyIn ? `${historyInsightsOverview.bestDayByBuyIn[0]} — ${formatCurrencyDetailed(historyInsightsOverview.bestDayByBuyIn[1].buyIn)}` : 'Needs Data' },
                { label: 'Best Ship (Points)', value: bestShipByPoints ? `${bestShipByPoints.ship} — ${formatNumber(bestShipByPoints.points)} pts` : 'Needs Data' },
                { label: 'Best Ship (Win/Loss)', value: bestShipByWinLoss ? `${bestShipByWinLoss.ship} — ${formatSignedCurrencyDetailed(bestShipByWinLoss.cashResult)}` : 'Needs Data' },
              ],
            })}
          >
            <Text style={styles.viewMoreText}>View All Insights</Text>
            <ChevronDown size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
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

      <View style={styles.section}>
        {renderScreenHeader('Simulator', 'Plan different scenarios and see the impact on your goals and value.')}
      </View>

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Quick Presets</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>Seeded from your own real historical averages, not made-up numbers.</Text>
          <View style={[styles.valueHeroGrid, { marginTop: 12 }]}>
            {simulatorPresets.map((preset) => {
              const isActive = simulatorPresetKey === preset.key;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.simulatorPresetPill, isActive && styles.simulatorPresetPillActive]}
                  activeOpacity={0.8}
                  onPress={() => setSimulatorPresetKey(preset.key)}
                  testID={`simulator-preset-${preset.key}`}
                >
                  <Text style={[styles.simulatorPresetLabel, isActive && styles.simulatorPresetLabelActive]}>{preset.label}</Text>
                  <Text style={[styles.simulatorPresetValue, isActive && styles.simulatorPresetLabelActive]}>{formatCurrencyDetailed(preset.monthlyCoinIn)}/mo</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Results Summary (5 Year Projection)</Text>
          <View style={[styles.valueHeroGrid, { marginTop: 12 }]}>
            {simulatorResultTiles.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[casinoDashboardStyles.card, styles.valueHeroTileV2]}
                activeOpacity={0.8}
                onPress={() => historyInsightsDrill.open(item.drill())}
                testID={`simulator-result-${item.key}`}
              >
                <Text style={casinoDashboardStyles.cardLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={[casinoDashboardStyles.bigNumber, { fontSize: 18, color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Point Progression</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>Current Path vs. your selected scenario, over 5 years — tap a year for the breakdown</Text>
          <View style={{ marginTop: 12 }}>
            <CasinoLineChart
              series={[
                { key: 'currentPath', label: 'Current Path', color: CASINO_DASHBOARD_COLORS.royalBlue, points: pointProgressionData.years.map((y) => ({ x: y.label, y: y.currentPath })) },
                { key: 'scenario', label: `Scenario (${pointProgressionData.activePresetLabel})`, color: CASINO_DASHBOARD_COLORS.teal, points: pointProgressionData.years.map((y) => ({ x: y.label, y: y.scenario })) },
              ]}
              referenceLines={[
                { key: 'signature', label: 'Signature target', value: CLUB_ROYALE_TIERS.Signature.threshold, color: CASINO_DASHBOARD_COLORS.purple },
                { key: 'masters', label: 'Masters target', value: CLUB_ROYALE_TIERS.Masters.threshold, color: CASINO_DASHBOARD_COLORS.orange },
              ]}
              valueFormatter={(v) => formatNumber(v)}
              onPointPress={(index) => {
                const y = pointProgressionData.years[index];
                if (!y) return;
                historyInsightsDrill.open({
                  title: `${y.label} Projection`,
                  summary: 'Current Path assumes your real historical pace continues unchanged. Scenario applies your selected preset\'s monthly coin-in.',
                  formula: 'Projected Points = Starting points + (yearly point rate × years elapsed)',
                  sourceRecords: [
                    { label: 'Current Path', value: formatNumber(y.currentPath) },
                    { label: `Scenario (${pointProgressionData.activePresetLabel})`, value: formatNumber(y.scenario) },
                  ],
                  inputs: [
                    { label: 'Current Path yearly rate', value: `${formatNumber(Math.round(pointProgressionData.currentPathYearlyPoints))} pts/yr` },
                    { label: 'Scenario yearly rate', value: `${formatNumber(Math.round(pointProgressionData.scenarioYearlyPoints))} pts/yr` },
                  ],
                });
              }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={casinoDashboardStyles.card}>
          <Text style={styles.economicsTitle}>Scenario Comparison</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>5-year projection — tap a row to see how each column was calculated</Text>
          <View style={{ marginTop: 10 }}>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { flex: 1.1, fontWeight: '700' as const }]} numberOfLines={1}>Metric</Text>
              <Text style={[styles.economicsSummaryLabel, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>Current Path</Text>
              <Text style={[styles.economicsSummaryLabel, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>Scenario A</Text>
              <Text style={[styles.economicsSummaryLabel, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>Scenario B</Text>
            </View>
            {scenarioComparisonData.rows.map((row) => (
              <TouchableOpacity
                key={row.metric}
                style={styles.dataRow}
                activeOpacity={0.75}
                onPress={() => historyInsightsDrill.open({
                  title: row.metric,
                  summary: `How ${row.metric.toLowerCase()} was calculated for each scenario over a 5-year projection.`,
                  sourceRecords: [
                    { label: 'Current Path (Stay the Course)', value: row.currentPath },
                    { label: scenarioComparisonData.scenarioALabel, value: row.scenarioA },
                    { label: scenarioComparisonData.scenarioBLabel, value: row.scenarioB },
                  ],
                })}
              >
                <Text style={[styles.dataLabel, { flex: 1.1 }]} numberOfLines={1}>{row.metric}</Text>
                <Text style={[styles.dataValue, { flex: 1, textAlign: 'right', fontSize: 12 }]} numberOfLines={1}>{row.currentPath}</Text>
                <Text style={[styles.dataValue, { flex: 1, textAlign: 'right', fontSize: 12 }]} numberOfLines={1}>{row.scenarioA}</Text>
                <Text style={[styles.dataValue, { flex: 1, textAlign: 'right', fontSize: 12 }]} numberOfLines={1}>{row.scenarioB}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.calcsHeader}>
          <View style={styles.calcsHeaderContent}>
            <View style={[styles.calcsHeaderIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Calculator size={20} color={CASINO_DASHBOARD_COLORS.purple} />
            </View>
            <View style={styles.calcsHeaderText}>
              <Text style={styles.calcsHeaderTitle}>What-If Simulator</Text>
              <Text style={styles.calcsHeaderSubtitle}>Coin-In stays gaming-only; value uses cash + cruise economics</Text>
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
              <Dices size={13} color={calcsMode === 'per-session' ? COLORS.white : CASINO_DASHBOARD_COLORS.textPrimary} />
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
              <Ship size={13} color={calcsMode === 'historical' ? COLORS.white : CASINO_DASHBOARD_COLORS.textPrimary} />
              <Text style={[
                styles.calcsModeToggleText,
                calcsMode === 'historical' && styles.calcsModeToggleTextActive,
              ]}>Historical</Text>
            </TouchableOpacity>
          </View>

          {calcsMode === 'historical' && cruiseEconomicsSummary.totals.cruises > 0 && (
            <View style={styles.calcsModeSummary}>
              <Text style={styles.calcsModeSummaryText}>
                Historical: {formatNumber(cruiseEconomicsSummary.totals.totalPoints)} pts ({formatCurrency(cruiseEconomicsSummary.totals.totalCoinIn)} coin-in volume) • Current season: {formatNumber(currentYearPoints)} pts ({formatNumber(currentSeasonMetrics.pointsNeededForSignature)} to retain Signature) • Status: {clubRoyaleTier} • {realAnalytics.completedCashResult >= 0 ? '+' : ''}{formatCurrency(realAnalytics.completedCashResult)} cash result • {cruiseEconomicsSummary.totals.cruises} cruises
              </Text>
            </View>
          )}
        </View>

        <View style={styles.calcsGrid}>
          {highValueCalculations.map((calc) => (
            <TouchableOpacity
              key={calc.id}
              style={styles.calcCard}
              activeOpacity={0.8}
              onPress={() => showDetail(calc.label, [
                { label: 'Value', value: calc.value },
                { label: 'How it\'s calculated', value: calc.description },
              ])}
            >
              <View style={[styles.calcIconContainer, { backgroundColor: `${calc.color}15` }]}>
                <calc.icon size={20} color={calc.color} />
              </View>
              <View style={styles.calcContent}>
                <Text style={styles.calcLabel}>{calc.label}</Text>
                <Text style={[styles.calcValue, { color: calc.color }]}>{calc.value}</Text>
                <Text style={styles.calcDescription}>{calc.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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

      <View style={styles.section}>
        <SessionsSummaryCard
          analytics={sessionAnalytics}
          sessions={sessions}
          targetPPH={targetPPH}
        />
      </View>

      <View style={styles.section}>
        <View style={[styles.alertsBanner, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
          <View style={styles.alertsIconContainer}>
            <Calendar size={20} color={CASINO_DASHBOARD_COLORS.textPrimary} />
          </View>
          <View style={styles.alertsContent}>
            <Text style={[styles.alertsTitle, { color: CASINO_DASHBOARD_COLORS.textPrimary }]}>Calculate Past Sessions</Text>
            <Text style={[styles.alertsDescription, { color: CASINO_DASHBOARD_COLORS.textPrimary, opacity: 0.7 }]}>
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
        <GamificationCard compact={false} showAchievements={false} />
      </View>

      <View style={styles.sessionStatsSection}>
        <View style={styles.sectionHeader}>
          <Dices size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
              { color: sessionAnalytics.netWinLoss >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }
            ]}>
              {sessionAnalytics.netWinLoss >= 0 ? '+' : ''}{formatCurrency(sessionAnalytics.netWinLoss)}
            </Text>
          </View>
          <View style={styles.sessionHistoryDivider} />
          <View style={styles.sessionHistoryRow}>
            <Text style={styles.sessionHistoryLabel}>Win Rate</Text>
            <Text style={[
              styles.sessionHistoryValue,
              { color: sessionAnalytics.winRate >= 50 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }
            ]}>
              {sessionAnalytics.winRate.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {sessions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
                      { backgroundColor: (session.winLoss || 0) >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }
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
                          { color: session.winLoss >= 0 ? CASINO_DASHBOARD_COLORS.green : CASINO_DASHBOARD_COLORS.red }
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

      <View style={styles.section}>
        <W2GTracker
          records={w2gRecords}
          onAddRecord={addW2GRecord}
          onRemoveRecord={removeW2GRecord}
        />
      </View>

      <View style={styles.calcsInsightCard}>
        <View style={styles.calcsInsightHeader}>
          <Brain size={18} color={CASINO_DASHBOARD_COLORS.textPrimary} />
          <Text style={styles.calcsInsightTitle}>Calculation Insights</Text>
        </View>
        <Text style={styles.calcsInsightText}>
          These calculations provide deeper understanding of your casino play patterns and efficiency.
          High sustainability scores (70+) indicate stable offer patterns, while ADT smoothing factors
          below 0.3 suggest consistent play distribution.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, flexDirection: 'row' }}>
      {showSidebar && (
        <CasinoSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOverviewPress={() => router.push('/(tabs)/(overview)')}
          onSettingsPress={() => router.push('/(tabs)/settings')}
          clubRoyaleTier={clubRoyaleTier}
          clubRoyalePoints={currentYearPoints}
          tierProgressPct={tierGoalsProgress.signaturePct}
          tierProgressLabel={`${formatNumber(tierGoalsProgress.pointsToSignature)} pts until Signature`}
          onStatusPress={() => showDetail('Club Royale Status', [
            { label: 'Current tier', value: clubRoyaleTier },
            { label: 'Current-season points', value: formatNumber(currentYearPoints) },
            { label: 'Tier year ends', value: clubRoyaleNextResetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) },
            { label: 'Points to Signature', value: formatNumber(tierGoalsProgress.pointsToSignature) },
            { label: 'Avg pts/day needed', value: formatNumber(Math.round(tierGoalsProgress.avgPtsPerDayForSignature)) },
            { label: 'Historical all-time points', value: formatNumber(historicalPoints) },
          ], 'Tap a Casino Portfolio tier bar for the full formula and source records.')}
        />
      )}
      <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ResponsiveContainer>
          <View style={styles.header}>
            <View style={styles.brandingRow}>
              <View style={styles.titleContainer}>
                <BarChart3 size={22} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
              style={[styles.tabButton, activeTab === 'portfolio' && styles.tabButtonActive]}
              onPress={() => setActiveTab('portfolio')}
              activeOpacity={0.7}
            >
              <Award size={14} color={activeTab === 'portfolio' ? COLORS.white : CASINO_DASHBOARD_COLORS.textSecondary} />
              <Text style={[styles.tabButtonText, activeTab === 'portfolio' && styles.tabButtonTextActive]}>
                Portfolio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'value' && styles.tabButtonActive]}
              onPress={() => setActiveTab('value')}
              activeOpacity={0.7}
            >
              <DollarSign size={14} color={activeTab === 'value' ? COLORS.white : CASINO_DASHBOARD_COLORS.textSecondary} />
              <Text style={[styles.tabButtonText, activeTab === 'value' && styles.tabButtonTextActive]}>
                Value
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'action' && styles.tabButtonActive]}
              onPress={() => setActiveTab('action')}
              activeOpacity={0.7}
            >
              <Zap size={14} color={activeTab === 'action' ? COLORS.white : CASINO_DASHBOARD_COLORS.textSecondary} />
              <Text style={[styles.tabButtonText, activeTab === 'action' && styles.tabButtonTextActive]}>
                Action
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
              onPress={() => setActiveTab('history')}
              activeOpacity={0.7}
            >
              <LineChart size={14} color={activeTab === 'history' ? COLORS.white : CASINO_DASHBOARD_COLORS.textSecondary} />
              <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
                History
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
              tintColor={CASINO_DASHBOARD_COLORS.textPrimary}
              colors={[CASINO_DASHBOARD_COLORS.textPrimary]}
            />
          }
        >
          <ResponsiveContainer>
            {!isScreenReady ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={CASINO_DASHBOARD_COLORS.textPrimary} />
              </View>
            ) : (
              <>
                {activeTab === 'portfolio' && renderPortfolioTab()}
                {activeTab === 'value' && renderValueTab()}
                {activeTab === 'action' && renderActionTab()}
                {activeTab === 'history' && renderHistoryTab()}
              </>
            )}

            {realAnalytics.totalCruises === 0 && !storeLoading && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <BarChart3 size={56} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
      </View>
      </View>

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
                <X size={18} color={CASINO_DASHBOARD_COLORS.textPrimary} />
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
                    placeholderTextColor={CASINO_DASHBOARD_COLORS.textMuted}
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
                    placeholderTextColor={CASINO_DASHBOARD_COLORS.textMuted}
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
                  <Ticket size={18} color={performanceForm.instantCertificateWon ? CASINO_DASHBOARD_COLORS.white : CASINO_DASHBOARD_COLORS.green} />
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
                      placeholderTextColor={CASINO_DASHBOARD_COLORS.textMuted}
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
                      placeholderTextColor={CASINO_DASHBOARD_COLORS.textMuted}
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
                      placeholderTextColor={CASINO_DASHBOARD_COLORS.textMuted}
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

      <Modal
        visible={Boolean(detailModal)}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.detailModalOverlay}>
          <TouchableOpacity style={styles.detailModalBackdrop} activeOpacity={1} onPress={closeDetail} />
          <View style={styles.detailModalCard}>
            <View style={styles.detailModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailModalTitle} numberOfLines={2}>{detailModal?.title}</Text>
                {detailModal?.subtitle ? (
                  <Text style={styles.detailModalSubtitle}>{detailModal.subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.detailModalCloseIcon} onPress={closeDetail} activeOpacity={0.7}>
                <X size={16} color={CASINO_DASHBOARD_COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {detailModal?.rows.map((row, index) => (
                <View key={`${row.label}-${index}`} style={[styles.detailModalRow, index === (detailModal?.rows.length ?? 0) - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailModalRowLabel}>{row.label}</Text>
                  <Text style={styles.detailModalRowValue}>{row.value}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.detailModalCloseButton} activeOpacity={0.85} onPress={closeDetail}>
              <Text style={styles.detailModalCloseButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_DASHBOARD_COLORS.background,
  },
  screenBackgroundAccent: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  goalProgressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: CASINO_DASHBOARD_COLORS.border,
    overflow: 'hidden',
    marginTop: 8,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  quickStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 10,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  cleanCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  cleanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  cleanCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  dataGrid: {
    gap: SPACING.xs,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: 8,
  },
  dataLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  dataValue: {
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  avgStatsRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: CASINO_DASHBOARD_COLORS.border,
  },
  avgStatText: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textAlign: 'center',
  },
  discrepancyNotice: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(240, 180, 41, 0.12)',
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.gold,
  },
  discrepancyTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.goldText,
    marginBottom: 2,
  },
  discrepancyText: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.goldText,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(240, 180, 41, 0.15)',
    borderColor: CASINO_DASHBOARD_COLORS.gold,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: CASINO_DASHBOARD_COLORS.goldText,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  tabContent: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  screenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  screenHeaderTextCol: {
    flex: 1,
  },
  dataAsOfText: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    marginBottom: 6,
    textAlign: 'right',
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
  },
  syncNowButtonText: {
    fontSize: 11.5,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.royalBlue,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  portfolioTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  exportButtonText: {
    fontSize: 12,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  filterTabActive: {
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
    borderColor: CASINO_DASHBOARD_COLORS.royalBlue,
  },
  filterTabText: {
    fontSize: 12,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },
  portfolioList: {
    gap: SPACING.sm,
    width: '100%',
    overflow: 'hidden',
  },
  portfolioLimitNotice: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  portfolioLimitText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    fontStyle: 'italic' as const,
  },
  portfolioHintText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: -4,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  portfolioCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  portfolioImageContainer: {
    position: 'relative',
    width: 72,
    minHeight: 130,
    flexShrink: 0,
  },
  portfolioCardImage: {
    width: 72,
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
    minWidth: 0,
    padding: SPACING.sm,
    paddingRight: SPACING.sm,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginBottom: 2,
  },
  portfolioCardDestination: {
    fontSize: 12,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
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
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  portfolioCardNights: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.skyBlue,
    backgroundColor: 'rgba(79, 141, 255, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  portfolioCardMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    rowGap: 4,
  },
  portfolioMetric: {
    alignItems: 'center',
    width: '48%',
    minWidth: 0,
  },
  portfolioMetricLabel: {
    fontSize: 9,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginBottom: 1,
  },
  portfolioMetricValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    flexShrink: 1,
  },
  portfolioCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  portfolioCardCabin: {
    fontSize: 10,
    color: CASINO_DASHBOARD_COLORS.skyBlue,
    backgroundColor: 'rgba(79, 141, 255, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portfolioOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(240, 180, 41, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portfolioOfferCode: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.goldText,
  },
  portfolioCertificateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(51, 199, 126, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(51, 199, 126, 0.35)',
  },
  portfolioCertificateText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.green,
  },
  portfolioEditButton: {
    backgroundColor: 'rgba(240, 180, 41, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  portfolioEditButtonText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.goldText,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  viewMoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  emptyPortfolio: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  emptyPortfolioText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  destinationsCard: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.md,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  destinationRankTop: {
    backgroundColor: CASINO_DASHBOARD_COLORS.gold,
  },
  rankNumber: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  rankNumberTop: {
    color: CASINO_DASHBOARD_COLORS.background,
  },
  destinationBadge: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  destinationValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 120,
  },
  sessionStatsSection: {
    marginBottom: SPACING.lg,
  },
  sessionHistoryCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  sessionHistoryValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  sessionHistoryDivider: {
    height: 1,
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    marginVertical: SPACING.xs,
  },
  recentSessionsScrollContainer: {
    maxHeight: 400,
  },
  recentSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    ...SHADOW.sm,
  },
  sortLabelText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  recentSessionIndicator: {
    width: 3,
    height: 32,
    backgroundColor: CASINO_DASHBOARD_COLORS.green,
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  recentSessionContent: {
    flex: 1,
  },
  recentSessionDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  recentSessionTime: {
    fontSize: 10,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 1,
  },
  recentSessionNotes: {
    fontSize: 10,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
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
    color: CASINO_DASHBOARD_COLORS.green,
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
    color: CASINO_DASHBOARD_COLORS.purple,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  recentSessionPPH: {
    fontSize: 9,
    color: CASINO_DASHBOARD_COLORS.orange,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    ...SHADOW.sm,
  },
  alertsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
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
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
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
    borderColor: CASINO_DASHBOARD_COLORS.gold,
  },
  regenerateButtonText: {
    color: CASINO_DASHBOARD_COLORS.gold,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  calcsHeader: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: CASINO_DASHBOARD_COLORS.purple,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  calcsHeaderSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  calcsModeToggleContainer: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  calcsModeToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    color: CASINO_DASHBOARD_COLORS.purple,
    textAlign: 'center',
    lineHeight: 16,
  },
  calcsGrid: {
    gap: SPACING.sm,
  },
  calcCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginBottom: 4,
  },
  calcValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 4,
  },
  calcDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    lineHeight: 16,
  },
  calcsInsightCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    marginBottom: SPACING.lg,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  calcsInsightText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    lineHeight: 20,
  },
  pointsBreakdownLegend: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.cardAlt,
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
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  pointsBreakdownRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.cardAlt,
  },
  pointsBreakdownShipCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  pointsBreakdownShipName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  pointsBreakdownDate: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
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
    color: CASINO_DASHBOARD_COLORS.textMuted,
    minWidth: 80,
  },
  pointsBreakdownValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  economicsCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  economicsHeroStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsHeroStatLabel: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 4,
  },
  economicsTableContent: {
    paddingBottom: SPACING.sm,
  },
  economicsTable: {
    minWidth: 1040,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
  },
  economicsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  economicsHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.cardAlt,
  },
  economicsTableRowLast: {
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  economicsTotalsRow: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderTopWidth: 1,
    borderTopColor: CASINO_DASHBOARD_COLORS.borderStrong,
    borderBottomWidth: 0,
  },
  economicsCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsDateCell: {
    width: 98,
  },
  economicsShipCell: {
    width: 190,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsPositiveValue: {
    color: CASINO_DASHBOARD_COLORS.green,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  economicsNegativeValue: {
    color: CASINO_DASHBOARD_COLORS.red,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.borderStrong,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  performanceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  performanceModalTitleBlock: {
    flex: 1,
    marginRight: SPACING.md,
  },
  performanceModalEyebrow: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  performanceModalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  performanceModalSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 3,
  },
  performanceCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  performanceTextInput: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.borderStrong,
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  performanceNotesInput: {
    minHeight: 92,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    lineHeight: 20,
  },
  performanceInputHint: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  certificateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(51, 199, 126, 0.22)',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  certificateToggleActive: {
    backgroundColor: 'rgba(51, 199, 126, 0.14)',
    borderColor: CASINO_DASHBOARD_COLORS.green,
  },
  certificateToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51, 199, 126, 0.22)',
  },
  certificateToggleIconActive: {
    backgroundColor: CASINO_DASHBOARD_COLORS.green,
  },
  certificateToggleTextBlock: {
    flex: 1,
  },
  certificateToggleTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  certificateToggleSubtitle: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  certificateTogglePill: {
    minWidth: 42,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: CASINO_DASHBOARD_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  certificateTogglePillActive: {
    backgroundColor: CASINO_DASHBOARD_COLORS.green,
  },
  certificateTogglePillText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  certificateTogglePillTextActive: {
    color: COLORS.white,
  },
  certificateDetailsCard: {
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(51, 199, 126, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(51, 199, 126, 0.3)',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  performanceModalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: CASINO_DASHBOARD_COLORS.border,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
  },
  performanceCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
  },
  performanceCancelText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  performanceSaveButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  economicsSummaryLabel: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  economicsSummaryValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginTop: 4,
  },
  economicsSnapshotsList: {
    gap: SPACING.sm,
  },
  economicsSnapshotCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
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
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsSnapshotValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  economicsSnapshotShip: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginTop: 6,
  },
  economicsSnapshotDetail: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  valueHeroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  valueHeroTile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    gap: 2,
  },
  valueHeroTileV2: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 4,
  },
  simulatorPresetPill: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    backgroundColor: CASINO_DASHBOARD_COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  simulatorPresetPillActive: {
    borderColor: CASINO_DASHBOARD_COLORS.royalBlue,
    backgroundColor: 'rgba(0, 82, 204, 0.08)',
  },
  simulatorPresetLabel: {
    fontSize: 12.5,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
  simulatorPresetLabelActive: {
    color: CASINO_DASHBOARD_COLORS.royalBlue,
  },
  simulatorPresetValue: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    fontWeight: '600' as const,
  },
  valueHeroLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valueHeroValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  shipCard: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  shipCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  shipCardName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  shipCardBadge: {
    backgroundColor: 'rgba(240, 180, 41, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  shipCardBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.goldText,
  },
  shipMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  shipMetric: {
    minWidth: 70,
  },
  shipMetricLabel: {
    fontSize: 10,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  shipMetricValue: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    marginTop: 1,
  },
  dataHealthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
  },
  dataHealthCardGood: {
    backgroundColor: 'rgba(51, 199, 126, 0.12)',
    borderColor: CASINO_DASHBOARD_COLORS.green,
  },
  dataHealthCardWarning: {
    backgroundColor: 'rgba(240, 180, 41, 0.12)',
    borderColor: CASINO_DASHBOARD_COLORS.gold,
  },
  dataHealthTextBlock: {
    flex: 1,
  },
  dataHealthTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  dataHealthSubtitle: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    ...SHADOW.sm,
  },
  actionRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRowContent: {
    flex: 1,
    minWidth: 0,
  },
  actionRowTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  actionRowSubtitle: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  actionRowBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  actionRowBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.cardAlt,
  },
  checklistTextBlock: {
    flex: 1,
  },
  checklistText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  checklistTextDone: {
    color: CASINO_DASHBOARD_COLORS.textSecondary,
  },
  checklistDetail: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  keepPlayingCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  keepPlayingCardGood: {
    backgroundColor: 'rgba(51, 199, 126, 0.14)',
    borderColor: CASINO_DASHBOARD_COLORS.green,
  },
  keepPlayingCardWatch: {
    backgroundColor: 'rgba(240, 180, 41, 0.14)',
    borderColor: CASINO_DASHBOARD_COLORS.orange,
  },
  keepPlayingCardReassess: {
    backgroundColor: 'rgba(240, 84, 106, 0.12)',
    borderColor: CASINO_DASHBOARD_COLORS.red,
  },
  keepPlayingCardNeutral: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderColor: CASINO_DASHBOARD_COLORS.border,
  },
  keepPlayingTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  keepPlayingTextBlock: {
    flex: 1,
  },
  keepPlayingHeadline: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  keepPlayingDetail: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  detailModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  detailModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailModalTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
  },
  detailModalSubtitle: {
    fontSize: 12,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  detailModalCloseIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.cardAlt,
    gap: 3,
  },
  detailModalRowLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailModalRowValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    lineHeight: 19,
  },
  detailModalCloseButton: {
    marginTop: SPACING.md,
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailModalCloseButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
