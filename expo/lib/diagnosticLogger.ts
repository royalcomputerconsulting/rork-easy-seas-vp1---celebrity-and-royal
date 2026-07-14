export type DiagnosticLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';
export type DiagnosticCategory =
  | 'APP'
  | 'NAVIGATION'
  | 'PERFORMANCE'
  | 'SYNC'
  | 'SYNC_OFFERS'
  | 'SYNC_COMPLETED'
  | 'SYNC_BOOKINGS'
  | 'SYNC_LOYALTY'
  | 'STORAGE'
  | 'DETAIL'
  | 'EDIT'
  | 'ERROR'
  | 'WARNING'
  | 'NETWORK'
  | 'ADMIN';

export type DiagnosticEvent = {
  ts: string;
  level: DiagnosticLevel;
  category: DiagnosticCategory;
  event: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
};

const MAX_EVENTS = 5000;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_EVENTS_PER_WINDOW = 40;
const tabStarts = new Map<string, number>();
let events: DiagnosticEvent[] = [];
let rateLimitWindowStart = 0;
let rateLimitCountInWindow = 0;
let rateLimitDroppedInWindow = 0;

function clip(value: unknown, max = 2500): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  try {
    const json = JSON.stringify(value);
    if (json.length > max) return `${json.slice(0, max)}…[truncated]`;
    return value as Record<string, unknown>;
  } catch {
    return String(value).slice(0, max);
  }
}

function schedulePersist() {
  // v1076 native-safe diagnostics: no automatic AsyncStorage writes.
  // Diagnostics remain memory-only until the user explicitly exports/clears them.
  return;
}

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
    if (rateLimitDroppedInWindow > 0) {
      events.push({
        ts: new Date().toISOString(),
        level: 'warning',
        category: 'PERFORMANCE',
        event: 'DIAGNOSTIC_RATE_LIMITED',
        message: `Dropped ${rateLimitDroppedInWindow} diagnostic event(s) in the last second to protect app performance`,
      });
    }
    rateLimitWindowStart = now;
    rateLimitCountInWindow = 0;
    rateLimitDroppedInWindow = 0;
  }
  rateLimitCountInWindow += 1;
  if (rateLimitCountInWindow > RATE_LIMIT_MAX_EVENTS_PER_WINDOW) {
    rateLimitDroppedInWindow += 1;
    return true;
  }
  return false;
}

export function recordDiagnosticEvent(input: Omit<DiagnosticEvent, 'ts'>) {
  try {
    if (isRateLimited()) return;
    const entry: DiagnosticEvent = {
      ts: new Date().toISOString(),
      ...input,
      data: input.data ? Object.fromEntries(Object.entries(input.data).map(([k, v]) => [k, clip(v)])) : undefined,
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    schedulePersist();
  } catch {
    // Diagnostic logging must never be able to crash or destabilize the app.
  }
}

export async function initializeDiagnosticLogger() {
  recordDiagnosticEvent({
    level: 'info',
    category: 'APP',
    event: 'APP_START',
    message: 'Easy Seas app session started',
  });
}

export function markTabSwitchStart(from: string, to: string) {
  const key = `${from}->${to}`;
  tabStarts.set(key, Date.now());
  recordDiagnosticEvent({ level: 'info', category: 'NAVIGATION', event: 'TAB_SWITCH_START', message: `${from} → ${to}`, data: { from, to } });
}

export function markTabSwitchEnd(from: string, to: string) {
  const key = `${from}->${to}`;
  const started = tabStarts.get(key);
  const durationMs = started ? Date.now() - started : undefined;
  if (started) tabStarts.delete(key);
  const level: DiagnosticLevel = durationMs == null ? 'info' : durationMs > 3000 ? 'error' : durationMs > 1000 ? 'warning' : 'info';
  recordDiagnosticEvent({ level, category: 'PERFORMANCE', event: 'TAB_SWITCH_END', message: `${from} → ${to}${durationMs != null ? `: ${durationMs}ms` : ''}`, durationMs, data: { from, to } });
}

export function recordScreenMount(screen: string, counts?: Record<string, unknown>) {
  recordDiagnosticEvent({ level: 'info', category: 'NAVIGATION', event: 'SCREEN_MOUNT', message: `${screen} mounted`, data: counts });
}

export function getDiagnosticEvents() {
  return [...events];
}

export async function clearDiagnosticEvents() {
  events = [];
  recordDiagnosticEvent({ level: 'info', category: 'ADMIN', event: 'DIAGNOSTIC_LOGS_CLEARED', message: 'Diagnostic logs cleared' });
}

export async function buildDiagnosticExport(stateSnapshot?: Record<string, unknown>) {
  const storedEvents = events;
  const slowTabs = storedEvents.filter(e => e.event === 'TAB_SWITCH_END' && (e.durationMs ?? 0) > 1000);
  const errors = storedEvents.filter(e => e.level === 'error');
  const warnings = storedEvents.filter(e => e.level === 'warning');
  const syncEvents = storedEvents.filter(e => e.category.startsWith('SYNC'));
  const lines = [
    'Easy Seas Diagnostic Summary',
    `Exported: ${new Date().toLocaleString()}`,
    `Events: ${storedEvents.length}`,
    `Errors: ${errors.length}`,
    `Warnings: ${warnings.length}`,
    `Slow tab switches: ${slowTabs.length}`,
    `Sync events: ${syncEvents.length}`,
    '',
    'Recent Events:',
    ...storedEvents.slice(-250).map(e => `${e.ts} [${e.level}] ${e.category}/${e.event}: ${e.message}${e.durationMs != null ? ` (${e.durationMs}ms)` : ''}`),
  ];
  if (stateSnapshot) {
    lines.push('', 'State Snapshot:', JSON.stringify(clip(stateSnapshot, 10000), null, 2));
  }
  return lines.join('\n');
}
