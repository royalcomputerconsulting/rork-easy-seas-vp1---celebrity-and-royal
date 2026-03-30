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
    return (<TouchableOpacity style={styles.machineRow} onPress={() => onSelect(machine.id)} activeOpacity={0.7}>
      <View style={styles.machineInfo}>
        <Text style={styles.machineName}>{machine.machineName}</Text>
        <Text style={styles.machineDetails}>
          {machine.manufacturer} • {machine.volatility} • {machine.releaseYear}
        </Text>
      </View>
    </TouchableOpacity>);
});
type WizardStep = 1 | 2 | 3;
export default function AddMachineWizardScreen() {
    const router = useRouter();
    const { globalLibrary, wizardData, updateWizardData, nextWizardStep, prevWizardStep, completeWizard, } = useSlotMachineLibrary();
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
    const filteredMachines = useMemo(() => globalLibrary.filter(machine => machine.machineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())), [globalLibrary, searchQuery]);
    const keyExtractor = useCallback((item: MachineEncyclopediaEntry) => item.id, []);
    const renderWizardMachineRow = useCallback(({ item }: ListRenderItemInfo<MachineEncyclopediaEntry>) => (<WizardMachineRow machine={item} onSelect={selectGlobalMachine}/>), [selectGlobalMachine]);
    const isGlobalStep2 = currentStep === 2 && wizardData.source === 'global';
    return (<>
      <Stack.Screen options={{
            title: 'Add Machine',
            headerShown: true,
            headerBackTitle: 'Back',
            headerTitleStyle: {
                fontWeight: '700' as const,
                fontSize: 20,
            },
        }}/>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.progressBar}>
          {[1, 2, 3].map((step) => (<View key={step} style={[
                styles.progressStep,
                step <= currentStep && styles.progressStepActive
            ]}/>))}
        </View>

        <ScrollView style={isGlobalStep2 ? undefined : styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!isGlobalStep2}>
          

          

          

          
        </ScrollView>

        

        <View style={styles.actionBar}>
          

          

          
        </View>
      </SafeAreaView>
    </>);
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
