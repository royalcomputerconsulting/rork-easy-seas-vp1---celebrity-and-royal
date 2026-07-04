import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@/state/UserProvider';
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
  const { currentUserId } = useUser();
  const [selectedProfileId, setSelectedProfileIdState] = useState<ProfileFilterValue>(currentUserId || 'all');
  const [selectedBrand, setSelectedBrandState] = useState<BrandFilterValue>('all');
  const [selectedProgram, setSelectedProgramState] = useState<ProgramFilterValue>('all');
  // Tracks the previous currentUserId so the effect below can tell the difference
  // between "the active account was actually switched" (should re-scope the filter)
  // and "the user just tapped User/Second User in the filter row" (must NOT be
  // fought back to the active account, or the toggle would never work).
  const previousCurrentUserIdRef = useRef<string | null>(currentUserId ?? null);

  useEffect(() => {
    const accountActuallyChanged = previousCurrentUserIdRef.current !== (currentUserId ?? null);
    previousCurrentUserIdRef.current = currentUserId ?? null;
    if (accountActuallyChanged && currentUserId) {
      console.log('[IntelligenceFilters] Active app account changed; scoping filters to profile:', currentUserId);
      setSelectedProfileIdState(currentUserId);
    }
  }, [currentUserId]);

  const setSelectedProfileId = useCallback((profileId: ProfileFilterValue) => {
    console.log('[IntelligenceFilters] Profile filter changed:', profileId);
    setSelectedProfileIdState(profileId);
  }, [currentUserId]);

  const setSelectedBrand = useCallback((brand: BrandFilterValue) => {
    console.log('[IntelligenceFilters] Brand filter changed:', brand);
    setSelectedBrandState(brand);
  }, []);

  const setSelectedProgram = useCallback((program: ProgramFilterValue) => {
    console.log('[IntelligenceFilters] Program filter changed:', program);
    setSelectedProgramState(program);
  }, []);

  const clearIntelligenceFilters = useCallback(() => {
    console.log('[IntelligenceFilters] Clearing brand filters and returning to active profile');
    setSelectedProfileIdState(currentUserId || 'all');
    setSelectedBrandState('all');
    setSelectedProgramState('all');
  }, [currentUserId]);

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
