import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, X, Check, Ship, Filter } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useSlotMachineFilters } from '@/hooks/useSlotMachineFilters';
import { useDeckPlan } from '@/state/DeckPlanProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { SlotManufacturer, MachineEncyclopediaEntry } from '@/types/models';

type FilterModalType = 'manufacturer' | 'ship' | null;

interface MachineRowProps {
  machine: MachineEncyclopediaEntry;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const MachineRow = React.memo(function MachineRow({ machine, isSelected, onToggle }: MachineRowProps) {
  return (
    <TouchableOpacity
      style={[styles.machineRow, isSelected && styles.machineRowSelected]}
      onPress={() => onToggle(machine.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Check color={COLORS.white} size={18} strokeWidth={3} />}
      </View>
      <View style={styles.machineInfo}>
        <Text style={styles.machineName} numberOfLines={1}>{machine.machineName}</Text>
        <Text style={styles.manufacturerText} numberOfLines={1}>{machine.manufacturer}</Text>
      </View>
      {machine.apMetadata?.persistenceType && machine.apMetadata.persistenceType !== 'None' && (
        <View style={styles.apIndicator}>
          <Text style={styles.apIndicatorText}>AP</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function AddMachinesToShipScreen() {
  const router = useRouter();
  const { globalLibrary } = useSlotMachineLibrary();
  const { filteredLibrary: filteredGlobalLibrary, searchQuery, setSearchQuery, filterManufacturers, setFilterManufacturers, sortBy, setSortBy } = useSlotMachineFilters(globalLibrary);
  const { addMapping, getMappingsByShip } = useDeckPlan();
  const { bookedCruises } = useCoreData();

  const [selectedShip, setSelectedShip] = useState<string>('');
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const [filterModal, setFilterModal] = useState<FilterModalType>(null);
  const [isAdding, setIsAdding] = useState(false);

  const availableShips = useMemo(() => {
    const shipNames = new Set<string>();
    bookedCruises.forEach(cruise => {
      if (cruise.shipName) {
        shipNames.add(cruise.shipName);
      }
    });
    return Array.from(shipNames).sort();
  }, [bookedCruises]);

  const allManufacturers: SlotManufacturer[] = ['Aristocrat', 'IGT', 'Konami', 'Everi', 'Light & Wonder', 'AGS', 'Ainsworth', 'Bally', 'Other'];

  const displayedMachines = useMemo(() => {
    return filteredGlobalLibrary;
  }, [filteredGlobalLibrary]);

  const selectAll = () => {
    const newSelected = new Set(displayedMachines.map(m => m.id));
    setSelectedMachines(newSelected);
  };

  const deselectAll = () => {
    setSelectedMachines(new Set());
  };

  const toggleMachine = useCallback((machineId: string) => {
    setSelectedMachines(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(machineId)) {
        newSelected.delete(machineId);
      } else {
        newSelected.add(machineId);
      }
      return newSelected;
    });
  }, []);

  const keyExtractor = useCallback((item: MachineEncyclopediaEntry) => item.id, []);

  const renderMachineRow = useCallback(({ item }: ListRenderItemInfo<MachineEncyclopediaEntry>) => (
    <MachineRow machine={item} isSelected={selectedMachines.has(item.id)} onToggle={toggleMachine} />
  ), [selectedMachines, toggleMachine]);

  const ListEmpty = useMemo(() => (
    <View style={styles.emptyState}>
      <Search color={COLORS.textDarkGrey} size={48} strokeWidth={1.5} />
      <Text style={styles.emptyStateText}>No machines found</Text>
      <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
    </View>
  ), []);

  const toggleManufacturer = (manufacturer: SlotManufacturer) => {
    const current = [...filterManufacturers];
    const index = current.indexOf(manufacturer);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(manufacturer);
    }
    setFilterManufacturers(current);
  };

  const handleAddMachinesToShip = async () => {
    if (!selectedShip || selectedMachines.size === 0) return;

    try {
      setIsAdding(true);
      console.log('[AddMachinesToShip] Adding', selectedMachines.size, 'machines to', selectedShip);

      const existingMappings = getMappingsByShip(selectedShip);
      const existingMachineIds = new Set(existingMappings.map(m => m.machineId));

      for (const machineId of Array.from(selectedMachines)) {
        if (!existingMachineIds.has(machineId)) {
          await addMapping({
            machineId,
            shipName: selectedShip,
            shipClass: 'Edge',
            deckNumber: 5,
            deckName: 'Casino Deck',
            zoneId: 'main-floor',
            zoneName: 'Main Floor',
            slotId: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            slotNumber: existingMappings.length + 1,
            x: 0,
            y: 0,
            notes: 'Added via bulk add',
            lastSeen: new Date().toISOString(),
          });
        }
      }

      console.log('[AddMachinesToShip] Successfully added machines');
      router.back();
    } catch (error) {
      console.error('[AddMachinesToShip] Error adding machines:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterManufacturers([]);
  };

  const hasActiveFilters = searchQuery.length > 0 || filterManufacturers.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color={COLORS.navyDeep} size={24} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Add Machines to Ship</Text>
            {displayedMachines.length > 0 && (
              <Text style={styles.headerSubtitle}>
                {selectedMachines.size} of {displayedMachines.length} selected
              </Text>
            )}
          </View>
        </View>

        <View style={styles.shipSelectorContainer}>
          <Text style={styles.sectionLabel}>Select Ship</Text>
          <TouchableOpacity
            style={styles.shipSelector}
            onPress={() => setFilterModal('ship')}
            activeOpacity={0.7}
          >
            <Ship color={selectedShip ? COLORS.navyDeep : COLORS.textDarkGrey} size={20} strokeWidth={2} />
            <Text style={[styles.shipSelectorText, !selectedShip && styles.placeholderText]}>
              {selectedShip || 'Choose a ship...'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={COLORS.textDarkGrey} size={20} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search machines..."
              placeholderTextColor={COLORS.textDarkGrey}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X color={COLORS.textDarkGrey} size={20} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterButton, filterManufacturers.length > 0 && styles.filterButtonActive]}
            onPress={() => setFilterModal('manufacturer')}
            activeOpacity={0.7}
          >
            <Filter color={filterManufacturers.length > 0 ? COLORS.white : COLORS.navyDeep} size={16} strokeWidth={2} />
            <Text style={[styles.filterButtonText, filterManufacturers.length > 0 && styles.filterButtonTextActive]}>
              Manufacturer {filterManufacturers.length > 0 && `(${filterManufacturers.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, sortBy !== 'name' && styles.filterButtonActive]}
            onPress={() => {
              const sortOptions: ('name' | 'manufacturer' | 'year' | 'volatility')[] = ['name', 'manufacturer', 'year', 'volatility'];
              const currentIndex = sortOptions.indexOf(sortBy);
              const nextIndex = (currentIndex + 1) % sortOptions.length;
              setSortBy(sortOptions[nextIndex]);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterButtonText, sortBy !== 'name' && styles.filterButtonTextActive]}>
              Sort: {sortBy === 'name' ? 'Name' : sortBy === 'manufacturer' ? 'Manufacturer' : sortBy === 'year' ? 'Year' : 'Volatility'}
            </Text>
          </TouchableOpacity>

          <View style={styles.spacer} />

          {displayedMachines.length > 0 && (
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={selectedMachines.size === displayedMachines.length ? deselectAll : selectAll}
              activeOpacity={0.7}
            >
              <Text style={styles.selectAllButtonText}>
                {selectedMachines.size === displayedMachines.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          )}

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
              <X color={COLORS.navyDeep} size={16} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={displayedMachines}
          renderItem={renderMachineRow}
          keyExtractor={keyExtractor}
          style={styles.scrollView}
          contentContainerStyle={styles.machinesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmpty}
          extraData={selectedMachines}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
        />

        {selectedShip && selectedMachines.size > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addButton, isAdding && styles.addButtonDisabled]}
              onPress={handleAddMachinesToShip}
              disabled={isAdding}
              activeOpacity={0.7}
            >
              {isAdding ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Check color={COLORS.white} size={20} strokeWidth={2} />
                  <Text style={styles.addButtonText}>
                    Add {selectedMachines.size} machine{selectedMachines.size !== 1 ? 's' : ''} to {selectedShip}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {filterModal === 'ship' && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              onPress={() => setFilterModal(null)}
              activeOpacity={1}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Ship</Text>
                <TouchableOpacity onPress={() => setFilterModal(null)}>
                  <X color={COLORS.navyDeep} size={24} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                {availableShips.map((ship) => (
                  <TouchableOpacity
                    key={ship}
                    style={[styles.modalItem, selectedShip === ship && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedShip(ship);
                      setFilterModal(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, selectedShip === ship && styles.modalItemTextSelected]}>
                      {ship}
                    </Text>
                    {selectedShip === ship && (
                      <Check color={COLORS.navyDeep} size={20} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                ))}
                {availableShips.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No ships available</Text>
                    <Text style={styles.emptyStateSubtext}>Add booked cruises first</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {filterModal === 'manufacturer' && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              onPress={() => setFilterModal(null)}
              activeOpacity={1}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter by Manufacturer</Text>
                <TouchableOpacity onPress={() => setFilterModal(null)}>
                  <X color={COLORS.navyDeep} size={24} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                {allManufacturers.map((manufacturer) => {
                  const isSelected = filterManufacturers.includes(manufacturer);
                  return (
                    <TouchableOpacity
                      key={manufacturer}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => toggleManufacturer(manufacturer)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                        {manufacturer}
                      </Text>
                      {isSelected && (
                        <Check color={COLORS.navyDeep} size={20} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setFilterModal(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  shipSelectorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  shipSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 12,
  },
  shipSelectorText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.textDarkGrey,
    fontWeight: '400' as const,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.navyDeep,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: COLORS.navyDeep,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  clearButton: {
    padding: 8,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 8,
  },
  spacer: {
    flex: 1,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.navyDeep,
    borderRadius: 8,
  },
  selectAllButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  machinesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 12,
  },
  machineRowSelected: {
    backgroundColor: COLORS.bgSecondary,
    borderColor: COLORS.navyDeep,
    borderWidth: 2,
  },
  machineInfo: {
    flex: 1,
    gap: 2,
  },
  machineName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  manufacturerText: {
    fontSize: 13,
    color: COLORS.textDarkGrey,
    fontWeight: '500' as const,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxSelected: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  apIndicator: {
    backgroundColor: COLORS.money,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  apIndicatorText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textDarkGrey,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalItemSelected: {
    backgroundColor: COLORS.bgSecondary,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  modalItemTextSelected: {
    fontWeight: '600' as const,
  },
  modalDoneButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
