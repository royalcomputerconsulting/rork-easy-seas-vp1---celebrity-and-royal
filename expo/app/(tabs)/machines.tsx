import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Database, Search, X, Star, ChevronDown, ChevronUp, Plus, Download } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions, type CasinoSession } from '@/state/CasinoSessionProvider';
import { AtlasCard } from '@/components/AtlasCard';
import { useEntitlement } from '@/state/EntitlementProvider';
import { useAuth } from '@/state/AuthProvider';
import { MachineSessionStats } from '@/components/MachineSessionStats';
import { MachineSessionsList } from '@/components/MachineSessionsList';
import { EditMachineSessionModal } from '@/components/EditMachineSessionModal';
import QuickMachineSessionModal from '@/components/QuickMachineSessionModal';
import { PlayingHoursCard } from '@/components/ui/PlayingHoursCard';
import { CasinoOpenHoursCard, type CasinoOpenHoursData } from '@/components/ui/CasinoOpenHoursCard';
import { CasinoSessionTracker } from '@/components/CasinoSessionTracker';
import { AddSessionModal } from '@/components/AddSessionModal';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import type { PlayingHours } from '@/state/UserProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useGamification } from '@/state/GamificationProvider';
import type { MachineType, Denomination } from '@/state/CasinoSessionProvider';
import type { MachineEncyclopediaEntry, SlotManufacturer, BookedCruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';

type FilterOption = 'all' | 'favorites' | 'manufacturer' | 'ship';

export default function AtlasScreen() {
  const router = useRouter();
  const _entitlement = useEntitlement();
  useAuth();

  const { currentUser, updateUser, ensureOwner } = useUser();
  const { bookedCruises } = useCoreData();
  const [isSavingPlayingHours, setIsSavingPlayingHours] = useState(false);



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
    addSession,
    updateSession,
    removeSession,
    getSessionsForDate,
    getDailySummary,
  } = useCasinoSessions();

  const {
    updateStreakFromSession,
    updateWeeklyGoalProgress,
  } = useGamification();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<SlotManufacturer | ''>('');
  const [selectedShip, setSelectedShip] = useState('');
  const [showSessionsSection, setShowSessionsSection] = useState(false);
  const [editingSession, setEditingSession] = useState<CasinoSession | null>(null);
  const [showQuickSessionModal, setShowQuickSessionModal] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [casinoOpenHoursData, setCasinoOpenHoursData] = useState<CasinoOpenHoursData | null>(null);
  const allUpcomingCruises = useMemo((): BookedCruise[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedCruises = [...bookedCruises]
      .filter((cruise) => {
        return Boolean(cruise.id && cruise.sailDate) && cruise.status !== 'cancelled';
      })
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());

    const upcomingCruises = sortedCruises.filter((cruise) => {
      if (cruise.completionState === 'completed' || cruise.status === 'completed') {
        return false;
      }

      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate || cruise.sailDate);
      sailDate.setHours(0, 0, 0, 0);
      returnDate.setHours(0, 0, 0, 0);

      return sailDate >= today || returnDate >= today || cruise.completionState === 'in-progress';
    });

    console.log('[Machines] Resolved cruises for casino open hours card:', {
      bookedCruises: bookedCruises.length,
      sortedCruises: sortedCruises.length,
      upcomingCruises: upcomingCruises.length,
      nextUpcomingCruise: upcomingCruises[0]?.id,
      nextUpcomingCruiseShip: upcomingCruises[0]?.shipName,
    });

    if (upcomingCruises.length > 0) {
      return upcomingCruises;
    }

    const fallbackCruises = sortedCruises.filter((cruise) => {
      return cruise.completionState !== 'completed' && cruise.status !== 'completed';
    });

    console.log('[Machines] Falling back to non-completed booked cruises for casino open hours card:', {
      fallbackCruises: fallbackCruises.length,
      firstFallbackCruise: fallbackCruises[0]?.id,
    });

    return fallbackCruises;
  }, [bookedCruises]);

  const nextUpcomingCruise = useMemo((): BookedCruise | null => {
    return allUpcomingCruises[0] ?? null;
  }, [allUpcomingCruises]);

  const currentPlayingHours = useMemo(() => {
    return currentUser?.playingHours || DEFAULT_PLAYING_HOURS;
  }, [currentUser?.playingHours]);

  const todayDateString = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const goldenTimeSlots = useMemo(() => {
    const playingHours = currentPlayingHours;
    const enabledSessions = (playingHours.sessions || []).filter(s => s.enabled);

    if (!casinoOpenHoursData || casinoOpenHoursData.days.length === 0) {
      return enabledSessions.map(s => {
        const startParts = s.startTime.split(':').map(Number);
        const endParts = s.endTime.split(':').map(Number);
        let startMins = (startParts[0] || 0) * 60 + (startParts[1] || 0);
        let endMins = (endParts[0] || 0) * 60 + (endParts[1] || 0);
        if (endMins <= startMins) endMins += 24 * 60;
        return {
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: endMins - startMins,
          label: s.name,
        };
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const todayDay = casinoOpenHoursData.days.find(d => d.date === today);
    const currentDay = todayDay || casinoOpenHoursData.days[0];

    if (!currentDay) return [];

    let casinoOpen = '';
    let casinoClose = '';
    if (currentDay.hasOverride && currentDay.actualOpenTime && currentDay.actualCloseTime) {
      casinoOpen = currentDay.actualOpenTime;
      casinoClose = currentDay.actualCloseTime;
    } else if (currentDay.bestGuessOpen && currentDay.bestGuessHours) {
      const hoursParts = currentDay.bestGuessHours.split(' - ');
      if (hoursParts.length === 2) {
        casinoOpen = hoursParts[0].trim();
        casinoClose = hoursParts[1].trim();
      }
    }

    if (!casinoOpen || !casinoClose) {
      return enabledSessions.map(s => {
        const startParts = s.startTime.split(':').map(Number);
        const endParts = s.endTime.split(':').map(Number);
        let startMins = (startParts[0] || 0) * 60 + (startParts[1] || 0);
        let endMins = (endParts[0] || 0) * 60 + (endParts[1] || 0);
        if (endMins <= startMins) endMins += 24 * 60;
        return {
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: endMins - startMins,
          label: s.name,
        };
      });
    }

    const toMins = (t: string): number => {
      const parts = t.split(':').map(Number);
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    const casinoOpenMins = toMins(casinoOpen);
    let casinoCloseMins = toMins(casinoClose);
    if (casinoCloseMins <= casinoOpenMins) casinoCloseMins += 24 * 60;

    const slots: { id: string; startTime: string; endTime: string; durationMinutes: number; label: string }[] = [];

    for (const s of enabledSessions) {
      let sStart = toMins(s.startTime);
      let sEnd = toMins(s.endTime);
      if (sEnd <= sStart) sEnd += 24 * 60;

      const overlapStart = Math.max(sStart, casinoOpenMins);
      const overlapEnd = Math.min(sEnd, casinoCloseMins);

      if (overlapEnd > overlapStart) {
        const fmtTime = (m: number): string => {
          const normalized = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
          const h = Math.floor(normalized / 60);
          const min = normalized % 60;
          return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        };
        slots.push({
          id: `${s.id}_casino`,
          startTime: fmtTime(overlapStart),
          endTime: fmtTime(overlapEnd),
          durationMinutes: overlapEnd - overlapStart,
          label: `${s.name} (Casino Open)`,
        });
      }
    }

    console.log('[Machines] Golden time slots from casino hours + playing hours:', slots.length);
    return slots;
  }, [currentPlayingHours, casinoOpenHoursData]);

  const totalGoldenMinutes = useMemo(() => {
    return goldenTimeSlots.reduce((total, slot) => total + slot.durationMinutes, 0);
  }, [goldenTimeSlots]);

  const todaySessions = useMemo(() => {
    return getSessionsForDate(todayDateString);
  }, [getSessionsForDate, todayDateString]);

  const todaySummary = useMemo(() => {
    return getDailySummary(todayDateString, totalGoldenMinutes);
  }, [getDailySummary, todayDateString, totalGoldenMinutes]);

  const handleAddSessionFromTracker = useCallback(async (sessionData: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
    buyIn?: number;
    cashOut?: number;
    winLoss?: number;
    machineType?: MachineType;
    denomination?: Denomination;
    pointsEarned?: number;
  }) => {
    await addSession({
      date: todayDateString,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      durationMinutes: sessionData.durationMinutes,
      notes: sessionData.notes,
      buyIn: sessionData.buyIn,
      cashOut: sessionData.cashOut,
      winLoss: sessionData.winLoss,
      machineType: sessionData.machineType,
      denomination: sessionData.denomination,
      pointsEarned: sessionData.pointsEarned,
    });

    await updateStreakFromSession(todayDateString);
    await updateWeeklyGoalProgress('sessions', 1);
    await updateWeeklyGoalProgress('time', sessionData.durationMinutes);
    if (sessionData.pointsEarned) {
      await updateWeeklyGoalProgress('points', sessionData.pointsEarned);
    }

    setShowAddSessionModal(false);
    console.log('[Machines] Session added from tracker:', sessionData);
  }, [addSession, todayDateString, updateStreakFromSession, updateWeeklyGoalProgress]);

  const handleRemoveSessionFromTracker = useCallback(async (sessionId: string) => {
    await removeSession(sessionId);
    console.log('[Machines] Session removed from tracker:', sessionId);
  }, [removeSession]);

  const handleCasinoHoursLoaded = useCallback((data: CasinoOpenHoursData | null) => {
    setCasinoOpenHoursData(data);
    console.log('[Machines] Casino open hours data loaded:', data?.days.length, 'days');
  }, []);

  const handleSavePlayingHours = useCallback(async (playingHours: PlayingHours) => {
    try {
      setIsSavingPlayingHours(true);
      console.log('[Machines] Saving playing hours:', playingHours);
      if (currentUser) {
        await updateUser(currentUser.id, { playingHours });
      } else {
        const owner = await ensureOwner();
        await updateUser(owner.id, { playingHours });
      }
      Alert.alert('Playing Hours Saved', 'Your preferred playing times have been updated.');
    } catch (error) {
      console.error('[Machines] Save playing hours error:', error);
      Alert.alert('Save Error', 'Failed to save playing hours. Please try again.');
    } finally {
      setIsSavingPlayingHours(false);
    }
  }, [currentUser, ensureOwner, updateUser]);

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
        m.shipAssignments?.some((s: any) => s.shipName === selectedShip)
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

  const handleMachinePress = useCallback((id: string) => {
    router.push(`/machine-detail/${id}` as any);
  }, [router]);

  const handleToggleFavorite = useCallback((id: string) => {
    void toggleFavorite(id);
  }, [toggleFavorite]);

  const handleExportFavorites = useCallback(async () => {
    if (favoriteMachines.length === 0) {
      console.warn('[Atlas] No favorite machines to export');
      return;
    }

    try {
      setIsExporting(true);
      console.log(`[Atlas] Exporting ${favoriteMachines.length} favorite machines to DOCX...`);
      const { exportFavoriteMachinesToDocx } = await import('@/lib/exportMachinesToDocx');
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
      const { exportAllMachinesIncrementallyToDocx } = await import('@/lib/exportMachinesToDocx');
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
      return (
        <View style={[styles.gridItem, index % 2 === 1 && styles.gridItemRight]}>
          <AtlasCard
            machine={item}
            onPress={() => handleMachinePress(item.id)}
            isFavorite={item.isFavorite}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            compact={true}
            locked={false}
          />
        </View>
      );
    },
    [handleMachinePress, handleToggleFavorite]
  );

  const listHeader = useMemo(() => {
    return (
      <>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#3AAFA9', '#2B7A78', '#17A398', '#1E8C82', '#3AAFA9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent', 'rgba(255,255,255,0.12)', 'transparent', 'rgba(255,255,255,0.08)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Easy Seas™</Text>
            <Text style={styles.heroSubtitle}>Manage your Nautical Lifestyle™</Text>
            <Image
              source={{ uri: IMAGES.signature }}
              style={styles.heroSignature}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Slot Machine Advantage Players Handbook</Text>
          <Text style={styles.subtitle}>
            {filteredMachines.length} machine{filteredMachines.length !== 1 ? 's' : ''}
          </Text>
        </View>



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

        <View style={styles.hoursCardsSection}>
          <PlayingHoursCard
            currentValues={currentPlayingHours}
            onSave={handleSavePlayingHours}
            isSaving={isSavingPlayingHours}
          />
          <CasinoOpenHoursCard cruise={nextUpcomingCruise} allUpcomingCruises={allUpcomingCruises} onHoursDataLoaded={handleCasinoHoursLoaded} />

          <View style={styles.sessionTrackerContainer}>
            <CasinoSessionTracker
              date={todayDateString}
              goldenTimeSlots={goldenTimeSlots}
              sessions={todaySessions}
              summary={todaySummary}
              onAddSession={() => setShowAddSessionModal(true)}
              onRemoveSession={handleRemoveSessionFromTracker}
            />
          </View>
        </View>

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
    activeFilter,
    currentPlayingHours,
    handleSavePlayingHours,
    isSavingPlayingHours,
    nextUpcomingCruise,
    allUpcomingCruises,
    handleCasinoHoursLoaded,
    todayDateString,
    goldenTimeSlots,
    todaySessions,
    todaySummary,
    handleRemoveSessionFromTracker,
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

      <AddSessionModal
        visible={showAddSessionModal}
        onClose={() => setShowAddSessionModal(false)}
        onSave={handleAddSessionFromTracker}
        date={todayDateString}
        goldenTimeSlots={goldenTimeSlots}
      />
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
  heroCard: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    marginHorizontal: 20,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  heroOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#1A1A1A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: 'rgba(0,0,0,0.65)',
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  heroSignature: {
    width: 240,
    height: 100,
    marginTop: 14,
    opacity: 0.8,
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
  hoursCardsSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  sessionTrackerContainer: {
    marginTop: SPACING.md,
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
});
