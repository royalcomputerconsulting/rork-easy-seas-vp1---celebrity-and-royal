import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Crown, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { useLoyalty } from '@/state/LoyaltyProvider';

interface ClubRoyalePointsProps {
  onPress?: () => void;
  compact?: boolean;
  showPinnacleProgress?: boolean;
}

interface PaisleySpec {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fill: string;
  stroke: string;
  accent: string;
  opacity: number;
}

const PAISLEY_PATH = 'M16 10C33 -2 56 6 65 24C74 42 69 63 55 81C44 95 33 108 28 126C14 107 9 90 10 72C12 54 20 40 29 30C37 22 41 14 38 7C31 7 23 7 16 10Z';
const PAISLEY_INNER_PATH = 'M23 27C31 20 45 22 50 33C55 44 50 57 40 69C32 79 27 90 24 101C17 88 16 77 18 64C20 51 25 40 30 34C34 29 35 23 33 18';
const PAISLEY_SWIRL_PATH = 'M25 31C37 21 54 25 57 39C60 51 52 63 39 71';

const PAISLEY_SPECS: PaisleySpec[] = [
  {
    x: -10,
    y: 96,
    scale: 1.2,
    rotation: -18,
    fill: 'rgba(255,255,255,0.52)',
    stroke: 'rgba(148,163,184,0.20)',
    accent: 'rgba(148,163,184,0.40)',
    opacity: 1,
  },
  {
    x: 136,
    y: -6,
    scale: 0.98,
    rotation: 18,
    fill: 'rgba(246,247,249,0.88)',
    stroke: 'rgba(148,163,184,0.18)',
    accent: 'rgba(156,163,175,0.34)',
    opacity: 0.95,
  },
  {
    x: 240,
    y: 102,
    scale: 1.14,
    rotation: 24,
    fill: 'rgba(255,255,255,0.58)',
    stroke: 'rgba(148,163,184,0.18)',
    accent: 'rgba(156,163,175,0.36)',
    opacity: 0.92,
  },
  {
    x: 88,
    y: 150,
    scale: 0.72,
    rotation: -12,
    fill: 'rgba(255,255,255,0.34)',
    stroke: 'rgba(148,163,184,0.14)',
    accent: 'rgba(156,163,175,0.28)',
    opacity: 0.86,
  },
];

const PaisleyBackground = React.memo(function PaisleyBackground() {
  return (
    <View pointerEvents="none" style={styles.backgroundLayer} testID="player-loyalty-card.paisley-background">
      <View style={styles.backgroundBase} />
      <Svg width="100%" height="100%" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice">
        {PAISLEY_SPECS.map((spec, index) => (
          <G
            key={`paisley-${index}`}
            opacity={spec.opacity}
            transform={`translate(${spec.x} ${spec.y}) scale(${spec.scale}) rotate(${spec.rotation} 38 68)`}
          >
            <Path d={PAISLEY_PATH} fill={spec.fill} stroke={spec.stroke} strokeWidth={1.5} />
            <Path d={PAISLEY_INNER_PATH} fill="none" stroke={spec.stroke} strokeWidth={1.25} strokeLinecap="round" />
            <Path d={PAISLEY_SWIRL_PATH} fill="none" stroke={spec.accent} strokeWidth={2} strokeLinecap="round" />
            <Circle cx="28" cy="50" r="4.8" fill={spec.accent} />
            <Circle cx="40" cy="58" r="2.6" fill={spec.stroke} />
          </G>
        ))}
      </Svg>
    </View>
  );
});

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
  } = useLoyalty();

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
  const hasAchievedSignature = clubRoyalePoints >= signatureThreshold;
  const primeThreshold = CLUB_ROYALE_TIERS.Prime.threshold;
  const signatureProgress = hasAchievedSignature
    ? 100
    : Math.min(100, Math.max(0, ((clubRoyalePoints - primeThreshold) / (signatureThreshold - primeThreshold)) * 100));

  const progressTrackColor = 'rgba(30, 58, 95, 0.08)';

  const content = (
    <View style={[styles.container, compact && styles.containerCompact]} testID="player-loyalty-card">
      <PaisleyBackground />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Crown size={20} color={COLORS.gold} />
          </View>
          <View>
            <Text style={styles.title}>Player & Loyalty Status</Text>
            <Text style={styles.pointsText}>
              {clubRoyalePoints.toLocaleString()} CR pts • {crownAnchorPoints} C&amp;A pts
            </Text>
          </View>
        </View>

        <TierBadgeGroup
          clubRoyaleTier={clubRoyaleTier}
          crownAnchorLevel={crownAnchorLevel}
          size="small"
        />
      </View>

      {!compact && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pinnacleProgress.nightsToNext}</Text>
              <Text style={styles.statLabel}>Nights to Pinnacle</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {mastersProgress.pointsToNext.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Points to Masters</Text>
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
                backgroundColor={progressTrackColor}
              />
              {pinnacleProgress.pinnacleShip && pinnacleProgress.pinnacleSailDate && pinnacleProgress.nightsToNext > 0 && (
                <View style={styles.pinnacleAchievementBadge}>
                  <Text style={styles.pinnacleAchievementText}>
                    ⭐ {pinnacleProgress.pinnacleShip} - {String(pinnacleProgress.pinnacleSailDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
                      ? (() => {
                          const match = String(pinnacleProgress.pinnacleSailDate).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                          if (!match) return pinnacleProgress.pinnacleSailDate;
                          const [, year, month, day] = match;
                          return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
                        })()
                      : pinnacleProgress.pinnacleSailDate}
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
                    gradientColors={[COLORS.loyalty, COLORS.loyaltyLight]}
                    backgroundColor={progressTrackColor}
                  />

                  <View style={styles.progressSpacer} />

                  <ProgressBar
                    label={`Progress to Masters (${clubRoyalePoints.toLocaleString()}/${mastersThreshold.toLocaleString()})`}
                    progress={mastersProgress.percentComplete}
                    eta={mastersETA}
                    height={6}
                    gradientColors={[COLORS.gold, COLORS.goldLight]}
                    backgroundColor={progressTrackColor}
                  />
                </>
              ) : clubRoyalePoints > primeThreshold ? (
                <ProgressBar
                  label={`Progress to Signature (${clubRoyalePoints.toLocaleString()}/${signatureThreshold.toLocaleString()})`}
                  progress={signatureProgress}
                  eta={signatureProgress < 100 ? 'In Progress' : 'Almost There!'}
                  height={6}
                  gradientColors={[CLUB_ROYALE_TIERS.Signature.color, '#A78BFA']}
                  backgroundColor={progressTrackColor}
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} testID="player-loyalty-card-button">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E7E8EA',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7DCE2',
    ...SHADOW.lg,
  },
  containerCompact: {
    padding: SPACING.md,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ECEDEF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
    paddingRight: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 10, 0.22)',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#5B6572',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  pointsText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.navyDark,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(30,58,95,0.08)',
    marginHorizontal: SPACING.md,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    color: COLORS.goldDark,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 10, 0.22)',
  },
  pinnacleAchievementText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.goldDark,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textAlign: 'center',
  },
});
