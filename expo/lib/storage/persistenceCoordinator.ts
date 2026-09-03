export type PersistenceStage = 'queued' | 'serializing' | 'writing' | 'verifying' | 'committed' | 'failed' | 'cancelled';

export interface PersistenceProgress {
  key: string;
  runId: string;
  stage: PersistenceStage;
  startedAt: number;
  updatedAt: number;
  bytes?: number;
  hash?: string;
  error?: string;
}

export interface PersistenceCommitResult {
  key: string;
  runId: string;
  bytes: number;
  hash: string;
  committedAt: string;
  deduplicated?: boolean;
}

interface QueueEntry<T> {
  runId: string;
  key: string;
  hash?: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  queuedAt: number;
}

const queues = new Map<string, QueueEntry<unknown>[]>();
const activeRunByKey = new Map<string, string>();
const newestQueuedRunByKey = new Map<string, string>();
const lastCommittedHashByKey = new Map<string, string>();
const listeners = new Set<(event: PersistenceProgress) => void>();
let pendingCount = 0;
let flushResolvers: Array<() => void> = [];

function emit(event: PersistenceProgress): void {
  for (const listener of listeners) {
    try { listener(event); } catch { /* diagnostics must never break writes */ }
  }
}

function settleFlushIfIdle(): void {
  if (pendingCount !== 0 || activeRunByKey.size !== 0) return;
  const resolvers = flushResolvers;
  flushResolvers = [];
  resolvers.forEach((resolve) => resolve());
}

function cancelSupersededQueuedEntries(key: string, replacementRunId: string): void {
  const queue = queues.get(key);
  if (!queue?.length) return;
  const now = Date.now();
  for (const entry of queue) {
    emit({
      key,
      runId: entry.runId,
      stage: 'cancelled',
      startedAt: entry.queuedAt,
      updatedAt: now,
      hash: entry.hash,
      error: `SUPERSEDED_BY:${replacementRunId}`,
    });
    entry.reject(new Error(`SUPERSEDED_PERSISTENCE_RUN:${key}:${replacementRunId}`));
    pendingCount -= 1;
  }
  queues.set(key, []);
}

async function drain(key: string): Promise<void> {
  if (activeRunByKey.has(key)) return;
  const queue = queues.get(key);
  const next = queue?.shift();
  if (!next) {
    queues.delete(key);
    newestQueuedRunByKey.delete(key);
    settleFlushIfIdle();
    return;
  }

  activeRunByKey.set(key, next.runId);
  if (newestQueuedRunByKey.get(key) === next.runId) newestQueuedRunByKey.delete(key);
  const startedAt = Date.now();
  try {
    if (next.hash && lastCommittedHashByKey.get(key) === next.hash) {
      emit({ key, runId: next.runId, stage: 'committed', startedAt, updatedAt: Date.now(), hash: next.hash });
      next.resolve(({ key, runId: next.runId, bytes: 0, hash: next.hash, committedAt: new Date().toISOString(), deduplicated: true } as unknown) as never);
    } else {
      emit({ key, runId: next.runId, stage: 'writing', startedAt, updatedAt: Date.now(), hash: next.hash });
      const result = await next.execute();
      if (next.hash) lastCommittedHashByKey.set(key, next.hash);
      emit({ key, runId: next.runId, stage: 'committed', startedAt, updatedAt: Date.now(), hash: next.hash });
      next.resolve(result);
    }
  } catch (error) {
    emit({ key, runId: next.runId, stage: 'failed', startedAt, updatedAt: Date.now(), error: error instanceof Error ? error.message : String(error) });
    next.reject(error);
  } finally {
    pendingCount -= 1;
    activeRunByKey.delete(key);
    void drain(key);
  }
}

export function createPersistenceRunId(prefix = 'persist'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compatibility helper. Active writes remain authoritative until they finish;
 * only queued writes are superseded. This prevents an in-flight native file
 * from becoming stale between pointer activation and commit acknowledgement.
 */
export function markLatestPersistenceRun(key: string, runId: string): void {
  newestQueuedRunByKey.set(key, runId);
}

export function isLatestPersistenceRun(key: string, runId: string): boolean {
  return activeRunByKey.get(key) === runId || newestQueuedRunByKey.get(key) === runId;
}

export function enqueuePersistence<T>(options: {
  key: string;
  runId?: string;
  hash?: string;
  execute: () => Promise<T>;
}): Promise<T> {
  const runId = options.runId ?? createPersistenceRunId();
  cancelSupersededQueuedEntries(options.key, runId);
  newestQueuedRunByKey.set(options.key, runId);
  pendingCount += 1;
  const queuedAt = Date.now();
  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry<T> = { ...options, runId, resolve, reject, queuedAt };
    const queue = queues.get(options.key) ?? [];
    queue.push(entry as QueueEntry<unknown>);
    queues.set(options.key, queue);
    emit({ key: options.key, runId, stage: 'queued', startedAt: queuedAt, updatedAt: queuedAt, hash: options.hash });
    void drain(options.key);
  });
}

export function subscribePersistenceProgress(listener: (event: PersistenceProgress) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function flushPersistence(): Promise<void> {
  if (pendingCount === 0 && activeRunByKey.size === 0) return Promise.resolve();
  return new Promise((resolve) => flushResolvers.push(resolve));
}

export function resetPersistenceCoordinatorForTests(): void {
  queues.clear(); activeRunByKey.clear(); newestQueuedRunByKey.clear(); lastCommittedHashByKey.clear();
  pendingCount = 0; flushResolvers = []; listeners.clear();
}
