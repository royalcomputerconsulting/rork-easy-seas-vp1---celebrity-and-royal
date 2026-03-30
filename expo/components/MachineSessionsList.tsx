import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { ChevronDown, TrendingUp, TrendingDown, Edit2 } from 'lucide-react-native';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

const CARD_BG = 'rgba(255,255,255,0.07)';
const CARD_BORDER = 'rgba(255,255,255,0.12)';
const INNER_BG = 'rgba(255,255,255,0.05)';
const INNER_BORDER = 'rgba(255,255,255,0.08)';

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

  const machineSessionsOnly = useMemo(() => sessions.filter(s => s.machineId), [sessions]);

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = [...machineSessionsOnly];

    if (filterType === 'wins') {
      filtered = filtered.filter(s => (s.winLoss || 0) > 0);
    } else if (filterType === 'losses') {
      filtered = filtered.filter(s => (s.winLoss || 0) < 0);
    }

    filtered.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

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
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
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

  const formatDateStr = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const renderSession = ({ item }: { item: CasinoSession }) => {
    const winLoss = item.winLoss || 0;
    const isWin = winLoss > 0;
    const isLoss = winLoss < 0;
    const winLossDisplay = isWin ? `+$${Math.abs(winLoss).toFixed(2)}` : `-$${Math.abs(winLoss).toFixed(2)}`;

    return (
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionHeaderLeft}>
            <Text style={styles.sessionMachine} numberOfLines={1}>
              {item.machineName || 'Unknown Machine'}
            </Text>
            <Text style={styles.sessionDate}>{formatDateStr(item.date)}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEditSession(item)}
            activeOpacity={0.7}
          >
            <Edit2 size={15} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.sessionDetailItem}>
            <Text style={styles.sessionDetailLabel}>{'Duration'}</Text>
            <Text style={styles.sessionDetailValue}>{formatDuration(item.durationMinutes)}</Text>
          </View>

          {item.denomination ? (
            <View style={styles.sessionDetailItem}>
              <Text style={styles.sessionDetailLabel}>{'Denom'}</Text>
              <Text style={styles.sessionDetailValue}>{`$${item.denomination.toFixed(2)}`}</Text>
            </View>
          ) : null}

          <View style={[styles.sessionDetailItem, styles.winLossItem]}>
            <View style={styles.winLossIconRow}>
              {isWin ? <TrendingUp size={13} color="#8EF2C1" /> : null}
              {isLoss ? <TrendingDown size={13} color="#FFB3C1" /> : null}
              <Text style={styles.sessionDetailLabel}>{'W/L'}</Text>
            </View>
            <Text style={[
              styles.winLossValue,
              isWin ? styles.winValue : isLoss ? styles.lossValue : null,
            ]}>
              {winLossDisplay}
            </Text>
          </View>

          {item.pointsEarned !== undefined && item.pointsEarned > 0 ? (
            <View style={styles.sessionDetailItem}>
              <Text style={styles.sessionDetailLabel}>{'Points'}</Text>
              <Text style={[styles.sessionDetailValue, styles.pointsValue]}>
                {item.pointsEarned.toLocaleString()}
              </Text>
            </View>
          ) : null}
        </View>

        {item.notes ? (
          <Text style={styles.sessionNotes} numberOfLines={2}>{item.notes}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{`Session Records (${filteredAndSortedSessions.length})`}</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
              {'All'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'wins' && styles.filterChipActiveWin]}
            onPress={() => setFilterType('wins')}
            activeOpacity={0.7}
          >
            <TrendingUp size={13} color={filterType === 'wins' ? '#8EF2C1' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.filterChipText, filterType === 'wins' && styles.filterChipTextActiveWin]}>
              {'Wins'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'losses' && styles.filterChipActiveLoss]}
            onPress={() => setFilterType('losses')}
            activeOpacity={0.7}
          >
            <TrendingDown size={13} color={filterType === 'losses' ? '#FFB3C1' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.filterChipText, filterType === 'losses' && styles.filterChipTextActiveLoss]}>
              {'Losses'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sortRow}>
          {(['date', 'winLoss', 'machine', 'duration'] as SortBy[]).map((key) => {
            const labels: Record<SortBy, string> = { date: 'Date', winLoss: 'W/L', machine: 'Machine', duration: 'Time' };
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sortButton, sortBy === key && styles.sortButtonActive]}
                onPress={() => handleSort(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortButtonText, sortBy === key && styles.sortButtonTextActive]}>
                  {labels[key]}
                </Text>
                {sortBy === key ? (
                  <ChevronDown
                    size={13}
                    color="#FFE28F"
                    style={sortOrder === 'asc' ? styles.chevronUp : undefined}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredAndSortedSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{'No machine session records found'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: INNER_BORDER,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  controls: {
    padding: 14,
    backgroundColor: INNER_BG,
    borderBottomWidth: 1,
    borderBottomColor: INNER_BORDER,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,226,143,0.18)',
    borderColor: 'rgba(255,226,143,0.5)',
  },
  filterChipActiveWin: {
    backgroundColor: 'rgba(142,242,193,0.15)',
    borderColor: 'rgba(142,242,193,0.45)',
  },
  filterChipActiveLoss: {
    backgroundColor: 'rgba(255,179,193,0.15)',
    borderColor: 'rgba(255,179,193,0.45)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.55)',
  },
  filterChipTextActive: {
    color: '#FFE28F',
  },
  filterChipTextActiveWin: {
    color: '#8EF2C1',
  },
  filterChipTextActiveLoss: {
    color: '#FFB3C1',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sortButtonActive: {
    backgroundColor: 'rgba(255,226,143,0.12)',
    borderColor: 'rgba(255,226,143,0.4)',
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
  },
  sortButtonTextActive: {
    color: '#FFE28F',
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  listContent: {
    padding: 14,
  },
  sessionCard: {
    backgroundColor: INNER_BG,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sessionHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  sessionMachine: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  editButton: {
    padding: 4,
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  sessionDetailItem: {
    flex: 1,
  },
  sessionDetailLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sessionDetailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  winLossItem: {
    alignItems: 'flex-end',
  },
  winLossIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  winLossValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  winValue: {
    color: '#8EF2C1',
  },
  lossValue: {
    color: '#FFB3C1',
  },
  sessionNotes: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  pointsValue: {
    color: '#A8C6FF',
  },
});
