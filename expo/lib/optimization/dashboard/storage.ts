import type { KeyValueStorage } from '../live/storage';
import type { PersonalGamblingDashboardSnapshot } from './types';
export function createPersonalDashboardRepository(storage: KeyValueStorage) {
  const key = (owner: string) => `easyseas:personal-optimizer:dashboard:${encodeURIComponent(owner.toLowerCase())}`;
  return {
    async load(ownerProfileId: string): Promise<PersonalGamblingDashboardSnapshot | null> { const raw=await storage.getItem(key(ownerProfileId)); if(!raw)return null; try{return JSON.parse(raw) as PersonalGamblingDashboardSnapshot}catch{return null} },
    async save(snapshot: PersonalGamblingDashboardSnapshot): Promise<void> { await storage.setItem(key(snapshot.ownerProfileId), JSON.stringify(snapshot)); },
    async clear(ownerProfileId: string): Promise<void> { await storage.removeItem(key(ownerProfileId)); },
  };
}
