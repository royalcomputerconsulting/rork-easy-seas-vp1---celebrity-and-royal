import { useState, useCallback, useRef, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import type { PPHAlertData } from "@/components/PPHAlertNotification";
import { PPH_ALERT_PRESETS } from "@/components/PPHAlertNotification";

interface PPHAlertThresholds {
  targetPPH: number;
  warningThresholdPercent: number;
  excellentThresholdPercent: number;
  milestonePoints: number[];
  timeMilestoneMinutes: number[];
}

interface PPHAlertsState {
  alerts: PPHAlertData[];
  thresholds: PPHAlertThresholds;
  lastAlertedPPH: number | null;
  lastAlertedPoints: number | null;
  lastAlertedMinutes: number | null;
  personalBestPPH: number;
  addAlert: (alert: PPHAlertData) => void;
  dismissAlert: (id: string) => void;
  clearAllAlerts: () => void;
  setThresholds: (thresholds: Partial<PPHAlertThresholds>) => void;
  checkAndTriggerAlerts: (data: {
    currentPPH: number;
    targetPPH: number;
    sessionPoints: number;
    sessionMinutes: number;
    isSessionActive: boolean;
  }) => void;
  triggerTargetReachedAlert: (pph: number, target: number) => void;
  triggerTargetExceededAlert: (pph: number, target: number, percent: number) => void;
  triggerBelowTargetAlert: (pph: number, target: number) => void;
  triggerNewRecordAlert: (pph: number, previousBest: number) => void;
  triggerPointsMilestoneAlert: (points: number) => void;
  triggerTimeMilestoneAlert: (hours: number) => void;
  triggerStreakAlert: (days: number) => void;
  triggerPaceWarningAlert: (pph: number) => void;
  setPersonalBestPPH: (pph: number) => void;
}

const DEFAULT_THRESHOLDS: PPHAlertThresholds = {
  targetPPH: 100,
  warningThresholdPercent: 80,
  excellentThresholdPercent: 120,
  milestonePoints: [100, 250, 500, 1000, 2500, 5000, 10000],
  timeMilestoneMinutes: [30, 60, 120, 180, 240],
};

export const [PPHAlertsProvider, usePPHAlerts] = createContextHook((): PPHAlertsState => {
  const [alerts, setAlerts] = useState<PPHAlertData[]>([]);
  const [thresholds, setThresholdsState] = useState<PPHAlertThresholds>(DEFAULT_THRESHOLDS);
  const [lastAlertedPPH, setLastAlertedPPH] = useState<number | null>(null);
  const [lastAlertedPoints, setLastAlertedPoints] = useState<number | null>(null);
  const [lastAlertedMinutes, setLastAlertedMinutes] = useState<number | null>(null);
  const [personalBestPPH, setPersonalBestPPH] = useState<number>(0);
  
  const targetReachedRef = useRef(false);
  const targetExceededRef = useRef(false);
  const belowTargetAlertedRef = useRef(false);
  const newRecordAlertedRef = useRef(false);

  useEffect(() => {
    targetReachedRef.current = false;
    targetExceededRef.current = false;
    belowTargetAlertedRef.current = false;
    newRecordAlertedRef.current = false;
    setLastAlertedPPH(null);
    setLastAlertedPoints(null);
    setLastAlertedMinutes(null);
  }, []);

  const addAlert = useCallback((alert: PPHAlertData) => {
    setAlerts(prev => {
      const filtered = prev.filter(a => a.type !== alert.type);
      return [alert, ...filtered].slice(0, 5);
    });
    console.log('[PPHAlerts] Alert added:', alert.type, alert.title);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    console.log('[PPHAlerts] Alert dismissed:', id);
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    console.log('[PPHAlerts] All alerts cleared');
  }, []);

  const setThresholds = useCallback((newThresholds: Partial<PPHAlertThresholds>) => {
    setThresholdsState(prev => ({ ...prev, ...newThresholds }));
    console.log('[PPHAlerts] Thresholds updated:', newThresholds);
  }, []);

  const triggerTargetReachedAlert = useCallback((pph: number, target: number) => {
    const alert = PPH_ALERT_PRESETS.targetReached(pph, target);
    addAlert(alert);
  }, [addAlert]);

  const triggerTargetExceededAlert = useCallback((pph: number, target: number, percent: number) => {
    const alert = PPH_ALERT_PRESETS.targetExceeded(pph, target, percent);
    addAlert(alert);
  }, [addAlert]);

  const triggerBelowTargetAlert = useCallback((pph: number, target: number) => {
    const alert = PPH_ALERT_PRESETS.belowTarget(pph, target);
    addAlert(alert);
  }, [addAlert]);

  const triggerNewRecordAlert = useCallback((pph: number, previousBest: number) => {
    const alert = PPH_ALERT_PRESETS.newRecord(pph, previousBest);
    addAlert(alert);
    setPersonalBestPPH(pph);
  }, [addAlert]);

  const triggerPointsMilestoneAlert = useCallback((points: number) => {
    const alert = PPH_ALERT_PRESETS.pointsMilestone(points);
    addAlert(alert);
  }, [addAlert]);

  const triggerTimeMilestoneAlert = useCallback((hours: number) => {
    const alert = PPH_ALERT_PRESETS.timeMilestone(hours);
    addAlert(alert);
  }, [addAlert]);

  const triggerStreakAlert = useCallback((days: number) => {
    const alert = PPH_ALERT_PRESETS.streakAchieved(days);
    addAlert(alert);
  }, [addAlert]);

  const triggerPaceWarningAlert = useCallback((pph: number) => {
    const alert = PPH_ALERT_PRESETS.paceWarning(pph);
    addAlert(alert);
  }, [addAlert]);

  const checkAndTriggerAlerts = useCallback((data: {
    currentPPH: number;
    targetPPH: number;
    sessionPoints: number;
    sessionMinutes: number;
    isSessionActive: boolean;
  }) => {
    const { currentPPH, targetPPH, sessionPoints, sessionMinutes, isSessionActive } = data;

    if (!isSessionActive || sessionMinutes < 5) {
      return;
    }

    const targetPercent = (currentPPH / targetPPH) * 100;

    if (currentPPH >= targetPPH && !targetReachedRef.current) {
      targetReachedRef.current = true;
      triggerTargetReachedAlert(currentPPH, targetPPH);
      setLastAlertedPPH(currentPPH);
    }

    if (targetPercent >= thresholds.excellentThresholdPercent && !targetExceededRef.current) {
      targetExceededRef.current = true;
      triggerTargetExceededAlert(currentPPH, targetPPH, targetPercent - 100);
      setLastAlertedPPH(currentPPH);
    }

    if (
      targetPercent < thresholds.warningThresholdPercent && 
      sessionMinutes >= 15 && 
      !belowTargetAlertedRef.current
    ) {
      belowTargetAlertedRef.current = true;
      triggerBelowTargetAlert(currentPPH, targetPPH);
      setLastAlertedPPH(currentPPH);
    }

    if (currentPPH > personalBestPPH && personalBestPPH > 0 && !newRecordAlertedRef.current && sessionMinutes >= 10) {
      newRecordAlertedRef.current = true;
      triggerNewRecordAlert(currentPPH, personalBestPPH);
    }

    const nextPointsMilestone = thresholds.milestonePoints.find(
      milestone => sessionPoints >= milestone && (lastAlertedPoints === null || milestone > lastAlertedPoints)
    );
    if (nextPointsMilestone) {
      triggerPointsMilestoneAlert(nextPointsMilestone);
      setLastAlertedPoints(nextPointsMilestone);
    }

    const nextTimeMilestone = thresholds.timeMilestoneMinutes.find(
      milestone => sessionMinutes >= milestone && (lastAlertedMinutes === null || milestone > lastAlertedMinutes)
    );
    if (nextTimeMilestone) {
      triggerTimeMilestoneAlert(nextTimeMilestone / 60);
      setLastAlertedMinutes(nextTimeMilestone);
    }

    if (
      lastAlertedPPH !== null && 
      currentPPH < lastAlertedPPH * 0.7 && 
      sessionMinutes >= 20 &&
      !alerts.some(a => a.type === 'pace_warning' && Date.now() - a.timestamp < 300000)
    ) {
      triggerPaceWarningAlert(currentPPH);
      setLastAlertedPPH(currentPPH);
    }

  }, [
    thresholds,
    personalBestPPH,
    lastAlertedPPH,
    lastAlertedPoints,
    lastAlertedMinutes,
    alerts,
    triggerTargetReachedAlert,
    triggerTargetExceededAlert,
    triggerBelowTargetAlert,
    triggerNewRecordAlert,
    triggerPointsMilestoneAlert,
    triggerTimeMilestoneAlert,
    triggerPaceWarningAlert,
  ]);

  const resetSessionAlerts = useCallback(() => {
    targetReachedRef.current = false;
    targetExceededRef.current = false;
    belowTargetAlertedRef.current = false;
    newRecordAlertedRef.current = false;
    setLastAlertedPPH(null);
    setLastAlertedPoints(null);
    setLastAlertedMinutes(null);
    console.log('[PPHAlerts] Session alerts reset');
  }, []);

  useEffect(() => {
    return () => {
      resetSessionAlerts();
    };
  }, [resetSessionAlerts]);

  return {
    alerts,
    thresholds,
    lastAlertedPPH,
    lastAlertedPoints,
    lastAlertedMinutes,
    personalBestPPH,
    addAlert,
    dismissAlert,
    clearAllAlerts,
    setThresholds,
    checkAndTriggerAlerts,
    triggerTargetReachedAlert,
    triggerTargetExceededAlert,
    triggerBelowTargetAlert,
    triggerNewRecordAlert,
    triggerPointsMilestoneAlert,
    triggerTimeMilestoneAlert,
    triggerStreakAlert,
    triggerPaceWarningAlert,
    setPersonalBestPPH,
  };
});
