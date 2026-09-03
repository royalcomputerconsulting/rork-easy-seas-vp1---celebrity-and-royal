import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import type { CasinoProgram, TravelBrand } from '@/types/models';
import { ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';

export type ProfileFilterValue = 'all' | 'unassigned' | string;
export type BrandFilterValue = 'all' | TravelBrand;
export type ProgramFilterValue = 'all' | CasinoProgram;

interface PersistedIntelligenceFilters {
  selectedProfileId: ProfileFilterValue;
  selectedBrand: BrandFilterValue;
  selectedProgram: ProgramFilterValue;
}

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
  const hydrationCompleteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void quotaSafeGetJsonItem<PersistedIntelligenceFilters | null>(
      ALL_STORAGE_KEYS.INTELLIGENCE_FILTERS,
      null,
      (value): value is PersistedIntelligenceFilters | null => value === null || (
        typeof value === 'object'
        && !Array.isArray(value)
        && typeof (value as PersistedIntelligenceFilters).selectedProfileId === 'string'
        && typeof (value as PersistedIntelligenceFilters).selectedBrand === 'string'
        && typeof (value as PersistedIntelligenceFilters).selectedProgram === 'string'
      ),
    ).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setSelectedProfileIdState(saved.selectedProfileId);
        setSelectedBrandState(saved.selectedBrand);
        setSelectedProgramState(saved.selectedProgram);
      }
      hydrationCompleteRef.current = true;
    }).catch((error) => {
      console.warn('[IntelligenceFilters] Could not restore saved household scope:', error);
      hydrationCompleteRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrationCompleteRef.current) return;
    void quotaSafeSetJsonItem(ALL_STORAGE_KEYS.INTELLIGENCE_FILTERS, {
      selectedProfileId,
      selectedBrand,
      selectedProgram,
    } satisfies PersistedIntelligenceFilters).catch((error) => {
      console.warn('[IntelligenceFilters] Could not persist household scope:', error);
    });
  }, [selectedBrand, selectedProfileId, selectedProgram]);

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
