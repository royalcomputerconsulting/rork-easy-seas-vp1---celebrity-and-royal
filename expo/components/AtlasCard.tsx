import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Star, Zap, Ship, Lock, Gamepad2 } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW, TYPOGRAPHY } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import type { MachineEncyclopediaEntry } from '@/types/models';

interface AtlasCardProps {
  machine: MachineEncyclopediaEntry;
  onPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  compact?: boolean;
  locked?: boolean;
}

export function AtlasCard({
  machine,
  onPress,
  isFavorite = false,
  onToggleFavorite,
  compact = false,
  locked = false,
}: AtlasCardProps) {
  const hasAPPotential = machine.apMetadata && machine.apMetadata.persistenceType !== 'None';
  const shipCount = machine.shipAssignments?.length || 0;
  const machineImage = machine.images?.find((image) => Boolean(image?.uri))?.uri;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [machineImage]);

  const visualColors = hasAPPotential
    ? ['#2C1D9A', '#8A1FD1'] as const
    : ['#123D73', '#0E7FA7'] as const;

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer]}
        onPress={onPress}
        activeOpacity={0.7}
        testID="atlas-card-compact"
      >
        <View style={styles.compactContent}>
          <LinearGradient
            colors={visualColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compactVisual}
            testID="atlas-card-machine-visual"
          >
            {machineImage && !imageFailed ? (
              <Image
                source={{ uri: machineImage }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
                accessibilityIgnoresInvertColors
              />
            ) : hasAPPotential ? (
              <Zap size={23} color={COLORS.white} strokeWidth={2.2} />
            ) : (
              <Gamepad2 size={23} color={COLORS.white} strokeWidth={2.1} />
            )}
          </LinearGradient>

          <View style={styles.compactLeft}>
            <Text style={styles.compactMachineName} numberOfLines={1}>
              {machine.machineName}
            </Text>
            <Text style={styles.compactManufacturer} numberOfLines={1}>
              {[machine.manufacturer, machine.gameSeries].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.compactMetadataRow}>
              <Text style={styles.compactMetadata} numberOfLines={1}>{machine.volatility || 'Volatility not recorded'}</Text>
              {shipCount > 0 ? (
                <Text style={styles.compactMetadata} numberOfLines={1}>⚓ {shipCount} {shipCount === 1 ? 'ship' : 'ships'}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.compactRight}>
            {locked ? (
              <View style={styles.compactLockBadge} testID="atlas-card.lock">
                <Lock size={16} color={COLORS.navyDeep} />
              </View>
            ) : null}
            {onToggleFavorite && (
              <TouchableOpacity
                onPress={(e: any) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                style={styles.compactStarButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${machine.machineName} ${isFavorite ? 'from' : 'to'} favorites`}
                accessibilityState={{ selected: isFavorite }}
              >
                <Star
                  size={20}
                  color={isFavorite ? COLORS.goldDark : COLORS.textMuted}
                  fill={isFavorite ? COLORS.goldDark : 'none'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            )}
            <ChevronRight size={18} color={COLORS.navyDeep} strokeWidth={2.2} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      testID="atlas-card"
    >
      <LinearGradient
        colors={MARBLE_TEXTURES.lightBlue.gradientColors}
        locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.marbleBackground}
      >
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.machineName} numberOfLines={2}>
                {machine.machineName}
              </Text>
              {onToggleFavorite && (
                <TouchableOpacity
                  onPress={(e: any) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  style={styles.starButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${machine.machineName} ${isFavorite ? 'from' : 'to'} favorites`}
                  accessibilityState={{ selected: isFavorite }}
                >
                  <Star
                    size={24}
                    color={isFavorite ? COLORS.goldDark : COLORS.textDarkGrey}
                    fill={isFavorite ? COLORS.goldDark : 'none'}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.manufacturerRow}>
            <Text style={styles.manufacturer}>{machine.manufacturer}</Text>
            {!!machine.releaseYear && (
              <View style={styles.yearBadge}>
                <Text style={styles.yearText}>{machine.releaseYear}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.badgesRow}>
          {hasAPPotential && (
            <View style={[styles.badge, styles.apBadge]}>
              <Zap size={12} color={COLORS.white} fill={COLORS.white} />
              <Text style={styles.badgeText}>
                AP: {machine.apMetadata?.persistenceType}
              </Text>
            </View>
          )}
          <View style={[styles.badge, styles.volatilityBadge]}>
            <Text style={styles.badgeText}>{machine.volatility}</Text>
          </View>
          {shipCount > 0 && (
            <View style={[styles.badge, styles.shipBadge]}>
              <Ship size={12} color={COLORS.white} />
              <Text style={styles.badgeText}>{shipCount} {shipCount === 1 ? 'ship' : 'ships'}</Text>
            </View>
          )}
        </View>

        <View style={styles.contentSection}>
          {machine.gameSeries ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Series:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {machine.gameSeries}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaInfoBox}>
              <Text style={styles.metaInfoLabel}>CABINET</Text>
              <Text style={styles.metaInfoValue} numberOfLines={1}>
                {machine.cabinetType}
              </Text>
            </View>
            {machine.rtpRanges ? (
              <View style={styles.metaInfoBox}>
                <Text style={styles.metaInfoLabel}>RTP</Text>
                <Text style={styles.metaInfoValue} numberOfLines={1}>
                  {machine.rtpRanges.min}-{machine.rtpRanges.max}%
                </Text>
              </View>
            ) : null}
          </View>

          {machine.denominationFamilies && machine.denominationFamilies.length > 0 && (
            <View style={styles.denomSection}>
              <Text style={styles.denomLabel}>Denoms:</Text>
              <View style={styles.denomChips}>
                {machine.denominationFamilies.slice(0, 4).map((denom, index) => (
                  <View key={index} style={styles.denomChip}>
                    <Text style={styles.denomChipText}>{denom}</Text>
                  </View>
                ))}
                {machine.denominationFamilies.length > 4 && (
                  <Text style={styles.moreText}>+{machine.denominationFamilies.length - 4}</Text>
                )}
              </View>
            </View>
          )}

          {machine.description ? (
            <Text style={styles.description} numberOfLines={5}>
              {machine.description}
            </Text>
          ) : null}

          {machine.shipAssignments && machine.shipAssignments.length > 0 && (
            <View style={styles.shipAssignmentsSection}>
              <Text style={styles.shipAssignmentsLabel}>Found on:</Text>
              <Text style={styles.shipAssignmentsText} numberOfLines={1}>
                {machine.shipAssignments.map(s => s.shipName).join(', ')}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.viewDetailsButton} onPress={onPress}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <ChevronRight size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  marbleBackground: {
    borderRadius: BORDER_RADIUS.lg,
  },
  headerSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  machineName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#000000',
    lineHeight: 24,
  },
  starButton: {
    padding: 4,
  },
  manufacturerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  manufacturer: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  yearBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  yearText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  apBadge: {
    backgroundColor: COLORS.money,
  },
  volatilityBadge: {
    backgroundColor: COLORS.loyalty,
  },
  shipBadge: {
    backgroundColor: COLORS.navyDeep,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  contentSection: {
    padding: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#676A70',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaInfoBox: {
    flex: 1,
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  metaInfoLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#676A70',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaInfoValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  denomSection: {
    marginBottom: SPACING.sm,
  },
  denomLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#676A70',
    marginBottom: 6,
  },
  denomChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  denomChip: {
    backgroundColor: COLORS.goldBg,
    borderWidth: 1,
    borderColor: COLORS.goldDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  denomChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.goldDark,
  },
  moreText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textDarkGrey,
    marginBottom: SPACING.sm,
  },
  shipAssignmentsSection: {
    marginBottom: SPACING.sm,
  },
  shipAssignmentsLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#676A70',
    marginBottom: 4,
  },
  shipAssignmentsText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  compactContainer: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 94,
    paddingVertical: 11,
    paddingHorizontal: 11,
  },
  compactVisual: {
    width: 70,
    height: 70,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  compactMachineName: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  compactManufacturer: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: COLORS.textDarkGrey,
  },
  compactMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  compactMetadata: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#0E7FA7',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLockBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 58, 99, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(18, 58, 99, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStarButton: {
    padding: 4,
  },
});
