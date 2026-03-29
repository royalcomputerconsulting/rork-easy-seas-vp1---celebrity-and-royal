import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { SETTINGS_GLASS_THEME } from '@/constants/settingsGlassTheme';

export type BrandType = 'royal' | 'celebrity' | 'silversea' | 'carnival';

interface BrandToggleProps {
  activeBrand: BrandType;
  onToggle: (brand: BrandType) => void;
  showSilversea?: boolean;
  showCarnival?: boolean;
}

export function BrandToggle({ activeBrand, onToggle, showSilversea = true, showCarnival = true }: BrandToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.leftButton,
            activeBrand === 'royal' && styles.activeButton,
          ]}
          onPress={() => onToggle('royal')}
          activeOpacity={0.7}
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
            activeBrand === 'celebrity' && styles.activeButton,
          ]}
          onPress={() => onToggle('celebrity')}
          activeOpacity={0.7}
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
              activeBrand === 'silversea' && styles.activeButton,
            ]}
            onPress={() => onToggle('silversea')}
            activeOpacity={0.7}
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
              activeBrand === 'carnival' && styles.activeButton,
            ]}
            onPress={() => onToggle('carnival')}
            activeOpacity={0.7}
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
    backgroundColor: SETTINGS_GLASS_THEME.surfaceMuted,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: SETTINGS_GLASS_THEME.border,
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
    backgroundColor: SETTINGS_GLASS_THEME.buttonPrimaryBackground,
  },
  toggleText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: SETTINGS_GLASS_THEME.textSecondary,
  },
  activeText: {
    color: SETTINGS_GLASS_THEME.buttonPrimaryText,
  },
});
