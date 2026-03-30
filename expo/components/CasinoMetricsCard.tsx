import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  Calculator,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Star,
  X,
  Settings,
  Info,
  DollarSign,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { BookedCruise } from '@/types/models';
import {
  estimateCasinoHours,
  calculateTheoreticalFromPoints,
  calculatePredictiveScore,
  GAME_HOUSE_EDGES,
  type CasinoHoursEstimate,
  type TheoreticalLoss,
  type PredictiveScore,
} from '@/lib/casinoCalculator';

interface CasinoMetricsCardProps {
  completedCruises: BookedCruise[];
  currentPoints: number;
  currentTier: string;
  onDetailPress?: () => void;
  alwaysExpanded?: boolean;
}

export const CasinoMetricsCard = React.memo(function CasinoMetricsCard({
  completedCruises,
  currentPoints,
  currentTier,
  alwaysExpanded = false,
}: CasinoMetricsCardProps) {
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [showSettings, setShowSettings] = useState(false);
  const [showTheoDetails, setShowTheoDetails] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  
  const [avgSessionHours, setAvgSessionHours] = useState(3);
  const [playOnPortDays, setPlayOnPortDays] = useState(true);
  const [primaryGame, setPrimaryGame] = useState('Slots');
  const [avgBetSize, setAvgBetSize] = useState(25);

  const casinoHours = useMemo((): CasinoHoursEstimate => {
    return estimateCasinoHours(completedCruises, avgSessionHours, playOnPortDays);
  }, [completedCruises, avgSessionHours, playOnPortDays]);

  const theoreticalLoss = useMemo((): TheoreticalLoss => {
    return calculateTheoreticalFromPoints(currentPoints, primaryGame, avgBetSize);
  }, [currentPoints, primaryGame, avgBetSize]);

  const predictiveScore = useMemo((): PredictiveScore => {
    return calculatePredictiveScore(completedCruises, currentPoints, currentTier);
  }, [completedCruises, currentPoints, currentTier]);

  const valueMetrics = useMemo(() => {
    const totalWinnings = completedCruises.reduce((sum, c) => sum + (c.winnings || 0), 0);
    const cruiseCount = completedCruises.length;
    const avgWinningsPerCruise = cruiseCount > 0 ? totalWinnings / cruiseCount : 0;
    
    const totalHours = casinoHours.totalCasinoHours;
    const valuePerHour = totalHours > 0 ? totalWinnings / totalHours : 0;
    const pointsPerHour = totalHours > 0 ? currentPoints / totalHours : 0;
    
    const totalRetailValue = completedCruises.reduce((sum, c) => {
      const nights = c.nights || 7;
      const guests = c.guests || 1;
      const cabinType = c.cabinType || 'Balcony';
      const perNight = cabinType.toLowerCase().includes('suite') ? 450 : 
                       cabinType.toLowerCase().includes('balcony') ? 250 : 150;
      return sum + (c.retailValue || (perNight * nights * guests));
    }, 0);
    
    const totalTaxesPaid = completedCruises.reduce((sum, c) => {
      const nights = c.nights || 7;
      const guests = c.guests || 1;
      return sum + (c.taxes || Math.round(nights * 30 * guests));
    }, 0);
    
    const totalValueReceived = totalRetailValue + totalWinnings;
    const netValueReceived = totalValueReceived - totalTaxesPaid;
    const valuePerHourPlayed = totalHours > 0 ? netValueReceived / totalHours : 0;
    
    const totalCoinIn = currentPoints * 5;
    
    const valuePerDollar = totalTaxesPaid > 0 
      ? totalValueReceived / totalTaxesPaid 
      : (totalValueReceived > 0 ? 9999 : 0);
    
    return {
      totalWinnings,
      avgWinningsPerCruise,
      valuePerHour,
      pointsPerHour,
      totalRetailValue,
      totalTaxesPaid,
      netValueReceived,
      valuePerHourPlayed,
      cruiseCount,
      totalCoinIn,
      totalValueReceived,
      valuePerDollar,
    };
  }, [completedCruises, casinoHours.totalCasinoHours, currentPoints]);

  const getRiskColor = useCallback((risk: string) => {
    switch (risk) {
      case 'very-high': return COLORS.error;
      case 'high': return '#F97316';
      case 'medium': return COLORS.warning;
      default: return COLORS.success;
    }
  }, []);

  const getTierColor = useCallback((tier: string) => {
    switch (tier) {
      case 'Diamond': return '#B9F2FF';
      case 'Platinum': return '#E5E4E2';
      case 'Gold': return COLORS.goldDark;
      case 'Silver': return '#C0C0C0';
      default: return '#CD7F32';
    }
  }, []);

  const getHostValueColor = useCallback((value: string) => {
    switch (value) {
      case 'vip': return COLORS.royalPurple;
      case 'high': return COLORS.success;
      case 'medium': return COLORS.warning;
      default: return CLEAN_THEME.text.secondary;
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const marbleConfig = MARBLE_TEXTURES.white;

  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <TouchableOpacity 
        style={styles.header} 
        onPress={alwaysExpanded ? undefined : toggleExpanded}
        activeOpacity={alwaysExpanded ? 1 : 0.7}
        disabled={alwaysExpanded}
      >
        <View style={styles.headerLeft}>
          <Calculator size={18} color={COLORS.navyDeep} />
          <Text style={styles.headerTitle}>Casino Analytics</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings size={16} color={CLEAN_THEME.text.secondary} />
          </TouchableOpacity>
          {!alwaysExpanded && (
            expanded ? (
              <ChevronUp size={20} color={CLEAN_THEME.text.secondary} />
            ) : (
              <ChevronDown size={20} color={CLEAN_THEME.text.secondary} />
            )
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <View style={styles.metricIconRow}>
            <Clock size={14} color={COLORS.navyDeep} />
            <Text style={styles.metricLabel}>Hours</Text>
          </View>
          <Text style={styles.metricValue}>{casinoHours.totalCasinoHours}</Text>
          <Text style={styles.metricSub}>{casinoHours.avgHoursPerDay.toFixed(1)}/day</Text>
        </View>

        <View style={styles.metricDivider} />

        <TouchableOpacity 
          style={styles.metricItem}
          onPress={() => setShowTheoDetails(true)}
          activeOpacity={0.7}
        >
          <View style={styles.metricIconRow}>
            <DollarSign size={14} color={COLORS.success} />
            <Text style={styles.metricLabel}>Value/$1</Text>
          </View>
          <Text style={[styles.metricValue, { color: COLORS.success }]}>
            {valueMetrics.valuePerDollar >= 9999 ? '∞' : `${valueMetrics.valuePerDollar.toFixed(2)}`}
          </Text>
          <Text style={styles.metricSub}>per $1 spent</Text>
        </TouchableOpacity>

        <View style={styles.metricDivider} />

        <TouchableOpacity 
          style={styles.metricItem}
          onPress={() => setShowScoreDetails(true)}
          activeOpacity={0.7}
        >
          <View style={styles.metricIconRow}>
            <Star size={14} color={getTierColor(predictiveScore.tier)} />
            <Text style={styles.metricLabel}>Score</Text>
          </View>
          <Text style={styles.metricValue}>{predictiveScore.score}</Text>
          <View style={[styles.tierBadge, { backgroundColor: `${getTierColor(predictiveScore.tier)}20` }]}>
            <Text style={[styles.tierBadgeText, { color: getTierColor(predictiveScore.tier) }]}>
              {predictiveScore.tier}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.sectionHeader}>
            <Clock size={14} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Casino Hours Breakdown</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sea Days</Text>
            <Text style={styles.detailValue}>{casinoHours.seaDays} days</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Port Days</Text>
            <Text style={styles.detailValue}>{casinoHours.portDays} days</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sessions</Text>
            <Text style={styles.detailValue}>~{casinoHours.estimatedSessionCount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Per Cruise Avg</Text>
            <Text style={styles.detailValue}>{casinoHours.hoursPerCruise.toFixed(1)} hrs</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <DollarSign size={14} color={COLORS.success} />
            <Text style={styles.sectionTitle}>Value vs Time Analysis</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Winnings</Text>
            <Text style={[styles.detailValue, { color: valueMetrics.totalWinnings >= 0 ? COLORS.success : COLORS.error }]}>
              {valueMetrics.totalWinnings >= 0 ? '+' : ''}{formatCurrency(valueMetrics.totalWinnings)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Avg Win/Loss Per Cruise</Text>
            <Text style={[styles.detailValue, { color: valueMetrics.avgWinningsPerCruise >= 0 ? COLORS.success : COLORS.error }]}>
              {valueMetrics.avgWinningsPerCruise >= 0 ? '+' : ''}{formatCurrency(valueMetrics.avgWinningsPerCruise)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Points Per Hour Played</Text>
            <Text style={styles.detailValue}>{formatNumber(Math.round(valueMetrics.pointsPerHour))}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Retail Value</Text>
            <Text style={[styles.detailValue, { color: COLORS.success }]}>{formatCurrency(valueMetrics.totalRetailValue)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Taxes & Fees Paid</Text>
            <Text style={styles.detailValue}>-{formatCurrency(valueMetrics.totalTaxesPaid)}</Text>
          </View>
          <View style={[styles.detailRow, styles.highlightRow]}>
            <Text style={styles.detailLabelBold}>Value Per Hour Played</Text>
            <Text style={[styles.detailValueBold, { color: valueMetrics.valuePerHourPlayed >= 0 ? COLORS.success : COLORS.error }]}>
              {valueMetrics.valuePerHourPlayed >= 0 ? '+' : ''}{formatCurrency(valueMetrics.valuePerHourPlayed)}/hr
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Target size={14} color={getRiskColor(theoreticalLoss.riskLevel)} />
            <Text style={styles.sectionTitle}>Theoretical Loss Analysis</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Coin-In</Text>
            <Text style={styles.detailValue}>{formatCurrency(theoreticalLoss.totalCoinIn)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>House Edge ({primaryGame})</Text>
            <Text style={styles.detailValue}>{(theoreticalLoss.houseEdge * 100).toFixed(2)}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Theoretical Loss</Text>
            <Text style={[styles.detailValue, { color: COLORS.error }]}>
              -{formatCurrency(theoreticalLoss.theoreticalLoss)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Point Value Earned</Text>
            <Text style={[styles.detailValue, { color: COLORS.success }]}>
              +{formatCurrency(theoreticalLoss.pointValue)}
            </Text>
          </View>
          <View style={[styles.detailRow, styles.highlightRow]}>
            <Text style={styles.detailLabelBold}>Net Theoretical</Text>
            <Text style={[styles.detailValueBold, { 
              color: theoreticalLoss.netTheoAfterPointValue > 0 ? COLORS.error : COLORS.success 
            }]}>
              {theoreticalLoss.netTheoAfterPointValue > 0 ? '-' : '+'}
              {formatCurrency(Math.abs(theoreticalLoss.netTheoAfterPointValue))}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <TrendingUp size={14} color={getHostValueColor(predictiveScore.hostValueIndicator)} />
            <Text style={styles.sectionTitle}>Predictive Score Factors</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Avg Daily Theo</Text>
            <Text style={styles.detailValue}>{formatCurrency(predictiveScore.factors.avgDailyTheoretical)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Consistency</Text>
            <Text style={styles.detailValue}>{predictiveScore.factors.consistency.toFixed(0)}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cruise Frequency</Text>
            <Text style={styles.detailValue}>{predictiveScore.factors.cruiseFrequency.toFixed(1)}/month</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimated Avg Bet</Text>
            <Text style={styles.detailValue}>${predictiveScore.factors.avgBetSize.toFixed(0)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Host Value</Text>
            <Text style={[styles.detailValue, { 
              color: getHostValueColor(predictiveScore.hostValueIndicator),
              fontWeight: '700' as const,
            }]}>
              {predictiveScore.hostValueIndicator.toUpperCase()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <AlertTriangle size={14} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>Projections</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Next Cruise Expected Theo</Text>
            <Text style={styles.detailValue}>{formatCurrency(predictiveScore.projections.nextCruiseExpectedTheo)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Yearly Projected Theo</Text>
            <Text style={styles.detailValue}>{formatCurrency(predictiveScore.projections.yearlyProjectedTheo)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Projected Offer Value</Text>
            <Text style={[styles.detailValue, { color: COLORS.success }]}>
              ~{formatCurrency(predictiveScore.projections.projectedOfferValue)}
            </Text>
          </View>

          {predictiveScore.recommendations.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.recommendationsSection}>
                <Text style={styles.recommendationsTitle}>Recommendations</Text>
                {predictiveScore.recommendations.map((rec, idx) => (
                  <View key={idx} style={styles.recommendationRow}>
                    <View style={styles.recommendationBullet} />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calculator Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Average Session Hours/Day</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setAvgSessionHours(Math.max(1, avgSessionHours - 0.5))}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{avgSessionHours}</Text>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setAvgSessionHours(Math.min(12, avgSessionHours + 0.5))}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Play on Port Days</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity 
                    style={[styles.toggleOption, playOnPortDays && styles.toggleOptionActive]}
                    onPress={() => setPlayOnPortDays(true)}
                  >
                    <Text style={[styles.toggleText, playOnPortDays && styles.toggleTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleOption, !playOnPortDays && styles.toggleOptionActive]}
                    onPress={() => setPlayOnPortDays(false)}
                  >
                    <Text style={[styles.toggleText, !playOnPortDays && styles.toggleTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Primary Game</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gameSelector}>
                  {Object.keys(GAME_HOUSE_EDGES).map((game) => (
                    <TouchableOpacity
                      key={game}
                      style={[styles.gameOption, primaryGame === game && styles.gameOptionActive]}
                      onPress={() => setPrimaryGame(game)}
                    >
                      <Text style={[styles.gameOptionText, primaryGame === game && styles.gameOptionTextActive]}>
                        {game}
                      </Text>
                      <Text style={styles.gameEdgeText}>
                        {(GAME_HOUSE_EDGES[game] * 100).toFixed(2)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Average Bet Size ($)</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setAvgBetSize(Math.max(5, avgBetSize - 5))}
                  >
                    <Text style={styles.stepperButtonText}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.betInput}
                    value={avgBetSize.toString()}
                    onChangeText={(text) => setAvgBetSize(Math.max(1, parseInt(text) || 1))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setAvgBetSize(avgBetSize + 5)}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Info size={16} color={COLORS.navyDeep} />
                <Text style={styles.infoText}>
                  These settings affect the theoretical loss and casino hours calculations. 
                  Adjust based on your actual play patterns for more accurate estimates.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTheoDetails}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTheoDetails(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTheoDetails(false)}
        >
          <View style={styles.popoverContent}>
            <Text style={styles.popoverTitle}>Value Per Dollar Explained</Text>
            <Text style={styles.popoverText}>
              This shows how much value you receive for every $1 you spend on port taxes/fees.
              {'\n\n'}
              <Text style={styles.popoverBold}>Formula:</Text>{'\n'}
              Value per $1 = (Retail Value + Casino Winnings) ÷ Taxes Paid
              {'\n\n'}
              <Text style={styles.popoverBold}>Your Calculation:</Text>{'\n'}
              Retail Value: {formatCurrency(valueMetrics.totalRetailValue)}{'\n'}
              Casino Winnings: {valueMetrics.totalWinnings >= 0 ? '+' : ''}{formatCurrency(valueMetrics.totalWinnings)}{'\n'}
              Total Value: {formatCurrency(valueMetrics.totalValueReceived)}{'\n'}
              {'\n'}
              Taxes & Fees Paid: {formatCurrency(valueMetrics.totalTaxesPaid)}{'\n'}
              {'\n'}
              <Text style={styles.popoverBold}>Value/$1: {valueMetrics.valuePerDollar >= 9999 ? '∞' : `${valueMetrics.valuePerDollar.toFixed(2)}`}</Text>
              {'\n\n'}
              Since your cruises are comped, you only pay taxes/fees but receive full retail value + winnings!
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showScoreDetails}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowScoreDetails(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowScoreDetails(false)}
        >
          <View style={styles.popoverContent}>
            <Text style={styles.popoverTitle}>Predictive Score Explained</Text>
            <Text style={styles.popoverText}>
              Your predictive score estimates your value to casino hosts and predicts future offer quality.
              {'\n\n'}
              <Text style={styles.popoverBold}>Factors:</Text>{'\n'}
              • Average daily theoretical{'\n'}
              • Play consistency across cruises{'\n'}
              • Cruise frequency{'\n'}
              • Total coin-in volume{'\n'}
              • Average bet size
              {'\n\n'}
              <Text style={styles.popoverBold}>Tiers:</Text>{'\n'}
              Bronze (0-29) → Silver (30-49) → Gold (50-69) → Platinum (70-84) → Diamond (85+)
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingsButton: {
    padding: SPACING.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  metricSub: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: CLEAN_THEME.border.light,
    marginHorizontal: SPACING.sm,
  },
  tierBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: 2,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  expandedContent: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: CLEAN_THEME.border.light,
    backgroundColor: CLEAN_THEME.background.tertiary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  detailLabelBold: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  detailValueBold: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  highlightRow: {
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },
  divider: {
    height: 1,
    backgroundColor: CLEAN_THEME.border.light,
    marginVertical: SPACING.md,
  },
  recommendationsSection: {
    marginTop: SPACING.xs,
  },
  recommendationsTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  recommendationBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navyDeep,
    marginRight: SPACING.sm,
    marginTop: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CLEAN_THEME.background.primary,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  modalScroll: {
    padding: SPACING.md,
  },
  settingSection: {
    marginBottom: SPACING.lg,
  },
  settingLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  stepperValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    minWidth: 60,
    textAlign: 'center',
  },
  betInput: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    minWidth: 80,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
    paddingVertical: SPACING.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: CLEAN_THEME.background.tertiary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  toggleOptionActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  toggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.secondary,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  gameSelector: {
    flexDirection: 'row',
  },
  gameOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: CLEAN_THEME.background.tertiary,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  gameOptionActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  gameOptionText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.secondary,
  },
  gameOptionTextActive: {
    color: COLORS.white,
  },
  gameEdgeText: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 18,
  },
  modalCloseButton: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  popoverContent: {
    margin: SPACING.lg,
    backgroundColor: CLEAN_THEME.background.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    maxWidth: 350,
    alignSelf: 'center',
  },
  popoverTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  popoverText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 20,
  },
  popoverBold: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
});
