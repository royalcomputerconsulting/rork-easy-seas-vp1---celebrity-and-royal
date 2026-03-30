import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor, Star, TrendingUp, CheckCircle, Clock, Crown } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { createDateFromString, isDateInPast } from '@/lib/date';
import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import type { BookedCruise } from '@/types/models';

const LEVEL_THRESHOLDS: { name: string; points: number; color: string; bgColor: string }[] = [
  { name: 'Gold',         points: 1,   color: '#D4AF37', bgColor: 'rgba(212,175,55,0.15)' },
  { name: 'Platinum',     points: 30,  color: '#B0B0B0', bgColor: 'rgba(176,176,176,0.15)' },
  { name: 'Emerald',      points: 55,  color: '#10B981', bgColor: 'rgba(16,185,129,0.12)' },
  { name: 'Diamond',      points: 80,  color: '#00BCD4', bgColor: 'rgba(0,188,212,0.12)' },
  { name: 'Diamond Plus', points: 175, color: '#7B68EE', bgColor: 'rgba(123,104,238,0.12)' },
  { name: 'Pinnacle',     points: 700, color: '#B8860B', bgColor: 'rgba(184,134,11,0.12)' },
];

function getLevelAtPoints(pts: number): { name: string; points: number; color: string; bgColor: string } {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (pts >= LEVEL_THRESHOLDS[i].points) return LEVEL_THRESHOLDS[i];
  }
  return LEVEL_THRESHOLDS[0];
}

function getCrownAnchorPointsForCruise(cruise: BookedCruise): number {
  const nights = cruise.nights || 0;
  const isSolo = cruise.singleOccupancy !== false;
  const cabinType = cruise.cabinType || cruise.cabinCategory || '';
  const isSuite = cabinType.toLowerCase().includes('suite');

  if (isSuite && isSolo) return nights * 3;
  if (isSuite && !isSolo) return nights * 2;
  if (isSolo) return nights * 2;
  return nights * 1;
}

function getMultiplierLabel(cruise: BookedCruise): string {
  const isSolo = cruise.singleOccupancy !== false;
  const cabinType = cruise.cabinType || cruise.cabinCategory || '';
  const isSuite = cabinType.toLowerCase().includes('suite');
  if (isSuite && isSolo) return '3×';
  if (isSuite && !isSolo) return '2×';
  if (isSolo) return '2×';
  return '1×';
}

interface CrownAnchorTimelineProps {
  currentPoints: number;
  bookedCruises: BookedCruise[];
}

interface TimelineEntry {
  cruise: BookedCruise;
  pointsAdded: number;
  runningTotal: number;
  multiplierLabel: string;
  isCompleted: boolean;
  levelBefore: { name: string; points: number; color: string; bgColor: string };
  levelAfter: { name: string; points: number; color: string; bgColor: string };
  levelUp: boolean;
  crossesPinnacle: boolean;
  isPinnacleFirstCruise: boolean;
}

export function CrownAnchorTimeline({ currentPoints, bookedCruises }: CrownAnchorTimelineProps) {
  const timeline = useMemo((): TimelineEntry[] => {
    const today = new Date();

    const rciCruises = bookedCruises
      .filter(c => {
        if (!isRoyalCaribbeanShip(c.shipName)) return false;
        const returnDate = c.returnDate ? createDateFromString(c.returnDate) : null;
        const isCompleted = returnDate ? returnDate < today : c.completionState === 'completed';
        return !isCompleted;
      })
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());

    const entries: TimelineEntry[] = [];
    let running = currentPoints;
    let pinnacleThresholdCrossedIdx = -1;

    rciCruises.forEach((cruise, idx) => {
      const pts = getCrownAnchorPointsForCruise(cruise);
      const levelBefore = getLevelAtPoints(running);
      const newTotal = running + pts;
      const levelAfter = getLevelAtPoints(newTotal);
      const levelUp = levelBefore.name !== levelAfter.name;

      const crossesPinnacle =
        pinnacleThresholdCrossedIdx === -1 &&
        running < 700 &&
        newTotal >= 700;

      if (crossesPinnacle) {
        pinnacleThresholdCrossedIdx = idx;
      }

      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      const isCompleted = returnDate ? returnDate < today : cruise.completionState === 'completed';

      entries.push({
        cruise,
        pointsAdded: pts,
        runningTotal: newTotal,
        multiplierLabel: getMultiplierLabel(cruise),
        isCompleted,
        levelBefore,
        levelAfter,
        levelUp,
        crossesPinnacle,
        isPinnacleFirstCruise: pinnacleThresholdCrossedIdx !== -1 && idx === pinnacleThresholdCrossedIdx + 1,
      });

      running = newTotal;
    });

    return entries;
  }, [bookedCruises, currentPoints]);

  const finalTotal = timeline.length > 0 ? timeline[timeline.length - 1].runningTotal : currentPoints;
  const pinnacleEntry = timeline.find(e => e.crossesPinnacle);
  const pointsStillNeeded = Math.max(0, 700 - finalTotal);
  const currentLevel = getLevelAtPoints(currentPoints);

  if (timeline.length === 0) {
    return (
      <View style={styles.empty}>
        <Anchor size={36} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Royal Caribbean Cruises</Text>
        <Text style={styles.emptyText}>Add booked RCI cruises to see your C&A points timeline.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <LinearGradient
        colors={['#0F2439', '#1E3A5F']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <Anchor size={18} color={COLORS.aquaAccent} />
          <Text style={styles.headerTitle}>Crown & Anchor Points Timeline</Text>
        </View>

        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{currentPoints}</Text>
            <Text style={styles.headerStatLabel}>Current Pts</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: COLORS.aquaAccent }]}>{finalTotal}</Text>
            <Text style={styles.headerStatLabel}>Projected Total</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: COLORS.goldAccent }]}>
              {pointsStillNeeded === 0 ? '✓' : pointsStillNeeded}
            </Text>
            <Text style={styles.headerStatLabel}>{pointsStillNeeded === 0 ? 'Pinnacle!' : 'To Pinnacle'}</Text>
          </View>
        </View>

        {pinnacleEntry && (
          <View style={styles.pinnacleAlert}>
            <Crown size={14} color={COLORS.goldAccent} />
            <Text style={styles.pinnacleAlertText}>
              Threshold crossed on{' '}
              <Text style={{ fontWeight: '700' }}>{pinnacleEntry.cruise.shipName}</Text>
              {' '}·{' '}
              {createDateFromString(pinnacleEntry.cruise.sailDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
              })}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Starting point row */}
      <View style={styles.startRow}>
        <View style={[styles.startDot, { backgroundColor: currentLevel.color }]} />
        <View style={styles.startLine} />
        <View style={styles.startInfo}>
          <Text style={styles.startLabel}>Starting Points</Text>
          <Text style={[styles.startPoints, { color: currentLevel.color }]}>
            {currentPoints} pts · {currentLevel.name}
          </Text>
        </View>
      </View>

      {/* Timeline entries */}
      {timeline.map((entry, idx) => {
        const isLast = idx === timeline.length - 1;
        const sailDate = createDateFromString(entry.cruise.sailDate);
        const dateStr = sailDate.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        });

        return (
          <View key={entry.cruise.id} style={styles.entryRow}>
            {/* Left: connector line + dot */}
            <View style={styles.entryLeft}>
              {!isLast && <View style={styles.connectorLine} />}
              <View style={[
                styles.dot,
                entry.crossesPinnacle
                  ? styles.dotPinnacle
                  : entry.levelUp
                  ? [styles.dotLevelUp, { borderColor: entry.levelAfter.color }]
                  : entry.isCompleted
                  ? styles.dotCompleted
                  : styles.dotUpcoming,
              ]}>
                {entry.crossesPinnacle ? (
                  <Crown size={10} color={COLORS.goldAccent} />
                ) : entry.levelUp ? (
                  <TrendingUp size={10} color={entry.levelAfter.color} />
                ) : entry.isCompleted ? (
                  <CheckCircle size={10} color={COLORS.success} />
                ) : (
                  <Clock size={10} color={COLORS.aquaAccent} />
                )}
              </View>
            </View>

            {/* Right: card */}
            <View style={[
              styles.card,
              entry.crossesPinnacle && styles.cardPinnacle,
              entry.levelUp && !entry.crossesPinnacle && styles.cardLevelUp,
              entry.isCompleted && !entry.levelUp && !entry.crossesPinnacle && styles.cardCompleted,
            ]}>
              {entry.crossesPinnacle && (
                <LinearGradient
                  colors={['rgba(184,134,11,0.18)', 'rgba(184,134,11,0.04)']}
                  style={styles.cardPinnacleGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              )}

              <View style={styles.cardTop}>
                <View style={styles.cardShipInfo}>
                  <Text style={styles.cardShip} numberOfLines={1}>{entry.cruise.shipName}</Text>
                  <Text style={styles.cardDate}>{dateStr}</Text>
                </View>
                <View style={styles.cardPointsBox}>
                  <Text style={styles.cardPointsAdded}>+{entry.pointsAdded}</Text>
                  <Text style={styles.cardPointsMult}>{entry.multiplierLabel} / night</Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.cardNightsRow}>
                  <Text style={styles.cardNights}>{entry.cruise.nights}N</Text>
                  {entry.cruise.itineraryName ? (
                    <Text style={styles.cardItinerary} numberOfLines={1}>{entry.cruise.itineraryName}</Text>
                  ) : null}
                </View>
                <View style={styles.cardTotalRow}>
                  <Text style={styles.cardTotalLabel}>Running Total:</Text>
                  <Text style={[
                    styles.cardTotal,
                    entry.crossesPinnacle ? { color: COLORS.goldAccent } :
                    entry.levelUp ? { color: entry.levelAfter.color } :
                    { color: COLORS.aquaAccent },
                  ]}>
                    {entry.runningTotal} pts
                  </Text>
                </View>
              </View>

              {entry.levelUp && (
                <View style={[styles.levelUpBadge, { backgroundColor: entry.levelAfter.bgColor, borderColor: entry.levelAfter.color }]}>
                  <Star size={11} color={entry.levelAfter.color} />
                  <Text style={[styles.levelUpText, { color: entry.levelAfter.color }]}>
                    Level Up → {entry.levelAfter.name}
                  </Text>
                </View>
              )}

              {entry.crossesPinnacle && (
                <View style={styles.pinnacleThresholdBadge}>
                  <Crown size={12} color={COLORS.goldAccent} />
                  <Text style={styles.pinnacleThresholdText}>
                    Pinnacle threshold crossed! First Pinnacle cruise is next sailing.
                  </Text>
                </View>
              )}

              {entry.isPinnacleFirstCruise && (
                <View style={styles.firstPinnacleBadge}>
                  <Crown size={12} color={COLORS.white} />
                  <Text style={styles.firstPinnacleText}>First Cruise as Pinnacle Member</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* Final summary */}
      <View style={styles.finalRow}>
        <View style={[styles.finalDot, { backgroundColor: getLevelAtPoints(finalTotal).color }]} />
        <View style={[styles.finalCard, { borderColor: getLevelAtPoints(finalTotal).color }]}>
          <Text style={styles.finalLabel}>After All Booked Cruises</Text>
          <Text style={[styles.finalPoints, { color: getLevelAtPoints(finalTotal).color }]}>
            {finalTotal} pts — {getLevelAtPoints(finalTotal).name}
          </Text>
          {pointsStillNeeded > 0 && (
            <Text style={styles.finalNeeded}>
              {pointsStillNeeded} points still needed for Pinnacle
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
    marginHorizontal: SPACING.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textNavy,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  header: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  headerStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  headerStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pinnacleAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(184,134,11,0.15)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(184,134,11,0.3)',
  },
  pinnacleAlertText: {
    fontSize: 12,
    color: COLORS.goldAccent,
    flex: 1,
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    marginTop: 16,
    marginBottom: 0,
    gap: 10,
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
  },
  startLine: {
    position: 'absolute',
    left: 15,
    top: 20,
    width: 1,
    height: 24,
    backgroundColor: COLORS.borderLight,
  },
  startInfo: {
    flex: 1,
  },
  startLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  startPoints: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  entryRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  entryLeft: {
    width: 36,
    alignItems: 'center',
    paddingTop: 14,
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    top: 0,
    bottom: -6,
    width: 1,
    backgroundColor: COLORS.borderLight,
    left: 17,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgTertiary,
    borderWidth: 2,
    borderColor: COLORS.borderMedium,
    zIndex: 2,
  },
  dotCompleted: {
    backgroundColor: 'rgba(5,150,105,0.08)',
    borderColor: COLORS.success,
  },
  dotUpcoming: {
    backgroundColor: 'rgba(0,172,193,0.08)',
    borderColor: COLORS.aquaAccent,
  },
  dotLevelUp: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2.5,
  },
  dotPinnacle: {
    backgroundColor: 'rgba(184,134,11,0.12)',
    borderColor: COLORS.goldAccent,
    borderWidth: 2.5,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  card: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 6,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardCompleted: {
    backgroundColor: '#F9FFF9',
    borderColor: 'rgba(5,150,105,0.2)',
  },
  cardLevelUp: {
    borderWidth: 1.5,
  },
  cardPinnacle: {
    borderColor: COLORS.goldAccent,
    borderWidth: 2,
  },
  cardPinnacleGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  cardShipInfo: {
    flex: 1,
    marginRight: 8,
  },
  cardShip: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textNavy,
  },
  cardDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardPointsBox: {
    alignItems: 'flex-end',
  },
  cardPointsAdded: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.tealAccent,
    letterSpacing: -0.5,
  },
  cardPointsMult: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    zIndex: 1,
  },
  cardNightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardNights: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDarkGrey,
    backgroundColor: COLORS.bgTertiary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardItinerary: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  cardTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTotalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  cardTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  levelUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
    zIndex: 1,
  },
  levelUpText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinnacleThresholdBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 9,
    backgroundColor: 'rgba(184,134,11,0.12)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(184,134,11,0.35)',
    zIndex: 1,
  },
  pinnacleThresholdText: {
    fontSize: 12,
    color: COLORS.goldRich,
    fontWeight: '600',
    flex: 1,
  },
  firstPinnacleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
    backgroundColor: COLORS.goldRich,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 1,
  },
  firstPinnacleText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingLeft: 6,
    gap: 12,
  },
  finalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  finalCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  finalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finalPoints: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  finalNeeded: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
});
