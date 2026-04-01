import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

export type BrandType = 'royal' | 'celebrity' | 'silversea' | 'carnival';
export type BrandToggleVariant = 'default' | 'playerCard';

interface BrandToggleProps {
  activeBrand: BrandType;
  onToggle: (brand: BrandType) => void;
  showSilversea?: boolean;
  showCarnival?: boolean;
  variant?: BrandToggleVariant;
}

interface BrandOption {
  key: BrandType;
  label: string;
}

export function BrandToggle({
  activeBrand,
  onToggle,
  showSilversea = true,
  showCarnival = true,
  variant = 'default',
}: BrandToggleProps) {
  const isPlayerCard = variant === 'playerCard';

  const options = useMemo((): BrandOption[] => {
    const visibleOptions: BrandOption[] = [
      { key: 'royal', label: 'Royal Caribbean' },
      { key: 'celebrity', label: 'Celebrity' },
      ...(showSilversea ? [{ key: 'silversea' as const, label: 'Silversea' }] : []),
      ...(showCarnival ? [{ key: 'carnival' as const, label: 'Carnival' }] : []),
    ];

    return visibleOptions;
  }, [showCarnival, showSilversea]);

  return (
    <View style={[styles.container, isPlayerCard && styles.containerPlayerCard]}>
      <View style={[styles.toggleContainer, isPlayerCard && styles.toggleContainerPlayerCard]}>
        {options.map((option, index) => {
          const isActive = activeBrand === option.key;
          const isCarnival = option.key === 'carnival';
          const isOnlyOption = options.length === 1;

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.toggleButton,
                isPlayerCard && styles.toggleButtonPlayerCard,
                !isOnlyOption && index === 0 && styles.leftButton,
                !isOnlyOption && index > 0 && index < options.length - 1 && styles.middleButton,
                !isOnlyOption && index === options.length - 1 && styles.rightButton,
                isActive && (isCarnival ? styles.carnivalActiveButton : isPlayerCard ? styles.activeButtonPlayerCard : styles.activeButton),
              ]}
              onPress={() => onToggle(option.key)}
              activeOpacity={0.78}
              testID={`brand-toggle-${option.key}`}
            >
              <Text
                style={[
                  styles.toggleText,
                  isPlayerCard && styles.toggleTextPlayerCard,
                  isActive && styles.activeText,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  containerPlayerCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  toggleContainerPlayerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    padding: 6,
    borderColor: 'rgba(30, 58, 95, 0.12)',
    ...SHADOW.sm,
  },
  toggleButton: {
    flex: 1,
    minHeight: 40,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  toggleButtonPlayerCard: {
    minHeight: 46,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  leftButton: {
    marginRight: 2,
  },
  middleButton: {
    marginHorizontal: 2,
  },
  rightButton: {
    marginLeft: 2,
  },
  activeButton: {
    backgroundColor: COLORS.textNavy,
  },
  activeButtonPlayerCard: {
    backgroundColor: COLORS.navyDeep,
    shadowColor: 'rgba(15, 36, 57, 0.35)',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  carnivalActiveButton: {
    backgroundColor: '#CC2232',
  },
  toggleText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
  },
  toggleTextPlayerCard: {
    fontSize: 10,
    lineHeight: 12,
    color: COLORS.navyDeep,
    letterSpacing: 0.1,
  },
  activeText: {
    color: COLORS.white,
  },
});
