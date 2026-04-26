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
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EMAIL_WHITELIST);
      const localWhitelist = stored ? JSON.parse(stored) as string[] : [];
      let cloudWhitelist: string[] = [];

      try {
        const cloudResult = await trpcClient.access.getWhitelist.query();
        cloudWhitelist = cloudResult.whitelist;
        console.log('[AuthProvider] Loaded cloud whitelist:', { count: cloudWhitelist.length });
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud whitelist unavailable, using local whitelist:', cloudError);
      }

      const mergedWhitelist = mergeWhitelistEmails(localWhitelist, cloudWhitelist);
      await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(mergedWhitelist));
      return mergedWhitelist;
    } catch (error) {
      console.error('[AuthProvider] Failed loading whitelist:', error);
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
      await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));

      try {
        await trpcClient.access.addToWhitelist.mutate({ adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, email: normalizedEmail });
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud whitelist add failed after local save:', cloudError);
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
      await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));

      try {
        await trpcClient.access.removeFromWhitelist.mutate({ adminEmail: adminEmail ?? PRIMARY_ADMIN_EMAIL, email: normalizedEmail });
      } catch (cloudError) {
        console.warn('[AuthProvider] Cloud whitelist remove failed after local save:', cloudError);
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
    console.log('[AuthProvider] Logging out and clearing all user data...');
    await AsyncStorage.clear();
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
    setSubscriptionLevel(null);
    console.log('[AuthProvider] Logged out - all localStorage cleared');
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
