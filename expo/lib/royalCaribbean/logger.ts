import { LogEntry } from './types';

type LogType = 'info' | 'success' | 'warning' | 'error';

class RoyalCaribbeanLogger {
  private logs: LogEntry[] = [];

  log(message: string, type: LogType = 'info') {
    const timestamp = new Date().toISOString();
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const entry: LogEntry = {
      timestamp: formattedTimestamp,
      message,
      type
    };

    this.logs.push(entry);
    console.log(`[RC Sync ${type.toUpperCase()}] ${message}`);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getDisplayLogs(): LogEntry[] {
    return this.logs.filter((l) => (l.type ?? 'info') === 'success');
  }

  getNotes(): LogEntry[] {
    return this.logs.filter((l) => (l.type ?? 'info') !== 'success');
  }

  getLogsAsText(options?: { includeNotes?: boolean }): string {
    const includeNotes = options?.includeNotes ?? true;

    const successLines = this.getDisplayLogs().map(
      (entry) => `[${entry.timestamp}] ${entry.message}`
    );

    if (!includeNotes) {
      return successLines.join('\n');
    }

    const notes = this.getNotes();
    const noteLines = notes.map((entry) => {
      const type = (entry.type ?? 'info').toUpperCase();
      return `[${entry.timestamp}] (${type}) ${entry.message}`;
    });

    return [...successLines, '', '--- NOTES ---', ...noteLines].join('\n');
  }

  clear() {
    this.logs = [];
  }
}

export const rcLogger = new RoyalCaribbeanLogger();
