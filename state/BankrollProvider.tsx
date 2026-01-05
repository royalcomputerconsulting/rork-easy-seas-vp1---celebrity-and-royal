import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCasinoSessions } from './CasinoSessionProvider';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface BankrollLimit {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'session';
  amount: number;
  enabled: boolean;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

export interface BankrollAlert {
  id: string;
  limitId: string;
  limitType: 'daily' | 'weekly' | 'monthly' | 'session';
  level: AlertLevel;
  message: string;
  currentAmount: number;
  limitAmount: number;
  percentUsed: number;
  timestamp: string;
}

export interface SessionBankroll {
  startingAmount: number;
  currentAmount: number;
  winGoal?: number;
  lossLimit?: number;
}

export interface BankrollStats {
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  dailyRemaining: number;
  weeklyRemaining: number;
  monthlyRemaining: number;
}

interface BankrollState {
  limits: BankrollLimit[];
  alerts: BankrollAlert[];
  sessionBankroll: SessionBankroll | null;
  isLoading: boolean;
  
  setLimit: (limitType: 'daily' | 'weekly' | 'monthly', amount: number) => Promise<void>;
  updateLimit: (limitId: string, updates: Partial<BankrollLimit>) => Promise<void>;
  toggleLimit: (limitId: string, enabled: boolean) => Promise<void>;
  
  startSessionBankroll: (startingAmount: number, winGoal?: number, lossLimit?: number) => void;
  updateSessionBankroll: (currentAmount: number) => void;
  endSessionBankroll: () => void;
  
  getBankrollStats: () => BankrollStats;
  checkAndTriggerAlerts: () => BankrollAlert[];
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  
  resetPeriod: (period: 'daily' | 'weekly' | 'monthly') => Promise<void>;
}

const STORAGE_KEY = 'easyseas_bankroll';
const ALERTS_STORAGE_KEY = 'easyseas_bankroll_alerts';

const DEFAULT_LIMITS: Omit<BankrollLimit, 'id'>[] = [
  {
    type: 'daily',
    amount: 500,
    enabled: true,
    alertThresholds: { warning: 75, critical: 90 },
  },
  {
    type: 'weekly',
    amount: 2000,
    enabled: true,
    alertThresholds: { warning: 75, critical: 90 },
  },
  {
    type: 'monthly',
    amount: 5000,
    enabled: true,
    alertThresholds: { warning: 75, critical: 90 },
  },
];

function getStartOfPeriod(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  const start = new Date(now);
  
  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'weekly') {
    const day = start.getDay();
    const diff = start.getDate() - day;
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  
  return start;
}

export const [BankrollProvider, useBankroll] = createContextHook((): BankrollState => {
  const [limits, setLimits] = useState<BankrollLimit[]>([]);
  const [alerts, setAlerts] = useState<BankrollAlert[]>([]);
  const [sessionBankroll, setSessionBankroll] = useState<SessionBankroll | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { sessions } = useCasinoSessions();

  const persistLimits = useCallback(async (newLimits: BankrollLimit[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newLimits));
      console.log('[BankrollProvider] Persisted limits:', newLimits.length);
    } catch (error) {
      console.error('[BankrollProvider] Failed to persist limits:', error);
    }
  }, []);

  const persistAlerts = useCallback(async (newAlerts: BankrollAlert[]) => {
    try {
      await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(newAlerts));
      console.log('[BankrollProvider] Persisted alerts:', newAlerts.length);
    } catch (error) {
      console.error('[BankrollProvider] Failed to persist alerts:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [storedLimits, storedAlerts] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(ALERTS_STORAGE_KEY),
      ]);
      
      if (storedLimits) {
        const parsed = JSON.parse(storedLimits) as BankrollLimit[];
        setLimits(parsed);
        console.log('[BankrollProvider] Loaded limits:', parsed.length);
      } else {
        const defaultLimits = DEFAULT_LIMITS.map((limit, index) => ({
          ...limit,
          id: `limit_${Date.now()}_${index}`,
        }));
        setLimits(defaultLimits);
        await persistLimits(defaultLimits);
      }
      
      if (storedAlerts) {
        const parsed = JSON.parse(storedAlerts) as BankrollAlert[];
        setAlerts(parsed);
        console.log('[BankrollProvider] Loaded alerts:', parsed.length);
      }
    } catch (error) {
      console.error('[BankrollProvider] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [persistLimits]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setLimit = useCallback(async (
    limitType: 'daily' | 'weekly' | 'monthly',
    amount: number
  ) => {
    const existingLimit = limits.find(l => l.type === limitType);
    
    if (existingLimit) {
      const updatedLimits = limits.map(l =>
        l.type === limitType ? { ...l, amount } : l
      );
      setLimits(updatedLimits);
      await persistLimits(updatedLimits);
    } else {
      const newLimit: BankrollLimit = {
        id: `limit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: limitType,
        amount,
        enabled: true,
        alertThresholds: { warning: 75, critical: 90 },
      };
      const updatedLimits = [...limits, newLimit];
      setLimits(updatedLimits);
      await persistLimits(updatedLimits);
    }
    
    console.log('[BankrollProvider] Set limit:', limitType, amount);
  }, [limits, persistLimits]);

  const updateLimit = useCallback(async (
    limitId: string,
    updates: Partial<BankrollLimit>
  ) => {
    const updatedLimits = limits.map(l =>
      l.id === limitId ? { ...l, ...updates } : l
    );
    setLimits(updatedLimits);
    await persistLimits(updatedLimits);
    console.log('[BankrollProvider] Updated limit:', limitId);
  }, [limits, persistLimits]);

  const toggleLimit = useCallback(async (limitId: string, enabled: boolean) => {
    const updatedLimits = limits.map(l =>
      l.id === limitId ? { ...l, enabled } : l
    );
    setLimits(updatedLimits);
    await persistLimits(updatedLimits);
    console.log('[BankrollProvider] Toggled limit:', limitId, enabled);
  }, [limits, persistLimits]);

  const getSpentInPeriod = useCallback((period: 'daily' | 'weekly' | 'monthly'): number => {
    const startDate = getStartOfPeriod(period);
    
    const relevantSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= startDate;
    });
    
    const totalLoss = relevantSessions.reduce((sum, s) => {
      const loss = (s.winLoss || 0) < 0 ? Math.abs(s.winLoss || 0) : 0;
      return sum + loss;
    }, 0);
    
    return totalLoss;
  }, [sessions]);

  const getBankrollStats = useCallback((): BankrollStats => {
    const dailyLimit = limits.find(l => l.type === 'daily' && l.enabled)?.amount || 0;
    const weeklyLimit = limits.find(l => l.type === 'weekly' && l.enabled)?.amount || 0;
    const monthlyLimit = limits.find(l => l.type === 'monthly' && l.enabled)?.amount || 0;
    
    const dailySpent = getSpentInPeriod('daily');
    const weeklySpent = getSpentInPeriod('weekly');
    const monthlySpent = getSpentInPeriod('monthly');
    
    return {
      dailySpent,
      weeklySpent,
      monthlySpent,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      dailyRemaining: Math.max(0, dailyLimit - dailySpent),
      weeklyRemaining: Math.max(0, weeklyLimit - weeklySpent),
      monthlyRemaining: Math.max(0, monthlyLimit - monthlySpent),
    };
  }, [limits, getSpentInPeriod]);

  const checkAndTriggerAlerts = useCallback((): BankrollAlert[] => {
    const stats = getBankrollStats();
    const newAlerts: BankrollAlert[] = [];
    
    const checkLimit = (
      limit: BankrollLimit,
      spent: number,
      periodName: string
    ) => {
      if (!limit.enabled) return;
      
      const percentUsed = (spent / limit.amount) * 100;
      
      if (percentUsed >= limit.alertThresholds.critical) {
        const existingAlert = alerts.find(
          a => a.limitId === limit.id && a.level === 'critical'
        );
        
        if (!existingAlert) {
          const alert: BankrollAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            limitId: limit.id,
            limitType: limit.type,
            level: 'critical',
            message: `CRITICAL: ${percentUsed.toFixed(0)}% of ${periodName} bankroll limit used ($${spent.toFixed(0)} of $${limit.amount})`,
            currentAmount: spent,
            limitAmount: limit.amount,
            percentUsed,
            timestamp: new Date().toISOString(),
          };
          newAlerts.push(alert);
        }
      } else if (percentUsed >= limit.alertThresholds.warning) {
        const existingAlert = alerts.find(
          a => a.limitId === limit.id && a.level === 'warning'
        );
        
        if (!existingAlert) {
          const alert: BankrollAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            limitId: limit.id,
            limitType: limit.type,
            level: 'warning',
            message: `Warning: ${percentUsed.toFixed(0)}% of ${periodName} bankroll limit used ($${spent.toFixed(0)} of $${limit.amount})`,
            currentAmount: spent,
            limitAmount: limit.amount,
            percentUsed,
            timestamp: new Date().toISOString(),
          };
          newAlerts.push(alert);
        }
      }
    };
    
    limits.forEach(limit => {
      if (limit.type === 'daily') {
        checkLimit(limit, stats.dailySpent, 'daily');
      } else if (limit.type === 'weekly') {
        checkLimit(limit, stats.weeklySpent, 'weekly');
      } else if (limit.type === 'monthly') {
        checkLimit(limit, stats.monthlySpent, 'monthly');
      }
    });
    
    if (sessionBankroll) {
      const sessionLoss = sessionBankroll.startingAmount - sessionBankroll.currentAmount;
      
      if (sessionBankroll.lossLimit && sessionLoss >= sessionBankroll.lossLimit) {
        const alert: BankrollAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          limitId: 'session',
          limitType: 'session',
          level: 'critical',
          message: `CRITICAL: Session loss limit reached! Lost $${sessionLoss.toFixed(0)} of $${sessionBankroll.lossLimit} limit`,
          currentAmount: sessionLoss,
          limitAmount: sessionBankroll.lossLimit,
          percentUsed: (sessionLoss / sessionBankroll.lossLimit) * 100,
          timestamp: new Date().toISOString(),
        };
        newAlerts.push(alert);
      }
      
      if (sessionBankroll.winGoal && sessionBankroll.currentAmount >= sessionBankroll.startingAmount + sessionBankroll.winGoal) {
        const winAmount = sessionBankroll.currentAmount - sessionBankroll.startingAmount;
        const alert: BankrollAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          limitId: 'session_win',
          limitType: 'session',
          level: 'info',
          message: `🎉 Win goal achieved! You're up $${winAmount.toFixed(0)}. Consider cashing out!`,
          currentAmount: winAmount,
          limitAmount: sessionBankroll.winGoal,
          percentUsed: (winAmount / sessionBankroll.winGoal) * 100,
          timestamp: new Date().toISOString(),
        };
        newAlerts.push(alert);
      }
    }
    
    if (newAlerts.length > 0) {
      const updatedAlerts = [...alerts, ...newAlerts];
      setAlerts(updatedAlerts);
      persistAlerts(updatedAlerts);
      console.log('[BankrollProvider] Triggered', newAlerts.length, 'new alerts');
    }
    
    return newAlerts;
  }, [limits, alerts, sessionBankroll, getBankrollStats, persistAlerts]);

  const dismissAlert = useCallback((alertId: string) => {
    const updatedAlerts = alerts.filter(a => a.id !== alertId);
    setAlerts(updatedAlerts);
    persistAlerts(updatedAlerts);
    console.log('[BankrollProvider] Dismissed alert:', alertId);
  }, [alerts, persistAlerts]);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    persistAlerts([]);
    console.log('[BankrollProvider] Cleared all alerts');
  }, [persistAlerts]);

  const startSessionBankroll = useCallback((
    startingAmount: number,
    winGoal?: number,
    lossLimit?: number
  ) => {
    setSessionBankroll({
      startingAmount,
      currentAmount: startingAmount,
      winGoal,
      lossLimit,
    });
    console.log('[BankrollProvider] Started session bankroll:', startingAmount);
  }, []);

  const updateSessionBankroll = useCallback((currentAmount: number) => {
    if (sessionBankroll) {
      setSessionBankroll({
        ...sessionBankroll,
        currentAmount,
      });
    }
  }, [sessionBankroll]);

  const endSessionBankroll = useCallback(() => {
    setSessionBankroll(null);
    console.log('[BankrollProvider] Ended session bankroll');
  }, []);

  const resetPeriod = useCallback(async (period: 'daily' | 'weekly' | 'monthly') => {
    const relevantAlerts = alerts.filter(a => a.limitType !== period);
    setAlerts(relevantAlerts);
    await persistAlerts(relevantAlerts);
    console.log('[BankrollProvider] Reset period:', period);
  }, [alerts, persistAlerts]);

  return {
    limits,
    alerts,
    sessionBankroll,
    isLoading,
    setLimit,
    updateLimit,
    toggleLimit,
    startSessionBankroll,
    updateSessionBankroll,
    endSessionBankroll,
    getBankrollStats,
    checkAndTriggerAlerts,
    dismissAlert,
    clearAllAlerts,
    resetPeriod,
  };
});
