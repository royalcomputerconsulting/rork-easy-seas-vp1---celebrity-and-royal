import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useIntelligenceFilters, type BrandFilterValue, type ProfileFilterValue } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { getBrandLabel, getManagedSecondProfile } from '@/lib/intelligenceFilters';

interface IntelligenceFilterStripProps {
  contextLabel: string;
  compact?: boolean;
  variant?: 'default' | 'bookedCruises';
}

const BRAND_OPTIONS: BrandFilterValue[] = ['all', 'royal', 'celebrity', 'silversea'];

function getBrandChipLabel(brand: BrandFilterValue): string {
  return brand === 'all' ? 'All' : getBrandLabel(brand);
}

/**
 * Small, single-row filtering control: one segmented toggle to switch between
 * User and Second User, and one row of brand radio options. The old design
 * had three separate sections (Profile / Brand / Program) and the Profile
 * section could show a duplicated "Second User" entry -- both are fixed here.
 * Program is intentionally gone: whichever brand is selected already implies
 * its casino program (Royal -> Club Royale, Celebrity -> Blue Chip, etc.), so
 * a separate program control was redundant.
 */
export const IntelligenceFilterStrip = React.memo(function IntelligenceFilterStrip({
  contextLabel,
  compact = false,
  variant = 'default',
}: IntelligenceFilterStripProps) {
  const isBookedCruisesVariant = variant === 'bookedCruises';
  const { users } = useUser();
  const {
    selectedProfileId,
    selectedBrand,
    setSelectedProfileId,
    setSelectedBrand,
    clearIntelligenceFilters,
    activeFilterCount,
  } = useIntelligenceFilters();

  const profileOptions = useMemo((): { id: ProfileFilterValue; label: string }[] => {
    const activeProfiles = users.filter((profile) => profile.active !== false);
    const primaryProfile = activeProfiles.find((profile) => profile.isOwner) ?? activeProfiles[0];
    // Only ever the single canonical second-traveler slot -- never fall back to a
    // synthetic "unassigned" entry, and never include any other non-owner profile,
    // so this row can never render more than one "Second User" chip even if
    // duplicate/legacy profiles still exist in storage.
    const canonicalSecondProfile = getManagedSecondProfile(activeProfiles);

    const options: { id: ProfileFilterValue; label: string }[] = [];
    if (primaryProfile) {
      options.push({ id: primaryProfile.id, label: 'User' });
    }
    if (canonicalSecondProfile && canonicalSecondProfile.id !== primaryProfile?.id) {
      options.push({ id: canonicalSecondProfile.id, label: 'Second User' });
    }
    return options;
  }, [users]);

  return (
    <View
      style={[styles.container, compact && styles.containerCompact, isBookedCruisesVariant && styles.bookedContainer]}
      testID={`${contextLabel.toLowerCase().replace(/\s+/g, '-')}-intelligence-filters`}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <SlidersHorizontal size={12} color={COLORS.navyDeep} />
          <Text style={styles.title}>Filters</Text>
        </View>
        {profileOptions.length > 0 && (
          <View style={styles.toggleGroup}>
            {profileOptions.map((option) => {
              const active = selectedProfileId === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.toggleButton, active && styles.toggleButtonActive]}
                  onPress={() => setSelectedProfileId(option.id)}
                  activeOpacity={0.75}
                  testID={`profile-filter-${option.id}`}
                >
                  <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]} numberOfLines={1}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {activeFilterCount > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={clearIntelligenceFilters} activeOpacity={0.75} testID="clear-intelligence-filters">
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.radioRow}>
        {BRAND_OPTIONS.map((brand) => {
          const active = selectedBrand === brand;
          return (
            <TouchableOpacity
              key={brand}
              style={styles.radioOption}
              onPress={() => setSelectedBrand(brand)}
              activeOpacity={0.75}
              testID={`brand-filter-${brand}`}
            >
              <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                {active && <View style={styles.radioCircleDot} />}
              </View>
              <Text style={[styles.radioLabel, active && styles.radioLabelActive]} numberOfLines={1}>{getBrandChipLabel(brand)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.14)',
    backgroundColor: COLORS.white,
    gap: 6,
    ...SHADOW.sm,
  },
  containerCompact: {
    paddingVertical: 6,
  },
  bookedContainer: {
    borderColor: COLORS.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  toggleGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 3,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.navyDeep,
    ...SHADOW.sm,
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.textDarkGrey,
  },
  toggleButtonTextActive: {
    color: COLORS.white,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  clearButtonText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  radioCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(30, 58, 95, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: COLORS.goldAccent,
  },
  radioCircleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.goldAccent,
  },
  radioLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
  },
  radioLabelActive: {
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
  },
});
