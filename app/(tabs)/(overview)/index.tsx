import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  Tag,
  AlertTriangle,
  Sparkles,
  Bot,
  Target,
  TrendingUp,
  TrendingDown,
  Ship,
  Calendar,
  Coins,
} from 'lucide-react-native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { useAgentX } from '@/state/AgentXProvider';
import { usePriceTrackingSync } from '@/lib/usePriceTrackingSync';
import { useAlerts } from '@/state/AlertsProvider';
import { CompactDashboardHeader } from '@/components/CompactDashboardHeader';
import { CasinoCertificatesCard } from '@/components/CasinoCertificatesCard';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { CertificateManagerModal } from '@/components/CertificateManagerModal';
import { AgentXChat } from '@/components/AgentXChat';
import { useCertificates } from '@/state/CertificatesProvider';
import { OfferCard } from '@/components/OfferCard';
import { CasinoOfferCard, OfferSummaryCard } from '@/components/CasinoOfferCard';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';
import { AgentXAnalysisCard } from '@/components/AgentXAnalysisCard';
import { QuickActionsFAB } from '@/components/ui/QuickActionsFAB';
import { getDaysUntil, isDateInPast, formatDate } from '@/lib/date';
import { MachineStrategyCard } from '@/components/MachineStrategyCard';

import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { getCabinPriceFromEntity, GUEST_COUNT_DEFAULT } from '@/lib/valueCalculator';

function AnimatedEmptyState({ onImportPress }: { onImportPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [fadeAnim, scaleAnim, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Tag size={56} color={COLORS.navyDeep} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No Offers Found</Text>
      <Text style={styles.emptyText}>
        Import casino offers data to see available offers and eligible cruises.
      </Text>
      <TouchableOpacity
        style={styles.importButton}
        onPress={onImportPress}
        activeOpacity={0.8}
      >
        <Text style={styles.importButtonText}>Import Data</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface CasinoOfferCardData {
  id: string;
  offerCode: string;
  offerName: string;
  expiryDate?: string;
  tradeInValue?: number;
  freePlay?: number;
  obc?: number;
  perks?: string[];
  cruises: Cruise[];
}

function OverviewScreenContent() {
  const router = useRouter();
  const { cruises, bookedCruises: allBookedCruises, casinoOffers, clubRoyaleProfile } = useCoreData();
  const { currentUser } = useUser();
  const { logout } = useAuth();
  const { messages, isLoading: agentLoading, sendMessage, isVisible, setVisible, toggleExpanded, isExpanded, refreshAnalysis } = useAgentX();
  const { summary } = useAlerts();
  
  usePriceTrackingSync();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const { 
    certificates, 
    addCertificate, 
    updateCertificate, 
    deleteCertificate,
    getCertificatesByType,
  } = useCertificates();

  const cruisesData = useMemo(() => cruises, [cruises]);

  const offersData = useMemo(() => casinoOffers, [casinoOffers]);

  const bookedCruises = useMemo(() => allBookedCruises, [allBookedCruises]);

  const bookedCruiseIds = useMemo(() => {
    return new Set(bookedCruises.map((b: BookedCruise) => b.id));
  }, [bookedCruises]);

  const groupedOffers = useMemo(() => {
    const offersMap = new Map<string, CasinoOfferCardData>();
    
    offersData.forEach((offer: CasinoOffer) => {
      if (offer.expiryDate && getDaysUntil(offer.expiryDate) < 0) {
        return;
      }
      
      const key = offer.offerCode || offer.id;
      if (!offersMap.has(key)) {
        offersMap.set(key, {
          id: offer.id,
          offerCode: offer.offerCode || offer.id,
          offerName: offer.offerName || offer.title || 'Casino Offer',
          expiryDate: offer.expiryDate,
          tradeInValue: offer.value,
          freePlay: 0,
          obc: offer.obcAmount,
          perks: [],
          cruises: [],
        });
      }
    });

    cruisesData.forEach((cruise: Cruise) => {
      if (cruise.sailDate && isDateInPast(cruise.sailDate)) {
        return;
      }
      
      const offerCode = cruise.offerCode;
      if (offerCode && offersMap.has(offerCode)) {
        const offerCard = offersMap.get(offerCode);
        if (offerCard) {
          offerCard.cruises.push(cruise);
        }
      }
    });

    return Array.from(offersMap.values()).filter(offer => offer.cruises.length > 0);
  }, [offersData, cruisesData]);

  const nonExpiredOffers = useMemo(() => {
    if (groupedOffers.length === 0) {
      return cruisesData.filter((cruise: Cruise) => {
        if (cruise.sailDate) {
          return !isDateInPast(cruise.sailDate);
        }
        return true;
      });
    }
    return groupedOffers;
  }, [groupedOffers, cruisesData]);

  const availableCruisesCount = useMemo(() => {
    return cruisesData.filter((c: Cruise) => !isDateInPast(c.sailDate)).length;
  }, [cruisesData]);

  const certificateSummary = useMemo(() => {
    const fppCerts = getCertificatesByType('fpp').filter(c => c.status === 'available');
    const nextCruiseCerts = getCertificatesByType('nextCruise').filter(c => c.status === 'available');
    const obcCerts = getCertificatesByType('obc').filter(c => c.status === 'available');
    const freeplayCerts = getCertificatesByType('freeplay').filter(c => c.status === 'available');
    
    return [
      { type: 'fpp' as const, label: 'FPP Certs', value: fppCerts.length },
      { type: 'nextCruise' as const, label: 'Next Cruise', value: nextCruiseCerts.length },
      { type: 'obc' as const, label: 'OBC Certs', value: obcCerts.length + freeplayCerts.length },
    ];
  }, [getCertificatesByType]);

  const expiringSoonCount = useMemo(() => {
    let count = 0;
    groupedOffers.forEach(offer => {
      if (offer.expiryDate) {
        const days = getDaysUntil(offer.expiryDate);
        if (days > 0 && days <= 7) {
          count++;
        }
      }
    });
    return count;
  }, [groupedOffers]);

  const [sortMode, setSortMode] = useState<'soonest' | 'highestValue'>('soonest');

  const offerSummary = useMemo(() => {
    if (groupedOffers.length === 0) return null;
    
    let totalValue = 0;
    let totalCruises = 0;
    
    // Base rates per night for cabin type estimation (same as CasinoOfferCard)
    const baseRates: Record<string, number> = {
      'Interior': 100,
      'Interior GTY': 80,
      'Oceanview': 140,
      'Oceanview GTY': 120,
      'Balcony': 180,
      'Balcony GTY': 150,
      'Suite': 350,
      'Suite GTY': 280,
      'Junior Suite': 320,
      'Grand Suite': 500,
      "Owner's Suite": 600,
    };
    
    groupedOffers.forEach(offer => {
      totalCruises += offer.cruises.length;
      const roomType = offer.cruises[0]?.cabinType || 'Balcony';
      
      offer.cruises.forEach(cruise => {
        let cabinPrice = getCabinPriceFromEntity(cruise, roomType) || cruise.price || 0;
        
        // Estimate cabin price if not available
        if (cabinPrice === 0 && cruise.nights > 0) {
          const typeKey = Object.keys(baseRates).find(key => 
            roomType.toLowerCase().includes(key.toLowerCase())
          ) || 'Balcony';
          cabinPrice = (baseRates[typeKey] || 180) * (cruise.nights || 7);
        }
        
        const guestCount = cruise.guests || GUEST_COUNT_DEFAULT;
        const cabinValueForTwo = cabinPrice * guestCount;
        
        // Estimate taxes if not provided (~$30/night per guest)
        let taxesFees = cruise.taxes || 0;
        if (taxesFees === 0 && cruise.nights > 0) {
          taxesFees = Math.round((cruise.nights || 7) * 30 * guestCount);
        }
        
        const freePlayValue = cruise.freePlay || 0;
        const obcValue = cruise.freeOBC || 0;
        
        // Total value = cabin + taxes + freeplay + OBC (same formula as CasinoOfferCard)
        const cruiseTotalValue = cabinValueForTwo + taxesFees + freePlayValue + obcValue;
        totalValue += cruiseTotalValue;
      });
    });
    
    console.log('[Overview] Offer summary calculated:', { totalValue, totalCruises, totalOffers: groupedOffers.length });
    
    return {
      totalValue,
      totalCruises,
      totalOffers: groupedOffers.length,
    };
  }, [groupedOffers]);

  const cruisesWithCasinoData = useMemo(() => {
    const allCruises = [...allBookedCruises, ...cruises];
    return allCruises.filter((cruise: BookedCruise) => {
      const hasWinnings = cruise.winnings !== undefined && cruise.winnings !== 0;
      const hasPoints = (cruise.earnedPoints !== undefined && cruise.earnedPoints > 0) || 
                       (cruise.casinoPoints !== undefined && cruise.casinoPoints > 0);
      return hasWinnings || hasPoints;
    }).sort((a, b) => {
      const dateA = new Date(a.sailDate).getTime();
      const dateB = new Date(b.sailDate).getTime();
      return dateB - dateA;
    });
  }, [allBookedCruises, cruises]);

  const sortedOffers = useMemo(() => {
    if (groupedOffers.length === 0) return nonExpiredOffers;
    
    const sorted = [...groupedOffers];
    
    if (sortMode === 'soonest') {
      sorted.sort((a, b) => {
        const aDate = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const bDate = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return aDate - bDate;
      });
    } else {
      sorted.sort((a, b) => {
        const aValue = a.cruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
        const bValue = b.cruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
        return bValue - aValue;
      });
    }
    
    return sorted;
  }, [groupedOffers, nonExpiredOffers, sortMode]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Overview] Screen focused, offers count:', nonExpiredOffers.length);
    }, [nonExpiredOffers.length])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Overview] Refreshing offers...');
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
    console.log('[Overview] Refresh complete');
  }, []);

  const handleOfferPress = useCallback((offer: CasinoOfferCardData | Cruise) => {
    console.log('[Overview] Offer pressed:', offer.id);
    if ('cruises' in offer) {
      router.push(`/offer-details?offerCode=${encodeURIComponent(offer.offerCode)}` as any);
    } else {
      router.push(`/cruise-details?id=${offer.id}` as any);
    }
  }, [router]);

  const handleCruiseItemPress = useCallback((cruiseId: string) => {
    console.log('[Overview] Cruise item pressed:', cruiseId);
    router.push(`/cruise-details?id=${cruiseId}` as any);
  }, [router]);

  const handleSettingsPress = useCallback(() => {
    router.push('/settings' as any);
  }, [router]);

  const handleAlertsPress = useCallback(() => {
    console.log('[Overview] Alerts pressed');
    setShowAlertsModal(true);
  }, []);

  const handleCruisesPress = useCallback(() => {
    router.push('/scheduling' as any);
  }, [router]);

  const handleBookedPress = useCallback(() => {
    router.push('/booked' as any);
  }, [router]);

  const handleCalendarPress = useCallback(() => {
    router.push('/events' as any);
  }, [router]);

  const handleLogoutPress = useCallback(async () => {
    console.log('[Overview] Logout pressed');
    await logout();
  }, [logout]);



  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Centered Logo at half splash size */}
      <View style={styles.centeredLogoContainer}>
        <Image
          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/drzllmgo03ok1wemgb3s9' }}
          style={styles.centeredLogo}
          resizeMode="contain"
        />
      </View>

      <CompactDashboardHeader
        hideLogo={true}
        memberName={currentUser?.name || clubRoyaleProfile.memberName}
        onSettingsPress={handleSettingsPress}
        onAlertsPress={handleAlertsPress}
        onLogoutPress={handleLogoutPress}
        alertCount={summary.totalActive}
        availableCruises={availableCruisesCount}
        bookedCruises={bookedCruises.length}
        activeOffers={groupedOffers.length || offersData.length}
        onCruisesPress={handleCruisesPress}
        onBookedPress={handleBookedPress}
        onOffersPress={() => console.log('Active offers pressed')}
      />

      <CollapsibleSection
        title="Agent X Analysis"
        subtitle="Performance insights"
        icon={<Bot size={18} color="#FFFFFF" />}
        defaultExpanded={true}
        showBorder={false}
      >
        <AgentXAnalysisCard 
          onViewDetails={() => setVisible(true)}
          onRefresh={refreshAnalysis}
        />
      </CollapsibleSection>

      {offerSummary && (
        <OfferSummaryCard
          totalValue={offerSummary.totalValue}
          totalCruises={offerSummary.totalCruises}
          totalOffers={offerSummary.totalOffers}
          onSoonestPress={() => setSortMode('soonest')}
          onHighestValuePress={() => setSortMode('highestValue')}
          activeSortMode={sortMode}
        />
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Tag size={18} color={COLORS.navyDeep} />
          <Text style={styles.sectionTitle}>CASINO OFFERS</Text>
        </View>
        {expiringSoonCount > 0 && (
          <View style={styles.expiringAlert}>
            <AlertTriangle size={14} color={COLORS.warning} />
            <Text style={styles.expiringAlertText}>
              {expiringSoonCount} expiring soon
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContent}>
      <CollapsibleSection
        title="Casino & Certificates"
        subtitle={`${certificateSummary.reduce((sum, c) => sum + c.value, 0)} available`}
        icon={<Sparkles size={18} color="#FFFFFF" />}
        defaultExpanded={true}
        showBorder={false}
      >
        <CasinoCertificatesCard
          certificates={certificateSummary}
          totalCertificates={certificateSummary.reduce((sum, c) => sum + c.value, 0)}
          availableCruises={availableCruisesCount}
          onManagePress={() => setShowCertificateModal(true)}
          onViewOffersPress={() => router.push('/scheduling' as any)}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Machine Strategy"
        subtitle="Personalized recommendations"
        icon={<Target size={18} color="#FFFFFF" />}
        defaultExpanded={false}
        showBorder={false}
      >
        <MachineStrategyCard />
      </CollapsibleSection>

      {cruisesWithCasinoData.length > 0 && (
        <View style={styles.casinoHistorySection}>
          <View style={styles.casinoHistoryHeader}>
            <View style={styles.casinoHistoryTitleRow}>
              <Coins size={18} color={COLORS.navyDeep} />
              <Text style={styles.casinoHistoryTitle}>CASINO HISTORY</Text>
            </View>
            <Text style={styles.casinoHistorySubtitle}>
              {cruisesWithCasinoData.length} cruise{cruisesWithCasinoData.length !== 1 ? 's' : ''} with casino data
            </Text>
          </View>
          {cruisesWithCasinoData.map((cruise: BookedCruise) => {
            const winnings = cruise.winnings || 0;
            const earnedPoints = cruise.earnedPoints || cruise.casinoPoints || 0;
            const isWin = winnings >= 0;
            const itineraryText = `${cruise.nights} night${cruise.nights !== 1 ? 's' : ''} to ${cruise.destination || cruise.itineraryName || 'Caribbean'}`;
            
            return (
              <TouchableOpacity
                key={cruise.id}
                style={styles.casinoHistoryItem}
                onPress={() => handleCruiseItemPress(cruise.id)}
                activeOpacity={0.7}
              >
                <View style={styles.casinoHistoryItemHeader}>
                  <View style={styles.casinoHistoryShipInfo}>
                    <Ship size={16} color={COLORS.navyDeep} />
                    <Text style={styles.casinoHistoryShipName}>{cruise.shipName}</Text>
                  </View>
                  <View style={styles.casinoHistoryDateRow}>
                    <Calendar size={12} color="#64748B" />
                    <Text style={styles.casinoHistoryDate}>{formatDate(cruise.sailDate)}</Text>
                  </View>
                </View>
                <Text style={styles.casinoHistoryItinerary}>{itineraryText}</Text>
                <View style={styles.casinoHistoryStats}>
                  <View style={styles.casinoHistoryStat}>
                    {isWin ? (
                      <TrendingUp size={14} color={COLORS.success} />
                    ) : (
                      <TrendingDown size={14} color={COLORS.error} />
                    )}
                    <Text style={[styles.casinoHistoryStatValue, { color: isWin ? COLORS.success : COLORS.error }]}>
                      {isWin ? '+' : ''}${winnings.toLocaleString()}
                    </Text>
                    <Text style={styles.casinoHistoryStatLabel}>Win/Loss</Text>
                  </View>
                  <View style={styles.casinoHistoryStatDivider} />
                  <View style={styles.casinoHistoryStat}>
                    <Sparkles size={14} color="#D4A574" />
                    <Text style={styles.casinoHistoryStatValuePoints}>
                      {earnedPoints.toLocaleString()}
                    </Text>
                    <Text style={styles.casinoHistoryStatLabel}>Points Earned</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderOfferCard = useCallback(({ item, index }: { item: CasinoOfferCardData | Cruise; index: number }) => {
    if ('cruises' in item) {
      return (
        <CasinoOfferCard
          offerCode={item.offerCode}
          offerName={item.offerName}
          expiryDate={item.expiryDate}
          tradeInValue={item.tradeInValue}
          freePlay={item.freePlay}
          obc={item.obc}
          cruises={item.cruises}
          onPress={() => handleOfferPress(item)}
          onCruisePress={handleCruiseItemPress}
          bookedCruiseIds={bookedCruiseIds}
          isBestValue={index === 0}
        />
      );
    }

    return (
      <OfferCard 
        offer={item as Cruise} 
        allCruises={cruisesData}
        onPress={() => handleOfferPress(item)} 
        isBooked={bookedCruiseIds.has(item.id)}
        recommended={index === 0}
      />
    );
  }, [handleOfferPress, handleCruiseItemPress, bookedCruiseIds, cruisesData]);

  const keyExtractor = useCallback((item: CasinoOfferCardData | Cruise) => item.id, []);

  return (
    <View style={styles.container}>
      <CertificateManagerModal
        visible={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        certificates={certificates}
        onAddCertificate={addCertificate}
        onUpdateCertificate={updateCertificate}
        onDeleteCertificate={deleteCertificate}
      />
      
      <AlertsManagerModal
        visible={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
      />
      
      {isVisible && (
        <View style={styles.agentChatOverlay}>
          <TouchableOpacity 
            style={styles.agentChatBackdrop} 
            activeOpacity={1} 
            onPress={() => setVisible(false)}
          />
          <View style={[styles.agentChatContainer, isExpanded && styles.agentChatExpanded]}>
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={agentLoading}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpanded}
              onClose={() => setVisible(false)}
              showHeader={true}
            />
          </View>
        </View>
      )}
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <QuickActionsFAB
          onBrowseCruises={handleCruisesPress}
          onImportData={handleSettingsPress}
          onViewCalendar={handleCalendarPress}
        />
        
        <FlatList
          data={sortedOffers}
          renderItem={renderOfferCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={<AnimatedEmptyState onImportPress={() => router.push('/settings' as any)} />}
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
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
        />
      </SafeAreaView>
    </View>
  );
}

export default function OverviewScreen() {
  const { isLoading: coreLoading } = useCoreData();

  useEffect(() => {
    console.log('[OverviewScreen] Mounted, coreLoading:', coreLoading);
  }, [coreLoading]);

  useEffect(() => {
    console.log('[OverviewScreen] Loading state changed:', coreLoading);
  }, [coreLoading]);

  if (coreLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.navyDeep} />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </SafeAreaView>
    );
  }

  return <OverviewScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  backgroundOverlay: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A1628',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#E2E8F0',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 0,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  footerContent: {
    marginTop: SPACING.md,
  },
  heroSection: {
    height: 200,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginHorizontal: -SPACING.md,
    marginTop: -SPACING.md,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  heroTitleContainer: {
    marginBottom: SPACING.md,
  },
  heroWelcome: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroStatPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  centeredLogoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  centeredLogo: {
    width: '100%',
    height: 400,
    maxWidth: 640,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  progressSectionTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.secondary,
    letterSpacing: 1.5,
  },
  progressCard: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  progressItem: {
    marginBottom: SPACING.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressDivider: {
    height: 1,
    backgroundColor: CLEAN_THEME.border.light,
    marginVertical: SPACING.sm,
  },

  expiringAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
  },
  expiringAlertText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  casinoOfferCard: {
    backgroundColor: COLORS.cardBackgroundDark,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
    ...SHADOW.lg,
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 206, 209, 0.05)',
  },
  offerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  offerInfo: {
    flex: 1,
  },
  offerName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
    marginBottom: 2,
  },
  offerCode: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  offerDetails: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  offerDetailItem: {},
  offerDetailLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  offerDetailValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  tradeInValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  cruisesPreview: {},
  cruisesCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  cruisesCountText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cruisesList: {
    gap: SPACING.xs,
  },
  cruisePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cruisePreviewShip: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
    flex: 1,
  },
  cruisePreviewDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.6)',
  },
  bookedMini: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedMiniText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  moreCruises: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.lg,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(30, 58, 95, 0.1)',
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
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  importButton: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  importButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  agentChatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  agentChatBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  agentChatContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  agentChatExpanded: {
    top: 0,
    bottom: 0,
  },
  casinoHistorySection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  casinoHistoryHeader: {
    marginBottom: SPACING.md,
  },
  casinoHistoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  casinoHistoryTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
  },
  casinoHistorySubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    marginTop: 4,
  },
  casinoHistoryItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  casinoHistoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  casinoHistoryShipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  casinoHistoryShipName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  casinoHistoryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  casinoHistoryDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  casinoHistoryItinerary: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#4B5563',
    marginBottom: SPACING.sm,
  },
  casinoHistoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  casinoHistoryStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  casinoHistoryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SPACING.sm,
  },
  casinoHistoryStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  casinoHistoryStatValuePoints: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4A574',
  },
  casinoHistoryStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#94A3B8',
  },
});
