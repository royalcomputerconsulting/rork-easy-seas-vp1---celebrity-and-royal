import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';

/** Real-world status of an instant certificate sitting in the wallet. */
export type CertificateWalletStatus = 'unused' | 'used' | 'expired' | 'removed';

export interface CertificateWalletOverride {
  status: CertificateWalletStatus;
  appliedToCruiseId?: string;
  updatedAt: string;
}

export interface ChecklistOverride {
  done?: boolean;
  hidden?: boolean;
  snoozedUntil?: string;
}

export type ChecklistPriority = 'low' | 'medium' | 'high';

export interface CustomChecklistTask {
  id: string;
  label: string;
  detail: string;
  dueDate?: string;
  priority: ChecklistPriority;
  done: boolean;
  linkedCruiseId?: string;
  createdAt: string;
}

export interface LastCertificateSearch {
  date: string;
  month: 'thisMonth' | 'nextMonth';
  monthLabel: string;
  certsFound: number;
  matchedCount: number;
  unmatchedCount: number;
  expiringSoonCount: number;
}

interface PersistedShape {
  certificateOverrides: Record<string, CertificateWalletOverride>;
  checklistOverrides: Record<string, ChecklistOverride>;
  customTasks: CustomChecklistTask[];
  lastCertificateSearch: LastCertificateSearch | null;
}

const DEFAULT_STATE: PersistedShape = {
  certificateOverrides: {},
  checklistOverrides: {},
  customTasks: [],
  lastCertificateSearch: null,
};

const BASE_KEY = 'easyseas_casino_benefits_v1';

interface CasinoBenefitsState extends PersistedShape {
  isLoading: boolean;
  setCertificateStatus: (cruiseId: string, status: CertificateWalletStatus) => void;
  applyCertificateToCruise: (certificateCruiseId: string, targetCruiseId: string) => void;
  removeCertificateOverride: (cruiseId: string) => void;
  setChecklistDone: (taskId: string, done: boolean) => void;
  snoozeChecklistTask: (taskId: string, days: number) => void;
  hideChecklistTask: (taskId: string, hidden: boolean) => void;
  addCustomTask: (task: Omit<CustomChecklistTask, 'id' | 'createdAt' | 'done'>) => void;
  updateCustomTask: (id: string, updates: Partial<CustomChecklistTask>) => void;
  deleteCustomTask: (id: string) => void;
  recordCertificateSearch: (result: LastCertificateSearch) => void;
}

/**
 * Stage 9.4 — persistence layer for the Instant Certificate Wallet (status,
 * apply-to-cruise) and the persistent, actionable Today's Checklist (mark
 * complete/snooze/hide + custom tasks), plus the last certificate-search
 * summary shown in Action Center. AsyncStorage-backed like other Casino
 * providers so nothing is lost between sessions.
 */
export const [CasinoBenefitsProvider, useCasinoBenefits] = createContextHook((): CasinoBenefitsState => {
  const { authenticatedEmail } = useAuth();
  const [state, setState] = useState<PersistedShape>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = useMemo(() => getUserScopedKey(BASE_KEY, authenticatedEmail), [authenticatedEmail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const stored = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<PersistedShape>;
          setState({
            certificateOverrides: parsed.certificateOverrides ?? {},
            checklistOverrides: parsed.checklistOverrides ?? {},
            customTasks: parsed.customTasks ?? [],
            lastCertificateSearch: parsed.lastCertificateSearch ?? null,
          });
        } else {
          setState(DEFAULT_STATE);
        }
      } catch (error) {
        console.error('[CasinoBenefitsProvider] Failed to load:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback((next: PersistedShape) => {
    setState(next);
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
      console.error('[CasinoBenefitsProvider] Failed to persist:', error),
    );
  }, [storageKey]);

  const setCertificateStatus = useCallback((cruiseId: string, status: CertificateWalletStatus) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        certificateOverrides: {
          ...prev.certificateOverrides,
          [cruiseId]: { ...prev.certificateOverrides[cruiseId], status, updatedAt: new Date().toISOString() },
        },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist certificate status:', error),
      );
      return next;
    });
  }, [storageKey]);

  const applyCertificateToCruise = useCallback((certificateCruiseId: string, targetCruiseId: string) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        certificateOverrides: {
          ...prev.certificateOverrides,
          [certificateCruiseId]: {
            status: 'used',
            appliedToCruiseId: targetCruiseId,
            updatedAt: new Date().toISOString(),
          },
        },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist applied certificate:', error),
      );
      return next;
    });
  }, [storageKey]);

  const removeCertificateOverride = useCallback((cruiseId: string) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        certificateOverrides: {
          ...prev.certificateOverrides,
          [cruiseId]: { status: 'removed', updatedAt: new Date().toISOString() },
        },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist removed certificate:', error),
      );
      return next;
    });
  }, [storageKey]);

  const setChecklistDone = useCallback((taskId: string, done: boolean) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        checklistOverrides: { ...prev.checklistOverrides, [taskId]: { ...prev.checklistOverrides[taskId], done } },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist checklist done:', error),
      );
      return next;
    });
  }, [storageKey]);

  const snoozeChecklistTask = useCallback((taskId: string, days: number) => {
    setState((prev) => {
      const snoozedUntil = new Date(Date.now() + days * 86400000).toISOString();
      const next: PersistedShape = {
        ...prev,
        checklistOverrides: { ...prev.checklistOverrides, [taskId]: { ...prev.checklistOverrides[taskId], snoozedUntil } },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist snooze:', error),
      );
      return next;
    });
  }, [storageKey]);

  const hideChecklistTask = useCallback((taskId: string, hidden: boolean) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        checklistOverrides: { ...prev.checklistOverrides, [taskId]: { ...prev.checklistOverrides[taskId], hidden } },
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist hide:', error),
      );
      return next;
    });
  }, [storageKey]);

  const addCustomTask = useCallback((task: Omit<CustomChecklistTask, 'id' | 'createdAt' | 'done'>) => {
    setState((prev) => {
      const newTask: CustomChecklistTask = {
        ...task,
        id: `custom-${Date.now()}`,
        done: false,
        createdAt: new Date().toISOString(),
      };
      const next: PersistedShape = { ...prev, customTasks: [...prev.customTasks, newTask] };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist new task:', error),
      );
      return next;
    });
  }, [storageKey]);

  const updateCustomTask = useCallback((id: string, updates: Partial<CustomChecklistTask>) => {
    setState((prev) => {
      const next: PersistedShape = {
        ...prev,
        customTasks: prev.customTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist task update:', error),
      );
      return next;
    });
  }, [storageKey]);

  const deleteCustomTask = useCallback((id: string) => {
    setState((prev) => {
      const next: PersistedShape = { ...prev, customTasks: prev.customTasks.filter((t) => t.id !== id) };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoBenefitsProvider] Failed to persist task delete:', error),
      );
      return next;
    });
  }, [storageKey]);

  const recordCertificateSearch = useCallback((result: LastCertificateSearch) => {
    persist({ ...state, lastCertificateSearch: result });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persist]);

  return useMemo(() => ({
    ...state,
    isLoading,
    setCertificateStatus,
    applyCertificateToCruise,
    removeCertificateOverride,
    setChecklistDone,
    snoozeChecklistTask,
    hideChecklistTask,
    addCustomTask,
    updateCustomTask,
    deleteCustomTask,
    recordCertificateSearch,
  }), [
    state,
    isLoading,
    setCertificateStatus,
    applyCertificateToCruise,
    removeCertificateOverride,
    setChecklistDone,
    snoozeChecklistTask,
    hideChecklistTask,
    addCustomTask,
    updateCustomTask,
    deleteCustomTask,
    recordCertificateSearch,
  ]);
});
