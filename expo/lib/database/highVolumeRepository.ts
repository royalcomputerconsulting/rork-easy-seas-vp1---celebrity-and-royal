import {
  countDomainRecords,
  countDomainRecordsFiltered,
  listAllDomainRecords,
  listAllDomainRecordsByOwnerPrefix,
  listDomainRecordsFiltered,
  replaceDomainRecords,
  upsertDomainRecords,
  type DomainRecordRow,
} from './HealthTrustDatabase';
import {
  HIGH_VOLUME_DOMAINS,
  highVolumeRecordId,
  hashText,
  migrateHighVolumeDomain,
  type HighVolumeDomain,
} from './highVolumeMigration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';

const SHARED_OWNER = '__shared__';

export type HighVolumeDomainName = (typeof HIGH_VOLUME_DOMAINS)[number]['domain'];

const normalizedOwner = (ownerId: string | null | undefined) =>
  String(ownerId || 'local-default').trim().toLowerCase() || 'local-default';

const isWeb = Platform.OS === 'web';

function webCandidateKeys(ownerId: string, definition: HighVolumeDomain, sourceStorageKey?: string): string[] {
  if (sourceStorageKey) return [sourceStorageKey];
  const bases = [...(definition.storageAliases ?? []).slice().reverse(), definition.storageKey];
  return [...new Set(bases.flatMap((base) => {
    if (definition.shared) return [base];
    const scoped = getUserScopedKey(base, normalizedOwner(ownerId));
    return definition.legacyGlobal ? [scoped, base] : [scoped];
  }))];
}

async function readWebDomain<T>(ownerId: string, definition: HighVolumeDomain): Promise<T[]> {
  for (const storageKey of webCandidateKeys(ownerId, definition)) {
    const raw = await quotaSafeGetItem(storageKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as T[];
    } catch { /* Continue to the next retained compatibility key. */ }
  }
  return [];
}

export function getHighVolumeDefinition(domain: string): HighVolumeDomain | undefined {
  return HIGH_VOLUME_DOMAINS.find((entry) => entry.domain === domain);
}

export function getHighVolumeDefinitionForStorageKey(storageKey: string): HighVolumeDomain | undefined {
  return HIGH_VOLUME_DOMAINS.find((entry) =>
    [entry.storageKey, ...(entry.storageAliases ?? [])].some((base) => storageKey === base || storageKey.startsWith(`${base}::`)),
  );
}

export function getHighVolumeOwner(ownerId: string | null | undefined, definition: HighVolumeDomain): string {
  return definition.shared ? SHARED_OWNER : normalizedOwner(ownerId);
}

function toRows(
  ownerId: string,
  definition: HighVolumeDomain,
  records: readonly unknown[],
  sourceStorageKey?: string,
): DomainRecordRow[] {
  const updatedAt = new Date().toISOString();
  const effectiveOwner = getHighVolumeOwner(ownerId, definition);
  return records.map((record, index) => {
    const recordJson = JSON.stringify(record);
    return {
      ownerId: effectiveOwner,
      domain: definition.domain,
      recordId: highVolumeRecordId(record, index),
      recordJson,
      sourceStorageKey: sourceStorageKey ?? null,
      sourceHash: hashText(recordJson),
      updatedAt,
    };
  });
}

/**
 * Transactionally replaces a complete domain snapshot. The legacy artifact is
 * written separately by existing import/export code and remains a rollback
 * source until the release after the repository cutover is proven in TestFlight.
 */
export async function replaceHighVolumeDomain(
  ownerId: string,
  domain: HighVolumeDomainName | string,
  records: readonly unknown[],
  sourceStorageKey?: string,
): Promise<number> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return 0;
  if (isWeb) {
    const [storageKey] = webCandidateKeys(ownerId, definition, sourceStorageKey);
    await quotaSafeSetJsonItem(storageKey, records);
    return records.length;
  }
  const rows = toRows(ownerId, definition, records, sourceStorageKey);
  await replaceDomainRecords(getHighVolumeOwner(ownerId, definition), definition.domain, rows);
  return rows.length;
}

export async function upsertHighVolumeDomain(
  ownerId: string,
  domain: HighVolumeDomainName | string,
  records: readonly unknown[],
  sourceStorageKey?: string,
): Promise<number> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return 0;
  if (isWeb) {
    const existing = await readWebDomain<unknown>(ownerId, definition);
    const merged = new Map(existing.map((record, index) => [highVolumeRecordId(record, index), record]));
    records.forEach((record, index) => merged.set(highVolumeRecordId(record, existing.length + index), record));
    return replaceHighVolumeDomain(ownerId, domain, Array.from(merged.values()), sourceStorageKey);
  }
  const rows = toRows(ownerId, definition, records, sourceStorageKey);
  await upsertDomainRecords(rows);
  return rows.length;
}

export async function listHighVolumeDomain<T>(
  ownerId: string,
  domain: HighVolumeDomainName | string,
): Promise<T[]> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return [];
  if (isWeb) return readWebDomain<T>(ownerId, definition);
  return listAllDomainRecords<T>(getHighVolumeOwner(ownerId, definition), definition.domain);
}

/** Returns all profile-owned rows for one authenticated account. */
export async function listHighVolumeDomainByOwnerPrefix<T>(
  ownerPrefix: string,
  domain: HighVolumeDomainName | string,
): Promise<T[]> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return [];
  if (isWeb) {
    if (definition.shared) return readWebDomain<T>(SHARED_OWNER, definition);
    const accountOwner = normalizedOwner(ownerPrefix.split('::profile::')[0]);
    const allKeys = await AsyncStorage.getAllKeys();
    const bases = [definition.storageKey, ...(definition.storageAliases ?? [])];
    const suffix = `::${accountOwner}`;
    const keys = allKeys.filter((key) =>
      bases.some((base) => key.startsWith(`${base}::profile::`)) && key.toLowerCase().endsWith(suffix),
    );
    const collections = await Promise.all(keys.map(async (key) => {
      const raw = await quotaSafeGetItem(key);
      if (!raw) return [] as T[];
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return [] as T[]; }
    }));
    return collections.flat();
  }
  if (definition.shared) return listAllDomainRecords<T>(SHARED_OWNER, definition.domain);
  return listAllDomainRecordsByOwnerPrefix<T>(normalizedOwner(ownerPrefix), definition.domain);
}

export async function countHighVolumeDomain(
  ownerId: string,
  domain: HighVolumeDomainName | string,
): Promise<number> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return 0;
  if (isWeb) return (await readWebDomain<unknown>(ownerId, definition)).length;
  return countDomainRecords(getHighVolumeOwner(ownerId, definition), definition.domain);
}

export interface HighVolumePage<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Reads only the requested slice. This is the normal API for filterable crew,
 * certificate, session, and machine screens; full-domain hydration is reserved
 * for explicit export/reconciliation work.
 */
export async function listHighVolumeDomainPage<T>(
  ownerId: string,
  domain: HighVolumeDomainName | string,
  options?: { limit?: number; offset?: number; search?: string },
): Promise<HighVolumePage<T>> {
  const definition = getHighVolumeDefinition(domain);
  const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
  const offset = Math.max(0, options?.offset ?? 0);
  if (!definition) return { rows: [], total: 0, limit, offset, hasMore: false };
  if (isWeb) {
    const records = await readWebDomain<T>(ownerId, definition);
    const needle = options?.search?.trim().toLowerCase();
    const filtered = needle
      ? records.filter((record) => JSON.stringify(record).toLowerCase().includes(needle))
      : records;
    const rows = filtered.slice(offset, offset + limit);
    return { rows, total: filtered.length, limit, offset, hasMore: offset + rows.length < filtered.length };
  }
  const effectiveOwner = getHighVolumeOwner(ownerId, definition);
  const [rows, total] = await Promise.all([
    listDomainRecordsFiltered<T>(effectiveOwner, definition.domain, { ...options, limit, offset }),
    countDomainRecordsFiltered(effectiveOwner, definition.domain, options?.search),
  ]);
  return { rows, total, limit, offset, hasMore: offset + rows.length < total };
}

/**
 * Migrates a legacy snapshot only when the indexed repository is empty, then
 * returns the indexed rows. Repeated launches never parse the large source
 * JSON after the migration checkpoint is complete.
 */
export async function hydrateHighVolumeDomain<T>(
  ownerId: string,
  domain: HighVolumeDomainName | string,
): Promise<T[]> {
  const definition = getHighVolumeDefinition(domain);
  if (!definition) return [];
  if (isWeb) return readWebDomain<T>(ownerId, definition);
  const effectiveOwner = getHighVolumeOwner(ownerId, definition);
  if (await countDomainRecords(effectiveOwner, definition.domain) === 0) {
    await migrateHighVolumeDomain(normalizedOwner(ownerId), definition);
  }
  return listAllDomainRecords<T>(effectiveOwner, definition.domain);
}

/** Mirrors an existing durable storage commit into the indexed authority. */
export async function mirrorStorageDatasetToRepository(
  storageKey: string,
  ownerId: string,
  data: unknown,
): Promise<number> {
  const definition = getHighVolumeDefinitionForStorageKey(storageKey);
  if (!definition || !Array.isArray(data)) return 0;
  return replaceHighVolumeDomain(ownerId, definition.domain, data, storageKey);
}
