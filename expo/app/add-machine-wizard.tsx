import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Platform } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import type { SlotManufacturer, MachineVolatility, CabinetType, PersistenceType, MachineEncyclopediaEntry } from '@/types/models';

interface WizardMachineRowProps {
  machine: MachineEncyclopediaEntry;
  onSelect: (id: string) => void;
}

const WizardMachineRow = React.memo(function WizardMachineRow({ machine, onSelect }: WizardMachineRowProps) {
  return (
    <TouchableOpacity
      style={styles.machineRow}
      onPress={() => onSelect(machine.id)}
      activeOpacity={0.7}
    >
      <View style={styles.machineInfo}>
        <Text style={styles.machineName}>{machine.machineName}</Text>
        <Text style={styles.machineDetails}>
          {machine.manufacturer} • {machine.volatility} • {machine.releaseYear}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

type WizardStep = 1 | 2 | 3;

export default function AddMachineWizardScreen() {
  const router = useRouter();
  const {
    globalLibrary,
    wizardData,
    updateWizardData,
    nextWizardStep,
    prevWizardStep,
    completeWizard,
  } = useSlotMachineLibrary();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      nextWizardStep();
      setCurrentStep((prev) => (prev < 3 ? (prev + 1) as WizardStep : prev));
    }
  }, [currentStep, nextWizardStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      prevWizardStep();
      setCurrentStep((prev) => (prev > 1 ? (prev - 1) as WizardStep : prev));
    }
  }, [currentStep, prevWizardStep]);

  const handleComplete = async () => {
    const machineId = await completeWizard();
    if (machineId) {
      router.push(`/machine-detail/${machineId}` as any);
    }
  };

  const selectSource = (source: 'global' | 'manual') => {
    updateWizardData({ source });
    handleNext();
  };

  const selectGlobalMachine = useCallback((globalMachineId: string) => {
    updateWizardData({ source: 'global', globalMachineId });
    handleNext();
  }, [updateWizardData, handleNext]);

  const filteredMachines = useMemo(() => 
    globalLibrary.filter(machine =>
      machine.machineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      machine.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [globalLibrary, searchQuery]
  );

  const keyExtractor = useCallback((item: MachineEncyclopediaEntry) => item.id, []);

  const renderWizardMachineRow = useCallback(({ item }: ListRenderItemInfo<MachineEncyclopediaEntry>) => (
    <WizardMachineRow machine={item} onSelect={selectGlobalMachine} />
  ), [selectGlobalMachine]);

  const isGlobalStep2 = currentStep === 2 && wizardData.source === 'global';

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Add Machine',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 20,
          },
        }} 
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.progressBar}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressStep,
                step <= currentStep && styles.progressStepActive
              ]}
            />
          ))}
        </View>

        <ScrollView 
          style={isGlobalStep2 ? undefined : styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isGlobalStep2}
        >
          {currentStep === 1 && (
            <View>
              <Text style={styles.stepTitle}>Step 1: Choose Source</Text>
              <Text style={styles.stepDescription}>
                Select how you want to add your machine
              </Text>

              <TouchableOpacity
                style={styles.sourceCard}
                onPress={() => selectSource('global')}
                activeOpacity={0.7}
              >
                <View style={[styles.sourceIcon, { backgroundColor: COLORS.navyDeep }]}>
                  <Search color={COLORS.white} size={24} strokeWidth={2} />
                </View>
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceTitle}>Search Global Library</Text>
                  <Text style={styles.sourceDescription}>
                    Browse 2020-2025 slot machines
                  </Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={24} strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sourceCard}
                onPress={() => selectSource('manual')}
                activeOpacity={0.7}
              >
                <View style={[styles.sourceIcon, { backgroundColor: COLORS.money }]}>
                  <Plus color={COLORS.white} size={24} strokeWidth={2} />
                </View>
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceTitle}>Add Manually</Text>
                  <Text style={styles.sourceDescription}>
                    Create a custom machine entry
                  </Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={24} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}

          {isGlobalStep2 && (
            <View style={styles.globalSearchContainer}>
              <Text style={styles.stepTitle}>Step 2: Select Machine</Text>
              <Text style={styles.stepDescription}>
                Choose from the global database
              </Text>

              <View style={styles.searchBar}>
                <Search color={COLORS.textMuted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search machines..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          )}

          {currentStep === 2 && wizardData.source === 'manual' && (
            <View>
              <Text style={styles.stepTitle}>Step 2: Machine Details</Text>
              <Text style={styles.stepDescription}>
                Enter basic information about the machine
              </Text>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Machine Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Dragon Link - Panda Magic"
                  placeholderTextColor={COLORS.textMuted}
                  value={wizardData.machineName || ''}
                  onChangeText={(text) => updateWizardData({ machineName: text })}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Manufacturer *</Text>
                <View style={styles.chipRow}>
                  {['Aristocrat', 'IGT', 'Konami', 'Light & Wonder', 'Bally', 'Everi', 'Other'].map((mfg) => (
                    <TouchableOpacity
                      key={mfg}
                      style={[
                        styles.chip,
                        wizardData.manufacturer === mfg && styles.chipActive
                      ]}
                      onPress={() => updateWizardData({ manufacturer: mfg as SlotManufacturer })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        wizardData.manufacturer === mfg && styles.chipTextActive
                      ]}>
                        {mfg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Game Series</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Dragon Link, Lightning Link, etc."
                  placeholderTextColor={COLORS.textMuted}
                  value={wizardData.gameSeries || ''}
                  onChangeText={(text) => updateWizardData({ gameSeries: text })}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Volatility *</Text>
                <View style={styles.chipRow}>
                  {['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High'].map((vol) => (
                    <TouchableOpacity
                      key={vol}
                      style={[
                        styles.chip,
                        wizardData.volatility === vol && styles.chipActive
                      ]}
                      onPress={() => updateWizardData({ volatility: vol as MachineVolatility })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        wizardData.volatility === vol && styles.chipTextActive
                      ]}>
                        {vol}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Cabinet Type *</Text>
                <View style={styles.chipRow}>
                  {['Standard Upright', 'Slant Top', 'Curved', 'Video', 'Multi-Screen'].map((cab) => (
                    <TouchableOpacity
                      key={cab}
                      style={[
                        styles.chip,
                        wizardData.cabinetType === cab && styles.chipActive
                      ]}
                      onPress={() => updateWizardData({ cabinetType: cab as CabinetType })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        wizardData.cabinetType === cab && styles.chipTextActive
                      ]}>
                        {cab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Release Year *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="2024"
                  placeholderTextColor={COLORS.textMuted}
                  value={wizardData.releaseYear?.toString() || ''}
                  onChangeText={(text) => {
                    const year = parseInt(text);
                    if (!isNaN(year) || text === '') {
                      updateWizardData({ releaseYear: isNaN(year) ? undefined : year });
                    }
                  }}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {currentStep === 3 && (
            <View>
              <Text style={styles.stepTitle}>Step 3: AP Information (Optional)</Text>
              <Text style={styles.stepDescription}>
                Add advantage play details if applicable
              </Text>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Persistence Type</Text>
                <View style={styles.chipRow}>
                  {['True', 'Pseudo', 'None'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        wizardData.persistenceType === type && styles.chipActive
                      ]}
                      onPress={() => updateWizardData({ persistenceType: type as PersistenceType })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        wizardData.persistenceType === type && styles.chipTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {wizardData.persistenceType && wizardData.persistenceType !== 'None' && (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Has Must Hit By?</Text>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          wizardData.hasMustHitBy === true && styles.chipActive
                        ]}
                        onPress={() => updateWizardData({ hasMustHitBy: !wizardData.hasMustHitBy })}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.chipText,
                          wizardData.hasMustHitBy === true && styles.chipTextActive
                        ]}>
                          Yes
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Entry Conditions</Text>
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      placeholder="When to start playing..."
                      placeholderTextColor={COLORS.textMuted}
                      value={Array.isArray(wizardData.entryConditions) ? wizardData.entryConditions.join('\n') : ''}
                      onChangeText={(text) => updateWizardData({ entryConditions: text.split('\n').filter(s => s.length > 0) })}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Exit Conditions</Text>
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      placeholder="When to stop playing..."
                      placeholderTextColor={COLORS.textMuted}
                      value={Array.isArray(wizardData.exitConditions) ? wizardData.exitConditions.join('\n') : ''}
                      onChangeText={(text) => updateWizardData({ exitConditions: text.split('\n').filter(s => s.length > 0) })}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Risks</Text>
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      placeholder="Potential risks..."
                      placeholderTextColor={COLORS.textMuted}
                      value={Array.isArray(wizardData.risks) ? wizardData.risks.join('\n') : ''}
                      onChangeText={(text) => updateWizardData({ risks: text.split('\n').filter(s => s.length > 0) })}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>My Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Personal observations..."
                  placeholderTextColor={COLORS.textMuted}
                  value={wizardData.userNotes || ''}
                  onChangeText={(text) => updateWizardData({ userNotes: text })}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {isGlobalStep2 && (
          <FlatList
            data={filteredMachines}
            renderItem={renderWizardMachineRow}
            keyExtractor={keyExtractor}
            style={styles.machineListContainer}
            contentContainerStyle={styles.machineListContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
        )}

        <View style={styles.actionBar}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePrev}
              activeOpacity={0.7}
            >
              <ChevronLeft color={COLORS.navyDeep} size={20} strokeWidth={2} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {currentStep < 3 && wizardData.source !== 'global' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
              <ChevronRight color={COLORS.white} size={20} strokeWidth={2} />
            </TouchableOpacity>
          )}

          {(currentStep === 3 || (currentStep === 2 && wizardData.source === 'global')) && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Add Machine</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
  },
  progressStepActive: {
    backgroundColor: COLORS.navyDeep,
  },
  scrollView: {
    flex: 1,
  },
  globalSearchContainer: {
    marginBottom: 0,
  },
  machineListContainer: {
    flex: 1,
  },
  machineListContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 110,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 120 : 110,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: COLORS.textDarkGrey,
    marginBottom: 24,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
    gap: 16,
  },
  sourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceInfo: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  sourceDescription: {
    fontSize: 14,
    color: COLORS.textDarkGrey,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.navyDeep,
  },
  machineRow: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  machineInfo: {
    gap: 4,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  machineDetails: {
    fontSize: 13,
    color: COLORS.textDarkGrey,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 12,
  },
  formInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.navyDeep,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
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
    backgroundColor: COLORS.white,
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
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.bgSecondary,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
});
