import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, SlidersHorizontal, Trophy, UserRound } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useIntelligenceFilters, type BrandFilterValue, type ProfileFilterValue, type ProgramFilterValue } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { getBrandLabel, getProfileDisplayName, getProgramLabel, getSecondProfileForUnassignedRecords } from '@/lib/intelligenceFilters';

interface IntelligenceFilterStripProps {
  contextLabel: string;
  showProgram?: boolean;
  compact?: boolean;
  variant?: 'default' | 'bookedCruises';
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
  compact = false,
  variant = 'default',
}: IntelligenceFilterStripProps) {
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
      { id: 'all', label: 'All' },
      ...activeProfiles.map((profile) => ({
        id: profile.id,
        label: profile.id === primaryProfile?.id
          ? 'User'
          : profile.id === secondProfile?.id
          ? 'Second User'
          : getProfileDisplayName(profile),
      })),
      ...(secondProfile ? [] : [{ id: 'unassigned' as const, label: 'Second User' }]),
    ];
  }, [users]);

  if (isBookedCruisesVariant && compact) {
    return (
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, styles.bookedContainer, styles.bookedUltraCompactContainer]}
        testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
      >
        <View style={styles.compactRailHeader}>
          <View style={styles.compactRailTitleRow}>
            <View style={styles.compactRailIconBadge}>
              <SlidersHorizontal size={10} color={COLORS.navyDeep} />
            </View>
            <Text style={styles.compactRailTitle}>Filters</Text>
          </View>
          {activeFilterCount > 0 ? (
            <TouchableOpacity style={styles.compactRailClearButton} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
              <Text style={styles.compactRailClearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.compactFilterGrid}>
          <View style={styles.compactFilterSection}>
            <Text style={styles.compactRailGroupLabel}>Profile</Text>
            <View style={styles.compactFilterWrappedRow}>
              {profileOptions.map((option) => {
                const active = selectedProfileId === option.id;
                return (
                  <TouchableOpacity
                    key={`profile-filter-option-${option.id}`}
                    style={[styles.compactRailChip, active && styles.compactRailChipActive]}
                    onPress={() => setSelectedProfileId(option.id)}
                    activeOpacity={0.75}
                    testID={`profile-filter-${option.id}`}
                  >
                    <Text style={[styles.compactRailChipText, active && styles.compactRailChipTextActive]} numberOfLines={1}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.compactFilterSection}>
            <Text style={styles.compactRailGroupLabel}>Brand</Text>
            <View style={styles.compactFilterWrappedRow}>
              {BRAND_OPTIONS.map((brand) => {
                const active = selectedBrand === brand;
                return (
                  <TouchableOpacity
                    key={brand}
                    style={[styles.compactRailChip, active && styles.compactRailChipActive]}
                    onPress={() => setSelectedBrand(brand)}
                    activeOpacity={0.75}
                    testID={`brand-filter-${brand}`}
                  >
                    <Text style={[styles.compactRailChipText, active && styles.compactRailChipTextActive]} numberOfLines={1}>{getBrandChipLabel(brand)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {showProgram ? (
            <View style={styles.compactFilterSection}>
              <Text style={styles.compactRailGroupLabel}>Program</Text>
              <View style={styles.compactFilterWrappedRow}>
                {PROGRAM_OPTIONS.map((program) => {
                  const active = selectedProgram === program;
                  return (
                    <TouchableOpacity
                      key={program}
                      style={[styles.compactRailChip, active && styles.compactRailChipActive]}
                      onPress={() => setSelectedProgram(program)}
                      activeOpacity={0.75}
                      testID={`program-filter-${program}`}
                    >
                      <Text style={[styles.compactRailChipText, active && styles.compactRailChipTextActive]} numberOfLines={1}>{getProgramChipLabel(program)}</Text>
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
      colors={isBookedCruisesVariant ? ['#FFFFFF', '#F8FAFC'] : ['rgba(255,255,255,0.96)', 'rgba(224,242,241,0.92)', 'rgba(0,172,193,0.10)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, compact && styles.containerCompact, isBookedCruisesVariant && styles.bookedContainer]}
      testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
    >
      <View style={[styles.headerRow, isBookedCruisesVariant && styles.bookedHeaderRow]}>
        <View style={styles.titleRow}>
          <View style={[styles.iconBadge, isBookedCruisesVariant && styles.bookedIconBadge]}>
            <SlidersHorizontal size={isBookedCruisesVariant ? 9 : 13} color={COLORS.navyDeep} />
          </View>
          <View>
            <Text style={[styles.title, isBookedCruisesVariant && styles.bookedTitle]}>Filtering</Text>
            {!isBookedCruisesVariant && (
              <Text style={styles.subtitle}>Profile, account, brand, and program scope</Text>
            )}
          </View>
        </View>
        {activeFilterCount > 0 ? (
          <TouchableOpacity style={[styles.clearButton, isBookedCruisesVariant && styles.bookedClearButton]} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
            <Text style={[styles.clearButtonText, isBookedCruisesVariant && styles.bookedClearButtonText]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.group, isBookedCruisesVariant && styles.bookedFilterGroup]}>
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
      </View>

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
                  onPress={() => setSelectedBrand(brand)}
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
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.14)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  containerCompact: {
    padding: SPACING.sm,
  },
  bookedContainer: {
    borderRadius: BORDER_RADIUS.md,
    borderColor: COLORS.borderLight,
    padding: 6,
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
    fontSize: TYPOGRAPHY.fontSizeSM,
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
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
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
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  chipTextActive: {
    color: COLORS.white,
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
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandChipActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  programChipActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
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
    fontSize: 10,
    letterSpacing: 0.1,
  },
  bookedClearButton: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  bookedClearButtonText: {
    fontSize: 9,
  },
  // Compact group/chip styles for 30%-smaller booked variant
  bookedDualGroupRow: {
    gap: 5,
  },
  bookedFilterGroup: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 6,
    ...SHADOW.sm,
  },
  bookedGroupLabelRow: {
    marginBottom: 3,
  },
  bookedGroupIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 151, 167, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  bookedGroupLabel: {
    marginBottom: 0,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  bookedSegmentedRow: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 3,
  },
  bookedChip: {
    minWidth: 40,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
  },
  bookedChipActive: {
    backgroundColor: COLORS.navyDeep,
    ...SHADOW.tab,
  },
  bookedChipText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    textAlign: 'center' as const,
  },
  bookedChipTextActive: {
    color: COLORS.white,
    fontWeight: '800' as const,
  },
  bookedUltraCompactContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: 6,
    padding: 7,
    borderRadius: 16,
    ...SHADOW.sm,
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
    fontSize: 10,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  compactRailClearButton: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#EEF2F7',
  },
  compactRailClearText: {
    fontSize: 9,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  compactFilterGrid: {
    gap: 7,
  },
  compactFilterSection: {
    gap: 4,
  },
  compactFilterWrappedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  compactRailGroupLabel: {
    fontSize: 9,
    fontWeight: '900' as const,
    color: COLORS.textDarkGrey,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginLeft: 2,
  },
  compactRailChip: {
    minWidth: 48,
    maxWidth: 130,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  compactRailChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  compactRailChipText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textDarkGrey,
    textAlign: 'center' as const,
  },
  compactRailChipTextActive: {
    color: COLORS.white,
  },
});
