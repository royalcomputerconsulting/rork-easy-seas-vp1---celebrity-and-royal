import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { 
  Dices, 
  Clock, 
  Target, 
  TrendingUp, 
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { CasinoSession, DailySessionSummary } from '@/state/CasinoSessionProvider';



interface GoldenTimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  label: string;
}

interface CasinoSessionTrackerProps {
  date: string;
  goldenTimeSlots: GoldenTimeSlot[];
  sessions: CasinoSession[];
  summary: DailySessionSummary;
  onAddSession: () => void;
  onRemoveSession: (sessionId: string) => void;
  onViewDetails?: () => void;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function AnimatedProgressRing({ 
  percentage, 
  size = 120, 
  strokeWidth = 10,
  goldenMinutes,
  playedMinutes,
}: { 
  percentage: number; 
  size?: number;
  strokeWidth?: number;
  goldenMinutes: number;
  playedMinutes: number;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [percentage, animatedValue]);



  const progressColor = percentage >= 100 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#3B82F6';

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      <View style={styles.ringBackground}>
        <View style={[styles.ringTrack, { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderWidth: strokeWidth,
        }]} />
      </View>
      <Animated.View 
        style={[
          styles.ringProgress, 
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: progressColor,
            transform: [{ rotate: '-90deg' }],
          }
        ]} 
      />
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercentage}>{Math.round(percentage)}%</Text>
        <Text style={styles.ringLabel}>Complete</Text>
        <View style={styles.ringStats}>
          <Text style={styles.ringStatText}>
            {formatMinutes(playedMinutes)} / {formatMinutes(goldenMinutes)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HourlyBreakdownChart({ 
  goldenTimeSlots, 
  sessions 
}: { 
  goldenTimeSlots: GoldenTimeSlot[];
  sessions: CasinoSession[];
}) {
  const timeToHour = (time: string): number => {
    const [hours] = time.split(':').map(Number);
    return hours;
  };

  const hourlyData = useMemo(() => {
    const data: { hour: number; golden: number; played: number }[] = [];
    
    for (let h = 0; h < 24; h++) {
      let goldenMins = 0;
      let playedMins = 0;
      
      goldenTimeSlots.forEach(slot => {
        const startHour = timeToHour(slot.startTime);
        let endHour = timeToHour(slot.endTime);
        if (endHour <= startHour) endHour += 24;
        
        const normalizedH = h < startHour && endHour > 24 ? h + 24 : h;
        
        if (normalizedH >= startHour && normalizedH < endHour) {
          goldenMins = 60;
        }
      });
      
      sessions.forEach(session => {
        const startHour = timeToHour(session.startTime);
        let endHour = timeToHour(session.endTime);
        if (endHour <= startHour) endHour += 24;
        
        const normalizedH = h < startHour && endHour > 24 ? h + 24 : h;
        
        if (normalizedH >= startHour && normalizedH < endHour) {
          playedMins = Math.min(60, session.durationMinutes);
        }
      });
      
      data.push({ hour: h, golden: goldenMins, played: playedMins });
    }
    
    return data.filter(d => d.golden > 0 || d.played > 0);
  }, [goldenTimeSlots, sessions]);

  if (hourlyData.length === 0) return null;

  const maxHeight = 40;

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Hourly Breakdown</Text>
      <View style={styles.chartContent}>
        {hourlyData.map((item, index) => (
          <View key={index} style={styles.chartBar}>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.goldenBar, 
                  { height: (item.golden / 60) * maxHeight }
                ]} 
              />
              {item.played > 0 && (
                <View 
                  style={[
                    styles.playedBar, 
                    { height: (item.played / 60) * maxHeight }
                  ]} 
                />
              )}
            </View>
            <Text style={styles.barLabel}>
              {item.hour.toString().padStart(2, '0')}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(16, 185, 129, 0.3)' }]} />
          <Text style={styles.legendText}>Golden Time</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Played</Text>
        </View>
      </View>
    </View>
  );
}

export function CasinoSessionTracker({
  date,
  goldenTimeSlots,
  sessions,
  summary,
  onAddSession,
  onRemoveSession,
  onViewDetails,
}: CasinoSessionTrackerProps) {
  const totalGoldenMinutes = useMemo(() => {
    return goldenTimeSlots.reduce((total, slot) => total + slot.durationMinutes, 0);
  }, [goldenTimeSlots]);

  const hasGoldenTime = totalGoldenMinutes > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Dices size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Session Tracker</Text>
            <Text style={styles.headerSubtitle}>
              {hasGoldenTime 
                ? `${formatMinutes(totalGoldenMinutes)} Golden Time Available`
                : 'No Golden Time Today'
              }
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={onAddSession}
          activeOpacity={0.7}
        >
          <Plus size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {hasGoldenTime ? (
          <>
            <View style={styles.progressSection}>
              <AnimatedProgressRing
                percentage={summary.percentageComplete}
                goldenMinutes={totalGoldenMinutes}
                playedMinutes={summary.totalPlayedMinutes}
              />
              
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Target size={16} color="#10B981" />
                  </View>
                  <Text style={styles.statValue}>{formatMinutes(totalGoldenMinutes)}</Text>
                  <Text style={styles.statLabel}>Golden Time</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Clock size={16} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{formatMinutes(summary.totalPlayedMinutes)}</Text>
                  <Text style={styles.statLabel}>Played</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <TrendingUp size={16} color="#F59E0B" />
                  </View>
                  <Text style={styles.statValue}>
                    {formatMinutes(Math.max(0, totalGoldenMinutes - summary.totalPlayedMinutes))}
                  </Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
              </View>
            </View>

            <HourlyBreakdownChart 
              goldenTimeSlots={goldenTimeSlots}
              sessions={sessions}
            />

            {goldenTimeSlots.length > 0 && (
              <View style={styles.slotsSection}>
                <Text style={styles.sectionTitle}>Golden Time Slots</Text>
                {goldenTimeSlots.map((slot) => (
                  <View key={slot.id} style={styles.slotItem}>
                    <View style={styles.slotIndicator} />
                    <View style={styles.slotContent}>
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                      <Text style={styles.slotTime}>
                        {slot.startTime} - {slot.endTime} ({formatMinutes(slot.durationMinutes)})
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {sessions.length > 0 && (
              <View style={styles.sessionsSection}>
                <Text style={styles.sectionTitle}>Logged Sessions</Text>
                {sessions.map((session) => (
                  <View key={session.id} style={styles.sessionItem}>
                    <View style={styles.sessionIndicator} />
                    <View style={styles.sessionContent}>
                      <Text style={styles.sessionTime}>
                        {session.startTime} - {session.endTime}
                      </Text>
                      <Text style={styles.sessionDuration}>
                        {formatMinutes(session.durationMinutes)}
                      </Text>
                      {session.notes && (
                        <Text style={styles.sessionNotes}>{session.notes}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => onRemoveSession(session.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {onViewDetails && (
              <TouchableOpacity 
                style={styles.viewDetailsButton}
                onPress={onViewDetails}
                activeOpacity={0.7}
              >
                <Text style={styles.viewDetailsText}>View Full Analytics</Text>
                <ChevronRight size={18} color="#059669" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.noGoldenTime}>
            <View style={styles.noGoldenIcon}>
              <Dices size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.noGoldenTitle}>No Golden Time Today</Text>
            <Text style={styles.noGoldenText}>
              There are no opportune playing times when the casino is open and matches your preferred playing hours.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.navyDeep,
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 31, 63, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  ringContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ringBackground: {
    position: 'absolute',
  },
  ringTrack: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  ringProgress: {
    position: 'absolute',
  },
  ringCenter: {
    alignItems: 'center',
  },
  ringPercentage: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  ringLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginTop: 2,
  },
  ringStats: {
    marginTop: SPACING.xs,
  },
  ringStatText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginTop: 2,
  },
  chartContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E293B',
    marginBottom: SPACING.sm,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 60,
    paddingBottom: SPACING.sm,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 30,
  },
  barContainer: {
    width: 16,
    height: 40,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  goldenBar: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 2,
    position: 'absolute',
    bottom: 0,
  },
  playedBar: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
    position: 'absolute',
    bottom: 0,
  },
  barLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
  },
  slotsSection: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E293B',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotIndicator: {
    width: 4,
    height: 32,
    backgroundColor: '#10B981',
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  slotContent: {
    flex: 1,
  },
  slotLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#1E293B',
  },
  slotTime: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginTop: 2,
  },
  sessionsSection: {
    marginBottom: SPACING.md,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionIndicator: {
    width: 4,
    height: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    marginRight: SPACING.sm,
  },
  sessionContent: {
    flex: 1,
  },
  sessionTime: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#1E293B',
  },
  sessionDuration: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#3B82F6',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: 2,
  },
  sessionNotes: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewDetailsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#1E293B',
  },
  noGoldenTime: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  noGoldenIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  noGoldenTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#64748B',
    marginBottom: SPACING.xs,
  },
  noGoldenText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
