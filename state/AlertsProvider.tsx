import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { 
  Alert, 
  AlertRule, 
  Anomaly, 
  PatternInsight,
  AnomalyType,
  AnomalyDetectionConfig,
} from '@/types/models';
import { DEFAULT_ANOMALY_CONFIG } from '@/types/models';
import { useCruiseStore } from './CruiseStore';
import { useAppState } from './AppStateProvider';
import { usePriceHistory } from './PriceHistoryProvider';
import { 
  runFullAnomalyDetection, 
  type AnomalyDetectionResult 
} from '@/lib/anomalyDetection';
import { 
  DEFAULT_ALERT_RULES,
  processAnomaliesWithRules,
  filterActiveAlerts,
  sortAlertsByPriority,
  snoozeAlert as snoozeAlertFn,
  resolveAlert as resolveAlertFn,
  getAlertSummary,
  type AlertSummary,
} from '@/lib/alertRules';
import { useEntitlement } from './EntitlementProvider';

const ALERTS_STORAGE_KEY = '@easy_seas_alerts';
const RULES_STORAGE_KEY = '@easy_seas_alert_rules';
const DISMISSED_IDS_KEY = '@easy_seas_dismissed_alerts';
const DISMISSED_ENTITIES_KEY = '@easy_seas_dismissed_entities';

interface AlertsState {
  alerts: Alert[];
  rules: AlertRule[];
  anomalies: Anomaly[];
  insights: PatternInsight[];
  config: AnomalyDetectionConfig;
  isLoading: boolean;
  lastDetectionRun: string | null;
  
  summary: AlertSummary;
  activeAlerts: Alert[];
  criticalAlerts: Alert[];
  priceDropCount: number;
  
  runDetection: () => void;
  dismissAlert: (alertId: string) => void;
  snoozeAlert: (alertId: string, minutes: number) => void;
  resolveAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  toggleRule: (ruleId: string) => void;
  updateConfig: (newConfig: Partial<AnomalyDetectionConfig>) => void;
  getAlertsByType: (type: AnomalyType) => Alert[];
  getPriceDropAlerts: () => Alert[];
}

export const [AlertsProvider, useAlerts] = createContextHook((): AlertsState => {
  const { tier } = useEntitlement();
  const { bookedCruises, casinoOffers } = useCruiseStore();
  const { clubRoyaleProfile } = useAppState();
  const { priceDropAlerts } = usePriceHistory();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [config, setConfig] = useState<AnomalyDetectionConfig>(DEFAULT_ANOMALY_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [lastDetectionRun, setLastDetectionRun] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissedEntities, setDismissedEntities] = useState<Set<string>>(new Set());
  const alertsRef = useRef<Alert[]>(alerts);
  alertsRef.current = alerts;

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [storedAlerts, storedRules, storedDismissed] = await Promise.all([
          AsyncStorage.getItem(ALERTS_STORAGE_KEY),
          AsyncStorage.getItem(RULES_STORAGE_KEY),
          AsyncStorage.getItem(DISMISSED_IDS_KEY),
        ]);

        if (storedAlerts) {
          const parsed = JSON.parse(storedAlerts);
          setAlerts(parsed);
          console.log('[AlertsProvider] Loaded stored alerts:', parsed.length);
        }

        if (storedRules) {
          const parsed = JSON.parse(storedRules);
          setRules(parsed);
          console.log('[AlertsProvider] Loaded stored rules:', parsed.length);
        }

        if (storedDismissed) {
          const parsed = JSON.parse(storedDismissed);
          setDismissedIds(new Set(parsed));
          console.log('[AlertsProvider] Loaded dismissed IDs:', parsed.length);
        }

        const storedDismissedEntities = await AsyncStorage.getItem(DISMISSED_ENTITIES_KEY);
        if (storedDismissedEntities) {
          const parsed = JSON.parse(storedDismissedEntities);
          setDismissedEntities(new Set(parsed));
          console.log('[AlertsProvider] Loaded dismissed entities:', parsed.length);
        }
      } catch (error) {
        console.error('[AlertsProvider] Error loading stored data:', error);
      }
    };

    loadStoredData();
  }, []);

  useEffect(() => {
    const saveAlerts = async () => {
      try {
        await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
      } catch (error) {
        console.error('[AlertsProvider] Error saving alerts:', error);
      }
    };

    if (alerts.length > 0) {
      saveAlerts();
    }
  }, [alerts]);

  useEffect(() => {
    const saveRules = async () => {
      try {
        await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
      } catch (error) {
        console.error('[AlertsProvider] Error saving rules:', error);
      }
    };

    saveRules();
  }, [rules]);

  useEffect(() => {
    const saveDismissed = async () => {
      try {
        await AsyncStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify([...dismissedIds]));
      } catch (error) {
        console.error('[AlertsProvider] Error saving dismissed IDs:', error);
      }
    };

    saveDismissed();
  }, [dismissedIds]);

  useEffect(() => {
    const saveDismissedEntities = async () => {
      try {
        await AsyncStorage.setItem(DISMISSED_ENTITIES_KEY, JSON.stringify([...dismissedEntities]));
      } catch (error) {
        console.error('[AlertsProvider] Error saving dismissed entities:', error);
      }
    };

    saveDismissedEntities();
  }, [dismissedEntities]);

  const runDetection = useCallback(() => {
    if (tier !== 'pro') {
      console.log('[AlertsProvider] Alerts are Pro-only. Tier:', tier);
      return;
    }
    
    setIsLoading(true);
    console.log('[AlertsProvider] Running anomaly detection...');

    try {
      const currentPoints = clubRoyaleProfile?.tierPoints || 26331;
      
      const result: AnomalyDetectionResult = runFullAnomalyDetection(
        bookedCruises,
        casinoOffers,
        currentPoints,
        config,
        priceDropAlerts
      );

      setAnomalies(result.anomalies);
      setInsights(result.insights);

      const newAlerts = processAnomaliesWithRules(
        result.anomalies,
        rules,
        alertsRef.current
      );

      const filteredNewAlerts = newAlerts.filter(a => {
        if (dismissedIds.has(a.id)) return false;
        const entityKey = `${a.type}_${a.relatedEntityId || 'global'}`;
        if (dismissedEntities.has(entityKey)) return false;
        return true;
      });

      if (filteredNewAlerts.length > 0) {
        setAlerts(prev => [...prev, ...filteredNewAlerts]);
      }

      setLastDetectionRun(new Date().toISOString());
      console.log('[AlertsProvider] Detection complete:', {
        anomalies: result.anomalies.length,
        insights: result.insights.length,
        newAlerts: filteredNewAlerts.length,
      });
    } catch (error) {
      console.error('[AlertsProvider] Detection error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tier, bookedCruises, casinoOffers, clubRoyaleProfile, config, rules, dismissedIds, dismissedEntities, priceDropAlerts]);

  useEffect(() => {
    if (bookedCruises.length > 0 || casinoOffers.length > 0) {
      const timeout = setTimeout(() => {
        runDetection();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedCruises.length, casinoOffers.length]);

  const dismissAlert = useCallback((alertId: string) => {
    const alertToRemove = alerts.find(a => a.id === alertId);
    if (alertToRemove) {
      const entityKey = `${alertToRemove.type}_${alertToRemove.relatedEntityId || 'global'}`;
      setDismissedEntities(prev => new Set([...prev, entityKey]));
    }
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setDismissedIds(prev => new Set([...prev, alertId]));
    console.log('[AlertsProvider] Dismissed and removed alert:', alertId);
  }, [alerts]);

  const snoozeAlert = useCallback((alertId: string, minutes: number) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? snoozeAlertFn(a, minutes) : a
    ));
    console.log('[AlertsProvider] Snoozed alert:', alertId, 'for', minutes, 'minutes');
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? resolveAlertFn(a) : a
    ));
    console.log('[AlertsProvider] Resolved alert:', alertId);
  }, []);

  const clearAllAlerts = useCallback(async () => {
    const allIds = alerts.map(a => a.id);
    const allEntityKeys = alerts.map(a => `${a.type}_${a.relatedEntityId || 'global'}`);
    
    setAlerts([]);
    setDismissedIds(new Set(allIds));
    setDismissedEntities(prev => new Set([...prev, ...allEntityKeys]));
    
    try {
      await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify([]));
      console.log('[AlertsProvider] Cleared all alerts from storage');
    } catch (error) {
      console.error('[AlertsProvider] Error clearing alerts from storage:', error);
    }
    
    console.log('[AlertsProvider] Cleared all alerts:', allIds.length);
  }, [alerts]);

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
    console.log('[AlertsProvider] Toggled rule:', ruleId);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AnomalyDetectionConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('[AlertsProvider] Updated config:', newConfig);
  }, []);

  const getAlertsByType = useCallback((type: AnomalyType): Alert[] => {
    return alerts.filter(a => a.type === type);
  }, [alerts]);

  const getPriceDropAlerts = useCallback((): Alert[] => {
    return filterActiveAlerts(alerts).filter(a => a.type === 'price_drop');
  }, [alerts]);

  const activeAlerts = useMemo(() => 
    sortAlertsByPriority(filterActiveAlerts(alerts)),
    [alerts]
  );

  const criticalAlerts = useMemo(() => 
    activeAlerts.filter(a => a.priority === 'critical'),
    [activeAlerts]
  );

  const priceDropCount = useMemo(() => 
    activeAlerts.filter(a => a.type === 'price_drop').length,
    [activeAlerts]
  );

  const summary = useMemo(() => 
    getAlertSummary(alerts),
    [alerts]
  );

  return {
    alerts,
    rules,
    anomalies,
    insights,
    config,
    isLoading,
    lastDetectionRun,
    summary,
    activeAlerts,
    criticalAlerts,
    priceDropCount,
    runDetection,
    dismissAlert,
    snoozeAlert,
    resolveAlert,
    clearAllAlerts,
    toggleRule,
    updateConfig,
    getAlertsByType,
    getPriceDropAlerts,
  };
});
