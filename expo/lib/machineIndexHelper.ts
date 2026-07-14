import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SlotManufacturer, MachineVolatility, CabinetType, PersistenceType } from '@/types/models';
import { isCloudBackupEnabled, trpcClient } from '@/lib/trpc';
import { quotaSafeGetItem, quotaSafeSetJsonItem, quotaSafeRemoveItem } from '@/lib/storage/quotaSafeStorage';

const MACHINE_INDEX_KEY = '@easyseas/MACHINE_INDEX_V3_262_ONLY';
const MACHINE_DETAILS_CACHE_PREFIX = '@easyseas/MACHINE_DETAIL_V3_';
const SHARED_MACHINE_LIBRARY_CACHE_KEY = '@easyseas/SHARED_MACHINE_LIBRARY_CACHE_V1';

export interface MachineIndexEntry {
  id: string;
  name: string;
  manufacturer: SlotManufacturer;
  volatility: MachineVolatility;
  cabinetType: CabinetType;
  releaseYear: number;
  gameSeries?: string;
  theme?: string;
  persistenceType?: PersistenceType;
  hasMHB?: boolean;
}

export interface MachineFullDetails extends MachineIndexEntry {
  rtpRange?: string;
  basePay?: string;
  bonusMechanic?: string;
  jackpotTypes?: string[];
  denominationFamilies?: string[];
  denominations?: string[];
  description?: string;
  simpleSummary?: string;
  simple_summary?: string;
  summary?: string;
  ship_notes?: string;
  shipNotes?: string;
  ap_triggers?: string[];
  apTriggers?: string[];
  walk_away?: string[];
  walkAway?: string[];
  core_mechanics?: string;
  coreMechanics?: string;
  jackpot_reset?: Record<string, any>;
  jackpotReset?: Record<string, any>;
  source?: string;
  source_verbatim?: string[];
  [key: string]: any;
}

import MACHINES_262_RAW from '@/assets/MACHINES_262.json';

const _machinesData: any[] = (MACHINES_262_RAW as any[]) ?? [];

function getMachineIdentity(machine: any): string | null {
  const header = machine?.header ?? {};
  const id = machine?.globalMachineId ?? machine?.machineId ?? machine?.id;
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();

  const machineName = machine?.machineName ?? machine?.name ?? header?.machineName;
  const manufacturer = machine?.manufacturer ?? header?.manufacturer ?? 'Other';
  if (typeof machineName !== 'string' || machineName.trim().length === 0) return null;

  return `${manufacturer}-${machineName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mergeMachineData(baseMachines: any[], sharedMachines: any[]): any[] {
  const merged = new Map<string, any>();

  baseMachines.forEach((machine) => {
    const key = getMachineIdentity(machine);
    if (key) merged.set(key, machine);
  });

  sharedMachines.forEach((machine) => {
    const key = getMachineIdentity(machine);
    if (!key) return;
    const existing = merged.get(key) ?? {};
    merged.set(key, { ...existing, ...machine });
  });

  return Array.from(merged.values());
}

async function loadCachedSharedMachines(): Promise<any[]> {
  try {
    const cached = await quotaSafeGetItem(SHARED_MACHINE_LIBRARY_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[MachineIndex] Failed to load shared machine cache:', error);
    return [];
  }
}

async function fetchSharedMachines(): Promise<any[]> {
  if (!isCloudBackupEnabled()) {
    return loadCachedSharedMachines();
  }

  try {
    const result = await trpcClient.machineLibrary.getAll.query();
    const machines = Array.isArray(result.machines) ? result.machines : [];
    await quotaSafeSetJsonItem(SHARED_MACHINE_LIBRARY_CACHE_KEY, machines);
    console.log(`[MachineIndex] Loaded ${machines.length} shared machines from cloud library`);
    return machines;
  } catch (error) {
    console.log('[MachineIndex] Shared machine library unavailable, using cached/bundled machines only:', error instanceof Error ? error.message : String(error));
    return loadCachedSharedMachines();
  }
}

async function getMachinesData(): Promise<any[]> {
  const sharedMachines = await fetchSharedMachines();
  const mergedMachines = mergeMachineData(_machinesData, sharedMachines);
  console.log(`[MachineIndex] Using ${mergedMachines.length} machines (${_machinesData.length} bundled + ${sharedMachines.length} shared)`);
  return mergedMachines;
}

class MachineIndexHelper {
  private static instance: MachineIndexHelper;
  private indexCache: MachineIndexEntry[] | null = null;
  private fullMachineMap: Map<string, any> = new Map();
  private mapInitialized = false;
  private lastSharedSyncAt = 0;

  private constructor() {}

  static getInstance(): MachineIndexHelper {
    if (!MachineIndexHelper.instance) {
      MachineIndexHelper.instance = new MachineIndexHelper();
    }
    return MachineIndexHelper.instance;
  }

  private async ensureMapInitialized(): Promise<void> {
    if (this.mapInitialized) return;
    console.log('[MachineIndex] Building machine lookup map...');
    const allMachines = await getMachinesData();
    for (const machine of allMachines) {
      const id = machine.globalMachineId || machine.id || `custom-${machine.name || machine.machineName}-${machine.manufacturer}`;
      this.fullMachineMap.set(id, machine);
    }
    this.mapInitialized = true;
    console.log(`[MachineIndex] Lookup map built with ${this.fullMachineMap.size} machines`);
  }

  async getOrCreateIndex(): Promise<MachineIndexEntry[]> {
    const shouldRefreshShared = Date.now() - this.lastSharedSyncAt > 5 * 60 * 1000;
    if (this.indexCache && !shouldRefreshShared) {
      return this.indexCache;
    }

    try {
      if (!shouldRefreshShared) {
        const stored = await quotaSafeGetItem(MACHINE_INDEX_KEY);
        
        if (stored) {
          console.log('[MachineIndex] Loading index from storage...');
          this.indexCache = JSON.parse(stored);
          console.log(`[MachineIndex] Loaded ${this.indexCache?.length} machines from index`);
          return this.indexCache || [];
        }
      }

      console.log('[MachineIndex] Building new index...');
      const index = await this.buildIndex();
      await this.saveIndex(index);
      this.indexCache = index;
      this.fullMachineMap.clear();
      this.mapInitialized = false;
      this.lastSharedSyncAt = Date.now();
      
      return index;
    } catch (error) {
      console.error('[MachineIndex] Error loading/building index:', error);
      return this.indexCache ?? [];
    }
  }

  private async buildIndex(): Promise<MachineIndexEntry[]> {
    const allMachines = await getMachinesData();
    console.log(`[MachineIndex] Building index from ${allMachines.length} machines...`);

    const index: MachineIndexEntry[] = [];

    for (const machine of allMachines) {
      try {
        const entry: MachineIndexEntry = {
          id: machine.globalMachineId || machine.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: machine.name || machine.machineName || 'Unknown Machine',
          manufacturer: machine.manufacturer || 'Other',
          volatility: machine.volatility || 'Medium',
          cabinetType: machine.cabinet_type || machine.cabinetType || 'Standard Upright',
          releaseYear: machine.release_year || machine.releaseYear || new Date().getFullYear(),
          gameSeries: machine.game_series || machine.gameSeries,
          theme: machine.theme,
          persistenceType: machine.persistenceType || machine.persistence_type || 'True',
          hasMHB: machine.hasMHB || machine.has_mhb || false,
        };

        index.push(entry);
      } catch (error) {
        console.error('[MachineIndex] Error indexing machine:', machine, error);
      }
    }

    console.log(`[MachineIndex] Index built with ${index.length} entries`);
    return index;
  }

  private async saveIndex(index: MachineIndexEntry[]): Promise<void> {
    try {
      await quotaSafeSetJsonItem(MACHINE_INDEX_KEY, index);
      console.log(`[MachineIndex] Saved index with ${index.length} entries`);
    } catch (error) {
      console.error('[MachineIndex] Error saving index:', error);
    }
  }

  async getMachineDetails(id: string): Promise<MachineFullDetails | null> {
    try {
      const cacheKey = `${MACHINE_DETAILS_CACHE_PREFIX}${id}`;
      const cached = await quotaSafeGetItem(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      await this.ensureMapInitialized();
      const fullMachine = this.fullMachineMap.get(id);
      
      if (!fullMachine) {
        console.warn(`[MachineIndex] Machine not found: ${id}`);
        return null;
      }

      const details: MachineFullDetails = {
        id: fullMachine.globalMachineId || fullMachine.id || id,
        name: fullMachine.name || fullMachine.machineName || 'Unknown Machine',
        manufacturer: fullMachine.manufacturer || 'Other',
        volatility: fullMachine.volatility || 'Medium',
        cabinetType: fullMachine.cabinet_type || fullMachine.cabinetType || 'Standard Upright',
        releaseYear: fullMachine.release_year || fullMachine.releaseYear || new Date().getFullYear(),
        gameSeries: fullMachine.game_series || fullMachine.gameSeries,
        theme: fullMachine.theme,
        persistenceType: fullMachine.persistenceType || fullMachine.persistence_type || 'True',
        hasMHB: fullMachine.hasMHB || fullMachine.has_mhb || false,
        rtpRange: fullMachine.rtp_range || fullMachine.rtpRange,
        basePay: fullMachine.base_pay || fullMachine.basePay,
        bonusMechanic: fullMachine.core_mechanics || fullMachine.bonusMechanic,
        jackpotTypes: fullMachine.jackpot_reset 
          ? Object.keys(fullMachine.jackpot_reset) 
          : (fullMachine.jackpotTypes || []),
        denominationFamilies: fullMachine.denominationFamilies || fullMachine.denominations || [],
        denominations: fullMachine.denominations || fullMachine.denominationFamilies || [],
        description: fullMachine.description,
        simpleSummary: fullMachine.simpleSummary || fullMachine.simple_summary,
        simple_summary: fullMachine.simple_summary || fullMachine.simpleSummary,
        summary: fullMachine.summary,
        ship_notes: fullMachine.shipNotes || fullMachine.ship_notes,
        shipNotes: fullMachine.shipNotes || fullMachine.ship_notes,
        ap_triggers: fullMachine.apTriggers || fullMachine.ap_triggers,
        apTriggers: fullMachine.apTriggers || fullMachine.ap_triggers,
        walk_away: fullMachine.walkAway || fullMachine.walk_away,
        walkAway: fullMachine.walkAway || fullMachine.walk_away,
        core_mechanics: fullMachine.coreMechanics || fullMachine.core_mechanics,
        coreMechanics: fullMachine.coreMechanics || fullMachine.core_mechanics,
        jackpot_reset: fullMachine.jackpotReset || fullMachine.jackpot_reset,
        jackpotReset: fullMachine.jackpotReset || fullMachine.jackpot_reset,
        source: fullMachine.source,
        source_verbatim: fullMachine.source_verbatim,
      };

      await quotaSafeSetJsonItem(cacheKey, details);
      
      return details;
    } catch (error) {
      console.error('[MachineIndex] Error getting machine details:', error);
      return null;
    }
  }

  async clearIndex(): Promise<void> {
    this.indexCache = null;
    this.fullMachineMap.clear();
    this.mapInitialized = false;
    this.lastSharedSyncAt = 0;
    await quotaSafeRemoveItem(MACHINE_INDEX_KEY);
    console.log('[MachineIndex] Index cleared');
  }

  async clearDetailsCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const detailKeys = keys.filter(key => key.startsWith(MACHINE_DETAILS_CACHE_PREFIX));
    
    if (detailKeys.length > 0) {
      await AsyncStorage.multiRemove(detailKeys);
      console.log(`[MachineIndex] Cleared ${detailKeys.length} cached details`);
    }
  }

  getIndexSize(): number {
    return this.indexCache?.length || 0;
  }

  isIndexLoaded(): boolean {
    return this.indexCache !== null;
  }
}

export const machineIndexHelper = MachineIndexHelper.getInstance();
