import { CLUB_POINTS_TIER_COLORS, withAlpha } from '@/constants/loyaltyColors';

export interface CelebrityCaptainsClubLevelInfo {
  name: string;
  cruisePoints: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const CELEBRITY_CAPTAINS_CLUB_LEVELS: Record<string, CelebrityCaptainsClubLevelInfo> = {
  Preview: {
    name: 'Preview',
    cruisePoints: 0,
    color: CLUB_POINTS_TIER_COLORS.Preview,
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS.Preview, 0.15),
    benefits: [
      'Enrollment before first cruise',
      'Access to Captain\'s Club member portal',
    ],
  },
  Classic: {
    name: 'Classic',
    cruisePoints: 2,
    color: CLUB_POINTS_TIER_COLORS.Classic,
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS.Classic, 0.15),
    benefits: [
      'Captain\'s Club welcome',
      'Member savings on future cruises',
      'Exclusive member offers',
    ],
  },
  Select: {
    name: 'Select',
    cruisePoints: 150,
    color: CLUB_POINTS_TIER_COLORS.Select,
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS.Select, 0.15),
    benefits: [
      'All Classic benefits',
      'Priority check-in',
      'Premium beverage vouchers',
      'Exclusive member events',
    ],
  },
  Elite: {
    name: 'Elite',
    cruisePoints: 300,
    color: CLUB_POINTS_TIER_COLORS.Elite,
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS.Elite, 0.15),
    benefits: [
      'All Select benefits',
      'Priority embarkation',
      'Complimentary specialty dining',
      'Access to Retreat Sun Deck',
    ],
  },
  'Elite Plus': {
    name: 'Elite Plus',
    cruisePoints: 750,
    color: CLUB_POINTS_TIER_COLORS['Elite Plus'],
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS['Elite Plus'], 0.15),
    benefits: [
      'All Elite benefits',
      'Complimentary laundry service',
      'Priority tender tickets',
      'Behind-the-scenes tour',
      'Exclusive Elite events',
    ],
  },
  Zenith: {
    name: 'Zenith',
    cruisePoints: 3000,
    color: CLUB_POINTS_TIER_COLORS.Zenith,
    bgColor: withAlpha(CLUB_POINTS_TIER_COLORS.Zenith, 0.15),
    benefits: [
      'All Elite Plus benefits',
      'Annual Zenith event',
      'Complimentary premium beverage package',
      'Unlimited internet access',
      'Personal concierge service',
    ],
  },
};

export const CELEBRITY_LEVEL_ORDER = ['Preview', 'Classic', 'Select', 'Elite', 'Elite Plus', 'Zenith'];

export function getNextCelebrityLevel(currentLevel: string): string | null {
  const currentIndex = CELEBRITY_LEVEL_ORDER.indexOf(currentLevel);
  if (currentIndex === -1 || currentIndex === CELEBRITY_LEVEL_ORDER.length - 1) {
    return null;
  }
  return CELEBRITY_LEVEL_ORDER[currentIndex + 1];
}

export function getCelebrityCaptainsClubLevelProgress(totalPoints: number, currentLevel: string): {
  nextLevel: string | null;
  pointsToNext: number;
  percentComplete: number;
} {
  const nextLevel = getNextCelebrityLevel(currentLevel);
  if (!nextLevel) {
    return { nextLevel: null, pointsToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = CELEBRITY_CAPTAINS_CLUB_LEVELS[currentLevel]?.cruisePoints || 0;
  const nextThreshold = CELEBRITY_CAPTAINS_CLUB_LEVELS[nextLevel]?.cruisePoints || 0;
  const pointsInRange = totalPoints - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (pointsInRange / rangeSize) * 100));
  const pointsToNext = Math.max(0, nextThreshold - totalPoints);

  return { nextLevel, pointsToNext, percentComplete };
}

export function getCelebrityCaptainsClubLevelByPoints(points: number): string {
  for (let i = CELEBRITY_LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = CELEBRITY_LEVEL_ORDER[i];
    if (points >= CELEBRITY_CAPTAINS_CLUB_LEVELS[level].cruisePoints) {
      return level;
    }
  }
  return 'Preview';
}

export function calculatePointsToZenith(currentPoints: number): number {
  const zenithThreshold = CELEBRITY_CAPTAINS_CLUB_LEVELS.Zenith.cruisePoints;
  return Math.max(0, zenithThreshold - currentPoints);
}

export function calculateETAToZenith(
  currentPoints: number,
  averagePointsPerMonth: number = 30
): Date | null {
  const pointsNeeded = calculatePointsToZenith(currentPoints);
  if (pointsNeeded === 0) return null;

  const monthsNeeded = pointsNeeded / averagePointsPerMonth;
  const eta = new Date();
  eta.setMonth(eta.getMonth() + Math.ceil(monthsNeeded));
  return eta;
}
