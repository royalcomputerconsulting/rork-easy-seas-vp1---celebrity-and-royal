import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, SlidersHorizontal, Trophy, UserRound } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useIntelligenceFilters, type BrandFilterValue, type ProfileFilterValue, type ProgramFilterValue } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { getBrandLabel, getProfileDisplayName, getProgramLabel, getSecondProfileForUnassignedRecords } from '@/lib/intelligenceFilters';
import { useExperience } from '@/state/ExperienceProvider';

interface IntelligenceFilterStripProps {
  contextLabel: string;
  showProgram?: boolean;
  showProfile?: boolean;
  compact?: boolean;
  variant?: 'default' | 'bookedCruises';
  showTitle?: boolean;
}

const BRAND_OPTIONS: BrandFilterValue[] = ['all', 'royal', 'celebrity', 'silversea'];
const PROGRAM_OPTIONS: ProgramFilterValue[] = ['all', 'clubRoyale', 'blueChip', 'venetianSociety'];

function getBrandChipLabel(brand: BrandFilterValue): string {
  return brand === 'all' ? 'All' : getBrandLabel(brand);
}

function getProgramChipLabel(program: ProgramFilterValue): string {
  return program === 'all' ? 'All' : getProgramLabel(program);
}

export const IntelligenceFilterStrip = React.memo(function IntelligenceFilterStrip({
  contextLabel,
  showProgram = true,
  showProfile = true,
  compact = false,
  variant = 'default',
  showTitle = true,
}: IntelligenceFilterStripProps) {
  const { colors, minimumControlSize, textScale } = useExperience();
  const isBookedCruisesVariant = variant === 'bookedCruises';
  const { users } = useUser();
  const {
    selectedProfileId,
    selectedBrand,
    selectedProgram,
    setSelectedProfileId,
    setSelectedBrand,
    setSelectedProgram,
    clearIntelligenceFilters,
    activeFilterCount,
  } = useIntelligenceFilters();

  const handleBrandChange = useCallback((brand: BrandFilterValue) => {
    setSelectedBrand(brand);
    if (!showProgram) {
      setSelectedProgram(brand === 'royal'
        ? 'clubRoyale'
        : brand === 'celebrity'
          ? 'blueChip'
          : brand === 'silversea'
            ? 'venetianSociety'
            : 'all');
    }
  }, [setSelectedBrand, setSelectedProgram, showProgram]);

  const profileOptions = useMemo((): { id: ProfileFilterValue; label: string }[] => {
    const seenProfileIds = new Set<string>();
    const activeProfiles = users.filter((profile) => {
      if (profile.active === false) {
        return false;
      }

      const profileId = profile.id.trim();
      if (!profileId || seenProfileIds.has(profileId)) {
        return false;
      }

      seenProfileIds.add(profileId);
      return true;
    });
    const primaryProfile = activeProfiles.find((profile) => profile.isOwner) ?? activeProfiles[0];
    const secondProfile = getSecondProfileForUnassignedRecords(activeProfiles);
    return [
      { id: 'all', label: 'Household' },
      ...activeProfiles.map((profile) => ({
        id: profile.id,
        label: profile.id === primaryProfile?.id
          ? 'Me'
          : profile.id === secondProfile?.id
          ? 'Companion'
          : getProfileDisplayName(profile),
      })),
      { id: 'unassigned' as const, label: 'Unassigned' },
    ];
  }, [users]);

  if (compact) {
    return (
      <LinearGradient
        colors={[colors.surfaceRaised, colors.surfaceMuted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, styles.bookedUltraCompactContainer, { borderColor: colors.border }]}
        testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
      >
        {showTitle || activeFilterCount > 0 ? <View style={styles.compactRailHeader}>
          {showTitle ? <View style={styles.compactRailTitleRow}>
            <View style={styles.compactRailIconBadge}>
              <SlidersHorizontal size={10} color={colors.accent} />
            </View>
            <Text style={[styles.compactRailTitle, { color: colors.text, fontSize: 11 * textScale }]}>Filters</Text>
          </View> : <View />}
          {activeFilterCount > 0 ? (
            <TouchableOpacity style={[styles.compactRailClearButton, { minHeight: minimumControlSize, backgroundColor: colors.surfaceMuted }]} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
              <Text style={[styles.compactRailClearText, { color: colors.accent }]}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View> : null}
        <View style={styles.compactAllFiltersRail}>
        {showProfile ? <View style={styles.compactFilterGroup}>
          <Text style={[styles.compactRailGroupLabel, { color: colors.muted }]}>👤 Profile</Text>
          <View style={styles.compactFilterRail}>
            {profileOptions.map((option) => {
              const active = selectedProfileId === option.id;
              return (
                <TouchableOpacity key={`profile-filter-option-${option.id}`} style={[styles.compactRailChip, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, active && styles.compactRailChipActive]} onPress={() => setSelectedProfileId(option.id)} activeOpacity={0.75} testID={`profile-filter-${option.id}`}>
                  <Text style={[styles.compactRailChipText, { color: colors.text }, active && styles.compactRailChipTextActive]} numberOfLines={1}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View> : null}
        <View style={styles.compactFilterGroup}>
          <Text style={[styles.compactRailGroupLabel, { color: colors.muted }]}>⚓ Brand</Text>
          <View style={styles.compactFilterRail}>
            {BRAND_OPTIONS.map((brand) => {
              const active = selectedBrand === brand;
              return (
                  <TouchableOpacity key={brand} style={[styles.compactRailChip, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, active && styles.compactRailChipActive]} onPress={() => handleBrandChange(brand)} activeOpacity={0.75} testID={`brand-filter-${brand}`}>
                  <Text style={[styles.compactRailChipText, { color: colors.text }, active && styles.compactRailChipTextActive]} numberOfLines={1}>{getBrandChipLabel(brand)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {showProgram ? (
          <View style={styles.compactFilterGroup}>
            <Text style={[styles.compactRailGroupLabel, { color: colors.muted }]}>🎟️ Program</Text>
            <View style={styles.compactFilterRail}>
              {PROGRAM_OPTIONS.map((program) => {
                const active = selectedProgram === program;
                return (
                  <TouchableOpacity key={program} style={[styles.compactRailChip, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, active && styles.compactRailChipActive]} onPress={() => setSelectedProgram(program)} activeOpacity={0.75} testID={`program-filter-${program}`}>
                    <Text style={[styles.compactRailChipText, { color: colors.text }, active && styles.compactRailChipTextActive]} numberOfLines={1}>{getProgramChipLabel(program)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.surfaceRaised, colors.surfaceMuted, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, compact && styles.containerCompact, isBookedCruisesVariant && styles.bookedContainer, { borderColor: colors.border }]}
      testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
    >
      {showTitle || activeFilterCount > 0 ? <View style={[styles.headerRow, isBookedCruisesVariant && styles.bookedHeaderRow]}>
        <View style={styles.titleRow}>
          {showTitle ? <><View style={[styles.iconBadge, isBookedCruisesVariant && styles.bookedIconBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
            <SlidersHorizontal size={isBookedCruisesVariant ? 9 : 13} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, isBookedCruisesVariant && styles.bookedTitle, { color: colors.text }]}>Filters</Text>
            {!isBookedCruisesVariant && (
              <Text style={[styles.subtitle, { color: colors.muted }]}>Profile, account, brand, and program scope</Text>
            )}
          </View></> : null}
        </View>
        {activeFilterCount > 0 ? (
          <TouchableOpacity style={[styles.clearButton, isBookedCruisesVariant && styles.bookedClearButton, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }]} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
            <Text style={[styles.clearButtonText, isBookedCruisesVariant && styles.bookedClearButtonText, { color: colors.accent }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View> : null}

      {showProfile ? <View style={[styles.group, isBookedCruisesVariant && styles.bookedFilterGroup]}>
        <View style={[styles.groupLabelRow, isBookedCruisesVariant && styles.bookedGroupLabelRow]}>
          <View style={isBookedCruisesVariant ? styles.bookedGroupIconBadge : undefined}>
            <UserRound size={isBookedCruisesVariant ? 10 : 12} color={COLORS.navyDeep} />
          </View>
          <Text style={[styles.groupLabel, isBookedCruisesVariant && styles.bookedGroupLabel]}>Profile / account</Text>
        </View>
        <View style={[styles.chipRow, isBookedCruisesVariant && styles.bookedSegmentedRow]}>
          {profileOptions.map((option) => {
            const active = selectedProfileId === option.id;
            return (
              <TouchableOpacity
                key={`profile-filter-option-${option.id}`}
                style={[isBookedCruisesVariant ? styles.bookedChip : styles.chip, active && (isBookedCruisesVariant ? styles.bookedChipActive : styles.chipActive)]}
                onPress={() => setSelectedProfileId(option.id)}
                activeOpacity={0.75}
                testID={`profile-filter-${option.id}`}
              >
                <Text style={[isBookedCruisesVariant ? styles.bookedChipText : styles.chipText, active && (isBookedCruisesVariant ? styles.bookedChipTextActive : styles.chipTextActive)]} numberOfLines={1}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View> : null}

      <View style={[styles.dualGroupRow, isBookedCruisesVariant && styles.bookedDualGroupRow]}>
        <View style={[styles.flexGroup, isBookedCruisesVariant && styles.bookedFilterGroup]}>
          <View style={[styles.groupLabelRow, isBookedCruisesVariant && styles.bookedGroupLabelRow]}>
            <View style={isBookedCruisesVariant ? styles.bookedGroupIconBadge : undefined}>
              <Building2 size={isBookedCruisesVariant ? 10 : 12} color={COLORS.navyDeep} />
            </View>
            <Text style={[styles.groupLabel, isBookedCruisesVariant && styles.bookedGroupLabel]}>Brand</Text>
          </View>
          <View style={[styles.chipRowTight, isBookedCruisesVariant && styles.bookedSegmentedRow]}>
            {BRAND_OPTIONS.map((brand) => {
              const active = selectedBrand === brand;
              return (
                <TouchableOpacity
                  key={brand}
                  style={[isBookedCruisesVariant ? styles.bookedChip : styles.smallChip, active && (isBookedCruisesVariant ? styles.bookedChipActive : styles.brandChipActive)]}
                  onPress={() => handleBrandChange(brand)}
                  activeOpacity={0.75}
                  testID={`brand-filter-${brand}`}
                >
                  <Text style={[isBookedCruisesVariant ? styles.bookedChipText : styles.smallChipText, active && (isBookedCruisesVariant ? styles.bookedChipTextActive : styles.chipTextActive)]} numberOfLines={1}>{getBrandChipLabel(brand)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {showProgram ? (
          <View style={[styles.flexGroup, isBookedCruisesVariant && styles.bookedFilterGroup]}>
            <View style={[styles.groupLabelRow, isBookedCruisesVariant && styles.bookedGroupLabelRow]}>
              <View style={isBookedCruisesVariant ? styles.bookedGroupIconBadge : undefined}>
                <Trophy size={isBookedCruisesVariant ? 10 : 12} color={COLORS.navyDeep} />
              </View>
              <Text style={[styles.groupLabel, isBookedCruisesVariant && styles.bookedGroupLabel]}>Program</Text>
            </View>
            <View style={[styles.chipRowTight, isBookedCruisesVariant && styles.bookedSegmentedRow]}>
              {PROGRAM_OPTIONS.map((program) => {
                const active = selectedProgram === program;
                return (
                  <TouchableOpacity
                    key={program}
                    style={[isBookedCruisesVariant ? styles.bookedChip : styles.smallChip, active && (isBookedCruisesVariant ? styles.bookedChipActive : styles.programChipActive)]}
                    onPress={() => setSelectedProgram(program)}
                    activeOpacity={0.75}
                    testID={`program-filter-${program}`}
                  >
                    <Text style={[isBookedCruisesVariant ? styles.bookedChipText : styles.smallChipText, active && (isBookedCruisesVariant ? styles.bookedChipTextActive : styles.chipTextActive)]} numberOfLines={1}>{getProgramChipLabel(program)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  containerCompact: {
    padding: SPACING.sm,
  },
  bookedContainer: {
    borderRadius: 14,
    borderColor: '#D8D2C8',
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 160, 10, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.12)',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 18,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textDarkGrey,
    marginTop: 1,
  },
  clearButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  group: {
    marginBottom: SPACING.sm,
  },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  chipRowTight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    minWidth: 46,
    maxWidth: 132,
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: '#B9C9C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#DFF2EF',
    borderColor: '#167C80',
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  chipTextActive: {
    color: '#17324D',
  },
  dualGroupRow: {
    gap: SPACING.sm,
  },
  flexGroup: {
    minHeight: 58,
  },
  smallChip: {
    minWidth: 46,
    maxWidth: 112,
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: '#B9C9C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandChipActive: {
    backgroundColor: '#DFF2EF',
    borderColor: '#167C80',
  },
  programChipActive: {
    backgroundColor: '#DFF2EF',
    borderColor: '#167C80',
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  // Compact booked variant header (30% smaller)
  bookedHeaderRow: {
    marginBottom: 5,
    gap: 5,
  },
  bookedIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  bookedTitle: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  bookedClearButton: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  bookedClearButtonText: {
    fontSize: 11,
  },
  // Compact group/chip styles for 30%-smaller booked variant
  bookedDualGroupRow: {
    gap: 5,
  },
  bookedFilterGroup: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
  },
  bookedGroupLabelRow: {
    marginBottom: 3,
  },
  bookedGroupIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 151, 167, 0.08)',
    borderWidth: 0,
  },
  bookedGroupLabel: {
    marginBottom: 0,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  bookedSegmentedRow: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 6,
  },
  bookedChip: {
    minWidth: 40,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: '#CCD8DC',
  },
  bookedChipActive: {
    backgroundColor: '#DFF2EF',
    borderColor: '#167C80',
  },
  bookedChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    textAlign: 'center' as const,
  },
  bookedChipTextActive: {
    color: '#17324D',
    fontWeight: '800' as const,
  },
  bookedUltraCompactContainer: {
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    padding: 10,
    borderRadius: 14,
  },
  compactRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  compactRailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactRailIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 31, 63, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  compactRailTitle: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  compactRailClearButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#EEF2F7',
  },
  compactRailClearText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  compactFilterRail: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 5,
  },
  compactAllFiltersRail: {
    gap: 7,
  },
  compactFilterGroup: {
    width: '100%',
    marginTop: 3,
  },
  compactRailGroupLabel: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.textDarkGrey,
    letterSpacing: 0.4,
    marginLeft: 2,
    marginBottom: 4,
  },
  compactRailChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  compactRailChipActive: {
    backgroundColor: '#DFF2EF',
    borderColor: '#167C80',
  },
  compactRailChipText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800' as const,
    color: COLORS.textDarkGrey,
    textAlign: 'center' as const,
  },
  compactRailChipTextActive: {
    color: '#17324D',
  },
});
