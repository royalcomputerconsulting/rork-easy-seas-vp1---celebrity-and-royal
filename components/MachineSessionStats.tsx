import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react-native';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

const CARD_BG = 'rgba(255,255,255,0.07)';
const CARD_BORDER = 'rgba(255,255,255,0.12)';
const STAT_BG = 'rgba(255,255,255,0.05)';

interface MachineSessionStatsProps {
  sessions: CasinoSession[];
  totalMachines?: number;
}

export function MachineSessionStats({ sessions, totalMachines = 0 }: MachineSessionStatsProps) {
  const machineSessionsOnly = sessions.filter(s => s.machineId);
  const totalRecords = machineSessionsOnly.length;

  const allWinLosses = machineSessionsOnly
    .filter(s => s.winLoss !== undefined)
    .map(s => s.winLoss || 0);

  const bestWin = allWinLosses.length > 0 ? Math.max(...allWinLosses) : 0;
  const lossesOnly = allWinLosses.filter(wl => wl < 0);
  const worstLoss = lossesOnly.length > 0 ? Math.min(...lossesOnly) : 0;
  const totalWinLoss = allWinLosses.reduce((sum, wl) => sum + wl, 0);
  const avgWinLoss = totalRecords > 0 ? totalWinLoss / totalRecords : 0;
  const winningSessions = allWinLosses.filter(wl => wl > 0).length;
  const losingSessions = allWinLosses.filter(wl => wl < 0).length;
  const winRate = totalRecords > 0 ? (winningSessions / totalRecords) * 100 : 0;
  const totalPointsEarned = machineSessionsOnly.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Activity size={18} color="#9EFDF2" />
        </View>
        <Text style={styles.title}>{'Machine Session Overview'}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{'Total Records'}</Text>
          <Text style={styles.statValue}>{String(totalRecords)}</Text>
          {totalMachines > 0 ? (
            <Text style={styles.statSubtext}>{`${totalMachines} machines`}</Text>
          ) : null}
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconRow}>
            <TrendingUp size={15} color="#8EF2C1" />
            <Text style={styles.statLabel}>{'Best Win'}</Text>
          </View>
          <Text style={[styles.statValue, styles.positiveValue]}>
            {`$${bestWin.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconRow}>
            <TrendingDown size={15} color="#FFB3C1" />
            <Text style={styles.statLabel}>{'Worst Loss'}</Text>
          </View>
          <Text style={[styles.statValue, styles.negativeValue]}>
            {`$${worstLoss.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{'Total W/L'}</Text>
          <Text style={[styles.statValue, totalWinLoss >= 0 ? styles.positiveValue : styles.negativeValue]}>
            {`$${totalWinLoss.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{'Avg W/L'}</Text>
          <Text style={[styles.statValue, avgWinLoss >= 0 ? styles.positiveValue : styles.negativeValue]}>
            {`$${avgWinLoss.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{'Win Rate'}</Text>
          <Text style={styles.statValue}>{`${winRate.toFixed(1)}%`}</Text>
          <Text style={styles.statSubtext}>{`${winningSessions}W / ${losingSessions}L`}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{'Total Points'}</Text>
          <Text style={[styles.statValue, styles.pointsValue]}>
            {totalPointsEarned.toLocaleString()}
          </Text>
          <Text style={styles.statSubtext}>{'Club Royale pts'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(158,253,242,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: STAT_BG,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  positiveValue: {
    color: '#8EF2C1',
  },
  negativeValue: {
    color: '#FFB3C1',
  },
  statSubtext: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  pointsValue: {
    color: '#A8C6FF',
  },
});
