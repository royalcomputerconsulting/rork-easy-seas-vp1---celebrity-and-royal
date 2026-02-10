import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/state/AuthProvider';
import { CREW_RECOGNITION_CSV } from '@/constants/crew-recognition-csv';
import type { RecognitionEntryWithCrew, Sailing } from '@/types/crew-recognition';

const STORAGE_KEY_ENTRIES = 'crew_recognition_entries_v2';
const STORAGE_KEY_SAILINGS = 'crew_recognition_sailings_v2';

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

function parseCSVToEntries(csvText: string): { entries: RecognitionEntryWithCrew[]; sailings: Sailing[] } {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return { entries: [], sailings: [] };

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
  const entries: RecognitionEntryWithCrew[] = [];

  rows.forEach((row, index) => {
    const sailingKey = row.sailingId || `${row.shipName}_${row.startDate}`;

    if (!sailingsMap.has(sailingKey) && row.shipName) {
      sailingsMap.set(sailingKey, {
        id: `local_sailing_${sailingKey}`,
        shipName: row.shipName,
        sailStartDate: row.startDate || '',
        sailEndDate: row.endDate || row.startDate || '',
        userId: 'local',
      });
    }

    const sailing = sailingsMap.get(sailingKey);
    const startDate = row.startDate || '';
    const sailingMonth = startDate.substring(0, 7);
    const sailingYear = startDate ? parseInt(startDate.substring(0, 4), 10) : 0;

    entries.push({
      id: `local_entry_${row.crewId}_${sailingKey}_${index}`,
      crewMemberId: `local_crew_${row.crewId}`,
      sailingId: sailing?.id || `local_sailing_${sailingKey}`,
      shipName: row.shipName,
      sailStartDate: startDate,
      sailEndDate: row.endDate || startDate,
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
  };
}

export const [CrewRecognitionProvider, useCrewRecognition] = createContextHook(() => {
  const auth = useAuth();
  const userId = auth.authenticatedEmail || 'guest';

  const [filters, setFilters] = useState<CrewRecognitionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [localEntries, setLocalEntries] = useState<RecognitionEntryWithCrew[]>([]);
  const [localSailings, setLocalSailings] = useState<Sailing[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedEntries, storedSailings] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ENTRIES),
          AsyncStorage.getItem(STORAGE_KEY_SAILINGS),
        ]);
        if (storedEntries) {
          setLocalEntries(JSON.parse(storedEntries));
        }
        if (storedSailings) {
          setLocalSailings(JSON.parse(storedSailings));
        }
        console.log('[CrewRecognition] Loaded local data:', storedEntries ? JSON.parse(storedEntries).length : 0, 'entries');
      } catch (e) {
        console.error('[CrewRecognition] Error loading local data:', e);
      } finally {
        setLocalLoaded(true);
      }
    })();
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
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const updateCrewMemberMutation = trpc.crewRecognition.updateCrewMember.useMutation({
    onSuccess: () => {
      entriesQuery.refetch();
    },
  });

  const deleteCrewMemberMutation = trpc.crewRecognition.deleteCrewMember.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const createRecognitionEntryMutation = trpc.crewRecognition.createRecognitionEntry.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const updateRecognitionEntryMutation = trpc.crewRecognition.updateRecognitionEntry.useMutation({
    onSuccess: () => {
      entriesQuery.refetch();
    },
  });

  const deleteRecognitionEntryMutation = trpc.crewRecognition.deleteRecognitionEntry.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const createSailingMutation = trpc.crewRecognition.createSailing.useMutation({
    onSuccess: () => {
      sailingsQuery.refetch();
    },
  });

  const syncFromCSVLocally = useCallback(async () => {
    console.log('[CrewRecognition] Parsing CSV locally...');
    const { entries: parsedEntries, sailings: parsedSailings } = parseCSVToEntries(CREW_RECOGNITION_CSV);
    console.log('[CrewRecognition] Parsed', parsedEntries.length, 'entries,', parsedSailings.length, 'sailings');

    setLocalEntries(parsedEntries);
    setLocalSailings(parsedSailings);
    setIsOfflineMode(true);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(parsedEntries)),
      AsyncStorage.setItem(STORAGE_KEY_SAILINGS, JSON.stringify(parsedSailings)),
    ]);
    console.log('[CrewRecognition] Saved to local storage');

    return { importedCount: parsedEntries.length, totalRows: parsedEntries.length };
  }, []);

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
  const backendEntries = entriesQuery.data?.entries || [];
  const backendTotal = entriesQuery.data?.total || 0;

  return {
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
    createCrewMember: createCrewMemberMutation.mutateAsync,
    updateCrewMember: updateCrewMemberMutation.mutateAsync,
    deleteCrewMember: deleteCrewMemberMutation.mutateAsync,
    createRecognitionEntry: createRecognitionEntryMutation.mutateAsync,
    updateRecognitionEntry: updateRecognitionEntryMutation.mutateAsync,
    deleteRecognitionEntry: deleteRecognitionEntryMutation.mutateAsync,
    createSailing: createSailingMutation.mutateAsync,
    refetch: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
      sailingsQuery.refetch();
    },
  };
});
