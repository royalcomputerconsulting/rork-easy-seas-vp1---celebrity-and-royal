import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react-native';
import { getOfficialVoyageAlerts } from '@/lib/noaaVoyageAlerts';
import type { SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export function OfficialVoyageAlerts({ cruise, refreshToken = 0 }: { cruise: SailingWeatherCruiseInput; refreshToken?: number }) {
  const query = useQuery({
    queryKey: ['official-voyage-alerts', cruise.id, cruise.sailDate, cruise.returnDate, refreshToken],
    queryFn: () => getOfficialVoyageAlerts(cruise, { force: refreshToken > 0 }),
    staleTime: FOUR_HOURS,
    gcTime: 24 * 60 * 60 * 1000,
    refetchInterval: FOUR_HOURS,
    refetchOnMount: 'always',
    retry: 1,
  });
  const snapshot = query.data;
  const alerts = snapshot?.alerts ?? [];
  const urgent = alerts.some((alert) => alert.severity === 'warning');

  return <View style={[styles.root, urgent && styles.urgent]} testID={`official-voyage-alerts-${cruise.id}`}>
    <View style={styles.heading}>
      {urgent ? <AlertTriangle size={20} color="#fee2e2" /> : alerts.length ? <AlertTriangle size={20} color="#fef3c7" /> : <CheckCircle2 size={20} color="#a7f3d0" />}
      <View style={styles.headingCopy}><Text style={styles.title}>NOAA / NHC SAFETY ALERTS</Text><Text style={styles.subtitle}>Active official alerts plus every named tropical system within 1,500 miles of the verified voyage route.</Text></View>
    </View>
    {query.isLoading ? <View style={styles.loading}><ActivityIndicator color="#fff" /><Text style={styles.status}>Checking official sources…</Text></View> : null}
    {!query.isLoading && alerts.length === 0 ? <Text style={styles.clear}>No matching active NOAA/NWS alerts or NHC tropical systems were found at the last check.</Text> : null}
    {alerts.map((alert) => <TouchableOpacity key={alert.id} style={[styles.alert, alert.severity === 'warning' ? styles.warning : alert.severity === 'watch' ? styles.watch : styles.advisory]} disabled={!alert.url} onPress={() => alert.url ? void Linking.openURL(alert.url) : undefined}>
      <View style={styles.alertTop}><Text style={styles.source}>{alert.source} · {alert.severity.toUpperCase()}</Text>{alert.url ? <ExternalLink size={14} color="#fff" /> : null}</View>
      <Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.detail}>{alert.detail}</Text>
      <Text style={styles.issued}>Issued {new Date(alert.issuedAt).toLocaleString()}</Text>
    </TouchableOpacity>)}
    {snapshot ? <Text style={styles.status}>{snapshot.sourceStatus} · Last checked {new Date(snapshot.checkedAt).toLocaleString()}{snapshot.isStale ? ' · STALE/OFFLINE' : ''}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { borderRadius: 15, padding: 13, gap: 10, backgroundColor: '#063f47', borderWidth: 2, borderColor: '#2dd4bf' },
  urgent: { backgroundColor: '#7f1d1d', borderColor: '#fca5a5' },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, headingCopy: { flex: 1 },
  title: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: .5 }, subtitle: { color: '#d9f7f4', fontSize: 11, lineHeight: 16, marginTop: 2 },
  loading: { flexDirection: 'row', gap: 8, alignItems: 'center' }, clear: { color: '#d1fae5', fontWeight: '800', fontSize: 12, lineHeight: 18 },
  alert: { borderRadius: 11, padding: 11, borderWidth: 1, gap: 4 }, warning: { backgroundColor: '#991b1b', borderColor: '#fecaca' }, watch: { backgroundColor: '#92400e', borderColor: '#fde68a' }, advisory: { backgroundColor: '#164e63', borderColor: '#a5f3fc' },
  alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, source: { color: '#fff', fontWeight: '900', fontSize: 10 }, alertTitle: { color: '#fff', fontWeight: '900', fontSize: 15 }, detail: { color: '#fff', fontSize: 12, lineHeight: 17 }, issued: { color: 'rgba(255,255,255,.75)', fontSize: 10 }, status: { color: 'rgba(255,255,255,.72)', fontSize: 10, lineHeight: 15 },
});
