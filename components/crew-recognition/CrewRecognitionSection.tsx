import React, { useState } from 'react';
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
import { Users, Plus, Download, Search, Filter, X, RefreshCcw, UserCheck } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { useAuth } from '@/state/AuthProvider';
import { trpc } from '@/lib/trpc';
import { AddCrewMemberModal } from './AddCrewMemberModal';
import { RecognitionEntryDetailModal } from './RecognitionEntryDetailModal';
import { SurveyListModal } from './SurveyListModal';
import { exportToCSV } from '@/lib/csv-export';
import { DEPARTMENTS } from '@/types/crew-recognition';
import type { RecognitionEntryWithCrew, Department } from '@/types/crew-recognition';

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
  const auth = useAuth();
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
    refetch,
  } = useCrewRecognition();
  
  const syncFromCSVMutation = trpc.crewRecognition.syncFromCSV.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecognitionEntryWithCrew | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showShipPicker, setShowShipPicker] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const userEmail = auth.authenticatedEmail?.toLowerCase().trim();
      const isAdminOrSpecial = userEmail === 'scott.merlis1@gmail.com' || userEmail === 's@a.com';
      
      if (isAdminOrSpecial) {
        console.log('[CrewRecognition] Admin/Special user sync - loading from CSV file');
        try {
          const response = await fetch('https://rork.app/pa/g131hcw7cxhvg2godfob0/Crew_Recognition.csv');
          if (!response.ok) {
            throw new Error('Failed to fetch CSV file');
          }
          const csvText = await response.text();
          
          await syncFromCSVMutation.mutateAsync({ csvText, userId });
          Alert.alert('Success', 'Synced crew data from CSV file');
        } catch (error) {
          console.error('[CrewRecognition] CSV sync error:', error);
          Alert.alert('Error', 'Failed to sync from CSV file. Syncing from database instead.');
          await refetch();
        }
      } else {
        console.log('[CrewRecognition] Regular user sync - loading from database');
        await refetch();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportResults = () => {
    if (entries.length === 0) {
      return;
    }

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
  };

  const uniqueShips = Array.from(new Set(sailings.map(s => s.shipName))).sort();
  const totalPages = Math.ceil(entriesTotal / pageSize);
  
  const showMockData = stats.crewMemberCount === 0 && !statsLoading;
  const displayEntries = showMockData ? [] : entries;

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
          <RefreshCcw size={18} color="#0369A1" />
          <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing...' : 'Sync'}</Text>
        </TouchableOpacity>
      </View>

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
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={COLORS.primary} />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Ship</Text>
              <TouchableOpacity
                style={styles.filterPicker}
                onPress={() => setShowShipPicker(!showShipPicker)}
              >
                <Text style={filters.shipName ? styles.filterPickerText : styles.filterPickerPlaceholder}>
                  {filters.shipName || 'All ships'}
                </Text>
              </TouchableOpacity>
              {showShipPicker && (
                <View style={styles.pickerOptions}>
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      updateFilters({ shipName: '' });
                      setShowShipPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>All ships</Text>
                  </TouchableOpacity>
                  {uniqueShips.map(ship => (
                    <TouchableOpacity
                      key={ship}
                      style={styles.pickerOption}
                      onPress={() => {
                        updateFilters({ shipName: ship });
                        setShowShipPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{ship}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Department</Text>
              <TouchableOpacity
                style={styles.filterPicker}
                onPress={() => setShowDepartmentPicker(!showDepartmentPicker)}
              >
                <Text style={filters.department ? styles.filterPickerText : styles.filterPickerPlaceholder}>
                  {filters.department || 'All departments'}
                </Text>
              </TouchableOpacity>
              {showDepartmentPicker && (
                <View style={styles.pickerOptions}>
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      updateFilters({ department: '' });
                      setShowDepartmentPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>All departments</Text>
                  </TouchableOpacity>
                  {DEPARTMENTS.map(dept => (
                    <TouchableOpacity
                      key={dept}
                      style={styles.pickerOption}
                      onPress={() => {
                        updateFilters({ department: dept });
                        setShowDepartmentPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{dept}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
            <Text style={styles.resetButtonText}>Reset Filters</Text>
          </TouchableOpacity>
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
  filterButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  filtersPanel: {
    backgroundColor: 'rgba(3, 105, 161, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterField: {
    flex: 1,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  filterPicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: '#fff',
  },
  filterPickerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
  filterPickerPlaceholder: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textTertiary,
  },
  pickerOptions: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 200,
    backgroundColor: '#fff',
  },
  pickerOption: {
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
  resetButton: {
    alignSelf: 'flex-start',
    padding: SPACING.sm,
  },
  resetButtonText: {
    color: COLORS.primary,
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
