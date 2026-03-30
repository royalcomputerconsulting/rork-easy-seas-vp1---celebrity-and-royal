import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Linking, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  X,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Ship,
  DollarSign,
  Tag,
} from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, COLORS } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise, CasinoOffer } from '@/types/models';
import { useAppState } from '@/state/AppStateProvider';
import { getCabinPriceFromEntity, GUEST_COUNT_DEFAULT } from '@/lib/valueCalculator';

interface CasinoOfferCardProps {
  offerCode: string;
  offerName: string;
  expiryDate?: string;
  tradeInValue?: number;
  freePlay?: number;
  obc?: number;
  cruises: Cruise[];
  onPress?: () => void;
  onCruisePress?: (cruiseId: string) => void;
  bookedCruiseIds?: Set<string>;
  isActive?: boolean;
  isBestValue?: boolean;
}

interface OfferSummaryCardProps {
  totalValue: number;
  totalCruises: number;
  totalOffers: number;
  onSoonestPress?: () => void;
  onHighestValuePress?: () => void;
  activeSortMode?: 'soonest' | 'highestValue';
}

export const OfferSummaryCard = React.memo(function OfferSummaryCard({
  totalValue,
  totalCruises,
  totalOffers,
  onSoonestPress,
  onHighestValuePress,
  activeSortMode = 'soonest',
}: OfferSummaryCardProps) {
  return (
    <View style={summaryStyles.container}>
      <ImageBackground 
        source={{ uri: JACKPOT_BG }} 
        style={summaryStyles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0, 151, 167, 0.9)', 'rgba(30, 58, 95, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={summaryStyles.gradientOverlay}
        >
          <View style={summaryStyles.header}>
            <View style={summaryStyles.titleRow}>
              <Sparkles size={22} color="#FEF3C7" />
              <Text style={summaryStyles.title}>Offer Summary</Text>
            </View>
          </View>

          <View style={summaryStyles.statsRow}>
            <View style={summaryStyles.statItem}>
              <View style={summaryStyles.statIconContainer}>
                <DollarSign size={18} color="#A7F3D0" />
              </View>
              <View>
                <Text style={summaryStyles.statLabel}>Total Value</Text>
                <Text style={[summaryStyles.statValue, summaryStyles.valueText]}>
                  ${totalValue > 0 ? totalValue.toLocaleString() : '---'}
                </Text>
              </View>
            </View>

            <View style={summaryStyles.statItem}>
              <View style={summaryStyles.statIconContainer}>
                <Ship size={18} color="#BAE6FD" />
              </View>
              <View>
                <Text style={summaryStyles.statLabel}>Total Cruises</Text>
                <Text style={summaryStyles.statValue}>{totalCruises}</Text>
              </View>
            </View>

            <View style={summaryStyles.statItem}>
              <View style={summaryStyles.statIconContainer}>
                <Tag size={18} color="#FBBF24" />
              </View>
              <View>
                <Text style={summaryStyles.statLabel}>Offers</Text>
                <Text style={summaryStyles.statValue}>{totalOffers}</Text>
              </View>
            </View>
          </View>

          <View style={summaryStyles.buttonRow}>
            <TouchableOpacity 
              style={[
                summaryStyles.filterButton, 
                activeSortMode === 'soonest' && summaryStyles.filterButtonActive
              ]} 
              onPress={onSoonestPress}
              activeOpacity={0.8}
            >
              <Text style={[
                summaryStyles.filterButtonText,
                activeSortMode !== 'soonest' && summaryStyles.filterButtonTextInactive
              ]}>Sort by Soonest Expiring Offer</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                summaryStyles.filterButton, 
                activeSortMode === 'highestValue' && summaryStyles.filterButtonActive
              ]} 
              onPress={onHighestValuePress}
              activeOpacity={0.8}
            >
              <Text style={[
                summaryStyles.filterButtonText,
                activeSortMode !== 'highestValue' && summaryStyles.filterButtonTextInactive
              ]}>Sort by Value</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
});

// Keep JackpotDealsCard for backwards compatibility but mark as deprecated
/** @deprecated Use OfferSummaryCard instead */
export const JackpotDealsCard = OfferSummaryCard;

const JACKPOT_BG = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80';

const summaryStyles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  backgroundImage: {
    width: '100%',
  },
  gradientOverlay: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  valueText: {
    color: '#A7F3D0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  filterButtonTextInactive: {
    color: '#FFFFFF',
  },
});

export const CasinoOfferCard = React.memo(function CasinoOfferCard({
  offerCode,
  offerName,
  expiryDate,
  tradeInValue,
  freePlay,
  obc,
  cruises,
  onPress,
  onCruisePress,
  bookedCruiseIds = new Set(),
  isActive = true,
  isBestValue = false,
}: CasinoOfferCardProps) {
  const { localData } = useAppState();
  const [showOfferImage, setShowOfferImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  const offerImageUrl = useMemo(() => {
    if (cruises.length > 0) {
      const firstCruise = cruises[0];
      return getUniqueImageForCruise(
        firstCruise.id,
        firstCruise.destination,
        firstCruise.sailDate,
        firstCruise.shipName
      );
    }
    return DEFAULT_CRUISE_IMAGE;
  }, [cruises]);

  const [cardImageUri, setCardImageUri] = useState<string>(offerImageUrl);

  const offerDetails = useMemo(() => {
    const offer = (localData.offers || []).find(
      (o: CasinoOffer) => o.offerCode === offerCode
    );
    
    if (!offer && cruises.length > 0) {
      const firstCruise = cruises[0];
      return {
        roomType: firstCruise.cabinType,
        perks: firstCruise.perks || [],
        receivedDate: undefined,
        tradeInValue: tradeInValue || 0,
        totalCruises: cruises.length,
        totalValue: 0,
        averageValue: 0,
      };
    }

    const totalValue = cruises.reduce((sum, cruise) => {
      const price = cruise.totalPrice || cruise.price || 0;
      return sum + price;
    }, 0);

    const averageValue = cruises.length > 0 ? totalValue / cruises.length : 0;

    return {
      roomType: offer?.roomType || cruises[0]?.cabinType || 'N/A',
      perks: offer?.perks || [],
      receivedDate: offer?.received,
      tradeInValue: offer?.tradeInValue || tradeInValue || 0,
      totalCruises: cruises.length,
      totalValue,
      averageValue,
    };
  }, [localData.offers, offerCode, cruises, tradeInValue]);
  
  const getActualOfferImageUrl = (code: string): string => {
    return `https://image.royalcaribbeanmarketing.com/lib/fe9415737666017570/m/1/${code}.jpg`;
  };

  const handleOpenInBrowser = async () => {
    const url = getActualOfferImageUrl(offerCode);
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[CasinoOfferCard] Error opening URL:', error);
    }
  };

  const getStatusBadge = () => {
    if (!isActive) {
      return { text: 'EXPIRED', bg: '#EF4444' };
    }
    if (isBestValue) {
      return { text: 'BEST VALUE', bg: COLORS.success };
    }
    return { text: 'ACTIVE', bg: COLORS.success };
  };

  const statusBadge = getStatusBadge();

  const getExpiryDaysLeft = () => {
    if (!expiryDate) return null;
    const expiry = createDateFromString(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const expiryDays = getExpiryDaysLeft();

  const firstCruise = cruises[0];

  const aggregateValue = useMemo(() => {
    if (cruises.length === 0) return null;
    
    const roomType = offerDetails.roomType || 'Balcony';
    let totalCabinValue = 0;
    let totalTaxesFees = 0;
    let totalOfferValue = 0;
    
    // Base rates per night for cabin type estimation
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
    
    cruises.forEach(cruise => {
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
      
      totalCabinValue += cabinValueForTwo;
      totalTaxesFees += taxesFees;
      totalOfferValue += cruise.offerValue || 0;
    });
    
    const totalFreePlay = firstCruise?.freePlay || freePlay || 0;
    const totalOBC = firstCruise?.freeOBC || obc || 0;
    const aggregateTotalValue = totalCabinValue + totalTaxesFees + totalFreePlay + totalOBC + totalOfferValue;
    
    console.log('[CasinoOfferCard] Aggregate value calculated:', {
      offerCode,
      roomType,
      cruiseCount: cruises.length,
      totalCabinValue,
      totalTaxesFees,
      totalFreePlay,
      totalOBC,
      totalOfferValue,
      aggregateTotalValue,
    });
    
    return {
      totalCabinValue,
      totalTaxesFees,
      totalFreePlay,
      totalOBC,
      totalOfferValue,
      aggregateTotalValue,
      cruiseCount: cruises.length,
    };
  }, [cruises, offerDetails.roomType, firstCruise, freePlay, obc, offerCode]);

  const totalValue = useMemo(() => {
    if (aggregateValue && aggregateValue.aggregateTotalValue > 0) {
      return aggregateValue.aggregateTotalValue;
    }
    
    // Base rates per night for cabin type estimation
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
    
    let total = 0;
    if (firstCruise) {
      const roomType = offerDetails.roomType || firstCruise.cabinType || 'Balcony';
      let cabinPrice = getCabinPriceFromEntity(firstCruise, roomType) || firstCruise.price || 0;
      
      // Estimate cabin price if not available
      if (cabinPrice === 0 && firstCruise.nights > 0) {
        const typeKey = Object.keys(baseRates).find(key => 
          roomType.toLowerCase().includes(key.toLowerCase())
        ) || 'Balcony';
        cabinPrice = (baseRates[typeKey] || 180) * (firstCruise.nights || 7);
      }
      
      const guestCount = firstCruise.guests || GUEST_COUNT_DEFAULT;
      const cabinValueForTwo = cabinPrice * guestCount;
      
      // Estimate taxes if not provided (~$30/night per guest)
      let taxes = firstCruise.taxes || 0;
      if (taxes === 0 && firstCruise.nights > 0) {
        taxes = Math.round((firstCruise.nights || 7) * 30 * guestCount);
      }
      
      const freePlayValue = firstCruise.freePlay || freePlay || 0;
      const obcValue = firstCruise.freeOBC || obc || 0;
      
      total = cabinValueForTwo + taxes + freePlayValue + obcValue;
      
      console.log('[CasinoOfferCard] Total value calculated:', {
        offerCode,
        roomType,
        cabinPrice,
        guestCount,
        cabinValueForTwo,
        taxes,
        freePlayValue,
        obcValue,
        total,
      });
    }
    
    return total;
  }, [firstCruise, obc, freePlay, aggregateValue, offerCode, offerDetails.roomType]);

  const uniqueDestinations = useMemo(() => {
    const destinations = new Set<string>();
    cruises.forEach(cruise => {
      if (cruise.destination) {
        destinations.add(cruise.destination);
      }
    });
    return Array.from(destinations);
  }, [cruises]);

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      testID="casino-offer-card"
    >
      {/* OFFER NAME & CODE - BLACK BOLD AT TOP */}
      <View style={styles.offerHeaderSection}>
        <Text style={styles.offerNameHeader}>{offerName}</Text>
        <View style={styles.offerCodeHeaderBadge}>
          <Text style={styles.offerCodeHeaderText}>CODE: {offerCode}</Text>
        </View>
      </View>

      {/* IMAGE SECTION */}
      <View style={styles.imageSection}>
        <Image 
          source={{ uri: cardImageUri }} 
          style={styles.heroImage}
          resizeMode="cover"
          onError={() => setCardImageUri(DEFAULT_CRUISE_IMAGE)}
        />
        
        <View style={[styles.statusBadgeLarge, { backgroundColor: statusBadge.bg }]}>
          <Text style={styles.statusBadgeLargeText}>{statusBadge.text}</Text>
        </View>

        {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && (
          <View style={styles.expiryAlertBadge}>
            <Clock size={14} color={COLORS.white} />
            <Text style={styles.expiryAlertText}>Expires in {expiryDays} days</Text>
          </View>
        )}

        <View style={styles.cruiseCountBadge}>
          <Text style={styles.cruiseCountBadgeText}>
            {offerDetails.totalCruises} cruise{offerDetails.totalCruises !== 1 ? 's' : ''} available
          </Text>
        </View>
      </View>

      {/* CONTENT SECTION */}
      <View style={styles.contentSection}>
        {/* Destinations */}
        {uniqueDestinations.length > 0 && (
          <View style={styles.destinationsRow}>
            <Text style={styles.destLabel}>DESTINATIONS</Text>
            <Text style={styles.destValue} numberOfLines={2}>
              {uniqueDestinations.join(' • ')}
            </Text>
          </View>
        )}

        {/* Key Info Row: Room Type, Expiration, Total Value */}
        <View style={styles.keyInfoRow}>
          {offerDetails.roomType && offerDetails.roomType !== 'N/A' && (
            <View style={styles.roomTypeBadge}>
              <Text style={styles.roomTypeBadgeLabel}>ROOM TYPE</Text>
              <Text style={styles.roomTypeBadgeValue}>{offerDetails.roomType}</Text>
            </View>
          )}
          {expiryDate && (
            <View style={[styles.expiryBadge, expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && styles.expiryBadgeUrgent]}>
              <Clock size={14} color={expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? '#DC2626' : COLORS.navyDeep} />
              <View>
                <Text style={styles.expiryBadgeLabel}>EXPIRES</Text>
                <Text style={[styles.expiryBadgeValue, expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && styles.expiryBadgeValueUrgent]}>
                  {createDateFromString(expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.totalValueCompact}>
            <Text style={styles.totalValueCompactLabel}>
              TOTAL VALUE{aggregateValue && aggregateValue.cruiseCount > 1 ? ` (${aggregateValue.cruiseCount})` : ''}
            </Text>
            <Text style={styles.totalValueCompactAmount}>
              ${totalValue > 0 ? Math.round(totalValue).toLocaleString() : '---'}
            </Text>
          </View>
        </View>

        {/* ACTION ROW */}
        <View style={styles.actionRowLarge}>
          <TouchableOpacity style={styles.primaryButtonLarge} onPress={onPress}>
            <Text style={styles.primaryButtonTextLarge}>View All Cruises</Text>
            <ChevronRight size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showOfferImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOfferImage(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offer: {offerCode}</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowOfferImage(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalImageContainer}>
              {imageError ? (
                <View style={styles.imageErrorContainer}>
                  <Text style={styles.imageErrorTitle}>Image Not Available</Text>
                  <Text style={styles.imageErrorText}>
                    This offer code ({offerCode}) does not have an image on Royal Caribbean&apos;s server.
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: getActualOfferImageUrl(offerCode) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                  onError={() => setImageError(true)}
                />
              )}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.openInBrowserButton}
                onPress={handleOpenInBrowser}
              >
                <ExternalLink size={16} color={COLORS.navyDeep} />
                <Text style={styles.openInBrowserText}>Open in Browser</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setShowOfferImage(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  offerHeaderSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  offerNameHeader: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#000000',
    marginBottom: 6,
  },
  offerCodeHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
  },
  offerCodeHeaderText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  imageSection: {
    height: 80,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  statusBadgeLarge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  statusBadgeLargeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  expiryAlertBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  expiryAlertText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  cruiseCountBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.85)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  cruiseCountBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  contentSection: {
    padding: SPACING.md,
  },
  keyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  roomTypeBadge: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  roomTypeBadgeLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  roomTypeBadgeValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expiryBadgeUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  expiryBadgeLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
  },
  expiryBadgeValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  expiryBadgeValueUrgent: {
    color: '#DC2626',
  },
  totalValueCompact: {
    marginLeft: 'auto' as const,
    alignItems: 'flex-end',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  totalValueCompactLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  totalValueCompactAmount: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#2E7D32',
  },
  destinationsRow: {
    marginBottom: SPACING.md,
  },
  destLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  destValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  metaRowLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  metaItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTextLarge: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  cabinBadgeLarge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinBadgeLargeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: SPACING.lg,
  },
  valueSectionLarge: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valueBreakdownSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  valueBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  valueBreakdownLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  valueBreakdownAmount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  valueRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueColumn: {},
  valueLabelLarge: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  valueAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valueDollarLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  valueAmountLarge: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  tradeInColumn: {
    alignItems: 'flex-end',
  },
  tradeInValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeInAmountLarge: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  perksSectionLarge: {
    marginBottom: SPACING.lg,
  },
  perksHeaderLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  perkItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  perkTextContainer: {},
  perkLabelLarge: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  perkValueLarge: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  actionRowLarge: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  primaryButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
  },
  primaryButtonTextLarge: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    aspectRatio: 0.65,
    backgroundColor: '#F9FAFB',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  openInBrowserButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.goldAccent,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  openInBrowserText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  closeModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  closeModalButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  imageErrorTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  imageErrorText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#6B7280',
    textAlign: 'center',
  },
});
