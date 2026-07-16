import type { CertificateFamily } from '../value/types';
import type { OptimizationCasinoBrand, OptimizationCasinoProgram } from '../history/types';
import type { LiveCasinoSessionObservation, LiveCasinoStateRecord, LiveCasinoStateStatus } from './types';
import { stableModelFingerprint } from '../models/statistics';

export interface CreateLiveCasinoStateInput {
  ownerProfileId: string;
  cruiseId: string;
  reservationId?: string | null;
  program: OptimizationCasinoProgram;
  brand: OptimizationCasinoBrand;
  certificateFamily: CertificateFamily;
  shipName?: string | null;
  cruiseNights?: number | null;
  casinoDay?: number;
  currentPoints: number;
  currentResult?: number | null;
  currentCoinIn?: number | null;
  currentCoinOut?: number | null;
  remainingCasinoHours?: number | null;
  remainingCasinoDays?: number | null;
  remainingBankroll?: number | null;
  dailyBankrollBudget: number;
  tripBankrollBudget?: number | null;
  currentDailyLoss?: number | null;
  currentTripLoss?: number | null;
  hardDailyLossLimit: number;
  hardTripLossLimit?: number | null;
  lockedProfitFloor?: number | null;
  sessionDurationMinutes?: number | null;
  sameDayPlayMinutes?: number | null;
  fatigueRating?: number | null;
  currentPointsPerHour?: number | null;
  baselinePointsPerHour?: number | null;
  currentLossPerPoint?: number | null;
  baselineLossPerPoint?: number | null;
  sourceFreshness?: string | null;
  asOf: string;
  sessions?: LiveCasinoSessionObservation[];
  currentSessionId?: string | null;
  fatigueSignalDismissed?: boolean;
  status?: LiveCasinoStateStatus;
  staleAfterMinutes?: number;
  createdAt?: string;
}

function finiteNonnegative(value: number | null | undefined, field: string, warnings: string[]): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    warnings.push(`${field} was not finite and was treated as missing.`);
    return null;
  }
  if (value < 0) {
    warnings.push(`${field} cannot be negative and was clamped to zero.`);
    return 0;
  }
  return value;
}

export function createLiveCasinoState(input: CreateLiveCasinoStateInput): LiveCasinoStateRecord {
  if (!input.ownerProfileId.trim()) throw new Error('ownerProfileId is required.');
  if (!input.cruiseId.trim()) throw new Error('cruiseId is required.');
  const warnings: string[] = [];
  const points = finiteNonnegative(input.currentPoints, 'currentPoints', warnings) ?? 0;
  const coinIn = finiteNonnegative(input.currentCoinIn, 'currentCoinIn', warnings);
  const coinOut = finiteNonnegative(input.currentCoinOut, 'currentCoinOut', warnings);
  const derivedResult = coinIn !== null && coinOut !== null ? coinOut - coinIn : null;
  const currentResult = Number.isFinite(input.currentResult ?? NaN)
    ? Number(input.currentResult)
    : derivedResult ?? 0;
  if (input.currentResult === null || input.currentResult === undefined) {
    warnings.push(derivedResult === null
      ? 'Current result was missing and defaulted to zero until coin-in and coin-out are both available.'
      : 'Current result was derived from current coin-out minus current coin-in.');
  }
  const dailyLoss = finiteNonnegative(input.currentDailyLoss ?? Math.max(0, -currentResult), 'currentDailyLoss', warnings) ?? 0;
  const tripLoss = finiteNonnegative(input.currentTripLoss ?? Math.max(0, -currentResult), 'currentTripLoss', warnings) ?? 0;
  const asOf = new Date(input.asOf).toISOString();
  const id = `live-casino-state:${stableModelFingerprint([input.ownerProfileId, input.cruiseId])}`;
  return {
    id,
    ownerProfileId: input.ownerProfileId,
    cruiseId: input.cruiseId,
    reservationId: input.reservationId ?? null,
    program: input.program,
    brand: input.brand,
    certificateFamily: input.certificateFamily,
    shipName: input.shipName ?? null,
    cruiseNights: finiteNonnegative(input.cruiseNights, 'cruiseNights', warnings),
    casinoDay: Math.max(1, Math.floor(input.casinoDay ?? 1)),
    currentPoints: points,
    currentResult,
    currentCoinIn: coinIn,
    currentCoinOut: coinOut,
    remainingCasinoHours: finiteNonnegative(input.remainingCasinoHours, 'remainingCasinoHours', warnings),
    remainingCasinoDays: finiteNonnegative(input.remainingCasinoDays, 'remainingCasinoDays', warnings),
    remainingBankroll: finiteNonnegative(input.remainingBankroll, 'remainingBankroll', warnings),
    dailyBankrollBudget: finiteNonnegative(input.dailyBankrollBudget, 'dailyBankrollBudget', warnings) ?? 0,
    tripBankrollBudget: finiteNonnegative(input.tripBankrollBudget, 'tripBankrollBudget', warnings),
    currentDailyLoss: dailyLoss,
    currentTripLoss: tripLoss,
    hardDailyLossLimit: finiteNonnegative(input.hardDailyLossLimit, 'hardDailyLossLimit', warnings) ?? 0,
    hardTripLossLimit: finiteNonnegative(input.hardTripLossLimit, 'hardTripLossLimit', warnings),
    lockedProfitFloor: input.lockedProfitFloor === null || input.lockedProfitFloor === undefined
      ? null : Number(input.lockedProfitFloor),
    sessionDurationMinutes: finiteNonnegative(input.sessionDurationMinutes, 'sessionDurationMinutes', warnings),
    sameDayPlayMinutes: finiteNonnegative(input.sameDayPlayMinutes, 'sameDayPlayMinutes', warnings),
    fatigueRating: input.fatigueRating === null || input.fatigueRating === undefined
      ? null : Math.max(0, Math.min(10, Number(input.fatigueRating))),
    currentPointsPerHour: finiteNonnegative(input.currentPointsPerHour, 'currentPointsPerHour', warnings),
    baselinePointsPerHour: finiteNonnegative(input.baselinePointsPerHour, 'baselinePointsPerHour', warnings),
    currentLossPerPoint: finiteNonnegative(input.currentLossPerPoint, 'currentLossPerPoint', warnings),
    baselineLossPerPoint: finiteNonnegative(input.baselineLossPerPoint, 'baselineLossPerPoint', warnings),
    sourceFreshness: input.sourceFreshness ?? asOf,
    asOf,
    currentSessionId: input.currentSessionId ?? null,
    sessions: [...(input.sessions ?? [])],
    fatigueSignalDismissed: Boolean(input.fatigueSignalDismissed),
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? asOf,
    updatedAt: asOf,
    staleAfterMinutes: Math.max(1, Math.floor(input.staleAfterMinutes ?? 30)),
    warnings,
  };
}

export function isLiveCasinoStateStale(state: LiveCasinoStateRecord, now: string): boolean {
  const ageMs = new Date(now).getTime() - new Date(state.updatedAt).getTime();
  return !Number.isFinite(ageMs) || ageMs > state.staleAfterMinutes * 60_000;
}
