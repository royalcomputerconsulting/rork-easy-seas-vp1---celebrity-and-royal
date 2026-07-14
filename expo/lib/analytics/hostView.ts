type CruiseLike = {
  shipName?: string;
  casinoPoints?: number;
  earnedPoints?: number;
  pointsEarned?: number;
  coinIn?: number;
  winnings?: number;
  totalWinnings?: number;
  netResult?: number;
  cashResult?: number;
  winningsBroughtHome?: number;
};

type SessionLike = {
  machineName?: string;
  pointsEarned?: number;
  coinIn?: number;
  winLoss?: number;
  cruiseId?: string;
};

export type HostViewProfile = {
  cruises: number;
  sessions: number;
  points: number;
  coinIn: number;
  winLoss: number;
  averagePointsPerCruise: number;
  averageCoinInPerCruise: number;
  favoriteShips: string[];
  favoriteMachines: string[];
  strengths: string[];
  risks: string[];
  talkingPoints: string[];
  copySummary: string;
  warnings: string[];
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cruisePoints(cruise: CruiseLike): number {
  return num(cruise.casinoPoints) || num(cruise.earnedPoints) || num(cruise.pointsEarned);
}

function cruiseWinLoss(cruise: CruiseLike): number {
  return num(cruise.cashResult) || num(cruise.winningsBroughtHome) || num(cruise.netResult) || num(cruise.totalWinnings) || num(cruise.winnings);
}

export function buildHostViewProfile(input: { cruises?: CruiseLike[]; sessions?: SessionLike[] }): HostViewProfile {
  const cruises = input.cruises ?? [];
  const sessions = input.sessions ?? [];
  const cruisePointsTotal = cruises.reduce((sum, cruise) => sum + cruisePoints(cruise), 0);
  const sessionPointsTotal = sessions.reduce((sum, session) => sum + num(session.pointsEarned), 0);
  const points = cruisePointsTotal || sessionPointsTotal;
  const cruiseCoinIn = cruises.reduce((sum, cruise) => sum + num(cruise.coinIn), 0);
  const sessionCoinIn = sessions.reduce((sum, session) => sum + num(session.coinIn), 0);
  const coinIn = cruiseCoinIn || sessionCoinIn || points * 5;
  const cruiseWinLossTotal = cruises.reduce((sum, cruise) => sum + cruiseWinLoss(cruise), 0);
  const sessionWinLoss = sessions.reduce((sum, session) => sum + num(session.winLoss), 0);
  const winLoss = cruiseWinLossTotal || sessionWinLoss;

  const shipCounts = new Map<string, number>();
  cruises.forEach(cruise => {
    const name = cruise.shipName?.trim();
    if (name) shipCounts.set(name, (shipCounts.get(name) ?? 0) + cruisePoints(cruise));
  });
  const favoriteShips = [...shipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ship]) => ship);

  const machineCounts = new Map<string, number>();
  sessions.forEach(session => {
    const name = session.machineName?.trim();
    if (name) machineCounts.set(name, (machineCounts.get(name) ?? 0) + 1);
  });
  const favoriteMachines = [...machineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([machine]) => machine);

  const strengths: string[] = [];
  const risks: string[] = [];
  if (points >= 25000) strengths.push('Signature-level casino volume.');
  if (points >= 50000) strengths.push('Masters-level casino volume potential.');
  if (winLoss > 0) strengths.push('Positive net cash result in tracked data.');
  if (coinIn > 0 && points > 0) strengths.push('Coin-in and points are consistent enough for host discussion.');
  if (winLoss < 0) risks.push('Tracked cash result is negative; keep stop-loss guardrails visible.');
  if (sessions.length === 0) risks.push('Individual session history is sparse; host view relies on cruise closeout totals.');

  const talkingPoints = [
    `${points.toLocaleString()} tracked casino points`,
    `${Math.round(coinIn).toLocaleString()} estimated/tracked coin-in`,
    `${winLoss >= 0 ? '+' : '-'}$${Math.abs(Math.round(winLoss)).toLocaleString()} tracked cash result`,
    favoriteShips.length ? `Strongest ships: ${favoriteShips.join(', ')}` : 'Add ship-level play history for stronger host notes',
  ];

  const copySummary = `Host View: ${points.toLocaleString()} points, $${Math.round(coinIn).toLocaleString()} coin-in volume, ${winLoss >= 0 ? '+' : '-'}$${Math.abs(Math.round(winLoss)).toLocaleString()} cash result across ${cruises.length} cruise(s).`;

  return {
    cruises: cruises.length,
    sessions: sessions.length,
    points,
    coinIn,
    winLoss,
    averagePointsPerCruise: cruises.length ? points / cruises.length : 0,
    averageCoinInPerCruise: cruises.length ? coinIn / cruises.length : 0,
    favoriteShips,
    favoriteMachines,
    strengths,
    risks,
    talkingPoints,
    copySummary,
    warnings: ['Coin-in is wagering volume, not cost.', cruisePointsTotal ? 'Cruise-level closeout totals were preferred over session rollups.' : 'Session totals were used because cruise-level totals were unavailable.'],
  };
}
