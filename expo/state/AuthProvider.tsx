import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";

const ADMIN_PASSWORD = "a1";
const AUTH_KEY = "easyseas_authenticated";
const AUTH_EMAIL_KEY = "easyseas_auth_email";
const FRESH_START_KEY = "easyseas_fresh_start";
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";
const ADMIN_EMAILS = [
  'scott.merlis1@gmail.com',
  'dextretehkh@hotmail.sg',
] as const;
const DEFAULT_WHITELIST = [
  'scott.merlis1@gmail.com',
  'scott.merlis4@gmail.com',
  'hemispheredancer480@gmail.com',
  'jsp22008@yahoo.com',
  'jpence90@gmail.com',
  'hemispheredancer480@icloud.com',
  'scott.a.merlis1@gmail.com',
  'dextretehkh@hotmail.sg',
] as const;

export function normalizeAuthEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalizedEmail);
}

export function isValidAdminPassword(password: string | null | undefined): boolean {
  return password === ADMIN_PASSWORD;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isFreshStart: boolean;
  authenticatedEmail: string | null;
  isAdmin: boolean;
  isWhitelisted: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearSession: () => Promise<void>;
  clearFreshStartFlag: () => Promise<void>;
  getWhitelist: () => Promise<string[]>;
  addToWhitelist: (email: string) => Promise<void>;
  removeFromWhitelist: (email: string) => Promise<void>;
  isEmailWhitelisted: (email: string) => Promise<boolean>;
  updateEmail: (newEmail: string) => Promise<void>;
  isAdminEmailAddress: (email: string | null | undefined) => boolean;
  verifyAdminPassword: (password: string | null | undefined) => boolean;
}

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFreshStart, setIsFreshStart] = useState<boolean>(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);

  const isAdminEmailAddress = useCallback((email: string | null | undefined): boolean => {
    return isAdminEmail(email);
  }, []);

  const verifyAdminPassword = useCallback((password: string | null | undefined): boolean => {
    return isValidAdminPassword(password);
  }, []);

  const checkWhitelistStatus = useCallback(async (email: string | null): Promise<boolean> => {
    if (!email) return false;
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      if (!normalizedEmail) {
        return false;
      }

      if (isAdminEmail(normalizedEmail)) {
        return true;
      }

      const whitelist = await getWhitelistInternal();
      return whitelist.some(e => e.toLowerCase() === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist status:', error);
      return false;
    }
  }, []);

  const getWhitelistInternal = async (): Promise<string[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EMAIL_WHITELIST);
      const parsedWhitelist = stored ? (JSON.parse(stored) as unknown) : [];
      const existingWhitelist = Array.isArray(parsedWhitelist)
        ? parsedWhitelist
            .map((email) => (typeof email === 'string' ? normalizeAuthEmail(email) : null))
            .filter((email): email is string => email !== null)
        : [];

      const mergedWhitelist = Array.from(new Set([...existingWhitelist, ...DEFAULT_WHITELIST]));

      if (!stored || mergedWhitelist.length !== existingWhitelist.length) {
        await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(mergedWhitelist));
      }

      return mergedWhitelist;
    } catch {
      return [...DEFAULT_WHITELIST];
    }
  };

  const checkAuthentication = useCallback(async () => {
    try {
      const auth = await AsyncStorage.getItem(AUTH_KEY);
      const storedEmail = normalizeAuthEmail(await AsyncStorage.getItem(AUTH_EMAIL_KEY));
      const freshStart = await AsyncStorage.getItem(FRESH_START_KEY);
      const authenticated = auth === "true";
      const effectiveEmail = authenticated ? storedEmail : null;
      const effectiveFreshStart = authenticated && freshStart === "true";

      if (!authenticated && storedEmail) {
        console.warn('[AuthProvider] Found stale auth email without an active session. Clearing persisted auth email key:', storedEmail);
        await Promise.all([
          AsyncStorage.removeItem(AUTH_EMAIL_KEY),
          AsyncStorage.removeItem(FRESH_START_KEY),
          AsyncStorage.removeItem(PENDING_ACCOUNT_SWITCH_KEY),
        ]);
      }

      setIsAuthenticated(authenticated);
      setAuthenticatedEmail(effectiveEmail);
      setIsFreshStart(effectiveFreshStart);
      const adminStatus = isAdminEmail(effectiveEmail);
      setIsAdmin(adminStatus);

      const whitelisted = await checkWhitelistStatus(effectiveEmail);
      setIsWhitelisted(whitelisted);
      console.log('[AuthProvider] Loaded auth state:', {
        authenticated,
        storedEmail,
        effectiveEmail,
        hadStaleEmail: !authenticated && !!storedEmail,
        isAdmin: adminStatus,
        isWhitelisted: whitelisted,
      });
    } catch (error) {
      console.error("[AuthProvider] Error checking authentication:", error);
      setIsAuthenticated(false);
      setAuthenticatedEmail(null);
      setIsFreshStart(false);
      setIsAdmin(false);
      setIsWhitelisted(false);
    } finally {
      setIsLoading(false);
    }
  }, [checkWhitelistStatus]);

  const initializeAuth = useCallback(async () => {
    console.log('[AuthProvider] Initializing auth - checking persisted state');
    await checkAuthentication();
  }, [checkAuthentication]);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);



  const getWhitelist = useCallback(async (): Promise<string[]> => {
    return getWhitelistInternal();
  }, []);

  const addToWhitelist = useCallback(async (email: string): Promise<void> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = normalizeAuthEmail(email);
      if (!normalizedEmail) {
        return;
      }

      if (!whitelist.some(e => e.toLowerCase() === normalizedEmail)) {
        const updated = [...whitelist, normalizedEmail];
        await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));
        console.log('[AuthProvider] Added to whitelist:', normalizedEmail);
      }
    } catch (error) {
      console.error('[AuthProvider] Error adding to whitelist:', error);
      throw error;
    }
  }, [getWhitelist]);

  const removeFromWhitelist = useCallback(async (email: string): Promise<void> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = normalizeAuthEmail(email);
      if (!normalizedEmail) {
        return;
      }

      if (isAdminEmail(normalizedEmail)) {
        throw new Error('Cannot remove admin email from whitelist');
      }
      const updated = whitelist.filter(e => e.toLowerCase() !== normalizedEmail);
      await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));
      console.log('[AuthProvider] Removed from whitelist:', normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error removing from whitelist:', error);
      throw error;
    }
  }, [getWhitelist]);

  const isEmailWhitelisted = useCallback(async (email: string): Promise<boolean> => {
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      if (!normalizedEmail) {
        return false;
      }

      if (isAdminEmail(normalizedEmail)) {
        return true;
      }

      const whitelist = await getWhitelist();
      return whitelist.some(e => e.toLowerCase() === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist:', error);
      return false;
    }
  }, [getWhitelist]);

  const login = useCallback(async (email: string, password?: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail || !email.includes('@')) {
      console.error('[AuthProvider] Invalid email format');
      return false;
    }

    const isAdminAccount = isAdminEmail(normalizedEmail);
    
    if (isAdminAccount) {
      if (!verifyAdminPassword(password)) {
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
    console.log('[AuthProvider] Login successful for:', normalizedEmail, 'isAdmin:', isAdminAccount, 'isWhitelisted:', whitelisted);
    return true;
  }, [checkWhitelistStatus, verifyAdminPassword]);

  const updateEmail = useCallback(async (newEmail: string) => {
    const normalizedEmail = newEmail.toLowerCase().trim();
    console.log('[AuthProvider] Updating authenticated email to:', normalizedEmail);
    await AsyncStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
    setAuthenticatedEmail(normalizedEmail);
    setIsAdmin(isAdminEmail(normalizedEmail));
    const whitelisted = await checkWhitelistStatus(normalizedEmail);
    setIsWhitelisted(whitelisted);
  }, [checkWhitelistStatus]);

  const clearSession = useCallback(async () => {
    console.log('[AuthProvider] Clearing authentication session state...');
    await Promise.all([
      AsyncStorage.removeItem(AUTH_KEY),
      AsyncStorage.removeItem(AUTH_EMAIL_KEY),
      AsyncStorage.removeItem(FRESH_START_KEY),
      AsyncStorage.removeItem(PENDING_ACCOUNT_SWITCH_KEY),
    ]);
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
    console.log('[AuthProvider] Authentication session cleared');
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthProvider] Logging out and clearing all user data...');
    await AsyncStorage.clear();
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
    console.log('[AuthProvider] Logged out - all localStorage cleared');
  }, []);

  const clearFreshStartFlag = useCallback(async () => {
    await AsyncStorage.removeItem(FRESH_START_KEY);
    setIsFreshStart(false);
  }, []);

  return useMemo(() => ({
    isAuthenticated,
    isLoading,
    isFreshStart,
    authenticatedEmail,
    isAdmin,
    isWhitelisted,
    login,
    logout,
    clearSession,
    clearFreshStartFlag,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    isEmailWhitelisted,
    updateEmail,
    isAdminEmailAddress,
    verifyAdminPassword,
  }), [
    addToWhitelist,
    authenticatedEmail,
    clearFreshStartFlag,
    clearSession,
    getWhitelist,
    isAdmin,
    isAdminEmailAddress,
    isAuthenticated,
    isEmailWhitelisted,
    isFreshStart,
    isLoading,
    isWhitelisted,
    login,
    logout,
    removeFromWhitelist,
    updateEmail,
    verifyAdminPassword,
  ]);
});
