import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, FileUp, ShieldCheck } from 'lucide-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionCard } from '@/components/ui/ThemedSectionCard';
import { EASY_SEAS_UX, TYPOGRAPHY } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { decodeBase64Bytes } from '@/lib/certificates/certificateBinaryTransport';
import { buildCruiseInvoicePatch, scoreCruiseInvoiceMatch, type ParsedCruiseInvoice } from '@/lib/casino/cruiseInvoiceParser';
import { parseRoyalCruiseInvoicePdf } from '@/lib/casino/royalReceiptPdf';
import type { BookedCruise } from '@/types/models';

const C = { navy: EASY_SEAS_UX.color.brandNavy, teal: EASY_SEAS_UX.color.oceanTeal, gold: '#E6B63D', ink: EASY_SEAS_UX.color.textStrong, muted: EASY_SEAS_UX.color.textMuted, bg: EASY_SEAS_UX.color.canvas, card: EASY_SEAS_UX.color.surface, border: EASY_SEAS_UX.color.border, warn: '#9a5019' };
const dollars = (value: number | null) => value == null ? 'Not found' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CruiseInvoiceImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cruiseId?: string }>();
  const { bookedCruises, updateBookedCruise } = useCoreData();
  const [invoice, setInvoice] = useState<ParsedCruiseInvoice | null>(null);
  const [source, setSource] = useState<{ uri: string; name: string } | null>(null);
  const [selectedCruiseId, setSelectedCruiseId] = useState(String(params.cruiseId ?? ''));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const selected = bookedCruises.find((cruise) => cruise.id === selectedCruiseId) ?? null;
  const ranked = useMemo(() => invoice ? bookedCruises.map((cruise) => ({ cruise, score: scoreCruiseInvoiceMatch(invoice, cruise) })).sort((a, b) => b.score - a.score) : [], [bookedCruises, invoice]);

  const choosePdf = async () => {
    try {
      setBusy(true); setSaved(false);
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const parsed = parseRoyalCruiseInvoicePdf(decodeBase64Bytes(base64));
      setSource({ uri: asset.uri, name: asset.name || 'Cruise_Vacation_Receipt.pdf' });
      setInvoice(parsed);
      const best = bookedCruises.map((cruise) => ({ cruise, score: scoreCruiseInvoiceMatch(parsed, cruise) })).sort((a, b) => b.score - a.score)[0];
      if ((!selectedCruiseId || !bookedCruises.some((cruise) => cruise.id === selectedCruiseId)) && best?.score >= 40) setSelectedCruiseId(best.cruise.id);
    } catch (error) {
      Alert.alert('Receipt could not be read', error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!invoice || !source || !selected) return;
    try {
      setBusy(true);
      const base = FileSystem.documentDirectory;
      if (!base) throw new Error('Secure local document storage is unavailable on this device.');
      const folder = `${base}EasySeasInvoices/${selected.id}/`;
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      const safeName = source.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const retainedUri = `${folder}${Date.now()}-${safeName}`;
      await FileSystem.copyAsync({ from: source.uri, to: retainedUri });
      const documents = Array.from(new Set([...(selected.documents ?? []), retainedUri]));
      updateBookedCruise(selected.id, { ...buildCruiseInvoicePatch(invoice, source.name, retainedUri), documents });
      setSaved(true);
    } catch (error) {
      Alert.alert('Receipt was not saved', error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };

  return <LinearGradient colors={[C.bg, EASY_SEAS_UX.color.sand]} style={s.root}>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ResponsiveContainer>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Go back"><ArrowLeft color={C.navy} size={21} /></TouchableOpacity>
            <View style={s.headerCopy}><Text style={s.eyebrow}>CRUISE DOCUMENTS</Text><Text style={s.title}>Load a receipt</Text><Text style={s.subtitle}>Preview, match, then confirm.</Text></View>
          </View>

          <ThemedSectionCard tab="booked" emoji="📄" title="Receipt file" subtitle="Royal Cruise Vacation Receipt PDF" compact>
            <View style={s.notice}><ShieldCheck size={19} color={C.teal} /><Text style={s.noticeText}>The PDF stays on this device. Nothing changes until you select a cruise and confirm.</Text></View>
            <TouchableOpacity style={s.primary} onPress={() => void choosePdf()} disabled={busy} testID="invoice-select-pdf" accessibilityRole="button"><FileUp color="#fff" size={19} /><Text style={s.primaryText}>{invoice ? 'Choose a different receipt' : 'Choose Royal receipt PDF'}</Text></TouchableOpacity>
            {busy ? <ActivityIndicator color={C.teal} style={s.busy} /> : null}
          </ThemedSectionCard>

          {invoice ? <>
            <ThemedSectionCard tab="booked" emoji="🧾" title="Extracted values" subtitle="Review every value before saving" compact>
              <Line label="Reservation" value={invoice.reservationId ?? 'Not found'} /><Line label="Ship / sail date" value={`${invoice.shipName ?? 'Not found'} · ${invoice.sailDate ?? 'Not found'}`} /><Line label="Issue date" value={invoice.issueDate ?? 'Not found'} /><Line label="Offer / certificate" value={invoice.offerCode ?? invoice.specialServices ?? 'Not found'} /><Line label="Cruise fare (retail)" value={dollars(invoice.cruiseFare)} /><Line label="Casino discounts" value={dollars(invoice.casinoCompValue)} /><Line label="Taxes / total charge" value={`${dollars(invoice.taxesFees)} / ${dollars(invoice.totalCharge)}`} /><Line label="Amount paid / balance" value={`${dollars(invoice.amountPaid)} / ${dollars(invoice.balanceDue)}`} /><Line label="FreePlay / OBC" value={`${dollars(invoice.freePlay)} / ${dollars(invoice.onboardCredit)}`} />
              <Text style={s.confidence}>Parser confidence: {invoice.confidence.toUpperCase()}</Text>{invoice.warnings.map((warning) => <Text key={warning} style={s.warning}>⚠ {warning}</Text>)}
            </ThemedSectionCard>

            <ThemedSectionCard tab="booked" emoji="🚢" title="Match voyage" subtitle="Reservation number is strongest; ship plus exact sailing date is next" compact>
              <Text style={s.help}>The best matches appear first. Tap a row to override the suggested voyage.</Text>
              <ScrollView style={s.matchList} nestedScrollEnabled showsVerticalScrollIndicator={ranked.length > 4}>
                {ranked.slice(0, 30).map(({ cruise, score }) => <TouchableOpacity key={cruise.id} style={[s.cruise, selectedCruiseId === cruise.id && s.cruiseSelected]} onPress={() => setSelectedCruiseId(cruise.id)} accessibilityRole="button" accessibilityState={{ selected: selectedCruiseId === cruise.id }}><View style={s.cruiseCopy}><Text style={s.cruiseName}>{cruise.shipName}</Text><Text style={s.cruiseDate}>{cruise.sailDate || 'Date not recorded'} · Reservation {cruise.reservationNumber ?? cruise.bookingId ?? 'not saved'}</Text></View><Text style={s.match}>{score >= 100 ? 'Reservation match' : score >= 70 ? 'Ship + date' : score > 0 ? 'Possible' : ''}</Text></TouchableOpacity>)}
              </ScrollView>
            </ThemedSectionCard>

            <TouchableOpacity style={[s.confirm, (!selected || busy) && s.disabled]} disabled={!selected || busy} onPress={() => void save()} testID="invoice-confirm-import" accessibilityRole="button"><CheckCircle2 size={20} color="#fff" /><Text style={s.confirmText}>Confirm and save to {selected?.shipName ?? 'selected cruise'}</Text></TouchableOpacity>
            {saved ? <View style={s.success}><CheckCircle2 color={C.teal} /><Text style={s.successText}>Receipt retained locally and cruise value fields updated.</Text></View> : null}
          </> : null}
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  </LinearGradient>;
}

function Line({ label, value }: { label: string; value: string }) { return <View style={s.line}><Text style={s.lineLabel}>{label}</Text><Text style={s.lineValue}>{value}</Text></View>; }
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: C.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 3, color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 29, lineHeight: 34 },
  subtitle: { marginTop: 3, color: C.muted, fontSize: 13, lineHeight: 18 },
  notice: { backgroundColor: EASY_SEAS_UX.color.seafoam, padding: 12, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 12 },
  noticeText: { flex: 1, color: C.ink, fontSize: 12, lineHeight: 17 },
  primary: { minHeight: 48, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  busy: { margin: 18 },
  line: { minHeight: 42, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  lineLabel: { color: C.muted, fontSize: 12, flexShrink: 1 },
  lineValue: { color: C.ink, fontWeight: '800', fontSize: 12, textAlign: 'right', flex: 1 },
  confidence: { marginTop: 10, color: C.teal, fontWeight: '900', fontSize: 11 },
  warning: { color: C.warn, fontSize: 11, lineHeight: 16, marginTop: 5 },
  help: { color: C.muted, fontSize: 11, lineHeight: 16, marginBottom: 2 },
  matchList: { maxHeight: 420 },
  cruise: { minHeight: 64, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: C.border, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card },
  cruiseSelected: { borderColor: C.gold, backgroundColor: EASY_SEAS_UX.color.sand },
  cruiseCopy: { flex: 1, minWidth: 0 },
  cruiseName: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 16, fontWeight: '600' },
  cruiseDate: { color: C.muted, fontSize: 10, marginTop: 3 },
  match: { color: C.teal, fontWeight: '900', fontSize: 9, textAlign: 'right', maxWidth: 92 },
  confirm: { minHeight: 50, backgroundColor: C.navy, borderRadius: 13, paddingHorizontal: 15, marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#fff', fontWeight: '900', flexShrink: 1 },
  disabled: { opacity: 0.45 },
  success: { backgroundColor: EASY_SEAS_UX.color.seafoam, padding: 13, borderRadius: 12, marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  successText: { color: C.ink, fontWeight: '800', flex: 1 },
});
