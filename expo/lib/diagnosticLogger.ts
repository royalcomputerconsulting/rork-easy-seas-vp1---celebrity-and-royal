import AsyncStorage from '@react-native-async-storage/async-storage';

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
const STORAGE_KEY = 'easyseas_diagnostic_events_v1';
const tabStarts = new Map<string, number>();
let events: DiagnosticEvent[] = [];
let initialized = false;
let originalConsoleLog: typeof console.log | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let originalConsoleError: typeof console.error | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS))).catch(() => {});
  }, 1500);
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
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) events = parsed.slice(-MAX_EVENTS);
    }
  } catch {}

  recordDiagnosticEvent({
    level: 'info',
    category: 'APP',
    event: 'APP_START',
    message: 'Easy Seas app session started',
  });

  if (!originalConsoleLog) {
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.log = (...args: any[]) => {
      originalConsoleLog?.(...args);
      const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(clip(a, 800))).join(' ');
      if (/\[RoyalCaribbeanSync\]|Sync|sync|Offer|Cruise|Settings|Overview|Booked|Performance/i.test(text)) {
        recordDiagnosticEvent({ level: 'debug', category: text.includes('RoyalCaribbeanSync') || /sync/i.test(text) ? 'SYNC' : 'APP', event: 'CONSOLE_LOG', message: text });
      }
    };
    console.warn = (...args: any[]) => {
      originalConsoleWarn?.(...args);
      recordDiagnosticEvent({ level: 'warning', category: 'WARNING', event: 'CONSOLE_WARN', message: args.map(a => String(clip(a, 800))).join(' ') });
    };
    console.error = (...args: any[]) => {
      originalConsoleError?.(...args);
      recordDiagnosticEvent({ level: 'error', category: 'ERROR', event: 'CONSOLE_ERROR', message: args.map(a => String(clip(a, 800))).join(' ') });
    };
  }
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
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  recordDiagnosticEvent({ level: 'info', category: 'ADMIN', event: 'DIAGNOSTIC_LOGS_CLEARED', message: 'Diagnostic logs cleared' });
}

export async function buildDiagnosticExport(stateSnapshot?: Record<string, unknown>) {
  let storedEvents = events;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > storedEvents.length) storedEvents = parsed;
    }
  } catch {}

  const slowTabs = storedEvents.filter(e => e.event === 'TAB_SWITCH_END' && (e.durationMs ?? 0) > 1000);
  const errors = storedEvents.filter(e => e.level === 'error');
  const warnings = storedEvents.filter(e => e.level === 'warning');
  const syncEvents = storedEvents.filter(e => e.category.startsWith('SYNC'));
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
    'WARNINGS',
    ...(warnings.length ? warnings.slice(-80).map(e => `${new Date(e.ts).toLocaleTimeString()} ${e.message}`) : ['None recorded']),
    '',
    'ERRORS',
    ...(errors.length ? errors.slice(-80).map(e => `${new Date(e.ts).toLocaleTimeString()} ${e.message}`) : ['None recorded']),
  ];
  return {
    summaryText: lines.join('\n'),
    rawJsonl: storedEvents.map(e => JSON.stringify(e)).join('\n'),
    stateSnapshot: JSON.stringify(stateSnapshot || {}, null, 2),
  };
}
