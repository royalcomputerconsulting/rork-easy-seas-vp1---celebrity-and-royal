import type { NextBestAction, RecommendationConfidence } from '@/types/intelligence';

export interface RecommendationCandidate {
  id: string;
  type: NextBestAction['type'];
  title: string;
  explanation: string;
  route: string;
  routeParams?: Record<string, string>;
  daysUntilDue?: number | null;
  expectedBenefit?: number;
  importance?: number;
  confidence?: RecommendationConfidence;
  ownerProfileId?: string;
  brand?: string;
  casinoProgram?: string;
  missingData?: string[];
  evidence?: NextBestAction['evidence'];
}

const confidenceWeight: Record<RecommendationConfidence, number> = {
  high: 15,
  medium: 8,
  low: 2,
  insufficient: -15,
};

function urgencyFor(daysUntilDue: number | null | undefined): NextBestAction['urgency'] {
  if (typeof daysUntilDue !== 'number') return 'monitor';
  return daysUntilDue <= 7 ? 'now' : daysUntilDue <= 30 ? 'soon' : 'monitor';
}

function score(candidate: RecommendationCandidate): number {
  const due = candidate.daysUntilDue;
  const urgency = typeof due !== 'number' ? 0 : due < 0 ? -30 : due <= 3 ? 35 : due <= 14 ? 25 : due <= 30 ? 12 : 2;
  const benefit = Math.min(30, Math.max(0, (candidate.expectedBenefit ?? 0) / 100));
  const importance = Math.max(0, Math.min(20, candidate.importance ?? 10));
  const confidence = confidenceWeight[candidate.confidence ?? 'medium'];
  const missingPenalty = Math.min(20, (candidate.missingData?.length ?? 0) * 4);
  return Math.round(Math.max(0, Math.min(100, urgency + benefit + importance + confidence - missingPenalty)));
}

/** Returns at most three explainable local recommendations. It never performs an external action. */
export function rankNextBestActions(candidates: RecommendationCandidate[], limit = 3): NextBestAction[] {
  return candidates
    .filter((candidate) => typeof candidate.id === 'string' && candidate.id.length > 0)
    .map((candidate): NextBestAction => ({
      id: candidate.id,
      type: candidate.type,
      title: candidate.title,
      explanation: candidate.explanation,
      score: score(candidate),
      urgency: urgencyFor(candidate.daysUntilDue),
      expectedBenefit: candidate.expectedBenefit,
      route: candidate.route,
      routeParams: candidate.routeParams,
      ownerProfileId: candidate.ownerProfileId,
      brand: candidate.brand,
      casinoProgram: candidate.casinoProgram,
      confidence: candidate.confidence ?? 'medium',
      evidence: candidate.evidence ?? [],
      missingData: candidate.missingData ?? [],
      requiresConfirmation: true,
      externalSideEffect: false,
    }))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, Math.max(0, limit));
}
