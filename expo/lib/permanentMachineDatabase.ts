import AsyncStorage from '@react-native-async-storage/async-storage';
import { type GlobalSlotMachine, GLOBAL_SLOT_MACHINES_2020_2025 } from '@/constants/globalSlotMachinesDatabase';

const PERMANENT_DB_KEY = '@easyseas/PERMANENT_GLOBAL_MACHINE_DATABASE';
const DB_VERSION_KEY = '@easyseas/PERMANENT_DB_VERSION';
const CURRENT_DB_VERSION = 1;

export interface PermanentMachineRecord extends GlobalSlotMachine {
  permanentId: string;
  addedToDatabaseAt: string;
  lastUpdatedAt: string;
  sources: ('hardcoded' | 'import' | 'manual' | 'wizard')[];
  userAddedData?: {
    customNotes?: string;
    userRating?: number;
  };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
}

function generatePermanentId(machine: GlobalSlotMachine): string {
  const normalized = normalizeName(machine.name);
  const mfr = machine.manufacturer.toLowerCase().replace(/\s+/g, '-');
  return `${mfr}-${normalized.replace(/\s+/g, '-')}-${machine.releaseYear}`;
}

function machineMatchesRecord(
  machine: GlobalSlotMachine,
  record: PermanentMachineRecord
): boolean {
  const normalizedMachineName = normalizeName(machine.name);
  const normalizedRecordName = normalizeName(record.name);

  if (normalizedMachineName === normalizedRecordName && machine.manufacturer === record.manufacturer) {
    return true;
  }

  if (
    machine.gameSeries &&
    record.gameSeries &&
    machine.gameSeries === record.gameSeries &&
    machine.manufacturer === record.manufacturer &&
    Math.abs(machine.releaseYear - record.releaseYear) <= 1
  ) {
    return true;
  }

  return false;
}

export class PermanentMachineDatabase {
  private static instance: PermanentMachineDatabase;
  private database: Map<string, PermanentMachineRecord> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PermanentMachineDatabase {
    if (!PermanentMachineDatabase.instance) {
      PermanentMachineDatabase.instance = new PermanentMachineDatabase();
    }
    return PermanentMachineDatabase.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[PermanentDB] Already initialized');
      return;
    }

    try {
      console.log('[PermanentDB] Initializing permanent machine database...');

      const [storedData, storedVersion] = await Promise.all([
        AsyncStorage.getItem(PERMANENT_DB_KEY),
        AsyncStorage.getItem(DB_VERSION_KEY),
      ]);

      const version = storedVersion ? parseInt(storedVersion, 10) : 0;

      if (storedData && version === CURRENT_DB_VERSION) {
        const records: PermanentMachineRecord[] = JSON.parse(storedData);
        console.log(`[PermanentDB] Loaded ${records.length} existing records from storage`);

        records.forEach(record => {
          this.database.set(record.permanentId, record);
        });
      } else {
        console.log('[PermanentDB] No existing database or version mismatch, starting fresh');
      }

      console.log(`[PermanentDB] Merging ${GLOBAL_SLOT_MACHINES_2020_2025.length} hardcoded machines...`);
      const addedCount = await this.addMachinesFromHardcoded(GLOBAL_SLOT_MACHINES_2020_2025);
      console.log(`[PermanentDB] Added ${addedCount} new machines from hardcoded list`);

      await this.persist();
      this.isInitialized = true;

      console.log(`[PermanentDB] ✓ Initialization complete. Total machines: ${this.database.size}`);
    } catch (error) {
      console.error('[PermanentDB] Error initializing:', error);
      throw error;
    }
  }

  private async addMachinesFromHardcoded(machines: GlobalSlotMachine[]): Promise<number> {
    let addedCount = 0;

    for (const machine of machines) {
      const added = await this.addOrUpdateMachine(machine, 'hardcoded');
      if (added) addedCount++;
    }

    return addedCount;
  }

  async addOrUpdateMachine(
    machine: GlobalSlotMachine,
    source: 'hardcoded' | 'import' | 'manual' | 'wizard'
  ): Promise<boolean> {
    const existingRecord = this.findExistingRecord(machine);

    if (existingRecord) {
      if (!existingRecord.sources.includes(source)) {
        existingRecord.sources.push(source);
        existingRecord.lastUpdatedAt = new Date().toISOString();

        if (machine.description && !existingRecord.description) {
          existingRecord.description = machine.description;
        }
        if (machine.rtpRange && !existingRecord.rtpRange) {
          existingRecord.rtpRange = machine.rtpRange;
        }
        if (machine.bonusMechanic && !existingRecord.bonusMechanic) {
          existingRecord.bonusMechanic = machine.bonusMechanic;
        }

        this.database.set(existingRecord.permanentId, existingRecord);
        console.log(`[PermanentDB] Updated existing record: ${existingRecord.name} (${source})`);
      }
      return false;
    }

    const now = new Date().toISOString();
    const permanentId = generatePermanentId(machine);

    const newRecord: PermanentMachineRecord = {
      ...machine,
      permanentId,
      addedToDatabaseAt: now,
      lastUpdatedAt: now,
      sources: [source],
    };

    this.database.set(permanentId, newRecord);
    console.log(`[PermanentDB] Added new machine: ${machine.name} (${source})`);
    return true;
  }

  private findExistingRecord(machine: GlobalSlotMachine): PermanentMachineRecord | undefined {
    if (machine.id) {
      const recordById = Array.from(this.database.values()).find(r => r.id === machine.id);
      if (recordById) return recordById;
    }

    return Array.from(this.database.values()).find(record =>
      machineMatchesRecord(machine, record)
    );
  }

  async addMachinesFromImport(machines: GlobalSlotMachine[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const machine of machines) {
      const isNew = await this.addOrUpdateMachine(machine, 'import');
      if (isNew) {
        added++;
      } else {
        updated++;
      }
    }

    await this.persist();
    console.log(`[PermanentDB] Import complete: ${added} new, ${updated} updated`);
    return { added, updated };
  }

  getAllMachines(): GlobalSlotMachine[] {
    return Array.from(this.database.values()).map(record => ({
      id: record.id,
      name: record.name,
      manufacturer: record.manufacturer,
      gameSeries: record.gameSeries,
      volatility: record.volatility,
      cabinetType: record.cabinetType,
      releaseYear: record.releaseYear,
      rtpRange: record.rtpRange,
      basePay: record.basePay,
      bonusMechanic: record.bonusMechanic,
      jackpotTypes: record.jackpotTypes,
      denominationFamilies: record.denominationFamilies,
      persistenceType: record.persistenceType,
      hasMHB: record.hasMHB,
      theme: record.theme,
      description: record.description,
    }));
  }

  getPermanentRecord(idOrName: string): PermanentMachineRecord | undefined {
    const byId = this.database.get(idOrName);
    if (byId) return byId;

    return Array.from(this.database.values()).find(
      record => normalizeName(record.name) === normalizeName(idOrName)
    );
  }

  getStats(): { total: number; hardcoded: number; imported: number; manual: number; wizard: number } {
    const records = Array.from(this.database.values());
    return {
      total: records.length,
      hardcoded: records.filter(r => r.sources.includes('hardcoded')).length,
      imported: records.filter(r => r.sources.includes('import')).length,
      manual: records.filter(r => r.sources.includes('manual')).length,
      wizard: records.filter(r => r.sources.includes('wizard')).length,
    };
  }

  async persist(): Promise<void> {
    try {
      const records = Array.from(this.database.values());
      await Promise.all([
        AsyncStorage.setItem(PERMANENT_DB_KEY, JSON.stringify(records)),
        AsyncStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION.toString()),
      ]);
      console.log(`[PermanentDB] ✓ Persisted ${records.length} records`);
    } catch (error) {
      console.error('[PermanentDB] Error persisting:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.database.clear();
    await AsyncStorage.multiRemove([PERMANENT_DB_KEY, DB_VERSION_KEY]);
    console.log('[PermanentDB] Cleared database');
  }

  async export(): Promise<string> {
    const records = Array.from(this.database.values());
    return JSON.stringify(records, null, 2);
  }

  async importFromJSON(jsonString: string): Promise<{ added: number; updated: number; errors: string[] }> {
    try {
      const imported = JSON.parse(jsonString);
      const errors: string[] = [];
      let added = 0;
      let updated = 0;

      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: Expected an array of machines');
      }

      for (const item of imported) {
        try {
          const machine: GlobalSlotMachine = {
            id: item.id || item.permanentId || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name || item.machineName || 'Unknown Machine',
            manufacturer: item.manufacturer || 'Other',
            volatility: item.volatility || 'Medium',
            cabinetType: item.cabinetType || item.cabinet_type || 'Standard Upright',
            releaseYear: item.releaseYear || item.release_year || new Date().getFullYear(),
            gameSeries: item.gameSeries || item.game_series,
            theme: item.theme,
            description: item.description || item.simple_summary,
            rtpRange: item.rtpRange || item.rtp_range,
            basePay: item.basePay || item.base_pay,
            bonusMechanic: item.bonusMechanic || item.bonus_mechanic || item.core_mechanics,
            jackpotTypes: item.jackpotTypes || item.jackpot_types || (item.jackpot_reset ? Object.keys(item.jackpot_reset) : []),
            denominationFamilies: item.denominationFamilies || item.denominations || [],
            persistenceType: item.persistenceType || item.persistence_type,
            hasMHB: item.hasMHB || item.has_mhb || false,
          };

          const isNew = await this.addOrUpdateMachine(machine, 'import');
          if (isNew) {
            added++;
          } else {
            updated++;
          }
        } catch (itemError) {
          errors.push(`Failed to import machine: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        }
      }

      await this.persist();
      console.log(`[PermanentDB] Import from JSON complete: ${added} new, ${updated} updated, ${errors.length} errors`);

      return { added, updated, errors };
    } catch (error) {
      console.error('[PermanentDB] Import error:', error);
      throw error;
    }
  }
}

export const permanentDB = PermanentMachineDatabase.getInstance();

export async function addCelestialFortune(): Promise<void> {
  const celestialFortune: GlobalSlotMachine = {
    id: 'ags-celestial-fortune-2024',
    name: 'Celestial Fortune',
    manufacturer: 'AGS',
    gameSeries: 'Pillars of Cash',
    volatility: 'Medium-High',
    cabinetType: 'Video',
    releaseYear: 2024,
    rtpRange: '92-96%',
    basePay: 'Standard',
    bonusMechanic: 'Free Spins, Pillars of Cash Mechanic with Progressive Jackpots',
    jackpotTypes: ['Progressive', 'Grand', 'Major', 'Minor', 'Mini', 'Bonus'],
    denominationFamilies: ['Penny', 'Nickel', 'Quarter', 'Dollar'],
    persistenceType: 'Pseudo',
    hasMHB: true,
    theme: 'Asian/Dragon/Celestial',
    description: 'Part of the Pillars of Cash game family featuring cosmic dragons. Includes two progressive jackpots and five static bonus prizes. Features Free Spin Bonus triggered by 3+ Yin Yang symbols (up to 25 free spins), and Pillars of Cash mechanic with five boxes above reels that grow with credit prizes. Dragons change from red to gold when top awards are achieved.',
  };

  console.log('[PermanentDB] Adding Celestial Fortune...');
  await permanentDB.addOrUpdateMachine(celestialFortune, 'manual');
  await permanentDB.persist();
  console.log('[PermanentDB] ✓ Celestial Fortune added successfully');
}

export async function addQuantumMachines(): Promise<{ added: number; updated: number }> {
  const { QUANTUM_OF_THE_SEAS_MACHINES } = require('@/constants/quantumMachines');
  console.log(`[PermanentDB] Adding ${QUANTUM_OF_THE_SEAS_MACHINES.length} Quantum of the Seas machines...`);
  
  let added = 0;
  let updated = 0;

  for (const machine of QUANTUM_OF_THE_SEAS_MACHINES) {
    const isNew = await permanentDB.addOrUpdateMachine(machine, 'hardcoded');
    if (isNew) {
      added++;
    } else {
      updated++;
    }
  }

  await permanentDB.persist();
  console.log(`[PermanentDB] ✓ Quantum machines added: ${added} new, ${updated} updated`);
  
  return { added, updated };
}
