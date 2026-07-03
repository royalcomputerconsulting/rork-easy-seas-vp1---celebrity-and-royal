import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, XCircle } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { CertificateExpirationResult, CertificateExpirationSeverity } from '@/lib/certificates/expiration';

type CertificateExpirationBadgeProps = {
  result: CertificateExpirationResult;
  compact?: boolean;
};

function getSeverityStyle(severity: CertificateExpirationSeverity) {
  switch (severity) {
    case 'green':
      return { color: COLORS.success, backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.28)' };
    case 'yellow':
      return { color: COLORS.goldDark, backgroundColor: 'rgba(212, 160, 10, 0.14)', borderColor: 'rgba(212, 160, 10, 0.32)' };
    case 'orange':
      return { color: COLORS.warning, backgroundColor: 'rgba(245, 158, 11, 0.16)', borderColor: 'rgba(245, 158, 11, 0.36)' };
    case 'red':
      return { color: COLORS.error, backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.30)' };
    case 'gray':
    default:
      return { color: COLORS.textSecondary, backgroundColor: COLORS.bgTertiary, borderColor: COLORS.borderLight };
  }
}

function StatusIcon({ result, color }: { result: CertificateExpirationResult; color: string }) {
  const size = 14;
  if (result.status === 'valid') return <CheckCircle2 size={size} color={color} />;
  if (result.status === 'expired') return <XCircle size={size} color={color} />;
  if (result.status === 'urgent' || result.status === 'expires-today') return <AlertTriangle size={size} color={color} />;
  if (result.status === 'expiring-soon') return <Clock3 size={size} color={color} />;
  return <CalendarClock size={size} color={color} />;
}

export function CertificateExpirationBadge({ result, compact = false }: CertificateExpirationBadgeProps) {
  const safeResult: CertificateExpirationResult = result ?? {
    status: 'unknown',
    daysRemaining: null,
    expirationDate: null,
    sourceField: null,
    message: 'Expiration unknown. Add redeem-by or expiration date.',
    badgeLabel: 'Expiration unknown',
    severity: 'gray',
    sortPriority: 5,
    warnings: ['No certificate expiration result provided.'],
  };
  const severityStyle = getSeverityStyle(safeResult.severity);

  return (
    <View
      style={[
        styles.container,
        compact && styles.compactContainer,
        { backgroundColor: severityStyle.backgroundColor, borderColor: severityStyle.borderColor },
      ]}
      testID="certificate-expiration-badge"
    >
      <View style={styles.badgeRow}>
        <StatusIcon result={safeResult} color={severityStyle.color} />
        <Text style={[styles.badgeLabel, { color: severityStyle.color }]} numberOfLines={1}>
          {safeResult.badgeLabel}
        </Text>
      </View>
      {!compact && (
        <View style={styles.expandedContent}>
          <Text style={styles.message}>{safeResult.message}</Text>
          {safeResult.expirationDate && (
            <Text style={styles.metaText}>Expires: {safeResult.expirationDate}</Text>
          )}
          {safeResult.warnings.length > 0 && (
            <Text style={styles.warningText}>{safeResult.warnings[0]}</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default CertificateExpirationBadge;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  compactContainer: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  expandedContent: {
    gap: 3,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textLabel,
  },
  warningText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.warning,
    lineHeight: 16,
  },
});
