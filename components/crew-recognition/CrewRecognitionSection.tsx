import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Users, Plus, Download, Search, Filter, X, RefreshCcw, UserCheck, Check } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { AddCrewMemberModal } from './AddCrewMemberModal';
import { RecognitionEntryDetailModal } from './RecognitionEntryDetailModal';
import { SurveyListModal } from './SurveyListModal';
import { exportToCSV } from '@/lib/csv-export';
import { getAllShipNames } from '@/constants/shipInfo';
import type { RecognitionEntryWithCrew, Department } from '@/types/crew-recognition';



const ALL_FILTER_DEPARTMENTS = [
  'Activities',
  'Attractions',
  'Beverage',
  'Cafe',
  'Casino',
  'Casino / Beverage',
  'Crown Lounge',
  'Cruise Staff',
  'Deck',
  'Diamond Club',
  'Dining',
  'Front Desk',
  'Guest Relations',
  'Housekeeping',
  'Leadership',
  'Loyalty',
  'NextCruise',
  'Public Areas',
  'Retail',
  'Sanitation',
  'Spa',
  'Windjammer',
  'Windjammer / Cafe',
];

const MOCK_CREW_MEMBER = {
  id: 'mock-scott-astin',
  fullName: 'Scott A. Astin',
  department: 'Other',
  roleTitle: 'Permanent Passenger',
  notes: 'Mock data - will disappear when real crew members are added',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function CrewRecognitionSection() {
  const {
    userId,
    stats,
    statsLoading,
    entries,
    entriesTotal,
    entriesLoading,
    sailings,
    filters,
    updateFilters,
    resetFilters,
    page,
    pageSize,
    nextPage,
    previousPage,
    createCrewMember,
    updateRecognitionEntry,
    deleteRecognitionEntry,
    syncFromCSVLocally,
  } = useCrewRecognition();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecognitionEntryWithCrew | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress(null);
    try {
      console.log('[CrewRecognition] Starting local CSV sync...');
      setSyncProgress({ current: 0, total: 100 });

      const result = await syncFromCSVLocally();

      setSyncProgress({ current: result.totalRows, total: result.totalRows });
      console.log('[CrewRecognition] Local sync complete:', result.importedCount, 'entries');

      Alert.alert('Success', `Loaded ${result.importedCount} crew recognition entries from CSV`);
    } catch (error) {
      console.error('[CrewRecognition] Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [syncFromCSVLocally]);

  const handleExportResults = useCallback(() => {
    if (entries.length === 0) return;
    exportToCSV(
      entries,
      [
        { key: 'fullName', label: 'Full Name' },
        { key: 'department', label: 'Department' },
        { key: 'roleTitle', label: 'Role' },
        { key: 'shipName', label: 'Ship' },
        { key: 'sailStartDate', label: 'Start Date' },
        { key: 'sailEndDate', label: 'End Date' },
        { key: 'sourceText', label: 'Source' },
      ],
      `crew-recognition-${new Date().toISOString().split('T')[0]}.csv`
    );
  }, [entries]);

  const toggleShipFilter = useCallback((ship: string) => {
    const current = filters.shipNames;
    if (current.includes(ship)) {
      updateFilters({ shipNames: current.filter(s => s !== ship) });
    } else {
      updateFilters({ shipNames: [...current, ship] });
    }
  }, [filters.shipNames, updateFilters]);

  const toggleDeptFilter = useCallback((dept: string) => {
    const current = filters.departments;
    if (current.includes(dept)) {
      updateFilters({ departments: current.filter(d => d !== dept) });
    } else {
      updateFilters({ departments: [...current, dept] });
    }
  }, [filters.departments, updateFilters]);

  const allRoyalShips = useMemo(() => getAllShipNames().sort(), []);
  const sailingShips = useMemo(() => sailings.map(s => s.shipName), [sailings]);
  const uniqueShips = useMemo(
    () => Array.from(new Set([...allRoyalShips, ...sailingShips])).sort(),
    [allRoyalShips, sailingShips]
  );

  const uniqueDepts = useMemo(() => {
    const entryDepts = entries.map(e => e.department);
    return Array.from(new Set([...ALL_FILTER_DEPARTMENTS, ...entryDepts])).sort();
  }, [entries]);

  const totalPages = Math.ceil(entriesTotal / pageSize);
  const showMockData = stats.crewMemberCount === 0 && !statsLoading;
  const displayEntries = showMockData ? [] : entries;

  const activeFilterCount = filters.shipNames.length + filters.departments.length;

  const syncButtonLabel = useMemo(() => {
    if (syncProgress) {
      return `Syncing ${syncProgress.current}/${syncProgress.total}`;
    }
    if (isSyncing) return 'Syncing...';
    return 'Sync';
  }, [isSyncing, syncProgress]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0369A1', '#0284C7']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <UserCheck size={20} color={COLORS.white} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Crew Recognition</Text>
            <Text style={styles.headerSubtitle}>Track exceptional service</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={18} color="#0369A1" />
          <Text style={styles.addButtonText}>Add Crew</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#0369A1" />
          ) : (
            <RefreshCcw size={18} color="#0369A1" />
          )}
          <Text style={styles.syncButtonText}>{syncButtonLabel}</Text>
        </TouchableOpacity>
      </View>

      {syncProgress && (
        <View style={styles.syncProgressContainer}>
          <View style={styles.syncProgressBar}>
            <View
              style={[
                styles.syncProgressFill,
                { width: `${(syncProgress.current / syncProgress.total) * 100}%` as any },
              ]}
            />
          </View>
          <Text style={styles.syncProgressText}>
            Processing {syncProgress.current} of {syncProgress.total} rows...
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        {statsLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{showMockData ? 1 : stats.crewMemberCount}</Text>
              <Text style={styles.statLabel}>Crew Members</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{showMockData ? 0 : stats.recognitionEntryCount}</Text>
              <Text style={styles.statLabel}>Recognition Entries</Text>
            </View>
            <TouchableOpacity style={styles.exportButton} onPress={handleExportResults}>
              <Download size={16} color={COLORS.primary} />
              <Text style={styles.exportButtonText}>Export Results</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.surveyButton} onPress={() => setShowSurveyModal(true)}>
              <Text style={styles.surveyButtonText}>Survey List</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={filters.search}
            onChangeText={text => updateFilters({ search: text })}
            placeholder="Search crew name..."
            placeholderTextColor={COLORS.textTertiary}
          />
          {filters.search !== '' && (
            <TouchableOpacity onPress={() => updateFilters({ search: '' })}>
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? '#fff' : COLORS.primary} />
          <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.chipFilterSection}>
            <Text style={styles.filterLabel}>
              Ship{filters.shipNames.length > 0 ? ` (${filters.shipNames.length} selected)` : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScrollView}
              contentContainerStyle={styles.chipScrollContent}
            >
              <TouchableOpacity
                style={[styles.chip, filters.shipNames.length === 0 && styles.chipActive]}
                onPress={() => updateFilters({ shipNames: [] })}
              >
                <Text style={[styles.chipText, filters.shipNames.length === 0 && styles.chipTextActive]}>
                  All Ships
                </Text>
              </TouchableOpacity>
              {uniqueShips.map(ship => {
                const isSelected = filters.shipNames.includes(ship);
                return (
                  <TouchableOpacity
                    key={ship}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => toggleShipFilter(ship)}
                  >
                    {isSelected && <Check size={12} color="#fff" />}
                    <Text
                      style={[styles.chipText, isSelected && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {ship}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.chipFilterSection}>
            <Text style={styles.filterLabel}>
              Department{filters.departments.length > 0 ? ` (${filters.departments.length} selected)` : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScrollView}
              contentContainerStyle={styles.chipScrollContent}
            >
              <TouchableOpacity
                style={[styles.chip, filters.departments.length === 0 && styles.chipActive]}
                onPress={() => updateFilters({ departments: [] })}
              >
                <Text style={[styles.chipText, filters.departments.length === 0 && styles.chipTextActive]}>
                  All Depts
                </Text>
              </TouchableOpacity>
              {uniqueDepts.map(dept => {
                const isSelected = filters.departments.includes(dept);
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => toggleDeptFilter(dept)}
                  >
                    {isSelected && <Check size={12} color="#fff" />}
                    <Text
                      style={[styles.chipText, isSelected && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {dept}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <X size={14} color="#0369A1" />
              <Text style={styles.resetButtonText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsHeader}>
          Results ({showMockData ? 1 : entriesTotal})
        </Text>

        {entriesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : showMockData ? (
          <View style={styles.mockDataContainer}>
            <View style={styles.mockDataBanner}>
              <Text style={styles.mockDataBannerText}>Mock Data - Add real crew members to hide this</Text>
            </View>
            <View style={styles.mockCrewCard}>
              <View style={styles.mockCrewRow}>
                <Text style={styles.mockCrewLabel}>Name:</Text>
                <Text style={styles.mockCrewValue}>{MOCK_CREW_MEMBER.fullName}</Text>
              </View>
              <View style={styles.mockCrewRow}>
                <Text style={styles.mockCrewLabel}>Role:</Text>
                <Text style={styles.mockCrewValue}>{MOCK_CREW_MEMBER.roleTitle}</Text>
              </View>
              <View style={styles.mockCrewRow}>
                <Text style={styles.mockCrewLabel}>Department:</Text>
                <Text style={styles.mockCrewValue}>{MOCK_CREW_MEMBER.department}</Text>
              </View>
            </View>
          </View>
        ) : displayEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No recognition entries found</Text>
            <Text style={styles.emptySubtext}>
              Add crew members and link them to sailings to get started
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.table} horizontal showsHorizontalScrollIndicator={true}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.nameColumn]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, styles.deptColumn]}>Department</Text>
                  <Text style={[styles.tableHeaderCell, styles.roleColumn]}>Role</Text>
                  <Text style={[styles.tableHeaderCell, styles.shipColumn]}>Ship</Text>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>Start Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>End Date</Text>
                </View>

                {displayEntries.map((entry, index) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
                    onPress={() => setSelectedEntry(entry)}
                  >
                    <Text style={[styles.tableCell, styles.nameColumn]}>{entry.fullName}</Text>
                    <Text style={[styles.tableCell, styles.deptColumn]}>{entry.department}</Text>
                    <Text style={[styles.tableCell, styles.roleColumn]}>
                      {entry.roleTitle || 'N/A'}
                    </Text>
                    <Text style={[styles.tableCell, styles.shipColumn]}>{entry.shipName}</Text>
                    <Text style={[styles.tableCell, styles.dateColumn]}>
                      {entry.sailStartDate}
                    </Text>
                    <Text style={[styles.tableCell, styles.dateColumn]}>
                      {entry.sailEndDate}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
                  onPress={previousPage}
                  disabled={page === 1}
                >
                  <Text style={styles.pageButtonText}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}
                  onPress={nextPage}
                  disabled={page === totalPages}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <AddCrewMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={async (data) => {
          await createCrewMember({ ...data, department: data.department as Department, userId });
        }}
        sailings={sailings}
      />

      <RecognitionEntryDetailModal
        visible={!!selectedEntry}
        entry={selectedEntry}
        sailings={sailings}
        onClose={() => setSelectedEntry(null)}
        onUpdate={async (id, data) => {
          await updateRecognitionEntry({ id, ...data });
        }}
        onDelete={async (id) => {
          await deleteRecognitionEntry({ id });
        }}
      />

      <SurveyListModal
        visible={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        sailings={sailings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    marginTop: SPACING.lg,
    ...SHADOW.sm,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.3)',
  },
  addButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.3)',
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  syncProgressContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  syncProgressBar: {
    height: 6,
    backgroundColor: 'rgba(3, 105, 161, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  syncProgressFill: {
    height: 6,
    backgroundColor: '#0369A1',
    borderRadius: 3,
  },
  syncProgressText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#0369A1',
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingTop: 0,
  },
  statCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '700' as const,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#0369A1',
    backgroundColor: COLORS.white,
  },
  exportButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  surveyButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#0369A1',
    backgroundColor: COLORS.white,
  },
  surveyButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  filterBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  filterButtonActive: {
    backgroundColor: '#0369A1',
    borderColor: '#0369A1',
  },
  filterButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filtersPanel: {
    backgroundColor: 'rgba(3, 105, 161, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
    gap: SPACING.md,
  },
  chipFilterSection: {
    gap: SPACING.xs,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  chipScrollView: {
    flexGrow: 0,
  },
  chipScrollContent: {
    gap: 8,
    paddingRight: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(3, 105, 161, 0.4)',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#0369A1',
    borderColor: '#0369A1',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#0369A1',
  },
  chipTextActive: {
    color: '#fff',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(3, 105, 161, 0.1)',
  },
  resetButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  resultsContainer: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  resultsHeader: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 400,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  tableHeaderCell: {
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowEven: {
    backgroundColor: COLORS.bgSecondary,
  },
  tableCell: {
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
  nameColumn: {
    width: 150,
  },
  deptColumn: {
    width: 120,
  },
  roleColumn: {
    width: 120,
  },
  shipColumn: {
    width: 150,
  },
  dateColumn: {
    width: 100,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  pageButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  pageButtonDisabled: {
    opacity: 0.3,
  },
  pageButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  pageInfo: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  mockDataContainer: {
    padding: SPACING.md,
  },
  mockDataBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  mockDataBannerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#D97706',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  mockCrewCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mockCrewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  mockCrewLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  mockCrewValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
});
