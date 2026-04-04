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
  Modal,
  Platform,
} from 'react-native';
import { Users, Plus, Download, Search, Filter, X, RefreshCcw, UserCheck, Check, Ship, Calendar, ChevronRight, FileText, Upload } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { useCoreData } from '@/state/CoreDataProvider';
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

export const CrewRecognitionSection = React.memo(function CrewRecognitionSection() {
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
    createCrewMember,
    updateRecognitionEntry,
    deleteRecognitionEntry,
    syncFromCSVLocally,
    importFromTextList,
  } = useCrewRecognition();

  const { bookedCruises } = useCoreData();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecognitionEntryWithCrew | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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

  const handleImportTextList = useCallback(async () => {
    if (!importText.trim()) {
      Alert.alert('Empty Input', 'Please paste a crew list or import a text file.');
      return;
    }
    setIsImporting(true);
    try {
      console.log('[CrewRecognition] Importing text list, length:', importText.length);
      const result = await importFromTextList(importText.trim());
      const messages: string[] = [];
      messages.push(`Imported ${result.importedCount} crew member(s).`);
      if (result.skippedDuplicates > 0) {
        messages.push(`Skipped ${result.skippedDuplicates} duplicate(s) within the list.`);
      }
      if (result.duplicatesInExisting > 0) {
        messages.push(`Skipped ${result.duplicatesInExisting} already existing member(s).`);
      }
      Alert.alert('Import Complete', messages.join('\n'));
      setImportText('');
      setShowImportModal(false);
    } catch (error) {
      console.error('[CrewRecognition] Text import error:', error);
      Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to import crew list.');
    } finally {
      setIsImporting(false);
    }
  }, [importText, importFromTextList]);

  const handlePickTextFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/*', '*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('[CrewRecognition] File pick cancelled');
        return;
      }
      const file = result.assets[0];
      console.log('[CrewRecognition] File picked:', file.name, file.uri);
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const text = await response.text();
        setImportText(text);
      } else {
        const text = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setImportText(text);
      }
    } catch (error) {
      console.error('[CrewRecognition] File pick error:', error);
      Alert.alert('Error', 'Failed to read the file. Please try pasting the content instead.');
    }
  }, []);

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
          style={styles.addButton}
          onPress={() => setShowImportModal(true)}
        >
          <Upload size={18} color="#0369A1" />
          <Text style={styles.addButtonText}>Import List</Text>
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

      {syncProgress ? (
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
            {`Processing ${syncProgress.current} of ${syncProgress.total} rows...`}
          </Text>
        </View>
      ) : null}

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
          {filters.search !== '' ? (
            <TouchableOpacity onPress={() => updateFilters({ search: '' })}>
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? '#fff' : COLORS.primary} />
          <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterListSection}>
            <Text style={styles.filterLabel}>
              {filters.shipNames.length > 0 ? `Ship (${filters.shipNames.length} selected)` : 'Ship'}
            </Text>
            <View style={styles.filterListContainer}>
              <ScrollView
                style={styles.filterListScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
              >
                <TouchableOpacity
                  style={[styles.filterRow, filters.shipNames.length === 0 && styles.filterRowActive]}
                  onPress={() => updateFilters({ shipNames: [] })}
                >
                  <View style={[styles.filterCheckbox, filters.shipNames.length === 0 && styles.filterCheckboxActive]}>
                    {filters.shipNames.length === 0 && <Check size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.filterRowText, filters.shipNames.length === 0 && styles.filterRowTextActive]}>
                    All Ships
                  </Text>
                </TouchableOpacity>
                {uniqueShips.map(ship => {
                  const isSelected = filters.shipNames.includes(ship);
                  return (
                    <TouchableOpacity
                      key={ship}
                      style={[styles.filterRow, isSelected && styles.filterRowActive]}
                      onPress={() => toggleShipFilter(ship)}
                    >
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxActive]}>
                        {isSelected && <Check size={12} color="#fff" />}
                      </View>
                      <Text style={[styles.filterRowText, isSelected && styles.filterRowTextActive]} numberOfLines={1}>
                        {ship}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.filterListSection}>
            <Text style={styles.filterLabel}>
              {filters.departments.length > 0 ? `Department (${filters.departments.length} selected)` : 'Department'}
            </Text>
            <View style={styles.filterListContainer}>
              <ScrollView
                style={styles.filterListScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
              >
                <TouchableOpacity
                  style={[styles.filterRow, filters.departments.length === 0 && styles.filterRowActive]}
                  onPress={() => updateFilters({ departments: [] })}
                >
                  <View style={[styles.filterCheckbox, filters.departments.length === 0 && styles.filterCheckboxActive]}>
                    {filters.departments.length === 0 && <Check size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.filterRowText, filters.departments.length === 0 && styles.filterRowTextActive]}>
                    All Depts
                  </Text>
                </TouchableOpacity>
                {uniqueDepts.map(dept => {
                  const isSelected = filters.departments.includes(dept);
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.filterRow, isSelected && styles.filterRowActive]}
                      onPress={() => toggleDeptFilter(dept)}
                    >
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxActive]}>
                        {isSelected && <Check size={12} color="#fff" />}
                      </View>
                      <Text style={[styles.filterRowText, isSelected && styles.filterRowTextActive]} numberOfLines={1}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {activeFilterCount > 0 ? (
            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <X size={14} color="#0369A1" />
              <Text style={styles.resetButtonText}>Clear all filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsHeader}>
          {`Results (${showMockData ? 1 : entriesTotal})`}
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
          <View style={styles.cardList}>
              {displayEntries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.crewCard}
                  onPress={() => setSelectedEntry(entry)}
                  activeOpacity={0.7}
                >
                  <View style={styles.crewCardAccent} />
                  <View style={styles.crewCardContent}>
                    <View style={styles.crewCardRow1}>
                      <View style={styles.crewCardNameBlock}>
                        <Text style={styles.crewCardName} numberOfLines={1}>{entry.fullName}</Text>
                        <View style={styles.crewCardMetaInline}>
                          {entry.roleTitle ? (
                            <Text style={styles.crewCardRole} numberOfLines={1}>{entry.roleTitle}</Text>
                          ) : null}
                          {entry.roleTitle && entry.department ? (
                            <Text style={styles.crewCardMetaDot}>{"·"}</Text>
                          ) : null}
                          {entry.department ? (
                            <Text style={styles.crewCardDept} numberOfLines={1}>{entry.department}</Text>
                          ) : null}
                        </View>
                      </View>
                      <ChevronRight size={14} color="#94A3B8" />
                    </View>
                    <View style={styles.crewCardRow2}>
                      <Ship size={10} color="#0369A1" />
                      <Text style={styles.crewCardShip} numberOfLines={1}>{entry.shipName || 'Unknown Ship'}</Text>
                      <Text style={styles.crewCardDateSep}>{"•"}</Text>
                      <Calendar size={10} color="#6B7280" />
                      <Text style={styles.crewCardDate} numberOfLines={1}>
                        {entry.sailStartDate || 'Unknown Date'}
                        {entry.sailEndDate && entry.sailEndDate !== entry.sailStartDate ? ` – ${entry.sailEndDate}` : ''}
                      </Text>
                    </View>
                    {entry.crewNotes && String(entry.crewNotes).trim() ? (
                      <Text style={styles.crewCardNotes} numberOfLines={1}>{String(entry.crewNotes)}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
        )}
      </View>

      <AddCrewMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={async (data) => {
          await createCrewMember({ ...data, department: data.department as Department, userId });
        }}
        sailings={sailings}
        bookedCruises={bookedCruises}
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

      <Modal visible={showImportModal} animationType="slide" transparent>
        <View style={styles.importModalOverlay}>
          <View style={styles.importModalContent}>
            <View style={styles.importModalHeader}>
              <FileText size={24} color="#0369A1" />
              <Text style={styles.importModalTitle}>Import Crew List</Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); setImportText(''); }} style={styles.importModalClose}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.importModalBody}>
              <Text style={styles.importModalHint}>
                Paste a list starting with the ship name and sailing date on the first line, followed by one crew member per line.
              </Text>
              <View style={styles.importModalExample}>
                <Text style={styles.importModalExampleTitle}>Example format:</Text>
                <Text style={styles.importModalExampleText}>{"Liberty of the Seas, 2026-03-15, 2026-03-22\nJohn Smith, Casino, Dealer\nJane Doe, Beverage, Bartender\nBob Johnson, Housekeeping"}</Text>
              </View>

              <TouchableOpacity style={styles.importFileButton} onPress={handlePickTextFile}>
                <Upload size={16} color="#0369A1" />
                <Text style={styles.importFileButtonText}>Import from Text File</Text>
              </TouchableOpacity>

              <Text style={styles.importModalLabel}>Or paste crew list below:</Text>
              <TextInput
                style={styles.importTextArea}
                value={importText}
                onChangeText={setImportText}
                placeholder={"Liberty of the Seas, 2026-03-15, 2026-03-22\nJohn Smith, Casino, Dealer\nJane Doe, Beverage"}
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.importModalFooter}>
              <TouchableOpacity style={styles.importCancelButton} onPress={() => { setShowImportModal(false); setImportText(''); }}>
                <Text style={styles.importCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importSubmitButton, (isImporting || !importText.trim()) && styles.importSubmitButtonDisabled]}
                onPress={handleImportTextList}
                disabled={isImporting || !importText.trim()}
              >
                {isImporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.importSubmitButtonText}>Import Crew</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

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
  filterListSection: {
    gap: SPACING.xs,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  filterListContainer: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
    overflow: 'hidden',
  },
  filterListScroll: {
    maxHeight: 180,
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 105, 161, 0.08)',
  },
  filterRowActive: {
    backgroundColor: 'rgba(3, 105, 161, 0.06)',
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(3, 105, 161, 0.4)',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCheckboxActive: {
    backgroundColor: '#0369A1',
    borderColor: '#0369A1',
  },
  filterRowText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#334155',
    flex: 1,
  },
  filterRowTextActive: {
    color: '#0369A1',
    fontWeight: '600' as const,
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
  cardList: {
    gap: 4,
  },
  crewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.1)',
    ...SHADOW.sm,
  },
  crewCardAccent: {
    width: 3,
    backgroundColor: '#0369A1',
  },
  crewCardContent: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 1,
  },
  crewCardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  crewCardNameBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crewCardName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1E293B',
    flexShrink: 1,
  },
  crewCardMetaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  crewCardRole: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#0369A1',
  },
  crewCardMetaDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  crewCardDept: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  crewCardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  crewCardShip: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#0369A1',
    flexShrink: 1,
  },
  crewCardDateSep: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  crewCardDate: {
    fontSize: 10,
    color: '#6B7280',
    flexShrink: 1,
  },
  crewCardNotes: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic' as const,
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
  importModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  importModalContent: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  importModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  importModalTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  importModalClose: {
    padding: SPACING.xs,
  },
  importModalBody: {
    padding: SPACING.lg,
  },
  importModalHint: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  importModalExample: {
    backgroundColor: 'rgba(3, 105, 161, 0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  importModalExampleTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#0369A1',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  importModalExampleText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    fontFamily: undefined,
  },
  importFileButton: {
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
    marginBottom: SPACING.md,
  },
  importFileButtonText: {
    color: '#0369A1',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  importModalLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  importTextArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
    minHeight: 160,
    textAlignVertical: 'top' as const,
  },
  importModalFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  importCancelButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  importCancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  importSubmitButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#0369A1',
    alignItems: 'center',
  },
  importSubmitButtonDisabled: {
    opacity: 0.5,
  },
  importSubmitButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
