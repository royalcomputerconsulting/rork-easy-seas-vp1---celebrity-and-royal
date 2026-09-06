import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { attributeOfferToCruise } from '@/lib/offers/offerAttribution';

export function OfferAttributionLedgerCard({ cruise }: { cruise: Record<string, unknown> }) {
  const attribution = attributeOfferToCruise(cruise);
  return <View style={styles.card}><Text style={styles.title}>Offer Attribution</Text><Text style={styles.body}>{attribution.offerCode ?? 'No offer code'} · {attribution.classification.offerType}</Text><Text style={styles.body}>Point cost: {attribution.pointCost.toLocaleString()}</Text></View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' }, title: { fontWeight: '800', color: '#123D73' }, body: { marginTop: 6, color: '#334155' } });
