export type MarineObservationFreshness = 'fresh' | 'aging' | 'stale';
export type MarineObservationConfidence = 'high' | 'medium' | 'low';

export function classifyMarineObservationEvidence(
  observedAt: string,
  distanceMiles: number,
  nowMs = Date.now(),
): { freshness: MarineObservationFreshness; confidence: MarineObservationConfidence; ageHours: number | null } {
  const observedTime = new Date(observedAt).getTime();
  const ageHours = Number.isFinite(observedTime)
    ? Math.max(0, (nowMs - observedTime) / (1000 * 60 * 60))
    : null;
  const freshness: MarineObservationFreshness = ageHours !== null && ageHours <= 3
    ? 'fresh'
    : ageHours !== null && ageHours <= 12
      ? 'aging'
      : 'stale';
  const confidence: MarineObservationConfidence = freshness === 'fresh' && distanceMiles <= 50
    ? 'high'
    : freshness !== 'stale' && distanceMiles <= 150
      ? 'medium'
      : 'low';
  return { freshness, confidence, ageHours };
}

