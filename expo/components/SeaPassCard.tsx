import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor, Ship, Hash, Layers } from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface SeaPassBooking {
  reservationNumber?: string;
  cabinNumber?: string;
  cabinType?: string;
  guestNames?: string[];
}

interface SeaPassCardProps {
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  dayNumber: number;
  departurePort?: string;
  _destination?: string;
  bookings: SeaPassBooking[];
  brand?: string;
}

function getBrandColors(brand?: string): [string, string, string] {
  if (brand === 'celebrity') return ['#1A2E44', '#2C4A6E', '#0D6B8C'];
  if (brand === 'carnival') return ['#CC0000', '#990000', '#660000'];
  return ['#001F3F', '#003366', '#1A4F7A'];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function SeaPassCard({
  shipName,
  sailDate,
  returnDate,
  nights,
  dayNumber,
  departurePort,
  _destination,
  bookings,
  brand,
}: SeaPassCardProps) {
  const gradientColors = getBrandColors(brand);
  const allGuests = bookings.flatMap(b => b.guestNames ?? []);
  const primaryGuest = allGuests[0] ?? 'Guest';

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>SEA PASS CARD</Text>
      {bookings.map((booking, idx) => {
        const guests = booking.guestNames ?? (idx === 0 ? [primaryGuest] : []);
        const guestDisplay = guests[0] ?? 'Guest';
        const extraGuests = guests.slice(1);

        return (
          <View key={`seapass-${idx}`} style={styles.cardOuter}>
            <LinearGradient
              colors={gradientColors as [string, string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.brandArea}>
                  <Ship size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.brandText} numberOfLines={1}>
                    {brand === 'celebrity' ? 'Celebrity Cruises' : brand === 'carnival' ? 'Carnival' : 'Royal Caribbean'}
                  </Text>
                </View>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>DAY {dayNumber}</Text>
                </View>
              </View>

              {/* Ship Name */}
              <Text style={styles.shipName} numberOfLines={1}>{shipName}</Text>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Guest Info */}
              <View style={styles.guestRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(guestDisplay)}</Text>
                </View>
                <View style={styles.guestInfo}>
                  <Text style={styles.guestLabel}>PASSENGER</Text>
                  <Text style={styles.guestName} numberOfLines={1}>{guestDisplay}</Text>
                  {extraGuests.length > 0 && (
                    <Text style={styles.extraGuests} numberOfLines={1}>
                      +{extraGuests.join(', ')}
                    </Text>
                  )}
                </View>
              </View>

              {/* Details Grid */}
              <View style={styles.detailsGrid}>
                {booking.cabinNumber ? (
                  <View style={styles.detailItem}>
                    <Layers size={11} color="rgba(255,255,255,0.6)" />
                    <View>
                      <Text style={styles.detailLabel}>CABIN</Text>
                      <Text style={styles.detailValue}>{booking.cabinNumber}</Text>
                    </View>
                  </View>
                ) : null}
                {booking.cabinType ? (
                  <View style={styles.detailItem}>
                    <Anchor size={11} color="rgba(255,255,255,0.6)" />
                    <View>
                      <Text style={styles.detailLabel}>TYPE</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{booking.cabinType}</Text>
                    </View>
                  </View>
                ) : null}
                {booking.reservationNumber ? (
                  <View style={styles.detailItem}>
                    <Hash size={11} color="rgba(255,255,255,0.6)" />
                    <View>
                      <Text style={styles.detailLabel}>RESERVATION</Text>
                      <Text style={styles.detailValue}>{booking.reservationNumber}</Text>
                    </View>
                  </View>
                ) : null}
                {departurePort && (
                  <View style={styles.detailItem}>
                    <Anchor size={11} color="rgba(255,255,255,0.6)" />
                    <View>
                      <Text style={styles.detailLabel}>HOME PORT</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{departurePort}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <Text style={styles.footerLabel}>VOYAGE</Text>
                  <Text style={styles.footerValue}>{formatDate(sailDate)} – {formatDate(returnDate)}</Text>
                </View>
                <View style={styles.footerRight}>
                  <Text style={styles.footerLabel}>NIGHTS</Text>
                  <Text style={styles.footerNights}>{nights}</Text>
                </View>
              </View>

              {/* Decorative stripe */}
              <View style={styles.goldStripe} />
            </LinearGradient>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 2,
  },
  cardOuter: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    padding: SPACING.md,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  brandArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  dayBadge: {
    backgroundColor: 'rgba(212,160,10,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  shipName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: SPACING.sm,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  guestInfo: {
    flex: 1,
  },
  guestLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  extraGuests: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    minWidth: '40%',
    flex: 1,
  },
  detailLabel: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  footerLeft: {
    gap: 2,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  footerValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  footerNights: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#D4A00A',
    lineHeight: 32,
  },
  goldStripe: {
    height: 4,
    backgroundColor: '#D4A00A',
    marginHorizontal: -SPACING.md,
  },
});
