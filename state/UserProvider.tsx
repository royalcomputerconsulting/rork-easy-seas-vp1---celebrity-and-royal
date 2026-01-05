import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";

export interface PlayingHours {
  enabled: boolean;
  startTime: string; // HH:mm format e.g. "05:00"
  endTime: string;   // HH:mm format e.g. "07:30"
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
  preferredBrand?: 'royal' | 'celebrity';
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
  USERS: 'easyseas_users',
  CURRENT_USER: 'easyseas_current_user',
};

const DEFAULT_OWNER = {
  name: '',
  email: '',
  crownAnchorNumber: '',
  celebrityEmail: '',
  celebrityCaptainsClubNumber: '',
  celebrityCaptainsClubPoints: 0,
  celebrityBlueChipPoints: 0,
  preferredBrand: 'royal' as const,
};

export const [UserProvider, useUser] = createContextHook((): UserState => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = users.find(u => u.id === currentUserId) || null;

  const persistUsers = async (newUsers: UserProfile[]) => {
    try {
      await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(newUsers));
      console.log('[UserProvider] Persisted users:', newUsers.length);
    } catch (error) {
      console.error('[UserProvider] Failed to persist users:', error);
    }
  };

  const persistCurrentUser = async (userId: string | null) => {
    try {
      if (userId) {
        await AsyncStorage.setItem(KEYS.CURRENT_USER, userId);
      } else {
        await AsyncStorage.removeItem(KEYS.CURRENT_USER);
      }
      console.log('[UserProvider] Persisted current user:', userId);
    } catch (error) {
      console.error('[UserProvider] Failed to persist current user:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      console.log('[UserProvider] Loading users from storage...');
      
      const [storedUsers, storedCurrentUser] = await Promise.all([
        AsyncStorage.getItem(KEYS.USERS),
        AsyncStorage.getItem(KEYS.CURRENT_USER),
      ]);
      
      console.log('[UserProvider] Raw stored users:', storedUsers);
      console.log('[UserProvider] Raw stored current user:', storedCurrentUser);
      
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers) as UserProfile[];
        setUsers(parsed);
        console.log('[UserProvider] Loaded users:', parsed.length);
        console.log('[UserProvider] Loaded user data:', JSON.stringify(parsed.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber }))));
        
        // Validate current user exists in loaded users
        if (storedCurrentUser) {
          const userExists = parsed.some(u => u.id === storedCurrentUser);
          if (userExists) {
            setCurrentUserId(storedCurrentUser);
            console.log('[UserProvider] Loaded current user:', storedCurrentUser);
          } else {
            // Current user not found, set to first user or owner
            const owner = parsed.find(u => u.isOwner) || parsed[0];
            if (owner) {
              setCurrentUserId(owner.id);
              await AsyncStorage.setItem(KEYS.CURRENT_USER, owner.id);
              console.log('[UserProvider] Current user not found, defaulting to:', owner.id);
            }
          }
        } else if (parsed.length > 0) {
          // No current user set, default to owner
          const owner = parsed.find(u => u.isOwner) || parsed[0];
          setCurrentUserId(owner.id);
          await AsyncStorage.setItem(KEYS.CURRENT_USER, owner.id);
          console.log('[UserProvider] No current user, defaulting to:', owner.id);
        }
      } else {
        // No stored users found - create default owner
        console.log('[UserProvider] No stored users found, creating default owner...');
        const now = new Date().toISOString();
        const defaultOwner: UserProfile = {
          id: `user_${Date.now()}`,
          name: DEFAULT_OWNER.name,
          email: DEFAULT_OWNER.email,
          isOwner: true,
          crownAnchorNumber: DEFAULT_OWNER.crownAnchorNumber,
          celebrityEmail: DEFAULT_OWNER.celebrityEmail,
          celebrityCaptainsClubNumber: DEFAULT_OWNER.celebrityCaptainsClubNumber,
          celebrityCaptainsClubPoints: DEFAULT_OWNER.celebrityCaptainsClubPoints,
          celebrityBlueChipPoints: DEFAULT_OWNER.celebrityBlueChipPoints,
          preferredBrand: DEFAULT_OWNER.preferredBrand,
          createdAt: now,
          updatedAt: now,
        };
        
        const newUsers = [defaultOwner];
        setUsers(newUsers);
        setCurrentUserId(defaultOwner.id);
        await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(newUsers));
        await AsyncStorage.setItem(KEYS.CURRENT_USER, defaultOwner.id);
        console.log('[UserProvider] Created and persisted default owner:', defaultOwner.name, defaultOwner.id);
      }
    } catch (error) {
      console.error('[UserProvider] Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const addUser = async (user: { id?: string; name: string; email: string; avatarUrl?: string }): Promise<UserProfile> => {
    const now = new Date().toISOString();
    const newUser: UserProfile = {
      id: user.id || `user_${Date.now()}`,
      name: user.name,
      email: user.email.toLowerCase().trim(),
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

    console.log('[UserProvider] Added user:', newUser.name);
    return newUser;
  };

  const switchUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUserId(userId);
      await persistCurrentUser(userId);
      console.log('[UserProvider] Switched to user:', user.name);
    }
  };

  const removeUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.isOwner) {
      console.warn('[UserProvider] Cannot remove owner user');
      return;
    }

    const newUsers = users.filter(u => u.id !== userId);
    setUsers(newUsers);
    await persistUsers(newUsers);

    if (currentUserId === userId && newUsers.length > 0) {
      const owner = newUsers.find(u => u.isOwner) || newUsers[0];
      setCurrentUserId(owner.id);
      await persistCurrentUser(owner.id);
    }

    console.log('[UserProvider] Removed user:', userId);
  };

  const updateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      // First, get the current state of users from storage to ensure we have latest
      const storedUsers = await AsyncStorage.getItem(KEYS.USERS);
      let currentUsers: UserProfile[] = storedUsers ? JSON.parse(storedUsers) : users;
      
      // If storage is empty but we have users in state, use state
      if (currentUsers.length === 0 && users.length > 0) {
        currentUsers = users;
      }
      
      // Apply the updates
      const updatedUsers = currentUsers.map(u => 
        u.id === userId 
          ? { ...u, ...updates, updatedAt: new Date().toISOString() }
          : u
      );
      
      // Persist to storage FIRST
      await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(updatedUsers));
      console.log('[UserProvider] Persisted user update:', userId, 'with updates:', JSON.stringify(updates));
      console.log('[UserProvider] Stored users:', JSON.stringify(updatedUsers.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber }))));
      
      // Then update React state
      setUsers(updatedUsers);
    } catch (error) {
      console.error('[UserProvider] Failed to persist user update:', error);
      // Fallback: still update state even if storage fails
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === userId 
          ? { ...u, ...updates, updatedAt: new Date().toISOString() }
          : u
      ));
    }
  };

  const ensureOwner = async (): Promise<UserProfile> => {
    // Check in-memory state first to avoid unnecessary storage reads
    const owner = users.find(u => u.isOwner);
    if (owner) {
      if (!currentUserId) {
        setCurrentUserId(owner.id);
        await persistCurrentUser(owner.id);
      }
      return owner;
    }

    // Check stored users if not in memory
    try {
      const storedUsers = await AsyncStorage.getItem(KEYS.USERS);
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers) as UserProfile[];
        const existingOwner = parsed.find(u => u.isOwner);
        if (existingOwner) {
          // Only update state if it's actually different
          if (parsed.length !== users.length || !users.find(u => u.id === existingOwner.id)) {
            setUsers(parsed);
          }
          if (!currentUserId) {
            setCurrentUserId(existingOwner.id);
            await persistCurrentUser(existingOwner.id);
          }
          return existingOwner;
        }
      }
    } catch (error) {
      console.error('[UserProvider] Error checking stored users:', error);
    }

    // Create new owner with default values only if none exists
    const now = new Date().toISOString();
    const newOwner: UserProfile = {
      id: `user_${Date.now()}`,
      name: DEFAULT_OWNER.name,
      email: DEFAULT_OWNER.email,
      isOwner: true,
      crownAnchorNumber: DEFAULT_OWNER.crownAnchorNumber,
      celebrityEmail: DEFAULT_OWNER.celebrityEmail,
      celebrityCaptainsClubNumber: DEFAULT_OWNER.celebrityCaptainsClubNumber,
      celebrityCaptainsClubPoints: DEFAULT_OWNER.celebrityCaptainsClubPoints,
      celebrityBlueChipPoints: DEFAULT_OWNER.celebrityBlueChipPoints,
      preferredBrand: DEFAULT_OWNER.preferredBrand,
      createdAt: now,
      updatedAt: now,
    };

    const newUsers = [newOwner];
    setUsers(newUsers);
    setCurrentUserId(newOwner.id);
    await persistUsers(newUsers);
    await persistCurrentUser(newOwner.id);
    
    console.log('[UserProvider] Created owner:', newOwner.name, newOwner.id);
    return newOwner;
  };

  return {
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
  };
});
