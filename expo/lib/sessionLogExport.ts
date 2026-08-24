import { getDiagnosticEvents } from '@/lib/diagnosticLogger';
import { getCurrentSessionJournal } from '@/lib/storage/diagnosticJournal';

export const CURRENT_USER_SESSION_LOG_SCHEMA_VERSION = 1;

const REDACTED = '[REDACTED]';
const SECRET_KEY = /(password|passcode|secret|token|cookie|authorization|sessioncookie|bytesbase64|pdfbytes|privatekey)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 7) return '[MAX_DEPTH]';
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}…[truncated]` : value;
  if (Array.isArray(value)) return value.slice(-2000).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return String(value);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SECRET_KEY.test(key) ? REDACTED : sanitize(item, depth + 1),
  ]));
}

export function buildCurrentUserSessionLog(input: {
  appVersion: string;
  platform: string;
  user?: { profileId?: string | null; name?: string | null; email?: string | null; isAdmin?: boolean };
  stateSnapshot?: Record<string, unknown>;
}): string {
  const journal = getCurrentSessionJournal();
  const diagnosticEvents = getDiagnosticEvents();
  const exportedAt = new Date().toISOString();
  const payload = {
    schemaVersion: CURRENT_USER_SESSION_LOG_SCHEMA_VERSION,
    kind: 'easyseas-current-user-session-log',
    app: { version: input.appVersion, platform: input.platform },
    session: {
      id: journal.sessionId,
      startedAt: journal.startedAt,
      exportedAt,
      durationMs: Math.max(0, new Date(exportedAt).getTime() - new Date(journal.startedAt).getTime()),
    },
    user: sanitize(input.user ?? {}),
    state: sanitize(input.stateSnapshot ?? {}),
    summary: {
      journalEvents: journal.entries.length,
      diagnosticEvents: diagnosticEvents.length,
      warnings: diagnosticEvents.filter((event) => event.level === 'warning').length,
      errors: diagnosticEvents.filter((event) => event.level === 'error').length,
    },
    diagnosticEvents: sanitize(diagnosticEvents),
    journalEvents: sanitize(journal.entries),
  };
  return JSON.stringify(payload, null, 2);
}
