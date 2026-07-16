export const CERTIFICATE_DOWNLOAD_LOG_VERSION = 'v12.4.0-certificate-download-live-log-export';

export type CertificateDownloadLogType = 'info' | 'success' | 'warning' | 'error';

export interface CertificateDownloadLogEntry {
  id: string;
  timestamp: string;
  isoTimestamp: string;
  type: CertificateDownloadLogType;
  message: string;
  certificateCodes?: string[];
}

export interface CertificateDownloadLogSnapshot {
  entries: CertificateDownloadLogEntry[];
  currentActivity: string;
  currentCertificateCodes: string[];
  isActive: boolean;
  sessionStartedAt: string | null;
}

type Listener = (snapshot: CertificateDownloadLogSnapshot) => void;

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

class CertificateDownloadLogger {
  private entries: CertificateDownloadLogEntry[] = [];
  private listeners = new Set<Listener>();
  private currentActivity = 'Ready to download A and C certificates.';
  private currentCertificateCodes: string[] = [];
  private isActive = false;
  private sessionStartedAt: string | null = null;
  private nextId = 1;

  private emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[CertificateDownloadLogger] listener failed', error);
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): CertificateDownloadLogSnapshot {
    return {
      entries: [...this.entries],
      currentActivity: this.currentActivity,
      currentCertificateCodes: [...this.currentCertificateCodes],
      isActive: this.isActive,
      sessionStartedAt: this.sessionStartedAt,
    };
  }

  startSession(message: string, options?: { reset?: boolean; certificateCodes?: string[] }) {
    if (options?.reset !== false) {
      this.entries = [];
      this.nextId = 1;
    }
    this.sessionStartedAt = new Date().toISOString();
    this.isActive = true;
    this.currentActivity = message;
    this.currentCertificateCodes = [...(options?.certificateCodes ?? [])];
    this.log(message, 'info', options?.certificateCodes, false);
    this.emit();
  }

  setActivity(message: string, certificateCodes?: string[]) {
    this.currentActivity = message;
    this.currentCertificateCodes = [...(certificateCodes ?? [])];
    this.isActive = true;
    this.emit();
  }

  log(
    message: string,
    type: CertificateDownloadLogType = 'info',
    certificateCodes?: string[],
    emit = true,
  ) {
    const now = new Date();
    const entry: CertificateDownloadLogEntry = {
      id: `certificate-log-${this.nextId++}`,
      timestamp: formatTimestamp(now),
      isoTimestamp: now.toISOString(),
      type,
      message: String(message || '').trim(),
      certificateCodes: certificateCodes?.length ? [...certificateCodes] : undefined,
    };
    this.entries.push(entry);
    if (this.entries.length > 750) {
      this.entries = this.entries.slice(-750);
    }
    // Certificate download failures are already caught, retried, surfaced in
    // this in-app log panel, and shown via a friendly Alert to the user — so
    // we intentionally use console.warn (not console.error) here. A raw
    // console.error triggers a disruptive full-screen dev error overlay that
    // looks like the app crashed, even though the failure is fully handled.
    const consoleMethod = type === 'error' || type === 'warning' ? console.warn : console.log;
    consoleMethod(`[Certificate Download ${type.toUpperCase()}] ${entry.message}`);
    if (emit) this.emit();
  }

  finish(message: string, type: CertificateDownloadLogType = 'success') {
    this.isActive = false;
    this.currentActivity = message;
    this.currentCertificateCodes = [];
    this.log(message, type, undefined, false);
    this.emit();
  }

  clear() {
    this.entries = [];
    this.currentActivity = 'Ready to download A and C certificates.';
    this.currentCertificateCodes = [];
    this.isActive = false;
    this.sessionStartedAt = null;
    this.nextId = 1;
    this.emit();
  }

  getLogsAsText(): string {
    const header = [
      'Easy Seas Certificate Download Log',
      `Engine: ${CERTIFICATE_DOWNLOAD_LOG_VERSION}`,
      `Exported: ${new Date().toISOString()}`,
      `Session started: ${this.sessionStartedAt ?? 'not started'}`,
      `Current status: ${this.currentActivity}`,
      '',
      '--- ACTIVITY ---',
    ];
    const lines = this.entries.map((entry) => {
      const codes = entry.certificateCodes?.length ? ` [${entry.certificateCodes.join(', ')}]` : '';
      return `[${entry.timestamp}] (${entry.type.toUpperCase()})${codes} ${entry.message}`;
    });
    return [...header, ...lines].join('\n');
  }
}

export const certificateDownloadLogger = new CertificateDownloadLogger();
