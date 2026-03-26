import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SlotManufacturer, MachineVolatility, CabinetType, PersistenceType } from '@/types/models';

const MACHINE_INDEX_KEY = '@easyseas/MACHINE_INDEX_V3_262_ONLY';
const MACHINE_DETAILS_CACHE_PREFIX = '@easyseas/MACHINE_DETAIL_V3_';

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

async function getMachinesData(): Promise<any[]> {
  console.log(`[MachineIndex] Using ${_machinesData.length} machines from MACHINES_262.json`);
  return _machinesData;
}

class MachineIndexHelper {
  private static instance: MachineIndexHelper;
  private indexCache: MachineIndexEntry[] | null = null;
  private fullMachineMap: Map<string, any> = new Map();
  private mapInitialized = false;

  private constructor() {}

  static getInstance(): MachineIndexHelper {
    if (!MachineIndexHelper.instance) {
      MachineIndexHelper.instance = new MachineIndexHelper();
    }
    return MachineIndexHelper.instance;
  }

  private async ensureMapInitialized(): Promise<void> {
    if (this.mapInitialized) return;
    console.log('[MachineIndex] Building machine lookup map from MACHINES_262 only...');
    const allMachines = await getMachinesData();
    for (const machine of allMachines) {
      const id = machine.id || `custom-${machine.name}-${machine.manufacturer}`;
      this.fullMachineMap.set(id, machine);
    }
    this.mapInitialized = true;
    console.log(`[MachineIndex] Lookup map built with ${this.fullMachineMap.size} machines`);
  }

  async getOrCreateIndex(): Promise<MachineIndexEntry[]> {
    if (this.indexCache) {
      return this.indexCache;
    }

    try {
      const stored = await AsyncStorage.getItem(MACHINE_INDEX_KEY);
      
      if (stored) {
        console.log('[MachineIndex] Loading index from storage...');
        this.indexCache = JSON.parse(stored);
        console.log(`[MachineIndex] Loaded ${this.indexCache?.length} machines from index`);
        return this.indexCache || [];
      }

      console.log('[MachineIndex] Building new index...');
      const index = await this.buildIndex();
      await this.saveIndex(index);
      this.indexCache = index;
      
      return index;
    } catch (error) {
      console.error('[MachineIndex] Error loading/building index:', error);
      return [];
    }
  }

  private async buildIndex(): Promise<MachineIndexEntry[]> {
    const allMachines = await getMachinesData();
    console.log(`[MachineIndex] Building index from ${allMachines.length} machines (MACHINES_262 only)...`);

    const index: MachineIndexEntry[] = [];

    for (const machine of allMachines) {
      try {
        const entry: MachineIndexEntry = {
          id: machine.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      await AsyncStorage.setItem(MACHINE_INDEX_KEY, JSON.stringify(index));
      console.log(`[MachineIndex] Saved index with ${index.length} entries`);
    } catch (error) {
      console.error('[MachineIndex] Error saving index:', error);
    }
  }

  async getMachineDetails(id: string): Promise<MachineFullDetails | null> {
    try {
      const cacheKey = `${MACHINE_DETAILS_CACHE_PREFIX}${id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
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
        id: fullMachine.id || id,
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
        denominationFamilies: fullMachine.denominationFamilies || [],
        denominations: fullMachine.denominations || [],
        description: fullMachine.description,
        simpleSummary: fullMachine.simpleSummary,
        simple_summary: fullMachine.simpleSummary,
        summary: fullMachine.summary,
        ship_notes: fullMachine.shipNotes,
        shipNotes: fullMachine.shipNotes,
        ap_triggers: fullMachine.apTriggers,
        apTriggers: fullMachine.apTriggers,
        walk_away: fullMachine.walkAway,
        walkAway: fullMachine.walkAway,
        core_mechanics: fullMachine.coreMechanics,
        coreMechanics: fullMachine.coreMechanics,
        jackpot_reset: fullMachine.jackpotReset,
        jackpotReset: fullMachine.jackpotReset,
        source: fullMachine.source,
        source_verbatim: fullMachine.source_verbatim,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(details));
      
      return details;
    } catch (error) {
      console.error('[MachineIndex] Error getting machine details:', error);
      return null;
    }
  }

  async clearIndex(): Promise<void> {
    this.indexCache = null;
    await AsyncStorage.removeItem(MACHINE_INDEX_KEY);
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
