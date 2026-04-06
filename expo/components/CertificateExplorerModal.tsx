import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, ExternalLink, Search, Sparkles, X } from 'lucide-react-native';

import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { openCertificatePdf } from '@/lib/royalCaribbean/certificatePdf';
import { trpc } from '@/lib/trpc';

interface CertificateExplorerModalProps {
  visible: boolean;
  onClose: () => void;
}

function getDefaultMonthCode(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function formatPoints(value: number | null): string {
  if (value == null) {
    return 'Points unavailable';
  }

  return `${value.toLocaleString()} pts`;
}

function formatCurrency(value: number | null): string {
  if (value == null) {
    return 'Unavailable';
  }

  return `${value.toLocaleString()}`;
}

export function CertificateExplorerModal({ visible, onClose }: CertificateExplorerModalProps) {
  const [shipQuery, setShipQuery] = useState<string>('Star, Legend, Icon');
  const [sailDate, setSailDate] = useState<string>('');
  const [monthCode, setMonthCode] = useState<string>(getDefaultMonthCode());
  const [includeA, setIncludeA] = useState<boolean>(true);
  const [includeC, setIncludeC] = useState<boolean>(true);

  const examineMutation = trpc.certificateExplorer.examine.useMutation();

  const result = examineMutation.data;
  const hasResults = (result?.matches?.length ?? 0) > 0;
  const hasAttemptedSearch = examineMutation.isSuccess || examineMutation.isError;

  const summaryChips = useMemo(() => {
    if (!result) {
      return [] as Array<{ label: string; value: string }>;
    }

    return [
      { label: 'Month', value: result.monthCode },
      { label: 'Matched sailings', value: String(result.summary.matchedSailingCount) },
      { label: 'Certificate levels', value: String(result.summary.matchedCertificateCount) },
    ];
  }, [result]);

  const handleSearch = useCallback(async () => {
    const trimmedShipQuery = shipQuery.trim();
    const trimmedMonthCode = monthCode.trim();
    const trimmedSailDate = sailDate.trim();

    if (trimmedShipQuery.length < 2) {
      Alert.alert('Ship required', 'Enter a ship name or a short ship list to examine certificates.');
      return;
    }

    if (!includeA && !includeC) {
      Alert.alert('Choose a source', 'Turn on A, C, or both certificate sources before searching.');
      return;
    }

    if (!/^\d{4}$/.test(trimmedMonthCode)) {
      Alert.alert('Invalid month code', 'Use YYMM format like 2604.');
      return;
    }

    console.log('[CertificateExplorerModal] Starting certificate examination:', {
      shipQuery: trimmedShipQuery,
      sailDate: trimmedSailDate,
      monthCode: trimmedMonthCode,
      includeA,
      includeC,
    });

    try {
      await examineMutation.mutateAsync({
        shipQuery: trimmedShipQuery,
        sailDate: trimmedSailDate.length > 0 ? trimmedSailDate : undefined,
        monthCode: trimmedMonthCode,
        includeA,
        includeC,
      });
    } catch (error) {
      console.error('[CertificateExplorerModal] Certificate examination failed:', error);
      Alert.alert(
        'Search failed',
        error instanceof Error ? error.message : 'Unable to examine certificates right now.'
      );
    }
  }, [shipQuery, monthCode, sailDate, includeA, includeC, examineMutation]);

  const handleOpenPdf = useCallback((url: string) => {
    console.log('[CertificateExplorerModal] Opening certificate PDF:', url);
    void openCertificatePdf(url);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={['#10223A', '#183C63', '#0E7FA7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroIconWrap}>
                <Sparkles size={18} color="#FFFFFF" />
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} testID="certificate-explorer.close-button">
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroEyebrow}>Certificate intelligence</Text>
            <Text style={styles.heroTitle}>Examine Certificates</Text>
            <Text style={styles.heroSubtitle}>
              Search the certificate bank by ship or sailing date, then compare rooms, free play, and whether the next level is worth chasing.
            </Text>
          </LinearGradient>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Ship or ships</Text>
              <TextInput
                value={shipQuery}
                onChangeText={setShipQuery}
                placeholder="Star, Legend, Icon"
                placeholderTextColor={CLEAN_THEME.text.muted}
                style={styles.input}
                autoCapitalize="words"
                testID="certificate-explorer.ship-input"
              />

              <Text style={styles.fieldLabel}>Optional sailing date</Text>
              <View style={styles.inputWithIcon}>
                <CalendarDays size={16} color={CLEAN_THEME.text.muted} />
                <TextInput
                  value={sailDate}
                  onChangeText={setSailDate}
                  placeholder="2026-04-02 or Apr 2, 2026"
                  placeholderTextColor={CLEAN_THEME.text.muted}
                  style={styles.inputInline}
                  autoCapitalize="none"
                  testID="certificate-explorer.sail-date-input"
                />
              </View>

              <Text style={styles.fieldLabel}>Monthly code</Text>
              <TextInput
                value={monthCode}
                onChangeText={setMonthCode}
                placeholder="2604"
                placeholderTextColor={CLEAN_THEME.text.muted}
                style={styles.input}
                autoCapitalize="none"
                maxLength={4}
                testID="certificate-explorer.month-code-input"
              />

              <Text style={styles.fieldLabel}>Sources</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleChip, includeA && styles.toggleChipActive]}
                  onPress={() => setIncludeA((value) => !value)}
                  activeOpacity={0.8}
                  testID="certificate-explorer.toggle-a"
                >
                  <Text style={[styles.toggleChipText, includeA && styles.toggleChipTextActive]}>A Certificates</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleChip, includeC && styles.toggleChipActive]}
                  onPress={() => setIncludeC((value) => !value)}
                  activeOpacity={0.8}
                  testID="certificate-explorer.toggle-c"
                >
                  <Text style={[styles.toggleChipText, includeC && styles.toggleChipTextActive]}>C Certificates</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => void handleSearch()}
                activeOpacity={0.85}
                disabled={examineMutation.isPending}
                testID="certificate-explorer.search-button"
              >
                {examineMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Search size={18} color="#FFFFFF" />
                )}
                <Text style={styles.searchButtonText}>
                  {examineMutation.isPending ? 'Examining certificates…' : 'Search certificate bank'}
                </Text>
              </TouchableOpacity>
            </View>

            {summaryChips.length > 0 ? (
              <View style={styles.summaryRow}>
                {summaryChips.map((chip) => (
                  <View key={chip.label} style={styles.summaryChip}>
                    <Text style={styles.summaryChipLabel}>{chip.label}</Text>
                    <Text style={styles.summaryChipValue}>{chip.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {hasResults
              ? result?.matches.map((match) => (
                  <View
                    key={`${match.shipName}-${match.sailDate}`}
                    style={styles.resultCard}
                    testID={`certificate-explorer.result-${match.shipName}-${match.sailDate}`}
                  >
                    <View style={styles.resultHeader}>
                      <View style={styles.resultHeaderText}>
                        <Text style={styles.resultShip}>{match.shipName}</Text>
                        <Text style={styles.resultDate}>{formatDate(match.sailDate, 'medium')}</Text>
                      </View>
                      <View style={styles.matchCountBadge}>
                        <Text style={styles.matchCountBadgeText}>{match.levels.length} levels</Text>
                      </View>
                    </View>

                    {match.decisionGuide.length > 0 ? (
                      <View style={styles.insightCard}>
                        <Text style={styles.insightTitle}>Decision guide</Text>
                        {match.decisionGuide.map((step, stepIndex) => (
                          <Text
                            key={`${match.shipName}-${match.sailDate}-guide-${stepIndex}`}
                            style={styles.insightText}
                          >
                            • {step}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.levelsList}>
                      {match.levels.map((level) => (
                        <View key={`${level.certificateCode}-${level.pdfUrl}`} style={styles.levelRow}>
                          <View style={styles.levelContent}>
                            <View style={styles.levelTopRow}>
                              <View style={styles.levelPill}>
                                <Text style={styles.levelPillText}>{level.certificateCode}</Text>
                              </View>
                              <Text style={styles.levelPoints}>{formatPoints(level.points)}</Text>
                            </View>
                            <Text style={styles.levelMeta}>
                              {level.certificateType} source · level {level.level}
                            </Text>
                            {level.benefitSummary.length > 0 ? (
                              <View style={styles.benefitChipRow}>
                                {level.cabinLabel ? (
                                  <View style={styles.benefitChip}>
                                    <Text style={styles.benefitChipText}>{level.cabinLabel}</Text>
                                  </View>
                                ) : null}
                                {level.freePlay !== null ? (
                                  <View style={styles.benefitChip}>
                                    <Text style={styles.benefitChipText}>{formatCurrency(level.freePlay)} FP</Text>
                                  </View>
                                ) : null}
                                {level.onBoardCredit !== null ? (
                                  <View style={styles.benefitChip}>
                                    <Text style={styles.benefitChipText}>{formatCurrency(level.onBoardCredit)} OBC</Text>
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.levelActions}>
                            <TouchableOpacity
                              style={styles.secondaryAction}
                              onPress={() => handleOpenPdf(level.monthlyIndexUrl)}
                              activeOpacity={0.8}
                              testID={`certificate-explorer.open-index-${level.certificateCode}`}
                            >
                              <Text style={styles.secondaryActionText}>Index</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.primaryAction}
                              onPress={() => handleOpenPdf(level.pdfUrl)}
                              activeOpacity={0.8}
                              testID={`certificate-explorer.open-pdf-${level.certificateCode}`}
                            >
                              <ExternalLink size={14} color="#FFFFFF" />
                              <Text style={styles.primaryActionText}>PDF</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>

                    {match.opportunities.length > 0 ? (
                      <View style={styles.opportunityCard}>
                        <Text style={styles.opportunityTitle}>Point jump opportunities</Text>
                        {match.opportunities.map((opportunity) => (
                          <Text
                            key={`${opportunity.fromCode}-${opportunity.toCode}`}
                            style={styles.opportunityText}
                          >
                            • {opportunity.summary}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              : null}

            {hasAttemptedSearch && !hasResults && !examineMutation.isPending ? (
              <View style={styles.emptyState} testID="certificate-explorer.empty-state">
                <Text style={styles.emptyStateTitle}>No matching certificate sailings found</Text>
                <Text style={styles.emptyStateText}>
                  Try a different ship name, remove the sail date, or switch the month code to another certificate cycle.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 11, 20, 0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: CLEAN_THEME.background.secondary,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
  },
  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    maxWidth: 320,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.md,
  },
  formCard: {
    backgroundColor: CLEAN_THEME.background.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.card,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    paddingHorizontal: SPACING.md,
  },
  inputInline: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  toggleChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.medium,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.primary,
  },
  toggleChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  toggleChipText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  toggleChipTextActive: {
    color: '#FFFFFF',
  },
  searchButton: {
    marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.navyDeep,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#EAF1F9',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
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
    ...SHADOW.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultShip: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 2,
  },
  resultDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  matchCountBadge: {
    backgroundColor: '#EDF5FF',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  matchCountBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelsList: {
    gap: SPACING.sm,
  },
  levelRow: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E7EEF8',
    backgroundColor: '#F8FBFF',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  levelContent: {
    gap: 6,
  },
  levelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  levelPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D9E5F3',
  },
  levelPillText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelPoints: {
    color: '#0E7FA7',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelMeta: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  benefitChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  benefitChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D9E5F3',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  benefitChipText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  secondaryAction: {
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.medium,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  secondaryActionText: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  primaryAction: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.navyDeep,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  insightCard: {
    backgroundColor: '#F6FAFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D8E7F6',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  insightTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  insightText: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  opportunityCard: {
    backgroundColor: '#FFF9ED',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#F4D9A7',
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  opportunityTitle: {
    color: '#8A5A00',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  opportunityText: {
    color: '#7A5C1F',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    alignItems: 'center',
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
});
