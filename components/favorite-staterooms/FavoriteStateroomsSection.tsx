import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Filter, Pencil, Plus, Search, Ship, Star, Tag, Trash2, X } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { FavoriteStateroomsProvider, useFavoriteStaterooms } from '@/state/FavoriteStateroomsProvider';
import type { FavoriteStateroom, FavoriteStateroomDraft } from '@/types/favorite-staterooms';
interface FavoriteStateroomsSectionProps {
    shipOptions?: string[];
}
const EMPTY_DRAFT: FavoriteStateroomDraft = {
    shipName: '',
    stateroomNumber: '',
    deckNumber: '',
    category: '',
    locationNotes: '',
    nearbyAlternatives: '',
    notes: '',
};
function FavoriteStateroomsSectionInner({ shipOptions = [] }: FavoriteStateroomsSectionProps) {
    const { entries, allEntries, entriesTotal, filters, stats, isLoading, updateFilters, resetFilters, createFavoriteStateroom, updateFavoriteStateroom, deleteFavoriteStateroom, clearFavoriteStaterooms, } = useFavoriteStaterooms();
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
    const [editingEntry, setEditingEntry] = useState<FavoriteStateroom | null>(null);
    const [draft, setDraft] = useState<FavoriteStateroomDraft>(EMPTY_DRAFT);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const uniqueShips = useMemo<string[]>(() => {
        const combinedShips = [...shipOptions, ...allEntries.map((entry) => entry.shipName)];
        return Array.from(new Set(combinedShips.filter((shipName) => shipName.trim().length > 0))).sort((a, b) => a.localeCompare(b));
    }, [allEntries, shipOptions]);
    const activeFilterCount = useMemo<number>(() => {
        return filters.shipNames.length + (filters.search.trim().length > 0 ? 1 : 0);
    }, [filters.search, filters.shipNames.length]);
    const isEditing = editingEntry !== null;
    const updateDraftValue = useCallback((field: keyof FavoriteStateroomDraft, value: string) => {
        setDraft((prev) => ({
            ...prev,
            [field]: value,
        }));
    }, []);
    const resetModalState = useCallback(() => {
        setEditingEntry(null);
        setDraft(EMPTY_DRAFT);
        setIsSubmitting(false);
        setIsModalVisible(false);
    }, []);
    const openCreateModal = useCallback(() => {
        console.log('[FavoriteStateroomsSection] Opening create modal');
        setEditingEntry(null);
        setDraft(EMPTY_DRAFT);
        setIsModalVisible(true);
    }, []);
    const openEditModal = useCallback((entry: FavoriteStateroom) => {
        console.log('[FavoriteStateroomsSection] Opening edit modal for entry:', entry.id);
        setEditingEntry(entry);
        setDraft({
            shipName: entry.shipName,
            stateroomNumber: entry.stateroomNumber,
            deckNumber: entry.deckNumber ?? '',
            category: entry.category ?? '',
            locationNotes: entry.locationNotes ?? '',
            nearbyAlternatives: entry.nearbyAlternatives ?? '',
            notes: entry.notes ?? '',
        });
        setIsModalVisible(true);
    }, []);
    const handleToggleShipFilter = useCallback((shipName: string) => {
        if (filters.shipNames.includes(shipName)) {
            updateFilters({ shipNames: filters.shipNames.filter((value) => value !== shipName) });
            return;
        }
        updateFilters({ shipNames: [...filters.shipNames, shipName] });
    }, [filters.shipNames, updateFilters]);
    const handleSave = useCallback(async () => {
        console.log('[FavoriteStateroomsSection] Saving favorite stateroom...', { isEditing, editingId: editingEntry?.id });
        setIsSubmitting(true);
        try {
            if (editingEntry) {
                await updateFavoriteStateroom(editingEntry.id, draft);
            }
            else {
                await createFavoriteStateroom(draft);
            }
            resetModalState();
        }
        catch (error) {
            console.error('[FavoriteStateroomsSection] Save failed:', error);
            const message = error instanceof Error ? error.message : 'Please try again.';
            Alert.alert('Unable to save favorite', message);
            setIsSubmitting(false);
        }
    }, [createFavoriteStateroom, draft, editingEntry, isEditing, resetModalState, updateFavoriteStateroom]);
    const handleDelete = useCallback((entry: FavoriteStateroom) => {
        Alert.alert('Delete Favorite Stateroom', `Remove stateroom ${entry.stateroomNumber} on ${entry.shipName} from your favorites?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    console.log('[FavoriteStateroomsSection] Deleting favorite stateroom:', entry.id);
                    void deleteFavoriteStateroom(entry.id).catch((error) => {
                        console.error('[FavoriteStateroomsSection] Delete failed:', error);
                        const message = error instanceof Error ? error.message : 'Please try again.';
                        Alert.alert('Unable to delete favorite', message);
                    });
                },
            },
        ]);
    }, [deleteFavoriteStateroom]);
    const handleClearAll = useCallback(() => {
        if (entriesTotal === 0) {
            return;
        }
        Alert.alert('Clear Favorite Staterooms', 'Delete every favorite stateroom in this list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All',
                style: 'destructive',
                onPress: () => {
                    console.log('[FavoriteStateroomsSection] Clearing all favorite staterooms');
                    void clearFavoriteStaterooms().catch((error) => {
                        console.error('[FavoriteStateroomsSection] Clear all failed:', error);
                        const message = error instanceof Error ? error.message : 'Please try again.';
                        Alert.alert('Unable to clear favorites', message);
                    });
                },
            },
        ]);
    }, [clearFavoriteStaterooms, entriesTotal]);
    const renderInput = useCallback((label: string, field: keyof FavoriteStateroomDraft, placeholder: string, multiline?: boolean) => {
        const isLongField = multiline === true;
        return (<View style={styles.fieldGroup} key={field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput style={[styles.input, isLongField && styles.textArea]} value={draft[field] ?? ''} onChangeText={(value) => updateDraftValue(field, value)} placeholder={placeholder} placeholderTextColor={COLORS.textTertiary} multiline={isLongField} textAlignVertical={isLongField ? 'top' : 'center'} testID={`favoriteStaterooms.input.${field}`}/>
      </View>);
    }, [draft, updateDraftValue]);
    return (<View style={styles.sectionContainer} testID="favoriteStaterooms.section">
      <LinearGradient colors={['#0F3D63', '#126A82', '#1C4F8C']} style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Star size={18} color={COLORS.white} fill={COLORS.white}/>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Favorite Staterooms</Text>
            <Text style={styles.headerSubtitle}>Save the ship and room numbers you want to book again later.</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryAction} onPress={openCreateModal} activeOpacity={0.85} testID="favoriteStaterooms.addButton">
          <Plus size={16} color={COLORS.navyDeep}/>
          <Text style={styles.primaryActionText}>Add Favorite</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryAction, entriesTotal === 0 && styles.secondaryActionDisabled]} onPress={handleClearAll} disabled={entriesTotal === 0} activeOpacity={0.85} testID="favoriteStaterooms.clearButton">
          <Trash2 size={16} color={entriesTotal === 0 ? COLORS.textTertiary : COLORS.error}/>
          <Text style={[styles.secondaryActionText, entriesTotal === 0 && styles.secondaryActionTextDisabled]}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalCount}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.shipCount}</Text>
          <Text style={styles.statLabel}>Ships</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.deckCount}</Text>
          <Text style={styles.statLabel}>Decks</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={COLORS.textSecondary}/>
          <TextInput style={styles.searchInput} value={filters.search} onChangeText={(value) => updateFilters({ search: value })} placeholder="Search ship, room, notes, nearby rooms..." placeholderTextColor={COLORS.textTertiary} testID="favoriteStaterooms.searchInput"/>
          
        </View>

        <TouchableOpacity style={[styles.filterButton, showFilters && styles.filterButtonActive]} onPress={() => setShowFilters((prev) => !prev)} activeOpacity={0.85} testID="favoriteStaterooms.filterButton">
          <Filter size={16} color={showFilters ? COLORS.white : COLORS.navyDeep}/>
          <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Text>
        </TouchableOpacity>
      </View>

      

      {isLoading ? (<View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={COLORS.navyDeep}/>
          <Text style={styles.loadingText}>Loading your favorite staterooms...</Text>
        </View>) : entries.length === 0 ? (<View style={styles.emptyCard} testID="favoriteStaterooms.emptyState">
          <View style={styles.emptyIconWrap}>
            <Ship size={24} color={COLORS.navyDeep}/>
          </View>
          <Text style={styles.emptyTitle}>No favorite staterooms yet</Text>
          <Text style={styles.emptyText}>
            Save the exact rooms you love, plus nearby alternatives and notes about why they work.
          </Text>
          <TouchableOpacity style={styles.emptyAction} onPress={openCreateModal} activeOpacity={0.85} testID="favoriteStaterooms.emptyAddButton">
            <Plus size={16} color={COLORS.white}/>
            <Text style={styles.emptyActionText}>Add your first favorite</Text>
          </TouchableOpacity>
        </View>) : (<View style={styles.cardsList}>
          {entries.map((entry) => (<View key={entry.id} style={styles.entryCard} testID={`favoriteStaterooms.card.${entry.id}`}>
              <View style={styles.entryHeader}>
                <View style={styles.entryHeaderLeft}>
                  <View style={styles.entryIconWrap}>
                    <Ship size={16} color={COLORS.navyDeep}/>
                  </View>
                  <View style={styles.entryHeaderText}>
                    <Text style={styles.entryShipName}>{entry.shipName}</Text>
                    <View style={styles.roomBadge}>
                      <Star size={12} color={COLORS.goldDark} fill={COLORS.goldDark}/>
                      <Text style={styles.roomBadgeText}>Stateroom {entry.stateroomNumber}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.entryActions}>
                  <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(entry)} activeOpacity={0.85} testID={`favoriteStaterooms.editButton.${entry.id}`}>
                    <Pencil size={16} color={COLORS.navyDeep}/>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleDelete(entry)} activeOpacity={0.85} testID={`favoriteStaterooms.deleteButton.${entry.id}`}>
                    <Trash2 size={16} color={COLORS.error}/>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.metaRow}>
                
                
              </View>

              

              

              
            </View>))}
        </View>)}

      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={resetModalState}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Favorite Stateroom' : 'Add Favorite Stateroom'}</Text>
                <Text style={styles.modalSubtitle}>Save the exact room plus nearby options worth asking for.</Text>
              </View>
              <TouchableOpacity onPress={resetModalState} style={styles.closeButton} testID="favoriteStaterooms.closeModalButton">
                <X size={18} color={COLORS.navyDeep}/>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              

              {renderInput('Ship', 'shipName', 'Icon of the Seas')}
              {renderInput('Stateroom Number', 'stateroomNumber', '12644')}
              {renderInput('Deck', 'deckNumber', 'Deck 12')}
              {renderInput('Category', 'category', 'Balcony, Junior Suite, Interior...')}
              {renderInput('Location Notes', 'locationNotes', 'Mid-ship, quiet hall, near elevators but not too close', true)}
              {renderInput('Nearby Alternatives', 'nearbyAlternatives', '12642, 12646, anything nearby on this deck', true)}
              {renderInput('Booking Notes', 'notes', 'Best for motion, quick walk to casino, avoid noise, etc.', true)}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={resetModalState} activeOpacity={0.85} testID="favoriteStaterooms.cancelButton">
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryButton, isSubmitting && styles.modalPrimaryButtonDisabled]} onPress={() => {
            void handleSave();
        }} disabled={isSubmitting} activeOpacity={0.85} testID="favoriteStaterooms.saveButton">
                {isSubmitting ? (<ActivityIndicator size="small" color={COLORS.white}/>) : (<Text style={styles.modalPrimaryButtonText}>{isEditing ? 'Save Changes' : 'Save Favorite'}</Text>)}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>);
}
export const FavoriteStateroomsSection = React.memo(function FavoriteStateroomsSection(props: FavoriteStateroomsSectionProps) {
    return (<FavoriteStateroomsProvider>
      <FavoriteStateroomsSectionInner {...props}/>
    </FavoriteStateroomsProvider>);
});
const styles = StyleSheet.create({
    sectionContainer: {
        marginTop: SPACING.xl,
        marginBottom: SPACING.md,
    },
    headerCard: {
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        ...SHADOW.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    headerIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextWrap: {
        flex: 1,
    },
    headerTitle: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.fontSizeXL,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    headerSubtitle: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.84)',
        fontSize: TYPOGRAPHY.fontSizeSM,
        lineHeight: 20,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    primaryAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: '#F5EFD8',
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(184, 134, 11, 0.24)',
    },
    primaryActionText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeMD,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    secondaryAction: {
        width: 120,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    secondaryActionDisabled: {
        opacity: 0.6,
    },
    secondaryActionText: {
        color: COLORS.error,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    secondaryActionTextDisabled: {
        color: COLORS.textTertiary,
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    statValue: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeXL,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    statLabel: {
        marginTop: 4,
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeXS,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    searchRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
        minHeight: 52,
    },
    searchInput: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: TYPOGRAPHY.fontSizeMD,
        paddingVertical: 12,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterButtonActive: {
        backgroundColor: COLORS.navyDeep,
        borderColor: COLORS.navyDeep,
    },
    filterButtonText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    filterButtonTextActive: {
        color: COLORS.white,
    },
    filtersPanel: {
        marginTop: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    filtersHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    filtersTitle: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    resetFiltersText: {
        color: COLORS.info,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    shipChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    shipChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: '#F4F7FB',
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    shipChipActive: {
        backgroundColor: COLORS.navyDeep,
        borderColor: COLORS.navyDeep,
    },
    shipChipText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    shipChipTextActive: {
        color: COLORS.white,
    },
    loadingCard: {
        marginTop: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.xl,
        paddingHorizontal: SPACING.lg,
        alignItems: 'center',
        gap: SPACING.sm,
    },
    loadingText: {
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeSM,
    },
    emptyCard: {
        marginTop: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: BORDER_RADIUS.xl,
        paddingVertical: SPACING.xxl,
        paddingHorizontal: SPACING.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    emptyIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E7F0FA',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    emptyTitle: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeLG,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    emptyText: {
        marginTop: SPACING.sm,
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeSM,
        lineHeight: 20,
        textAlign: 'center',
        maxWidth: 320,
    },
    emptyAction: {
        marginTop: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.navyDeep,
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 12,
    },
    emptyActionText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    cardsList: {
        marginTop: SPACING.md,
        gap: SPACING.md,
    },
    entryCard: {
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
        ...SHADOW.sm,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACING.md,
    },
    entryHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
        gap: SPACING.md,
    },
    entryIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EAF2FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    entryHeaderText: {
        flex: 1,
        gap: 6,
    },
    entryShipName: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeLG,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    roomBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF6DD',
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
    },
    roomBadgeText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    entryActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F8FC',
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        backgroundColor: '#ECF5FB',
    },
    metaPillText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    detailBlock: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(30,58,95,0.08)',
    },
    detailLabel: {
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeXS,
        fontWeight: TYPOGRAPHY.fontWeightBold,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    detailText: {
        marginTop: 6,
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        lineHeight: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 18, 34, 0.55)',
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    modalCard: {
        maxHeight: '92%',
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.xxl,
        paddingTop: SPACING.xl,
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: SPACING.md,
    },
    modalTitle: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeXL,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
    modalSubtitle: {
        marginTop: 4,
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeSM,
        lineHeight: 20,
        maxWidth: 280,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F8FC',
    },
    modalScrollContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    quickPickSection: {
        marginBottom: SPACING.md,
    },
    quickPickLabel: {
        color: COLORS.textSecondary,
        fontSize: TYPOGRAPHY.fontSizeXS,
        fontWeight: TYPOGRAPHY.fontWeightBold,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: SPACING.sm,
    },
    quickPickRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    quickPickChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 9,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: '#F4F7FB',
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.08)',
    },
    quickPickChipActive: {
        backgroundColor: '#E5F1FB',
        borderColor: COLORS.info,
    },
    quickPickChipText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    quickPickChipTextActive: {
        color: COLORS.info,
    },
    fieldGroup: {
        marginBottom: SPACING.md,
    },
    fieldLabel: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeSM,
        fontWeight: TYPOGRAPHY.fontWeightBold,
        marginBottom: SPACING.sm,
    },
    input: {
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: 'rgba(30,58,95,0.12)',
        paddingHorizontal: SPACING.md,
        paddingVertical: 14,
        fontSize: TYPOGRAPHY.fontSizeMD,
        color: COLORS.navyDeep,
        backgroundColor: '#FBFCFE',
    },
    textArea: {
        minHeight: 92,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    modalSecondaryButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 14,
        backgroundColor: '#F4F7FB',
    },
    modalSecondaryButtonText: {
        color: COLORS.navyDeep,
        fontSize: TYPOGRAPHY.fontSizeMD,
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    },
    modalPrimaryButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 14,
        backgroundColor: COLORS.navyDeep,
    },
    modalPrimaryButtonDisabled: {
        opacity: 0.7,
    },
    modalPrimaryButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.fontSizeMD,
        fontWeight: TYPOGRAPHY.fontWeightBold,
    },
});
