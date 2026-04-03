interface TierThresholdEntry {
  threshold?: number;
  qualifyPoints?: number;
}

interface TierThresholdMap {
  [tier: string]: TierThresholdEntry;
}

export interface AnnualResetWindow {
  cycleStart: Date;
  nextResetDate: Date;
}

interface ResolveRetainedTierStateParams {
  currentPoints: number;
  activeTier?: string | null;
  tierOrder: string[];
  thresholds: TierThresholdMap;
  getTierByPoints: (points: number) => string;
  defaultTier: string;
  today?: Date;
  retainedTierUntil?: Date | null;
}

export interface RetainedTierState {
  earnedTier: string;
  displayTier: string;
  isRetainedStatus: boolean;
  retainedStatusExpiresAt: Date | null;
  progressTargetTier: string | null;
  pointsToProgressTarget: number;
  progressPercent: number;
  cycleStart: Date;
  nextResetDate: Date;
}

interface ResolveDisplayTierAtDateParams {
  currentPoints: number;
  currentTier: string;
  retainedTierUntil?: Date | null;
  asOf?: Date;
  tierOrder: string[];
  getTierByPoints: (points: number) => string;
}

const DEFAULT_RESET_MONTH_INDEX = 3;
const DEFAULT_RESET_DAY = 1;

function getTierThreshold(entry: TierThresholdEntry | undefined): number {
  return entry?.threshold ?? entry?.qualifyPoints ?? 0;
}

function getTierIndex(tierOrder: string[], tier: string): number {
  const index = tierOrder.indexOf(tier);
  return index >= 0 ? index : 0;
}

export function getAnnualResetWindow(
  today: Date = new Date(),
  resetMonthIndex: number = DEFAULT_RESET_MONTH_INDEX,
  resetDay: number = DEFAULT_RESET_DAY,
): AnnualResetWindow {
  const cycleStart = new Date(today.getFullYear(), resetMonthIndex, resetDay);

  if (today < cycleStart) {
    cycleStart.setFullYear(cycleStart.getFullYear() - 1);
  }

  const nextResetDate = new Date(cycleStart);
  nextResetDate.setFullYear(cycleStart.getFullYear() + 1);

  return {
    cycleStart,
    nextResetDate,
  };
}

export function resolveRetainedTierState({
  currentPoints,
  activeTier,
  tierOrder,
  thresholds,
  getTierByPoints,
  defaultTier,
  today = new Date(),
  retainedTierUntil,
}: ResolveRetainedTierStateParams): RetainedTierState {
  const annualWindow = getAnnualResetWindow(today);
  const earnedTier = getTierByPoints(currentPoints) || defaultTier;
  const retainedStatusExpiresAt = retainedTierUntil ?? annualWindow.nextResetDate;
  const shouldRetainStatus = Boolean(
    activeTier &&
      getTierIndex(tierOrder, activeTier) > getTierIndex(tierOrder, earnedTier) &&
      today < retainedStatusExpiresAt,
  );
  const displayTier = shouldRetainStatus && activeTier ? activeTier : earnedTier;
  const displayTierThreshold = getTierThreshold(thresholds[displayTier]);
  const displayTierIndex = getTierIndex(tierOrder, displayTier);
  const nextTier = displayTierIndex < tierOrder.length - 1 ? tierOrder[displayTierIndex + 1] : null;
  const progressTargetTier = shouldRetainStatus && currentPoints < displayTierThreshold ? displayTier : nextTier;
  const progressTargetThreshold = progressTargetTier ? getTierThreshold(thresholds[progressTargetTier]) : 0;
  const pointsToProgressTarget = progressTargetTier ? Math.max(0, progressTargetThreshold - currentPoints) : 0;

  let progressPercent = 100;

  if (progressTargetTier) {
    if (shouldRetainStatus && progressTargetTier === displayTier) {
      progressPercent = progressTargetThreshold > 0
        ? Math.min(100, Math.max(0, (currentPoints / progressTargetThreshold) * 100))
        : 100;
    } else {
      const lowerBound = getTierThreshold(thresholds[displayTier]);
      const rangeSize = Math.max(1, progressTargetThreshold - lowerBound);
      progressPercent = Math.min(100, Math.max(0, ((currentPoints - lowerBound) / rangeSize) * 100));
    }
  }

  return {
    earnedTier,
    displayTier,
    isRetainedStatus: shouldRetainStatus,
    retainedStatusExpiresAt: shouldRetainStatus ? retainedStatusExpiresAt : null,
    progressTargetTier,
    pointsToProgressTarget,
    progressPercent,
    cycleStart: annualWindow.cycleStart,
    nextResetDate: annualWindow.nextResetDate,
  };
}

export function resolveDisplayTierAtDate({
  currentPoints,
  currentTier,
  retainedTierUntil,
  asOf = new Date(),
  tierOrder,
  getTierByPoints,
}: ResolveDisplayTierAtDateParams): string {
  const earnedTier = getTierByPoints(currentPoints);
  const currentTierIndex = getTierIndex(tierOrder, currentTier);
  const earnedTierIndex = getTierIndex(tierOrder, earnedTier);

  if (retainedTierUntil && asOf < retainedTierUntil && currentTierIndex > earnedTierIndex) {
    return currentTier;
  }

  return earnedTier;
}
