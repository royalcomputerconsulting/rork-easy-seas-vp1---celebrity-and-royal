import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react-native';
import { EASY_SEAS_COMPONENT_TOKENS, EASY_SEAS_TYPE_STYLES, EASY_SEAS_UX, TYPOGRAPHY } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

const C = EASY_SEAS_UX.color;

export type EasySeasStatus = 'available' | 'booked' | 'completed' | 'alert' | 'historical' | 'max' | 'missing' | 'estimated' | 'derived' | 'reconciled' | 'success' | 'info' | 'loading' | 'empty' | 'offline' | 'error' | 'partial-success';

const STATUS_STYLE: Record<EasySeasStatus, { fg: string; bg: string; label: string }> = {
  available: { fg: C.success, bg: C.successSoft, label: 'Available' },
  booked: { fg: C.info, bg: C.infoSoft, label: 'Booked' },
  completed: { fg: C.textMuted, bg: '#EEF1F3', label: 'Completed' },
  alert: { fg: C.danger, bg: C.dangerSoft, label: 'Alert' },
  historical: { fg: C.textMuted, bg: '#EEF1F3', label: 'Historical' },
  max: { fg: C.warning, bg: C.warningSoft, label: 'Max level' },
  missing: { fg: C.danger, bg: C.dangerSoft, label: 'Missing' },
  estimated: { fg: C.warning, bg: C.warningSoft, label: 'Estimated' },
  derived: { fg: C.info, bg: C.infoSoft, label: 'Derived' },
  reconciled: { fg: C.success, bg: C.successSoft, label: 'Reconciled' },
  success: { fg: C.success, bg: C.successSoft, label: 'Ready' },
  info: { fg: C.info, bg: C.infoSoft, label: 'Information' },
  loading: { fg: C.oceanTeal, bg: C.seafoam, label: 'Loading' },
  empty: { fg: C.textMuted, bg: '#EEF1F3', label: 'No records' },
  offline: { fg: C.warning, bg: C.warningSoft, label: 'Offline' },
  error: { fg: C.danger, bg: C.dangerSoft, label: 'Needs attention' },
  'partial-success': { fg: C.warning, bg: C.warningSoft, label: 'Partially complete' },
};

export type DataStateKind = 'loading' | 'empty' | 'missing' | 'estimated' | 'reconciled' | 'offline' | 'error' | 'partial-success' | 'success';

/**
 * Shared page canvas for every tab and nested screen. The gradient is a
 * restrained nautical wash, not decorative content, and therefore keeps all
 * existing children, scrolling, and actions unchanged.
 */
export function NauticalPageShell({
  children,
  scroll = true,
  contentContainerStyle,
  style,
  testID,
}: React.PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  const { colors } = useExperience();
  const content = scroll
    ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.pageShellContent, contentContainerStyle]}>{children}</ScrollView>
    : <View style={[styles.pageShellContent, styles.pageShellFlex, contentContainerStyle]}>{children}</View>;
  return (
    <LinearGradient colors={colors.pageGradient} style={[styles.pageShell, style]} testID={testID}>
      {content}
    </LinearGradient>
  );
}

export function PageHeader({
  title,
  context,
  primaryAction,
  overflowAction,
  testID,
}: {
  title: string;
  context?: string;
  primaryAction?: { label: string; onPress: () => void };
  overflowAction?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { colors, textScale, minimumControlSize } = useExperience();
  return <View style={styles.pageHeader} testID={testID ?? 'easy-seas-page-header'}>
    <View style={styles.pageHeaderCopy}>
      <Text style={[styles.pageTitle, { color: colors.text, fontSize: Math.min(40, 30 * textScale), lineHeight: Math.min(46, 36 * textScale) }]} accessibilityRole="header">{title}</Text>
      {context ? <Text style={[styles.pageContext, { color: colors.muted, fontSize: Math.min(20, 15 * textScale) }]}>{context}</Text> : null}
    </View>
    <View style={styles.pageActions}>
      {primaryAction ? <Pressable style={[styles.headerPrimary, { minHeight: minimumControlSize, backgroundColor: colors.accent }]} onPress={primaryAction.onPress} accessibilityRole="button" accessibilityLabel={primaryAction.label}><Text style={[styles.headerPrimaryText, { color: colors.inverseText }]}>{primaryAction.label}</Text></Pressable> : null}
      {overflowAction ? <Pressable style={[styles.headerOverflow, { width: minimumControlSize, height: minimumControlSize, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]} onPress={overflowAction.onPress} accessibilityRole="button" accessibilityLabel={overflowAction.label}><MoreHorizontal size={22} color={colors.accent} /></Pressable> : null}
    </View>
  </View>;
}

export function ThemedSectionCard({
  artwork,
  eyebrow,
  title,
  summary,
  children,
  testID,
}: React.PropsWithChildren<{
  artwork: ImageSourcePropType;
  eyebrow?: string;
  title: string;
  summary?: string;
  testID?: string;
}>) {
  const { colors, preferences, textScale } = useExperience();
  return <ImageBackground source={artwork} style={[styles.themedCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} imageStyle={styles.themedArtwork} testID={testID} accessibilityLabel={`${title}${summary ? `. ${summary}` : ''}`}>
    <LinearGradient colors={preferences.theme === 'high-contrast' ? ['#000000', '#000000'] : ['rgba(255,253,249,.97)', 'rgba(255,253,249,.76)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.themedOverlay}>
      {eyebrow ? <Text style={[styles.themedEyebrow, { color: colors.accentSecondary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.themedTitle, { color: colors.heroText, fontSize: Math.min(37, 27 * textScale), lineHeight: Math.min(43, 32 * textScale) }]} accessibilityRole="header">{title}</Text>
      {summary ? <Text style={[styles.themedSummary, { color: colors.muted, fontSize: Math.min(20, 14 * textScale) }]}>{summary}</Text> : null}
      {children ? <View style={styles.themedContent}>{children}</View> : null}
    </LinearGradient>
  </ImageBackground>;
}

export function StatusBadge({ status, label, testID }: { status: EasySeasStatus; label?: string; testID?: string }) {
  const tone = STATUS_STYLE[status];
  return <View style={[styles.badge, { backgroundColor: tone.bg }]} testID={testID} accessibilityLabel={label ?? tone.label}><Text style={[styles.badgeText, { color: tone.fg }]}>{label ?? tone.label}</Text></View>;
}

export function EasySeasSearchField(props: TextInputProps & { label?: string }) {
  const { colors, minimumControlSize } = useExperience();
  return <View style={[styles.searchShell, { minHeight: Math.max(48, minimumControlSize), borderColor: colors.border, backgroundColor: colors.surfaceRaised }]} accessible={false}><Search size={18} color={colors.muted} /><TextInput {...props} style={[styles.searchInput, { color: colors.text }, props.style]} placeholderTextColor={colors.muted} accessibilityLabel={props.label ?? props.placeholder ?? 'Search'} /></View>;
}

export function FilterButton({ activeCount = 0, onPress, label = 'Filters' }: { activeCount?: number; onPress: () => void; label?: string }) {
  const { colors, minimumControlSize } = useExperience();
  return <Pressable style={[styles.filterButton, { minHeight: minimumControlSize, borderColor: activeCount ? colors.accentSecondary : colors.border, backgroundColor: activeCount ? colors.surfaceMuted : colors.surfaceRaised }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${activeCount ? `, ${activeCount} active` : ''}`}><SlidersHorizontal size={17} color={colors.accent} /><Text style={[styles.controlText, { color: colors.accent }]}>{label}</Text>{activeCount > 0 ? <View style={[styles.count, { backgroundColor: colors.accent }]}><Text style={[styles.countText, { color: colors.inverseText }]}>{activeCount}</Text></View> : null}</Pressable>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void; accessibilityLabel?: string }) {
  const { colors, minimumControlSize } = useExperience();
  return <View style={[styles.segmented, { minHeight: minimumControlSize, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]} accessibilityLabel={accessibilityLabel} accessibilityRole="tablist">{options.map((option) => { const selected = option.value === value; return <Pressable key={option.value} style={[styles.segment, selected && styles.segmentSelected, selected && { backgroundColor: colors.surfaceMuted, borderColor: colors.accentSecondary }]} onPress={() => onChange(option.value)} accessibilityRole="tab" accessibilityState={{ selected }}><Text numberOfLines={2} style={[styles.segmentText, { color: colors.muted }, selected && styles.segmentTextSelected, selected && { color: colors.accent }]}>{option.label}</Text></Pressable>; })}</View>;
}

export function MetricCard({ label, value, unit, status, detail, onPress }: { label: string; value: string; unit?: string; status?: EasySeasStatus; detail?: string; onPress?: () => void }) {
  const content = <><View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text>{status ? <StatusBadge status={status} /> : null}</View><View style={styles.metricValueRow}><Text style={styles.metricValue}>{value}</Text>{unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}</View>{detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}{onPress ? <ChevronRight size={18} color={C.textMuted} style={styles.chevron} /> : null}</>;
  return onPress ? <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}${unit ? ` ${unit}` : ''}. View details`}>{content}</Pressable> : <View style={styles.card} accessible accessibilityLabel={`${label}, ${value}${unit ? ` ${unit}` : ''}`}>{content}</View>;
}

export function AlertCard({ severity, title, summary, meta, actionLabel, onAction }: { severity: 'info' | 'warning' | 'danger'; title: string; summary: string; meta?: string; actionLabel?: string; onAction?: () => void }) {
  const tones = severity === 'danger' ? { fg: C.danger, bg: C.dangerSoft } : severity === 'warning' ? { fg: C.warning, bg: C.warningSoft } : { fg: C.info, bg: C.infoSoft };
  return <View style={[styles.alert, { borderLeftColor: tones.fg, backgroundColor: tones.bg }]}><Text style={[styles.alertTitle, { color: tones.fg }]}>{title}</Text>{meta ? <Text style={styles.alertMeta}>{meta}</Text> : null}<Text style={styles.alertSummary}>{summary}</Text>{actionLabel && onAction ? <Pressable style={styles.inlineAction} onPress={onAction} accessibilityRole="button"><Text style={styles.inlineActionText}>{actionLabel}</Text></Pressable> : null}</View>;
}

export function EmptyState({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text>{actionLabel && onAction ? <Pressable style={styles.primaryButton} onPress={onAction} accessibilityRole="button"><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}</View>;
}

export function DefinitionList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return <View style={styles.definitionList}>{rows.map((row, index) => <View key={`${row.label}-${index}`} style={[styles.definitionRow, index > 0 && styles.definitionDivider]}><Text style={styles.definitionLabel}>{row.label}</Text><Text style={styles.definitionValue}>{row.value}</Text></View>)}</View>;
}

export function DetailSheet({ visible, title, onClose, children }: React.PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const { colors, preferences, minimumControlSize } = useExperience();
  const { height, width } = useWindowDimensions();
  const landscape = width > height;
  return <Modal visible={visible} animationType={preferences.reducedMotion ? 'none' : 'slide'} presentationStyle="pageSheet" statusBarTranslucent={false} navigationBarTranslucent={false} onRequestClose={onClose}><SafeAreaView edges={['top', 'bottom']} style={[styles.sheet, { backgroundColor: colors.background }]} testID="easy-seas-responsive-sheet"><View style={[styles.sheetHeader, landscape && styles.sheetHeaderLandscape, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}><Text numberOfLines={2} style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text><Pressable style={[styles.close, { width: minimumControlSize, height: minimumControlSize }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close ${title}`}><X size={21} color={colors.accent} /></Pressable></View><ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={[styles.sheetContent, landscape && styles.sheetContentLandscape]}>{children}</ScrollView></SafeAreaView></Modal>;
}

export function InlineLoading({ label = 'Loading…' }: { label?: string }) {
  return <View style={styles.loading} accessibilityRole="progressbar"><ActivityIndicator color={C.oceanTeal} /><Text style={styles.loadingText}>{label}</Text></View>;
}

/**
 * Canonical truthful state surface. It never presents a zero as a completed
 * answer while a repository is loading or unavailable, and it distinguishes
 * estimates, partial output, durable commits, and offline fallback data.
 */
export function DataStateCard({
  kind,
  title,
  reason,
  current,
  total,
  currentItem,
  committed,
  sourceLabel,
  updatedAt,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testID,
}: {
  kind: DataStateKind;
  title: string;
  reason: string;
  current?: number;
  total?: number;
  currentItem?: string;
  committed?: boolean;
  sourceLabel?: string;
  updatedAt?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
}) {
  const tone = STATUS_STYLE[kind];
  const progress = typeof total === 'number' && total > 0
    ? Math.max(0, Math.min(1, (current ?? 0) / total))
    : null;
  const StateIcon = kind === 'success' || kind === 'reconciled'
    ? CheckCircle2
    : kind === 'error'
      ? XCircle
      : kind === 'offline'
        ? WifiOff
        : kind === 'partial-success' || kind === 'estimated'
          ? AlertTriangle
          : CircleHelp;
  return (
    <View
      style={[styles.dataState, { borderLeftColor: tone.fg }]}
      accessibilityRole={kind === 'loading' ? 'progressbar' : 'summary'}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${reason}`}
      testID={testID}
    >
      <View style={styles.dataStateHeader}>
        {kind === 'loading' ? <ActivityIndicator color={tone.fg} /> : <StateIcon size={22} color={tone.fg} />}
        <View style={styles.dataStateCopy}>
          <View style={styles.dataStateTitleRow}>
            <Text style={styles.dataStateTitle}>{title}</Text>
            <StatusBadge status={kind} />
          </View>
          <Text style={styles.dataStateReason}>{reason}</Text>
        </View>
      </View>
      {kind === 'loading' && progress == null ? (
        <View style={styles.skeleton} accessible={false}>
          <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
          <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        </View>
      ) : null}
      {progress != null ? (
        <View style={styles.dataProgress}>
          <View style={styles.dataProgressTrack}><View style={[styles.dataProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: tone.fg }]} /></View>
          <Text style={styles.dataProgressLabel}>{(current ?? 0).toLocaleString()} of {total?.toLocaleString()}{currentItem ? ` · ${currentItem}` : ''}</Text>
        </View>
      ) : currentItem ? <Text style={styles.dataCurrentItem}>Current item: {currentItem}</Text> : null}
      {committed !== undefined ? (
        <Text style={[styles.dataCommit, { color: committed ? C.success : C.textMuted }]}>
          {committed ? 'Durable data commit verified.' : 'No durable data commit has been reported yet.'}
        </Text>
      ) : null}
      {sourceLabel || updatedAt ? <Text style={styles.dataProvenance}>{sourceLabel ? `Source: ${sourceLabel}` : ''}{sourceLabel && updatedAt ? ' · ' : ''}{updatedAt ? `Updated ${updatedAt}` : ''}</Text> : null}
      {actionLabel || secondaryActionLabel ? (
        <View style={styles.dataStateActions}>
          {actionLabel && onAction ? <Pressable style={styles.dataPrimaryAction} onPress={onAction} accessibilityRole="button"><RefreshCw size={16} color={C.surface} /><Text style={styles.dataPrimaryActionText}>{actionLabel}</Text></Pressable> : null}
          {secondaryActionLabel && onSecondaryAction ? <Pressable style={styles.dataSecondaryAction} onPress={onSecondaryAction} accessibilityRole="button"><Text style={styles.dataSecondaryActionText}>{secondaryActionLabel}</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

export const easySeasSurface = (extra?: ViewStyle): ViewStyle => ({ backgroundColor: C.surface, borderRadius: EASY_SEAS_UX.radius.card, borderWidth: 1, borderColor: C.border, padding: EASY_SEAS_UX.cardPadding, ...extra });

const styles = StyleSheet.create({
  pageShell: { flex: 1 },
  pageShellContent: {
    paddingHorizontal: EASY_SEAS_COMPONENT_TOKENS.pagePadding,
    paddingTop: EASY_SEAS_COMPONENT_TOKENS.grid,
    paddingBottom: EASY_SEAS_COMPONENT_TOKENS.sectionGap * 2,
  },
  pageShellFlex: { flex: 1 },
  pageHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: EASY_SEAS_COMPONENT_TOKENS.grid, paddingVertical: EASY_SEAS_COMPONENT_TOKENS.grid },
  pageHeaderCopy: { flex: 1, minWidth: 0 },
  pageTitle: { ...EASY_SEAS_TYPE_STYLES.pageTitle, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, color: C.textStrong },
  pageContext: { ...EASY_SEAS_TYPE_STYLES.body, color: C.textMuted, marginTop: EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  themedCard: { minHeight: 168, borderRadius: EASY_SEAS_COMPONENT_TOKENS.cardRadius, overflow: 'hidden', borderWidth: 1, backgroundColor: C.brandNavy, shadowColor: C.brandNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 3 },
  themedArtwork: { borderRadius: EASY_SEAS_UX.radius.card, transform: [{ scale: 1.03 }] },
  themedOverlay: { flex: 1, justifyContent: 'center', padding: 18 },
  themedEyebrow: { color: '#0E7FA7', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  themedTitle: { ...EASY_SEAS_TYPE_STYLES.pageTitle, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, maxWidth: '70%', color: '#333334', fontSize: 27, lineHeight: 32, marginTop: EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  themedSummary: { ...EASY_SEAS_TYPE_STYLES.body, maxWidth: '70%', color: '#58585B', fontSize: 14, lineHeight: 20, marginTop: EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  themedContent: { alignSelf: 'flex-start', marginTop: 12 },
  headerPrimary: { minHeight: 44, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14, backgroundColor: C.brandNavy },
  headerPrimaryText: { ...EASY_SEAS_TYPE_STYLES.button, color: C.surface },
  headerOverflow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  card: { position: 'relative', backgroundColor: C.surface, borderRadius: EASY_SEAS_UX.radius.card, borderWidth: 1, borderColor: C.border, padding: EASY_SEAS_UX.cardPadding, shadowColor: C.brandNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  badge: { alignSelf: 'flex-start', minHeight: 24, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, justifyContent: 'center' },
  badgeText: { ...EASY_SEAS_TYPE_STYLES.badge },
  searchShell: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface },
  searchInput: { flex: 1, minHeight: 44, color: C.textStrong, fontSize: 15 },
  filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 13, backgroundColor: C.surface },
  controlText: { ...EASY_SEAS_TYPE_STYLES.button, color: C.brandNavy, fontWeight: '600' },
  count: { minWidth: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.seafoam },
  countText: { color: C.brandNavy, fontSize: 12, fontWeight: '800' },
  segmented: { minHeight: 44, flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface, padding: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: C.seafoam, borderWidth: 1, borderColor: C.oceanTeal },
  segmentText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  segmentTextSelected: { color: C.brandNavy, fontWeight: '800' },
  metricTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  metricLabel: { flex: 1, color: C.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  metricValue: { ...EASY_SEAS_TYPE_STYLES.metric, color: C.textStrong, fontVariant: ['tabular-nums'] },
  metricUnit: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  metricDetail: { ...EASY_SEAS_TYPE_STYLES.body, color: C.textMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  chevron: { position: 'absolute', right: 12, bottom: 12 },
  alert: { borderRadius: 14, borderLeftWidth: 4, padding: 15 },
  alertTitle: { ...EASY_SEAS_TYPE_STYLES.cardTitle, lineHeight: 23 },
  alertMeta: { color: C.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  alertSummary: { ...EASY_SEAS_TYPE_STYLES.body, color: C.textStrong, lineHeight: 22, marginTop: 6 },
  inlineAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 5 },
  inlineActionText: { color: C.brandNavy, fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  emptyTitle: { ...EASY_SEAS_TYPE_STYLES.body, color: C.textStrong, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  primaryButton: { minHeight: 44, justifyContent: 'center', borderRadius: 10, backgroundColor: C.brandNavy, paddingHorizontal: 18, marginTop: 14 },
  primaryButtonText: { ...EASY_SEAS_TYPE_STYLES.button, color: C.surface },
  definitionList: { borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.surface, paddingHorizontal: 16 },
  definitionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 10 },
  definitionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  definitionLabel: { flex: 1, color: C.textMuted, fontSize: 13, lineHeight: 18 },
  definitionValue: { flex: 1, color: C.textStrong, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'right' },
  sheet: { flex: 1, backgroundColor: C.canvas },
  sheetHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  sheetHeaderLandscape: { minHeight: 56, paddingHorizontal: 24 },
  sheetTitle: { ...EASY_SEAS_TYPE_STYLES.sectionTitle, flex: 1, color: C.textStrong, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: 16, paddingBottom: 40 },
  sheetContentLandscape: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 24 },
  loading: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.textMuted, fontSize: 14 },
  dataState: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderRadius: EASY_SEAS_COMPONENT_TOKENS.cardRadius, padding: EASY_SEAS_COMPONENT_TOKENS.cardPadding, shadowColor: EASY_SEAS_COMPONENT_TOKENS.shadowColor, shadowOpacity: EASY_SEAS_COMPONENT_TOKENS.shadowOpacity, shadowRadius: EASY_SEAS_COMPONENT_TOKENS.shadowRadius, shadowOffset: EASY_SEAS_COMPONENT_TOKENS.shadowOffset, elevation: 2 },
  dataStateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: EASY_SEAS_COMPONENT_TOKENS.grid + EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  dataStateCopy: { flex: 1, minWidth: 0 },
  dataStateTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: EASY_SEAS_COMPONENT_TOKENS.grid },
  dataStateTitle: { ...EASY_SEAS_TYPE_STYLES.cardTitle, flex: 1, color: C.textStrong },
  dataStateReason: { ...EASY_SEAS_TYPE_STYLES.body, color: C.textMuted, marginTop: EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  skeleton: { gap: EASY_SEAS_COMPONENT_TOKENS.grid, marginTop: EASY_SEAS_COMPONENT_TOKENS.cardGap },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: '#E8ECEE' },
  skeletonLineWide: { width: '100%' },
  skeletonLineMedium: { width: '74%' },
  skeletonLineShort: { width: '46%' },
  dataProgress: { marginTop: EASY_SEAS_COMPONENT_TOKENS.cardGap },
  dataProgressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E8ECEE' },
  dataProgressFill: { height: '100%', borderRadius: 4 },
  dataProgressLabel: { ...EASY_SEAS_TYPE_STYLES.caption, color: C.textMuted, marginTop: EASY_SEAS_COMPONENT_TOKENS.halfGrid },
  dataCurrentItem: { ...EASY_SEAS_TYPE_STYLES.caption, color: C.textMuted, marginTop: EASY_SEAS_COMPONENT_TOKENS.grid },
  dataCommit: { ...EASY_SEAS_TYPE_STYLES.caption, marginTop: EASY_SEAS_COMPONENT_TOKENS.grid },
  dataProvenance: { ...EASY_SEAS_TYPE_STYLES.caption, color: C.textMuted, marginTop: EASY_SEAS_COMPONENT_TOKENS.grid },
  dataStateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: EASY_SEAS_COMPONENT_TOKENS.grid, marginTop: EASY_SEAS_COMPONENT_TOKENS.cardGap },
  dataPrimaryAction: { minHeight: EASY_SEAS_COMPONENT_TOKENS.minimumTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: EASY_SEAS_COMPONENT_TOKENS.grid, borderRadius: EASY_SEAS_COMPONENT_TOKENS.controlRadius, paddingHorizontal: EASY_SEAS_COMPONENT_TOKENS.cardPadding, backgroundColor: C.brandNavy },
  dataPrimaryActionText: { ...EASY_SEAS_TYPE_STYLES.button, color: C.surface },
  dataSecondaryAction: { minHeight: EASY_SEAS_COMPONENT_TOKENS.minimumTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: EASY_SEAS_COMPONENT_TOKENS.controlRadius, paddingHorizontal: EASY_SEAS_COMPONENT_TOKENS.cardPadding, backgroundColor: C.surface },
  dataSecondaryActionText: { ...EASY_SEAS_TYPE_STYLES.button, color: C.brandNavy },
});
