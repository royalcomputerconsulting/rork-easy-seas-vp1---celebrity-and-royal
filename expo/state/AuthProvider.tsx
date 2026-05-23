import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { trpcClient } from "@/lib/trpc";

const ADMIN_PASSWORD = "a1";
const AUTH_KEY = "easyseas_authenticated";
const AUTH_EMAIL_KEY = "easyseas_auth_email";
const FRESH_START_KEY = "easyseas_fresh_start";
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";
export const ADMIN_EMAILS = ["scott.merlis1@gmail.com", "s@a.com"] as const;
const PRIMARY_ADMIN_EMAIL = ADMIN_EMAILS[0];
const FREE_USE_SUBSCRIPTION_LEVEL = "Free Use of App" as const;
const GLOBAL_WHITELIST_KEY = STORAGE_KEYS.EMAIL_WHITELIST_GLOBAL;
const LEGACY_WHITELIST_KEY = STORAGE_KEYS.EMAIL_WHITELIST;
const PENDING_WHITELIST_SYNC_KEY = STORAGE_KEYS.EMAIL_WHITELIST_PENDING;
const WHITELIST_STORAGE_KEYS = [GLOBAL_WHITELIST_KEY, LEGACY_WHITELIST_KEY] as const;
type WhitelistPendingAction = 'add' | 'remove';

interface WhitelistPendingMutation {
  email: string;
  action: WhitelistPendingAction;
  adminEmail: string;
  createdAt: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isFreshStart: boolean;
  authenticatedEmail: string | null;
  isAdmin: boolean;
  isWhitelisted: boolean;
  subscriptionLevel: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearFreshStartFlag: () => Promise<void>;
  getWhitelist: () => Promise<string[]>;
  addToWhitelist: (email: string) => Promise<void>;
  removeFromWhitelist: (email: string) => Promise<void>;
  isEmailWhitelisted: (email: string) => Promise<boolean>;
  updateEmail: (newEmail: string) => Promise<void>;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

function isAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  return !!normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail as typeof ADMIN_EMAILS[number]);
}

function mergeWhitelistEmails(...lists: string[][]): string[] {
  const merged = new Set<string>(ADMIN_EMAILS);
  lists.flat().forEach((email) => {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail?.includes('@')) {
      merged.add(normalizedEmail);
    }
  });
  return Array.from(merged).sort();
}

function parseWhitelist(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((email): email is string => typeof email === 'string');
  } catch (error) {
    console.error('[AuthProvider] Failed parsing stored whitelist:', error);
    return [];
  }
}

async function writeGlobalWhitelist(whitelist: string[]): Promise<void> {
  const mergedWhitelist = mergeWhitelistEmails(whitelist);
  const payload = JSON.stringify(mergedWhitelist);
  await Promise.all(WHITELIST_STORAGE_KEYS.map((key) => AsyncStorage.setItem(key, payload)));
  console.log('[AuthProvider] Persisted global whitelist cache:', { count: mergedWhitelist.length, keys: WHITELIST_STORAGE_KEYS });
}

async function readStoredWhitelists(): Promise<string[]> {
  const storedValues = await Promise.all(WHITELIST_STORAGE_KEYS.map((key) => AsyncStorage.getItem(key)));
  return mergeWhitelistEmails(...storedValues.map(parseWhitelist));
}

function parsePendingWhitelistMutations(value: string | null): WhitelistPendingMutation[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is WhitelistPendingMutation => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      const mutation = entry as Partial<WhitelistPendingMutation>;
      return typeof mutation.email === 'string' && mutation.email.includes('@') && (mutation.action === 'add' || mutation.action === 'remove') && typeof mutation.adminEmail === 'string' && mutation.adminEmail.includes('@') && typeof mutation.createdAt === 'string';
    });
  } catch (error) {
    console.error('[AuthProvider] Failed parsing pending global whitelist sync queue:', error);
    return [];
  }
}

async function readPendingWhitelistMutations(): Promise<WhitelistPendingMutation[]> {
  return parsePendingWhitelistMutations(await AsyncStorage.getItem(PENDING_WHITELIST_SYNC_KEY));
}

async function writePendingWhitelistMutations(mutations: WhitelistPendingMutation[]): Promise<void> {
  const byEmail = new Map<string, WhitelistPendingMutation>();
  mutations.forEach((mutation) => {
    const normalizedEmail = normalizeEmail(mutation.email);
    const normalizedAdminEmail = normalizeEmail(mutation.adminEmail);
    if (normalizedEmail?.includes('@') && normalizedAdminEmail?.includes('@')) {
      byEmail.set(normalizedEmail, {
        email: normalizedEmail,
        action: mutation.action,
        adminEmail: normalizedAdminEmail,
        createdAt: mutation.createdAt,
      });
    }
  });
  const normalizedMutations = Array.from(byEmail.values());
  if (normalizedMutations.length === 0) {
    await AsyncStorage.removeItem(PENDING_WHITELIST_SYNC_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_WHITELIST_SYNC_KEY, JSON.stringify(normalizedMutations));
}

async function queueWhitelistMutation(mutation: WhitelistPendingMutation): Promise<void> {
  const pending = await readPendingWhitelistMutations();
  await writePendingWhitelistMutations([...pending, mutation]);
  console.log('[AuthProvider] Queued global whitelist sync mutation:', { email: mutation.email, action: mutation.action });
}

async function removeQueuedWhitelistMutation(email: string, action: WhitelistPendingAction): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }
  const pending = await readPendingWhitelistMutations();
  await writePendingWhitelistMutations(pending.filter((mutation) => !(normalizeEmail(mutation.email) === normalizedEmail && mutation.action === action)));
}

function applyPendingWhitelistMutations(whitelist: string[], pending: WhitelistPendingMutation[]): string[] {
  const merged = new Set<string>(mergeWhitelistEmails(whitelist));
  pending.forEach((mutation) => {
    const normalizedEmail = normalizeEmail(mutation.email);
    if (!normalizedEmail?.includes('@')) {
      return;
    }
    if (mutation.action === 'remove' && !isAdminEmail(normalizedEmail)) {
      merged.delete(normalizedEmail);
      return;
    }
    if (mutation.action === 'add') {
      merged.add(normalizedEmail);
    }
  });
  ADMIN_EMAILS.forEach((adminEmail) => merged.add(adminEmail));
  return Array.from(merged).sort();
}

async function flushPendingWhitelistMutations(): Promise<void> {
  const pending = await readPendingWhitelistMutations();
  if (pending.length === 0) {
    return;
  }

  const remaining: WhitelistPendingMutation[] = [];
  for (const mutation of pending) {
    try {
      if (mutation.action === 'add') {
        await trpcClient.access.addToWhitelist.mutate({ adminEmail: mutation.adminEmail, email: mutation.email });
      } else {
        await trpcClient.access.removeFromWhitelist.mutate({ adminEmail: mutation.adminEmail, email: mutation.email });
      }
      console.log('[AuthProvider] Flushed global whitelist sync mutation:', { email: mutation.email, action: mutation.action });
    } catch (error) {
      console.warn('[AuthProvider] Global whitelist sync mutation still pending:', { email: mutation.email, action: mutation.action, error });
      remaining.push(mutation);
    }
  }

  await writePendingWhitelistMutations(remaining);
}

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFreshStart, setIsFreshStart] = useState<boolean>(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [subscriptionLevel, setSubscriptionLevel] = useState<string | null>(null);

  const checkWhitelistStatus = useCallback(async (email: string | null): Promise<boolean> => {
    if (!email) return false;
    try {
      const whitelist = await getWhitelistInternal();
      const normalizedEmail = normalizeEmail(email);
      return !!normalizedEmail && whitelist.some(e => normalizeEmail(e) === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist status:', error);
      return false;
    }
  }, []);

  const getWhitelistInternal = async (): Promise<string[]> => {
    try {
      const localWhitelist = await readStoredWhitelists();
      await flushPendingWhitelistMutations();
      const pendingMutations = await readPendingWhitelistMutations();
      let cloudWhitelist: string[] = [];

      try {
        const cloudResult = await trpcClient.access.getWhitelist.query();
        cloudWhitelist = cloudResult.whitelist;
        console.log('[AuthProvider] Loaded cloud global whitelist:', { count: cloudWhitelist.length });
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud global whitelist unavailable, using local global whitelist cache:', cloudError);
      }

      const mergedWhitelist = applyPendingWhitelistMutations(mergeWhitelistEmails(localWhitelist, cloudWhitelist), pendingMutations);
      await writeGlobalWhitelist(mergedWhitelist);
      return mergedWhitelist;
    } catch (error) {
      console.error('[AuthProvider] Failed loading global whitelist:', error);
      return [...ADMIN_EMAILS];
    }
  };

  const checkAuthentication = useCallback(async () => {
    try {
      const auth = await AsyncStorage.getItem(AUTH_KEY);
      const email = await AsyncStorage.getItem(AUTH_EMAIL_KEY);
      const freshStart = await AsyncStorage.getItem(FRESH_START_KEY);
      setIsAuthenticated(auth === "true");
      setAuthenticatedEmail(email);
      setIsFreshStart(freshStart === "true");
      const admin = isAdminEmail(email);
      setIsAdmin(admin);
      
      const whitelisted = await checkWhitelistStatus(email);
      setIsWhitelisted(whitelisted);
      setSubscriptionLevel(whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
      console.log('[AuthProvider] Loaded auth state:', { authenticated: auth === "true", email, isAdmin: admin, isWhitelisted: whitelisted, subscriptionLevel: whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null });
    } catch (error) {
      console.error("[AuthProvider] Error checking authentication:", error);
      setIsAuthenticated(false);
      setAuthenticatedEmail(null);
      setIsFreshStart(false);
      setIsAdmin(false);
      setIsWhitelisted(false);
      setSubscriptionLevel(null);
    } finally {
      setIsLoading(false);
    }
  }, [checkWhitelistStatus]);

  const initializeAuth = useCallback(async () => {
    console.log('[AuthProvider] Initializing auth - checking persisted state');
    await checkAuthentication();
  }, [checkAuthentication]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);



  const getWhitelist = async (): Promise<string[]> => {
    return getWhitelistInternal();
  };

  const addToWhitelist = async (email: string): Promise<void> => {
    try {
      const adminEmail = normalizeEmail(authenticatedEmail);
      if (!isAdminEmail(adminEmail)) {
        throw new Error('Only the admin account can manage free-use access.');
      }

      const whitelist = await getWhitelist();
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail?.includes('@')) {
        throw new Error('Invalid email address');
      }

      const updated = mergeWhitelistEmails(whitelist, [normalizedEmail]);
      await writeGlobalWhitelist(updated);
      await queueWhitelistMutation({ email: normalizedEmail, action: 'add', adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, createdAt: new Date().toISOString() });

      try {
        await trpcClient.access.addToWhitelist.mutate({ adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, email: normalizedEmail });
        await removeQueuedWhitelistMutation(normalizedEmail, 'add');
        console.log('[AuthProvider] Cloud global whitelist add confirmed:', normalizedEmail);
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud global whitelist add pending retry:', cloudError);
      }

      if (normalizeEmail(authenticatedEmail) === normalizedEmail) {
        setIsWhitelisted(true);
        setSubscriptionLevel(FREE_USE_SUBSCRIPTION_LEVEL);
      }
      console.log('[AuthProvider] Added to whitelist:', { email: normalizedEmail, subscriptionLevel: FREE_USE_SUBSCRIPTION_LEVEL });
    } catch (error) {
      console.error('[AuthProvider] Error adding to whitelist:', error);
      throw error;
    }
  };

  const removeFromWhitelist = async (email: string): Promise<void> => {
    try {
      const adminEmail = normalizeEmail(authenticatedEmail);
      if (!isAdminEmail(adminEmail)) {
        throw new Error('Only the admin account can manage free-use access.');
      }

      const whitelist = await getWhitelist();
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        throw new Error('Invalid email address');
      }
      if (isAdminEmail(normalizedEmail)) {
        throw new Error('Cannot remove admin email from whitelist');
      }
      const updated = mergeWhitelistEmails(whitelist.filter(e => normalizeEmail(e) !== normalizedEmail));
      await writeGlobalWhitelist(updated);
      await queueWhitelistMutation({ email: normalizedEmail, action: 'remove', adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, createdAt: new Date().toISOString() });

      try {
        await trpcClient.access.removeFromWhitelist.mutate({ adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, email: normalizedEmail });
        await removeQueuedWhitelistMutation(normalizedEmail, 'remove');
        console.log('[AuthProvider] Cloud global whitelist remove confirmed:', normalizedEmail);
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud global whitelist remove pending retry:', cloudError);
      }

      if (normalizeEmail(authenticatedEmail) === normalizedEmail) {
        setIsWhitelisted(false);
        setSubscriptionLevel(null);
      }
      console.log('[AuthProvider] Removed from whitelist:', normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error removing from whitelist:', error);
      throw error;
    }
  };

  const isEmailWhitelisted = async (email: string): Promise<boolean> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = normalizeEmail(email);
      return !!normalizedEmail && whitelist.some(e => normalizeEmail(e) === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist:', error);
      return false;
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    const normalizedEmail = normalizeEmail(email) ?? '';
    
    if (!normalizedEmail || !email.includes('@')) {
      console.error('[AuthProvider] Invalid email format');
      return false;
    }

    const isAdminAccount = isAdminEmail(normalizedEmail);
    
    if (isAdminAccount) {
      if (password !== ADMIN_PASSWORD) {
        console.error('[AuthProvider] Invalid admin password');
        return false;
      }
      console.log('[AuthProvider] Admin login with correct password');
    } else {
      console.log('[AuthProvider] Regular user login (no password required):', normalizedEmail);
    }
    
    const hasLaunchedBefore = await AsyncStorage.getItem(STORAGE_KEYS.HAS_LAUNCHED_BEFORE);
    const previousEmail = await AsyncStorage.getItem(AUTH_EMAIL_KEY);
    const isFirstEverLogin = !hasLaunchedBefore && !previousEmail;

    const isAccountSwitch = !!previousEmail && previousEmail.toLowerCase().trim() !== normalizedEmail;

    console.log('[AuthProvider] Login context:', {
      normalizedEmail,
      previousEmail,
      hasLaunchedBefore: !!hasLaunchedBefore,
      isFirstEverLogin,
      isAccountSwitch,
    });

    await AsyncStorage.setItem(AUTH_KEY, "true");
    await AsyncStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);

    if (isAccountSwitch) {
      await AsyncStorage.setItem(PENDING_ACCOUNT_SWITCH_KEY, "true");
      console.log('[AuthProvider] Account switch detected - pending switch flag set');
    } else {
      await AsyncStorage.removeItem(PENDING_ACCOUNT_SWITCH_KEY);
    }

    if (isFirstEverLogin) {
      await AsyncStorage.setItem(FRESH_START_KEY, "true");
      setIsFreshStart(true);
      console.log('[AuthProvider] First-time user login - will trigger fresh start');
    } else {
      await AsyncStorage.removeItem(FRESH_START_KEY);
      setIsFreshStart(false);
      console.log('[AuthProvider] Returning user login - preserving data');
    }
    
    const whitelisted = await checkWhitelistStatus(normalizedEmail);
    
    setIsAuthenticated(true);
    setAuthenticatedEmail(normalizedEmail);
    setIsAdmin(isAdminAccount);
    setIsWhitelisted(whitelisted);
    setSubscriptionLevel(whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
    console.log('[AuthProvider] Login successful for:', normalizedEmail, 'isAdmin:', isAdminAccount, 'isWhitelisted:', whitelisted, 'subscriptionLevel:', whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
    return true;
  };

  const updateEmail = async (newEmail: string) => {
    const normalizedEmail = normalizeEmail(newEmail) ?? '';
    console.log('[AuthProvider] Updating authenticated email to:', normalizedEmail);
    await AsyncStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
    setAuthenticatedEmail(normalizedEmail);
    setIsAdmin(isAdminEmail(normalizedEmail));
    const whitelisted = await checkWhitelistStatus(normalizedEmail);
    setIsWhitelisted(whitelisted);
    setSubscriptionLevel(whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
  };

  const logout = async () => {
    console.log('[AuthProvider] Logging out and clearing local user data while preserving global free-use whitelist...');
    const globalWhitelist = await readStoredWhitelists();
    await AsyncStorage.clear();
    await writeGlobalWhitelist(globalWhitelist);
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
    setSubscriptionLevel(null);
    console.log('[AuthProvider] Logged out - local user data cleared and global whitelist restored');
  };

  const clearFreshStartFlag = async () => {
    await AsyncStorage.removeItem(FRESH_START_KEY);
    setIsFreshStart(false);
  };

  return {
    isAuthenticated,
    isLoading,
    isFreshStart,
    authenticatedEmail,
    isAdmin,
    isWhitelisted,
    subscriptionLevel,
    login,
    logout,
    clearFreshStartFlag,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    isEmailWhitelisted,
    updateEmail,
  };
});
