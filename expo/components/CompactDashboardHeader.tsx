import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Bell, Ship, Anchor, Tag, CheckCircle2, LogOut, Target, Users } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import {
  getCarnivalPlayersClubTierColor,
  getCarnivalVifpTierColor,
  getCelebrityBlueChipTierColor,
  getCelebrityCaptainsClubLevelColor,
  getClubRoyaleTierColor,
  getCrownAnchorTierColor,
  getPlayerCardTheme,
  getSilverseaTierColor,
} from '@/constants/loyaltyTheme';
import { CLUB_ROYALE_TIERS, TIER_ORDER, getTierByPoints } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS, LEVEL_ORDER } from '@/constants/crownAnchor';
import { CELEBRITY_CAPTAINS_CLUB_LEVELS, CELEBRITY_LEVEL_ORDER, getCelebrityCaptainsClubLevelByPoints } from '@/constants/celebrityCaptainsClub';
import { CELEBRITY_BLUE_CHIP_TIERS, CELEBRITY_TIER_ORDER, getCelebrityBlueChipTierByLevel } from '@/constants/celebrityBlueChipClub';
import { SILVERSEA_VENETIAN_TIERS, SILVERSEA_TIER_ORDER, getSilverseaTierByDays, getNextSilverseaTier } from '@/constants/silverseaVenetianSociety';
import { CARNIVAL_VIFP_TIERS, CARNIVAL_VIFP_TIER_ORDER, CARNIVAL_PLAYERS_CLUB_TIERS } from '@/constants/carnivalVifpClub';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useUser } from '@/state/UserProvider';
import { BrandToggle, BrandType } from '@/components/ui/BrandToggle';
import { IMAGES } from '@/constants/images';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';

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
  } = useLoyalty();
  const { currentUser } = useUser();
  const [activeBrand, setActiveBrand] = useState<BrandType>(currentUser?.preferredBrand || 'royal');
  const [showNumber, setShowNumber] = useState(false);

  const toggleShowNumber = useCallback(() => setShowNumber(v => !v), []);

  useEffect(() => {
    setActiveBrand(currentUser?.preferredBrand || 'royal');
  }, [currentUser?.preferredBrand]);

  const celebrityCaptainsClubPoints = currentUser?.celebrityCaptainsClubPoints || 0;
  const celebrityBlueChipPoints = currentUser?.celebrityBlueChipPoints || 0;
  const celebrityLevel = getCelebrityCaptainsClubLevelByPoints(celebrityCaptainsClubPoints);
  const celebrityTier = getCelebrityBlueChipTierByLevel(1);
  const silverseaTier = currentUser?.silverseaVenetianTier || getSilverseaTierByDays(currentUser?.silverseaVenetianPoints || 0);
  const silverseaPoints = currentUser?.silverseaVenetianPoints || 0;
  const carnivalVifpTier = currentUser?.carnivalVifpTier || 'Blue';
  const carnivalPlayersClubTier = currentUser?.carnivalPlayersClubTier || 'Blue';
  const carnivalPlayersClubPoints = currentUser?.carnivalPlayersClubPoints || 0;

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

  const playerCardTheme = useMemo(() => getPlayerCardTheme({
    brand: activeBrand,
    crownAnchorLevel,
    celebrityLevel,
    silverseaTier,
    carnivalVifpTier,
  }), [activeBrand, carnivalVifpTier, celebrityLevel, crownAnchorLevel, silverseaTier]);
  const progressCardStyle = useMemo(() => ({
    backgroundColor: playerCardTheme.surfaceColor,
    borderColor: playerCardTheme.borderColor,
  }), [playerCardTheme.borderColor, playerCardTheme.surfaceColor]);
  const progressLabelStyle = useMemo(() => ({
    color: playerCardTheme.topTextColor,
  }), [playerCardTheme.topTextColor]);
  const progressMetaStyle = useMemo(() => ({
    color: playerCardTheme.secondaryTextColor,
  }), [playerCardTheme.secondaryTextColor]);
  const progressBarTrackStyle = useMemo(() => ({
    backgroundColor: playerCardTheme.surfaceColorMuted,
  }), [playerCardTheme.surfaceColorMuted]);
  const progressDividerStyle = useMemo(() => ({
    backgroundColor: playerCardTheme.borderColor,
  }), [playerCardTheme.borderColor]);
  const progressDetailRowStyle = useMemo(() => ({
    backgroundColor: playerCardTheme.surfaceColorMuted,
    borderColor: playerCardTheme.borderColor,
  }), [playerCardTheme.borderColor, playerCardTheme.surfaceColorMuted]);

  const displayName = currentUser?.name || memberName;
  const rawNumber = activeBrand === 'royal' 
    ? (crownAnchorNumber || currentUser?.crownAnchorNumber || '')
    : activeBrand === 'celebrity'
    ? (currentUser?.celebrityCaptainsClubNumber || '')
    : activeBrand === 'silversea'
    ? (currentUser?.silverseaVenetianNumber || '')
    : (currentUser?.carnivalVifpNumber || '');
  const displayNumber = rawNumber
    ? (showNumber ? rawNumber : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
    : 'Not set';
  const displayNumberLabel = activeBrand === 'royal' ? 'C&A #'
    : activeBrand === 'celebrity' ? 'Captain\'s Club #'
    : activeBrand === 'silversea' ? 'Venetian Society #'
    : 'VIFP Club #';

  return (
    <LinearGradient
      colors={playerCardTheme.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: playerCardTheme.borderColor }]}
    >
      <View style={styles.topRow}>
        <View style={styles.memberInfoInline}>
          {!hideLogo && (
            <View style={styles.logoSignatureGroup}>
              <Image 
                source={{ uri: IMAGES.logo }}
                style={styles.headerLogo}
                resizeMode="contain"
              />

            </View>
          )}
          <View style={styles.memberTextInfo}>
            <Text style={[styles.memberGreeting, { color: playerCardTheme.topTextColor }]}>{displayName}</Text>
            <TouchableOpacity onPress={rawNumber ? toggleShowNumber : undefined} activeOpacity={rawNumber ? 0.7 : 1}>
              <Text style={[styles.memberSubtitle, { color: playerCardTheme.secondaryTextColor }]}>{displayNumberLabel} {displayNumber}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.actionsSection}>
          {onAlertsPress && (
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: playerCardTheme.surfaceColor }]} 
              onPress={onAlertsPress}
              activeOpacity={0.7}
            >
              <Bell size={18} color={playerCardTheme.topTextColor} />
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
              style={[styles.iconBtn, { backgroundColor: playerCardTheme.surfaceColor }]} 
              onPress={onLogoutPress}
              activeOpacity={0.7}
            >
              <LogOut size={18} color={playerCardTheme.topTextColor} />
            </TouchableOpacity>
          )}
          {onSettingsPress && (
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: playerCardTheme.surfaceColor }]} 
              onPress={onSettingsPress}
              activeOpacity={0.7}
            >
              <Settings size={18} color={playerCardTheme.topTextColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <BrandToggle activeBrand={activeBrand} onToggle={setActiveBrand} />

      {activeBrand === 'royal' ? (
        <>
      {/* === ROYAL CARIBBEAN === */}
      <View style={styles.tierRow}>
        <LoyaltyPill label={clubRoyaleTier} color={getClubRoyaleTierColor(clubRoyaleTier)} size="small" />
        <LoyaltyPill label={crownAnchorLevel} color={getCrownAnchorTierColor(crownAnchorLevel)} size="small" />
      </View>
      {crewMemberCount > 0 && (
        <View style={styles.crewCountRow}>
          <Users size={13} color={playerCardTheme.secondaryTextColor} />
          <Text style={[styles.crewCountText, { color: playerCardTheme.secondaryTextColor }]}>{crewMemberCount} crew members</Text>
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
          
          return (
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
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
                  <Text style={[styles.progressPercent, progressLabelStyle]}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[levelColor, nextLevelColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
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
                  <View style={[styles.pinnacleDetailRow, progressDetailRowStyle]}>
                    <View style={styles.pinnacleIconBadge}>
                      <Target size={10} color="#DC2626" />
                    </View>
                    <View style={styles.pinnacleDetailContent}>
                      <Text style={[styles.pinnacleDetailLabel, progressMetaStyle]}>Threshold Crossed On:</Text>
                      <Text style={[styles.pinnacleDetailValue, progressLabelStyle]} numberOfLines={1}>
                        {`${pinnacleProgress.thresholdCrossedShip} • ${formatCruiseDate(pinnacleProgress.thresholdCrossedSailDate)}`}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.pinnacleDetailRow, styles.pinnacleDetailRowWhite, progressDetailRowStyle]}>
                    <View style={styles.pinnacleStarBadgeWhite}>
                      <Text style={styles.pinnaclePText}>P</Text>
                    </View>
                    <View style={styles.pinnacleDetailContent}>
                      <Text style={[styles.pinnacleDetailLabel, progressMetaStyle]}>First Cruise AS Pinnacle:</Text>
                      <Text style={[styles.pinnacleDetailValue, styles.pinnacleHighlightWhite]} numberOfLines={1}>
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
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
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
                  <Text style={[styles.progressPercent, progressLabelStyle]}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
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
            <View style={[styles.progressCard, styles.achievedCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <View style={styles.achievedLabelRow}>
                  <CheckCircle2 size={14} color={CLEAN_THEME.badge.achieved.text} />
                  <Text style={[styles.progressLabel, progressLabelStyle]}>
                    {priorTier} → {currentTier} ({achievedThreshold.toLocaleString()} pts)
                  </Text>
                </View>
                <View style={styles.achievedBadge}>
                  <Text style={styles.achievedBadgeText}>ACHIEVED</Text>
                </View>
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[priorTierColor, currentTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: '100%' }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
                {currentTier} tier achieved! You have earned this status.
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={[styles.statsRow, progressCardStyle]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{clubRoyalePoints.toLocaleString()}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Casino Pts (CR)</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{crownAnchorPoints}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>C&A Nights</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{pinnacleProgress.nightsToNext}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>To Pinnacle</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{availableCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{bookedCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{activeOffers}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      ) : activeBrand === 'celebrity' ? (
        <>
      {/* === CELEBRITY CRUISES === */}
      <View style={styles.tierRow}>
        <LoyaltyPill label={celebrityTier} color={getCelebrityBlueChipTierColor(celebrityTier)} size="small" />
        <LoyaltyPill label={celebrityLevel} color={getCelebrityCaptainsClubLevelColor(celebrityLevel)} size="small" />
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
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
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
                  <Text style={[styles.progressPercent, progressLabelStyle]}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[levelColor, nextLevelColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
                {isZenith 
                  ? 'Zenith achieved! Maximum Captain\'s Club level'
                  : `${pointsToNext} pts to ${nextLevel}`
                }
              </Text>
            </View>
          );
        })()}

        {(() => {
          const currentTierIndex = CELEBRITY_TIER_ORDER.indexOf(celebrityTier);
          const nextTier = currentTierIndex < CELEBRITY_TIER_ORDER.length - 1 ? CELEBRITY_TIER_ORDER[currentTierIndex + 1] : null;
          const isRuby = celebrityTier === 'Ruby';
          
          const tierColor = CELEBRITY_BLUE_CHIP_TIERS[celebrityTier]?.color || '#F0EAD6';
          const nextTierColor = nextTier ? CELEBRITY_BLUE_CHIP_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
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
                  <Text style={[styles.progressPercent, progressLabelStyle]}>--</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: isRuby ? '100%' : '0%' }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
                {isRuby 
                  ? 'Ruby tier achieved! Maximum Blue Chip tier'
                  : 'Play in the casino to earn tier progress'
                }
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={[styles.statsRow, progressCardStyle]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{celebrityBlueChipPoints.toLocaleString()}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Casino Pts (BC)</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{celebrityCaptainsClubPoints}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Capt's Club</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{Math.max(0, 3000 - celebrityCaptainsClubPoints)}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>To Zenith</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{availableCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{bookedCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{activeOffers}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      ) : activeBrand === 'silversea' ? (
        <>
      {/* === SILVERSEA === */}
      <View style={styles.tierRow}>
        <LoyaltyPill label={silverseaTier} color={getSilverseaTierColor(silverseaTier)} size="small" />
      </View>

      <View style={styles.progressGrid}>
        {(() => {
          const currentTierIndex = SILVERSEA_TIER_ORDER.indexOf(silverseaTier);
          const nextTier = currentTierIndex < SILVERSEA_TIER_ORDER.length - 1 ? SILVERSEA_TIER_ORDER[currentTierIndex + 1] : null;
          const isMax = silverseaTier === 'Diamond Elite';
          
          const currentThreshold = SILVERSEA_VENETIAN_TIERS[silverseaTier]?.cruiseDays || 0;
          const nextThreshold = nextTier ? SILVERSEA_VENETIAN_TIERS[nextTier]?.cruiseDays : 500;
          const rangeSize = nextThreshold - currentThreshold;
          const progressInRange = silverseaPoints - currentThreshold;
          const percentComplete = isMax ? 100 : Math.min(100, Math.max(0, (progressInRange / rangeSize) * 100));
          const daysToNext = isMax ? 0 : Math.max(0, nextThreshold - silverseaPoints);
          
          const tierColor = SILVERSEA_VENETIAN_TIERS[silverseaTier]?.color || '#708090';
          const nextTierColor = nextTier ? SILVERSEA_VENETIAN_TIERS[nextTier]?.color : tierColor;
          
          return (
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
                  {isMax 
                    ? `Diamond Elite (${silverseaPoints} days)`
                    : `${silverseaTier} → ${nextTier} (${silverseaPoints}/${nextThreshold} days)`
                  }
                </Text>
                {isMax ? (
                  <View style={styles.achievedBadge}>
                    <Text style={styles.achievedBadgeText}>MAX TIER</Text>
                  </View>
                ) : (
                  <Text style={[styles.progressPercent, progressLabelStyle]}>{percentComplete.toFixed(1)}%</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, percentComplete)}%` }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
                {isMax 
                  ? 'Diamond Elite achieved! Maximum Venetian Society tier'
                  : `${daysToNext} cruise days to ${nextTier}`
                }
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={[styles.statsRow, progressCardStyle]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{silverseaPoints}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Cruise Days</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{silverseaTier}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Venetian Tier</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{(() => {
            const nextTier = getNextSilverseaTier(silverseaTier);
            if (!nextTier) return 0;
            return Math.max(0, (SILVERSEA_VENETIAN_TIERS[nextTier]?.cruiseDays || 0) - silverseaPoints);
          })()}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>To Next Tier</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{availableCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{bookedCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{activeOffers}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      ) : (
        <>
      {/* === CARNIVAL === */}
      <View style={styles.tierRow}>
        <LoyaltyPill label={`VIFP ${carnivalVifpTier}`} color={getCarnivalVifpTierColor(carnivalVifpTier)} size="small" />
        <LoyaltyPill label={`Players ${carnivalPlayersClubTier}`} color={getCarnivalPlayersClubTierColor(carnivalPlayersClubTier)} size="small" />
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
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
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
                  <Text style={[styles.progressPercent, progressLabelStyle]}>--</Text>
                )}
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <LinearGradient
                  colors={[tierColor, nextTierColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: isMax ? '100%' : '0%' }]}
                />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
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
            <View style={[styles.progressCard, progressCardStyle]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, progressLabelStyle]}>
                  Players Club: {carnivalPlayersClubTier} ({carnivalPlayersClubPoints.toLocaleString()} pts)
                </Text>
                <Text style={[styles.progressPercent, progressLabelStyle]}>--</Text>
              </View>
              <View style={[styles.progressBarBg, progressBarTrackStyle]}>
                <View style={[styles.progressBarFill, { width: '0%', backgroundColor: tierColor }]} />
              </View>
              <Text style={[styles.progressEta, progressMetaStyle]}>
                Play in the casino to earn Players Club tier progress
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={[styles.statsRow, progressCardStyle]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{carnivalPlayersClubPoints.toLocaleString()}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Players Pts</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{carnivalVifpTier}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>VIFP Tier</Text>
        </View>
        <View style={[styles.statDivider, progressDividerStyle]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, progressLabelStyle]}>{carnivalPlayersClubTier}</Text>
          <Text style={[styles.statLabel, progressMetaStyle]}>Players Tier</Text>
        </View>
      </View>

      <View style={styles.quickStatsPillRow}>
        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onCruisesPress}
          activeOpacity={0.7}
        >
          <Anchor size={14} color={COLORS.points} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{availableCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Cruises</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onBookedPress}
          activeOpacity={0.7}
        >
          <Ship size={14} color={COLORS.money} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{bookedCruises}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Booked</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickStatPill, progressCardStyle]}
          onPress={onOffersPress}
          activeOpacity={0.7}
        >
          <Tag size={14} color={COLORS.gold} />
          <Text style={[styles.quickStatPillValue, progressLabelStyle]}>{activeOffers}</Text>
          <Text style={[styles.quickStatPillLabel, progressMetaStyle]}>Offers</Text>
        </TouchableOpacity>
      </View>
        </>
      )}
    </LinearGradient>
  );
});

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
  logoSignatureGroup: {
    alignItems: 'center',
  },
  headerLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
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
  pinnacleStarBadgeWhite: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: COLORS.navyDeep,
  },
  pinnaclePText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    lineHeight: 13,
  },
  pinnacleDetailRowWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 31, 63, 0.15)',
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
  pinnacleHighlightWhite: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
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
  crewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
    paddingLeft: 2,
  },
  crewCountText: {
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontWeight: '500' as const,
  },
});
