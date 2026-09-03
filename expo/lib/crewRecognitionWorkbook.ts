import * as XLSX from 'xlsx';

const PREFERRED_SHEET_NAMES = ['master registry', 'crew registry', 'registry'];

export function isCrewWorkbookFile(name: string | null | undefined, mimeType?: string | null): boolean {
  const normalizedName = String(name ?? '').toLowerCase();
  const normalizedMime = String(mimeType ?? '').toLowerCase();
  return /\.(xlsx|xls)$/.test(normalizedName)
    || normalizedMime.includes('spreadsheetml')
    || normalizedMime.includes('ms-excel');
}

export function crewWorkbookBytesToCsv(data: ArrayBuffer | Uint8Array): { csv: string; sheetName: string; rowCount: number } {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames.find((candidate) =>
    PREFERRED_SHEET_NAMES.includes(candidate.trim().toLowerCase()),
  ) ?? workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error('The crew workbook does not contain a readable registry sheet.');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
  if (rows.length === 0) {
    throw new Error(`The “${sheetName}” sheet does not contain any crew records.`);
  }

  return {
    csv: XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
    sheetName,
    rowCount: rows.length,
  };
}
