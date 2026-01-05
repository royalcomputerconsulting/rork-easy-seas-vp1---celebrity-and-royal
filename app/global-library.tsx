import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, X, Plus, ChevronDown, Ship } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import type { SlotManufacturer, MachineVolatility, PersistenceType } from '@/types/models';

export default function GlobalLibraryScreen() {
  const router = useRouter();
  const {
    filteredGlobalLibrary,
    searchQuery,
    setSearchQuery,
    filterManufacturers,
    setFilterManufacturers,
    filterVolatility,
    setFilterVolatility,
    filterPersistence,
    setFilterPersistence,
    filterHasMHB,
    setFilterHasMHB,
    sortBy,
    setSortBy,
    clearAllFilters,
    addMachineFromGlobal,
  } = useSlotMachineLibrary();

  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [sortModalVisible, setSortModalVisible] = useState<boolean>(false);

  const handleAddMachine = async (globalMachineId: string) => {
    const id = await addMachineFromGlobal(globalMachineId);
    console.log(`[GlobalLibrary] Added machine: ${id}`);
  };

  const activeFilterCount = 
    filterManufacturers.length + 
    filterVolatility.length + 
    filterPersistence.length +
    (filterHasMHB !== undefined ? 1 : 0);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Global Library',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 20,
          },
        }} 
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search color={COLORS.textMuted} size={20} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search machines..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <X color={COLORS.textMuted} size={20} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.7}
            >
              <Filter color={activeFilterCount > 0 ? COLORS.white : COLORS.navyDeep} size={18} strokeWidth={2} />
              {activeFilterCount > 0 && (
                <Text style={styles.filterButtonText}>{activeFilterCount}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sortButton}
              onPress={() => setSortModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.sortButtonText}>
                {sortBy === 'name' ? 'Name' : sortBy === 'manufacturer' ? 'Manufacturer' : sortBy === 'year' ? 'Year' : 'Volatility'}
              </Text>
              <ChevronDown color={COLORS.navyDeep} size={16} strokeWidth={2} />
            </TouchableOpacity>

            {activeFilterCount > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearAllFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resultCount}>
            {filteredGlobalLibrary.length} machines found
          </Text>

          {filteredGlobalLibrary.map((machine) => (
            <View key={machine.id} style={styles.machineCard}>
              <TouchableOpacity
                style={styles.machineContent}
                onPress={() => router.push(`/machine-detail/${machine.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.machineHeader}>
                  <View style={styles.machineTitleRow}>
                    <Text style={styles.machineName} numberOfLines={2}>
                      {machine.machineName}
                    </Text>
                    {machine.isInMyAtlas && (
                      <View style={styles.addedBadge}>
                        <Text style={styles.addedBadgeText}>Added</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.machineManufacturer}>{machine.manufacturer}</Text>
                </View>

                <View style={styles.machineDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Series:</Text>
                    <Text style={styles.detailValue}>{machine.gameSeries || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Volatility:</Text>
                    <Text style={styles.detailValue}>{machine.volatility}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Year:</Text>
                    <Text style={styles.detailValue}>{machine.releaseYear}</Text>
                  </View>
                  {machine.apMetadata && machine.apMetadata.persistenceType !== 'None' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>AP Type:</Text>
                      <View style={styles.apTypeBadge}>
                        <Text style={styles.apTypeText}>{machine.apMetadata.persistenceType}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {!machine.isInMyAtlas && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddMachine(machine.id)}
                  activeOpacity={0.7}
                >
                  <Plus color={COLORS.white} size={18} strokeWidth={2.5} />
                  <Text style={styles.addButtonText}>Add to Atlas</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {filteredGlobalLibrary.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No machines found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.bulkAddButton}
          onPress={() => router.push('/add-machines-to-ship' as any)}
          activeOpacity={0.7}
        >
          <Ship color={COLORS.white} size={20} strokeWidth={2} />
          <Text style={styles.bulkAddButtonText}>Bulk Add to Ship</Text>
        </TouchableOpacity>

        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <X color={COLORS.navyDeep} size={24} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.filterSectionTitle}>Manufacturer</Text>
                <View style={styles.chipRow}>
                  {['Aristocrat', 'IGT', 'Konami', 'Light & Wonder', 'Bally', 'Everi'].map((mfg) => (
                    <TouchableOpacity
                      key={mfg}
                      style={[
                        styles.chip,
                        filterManufacturers.includes(mfg as SlotManufacturer) && styles.chipActive
                      ]}
                      onPress={() => {
                        if (filterManufacturers.includes(mfg as SlotManufacturer)) {
                          setFilterManufacturers(filterManufacturers.filter(m => m !== mfg));
                        } else {
                          setFilterManufacturers([...filterManufacturers, mfg as SlotManufacturer]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        filterManufacturers.includes(mfg as SlotManufacturer) && styles.chipTextActive
                      ]}>
                        {mfg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>Volatility</Text>
                <View style={styles.chipRow}>
                  {['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High'].map((vol) => (
                    <TouchableOpacity
                      key={vol}
                      style={[
                        styles.chip,
                        filterVolatility.includes(vol as MachineVolatility) && styles.chipActive
                      ]}
                      onPress={() => {
                        if (filterVolatility.includes(vol as MachineVolatility)) {
                          setFilterVolatility(filterVolatility.filter(v => v !== vol));
                        } else {
                          setFilterVolatility([...filterVolatility, vol as MachineVolatility]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        filterVolatility.includes(vol as MachineVolatility) && styles.chipTextActive
                      ]}>
                        {vol}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>Persistence Type</Text>
                <View style={styles.chipRow}>
                  {['True', 'Pseudo', 'None'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        filterPersistence.includes(type as PersistenceType) && styles.chipActive
                      ]}
                      onPress={() => {
                        if (filterPersistence.includes(type as PersistenceType)) {
                          setFilterPersistence(filterPersistence.filter(p => p !== type));
                        } else {
                          setFilterPersistence([...filterPersistence, type as PersistenceType]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        filterPersistence.includes(type as PersistenceType) && styles.chipTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterSectionTitle}>Must Hit By</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      filterHasMHB === true && styles.chipActive
                    ]}
                    onPress={() => setFilterHasMHB(filterHasMHB === true ? undefined : true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.chipText,
                      filterHasMHB === true && styles.chipTextActive
                    ]}>
                      Has MHB
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setFilterModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={sortModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setSortModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSortModalVisible(false)}
          >
            <View style={styles.sortModal}>
              {(['name', 'manufacturer', 'year', 'volatility'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortOption,
                    sortBy === option && styles.sortOptionActive
                  ]}
                  onPress={() => {
                    setSortBy(option);
                    setSortModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option && styles.sortOptionTextActive
                  ]}>
                    {option === 'name' ? 'Name' : option === 'manufacturer' ? 'Manufacturer' : option === 'year' ? 'Year' : 'Volatility'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
  searchSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.navyDeep,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterButtonActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flex: 1,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.error,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    marginBottom: 16,
  },
  machineCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
    overflow: 'hidden',
  },
  machineContent: {
    padding: 16,
  },
  machineHeader: {
    marginBottom: 12,
  },
  machineTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  machineName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  addedBadge: {
    backgroundColor: COLORS.money,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addedBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  machineManufacturer: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  machineDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  apTypeBadge: {
    backgroundColor: COLORS.moneyBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  apTypeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.money,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textDarkGrey,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  modalScroll: {
    paddingHorizontal: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginTop: 16,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  applyButton: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  sortModal: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 100,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sortOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sortOptionActive: {
    backgroundColor: COLORS.bgSecondary,
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  sortOptionTextActive: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
  },
  bulkAddButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.loyalty,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bulkAddButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
