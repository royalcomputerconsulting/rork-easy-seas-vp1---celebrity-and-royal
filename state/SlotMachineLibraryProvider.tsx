import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { 
  MachineEncyclopediaEntry, 
  AddGameWizardData,
  SlotManufacturer,
  MachineVolatility,
  CabinetType,
  PersistenceType
} from '@/types/models';
import { GlobalSlotMachine } from '@/constants/globalSlotMachinesDatabase';
import { permanentDB } from '@/lib/permanentMachineDatabase';
import { machineIndexHelper, type MachineFullDetails } from '@/lib/machineIndexHelper';
import { useEntitlement } from '@/state/EntitlementProvider';

const STORAGE_KEY_ENCYCLOPEDIA = 'easyseas_machine_encyclopedia_v2_262_only';
const STORAGE_KEY_MY_ATLAS = 'easyseas_my_slot_atlas_v2_262_only';
const STORAGE_KEY_INDEX_LOADED = 'easyseas_machine_index_loaded_v2_262_only';

const FREE_USER_MACHINE_LIMIT = 4;

function convertGlobalToEncyclopedia(global: GlobalSlotMachine, addedToAtlas: boolean = false): MachineEncyclopediaEntry {
  return {
    id: global.id,
    globalMachineId: global.id,
    machineName: global.name,
    manufacturer: global.manufacturer,
    gameSeries: global.gameSeries,
    volatility: global.volatility,
    cabinetType: global.cabinetType,
    releaseYear: global.releaseYear,
    rtpRanges: global.rtpRange ? parseRTPRange(global.rtpRange) : undefined,
    theme: global.theme,
    description: global.description,
    basePaytable: global.basePay,
    bonusMechanics: global.bonusMechanic,
    jackpotTypes: global.jackpotTypes,
    denominationFamilies: global.denominationFamilies,
    apMetadata: global.persistenceType || global.hasMHB ? {
      persistenceType: global.persistenceType || 'None',
      hasMustHitBy: global.hasMHB || false,
    } : undefined,
    source: 'global',
    isInMyAtlas: addedToAtlas,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseRTPRange(rtpRange: string): { min: number; max: number } | undefined {
  const match = rtpRange.match(/(\d+)-(\d+)%/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  return undefined;
}

export const [SlotMachineLibraryProvider, useSlotMachineLibrary] = createContextHook(() => {
  const { isPro } = useEntitlement();
  const [encyclopedia, setEncyclopedia] = useState<MachineEncyclopediaEntry[]>([]);
  const [myAtlasIds, setMyAtlasIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingIndex] = useState<boolean>(false);
  const [indexLoadComplete, setIndexLoadComplete] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterManufacturers, setFilterManufacturers] = useState<SlotManufacturer[]>([]);
  const [filterVolatility, setFilterVolatility] = useState<MachineVolatility[]>([]);
  const [filterCabinet, setFilterCabinet] = useState<CabinetType[]>([]);
  const [filterPersistence, setFilterPersistence] = useState<PersistenceType[]>([]);
  const [filterHasMHB, setFilterHasMHB] = useState<boolean | undefined>(undefined);
  const [filterYearRange, setFilterYearRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [filterOnlyMyAtlas, setFilterOnlyMyAtlas] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'name' | 'manufacturer' | 'year' | 'volatility'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [wizardData, setWizardData] = useState<AddGameWizardData>({ step: 1 });
  const [isUserWhitelisted, setIsUserWhitelisted] = useState<boolean>(false);

  const loadMachinesFromIndex = useCallback(async (
    currentEncyclopedia: MachineEncyclopediaEntry[],
    currentAtlasIds: string[]
  ): Promise<{ success: boolean; count: number; encyclopedia: MachineEncyclopediaEntry[]; atlasIds: string[]; error?: string }> => {
    try {
      console.log('[SlotMachineLibrary] Loading machines from index (lightweight mode)...');

      const machineIndex = await machineIndexHelper.getOrCreateIndex();
      console.log(`[SlotMachineLibrary] Loaded ${machineIndex.length} machines from index`);

      const newEntries: MachineEncyclopediaEntry[] = [];

      for (const indexEntry of machineIndex) {
        const existingEntry = currentEncyclopedia.find(
          e => e.globalMachineId === indexEntry.id ||
               (e.machineName.toLowerCase() === indexEntry.name.toLowerCase() &&
                e.manufacturer === indexEntry.manufacturer)
        );

        if (!existingEntry) {
          const newEntry: MachineEncyclopediaEntry = {
            id: `m262-${indexEntry.id}`,
            globalMachineId: indexEntry.id,
            machineName: indexEntry.name,
            manufacturer: indexEntry.manufacturer,
            volatility: indexEntry.volatility,
            cabinetType: indexEntry.cabinetType,
            releaseYear: indexEntry.releaseYear,
            gameSeries: indexEntry.gameSeries,
            theme: indexEntry.theme,
            apMetadata: {
              persistenceType: indexEntry.persistenceType || 'True',
              hasMustHitBy: indexEntry.hasMHB || false,
            },
            source: 'global',
            isInMyAtlas: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          newEntries.push(newEntry);
        }
      }

      console.log('[SlotMachineLibrary] Created', newEntries.length, 'new entries from index');

      const updatedEncyclopedia = [...currentEncyclopedia, ...newEntries];
      await AsyncStorage.setItem(STORAGE_KEY_ENCYCLOPEDIA, JSON.stringify(updatedEncyclopedia));

      return {
        success: true,
        count: newEntries.length,
        encyclopedia: updatedEncyclopedia,
        atlasIds: currentAtlasIds,
      };
    } catch (error) {
      console.error('[SlotMachineLibrary] Load from index error:', error);
      return {
        success: false,
        count: 0,
        encyclopedia: currentEncyclopedia,
        atlasIds: currentAtlasIds,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const ensureEncyclopediaFullyLoadedForPro = useCallback(async (
    currentEncyclopedia: MachineEncyclopediaEntry[],
    currentAtlasIds: string[]
  ): Promise<{ didChange: boolean; encyclopedia: MachineEncyclopediaEntry[] }> => {
    try {
      console.log('[SlotMachineLibrary] ensureEncyclopediaFullyLoadedForPro called', {
        currentCount: currentEncyclopedia.length,
        currentAtlasIds: currentAtlasIds.length,
      });

      const machineIndex = await machineIndexHelper.getOrCreateIndex();
      const indexCount = machineIndex.length;

      const existingGlobalIds = new Set<string>(currentEncyclopedia.map(e => e.globalMachineId ?? e.id));
      const newEntries: MachineEncyclopediaEntry[] = [];

      for (const indexEntry of machineIndex) {
        if (existingGlobalIds.has(indexEntry.id)) continue;

        newEntries.push({
          id: `m262-${indexEntry.id}`,
          globalMachineId: indexEntry.id,
          machineName: indexEntry.name,
          manufacturer: indexEntry.manufacturer,
          volatility: indexEntry.volatility,
          cabinetType: indexEntry.cabinetType,
          releaseYear: indexEntry.releaseYear,
          gameSeries: indexEntry.gameSeries,
          theme: indexEntry.theme,
          apMetadata: {
            persistenceType: indexEntry.persistenceType || 'True',
            hasMustHitBy: indexEntry.hasMHB || false,
          },
          source: 'global',
          isInMyAtlas: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (newEntries.length === 0) {
        console.log('[SlotMachineLibrary] ensureEncyclopediaFullyLoadedForPro: nothing to add', {
          currentCount: currentEncyclopedia.length,
          indexCount,
        });
        return { didChange: false, encyclopedia: currentEncyclopedia };
      }

      const updated = [...currentEncyclopedia, ...newEntries];
      await AsyncStorage.setItem(STORAGE_KEY_ENCYCLOPEDIA, JSON.stringify(updated));
      await AsyncStorage.setItem(STORAGE_KEY_INDEX_LOADED, 'true');

      console.log('[SlotMachineLibrary] ensureEncyclopediaFullyLoadedForPro: added entries', {
        added: newEntries.length,
        after: updated.length,
        indexCount,
      });

      return { didChange: true, encyclopedia: updated };
    } catch (e) {
      console.error('[SlotMachineLibrary] ensureEncyclopediaFullyLoadedForPro failed', e);
      return { didChange: false, encyclopedia: currentEncyclopedia };
    }
  }, []);

  const initializeAndLoadData = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[SlotMachineLibrary] Loading data from MACHINES_262.json only...');

      console.log('[SlotMachineLibrary] Loading user data from storage...');

      const [encyclopediaStr, atlasStr, indexLoaded] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_ENCYCLOPEDIA),
        AsyncStorage.getItem(STORAGE_KEY_MY_ATLAS),
        AsyncStorage.getItem(STORAGE_KEY_INDEX_LOADED),
      ]);

      const loadedEncyclopedia: MachineEncyclopediaEntry[] = encyclopediaStr ? JSON.parse(encyclopediaStr) : [];
      const loadedAtlasIds: string[] = atlasStr ? JSON.parse(atlasStr) : [];

      console.log(`[SlotMachineLibrary] Loaded ${loadedEncyclopedia.length} encyclopedia entries`);
      console.log(`[SlotMachineLibrary] Loaded ${loadedAtlasIds.length} atlas entries`);
      console.log(`[SlotMachineLibrary] Index loaded flag:`, indexLoaded);

      if (loadedEncyclopedia.length === 0 && !indexLoaded) {
        console.log('[SlotMachineLibrary] First startup detected - loading from index...');
        
        const importResult = await loadMachinesFromIndex(loadedEncyclopedia, loadedAtlasIds);
        
        if (importResult.success) {
          console.log(`[SlotMachineLibrary] ✓ Successfully loaded ${importResult.count} machines from index`);
          setEncyclopedia(importResult.encyclopedia);
          setMyAtlasIds(importResult.atlasIds);
          setIndexLoadComplete(true);
          await AsyncStorage.setItem(STORAGE_KEY_INDEX_LOADED, 'true');
        } else {
          console.error('[SlotMachineLibrary] Failed to load machines:', importResult.error);
          setEncyclopedia([]);
          setMyAtlasIds([]);
        }
      } else {
        console.log('[SlotMachineLibrary] Loading existing data from storage');
        setEncyclopedia(loadedEncyclopedia);
        setMyAtlasIds(loadedAtlasIds);
        setIndexLoadComplete(indexLoaded === 'true');
      }
    } catch (error) {
      console.error('[SlotMachineLibrary] Error loading data:', error);
      setEncyclopedia([]);
      setMyAtlasIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadMachinesFromIndex]);

  useEffect(() => {
    initializeAndLoadData();
  }, [initializeAndLoadData]);

  useEffect(() => {
    if (!hasFullAccess) return;
    if (isLoading) return;

    console.log('[SlotMachineLibrary] Pro access detected - ensuring full encyclopedia is loaded', {
      encyclopediaCount: encyclopedia.length,
      myAtlasIds: myAtlasIds.length,
      indexLoadComplete,
    });

    ensureEncyclopediaFullyLoadedForPro(encyclopedia, myAtlasIds)
      .then((result) => {
        if (!result.didChange) return;
        setEncyclopedia(result.encyclopedia);
      })
      .catch((e) => console.error('[SlotMachineLibrary] ensureEncyclopediaFullyLoadedForPro unhandled error', e));
  }, [ensureEncyclopediaFullyLoadedForPro, encyclopedia, hasFullAccess, indexLoadComplete, isLoading, myAtlasIds]);

  const saveEncyclopedia = async (data: MachineEncyclopediaEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ENCYCLOPEDIA, JSON.stringify(data));
      console.log(`[SlotMachineLibrary] Saved ${data.length} encyclopedia entries`);
    } catch (error) {
      console.error('[SlotMachineLibrary] Error saving encyclopedia:', error);
    }
  };

  const saveAtlas = async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MY_ATLAS, JSON.stringify(ids));
      console.log(`[SlotMachineLibrary] Saved ${ids.length} atlas IDs`);
    } catch (error) {
      console.error('[SlotMachineLibrary] Error saving atlas:', error);
    }
  };

  const addMachineFromGlobal = async (globalMachineId: string) => {
    const allGlobalMachines = permanentDB.getAllMachines();
    const globalMachine = allGlobalMachines.find(m => m.id === globalMachineId);
    if (!globalMachine) {
      console.error('[SlotMachineLibrary] Global machine not found:', globalMachineId);
      return;
    }

    const existingEntry = encyclopedia.find(e => e.globalMachineId === globalMachineId);
    if (existingEntry) {
      if (!existingEntry.isInMyAtlas) {
        const updatedEncyclopedia = encyclopedia.map(e =>
          e.id === existingEntry.id
            ? { ...e, isInMyAtlas: true, addedToAtlasAt: new Date().toISOString() }
            : e
        );
        setEncyclopedia(updatedEncyclopedia);
        await saveEncyclopedia(updatedEncyclopedia);

        const updatedAtlasIds = [...myAtlasIds, existingEntry.id];
        setMyAtlasIds(updatedAtlasIds);
        await saveAtlas(updatedAtlasIds);
      }
      return existingEntry.id;
    }

    const newEntry = convertGlobalToEncyclopedia(globalMachine, true);
    newEntry.addedToAtlasAt = new Date().toISOString();

    const updatedEncyclopedia = [...encyclopedia, newEntry];
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);

    const updatedAtlasIds = [...myAtlasIds, newEntry.id];
    setMyAtlasIds(updatedAtlasIds);
    await saveAtlas(updatedAtlasIds);

    console.log('[SlotMachineLibrary] Added machine from global:', newEntry.machineName);
    return newEntry.id;
  };

  const addCustomMachine = async (data: Omit<MachineEncyclopediaEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const cabinetTypeMap: { [key: string]: string } = {
      'Premium': 'Standard Upright',
    };

    const mappedCabinetType = cabinetTypeMap[data.cabinetType] || data.cabinetType;

    const globalMachine: GlobalSlotMachine = {
      id: data.globalMachineId || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: data.machineName,
      manufacturer: data.manufacturer,
      gameSeries: data.gameSeries,
      volatility: data.volatility,
      cabinetType: mappedCabinetType as any,
      releaseYear: data.releaseYear ?? new Date().getFullYear(),
      theme: data.theme ?? undefined,
      description: data.description,
      rtpRange: data.rtpRanges ? `${data.rtpRanges.min}-${data.rtpRanges.max}%` : undefined,
      basePay: data.basePaytable,
      bonusMechanic: data.bonusMechanics,
      jackpotTypes: data.jackpotTypes,
      denominationFamilies: data.denominationFamilies,
      persistenceType: data.apMetadata?.persistenceType,
      hasMHB: data.apMetadata?.hasMustHitBy,
    };

    await permanentDB.addOrUpdateMachine(globalMachine, 'manual');
    console.log('[SlotMachineLibrary] Added machine to permanent database');

    const newEntry: MachineEncyclopediaEntry = {
      ...data,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      globalMachineId: globalMachine.id,
      isInMyAtlas: true,
      addedToAtlasAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedEncyclopedia = [...encyclopedia, newEntry];
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);

    const updatedAtlasIds = [...myAtlasIds, newEntry.id];
    setMyAtlasIds(updatedAtlasIds);
    await saveAtlas(updatedAtlasIds);

    console.log('[SlotMachineLibrary] Added custom machine:', newEntry.machineName);
    return newEntry.id;
  };

  const updateMachine = async (id: string, updates: Partial<MachineEncyclopediaEntry>) => {
    const updatedEncyclopedia = encyclopedia.map(entry =>
      entry.id === id
        ? { ...entry, ...updates, updatedAt: new Date().toISOString() }
        : entry
    );
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);
    console.log('[SlotMachineLibrary] Updated machine:', id);
  };

  const removeMachineFromAtlas = async (id: string) => {
    const updatedEncyclopedia = encyclopedia.map(entry =>
      entry.id === id
        ? { ...entry, isInMyAtlas: false, addedToAtlasAt: undefined }
        : entry
    );
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);

    const updatedAtlasIds = myAtlasIds.filter(atlasId => atlasId !== id);
    setMyAtlasIds(updatedAtlasIds);
    await saveAtlas(updatedAtlasIds);

    console.log('[SlotMachineLibrary] Removed from atlas:', id);
  };

  const deleteMachine = async (id: string) => {
    const updatedEncyclopedia = encyclopedia.filter(entry => entry.id !== id);
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);

    const updatedAtlasIds = myAtlasIds.filter(atlasId => atlasId !== id);
    setMyAtlasIds(updatedAtlasIds);
    await saveAtlas(updatedAtlasIds);

    console.log('[SlotMachineLibrary] Deleted machine:', id);
  };

  const getMachineById = (id: string): MachineEncyclopediaEntry | undefined => {
    return encyclopedia.find(entry => entry.id === id);
  };

  const getMachinesForShip = (shipName: string): MachineEncyclopediaEntry[] => {
    return myAtlasMachines.filter(machine => 
      machine.shipAssignments && machine.shipAssignments.some(s => 
        s.shipName.toLowerCase().includes(shipName.toLowerCase())
      )
    );
  };

  const exportMachinesJSON = async (): Promise<string> => {
    console.log('[SlotMachineLibrary] Starting full export with clean verbose data...');
    
    const cleanedMachines = await Promise.all(
      myAtlasMachines.map(async (machine) => {
        try {
          const fullDetails = await getMachineFullDetails(machine.globalMachineId || machine.id);
          
          const cleanedMachine: any = {
            header: {
              machineName: machine.machineName,
              manufacturer: machine.manufacturer,
              releaseYear: machine.releaseYear,
            },
          };

          if (fullDetails?.simpleSummary || fullDetails?.simple_summary) {
            cleanedMachine.simpleSummary = fullDetails.simpleSummary || fullDetails.simple_summary;
          }
          if (fullDetails?.coreMechanics || fullDetails?.core_mechanics) {
            cleanedMachine.coreMechanics = fullDetails.coreMechanics || fullDetails.core_mechanics;
          }
          if (fullDetails?.apTriggers || fullDetails?.ap_triggers) {
            cleanedMachine.apTriggers = fullDetails.apTriggers || fullDetails.ap_triggers;
          }
          if (fullDetails?.walkAway || fullDetails?.walk_away) {
            cleanedMachine.walkAway = fullDetails.walkAway || fullDetails.walk_away;
          }
          if (fullDetails?.denominations || fullDetails?.denominationFamilies || machine.denominationFamilies) {
            cleanedMachine.denominations = fullDetails?.denominations || fullDetails?.denominationFamilies || machine.denominationFamilies;
          }
          if (fullDetails?.jackpotReset || fullDetails?.jackpot_reset) {
            cleanedMachine.jackpotReset = fullDetails.jackpotReset || fullDetails.jackpot_reset;
          }
          if (fullDetails?.rtpRange) {
            cleanedMachine.rtpRange = fullDetails.rtpRange;
          }
          if (fullDetails?.basePay) {
            cleanedMachine.basePay = fullDetails.basePay;
          }
          if (machine.description || fullDetails?.description) {
            cleanedMachine.description = machine.description || fullDetails?.description;
          }
          if (machine.volatility) {
            cleanedMachine.volatility = machine.volatility;
          }
          if (machine.apMetadata) {
            cleanedMachine.apMetadata = machine.apMetadata;
          }
          if (machine.bonusMechanics) {
            cleanedMachine.bonusMechanics = machine.bonusMechanics;
          }
          if (machine.jackpotTypes) {
            cleanedMachine.jackpotTypes = machine.jackpotTypes;
          }
          if (machine.rtpRanges) {
            cleanedMachine.rtpRanges = machine.rtpRanges;
          }
          if (machine.basePaytable) {
            cleanedMachine.basePaytable = machine.basePaytable;
          }
          if (machine.shipAssignments) {
            cleanedMachine.shipAssignments = machine.shipAssignments;
          }
          if (machine.userNotes) {
            cleanedMachine.userNotes = machine.userNotes;
          }
          if (machine.images) {
            cleanedMachine.images = machine.images;
          }
          
          console.log(`[SlotMachineLibrary] Cleaned machine: ${machine.machineName}`);
          return cleanedMachine;
        } catch (error) {
          console.error(`[SlotMachineLibrary] Error processing machine ${machine.machineName}:`, error);
          return {
            header: {
              machineName: machine.machineName,
              manufacturer: machine.manufacturer,
              releaseYear: machine.releaseYear,
            },
          };
        }
      })
    );
    
    console.log(`[SlotMachineLibrary] Export complete with ${cleanedMachines.length} machines`);
    return JSON.stringify(cleanedMachines, null, 2);
  };

  const importMachinesJSON = async (jsonString: string): Promise<{ success: boolean; count: number; error?: string; details?: string }> => {
    try {
      console.log('[SlotMachineLibrary] Starting import...');
      
      let machines: any[];
      try {
        machines = JSON.parse(jsonString);
      } catch (parseError) {
        return { 
          success: false, 
          count: 0, 
          error: 'Invalid JSON format', 
          details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
        };
      }

      if (!Array.isArray(machines)) {
        return { 
          success: false, 
          count: 0, 
          error: 'Invalid data structure', 
          details: 'Expected an array of machine objects, but got: ' + typeof machines 
        };
      }

      if (machines.length === 0) {
        return { 
          success: false, 
          count: 0, 
          error: 'Empty file', 
          details: 'The JSON file contains an empty array'
        };
      }

      console.log(`[SlotMachineLibrary] Processing ${machines.length} machines from import...`);
      
      const result = await permanentDB.importFromJSON(jsonString);
      console.log('[SlotMachineLibrary] Permanent DB import result:', result);

      const newEntries: MachineEncyclopediaEntry[] = [];
      const skippedEntries: string[] = [];
      let errorCount = 0;
      
      for (const machine of machines) {
        try {
          const header = machine.header || {};
          const hasValidId = machine.id || machine.name || machine.machineName || header.machineName;
          
          if (!hasValidId) {
            console.warn('[SlotMachineLibrary] Skipping machine with no id or name:', machine);
            errorCount++;
            continue;
          }

          const machineId = machine.id?.toString() || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const machineName = machine.name || machine.machineName || header.machineName || 'Unknown Machine';
          const manufacturer = machine.manufacturer || header.manufacturer || 'Other';
          const releaseYear = machine.release_year || machine.releaseYear || header.releaseYear || new Date().getFullYear();
          
          const existingEntry = encyclopedia.find(
            e => e.globalMachineId === machineId || 
                 (e.machineName.toLowerCase() === machineName.toLowerCase() &&
                  e.manufacturer === manufacturer)
          );
          
          if (existingEntry) {
            skippedEntries.push(machineName);
            console.log('[SlotMachineLibrary] Skipping duplicate machine:', machineName);
            continue;
          }

          const apTriggers = machine.ap_triggers || machine.apTriggers || [];
          const walkAway = machine.walk_away || machine.walkAway || [];
          const simpleSummary = machine.simple_summary || machine.simpleSummary || machine.description || '';
          const coreMechanics = machine.core_mechanics || machine.coreMechanics;
          const jackpotReset = machine.jackpot_reset || machine.jackpotReset;

          const newEntry: MachineEncyclopediaEntry = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            globalMachineId: machineId,
            machineName: machineName,
            manufacturer: manufacturer,
            volatility: machine.volatility || 'Medium',
            cabinetType: machine.cabinet_type || machine.cabinetType || 'Standard Upright',
            releaseYear: releaseYear,
            denominationFamilies: machine.denominations || machine.denominationFamilies || [],
            jackpotTypes: jackpotReset ? Object.keys(jackpotReset).map(k => k) : (machine.jackpotTypes || []),
            bonusMechanics: coreMechanics,
            apMetadata: {
              persistenceType: machine.persistenceType || 'True',
              hasMustHitBy: machine.hasMHB || false,
              entryConditions: apTriggers,
              exitConditions: walkAway,
              notesAndTips: simpleSummary,
            },
            description: simpleSummary,
            userNotes: machine.ship_notes || machine.userNotes,
            shipAssignments: machine.shipAssignments,
            images: machine.images,
            rtpRanges: machine.rtpRanges || machine.rtpRange,
            basePaytable: machine.basePaytable || machine.basePay,
            source: 'user',
            isInMyAtlas: true,
            addedToAtlasAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          newEntries.push(newEntry);
        } catch (itemError) {
          errorCount++;
          console.error('[SlotMachineLibrary] Error processing machine:', machine, itemError);
        }
      }

      console.log(`[SlotMachineLibrary] Import summary: ${newEntries.length} new, ${skippedEntries.length} duplicates, ${errorCount} errors`);
      
      if (newEntries.length === 0 && skippedEntries.length > 0) {
        return { 
          success: false, 
          count: 0, 
          error: 'All machines already imported', 
          details: `All ${skippedEntries.length} machines in the file already exist in your atlas. No new machines were added.`
        };
      }

      if (newEntries.length === 0 && errorCount > 0) {
        return { 
          success: false, 
          count: 0, 
          error: 'Import failed', 
          details: `Failed to import ${errorCount} machines. Please check the file format.`
        };
      }

      const updatedEncyclopedia = [...encyclopedia, ...newEntries];
      setEncyclopedia(updatedEncyclopedia);
      await saveEncyclopedia(updatedEncyclopedia);

      const newAtlasIds = newEntries.map(e => e.id);
      const updatedAtlasIds = [...myAtlasIds, ...newAtlasIds];
      setMyAtlasIds(updatedAtlasIds);
      await saveAtlas(updatedAtlasIds);

      console.log('[SlotMachineLibrary] Import complete. Total machines in atlas:', updatedAtlasIds.length);
      console.log('[SlotMachineLibrary] Permanent DB now has', permanentDB.getStats().total, 'machines');

      let details = `Successfully imported ${newEntries.length} machines.`;
      if (skippedEntries.length > 0) {
        details += ` ${skippedEntries.length} duplicates were skipped.`;
      }
      if (errorCount > 0) {
        details += ` ${errorCount} machines failed to import.`;
      }

      return { success: true, count: newEntries.length, details };
    } catch (error) {
      console.error('[SlotMachineLibrary] Import error:', error);
      return { 
        success: false, 
        count: 0, 
        error: 'Import failed', 
        details: error instanceof Error ? error.message : 'Unknown error occurred during import'
      };
    }
  };

  const getMachineFullDetails = useCallback(async (machineId: string): Promise<MachineFullDetails | null> => {
    try {
      console.log(`[SlotMachineLibrary] Fetching full details for machine: ${machineId}`);
      const details = await machineIndexHelper.getMachineDetails(machineId);
      return details;
    } catch (error) {
      console.error('[SlotMachineLibrary] Error fetching machine details:', error);
      return null;
    }
  }, []);

  const hasFullAccess = useMemo(() => {
    return isUserWhitelisted || isPro;
  }, [isPro, isUserWhitelisted]);

  const globalLibrary = useMemo(() => {
    if (hasFullAccess) {
      return encyclopedia;
    }
    return encyclopedia.slice(0, FREE_USER_MACHINE_LIMIT);
  }, [encyclopedia, hasFullAccess]);

  const filteredGlobalLibrary = useMemo(() => {
    let filtered = [...globalLibrary];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        m =>
          m.machineName.toLowerCase().includes(query) ||
          m.manufacturer.toLowerCase().includes(query) ||
          m.gameSeries?.toLowerCase().includes(query) ||
          m.theme?.toLowerCase().includes(query)
      );
    }

    if (filterManufacturers.length > 0) {
      filtered = filtered.filter(m => filterManufacturers.includes(m.manufacturer));
    }

    if (filterVolatility.length > 0) {
      filtered = filtered.filter(m => filterVolatility.includes(m.volatility));
    }

    if (filterCabinet.length > 0) {
      filtered = filtered.filter(m => filterCabinet.includes(m.cabinetType));
    }

    if (filterPersistence.length > 0) {
      filtered = filtered.filter(m => 
        m.apMetadata && filterPersistence.includes(m.apMetadata.persistenceType)
      );
    }

    if (filterHasMHB !== undefined) {
      filtered = filtered.filter(m => m.apMetadata?.hasMustHitBy === filterHasMHB);
    }

    if (filterYearRange) {
      filtered = filtered.filter(
        m => m.releaseYear != null && m.releaseYear >= filterYearRange.min && m.releaseYear <= filterYearRange.max
      );
    }

    if (filterOnlyMyAtlas) {
      filtered = filtered.filter(m => m.isInMyAtlas);
    }

    filtered.sort((a, b) => {
      let aVal: string | number = a.machineName;
      let bVal: string | number = b.machineName;

      switch (sortBy) {
        case 'manufacturer':
          aVal = a.manufacturer;
          bVal = b.manufacturer;
          break;
        case 'year':
          aVal = a.releaseYear ?? 0;
          bVal = b.releaseYear ?? 0;
          break;
        case 'volatility':
          aVal = a.volatility;
          bVal = b.volatility;
          break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (sortOrder === 'asc') {
        return strA < strB ? -1 : strA > strB ? 1 : 0;
      } else {
        return strB < strA ? -1 : strB > strA ? 1 : 0;
      }
    });

    return filtered;
  }, [
    globalLibrary,
    searchQuery,
    filterManufacturers,
    filterVolatility,
    filterCabinet,
    filterPersistence,
    filterHasMHB,
    filterYearRange,
    filterOnlyMyAtlas,
    sortBy,
    sortOrder,
  ]);

  const myAtlasMachines = useMemo(() => {
    const atlasMachines = encyclopedia.filter(entry => entry.isInMyAtlas);
    if (hasFullAccess) {
      return atlasMachines;
    }
    return atlasMachines.slice(0, FREE_USER_MACHINE_LIMIT);
  }, [encyclopedia, hasFullAccess]);

  const totalMachineCount = useMemo(() => {
    return encyclopedia.length;
  }, [encyclopedia]);

  const totalAtlasMachineCount = useMemo(() => {
    return encyclopedia.filter(entry => entry.isInMyAtlas).length;
  }, [encyclopedia]);

  const favoriteMachines = useMemo(() => {
    return encyclopedia.filter(entry => entry.isFavorite);
  }, [encyclopedia]);

  const toggleFavorite = async (id: string) => {
    const machine = encyclopedia.find(e => e.id === id);
    if (!machine) {
      console.error('[SlotMachineLibrary] Machine not found:', id);
      return;
    }

    const updatedEncyclopedia = encyclopedia.map(entry =>
      entry.id === id
        ? {
            ...entry,
            isFavorite: !entry.isFavorite,
            favoritedAt: !entry.isFavorite ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          }
        : entry
    );
    setEncyclopedia(updatedEncyclopedia);
    await saveEncyclopedia(updatedEncyclopedia);
    console.log('[SlotMachineLibrary] Toggled favorite:', id, !machine.isFavorite);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterManufacturers([]);
    setFilterVolatility([]);
    setFilterCabinet([]);
    setFilterPersistence([]);
    setFilterHasMHB(undefined);
    setFilterYearRange(undefined);
    setFilterOnlyMyAtlas(false);
  };

  const openWizard = (source?: 'global' | 'youtube' | 'manual', globalMachineId?: string) => {
    setWizardData({
      step: 1,
      source,
      globalMachineId,
    });
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardData({ step: 1 });
  };

  const updateWizardData = (updates: Partial<AddGameWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const nextWizardStep = () => {
    if (wizardData.step < 3) {
      setWizardData(prev => ({ ...prev, step: (prev.step + 1) as 1 | 2 | 3 }));
    }
  };

  const prevWizardStep = () => {
    if (wizardData.step > 1) {
      setWizardData(prev => ({ ...prev, step: (prev.step - 1) as 1 | 2 | 3 }));
    }
  };

  const completeWizard = async (): Promise<string | undefined> => {
    try {
      if (wizardData.source === 'global' && wizardData.globalMachineId) {
        const id = await addMachineFromGlobal(wizardData.globalMachineId);
        closeWizard();
        return id;
      }

      if (wizardData.machineName && wizardData.manufacturer && wizardData.cabinetType && wizardData.volatility && wizardData.releaseYear) {
        const newMachine: Omit<MachineEncyclopediaEntry, 'id' | 'createdAt' | 'updatedAt'> = {
          globalMachineId: wizardData.globalMachineId,
          machineName: wizardData.machineName,
          manufacturer: wizardData.manufacturer,
          gameSeries: wizardData.gameSeries,
          volatility: wizardData.volatility,
          cabinetType: wizardData.cabinetType,
          releaseYear: wizardData.releaseYear,
          theme: wizardData.theme,
          rtpRanges:
            wizardData.rtpMin && wizardData.rtpMax
              ? { min: wizardData.rtpMin, max: wizardData.rtpMax }
              : undefined,
          basePaytable: wizardData.basePaytable,
          bonusMechanics: wizardData.bonusMechanic,
          jackpotTypes: wizardData.jackpotTypes,
          denominationFamilies: wizardData.denominationFamilies,
          apMetadata: wizardData.persistenceType
            ? {
                persistenceType: wizardData.persistenceType,
                hasMustHitBy: wizardData.hasMustHitBy || false,
                mhbThresholds:
                  wizardData.mhbMinor || wizardData.mhbMajor || wizardData.mhbGrand || wizardData.mhbMega
                    ? {
                        minor: wizardData.mhbMinor,
                        major: wizardData.mhbMajor,
                        grand: wizardData.mhbGrand,
                        mega: wizardData.mhbMega,
                      }
                    : undefined,
                entryConditions: wizardData.entryConditions,
                exitConditions: wizardData.exitConditions,
                risks: wizardData.risks,
                recommendedBankroll:
                  wizardData.bankrollMin && wizardData.bankrollMax
                    ? { min: wizardData.bankrollMin, max: wizardData.bankrollMax }
                    : undefined,
                resetValues:
                  wizardData.resetMinor || wizardData.resetMajor || wizardData.resetGrand || wizardData.resetMega
                    ? {
                        minor: wizardData.resetMinor,
                        major: wizardData.resetMajor,
                        grand: wizardData.resetGrand,
                        mega: wizardData.resetMega,
                      }
                    : undefined,
                bonusVolatility: wizardData.bonusVolatility,
                expectedAPReturn: wizardData.expectedAPReturn,
                notesAndTips: wizardData.apNotes,
              }
            : undefined,
          shipAssignments:
            wizardData.shipName
              ? [
                  {
                    shipName: wizardData.shipName,
                    deckLocations: wizardData.deckLocation ? [wizardData.deckLocation] : undefined,
                    notes: wizardData.shipNotes,
                    lastSeen: new Date().toISOString(),
                  },
                ]
              : undefined,
          userNotes: wizardData.userNotes,
          images: wizardData.images,
          source: wizardData.source === 'manual' ? 'user' : (wizardData.source || 'user'),
          isInMyAtlas: true,
        };

        const id = await addCustomMachine(newMachine);
        closeWizard();
        return id;
      }

      console.error('[SlotMachineLibrary] Incomplete wizard data');
      return undefined;
    } catch (error) {
      console.error('[SlotMachineLibrary] Error completing wizard:', error);
      return undefined;
    }
  };

  return {
    encyclopedia,
    myAtlasMachines,
    favoriteMachines,
    myAtlasIds,
    globalLibrary,
    filteredGlobalLibrary,
    isLoading,
    isUserWhitelisted,
    setIsUserWhitelisted,
    totalMachineCount,
    totalAtlasMachineCount,
    freeUserMachineLimit: FREE_USER_MACHINE_LIMIT,

    searchQuery,
    setSearchQuery,
    filterManufacturers,
    setFilterManufacturers,
    filterVolatility,
    setFilterVolatility,
    filterCabinet,
    setFilterCabinet,
    filterPersistence,
    setFilterPersistence,
    filterHasMHB,
    setFilterHasMHB,
    filterYearRange,
    setFilterYearRange,
    filterOnlyMyAtlas,
    setFilterOnlyMyAtlas,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    clearAllFilters,

    addMachineFromGlobal,
    addCustomMachine,
    updateMachine,
    removeMachineFromAtlas,
    deleteMachine,
    getMachineById,
    getMachinesForShip,
    toggleFavorite,

    wizardOpen,
    wizardData,
    openWizard,
    closeWizard,
    updateWizardData,
    nextWizardStep,
    prevWizardStep,
    completeWizard,

    reload: initializeAndLoadData,
    exportMachinesJSON,
    importMachinesJSON,
    getMachineFullDetails,
    isLoadingIndex,
    indexLoadComplete,
  };
});
