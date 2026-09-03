import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const journalPath = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}easyseas-sync-journal.log` : null;
let chain: Promise<void> = Promise.resolve();
const memory: string[] = [];
const sessionStartedAt = new Date().toISOString();
const sessionId = `easyseas-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface CurrentSessionJournalEntry {
  ts: string;
  event: string;
  details?: Record<string, unknown>;
}

const currentSessionEntries: CurrentSessionJournalEntry[] = [];

export function appendDiagnosticJournal(event: string, details?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const line = `${ts} ${event}${details ? ` ${JSON.stringify(details)}` : ''}\n`;
  memory.push(line);
  if (memory.length > 2000) memory.splice(0, memory.length - 2000);
  currentSessionEntries.push({ ts, event, details });
  if (currentSessionEntries.length > 2000) currentSessionEntries.splice(0, currentSessionEntries.length - 2000);
  if (Platform.OS === 'web' || !journalPath) return;
  chain = chain.then(async () => {
    const info = await FileSystem.getInfoAsync(journalPath);
    let existing = '';
    if (info.exists) {
      existing = await FileSystem.readAsStringAsync(journalPath, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => '');
      if (existing.length > 500_000) existing = existing.slice(-350_000);
    }
    await FileSystem.writeAsStringAsync(journalPath, `${existing}${line}`, { encoding: FileSystem.EncodingType.UTF8 });
  }).catch(() => undefined);
}

export async function readDiagnosticJournal(): Promise<string> {
  if (Platform.OS !== 'web' && journalPath) {
    try {
      const info = await FileSystem.getInfoAsync(journalPath);
      if (info.exists) return await FileSystem.readAsStringAsync(journalPath, { encoding: FileSystem.EncodingType.UTF8 });
    } catch { /* memory fallback */ }
  }
  return memory.join('');
}

export async function flushDiagnosticJournal(): Promise<void> { await chain; }

export function getCurrentSessionJournal(): { sessionId: string; startedAt: string; entries: CurrentSessionJournalEntry[] } {
  return {
    sessionId,
    startedAt: sessionStartedAt,
    entries: currentSessionEntries.map((entry) => ({ ...entry, details: entry.details ? { ...entry.details } : undefined })),
  };
}
