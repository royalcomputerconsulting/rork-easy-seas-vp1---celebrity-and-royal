import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import type { CasinoProgram, TravelBrand } from '@/types/models';

export type ProfileFilterValue = 'all' | 'unassigned' | string;
export type BrandFilterValue = 'all' | TravelBrand;
export type ProgramFilterValue = 'all' | CasinoProgram;

interface IntelligenceFiltersState {
  selectedProfileId: ProfileFilterValue;
  selectedBrand: BrandFilterValue;
  selectedProgram: ProgramFilterValue;
  setSelectedProfileId: (profileId: ProfileFilterValue) => void;
  setSelectedBrand: (brand: BrandFilterValue) => void;
  setSelectedProgram: (program: ProgramFilterValue) => void;
  clearIntelligenceFilters: () => void;
  activeFilterCount: number;
}

export const [IntelligenceFiltersProvider, useIntelligenceFilters] = createContextHook((): IntelligenceFiltersState => {
  const [selectedProfileId, setSelectedProfileIdState] = useState<ProfileFilterValue>('all');
  const [selectedBrand, setSelectedBrandState] = useState<BrandFilterValue>('all');
  const [selectedProgram, setSelectedProgramState] = useState<ProgramFilterValue>('all');

  const setSelectedProfileId = useCallback((profileId: ProfileFilterValue) => {
    console.log('[IntelligenceFilters] Profile filter changed:', profileId);
    setSelectedProfileIdState(profileId);
  }, []);

  const setSelectedBrand = useCallback((brand: BrandFilterValue) => {
    console.log('[IntelligenceFilters] Brand filter changed:', brand);
    setSelectedBrandState(brand);
  }, []);

  const setSelectedProgram = useCallback((program: ProgramFilterValue) => {
    console.log('[IntelligenceFilters] Program filter changed:', program);
    setSelectedProgramState(program);
  }, []);

  const clearIntelligenceFilters = useCallback(() => {
    console.log('[IntelligenceFilters] Clearing account and brand filters');
    setSelectedProfileIdState('all');
    setSelectedBrandState('all');
    setSelectedProgramState('all');
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProfileId !== 'all') count += 1;
    if (selectedBrand !== 'all') count += 1;
    if (selectedProgram !== 'all') count += 1;
    return count;
  }, [selectedBrand, selectedProfileId, selectedProgram]);

  return {
    selectedProfileId,
    selectedBrand,
    selectedProgram,
    setSelectedProfileId,
    setSelectedBrand,
    setSelectedProgram,
    clearIntelligenceFilters,
    activeFilterCount,
  };
});
