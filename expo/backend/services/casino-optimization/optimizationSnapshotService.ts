import { stableModelFingerprint } from '@/lib/optimization/models/statistics';
import {
  deleteOptimizationSnapshotsForOwner,
  loadLatestOptimizationSnapshot,
  saveOptimizationSnapshot,
  type StoredOptimizationSnapshot,
} from '@/backend/repositories/casinoOptimizationRepository';

export function assertOptimizationOwnerScope(ownerProfileId: string, ownerScopeId: string): void {
  const profile = ownerProfileId.trim().toLowerCase();
  const scope = ownerScopeId.trim().toLowerCase();
  if (!profile || !scope || profile !== scope) {
    throw new Error('Optimization snapshot owner scope does not match the active profile.');
  }
}

export async function persistOptimizationSnapshot(input: Omit<StoredOptimizationSnapshot, 'payloadFingerprint'>): Promise<StoredOptimizationSnapshot> {
  assertOptimizationOwnerScope(input.ownerProfileId, input.ownerProfileId);
  const payloadFingerprint = stableModelFingerprint([
    input.ownerProfileId,
    input.snapshotType,
    input.generatedAt,
    input.version,
    JSON.stringify(input.payload),
  ]);
  const record: StoredOptimizationSnapshot = { ...input, payloadFingerprint };
  await saveOptimizationSnapshot(record);
  const readback = await loadLatestOptimizationSnapshot(record.ownerProfileId, record.snapshotType);
  if (!readback || readback.payloadFingerprint !== payloadFingerprint) {
    throw new Error('Optimization snapshot readback verification failed.');
  }
  return readback;
}

export { loadLatestOptimizationSnapshot, deleteOptimizationSnapshotsForOwner };
