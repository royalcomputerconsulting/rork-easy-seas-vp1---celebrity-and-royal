import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { linkCertificateToEarningCruise } from '@/lib/casino/certificateEarningChain';

export function CertificateCreatedByPlayCard(props: Parameters<typeof linkCertificateToEarningCruise>[0]) {
  const result = linkCertificateToEarningCruise(props);
  return <View style={styles.card}><Text style={styles.title}>Certificate Created By Play</Text><Text style={styles.body}>{result.certificateCode ?? 'No certificate code'} · {result.confidence} confidence</Text></View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' }, title: { fontWeight: '800', color: '#123D73' }, body: { marginTop: 6, color: '#334155' } });
