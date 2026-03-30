import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Zap,
  Ship,
  Plus,
  Minus,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  RefreshCw,
  Home,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  ScenarioType,
  ScenarioInput,
  SimulationResult,
  runComparisonSimulation,
  PlayerContext,
} from '@/lib/whatIfSimulator';
import type { BookedCruise, CasinoOffer } from '@/types/models';
import * as Haptics from 'expo-haptics';

interface WhatIfSimulatorProps {
  playerContext: PlayerContext;
  bookedCruises: BookedCruise[];
  offers?: CasinoOffer[];
  onSimulationComplete?: (result: SimulationResult) => void;
}

const SCENARIO_OPTIONS: { type: ScenarioType; label: string; icon: typeof Ship; color: string }[] = [
  { type: 'add_cruise', label: 'Add Cruise', icon: Plus, color: COLORS.success },
  { type: 'remove_cruise', label: 'Remove Cruise', icon: Minus, color: COLORS.error },
  { type: 'change_cabin', label: 'Change Cabin', icon: Home, color: COLORS.aquaAccent },
  { type: 'custom', label: 'Custom', icon: Sparkles, color: COLORS.beigeWarm },
];

const CABIN_OPTIONS = ['Interior', 'Oceanview', 'Balcony', 'Suite'];

export function WhatIfSimulator({
  playerContext,
  bookedCruises,
  offers = [],
  onSimulationComplete,
}: WhatIfSimulatorProps) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('add_cruise');
  const [expanded, setExpanded] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const [newNights, setNewNights] = useState('7');
  const [newSpend, setNewSpend] = useState(playerContext.averageSpendPerCruise.toString());
  const [selectedCabin, setSelectedCabin] = useState('Balcony');
  const [customPoints, setCustomPoints] = useState('0');
  const [customNights, setCustomNights] = useState('0');
  const [selectedCruiseId, setSelectedCruiseId] = useState<string | null>(
    bookedCruises[0]?.id || null
  );

  const handleScenarioSelect = useCallback((type: ScenarioType) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedScenario(type);
    setResult(null);
  }, []);

  const runSimulation = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsSimulating(true);

    const scenario: ScenarioInput = {
      type: selectedScenario,
    };

    switch (selectedScenario) {
      case 'add_cruise':
        scenario.newNights = parseInt(newNights, 10) || 7;
        scenario.newSpend = parseFloat(newSpend) || playerContext.averageSpendPerCruise;
        break;
      case 'remove_cruise':
        scenario.cruiseId = selectedCruiseId || undefined;
        break;
      case 'change_cabin':
        scenario.newCabinType = selectedCabin;
        break;
      case 'custom':
        scenario.customPoints = parseInt(customPoints, 10) || 0;
        scenario.customNights = parseInt(customNights, 10) || 0;
        scenario.newSpend = parseFloat(newSpend) || 0;
        break;
    }

    setTimeout(() => {
      const simulationResult = runComparisonSimulation(
        playerContext,
        bookedCruises,
        scenario,
        offers
      );
      setResult(simulationResult);
      setIsSimulating(false);
      onSimulationComplete?.(simulationResult);
      console.log('[WhatIfSimulator] Simulation complete:', simulationResult);
    }, 300);
  }, [
    selectedScenario,
    newNights,
    newSpend,
    selectedCabin,
    customPoints,
    customNights,
    selectedCruiseId,
    playerContext,
    bookedCruises,
    offers,
    onSimulationComplete,
  ]);

  const resetSimulation = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setResult(null);
    setNewNights('7');
    setNewSpend(playerContext.averageSpendPerCruise.toString());
    setCustomPoints('0');
    setCustomNights('0');
  }, [playerContext.averageSpendPerCruise]);

  const renderScenarioInputs = () => {
    switch (selectedScenario) {
      case 'add_cruise':
        return (
          <View style={styles.inputsContainer}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nights</Text>
                <TextInput
                  style={styles.input}
                  value={newNights}
                  onChangeText={setNewNights}
                  keyboardType="numeric"
                  placeholder="7"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Est. Spend</Text>
                <TextInput
                  style={styles.input}
                  value={newSpend}
                  onChangeText={setNewSpend}
                  keyboardType="numeric"
                  placeholder="2000"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
          </View>
        );

      case 'remove_cruise':
        return (
          <View style={styles.inputsContainer}>
            <Text style={styles.inputLabel}>Select Cruise to Remove</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cruiseScroll}>
              {bookedCruises.map((cruise) => (
                <TouchableOpacity
                  key={cruise.id}
                  style={[
                    styles.cruiseOption,
                    selectedCruiseId === cruise.id && styles.cruiseOptionSelected,
                  ]}
                  onPress={() => setSelectedCruiseId(cruise.id)}
                >
                  <Ship
                    size={14}
                    color={selectedCruiseId === cruise.id ? COLORS.navyDeep : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.cruiseOptionText,
                      selectedCruiseId === cruise.id && styles.cruiseOptionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {cruise.shipName || 'Cruise'}
                  </Text>
                </TouchableOpacity>
              ))}
              {bookedCruises.length === 0 && (
                <Text style={styles.noCruisesText}>No booked cruises to remove</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'change_cabin':
        return (
          <View style={styles.inputsContainer}>
            <Text style={styles.inputLabel}>New Cabin Type</Text>
            <View style={styles.cabinOptions}>
              {CABIN_OPTIONS.map((cabin) => (
                <TouchableOpacity
                  key={cabin}
                  style={[
                    styles.cabinOption,
                    selectedCabin === cabin && styles.cabinOptionSelected,
                  ]}
                  onPress={() => setSelectedCabin(cabin)}
                >
                  <Text
                    style={[
                      styles.cabinOptionText,
                      selectedCabin === cabin && styles.cabinOptionTextSelected,
                    ]}
                  >
                    {cabin}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'custom':
        return (
          <View style={styles.inputsContainer}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Add Points</Text>
                <TextInput
                  style={styles.input}
                  value={customPoints}
                  onChangeText={setCustomPoints}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Add Nights</Text>
                <TextInput
                  style={styles.input}
                  value={customNights}
                  onChangeText={setCustomNights}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
            <View style={styles.inputGroupFull}>
              <Text style={styles.inputLabel}>Additional Spend</Text>
              <TextInput
                style={styles.input}
                value={newSpend}
                onChangeText={setNewSpend}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderResults = () => {
    if (!result) return null;

    const { tierForecast, loyaltyForecast, roiProjection, comparison } = result;
    const diff = comparison?.difference;

    return (
      <View style={styles.resultsContainer}>
        <LinearGradient
          colors={['rgba(77, 208, 225, 0.15)', 'rgba(77, 208, 225, 0.05)']}
          style={styles.resultsGradient}
        >
          <View style={styles.resultsHeader}>
            <Sparkles size={18} color={COLORS.aquaAccent} />
            <Text style={styles.resultsTitle}>Simulation Results</Text>
          </View>

          <View style={styles.resultCards}>
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <Target size={14} color={COLORS.beigeWarm} />
                <Text style={styles.resultCardTitle}>Tier Forecast</Text>
              </View>
              <View style={styles.tierComparison}>
                <View style={styles.tierBox}>
                  <Text style={styles.tierLabel}>Current</Text>
                  <Text style={styles.tierValue}>{tierForecast.currentTier}</Text>
                </View>
                <ArrowRight size={16} color={COLORS.textSecondary} />
                <View style={[styles.tierBox, tierForecast.tierUpgrade && styles.tierBoxHighlight]}>
                  <Text style={styles.tierLabel}>Projected</Text>
                  <Text
                    style={[
                      styles.tierValue,
                      tierForecast.tierUpgrade && styles.tierValueHighlight,
                    ]}
                  >
                    {tierForecast.projectedTier}
                  </Text>
                </View>
              </View>
              {diff && diff.pointsDiff !== 0 && (
                <Text
                  style={[
                    styles.diffText,
                    diff.pointsDiff > 0 ? styles.diffPositive : styles.diffNegative,
                  ]}
                >
                  {diff.pointsDiff > 0 ? '+' : ''}
                  {formatNumber(diff.pointsDiff)} points
                </Text>
              )}
            </View>

            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <Ship size={14} color={COLORS.aquaAccent} />
                <Text style={styles.resultCardTitle}>Loyalty Level</Text>
              </View>
              <View style={styles.tierComparison}>
                <View style={styles.tierBox}>
                  <Text style={styles.tierLabel}>Current</Text>
                  <Text style={styles.tierValue}>{loyaltyForecast.currentLevel}</Text>
                </View>
                <ArrowRight size={16} color={COLORS.textSecondary} />
                <View style={[styles.tierBox, loyaltyForecast.levelUpgrade && styles.tierBoxHighlight]}>
                  <Text style={styles.tierLabel}>Projected</Text>
                  <Text
                    style={[
                      styles.tierValue,
                      loyaltyForecast.levelUpgrade && styles.tierValueHighlight,
                    ]}
                  >
                    {loyaltyForecast.projectedLevel}
                  </Text>
                </View>
              </View>
              {diff && diff.nightsDiff !== 0 && (
                <Text
                  style={[
                    styles.diffText,
                    diff.nightsDiff > 0 ? styles.diffPositive : styles.diffNegative,
                  ]}
                >
                  {diff.nightsDiff > 0 ? '+' : ''}
                  {diff.nightsDiff} nights
                </Text>
              )}
            </View>

            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <TrendingUp size={14} color={COLORS.success} />
                <Text style={styles.resultCardTitle}>ROI Projection</Text>
              </View>
              <View style={styles.roiMetrics}>
                <View style={styles.roiMetric}>
                  <Text style={styles.roiMetricLabel}>Investment</Text>
                  <Text style={styles.roiMetricValue}>
                    {formatCurrency(roiProjection.totalInvestment)}
                  </Text>
                </View>
                <View style={styles.roiMetric}>
                  <Text style={styles.roiMetricLabel}>Projected Value</Text>
                  <Text style={styles.roiMetricValue}>
                    {formatCurrency(roiProjection.projectedValue)}
                  </Text>
                </View>
                <View style={styles.roiMetric}>
                  <Text style={styles.roiMetricLabel}>ROI</Text>
                  <Text
                    style={[
                      styles.roiMetricValue,
                      roiProjection.projectedROI > 0
                        ? styles.roiPositive
                        : styles.roiNegative,
                    ]}
                  >
                    {roiProjection.projectedROI.toFixed(1)}%
                  </Text>
                </View>
              </View>
              {diff && diff.roiDiff !== 0 && (
                <Text
                  style={[
                    styles.diffText,
                    diff.roiDiff > 0 ? styles.diffPositive : styles.diffNegative,
                  ]}
                >
                  {diff.roiDiff > 0 ? '+' : ''}
                  {diff.roiDiff.toFixed(1)}% ROI change
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.25)', 'rgba(139, 92, 246, 0.1)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Zap size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.headerTitle}>What-If Simulator</Text>
                <Text style={styles.headerSubtitle}>Forecast your cruise portfolio</Text>
              </View>
            </View>
            {expanded ? (
              <ChevronUp size={20} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={20} color={COLORS.textSecondary} />
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Select Scenario</Text>
          <View style={styles.scenarioOptions}>
            {SCENARIO_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.type}
                style={[
                  styles.scenarioOption,
                  selectedScenario === option.type && styles.scenarioOptionSelected,
                ]}
                onPress={() => handleScenarioSelect(option.type)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.scenarioIconContainer,
                    { backgroundColor: `${option.color}20` },
                    selectedScenario === option.type && { backgroundColor: option.color },
                  ]}
                >
                  <option.icon
                    size={16}
                    color={selectedScenario === option.type ? COLORS.white : option.color}
                  />
                </View>
                <Text
                  style={[
                    styles.scenarioLabel,
                    selectedScenario === option.type && styles.scenarioLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderScenarioInputs()}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetSimulation}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color={COLORS.textSecondary} />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simulateButton, isSimulating && styles.simulateButtonDisabled]}
              onPress={runSimulation}
              disabled={isSimulating}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6D28D9']}
                style={styles.simulateButtonGradient}
              >
                {isSimulating ? (
                  <Text style={styles.simulateButtonText}>Simulating...</Text>
                ) : (
                  <>
                    <Zap size={16} color={COLORS.white} />
                    <Text style={styles.simulateButtonText}>Run Simulation</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {renderResults()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    padding: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.primary,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  content: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.primary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  scenarioOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  scenarioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: SPACING.xs,
  },
  scenarioOptionSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  scenarioIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scenarioLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.secondary,
  },
  scenarioLabelSelected: {
    color: CLEAN_THEME.text.primary,
  },
  inputsContainer: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupFull: {
    marginTop: SPACING.sm,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.primary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: 'rgba(0,59,115,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  cruiseScroll: {
    marginTop: SPACING.xs,
  },
  cruiseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  cruiseOptionSelected: {
    backgroundColor: COLORS.beigeWarm,
  },
  cruiseOptionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    maxWidth: 100,
  },
  cruiseOptionTextSelected: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  noCruisesText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    fontStyle: 'italic',
  },
  cabinOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  cabinOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cabinOptionSelected: {
    backgroundColor: 'rgba(77, 208, 225, 0.2)',
    borderColor: COLORS.aquaAccent,
  },
  cabinOptionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.secondary,
  },
  cabinOptionTextSelected: {
    color: COLORS.aquaAccent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  resetButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  simulateButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  simulateButtonDisabled: {
    opacity: 0.6,
  },
  simulateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  simulateButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  resultsContainer: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  resultsGradient: {
    padding: SPACING.md,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  resultsTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
  },
  resultCards: {
    gap: SPACING.sm,
  },
  resultCard: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  resultCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.secondary,
  },
  tierComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  tierBox: {
    alignItems: 'center',
    flex: 1,
  },
  tierBoxHighlight: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
  },
  tierLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    marginBottom: 2,
  },
  tierValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.primary,
  },
  tierValueHighlight: {
    color: COLORS.success,
  },
  roiMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roiMetric: {
    alignItems: 'center',
    flex: 1,
  },
  roiMetricLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    marginBottom: 2,
  },
  roiMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.primary,
  },
  roiPositive: {
    color: COLORS.success,
  },
  roiNegative: {
    color: COLORS.error,
  },
  diffText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  diffPositive: {
    color: COLORS.success,
  },
  diffNegative: {
    color: COLORS.error,
  },
});
