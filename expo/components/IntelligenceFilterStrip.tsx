import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    <View style={[styles.container, compact && styles.containerCompact]} testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBadge}>
            <SlidersHorizontal size={13} color={COLORS.navyDeep} />
          </View>
          <View>
            <Text style={styles.title}>{contextLabel} filters</Text>
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
          <UserRound size={12} color="#64748B" />
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
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.16)',
    ...SHADOW.sm,
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
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  clearButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    color: '#475569',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: '#334155',
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
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  programChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#334155',
  },
});
