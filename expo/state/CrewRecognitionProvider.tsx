import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/state/AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';

import type { RecognitionEntryWithCrew, Sailing, Department } from '@/types/crew-recognition';
import { CREW_RECOGNITION_CSV } from '@/constants/crew-recognition-csv';

const BASE_STORAGE_KEY_ENTRIES = 'crew_recognition_entries_v2';
const BASE_STORAGE_KEY_SAILINGS = 'crew_recognition_sailings_v2';

interface CrewRecognitionFilters {
  search: string;
  shipNames: string[];
  month: string;
  year: number | null;
  departments: string[];
  roleTitle: string;
  startDate: string;
  endDate: string;
}

const DEFAULT_FILTERS: CrewRecognitionFilters = {
  search: '',
  shipNames: [],
  month: '',
  year: null,
  departments: [],
  roleTitle: '',
  startDate: '',
  endDate: '',
};

interface CSVRow {
  sailingId: string;
  crewName: string;
  crewId: string;
  department: string;
  roleTitle: string;
  notes: string;
  shipName: string;
  startDate: string;
  endDate: string;
}

interface ParsedCrewImport {
  entries: RecognitionEntryWithCrew[];
  sailings: Sailing[];
  totalRows: number;
  duplicateCount: number;
}

function normalizeCrewImportValue(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function createLocalIdPart(value: string, fallback: string): string {
  const normalized = normalizeCrewImportValue(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function buildSailingIdentity(input: { sailingId?: string; shipName?: string; startDate?: string; endDate?: string }): string {
  const shipName = normalizeCrewImportValue(input.shipName);
  const startDate = normalizeCrewImportValue(input.startDate);
  const endDate = normalizeCrewImportValue(input.endDate || input.startDate);

  if (shipName || startDate || endDate) {
    return [shipName, startDate, endDate].join('__');
  }

  return normalizeCrewImportValue(input.sailingId);
}

function buildRecognitionEntryIdentity(input: {
  fullName: string;
  crewMemberId?: string;
  shipName: string;
  sailStartDate: string;
  sailEndDate?: string;
  department: string;
  roleTitle?: string;
}): string {
  const crewIdentity = normalizeCrewImportValue(input.fullName) || normalizeCrewImportValue(input.crewMemberId);
  return [
    crewIdentity,
    normalizeCrewImportValue(input.shipName),
    normalizeCrewImportValue(input.sailStartDate),
    normalizeCrewImportValue(input.sailEndDate || input.sailStartDate),
    normalizeCrewImportValue(input.department),
    normalizeCrewImportValue(input.roleTitle),
  ].join('__');
}

function dedupeSailings(sailings: Sailing[]): Sailing[] {
  const sailingMap = new Map<string, Sailing>();

  sailings.forEach((sailing) => {
    const sailingIdentity = buildSailingIdentity({
      shipName: sailing.shipName,
      startDate: sailing.sailStartDate,
      endDate: sailing.sailEndDate,
    });

    if (!sailingIdentity) {
      return;
    }

    if (!sailingMap.has(sailingIdentity)) {
      sailingMap.set(sailingIdentity, sailing);
    }
  });

  return Array.from(sailingMap.values());
}

function parseCSVToEntries(csvText: string): ParsedCrewImport {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return { entries: [], sailings: [], totalRows: 0, duplicateCount: 0 };
  }

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^[\uFEFF"']/g, '').replace(/["']$/g, ''));

  const rows: CSVRow[] = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return {
      sailingId: row['Sailing_ID'] || '',
      crewName: row['Crew_Name'] || '',
      crewId: row['Crew_ID'] || '',
      department: row['Department'] || '',
      roleTitle: row['Role'] || '',
      notes: row['Notes'] || '',
      shipName: row['Ship'] || '',
      startDate: row['Start_Date'] || '',
      endDate: row['End_Date'] || '',
    };
  }).filter(r => r.crewName && r.department);

  const sailingsMap = new Map<string, Sailing>();
  const recognitionEntryKeys = new Set<string>();
  const entries: RecognitionEntryWithCrew[] = [];
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const sailingIdentity = buildSailingIdentity(row) || `${row.shipName}_${row.startDate}_${index}`;
    const sailingIdPart = createLocalIdPart(sailingIdentity, `sailing_${index}`);

    if (!sailingsMap.has(sailingIdentity) && row.shipName) {
      sailingsMap.set(sailingIdentity, {
        id: `local_sailing_${sailingIdPart}`,
        shipName: row.shipName,
        sailStartDate: row.startDate || '',
        sailEndDate: row.endDate || row.startDate || '',
        userId: 'local',
      });
    }

    const sailing = sailingsMap.get(sailingIdentity);
    const startDate = row.startDate || '';
    const endDate = row.endDate || startDate;
    const sailingMonth = startDate.substring(0, 7);
    const sailingYear = startDate ? parseInt(startDate.substring(0, 4), 10) : 0;
    const crewIdPart = createLocalIdPart(row.crewId || row.crewName, `crew_${index}`);
    const recognitionEntryIdentity = buildRecognitionEntryIdentity({
      fullName: row.crewName,
      shipName: row.shipName,
      sailStartDate: startDate,
      sailEndDate: endDate,
      department: row.department,
      roleTitle: row.roleTitle || undefined,
    });

    if (recognitionEntryKeys.has(recognitionEntryIdentity)) {
      duplicateCount += 1;
      console.log('[CrewRecognition] Skipping duplicate CSV row:', {
        crewName: row.crewName,
        shipName: row.shipName,
        startDate,
        department: row.department,
      });
      return;
    }

    recognitionEntryKeys.add(recognitionEntryIdentity);

    entries.push({
      id: `local_entry_${crewIdPart}_${sailingIdPart}_${index}`,
      crewMemberId: `local_crew_${crewIdPart}`,
      sailingId: sailing?.id || `local_sailing_${sailingIdPart}`,
      shipName: row.shipName,
      sailStartDate: startDate,
      sailEndDate: endDate,
      sailingMonth,
      sailingYear,
      department: row.department,
      roleTitle: row.roleTitle || undefined,
      sourceText: 'Imported from CSV',
      userId: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fullName: row.crewName,
      crewNotes: row.notes || undefined,
    });
  });

  return {
    entries,
    sailings: Array.from(sailingsMap.values()),
    totalRows: rows.length,
    duplicateCount,
  };
}

export const [CrewRecognitionProvider, useCrewRecognition] = createContextHook(() => {
  const auth = useAuth();
  const userId = auth.authenticatedEmail || 'guest';

  const skEntriesRef = useRef(getUserScopedKey(BASE_STORAGE_KEY_ENTRIES, auth.authenticatedEmail));
  const skSailingsRef = useRef(getUserScopedKey(BASE_STORAGE_KEY_SAILINGS, auth.authenticatedEmail));
  useEffect(() => {
    skEntriesRef.current = getUserScopedKey(BASE_STORAGE_KEY_ENTRIES, auth.authenticatedEmail);
    skSailingsRef.current = getUserScopedKey(BASE_STORAGE_KEY_SAILINGS, auth.authenticatedEmail);
    console.log('[CrewRecognition] Scoped storage keys updated for:', auth.authenticatedEmail);
  }, [auth.authenticatedEmail]);

  const [filters, setFilters] = useState<CrewRecognitionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [localEntries, setLocalEntries] = useState<RecognitionEntryWithCrew[]>([]);
  const [localSailings, setLocalSailings] = useState<Sailing[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [storedEntries, storedSailings] = await Promise.all([
          AsyncStorage.getItem(skEntriesRef.current),
          AsyncStorage.getItem(skSailingsRef.current),
        ]);
        if (storedEntries) {
          setLocalEntries(JSON.parse(storedEntries));
        } else {
          setLocalEntries([]);
        }
        if (storedSailings) {
          setLocalSailings(JSON.parse(storedSailings));
        } else {
          setLocalSailings([]);
        }
        console.log('[CrewRecognition] Loaded local data for user:', userId, storedEntries ? JSON.parse(storedEntries).length : 0, 'entries');
      } catch (e) {
        console.error('[CrewRecognition] Error loading local data:', e);
        setLocalEntries([]);
        setLocalSailings([]);
      } finally {
        setLocalLoaded(true);
      }
    })();
  }, [userId]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[CrewRecognition] Data cleared event detected, resetting crew data');
      setLocalEntries([]);
      setLocalSailings([]);
      setFilters(DEFAULT_FILTERS);
      setPage(1);
      setIsOfflineMode(false);
    };

    const handleCloudRestore = () => {
      console.log('[CrewRecognition] Cloud data restored, reloading crew data');
      void (async () => {
        try {
          const [storedEntries, storedSailings] = await Promise.all([
            AsyncStorage.getItem(skEntriesRef.current),
            AsyncStorage.getItem(skSailingsRef.current),
          ]);
          setLocalEntries(storedEntries ? JSON.parse(storedEntries) : []);
          setLocalSailings(storedSailings ? JSON.parse(storedSailings) : []);
          console.log('[CrewRecognition] Reloaded after cloud restore:', storedEntries ? JSON.parse(storedEntries).length : 0, 'entries');
        } catch (e) {
          console.error('[CrewRecognition] Error reloading after cloud restore:', e);
        }
      })();
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
    } catch (e) {
      console.log('[CrewRecognition] Could not set up event listeners:', e);
    }
  }, []);

  const statsQuery = trpc.crewRecognition.getStats.useQuery(
    { userId },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: !!userId,
      retry: 1,
      retryDelay: 2000,
    }
  );

  const entriesQuery = trpc.crewRecognition.getRecognitionEntries.useQuery(
    {
      search: filters.search || undefined,
      shipNames: filters.shipNames.length > 0 ? filters.shipNames : undefined,
      month: filters.month || undefined,
      year: filters.year || undefined,
      departments: filters.departments.length > 0 ? filters.departments : undefined,
      roleTitle: filters.roleTitle || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page,
      pageSize,
      userId,
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: !!userId,
      retry: 1,
      retryDelay: 2000,
    }
  );

  const sailingsQuery = trpc.crewRecognition.getSailings.useQuery(
    { userId },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: !!userId,
      retry: 1,
      retryDelay: 2000,
    }
  );

  useEffect(() => {
    const backendFailed = statsQuery.isError || entriesQuery.isError;
    if (backendFailed && localLoaded) {
      setIsOfflineMode(true);
      console.log('[CrewRecognition] Backend offline, using local data');
    } else if (statsQuery.isSuccess && entriesQuery.isSuccess) {
      setIsOfflineMode(false);
    }
  }, [statsQuery.isError, statsQuery.isSuccess, entriesQuery.isError, entriesQuery.isSuccess, localLoaded]);

  const filteredLocalEntries = useMemo(() => {
    if (!isOfflineMode) return [];
    let result = [...localEntries];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(e => e.fullName.toLowerCase().includes(searchLower));
    }
    if (filters.shipNames.length > 0) {
      result = result.filter(e => filters.shipNames.includes(e.shipName));
    }
    if (filters.departments.length > 0) {
      result = result.filter(e => filters.departments.includes(e.department));
    }
    if (filters.roleTitle) {
      const roleLower = filters.roleTitle.toLowerCase();
      result = result.filter(e => e.roleTitle?.toLowerCase().includes(roleLower));
    }
    if (filters.startDate) {
      result = result.filter(e => e.sailStartDate >= filters.startDate);
    }
    if (filters.endDate) {
      result = result.filter(e => e.sailEndDate <= filters.endDate);
    }
    if (filters.month) {
      result = result.filter(e => e.sailingMonth === filters.month);
    }
    if (filters.year) {
      result = result.filter(e => e.sailingYear === filters.year);
    }

    result.sort((a, b) => (b.sailStartDate || '').localeCompare(a.sailStartDate || ''));
    return result;
  }, [isOfflineMode, localEntries, filters]);



  const localStats = useMemo(() => {
    const uniqueCrewIds = new Set(localEntries.map(e => e.crewMemberId));
    return {
      crewMemberCount: uniqueCrewIds.size,
      recognitionEntryCount: localEntries.length,
    };
  }, [localEntries]);

  const createCrewMemberMutation = trpc.crewRecognition.createCrewMember.useMutation({
    onSuccess: () => {
      void statsQuery.refetch();
      void entriesQuery.refetch();
    },
  });

  const addCrewMemberWithFallback = useCallback(async (data: {
    fullName: string;
    department: string;
    roleTitle?: string;
    notes?: string;
    sailingId?: string;
    userId: string;
  }) => {
    if (!isOfflineMode) {
      try {
        const result = await createCrewMemberMutation.mutateAsync(data as any);
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend create failed, falling back to local:', err instanceof Error ? err.message : String(err));
      }
    }
    console.log('[CrewRecognition] Creating crew member locally:', data.fullName);

    const now = new Date().toISOString();
    const crewId = `local_crew_manual_${Date.now()}`;
    const sailing = data.sailingId ? localSailings.find(s => s.id === data.sailingId) : undefined;

    const newEntry: RecognitionEntryWithCrew = {
      id: `local_entry_manual_${Date.now()}`,
      crewMemberId: crewId,
      sailingId: sailing?.id || '',
      shipName: sailing?.shipName || '',
      sailStartDate: sailing?.sailStartDate || '',
      sailEndDate: sailing?.sailEndDate || '',
      sailingMonth: sailing?.sailStartDate?.substring(0, 7) || '',
      sailingYear: sailing?.sailStartDate ? parseInt(sailing.sailStartDate.substring(0, 4), 10) : 0,
      department: data.department,
      roleTitle: data.roleTitle,
      sourceText: 'Manually added',
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
      fullName: data.fullName,
      crewNotes: data.notes,
    };

    const updatedEntries = [newEntry, ...localEntries];
    setLocalEntries(updatedEntries);
    setIsOfflineMode(true);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
    console.log('[CrewRecognition] Added crew member locally with notes:', data.fullName, data.notes ? '(has notes)' : '(no notes)');
    return newEntry;
  }, [isOfflineMode, createCrewMemberMutation, localEntries, localSailings]);

  const updateCrewMemberMutation = trpc.crewRecognition.updateCrewMember.useMutation({
    onSuccess: () => {
      void entriesQuery.refetch();
    },
  });

  const deleteCrewMemberMutation = trpc.crewRecognition.deleteCrewMember.useMutation({
    onSuccess: () => {
      void statsQuery.refetch();
      void entriesQuery.refetch();
    },
  });

  const createRecognitionEntryMutation = trpc.crewRecognition.createRecognitionEntry.useMutation({
    onSuccess: () => {
      void statsQuery.refetch();
      void entriesQuery.refetch();
    },
  });

  const updateRecognitionEntryMutation = trpc.crewRecognition.updateRecognitionEntry.useMutation({
    onSuccess: () => {
      void entriesQuery.refetch();
    },
  });

  const deleteRecognitionEntryMutation = trpc.crewRecognition.deleteRecognitionEntry.useMutation({
    onSuccess: () => {
      void statsQuery.refetch();
      void entriesQuery.refetch();
    },
  });

  const deleteRecognitionEntryWithFallback = useCallback(async (data: { id: string }) => {
    if (!isOfflineMode) {
      try {
        const result = await deleteRecognitionEntryMutation.mutateAsync(data);
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend delete failed, falling back to local:', err);
      }
    }

    const updatedEntries = localEntries.filter(e => e.id !== data.id);
    setLocalEntries(updatedEntries);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
    console.log('[CrewRecognition] Deleted entry locally:', data.id);
    return { success: true };
  }, [isOfflineMode, deleteRecognitionEntryMutation, localEntries]);

  const updateRecognitionEntryWithFallback = useCallback(async (data: { id: string; department?: Department; roleTitle?: string; sourceText?: string; sailingId?: string }) => {
    if (!isOfflineMode) {
      try {
        const result = await updateRecognitionEntryMutation.mutateAsync(data);
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend update failed, falling back to local:', err);
      }
    }

    const updatedEntries = localEntries.map(e => {
      if (e.id !== data.id) return e;
      const updated = { ...e, updatedAt: new Date().toISOString() };
      if (data.department !== undefined) updated.department = data.department;
      if (data.roleTitle !== undefined) updated.roleTitle = data.roleTitle;
      if (data.sourceText !== undefined) updated.sourceText = data.sourceText;
      if (data.sailingId !== undefined) {
        const sailing = localSailings.find(s => s.id === data.sailingId);
        if (sailing) {
          updated.sailingId = sailing.id;
          updated.shipName = sailing.shipName;
          updated.sailStartDate = sailing.sailStartDate;
          updated.sailEndDate = sailing.sailEndDate;
          updated.sailingMonth = sailing.sailStartDate?.substring(0, 7) || '';
          updated.sailingYear = sailing.sailStartDate ? parseInt(sailing.sailStartDate.substring(0, 4), 10) : 0;
        }
      }
      return updated;
    });
    setLocalEntries(updatedEntries);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
    console.log('[CrewRecognition] Updated entry locally:', data.id);
    return { success: true };
  }, [isOfflineMode, updateRecognitionEntryMutation, localEntries, localSailings]);

  const deleteCrewMemberWithFallback = useCallback(async (data: { id: string }) => {
    if (!isOfflineMode) {
      try {
        const result = await deleteCrewMemberMutation.mutateAsync(data);
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend delete crew member failed, falling back to local:', err);
      }
    }

    const updatedEntries = localEntries.filter(e => e.crewMemberId !== data.id);
    setLocalEntries(updatedEntries);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
    console.log('[CrewRecognition] Deleted crew member entries locally:', data.id);
    return { success: true };
  }, [isOfflineMode, deleteCrewMemberMutation, localEntries]);

  const createSailingMutation = trpc.crewRecognition.createSailing.useMutation({
    onSuccess: () => {
      void sailingsQuery.refetch();
    },
  });

  const createSailingWithFallback = useCallback(async (data: {
    shipName: string;
    sailStartDate: string;
    sailEndDate: string;
    nights?: number;
    userId: string;
  }): Promise<Sailing> => {
    const normalizedShipName = data.shipName.trim();
    const existingLocalSailing = localSailings.find(
      (sailing) => sailing.shipName === normalizedShipName && sailing.sailStartDate === data.sailStartDate,
    );

    if (existingLocalSailing) {
      return existingLocalSailing;
    }

    if (!isOfflineMode) {
      try {
        const result = await createSailingMutation.mutateAsync(data as never);
        const createdSailing = Array.isArray(result) ? result[0] : result;
        if (createdSailing && typeof createdSailing === 'object') {
          return createdSailing as unknown as Sailing;
        }
      } catch (err) {
        console.log('[CrewRecognition] Backend create sailing failed, falling back to local:', err);
      }
    }

    const now = new Date().toISOString();
    const newSailing: Sailing = {
      id: `local_sailing_manual_${Date.now()}`,
      shipName: normalizedShipName,
      sailStartDate: data.sailStartDate,
      sailEndDate: data.sailEndDate,
      nights: data.nights,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
    };

    const updatedSailings = [newSailing, ...localSailings];
    setLocalSailings(updatedSailings);
    setIsOfflineMode(true);
    await AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(updatedSailings));
    console.log('[CrewRecognition] Created sailing locally:', {
      shipName: normalizedShipName,
      sailStartDate: data.sailStartDate,
      sailEndDate: data.sailEndDate,
    });
    return newSailing;
  }, [createSailingMutation, isOfflineMode, localSailings]);

  const clearCrewData = useCallback(async () => {
    console.log('[CrewRecognition] Clearing all crew data...');
    setLocalEntries([]);
    setLocalSailings([]);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setIsOfflineMode(false);
    try {
      await Promise.all([
        AsyncStorage.removeItem(skEntriesRef.current),
        AsyncStorage.removeItem(skSailingsRef.current),
      ]);
      console.log('[CrewRecognition] Crew data cleared from storage');
    } catch (e) {
      console.error('[CrewRecognition] Error clearing crew data:', e);
    }
  }, []);

  const syncFromCSVLocally = useCallback(async () => {
    console.log('[CrewRecognition] Parsing CSV locally...');
    const parsedImport = parseCSVToEntries(CREW_RECOGNITION_CSV);
    console.log('[CrewRecognition] Parsed import summary:', {
      parsedEntries: parsedImport.entries.length,
      parsedSailings: parsedImport.sailings.length,
      totalRows: parsedImport.totalRows,
      duplicateRowsSkipped: parsedImport.duplicateCount,
    });

    const existingEntryKeys = new Set(
      localEntries.map((entry) => buildRecognitionEntryIdentity({
        fullName: entry.fullName,
        crewMemberId: entry.crewMemberId,
        shipName: entry.shipName,
        sailStartDate: entry.sailStartDate,
        sailEndDate: entry.sailEndDate,
        department: entry.department,
        roleTitle: entry.roleTitle,
      }))
    );

    const newEntries = parsedImport.entries.filter((entry) => {
      const entryIdentity = buildRecognitionEntryIdentity({
        fullName: entry.fullName,
        crewMemberId: entry.crewMemberId,
        shipName: entry.shipName,
        sailStartDate: entry.sailStartDate,
        sailEndDate: entry.sailEndDate,
        department: entry.department,
        roleTitle: entry.roleTitle,
      });

      if (existingEntryKeys.has(entryIdentity)) {
        console.log('[CrewRecognition] Skipping duplicate against existing local entries:', {
          fullName: entry.fullName,
          shipName: entry.shipName,
          sailStartDate: entry.sailStartDate,
        });
        return false;
      }

      existingEntryKeys.add(entryIdentity);
      return true;
    });

    const duplicateCount = parsedImport.duplicateCount + (parsedImport.entries.length - newEntries.length);
    const mergedEntries = [...newEntries, ...localEntries];
    const mergedSailings = dedupeSailings([...parsedImport.sailings, ...localSailings]);

    setLocalEntries(mergedEntries);
    setLocalSailings(mergedSailings);
    setIsOfflineMode(true);

    await Promise.all([
      AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(mergedEntries)),
      AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(mergedSailings)),
    ]);
    console.log('[CrewRecognition] Saved deduped import to local storage:', {
      importedCount: newEntries.length,
      totalEntries: mergedEntries.length,
      totalSailings: mergedSailings.length,
      duplicateCount,
    });

    return {
      importedCount: newEntries.length,
      totalRows: parsedImport.totalRows,
      duplicateCount,
    };
  }, [localEntries, localSailings]);

  const updateFilters = useCallback((newFilters: Partial<CrewRecognitionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const previousPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const useLocal = isOfflineMode || (statsQuery.isError && localLoaded);
  const backendEntries = useMemo(() => {
    const raw = entriesQuery.data?.entries || [];
    return [...raw].sort((a, b) => (b.sailStartDate || '').localeCompare(a.sailStartDate || ''));
  }, [entriesQuery.data?.entries]);
  const backendTotal = entriesQuery.data?.total || 0;

  const refetch = useCallback(() => {
    void statsQuery.refetch();
    void entriesQuery.refetch();
    void sailingsQuery.refetch();
  }, [statsQuery, entriesQuery, sailingsQuery]);

  return useMemo(() => ({
    userId,
    filters,
    updateFilters,
    resetFilters,
    page,
    pageSize,
    nextPage,
    previousPage,
    goToPage,
    stats: useLocal ? localStats : (statsQuery.data || { crewMemberCount: 0, recognitionEntryCount: 0 }),
    statsLoading: !useLocal && statsQuery.isLoading,
    entries: useLocal ? filteredLocalEntries : backendEntries,
    entriesTotal: useLocal ? filteredLocalEntries.length : backendTotal,
    entriesLoading: !useLocal && entriesQuery.isLoading,
    sailings: useLocal ? localSailings : (sailingsQuery.data || []),
    sailingsLoading: !useLocal && sailingsQuery.isLoading,
    isOfflineMode: useLocal,
    syncFromCSVLocally,
    createCrewMember: addCrewMemberWithFallback,
    updateCrewMember: updateCrewMemberMutation.mutateAsync,
    deleteCrewMember: deleteCrewMemberWithFallback,
    createRecognitionEntry: createRecognitionEntryMutation.mutateAsync,
    updateRecognitionEntry: updateRecognitionEntryWithFallback,
    deleteRecognitionEntry: deleteRecognitionEntryWithFallback,
    createSailing: createSailingWithFallback,
    clearCrewData,
    refetch,
  }), [
    userId, filters, updateFilters, resetFilters, page, pageSize, nextPage, previousPage, goToPage,
    useLocal, localStats, statsQuery.data, statsQuery.isLoading, filteredLocalEntries, backendEntries, backendTotal,
    entriesQuery.isLoading, localSailings, sailingsQuery.data, sailingsQuery.isLoading,
    syncFromCSVLocally, addCrewMemberWithFallback, updateCrewMemberMutation.mutateAsync,
    deleteCrewMemberWithFallback, createRecognitionEntryMutation.mutateAsync,
    updateRecognitionEntryWithFallback, deleteRecognitionEntryWithFallback,
    createSailingWithFallback, clearCrewData, refetch,
  ]);
});
