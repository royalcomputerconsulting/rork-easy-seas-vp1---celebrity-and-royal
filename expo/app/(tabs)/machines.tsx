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
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, Search, X, Star, ChevronDown, ChevronUp, Plus, Download, MapPinned, SlidersHorizontal, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions, type CasinoSession } from '@/state/CasinoSessionProvider';
import { AtlasCard } from '@/components/AtlasCard';
import { useEntitlement } from '@/state/EntitlementProvider';
import { useAuth } from '@/state/AuthProvider';
import { exportFavoriteMachinesToDocx, exportAllMachinesIncrementallyToDocx } from '@/lib/exportMachinesToDocx';
import { MachineSessionStats } from '@/components/MachineSessionStats';
import { MachineSessionsList } from '@/components/MachineSessionsList';
import { EditMachineSessionModal } from '@/components/EditMachineSessionModal';
import QuickMachineSessionModal from '@/components/QuickMachineSessionModal';
import { PlayingHoursCard } from '@/components/ui/PlayingHoursCard';
import { CasinoOpenHoursCard, type CasinoOpenHoursData } from '@/components/ui/CasinoOpenHoursCard';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { OperationStatusCard, type OperationFeedback } from '@/components/ui/OperationStatusCard';
import { CasinoSessionTracker } from '@/components/CasinoSessionTracker';
import { AddSessionModal } from '@/components/AddSessionModal';
import { MachineConditionLogsPanel } from '@/components/MachineConditionLogsPanel';
import { MachineStrategyCard } from '@/components/MachineStrategyCard';
import { ShipMachinesExplorer } from '@/components/ShipMachinesExplorer';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import type { PlayingHours } from '@/state/UserProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useExperience } from '@/state/ExperienceProvider';
import { useGamification } from '@/state/GamificationProvider';
import type { MachineType, Denomination } from '@/state/CasinoSessionProvider';
import type { MachineEncyclopediaEntry, SlotManufacturer, BookedCruise } from '@/types/models';
import { createDateFromString, toLocalCalendarDateOnly } from '@/lib/date';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { filterSlotMachineLibrary, getSlotMachineListKey } from '@/lib/slotMachineLibraryFilter';

type FilterOption = 'all' | 'favorites' | 'manufacturer' | 'ship';

export default function AtlasScreen() {
  const router = useRouter();
  const { colors: experienceColors, isDark } = useExperience();
  const params = useLocalSearchParams<{ startSession?: string }>();
  const _entitlement = useEntitlement();
  const { authenticatedEmail } = useAuth();

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
  const [listHeaderHeight, setListHeaderHeight] = useState<number>(0);
  const [showAlphabetRail, setShowAlphabetRail] = useState(false);
  const showAlphabetRailRef = useRef(false);
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
  const atlasLoadOwnerRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const ownerKey = authenticatedEmail ?? '__no_user__';
      if (atlasLoadOwnerRef.current === ownerKey) return;
      atlasLoadOwnerRef.current = ownerKey;
      let loadStarted = false;
      const interaction = runAfterUiSettles(() => {
        loadStarted = true;
        void reload().catch((error) => {
          atlasLoadOwnerRef.current = null;
          console.error('[Atlas] On-demand local atlas load failed:', error);
          setUiError(error instanceof Error ? error.message : 'Unable to load the local slot atlas');
        });
      });
      return () => {
        interaction.cancel();
        if (!loadStarted && atlasLoadOwnerRef.current === ownerKey) {
          atlasLoadOwnerRef.current = null;
        }
      };
    }, [authenticatedEmail, reload])
  );

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
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSessionsSection, setShowSessionsSection] = useState(false);
  const [editingSession, setEditingSession] = useState<CasinoSession | null>(null);
  const [showQuickSessionModal, setShowQuickSessionModal] = useState(false);
  const sessionStartHandledRef = useRef(false);
  useEffect(() => {
    if (params.startSession !== '1' || sessionStartHandledRef.current) return;
    sessionStartHandledRef.current = true;
    setShowQuickSessionModal(true);
  }, [params.startSession]);
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
    return toLocalCalendarDateOnly(new Date()) ?? '';
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

    const today = toLocalCalendarDateOnly(new Date()) ?? '';
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
  const [machineOperation, setMachineOperation] = useState<OperationFeedback | null>(null);
  const [lastFavoriteChange, setLastFavoriteChange] = useState<{ id: string; name: string; wasFavorite: boolean } | null>(null);

  const manufacturerOptions = useMemo(() => {
    return Array.from(new Set(myAtlasMachines.map((machine) => machine.manufacturer).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [myAtlasMachines]);

  const shipOptions = useMemo(() => {
    const ships = myAtlasMachines.flatMap((machine) =>
      (machine.shipAssignments ?? []).map((assignment) => assignment.shipName).filter(Boolean)
    );
    return Array.from(new Set(ships)).sort((a, b) => a.localeCompare(b));
  }, [myAtlasMachines]);


  const filteredMachines = useMemo(() => {
    return filterSlotMachineLibrary(myAtlasMachines, {
      searchQuery,
      favoritesOnly: activeFilter === 'favorites',
      manufacturer: selectedManufacturer,
      ship: selectedShip,
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

  const handleToggleFavorite = useCallback(async (id: string) => {
    const machine = myAtlasMachines.find((row) => row.id === id);
    if (!machine) return;
    const wasFavorite = Boolean(machine.isFavorite);
    setMachineOperation({
      id: `favorite-${id}`,
      title: wasFavorite ? 'Removing favorite' : 'Saving favorite',
      status: 'running',
      message: `${machine.machineName} is being saved to this profile.`,
      current: 0,
      total: 1,
      committed: false,
      startedAt: new Date().toISOString(),
    });
    try {
      await toggleFavorite(id);
      setLastFavoriteChange({ id, name: machine.machineName, wasFavorite });
      setMachineOperation((current) => current ? {
        ...current,
        status: 'success',
        message: wasFavorite
          ? `${machine.machineName} was removed from this profile's favorites.`
          : `${machine.machineName} was added to this profile's favorites.`,
        current: 1,
        committed: true,
        completedAt: new Date().toISOString(),
      } : current);
    } catch (error) {
      setLastFavoriteChange(null);
      setMachineOperation((current) => current ? {
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'The favorite change could not be saved.',
        committed: false,
        completedAt: new Date().toISOString(),
      } : current);
    }
  }, [myAtlasMachines, toggleFavorite]);

  const undoLastFavoriteChange = useCallback(async () => {
    if (!lastFavoriteChange) return;
    const change = lastFavoriteChange;
    setMachineOperation({
      id: `favorite-undo-${change.id}`,
      title: 'Undoing favorite change',
      status: 'running',
      message: `Restoring the previous favorite state for ${change.name}.`,
      current: 0,
      total: 1,
      committed: false,
      startedAt: new Date().toISOString(),
    });
    try {
      await toggleFavorite(change.id);
      setLastFavoriteChange(null);
      setMachineOperation((current) => current ? {
        ...current,
        status: 'success',
        message: `${change.name} was restored to its previous favorite state.`,
        current: 1,
        committed: true,
        completedAt: new Date().toISOString(),
      } : current);
    } catch (error) {
      setMachineOperation((current) => current ? {
        ...current,
        status: 'error',
        message: error instanceof Error ? error.message : 'The favorite change could not be undone.',
        committed: false,
        completedAt: new Date().toISOString(),
      } : current);
    }
  }, [lastFavoriteChange, toggleFavorite]);

  const handleExportFavorites = useCallback(async () => {
    if (favoriteMachines.length === 0) {
      console.warn('[Atlas] No favorite machines to export');
      return;
    }

    try {
      setIsExporting(true);
      setMachineOperation({ id: 'export-favorite-machines', title: 'Exporting favorite machines', status: 'running', message: `Preparing ${favoriteMachines.length.toLocaleString()} favorite machine${favoriteMachines.length === 1 ? '' : 's'} for the share sheet.`, current: 0, total: favoriteMachines.length, committed: false, startedAt: new Date().toISOString() });
      console.log(`[Atlas] Exporting ${favoriteMachines.length} favorite machines to DOCX...`);
      await exportFavoriteMachinesToDocx(favoriteMachines);
      setMachineOperation((current) => current ? { ...current, status: 'success', message: `${favoriteMachines.length.toLocaleString()} favorite machine${favoriteMachines.length === 1 ? '' : 's'} were written to the exported document.`, current: favoriteMachines.length, committed: true, completedAt: new Date().toISOString() } : current);
      console.log('[Atlas] Export successful');
    } catch (error) {
      console.error('[Atlas] Export failed:', error);
      setUiError(error instanceof Error ? error.message : 'Export failed');
      setMachineOperation((current) => current ? { ...current, status: 'error', message: error instanceof Error ? error.message : 'Favorite machine export failed.', committed: false, completedAt: new Date().toISOString() } : current);
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
      setMachineOperation({ id: 'export-all-machines', title: 'Exporting machine library', status: 'running', message: `Preparing ${myAtlasMachines.length.toLocaleString()} machine records.`, current: 0, total: myAtlasMachines.length, committed: false, startedAt: new Date().toISOString() });
      console.log(`[Atlas] Exporting ALL ${myAtlasMachines.length} machines with full details to DOCX...`);
      await exportAllMachinesIncrementallyToDocx(myAtlasMachines, (current, total) => {
        setExportProgress({ current, total });
        setMachineOperation((operation) => operation ? { ...operation, current, total, message: `Writing machine ${current.toLocaleString()} of ${total.toLocaleString()}.` } : operation);
      });
      setMachineOperation((current) => current ? { ...current, status: 'success', message: `${myAtlasMachines.length.toLocaleString()} machine records were written to the exported document.`, current: myAtlasMachines.length, committed: true, completedAt: new Date().toISOString() } : current);
      console.log('[Atlas] Export successful');
    } catch (error) {
      console.error('[Atlas] Export failed:', error);
      setUiError(error instanceof Error ? error.message : 'Export failed');
      setMachineOperation((current) => current ? { ...current, status: 'error', message: error instanceof Error ? error.message : 'Machine library export failed.', committed: false, completedAt: new Date().toISOString() } : current);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [myAtlasMachines]);

  const hasActiveFilters = Boolean(searchQuery || activeFilter !== 'all' || selectedManufacturer || selectedShip);
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (activeFilter === 'favorites') parts.push('Favorites only');
    if (selectedManufacturer) parts.push(selectedManufacturer);
    if (selectedShip) parts.push(selectedShip);
    if (searchQuery.trim()) parts.push(`Search: “${searchQuery.trim()}”`);
    return parts.length > 0 ? parts.join(' · ') : 'All saved machine observations';
  }, [activeFilter, searchQuery, selectedManufacturer, selectedShip]);

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
    ({ item }: { item: (typeof filteredMachines)[number]; index: number }) => {
      return (
        <View style={[styles.machineRow, filteredMachines.length > 24 && styles.machineRowWithAlphabet]}>
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
    [filteredMachines.length, handleMachinePress, handleToggleFavorite]
  );

  const listHeader = useMemo(() => {
    return (
      <>
        <TabIdentityBand tab="slots" compact detail={`${filteredMachines.length.toLocaleString()} machine${filteredMachines.length === 1 ? '' : 's'} in this view`} />
        <View style={styles.header}>
          <Text style={styles.title}>Machine tools</Text>
          <Text style={styles.subtitle}>
            Search {filteredMachines.length} saved machine{filteredMachines.length !== 1 ? 's' : ''}, add observations, or open the verified onboard map.
          </Text>
          <TouchableOpacity style={styles.verifiedAtlasButton} onPress={() => router.push('/verified-machine-atlas' as never)} testID="machines-open-verified-atlas">
            <MapPinned size={17} color={COLORS.white} />
            <Text style={styles.verifiedAtlasButtonText}>Open verified onboard map</Text>
          </TouchableOpacity>
          <View style={styles.machineToolsRow}>
            <TouchableOpacity
              style={styles.machineToolButton}
              onPress={() => router.push('/add-machine-wizard' as never)}
              testID="machines-add-machine"
              accessibilityRole="button"
              accessibilityLabel="Add a slot machine observation"
            >
              <Plus size={17} color="#0E7FA7" />
              <Text style={styles.machineToolButtonText}>Add machine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.machineToolButton}
              onPress={() => router.push('/global-library' as never)}
              testID="machines-browse-library"
              accessibilityRole="button"
              accessibilityLabel="Browse the global slot machine library"
            >
              <Database size={17} color="#0E7FA7" />
              <Text style={styles.machineToolButtonText}>Browse library</Text>
            </TouchableOpacity>
          </View>
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
                  setUiError(e instanceof Error ? e.message : 'The machine library did not provide error details.');
                });
              }}
              activeOpacity={0.85}
              testID="machines.errorRetry"
            >
              <Text style={styles.retryButtonText}>Reload machine library</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {machineOperation ? (
          <View style={styles.operationStatusShell}>
            <OperationStatusCard
              operation={machineOperation}
              onRetry={machineOperation.status === 'error'
                ? machineOperation.id === 'export-favorite-machines'
                  ? () => void handleExportFavorites()
                  : machineOperation.id === 'export-all-machines'
                    ? () => void handleExportAll()
                    : lastFavoriteChange
                      ? () => void handleToggleFavorite(lastFavoriteChange.id)
                      : undefined
                : undefined}
              onUndo={machineOperation.status === 'success' && machineOperation.id.startsWith('favorite-') && lastFavoriteChange ? () => void undoLastFavoriteChange() : undefined}
              onDismiss={machineOperation.status !== 'running' ? () => setMachineOperation(null) : undefined}
            />
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.initialLoading} testID="machines.initialLoading">
            <ActivityIndicator size="small" color={COLORS.navyDeep} />
            <Text style={styles.initialLoadingText}>Loading your atlas…</Text>
          </View>
        ) : null}

        <View style={styles.sessionsSection}>
          <ThemedSectionHeader
            tab="slots"
            emoji="📝"
            title="Play sessions"
            subtitle="Optional timed observations, results, and machine notes."
            tone="casino"
            compact
            testID="slots-play-sessions-section"
          />
          <View style={styles.sectionBody}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.sectionToggle}
              onPress={() => setShowSessionsSection(!showSessionsSection)}
              activeOpacity={0.7}
              testID="machines.sessions.toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: showSessionsSection }}
              accessibilityLabel={`${showSessionsSection ? 'Hide' : 'Show'} play session details`}
            >
              <Text style={styles.sectionToggleText}>{showSessionsSection ? 'Hide session details' : 'Show session details'}</Text>
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
        </View>

        <CollapsibleSection
          title="Machine strategy"
          subtitle="Personalized recommendations from your saved play preferences"
          icon={<Star size={18} color="#0E7FA7" />}
          defaultExpanded={false}
          showBorder={false}
          tab="slots"
          emoji="🧠"
        >
          <MachineStrategyCard />
        </CollapsibleSection>

        <CollapsibleSection
          title="Ship machine explorer"
          subtitle="Browse saved slot-machine availability by ship"
          icon={<MapPinned size={18} color="#0E7FA7" />}
          defaultExpanded={false}
          showBorder={false}
          tab="slots"
          emoji="🗺️"
        >
          <ShipMachinesExplorer />
        </CollapsibleSection>

        {isLoadingIndex && (
          <View style={styles.loadingBanner} testID="machines.loadingIndex">
            <ActivityIndicator size="small" color={COLORS.navyDeep} />
            <Text style={styles.loadingText}>Building machine index...</Text>
          </View>
        )}

        <ThemedSectionHeader tab="slots" emoji="🔎" title="Machine observations" subtitle="Conditions, locations, and notes saved by ship." tone="info" compact />
        <MachineConditionLogsPanel defaultShipName={nextUpcomingCruise?.shipName} />

        <View style={styles.hoursCardsSection}>
          <ThemedSectionHeader tab="slots" emoji="⏰" title="Playing plan" subtitle="Preferred hours, casino availability, and today’s opportunities." tone="success" compact />
          <View style={styles.sectionBody}>
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
        </View>

        <View style={styles.searchSection}>
          <ThemedSectionHeader
            tab="slots"
            emoji="🎰"
            title="Machine library"
            subtitle={`${filteredMachines.length.toLocaleString()} machine${filteredMachines.length === 1 ? '' : 's'} in this view`}
            compact
            testID="slots-machine-library-section"
          />
          <View style={styles.sectionBody}>
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
        </View>

        <View style={styles.filtersContainer}>
          <FlatList
            data={[
              { key: 'all' as const },
              { key: 'favorites' as const },
              { key: 'advanced' as const },
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

              if (item.key === 'advanced') {
                const selectedCount = Number(Boolean(selectedManufacturer)) + Number(Boolean(selectedShip));
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, selectedCount > 0 && styles.filterChipActive]}
                    onPress={() => setShowFilterSheet(true)}
                    activeOpacity={0.7}
                    testID="machines.filter.open"
                    accessibilityRole="button"
                    accessibilityLabel={`Filter machines by manufacturer or ship${selectedCount ? `, ${selectedCount} selected` : ''}`}
                  >
                    <SlidersHorizontal size={14} color={selectedCount > 0 ? COLORS.white : COLORS.navyDeep} />
                    <Text style={[styles.filterChipText, selectedCount > 0 && styles.filterChipTextActive]}>
                      Filters{selectedCount ? ` (${selectedCount})` : ''}
                    </Text>
                  </TouchableOpacity>
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
          <View style={styles.filterSummary} testID="machines.filter.summary">
            <View style={styles.filterSummaryIcon}>
              <SlidersHorizontal size={14} color="#FFFFFF" />
            </View>
            <View style={styles.filterSummaryCopy}>
              <Text style={styles.filterSummaryLabel}>Showing {filteredMachines.length.toLocaleString()} machines</Text>
              <Text style={styles.filterSummaryText} numberOfLines={2}>{activeFilterSummary}</Text>
            </View>
          </View>
        </View>
      </>
    );
  }, [
    activeFilter,
    activeFilterSummary,
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
    handleToggleFavorite,
    hasActiveFilters,
    isExporting,
    exportProgress,
    machineOperation,
    lastFavoriteChange,
    isLoading,
    isLoadingIndex,
    myAtlasMachines.length,
    reload,
    router,
    searchQuery,
    selectedManufacturer,
    selectedShip,
    sessions,
    showSessionsSection,
    uiError,
    undoLastFavoriteChange,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
          colors={experienceColors.pageGradient}
          locations={[0, 0.5, 1]}
          style={styles.gradientContainer}
        >
        <SafeAreaView style={[styles.container, { backgroundColor: experienceColors.background }]} edges={['top']}>
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
          keyExtractor={getSlotMachineListKey}
          renderItem={({ item, index }) => {
            try {
              return renderMachineItem({ item, index } as any);
            } catch (e) {
              console.error('[Atlas] renderItem crashed', e);
              if (!uiError) {
                setUiError(e instanceof Error ? e.message : 'The machine library did not provide error details.');
              }
              return null;
            }
          }}
          numColumns={1}
          ListHeaderComponent={(
            <View
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                if (height > 0 && isFinite(height)) setListHeaderHeight(height);
              }}
              testID="machines.list.header"
            >
              {listHeader}
            </View>
          )}
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
                const shouldShowAlphabetRail = filteredMachines.length > 24
                  && scrollOffsetRef.current >= Math.max(240, listHeaderHeight - 120);
                if (shouldShowAlphabetRail !== showAlphabetRailRef.current) {
                  showAlphabetRailRef.current = shouldShowAlphabetRail;
                  setShowAlphabetRail(shouldShowAlphabetRail);
                }
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

          {filteredMachines.length > 24 && showAlphabetRail && (
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

      <Modal
        visible={showFilterSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterSheet(false)}
        testID="machines.filter.sheet"
      >
        <SafeAreaView style={styles.filterSheet} edges={['top', 'bottom']}>
          <View style={styles.filterSheetHeader}>
            <View>
              <Text style={styles.filterSheetTitle}>Filter slot machines</Text>
              <Text style={styles.filterSheetSubtitle}>{filteredMachines.length.toLocaleString()} matching machines</Text>
            </View>
            <TouchableOpacity
              style={styles.filterSheetClose}
              onPress={() => setShowFilterSheet(false)}
              testID="machines.filter.close"
              accessibilityRole="button"
              accessibilityLabel="Close machine filters"
            >
              <X size={22} color={COLORS.navyDeep} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.filterSheetContent}>
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupTitleRow}>
                <Database size={18} color={COLORS.navyDeep} />
                <Text style={styles.filterGroupTitle}>Manufacturer</Text>
              </View>
              <View style={styles.filterChoiceGrid}>
                <TouchableOpacity
                  style={[styles.filterChoice, !selectedManufacturer && styles.filterChoiceSelected]}
                  onPress={() => setSelectedManufacturer('')}
                  testID="machines.filter.manufacturer.all"
                >
                  <Text style={[styles.filterChoiceText, !selectedManufacturer && styles.filterChoiceTextSelected]}>All manufacturers</Text>
                </TouchableOpacity>
                {manufacturerOptions.map((manufacturer) => {
                  const selected = selectedManufacturer === manufacturer;
                  return (
                    <TouchableOpacity
                      key={manufacturer}
                      style={[styles.filterChoice, selected && styles.filterChoiceSelected]}
                      onPress={() => setSelectedManufacturer(selected ? '' : manufacturer as SlotManufacturer)}
                      testID={`machines.filter.manufacturer.${manufacturer}`}
                    >
                      <Text style={[styles.filterChoiceText, selected && styles.filterChoiceTextSelected]}>{manufacturer}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <View style={styles.filterGroupTitleRow}>
                <Ship size={18} color={COLORS.navyDeep} />
                <Text style={styles.filterGroupTitle}>Ship</Text>
              </View>
              <View style={styles.filterChoiceGrid}>
                <TouchableOpacity
                  style={[styles.filterChoice, !selectedShip && styles.filterChoiceSelected]}
                  onPress={() => setSelectedShip('')}
                  testID="machines.filter.ship.all"
                >
                  <Text style={[styles.filterChoiceText, !selectedShip && styles.filterChoiceTextSelected]}>All ships</Text>
                </TouchableOpacity>
                {shipOptions.map((ship) => {
                  const selected = selectedShip === ship;
                  return (
                    <TouchableOpacity
                      key={ship}
                      style={[styles.filterChoice, selected && styles.filterChoiceSelected]}
                      onPress={() => setSelectedShip(selected ? '' : ship)}
                      testID={`machines.filter.ship.${ship}`}
                    >
                      <Text style={[styles.filterChoiceText, selected && styles.filterChoiceTextSelected]}>{ship}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.filterSheetFooter}>
            <TouchableOpacity style={styles.filterResetButton} onPress={handleClearFilters} testID="machines.filter.reset">
              <Text style={styles.filterResetText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => setShowFilterSheet(false)} testID="machines.filter.apply">
              <Text style={styles.filterApplyText}>Show {filteredMachines.length.toLocaleString()} machines</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    marginHorizontal: 14,
    padding: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionBody: {
    padding: 14,
    paddingTop: 12,
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
    backgroundColor: '#F8F4ED',
    borderWidth: 1,
    borderColor: '#E3DDD4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addSessionButton: {
    backgroundColor: '#167C80',
    borderRadius: 14,
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
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
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
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  heroOverlay: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: '#0F2247',
    letterSpacing: 1,
    textAlign: 'left',
  },
  heroSubtitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#58585B',
    marginTop: 0,
    letterSpacing: 0.3,
    textAlign: 'left',
  },
  heroSignature: {
    width: 104,
    height: 30,
    marginTop: 0,
    opacity: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    borderRadius: 14,
    marginHorizontal: 14,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: '#0F2247',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#58585B',
  },
  verifiedAtlasButton: {
    marginTop: SPACING.md,
    borderRadius: 10,
    backgroundColor: '#123D73',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verifiedAtlasButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.35,
  },
  machineToolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  machineToolButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#F5F5F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  machineToolButtonText: {
    color: '#0F2247',
    fontSize: 12,
    fontWeight: '800' as const,
  },
  hoursCardsSection: {
    marginHorizontal: 14,
    padding: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  sessionTrackerContainer: {
    marginTop: SPACING.md,
  },
  searchSection: {
    marginHorizontal: 14,
    padding: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderRadius: 14,
    marginBottom: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D5D5D0',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderRadius: 14,
    marginHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  filtersRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#F3F3F2',
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  filterSummaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#0E7FA7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummaryCopy: {
    flex: 1,
  },
  filterSummaryLabel: {
    color: '#0F2247',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  filterSummaryText: {
    color: '#58585B',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  filterChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#0F2247',
    borderColor: '#0F2247',
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
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: 0,
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
  operationStatusShell: {
    marginHorizontal: SPACING.md,
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
  machineRow: {
    width: 'auto',
    marginHorizontal: 20,
  },
  machineRowWithAlphabet: {
    marginRight: 50,
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
  filterSheet: {
    flex: 1,
    backgroundColor: '#F6F2EA',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
    backgroundColor: '#FFFDF9',
  },
  filterSheetTitle: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  filterSheetSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textDarkGrey,
  },
  filterSheetClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FC',
  },
  filterSheetContent: {
    padding: 20,
    gap: 18,
  },
  filterGroup: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  filterGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterGroupTitle: {
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  filterChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChoice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#BFC4CC',
    backgroundColor: '#FFFFFF',
  },
  filterChoiceSelected: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  filterChoiceText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  filterChoiceTextSelected: {
    color: COLORS.white,
  },
  filterSheetFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
    backgroundColor: '#FFFDF9',
  },
  filterResetButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  filterResetText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  filterApplyButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.navyDeep,
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
});
