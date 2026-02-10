import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Bell,
  Trash2,
  Check,
  AlertTriangle,
  Clock,
  Tag,
  Ship,
  CheckCircle,
  Circle,
  Store,
  TrendingUp,
  Zap,
  CalendarX,
  TrendingDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAlerts } from '@/state/AlertsProvider';
import type { Alert, AnomalyType } from '@/types/models';

interface AlertsManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AlertsManagerModal({ visible, onClose }: AlertsManagerModalProps) {
  const router = useRouter();
  const { 
    alerts, 
    activeAlerts,
    dismissAlert, 
    snoozeAlert,
    resolveAlert,
    clearAllAlerts,
    summary,
  } = useAlerts();

  const [filter, setFilter] = useState<'all' | 'active' | 'dismissed'>('all');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case 'active':
        return activeAlerts;
      case 'dismissed':
        return alerts.filter(a => a.status === 'dismissed');
      default:
        return alerts;
    }
  }, [alerts, activeAlerts, filter]);

  const dismissedCount = useMemo(() => 
    alerts.filter(a => a.status === 'dismissed').length, 
    [alerts]
  );

  const getAlertIcon = (type: AnomalyType) => {
    switch (type) {
      case 'offer_expiring':
        return Clock;
      case 'spending_spike':
        return Tag;
      case 'tier_milestone':
        return Ship;
      case 'roi_outlier':
        return TrendingUp;
      case 'value_drop':
        return AlertTriangle;
      case 'booking_conflict':
        return CalendarX;
      case 'unusual_pattern':
        return Zap;
      case 'price_drop':
        return TrendingDown;
      default:
        return Bell;
    }
  };

  const getAlertColor = (priority: string, type?: AnomalyType) => {
    if (type === 'price_drop') {
      return COLORS.success;
    }
    switch (priority) {
      case 'critical':
        return COLORS.error;
      case 'high':
        return COLORS.warning;
      case 'medium':
        return COLORS.aquaAccent;
      default:
        return COLORS.beigeWarm;
    }
  };

  const handleMarkAsRead = useCallback((id: string) => {
    resolveAlert(id);
    console.log('[AlertsManager] Alert resolved:', id);
  }, [resolveAlert]);

  const handleSnooze = useCallback((id: string) => {
    snoozeAlert(id, 1440);
    console.log('[AlertsManager] Alert snoozed for 1 day:', id);
  }, [snoozeAlert]);

  const handleDismiss = useCallback((id: string) => {
    dismissAlert(id);
    if (expandedAlertId === id) setExpandedAlertId(null);
    console.log('[AlertsManager] Alert dismissed:', id);
  }, [dismissAlert, expandedAlertId]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedAlertId(prev => prev === id ? null : id);
  }, []);

  const handleNavigateToAlert = useCallback((alert: Alert) => {
    if (alert.actionRoute) {
      onClose();
      setTimeout(() => {
        router.push(alert.actionRoute as never);
      }, 300);
    }
  }, [router, onClose]);

  const handleClearAll = useCallback(() => {
    clearAllAlerts();
    console.log('[AlertsManager] All alerts cleared');
  }, [clearAllAlerts]);

  const handleMarkAllAsRead = useCallback(() => {
    activeAlerts.forEach(alert => {
      resolveAlert(alert.id);
    });
    console.log('[AlertsManager] All alerts marked as read');
  }, [activeAlerts, resolveAlert]);

  const renderAlertItem = (alert: Alert) => {
    const Icon = getAlertIcon(alert.type);
    const color = getAlertColor(alert.priority, alert.type);
    const isDismissed = alert.status === 'dismissed';
    const isResolved = alert.status === 'resolved';
    const isSnoozed = alert.status === 'snoozed';
    const isExpanded = expandedAlertId === alert.id;

    return (
      <View 
        key={alert.id} 
        style={[
          styles.alertItem, 
          (isDismissed || isResolved) && styles.alertItemRead,
          isSnoozed && styles.alertItemSnoozed,
          isExpanded && styles.alertItemExpanded,
        ]}
      >
        <TouchableOpacity
          style={styles.alertTouchable}
          onPress={() => handleToggleExpand(alert.id)}
          activeOpacity={0.8}
        >
          <View style={styles.alertTopRow}>
            <TouchableOpacity
              style={styles.readToggle}
              onPress={() => handleMarkAsRead(alert.id)}
              activeOpacity={0.7}
            >
              {isResolved ? (
                <CheckCircle size={20} color={COLORS.success} />
              ) : (
                <Circle size={20} color={COLORS.beigeWarm} />
              )}
            </TouchableOpacity>

            <View style={[styles.alertIconContainer, { backgroundColor: `${color}20` }]}>
              <Icon size={18} color={color} />
            </View>

            <View style={styles.alertContent}>
              <View style={styles.alertTitleRow}>
                <Text style={[styles.alertTitle, (isDismissed || isResolved) && styles.alertTitleRead]} numberOfLines={isExpanded ? undefined : 1}>
                  {alert.title}
                </Text>
                <View style={[styles.priorityPill, { backgroundColor: `${color}25` }]}>
                  <Text style={[styles.priorityPillText, { color }]}>
                    {alert.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              {!isExpanded && (
                <Text style={styles.alertMessage} numberOfLines={1}>
                  {alert.message}
                </Text>
              )}
            </View>

            <ChevronRight 
              size={16} 
              color={COLORS.beigeWarm} 
              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={[styles.expandedDivider, { backgroundColor: `${color}30` }]} />
            
            <Text style={styles.expandedMessage}>
              {alert.message}
            </Text>

            {alert.anomaly?.dataPoints && (
              <View style={styles.dataPointsContainer}>
                {alert.anomaly.dataPoints.metric && (
                  <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Metric</Text>
                    <Text style={styles.dataPointValue}>{alert.anomaly.dataPoints.metric}</Text>
                  </View>
                )}
                {alert.anomaly.dataPoints.expectedValue !== undefined && alert.anomaly.dataPoints.actualValue !== undefined && (
                  <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Change</Text>
                    <Text style={[styles.dataPointValue, { color: (alert.anomaly.dataPoints.deviation ?? 0) < 0 ? COLORS.success : COLORS.error }]}>
                      {typeof alert.anomaly.dataPoints.expectedValue === 'number' 
                        ? `${alert.anomaly.dataPoints.expectedValue.toFixed(0)} → ${alert.anomaly.dataPoints.actualValue.toFixed(0)}`
                        : `${alert.anomaly.dataPoints.expectedValue} → ${alert.anomaly.dataPoints.actualValue}`
                      }
                    </Text>
                  </View>
                )}
                {alert.anomaly.dataPoints.deviationPercent !== undefined && alert.anomaly.dataPoints.deviationPercent !== 0 && (
                  <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Difference</Text>
                    <Text style={[styles.dataPointValue, { color: (alert.anomaly.dataPoints.deviationPercent ?? 0) < 0 ? COLORS.success : COLORS.error }]}>
                      {(alert.anomaly.dataPoints.deviationPercent ?? 0) > 0 ? '+' : ''}{(alert.anomaly.dataPoints.deviationPercent ?? 0).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            {alert.createdAt && (
              <Text style={styles.alertTime}>
                Detected: {new Date(alert.createdAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            )}

            {isSnoozed && alert.snoozedUntil && (
              <View style={styles.snoozedBadge}>
                <Store size={12} color={COLORS.warning} />
                <Text style={styles.snoozedText}>
                  Snoozed until {new Date(alert.snoozedUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            )}

            <View style={styles.expandedActions}>
              {alert.actionRoute && (
                <TouchableOpacity
                  style={[styles.viewDetailsBtn, { borderColor: `${color}50` }]}
                  onPress={() => handleNavigateToAlert(alert)}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={14} color={color} />
                  <Text style={[styles.viewDetailsBtnText, { color }]}>
                    {alert.actionLabel || 'View Details'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleSnooze(alert.id)}
                activeOpacity={0.7}
              >
                <Store size={16} color={COLORS.beigeWarm} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDismiss(alert.id)}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0, 31, 63, 0.98)', 'rgba(0, 61, 92, 0.95)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Bell size={24} color={COLORS.goldAccent} />
            <Text style={styles.headerTitle}>Alerts</Text>
            {summary.totalActive > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{summary.totalActive}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'active', 'dismissed'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' 
                  ? `All (${alerts.length})` 
                  : f === 'active' 
                  ? `Active (${summary.totalActive})` 
                  : `Dismissed (${dismissedCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={styles.bulkActionBtn}
            onPress={handleMarkAllAsRead}
            activeOpacity={0.7}
          >
            <Check size={16} color={COLORS.beigeWarm} />
            <Text style={styles.bulkActionText}>Mark All Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkActionBtn}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={COLORS.error} />
            <Text style={[styles.bulkActionText, { color: COLORS.error }]}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Bell size={48} color={COLORS.beigeWarm} />
              </View>
              <Text style={styles.emptyTitle}>No Alerts</Text>
              <Text style={styles.emptyText}>
                {filter === 'active' 
                  ? 'No active alerts at this time.' 
                  : filter === 'dismissed'
                  ? 'No dismissed alerts.'
                  : 'You have no alerts at this time.'}
              </Text>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {filteredAlerts.map(renderAlertItem)}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navyDeep,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  unreadBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.2)',
  },
  filterChipActive: {
    backgroundColor: COLORS.beigeWarm,
    borderColor: COLORS.beigeWarm,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  filterChipTextActive: {
    color: COLORS.navyDeep,
  },
  bulkActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.1)',
  },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
  },
  bulkActionText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  alertsList: {
    gap: SPACING.sm,
  },
  alertItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.15)',
    overflow: 'hidden',
  },
  alertItemRead: {
    opacity: 0.7,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  alertItemSnoozed: {
    borderColor: 'rgba(255, 152, 0, 0.3)',
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  alertItemExpanded: {
    borderColor: 'rgba(212, 165, 116, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  alertTouchable: {
    padding: SPACING.md,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  readToggle: {
    padding: SPACING.xs,
  },
  alertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
    flex: 1,
  },
  alertTitleRead: {
    color: 'rgba(255,255,255,0.7)',
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
    marginTop: 2,
  },
  expandedContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  expandedDivider: {
    height: 1,
    marginBottom: SPACING.md,
  },
  expandedMessage: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  dataPointsContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  dataPointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataPointLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
  },
  dataPointValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: '600' as const,
  },
  alertTime: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: SPACING.sm,
  },
  snoozedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  snoozedText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.warning,
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  viewDetailsBtnText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});
