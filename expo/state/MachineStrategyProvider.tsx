import { useState, useEffect, useMemo, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useCasinoSessions, MachineType, Denomination } from './CasinoSessionProvider';

export interface MachineRecommendation {
  machineType: MachineType;
  denomination?: Denomination;
  score: number;
  reason: string;
  avgWinLoss: number;
  winRate: number;
  sessionCount: number;
  avgSessionLength: number;
  pointsPerHour: number;
  volatility: 'low' | 'medium' | 'high';
  recommendedBankroll: number;
}

export interface StrategyInsight {
  id: string;
  type: 'hot' | 'cold' | 'optimal' | 'avoid' | 'consistent';
  title: string;
  description: string;
  confidence: number;
  machineType?: MachineType;
  denomination?: Denomination;
}

export interface OptimalPlayTime {
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late-night';
  avgWinRate: number;
  sessionCount: number;
  avgPointsPerHour: number;
}

interface MachineStrategyState {
  recommendations: MachineRecommendation[];
  insights: StrategyInsight[];
  optimalPlayTimes: OptimalPlayTime[];
  bestMachine: MachineRecommendation | null;
  worstMachine: MachineRecommendation | null;
  mostConsistentMachine: MachineRecommendation | null;
  refreshRecommendations: () => void;
}

export const [MachineStrategyProvider, useMachineStrategy] = createContextHook((): MachineStrategyState => {
  const { sessions, getSessionAnalytics } = useCasinoSessions();
  const [recommendations, setRecommendations] = useState<MachineRecommendation[]>([]);
  const [insights, setInsights] = useState<StrategyInsight[]>([]);
  const [optimalPlayTimes, setOptimalPlayTimes] = useState<OptimalPlayTime[]>([]);

  const calculateRecommendations = useCallback(() => {
    console.log('[MachineStrategyProvider] Calculating recommendations for', sessions.length, 'sessions');

    if (sessions.length === 0) {
      setRecommendations([]);
      setInsights([]);
      setOptimalPlayTimes([]);
      return;
    }

    const analytics = getSessionAnalytics();
    const newRecommendations: MachineRecommendation[] = [];
    const newInsights: StrategyInsight[] = [];

    const machineTypes: MachineType[] = [
      'penny-slots',
      'nickel-slots',
      'quarter-slots',
      'dollar-slots',
      'high-limit-slots',
      'video-poker',
      'blackjack',
      'roulette',
      'craps',
      'baccarat',
      'poker',
      'other',
    ];

    machineTypes.forEach((machineType) => {
      const mtData = analytics.machineTypeBreakdown[machineType];
      if (mtData && mtData.sessions > 0) {
        const mtSessions = sessions.filter(s => s.machineType === machineType);
        const avgSessionLength = mtSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / mtSessions.length;
        
        const totalHours = mtSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
        const totalPoints = mtSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
        const pointsPerHour = totalHours > 0 ? totalPoints / totalHours : 0;

        const winLossValues = mtSessions.map(s => s.winLoss || 0).filter(v => v !== 0);
        const variance = winLossValues.length > 1 
          ? winLossValues.reduce((sum, v) => sum + Math.pow(v - mtData.avgWinLoss, 2), 0) / winLossValues.length 
          : 0;
        const stdDev = Math.sqrt(variance);
        
        const volatility: 'low' | 'medium' | 'high' = 
          stdDev < 100 ? 'low' : stdDev < 300 ? 'medium' : 'high';

        const score = (
          (mtData.winRate * 2) +
          (mtData.avgWinLoss > 0 ? 30 : Math.max(-10, mtData.avgWinLoss / 10)) +
          (pointsPerHour / 10) +
          (mtData.sessions > 5 ? 20 : mtData.sessions * 3) +
          (volatility === 'low' ? 10 : volatility === 'medium' ? 5 : 0)
        );

        const recommendedBankroll = Math.max(
          Math.abs(mtData.avgWinLoss) * 3,
          stdDev * 5,
          100
        );

        let reason = '';
        if (mtData.winRate > 50 && mtData.avgWinLoss > 0) {
          reason = `Strong performance with ${mtData.winRate.toFixed(0)}% win rate`;
        } else if (pointsPerHour > 300) {
          reason = `Excellent points earning at ${pointsPerHour.toFixed(0)} PPH`;
        } else if (volatility === 'low') {
          reason = `Low volatility provides consistent results`;
        } else if (mtData.sessions > 10) {
          reason = `Well-tested with ${mtData.sessions} sessions`;
        } else if (mtData.avgWinLoss > 0) {
          reason = `Positive average return of $${mtData.avgWinLoss.toFixed(0)}`;
        } else {
          reason = `Based on ${mtData.sessions} session${mtData.sessions !== 1 ? 's' : ''}`;
        }

        newRecommendations.push({
          machineType,
          score,
          reason,
          avgWinLoss: mtData.avgWinLoss,
          winRate: mtData.winRate,
          sessionCount: mtData.sessions,
          avgSessionLength,
          pointsPerHour,
          volatility,
          recommendedBankroll,
        });
      }
    });

    newRecommendations.sort((a, b) => b.score - a.score);

    if (newRecommendations.length > 0) {
      const best = newRecommendations[0];
      if (best.winRate > 60 || best.avgWinLoss > 50) {
        newInsights.push({
          id: `hot_${Date.now()}`,
          type: 'hot',
          title: `🔥 ${formatMachineType(best.machineType)} is Hot`,
          description: `${best.winRate.toFixed(0)}% win rate with avg return of $${best.avgWinLoss.toFixed(0)}`,
          confidence: Math.min(95, 50 + (best.sessionCount * 3)),
          machineType: best.machineType,
        });
      }

      const worst = newRecommendations[newRecommendations.length - 1];
      if (worst.avgWinLoss < -100 && worst.sessionCount >= 3) {
        newInsights.push({
          id: `avoid_${Date.now()}`,
          type: 'avoid',
          title: `⚠️ Consider Avoiding ${formatMachineType(worst.machineType)}`,
          description: `Avg loss of $${Math.abs(worst.avgWinLoss).toFixed(0)} per session`,
          confidence: Math.min(85, 40 + (worst.sessionCount * 2)),
          machineType: worst.machineType,
        });
      }

      const consistentMachines = newRecommendations.filter(r => r.volatility === 'low' && r.sessionCount >= 3);
      if (consistentMachines.length > 0) {
        const mostConsistent = consistentMachines[0];
        newInsights.push({
          id: `consistent_${Date.now()}`,
          type: 'consistent',
          title: `📊 ${formatMachineType(mostConsistent.machineType)} Shows Consistency`,
          description: `Low volatility with stable returns across ${mostConsistent.sessionCount} sessions`,
          confidence: Math.min(90, 60 + (mostConsistent.sessionCount * 2)),
          machineType: mostConsistent.machineType,
        });
      }

      const highPPH = newRecommendations.filter(r => r.pointsPerHour > 400);
      if (highPPH.length > 0) {
        const topPPH = highPPH.reduce((max, r) => r.pointsPerHour > max.pointsPerHour ? r : max);
        newInsights.push({
          id: `optimal_${Date.now()}`,
          type: 'optimal',
          title: `⭐ Best Points: ${formatMachineType(topPPH.machineType)}`,
          description: `Earning ${topPPH.pointsPerHour.toFixed(0)} points per hour`,
          confidence: Math.min(95, 50 + (topPPH.sessionCount * 3)),
          machineType: topPPH.machineType,
        });
      }
    }

    const playTimeAnalysis: Record<string, OptimalPlayTime> = {};
    sessions.forEach((session) => {
      const date = new Date(session.date + 'T' + session.startTime);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = date.getHours();
      
      let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late-night';
      if (hour >= 6 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
      else if (hour >= 18 && hour < 24) timeOfDay = 'evening';
      else timeOfDay = 'late-night';

      const key = `${dayOfWeek}_${timeOfDay}`;
      if (!playTimeAnalysis[key]) {
        playTimeAnalysis[key] = {
          dayOfWeek,
          timeOfDay,
          avgWinRate: 0,
          sessionCount: 0,
          avgPointsPerHour: 0,
        };
      }

      const isWin = (session.winLoss || 0) > 0;
      const sessionHours = session.durationMinutes / 60;
      const sessionPPH = sessionHours > 0 ? (session.pointsEarned || 0) / sessionHours : 0;

      playTimeAnalysis[key].sessionCount++;
      playTimeAnalysis[key].avgWinRate += isWin ? 1 : 0;
      playTimeAnalysis[key].avgPointsPerHour += sessionPPH;
    });

    const playTimes = Object.values(playTimeAnalysis).map(pt => ({
      ...pt,
      avgWinRate: (pt.avgWinRate / pt.sessionCount) * 100,
      avgPointsPerHour: pt.avgPointsPerHour / pt.sessionCount,
    })).sort((a, b) => b.avgWinRate - a.avgWinRate);

    setRecommendations(newRecommendations);
    setInsights(newInsights);
    setOptimalPlayTimes(playTimes);

    console.log('[MachineStrategyProvider] Generated', newRecommendations.length, 'recommendations and', newInsights.length, 'insights');
  }, [sessions, getSessionAnalytics]);

  useEffect(() => {
    calculateRecommendations();
  }, [calculateRecommendations]);

  const bestMachine = useMemo(() => {
    return recommendations.length > 0 ? recommendations[0] : null;
  }, [recommendations]);

  const worstMachine = useMemo(() => {
    return recommendations.length > 0 ? recommendations[recommendations.length - 1] : null;
  }, [recommendations]);

  const mostConsistentMachine = useMemo(() => {
    const consistent = recommendations.filter(r => r.volatility === 'low' && r.sessionCount >= 3);
    return consistent.length > 0 ? consistent[0] : null;
  }, [recommendations]);

  return {
    recommendations,
    insights,
    optimalPlayTimes,
    bestMachine,
    worstMachine,
    mostConsistentMachine,
    refreshRecommendations: calculateRecommendations,
  };
});

function formatMachineType(machineType: MachineType): string {
  const map: Record<MachineType, string> = {
    'penny-slots': 'Penny Slots',
    'nickel-slots': 'Nickel Slots',
    'quarter-slots': 'Quarter Slots',
    'dollar-slots': 'Dollar Slots',
    'high-limit-slots': 'High Limit Slots',
    'video-poker': 'Video Poker',
    'blackjack': 'Blackjack',
    'roulette': 'Roulette',
    'craps': 'Craps',
    'baccarat': 'Baccarat',
    'poker': 'Poker',
    'other': 'Other',
  };
  return map[machineType] || machineType;
}
