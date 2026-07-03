import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/state/AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { buildOwnerScopeId, getInstallationId } from '@/lib/storage/installationId';
import { getAllShipNames } from '@/constants/shipInfo';

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


function normalizeCrewImportDate(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const iso = value.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const us = value.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (us) {
    const nowYear = new Date().getFullYear();
    const yearRaw = us[3];
    const year = yearRaw ? (yearRaw.length === 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10)) : nowYear;
    return `${year}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return value;
}

function inferCrewDepartment(text: string): Department {
  const lower = text.toLowerCase();
  if (/casino|host|slot/.test(lower)) return 'Casino' as Department;
  if (/bar|bartender|beverage|schooner|lounge/.test(lower)) return 'Beverage' as Department;
  if (/windjammer|waiter|waitress|dining|server|restaurant|cafe|promenade|chef/.test(lower)) return 'Dining' as Department;
  if (/front desk|guest relation|services/.test(lower)) return 'Guest Relations' as Department;
  if (/stateroom|housekeep|attendant|public area|cleaner|washy|sanitation/.test(lower)) return 'Housekeeping' as Department;
  if (/loyalty|diamond|crown/.test(lower)) return 'Loyalty' as Department;
  if (/activity|activities|cruise staff|entertainment/.test(lower)) return 'Activities' as Department;
  if (/spa|hair|salon|barber/.test(lower)) return 'Spa' as Department;
  if (/retail|shop/.test(lower)) return 'Retail' as Department;
  return 'Other' as Department;
}

function parseCrewLine(rawLine: string): { fullName: string; roleTitle?: string; department: Department } | null {
  const line = rawLine.trim().replace(/^[-•*\d.)\s]+/, '').trim();
  if (!line) return null;
  const split = line.split(/\s+[-–—:]\s+|[-–—:]/);
  const fullName = (split[0] || '').trim();
  const roleText = split.slice(1).join(' - ').trim();
  if (!fullName || fullName.length < 2) return null;
  if (/^(ship|sailing|date|department|crew|name)$/i.test(fullName)) return null;
  return {
    fullName,
    roleTitle: roleText || undefined,
    department: inferCrewDepartment(`${roleText} ${line}`),
  };
}


const KNOWN_SHIP_NAMES = getAllShipNames().sort((a, b) => b.length - a.length);

function normalizeShipNameFromText(text: string): string {
  const lower = text.toLowerCase();
  const exact = KNOWN_SHIP_NAMES.find(ship => lower.includes(ship.toLowerCase()));
  if (exact) return exact;
  const cleaned = text.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, '').replace(/\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/g, '').replace(/\bto\b|[-–—]/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned;
}

function looksLikeSailingHeader(rawLine: string): boolean {
  const line = rawLine.trim();
  if (!line) return false;
  const hasShip = KNOWN_SHIP_NAMES.some(ship => line.toLowerCase().includes(ship.toLowerCase())) || /\b(of the seas|ots|cruise)\b/i.test(line);
  const hasDate = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b|\b[A-Z][a-z]+\s+\d{1,2},?\s+20\d{2}\b/i.test(line);
  return hasShip && hasDate;
}

function parseSailingHeader(rawLine: string): { shipName: string; sailStartDate: string; sailEndDate: string } | null {
  const line = rawLine.trim();
  if (!looksLikeSailingHeader(line)) return null;
  const dateMatches = Array.from(line.matchAll(/\b(20\d{2}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|[A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})\b/g)).map(m => m[1]);
  const sailStartDate = normalizeCrewImportDate(dateMatches[0] || '');
  let sailEndDate = dateMatches[1] ? normalizeCrewImportDate(dateMatches[1]) : sailStartDate;
  if (sailStartDate && sailEndDate && sailEndDate < sailStartDate) {
    const startYear = parseInt(sailStartDate.substring(0, 4), 10);
    if (/^\d{1,2}[/-]\d{1,2}$/.test(dateMatches[1] || '')) {
      const [, mm, dd] = (dateMatches[1] || '').match(/^(\d{1,2})[/-](\d{1,2})$/) || [];
      if (mm && dd) sailEndDate = `${startYear + 1}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  let shipName = line;
  for (const dm of dateMatches) shipName = shipName.replace(dm, ' ');
  shipName = normalizeShipNameFromText(shipName).replace(/\s+(to|through|thru)\s*$/i, '').replace(/[,:|]+$/g, '').trim();
  if (!shipName) return null;
  return { shipName, sailStartDate, sailEndDate };
}

function sanitizeCrewEntries(entries: RecognitionEntryWithCrew[]): RecognitionEntryWithCrew[] {
  return entries.filter(entry => {
    const name = String(entry.fullName || '').trim();
    if (!name) return false;
    if (looksLikeSailingHeader(name)) return false;
    if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(name)) return false;
    return true;
  });
}

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
  const [pageSize] = useState(2500); // v1001: keep all crew entries available for filters/survey/export
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
          const parsedEntries = sanitizeCrewEntries(JSON.parse(storedEntries));
          setLocalEntries(parsedEntries);
          if (parsedEntries.length !== JSON.parse(storedEntries).length) {
            void AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(parsedEntries));
            console.log('[CrewRecognition] Cleaned sailing-header rows that were accidentally imported as crew names');
          }
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
          setLocalEntries(storedEntries ? sanitizeCrewEntries(JSON.parse(storedEntries)) : []);
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
    { userId, ownerScopeId: ownerScopeId || '' },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: !!auth.authenticatedEmail && !!ownerScopeId,
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
      enabled: !!auth.authenticatedEmail && !!ownerScopeId,
      retry: 1,
      retryDelay: 2000,
    }
  );

  const sailingsQuery = trpc.crewRecognition.getSailings.useQuery(
    { userId, ownerScopeId: ownerScopeId || '' },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      enabled: !!auth.authenticatedEmail && !!ownerScopeId,
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
    sailingSnapshot?: Sailing;
    userId: string;
  }) => {
    const now = new Date().toISOString();
    const crewId = `local_crew_manual_${Date.now()}`;
    const sailing = data.sailingId ? (localSailings.find(s => s.id === data.sailingId) || data.sailingSnapshot) : undefined;

    let nextLocalSailings = localSailings;
    if (sailing && !localSailings.some(s => s.id === sailing.id)) {
      nextLocalSailings = [sailing, ...localSailings];
      setLocalSailings(nextLocalSailings);
      await AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(nextLocalSailings));
    }

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
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
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
    const updatedEntries = localEntries.filter(e => e.id !== data.id && e.userId === userId);
    setLocalEntries(updatedEntries);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
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
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
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
    const updatedEntries = localEntries.filter(e => !(e.crewMemberId === data.id && e.userId === userId));
    setLocalEntries(updatedEntries);
    await AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries));
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

  const importFromTextLocally = useCallback(async (text: string): Promise<{ importedCount: number; skippedCount: number; shipName: string; sailDate: string }> => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('Please provide at least 2 lines: a ship + date line, then crew names. You can paste multiple sailing sections at once.');
    }

    type ImportSection = { shipName: string; sailStartDate: string; sailEndDate: string; crewLines: string[] };
    const sections: ImportSection[] = [];
    let current: ImportSection | null = null;

    for (const line of lines) {
      const header = parseSailingHeader(line);
      if (header) {
        current = { ...header, crewLines: [] };
        sections.push(current);
        continue;
      }
      if (!current) {
        throw new Error(`Could not find a sailing header before this crew line: "${line}". Start each pasted list with something like "Quantum of the Seas 6/19".`);
      }
      current.crewLines.push(line);
    }

    if (sections.length === 0) {
      throw new Error('Could not detect any ship/date sailing headers. Use a header like "Quantum of the Seas 6/19" above the crew names.');
    }

    const now = new Date().toISOString();
    const workingSailings = [...localSailings];
    const existingKeys = new Set(
      sanitizeCrewEntries(localEntries).map(e => `${(e.shipName || '').toLowerCase()}__${e.sailStartDate || ''}__${e.fullName.toLowerCase().trim()}__${(e.roleTitle || '').toLowerCase()}__${e.department.toLowerCase()}`)
    );
    const newEntries: RecognitionEntryWithCrew[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let firstShipName = sections[0]?.shipName || '';
    let firstSailDate = sections[0]?.sailStartDate || '';

    for (const section of sections) {
      if (section.crewLines.length === 0) continue;
      let sailing = workingSailings.find(
        s => s.shipName.toLowerCase() === section.shipName.toLowerCase() &&
          (section.sailStartDate ? s.sailStartDate === section.sailStartDate : true)
      );
      if (!sailing) {
        sailing = {
          id: `local_sailing_text_${Date.now()}_${workingSailings.length}`,
          shipName: section.shipName,
          sailStartDate: section.sailStartDate,
          sailEndDate: section.sailEndDate || section.sailStartDate,
          userId,
          createdAt: now,
          updatedAt: now,
        };
        workingSailings.push(sailing);
      }

      for (const rawCrewLine of section.crewLines) {
        if (looksLikeSailingHeader(rawCrewLine)) {
          skippedCount++;
          continue;
        }
        const parsedCrew = parseCrewLine(rawCrewLine);
        if (!parsedCrew) {
          skippedCount++;
          continue;
        }
        const normalizedName = parsedCrew.fullName.trim();
        const duplicateKey = `${section.shipName.toLowerCase()}__${section.sailStartDate || ''}__${normalizedName.toLowerCase()}__${(parsedCrew.roleTitle || '').toLowerCase()}__${parsedCrew.department.toLowerCase()}`;
        if (existingKeys.has(duplicateKey)) {
          skippedCount++;
          console.log('[CrewRecognition] Skipping duplicate crew member for sailing:', normalizedName, section.shipName, section.sailStartDate);
          continue;
        }
        const crewId = `local_crew_text_${Date.now()}_${importedCount}`;
        newEntries.push({
          id: `local_entry_text_${Date.now()}_${importedCount}`,
          crewMemberId: crewId,
          sailingId: sailing.id,
          shipName: section.shipName,
          sailStartDate: section.sailStartDate,
          sailEndDate: section.sailEndDate || section.sailStartDate,
          sailingMonth: section.sailStartDate ? section.sailStartDate.substring(0, 7) : '',
          sailingYear: section.sailStartDate ? parseInt(section.sailStartDate.substring(0, 4), 10) || 0 : 0,
          department: parsedCrew.department,
          roleTitle: parsedCrew.roleTitle,
          sourceText: rawCrewLine.trim(),
          userId,
          createdAt: now,
          updatedAt: now,
          fullName: normalizedName,
        });
        existingKeys.add(duplicateKey);
        importedCount++;
      }
    }

    const cleanedExistingEntries = sanitizeCrewEntries(localEntries);
    const updatedEntries = [...newEntries, ...cleanedExistingEntries];
    setLocalEntries(updatedEntries);
    setLocalSailings(workingSailings);
    setIsOfflineMode(true);
    await Promise.all([
      AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(updatedEntries)),
      AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(workingSailings)),
    ]);

    console.log('[CrewRecognition] Text import complete. Sections:', sections.length, 'Imported:', importedCount, 'Skipped:', skippedCount);
    return { importedCount, skippedCount, shipName: sections.length === 1 ? firstShipName : `${sections.length} sailings`, sailDate: sections.length === 1 ? firstSailDate : `${sections.length} ship/date sections` };
  }, [localEntries, localSailings, userId]);

  const syncFromCSVLocally = useCallback(async () => {
    console.log('[CrewRecognition] Parsing CSV locally...');
    const { entries: parsedEntries, sailings: parsedSailings } = parseCSVToEntries(CREW_RECOGNITION_CSV);
    console.log('[CrewRecognition] Parsed', parsedEntries.length, 'entries,', parsedSailings.length, 'sailings');

    setLocalEntries(parsedEntries);
    setLocalSailings(parsedSailings);
    setIsOfflineMode(true);

    await Promise.all([
      AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(parsedEntries)),
      AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(parsedSailings)),
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
  const backendEntries = useMemo(() => {
    const raw = entriesQuery.data?.entries || [];
    return [...raw].sort((a, b) => (b.sailStartDate || '').localeCompare(a.sailStartDate || ''));
  }, [entriesQuery.data?.entries]);
  const backendTotal = entriesQuery.data?.total || 0;

  useEffect(() => {
    if (!isOfflineMode && entriesQuery.isSuccess && entriesQuery.data?.entries) {
      const backendEntriesPage = entriesQuery.data.entries;
      if (backendEntriesPage.length > 0) {
        AsyncStorage.getItem(skEntriesRef.current)
          .then(stored => {
            const existingLocal: RecognitionEntryWithCrew[] = stored ? JSON.parse(stored) : [];
            const backendIds = new Set(backendEntriesPage.map(e => e.id));
            const localOnlyEntries = existingLocal.filter(e => !backendIds.has(e.id) && e.id.startsWith('local_'));
            const merged = [...backendEntriesPage, ...localOnlyEntries];
            return AsyncStorage.setItem(skEntriesRef.current, JSON.stringify(merged))
              .then(() => console.log('[CrewRecognition] Synced', backendEntriesPage.length, 'backend +', localOnlyEntries.length, 'local-only entries to AsyncStorage'));
          })
          .catch(e => console.error('[CrewRecognition] Error syncing backend entries to AsyncStorage:', e));
      }
    }
  }, [isOfflineMode, entriesQuery.isSuccess, entriesQuery.data?.entries]);

  useEffect(() => {
    if (!isOfflineMode && sailingsQuery.isSuccess && sailingsQuery.data) {
      const sailingsToPersist = sailingsQuery.data;
      if (Array.isArray(sailingsToPersist) && sailingsToPersist.length > 0) {
        AsyncStorage.setItem(skSailingsRef.current, JSON.stringify(sailingsToPersist))
          .then(() => console.log('[CrewRecognition] Synced', sailingsToPersist.length, 'backend sailings to AsyncStorage for export'))
          .catch(e => console.error('[CrewRecognition] Error syncing backend sailings to AsyncStorage:', e));
      }
    }
  }, [isOfflineMode, sailingsQuery.isSuccess, sailingsQuery.data]);

  const refetch = useCallback(() => {
    void statsQuery.refetch();
    void entriesQuery.refetch();
    void sailingsQuery.refetch();
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
    entries: useLocal ? filteredLocalEntries : backendEntries,
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
    refetch,
  }), [
    userId, ownerScopeId, filters, updateFilters, resetFilters, page, pageSize, nextPage, previousPage, goToPage,
    useLocal, localStats, statsQuery.data, statsQuery.isLoading, filteredLocalEntries, backendEntries, backendTotal,
    entriesQuery.isLoading, localSailings, sailingsQuery.data, sailingsQuery.isLoading,
    syncFromCSVLocally, importFromTextLocally, addCrewMemberWithFallback, updateCrewMemberScoped,
    deleteCrewMemberWithFallback, createRecognitionEntryScoped,
    updateRecognitionEntryWithFallback, deleteRecognitionEntryWithFallback,
    createSailingScoped, clearCrewData, refetch,
  ]);
});
