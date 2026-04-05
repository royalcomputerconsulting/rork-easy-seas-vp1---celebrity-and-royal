import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { getFocusTheme } from '@/constants/focusThemes';

export type BrandType = 'royal' | 'celebrity' | 'silversea' | 'carnival';

const royalTheme = getFocusTheme('royal');
const celebrityTheme = getFocusTheme('celebrity');

interface BrandToggleProps {
  activeBrand: BrandType;
  onToggle: (brand: BrandType) => void;
  showSilversea?: boolean;
  showCarnival?: boolean;
}

export function BrandToggle({ activeBrand, onToggle, showSilversea = true, showCarnival = true }: BrandToggleProps) {
  const activeContainerStyle = activeBrand === 'celebrity'
    ? { backgroundColor: celebrityTheme.pillSurface, borderColor: celebrityTheme.cardBorder }
    : activeBrand === 'royal'
      ? { backgroundColor: royalTheme.pillSurface, borderColor: royalTheme.cardBorder }
      : null;

  return (
    <View style={styles.container}>
      <View style={[styles.toggleContainer, activeContainerStyle]}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.leftButton,
            activeBrand === 'royal' && { backgroundColor: royalTheme.actionPrimary },
          ]}
          onPress={() => onToggle('royal')}
          activeOpacity={0.7}
          testID="brand-toggle-royal"
        >
          <Text
            style={[
              styles.toggleText,
              activeBrand === 'royal' && styles.activeText,
            ]}
            numberOfLines={1}
          >
            Royal Caribbean
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.middleButton,
            activeBrand === 'celebrity' && { backgroundColor: celebrityTheme.actionPrimary },
          ]}
          onPress={() => onToggle('celebrity')}
          activeOpacity={0.7}
          testID="brand-toggle-celebrity"
        >
          <Text
            style={[
              styles.toggleText,
              activeBrand === 'celebrity' && styles.activeText,
            ]}
            numberOfLines={1}
          >
            Celebrity
          </Text>
        </TouchableOpacity>

        {showSilversea && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.middleButton,
              activeBrand === 'silversea' && styles.silverseaActiveButton,
            ]}
            onPress={() => onToggle('silversea')}
            activeOpacity={0.7}
            testID="brand-toggle-silversea"
          >
            <Text
              style={[
                styles.toggleText,
                activeBrand === 'silversea' && styles.activeText,
              ]}
              numberOfLines={1}
            >
              Silversea
            </Text>
          </TouchableOpacity>
        )}

        {showCarnival && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.rightButton,
              activeBrand === 'carnival' && styles.carnivalActiveButton,
            ]}
            onPress={() => onToggle('carnival')}
            activeOpacity={0.7}
            testID="brand-toggle-carnival"
          >
            <Text
              style={[
                styles.toggleText,
                activeBrand === 'carnival' && styles.activeText,
              ]}
              numberOfLines={1}
            >
              Carnival
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
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
  silverseaActiveButton: {
    backgroundColor: '#5B6574',
  },
  carnivalActiveButton: {
    backgroundColor: '#CC2232',
  },
  toggleText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
  },
  activeText: {
    color: COLORS.white,
  },
});
