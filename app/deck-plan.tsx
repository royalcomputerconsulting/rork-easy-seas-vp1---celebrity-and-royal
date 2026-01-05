import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Grid3x3, Info } from 'lucide-react-native';
import { useDeckPlan } from '@/state/DeckPlanProvider';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { COLORS } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DeckPlanPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shipName?: string }>();
  const shipName = params.shipName as string | undefined;

  const {
    getDeckPlanForShip,
    mappings,
    getMappingBySlot,
    getOccupancyRate,
  } = useDeckPlan();

  const { getMachineById } = useSlotMachineLibrary();

  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(0);

  const deckPlan = shipName ? getDeckPlanForShip(shipName) : undefined;
  const casinoDecks = useMemo(() => {
    return deckPlan?.decks.filter(d => d.hasCasino) || [];
  }, [deckPlan]);

  const selectedDeck = casinoDecks[selectedDeckIndex];
  const selectedZone = selectedDeck?.casinoZones?.[selectedZoneIndex];

  const occupancyRate = shipName ? getOccupancyRate(shipName) : 0;
  const totalMachinesOnShip = mappings.filter(
    m => m.shipName === shipName && m.isActive
  ).length;

  const handleSlotPress = (slotId: string) => {
    if (!shipName) return;

    const mapping = getMappingBySlot(shipName, slotId);
    if (mapping) {
      const machine = getMachineById(mapping.machineId);
      if (machine) {
        router.push({ pathname: '/machine-detail/[id]' as any, params: { id: mapping.machineId } });
      }
    } else {
      console.log('[DeckPlan] Open assign modal for slot:', slotId);
    }
  };

  if (!shipName) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            title: 'Deck Plan',
            headerStyle: { backgroundColor: COLORS.navy },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.emptyContainer}>
          <MapPin size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Ship Selected</Text>
          <Text style={styles.emptyText}>
            Please select a ship to view its deck plan
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!deckPlan || casinoDecks.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            title: `${shipName} - Deck Plan`,
            headerStyle: { backgroundColor: COLORS.navy },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.emptyContainer}>
          <Info size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Deck Plan Available</Text>
          <Text style={styles.emptyText}>
            Deck plan for {shipName} is not available yet
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `${shipName} - Deck Plan`,
          headerStyle: { backgroundColor: COLORS.navy },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMachinesOnShip}</Text>
              <Text style={styles.statLabel}>Mapped Machines</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{occupancyRate.toFixed(0)}%</Text>
              <Text style={styles.statLabel}>Occupancy</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{casinoDecks.length}</Text>
              <Text style={styles.statLabel}>Casino Decks</Text>
            </View>
          </View>
        </View>

        {casinoDecks.length > 1 && (
          <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {casinoDecks.map((deck, index) => (
                <TouchableOpacity
                  key={deck.deckName}
                  style={[
                    styles.tab,
                    selectedDeckIndex === index && styles.tabActive,
                  ]}
                  onPress={() => {
                    setSelectedDeckIndex(index);
                    setSelectedZoneIndex(0);
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      selectedDeckIndex === index && styles.tabTextActive,
                    ]}
                  >
                    {deck.deckName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedDeck.casinoZones && selectedDeck.casinoZones.length > 1 && (
          <View style={styles.zoneContainer}>
            <Text style={styles.zoneLabel}>Casino Zone:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedDeck.casinoZones.map((zone, index) => (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneTab,
                    selectedZoneIndex === index && styles.zoneTabActive,
                  ]}
                  onPress={() => setSelectedZoneIndex(index)}
                >
                  <Text
                    style={[
                      styles.zoneTabText,
                      selectedZoneIndex === index && styles.zoneTabTextActive,
                    ]}
                  >
                    {zone.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedZone && (
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
              <Grid3x3 size={20} color={COLORS.textPrimary} />
              <Text style={styles.mapTitle}>{selectedZone.name}</Text>
            </View>
            {selectedZone.description && (
              <Text style={styles.mapDescription}>{selectedZone.description}</Text>
            )}

            <View style={styles.gridContainer}>
              {selectedZone.machineSlots?.map(slot => {
                const mapping = getMappingBySlot(shipName, slot.id);
                const machine = mapping
                  ? getMachineById(mapping.machineId)
                  : undefined;

                const isOccupied = !!mapping;
                const hasAPPotential =
                  machine?.apMetadata &&
                  (machine.apMetadata.persistenceType !== 'None' ||
                    machine.apMetadata.hasMustHitBy);

                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotBox,
                      isOccupied && styles.slotBoxOccupied,
                      hasAPPotential && styles.slotBoxAP,
                    ]}
                    onPress={() => handleSlotPress(slot.id)}
                  >
                    <Text style={styles.slotNumber}>{slot.slotNumber}</Text>
                    {machine && (
                      <Text style={styles.machineName} numberOfLines={2}>
                        {machine.machineName}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendBoxEmpty]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendBoxOccupied]} />
                <Text style={styles.legendText}>Assigned</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendBoxAP]} />
                <Text style={styles.legendText}>AP Machine</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navy,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.bgSecondary,
  },
  tabActive: {
    backgroundColor: COLORS.navy,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  zoneContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  zoneTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  zoneTabActive: {
    backgroundColor: COLORS.royalPurple,
    borderColor: COLORS.royalPurple,
  },
  zoneTabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.textSecondary,
  },
  zoneTabTextActive: {
    color: '#fff',
  },
  mapContainer: {
    padding: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  mapDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  slotBox: {
    width: (SCREEN_WIDTH - 56) / 4,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBoxOccupied: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  slotBoxAP: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  slotNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  machineName: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center' as const,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 6,
  },
  legendBoxEmpty: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.borderLight,
  },
  legendBoxOccupied: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  legendBoxAP: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center' as const,
  },
});
