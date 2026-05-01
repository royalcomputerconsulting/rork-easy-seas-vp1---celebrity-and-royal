import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Archive,
  Bot,
  Calculator,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Ticket,
  X,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useAgentX } from '@/state/AgentXProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { AgentXChat } from '@/components/AgentXChat';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { filterRecordsByIntelligence, getRecordOwnerLabel } from '@/lib/intelligenceFilters';
import {
  buildWarRoomBuckets,
  decodeOffer,
  getOfferDisplayCode,
  getOfferDisplayName,
  type DecodedOffer,
  type WarRoomBucket,
  type WarRoomOffer,
} from '@/lib/offerIntelligence';
import { formatCurrency } from '@/lib/format';
import { getDaysUntil } from '@/lib/date';
import type { CasinoOffer, TravelerProfile } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';

type CertificateReviewBucketId = 'cert7' | 'cert14' | 'cert30' | 'certExpired' | 'certReview';

type CertificateReviewItem = Certificate & {
  ownerProfileId?: string;
  sourceEmail?: string;
  casinoProgram?: string;
  offerCode?: string;
  cabinEntitlement?: string;
  importStatus?: string;
  reconciliationStatus?: string;
};

interface CertificateReviewBucket {
  id: CertificateReviewBucketId;
  title: string;
  subtitle: string;
  certificates: CertificateReviewItem[];
}

function buildTravelerProfile(currentUser: ReturnType<typeof useUser>['currentUser']): Partial<TravelerProfile> | null {
  if (!currentUser) return null;
  return {
    id: currentUser.id,
    displayName: currentUser.displayName || currentUser.name,
    email: currentUser.email,
    royalCaribbeanNumber: currentUser.royalCaribbeanNumber || currentUser.crownAnchorNumber,
    clubRoyaleId: currentUser.clubRoyaleId,
    celebrityCaptainsClubNumber: currentUser.celebrityCaptainsClubNumber,
    blueChipId: currentUser.blueChipId,
    active: currentUser.active,
    defaultProfile: currentUser.defaultProfile,
    createdAt: currentUser.createdAt,
    updatedAt: currentUser.updatedAt,
  };
}

function buildCertificateBuckets(certificates: CertificateReviewItem[]): CertificateReviewBucket[] {
  const buckets: CertificateReviewBucket[] = [
    { id: 'cert7', title: 'Certificates expiring in 7 days', subtitle: 'Use, verify, or intentionally pass.', certificates: [] },
    { id: 'cert14', title: 'Certificates expiring in 14 days', subtitle: 'Strong review window for linked sailings.', certificates: [] },
    { id: 'cert30', title: 'Certificates expiring in 30 days', subtitle: 'Plan before the booking window closes.', certificates: [] },
    { id: 'certExpired', title: 'Recently expired certificates', subtitle: 'Keep for history or mark expired.', certificates: [] },
    { id: 'certReview', title: 'Certificate records needing review', subtitle: 'Missing expiration, owner, or import confidence.', certificates: [] },
  ];

  certificates.forEach((certificate) => {
    if (certificate.status === 'used') return;
    const days = certificate.expiryDate ? getDaysUntil(certificate.expiryDate) : null;
    if (certificate.importStatus === 'reviewNeeded' || certificate.reconciliationStatus === 'reviewNeeded' || days === null) buckets[4].certificates.push(certificate);
    else if (days < 0 && days >= -30) buckets[3].certificates.push(certificate);
    else if (days >= 0 && days <= 7) buckets[0].certificates.push(certificate);
    else if (days <= 14) buckets[1].certificates.push(certificate);
    else if (days <= 30) buckets[2].certificates.push(certificate);
  });

  console.log('[WarRoom] Certificate buckets built:', buckets.map((bucket) => ({ id: bucket.id, count: bucket.certificates.length })));
  return buckets;
}

function getCertificateExpiryLabel(certificate: CertificateReviewItem): string {
  if (!certificate.expiryDate) return 'No expiration recorded';
  const days = getDaysUntil(certificate.expiryDate);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

export default function WarRoomScreen() {
  const router = useRouter();
  const { cruises, casinoOffers, updateCasinoOffer } = useCoreData();
  const { users, currentUser } = useUser();
  const { certificates, updateCertificate } = useCertificates();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    messages,
    isLoading: agentLoading,
    sendMessage,
    isVisible,
    setVisible,
    toggleExpanded,
    isExpanded,
    mode: agentMode,
    setMode: setAgentMode,
  } = useAgentX();
  const [decodedOffer, setDecodedOffer] = useState<DecodedOffer | null>(null);

  const filterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const filteredOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, filterSnapshot, users), [casinoOffers, filterSnapshot, users]);
  const filteredCruises = useMemo(() => filterRecordsByIntelligence(cruises, filterSnapshot, users), [cruises, filterSnapshot, users]);
  const filteredCertificates = useMemo(() => filterRecordsByIntelligence(certificates as CertificateReviewItem[], filterSnapshot, users), [certificates, filterSnapshot, users]);
  const travelerProfile = useMemo(() => buildTravelerProfile(currentUser), [currentUser]);
  const offerBuckets = useMemo((): WarRoomBucket[] => buildWarRoomBuckets(filteredOffers, filteredCruises, certificates, travelerProfile), [certificates, filteredCruises, filteredOffers, travelerProfile]);
  const certificateBuckets = useMemo(() => buildCertificateBuckets(filteredCertificates), [filteredCertificates]);
  const visibleOfferBuckets = useMemo(() => offerBuckets.filter((bucket) => bucket.offers.length > 0), [offerBuckets]);
  const visibleCertificateBuckets = useMemo(() => certificateBuckets.filter((bucket) => bucket.certificates.length > 0), [certificateBuckets]);
  const offerCount = useMemo(() => offerBuckets.reduce((sum, bucket) => sum + bucket.offers.length, 0), [offerBuckets]);
  const certificateCount = useMemo(() => certificateBuckets.reduce((sum, bucket) => sum + bucket.certificates.length, 0), [certificateBuckets]);

  const handleViewOffer = useCallback((offer: CasinoOffer) => {
    router.push(`/offer-details?offerCode=${encodeURIComponent(getOfferDisplayCode(offer))}` as any);
  }, [router]);

  const handleDecodeOffer = useCallback((offer: CasinoOffer) => {
    setDecodedOffer(decodeOffer(offer, filteredCruises, travelerProfile));
  }, [filteredCruises, travelerProfile]);

  const handleArchiveOffer = useCallback((offer: CasinoOffer) => {
    Alert.alert('Archive Offer', 'Hide this offer from active planning but keep it searchable in history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          updateCasinoOffer(offer.id, { status: 'archived', archiveStatus: 'archived', reconciliationStatus: 'matched' });
          console.log('[WarRoom] Archived offer:', { id: offer.id, offerCode: offer.offerCode });
        },
      },
    ]);
  }, [updateCasinoOffer]);

  const handleKeepActiveOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'active', archiveStatus: 'active', reconciliationStatus: 'matched' });
    console.log('[WarRoom] Kept offer active:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleRestoreOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'active', archiveStatus: 'active', reconciliationStatus: 'matched' });
    console.log('[WarRoom] Restored offer:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleSkipOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'skipped', archiveStatus: 'active', reconciliationStatus: 'matched' });
    console.log('[WarRoom] Marked offer skipped:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleAskAgentX = useCallback((offer: CasinoOffer) => {
    setAgentMode('casinoHost');
    setVisible(true);
    void sendMessage(`War Room review: advise me on offer ${getOfferDisplayCode(offer)}. Explain whether to view, decode, compare, keep active, archive, restore, or skip it using current profile, brand, and program filters.`);
  }, [sendMessage, setAgentMode, setVisible]);

  const handleCompareOffer = useCallback((offer: CasinoOffer) => {
    setAgentMode('travelAgent');
    setVisible(true);
    void sendMessage(`Compare offer ${getOfferDisplayCode(offer)} against my other urgent and active offers. Include Offer Intelligence Score, expiration urgency, owner profile, casino-paid value, and certificate fit.`);
  }, [sendMessage, setAgentMode, setVisible]);

  const handleCertificateAsk = useCallback((certificate: CertificateReviewItem) => {
    setAgentMode('certificateAdvisor');
    setVisible(true);
    void sendMessage(`Certificate War Room review: explain best use, poor use warnings, and stacking considerations for certificate ${certificate.label || certificate.id}.`);
  }, [sendMessage, setAgentMode, setVisible]);

  const handleMarkCertificateExpired = useCallback((certificate: CertificateReviewItem) => {
    updateCertificate(certificate.id, { status: 'expired' });
    console.log('[WarRoom] Marked certificate expired:', { id: certificate.id, label: certificate.label });
  }, [updateCertificate]);

  const handleRestoreCertificate = useCallback((certificate: CertificateReviewItem) => {
    updateCertificate(certificate.id, { status: 'available' });
    console.log('[WarRoom] Restored certificate:', { id: certificate.id, label: certificate.label });
  }, [updateCertificate]);

  const renderOfferItem = useCallback((item: WarRoomOffer) => {
    const offer = item.offer;
    const ownerLabel = getRecordOwnerLabel(offer, users);
    const isArchived = offer.status === 'archived' || offer.archiveStatus === 'archived';
    return (
      <View key={offer.id} style={styles.itemCard} testID={`war-room-offer-${offer.id}`}>
        <View style={styles.itemTopRow}>
          <View style={styles.scorePill}>
            <Gauge size={15} color="#A7F3D0" />
            <Text style={styles.scoreText}>{item.intelligence.score}</Text>
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemTitle}>{getOfferDisplayName(offer)}</Text>
            <Text style={styles.itemMeta}>{getOfferDisplayCode(offer)} • {ownerLabel} • {item.intelligence.rating}</Text>
          </View>
        </View>
        <Text style={styles.itemExplanation}>{item.intelligence.explanation}</Text>
        <View style={styles.valueRow}>
          <View style={styles.valuePill}>
            <Text style={styles.valueLabel}>Casino covers</Text>
            <Text style={styles.valueText}>{formatCurrency(item.intelligence.casinoPaysFor.casinoCoveredValue)}</Text>
          </View>
          <View style={styles.valuePill}>
            <Text style={styles.valueLabel}>Out of pocket</Text>
            <Text style={styles.valueText}>{formatCurrency(item.intelligence.casinoPaysFor.userOutOfPocket)}</Text>
          </View>
        </View>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => handleViewOffer(offer)} testID={`war-room-view-${offer.id}`}>
            <Text style={styles.primaryActionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={() => handleDecodeOffer(offer)} testID={`war-room-decode-${offer.id}`}>
            <Text style={styles.primaryActionText}>Decode</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleCompareOffer(offer)} testID={`war-room-compare-${offer.id}`}>
            <Calculator size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleAskAgentX(offer)} testID={`war-room-ask-${offer.id}`}>
            <Bot size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Ask AgentX</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleKeepActiveOffer(offer)} testID={`war-room-keep-${offer.id}`}>
            <ShieldCheck size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Keep Active</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => (isArchived ? handleRestoreOffer(offer) : handleArchiveOffer(offer))} testID={`war-room-archive-restore-${offer.id}`}>
            {isArchived ? <RotateCcw size={13} color="#CBD5E1" /> : <Archive size={13} color="#CBD5E1" />}
            <Text style={styles.secondaryActionText}>{isArchived ? 'Restore' : 'Archive'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleSkipOffer(offer)} testID={`war-room-skip-${offer.id}`}>
            <CheckCircle2 size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Mark Skipped</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleArchiveOffer, handleAskAgentX, handleCompareOffer, handleDecodeOffer, handleKeepActiveOffer, handleRestoreOffer, handleSkipOffer, handleViewOffer, users]);

  const renderOfferBucket = useCallback((bucket: WarRoomBucket) => (
    <View key={bucket.id} style={styles.bucketCard} testID={`war-room-bucket-${bucket.id}`}>
      <View style={styles.bucketHeader}>
        <View>
          <Text style={styles.bucketTitle}>{bucket.title}</Text>
          <Text style={styles.bucketSubtitle}>{bucket.subtitle}</Text>
        </View>
        <Text style={styles.bucketCount}>{bucket.offers.length}</Text>
      </View>
      {bucket.offers.map(renderOfferItem)}
    </View>
  ), [renderOfferItem]);

  const renderCertificateItem = useCallback((certificate: CertificateReviewItem) => (
    <View key={certificate.id} style={styles.certificateCard} testID={`war-room-certificate-${certificate.id}`}>
      <View style={styles.itemTopRow}>
        <View style={styles.certificateIconWrap}>
          <Ticket size={17} color="#FDE68A" />
        </View>
        <View style={styles.itemCopy}>
          <Text style={styles.itemTitle}>{certificate.label || 'Certificate'}</Text>
          <Text style={styles.itemMeta}>{certificate.type} • {getCertificateExpiryLabel(certificate)} • {formatCurrency(certificate.value)}</Text>
        </View>
      </View>
      <Text style={styles.itemExplanation}>{certificate.description || 'Review certificate owner, expiration, cabin entitlement, and stackability before applying it to a sailing.'}</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleCertificateAsk(certificate)} testID={`war-room-cert-ask-${certificate.id}`}>
          <Bot size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Ask AgentX</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleRestoreCertificate(certificate)} testID={`war-room-cert-restore-${certificate.id}`}>
          <RotateCcw size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleMarkCertificateExpired(certificate)} testID={`war-room-cert-expire-${certificate.id}`}>
          <Archive size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Mark Expired</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [handleCertificateAsk, handleMarkCertificateExpired, handleRestoreCertificate]);

  const renderCertificateBucket = useCallback((bucket: CertificateReviewBucket) => (
    <View key={bucket.id} style={styles.bucketCard} testID={`war-room-certificate-bucket-${bucket.id}`}>
      <View style={styles.bucketHeader}>
        <View>
          <Text style={styles.bucketTitle}>{bucket.title}</Text>
          <Text style={styles.bucketSubtitle}>{bucket.subtitle}</Text>
        </View>
        <Text style={styles.bucketCount}>{bucket.certificates.length}</Text>
      </View>
      {bucket.certificates.map(renderCertificateItem)}
    </View>
  ), [renderCertificateItem]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#020617', '#0F2439', '#134E4A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Clock size={22} color="#FDE68A" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Expiration War Room</Text>
            <Text style={styles.headerSubtitle}>Full offer and certificate management queue</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="close-war-room">
            <X size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <LinearGradient colors={['rgba(253, 230, 138, 0.18)', 'rgba(45, 212, 191, 0.12)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.heroKicker}>Decision cockpit</Text>
            <Text style={styles.heroTitle}>{offerCount} offers and {certificateCount} certificates need timing decisions.</Text>
            <Text style={styles.heroBody}>View, decode, compare, archive, restore, mark skipped, or ask AgentX without deleting uncertain data.</Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{visibleOfferBuckets.length}</Text>
                <Text style={styles.heroStatLabel}>Offer groups</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{visibleCertificateBuckets.length}</Text>
                <Text style={styles.heroStatLabel}>Cert groups</Text>
              </View>
            </View>
          </View>

          <IntelligenceFilterStrip contextLabel="War Room" compact={true} />

          {offerCount === 0 && certificateCount === 0 ? (
            <View style={styles.emptyCard} testID="war-room-empty">
              <CheckCircle2 size={36} color="#A7F3D0" />
              <Text style={styles.emptyTitle}>Nothing urgent right now</Text>
              <Text style={styles.emptyBody}>No expiring offers, recently expired items, or review-needed certificate records match the current filters.</Text>
            </View>
          ) : null}

          {visibleOfferBuckets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Offer queue</Text>
              {visibleOfferBuckets.map(renderOfferBucket)}
            </View>
          ) : null}

          {visibleCertificateBuckets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Certificate queue</Text>
              {visibleCertificateBuckets.map(renderCertificateBucket)}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={decodedOffer !== null} transparent={true} animationType="fade" onRequestClose={() => setDecodedOffer(null)}>
        <View style={styles.decodeOverlay}>
          <View style={styles.decodeCard} testID="war-room-decoded-offer-modal">
            <View style={styles.decodeHeader}>
              <View style={styles.decodeTitleRow}>
                <FileText size={20} color={COLORS.navyDeep} />
                <Text style={styles.decodeTitle}>{decodedOffer?.title ?? 'Decoded Offer'}</Text>
              </View>
              <TouchableOpacity style={styles.decodeClose} onPress={() => setDecodedOffer(null)} testID="war-room-decode-close">
                <Text style={styles.decodeCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.decodeScrollContent}>
              {decodedOffer?.bullets.map((bullet, index) => (
                <View key={`${bullet}-${index}`} style={styles.decodeBulletRow}>
                  <Calculator size={15} color="#0F766E" />
                  <Text style={styles.decodeBulletText}>{bullet}</Text>
                </View>
              ))}
              <Text style={styles.decodeDisclaimer}>{decodedOffer?.disclaimer}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={() => setVisible(false)}>
        <View style={styles.agentOverlay}>
          <TouchableOpacity style={styles.agentBackdrop} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={[styles.agentChatContainer, isExpanded && styles.agentChatExpanded]}>
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={agentLoading}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpanded}
              onClose={() => setVisible(false)}
              showHeader={true}
              placeholder="Ask AgentX about expiring offers and certificates..."
              mode={agentMode}
              onModeChange={setAgentMode}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 230, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.24)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.2)',
    marginBottom: SPACING.md,
    ...SHADOW.lg,
  },
  heroKicker: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900' as const,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStatValue: {
    color: '#A7F3D0',
    fontSize: 22,
    fontWeight: '900' as const,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  sectionBlock: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionLabel: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  bucketCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    gap: SPACING.sm,
  },
  bucketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  bucketTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
  },
  bucketSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 3,
  },
  bucketCount: {
    minWidth: 34,
    textAlign: 'center',
    color: '#FDE68A',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
    backgroundColor: 'rgba(253, 230, 138, 0.12)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  certificateCard: {
    backgroundColor: 'rgba(69, 26, 3, 0.28)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.18)',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  scorePill: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 118, 110, 0.35)',
  },
  scoreText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    marginTop: 1,
  },
  certificateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 230, 138, 0.14)',
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
  },
  itemMeta: {
    color: '#BAE6FD',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 3,
  },
  itemExplanation: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
    marginTop: SPACING.sm,
  },
  valueRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  valuePill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  valueLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
  },
  valueText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  primaryAction: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  primaryActionText: {
    color: COLORS.navyDeep,
    fontSize: 12,
    fontWeight: '900' as const,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800' as const,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
    marginTop: SPACING.md,
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  decodeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  decodeCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  decodeHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  decodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingRight: 82,
  },
  decodeTitle: {
    flex: 1,
    color: COLORS.navyDeep,
    fontSize: 17,
    fontWeight: '900' as const,
  },
  decodeClose: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  decodeCloseText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  decodeScrollContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  decodeBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  decodeBulletText: {
    flex: 1,
    color: '#1E293B',
    fontSize: 13,
    lineHeight: 19,
  },
  decodeDisclaimer: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  agentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  agentBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  agentChatContainer: {
    height: '78%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  agentChatExpanded: {
    height: '96%',
  },
});
