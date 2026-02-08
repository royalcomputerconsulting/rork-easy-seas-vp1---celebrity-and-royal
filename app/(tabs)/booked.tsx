import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  RotateCcw,
  EyeOff,
  X,
  ArrowUpDown,
  Clock,
  Award,
  Plus,
  List,
  CheckCircle,
  Anchor,
  Dice5,
  TrendingUp,
  Coins,
  Target,
  DollarSign,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useUser } from '@/state/UserProvider';
import { MinimalistFilterBar } from '@/components/ui/MinimalistFilterBar';
import { isDateInPast, createDateFromString } from '@/lib/date';
import { CruiseCard } from '@/components/CruiseCard';
import type { BookedCruise } from '@/types/models';
import { AddBookedCruiseModal } from '@/components/AddBookedCruiseModal';

import { getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { formatCurrency, formatNumber as formatNum } from '@/lib/format';
import { calculatePortfolioValue } from '@/lib/valueCalculator';

type FilterType = 'all' | 'upcoming' | 'completed' | 'celebrity';
type SortType = 'newest' | 'oldest' | 'ship' | 'nights';
type ViewMode = 'list' | 'timeline';

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Celebrity', value: 'celebrity' },
];

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'By Ship', value: 'ship' },
  { label: 'By Nights', value: 'nights' },
];

export default function BookedScreen() {
  const router = useRouter();
  const { localData, clubRoyaleProfile, isLoading: appLoading, refreshData } = useAppState();
  const { bookedCruises: storedBooked } = useCruiseStore();
  const { addBookedCruise } = useCoreData();
  useUser();
  const { casinoAnalytics } = useSimpleAnalytics();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    crownAnchorPoints,
  } = useLoyalty();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('oldest');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);

  const bookedCruises = useMemo(() => {
    const localBooked = localData.booked || [];
    if (localBooked.length > 0) return localBooked;
    if (storedBooked.length > 0) return storedBooked;
    return [];
  }, [localData.booked, storedBooked]);

  const filteredCruises = useMemo(() => {
    let result = [...bookedCruises];

    if (filter === 'upcoming') {
      result = result.filter(cruise => !isDateInPast(cruise.returnDate));
    } else if (filter === 'completed') {
      result = result.filter(cruise => isDateInPast(cruise.returnDate));
    } else if (filter === 'celebrity') {
      result = result.filter(cruise => cruise.cruiseSource === 'celebrity');
    }

    if (hideCompleted) {
      result = result.filter(cruise => !isDateInPast(cruise.returnDate));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(cruise =>
        cruise.shipName?.toLowerCase().includes(query) ||
        cruise.destination?.toLowerCase().includes(query) ||
        cruise.departurePort?.toLowerCase().includes(query) ||
        cruise.reservationNumber?.toLowerCase().includes(query) ||
        cruise.itineraryName?.toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
        break;
      case 'ship':
        result.sort((a, b) => (a.shipName || '').localeCompare(b.shipName || ''));
        break;
      case 'nights':
        result.sort((a, b) => (b.nights || 0) - (a.nights || 0));
        break;
    }

    return result;
  }, [bookedCruises, filter, hideCompleted, searchQuery, sortBy]);

  const currentPoints = loyaltyClubRoyalePoints || clubRoyaleProfile?.tierPoints || 0;
  const clubRoyaleTier = loyaltyClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';

  const stats = useMemo(() => {
    const upcoming = bookedCruises.filter(c => !isDateInPast(c.returnDate)).length;
    const completed = bookedCruises.filter(c => isDateInPast(c.returnDate)).length;
    const withData = bookedCruises.filter(c => c.price && c.price > 0).length;
    const totalNights = crownAnchorPoints;
    const totalPoints = bookedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
    const totalSpent = bookedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
    return { upcoming, completed, withData, total: bookedCruises.length, totalNights, totalPoints, totalSpent };
  }, [bookedCruises, crownAnchorPoints]);

  const casinoStats = useMemo(() => {
    const today = new Date();
    const completedCruises = bookedCruises.filter(cruise => {
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      return returnDate ? returnDate < today : cruise.completionState === 'completed';
    });
    
    const upcomingCruises = bookedCruises.filter(cruise => {
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      return returnDate ? returnDate >= today : cruise.completionState !== 'completed';
    });
    
    const completedPortfolio = calculatePortfolioValue(completedCruises);
    const upcomingPortfolio = calculatePortfolioValue(upcomingCruises);
    const totalWinnings = completedCruises.reduce((sum, c) => sum + (c.winnings || 0), 0);
    
    const totalRetailValue = upcomingPortfolio.totalRetailValue || 0;
    const totalTaxesFees = upcomingPortfolio.totalTaxesFees || 0;
    const netProfit = (totalRetailValue - totalTaxesFees) + totalWinnings;
    
    console.log('[Booked] Casino stats calculated:', {
      upcomingCount: upcomingCruises.length,
      completedCount: completedCruises.length,
      totalRetailValue,
      totalTaxesFees,
      totalWinnings,
      netProfit,
    });
    
    return {
      totalCoinIn: casinoAnalytics.totalCoinIn || completedPortfolio.totalCoinIn || 0,
      netResult: casinoAnalytics.netResult || totalWinnings || 0,
      avgCoinInPerCruise: casinoAnalytics.avgCoinInPerCruise || (completedCruises.length > 0 ? completedPortfolio.totalCoinIn / completedCruises.length : 0),
      avgWinLossPerCruise: casinoAnalytics.avgWinLossPerCruise || (completedCruises.length > 0 ? totalWinnings / completedCruises.length : 0),
      totalRetailValue,
      totalTaxesFees,
      totalProfit: netProfit,
      completedCount: completedCruises.length,
    };
  }, [bookedCruises, casinoAnalytics]);

  const nextCruise = useMemo(() => {
    const upcomingCruises = bookedCruises
      .filter(c => !isDateInPast(c.returnDate))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
    return upcomingCruises[0] || null;
  }, [bookedCruises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Booked] Refreshing data...');
    await refreshData();
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, [refreshData]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSearchQuery('');
    setHideCompleted(false);
    setSortBy('oldest');
  }, []);

  const handleCruisePress = useCallback((cruise: BookedCruise) => {
    console.log('[Booked] Cruise pressed:', cruise.id);
    router.push(`/cruise-details?id=${cruise.id}` as any);
  }, [router]);

  const handleAddCruise = useCallback(() => {
    console.log('[Booked] Opening add cruise modal');
    setShowAddModal(true);
  }, []);

  const handleSaveNewCruise = useCallback(async (cruise: BookedCruise) => {
    console.log('[Booked] Saving new cruise:', cruise);
    addBookedCruise(cruise);
    await refreshData();
  }, [addBookedCruise, refreshData]);

  const getDaysUntilCruise = useCallback((sailDate: string | undefined): number | null => {
    if (!sailDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sail = createDateFromString(sailDate);
    sail.setHours(0, 0, 0, 0);
    const diffTime = sail.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  }, []);

  const formatNumber = useCallback((num: number): string => {
    return formatNum(num);
  }, []);



  const renderCruiseCard = useCallback(({ item }: { item: BookedCruise }) => {
    const isPast = isDateInPast(item.returnDate);
    
    return (
      <CruiseCard
        cruise={item}
        onPress={() => handleCruisePress(item)}
        variant={isPast ? 'completed' : 'booked'}
        mini={true}
      />
    );
  }, [handleCruisePress]);

  const renderTimelineView = () => {
    const upcomingCruises = filteredCruises.filter(c => !isDateInPast(c.returnDate));
    const completedCruises = filteredCruises.filter(c => isDateInPast(c.returnDate));
    
    return (
      <View style={styles.timelineContainer}>
        {/* Upcoming Section */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineSectionHeader}>
            <View style={styles.timelineSectionIcon}>
              <Clock size={16} color={COLORS.white} />
            </View>
            <Text style={styles.timelineSectionTitle}>Upcoming ({upcomingCruises.length})</Text>
          </View>
          
          {upcomingCruises.length === 0 ? (
            <View style={styles.timelineEmptyCard}>
              <Ship size={24} color={COLORS.textSecondary} />
              <Text style={styles.timelineEmptyText}>No upcoming cruises</Text>
            </View>
          ) : (
            <View style={styles.timelineVerticalList}>
              {upcomingCruises.map((cruise) => {
                const daysUntil = getDaysUntilCruise(cruise.sailDate);
                return (
                  <View key={cruise.id} style={styles.timelineItemWrapper}>
                    {daysUntil !== null && (
                      <View style={styles.timelineDaysIndicator}>
                        <Text style={styles.timelineDaysNumber}>{daysUntil}</Text>
                        <Text style={styles.timelineDaysLabel}>DAYS</Text>
                      </View>
                    )}
                    <View style={styles.timelineCardWrapper}>
                      <CruiseCard
                        cruise={cruise}
                        onPress={() => handleCruisePress(cruise)}
                        variant="booked"
                        mini={true}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        
        {/* Completed Section */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineSectionHeader}>
            <View style={[styles.timelineSectionIcon, { backgroundColor: COLORS.success }]}>
              <CheckCircle size={16} color={COLORS.white} />
            </View>
            <Text style={styles.timelineSectionTitle}>Completed ({completedCruises.length})</Text>
          </View>
          
          {completedCruises.length === 0 ? (
            <View style={styles.timelineEmptyCard}>
              <CheckCircle size={24} color={COLORS.textSecondary} />
              <Text style={styles.timelineEmptyText}>No completed cruises</Text>
            </View>
          ) : (
            <View style={styles.timelineVerticalList}>
              {completedCruises.map((cruise) => {
                const points = cruise.earnedPoints || cruise.casinoPoints || 0;
                return (
                  <View key={cruise.id} style={styles.timelineItemWrapper}>
                    {points > 0 && (
                      <View style={[styles.timelineDaysIndicator, styles.timelinePointsIndicator]}>
                        <Award size={14} color={COLORS.success} />
                        <Text style={styles.timelinePointsValue}>+{formatNumber(points)}</Text>
                      </View>
                    )}
                    <View style={styles.timelineCardWrapper}>
                      <CruiseCard
                        cruise={cruise}
                        onPress={() => handleCruisePress(cruise)}
                        variant="completed"
                        mini={true}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  const heroImage = useMemo(() => {
    if (nextCruise?.destination) {
      const hash = nextCruise.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return getImageForDestination(nextCruise.destination, hash);
    }
    return DEFAULT_CRUISE_IMAGE;
  }, [nextCruise]);

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Colorful Hero Header */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0, 31, 63, 0.3)', 'rgba(0, 31, 63, 0.85)', 'rgba(0, 31, 63, 0.95)']}
          style={styles.heroOverlay}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTitleRow}>
            <View style={styles.heroIconBadge}>
              <Anchor size={24} color={COLORS.white} />
            </View>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroTitle}>My Cruises</Text>
              <Text style={styles.heroSubtitle}>{stats.total} cruises • {stats.totalNights} nights sailed</Text>
            </View>
          </View>
          
          {nextCruise && (
            <View style={styles.nextCruiseCard}>
              <View style={styles.nextCruiseHeader}>
                <Clock size={14} color={COLORS.beigeWarm} />
                <Text style={styles.nextCruiseLabel}>NEXT VOYAGE</Text>
              </View>
              <Text style={styles.nextCruiseShip}>{nextCruise.shipName}</Text>
              <Text style={styles.nextCruiseDest}>
                {nextCruise.nights}N • {nextCruise.destination || nextCruise.itineraryName || 'Caribbean'}
              </Text>
              <Text style={styles.nextCruiseDate}>
                {createDateFromString(nextCruise.sailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </Text>
            </View>
          )}
          
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Clock size={16} color={COLORS.aquaAccent} />
              <Text style={styles.heroStatValue}>{stats.upcoming}</Text>
              <Text style={styles.heroStatLabel}>Upcoming</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.heroStatValue}>{stats.completed}</Text>
              <Text style={styles.heroStatLabel}>Completed</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Award size={16} color={COLORS.goldAccent} />
              <Text style={styles.heroStatValue}>{formatNumber(currentPoints)}</Text>
              <Text style={styles.heroStatLabel}>Points</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Combined Casino Section */}
      <View style={styles.casinoSection}>
        <LinearGradient
          colors={['#E0F2FE', '#DBEAFE', '#E0F7FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.casinoGradient}
        >
          <View style={styles.casinoHeader}>
            <View style={styles.casinoIconBadge}>
              <Dice5 size={20} color={COLORS.white} />
            </View>
            <Text style={styles.casinoTitle}>Casino</Text>
            <View style={styles.casinoTierBadge}>
              <Text style={styles.casinoTierText}>{clubRoyaleTier}</Text>
            </View>
          </View>
          
          <View style={styles.casinoMetricsGrid}>
            <View style={styles.casinoMetricCard}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
                <Coins size={16} color={COLORS.goldDark} />
              </View>
              <Text style={styles.casinoMetricValue}>{formatCurrency(casinoStats.totalCoinIn)}</Text>
              <Text style={styles.casinoMetricLabel}>Total Coin-In</Text>
            </View>
            
            <View style={styles.casinoMetricCard}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoStats.netResult >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }]}>
                <Target size={16} color={casinoStats.netResult >= 0 ? COLORS.success : COLORS.error} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoStats.netResult >= 0 ? COLORS.success : COLORS.error }]}>
                {casinoStats.netResult >= 0 ? '+' : ''}{formatCurrency(casinoStats.netResult)}
              </Text>
              <Text style={styles.casinoMetricLabel}>Net Win/Loss</Text>
            </View>
            
            <View style={styles.casinoMetricCard}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: 'rgba(103, 58, 183, 0.15)' }]}>
                <Award size={16} color={COLORS.royalPurple} />
              </View>
              <Text style={styles.casinoMetricValue}>{formatNumber(currentPoints)}</Text>
              <Text style={styles.casinoMetricLabel}>Current Points</Text>
            </View>
          </View>
          
          <View style={styles.casinoFinancialsRow}>
            <View style={styles.casinoFinancialItem}>
              <Ship size={14} color={COLORS.navyDeep} />
              <View style={styles.casinoFinancialText}>
                <Text style={styles.casinoFinancialLabel}>Retail Value</Text>
                <Text style={[styles.casinoFinancialValue, { color: COLORS.success }]}>
                  {formatCurrency(casinoStats.totalRetailValue)}
                </Text>
              </View>
            </View>
            <View style={styles.casinoFinancialDivider} />
            <View style={styles.casinoFinancialItem}>
              <DollarSign size={14} color={COLORS.navyDeep} />
              <View style={styles.casinoFinancialText}>
                <Text style={styles.casinoFinancialLabel}>Taxes Paid</Text>
                <Text style={styles.casinoFinancialValue}>
                  {formatCurrency(casinoStats.totalTaxesFees)}
                </Text>
              </View>
            </View>
            <View style={styles.casinoFinancialDivider} />
            <View style={styles.casinoFinancialItem}>
              <TrendingUp size={14} color={casinoStats.totalProfit >= 0 ? COLORS.success : COLORS.error} />
              <View style={styles.casinoFinancialText}>
                <Text style={styles.casinoFinancialLabel}>Net Profit</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoStats.totalProfit >= 0 ? COLORS.success : COLORS.error }]}>
                  {casinoStats.totalProfit >= 0 ? '+' : ''}{formatCurrency(casinoStats.totalProfit)}
                </Text>
              </View>
            </View>
          </View>
          
          {casinoStats.completedCount > 0 && (
            <View style={styles.casinoAvgRow}>
              <View style={styles.casinoAvgItem}>
                <Text style={styles.casinoAvgLabel}>Avg Coin-In/Cruise</Text>
                <Text style={styles.casinoAvgValue}>{formatCurrency(casinoStats.avgCoinInPerCruise)}</Text>
              </View>
              <View style={styles.casinoAvgDivider} />
              <View style={styles.casinoAvgItem}>
                <Text style={styles.casinoAvgLabel}>Avg Win/Loss</Text>
                <Text style={[styles.casinoAvgValue, { color: casinoStats.avgWinLossPerCruise >= 0 ? COLORS.success : COLORS.error }]}>
                  {casinoStats.avgWinLossPerCruise >= 0 ? '+' : ''}{formatCurrency(casinoStats.avgWinLossPerCruise)}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>

      <View style={styles.viewModeRow}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}
          >
            <List size={16} color={viewMode === 'list' ? COLORS.navyDeep : COLORS.textSecondary} />
            <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'timeline' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('timeline')}
            activeOpacity={0.7}
          >
            <Clock size={16} color={viewMode === 'timeline' ? COLORS.navyDeep : COLORS.textSecondary} />
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.viewModeTextActive]}>Timeline</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addCruiseButton}
          onPress={handleAddCruise}
          activeOpacity={0.7}
        >
          <Plus size={16} color={COLORS.white} />
          <Text style={styles.addCruiseText}>Add Cruise</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'timeline' && renderTimelineView()}

      {viewMode === 'list' && (
        <>
          <MinimalistFilterBar
            tabs={FILTER_OPTIONS.map(opt => ({ key: opt.value, label: opt.label }))}
            activeTab={filter}
            onTabPress={(key) => setFilter(key as FilterType)}
            actions={[
              { key: 'refresh', label: 'Refresh', icon: RotateCcw, onPress: onRefresh },
              { key: 'hide', label: hideCompleted ? 'Show All' : 'Hide Done', icon: EyeOff, active: hideCompleted, onPress: () => setHideCompleted(!hideCompleted) },
              { key: 'clear', label: 'Clear Filters', icon: X, onPress: clearFilters },
              { key: 'sort', label: 'Sort', icon: ArrowUpDown, onPress: () => setShowSortMenu(!showSortMenu) },
            ]}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by ship, destination, reservation..."
            showingCount={filteredCruises.length}
            totalCount={stats.total}
            bookedCount={stats.upcoming}
          />
          
          <View style={styles.cruiseListHeader}>
            <Text style={styles.cruiseListTitle}>MY CRUISES</Text>
            <Text style={styles.cruiseListSubtitle}>
              {filteredCruises.length} {filteredCruises.length === 1 ? 'cruise' : 'cruises'} • Tap to view details
            </Text>
          </View>
        </>
      )}

      {showSortMenu && viewMode === 'list' && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, sortBy === option.value && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === option.value && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ship size={56} color={COLORS.beigeWarm} />
      </View>
      <Text style={styles.emptyTitle}>No Cruises Found</Text>
      <Text style={styles.emptyText}>
        {filter === 'upcoming' 
          ? 'You have no upcoming cruises scheduled.'
          : filter === 'completed'
          ? 'You haven\'t completed any cruises yet.'
          : filter === 'celebrity'
          ? 'You have no Celebrity cruises booked.'
          : searchQuery
          ? 'No cruises match your search.'
          : 'Your booked cruises will appear here.'}
      </Text>
      {(searchQuery || filter !== 'all' || hideCompleted) && (
        <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
          <LinearGradient
            colors={[COLORS.beigeWarm, COLORS.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.clearFiltersGradient}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  if (appLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.navyDeep} />
        <Text style={styles.loadingText}>Loading cruises...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={viewMode === 'list' ? filteredCruises : []}
          renderItem={renderCruiseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={viewMode === 'list' ? renderEmpty : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.beigeWarm}
              colors={[COLORS.beigeWarm]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={10}
        />
      </SafeAreaView>

      <AddBookedCruiseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewCruise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.secondary,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  heroContainer: {
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOW.lg,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTitleGroup: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  nextCruiseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextCruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  nextCruiseLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.beigeWarm,
    letterSpacing: 1,
  },
  nextCruiseShip: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  nextCruiseDest: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  nextCruiseDate: {
    fontSize: 12,
    color: COLORS.beigeWarm,
    marginTop: 4,
    fontWeight: '600' as const,
  },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  casinoSection: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  casinoGradient: {
    padding: SPACING.md,
  },
  casinoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  casinoTierBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  casinoTierText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  casinoMetricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  casinoMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  casinoMetricValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  casinoMetricLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  casinoFinancialsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoFinancialItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  casinoFinancialText: {
    flex: 1,
  },
  casinoFinancialLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  casinoFinancialValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  casinoFinancialDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.xs,
  },
  casinoAvgRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  casinoAvgItem: {
    flex: 1,
    alignItems: 'center',
  },
  casinoAvgLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginBottom: 2,
  },
  casinoAvgValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  casinoAvgDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.sm,
  },
  cruiseCardWrapper: {
    position: 'relative',
  },
  countdownBadge: {
    position: 'absolute',
    top: -8,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.royalPurple,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    zIndex: 10,
    ...SHADOW.sm,
  },
  countdownText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  pointsEarnedBadge: {
    position: 'absolute',
    top: -8,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    zIndex: 10,
    ...SHADOW.sm,
  },
  pointsEarnedText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  statsHighlightRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statsHighlightCard: {
    flex: 1,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    minWidth: 70,
  },
  statsHighlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  statsHighlightValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  statsHighlightLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  viewModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.round,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.navyDeep,
  },
  viewModeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  viewModeTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  addCruiseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
  },
  addCruiseText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  timelineContainer: {
    marginBottom: SPACING.lg,
  },
  timelineSection: {
    marginBottom: SPACING.lg,
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  timelineSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  timelineVerticalList: {
    gap: SPACING.sm,
  },
  timelineItemWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDaysIndicator: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    marginTop: SPACING.sm,
  },
  timelineDaysNumber: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    lineHeight: 22,
  },
  timelineDaysLabel: {
    fontSize: 8,
    color: COLORS.beigeWarm,
    textTransform: 'uppercase' as const,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  timelinePointsIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  timelinePointsValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
    marginTop: 2,
  },
  timelineCardWrapper: {
    flex: 1,
  },
  timelineEmptyCard: {
    paddingVertical: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 31, 63, 0.2)',
  },
  timelineEmptyText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.6,
    marginTop: SPACING.xs,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.data.value,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  sortMenu: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  sortOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.08)',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
  },
  sortOptionText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  sortOptionTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  cruiseListHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(224, 242, 254, 0.3)',
    borderRadius: BORDER_RADIUS.md,
  },
  cruiseListTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cruiseListSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.data.value,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  sortChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.3)',
  },
  sortChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  filterTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: COLORS.beigeWarm,
    borderColor: COLORS.beigeWarm,
  },
  filterTabText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  activeTabText: {
    color: COLORS.navyDeep,
  },
  cruiseCard: {
    backgroundColor: COLORS.cardBackgroundDark,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
    padding: SPACING.lg,
    ...SHADOW.lg,
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
    zIndex: 1,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(212, 165, 116, 0.9)',
  },
  completedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  completedStatusText: {
    color: COLORS.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xl,
  },
  shipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  shipName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.data.value,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  offerBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.goldAccent,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.beigeWarm,
    marginBottom: SPACING.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  reservationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  reservationLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.8)',
  },
  reservationNumber: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.data.value,
  },
  cabinTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinTypeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.data.value,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  priceContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  price: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  pointsRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 165, 116, 0.15)',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  pointsValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  pointsLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(224, 242, 254, 0.3)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(224, 242, 254, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  clearFiltersButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  clearFiltersGradient: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  clearFiltersText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
});
