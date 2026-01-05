import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface BrandToggleProps {
  activeBrand: 'royal' | 'celebrity';
  onToggle: (brand: 'royal' | 'celebrity') => void;
}

export function BrandToggle({ activeBrand, onToggle }: BrandToggleProps) {
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
          >
            Royal Caribbean
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.rightButton,
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
          >
            Celebrity Cruises
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  leftButton: {
    marginRight: 2,
  },
  rightButton: {
    marginLeft: 2,
  },
  activeButton: {
    backgroundColor: COLORS.textNavy,
  },
  toggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
  },
  activeText: {
    color: COLORS.white,
  },
});
