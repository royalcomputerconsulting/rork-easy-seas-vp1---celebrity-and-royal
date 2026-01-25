import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { SlotMachine, SlotMachineFilter, DeckPlanLocation } from '@/types/models';
import { GLOBAL_SLOT_MACHINES, searchSlotMachines, filterSlotMachines } from '@/constants/globalSlotMachines';

const STORAGE_KEYS = {
  USER_MACHINES: '@easyseas/user_slot_machines',
  DECK_LOCATIONS: '@easyseas/deck_plan_locations',
  MACHINE_SETTINGS: '@easyseas/machine_settings',
} as const;

interface SlotMachineState {
  globalMachines: SlotMachine[];
  userMachines: SlotMachine[];
  allMachines: SlotMachine[];
  deckLocations: DeckPlanLocation[];
  
  filters: SlotMachineFilter;
  filteredMachines: SlotMachine[];
  isLoading: boolean;
  
  addMachine: (machine: Omit<SlotMachine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SlotMachine>;
  updateMachine: (id: string, updates: Partial<SlotMachine>) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;
  
  addDeckLocation: (location: Omit<DeckPlanLocation, 'id' | 'createdAt'>) => Promise<DeckPlanLocation>;
  updateDeckLocation: (id: string, updates: Partial<DeckPlanLocation>) => Promise<void>;
  deleteDeckLocation: (id: string) => Promise<void>;
  getDeckLocationsForShip: (shipName: string) => DeckPlanLocation[];
  getDeckLocationsForMachine: (machineId: string) => DeckPlanLocation[];
  
  setFilters: (filters: Partial<SlotMachineFilter>) => void;
  clearFilters: () => void;
  searchMachines: (query: string) => SlotMachine[];
  
  getMachineById: (id: string) => SlotMachine | undefined;
  getMachinesByManufacturer: (manufacturer: string) => SlotMachine[];
  getMachinesWithAPPotential: () => SlotMachine[];
  getMachinesWithMustHitBy: () => SlotMachine[];
  getMachinesForShip: (shipName: string) => SlotMachine[];
  getShipsForMachine: (machineId: string) => string[];
  
  refreshData: () => Promise<void>;
}

const DEFAULT_FILTERS: SlotMachineFilter = {
  searchQuery: '',
  manufacturers: [],
  volatility: [],
  cabinetTypes: [],
  persistenceType: [],
  hasMustHitBy: undefined,
  hasAPPotential: undefined,
  ships: [],
  sortBy: 'name',
  sortOrder: 'asc',
};

export const [SlotMachineProvider, useSlotMachines] = createContextHook((): SlotMachineState => {
  const [globalMachines] = useState<SlotMachine[]>(GLOBAL_SLOT_MACHINES);
  const [userMachines, setUserMachines] = useState<SlotMachine[]>([]);
  const [deckLocations, setDeckLocations] = useState<DeckPlanLocation[]>([]);
  const [filters, setFiltersState] = useState<SlotMachineFilter>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  
  const allMachines = useMemo(() => {
    return [...globalMachines, ...userMachines];
  }, [globalMachines, userMachines]);
  
  const loadFromStorage = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[SlotMachine] Loading data from storage...');
      
      const [userMachinesData, deckLocationsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_MACHINES),
        AsyncStorage.getItem(STORAGE_KEYS.DECK_LOCATIONS),
      ]);
      
      if (userMachinesData) {
        const parsed = JSON.parse(userMachinesData);
        setUserMachines(parsed);
        console.log('[SlotMachine] Loaded', parsed.length, 'user machines');
      }
      
      if (deckLocationsData) {
        const parsed = JSON.parse(deckLocationsData);
        setDeckLocations(parsed);
        console.log('[SlotMachine] Loaded', parsed.length, 'deck locations');
      }
      
      console.log('[SlotMachine] Total machines available:', GLOBAL_SLOT_MACHINES.length + (userMachinesData ? JSON.parse(userMachinesData).length : 0));
    } catch (error) {
      console.error('[SlotMachine] Failed to load from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  
  const persistUserMachines = useCallback(async (machines: SlotMachine[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_MACHINES, JSON.stringify(machines));
      console.log('[SlotMachine] Persisted', machines.length, 'user machines');
    } catch (error) {
      console.error('[SlotMachine] Failed to persist user machines:', error);
    }
  }, []);
  
  const persistDeckLocations = useCallback(async (locations: DeckPlanLocation[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DECK_LOCATIONS, JSON.stringify(locations));
      console.log('[SlotMachine] Persisted', locations.length, 'deck locations');
    } catch (error) {
      console.error('[SlotMachine] Failed to persist deck locations:', error);
    }
  }, []);
  
  const addMachine = useCallback(async (machineData: Omit<SlotMachine, 'id' | 'createdAt' | 'updatedAt'>): Promise<SlotMachine> => {
    const now = new Date().toISOString();
    const newMachine: SlotMachine = {
      ...machineData,
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    
    setUserMachines(prev => {
      const updated = [...prev, newMachine];
      persistUserMachines(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Added new machine:', newMachine.machineName);
    return newMachine;
  }, [persistUserMachines]);
  
  const updateMachine = useCallback(async (id: string, updates: Partial<SlotMachine>) => {
    setUserMachines(prev => {
      const updated = prev.map(machine => 
        machine.id === id 
          ? { ...machine, ...updates, updatedAt: new Date().toISOString() }
          : machine
      );
      persistUserMachines(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Updated machine:', id);
  }, [persistUserMachines]);
  
  const deleteMachine = useCallback(async (id: string) => {
    setUserMachines(prev => {
      const updated = prev.filter(machine => machine.id !== id);
      persistUserMachines(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Deleted machine:', id);
  }, [persistUserMachines]);
  
  const addDeckLocation = useCallback(async (locationData: Omit<DeckPlanLocation, 'id' | 'createdAt'>): Promise<DeckPlanLocation> => {
    const newLocation: DeckPlanLocation = {
      ...locationData,
      id: `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    setDeckLocations(prev => {
      const updated = [...prev, newLocation];
      persistDeckLocations(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Added deck location:', newLocation.shipName, newLocation.deckName);
    return newLocation;
  }, [persistDeckLocations]);
  
  const updateDeckLocation = useCallback(async (id: string, updates: Partial<DeckPlanLocation>) => {
    setDeckLocations(prev => {
      const updated = prev.map(location => 
        location.id === id 
          ? { ...location, ...updates }
          : location
      );
      persistDeckLocations(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Updated deck location:', id);
  }, [persistDeckLocations]);
  
  const deleteDeckLocation = useCallback(async (id: string) => {
    setDeckLocations(prev => {
      const updated = prev.filter(location => location.id !== id);
      persistDeckLocations(updated);
      return updated;
    });
    
    console.log('[SlotMachine] Deleted deck location:', id);
  }, [persistDeckLocations]);
  
  const getDeckLocationsForShip = useCallback((shipName: string): DeckPlanLocation[] => {
    return deckLocations.filter(loc => loc.shipName === shipName);
  }, [deckLocations]);
  
  const getDeckLocationsForMachine = useCallback((machineId: string): DeckPlanLocation[] => {
    return deckLocations.filter(loc => loc.machineId === machineId);
  }, [deckLocations]);
  
  const setFilters = useCallback((newFilters: Partial<SlotMachineFilter>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);
  
  const searchMachinesFunc = useCallback((query: string): SlotMachine[] => {
    return searchSlotMachines(query, allMachines);
  }, [allMachines]);
  
  const filteredMachines = useMemo(() => {
    let machines = [...allMachines];
    
    if (filters.searchQuery) {
      machines = searchSlotMachines(filters.searchQuery, machines);
    }
    
    machines = filterSlotMachines(machines, {
      manufacturers: filters.manufacturers,
      volatility: filters.volatility,
      persistenceType: filters.persistenceType,
      hasMustHitBy: filters.hasMustHitBy,
      hasAPPotential: filters.hasAPPotential,
    });
    
    if (filters.ships && filters.ships.length > 0) {
      machines = machines.filter(m => 
        m.shipSpecificNotes && m.shipSpecificNotes.some(note => 
          filters.ships!.includes(note.shipName)
        )
      );
    }
    
    machines.sort((a, b) => {
      const sortBy = filters.sortBy || 'name';
      const order = filters.sortOrder || 'asc';
      
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.machineName.toLowerCase();
          bVal = b.machineName.toLowerCase();
          break;
        case 'manufacturer':
          aVal = a.manufacturer;
          bVal = b.manufacturer;
          break;
        case 'releaseYear':
          aVal = a.releaseYear;
          bVal = b.releaseYear;
          break;
        case 'volatility':
          const volatilityOrder = ['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High'];
          aVal = volatilityOrder.indexOf(a.volatility);
          bVal = volatilityOrder.indexOf(b.volatility);
          break;
        case 'apRating':
          aVal = a.apMetadata?.persistenceType === 'True' ? 3 : 
                 a.apMetadata?.hasMustHitBy ? 2 :
                 a.apMetadata?.persistenceType === 'Pseudo' ? 1 : 0;
          bVal = b.apMetadata?.persistenceType === 'True' ? 3 : 
                 b.apMetadata?.hasMustHitBy ? 2 :
                 b.apMetadata?.persistenceType === 'Pseudo' ? 1 : 0;
          break;
        default:
          aVal = a.machineName.toLowerCase();
          bVal = b.machineName.toLowerCase();
      }
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    return machines;
  }, [allMachines, filters]);
  
  const getMachineById = useCallback((id: string): SlotMachine | undefined => {
    return allMachines.find(m => m.id === id);
  }, [allMachines]);
  
  const getMachinesByManufacturer = useCallback((manufacturer: string): SlotMachine[] => {
    return allMachines.filter(m => m.manufacturer === manufacturer);
  }, [allMachines]);
  
  const getMachinesWithAPPotential = useCallback((): SlotMachine[] => {
    return allMachines.filter(m => 
      m.apMetadata && (m.apMetadata.persistenceType !== 'None' || m.apMetadata.hasMustHitBy)
    );
  }, [allMachines]);
  
  const getMachinesWithMustHitBy = useCallback((): SlotMachine[] => {
    return allMachines.filter(m => m.apMetadata && m.apMetadata.hasMustHitBy);
  }, [allMachines]);

  const getMachinesForShip = useCallback((shipName: string): SlotMachine[] => {
    return allMachines.filter(m => 
      m.shipSpecificNotes && m.shipSpecificNotes.some(note => 
        note.shipName.toLowerCase().includes(shipName.toLowerCase())
      )
    );
  }, [allMachines]);

  const getShipsForMachine = useCallback((machineId: string): string[] => {
    const machine = allMachines.find(m => m.id === machineId);
    if (!machine || !machine.shipSpecificNotes) return [];
    return machine.shipSpecificNotes.map(note => note.shipName);
  }, [allMachines]);
  
  const refreshData = useCallback(async () => {
    await loadFromStorage();
  }, [loadFromStorage]);
  
  return {
    globalMachines,
    userMachines,
    allMachines,
    deckLocations,
    filters,
    filteredMachines,
    isLoading,
    addMachine,
    updateMachine,
    deleteMachine,
    addDeckLocation,
    updateDeckLocation,
    deleteDeckLocation,
    getDeckLocationsForShip,
    getDeckLocationsForMachine,
    setFilters,
    clearFilters,
    searchMachines: searchMachinesFunc,
    getMachineById,
    getMachinesByManufacturer,
    getMachinesWithAPPotential,
    getMachinesWithMustHitBy,
    getMachinesForShip,
    getShipsForMachine,
    refreshData,
  };
});
