export interface AdtScenarioResult { daysPlayed: number; totalCoinIn: number; coinInPerDay: number; estimatedTheo: number; estimatedTheoPerDay: number; warnings: string[] }

export function calculateAdtScenario(input: { totalCoinIn: number; daysPlayed: number; assumedHoldPercent: number }): AdtScenarioResult {
  const totalCoinIn = Math.max(0, input.totalCoinIn || 0);
  const daysPlayed = Math.max(1, Math.round(input.daysPlayed || 1));
  const hold = Math.max(0, Math.min(100, input.assumedHoldPercent || 0));
  const estimatedTheo = totalCoinIn * hold / 100;
  return { daysPlayed, totalCoinIn, coinInPerDay: totalCoinIn / daysPlayed, estimatedTheo, estimatedTheoPerDay: estimatedTheo / daysPlayed, warnings: ['Cruise-line ADT and trip-rating formulas are proprietary, unverified, and may differ by line, ship, sailing, and player.', 'Do not use this scenario as a reason to exceed personal money or time limits.'] };
}
