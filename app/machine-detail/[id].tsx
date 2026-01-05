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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { 
    getMachineById, 
    addMachineFromGlobal,
    getMachineFullDetails,
    updateMachine
  } = useSlotMachineLibrary();
  const { addQuickMachineWin, getSessionsByMachine } = useCasinoSessions();
  
  const [showQuickWinModal, setShowQuickWinModal] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [enrichedMachine, setEnrichedMachine] = useState<MachineEncyclopediaEntry | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  const machine = getMachineById(id as string);

  useEffect(() => {
    const loadFullDetails = async () => {
      if (!machine || !machine.globalMachineId) return;
      
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
        } else {
          setEnrichedMachine(machine);
        }
      } catch (error) {
        console.error('[MachineDetail] Error loading full details:', error);
        setEnrichedMachine(machine);
      } finally {
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
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Machine not found</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft color={COLORS.white} size={20} strokeWidth={2} />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const handleAddToAtlas = async () => {
    if (displayMachine.globalMachineId) {
      await addMachineFromGlobal(displayMachine.globalMachineId);
    }
  };



  const handleQuickWin = async (data: WinEntryData) => {
    if (!displayMachine) return;

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
    if (!displayMachine) return;

    try {
      setIsExporting(true);
      console.log('[MachineDetail] Exporting machine:', displayMachine.machineName);
      await exportSingleMachineToDocx(displayMachine);
      console.log('[MachineDetail] Export successful');
    } catch (error) {
      console.error('[MachineDetail] Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: displayMachine.machineName,
          headerShown: true,
          headerBackTitle: 'Back',
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 18,
          },
        }} 
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingDetails && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color={COLORS.navyDeep} />
              <Text style={styles.loadingText}>Loading full details...</Text>
            </View>
          )}

          <View style={styles.header}>
            <Text style={styles.title}>{displayMachine.machineName}</Text>
            <Text style={styles.manufacturer}>{displayMachine.manufacturer}</Text>
            {displayMachine.gameSeries && (
              <Text style={styles.series}>Series: {displayMachine.gameSeries}</Text>
            )}
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
              {displayMachine.theme && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Theme</Text>
                  <Text style={styles.infoValue}>{displayMachine.theme}</Text>
                </View>
              )}
            </View>
          </View>

          {displayMachine.rtpRanges && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RTP Range</Text>
              <Text style={styles.rtpText}>
                {displayMachine.rtpRanges.min}% - {displayMachine.rtpRanges.max}%
              </Text>
            </View>
          )}

          {displayMachine.bonusMechanics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bonus Mechanics</Text>
              <Text style={styles.bodyText}>{displayMachine.bonusMechanics}</Text>
            </View>
          )}

          {displayMachine.jackpotTypes && displayMachine.jackpotTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jackpot Types</Text>
              <View style={styles.tagRow}>
                {displayMachine.jackpotTypes.map((type, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {((displayMachine.denominationFamilies && displayMachine.denominationFamilies.length > 0) || 
            (displayMachine.denominations && displayMachine.denominations.length > 0)) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Denominations</Text>
              <View style={styles.tagRow}>
                {(displayMachine.denominationFamilies || displayMachine.denominations)?.map((denom, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{denom}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {displayMachine.apMetadata && (
            <View style={[styles.section, styles.apSection]}>
              <Text style={styles.sectionTitle}>AP Information</Text>
              
              <View style={styles.apInfoRow}>
                <Text style={styles.apLabel}>Persistence Type:</Text>
                <View style={[
                  styles.apBadge,
                  displayMachine.apMetadata.persistenceType === 'True' && styles.apBadgeTrue,
                  displayMachine.apMetadata.persistenceType === 'Pseudo' && styles.apBadgePseudo,
                ]}>
                  <Text style={styles.apBadgeText}>{displayMachine.apMetadata.persistenceType}</Text>
                </View>
              </View>

              {displayMachine.apMetadata.hasMustHitBy && (
                <View style={styles.apInfoRow}>
                  <Text style={styles.apLabel}>Must Hit By:</Text>
                  <Text style={styles.apValue}>Yes</Text>
                </View>
              )}

              {displayMachine.apMetadata.mhbThresholds && (
                <View style={styles.mhbGrid}>
                  {displayMachine.apMetadata.mhbThresholds.minor && (
                    <View style={styles.mhbItem}>
                      <Text style={styles.mhbLabel}>Minor</Text>
                      <Text style={styles.mhbValue}>${displayMachine.apMetadata.mhbThresholds.minor}</Text>
                    </View>
                  )}
                  {displayMachine.apMetadata.mhbThresholds.major && (
                    <View style={styles.mhbItem}>
                      <Text style={styles.mhbLabel}>Major</Text>
                      <Text style={styles.mhbValue}>${displayMachine.apMetadata.mhbThresholds.major}</Text>
                    </View>
                  )}
                  {displayMachine.apMetadata.mhbThresholds.grand && (
                    <View style={styles.mhbItem}>
                      <Text style={styles.mhbLabel}>Grand</Text>
                      <Text style={styles.mhbValue}>${displayMachine.apMetadata.mhbThresholds.grand}</Text>
                    </View>
                  )}
                  {displayMachine.apMetadata.mhbThresholds.mega && (
                    <View style={styles.mhbItem}>
                      <Text style={styles.mhbLabel}>Mega</Text>
                      <Text style={styles.mhbValue}>${displayMachine.apMetadata.mhbThresholds.mega}</Text>
                    </View>
                  )}
                </View>
              )}

              {displayMachine.apMetadata.entryConditions && (
                <View style={styles.apTextSection}>
                  <Text style={styles.apSubtitle}>Entry Conditions:</Text>
                  <Text style={styles.bodyText}>{displayMachine.apMetadata.entryConditions}</Text>
                </View>
              )}

              {displayMachine.apMetadata.exitConditions && (
                <View style={styles.apTextSection}>
                  <Text style={styles.apSubtitle}>Exit Conditions:</Text>
                  <Text style={styles.bodyText}>{displayMachine.apMetadata.exitConditions}</Text>
                </View>
              )}

              {displayMachine.apMetadata.risks && (
                <View style={styles.apTextSection}>
                  <Text style={styles.apSubtitle}>Risks:</Text>
                  <Text style={styles.bodyText}>{displayMachine.apMetadata.risks}</Text>
                </View>
              )}

              {displayMachine.apMetadata.recommendedBankroll && (
                <View style={styles.apInfoRow}>
                  <Text style={styles.apLabel}>Recommended Bankroll:</Text>
                  <Text style={styles.apValue}>
                    ${displayMachine.apMetadata.recommendedBankroll.min} - ${displayMachine.apMetadata.recommendedBankroll.max}
                  </Text>
                </View>
              )}

              {displayMachine.apMetadata.notesAndTips && (
                <View style={styles.apTextSection}>
                  <Text style={styles.apSubtitle}>Notes & Tips:</Text>
                  <Text style={styles.bodyText}>{displayMachine.apMetadata.notesAndTips}</Text>
                </View>
              )}
            </View>
          )}

          {displayMachine.simpleSummary && (
            <View style={[styles.section, styles.summarySection]}>
              <Text style={styles.sectionTitle}>💡 Quick Summary</Text>
              <Text style={styles.bodyText}>{displayMachine.simpleSummary}</Text>
            </View>
          )}

          {displayMachine.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📖 Full Verbose Reference</Text>
              <Text style={styles.bodyText}>{displayMachine.summary}</Text>
            </View>
          )}

          {displayMachine.coreMechanics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚙️ Core Mechanics</Text>
              <Text style={styles.bodyText}>{displayMachine.coreMechanics}</Text>
            </View>
          )}

          {displayMachine.apTriggers && (
            <View style={[styles.section, styles.triggersSection]}>
              <Text style={styles.sectionTitle}>🎯 AP Triggers (When to Sit)</Text>
              {typeof displayMachine.apTriggers === 'string' ? (
                <Text style={styles.bodyText}>{displayMachine.apTriggers}</Text>
              ) : displayMachine.apTriggers.length > 0 ? (
                <View style={styles.listSection}>
                  <Text style={styles.listTitleHighlight}>Primary Triggers:</Text>
                  {displayMachine.apTriggers.map((trigger, idx) => (
                    <Text key={idx} style={styles.listItemHighlight}>✓ {trigger}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {displayMachine.walkAway && (
            <View style={[styles.section, styles.dangerSection]}>
              <Text style={styles.sectionTitle}>🚫 Walk Away Conditions</Text>
              {typeof displayMachine.walkAway === 'string' ? (
                <Text style={styles.bodyText}>{displayMachine.walkAway}</Text>
              ) : displayMachine.walkAway.length > 0 ? (
                displayMachine.walkAway.map((condition, idx) => (
                  <Text key={idx} style={styles.dangerListItem}>× {condition}</Text>
                ))
              ) : null}
            </View>
          )}

          {displayMachine.jackpotReset && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎰 Jackpot Reset Values</Text>
              {typeof displayMachine.jackpotReset === 'string' ? (
                <Text style={styles.bodyText}>{displayMachine.jackpotReset}</Text>
              ) : (
                <View style={styles.resetGrid}>
                  {displayMachine.jackpotReset.mini && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Mini</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.mini}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.minor && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Minor</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.minor}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.major && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Major</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.major}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.grand && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Grand</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.grand}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.yummy && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Yummy</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.yummy}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.upsized && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Upsized</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.upsized}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.spicy && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Spicy</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.spicy}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.super && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Super</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.super}</Text>
                    </View>
                  )}
                  {displayMachine.jackpotReset.mega && (
                    <View style={styles.resetItem}>
                      <Text style={styles.resetLabel}>Mega</Text>
                      <Text style={styles.resetValue}>{displayMachine.jackpotReset.mega}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {displayMachine.shipNotes && (
            <View style={[styles.section, styles.shipSection]}>
              <Text style={styles.sectionTitle}>🚢 Cruise Ship Notes</Text>
              <Text style={styles.bodyText}>{displayMachine.shipNotes}</Text>
            </View>
          )}

          {displayMachine.detailedProfile?.simpleSummary && (
            <View style={[styles.section, styles.summarySection]}>
              <Text style={styles.sectionTitle}>💡 Detailed Summary</Text>
              <Text style={styles.bodyText}>{displayMachine.detailedProfile.simpleSummary}</Text>
            </View>
          )}

          {displayMachine.detailedProfile?.jackpotResetValues && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎰 Detailed Jackpot Reset Values</Text>
              <View style={styles.resetGrid}>
                {displayMachine.detailedProfile.jackpotResetValues.mini && (
                  <View style={styles.resetItem}>
                    <Text style={styles.resetLabel}>Mini</Text>
                    <Text style={styles.resetValue}>
                      ${displayMachine.detailedProfile.jackpotResetValues.mini.min} - ${displayMachine.detailedProfile.jackpotResetValues.mini.max}
                    </Text>
                  </View>
                )}
                {displayMachine.detailedProfile.jackpotResetValues.minor && (
                  <View style={styles.resetItem}>
                    <Text style={styles.resetLabel}>Minor</Text>
                    <Text style={styles.resetValue}>
                      ${displayMachine.detailedProfile.jackpotResetValues.minor.min} - ${displayMachine.detailedProfile.jackpotResetValues.minor.max}
                    </Text>
                  </View>
                )}
                {displayMachine.detailedProfile.jackpotResetValues.major && (
                  <View style={styles.resetItem}>
                    <Text style={styles.resetLabel}>Major</Text>
                    <Text style={styles.resetValue}>
                      ${displayMachine.detailedProfile.jackpotResetValues.major.min} - ${displayMachine.detailedProfile.jackpotResetValues.major.max}
                    </Text>
                  </View>
                )}
                {displayMachine.detailedProfile.jackpotResetValues.grand && (
                  <View style={styles.resetItem}>
                    <Text style={styles.resetLabel}>Grand</Text>
                    <Text style={styles.resetValue}>
                      ${displayMachine.detailedProfile.jackpotResetValues.grand.min} - ${displayMachine.detailedProfile.jackpotResetValues.grand.max}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {displayMachine.detailedProfile?.progressiveBehavior && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Progressive Behavior</Text>
              {displayMachine.detailedProfile.progressiveBehavior.growthRate && (
                <View style={styles.behaviorRow}>
                  <Text style={styles.behaviorLabel}>Growth Rate:</Text>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.progressiveBehavior.growthRate}</Text>
                </View>
              )}
              {displayMachine.detailedProfile.progressiveBehavior.sharedAcrossBank !== undefined && (
                <View style={styles.behaviorRow}>
                  <Text style={styles.behaviorLabel}>Shared Across Bank:</Text>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.progressiveBehavior.sharedAcrossBank ? 'Yes' : 'No'}</Text>
                </View>
              )}
              {displayMachine.detailedProfile.progressiveBehavior.notes && (
                <View style={styles.behaviorRow}>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.progressiveBehavior.notes}</Text>
                </View>
              )}
            </View>
          )}

          {displayMachine.detailedProfile?.specialMechanics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Special Mechanics</Text>
              <Text style={styles.bodyText}>{displayMachine.detailedProfile.specialMechanics.description}</Text>
              
              {displayMachine.detailedProfile.specialMechanics.triggers && displayMachine.detailedProfile.specialMechanics.triggers.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Triggers:</Text>
                  {displayMachine.detailedProfile.specialMechanics.triggers.map((trigger, idx) => (
                    <Text key={idx} style={styles.listItem}>• {trigger}</Text>
                  ))}
                </View>
              )}

              {displayMachine.detailedProfile.specialMechanics.bonusFeatures && displayMachine.detailedProfile.specialMechanics.bonusFeatures.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Bonus Features:</Text>
                  {displayMachine.detailedProfile.specialMechanics.bonusFeatures.map((feature, idx) => (
                    <Text key={idx} style={styles.listItem}>• {feature}</Text>
                  ))}
                </View>
              )}

              {displayMachine.detailedProfile.specialMechanics.bestCombos && displayMachine.detailedProfile.specialMechanics.bestCombos.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Best Combos:</Text>
                  {displayMachine.detailedProfile.specialMechanics.bestCombos.map((combo, idx) => (
                    <Text key={idx} style={styles.listItem}>• {combo}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {displayMachine.detailedProfile?.bonusGameBehavior && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎁 Bonus Game Behavior</Text>
              <Text style={styles.bodyText}>{displayMachine.detailedProfile.bonusGameBehavior.description}</Text>
              
              {displayMachine.detailedProfile.bonusGameBehavior.features && displayMachine.detailedProfile.bonusGameBehavior.features.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Features:</Text>
                  {displayMachine.detailedProfile.bonusGameBehavior.features.map((feature, idx) => (
                    <Text key={idx} style={styles.listItem}>• {feature}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {displayMachine.detailedProfile?.denominationBehavior && displayMachine.detailedProfile.denominationBehavior.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Denomination Behavior</Text>
              {displayMachine.detailedProfile.denominationBehavior.map((denom, idx) => (
                <View key={idx} style={styles.denomItem}>
                  <View style={styles.denomHeader}>
                    <Text style={styles.denomLabel}>{denom.denom}</Text>
                    {denom.recommendation && (
                      <View style={styles.recommendationBadge}>
                        <Text style={styles.recommendationText}>{denom.recommendation}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.denomNotes}>{denom.notes}</Text>
                </View>
              ))}
            </View>
          )}

          {displayMachine.detailedProfile?.apTriggers && (
            <View style={[styles.section, styles.triggersSection]}>
              <Text style={styles.sectionTitle}>🎯 Detailed AP Triggers</Text>
              
              {displayMachine.detailedProfile.apTriggers.primary && displayMachine.detailedProfile.apTriggers.primary.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitleHighlight}>Primary Triggers:</Text>
                  {displayMachine.detailedProfile.apTriggers.primary.map((trigger, idx) => (
                    <Text key={idx} style={styles.listItemHighlight}>✓ {trigger}</Text>
                  ))}
                </View>
              )}

              {displayMachine.detailedProfile.apTriggers.secondary && displayMachine.detailedProfile.apTriggers.secondary.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Secondary Triggers:</Text>
                  {displayMachine.detailedProfile.apTriggers.secondary.map((trigger, idx) => (
                    <Text key={idx} style={styles.listItem}>• {trigger}</Text>
                  ))}
                </View>
              )}

              {displayMachine.detailedProfile.apTriggers.visualClues && displayMachine.detailedProfile.apTriggers.visualClues.length > 0 && (
                <View style={styles.listSection}>
                  <Text style={styles.listTitle}>Visual Clues:</Text>
                  {displayMachine.detailedProfile.apTriggers.visualClues.map((clue, idx) => (
                    <Text key={idx} style={styles.listItem}>👁️ {clue}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {displayMachine.detailedProfile?.walkAwayConditions && (
            <View style={[styles.section, styles.dangerSection]}>
              <Text style={styles.sectionTitle}>🚫 Detailed Walk Away Conditions</Text>
              {displayMachine.detailedProfile.walkAwayConditions.conditions.map((condition, idx) => (
                <Text key={idx} style={styles.dangerListItem}>× {condition}</Text>
              ))}
            </View>
          )}

          {displayMachine.detailedProfile?.bestDenominationForAP && (
            <View style={[styles.section, styles.recommendationSection]}>
              <Text style={styles.sectionTitle}>⭐ Best Denomination for AP</Text>
              <Text style={styles.highlightText}>{displayMachine.detailedProfile.bestDenominationForAP}</Text>
            </View>
          )}

          {displayMachine.detailedProfile?.cruiseShipNotes && (
            <View style={[styles.section, styles.shipSection]}>
              <Text style={styles.sectionTitle}>🚢 Detailed Cruise Ship Notes</Text>
              {displayMachine.detailedProfile.cruiseShipNotes.reelStripDifferences && (
                <View style={styles.shipNote}>
                  <Text style={styles.shipNoteLabel}>Reel Strip Differences:</Text>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.cruiseShipNotes.reelStripDifferences}</Text>
                </View>
              )}
              {displayMachine.detailedProfile.cruiseShipNotes.triggerFrequency && (
                <View style={styles.shipNote}>
                  <Text style={styles.shipNoteLabel}>Trigger Frequency:</Text>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.cruiseShipNotes.triggerFrequency}</Text>
                </View>
              )}
              {displayMachine.detailedProfile.cruiseShipNotes.placement && (
                <View style={styles.shipNote}>
                  <Text style={styles.shipNoteLabel}>Placement:</Text>
                  <Text style={styles.bodyText}>{displayMachine.detailedProfile.cruiseShipNotes.placement}</Text>
                </View>
              )}
            </View>
          )}

          {recentWins.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎉 Recent Wins</Text>
              {recentWins.map((session, idx) => (
                <View key={session.id} style={styles.winItem}>
                  <View style={styles.winItemRow}>
                    <Text style={styles.winDate}>
                      {new Date(session.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.winAmount}>
                      +${(session.winLoss || 0).toFixed(2)}
                    </Text>
                  </View>
                  {session.jackpotHit && (
                    <Text style={styles.jackpotBadge}>🎰 Jackpot Hit!</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {displayMachine.userNotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Notes</Text>
              <Text style={styles.bodyText}>{displayMachine.userNotes}</Text>
            </View>
          )}

          {displayMachine.source && (
            <View style={styles.sourceSection}>
              <Text style={styles.sourceText}>
                Source: {displayMachine.source === 'global' ? 'Global Library' : displayMachine.source === 'user' ? 'User Created' : displayMachine.source}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actionBar}>
          {!displayMachine.isInMyAtlas ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAddToAtlas}
                activeOpacity={0.7}
              >
                <Plus color={COLORS.white} size={20} strokeWidth={2.5} />
                <Text style={styles.primaryButtonText}>Add to My Atlas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportButtonDetail, isExporting && styles.exportButtonDetailDisabled]}
                onPress={handleExportMachine}
                activeOpacity={0.7}
                disabled={isExporting}
              >
                <Download color={COLORS.white} size={20} strokeWidth={2} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.quickWinButton}
                onPress={() => setShowQuickWinModal(true)}
                activeOpacity={0.7}
              >
                <Zap color={COLORS.white} size={20} strokeWidth={2.5} fill={COLORS.white} />
                <Text style={styles.quickWinButtonText}>Log Win</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(`/edit-machine/${displayMachine.id}` as any)}
                activeOpacity={0.7}
              >
                <Edit color={COLORS.navyDeep} size={20} strokeWidth={2} />
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportButtonDetail, isExporting && styles.exportButtonDetailDisabled]}
                onPress={handleExportMachine}
                activeOpacity={0.7}
                disabled={isExporting}
              >
                <Download color={COLORS.white} size={20} strokeWidth={2} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {displayMachine && (
          <QuickMachineWinModal
            visible={showQuickWinModal}
            onClose={() => setShowQuickWinModal(false)}
            machine={displayMachine}
            onSubmit={handleQuickWin}
          />
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
