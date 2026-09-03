import type { LiveCasinoAdvisorJournalEntry, LiveCasinoAdvisorSnapshot, LiveCasinoStateRecord } from './types';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface LiveCasinoAdvisorRepository {
  loadState(ownerProfileId: string, cruiseId: string): Promise<LiveCasinoStateRecord | null>;
  saveState(state: LiveCasinoStateRecord): Promise<void>;
  loadLatestSnapshot(ownerProfileId: string, cruiseId: string): Promise<LiveCasinoAdvisorSnapshot | null>;
  saveSnapshot(snapshot: LiveCasinoAdvisorSnapshot): Promise<void>;
  appendJournal(entry: LiveCasinoAdvisorJournalEntry): Promise<void>;
  loadJournal(ownerProfileId: string, cruiseId: string): Promise<LiveCasinoAdvisorJournalEntry[]>;
  clearCruise(ownerProfileId: string, cruiseId: string): Promise<void>;
}

function safeSegment(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase());
}

export function createLiveCasinoAdvisorRepository(storage: KeyValueStorage): LiveCasinoAdvisorRepository {
  const base = (owner: string, cruise: string) => `easyseas:personal-optimizer:live:${safeSegment(owner)}:${safeSegment(cruise)}`;
  const parse = <T>(raw: string | null): T | null => {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  };
  return {
    async loadState(owner, cruise) { return parse<LiveCasinoStateRecord>(await storage.getItem(`${base(owner, cruise)}:state`)); },
    async saveState(state) { await storage.setItem(`${base(state.ownerProfileId, state.cruiseId)}:state`, JSON.stringify(state)); },
    async loadLatestSnapshot(owner, cruise) { return parse<LiveCasinoAdvisorSnapshot>(await storage.getItem(`${base(owner, cruise)}:snapshot`)); },
    async saveSnapshot(snapshot) { await storage.setItem(`${base(snapshot.ownerProfileId, snapshot.cruiseId)}:snapshot`, JSON.stringify(snapshot)); },
    async appendJournal(entry) {
      const key = `${base(entry.ownerProfileId, entry.cruiseId)}:journal`;
      const current = parse<LiveCasinoAdvisorJournalEntry[]>(await storage.getItem(key)) ?? [];
      const deduped = current.filter(item => item.id !== entry.id);
      deduped.push(entry);
      await storage.setItem(key, JSON.stringify(deduped.slice(-250)));
    },
    async loadJournal(owner, cruise) { return parse<LiveCasinoAdvisorJournalEntry[]>(await storage.getItem(`${base(owner, cruise)}:journal`)) ?? []; },
    async clearCruise(owner, cruise) {
      await Promise.all([
        storage.removeItem(`${base(owner, cruise)}:state`),
        storage.removeItem(`${base(owner, cruise)}:snapshot`),
        storage.removeItem(`${base(owner, cruise)}:journal`),
      ]);
    },
  };
}
