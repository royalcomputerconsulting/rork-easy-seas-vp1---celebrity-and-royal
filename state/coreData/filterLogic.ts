import { useMemo } from 'react';
import type { CruiseFilter } from '@/types/models';

export const DEFAULT_FILTERS: CruiseFilter = {
  searchQuery: '',
  shipNames: [],
  departurePorts: [],
  destinations: [],
  minNights: undefined,
  maxNights: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  dateRange: undefined,
  hasOffer: undefined,
  hasFreeplay: undefined,
  hasOBC: undefined,
  cabinTypes: [],
  sortBy: 'date',
  sortOrder: 'asc',
};

export function useFilterLogic(filters: CruiseFilter) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery && filters.searchQuery.length > 0) count++;
    if (filters.shipNames && filters.shipNames.length > 0) count++;
    if (filters.departurePorts && filters.departurePorts.length > 0) count++;
    if (filters.destinations && filters.destinations.length > 0) count++;
    if (filters.minNights !== undefined) count++;
    if (filters.maxNights !== undefined) count++;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.dateRange) count++;
    if (filters.hasOffer !== undefined) count++;
    if (filters.hasFreeplay !== undefined) count++;
    if (filters.hasOBC !== undefined) count++;
    if (filters.cabinTypes && filters.cabinTypes.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    activeFilterCount,
    hasActiveFilters,
    DEFAULT_FILTERS,
  };
}
