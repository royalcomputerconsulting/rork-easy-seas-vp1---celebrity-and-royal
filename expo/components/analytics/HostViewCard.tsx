import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { buildHostViewProfile, type HostViewProfile } from '@/lib/analytics/hostView';

type Props = { profile?: HostViewProfile; cruises?: Parameters<typeof buildHostViewProfile>[0]['cruises']; sessions?: Parameters<typeof buildHostViewProfile>[0]['sessions']; onCopySummary?: (summary: string) => void };

export function HostViewCard({ profile, cruises, sessions, onCopySummary }: Props) {
  const resolved = profile ?? buildHostViewProfile({ cruises, sessions });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Host View</Text>
      <Text style={styles.metric}>{resolved.points.toLocaleString()} pts · ${Math.round(resolved.coinIn).toLocaleString()} coin-in</Text>
      <Text style={styles.body}>{resolved.copySummary}</Text>
      {resolved.talkingPoints.slice(0, 3).map(point => <Text key={point} style={styles.point}>• {point}</Text>)}
      {onCopySummary ? <TouchableOpacity style={styles.button} onPress={() => onCopySummary(resolved.copySummary)}><Text style={styles.buttonText}>Copy Host Summary</Text></TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' },
  title: { fontSize: 16, fontWeight: '800', color: '#123D73' },
  metric: { marginTop: 8, fontSize: 15, fontWeight: '800', color: '#1557C7' },
  body: { marginTop: 6, color: '#334155' },
  point: { marginTop: 4, color: '#475569' },
  button: { marginTop: 12, backgroundColor: '#1557C7', padding: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
