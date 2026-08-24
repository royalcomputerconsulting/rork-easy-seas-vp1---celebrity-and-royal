import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';

import { usePersonalCertificateOptimizer } from './PersonalCertificateOptimizerProvider';
import {
  generatePersonalOptimizationAlerts,
  personalOptimizationAlertRepository,
  type OptimizationSnapshotBundle,
  type PersonalOptimizationAlert,
} from '@/lib/optimization';

type State = {
  alerts: PersonalOptimizationAlert[];
  activeAlerts: PersonalOptimizationAlert[];
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
};

export const [PersonalOptimizationAlertsProvider, usePersonalOptimizationAlerts] = createContextHook((): State => {
  const optimizer = usePersonalCertificateOptimizer();
  const activeProfileId = optimizer?.activeProfileId ?? null;
  const bundle = optimizer?.bundle ?? null;
  const [alerts, setAlerts] = useState<PersonalOptimizationAlert[]>([]);
  const previous = useRef<OptimizationSnapshotBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAlerts(activeProfileId ? await personalOptimizationAlertRepository.load(activeProfileId) : []);
    } catch (error) {
      console.warn('[PersonalOptimizationAlerts] Failed to load alerts:', error);
      setAlerts([]);
    }
  }, [activeProfileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeProfileId || !bundle) return;
    void (async () => {
      try {
        const existingAlerts = await personalOptimizationAlertRepository.load(activeProfileId);
        const next = generatePersonalOptimizationAlerts({
          previousBundle: previous.current,
          currentBundle: bundle,
          existingAlerts,
        });
        previous.current = bundle;
        if (next.length) {
          setAlerts(await personalOptimizationAlertRepository.append(activeProfileId, next));
        }
      } catch (error) {
        console.warn('[PersonalOptimizationAlerts] Failed to generate alerts:', error);
      }
    })();
  }, [activeProfileId, bundle]);

  const dismiss = useCallback(async (id: string) => {
    if (!activeProfileId) return;
    try {
      setAlerts(await personalOptimizationAlertRepository.dismiss(activeProfileId, id, new Date().toISOString()));
    } catch (error) {
      console.warn('[PersonalOptimizationAlerts] Failed to dismiss alert:', error);
    }
  }, [activeProfileId]);

  const clear = useCallback(async () => {
    if (!activeProfileId) {
      setAlerts([]);
      return;
    }
    try {
      await personalOptimizationAlertRepository.clear(activeProfileId);
      setAlerts([]);
    } catch (error) {
      console.warn('[PersonalOptimizationAlerts] Failed to clear alerts:', error);
    }
  }, [activeProfileId]);

  const activeAlerts = useMemo(() => alerts.filter((alert) => !alert.dismissedAt), [alerts]);

  return {
    alerts,
    activeAlerts,
    dismiss,
    refresh,
    clear,
  };
});
