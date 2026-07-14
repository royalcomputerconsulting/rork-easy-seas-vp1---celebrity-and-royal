import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';

type BadgeType = 'clubRoyale' | 'crownAnchor';

interface TierBadgeProps {
  tier: string;
  type?: BadgeType;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  showLabel?: boolean;
}

export const TierBadge = React.memo(function TierBadge({
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

  const tierColor = getTierColor();

  const content = (
    <LoyaltyPill
      label={tier}
      color={tierColor}
      size={size}
      style={styles.badge}
    />
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
});

interface TierBadgeGroupProps {
  clubRoyaleTier: string;
  crownAnchorLevel: string;
  size?: 'small' | 'medium' | 'large';
  onClubRoyalePress?: () => void;
  onCrownAnchorPress?: () => void;
}

export const TierBadgeGroup = React.memo(function TierBadgeGroup({
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
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
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
