export interface PostCruiseScorecardInput { totalCost: number; compValue: number; casinoNetResult: number; theoreticalLoss?: number | null; points?: number; newOfferCount?: number; portsVisited?: number; cabinRating?: number | null; shipRating?: number | null; favoriteMachines?: string[]; crewRecognitionCount?: number; lessons?: string[] }
export interface PostCruiseScorecard extends PostCruiseScorecardInput { netEconomicValue: number; valueRecoveryPercent: number | null; experienceScore: number | null; summary: string }
export function buildPostCruiseScorecard(input: PostCruiseScorecardInput): PostCruiseScorecard {
  const totalCost = Math.max(0, input.totalCost || 0), comp = Math.max(0, input.compValue || 0), netEconomicValue = comp + input.casinoNetResult - totalCost;
  const ratings = [input.cabinRating, input.shipRating].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const experienceScore = ratings.length ? Math.round(ratings.reduce((sum, value) => sum + Math.max(0, Math.min(5, value)), 0) / ratings.length * 20) : null;
  return { ...input, totalCost, compValue: comp, netEconomicValue, valueRecoveryPercent: totalCost > 0 ? comp / totalCost * 100 : null, experienceScore, summary: `${netEconomicValue >= 0 ? 'Positive' : 'Negative'} recorded economic result of ${Math.abs(netEconomicValue).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}; ${input.newOfferCount ?? 0} new offer(s) recorded.` };
}
