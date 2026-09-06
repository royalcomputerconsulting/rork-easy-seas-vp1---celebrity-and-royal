import * as SecureStore from 'expo-secure-store';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import type { BookedCruise } from '@/types/models';
import { parseGmailConnectionToken } from '@/lib/gmailConnectionToken';

export { parseGmailConnectionToken } from '@/lib/gmailConnectionToken';

const ENDPOINT_KEY = 'easyseas_gmail_import_endpoint_v1';
const TOKEN_KEY = 'easyseas_gmail_import_token_v1';
const HISTORY_KEY = 'easyseas_gmail_import_history_v1';
export const DEFAULT_GMAIL_IMPORT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwGBG2y0Mx5D7J1Ykkx3egtP7Mhr9qcOKjYulq4RDiTlcOxLIwhqEMTLZ5zkw_0Fhw10w/exec';

export type GmailEvidenceKind = 'invoice' | 'statement' | 'cancellation' | 'certificate' | 'booking' | 'change' | 'review' | 'irrelevant';

export interface GmailImportAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256?: string;
}

export interface GmailImportItem {
  id: string;
  sourceMessageId?: string;
  threadId: string;
  receivedAt: string;
  queuedAt: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  kind: GmailEvidenceKind;
  attachments: GmailImportAttachment[];
  status: 'pending_review';
}

export interface GmailImportConfiguration { endpoint: string; token: string }

export interface GmailEvidenceFields {
  reservationNumber: string;
  shipName: string;
  sailDate: string;
  nights: string;
  certificateCode: string;
  casinoPoints: string;
  value: string;
  documentType: string;
  refundAmount: string;
  cancellationCharges: string;
  cancellationChargesWithheld: string;
  statementTotal: string;
  casinoCharges: string;
  nonCasinoExpenses: string;
  statementBalance: string;
}

export interface GmailImportHistoryEntry {
  messageId: string;
  attachmentIds: string[];
  attachmentHashes: string[];
  decision: GmailEvidenceKind;
  appliedAt: string;
  targetId?: string;
  evidence?: Partial<GmailEvidenceFields>;
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/i.test(trimmed)) {
    throw new Error('Paste the deployed Google Apps Script Web app URL ending in /exec.');
  }
  return trimmed.split('?')[0];
}

export async function loadGmailImportConfiguration(): Promise<GmailImportConfiguration | null> {
  const [endpoint, token] = await Promise.all([
    SecureStore.getItemAsync(ENDPOINT_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  // The web-app deployment is part of Easy Seas, not user configuration.
  // Preserve older saved endpoints, but allow an existing secure token to keep
  // working after the URL field was removed from the owner-facing screen.
  return token ? { endpoint: endpoint || DEFAULT_GMAIL_IMPORT_ENDPOINT, token } : null;
}

export async function saveGmailImportConfiguration(configuration: GmailImportConfiguration): Promise<GmailImportConfiguration> {
  const endpoint = normalizeEndpoint(configuration.endpoint);
  const token = parseGmailConnectionToken(configuration.token);
  await Promise.all([
    SecureStore.setItemAsync(ENDPOINT_KEY, endpoint),
    SecureStore.setItemAsync(TOKEN_KEY, token),
  ]);
  return { endpoint, token };
}

export async function clearGmailImportConfiguration(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ENDPOINT_KEY), SecureStore.deleteItemAsync(TOKEN_KEY)]);
}

function endpointUrl(configuration: GmailImportConfiguration, parameters: Record<string, string>): string {
  const query = new URLSearchParams({ ...parameters, token: configuration.token });
  return `${configuration.endpoint}?${query.toString()}`;
}

async function readJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text().catch(() => '');
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok || !payload?.ok) {
    if (response.status === 404 || (/text\/html/i.test(contentType) && /not found|unable to open/i.test(text))) {
      throw new Error('The Gmail bridge deployment is unavailable. Open Change Gmail connection and paste the current Apps Script Web app URL ending in /exec.');
    }
    if (/text\/html/i.test(contentType)) {
      throw new Error('Google did not return Gmail data. Redeploy the Apps Script Web app with access set to Anyone, then reconnect it in Easy Seas.');
    }
    if (payload?.error === 'unauthorized') {
      throw new Error('The Gmail connection token does not match this deployment. Open Change Gmail connection and paste the token produced by authorizeAndInstall.');
    }
    throw new Error(payload?.error || `Gmail bridge returned ${response.status}.`);
  }
  return payload;
}

export async function fetchGmailImportQueue(configuration: GmailImportConfiguration): Promise<GmailImportItem[]> {
  const response = await fetch(endpointUrl(configuration, { action: 'sync' }), { method: 'GET' });
  const payload = await readJson(response);
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchGmailImportAttachment(configuration: GmailImportConfiguration, id: string): Promise<{ id: string; name: string; mimeType: string; dataBase64: string }> {
  const response = await fetch(endpointUrl(configuration, { action: 'attachment', id }), { method: 'GET' });
  const payload = await readJson(response);
  if (!payload.attachment?.dataBase64) throw new Error('The selected Gmail attachment was empty.');
  return payload.attachment;
}

export async function acknowledgeGmailImportItems(configuration: GmailImportConfiguration, ids: string[]): Promise<void> {
  const response = await fetch(configuration.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: configuration.token, action: 'acknowledge', ids }),
  });
  await readJson(response);
}

export function gmailImportHistoryKey(email: string | null): string {
  return getUserScopedKey(HISTORY_KEY, email);
}

export async function loadGmailImportHistory(email: string | null): Promise<GmailImportHistoryEntry[]> {
  return quotaSafeGetJsonItem<GmailImportHistoryEntry[]>(gmailImportHistoryKey(email), [], Array.isArray);
}

export async function addGmailImportHistory(email: string | null, entry: GmailImportHistoryEntry): Promise<void> {
  const key = gmailImportHistoryKey(email);
  const history = await quotaSafeGetJsonItem<GmailImportHistoryEntry[]>(key, [], Array.isArray);
  const next = [entry, ...history.filter((item) => item.messageId !== entry.messageId)].slice(0, 10000);
  await quotaSafeSetJsonItem(key, next);
}

export async function addGmailImportHistoryEntries(email: string | null, entries: GmailImportHistoryEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const key = gmailImportHistoryKey(email);
  const history = await quotaSafeGetJsonItem<GmailImportHistoryEntry[]>(key, [], Array.isArray);
  const incomingIds = new Set(entries.map((entry) => entry.messageId));
  await quotaSafeSetJsonItem(key, [...entries, ...history.filter((entry) => !incomingIds.has(entry.messageId))].slice(0, 10000));
}

export function filterPreviouslyHandledGmailItems(items: GmailImportItem[], history: GmailImportHistoryEntry[]): GmailImportItem[] {
  const messageIds = new Set(history.map((item) => item.messageId));
  const attachmentIds = new Set(history.flatMap((item) => item.attachmentIds));
  const attachmentHashes = new Set(history.flatMap((item) => item.attachmentHashes ?? []));
  const currentHashes = new Set<string>();
  return items.filter((item) => {
    if (messageIds.has(item.id)) return false;
    if (item.attachments.length > 0 && item.attachments.every((attachment) => attachmentIds.has(attachment.id) || Boolean(attachment.sha256 && attachmentHashes.has(attachment.sha256)))) return false;
    const hashes = item.attachments.map((attachment) => attachment.sha256).filter((value): value is string => Boolean(value));
    if (hashes.length > 0 && hashes.every((hash) => currentHashes.has(hash))) return false;
    hashes.forEach((hash) => currentHashes.add(hash));
    return true;
  });
}

export function isNormalGmailCruiseDocumentName(name: string): boolean {
  const visibleName = name.replace(/_/g, ' ');
  return /(?:Guest (?:Offer|Invoice)|Cancellation(?: Invoice)?|Cruise Statement|Final Guest Statement)\.pdf$/i.test(visibleName);
}

function firstMatch(text: string, expressions: RegExp[]): string {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseDate(value: string): string {
  const normalized = value.trim();
  const slash = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
}

export function inferGmailEvidenceFields(item: GmailImportItem): GmailEvidenceFields {
  const attachmentText = item.attachments.map((attachment) => attachment.name.replace(/_/g, ' ')).join('\n');
  const text = `${item.subject}\n${item.body}\n${attachmentText}`;
  const fileName = item.attachments[0]?.name ?? '';
  const fileReservation = fileName.match(/(?:^|_)Res-([A-Z0-9]+)(?:_|\.)/i)?.[1] ?? '';
  const fileShip = fileName.match(/_Res-[A-Z0-9]+_(.+?)_Sail-/i)?.[1]?.replace(/_/g, ' ') ?? '';
  const fileDate = fileName.match(/_Sail-(\d{4}-\d{2}-\d{2})(?:_|\.)/i)?.[1] ?? '';
  const documentType = fileName.match(/_Sail-\d{4}-\d{2}-\d{2}_(.+?)\.[^.]+$/i)?.[1]?.replace(/_/g, ' ') ?? '';
  const ship = firstMatch(text, [
    /\b([A-Z][A-Za-z' -]{1,30} of the Seas)\b/i,
    /(?:ship|vessel)\s*[:#-]?\s*([A-Za-z][A-Za-z' -]{2,45})/i,
  ]).replace(/\s+/g, ' ');
  const rawDate = firstMatch(text, [
    /(?:sail(?:ing)?|departure)\s*(?:date)?\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(?:sail(?:ing)?|departure)\s*(?:date)?\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /\b(20\d{2}-\d{2}-\d{2})\b/,
  ]);
  const money = firstMatch(text, [/(?:certificate|award|trade[- ]?in|value|total charge|amount paid)[^$\n]{0,35}\$\s*([\d,]+(?:\.\d{2})?)/i]);
  return {
    reservationNumber: firstMatch(text, [/(?:reservation|booking)(?:\s+(?:id|number))?\s*[:#-]?\s*([A-Z0-9]{5,14})/i]) || fileReservation,
    shipName: ship ? titleCase(ship) : fileShip ? titleCase(fileShip) : '',
    sailDate: parseDate(rawDate) || fileDate,
    nights: firstMatch(text, [/\b(\d{1,2})[- ]night/i, /(?:cruise duration|nights)\s*[:#-]?\s*(\d{1,2})/i]),
    certificateCode: firstMatch(text, [/\b(\d{4}[AC][A-Z0-9]{2,})\b/i, /(?:certificate|offer)(?:\s+code)?\s*[:#-]?\s*([A-Z0-9-]{5,20})/i]).toUpperCase(),
    casinoPoints: firstMatch(text, [/(?:earned|awarded|casino|club royale)?\s*([\d,]+)\s+(?:club royale\s+|casino\s+)?points/i]).replace(/,/g, ''),
    value: money.replace(/,/g, ''),
    documentType,
    refundAmount: '',
    cancellationCharges: '',
    cancellationChargesWithheld: '',
    statementTotal: '',
    casinoCharges: '',
    nonCasinoExpenses: '',
    statementBalance: '',
  };
}

export function scoreGmailCruiseMatch(fields: GmailEvidenceFields, cruise: BookedCruise): number {
  let score = 0;
  const reservation = String(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (fields.reservationNumber && reservation && fields.reservationNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === reservation) score += 100;
  if (fields.shipName && fields.shipName.replace(/[^a-z0-9]/gi, '').toLowerCase() === cruise.shipName.replace(/[^a-z0-9]/gi, '').toLowerCase()) score += 35;
  if (fields.sailDate && fields.sailDate === cruise.sailDate.slice(0, 10)) score += 45;
  return score;
}
