/**
 * Easy Seas owner-only Gmail importer.
 *
 * Install this as a standalone Google Apps Script owned by the Gmail account
 * that receives cruise correspondence. The script reads only messages carrying
 * the Easy Seas Import label. It does not delete or modify message contents.
 */

const EASY_SEAS = Object.freeze({
  ownerEmail: 'scott.merlis1@gmail.com',
  importLabel: 'Easy Seas Import',
  processedLabel: 'Easy Seas Processed',
  errorLabel: 'Easy Seas Import Error',
  driveFolder: 'Easy Seas Mail Imports',
  queueProperty: 'EASY_SEAS_IMPORT_QUEUE_V1',
  queueFileProperty: 'EASY_SEAS_IMPORT_QUEUE_FILE_ID_V1',
  seenFileProperty: 'EASY_SEAS_IMPORT_SEEN_FILE_ID_V1',
  tokenProperty: 'EASY_SEAS_CONNECTION_TOKEN_V1',
  folderProperty: 'EASY_SEAS_DRIVE_FOLDER_ID_V1',
  maxQueueItems: 2000,
  maxSeenMessages: 10000,
  maxBodyCharacters: 20000,
  // Keep each foreground sync below the Apps Script web-request timeout. The
  // processed label makes later syncs continue with the next batch instead of
  // rereading the same messages.
  maxThreadsPerRun: 30,
  gmailSearchBatchSize: 10,
  maxPendingItemsPerResponse: 500,
  maxArchiveEntries: 100,
  maxArchiveBytes: 50 * 1024 * 1024,
  supportedAttachmentPattern: /\.(pdf|csv|xlsx|xls|json|zip|png|jpe?g|heic|txt)$/i,
  importableAttachmentPattern: /\.(pdf|csv|xlsx|xls|json|png|jpe?g|heic|txt)$/i,
});

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(value, maximum) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maximum || 10000);
}

function token_() {
  const properties = PropertiesService.getScriptProperties();
  let value = properties.getProperty(EASY_SEAS.tokenProperty);
  if (!value) {
    value = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty(EASY_SEAS.tokenProperty, value);
  }
  return value;
}

function labels_() {
  return {
    incoming: GmailApp.getUserLabelByName(EASY_SEAS.importLabel) || GmailApp.createLabel(EASY_SEAS.importLabel),
    processed: GmailApp.getUserLabelByName(EASY_SEAS.processedLabel) || GmailApp.createLabel(EASY_SEAS.processedLabel),
    error: GmailApp.getUserLabelByName(EASY_SEAS.errorLabel) || GmailApp.createLabel(EASY_SEAS.errorLabel),
  };
}

function folder_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(EASY_SEAS.folderProperty);
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (ignored) {}
  }
  const matches = DriveApp.getFoldersByName(EASY_SEAS.driveFolder);
  const folder = matches.hasNext() ? matches.next() : DriveApp.createFolder(EASY_SEAS.driveFolder);
  properties.setProperty(EASY_SEAS.folderProperty, folder.getId());
  return folder;
}

function readQueue_() {
  const properties = PropertiesService.getScriptProperties();
  const fileId = properties.getProperty(EASY_SEAS.queueFileProperty);
  if (!fileId) return [];
  let raw = '';
  try { raw = DriveApp.getFileById(fileId).getBlob().getDataAsString(); } catch (ignored) { return []; }
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (ignored) {
    return [];
  }
}

function writeQueue_(items) {
  const compact = items.slice(-EASY_SEAS.maxQueueItems);
  const properties = PropertiesService.getScriptProperties();
  const payload = JSON.stringify(compact);
  const existingId = properties.getProperty(EASY_SEAS.queueFileProperty);
  if (existingId) {
    try {
      DriveApp.getFileById(existingId).setContent(payload);
      return;
    } catch (ignored) {}
  }
  const file = folder_().createFile('easy-seas-mail-queue.json', payload, MimeType.PLAIN_TEXT);
  properties.setProperty(EASY_SEAS.queueFileProperty, file.getId());
}

function readSeenMessageIds_() {
  const properties = PropertiesService.getScriptProperties();
  const fileId = properties.getProperty(EASY_SEAS.seenFileProperty);
  if (!fileId) return [];
  try {
    const value = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString() || '[]');
    return Array.isArray(value) ? value.map(String) : [];
  } catch (ignored) {
    return [];
  }
}

function writeSeenMessageIds_(ids) {
  const compact = ids.slice(-EASY_SEAS.maxSeenMessages);
  const properties = PropertiesService.getScriptProperties();
  const payload = JSON.stringify(compact);
  const existingId = properties.getProperty(EASY_SEAS.seenFileProperty);
  if (existingId) {
    try {
      DriveApp.getFileById(existingId).setContent(payload);
      return;
    } catch (ignored) {}
  }
  const file = folder_().createFile('easy-seas-mail-seen.json', payload, MimeType.PLAIN_TEXT);
  properties.setProperty(EASY_SEAS.seenFileProperty, file.getId());
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map((value) => (`0${(value < 0 ? value + 256 : value).toString(16)}`).slice(-2))
    .join('');
}

function classify_(subject, body, attachmentNames) {
  const text = `${subject} ${body} ${attachmentNames.join(' ')}`.replace(/_/g, ' ').toLowerCase();
  if (/cancel(?:led|lation|ed)|reservation has been cancelled/.test(text)) return 'cancellation';
  if (/cruise statement|final guest statement/.test(text)) return 'statement';
  if (/certificate (?:earned|award)|club royale certificate|casino certificate|certificate code/.test(text)) return 'certificate';
  if (/cruise vacation receipt|guest (?:copy|offer|invoice)|invoice|payment confirmation|balance due/.test(text)) return 'invoice';
  if (/booking confirmation|reservation confirmation|your cruise documents|reservation id/.test(text)) return 'booking';
  if (/change|updated|modified|itinerary update|ship change|date change/.test(text)) return 'change';
  return 'review';
}

function isKnownNonActionableAttachment_(name) {
  const normalized = String(name || '').replace(/[\s-]+/g, '_');
  return /(?:Guest_Vacation_Documents|Guest_Ticket_Booklet|Luggage_Tags?|Booking_Change|Balance_Due_Reminder)/i.test(normalized);
}

function expandedAttachments_(message) {
  const allAttachments = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
  const expanded = [];
  allAttachments.forEach((attachment) => {
    const name = clean_(attachment.getName() || 'attachment', 180);
    if (!EASY_SEAS.supportedAttachmentPattern.test(name)) return;
    if (!/\.zip$/i.test(name)) {
      // These documents contain travel instructions rather than booking,
      // financial, certificate, or cancellation evidence. Discard them at the
      // bridge so the owner never has to classify the same noise in the app.
      if (isKnownNonActionableAttachment_(name)) return;
      expanded.push({ blob: attachment.copyBlob(), name });
      return;
    }
    const archiveBytes = attachment.getBytes().length;
    if (archiveBytes > EASY_SEAS.maxArchiveBytes) throw new Error(`ZIP attachment ${name} exceeds the 50 MB safety limit.`);
    const files = Utilities.unzip(attachment.copyBlob());
    if (files.length > EASY_SEAS.maxArchiveEntries) throw new Error(`ZIP attachment ${name} contains more than 100 files.`);
    let totalBytes = 0;
    files.forEach((blob) => {
      const entryName = clean_(blob.getName() || 'archive-entry', 180);
      const bytes = blob.getBytes().length;
      totalBytes += bytes;
      if (totalBytes > EASY_SEAS.maxArchiveBytes) throw new Error(`ZIP attachment ${name} expands beyond the 50 MB safety limit.`);
      // Owner archive imports intentionally retain only documents that can
      // change a cruise's financial/booking state. Vacation documents,
      // manifests, and support files are not queued; final cruise statements
      // are retained as verified post-cruise financial evidence.
      if (/_(?:Guest_Offer|Guest_Invoice|Cruise_Statement|Cancellation(?:_Invoice)?)\.pdf$/i.test(entryName)) {
        expanded.push({ blob, name: entryName });
      }
    });
  });
  return expanded;
}

function messageRecords_(message, folder) {
  const sourceMessageId = message.getId();
  const plainBody = clean_(message.getPlainBody(), EASY_SEAS.maxBodyCharacters);
  const subject = clean_(message.getSubject(), 500);
  const base = {
    sourceMessageId,
    threadId: message.getThread().getId(),
    receivedAt: message.getDate().toISOString(),
    queuedAt: new Date().toISOString(),
    from: clean_(message.getFrom(), 500),
    to: clean_(message.getTo(), 500),
    subject,
    body: plainBody,
    status: 'pending_review',
  };
  const candidates = expandedAttachments_(message);
  if (candidates.length === 0) {
    return [{ ...base, id: sourceMessageId, kind: classify_(subject, plainBody, []), attachments: [] }];
  }
  return candidates.map((candidate, index) => {
    const bytes = candidate.blob.getBytes();
    const hash = sha256_(bytes);
    const file = folder.createFile(candidate.blob).setName(`${sourceMessageId}-${index + 1}-${candidate.name}`);
    const savedAttachment = {
      id: file.getId(),
      name: candidate.name,
      mimeType: clean_(candidate.blob.getContentType(), 120),
      size: bytes.length,
      sha256: hash,
    };
    return {
      ...base,
      id: `${sourceMessageId}:${index + 1}:${hash.slice(0, 16)}`,
      subject: candidates.length > 1 ? `${subject} — ${candidate.name}` : subject,
      kind: classify_(subject, plainBody, [candidate.name]),
      attachments: [savedAttachment],
    };
  });
}

function labeledThreads_() {
  // The relevant mail has three stable document titles. Narrow title searches
  // avoid sweeping years of unrelated marketing and vacation-document mail.
  // The processed label makes every later run continue with the next batch.
  const queries = [
    `newer_than:5y has:attachment filename:pdf {"Guest Offer" "Guest Invoice"} -label:"${EASY_SEAS.processedLabel}"`,
    `newer_than:5y has:attachment filename:pdf {"Cancellation Invoice" "reservation has been cancelled"} -label:"${EASY_SEAS.processedLabel}"`,
    `newer_than:5y has:attachment filename:pdf {"Cruise Statement" "Final Guest Statement"} -label:"${EASY_SEAS.processedLabel}"`,
  ];
  const threads = [];
  const threadIds = new Set();
  const starts = queries.map(() => 0);
  let foundAny = true;
  while (threads.length < EASY_SEAS.maxThreadsPerRun && foundAny) {
    foundAny = false;
    queries.some((query, queryIndex) => {
      const requested = Math.min(EASY_SEAS.gmailSearchBatchSize, EASY_SEAS.maxThreadsPerRun - threads.length);
      if (requested <= 0) return true;
      const batch = GmailApp.search(query, starts[queryIndex], requested);
      starts[queryIndex] += batch.length;
      if (batch.length) foundAny = true;
      batch.forEach((thread) => {
        const id = thread.getId();
        if (threadIds.has(id) || threads.length >= EASY_SEAS.maxThreadsPerRun) return;
        threadIds.add(id);
        threads.push(thread);
      });
      return threads.length >= EASY_SEAS.maxThreadsPerRun;
    });
  }
  return threads;
}

function scanEasySeasMail() {
  const labels = labels_();
  const folder = folder_();
  const queue = readQueue_();
  const seenIds = readSeenMessageIds_();
  const knownIds = new Set([...seenIds, ...queue.map((item) => item.sourceMessageId || item.id)]);
  // Search every matching thread. Gmail labels are thread-level, and the saved
  // message-id ledger prevents a new reply or repeated sync from duplicating data.
  const threads = labeledThreads_();
  let added = 0;
  threads.forEach((thread) => {
    try {
      thread.getMessages().forEach((message) => {
        if (knownIds.has(message.getId())) return;
        const records = messageRecords_(message, folder);
        records.forEach((record) => queue.push(record));
        knownIds.add(message.getId());
        added += records.length;
      });
      thread.addLabel(labels.processed);
      thread.removeLabel(labels.error);
    } catch (error) {
      thread.addLabel(labels.error);
      console.error(`Easy Seas could not queue Gmail thread ${thread.getId()}: ${error}`);
    }
  });
  writeQueue_(queue);
  writeSeenMessageIds_(Array.from(knownIds));
  return { added, pending: queue.filter((item) => item.status === 'pending_review').length, scannedThreads: threads.length };
}

function authorizeAndInstall() {
  labels_();
  folder_();
  const existing = ScriptApp.getProjectTriggers();
  existing.filter((trigger) => trigger.getHandlerFunction() === 'scanEasySeasMail')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('scanEasySeasMail').timeBased().everyMinutes(5).create();
  const result = {
    installed: true,
    ownerEmail: EASY_SEAS.ownerEmail,
    watchedLabel: EASY_SEAS.importLabel,
    automaticCruiseMailSearch: true,
    searchedDocumentTitles: ['Guest Offer / Guest Invoice', 'Cancellation Invoice', 'Cruise Statement'],
    scanIntervalMinutes: 5,
    connectionToken: token_(),
    nextStep: 'Deploy as a web app, execute as yourself, with access set to Anyone. Easy Seas already knows the deployment URL; paste only this one-time connection token.',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// A small, copy-friendly recovery action for an already-authorized project.
// Running this never reads Gmail; it only returns the existing private token.
function showConnectionToken() {
  const result = {
    ownerEmail: EASY_SEAS.ownerEmail,
    connectionToken: token_(),
    copyThisValueIntoEasySeas: token_(),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function uninstallEasySeasTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'scanEasySeasMail')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  return { installed: false };
}

function authorized_(provided) {
  const actual = token_();
  const candidate = String(provided || '');
  return candidate.length === actual.length && candidate === actual;
}

function doGet(event) {
  const parameters = (event && event.parameter) || {};
  if (parameters.action === 'health') return jsonOutput_({ ok: true, service: 'easy-seas-gmail-import', version: 8 });
  if (!authorized_(parameters.token)) return jsonOutput_({ ok: false, error: 'unauthorized' });
  if (parameters.action === 'attachment') {
    const queue = readQueue_();
    const attachmentId = clean_(parameters.id, 200);
    const allowed = queue.some((item) => (item.attachments || []).some((attachment) => attachment.id === attachmentId));
    if (!allowed) return jsonOutput_({ ok: false, error: 'attachment_not_found' });
    const file = DriveApp.getFileById(attachmentId);
    const blob = file.getBlob();
    return jsonOutput_({
      ok: true,
      attachment: {
        id: attachmentId,
        name: file.getName(),
        mimeType: blob.getContentType(),
        dataBase64: Utilities.base64Encode(blob.getBytes()),
      },
    });
  }
  const scan = parameters.action === 'sync' ? scanEasySeasMail() : null;
  const pending = readQueue_().filter((item) => item.status === 'pending_review').slice(0, EASY_SEAS.maxPendingItemsPerResponse);
  return jsonOutput_({ ok: true, ownerEmail: EASY_SEAS.ownerEmail, scan, items: pending });
}

function doPost(event) {
  let body = {};
  try { body = JSON.parse((event && event.postData && event.postData.contents) || '{}'); } catch (ignored) {}
  if (!authorized_(body.token)) return jsonOutput_({ ok: false, error: 'unauthorized' });
  const action = clean_(body.action, 40);
  const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
  if (!['acknowledge', 'retry'].includes(action) || ids.size === 0) {
    return jsonOutput_({ ok: false, error: 'invalid_action' });
  }
  const queue = readQueue_();
  const nextStatus = action === 'acknowledge' ? 'imported' : 'pending_review';
  let changed = 0;
  queue.forEach((item) => {
    if (!ids.has(item.id)) return;
    item.status = nextStatus;
    item.statusChangedAt = new Date().toISOString();
    changed += 1;
  });
  writeQueue_(queue);
  return jsonOutput_({ ok: true, changed, status: nextStatus });
}
