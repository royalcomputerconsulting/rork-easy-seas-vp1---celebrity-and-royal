import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dice5, Search, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { SHIP_SLOT_DATA, type ShipSlotMachine } from '@/constants/ship2slots';

interface ShipMachinesPanelProps {
  shipName: string;
}

/** Groups machines by title and shows how many variants exist. */
interface MachineGroup {
  title: string;
  manufacturer: string;
  family: string;
  variants: string[];
  topConfidence: number;
  topApScore: number;
}

function groupMachines(machines: ShipSlotMachine[]): MachineGroup[] {
  const map = new Map<string, MachineGroup>();
  for (const m of machines) {
    const key = `${m.manufacturer}::${m.title}`;
    if (!map.has(key)) {
      map.set(key, {
        title: m.title,
        manufacturer: m.manufacturer,
        family: m.family,
        variants: [],
        topConfidence: m.confidence,
        topApScore: m.apScore,
      });
    }
    const group = map.get(key)!;
    if (m.variant && !group.variants.includes(m.variant)) {
      group.variants.push(m.variant);
    }
    if (m.confidence > group.topConfidence) group.topConfidence = m.confidence;
    if (m.apScore > group.topApScore) group.topApScore = m.apScore;
  }
  return Array.from(map.values()).sort((a, b) => b.topApScore - a.topApScore || a.title.localeCompare(b.title));
}

/** Fuzzy-match normalised ship name to data key */
function resolveShipKey(shipName: string): string | null {
  if (!shipName) return null;
  const normalised = shipName.trim();
  if (SHIP_SLOT_DATA[normalised]) return normalised;
  // Case-insensitive fallback
  const lower = normalised.toLowerCase();
  const found = Object.keys(SHIP_SLOT_DATA).find((k) => k.toLowerCase() === lower);
  return found ?? null;
}

export function ShipMachinesPanel({ shipName }: ShipMachinesPanelProps) {
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);

  const shipKey = useMemo(() => resolveShipKey(shipName), [shipName]);
  const allMachines: ShipSlotMachine[] = useMemo(() => (shipKey ? SHIP_SLOT_DATA[shipKey] ?? [] : []), [shipKey]);
  const groups: MachineGroup[] = useMemo(() => groupMachines(allMachines), [allMachines]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.manufacturer.toLowerCase().includes(q) ||
        g.family.toLowerCase().includes(q) ||
        g.variants.some((v) => v.toLowerCase().includes(q)),
    );
  }, [groups, search]);

  if (!shipKey || allMachines.length === 0) {
    return null;
  }

  const displayGroups = expanded ? filtered : filtered.slice(0, 12);
  const hasMore = filtered.length > 12;

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(255,255,255,0.96)', 'rgba(224,242,241,0.92)', 'rgba(0,172,193,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Dice5 size={14} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Machines Aboard</Text>
            <Text style={styles.subtitle}>
              {groups.length} unique machines · {allMachines.length} total entries aboard {shipName}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={14} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search machines..."
              placeholderTextColor={COLORS.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {search.length > 0 && (
            <Text style={styles.resultCount}>{filtered.length} found</Text>
          )}
        </View>

        {/* Machine list */}
        <ScrollView
          style={styles.list}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {displayGroups.map((g, i) => (
            <View
              key={`${g.manufacturer}-${g.title}-${i}`}
              style={[styles.machineRow, i % 2 === 0 && styles.machineRowAlt]}
            >
              <View style={styles.machineMain}>
                <Text style={styles.machineTitle} numberOfLines={1}>{g.title}</Text>
                {g.variants.length > 0 && (
                  <Text style={styles.machineVariants} numberOfLines={2}>
                    {g.variants.slice(0, 4).join(' · ')}{g.variants.length > 4 ? ` +${g.variants.length - 4}` : ''}
                  </Text>
                )}
              </View>
              <View style={styles.machineMeta}>
                <View style={styles.manufacturerChip}>
                  <Text style={styles.manufacturerText} numberOfLines={1}>{g.manufacturer}</Text>
                </View>
                {g.family ? (
                  <View style={styles.familyChip}>
                    <Text style={styles.familyText} numberOfLines={1}>{g.family}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No machines match "{search}"</Text>
            </View>
          )}
        </ScrollView>

        {/* Show more / less */}
        {hasMore && (
          <TouchableOpacity
            style={styles.showMoreBtn}
            onPress={() => setExpanded((v) => !v)}
            activeOpacity={0.75}
          >
            {expanded ? <ChevronUp size={15} color={COLORS.navyDeep} /> : <ChevronDown size={15} color={COLORS.navyDeep} />}
            <Text style={styles.showMoreText}>
              {expanded ? 'Show less' : `Show all ${filtered.length} machines`}
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.12)',
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 58, 95, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    gap: SPACING.xs,
    ...SHADOW.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textNavy,
    padding: 0,
  },
  resultCount: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    minWidth: 52,
    textAlign: 'right' as const,
  },
  list: {
    gap: 0,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.sm,
  },
  machineRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  machineMain: {
    flex: 1,
    gap: 2,
  },
  machineTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
  },
  machineVariants: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
  },
  machineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
    maxWidth: '40%',
  },
  manufacturerChip: {
    backgroundColor: '#D8F1FF',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#A9DDF8',
  },
  manufacturerText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  familyChip: {
    backgroundColor: COLORS.champagne,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(212,160,10,0.3)',
  },
  familyText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: COLORS.goldRich,
  },
  empty: {
    paddingVertical: SPACING.lg,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textMuted,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 58, 95, 0.08)',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  showMoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
});
