import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

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
        <Activity size={20} color={COLORS.navyDeep} />
        <Text style={styles.title}>Machine Session Overview</Text>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Records</Text>
          <Text style={styles.statValue}>{totalRecords}</Text>
          {totalMachines > 0 && (
            <Text style={styles.statSubtext}>{totalMachines} machines</Text>
          )}
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIconRow}>
            <TrendingUp size={18} color={COLORS.success} />
            <Text style={styles.statLabel}>Best Win</Text>
          </View>
          <Text style={[styles.statValue, styles.positiveValue]}>
            ${bestWin.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIconRow}>
            <TrendingDown size={18} color={COLORS.error} />
            <Text style={styles.statLabel}>Worst Loss</Text>
          </View>
          <Text style={[styles.statValue, styles.negativeValue]}>
            ${worstLoss.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total W/L</Text>
          <Text style={[
            styles.statValue,
            totalWinLoss >= 0 ? styles.positiveValue : styles.negativeValue
          ]}>
            ${totalWinLoss.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg W/L</Text>
          <Text style={[
            styles.statValue,
            avgWinLoss >= 0 ? styles.positiveValue : styles.negativeValue
          ]}>
            ${avgWinLoss.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Win Rate</Text>
          <Text style={styles.statValue}>{winRate.toFixed(1)}%</Text>
          <Text style={styles.statSubtext}>
            {winningSessions}W / {losingSessions}L
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Points</Text>
          <Text style={[styles.statValue, styles.pointsValue]}>
            {totalPointsEarned.toLocaleString()}
          </Text>
          <Text style={styles.statSubtext}>Club Royale pts</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 12,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  positiveValue: {
    color: COLORS.success,
  },
  negativeValue: {
    color: COLORS.error,
  },
  statSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pointsValue: {
    color: '#3b82f6',
  },
});
