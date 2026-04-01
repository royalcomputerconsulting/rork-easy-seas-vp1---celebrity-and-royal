import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useAuth } from "./AuthProvider";
import { normalizeBirthdateInput } from "@/lib/date";
import { generateDailyLuckEntriesForYear, getDailyLuckDateKey, hasTransparentDailyLuckEntry } from "@/lib/dailyLuck";
import { getEarthRoosterLuck2026Entry } from "@/constants/earthRoosterLuck2026";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";
import type { DailyLuckEntry } from "@/types/daily-luck";

export interface PlayingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  preferSeaDayMorning: boolean;
  preferPortDayEvening: boolean;
  sessions: PlayingSession[];
}

export interface PlayingSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export const DEFAULT_PLAYING_HOURS: PlayingHours = {
  enabled: true,
  startTime: '05:00',
  endTime: '07:30',
  preferSeaDayMorning: true,
  preferPortDayEvening: true,
  sessions: [
    { id: 'early_morning', name: 'Early Morning', startTime: '05:00', endTime: '07:30', enabled: true },
    { id: 'late_morning', name: 'Late Morning', startTime: '10:00', endTime: '12:00', enabled: true },
    { id: 'afternoon', name: 'Afternoon', startTime: '14:00', endTime: '17:00', enabled: true },
    { id: 'evening', name: 'Evening', startTime: '19:00', endTime: '23:00', enabled: true },
    { id: 'late_night', name: 'Late Night', startTime: '23:00', endTime: '02:30', enabled: true },
  ],
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isOwner?: boolean;
  avatarUrl?: string;
  crownAnchorNumber?: string;
  birthdate?: string;
  dailyLuckByDate?: Record<string, DailyLuckEntry>;
  dailyLuckYears?: number[];
  dailyLuckLastGeneratedAt?: string;
  playingHours?: PlayingHours;
  celebrityEmail?: string;
  celebrityCaptainsClubNumber?: string;
  celebrityCaptainsClubPoints?: number;
  celebrityBlueChipPoints?: number;
  preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
  silverseaEmail?: string;
  silverseaVenetianNumber?: string;
  silverseaVenetianTier?: string;
  silverseaVenetianPoints?: number;
  silverseaCasinoTier?: string;
  silverseaCasinoPoints?: number;
  carnivalVifpNumber?: string;
  carnivalVifpTier?: string;
  carnivalPlayersClubTier?: string;
  carnivalPlayersClubPoints?: number;
  createdAt: string;
  updatedAt: string;
}

interface UserState {
  users: UserProfile[];
  currentUserId: string | null;
  currentUser: UserProfile | null;
  isLoading: boolean;
  isCalculatingDailyLuck: boolean;
  addUser: (user: { id?: string; name: string; email: string; avatarUrl?: string }) => Promise<UserProfile>;
  switchUser: (userId: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  ensureDailyLuckYear: (year: number) => Promise<void>;
  getDailyLuckEntry: (date: Date) => DailyLuckEntry | null;
  ensureOwner: () => Promise<UserProfile>;
  syncFromStorage: () => Promise<void>;
}

const KEYS = {
  USERS: ALL_STORAGE_KEYS.USERS,
  CURRENT_USER: ALL_STORAGE_KEYS.CURRENT_USER,
} as const;

const DEFAULT_OWNER = {
  name: 'Player',
  email: 'player@easyseas.app',
  crownAnchorNumber: '',
  celebrityEmail: '',
  celebrityCaptainsClubNumber: '',
  celebrityCaptainsClubPoints: 0,
  celebrityBlueChipPoints: 0,
  preferredBrand: 'royal' as const,
  silverseaEmail: '',
  silverseaVenetianNumber: '',
  silverseaVenetianTier: '',
  silverseaVenetianPoints: 0,
  silverseaCasinoTier: '',
  silverseaCasinoPoints: 0,
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

function getScopedUserKeys(email: string | null) {
  return {
    USERS: getUserScopedKey(KEYS.USERS, email),
    CURRENT_USER: getUserScopedKey(KEYS.CURRENT_USER, email),
  } as const;
}

function createOwnerProfile(email: string | null): UserProfile {
  const now = new Date().toISOString();

  return {
    id: `user_${Date.now()}`,
    name: DEFAULT_OWNER.name,
    email: email ?? DEFAULT_OWNER.email,
    isOwner: true,
    crownAnchorNumber: DEFAULT_OWNER.crownAnchorNumber,
    celebrityEmail: DEFAULT_OWNER.celebrityEmail,
    celebrityCaptainsClubNumber: DEFAULT_OWNER.celebrityCaptainsClubNumber,
    celebrityCaptainsClubPoints: DEFAULT_OWNER.celebrityCaptainsClubPoints,
    celebrityBlueChipPoints: DEFAULT_OWNER.celebrityBlueChipPoints,
    preferredBrand: DEFAULT_OWNER.preferredBrand,
    silverseaEmail: DEFAULT_OWNER.silverseaEmail,
    silverseaVenetianNumber: DEFAULT_OWNER.silverseaVenetianNumber,
    silverseaVenetianTier: DEFAULT_OWNER.silverseaVenetianTier,
    silverseaVenetianPoints: DEFAULT_OWNER.silverseaVenetianPoints,
    silverseaCasinoTier: DEFAULT_OWNER.silverseaCasinoTier,
    silverseaCasinoPoints: DEFAULT_OWNER.silverseaCasinoPoints,
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizePlayingSession(session: unknown, index: number): PlayingSession | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const sessionRecord = session as Partial<PlayingSession>;
  const fallbackSession = DEFAULT_PLAYING_HOURS.sessions[index] ?? DEFAULT_PLAYING_HOURS.sessions[0];

  return {
    id: typeof sessionRecord.id === 'string' && sessionRecord.id.trim().length > 0 ? sessionRecord.id : `${fallbackSession.id}_${index}`,
    name: typeof sessionRecord.name === 'string' && sessionRecord.name.trim().length > 0 ? sessionRecord.name : fallbackSession.name,
    startTime: typeof sessionRecord.startTime === 'string' ? sessionRecord.startTime : fallbackSession.startTime,
    endTime: typeof sessionRecord.endTime === 'string' ? sessionRecord.endTime : fallbackSession.endTime,
    enabled: typeof sessionRecord.enabled === 'boolean' ? sessionRecord.enabled : fallbackSession.enabled,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeDailyLuckMap(value: unknown): Record<string, DailyLuckEntry> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sanitizedEntries: Record<string, DailyLuckEntry> = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (!isRecord(entry) || !isRecord(entry.readings)) {
      return;
    }

    const readings = entry.readings;
    const scoreBreakdown = isRecord(entry.scoreBreakdown) ? entry.scoreBreakdown : undefined;

    if (
      typeof entry.dateKey !== 'string' ||
      typeof entry.birthdate !== 'string' ||
      typeof entry.year !== 'number' ||
      typeof entry.generatedAt !== 'string' ||
      (entry.source !== 'ai' && entry.source !== 'fallback') ||
      typeof entry.westernSign !== 'string' ||
      typeof entry.chineseSign !== 'string' ||
      typeof entry.tarotCard !== 'string' ||
      typeof entry.luckNumber !== 'number' ||
      typeof entry.luckScore !== 'number' ||
      typeof readings.chinese !== 'string' ||
      typeof readings.western !== 'string' ||
      typeof readings.tarot !== 'string' ||
      typeof readings.synthesis !== 'string' ||
      (scoreBreakdown !== undefined && (
        typeof scoreBreakdown.chinese !== 'number' ||
        typeof scoreBreakdown.western !== 'number' ||
        typeof scoreBreakdown.tarot !== 'number'
      ))
    ) {
      return;
    }

    sanitizedEntries[key] = entry as unknown as DailyLuckEntry;
  });

  return Object.keys(sanitizedEntries).length > 0 ? sanitizedEntries : undefined;
}

function sanitizeDailyLuckYears(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const validYears = value
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    .sort((a, b) => a - b);

  return validYears.length > 0 ? Array.from(new Set(validYears)) : undefined;
}

function sanitizePlayingHours(value: unknown): PlayingHours | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const playingHours = value as Partial<PlayingHours>;
  const sessions = Array.isArray(playingHours.sessions)
    ? playingHours.sessions
        .map((session, index) => sanitizePlayingSession(session, index))
        .filter((session): session is PlayingSession => session !== null)
    : DEFAULT_PLAYING_HOURS.sessions;

  return {
    enabled: typeof playingHours.enabled === 'boolean' ? playingHours.enabled : DEFAULT_PLAYING_HOURS.enabled,
    startTime: typeof playingHours.startTime === 'string' ? playingHours.startTime : DEFAULT_PLAYING_HOURS.startTime,
    endTime: typeof playingHours.endTime === 'string' ? playingHours.endTime : DEFAULT_PLAYING_HOURS.endTime,
    preferSeaDayMorning: typeof playingHours.preferSeaDayMorning === 'boolean' ? playingHours.preferSeaDayMorning : DEFAULT_PLAYING_HOURS.preferSeaDayMorning,
    preferPortDayEvening: typeof playingHours.preferPortDayEvening === 'boolean' ? playingHours.preferPortDayEvening : DEFAULT_PLAYING_HOURS.preferPortDayEvening,
    sessions: sessions.length > 0 ? sessions : DEFAULT_PLAYING_HOURS.sessions,
  };
}

function sanitizeUserProfile(user: unknown, fallbackEmail: string | null, index: number): UserProfile | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const userRecord = user as Partial<UserProfile>;
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(userRecord.email) ?? fallbackEmail ?? DEFAULT_OWNER.email;

  return {
    id: typeof userRecord.id === 'string' && userRecord.id.trim().length > 0 ? userRecord.id : `user_${Date.now()}_${index}`,
    name: typeof userRecord.name === 'string' && userRecord.name.trim().length > 0 ? userRecord.name : DEFAULT_OWNER.name,
    email: normalizedEmail,
    isOwner: userRecord.isOwner === true,
    avatarUrl: typeof userRecord.avatarUrl === 'string' ? userRecord.avatarUrl : undefined,
    crownAnchorNumber: typeof userRecord.crownAnchorNumber === 'string' ? userRecord.crownAnchorNumber : DEFAULT_OWNER.crownAnchorNumber,
    birthdate: typeof userRecord.birthdate === 'string' ? userRecord.birthdate : undefined,
    dailyLuckByDate: sanitizeDailyLuckMap(userRecord.dailyLuckByDate),
    dailyLuckYears: sanitizeDailyLuckYears(userRecord.dailyLuckYears),
    dailyLuckLastGeneratedAt: typeof userRecord.dailyLuckLastGeneratedAt === 'string' ? userRecord.dailyLuckLastGeneratedAt : undefined,
    playingHours: sanitizePlayingHours(userRecord.playingHours),
    celebrityEmail: typeof userRecord.celebrityEmail === 'string' ? userRecord.celebrityEmail : DEFAULT_OWNER.celebrityEmail,
    celebrityCaptainsClubNumber: typeof userRecord.celebrityCaptainsClubNumber === 'string' ? userRecord.celebrityCaptainsClubNumber : DEFAULT_OWNER.celebrityCaptainsClubNumber,
    celebrityCaptainsClubPoints: typeof userRecord.celebrityCaptainsClubPoints === 'number' ? userRecord.celebrityCaptainsClubPoints : DEFAULT_OWNER.celebrityCaptainsClubPoints,
    celebrityBlueChipPoints: typeof userRecord.celebrityBlueChipPoints === 'number' ? userRecord.celebrityBlueChipPoints : DEFAULT_OWNER.celebrityBlueChipPoints,
    preferredBrand: userRecord.preferredBrand === 'royal' || userRecord.preferredBrand === 'celebrity' || userRecord.preferredBrand === 'silversea' || userRecord.preferredBrand === 'carnival'
      ? userRecord.preferredBrand
      : DEFAULT_OWNER.preferredBrand,
    silverseaEmail: typeof userRecord.silverseaEmail === 'string' ? userRecord.silverseaEmail : DEFAULT_OWNER.silverseaEmail,
    silverseaVenetianNumber: typeof userRecord.silverseaVenetianNumber === 'string' ? userRecord.silverseaVenetianNumber : DEFAULT_OWNER.silverseaVenetianNumber,
    silverseaVenetianTier: typeof userRecord.silverseaVenetianTier === 'string' ? userRecord.silverseaVenetianTier : DEFAULT_OWNER.silverseaVenetianTier,
    silverseaVenetianPoints: typeof userRecord.silverseaVenetianPoints === 'number' ? userRecord.silverseaVenetianPoints : DEFAULT_OWNER.silverseaVenetianPoints,
    silverseaCasinoTier: typeof userRecord.silverseaCasinoTier === 'string' ? userRecord.silverseaCasinoTier : DEFAULT_OWNER.silverseaCasinoTier,
    silverseaCasinoPoints: typeof userRecord.silverseaCasinoPoints === 'number' ? userRecord.silverseaCasinoPoints : DEFAULT_OWNER.silverseaCasinoPoints,
    carnivalVifpNumber: typeof userRecord.carnivalVifpNumber === 'string' ? userRecord.carnivalVifpNumber : '',
    carnivalVifpTier: typeof userRecord.carnivalVifpTier === 'string' ? userRecord.carnivalVifpTier : '',
    carnivalPlayersClubTier: typeof userRecord.carnivalPlayersClubTier === 'string' ? userRecord.carnivalPlayersClubTier : '',
    carnivalPlayersClubPoints: typeof userRecord.carnivalPlayersClubPoints === 'number' ? userRecord.carnivalPlayersClubPoints : 0,
    createdAt: typeof userRecord.createdAt === 'string' ? userRecord.createdAt : now,
    updatedAt: typeof userRecord.updatedAt === 'string' ? userRecord.updatedAt : now,
  };
}

function parseStoredUsers(rawValue: string | null, fallbackEmail: string | null): UserProfile[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      console.warn('[UserProvider] Stored users payload is not an array, ignoring invalid value');
      return [];
    }

    return parsedValue
      .map((user, index) => sanitizeUserProfile(user, fallbackEmail, index))
      .filter((user): user is UserProfile => user !== null);
  } catch (error) {
    console.error('[UserProvider] Failed to parse stored users payload:', error);
    return [];
  }
}

export const [UserProvider, useUser] = createContextHook((): UserState => {
  const { authenticatedEmail } = useAuth();
  const normalizedAuthenticatedEmail = normalizeEmail(authenticatedEmail);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCalculatingDailyLuck, setIsCalculatingDailyLuck] = useState<boolean>(false);
  const lastAuthenticatedEmailRef = useRef<string | null>(normalizedAuthenticatedEmail);
  const dailyLuckGenerationRef = useRef<Record<string, Promise<void>>>({});

  const currentUser = useMemo(() => {
    const resolvedUser = users.find((user) => user.id === currentUserId) || users.find((user) => user.isOwner) || null;

    if (!resolvedUser || !normalizedAuthenticatedEmail) {
      return resolvedUser;
    }

    const resolvedEmail = normalizeEmail(resolvedUser.email);
    if (resolvedEmail !== normalizedAuthenticatedEmail) {
      console.log('[UserProvider] Suppressing stale user during account transition:', {
        authenticatedEmail: normalizedAuthenticatedEmail,
        resolvedEmail,
        userId: resolvedUser.id,
      });
      return null;
    }

    return resolvedUser;
  }, [currentUserId, normalizedAuthenticatedEmail, users]);

  useEffect(() => {
    if (lastAuthenticatedEmailRef.current === normalizedAuthenticatedEmail) {
      return;
    }

    console.log('[UserProvider] Authenticated email changed, clearing in-memory user state:', {
      previousEmail: lastAuthenticatedEmailRef.current,
      nextEmail: normalizedAuthenticatedEmail,
    });

    lastAuthenticatedEmailRef.current = normalizedAuthenticatedEmail;
    setUsers([]);
    setCurrentUserId(null);
    setIsLoading(!!normalizedAuthenticatedEmail);
  }, [normalizedAuthenticatedEmail]);

  const persistUsers = useCallback(async (newUsers: UserProfile[]) => {
    const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);

    try {
      await AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(newUsers));
      console.log('[UserProvider] Persisted scoped users:', {
        email: normalizedAuthenticatedEmail,
        count: newUsers.length,
        key: scopedKeys.USERS,
      });
    } catch (error) {
      console.error('[UserProvider] Failed to persist scoped users:', error);
    }
  }, [normalizedAuthenticatedEmail]);

  const persistCurrentUser = useCallback(async (userId: string | null) => {
    const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);

    try {
      if (userId) {
        await AsyncStorage.setItem(scopedKeys.CURRENT_USER, userId);
      } else {
        await AsyncStorage.removeItem(scopedKeys.CURRENT_USER);
      }

      console.log('[UserProvider] Persisted scoped current user:', {
        email: normalizedAuthenticatedEmail,
        userId,
        key: scopedKeys.CURRENT_USER,
      });
    } catch (error) {
      console.error('[UserProvider] Failed to persist scoped current user:', error);
    }
  }, [normalizedAuthenticatedEmail]);

  const migrateLegacyUsersIfNeeded = useCallback(async (): Promise<{ migratedUsers: UserProfile[]; migratedCurrentUserId: string | null } | null> => {
    if (!normalizedAuthenticatedEmail) {
      return null;
    }

    try {
      const [legacyUsersRaw, legacyCurrentUserId] = await Promise.all([
        AsyncStorage.getItem(KEYS.USERS),
        AsyncStorage.getItem(KEYS.CURRENT_USER),
      ]);

      if (!legacyUsersRaw) {
        return null;
      }

      const parsedLegacyUsers = parseStoredUsers(legacyUsersRaw, normalizedAuthenticatedEmail);
      const matchingUsers = parsedLegacyUsers.filter((user) => normalizeEmail(user.email) === normalizedAuthenticatedEmail);

      if (matchingUsers.length === 0) {
        console.log('[UserProvider] Legacy user storage does not match authenticated email, skipping migration:', normalizedAuthenticatedEmail);
        return null;
      }

      const selectedCurrentUser = matchingUsers.find((user) => user.id === legacyCurrentUserId)
        || matchingUsers.find((user) => user.isOwner)
        || matchingUsers[0]
        || null;

      if (!selectedCurrentUser) {
        return null;
      }

      const migratedUsers = matchingUsers.map((user) => ({
        ...user,
        email: normalizeEmail(user.email) ?? normalizedAuthenticatedEmail,
        isOwner: user.id === selectedCurrentUser.id,
      }));

      const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);
      await Promise.all([
        AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(migratedUsers)),
        AsyncStorage.setItem(scopedKeys.CURRENT_USER, selectedCurrentUser.id),
      ]);

      console.log('[UserProvider] Migrated legacy profile data into scoped storage for:', normalizedAuthenticatedEmail);

      return {
        migratedUsers,
        migratedCurrentUserId: selectedCurrentUser.id,
      };
    } catch (error) {
      console.error('[UserProvider] Failed to migrate legacy user storage:', error);
      return null;
    }
  }, [normalizedAuthenticatedEmail]);

  const loadUsers = useCallback(async () => {
    if (!normalizedAuthenticatedEmail) {
      console.log('[UserProvider] No authenticated email, resetting scoped user state');
      setUsers([]);
      setCurrentUserId(null);
      setIsLoading(false);
      return;
    }

    const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);

    try {
      setIsLoading(true);
      console.log('[UserProvider] Loading scoped users from storage:', {
        email: normalizedAuthenticatedEmail,
        usersKey: scopedKeys.USERS,
        currentUserKey: scopedKeys.CURRENT_USER,
      });

      let [storedUsersRaw, storedCurrentUserId] = await Promise.all([
        AsyncStorage.getItem(scopedKeys.USERS),
        AsyncStorage.getItem(scopedKeys.CURRENT_USER),
      ]);

      if (!storedUsersRaw) {
        const migratedData = await migrateLegacyUsersIfNeeded();
        if (migratedData) {
          setUsers(migratedData.migratedUsers);
          setCurrentUserId(migratedData.migratedCurrentUserId);
          console.log('[UserProvider] Scoped user state restored from migrated legacy data');
          return;
        }
      }

      storedUsersRaw = storedUsersRaw ?? await AsyncStorage.getItem(scopedKeys.USERS);
      storedCurrentUserId = storedCurrentUserId ?? await AsyncStorage.getItem(scopedKeys.CURRENT_USER);

      if (storedUsersRaw) {
        const parsedUsers = parseStoredUsers(storedUsersRaw, normalizedAuthenticatedEmail);
        const normalizedUsers = parsedUsers.map((user) => ({
          ...user,
          email: normalizeEmail(user.email) ?? normalizedAuthenticatedEmail,
        }));

        const owner = normalizedUsers.find((user) => user.isOwner) ?? normalizedUsers[0] ?? null;
        const resolvedCurrentUserId = storedCurrentUserId && normalizedUsers.some((user) => user.id === storedCurrentUserId)
          ? storedCurrentUserId
          : owner?.id ?? null;

        setUsers(normalizedUsers);
        setCurrentUserId(resolvedCurrentUserId);

        if (resolvedCurrentUserId !== storedCurrentUserId) {
          await persistCurrentUser(resolvedCurrentUserId);
        }

        console.log('[UserProvider] Loaded scoped users:', {
          email: normalizedAuthenticatedEmail,
          count: normalizedUsers.length,
          currentUserId: resolvedCurrentUserId,
        });
        return;
      }

      const owner = createOwnerProfile(normalizedAuthenticatedEmail);
      const newUsers = [owner];
      setUsers(newUsers);
      setCurrentUserId(owner.id);
      await Promise.all([
        AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(newUsers)),
        AsyncStorage.setItem(scopedKeys.CURRENT_USER, owner.id),
      ]);

      console.log('[UserProvider] Created new scoped owner profile:', {
        email: normalizedAuthenticatedEmail,
        ownerId: owner.id,
      });
    } catch (error) {
      console.error('[UserProvider] Failed to load scoped users:', error);
      setUsers([]);
      setCurrentUserId(null);
    } finally {
      setIsLoading(false);
    }
  }, [migrateLegacyUsersIfNeeded, normalizedAuthenticatedEmail, persistCurrentUser]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const generateAndPersistDailyLuckYear = useCallback(async (
    userId: string,
    birthdate: string,
    year: number,
    sourceUsers?: UserProfile[],
  ): Promise<void> => {
    const generationKey = `${userId}:${birthdate}:${year}`;
    const existingGeneration = dailyLuckGenerationRef.current[generationKey];

    if (existingGeneration) {
      await existingGeneration;
      return;
    }

    const generationPromise = (async () => {
      setIsCalculatingDailyLuck(true);

      try {
        console.log('[UserProvider] Generating daily luck year:', {
          userId,
          birthdate,
          year,
        });

        const generatedEntries = await generateDailyLuckEntriesForYear(birthdate, year);
        if (Object.keys(generatedEntries).length === 0) {
          return;
        }

        const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);
        const storedUsersRaw = await AsyncStorage.getItem(scopedKeys.USERS);
        const baseUsers = storedUsersRaw
          ? parseStoredUsers(storedUsersRaw, normalizedAuthenticatedEmail)
          : (sourceUsers ?? users);

        const updatedUsers = baseUsers.map((user) => {
          if (user.id !== userId) {
            return user;
          }

          return {
            ...user,
            birthdate,
            dailyLuckByDate: {
              ...(user.dailyLuckByDate ?? {}),
              ...generatedEntries,
            },
            dailyLuckYears: Array.from(new Set([...(user.dailyLuckYears ?? []), year])).sort((a, b) => a - b),
            dailyLuckLastGeneratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

        await AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        console.log('[UserProvider] Daily luck year persisted:', {
          userId,
          year,
          totalEntries: Object.keys(generatedEntries).length,
        });
      } catch (error) {
        console.error('[UserProvider] Failed to generate daily luck year:', error);
      } finally {
        delete dailyLuckGenerationRef.current[generationKey];
        setIsCalculatingDailyLuck(false);
      }
    })();

    dailyLuckGenerationRef.current[generationKey] = generationPromise;
    await generationPromise;
  }, [normalizedAuthenticatedEmail, users]);

  const hasTransparentDailyLuckYear = useCallback((year: number): boolean => {
    if (!currentUser?.dailyLuckYears?.includes(year)) {
      return false;
    }

    const yearEntries = Object.values(currentUser.dailyLuckByDate ?? {}).filter((entry) => entry.year === year);
    if (yearEntries.length === 0) {
      return false;
    }

    return yearEntries.every((entry) => hasTransparentDailyLuckEntry(entry));
  }, [currentUser]);

  const ensureDailyLuckYear = useCallback(async (year: number): Promise<void> => {
    if (!currentUser?.id) {
      return;
    }

    const normalizedBirthdate = normalizeBirthdateInput(currentUser.birthdate);
    if (!normalizedBirthdate) {
      return;
    }

    if (hasTransparentDailyLuckYear(year)) {
      return;
    }

    await generateAndPersistDailyLuckYear(currentUser.id, normalizedBirthdate, year);
  }, [currentUser, generateAndPersistDailyLuckYear, hasTransparentDailyLuckYear]);

  const getDailyLuckEntry = useCallback((date: Date): DailyLuckEntry | null => {
    if (!currentUser) {
      return null;
    }

    const entry = currentUser.dailyLuckByDate?.[getDailyLuckDateKey(date)] ?? null;
    if (!entry || !hasTransparentDailyLuckEntry(entry)) {
      return null;
    }

    const earthRoosterEntry = getEarthRoosterLuck2026Entry(date);
    if (!earthRoosterEntry) {
      return entry;
    }

    console.log('[UserProvider] Applying Earth Rooster 2026 luck override to stored entry:', {
      dateKey: earthRoosterEntry.dateKey,
      storedLuckNumber: entry.luckNumber,
      overrideLuckNumber: earthRoosterEntry.luckNumber,
    });

    return {
      ...entry,
      tarotCard: 'Earth Rooster 2026',
      luckNumber: earthRoosterEntry.luckNumber,
      luckScore: Math.round((earthRoosterEntry.luckNumber / 9) * 100),
      readings: {
        ...entry.readings,
        tarot: earthRoosterEntry.description,
        synthesis: `Lucky Day # ${earthRoosterEntry.luckNumber}: ${earthRoosterEntry.color.charAt(0).toUpperCase()}${earthRoosterEntry.color.slice(1)} ${earthRoosterEntry.tone} Earth Rooster day.`,
      },
    };
  }, [currentUser]);

  useEffect(() => {
    const normalizedBirthdate = normalizeBirthdateInput(currentUser?.birthdate);
    const currentYear = new Date().getFullYear();

    if (!currentUser?.id || !normalizedBirthdate || hasTransparentDailyLuckYear(currentYear)) {
      return;
    }

    void generateAndPersistDailyLuckYear(currentUser.id, normalizedBirthdate, currentYear, users);
  }, [currentUser?.birthdate, currentUser?.id, generateAndPersistDailyLuckYear, hasTransparentDailyLuckYear, users]);

  const addUser = useCallback(async (user: { id?: string; name: string; email: string; avatarUrl?: string }): Promise<UserProfile> => {
    const now = new Date().toISOString();
    const normalizedEmail = normalizeEmail(user.email) ?? normalizedAuthenticatedEmail ?? DEFAULT_OWNER.email;

    const newUser: UserProfile = {
      id: user.id || `user_${Date.now()}`,
      name: user.name,
      email: normalizedEmail,
      avatarUrl: user.avatarUrl,
      isOwner: users.length === 0,
      createdAt: now,
      updatedAt: now,
    };

    const newUsers = [...users, newUser];
    setUsers(newUsers);
    await persistUsers(newUsers);

    if (!currentUserId) {
      setCurrentUserId(newUser.id);
      await persistCurrentUser(newUser.id);
    }

    console.log('[UserProvider] Added scoped user:', {
      authenticatedEmail: normalizedAuthenticatedEmail,
      userId: newUser.id,
      name: newUser.name,
    });

    return newUser;
  }, [currentUserId, normalizedAuthenticatedEmail, persistCurrentUser, persistUsers, users]);

  const switchUser = useCallback(async (userId: string) => {
    const user = users.find((candidate) => candidate.id === userId);

    if (!user) {
      return;
    }

    setCurrentUserId(userId);
    await persistCurrentUser(userId);
    console.log('[UserProvider] Switched scoped user:', {
      authenticatedEmail: normalizedAuthenticatedEmail,
      userId,
      name: user.name,
    });
  }, [normalizedAuthenticatedEmail, persistCurrentUser, users]);

  const removeUser = useCallback(async (userId: string) => {
    const user = users.find((candidate) => candidate.id === userId);

    if (user?.isOwner) {
      console.warn('[UserProvider] Cannot remove owner user');
      return;
    }

    const newUsers = users.filter((candidate) => candidate.id !== userId);
    const nextCurrentUser = currentUserId === userId ? (newUsers.find((candidate) => candidate.isOwner) ?? newUsers[0] ?? null) : null;

    setUsers(newUsers);
    await persistUsers(newUsers);

    if (nextCurrentUser) {
      setCurrentUserId(nextCurrentUser.id);
      await persistCurrentUser(nextCurrentUser.id);
    }

    console.log('[UserProvider] Removed scoped user:', {
      authenticatedEmail: normalizedAuthenticatedEmail,
      removedUserId: userId,
    });
  }, [currentUserId, normalizedAuthenticatedEmail, persistCurrentUser, persistUsers, users]);

  const updateUser = useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    try {
      const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);
      const storedUsersRaw = await AsyncStorage.getItem(scopedKeys.USERS);
      const inMemoryScopedUsers = users.filter((user) => normalizeEmail(user.email) === normalizedAuthenticatedEmail);
      let currentUsers: UserProfile[] = storedUsersRaw ? parseStoredUsers(storedUsersRaw, normalizedAuthenticatedEmail) : inMemoryScopedUsers;

      if (currentUsers.length === 0 && inMemoryScopedUsers.length > 0) {
        currentUsers = inMemoryScopedUsers;
      }

      const normalizedUpdates: Partial<UserProfile> = {
        ...updates,
        email: updates.email !== undefined ? (normalizeEmail(updates.email) ?? normalizedAuthenticatedEmail ?? DEFAULT_OWNER.email) : updates.email,
        birthdate: updates.birthdate !== undefined ? normalizeBirthdateInput(updates.birthdate) : updates.birthdate,
      };

      const existingUser = currentUsers.find((user) => user.id === userId) ?? null;
      const birthdateChanged = normalizedUpdates.birthdate !== undefined && normalizedUpdates.birthdate !== existingUser?.birthdate;

      const updatedUsers = currentUsers.map((user) => (
        user.id === userId
          ? {
              ...user,
              ...normalizedUpdates,
              ...(birthdateChanged
                ? {
                    dailyLuckByDate: undefined,
                    dailyLuckYears: undefined,
                    dailyLuckLastGeneratedAt: undefined,
                  }
                : {}),
              updatedAt: new Date().toISOString(),
            }
          : user
      ));

      await AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(updatedUsers));
      setUsers(updatedUsers);

      if (birthdateChanged && normalizedUpdates.birthdate) {
        void generateAndPersistDailyLuckYear(userId, normalizedUpdates.birthdate, new Date().getFullYear(), updatedUsers);
      }

      console.log('[UserProvider] Updated scoped user:', {
        authenticatedEmail: normalizedAuthenticatedEmail,
        userId,
        updatedFields: Object.keys(normalizedUpdates),
      });
    } catch (error) {
      console.error('[UserProvider] Failed to persist scoped user update:', error);
      setUsers((previousUsers) => previousUsers.map((user) => (
        user.id === userId
          ? {
              ...user,
              ...updates,
              email: updates.email !== undefined ? (normalizeEmail(updates.email) ?? normalizedAuthenticatedEmail ?? DEFAULT_OWNER.email) : user.email,
              birthdate: updates.birthdate !== undefined ? normalizeBirthdateInput(updates.birthdate) : user.birthdate,
              updatedAt: new Date().toISOString(),
            }
          : user
      )));
    }
  }, [generateAndPersistDailyLuckYear, normalizedAuthenticatedEmail, users]);

  const ensureOwner = useCallback(async (): Promise<UserProfile> => {
    const existingOwner = users.find((user) => {
      if (!user.isOwner) {
        return false;
      }

      if (!normalizedAuthenticatedEmail) {
        return true;
      }

      return normalizeEmail(user.email) === normalizedAuthenticatedEmail;
    });

    if (existingOwner) {
      if (!currentUserId) {
        setCurrentUserId(existingOwner.id);
        await persistCurrentUser(existingOwner.id);
      }

      return existingOwner;
    }

    const scopedKeys = getScopedUserKeys(normalizedAuthenticatedEmail);

    try {
      const storedUsersRaw = await AsyncStorage.getItem(scopedKeys.USERS);
      if (storedUsersRaw) {
        const parsedUsers = parseStoredUsers(storedUsersRaw, normalizedAuthenticatedEmail);
        const storedOwner = parsedUsers.find((user) => user.isOwner) ?? parsedUsers[0] ?? null;

        if (storedOwner) {
          setUsers(parsedUsers);
          setCurrentUserId(storedOwner.id);
          await persistCurrentUser(storedOwner.id);
          return storedOwner;
        }
      }
    } catch (error) {
      console.error('[UserProvider] Error checking scoped users for owner:', error);
    }

    const owner = createOwnerProfile(normalizedAuthenticatedEmail);
    const newUsers = [owner];
    setUsers(newUsers);
    setCurrentUserId(owner.id);
    await persistUsers(newUsers);
    await persistCurrentUser(owner.id);

    console.log('[UserProvider] Created scoped owner:', {
      authenticatedEmail: normalizedAuthenticatedEmail,
      ownerId: owner.id,
    });

    return owner;
  }, [currentUserId, normalizedAuthenticatedEmail, persistCurrentUser, persistUsers, users]);

  return useMemo(() => ({
    users,
    currentUserId,
    currentUser,
    isLoading,
    isCalculatingDailyLuck,
    addUser,
    switchUser,
    removeUser,
    updateUser,
    ensureDailyLuckYear,
    getDailyLuckEntry,
    ensureOwner,
    syncFromStorage: loadUsers,
  }), [
    users,
    currentUserId,
    currentUser,
    isLoading,
    isCalculatingDailyLuck,
    addUser,
    switchUser,
    removeUser,
    updateUser,
    ensureDailyLuckYear,
    getDailyLuckEntry,
    ensureOwner,
    loadUsers,
  ]);
});
