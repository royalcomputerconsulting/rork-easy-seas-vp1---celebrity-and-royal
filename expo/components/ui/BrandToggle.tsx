import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type { LoyaltyCardBrand } from '@/lib/loyalty/loyaltyCardBrandPreference';

export type BrandType = LoyaltyCardBrand;

interface BrandToggleProps {
  activeBrand: BrandType;
  onToggle: (brand: BrandType) => void;
  showSilversea?: boolean;
  showCarnival?: boolean;
  customFourthLabel?: string;
  customFourthActive?: boolean;
  onCustomFourthPress?: () => void;
  compact?: boolean;
}

export function BrandToggle({
  activeBrand,
  onToggle,
  showSilversea = true,
  showCarnival = true,
  customFourthLabel,
  customFourthActive = false,
  onCustomFourthPress,
  compact = false,
}: BrandToggleProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            compact && styles.toggleButtonCompact,
            styles.royalButton,
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
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            Royal Caribbean
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            compact && styles.toggleButtonCompact,
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
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            Celebrity
          </Text>
        </TouchableOpacity>

        {showSilversea && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              compact && styles.toggleButtonCompact,
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
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              Silversea
            </Text>
          </TouchableOpacity>
        )}

        {customFourthLabel ? (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              compact && styles.toggleButtonCompact,
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
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {customFourthLabel}
            </Text>
          </TouchableOpacity>
        ) : showCarnival && (
          <TouchableOpacity
            style={[
              styles.toggleButton,
              compact && styles.toggleButtonCompact,
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
              adjustsFontSizeToFit
              minimumFontScale={0.82}
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
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  containerCompact: {
    paddingVertical: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.round,
    padding: 0,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: 'rgba(255,253,249,0.72)',
  },
  toggleButtonCompact: {
    minHeight: 44,
    paddingVertical: 7,
  },
  royalButton: {
    flex: 1.45,
  },
  leftButton: {
    marginRight: 0,
  },
  middleButton: {
    marginHorizontal: 0,
  },
  rightButton: {
    marginLeft: 0,
  },
  activeButton: {
    backgroundColor: '#123D73',
    borderColor: '#123D73',
  },
  carnivalActiveButton: {
    backgroundColor: '#CC2232',
    borderColor: '#CC2232',
  },
  profileActiveButton: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  toggleText: {
    fontSize: 10.5,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
  },
  activeText: {
    color: COLORS.white,
  },
});
