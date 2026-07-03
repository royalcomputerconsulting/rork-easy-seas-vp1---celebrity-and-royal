import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MachineConditionLog, MachineLogDecision } from '@/types/models';
import { useAuth } from '@/state/AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';

const BASE_STORAGE_KEY = 'easyseas_machine_condition_logs_v1';

interface MachineConditionLogFilters {
  shipName?: string;
  machineName?: string;
  date?: string;
  decision?: MachineLogDecision | 'all';
}

interface MachineConditionLogState {
  logs: MachineConditionLog[];
  isLoading: boolean;
  addLog: (input: Omit<MachineConditionLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MachineConditionLog>;
  updateLog: (id: string, updates: Partial<MachineConditionLog>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  getFilteredLogs: (filters: MachineConditionLogFilters) => MachineConditionLog[];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export const [MachineConditionLogProvider, useMachineConditionLogs] = createContextHook((): MachineConditionLogState => {
  const { authenticatedEmail } = useAuth();
  const storageKeyRef = useRef<string>(getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail));
  const [logs, setLogs] = useState<MachineConditionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail);
    console.log('[MachineConditionLogs] Storage key updated', { authenticatedEmail });
  }, [authenticatedEmail]);

  const persistLogs = useCallback(async (nextLogs: MachineConditionLog[]) => {
    try {
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(nextLogs));
      console.log('[MachineConditionLogs] Persisted logs:', nextLogs.length);
    } catch (error) {
      console.error('[MachineConditionLogs] Failed to persist logs:', error);
      throw error;
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(storageKeyRef.current);
      const parsedLogs = stored ? JSON.parse(stored) as MachineConditionLog[] : [];
      setLogs(Array.isArray(parsedLogs) ? parsedLogs : []);
      console.log('[MachineConditionLogs] Loaded logs:', Array.isArray(parsedLogs) ? parsedLogs.length : 0);
    } catch (error) {
      console.error('[MachineConditionLogs] Failed to load logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, authenticatedEmail]);

  const addLog = useCallback(async (input: Omit<MachineConditionLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<MachineConditionLog> => {
    const now = new Date().toISOString();
    const newLog: MachineConditionLog = {
      ...input,
      id: `machine-log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    const nextLogs = [newLog, ...logs];
    setLogs(nextLogs);
    await persistLogs(nextLogs);
    console.log('[MachineConditionLogs] Added log:', { id: newLog.id, machineName: newLog.machineName, decision: newLog.decision });
    return newLog;
  }, [logs, persistLogs]);

  const updateLog = useCallback(async (id: string, updates: Partial<MachineConditionLog>) => {
    const nextLogs = logs.map((log) => log.id === id ? { ...log, ...updates, updatedAt: new Date().toISOString() } : log);
    setLogs(nextLogs);
    await persistLogs(nextLogs);
    console.log('[MachineConditionLogs] Updated log:', { id, updates: Object.keys(updates) });
  }, [logs, persistLogs]);

  const deleteLog = useCallback(async (id: string) => {
    const nextLogs = logs.filter((log) => log.id !== id);
    setLogs(nextLogs);
    await persistLogs(nextLogs);
    console.log('[MachineConditionLogs] Deleted log:', id);
  }, [logs, persistLogs]);

  const getFilteredLogs = useCallback((filters: MachineConditionLogFilters): MachineConditionLog[] => {
    const filtered = logs.filter((log) => {
      const shipMatches = !filters.shipName || normalizeText(log.shipName).includes(normalizeText(filters.shipName));
      const machineMatches = !filters.machineName || normalizeText(log.machineName).includes(normalizeText(filters.machineName));
      const dateMatches = !filters.date || log.timeObserved.startsWith(filters.date);
      const decisionMatches = !filters.decision || filters.decision === 'all' || log.decision === filters.decision;
      return shipMatches && machineMatches && dateMatches && decisionMatches;
    });
    console.log('[MachineConditionLogs] Filtered logs:', { filters, count: filtered.length });
    return filtered;
  }, [logs]);

  return useMemo(() => ({
    logs,
    isLoading,
    addLog,
    updateLog,
    deleteLog,
    getFilteredLogs,
  }), [logs, isLoading, addLog, updateLog, deleteLog, getFilteredLogs]);
});
