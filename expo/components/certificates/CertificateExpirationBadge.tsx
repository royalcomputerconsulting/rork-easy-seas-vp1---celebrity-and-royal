import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCertificateExpirationResult, type CertificateExpirationResult } from '@/lib/certificates/expiration';

type Props = { record?: Record<string, unknown>; result?: CertificateExpirationResult };

const COLORS: Record<CertificateExpirationResult['severity'], string> = {
  neutral: '#6B7280',
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  success: '#059669',
};

export function CertificateExpirationBadge({ record, result }: Props) {
  const resolved = result ?? getCertificateExpirationResult(record ?? {});
  const color = COLORS[resolved.severity];
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}12` }]}>
      <Text style={[styles.text, { color }]}>{resolved.badgeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
