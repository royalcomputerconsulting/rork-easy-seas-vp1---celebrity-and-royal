import { LogEntry } from './types';

type LogType = 'info' | 'success' | 'warning' | 'error';

function stripUrls(value: string): string {
  return String(value || '').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
}

function friendlySyncMessage(message: string): string {
  const raw = String(message || '');
  const clean = stripUrls(raw);
  let match = clean.match(/Offer discovered\s+(\d+):\s+([A-Z0-9]+)\s+—\s+(.+)/i);
  if (match) return `Found offer ${match[2]} — ${match[3]}`;
  match = clean.match(/Browser fallback opening offer\s+(\d+\/\d+):\s+([A-Z0-9]+)/i);
  if (match) return `Opening offer ${match[1]}: ${match[2]}`;
  match = clean.match(/Opening offer\s+(\d+\/\d+):\s+([A-Z0-9]+)/i);
  if (match) return `Opening offer ${match[1]}: ${match[2]}`;
  match = clean.match(/Scraping (?:View Sailings detail page for|offer)\s+([A-Z0-9]+)/i);
  if (match) return `Scraping offer ${match[1]}`;
  match = clean.match(/([A-Z0-9]+) reached verified target (\d+) row/i);
  if (match) return `Parsed offer ${match[1]}: ${Number(match[2]).toLocaleString()} sailing(s)`;
  match = clean.match(/([A-Z0-9]+) detail scrape summary: valid rows (\d+)(?:\/(\d+))?/i);
  if (match) return `Finished offer ${match[1]}: ${Number(match[2]).toLocaleString()} sailing(s)`;
  match = clean.match(/Staged (\d+) row\(s\) for ([A-Z0-9]+)\. Total staged rows: (\d+)/i);
  if (match) return `Saved offer ${match[2]}: ${Number(match[1]).toLocaleString()} sailing(s), ${Number(match[3]).toLocaleString()} total`;
  match = clean.match(/Returning to My Offers to reopen ([A-Z0-9]+)/i);
  if (match) return `Reopening offer ${match[1]} from My Offers`;
  match = clean.match(/Offer ([A-Z0-9]+) returned \d+(?:\/\d+)? row\(s\).*reopening the offer from My Offers/i);
  if (match) return `Retrying offer ${match[1]} from My Offers`;
  match = clean.match(/Offer ([A-Z0-9]+) still returned \d+(?:\/\d+)? row\(s\)/i);
  if (match) return `Offer ${match[1]} still has no sailings; preserving existing offers if needed`;
  match = clean.match(/\[Certificate Scrape\]\s+Summary\s+([0-9]{4}):.*?rows=(\d+).*?uniqueSailings=(\d+).*?ok=(\d+).*?noSailings=(\d+).*?empty=(\d+).*?errors=(\d+)/i);
  if (match) return `Certificate scrape ${match[1]}: ${Number(match[2]).toLocaleString()} row(s), ${Number(match[3]).toLocaleString()} unique sailing(s), ok ${match[4]}, no-sailings ${match[5]}, empty ${match[6]}, errors ${match[7]}`;
  match = clean.match(/\[Certificate Scrape\]\s+(?:Backend PDF\.js parser|Device fallback) scraping\s+([0-9]{4}[AC][A-Z0-9]+)\s+(\(\d+\/\d+\))/i);
  if (match) return `Scraping certificate ${match[1]} ${match[2]}`;
  match = clean.match(/\[Certificate Scrape\]\s+FAILED\s+([0-9]{4}):\s+(.+)/i);
  if (match) return `Certificate scrape ${match[1]} failed: ${match[2]}`;
  if (/STEP 1 FAILED SAFE/i.test(clean)) return 'Offers incomplete; existing offers preserved';
  if (/Existing Easy Seas offer database will be preserved/i.test(clean)) return 'Existing offers preserved';
  if (/Step 1 did not produce a complete authoritative/i.test(clean)) return 'Offers incomplete; existing offers preserved';
  if (/Discarding partial offer capture/i.test(clean)) return 'Partial offer scrape discarded safely';
  match = clean.match(/STEP 1 COMPLETE:.*captured (\d+) visible offer\(s\) with (\d+) individual cruise row/i);
  if (match) return `Offers complete: ${Number(match[1]).toLocaleString()} offer(s), ${Number(match[2]).toLocaleString()} sailing(s)`;
  match = clean.match(/SUMMARY: (\d+) casino offer\(s\) with (\d+) total sailing/i);
  if (match) return `Ready to review: ${Number(match[1]).toLocaleString()} offer(s), ${Number(match[2]).toLocaleString()} sailing(s)`;
  match = clean.match(/SUMMARY: (\d+) cruise\(s\).*?(\d+) upcoming, (\d+) completed/i);
  if (match) return `Ready to review: ${Number(match[2]).toLocaleString()} upcoming, ${Number(match[3]).toLocaleString()} completed/past cruise(s)`;
  match = clean.match(/Parsed (\d+) completed cruise sailing\(s\).*accepted (\d+)/i);
  if (match) return `Scraped completed cruises: ${Number(match[1]).toLocaleString()} found, ${Number(match[2]).toLocaleString()} new`;
  if (/Captured Loyalty API payload/i.test(clean) || /Captured loyalty data/i.test(clean)) return 'Reading loyalty data';
  if (/Processing captured Loyalty API payload/i.test(clean)) return 'Parsing loyalty data';
  if (/Visiting Upcoming|My Trips/i.test(clean)) return 'Opening booked cruises page';
  if (/Processing captured upcomingCruises/i.test(clean)) return 'Reading booked cruises';
  if (/Staged Royal Completed|Royal Completed/i.test(clean)) return 'Opening completed cruise history';
  if (/Please review and confirm/i.test(clean)) return 'Sync review is ready';
  if (/APPLY_SYNC_STARTED/i.test(clean)) return 'Applying selected sync data';
  if (/APPLY_SYNC_COMPLETED/i.test(clean)) return 'Sync applied successfully';
  return clean;
}

function shouldShowInUserLog(message: string, type: LogType): boolean {
  const raw = String(message || '');
  // Keep the green on-screen log readable. Full technical detail remains available in NOTES.
  if (/ACK offers_batch|React Native handoff|Captured casino offer|Sailing \d+:|Accepted full row|Final offer count|Offer discovery pass|detail scrape summary|Network monitoring active|Auth check|Navigating to: https?:|RN-orchestrated queue navigating directly|Re-arming offer worker|Easy Seas Sync Now rebuild engine|Mode: WebView-first|Opening\/fetching ship or itinerary link|Data keys:|Loyalty payload keys|Captured booking:/i.test(raw)) return false;
  return /\[Certificate Scrape\].*(Starting|scraping|Summary|FAILED)|Offer discovered|Browser fallback opening offer|Opening offer|Scraping View Sailings|STEP 1 COMPLETE|STEP 1 FAILED SAFE|Existing Easy Seas offer database|Step 1 did not produce|Discarding partial offer capture|Returning to My Offers|returned \d+(?:\/\d+)? row\(s\).*reopening|still returned \d+(?:\/\d+)? row\(s\)|Staged \d+ row\(s\) for|Visiting Upcoming|Processing captured upcomingCruises|Processing captured Loyalty API payload|Parsed \d+ completed cruise|Staged Royal Completed|Please review and confirm|APPLY_SYNC_STARTED|APPLY_SYNC_COMPLETED|SUMMARY:/i.test(raw);
}

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
    const friendly: LogEntry[] = [];
    let previous = '';
    for (const entry of this.logs) {
      if (!shouldShowInUserLog(entry.message, entry.type ?? 'info')) continue;
      const message = friendlySyncMessage(entry.message);
      if (!message || message === previous) continue;
      previous = message;
      friendly.push({ ...entry, message });
    }
    return friendly;
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
