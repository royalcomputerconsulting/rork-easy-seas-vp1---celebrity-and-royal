import { useState, useMemo, useCallback } from 'react';
import type {
  MachineEncyclopediaEntry,
  SlotManufacturer,
  MachineVolatility,
  PersistenceType,
} from '@/types/models';

type SortField = 'name' | 'manufacturer' | 'year' | 'volatility';
type SortOrder = 'asc' | 'desc';

export interface SlotMachineFilterState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterManufacturers: SlotManufacturer[];
  setFilterManufacturers: (m: SlotManufacturer[]) => void;
  filterVolatility: MachineVolatility[];
  setFilterVolatility: (v: MachineVolatility[]) => void;
  filterPersistence: PersistenceType[];
  setFilterPersistence: (p: PersistenceType[]) => void;
  filterHasMHB: boolean | undefined;
  setFilterHasMHB: (v: boolean | undefined) => void;
  filterYearRange: { min: number; max: number } | undefined;
  setFilterYearRange: (r: { min: number; max: number } | undefined) => void;
  filterOnlyMyAtlas: boolean;
  setFilterOnlyMyAtlas: (v: boolean) => void;
  sortBy: SortField;
  setSortBy: (s: SortField) => void;
  sortOrder: SortOrder;
  setSortOrder: (o: SortOrder) => void;
  clearAllFilters: () => void;
  filteredLibrary: MachineEncyclopediaEntry[];
  activeFilterCount: number;
}

export function useSlotMachineFilters(
  machines: MachineEncyclopediaEntry[]
): SlotMachineFilterState {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterManufacturers, setFilterManufacturers] = useState<SlotManufacturer[]>([]);
  const [filterVolatility, setFilterVolatility] = useState<MachineVolatility[]>([]);
  const [filterPersistence, setFilterPersistence] = useState<PersistenceType[]>([]);
  const [filterHasMHB, setFilterHasMHB] = useState<boolean | undefined>(undefined);
  const [filterYearRange, setFilterYearRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [filterOnlyMyAtlas, setFilterOnlyMyAtlas] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilterManufacturers([]);
    setFilterVolatility([]);
    setFilterPersistence([]);
    setFilterHasMHB(undefined);
    setFilterYearRange(undefined);
    setFilterOnlyMyAtlas(false);
  }, []);

  const filteredLibrary = useMemo(() => {
    let filtered = [...machines];

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
    machines,
    searchQuery,
    filterManufacturers,
    filterVolatility,
    filterPersistence,
    filterHasMHB,
    filterYearRange,
    filterOnlyMyAtlas,
    sortBy,
    sortOrder,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterManufacturers.length > 0) count += filterManufacturers.length;
    if (filterVolatility.length > 0) count += filterVolatility.length;
    if (filterPersistence.length > 0) count += filterPersistence.length;
    if (filterHasMHB !== undefined) count += 1;
    if (filterYearRange) count += 1;
    if (filterOnlyMyAtlas) count += 1;
    return count;
  }, [filterManufacturers, filterVolatility, filterPersistence, filterHasMHB, filterYearRange, filterOnlyMyAtlas]);

  return {
    searchQuery,
    setSearchQuery,
    filterManufacturers,
    setFilterManufacturers,
    filterVolatility,
    setFilterVolatility,
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
    filteredLibrary,
    activeFilterCount,
  };
}
