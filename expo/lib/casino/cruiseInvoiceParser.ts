import type { BookedCruise } from '@/types/models';

export interface CruiseInvoiceDiscountLine { label: string; amount: number }

export interface ParsedCruiseInvoice {
  reservationId: string | null;
  shipName: string | null;
  sailDate: string | null;
  issueDate: string | null;
  nights: number | null;
  stateroom: string | null;
  stateroomDescription: string | null;
  specialServices: string | null;
  offerCode: string | null;
  cruiseFare: number | null;
  taxesFees: number | null;
  totalCharge: number | null;
  amountPaid: number | null;
  balanceDue: number | null;
  discountLines: CruiseInvoiceDiscountLine[];
  promotions: string[];
  freePlay: number | null;
  onboardCredit: number | null;
  casinoCompValue: number;
  warnings: string[];
  confidence: 'actual' | 'partial' | 'needs-review';
}

const money = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

const RECEIPT_LABELS = [
  'Reservation ID', 'Issue Date', 'Package Type', 'Ship', 'Sailing Date', 'Departure Date',
  'Cruise Duration', 'Itinerary', 'Stateroom', 'Description', 'Guest Name', 'Crown and Anchor #',
  'Special Services', 'Dining (Waitlist)', 'Cruise Fare', 'Taxes, fees, and port expenses',
  'Dining(Waitlist)',
  'Taxes,fees,andportexpenses',
  'Total Charge', 'Amount Paid', 'Balance Due', 'Promotions Applied', 'Onboard Credit',
  'Casino Comp', 'Casino 75', 'YHP5-Casino Slots', 'CGRP-FIT PROMO', 'Casino Certificate',
];

function normalizeReceiptText(rawText: string): string {
  let text = rawText.replace(/\u0000/g, '').replace(/\r/g, '\n');
  // The embedded Royal font sometimes returns every glyph separated by a
  // space (including money values such as "- 3 1 0 . 0 0"). Rejoin those
  // runs before recognizing labels and amounts.
  text = text.replace(/(?:[A-Za-z0-9]\s+){2,}[A-Za-z0-9]/g, (value) => value.replace(/\s+/g, ''))
    .replace(/-\s+(?=\d)/g, '-').replace(/\s*\.\s*/g, '.').replace(/\s*,\s*/g, ',');
  // Royal's embedded font commonly emits this label one glyph at a time.
  text = text.replace(/R\s*e\s*s\s*e\s*r\s*v\s*a\s*t\s*i\s*o\s*n\s+I\s*D/gi, 'Reservation ID');
  for (const label of RECEIPT_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
    text = text.replace(new RegExp(`\\s*(${escaped})[ \\t]*:?`, 'gi'), '\n$1:');
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function field(text: string, label: string): string | null {
  const pattern = new RegExp(`(?:^|\\n)${label}[ \\t]*:?[ \\t]*([^\\n\\r]+)`, 'i');
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function amountAfterLabel(text: string, label: string): number | null {
  const pattern = new RegExp(`(?:^|\\n)${label}[ \\t]*:?[ \\t]*([^\\n\\r]+)`, 'gi');
  let result: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const values = match[1].match(/-?\$?\d[\d,]*\.\d{2}/g) ?? [];
    const parsed = money(values[values.length - 1]);
    if (parsed != null) result = parsed;
  }
  return result;
}

function firstAmountAfterLabel(text: string, label: string): number | null {
  const pattern = new RegExp(`(?:^|\\n)${label}[ \\t]*:?[ \\t]*([^\\n\\r]+)`, 'gi');
  let result: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const parsed = money(match[1].match(/-?\$?\d[\d,]*\.\d{2}/)?.[0]);
    if (parsed != null) result = parsed;
  }
  return result;
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/);
  if (!match) return null;
  const month = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(match[2]) + 1;
  return month ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
}

function cleanShip(value: string | null): string | null {
  if (!value) return null;
  return value.split(/\s{2,}|Issue Date:|Sailing Date:/i)[0].trim().replace(/([A-Z]+)OFTHESEAS/i, '$1 OF THE SEAS').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function negativeFareLines(text: string): CruiseInvoiceDiscountLine[] {
  const rows: CruiseInvoiceDiscountLine[] = [];
  const fareBlock = text.match(/(?:^|\n)Cruise Fare\s*:?[\s\S]*?(?=\nTaxes, fees, and port expenses|\nTotal Charge|$)/i)?.[0] ?? text;
  const pattern = /(?:^|\n)\s*((?:Casino Comp|Casino\s+\d+|CGRP-FIT PROMO|YHP5-Casino Slots|Casino Certificate))\s+([^\n]+)/gi;
  for (const match of fareBlock.matchAll(pattern)) {
    const amounts = match[2].match(/-\$?\s*\d[\d,]*\.\d{2}/g) ?? [];
    const total = money(amounts[amounts.length - 1]);
    if (total != null && total < 0) rows.push({ label: match[1].replace(/\s+/g, ' ').trim(), amount: Math.abs(total) });
  }
  return rows;
}

export function parseRoyalCruiseInvoiceText(rawText: string): ParsedCruiseInvoice {
  const text = normalizeReceiptText(rawText);
  const reservationId = field(text, 'Reservation ID')?.match(/\d{5,}/)?.[0] ?? null;
  const shipName = cleanShip(field(text, 'Ship'));
  const sailDate = dateOnly(field(text, '(?:Departure Date|Sailing Date)'));
  const issueDate = dateOnly(field(text, 'Issue Date'));
  const nightsValue = field(text, 'Cruise Duration')?.match(/\d{1,2}/)?.[0];
  const specialServices = field(text, 'Special Services');
  const offerCode = specialServices?.match(/\(([A-Z0-9-]{4,})\)/i)?.[1]?.toUpperCase()
    ?? specialServices?.match(/\b(\d{2}[A-Z0-9]{3,})\b/i)?.[1]?.toUpperCase()
    ?? null;
  const discountLines = negativeFareLines(text);
  const promotionBlock = field(text, 'Promotions Applied');
  const freePlayCode = text.match(/\b(?:TBC\d*|TBB\d*)-FP\s*([\d,]+)/i);
  const onboardCredit = firstAmountAfterLabel(text, 'Onboard Credit');
  const promotions = Array.from(new Set([promotionBlock, ...discountLines.map((row) => row.label)].filter((value): value is string => Boolean(value))));
  const cruiseFare = amountAfterLabel(text, 'Cruise Fare');
  const hasCasinoFareReduction = /(?:^|\n)(?:Casino Comp|Casino\s+\d+|YHP5-Casino Slots|Casino Certificate)/i.test(text);
  if (discountLines.length === 0 && cruiseFare != null && hasCasinoFareReduction) discountLines.push({ label: 'Casino discounts (receipt total)', amount: cruiseFare });
  const result: ParsedCruiseInvoice = {
    reservationId,
    shipName,
    sailDate,
    issueDate,
    nights: nightsValue ? Number(nightsValue) : null,
    stateroom: field(text, 'Stateroom')?.split(/\s{2,}|Description:/i)[0]?.trim() ?? null,
    stateroomDescription: field(text, 'Description')?.split(/\s{2,}|Stateroom Obstructed/i)[0]?.trim() ?? null,
    specialServices,
    offerCode,
    cruiseFare,
    taxesFees: amountAfterLabel(text, 'Taxes, fees, and port expenses') ?? amountAfterLabel(text, 'Taxes,fees,andportexpenses'),
    totalCharge: amountAfterLabel(text, 'Total Charge'),
    amountPaid: amountAfterLabel(text, 'Amount Paid'),
    balanceDue: amountAfterLabel(text, 'Balance Due'),
    discountLines,
    promotions,
    freePlay: freePlayCode ? money(freePlayCode[1]) : null,
    onboardCredit,
    casinoCompValue: Math.round(discountLines.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    warnings: [],
    confidence: 'actual',
  };
  if (!reservationId) result.warnings.push('Reservation ID was not found. Select the cruise manually.');
  if (!shipName || !sailDate) result.warnings.push('Ship or sailing date was not fully extracted.');
  if (result.cruiseFare == null) result.warnings.push('Cruise Fare was not extracted; retail value will not be overwritten.');
  if (result.totalCharge == null && result.amountPaid == null) result.warnings.push('No payment total was extracted.');
  if (!offerCode && result.discountLines.length === 0) result.warnings.push('No certificate/offer code or casino discount line was identified.');
  result.confidence = result.warnings.length === 0 ? 'actual' : reservationId && (shipName || sailDate) ? 'partial' : 'needs-review';
  return result;
}

export function scoreCruiseInvoiceMatch(invoice: ParsedCruiseInvoice, cruise: BookedCruise): number {
  let score = 0;
  const reservation = String(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber ?? '').replace(/\D/g, '');
  if (invoice.reservationId && reservation && invoice.reservationId === reservation) score += 100;
  if (invoice.shipName && cruise.shipName.toLowerCase().replace(/[^a-z0-9]/g, '') === invoice.shipName.toLowerCase().replace(/[^a-z0-9]/g, '')) score += 30;
  if (invoice.sailDate && cruise.sailDate.slice(0, 10) === invoice.sailDate) score += 40;
  return score;
}

export function buildCruiseInvoicePatch(invoice: ParsedCruiseInvoice, fileName: string, retainedUri: string): Partial<BookedCruise> {
  const netEffectivePaid = invoice.totalCharge ?? invoice.amountPaid;
  return {
    ...(invoice.reservationId ? { reservationNumber: invoice.reservationId } : {}),
    ...(invoice.nights ? { nights: invoice.nights } : {}),
    ...(invoice.stateroom ? { stateroomNumber: invoice.stateroom, cabinNumber: invoice.stateroom } : {}),
    ...(invoice.stateroomDescription ? { stateroomType: invoice.stateroomDescription } : {}),
    ...(invoice.cruiseFare != null ? { retailValue: invoice.cruiseFare, totalRetailCost: invoice.cruiseFare, originalPrice: invoice.cruiseFare } : {}),
    ...(invoice.amountPaid != null ? { amountPaid: invoice.amountPaid, pricePaid: invoice.amountPaid } : {}),
    ...(invoice.taxesFees != null ? { taxesFeesActual: invoice.taxesFees, taxesFeesEstimate: invoice.taxesFees } : {}),
    ...(netEffectivePaid != null ? { netEffectivePaid } : {}),
    ...(invoice.balanceDue != null ? { balanceDue: invoice.balanceDue } : {}),
    ...(invoice.casinoCompValue > 0 ? { totalCasinoDiscount: invoice.casinoCompValue } : {}),
    ...(invoice.offerCode ? { offerUsedCode: invoice.offerCode } : {}),
    ...(invoice.freePlay != null ? { freePlay: invoice.freePlay } : {}),
    ...(invoice.onboardCredit != null ? { freeOBC: invoice.onboardCredit } : {}),
    invoiceImportedAt: new Date().toISOString(),
    invoiceFileName: fileName,
    invoiceIssueDate: invoice.issueDate ?? undefined,
    invoiceSpecialServices: invoice.specialServices ?? undefined,
    invoicePromotions: invoice.promotions,
    invoiceCasinoDiscountLines: invoice.discountLines,
    invoiceParseConfidence: invoice.confidence,
    calculationConfidence: invoice.confidence === 'actual' ? 'actual' : 'mixed',
  };
}
