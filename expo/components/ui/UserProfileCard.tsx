import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Save, CheckCircle, AlertCircle, Star, Anchor, Ship, Edit2, X, User, ChevronDown, ChevronUp } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getLevelByNights, getLevelProgress, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import {
  getTierByPoints,
  getTierProgress,
  CLUB_ROYALE_TIERS,
  TIER_ORDER,
  formatClubRoyaleValidThrough,
  inferClubRoyaleTierValidThrough,
  normalizeClubRoyaleTier,
  normalizeClubRoyaleValidThrough,
  resolveClubRoyaleStatus,
} from '@/constants/clubRoyaleTiers';
import { getCelebrityCaptainsClubLevelProgress, getCelebrityCaptainsClubStatus, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { getCelebrityBlueChipProgress, getCelebrityBlueChipStatus, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { BrandToggle, BrandType } from './BrandToggle';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';
import { useEntitlement } from '@/state/EntitlementProvider';

interface UserProfileData {
  name: string;
  email: string;
  crownAnchorNumber: string;
  clubRoyalePoints: number;
  clubRoyaleTier: string;
  clubRoyaleTierValidThrough?: string;
  loyaltyPoints: number;
  crownAnchorLevel: string;
  celebrityEmail?: string;
  celebrityCaptainsClubNumber?: string;
  celebrityCaptainsClubPoints: number;
  celebrityBlueChipPoints: number;
  celebrityBlueChipTier: string;
  celebrityCaptainsClubLevel: string;
  preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
  silverseaEmail?: string;
  silverseaVenetianNumber?: string;
  silverseaVenetianTier?: string;
  silverseaVenetianPoints?: number;
  carnivalVifpNumber?: string;
  carnivalVifpTier?: string;
  carnivalPlayersClubTier?: string;
  carnivalPlayersClubPoints?: number;
  birthdate?: string;
}

interface EnrichmentData {
  accountId?: string;
  crownAndAnchorId?: string;
  crownAndAnchorTier?: string;
  crownAndAnchorNextTier?: string;
  crownAndAnchorRemainingPoints?: number;
  crownAndAnchorTrackerPercentage?: number;
  crownAndAnchorRelationshipPointsFromApi?: number;
  crownAndAnchorLoyaltyMatchTier?: string;
  clubRoyaleTierFromApi?: string;
  clubRoyalePointsFromApi?: number;
  clubRoyaleRelationshipPointsFromApi?: number;
  captainsClubId?: string;
  captainsClubTier?: string;
  captainsClubPoints?: number;
  captainsClubRelationshipPoints?: number;
  captainsClubNextTier?: string;
  captainsClubRemainingPoints?: number;
  captainsClubTrackerPercentage?: number;
  captainsClubLoyaltyMatchTier?: string;
  celebrityBlueChipTier?: string;
  celebrityBlueChipPoints?: number;
  celebrityBlueChipRelationshipPoints?: number;
  venetianSocietyTier?: string;
  venetianSocietyNextTier?: string;
  venetianSocietyMemberNumber?: string;
  venetianSocietyEnrolled?: boolean;
  venetianSocietyLoyaltyMatchTier?: string;
  carnivalVifpTier?: string;
  carnivalVifpNumber?: string;
  carnivalPlayersClubTier?: string;
  carnivalPlayersClubPoints?: number;
  hasCoBrandCard?: boolean;
  coBrandCardStatus?: number;
  coBrandCardErrorMessage?: string;
  lastSyncTimestamp?: string;
}

interface UserProfileCardProps {
  currentValues: UserProfileData;
  enrichmentData?: EnrichmentData | null;
  onSave: (data: UserProfileData) => void | Promise<void>;
  isSaving?: boolean;
  primaryProfileLabel?: string;
  secondaryProfileLabel?: string;
  activeProfileSlot?: 'primary' | 'secondary';
  onProfileSlotPress?: (slot: 'primary' | 'secondary') => void;
  showProfileSwitch?: boolean;
  compact?: boolean;
}

function parsePointInput(text: string): number {
  const cleanedText = text.replace(/[^0-9]/g, '');
  return cleanedText.length > 0 ? parseInt(cleanedText, 10) : 0;
}

function prepareProfileFormData(values: UserProfileData): UserProfileData {
  const selectedTier = normalizeClubRoyaleTier(values.clubRoyaleTier) ?? getTierByPoints(values.clubRoyalePoints);
  const validThrough = normalizeClubRoyaleValidThrough(values.clubRoyaleTierValidThrough)
    ?? inferClubRoyaleTierValidThrough(selectedTier, values.clubRoyalePoints);
  return {
    ...values,
    clubRoyaleTier: selectedTier,
    clubRoyaleTierValidThrough: formatClubRoyaleValidThrough(validThrough),
  };
}

export function UserProfileCard({
  currentValues,
  enrichmentData,
  onSave,
  isSaving = false,
  primaryProfileLabel = 'User',
  secondaryProfileLabel = 'Second User',
  activeProfileSlot = 'primary',
  onProfileSlotPress,
  showProfileSwitch = false,
  compact = false,
}: UserProfileCardProps) {
  const entitlement = useEntitlement();
  const [formData, setFormData] = useState<UserProfileData>(() => prepareProfileFormData(currentValues));
  const [activeBrand, setActiveBrand] = useState<BrandType>(
    (currentValues.preferredBrand as BrandType) || 'royal'
  );
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCompactDetailsVisible, setIsCompactDetailsVisible] = useState(false);

  useEffect(() => {
    setFormData(prepareProfileFormData(currentValues));
    setActiveBrand((currentValues.preferredBrand as BrandType) || 'royal');
  }, [currentValues]);

  const formCrownAnchorLevel = getLevelByNights(formData.loyaltyPoints);
  const formCrownAnchorLevelInfo = CROWN_ANCHOR_LEVELS[formCrownAnchorLevel];
  const savedCrownAnchorLevel = getLevelByNights(currentValues.loyaltyPoints);
  const savedCrownAnchorLevelInfo = CROWN_ANCHOR_LEVELS[savedCrownAnchorLevel];
  const savedCrownAnchorProgress = getLevelProgress(currentValues.loyaltyPoints, savedCrownAnchorLevel);
  
  const selectedFormClubRoyaleTier = normalizeClubRoyaleTier(formData.clubRoyaleTier) ?? getTierByPoints(formData.clubRoyalePoints);
  const formClubRoyaleValidThrough = normalizeClubRoyaleValidThrough(formData.clubRoyaleTierValidThrough)
    ?? inferClubRoyaleTierValidThrough(selectedFormClubRoyaleTier, formData.clubRoyalePoints);
  const formClubRoyaleStatus = resolveClubRoyaleStatus({
    currentSeasonPoints: formData.clubRoyalePoints,
    confirmedTier: selectedFormClubRoyaleTier,
    confirmedValidThrough: formClubRoyaleValidThrough,
  });
  const formClubRoyaleTier = formClubRoyaleStatus.effectiveTier;
  const formClubRoyaleTierInfo = CLUB_ROYALE_TIERS[formClubRoyaleTier];
  const savedClubRoyaleStatus = resolveClubRoyaleStatus({
    currentSeasonPoints: currentValues.clubRoyalePoints,
    confirmedTier: currentValues.clubRoyaleTier,
    confirmedValidThrough: currentValues.clubRoyaleTierValidThrough,
  });
  const savedClubRoyaleTier = savedClubRoyaleStatus.effectiveTier;
  const savedClubRoyaleTierInfo = CLUB_ROYALE_TIERS[savedClubRoyaleTier];
  const savedClubRoyaleProgress = getTierProgress(currentValues.clubRoyalePoints, savedClubRoyaleStatus.pointsTier);

  const formCelebrityStatus = getCelebrityCaptainsClubStatus(
    formData.celebrityCaptainsClubPoints || 0,
    formCrownAnchorLevel,
    formData.celebrityCaptainsClubLevel || enrichmentData?.captainsClubTier,
  );
  const formCelebrityLevel = formCelebrityStatus.effectiveLevel;
  const formCelebrityLevelInfo = CELEBRITY_CAPTAINS_CLUB_LEVELS[formCelebrityLevel];
  const savedCelebrityStatus = getCelebrityCaptainsClubStatus(
    currentValues.celebrityCaptainsClubPoints || 0,
    savedCrownAnchorLevel,
    currentValues.celebrityCaptainsClubLevel || enrichmentData?.captainsClubTier,
  );
  const savedCelebrityLevel = savedCelebrityStatus.effectiveLevel;
  const savedCelebrityLevelInfo = CELEBRITY_CAPTAINS_CLUB_LEVELS[savedCelebrityLevel];
  const savedCelebrityProgress = getCelebrityCaptainsClubLevelProgress(
    currentValues.celebrityCaptainsClubPoints || 0,
    savedCelebrityStatus.earnedLevel,
  );
  
  const formCelebrityBlueChipStatus = getCelebrityBlueChipStatus(
    formData.celebrityBlueChipPoints || 0,
    formData.celebrityBlueChipTier || enrichmentData?.celebrityBlueChipTier,
  );
  const formCelebrityBlueChipTier = formCelebrityBlueChipStatus.effectiveTier;
  const formCelebrityBlueChipTierInfo = CELEBRITY_BLUE_CHIP_TIERS[formCelebrityBlueChipTier] ?? CELEBRITY_BLUE_CHIP_TIERS.Pearl;
  const savedCelebrityBlueChipStatus = getCelebrityBlueChipStatus(
    currentValues.celebrityBlueChipPoints || 0,
    currentValues.celebrityBlueChipTier || enrichmentData?.celebrityBlueChipTier,
  );
  const savedCelebrityBlueChipTier = savedCelebrityBlueChipStatus.effectiveTier;
  const savedCelebrityBlueChipTierInfo = CELEBRITY_BLUE_CHIP_TIERS[savedCelebrityBlueChipTier] ?? CELEBRITY_BLUE_CHIP_TIERS.Pearl;
  const savedCelebrityBlueChipProgress = getCelebrityBlueChipProgress(
    currentValues.celebrityBlueChipPoints || 0,
    savedCelebrityBlueChipStatus.earnedTier,
  );

  const handleSave = async () => {
    const confirmedClubRoyaleTier = normalizeClubRoyaleTier(formData.clubRoyaleTier) ?? formClubRoyaleTier;
    const confirmedClubRoyaleValidThrough = normalizeClubRoyaleValidThrough(formData.clubRoyaleTierValidThrough)
      ?? inferClubRoyaleTierValidThrough(confirmedClubRoyaleTier, formData.clubRoyalePoints);
    await onSave({
      ...formData,
      clubRoyaleTier: confirmedClubRoyaleTier,
      clubRoyaleTierValidThrough: confirmedClubRoyaleValidThrough ?? undefined,
      crownAnchorLevel: formCrownAnchorLevel,
      celebrityBlueChipTier: formCelebrityBlueChipTier,
      celebrityCaptainsClubLevel: formCelebrityLevel,
      preferredBrand: activeBrand,
    });
    setIsModalVisible(false);
  };

  const handleBrandToggle = (brand: BrandType) => {
    setActiveBrand(brand);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const renderEnrichmentBadge = (hasData: boolean) => (
    <View style={[styles.enrichmentBadge, hasData ? styles.enrichmentBadgeActive : styles.enrichmentBadgeInactive]}>
      {hasData ? (
        <CheckCircle size={10} color={COLORS.white} />
      ) : (
        <AlertCircle size={10} color="rgba(255,255,255,0.7)" />
      )}
      <Text style={styles.enrichmentBadgeText}>
        {hasData ? 'Synced' : 'Manual'}
      </Text>
    </View>
  );

  const renderValueCard = (
    label: string,
    value: string | number | undefined,
    color?: string,
    wide?: boolean,
    renderAsPill?: boolean,
  ) => (
    <View style={[styles.valueCard, wide && !compact && styles.valueCardWide, compact && styles.valueCardCompact]}>
      <Text style={[styles.valueCardLabel, compact && styles.valueCardLabelCompact]}>{label}</Text>
      {renderAsPill && typeof value === 'string' && value.trim().length > 0 ? (
        <LoyaltyPill label={value} color={color} size="small" />
      ) : (
        <Text style={[styles.valueCardValue, compact && styles.valueCardValueCompact, color ? { color } : null]}>
          {value !== undefined && value !== null && value !== '' ? (typeof value === 'number' ? value.toLocaleString() : value) : 'Not set'}
        </Text>
      )}
    </View>
  );

  const renderCompactDetailsToggle = () => compact ? (
    <TouchableOpacity
      style={styles.compactDetailsButton}
      onPress={() => setIsCompactDetailsVisible((visible) => !visible)}
      accessibilityRole="button"
      accessibilityState={{ expanded: isCompactDetailsVisible }}
      testID="profile-compact-details-toggle"
    >
      <Text style={styles.compactDetailsButtonText}>{isCompactDetailsVisible ? 'Hide profile details' : 'View all profile details'}</Text>
      {isCompactDetailsVisible ? <ChevronUp size={16} color="#17324D" /> : <ChevronDown size={16} color="#17324D" />}
    </TouchableOpacity>
  ) : null;

  const renderProgressCard = ({
    eyebrow,
    title,
    current,
    target,
    percent,
    color,
    footer,
    maxLevel = false,
  }: {
    eyebrow: string;
    title: string;
    current: number;
    target: number;
    percent: number;
    color: string;
    footer: string;
    maxLevel?: boolean;
  }) => {
    const safePercent = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
    return (
      <View style={[styles.loyaltyProgressCard, compact && styles.loyaltyProgressCardCompact]}>
        <View style={styles.loyaltyProgressHeader}>
          <View style={styles.loyaltyProgressHeadingCopy}>
            <Text style={[styles.loyaltyProgressEyebrow, compact && styles.loyaltyProgressEyebrowCompact, { color }]}>{eyebrow}</Text>
            <Text style={[styles.loyaltyProgressTitle, compact && styles.loyaltyProgressTitleCompact]}>{title}</Text>
          </View>
          <View style={[styles.loyaltyProgressStatus, compact && styles.loyaltyProgressStatusCompact, { borderColor: color, backgroundColor: `${color}12` }]}>
            <Text style={[styles.loyaltyProgressStatusText, compact && styles.loyaltyProgressStatusTextCompact, { color }]}>{maxLevel ? 'MAX' : `${safePercent.toFixed(1)}%`}</Text>
          </View>
        </View>
        <View style={[styles.loyaltyProgressNumbers, compact && styles.loyaltyProgressNumbersCompact]}>
          <Text style={[styles.loyaltyProgressCurrent, compact && styles.loyaltyProgressCurrentCompact]}>{current.toLocaleString()}</Text>
          <Text style={[styles.loyaltyProgressTarget, compact && styles.loyaltyProgressTargetCompact]}> / {target.toLocaleString()}</Text>
        </View>
        <View style={[styles.loyaltyProgressTrack, compact && styles.loyaltyProgressTrackCompact]}>
          <View style={[styles.loyaltyProgressFill, { width: `${safePercent}%`, backgroundColor: color }]} />
        </View>
        <View style={styles.loyaltyProgressScale}>
          <Text style={styles.loyaltyProgressScaleText}>0</Text>
          <Text style={styles.loyaltyProgressScaleText}>{target.toLocaleString()}</Text>
        </View>
        <Text style={[styles.loyaltyProgressFooter, compact && styles.loyaltyProgressFooterCompact]}>{footer}</Text>
      </View>
    );
  };

  const getBrandIcon = () => {
    switch (activeBrand) {
      case 'royal':
        return <Anchor size={20} color={COLORS.white} />;
      case 'celebrity':
        return <Star size={20} color={COLORS.white} />;
      case 'silversea':
        return <Ship size={20} color={COLORS.white} />;
      case 'carnival':
        return <Ship size={20} color={COLORS.white} />;
      default:
        return <Anchor size={20} color={COLORS.white} />;
    }
  };

  const getBrandTitle = () => {
    switch (activeBrand) {
      case 'royal':
        return 'Royal Caribbean Profile';
      case 'celebrity':
        return 'Celebrity Cruises Profile';
      case 'silversea':
        return 'Silversea Profile';
      case 'carnival':
        return 'Carnival Cruise Line Profile';
      default:
        return 'User Profile';
    }
  };

  const getBrandGradient = () => {
    switch (activeBrand) {
      case 'royal':
        return ['#17324D', '#123D73'] as [string, string];
      case 'celebrity':
        return ['#17324D', '#2F8EEB'] as [string, string];
      case 'silversea':
        return ['#2B2930', '#58585B'] as [string, string];
      case 'carnival':
        return ['#CC2232', '#E02040'] as [string, string];
      default:
        return ['#0369A1', '#0284C7'] as [string, string];
    }
  };

  const hasSyncedData = activeBrand === 'royal' 
    ? !!enrichmentData?.crownAndAnchorId 
    : activeBrand === 'celebrity' 
    ? !!enrichmentData?.captainsClubId 
    : activeBrand === 'carnival'
    ? !!enrichmentData?.carnivalVifpNumber
    : !!enrichmentData?.venetianSocietyMemberNumber;

  const getSubscriptionTierDisplay = () => {
    if (entitlement.subscriptionDisplayStatus === 'free_use') return { text: entitlement.subscriptionLevel ?? 'Free Use of App', color: '#16755F' };
    if (entitlement.subscriptionDisplayStatus === 'annual') return { text: 'Annual Subscription', color: '#4EC0A5' };
    if (entitlement.subscriptionDisplayStatus === 'monthly') return { text: 'Monthly Subscription', color: '#3B82F6' };
    if (entitlement.subscriptionDisplayStatus === 'grace_period') return { text: `Grace Period (${entitlement.trialDaysRemaining}d left)`, color: '#E6B63D' };
    return { text: 'Subscription Expired', color: '#A52B34' };
  };

  const renderRoyalCaribbeanValues = () => {
    const subTier = getSubscriptionTierDisplay();
    const crownTarget = savedCrownAnchorProgress.nextLevel
      ? CROWN_ANCHOR_LEVELS[savedCrownAnchorProgress.nextLevel].cruiseNights
      : CROWN_ANCHOR_LEVELS[savedCrownAnchorLevel].cruiseNights;
    const casinoNextTier = savedClubRoyaleProgress.nextTier;
    const casinoTarget = casinoNextTier
      ? CLUB_ROYALE_TIERS[casinoNextTier].threshold
      : CLUB_ROYALE_TIERS[savedClubRoyaleStatus.pointsTier].threshold;
    return (
      <>
      <View style={[styles.loyaltyProgressStack, compact && styles.loyaltyProgressStackCompact]} testID="profile-loyalty-progress">
        {savedClubRoyaleStatus.isProtected && savedClubRoyaleStatus.validThrough ? (
          <View style={[styles.retainedStatusRow, compact && styles.retainedStatusRowCompact]}>
            <CheckCircle size={15} color={savedClubRoyaleTierInfo?.color || '#273D9A'} />
            <Text style={[styles.retainedStatusText, compact && styles.retainedStatusTextCompact]}>{savedClubRoyaleTier} status retained through {formatClubRoyaleValidThrough(savedClubRoyaleStatus.validThrough)}</Text>
          </View>
        ) : null}
        {renderProgressCard({
          eyebrow: 'CROWN & ANCHOR',
          title: savedCrownAnchorProgress.nextLevel ? `${savedCrownAnchorLevel} → ${savedCrownAnchorProgress.nextLevel}` : savedCrownAnchorLevel,
          current: currentValues.loyaltyPoints,
          target: crownTarget,
          percent: savedCrownAnchorProgress.percentComplete,
          color: savedCrownAnchorLevelInfo?.color || '#273D9A',
          footer: savedCrownAnchorProgress.nextLevel ? `${savedCrownAnchorProgress.nightsToNext.toLocaleString()} points to ${savedCrownAnchorProgress.nextLevel}` : `Confirmed at ${crownTarget.toLocaleString()} points · Current balance ${currentValues.loyaltyPoints.toLocaleString()}`,
          maxLevel: !savedCrownAnchorProgress.nextLevel,
        })}
        {renderProgressCard({
          eyebrow: 'CLUB ROYALE · CURRENT SEASON',
          title: casinoNextTier ? `${savedClubRoyaleStatus.pointsTier} → ${casinoNextTier}` : savedClubRoyaleStatus.pointsTier,
          current: currentValues.clubRoyalePoints,
          target: casinoTarget,
          percent: savedClubRoyaleProgress.percentComplete,
          color: CLUB_ROYALE_TIERS[savedClubRoyaleStatus.pointsTier]?.color || '#8A1FD1',
          footer: casinoNextTier ? `${savedClubRoyaleProgress.pointsToNext.toLocaleString()} points to ${casinoNextTier} · Resets April 1` : 'Top current-season tier reached · Resets April 1',
          maxLevel: !casinoNextTier,
        })}
      </View>
      {(!compact || isCompactDetailsVisible) ? <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.email, undefined, true)}
        {!!currentValues.birthdate && renderValueCard('Date of Birth', currentValues.birthdate, undefined, true)}
        {renderValueCard('Crown & Anchor #', enrichmentData?.crownAndAnchorId || currentValues.crownAnchorNumber, undefined, true)}
        {renderValueCard('C&A Level', savedCrownAnchorLevel, savedCrownAnchorLevelInfo?.color, false, true)}
        {renderValueCard('Loyalty Points', currentValues.loyaltyPoints, COLORS.loyalty)}
        {renderValueCard('Club Royale Tier', savedClubRoyaleTier, savedClubRoyaleTierInfo?.color, false, true)}
        {!!savedClubRoyaleStatus.validThrough && renderValueCard('Status Retained Through', formatClubRoyaleValidThrough(savedClubRoyaleStatus.validThrough))}
        {renderValueCard('Casino Points', currentValues.clubRoyalePoints, COLORS.points)}
        {savedCrownAnchorProgress.nextLevel && renderValueCard('Next C&A Level', savedCrownAnchorProgress.nextLevel, savedCrownAnchorLevelInfo?.color, false, true)}
        {renderValueCard('Points to Next', savedCrownAnchorProgress.nightsToNext)}
        {savedClubRoyaleProgress.nextTier && renderValueCard('Current-Season Next Tier', savedClubRoyaleProgress.nextTier, savedClubRoyaleTierInfo?.color, false, true)}
        {renderValueCard('Current-Season Points to Next', savedClubRoyaleProgress.pointsToNext, COLORS.points)}
      </View> : null}
      {renderCompactDetailsToggle()}
      </>
    );
  };

  const renderCelebrityValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <>{(!compact || isCompactDetailsVisible) ? <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.celebrityEmail, undefined, true)}
        {renderValueCard("Captain's Club #", enrichmentData?.captainsClubId || currentValues.celebrityCaptainsClubNumber, undefined, true)}
        {renderValueCard("Captain's Level", savedCelebrityLevel, savedCelebrityLevelInfo?.color, false, true)}
        {savedCelebrityStatus.isStatusMatched && renderValueCard('Status Match', `${savedCrownAnchorLevel} → ${savedCelebrityStatus.statusMatchLevel}`, savedCelebrityLevelInfo?.color, false, true)}
        {savedCelebrityStatus.isStatusMatched && renderValueCard('Earned from Club Points', savedCelebrityStatus.earnedLevel, CELEBRITY_CAPTAINS_CLUB_LEVELS[savedCelebrityStatus.earnedLevel]?.color, false, true)}
        {renderValueCard('Club Points', currentValues.celebrityCaptainsClubPoints, COLORS.loyalty)}
        {renderValueCard('Blue Chip Tier', savedCelebrityBlueChipTier, savedCelebrityBlueChipTierInfo?.color, false, true)}
        {savedCelebrityBlueChipStatus.isReportedTierRetained && renderValueCard('Blue Chip Earned Tier', savedCelebrityBlueChipStatus.earnedTier, CELEBRITY_BLUE_CHIP_TIERS[savedCelebrityBlueChipStatus.earnedTier]?.color, false, true)}
        {renderValueCard('Casino Points', currentValues.celebrityBlueChipPoints, COLORS.points)}
        {savedCelebrityBlueChipProgress.nextTier && renderValueCard('Next Blue Chip Tier', savedCelebrityBlueChipProgress.nextTier, savedCelebrityBlueChipTierInfo?.color, false, true)}
        {renderValueCard('Blue Chip Points to Next', savedCelebrityBlueChipProgress.pointsToNext)}
        {savedCelebrityProgress.nextLevel && renderValueCard('Next Earned Level', savedCelebrityProgress.nextLevel, CELEBRITY_CAPTAINS_CLUB_LEVELS[savedCelebrityStatus.earnedLevel]?.color, false, true)}
        {renderValueCard('Points to Next Earned Level', savedCelebrityProgress.pointsToNext)}
      </View> : null}{renderCompactDetailsToggle()}</>
    );
  };

  const renderSilverseaValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <>{(!compact || isCompactDetailsVisible) ? <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.silverseaEmail, undefined, true)}
        {renderValueCard('Venetian Member #', enrichmentData?.venetianSocietyMemberNumber || currentValues.silverseaVenetianNumber, undefined, true)}
        {renderValueCard('Enrolled', enrichmentData?.venetianSocietyEnrolled ? 'Yes' : 'No', enrichmentData?.venetianSocietyEnrolled ? COLORS.success : undefined)}
        {renderValueCard('Tier', enrichmentData?.venetianSocietyTier || currentValues.silverseaVenetianTier, COLORS.textPrimary, false, true)}
        {renderValueCard('Points', currentValues.silverseaVenetianPoints, COLORS.loyalty)}
        {!!enrichmentData?.venetianSocietyNextTier && renderValueCard('Next Tier', enrichmentData.venetianSocietyNextTier, COLORS.textPrimary, false, true)}
      </View> : null}{renderCompactDetailsToggle()}</>
    );
  };

  const renderCarnivalValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <>{(!compact || isCompactDetailsVisible) ? <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('VIFP Club #', enrichmentData?.carnivalVifpNumber || currentValues.carnivalVifpNumber, undefined, true)}
        {renderValueCard('VIFP Tier', enrichmentData?.carnivalVifpTier || currentValues.carnivalVifpTier, '#CC2232', false, true)}
        {renderValueCard('Players Club Tier', enrichmentData?.carnivalPlayersClubTier || currentValues.carnivalPlayersClubTier, '#FFB400', false, true)}
        {renderValueCard('Players Club Points', enrichmentData?.carnivalPlayersClubPoints ?? currentValues.carnivalPlayersClubPoints, COLORS.points)}
      </View> : null}{renderCompactDetailsToggle()}</>
    );
  };

  const renderEditForm = () => {
    if (activeBrand === 'royal') {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={formData.birthdate || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, birthdate: text }))}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#8E8A89"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email"
              placeholderTextColor="#8E8A89"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Crown & Anchor #</Text>
            <TextInput
              style={styles.input}
              value={formData.crownAnchorNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, crownAnchorNumber: text }))}
              placeholder="Enter Crown & Anchor number"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loyalty Points (Nights)</Text>
            <TextInput
              style={styles.input}
              value={formData.loyaltyPoints.toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, loyaltyPoints: parsePointInput(text) }))}
              placeholder="Enter loyalty nights"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: formCrownAnchorLevelInfo?.color || COLORS.points }]} />
              <Text style={styles.levelHintText}>
                Level: <Text style={[styles.levelHintLevel, { color: formCrownAnchorLevelInfo?.color || COLORS.points }]}>{formCrownAnchorLevel}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Club Royale Points</Text>
            <TextInput
              style={styles.input}
              value={formData.clubRoyalePoints.toString()}
              onChangeText={(text) => setFormData(prev => {
                const clubRoyalePoints = parsePointInput(text);
                const confirmedTier = normalizeClubRoyaleTier(prev.clubRoyaleTier) ?? getTierByPoints(clubRoyalePoints);
                return {
                  ...prev,
                  clubRoyalePoints,
                  clubRoyaleTier: confirmedTier,
                  clubRoyaleTierValidThrough: formatClubRoyaleValidThrough(
                    inferClubRoyaleTierValidThrough(confirmedTier, clubRoyalePoints),
                  ),
                };
              })}
              placeholder="Enter current points"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: formClubRoyaleTierInfo?.color || COLORS.loyalty }]} />
              <Text style={styles.levelHintText}>
                Tier: <Text style={[styles.levelHintLevel, { color: formClubRoyaleTierInfo?.color || COLORS.loyalty }]}>{formClubRoyaleTier}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmed Club Royale Status</Text>
            <View style={styles.tierSelector}>
              {TIER_ORDER.map((tier) => {
                const isSelected = selectedFormClubRoyaleTier === tier;
                const tierColor = CLUB_ROYALE_TIERS[tier].color;
                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.tierSelectorButton,
                      { borderColor: tierColor },
                      isSelected && { backgroundColor: tierColor },
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      clubRoyaleTier: tier,
                      clubRoyaleTierValidThrough: formatClubRoyaleValidThrough(
                        inferClubRoyaleTierValidThrough(tier, prev.clubRoyalePoints),
                      ),
                    }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.tierSelectorText, isSelected && styles.tierSelectorTextSelected]}>{tier}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fieldHelpText}>
              Status and current-cycle points are tracked separately. A previously earned tier stays active through its retained-until date.
            </Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Status Retained Through</Text>
            <TextInput
              style={styles.input}
              value={formData.clubRoyaleTierValidThrough || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, clubRoyaleTierValidThrough: text }))}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#8E8A89"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.fieldHelpText}>
              For Signature earned in the 04/01/2025–03/31/2026 casino year, enter 04/01/2027.
            </Text>
          </View>
        </>
      );
    } else if (activeBrand === 'celebrity') {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Celebrity Email</Text>
            <TextInput
              style={styles.input}
              value={formData.celebrityEmail || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityEmail: text }))}
              placeholder="Enter Celebrity email"
              placeholderTextColor="#8E8A89"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Captain&apos;s Club #</Text>
            <TextInput
              style={styles.input}
              value={formData.celebrityCaptainsClubNumber || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityCaptainsClubNumber: text }))}
              placeholder="Enter Captain's Club number"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Captain&apos;s Club Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.celebrityCaptainsClubPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityCaptainsClubPoints: parsePointInput(text) }))}
              placeholder="Enter Captain's Club points"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: formCelebrityLevelInfo?.color || COLORS.points }]} />
              <Text style={styles.levelHintText}>
                Level: <Text style={[styles.levelHintLevel, { color: formCelebrityLevelInfo?.color || COLORS.points }]}>{formCelebrityLevel}</Text>
                {formCelebrityStatus.isStatusMatched ? ` via ${formCrownAnchorLevel} status match (earned: ${formCelebrityStatus.earnedLevel})` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Blue Chip Tier</Text>
            <TextInput
              style={styles.input}
              value={formData.celebrityBlueChipTier || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityBlueChipTier: text }))}
              placeholder="e.g., Pearl, Onyx, Amethyst, Sapphire, Ruby"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Blue Chip Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.celebrityBlueChipPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityBlueChipPoints: parsePointInput(text) }))}
              placeholder="Enter Blue Chip points"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: formCelebrityBlueChipTierInfo?.color || COLORS.loyalty }]} />
              <Text style={styles.levelHintText}>
                Tier: <Text style={[styles.levelHintLevel, { color: formCelebrityBlueChipTierInfo?.color || COLORS.loyalty }]}>{formCelebrityBlueChipTier}</Text>
                {formCelebrityBlueChipStatus.isReportedTierRetained ? ` (earned from points: ${formCelebrityBlueChipStatus.earnedTier})` : ''}
              </Text>
            </View>
          </View>
        </>
      );
    } else if (activeBrand === 'carnival') {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>VIFP Club #</Text>
            <TextInput
              style={styles.input}
              value={formData.carnivalVifpNumber || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, carnivalVifpNumber: text }))}
              placeholder="Enter VIFP number"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>VIFP Tier</Text>
            <TextInput
              style={styles.input}
              value={formData.carnivalVifpTier || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, carnivalVifpTier: text }))}
              placeholder="e.g., Red, Gold, Platinum, Diamond"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Players Club Tier</Text>
            <TextInput
              style={styles.input}
              value={formData.carnivalPlayersClubTier || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, carnivalPlayersClubTier: text }))}
              placeholder="e.g., Red, Gold, Platinum"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Players Club Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.carnivalPlayersClubPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, carnivalPlayersClubPoints: parsePointInput(text) }))}
              placeholder="Enter points"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
        </>
      );
    } else {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Silversea Email</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaEmail || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaEmail: text }))}
              placeholder="Enter Silversea email"
              placeholderTextColor="#8E8A89"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Society Member #</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaVenetianNumber || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianNumber: text }))}
              placeholder="Enter member number"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Tier</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaVenetianTier || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianTier: text }))}
              placeholder="e.g., Silver, Gold, Platinum"
              placeholderTextColor="#8E8A89"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.silverseaVenetianPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianPoints: parsePointInput(text) }))}
              placeholder="Enter points"
              placeholderTextColor="#8E8A89"
              keyboardType="numeric"
            />
          </View>
        </>
      );
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <LinearGradient
        colors={getBrandGradient()}
        style={[styles.header, compact && styles.headerCompact]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, compact && styles.headerIconCompact]}>
            {getBrandIcon()}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, compact && styles.headerTitleCompact]}>{getBrandTitle()}</Text>
            <Text style={[styles.headerSubtitle, compact && styles.headerSubtitleCompact]}>
              {`${activeProfileSlot === 'secondary' ? secondaryProfileLabel : primaryProfileLabel} • ${hasSyncedData ? 'Synced with account' : 'Manual entry'}`}
            </Text>
          </View>
        </View>
        {renderEnrichmentBadge(hasSyncedData)}
      </LinearGradient>

      {showProfileSwitch ? (
        <View style={[styles.profileSwitchContainer, compact && styles.profileSwitchContainerCompact]}>
          <TouchableOpacity
            style={[styles.profileSwitchButton, compact && styles.profileSwitchButtonCompact, activeProfileSlot === 'primary' && styles.profileSwitchButtonActive]}
            onPress={() => onProfileSlotPress?.('primary')}
            activeOpacity={0.75}
            testID="profile-switch-primary"
          >
            <Text style={[styles.profileSwitchText, activeProfileSlot === 'primary' && styles.profileSwitchTextActive]} numberOfLines={1}>
              {primaryProfileLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.profileSwitchButton, compact && styles.profileSwitchButtonCompact, activeProfileSlot === 'secondary' && styles.profileSwitchButtonActive]}
            onPress={() => onProfileSlotPress?.('secondary')}
            activeOpacity={0.75}
            testID="profile-switch-secondary"
          >
            <Text style={[styles.profileSwitchText, activeProfileSlot === 'secondary' && styles.profileSwitchTextActive]} numberOfLines={1}>
              {secondaryProfileLabel}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.brandToggleContainer, compact && styles.brandToggleContainerCompact]}>
        <BrandToggle
          activeBrand={activeBrand}
          onToggle={handleBrandToggle}
          showSilversea={true}
          showCarnival={!showProfileSwitch}
          compact={compact}
        />
      </View>

      <View style={[styles.currentValuesSection, compact && styles.currentValuesSectionCompact]}>
        {activeBrand === 'royal' && renderRoyalCaribbeanValues()}
        {activeBrand === 'celebrity' && renderCelebrityValues()}
        {activeBrand === 'silversea' && renderSilverseaValues()}
        {activeBrand === 'carnival' && renderCarnivalValues()}
      </View>

      {enrichmentData?.lastSyncTimestamp ? (
        <View style={[styles.syncTimestampContainer, compact && styles.syncTimestampContainerCompact]}>
          <Text style={styles.syncTimestampText}>Last synced: {formatDate(enrichmentData.lastSyncTimestamp)}</Text>
        </View>
      ) : null}

      <View style={[styles.editButtonContainer, compact && styles.editButtonContainerCompact]}>
        <TouchableOpacity 
          style={[styles.editButton, compact && styles.editButtonCompact]}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.7}
          testID="profile-edit-button"
        >
          <Edit2 size={16} color={getBrandGradient()[0]} />
          <Text style={[styles.editButtonText, { color: getBrandGradient()[0] }]}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <User size={20} color={getBrandGradient()[0]} />
                  <Text style={[styles.modalTitle, { color: getBrandGradient()[0] }]}>
                    Edit {getBrandTitle()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#676A70" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                  testID="profile-modal-cancel-top-button"
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSave}
                  activeOpacity={0.7}
                  disabled={isSaving}
                  testID="profile-modal-save-top-button"
                >
                  <LinearGradient
                    colors={getBrandGradient()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveButtonGradient}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Save size={16} color={COLORS.white} />
                        <Text style={styles.modalSaveText}>Save Profile</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                {renderEditForm()}
              </View> 
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFCF7',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  containerCompact: {
    borderRadius: 16,
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  headerTitleCompact: {
    fontSize: 16,
    lineHeight: 19,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerSubtitleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  enrichmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  enrichmentBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  enrichmentBadgeInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  enrichmentBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  profileSwitchContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    gap: 4,
  },
  profileSwitchContainerCompact: {
    marginHorizontal: 8,
    marginTop: 6,
    padding: 2,
  },
  profileSwitchButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  profileSwitchButtonCompact: {
    minHeight: 44,
    paddingHorizontal: 6,
  },
  profileSwitchButtonActive: {
    backgroundColor: '#0F766E',
    ...SHADOW.sm,
  },
  profileSwitchText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#334155',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  profileSwitchTextActive: {
    color: COLORS.white,
  },
  brandToggleContainer: {
    padding: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  brandToggleContainerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentValuesSection: {
    padding: 14,
    paddingTop: 0,
  },
  currentValuesSectionCompact: {
    padding: 8,
    paddingTop: 0,
  },
  loyaltyProgressStack: {
    gap: 12,
    marginBottom: 14,
  },
  loyaltyProgressStackCompact: {
    gap: 6,
    marginBottom: 7,
  },
  retainedStatusRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D5A2',
    backgroundColor: '#FFF8E5',
  },
  retainedStatusRowCompact: {
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  retainedStatusText: {
    flex: 1,
    color: '#17324D',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  retainedStatusTextCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  loyaltyProgressCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFCF7',
    padding: 16,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  loyaltyProgressCardCompact: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    shadowOpacity: 0,
    elevation: 0,
  },
  loyaltyProgressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  loyaltyProgressHeadingCopy: { flex: 1, minWidth: 0 },
  loyaltyProgressEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.25,
  },
  loyaltyProgressEyebrowCompact: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  loyaltyProgressTitle: {
    marginTop: 3,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    color: '#17324D',
    fontSize: 19,
    lineHeight: 24,
  },
  loyaltyProgressTitleCompact: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 17,
  },
  loyaltyProgressStatus: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  loyaltyProgressStatusCompact: {
    minHeight: 25,
    paddingHorizontal: 7,
    borderRadius: 9,
  },
  loyaltyProgressStatusText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.4,
  },
  loyaltyProgressStatusTextCompact: {
    fontSize: 12,
  },
  loyaltyProgressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  loyaltyProgressNumbersCompact: {
    marginTop: 3,
  },
  loyaltyProgressCurrent: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    color: '#17324D',
    fontSize: 34,
    lineHeight: 39,
  },
  loyaltyProgressCurrentCompact: {
    fontSize: 22,
    lineHeight: 24,
  },
  loyaltyProgressTarget: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorial,
    color: '#425466',
    fontSize: 22,
    lineHeight: 27,
  },
  loyaltyProgressTargetCompact: {
    fontSize: 15,
    lineHeight: 18,
  },
  loyaltyProgressTrack: {
    height: 12,
    marginTop: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E3E8EA',
  },
  loyaltyProgressTrackCompact: {
    height: 6,
    marginTop: 5,
  },
  loyaltyProgressFill: {
    height: '100%',
    minWidth: 4,
    borderRadius: 999,
  },
  loyaltyProgressScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  loyaltyProgressScaleText: {
    color: '#60727F',
    fontSize: 10,
  },
  loyaltyProgressFooter: {
    marginTop: 8,
    color: '#425466',
    fontSize: 11,
    lineHeight: 16,
  },
  loyaltyProgressFooterCompact: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  valueCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#F8F4ED',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E3DDD4',
  },
  valueCardCompact: {
    minWidth: '31%',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  valueCardWide: {
    minWidth: '96%',
  },
  valueCardLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  valueCardLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  valueCardValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#0F172A',
  },
  valueCardValueCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  compactDetailsButton: {
    minHeight: 44,
    marginTop: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9C9C8',
    backgroundColor: '#FFFFFF',
  },
  compactDetailsButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#17324D',
  },
  syncTimestampContainer: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  syncTimestampContainerCompact: {
    paddingBottom: 3,
  },
  syncTimestampText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic' as const,
    textAlign: 'center',
  },
  editButtonContainer: {
    padding: SPACING.sm,
    paddingTop: 0,
  },
  editButtonContainerCompact: {
    padding: 6,
    paddingTop: 0,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.3)',
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  editButtonCompact: {
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalContent: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E40AF',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#333334',
  },
  levelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
  },
  levelHintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  levelHintText: {
    fontSize: 10,
    color: '#1E40AF',
  },
  levelHintLevel: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  tierSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  tierSelectorButton: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  tierSelectorText: {
    color: '#0F172A',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  tierSelectorTextSelected: {
    color: COLORS.white,
  },
  fieldHelpText: {
    marginTop: SPACING.xs,
    color: '#475569',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
    backgroundColor: COLORS.white,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F3F2',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#676A70',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  modalSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  modalSaveText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
