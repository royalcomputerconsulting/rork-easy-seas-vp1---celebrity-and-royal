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
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  X,
  Bell,
  Sparkles,
  ListFilter,
  Bot,
  SlidersHorizontal,
  Check,
  Bookmark,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useUser } from '@/state/UserProvider';
import { CompactDashboardHeader } from '@/components/CompactDashboardHeader';
import { MinimalistFilterBar } from '@/components/ui/MinimalistFilterBar';
import { isDateInPast, getDaysUntil, createDateFromString } from '@/lib/date';
import { CruiseCard } from '@/components/CruiseCard';
import type { Cruise, BookedCruise } from '@/types/models';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { useAgentX } from '@/state/AgentXProvider';
import { getRecommendedCruises, type RecommendationScore } from '@/lib/recommendationEngine';
import { AgentXChat } from '@/components/AgentXChat';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';

type ViewTab = 'available' | 'all' | 'foryou' | 'booked';
type CabinFilter = 'all' | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';
type SortOption = 'date-asc' | 'date-desc' | 'value-asc' | 'value-desc';

interface FilterState {
  cabinType: CabinFilter;
  noConflicts: boolean;
  searchQuery: string;
  sortBy: SortOption;
}

const TABS: { key: ViewTab; label: string; icon?: any }[] = [
  { key: 'available', label: 'Available', icon: Ship },
  { key: 'all', label: 'All', icon: ListFilter },
  { key: 'foryou', label: 'For You', icon: Sparkles },
  { key: 'booked', label: 'Booked', icon: Bookmark },
];

const CABIN_FILTERS: { key: CabinFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Interior', label: 'Interior' },
  { key: 'Oceanview', label: 'Ocean' },
  { key: 'Balcony', label: 'Balcony' },
  { key: 'Suite', label: 'Suite' },
];

export default function SchedulingScreen() {
  const router = useRouter();
  const { localData, clubRoyaleProfile, isLoading: appLoading } = useAppState();
  const { bookedCruises } = useCruiseStore();
  const { currentUser } = useUser();
  const { messages, isLoading: agentLoading, sendMessage, isVisible, setVisible, isExpanded, toggleExpanded } = useAgentX();

  const [activeTab, setActiveTab] = useState<ViewTab>('available');
  const [filters, setFilters] = useState<FilterState>({
    cabinType: 'all',
    noConflicts: false,
    searchQuery: '',
    sortBy: 'date-asc',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  const allCruises = useMemo(() => {
    return localData.cruises || [];
  }, [localData.cruises]);

  const bookedIds = useMemo(() => {
    const localBooked = localData.booked || [];
    const storeBooked = bookedCruises || [];
    return new Set([
      ...localBooked.map((b: BookedCruise) => b.id),
      ...storeBooked.map((b: BookedCruise) => b.id),
    ]);
  }, [localData.booked, bookedCruises]);

  const bookedDates = useMemo(() => {
    const dates = new Set<string>();
    const allBooked = [...(localData.booked || []), ...(bookedCruises || [])];
    allBooked.forEach((cruise: BookedCruise) => {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      let currentDate = new Date(sailDate);
      while (currentDate <= returnDate) {
        dates.add(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    return dates;
  }, [localData.booked, bookedCruises]);

  const hasConflict = useCallback((cruise: Cruise): boolean => {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    let currentDate = new Date(sailDate);
    while (currentDate <= returnDate) {
      if (bookedDates.has(currentDate.toISOString().split('T')[0])) {
        return true;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  }, [bookedDates]);

  const [, setRecommendationScores] = useState<Map<string, RecommendationScore>>(new Map());

  const getSmartRecommendations = useCallback((cruises: Cruise[]): Cruise[] => {
    const allBooked = [...(localData.booked || []), ...(bookedCruises || [])];
    const offers = localData.offers || [];
    
    console.log('[Scheduling] Running smart recommendation engine...');
    
    const recommendations = getRecommendedCruises(
      cruises,
      allBooked,
      offers,
      {
        limit: 20,
        excludeConflicts: true,
        bookedDates,
      }
    );
    
    const scoresMap = new Map<string, RecommendationScore>();
    recommendations.forEach(rec => {
      scoresMap.set(rec.cruise.id, rec);
    });
    setRecommendationScores(scoresMap);
    
    console.log('[Scheduling] Recommendations generated:', recommendations.length);
    
    return recommendations.map(r => r.cruise);
  }, [bookedDates, localData.booked, localData.offers, bookedCruises]);

  const enrichedCruises = useMemo(() => {
    const offers = localData.offers || [];
    
    return allCruises.map(cruise => {
      if (cruise.offerName && cruise.offerCode) {
        return cruise;
      }
      
      const matchingOffer = offers.find(offer => {
        if (offer.cruiseId === cruise.id) return true;
        if (offer.cruiseIds?.includes(cruise.id)) return true;
        
        if (offer.offerCode && cruise.offerCode && offer.offerCode === cruise.offerCode) return true;
        
        if (offer.shipName === cruise.shipName && 
            offer.sailingDate === cruise.sailDate) return true;
        
        return false;
      });
      
      if (matchingOffer) {
        return {
          ...cruise,
          offerName: matchingOffer.offerName || matchingOffer.title || cruise.offerName,
          offerCode: matchingOffer.offerCode || cruise.offerCode,
          freePlay: matchingOffer.freePlay || matchingOffer.freeplayAmount || cruise.freePlay,
          tradeInValue: matchingOffer.tradeInValue || cruise.tradeInValue,
          perks: matchingOffer.perks || cruise.perks,
        };
      }
      
      return cruise;
    });
  }, [allCruises, localData.offers]);

  const bookedCruisesData = useMemo(() => {
    const localBooked = localData.booked || [];
    const storeBooked = bookedCruises || [];
    if (localBooked.length > 0) return localBooked;
    return storeBooked;
  }, [localData.booked, bookedCruises]);

  const filteredCruises = useMemo(() => {
    let result = [...enrichedCruises];

    if (activeTab === 'available') {
      result = result.filter(c => 
        !isDateInPast(c.sailDate) && 
        !bookedIds.has(c.id) && 
        !hasConflict(c)
      );
    } else if (activeTab === 'all') {
      result = result.filter(c => !isDateInPast(c.sailDate));
    } else if (activeTab === 'foryou') {
      result = getSmartRecommendations(enrichedCruises);
    } else if (activeTab === 'booked') {
      return bookedCruisesData.filter(c => !isDateInPast(c.returnDate || c.sailDate)) as Cruise[];
    }

    if (filters.cabinType !== 'all') {
      result = result.filter(c => c.cabinType === filters.cabinType);
    }

    if (filters.noConflicts && activeTab === 'all') {
      result = result.filter(c => !hasConflict(c));
    }

    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.shipName?.toLowerCase().includes(query) ||
        c.destination?.toLowerCase().includes(query) ||
        c.departurePort?.toLowerCase().includes(query) ||
        c.itineraryName?.toLowerCase().includes(query)
      );
    }

    if (activeTab !== 'foryou') {
      result.sort((a, b) => {
        switch (filters.sortBy) {
          case 'date-asc':
            return createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime();
          case 'date-desc':
            return createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime();
          case 'value-asc': {
            const valueA = calculateCruiseValue(a as Cruise | BookedCruise).totalRetailValue;
            const valueB = calculateCruiseValue(b as Cruise | BookedCruise).totalRetailValue;
            return valueA - valueB;
          }
          case 'value-desc': {
            const valueA = calculateCruiseValue(a as Cruise | BookedCruise).totalRetailValue;
            const valueB = calculateCruiseValue(b as Cruise | BookedCruise).totalRetailValue;
            return valueB - valueA;
          }
          default:
            return createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime();
        }
      });
    }
    return result;
  }, [enrichedCruises, activeTab, filters, bookedIds, hasConflict, getSmartRecommendations, bookedCruisesData]);

  const stats = useMemo(() => ({
    showing: filteredCruises.length,
    total: enrichedCruises.length,
    booked: bookedCruisesData.length,
    available: enrichedCruises.filter(c => !isDateInPast(c.sailDate) && !bookedIds.has(c.id)).length,
  }), [filteredCruises, enrichedCruises, bookedIds, bookedCruisesData]);

  const alertCount = useMemo(() => {
    return (localData.offers || []).filter((o: any) => {
      if (o.expiryDate) {
        const days = getDaysUntil(o.expiryDate);
        return days > 0 && days <= 7;
      }
      return false;
    }).length;
  }, [localData.offers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Scheduling] Refreshing cruises...');
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      cabinType: 'all',
      noConflicts: false,
      searchQuery: '',
      sortBy: 'date-asc',
    });
  }, []);

  const handleSortChange = useCallback((sortOption: SortOption) => {
    setFilters(prev => ({ ...prev, sortBy: sortOption }));
  }, []);

  const handleCruisePress = useCallback((cruise: Cruise) => {
    console.log('[Scheduling] Cruise pressed:', cruise.id);
    router.push(`/cruise-details?id=${cruise.id}` as any);
  }, [router]);

  const handleSettingsPress = useCallback(() => {
    router.push('/settings' as any);
  }, [router]);

  const handleAlertsPress = useCallback(() => {
    console.log('[Scheduling] Alerts pressed');
    setShowAlertsModal(true);
  }, []);

  const renderCruiseCard = useCallback(({ item, index }: { item: Cruise; index: number }) => {
    const isBooked = bookedIds.has(item.id) || activeTab === 'booked';
    
    return (
      <CruiseCard
        cruise={item}
        onPress={() => handleCruisePress(item)}
        variant={isBooked ? 'booked' : 'available'}
        mini={true}
      />
    );
  }, [bookedIds, handleCruisePress, activeTab]);

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <CompactDashboardHeader
        memberName={currentUser?.name || clubRoyaleProfile.memberName}
        onSettingsPress={handleSettingsPress}
        onAlertsPress={handleAlertsPress}
        alertCount={alertCount}
        availableCruises={stats.available}
        bookedCruises={stats.booked}
        activeOffers={alertCount}
        onCruisesPress={() => setActiveTab('available')}
        onBookedPress={() => router.push('/booked' as any)}
        onOffersPress={() => setActiveTab('foryou')}
      />

      <MinimalistFilterBar
        tabs={TABS.map(tab => ({ key: tab.key, label: tab.label }))}
        activeTab={activeTab}
        onTabPress={(key) => setActiveTab(key as ViewTab)}
        actions={[
          { key: 'clear', label: 'Clear', icon: X, onPress: clearFilters },
          { key: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount, onPress: handleAlertsPress },
        ]}
        onSearch={handleSearch}
        searchPlaceholder="Search cruises..."
        showingCount={stats.showing}
        totalCount={stats.total}
        bookedCount={stats.booked}
      />

      {/* Compact sort and filter row */}
      <View style={styles.sortFilterRow}>
        <View style={styles.sortChips}>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'date-asc' && styles.sortChipActive]}
            onPress={() => handleSortChange('date-asc')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, filters.sortBy === 'date-asc' && styles.sortChipTextActive]}>Soonest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'date-desc' && styles.sortChipActive]}
            onPress={() => handleSortChange('date-desc')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, filters.sortBy === 'date-desc' && styles.sortChipTextActive]}>Latest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'value-desc' && styles.sortChipActive]}
            onPress={() => handleSortChange('value-desc')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, filters.sortBy === 'value-desc' && styles.sortChipTextActive]}>Value</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showAdvancedFilters && styles.filterToggleActive]}
          onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={14} color={showAdvancedFilters ? COLORS.navyDeep : CLEAN_THEME.text.secondary} />
          {(filters.cabinType !== 'all' || filters.noConflicts) && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Collapsible Filters */}
      {showAdvancedFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.cabinRow}>
            {CABIN_FILTERS.map(cabin => (
              <TouchableOpacity
                key={cabin.key}
                style={[styles.cabinChip, filters.cabinType === cabin.key && styles.cabinChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, cabinType: cabin.key }))}
                activeOpacity={0.7}
              >
                <Text style={[styles.cabinChipText, filters.cabinType === cabin.key && styles.cabinChipTextActive]}>
                  {cabin.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.conflictToggle}
            onPress={() => setFilters(prev => ({ ...prev, noConflicts: !prev.noConflicts }))}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleCheckbox, filters.noConflicts && styles.toggleCheckboxActive]}>
              {filters.noConflicts && <Check size={10} color={COLORS.white} />}
            </View>
            <Text style={styles.conflictText}>No conflicts</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.cruiseListHeader}>
        <Text style={styles.cruiseListTitle}>
          {activeTab === 'booked' ? 'BOOKED CRUISES' : activeTab === 'foryou' ? 'RECOMMENDED FOR YOU' : 'ALL CRUISES'}
        </Text>
        <Text style={styles.cruiseListSubtitle}>
          {filteredCruises.length} {filteredCruises.length === 1 ? 'cruise' : 'cruises'} • Tap to view details
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ship size={56} color={COLORS.navyDeep} />
      </View>
      <Text style={styles.emptyTitle}>No Cruises Found</Text>
      <Text style={styles.emptyText}>
        {filters.searchQuery || filters.cabinType !== 'all' || filters.noConflicts
            ? 'Try adjusting your filters or search.'
            : 'Import cruise data to see available voyages.'}
      </Text>
      {(filters.searchQuery || filters.cabinType !== 'all' || filters.noConflicts) && (
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

  const handleAgentClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const handleAgentToggle = useCallback(() => {
    setVisible(!isVisible);
  }, [isVisible, setVisible]);

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
          data={filteredCruises}
          renderItem={renderCruiseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.navyDeep}
              colors={[COLORS.navyDeep]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={10}
        />
      </SafeAreaView>

      {/* Agent X Floating Button */}
      <TouchableOpacity
        style={styles.agentFab}
        onPress={handleAgentToggle}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[COLORS.goldAccent, COLORS.beigeWarm]}
          style={styles.agentFabGradient}
        >
          {isVisible ? (
            <X size={24} color={COLORS.navyDeep} />
          ) : (
            <Bot size={24} color={COLORS.navyDeep} />
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Agent X Chat Modal */}
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleAgentClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={handleAgentClose}
          />
          <View style={[styles.agentChatContainer, isExpanded && styles.agentChatExpanded]}>
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={agentLoading}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpanded}
              onClose={handleAgentClose}
              showHeader={true}
              placeholder="Ask about cruises, tier progress, offers..."
            />
          </View>
        </View>
      </Modal>

      {/* Alerts Manager Modal */}
      <AlertsManagerModal
        visible={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
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
    backgroundColor: 'transparent',
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
    borderColor: COLORS.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  filterSectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.sm,
  },
  cabinFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  cabinChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  cabinChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  cabinChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cabinChipTextActive: {
    color: COLORS.white,
  },
  conflictToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  toggleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: CLEAN_THEME.border.medium,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleCheckboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  conflictToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
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
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.beigeWarm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    marginTop: 2,
  },
  cruiseCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOW.md,
  },
  conflictCard: {
    borderColor: 'rgba(244, 67, 54, 0.4)',
  },
  recommendedCard: {
    borderColor: COLORS.beigeWarm,
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderBottomRightRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
    color: COLORS.white,
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bookedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  conflictBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  conflictBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flex: 1,
  },
  expiringSoonBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.4)',
  },
  expiringSoonText: {
    fontSize: 10,
    color: COLORS.warning,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cruiseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  detailItem: {
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
  },
  cabinTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinTypeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  daysUntilText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    flex: 1,
  },
  priceText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
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
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sortPillsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flex: 1,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  sortPillActive: {
    backgroundColor: CLEAN_THEME.filter.activeBg,
    borderColor: COLORS.navyDeep,
  },
  sortPillText: {
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  sortPillTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  advancedFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    marginLeft: SPACING.sm,
  },
  advancedFilterToggleActive: {
    backgroundColor: CLEAN_THEME.filter.activeBg,
    borderColor: COLORS.navyDeep,
  },
  advancedFilterText: {
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  advancedFilterTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  filterBadge: {
    backgroundColor: COLORS.goldAccent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  advancedFiltersPanel: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  filterSection: {
    marginBottom: SPACING.sm,
  },
  sortFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sortChips: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  sortChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  sortChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  sortChipText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  sortChipTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  filterToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  filterToggleActive: {
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
  },
  filterDot: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.goldAccent,
  },
  filtersPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  cabinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  conflictText: {
    fontSize: 12,
    color: CLEAN_THEME.text.secondary,
  },
  cruiseListHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
  agentFab: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.lg,
    zIndex: 100,
    ...SHADOW.lg,
  },
  agentFabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  agentChatContainer: {
    height: '70%',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  agentChatExpanded: {
    height: '95%',
  },
});
