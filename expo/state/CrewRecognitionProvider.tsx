import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { quotaSafeGetJsonItem, quotaSafeRemoveItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/state/AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { buildOwnerScopeId, getInstallationId } from '@/lib/storage/installationId';
import { crewEntryIdentity, crewSailingIdentity, parseCrewRecognitionImport } from '@/lib/crewRecognitionImport';
import { subscribeToAppDataEvent } from '@/lib/appDataEvents';

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
  const userId = auth.authenticatedEmail?.toLowerCase().trim() || 'guest';
  const [ownerScopeId, setOwnerScopeId] = useState<string | null>(null);
  const ownerScopeIdRef = useRef<string | null>(null);

  const skEntriesRef = useRef(getUserScopedKey(BASE_STORAGE_KEY_ENTRIES, auth.authenticatedEmail));
  const skSailingsRef = useRef(getUserScopedKey(BASE_STORAGE_KEY_SAILINGS, auth.authenticatedEmail));
  useEffect(() => {
    let isMounted = true;
    skEntriesRef.current = getUserScopedKey(BASE_STORAGE_KEY_ENTRIES, auth.authenticatedEmail);
    skSailingsRef.current = getUserScopedKey(BASE_STORAGE_KEY_SAILINGS, auth.authenticatedEmail);
    localHydratedRef.current = false;
    localHydrationPromiseRef.current = null;
    setLocalLoaded(false);
    setLocalEntries([]);
    setLocalSailings([]);
    console.log('[CrewRecognition] Scoped storage keys updated for:', auth.authenticatedEmail);

    if (!auth.authenticatedEmail) {
      ownerScopeIdRef.current = null;
      setOwnerScopeId(null);
      return;
    }

    void getInstallationId()
      .then((installationId) => {
        if (!isMounted || !auth.authenticatedEmail) {
          return;
        }
        const nextOwnerScopeId = buildOwnerScopeId(auth.authenticatedEmail, installationId);
        ownerScopeIdRef.current = nextOwnerScopeId;
        setOwnerScopeId(nextOwnerScopeId);
        console.log('[CrewRecognition] Owner data scope resolved:', { email: auth.authenticatedEmail, ownerScopeId: nextOwnerScopeId });
      })
      .catch((error) => {
        console.error('[CrewRecognition] Failed to resolve owner data scope:', error);
        ownerScopeIdRef.current = null;
        setOwnerScopeId(null);
      });

    return () => {
      isMounted = false;
    };
  }, [auth.authenticatedEmail]);

  const [filters, setFilters] = useState<CrewRecognitionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [localEntries, setLocalEntries] = useState<RecognitionEntryWithCrew[]>([]);
  const [localSailings, setLocalSailings] = useState<Sailing[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(true);
  const [cloudRefreshEnabled, setCloudRefreshEnabled] = useState(false);
  const localHydrationPromiseRef = useRef<Promise<void> | null>(null);
  const localHydratedRef = useRef(false);

  const ensureLocalDataLoaded = useCallback(async (): Promise<void> => {
    if (localHydratedRef.current) return;
    if (localHydrationPromiseRef.current) return localHydrationPromiseRef.current;

    const pending = (async () => {
      try {
        const [storedEntries, storedSailings] = await Promise.all([
          quotaSafeGetJsonItem<RecognitionEntryWithCrew[]>(skEntriesRef.current, [], Array.isArray),
          quotaSafeGetJsonItem<Sailing[]>(skSailingsRef.current, [], Array.isArray),
        ]);
        setLocalEntries(storedEntries);
        setLocalSailings(storedSailings);
        setIsOfflineMode(true);
        console.log('[CrewRecognition] On-demand local data loaded for user:', userId, storedEntries.length, 'entries');
      } catch (error) {
        console.error('[CrewRecognition] Error loading on-demand local data:', error);
        setLocalEntries([]);
        setLocalSailings([]);
      } finally {
        localHydratedRef.current = true;
        localHydrationPromiseRef.current = null;
        setLocalLoaded(true);
      }
    })();

    localHydrationPromiseRef.current = pending;
    return pending;
  }, [userId]);

  useEffect(() => {
    // A retained registry can be large. It is intentionally loaded only when
    // its screen asks for it; Save All / Load All use its storage records
    // directly and never need to inflate this collection during startup.
    localHydratedRef.current = false;
    localHydrationPromiseRef.current = null;
    setLocalLoaded(false);
  }, [userId]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[CrewRecognition] Data cleared event detected, resetting crew data');
      localHydratedRef.current = false;
      localHydrationPromiseRef.current = null;
      setLocalLoaded(false);
      setLocalEntries([]);
      setLocalSailings([]);
      setFilters(DEFAULT_FILTERS);
      setPage(1);
      setIsOfflineMode(false);
    };

    const handleCloudRestore = () => {
      // Do not deserialize a large registry in the middle of a Load All
      // interaction. The Crew screen will hydrate the restored data on demand.
      console.log('[CrewRecognition] Cloud data restored; crew data will hydrate when opened');
      localHydratedRef.current = false;
      localHydrationPromiseRef.current = null;
      setLocalLoaded(false);
      setLocalEntries([]);
      setLocalSailings([]);
    };

    const unsubscribeNativeClear = subscribeToAppDataEvent('appDataCleared', handleDataCleared);
    const unsubscribeNativeRestore = subscribeToAppDataEvent('cloudDataRestored', handleCloudRestore);
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('appDataCleared', handleDataCleared);
        window.addEventListener('cloudDataRestored', handleCloudRestore);
        return () => {
          unsubscribeNativeClear();
          unsubscribeNativeRestore();
          window.removeEventListener('appDataCleared', handleDataCleared);
          window.removeEventListener('cloudDataRestored', handleCloudRestore);
        };
      }
    } catch (e) {
      console.log('[CrewRecognition] Could not set up event listeners:', e);
    }
    return () => { unsubscribeNativeClear(); unsubscribeNativeRestore(); };
  }, []);

  const statsQuery = trpc.crewRecognition.getStats.useQuery(
    { userId, ownerScopeId: ownerScopeId || '' },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: cloudRefreshEnabled && !!auth.authenticatedEmail && !!ownerScopeId,
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
      ownerScopeId: ownerScopeId || '',
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: cloudRefreshEnabled && !!auth.authenticatedEmail && !!ownerScopeId,
      retry: 1,
      retryDelay: 2000,
    }
  );

  const sailingsQuery = trpc.crewRecognition.getSailings.useQuery(
    { userId, ownerScopeId: ownerScopeId || '' },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: cloudRefreshEnabled && !!auth.authenticatedEmail && !!ownerScopeId,
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

  const pagedLocalEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLocalEntries.slice(start, start + pageSize);
  }, [filteredLocalEntries, page, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredLocalEntries.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredLocalEntries.length, page, pageSize]);



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
    const now = new Date().toISOString();
    const crewId = `local_crew_manual_${Date.now()}`;
    const sailing = data.sailingId ? localSailings.find(s => s.id === data.sailingId) : undefined;

    const newLocalEntry: RecognitionEntryWithCrew = {
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

    const updatedEntries = [newLocalEntry, ...localEntries];
    setLocalEntries(updatedEntries);
    await quotaSafeSetJsonItem(skEntriesRef.current, updatedEntries);
    console.log('[CrewRecognition] Persisted crew member locally:', data.fullName, data.notes ? '(has notes)' : '(no notes)');

    if (!isOfflineMode) {
      try {
        const currentOwnerScopeId = ownerScopeIdRef.current;
        if (!currentOwnerScopeId) {
          throw new Error('User data scope is not ready yet.');
        }
        const result = await createCrewMemberMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId } as any);
        console.log('[CrewRecognition] Also saved crew member to backend:', data.fullName);
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend create failed, local copy persisted:', err instanceof Error ? err.message : String(err));
        setIsOfflineMode(true);
      }
    }

    return newLocalEntry;
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
    const updatedEntries = localEntries.filter(e => e.id !== data.id);
    setLocalEntries(updatedEntries);
    await quotaSafeSetJsonItem(skEntriesRef.current, updatedEntries);
    console.log('[CrewRecognition] Deleted scoped entry locally:', { entryId: data.id, userId });

    if (!isOfflineMode) {
      try {
        const currentOwnerScopeId = ownerScopeIdRef.current;
        if (!currentOwnerScopeId) {
          throw new Error('User data scope is not ready yet.');
        }
        const result = await deleteRecognitionEntryMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend delete failed, local already removed:', err);
      }
    }

    return { success: true };
  }, [isOfflineMode, deleteRecognitionEntryMutation, localEntries, userId]);

  const updateRecognitionEntryWithFallback = useCallback(async (data: { id: string; department?: Department; roleTitle?: string; sourceText?: string; sailingId?: string }) => {
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
    await quotaSafeSetJsonItem(skEntriesRef.current, updatedEntries);
    console.log('[CrewRecognition] Updated entry locally:', data.id);

    if (!isOfflineMode) {
      try {
        const currentOwnerScopeId = ownerScopeIdRef.current;
        if (!currentOwnerScopeId) {
          throw new Error('User data scope is not ready yet.');
        }
        const result = await updateRecognitionEntryMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend update failed, local already updated:', err);
      }
    }

    return { success: true };
  }, [isOfflineMode, updateRecognitionEntryMutation, localEntries, localSailings, userId]);

  const deleteCrewMemberWithFallback = useCallback(async (data: { id: string }) => {
    const updatedEntries = localEntries.filter(e => e.crewMemberId !== data.id);
    setLocalEntries(updatedEntries);
    await quotaSafeSetJsonItem(skEntriesRef.current, updatedEntries);
    console.log('[CrewRecognition] Deleted scoped crew member entries locally:', { crewMemberId: data.id, userId });

    if (!isOfflineMode) {
      try {
        const currentOwnerScopeId = ownerScopeIdRef.current;
        if (!currentOwnerScopeId) {
          throw new Error('User data scope is not ready yet.');
        }
        const result = await deleteCrewMemberMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
        return result;
      } catch (err) {
        console.log('[CrewRecognition] Backend delete crew member failed, local already removed:', err);
      }
    }

    return { success: true };
  }, [isOfflineMode, deleteCrewMemberMutation, localEntries, userId]);

  const createSailingMutation = trpc.crewRecognition.createSailing.useMutation({
    onSuccess: () => {
      void sailingsQuery.refetch();
    },
  });

  const updateCrewMemberScoped = useCallback((data: {
    id: string;
    fullName: string;
    department: Department;
    roleTitle?: string;
    notes?: string;
  }) => {
    const currentOwnerScopeId = ownerScopeIdRef.current;
    if (!currentOwnerScopeId) {
      return Promise.reject(new Error('User data scope is not ready yet.'));
    }
    return updateCrewMemberMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
  }, [updateCrewMemberMutation, userId]);

  const createRecognitionEntryScoped = useCallback((data: {
    crewMemberId: string;
    sailingId: string;
    department: Department;
    roleTitle?: string;
    sourceText?: string;
  }) => {
    const currentOwnerScopeId = ownerScopeIdRef.current;
    if (!currentOwnerScopeId) {
      return Promise.reject(new Error('User data scope is not ready yet.'));
    }
    return createRecognitionEntryMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
  }, [createRecognitionEntryMutation, userId]);

  const createSailingScoped = useCallback((data: {
    shipName: string;
    sailStartDate: string;
    sailEndDate: string;
    nights?: number;
  }) => {
    const currentOwnerScopeId = ownerScopeIdRef.current;
    if (!currentOwnerScopeId) {
      return Promise.reject(new Error('User data scope is not ready yet.'));
    }
    return createSailingMutation.mutateAsync({ ...data, userId, ownerScopeId: currentOwnerScopeId });
  }, [createSailingMutation, userId]);

  const clearCrewData = useCallback(async () => {
    console.log('[CrewRecognition] Clearing all crew data...');
    localHydratedRef.current = false;
    localHydrationPromiseRef.current = null;
    setLocalLoaded(false);
    setLocalEntries([]);
    setLocalSailings([]);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setIsOfflineMode(false);
    try {
      await Promise.all([
        quotaSafeRemoveItem(skEntriesRef.current),
        quotaSafeRemoveItem(skSailingsRef.current),
      ]);
      console.log('[CrewRecognition] Crew data cleared from storage');
    } catch (e) {
      console.error('[CrewRecognition] Error clearing crew data:', e);
    }
  }, []);

  const importFromTextLocally = useCallback(async (text: string): Promise<{
    importedCount: number;
    skippedCount: number;
    shipName: string;
    sailDate: string;
    sailingCount: number;
    format: 'csv' | 'text';
    warnings: string[];
  }> => {
    // Let the import modal close and the current interaction paint before CSV
    // parsing/identity indexing begins. This prevents a large registry import
    // from monopolizing the navigation frame.
    await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
    const parsed = parseCrewRecognitionImport(text, userId);
    if (!parsed.entries.length) {
      throw new Error(parsed.warnings[0] || 'No crew recognition rows were found in this file.');
    }

    const existingEntryKeys = new Set(localEntries.map(crewEntryIdentity));
    const additions = parsed.entries.filter((entry) => {
      const identity = crewEntryIdentity(entry);
      if (existingEntryKeys.has(identity)) return false;
      existingEntryKeys.add(identity);
      return true;
    });
    const existingSailingKeys = new Set(localSailings.map(crewSailingIdentity));
    const sailingAdditions = parsed.sailings.filter((sailing) => {
      const identity = crewSailingIdentity(sailing);
      if (existingSailingKeys.has(identity)) return false;
      existingSailingKeys.add(identity);
      return true;
    });
    const updatedEntries = [...additions, ...localEntries];
    const updatedSailings = [...sailingAdditions, ...localSailings];

    // Commit both collections together so a crew row can never point at a sailing
    // that was not retained. Existing data is merged, never replaced.
    await Promise.all([
      quotaSafeSetJsonItem(skEntriesRef.current, updatedEntries),
      quotaSafeSetJsonItem(skSailingsRef.current, updatedSailings),
    ]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    setLocalEntries(updatedEntries);
    setLocalSailings(updatedSailings);
    setPage(1);
    setIsOfflineMode(true);

    const first = additions[0] ?? parsed.entries[0];
    console.log('[CrewRecognition] Multi-file import complete:', {
      format: parsed.format,
      imported: additions.length,
      skipped: parsed.entries.length - additions.length,
      sailings: parsed.sailings.length,
      warnings: parsed.warnings.length,
    });
    return {
      importedCount: additions.length,
      skippedCount: parsed.entries.length - additions.length,
      shipName: first?.shipName ?? '',
      sailDate: first?.sailStartDate ?? '',
      sailingCount: parsed.sailings.length,
      format: parsed.format,
      warnings: parsed.warnings,
    };
  }, [localEntries, localSailings, userId]);

  const syncFromCSVLocally = useCallback(async () => {
    console.log('[CrewRecognition] Parsing CSV locally...');
    const { entries: parsedEntries, sailings: parsedSailings } = parseCSVToEntries(CREW_RECOGNITION_CSV);
    console.log('[CrewRecognition] Parsed', parsedEntries.length, 'entries,', parsedSailings.length, 'sailings');

    setLocalEntries(parsedEntries);
    setLocalSailings(parsedSailings);
    setIsOfflineMode(true);

    await Promise.all([
      quotaSafeSetJsonItem(skEntriesRef.current, parsedEntries),
      quotaSafeSetJsonItem(skSailingsRef.current, parsedSailings),
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

  const useLocal = !cloudRefreshEnabled || isOfflineMode || (statsQuery.isError && localLoaded);
  const backendEntries = useMemo(() => {
    const raw = entriesQuery.data?.entries || [];
    return [...raw].sort((a, b) => (b.sailStartDate || '').localeCompare(a.sailStartDate || ''));
  }, [entriesQuery.data?.entries]);
  const backendTotal = entriesQuery.data?.total || 0;

  useEffect(() => {
    if (!cloudRefreshEnabled || !entriesQuery.isSuccess || !entriesQuery.data?.entries) return;
    const backendEntriesPage = entriesQuery.data.entries;
    const backendTotal = entriesQuery.data.total || 0;
    const isCompleteCollection = page === 1 && backendEntriesPage.length === backendTotal;
    if (!isCompleteCollection) {
      console.log('[CrewRecognition] Manual cloud page not persisted because the complete collection was not fetched', {
        page,
        pageCount: backendEntriesPage.length,
        backendTotal,
      });
      return;
    }
    void quotaSafeGetJsonItem<RecognitionEntryWithCrew[]>(skEntriesRef.current, [], Array.isArray)
      .then((existingLocal) => {
        const backendIds = new Set(backendEntriesPage.map((entry) => entry.id));
        const localOnlyEntries = existingLocal.filter((entry) => !backendIds.has(entry.id) && entry.id.startsWith('local_'));
        const merged = [...backendEntriesPage, ...localOnlyEntries];
        setLocalEntries(merged);
        return quotaSafeSetJsonItem(skEntriesRef.current, merged);
      })
      .then(() => console.log('[CrewRecognition] Manual complete cloud collection merged into local storage'))
      .catch((error) => console.error('[CrewRecognition] Manual cloud merge failed:', error));
  }, [cloudRefreshEnabled, entriesQuery.isSuccess, entriesQuery.data?.entries, entriesQuery.data?.total, page]);

  useEffect(() => {
    if (!cloudRefreshEnabled || !sailingsQuery.isSuccess || !Array.isArray(sailingsQuery.data)) return;
    const sailingsToPersist = sailingsQuery.data;
    setLocalSailings(sailingsToPersist);
    void quotaSafeSetJsonItem(skSailingsRef.current, sailingsToPersist)
      .then(() => console.log('[CrewRecognition] Manual cloud sailings refresh saved locally'))
      .catch((error) => console.error('[CrewRecognition] Manual cloud sailings refresh failed:', error));
  }, [cloudRefreshEnabled, sailingsQuery.isSuccess, sailingsQuery.data]);

  const refetch = useCallback(() => {
    setCloudRefreshEnabled(true);
    setIsOfflineMode(false);
    setTimeout(() => {
      void statsQuery.refetch();
      void entriesQuery.refetch();
      void sailingsQuery.refetch();
    }, 0);
  }, [statsQuery, entriesQuery, sailingsQuery]);

  return useMemo(() => ({
    userId,
    ownerScopeId,
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
    entries: useLocal ? pagedLocalEntries : backendEntries,
    entriesTotal: useLocal ? filteredLocalEntries.length : backendTotal,
    entriesLoading: !useLocal && entriesQuery.isLoading,
    sailings: useLocal ? localSailings : (sailingsQuery.data || []),
    sailingsLoading: !useLocal && sailingsQuery.isLoading,
    isOfflineMode: useLocal,
    syncFromCSVLocally,
    importFromTextLocally,
    createCrewMember: addCrewMemberWithFallback,
    updateCrewMember: updateCrewMemberScoped,
    deleteCrewMember: deleteCrewMemberWithFallback,
    createRecognitionEntry: createRecognitionEntryScoped,
    updateRecognitionEntry: updateRecognitionEntryWithFallback,
    deleteRecognitionEntry: deleteRecognitionEntryWithFallback,
    createSailing: createSailingScoped,
    clearCrewData,
    ensureLocalDataLoaded,
    refetch,
  }), [
    userId, ownerScopeId, filters, updateFilters, resetFilters, page, pageSize, nextPage, previousPage, goToPage,
    useLocal, localStats, statsQuery.data, statsQuery.isLoading, filteredLocalEntries, pagedLocalEntries, backendEntries, backendTotal,
    entriesQuery.isLoading, localSailings, sailingsQuery.data, sailingsQuery.isLoading,
    syncFromCSVLocally, importFromTextLocally, addCrewMemberWithFallback, updateCrewMemberScoped,
    deleteCrewMemberWithFallback, createRecognitionEntryScoped,
    updateRecognitionEntryWithFallback, deleteRecognitionEntryWithFallback,
    createSailingScoped, clearCrewData, refetch,
    ensureLocalDataLoaded,
  ]);
});
