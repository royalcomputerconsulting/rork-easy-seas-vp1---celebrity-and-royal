import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SlidersHorizontal, UserRound } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useIntelligenceFilters, type BrandFilterValue, type ProfileFilterValue, type ProgramFilterValue } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { getBrandLabel, getProfileDisplayName, getProgramLabel } from '@/lib/intelligenceFilters';

interface IntelligenceFilterStripProps {
  contextLabel: string;
  showProgram?: boolean;
  compact?: boolean;
}

const BRAND_OPTIONS: BrandFilterValue[] = ['all', 'royal', 'celebrity'];
const PROGRAM_OPTIONS: ProgramFilterValue[] = ['all', 'clubRoyale', 'blueChip'];

export const IntelligenceFilterStrip = React.memo(function IntelligenceFilterStrip({
  contextLabel,
  showProgram = true,
  compact = false,
}: IntelligenceFilterStripProps) {
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
    const activeProfiles = users.filter((profile) => profile.active !== false);
    return [
      { id: 'all', label: 'All Profiles' },
      ...activeProfiles.map((profile) => ({ id: profile.id, label: getProfileDisplayName(profile) })),
      { id: 'unassigned', label: 'Unassigned' },
    ];
  }, [users]);

  return (
    <LinearGradient
      colors={[COLORS.navyDeep, COLORS.oceanicBlueMedium, '#0E7490']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, compact && styles.containerCompact]}
      testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBadge}>
            <SlidersHorizontal size={13} color={COLORS.goldAccent} />
          </View>
          <View>
            <Text style={styles.title}>Filtering</Text>
            <Text style={styles.subtitle}>Profile, account, brand, and program scope</Text>
          </View>
        </View>
        {activeFilterCount > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.group}>
        <View style={styles.groupLabelRow}>
          <UserRound size={12} color="rgba(255,255,255,0.72)" />
          <Text style={styles.groupLabel}>Profile / account</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {profileOptions.map((option) => {
            const active = selectedProfileId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedProfileId(option.id)}
                activeOpacity={0.75}
                testID={`profile-filter-${option.id}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.dualGroupRow}>
        <View style={styles.flexGroup}>
          <Text style={styles.groupLabel}>Brand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowTight}>
            {BRAND_OPTIONS.map((brand) => {
              const active = selectedBrand === brand;
              return (
                <TouchableOpacity
                  key={brand}
                  style={[styles.smallChip, active && styles.brandChipActive]}
                  onPress={() => setSelectedBrand(brand)}
                  activeOpacity={0.75}
                  testID={`brand-filter-${brand}`}
                >
                  <Text style={[styles.smallChipText, active && styles.chipTextActive]}>{getBrandLabel(brand)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {showProgram ? (
          <View style={styles.flexGroup}>
            <Text style={styles.groupLabel}>Program</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowTight}>
              {PROGRAM_OPTIONS.map((program) => {
                const active = selectedProgram === program;
                return (
                  <TouchableOpacity
                    key={program}
                    style={[styles.smallChip, active && styles.programChipActive]}
                    onPress={() => setSelectedProgram(program)}
                    activeOpacity={0.75}
                    testID={`program-filter-${program}`}
                  >
                    <Text style={[styles.smallChipText, active && styles.chipTextActive]}>{getProgramLabel(program)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    borderColor: 'rgba(212, 160, 10, 0.42)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  containerCompact: {
    padding: SPACING.sm,
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
    backgroundColor: 'rgba(212, 160, 10, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 10, 0.34)',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.68)',
    marginTop: 1,
  },
  clearButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.white,
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
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  chipRow: {
    gap: SPACING.xs,
    paddingRight: SPACING.md,
  },
  chipRowTight: {
    gap: 6,
    paddingRight: SPACING.sm,
  },
  chip: {
    maxWidth: 150,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.84)',
  },
  chipTextActive: {
    color: COLORS.navyDeep,
  },
  dualGroupRow: {
    gap: SPACING.sm,
  },
  flexGroup: {
    minHeight: 58,
  },
  smallChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  brandChipActive: {
    backgroundColor: COLORS.aquaAccent,
    borderColor: COLORS.aquaAccent,
  },
  programChipActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.84)',
  },
});
