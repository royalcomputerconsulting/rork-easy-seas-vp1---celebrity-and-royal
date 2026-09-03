export type CasinoProgramId = 'club_royale' | 'blue_chip' | 'carnival_players_club' | 'other';

export interface CasinoProgramSeason {
  program: CasinoProgramId;
  startDate: string;
  endDateExclusive: string;
  resetMonth: number;
  resetDay: number;
  label: string;
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export function normalizeCasinoProgram(value: unknown): CasinoProgramId {
  const text = String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (text.includes('bluechip') || text.includes('celebrity')) return 'blue_chip';
  if (text.includes('clubroyale') || text.includes('royalcaribbean') || text === 'royal') return 'club_royale';
  if (text.includes('playersclub') || text.includes('carnival')) return 'carnival_players_club';
  return 'other';
}

export function inferCasinoProgram(record: Record<string, unknown>): CasinoProgramId {
  const explicit = normalizeCasinoProgram(record.casinoProgram ?? record.program ?? record.offerSource ?? record.cruiseSource ?? record.brand);
  if (explicit !== 'other') return explicit;
  const ship = String(record.shipName ?? record.ship ?? '').toLowerCase();
  if (/celebrity|edge|apex|ascent|equinox|reflection|silhouette|solstice|beyond|constellation|summit|millennium|infinity/.test(ship)) return 'blue_chip';
  if (/carnival|mardi gras|celebration|jubilee/.test(ship)) return 'carnival_players_club';
  return 'club_royale';
}

/**
 * Club Royale earns Apr 1-Mar 31. Celebrity Blue Chip earns Aug 1-Jul 31.
 * The end is exclusive so a sailing on reset day belongs to the new year.
 */
export function getCasinoProgramSeason(programInput: CasinoProgramId | string, asOf: Date | string = new Date()): CasinoProgramSeason {
  const program = normalizeCasinoProgram(programInput);
  const current = typeof asOf === 'string' ? new Date(`${asOf.slice(0, 10)}T12:00:00`) : asOf;
  const safe = Number.isNaN(current.getTime()) ? new Date() : current;
  const month = safe.getMonth() + 1;
  const day = safe.getDate();
  const year = safe.getFullYear();
  const resetMonth = program === 'blue_chip' ? 8 : 4;
  const resetDay = 1;
  const afterReset = month > resetMonth || (month === resetMonth && day >= resetDay);
  const startYear = afterReset ? year : year - 1;
  const startDate = dateKey(startYear, resetMonth, resetDay);
  const endDateExclusive = dateKey(startYear + 1, resetMonth, resetDay);
  const programLabel = program === 'blue_chip' ? 'Blue Chip Club' : program === 'club_royale' ? 'Club Royale' : program === 'carnival_players_club' ? 'Carnival Players Club' : 'Casino';
  return {
    program,
    startDate,
    endDateExclusive,
    resetMonth,
    resetDay,
    label: `${programLabel} ${startYear}-${String(startYear + 1).slice(-2)} earning year`,
  };
}

export function isDateInCasinoSeason(date: string | null | undefined, season: CasinoProgramSeason): boolean {
  const key = String(date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= season.startDate && key < season.endDateExclusive;
}

