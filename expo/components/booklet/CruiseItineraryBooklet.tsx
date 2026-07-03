import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Download, Edit3, FileText, Save, X } from 'lucide-react-native';

import { COLORS, SPACING, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';
import { createDateFromString, formatDate } from '@/lib/date';
import type { BookedCruise, CasinoOffer, CruiseItineraryBookletData } from '@/types/models';

const BOOKLET_BG = '#F5EFE7';
const BOOKLET_NAVY = '#134365';
const BOOKLET_CARD = '#FFFDF8';
const BOOKLET_LINE = '#E5DED3';
const BOOKLET_TEXT = '#18344A';
const BOOKLET_MUTED = '#617487';
const BOOKLET_GOLD = '#FFD45A';
const BOOKLET_TEAL = '#0EA5A8';
const BOOKLET_ROSE = '#FB5B72';
const BOOKLET_PURPLE = '#7C3AED';

function isTruthyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function valueOrMissing(value: unknown, fallback = 'Not found / not entered'): string {
  if (typeof value === 'number') return value > 0 ? formatCurrency(value) : fallback;
  if (isTruthyText(value)) return value.trim();
  return fallback;
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = createDateFromString(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateRange(cruise: BookedCruise): string {
  const start = safeDate(cruise.sailDate);
  const end = safeDate(cruise.returnDate);
  if (start && end) return `${formatDate(cruise.sailDate, 'short')} - ${formatDate(cruise.returnDate, 'short')}`;
  if (start) return formatDate(cruise.sailDate, 'short');
  return 'Date needed';
}

function isCurrentCruise(cruise: BookedCruise): boolean {
  const start = safeDate(cruise.sailDate);
  const end = safeDate(cruise.returnDate);
  if (!start) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = end ? new Date(end) : new Date(normalizedStart);
  if (!end && cruise.nights) normalizedEnd.setDate(normalizedStart.getDate() + cruise.nights);
  normalizedEnd.setHours(23, 59, 59, 999);
  return today >= normalizedStart && today <= normalizedEnd;
}

function meaningfulFilename(cruise: BookedCruise): string {
  const ship = (cruise.shipName || 'Cruise').replace(/[\\/:*?"<>|]+/g, '').trim();
  const range = dateRange(cruise).replace(/[\\/:*?"<>|,]+/g, '').replace(/\s+/g, ' ').trim();
  return `${ship} - ${range} - Itinerary Booklet.png`;
}

function inferSourceStatus(cruise: BookedCruise, booklet?: CruiseItineraryBookletData): string {
  if (booklet?.gmailMatchStatus) return booklet.gmailMatchStatus;
  if (cruise.documents?.length) return `Matched ${cruise.documents.length} saved document(s).`;
  if ((cruise as any).sourcePayload || cruise.reservationNumber || cruise.bookingId) return 'Built from synced booked-cruise data. Add Gmail/document matches as they become available.';
  return 'Manual itinerary page. Add confirmation, invoice, flights, hotel, and casino details.';
}

function buildInitialBooklet(cruise: BookedCruise, linkedOffer?: CasinoOffer): CruiseItineraryBookletData {
  const existing = cruise.itineraryBooklet || {};
  const stateroomPieces = [
    cruise.cabinNumber || cruise.stateroomNumber,
    cruise.cabinType || cruise.cabinCategory || cruise.stateroomCategoryCode,
  ].filter(Boolean).join(' | ');
  const guestValue = cruise.guestNames?.length ? cruise.guestNames.join(' + ') : `${cruise.guests || 1} guest${(cruise.guests || 1) === 1 ? '' : 's'}`;
  const casinoLines = [
    cruise.packageCode,
    (cruise as any).casinoPromoCode,
    (cruise as any).casinoLine,
    cruise.perks?.join(', '),
  ].filter(Boolean).join(' + ');

  const importantNotes = existing.importantNotes?.length ? existing.importantNotes : [
    cruise.checkInDate ? `Online check-in: ${cruise.checkInDate}` : 'Online check-in/document status not entered yet.',
    cruise.cabinNumber || cruise.stateroomNumber ? 'Cabin assignment shown above.' : 'Cabin assignment may still be pending or needs review.',
    cruise.notes || cruise.specialRequests || 'Add cruise-specific reminders, cancellation notes, and onboard priorities here.',
  ];

  return {
    title: existing.title || `Cruise Itinerary Booklet: ${cruise.shipName || 'Cruise'}`,
    subtitle: existing.subtitle || `${dateRange(cruise)} | ${cruise.nights || '—'} night${cruise.nights === 1 ? '' : 's'} | ${guestValue}`,
    gmailMatchStatus: existing.gmailMatchStatus || inferSourceStatus(cruise, existing),
    sourceStatus: existing.sourceStatus || inferSourceStatus(cruise, existing),
    reservationNumber: existing.reservationNumber || cruise.reservationNumber || cruise.bookingId || 'Not entered',
    shipName: existing.shipName || cruise.shipName || 'Ship needed',
    sailingDateRange: existing.sailingDateRange || dateRange(cruise),
    nights: existing.nights || String(cruise.nights || '—'),
    itineraryName: existing.itineraryName || cruise.itineraryName || cruise.destination || 'Itinerary needed',
    stateroom: existing.stateroom || stateroomPieces || 'Not assigned / not entered',
    dining: existing.dining || (cruise as any).diningTime || (cruise as any).dining || 'Not entered',
    guests: existing.guests || guestValue,
    loyalty: existing.loyalty || cruise.casinoLevel || (cruise as any).loyaltyStatus || 'Not entered',
    offerCode: existing.offerCode || cruise.offerCode || linkedOffer?.offerCode || 'Not found / not entered',
    offerName: existing.offerName || cruise.offerName || linkedOffer?.offerName || (linkedOffer as any)?.title || 'Not found / not entered',
    offerLevel: existing.offerLevel || cruise.offerCategory || (cruise as any).casinoLevel || 'Not entered',
    casinoLines: existing.casinoLines || casinoLines || 'Not found / not entered',
    freePlay: existing.freePlay || valueOrMissing(cruise.freePlay),
    onboardCredit: existing.onboardCredit || valueOrMissing(cruise.freeOBC),
    tradeInValue: existing.tradeInValue || valueOrMissing(cruise.tradeInValue),
    taxesFees: existing.taxesFees || valueOrMissing(cruise.taxes || cruise.taxesFeesEstimate),
    amountPaid: existing.amountPaid || valueOrMissing(cruise.amountPaid || cruise.pricePaid || cruise.totalPrice || cruise.price),
    balanceDue: existing.balanceDue || valueOrMissing(cruise.balanceDue, 'Not found / $0 if paid'),
    casinoNotes: existing.casinoNotes || cruise.instantCertificateNotes || cruise.notes || 'Add casino comp, free play, trade-in, OBC, and host notes here.',
    flightsSummary: existing.flightsSummary || cruise.airfare?.flightDetails || 'No flight confirmation attached yet.',
    hotelsSummary: existing.hotelsSummary || 'No pre/post hotel attached yet.',
    transfersSummary: existing.transfersSummary || 'No transfer attached yet.',
    importantNotes,
    travelItems: existing.travelItems || [],
    documentMatches: existing.documentMatches || [],
    needsReviewFlags: existing.needsReviewFlags || [],
    currentCruiseNotes: existing.currentCruiseNotes || [],
    accentColor: existing.accentColor || (cruise.cruiseSource === 'celebrity' ? BOOKLET_ROSE : BOOKLET_TEAL),
    lastEditedAt: existing.lastEditedAt,
    lastExportedAt: existing.lastExportedAt,
  };
}

const EDIT_FIELDS: { key: keyof CruiseItineraryBookletData; label: string; multiline?: boolean }[] = [
  { key: 'gmailMatchStatus', label: 'Source / Gmail Match Status', multiline: true },
  { key: 'reservationNumber', label: 'Reservation / Booking Number' },
  { key: 'sailingDateRange', label: 'Sailing Date Range' },
  { key: 'itineraryName', label: 'Itinerary' },
  { key: 'stateroom', label: 'Stateroom / Cabin' },
  { key: 'dining', label: 'Dining' },
  { key: 'guests', label: 'Guests' },
  { key: 'loyalty', label: 'Loyalty / Casino Status' },
  { key: 'offerCode', label: 'Offer Code' },
  { key: 'offerName', label: 'Offer Name' },
  { key: 'offerLevel', label: 'Offer Level / Tier' },
  { key: 'casinoLines', label: 'Casino Lines / Promo Codes', multiline: true },
  { key: 'freePlay', label: 'Free Play' },
  { key: 'onboardCredit', label: 'Onboard Credit' },
  { key: 'tradeInValue', label: 'Trade-in Value' },
  { key: 'taxesFees', label: 'Taxes / Fees' },
  { key: 'amountPaid', label: 'Amount Paid' },
  { key: 'balanceDue', label: 'Balance Due' },
  { key: 'casinoNotes', label: 'Casino Notes', multiline: true },
  { key: 'flightsSummary', label: 'Flights', multiline: true },
  { key: 'hotelsSummary', label: 'Hotels', multiline: true },
  { key: 'transfersSummary', label: 'Transfers', multiline: true },
];

type Props = {
  cruise: BookedCruise;
  linkedOffer?: CasinoOffer;
  onSave: (updates: Partial<BookedCruise>) => void;
};

export function CruiseItineraryBooklet({ cruise, linkedOffer, onSave }: Props) {
  const exportRef = useRef<View>(null);
  const baseBooklet = useMemo(() => buildInitialBooklet(cruise, linkedOffer), [cruise, linkedOffer]);
  const [editVisible, setEditVisible] = useState(false);
  const [draft, setDraft] = useState<CruiseItineraryBookletData>(baseBooklet);
  const currentCruise = isCurrentCruise(cruise);
  const needsReview = Boolean(baseBooklet.needsReviewFlags?.length) || /not found|not entered|needed|review/i.test([
    baseBooklet.offerCode,
    baseBooklet.stateroom,
    baseBooklet.gmailMatchStatus,
  ].join(' '));
  const accent = baseBooklet.accentColor || BOOKLET_TEAL;

  const saveDraft = () => {
    const normalizedDraft: CruiseItineraryBookletData = {
      ...draft,
      importantNotes: typeof (draft as any).importantNotesText === 'string'
        ? (draft as any).importantNotesText.split('\n').map((line: string) => line.trim()).filter(Boolean)
        : draft.importantNotes,
      needsReviewFlags: typeof (draft as any).needsReviewText === 'string'
        ? (draft as any).needsReviewText.split('\n').map((line: string) => line.trim()).filter(Boolean)
        : draft.needsReviewFlags,
      currentCruiseNotes: typeof (draft as any).currentCruiseNotesText === 'string'
        ? (draft as any).currentCruiseNotesText.split('\n').map((line: string) => line.trim()).filter(Boolean)
        : draft.currentCruiseNotes,
      lastEditedAt: new Date().toISOString(),
    };

    onSave({
      itineraryBooklet: normalizedDraft,
      reservationNumber: normalizedDraft.reservationNumber || cruise.reservationNumber,
      offerCode: normalizedDraft.offerCode && !/not found/i.test(normalizedDraft.offerCode) ? normalizedDraft.offerCode : cruise.offerCode,
      offerName: normalizedDraft.offerName && !/not found/i.test(normalizedDraft.offerName) ? normalizedDraft.offerName : cruise.offerName,
      notes: normalizedDraft.casinoNotes || cruise.notes,
    });
    setEditVisible(false);
  };

  const openEditor = () => {
    setDraft({
      ...baseBooklet,
      ...(baseBooklet as any),
      importantNotesText: (baseBooklet.importantNotes || []).join('\n'),
      needsReviewText: (baseBooklet.needsReviewFlags || []).join('\n'),
      currentCruiseNotesText: (baseBooklet.currentCruiseNotes || []).join('\n'),
    } as CruiseItineraryBookletData);
    setEditVisible(true);
  };

  const exportPng = async () => {
    try {
      if (!exportRef.current) return;
      const uri = await captureRef(exportRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const filename = meaningfulFilename(cruise);
      let shareUri = uri;
      if (FileSystem.cacheDirectory) {
        const target = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.copyAsync({ from: uri, to: target });
        shareUri = target;
      }
      onSave({ itineraryBooklet: { ...baseBooklet, lastExportedAt: new Date().toISOString() } });
      if (Platform.OS !== 'web' && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, { mimeType: 'image/png', dialogTitle: filename });
      } else {
        await Share.share({ url: shareUri, message: filename });
      }
    } catch (error) {
      console.error('[CruiseItineraryBooklet] PNG export failed:', error);
      Alert.alert('Export failed', 'Easy Seas could not export this booklet PNG. Please try again.');
    }
  };

  const renderRow = (label: string, value?: string) => (
    <View style={styles.bookletRow} key={label}>
      <Text style={styles.bookletRowLabel}>{label}</Text>
      <Text style={styles.bookletRowValue}>{valueOrMissing(value)}</Text>
    </View>
  );

  const notes = baseBooklet.importantNotes?.length ? baseBooklet.importantNotes : ['Add important notes, reminders, and missing details here.'];

  return (
    <View style={styles.wrapper} testID="cruise-itinerary-booklet">
      <View style={styles.toolbar}>
        <View style={styles.toolbarTitleWrap}>
          <FileText size={18} color={COLORS.white} />
          <Text style={styles.toolbarTitle}>Cruise Itinerary Booklet</Text>
        </View>
        <View style={styles.toolbarActions}>
          <TouchableOpacity style={styles.toolbarButton} onPress={openEditor} testID="edit-itinerary-booklet-button">
            <Edit3 size={14} color={COLORS.white} />
            <Text style={styles.toolbarButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={exportPng} testID="export-itinerary-png-button">
            <Download size={14} color={COLORS.white} />
            <Text style={styles.toolbarButtonText}>PNG</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View ref={exportRef} collapsable={false} style={styles.exportCanvas}>
        <View style={styles.headerPill}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{baseBooklet.title}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{baseBooklet.subtitle}</Text>
          </View>
          <View style={styles.sunBadge} />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Source status:</Text>
          <Text style={styles.statusText}>{baseBooklet.gmailMatchStatus || baseBooklet.sourceStatus}</Text>
        </View>

        <View style={styles.badgeRow}>
          {currentCruise ? <Text style={[styles.statusBadge, styles.currentBadge]}>CURRENT CRUISE</Text> : null}
          {needsReview ? <Text style={[styles.statusBadge, styles.reviewBadge]}>BOOKLET NEEDS REVIEW</Text> : <Text style={[styles.statusBadge, styles.readyBadge]}>BOOKLET READY</Text>}
        </View>

        <BookletSection accent={accent} title="Cruise Summary">
          {renderRow('Reservation', baseBooklet.reservationNumber)}
          {renderRow('Ship', baseBooklet.shipName)}
          {renderRow('Sailing', `${baseBooklet.sailingDateRange || 'Date needed'} | ${baseBooklet.nights || '—'} nights`)}
          {renderRow('Itinerary', baseBooklet.itineraryName)}
          {renderRow('Stateroom', baseBooklet.stateroom)}
          {renderRow('Dining', baseBooklet.dining)}
          {renderRow('Guests', baseBooklet.guests)}
          {renderRow('Loyalty', baseBooklet.loyalty)}
        </BookletSection>

        <BookletSection accent={accent} title="Casino / Offer / Value Details">
          {renderRow('Offer code', baseBooklet.offerCode)}
          {renderRow('Offer name', baseBooklet.offerName)}
          {renderRow('Casino lines', baseBooklet.casinoLines)}
          {renderRow('Free play', baseBooklet.freePlay)}
          {renderRow('OBC', baseBooklet.onboardCredit)}
          {renderRow('Trade-in', baseBooklet.tradeInValue)}
          {renderRow('Taxes/fees', baseBooklet.taxesFees)}
          {renderRow('Paid / Balance', `${baseBooklet.amountPaid || 'Not entered'} | ${baseBooklet.balanceDue || 'Not entered'}`)}
          {renderRow('Notes', baseBooklet.casinoNotes)}
        </BookletSection>

        <BookletSection accent={accent} title="Flights / Hotels / Transfers">
          {renderRow('Flights', baseBooklet.flightsSummary)}
          {renderRow('Hotels', baseBooklet.hotelsSummary)}
          {renderRow('Transfers', baseBooklet.transfersSummary)}
        </BookletSection>

        <BookletSection accent={accent} title="Important Notes">
          <View style={styles.notesBox}>
            {notes.map((note, index) => <Text key={`${note}-${index}`} style={styles.noteText}>• {note}</Text>)}
            {baseBooklet.needsReviewFlags?.map((flag, index) => <Text key={`flag-${index}`} style={styles.reviewText}>• Review: {flag}</Text>)}
            {currentCruise && baseBooklet.currentCruiseNotes?.map((note, index) => <Text key={`current-${index}`} style={styles.currentText}>• Current cruise: {note}</Text>)}
          </View>
        </BookletSection>

        <View style={styles.footerBar}>
          <Text style={styles.footerText}>Easy Seas Cruise Itinerary Booklet • editable CRUD page • export-ready PNG template</Text>
        </View>
      </View>

      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Itinerary Page</Text>
            <TouchableOpacity onPress={() => setEditVisible(false)} style={styles.modalIconButton}>
              <X size={22} color={BOOKLET_TEXT} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalContent}>
            {EDIT_FIELDS.map(field => (
              <View key={field.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TextInput
                  value={String((draft as any)[field.key] ?? '')}
                  onChangeText={(text) => setDraft(prev => ({ ...prev, [field.key]: text }))}
                  style={[styles.input, field.multiline && styles.multilineInput]}
                  multiline={field.multiline}
                  textAlignVertical={field.multiline ? 'top' : 'center'}
                  placeholder="Not entered"
                  placeholderTextColor={BOOKLET_MUTED}
                />
              </View>
            ))}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Important Notes — one per line</Text>
              <TextInput
                value={String((draft as any).importantNotesText ?? '')}
                onChangeText={(text) => setDraft(prev => ({ ...(prev as any), importantNotesText: text } as any))}
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Needs Review Flags — one per line</Text>
              <TextInput
                value={String((draft as any).needsReviewText ?? '')}
                onChangeText={(text) => setDraft(prev => ({ ...(prev as any), needsReviewText: text } as any))}
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Cruise Notes — one per line</Text>
              <TextInput
                value={String((draft as any).currentCruiseNotesText ?? '')}
                onChangeText={(text) => setDraft(prev => ({ ...(prev as any), currentCruiseNotesText: text } as any))}
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveDraft}>
              <Save size={18} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Save Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BookletSection({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionShell}>
      <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionTable}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: BOOKLET_BG,
    ...SHADOW.medium,
  },
  toolbar: {
    backgroundColor: BOOKLET_NAVY,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  toolbarTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  toolbarTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolbarButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  exportCanvas: {
    backgroundColor: BOOKLET_BG,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  headerPill: {
    backgroundColor: BOOKLET_NAVY,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: { flex: 1, marginRight: 12 },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: '900', letterSpacing: 0.2 },
  headerSubtitle: { color: '#D7E9F4', fontSize: 12, fontWeight: '600', marginTop: 4 },
  sunBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: BOOKLET_GOLD },
  statusCard: {
    backgroundColor: BOOKLET_CARD,
    borderWidth: 1,
    borderColor: BOOKLET_LINE,
    borderRadius: 9,
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  statusLabel: { color: BOOKLET_NAVY, fontWeight: '900', fontSize: 12 },
  statusText: { color: BOOKLET_TEXT, fontSize: 12, flex: 1, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '900' },
  currentBadge: { color: COLORS.white, backgroundColor: BOOKLET_PURPLE },
  reviewBadge: { color: COLORS.white, backgroundColor: BOOKLET_ROSE },
  readyBadge: { color: COLORS.white, backgroundColor: BOOKLET_TEAL },
  sectionShell: { marginTop: 12, flexDirection: 'row' },
  sectionAccent: { width: 5, borderRadius: 999, marginRight: 10 },
  sectionBody: { flex: 1, backgroundColor: 'rgba(255,255,255,0.35)', paddingTop: 4 },
  sectionTitle: { color: BOOKLET_NAVY, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  sectionTable: { backgroundColor: BOOKLET_CARD, borderWidth: 1, borderColor: BOOKLET_LINE },
  bookletRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BOOKLET_LINE, minHeight: 25 },
  bookletRowLabel: { width: 112, color: BOOKLET_NAVY, fontWeight: '900', fontSize: 11, paddingHorizontal: 8, paddingVertical: 6 },
  bookletRowValue: { flex: 1, color: BOOKLET_TEXT, fontWeight: '600', fontSize: 11, paddingHorizontal: 8, paddingVertical: 6 },
  notesBox: { padding: 10, gap: 5 },
  noteText: { color: BOOKLET_TEXT, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  reviewText: { color: BOOKLET_ROSE, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  currentText: { color: BOOKLET_PURPLE, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  footerBar: { backgroundColor: BOOKLET_NAVY, borderRadius: 7, padding: 8, alignItems: 'center', marginTop: 18 },
  footerText: { color: '#D7E9F4', fontSize: 10, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: BOOKLET_BG },
  modalHeader: { padding: 18, backgroundColor: BOOKLET_CARD, borderBottomWidth: 1, borderBottomColor: BOOKLET_LINE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: BOOKLET_NAVY, fontSize: 22, fontWeight: '900' },
  modalIconButton: { padding: 6 },
  modalBody: { flex: 1 },
  modalContent: { padding: 18, paddingBottom: 30 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: BOOKLET_NAVY, fontWeight: '900', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: BOOKLET_CARD, borderWidth: 1, borderColor: BOOKLET_LINE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: BOOKLET_TEXT, fontWeight: '600' },
  multilineInput: { minHeight: 86 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: BOOKLET_LINE, backgroundColor: BOOKLET_CARD },
  modalButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  cancelButton: { backgroundColor: '#EEE7DC' },
  cancelButtonText: { color: BOOKLET_TEXT, fontWeight: '900' },
  saveButton: { backgroundColor: BOOKLET_NAVY },
  saveButtonText: { color: COLORS.white, fontWeight: '900' },
});

export default CruiseItineraryBooklet;
