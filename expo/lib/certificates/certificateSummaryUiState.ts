import type { CertificateSummaryFilter, CertificateSummarySort } from './certificateSummary';
export type CertificateSummaryViewMode = 'options' | 'certificate_codes' | 'physical_sailings';
export interface CertificateSummaryUiState { target: 'thisMonth' | 'nextMonth'; tab: 'summary' | 'matrix' | 'sailings' | 'quality'; matrixDimension: 'class' | 'ship' | 'cabin' | 'port' | 'region' | 'month' | 'duration' | 'departure_day'; filter: CertificateSummaryFilter; scrollOffset: number; }
export interface CertificateResultsUiState {
  query: string;
  sort: CertificateSummarySort;
  /** Current bounded 20-row results page. */
  page?: number;
  /** Kept for compatibility with pre-pagination in-memory view state. */
  visibleCount: number;
  scrollOffset: number;
}
let summaryState: CertificateSummaryUiState | null = null;
const resultStates = new Map<string, CertificateResultsUiState>();
export function readCertificateSummaryUiState(): CertificateSummaryUiState | null { return summaryState; }
export function writeCertificateSummaryUiState(next: CertificateSummaryUiState): void { summaryState = next; }
export function readCertificateResultsUiState(key: string): CertificateResultsUiState | null { return resultStates.get(key) ?? null; }
export function writeCertificateResultsUiState(key: string, next: CertificateResultsUiState): void { resultStates.set(key, next); if (resultStates.size > 24) resultStates.delete(resultStates.keys().next().value as string); }
