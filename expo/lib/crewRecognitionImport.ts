import type { RecognitionEntryWithCrew, Sailing } from '@/types/crew-recognition';

export interface CrewRecognitionImportResult {
  entries: RecognitionEntryWithCrew[];
  sailings: Sailing[];
  format: 'csv' | 'text';
  sourceRowCount: number;
  warnings: string[];
}

type Row = Record<string, string>;

const clean = (value: unknown): string => String(value ?? '').replace(/^\uFEFF/, '').trim();
const headerKey = (value: string): string => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

/** RFC-4180-style reader: quoted commas, escaped quotes, CRLF, and embedded newlines are retained. */
export function parseDelimitedRows(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(clean(cell));
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(clean(cell));
      cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(clean(cell));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function value(row: Row, ...aliases: string[]): string {
  for (const alias of aliases) {
    const candidate = row[headerKey(alias)];
    if (candidate) return clean(candidate);
  }
  return '';
}

function toIsoDate(raw: string): string {
  const input = clean(raw).replace(/[–—]/g, '-');
  if (!input || /^(undated|unknown|n\/?a)$/i.test(input) || /year unspecified/i.test(input)) return input;
  const iso = input.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = input.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const named = input.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (named) {
    const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[1].slice(0, 3).toLowerCase()) + 1;
    return `${named[3]}-${String(month).padStart(2, '0')}-${named[2].padStart(2, '0')}`;
  }
  return input;
}

function dateParts(raw: string, fallbackEnd = ''): { start: string; end: string; month: string; year: number } {
  const start = toIsoDate(raw);
  const end = toIsoDate(fallbackEnd || raw);
  const iso = start.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  return { start, end, month: iso ? `${iso[1]}-${iso[2]}` : '', year: iso ? Number(iso[1]) : 0 };
}

function splitSailingDates(valueToSplit: string): string[] {
  const dates = clean(valueToSplit).split(/\s*;\s*|\s*\|\s*(?=(?:20\d{2}|[A-Z][a-z]{2}))/).map(clean).filter(Boolean);
  return dates.length ? Array.from(new Set(dates)) : ['Undated'];
}

function makeSailing(shipName: string, rawDate: string, endDate: string, userId: string): Sailing {
  const dates = dateParts(rawDate, endDate);
  const identity = `${shipName.toLowerCase()}|${dates.start.toLowerCase()}|${dates.end.toLowerCase()}`;
  return {
    id: `local_sailing_import_${stableHash(identity)}`,
    shipName,
    sailStartDate: dates.start,
    sailEndDate: dates.end,
    userId,
  };
}

function makeEntry(input: {
  shipName: string;
  rawDate: string;
  endDate?: string;
  fullName: string;
  department?: string;
  roleTitle?: string;
  notes?: string;
  sourceText: string;
  userId: string;
}): { entry: RecognitionEntryWithCrew; sailing: Sailing } {
  const sailing = makeSailing(input.shipName, input.rawDate, input.endDate ?? '', input.userId);
  const dates = dateParts(input.rawDate, input.endDate);
  const crewIdentity = `${input.shipName.toLowerCase()}|${input.fullName.toLowerCase()}`;
  const entryIdentity = `${crewIdentity}|${sailing.id}|${clean(input.department).toLowerCase()}|${clean(input.roleTitle).toLowerCase()}`;
  const now = new Date().toISOString();
  return {
    sailing,
    entry: {
      id: `local_entry_import_${stableHash(entryIdentity)}`,
      crewMemberId: `local_crew_import_${stableHash(crewIdentity)}`,
      sailingId: sailing.id,
      shipName: input.shipName,
      sailStartDate: dates.start,
      sailEndDate: dates.end,
      sailingMonth: dates.month,
      sailingYear: dates.year,
      department: clean(input.department) || 'Other',
      roleTitle: clean(input.roleTitle) || undefined,
      sourceText: input.sourceText,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
      fullName: input.fullName,
      crewNotes: clean(input.notes) || undefined,
    },
  };
}

function isCsvDocument(text: string): boolean {
  const first = parseDelimitedRows(text).at(0)?.map(headerKey) ?? [];
  return first.includes('ship') && first.some((header) => ['crewmember', 'crewname', 'fullname', 'name'].includes(header));
}

function parseCsv(text: string, userId: string): CrewRecognitionImportResult {
  const matrix = parseDelimitedRows(text);
  if (matrix.length < 2) return { entries: [], sailings: [], format: 'csv', sourceRowCount: 0, warnings: ['The CSV has no data rows.'] };
  const headers = matrix[0].map(headerKey);
  const entries: RecognitionEntryWithCrew[] = [];
  const sailings = new Map<string, Sailing>();
  const warnings: string[] = [];
  matrix.slice(1).forEach((cells, rowIndex) => {
    const row: Row = {};
    headers.forEach((header, index) => { row[header] = clean(cells[index]); });
    const shipName = value(row, 'Ship', 'Ship Name', 'Vessel');
    const fullName = value(row, 'Crew Member', 'Crew Name', 'Full Name', 'Name');
    if (!shipName || !fullName) {
      warnings.push(`Row ${rowIndex + 2} skipped: ship or crew member is blank.`);
      return;
    }
    const allDates = value(row, 'All Sailing Dates', 'Sailing Dates', 'Sail Dates');
    const startDate = value(row, 'Start Date', 'Sail Start Date', 'Departure Date', 'Last Met');
    const endDate = value(row, 'End Date', 'Sail End Date', 'Return Date');
    const department = value(row, 'Department', 'Area');
    const role = value(row, 'Role / Location', 'Role', 'Role Title', 'Location');
    const notes = [value(row, 'Notes', 'Crew Notes'), value(row, 'Standout Praise'), value(row, 'Name Variants'), value(row, 'Source Note')].filter(Boolean).join(' · ');
    const dates = splitSailingDates(allDates || startDate || 'Undated');
    dates.forEach((rawDate) => {
      const built = makeEntry({ shipName, rawDate, endDate: dates.length === 1 ? endDate : '', fullName, department, roleTitle: role, notes, sourceText: 'Imported from crew CSV', userId });
      entries.push(built.entry);
      sailings.set(built.sailing.id, built.sailing);
    });
  });
  return { entries, sailings: Array.from(sailings.values()), format: 'csv', sourceRowCount: matrix.length - 1, warnings };
}

function extractCombinedShipDate(line: string): { shipName: string; date: string } | null {
  const match = line.match(/^(.*?)(?:\s*[,|\-]\s*|\s+)((?:20\d{2}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{1,2}[-/]\d{1,2}[-/]20\d{2})|(?:[A-Z][a-z]+\s+\d{1,2},?\s+20\d{2}))(?:\s.*)?$/);
  return match && clean(match[1]) ? { shipName: clean(match[1]), date: clean(match[2]) } : null;
}

function parseText(text: string, userId: string): CrewRecognitionImportResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(clean);
  const entries: RecognitionEntryWithCrew[] = [];
  const sailings = new Map<string, Sailing>();
  const warnings: string[] = [];
  let shipName = '';
  let sailingDates: string[] = ['Undated'];
  let sourceRows = 0;

  lines.forEach((line, index) => {
    if (!line) return;
    const shipHeader = line.match(/^(?:ship|vessel)\s*:\s*(.+)$/i);
    if (shipHeader) { shipName = clean(shipHeader[1]); return; }
    const dateHeader = line.match(/^(?:sailing|sail(?:ing)? dates?|departure(?: date)?)\s*:\s*(.+)$/i);
    if (dateHeader) { sailingDates = splitSailingDates(dateHeader[1]); return; }
    const combined = extractCombinedShipDate(line);
    if (combined && /(?:seas|celebrity|carnival|silversea|princess|norwegian|msc|virgin)/i.test(combined.shipName)) {
      shipName = combined.shipName;
      sailingDates = [combined.date];
      return;
    }
    if (/^(?:crew|crew member|name)(?:\s*[|,\t].*)?$/i.test(line)) return;

    const cells = line.split(/\s*[|\t]\s*|\s*,\s*/).map(clean);
    const fullName = cells[0];
    if (!shipName) {
      warnings.push(`Line ${index + 1} skipped: add a Ship: heading before crew names.`);
      return;
    }
    if (!fullName) return;
    sourceRows += 1;
    sailingDates.forEach((rawDate) => {
      const built = makeEntry({ shipName, rawDate, fullName, department: cells[1], roleTitle: cells[2], notes: cells.slice(3).join(' · '), sourceText: 'Imported from multi-sailing crew text', userId });
      entries.push(built.entry);
      sailings.set(built.sailing.id, built.sailing);
    });
  });
  if (!entries.length && !warnings.length) warnings.push('No crew rows were recognized.');
  return { entries, sailings: Array.from(sailings.values()), format: 'text', sourceRowCount: sourceRows, warnings };
}

export function parseCrewRecognitionImport(text: string, userId = 'local'): CrewRecognitionImportResult {
  return isCsvDocument(text) ? parseCsv(text, userId) : parseText(text, userId);
}

export function crewEntryIdentity(entry: RecognitionEntryWithCrew): string {
  return [entry.shipName, entry.sailStartDate, entry.sailEndDate, entry.fullName, entry.department, entry.roleTitle ?? ''].map((part) => clean(part).toLowerCase()).join('|');
}

export function crewSailingIdentity(sailing: Sailing): string {
  return [sailing.shipName, sailing.sailStartDate, sailing.sailEndDate].map((part) => clean(part).toLowerCase()).join('|');
}
