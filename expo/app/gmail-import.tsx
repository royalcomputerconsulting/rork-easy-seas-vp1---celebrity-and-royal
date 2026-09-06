import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CheckCircle2, FileArchive, FileText, Mail, RefreshCcw, ShieldCheck, SkipForward } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionCard } from '@/components/ui/ThemedSectionCard';
import { EASY_SEAS_UX, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildCruiseInvoicePatch } from '@/lib/casino/cruiseInvoiceParser';
import { decodeBase64Bytes } from '@/lib/certificates/certificateBinaryTransport';
import { parseGmailCruiseDocumentPdf, type GmailCruiseDocumentResult } from '@/lib/gmailCruiseDocumentParser';
import { readLocalGmailAttachmentZip } from '@/lib/gmailZipImport';
import {
  acknowledgeGmailImportItems,
  addGmailImportHistory,
  addGmailImportHistoryEntries,
  clearGmailImportConfiguration,
  fetchGmailImportAttachment,
  fetchGmailImportQueue,
  filterPreviouslyHandledGmailItems,
  inferGmailEvidenceFields,
  isNormalGmailCruiseDocumentName,
  loadGmailImportConfiguration,
  loadGmailImportHistory,
  scoreGmailCruiseMatch,
  type GmailEvidenceFields,
  type GmailEvidenceKind,
  type GmailImportConfiguration,
  type GmailImportItem,
} from '@/lib/gmailImport';
import type { BookedCruise } from '@/types/models';
import type { ParsedCruiseInvoice } from '@/lib/casino/cruiseInvoiceParser';

const C = {
  navy: EASY_SEAS_UX.color.brandNavy,
  teal: EASY_SEAS_UX.color.oceanTeal,
  gold: '#E6B63D',
  ink: EASY_SEAS_UX.color.textStrong,
  muted: EASY_SEAS_UX.color.textMuted,
  bg: EASY_SEAS_UX.color.canvas,
  card: EASY_SEAS_UX.color.surface,
  border: EASY_SEAS_UX.color.border,
  warn: '#9A5019',
  error: '#B4232E',
};

const KINDS: { id: GmailEvidenceKind; label: string; emoji: string }[] = [
  { id: 'invoice', label: 'Invoice / receipt', emoji: '🧾' },
  { id: 'statement', label: 'Final cruise bill', emoji: '💳' },
  { id: 'cancellation', label: 'Cancellation', emoji: '🚫' },
  { id: 'certificate', label: 'Certificate earned', emoji: '🎟️' },
  { id: 'change', label: 'Booking change', emoji: '🔁' },
  { id: 'review', label: 'Needs identification', emoji: '🔎' },
  { id: 'irrelevant', label: 'Not meaningful', emoji: '⏭️' },
];

type AutomaticGmailKind = 'invoice' | 'statement' | 'cancellation';

interface PreparedGmailDocument {
  item: GmailImportItem;
  kind: AutomaticGmailKind;
  fields: GmailEvidenceFields;
  parsed: GmailCruiseDocumentResult;
  targetCruiseId?: string;
  action: 'update' | 'remove';
  source: 'gmail' | 'local-zip';
  attachmentPayload: { id: string; name: string; mimeType: string; dataBase64: string };
}

interface RejectedGmailDocument {
  item: GmailImportItem;
  fields: GmailEvidenceFields;
  reason: 'discarded' | 'unmatched';
  source: 'gmail' | 'local-zip';
}

interface GmailBatchPreview {
  documents: PreparedGmailDocument[];
  sourceItems: number;
  discarded: number;
  duplicateVersions: number;
  unmatched: number;
  rejected: RejectedGmailDocument[];
  source: 'gmail' | 'local-zip';
  sourceLabel: string;
}

function completeEvidenceFields(base: GmailEvidenceFields, patch: Partial<GmailEvidenceFields>): GmailEvidenceFields {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string' && value) (merged as Record<string, string>)[key] = value;
  }
  return merged;
}

function automaticDocumentKey(document: PreparedGmailDocument): string {
  return [document.kind, document.fields.reservationNumber, document.fields.shipName, document.fields.sailDate]
    .map((value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase())
    .join(':');
}

function nextReturnDate(sailDate: string, nights: number): string {
  const parsed = Date.parse(`${sailDate}T12:00:00`);
  if (!Number.isFinite(parsed)) return sailDate;
  return new Date(parsed + Math.max(1, nights) * 86400000).toISOString().slice(0, 10);
}

function numberValue(value: string): number | undefined {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function GmailImportScreen() {
  const router = useRouter();
  const { isAdmin, authenticatedEmail } = useAuth();
  const { bookedCruises, updateBookedCruise, removeBookedCruise } = useCoreData();
  const { searchableCertificates, addCertificate, updateCertificate } = useCertificates();
  const [configuration, setConfiguration] = useState<GmailImportConfiguration | null>(null);
  const [items, setItems] = useState<GmailImportItem[]>([]);
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<GmailEvidenceKind>('review');
  const [fields, setFields] = useState<GmailEvidenceFields>({ reservationNumber: '', shipName: '', sailDate: '', nights: '', certificateCode: '', casinoPoints: '', value: '', documentType: '', refundAmount: '', cancellationCharges: '', cancellationChargesWithheld: '', statementTotal: '', casinoCharges: '', nonCasinoExpenses: '', statementBalance: '' });
  const [parsedInvoice, setParsedInvoice] = useState<ParsedCruiseInvoice | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [selectedCruiseId, setSelectedCruiseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSource, setMessageSource] = useState<'gmail' | 'local-zip' | null>(null);
  const [batchPreview, setBatchPreview] = useState<GmailBatchPreview | null>(null);
  const [preparingProgress, setPreparingProgress] = useState({ processed: 0, total: 0 });
  const localZipPayloadsRef = useRef(new Map<string, string>());
  const item = items[index] ?? null;

  const rankedCruises = useMemo(() => bookedCruises
    .map((cruise) => ({ cruise, score: scoreGmailCruiseMatch(fields, cruise) }))
    .sort((left, right) => right.score - left.score || left.cruise.sailDate.localeCompare(right.cruise.sailDate)), [bookedCruises, fields]);

  const batchCounts = useMemo(() => ({
    invoices: batchPreview?.documents.filter((document) => document.kind === 'invoice').length ?? 0,
    statements: batchPreview?.documents.filter((document) => document.kind === 'statement').length ?? 0,
    cancellations: batchPreview?.documents.filter((document) => document.kind === 'cancellation').length ?? 0,
    updates: batchPreview?.documents.filter((document) => document.action === 'update').length ?? 0,
    removals: batchPreview?.documents.filter((document) => document.action === 'remove').length ?? 0,
  }), [batchPreview]);

  useEffect(() => {
    void loadGmailImportConfiguration().then((saved) => {
      setConfiguration(saved);
    });
  }, []);

  useEffect(() => {
    if (!item) return;
    let live = true;
    const inferred = inferGmailEvidenceFields(item);
    const nextKind = item.kind === 'review' ? 'review' : item.kind;
    const ranked = bookedCruises.map((cruise) => ({ cruise, score: scoreGmailCruiseMatch(inferred, cruise) })).sort((a, b) => b.score - a.score);
    setKind(nextKind);
    setFields(inferred);
    setSelectedCruiseId(ranked[0]?.score > 0 ? ranked[0].cruise.id : '');
    setParsedInvoice(null);
    setParseWarnings([]);
    setMessage('');
    const attachment = item.attachments.find((candidate) => candidate.mimeType === 'application/pdf' || /\.pdf$/i.test(candidate.name));
    if (configuration && attachment && ['invoice', 'statement', 'cancellation'].includes(nextKind)) {
      void fetchGmailImportAttachment(configuration, attachment.id).then((remote) => {
        if (!live) return;
        const parsed = parseGmailCruiseDocumentPdf(decodeBase64Bytes(remote.dataBase64), attachment.name);
        const merged = { ...inferred };
        for (const [key, value] of Object.entries(parsed.fields)) {
          if (typeof value === 'string' && value) (merged as Record<string, string>)[key] = value;
        }
        setFields(merged);
        setKind(parsed.kind);
        setParsedInvoice(parsed.invoice);
        setParseWarnings(parsed.warnings);
        const parsedRanked = bookedCruises.map((cruise) => ({ cruise, score: scoreGmailCruiseMatch(merged, cruise) })).sort((a, b) => b.score - a.score);
        setSelectedCruiseId(parsedRanked[0]?.score > 0 ? parsedRanked[0].cruise.id : '');
      }).catch((error) => {
        if (live) setParseWarnings([error instanceof Error ? error.message : String(error)]);
      });
    }
    return () => { live = false; };
  }, [bookedCruises, configuration, item]);

  const readAttachment = useCallback(async (active: GmailImportConfiguration | null, attachment: GmailImportItem['attachments'][number]) => {
    const localPayload = localZipPayloadsRef.current.get(attachment.id);
    if (localPayload) return { id: attachment.id, name: attachment.name, mimeType: attachment.mimeType, dataBase64: localPayload };
    if (!active) throw new Error('The selected attachment is no longer available. Select the ZIP again.');
    return fetchGmailImportAttachment(active, attachment.id);
  }, []);

  const prepareAutomaticBatch = useCallback(async (active: GmailImportConfiguration | null, pending: GmailImportItem[], source: 'gmail' | 'local-zip'): Promise<GmailBatchPreview> => {
    const ordered = [...pending].sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt));
    const parsedDocuments: PreparedGmailDocument[] = [];
    const rejected: RejectedGmailDocument[] = [];
    setPreparingProgress({ processed: 0, total: ordered.length });

    for (let start = 0; start < ordered.length; start += 4) {
      const batch = ordered.slice(start, start + 4);
      const results = await Promise.all(batch.map(async (candidate) => {
        const attachment = candidate.attachments.find((entry) => /\.pdf$/i.test(entry.name));
        const inferred = inferGmailEvidenceFields(candidate);
        if (!attachment || !isNormalGmailCruiseDocumentName(attachment.name)) {
          return { rejected: { item: candidate, fields: inferred, reason: 'discarded' as const, source } };
        }
        try {
          const remote = await readAttachment(active, attachment);
          const parsed = parseGmailCruiseDocumentPdf(decodeBase64Bytes(remote.dataBase64), remote.name);
          const fields = completeEvidenceFields(inferred, parsed.fields);
          if (!['invoice', 'statement', 'cancellation'].includes(parsed.kind)) {
            return { rejected: { item: candidate, fields, reason: 'discarded' as const, source } };
          }
          const identityIsComplete = Boolean(fields.reservationNumber && fields.shipName && fields.sailDate)
            && !/^NC\b|not stated|needs review/i.test(fields.shipName);
          const normalBody = parsed.kind === 'invoice'
            ? Boolean(parsed.invoice && parsed.invoice.nights && parsed.invoice.nights > 0)
            : parsed.kind === 'statement'
              ? Boolean(parsed.statement && parsed.statement.totalChargesAndCredits != null)
              : fields.refundAmount !== '' && Number.isFinite(numberValue(fields.refundAmount));
          if (!identityIsComplete || !normalBody) {
            return { rejected: { item: candidate, fields, reason: 'discarded' as const, source } };
          }
          const ranked = bookedCruises
            .map((cruise) => ({ cruise, score: scoreGmailCruiseMatch(fields, cruise) }))
            .sort((left, right) => right.score - left.score);
          const targetCruiseId = ranked[0]?.score >= 80 ? ranked[0].cruise.id : undefined;
          if (!targetCruiseId) {
            return { rejected: { item: candidate, fields, reason: 'unmatched' as const, source } };
          }
          return {
            prepared: {
              item: candidate,
              kind: parsed.kind as AutomaticGmailKind,
              fields,
              parsed,
              targetCruiseId,
              action: parsed.kind === 'cancellation' ? 'remove' as const : 'update' as const,
              source,
              attachmentPayload: remote,
            },
          };
        } catch {
          return { rejected: { item: candidate, fields: inferred, reason: 'discarded' as const, source } };
        }
      }));
      results.forEach((result) => {
        if ('prepared' in result && result.prepared) parsedDocuments.push(result.prepared);
        else if ('rejected' in result && result.rejected) rejected.push(result.rejected);
      });
      setPreparingProgress({ processed: Math.min(start + batch.length, ordered.length), total: ordered.length });
    }

    const newestDocuments: PreparedGmailDocument[] = [];
    const documentKeys = new Set<string>();
    let duplicateVersions = 0;
    parsedDocuments.forEach((document) => {
      const key = automaticDocumentKey(document);
      if (documentKeys.has(key)) {
        duplicateVersions += 1;
        rejected.push({ item: document.item, fields: document.fields, reason: 'discarded', source });
        return;
      }
      documentKeys.add(key);
      newestDocuments.push(document);
    });

    return {
      documents: newestDocuments,
      sourceItems: ordered.length,
      discarded: rejected.filter((entry) => entry.reason === 'discarded').length,
      duplicateVersions,
      unmatched: rejected.filter((entry) => entry.reason === 'unmatched').length,
      rejected,
      source,
      sourceLabel: source === 'gmail' ? 'Gmail' : 'local Gmail ZIP',
    };
  }, [bookedCruises, readAttachment]);

  const sync = useCallback(async (explicit?: GmailImportConfiguration) => {
    const active = explicit ?? configuration;
    if (!active) {
      setMessageSource('gmail');
      setMessage('Direct Gmail sync is not connected in this build. Import the Gmail attachment ZIP below to process the same offers, invoices, cancellations, and statements without signing in.');
      Alert.alert('Gmail sync needs a private bridge', 'This TestFlight app cannot safely reuse the Codex Gmail session or store a hidden Gmail credential. Use the local Gmail attachment ZIP importer below, or install the owner Apps Script bridge once.');
      return;
    }
    setBusy(true); setMessage(''); setMessageSource('gmail');
    try {
      const [queue, history] = await Promise.all([fetchGmailImportQueue(active), loadGmailImportHistory(authenticatedEmail)]);
      const pending = filterPreviouslyHandledGmailItems(queue, history);
      const pendingIds = new Set(pending.map((entry) => entry.id));
      const alreadyHandledIds = queue.filter((entry) => !pendingIds.has(entry.id)).map((entry) => entry.id);
      if (alreadyHandledIds.length) {
        // Keep the remote queue tidy even when an attachment was already handled
        // under another Gmail message and was rejected by its durable SHA-256 hash.
        await acknowledgeGmailImportItems(active, alreadyHandledIds);
      }
      setItems([]); setIndex(0); setBatchPreview(null);
      if (pending.length === 0) {
        setMessage('No new Gmail evidence. Previously handled messages were skipped.');
      } else {
        setMessage(`Reading ${pending.length} Gmail document${pending.length === 1 ? '' : 's'}…`);
        const preview = await prepareAutomaticBatch(active, pending, 'gmail');
        setBatchPreview(preview);
        setMessage(preview.documents.length
          ? `${preview.documents.length} verified document${preview.documents.length === 1 ? '' : 's'} ready for one approval.`
          : 'No new documents matched the normal verified formats. Nothing will be changed.');
      }
    } catch (error) {
      Alert.alert('Gmail sync failed', error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }, [authenticatedEmail, configuration, prepareAutomaticBatch]);

  const importLocalZip = useCallback(async () => {
    setBusy(true);
    setMessageSource('local-zip');
    setMessage('Opening local Gmail attachment ZIP…');
    setBatchPreview(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) {
        setMessage('ZIP import cancelled. No data changed.');
        return;
      }
      const asset = result.assets[0];
      const zipBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const localItems = await readLocalGmailAttachmentZip(zipBase64, (processed, total) => setPreparingProgress({ processed, total }));
      localZipPayloadsRef.current.clear();
      localItems.forEach((entry) => localZipPayloadsRef.current.set(entry.attachmentId, entry.dataBase64));
      const history = await loadGmailImportHistory(authenticatedEmail);
      const pending = filterPreviouslyHandledGmailItems(localItems.map((entry) => entry.item), history);
      setMessage(pending.length
        ? `Reading ${pending.length} new PDF attachment${pending.length === 1 ? '' : 's'} from ${asset.name}…`
        : 'Every PDF in this ZIP was already handled. Nothing will be imported twice.');
      if (pending.length === 0) return;
      const preview = await prepareAutomaticBatch(null, pending, 'local-zip');
      setBatchPreview(preview);
      setMessage(preview.documents.length
        ? `${preview.documents.length} verified document${preview.documents.length === 1 ? '' : 's'} from the ZIP ready for one approval.`
        : 'No new ZIP documents matched a saved cruise and the normal verified formats. Nothing will be changed.');
    } catch (error) {
      Alert.alert('ZIP import failed', error instanceof Error ? error.message : String(error));
      setMessage('The ZIP was not applied. Existing app data is unchanged.');
    } finally {
      setBusy(false);
    }
  }, [authenticatedEmail, prepareAutomaticBatch]);

  const finishItem = useCallback(async (decision: GmailEvidenceKind, targetId?: string) => {
    if (!item || !configuration) return;
    await addGmailImportHistory(authenticatedEmail, {
      messageId: item.id,
      attachmentIds: item.attachments.map((attachment) => attachment.id),
      attachmentHashes: item.attachments.map((attachment) => attachment.sha256).filter((value): value is string => Boolean(value)),
      decision,
      appliedAt: new Date().toISOString(),
      targetId,
      evidence: fields,
    });
    try { await acknowledgeGmailImportItems(configuration, [item.id]); } catch (error) {
      console.warn('[GmailImport] Local decision persisted; remote acknowledgement will retry safely.', error);
    }
    const next = items.filter((candidate) => candidate.id !== item.id);
    setItems(next);
    setIndex(Math.min(index, Math.max(0, next.length - 1)));
  }, [authenticatedEmail, configuration, fields, index, item, items]);

  const applyAutomaticBatch = useCallback(() => {
    if (!batchPreview || batchPreview.documents.length === 0) return;
    const summary = [
      `${batchCounts.invoices} Guest Offer/Invoice`,
      `${batchCounts.statements} Cruise Statement`,
      `${batchCounts.cancellations} Cancellation`,
      '',
      `${batchCounts.updates} cruises updated`,
      `${batchCounts.removals} cancelled cruises removed`,
      `${batchPreview.discarded + batchPreview.unmatched} nonmatching or unusable items discarded`,
    ].join('\n');
    const execute = async () => {
      setBusy(true);
      setPreparingProgress({ processed: 0, total: batchPreview.documents.length });
      const knownCruises = [...bookedCruises];
      const successful: { document: PreparedGmailDocument; targetId?: string }[] = [];
      const failed: PreparedGmailDocument[] = [];
      const ordered = [...batchPreview.documents].sort((left, right) => {
        const order: Record<AutomaticGmailKind, number> = { invoice: 0, statement: 1, cancellation: 2 };
        return order[left.kind] - order[right.kind] || Date.parse(left.item.receivedAt) - Date.parse(right.item.receivedAt);
      });
      try {
        for (let documentIndex = 0; documentIndex < ordered.length; documentIndex += 1) {
          const document = ordered[documentIndex];
          try {
            const attachment = document.item.attachments.find((entry) => /\.pdf$/i.test(entry.name));
            if (!attachment) throw new Error('Verified PDF attachment is missing.');
            let target = document.targetCruiseId ? knownCruises.find((cruise) => cruise.id === document.targetCruiseId) : undefined;
            if (!target) {
              const rankedTarget = knownCruises
                .map((cruise) => ({ cruise, score: scoreGmailCruiseMatch(document.fields, cruise) }))
                .sort((left, right) => right.score - left.score)[0];
              target = rankedTarget?.score >= 80 ? rankedTarget.cruise : undefined;
            }

            if (document.kind === 'cancellation') {
              if (!target) throw new Error('Cancellation no longer matches a saved cruise.');
              removeBookedCruise(target.id);
              const targetId = target.id;
              const knownIndex = knownCruises.findIndex((cruise) => cruise.id === targetId);
              if (knownIndex >= 0) knownCruises.splice(knownIndex, 1);
              successful.push({ document, targetId });
              continue;
            }

            const remote = document.attachmentPayload;
            const base = FileSystem.documentDirectory;
            if (!base) throw new Error('Local document storage is unavailable.');

            if (document.kind === 'invoice') {
              const invoice = document.parsed.invoice;
              if (!invoice) throw new Error('Verified invoice data is missing.');
              if (!target) throw new Error('Invoice no longer matches a saved cruise.');
              const cruiseId = target.id;
              const folder = `${base}EasySeasInvoices/${cruiseId}/`;
              await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
              const safeName = remote.name.replace(/[^A-Za-z0-9._-]/g, '_');
              const retainedUri = `${folder}gmail-${document.item.id}-${safeName}`;
              await FileSystem.writeAsStringAsync(retainedUri, remote.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
              const invoicePatch = buildCruiseInvoicePatch(invoice, remote.name, retainedUri);
              const patch = {
                ...invoicePatch,
                documents: Array.from(new Set([...(target.documents ?? []), retainedUri])),
                sourceEvidence: { sourcePage: document.source === 'gmail' ? 'Gmail Import' : 'Local Gmail ZIP Import', sourceRecordId: document.item.id, capturedAt: document.item.receivedAt, authority: 'verified_local' as const, reason: 'Owner-approved invoice/offer evidence import.' },
              };
              updateBookedCruise(target.id, patch);
              Object.assign(target, patch);
              successful.push({ document, targetId: target.id });
            } else if (document.kind === 'statement') {
              if (!target || !document.parsed.statement) throw new Error('Cruise Statement no longer matches a saved cruise.');
              const statement = document.parsed.statement;
              const folder = `${base}EasySeasStatements/${target.id}/`;
              await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
              const safeName = remote.name.replace(/[^A-Za-z0-9._-]/g, '_');
              const retainedUri = `${folder}gmail-${document.item.id}-${safeName}`;
              await FileSystem.writeAsStringAsync(retainedUri, remote.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
              const patch = {
                casinoChargesRoomBilled: statement.casinoCharges,
                onboardStatementTotal: statement.totalChargesAndCredits ?? undefined,
                onboardStatementBalanceDue: statement.balanceDue ?? undefined,
                onboardStatementImportedAt: new Date().toISOString(),
                onboardStatementFileName: remote.name,
                onboardCasinoChargeLines: statement.casinoChargeLines,
                onboardNonCasinoExpenses: statement.nonCasinoExpenses,
                onboardExpenseLines: statement.expenseLines,
                ...(statement.stateroom ? { stateroomNumber: statement.stateroom, cabinNumber: statement.stateroom } : {}),
                documents: Array.from(new Set([...(target.documents ?? []), retainedUri])),
                sourceEvidence: { sourcePage: document.source === 'gmail' ? 'Gmail Import' : 'Local Gmail ZIP Import', sourceRecordId: document.item.id, capturedAt: document.item.receivedAt, authority: 'verified_local' as const, reason: 'Owner-approved final Cruise Statement import.' },
                calculationConfidence: 'actual' as const,
              };
              updateBookedCruise(target.id, patch);
              Object.assign(target, patch);
              successful.push({ document, targetId: target.id });
            }
          } catch {
            failed.push(document);
          } finally {
            setPreparingProgress({ processed: documentIndex + 1, total: ordered.length });
          }
        }

        if (successful.length > 0 || batchPreview.rejected.length > 0) {
          const appliedAt = new Date().toISOString();
          await addGmailImportHistoryEntries(authenticatedEmail, [
            ...successful.map(({ document, targetId }) => ({
              messageId: document.item.id,
              attachmentIds: document.item.attachments.map((attachment) => attachment.id),
              attachmentHashes: document.item.attachments.map((attachment) => attachment.sha256).filter((value): value is string => Boolean(value)),
              decision: document.kind,
              appliedAt,
              targetId,
              evidence: document.fields,
            })),
            ...batchPreview.rejected.map(({ item: rejectedItem, fields: rejectedFields }) => ({
              messageId: rejectedItem.id,
              attachmentIds: rejectedItem.attachments.map((attachment) => attachment.id),
              attachmentHashes: rejectedItem.attachments.map((attachment) => attachment.sha256).filter((value): value is string => Boolean(value)),
              decision: 'irrelevant' as const,
              appliedAt,
              evidence: rejectedFields,
            })),
          ]);
          if (configuration && batchPreview.source === 'gmail') {
            await acknowledgeGmailImportItems(configuration, [
              ...successful.map(({ document }) => document.item.id),
              ...batchPreview.rejected.map(({ item: rejectedItem }) => rejectedItem.id),
            ]);
          }
        }
        setBatchPreview(failed.length ? { ...batchPreview, documents: failed } : null);
        setMessageSource(batchPreview.source);
        setMessage(failed.length
          ? `${successful.length} documents synced. ${failed.length} could not be applied and remain untouched.`
          : `${successful.length} verified ${batchPreview.sourceLabel} document${successful.length === 1 ? '' : 's'} synced successfully.`);
      } finally {
        setBusy(false);
      }
    };
    Alert.alert(`Sync verified ${batchPreview.sourceLabel} documents?`, summary, [
      { text: 'Not yet', style: 'cancel' },
      { text: `Sync ${batchPreview.documents.length}`, onPress: () => void execute() },
    ]);
  }, [authenticatedEmail, batchCounts, batchPreview, bookedCruises, configuration, removeBookedCruise, updateBookedCruise]);

  const apply = useCallback(async () => {
    if (!item) return;
    if (kind === 'review') {
      Alert.alert('Identify this message', 'Choose what this message represents, or mark it Not meaningful.');
      return;
    }
    const selected = bookedCruises.find((cruise) => cruise.id === selectedCruiseId) ?? null;
    if (['invoice', 'statement', 'cancellation', 'change'].includes(kind) && !selected) {
      Alert.alert('Choose a cruise', 'This action must be tied to one saved cruise before it can be applied.');
      return;
    }
    const execute = async () => {
      setBusy(true);
      try {
        if (kind === 'invoice' && selected) {
          const pdf = item.attachments.find((attachment) => attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.name));
          if (!pdf) throw new Error('No PDF attachment was found. Choose another classification or mark this item for review.');
          const remote = await fetchGmailImportAttachment(configuration!, pdf.id);
          const document = parsedInvoice ? { invoice: parsedInvoice, warnings: parseWarnings } : parseGmailCruiseDocumentPdf(decodeBase64Bytes(remote.dataBase64), pdf.name);
          const parsed = document.invoice;
          if (!parsed) throw new Error('This invoice did not contain readable financial data. Keep it in review and enter its values manually instead of applying an empty record.');
          const base = FileSystem.documentDirectory;
          if (!base) throw new Error('Local document storage is unavailable.');
          const folder = `${base}EasySeasInvoices/${selected.id}/`;
          await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
          const safeName = remote.name.replace(/[^A-Za-z0-9._-]/g, '_');
          const retainedUri = `${folder}gmail-${item.id}-${safeName}`;
          await FileSystem.writeAsStringAsync(retainedUri, remote.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
          updateBookedCruise(selected.id, { ...buildCruiseInvoicePatch(parsed, remote.name, retainedUri), documents: Array.from(new Set([...(selected.documents ?? []), retainedUri])), sourceEvidence: { sourcePage: 'Gmail Import', sourceRecordId: item.id, capturedAt: item.receivedAt, authority: 'verified_local', reason: 'Owner-approved Gmail invoice/receipt import.' } });
          await finishItem(kind, selected.id);
        } else if (kind === 'statement' && selected) {
          const pdf = item.attachments.find((attachment) => attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.name));
          if (!pdf) throw new Error('No final-statement PDF was found.');
          const remote = await fetchGmailImportAttachment(configuration!, pdf.id);
          const document = parseGmailCruiseDocumentPdf(decodeBase64Bytes(remote.dataBase64), pdf.name);
          if (!document.statement) throw new Error('The final statement could not be read. Keep it in review rather than applying an empty bill.');
          const base = FileSystem.documentDirectory;
          if (!base) throw new Error('Local document storage is unavailable.');
          const folder = `${base}EasySeasStatements/${selected.id}/`;
          await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
          const safeName = remote.name.replace(/[^A-Za-z0-9._-]/g, '_');
          const retainedUri = `${folder}gmail-${item.id}-${safeName}`;
          await FileSystem.writeAsStringAsync(retainedUri, remote.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
          updateBookedCruise(selected.id, {
            casinoChargesRoomBilled: numberValue(fields.casinoCharges) ?? document.statement.casinoCharges,
            onboardStatementTotal: numberValue(fields.statementTotal) ?? document.statement.totalChargesAndCredits ?? undefined,
            onboardStatementBalanceDue: numberValue(fields.statementBalance) ?? document.statement.balanceDue ?? undefined,
            onboardStatementImportedAt: new Date().toISOString(),
            onboardStatementFileName: remote.name,
            onboardCasinoChargeLines: document.statement.casinoChargeLines,
            onboardNonCasinoExpenses: numberValue(fields.nonCasinoExpenses) ?? document.statement.nonCasinoExpenses,
            onboardExpenseLines: document.statement.expenseLines,
            ...(document.statement.stateroom ? { stateroomNumber: document.statement.stateroom, cabinNumber: document.statement.stateroom } : {}),
            documents: Array.from(new Set([...(selected.documents ?? []), retainedUri])),
            sourceEvidence: { sourcePage: 'Gmail Import', sourceRecordId: item.id, capturedAt: item.receivedAt, authority: 'verified_local', reason: 'Owner-approved final cruise statement with exact Club Royale Entertainment charges.' },
            calculationConfidence: 'actual',
          });
          await finishItem(kind, selected.id);
        } else if (kind === 'cancellation' && selected) {
          removeBookedCruise(selected.id);
          await finishItem(kind, selected.id);
        } else if (kind === 'certificate') {
          const points = numberValue(fields.casinoPoints);
          const value = numberValue(fields.value) ?? 0;
          const certificatePatch = {
            type: 'freeplay',
            label: fields.certificateCode ? `${fields.certificateCode} Casino Certificate` : item.subject || 'Gmail casino certificate',
            certificateCode: fields.certificateCode || undefined,
            value,
            tradeInValue: value || undefined,
            pointRequirement: points,
            pointsRequired: points,
            pointsEarnedEstimate: points,
            sailingDate: fields.sailDate || undefined,
            shipName: fields.shipName || undefined,
            cruiseId: selected?.id,
            earnedOnCruise: selected?.shipName,
            earningLinkState: selected ? 'confirmed' : 'unlinked',
            earningMatchConfidence: selected ? 'high' : 'low',
            earningMatchReason: selected ? 'Owner matched Gmail certificate evidence to this cruise.' : 'No cruise selected during Gmail review.',
            description: `Imported from owner-approved Gmail evidence received ${item.receivedAt}. Message: ${item.subject}`,
            status: 'available',
            parserSource: 'manual',
            parserStatus: fields.certificateCode ? 'parsed' : 'needs_review',
            parsedAt: new Date().toISOString(),
          } as const;
          const existingCertificate = fields.certificateCode
            ? searchableCertificates.find((certificate) => certificate.certificateCode?.toUpperCase() === fields.certificateCode.toUpperCase())
            : undefined;
          if (existingCertificate) updateCertificate(existingCertificate.id, certificatePatch);
          else addCertificate(certificatePatch);
          if (selected && points !== undefined) updateBookedCruise(selected.id, { casinoPoints: points, earnedPoints: points, instantCertificateWon: true, instantCertificateOfferCode: fields.certificateCode || undefined, instantCertificateValue: value || undefined, certificateEvidenceCode: fields.certificateCode || undefined });
          await finishItem(kind, selected?.id);
        } else if (kind === 'change' && selected) {
          const nights = numberValue(fields.nights);
          updateBookedCruise(selected.id, {
            ...(fields.reservationNumber ? { reservationNumber: fields.reservationNumber } : {}),
            ...(fields.shipName ? { shipName: fields.shipName } : {}),
            ...(fields.sailDate ? { sailDate: fields.sailDate } : {}),
            ...(fields.sailDate && nights ? { returnDate: nextReturnDate(fields.sailDate, nights) } : {}),
            ...(nights ? { nights } : {}),
            sourceRecordId: item.id,
            sourceRetrievedAt: item.receivedAt,
            sourceAuthority: 'verified_local',
            dataConfidence: 'partial',
          });
          await finishItem(kind, selected.id);
        } else if (kind === 'irrelevant') {
          await finishItem(kind);
        }
      } catch (error) {
        Alert.alert('Gmail item was not applied', error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    if (kind === 'cancellation' && selected) {
      Alert.alert('Remove cancelled cruise?', `${selected.shipName} · ${selected.sailDate}\n\nThe Gmail message will be permanently marked handled and this cruise will be removed from Booked Cruises.`, [{ text: 'Keep cruise', style: 'cancel' }, { text: 'Remove cancelled cruise', style: 'destructive', onPress: () => void execute() }]);
      return;
    }
    await execute();
  }, [addCertificate, bookedCruises, configuration, fields, finishItem, item, kind, parseWarnings, parsedInvoice, rankedCruises, removeBookedCruise, searchableCertificates, selectedCruiseId, updateBookedCruise, updateCertificate]);

  if (!isAdmin) return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={styles.center}><ShieldCheck size={42} color={C.navy} /><Text style={styles.deniedTitle}>Admin use only</Text><Text style={styles.deniedText}>Gmail evidence import is available only to the Easy Seas owner account.</Text></SafeAreaView></View>;

  return <LinearGradient colors={[C.bg, EASY_SEAS_UX.color.sand]} style={styles.root}>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ResponsiveContainer>
          <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={C.navy} size={21} /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>ADMIN USE ONLY</Text><Text style={styles.title}>Sync Gmail</Text><Text style={styles.subtitle}>Read known cruise documents, preview the totals once, then approve one safe batch.</Text></View></View>

          <ThemedSectionCard tab="settings" emoji="📬" title="Gmail document sync" subtitle="Admin-only scan · duplicates import only once" compact>
            <View style={styles.statusRow}>
              {configuration ? <CheckCircle2 size={18} color={C.teal} /> : <Mail size={18} color={C.teal} />}
              <Text style={styles.statusText}>{configuration ? `Connected privately for ${authenticatedEmail}` : 'Tap Sync Gmail if the private bridge is installed, or use the ZIP importer below with no sign-in and no keys.'}</Text>
            </View>
            <TouchableOpacity testID="gmail-sync-now" style={styles.primary} onPress={() => void sync()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <RefreshCcw color="#fff" size={18} />}<Text style={styles.primaryText}>SYNC GMAIL</Text></TouchableOpacity>
            {configuration ? <TouchableOpacity style={styles.disconnect} onPress={() => { void clearGmailImportConfiguration().then(() => { setConfiguration(null); setItems([]); setBatchPreview(null); }); }}><Text style={styles.disconnectText}>Reset Gmail bridge</Text></TouchableOpacity> : null}
            {message && messageSource === 'gmail' ? <Text style={styles.message}>{message}</Text> : null}
          </ThemedSectionCard>

          <ThemedSectionCard tab="settings" emoji="🗂️" title="Import Gmail attachment ZIP" subtitle="Works locally without Gmail sign-in, codes, or keys" compact>
            <Text style={styles.help}>Select a ZIP you created from Gmail attachments. Easy Seas reads Guest Offers/Invoices, Cancellation Invoices, and Cruise Statements on this iPhone, discards unrelated formats, skips anything already handled, and shows one summary before changing any cruise.</Text>
            <TouchableOpacity testID="gmail-import-local-zip" style={styles.localZipButton} onPress={() => void importLocalZip()} disabled={busy}>{busy ? <ActivityIndicator color={C.navy} /> : <FileArchive color={C.navy} size={18} />}<Text style={styles.localZipButtonText}>SELECT LOCAL ATTACHMENT ZIP</Text></TouchableOpacity>
            {message && messageSource === 'local-zip' ? <Text style={styles.message}>{message}</Text> : null}
          </ThemedSectionCard>

          {busy && preparingProgress.total > 0 ? <ThemedSectionCard tab="settings" emoji="⚓️" title="Reading cruise documents" subtitle={`${preparingProgress.processed} of ${preparingProgress.total}`} compact>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((preparingProgress.processed / preparingProgress.total) * 100)}%` }]} /></View>
            <Text style={styles.help}>Checking identity, sailing date, reservation, totals, and normal document structure.</Text>
          </ThemedSectionCard> : null}

          {batchPreview ? <ThemedSectionCard tab="settings" emoji="✅" title="Ready to sync" subtitle="Review these counts before Easy Seas changes" compact>
            <View style={styles.batchGrid}>
              <View style={styles.batchMetric}><Text style={styles.batchValue}>{batchCounts.invoices}</Text><Text style={styles.batchLabel}>Offers / invoices</Text></View>
              <View style={styles.batchMetric}><Text style={styles.batchValue}>{batchCounts.statements}</Text><Text style={styles.batchLabel}>Statements</Text></View>
              <View style={styles.batchMetric}><Text style={styles.batchValue}>{batchCounts.cancellations}</Text><Text style={styles.batchLabel}>Cancellations</Text></View>
            </View>
            <View style={styles.batchActionRow}><Text style={styles.batchAction}>↻ {batchCounts.updates} update</Text><Text style={styles.batchAction}>⊘ {batchCounts.removals} remove</Text></View>
            <Text style={styles.discardNote}>{batchPreview.discarded + batchPreview.unmatched} nonmatching, unreadable, duplicate, or unmatched item{batchPreview.discarded + batchPreview.unmatched === 1 ? '' : 's'} discarded safely.</Text>
            <TouchableOpacity testID="gmail-approve-batch" style={styles.primary} onPress={applyAutomaticBatch} disabled={busy}><CheckCircle2 color="#fff" size={18} /><Text style={styles.primaryText}>APPROVE AND SYNC {batchPreview.documents.length}</Text></TouchableOpacity>
          </ThemedSectionCard> : null}

          {item ? <>
            <ThemedSectionCard tab="settings" emoji="🔎" title={`Review ${index + 1} of ${items.length}`} subtitle="Confirm, correct, or disqualify this evidence" compact>
              <Text style={styles.subject}>{item.subject || 'No subject'}</Text><Text style={styles.meta}>{item.from} · {new Date(item.receivedAt).toLocaleString()}</Text>
              <Text style={styles.bodyPreview} numberOfLines={8}>{item.body || 'No plain-text body was available.'}</Text>
              {item.attachments.map((attachment) => <View key={attachment.id} style={styles.attachment}><FileText size={16} color={C.teal} /><Text style={styles.attachmentText}>{attachment.name} · {Math.ceil(attachment.size / 1024).toLocaleString()} KB</Text></View>)}
              <Text style={styles.fieldLabel}>What is it?</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>{KINDS.map((option) => <TouchableOpacity key={option.id} style={[styles.kindChip, kind === option.id && styles.kindChipActive]} onPress={() => setKind(option.id)}><Text style={styles.kindEmoji}>{option.emoji}</Text><Text style={[styles.kindText, kind === option.id && styles.kindTextActive]}>{option.label}</Text></TouchableOpacity>)}</ScrollView>
            </ThemedSectionCard>

            {kind !== 'irrelevant' && kind !== 'review' ? <ThemedSectionCard tab="settings" emoji="🧭" title="Extracted evidence" subtitle="Edit anything Gmail did not identify correctly" compact>
              <EvidenceInput label="Reservation" value={fields.reservationNumber} onChange={(value) => setFields((current) => ({ ...current, reservationNumber: value }))} />
              <EvidenceInput label="Ship" value={fields.shipName} onChange={(value) => setFields((current) => ({ ...current, shipName: value }))} />
              <EvidenceInput label="Sail date" value={fields.sailDate} onChange={(value) => setFields((current) => ({ ...current, sailDate: value }))} placeholder="YYYY-MM-DD" />
              <EvidenceInput label="Nights" value={fields.nights} onChange={(value) => setFields((current) => ({ ...current, nights: value }))} />
              {fields.documentType ? <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>Document type</Text><Text style={styles.extractedValue}>{fields.documentType}</Text></View> : null}
              {kind === 'cancellation' ? <><EvidenceInput label="Full refund" value={fields.refundAmount} onChange={(value) => setFields((current) => ({ ...current, refundAmount: value }))} /><EvidenceInput label="Cancellation charge" value={fields.cancellationCharges} onChange={(value) => setFields((current) => ({ ...current, cancellationCharges: value }))} /><EvidenceInput label="Charge withheld" value={fields.cancellationChargesWithheld} onChange={(value) => setFields((current) => ({ ...current, cancellationChargesWithheld: value }))} />{parseWarnings.length ? <Text style={styles.warning}>{parseWarnings.join(' ')}</Text> : null}</> : null}
              {kind === 'statement' ? <><EvidenceInput label="Statement total" value={fields.statementTotal} onChange={(value) => setFields((current) => ({ ...current, statementTotal: value }))} /><EvidenceInput label="Casino funding" value={fields.casinoCharges} onChange={(value) => setFields((current) => ({ ...current, casinoCharges: value }))} /><Text style={styles.ledgerNote}>Club Royale room charges are tracked as gambling funds, never as expenses.</Text><EvidenceInput label="Actual expenses" value={fields.nonCasinoExpenses} onChange={(value) => setFields((current) => ({ ...current, nonCasinoExpenses: value }))} /><EvidenceInput label="Ending balance" value={fields.statementBalance} onChange={(value) => setFields((current) => ({ ...current, statementBalance: value }))} />{parseWarnings.length ? <Text style={styles.warning}>{parseWarnings.join(' ')}</Text> : null}</> : null}
              {kind === 'certificate' ? <><EvidenceInput label="Certificate code" value={fields.certificateCode} onChange={(value) => setFields((current) => ({ ...current, certificateCode: value }))} /><EvidenceInput label="Casino points" value={fields.casinoPoints} onChange={(value) => setFields((current) => ({ ...current, casinoPoints: value }))} /><EvidenceInput label="Certificate value" value={fields.value} onChange={(value) => setFields((current) => ({ ...current, value }))} /></> : null}
            </ThemedSectionCard> : null}

            {['invoice', 'statement', 'cancellation', 'certificate', 'change'].includes(kind) ? <ThemedSectionCard tab="settings" emoji="🚢" title="Match saved cruise" subtitle="Reservation number outranks ship and exact sailing date" compact>
              <ScrollView style={styles.matchList} nestedScrollEnabled>{rankedCruises.slice(0, 30).map(({ cruise, score }) => <TouchableOpacity key={cruise.id} style={[styles.cruiseRow, selectedCruiseId === cruise.id && styles.cruiseRowSelected]} onPress={() => setSelectedCruiseId(cruise.id)}><View style={{ flex: 1 }}><Text style={styles.cruiseName}>{cruise.shipName}</Text><Text style={styles.cruiseMeta}>{cruise.sailDate} · Reservation {cruise.reservationNumber || 'not saved'}</Text></View><Text style={styles.score}>{score >= 100 ? 'Reservation match' : score >= 45 ? 'Date / ship match' : score > 0 ? 'Possible' : ''}</Text></TouchableOpacity>)}</ScrollView>
            </ThemedSectionCard> : null}

            <View style={styles.applyRow}><TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => { setKind('irrelevant'); }}><SkipForward size={17} color={C.navy} /><Text style={styles.secondaryText}>NOT MEANINGFUL</Text></TouchableOpacity><TouchableOpacity style={styles.apply} disabled={busy} onPress={() => void apply()}>{busy ? <ActivityIndicator color="#fff" /> : kind === 'irrelevant' ? <SkipForward color="#fff" size={18} /> : <CheckCircle2 color="#fff" size={18} />}<Text style={styles.applyText}>{kind === 'irrelevant' ? 'CONFIRM SKIP' : 'APPLY THIS ITEM'}</Text></TouchableOpacity></View>
          </> : !busy && !batchPreview ? <View style={styles.empty}><Mail size={32} color={C.teal} /><Text style={styles.emptyTitle}>No item awaiting review</Text><Text style={styles.help}>Sync Gmail or select a local attachment ZIP. Either path shows a preview before applying changes.</Text></View> : null}
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  </LinearGradient>;
}

function EvidenceInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>{label}</Text><TextInput style={styles.evidenceInput} value={value} onChangeText={onChange} placeholder={placeholder || 'Not identified'} placeholderTextColor={C.muted} autoCapitalize="words" /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, safe: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 90 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }, back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, headerCopy: { flex: 1 }, eyebrow: { color: C.teal, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, title: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 29, lineHeight: 34 }, subtitle: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  deniedTitle: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 24, marginTop: 12 }, deniedText: { color: C.muted, textAlign: 'center', marginTop: 6 }, help: { color: C.muted, fontSize: 11, lineHeight: 16 }, connectionLabel: { color: C.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 12 }, input: { minHeight: 46, marginTop: 5, borderWidth: 1, borderColor: C.border, borderRadius: 11, backgroundColor: '#fff', paddingHorizontal: 12, color: C.ink, fontSize: 12 }, clipboardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 }, clipboardButton: { minHeight: 34, flexGrow: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }, visibilityButton: { minHeight: 34, flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, clipboardButtonText: { color: C.navy, fontSize: 9, fontWeight: '900' },
  primary: { minHeight: 46, marginTop: 12, borderRadius: 11, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 }, primaryText: { color: '#fff', fontWeight: '900', fontSize: 12 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusText: { color: C.ink, fontSize: 12, fontWeight: '800', flex: 1 }, disconnect: { alignSelf: 'center', padding: 10 }, disconnectText: { color: C.navy, fontSize: 11, fontWeight: '800' }, message: { color: C.teal, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  googleButton: { minHeight: 43, marginTop: 10, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }, googleButtonText: { color: C.navy, fontWeight: '900', fontSize: 10 }, localZipButton: { minHeight: 46, marginTop: 10, borderRadius: 11, backgroundColor: EASY_SEAS_UX.color.sand, borderWidth: 1, borderColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }, localZipButtonText: { color: C.navy, fontWeight: '900', fontSize: 11 },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: EASY_SEAS_UX.color.sky, marginBottom: 9 }, progressFill: { height: 8, borderRadius: 4, backgroundColor: C.teal }, batchGrid: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: 'hidden' }, batchMetric: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: 7, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border }, batchValue: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 24 }, batchLabel: { color: C.muted, fontSize: 9, textAlign: 'center', marginTop: 2 }, batchActionRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 6, marginTop: 10 }, batchAction: { color: C.teal, fontSize: 10, fontWeight: '900' }, discardNote: { color: C.muted, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 9 },
  subject: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 19 }, meta: { color: C.muted, fontSize: 10, marginTop: 4 }, bodyPreview: { color: C.ink, fontSize: 11, lineHeight: 16, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: EASY_SEAS_UX.color.sand }, attachment: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }, attachmentText: { flex: 1, color: C.ink, fontSize: 10 },
  fieldLabel: { color: C.navy, fontSize: 11, fontWeight: '900', marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.8 }, kindRow: { gap: 7, paddingVertical: 8 }, kindChip: { borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 10, minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 5 }, kindChipActive: { backgroundColor: C.navy, borderColor: C.navy }, kindEmoji: { fontSize: 14 }, kindText: { color: C.ink, fontSize: 10, fontWeight: '800' }, kindTextActive: { color: '#fff' },
  evidenceRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }, evidenceLabel: { width: 98, color: C.muted, fontSize: 11 }, evidenceInput: { flex: 1, minHeight: 40, color: C.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, extractedValue: { flex: 1, color: C.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, ledgerNote: { color: C.teal, fontSize: 9, lineHeight: 13, marginVertical: 5 }, warning: { color: C.warn, fontSize: 10, lineHeight: 15, marginTop: 8 }, matchList: { maxHeight: 290 }, cruiseRow: { minHeight: 58, padding: 10, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7 }, cruiseRowSelected: { borderColor: C.gold, backgroundColor: EASY_SEAS_UX.color.sand }, cruiseName: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 15 }, cruiseMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, score: { color: C.teal, fontSize: 9, fontWeight: '900', maxWidth: 90, textAlign: 'right' },
  applyRow: { flexDirection: 'row', gap: 8, marginTop: 10 }, secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: C.navy, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, padding: 8 }, secondaryText: { color: C.navy, fontSize: 10, fontWeight: '900' }, apply: { flex: 1.25, minHeight: 48, backgroundColor: C.navy, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, padding: 8 }, applyText: { color: '#fff', fontSize: 10, fontWeight: '900' }, empty: { alignItems: 'center', padding: 24, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, emptyTitle: { color: C.navy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 19, marginVertical: 7 },
});
