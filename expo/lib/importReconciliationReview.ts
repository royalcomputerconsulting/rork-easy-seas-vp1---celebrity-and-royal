import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise, ImportReconciliationSummary } from '@/types/models';

export type SmartImportReviewKind = 'Cruise' | 'Offer' | 'Booked Cruise' | 'Completed Cruise' | 'Calendar Event';
export type SmartImportReviewAction = 'add' | 'update' | 'review' | 'preserve';

export interface SmartImportFieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface SmartImportReviewRow {
  id: string;
  kind: SmartImportReviewKind;
  action: SmartImportReviewAction;
  title: string;
  subtitle: string;
  meta: string;
  before?: string;
  after?: string;
  changedFields: string[];
  fieldDiffs: SmartImportFieldDiff[];
}

type AnyImportRecord = Cruise | CasinoOffer | BookedCruise | CalendarEvent;

type OffersReviewInput = {
  existingCruises: Cruise[];
  importedCruises: Cruise[];
  existingOffers: CasinoOffer[];
  importedOffers: CasinoOffer[];
  mergedCruises: Cruise[];
  mergedOffers: CasinoOffer[];
};

type BookedReviewInput = {
  existingBooked: BookedCruise[];
  importedBooked: BookedCruise[];
  mergedBooked: BookedCruise[];
  kind?: SmartImportReviewKind;
};

type CalendarReviewInput = {
  existingEvents: CalendarEvent[];
  importedEvents: CalendarEvent[];
  mergedEvents: CalendarEvent[];
};

const CRUISE_FIELDS = ['shipName', 'sailDate', 'returnDate', 'nights', 'departurePort', 'destination', 'cabinType', 'price', 'taxes', 'offerCode', 'status'] as const;
const OFFER_FIELDS = ['offerCode', 'title', 'shipName', 'sailingDate', 'roomType', 'offerType', 'freePlay', 'freeplayAmount', 'OBC', 'obcAmount', 'expiryDate', 'expires', 'status'] as const;
const BOOKED_FIELDS = ['reservationNumber', 'bookingId', 'shipName', 'sailDate', 'returnDate', 'nights', 'cabinType', 'cabinNumber', 'status', 'completionState', 'price', 'winnings', 'earnedPoints'] as const;
const CALENDAR_FIELDS = ['title', 'startDate', 'endDate', 'start', 'end', 'type', 'location', 'description', 'cruiseId'] as const;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeDate(value: unknown): string {
  const text = normalizeText(value);
  return text.includes('T') ? text.split('T')[0] : text;
}

function normalizeMoney(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return `$${Math.round(value).toLocaleString()}`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') return normalizeMoney(value) || value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return normalizeText(value);
}

function getCruiseLooseKey(cruise: Cruise): string {
  return [normalizeLower(cruise.shipName), normalizeDate(cruise.sailDate), normalizeDate(cruise.returnDate), normalizeLower(cruise.offerCode), normalizeLower(cruise.cabinType)].join('|');
}

function getOfferLooseKey(offer: CasinoOffer): string {
  return [normalizeLower(offer.offerCode), normalizeLower(offer.shipName), normalizeDate(offer.sailingDate), normalizeLower(offer.roomType), normalizeLower(offer.title)].join('|');
}

function getBookedLooseKey(cruise: BookedCruise): string {
  const reservation = normalizeLower(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber);
  if (reservation) return `reservation:${reservation}`;
  return `sailing:${[normalizeLower(cruise.shipName), normalizeDate(cruise.sailDate), normalizeDate(cruise.returnDate)].join('|')}`;
}

function getCalendarLooseKey(event: CalendarEvent): string {
  return [normalizeLower(event.title), normalizeDate(event.startDate || event.start), normalizeDate(event.endDate || event.end), normalizeLower(event.location), normalizeLower(event.type)].join('|');
}

function hasReviewStatus(record: AnyImportRecord): boolean {
  const status = (record as { status?: string }).status;
  return record.importStatus === 'reviewNeeded' || record.importStatus === 'unassigned' || record.reconciliationStatus === 'reviewNeeded' || record.archiveStatus === 'reviewNeeded' || status === 'reviewNeeded';
}

function describeFieldDiffs<T extends Record<string, unknown>>(existing: T | undefined, incoming: T, fields: readonly string[]): SmartImportFieldDiff[] {
  if (!existing) return [];
  return fields
    .map((field) => ({
      field,
      before: formatValue(existing[field]),
      after: formatValue(incoming[field]),
    }))
    .filter((diff) => diff.after.length > 0 && diff.before !== diff.after);
}

function summarizeChangedFields(changedFields: string[]): string {
  if (changedFields.length === 0) return 'No changed fields detected from matching row.';
  return `Changed: ${changedFields.slice(0, 6).join(', ')}${changedFields.length > 6 ? ` +${changedFields.length - 6} more` : ''}`;
}

function summarizeCruise(cruise: Cruise): string {
  return [cruise.shipName, normalizeDate(cruise.sailDate), cruise.nights ? `${cruise.nights} nights` : '', cruise.cabinType, cruise.offerCode].filter(Boolean).join(' • ');
}

function summarizeOffer(offer: CasinoOffer): string {
  const value = offer.freePlay ?? offer.freeplayAmount ?? offer.OBC ?? offer.obcAmount;
  return [offer.offerCode, offer.shipName, normalizeDate(offer.sailingDate), offer.roomType, typeof value === 'number' ? normalizeMoney(value) : ''].filter(Boolean).join(' • ');
}

function summarizeBooked(cruise: BookedCruise): string {
  return [cruise.reservationNumber ?? cruise.bookingId, cruise.shipName, normalizeDate(cruise.sailDate), cruise.nights ? `${cruise.nights} nights` : '', cruise.completionState ?? cruise.status].filter(Boolean).join(' • ');
}

function summarizeCalendarEvent(event: CalendarEvent): string {
  return [event.title, normalizeDate(event.startDate || event.start), event.location, event.type].filter(Boolean).join(' • ');
}

function getReviewMeta(record: AnyImportRecord): string {
  return [record.sourceEmail, record.ownerProfileId, record.brand, record.casinoProgram, record.importStatus, record.reconciliationStatus, record.archiveStatus].filter(Boolean).join(' • ') || 'No owner/profile metadata';
}

export function combineReconciliationSummaries(summaries: ImportReconciliationSummary[]): ImportReconciliationSummary {
  return summaries.reduce<ImportReconciliationSummary>((total, summary) => ({
    addedRows: total.addedRows + summary.addedRows,
    updatedRows: total.updatedRows + summary.updatedRows,
    removedMissingRows: total.removedMissingRows + summary.removedMissingRows,
    suggestedArchiveRows: total.suggestedArchiveRows + summary.suggestedArchiveRows,
    changedOffers: total.changedOffers + summary.changedOffers,
    duplicateOverlappingSailings: total.duplicateOverlappingSailings + summary.duplicateOverlappingSailings,
    reviewNeededItems: total.reviewNeededItems + summary.reviewNeededItems,
    errors: [...total.errors, ...summary.errors],
  }), {
    addedRows: 0,
    updatedRows: 0,
    removedMissingRows: 0,
    suggestedArchiveRows: 0,
    changedOffers: 0,
    duplicateOverlappingSailings: 0,
    reviewNeededItems: 0,
    errors: [],
  });
}

export function createSimpleReconciliationSummary(values: Partial<ImportReconciliationSummary>): ImportReconciliationSummary {
  return {
    addedRows: values.addedRows ?? 0,
    updatedRows: values.updatedRows ?? 0,
    removedMissingRows: values.removedMissingRows ?? 0,
    suggestedArchiveRows: values.suggestedArchiveRows ?? 0,
    changedOffers: values.changedOffers ?? 0,
    duplicateOverlappingSailings: values.duplicateOverlappingSailings ?? 0,
    reviewNeededItems: values.reviewNeededItems ?? 0,
    errors: values.errors ?? [],
  };
}

export function getSmartImportActionLabel(action: SmartImportReviewAction): string {
  if (action === 'add') return 'Add';
  if (action === 'update') return 'Update';
  if (action === 'preserve') return 'Preserve';
  return 'Needs review';
}

export function buildOffersImportReviewRows(input: OffersReviewInput): SmartImportReviewRow[] {
  const existingCruiseByKey = new Map(input.existingCruises.map((cruise) => [getCruiseLooseKey(cruise), cruise]));
  const existingOfferByKey = new Map(input.existingOffers.map((offer) => [getOfferLooseKey(offer), offer]));
  const rows: SmartImportReviewRow[] = [];

  input.importedCruises.forEach((cruise, index) => {
    const existing = existingCruiseByKey.get(getCruiseLooseKey(cruise));
    const fieldDiffs = describeFieldDiffs(existing as Record<string, unknown> | undefined, cruise as unknown as Record<string, unknown>, CRUISE_FIELDS);
    const changedFields = fieldDiffs.map((diff) => diff.field);
    rows.push({
      id: `cruise:${cruise.id}:${index}`,
      kind: 'Cruise',
      action: existing ? 'update' : 'add',
      title: cruise.shipName || 'Imported cruise',
      subtitle: summarizeCruise(cruise),
      meta: getReviewMeta(cruise),
      before: existing ? summarizeCruise(existing) : undefined,
      after: existing ? summarizeChangedFields(changedFields) : summarizeCruise(cruise),
      changedFields,
      fieldDiffs,
    });
  });

  input.importedOffers.forEach((offer, index) => {
    const existing = existingOfferByKey.get(getOfferLooseKey(offer));
    const fieldDiffs = describeFieldDiffs(existing as Record<string, unknown> | undefined, offer as unknown as Record<string, unknown>, OFFER_FIELDS);
    const changedFields = fieldDiffs.map((diff) => diff.field);
    rows.push({
      id: `offer:${offer.id}:${index}`,
      kind: 'Offer',
      action: existing ? 'update' : 'add',
      title: offer.offerCode || offer.title || 'Imported offer',
      subtitle: summarizeOffer(offer),
      meta: getReviewMeta(offer),
      before: existing ? summarizeOffer(existing) : undefined,
      after: existing ? summarizeChangedFields(changedFields) : summarizeOffer(offer),
      changedFields,
      fieldDiffs,
    });
  });

  [...input.mergedCruises, ...input.mergedOffers].filter(hasReviewStatus).forEach((record, index) => {
    const isOffer = 'offerType' in record || 'title' in record;
    rows.push({
      id: `review:${record.id}:${index}`,
      kind: isOffer ? 'Offer' : 'Cruise',
      action: 'review',
      title: isOffer ? ((record as CasinoOffer).offerCode || (record as CasinoOffer).title || 'Review offer') : ((record as Cruise).shipName || 'Review cruise'),
      subtitle: isOffer ? summarizeOffer(record as CasinoOffer) : summarizeCruise(record as Cruise),
      meta: getReviewMeta(record),
      after: 'This row will be kept and flagged for review instead of being deleted or silently assigned.',
      changedFields: [],
      fieldDiffs: [],
    });
  });

  return rows;
}

export function buildBookedImportReviewRows(input: BookedReviewInput): SmartImportReviewRow[] {
  const existingByKey = new Map(input.existingBooked.map((cruise) => [getBookedLooseKey(cruise), cruise]));
  const kind = input.kind ?? 'Booked Cruise';
  const rows: SmartImportReviewRow[] = [];

  input.importedBooked.forEach((cruise, index) => {
    const existing = existingByKey.get(getBookedLooseKey(cruise));
    const fieldDiffs = describeFieldDiffs(existing as Record<string, unknown> | undefined, cruise as unknown as Record<string, unknown>, BOOKED_FIELDS);
    const changedFields = fieldDiffs.map((diff) => diff.field);
    rows.push({
      id: `booked:${cruise.id}:${index}`,
      kind,
      action: existing ? 'update' : 'add',
      title: cruise.shipName || 'Imported booked cruise',
      subtitle: summarizeBooked(cruise),
      meta: getReviewMeta(cruise),
      before: existing ? summarizeBooked(existing) : undefined,
      after: existing ? summarizeChangedFields(changedFields) : summarizeBooked(cruise),
      changedFields,
      fieldDiffs,
    });
  });

  input.mergedBooked.filter(hasReviewStatus).forEach((cruise, index) => {
    rows.push({
      id: `booked-review:${cruise.id}:${index}`,
      kind,
      action: 'review',
      title: cruise.shipName || 'Review booked cruise',
      subtitle: summarizeBooked(cruise),
      meta: getReviewMeta(cruise),
      after: 'This row will be preserved and flagged for review instead of being deleted or overwritten.',
      changedFields: [],
      fieldDiffs: [],
    });
  });

  return rows;
}

export function buildCalendarImportReviewRows(input: CalendarReviewInput): SmartImportReviewRow[] {
  const existingByKey = new Map(input.existingEvents.map((event) => [getCalendarLooseKey(event), event]));
  const rows: SmartImportReviewRow[] = [];

  input.importedEvents.forEach((event, index) => {
    const existing = existingByKey.get(getCalendarLooseKey(event));
    const fieldDiffs = describeFieldDiffs(existing as Record<string, unknown> | undefined, event as unknown as Record<string, unknown>, CALENDAR_FIELDS);
    const changedFields = fieldDiffs.map((diff) => diff.field);
    rows.push({
      id: `calendar:${event.id}:${index}`,
      kind: 'Calendar Event',
      action: existing ? 'update' : 'add',
      title: event.title || 'Imported calendar event',
      subtitle: summarizeCalendarEvent(event),
      meta: getReviewMeta(event),
      before: existing ? summarizeCalendarEvent(existing) : undefined,
      after: existing ? summarizeChangedFields(changedFields) : summarizeCalendarEvent(event),
      changedFields,
      fieldDiffs,
    });
  });

  input.mergedEvents.filter(hasReviewStatus).forEach((event, index) => {
    rows.push({
      id: `calendar-review:${event.id}:${index}`,
      kind: 'Calendar Event',
      action: 'review',
      title: event.title || 'Review calendar event',
      subtitle: summarizeCalendarEvent(event),
      meta: getReviewMeta(event),
      after: 'This event will be preserved and flagged for assignment/reconciliation review.',
      changedFields: [],
      fieldDiffs: [],
    });
  });

  return rows;
}
