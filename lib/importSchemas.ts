import { z } from 'zod';

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_ROWS = 50000;

const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
);

const optionalDateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
).optional().or(z.literal(''));

const positiveNumberSchema = z.number().nonnegative('Must be a positive number');
const priceSchema = z.number().min(0).max(1000000, 'Price exceeds reasonable limit');
const nightsSchema = z.number().int().min(1).max(365, 'Nights must be between 1 and 365');

export const cruiseImportSchema = z.object({
  shipName: z.string().min(1, 'Ship name is required').max(100),
  sailingDate: dateStringSchema,
  itinerary: z.string().max(500),
  offerCode: z.string().max(50),
  offerName: z.string().max(200),
  roomType: z.string().max(100),
  guestsInfo: z.string().max(100),
  perks: z.string().max(1000),
  shipClass: z.string().max(100),
  tradeInValue: positiveNumberSchema,
  offerExpiryDate: optionalDateStringSchema,
  offerReceivedDate: optionalDateStringSchema,
  priceInterior: priceSchema,
  priceOceanView: priceSchema,
  priceBalcony: priceSchema,
  priceSuite: priceSchema,
  taxesFees: priceSchema,
  portsAndTimes: z.string().max(2000),
  offerType: z.string().max(100),
  nights: nightsSchema,
  departurePort: z.string().max(200),
});

export const bookedCruiseImportSchema = z.object({
  id: z.string().max(100),
  ship: z.string().min(1, 'Ship name is required').max(100),
  departureDate: dateStringSchema,
  returnDate: dateStringSchema,
  nights: nightsSchema,
  itineraryName: z.string().max(500),
  departurePort: z.string().max(200),
  portsRoute: z.string().max(2000),
  reservationNumber: z.string().max(50),
  guests: z.number().int().min(1).max(20, 'Guest count must be between 1 and 20'),
  bookingId: z.string().max(100),
  isBooked: z.boolean(),
  winningsBroughtHome: z.number().min(-1000000).max(1000000, 'Winnings value out of range'),
  cruisePointsEarned: positiveNumberSchema.max(1000000, 'Points value out of range'),
  cabinCategory: z.string().max(100).optional(),
  cabinNumber: z.string().max(50).optional(),
  pricePaid: priceSchema.optional(),
  totalRetailCost: priceSchema.optional(),
  totalCasinoDiscount: priceSchema.optional(),
});

export const calendarEventImportSchema = z.object({
  uid: z.string().max(500),
  summary: z.string().max(500),
  dtstart: z.string().max(100),
  dtend: z.string().max(100),
  location: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
});

export const csvRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  data: z.array(z.string()),
});

export const importFileMetadataSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES, `File size must be less than ${MAX_FILE_SIZE_MB}MB`),
  contentLength: z.number().int().min(0),
  rowCount: z.number().int().min(0).max(MAX_ROWS, `Cannot import more than ${MAX_ROWS} rows`),
  delimiter: z.enum(['comma', 'tab']),
});

export const offersCSVImportSchema = z.object({
  metadata: importFileMetadataSchema,
  headers: z.array(z.string()).min(1, 'CSV must have headers'),
  rows: z.array(cruiseImportSchema).min(1, 'CSV must have at least one data row').max(MAX_ROWS),
});

export const bookedCSVImportSchema = z.object({
  metadata: importFileMetadataSchema,
  headers: z.array(z.string()).min(1, 'CSV must have headers'),
  rows: z.array(bookedCruiseImportSchema).min(1, 'CSV must have at least one data row').max(MAX_ROWS),
});

export const icsImportSchema = z.object({
  metadata: importFileMetadataSchema,
  events: z.array(calendarEventImportSchema).min(1, 'ICS file must have at least one event').max(MAX_ROWS),
});

export type CruiseImportRow = z.infer<typeof cruiseImportSchema>;
export type BookedCruiseImportRow = z.infer<typeof bookedCruiseImportSchema>;
export type CalendarEventImport = z.infer<typeof calendarEventImportSchema>;
export type ImportFileMetadata = z.infer<typeof importFileMetadataSchema>;
export type OffersCSVImport = z.infer<typeof offersCSVImportSchema>;
export type BookedCSVImport = z.infer<typeof bookedCSVImportSchema>;
export type ICSImport = z.infer<typeof icsImportSchema>;

export interface ImportValidationError {
  type: 'validation' | 'size' | 'format' | 'content';
  field?: string;
  message: string;
  rowNumber?: number;
  suggestions?: string[];
}

export interface ImportValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
}

export function validateFileSize(sizeBytes: number): ImportValidationResult<number> {
  const errors: ImportValidationError[] = [];
  
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push({
      type: 'size',
      message: `File size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB`,
      suggestions: ['Try splitting the file into smaller chunks', 'Remove unnecessary columns or rows'],
    });
    return { success: false, errors, warnings: [] };
  }
  
  if (sizeBytes === 0) {
    errors.push({
      type: 'size',
      message: 'File is empty',
    });
    return { success: false, errors, warnings: [] };
  }
  
  return { success: true, data: sizeBytes, errors: [], warnings: [] };
}

export function validateRowCount(count: number): ImportValidationResult<number> {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];
  
  if (count > MAX_ROWS) {
    errors.push({
      type: 'content',
      message: `File contains ${count} rows, which exceeds the maximum of ${MAX_ROWS} rows`,
      suggestions: ['Split the file into multiple smaller files', 'Import the most recent data first'],
    });
    return { success: false, errors, warnings };
  }
  
  if (count === 0) {
    errors.push({
      type: 'content',
      message: 'File contains no data rows',
    });
    return { success: false, errors, warnings };
  }
  
  if (count > 1000) {
    warnings.push({
      type: 'content',
      message: `Large import: ${count} rows. This may take a moment to process.`,
    });
  }
  
  return { success: true, data: count, errors, warnings };
}

export function formatZodError(error: z.ZodError, rowNumber?: number): ImportValidationError[] {
  return error.issues.map((err: z.ZodIssue) => ({
    type: 'validation' as const,
    field: err.path.join('.'),
    message: err.message,
    rowNumber,
    suggestions: generateSuggestions(err),
  }));
}

function generateSuggestions(error: z.ZodIssue): string[] {
  const suggestions: string[] = [];
  
  if (error.code === 'invalid_type') {
    if ('expected' in error && 'received' in error) {
      suggestions.push(`Expected ${error.expected}, but got ${error.received}`);
      if (error.expected === 'number') {
        suggestions.push('Remove any currency symbols ($, commas) from numeric values');
      }
    }
  } else if (error.code === 'too_big') {
    suggestions.push('Value is too large');
  } else if (error.code === 'too_small') {
    suggestions.push('Value is too small');
  } else {
    suggestions.push('Check the format of the value');
    const hasDateInPath = error.path.some((p: PropertyKey) => {
      if (typeof p === 'string' || typeof p === 'number') {
        return String(p).toLowerCase().includes('date');
      }
      return false;
    });
    if (hasDateInPath) {
      suggestions.push('Dates should be in YYYY-MM-DD format (e.g., 2025-12-31)');
    }
  }
  
  return suggestions;
}

export function createImportError(
  type: ImportValidationError['type'],
  message: string,
  field?: string,
  rowNumber?: number,
  suggestions?: string[]
): ImportValidationError {
  return { type, message, field, rowNumber, suggestions };
}

export function validateImportContent(
  content: string,
  expectedType: 'csv' | 'ics' | 'json'
): ImportValidationResult<string> {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];
  
  if (!content || content.trim().length === 0) {
    errors.push(createImportError('content', 'File content is empty'));
    return { success: false, errors, warnings };
  }
  
  if (expectedType === 'csv') {
    if (!content.includes('\n') && !content.includes('\r')) {
      errors.push(createImportError('format', 'CSV file appears to contain only one line'));
      return { success: false, errors, warnings };
    }
    
    const hasComma = content.includes(',');
    const hasTab = content.includes('\t');
    
    if (!hasComma && !hasTab) {
      errors.push(createImportError(
        'format',
        'CSV file does not appear to contain comma or tab delimiters',
        undefined,
        undefined,
        ['Ensure the file is properly formatted as CSV or TSV']
      ));
      return { success: false, errors, warnings };
    }
  }
  
  if (expectedType === 'ics') {
    if (!content.includes('BEGIN:VCALENDAR')) {
      errors.push(createImportError(
        'format',
        'File does not appear to be a valid ICS calendar file',
        undefined,
        undefined,
        ['Ensure the file is exported as ICS/iCal format']
      ));
      return { success: false, errors, warnings };
    }
    
    if (!content.includes('BEGIN:VEVENT')) {
      warnings.push(createImportError('content', 'ICS file contains no events'));
    }
  }
  
  if (expectedType === 'json') {
    try {
      JSON.parse(content);
    } catch {
      errors.push(createImportError(
        'format',
        'File does not appear to be valid JSON',
        undefined,
        undefined,
        ['Ensure the file is properly formatted JSON']
      ));
      return { success: false, errors, warnings };
    }
  }
  
  return { success: true, data: content, errors, warnings };
}
