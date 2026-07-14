import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  Settings,
  Calendar,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';
import { useBankroll, type AlertLevel } from '@/state/BankrollProvider';

interface BankrollManagementCardProps {
  compact?: boolean;
  showAlerts?: boolean;
}

export function BankrollManagementCard({
  compact = false,
  showAlerts = true,
}: BankrollManagementCardProps) {
  const {
    alerts,
    getBankrollStats,
    checkAndTriggerAlerts,
    dismissAlert,
    clearAllAlerts,
  } = useBankroll();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const stats = useMemo(() => getBankrollStats(), [getBankrollStats]);

  useEffect(() => {
    checkAndTriggerAlerts();
  }, [checkAndTriggerAlerts]);

  const getAlertColor = (level: AlertLevel): string => {
    switch (level) {
      case 'critical':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getAlertIcon = (level: AlertLevel) => {
    switch (level) {
      case 'critical':
        return XCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return CheckCircle;
      default:
        return AlertTriangle;
    }
  };

  const getProgressColor = (percentUsed: number): string => {
    if (percentUsed >= 90) return '#EF4444';
    if (percentUsed >= 75) return '#F59E0B';
    if (percentUsed >= 50) return '#F59E0B';
    return '#10B981';
  };

  const getProgressPercentage = (spent: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((spent / limit) * 100, 100);
  };

  const handleDismissAlert = (alertId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    dismissAlert(alertId);
  };

  const handleClearAllAlerts = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    clearAllAlerts();
  };

  const dailyPercent = getProgressPercentage(stats.dailySpent, stats.dailyLimit);
  const weeklyPercent = getProgressPercentage(stats.weeklySpent, stats.weeklyLimit);
  const monthlyPercent = getProgressPercentage(stats.monthlySpent, stats.monthlyLimit);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <DollarSign size={16} color="#EF4444" />
          <Text style={styles.compactTitle}>Bankroll</Text>
          {alerts.length > 0 && (
            <View style={[styles.compactAlertBadge, { backgroundColor: getAlertColor(alerts[0].level) }]}>
              <Text style={styles.compactAlertText}>{alerts.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactLabel}>Daily Remaining</Text>
          <Text style={[styles.compactValue, { color: getProgressColor(dailyPercent) }]}>
            {formatCurrency(stats.dailyRemaining)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FEE2E2', '#FECACA']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <DollarSign size={20} color="#DC2626" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Bankroll Management</Text>
            <Text style={styles.headerSubtitle}>Track your limits and spending</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
          activeOpacity={0.7}
        >
          <Settings size={20} color="#DC2626" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.content}>
        {showAlerts && alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.alertsHeader}>
              <Text style={styles.alertsHeaderText}>Active Alerts ({alerts.length})</Text>
              <TouchableOpacity onPress={handleClearAllAlerts} activeOpacity={0.7}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            {alerts.slice(0, 3).map((alert) => {
              const AlertIcon = getAlertIcon(alert.level);
              const alertColor = getAlertColor(alert.level);
              
              return (
                <View
                  key={alert.id}
                  style={[styles.alertCard, { borderLeftColor: alertColor }]}
                >
                  <AlertIcon size={18} color={alertColor} />
                  <Text style={[styles.alertMessage, { color: alertColor }]}>
                    {alert.message}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDismissAlert(alert.id)}
                    style={styles.dismissButton}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={alertColor} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.limitsSection}>
          <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.limitTitle}>Daily Limit</Text>
            </View>
            <View style={styles.limitStats}>
              <View>
                <Text style={styles.limitAmount}>{formatCurrency(stats.dailySpent)}</Text>
                <Text style={styles.limitLabel}>of {formatCurrency(stats.dailyLimit)}</Text>
              </View>
              <View style={styles.limitRemaining}>
                <Text style={[styles.remainingValue, { color: getProgressColor(dailyPercent) }]}>
                  {formatCurrency(stats.dailyRemaining)}
                </Text>
                <Text style={styles.remainingLabel}>Remaining</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${dailyPercent}%`,
                    backgroundColor: getProgressColor(dailyPercent),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{dailyPercent.toFixed(0)}% used</Text>
          </View>

          <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.limitTitle}>Weekly Limit</Text>
            </View>
            <View style={styles.limitStats}>
              <View>
                <Text style={styles.limitAmount}>{formatCurrency(stats.weeklySpent)}</Text>
                <Text style={styles.limitLabel}>of {formatCurrency(stats.weeklyLimit)}</Text>
              </View>
              <View style={styles.limitRemaining}>
                <Text style={[styles.remainingValue, { color: getProgressColor(weeklyPercent) }]}>
                  {formatCurrency(stats.weeklyRemaining)}
                </Text>
                <Text style={styles.remainingLabel}>Remaining</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${weeklyPercent}%`,
                    backgroundColor: getProgressColor(weeklyPercent),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{weeklyPercent.toFixed(0)}% used</Text>
          </View>

          <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.limitTitle}>Monthly Limit</Text>
            </View>
            <View style={styles.limitStats}>
              <View>
                <Text style={styles.limitAmount}>{formatCurrency(stats.monthlySpent)}</Text>
                <Text style={styles.limitLabel}>of {formatCurrency(stats.monthlyLimit)}</Text>
              </View>
              <View style={styles.limitRemaining}>
                <Text style={[styles.remainingValue, { color: getProgressColor(monthlyPercent) }]}>
                  {formatCurrency(stats.monthlyRemaining)}
                </Text>
                <Text style={styles.remainingLabel}>Remaining</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${monthlyPercent}%`,
                    backgroundColor: getProgressColor(monthlyPercent),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{monthlyPercent.toFixed(0)}% used</Text>
          </View>
        </View>

        <View style={styles.helpSection}>
          <TrendingDown size={16} color="#DC2626" />
          <Text style={styles.helpText}>
            Loss amounts are calculated from your session data. Set limits to help manage your gambling budget responsibly.
          </Text>
        </View>
      </View>

      <BankrollSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </View>
  );
}

function BankrollSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { limits, setLimit, updateLimit } = useBankroll();
  
  const [dailyLimit, setDailyLimit] = useState('');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [dailyWarning, setDailyWarning] = useState('75');
  const [dailyCritical, setDailyCritical] = useState('90');

  useEffect(() => {
    if (visible) {
      const daily = limits.find(l => l.type === 'daily');
      const weekly = limits.find(l => l.type === 'weekly');
      const monthly = limits.find(l => l.type === 'monthly');
      
      setDailyLimit(daily?.amount.toString() || '500');
      setWeeklyLimit(weekly?.amount.toString() || '2000');
      setMonthlyLimit(monthly?.amount.toString() || '5000');
      setDailyWarning(daily?.alertThresholds.warning.toString() || '75');
      setDailyCritical(daily?.alertThresholds.critical.toString() || '90');
    }
  }, [visible, limits]);

  const handleSave = async () => {
    const dailyAmount = parseFloat(dailyLimit) || 500;
    const weeklyAmount = parseFloat(weeklyLimit) || 2000;
    const monthlyAmount = parseFloat(monthlyLimit) || 5000;
    const warningThreshold = parseFloat(dailyWarning) || 75;
    const criticalThreshold = parseFloat(dailyCritical) || 90;

    await setLimit('daily', dailyAmount);
    await setLimit('weekly', weeklyAmount);
    await setLimit('monthly', monthlyAmount);

    const dailyLimitObj = limits.find(l => l.type === 'daily');
    if (dailyLimitObj) {
      await updateLimit(dailyLimitObj.id, {
        alertThresholds: {
          warning: warningThreshold,
          critical: criticalThreshold,
        },
      });
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bankroll Settings</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <X size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Daily Limit ($)</Text>
              <TextInput
                style={styles.input}
                value={dailyLimit}
                onChangeText={setDailyLimit}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weekly Limit ($)</Text>
              <TextInput
                style={styles.input}
                value={weeklyLimit}
                onChangeText={setWeeklyLimit}
                keyboardType="numeric"
                placeholder="2000"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monthly Limit ($)</Text>
              <TextInput
                style={styles.input}
                value={monthlyLimit}
                onChangeText={setMonthlyLimit}
                keyboardType="numeric"
                placeholder="5000"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Alert Thresholds</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Warning Threshold (%)</Text>
              <TextInput
                style={styles.input}
                value={dailyWarning}
                onChangeText={setDailyWarning}
                keyboardType="numeric"
                placeholder="75"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Critical Threshold (%)</Text>
              <TextInput
                style={styles.input}
                value={dailyCritical}
                onChangeText={setDailyCritical}
                keyboardType="numeric"
                placeholder="90"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF5F5',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#DC2626',
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#B91C1C',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
  },
  alertsSection: {
    marginBottom: SPACING.md,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  alertsHeaderText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#DC2626',
  },
  clearAllText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    marginBottom: SPACING.xs,
    ...SHADOW.sm,
  },
  alertMessage: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  dismissButton: {
    padding: 4,
  },
  limitsSection: {
    gap: SPACING.md,
  },
  limitCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  limitTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#374151',
  },
  limitStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  limitAmount: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#DC2626',
  },
  limitLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 2,
  },
  limitRemaining: {
    alignItems: 'flex-end',
  },
  remainingValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  remainingLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    textAlign: 'right',
  },
  helpSection: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.1)',
  },
  helpText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#DC2626',
    lineHeight: 16,
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#DC2626',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flex: 1,
  },
  compactAlertBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  compactAlertText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  compactContent: {
    gap: 2,
  },
  compactLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  compactValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  modalContent: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#374151',
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#374151',
    marginBottom: SPACING.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
