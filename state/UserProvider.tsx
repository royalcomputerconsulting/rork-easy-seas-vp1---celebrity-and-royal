import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useAuth } from "./AuthProvider";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";

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
  playingHours?: PlayingHours;
  celebrityEmail?: string;
  celebrityCaptainsClubNumber?: string;
  celebrityCaptainsClubPoints?: number;
  celebrityBlueChipPoints?: number;
  preferredBrand?: 'royal' | 'celebrity' | 'silversea';
  silverseaEmail?: string;
  silverseaVenetianNumber?: string;
  silverseaVenetianTier?: string;
  silverseaVenetianPoints?: number;
  createdAt: string;
  updatedAt: string;
}

interface UserState {
  users: UserProfile[];
  currentUserId: string | null;
  currentUser: UserProfile | null;
  isLoading: boolean;
  addUser: (user: { id?: string; name: string; email: string; avatarUrl?: string }) => Promise<UserProfile>;
  switchUser: (userId: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
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
    createdAt: now,
    updatedAt: now,
  };
}

export const [UserProvider, useUser] = createContextHook((): UserState => {
  const { authenticatedEmail } = useAuth();
  const normalizedAuthenticatedEmail = normalizeEmail(authenticatedEmail);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentUser = users.find((user) => user.id === currentUserId) || users.find((user) => user.isOwner) || null;

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

      const parsedLegacyUsers = JSON.parse(legacyUsersRaw) as UserProfile[];
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
        const parsedUsers = JSON.parse(storedUsersRaw) as UserProfile[];
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
      let currentUsers: UserProfile[] = storedUsersRaw ? JSON.parse(storedUsersRaw) as UserProfile[] : users;

      if (currentUsers.length === 0 && users.length > 0) {
        currentUsers = users;
      }

      const normalizedUpdates: Partial<UserProfile> = {
        ...updates,
        email: updates.email !== undefined ? (normalizeEmail(updates.email) ?? normalizedAuthenticatedEmail ?? DEFAULT_OWNER.email) : updates.email,
      };

      const updatedUsers = currentUsers.map((user) => (
        user.id === userId
          ? { ...user, ...normalizedUpdates, updatedAt: new Date().toISOString() }
          : user
      ));

      await AsyncStorage.setItem(scopedKeys.USERS, JSON.stringify(updatedUsers));
      setUsers(updatedUsers);

      console.log('[UserProvider] Updated scoped user:', {
        authenticatedEmail: normalizedAuthenticatedEmail,
        userId,
        updates: normalizedUpdates,
      });
    } catch (error) {
      console.error('[UserProvider] Failed to persist scoped user update:', error);
      setUsers((previousUsers) => previousUsers.map((user) => (
        user.id === userId
          ? {
              ...user,
              ...updates,
              email: updates.email !== undefined ? (normalizeEmail(updates.email) ?? normalizedAuthenticatedEmail ?? DEFAULT_OWNER.email) : user.email,
              updatedAt: new Date().toISOString(),
            }
          : user
      )));
    }
  }, [normalizedAuthenticatedEmail, users]);

  const ensureOwner = useCallback(async (): Promise<UserProfile> => {
    const existingOwner = users.find((user) => user.isOwner);

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
        const parsedUsers = JSON.parse(storedUsersRaw) as UserProfile[];
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
    addUser,
    switchUser,
    removeUser,
    updateUser,
    ensureOwner,
    syncFromStorage: loadUsers,
  }), [users, currentUserId, currentUser, isLoading, addUser, switchUser, removeUser, updateUser, ensureOwner, loadUsers]);
});
