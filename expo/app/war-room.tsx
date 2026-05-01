import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Archive,
  Bot,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Ship,
  Ticket,
  UserRound,
  X,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useAgentX } from '@/state/AgentXProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { filterRecordsByIntelligence, getRecordOwnerLabel } from '@/lib/intelligenceFilters';
import {
  buildCommandCenterBuckets,
  calculateOfferIntelligenceScore,
  decodeOffer,
  getBrandLabel,
  getOfferDisplayCode,
  getOfferDisplayName,
  getOfferExpiryDate,
  type CommandCenterOffer,
  type DecodedOffer,
} from '@/lib/offerIntelligence';
import { formatCurrency } from '@/lib/format';
import { getDaysUntil } from '@/lib/date';
import type { CasinoOffer, TravelerProfile } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';

type CertificateReviewBucketId = 'cert7' | 'cert14' | 'cert30' | 'certExpired' | 'certReview';
type QueueView = 'all' | 'offers' | 'certificates' | 'history';

interface OfferManagementBucket {
  id: string;
  title: string;
  subtitle: string;
  offers: CommandCenterOffer[];
}

const QUEUE_VIEWS: { id: QueueView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'offers', label: 'Offers' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'history', label: 'Archived / skipped' },
];

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

  console.log('[CommandCenter] Certificate buckets built:', buckets.map((bucket) => ({ id: bucket.id, count: bucket.certificates.length })));
  return buckets;
}

function getCertificateExpiryLabel(certificate: CertificateReviewItem): string {
  if (!certificate.expiryDate) return 'No expiration recorded';
  const days = getDaysUntil(certificate.expiryDate);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getOfferBrandProgramLabel(offer: CasinoOffer): string {
  const brandLabel = getBrandLabel(offer.brand ?? offer.offerSource);
  const program = offer.casinoProgram === 'blueChip' ? 'Blue Chip' : offer.casinoProgram === 'clubRoyale' ? 'Club Royale' : offer.casinoProgram === 'playersClub' ? 'Players Club' : offer.casinoProgram === 'venetianSociety' ? 'Venetian Society' : 'Program not set';
  return `${brandLabel} • ${program}`;
}

function getOfferExpirationLabel(item: CommandCenterOffer): string {
  const expiry = getOfferExpiryDate(item.offer);
  const days = item.intelligence.daysUntilExpiration;
  if (!expiry || days === null) return 'Expiration missing';
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}

function getOfferCabinLabel(offer: CasinoOffer): string {
  return offer.roomType || offer.category || offer.offerType || 'Cabin entitlement not recorded';
}

function getBestRemainingUse(item: CommandCenterOffer): string {
  const offer = item.offer;
  const cabin = getOfferCabinLabel(offer);
  const nights = offer.nights ? `${offer.nights}-night` : 'eligible';
  const ship = offer.shipName ? ` on ${offer.shipName}` : '';
  const savings = item.intelligence.casinoPaysFor.effectiveSavingsPercentage;
  if (item.intelligence.daysUntilExpiration !== null && item.intelligence.daysUntilExpiration < 0) {
    return 'History/reference only unless the casino desk restores or reissues it.';
  }
  if (item.intelligence.score >= 80) {
    return `Prioritize this ${nights} ${cabin} opportunity${ship}; the recorded comp math is strong at ${savings}% effective savings.`;
  }
  if (item.intelligence.daysUntilExpiration !== null && item.intelligence.daysUntilExpiration <= 7) {
    return `Make a fast decision: decode terms, compare alternatives, then either book, skip, or archive before the window closes.`;
  }
  if (item.intelligence.casinoPaysFor.userOutOfPocket > 0) {
    return `Compare against lower out-of-pocket sailings before using a high-value certificate or offer code.`;
  }
  return `Keep in the active planning queue while you compare dates, cabin entitlement, ship fit, and profile ownership.`;
}

function getSuggestedOfferAction(item: CommandCenterOffer): string {
  const status = normalizeStatus(item.offer.status);
  const archiveStatus = normalizeStatus(item.offer.archiveStatus);
  const days = item.intelligence.daysUntilExpiration;
  if (status === 'archived' || archiveStatus === 'archived') return 'Restore only if this offer is available again; otherwise leave archived.';
  if (status === 'skipped') return 'Restore if plans changed; otherwise keep skipped for history.';
  if (archiveStatus === 'reviewneeded' || item.offer.reconciliationStatus === 'reviewNeeded') return 'Review owner/date changes, then keep active or archive.';
  if (days === null) return 'Decode and review missing expiration before relying on it.';
  if (days < 0) return 'Archive after confirming it cannot be used.';
  if (days <= 7) return 'Decode, compare, and decide now.';
  if (item.intelligence.score >= 75) return 'Compare against booked cruises and consider booking.';
  return 'Keep active only if it fits a specific sailing; otherwise archive or skip.';
}

function getOfferReviewFlags(item: CommandCenterOffer): string[] {
  const flags: string[] = [];
  const offer = item.offer;
  if (!offer.ownerProfileId && !offer.sourceEmail) flags.push('Owner/profile missing');
  if (!getOfferExpiryDate(offer)) flags.push('Expiration missing');
  if (!offer.brand && !offer.offerSource) flags.push('Brand missing');
  if (!offer.casinoProgram) flags.push('Program missing');
  if (offer.reconciliationStatus === 'reviewNeeded' || offer.archiveStatus === 'reviewNeeded' || offer.status === 'reviewNeeded') flags.push('Import review needed');
  if (item.intelligence.casinoPaysFor.missingInputs.length > 0) flags.push(`Missing ${item.intelligence.casinoPaysFor.missingInputs.join(', ')}`);
  return flags;
}

function offerIsInactive(offer: CasinoOffer): boolean {
  const status = normalizeStatus(offer.status);
  const archiveStatus = normalizeStatus(offer.archiveStatus);
  return status === 'archived' || status === 'skipped' || status === 'replaced' || archiveStatus === 'archived' || archiveStatus === 'replaced';
}

export default function CommandCenterScreen() {
  const router = useRouter();
  const { cruises, casinoOffers, updateCasinoOffer } = useCoreData();
  const { users, currentUser } = useUser();
  const { certificates, updateCertificate } = useCertificates();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    sendMessage,
    setMode: setAgentMode,
  } = useAgentX();
  const [decodedOffer, setDecodedOffer] = useState<DecodedOffer | null>(null);
  const [queueView, setQueueView] = useState<QueueView>('all');

  const filterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const filteredOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, filterSnapshot, users), [casinoOffers, filterSnapshot, users]);
  const filteredCruises = useMemo(() => filterRecordsByIntelligence(cruises, filterSnapshot, users), [cruises, filterSnapshot, users]);
  const filteredCertificates = useMemo(() => filterRecordsByIntelligence(certificates as CertificateReviewItem[], filterSnapshot, users), [certificates, filterSnapshot, users]);
  const travelerProfile = useMemo(() => buildTravelerProfile(currentUser), [currentUser]);
  const offerBuckets = useMemo((): OfferManagementBucket[] => buildCommandCenterBuckets(filteredOffers, filteredCruises, certificates, travelerProfile), [certificates, filteredCruises, filteredOffers, travelerProfile]);
  const inactiveOfferBucket = useMemo((): OfferManagementBucket => {
    const inactiveOffers = filteredOffers
      .filter(offerIsInactive)
      .map((offer) => ({ offer, intelligence: calculateOfferIntelligenceScore(offer, filteredCruises, certificates, travelerProfile) }))
      .sort((a, b) => b.intelligence.score - a.intelligence.score);
    console.log('[CommandCenter] Archived/skipped offer bucket built:', inactiveOffers.length);
    return {
      id: 'archivedSkipped',
      title: 'Archived / skipped offer history',
      subtitle: 'Restore, keep archived, or ask Ask My Data before returning old offers to active planning.',
      offers: inactiveOffers,
    };
  }, [certificates, filteredCruises, filteredOffers, travelerProfile]);
  const certificateBuckets = useMemo(() => buildCertificateBuckets(filteredCertificates), [filteredCertificates]);
  const visibleOfferBuckets = useMemo(() => offerBuckets.filter((bucket) => bucket.offers.length > 0), [offerBuckets]);
  const visibleInactiveOfferBuckets = useMemo(() => inactiveOfferBucket.offers.length > 0 ? [inactiveOfferBucket] : [], [inactiveOfferBucket]);
  const visibleCertificateBuckets = useMemo(() => certificateBuckets.filter((bucket) => bucket.certificates.length > 0), [certificateBuckets]);
  const offerCount = useMemo(() => offerBuckets.reduce((sum, bucket) => sum + bucket.offers.length, 0), [offerBuckets]);
  const inactiveOfferCount = useMemo(() => inactiveOfferBucket.offers.length, [inactiveOfferBucket]);
  const certificateCount = useMemo(() => certificateBuckets.reduce((sum, bucket) => sum + bucket.certificates.length, 0), [certificateBuckets]);
  const totalManagementCount = offerCount + certificateCount + inactiveOfferCount;
  const showOffers = queueView === 'all' || queueView === 'offers';
  const showCertificates = queueView === 'all' || queueView === 'certificates';
  const showHistory = queueView === 'all' || queueView === 'history';

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
          console.log('[CommandCenter] Archived offer:', { id: offer.id, offerCode: offer.offerCode });
        },
      },
    ]);
  }, [updateCasinoOffer]);

  const handleKeepActiveOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'active', archiveStatus: 'active', reconciliationStatus: 'matched', updatedAt: new Date().toISOString() });
    console.log('[CommandCenter] Kept offer active:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleRestoreOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'active', archiveStatus: 'active', reconciliationStatus: 'matched', updatedAt: new Date().toISOString() });
    console.log('[CommandCenter] Restored offer:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleSkipOffer = useCallback((offer: CasinoOffer) => {
    updateCasinoOffer(offer.id, { status: 'skipped', archiveStatus: 'active', reconciliationStatus: 'matched', updatedAt: new Date().toISOString() });
    console.log('[CommandCenter] Marked offer skipped:', { id: offer.id, offerCode: offer.offerCode });
  }, [updateCasinoOffer]);

  const handleAskAgentX = useCallback((offer: CasinoOffer) => {
    setAgentMode('casinoHost');
    router.push('/ask-my-data' as any);
    void sendMessage(`Command Center review: advise me on offer ${getOfferDisplayCode(offer)}. Explain whether to view, decode, compare, keep active, archive, restore, or skip it using current profile, brand, and program filters.`);
  }, [router, sendMessage, setAgentMode]);

  const handleCompareOffer = useCallback((offer: CasinoOffer) => {
    setAgentMode('travelAgent');
    router.push('/ask-my-data' as any);
    void sendMessage(`Compare offer ${getOfferDisplayCode(offer)} against my other urgent and active offers. Include Offer Intelligence Score, expiration urgency, owner profile, casino-paid value, and certificate fit.`);
  }, [router, sendMessage, setAgentMode]);

  const handleCertificateAsk = useCallback((certificate: CertificateReviewItem) => {
    setAgentMode('certificateAdvisor');
    router.push('/ask-my-data' as any);
    void sendMessage(`Certificate Command Center review: explain best use, poor use warnings, and stacking considerations for certificate ${certificate.label || certificate.id}.`);
  }, [router, sendMessage, setAgentMode]);

  const handleMarkCertificateExpired = useCallback((certificate: CertificateReviewItem) => {
    updateCertificate(certificate.id, { status: 'expired' });
    console.log('[CommandCenter] Marked certificate expired:', { id: certificate.id, label: certificate.label });
  }, [updateCertificate]);

  const handleRestoreCertificate = useCallback((certificate: CertificateReviewItem) => {
    updateCertificate(certificate.id, { status: 'available' });
    console.log('[CommandCenter] Restored certificate:', { id: certificate.id, label: certificate.label });
  }, [updateCertificate]);

  const renderOfferItem = useCallback((item: CommandCenterOffer) => {
    const offer = item.offer;
    const ownerLabel = getRecordOwnerLabel(offer, users);
    const isArchived = offer.status === 'archived' || offer.archiveStatus === 'archived';
    const isInactive = offerIsInactive(offer);
    const reviewFlags = getOfferReviewFlags(item);
    return (
      <View key={offer.id} style={styles.itemCard} testID={`command-center-offer-${offer.id}`}>
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
        <View style={styles.detailGrid}>
          <View style={styles.detailPill}>
            <UserRound size={12} color="#BAE6FD" />
            <Text style={styles.detailText}>{ownerLabel}</Text>
          </View>
          <View style={styles.detailPill}>
            <CalendarDays size={12} color="#BAE6FD" />
            <Text style={styles.detailText}>{getOfferExpirationLabel(item)}</Text>
          </View>
          <View style={styles.detailPill}>
            <Ship size={12} color="#BAE6FD" />
            <Text style={styles.detailText}>{getOfferBrandProgramLabel(offer)}</Text>
          </View>
          <View style={styles.detailPill}>
            <Ticket size={12} color="#BAE6FD" />
            <Text style={styles.detailText}>{getOfferCabinLabel(offer)}</Text>
          </View>
        </View>
        <View style={styles.strategyBox}>
          <Text style={styles.strategyLabel}>Best remaining use</Text>
          <Text style={styles.strategyText}>{getBestRemainingUse(item)}</Text>
          <Text style={styles.strategyLabel}>Suggested action</Text>
          <Text style={styles.strategyText}>{getSuggestedOfferAction(item)}</Text>
        </View>
        {reviewFlags.length > 0 ? (
          <View style={styles.flagWrap}>
            {reviewFlags.map((flag) => (
              <View key={`${offer.id}-${flag}`} style={styles.flagPill}>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
          <TouchableOpacity style={styles.primaryAction} onPress={() => handleViewOffer(offer)} testID={`command-center-view-${offer.id}`}>
            <Text style={styles.primaryActionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={() => handleDecodeOffer(offer)} testID={`command-center-decode-${offer.id}`}>
            <Text style={styles.primaryActionText}>Decode</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleCompareOffer(offer)} testID={`command-center-compare-${offer.id}`}>
            <Calculator size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleAskAgentX(offer)} testID={`command-center-ask-${offer.id}`}>
            <Bot size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Ask My Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => handleKeepActiveOffer(offer)} testID={`command-center-keep-${offer.id}`}>
            <ShieldCheck size={13} color="#CBD5E1" />
            <Text style={styles.secondaryActionText}>Keep Active</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => (isInactive ? handleRestoreOffer(offer) : handleArchiveOffer(offer))} testID={`command-center-archive-restore-${offer.id}`}>
            {isInactive ? <RotateCcw size={13} color="#CBD5E1" /> : <Archive size={13} color="#CBD5E1" />}
            <Text style={styles.secondaryActionText}>{isInactive ? 'Restore' : 'Archive'}</Text>
          </TouchableOpacity>
          {!isInactive ? (
            <TouchableOpacity style={styles.secondaryAction} onPress={() => handleSkipOffer(offer)} testID={`command-center-skip-${offer.id}`}>
              <CheckCircle2 size={13} color="#CBD5E1" />
              <Text style={styles.secondaryActionText}>Mark Skipped</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, [handleArchiveOffer, handleAskAgentX, handleCompareOffer, handleDecodeOffer, handleKeepActiveOffer, handleRestoreOffer, handleSkipOffer, handleViewOffer, users]);

  const renderOfferBucket = useCallback((bucket: OfferManagementBucket) => (
    <View key={bucket.id} style={styles.bucketCard} testID={`command-center-bucket-${bucket.id}`}>
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
    <View key={certificate.id} style={styles.certificateCard} testID={`command-center-certificate-${certificate.id}`}>
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
      <View style={styles.detailGrid}>
        <View style={styles.detailPill}>
          <UserRound size={12} color="#BAE6FD" />
          <Text style={styles.detailText}>{getRecordOwnerLabel(certificate, users)}</Text>
        </View>
        <View style={styles.detailPill}>
          <CalendarDays size={12} color="#BAE6FD" />
          <Text style={styles.detailText}>{getCertificateExpiryLabel(certificate)}</Text>
        </View>
        <View style={styles.detailPill}>
          <Ship size={12} color="#BAE6FD" />
          <Text style={styles.detailText}>{certificate.casinoProgram || 'Program not set'}</Text>
        </View>
        <View style={styles.detailPill}>
          <Ticket size={12} color="#BAE6FD" />
          <Text style={styles.detailText}>{certificate.cabinEntitlement || certificate.offerCode || 'No cabin/offer link'}</Text>
        </View>
      </View>
      <View style={styles.strategyBox}>
        <Text style={styles.strategyLabel}>Best remaining use</Text>
        <Text style={styles.strategyText}>Use only when the certificate improves cabin entitlement, upgrade cost, OBC, FreePlay, or out-of-pocket math.</Text>
        <Text style={styles.strategyLabel}>Suggested action</Text>
        <Text style={styles.strategyText}>{certificate.expiryDate && getDaysUntil(certificate.expiryDate) < 0 ? 'Keep for history or mark expired.' : 'Ask My Data or verify stackability before applying it to a sailing.'}</Text>
      </View>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleCertificateAsk(certificate)} testID={`command-center-cert-ask-${certificate.id}`}>
          <Bot size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Ask My Data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleRestoreCertificate(certificate)} testID={`command-center-cert-restore-${certificate.id}`}>
          <RotateCcw size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => handleMarkCertificateExpired(certificate)} testID={`command-center-cert-expire-${certificate.id}`}>
          <Archive size={13} color="#CBD5E1" />
          <Text style={styles.secondaryActionText}>Mark Expired</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [handleCertificateAsk, handleMarkCertificateExpired, handleRestoreCertificate, users]);

  const renderCertificateBucket = useCallback((bucket: CertificateReviewBucket) => (
    <View key={bucket.id} style={styles.bucketCard} testID={`command-center-certificate-bucket-${bucket.id}`}>
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
            <Text style={styles.headerTitle}>Expiration Command Center</Text>
            <Text style={styles.headerSubtitle}>Dedicated offer, certificate, and archive management</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="close-command-center">
            <X size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <LinearGradient colors={['rgba(253, 230, 138, 0.18)', 'rgba(45, 212, 191, 0.12)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.heroKicker}>Decision cockpit</Text>
            <Text style={styles.heroTitle}>{totalManagementCount} records are ready for timing decisions.</Text>
            <Text style={styles.heroBody}>Grouped urgency queues show owner profile, brand/program, expiration, best use, suggested action, archive history, and Ask My Data controls without deleting uncertain data.</Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{visibleOfferBuckets.length}</Text>
                <Text style={styles.heroStatLabel}>Offer groups</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{visibleCertificateBuckets.length}</Text>
                <Text style={styles.heroStatLabel}>Cert groups</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{inactiveOfferCount}</Text>
                <Text style={styles.heroStatLabel}>Archived/skipped</Text>
              </View>
            </View>
          </View>

          <IntelligenceFilterStrip contextLabel="Command Center" compact={true} />

          <View style={styles.queueSwitcher} testID="command-center-queue-switcher">
            {QUEUE_VIEWS.map((view) => {
              const active = queueView === view.id;
              return (
                <TouchableOpacity
                  key={view.id}
                  style={[styles.queueChip, active && styles.queueChipActive]}
                  onPress={() => setQueueView(view.id)}
                  activeOpacity={0.75}
                  testID={`command-center-view-${view.id}`}
                >
                  <Text style={[styles.queueChipText, active && styles.queueChipTextActive]}>{view.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {totalManagementCount === 0 ? (
            <View style={styles.emptyCard} testID="command-center-empty">
              <CheckCircle2 size={36} color="#A7F3D0" />
              <Text style={styles.emptyTitle}>Nothing urgent right now</Text>
              <Text style={styles.emptyBody}>No expiring offers, recently expired items, or review-needed certificate records match the current filters.</Text>
            </View>
          ) : null}

          {showOffers && visibleOfferBuckets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Offer queue</Text>
              {visibleOfferBuckets.map(renderOfferBucket)}
            </View>
          ) : null}

          {showCertificates && visibleCertificateBuckets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Certificate queue</Text>
              {visibleCertificateBuckets.map(renderCertificateBucket)}
            </View>
          ) : null}

          {showHistory && visibleInactiveOfferBuckets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Archive / skipped history</Text>
              {visibleInactiveOfferBuckets.map(renderOfferBucket)}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={decodedOffer !== null} transparent={true} animationType="fade" onRequestClose={() => setDecodedOffer(null)}>
        <View style={styles.decodeOverlay}>
          <View style={styles.decodeCard} testID="command-center-decoded-offer-modal">
            <View style={styles.decodeHeader}>
              <View style={styles.decodeTitleRow}>
                <FileText size={20} color={COLORS.navyDeep} />
                <Text style={styles.decodeTitle}>{decodedOffer?.title ?? 'Decoded Offer'}</Text>
              </View>
              <TouchableOpacity style={styles.decodeClose} onPress={() => setDecodedOffer(null)} testID="command-center-decode-close">
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
  queueSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  queueChip: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  queueChipActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#FDE68A',
  },
  queueChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  queueChipTextActive: {
    color: '#422006',
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
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    backgroundColor: 'rgba(14, 116, 144, 0.22)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.16)',
  },
  detailText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800' as const,
  },
  strategyBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.34)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: SPACING.sm,
    gap: 4,
  },
  strategyLabel: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  strategyText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
  },
  flagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  flagPill: {
    backgroundColor: 'rgba(251, 113, 133, 0.14)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.28)',
  },
  flagText: {
    color: '#FECDD3',
    fontSize: 10,
    fontWeight: '800' as const,
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
});
