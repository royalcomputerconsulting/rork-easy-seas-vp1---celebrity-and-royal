import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dice5,
  Search,
  X,
  Ship,
  ChevronDown,
  ChevronUp,
  Check,
  SlidersHorizontal,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { SHIP_SLOT_DATA, SHIP_SLOT_SHIPS, type ShipSlotMachine } from '@/constants/ship2slots';

interface MachineGroup {
  title: string;
  manufacturer: string;
  family: string;
  variants: string[];
  ships: string[];
  topApScore: number;
}

function buildAllGroups(selectedShips: string[]): MachineGroup[] {
  const ships = selectedShips.length > 0 ? selectedShips : SHIP_SLOT_SHIPS;
  const map = new Map<string, MachineGroup>();

  for (const ship of ships) {
    const machines: ShipSlotMachine[] = SHIP_SLOT_DATA[ship] ?? [];
    for (const m of machines) {
      const key = `${m.manufacturer}::${m.title}`;
      if (!map.has(key)) {
        map.set(key, {
          title: m.title,
          manufacturer: m.manufacturer,
          family: m.family,
          variants: [],
          ships: [],
          topApScore: m.apScore,
        });
      }
      const g = map.get(key)!;
      if (m.variant && !g.variants.includes(m.variant)) g.variants.push(m.variant);
      if (!g.ships.includes(ship)) g.ships.push(ship);
      if (m.apScore > g.topApScore) g.topApScore = m.apScore;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.topApScore - a.topApScore || a.title.localeCompare(b.title));
}

export function ShipMachinesExplorer() {
  const [selectedShips, setSelectedShips] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');
  const [showShipPicker, setShowShipPicker] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(30);

  const groups = useMemo(() => buildAllGroups(selectedShips), [selectedShips]);

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

  const toggleShip = useCallback((ship: string) => {
    setSelectedShips((prev) =>
      prev.includes(ship) ? prev.filter((s) => s !== ship) : [...prev, ship],
    );
    setVisibleCount(30);
  }, []);

  const clearShips = useCallback(() => {
    setSelectedShips([]);
    setVisibleCount(30);
  }, []);

  const shipFilterLabel =
    selectedShips.length === 0
      ? 'All Ships'
      : selectedShips.length === 1
      ? selectedShips[0]
      : `${selectedShips.length} Ships Selected`;

  const displayGroups = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

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
            <Dice5 size={13} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Ship Machine Explorer</Text>
            <Text style={styles.subtitle}>
              Browse slot machines across the Royal Caribbean fleet
            </Text>
          </View>
        </View>

        {/* Ship Filter Button */}
        <TouchableOpacity
          style={styles.shipFilterButton}
          onPress={() => setShowShipPicker((v) => !v)}
          activeOpacity={0.75}
        >
          <Ship size={15} color={COLORS.navyDeep} />
          <Text style={styles.shipFilterLabel}>{shipFilterLabel}</Text>
          {selectedShips.length > 0 && (
            <View style={styles.shipCountBadge}>
              <Text style={styles.shipCountText}>{selectedShips.length}</Text>
            </View>
          )}
          {showShipPicker ? (
            <ChevronUp size={15} color={COLORS.textDarkGrey} />
          ) : (
            <ChevronDown size={15} color={COLORS.textDarkGrey} />
          )}
        </TouchableOpacity>

        {/* Ship Picker Panel */}
        {showShipPicker && (
          <View style={styles.shipPanel}>
            <ScrollView
              style={styles.shipScroll}
              contentContainerStyle={styles.shipList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {SHIP_SLOT_SHIPS.map((ship) => {
                const isSelected = selectedShips.includes(ship);
                const machineCount = SHIP_SLOT_DATA[ship]?.length ?? 0;
                return (
                  <TouchableOpacity
                    key={ship}
                    style={[styles.shipOption, isSelected && styles.shipOptionActive]}
                    onPress={() => toggleShip(ship)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.shipCheckbox, isSelected && styles.shipCheckboxActive]}>
                      {isSelected && <Check size={11} color={COLORS.white} />}
                    </View>
                    <Text style={[styles.shipOptionText, isSelected && styles.shipOptionTextActive]} numberOfLines={1}>
                      {ship}
                    </Text>
                    <Text style={[styles.shipMachineCount, isSelected && styles.shipMachineCountActive]}>
                      {machineCount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedShips.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearShips} activeOpacity={0.75}>
                <X size={13} color={COLORS.error} />
                <Text style={styles.clearBtnText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={14} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={(v) => { setSearch(v); setVisibleCount(30); }}
              placeholder="Search machines, manufacturers..."
              placeholderTextColor={COLORS.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <SlidersHorizontal size={11} color={COLORS.navyDeep} />
            <Text style={styles.statChipText}>
              {filtered.length} machine{filtered.length !== 1 ? 's' : ''}
              {selectedShips.length > 0 ? ` · ${selectedShips.length} ship${selectedShips.length !== 1 ? 's' : ''}` : ' · All fleet'}
            </Text>
          </View>
        </View>

        {/* Machine List */}
        <View style={styles.listContainer}>
          {displayGroups.map((g, i) => (
            <View
              key={`${g.manufacturer}-${g.title}-${i}`}
              style={[styles.machineRow, i % 2 === 0 && styles.machineRowAlt]}
            >
              <View style={styles.machineMain}>
                <Text style={styles.machineTitle} numberOfLines={1}>{g.title}</Text>
                {g.variants.length > 0 && (
                  <Text style={styles.machineVariants} numberOfLines={2}>
                    {g.variants.slice(0, 4).join(' · ')}
                    {g.variants.length > 4 ? ` +${g.variants.length - 4} more` : ''}
                  </Text>
                )}
                {selectedShips.length !== 1 && g.ships.length > 0 && (
                  <Text style={styles.machineShips} numberOfLines={1}>
                    <Text style={styles.machineShipsLabel}>Ships: </Text>
                    {g.ships.slice(0, 3).join(', ')}
                    {g.ships.length > 3 ? ` +${g.ships.length - 3}` : ''}
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
              <Dice5 size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                {search.length > 0 ? `No machines match "${search}"` : 'No machines found'}
              </Text>
            </View>
          )}
        </View>

        {/* Load more */}
        {hasMore && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => setVisibleCount((v) => v + 30)}
            activeOpacity={0.75}
          >
            <ChevronDown size={15} color={COLORS.navyDeep} />
            <Text style={styles.loadMoreText}>
              Show more ({filtered.length - visibleCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
  shipFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    gap: SPACING.xs,
    minHeight: 42,
    ...SHADOW.sm,
  },
  shipFilterLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
  },
  shipCountBadge: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  shipCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  shipPanel: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.10)',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  shipScroll: {
    maxHeight: 260,
  },
  shipList: {
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  shipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
    gap: SPACING.sm,
  },
  shipOptionActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  shipCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shipCheckboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  shipOptionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
  },
  shipOptionTextActive: {
    color: COLORS.white,
    fontWeight: '800' as const,
  },
  shipMachineCount: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
  },
  shipMachineCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  clearBtnText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.error,
    fontWeight: '600' as const,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 95, 0.07)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  statChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  listContainer: {
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
  machineShips: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  machineShipsLabel: {
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
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
    paddingVertical: SPACING.xl,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textMuted,
    textAlign: 'center' as const,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 58, 95, 0.08)',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  loadMoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
});
