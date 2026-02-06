import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { 
  Cruise, 
  CasinoOffer, 
  BookedCruise, 
  CalendarEvent, 
  ClubRoyaleProfile,
  AnalyticsData,
} from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import { 
  generateOffersCSV, 
  generateCalendarICS,
} from './importExport';
import { generateFinancialReport } from './financialValidation';
import type { FinancialValidationResult } from './financialValidation';
import { generateLifecycleReport } from './lifecycleManager';
import type { LifecycleReport } from './lifecycleManager';

export interface ExportData {
  cruises: Cruise[];
  offers: CasinoOffer[];
  bookedCruises: BookedCruise[];
  calendarEvents: CalendarEvent[];
  casinoSessions?: CasinoSession[];
  profile?: ClubRoyaleProfile;
  analytics?: AnalyticsData;
  financialValidation?: FinancialValidationResult;
  lifecycleReport?: LifecycleReport;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  fileType: string;
  fileSize?: number;
  error?: string;
}

export interface BundleExportResult {
  success: boolean;
  files: ExportResult[];
  totalFiles: number;
  successfulFiles: number;
  errors: string[];
}

function escapeCSVField(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch {
    return dateStr;
  }
}

export function generateDetailedBookedCSV(bookedCruises: BookedCruise[]): string {
  const filteredCruises = bookedCruises.filter(c => c.status !== 'available');
  const headers = [
    'ID',
    'Ship Name',
    'Sail Date',
    'Return Date',
    'Nights',
    'Departure Port',
    'Destination',
    'Itinerary Name',
    'Cabin Type',
    'Cabin Number',
    'Deck',
    'Booking ID',
    'Reservation Number',
    'Guest Names',
    'Guest Count',
    'Status',
    'Completion State',
    'Retail Value',
    'Total Price',
    'Amount Paid',
    'Taxes',
    'Deposit Paid',
    'Balance Due',
    'Balance Due Date',
    'Free OBC',
    'Free Play',
    'Earned Points',
    'Winnings',
    'Offer Code',
    'Casino Open Days',
    'Sea Days',
    'Port Days',
    'Ports',
    'Created At',
  ];

  const rows: string[] = [headers.join(',')];

  for (const cruise of filteredCruises) {
    const row = [
      escapeCSVField(cruise.id || ''),
      escapeCSVField(cruise.shipName || ''),
      formatDateMMDDYYYY(cruise.sailDate || ''),
      formatDateMMDDYYYY(cruise.returnDate || ''),
      (cruise.nights || 0).toString(),
      escapeCSVField(cruise.departurePort || ''),
      escapeCSVField(cruise.destination || ''),
      escapeCSVField(cruise.itineraryName || ''),
      escapeCSVField(cruise.cabinType || ''),
      escapeCSVField(cruise.cabinNumber || ''),
      escapeCSVField(cruise.deckNumber || ''),
      escapeCSVField(cruise.bookingId || ''),
      escapeCSVField(cruise.reservationNumber || ''),
      escapeCSVField(cruise.guestNames?.join(', ') || ''),
      (cruise.guests || 1).toString(),
      escapeCSVField(cruise.status || ''),
      escapeCSVField(cruise.completionState || ''),
      (cruise.retailValue || 0).toString(),
      (cruise.totalPrice || 0).toString(),
      (cruise.price || 0).toString(),
      (cruise.taxes || 0).toString(),
      (cruise.depositPaid || 0).toString(),
      (cruise.balanceDue || 0).toString(),
      formatDateMMDDYYYY(cruise.balanceDueDate || ''),
      (cruise.freeOBC || 0).toString(),
      (cruise.freePlay || 0).toString(),
      (cruise.earnedPoints || cruise.casinoPoints || 0).toString(),
      (cruise.winnings || 0).toString(),
      escapeCSVField(cruise.offerCode || ''),
      (cruise.casinoOpenDays || 0).toString(),
      (cruise.seaDays || 0).toString(),
      (cruise.portDays || 0).toString(),
      escapeCSVField(cruise.ports?.join(' → ') || ''),
      formatDateMMDDYYYY(cruise.createdAt || ''),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export function generateAnalyticsJSON(
  analytics: AnalyticsData | undefined,
  profile: ClubRoyaleProfile | undefined
): string {
  const data = {
    exportDate: new Date().toISOString(),
    profile: profile ? {
      memberName: profile.memberName,
      memberId: profile.memberId,
      tier: profile.tier,
      tierPoints: profile.tierPoints,
      totalPoints: profile.totalPoints,
      lifetimeCruises: profile.lifetimeCruises,
      lifetimeNights: profile.lifetimeNights,
      crownAnchorLevel: profile.crownAnchorLevel,
      loyaltyPoints: profile.loyaltyPoints,
    } : null,
    analytics: analytics ? {
      totalSpent: analytics.totalSpent,
      totalSaved: analytics.totalSaved,
      totalCruises: analytics.totalCruises,
      totalNights: analytics.totalNights,
      totalPoints: analytics.totalPoints,
      portfolioROI: analytics.portfolioROI,
      averagePricePerNight: analytics.averagePricePerNight,
      favoriteShip: analytics.favoriteShip,
      favoriteDestination: analytics.favoriteDestination,
      cabinTypeDistribution: analytics.cabinTypeDistribution,
      destinationDistribution: analytics.destinationDistribution,
    } : null,
  };

  return JSON.stringify(data, null, 2);
}

export function generateFullDataJSON(exportData: ExportData): string {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    counts: {
      cruises: exportData.cruises.length,
      offers: exportData.offers.length,
      bookedCruises: exportData.bookedCruises.length,
      calendarEvents: exportData.calendarEvents.length,
      casinoSessions: exportData.casinoSessions?.length || 0,
    },
    profile: exportData.profile,
    cruises: exportData.cruises,
    offers: exportData.offers,
    bookedCruises: exportData.bookedCruises,
    calendarEvents: exportData.calendarEvents,
    casinoSessions: exportData.casinoSessions,
    analytics: exportData.analytics,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportSingleFile(
  content: string,
  fileName: string,
  mimeType: string
): Promise<ExportResult> {
  try {
    console.log(`[ExportBundle] Exporting file: ${fileName}`);

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        fileName,
        fileType: mimeType,
        fileSize: content.length,
      };
    }

    const file = new File(Paths.cache, fileName);
    await file.write(content);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType,
        dialogTitle: `Export ${fileName}`,
      });
    }

    return {
      success: true,
      fileName,
      fileType: mimeType,
      fileSize: content.length,
    };
  } catch (error) {
    console.error(`[ExportBundle] Error exporting ${fileName}:`, error);
    return {
      success: false,
      fileName,
      fileType: mimeType,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function exportDataBundle(
  exportData: ExportData,
  options: {
    includeCSV?: boolean;
    includeICS?: boolean;
    includeJSON?: boolean;
    includeReports?: boolean;
  } = {}
): Promise<BundleExportResult> {
  const {
    includeCSV = true,
    includeICS = true,
    includeJSON = true,
    includeReports = true,
  } = options;

  const results: ExportResult[] = [];
  const errors: string[] = [];
  const timestamp = new Date().toISOString().split('T')[0];

  console.log('[ExportBundle] Starting data bundle export');

  if (includeCSV && exportData.cruises.length > 0) {
    const offersCSV = generateOffersCSV(exportData.cruises, exportData.offers);
    const result = await exportSingleFile(
      offersCSV,
      `easyseas_offers_${timestamp}.csv`,
      'text/csv'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeCSV && exportData.bookedCruises.length > 0) {
    const bookedCSV = generateDetailedBookedCSV(exportData.bookedCruises);
    const result = await exportSingleFile(
      bookedCSV,
      `easyseas_booked_detailed_${timestamp}.csv`,
      'text/csv'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeICS && exportData.calendarEvents.length > 0) {
    const icsContent = generateCalendarICS(exportData.calendarEvents);
    const result = await exportSingleFile(
      icsContent,
      `easyseas_calendar_${timestamp}.ics`,
      'text/calendar'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeJSON) {
    const analyticsJSON = generateAnalyticsJSON(exportData.analytics, exportData.profile);
    const result = await exportSingleFile(
      analyticsJSON,
      `easyseas_analytics_${timestamp}.json`,
      'application/json'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeJSON) {
    const fullDataJSON = generateFullDataJSON(exportData);
    const result = await exportSingleFile(
      fullDataJSON,
      `easyseas_full_data_${timestamp}.json`,
      'application/json'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeReports && exportData.financialValidation) {
    const financialReport = generateFinancialReport(exportData.financialValidation);
    const result = await exportSingleFile(
      financialReport,
      `easyseas_financial_report_${timestamp}.txt`,
      'text/plain'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  if (includeReports && exportData.lifecycleReport) {
    const lifecycleReport = generateLifecycleReport(exportData.lifecycleReport);
    const result = await exportSingleFile(
      lifecycleReport,
      `easyseas_lifecycle_report_${timestamp}.txt`,
      'text/plain'
    );
    results.push(result);
    if (!result.success && result.error) errors.push(result.error);
  }

  const successfulFiles = results.filter(r => r.success).length;

  console.log('[ExportBundle] Bundle export complete:', {
    totalFiles: results.length,
    successfulFiles,
    errors: errors.length,
  });

  return {
    success: successfulFiles > 0,
    files: results,
    totalFiles: results.length,
    successfulFiles,
    errors,
  };
}

export function generateExportSummary(result: BundleExportResult): string {
  const lines: string[] = [
    '# Export Summary',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Results',
    `- Total Files: ${result.totalFiles}`,
    `- Successful: ${result.successfulFiles}`,
    `- Failed: ${result.totalFiles - result.successfulFiles}`,
    '',
    '## Files',
  ];

  result.files.forEach(file => {
    const status = file.success ? '✓' : '✗';
    const size = file.fileSize ? ` (${Math.round(file.fileSize / 1024)}KB)` : '';
    lines.push(`${status} ${file.fileName}${size}`);
    if (file.error) {
      lines.push(`  Error: ${file.error}`);
    }
  });

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    result.errors.forEach(error => {
      lines.push(`- ${error}`);
    });
  }

  return lines.join('\n');
}

export function calculateDataSize(exportData: ExportData): {
  totalRecords: number;
  estimatedSize: string;
  breakdown: { type: string; count: number; estimatedKB: number }[];
} {
  const breakdown = [
    { type: 'Cruises', count: exportData.cruises.length, estimatedKB: Math.round(exportData.cruises.length * 0.5) },
    { type: 'Offers', count: exportData.offers.length, estimatedKB: Math.round(exportData.offers.length * 0.4) },
    { type: 'Booked Cruises', count: exportData.bookedCruises.length, estimatedKB: Math.round(exportData.bookedCruises.length * 1) },
    { type: 'Calendar Events', count: exportData.calendarEvents.length, estimatedKB: Math.round(exportData.calendarEvents.length * 0.3) },
    { type: 'Casino Sessions', count: exportData.casinoSessions?.length || 0, estimatedKB: Math.round((exportData.casinoSessions?.length || 0) * 0.5) },
  ];

  const totalRecords = breakdown.reduce((sum, item) => sum + item.count, 0);
  const totalKB = breakdown.reduce((sum, item) => sum + item.estimatedKB, 0);

  let estimatedSize: string;
  if (totalKB < 1024) {
    estimatedSize = `${totalKB} KB`;
  } else {
    estimatedSize = `${(totalKB / 1024).toFixed(1)} MB`;
  }

  return {
    totalRecords,
    estimatedSize,
    breakdown,
  };
}

export async function exportQuickBackup(exportData: ExportData): Promise<ExportResult> {
  const fullJSON = generateFullDataJSON(exportData);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return exportSingleFile(
    fullJSON,
    `easyseas_backup_${timestamp}.json`,
    'application/json'
  );
}
