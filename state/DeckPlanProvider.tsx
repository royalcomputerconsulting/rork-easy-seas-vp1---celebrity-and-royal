import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { 
  ShipDeckPlan, 
  DeckInfo, 
  MachineSlot,
  getDeckPlanForShip,
  getCasinoDecksForShip,
  getTotalMachineSlots 
} from '@/constants/deckPlans';
import { getShipByName } from '@/constants/shipInfo';

const STORAGE_KEY_DECK_MAPPINGS = 'easyseas_deck_mappings';

export interface MachineDeckMapping {
  id: string;
  machineId: string;
  shipName: string;
  shipClass: string;
  deckNumber: number;
  deckName: string;
  zoneId: string;
  zoneName: string;
  slotId: string;
  slotNumber: number;
  x: number;
  y: number;
  notes?: string;
  lastSeen?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeckPlanState {
  mappings: MachineDeckMapping[];
  isLoading: boolean;

  addMapping: (mapping: Omit<MachineDeckMapping, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<MachineDeckMapping>;
  updateMapping: (id: string, updates: Partial<MachineDeckMapping>) => Promise<void>;
  deleteMapping: (id: string) => Promise<void>;
  
  getMappingsByShip: (shipName: string) => MachineDeckMapping[];
  getMappingsByMachine: (machineId: string) => MachineDeckMapping[];
  getMappingBySlot: (shipName: string, slotId: string) => MachineDeckMapping | undefined;
  getActiveMappingForMachine: (machineId: string, shipName?: string) => MachineDeckMapping | undefined;
  
  getDeckPlanForShip: (shipName: string) => ShipDeckPlan | undefined;
  getCasinoDecks: (shipClass: string) => DeckInfo[];
  getTotalSlots: (shipClass: string) => number;
  getOccupancyRate: (shipName: string) => number;
  
  getAvailableSlots: (shipName: string) => MachineSlot[];
  getMachineLocation: (machineId: string, shipName: string) => string;
  
  refreshData: () => Promise<void>;
}

const [DeckPlanContext, useDeckPlanHook] = createContextHook((): DeckPlanState => {
  const [mappings, setMappings] = useState<MachineDeckMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DeckPlan] Loading deck mappings...');

      const data = await AsyncStorage.getItem(STORAGE_KEY_DECK_MAPPINGS);
      if (data) {
        const parsed: MachineDeckMapping[] = JSON.parse(data);
        setMappings(parsed);
        console.log(`[DeckPlan] Loaded ${parsed.length} mappings`);
      }
    } catch (error) {
      console.error('[DeckPlan] Error loading mappings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveData = useCallback(async (data: MachineDeckMapping[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DECK_MAPPINGS, JSON.stringify(data));
      console.log(`[DeckPlan] Saved ${data.length} mappings`);
    } catch (error) {
      console.error('[DeckPlan] Error saving mappings:', error);
    }
  }, []);

  const addMapping = useCallback(async (
    mappingData: Omit<MachineDeckMapping, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<MachineDeckMapping> => {
    const now = new Date().toISOString();
    const newMapping: MachineDeckMapping = {
      ...mappingData,
      id: `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const existingActiveMappings = mappings.filter(
      m => m.machineId === mappingData.machineId && 
           m.shipName === mappingData.shipName && 
           m.isActive
    );
    
    const updatedMappings = mappings.map(m => 
      existingActiveMappings.some(existing => existing.id === m.id)
        ? { ...m, isActive: false, updatedAt: now }
        : m
    );

    const allMappings = [...updatedMappings, newMapping];
    setMappings(allMappings);
    await saveData(allMappings);

    console.log('[DeckPlan] Added mapping:', newMapping.machineId, 'to', newMapping.shipName);
    return newMapping;
  }, [mappings, saveData]);

  const updateMapping = useCallback(async (id: string, updates: Partial<MachineDeckMapping>) => {
    const updatedMappings = mappings.map(m =>
      m.id === id
        ? { ...m, ...updates, updatedAt: new Date().toISOString() }
        : m
    );

    setMappings(updatedMappings);
    await saveData(updatedMappings);
    console.log('[DeckPlan] Updated mapping:', id);
  }, [mappings, saveData]);

  const deleteMapping = useCallback(async (id: string) => {
    const updatedMappings = mappings.filter(m => m.id !== id);
    setMappings(updatedMappings);
    await saveData(updatedMappings);
    console.log('[DeckPlan] Deleted mapping:', id);
  }, [mappings, saveData]);

  const getMappingsByShip = useCallback((shipName: string): MachineDeckMapping[] => {
    return mappings.filter(m => m.shipName === shipName);
  }, [mappings]);

  const getMappingsByMachine = useCallback((machineId: string): MachineDeckMapping[] => {
    return mappings.filter(m => m.machineId === machineId);
  }, [mappings]);

  const getMappingBySlot = useCallback((shipName: string, slotId: string): MachineDeckMapping | undefined => {
    return mappings.find(m => m.shipName === shipName && m.slotId === slotId && m.isActive);
  }, [mappings]);

  const getActiveMappingForMachine = useCallback((
    machineId: string, 
    shipName?: string
  ): MachineDeckMapping | undefined => {
    const activeMappings = mappings.filter(m => m.machineId === machineId && m.isActive);
    
    if (shipName) {
      return activeMappings.find(m => m.shipName === shipName);
    }
    
    return activeMappings[0];
  }, [mappings]);

  const getDeckPlanForShipFunc = useCallback((shipName: string): ShipDeckPlan | undefined => {
    const shipInfo = getShipByName(shipName);
    if (!shipInfo) return undefined;
    
    return getDeckPlanForShip(shipName, shipInfo.class);
  }, []);

  const getCasinoDecksFunc = useCallback((shipClass: string): DeckInfo[] => {
    return getCasinoDecksForShip(shipClass);
  }, []);

  const getTotalSlotsFunc = useCallback((shipClass: string): number => {
    return getTotalMachineSlots(shipClass);
  }, []);

  const getOccupancyRate = useCallback((shipName: string): number => {
    const shipInfo = getShipByName(shipName);
    if (!shipInfo) return 0;

    const totalSlots = getTotalMachineSlots(shipInfo.class);
    if (totalSlots === 0) return 0;

    const occupiedSlots = mappings.filter(m => m.shipName === shipName && m.isActive).length;
    return (occupiedSlots / totalSlots) * 100;
  }, [mappings]);

  const getAvailableSlots = useCallback((shipName: string): MachineSlot[] => {
    const deckPlan = getDeckPlanForShipFunc(shipName);
    if (!deckPlan) return [];

    const occupiedSlotIds = new Set(
      mappings
        .filter(m => m.shipName === shipName && m.isActive)
        .map(m => m.slotId)
    );

    const availableSlots: MachineSlot[] = [];
    deckPlan.decks.forEach(deck => {
      deck.casinoZones?.forEach(zone => {
        zone.machineSlots?.forEach(slot => {
          if (!occupiedSlotIds.has(slot.id)) {
            availableSlots.push(slot);
          }
        });
      });
    });

    return availableSlots;
  }, [mappings, getDeckPlanForShipFunc]);

  const getMachineLocation = useCallback((machineId: string, shipName: string): string => {
    const mapping = getActiveMappingForMachine(machineId, shipName);
    if (!mapping) return 'Location not set';

    return `${mapping.deckName} - ${mapping.zoneName} - Slot #${mapping.slotNumber}`;
  }, [getActiveMappingForMachine]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    mappings,
    isLoading,
    addMapping,
    updateMapping,
    deleteMapping,
    getMappingsByShip,
    getMappingsByMachine,
    getMappingBySlot,
    getActiveMappingForMachine,
    getDeckPlanForShip: getDeckPlanForShipFunc,
    getCasinoDecks: getCasinoDecksFunc,
    getTotalSlots: getTotalSlotsFunc,
    getOccupancyRate,
    getAvailableSlots,
    getMachineLocation,
    refreshData,
  };
});

export const DeckPlanProvider = DeckPlanContext;
export const useDeckPlan = useDeckPlanHook;
