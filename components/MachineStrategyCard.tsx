import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, Target, DollarSign, Clock, Zap } from 'lucide-react-native';
import { useMachineStrategy, MachineRecommendation } from '@/state/MachineStrategyProvider';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';

export function MachineStrategyCard() {
  const { recommendations, insights, bestMachine, mostConsistentMachine } = useMachineStrategy();
  const [selectedTab, setSelectedTab] = useState<'recommendations' | 'insights'>('recommendations');

  if (recommendations.length === 0) {
    return (
      <LinearGradient
        colors={MARBLE_TEXTURES.lightBlue.gradientColors}
        locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <Target size={24} color="#1E40AF" />
          <Text style={styles.title}>Machine Strategy</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Add casino sessions to see recommendations</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={MARBLE_TEXTURES.lightBlue.gradientColors}
      locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <Target size={24} color="#1E40AF" />
        <Text style={styles.title}>Machine Strategy</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'recommendations' && styles.tabActive]}
          onPress={() => setSelectedTab('recommendations')}
        >
          <Text style={[styles.tabText, selectedTab === 'recommendations' && styles.tabTextActive]}>
            Top Picks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'insights' && styles.tabActive]}
          onPress={() => setSelectedTab('insights')}
        >
          <Text style={[styles.tabText, selectedTab === 'insights' && styles.tabTextActive]}>
            Insights
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'recommendations' && (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {bestMachine && (
            <View style={styles.highlightBox}>
              <View style={styles.highlightHeader}>
                <Zap size={18} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.highlightTitle}>Best Performer</Text>
              </View>
              <RecommendationItem recommendation={bestMachine} isHighlight />
            </View>
          )}

          {mostConsistentMachine && mostConsistentMachine !== bestMachine && (
            <View style={[styles.highlightBox, { backgroundColor: '#DBEAFE' }]}>
              <View style={styles.highlightHeader}>
                <Target size={18} color="#3B82F6" />
                <Text style={styles.highlightTitle}>Most Consistent</Text>
              </View>
              <RecommendationItem recommendation={mostConsistentMachine} isHighlight />
            </View>
          )}

          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>All Recommendations</Text>
            {recommendations.slice(0, 6).map((rec, index) => (
              <RecommendationItem key={index} recommendation={rec} rank={index + 1} />
            ))}
          </View>
        </ScrollView>
      )}

      {selectedTab === 'insights' && (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {insights.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Play more sessions to generate insights</Text>
            </View>
          ) : (
            insights.map((insight) => (
              <View key={insight.id} style={styles.insightBox}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>{insight.confidence.toFixed(0)}%</Text>
                  </View>
                </View>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

interface RecommendationItemProps {
  recommendation: MachineRecommendation;
  rank?: number;
  isHighlight?: boolean;
}

function RecommendationItem({ recommendation, rank, isHighlight }: RecommendationItemProps) {
  const isPositive = recommendation.avgWinLoss > 0;

  return (
    <View style={[styles.recItem, isHighlight && styles.recItemHighlight]}>
      {rank && (
        <View style={[styles.rankBadge, rank === 1 && styles.rankBadgeGold]}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )}
      <View style={styles.recContent}>
        <Text style={styles.recMachine}>{formatMachineType(recommendation.machineType)}</Text>
        <Text style={styles.recReason}>{recommendation.reason}</Text>
        
        <View style={styles.recStats}>
          <View style={styles.recStat}>
            {isPositive ? (
              <TrendingUp size={14} color="#10B981" />
            ) : (
              <TrendingDown size={14} color="#EF4444" />
            )}
            <Text style={[styles.recStatText, isPositive ? styles.positive : styles.negative]}>
              ${Math.abs(recommendation.avgWinLoss).toFixed(0)}
            </Text>
          </View>
          
          <View style={styles.recStat}>
            <Target size={14} color="#6B7280" />
            <Text style={styles.recStatText}>{recommendation.winRate.toFixed(0)}% wins</Text>
          </View>
          
          <View style={styles.recStat}>
            <Zap size={14} color="#F59E0B" />
            <Text style={styles.recStatText}>{recommendation.pointsPerHour.toFixed(0)} PPH</Text>
          </View>
        </View>

        <View style={styles.recFooter}>
          <View style={styles.recStat}>
            <Clock size={12} color="#9CA3AF" />
            <Text style={styles.recFooterText}>
              {recommendation.sessionCount} session{recommendation.sessionCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.volatilityBadge, styles[`volatility${recommendation.volatility.charAt(0).toUpperCase() + recommendation.volatility.slice(1)}` as keyof typeof styles]]}>
            <Text style={styles.volatilityText}>
              {recommendation.volatility.toUpperCase()}
            </Text>
          </View>
          <View style={styles.recStat}>
            <DollarSign size={12} color="#9CA3AF" />
            <Text style={styles.recFooterText}>
              ${recommendation.recommendedBankroll.toFixed(0)} bankroll
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function formatMachineType(machineType: string): string {
  const map: Record<string, string> = {
    'penny-slots': 'Penny Slots',
    'nickel-slots': 'Nickel Slots',
    'quarter-slots': 'Quarter Slots',
    'dollar-slots': 'Dollar Slots',
    'high-limit-slots': 'High Limit Slots',
    'video-poker': 'Video Poker',
    'blackjack': 'Blackjack',
    'roulette': 'Roulette',
    'craps': 'Craps',
    'baccarat': 'Baccarat',
    'poker': 'Poker',
    'other': 'Other',
  };
  return map[machineType] || machineType;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1E293B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1E40AF',
  },
  scrollView: {
    maxHeight: 500,
  },
  highlightBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
    textTransform: 'uppercase' as const,
  },
  listContainer: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 8,
    marginTop: 4,
  },
  recItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
  },
  recItemHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: {
    backgroundColor: '#F59E0B',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  recContent: {
    flex: 1,
    gap: 6,
  },
  recMachine: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1E293B',
  },
  recReason: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  recStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  recStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recStatText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#475569',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  recFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  volatilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  volatilityLow: {
    backgroundColor: '#D1FAE5',
  },
  volatilityMedium: {
    backgroundColor: '#FEF3C7',
  },
  volatilityHigh: {
    backgroundColor: '#FEE2E2',
  },
  volatilityText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#374151',
  },
  insightBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1E293B',
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#1E40AF',
  },
  insightDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center' as const,
  },
});
