import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';

import { useLoyalty } from '@/state/LoyaltyProvider';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { EntityProvenanceDisclosure } from '@/components/ui/EntityProvenanceDisclosure';
import { useUser } from '@/state/UserProvider';
import { useExperience } from '@/state/ExperienceProvider';

interface ClubRoyalePointsProps {
  onPress?: () => void;
  compact?: boolean;
  showPinnacleProgress?: boolean;
}

export function ClubRoyalePoints({
  onPress,
  compact = false,
  showPinnacleProgress = true,
}: ClubRoyalePointsProps) {
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    crownAnchorPoints,
    crownAnchorLevel,
    pinnacleProgress,
    mastersProgress,
    clubRoyalePointsSource,
  } = useLoyalty();
  const { currentUser } = useUser();
  const { textScale } = useExperience();

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Not scheduled';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear());
    return `${mm}/${dd}/${yy}`;
  };

  const pinnacleETA = pinnacleProgress.nightsToNext === 0 
    ? 'Achieved!' 
    : formatDate(pinnacleProgress.projectedDate);
  
  const mastersETA = mastersProgress.pointsToNext === 0
    ? 'Achieved!'
    : mastersProgress.projectedDate
    ? formatDate(mastersProgress.projectedDate)
    : 'Play more to estimate';

  const signatureThreshold = CLUB_ROYALE_TIERS.Signature.threshold;
  const mastersThreshold = CLUB_ROYALE_TIERS.Masters.threshold;
  
  // Only show Signature progress if user has exceeded the Signature threshold (25,001+)
  const hasAchievedSignature = clubRoyalePoints >= signatureThreshold;
  // Calculate actual progress to Signature for users who haven't achieved it yet
  const primeThreshold = CLUB_ROYALE_TIERS.Prime.threshold;
  const signatureProgress = hasAchievedSignature 
    ? 100 
    : Math.min(100, Math.max(0, ((clubRoyalePoints - primeThreshold) / (signatureThreshold - primeThreshold)) * 100));
  
  const content = (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <LinearGradient
        colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!compact ? <PremiumVoyageArtwork kind="loyalty" ship="Casino & Cruise Loyalty" destination={`${clubRoyaleTier} · ${crownAnchorLevel}`} height={88} /> : null}
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Crown size={20} color={COLORS.gold} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}>Casino & Cruise Loyalty</Text>
            <Text style={[styles.pointsText, { fontSize: TYPOGRAPHY.fontSizeLG * textScale }]}>
              {clubRoyalePoints.toLocaleString()} Casino pts • {crownAnchorPoints} C&A nights
            </Text>
          </View>
        </View>
        
        <TierBadgeGroup 
          clubRoyaleTier={clubRoyaleTier}
          crownAnchorLevel={crownAnchorLevel}
          size="small"
        />
      </View>
      {!compact ? <EntityProvenanceDisclosure ownerId={currentUser?.id ?? null} entityType="loyalty" entityId="club-royale" field="points" label="Club Royale point source" fallback={{ sourceType: clubRoyalePointsSource === 'manual' ? 'manual_entry' : clubRoyalePointsSource === 'api' ? 'provider_sync' : 'local_database', observedAt: currentUser?.clubRoyaleLastSyncAt || currentUser?.updatedAt || new Date().toISOString(), ownerId: currentUser?.id ?? null, confidence: clubRoyalePointsSource === 'api' ? 'high' : 'medium', sourceRecord: clubRoyalePointsSource === 'api' ? 'Club Royale loyalty synchronization' : 'Owner-scoped saved loyalty profile', formula: null, provider: 'Club Royale', sourceHash: null, notes: null }} /> : null}

      {!compact && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: TYPOGRAPHY.fontSizeXXL * textScale }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{pinnacleProgress.currentPointsNeeded}</Text>
              <Text style={[styles.statLabel, { fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>Pts to Pinnacle</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: TYPOGRAPHY.fontSizeXXL * textScale }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                {mastersProgress.pointsToNext.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>Casino Pts to Masters</Text>
            </View>
          </View>

          {showPinnacleProgress && (
            <View style={styles.progressSection}>
              <ProgressBar
                label={`Progress to Pinnacle (${crownAnchorPoints}/700)`}
                progress={pinnacleProgress.percentComplete}
                eta={pinnacleETA}
                height={6}
                gradientColors={[COLORS.points, COLORS.pointsLight]}
                surfaceTone="light"
              />
              {pinnacleProgress.thresholdCrossedShip && pinnacleProgress.thresholdCrossedSailDate && pinnacleProgress.nightsToNext > 0 && (
                <View style={styles.pinnacleAchievementBadge}>
                  <Text style={styles.pinnacleAchievementText}>
                    Pinnacle path: {crownAnchorPoints} → {pinnacleProgress.projectedPointsAtPinnacle} by {String(pinnacleProgress.thresholdCrossedSailDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) ? (() => {
                      const m = String(pinnacleProgress.thresholdCrossedSailDate).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                      if (!m) return pinnacleProgress.thresholdCrossedSailDate;
                      const [, y, mo, da] = m;
                      return `${String(mo).padStart(2, '0')}/${String(da).padStart(2, '0')}/${y}`;
                    })() : pinnacleProgress.thresholdCrossedSailDate}
                  </Text>
                </View>
              )}
              
              <View style={styles.progressSpacer} />
              
              {hasAchievedSignature ? (
                <>
                  <ProgressBar
                    label={`Progress to Signature (${clubRoyalePoints.toLocaleString()}/${signatureThreshold.toLocaleString()}) ✓`}
                    progress={100}
                    eta="ACHIEVED!"
                    height={6}
                    gradientColors={[
                      COLORS.loyalty,
                      COLORS.loyaltyLight
                    ]}
                    surfaceTone="light"
                  />
                  
                  <View style={styles.progressSpacer} />
                  
                  <ProgressBar
                    label={`Progress to Masters (${clubRoyalePoints.toLocaleString()}/${mastersThreshold.toLocaleString()})`}
                    progress={mastersProgress.percentComplete}
                    eta={mastersETA}
                    height={6}
                    gradientColors={[
                      COLORS.gold,
                      COLORS.goldLight
                    ]}
                    surfaceTone="light"
                  />
                </>
              ) : clubRoyalePoints > primeThreshold ? (
                <ProgressBar
                  label={`Progress to Signature (${clubRoyalePoints.toLocaleString()}/${signatureThreshold.toLocaleString()})`}
                  progress={signatureProgress}
                  eta={signatureProgress < 100 ? 'In Progress' : 'Almost There!'}
                  height={6}
                  gradientColors={[
                    CLUB_ROYALE_TIERS.Signature.color,
                    '#A78BFA'
                  ]}
                  surfaceTone="light"
                />
              ) : null}
            </View>
          )}
        </>
      )}

      {onPress && (
        <View style={styles.chevron}>
          <ChevronRight size={20} color={COLORS.textSecondary} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Open casino and cruise loyalty. ${clubRoyalePoints.toLocaleString()} casino points, ${crownAnchorPoints} Crown and Anchor nights`}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOW.lg,
  },
  containerCompact: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  pointsText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    minWidth: 130,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: SPACING.md,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    width: '100%',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
    flexShrink: 1,
  },
  progressSection: {
    marginTop: SPACING.sm,
  },
  progressSpacer: {
    height: SPACING.md,
  },
  chevron: {
    position: 'absolute',
    right: SPACING.md,
    top: '50%',
    marginTop: -10,
  },
  pinnacleAchievementBadge: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  pinnacleAchievementText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.gold,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textAlign: 'center',
  },
});
