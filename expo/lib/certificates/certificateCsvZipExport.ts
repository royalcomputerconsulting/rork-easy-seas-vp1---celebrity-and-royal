import JSZip from 'jszip';

import { exportBase64File } from '@/lib/importExport';
import { buildLocalCertificateSailingIndex } from './certificateSailingIndex';
import { buildCertificateSummaryReport, flattenCertificateSummaryOptions, type CertificateSummaryOption } from './certificateSummary';

interface SearchableCertificateExportSource {
  certificateCode?: string;
  sourcePdfUrl?: string;
  sourceDocumentArchiveUri?: string;
  parsedSailings?: unknown[];
}

export interface CertificateCsvZipExportResult {
  fileName: string;
  certificateCount: number;
  optionRowCount: number;
  physicalSailingCount: number;
  csvFileCount: number;
  shared: boolean;
}

export interface BuiltCertificateResultsZip extends Omit<CertificateCsvZipExportResult, 'shared'> {
  base64: string;
}

export interface CertificateExportProgress {
  stage: 'indexing' | 'building_csv' | 'compressing' | 'sharing';
  percent: number;
  message: string;
}

type CertificateExportProgressCallback = (progress: CertificateExportProgress) => void;

const OPTION_HEADERS = [
  'Certificate Code', 'Certificate Type', 'Points', 'Ship', 'Ship Class', 'Sail Date',
  'Nights', 'Start Day', 'End Day', 'Departure Port', 'Region', 'Itinerary',
  'Stateroom / Cabin', 'Guests', 'GTY', 'Weekend Departure', 'Florida Departure',
  'Offer Type', 'FreePlay', 'Onboard Credit', 'Trade-In Value', 'NextCruise Bonus',
  'Benefits', 'Source Page', 'Source Group', 'Validation Status', 'PDF URL',
  'Monthly Index URL', 'Option ID',
] as const;

function csvCell(value: unknown): string {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values: readonly unknown[]): string {
  return values.map(csvCell).join(',');
}

function optionValues(option: CertificateSummaryOption): unknown[] {
  return [
    option.certificateCode, option.certificateType, option.points, option.shipName,
    option.shipClass, option.sailDate, option.nights, option.startDay, option.endDay,
    option.departurePort, option.region, option.itinerary, option.cabinLabel,
    option.guestCount, option.isGty ? 'Yes' : 'No', option.isWeekendDeparture ? 'Yes' : 'No',
    option.isFloridaDeparture ? 'Yes' : 'No', option.offerTypeLabel, option.freePlay,
    option.onBoardCredit, option.tradeInValue, option.nextCruiseBonusLabel,
    option.benefitSummary, option.sourcePage, option.sourceGroup, option.validationStatus,
    option.pdfUrl, option.monthlyIndexUrl, option.optionId,
  ];
}

function optionsCsv(options: CertificateSummaryOption[]): string {
  return `\uFEFF${[csvLine(OPTION_HEADERS), ...options.map((option) => csvLine(optionValues(option)))].join('\r\n')}\r\n`;
}

function safeFilePart(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'UNKNOWN_CERTIFICATE';
}

function dateStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export async function buildCertificateResultsZip(
  certificates: SearchableCertificateExportSource[],
  now = new Date(),
  onProgress?: CertificateExportProgressCallback,
): Promise<BuiltCertificateResultsZip> {
  onProgress?.({ stage: 'indexing', percent: 5, message: `Indexing ${certificates.length.toLocaleString()} loaded certificate records…` });
  const sailingIndex = buildLocalCertificateSailingIndex(certificates);
  const options = flattenCertificateSummaryOptions(sailingIndex);
  if (options.length === 0) {
    throw new Error('No parsed certificate sailing rows are available to export. Download and parse at least one certificate first.');
  }

  const report = buildCertificateSummaryReport(sailingIndex);
  onProgress?.({ stage: 'building_csv', percent: 15, message: `Preparing ${options.length.toLocaleString()} sailing rows…` });
  const zip = new JSZip();
  const grouped = new Map<string, CertificateSummaryOption[]>();
  options.forEach((option) => grouped.set(option.certificateCode, [...(grouped.get(option.certificateCode) ?? []), option]));

  const summaryHeaders = [
    'Certificate Code', 'Type', 'Points', '1-Guest Options', '2-Guest Options',
    'Unknown Guest Options', 'Total Option Rows', 'Physical Sailings',
    'Weekend Departures', 'Florida Departures', 'Shortest Nights', 'Longest Nights',
  ];
  const summaryCsv = `\uFEFF${[
    csvLine(summaryHeaders),
    ...report.rows.map((row) => csvLine([
      row.certificateCode, row.certificateType, row.points, row.oneGuestOptions,
      row.twoGuestOptions, row.unknownGuestOptions, row.totalOptions, row.physicalSailings,
      row.weekendDepartures, row.floridaDepartures, row.shortestNights, row.longestNights,
    ])),
  ].join('\r\n')}\r\n`;

  const classGroups = new Map<string, CertificateSummaryOption[]>();
  options.forEach((option) => {
    const shipClass = option.shipClass?.trim() || 'Class not stated';
    classGroups.set(shipClass, [...(classGroups.get(shipClass) ?? []), option]);
  });
  const shipClassSummaryCsv = `\uFEFF${[
    csvLine(['Ship Class', '1-Guest Options', '2-Guest Options', 'Unknown Guest Options', 'Total Option Rows', 'Physical Sailings']),
    ...Array.from(classGroups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([shipClass, rows]) => csvLine([
        shipClass,
        rows.filter((row) => row.guestCount === 1).length,
        rows.filter((row) => row.guestCount === 2).length,
        rows.filter((row) => row.guestCount == null).length,
        rows.length,
        new Set(rows.map((row) => `${row.shipName.toLowerCase()}__${row.sailDate}`)).size,
      ])),
  ].join('\r\n')}\r\n`;

  zip.file('certificate-summary.csv', summaryCsv);
  zip.file('certificate-ship-class-summary.csv', shipClassSummaryCsv);
  zip.file('all-certificate-sailing-options.csv', optionsCsv(options));
  Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([code, rows]) => zip.file(`certificates/${safeFilePart(code)}.csv`, optionsCsv(rows)));
  zip.file('README.txt', [
    'Easy Seas Certificate Results Export',
    `Created: ${now.toISOString()}`,
    `Certificates: ${report.certificateCount}`,
    `Eligible certificate option rows: ${report.totalOptions}`,
    `Physical ship/date sailings: ${report.physicalSailingCount}`,
    '',
    'all-certificate-sailing-options.csv preserves every parsed certificate option row.',
    'Rows are not collapsed when the same ship/date has different guest eligibility, cabin, points, or benefits.',
    'certificate-summary.csv contains one aggregate row per certificate code.',
    'certificate-ship-class-summary.csv groups every option by ship class and guest eligibility.',
    'The certificates folder contains one complete CSV per certificate code.',
  ].join('\r\n'));

  const fileName = `EasySeas_Certificate_Results_${dateStamp(now)}.zip`;
  onProgress?.({ stage: 'compressing', percent: 25, message: `Compressing ${grouped.size.toLocaleString()} certificate CSV files…` });
  const base64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }, (metadata) => {
    const percent = Math.min(95, 25 + Math.round(metadata.percent * 0.7));
    onProgress?.({
      stage: 'compressing',
      percent,
      message: metadata.currentFile
        ? `Compressing ${metadata.currentFile} · ${Math.round(metadata.percent)}%`
        : `Compressing certificate archive · ${Math.round(metadata.percent)}%`,
    });
  });
  return {
    fileName,
    certificateCount: report.certificateCount,
    optionRowCount: report.totalOptions,
    physicalSailingCount: report.physicalSailingCount,
    csvFileCount: grouped.size + 3,
    base64,
  };
}

export async function exportCertificateResultsZip(
  certificates: SearchableCertificateExportSource[],
  now = new Date(),
  onProgress?: CertificateExportProgressCallback,
): Promise<CertificateCsvZipExportResult> {
  const built = await buildCertificateResultsZip(certificates, now, onProgress);
  onProgress?.({ stage: 'sharing', percent: 98, message: 'Opening the device share sheet…' });
  const shared = await exportBase64File(built.base64, built.fileName, 'application/zip');
  const { base64: _base64, ...result } = built;
  onProgress?.({ stage: 'sharing', percent: 100, message: 'Certificate export is ready.' });
  return { ...result, shared };
}
