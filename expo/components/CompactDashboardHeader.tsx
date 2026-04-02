import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Bell, Ship, Anchor, Tag, CheckCircle2, Star, LogOut, Target, Users, Crown } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { CLUB_ROYALE_TIERS, TIER_ORDER, getTierByPoints } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS, LEVEL_ORDER } from '@/constants/crownAnchor';
import { CELEBRITY_CAPTAINS_CLUB_LEVELS, CELEBRITY_LEVEL_ORDER, getCelebrityCaptainsClubLevelByPoints, resolveCelebrityCaptainsClubLevelKey } from '@/constants/celebrityCaptainsClub';
import { CELEBRITY_BLUE_CHIP_TIERS, CELEBRITY_TIER_ORDER, getCelebrityBlueChipTierByPoints, resolveCelebrityBlueChipTierKey } from '@/constants/celebrityBlueChipClub';
import { SILVERSEA_VENETIAN_TIERS, SILVERSEA_TIER_ORDER, getSilverseaTierByDays, resolveSilverseaTierKey } from '@/constants/silverseaVenetianSociety';
import { SILVERSEA_CASINO_TIERS, SILVERSEA_CASINO_TIER_ORDER, getSilverseaCasinoTierByPoints, resolveSilverseaCasinoTierKey } from '@/constants/silverseaCasinoClub';
import { CARNIVAL_VIFP_TIERS, CARNIVAL_VIFP_TIER_ORDER, CARNIVAL_PLAYERS_CLUB_TIERS } from '@/constants/carnivalVifpClub';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { BrandToggle, BrandType } from '@/components/ui/BrandToggle';
import { IMAGES } from '@/constants/images';
import { maskSensitiveMemberNumber } from '@/lib/privacy';

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
  crewMemberCount?: number;
}

type GradientPair = [string, string];

function getDisplayClubRoyaleTier(value: string): string {
  return value === 'Choice' ? 'Classic' : value;
}

function getDisplayCrownAnchorLevel(value: string): string {
  return value === 'Pinnacle' ? 'Pinnacle Club' : value;
}

function getClubRoyaleTierAccentColor(value: string): string {
  switch (value) {
    case 'Choice':
    case 'Classic':
      return '#BFC7D4';
    case 'Prime':
      return '#D4AF37';
    case 'Signature':
      return '#7B2D8E';
    case 'Masters':
      return '#16A34A';
    default:
      return CLUB_ROYALE_TIERS[value]?.color || COLORS.tierSignature;
  }
}

function getClubRoyaleProgressColors(currentTier: string, nextTier: string | null): GradientPair {
  if (currentTier === 'Choice' && nextTier === 'Prime') {
    return ['#C7CED9', '#D4AF37'];
  }

  if (currentTier === 'Prime' && nextTier === 'Signature') {
    return ['#4B7BF5', '#7B2D8E'];
  }

  if (currentTier === 'Signature' && nextTier === 'Masters') {
    return ['#7B2D8E', '#D4AF37'];
  }

  if (currentTier === 'Masters') {
    return ['#16A34A', '#6DD3A0'];
  }

  const currentColor = getClubRoyaleTierAccentColor(currentTier);
  const nextColor = nextTier ? getClubRoyaleTierAccentColor(nextTier) : currentColor;

  return [currentColor, nextColor];
}

export const CompactDashboardHeader = React.memo(function CompactDashboardHeader({
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
  crewMemberCount = 0,
}: CompactDashboardHeaderProps) {
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    crownAnchorPoints,
    crownAnchorLevel,
    pinnacleProgress,
    mastersProgress,
    projectedBookedPoints,
    extendedLoyalty,
    captainsClub,
  } = useLoyalty();
  const { currentUser, updateUser, ensureOwner } = useUser();
  const { isAdmin } = useAuth();
  const preferredBrand = currentUser?.preferredBrand === 'carnival' ? 'royal' : currentUser?.preferredBrand || 'royal';
  const [activeBrand, setActiveBrand] = useState<BrandType>(preferredBrand);

  useEffect(() => {
    setActiveBrand(currentUser?.preferredBrand === 'carnival' ? 'royal' : currentUser?.preferredBrand || 'royal');
  }, [currentUser?.preferredBrand]);

  const handleBrandToggle = useCallback((brand: BrandType) => {
    console.log('[CompactDashboardHeader] Brand toggle pressed:', {
      previousBrand: activeBrand,
      nextBrand: brand,
      currentUserId: currentUser?.id,
    });

    setActiveBrand(brand);

    void (async () => {
      try {
        const targetUser = currentUser ?? await ensureOwner();

        if (targetUser.preferredBrand === brand) {
          console.log('[CompactDashboardHeader] Preferred brand already persisted, skipping update');
          return;
        }

        await updateUser(targetUser.id, { preferredBrand: brand });
        console.log('[CompactDashboardHeader] Persisted preferred brand:', {
          userId: targetUser.id,
          preferredBrand: brand,
        });
      } catch (error) {
        console.error('[CompactDashboardHeader] Failed to persist preferred brand:', error);
      }
    })();
  }, [activeBrand, currentUser, ensureOwner, updateUser]);

  const celebrityCaptainsClubPoints = captainsClub.points ?? currentUser?.celebrityCaptainsClubPoints ?? 0;
  const celebrityBlueChipPoints = extendedLoyalty?.celebrityBlueChipPoints ?? currentUser?.celebrityBlueChipPoints ?? 0;
  const celebrityLevel = resolveCelebrityCaptainsClubLevelKey(captainsClub.tier ?? getCelebrityCaptainsClubLevelByPoints(celebrityCaptainsClubPoints));
  const celebrityTier = resolveCelebrityBlueChipTierKey(extendedLoyalty?.celebrityBlueChipTier ?? getCelebrityBlueChipTierByPoints(celebrityBlueChipPoints));

  const formatETAFromDate = (date: Date | null): string => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCruiseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'TBD';

    // Prefer MM-DD-YYYY for these labels (avoids showing ISO YYYY-M-D)
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${mm}-${dd}-${y}`;
    }

    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return String(dateStr);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yy = String(dt.getFullYear());
    return `${mm}-${dd}-${yy}`;
  };

  const playerCardTheme = (() => {
    switch (activeBrand) {
      case 'celebrity':
        return {
          marbleConfig: MARBLE_TEXTURES.white,
          borderColor: 'rgba(17, 24, 39, 0.16)',
          backgroundOverlayColors: ['rgba(255,255,255,0.62)', 'rgba(244,244,245,0.42)', 'rgba(255,255,255,0.16)'] as [string, string, string],
          atmosphereOverlayColors: ['rgba(17,24,39,0.12)', 'rgba(161,161,170,0.08)', 'rgba(255,255,255,0.06)'] as [string, string, string],
          contentBackground: 'rgba(255, 255, 255, 0.18)',
        };
      case 'silversea':
        return {
          marbleConfig: MARBLE_TEXTURES.gold,
          borderColor: 'rgba(124, 90, 55, 0.16)',
          backgroundOverlayColors: ['rgba(255,252,246,0.58)', 'rgba(255,244,214,0.38)', 'rgba(255,255,255,0.14)'] as [string, string, string],
          atmosphereOverlayColors: ['rgba(124,90,55,0.10)', 'rgba(255,255,255,0.08)', 'rgba(255,236,179,0.06)'] as [string, string, string],
          contentBackground: 'rgba(255, 248, 236, 0.14)',
        };
      default:
        return {
          marbleConfig: MARBLE_TEXTURES.lightBlue,
          borderColor: 'rgba(255, 255, 255, 0.26)',
          backgroundOverlayColors: ['rgba(255,255,255,0.56)', 'rgba(255,248,236,0.34)', 'rgba(255,255,255,0.12)'] as [string, string, string],
          atmosphereOverlayColors: ['rgba(255,255,255,0.18)', 'rgba(246,214,142,0.16)', 'rgba(103, 232, 249, 0.10)'] as [string, string, string],
          contentBackground: 'rgba(255, 248, 236, 0.12)',
        };
    }
  })();
  const marbleConfig = playerCardTheme.marbleConfig;

  const formatMemberDisplayName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Player';
    return trimmed;
  };

  const renderStandoutBadge = (
    label: string,
    value: string,
    accentColor: string,
    type: 'club' | 'loyalty' | 'metric',
    displayValueOverride?: string
  ) => {
    const displayValue = displayValueOverride ?? (type === 'club'
      ? getDisplayClubRoyaleTier(value)
      : type === 'loyalty'
        ? getDisplayCrownAnchorLevel(value)
        : value);
    const isLoyalty = type === 'loyalty';
    const isClub = type === 'club';
    const badgeTextColor = isLoyalty ? '#111111' : accentColor;
    const badgeLabelColor = isLoyalty ? 'rgba(17,17,17,0.72)' : 'rgba(15, 36, 57, 0.68)';
    const badgeBorderColor = isLoyalty ? 'rgba(17,17,17,0.08)' : `${accentColor}28`;
    const badgeIconColor = isClub ? COLORS.white : accentColor;
    const badgeTestId = `player-card-badge-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    return (
      <View style={[styles.spotlightBadge, { borderColor: badgeBorderColor }]} testID={badgeTestId}>
        <View
          style={[
            styles.spotlightBadgeIcon,
            isClub
              ? { backgroundColor: accentColor }
              : {
                  backgroundColor: isLoyalty ? 'rgba(255,255,255,0.70)' : `${accentColor}14`,
                  borderWidth: 1,
                  borderColor: isLoyalty ? 'rgba(17,17,17,0.08)' : `${accentColor}30`,
                },
          ]}
        >
          {isClub ? (
            <Star size={12} color={COLORS.white} fill={COLORS.white} />
          ) : type === 'metric' ? (
            <Anchor size={13} color={badgeIconColor} />
          ) : (
            <Crown size={14} color={badgeIconColor} />
          )}
        </View>
        <View style={styles.spotlightBadgeContent}>
          <Text style={[styles.spotlightBadgeLabel, { color: badgeLabelColor }]}>{label}</Text>
          <Text style={[styles.spotlightBadgeValue, { color: badgeTextColor }]} numberOfLines={1}>
            {displayValue.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  const displayName = formatMemberDisplayName(currentUser?.name || memberName);
  const royalMemberNumber = crownAnchorNumber || currentUser?.crownAnchorNumber;
  const displayNumber = activeBrand === 'royal'
    ? maskSensitiveMemberNumber(royalMemberNumber, 'Not set', { reveal: isAdmin })
    : activeBrand === 'celebrity'
    ? maskSensitiveMemberNumber(currentUser?.celebrityCaptainsClubNumber, 'Not set', { reveal: isAdmin })
    : activeBrand === 'silversea'
    ? maskSensitiveMemberNumber(currentUser?.silverseaVenetianNumber, 'Not set', { reveal: isAdmin })
    : maskSensitiveMemberNumber(currentUser?.carnivalVifpNumber, 'Not set', { reveal: isAdmin });
  const displayNumberLabel = activeBrand === 'royal' ? 'Crown & Anchor #'
    : activeBrand === 'celebrity' ? 'Captain\'s Club #'
    : activeBrand === 'silversea' ? 'Venetian Society #'
    : 'VIFP Club #';

  const silverseaPoints = currentUser?.silverseaVenetianPoints || 0;
  const silverseaTier = resolveSilverseaTierKey(currentUser?.silverseaVenetianTier || getSilverseaTierByDays(silverseaPoints));
  const silverseaCasinoPoints = currentUser?.silverseaCasinoPoints || 0;
  const silverseaCasinoTier = resolveSilverseaCasinoTierKey(currentUser?.silverseaCasinoTier || getSilverseaCasinoTierByPoints(silverseaCasinoPoints));

  const carnivalVifpTier = currentUser?.carnivalVifpTier || 'Blue';
  const carnivalPlayersClubTier = currentUser?.carnivalPlayersClubTier || 'Blue';
  const carnivalPlayersClubPoints = currentUser?.carnivalPlayersClubPoints || 0;
  const scenicHeroUri = activeBrand === 'celebrity'
    ? 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1600&q=80'
    : activeBrand === 'silversea'
      ? 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1600&q=80'
      : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';

  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: playerCardTheme.borderColor }]}
    >
      <Image
        source={{ uri: scenicHeroUri }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={playerCardTheme.backgroundOverlayColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.backgroundOverlay}
      />
      <LinearGradient
        colors={playerCardTheme.atmosphereOverlayColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.atmosphereOverlay}
      />
      <View style={[styles.contentLayer, { backgroundColor: playerCardTheme.contentBackground }]}>
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
              <Bell size={18} color="#111111" />
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
              <LogOut size={18} color="#111111" />
            </TouchableOpacity>
          )}
          {onSettingsPress && (
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={onSettingsPress}
              activeOpacity={0.7}
            >
              <Settings size={18} color="#111111" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <BrandToggle activeBrand={activeBrand} onToggle={handleBrandToggle} showCarnival={false} variant="playerCard" />

      {activeBrand === 'royal' ? (
        <>
      {/* === ROYAL CARIBBEAN === */}
      <View style={styles.tierRow}>
        {renderStandoutBadge('Club Royale', clubRoyaleTier, getClubRoyaleTierAccentColor(clubRoyaleTier), 'club')}
        {renderStandoutBadge('Crown & Anchor', crownAnchorLevel, CROWN_ANCHOR_LEVELS[crownAnchorLevel]?.color || COLORS.navyDeep, 'loyalty')}
      </View>
      {crewMemberCount > 0 && (
        <View style={styles.crewCountRow}>
          <Users size={13} color={CLEAN_THEME.text.secondary} />
          <Text style={styles.crewCountText}>{crewMemberCount} crew members</Text>
        </View>
      )}

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
          const currentDisplayLevel = getDisplayCrownAnchorLevel(crownAnchorLevel);
          const nextDisplayLevel = nextLevel ? getDisplayCrownAnchorLevel(nextLevel) : null;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Crown size={13} color={levelColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: levelColor }]}>{currentDisplayLevel}</Text>
                    {!isPinnacle && nextDisplayLevel ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextLevelColor }]}>{nextDisplayLevel}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>{` (${crownAnchorPoints}/${nextThreshold})`}</Text>
                  </Text>
                </View>
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
                        {`${pinnacleProgress.thresholdCrossedShip} • ${formatCruiseDate(pinnacleProgress.thresholdCrossedSailDate)}`}
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
          
          const tierColor = getClubRoyaleTierAccentColor(currentTier);
          const nextTierColor = nextTier ? getClubRoyaleTierAccentColor(nextTier) : tierColor;
          const currentTierDisplay = getDisplayClubRoyaleTier(currentTier);
          const nextTierDisplay = nextTier ? getDisplayClubRoyaleTier(nextTier) : null;
          const tierProgressColors = getClubRoyaleProgressColors(currentTier, nextTier);
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Star size={13} color={tierColor} fill={tierColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: tierColor }]}>{currentTierDisplay}</Text>
                    {!isMasters && nextTierDisplay ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextTierColor }]}>{nextTierDisplay}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>
                      {isMasters
                        ? ` (${clubRoyalePoints.toLocaleString()})`
                        : ` (${clubRoyalePoints.toLocaleString()}/${nextThreshold.toLocaleString()})`}
                    </Text>
                  </Text>
                </View>
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
                  colors={tierProgressColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isMasters 
                  ? 'Masters tier achieved! Maximum Club Royale tier'
                  : `ETA: ${formatETAFromDate(mastersProgress.projectedDate)} • ${pointsToNext.toLocaleString()} pts to ${nextTierDisplay} • Resets April 1`
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
          const priorTierColor = getClubRoyaleTierAccentColor(priorTier);
          const currentTierColor = getClubRoyaleTierAccentColor(currentTier);
          const achievedThreshold = CLUB_ROYALE_TIERS[currentTier]?.threshold || 0;
          const priorTierDisplay = getDisplayClubRoyaleTier(priorTier);
          const currentTierDisplay = getDisplayClubRoyaleTier(currentTier);
          const achievedProgressColors = getClubRoyaleProgressColors(priorTier, currentTier);
          
          return (
            <View style={[styles.progressCard, styles.achievedCard]}>
              <View style={styles.progressHeader}>
                <View style={styles.achievedLabelRow}>
                  <CheckCircle2 size={14} color={currentTierColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: priorTierColor }]}>{priorTierDisplay}</Text>
                    <Text style={styles.progressLabelMeta}> → </Text>
                    <Text style={[styles.progressLabelTier, { color: currentTierColor }]}>{currentTierDisplay}</Text>
                    <Text style={styles.progressLabelMeta}>{` (${achievedThreshold.toLocaleString()} pts)`}</Text>
                  </Text>
                </View>
                <View style={styles.achievedBadge}>
                  <Text style={styles.achievedBadgeText}>ACHIEVED</Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={achievedProgressColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: '100%' }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {currentTierDisplay} tier achieved! You have earned this status.
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.royalStatValue}>{clubRoyalePoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>CR Points</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.royalStatValue}>{crownAnchorPoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>C&A</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.royalStatValue}>{pinnacleProgress.nightsToNext.toLocaleString()}</Text>
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
      ) : activeBrand === 'celebrity' ? (
        <>
      {/* === CELEBRITY CRUISES === */}
      <View style={styles.tierRow}>
        {renderStandoutBadge('Blue Chip Club', celebrityTier, CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#B9BCC2', 'club')}
        {renderStandoutBadge("Captain's Club", celebrityLevel, CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel]?.color || '#708090', 'loyalty')}
      </View>

      <View style={styles.progressGrid}>
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
            <View style={styles.progressCard} testID="celebrity-captains-club-progress-card">
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Crown size={13} color={levelColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: levelColor }]}>{celebrityLevel}</Text>
                    {!isZenith && nextLevel ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextLevelColor }]}>{nextLevel}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>
                      {isZenith
                        ? ` (${celebrityCaptainsClubPoints.toLocaleString()}/3,000)`
                        : ` (${celebrityCaptainsClubPoints.toLocaleString()}/${nextThreshold.toLocaleString()})`}
                    </Text>
                  </Text>
                </View>
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
                  : `${pointsToNext.toLocaleString()} pts to ${nextLevel}`
                }
              </Text>
            </View>
          );
        })()}

        {(() => {
          const currentTierIndex = CELEBRITY_TIER_ORDER.indexOf(celebrityTier);
          const nextTier = currentTierIndex < CELEBRITY_TIER_ORDER.length - 1 ? CELEBRITY_TIER_ORDER[currentTierIndex + 1] : null;
          const isRuby = celebrityTier === 'Ruby';
          const currentThreshold = CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.qualifyPoints || 0;
          const nextThreshold = nextTier ? CELEBRITY_BLUE_CHIP_TIERS[nextTier]?.qualifyPoints : currentThreshold;
          const rangeSize = Math.max(1, nextThreshold - currentThreshold);
          const progressInRange = celebrityBlueChipPoints - currentThreshold;
          const percentComplete = isRuby ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const pointsToNext = isRuby ? 0 : Math.max(0, nextThreshold - celebrityBlueChipPoints);
          const tierColor = CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#B9BCC2';
          const nextTierColor = nextTier ? CELEBRITY_BLUE_CHIP_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={styles.progressCard} testID="celebrity-blue-chip-progress-card">
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Star size={13} color={tierColor} fill={tierColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: tierColor }]}>{celebrityTier}</Text>
                    {!isRuby && nextTier ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextTierColor }]}>{nextTier}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>
                      {isRuby
                        ? ` (${celebrityBlueChipPoints.toLocaleString()} pts)`
                        : ` (${celebrityBlueChipPoints.toLocaleString()}/${nextThreshold.toLocaleString()} pts)`}
                    </Text>
                  </Text>
                </View>
                {isRuby ? (
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
                {isRuby
                  ? 'Ruby tier achieved! Maximum Blue Chip tier'
                  : `${pointsToNext.toLocaleString()} pts to ${nextTier}`
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
      ) : activeBrand === 'silversea' ? (
        <>
      <View style={styles.tierRow}>
        {renderStandoutBadge('Venetian Society', silverseaTier, SILVERSEA_VENETIAN_TIERS[silverseaTier]?.color || '#8C5A3C', 'loyalty')}
        {renderStandoutBadge('Rock Star Casino', silverseaCasinoTier, SILVERSEA_CASINO_TIERS[silverseaCasinoTier]?.color || '#2F2F34', 'club')}
      </View>

      <View style={styles.progressGrid}>
        {(() => {
          const currentTierIndex = SILVERSEA_TIER_ORDER.indexOf(silverseaTier);
          const nextTier = currentTierIndex < SILVERSEA_TIER_ORDER.length - 1 ? SILVERSEA_TIER_ORDER[currentTierIndex + 1] : null;
          const isMax = silverseaTier === '500 VS Days';
          const currentThreshold = SILVERSEA_VENETIAN_TIERS[silverseaTier]?.cruiseDays || 0;
          const nextThreshold = nextTier ? SILVERSEA_VENETIAN_TIERS[nextTier]?.cruiseDays : 500;
          const rangeSize = Math.max(1, nextThreshold - currentThreshold);
          const progressInRange = silverseaPoints - currentThreshold;
          const percentComplete = isMax ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const daysToNext = isMax ? 0 : Math.max(0, nextThreshold - silverseaPoints);
          const tierColor = SILVERSEA_VENETIAN_TIERS[silverseaTier]?.color || '#8C5A3C';
          const nextTierColor = nextTier ? SILVERSEA_VENETIAN_TIERS[nextTier]?.color : tierColor;

          return (
            <View style={styles.progressCard} testID="silversea-venetian-progress-card">
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Crown size={13} color={tierColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: tierColor }]}>{silverseaTier}</Text>
                    {!isMax && nextTier ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextTierColor }]}>{nextTier}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>
                      {isMax
                        ? ` (${silverseaPoints.toLocaleString()} VS days)`
                        : ` (${silverseaPoints.toLocaleString()}/${nextThreshold.toLocaleString()} VS days)`}
                    </Text>
                  </Text>
                </View>
                {isMax ? (
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
                {isMax
                  ? '500 VS Days achieved! Maximum Venetian Society milestone'
                  : `${daysToNext.toLocaleString()} VS days to ${nextTier}`
                }
              </Text>
            </View>
          );
        })()}

        {(() => {
          const currentTierIndex = SILVERSEA_CASINO_TIER_ORDER.indexOf(silverseaCasinoTier);
          const nextTier = currentTierIndex < SILVERSEA_CASINO_TIER_ORDER.length - 1 ? SILVERSEA_CASINO_TIER_ORDER[currentTierIndex + 1] : null;
          const isMax = silverseaCasinoTier === 'Icon';
          const currentThreshold = SILVERSEA_CASINO_TIERS[silverseaCasinoTier]?.qualifyPoints || 0;
          const nextThreshold = nextTier ? SILVERSEA_CASINO_TIERS[nextTier]?.qualifyPoints : currentThreshold;
          const rangeSize = Math.max(1, nextThreshold - currentThreshold);
          const progressInRange = silverseaCasinoPoints - currentThreshold;
          const percentComplete = isMax ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const pointsToNext = isMax ? 0 : Math.max(0, nextThreshold - silverseaCasinoPoints);
          const tierColor = SILVERSEA_CASINO_TIERS[silverseaCasinoTier]?.color || '#2F2F34';
          const nextTierColor = nextTier ? SILVERSEA_CASINO_TIERS[nextTier]?.color : tierColor;

          return (
            <View style={styles.progressCard} testID="silversea-rock-star-progress-card">
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelRow}>
                  <Star size={13} color={tierColor} fill={tierColor} />
                  <Text style={styles.progressLabel}>
                    <Text style={[styles.progressLabelTier, { color: tierColor }]}>{silverseaCasinoTier}</Text>
                    {!isMax && nextTier ? (
                      <>
                        <Text style={styles.progressLabelMeta}> → </Text>
                        <Text style={[styles.progressLabelTier, { color: nextTierColor }]}>{nextTier}</Text>
                      </>
                    ) : null}
                    <Text style={styles.progressLabelMeta}>
                      {isMax
                        ? ` (${silverseaCasinoPoints.toLocaleString()} pts)`
                        : ` (${silverseaCasinoPoints.toLocaleString()}/${nextThreshold.toLocaleString()} pts)`}
                    </Text>
                  </Text>
                </View>
                {isMax ? (
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
                {isMax
                  ? 'Icon achieved! Maximum Rock Star tier'
                  : `${pointsToNext.toLocaleString()} pts to ${nextTier} • ~${(pointsToNext * 3).toLocaleString()} coin-in`
                }
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{silverseaPoints}</Text>
          <Text style={styles.statLabel}>VS Days</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{silverseaCasinoPoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Rock Star Pts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text
            style={[styles.statValue, silverseaCasinoTier.length > 10 ? styles.statValueCompact : null]}
            numberOfLines={1}
          >
            {silverseaCasinoTier}
          </Text>
          <Text style={styles.statLabel}>Casino Tier</Text>
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
      {/* === CARNIVAL === */}
      <View style={styles.tierRow}>
        <View style={[styles.tierBadge, { backgroundColor: (CARNIVAL_VIFP_TIERS[carnivalVifpTier]?.color ?? '#1E90FF') + '30', borderColor: CARNIVAL_VIFP_TIERS[carnivalVifpTier]?.color ?? '#1E90FF' }]}>
          <Text style={[styles.tierText, { color: CARNIVAL_VIFP_TIERS[carnivalVifpTier]?.color || '#1E90FF' }]}>VIFP {carnivalVifpTier.toUpperCase()}</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: (CARNIVAL_PLAYERS_CLUB_TIERS[carnivalPlayersClubTier]?.color ?? '#1E90FF') + '30', borderColor: CARNIVAL_PLAYERS_CLUB_TIERS[carnivalPlayersClubTier]?.color ?? '#1E90FF' }]}>
          <Text style={[styles.tierText, { color: CARNIVAL_PLAYERS_CLUB_TIERS[carnivalPlayersClubTier]?.color || '#1E90FF' }]}>PLAYERS {carnivalPlayersClubTier.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.progressGrid}>
        {(() => {
          const currentTierIndex = CARNIVAL_VIFP_TIER_ORDER.indexOf(carnivalVifpTier);
          const nextTier = currentTierIndex < CARNIVAL_VIFP_TIER_ORDER.length - 1 ? CARNIVAL_VIFP_TIER_ORDER[currentTierIndex + 1] : null;
          const isMax = carnivalVifpTier === 'Diamond';
          
          const currentThreshold = CARNIVAL_VIFP_TIERS[carnivalVifpTier]?.cruiseDays || 0;
          const nextThreshold = nextTier ? CARNIVAL_VIFP_TIERS[nextTier]?.cruiseDays : 500;
          const _rangeSize = nextThreshold - currentThreshold;
          
          const tierColor = CARNIVAL_VIFP_TIERS[carnivalVifpTier]?.color || '#1E90FF';
          const nextTierColor = nextTier ? CARNIVAL_VIFP_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {isMax 
                    ? `VIFP Diamond`
                    : `VIFP ${carnivalVifpTier} → ${nextTier}`
                  }
                </Text>
                {isMax ? (
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
                  style={[styles.progressBarFill, { width: isMax ? '100%' : '0%' }]}
                />
              </View>
              <Text style={styles.progressEta}>
                {isMax 
                  ? 'VIFP Diamond achieved! Maximum loyalty tier'
                  : `Cruise to earn VIFP tier progress`
                }
              </Text>
            </View>
          );
        })()}

        {(() => {
          const tierColor = CARNIVAL_PLAYERS_CLUB_TIERS[carnivalPlayersClubTier]?.color || '#1E90FF';
          
          return (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  Players Club: {carnivalPlayersClubTier} ({carnivalPlayersClubPoints.toLocaleString()} pts)
                </Text>
                <Text style={styles.progressPercent}>--</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '0%', backgroundColor: tierColor }]} />
              </View>
              <Text style={styles.progressEta}>
                Play in the casino to earn Players Club tier progress
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{carnivalPlayersClubPoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Players Pts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{carnivalVifpTier}</Text>
          <Text style={styles.statLabel}>VIFP Tier</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{carnivalPlayersClubTier}</Text>
          <Text style={styles.statLabel}>Players Tier</Text>
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
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
    marginBottom: SPACING.lg,
    shadowColor: '#03111F',
    shadowOpacity: 0.26,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  atmosphereOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  contentLayer: {
    padding: SPACING.lg,
    backgroundColor: 'rgba(255, 248, 236, 0.12)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  memberInfoInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  memberTextInfo: {
    flex: 1,
    gap: 2,
  },
  memberGreeting: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#111111',
    letterSpacing: -0.3,
  },
  memberSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(17,17,17,0.72)',
    marginTop: 4,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 252, 246, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(17, 17, 17, 0.08)',
    shadowColor: '#03111F',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tierBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tierText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.6,
  },
  spotlightBadge: {
    flex: 1,
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderColor: 'rgba(214, 184, 111, 0.22)',
    shadowColor: '#03111F',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  spotlightBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  spotlightBadgeContent: {
    flex: 1,
    gap: 2,
  },
  spotlightBadgeLabel: {
    fontSize: 10,
    color: 'rgba(15, 36, 57, 0.68)',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    letterSpacing: 0.3,
  },
  spotlightBadgeValue: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.6,
  },
  progressGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  progressCard: {
    backgroundColor: 'rgba(255, 250, 242, 0.94)',
    borderRadius: 28,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.18)',
    shadowColor: '#03111F',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: SPACING.sm,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#102132',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    flex: 1,
  },
  progressLabelTier: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressLabelMeta: {
    color: CLEAN_THEME.text.primary,
  },
  progressPercent: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#102132',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    backgroundColor: 'rgba(255, 244, 214, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: 'rgba(7, 23, 43, 0.12)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressEta: {
    fontSize: 11,
    color: 'rgba(16, 33, 50, 0.72)',
    marginTop: 10,
    lineHeight: 16,
  },
  pinnacleDetailsContainer: {
    marginTop: SPACING.xs,
    gap: 4,
  },
  pinnacleDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 248, 236, 0.92)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.16)',
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
    borderColor: 'rgba(214, 184, 111, 0.22)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 248, 236, 0.96)',
  },
  achievedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 248, 236, 0.94)',
    borderRadius: 26,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.2)',
    shadowColor: '#03111F',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(16, 33, 50, 0.1)',
  },
  statValue: {
    fontSize: 26,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#102132',
  },
  royalStatValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#102132',
    textAlign: 'center',
  },
  statValueCompact: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(16, 33, 50, 0.66)',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  quickStatsPillRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  quickStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 250, 242, 0.96)',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.18)',
    shadowColor: '#03111F',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  quickStatPillValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.data.value,
  },
  quickStatPillLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.data.label,
  },
  crewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255, 248, 236, 0.94)',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.18)',
  },
  crewCountText: {
    fontSize: 11,
    color: 'rgba(16, 33, 50, 0.68)',
    fontWeight: '500' as const,
  },
});
