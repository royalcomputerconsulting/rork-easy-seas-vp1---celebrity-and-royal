import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';

type BadgeType = 'clubRoyale' | 'crownAnchor';

interface TierBadgeProps {
  tier: string;
  type?: BadgeType;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  showLabel?: boolean;
}

export function TierBadge({
  tier,
  type = 'clubRoyale',
  size = 'medium',
  onPress,
  showLabel = false,
}: TierBadgeProps) {
  const getTierColor = () => {
    if (type === 'clubRoyale') {
      return CLUB_ROYALE_TIERS[tier]?.color || COLORS.beigeWarm;
    }
    return CROWN_ANCHOR_LEVELS[tier]?.color || COLORS.beigeWarm;
  };

  const getBgColor = () => {
    if (type === 'clubRoyale') {
      return CLUB_ROYALE_TIERS[tier]?.bgColor || 'rgba(212, 165, 116, 0.15)';
    }
    return CROWN_ANCHOR_LEVELS[tier]?.bgColor || 'rgba(212, 165, 116, 0.15)';
  };

  const tierColor = getTierColor();
  const bgColor = getBgColor();

  const sizeStyles = {
    small: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      fontSize: TYPOGRAPHY.fontSizeXS,
      borderRadius: BORDER_RADIUS.sm,
    },
    medium: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      fontSize: TYPOGRAPHY.fontSizeSM,
      borderRadius: BORDER_RADIUS.md,
    },
    large: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      fontSize: TYPOGRAPHY.fontSizeMD,
      borderRadius: BORDER_RADIUS.lg,
    },
  };

  const currentSize = sizeStyles[size];

  const content = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          borderRadius: currentSize.borderRadius,
          borderColor: tierColor,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: currentSize.fontSize,
            color: tierColor,
          },
        ]}
      >
        {tier.toUpperCase()}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.container}>
          {showLabel && (
            <Text style={styles.label}>
              {type === 'clubRoyale' ? 'Club Royale' : 'Crown & Anchor'}
            </Text>
          )}
          {content}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          {type === 'clubRoyale' ? 'Club Royale' : 'Crown & Anchor'}
        </Text>
      )}
      {content}
    </View>
  );
}

interface TierBadgeGroupProps {
  clubRoyaleTier: string;
  crownAnchorLevel: string;
  size?: 'small' | 'medium' | 'large';
  onClubRoyalePress?: () => void;
  onCrownAnchorPress?: () => void;
}

export function TierBadgeGroup({
  clubRoyaleTier,
  crownAnchorLevel,
  size = 'medium',
  onClubRoyalePress,
  onCrownAnchorPress,
}: TierBadgeGroupProps) {
  return (
    <View style={styles.group}>
      <TierBadge
        tier={clubRoyaleTier}
        type="clubRoyale"
        size={size}
        onPress={onClubRoyalePress}
      />
      <TierBadge
        tier={crownAnchorLevel}
        type="crownAnchor"
        size={size}
        onPress={onCrownAnchorPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  group: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
});
