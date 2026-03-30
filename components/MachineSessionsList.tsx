import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { ChevronDown, TrendingUp, TrendingDown, Edit2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

interface MachineSessionsListProps {
  sessions: CasinoSession[];
  onEditSession: (session: CasinoSession) => void;
}

type SortBy = 'date' | 'winLoss' | 'machine' | 'duration';
type SortOrder = 'asc' | 'desc';

export function MachineSessionsList({ sessions, onEditSession }: MachineSessionsListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<'all' | 'wins' | 'losses'>('all');

  const machineSessionsOnly = useMemo(() => {
    return sessions.filter(s => s.machineId);
  }, [sessions]);

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = [...machineSessionsOnly];

    if (filterType === 'wins') {
      filtered = filtered.filter(s => (s.winLoss || 0) > 0);
    } else if (filterType === 'losses') {
      filtered = filtered.filter(s => (s.winLoss || 0) < 0);
    }

    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'winLoss':
          aVal = a.winLoss || 0;
          bVal = b.winLoss || 0;
          break;
        case 'machine':
          aVal = a.machineName?.toLowerCase() || '';
          bVal = b.machineName?.toLowerCase() || '';
          break;
        case 'duration':
          aVal = a.durationMinutes;
          bVal = b.durationMinutes;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [machineSessionsOnly, filterType, sortBy, sortOrder]);

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderSession = ({ item }: { item: CasinoSession }) => {
    const winLoss = item.winLoss || 0;
    const isWin = winLoss > 0;
    const isLoss = winLoss < 0;

    return (
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionHeaderLeft}>
            <Text style={styles.sessionMachine} numberOfLines={1}>
              {item.machineName || 'Unknown Machine'}
            </Text>
            <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEditSession(item)}
            activeOpacity={0.7}
          >
            <Edit2 size={16} color={COLORS.navyDeep} />
          </TouchableOpacity>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.sessionDetailItem}>
            <Text style={styles.sessionDetailLabel}>Duration</Text>
            <Text style={styles.sessionDetailValue}>
              {formatDuration(item.durationMinutes)}
            </Text>
          </View>

          {item.denomination && (
            <View style={styles.sessionDetailItem}>
              <Text style={styles.sessionDetailLabel}>Denom</Text>
              <Text style={styles.sessionDetailValue}>
                ${item.denomination.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={[styles.sessionDetailItem, styles.winLossItem]}>
            <View style={styles.winLossIconRow}>
              {isWin && <TrendingUp size={14} color={COLORS.success} />}
              {isLoss && <TrendingDown size={14} color={COLORS.error} />}
              <Text style={styles.sessionDetailLabel}>W/L</Text>
            </View>
            <Text style={[
              styles.winLossValue,
              isWin && styles.winValue,
              isLoss && styles.lossValue,
            ]}>
              {isWin && '+'}${Math.abs(winLoss).toFixed(2)}
            </Text>
          </View>
          
          {item.pointsEarned !== undefined && item.pointsEarned > 0 && (
            <View style={styles.sessionDetailItem}>
              <Text style={styles.sessionDetailLabel}>Points</Text>
              <Text style={[styles.sessionDetailValue, styles.pointsValue]}>
                {item.pointsEarned.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {item.notes && (
          <Text style={styles.sessionNotes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Session Records ({filteredAndSortedSessions.length})</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'wins' && styles.filterChipActive]}
            onPress={() => setFilterType('wins')}
            activeOpacity={0.7}
          >
            <TrendingUp size={14} color={filterType === 'wins' ? COLORS.white : COLORS.success} />
            <Text style={[styles.filterChipText, filterType === 'wins' && styles.filterChipTextActive]}>
              Wins
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'losses' && styles.filterChipActive]}
            onPress={() => setFilterType('losses')}
            activeOpacity={0.7}
          >
            <TrendingDown size={14} color={filterType === 'losses' ? COLORS.white : COLORS.error} />
            <Text style={[styles.filterChipText, filterType === 'losses' && styles.filterChipTextActive]}>
              Losses
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sortRow}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => handleSort('date')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortButtonText, sortBy === 'date' && styles.sortButtonTextActive]}>
              Date
            </Text>
            {sortBy === 'date' && (
              <ChevronDown 
                size={14} 
                color={COLORS.navyDeep} 
                style={sortOrder === 'asc' ? styles.chevronUp : undefined}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => handleSort('winLoss')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortButtonText, sortBy === 'winLoss' && styles.sortButtonTextActive]}>
              W/L
            </Text>
            {sortBy === 'winLoss' && (
              <ChevronDown 
                size={14} 
                color={COLORS.navyDeep} 
                style={sortOrder === 'asc' ? styles.chevronUp : undefined}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => handleSort('machine')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortButtonText, sortBy === 'machine' && styles.sortButtonTextActive]}>
              Machine
            </Text>
            {sortBy === 'machine' && (
              <ChevronDown 
                size={14} 
                color={COLORS.navyDeep} 
                style={sortOrder === 'asc' ? styles.chevronUp : undefined}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => handleSort('duration')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortButtonText, sortBy === 'duration' && styles.sortButtonTextActive]}>
              Time
            </Text>
            {sortBy === 'duration' && (
              <ChevronDown 
                size={14} 
                color={COLORS.navyDeep} 
                style={sortOrder === 'asc' ? styles.chevronUp : undefined}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredAndSortedSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No machine session records found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  controls: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.bgSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
  },
  sortButtonTextActive: {
    color: COLORS.navyDeep,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  listContent: {
    padding: 16,
  },
  sessionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  sessionMachine: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  editButton: {
    padding: 4,
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  sessionDetailItem: {
    flex: 1,
  },
  sessionDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  sessionDetailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  winLossItem: {
    alignItems: 'flex-end',
  },
  winLossIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  winLossValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  winValue: {
    color: COLORS.success,
  },
  lossValue: {
    color: COLORS.error,
  },
  sessionNotes: {
    fontSize: 12,
    color: COLORS.textDarkGrey,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  pointsValue: {
    color: '#3b82f6',
  },
});
