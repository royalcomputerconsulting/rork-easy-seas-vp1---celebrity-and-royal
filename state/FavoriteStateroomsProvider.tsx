import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/state/AuthProvider';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import type { FavoriteStateroom, FavoriteStateroomDraft } from '@/types/favorite-staterooms';

interface FavoriteStateroomFilters {
  search: string;
  shipNames: string[];
}

interface FavoriteStateroomStats {
  totalCount: number;
  shipCount: number;
  deckCount: number;
}

interface FavoriteStateroomsState {
  userId: string;
  entries: FavoriteStateroom[];
  allEntries: FavoriteStateroom[];
  entriesTotal: number;
  filters: FavoriteStateroomFilters;
  stats: FavoriteStateroomStats;
  isLoading: boolean;
  updateFilters: (filters: Partial<FavoriteStateroomFilters>) => void;
  resetFilters: () => void;
  createFavoriteStateroom: (draft: FavoriteStateroomDraft) => Promise<FavoriteStateroom>;
  updateFavoriteStateroom: (id: string, updates: Partial<FavoriteStateroomDraft>) => Promise<FavoriteStateroom>;
  deleteFavoriteStateroom: (id: string) => Promise<void>;
  clearFavoriteStaterooms: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: FavoriteStateroomFilters = {
  search: '',
  shipNames: [],
};

function sortEntries(entries: FavoriteStateroom[]): FavoriteStateroom[] {
  return [...entries].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function normalizeValue(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function validateDraft(draft: FavoriteStateroomDraft): FavoriteStateroomDraft {
  const shipName = draft.shipName.trim();
  const stateroomNumber = draft.stateroomNumber.trim().toUpperCase();

  if (!shipName) {
    throw new Error('Please enter a ship name.');
  }

  if (!stateroomNumber) {
    throw new Error('Please enter a stateroom number.');
  }

  return {
    shipName,
    stateroomNumber,
    deckNumber: draft.deckNumber?.trim() || undefined,
    category: draft.category?.trim() || undefined,
    locationNotes: draft.locationNotes?.trim() || undefined,
    nearbyAlternatives: draft.nearbyAlternatives?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
  };
}

export const [FavoriteStateroomsProvider, useFavoriteStaterooms] = createContextHook((): FavoriteStateroomsState => {
  const auth = useAuth();
  const userId = auth.authenticatedEmail || 'guest';
  const storageKeyRef = useRef<string>(getUserScopedKey(ALL_STORAGE_KEYS.FAVORITE_STATEROOMS, auth.authenticatedEmail));
  const [allEntries, setAllEntries] = useState<FavoriteStateroom[]>([]);
  const [filters, setFilters] = useState<FavoriteStateroomFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(ALL_STORAGE_KEYS.FAVORITE_STATEROOMS, auth.authenticatedEmail);
    console.log('[FavoriteStaterooms] Scoped storage key updated:', {
      user: auth.authenticatedEmail,
      key: storageKeyRef.current,
    });
  }, [auth.authenticatedEmail]);

  const loadEntries = useCallback(async () => {
    console.log('[FavoriteStaterooms] Loading favorite staterooms from storage...');
    setIsLoading(true);

    try {
      const storedEntries = await AsyncStorage.getItem(storageKeyRef.current);
      const parsedEntries = storedEntries ? (JSON.parse(storedEntries) as FavoriteStateroom[]) : [];
      const sortedEntries = sortEntries(parsedEntries);
      setAllEntries(sortedEntries);
      console.log('[FavoriteStaterooms] Loaded favorite staterooms:', {
        count: sortedEntries.length,
        key: storageKeyRef.current,
      });
    } catch (error) {
      console.error('[FavoriteStaterooms] Failed to load favorite staterooms:', error);
      setAllEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setAllEntries([]);
    setFilters(DEFAULT_FILTERS);
    void loadEntries();
  }, [auth.authenticatedEmail, loadEntries]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[FavoriteStaterooms] appDataCleared event received, resetting in-memory state');
      setAllEntries([]);
      setFilters(DEFAULT_FILTERS);
      setIsLoading(false);
    };

    const handleCloudRestore = () => {
      console.log('[FavoriteStaterooms] cloudDataRestored event received, reloading state');
      void loadEntries();
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('appDataCleared', handleDataCleared);
        window.addEventListener('cloudDataRestored', handleCloudRestore);
        return () => {
          window.removeEventListener('appDataCleared', handleDataCleared);
          window.removeEventListener('cloudDataRestored', handleCloudRestore);
        };
      }
    } catch (error) {
      console.log('[FavoriteStaterooms] Unable to subscribe to browser events:', error);
    }
  }, [loadEntries]);

  const persistEntries = useCallback(async (nextEntries: FavoriteStateroom[]) => {
    const sortedEntries = sortEntries(nextEntries);
    setAllEntries(sortedEntries);
    await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(sortedEntries));
    console.log('[FavoriteStaterooms] Persisted favorite staterooms:', {
      count: sortedEntries.length,
      key: storageKeyRef.current,
    });
  }, []);

  const updateFilters = useCallback((nextFilters: Partial<FavoriteStateroomFilters>) => {
    console.log('[FavoriteStaterooms] Updating filters:', nextFilters);
    setFilters((prev) => ({ ...prev, ...nextFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    console.log('[FavoriteStaterooms] Resetting filters');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const createFavoriteStateroom = useCallback(async (draft: FavoriteStateroomDraft) => {
    const normalizedDraft = validateDraft(draft);
    const duplicateEntry = allEntries.find((entry) => {
      return normalizeValue(entry.shipName) === normalizeValue(normalizedDraft.shipName)
        && normalizeValue(entry.stateroomNumber) === normalizeValue(normalizedDraft.stateroomNumber);
    });

    if (duplicateEntry) {
      throw new Error('That ship and stateroom is already in your favorites.');
    }

    const now = new Date().toISOString();
    const newEntry: FavoriteStateroom = {
      id: `favorite_stateroom_${Date.now()}`,
      userId,
      createdAt: now,
      updatedAt: now,
      ...normalizedDraft,
    };

    console.log('[FavoriteStaterooms] Creating favorite stateroom:', newEntry);
    await persistEntries([newEntry, ...allEntries]);
    return newEntry;
  }, [allEntries, persistEntries, userId]);

  const updateFavoriteStateroom = useCallback(async (id: string, updates: Partial<FavoriteStateroomDraft>) => {
    const existingEntry = allEntries.find((entry) => entry.id === id);

    if (!existingEntry) {
      throw new Error('Favorite stateroom not found.');
    }

    const normalizedDraft = validateDraft({
      shipName: updates.shipName ?? existingEntry.shipName,
      stateroomNumber: updates.stateroomNumber ?? existingEntry.stateroomNumber,
      deckNumber: updates.deckNumber ?? existingEntry.deckNumber,
      category: updates.category ?? existingEntry.category,
      locationNotes: updates.locationNotes ?? existingEntry.locationNotes,
      nearbyAlternatives: updates.nearbyAlternatives ?? existingEntry.nearbyAlternatives,
      notes: updates.notes ?? existingEntry.notes,
    });

    const duplicateEntry = allEntries.find((entry) => {
      if (entry.id === id) {
        return false;
      }

      return normalizeValue(entry.shipName) === normalizeValue(normalizedDraft.shipName)
        && normalizeValue(entry.stateroomNumber) === normalizeValue(normalizedDraft.stateroomNumber);
    });

    if (duplicateEntry) {
      throw new Error('Another favorite already uses that ship and stateroom.');
    }

    const updatedEntry: FavoriteStateroom = {
      ...existingEntry,
      ...normalizedDraft,
      updatedAt: new Date().toISOString(),
    };

    const nextEntries = allEntries.map((entry) => entry.id === id ? updatedEntry : entry);
    console.log('[FavoriteStaterooms] Updating favorite stateroom:', { id, updates: updatedEntry });
    await persistEntries(nextEntries);
    return updatedEntry;
  }, [allEntries, persistEntries]);

  const deleteFavoriteStateroom = useCallback(async (id: string) => {
    console.log('[FavoriteStaterooms] Deleting favorite stateroom:', id);
    const nextEntries = allEntries.filter((entry) => entry.id !== id);
    await persistEntries(nextEntries);
  }, [allEntries, persistEntries]);

  const clearFavoriteStaterooms = useCallback(async () => {
    console.log('[FavoriteStaterooms] Clearing all favorite staterooms');
    setAllEntries([]);
    setFilters(DEFAULT_FILTERS);
    await AsyncStorage.removeItem(storageKeyRef.current);
  }, []);

  const entries = useMemo(() => {
    let filteredEntries = [...allEntries];

    if (filters.shipNames.length > 0) {
      filteredEntries = filteredEntries.filter((entry) => filters.shipNames.includes(entry.shipName));
    }

    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      filteredEntries = filteredEntries.filter((entry) => {
        return entry.shipName.toLowerCase().includes(query)
          || entry.stateroomNumber.toLowerCase().includes(query)
          || entry.deckNumber?.toLowerCase().includes(query)
          || entry.category?.toLowerCase().includes(query)
          || entry.locationNotes?.toLowerCase().includes(query)
          || entry.nearbyAlternatives?.toLowerCase().includes(query)
          || entry.notes?.toLowerCase().includes(query);
      });
    }

    return filteredEntries;
  }, [allEntries, filters]);

  const stats = useMemo<FavoriteStateroomStats>(() => {
    const ships = new Set<string>();
    const decks = new Set<string>();

    allEntries.forEach((entry) => {
      if (entry.shipName) {
        ships.add(entry.shipName);
      }
      if (entry.deckNumber) {
        decks.add(entry.deckNumber);
      }
    });

    return {
      totalCount: allEntries.length,
      shipCount: ships.size,
      deckCount: decks.size,
    };
  }, [allEntries]);

  return useMemo(() => ({
    userId,
    entries,
    allEntries,
    entriesTotal: allEntries.length,
    filters,
    stats,
    isLoading,
    updateFilters,
    resetFilters,
    createFavoriteStateroom,
    updateFavoriteStateroom,
    deleteFavoriteStateroom,
    clearFavoriteStaterooms,
    refetch: loadEntries,
  }), [
    userId,
    entries,
    allEntries,
    filters,
    stats,
    isLoading,
    updateFilters,
    resetFilters,
    createFavoriteStateroom,
    updateFavoriteStateroom,
    deleteFavoriteStateroom,
    clearFavoriteStaterooms,
    loadEntries,
  ]);
});
