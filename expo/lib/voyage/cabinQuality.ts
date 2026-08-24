export interface CabinQualityInput {
  cabinNumber?: string;
  deck?: number | null;
  distanceToElevator?: 'near' | 'medium' | 'far' | 'unknown';
  casinoDeckDistance?: number | null;
  noiseRisk?: 'low' | 'medium' | 'high' | 'unknown';
  obstruction?: 'none' | 'partial' | 'full' | 'unknown';
  motionPosition?: 'low_midship' | 'midship' | 'forward' | 'aft' | 'high_deck' | 'unknown';
  smokingExposure?: 'none' | 'possible' | 'likely' | 'unknown';
  priorRating?: number | null;
}
export interface CabinQualityResult { score: number; confidence: 'high' | 'medium' | 'low'; strengths: string[]; cautions: string[]; missingData: string[] }

export function evaluateCabinQuality(input: CabinQualityInput): CabinQualityResult {
  let score = 70;
  const strengths: string[] = [], cautions: string[] = [], missingData: string[] = [];
  if (input.distanceToElevator === 'near') { score += 6; strengths.push('Short walk to elevators.'); }
  else if (input.distanceToElevator === 'far') { score -= 6; cautions.push('Longer walk to elevators.'); }
  else if (!input.distanceToElevator || input.distanceToElevator === 'unknown') missingData.push('elevator distance');
  if (typeof input.casinoDeckDistance === 'number') { if (input.casinoDeckDistance <= 2) { score += 5; strengths.push('Close to the casino decks.'); } else if (input.casinoDeckDistance >= 6) cautions.push('Farther from the casino decks.'); }
  else missingData.push('casino proximity');
  if (input.noiseRisk === 'low') { score += 8; strengths.push('Low recorded noise risk.'); } else if (input.noiseRisk === 'high') { score -= 18; cautions.push('High recorded noise risk.'); } else if (!input.noiseRisk || input.noiseRisk === 'unknown') missingData.push('noise risk');
  if (input.obstruction === 'none') { score += 6; strengths.push('No recorded obstruction.'); } else if (input.obstruction === 'partial') { score -= 10; cautions.push('Partially obstructed view.'); } else if (input.obstruction === 'full') { score -= 24; cautions.push('Fully obstructed view.'); } else missingData.push('view obstruction');
  if (input.motionPosition === 'low_midship' || input.motionPosition === 'midship') { score += 8; strengths.push('Favorable position for motion sensitivity.'); } else if (input.motionPosition === 'forward' || input.motionPosition === 'high_deck') { score -= 8; cautions.push('Position may feel more ship motion.'); } else missingData.push('motion position');
  if (input.smokingExposure === 'none') { score += 3; strengths.push('No recorded smoking exposure.'); } else if (input.smokingExposure === 'likely') { score -= 12; cautions.push('Likely smoking-area exposure.'); } else if (!input.smokingExposure || input.smokingExposure === 'unknown') missingData.push('smoking exposure');
  if (typeof input.priorRating === 'number') score = score * 0.75 + Math.max(0, Math.min(5, input.priorRating)) * 5;
  return { score: Math.round(Math.max(0, Math.min(100, score))), confidence: missingData.length <= 1 ? 'high' : missingData.length <= 3 ? 'medium' : 'low', strengths, cautions, missingData };
}
