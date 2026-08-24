import type { BookedCruise } from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

export type MetricSource = 'actual' | 'provider_reported' | 'user_entered' | 'estimated' | 'missing';
export type SourcedMetric = { value: number | null; source: MetricSource; explanation: string };

export interface CurrentTripCompPace {
  cruiseId: string;
  ship: string;
  program: string;
  points: SourcedMetric;
  coinIn: SourcedMetric;
  theoreticalLoss: SourcedMetric;
  averageDailyTheoretical: SourcedMetric;
  recordedComps: SourcedMetric;
  expectedCompLow: SourcedMetric;
  expectedCompHigh: SourcedMetric;
  observedCompPacePercent: SourcedMetric;
  playDays: number;
  warnings: string[];
}

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function directSource(cruise: BookedCruise): MetricSource {
  if (cruise.sourceAuthority === 'provider' || cruise.sourceAuthority === 'public_document') return 'provider_reported';
  if (cruise.sourceAuthority === 'user_entered') return 'user_entered';
  return cruise.calculationConfidence === 'actual' ? 'actual' : 'user_entered';
}

export function casinoProgramForCruise(cruise: BookedCruise): 'club_royale' | 'blue_chip' | 'players_club' | 'silversea' | 'unknown' {
  const value = `${cruise.brand ?? ''} ${cruise.casinoProgram ?? ''} ${cruise.cruiseSource ?? ''} ${cruise.shipName ?? ''}`.toLowerCase();
  if (/(celebrity|blue\s*chip)/.test(value)) return 'blue_chip';
  if (/(carnival|players\s*club)/.test(value)) return 'players_club';
  if (/(silversea|venetian)/.test(value)) return 'silversea';
  if (/(royal|club\s*royale|of the seas)/.test(value)) return 'club_royale';
  return 'unknown';
}

export function buildCurrentTripCompPace(cruise: BookedCruise, sessions: CasinoSession[], now = new Date()): CurrentTripCompPace {
  const program = casinoProgramForCruise(cruise);
  const relevant = sessions.filter((session) => session.cruiseId === cruise.id);
  const recordedPoints = finite(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints);
  const sessionPoints = relevant.reduce((sum, row) => sum + (finite(row.pointsEarned) ?? 0), 0);
  const pointsValue = recordedPoints ?? (sessionPoints > 0 ? sessionPoints : null);
  const points: SourcedMetric = pointsValue == null
    ? { value: null, source: 'missing', explanation: 'No points have been recorded for this cruise.' }
    : { value: pointsValue, source: recordedPoints == null ? 'actual' : directSource(cruise), explanation: recordedPoints == null ? 'Total from saved casino sessions.' : 'Saved cruise closeout or provider value.' };

  const recordedCoinIn = finite(cruise.coinIn);
  const sessionCoinIn = relevant.reduce((sum, row) => sum + (finite((row as CasinoSession & { coinIn?: number }).coinIn) ?? 0), 0);
  let coinIn: SourcedMetric;
  if (recordedCoinIn != null) coinIn = { value: recordedCoinIn, source: directSource(cruise), explanation: 'Recorded directly on the cruise.' };
  else if (sessionCoinIn > 0) coinIn = { value: sessionCoinIn, source: 'actual', explanation: 'Total from saved session coin-in.' };
  else if (program === 'club_royale' && pointsValue != null) coinIn = { value: pointsValue * 5, source: 'estimated', explanation: 'Club Royale-only estimate at $5 coin-in per point.' };
  else coinIn = { value: null, source: 'missing', explanation: `${program === 'unknown' ? 'Casino program' : program.replaceAll('_', ' ')} points are not converted with the Club Royale rate.` };

  const recordedTheo = finite(cruise.theoreticalLoss);
  const houseEdge = finite(cruise.houseEdge);
  const theoreticalLoss: SourcedMetric = recordedTheo != null
    ? { value: recordedTheo, source: directSource(cruise), explanation: 'Recorded theoretical loss.' }
    : coinIn.value != null
      ? { value: coinIn.value * (houseEdge ?? 0.08), source: 'estimated', explanation: `Coin-in × ${Math.round((houseEdge ?? 0.08) * 100)}% hold assumption.` }
      : { value: null, source: 'missing', explanation: 'Requires recorded theoretical loss or usable coin-in.' };

  const uniqueSessionDays = new Set(relevant.map((row) => row.date).filter(Boolean)).size;
  const sail = new Date(`${cruise.sailDate}T12:00:00`);
  const elapsed = Number.isFinite(sail.getTime()) ? Math.max(1, Math.floor((now.getTime() - sail.getTime()) / 86400000) + 1) : 1;
  const playDays = uniqueSessionDays || Math.min(Math.max(1, cruise.casinoOpenDays ?? cruise.nights ?? 1), elapsed);
  const averageDailyTheoretical: SourcedMetric = theoreticalLoss.value == null
    ? { value: null, source: 'missing', explanation: 'ADT cannot be calculated until theoretical loss is available.' }
    : { value: theoreticalLoss.value / playDays, source: theoreticalLoss.source === 'estimated' || uniqueSessionDays === 0 ? 'estimated' : theoreticalLoss.source, explanation: `Theoretical loss divided by ${playDays} tracked/elapsed casino day${playDays === 1 ? '' : 's'}.` };

  const sessionComps = relevant.reduce((sum, row) => sum + (finite(row.compsReceived) ?? 0) + (finite(row.freePlayUsed) ?? 0), 0);
  const cruiseComps = finite((cruise as BookedCruise & { hostCompsReceived?: number }).hostCompsReceived) ?? 0;
  const recordedCompValue = sessionComps + cruiseComps;
  const recordedComps: SourcedMetric = recordedCompValue > 0 ? { value: recordedCompValue, source: 'actual', explanation: 'Saved session free play/comps plus recorded host comps.' } : { value: null, source: 'missing', explanation: 'No current-trip comps have been recorded.' };
  const band = program === 'players_club' ? [0.15, 0.35] : program === 'unknown' || program === 'silversea' ? [0.15, 0.3] : [0.2, 0.4];
  const expectedCompLow: SourcedMetric = theoreticalLoss.value == null ? { value: null, source: 'missing', explanation: 'Requires theoretical loss.' } : { value: theoreticalLoss.value * band[0], source: 'estimated', explanation: `Planning range only: ${Math.round(band[0] * 100)}% of theo.` };
  const expectedCompHigh: SourcedMetric = theoreticalLoss.value == null ? { value: null, source: 'missing', explanation: 'Requires theoretical loss.' } : { value: theoreticalLoss.value * band[1], source: 'estimated', explanation: `Planning range only: ${Math.round(band[1] * 100)}% of theo.` };
  const observedCompPacePercent: SourcedMetric = recordedComps.value == null || theoreticalLoss.value == null || theoreticalLoss.value <= 0
    ? { value: null, source: 'missing', explanation: 'Requires both recorded comps and theoretical loss.' }
    : { value: (recordedComps.value / theoreticalLoss.value) * 100, source: theoreticalLoss.source === 'estimated' ? 'estimated' : 'actual', explanation: 'Recorded comps divided by theoretical loss; not a promise of future comps.' };

  return {
    cruiseId: cruise.id, ship: cruise.shipName, program, points, coinIn, theoreticalLoss, averageDailyTheoretical,
    recordedComps, expectedCompLow, expectedCompHigh, observedCompPacePercent, playDays,
    warnings: ['Comp ranges are planning estimates, never entitlements or guarantees.', 'Coin-in is wagering volume, not spend or loss.', 'Celebrity, Carnival, and Silversea points are never converted using the Club Royale $5-per-point rate.'],
  };
}
