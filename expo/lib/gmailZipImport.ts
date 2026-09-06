import JSZip from 'jszip';

import type { GmailImportItem } from '@/lib/gmailImport';

export interface LocalGmailZipItem {
  item: GmailImportItem;
  attachmentId: string;
  dataBase64: string;
}

const MAX_ARCHIVE_FILES = 500;
const MAX_EXPANDED_BYTES = 150 * 1024 * 1024;

function fingerprintBase64(value: string): string {
  // Stable, dependency-free content identity for local ZIP deduplication. The
  // length plus two independent FNV-style passes makes the same attachment ID
  // repeat across imports without retaining the ZIP itself.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b);
  }
  return `${value.length.toString(16)}-${(first >>> 0).toString(16).padStart(8, '0')}-${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function receivedAtForEntry(name: string, fallback: Date): string {
  const datedName = name.match(/(?:^|\/)(20\d{2})-(\d{2})-(\d{2})[_-]/);
  if (datedName) return `${datedName[1]}-${datedName[2]}-${datedName[3]}T12:00:00.000Z`;
  return Number.isFinite(fallback.getTime()) ? fallback.toISOString() : new Date().toISOString();
}

function fileNameOnly(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

/**
 * Expands a user-selected Gmail attachment archive entirely on-device. Only
 * PDFs become review candidates; the existing document classifier decides
 * which normal cruise formats are actionable and which are safely discarded.
 */
export async function readLocalGmailAttachmentZip(
  zipBase64: string,
  onProgress?: (processed: number, total: number) => void,
): Promise<LocalGmailZipItem[]> {
  const archive = await JSZip.loadAsync(zipBase64, { base64: true, checkCRC32: true });
  const pdfEntries = Object.values(archive.files).filter((entry) => !entry.dir && /\.pdf$/i.test(entry.name));
  if (pdfEntries.length === 0) throw new Error('This ZIP does not contain any PDF attachments.');
  if (pdfEntries.length > MAX_ARCHIVE_FILES) throw new Error(`This ZIP contains ${pdfEntries.length} PDFs. The safe limit is ${MAX_ARCHIVE_FILES} per import.`);

  const results: LocalGmailZipItem[] = [];
  let expandedBytes = 0;
  onProgress?.(0, pdfEntries.length);
  for (let index = 0; index < pdfEntries.length; index += 1) {
    const entry = pdfEntries[index];
    const dataBase64 = await entry.async('base64');
    const estimatedBytes = Math.floor(dataBase64.length * 0.75);
    expandedBytes += estimatedBytes;
    if (expandedBytes > MAX_EXPANDED_BYTES) throw new Error('This ZIP expands beyond the 150 MB on-device safety limit. Split it into smaller ZIP files.');
    const name = fileNameOnly(entry.name);
    const fingerprint = fingerprintBase64(dataBase64);
    const attachmentId = `local-zip:${fingerprint}`;
    const receivedAt = receivedAtForEntry(entry.name, entry.date);
    const itemId = `local-zip-item:${fingerprint}`;
    results.push({
      attachmentId,
      dataBase64,
      item: {
        id: itemId,
        sourceMessageId: itemId,
        threadId: 'local-zip',
        receivedAt,
        queuedAt: new Date().toISOString(),
        from: 'Local Gmail attachment ZIP',
        to: '',
        subject: name.replace(/_/g, ' '),
        body: '',
        kind: 'review',
        attachments: [{
          id: attachmentId,
          name,
          mimeType: 'application/pdf',
          size: estimatedBytes,
          sha256: fingerprint,
        }],
        status: 'pending_review',
      },
    });
    onProgress?.(index + 1, pdfEntries.length);
  }
  return results;
}
