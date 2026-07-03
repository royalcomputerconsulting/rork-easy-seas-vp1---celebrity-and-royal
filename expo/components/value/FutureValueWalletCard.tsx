import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FutureValueWallet } from '@/lib/value/futureValueWallet';

function money(value: number): string {
  return `$${Math.round(value || 0).toLocaleString()}`;
}

export function FutureValueWalletCard({ wallet }: { wallet: FutureValueWallet }) {
  const fccValue = wallet.futureCruiseCredits.reduce((sum, fcc) => sum + (fcc.status === 'expired' ? 0 : fcc.amountRemaining || 0), 0);
  const nextCruiseValue = wallet.nextCruiseCertificates.reduce((sum, cert) => sum + (cert.status === 'expired' || cert.status === 'cancelled' ? 0 : cert.confirmedValue ?? cert.estimatedValue ?? 0), 0);
  const annualValue = wallet.annualCruiseBenefits.reduce((sum, benefit) => sum + (benefit.status === 'expired' ? 0 : benefit.confirmedRetailValue ?? benefit.estimatedRetailValue ?? 0), 0);
  const crownAnchorValue = wallet.crownAnchorCertificates.reduce((sum, cert) => sum + (cert.status === 'expired' ? 0 : cert.confirmedValue ?? cert.estimatedValue ?? 0), 0);
  const total = fccValue + nextCruiseValue + annualValue + crownAnchorValue;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Future Value Wallet</Text>
      <Text style={styles.total}>{money(total)}</Text>
      <Text style={styles.subtitle}>Available, assigned, and expiring cruise value</Text>
      <View style={styles.row}><Text style={styles.label}>FCC remaining</Text><Text style={styles.value}>{money(fccValue)}</Text></View>
      <View style={styles.row}><Text style={styles.label}>NextCruise</Text><Text style={styles.value}>{money(nextCruiseValue)}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Club Royale annual cruises</Text><Text style={styles.value}>{money(annualValue)}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Crown & Anchor certificates</Text><Text style={styles.value}>{money(crownAnchorValue)}</Text></View>
      {wallet.expiringSoon.length > 0 ? <Text style={styles.warning}>{wallet.expiringSoon.length} item(s) expiring soon</Text> : null}
      {wallet.warnings.map((warning, index) => <Text key={index} style={styles.warning}>• {warning}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, backgroundColor: '#101828', marginVertical: 8 },
  title: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  total: { color: '#ffffff', fontWeight: '800', fontSize: 30, marginTop: 6 },
  subtitle: { color: '#cbd5e1', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  label: { color: '#cbd5e1' },
  value: { color: '#ffffff', fontWeight: '700' },
  warning: { color: '#fbbf24', marginTop: 6 },
});

export default FutureValueWalletCard;
