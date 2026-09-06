import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionCard } from '@/components/ui/ThemedSectionCard';
import { EasySeasSearchField, FilterButton, MetricGrid } from '@/components/ui/EasySeasPrimitives';
import { OfferCard } from '@/components/OfferCard';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useExperience } from '@/state/ExperienceProvider';
import { formatCurrency } from '@/lib/format';
import { getDaysUntil } from '@/lib/date';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildOfferDetailsParams } from '@/lib/offers/offerInstanceIdentity';
import type { CasinoOffer, Cruise } from '@/types/models';

/** Presentation-only Offers surface. Data, persistence, and actions remain owned by existing providers. */
export function OffersScreenV2() {
  const router = useRouter();
  const { colors } = useExperience();
  const { localData } = useAppState();
  const { cruises } = useCoreData();
  const { certificates } = useCertificates();
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const offers = useMemo(() => ((localData.offers || []) as CasinoOffer[]), [localData.offers]);
  const offerCruises = useMemo(() => (cruises as Cruise[]).filter((cruise) => Boolean(cruise.offerCode || cruise.offerName)), [cruises]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return offerCruises;
    return offerCruises.filter((cruise) => [cruise.offerCode, cruise.offerName, cruise.destination, cruise.shipName].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [offerCruises, query]);
  const activeCount = offers.length;
  const expiringCount = offers.filter((offer) => {
    const expiry = offer.expiryDate || offer.expires || offer.offerExpiryDate;
    return expiry ? getDaysUntil(expiry) >= 0 && getDaysUntil(expiry) <= 14 : false;
  }).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ResponsiveContainer>
        <View style={styles.header}>
          <Image source={require('../assets/images/easyseas-scott-astin-logo.jpeg')} style={styles.logo} resizeMode="cover" />
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Offers</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Exclusive savings for your next voyage</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications"><Bell size={22} color={colors.accent} /></Pressable>
        </View>
        <ThemedSectionCard tab="offers" emoji="🌊" title="Your offer portfolio" subtitle="Personalized savings, certificates, and casino rewards." compact>
          <MetricGrid columns={2} items={[{ label: 'Active offers', value: String(activeCount) }, { label: 'Expiring soon', value: String(expiringCount) }]} />
        </ThemedSectionCard>
        <View style={styles.controls}>
          <EasySeasSearchField value={query} onChangeText={setQuery} placeholder="Search offers or destinations" />
          <FilterButton activeCount={filterOpen ? 1 : 0} onPress={() => setFilterOpen((value) => !value)} label="Filters" testID="offers-v2-filter" />
        </View>
        <View style={styles.filterRow}>
          {['All offers', 'Onboard credit', 'Fare savings', 'Expiring'].map((label, index) => <Pressable key={label} style={[styles.filterChip, index === 0 && styles.filterChipActive]}><SlidersHorizontal size={14} color={index === 0 ? COLORS.white : colors.accent} /><Text style={[styles.filterChipText, index === 0 && styles.filterChipTextActive]}>{label}</Text></Pressable>)}
        </View>
        <ThemedSectionCard tab="offers" emoji="🎟️" title="Current offers" subtitle={`${filtered.length} eligible sailings`} compact>
          <FlatList data={filtered.slice(0, 12)} keyExtractor={(item, index) => `${item.id || item.offerCode || 'offer'}-${index}`} scrollEnabled={false} renderItem={({ item }) => <OfferCard offer={item} allCruises={filtered} compact showImage onPress={() => router.push({ pathname: '/offer-details', params: buildOfferDetailsParams(item) } as any)} />} ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No offers match your search.</Text>} />
        </ThemedSectionCard>
        <ThemedSectionCard tab="offers" emoji="🎰" title="Certificates & casino" subtitle="Stored rewards and casino activity." compact>
          <MetricGrid columns={3} items={[{ label: 'Certificates', value: String(certificates.length) }, { label: 'Offers', value: String(activeCount) }, { label: 'Cruises', value: String(filtered.length) }]} />
          <Pressable style={styles.sectionAction} onPress={() => router.push('/certificate-summary' as any)}><Text style={[styles.actionText, { color: colors.accent }]}>View details</Text><ChevronRight size={18} color={colors.accent} /></Pressable>
        </ThemedSectionCard>
        <ThemedSectionCard tab="offers" emoji="🕘" title="Recent activity" subtitle="Your latest offer and certificate updates." compact>
          <Text style={[styles.activity, { color: colors.muted }]}>Activity is sourced from your saved Easy Seas records.</Text>
        </ThemedSectionCard>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md }, logo: { width: 56, height: 56, borderRadius: 14 }, headerCopy: { flex: 1 }, title: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 30 }, subtitle: { fontSize: 14, marginTop: 2 }, controls: { gap: SPACING.sm, marginBottom: SPACING.sm }, filterRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md }, filterChip: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#D5D5D0', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#FFFFFF' }, filterChipActive: { backgroundColor: '#0E7FA7', borderColor: '#0E7FA7' }, filterChipText: { color: '#0E7FA7', fontSize: 11, textAlign: 'center' }, filterChipTextActive: { color: COLORS.white }, sectionAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: SPACING.sm }, actionText: { fontWeight: '600' }, empty: { paddingVertical: SPACING.lg, textAlign: 'center' }, activity: { paddingVertical: SPACING.sm },
});
