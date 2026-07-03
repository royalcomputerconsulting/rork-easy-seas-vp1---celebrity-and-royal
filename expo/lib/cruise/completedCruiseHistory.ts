import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { calculatePointsFromCoinIn, estimateCoinInForPoints, normalizeGameCategory, type GameCategory } from '@/lib/casino/pointsEarning';

export type CompletedCruiseDataConfidence = 'verified' | 'partially-verified' | 'manual' | 'estimated' | 'unknown';
export type CompletedCruiseSessionKind = 'individual' | 'extrapolated' | 'cruise-closeout' | 'mixed' | 'unknown';

export type CompletedCruiseCasinoValueRecord = {
  id: string;
  cruiseId?: string;
  reservationNumber?: string;
  shipName: string;
  sailingDate: string;
  endDate?: string;
  nights?: number;
  itinerary?: string;
  departurePort?: string;
  cabinNumber?: string;
  cabinCategory?: string;
  guests?: string[];
  brand: 'royal' | 'celebrity' | 'carnival' | 'unknown';
  casinoProgram: 'club-royale' | 'blue-chip' | 'players-club' | 'unknown';
  officialTierAtSailing: 'choice' | 'prime' | 'signature' | 'masters' | 'zenith' | 'unknown';
  pointsEarned?: number;
  pointsSource: 'casino-session' | 'win-loss-statement' | 'manual' | 'imported' | 'estimated' | 'unknown';
  sessionKind: CompletedCruiseSessionKind;
  individualSessionCount: number;
  extrapolatedSessionCount: number;
  casinoWinLoss?: number;
  casinoWinLossSource: 'win-loss-statement' | 'session-log' | 'manual' | 'imported' | 'unknown';
  cashIn?: number;
  cashOut?: number;
  cashCoinIn?: number;
  freeplayIn?: number;
  freeplayCoinIn?: number;
  jackpots?: number;
  handPays?: number;
  taxesWithheld?: number;
  offerCodeUsed?: string;
  offerNameUsed?: string;
  certificateCodeEarned?: string;
  certificateLevelEarned?: string;
  certificateBankEarned?: 'A' | 'C' | 'D' | 'unknown';
  tradeInValue?: number;
  freeplayValue?: number;
  obcValue?: number;
  signatureObcValue?: number;
  nextCruiseValue?: number;
  fccApplied?: number;
  annualCruiseValue?: number;
  crownAnchorMilestoneValue?: number;
  cruiseFareRetailValue?: number;
  casinoCompValue?: number;
  crownAnchorValue?: number;
  totalGrossValue?: number;
  totalValueReceived?: number;
  trueNetValue?: number;
  taxesAndFees?: number;
  cashPaid?: number;
  onboardCashSpend?: number;
  internetValue?: number;
  specialtyDiningValue?: number;
  spaSalonThermalFitnessValue?: number;
  sourceDocumentIds?: string[];
  sourceLabels?: string[];
  dataConfidence: CompletedCruiseDataConfidence;
  warnings: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function text(...values: unknown[]): string {
  for (const value of values) {
    const result = String(value ?? '').trim();
    if (result) return result;
  }
  return '';
}

function num(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function lower(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

export function isExtrapolatedCasinoSession(session: any): boolean {
  const source = lower(session?.sessionSource ?? session?.pointsSource ?? session?.source ?? session?.calculationConfidence ?? session?.notes);
  return source.includes('auto-calculated')
    || source.includes('derived')
    || source.includes('extrapolated')
    || source.includes('estimated')
    || source.includes('historical');
}

export function getSessionPoints(session: any): number {
  const explicit = num(session?.pointsEarned, session?.casinoPoints, session?.points, session?.tierCredits);
  if (explicit !== undefined) return explicit;
  const calculated = calculatePointsFromCoinIn({
    coinIn: num(session?.coinIn, session?.totalCoinIn),
    cashCoinIn: num(session?.cashCoinIn),
    freeplayCoinIn: num(session?.freeplayCoinIn),
    brand: session?.brand,
    program: session?.program ?? session?.casinoProgram,
    gameCategory: normalizeGameCategory(session?.gameCategory ?? session?.machineType) as GameCategory,
  });
  return calculated.points ?? 0;
}

export function getSessionWinLoss(session: any): number {
  return num(session?.winLoss, session?.netWinLoss, session?.casinoWinLoss, session?.cashResult) ?? 0;
}

export function getSessionCoinIn(session: any): number {
  const explicit = num(session?.cashCoinIn, session?.coinIn, session?.totalCoinIn);
  if (explicit !== undefined) return explicit;
  return estimateCoinInForPoints({ targetPoints: getSessionPoints(session), brand: session?.brand ?? 'royal', gameCategory: session?.gameCategory ?? 'reel-slot' }).coinIn ?? 0;
}

function normalizeBrand(value: unknown): CompletedCruiseCasinoValueRecord['brand'] {
  const v = lower(value);
  if (v.includes('celebrity')) return 'celebrity';
  if (v.includes('carnival')) return 'carnival';
  if (v.includes('royal')) return 'royal';
  return 'royal';
}

function normalizeProgram(value: unknown, brand: CompletedCruiseCasinoValueRecord['brand']): CompletedCruiseCasinoValueRecord['casinoProgram'] {
  const v = lower(value);
  if (v.includes('blue')) return 'blue-chip';
  if (v.includes('player')) return 'players-club';
  if (v.includes('club') || v.includes('royale')) return 'club-royale';
  if (brand === 'celebrity') return 'blue-chip';
  if (brand === 'carnival') return 'players-club';
  if (brand === 'royal') return 'club-royale';
  return 'unknown';
}

function normalizeTier(value: unknown): CompletedCruiseCasinoValueRecord['officialTierAtSailing'] {
  const v = lower(value);
  if (v.includes('zenith')) return 'zenith';
  if (v.includes('masters')) return 'masters';
  if (v.includes('signature')) return 'signature';
  if (v.includes('prime')) return 'prime';
  if (v.includes('choice')) return 'choice';
  return 'unknown';
}

function dateText(cruise: any): string {
  return text(cruise?.sailingDate, cruise?.sailDate, cruise?.startDate, cruise?.date, cruise?.departureDate, 'unknown-date');
}

function isCompletedCruise(cruise: any, today = new Date().toISOString().slice(0, 10)): boolean {
  const state = lower(cruise?.completionState ?? cruise?.status ?? cruise?.bookingStatus);
  if (state.includes('completed') || state.includes('sailed')) return true;
  const end = text(cruise?.endDate, cruise?.returnDate);
  return Boolean(end && end < today);
}

function cruiseKey(cruise: any): string {
  return text(cruise?.id, `${text(cruise?.shipName, cruise?.ship)}-${dateText(cruise)}`);
}

export function buildCompletedCruiseCasinoValueRecords(input: {
  completedCruises?: any[];
  bookedCruises?: any[];
  sessions?: any[];
  includePastBooked?: boolean;
  today?: string;
}): CompletedCruiseCasinoValueRecord[] {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const completed = Array.isArray(input.completedCruises) ? input.completedCruises : [];
  const bookedPast = (Array.isArray(input.bookedCruises) ? input.bookedCruises : []).filter((cruise) => input.includePastBooked && isCompletedCruise(cruise, today));
  const cruises = [...completed, ...bookedPast];
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const now = new Date().toISOString();

  const records = cruises.map((cruise): CompletedCruiseCasinoValueRecord => {
    const id = cruiseKey(cruise);
    const cruiseSessions = sessions.filter((session) => text(session?.cruiseId) && text(session?.cruiseId) === text(cruise?.id));
    const individualSessions = cruiseSessions.filter((session) => !isExtrapolatedCasinoSession(session));
    const extrapolatedSessions = cruiseSessions.filter(isExtrapolatedCasinoSession);
    const useSessionsForTotals = individualSessions.length > 0 && getBookedCruiseCasinoPoints(cruise) <= 0;
    const sessionSourcePool = useSessionsForTotals ? individualSessions : [];
    const cruisePoints = getBookedCruiseCasinoPoints(cruise);
    const sessionPoints = sessionSourcePool.reduce((sum, session) => sum + getSessionPoints(session), 0);
    const pointsEarned = cruisePoints || sessionPoints || undefined;
    const cruiseWinLoss = num(cruise?.casinoWinLoss, cruise?.winLoss, cruise?.netWinLoss, cruise?.winningsBroughtHome, cruise?.winnings, cruise?.totalWinnings, cruise?.netResult, cruise?.cashResult);
    const sessionWinLoss = sessionSourcePool.length ? sessionSourcePool.reduce((sum, session) => sum + getSessionWinLoss(session), 0) : undefined;
    const casinoWinLoss = cruiseWinLoss ?? sessionWinLoss;
    const brand = normalizeBrand(cruise?.brand ?? cruise?.cruiseSource ?? cruise?.source);
    const warnings: string[] = [];
    if (!pointsEarned) warnings.push('Missing casino points for this completed cruise.');
    if (casinoWinLoss === undefined) warnings.push('Missing casino win/loss for this completed cruise.');
    if (!num(cruise?.casinoCompValue, cruise?.compValue, cruise?.offerValue, cruise?.instantCertificateValue, cruise?.totalEconomicValue, cruise?.cruiseValueCaptured)) {
      warnings.push('Missing cruise/casino value ledger for this completed cruise.');
    }
    if (individualSessions.length > 0 && cruisePoints > 0) {
      warnings.push('Individual sessions are preserved for session analytics, but cruise closeout points are used for non-duplicated roll-up totals.');
    }
    if (extrapolatedSessions.length > 0 && cruisePoints > 0) {
      warnings.push('Extrapolated sessions are linked for day/session analytics and not double-counted against cruise closeout totals.');
    }

    let sessionKind: CompletedCruiseSessionKind = 'cruise-closeout';
    if (individualSessions.length && extrapolatedSessions.length) sessionKind = 'mixed';
    else if (individualSessions.length) sessionKind = 'individual';
    else if (extrapolatedSessions.length) sessionKind = 'extrapolated';
    else if (!pointsEarned && casinoWinLoss === undefined) sessionKind = 'unknown';

    const confidence: CompletedCruiseDataConfidence = cruisePoints && casinoWinLoss !== undefined
      ? 'verified'
      : pointsEarned || casinoWinLoss !== undefined
        ? (sessionKind === 'extrapolated' ? 'estimated' : 'partially-verified')
        : 'unknown';

    return {
      id,
      cruiseId: text(cruise?.id) || undefined,
      reservationNumber: text(cruise?.reservationNumber, cruise?.bookingId, cruise?.bwoNumber) || undefined,
      shipName: text(cruise?.shipName, cruise?.ship, 'Unknown Ship'),
      sailingDate: dateText(cruise),
      endDate: text(cruise?.endDate, cruise?.returnDate) || undefined,
      nights: num(cruise?.nights),
      itinerary: text(cruise?.itineraryName, cruise?.itinerary, cruise?.destination) || undefined,
      departurePort: text(cruise?.departurePort) || undefined,
      cabinNumber: text(cruise?.cabinNumber, cruise?.stateroomNumber) || undefined,
      cabinCategory: text(cruise?.cabinCategory, cruise?.stateroomType, cruise?.cabinType, cruise?.category) || undefined,
      guests: Array.isArray(cruise?.guestNames) ? cruise.guestNames : undefined,
      brand,
      casinoProgram: normalizeProgram(cruise?.casinoProgram, brand),
      officialTierAtSailing: normalizeTier(cruise?.casinoTierAtSailing ?? cruise?.officialTierAtSailing ?? cruise?.casinoLevel),
      pointsEarned,
      pointsSource: cruisePoints ? 'imported' : sessionPoints ? (sessionKind === 'extrapolated' ? 'estimated' : 'casino-session') : 'unknown',
      sessionKind,
      individualSessionCount: individualSessions.length,
      extrapolatedSessionCount: extrapolatedSessions.length,
      casinoWinLoss,
      casinoWinLossSource: cruiseWinLoss !== undefined ? 'win-loss-statement' : sessionWinLoss !== undefined ? 'session-log' : 'unknown',
      cashIn: num(cruise?.cashIn, cruise?.actualSpend),
      cashOut: num(cruise?.cashOut),
      cashCoinIn: num(cruise?.cashCoinIn, cruise?.coinIn) ?? (pointsEarned ? estimateCoinInForPoints({ targetPoints: pointsEarned, brand, gameCategory: 'reel-slot' }).coinIn ?? undefined : undefined),
      freeplayIn: num(cruise?.freeplayIn, cruise?.freePlayUsed, cruise?.freePlay),
      freeplayCoinIn: num(cruise?.freeplayCoinIn),
      jackpots: num(cruise?.jackpots, cruise?.jackpotAmount),
      handPays: num(cruise?.handPays),
      taxesWithheld: num(cruise?.taxesWithheld),
      offerCodeUsed: text(cruise?.offerCode, cruise?.packageCode) || undefined,
      offerNameUsed: text(cruise?.offerName) || undefined,
      certificateCodeEarned: text(cruise?.instantCertificateOfferCode, cruise?.certificateCodeEarned) || undefined,
      certificateLevelEarned: text(cruise?.certificateLevelEarned) || undefined,
      certificateBankEarned: lower(cruise?.certificateBankEarned).includes('a') ? 'A' : lower(cruise?.certificateBankEarned).includes('c') ? 'C' : lower(cruise?.certificateBankEarned).includes('d') ? 'D' : 'unknown',
      tradeInValue: num(cruise?.tradeInValue),
      freeplayValue: num(cruise?.freePlay, cruise?.freeplayAmount),
      obcValue: num(cruise?.OBC, cruise?.obcAmount, cruise?.freeOBC),
      signatureObcValue: num(cruise?.signatureObcValue),
      nextCruiseValue: num(cruise?.nextCruiseCertificateValue),
      fccApplied: num(cruise?.fccApplied),
      annualCruiseValue: num(cruise?.annualCruiseValue),
      crownAnchorMilestoneValue: num(cruise?.crownAnchorMilestoneValue),
      cruiseFareRetailValue: num(cruise?.retailValue, cruise?.totalRetailCost, cruise?.originalPrice),
      casinoCompValue: num(cruise?.casinoCompValue, cruise?.compValue, cruise?.instantCertificateValue, cruise?.totalCasinoDiscount),
      crownAnchorValue: num(cruise?.crownAnchorValue, cruise?.crownAnchorMilestoneValue),
      totalGrossValue: num(cruise?.totalGrossValue, cruise?.totalEconomicValue, cruise?.totalValue),
      totalValueReceived: num(cruise?.totalValueReceived, cruise?.cruiseValueCaptured, cruise?.offerValue),
      trueNetValue: num(cruise?.trueNetValue, cruise?.netEffectivePaid),
      taxesAndFees: num(cruise?.taxesAndFees, cruise?.taxesFees, cruise?.taxesFeesEstimate, cruise?.taxes),
      cashPaid: num(cruise?.cashPaid, cruise?.amountPaid, cruise?.pricePaid),
      onboardCashSpend: num(cruise?.onboardCashSpend),
      internetValue: num(cruise?.internetValue, cruise?.voomValue),
      specialtyDiningValue: num(cruise?.specialtyDiningValue),
      spaSalonThermalFitnessValue: num(cruise?.spaSalonThermalFitnessValue, cruise?.spaValue),
      sourceDocumentIds: Array.isArray(cruise?.documents) ? cruise.documents : cruise?.financialRecordIds,
      sourceLabels: [text(cruise?.sourceLabel, cruise?.offerCode)].filter(Boolean),
      dataConfidence: confidence,
      warnings,
      notes: text(cruise?.notes) || undefined,
      createdAt: text(cruise?.createdAt, now),
      updatedAt: text(cruise?.updatedAt, now),
    };
  });

  const linkedCruiseIds = new Set(cruises.map((cruise) => text(cruise?.id)).filter(Boolean));
  const unlinkedSessions = sessions.filter((session) => !text(session?.cruiseId) || !linkedCruiseIds.has(text(session?.cruiseId)));
  unlinkedSessions.forEach((session, index) => {
    const extrapolated = isExtrapolatedCasinoSession(session);
    const pointsEarned = getSessionPoints(session) || undefined;
    const casinoWinLoss = num(session?.winLoss, session?.casinoWinLoss, session?.cashResult);
    if (!pointsEarned && casinoWinLoss === undefined) return;
    records.push({
      id: `session-${text(session?.id, index)}`,
      cruiseId: text(session?.cruiseId) || undefined,
      shipName: text(session?.shipName, session?.ship, 'Unlinked Session'),
      sailingDate: text(session?.date, session?.sessionDate, 'unknown-date'),
      brand: normalizeBrand(session?.brand),
      casinoProgram: normalizeProgram(session?.program ?? session?.casinoProgram, normalizeBrand(session?.brand)),
      officialTierAtSailing: normalizeTier(session?.officialTierAtSailing),
      pointsEarned,
      pointsSource: extrapolated ? 'estimated' : 'casino-session',
      sessionKind: extrapolated ? 'extrapolated' : 'individual',
      individualSessionCount: extrapolated ? 0 : 1,
      extrapolatedSessionCount: extrapolated ? 1 : 0,
      casinoWinLoss,
      casinoWinLossSource: casinoWinLoss !== undefined ? 'session-log' : 'unknown',
      cashIn: num(session?.cashIn, session?.buyIn),
      cashOut: num(session?.cashOut),
      cashCoinIn: num(session?.cashCoinIn, session?.coinIn) ?? (pointsEarned ? estimateCoinInForPoints({ targetPoints: pointsEarned, brand: session?.brand ?? 'royal', gameCategory: session?.gameCategory ?? 'reel-slot' }).coinIn ?? undefined : undefined),
      freeplayIn: num(session?.freeplayIn, session?.freePlayUsed),
      freeplayCoinIn: num(session?.freeplayCoinIn),
      jackpots: num(session?.jackpots, session?.jackpotAmount),
      handPays: num(session?.handPays),
      taxesWithheld: num(session?.taxesWithheld),
      dataConfidence: extrapolated ? 'estimated' : 'manual',
      warnings: [
        !text(session?.cruiseId) ? 'Session is not linked to a completed cruise.' : '',
        extrapolated ? 'Extrapolated session is included for analytics but marked as estimated.' : '',
      ].filter(Boolean),
      createdAt: text(session?.createdAt, now),
      updatedAt: text(session?.updatedAt, now),
    });
  });

  return records;
}

export function findCompletedCruiseDataGaps(records: CompletedCruiseCasinoValueRecord[]): {
  missingPoints: CompletedCruiseCasinoValueRecord[];
  missingWinLoss: CompletedCruiseCasinoValueRecord[];
  missingValue: CompletedCruiseCasinoValueRecord[];
  duplicateConflicts: string[];
} {
  const missingPoints = records.filter((record) => !record.pointsEarned);
  const missingWinLoss = records.filter((record) => record.casinoWinLoss === undefined);
  const missingValue = records.filter((record) => !record.casinoCompValue && !record.totalValueReceived && !record.totalGrossValue);
  const byShipDate = new Map<string, CompletedCruiseCasinoValueRecord[]>();
  records.forEach((record) => {
    const key = `${record.shipName.toLowerCase()}|${record.sailingDate}`;
    byShipDate.set(key, [...(byShipDate.get(key) ?? []), record]);
  });
  const duplicateConflicts: string[] = [];
  byShipDate.forEach((items, key) => {
    if (items.length < 2) return;
    const pointSet = new Set(items.map((item) => item.pointsEarned ?? null));
    const winLossSet = new Set(items.map((item) => item.casinoWinLoss ?? null));
    const valueSet = new Set(items.map((item) => item.totalValueReceived ?? item.casinoCompValue ?? null));
    if (pointSet.size > 1 || winLossSet.size > 1 || valueSet.size > 1) {
      duplicateConflicts.push(`Possible duplicate/conflict for ${key}.`);
    }
  });
  return { missingPoints, missingWinLoss, missingValue, duplicateConflicts };
}
