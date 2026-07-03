import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import type { BookedCruise } from '@/types/models';

type CasinoTab = 'portfolio' | 'value' | 'action' | 'history';

type SafeCruiseRow = {
  key: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  itinerary: string;
  offerCode: string;
  offerType: string;
  pointsRequired: number;
  casinoPoints: number;
  coinIn: number;
  winLoss: number;
  retailValue: number;
  paid: number;
  taxesFees: number;
  valueCaptured: number;
  netMakeout: number;
  nights: number;
  quality: 'Verified' | 'Mixed' | 'Estimated' | 'Missing';
};

type CasinoTotals = {
  rowCount: number;
  casinoPoints: number;
  coinIn: number;
  winLoss: number;
  retailValue: number;
  paid: number;
  valueCaptured: number;
  netMakeout: number;
  totalNights: number;
  instantCertificates: number;
  marketingOffers: number;
  missingOfferCodes: number;
  verifiedRows: number;
};


type DetailLine = { label: string; value: string; tone?: 'normal' | 'good' | 'bad' | 'warn' };

type DetailPayload = {
  title: string;
  subtitle?: string;
  badge?: string;
  lines: DetailLine[];
  notes?: string[];
};

type ShipPerformance = {
  shipName: string;
  sailings: number;
  points: number;
  coinIn: number;
  value: number;
  winLoss: number;
  netMakeout: number;
  avgPoints: number;
  avgCoinIn: number;
  avgValue: number;
};

type SafeBuild<T> = { value: T; ok: boolean; message?: string };

const ROYAL_NAVY = '#123D73';
const ROYAL_BLUE = '#1557C7';
const ROYAL_AQUA = '#00A6D6';
const ROYAL_GOLD = '#D4A00A';
const ROYAL_SKY = '#EAF6FF';
const ROYAL_MIST = '#F6FAFF';
const DARK_BG = ROYAL_MIST;
const DARK_PANEL = '#FFFFFF';
const DARK_PANEL_2 = '#F1F7FF';
const GOLD = ROYAL_GOLD;
const BLUE = ROYAL_BLUE;
const GREEN = '#059669';
const RED = '#DC2626';
const CYAN = ROYAL_AQUA;

const INSTANT_CERT_POINTS: Record<string, number> = {
  VIP2: 40000,
  '01': 25000,
  '02': 15000,
  '02A': 9000,
  '03': 6500,
  '03A': 4000,
  '04': 3000,
  '05': 2000,
  '06': 1500,
  '07': 1200,
  '08': 800,
  '09': 600,
  '10': 400,
};

const EMPTY_TOTALS: CasinoTotals = {
  rowCount: 0,
  casinoPoints: 0,
  coinIn: 0,
  winLoss: 0,
  retailValue: 0,
  paid: 0,
  valueCaptured: 0,
  netMakeout: 0,
  totalNights: 0,
  instantCertificates: 0,
  marketingOffers: 0,
  missingOfferCodes: 0,
  verifiedRows: 0,
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  return raw.length ? raw : fallback;
}

function uppercase(value: unknown): string {
  return text(value).toUpperCase();
}

function money(value: unknown): string {
  const amount = num(value);
  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(amount));
  return `${sign}$${absolute.toLocaleString('en-US')}`;
}

function numberLabel(value: unknown): string {
  return Math.round(num(value)).toLocaleString('en-US');
}

function detailNumber(value: unknown, suffix = ''): string {
  const label = numberLabel(value);
  return suffix ? `${label}${suffix}` : label;
}

function detailMoney(value: unknown): string {
  return money(value);
}

function buildCruiseDetail(row: SafeCruiseRow): DetailPayload {
  const actualCashCost = row.paid + Math.max(0, -row.winLoss);
  const grossValue = row.retailValue || row.valueCaptured;
  return {
    title: row.shipName,
    subtitle: `${shortDate(row.sailDate)} · ${row.nights || '—'} nights · ${row.itinerary}`,
    badge: row.quality,
    lines: [
      { label: 'Offer / certificate', value: row.offerCode || 'UNKNOWN', tone: row.offerCode ? 'normal' : 'bad' },
      { label: 'Offer type', value: row.offerType },
      { label: 'Instant certificate points required', value: row.pointsRequired ? detailNumber(row.pointsRequired, ' pts') : '0 pts' },
      { label: 'Casino points earned', value: detailNumber(row.casinoPoints, ' pts') },
      { label: 'Estimated coin-in volume', value: detailMoney(row.coinIn) },
      { label: 'Casino win/loss', value: detailMoney(row.winLoss), tone: row.winLoss >= 0 ? 'good' : 'bad' },
      { label: 'Retail cruise value', value: detailMoney(row.retailValue) },
      { label: 'Comp/value captured', value: detailMoney(row.valueCaptured), tone: 'good' },
      { label: 'Taxes / fare / cash paid', value: detailMoney(row.paid), tone: row.paid > 0 ? 'warn' : 'normal' },
      { label: 'Actual cash cost', value: detailMoney(actualCashCost), tone: actualCashCost > 0 ? 'warn' : 'good' },
      { label: 'Gross value used in make-out', value: detailMoney(grossValue) },
      { label: 'Net make-out', value: detailMoney(row.netMakeout), tone: row.netMakeout >= 0 ? 'good' : 'bad' },
    ],
    notes: [
      'Coin-in is volume, not cost.',
      'Actual cash cost counts cash paid plus casino net loss when the casino result is negative.',
      'Marketing offers and annual cruise benefits have zero point cost unless an instant certificate threshold is explicitly detected.',
    ],
  };
}

function buildMetricDetail(title: string, value: string, lines: DetailLine[], notes?: string[]): DetailPayload {
  return { title, subtitle: value, lines, notes };
}

function buildShipDetail(ship: ShipPerformance): DetailPayload {
  return {
    title: ship.shipName,
    subtitle: `${ship.sailings} sailing${ship.sailings === 1 ? '' : 's'} in the current casino dashboard data`,
    lines: [
      { label: 'Total casino points', value: detailNumber(ship.points, ' pts') },
      { label: 'Average points / cruise', value: detailNumber(ship.avgPoints, ' pts') },
      { label: 'Total estimated coin-in', value: detailMoney(ship.coinIn) },
      { label: 'Average coin-in / cruise', value: detailMoney(ship.avgCoinIn) },
      { label: 'Average value / cruise', value: detailMoney(ship.avgValue) },
      { label: 'Total win/loss', value: detailMoney(ship.winLoss), tone: ship.winLoss >= 0 ? 'good' : 'bad' },
      { label: 'Net make-out', value: detailMoney(ship.netMakeout), tone: ship.netMakeout >= 0 ? 'good' : 'bad' },
    ],
    notes: ['Ship performance is based on capped, native-crash-safe dashboard rows. Open full cruise rows to inspect individual sailings.'],
  };
}

function shortDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return 'Date TBD';
  const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return dateOnly;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function stableKey(parts: unknown[]): string {
  return parts.map((part) => text(part, 'x').slice(0, 60).toLowerCase()).join('|');
}


class CasinoCrashBoundary extends React.Component<
  { children: React.ReactNode; activeTab: CasinoTab },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error || 'Unknown casino render error'),
    };
  }

  componentDidUpdate(prevProps: { activeTab: CasinoTab }) {
    if (prevProps.activeTab !== this.props.activeTab && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch() {
    // Keep the Casino tab away from native diagnostics/TurboModules.
    // The visible fallback is safer than throwing into Hermes on iOS/MacFamily.
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Casino safe mode</Text>
          <Text style={styles.errorText}>A casino section hit bad or incomplete data, so EasySeas protected the app instead of crashing.</Text>
          {this.state.message ? <Text style={styles.errorText}>{this.state.message}</Text> : null}
        </View>
      );
    }
    return this.props.children;
  }
}

function safeRun<T>(event: string, builder: () => T, fallback: T): SafeBuild<T> {
  try {
    return { value: builder(), ok: true };
  } catch (error) {
    // Casino route intentionally avoids diagnostic native-module writes.
    return { value: fallback, ok: false, message: error instanceof Error ? error.message : String(error || event) };
  }
}

function detectOfferCode(row: Record<string, unknown>): string {
  const candidates = [
    row.bookingOfferCode,
    row.offerCode,
    row.certificateCode,
    row.casinoOfferCode,
    row.promoCode,
    row.bookingCode,
    row.offer,
    row.cruiseOffer,
  ];
  for (const candidate of candidates) {
    const code = uppercase(candidate);
    if (code) return code.slice(0, 32);
  }
  return '';
}

function classifyOffer(code: string): { offerType: string; pointsRequired: number; isInstant: boolean } {
  if (!code) return { offerType: 'Offer missing', pointsRequired: 0, isInstant: false };
  if (code.includes('FP') || code.includes('FREEPLAY') || code.includes('OBC')) {
    return { offerType: 'Perk / FreePlay code', pointsRequired: 0, isInstant: false };
  }
  if (code.includes('ANNUAL') || code.includes('SIGNATURE') || code.includes('PINNACLE')) {
    return { offerType: 'Annual cruise benefit', pointsRequired: 0, isInstant: false };
  }
  const compact = code.replace(/[^A-Z0-9]/g, '');
  const bankIndex = compact.length >= 5 ? compact.search(/[ACD]/) : -1;
  if (bankIndex === 4 && compact.length >= 7) {
    const prefix = compact.slice(0, 4);
    const level = compact.slice(5);
    const prefixLooksMonthly = /^\d{4}$/.test(prefix);
    const points = INSTANT_CERT_POINTS[level] ?? 0;
    if (prefixLooksMonthly && points > 0) {
      return { offerType: `Instant certificate ${compact.charAt(4)}${level}`, pointsRequired: points, isInstant: true };
    }
  }
  return { offerType: 'Marketing offer', pointsRequired: 0, isInstant: false };
}

function estimateNights(raw: Record<string, unknown>, sailDate: string, returnDate: string): number {
  const direct = num(raw.nights ?? raw.durationNights ?? raw.cruiseNights, 0);
  if (direct > 0 && direct < 100) return Math.round(direct);
  const start = new Date(`${sailDate.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${returnDate.slice(0, 10)}T00:00:00Z`);
  const diff = (end.getTime() - start.getTime()) / 86400000;
  return Number.isFinite(diff) && diff > 0 && diff < 100 ? Math.round(diff) : 0;
}

function rowQuality(row: SafeCruiseRow): SafeCruiseRow['quality'] {
  if (!row.offerCode || row.casinoPoints <= 0) return 'Missing';
  const hasMoney = row.retailValue > 0 || row.paid > 0 || row.winLoss !== 0;
  if (row.offerCode && row.casinoPoints > 0 && hasMoney) return 'Verified';
  if (row.offerCode || row.casinoPoints > 0 || hasMoney) return 'Mixed';
  return 'Estimated';
}

function buildSafeCruiseRows(localBooked: BookedCruise[], storedBooked: BookedCruise[]): SafeCruiseRow[] {
  const rawRows = localBooked.length ? localBooked : storedBooked;
  const seen = new Set<string>();
  const rows: SafeCruiseRow[] = [];
  for (const raw of rawRows.slice(0, 80) as any[]) {
    const shipName = text(raw.shipName ?? raw.ship, 'Cruise');
    const sailDate = text(raw.sailDate ?? raw.startDate ?? raw.sailingDate);
    const returnDate = text(raw.returnDate ?? raw.endDate);
    const key = stableKey([raw.id, raw.reservationNumber, shipName, sailDate]);
    if (seen.has(key)) continue;
    seen.add(key);

    const offerCode = detectOfferCode(raw);
    const offer = classifyOffer(offerCode);
    const casinoPoints = num(raw.casinoPoints ?? raw.clubRoyalePointsEarned ?? raw.pointsEarned ?? raw.points);
    const coinIn = num(raw.coinIn ?? raw.estimatedCoinIn, casinoPoints * 5);
    const winLoss = num(raw.casinoWinLoss ?? raw.winLoss ?? raw.winningsBroughtHome ?? raw.cashResult);
    const retailValue = num(raw.retailValue ?? raw.retailCruiseValue ?? raw.cabinRetailValue ?? raw.cabinValueForTwo ?? raw.totalRetailValue);
    const taxesFees = num(raw.taxesFees ?? raw.taxesAndFees ?? raw.taxAndFees);
    const paid = num(raw.amountPaid ?? raw.totalPaid ?? raw.paid ?? raw.netEffectivePaid, taxesFees);
    const valueCaptured = Math.max(0, num(raw.cruiseValueCaptured ?? raw.casinoCompValue ?? raw.casinoDiscount, retailValue - paid));
    const grossValue = retailValue || valueCaptured;
    const cashCost = paid + Math.max(0, -winLoss);
    const netMakeout = grossValue + Math.max(0, winLoss) - cashCost;
    const itinerary = text(raw.itinerary ?? raw.title ?? raw.destination, 'Itinerary TBD');
    const nights = estimateNights(raw, sailDate, returnDate);

    const row: SafeCruiseRow = {
      key,
      shipName,
      sailDate,
      returnDate,
      itinerary,
      offerCode,
      offerType: offer.offerType,
      pointsRequired: offer.pointsRequired,
      casinoPoints,
      coinIn,
      winLoss,
      retailValue,
      paid,
      taxesFees,
      valueCaptured,
      netMakeout,
      nights,
      quality: 'Estimated',
    };
    row.quality = rowQuality(row);
    rows.push(row);
  }
  return rows;
}

function buildTotals(rows: SafeCruiseRow[]): CasinoTotals {
  return rows.reduce<CasinoTotals>((totals, row) => {
    totals.rowCount += 1;
    totals.casinoPoints += row.casinoPoints;
    totals.coinIn += row.coinIn;
    totals.winLoss += row.winLoss;
    totals.retailValue += row.retailValue;
    totals.paid += row.paid;
    totals.valueCaptured += row.valueCaptured;
    totals.netMakeout += row.netMakeout;
    totals.totalNights += row.nights;
    if (!row.offerCode) totals.missingOfferCodes += 1;
    if (row.offerType.toLowerCase().includes('instant')) totals.instantCertificates += 1;
    if (row.offerType === 'Marketing offer') totals.marketingOffers += 1;
    if (row.quality === 'Verified') totals.verifiedRows += 1;
    return totals;
  }, { ...EMPTY_TOTALS });
}

function buildShipPerformance(rows: SafeCruiseRow[]): ShipPerformance[] {
  const map = new Map<string, ShipPerformance>();
  for (const row of rows) {
    const current = map.get(row.shipName) ?? {
      shipName: row.shipName,
      sailings: 0,
      points: 0,
      coinIn: 0,
      value: 0,
      winLoss: 0,
      netMakeout: 0,
      avgPoints: 0,
      avgCoinIn: 0,
      avgValue: 0,
    };
    current.sailings += 1;
    current.points += row.casinoPoints;
    current.coinIn += row.coinIn;
    current.value += row.valueCaptured || row.retailValue;
    current.winLoss += row.winLoss;
    current.netMakeout += row.netMakeout;
    current.avgPoints = current.sailings ? current.points / current.sailings : 0;
    current.avgCoinIn = current.sailings ? current.coinIn / current.sailings : 0;
    current.avgValue = current.sailings ? current.value / current.sailings : 0;
    map.set(row.shipName, current);
  }
  return Array.from(map.values()).sort((a, b) => b.points - a.points).slice(0, 8);
}

function pct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function DarkPanel({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.darkPanel}>
      <Text style={styles.darkPanelTitle}>{title}</Text>
      {subtitle ? <Text style={styles.darkPanelSubtitle}>{subtitle}</Text> : null}
      <View style={styles.darkPanelBody}>{children}</View>
    </View>
  );
}

function DarkMetric({ label, value, detail, accent = GOLD, onPress }: { label: string; value: string; detail?: string; accent?: string; onPress?: () => void }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.82} style={styles.darkMetric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.darkMetricLabel}>{label}</Text>
      <Text style={styles.darkMetricValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text style={styles.darkMetricDetail} numberOfLines={2}>{detail}</Text> : null}
      {onPress ? <Text style={styles.tapHint}>Tap for details</Text> : null}
    </Wrapper>
  );
}

function Progress({ label, value, max, detail, color = GOLD }: { label: string; value: number; max: number; detail: string; color?: string }) {
  const width = pct(value, max);
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressPercent}>{width}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressDetail}>{detail}</Text>
    </View>
  );
}

function MiniBarChart({ rows, metric }: { rows: SafeCruiseRow[]; metric: 'casinoPoints' | 'netMakeout' | 'winLoss' }) {
  const values = rows.slice(0, 6).map((row) => Math.max(0, num(row[metric])));
  const max = Math.max(1, ...values);
  return (
    <View style={styles.barChart}>
      {rows.slice(0, 6).map((row) => {
        const value = Math.max(0, num(row[metric]));
        const h = Math.max(10, pct(value, max));
        return (
          <View key={`${row.key}-${metric}`} style={styles.barSlot}>
            <View style={[styles.barColumn, { height: `${h}%` }]} />
            <Text style={styles.barLabel} numberOfLines={1}>{shortDate(row.sailDate).slice(0, 6)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatusBadge({ status }: { status: SafeCruiseRow['quality'] }) {
  const color = status === 'Verified' ? GREEN : status === 'Mixed' ? GOLD : status === 'Estimated' ? CYAN : RED;
  return <Text style={[styles.statusBadge, { color }]}>{status}</Text>;
}

function ShipHeroCard({ title, ship, metric, accent = GOLD, onPress }: { title: string; ship?: ShipPerformance; metric: string; accent?: string; onPress?: () => void }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.82} style={styles.shipHeroCard}>
      <View style={[styles.shipImageMock, { borderColor: accent }]}>
        <Text style={styles.shipEmoji}>🚢</Text>
      </View>
      <Text style={styles.shipHeroTitle}>{title}</Text>
      <Text style={styles.shipHeroShip} numberOfLines={1}>{ship?.shipName ?? 'No ship yet'}</Text>
      <Text style={[styles.shipHeroMetric, { color: accent }]}>{metric}</Text>
      <Text style={styles.shipHeroDetail}>{ship ? `${ship.sailings} sailing${ship.sailings === 1 ? '' : 's'}` : 'Add cruise data'}</Text>
      {onPress ? <Text style={styles.tapHint}>Tap for details</Text> : null}
    </Wrapper>
  );
}


function LightMetric({ label, value, detail, accent = BLUE, onPress }: { label: string; value: string; detail?: string; accent?: string; onPress?: () => void }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.82} style={styles.lightMetric}>
      <View style={[styles.lightIconDot, { backgroundColor: accent }]} />
      <Text style={styles.lightMetricLabel}>{label}</Text>
      <Text style={styles.lightMetricValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text style={styles.lightMetricDetail} numberOfLines={2}>{detail}</Text> : null}
      {onPress ? <Text style={styles.lightTapHint}>Tap for details</Text> : null}
    </Wrapper>
  );
}

function LightPanel({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.lightPanel}>
      <View style={styles.lightPanelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.lightPanelTitle}>{title}</Text>
          {subtitle ? <Text style={styles.lightPanelSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.lightPanelBody}>{children}</View>
    </View>
  );
}

function LightProgress({ label, value, max, detail, color = BLUE }: { label: string; value: number; max: number; detail: string; color?: string }) {
  const width = pct(value, max);
  return (
    <View style={styles.lightProgressBlock}>
      <View style={styles.lightProgressHeader}>
        <Text style={styles.lightProgressLabel}>{label}</Text>
        <Text style={styles.lightProgressPercent}>{width}%</Text>
      </View>
      <View style={styles.lightProgressTrack}>
        <View style={[styles.lightProgressFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.lightProgressDetail}>{detail}</Text>
    </View>
  );
}

function ValueBars({ rows, valueKey, cashKey }: { rows: SafeCruiseRow[]; valueKey: 'retailValue' | 'valueCaptured' | 'netMakeout' | 'casinoPoints' | 'winLoss'; cashKey?: 'paid' | 'winLoss' }) {
  const chartRows = rows.slice(0, 6);
  const max = Math.max(1, ...chartRows.map((row) => Math.max(0, num(row[valueKey]), cashKey ? Math.max(0, num(row[cashKey])) : 0)));
  return (
    <View style={styles.valueBars}>
      {chartRows.map((row) => {
        const valueHeight = Math.max(8, pct(Math.max(0, num(row[valueKey])), max));
        const cashHeight = cashKey ? Math.max(8, pct(Math.max(0, num(row[cashKey])), max)) : 0;
        return (
          <View key={`value-bars-${row.key}-${valueKey}`} style={styles.valueBarSlot}>
            <View style={styles.valueBarColumns}>
              <View style={[styles.valueBarPrimary, { height: `${valueHeight}%` }]} />
              {cashKey ? <View style={[styles.valueBarSecondary, { height: `${cashHeight}%` }]} /> : null}
            </View>
            <Text style={styles.valueBarLabel} numberOfLines={1}>{shortDate(row.sailDate).slice(0, 6)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DonutBreakdown({ totals }: { totals: CasinoTotals }) {
  const rows = [
    { label: 'Retail value', value: totals.retailValue, color: BLUE },
    { label: 'Comp value', value: totals.valueCaptured, color: '#7C3AED' },
    { label: 'Cash paid', value: totals.paid, color: GOLD },
    { label: 'Win/Loss', value: Math.max(0, totals.winLoss), color: GREEN },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutMock}>
        <Text style={styles.donutValue}>{money(totals.retailValue || totals.valueCaptured)}</Text>
        <Text style={styles.donutLabel}>Total value</Text>
      </View>
      <View style={styles.donutLegend}>
        {rows.map((row) => (
          <View key={`legend-${row.label}`} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: row.color }]} />
            <Text style={styles.legendLabel}>{row.label}</Text>
            <View style={styles.legendTrack}><View style={[styles.legendFill, { width: `${Math.max(5, pct(row.value, max))}%`, backgroundColor: row.color }]} /></View>
            <Text style={styles.legendValue}>{money(row.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CruiseValuePage({ rows, totals, onOpenDetail }: { rows: SafeCruiseRow[]; totals: CasinoTotals; onOpenDetail: (detail: DetailPayload) => void }) {
  const roi = totals.paid > 0 ? (totals.netMakeout + totals.paid) / totals.paid : 0;
  const topRows = rows.slice(0, 8);
  const offerRows = rows.filter((row) => row.offerCode || row.offerType !== 'Offer missing').slice(0, 8);
  return (
    <View style={styles.lightDashboardPage}>
      <View style={styles.lightHeaderRow}>
        <View>
          <Text style={styles.lightPageTitle}>Cruise Value Overview</Text>
          <Text style={styles.lightPageSubtitle}>Track the real value of your cruises and your true make-out.</Text>
        </View>
        <TouchableOpacity style={styles.lightSyncButton}><Text style={styles.lightSyncText}>Sync Now</Text></TouchableOpacity>
      </View>

      <View style={styles.lightMetricGrid}>
        <LightMetric label="Total Retail Value" value={money(totals.retailValue)} accent={BLUE} onPress={() => onOpenDetail(buildMetricDetail('Total retail value', detailMoney(totals.retailValue), [ { label: 'Retail value total', value: detailMoney(totals.retailValue) }, { label: 'Rows counted', value: detailNumber(totals.rowCount) }, { label: 'Average retail value / cruise', value: detailMoney(totals.rowCount ? totals.retailValue / totals.rowCount : 0) } ]))} />
        <LightMetric label="Total Comp Value" value={money(totals.valueCaptured)} accent="#7C3AED" onPress={() => onOpenDetail(buildMetricDetail('Total comp value', detailMoney(totals.valueCaptured), [ { label: 'Comp/value captured', value: detailMoney(totals.valueCaptured), tone: 'good' }, { label: 'Retail value', value: detailMoney(totals.retailValue) }, { label: 'Cash paid', value: detailMoney(totals.paid), tone: 'warn' } ]))} />
        <LightMetric label="Total Cash Paid" value={money(totals.paid)} accent={GOLD} onPress={() => onOpenDetail(buildMetricDetail('Total cash paid', detailMoney(totals.paid), [ { label: 'Cash paid', value: detailMoney(totals.paid), tone: totals.paid > 0 ? 'warn' : 'normal' }, { label: 'Average paid / cruise', value: detailMoney(totals.rowCount ? totals.paid / totals.rowCount : 0) }, { label: 'Rows counted', value: detailNumber(totals.rowCount) } ]))} />
        <LightMetric label="Total Net Make-Out" value={money(totals.netMakeout)} accent={totals.netMakeout >= 0 ? GREEN : RED} onPress={() => onOpenDetail(buildMetricDetail('Total net make-out', detailMoney(totals.netMakeout), [ { label: 'Value captured', value: detailMoney(totals.valueCaptured || totals.retailValue) }, { label: 'Casino win/loss', value: detailMoney(totals.winLoss), tone: totals.winLoss >= 0 ? 'good' : 'bad' }, { label: 'Cash paid', value: detailMoney(totals.paid), tone: 'warn' }, { label: 'Net make-out', value: detailMoney(totals.netMakeout), tone: totals.netMakeout >= 0 ? 'good' : 'bad' } ]))} />
        <LightMetric label="Value Per $1 Paid" value={roi > 0 ? `${roi.toFixed(2)}x` : '—'} accent={GREEN} onPress={() => onOpenDetail(buildMetricDetail('Value per $1 paid', roi > 0 ? `${roi.toFixed(2)}x` : '—', [ { label: 'Net make-out plus cash paid', value: detailMoney(totals.netMakeout + totals.paid) }, { label: 'Total cash paid', value: detailMoney(totals.paid) }, { label: 'ROI/value multiple', value: roi > 0 ? `${roi.toFixed(2)}x` : 'Not enough paid data' } ], ['Formula used here: (net make-out + cash paid) ÷ cash paid.']))} />
      </View>

      <View style={styles.lightGridThree}>
        <LightPanel title="Value Breakdown" subtitle="Retail, comp, paid cash, and casino return."><DonutBreakdown totals={totals} /></LightPanel>
        <LightPanel title="Value vs. Cash Paid" subtitle="Recent sailings, capped for stability."><ValueBars rows={rows} valueKey="retailValue" cashKey="paid" /></LightPanel>
        <LightPanel title="ROI / Value Per Dollar" subtitle="All time"><Text style={styles.bigRoi}>{roi > 0 ? `${roi.toFixed(2)}x` : '—'}</Text><Text style={styles.roiText}>Estimated value returned for every $1 paid.</Text></LightPanel>
      </View>

      <LightPanel title="Cruise Economics Ledger" subtitle="Retail value, comp value, taxes/fees, casino result, and true make-out.">
        {topRows.map((row) => (
          <TouchableOpacity key={`econ-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.lightLedgerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lightRowTitle} numberOfLines={1}>{row.shipName}</Text>
              <Text style={styles.lightRowSub}>{shortDate(row.sailDate)} · {row.nights || '—'}N · {row.offerCode || 'No offer attached'}</Text>
            </View>
            <View style={styles.lightLedgerMetrics}>
              <Text style={styles.lightLedgerValue}>{money(row.retailValue || row.valueCaptured)}</Text>
              <Text style={[styles.lightLedgerValue, row.netMakeout < 0 ? styles.lightLossText : styles.lightWinText]}>{money(row.netMakeout)}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {!topRows.length ? <Text style={styles.lightText}>No cruise value rows are available yet.</Text> : null}
      </LightPanel>

      <View style={styles.lightGridTwo}>
        <LightPanel title="Offer Attribution Ledger" subtitle="Instant certificates, marketing offers, annual benefits, and missing codes.">
          {offerRows.map((row) => (
            <TouchableOpacity key={`offer-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.offerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lightRowTitle}>{row.offerCode || 'UNKNOWN'}</Text>
                <Text style={styles.lightRowSub} numberOfLines={1}>{row.shipName} · {row.offerType}</Text>
              </View>
              <Text style={styles.offerPoints}>{row.pointsRequired ? `${numberLabel(row.pointsRequired)} pts` : '0 pts'}</Text>
            </TouchableOpacity>
          ))}
          {!offerRows.length ? <Text style={styles.lightText}>No offer attribution rows are available yet.</Text> : null}
        </LightPanel>
        <LightPanel title="True Make-Out Ledger" subtitle="Gross value minus actual cash cost, with casino result included.">
          {topRows.slice(0, 6).map((row) => (
            <TouchableOpacity key={`makeout-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.makeoutRow}>
              <Text style={styles.lightRowTitle} numberOfLines={1}>{row.shipName}</Text>
              <Text style={styles.lightRowSub}>Cost {money(row.paid + Math.max(0, -row.winLoss))} · Win/Loss {money(row.winLoss)}</Text>
              <Text style={[styles.makeoutRowValue, row.netMakeout < 0 ? styles.lightLossText : styles.lightWinText]}>{money(row.netMakeout)}</Text>
            </TouchableOpacity>
          ))}
        </LightPanel>
      </View>

      <View style={styles.lightMetricGrid}>
        <LightMetric label="Cruise Value Created" value={money(totals.valueCaptured)} detail="Comp/value captured" accent={BLUE} />
        <LightMetric label="Future Value Wallet" value={`${numberLabel(totals.instantCertificates)} certs`} detail="Detected instant certificates" accent={GOLD} />
        <LightMetric label="Marketing Offers" value={numberLabel(totals.marketingOffers)} detail="Zero point cost by rule" accent="#7C3AED" />
        <LightMetric label="Avg. Make-Out / Cruise" value={money(totals.rowCount ? totals.netMakeout / totals.rowCount : 0)} detail="Capped displayed rows" accent={GREEN} />
      </View>
    </View>
  );
}

function ActionCenterPage({ rows, totals, currentPoints, onOpenDetail }: { rows: SafeCruiseRow[]; totals: CasinoTotals; currentPoints: number; onOpenDetail: (detail: DetailPayload) => void }) {
  const today = Date.now();
  const upcoming = rows
    .filter((row) => {
      const d = new Date(`${text(row.sailDate).slice(0, 10)}T00:00:00Z`).getTime();
      return Number.isFinite(d) && d >= today - 86400000;
    })
    .slice(0, 5);
  const expiring = rows.filter((row) => row.offerCode).slice(0, 6);
  const certRows = rows.filter((row) => row.offerType.toLowerCase().includes('instant')).slice(0, 6);
  const nextCertTarget = currentPoints < 400 ? 400 : currentPoints < 600 ? 600 : currentPoints < 800 ? 800 : currentPoints < 1200 ? 1200 : currentPoints < 1500 ? 1500 : currentPoints < 2000 ? 2000 : currentPoints < 3000 ? 3000 : currentPoints < 4000 ? 4000 : currentPoints < 6500 ? 6500 : currentPoints < 9000 ? 9000 : 25000;
  const pointsNeeded = Math.max(0, nextCertTarget - currentPoints);
  return (
    <View style={styles.lightDashboardPage}>
      <View style={styles.lightHeaderRow}>
        <View>
          <Text style={styles.lightPageTitle}>Casino Action Center</Text>
          <Text style={styles.lightPageSubtitle}>Manage upcoming cruises, offers, certificates, FreePlay, and daily actions.</Text>
        </View>
        <TouchableOpacity style={styles.lightSyncButton}><Text style={styles.lightSyncText}>Sync Now</Text></TouchableOpacity>
      </View>

      <View style={styles.lightMetricGrid}>
        <LightMetric label="Upcoming Cruises" value={numberLabel(upcoming.length)} detail="Next visible sailings" accent={BLUE} />
        <LightMetric label="Offers Attached" value={numberLabel(rows.length - totals.missingOfferCodes)} detail="Known offer/cert rows" accent="#7C3AED" />
        <LightMetric label="Instant Certificates" value={numberLabel(totals.instantCertificates)} detail="Detected certificates" accent={GOLD} />
        <LightMetric label="FreePlay / Perks" value="Review" detail="FP/OBC codes are separated" accent={CYAN} />
        <LightMetric label="Tasks Due" value={numberLabel(totals.missingOfferCodes)} detail="Missing offer codes" accent={totals.missingOfferCodes ? RED : GREEN} />
      </View>

      <View style={styles.lightGridThreeWide}>
        <LightPanel title="Upcoming Cruises" subtitle="Next sailings with offer/certificate context.">
          {upcoming.length ? upcoming.map((row) => (
            <TouchableOpacity key={`upcoming-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.upcomingCard}>
              <View style={styles.upcomingShipThumb}><Text style={styles.upcomingShipEmoji}>🚢</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lightRowTitle} numberOfLines={1}>{row.shipName}</Text>
                <Text style={styles.lightRowSub}>{shortDate(row.sailDate)} · {row.nights || '—'}N</Text>
                <Text style={styles.lightRowSub} numberOfLines={1}>{row.offerCode || 'Attach offer code'} · {row.offerType}</Text>
              </View>
            </TouchableOpacity>
          )) : <Text style={styles.lightText}>No upcoming cruise rows found in the current capped data set.</Text>}
        </LightPanel>

        <LightPanel title="Offers Expiring Soon" subtitle="Prioritize anything with a known code.">
          {expiring.map((row) => (
            <TouchableOpacity key={`expiring-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.actionListRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lightRowTitle}>{row.offerCode}</Text>
                <Text style={styles.lightRowSub} numberOfLines={1}>{row.offerType} · {row.shipName}</Text>
              </View>
              <Text style={styles.actionBadge}>{row.pointsRequired ? `${numberLabel(row.pointsRequired)} pts` : '0 pts'}</Text>
            </TouchableOpacity>
          ))}
        </LightPanel>

        <LightPanel title="Today's Action Items" subtitle="High-impact cleanup and booking tasks.">
          {[
            `Attach missing offer codes: ${numberLabel(totals.missingOfferCodes)}`,
            'Confirm taxes/fees and amount paid from invoices',
            'Update win/loss after each casino sailing',
            'Review expiring marketing offers',
            'Check next certificate threshold before playing',
          ].map((item) => (
            <View key={`task-${item}`} style={styles.taskRow}><Text style={styles.checkMark}>✓</Text><Text style={styles.taskText}>{item}</Text></View>
          ))}
        </LightPanel>
      </View>

      <View style={styles.lightGridTwo}>
        <LightPanel title="Instant Certificate Bank" subtitle="Detected instant certificate rows and point requirements.">
          {certRows.length ? certRows.map((row) => (
            <TouchableOpacity key={`cert-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.certBankRow}>
              <Text style={styles.lightRowTitle}>{row.offerCode}</Text>
              <Text style={styles.lightRowSub}>{row.shipName}</Text>
              <Text style={styles.certBankPoints}>{numberLabel(row.pointsRequired)} pts</Text>
            </TouchableOpacity>
          )) : <Text style={styles.lightText}>No instant certificate rows detected yet.</Text>}
        </LightPanel>
        <LightPanel title="Casino Goals & Progress" subtitle="Current year, certificate, Signature, and Masters status.">
          <LightProgress label="Available progress" value={currentPoints} max={25000} detail="Signature retain progress" color={BLUE} />
          <LightProgress label="Masters progress" value={currentPoints} max={100000} detail="Masters target progress" color="#7C3AED" />
          <LightProgress label="Next certificate step" value={currentPoints} max={nextCertTarget} detail={`${numberLabel(pointsNeeded)} points needed; approx ${money(pointsNeeded * 5)} slot coin-in volume`} color={GOLD} />
        </LightPanel>
      </View>
    </View>
  );
}

function HistorySimulatorPage({ rows, totals, ships, currentPoints, historicalPoints, onOpenDetail }: { rows: SafeCruiseRow[]; totals: CasinoTotals; ships: ShipPerformance[]; currentPoints: number; historicalPoints: number; onOpenDetail: (detail: DetailPayload) => void }) {
  const yearly = rows.slice(0, 6);
  const projectedPoints = currentPoints + Math.round((totals.rowCount ? totals.casinoPoints / totals.rowCount : 750) * 6);
  const projectedCoinIn = (projectedPoints - currentPoints) * 5;
  const projectedMakeout = totals.rowCount ? totals.netMakeout + (totals.netMakeout / totals.rowCount) * 6 : totals.netMakeout;
  return (
    <View style={styles.lightDashboardPage}>
      <View style={styles.lightHeaderRow}>
        <View>
          <Text style={styles.lightPageTitle}>History & Simulator</Text>
          <Text style={styles.lightPageSubtitle}>Dive into casino history, trends, and future scenarios.</Text>
        </View>
        <TouchableOpacity style={styles.lightSyncButton}><Text style={styles.lightSyncText}>Sync Now</Text></TouchableOpacity>
      </View>

      <View style={styles.lightMetricGrid}>
        <LightMetric label="Historical Casino Points" value={numberLabel(historicalPoints)} accent={BLUE} />
        <LightMetric label="Completed Cruises" value={numberLabel(totals.rowCount)} accent="#7C3AED" />
        <LightMetric label="Total Win/Loss" value={money(totals.winLoss)} accent={totals.winLoss >= 0 ? GREEN : RED} />
        <LightMetric label="Best Ship Points" value={ships[0]?.shipName ?? '—'} detail={ships[0] ? `${numberLabel(ships[0].points)} pts` : undefined} accent={GOLD} />
      </View>

      <View style={styles.lightGridThree}>
        <LightPanel title="Historical Casino Points" subtitle="Recent rows as a safe capped trend."><ValueBars rows={yearly} valueKey="casinoPoints" /></LightPanel>
        <LightPanel title="Win / Loss History" subtitle="Positive casino results by sailing."><ValueBars rows={yearly} valueKey="winLoss" /></LightPanel>
        <LightPanel title="Points Per Night Trend" subtitle="Casino points divided by nights.">
          <View style={styles.trendRows}>{yearly.map((row) => {
            const ppn = row.nights ? row.casinoPoints / row.nights : 0;
            return <View key={`ppn-${row.key}`} style={styles.trendRow}><Text style={styles.lightRowSub} numberOfLines={1}>{row.shipName}</Text><View style={styles.trendTrack}><View style={[styles.trendFill, { width: `${Math.max(4, pct(ppn, 1200))}%` }]} /></View><Text style={styles.trendValue}>{numberLabel(ppn)}</Text></View>;
          })}</View>
        </LightPanel>
      </View>

      <View style={styles.lightGridTwo}>
        <LightPanel title="Ship Performance History" subtitle="Average points, value, and net make-out by ship.">
          {ships.slice(0, 6).map((ship) => (
            <TouchableOpacity key={`history-ship-${ship.shipName}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildShipDetail(ship))} style={styles.lightLedgerRow}>
              <View style={{ flex: 1 }}><Text style={styles.lightRowTitle} numberOfLines={1}>{ship.shipName}</Text><Text style={styles.lightRowSub}>{ship.sailings} sailings · avg {numberLabel(ship.avgPoints)} pts/cruise</Text></View>
              <Text style={[styles.lightLedgerValue, ship.netMakeout < 0 ? styles.lightLossText : styles.lightWinText]}>{money(ship.netMakeout)}</Text>
            </TouchableOpacity>
          ))}
        </LightPanel>
        <LightPanel title="Insights Overview" subtitle="Best/worst signals from your known casino rows.">
          {[
            `Best ship by points: ${ships[0]?.shipName ?? 'Not enough data'}`,
            `Biggest displayed win/loss: ${money(Math.max(0, ...rows.map((row) => row.winLoss)))}`,
            `Most points in displayed rows: ${numberLabel(Math.max(0, ...rows.map((row) => row.casinoPoints)))}`,
            `Best displayed net make-out: ${money(Math.max(0, ...rows.map((row) => row.netMakeout)))}`,
          ].map((item) => <View key={`insight-${item}`} style={styles.taskRow}><Text style={styles.insightIcon}>◆</Text><Text style={styles.taskText}>{item}</Text></View>)}
        </LightPanel>
      </View>

      <View style={styles.lightGridTwo}>
        <LightPanel title="Simulator Builder" subtitle="Safe scenario controls for this one-screen build.">
          <View style={styles.simControl}><Text style={styles.simLabel}>Scenario</Text><Text style={styles.simValue}>Stay the Course</Text></View>
          <LightProgress label="Monthly coin-in" value={5000} max={12000} detail="$5K/month default scenario" color={BLUE} />
          <LightProgress label="Cruises per year" value={6} max={12} detail="6 cruises/year scenario" color="#7C3AED" />
          <TouchableOpacity style={styles.runSimulationButton}><Text style={styles.runSimulationText}>Run Simulation</Text></TouchableOpacity>
        </LightPanel>
        <LightPanel title="Results Summary" subtitle="Projected scenario from current path.">
          <View style={styles.resultsGrid}>
            <LightMetric label="Points Earned" value={numberLabel(projectedPoints)} accent={BLUE} />
            <LightMetric label="Coin-In" value={money(projectedCoinIn)} accent={GOLD} />
            <LightMetric label="Net Make-Out" value={money(projectedMakeout)} accent={GREEN} />
            <LightMetric label="Value Per $1" value={totals.paid ? `${((projectedMakeout + totals.paid) / totals.paid).toFixed(2)}x` : '—'} accent="#7C3AED" />
          </View>
        </LightPanel>
      </View>

      <LightPanel title="Keep Playing / Stop Playing Decision" subtitle="Certificate pursuit should be based on cash risk, not coin-in volume.">
        <LightProgress label="Signature retain" value={currentPoints} max={25000} detail={`${numberLabel(Math.max(0, 25000 - currentPoints))} points to retain Signature`} color={BLUE} />
        <Text style={styles.lightText}>Coin-in is volume, not cost. The real decision is whether the expected certificate or cruise value exceeds your actual cash risk and stop-loss.</Text>
      </LightPanel>
    </View>
  );
}

function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.lightPage}>
      <Text style={styles.lightPageTitle}>{title}</Text>
      <Text style={styles.lightPageSubtitle}>{subtitle}</Text>
      <View style={styles.lightCard}>
        <Text style={styles.lightCardTitle}>Coming next in this one-tab-at-a-time rebuild</Text>
        <Text style={styles.lightText}>This tab is intentionally left on the stable v1069 lightweight path while Casino Portfolio is rebuilt and tested first.</Text>
      </View>
    </View>
  );
}

function CasinoPortfolioPage({ rows, totals, ships, currentPoints, historicalPoints, clubRoyaleTier, crownAnchorLevel, crownAnchorPoints, onOpenDetail }: {
  rows: SafeCruiseRow[];
  totals: CasinoTotals;
  ships: ShipPerformance[];
  currentPoints: number;
  historicalPoints: number;
  clubRoyaleTier: unknown;
  crownAnchorLevel: unknown;
  crownAnchorPoints: unknown;
  onOpenDetail: (detail: DetailPayload) => void;
}) {
  const signatureGap = Math.max(0, 25000 - currentPoints);
  const mastersGap = Math.max(0, 100000 - currentPoints);
  const dataCoverage = totals.rowCount ? pct(totals.verifiedRows, totals.rowCount) : 0;
  const topRows = rows.slice(0, 8);
  const bestByPoints = [...ships].sort((a, b) => b.points - a.points)[0];
  const bestByWinLoss = [...ships].sort((a, b) => b.winLoss - a.winLoss)[0];
  const bestByMakeout = [...ships].sort((a, b) => b.netMakeout - a.netMakeout)[0];
  const worstByCash = [...ships].sort((a, b) => a.winLoss - b.winLoss)[0];

  return (
    <View style={styles.portfolioPage}>
      <View style={styles.portfolioHeader}>
        <View>
          <Text style={styles.portfolioTitle}>Casino Portfolio</Text>
          <Text style={styles.portfolioSubtitle}>Your overall casino and loyalty overview</Text>
        </View>
        <TouchableOpacity style={styles.darkSyncButton}>
          <Text style={styles.darkSyncText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.darkMetricGrid}>
        <DarkMetric label="Club Royale" value={text(clubRoyaleTier, 'Choice')} detail={`${numberLabel(currentPoints)} current-year points`} accent={GOLD} onPress={() => onOpenDetail(buildMetricDetail('Club Royale status', text(clubRoyaleTier, 'Choice'), [ { label: 'Current-year points', value: detailNumber(currentPoints, ' pts') }, { label: 'Signature retain gap', value: detailNumber(signatureGap, ' pts') }, { label: 'Masters gap', value: detailNumber(mastersGap, ' pts') }, { label: 'Estimated current-year slot coin-in volume', value: detailMoney(currentPoints * 5) } ], ['Club Royale points are separate from Crown & Anchor cruise points.']))} />
        <DarkMetric label="Retain Signature" value={numberLabel(signatureGap)} detail="Points to retain Signature" accent={GOLD} onPress={() => onOpenDetail(buildMetricDetail('Signature retain calculation', `${numberLabel(signatureGap)} points needed`, [ { label: 'Signature retain target', value: '25,000 pts' }, { label: 'Current Club Royale points', value: detailNumber(currentPoints, ' pts') }, { label: 'Remaining points', value: detailNumber(signatureGap, ' pts') }, { label: 'Estimated slot coin-in volume needed', value: detailMoney(signatureGap * 5) } ], ['Slot coin-in estimate uses $5 coin-in per Club Royale point.']))} />
        <DarkMetric label="Reach Masters" value={numberLabel(mastersGap)} detail="Points to reach Masters" accent={BLUE} onPress={() => onOpenDetail(buildMetricDetail('Masters progress calculation', `${numberLabel(mastersGap)} points needed`, [ { label: 'Masters target', value: '100,000 pts' }, { label: 'Current Club Royale points', value: detailNumber(currentPoints, ' pts') }, { label: 'Remaining points', value: detailNumber(mastersGap, ' pts') }, { label: 'Estimated slot coin-in volume needed', value: detailMoney(mastersGap * 5) } ]))} />
        <DarkMetric label="Crown & Anchor" value={text(crownAnchorLevel, 'Gold')} detail={`${numberLabel(crownAnchorPoints)} cruise points`} accent={CYAN} onPress={() => onOpenDetail(buildMetricDetail('Crown & Anchor status', text(crownAnchorLevel, 'Gold'), [ { label: 'Cruise points', value: detailNumber(crownAnchorPoints, ' pts') }, { label: 'Points to Pinnacle', value: detailNumber(Math.max(0, 700 - num(crownAnchorPoints)), ' pts') }, { label: 'Projected after booked cruises', value: detailNumber(num(crownAnchorPoints), ' pts') } ], ['Crown & Anchor cruise points are separate from Club Royale casino points.']))} />
      </View>

      <View style={styles.darkSummaryStrip}>
        <DarkMetric label="Historical Casino Points" value={numberLabel(historicalPoints)} accent={GOLD} onPress={() => onOpenDetail(buildMetricDetail('Historical casino points', detailNumber(historicalPoints, ' pts'), [ { label: 'Historical points source', value: 'Loyalty profile / casino history' }, { label: 'Dashboard row points', value: detailNumber(totals.casinoPoints, ' pts') }, { label: 'Displayed row count', value: detailNumber(totals.rowCount) } ]))} />
        <DarkMetric label="Completed Cruise Sailings" value={numberLabel(totals.rowCount)} accent={CYAN} onPress={() => onOpenDetail(buildMetricDetail('Completed cruise sailings', detailNumber(totals.rowCount), [ { label: 'Total nights', value: detailNumber(totals.totalNights) }, { label: 'Verified rows', value: detailNumber(totals.verifiedRows) }, { label: 'Missing offer codes', value: detailNumber(totals.missingOfferCodes) } ]))} />
        <DarkMetric label="Total Casino Win/Loss" value={money(totals.winLoss)} accent={totals.winLoss >= 0 ? GREEN : RED} onPress={() => onOpenDetail(buildMetricDetail('Total casino win/loss', detailMoney(totals.winLoss), [ { label: 'Casino win/loss', value: detailMoney(totals.winLoss), tone: totals.winLoss >= 0 ? 'good' : 'bad' }, { label: 'Average per cruise', value: detailMoney(totals.rowCount ? totals.winLoss / totals.rowCount : 0) }, { label: 'Rows counted', value: detailNumber(totals.rowCount) } ]))} />
        <DarkMetric label="Estimated Lifetime Coin-In" value={money(totals.coinIn)} accent={BLUE} onPress={() => onOpenDetail(buildMetricDetail('Estimated lifetime coin-in', detailMoney(totals.coinIn), [ { label: 'Total casino points in displayed rows', value: detailNumber(totals.casinoPoints, ' pts') }, { label: 'Slot conversion rule', value: '$5 coin-in per point' }, { label: 'Estimated coin-in volume', value: detailMoney(totals.coinIn) } ], ['Coin-in is wagering volume and must not be treated as cash cost.']))} />
        <DarkMetric label="Net Make-Out" value={money(totals.netMakeout)} accent={GREEN} onPress={() => onOpenDetail(buildMetricDetail('Net make-out', detailMoney(totals.netMakeout), [ { label: 'Retail/value captured', value: detailMoney(totals.valueCaptured || totals.retailValue) }, { label: 'Casino win/loss', value: detailMoney(totals.winLoss), tone: totals.winLoss >= 0 ? 'good' : 'bad' }, { label: 'Cash paid', value: detailMoney(totals.paid), tone: totals.paid > 0 ? 'warn' : 'normal' }, { label: 'Net make-out', value: detailMoney(totals.netMakeout), tone: totals.netMakeout >= 0 ? 'good' : 'bad' } ], ['Net make-out is a directional dashboard value based on capped rows and available data.']))} />
      </View>

      <View style={styles.darkGridTwoOne}>
        <DarkPanel title="Club Royale Progress" subtitle="Current year progression">
          <Progress label="Signature retain" value={currentPoints} max={25000} detail={`${numberLabel(signatureGap)} points to go`} color={GOLD} />
          <Progress label="Masters progress" value={currentPoints} max={100000} detail={`${numberLabel(mastersGap)} points to go`} color={BLUE} />
        </DarkPanel>
        <DarkPanel title="Historical Casino Points" subtitle="Recent sailings by point output">
          <MiniBarChart rows={rows} metric="casinoPoints" />
        </DarkPanel>
        <DarkPanel title="Net Make-Out Progress" subtitle="All-time value capture">
          <TouchableOpacity activeOpacity={0.82} style={styles.makeoutCircle} onPress={() => onOpenDetail(buildMetricDetail('Net make-out progress', detailMoney(totals.netMakeout), [ { label: 'Target', value: '$100,000' }, { label: 'Current make-out', value: detailMoney(totals.netMakeout), tone: totals.netMakeout >= 0 ? 'good' : 'bad' }, { label: 'Progress', value: `${pct(totals.netMakeout, 100000)}%` } ]))}>
            <Text style={styles.makeoutValue}>{money(totals.netMakeout)}</Text>
            <Text style={styles.makeoutLabel}>All Time</Text>
            <Text style={styles.tapHint}>Tap for details</Text>
          </TouchableOpacity>
        </DarkPanel>
      </View>

      <DarkPanel title="Data Coverage" subtitle="Completed cruise rows with verified casino/value data.">
        <Progress label="Data coverage" value={dataCoverage} max={100} detail={`${dataCoverage}% verified coverage across ${numberLabel(totals.rowCount)} rows`} color={GOLD} />
      </DarkPanel>

      <DarkPanel title="Completed Cruise Sailings" subtitle="Casino points, coin-in, win/loss, offer code, and data quality.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tableWide}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, styles.tableShip]}>Ship</Text>
              <Text style={[styles.tableHead, styles.tableSmall]}>Pts</Text>
              <Text style={[styles.tableHead, styles.tableMoney]}>Coin-In</Text>
              <Text style={[styles.tableHead, styles.tableMoney]}>Win/Loss</Text>
              <Text style={[styles.tableHead, styles.tableCode]}>Offer</Text>
            </View>
            {topRows.map((row) => (
              <TouchableOpacity key={`sailing-${row.key}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildCruiseDetail(row))} style={styles.tableRow}>
                <View style={styles.tableShip}>
                  <Text style={styles.tableMain} numberOfLines={1}>{row.shipName}</Text>
                  <Text style={styles.tableSub} numberOfLines={1}>{shortDate(row.sailDate)} · {row.nights || '—'}N</Text>
                </View>
                <Text style={[styles.tableCell, styles.tableSmall]}>{numberLabel(row.casinoPoints)}</Text>
                <Text style={[styles.tableCell, styles.tableMoney]}>{money(row.coinIn)}</Text>
                <Text style={[styles.tableCell, styles.tableMoney, row.winLoss < 0 ? styles.lossText : styles.winText]}>{money(row.winLoss)}</Text>
                <View style={styles.tableCode}>
                  <Text style={styles.tableCell} numberOfLines={1}>{row.offerCode || 'UNKNOWN'}</Text>
                  <StatusBadge status={row.quality} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        {!topRows.length ? <Text style={styles.darkEmpty}>No casino cruise rows are available yet.</Text> : null}
      </DarkPanel>

      <DarkPanel title="Ship Casino Performance" subtitle="Best ships, strongest returns, and cash-risk signals.">
        <View style={styles.shipCardGrid}>
          <ShipHeroCard title="Best Ship by Points" ship={bestByPoints} metric={bestByPoints ? `${numberLabel(bestByPoints.points)} pts` : '—'} accent={GOLD} onPress={bestByPoints ? () => onOpenDetail(buildShipDetail(bestByPoints)) : undefined} />
          <ShipHeroCard title="Best Ship by Win/Loss" ship={bestByWinLoss} metric={bestByWinLoss ? money(bestByWinLoss.winLoss) : '—'} accent={GREEN} onPress={bestByWinLoss ? () => onOpenDetail(buildShipDetail(bestByWinLoss)) : undefined} />
          <ShipHeroCard title="Best True Make-Out" ship={bestByMakeout} metric={bestByMakeout ? money(bestByMakeout.netMakeout) : '—'} accent={CYAN} onPress={bestByMakeout ? () => onOpenDetail(buildShipDetail(bestByMakeout)) : undefined} />
          <ShipHeroCard title="Worst Cash Result" ship={worstByCash} metric={worstByCash ? money(worstByCash.winLoss) : '—'} accent={RED} onPress={worstByCash ? () => onOpenDetail(buildShipDetail(worstByCash)) : undefined} />
        </View>
        <View style={styles.shipPerformanceTable}>
          {ships.slice(0, 6).map((ship) => (
            <TouchableOpacity key={`ship-${ship.shipName}`} activeOpacity={0.82} onPress={() => onOpenDetail(buildShipDetail(ship))} style={styles.shipPerfRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableMain} numberOfLines={1}>{ship.shipName}</Text>
                <Text style={styles.tableSub}>{ship.sailings} sailings · avg {numberLabel(ship.avgPoints)} pts/cruise</Text>
              </View>
              <Text style={styles.tableCell}>{money(ship.netMakeout)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </DarkPanel>

      <DarkPanel title="Data Integrity" subtitle="What needs cleanup before the values should be treated as final.">
        <View style={styles.integrityGrid}>
          <DarkMetric label="Missing offer codes" value={numberLabel(totals.missingOfferCodes)} accent={totals.missingOfferCodes ? RED : GREEN} />
          <DarkMetric label="Verified rows" value={numberLabel(totals.verifiedRows)} accent={GREEN} />
          <DarkMetric label="Instant certificates" value={numberLabel(totals.instantCertificates)} accent={GOLD} />
          <DarkMetric label="Marketing offers" value={numberLabel(totals.marketingOffers)} accent={BLUE} />
        </View>
      </DarkPanel>
    </View>
  );
}

export default function CasinoAnalyticsStableRoute() {
  const { width } = useWindowDimensions();
  const isPhone = width < 720;
  const [activeTab, setActiveTab] = useState<CasinoTab>('portfolio');
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const { localData } = useAppState();
  const { bookedCruises: storedBookedCruises } = useCoreData();
  const { sessions } = useCasinoSessions();
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    clubRoyaleCurrentYearPoints,
    clubRoyaleHistoricalPoints,
    crownAnchorPoints,
    crownAnchorLevel,
  } = useLoyalty();

  const rowsBuild = useMemo(() => safeRun('CASINO_V1073_ROWS_FAILED', () => buildSafeCruiseRows(
    asArray(localData?.booked as BookedCruise[] | undefined),
    asArray(storedBookedCruises as BookedCruise[] | undefined),
  ), [] as SafeCruiseRow[]), [localData?.booked, storedBookedCruises]);

  const rows = asArray(rowsBuild.value);
  const totalsBuild = useMemo(() => safeRun('CASINO_TOTALS_FAILED', () => buildTotals(rows), EMPTY_TOTALS), [rows]);
  const totals = totalsBuild.value;
  const shipsBuild = useMemo(() => safeRun('CASINO_SHIPS_FAILED', () => buildShipPerformance(rows), [] as ShipPerformance[]), [rows]);
  const ships = shipsBuild.value;
  const sessionRowsBuild = useMemo(() => safeRun('CASINO_SESSIONS_FAILED', () => asArray(sessions as any[]).slice(0, 80), [] as any[]), [sessions]);
  const sessionRows = sessionRowsBuild.value;
  const currentPoints = Math.max(num(clubRoyaleCurrentYearPoints), num(clubRoyalePoints));
  const historicalPoints = Math.max(num(clubRoyaleHistoricalPoints), totals.casinoPoints);

  const openDetail = (payload: DetailPayload) => {
    const safePayload: DetailPayload = {
      title: text(payload?.title, 'Casino detail'),
      subtitle: text(payload?.subtitle),
      badge: text(payload?.badge),
      lines: asArray(payload?.lines).slice(0, 40).map((line) => ({
        label: text(line?.label, 'Detail'),
        value: text(line?.value, '—'),
        tone: line?.tone,
      })),
      notes: asArray(payload?.notes).slice(0, 10).map((note) => text(note)).filter(Boolean),
    };
    setDetail(safePayload);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 250);
  };

  const tabs: { key: CasinoTab; label: string }[] = [
    { key: 'portfolio', label: 'Casino Portfolio' },
    { key: 'value', label: 'Cruise Value' },
    { key: 'action', label: 'Action Center' },
    { key: 'history', label: 'History & Simulator' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ResponsiveContainer>
          <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.scrollContent} removeClippedSubviews>
            <View style={[styles.shell, isPhone && styles.shellPhone]}>
              <View style={[styles.sideNav, isPhone && styles.sideNavPhone]}>
                <Text style={[styles.logoMark, isPhone && styles.logoMarkPhone]}>Casino</Text>
                {tabs.map((tab) => (
                  <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.sideNavButton, isPhone && styles.sideNavButtonPhone, activeTab === tab.key && styles.sideNavButtonActive]}>
                    <Text style={[styles.sideNavText, activeTab === tab.key && styles.sideNavTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={[styles.sideStatusCard, isPhone && styles.sideStatusCardPhone]}>
                  <Text style={styles.sideStatusSmall}>Club Royale</Text>
                  <Text style={styles.sideStatusTier}>{text(clubRoyaleTier, 'Choice')}</Text>
                  <Text style={styles.sideStatusPoints}>{numberLabel(currentPoints)} pts</Text>
                </View>
              </View>

              <View style={styles.mainContent}>
                {(!rowsBuild.ok || !totalsBuild.ok || !shipsBuild.ok || !sessionRowsBuild.ok) ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Safe fallback notice</Text>
                    <Text style={styles.errorText}>{rowsBuild.message || totalsBuild.message || shipsBuild.message || sessionRowsBuild.message || 'Casino data loaded in safe fallback mode.'}</Text>
                  </View>
                ) : null}

                <CasinoCrashBoundary activeTab={activeTab}>
                {activeTab === 'portfolio' ? (
                  <CasinoPortfolioPage
                    rows={rows}
                    totals={totals}
                    ships={ships}
                    currentPoints={currentPoints}
                    historicalPoints={historicalPoints}
                    clubRoyaleTier={clubRoyaleTier}
                    crownAnchorLevel={crownAnchorLevel}
                    crownAnchorPoints={crownAnchorPoints}
                    onOpenDetail={openDetail}
                  />
                ) : null}
                {activeTab === 'value' ? <CruiseValuePage rows={rows} totals={totals} onOpenDetail={openDetail} /> : null}
                {activeTab === 'action' ? <ActionCenterPage rows={rows} totals={totals} currentPoints={currentPoints} onOpenDetail={openDetail} /> : null}
                {activeTab === 'history' ? <HistorySimulatorPage rows={rows} totals={totals} ships={ships} currentPoints={currentPoints} historicalPoints={historicalPoints} onOpenDetail={openDetail} /> : null}
                </CasinoCrashBoundary>
              </View>
            </View>

            <Text style={styles.footer}>v1078: Casino crash guard active — old architecture, capped rows, safe details, and render fallback preserved.</Text>
          </ScrollView>
        </ResponsiveContainer>
        <Modal visible={!!detail} animationType="fade" transparent onRequestClose={() => setDetail(null)}>
          <View style={styles.detailModalBackdrop}>
            <View style={styles.detailModalCard}>
              <View style={styles.detailModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailModalTitle}>{detail?.title}</Text>
                  {detail?.subtitle ? <Text style={styles.detailModalSubtitle}>{detail.subtitle}</Text> : null}
                </View>
                <Pressable onPress={() => setDetail(null)} style={styles.detailCloseButton}><Text style={styles.detailCloseText}>Close</Text></Pressable>
              </View>
              {detail?.badge ? <Text style={styles.detailBadge}>{detail.badge}</Text> : null}
              <ScrollView style={styles.detailModalScroll} contentContainerStyle={styles.detailModalScrollContent}>
                {asArray(detail?.lines).map((line) => (
                  <View key={`${line.label}-${line.value}`} style={styles.detailLine}>
                    <Text style={styles.detailLineLabel}>{line.label}</Text>
                    <Text style={[styles.detailLineValue, line.tone === 'good' && styles.detailGood, line.tone === 'bad' && styles.detailBad, line.tone === 'warn' && styles.detailWarn]}>{line.value}</Text>
                  </View>
                ))}
                {asArray(detail?.notes).length ? <View style={styles.detailNotesBox}>{asArray(detail?.notes).map((note) => <Text key={note} style={styles.detailNote}>• {note}</Text>)}</View> : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({

  tapHint: { color: COLORS.gray[500], fontSize: 9, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  lightTapHint: { color: COLORS.gray[400], fontSize: 9, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  detailModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', padding: SPACING.lg, justifyContent: 'center' },
  detailModalCard: { maxHeight: '86%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  detailModalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.sm },
  detailModalTitle: { color: COLORS.gray[900], fontSize: 22, fontWeight: '900' },
  detailModalSubtitle: { color: COLORS.gray[600], fontSize: 12, lineHeight: 17, marginTop: 3 },
  detailCloseButton: { backgroundColor: '#1557C7', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full },
  detailCloseText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  detailBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.gray[100], color: COLORS.gray[700], fontWeight: '900', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.sm, overflow: 'hidden' },
  detailModalScroll: { maxHeight: 520 },
  detailModalScrollContent: { paddingBottom: SPACING.md },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  detailLineLabel: { flex: 1, color: COLORS.gray[600], fontSize: 12, fontWeight: '700' },
  detailLineValue: { flex: 1, color: COLORS.gray[900], fontSize: 13, fontWeight: '900', textAlign: 'right' },
  detailGood: { color: GREEN },
  detailBad: { color: RED },
  detailWarn: { color: '#B45309' },
  detailNotesBox: { marginTop: SPACING.md, backgroundColor: COLORS.gray[50], borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200] },
  detailNote: { color: COLORS.gray[700], fontSize: 12, lineHeight: 17, marginBottom: 4 },
  container: { flex: 1, backgroundColor: DARK_BG },
  safeArea: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  shell: { flexDirection: 'row', gap: SPACING.md },
  shellPhone: { flexDirection: 'column', gap: SPACING.sm },
  sideNav: { width: 138, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  sideNavPhone: { width: '100%', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: SPACING.xs },
  logoMark: { color: ROYAL_NAVY, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: SPACING.md },
  logoMarkPhone: { width: '100%', textAlign: 'left', marginBottom: 2, paddingHorizontal: SPACING.xs },
  sideNavButton: { borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs, marginBottom: 6, borderWidth: 1, borderColor: COLORS.gray[200] },
  sideNavButtonPhone: { flexGrow: 1, flexBasis: '47%', marginBottom: 0, alignItems: 'center' },
  sideNavButtonActive: { backgroundColor: ROYAL_BLUE, borderColor: ROYAL_BLUE },
  sideNavText: { color: COLORS.gray[700], fontSize: 11, fontWeight: '800' },
  sideNavTextActive: { color: COLORS.white },
  sideStatusCard: { marginTop: SPACING.lg, backgroundColor: ROYAL_SKY, borderRadius: BORDER_RADIUS.lg, padding: SPACING.sm, borderWidth: 1, borderColor: 'rgba(212,160,10,0.35)' },
  sideStatusCardPhone: { width: '100%', marginTop: 2 },
  sideStatusSmall: { color: GOLD, fontSize: 10, fontWeight: '800' },
  sideStatusTier: { color: ROYAL_NAVY, fontSize: 14, fontWeight: '900', marginTop: 2 },
  sideStatusPoints: { color: COLORS.gray[700], fontSize: 12, marginTop: 5, fontWeight: '800' },
  mainContent: { flex: 1, minWidth: 0 },
  portfolioPage: { gap: SPACING.md },
  portfolioHeader: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[200] },
  portfolioTitle: { color: ROYAL_NAVY, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: '900' },
  portfolioSubtitle: { color: COLORS.gray[600], fontSize: 12, marginTop: 3 },
  darkSyncButton: { borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: ROYAL_SKY, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  darkSyncText: { color: ROYAL_NAVY, fontSize: 11, fontWeight: '900' },
  darkMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  darkSummaryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  darkMetric: { flexGrow: 1, flexBasis: 160, minWidth: 130, backgroundColor: DARK_PANEL_2, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], overflow: 'hidden' },
  metricAccent: { width: 34, height: 3, borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.sm },
  darkMetricLabel: { color: COLORS.gray[600], fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  darkMetricValue: { color: ROYAL_NAVY, fontSize: 19, fontWeight: '900', marginTop: 5 },
  darkMetricDetail: { color: COLORS.gray[600], fontSize: 11, lineHeight: 15, marginTop: 4 },
  darkGridTwoOne: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  darkPanel: { flexGrow: 1, flexBasis: 260, backgroundColor: DARK_PANEL, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  darkPanelTitle: { color: ROYAL_NAVY, fontSize: 17, fontWeight: '900' },
  darkPanelSubtitle: { color: COLORS.gray[600], fontSize: 11, marginTop: 3, lineHeight: 15 },
  darkPanelBody: { marginTop: SPACING.md },
  progressBlock: { marginBottom: SPACING.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { color: ROYAL_NAVY, fontWeight: '800', fontSize: 12 },
  progressPercent: { color: COLORS.gray[700], fontWeight: '800', fontSize: 12 },
  progressTrack: { height: 10, backgroundColor: COLORS.gray[200], borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: BORDER_RADIUS.full },
  progressDetail: { color: COLORS.gray[600], fontSize: 11, marginTop: 4 },
  barChart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: SPACING.md },
  barSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barColumn: { width: '74%', backgroundColor: GOLD, borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 10 },
  barLabel: { color: COLORS.gray[500], fontSize: 9, marginTop: 5 },
  makeoutCircle: { alignSelf: 'center', width: 150, height: 150, borderRadius: 75, borderWidth: 16, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: ROYAL_SKY },
  makeoutValue: { color: ROYAL_NAVY, fontSize: 20, fontWeight: '900' },
  makeoutLabel: { color: COLORS.gray[600], fontSize: 11, marginTop: 3 },
  tableWide: { minWidth: 520 },
  tableHeader: { flexDirection: 'row', gap: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.gray[200] },
  tableRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200], alignItems: 'center' },
  tableHead: { color: COLORS.gray[600], fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tableShip: { flex: 1.7, minWidth: 95 },
  tableSmall: { width: 62, textAlign: 'right' },
  tableMoney: { width: 82, textAlign: 'right' },
  tableCode: { width: 92, alignItems: 'flex-end' },
  tableMain: { color: ROYAL_NAVY, fontSize: 12, fontWeight: '900' },
  tableSub: { color: COLORS.gray[600], fontSize: 10, marginTop: 2 },
  tableCell: { color: ROYAL_NAVY, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  winText: { color: GREEN },
  lossText: { color: RED },
  statusBadge: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  darkEmpty: { color: COLORS.gray[600], fontSize: 12, lineHeight: 18 },
  shipCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  shipHeroCard: { flexGrow: 1, flexBasis: 155, backgroundColor: '#082044', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' },
  shipImageMock: { width: '100%', height: 64, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ROYAL_SKY, marginBottom: SPACING.sm },
  shipEmoji: { fontSize: 28 },
  shipHeroTitle: { color: COLORS.gray[600], fontSize: 10, fontWeight: '900', textAlign: 'center' },
  shipHeroShip: { color: ROYAL_NAVY, fontSize: 13, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  shipHeroMetric: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  shipHeroDetail: { color: COLORS.gray[600], fontSize: 10, marginTop: 2 },
  shipPerformanceTable: { backgroundColor: '#F8FAFC', borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  shipPerfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  integrityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  lightDashboardPage: { backgroundColor: '#F8FAFC', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  lightHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.sm },
  lightSyncButton: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  lightSyncText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
  lightMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  lightMetric: { flexGrow: 1, flexBasis: 150, minWidth: 130, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  lightIconDot: { width: 28, height: 4, borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.sm },
  lightMetricLabel: { color: COLORS.gray[600], fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  lightMetricValue: { color: COLORS.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 4 },
  lightMetricDetail: { color: COLORS.gray[600], fontSize: 11, lineHeight: 15, marginTop: 4 },
  lightPanel: { flexGrow: 1, flexBasis: 260, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.gray[200], ...SHADOW.card },
  lightPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lightPanelTitle: { color: COLORS.navyDeep, fontSize: 16, fontWeight: '900' },
  lightPanelSubtitle: { color: COLORS.gray[600], fontSize: 11, marginTop: 3, lineHeight: 15 },
  lightPanelBody: { marginTop: SPACING.md },
  lightGridThree: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  lightGridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  lightGridThreeWide: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  lightProgressBlock: { marginBottom: SPACING.md },
  lightProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  lightProgressLabel: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 12 },
  lightProgressPercent: { color: COLORS.gray[700], fontWeight: '900', fontSize: 12 },
  lightProgressTrack: { height: 10, backgroundColor: COLORS.gray[200], borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  lightProgressFill: { height: '100%', borderRadius: BORDER_RADIUS.full },
  lightProgressDetail: { color: COLORS.gray[600], fontSize: 11, marginTop: 4 },
  valueBars: { height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: SPACING.md },
  valueBarSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  valueBarColumns: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, width: '100%', height: '86%' },
  valueBarPrimary: { width: 12, backgroundColor: BLUE, borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 8 },
  valueBarSecondary: { width: 12, backgroundColor: GREEN, borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 8 },
  valueBarLabel: { color: COLORS.gray[500], fontSize: 9, marginTop: 5 },
  donutWrap: { gap: SPACING.md },
  donutMock: { alignSelf: 'center', width: 132, height: 132, borderRadius: 66, borderWidth: 16, borderColor: BLUE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  donutValue: { color: COLORS.navyDeep, fontSize: 17, fontWeight: '900' },
  donutLabel: { color: COLORS.gray[600], fontSize: 10, marginTop: 2 },
  donutLegend: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { width: 72, color: COLORS.gray[700], fontSize: 10, fontWeight: '800' },
  legendTrack: { flex: 1, height: 6, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.gray[200], overflow: 'hidden' },
  legendFill: { height: '100%', borderRadius: BORDER_RADIUS.full },
  legendValue: { width: 58, color: COLORS.navyDeep, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  bigRoi: { color: GREEN, fontSize: 42, fontWeight: '900', textAlign: 'center', marginTop: SPACING.lg },
  roiText: { color: COLORS.gray[700], textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: SPACING.sm },
  lightLedgerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  lightLedgerMetrics: { alignItems: 'flex-end', gap: 3 },
  lightLedgerValue: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  lightRowTitle: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '900' },
  lightRowSub: { color: COLORS.gray[600], fontSize: 11, marginTop: 2, lineHeight: 15 },
  lightWinText: { color: GREEN },
  lightLossText: { color: RED },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  offerPoints: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  makeoutRow: { paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  makeoutRowValue: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  upcomingCard: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  upcomingShipThumb: { width: 48, height: 42, borderRadius: BORDER_RADIUS.md, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  upcomingShipEmoji: { fontSize: 22 },
  actionListRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  actionBadge: { color: COLORS.primary, backgroundColor: '#DBEAFE', overflow: 'hidden', borderRadius: BORDER_RADIUS.full, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: 7 },
  checkMark: { color: BLUE, fontSize: 14, fontWeight: '900', width: 18 },
  insightIcon: { color: '#7C3AED', fontSize: 12, fontWeight: '900', width: 18 },
  taskText: { flex: 1, color: COLORS.gray[700], fontSize: 12, lineHeight: 17, fontWeight: '700' },
  certBankRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray[200] },
  certBankPoints: { marginLeft: 'auto', color: GOLD, fontSize: 12, fontWeight: '900' },
  trendRows: { gap: 9 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendTrack: { flex: 1, height: 8, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.gray[200], overflow: 'hidden' },
  trendFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: BORDER_RADIUS.full },
  trendValue: { width: 42, textAlign: 'right', color: COLORS.navyDeep, fontSize: 11, fontWeight: '900' },
  simControl: { backgroundColor: '#F8FAFC', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gray[200], marginBottom: SPACING.md },
  simLabel: { color: COLORS.gray[600], fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  simValue: { color: COLORS.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 3 },
  runSimulationButton: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  runSimulationText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  lightPage: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOW.card },
  lightPageTitle: { color: COLORS.navyDeep, fontSize: 26, fontWeight: '900' },
  lightPageSubtitle: { color: COLORS.gray[600], fontSize: 13, marginTop: 4, marginBottom: SPACING.lg },
  lightCard: { backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.gray[200] },
  lightCardTitle: { color: COLORS.navyDeep, fontSize: 16, fontWeight: '900' },
  lightText: { color: COLORS.gray[700], fontSize: 13, lineHeight: 19, marginTop: 6 },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: SPACING.md },
  errorTitle: { color: '#991B1B', fontSize: 14, fontWeight: '900' },
  errorText: { color: '#7F1D1D', fontSize: 12, marginTop: 4 },
  footer: { color: COLORS.gray[500], fontSize: 11, textAlign: 'center', marginTop: SPACING.md },
});
