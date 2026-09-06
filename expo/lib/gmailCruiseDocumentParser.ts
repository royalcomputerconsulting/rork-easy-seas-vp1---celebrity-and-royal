import { extractCertificatePdfText } from '@/lib/certificates/certificatePdfPipeline';
import { decryptRoyalReceiptPdf, parseRoyalCruiseInvoicePdf } from '@/lib/casino/royalReceiptPdf';
import { parseRoyalCruiseInvoiceText, type ParsedCruiseInvoice } from '@/lib/casino/cruiseInvoiceParser';
import type { GmailEvidenceFields, GmailEvidenceKind } from '@/lib/gmailImport';

export interface GmailCruiseDocumentResult {
  kind: GmailEvidenceKind;
  fields: Partial<GmailEvidenceFields>;
  invoice: ParsedCruiseInvoice | null;
  warnings: string[];
  statement: GmailCruiseStatement | null;
}

export interface GmailCruiseStatement {
  reservationNumber: string;
  shipName: string;
  sailDate: string;
  stateroom: string;
  totalChargesAndCredits: number | null;
  totalPayments: number | null;
  balanceDue: number | null;
  casinoCharges: number;
  casinoChargeLines: { date?: string; reference?: string; description: string; amount: number }[];
  nonCasinoExpenses: number;
  expenseLines: { date?: string; description: string; amount: number }[];
}

const money = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

function amount(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}[^0-9-]{0,24}(-?[\\d,]+(?:\\.\\d{2})?)`, 'i'));
  return money(match?.[1]);
}

function totalAtEndOfAmountRow(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = text.match(new RegExp(`${escaped}\\s+((?:\\$?-?[\\d,]+(?:\\.\\d{2})?\\s+){1,8})`, 'i'))?.[1] ?? '';
  const values = Array.from(row.matchAll(/\$?(-?[\d,]+(?:\.\d{2})?)/g))
    .map((match) => money(match[1]))
    .filter((value): value is number => value !== null);
  return values.length ? values[values.length - 1] : amount(text, label);
}

function normalizedDocumentType(fileName: string): string {
  return fileName.match(/_Sail-\d{4}-\d{2}-\d{2}_(.+?)\.[^.]+$/i)?.[1]?.replace(/_/g, ' ') ?? '';
}

function titleShip(value: string): string {
  if (/^NC\s+ship\s+not\s+stated$/i.test(value.trim())) return 'NC (ship not stated)';
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\b(Of|The)\b/g, (word) => word.toLowerCase());
}

function reliableInvoiceShip(value: string | null | undefined): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 70 || /dear |nextcruise|booking \d+ to plan/i.test(normalized)) return '';
  const royal = normalized.match(/^(.+?\bof\s+the\s+seas)\b/i)?.[1];
  if (royal) return titleShip(royal);
  const celebrity = normalized.match(/^(Celebrity\s+[A-Za-z][A-Za-z'-]*)\b/i)?.[1];
  if (celebrity) return titleShip(celebrity);
  return titleShip(normalized.replace(/\s+Booking\s+Status\b.*$/i, ''));
}

export function parseGmailCruiseAttachmentName(fileName: string): Partial<GmailEvidenceFields> {
  const reservationNumber = fileName.match(/(?:^|_)Res-([A-Z0-9]+)(?:_|\.)/i)?.[1] ?? '';
  const shipName = fileName.match(/_Res-[A-Z0-9]+_(.+?)_Sail-/i)?.[1]?.replace(/_/g, ' ') ?? '';
  const sailDate = fileName.match(/_Sail-(\d{4}-\d{2}-\d{2})(?:_|\.)/i)?.[1] ?? '';
  return {
    reservationNumber,
    shipName: titleShip(shipName),
    sailDate,
    documentType: normalizedDocumentType(fileName),
  };
}

export function kindForGmailCruiseAttachment(fileName: string): GmailEvidenceKind {
  const normalized = normalizedDocumentType(fileName).toLowerCase();
  const visibleName = fileName.replace(/_/g, ' ');
  if (normalized.includes('cancellation') || /cancellation(?: invoice)?\.pdf$/i.test(visibleName)) return 'cancellation';
  if (normalized.includes('cruise statement') || /(?:cruise statement|final guest statement)\.pdf$/i.test(visibleName)) return 'statement';
  if (normalized.includes('guest invoice') || normalized.includes('guest offer') || /guest (?:invoice|offer)\.pdf$/i.test(visibleName)) return 'invoice';
  return 'irrelevant';
}

function slashDate(value: string | undefined): string {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : '';
}

export function parseGmailCruiseStatementText(text: string, fileName = ''): GmailCruiseStatement {
  const normalizedText = text
    .replace(/\bFINA\s+L\b/gi, 'FINAL')
    .replace(/\bSAI\s+L\s+DATE\b/gi, 'SAIL DATE')
    .replace(/\bS\s+TATEROOM\b/gi, 'STATEROOM')
    .replace(/\bS\s+PA\b/gi, 'SPA')
    .replace(/\bRO\s+YALE\b/gi, 'ROYALE')
    .replace(/\bPO\s+RT\b/gi, 'PORT');
  const fileFields = parseGmailCruiseAttachmentName(fileName);
  const reservationNumber = normalizedText.match(/\bBOOKING\s*(?:#|NO\.)\s*([A-Z0-9]+)/i)?.[1] ?? fileFields.reservationNumber ?? '';
  const royalShip = normalizedText.match(/^\s*([^\n\r]+?\s+of\s+the\s+Seas)\s*$/im)?.[1] ?? normalizedText.match(/^\s*([^\n\r]+?\s+of\s+the\s+Seas)\b/im)?.[1] ?? '';
  const celebrityShip = normalizedText.match(/\bCelebrity\s+([A-Z][A-Z ]{2,30})\s+BOOKING\s+NO\./i)?.[1]?.trim() ?? '';
  const shipName = royalShip || (celebrityShip ? `Celebrity ${celebrityShip.replace(/\s+/g, ' ')}` : fileFields.shipName ?? '');
  const rawSailDate = normalizedText.match(/\b(?:SAIL|EMBARKATION)\s+DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
  const totalPaymentsRaw = money(normalizedText.match(/(-?[\d,]+\.\d{2})\s+TOTAL\s+PAYMENTS/i)?.[1])
    ?? amount(normalizedText, 'TOTAL PAYMENTS');
  const chargeSection = normalizedText.split(/TOTAL\s+CHARGES\s+AND\s+CREDITS/i)[0] ?? normalizedText;
  const casinoChargeLines = Array.from(chargeSection.matchAll(/(\d{1,2}\/\d{1,2})\s+CLUB\s+ROYALE\s+ENTERTAINMENT(?:\s+GAMES)?\s+(-?[\d,]+\.\d{2})\s+(OA\d+)/gi)).map((match) => ({
    date: match[1],
    amount: money(match[2]) ?? 0,
    reference: match[3],
    description: 'Club Royale Entertainment Games',
  }));
  const expenseLines = Array.from(chargeSection.matchAll(/(-?[\d,]+\.\d{2})\s+[A-Z0-9*]+\s+(BEVERAGES|DINING|SPA|SHOPPING|REFUND\s*-\s*SPA)\s+(\d{1,2}\/\d{1,2})/gi)).map((match) => ({
    date: match[3],
    description: match[2].replace(/\s+/g, ' ').trim(),
    amount: money(match[1]) ?? 0,
  }));
  const statementTotal = amount(normalizedText, 'TOTAL CHARGES AND CREDITS')
    ?? money(normalizedText.match(/CHARGES\s+AND\s+CREDITS\s+FOR\s+.{1,80}?([\d,]+\.\d{2})/i)?.[1]);
  return {
    reservationNumber,
    shipName: titleShip(shipName.replace(/\s+/g, ' ').trim()),
    sailDate: slashDate(rawSailDate) || fileFields.sailDate || '',
    stateroom: normalizedText.match(/\bSTATEROOM\s*:?\s*([A-Z0-9-]+)/i)?.[1] ?? '',
    totalChargesAndCredits: statementTotal,
    totalPayments: totalPaymentsRaw == null ? null : Math.abs(totalPaymentsRaw),
    balanceDue: amount(normalizedText, 'BALANCE DUE'),
    casinoCharges: Math.round(casinoChargeLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    casinoChargeLines,
    nonCasinoExpenses: Math.round(expenseLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    expenseLines,
  };
}

function extractReadableText(bytes: Uint8Array): { text: string; warning?: string } {
  try {
    return { text: extractCertificatePdfText(decryptRoyalReceiptPdf(bytes)) };
  } catch (error) {
    return { text: '', warning: error instanceof Error ? error.message : String(error) };
  }
}

export function parseGmailCruiseDocumentPdf(bytes: Uint8Array, fileName: string): GmailCruiseDocumentResult {
  const kind = kindForGmailCruiseAttachment(fileName);
  const fileFields = parseGmailCruiseAttachmentName(fileName);
  const warnings: string[] = [];
  if (kind === 'irrelevant') {
    return { kind, fields: fileFields, invoice: null, statement: null, warnings: ['This document type is excluded from the owner Gmail import workflow.'] };
  }

  if (kind === 'statement') {
    const extracted = extractReadableText(bytes);
    if (extracted.warning) warnings.push(`PDF text extraction: ${extracted.warning}`);
    const statement = parseGmailCruiseStatementText(extracted.text, fileName);
    if (!statement.reservationNumber || !statement.shipName || !statement.sailDate) warnings.push('Statement identity is incomplete; choose the cruise manually.');
    if (statement.casinoChargeLines.length === 0) warnings.push('No Club Royale Entertainment charge lines were found; confirm that this is the correct final statement.');
    return {
      kind,
      fields: {
        ...fileFields,
        reservationNumber: statement.reservationNumber || fileFields.reservationNumber || '',
        shipName: statement.shipName || fileFields.shipName || '',
        sailDate: statement.sailDate || fileFields.sailDate || '',
        statementTotal: statement.totalChargesAndCredits == null ? '' : statement.totalChargesAndCredits.toFixed(2),
        casinoCharges: statement.casinoCharges.toFixed(2),
        nonCasinoExpenses: statement.nonCasinoExpenses.toFixed(2),
        statementBalance: statement.balanceDue == null ? '' : statement.balanceDue.toFixed(2),
      },
      invoice: null,
      statement,
      warnings,
    };
  }

  if (kind === 'cancellation') {
    const extracted = extractReadableText(bytes);
    if (extracted.warning) warnings.push(`PDF text extraction: ${extracted.warning}`);
    // Royal's multi-guest cancellation table lists one amount per guest and
    // then the reservation total. The last value is the authoritative total;
    // taking the first value silently under-refunded two-guest reservations.
    const totalAmountDue = totalAtEndOfAmountRow(extracted.text, 'Total Amount Due');
    const cancellationCharges = amount(extracted.text, 'Total Cancellation Charges');
    const cancellationChargesWithheld = amount(extracted.text, 'Total Amount of Cancellation Charges Withheld');
    const refundAmount = totalAmountDue == null
      ? null
      : Math.max(0, totalAmountDue - (cancellationChargesWithheld ?? cancellationCharges ?? 0));
    if (totalAmountDue == null) warnings.push('Total amount due was not readable; confirm the refund amount before applying.');
    return {
      kind,
      fields: {
        ...fileFields,
        refundAmount: refundAmount == null ? '' : refundAmount.toFixed(2),
        cancellationCharges: cancellationCharges == null ? '' : cancellationCharges.toFixed(2),
        cancellationChargesWithheld: cancellationChargesWithheld == null ? '' : cancellationChargesWithheld.toFixed(2),
      },
      invoice: null,
      statement: null,
      warnings,
    };
  }

  let invoice: ParsedCruiseInvoice | null = null;
  try {
    invoice = parseRoyalCruiseInvoicePdf(bytes);
  } catch (error) {
    const extracted = extractReadableText(bytes);
    if (extracted.text) invoice = parseRoyalCruiseInvoiceText(extracted.text);
    else warnings.push(error instanceof Error ? error.message : String(error));
  }
  if (!invoice) warnings.push('The PDF body was not readable; filename identity remains available for manual review.');
  else warnings.push(...invoice.warnings);
  const invoiceShipName = reliableInvoiceShip(invoice?.shipName);
  const fileShipName = String(fileFields.shipName ?? '').trim();
  if (/^NC\s*\(ship not stated\)$/i.test(fileShipName)) {
    warnings.push('Ship identity is not stated. Keep this document in review until a real sailing is selected.');
  }
  if (invoiceShipName && fileShipName && invoiceShipName.toLowerCase() !== fileShipName.toLowerCase()) {
    warnings.push(`Ship identity conflict: attachment metadata says ${fileShipName}, while PDF text says ${invoiceShipName}. Keeping ${fileShipName}; review before applying.`);
  }
  return {
    kind,
    fields: {
      ...fileFields,
      reservationNumber: invoice?.reservationId || fileFields.reservationNumber || '',
      shipName: fileShipName || invoiceShipName || '',
      sailDate: invoice?.sailDate || fileFields.sailDate || '',
      nights: invoice?.nights == null ? '' : String(invoice.nights),
      value: invoice?.totalCharge == null ? '' : invoice.totalCharge.toFixed(2),
    },
    invoice,
    statement: null,
    warnings,
  };
}
