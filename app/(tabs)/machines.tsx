import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, Search, X, Star, ChevronDown, ChevronUp, Plus, Download, Crown, RefreshCcw, ExternalLink } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions, type CasinoSession } from '@/state/CasinoSessionProvider';
import { AtlasCard } from '@/components/AtlasCard';
import { useEntitlement } from '@/state/EntitlementProvider';
import { exportFavoriteMachinesToDocx, exportAllMachinesIncrementallyToDocx } from '@/lib/exportMachinesToDocx';
import { MachineSessionStats } from '@/components/MachineSessionStats';
import { MachineSessionsList } from '@/components/MachineSessionsList';
import { EditMachineSessionModal } from '@/components/EditMachineSessionModal';
import QuickMachineSessionModal from '@/components/QuickMachineSessionModal';
import type { MachineEncyclopediaEntry, SlotManufacturer } from '@/types/models';

type FilterOption = 'all' | 'favorites' | 'manufacturer' | 'ship';

export default function AtlasScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();

  const FREE_MACHINE_PREVIEW_LIMIT = 8;

  const listRef = useRef<FlatList<MachineEncyclopediaEntry> | null>(null);
  const scrollOffsetRef = useRef<number>(0);

  const scrollY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const [listLayoutHeight, setListLayoutHeight] = useState<number>(1);
  const [listContentHeight, setListContentHeight] = useState<number>(1);

  const [alphabetLayoutHeight, setAlphabetLayoutHeight] = useState<number>(1);
  const [activeAlpha, setActiveAlpha] = useState<string | null>(null);
  const activeAlphaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActiveAlphaSoon = useCallback(() => {
    if (activeAlphaTimeoutRef.current) {
      clearTimeout(activeAlphaTimeoutRef.current);
    }
    activeAlphaTimeoutRef.current = setTimeout(() => {
      setActiveAlpha(null);
    }, 650);
  }, []);

  useEffect(() => {
    return () => {
      if (activeAlphaTimeoutRef.current) {
        clearTimeout(activeAlphaTimeoutRef.current);
      }
    };
  }, []);

  const alphabet = useMemo(() => {
    const letters: string[] = [];
    for (let i = 65; i <= 90; i += 1) {
      letters.push(String.fromCharCode(i));
    }
    return letters;
  }, []);

  const scrollToIndexSafe = useCallback((index: number) => {
    try {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    } catch (e) {
      console.error('[Atlas] scrollToIndex failed', e);
      try {
        listRef.current?.scrollToOffset({ offset: Math.max(0, index * 120), animated: true });
      } catch (e2) {
        console.error('[Atlas] scrollToOffset fallback failed', e2);
      }
    }
  }, []);

  const maxScroll = useMemo(() => {
    return Math.max(0, listContentHeight - listLayoutHeight);
  }, [listContentHeight, listLayoutHeight]);

  const trackHeight = useMemo(() => {
    return Math.max(1, listLayoutHeight - 12);
  }, [listLayoutHeight]);

  const thumbHeight = useMemo(() => {
    const ratio = listLayoutHeight > 0 ? listLayoutHeight / listContentHeight : 0;
    const raw = ratio * trackHeight;
    return Math.max(28, Math.min(trackHeight, isFinite(raw) ? raw : 28));
  }, [listContentHeight, listLayoutHeight, trackHeight]);

  const thumbTravel = useMemo(() => {
    return Math.max(1, trackHeight - thumbHeight);
  }, [thumbHeight, trackHeight]);

  const thumbTranslateY = useMemo(() => {
    const inputMax = Math.max(1, maxScroll);
    return scrollY.interpolate({
      inputRange: [0, inputMax],
      outputRange: [0, thumbTravel],
      extrapolate: 'clamp',
    });
  }, [maxScroll, scrollY, thumbTravel]);

  const handlePanState = useRef<{
    startThumbY: number;
  }>({ startThumbY: 0 }).current;

  const scrollThumbPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const ratio = maxScroll > 0 ? scrollOffsetRef.current / maxScroll : 0;
        handlePanState.startThumbY = Math.max(0, Math.min(thumbTravel, ratio * thumbTravel));
      },
      onPanResponderMove: (_evt, gestureState) => {
        const nextThumbY = Math.max(0, Math.min(thumbTravel, handlePanState.startThumbY + gestureState.dy));
        const ratio = thumbTravel > 0 ? nextThumbY / thumbTravel : 0;
        const nextOffset = ratio * maxScroll;
        listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    });
  }, [handlePanState, maxScroll, thumbTravel]);


  const {
    myAtlasMachines,
    favoriteMachines,
    toggleFavorite,
    isLoading,
    isLoadingIndex,
    reload,
  } = useSlotMachineLibrary();

  const { 
    sessions,
    updateSession,
    removeSession,
  } = useCasinoSessions();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<SlotManufacturer | ''>('');
  const [selectedShip, setSelectedShip] = useState('');
  const [showSessionsSection, setShowSessionsSection] = useState(false);
  const [editingSession, setEditingSession] = useState<CasinoSession | null>(null);
  const [showQuickSessionModal, setShowQuickSessionModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);


  const filteredMachines = useMemo(() => {
    let filtered = [...myAtlasMachines];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        m =>
          m.machineName.toLowerCase().includes(query) ||
          m.manufacturer.toLowerCase().includes(query) ||
          m.gameSeries?.toLowerCase().includes(query)
      );
    }

    if (activeFilter === 'favorites') {
      filtered = filtered.filter(m => m.isFavorite);
    }

    if (selectedManufacturer) {
      filtered = filtered.filter(m => m.manufacturer === selectedManufacturer);
    }

    if (selectedShip) {
      filtered = filtered.filter(m => 
        m.shipAssignments?.some(s => s.shipName === selectedShip)
      );
    }

    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.machineName.localeCompare(b.machineName);
    });
  }, [myAtlasMachines, searchQuery, activeFilter, selectedManufacturer, selectedShip]);

  const letterToIndex = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < filteredMachines.length; i += 1) {
      const name = filteredMachines[i]?.machineName ?? '';
      const first = name.trim().charAt(0).toUpperCase();
      if (first && /^[A-Z]$/.test(first) && map[first] === undefined) {
        map[first] = i;
      }
    }
    return map;
  }, [filteredMachines]);

  const scrollToLetter = useCallback(
    (letter: string) => {
      const upper = letter.toUpperCase();
      const direct = letterToIndex[upper];
      if (direct !== undefined) {
        setActiveAlpha(upper);
        scrollToIndexSafe(direct);
        clearActiveAlphaSoon();
        return;
      }

      const startIdx = alphabet.indexOf(upper);
      if (startIdx >= 0) {
        for (let i = startIdx + 1; i < alphabet.length; i += 1) {
          const next = letterToIndex[alphabet[i]];
          if (next !== undefined) {
            setActiveAlpha(alphabet[i]);
            scrollToIndexSafe(next);
            clearActiveAlphaSoon();
            return;
          }
        }
      }

      if (filteredMachines.length > 0) {
        setActiveAlpha(alphabet[alphabet.length - 1] ?? null);
        scrollToIndexSafe(filteredMachines.length - 1);
        clearActiveAlphaSoon();
      }
    },
    [alphabet, clearActiveAlphaSoon, filteredMachines.length, letterToIndex, scrollToIndexSafe]
  );

  const alphaPanResponder = useMemo(() => {
    const getLetterAtY = (y: number) => {
      const usableH = Math.max(1, alphabetLayoutHeight);
      const idx = Math.floor((y / usableH) * alphabet.length);
      const clamped = Math.max(0, Math.min(alphabet.length - 1, idx));
      return alphabet[clamped];
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const y = evt.nativeEvent.locationY ?? 0;
        const letter = getLetterAtY(y);
        if (letter) scrollToLetter(letter);
      },
      onPanResponderMove: (evt) => {
        const y = evt.nativeEvent.locationY ?? 0;
        const letter = getLetterAtY(y);
        if (letter) scrollToLetter(letter);
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {
        clearActiveAlphaSoon();
      },
      onPanResponderTerminate: () => {
        clearActiveAlphaSoon();
      },
    });
  }, [alphabet, alphabetLayoutHeight, clearActiveAlphaSoon, scrollToLetter]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilter('all');
    setSelectedManufacturer('');
    setSelectedShip('');
  }, []);

  const handleMachinePress = useCallback((id: string, locked: boolean) => {
    if (locked) {
      console.log('[Atlas] Locked machine tapped - opening paywall', { id });
      router.push('/paywall' as any);
      return;
    }
    router.push(`/machine-detail/${id}` as any);
  }, [router]);

  const handleToggleFavorite = useCallback((id: string) => {
    toggleFavorite(id);
  }, [toggleFavorite]);

  const handleExportFavorites = useCallback(async () => {
    if (favoriteMachines.length === 0) {
      console.warn('[Atlas] No favorite machines to export');
      return;
    }

    try {
      setIsExporting(true);
      console.log(`[Atlas] Exporting ${favoriteMachines.length} favorite machines to DOCX...`);
      await exportFavoriteMachinesToDocx(favoriteMachines);
      console.log('[Atlas] Export successful');
    } catch (error) {
      console.error('[Atlas] Export failed:', error);
      setUiError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [favoriteMachines]);

  const handleExportAll = useCallback(async () => {
    if (myAtlasMachines.length === 0) {
      console.warn('[Atlas] No machines to export');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: myAtlasMachines.length });
      console.log(`[Atlas] Exporting ALL ${myAtlasMachines.length} machines with full details to DOCX...`);
      await exportAllMachinesIncrementallyToDocx(myAtlasMachines, (current, total) => {
        setExportProgress({ current, total });
      });
      console.log('[Atlas] Export successful');
    } catch (error) {
      console.error('[Atlas] Export failed:', error);
      setUiError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [myAtlasMachines]);

  const hasActiveFilters = searchQuery || activeFilter !== 'all';

  const [uiError, setUiError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (uiError) {
        console.log('[Atlas] Clearing UI error on focus');
        setUiError(null);
      }
    }, [uiError])
  );

  const renderMachineItem = useCallback(
    ({ item, index }: { item: (typeof filteredMachines)[number]; index: number }) => {
      const locked = !entitlement.isPro && index >= FREE_MACHINE_PREVIEW_LIMIT;

      return (
        <View style={[styles.gridItem, index % 2 === 1 && styles.gridItemRight]}>
          <AtlasCard
            machine={item}
            onPress={() => handleMachinePress(item.id, locked)}
            isFavorite={item.isFavorite}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            compact={true}
            locked={locked}
          />
        </View>
      );
    },
    [FREE_MACHINE_PREVIEW_LIMIT, entitlement.isPro, handleMachinePress, handleToggleFavorite]
  );

  const listHeader = useMemo(() => {
    return (
      <>
        <View style={styles.logoHeaderContainer}>
          <Image
            source={{ uri: IMAGES.logo }}
            style={styles.logoHeaderImage}
            resizeMode="contain"
          />
          <View style={styles.logoHeaderTextContainer}>
            <Text style={styles.logoHeaderTitle}>Easy Seas™</Text>
            <Text style={styles.logoHeaderSubtitle}>Manage your Nautical Lifestyle™</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Slot Machine Advantage Players Handbook</Text>
          <Text style={styles.subtitle}>
            {filteredMachines.length} machine{filteredMachines.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {!entitlement.isPro ? (
          <View style={styles.proBanner} testID="machines.proBanner">
            <View style={styles.proBannerLeft}>
              <View style={styles.proBadge}>
                <Crown size={14} color={COLORS.white} />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
              <Text style={styles.proBannerText}>
                Preview: {FREE_MACHINE_PREVIEW_LIMIT} machines. Locked items show a lock.
              </Text>
            </View>

            <View style={styles.proBannerActions}>
              <TouchableOpacity
                style={styles.proActionPrimary}
                onPress={() => router.push('/paywall' as any)}
                activeOpacity={0.85}
                testID="machines.paywall.open"
              >
                <Text style={styles.proActionPrimaryText}>Unlock</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.proActionIcon}
                onPress={() => entitlement.restore()}
                activeOpacity={0.85}
                testID="machines.paywall.restore"
              >
                <RefreshCcw size={16} color={COLORS.navyDeep} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.proActionIcon}
                onPress={() => entitlement.openManageSubscription()}
                activeOpacity={0.85}
                testID="machines.paywall.manage"
              >
                <ExternalLink size={16} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.proUnlockedBanner} testID="machines.proUnlocked">
            <Crown size={16} color={COLORS.money} />
            <Text style={styles.proUnlockedText}>Pro unlocked</Text>
          </View>
        )}

        {uiError ? (
          <View style={styles.errorBanner} testID="machines.errorBanner">
            <Text style={styles.errorTitle}>Slots couldn’t load</Text>
            <Text style={styles.errorBody}>{uiError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                console.log('[Atlas] Retry pressed');
                setUiError(null);
                reload().catch((e) => {
                  console.error('[Atlas] Reload failed', e);
                  setUiError(e instanceof Error ? e.message : 'Unknown error');
                });
              }}
              activeOpacity={0.85}
              testID="machines.errorRetry"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.initialLoading} testID="machines.initialLoading">
            <ActivityIndicator size="small" color={COLORS.navyDeep} />
            <Text style={styles.initialLoadingText}>Loading your atlas…</Text>
          </View>
        ) : null}

        <View style={styles.sessionsSection}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.sectionToggle}
              onPress={() => setShowSessionsSection(!showSessionsSection)}
              activeOpacity={0.7}
              testID="machines.sessions.toggle"
            >
              <Text style={styles.sectionToggleText}>Slot Play Sessions</Text>
              {showSessionsSection ? (
                <ChevronUp size={20} color={COLORS.navyDeep} />
              ) : (
                <ChevronDown size={20} color={COLORS.navyDeep} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addSessionButton}
              onPress={() => setShowQuickSessionModal(true)}
              activeOpacity={0.7}
              testID="machines.sessions.add"
            >
              <Plus size={20} color={COLORS.white} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {showSessionsSection && (
            <View style={styles.sessionsContent}>
              <MachineSessionStats sessions={sessions} totalMachines={myAtlasMachines.length} />
              <MachineSessionsList sessions={sessions} onEditSession={(session) => setEditingSession(session)} />
            </View>
          )}
        </View>

        {isLoadingIndex && (
          <View style={styles.loadingBanner} testID="machines.loadingIndex">
            <ActivityIndicator size="small" color={COLORS.navyDeep} />
            <Text style={styles.loadingText}>Building machine index...</Text>
          </View>
        )}

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search machines..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.textMuted}
              testID="machines.search.input"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} testID="machines.search.clear">
                <X size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.filtersContainer}>
          <FlatList
            data={[
              { key: 'all' as const },
              { key: 'favorites' as const },
              ...(hasActiveFilters ? [{ key: 'clear' as const }] : []),
            ]}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => {
              if (item.key === 'all') {
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
                    onPress={() => {
                      setActiveFilter('all');
                      setSelectedManufacturer('');
                      setSelectedShip('');
                    }}
                    activeOpacity={0.7}
                    testID="machines.filter.all"
                  >
                    <Database size={14} color={activeFilter === 'all' ? COLORS.white : COLORS.navyDeep} />
                    <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>All</Text>
                  </TouchableOpacity>
                );
              }

              if (item.key === 'favorites') {
                return (
                  <View style={styles.favoritesChipContainer}>
                    <TouchableOpacity
                      style={[styles.filterChip, activeFilter === 'favorites' && styles.filterChipActive]}
                      onPress={() => {
                        setActiveFilter('favorites');
                        setSelectedManufacturer('');
                        setSelectedShip('');
                      }}
                      activeOpacity={0.7}
                      testID="machines.filter.favorites"
                    >
                      <Star
                        size={14}
                        color={activeFilter === 'favorites' ? COLORS.white : COLORS.goldDark}
                        fill={activeFilter === 'favorites' ? COLORS.white : 'none'}
                      />
                      <Text style={[styles.filterChipText, activeFilter === 'favorites' && styles.filterChipTextActive]}>
                        Favorites ({favoriteMachines.length})
                      </Text>
                    </TouchableOpacity>
                    {favoriteMachines.length > 0 && (
                      <TouchableOpacity
                        style={[styles.exportFavoritesButton, isExporting && styles.exportButtonDisabled]}
                        onPress={handleExportFavorites}
                        activeOpacity={0.7}
                        disabled={isExporting}
                        testID="machines.exportFavorites"
                      >
                        <Star size={14} color={COLORS.white} fill={COLORS.white} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.exportAllButton, isExporting && styles.exportButtonDisabled]}
                      onPress={handleExportAll}
                      activeOpacity={0.7}
                      disabled={isExporting}
                      testID="machines.exportAll"
                    >
                      {exportProgress ? (
                        <Text style={styles.exportProgressText}>
                          {exportProgress.current}/{exportProgress.total}
                        </Text>
                      ) : (
                        <Download size={14} color={COLORS.white} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }

              if (item.key === 'clear') {
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, styles.clearFilterChip]}
                    onPress={handleClearFilters}
                    activeOpacity={0.7}
                    testID="machines.filter.clear"
                  >
                    <X size={14} color={COLORS.white} />
                    <Text style={[styles.filterChipText, styles.filterChipTextActive]}>Clear</Text>
                  </TouchableOpacity>
                );
              }

              return null;
            }}
          />
        </View>
      </>
    );
  }, [
    FREE_MACHINE_PREVIEW_LIMIT,
    activeFilter,
    entitlement,
    favoriteMachines.length,
    filteredMachines.length,
    handleClearFilters,
    handleExportFavorites,
    handleExportAll,
    hasActiveFilters,
    isExporting,
    exportProgress,
    isLoading,
    isLoadingIndex,
    myAtlasMachines.length,
    reload,
    router,
    searchQuery,
    sessions,
    showSessionsSection,
    uiError,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
          colors={['#1E3A8A', '#60A5FA', '#E8F4FC']}
          locations={[0, 0.5, 1]}
          style={styles.gradientContainer}
        >
        <SafeAreaView style={styles.container} edges={['top']}>
        <View
          style={styles.listShell}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && isFinite(h)) {
              setListLayoutHeight(h);
            }
          }}
          testID="machines.list.shell"
        >
          <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          data={isLoading ? [] : filteredMachines}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            try {
              return renderMachineItem({ item, index } as any);
            } catch (e) {
              console.error('[Atlas] renderItem crashed', e);
              if (!uiError) {
                setUiError(e instanceof Error ? e.message : 'Unknown error');
              }
              return null;
            }
          }}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_w, h) => {
            if (h && isFinite(h)) setListContentHeight(h);
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: (e: any) => {
                const y = e?.nativeEvent?.contentOffset?.y;
                scrollOffsetRef.current = typeof y === 'number' && isFinite(y) ? y : 0;
              },
            }
          )}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            console.log('[Atlas] onScrollToIndexFailed', info);
            const approxOffset = Math.max(0, info.averageItemLength * info.index);
            listRef.current?.scrollToOffset({ offset: approxOffset, animated: true });
            setTimeout(() => {
              try {
                listRef.current?.scrollToIndex({ index: info.index, animated: true });
              } catch (e) {
                console.error('[Atlas] scrollToIndex retry failed', e);
              }
            }, 50);
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          testID="machines.list"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Database size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {hasActiveFilters ? 'No machines match your filters' : 'No machines in your atlas'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters} testID="machines.empty.clear">
                  <Text style={styles.clearButtonText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

          {filteredMachines.length > 24 && (
            <View style={styles.rightRail} pointerEvents="box-none" testID="machines.rightRail">
              <View style={styles.scrollTrack} pointerEvents="box-none" testID="machines.scrollTrack">
                <View style={styles.scrollTrackBg} pointerEvents="none" />
                <Animated.View
                  style={[styles.scrollThumb, { height: thumbHeight, transform: [{ translateY: thumbTranslateY }] }]}
                  {...scrollThumbPanResponder.panHandlers}
                  testID="machines.scrollThumb"
                />
              </View>

              <View
                style={styles.alphabetRail}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h && isFinite(h)) setAlphabetLayoutHeight(h);
                }}
                {...alphaPanResponder.panHandlers}
                testID="machines.alphabetRail"
              >
                {alphabet.map((letter) => {
                  const isAvailable = letterToIndex[letter] !== undefined;
                  const isActive = activeAlpha === letter;
                  return (
                    <Text
                      key={letter}
                      style={[
                        styles.alphabetLetter,
                        !isAvailable && styles.alphabetLetterDisabled,
                        isActive && styles.alphabetLetterActive,
                      ]}
                      suppressHighlighting
                    >
                      {letter}
                    </Text>
                  );
                })}
              </View>

              {activeAlpha ? (
                <View style={styles.alphaBubble} pointerEvents="none" testID="machines.alphaBubble">
                  <Text style={styles.alphaBubbleText}>{activeAlpha}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </SafeAreaView>

      </LinearGradient>

      <EditMachineSessionModal
        visible={editingSession !== null}
        session={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={updateSession}
        onDelete={removeSession}
      />

      <QuickMachineSessionModal visible={showQuickSessionModal} onClose={() => setShowQuickSessionModal(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  listShell: {
    flex: 1,
  },

  rightRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 8,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollTrack: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: 0,
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollTrackBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 31, 68, 0.08)',
  },

  scrollThumb: {
    width: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 31, 68, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },

  alphabetRail: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: 14,
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },

  alphabetLetter: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(10, 31, 68, 0.55)',
    lineHeight: 12,
  },

  alphabetLetterDisabled: {
    color: 'rgba(10, 31, 68, 0.22)',
  },

  alphabetLetterActive: {
    color: COLORS.navyDeep,
  },

  alphaBubble: {
    position: 'absolute',
    right: 44,
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },

  alphaBubbleText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900' as const,
  },

  sessionsSection: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionToggle: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addSessionButton: {
    backgroundColor: COLORS.money,
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
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionToggleText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  sessionsContent: {
    marginBottom: 16,
  },
  logoHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: 20,
  },
  logoHeaderImage: {
    width: 160,
    height: 160,
  },
  logoHeaderTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  logoHeaderTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  logoHeaderSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: COLORS.white,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: 20,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textDarkGrey,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.navyDeep,
  },
  filtersContainer: {
    backgroundColor: 'transparent',
    paddingBottom: 12,
    zIndex: 10,
  },
  filtersRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  clearFilterChip: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 140 : 110,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: 16,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  initialLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  initialLoadingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#FFF3F2',
    borderWidth: 1,
    borderColor: '#FFD4D0',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    lineHeight: 18,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  favoritesChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportFavoritesButton: {
    backgroundColor: COLORS.goldDark,
    borderRadius: 20,
    width: 32,
    height: 32,
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
        elevation: 2,
      },
    }),
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  gridRow: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  gridItemRight: {
    marginLeft: 0,
  },
  exportAllButton: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: 20,
    width: 32,
    height: 32,
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
        elevation: 2,
      },
    }),
  },
  exportProgressText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: COLORS.white,
  },

  proBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  proBannerLeft: {
    flex: 1,
    gap: 8,
  },
  proBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  proBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 0.6,
  },
  proBannerText: {
    color: COLORS.textDarkGrey,
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
  },
  proBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proActionPrimary: {
    backgroundColor: COLORS.money,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  proActionPrimaryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },
  proActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 31, 68, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10, 31, 68, 0.10)',
  },

  proUnlockedBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proUnlockedText: {
    color: COLORS.navyDeep,
    fontSize: 13,
    fontWeight: '800' as const,
  },
});
