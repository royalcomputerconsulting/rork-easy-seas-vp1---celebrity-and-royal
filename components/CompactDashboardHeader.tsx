import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Bell, Ship, Anchor, Tag, CheckCircle2, Star, LogOut, Target } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { CLUB_ROYALE_TIERS, TIER_ORDER, getTierByPoints } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS, LEVEL_ORDER } from '@/constants/crownAnchor';
import { CELEBRITY_CAPTAINS_CLUB_LEVELS, CELEBRITY_LEVEL_ORDER, getCelebrityCaptainsClubLevelByPoints } from '@/constants/celebrityCaptainsClub';
import { CELEBRITY_BLUE_CHIP_TIERS, CELEBRITY_TIER_ORDER, getCelebrityBlueChipTierByLevel } from '@/constants/celebrityBlueChipClub';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useUser } from '@/state/UserProvider';
import { BrandToggle, BrandType } from '@/components/ui/BrandToggle';
import { IMAGES } from '@/constants/images';

interface CompactDashboardHeaderProps {
  memberName?: string;
  crownAnchorNumber?: string;
  onSettingsPress?: () => void;
  onAlertsPress?: () => void;
  onLogoutPress?: () => void;
  alertCount?: number;
  availableCruises?: number;
  bookedCruises?: number;
  activeOffers?: number;
  onCruisesPress?: () => void;
  onBookedPress?: () => void;
  onOffersPress?: () => void;
  hideLogo?: boolean;
}

export function CompactDashboardHeader({
  memberName = 'Player',
  crownAnchorNumber,
  onSettingsPress,
  onAlertsPress,
  onLogoutPress,
  alertCount = 0,
  availableCruises = 0,
  bookedCruises = 0,
  activeOffers = 0,
  onCruisesPress,
  onBookedPress,
  onOffersPress,
  hideLogo = false,
}: CompactDashboardHeaderProps) {
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    crownAnchorPoints,
    crownAnchorLevel,
    pinnacleProgress,
    mastersProgress,
    projectedBookedPoints,
  } = useLoyalty();
  const { currentUser } = useUser();
  const [activeBrand, setActiveBrand] = useState<BrandType>((currentUser?.preferredBrand === 'silversea' ? 'royal' : currentUser?.preferredBrand) || 'royal');

  useEffect(() => {
    setActiveBrand((currentUser?.preferredBrand === 'silversea' ? 'royal' : currentUser?.preferredBrand) || 'royal');
  }, [currentUser?.preferredBrand]);

  const celebrityCaptainsClubPoints = currentUser?.celebrityCaptainsClubPoints || 0;
  const celebrityBlueChipPoints = currentUser?.celebrityBlueChipPoints || 0;
  const celebrityLevel = getCelebrityCaptainsClubLevelByPoints(celebrityCaptainsClubPoints);
  const celebrityTier = getCelebrityBlueChipTierByLevel(1);

  const formatETAFromDate = (date: Date | null): string => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCruiseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTierColor = (tier: string): string => {
    const tierData = CLUB_ROYALE_TIERS[tier as keyof typeof CLUB_ROYALE_TIERS];
    return tierData?.color || COLORS.beigeWarm;
  };

  const marbleConfig = MARBLE_TEXTURES.lightBlue;

  const displayName = activeBrand === 'royal' ? memberName : (currentUser?.name || memberName);
  const displayNumber = activeBrand === 'royal' 
    ? (crownAnchorNumber || currentUser?.crownAnchorNumber || '305812247')
    : (currentUser?.celebrityCaptainsClubNumber || 'Not set');
  const displayNumberLabel = activeBrand === 'royal' ? 'C&A #' : 'Captain\'s Club #';

  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.topRow}>
        <View style={styles.memberInfoInline}>
          {!hideLogo && (
            <Image 
              source={{ uri: IMAGES.logo }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          )}
          <View style={styles.memberTextInfo}>
            <Text style={styles.memberGreeting}>{displayName}</Text>
            <Text style={styles.memberSubtitle}>{displayNumberLabel} {displayNumber}</Text>
          </View>
        </View>
        
        <View style={styles.actionsSection}>
          {onAlertsPress && (
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={onAlertsPress}
              activeOpacity={0.7}
            >
              <Bell size={18} color={CLEAN_THEME.text.primary} />
              {alertCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {onLogoutPress && (
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={onLogoutPress}
              activeOpacity={0.7}
            >
              <LogOut size={18} color={CLEAN_THEME.text.primary} />
            </TouchableOpacity>
          )}
          {onSettingsPress && (
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={onSettingsPress}
              activeOpacity={0.7}
            >
              <Settings size={18} color={CLEAN_THEME.text.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <BrandToggle activeBrand={activeBrand} onToggle={setActiveBrand} />

      {activeBrand === 'royal' ? (
        <>
      <View style={styles.tierRow}>
        <View style={[styles.tierBadge, { backgroundColor: getTierColor(clubRoyaleTier) + '30', borderColor: getTierColor(clubRoyaleTier) }]}>
          <Text style={[styles.tierText, { color: getTierColor(clubRoyaleTier) }]}>{clubRoyaleTier.toUpperCase()}</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: COLORS.pointsBg, borderColor: COLORS.points }]}>
          <Text style={[styles.tierText, { color: COLORS.points }]}>{crownAnchorLevel.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.progressGrid}>
        {/* BAR 1: Loyalty Progress (Crown & Anchor) - Always show current → next level */}
        {(() => {
          const currentLevelIndex = LEVEL_ORDER.indexOf(crownAnchorLevel);
          const nextLevel = currentLevelIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentLevelIndex + 1] : null;
          const isPinnacle = crownAnchorLevel === 'Pinnacle';
          
          const currentThreshold = CROWN_ANCHOR_LEVELS[crownAnchorLevel]?.cruiseNights || 0;
          const nextThreshold = nextLevel ? CROWN_ANCHOR_LEVELS[nextLevel]?.cruiseNights : 700;
          const rangeSize = nextThreshold - currentThreshold;
          const progressInRange = crownAnchorPoints - currentThreshold;
          const percentComplete = isPinnacle ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const nightsToNext = isPinnacle ? 0 : Math.max(0, nextThreshold - crownAnchorPoints);
          
          const levelColor = CROWN_ANCHOR_LEVELS[crownAnchorLevel]?.color || COLORS.points;
          const nextLevelColor = nextLevel ? CROWN_ANCHOR_LEVELS[nextLevel]?.color : levelColor;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {isPinnacle 
                    ? `Pinnacle (${crownAnchorPoints}/700)`
                    : `${crownAnchorLevel} → ${nextLevel} (${crownAnchorPoints}/${nextThreshold})`
                  }
                </Text>
                {isPinnacle ? (
                  <View style={styles.achievedBadge}>
                    <Text style={styles.achievedBadgeText}>MAX LEVEL</Text>
                  </View>
                ) : (
                  <Text style={styles.progressPercent}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[levelColor, nextLevelColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isPinnacle 
                  ? 'Pinnacle achieved! Maximum loyalty level reached'
                  : (() => {
                      const bookedPoints = projectedBookedPoints || 0;
                      const remainingAfterBooked = Math.max(0, nightsToNext - bookedPoints);
                      return `Booked: ${bookedPoints} pts • Still need: ${remainingAfterBooked} pts`;
                    })()
                }
              </Text>

              {!isPinnacle && pinnacleProgress.thresholdCrossedShip && pinnacleProgress.thresholdCrossedSailDate && (
                <View style={styles.pinnacleDetailsContainer}>
                  <View style={styles.pinnacleDetailRow}>
                    <View style={styles.pinnacleIconBadge}>
                      <Target size={10} color="#DC2626" />
                    </View>
                    <View style={styles.pinnacleDetailContent}>
                      <Text style={styles.pinnacleDetailLabel}>Threshold Crossed On:</Text>
                      <Text style={styles.pinnacleDetailValue} numberOfLines={1}>
                        {pinnacleProgress.thresholdCrossedShip} • {formatCruiseDate(pinnacleProgress.thresholdCrossedSailDate)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pinnacleDetailRow}>
                    <View style={styles.pinnacleStarBadge}>
                      <Star size={10} color={COLORS.goldDark} fill={COLORS.goldDark} />
                    </View>
                    <View style={styles.pinnacleDetailContent}>
                      <Text style={styles.pinnacleDetailLabel}>First Cruise AS Pinnacle:</Text>
                      <Text style={[styles.pinnacleDetailValue, styles.pinnacleHighlight]} numberOfLines={1}>
                        {pinnacleProgress.pinnacleShip && pinnacleProgress.pinnacleSailDate
                          ? `${pinnacleProgress.pinnacleShip} • ${formatCruiseDate(pinnacleProgress.pinnacleSailDate)}`
                          : 'Not booked yet'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* BAR 2: Current Club Royale Progress - Current tier → Next tier */}
        {(() => {
          const currentTier = getTierByPoints(clubRoyalePoints);
          const currentTierIndex = TIER_ORDER.indexOf(currentTier);
          const nextTier = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;
          const isMasters = currentTier === 'Masters';
          
          const currentThreshold = CLUB_ROYALE_TIERS[currentTier]?.threshold || 0;
          const nextThreshold = nextTier ? CLUB_ROYALE_TIERS[nextTier]?.threshold : currentThreshold;
          const rangeSize = nextThreshold - currentThreshold;
          const progressInRange = clubRoyalePoints - currentThreshold;
          const percentComplete = isMasters ? 100 : (rangeSize > 0 ? Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100)) : 100);
          const pointsToNext = isMasters ? 0 : Math.max(0, nextThreshold - clubRoyalePoints);
          
          const tierColor = CLUB_ROYALE_TIERS[currentTier]?.color || '#8B5CF6';
          const nextTierColor = nextTier ? CLUB_ROYALE_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {isMasters 
                    ? `Masters (${clubRoyalePoints.toLocaleString()})`
                    : `${currentTier} → ${nextTier} (${clubRoyalePoints.toLocaleString()}/${nextThreshold.toLocaleString()})`
                  }
                </Text>
                {isMasters ? (
                  <View style={styles.achievedBadge}>
                    <Text style={styles.achievedBadgeText}>MAX TIER</Text>
                  </View>
                ) : (
                  <Text style={styles.progressPercent}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isMasters 
                  ? 'Masters tier achieved! Maximum Club Royale tier'
                  : `ETA: ${formatETAFromDate(mastersProgress.projectedDate)} • ${pointsToNext.toLocaleString()} pts to ${nextTier} • Resets April 1`
                }
              </Text>
            </View>
          );
        })()}

        {/* BAR 3: Prior Club Royale Level (ACHIEVED) - Only show if user is above Choice tier */}
        {(() => {
          const currentTier = getTierByPoints(clubRoyalePoints);
          const currentTierIndex = TIER_ORDER.indexOf(currentTier);
          
          // Only show this bar if user has achieved at least Prime (index >= 1)
          if (currentTierIndex < 1) {
            return null;
          }
          
          // The "achieved" bar shows the transition TO the current tier
          const priorTier = TIER_ORDER[currentTierIndex - 1];
          const priorTierColor = CLUB_ROYALE_TIERS[priorTier]?.color || '#6B7280';
          const currentTierColor = CLUB_ROYALE_TIERS[currentTier]?.color || '#8B5CF6';
          const achievedThreshold = CLUB_ROYALE_TIERS[currentTier]?.threshold || 0;
          
          return (
            <View style={[styles.progressCard, styles.achievedCard]}>
              <View style={styles.progressHeader}>
                <View style={styles.achievedLabelRow}>
                  <CheckCircle2 size={14} color={CLEAN_THEME.badge.achieved.text} />
                  <Text style={styles.progressLabel}>
                    {priorTier} → {currentTier} ({achievedThreshold.toLocaleString()} pts)
                  </Text>
                </View>
                <View style={styles.achievedBadge}>
                  <Text style={styles.achievedBadgeText}>ACHIEVED</Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[priorTierColor, currentTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: '100%' }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {currentTier} tier achieved! You have earned this status.
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{clubRoyalePoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>CR Points</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{crownAnchorPoints}</Text>
          <Text style={styles.statLabel}>C&A</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pinnacleProgress.nightsToNext}</Text>
          <Text style={styles.statLabel}>To Pinnacle</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={styles.quickStatPillValue}>{availableCruises}</Text>
          <Text style={styles.quickStatPillLabel}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={styles.quickStatPillValue}>{bookedCruises}</Text>
          <Text style={styles.quickStatPillLabel}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={styles.quickStatPillValue}>{activeOffers}</Text>
          <Text style={styles.quickStatPillLabel}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      ) : (
        <>
      <View style={styles.tierRow}>
        <View style={[styles.tierBadge, { backgroundColor: CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color + '30' || '#F0EAD6' + '30', borderColor: CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#F0EAD6' }]}>
          <Text style={[styles.tierText, { color: CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#F0EAD6' }]}>{celebrityTier.toUpperCase()}</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.color + '30' || '#708090' + '30', borderColor: CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.color || '#708090' }]}>
          <Text style={[styles.tierText, { color: CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.color || '#708090' }]}>{celebrityLevel.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.progressGrid}>
        {/* Celebrity Captain's Club Progress */}
        {(() => {
          const currentLevelIndex = CELEBRITY_LEVEL_ORDER.indexOf(celebrityLevel);
          const nextLevel = currentLevelIndex < CELEBRITY_LEVEL_ORDER.length - 1 ? CELEBRITY_LEVEL_ORDER[currentLevelIndex + 1] : null;
          const isZenith = celebrityLevel === 'Zenith';
          
          const currentThreshold = CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.cruisePoints || 0;
          const nextThreshold = nextLevel ? CELEBRITY_CAPTAINS_CLUB_LEVELS[nextLevel]?.cruisePoints : 3000;
          const rangeSize = nextThreshold - currentThreshold;
          const progressInRange = celebrityCaptainsClubPoints - currentThreshold;
          const percentComplete = isZenith ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const pointsToNext = isZenith ? 0 : Math.max(0, nextThreshold - celebrityCaptainsClubPoints);
          
          const levelColor = CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.color || '#708090';
          const nextLevelColor = nextLevel ? CELEBRITY_CAPTAINS_CLUB_LEVELS[nextLevel]?.color : levelColor;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {isZenith 
                    ? `Zenith (${celebrityCaptainsClubPoints}/3,000)`
                    : `${celebrityLevel} → ${nextLevel} (${celebrityCaptainsClubPoints}/${nextThreshold})`
                  }
                </Text>
                {isZenith ? (
                  <View style={styles.achievedBadge}>
                    <Text style={styles.achievedBadgeText}>MAX LEVEL</Text>
                  </View>
                ) : (
                  <Text style={styles.progressPercent}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[levelColor, nextLevelColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isZenith 
                  ? 'Zenith achieved! Maximum Captain\'s Club level'
                  : `${pointsToNext} pts to ${nextLevel}`
                }
              </Text>
            </View>
          );
        })()}

        {/* Celebrity Blue Chip Progress */}
        {(() => {
          const currentTierIndex = CELEBRITY_TIER_ORDER.indexOf(celebrityTier);
          const nextTier = currentTierIndex < CELEBRITY_TIER_ORDER.length - 1 ? CELEBRITY_TIER_ORDER[currentTierIndex + 1] : null;
          const isRuby = celebrityTier === 'Ruby';
          
          const tierColor = CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#F0EAD6';
          const nextTierColor = nextTier ? CELEBRITY_BLUE_CHIP_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {isRuby 
                    ? `Ruby (${celebrityBlueChipPoints.toLocaleString()} pts)`
                    : `${celebrityTier} → ${nextTier} (${celebrityBlueChipPoints.toLocaleString()} pts)`
                  }
                </Text>
                {isRuby ? (
                  <View style={styles.achievedBadge}>
                    <Text style={styles.achievedBadgeText}>MAX TIER</Text>
                  </View>
                ) : (
                  <Text style={styles.progressPercent}>--</Text>
                )}
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: isRuby ? '100%' : '0%' }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isRuby 
                  ? 'Ruby tier achieved! Maximum Blue Chip tier'
                  : 'Play in the casino to earn tier progress'
                }
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{celebrityBlueChipPoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Blue Chip Pts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{celebrityCaptainsClubPoints}</Text>
          <Text style={styles.statLabel}>Captain&apos;s Club</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.max(0, 3000 - celebrityCaptainsClubPoints)}</Text>
          <Text style={styles.statLabel}>To Zenith</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={styles.quickStatPillValue}>{availableCruises}</Text>
          <Text style={styles.quickStatPillLabel}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={styles.quickStatPillValue}>{bookedCruises}</Text>
          <Text style={styles.quickStatPillLabel}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickStatPill}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={styles.quickStatPillValue}>{activeOffers}</Text>
          <Text style={styles.quickStatPillLabel}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  memberInfoInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  memberTextInfo: {
    flex: 1,
  },
  memberGreeting: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.primary,
  },
  memberSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CLEAN_THEME.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  tierRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tierBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
  progressGrid: {
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressPercent: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: CLEAN_THEME.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressEta: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    marginTop: 4,
  },
  pinnacleDetailsContainer: {
    marginTop: SPACING.xs,
    gap: 4,
  },
  pinnacleDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  pinnacleIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  pinnacleStarBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  pinnacleDetailContent: {
    flex: 1,
  },
  pinnacleDetailLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginBottom: 2,
  },
  pinnacleDetailValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  pinnacleHighlight: {
    color: COLORS.goldDark,
  },
  achievedBadge: {
    backgroundColor: CLEAN_THEME.badge.achieved.bg,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  achievedBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.badge.achieved.text,
    letterSpacing: 0.5,
  },
  achievedCard: {
    borderColor: CLEAN_THEME.badge.achieved.bg,
    borderWidth: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  achievedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: CLEAN_THEME.background.card,
    borderRadius: BORDER_RADIUS.xs,
    padding: SPACING.xs,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: CLEAN_THEME.border.light,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.data.value,
  },
  statLabel: {
    fontSize: 10,
    color: CLEAN_THEME.data.label,
    marginTop: 1,
  },
  quickStatsPillRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  quickStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs,
    gap: 3,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  quickStatPillValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.data.value,
  },
  quickStatPillLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.data.label,
  },
});
