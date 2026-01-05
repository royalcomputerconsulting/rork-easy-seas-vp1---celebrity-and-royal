import { useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useCasinoSessions, CasinoSession } from './CasinoSessionProvider';

export interface ComparisonPeriod {
  label: string;
  startDate: string;
  endDate: string;
  sessions: CasinoSession[];
  totalSessions: number;
  totalPlayTime: number;
  totalBuyIn: number;
  totalCashOut: number;
  netWinLoss: number;
  totalPoints: number;
  avgWinLoss: number;
  winRate: number;
  avgPPH: number;
}

export interface SessionTrend {
  date: string;
  winLoss: number;
  pointsEarned: number;
  sessionCount: number;
  pph: number;
}

export interface ComparisonMetrics {
  currentVsPrevious: {
    winLossChange: number;
    winLossChangePercent: number;
    pphChange: number;
    pphChangePercent: number;
    winRateChange: number;
    sessionCountChange: number;
  };
  bestPeriod: ComparisonPeriod | null;
  worstPeriod: ComparisonPeriod | null;
  trend: 'improving' | 'declining' | 'stable';
  insights: string[];
}

interface HistoricalComparisonState {
  periods: ComparisonPeriod[];
  trends: SessionTrend[];
  metrics: ComparisonMetrics;
  compareByMonth: (months: number) => ComparisonPeriod[];
  compareByWeek: (weeks: number) => ComparisonPeriod[];
}

export const [HistoricalComparisonProvider, useHistoricalComparison] = createContextHook((): HistoricalComparisonState => {
  const { sessions } = useCasinoSessions();

  const periods = useMemo((): ComparisonPeriod[] => {
    if (sessions.length === 0) return [];

    const now = new Date();
    const periods: ComparisonPeriod[] = [];

    const ranges = [
      { label: 'Last 7 Days', days: 7 },
      { label: 'Last 30 Days', days: 30 },
      { label: 'Last 3 Months', days: 90 },
      { label: 'Last 6 Months', days: 180 },
      { label: 'Last Year', days: 365 },
    ];

    ranges.forEach(({ label, days }) => {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      const periodSessions = sessions.filter(s => {
        return s.date >= startDateStr && s.date <= endDateStr;
      });

      if (periodSessions.length === 0) return;

      const totalPlayTime = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const totalBuyIn = periodSessions.reduce((sum, s) => sum + (s.buyIn || 0), 0);
      const totalCashOut = periodSessions.reduce((sum, s) => sum + (s.cashOut || 0), 0);
      const netWinLoss = periodSessions.reduce((sum, s) => sum + (s.winLoss || 0), 0);
      const totalPoints = periodSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);

      const winningSessions = periodSessions.filter(s => (s.winLoss || 0) > 0).length;
      const winRate = periodSessions.length > 0 ? (winningSessions / periodSessions.length) * 100 : 0;

      const totalHours = totalPlayTime / 60;
      const avgPPH = totalHours > 0 ? totalPoints / totalHours : 0;

      periods.push({
        label,
        startDate: startDateStr,
        endDate: endDateStr,
        sessions: periodSessions,
        totalSessions: periodSessions.length,
        totalPlayTime,
        totalBuyIn,
        totalCashOut,
        netWinLoss,
        totalPoints,
        avgWinLoss: periodSessions.length > 0 ? netWinLoss / periodSessions.length : 0,
        winRate,
        avgPPH,
      });
    });

    return periods;
  }, [sessions]);

  const trends = useMemo((): SessionTrend[] => {
    if (sessions.length === 0) return [];

    const sessionsByDate = new Map<string, CasinoSession[]>();
    sessions.forEach(session => {
      if (!sessionsByDate.has(session.date)) {
        sessionsByDate.set(session.date, []);
      }
      sessionsByDate.get(session.date)!.push(session);
    });

    const trends: SessionTrend[] = [];
    sessionsByDate.forEach((daySessions, date) => {
      const winLoss = daySessions.reduce((sum, s) => sum + (s.winLoss || 0), 0);
      const pointsEarned = daySessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
      const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const totalHours = totalMinutes / 60;
      const pph = totalHours > 0 ? pointsEarned / totalHours : 0;

      trends.push({
        date,
        winLoss,
        pointsEarned,
        sessionCount: daySessions.length,
        pph,
      });
    });

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions]);

  const metrics = useMemo((): ComparisonMetrics => {
    if (periods.length < 2) {
      return {
        currentVsPrevious: {
          winLossChange: 0,
          winLossChangePercent: 0,
          pphChange: 0,
          pphChangePercent: 0,
          winRateChange: 0,
          sessionCountChange: 0,
        },
        bestPeriod: periods[0] || null,
        worstPeriod: periods[0] || null,
        trend: 'stable',
        insights: ['Not enough data for comparison'],
      };
    }

    const current = periods[0];
    const previous = periods[1];

    const winLossChange = current.netWinLoss - previous.netWinLoss;
    const winLossChangePercent = previous.netWinLoss !== 0
      ? (winLossChange / Math.abs(previous.netWinLoss)) * 100
      : 0;

    const pphChange = current.avgPPH - previous.avgPPH;
    const pphChangePercent = previous.avgPPH !== 0
      ? (pphChange / previous.avgPPH) * 100
      : 0;

    const winRateChange = current.winRate - previous.winRate;
    const sessionCountChange = current.totalSessions - previous.totalSessions;

    const bestPeriod = periods.reduce((best, p) =>
      p.netWinLoss > best.netWinLoss ? p : best
    );

    const worstPeriod = periods.reduce((worst, p) =>
      p.netWinLoss < worst.netWinLoss ? p : worst
    );

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    const recentTrends = trends.slice(-10);
    if (recentTrends.length >= 3) {
      const first = recentTrends.slice(0, Math.floor(recentTrends.length / 2));
      const second = recentTrends.slice(Math.floor(recentTrends.length / 2));

      const firstAvg = first.reduce((sum, t) => sum + t.winLoss, 0) / first.length;
      const secondAvg = second.reduce((sum, t) => sum + t.winLoss, 0) / second.length;

      if (secondAvg > firstAvg * 1.1) trend = 'improving';
      else if (secondAvg < firstAvg * 0.9) trend = 'declining';
    }

    const insights: string[] = [];

    if (winLossChangePercent > 20) {
      insights.push(`Win/Loss improved by ${winLossChangePercent.toFixed(0)}% from previous period`);
    } else if (winLossChangePercent < -20) {
      insights.push(`Win/Loss declined by ${Math.abs(winLossChangePercent).toFixed(0)}% from previous period`);
    }

    if (pphChangePercent > 15) {
      insights.push(`Points per hour increased by ${pphChangePercent.toFixed(0)}%`);
    } else if (pphChangePercent < -15) {
      insights.push(`Points per hour decreased by ${Math.abs(pphChangePercent).toFixed(0)}%`);
    }

    if (winRateChange > 10) {
      insights.push(`Win rate improved by ${winRateChange.toFixed(0)}%`);
    } else if (winRateChange < -10) {
      insights.push(`Win rate decreased by ${Math.abs(winRateChange).toFixed(0)}%`);
    }

    if (trend === 'improving') {
      insights.push('Recent sessions show an improving trend');
    } else if (trend === 'declining') {
      insights.push('Recent sessions show a declining trend - consider adjusting strategy');
    }

    if (current.totalSessions < previous.totalSessions * 0.5) {
      insights.push('Playing significantly fewer sessions than previous period');
    }

    if (insights.length === 0) {
      insights.push('Performance is relatively stable');
    }

    return {
      currentVsPrevious: {
        winLossChange,
        winLossChangePercent,
        pphChange,
        pphChangePercent,
        winRateChange,
        sessionCountChange,
      },
      bestPeriod,
      worstPeriod,
      trend,
      insights,
    };
  }, [periods, trends]);

  const compareByMonth = useMemo(() => {
    return (months: number): ComparisonPeriod[] => {
      const result: ComparisonPeriod[] = [];
      const now = new Date();

      for (let i = 0; i < months; i++) {
        const endDate = new Date(now.getFullYear(), now.getMonth() - i, 0);
        const startDate = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);

        const label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const periodSessions = sessions.filter(s => {
          return s.date >= startDateStr && s.date <= endDateStr;
        });

        const totalPlayTime = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const totalBuyIn = periodSessions.reduce((sum, s) => sum + (s.buyIn || 0), 0);
        const totalCashOut = periodSessions.reduce((sum, s) => sum + (s.cashOut || 0), 0);
        const netWinLoss = periodSessions.reduce((sum, s) => sum + (s.winLoss || 0), 0);
        const totalPoints = periodSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);

        const winningSessions = periodSessions.filter(s => (s.winLoss || 0) > 0).length;
        const winRate = periodSessions.length > 0 ? (winningSessions / periodSessions.length) * 100 : 0;

        const totalHours = totalPlayTime / 60;
        const avgPPH = totalHours > 0 ? totalPoints / totalHours : 0;

        result.push({
          label,
          startDate: startDateStr,
          endDate: endDateStr,
          sessions: periodSessions,
          totalSessions: periodSessions.length,
          totalPlayTime,
          totalBuyIn,
          totalCashOut,
          netWinLoss,
          totalPoints,
          avgWinLoss: periodSessions.length > 0 ? netWinLoss / periodSessions.length : 0,
          winRate,
          avgPPH,
        });
      }

      return result.reverse();
    };
  }, [sessions]);

  const compareByWeek = useMemo(() => {
    return (weeks: number): ComparisonPeriod[] => {
      const result: ComparisonPeriod[] = [];
      const now = new Date();

      for (let i = 0; i < weeks; i++) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - (i * 7));

        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);

        const label = `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const periodSessions = sessions.filter(s => {
          return s.date >= startDateStr && s.date <= endDateStr;
        });

        const totalPlayTime = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const totalBuyIn = periodSessions.reduce((sum, s) => sum + (s.buyIn || 0), 0);
        const totalCashOut = periodSessions.reduce((sum, s) => sum + (s.cashOut || 0), 0);
        const netWinLoss = periodSessions.reduce((sum, s) => sum + (s.winLoss || 0), 0);
        const totalPoints = periodSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);

        const winningSessions = periodSessions.filter(s => (s.winLoss || 0) > 0).length;
        const winRate = periodSessions.length > 0 ? (winningSessions / periodSessions.length) * 100 : 0;

        const totalHours = totalPlayTime / 60;
        const avgPPH = totalHours > 0 ? totalPoints / totalHours : 0;

        result.push({
          label,
          startDate: startDateStr,
          endDate: endDateStr,
          sessions: periodSessions,
          totalSessions: periodSessions.length,
          totalPlayTime,
          totalBuyIn,
          totalCashOut,
          netWinLoss,
          totalPoints,
          avgWinLoss: periodSessions.length > 0 ? netWinLoss / periodSessions.length : 0,
          winRate,
          avgPPH,
        });
      }

      return result.reverse();
    };
  }, [sessions]);

  return {
    periods,
    trends,
    metrics,
    compareByMonth,
    compareByWeek,
  };
});
