import { CLUB_ROYALE_TIER_COLORS, withAlpha } from '@/constants/loyaltyColors';
import type { ClubRoyaleTier } from '@/types/models';

export interface ClubRoyaleTierInfo {
  name: string;
  threshold: number;
  color: string;
  bgColor: string;
  benefits: string[];
  pointsPerNight: number;
}

// UI and imported profile data can contain an unrecognized string before it
// is normalized. A string index keeps those reads type-safe while every known
// tier remains constrained by TIER_ORDER and normalizeClubRoyaleTier().
export const CLUB_ROYALE_TIERS: Record<string, ClubRoyaleTierInfo> = {
  Choice: {
    name: 'Choice',
    threshold: 0,
    color: CLUB_ROYALE_TIER_COLORS.Choice,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Choice, 0.15),
    benefits: [
      'Basic casino privileges',
      'Access to Club Royale lounge',
    ],
    pointsPerNight: 100,
  },
  Prime: {
    name: 'Prime',
    threshold: 2501,
    color: CLUB_ROYALE_TIER_COLORS.Prime,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Prime, 0.15),
    benefits: [
      'Priority boarding',
      'Complimentary specialty dining',
      'Enhanced casino offers',
      'Dedicated casino host',
    ],
    pointsPerNight: 150,
  },
  Signature: {
    name: 'Signature',
    threshold: 25001,
    color: CLUB_ROYALE_TIER_COLORS.Signature,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Signature, 0.12),
    benefits: [
      'All Prime benefits',
      'Suite-level amenities',
      'Priority restaurant reservations',
      'Exclusive events',
      'Increased freeplay offers',
    ],
    pointsPerNight: 200,
  },
  Masters: {
    name: 'Masters',
    threshold: 100001,
    color: CLUB_ROYALE_TIER_COLORS.Masters,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Masters, 0.15),
    benefits: [
      'All Signature benefits',
      'Complimentary suite upgrades',
      'Personal casino concierge',
      'VIP experiences',
      'Maximum comp value',
    ],
    pointsPerNight: 300,
  },
};

export const TIER_ORDER: ClubRoyaleTier[] = ['Choice', 'Prime', 'Signature', 'Masters'];

export interface ResolvedClubRoyaleStatus {
  effectiveTier: ClubRoyaleTier;
  pointsTier: ClubRoyaleTier;
  validThrough: string | null;
  isProtected: boolean;
}

/**
 * Club Royale status is earned in an April 1-March 31 casino year and remains
 * active through the following casino year. Date-only strings are used here so
 * a device timezone cannot move the April 1 boundary backward or forward.
 */
function getDateOnlyParts(value: string | null | undefined): { year: number; month: number; day: number } | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  const usMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const match = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : usMatch
      ? { year: Number(usMatch[3]), month: Number(usMatch[1]), day: Number(usMatch[2]) }
      : null;

  if (!match || match.month < 1 || match.month > 12 || match.day < 1 || match.day > 31) return null;
  const validationDate = new Date(Date.UTC(match.year, match.month - 1, match.day));
  if (
    validationDate.getUTCFullYear() !== match.year
    || validationDate.getUTCMonth() + 1 !== match.month
    || validationDate.getUTCDate() !== match.day
  ) return null;

  return match;
}

function toDateOnlyString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getLocalDateOnly(date: Date): string {
  return toDateOnlyString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function normalizeClubRoyaleTier(value: string | null | undefined): ClubRoyaleTier | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return TIER_ORDER.find((tier) => tier.toLowerCase() === normalized) ?? null;
}

export function getClubRoyaleTierRank(value: string | null | undefined): number {
  const tier = normalizeClubRoyaleTier(value);
  return tier ? TIER_ORDER.indexOf(tier) : -1;
}

export function getHigherClubRoyaleTier(
  first: string | null | undefined,
  second: string | null | undefined,
): ClubRoyaleTier {
  const firstTier = normalizeClubRoyaleTier(first) ?? 'Choice';
  const secondTier = normalizeClubRoyaleTier(second) ?? 'Choice';
  return getClubRoyaleTierRank(secondTier) > getClubRoyaleTierRank(firstTier) ? secondTier : firstTier;
}

export function normalizeClubRoyaleValidThrough(value: string | null | undefined): string | null {
  const parts = getDateOnlyParts(value);
  return parts ? toDateOnlyString(parts.year, parts.month, parts.day) : null;
}

export function formatClubRoyaleValidThrough(value: string | null | undefined): string {
  const parts = getDateOnlyParts(value);
  return parts ? `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}` : '';
}

export function getNextClubRoyaleAprilFirst(asOf: Date = new Date()): string {
  const year = asOf.getFullYear();
  const isBeforeAprilFirst = asOf.getMonth() < 3;
  return toDateOnlyString(isBeforeAprilFirst ? year : year + 1, 4, 1);
}

export function inferClubRoyaleTierValidThrough(
  confirmedTier: string | null | undefined,
  currentSeasonPoints: number,
  asOf: Date = new Date(),
): string | null {
  const normalizedTier = normalizeClubRoyaleTier(confirmedTier);
  if (!normalizedTier) return null;

  const nextAprilFirst = getNextClubRoyaleAprilFirst(asOf);
  const nextAprilParts = getDateOnlyParts(nextAprilFirst)!;
  const pointsTier = getTierByPoints(currentSeasonPoints);

  // A confirmed status above the current points tier was earned in the prior
  // casino year and is retained until the upcoming April 1. A status earned
  // from this year's points is retained for the next full casino year too.
  return getClubRoyaleTierRank(normalizedTier) > getClubRoyaleTierRank(pointsTier)
    ? nextAprilFirst
    : toDateOnlyString(nextAprilParts.year + 1, 4, 1);
}

export function resolveClubRoyaleStatus({
  currentSeasonPoints,
  confirmedTier,
  confirmedValidThrough,
  asOf = new Date(),
}: {
  currentSeasonPoints: number;
  confirmedTier?: string | null;
  confirmedValidThrough?: string | null;
  asOf?: Date;
}): ResolvedClubRoyaleStatus {
  const safePoints = Number.isFinite(currentSeasonPoints) ? Math.max(0, currentSeasonPoints) : 0;
  const pointsTier = getTierByPoints(safePoints) as ClubRoyaleTier;
  const normalizedConfirmedTier = normalizeClubRoyaleTier(confirmedTier);
  const normalizedValidThrough = normalizeClubRoyaleValidThrough(confirmedValidThrough)
    ?? inferClubRoyaleTierValidThrough(normalizedConfirmedTier, safePoints, asOf);
  const today = getLocalDateOnly(asOf);
  const protectionIsCurrent = Boolean(
    normalizedConfirmedTier
    && normalizedValidThrough
    && today <= normalizedValidThrough,
  );
  const shouldRetainConfirmedTier = Boolean(
    protectionIsCurrent
    && normalizedConfirmedTier
    && getClubRoyaleTierRank(normalizedConfirmedTier) > getClubRoyaleTierRank(pointsTier),
  );
  const confirmedTierIsEffective = Boolean(
    protectionIsCurrent
    && normalizedConfirmedTier
    && getClubRoyaleTierRank(normalizedConfirmedTier) >= getClubRoyaleTierRank(pointsTier),
  );

  return {
    effectiveTier: shouldRetainConfirmedTier ? normalizedConfirmedTier! : pointsTier,
    pointsTier,
    validThrough: confirmedTierIsEffective ? normalizedValidThrough : null,
    isProtected: shouldRetainConfirmedTier,
  };
}

export function getNextTier(currentTier: string): ClubRoyaleTier | null {
  const normalizedTier = normalizeClubRoyaleTier(currentTier);
  const currentIndex = normalizedTier ? TIER_ORDER.indexOf(normalizedTier) : -1;
  if (currentIndex === -1 || currentIndex === TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[currentIndex + 1];
}

export function getTierProgress(currentPoints: number, currentTier: string): {
  nextTier: ClubRoyaleTier | null;
  pointsToNext: number;
  percentComplete: number;
} {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return { nextTier: null, pointsToNext: 0, percentComplete: 100 };
  }

  const normalizedCurrentTier = normalizeClubRoyaleTier(currentTier) ?? 'Choice';
  const normalizedNextTier = normalizeClubRoyaleTier(nextTier) ?? 'Choice';
  const currentThreshold = CLUB_ROYALE_TIERS[normalizedCurrentTier].threshold;
  const nextThreshold = CLUB_ROYALE_TIERS[normalizedNextTier].threshold;
  const pointsInRange = currentPoints - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (pointsInRange / rangeSize) * 100));
  const pointsToNext = Math.max(0, nextThreshold - currentPoints);

  return { nextTier, pointsToNext, percentComplete };
}

export function getTierByPoints(points: number): ClubRoyaleTier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (points >= CLUB_ROYALE_TIERS[tier].threshold) {
      return tier;
    }
  }
  return 'Choice';
}

export function calculateNightsToTier(
  currentPoints: number,
  targetTier: string,
  averagePointsPerNight: number = 150
): number {
  const normalizedTargetTier = normalizeClubRoyaleTier(targetTier);
  const targetThreshold = normalizedTargetTier ? CLUB_ROYALE_TIERS[normalizedTargetTier].threshold : 0;
  const pointsNeeded = Math.max(0, targetThreshold - currentPoints);
  return Math.ceil(pointsNeeded / averagePointsPerNight);
}

export function calculateETAToTier(
  currentPoints: number,
  targetTier: string,
  averageNightsPerMonth: number = 7,
  averagePointsPerNight: number = 150
): Date | null {
  const nightsNeeded = calculateNightsToTier(currentPoints, targetTier, averagePointsPerNight);
  if (nightsNeeded === 0) return null;

  const monthsNeeded = nightsNeeded / averageNightsPerMonth;
  const eta = new Date();
  eta.setMonth(eta.getMonth() + Math.ceil(monthsNeeded));
  return eta;
}
