import { useCoreData } from "./CoreDataProvider";
import type { ReactNode } from "react";

export const useFilters = () => {
  const coreData = useCoreData();
  
  return {
    filters: coreData.filters,
    activeFilterCount: coreData.activeFilterCount,
    hasActiveFilters: coreData.hasActiveFilters,
    setFilter: coreData.setFilter,
    setFilters: coreData.setFilters,
    clearFilters: coreData.clearFilters,
    clearFilter: coreData.clearFilter,
  };
};

interface FiltersProviderProps {
  children: ReactNode;
}

export function FiltersProvider({ children }: FiltersProviderProps) {
  return children;
}
