import type { LiveCasinoStateRecord } from './types';

export interface MeaningfulStateChange {
  meaningful: boolean;
  reasons: string[];
}

export function detectMeaningfulLiveStateChange(
  previous: LiveCasinoStateRecord | null,
  next: LiveCasinoStateRecord,
): MeaningfulStateChange {
  if (!previous) return { meaningful: true, reasons: ['No prior live state exists.'] };
  if (previous.ownerProfileId !== next.ownerProfileId || previous.cruiseId !== next.cruiseId) {
    return { meaningful: true, reasons: ['Profile or cruise identity changed.'] };
  }
  const reasons: string[] = [];
  if (Math.abs(next.currentPoints - previous.currentPoints) >= 25) reasons.push('Points changed by at least 25.');
  if (Math.abs(next.currentResult - previous.currentResult) >= 25) reasons.push('Casino result changed by at least $25.');
  if (next.currentSessionId !== previous.currentSessionId) reasons.push('Active session changed.');
  if (next.casinoDay !== previous.casinoDay) reasons.push('Casino day changed.');
  if (next.remainingCasinoHours !== previous.remainingCasinoHours) reasons.push('Remaining casino hours changed.');
  if (next.remainingBankroll !== previous.remainingBankroll) reasons.push('Remaining bankroll changed.');
  if (next.fatigueRating !== previous.fatigueRating) reasons.push('Fatigue rating changed.');
  if (next.currentDailyLoss >= next.hardDailyLossLimit && previous.currentDailyLoss < previous.hardDailyLossLimit) reasons.push('Daily hard-loss threshold was reached.');
  if (next.status !== previous.status) reasons.push('Live-state status changed.');
  return { meaningful: reasons.length > 0, reasons };
}
