import type { BookedCruise, Cruise } from '@/types/models';
import { createDateFromString, getDaysUntil } from '@/lib/date';

export type LifecycleState = 'upcoming' | 'in-progress' | 'completed';

export interface LifecycleUpdateResult {
  cruiseId: string;
  previousState: LifecycleState;
  newState: LifecycleState;
  reason: string;
  updated: boolean;
}

export interface BookingValidationResult {
  isValid: boolean;
  cruiseId: string;
  bookingId: string | undefined;
  reservationNumber: string | undefined;
  issues: BookingIssue[];
}

export interface BookingIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  suggestedAction?: string;
}

export interface LifecycleReport {
  totalCruises: number;
  upcomingCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  updates: LifecycleUpdateResult[];
  validationResults: BookingValidationResult[];
  overdueCruises: BookedCruise[];
  needsAttention: BookedCruise[];
}

export function determineLifecycleState(cruise: BookedCruise | Cruise): LifecycleState {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const sailDate = createDateFromString(cruise.sailDate);
  const returnDate = cruise.returnDate 
    ? createDateFromString(cruise.returnDate) 
    : new Date(sailDate.getTime() + (cruise.nights || 0) * 24 * 60 * 60 * 1000);

  if (cruise.status === 'cancelled') {
    return 'completed';
  }

  const sailDay = new Date(sailDate.getFullYear(), sailDate.getMonth(), sailDate.getDate());
  const returnDay = new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate());

  if (today >= sailDay && today <= returnDay) {
    return 'in-progress';
  }

  if (today > returnDay) {
    return 'completed';
  }

  if (today < sailDay) {
    return 'upcoming';
  }

  return 'upcoming';
}

export function updateCruiseLifecycle(cruise: BookedCruise): LifecycleUpdateResult {
  const previousState = cruise.completionState || 'unknown';
  const newState = determineLifecycleState(cruise);

  const updated = previousState !== newState;
  
  let reason = '';
  if (updated) {
    switch (newState) {
      case 'upcoming':
        reason = `Cruise departs ${getDaysUntil(cruise.sailDate)} days from now`;
        break;
      case 'in-progress':
        reason = 'Cruise is currently active';
        break;
      case 'completed':
        reason = `Cruise ended on ${cruise.returnDate}`;
        break;
      default:
        reason = 'Status determined based on dates';
    }
  }

  console.log(`[LifecycleManager] Cruise ${cruise.id}: ${previousState} → ${newState} (${updated ? 'CHANGED' : 'unchanged'})`);

  return {
    cruiseId: cruise.id,
    previousState: previousState as LifecycleState,
    newState,
    reason,
    updated,
  };
}

export function applyCruiseLifecycleUpdate(cruise: BookedCruise): BookedCruise {
  const result = updateCruiseLifecycle(cruise);
  
  if (result.updated) {
    return {
      ...cruise,
      completionState: result.newState,
      status: result.newState === 'completed' ? 'completed' : cruise.status,
    };
  }

  return cruise;
}

export function validateBookingId(cruise: BookedCruise): BookingValidationResult {
  const issues: BookingIssue[] = [];
  const bookingId = cruise.bookingId;
  const reservationNumber = cruise.reservationNumber;

  if (!bookingId && !reservationNumber) {
    issues.push({
      type: 'error',
      field: 'bookingId',
      message: 'Missing both booking ID and reservation number',
      suggestedAction: 'Add booking ID or reservation number from Royal Caribbean confirmation',
    });
  }

  if (bookingId && !/^\d{5,10}$/.test(bookingId)) {
    issues.push({
      type: 'warning',
      field: 'bookingId',
      message: `Booking ID "${bookingId}" may not be in expected format (5-10 digits)`,
      suggestedAction: 'Verify booking ID matches Royal Caribbean confirmation',
    });
  }

  if (reservationNumber && reservationNumber !== bookingId && !/^\d{5,10}$/.test(reservationNumber)) {
    issues.push({
      type: 'warning',
      field: 'reservationNumber',
      message: `Reservation number "${reservationNumber}" may not be in expected format`,
      suggestedAction: 'Verify reservation number matches Royal Caribbean confirmation',
    });
  }

  if (cruise.status === 'booked' && !cruise.cabinNumber) {
    const daysUntil = getDaysUntil(cruise.sailDate);
    if (daysUntil > 0 && daysUntil < 30) {
      issues.push({
        type: 'warning',
        field: 'cabinNumber',
        message: `Cruise departs in ${daysUntil} days but cabin number not assigned`,
        suggestedAction: 'Check assignment status with Royal Caribbean or try online check-in',
      });
    }
  }

  if (!cruise.guestNames || cruise.guestNames.length === 0) {
    issues.push({
      type: 'warning',
      field: 'guestNames',
      message: 'No guest names recorded',
      suggestedAction: 'Add guest names for better tracking',
    });
  }

  console.log(`[LifecycleManager] Validated booking ${cruise.id}: ${issues.length} issues found`);

  return {
    isValid: issues.filter(i => i.type === 'error').length === 0,
    cruiseId: cruise.id,
    bookingId,
    reservationNumber,
    issues,
  };
}

export function updateAllCruiseLifecycles(cruises: BookedCruise[]): {
  updatedCruises: BookedCruise[];
  report: LifecycleReport;
} {
  console.log(`[LifecycleManager] Updating lifecycle for ${cruises.length} cruises`);

  const updates: LifecycleUpdateResult[] = [];
  const validationResults: BookingValidationResult[] = [];
  const updatedCruises: BookedCruise[] = [];
  const overdueCruises: BookedCruise[] = [];
  const needsAttention: BookedCruise[] = [];

  let upcomingCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  const cancelledCount = cruises.filter(c => c.status === 'cancelled').length;

  for (const cruise of cruises) {
    const lifecycleResult = updateCruiseLifecycle(cruise);
    updates.push(lifecycleResult);

    const bookingValidation = validateBookingId(cruise);
    validationResults.push(bookingValidation);

    const updatedCruise = applyCruiseLifecycleUpdate(cruise);
    updatedCruises.push(updatedCruise);

    switch (lifecycleResult.newState) {
      case 'upcoming':
        upcomingCount++;
        break;
      case 'in-progress':
        inProgressCount++;
        break;
      case 'completed':
        completedCount++;
        break;

    }

    if (lifecycleResult.newState === 'completed') {
      if (!updatedCruise.earnedPoints && !updatedCruise.casinoPoints && !updatedCruise.winnings) {
        needsAttention.push(updatedCruise);
      }
    }

    if (lifecycleResult.newState === 'upcoming') {
      const daysUntil = getDaysUntil(cruise.sailDate);
      if (daysUntil <= 7 && !cruise.cabinNumber) {
        needsAttention.push(updatedCruise);
      }
    }

    if (!bookingValidation.isValid) {
      if (!needsAttention.find(c => c.id === cruise.id)) {
        needsAttention.push(updatedCruise);
      }
    }
  }

  const report: LifecycleReport = {
    totalCruises: cruises.length,
    upcomingCount,
    inProgressCount,
    completedCount,
    cancelledCount,
    updates,
    validationResults,
    overdueCruises,
    needsAttention,
  };

  console.log(`[LifecycleManager] Update complete:`, {
    total: cruises.length,
    upcoming: upcomingCount,
    inProgress: inProgressCount,
    completed: completedCount,
    cancelled: cancelledCount,
    needsAttention: needsAttention.length,
  });

  return { updatedCruises, report };
}

export function findDuplicateBookings(cruises: BookedCruise[]): BookedCruise[][] {
  const duplicates: BookedCruise[][] = [];
  const bookingMap = new Map<string, BookedCruise[]>();

  for (const cruise of cruises) {
    const bookingId = cruise.bookingId || cruise.reservationNumber;
    if (!bookingId) continue;

    const existing = bookingMap.get(bookingId) || [];
    existing.push(cruise);
    bookingMap.set(bookingId, existing);
  }

  for (const [bookingId, bookings] of bookingMap.entries()) {
    if (bookings.length > 1) {
      console.log(`[LifecycleManager] Found duplicate booking ID ${bookingId}: ${bookings.length} entries`);
      duplicates.push(bookings);
    }
  }

  return duplicates;
}

export function findOverlappingCruises(cruises: BookedCruise[]): BookedCruise[][] {
  const overlaps: BookedCruise[][] = [];
  const sortedCruises = [...cruises]
    .filter(c => c.status !== 'cancelled')
    .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());

  for (let i = 0; i < sortedCruises.length; i++) {
    for (let j = i + 1; j < sortedCruises.length; j++) {
      const cruiseA = sortedCruises[i];
      const cruiseB = sortedCruises[j];

      const aStart = createDateFromString(cruiseA.sailDate);
      const aEnd = cruiseA.returnDate 
        ? createDateFromString(cruiseA.returnDate)
        : new Date(aStart.getTime() + (cruiseA.nights || 0) * 24 * 60 * 60 * 1000);

      const bStart = createDateFromString(cruiseB.sailDate);
      const bEnd = cruiseB.returnDate
        ? createDateFromString(cruiseB.returnDate)
        : new Date(bStart.getTime() + (cruiseB.nights || 0) * 24 * 60 * 60 * 1000);

      if (aStart <= bEnd && bStart <= aEnd) {
        console.log(`[LifecycleManager] Found overlapping cruises: ${cruiseA.id} and ${cruiseB.id}`);
        overlaps.push([cruiseA, cruiseB]);
      }
    }
  }

  return overlaps;
}

export function generateLifecycleReport(report: LifecycleReport): string {
  const lines: string[] = [
    '# Cruise Lifecycle Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total Cruises: ${report.totalCruises}`,
    `- Upcoming: ${report.upcomingCount}`,
    `- In Progress: ${report.inProgressCount}`,
    `- Completed: ${report.completedCount}`,
    `- Cancelled: ${report.cancelledCount}`,
    '',
  ];

  const stateChanges = report.updates.filter(u => u.updated);
  if (stateChanges.length > 0) {
    lines.push('## State Changes');
    stateChanges.forEach(update => {
      lines.push(`- ${update.cruiseId}: ${update.previousState} → ${update.newState} (${update.reason})`);
    });
    lines.push('');
  }

  const invalidBookings = report.validationResults.filter(v => !v.isValid);
  if (invalidBookings.length > 0) {
    lines.push('## Booking Validation Issues');
    invalidBookings.forEach(validation => {
      lines.push(`### ${validation.cruiseId}`);
      validation.issues.forEach(issue => {
        lines.push(`- [${issue.type.toUpperCase()}] ${issue.field}: ${issue.message}`);
        if (issue.suggestedAction) {
          lines.push(`  → ${issue.suggestedAction}`);
        }
      });
    });
    lines.push('');
  }

  if (report.needsAttention.length > 0) {
    lines.push('## Cruises Needing Attention');
    report.needsAttention.forEach(cruise => {
      lines.push(`- ${cruise.shipName} (${cruise.sailDate}) - ${cruise.completionState}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function getCruisesByStatus(cruises: BookedCruise[]): {
  upcoming: BookedCruise[];
  inProgress: BookedCruise[];
  completed: BookedCruise[];
  cancelled: BookedCruise[];
} {
  const result = {
    upcoming: [] as BookedCruise[],
    inProgress: [] as BookedCruise[],
    completed: [] as BookedCruise[],
    cancelled: [] as BookedCruise[],
  };

  for (const cruise of cruises) {
    const state = determineLifecycleState(cruise);
    
    if (cruise.status === 'cancelled') {
      result.cancelled.push(cruise);
    } else {
      switch (state) {
        case 'upcoming':
          result.upcoming.push(cruise);
          break;
        case 'in-progress':
          result.inProgress.push(cruise);
          break;
        case 'completed':
          result.completed.push(cruise);
          break;
      }
    }
  }

  result.upcoming.sort((a, b) => 
    createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime()
  );
  
  result.completed.sort((a, b) => 
    createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime()
  );

  return result;
}
