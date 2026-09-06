import type { BookedCruise } from '@/types/models';
import { getCruiseGuestEligibility, knownNightCount } from '@/lib/cruiseRecordIntegrity';

export interface CrownAnchorCruisePointProjection {
  points: number | null;
  multiplier: 1 | 2 | 3 | null;
  guestCount: number | null;
  source: 'explicit_single_occupancy' | 'saved_guest_count' | 'missing_occupancy' | 'missing_nights';
  explanation: string;
}

export function isSuiteOrHigherCabin(cruise: Pick<BookedCruise, 'cabinType' | 'cabinCategory' | 'stateroomType' | 'stateroomCategoryCode'>): boolean {
  const descriptive = [cruise.cabinType, cruise.stateroomType]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (/\b(?:suite|loft|villa|aqua\s*theater|sky\s*class|star\s*class)\b/i.test(descriptive)) return true;
  if (/^s$/i.test(String(cruise.stateroomType ?? '').trim())) return true;
  const category = String(cruise.cabinCategory ?? cruise.stateroomCategoryCode ?? '').trim().toUpperCase();
  return /^(?:JS|GS|OS|RS|WS|VP|J[1-4]|A[1-4]|RL|TL|CL|OL|SL)$/.test(category);
}

/**
 * Easy Seas owner rule: a solo traveler earns two Crown & Anchor points per
 * night; each traveler in a shared cabin earns one point per night. A suite
 * category adds one additional point per night after the occupancy rate is
 * known.
 */
export function projectCrownAnchorCruisePoints(cruise: BookedCruise): CrownAnchorCruisePointProjection {
  const nights = knownNightCount(cruise.nights);
  if (!nights) {
    return { points: null, multiplier: null, guestCount: null, source: 'missing_nights', explanation: 'Cruise nights are required before projecting Crown & Anchor points.' };
  }

  const hasSuiteBonus = isSuiteOrHigherCabin(cruise);
  const withSuiteBonus = (baseMultiplier: 1 | 2): 1 | 2 | 3 => (baseMultiplier + (hasSuiteBonus ? 1 : 0)) as 1 | 2 | 3;
  const explanation = (multiplier: 1 | 2 | 3, occupancy: 'solo' | 'shared') => `${nights} nights × ${multiplier} point${multiplier === 1 ? '' : 's'} per night (${occupancy}${hasSuiteBonus ? ' + suite bonus' : ''})`;

  if (cruise.singleOccupancy === true) {
    const multiplier = withSuiteBonus(2);
    return { points: nights * multiplier, multiplier, guestCount: 1, source: 'explicit_single_occupancy', explanation: explanation(multiplier, 'solo') };
  }

  const guestCount = cruise.singleOccupancy === false
    ? Math.max(2, getCruiseGuestEligibility(cruise) ?? 2)
    : cruise.guestNames?.length || getCruiseGuestEligibility(cruise) || null;

  if (guestCount === 1) {
    const multiplier = withSuiteBonus(2);
    return { points: nights * multiplier, multiplier, guestCount, source: 'saved_guest_count', explanation: explanation(multiplier, 'solo') };
  }
  if (guestCount !== null && guestCount >= 2) {
    const multiplier = withSuiteBonus(1);
    return { points: nights * multiplier, multiplier, guestCount, source: 'saved_guest_count', explanation: explanation(multiplier, 'shared') };
  }
  return { points: null, multiplier: null, guestCount: null, source: 'missing_occupancy', explanation: 'Guest occupancy is required before projecting Crown & Anchor points.' };
}
