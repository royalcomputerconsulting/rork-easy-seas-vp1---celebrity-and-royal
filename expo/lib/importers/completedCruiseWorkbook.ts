import * as XLSX from 'xlsx';
import type { BookedCruise } from '@/types/models';

export type WorkbookBinaryInput =
  | { kind: 'array'; data: Uint8Array }
  | { kind: 'base64'; data: string };

interface CruiseDatabaseRecord {
  cruiseId: string;
  status: string;
  brand: string;
  programCharter: string;
  ship: string;
  itineraryName: string;
  startDate: string;
  endDate: string;
  nights: number;
  startPort: string;
  endPort: string;
  portsVisited: string;
  fullItinerary: string;
  sourceUrls: string;
  sourceBasis: string;
  confidence: string;
  notes: string;
}

interface TripStopRecord {
  cruiseId: string;
  order: number;
  stopType: string;
  place: string;
  displayLabel: string;
  notes: string;
}

interface TripRouteRecord {
  cruiseId: string;
  order: number;
  routeType: string;
  fromPlace: string;
  toPlace: string;
  displayLabel: string;
  notes: string;
}

export interface CompletedCruiseWorkbookSummary {
  workbookRows: number;
  importedPastCruises: number;
  skippedNonPastRows: number;
  duplicateWorkbookRows: number;
  matchedExisting: number;
  addedNew: number;
}

export interface CompletedCruiseWorkbookResult {
  cruises: BookedCruise[];
  summary: CompletedCruiseWorkbookSummary;
}

type SheetRow = Array<string | number | boolean | Date | null | undefined>;

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  return '';
}

function numericCell(value: unknown): number {
  const normalized = stringifyCell(value).replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown): string {
  const normalized = stringifyCell(value);
  if (!normalized) {
    return '';
  }

  const isoDateMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2].padStart(2, '0')}-${isoDateMatch[3].padStart(2, '0')}`;
  }

  const slashDateMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashDateMatch) {
    const year = slashDateMatch[3].length === 2 ? `20${slashDateMatch[3]}` : slashDateMatch[3];
    return `${year}-${slashDateMatch[1].padStart(2, '0')}-${slashDateMatch[2].padStart(2, '0')}`;
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toISOString().split('T')[0] ?? '';
}

function normalizeShipName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBrand(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCruiseKey(brand: string, ship: string, sailDate: string): string {
  return `${normalizeBrand(brand)}|${normalizeShipName(ship)}|${sailDate}`;
}

function buildFallbackCruiseKey(ship: string, sailDate: string): string {
  return `${normalizeShipName(ship)}|${sailDate}`;
}

function toCruiseSource(brand: string): BookedCruise['cruiseSource'] {
  const normalized = normalizeBrand(brand);
  if (normalized.includes('royal')) {
    return 'royal';
  }
  if (normalized.includes('celebrity')) {
    return 'celebrity';
  }
  if (normalized.includes('carnival')) {
    return 'carnival';
  }
  return undefined;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  values.forEach((value) => {
    const normalized = stringifyCell(value);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(normalized);
  });

  return results;
}

function shouldIgnoreStopType(stopType: string): boolean {
  const normalized = stopType.toLowerCase();
  return normalized.includes('flight');
}

function shouldIgnoreRouteType(routeType: string): boolean {
  const normalized = routeType.toLowerCase();
  return normalized.includes('flight');
}

function getRowsForSheet(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log('[CompletedCruiseWorkbook] Missing sheet:', sheetName);
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  console.log('[CompletedCruiseWorkbook] Loaded rows from sheet:', sheetName, rows.length);
  return rows;
}

function parseCruiseDatabaseRows(rows: SheetRow[]): CruiseDatabaseRecord[] {
  return rows.slice(1).map((row) => ({
    cruiseId: stringifyCell(row[0]),
    status: stringifyCell(row[1]),
    brand: stringifyCell(row[2]),
    programCharter: stringifyCell(row[3]),
    ship: stringifyCell(row[4]),
    itineraryName: stringifyCell(row[5]),
    startDate: normalizeDate(row[6]),
    endDate: normalizeDate(row[7]),
    nights: numericCell(row[8]),
    startPort: stringifyCell(row[9]),
    endPort: stringifyCell(row[10]),
    portsVisited: stringifyCell(row[11]),
    fullItinerary: stringifyCell(row[12]),
    sourceUrls: stringifyCell(row[13]),
    sourceBasis: stringifyCell(row[14]),
    confidence: stringifyCell(row[15]),
    notes: stringifyCell(row[16]),
  })).filter((row) => row.cruiseId && row.ship && row.startDate);
}

function parseTripStopRows(rows: SheetRow[]): Map<string, TripStopRecord[]> {
  const grouped = new Map<string, TripStopRecord[]>();

  rows.slice(1).forEach((row) => {
    const cruiseId = stringifyCell(row[0]);
    if (!cruiseId) {
      return;
    }

    const record: TripStopRecord = {
      cruiseId,
      order: numericCell(row[7]),
      stopType: stringifyCell(row[8]),
      place: stringifyCell(row[9]),
      displayLabel: stringifyCell(row[12]),
      notes: stringifyCell(row[13]),
    };

    const existing = grouped.get(cruiseId) ?? [];
    existing.push(record);
    grouped.set(cruiseId, existing);
  });

  grouped.forEach((records, cruiseId) => {
    grouped.set(cruiseId, [...records].sort((a, b) => a.order - b.order));
  });

  return grouped;
}

function parseTripRouteRows(rows: SheetRow[]): Map<string, TripRouteRecord[]> {
  const grouped = new Map<string, TripRouteRecord[]>();

  rows.slice(1).forEach((row) => {
    const cruiseId = stringifyCell(row[0]);
    if (!cruiseId) {
      return;
    }

    const record: TripRouteRecord = {
      cruiseId,
      order: numericCell(row[7]),
      routeType: stringifyCell(row[8]),
      fromPlace: stringifyCell(row[9]),
      toPlace: stringifyCell(row[12]),
      displayLabel: stringifyCell(row[15]),
      notes: stringifyCell(row[16]),
    };

    const existing = grouped.get(cruiseId) ?? [];
    existing.push(record);
    grouped.set(cruiseId, existing);
  });

  grouped.forEach((records, cruiseId) => {
    grouped.set(cruiseId, [...records].sort((a, b) => a.order - b.order));
  });

  return grouped;
}

function buildCruiseNotes(record: CruiseDatabaseRecord, routes: TripRouteRecord[]): string | undefined {
  const routeLabels = uniqueStrings(
    routes
      .filter((route) => !shouldIgnoreRouteType(route.routeType))
      .map((route) => route.displayLabel || `${route.fromPlace} → ${route.toPlace}`)
  );

  const notes = uniqueStrings([
    record.programCharter ? `Program: ${record.programCharter}` : '',
    record.sourceBasis ? `Source Basis: ${record.sourceBasis}` : '',
    record.confidence ? `Confidence: ${record.confidence}` : '',
    routeLabels.length > 0 ? `Segments: ${routeLabels.join(' • ')}` : '',
    record.sourceUrls ? `Sources: ${record.sourceUrls}` : '',
    record.notes,
  ]);

  if (notes.length === 0) {
    return undefined;
  }

  return notes.join('\n');
}

function chooseBetterString(currentValue: string | undefined, importedValue: string | undefined): string | undefined {
  const current = stringifyCell(currentValue);
  const imported = stringifyCell(importedValue);

  if (!imported) {
    return current || undefined;
  }

  if (!current) {
    return imported;
  }

  if (current.toLowerCase().startsWith('unknown')) {
    return imported;
  }

  return imported.length > current.length ? imported : current;
}

function chooseBetterArray(currentValue: string[] | undefined, importedValue: string[] | undefined): string[] | undefined {
  const current = uniqueStrings(currentValue ?? []);
  const imported = uniqueStrings(importedValue ?? []);

  if (imported.length === 0) {
    return current.length > 0 ? current : undefined;
  }

  if (current.length === 0) {
    return imported;
  }

  return imported.length >= current.length ? imported : current;
}

function mergeCruiseNotes(currentValue: string | undefined, importedValue: string | undefined): string | undefined {
  const merged = uniqueStrings([currentValue ?? '', importedValue ?? '']);
  if (merged.length === 0) {
    return undefined;
  }
  return merged.join('\n');
}

function createImportedCruise(record: CruiseDatabaseRecord, stops: TripStopRecord[], routes: TripRouteRecord[]): BookedCruise {
  const filteredStops = stops.filter((stop) => !shouldIgnoreStopType(stop.stopType));
  const ports = uniqueStrings(filteredStops.map((stop) => stop.place));
  const itineraryRaw = uniqueStrings(filteredStops.map((stop) => stop.displayLabel || stop.place));
  const now = new Date().toISOString();
  const source = toCruiseSource(record.brand);
  const cruiseId = `completed-workbook-${normalizeBrand(record.brand).replace(/\s+/g, '-')}-${normalizeShipName(record.ship).replace(/\s+/g, '-')}-${record.startDate}`;

  return {
    id: cruiseId,
    shipName: record.ship,
    sailDate: record.startDate,
    returnDate: record.endDate,
    departurePort: record.startPort || ports[0] || 'Unknown Port',
    destination: record.portsVisited || record.itineraryName,
    itineraryName: record.itineraryName || record.fullItinerary || `${record.nights} Night Cruise`,
    itineraryRaw: itineraryRaw.length > 0 ? itineraryRaw : undefined,
    ports: ports.length > 0 ? ports : undefined,
    nights: record.nights,
    category: record.programCharter || undefined,
    status: 'completed',
    completionState: 'completed',
    cruiseSource: source,
    notes: buildCruiseNotes(record, routes),
    sourcePayload: {
      workbook: 'cruise_master_database_with_trip_segments.xlsx',
      cruiseDatabase: record,
      tripStops: filteredStops,
      tripRoutes: routes.filter((route) => !shouldIgnoreRouteType(route.routeType)),
    },
    createdAt: now,
    updatedAt: now,
  };
}

function mergeExistingCruise(existingCruise: BookedCruise, importedCruise: BookedCruise): BookedCruise {
  return {
    ...existingCruise,
    shipName: chooseBetterString(existingCruise.shipName, importedCruise.shipName) ?? existingCruise.shipName,
    sailDate: importedCruise.sailDate || existingCruise.sailDate,
    returnDate: importedCruise.returnDate || existingCruise.returnDate,
    departurePort: chooseBetterString(existingCruise.departurePort, importedCruise.departurePort) ?? existingCruise.departurePort,
    destination: chooseBetterString(existingCruise.destination, importedCruise.destination) ?? existingCruise.destination,
    itineraryName: chooseBetterString(existingCruise.itineraryName, importedCruise.itineraryName) ?? existingCruise.itineraryName,
    itineraryRaw: chooseBetterArray(existingCruise.itineraryRaw, importedCruise.itineraryRaw),
    ports: chooseBetterArray(existingCruise.ports, importedCruise.ports),
    nights: importedCruise.nights || existingCruise.nights,
    category: chooseBetterString(existingCruise.category, importedCruise.category),
    status: 'completed',
    completionState: 'completed',
    cruiseSource: importedCruise.cruiseSource ?? existingCruise.cruiseSource,
    notes: mergeCruiseNotes(existingCruise.notes, importedCruise.notes),
    sourcePayload: importedCruise.sourcePayload ?? existingCruise.sourcePayload,
    updatedAt: new Date().toISOString(),
  };
}

function sortCruises(cruises: BookedCruise[]): BookedCruise[] {
  return [...cruises].sort((left, right) => {
    const leftTime = new Date(left.sailDate).getTime();
    const rightTime = new Date(right.sailDate).getTime();
    return leftTime - rightTime;
  });
}

export function importCompletedCruisesFromWorkbook(
  workbookInput: WorkbookBinaryInput,
  existingCruises: BookedCruise[]
): CompletedCruiseWorkbookResult {
  console.log('[CompletedCruiseWorkbook] Starting workbook import with existing cruises:', existingCruises.length);

  const workbook = XLSX.read(workbookInput.data, {
    type: workbookInput.kind,
    cellDates: false,
  });

  const cruiseRows = parseCruiseDatabaseRows(getRowsForSheet(workbook, 'Cruise Database'));
  const stopRowsByCruiseId = parseTripStopRows(getRowsForSheet(workbook, 'Trip Stops'));
  const routeRowsByCruiseId = parseTripRouteRows(getRowsForSheet(workbook, 'Trip Routes'));

  const summary: CompletedCruiseWorkbookSummary = {
    workbookRows: cruiseRows.length,
    importedPastCruises: 0,
    skippedNonPastRows: 0,
    duplicateWorkbookRows: 0,
    matchedExisting: 0,
    addedNew: 0,
  };

  const importedCruises: BookedCruise[] = [];
  const seenWorkbookCruises = new Set<string>();

  cruiseRows.forEach((row) => {
    const normalizedStatus = row.status.toLowerCase();
    if (normalizedStatus !== 'past') {
      summary.skippedNonPastRows += 1;
      return;
    }

    const cruiseKey = buildCruiseKey(row.brand, row.ship, row.startDate);
    if (seenWorkbookCruises.has(cruiseKey)) {
      summary.duplicateWorkbookRows += 1;
      return;
    }

    seenWorkbookCruises.add(cruiseKey);
    const stops = stopRowsByCruiseId.get(row.cruiseId) ?? [];
    const routes = routeRowsByCruiseId.get(row.cruiseId) ?? [];
    importedCruises.push(createImportedCruise(row, stops, routes));
  });

  summary.importedPastCruises = importedCruises.length;

  const existingByPrimaryKey = new Map<string, number>();
  const existingByFallbackKey = new Map<string, number[]>();

  existingCruises.forEach((cruise, index) => {
    const primaryKey = buildCruiseKey(cruise.cruiseSource ?? '', cruise.shipName, cruise.sailDate);
    const fallbackKey = buildFallbackCruiseKey(cruise.shipName, cruise.sailDate);

    existingByPrimaryKey.set(primaryKey, index);
    const fallbackMatches = existingByFallbackKey.get(fallbackKey) ?? [];
    fallbackMatches.push(index);
    existingByFallbackKey.set(fallbackKey, fallbackMatches);
  });

  const mergedCruises = [...existingCruises];

  importedCruises.forEach((importedCruise) => {
    const primaryKey = buildCruiseKey(importedCruise.cruiseSource ?? '', importedCruise.shipName, importedCruise.sailDate);
    const fallbackKey = buildFallbackCruiseKey(importedCruise.shipName, importedCruise.sailDate);
    const primaryMatchIndex = existingByPrimaryKey.get(primaryKey);

    if (primaryMatchIndex !== undefined) {
      mergedCruises[primaryMatchIndex] = mergeExistingCruise(mergedCruises[primaryMatchIndex] as BookedCruise, importedCruise);
      summary.matchedExisting += 1;
      return;
    }

    const fallbackMatches = existingByFallbackKey.get(fallbackKey) ?? [];
    if (fallbackMatches.length === 1) {
      const fallbackMatchIndex = fallbackMatches[0] as number;
      mergedCruises[fallbackMatchIndex] = mergeExistingCruise(mergedCruises[fallbackMatchIndex] as BookedCruise, importedCruise);
      summary.matchedExisting += 1;
      return;
    }

    mergedCruises.push(importedCruise);
    summary.addedNew += 1;
  });

  const sortedCruises = sortCruises(mergedCruises);

  console.log('[CompletedCruiseWorkbook] Import complete:', summary);

  return {
    cruises: sortedCruises,
    summary,
  };
}
