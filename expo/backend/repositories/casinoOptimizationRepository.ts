import { getDb } from '@/backend/db';

export interface StoredOptimizationSnapshot {
  id: string;
  ownerProfileId: string;
  snapshotType: 'bundle' | 'recommendation' | 'learning-outcome' | 'release-gate';
  generatedAt: string;
  version: string;
  payload: unknown;
  payloadFingerprint: string;
}

const TABLE = 'casino_optimization_snapshots';

export async function saveOptimizationSnapshot(record: StoredOptimizationSnapshot): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPSERT type::thing($table, $id) CONTENT {
      ownerProfileId: $ownerProfileId,
      snapshotType: $snapshotType,
      generatedAt: $generatedAt,
      version: $version,
      payload: $payload,
      payloadFingerprint: $payloadFingerprint,
      updatedAt: time::now()
    }`,
    { table: TABLE, ...record },
  );
}

export async function loadLatestOptimizationSnapshot(
  ownerProfileId: string,
  snapshotType: StoredOptimizationSnapshot['snapshotType'],
): Promise<StoredOptimizationSnapshot | null> {
  const db = await getDb();
  const rows = await db.query<StoredOptimizationSnapshot[][]>(
    `SELECT * FROM ${TABLE}
      WHERE ownerProfileId = $ownerProfileId AND snapshotType = $snapshotType
      ORDER BY generatedAt DESC LIMIT 1`,
    { ownerProfileId, snapshotType },
  );
  return rows?.[0]?.[0] ?? null;
}

export async function deleteOptimizationSnapshotsForOwner(ownerProfileId: string): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM ${TABLE} WHERE ownerProfileId = $ownerProfileId`, { ownerProfileId });
}
