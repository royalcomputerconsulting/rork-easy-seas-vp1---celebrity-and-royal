import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  Dice5,
  DollarSign,
  Edit3,
  Gift,
  MapPin,
  Ship,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING } from '@/constants/theme';
import { formatCurrency, formatNights } from '@/lib/format';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise, CasinoOffer, Cruise, ItineraryDay } from '@/types/models';
import type { ValueBreakdown } from '@/lib/valueCalculator';
import type { CruiseCasinoSummary, PersonalizedPlayEstimate } from '@/lib/casinoAvailability';

type DetailTone = 'default' | 'money' | 'success' | 'gold' | 'danger' | 'muted';

type DetailItem = {
  label: string;
  value: string;
  tone?: DetailTone;
};

type MonetaryTile = {
  label: string;
  value: string;
  tone?: DetailTone;
};

interface CruiseDetailsOverviewProps {
  cruise: Cruise | BookedCruise;
  linkedOffer?: CasinoOffer;
  heroImageUri: string;
  accurateNights: number;
  daysUntil: number;
  isBooked: boolean;
  hasPerks: boolean;
  valueBreakdown: ValueBreakdown | null;
  casinoAvailability: CruiseCasinoSummary | null;
  personalizedPlayEstimate: PersonalizedPlayEstimate | null;
  itineraryDays: ItineraryDay[];
  onEditPress: () => void;
  onBookPress: () => void;
  onUnbookPress: () => void;
  onEditCasinoPress: () => void;
}

const LIGHT_TEXTURE_COLORS = ['#FBFDFF', '#EFF6FD', '#E4EEF9', '#DCE9F5'] as const;
const LIGHT_TEXTURE_VEINS = ['rgba(255,255,255,0.98)', 'rgba(186,208,229,0.28)', 'rgba(255,255,255,0.18)', 'rgba(156,188,216,0.20)'] as const;
const LIGHT_TEXTURE_LOCATIONS = [0, 0.22, 0.72, 1] as const;
const ANALYSIS_TEXTURE_COLORS = ['#2B4367', '#4D497E', '#6A4782'] as const;
const ANALYSIS_TEXTURE_VEINS = ['rgba(255,255,255,0.10)', 'rgba(145,181,214,0.14)', 'rgba(255,255,255,0.04)', 'rgba(217,184,255,0.08)'] as const;

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function getToneColor(tone: DetailTone = 'default'): string {
  switch (tone) {
    case 'money':
      return COLORS.moneyDark;
    case 'success':
      return COLORS.success;
    case 'gold':
      return COLORS.goldDark;
    case 'danger':
      return COLORS.error;
    case 'muted':
      return COLORS.textSecondary;
    default:
      return COLORS.navyDeep;
  }
}

function getTileBackground(tone: DetailTone = 'default'): string {
  switch (tone) {
    case 'money':
      return 'rgba(5,150,105,0.10)';
    case 'success':
      return 'rgba(5,150,105,0.10)';
    case 'gold':
      return 'rgba(212,160,10,0.12)';
    case 'danger':
      return 'rgba(220,38,38,0.10)';
    case 'muted':
      return 'rgba(17,24,39,0.04)';
    default:
      return 'rgba(255,255,255,0.72)';
  }
}

function getTileBorder(tone: DetailTone = 'default'): string {
  switch (tone) {
    case 'money':
      return 'rgba(5,150,105,0.18)';
    case 'success':
      return 'rgba(5,150,105,0.18)';
    case 'gold':
      return 'rgba(212,160,10,0.24)';
    case 'danger':
      return 'rgba(220,38,38,0.18)';
    case 'muted':
      return 'rgba(17,24,39,0.08)';
    default:
      return 'rgba(197,213,228,0.78)';
  }
}

function formatCruiseDateRange(sailDate: string, returnDate?: string, nights?: number): string {
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
}

function getItineraryMetaText(day: ItineraryDay): string {
  if (day.isSeaDay) {
    return 'Sea day';
  }

  if (day.arrival && day.departure) {
    return `${day.arrival} - ${day.departure}`;
  }

  if (day.arrival) {
    return `From ${day.arrival} • Overnight`;
  }

  if (day.departure) {
    return `Until ${day.departure}`;
  }

  return day.notes || 'Port window inferred';
}

export const CruiseDetailsOverview = memo(function CruiseDetailsOverview({
  cruise,
  linkedOffer,
  heroImageUri,
  accurateNights,
  daysUntil,
  isBooked,
  hasPerks,
  valueBreakdown,
  casinoAvailability,
  personalizedPlayEstimate,
  itineraryDays,
  onEditPress,
  onBookPress,
  onUnbookPress,
  onEditCasinoPress,
}: CruiseDetailsOverviewProps) {
  console.log('[CruiseDetailsOverview] Rendering cruise overview', {
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    isBooked,
    hasPerks,
    itineraryDays: itineraryDays.length,
  });

  const bookedCruise = cruise as BookedCruise;
  const itineraryTitle = cruise.itineraryName || cruise.destination || 'Cruise';
  const heroDateLabel = useMemo(() => formatCruiseDateRange(cruise.sailDate, bookedCruise.returnDate, accurateNights), [accurateNights, bookedCruise.returnDate, cruise.sailDate]);
  const offerCode = bookedCruise.offerCode || cruise.offerCode || linkedOffer?.offerCode || '';
  const offerTitle = linkedOffer?.offerName || linkedOffer?.title || bookedCruise.offerName || cruise.offerName || (offerCode ? `Offer ${offerCode}` : 'Cruise offer');
  const departureLabel = cruise.departurePort || cruise.destination || 'Featured sailing';
  const routeSummary = useMemo(() => {
    const itineraryPorts = bookedCruise.itinerary?.map((day) => day.port).filter(Boolean) ?? [];
    const cruisePorts = bookedCruise.ports ?? [];
    const ports = itineraryPorts.length > 0 ? itineraryPorts : cruisePorts;
    return ports.length > 0 ? ports.slice(0, 5).join(' • ') : cruise.destination || 'Open route';
  }, [bookedCruise.itinerary, bookedCruise.ports, cruise.destination]);

  const statusLabel = useMemo(() => {
    if (!isBooked) {
      return 'AVAILABLE';
    }

    if (bookedCruise.returnDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(bookedCruise.returnDate);
      sailDate.setHours(0, 0, 0, 0);
      returnDate.setHours(23, 59, 59, 999);

      if (today > returnDate) {
        return 'COMPLETED';
      }

      if (today >= sailDate && today <= returnDate) {
        return 'ON BOARD';
      }
    }

    return 'BOOKED';
  }, [bookedCruise.returnDate, cruise.sailDate, isBooked]);

  const statusTone = useMemo((): DetailTone => {
    switch (statusLabel) {
      case 'ON BOARD':
        return 'gold';
      case 'BOOKED':
        return 'success';
      case 'COMPLETED':
        return 'muted';
      default:
        return 'default';
    }
  }, [statusLabel]);

  const summaryTiles = useMemo((): DetailItem[] => {
    const tiles: DetailItem[] = [
      { label: 'Sail Date', value: heroDateLabel },
      { label: 'Guests', value: `${bookedCruise.guestNames?.length || cruise.guests || 2}` },
      { label: 'Cabin', value: cruise.cabinType || bookedCruise.stateroomType || 'TBD', tone: 'gold' },
      {
        label: 'Casino',
        value: casinoAvailability ? `${casinoAvailability.casinoOpenDays}/${casinoAvailability.totalDays} open` : 'Pending',
      },
    ];

    return tiles;
  }, [bookedCruise.guestNames?.length, bookedCruise.stateroomType, casinoAvailability, cruise.cabinType, cruise.guests, heroDateLabel]);

  const offerMonetaryTiles = useMemo((): MonetaryTile[] => {
    const items: MonetaryTile[] = [];

    if (valueBreakdown && valueBreakdown.totalRetailValue > 0) {
      items.push({ label: 'Total Value', value: formatCurrency(valueBreakdown.totalRetailValue), tone: 'money' });
    }

    if ((cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount ?? 0) > 0) {
      items.push({ label: 'FreePlay', value: formatCurrency(cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount ?? 0), tone: 'money' });
    }

    if ((cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount ?? 0) > 0) {
      items.push({ label: 'OBC', value: formatCurrency(cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount ?? 0), tone: 'default' });
    }

    if ((cruise.tradeInValue ?? linkedOffer?.tradeInValue ?? 0) > 0) {
      items.push({ label: 'Trade-In', value: formatCurrency(cruise.tradeInValue ?? linkedOffer?.tradeInValue ?? 0), tone: 'gold' });
    }

    return items;
  }, [cruise.freeOBC, cruise.freePlay, cruise.tradeInValue, linkedOffer?.OBC, linkedOffer?.freePlay, linkedOffer?.freeplayAmount, linkedOffer?.obcAmount, linkedOffer?.tradeInValue, valueBreakdown]);

  const perkChips = useMemo((): string[] => {
    const chips: string[] = [];

    if (offerCode) {
      chips.push(offerCode);
    }
    if (cruise.freeGratuities) {
      chips.push('Gratuities');
    }
    if (cruise.freeDrinkPackage) {
      chips.push('Drinks');
    }
    if (cruise.freeWifi) {
      chips.push('WiFi');
    }
    if (cruise.freeSpecialtyDining) {
      chips.push('Dining');
    }
    if (bookedCruise.usedNextCruiseCertificate) {
      chips.push('NCC');
    }

    return chips;
  }, [bookedCruise.usedNextCruiseCertificate, cruise.freeDrinkPackage, cruise.freeGratuities, cruise.freeSpecialtyDining, cruise.freeWifi, offerCode]);

  const snapshotItems = useMemo((): DetailItem[] => {
    const items: DetailItem[] = [];

    if (isBooked) {
      if (hasValue(bookedCruise.bookingId)) {
        items.push({ label: 'Booking ID', value: String(bookedCruise.bookingId) });
      }
      if (hasValue(bookedCruise.reservationNumber)) {
        items.push({ label: 'Reservation', value: String(bookedCruise.reservationNumber) });
      }
      if (hasValue(bookedCruise.packageCode)) {
        items.push({ label: 'Package', value: String(bookedCruise.packageCode) });
      }
      if (hasValue(bookedCruise.stateroomNumber)) {
        items.push({ label: 'Stateroom', value: String(bookedCruise.stateroomNumber) });
      }
      if (hasValue(bookedCruise.deckNumber)) {
        items.push({ label: 'Deck', value: String(bookedCruise.deckNumber) });
      }
      if (hasValue(bookedCruise.musterStation)) {
        items.push({ label: 'Muster', value: String(bookedCruise.musterStation) });
      }
      if (hasValue(bookedCruise.bookingStatus)) {
        items.push({ label: 'Booking Status', value: String(bookedCruise.bookingStatus), tone: 'success' });
      }
      const paidInFull = (bookedCruise as BookedCruise & { paidInFull?: string | boolean }).paidInFull;
      items.push({
        label: 'Paid in Full',
        value: paidInFull === 'Yes' || paidInFull === true ? 'Yes' : 'No',
        tone: paidInFull === 'Yes' || paidInFull === true ? 'success' : 'muted',
      });
      if (hasValue((bookedCruise as unknown as { guestNames?: string[] }).guestNames) && (bookedCruise.guestNames?.length ?? 0) > 0) {
        items.push({ label: 'Guests', value: bookedCruise.guestNames?.join(', ') || `${cruise.guests || 2}` });
      }
    } else {
      items.push({ label: 'Departure', value: departureLabel });
      items.push({ label: 'Route', value: routeSummary });
    }

    return items;
  }, [bookedCruise, cruise.guests, departureLabel, isBooked, routeSummary]);

  const pricingItems = useMemo((): DetailItem[] => {
    const items: DetailItem[] = [];

    if ((cruise.interiorPrice ?? 0) > 0) {
      items.push({ label: 'Interior', value: formatCurrency(cruise.interiorPrice ?? 0) });
    }
    if ((cruise.oceanviewPrice ?? 0) > 0) {
      items.push({ label: 'Oceanview', value: formatCurrency(cruise.oceanviewPrice ?? 0) });
    }
    if ((cruise.balconyPrice ?? 0) > 0) {
      items.push({ label: 'Balcony', value: formatCurrency(cruise.balconyPrice ?? 0), tone: 'gold' });
    }
    if ((cruise.suitePrice ?? 0) > 0) {
      items.push({ label: 'Suite', value: formatCurrency(cruise.suitePrice ?? 0), tone: 'gold' });
    }
    if ((cruise.taxes ?? 0) > 0) {
      items.push({ label: 'Taxes & Fees', value: formatCurrency(cruise.taxes ?? 0) });
    }

    return items;
  }, [cruise.balconyPrice, cruise.interiorPrice, cruise.oceanviewPrice, cruise.suitePrice, cruise.taxes]);

  const bookingPayloadItems = useMemo((): DetailItem[] => {
    if (!isBooked) {
      return [];
    }

    const payload: DetailItem[] = [];
    const source = bookedCruise as BookedCruise & Record<string, unknown>;
    const rawItems: { label: string; value: unknown }[] = [
      { label: 'Booking Channel', value: source.bookingChannel },
      { label: 'Booking Currency', value: source.bookingCurrency },
      { label: 'Office Country', value: source.bookingOfficeCountryCode },
      { label: 'Booking Type', value: source.bookingType },
      { label: 'Brand', value: source.brand },
      { label: 'Consumer ID', value: source.consumerId },
      { label: 'Grantor Passenger', value: source.grantorPassengerId },
      { label: 'Last Name', value: source.lastName },
      { label: 'Link Flow', value: source.linkFlow },
      { label: 'Link Type', value: source.linkType },
      { label: 'Master Booking ID', value: source.masterBookingId },
      { label: 'Master Passenger ID', value: source.masterPassengerId },
      { label: 'Ship Code', value: source.shipCode },
      { label: 'Office Code', value: source.officeCode },
      { label: 'Passenger ID', value: source.passengerId },
      { label: 'Stateroom Description', value: source.stateroomDescription },
      { label: 'Stateroom Subtype', value: source.stateroomSubtype },
      { label: 'International Booking', value: typeof source.isInternationalBooking === 'boolean' ? (source.isInternationalBooking ? 'Yes' : 'No') : null },
      { label: 'Boarding Express', value: typeof source.isBoardingExpressEnabled === 'boolean' ? (source.isBoardingExpressEnabled ? 'Enabled' : 'Disabled') : null },
      { label: 'Direct Booking', value: typeof source.isDirect === 'boolean' ? (source.isDirect ? 'Yes' : 'No') : null },
      { label: 'Preferred', value: typeof source.preferred === 'boolean' ? (source.preferred ? 'Yes' : 'No') : null },
    ];

    rawItems.forEach((item) => {
      if (hasValue(item.value)) {
        payload.push({ label: item.label, value: String(item.value) });
      }
    });

    return payload;
  }, [bookedCruise, isBooked]);

  const analysisNote = useMemo(() => {
    if (!casinoAvailability) {
      return 'Casino windows will appear when itinerary analysis is available.';
    }

    if (personalizedPlayEstimate && personalizedPlayEstimate.estimatedPoints > 0) {
      return `${casinoAvailability.casinoOpenDays} playable night${casinoAvailability.casinoOpenDays === 1 ? '' : 's'} with about ${personalizedPlayEstimate.estimatedPlayHours.toFixed(1)} projected hours.`;
    }

    return casinoAvailability.gamblingWindowsDescription || 'Focus on sea days and foreign-port evenings for the strongest casino access.';
  }, [casinoAvailability, personalizedPlayEstimate]);

  const valueRows = useMemo((): DetailItem[] => {
    if (!valueBreakdown) {
      return [];
    }

    return [
      { label: 'Retail', value: formatCurrency(valueBreakdown.totalRetailValue) },
      { label: 'Paid', value: formatCurrency(valueBreakdown.amountPaid) },
      { label: 'Comp', value: formatCurrency(valueBreakdown.compValue), tone: 'money' },
      { label: 'True Cost', value: formatCurrency(valueBreakdown.trueOutOfPocket) },
    ];
  }, [valueBreakdown]);

  const headerActionLabel = isBooked ? 'Unbook' : 'Book';

  return (
    <View style={styles.container} testID="cruise-detail-overview">
      <LinearGradient
        colors={LIGHT_TEXTURE_COLORS}
        locations={LIGHT_TEXTURE_LOCATIONS}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <LinearGradient
          colors={LIGHT_TEXTURE_VEINS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.14, y: 0 }}
          end={{ x: 0.86, y: 1 }}
          style={styles.textureVein}
        />
        <View style={styles.heroBanner}>
          <Image source={{ uri: heroImageUri }} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(10,24,49,0.10)', 'rgba(10,24,49,0.46)', 'rgba(10,24,49,0.82)']}
            locations={[0, 0.56, 1]}
            start={{ x: 0.4, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBannerTopRow}>
            <View style={[styles.statusPill, { backgroundColor: getTileBackground(statusTone), borderColor: getTileBorder(statusTone) }]}>
              <Text style={[styles.statusPillText, { color: getToneColor(statusTone) }]}>{statusLabel}</Text>
            </View>
            <View style={styles.heroActionsRow}>
              <TouchableOpacity style={styles.heroActionButton} onPress={onEditPress} activeOpacity={0.85} testID="cruise-detail-edit-button">
                <Edit3 size={14} color={COLORS.white} />
                <Text style={styles.heroActionButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.heroActionButton, isBooked ? styles.heroActionButtonWarn : styles.heroActionButtonPrimary]}
                onPress={isBooked ? onUnbookPress : onBookPress}
                activeOpacity={0.85}
                testID={isBooked ? 'cruise-detail-unbook-button' : 'cruise-detail-book-button'}
              >
                {isBooked ? <Trash2 size={14} color={COLORS.white} /> : null}
                <Text style={styles.heroActionButtonText}>{headerActionLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.heroBannerBottomRow}>
            <View style={styles.heroMetaPill}>
              <MapPin size={11} color={COLORS.white} />
              <Text style={styles.heroMetaPillText}>{departureLabel}</Text>
            </View>
            <View style={styles.heroMetaPillLight}>
              <Text style={styles.heroMetaPillTextDark}>{`${accurateNights || cruise.nights}N`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroBody}>
          <View style={styles.heroTitleRow}>
            <View style={styles.heroTitleWrap}>
              <View style={styles.heroShipRow}>
                <Ship size={16} color={COLORS.goldDark} />
                <Text style={styles.heroShipName}>{cruise.shipName}</Text>
              </View>
              <Text style={styles.heroTitle}>{itineraryTitle}</Text>
            </View>
          </View>

          <View style={styles.heroChipRow}>
            {offerTitle ? (
              <View style={styles.offerBannerChip}>
                <Sparkles size={13} color={COLORS.goldDark} />
                <Text style={styles.offerBannerChipText} numberOfLines={1}>{offerTitle}</Text>
              </View>
            ) : null}
            {offerCode ? (
              <View style={styles.codeChip}>
                <Tag size={12} color={COLORS.navyDeep} />
                <Text style={styles.codeChipText}>{offerCode}</Text>
              </View>
            ) : null}
            {daysUntil > 0 ? (
              <View style={styles.daysChip}>
                <Clock size={12} color={COLORS.goldDark} />
                <Text style={styles.daysChipText}>{`${daysUntil} days until departure`}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.summaryGrid}>
            {summaryTiles.map((tile) => (
              <View
                key={`${tile.label}-${tile.value}`}
                style={[
                  styles.summaryTile,
                  { backgroundColor: getTileBackground(tile.tone), borderColor: getTileBorder(tile.tone) },
                ]}
              >
                <Text style={styles.summaryTileLabel}>{tile.label}</Text>
                <Text style={[styles.summaryTileValue, { color: getToneColor(tile.tone) }]} numberOfLines={2}>{tile.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {(offerMonetaryTiles.length > 0 || hasPerks || perkChips.length > 0) ? (
        <LinearGradient
          colors={LIGHT_TEXTURE_COLORS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
          testID="cruise-detail-offer-summary"
        >
          <LinearGradient
            colors={LIGHT_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Gift size={16} color={COLORS.navyDeep} />
              <Text style={styles.sectionTitle}>Offer Summary</Text>
            </View>
          </View>

          {offerMonetaryTiles.length > 0 ? (
            <View style={styles.monetaryTileRow}>
              {offerMonetaryTiles.map((tile) => (
                <View
                  key={`${tile.label}-${tile.value}`}
                  style={[
                    styles.monetaryTile,
                    { backgroundColor: getTileBackground(tile.tone), borderColor: getTileBorder(tile.tone) },
                  ]}
                >
                  <Text style={styles.monetaryTileLabel}>{tile.label}</Text>
                  <Text style={[styles.monetaryTileValue, { color: getToneColor(tile.tone) }]} numberOfLines={1}>{tile.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {perkChips.length > 0 ? (
            <View style={styles.perkChipWrap}>
              {perkChips.map((chip) => (
                <View key={chip} style={styles.perkChip}>
                  <Text style={styles.perkChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {routeSummary ? <Text style={styles.routeSummaryText}>{routeSummary}</Text> : null}
        </LinearGradient>
      ) : null}

      {snapshotItems.length > 0 ? (
        <LinearGradient
          colors={LIGHT_TEXTURE_COLORS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          <LinearGradient
            colors={LIGHT_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ship size={16} color={COLORS.navyDeep} />
              <Text style={styles.sectionTitle}>Cruise Snapshot</Text>
            </View>
          </View>
          <View style={styles.detailGrid}>
            {snapshotItems.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.detailTile}>
                <Text style={styles.detailTileLabel}>{item.label}</Text>
                <Text style={[styles.detailTileValue, { color: getToneColor(item.tone) }]} numberOfLines={item.label === 'Guests' ? 3 : 2}>{item.value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      ) : null}

      {casinoAvailability ? (
        <LinearGradient
          colors={ANALYSIS_TEXTURE_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.analysisCard}
          testID="cruise-detail-analysis"
        >
          <LinearGradient
            colors={ANALYSIS_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.analysisHeaderRow}>
            <View>
              <View style={styles.analysisTitleRow}>
                <Dice5 size={16} color={COLORS.white} />
                <Text style={styles.analysisTitle}>Itinerary & Casino Analysis</Text>
              </View>
              <Text style={styles.analysisSubtitle}>{analysisNote}</Text>
            </View>
          </View>

          <View style={styles.analysisStatsRow}>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Open Nights</Text>
              <Text style={styles.analysisStatValue}>{casinoAvailability.casinoOpenDays}</Text>
            </View>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Sea Days</Text>
              <Text style={styles.analysisStatValue}>{casinoAvailability.seaDays}</Text>
            </View>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Est. Points</Text>
              <Text style={styles.analysisStatValue}>{personalizedPlayEstimate ? `~${Math.round(personalizedPlayEstimate.estimatedPoints).toLocaleString()}` : '—'}</Text>
            </View>
          </View>

          <View style={styles.analysisStatsRow}>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Play Hours</Text>
              <Text style={styles.analysisStatValue}>{personalizedPlayEstimate ? personalizedPlayEstimate.estimatedPlayHours.toFixed(1) : '—'}</Text>
            </View>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Best Days</Text>
              <Text style={styles.analysisStatValue}>{casinoAvailability.bestGamblingDays.length > 0 ? casinoAvailability.bestGamblingDays.join(', ') : '—'}</Text>
            </View>
            <View style={styles.analysisStatTile}>
              <Text style={styles.analysisStatLabel}>Nights</Text>
              <Text style={styles.analysisStatValue}>{formatNights(accurateNights)}</Text>
            </View>
          </View>

          <View style={styles.itineraryStack}>
            {itineraryDays.map((day) => {
              const availability = casinoAvailability.dailyAvailability.find((entry) => entry.day === day.day);
              const casinoOpen = availability?.casinoOpen ?? day.isSeaDay;

              return (
                <View key={`${day.day}-${day.port}-${availability?.date || 'na'}`} style={styles.itineraryRow}>
                  <View style={styles.itineraryDayBadge}>
                    <Text style={styles.itineraryDayBadgeText}>{`D${day.day}`}</Text>
                  </View>
                  <View style={styles.itineraryBody}>
                    <Text style={styles.itineraryPort} numberOfLines={1}>{day.isSeaDay ? 'At Sea' : day.port}</Text>
                    <Text style={styles.itineraryMeta} numberOfLines={1}>{getItineraryMetaText(day)}</Text>
                  </View>
                  <View style={styles.itineraryStatusWrap}>
                    <View style={[styles.itineraryStatusDot, { backgroundColor: casinoOpen ? '#33D17A' : '#FF6B6B' }]} />
                    <Text style={styles.itineraryStatusText}>{casinoOpen ? 'Open' : 'Closed'}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {isBooked ? (
            <TouchableOpacity style={styles.analysisFooterCard} onPress={onEditCasinoPress} activeOpacity={0.85} testID="edit-casino-stats-button">
              <View style={styles.analysisFooterMetric}>
                <Text style={styles.analysisFooterLabel}>Win/Loss</Text>
                <Text style={styles.analysisFooterValue}>{`${((bookedCruise as { winnings?: number }).winnings || 0) >= 0 ? '+' : ''}${formatCurrency((bookedCruise as { winnings?: number }).winnings || 0)}`}</Text>
              </View>
              <View style={styles.analysisFooterMetric}>
                <Text style={styles.analysisFooterLabel}>Points</Text>
                <Text style={styles.analysisFooterValue}>{`${((bookedCruise as { earnedPoints?: number; casinoPoints?: number }).earnedPoints || (bookedCruise as { earnedPoints?: number; casinoPoints?: number }).casinoPoints || 0).toLocaleString()}`}</Text>
              </View>
              <View style={styles.analysisEditBadge}>
                <Edit3 size={13} color={COLORS.white} />
                <Text style={styles.analysisEditBadgeText}>Edit</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      ) : null}

      {pricingItems.length > 0 ? (
        <LinearGradient
          colors={LIGHT_TEXTURE_COLORS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          <LinearGradient
            colors={LIGHT_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <DollarSign size={16} color={COLORS.navyDeep} />
              <Text style={styles.sectionTitle}>Cabin Pricing</Text>
            </View>
          </View>
          <View style={styles.detailGrid}>
            {pricingItems.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.detailTile}>
                <Text style={styles.detailTileLabel}>{item.label}</Text>
                <Text style={[styles.detailTileValue, { color: getToneColor(item.tone) }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      ) : null}

      {valueBreakdown ? (
        <LinearGradient
          colors={LIGHT_TEXTURE_COLORS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
          testID="cruise-detail-value-summary"
        >
          <LinearGradient
            colors={LIGHT_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <DollarSign size={16} color={COLORS.navyDeep} />
              <Text style={styles.sectionTitle}>Value Summary</Text>
            </View>
            <TouchableOpacity style={styles.iconEditButton} onPress={onEditPress} activeOpacity={0.85}>
              <Edit3 size={14} color={COLORS.navyDeep} />
            </TouchableOpacity>
          </View>

          <View style={styles.valueRowsWrap}>
            {valueRows.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.valueRow}>
                <Text style={styles.valueRowLabel}>{item.label}</Text>
                <Text style={[styles.valueRowValue, { color: getToneColor(item.tone) }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.netValueCard}>
            <Text style={styles.netValueLabel}>Net Value</Text>
            <Text style={[styles.netValueAmount, { color: valueBreakdown.netValue >= 0 ? COLORS.moneyDark : COLORS.error }]}>
              {valueBreakdown.netValue >= 0 ? '+' : ''}{formatCurrency(valueBreakdown.netValue)}
            </Text>
          </View>

          <View style={styles.coverageRail}>
            <View style={[styles.coverageFill, { width: `${Math.min(100, valueBreakdown.coverageFraction * 100)}%` }]} />
          </View>
          <Text style={styles.coverageCopy}>
            {(valueBreakdown.coverageFraction * 100).toFixed(0)}% Coverage{valueBreakdown.isFullyComped ? ' • Fully Comped' : ''}
          </Text>
        </LinearGradient>
      ) : null}

      {bookingPayloadItems.length > 0 ? (
        <LinearGradient
          colors={LIGHT_TEXTURE_COLORS}
          locations={LIGHT_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          <LinearGradient
            colors={LIGHT_TEXTURE_VEINS}
            locations={LIGHT_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Tag size={16} color={COLORS.navyDeep} />
              <Text style={styles.sectionTitle}>Booking Data</Text>
            </View>
          </View>
          <View style={styles.detailGrid}>
            {bookingPayloadItems.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.detailTile}>
                <Text style={styles.detailTileLabel}>{item.label}</Text>
                <Text style={[styles.detailTileValue, { color: getToneColor(item.tone) }]} numberOfLines={2}>{item.value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(205,220,235,0.96)',
    backgroundColor: COLORS.white,
    ...SHADOW.lg,
    shadowColor: '#091B2D',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  sectionCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(205,220,235,0.96)',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    ...SHADOW.md,
    shadowColor: '#0B1A2D',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  analysisCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(103,117,168,0.36)',
    padding: SPACING.lg,
    ...SHADOW.lg,
    shadowColor: '#241632',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  textureVein: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  heroBanner: {
    height: 130,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerTopRow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  heroBannerBottomRow: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,24,39,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroActionButtonPrimary: {
    backgroundColor: 'rgba(15,24,39,0.72)',
  },
  heroActionButtonWarn: {
    backgroundColor: 'rgba(185,28,28,0.72)',
  },
  heroActionButtonText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexShrink: 1,
  },
  heroMetaPillLight: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  heroMetaPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
    flexShrink: 1,
  },
  heroMetaPillTextDark: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  heroBody: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 6,
  },
  heroShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroShipName: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  heroTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800' as const,
    color: '#172B43',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.25,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  offerBannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(249,239,209,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(220,188,93,0.36)',
  },
  offerBannerChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.goldDark,
    maxWidth: 220,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(196,210,224,0.84)',
  },
  codeChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  daysChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,250,232,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(220,188,93,0.28)',
  },
  daysChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.goldDark,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  summaryTile: {
    width: '48%',
    minHeight: 78,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  summaryTileLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textSecondary,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  summaryTileValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800' as const,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#172B43',
  },
  monetaryTileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  monetaryTile: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  monetaryTileLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  monetaryTileValue: {
    fontSize: 20,
    fontWeight: '800' as const,
  },
  perkChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  perkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(196,210,224,0.84)',
  },
  perkChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  routeSummaryText: {
    marginTop: SPACING.md,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.navyLight,
    fontWeight: '600' as const,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  detailTile: {
    width: '48%',
    minHeight: 74,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
    gap: 6,
  },
  detailTileLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  detailTileValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  analysisHeaderRow: {
    marginBottom: SPACING.md,
  },
  analysisTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  analysisSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.84)',
    fontWeight: '600' as const,
  },
  analysisStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  analysisStatTile: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 72,
    justifyContent: 'space-between',
  },
  analysisStatLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  analysisStatValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  itineraryStack: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  itineraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  itineraryDayBadge: {
    width: 40,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  itineraryDayBadgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  itineraryBody: {
    flex: 1,
    gap: 2,
  },
  itineraryPort: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  itineraryMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '600' as const,
  },
  itineraryStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itineraryStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itineraryStatusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  analysisFooterCard: {
    marginTop: SPACING.md,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  analysisFooterMetric: {
    flex: 1,
  },
  analysisFooterLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  analysisFooterValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  analysisEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  analysisEditBadgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  valueRowsWrap: {
    gap: SPACING.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196,210,224,0.60)',
  },
  valueRowLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyLight,
  },
  valueRowValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  netValueCard: {
    marginTop: SPACING.md,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  netValueLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  netValueAmount: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  coverageRail: {
    height: 8,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    backgroundColor: 'rgba(175,194,214,0.28)',
  },
  coverageFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.money,
  },
  coverageCopy: {
    marginTop: SPACING.sm,
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyLight,
    textAlign: 'center',
  },
  iconEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
  },
});
