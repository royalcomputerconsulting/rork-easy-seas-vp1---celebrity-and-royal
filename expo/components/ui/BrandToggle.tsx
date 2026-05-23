import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

export type BrandType = 'royal' | 'celebrity' | 'silversea' | 'carnival';

interface BrandToggleProps {
  activeBrand: BrandType;
  onToggle: (brand: BrandType) => void;
  showSilversea?: boolean;
  showCarnival?: boolean;
  customFourthLabel?: string;
  customFourthActive?: boolean;
  onCustomFourthPress?: () => void;
}

export function BrandToggle({
  activeBrand,
  onToggle,
  showSilversea = true,
  showCarnival = true,
  customFourthLabel,
  customFourthActive = false,
  onCustomFourthPress,
}: BrandToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.leftButton,
            !customFourthActive && activeBrand === 'royal' && styles.activeButton,
          ]}
          onPress={() => onToggle('royal')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              !customFourthActive && activeBrand === 'royal' && styles.activeText,
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
            !customFourthActive && activeBrand === 'celebrity' && styles.activeButton,
          ]}
          onPress={() => onToggle('celebrity')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              !customFourthActive && activeBrand === 'celebrity' && styles.activeText,
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
              !customFourthActive && activeBrand === 'silversea' && styles.activeButton,
            ]}
            onPress={() => onToggle('silversea')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                !customFourthActive && activeBrand === 'silversea' && styles.activeText,
              ]}
              numberOfLines={1}
            >
              Silversea
            </Text>
          </TouchableOpacity>
        )}

        {customFourthLabel ? (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.rightButton,
              customFourthActive && styles.profileActiveButton,
            ]}
            onPress={onCustomFourthPress}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                customFourthActive && styles.activeText,
              ]}
              numberOfLines={1}
            >
              {customFourthLabel}
            </Text>
          </TouchableOpacity>
        ) : showCarnival && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.rightButton,
              activeBrand === 'carnival' && styles.carnivalActiveButton,
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
  carnivalActiveButton: {
    backgroundColor: '#CC2232',
  },
  profileActiveButton: {
    backgroundColor: '#0F766E',
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
