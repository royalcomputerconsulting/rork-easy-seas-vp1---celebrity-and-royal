import type { BookedCruise, FinancialSummary } from '@/types/models';
import { calculateCabinRetailValue, getCabinValueByType } from '@/mocks/bookedCruises';
import { DOLLARS_PER_POINT } from '@/types/models';

export interface FinancialValidationResult {
  isValid: boolean;
  errors: FinancialError[];
  warnings: FinancialWarning[];
  corrections: FinancialCorrection[];
  summary: FinancialValidationSummary;
}

export interface FinancialError {
  id: string;
  cruiseId: string;
  field: string;
  message: string;
  severity: 'critical' | 'error';
  currentValue: number | string | undefined;
  expectedValue?: number | string;
}

export interface FinancialWarning {
  id: string;
  cruiseId: string;
  field: string;
  message: string;
  currentValue: number | string | undefined;
  suggestedValue?: number | string;
}

export interface FinancialCorrection {
  cruiseId: string;
  field: string;
  oldValue: number | string | undefined;
  newValue: number | string;
  reason: string;
  applied: boolean;
}

export interface FinancialValidationSummary {
  totalCruisesValidated: number;
  cruisesWithErrors: number;
  cruisesWithWarnings: number;
  totalErrors: number;
  totalWarnings: number;
  totalCorrections: number;
  totalRetailValue: number;
  totalAmountPaid: number;
  totalPointsExpected: number;
  totalPointsRecorded: number;
  pointsDiscrepancy: number;
}

export function validateCruiseFinancials(cruise: BookedCruise): {
  errors: FinancialError[];
  warnings: FinancialWarning[];
  corrections: FinancialCorrection[];
} {
  const errors: FinancialError[] = [];
  const warnings: FinancialWarning[] = [];
  const corrections: FinancialCorrection[] = [];

  console.log(`[FinancialValidation] Validating cruise: ${cruise.shipName} - ${cruise.sailDate}`);

  const cabinType = cruise.cabinType || 'Balcony';
  const nights = cruise.nights || 0;
  const calculatedRetailValue = calculateCabinRetailValue(cabinType, nights);
  const cabinInfo = getCabinValueByType(cabinType);

  if (!cruise.retailValue && calculatedRetailValue > 0) {
    warnings.push({
      id: `warn_${cruise.id}_retail`,
      cruiseId: cruise.id,
      field: 'retailValue',
      message: `Missing retail value for ${cabinInfo.category} cabin`,
      currentValue: cruise.retailValue,
      suggestedValue: calculatedRetailValue,
    });

    corrections.push({
      cruiseId: cruise.id,
      field: 'retailValue',
      oldValue: cruise.retailValue,
      newValue: calculatedRetailValue,
      reason: `Calculated from ${cabinInfo.category} base rate × ${nights} nights × 2 guests`,
      applied: false,
    });
  }

  if (cruise.retailValue && Math.abs((cruise.retailValue || 0) - calculatedRetailValue) > calculatedRetailValue * 0.3) {
    warnings.push({
      id: `warn_${cruise.id}_retail_mismatch`,
      cruiseId: cruise.id,
      field: 'retailValue',
      message: `Retail value differs significantly from calculated value`,
      currentValue: cruise.retailValue,
      suggestedValue: calculatedRetailValue,
    });
  }

  if (cruise.completionState === 'completed') {
    if (cruise.earnedPoints === undefined && cruise.casinoPoints === undefined && cruise.winnings === undefined) {
      warnings.push({
        id: `warn_${cruise.id}_no_casino_data`,
        cruiseId: cruise.id,
        field: 'earnedPoints',
        message: `Completed cruise missing casino data (points earned, winnings)`,
        currentValue: undefined,
      });
    }

    if (cruise.earnedPoints !== undefined || cruise.casinoPoints !== undefined) {
      const points = cruise.earnedPoints || cruise.casinoPoints || 0;
      const expectedCoinIn = points * DOLLARS_PER_POINT;
      
      if (points > 0 && cruise.winnings === undefined) {
        warnings.push({
          id: `warn_${cruise.id}_missing_winnings`,
          cruiseId: cruise.id,
          field: 'winnings',
          message: `Points recorded but no win/loss data. Estimated coin-in: $${expectedCoinIn.toLocaleString()}`,
          currentValue: cruise.winnings,
        });
      }
    }
  }

  const amountPaid = cruise.totalPrice || cruise.price || 0;
  
  if (cruise.status === 'booked' && amountPaid === 0) {
    if (!cruise.freeOBC && !cruise.freePlay && cruise.cabinType !== 'Interior GTY') {
      warnings.push({
        id: `warn_${cruise.id}_zero_paid`,
        cruiseId: cruise.id,
        field: 'totalPrice',
        message: `Booked cruise shows $0 paid - may need verification`,
        currentValue: amountPaid,
      });
    }
  }

  if (cruise.taxes !== undefined && cruise.taxes < 0) {
    errors.push({
      id: `err_${cruise.id}_negative_taxes`,
      cruiseId: cruise.id,
      field: 'taxes',
      message: `Taxes cannot be negative`,
      severity: 'error',
      currentValue: cruise.taxes,
      expectedValue: Math.abs(cruise.taxes),
    });
  }

  if (cruise.earnedPoints !== undefined && cruise.earnedPoints < 0) {
    errors.push({
      id: `err_${cruise.id}_negative_points`,
      cruiseId: cruise.id,
      field: 'earnedPoints',
      message: `Earned points cannot be negative`,
      severity: 'error',
      currentValue: cruise.earnedPoints,
      expectedValue: 0,
    });
  }

  const retailValue = cruise.retailValue || calculatedRetailValue;
  if (amountPaid > 0 && retailValue > 0 && amountPaid > retailValue * 2) {
    warnings.push({
      id: `warn_${cruise.id}_overpaid`,
      cruiseId: cruise.id,
      field: 'totalPrice',
      message: `Amount paid ($${amountPaid.toLocaleString()}) exceeds 2x retail value ($${retailValue.toLocaleString()})`,
      currentValue: amountPaid,
      suggestedValue: retailValue,
    });
  }

  if (!cruise.bookingId && !cruise.reservationNumber) {
    warnings.push({
      id: `warn_${cruise.id}_no_booking`,
      cruiseId: cruise.id,
      field: 'bookingId',
      message: `Missing booking ID or reservation number`,
      currentValue: undefined,
    });
  }

  return { errors, warnings, corrections };
}

export function validateAllFinancials(
  bookedCruises: BookedCruise[],
  options: { autoCorrect?: boolean } = {}
): FinancialValidationResult {
  console.log(`[FinancialValidation] Validating ${bookedCruises.length} booked cruises`);

  const allErrors: FinancialError[] = [];
  const allWarnings: FinancialWarning[] = [];
  const allCorrections: FinancialCorrection[] = [];

  let cruisesWithErrors = 0;
  let cruisesWithWarnings = 0;
  let totalRetailValue = 0;
  let totalAmountPaid = 0;
  let totalPointsExpected = 0;
  let totalPointsRecorded = 0;

  for (const cruise of bookedCruises) {
    const { errors, warnings, corrections } = validateCruiseFinancials(cruise);

    if (errors.length > 0) cruisesWithErrors++;
    if (warnings.length > 0) cruisesWithWarnings++;

    allErrors.push(...errors);
    allWarnings.push(...warnings);
    allCorrections.push(...corrections);

    const cabinType = cruise.cabinType || 'Balcony';
    const nights = cruise.nights || 0;
    const calculatedRetailValue = calculateCabinRetailValue(cabinType, nights);

    totalRetailValue += cruise.retailValue || calculatedRetailValue;
    totalAmountPaid += cruise.totalPrice || cruise.price || 0;
    
    if (cruise.completionState === 'completed' && nights > 0) {
      totalPointsExpected += Math.round(nights * 500);
    }
    totalPointsRecorded += cruise.earnedPoints || cruise.casinoPoints || 0;
  }

  const pointsDiscrepancy = totalPointsRecorded - totalPointsExpected;

  const summary: FinancialValidationSummary = {
    totalCruisesValidated: bookedCruises.length,
    cruisesWithErrors,
    cruisesWithWarnings,
    totalErrors: allErrors.length,
    totalWarnings: allWarnings.length,
    totalCorrections: allCorrections.length,
    totalRetailValue,
    totalAmountPaid,
    totalPointsExpected,
    totalPointsRecorded,
    pointsDiscrepancy,
  };

  console.log(`[FinancialValidation] Validation complete:`, {
    cruises: bookedCruises.length,
    errors: allErrors.length,
    warnings: allWarnings.length,
    corrections: allCorrections.length,
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    corrections: allCorrections,
    summary,
  };
}

export function applyFinancialCorrections(
  cruise: BookedCruise,
  corrections: FinancialCorrection[]
): BookedCruise {
  const updated = { ...cruise };

  for (const correction of corrections) {
    if (correction.cruiseId !== cruise.id) continue;

    switch (correction.field) {
      case 'retailValue':
        updated.retailValue = correction.newValue as number;
        break;
      case 'totalPrice':
        updated.totalPrice = correction.newValue as number;
        break;
      case 'taxes':
        updated.taxes = correction.newValue as number;
        break;
      case 'earnedPoints':
        updated.earnedPoints = correction.newValue as number;
        break;
      case 'casinoPoints':
        updated.casinoPoints = correction.newValue as number;
        break;
    }

    correction.applied = true;
    console.log(`[FinancialValidation] Applied correction to ${cruise.id}: ${correction.field} = ${correction.newValue}`);
  }

  return updated;
}

export function calculateExpectedPoints(cruise: BookedCruise): number {
  if (cruise.winnings !== undefined) {
    const coinIn = Math.abs(cruise.winnings) * 3;
    return Math.floor(coinIn / DOLLARS_PER_POINT);
  }
  
  return Math.round((cruise.nights || 0) * 500);
}

export function validatePointsConsistency(
  recordedPoints: number,
  expectedPoints: number,
  tolerance: number = 0.2
): { isConsistent: boolean; discrepancy: number; discrepancyPercent: number } {
  const discrepancy = recordedPoints - expectedPoints;
  const discrepancyPercent = expectedPoints > 0 
    ? Math.abs(discrepancy) / expectedPoints 
    : 0;

  return {
    isConsistent: discrepancyPercent <= tolerance,
    discrepancy,
    discrepancyPercent: discrepancyPercent * 100,
  };
}

export function generateFinancialReport(validationResult: FinancialValidationResult): string {
  const { summary, errors, warnings } = validationResult;
  
  const lines: string[] = [
    '# Financial Validation Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total Cruises Validated: ${summary.totalCruisesValidated}`,
    `- Cruises with Errors: ${summary.cruisesWithErrors}`,
    `- Cruises with Warnings: ${summary.cruisesWithWarnings}`,
    '',
    '## Financial Overview',
    `- Total Retail Value: $${summary.totalRetailValue.toLocaleString()}`,
    `- Total Amount Paid: $${summary.totalAmountPaid.toLocaleString()}`,
    `- Total Savings: $${(summary.totalRetailValue - summary.totalAmountPaid).toLocaleString()}`,
    '',
    '## Points Summary',
    `- Points Recorded: ${summary.totalPointsRecorded.toLocaleString()}`,
    `- Points Expected (estimate): ${summary.totalPointsExpected.toLocaleString()}`,
    `- Discrepancy: ${summary.pointsDiscrepancy >= 0 ? '+' : ''}${summary.pointsDiscrepancy.toLocaleString()}`,
    '',
  ];

  if (errors.length > 0) {
    lines.push('## Errors');
    errors.forEach(err => {
      lines.push(`- [${err.severity.toUpperCase()}] ${err.cruiseId}: ${err.message}`);
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('## Warnings');
    warnings.forEach(warn => {
      lines.push(`- ${warn.cruiseId}: ${warn.message}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function calculatePortfolioFinancials(bookedCruises: BookedCruise[]): FinancialSummary {
  let totalDeposits = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let totalFreeplay = 0;
  let totalOBC = 0;
  let totalSavings = 0;
  let totalCasinoSpend = 0;
  let totalNonCasinoSpend = 0;
  const upcomingPayments: { cruiseId: string; amount: number; dueDate: string }[] = [];
  const categoryBreakdown: { category: string; amount: number }[] = [];

  const categoryTotals: Record<string, number> = {};

  for (const cruise of bookedCruises) {
    if (cruise.depositPaid) {
      totalDeposits += cruise.depositPaid;
      totalPaid += cruise.depositPaid;
    }

    const amountPaid = cruise.totalPrice || cruise.price || 0;
    totalPaid += amountPaid;

    if (cruise.balanceDue) {
      totalDue += cruise.balanceDue;
      if (cruise.balanceDueDate) {
        upcomingPayments.push({
          cruiseId: cruise.id,
          amount: cruise.balanceDue,
          dueDate: cruise.balanceDueDate,
        });
      }
    }

    if (cruise.freeOBC) {
      totalOBC += cruise.freeOBC;
      totalSavings += cruise.freeOBC;
    }

    if (cruise.freePlay) {
      totalFreeplay += cruise.freePlay;
    }

    const cabinType = cruise.cabinType || 'Balcony';
    const nights = cruise.nights || 0;
    const retailValue = cruise.retailValue || calculateCabinRetailValue(cabinType, nights);
    
    if (retailValue > amountPaid) {
      totalSavings += (retailValue - amountPaid);
    }

    if (cruise.winnings !== undefined) {
      if (cruise.winnings < 0) {
        totalCasinoSpend += Math.abs(cruise.winnings);
      }
    }

    const category = cruise.cabinType || 'Unknown';
    categoryTotals[category] = (categoryTotals[category] || 0) + amountPaid;
  }

  upcomingPayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  for (const [category, amount] of Object.entries(categoryTotals)) {
    categoryBreakdown.push({ category, amount });
  }
  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  totalNonCasinoSpend = totalPaid;

  return {
    totalDeposits,
    totalPaid,
    totalDue,
    upcomingPayments,
    totalFreeplay,
    totalOBC,
    totalSavings,
    totalCasinoSpend,
    totalNonCasinoSpend,
    categoryBreakdown,
  };
}
