import type { BookedCruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { buildCruiseDayPlan } from '@/lib/cruiseDayPipeline';

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = createDateFromString(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  } catch (error) {
    console.error('[BookedCruiseStatus] Failed to parse date:', value, error);
    return null;
  }
}

function getCruiseCalendarRange(cruise: BookedCruise): { sailDate: Date; returnDate: Date } | null {
  const plan = buildCruiseDayPlan(cruise);
  if (!plan || plan.integrity === 'conflict' || plan.integrity === 'unknown') return null;
  const sailDate = startOfDate(plan.sailDate);
  const returnDate = startOfDate(plan.returnDate);
  return sailDate && returnDate ? { sailDate, returnDate } : null;
}

export function isCourtesyHoldCruise(cruise: BookedCruise): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();
  return cruise.isCourtesyHold === true || normalizedStatus === 'courtesy hold' || normalizedStatus === 'hold' || normalizedStatus === 'offer';
}

function isInactiveNonCompletedStatus(status: string): boolean {
  return ['archived', 'replaced', 'skipped', 'review needed', 'reviewneeded'].includes(status);
}

export function isCompletedBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();

  if (cruise.completionState === 'completed' || normalizedStatus === 'completed' || normalizedStatus === 'past' || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
    return true;
  }

  const range = getCruiseCalendarRange(cruise);
  return range ? range.returnDate < today : false;
}

export function isInProgressBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();
  if (isInactiveNonCompletedStatus(normalizedStatus) || isCourtesyHoldCruise(cruise) || isCompletedBookedCruise(cruise, today)) {
    return false;
  }

  if (cruise.completionState === 'in-progress') {
    return true;
  }

  const range = getCruiseCalendarRange(cruise);
  return Boolean(range && today >= range.sailDate && today <= range.returnDate);
}

export function isActiveBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();
  return !isInactiveNonCompletedStatus(normalizedStatus) && !isCourtesyHoldCruise(cruise) && !isCompletedBookedCruise(cruise, today);
}
