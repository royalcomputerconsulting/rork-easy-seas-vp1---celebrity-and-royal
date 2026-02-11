import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { formatCurrency, formatNumber } from '@/lib/format';
import { calculateCruiseValue, calculatePortfolioValue } from '@/lib/valueCalculator';
import { createDateFromString } from '@/lib/date';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { 
  CLUB_ROYALE_TIERS, 
  getTierProgress
} from '@/constants/clubRoyaleTiers';
import { 
  getLevelProgress
} from '@/constants/crownAnchor';
import type { BookedCruise } from '@/types/models';
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
import { CasinoSessionTracker } from '@/components/CasinoSessionTracker';
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
import { useEntitlement } from '@/state/EntitlementProvider';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AnalyticsTab = 'intelligence' | 'charts' | 'session' | 'calcs';
type ROIFilter = 'all' | 'high' | 'medium' | 'low';

function calculateCruiseROI(cruise: BookedCruise): { roi: number; valuePerDollar: number } {
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
  const router = useRouter();
  const { tier } = useEntitlement();
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
  const { bookedCruises: storedBookedCruises, isLoading: storeLoading } = useCruiseStore();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    crownAnchorPoints: loyaltyCrownAnchorPoints,
    crownAnchorLevel: loyaltyCrownAnchorLevel,
  } = useLoyalty();
  
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('intelligence');
  const [roiFilter, setRoiFilter] = useState<ROIFilter>('high');
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCruises, setShowAllCruises] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    title: string;
    subtitle?: string;
    type: 'achievement' | 'streak' | 'milestone';
  } | null>(null);
  const [targetPPH, setTargetPPH] = useState(100);
  const [isGeneratingSessions, setIsGeneratingSessions] = useState(false);
  
  const {
    sessions,
    addSession,
    removeSession,
    getSessionsForDate,
    getDailySummary,
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
    if (localBooked.length > 0) return localBooked;
    if (storedBookedCruises && storedBookedCruises.length > 0) return storedBookedCruises;
    console.log('[Analytics] No booked cruises available, using empty array');
    return [];
  }, [localData.booked, storedBookedCruises]);

  useEffect(() => {
    if (tier !== 'pro') {
      console.log('[Analytics] Access denied. Tier:', tier);
      router.replace('/paywall');
    }
  }, [tier, router]);

  if (tier !== 'pro') {
    return null;
  }

  const currentPoints = loyaltyClubRoyalePoints || clubRoyaleProfile?.tierPoints || analytics.totalPoints || 0;
  const totalNights = loyaltyCrownAnchorPoints || clubRoyaleProfile?.lifetimeNights || analytics.totalNights || 0;
  const clubRoyaleTier = loyaltyClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';
  const crownAnchorLevel = loyaltyCrownAnchorLevel || clubRoyaleProfile?.crownAnchorLevel || 'Gold';

  const cruisesWithROI = useMemo(() => {
    const today = new Date();
    return bookedCruises
      .filter(cruise => {
        // Only include completed cruises in portfolio
        const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
        if (!isCompleted) return false;
        
        const points = cruise.earnedPoints || cruise.casinoPoints || 0;
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
      ? bookedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0) / 
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

  const totalGoldenMinutes = useMemo(() => {
    return goldenTimeSlots.reduce((total, slot) => total + slot.durationMinutes, 0);
  }, [goldenTimeSlots]);

  const todaySessions = useMemo(() => {
    return getSessionsForDate(todayDateString);
  }, [getSessionsForDate, todayDateString]);

  const todaySummary = useMemo(() => {
    return getDailySummary(todayDateString, totalGoldenMinutes);
  }, [getDailySummary, todayDateString, totalGoldenMinutes]);

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
      haptics.success();
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

  const handleRemoveSession = useCallback(async (sessionId: string) => {
    await removeSession(sessionId);
    console.log('[Analytics] Session removed:', sessionId);
  }, [removeSession]);

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

  const handleCruisePress = useCallback((cruiseId: string) => {
    router.push({ pathname: '/(tabs)/(overview)/cruise-details' as any, params: { id: cruiseId } });
  }, [router]);

  const realAnalytics = useMemo(() => {
    const today = new Date();
    const destinationCounts: Record<string, number> = {};
    
    const completedCruises: BookedCruise[] = [];
    let totalNights = 0;
    
    bookedCruises.forEach((cruise: BookedCruise) => {
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
      
      totalNights += cruise.nights || 0;
      
      if (cruise.destination) {
        destinationCounts[cruise.destination] = (destinationCounts[cruise.destination] || 0) + 1;
      }
      
      if (isCompleted) {
        completedCruises.push(cruise);
      }
    });

    const allPortfolio = calculatePortfolioValue(bookedCruises);
    const completedPortfolio = calculatePortfolioValue(completedCruises);
    
    const destinationDistribution = Object.entries(destinationCounts)
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count);

    const valuePerDollar = allPortfolio.avgValuePerDollar === Infinity 
      ? 9999 
      : allPortfolio.avgValuePerDollar;

    console.log('[Analytics] realAnalytics calculated:', {
      totalCruises: bookedCruises.length,
      completedCruisesCount: completedCruises.length,
      totalNights,
      totalTaxesFees: allPortfolio.totalTaxesFees,
      totalRetailValue: allPortfolio.totalRetailValue,
      totalCoinIn: allPortfolio.totalCoinIn,
      totalWinnings: allPortfolio.totalWinnings,
      totalProfit: allPortfolio.totalProfit,
      valuePerDollar,
      portfolioROI: allPortfolio.avgROI,
    });

    return {
      totalCruises: bookedCruises.length,
      completedCruisesCount: completedCruises.length,
      totalNights,
      totalTaxesFees: allPortfolio.totalTaxesFees,
      totalOutOfPocket: allPortfolio.totalTaxesFees,
      totalRetailValue: allPortfolio.totalRetailValue,
      totalCoinIn: allPortfolio.totalCoinIn,
      totalWinnings: allPortfolio.totalWinnings,
      netCasinoResult: allPortfolio.totalWinnings,
      totalProfit: allPortfolio.totalProfit,
      totalPoints: allPortfolio.totalPoints,
      portfolioROI: allPortfolio.avgROI,
      valuePerDollar,
      destinationDistribution,
      completedTaxesFees: completedPortfolio.totalTaxesFees,
      completedOutOfPocket: completedPortfolio.totalTaxesFees,
      completedRetailValue: completedPortfolio.totalRetailValue,
      completedCoinIn: completedPortfolio.totalCoinIn,
      completedWinnings: completedPortfolio.totalWinnings,
      completedNetCasinoResult: completedPortfolio.totalWinnings,
      completedProfit: completedPortfolio.totalProfit,
      completedPoints: completedPortfolio.totalPoints,
      completedROI: completedPortfolio.avgROI,
    };
  }, [bookedCruises]);

  const stats = useMemo(() => [
    { label: 'Cruises', value: realAnalytics.totalCruises.toString(), icon: Ship },
    { label: 'Value/$1', value: realAnalytics.valuePerDollar >= 9999 ? '∞' : realAnalytics.valuePerDollar.toFixed(2), icon: DollarSign },
    { label: 'Profit', value: formatCurrency(realAnalytics.totalProfit), color: realAnalytics.totalProfit >= 0 ? COLORS.success : COLORS.error, icon: TrendingUp },
    { label: 'Points', value: formatNumber(currentPoints), icon: Award },
  ], [realAnalytics, currentPoints]);

  const buildCasinoCruisesCsv = useCallback((cruises: BookedCruise[]): string => {
    console.log('[CasinoCruiseExport] Building CSV...', { cruiseCount: cruises.length });

    const escapeCsv = (value: unknown): string => {
      const str = String(value ?? '');
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
      const pointsEarned = cruise.earnedPoints ?? cruise.casinoPoints ?? 0;
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
        const points = c.earnedPoints ?? c.casinoPoints ?? 0;
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

      const directory = Paths.cache ?? Paths.document;
      const file = new File(directory, filename);
      file.write(csv, { encoding: 'utf8' });

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

  const ROIFilterTabs = () => (
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

  const CruisePortfolioCard = ({ cruise }: { cruise: typeof cruisesWithROI[0] }) => {
    const breakdown = calculateCruiseValue(cruise);
    const winnings = cruise.winnings || 0;
    const earnedPoints = cruise.earnedPoints || cruise.casinoPoints || 0;
    
    const roiColor = cruise.roiLevel === 'high' 
      ? COLORS.success 
      : cruise.roiLevel === 'medium' 
        ? COLORS.warning 
        : COLORS.error;

    const valuePerDollarDisplay = cruise.valuePerDollar >= 9999 
      ? '∞' 
      : `${cruise.valuePerDollar.toFixed(2)}`;

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
        style={styles.portfolioCard}
        onPress={() => handleCruisePress(cruise.id)}
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
              <Text style={styles.portfolioMetricValue}>{formatCurrency(breakdown.cabinValueForTwo)}</Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Taxes</Text>
              <Text style={styles.portfolioMetricValue}>{formatCurrency(breakdown.taxesFees)}</Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Win</Text>
              <Text style={[styles.portfolioMetricValue, { color: winnings >= 0 ? COLORS.success : COLORS.error }]}>
                {winnings >= 0 ? '+' : ''}{formatCurrency(winnings)}
              </Text>
            </View>
            <View style={styles.portfolioMetric}>
              <Text style={styles.portfolioMetricLabel}>Profit</Text>
              <Text style={[styles.portfolioMetricValue, { color: breakdown.totalProfit >= 0 ? COLORS.success : COLORS.error }]}>
                {formatCurrency(breakdown.totalProfit)}
              </Text>
            </View>
          </View>
          
          {cruise.cabinType && (
            <View style={styles.portfolioCardFooter}>
              <Text style={styles.portfolioCardCabin}>{cruise.cabinType}</Text>
              {cruise.offerCode && (
                <View style={styles.portfolioOfferBadge}>
                  <Zap size={10} color={COLORS.goldDark} />
                  <Text style={styles.portfolioOfferCode}>{cruise.offerCode}</Text>
                </View>
              )}
            </View>
          )}
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
        <View style={styles.cleanCard}>
          <View style={styles.cleanCardHeader}>
            <Receipt size={16} color={COLORS.navyDeep} />
            <Text style={styles.cleanCardTitle}>Financial Overview</Text>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Retail Value</Text>
              <Text style={[styles.dataValue, { color: COLORS.success }]}>{formatCurrency(realAnalytics.completedRetailValue)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Taxes & Fees</Text>
              <Text style={styles.dataValue}>-{formatCurrency(realAnalytics.completedTaxesFees)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Coin-In</Text>
              <Text style={styles.dataValue}>{formatCurrency(casinoAnalytics.totalCoinIn)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Casino Result</Text>
              <Text style={[styles.dataValue, { color: realAnalytics.completedNetCasinoResult >= 0 ? COLORS.success : COLORS.error }]}>
                {realAnalytics.completedNetCasinoResult >= 0 ? '+' : ''}{formatCurrency(realAnalytics.completedNetCasinoResult)}
              </Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowTotal]}>
              <Text style={styles.dataTotalLabel}>Net Profit</Text>
              <Text style={[styles.dataTotalValue, { color: realAnalytics.completedProfit >= 0 ? COLORS.success : COLORS.error }]}>
                {realAnalytics.completedProfit >= 0 ? '+' : ''}{formatCurrency(realAnalytics.completedProfit)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.cleanCard}>
          <View style={styles.cleanCardHeader}>
            <PieChart size={16} color={COLORS.goldDark} />
            <Text style={styles.cleanCardTitle}>Casino Stats</Text>
          </View>
          <View style={styles.compactMetricsGrid}>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricValue}>{formatCurrency(casinoAnalytics.totalCoinIn)}</Text>
              <Text style={styles.compactMetricLabel}>Coin-In</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={[styles.compactMetricValue, { color: casinoAnalytics.netResult >= 0 ? COLORS.success : COLORS.error }]}>
                {casinoAnalytics.netResult >= 0 ? '+' : ''}{formatCurrency(casinoAnalytics.netResult)}
              </Text>
              <Text style={styles.compactMetricLabel}>Win/Loss</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricValue}>{formatNumber(currentPoints)}</Text>
              <Text style={styles.compactMetricLabel}>Points</Text>
            </View>
          </View>
          {casinoAnalytics.completedCruisesCount > 0 && (
            <View style={styles.avgStatsRow}>
              <Text style={styles.avgStatText}>Avg/Cruise: {formatCurrency(casinoAnalytics.avgCoinInPerCruise)} coin-in • {casinoAnalytics.avgWinLossPerCruise >= 0 ? '+' : ''}{formatCurrency(casinoAnalytics.avgWinLossPerCruise)} • {formatNumber(Math.round(casinoAnalytics.avgPointsPerCruise))} pts</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <CasinoMetricsCard
          completedCruises={bookedCruises.filter(c => {
            if (c.completionState === 'completed' || c.status === 'completed') return true;
            if (c.returnDate) {
              const returnDate = new Date(c.returnDate);
              return returnDate < new Date();
            }
            return false;
          })}
          currentPoints={currentPoints}
          currentTier={clubRoyaleTier}
          alwaysExpanded={true}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.portfolioTitle}>Cruise Portfolio</Text>
        <ROIFilterTabs />
        
        {filteredCruises.length > 0 ? (
          <View style={styles.portfolioList}>
            {(showAllCruises ? filteredCruises.slice(0, 25) : filteredCruises.slice(0, 5)).map((cruise) => (
              <CruisePortfolioCard key={cruise.id} cruise={cruise} />
            ))}
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
    handleAddSession({
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
      const completedCruises = bookedCruises.filter(cruise => {
        const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';
        const hasPointsData = cruise.earnedPoints || cruise.casinoPoints;
        
        if (isCompleted && hasPointsData) {
          console.log('[Analytics] Found completed cruise with points:', {
            id: cruise.id,
            shipName: cruise.shipName,
            sailDate: cruise.sailDate,
            earnedPoints: cruise.earnedPoints || cruise.casinoPoints,
            winnings: cruise.winnings,
            actualSpend: cruise.actualSpend,
          });
        }
        
        return isCompleted && hasPointsData;
      });

      console.log('[Analytics] ========== SESSION GENERATION REPORT ==========');
      console.log('[Analytics] Total booked cruises:', bookedCruises.length);
      console.log('[Analytics] Completed cruises with points:', completedCruises.length);
      console.log('[Analytics] Current total sessions:', sessions.length);
      console.log('[Analytics] Cruises list:', completedCruises.map(c => `${c.shipName} (${c.sailDate}) - ${c.earnedPoints || c.casinoPoints} pts`));
      
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
        haptics.success();
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
  }, [bookedCruises, generateHistoricalSessions, haptics, sessions]);

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
            haptics.success();
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
        <CasinoSessionTracker
          date={todayDateString}
          goldenTimeSlots={goldenTimeSlots}
          sessions={todaySessions}
          summary={todaySummary}
          onAddSession={() => setShowAddSessionModal(true)}
          onRemoveSession={handleRemoveSession}
        />
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
                      {session.notes && (
                        <Text style={styles.recentSessionNotes} numberOfLines={2}>{session.notes}</Text>
                      )}
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

  const highValueCalculations = useMemo(() => {
    const totalCoinIn = casinoAnalytics.totalCoinIn;
    const totalSessions = sessions.length;
    const totalProfit = realAnalytics.completedProfit;
    const totalHours = sessionAnalytics.totalPlayTimeMinutes / 60;
    const totalRetailValue = realAnalytics.completedRetailValue;
    const avgSessionLength = sessionAnalytics.avgSessionLength;

    const coinInPerSession = totalSessions > 0 ? totalCoinIn / totalSessions : 0;
    
    const assumedHold = 0.08;
    const theoPerSession = coinInPerSession * assumedHold;
    
    const morningSessionsData = sessions.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0]);
      return hour >= 5 && hour < 12;
    });
    const eveningSessionsData = sessions.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0]);
      return hour >= 17 || hour < 2;
    });
    
    const morningCoinIn = morningSessionsData.reduce((sum, s) => sum + ((s.buyIn || 0) * 5), 0);
    const eveningCoinIn = eveningSessionsData.reduce((sum, s) => sum + ((s.buyIn || 0) * 5), 0);
    const morningTheo = morningCoinIn * assumedHold;
    const eveningTheo = eveningCoinIn * assumedHold;
    const theoPerTimeBlock = morningTheo > eveningTheo ? 'Morning' : 'Evening';
    const theoTimeBlockValue = Math.max(morningTheo, eveningTheo);
    
    const cruiseDates = new Set(sessions.map(s => s.date));
    const theoValues = Array.from(cruiseDates).map(date => {
      const daySessions = sessions.filter(s => s.date === date);
      const dayCoinIn = daySessions.reduce((sum, s) => sum + ((s.buyIn || 0) * 5), 0);
      return dayCoinIn * assumedHold;
    });
    const avgTheo = theoValues.length > 0 ? theoValues.reduce((a, b) => a + b, 0) / theoValues.length : 0;
    const theoVariance = theoValues.length > 0 
      ? theoValues.reduce((sum, v) => sum + Math.pow(v - avgTheo, 2), 0) / theoValues.length 
      : 0;
    const theoStdDev = Math.sqrt(theoVariance);
    const adtSmoothingFactor = avgTheo > 0 ? (theoStdDev / avgTheo) : 0;
    
    const profitPerSession = totalSessions > 0 ? totalProfit / totalSessions : 0;
    
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
    const spikeRisk = sessionWinLoss.length > 0 ? (Math.max(...sessionWinLoss.map(Math.abs)) / Math.max(avgWinLoss, 1)) : 0;
    const offerSafetyIndex = consistencyScore > 0 && spikeRisk > 0 ? consistencyScore / spikeRisk : 0;
    
    const valuePerHourPlayed = totalHours > 0 ? totalRetailValue / totalHours : 0;
    
    const recentProfit = sessions.slice(-10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const earlyProfit = sessions.slice(0, 10).reduce((sum, s) => sum + (s.winLoss || 0), 0);
    const trendScore = earlyProfit !== 0 ? (recentProfit / Math.max(Math.abs(earlyProfit), 1)) : 1;
    const variabilityScore = 1 - Math.min(adtSmoothingFactor, 1);
    const sustainabilityScore = (trendScore * 0.6 + variabilityScore * 0.4) * 100;

    return [
      {
        id: 1,
        label: 'Coin-in per session',
        value: formatCurrency(coinInPerSession),
        description: 'Total coin-in ÷ total sessions',
        color: COLORS.navyDeep,
        icon: Coins,
      },
      {
        id: 2,
        label: 'Theo per session',
        value: formatCurrency(theoPerSession),
        description: `Coin-in per session × ${(assumedHold * 100).toFixed(0)}% hold`,
        color: COLORS.royalPurple,
        icon: Target,
      },
      {
        id: 3,
        label: 'Theo per time block',
        value: `${theoPerTimeBlock}: ${formatCurrency(theoTimeBlockValue)}`,
        description: 'Morning vs evening efficiency',
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
        label: 'Profit per session',
        value: formatCurrency(profitPerSession),
        description: `${formatCurrency(totalProfit)} ÷ ${totalSessions} sessions`,
        color: profitPerSession >= 0 ? COLORS.success : COLORS.error,
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
        description: 'Profit during press spins ÷ press exposure',
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
        label: 'Value per hour played',
        value: formatCurrency(valuePerHourPlayed),
        description: 'Total value extracted ÷ total hours',
        color: COLORS.goldDark,
        icon: DollarSign,
      },
      {
        id: 10,
        label: 'Sustainability score',
        value: `${sustainabilityScore.toFixed(1)}%`,
        description: 'Likelihood offers persist unchanged',
        color: sustainabilityScore >= 70 ? COLORS.success : sustainabilityScore >= 40 ? '#F59E0B' : COLORS.error,
        icon: BarChart3,
      },
    ];
  }, [casinoAnalytics, sessions, realAnalytics, sessionAnalytics]);

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
          totalPointsEarned={currentPoints}
        />
      </View>

      <View style={styles.section}>
        <RiskAnalysisChart
          riskAnalysis={baselineSimulation.riskAnalysis}
          totalSpent={realAnalytics.completedOutOfPocket}
          totalRetailValue={realAnalytics.completedRetailValue}
          totalSavings={realAnalytics.completedProfit}
          casinoNetResult={realAnalytics.completedNetCasinoResult || 0}
          totalCruises={realAnalytics.completedCruisesCount}
          pointsEarned={currentPoints}
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
        </ScrollView>
      </SafeAreaView>

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
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2 - SPACING.sm / 2,
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
});
