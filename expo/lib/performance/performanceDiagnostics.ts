export interface PerformanceDiagnosticEntry {
  name: string;
  startedAt: string;
  durationMs?: number;
  count?: number;
  metadata?: Record<string, unknown>;
  memoryBytes?: number;
}

const MAX_DIAGNOSTIC_ENTRIES = 500;
const entries: PerformanceDiagnosticEntry[] = [];
const renderCounts = new Map<string, number>();

function diagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function currentMemoryBytes(): number | undefined {
  const memory = typeof performance !== 'undefined'
    ? (performance as typeof performance & { memory?: { usedJSHeapSize?: number } }).memory
    : undefined;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : undefined;
}

function append(entry: PerformanceDiagnosticEntry): void {
  if (!diagnosticsEnabled()) return;
  entries.push(entry);
  if (entries.length > MAX_DIAGNOSTIC_ENTRIES) {
    entries.splice(0, entries.length - MAX_DIAGNOSTIC_ENTRIES);
  }
  console.log('[EasySeasPerformance]', entry);
}

export function beginPerformanceSpan(
  name: string,
  metadata?: Record<string, unknown>,
): (completionMetadata?: Record<string, unknown>) => number {
  if (!diagnosticsEnabled()) return () => 0;
  const started = nowMs();
  const startedAt = new Date().toISOString();
  return (completionMetadata?: Record<string, unknown>) => {
    const durationMs = Math.max(0, nowMs() - started);
    append({
      name,
      startedAt,
      durationMs: Number(durationMs.toFixed(2)),
      memoryBytes: currentMemoryBytes(),
      metadata: { ...metadata, ...completionMetadata },
    });
    return durationMs;
  };
}

export function recordPerformanceCount(
  name: string,
  count: number,
  metadata?: Record<string, unknown>,
): void {
  append({
    name,
    startedAt: new Date().toISOString(),
    count,
    memoryBytes: currentMemoryBytes(),
    metadata,
  });
}

export function recordProviderRender(name: string, metadata?: Record<string, unknown>): number {
  if (!diagnosticsEnabled()) return 0;
  const count = (renderCounts.get(name) ?? 0) + 1;
  renderCounts.set(name, count);
  // Log the first render, then sample to avoid creating the UI chatter that
  // these diagnostics are meant to identify.
  if (count === 1 || count % 10 === 0) {
    recordPerformanceCount(`${name}.renderCount`, count, metadata);
  }
  return count;
}

export function getPerformanceDiagnosticsSnapshot(): PerformanceDiagnosticEntry[] {
  return entries.map((entry) => ({
    ...entry,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  }));
}

export function clearPerformanceDiagnostics(): void {
  entries.splice(0, entries.length);
  renderCounts.clear();
}
