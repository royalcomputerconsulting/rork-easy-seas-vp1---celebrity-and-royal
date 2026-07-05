import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, ExternalLink, Ship as ShipIcon, Sparkles } from 'lucide-react-native';

import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatDate, getDaysUntil } from '@/lib/date';
import { openCertificatePdf } from '@/lib/royalCaribbean/certificatePdf';
import { trpc } from '@/lib/trpc';
import { useCoreData } from '@/state/CoreDataProvider';

function normalizeText(value?: string | null): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatCurrency(value: number | null): string {
  if (value == null) return null as unknown as string;
  return `$${value.toLocaleString()}`;
}

export default function CertificateCodeDetailScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string; type?: string }>();
  const { bookedCruises, cruises } = useCoreData();

  const certificateCode = String(code ?? '').toUpperCase();

  // The official PDF server is always up, so a failed attempt almost always
  // means a transient blip - keep retrying automatically with backoff before
  // ever showing the user a "couldn't load" state.
  const query = trpc.certificateExplorer.codeSailings.useQuery(
    { certificateCode },
    {
      enabled: certificateCode.length >= 6,
      retry: 5,
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 20000),
    }
  );
  const isRetrying = query.isError && query.isFetching;
  const retryAttempt = query.failureCount;

  const bookedLookup = useMemo(() => {
    const set = new Set<string>();
    [...bookedCruises, ...cruises].forEach((cruise) => {
      if (!cruise?.shipName || !cruise?.sailDate) return;
      const key = `${normalizeText(cruise.shipName)}__${normalizeText(cruise.sailDate).slice(0, 10)}`;
      set.add(key);
    });
    return set;
  }, [bookedCruises, cruises]);

  const isBooked = useCallback((shipName: string, sailDate: string) => {
    const normalizedShip = normalizeText(shipName);
    for (const key of bookedLookup) {
      const [ship] = key.split('__');
      if (ship === normalizedShip && key.includes(sailDate.slice(0, 10))) return true;
    }
    return bookedLookup.has(`${normalizedShip}__${sailDate}`);
  }, [bookedLookup]);

  const handleOpenPdf = useCallback(() => {
    if (query.data?.pdfUrl) {
      void openCertificatePdf(query.data.pdfUrl);
    }
  }, [query.data?.pdfUrl]);

  const sailings = query.data?.sailings ?? [];

  const renderItem = useCallback(({ item }: { item: (typeof sailings)[number] }) => {
    const booked = isBooked(item.shipName, item.sailDate);
    const daysUntilSail = getDaysUntil(item.sailDate);
    const sailingSoon = daysUntilSail >= 0 && daysUntilSail <= 45;

    return (
      <View style={styles.resultCard} testID={`certificate-code-detail.result-${item.shipName}-${item.sailDate}`}>
        <View style={styles.resultHeader}>
          <View style={styles.resultHeaderText}>
            <View style={styles.resultShipRow}>
              <ShipIcon size={14} color={COLORS.navyDeep} />
              <Text style={styles.resultShip}>{item.shipName}</Text>
            </View>
            <Text style={styles.resultDate}>{formatDate(item.sailDate, 'medium')}</Text>
            {item.departurePort ? <Text style={styles.resultPort}>from {item.departurePort}</Text> : null}
          </View>
          <View style={styles.badgeColumn}>
            {booked ? (
              <View style={styles.bookedBadge}>
                <Text style={styles.bookedBadgeText}>You're booked</Text>
              </View>
            ) : null}
            {sailingSoon ? (
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>{daysUntilSail}d out</Text>
              </View>
            ) : null}
          </View>
        </View>

        {item.itinerary ? <Text style={styles.itineraryText}>{item.itinerary}</Text> : null}

        <View style={styles.benefitRow}>
          {item.cabinLabel ? (
            <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{item.cabinLabel}</Text></View>
          ) : null}
          {item.offerTypeLabel ? (
            <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{item.offerTypeLabel}</Text></View>
          ) : null}
          {item.freePlay != null ? (
            <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{formatCurrency(item.freePlay)} FP</Text></View>
          ) : null}
          {item.onBoardCredit != null ? (
            <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{formatCurrency(item.onBoardCredit)} OBC</Text></View>
          ) : null}
        </View>

        {item.nextCruiseBonusLabel ? (
          <Text style={styles.bonusText}>Next cruise bonus: {item.nextCruiseBonusLabel}</Text>
        ) : null}
      </View>
    );
  }, [isBooked]);

  const points = query.data?.points ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#10223A', '#183C63', '#0E7FA7']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-code-detail.back-button">
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerIconWrap}>
            <Sparkles size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.headerEyebrow}>Offer code</Text>
        <Text style={styles.headerTitle}>{certificateCode || 'Certificate'}</Text>
        <Text style={styles.headerSubtitle}>
          {points != null ? `${points.toLocaleString()} points — ` : ''}All eligible sailings scraped from this offer's official document, so you can evaluate every one.
        </Text>

        {query.data?.pdfUrl ? (
          <TouchableOpacity style={styles.pdfHeaderButton} onPress={handleOpenPdf} activeOpacity={0.85} testID="certificate-code-detail.open-pdf">
            <ExternalLink size={13} color="#FFFFFF" />
            <Text style={styles.pdfHeaderButtonText}>View official PDF</Text>
          </TouchableOpacity>
        ) : null}
      </LinearGradient>

      <FlatList
        data={sailings}
        keyExtractor={(item) => `${item.shipName}-${item.sailDate}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          query.data ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Sailings found</Text>
                <Text style={styles.summaryChipValue}>{sailings.length}</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Booked matches</Text>
                <Text style={styles.summaryChipValue}>{sailings.filter((s) => isBooked(s.shipName, s.sailDate)).length}</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          query.isLoading || isRetrying ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.navyDeep} />
              <Text style={styles.loadingText}>
                {isRetrying
                  ? `Still working — retrying ${certificateCode}'s document (attempt ${retryAttempt + 1})…`
                  : `Pulling ${certificateCode}'s official offer document…`}
              </Text>
            </View>
          ) : query.isError ? (
            <View style={styles.emptyState} testID="certificate-code-detail.error-state">
              <AlertTriangle size={22} color="#DC2626" style={{ marginBottom: SPACING.sm }} />
              <Text style={styles.emptyStateTitle}>Taking longer than usual</Text>
              <Text style={styles.emptyStateText}>The official document is still downloading in the background. Tap below to try again.</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => query.refetch()}
                activeOpacity={0.85}
                testID="certificate-code-detail.retry-button"
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : query.data && query.data.status === 'empty' ? (
            <View style={styles.emptyState} testID="certificate-code-detail.no-pdf-state">
              <Text style={styles.emptyStateTitle}>No document published for {certificateCode}</Text>
              <Text style={styles.emptyStateText}>This offer code isn't live yet, or Royal Caribbean hasn't published it for this month. Check back later.</Text>
            </View>
          ) : query.data ? (
            <View style={styles.emptyState} testID="certificate-code-detail.no-sailings-state">
              <Text style={styles.emptyStateTitle}>No sailings parsed yet</Text>
              <Text style={styles.emptyStateText}>The document loaded, but no eligible sailings could be read from it. Try the official PDF above.</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CLEAN_THEME.background.secondary,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.md : 0,
    paddingBottom: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  pdfHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
  },
  pdfHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#EAF1F9',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D6E3F2',
  },
  summaryChipLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginBottom: 2,
  },
  summaryChipValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.md,
    marginBottom: SPACING.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  resultShip: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  resultDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  resultPort: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.muted,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bookedBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  bookedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  soonBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  soonBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  itineraryText: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  benefitChip: {
    backgroundColor: '#F8FBFF',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D9E5F3',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  benefitChipText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  bonusText: {
    color: '#8A5D00',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginTop: SPACING.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  emptyStateTitle: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
