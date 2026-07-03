import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart3, Copy, Crown, DollarSign, Ship, Star, Target, TrendingUp } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, GRADIENTS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { HostViewProfile } from '@/lib/analytics/hostView';

type HostViewCardProps = {
  profile: HostViewProfile;
  onCopySummary?: (summary: string) => void;
};

function formatCurrency(value: number): string {
  return `$${Math.round(value || 0).toLocaleString()}`;
}

function formatNumber(value: number): string {
  return Math.round(value || 0).toLocaleString();
}

function prettyLabel(value: string): string {
  if (!value) return 'Unknown';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      {icon}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  const safeItems = items && items.length ? items : [emptyText];
  return (
    <View style={styles.bulletList}>
      {safeItems.slice(0, 6).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function HostViewCard({ profile, onCopySummary }: HostViewCardProps) {
  const safeProfile: HostViewProfile = profile ?? {
    userName: 'EasySeas Player',
    clubRoyaleTier: 'Unknown',
    clubRoyalePoints: 0,
    crownAnchorLevel: 'Unknown',
    crownAnchorPoints: 0,
    totalCruisesTracked: 0,
    completedCruises: 0,
    upcomingCruises: 0,
    totalCasinoSessions: 0,
    totalCoinIn: 0,
    totalWinLoss: 0,
    totalPointsEarned: 0,
    avgPointsPerCruise: 0,
    avgPointsPerCasinoDay: 0,
    avgCoinInPerCruise: 0,
    avgCoinInPerDay: 0,
    avgBet: 0,
    favoriteShips: [],
    favoriteMachines: [],
    estimatedPlayerValueLabel: 'unknown',
    strengths: [],
    risks: [],
    hostTalkingPoints: [],
    copySummary: '',
  };

  return (
    <LinearGradient
      colors={GRADIENTS.card as unknown as [string, string, ...string[]]}
      style={styles.container}
      testID="host-view-card"
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Crown size={20} color={COLORS.goldDark} />
          <View style={styles.titleTextBlock}>
            <Text style={styles.title}>Host View</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{safeProfile.userName}</Text>
          </View>
        </View>
        {onCopySummary && (
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => onCopySummary(safeProfile.copySummary)}
            testID="host-view-copy-summary"
          >
            <Copy size={14} color={COLORS.primary} />
            <Text style={styles.copyText}>Copy</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.valuePill}>
        <Star size={14} color={COLORS.goldDark} />
        <Text style={styles.valuePillText}>Estimated player value: {prettyLabel(safeProfile.estimatedPlayerValueLabel)}</Text>
      </View>

      <Section title="Loyalty Snapshot">
        <View style={styles.metricsRow}>
          <Metric icon={<Crown size={15} color={COLORS.loyalty} />} label="Club Royale" value={`${safeProfile.clubRoyaleTier || 'Unknown'} • ${formatNumber(safeProfile.clubRoyalePoints)} pts`} />
          <Metric icon={<Ship size={15} color={COLORS.pointsDark} />} label="Crown & Anchor" value={`${safeProfile.crownAnchorLevel || 'Unknown'} • ${formatNumber(safeProfile.crownAnchorPoints)} pts`} />
        </View>
      </Section>

      <Section title="Casino Play Summary">
        <View style={styles.metricsGrid}>
          <Metric icon={<Target size={15} color={COLORS.pointsDark} />} label="Points" value={formatNumber(safeProfile.totalPointsEarned)} />
          <Metric icon={<DollarSign size={15} color={COLORS.moneyDark} />} label="Coin-in" value={formatCurrency(safeProfile.totalCoinIn)} />
          <Metric icon={<TrendingUp size={15} color={safeProfile.totalWinLoss >= 0 ? COLORS.success : COLORS.error} />} label="Win/loss" value={formatCurrency(safeProfile.totalWinLoss)} />
        </View>
        <Text style={styles.detailText}>
          {formatNumber(safeProfile.totalCasinoSessions)} sessions • {formatNumber(safeProfile.avgPointsPerCasinoDay)} avg pts/day • {formatCurrency(safeProfile.avgCoinInPerDay)} avg coin-in/day
        </Text>
      </Section>

      <Section title="Cruise Value Summary">
        <Text style={styles.detailText}>
          {safeProfile.totalCruisesTracked} cruises tracked • {safeProfile.completedCruises} completed • {safeProfile.upcomingCruises} upcoming
        </Text>
        <Text style={styles.detailText}>
          Avg per completed cruise: {formatNumber(safeProfile.avgPointsPerCruise)} pts • {formatCurrency(safeProfile.avgCoinInPerCruise)} coin-in
        </Text>
      </Section>

      <Section title="Player Pattern">
        <Text style={styles.detailText}>Favorite ships: {safeProfile.favoriteShips.length ? safeProfile.favoriteShips.join(', ') : 'Not enough data yet'}</Text>
        <Text style={styles.detailText}>Favorite machines: {safeProfile.favoriteMachines.length ? safeProfile.favoriteMachines.join(', ') : 'Not enough data yet'}</Text>
        <Text style={styles.detailText}>Average bet: {safeProfile.avgBet > 0 ? formatCurrency(safeProfile.avgBet) : 'Not enough data yet'}</Text>
      </Section>

      <Section title="Host Talking Points">
        <BulletList items={safeProfile.hostTalkingPoints} emptyText="No host talking points available yet." />
      </Section>

      <Section title="Strengths">
        <BulletList items={safeProfile.strengths} emptyText="No strengths available yet." />
      </Section>

      <Section title="Risks / Watchouts">
        <BulletList items={safeProfile.risks} emptyText="No major risks detected from available local data." />
      </Section>

      <View style={styles.footerRow}>
        <BarChart3 size={14} color={COLORS.textSecondary} />
        <Text style={styles.footerText}>Uses local EasySeas profile, cruise, certificate, offer, and session data.</Text>
      </View>
    </LinearGradient>
  );
}

export default HostViewCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  titleTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  copyText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 10, 0.30)',
    backgroundColor: 'rgba(212, 160, 10, 0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  valuePillText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.goldDark,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  section: {
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    gap: 3,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  bulletList: {
    gap: 5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  bulletDot: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  footerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
});
