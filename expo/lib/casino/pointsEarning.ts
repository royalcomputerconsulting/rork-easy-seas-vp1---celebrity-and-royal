export type CasinoBrand = 'royal' | 'celebrity' | 'carnival' | 'silversea' | 'unknown';

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
  program: 'club-royale' | 'blue-chip' | 'players-club' | 'venetian-society' | 'unknown';
  mode: PointsMode;
  gameCategory: GameCategory;
  coinInPerPoint?: number;
  wagerPerTierPoint?: number;
  theoreticalMultiplier?: number;
  tableGameFormula?: 'manual' | 'theoretical' | 'average-bet-time' | 'unknown';
  sourceLabel: string;
  warning?: string;
};

const MANUAL_TABLE_WARNING = 'Table-game points are based on game type, average bet, and time played. Enter actual points manually unless imported.';
const CELEBRITY_TABLE_WARNING = 'Celebrity table-game tier points are based on theoretical, not simple coin-in.';
const FREEPLAY_WARNING = 'FreePlay coin-in is tracked separately and does not earn points by default unless verified onboard data is entered.';

function normalizeBrand(brand?: CasinoBrand | string): CasinoBrand {
  const value = String(brand ?? '').toLowerCase();
  if (value.includes('royal')) return 'royal';
  if (value.includes('celebrity') || value.includes('blue')) return 'celebrity';
  if (value.includes('carnival') || value.includes('players')) return 'carnival';
  if (value.includes('silversea') || value.includes('venetian')) return 'silversea';
  return 'unknown';
}

function normalizeGameCategory(gameCategory?: GameCategory | string): GameCategory {
  const value = String(gameCategory ?? '').toLowerCase();
  if (value.includes('video') || value.includes('vp')) return 'video-poker';
  if (value.includes('table') || value.includes('blackjack') || value.includes('roulette') || value.includes('craps') || value.includes('baccarat')) return 'table-game';
  if (value.includes('slot') || value.includes('reel') || value.includes('penny') || value.includes('nickel') || value.includes('quarter') || value.includes('dollar')) return 'reel-slot';
  if (value.includes('electronic')) return 'electronic-table-game';
  if (value.includes('other')) return 'other';
  return 'unknown';
}

export function getDefaultPointEarningProfile(input: {
  brand?: CasinoBrand | string;
  program?: string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode;
}): PointEarningProfile {
  const brand = normalizeBrand(input.brand ?? input.program);
  const gameCategory = normalizeGameCategory(input.gameCategory);
  const requestedMode = input.mode;

  if (requestedMode === 'manual' || requestedMode === 'imported') {
    return {
      id: `${brand}-${requestedMode}-${gameCategory}`,
      brand,
      program: brand === 'celebrity' ? 'blue-chip' : brand === 'royal' ? 'club-royale' : brand === 'carnival' ? 'players-club' : brand === 'silversea' ? 'venetian-society' : 'unknown',
      mode: requestedMode,
      gameCategory,
      sourceLabel: requestedMode === 'manual' ? 'Manual points entry' : 'Imported points',
      warning: requestedMode === 'manual' ? 'Manual points override calculated points.' : 'Imported points override calculated points.',
    };
  }


  if (brand === 'carnival') {
    return {
      id: `carnival-players-club-${gameCategory || 'unknown'}-manual`,
      brand,
      program: 'players-club',
      mode: 'manual',
      gameCategory,
      tableGameFormula: 'manual',
      sourceLabel: 'Carnival Players Club manual/imported points',
      warning: 'Carnival Players Club casino-point earning is offer/account specific and is not calculated with Royal Caribbean coin-in rules. Enter the actual onboard/imported points.',
    };
  }

  if (brand === 'silversea') {
    return {
      id: `silversea-venetian-${gameCategory || 'unknown'}-manual`,
      brand,
      program: 'venetian-society',
      mode: 'manual',
      gameCategory,
      tableGameFormula: 'manual',
      sourceLabel: 'Silversea/Venetian Society manual points',
      warning: 'Enter verified Silversea/Venetian Society values manually; Royal Caribbean point formulas are not applied.',
    };
  }

  if (brand === 'celebrity') {
    if (requestedMode === 'blue-chip-tier-points') {
      if (gameCategory === 'video-poker') {
        return {
          id: 'celebrity-blue-chip-tier-video-poker',
          brand,
          program: 'blue-chip',
          mode: 'blue-chip-tier-points',
          gameCategory,
          wagerPerTierPoint: 2,
          sourceLabel: 'Celebrity Blue Chip video poker tier points',
        };
      }
      if (gameCategory === 'table-game') {
        return {
          id: 'celebrity-blue-chip-tier-table-game',
          brand,
          program: 'blue-chip',
          mode: 'blue-chip-tier-points',
          gameCategory,
          theoreticalMultiplier: 8,
          tableGameFormula: 'theoretical',
          sourceLabel: 'Celebrity Blue Chip table-game tier points',
          warning: CELEBRITY_TABLE_WARNING,
        };
      }
      return {
        id: 'celebrity-blue-chip-tier-reel-slot',
        brand,
        program: 'blue-chip',
        mode: 'blue-chip-tier-points',
        gameCategory: gameCategory === 'unknown' ? 'reel-slot' : gameCategory,
        wagerPerTierPoint: 1,
        sourceLabel: 'Celebrity Blue Chip slot tier points',
      };
    }

    if (gameCategory === 'video-poker') {
      return {
        id: 'celebrity-blue-chip-redeemable-video-poker',
        brand,
        program: 'blue-chip',
        mode: 'blue-chip-redeemable-points',
        gameCategory,
        coinInPerPoint: 10,
        sourceLabel: 'Celebrity Blue Chip video poker redeemable points',
      };
    }
    if (gameCategory === 'table-game') {
      return {
        id: 'celebrity-blue-chip-redeemable-table-game',
        brand,
        program: 'blue-chip',
        mode: 'manual',
        gameCategory,
        tableGameFormula: 'manual',
        sourceLabel: 'Celebrity Blue Chip table-game manual points',
        warning: CELEBRITY_TABLE_WARNING,
      };
    }
    return {
      id: 'celebrity-blue-chip-redeemable-reel-slot',
      brand,
      program: 'blue-chip',
      mode: 'blue-chip-redeemable-points',
      gameCategory: gameCategory === 'unknown' ? 'reel-slot' : gameCategory,
      coinInPerPoint: 5,
      sourceLabel: 'Celebrity Blue Chip slot redeemable points',
    };
  }

  if (gameCategory === 'video-poker') {
    return {
      id: 'royal-club-royale-video-poker',
      brand: brand === 'unknown' ? 'royal' : brand,
      program: 'club-royale',
      mode: 'club-royale-points',
      gameCategory,
      coinInPerPoint: 15,
      sourceLabel: 'Royal Caribbean Club Royale video poker points',
    };
  }

  if (gameCategory === 'table-game') {
    return {
      id: 'royal-club-royale-table-game',
      brand: brand === 'unknown' ? 'royal' : brand,
      program: 'club-royale',
      mode: 'manual',
      gameCategory,
      tableGameFormula: 'manual',
      sourceLabel: 'Royal Caribbean Club Royale table-game manual points',
      warning: MANUAL_TABLE_WARNING,
    };
  }

  return {
    id: 'royal-club-royale-reel-slot',
    brand: brand === 'unknown' ? 'royal' : brand,
    program: 'club-royale',
    mode: 'club-royale-points',
    gameCategory: gameCategory === 'unknown' ? 'reel-slot' : gameCategory,
    coinInPerPoint: 5,
    sourceLabel: 'Royal Caribbean Club Royale reel slot points',
  };
}

function cleanNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function calculatePointsFromCoinIn(input: {
  coinIn?: number;
  brand?: CasinoBrand | string;
  program?: string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode;
  profile?: PointEarningProfile;
  freeplayCoinIn?: number;
  cashCoinIn?: number;
  manualPoints?: number;
  importedPoints?: number;
}): {
  points: number | null;
  profile: PointEarningProfile;
  source: 'calculated' | 'manual-required' | 'imported' | 'manual' | 'unknown';
  warnings: string[];
} {
  const profile = input.profile ?? getDefaultPointEarningProfile(input);
  const warnings = [profile.warning].filter(Boolean) as string[];

  const importedPoints = cleanNumber(input.importedPoints);
  if (importedPoints > 0 || input.mode === 'imported') {
    return { points: importedPoints || null, profile, source: 'imported', warnings };
  }

  const manualPoints = cleanNumber(input.manualPoints);
  if (manualPoints > 0 || input.mode === 'manual') {
    if (manualPoints > 0) return { points: manualPoints, profile, source: 'manual', warnings };
    return { points: null, profile, source: 'manual-required', warnings };
  }

  const freeplayCoinIn = cleanNumber(input.freeplayCoinIn);
  const cashCoinIn = input.cashCoinIn !== undefined ? cleanNumber(input.cashCoinIn) : cleanNumber(input.coinIn) - freeplayCoinIn;
  if (freeplayCoinIn > 0) warnings.push(FREEPLAY_WARNING);
  const earningCoinIn = Math.max(0, cashCoinIn);

  if (profile.tableGameFormula && profile.tableGameFormula !== 'unknown') {
    return { points: null, profile, source: 'manual-required', warnings };
  }

  if (profile.coinInPerPoint && profile.coinInPerPoint > 0) {
    return { points: Math.floor(earningCoinIn / profile.coinInPerPoint), profile, source: 'calculated', warnings };
  }

  if (profile.wagerPerTierPoint && profile.wagerPerTierPoint > 0) {
    return { points: Math.floor(earningCoinIn / profile.wagerPerTierPoint), profile, source: 'calculated', warnings };
  }

  return { points: null, profile, source: 'unknown', warnings };
}

export function estimateCoinInForPoints(input: {
  targetPoints: number;
  brand?: CasinoBrand | string;
  gameCategory?: GameCategory | string;
  mode?: PointsMode;
  profile?: PointEarningProfile;
}): {
  coinIn: number | null;
  warnings: string[];
} {
  const profile = input.profile ?? getDefaultPointEarningProfile(input);
  const warnings = [profile.warning].filter(Boolean) as string[];
  const targetPoints = cleanNumber(input.targetPoints);

  if (!targetPoints) return { coinIn: 0, warnings };
  if (profile.coinInPerPoint && profile.coinInPerPoint > 0) return { coinIn: targetPoints * profile.coinInPerPoint, warnings };
  if (profile.wagerPerTierPoint && profile.wagerPerTierPoint > 0) return { coinIn: targetPoints * profile.wagerPerTierPoint, warnings };
  return { coinIn: null, warnings: [...warnings, 'This game category requires manual or theoretical casino-host point tracking.'] };
}
