import type { BookedCruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';

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

export function isCourtesyHoldCruise(cruise: BookedCruise): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();
  return cruise.isCourtesyHold === true || normalizedStatus === 'courtesy hold' || normalizedStatus === 'hold' || normalizedStatus === 'offer';
}

export function isCompletedBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  const normalizedStatus = String(cruise.status ?? '').trim().toLowerCase();

  if (cruise.completionState === 'completed' || normalizedStatus === 'completed' || normalizedStatus === 'past' || normalizedStatus === 'cancelled') {
    return true;
  }

  const returnDate = startOfDate(cruise.returnDate);
  if (returnDate) {
    return returnDate < today;
  }

  const sailDate = startOfDate(cruise.sailDate);
  if (sailDate && typeof cruise.nights === 'number' && Number.isFinite(cruise.nights) && cruise.nights > 0) {
    const estimatedReturn = new Date(sailDate);
    estimatedReturn.setDate(estimatedReturn.getDate() + cruise.nights);
    estimatedReturn.setHours(0, 0, 0, 0);
    return estimatedReturn < today;
  }

  return false;
}

export function isInProgressBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  if (cruise.completionState === 'in-progress') {
    return true;
  }

  const sailDate = startOfDate(cruise.sailDate);
  const returnDate = startOfDate(cruise.returnDate);

  if (!sailDate || !returnDate) {
    return false;
  }

  return today >= sailDate && today <= returnDate;
}

export function isActiveBookedCruise(cruise: BookedCruise, today: Date = startOfToday()): boolean {
  return !isCourtesyHoldCruise(cruise) && !isCompletedBookedCruise(cruise, today);
}
