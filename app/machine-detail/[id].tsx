import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Edit, Plus, Zap, Download } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import QuickMachineWinModal, { type WinEntryData } from '@/components/QuickMachineWinModal';
import { exportSingleMachineToDocx } from '@/lib/exportMachinesToDocx';
import type { MachineEncyclopediaEntry } from '@/types/models';
export default function MachineDetailScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const router = useRouter();
    const { getMachineById, addMachineFromGlobal, getMachineFullDetails, updateMachine } = useSlotMachineLibrary();
    const { addQuickMachineWin, getSessionsByMachine } = useCasinoSessions();
    const [showQuickWinModal, setShowQuickWinModal] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [enrichedMachine, setEnrichedMachine] = useState<MachineEncyclopediaEntry | undefined>(undefined);
    const [isExporting, setIsExporting] = useState(false);
    const machine = getMachineById(id as string);
    useEffect(() => {
        const loadFullDetails = async () => {
            if (!machine || !machine.globalMachineId)
                return;
            if (machine.simpleSummary || machine.summary) {
                setEnrichedMachine(machine);
                return;
            }
            setIsLoadingDetails(true);
            console.log('[MachineDetail] Loading full details for:', machine.globalMachineId);
            try {
                const fullDetails = await getMachineFullDetails(machine.globalMachineId);
                if (fullDetails) {
                    const updatedMachine: MachineEncyclopediaEntry = {
                        ...machine,
                        simpleSummary: fullDetails.simpleSummary || fullDetails.simple_summary,
                        summary: fullDetails.summary,
                        coreMechanics: fullDetails.coreMechanics || fullDetails.core_mechanics,
                        apTriggers: fullDetails.apTriggers || fullDetails.ap_triggers,
                        walkAway: fullDetails.walkAway || fullDetails.walk_away,
                        shipNotes: fullDetails.shipNotes || fullDetails.ship_notes,
                        denominations: fullDetails.denominations || fullDetails.denominationFamilies,
                        jackpotReset: fullDetails.jackpotReset || fullDetails.jackpot_reset,
                    };
                    await updateMachine(machine.id, updatedMachine);
                    setEnrichedMachine(updatedMachine);
                    console.log('[MachineDetail] Full details loaded and cached');
                }
                else {
                    setEnrichedMachine(machine);
                }
            }
            catch (error) {
                console.error('[MachineDetail] Error loading full details:', error);
                setEnrichedMachine(machine);
            }
            finally {
                setIsLoadingDetails(false);
            }
        };
        loadFullDetails();
    }, [machine?.id, machine?.globalMachineId, getMachineFullDetails, updateMachine, machine]);
    const displayMachine = enrichedMachine || machine;
    const machineSessions = useMemo(() => {
        return displayMachine ? getSessionsByMachine(displayMachine.id) : [];
    }, [displayMachine, getSessionsByMachine]);
    const recentWins = useMemo(() => {
        return machineSessions
            .filter(s => (s.winLoss || 0) > 0)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [machineSessions]);
    if (!displayMachine) {
        return (<>
        <Stack.Screen options={{ headerShown: false }}/>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Machine not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft color={COLORS.white} size={20} strokeWidth={2}/>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>);
    }
    const handleAddToAtlas = async () => {
        if (displayMachine.globalMachineId) {
            await addMachineFromGlobal(displayMachine.globalMachineId);
        }
    };
    const handleQuickWin = async (data: WinEntryData) => {
        if (!displayMachine)
            return;
        await addQuickMachineWin({
            machineId: displayMachine.id,
            machineName: displayMachine.machineName,
            denomination: data.denomination,
            winAmount: data.winAmount,
            sessionDuration: data.sessionDuration || 30,
            isJackpot: data.isJackpot,
            jackpotAmount: data.isJackpot ? data.winAmount : undefined,
            pointsEarned: data.pointsEarned,
            notes: data.notes,
        });
        console.log('[MachineDetail] Logged quick win:', {
            machine: displayMachine.machineName,
            amount: data.winAmount,
            denomination: data.denomination,
            points: data.pointsEarned,
        });
    };
    const handleExportMachine = async () => {
        if (!displayMachine)
            return;
        try {
            setIsExporting(true);
            console.log('[MachineDetail] Exporting machine:', displayMachine.machineName);
            await exportSingleMachineToDocx(displayMachine);
            console.log('[MachineDetail] Export successful');
        }
        catch (error) {
            console.error('[MachineDetail] Export failed:', error);
        }
        finally {
            setIsExporting(false);
        }
    };
    return (<>
      <Stack.Screen options={{
            title: displayMachine.machineName,
            headerShown: true,
            headerBackTitle: 'Back',
            headerTitleStyle: {
                fontWeight: '700' as const,
                fontSize: 18,
            },
        }}/>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          

          <View style={styles.header}>
            <Text style={styles.title}>{displayMachine.machineName}</Text>
            <Text style={styles.manufacturer}>{displayMachine.manufacturer}</Text>
            
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Volatility</Text>
                <Text style={styles.infoValue}>{displayMachine.volatility}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Cabinet</Text>
                <Text style={styles.infoValue}>{displayMachine.cabinetType}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Release Year</Text>
                <Text style={styles.infoValue}>{displayMachine.releaseYear}</Text>
              </View>
              
            </View>
          </View>

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          

          
        </ScrollView>

        <View style={styles.actionBar}>
          {!displayMachine.isInMyAtlas ? (<>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddToAtlas} activeOpacity={0.7}>
                <Plus color={COLORS.white} size={20} strokeWidth={2.5}/>
                <Text style={styles.primaryButtonText}>Add to My Atlas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportButtonDetail, isExporting && styles.exportButtonDetailDisabled]} onPress={handleExportMachine} activeOpacity={0.7} disabled={isExporting}>
                <Download color={COLORS.white} size={20} strokeWidth={2}/>
              </TouchableOpacity>
            </>) : (<>
              <TouchableOpacity style={styles.quickWinButton} onPress={() => setShowQuickWinModal(true)} activeOpacity={0.7}>
                <Zap color={COLORS.white} size={20} strokeWidth={2.5} fill={COLORS.white}/>
                <Text style={styles.quickWinButtonText}>Log Win</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(`/edit-machine/${displayMachine.id}` as any)} activeOpacity={0.7}>
                <Edit color={COLORS.navyDeep} size={20} strokeWidth={2}/>
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportButtonDetail, isExporting && styles.exportButtonDetailDisabled]} onPress={handleExportMachine} activeOpacity={0.7} disabled={isExporting}>
                <Download color={COLORS.white} size={20} strokeWidth={2}/>
              </TouchableOpacity>
            </>)}
        </View>

        
      </SafeAreaView>
    </>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgSecondary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 120 : 110,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 8,
    },
    manufacturer: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: COLORS.textDarkGrey,
        marginBottom: 4,
    },
    series: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    section: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 16,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    infoItem: {
        width: '47%',
    },
    infoLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: COLORS.navyDeep,
    },
    rtpText: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: COLORS.money,
    },
    bodyText: {
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textDarkGrey,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: COLORS.bgSecondary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: COLORS.navyDeep,
    },
    apSection: {
        backgroundColor: COLORS.moneyBg,
        borderColor: COLORS.money,
    },
    apInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    apLabel: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: COLORS.navyDeep,
    },
    apValue: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: COLORS.money,
    },
    apBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: COLORS.bgSecondary,
    },
    apBadgeTrue: {
        backgroundColor: COLORS.money,
    },
    apBadgePseudo: {
        backgroundColor: COLORS.warning,
    },
    apBadgeText: {
        fontSize: 13,
        fontWeight: '700' as const,
        color: COLORS.white,
    },
    mhbGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
        marginBottom: 16,
    },
    mhbItem: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: 100,
    },
    mhbLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    mhbValue: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.money,
    },
    apTextSection: {
        marginTop: 16,
    },
    apSubtitle: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 8,
    },
    sourceSection: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    sourceText: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontStyle: 'italic' as const,
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
    dangerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.error,
        paddingVertical: 16,
        borderRadius: 12,
    },
    dangerButtonText: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.white,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    errorText: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.navyDeep,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.white,
    },
    summarySection: {
        backgroundColor: '#FEF9E7',
        borderColor: '#F39C12',
    },
    resetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    resetItem: {
        backgroundColor: COLORS.bgSecondary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: '47%',
    },
    resetLabel: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: COLORS.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase' as const,
    },
    resetValue: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
    },
    behaviorRow: {
        marginBottom: 12,
    },
    behaviorLabel: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 6,
    },
    listSection: {
        marginTop: 16,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
        marginBottom: 8,
    },
    listItem: {
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.textDarkGrey,
        marginBottom: 4,
    },
    listTitleHighlight: {
        fontSize: 15,
        fontWeight: '700' as const,
        color: COLORS.money,
        marginBottom: 8,
    },
    listItemHighlight: {
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.money,
        marginBottom: 6,
        fontWeight: '600' as const,
    },
    denomItem: {
        backgroundColor: COLORS.bgSecondary,
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    denomHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    denomLabel: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.navyDeep,
    },
    recommendationBadge: {
        backgroundColor: COLORS.money,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    recommendationText: {
        fontSize: 11,
        fontWeight: '700' as const,
        color: COLORS.white,
    },
    denomNotes: {
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.textDarkGrey,
    },
    winItem: {
        backgroundColor: COLORS.bgSecondary,
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    winItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    winDate: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: COLORS.textMuted,
    },
    winAmount: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.money,
    },
    jackpotBadge: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: '#F39C12',
        marginTop: 4,
    },
    quickWinButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.money,
        paddingVertical: 16,
        borderRadius: 12,
    },
    quickWinButtonText: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: COLORS.white,
    },
    triggersSection: {
        backgroundColor: '#E8F8F5',
        borderColor: COLORS.money,
    },
    dangerSection: {
        backgroundColor: '#FADBD8',
        borderColor: COLORS.error,
    },
    dangerListItem: {
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.error,
        marginBottom: 6,
        fontWeight: '600' as const,
    },
    recommendationSection: {
        backgroundColor: '#FEF9E7',
        borderColor: '#F39C12',
    },
    highlightText: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: '#F39C12',
        lineHeight: 24,
    },
    shipSection: {
        backgroundColor: '#EBF5FB',
        borderColor: '#3498DB',
    },
    shipNote: {
        marginBottom: 12,
    },
    shipNoteLabel: {
        fontSize: 13,
        fontWeight: '700' as const,
        color: '#3498DB',
        marginBottom: 4,
    },
    loadingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.goldLight,
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 10,
        marginBottom: 16,
        borderRadius: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: COLORS.navyDeep,
    },
    exportButtonDetail: {
        backgroundColor: COLORS.goldDark,
        borderRadius: 12,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    exportButtonDetailDisabled: {
        opacity: 0.5,
    },
});
