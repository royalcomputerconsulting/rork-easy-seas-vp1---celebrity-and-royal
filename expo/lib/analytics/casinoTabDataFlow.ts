import { estimateCoinInForPoints, normalizeGameCategory, type CasinoBrand, type GameCategory } from '@/lib/casino/pointsEarning';

type AnyCruise = Record<string, any>;
type AnySession = Record<string, any>;

export type CasinoTabSourceMode = 'cruise-verified' | 'session-tracked' | 'mixed' | 'empty';

export type CasinoTabFlowTotals = {
  points: number;
  winLoss: number;
  coinIn: number;
  cashCoinIn: number;
  freeplayCoinIn: number;
  sessions: number;
  individualSessions: number;
  extrapolatedSessions: number;
  trackedSessions: number;
  derivedSessions: number;
  cruises: number;
  actualCruiseRows: number;
  mixedCruiseRows: number;
  estimatedCruiseRows: number;
  hours: number;
  retailValue: number;
  amountPaid: number;
  totalEconomicValue: number;
};

export type CasinoTabFlowRecord = {
  id: string;
  shipName: string;
  sailDate: string;
  sourceMode: CasinoTabSourceMode;
  calculationConfidence: 'actual' | 'mixed' | 'estimated' | 'unknown';
  points: number;
  winLoss: number;
  coinIn: number;
  cashCoinIn: number;
  freeplayCoinIn: number;
  sessionCount: number;
  individualSessionCount: number;
  extrapolatedSessionCount: number;
  hours: number;
  nights: number;
  retailValue: number;
  amountPaid: number;
  totalEconomicValue: number;
  warnings: string[];
};

export type CasinoTabDataFlow = {
  generatedAt: string;
  sourceMode: CasinoTabSourceMode;
  totals: CasinoTabFlowTotals;
  records: CasinoTabFlowRecord[];
  unlinkedSessionRecords: CasinoTabFlowRecord[];
  warnings: string[];
  tabReadiness: {
    intelligence: boolean;
    charts: boolean;
    session: boolean;
    calcs: boolean;
  };
  tabTotals: {
    intelligence: CasinoTabFlowTotals;
    charts: CasinoTabFlowTotals;
    session: CasinoTabFlowTotals;
    calcs: CasinoTabFlowTotals;
  };
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSessionGameCategory(session: AnySession): GameCategory {
  return normalizeGameCategory(session.gameCategory ?? session.machineType ?? session.type ?? 'reel-slot');
}

function inferBrand(cruiseOrSession: AnyCruise | AnySession): CasinoBrand {
  const text = String(cruiseOrSession.brand ?? cruiseOrSession.cruiseLine ?? cruiseOrSession.line ?? cruiseOrSession.program ?? '').toLowerCase();
  if (text.includes('celebrity') || text.includes('blue')) return 'celebrity';
  if (text.includes('carnival')) return 'carnival';
  if (text.includes('royal') || text.includes('club')) return 'royal';
  return 'royal';
}

export function estimateSessionCoinIn(session: AnySession): { coinIn: number; cashCoinIn: number; freeplayCoinIn: number; warnings: string[] } {
  const warnings: string[] = [];
  const freeplayCoinIn = n(session.freeplayCoinIn ?? session.freePlayCoinIn ?? 0);
  const directCashCoinIn = n(session.cashCoinIn ?? 0);
  const directCoinIn = n(session.coinIn ?? 0);
  const points = n(session.pointsEarned ?? session.points ?? 0);

  if (directCashCoinIn > 0 || directCoinIn > 0) {
    const cashCoinIn = directCashCoinIn > 0 ? directCashCoinIn : Math.max(0, directCoinIn - freeplayCoinIn);
    return {
      coinIn: directCoinIn > 0 ? directCoinIn : cashCoinIn + freeplayCoinIn,
      cashCoinIn,
      freeplayCoinIn,
      warnings,
    };
  }

  if (points > 0) {
    const estimate = estimateCoinInForPoints({
      targetPoints: points,
      brand: inferBrand(session),
      gameCategory: normalizeSessionGameCategory(session),
      mode: session.pointsMode ?? session.mode,
    });
    warnings.push(...estimate.warnings);
    return {
      coinIn: estimate.coinIn ?? 0,
      cashCoinIn: estimate.coinIn ?? 0,
      freeplayCoinIn,
      warnings,
    };
  }

  return { coinIn: 0, cashCoinIn: 0, freeplayCoinIn, warnings };
}

function cruiseIdOf(cruise: AnyCruise): string {
  return String(cruise.id ?? `${cruise.shipName ?? 'unknown'}-${cruise.sailDate ?? cruise.startDate ?? 'unknown'}`);
}

function cruisePoints(cruise: AnyCruise): number {
  return n(cruise.pointsEarned ?? cruise.casinoPoints ?? cruise.earnedPoints ?? cruise.clubRoyalePoints ?? cruise.points ?? 0);
}

function cruiseWinLoss(cruise: AnyCruise): number {
  return n(cruise.winningsBroughtHome ?? cruise.winnings ?? cruise.netResult ?? cruise.totalWinnings ?? cruise.cashResult ?? cruise.casinoWinLoss ?? 0);
}

function cruiseCoinIn(cruise: AnyCruise, points: number): number {
  const direct = n(cruise.cashCoinIn ?? cruise.coinIn ?? cruise.totalCoinIn ?? 0);
  if (direct > 0) return direct;
  return estimateCoinInForPoints({
    targetPoints: points,
    brand: inferBrand(cruise),
    gameCategory: 'reel-slot',
  }).coinIn ?? 0;
}

function sessionSourceOf(session: AnySession): 'individual' | 'extrapolated' | 'tracked' | 'unknown' {
  const source = String(session.sessionSource ?? session.source ?? '').toLowerCase();
  if (source.includes('extrap') || source.includes('historical') || source.includes('generated')) return 'extrapolated';
  if (source.includes('individual') || source.includes('manual') || source.includes('import')) return 'individual';
  return session.cruiseId ? 'tracked' : 'unknown';
}

const emptyTotals = (): CasinoTabFlowTotals => ({
  points: 0,
  winLoss: 0,
  coinIn: 0,
  cashCoinIn: 0,
  freeplayCoinIn: 0,
  sessions: 0,
  individualSessions: 0,
  extrapolatedSessions: 0,
  trackedSessions: 0,
  derivedSessions: 0,
  cruises: 0,
  actualCruiseRows: 0,
  mixedCruiseRows: 0,
  estimatedCruiseRows: 0,
  hours: 0,
  retailValue: 0,
  amountPaid: 0,
  totalEconomicValue: 0,
});

function addRecordToTotals(totals: CasinoTabFlowTotals, record: CasinoTabFlowRecord): void {
  totals.points += record.points;
  totals.winLoss += record.winLoss;
  totals.coinIn += record.coinIn;
  totals.cashCoinIn += record.cashCoinIn;
  totals.freeplayCoinIn += record.freeplayCoinIn;
  totals.sessions += record.sessionCount;
  totals.individualSessions += record.individualSessionCount;
  totals.extrapolatedSessions += record.extrapolatedSessionCount;
  totals.trackedSessions += record.individualSessionCount + record.extrapolatedSessionCount;
  totals.derivedSessions += Math.max(0, record.sessionCount - record.individualSessionCount - record.extrapolatedSessionCount);
  totals.cruises += record.shipName === 'Unlinked Session' ? 0 : 1;
  totals.hours += record.hours;
  totals.retailValue += record.retailValue;
  totals.amountPaid += record.amountPaid;
  totals.totalEconomicValue += record.totalEconomicValue;
  if (record.calculationConfidence === 'actual') totals.actualCruiseRows += 1;
  else if (record.calculationConfidence === 'mixed') totals.mixedCruiseRows += 1;
  else if (record.calculationConfidence === 'estimated') totals.estimatedCruiseRows += 1;
}

export function buildCasinoTabDataFlow(input: {
  cruises?: AnyCruise[];
  sessions?: AnySession[];
  economicsRows?: AnyCruise[];
  generatedAt?: string;
}): CasinoTabDataFlow {
  const cruises = input.cruises ?? [];
  const sessions = input.sessions ?? [];
  const economicsRows = input.economicsRows ?? [];
  const rowsById = new Map(economicsRows.map((row) => [String(row.cruiseId ?? row.id), row]));
  const sessionsByCruise = new Map<string, AnySession[]>();
  const unlinkedSessions: AnySession[] = [];

  sessions.forEach((session) => {
    const cruiseId = String(session.cruiseId ?? '');
    if (!cruiseId) {
      unlinkedSessions.push(session);
      return;
    }
    const existing = sessionsByCruise.get(cruiseId) ?? [];
    existing.push(session);
    sessionsByCruise.set(cruiseId, existing);
  });

  const warnings: string[] = [];
  const records: CasinoTabFlowRecord[] = cruises.map((cruise) => {
    const id = cruiseIdOf(cruise);
    const row = rowsById.get(id);
    const linkedSessions = sessionsByCruise.get(id) ?? [];
    const linkedSessionCoinIn = linkedSessions.reduce((sum, s) => sum + estimateSessionCoinIn(s).coinIn, 0);
    const linkedSessionPoints = linkedSessions.reduce((sum, s) => sum + n(s.pointsEarned ?? s.points), 0);
    const linkedSessionWinLoss = linkedSessions.reduce((sum, s) => sum + n(s.winLoss), 0);
    const linkedSessionHours = linkedSessions.reduce((sum, s) => sum + Math.max(0, n(s.durationMinutes)) / 60, 0);
    const individualSessionCount = linkedSessions.filter((s) => sessionSourceOf(s) === 'individual' || sessionSourceOf(s) === 'tracked').length;
    const extrapolatedSessionCount = linkedSessions.filter((s) => sessionSourceOf(s) === 'extrapolated').length;

    const rowPoints = n(row?.points ?? row?.totalPoints);
    const basePoints = rowPoints || cruisePoints(cruise) || linkedSessionPoints;
    const winLoss = n(row?.cashResult ?? row?.winningsHome ?? row?.winLoss) || cruiseWinLoss(cruise) || linkedSessionWinLoss;
    const coinIn = n(row?.coinIn ?? row?.totalCoinIn) || cruiseCoinIn(cruise, basePoints) || linkedSessionCoinIn;
    const cashCoinIn = n(cruise.cashCoinIn) || coinIn;
    const freeplayCoinIn = n(cruise.freeplayCoinIn) + linkedSessions.reduce((sum, s) => sum + estimateSessionCoinIn(s).freeplayCoinIn, 0);
    const hasCruiseTotals = basePoints > 0 || winLoss !== 0 || n(row?.totalEconomic ?? row?.totalEconomicValue) > 0;
    const derivedCruiseSessionCount = linkedSessions.length > 0
      ? linkedSessions.length
      : Math.max(0, n(row?.sessionCount ?? cruise.sessionCount ?? 0), basePoints > 0 || winLoss !== 0 ? 1 : 0);
    const sourceMode: CasinoTabSourceMode = hasCruiseTotals && linkedSessions.length > 0 ? 'mixed' : hasCruiseTotals ? 'cruise-verified' : linkedSessions.length > 0 ? 'session-tracked' : 'empty';
    const calculationConfidence = String(row?.calculationConfidence ?? cruise.calculationConfidence ?? (sourceMode === 'cruise-verified' ? 'actual' : sourceMode === 'mixed' ? 'mixed' : sourceMode === 'session-tracked' ? 'estimated' : 'unknown')) as CasinoTabFlowRecord['calculationConfidence'];
    const recordWarnings: string[] = [];
    if (sourceMode === 'mixed') recordWarnings.push('Cruise-level totals win for rollups; linked sessions are retained for timing, PPH, and charts without double-counting points or win/loss.');
    if (basePoints <= 0) recordWarnings.push('Missing casino points.');
    if (winLoss === 0) recordWarnings.push('Missing win/loss or recorded as break-even.');
    if (coinIn <= 0 && basePoints > 0) recordWarnings.push('Missing coin-in; points engine could not estimate this game type.');

    return {
      id,
      shipName: String(cruise.shipName ?? row?.ship ?? 'Unknown Ship'),
      sailDate: String(cruise.sailDate ?? cruise.startDate ?? row?.sailDate ?? ''),
      sourceMode,
      calculationConfidence,
      points: basePoints,
      winLoss,
      coinIn,
      cashCoinIn,
      freeplayCoinIn,
      sessionCount: derivedCruiseSessionCount,
      individualSessionCount,
      extrapolatedSessionCount,
      hours: n(row?.hoursPlayed ?? row?.hours ?? cruise.hoursPlayed) || linkedSessionHours,
      nights: n(cruise.nights ?? row?.nights ?? 0),
      retailValue: n(row?.retail ?? row?.retailValue ?? cruise.retailValue ?? cruise.totalRetailCost),
      amountPaid: n(row?.paid ?? row?.amountPaid ?? cruise.amountPaid ?? cruise.totalPrice ?? cruise.price),
      totalEconomicValue: n(row?.totalEconomic ?? row?.totalEconomicValue ?? cruise.totalEconomicValue),
      warnings: recordWarnings,
    };
  });

  const unlinkedSessionRecords: CasinoTabFlowRecord[] = unlinkedSessions.map((session) => {
    const coin = estimateSessionCoinIn(session);
    const source = sessionSourceOf(session);
    return {
      id: String(session.id ?? `unlinked-${session.date ?? Date.now()}`),
      shipName: 'Unlinked Session',
      sailDate: String(session.date ?? ''),
      sourceMode: 'session-tracked',
      calculationConfidence: source === 'extrapolated' ? 'estimated' : 'actual',
      points: n(session.pointsEarned ?? session.points),
      winLoss: n(session.winLoss),
      coinIn: coin.coinIn,
      cashCoinIn: coin.cashCoinIn,
      freeplayCoinIn: coin.freeplayCoinIn,
      sessionCount: 1,
      individualSessionCount: source === 'extrapolated' ? 0 : 1,
      extrapolatedSessionCount: source === 'extrapolated' ? 1 : 0,
      hours: Math.max(0, n(session.durationMinutes)) / 60,
      nights: 0,
      retailValue: 0,
      amountPaid: n(session.buyIn),
      totalEconomicValue: n(session.winLoss),
      warnings: ['Session is not linked to a completed cruise; included in Sessions/Calcs totals and excluded from cruise-count analytics.'],
    };
  });

  const totals = emptyTotals();
  [...records, ...unlinkedSessionRecords].forEach((record) => addRecordToTotals(totals, record));

  if (unlinkedSessionRecords.length > 0) warnings.push(`${unlinkedSessionRecords.length} unlinked session(s) are included in session/calculation totals but not counted as completed cruises.`);
  const sourceMode: CasinoTabSourceMode = records.some((r) => r.sourceMode === 'mixed') ? 'mixed' : records.some((r) => r.sourceMode === 'cruise-verified') ? 'cruise-verified' : sessions.length > 0 ? 'session-tracked' : 'empty';

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceMode,
    totals,
    records,
    unlinkedSessionRecords,
    warnings,
    tabReadiness: {
      intelligence: records.length > 0 || sessions.length > 0,
      charts: totals.points > 0 || totals.winLoss !== 0 || totals.totalEconomicValue > 0,
      session: sessions.length > 0 || records.some((r) => r.sessionCount > 0),
      calcs: totals.points > 0 || totals.coinIn > 0 || totals.winLoss !== 0,
    },
    tabTotals: {
      intelligence: totals,
      charts: totals,
      session: totals,
      calcs: totals,
    },
  };
}
