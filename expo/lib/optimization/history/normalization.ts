import type {
  CasinoCruiseRecordLike,
  CasinoSessionRecordLike,
  ConfidenceBand,
  DataAuthority,
  FieldAuthority,
  OptimizationCasinoBrand,
  OptimizationCasinoProgram,
} from './types';

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const raw = value.trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const usMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function nonNegativeNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function normalizeBrand(value: unknown, shipName?: unknown): OptimizationCasinoBrand {
  const normalized = normalizeText(value);
  const ship = normalizeText(shipName);
  if (normalized.includes('celebrity') || ship.startsWith('celebrity ')) return 'celebrity';
  if (normalized.includes('carnival') || ship.startsWith('carnival ')) return 'carnival';
  if (normalized.includes('silversea') || ship.startsWith('silver ')) return 'silversea';
  if (normalized.includes('royal') || /of the seas$/.test(ship)) return 'royal';
  return 'unknown';
}

export function normalizeProgram(value: unknown, brand: OptimizationCasinoBrand): OptimizationCasinoProgram {
  const normalized = normalizeText(value).replace(/[_\s]+/g, '-');
  if (normalized.includes('club-royale') || normalized === 'clubroyale') return 'club-royale';
  if (normalized.includes('blue-chip') || normalized === 'bluechip') return 'blue-chip';
  if (normalized.includes('players-club') || normalized === 'playersclub') return 'players-club';
  if (normalized.includes('venetian')) return 'venetian-society';
  if (brand === 'royal') return 'club-royale';
  if (brand === 'celebrity') return 'blue-chip';
  if (brand === 'carnival') return 'players-club';
  if (brand === 'silversea') return 'venetian-society';
  return 'unknown';
}

export function authorityConfidence(authority: DataAuthority): { band: ConfidenceBand; score: number } {
  switch (authority) {
    case 'closeout-verified': return { band: 'high', score: 1 };
    case 'closeout-user-entered': return { band: 'high', score: 0.9 };
    case 'imported': return { band: 'medium', score: 0.78 };
    case 'session-rollup': return { band: 'medium', score: 0.72 };
    case 'calculated': return { band: 'medium', score: 0.64 };
    case 'estimated': return { band: 'low', score: 0.42 };
    case 'generated': return { band: 'low', score: 0.25 };
    case 'missing': return { band: 'missing', score: 0 };
  }
}

export function field<T>(
  value: T | null,
  source: string,
  authority: DataAuthority,
  freshness: string | null,
  warnings: string[] = [],
): FieldAuthority<T> {
  const confidence = authorityConfidence(authority);
  return {
    value,
    source,
    authority,
    confidence: confidence.band,
    confidenceScore: confidence.score,
    freshness,
    warnings,
  };
}

export function missingField<T>(label: string): FieldAuthority<T> {
  return field<T>(null, label, 'missing', null, [`${label} is missing.`]);
}

export function stableFingerprint(parts: unknown[]): string {
  const text = parts.map(part => normalizeText(part)).join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `opt-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function cruiseStrongKey(cruise: CasinoCruiseRecordLike): string {
  const reservation = normalizeText(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber);
  if (reservation) return `reservation:${reservation}`;
  return `sailing:${normalizeText(cruise.ownerProfileId)}|${normalizeText(cruise.shipName)}|${normalizeDate(cruise.sailDate) ?? ''}|${normalizeDate(cruise.returnDate) ?? ''}`;
}

export function sessionFingerprint(session: CasinoSessionRecordLike, ownerProfileId: string): string {
  return stableFingerprint([
    ownerProfileId,
    session.cruiseId,
    session.sailingDate,
    session.sessionDate ?? session.date,
    session.startTime,
    session.endTime,
    session.durationMinutes,
    session.machineId,
    session.machineName,
    session.pointsEarned,
    session.coinIn,
    session.winLoss,
    session.buyIn,
    session.cashOut,
  ]);
}

export function minutesFromTime(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 29 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function dateWithinCruise(date: string | null, sailDate: string | null, returnDate: string | null): boolean {
  if (!date || !sailDate || !returnDate) return false;
  return date >= sailDate && date <= returnDate;
}
