import type { InboxIssue } from '@/lib/operating/operatingSystem';
import { getHealthTrustDatabase } from '@/lib/database/HealthTrustDatabase';

export type IntegritySeverity = 'critical' | 'high' | 'medium' | 'low';
export type IntegrityKind = 'duplicate_cruise' | 'orphan_offer_sailing' | 'owner_leakage' | 'unlinked_certificate' | 'impossible_total' | 'stale_loyalty' | 'malformed_date' | 'broken_relationship';
export interface IntegrityIssue { id: string; ownerId: string | null; severity: IntegritySeverity; kind: IntegrityKind; title: string; detail: string; entityType: string; entityIds: string[]; evidence: Record<string, unknown>; repair?: { kind: string; payload: Record<string, unknown> } | null; ambiguous: boolean; state: 'open' | 'previewed' | 'resolved' | 'dismissed'; detectedAt: string; updatedAt: string; }
export interface IntegritySnapshot { ownerId: string; cruises?: Array<Record<string, unknown>>; offers?: Array<Record<string, unknown>>; offerSailings?: Array<Record<string, unknown>>; certificates?: Array<Record<string, unknown>>; loyalty?: Array<Record<string, unknown>>; casinoTotals?: Array<Record<string, unknown>>; relationships?: Array<Record<string, unknown>>; }
export interface RepairPreview { issueId: string; allowed: boolean; reason: string; before: unknown; after: unknown; requiresConfirmation: true; ambiguous: boolean; }
export interface RepairHistoryRow { id: string; issueId: string; ownerId: string | null; repairKind: string; before: unknown; after: unknown; confirmedAt: string; result: 'applied' | 'rejected' | 'failed' | 'rolled_back'; error?: string | null; }
export interface RepairApplicationResult { applied: boolean; route?: string; message: string; }

const severityPriority: Record<IntegritySeverity, number> = { critical: 100, high: 75, medium: 45, low: 20 };
function text(value: unknown): string { return String(value ?? '').trim(); }
function idOf(record: Record<string, unknown>, fallback: string): string { return text(record.id ?? record.cruiseId ?? record.offerId ?? record.certificateCode) || fallback; }
function validDate(value: unknown): boolean {
  const string = text(value);
  const match = string.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function aliases(record: Record<string, unknown>, fields: string[], fallback: string): string[] { const values = fields.map((field) => text(record[field])).filter(Boolean); return values.length ? [...new Set(values)] : [fallback]; }
function stableId(parts: unknown[]): string { let hash = 2166136261; const value = parts.join('|'); for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `integrity-${(hash >>> 0).toString(16)}`; }
function issue(ownerId: string | null, kind: IntegrityKind, severity: IntegritySeverity, title: string, detail: string, entityType: string, entityIds: string[], evidence: Record<string, unknown>, repair: IntegrityIssue['repair'], ambiguous = false): IntegrityIssue { const now = new Date().toISOString(); return { id: stableId([ownerId, kind, ...entityIds]), ownerId, kind, severity, title, detail, entityType, entityIds, evidence, repair, ambiguous, state: 'open', detectedAt: now, updatedAt: now }; }

export function scanIntegrity(snapshot: IntegritySnapshot, now = new Date()): IntegrityIssue[] {
  const result: IntegrityIssue[] = []; const cruises = snapshot.cruises ?? []; const offers = snapshot.offers ?? []; const offerSailings = snapshot.offerSailings ?? []; const certificates = snapshot.certificates ?? [];
  const cruiseGroups = new Map<string, Array<Record<string, unknown>>>();
  cruises.forEach((cruise) => { const key = [text(cruise.shipName).toLowerCase(), text(cruise.sailDate), text(cruise.reservationNumber ?? cruise.bookingId)].join('|'); cruiseGroups.set(key, [...(cruiseGroups.get(key) ?? []), cruise]); const date = cruise.sailDate ?? cruise.departureDate; if (date && !validDate(date)) result.push(issue(snapshot.ownerId, 'malformed_date', 'high', 'Cruise date is malformed', `${text(cruise.shipName)} has an unreadable sailing date.`, 'cruise', [idOf(cruise, key)], { date }, { kind: 'normalize_date', payload: { field: 'sailDate', value: date } }, true)); });
  cruiseGroups.forEach((rows, key) => { if (rows.length > 1) result.push(issue(snapshot.ownerId, 'duplicate_cruise', 'high', 'Possible duplicate cruise records', `${rows.length} records share the same ship, sailing date, and reservation identity.`, 'cruise', rows.map((row, index) => idOf(row, `${key}-${index}`)), { key, count: rows.length }, { kind: 'merge_duplicates', payload: { canonicalId: idOf(rows[0], key), duplicateIds: rows.slice(1).map((row, index) => idOf(row, `${key}-${index + 1}`)) } }, true)); });
  const offerIds = new Set(offers.flatMap((offer, index) => aliases(offer, ['id', 'offerId', 'offerInstanceKey', 'offerCode', 'certificateCode'], `offer-${index}`))); const cruiseIds = new Set(cruises.flatMap((cruise, index) => aliases(cruise, ['id', 'cruiseId', 'sailingId', 'canonicalKey'], `cruise-${index}`)));
  offerSailings.forEach((link, index) => { const offerId = text(link.offerId ?? link.offerInstanceKey); const cruiseId = text(link.cruiseId ?? link.sailingId ?? link.canonicalKey); if (!offerIds.has(offerId) || !cruiseIds.has(cruiseId)) result.push(issue(null, 'orphan_offer_sailing', 'critical', 'Offer-to-sailing link is orphaned', `Eligibility link ${idOf(link, String(index))} does not resolve to both an offer and a cruise.`, 'offer_sailing', [idOf(link, String(index))], { offerId, cruiseId, offerExists: offerIds.has(offerId), cruiseExists: cruiseIds.has(cruiseId) }, { kind: 'quarantine_orphan_link', payload: { id: idOf(link, String(index)) } }, false)); });
  [...cruises, ...(snapshot.loyalty ?? []), ...(snapshot.casinoTotals ?? [])].forEach((record, index) => { const owner = text(record.ownerId ?? record.ownerProfileId ?? record.userId); if (owner && owner.toLowerCase() !== snapshot.ownerId.toLowerCase()) result.push(issue(snapshot.ownerId, 'owner_leakage', 'critical', 'Record belongs to a different user', 'A private record is visible outside its owning profile.', text(record.recordType ?? 'record'), [idOf(record, String(index))], { expectedOwner: snapshot.ownerId, actualOwner: owner }, null, true)); });
  const cruiseDates = cruises.map((row) => text(row.sailDate)); certificates.forEach((certificate, index) => { const issueDate = text(certificate.issueDate ?? certificate.issuedAt ?? certificate.sailingDate); if (issueDate && !cruiseDates.some((date) => date === issueDate || Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${issueDate}T00:00:00Z`)) <= 14 * 86400000)) result.push(issue(snapshot.ownerId, 'unlinked_certificate', 'medium', 'Certificate is not linked to an earning cruise', `${text(certificate.certificateCode ?? certificate.code) || 'Certificate'} has no nearby completed cruise evidence.`, 'certificate', [idOf(certificate, String(index))], { issueDate }, { kind: 'suggest_certificate_link', payload: { certificateId: idOf(certificate, String(index)), issueDate } }, true)); });
  (snapshot.casinoTotals ?? []).forEach((total, index) => { const points = Number(total.points ?? total.totalPoints ?? 0); const coinIn = Number(total.coinIn ?? total.totalCoinIn ?? 0); if (points < 0 || coinIn < 0 || (points > 0 && coinIn > 0 && Math.abs(coinIn - points * 5) / Math.max(1, points * 5) > .25)) result.push(issue(snapshot.ownerId, 'impossible_total', 'high', 'Casino totals do not reconcile', 'Points and coin-in contain negative or materially inconsistent values.', 'casino', [idOf(total, String(index))], { points, coinIn, expectedCoinIn: points * 5 }, null, true)); });
  (snapshot.loyalty ?? []).forEach((loyalty, index) => { const updatedAt = Date.parse(text(loyalty.updatedAt ?? loyalty.syncedAt)); if (!updatedAt || now.getTime() - updatedAt > 30 * 86400000) result.push(issue(snapshot.ownerId, 'stale_loyalty', 'medium', 'Loyalty value may be stale', `${text(loyalty.program) || 'Loyalty'} has not been refreshed within 30 days.`, 'loyalty', [idOf(loyalty, String(index))], { updatedAt: text(loyalty.updatedAt ?? loyalty.syncedAt) }, { kind: 'request_loyalty_sync', payload: { program: text(loyalty.program) } }, false)); });
  (snapshot.relationships ?? []).forEach((edge, index) => { const from = text(edge.from); const to = text(edge.to); if (!from || !to) result.push(issue(snapshot.ownerId, 'broken_relationship', 'high', 'Relationship evidence is incomplete', 'A relationship edge is missing its source or destination record.', 'relationship', [idOf(edge, String(index))], { from, to }, { kind: 'quarantine_relationship', payload: { id: idOf(edge, String(index)) } }, false)); });
  return result;
}

export async function persistIntegrityIssues(issues: IntegrityIssue[], ownerId?: string): Promise<void> {
  const db = await getHealthTrustDatabase(); const scopedOwner = ownerId ?? issues.find((row) => row.ownerId)?.ownerId ?? null; const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    if (scopedOwner) await db.runAsync("UPDATE integrity_issues SET state='resolved',updated_at=? WHERE (owner_id=? OR owner_id IS NULL) AND state IN ('open','previewed')", [now, scopedOwner]);
    for (const row of issues) {
      const quarantined = await db.getFirstAsync<{ id: string }>('SELECT id FROM integrity_quarantine WHERE issue_id=? AND restored_at IS NULL LIMIT 1', [row.id]);
      if (quarantined) continue;
      await db.runAsync(`INSERT OR REPLACE INTO integrity_issues(id,owner_id,severity,kind,title,detail,entity_type,entity_ids_json,evidence_json,repair_kind,repair_payload_json,ambiguous,state,detected_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [row.id, row.ownerId, row.severity, row.kind, row.title, row.detail, row.entityType, JSON.stringify(row.entityIds), JSON.stringify(row.evidence), row.repair?.kind ?? null, row.repair ? JSON.stringify(row.repair.payload) : null, row.ambiguous ? 1 : 0, 'open', row.detectedAt, now]);
    }
  });
}
export async function listIntegrityIssues(ownerId: string): Promise<IntegrityIssue[]> { const db = await getHealthTrustDatabase(); const rows = await db.getAllAsync<any>('SELECT * FROM integrity_issues WHERE (owner_id=? OR owner_id IS NULL) AND state<>? ORDER BY CASE severity WHEN \'critical\' THEN 4 WHEN \'high\' THEN 3 WHEN \'medium\' THEN 2 ELSE 1 END DESC,detected_at DESC', [ownerId, 'resolved']); return rows.map((row) => ({ id: row.id, ownerId: row.owner_id, severity: row.severity, kind: row.kind, title: row.title, detail: row.detail, entityType: row.entity_type, entityIds: JSON.parse(row.entity_ids_json), evidence: JSON.parse(row.evidence_json), repair: row.repair_kind ? { kind: row.repair_kind, payload: JSON.parse(row.repair_payload_json) } : null, ambiguous: Boolean(row.ambiguous), state: row.state, detectedAt: row.detected_at, updatedAt: row.updated_at })); }
export function buildRepairPreview(row: IntegrityIssue): RepairPreview { if (!row.repair) return { issueId: row.id, allowed: false, reason: 'No deterministic repair is available. Review the source records manually.', before: row.evidence, after: row.evidence, requiresConfirmation: true, ambiguous: row.ambiguous }; if (row.ambiguous) return { issueId: row.id, allowed: false, reason: 'The repair is ambiguous and will never run automatically.', before: row.evidence, after: row.repair.payload, requiresConfirmation: true, ambiguous: true }; return { issueId: row.id, allowed: true, reason: 'A reversible deterministic repair can be applied after confirmation.', before: row.evidence, after: row.repair.payload, requiresConfirmation: true, ambiguous: false }; }
export async function recordRepairResult(row: IntegrityIssue, preview: RepairPreview, result: 'applied' | 'rejected' | 'failed', error?: string): Promise<void> { const db = await getHealthTrustDatabase(); const id = `${row.id}:${Date.now()}`; await db.withTransactionAsync(async () => { await db.runAsync('INSERT INTO repair_history(id,issue_id,owner_id,repair_kind,before_json,after_json,confirmed_at,result,error) VALUES(?,?,?,?,?,?,?,?,?)', [id, row.id, row.ownerId, row.repair?.kind ?? 'manual_review', JSON.stringify(preview.before), JSON.stringify(preview.after), new Date().toISOString(), result, error ?? null]); if (result === 'applied') await db.runAsync('UPDATE integrity_issues SET state=?,updated_at=? WHERE id=?', ['resolved', new Date().toISOString(), row.id]); }); }
export async function applyIntegrityRepair(row: IntegrityIssue): Promise<RepairApplicationResult> {
  const preview = buildRepairPreview(row);
  if (!preview.allowed || !row.repair) {
    await recordRepairResult(row, preview, 'rejected', preview.reason);
    return { applied: false, message: preview.reason };
  }
  const db = await getHealthTrustDatabase();
  try {
    if (row.repair.kind === 'quarantine_orphan_link' || row.repair.kind === 'quarantine_relationship') {
      const entityId = text(row.repair.payload.id) || row.entityIds[0] || row.id;
      const after = { ...row.evidence, quarantined: true, excludedFromDerivedResults: true, reversible: true };
      const quarantineId = `quarantine:${row.id}:${entityId}`;
      await db.runAsync('INSERT OR REPLACE INTO integrity_quarantine(id,issue_id,owner_id,entity_type,entity_id,repair_kind,before_json,after_json,quarantined_at,restored_at) VALUES(?,?,?,?,?,?,?,?,?,NULL)', [quarantineId, row.id, row.ownerId, row.entityType, entityId, row.repair.kind, JSON.stringify(row.evidence), JSON.stringify(after), new Date().toISOString()]);
      await recordRepairResult(row, { ...preview, after }, 'applied');
      return { applied: true, message: 'The broken relationship was quarantined without deleting its source record. It can be reviewed from repair history.' };
    }
    if (row.repair.kind === 'request_loyalty_sync') {
      await recordRepairResult(row, preview, 'applied');
      return { applied: true, route: '/royal-caribbean-sync', message: 'Opening the provider sync. Select Royal or Celebrity there; the next integrity scan will verify whether the stale value was refreshed.' };
    }
    await recordRepairResult(row, preview, 'failed', `Unsupported deterministic repair: ${row.repair.kind}`);
    return { applied: false, message: 'This repair is not implemented and no data was changed.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordRepairResult(row, preview, 'failed', message).catch(() => undefined);
    return { applied: false, message };
  }
}
export async function listRepairHistory(ownerId: string, limit = 50): Promise<RepairHistoryRow[]> {
  const db = await getHealthTrustDatabase(); const rows = await db.getAllAsync<any>('SELECT * FROM repair_history WHERE owner_id=? OR owner_id IS NULL ORDER BY confirmed_at DESC LIMIT ?', [ownerId, Math.max(1, Math.min(200, limit))]);
  return rows.map((row) => ({ id: row.id, issueId: row.issue_id, ownerId: row.owner_id, repairKind: row.repair_kind, before: JSON.parse(row.before_json || 'null'), after: JSON.parse(row.after_json || 'null'), confirmedAt: row.confirmed_at, result: row.result, error: row.error }));
}
export async function rollbackIntegrityRepair(historyId: string, activeOwnerId: string): Promise<RepairApplicationResult> {
  const db = await getHealthTrustDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM repair_history WHERE id=?', [historyId]);
  if (!row) return { applied: false, message: 'Repair history record was not found.' };
  if (row.owner_id && String(row.owner_id).toLowerCase() !== activeOwnerId.toLowerCase()) return { applied: false, message: 'This repair belongs to a different profile and was not changed.' };
  if (row.result !== 'applied' || !['quarantine_orphan_link', 'quarantine_relationship'].includes(row.repair_kind)) return { applied: false, message: 'This history entry did not change a reversible quarantine.' };
  const openQuarantine = await db.getFirstAsync<{ id: string }>('SELECT id FROM integrity_quarantine WHERE issue_id=? AND restored_at IS NULL ORDER BY quarantined_at DESC LIMIT 1', [row.issue_id]);
  if (!openQuarantine) return { applied: false, message: 'This quarantine has already been restored.' };
  const now = new Date().toISOString();
  const rollbackId = `rollback:${historyId}:${Date.now()}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE integrity_quarantine SET restored_at=? WHERE id=?', [now, openQuarantine.id]);
    await db.runAsync("UPDATE integrity_issues SET state='open',updated_at=? WHERE id=?", [now, row.issue_id]);
    await db.runAsync('INSERT INTO repair_history(id,issue_id,owner_id,repair_kind,before_json,after_json,confirmed_at,result,error) VALUES(?,?,?,?,?,?,?,?,NULL)', [rollbackId, row.issue_id, row.owner_id, row.repair_kind, row.after_json, row.before_json, now, 'rolled_back']);
  });
  return { applied: true, message: 'The quarantined relationship was restored and the integrity issue was reopened for review.' };
}
export function integrityIssuesToInbox(issues: IntegrityIssue[]): InboxIssue[] { return issues.map((row) => ({
  id: row.id,
  dedupeKey: `${row.kind}:${[...row.entityIds].sort().join(',')}`,
  type: `integrity:${row.kind}`,
  priority: severityPriority[row.severity],
  ownerId: row.ownerId ?? '__shared__',
  source: 'Automatic Integrity Center',
  sourceRecordId: row.entityIds.join(', '),
  observedAt: row.detectedAt,
  confidence: row.ambiguous ? 'low' : row.severity === 'critical' || row.severity === 'high' ? 'high' : 'medium',
  formula: `Integrity rule: ${row.kind}`,
  details: row.detail,
  status: row.state === 'resolved' ? 'resolved' : 'open',
  route: `/data-trust-center?issue=${encodeURIComponent(row.id)}`,
})); }

export function scheduleIntegrityScan(loadSnapshot: () => Promise<IntegritySnapshot>, onIssues?: (issues: IntegrityIssue[]) => void): () => void {
  let cancelled = false; const run = async () => { const snapshot = await loadSnapshot(); if (cancelled) return; const issues = scanIntegrity(snapshot); await persistIntegrityIssues(issues, snapshot.ownerId); if (!cancelled) onIssues?.(issues); };
  const timer = setTimeout(() => { void run(); }, 400); return () => { cancelled = true; clearTimeout(timer); };
}
