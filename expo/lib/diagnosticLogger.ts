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
  | 'CASINO'
  | 'RENDER'
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
const STORAGE_KEY = 'easyseas_diagnostic_events_v1';
const tabStarts = new Map<string, number>();
let events: DiagnosticEvent[] = [];
let initialized = false;
let originalConsoleLog: typeof console.log | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let originalConsoleError: typeof console.error | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let globalErrorHandlerInstalled = false;

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


function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  try {
    return { message: typeof error === 'string' ? error : JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function recordDiagnosticError(
  category: DiagnosticCategory,
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const normalized = normalizeError(error);
  recordDiagnosticEvent({
    level: 'error',
    category,
    event,
    message: String(normalized.message || event),
    data: {
      ...context,
      errorName: normalized.name,
      errorMessage: normalized.message,
      errorStack: normalized.stack,
    },
  });
}

function schedulePersist() {
  // v1073: disable automatic storage writes from diagnostic events.
  // Native crash reports showed TurboModule exception conversion crashes during
  // Casino tab entry. Auto-persisting thousands of diagnostic/console events
  // through native storage can trigger that native path before JS can catch it.
  // Logs remain available in-memory for Export Diagnostics during the session;
  // explicit clear/export actions still use native storage only when requested.
  return;
}

export function recordDiagnosticEvent(input: Omit<DiagnosticEvent, 'ts'>) {
  const entry: DiagnosticEvent = {
    ts: new Date().toISOString(),
    ...input,
    data: input.data ? Object.fromEntries(Object.entries(input.data).map(([k, v]) => [k, clip(v)])) : undefined,
  };
  events.push(entry);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  schedulePersist();
}

export async function initializeDiagnosticLogger() {
  if (initialized) return;
  initialized = true;
  recordDiagnosticEvent({
    level: 'info',
    category: 'APP',
    event: 'APP_START',
    message: 'Easy Seas app session started in memory-only diagnostic mode',
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
  let storedEvents = events;

  const slowTabs = storedEvents.filter(e => e.event === 'TAB_SWITCH_END' && (e.durationMs ?? 0) > 1000);
  const errors = storedEvents.filter(e => e.level === 'error');
  const warnings = storedEvents.filter(e => e.level === 'warning');
  const syncEvents = storedEvents.filter(e => String(e.category).startsWith('SYNC'));
  const casinoEvents = storedEvents.filter(e => e.category === 'CASINO' || /Casino|Analytics/i.test(e.message) || /CASINO|ANALYTICS/i.test(e.event));
  const formatEventDetail = (e: DiagnosticEvent) => {
    const base = `${new Date(e.ts).toLocaleTimeString()} [${e.level.toUpperCase()}] ${e.event}: ${e.message}`;
    if (!e.data) return base;
    try {
      return `${base}
  data=${JSON.stringify(e.data)}`;
    } catch {
      return base;
    }
  };
  const lines = [
    'Easy Seas Diagnostic Summary',
    `Exported: ${new Date().toLocaleString()}`,
    `Events: ${storedEvents.length}`,
    '',
    'STATE SNAPSHOT',
    JSON.stringify(stateSnapshot || {}, null, 2),
    '',
    'SLOW TAB / SCREEN EVENTS',
    ...(slowTabs.length ? slowTabs.slice(-60).map(e => `${new Date(e.ts).toLocaleTimeString()} ${e.message}`) : ['None recorded']),
    '',
    'SYNC MILESTONES',
    ...(syncEvents.length ? syncEvents.slice(-120).map(e => `${new Date(e.ts).toLocaleTimeString()} [${e.level.toUpperCase()}] ${e.message}`) : ['None recorded']),
    '',
    'CASINO / ANALYTICS EVENTS',
    ...(casinoEvents.length ? casinoEvents.slice(-160).map(formatEventDetail) : ['None recorded']),
    '',
    'WARNINGS',
    ...(warnings.length ? warnings.slice(-80).map(e => `${new Date(e.ts).toLocaleTimeString()} ${e.message}`) : ['None recorded']),
    '',
    'ERRORS',
    ...(errors.length ? errors.slice(-80).map(formatEventDetail) : ['None recorded']),
  ];
  return {
    summaryText: lines.join('\n'),
    rawJsonl: storedEvents.map(e => JSON.stringify(e)).join('\n'),
    stateSnapshot: JSON.stringify(stateSnapshot || {}, null, 2),
  };
}
