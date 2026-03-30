import { createDateFromString, isDateInPast } from './date';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  currentValue: unknown;
  suggestedValue?: unknown;
  autoFixable: boolean;
}

export interface ValidationReport {
  isValid: boolean;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: ValidationIssue[];
  autoFixableCount: number;
}

export interface DataQualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
}

const VALID_CABIN_TYPES = ['Interior', 'Oceanview', 'Balcony', 'Suite', 'Junior Suite', 'Grand Suite', 'Owner\'s Suite', 'Royal Loft Suite'];

const KNOWN_SHIPS = [
  'Allure of the Seas', 'Anthem of the Seas', 'Brilliance of the Seas',
  'Enchantment of the Seas', 'Explorer of the Seas', 'Freedom of the Seas',
  'Grandeur of the Seas', 'Harmony of the Seas', 'Icon of the Seas',
  'Independence of the Seas', 'Jewel of the Seas', 'Liberty of the Seas',
  'Mariner of the Seas', 'Navigator of the Seas', 'Oasis of the Seas',
  'Odyssey of the Seas', 'Ovation of the Seas', 'Quantum of the Seas',
  'Radiance of the Seas', 'Rhapsody of the Seas', 'Serenade of the Seas',
  'Spectrum of the Seas', 'Symphony of the Seas', 'Utopia of the Seas',
  'Vision of the Seas', 'Voyager of the Seas', 'Wonder of the Seas',
];

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const date = createDateFromString(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

function isReasonablePrice(price: number, nights: number): boolean {
  if (price <= 0 || nights <= 0) return false;
  const pricePerNight = price / nights;
  return pricePerNight >= 50 && pricePerNight <= 10000;
}

function isReasonableNights(nights: number): boolean {
  return nights >= 1 && nights <= 365;
}

function isValidBookingId(id: string): boolean {
  if (!id) return false;
  return id.length >= 6 && /^[A-Z0-9-]+$/i.test(id);
}

export function validateCruise(cruise: Cruise): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!cruise.id) {
    issues.push({
      field: 'id',
      message: 'Missing cruise ID',
      severity: 'error',
      currentValue: cruise.id,
      autoFixable: true,
    });
  }

  if (!cruise.shipName) {
    issues.push({
      field: 'shipName',
      message: 'Missing ship name',
      severity: 'error',
      currentValue: cruise.shipName,
      autoFixable: false,
    });
  } else if (!KNOWN_SHIPS.includes(cruise.shipName)) {
    issues.push({
      field: 'shipName',
      message: `Unknown ship name: ${cruise.shipName}`,
      severity: 'warning',
      currentValue: cruise.shipName,
      autoFixable: true,
    });
  }

  if (!cruise.sailDate) {
    issues.push({
      field: 'sailDate',
      message: 'Missing sail date',
      severity: 'error',
      currentValue: cruise.sailDate,
      autoFixable: false,
    });
  } else if (!isValidDate(cruise.sailDate)) {
    issues.push({
      field: 'sailDate',
      message: `Invalid sail date format: ${cruise.sailDate}`,
      severity: 'error',
      currentValue: cruise.sailDate,
      autoFixable: true,
    });
  }

  if (cruise.returnDate && !isValidDate(cruise.returnDate)) {
    issues.push({
      field: 'returnDate',
      message: `Invalid return date format: ${cruise.returnDate}`,
      severity: 'error',
      currentValue: cruise.returnDate,
      autoFixable: true,
    });
  }

  if (cruise.sailDate && cruise.returnDate) {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    if (returnDate <= sailDate) {
      issues.push({
        field: 'returnDate',
        message: 'Return date must be after sail date',
        severity: 'error',
        currentValue: cruise.returnDate,
        autoFixable: true,
      });
    }
  }

  if (!cruise.nights && cruise.nights !== 0) {
    issues.push({
      field: 'nights',
      message: 'Missing nights count',
      severity: 'warning',
      currentValue: cruise.nights,
      autoFixable: true,
    });
  } else if (!isReasonableNights(cruise.nights)) {
    issues.push({
      field: 'nights',
      message: `Unreasonable nights value: ${cruise.nights}`,
      severity: 'warning',
      currentValue: cruise.nights,
      autoFixable: false,
    });
  }

  if (cruise.sailDate && cruise.returnDate && cruise.nights) {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    const calculatedNights = Math.round((returnDate.getTime() - sailDate.getTime()) / (1000 * 60 * 60 * 24));
    if (Math.abs(calculatedNights - cruise.nights) > 1) {
      issues.push({
        field: 'nights',
        message: `Nights (${cruise.nights}) doesn't match date range (${calculatedNights})`,
        severity: 'warning',
        currentValue: cruise.nights,
        suggestedValue: calculatedNights,
        autoFixable: true,
      });
    }
  }

  if (!cruise.departurePort) {
    issues.push({
      field: 'departurePort',
      message: 'Missing departure port',
      severity: 'warning',
      currentValue: cruise.departurePort,
      autoFixable: false,
    });
  }

  if (!cruise.destination && !cruise.itineraryName) {
    issues.push({
      field: 'destination',
      message: 'Missing destination or itinerary name',
      severity: 'info',
      currentValue: cruise.destination,
      autoFixable: false,
    });
  }

  if (cruise.price !== undefined && cruise.price !== null && cruise.price > 0) {
    if (cruise.nights && !isReasonablePrice(cruise.price, cruise.nights)) {
      issues.push({
        field: 'price',
        message: `Price ($${cruise.price}) seems unreasonable for ${cruise.nights} nights`,
        severity: 'warning',
        currentValue: cruise.price,
        autoFixable: false,
      });
    }
  }

  if (cruise.cabinType && !VALID_CABIN_TYPES.includes(cruise.cabinType)) {
    issues.push({
      field: 'cabinType',
      message: `Unknown cabin type: ${cruise.cabinType}`,
      severity: 'info',
      currentValue: cruise.cabinType,
      autoFixable: true,
    });
  }

  return buildReport(issues);
}

export function validateBookedCruise(cruise: BookedCruise): ValidationReport {
  const baseReport = validateCruise(cruise as Cruise);
  const issues = [...baseReport.issues];

  if (!cruise.bookingId && !cruise.id) {
    issues.push({
      field: 'bookingId',
      message: 'Missing booking ID',
      severity: 'warning',
      currentValue: cruise.bookingId,
      autoFixable: true,
    });
  } else if (cruise.bookingId && !isValidBookingId(cruise.bookingId)) {
    issues.push({
      field: 'bookingId',
      message: `Invalid booking ID format: ${cruise.bookingId}`,
      severity: 'info',
      currentValue: cruise.bookingId,
      autoFixable: false,
    });
  }

  if (cruise.totalPrice !== undefined && cruise.totalPrice < 0) {
    issues.push({
      field: 'totalPrice',
      message: 'Total price cannot be negative',
      severity: 'error',
      currentValue: cruise.totalPrice,
      autoFixable: true,
    });
  }

  if (cruise.retailValue !== undefined && cruise.totalPrice !== undefined) {
    if (cruise.retailValue < cruise.totalPrice) {
      issues.push({
        field: 'retailValue',
        message: 'Retail value should not be less than total price paid',
        severity: 'warning',
        currentValue: cruise.retailValue,
        autoFixable: false,
      });
    }
  }

  if (cruise.earnedPoints !== undefined && cruise.earnedPoints < 0) {
    issues.push({
      field: 'earnedPoints',
      message: 'Earned points cannot be negative',
      severity: 'error',
      currentValue: cruise.earnedPoints,
      autoFixable: true,
    });
  }

  if (cruise.winnings !== undefined) {
    const absValue = Math.abs(cruise.winnings);
    if (absValue > 100000) {
      issues.push({
        field: 'winnings',
        message: `Winnings value (${cruise.winnings}) seems unusually high`,
        severity: 'warning',
        currentValue: cruise.winnings,
        autoFixable: false,
      });
    }
  }

  if (cruise.sailDate && isDateInPast(cruise.sailDate)) {
    if (!cruise.status || cruise.completionState === 'upcoming') {
      issues.push({
        field: 'status',
        message: 'Past cruise should not have "upcoming" status',
        severity: 'warning',
        currentValue: cruise.status,
        suggestedValue: 'completed',
        autoFixable: true,
      });
    }
  }

  return buildReport(issues);
}

export function validateOffer(offer: CasinoOffer): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!offer.id && !offer.offerCode) {
    issues.push({
      field: 'id',
      message: 'Missing offer ID or code',
      severity: 'error',
      currentValue: offer.id,
      autoFixable: true,
    });
  }

  if (offer.expiryDate && !isValidDate(offer.expiryDate)) {
    issues.push({
      field: 'expiryDate',
      message: `Invalid expiry date: ${offer.expiryDate}`,
      severity: 'error',
      currentValue: offer.expiryDate,
      autoFixable: true,
    });
  }

  if (offer.expiryDate && isDateInPast(offer.expiryDate)) {
    issues.push({
      field: 'expiryDate',
      message: 'Offer has expired',
      severity: 'info',
      currentValue: offer.expiryDate,
      autoFixable: false,
    });
  }

  if (offer.value !== undefined && offer.value < 0) {
    issues.push({
      field: 'value',
      message: 'Offer value cannot be negative',
      severity: 'error',
      currentValue: offer.value,
      autoFixable: true,
    });
  }

  return buildReport(issues);
}

function buildReport(issues: ValidationIssue[]): ValidationReport {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  const autoFixableCount = issues.filter(i => i.autoFixable).length;

  return {
    isValid: errors === 0,
    totalIssues: issues.length,
    errors,
    warnings,
    infos,
    issues,
    autoFixableCount,
  };
}

export function validateDataset(
  cruises: Cruise[],
  bookedCruises: BookedCruise[],
  offers: CasinoOffer[]
): {
  cruiseReports: Map<string, ValidationReport>;
  bookedReports: Map<string, ValidationReport>;
  offerReports: Map<string, ValidationReport>;
  summary: {
    totalRecords: number;
    validRecords: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
    autoFixable: number;
  };
} {
  const cruiseReports = new Map<string, ValidationReport>();
  const bookedReports = new Map<string, ValidationReport>();
  const offerReports = new Map<string, ValidationReport>();

  let totalIssues = 0;
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let autoFixable = 0;
  let validRecords = 0;

  cruises.forEach(cruise => {
    const report = validateCruise(cruise);
    cruiseReports.set(cruise.id, report);
    totalIssues += report.totalIssues;
    errors += report.errors;
    warnings += report.warnings;
    infos += report.infos;
    autoFixable += report.autoFixableCount;
    if (report.isValid) validRecords++;
  });

  bookedCruises.forEach(cruise => {
    const report = validateBookedCruise(cruise);
    bookedReports.set(cruise.id, report);
    totalIssues += report.totalIssues;
    errors += report.errors;
    warnings += report.warnings;
    infos += report.infos;
    autoFixable += report.autoFixableCount;
    if (report.isValid) validRecords++;
  });

  offers.forEach(offer => {
    const report = validateOffer(offer);
    offerReports.set(offer.id, report);
    totalIssues += report.totalIssues;
    errors += report.errors;
    warnings += report.warnings;
    infos += report.infos;
    autoFixable += report.autoFixableCount;
    if (report.isValid) validRecords++;
  });

  const totalRecords = cruises.length + bookedCruises.length + offers.length;

  return {
    cruiseReports,
    bookedReports,
    offerReports,
    summary: {
      totalRecords,
      validRecords,
      totalIssues,
      errors,
      warnings,
      infos,
      autoFixable,
    },
  };
}

export function calculateDataQuality(
  cruises: Cruise[],
  bookedCruises: BookedCruise[]
): DataQualityScore {
  if (cruises.length === 0 && bookedCruises.length === 0) {
    return { overall: 0, completeness: 0, accuracy: 0, consistency: 0, timeliness: 0 };
  }

  const allCruises = [...cruises, ...bookedCruises];
  const total = allCruises.length;

  let completenessScore = 0;
  let accuracyScore = 0;
  let consistencyScore = 0;
  let timelinessScore = 0;

  allCruises.forEach(cruise => {
    let fields = 0;
    let filledFields = 0;

    const requiredFields = ['shipName', 'sailDate', 'nights', 'departurePort'] as const;
    requiredFields.forEach(field => {
      fields++;
      if (cruise[field]) filledFields++;
    });
    completenessScore += (filledFields / fields) * 100;

    let accuracyPoints = 100;
    if (cruise.shipName && !KNOWN_SHIPS.includes(cruise.shipName)) accuracyPoints -= 20;
    if (cruise.sailDate && !isValidDate(cruise.sailDate)) accuracyPoints -= 30;
    if (cruise.nights && !isReasonableNights(cruise.nights)) accuracyPoints -= 20;
    accuracyScore += Math.max(0, accuracyPoints);

    let consistencyPoints = 100;
    if (cruise.sailDate && cruise.returnDate && cruise.nights) {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      const calculatedNights = Math.round((returnDate.getTime() - sailDate.getTime()) / (1000 * 60 * 60 * 24));
      if (Math.abs(calculatedNights - cruise.nights) > 1) {
        consistencyPoints -= 30;
      }
    }
    consistencyScore += Math.max(0, consistencyPoints);

    let timelinessPoints = 100;
    if (cruise.sailDate && isDateInPast(cruise.sailDate)) {
      const pastDays = Math.abs((new Date().getTime() - createDateFromString(cruise.sailDate).getTime()) / (1000 * 60 * 60 * 24));
      if (pastDays > 365) timelinessPoints = 50;
      else if (pastDays > 180) timelinessPoints = 70;
      else if (pastDays > 90) timelinessPoints = 85;
    }
    timelinessScore += timelinessPoints;
  });

  const completeness = total > 0 ? completenessScore / total : 0;
  const accuracy = total > 0 ? accuracyScore / total : 0;
  const consistency = total > 0 ? consistencyScore / total : 0;
  const timeliness = total > 0 ? timelinessScore / total : 0;
  const overall = (completeness + accuracy + consistency + timeliness) / 4;

  return {
    overall: Math.round(overall),
    completeness: Math.round(completeness),
    accuracy: Math.round(accuracy),
    consistency: Math.round(consistency),
    timeliness: Math.round(timeliness),
  };
}
