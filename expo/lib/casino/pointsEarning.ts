export type CasinoBrand = 'royal' | 'celebrity' | 'carnival' | 'unknown';

export type GameCategory =
  | 'reel-slot'
  | 'video-poker'
  | 'table-game'
  | 'electronic-table-game'
  | 'other'
  | 'unknown';

export type PointsMode =
  | 'club-royale-points'
  | 'blue-chip-redeemable-points'
  | 'blue-chip-tier-points'
  | 'manual'
  | 'imported'
  | 'unknown';

export type PointEarningProfile = {
  id: string;
  brand: CasinoBrand;
  program: 'club-royale' | 'blue-chip' | 'players-club' | 'unknown';
  mode: PointsMode;
  gameCategory: GameCategory;
  coinInPerPoint?: number;
  wagerPerTierPoint?: number;
  theoreticalMultiplier?: number;
  tableGameFormula?: 'manual' | 'theoretical' | 'average-bet-time' | 'unknown';
  sourceLabel: string;
  warning?: string;
};

export const DEFAULT_POINT_EARNING_PROFILES: PointEarningProfile[] = [
  {
    id: 'royal-club-royale-reel-slot',
    brand: 'royal',
    program: 'club-royale',
    mode: 'club-royale-points',
    gameCategory: 'reel-slot',
    coinInPerPoint: 5,
    sourceLabel: 'Royal Caribbean Club Royale reel slots: $5 coin-in per point',
  },
  {
    id: 'royal-club-royale-video-poker',
    brand: 'royal',
    program: 'club-royale',
    mode: 'club-royale-points',
    gameCategory: 'video-poker',
    coinInPerPoint: 15,
    sourceLabel: 'Royal Caribbean Club Royale video poker: $15 coin-in per point',
  },
  {
    id: 'royal-club-royale-table-game-manual',
    brand: 'royal',
    program: 'club-royale',
    mode: 'manual',
    gameCategory: 'table-game',
    tableGameFormula: 'manual',
    sourceLabel: 'Royal Caribbean Club Royale table games: manual/theoretical entry',
    warning: 'Table-game points are based on game type, average bet, and time played. Enter actual points manually unless imported.',
  },
  {
    id: 'celebrity-blue-chip-reel-slot-redeemable',
    brand: 'celebrity',
    program: 'blue-chip',
    mode: 'blue-chip-redeemable-points',
    gameCategory: 'reel-slot',
    coinInPerPoint: 5,
    sourceLabel: 'Celebrity Blue Chip reel slots, redeemable-style estimate: $5 coin-in per point',
  },
  {
    id: 'celebrity-blue-chip-video-poker-redeemable',
    brand: 'celebrity',
    program: 'blue-chip',
    mode: 'blue-chip-redeemable-points',
    gameCategory: 'video-poker',
    coinInPerPoint: 10,
    sourceLabel: 'Celebrity Blue Chip video poker, redeemable-style estimate: $10 coin-in per point',
  },
  {
    id: 'celebrity-blue-chip-reel-slot-tier',
    brand: 'celebrity',
    program: 'blue-chip',
    mode: 'blue-chip-tier-points',
    gameCategory: 'reel-slot',
    wagerPerTierPoint: 1,
    sourceLabel: 'Celebrity Blue Chip slot tier points: $1 wager per tier point',
  },
  {
    id: 'celebrity-blue-chip-video-poker-tier',
    brand: 'celebrity',
    program: 'blue-chip',
    mode: 'blue-chip-tier-points',
    gameCategory: 'video-poker',
    wagerPerTierPoint: 2,
    sourceLabel: 'Celebrity Blue Chip video poker tier points: $2 wager per tier point',
  },
  {
    id: 'celebrity-blue-chip-table-game-tier-theoretical',
    brand: 'celebrity',
    program: 'blue-chip',
    mode: 'blue-chip-tier-points',
    gameCategory: 'table-game',
    theoreticalMultiplier: 8,
    tableGameFormula: 'theoretical',
    sourceLabel: 'Celebrity Blue Chip table-game tier points: theoretical-based',
    warning: 'Celebrity table-game tier points are based on theoretical, not simple coin-in.',
  },
];

function normalizeBrand(value?: CasinoBrand | string): CasinoBrand {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('royal')) return 'royal';
  if (text.includes('celebrity')) return 'celebrity';
  if (text.includes('carnival')) return 'carnival';
  return 'unknown';
}

function normalizeProgram(value?: string): PointEarningProfile['program'] {
  const text = String(value ?? '').toLowerCase().replace(/[_\s-]/g, '');
  if (text.includes('clubroyale')) return 'club-royale';
  if (text.includes('bluechip')) return 'blue-chip';
  if (text.includes('playersclub')) return 'players-club';
  return 'unknown';
}

export function normalizeGameCategory(value?: GameCategory | string): GameCategory {
  const text = String(value ?? '').toLowerCase().replace(/[_\s]/g, '-');
  if (text.includes('video') && text.includes('poker')) return 'video-poker';
  if (text.includes('table') || ['blackjack', 'roulette', 'craps', 'baccarat', 'poker'].some((needle) => text.includes(needle))) return 'table-game';
  if (text.includes('electronic') && text.includes('table')) return 'electronic-table-game';
  if (text.includes('slot') || text.includes('penny') || text.includes('nickel') || text.includes('quarter') || text.includes('dollar')) return 'reel-slot';
  if (text.includes('other')) return 'other';
  return 'unknown';
}

function normalizeMode(value?: PointsMode | string): PointsMode {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('import')) return 'imported';
  if (text.includes('manual')) return 'manual';
  if (text.includes('tier')) return 'blue-chip-tier-points';
  if (text.includes('blue') || text.includes('redeem')) return 'blue-chip-redeemable-points';
  if (text.includes('club') || text.includes('royale')) return 'club-royale-points';
  return 'unknown';
}

export function getDefaultPointEarningProfile(input: {
  brand?: CasinoBrand | string;
  program?: string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode | string;
}): PointEarningProfile {
  const brand = normalizeBrand(input.brand);
  const program = normalizeProgram(input.program);
  const gameCategory = normalizeGameCategory(input.gameCategory);
  const mode = normalizeMode(input.mode);

  const candidates = DEFAULT_POINT_EARNING_PROFILES.filter((profile) => {
    if (brand !== 'unknown' && profile.brand !== brand) return false;
    if (program !== 'unknown' && profile.program !== program) return false;
    if (gameCategory !== 'unknown' && profile.gameCategory !== gameCategory) return false;
    if (mode !== 'unknown' && profile.mode !== mode && profile.mode !== 'manual') return false;
    return true;
  });

  return candidates[0] ?? DEFAULT_POINT_EARNING_PROFILES[0];
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculatePointsFromCoinIn(input: {
  coinIn?: number;
  brand?: CasinoBrand | string;
  program?: string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode | string;
  profile?: PointEarningProfile;
  freeplayCoinIn?: number;
  cashCoinIn?: number;
  manualPoints?: number;
  importedPoints?: number;
}): {
  points: number | null;
  profile: PointEarningProfile;
  source: 'calculated' | 'manual-required' | 'manual' | 'imported' | 'unknown';
  warnings: string[];
} {
  const warnings: string[] = [];
  const imported = finiteNumber(input.importedPoints);
  if (imported !== null) {
    const profile = input.profile ?? getDefaultPointEarningProfile(input);
    return { points: Math.round(imported), profile, source: 'imported', warnings };
  }
  const manual = finiteNumber(input.manualPoints);
  if (manual !== null) {
    const profile = input.profile ?? getDefaultPointEarningProfile(input);
    return { points: Math.round(manual), profile, source: 'manual', warnings };
  }

  const profile = input.profile ?? getDefaultPointEarningProfile(input);
  if (profile.warning) warnings.push(profile.warning);

  if (profile.tableGameFormula === 'manual' || profile.gameCategory === 'table-game') {
    return { points: null, profile, source: 'manual-required', warnings };
  }

  const cashCoinIn = finiteNumber(input.cashCoinIn);
  const coinIn = finiteNumber(input.coinIn);
  const freeplayCoinIn = finiteNumber(input.freeplayCoinIn) ?? 0;
  const pointEligibleCoinIn = cashCoinIn ?? coinIn ?? 0;

  if (freeplayCoinIn > 0) {
    warnings.push('FreePlay coin-in is tracked separately and does not earn casino points by default unless manually overridden from verified onboard data.');
  }

  const divisor = profile.coinInPerPoint ?? profile.wagerPerTierPoint;
  if (!divisor || divisor <= 0 || pointEligibleCoinIn <= 0) {
    return { points: null, profile, source: 'unknown', warnings };
  }

  return {
    points: Math.floor(pointEligibleCoinIn / divisor),
    profile,
    source: 'calculated',
    warnings,
  };
}

export function estimateCoinInForPoints(input: {
  targetPoints: number;
  brand?: CasinoBrand | string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode | string;
  profile?: PointEarningProfile;
}): {
  coinIn: number | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const profile = input.profile ?? getDefaultPointEarningProfile(input);
  if (profile.warning) warnings.push(profile.warning);
  if (profile.tableGameFormula === 'manual' || profile.gameCategory === 'table-game') {
    warnings.push('Table-game point earning cannot be converted from a fixed coin-in amount.');
    return { coinIn: null, warnings };
  }
  const multiplier = profile.coinInPerPoint ?? profile.wagerPerTierPoint;
  if (!multiplier || input.targetPoints <= 0) return { coinIn: null, warnings };
  return { coinIn: input.targetPoints * multiplier, warnings };
}
