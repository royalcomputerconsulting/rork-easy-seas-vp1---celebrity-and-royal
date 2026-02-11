import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  AlertTriangle, 
  AlertCircle, 
  Bell,
  BellOff,
  X, 
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Tag,
  Target,
  Calendar,
  DollarSign,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { Alert, AlertPriority, AnomalyType, PatternInsight } from '@/types/models';

interface AlertItemProps {
  alert: Alert;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onAction?: (alert: Alert) => void;
  compact?: boolean;
}

function getAlertIcon(type: AnomalyType, size: number = 20) {
  const iconProps = { size, strokeWidth: 2 };
  
  switch (type) {
    case 'roi_outlier':
      return <TrendingDown {...iconProps} color={COLORS.error} />;
    case 'spending_spike':
      return <DollarSign {...iconProps} color={COLORS.warning} />;
    case 'points_mismatch':
      return <Target {...iconProps} color={COLORS.aquaAccent} />;
    case 'offer_expiring':
      return <Tag {...iconProps} color={COLORS.goldAccent} />;
    case 'tier_milestone':
      return <TrendingUp {...iconProps} color={COLORS.success} />;
    case 'booking_conflict':
      return <Calendar {...iconProps} color={COLORS.error} />;
    case 'value_drop':
      return <TrendingDown {...iconProps} color={COLORS.warning} />;
    case 'unusual_pattern':
      return <AlertCircle {...iconProps} color={COLORS.aquaAccent} />;
    default:
      return <Bell {...iconProps} color={COLORS.textSecondary} />;
  }
}

function getPriorityColor(priority: AlertPriority): string {
  switch (priority) {
    case 'critical':
      return COLORS.error;
    case 'high':
      return '#FF6B6B';
    case 'medium':
      return COLORS.warning;
    case 'low':
      return COLORS.aquaAccent;
    case 'info':
      return COLORS.textSecondary;
    default:
      return COLORS.textSecondary;
  }
}

function getPriorityGradient(priority: AlertPriority): [string, string] {
  switch (priority) {
    case 'critical':
      return ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.05)'];
    case 'high':
      return ['rgba(255, 107, 107, 0.15)', 'rgba(255, 107, 107, 0.03)'];
    case 'medium':
      return ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.03)'];
    case 'low':
      return ['rgba(0, 206, 209, 0.1)', 'rgba(0, 206, 209, 0.02)'];
    case 'info':
      return ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'];
    default:
      return ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'];
  }
}

export const AlertItem = React.memo(function AlertItem({ alert, onDismiss, onSnooze, onAction, compact = false }: AlertItemProps) {
  const router = useRouter();
  const priorityColor = getPriorityColor(alert.priority);
  const gradientColors = getPriorityGradient(alert.priority);

  const handleAction = useCallback(() => {
    if (onAction) {
      onAction(alert);
    } else if (alert.actionRoute) {
      router.push(alert.actionRoute as never);
    }
  }, [alert, onAction, router]);

  const handleSnooze = useCallback(() => {
    onSnooze(alert.id, 1440);
  }, [alert.id, onSnooze]);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactItem}
        onPress={handleAction}
        activeOpacity={0.8}
      >
        <View style={[styles.compactIndicator, { backgroundColor: priorityColor }]} />
        <View style={styles.compactIcon}>
          {getAlertIcon(alert.type, 16)}
        </View>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {alert.title}
        </Text>
        <ChevronRight size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.alertItem}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <View style={styles.alertIconContainer}>
            {getAlertIcon(alert.type)}
          </View>
          <View style={styles.alertTitleContainer}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertTime}>
              {new Date(alert.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}30` }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {alert.priority.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.alertMessage} numberOfLines={alert.type === 'booking_conflict' || alert.type === 'price_drop' ? undefined : 3}>
          {alert.message}
        </Text>

        <View style={styles.alertActions}>
          {alert.actionLabel && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: `${priorityColor}20` }]}
              onPress={handleAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, { color: priorityColor }]}>
                {alert.actionLabel}
              </Text>
              <ChevronRight size={14} color={priorityColor} />
            </TouchableOpacity>
          )}
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSnooze}
              activeOpacity={0.7}
            >
              <Clock size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onDismiss(alert.id)}
              activeOpacity={0.7}
            >
              <X size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
});

interface InsightItemProps {
  insight: PatternInsight;
}

export function InsightItem({ insight }: InsightItemProps) {
  const getTrendIcon = () => {
    if (insight.type === 'trend' && insight.data.trend) {
      return insight.data.trend === 'increasing' || insight.data.trend === 'stable'
        ? <TrendingUp size={18} color={COLORS.success} />
        : <TrendingDown size={18} color={COLORS.warning} />;
    }
    return <Sparkles size={18} color={COLORS.goldAccent} />;
  };

  return (
    <View style={styles.insightItem}>
      <LinearGradient
        colors={['rgba(212, 165, 116, 0.1)', 'rgba(212, 165, 116, 0.02)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.insightIcon}>
        {getTrendIcon()}
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.insightDescription} numberOfLines={2}>
          {insight.description}
        </Text>
        <View style={styles.insightMeta}>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {Math.round(insight.confidence * 100)}% confidence
            </Text>
          </View>
          <Text style={styles.insightType}>{insight.type}</Text>
        </View>
      </View>
    </View>
  );
}

interface AlertsCardProps {
  alerts: Alert[];
  insights?: PatternInsight[];
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onClearAll?: () => void;
  maxAlerts?: number;
  showInsights?: boolean;
  title?: string;
}

export function AlertsCard({
  alerts,
  insights = [],
  onDismiss,
  onSnooze,
  onClearAll,
  maxAlerts = 5,
  showInsights = true,
  title = 'Alerts & Insights',
}: AlertsCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const highCount = alerts.filter(a => a.priority === 'high').length;
  const displayAlerts = expanded ? alerts : alerts.slice(0, maxAlerts);
  const displayInsights = insights.slice(0, 3);

  if (alerts.length === 0 && insights.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.emptyIconContainer}>
          <BellOff size={32} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>All Clear</Text>
        <Text style={styles.emptyText}>No alerts or insights at this time</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Bell size={20} color={COLORS.beigeWarm} />
          <Text style={styles.cardTitle}>{title}</Text>
          {(criticalCount > 0 || highCount > 0) && (
            <View style={styles.alertCountBadge}>
              <Text style={styles.alertCountText}>
                {criticalCount + highCount}
              </Text>
            </View>
          )}
        </View>
        {onClearAll && alerts.length > 0 && (
          <TouchableOpacity onPress={onClearAll} activeOpacity={0.7}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={14} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>
              Active Alerts ({alerts.length})
            </Text>
          </View>
          
          {displayAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
            />
          ))}
          
          {alerts.length > maxAlerts && (
            <TouchableOpacity 
              style={styles.viewMoreButton} 
              activeOpacity={0.7}
              onPress={() => setExpanded(prev => !prev)}
            >
              <Text style={styles.viewMoreText}>
                {expanded ? 'Show fewer alerts' : `View ${alerts.length - maxAlerts} more alerts`}
              </Text>
              <ChevronRight size={14} color={COLORS.beigeWarm} style={expanded ? { transform: [{ rotate: '90deg' }] } : undefined} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showInsights && insights.length > 0 && (
        <View style={styles.insightsSection}>
          <View style={styles.sectionHeader}>
            <Sparkles size={14} color={COLORS.goldAccent} />
            <Text style={styles.sectionTitle}>
              Pattern Insights ({insights.length})
            </Text>
          </View>
          
          {displayInsights.map((insight) => (
            <InsightItem key={insight.id} insight={insight} />
          ))}
        </View>
      )}
    </View>
  );
}

interface AlertsBadgeProps {
  count: number;
  hasCritical?: boolean;
  size?: 'small' | 'medium';
}

export function AlertsBadge({ count, hasCritical = false, size = 'small' }: AlertsBadgeProps) {
  if (count === 0) return null;

  const badgeSize = size === 'small' ? 18 : 22;
  const fontSize = size === 'small' ? 10 : 12;

  return (
    <View
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: hasCritical ? COLORS.error : COLORS.warning,
        },
      ]}
    >
      <Text style={[styles.badgeText, { fontSize }]}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

interface CompactAlertsListProps {
  alerts: Alert[];
  maxItems?: number;
  onPress?: (alert: Alert) => void;
}

export function CompactAlertsList({ alerts, maxItems = 3, onPress }: CompactAlertsListProps) {
  const displayAlerts = alerts.slice(0, maxItems);

  if (alerts.length === 0) return null;

  return (
    <View style={styles.compactList}>
      {displayAlerts.map((alert) => (
        <TouchableOpacity
          key={alert.id}
          style={styles.compactListItem}
          onPress={() => onPress?.(alert)}
          activeOpacity={0.8}
        >
          <View style={[styles.compactDot, { backgroundColor: getPriorityColor(alert.priority) }]} />
          <Text style={styles.compactListText} numberOfLines={1}>
            {alert.title}
          </Text>
        </TouchableOpacity>
      ))}
      {alerts.length > maxItems && (
        <Text style={styles.moreAlertsText}>
          +{alerts.length - maxItems} more
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textPrimary,
  },
  alertCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  alertCountText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  clearAllText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  alertsSection: {
    marginBottom: SPACING.md,
  },
  insightsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textSecondary,
  },
  alertItem: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  priorityBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  alertContent: {
    padding: SPACING.md,
    paddingLeft: SPACING.md + 6,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  alertIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  alertTitleContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textPrimary,
  },
  alertTime: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  insightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(0, 206, 209, 0.15)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  confidenceText: {
    fontSize: 10,
    color: COLORS.aquaAccent,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  insightType: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  viewMoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  emptyCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  compactIndicator: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    marginRight: SPACING.sm,
  },
  compactIcon: {
    marginRight: SPACING.xs,
  },
  compactTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textPrimary,
  },
  compactList: {
    gap: SPACING.xs,
  },
  compactListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactListText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  moreAlertsText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.beigeWarm,
    marginTop: SPACING.xs,
  },
});
