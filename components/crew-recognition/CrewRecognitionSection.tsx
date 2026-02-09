import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Users, Plus, Download, Search, Filter, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { AddCrewMemberModal } from './AddCrewMemberModal';
import { RecognitionEntryDetailModal } from './RecognitionEntryDetailModal';
import { SurveyListModal } from './SurveyListModal';
import { exportToCSV } from '@/lib/csv-export';
import { DEPARTMENTS } from '@/types/crew-recognition';
import type { RecognitionEntryWithCrew } from '@/types/crew-recognition';

export function CrewRecognitionSection() {
  const {
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
  } = useCrewRecognition();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecognitionEntryWithCrew | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showShipPicker, setShowShipPicker] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={24} color={COLORS.primary} />
          <Text style={styles.title}>Crew Recognition</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Crew</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {statsLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.crewMemberCount}</Text>
              <Text style={styles.statLabel}>Crew Members</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.recognitionEntryCount}</Text>
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
          Results ({entriesTotal})
        </Text>

        {entriesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No recognition entries found</Text>
            <Text style={styles.emptySubtext}>
              Add crew members and link them to sailings to get started
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.table} horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.nameColumn]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, styles.deptColumn]}>Department</Text>
                  <Text style={[styles.tableHeaderCell, styles.roleColumn]}>Role</Text>
                  <Text style={[styles.tableHeaderCell, styles.shipColumn]}>Ship</Text>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>Start Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.dateColumn]}>End Date</Text>
                </View>

                {entries.map((entry, index) => (
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
        onSubmit={createCrewMember}
        sailings={sailings}
      />

      <RecognitionEntryDetailModal
        visible={!!selectedEntry}
        entry={selectedEntry}
        sailings={sailings}
        onClose={() => setSelectedEntry(null)}
        onUpdate={updateRecognitionEntry}
        onDelete={deleteRecognitionEntry}
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
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  addButtonText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    minWidth: 120,
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
    borderColor: COLORS.primary,
  },
  exportButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  surveyButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  surveyButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  filterBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
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
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
    marginTop: SPACING.md,
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
    backgroundColor: COLORS.backgroundSecondary,
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
    backgroundColor: COLORS.backgroundSecondary,
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
});
