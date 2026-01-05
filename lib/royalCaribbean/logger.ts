import { LogEntry } from './types';

class RoyalCaribbeanLogger {
  private logs: LogEntry[] = [];

  log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
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

  getLogsAsText(): string {
    return this.logs
      .map(entry => `[${entry.timestamp}] ${entry.message}`)
      .join('\n');
  }

  clear() {
    this.logs = [];
  }
}

export const rcLogger = new RoyalCaribbeanLogger();
