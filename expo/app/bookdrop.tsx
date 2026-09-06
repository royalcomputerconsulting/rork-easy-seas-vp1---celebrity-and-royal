import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, BookOpen, Check, Clock3, Share2, Ticket, UserRound, X } from 'lucide-react-native';
import { BOOKDROP_BOOKS, BOOKDROP_PROMO_CODES_ASSET, type BookDropBook } from '@/lib/bookdrop/catalog';
import {
  DEFAULT_BOOKDROP_STATE,
  buildBookDropVCard,
  loadBookDropState,
  parseBookDropPromoCodes,
  saveBookDropState,
  type BookDropPromoCode,
  type BookDropState,
} from '@/lib/bookdrop/bookDropStore';
import { useAuth } from '@/state/AuthProvider';
import { useExperience } from '@/state/ExperienceProvider';
import { EasySeasSearchField, NauticalPageShell, SegmentedControl } from '@/components/ui/EasySeasPrimitives';

type BookDropTab = 'library' | 'history' | 'author';

async function assetUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('The bundled BookDrop file could not be opened.');
  return uri;
}

async function readBundledText(module: number): Promise<string> {
  const uri = await assetUri(module);
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`BookDrop resource returned ${response.status}.`);
    return response.text();
  }
  return FileSystem.readAsStringAsync(uri);
}

async function addAssetToZip(zip: JSZip, module: number, name: string): Promise<void> {
  const uri = await assetUri(module);
  const encoded = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  zip.file(name, encoded, { base64: true });
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) || 'book';
}

export default function BookDropScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { colors, minimumControlSize } = useExperience();
  const [tab, setTab] = useState<BookDropTab>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [state, setState] = useState<BookDropState>(DEFAULT_BOOKDROP_STATE);
  const [promoSource, setPromoSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookDropBook | null>(null);
  const [includePromo, setIncludePromo] = useState(false);
  const [includeContact, setIncludeContact] = useState(true);
  const [includeEpub, setIncludeEpub] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sharing, setSharing] = useState(false);
  const [qrPromo, setQrPromo] = useState<BookDropPromoCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadBookDropState(), readBundledText(BOOKDROP_PROMO_CODES_ASSET)])
      .then(([saved, source]) => {
        if (cancelled) return;
        setState(saved);
        setPromoSource(source);
      })
      .catch((error) => Alert.alert('BookDrop could not load', error instanceof Error ? error.message : 'The bundled library could not be opened.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const promoCodes = useMemo(() => parseBookDropPromoCodes(promoSource, state.promoStates), [promoSource, state.promoStates]);
  const availableCount = useMemo(() => promoCodes.filter((promo) => promo.state === 'available').length, [promoCodes]);
  const sharedCount = useMemo(() => promoCodes.filter((promo) => promo.state === 'shared' || promo.state === 'redeemed').length, [promoCodes]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(BOOKDROP_BOOKS.map((book) => book.category)))], []);
  const visibleBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BOOKDROP_BOOKS.filter((book) => {
      if (category !== 'All' && book.category !== category) return false;
      return !needle || `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(needle);
    }).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [category, query]);

  const commit = useCallback(async (next: BookDropState) => {
    setState(next);
    await saveBookDropState(next);
  }, []);

  const reservePromo = useCallback(async (): Promise<BookDropPromoCode | null> => {
    const nextPromo = promoCodes.find((promo) => promo.state === 'available') ?? null;
    if (!nextPromo) return null;
    await commit({ ...state, promoStates: { ...state.promoStates, [nextPromo.code]: 'reserved' } });
    return { ...nextPromo, state: 'reserved' };
  }, [commit, promoCodes, state]);

  const finishShare = useCallback(async (book: BookDropBook, promo: BookDropPromoCode | null, completed: boolean) => {
    const promoStates = { ...state.promoStates };
    if (promo) promoStates[promo.code] = completed ? 'shared' : 'available';
    const history = completed
      ? [{ id: `bookdrop-${Date.now()}`, date: new Date().toISOString(), bookTitle: book.title, recipient: recipient.trim() || 'Unspecified recipient', promoCode: promo?.code }, ...state.history]
      : state.history;
    await commit({ ...state, promoStates, history });
    if (completed) {
      setSelectedBook(null);
      setRecipient('');
      setIncludePromo(false);
      setIncludeEpub(false);
    }
  }, [commit, recipient, state]);

  const shareSelectedBook = useCallback(async () => {
    if (!selectedBook || sharing) return;
    if (Platform.OS === 'web') {
      Alert.alert('Use BookDrop on iPhone', 'The protected offline manuscript bundle is shared through the native iOS share sheet.');
      return;
    }
    setSharing(true);
    let promo: BookDropPromoCode | null = null;
    try {
      promo = includePromo ? await reservePromo() : null;
      if (includePromo && !promo) throw new Error('No unused Easy Seas offer codes remain.');
      const zip = new JSZip();
      await addAssetToZip(zip, selectedBook.primaryAsset, selectedBook.primaryName);
      if (includeEpub && selectedBook.alternateAsset && selectedBook.alternateName) {
        await addAssetToZip(zip, selectedBook.alternateAsset, selectedBook.alternateName);
      }
      if (includeContact) zip.file('Scott-A-Astin.vcf', buildBookDropVCard(state.author));
      if (promo) zip.file('Easy-Seas-App-Offer.txt', `Easy Seas offer code: ${promo.code}\n\nRedeem: ${promo.url}\n`);
      zip.file('README.txt', `${selectedBook.title}\n${selectedBook.subtitle}\n\nShared from BookDrop inside Easy Seas.`);
      const encoded = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const uri = `${FileSystem.cacheDirectory}BookDrop-${safeFileName(selectedBook.title)}.zip`;
      await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('The iOS share sheet is not available on this device.');
      await Sharing.shareAsync(uri, { dialogTitle: `Share ${selectedBook.title}`, mimeType: 'application/zip', UTI: 'public.zip-archive' });
      const selected = selectedBook;
      Alert.alert('Did the share complete?', 'BookDrop will record the recipient and consume the offer code only after you confirm.', [
        { text: 'No, release it', style: 'cancel', onPress: () => { void finishShare(selected, promo, false); } },
        { text: 'Yes, record it', onPress: () => { void finishShare(selected, promo, true); } },
      ]);
    } catch (error) {
      if (promo && selectedBook) await finishShare(selectedBook, promo, false);
      Alert.alert('Book was not shared', error instanceof Error ? error.message : 'The share bundle could not be created.');
    } finally {
      setSharing(false);
    }
  }, [finishShare, includeContact, includeEpub, includePromo, reservePromo, selectedBook, sharing, state.author]);

  const showPromoQr = useCallback(async () => {
    if (!selectedBook) return;
    const promo = await reservePromo();
    if (!promo) {
      Alert.alert('No offer codes available', 'All Easy Seas offer codes are already reserved, shared, redeemed, or unavailable.');
      return;
    }
    setQrPromo(promo);
  }, [reservePromo, selectedBook]);

  if (!isAdmin) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><Stack.Screen options={{ headerShown: false }} /><View style={styles.denied}><Ticket size={40} color={colors.accentSecondary} /><Text style={[styles.deniedTitle, { color: colors.text }]}>Admin use only</Text><Text style={[styles.deniedCopy, { color: colors.muted }]}>BookDrop is available only to the Easy Seas owner account.</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => router.back()}><Text style={styles.primaryButtonText}>Return to Settings</Text></TouchableOpacity></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
        <TouchableOpacity style={[styles.iconButton, { minWidth: minimumControlSize, minHeight: minimumControlSize }]} onPress={() => router.back()} accessibilityLabel="Return to Settings"><ArrowLeft size={21} color={colors.accent} /></TouchableOpacity>
        <View style={styles.topCopy}><Text style={[styles.eyebrow, { color: colors.accentSecondary }]}>ADMIN USE ONLY</Text><Text style={[styles.topTitle, { color: colors.text }]}>BookDrop</Text></View>
        <View style={[styles.codeCount, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}><Ticket size={15} color={colors.accentSecondary} /><Text style={[styles.codeCountText, { color: colors.text }]}>{availableCount}</Text></View>
      </View>
      <SegmentedControl<BookDropTab>
        options={[{ value: 'library', label: 'Library' }, { value: 'history', label: 'History' }, { value: 'author', label: 'Author' }]}
        value={tab}
        onChange={setTab}
        accessibilityLabel="BookDrop sections"
      />
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accentSecondary} /><Text style={{ color: colors.muted }}>Opening the offline library…</Text></View> : null}
      {!loading && tab === 'library' ? (
        <NauticalPageShell contentContainerStyle={styles.content} testID="bookdrop-library">
          <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
            <View style={styles.heroCopy}><Text style={[styles.heroTitle, { color: colors.text }]}>Scott’s Library</Text><Text style={[styles.heroSubtitle, { color: colors.muted }]}>12 books ready to share offline</Text></View>
            <View style={styles.heroMetric}><Text style={[styles.heroMetricValue, { color: colors.accentSecondary }]}>{availableCount}</Text><Text style={[styles.heroMetricLabel, { color: colors.muted }]}>offer codes</Text></View>
          </View>
          <EasySeasSearchField value={query} onChangeText={setQuery} placeholder="Search books or categories" label="Search BookDrop" testID="bookdrop-search" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {categories.map((item) => {
              const active = item === category;
              return <TouchableOpacity key={item} style={[styles.chip, { borderColor: active ? colors.accentSecondary : colors.border, backgroundColor: active ? colors.surfaceMuted : colors.surfaceRaised }]} onPress={() => setCategory(item)} accessibilityState={{ selected: active }}><Text style={[styles.chipText, { color: active ? colors.accent : colors.muted }]}>{item}</Text></TouchableOpacity>;
            })}
          </ScrollView>
          <View style={styles.libraryGrid}>
            {visibleBooks.map((book) => (
              <TouchableOpacity key={book.id} style={[styles.bookCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]} onPress={() => setSelectedBook(book)} activeOpacity={0.82} testID={`bookdrop-book-${book.id}`}>
                <Image source={book.cover} style={styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors />
                <View style={styles.bookCopy}>{book.featured ? <Text style={[styles.featured, { color: colors.accentSecondary }]}>FEATURED</Text> : null}<Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={3}>{book.title}</Text><Text style={[styles.bookCategory, { color: colors.muted }]}>{book.category}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        </NauticalPageShell>
      ) : null}
      {!loading && tab === 'history' ? (
        <NauticalPageShell contentContainerStyle={styles.content} testID="bookdrop-history">
          <View style={styles.metricRow}><View style={[styles.metric, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}><Text style={[styles.metricValue, { color: colors.accentSecondary }]}>{availableCount}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>Available codes</Text></View><View style={[styles.metric, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}><Text style={[styles.metricValue, { color: colors.accentSecondary }]}>{sharedCount}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>Shared or redeemed</Text></View></View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent shares</Text>
          {state.history.length === 0 ? <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}><Clock3 size={30} color={colors.accentSecondary} /><Text style={[styles.emptyTitle, { color: colors.text }]}>No shares yet</Text><Text style={[styles.emptyCopy, { color: colors.muted }]}>Completed BookDrop shares will appear here.</Text></View> : state.history.map((record) => <View key={record.id} style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}><BookOpen size={18} color={colors.accentSecondary} /><View style={styles.historyCopy}><Text style={[styles.historyTitle, { color: colors.text }]}>{record.bookTitle}</Text><Text style={[styles.historyMeta, { color: colors.muted }]}>{record.recipient} · {new Date(record.date).toLocaleString()}</Text>{record.promoCode ? <Text style={[styles.historyPromo, { color: colors.accentSecondary }]}>Offer {record.promoCode}</Text> : null}</View></View>)}
        </NauticalPageShell>
      ) : null}
      {!loading && tab === 'author' ? (
        <NauticalPageShell contentContainerStyle={styles.content} testID="bookdrop-author">
          <View style={[styles.authorCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
            <View style={styles.authorHeading}><UserRound size={23} color={colors.accentSecondary} /><View><Text style={[styles.sectionTitle, { color: colors.text }]}>Author contact card</Text><Text style={[styles.authorHint, { color: colors.muted }]}>Included only when you choose it while sharing.</Text></View></View>
            {(['name', 'email', 'phone', 'website'] as const).map((field) => <View key={field} style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.muted }]}>{field[0].toUpperCase() + field.slice(1)}</Text><TextInput value={state.author[field]} onChangeText={(value) => setState((current) => ({ ...current, author: { ...current.author, [field]: value } }))} onBlur={() => { void saveBookDropState(state); }} autoCapitalize={field === 'email' || field === 'website' ? 'none' : 'words'} keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholderTextColor={colors.muted} /></View>)}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => { void commit(state); Alert.alert('Author card saved', 'BookDrop will use these details for future shares.'); }} testID="bookdrop-save-author"><Check size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Save contact card</Text></TouchableOpacity>
          </View>
        </NauticalPageShell>
      ) : null}

      <Modal visible={Boolean(selectedBook)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedBook(null)}>
        {selectedBook ? <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.detailContent}><TouchableOpacity style={styles.closeButton} onPress={() => setSelectedBook(null)} accessibilityLabel="Close BookDrop book"><X size={22} color={colors.text} /></TouchableOpacity><Image source={selectedBook.cover} style={styles.detailCover} resizeMode="cover" accessibilityIgnoresInvertColors /><Text style={[styles.detailTitle, { color: colors.text }]}>{selectedBook.title}</Text><Text style={[styles.detailSubtitle, { color: colors.muted }]}>{selectedBook.subtitle}</Text><Text style={[styles.detailCategory, { color: colors.accentSecondary }]}>{selectedBook.category.toUpperCase()}</Text><View style={[styles.shareCard, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>Prepare share</Text><TextInput value={recipient} onChangeText={setRecipient} placeholder="Recipient name (optional)" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />{[[includePromo, setIncludePromo, 'Include Easy Seas offer code', `${availableCount} available`], [includeContact, setIncludeContact, 'Include author contact card', 'VCF'], [includeEpub, setIncludeEpub, 'Include EPUB edition', selectedBook.alternateAsset ? 'Available' : 'Not available']].map(([value, setter, label, detail]) => <TouchableOpacity key={String(label)} style={[styles.optionRow, { borderBottomColor: colors.border }]} onPress={() => typeof setter === 'function' && setter(!value)} disabled={label === 'Include EPUB edition' && !selectedBook.alternateAsset}><View style={[styles.checkbox, { borderColor: value ? colors.accentSecondary : colors.border, backgroundColor: value ? colors.accentSecondary : 'transparent' }]}>{value ? <Check size={14} color="#FFFFFF" /> : null}</View><View style={styles.optionCopy}><Text style={[styles.optionLabel, { color: selectedBook.alternateAsset || label !== 'Include EPUB edition' ? colors.text : colors.muted }]}>{String(label)}</Text><Text style={[styles.optionDetail, { color: colors.muted }]}>{String(detail)}</Text></View></TouchableOpacity>)}<TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => { void shareSelectedBook(); }} disabled={sharing} testID="bookdrop-share-book">{sharing ? <ActivityIndicator color="#FFFFFF" /> : <Share2 size={18} color="#FFFFFF" />}<Text style={styles.primaryButtonText}>{sharing ? 'Preparing offline bundle…' : 'Open AirDrop & Share'}</Text></TouchableOpacity><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.accentSecondary }]} onPress={() => { void showPromoQr(); }} testID="bookdrop-show-qr"><Ticket size={17} color={colors.accentSecondary} /><Text style={[styles.secondaryButtonText, { color: colors.accentSecondary }]}>Show promo QR instead</Text></TouchableOpacity></View></ScrollView></SafeAreaView> : null}
      </Modal>

      <Modal visible={Boolean(qrPromo)} transparent animationType="fade" onRequestClose={() => { if (qrPromo && selectedBook) void finishShare(selectedBook, qrPromo, false); setQrPromo(null); }}>
        <View style={styles.qrBackdrop}><View style={[styles.qrCard, { backgroundColor: colors.surfaceRaised }]}>{qrPromo ? <><Text style={[styles.qrTitle, { color: colors.text }]}>Easy Seas Promo</Text><View style={styles.qrImage}><QRCode value={qrPromo.url} size={220} color="#0F2247" backgroundColor="#FFFFFF" /></View><Text style={[styles.qrCode, { color: colors.text }]} selectable>{qrPromo.code}</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => { if (selectedBook) void finishShare(selectedBook, qrPromo, true); setQrPromo(null); }}><Check size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Mark as shared</Text></TouchableOpacity><TouchableOpacity style={styles.qrCancel} onPress={() => { if (selectedBook) void finishShare(selectedBook, qrPromo, false); setQrPromo(null); }}><Text style={[styles.secondaryButtonText, { color: colors.muted }]}>Cancel and release code</Text></TouchableOpacity></> : null}</View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, modalSafe: { flex: 1 },
  topBar: { paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  iconButton: { alignItems: 'center', justifyContent: 'center' }, topCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, topTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 27, lineHeight: 31 },
  codeCount: { minWidth: 62, height: 38, paddingHorizontal: 10, borderWidth: 1, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, codeCountText: { fontSize: 14, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, content: { padding: 12, paddingBottom: 32, gap: 12 },
  hero: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center' }, heroCopy: { flex: 1 }, heroTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 26 }, heroSubtitle: { fontSize: 13, marginTop: 3 }, heroMetric: { alignItems: 'center' }, heroMetricValue: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 25 }, heroMetricLabel: { fontSize: 10 },
  chips: { gap: 7, paddingVertical: 1 }, chip: { borderWidth: 1, borderRadius: 18, minHeight: 36, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }, chipText: { fontSize: 12, fontWeight: '700' },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, bookCard: { width: '48.5%', borderWidth: 1, borderRadius: 16, overflow: 'hidden' }, cover: { width: '100%', aspectRatio: 0.69, backgroundColor: '#E8EDF0' }, bookCopy: { padding: 10, minHeight: 94 }, featured: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 }, bookTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 17, lineHeight: 20 }, bookCategory: { marginTop: 5, fontSize: 11, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 10 }, metric: { flex: 1, padding: 16, borderWidth: 1, borderRadius: 16 }, metricValue: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 30 }, metricLabel: { fontSize: 12 }, sectionTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 21 },
  emptyCard: { alignItems: 'center', padding: 28, borderWidth: 1, borderRadius: 18, gap: 7 }, emptyTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 20 }, emptyCopy: { fontSize: 13, textAlign: 'center' },
  historyRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10 }, historyCopy: { flex: 1 }, historyTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 16 }, historyMeta: { fontSize: 11, marginTop: 3 }, historyPromo: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  authorCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 }, authorHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, authorHint: { fontSize: 12, marginTop: 2 }, inputGroup: { gap: 5 }, inputLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, secondaryButtonText: { fontSize: 13, fontWeight: '800' },
  denied: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 12 }, deniedTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 28 }, deniedCopy: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  detailContent: { padding: 18, alignItems: 'center', paddingBottom: 36 }, closeButton: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, detailCover: { width: 190, height: 284, borderRadius: 14, backgroundColor: '#E8EDF0' }, detailTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 28, lineHeight: 33, textAlign: 'center', marginTop: 16 }, detailSubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 340 }, detailCategory: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 }, shareCard: { width: '100%', borderWidth: 1, borderRadius: 18, padding: 15, gap: 12, marginTop: 18 },
  optionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, optionCopy: { flex: 1 }, optionLabel: { fontSize: 14, fontWeight: '700' }, optionDetail: { fontSize: 11, marginTop: 2 },
  qrBackdrop: { flex: 1, backgroundColor: 'rgba(8,22,35,.66)', alignItems: 'center', justifyContent: 'center', padding: 24 }, qrCard: { width: '100%', maxWidth: 360, borderRadius: 22, padding: 22, alignItems: 'center', gap: 16 }, qrTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 27 }, qrImage: { padding: 14, borderRadius: 12, backgroundColor: '#FFFFFF' }, qrCode: { fontSize: 14, fontWeight: '800', letterSpacing: 0.7 }, qrCancel: { paddingVertical: 10 },
});
