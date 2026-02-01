import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { Platform } from "react-native";

const ADMIN_PASSWORD = "a1";
const AUTH_KEY = "easyseas_authenticated";
const AUTH_EMAIL_KEY = "easyseas_auth_email";
const FRESH_START_KEY = "easyseas_fresh_start";
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";
const ADMIN_EMAIL = "scott.merlis1@gmail.com";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isFreshStart: boolean;
  authenticatedEmail: string | null;
  isAdmin: boolean;
  isWhitelisted: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearFreshStartFlag: () => Promise<void>;
  getWhitelist: () => Promise<string[]>;
  addToWhitelist: (email: string) => Promise<void>;
  removeFromWhitelist: (email: string) => Promise<void>;
  isEmailWhitelisted: (email: string) => Promise<boolean>;
}

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFreshStart, setIsFreshStart] = useState<boolean>(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);

  const checkWhitelistStatus = useCallback(async (email: string | null): Promise<boolean> => {
    if (!email) return false;
    try {
      const whitelist = await getWhitelistInternal();
      const normalizedEmail = email.toLowerCase().trim();
      return whitelist.some(e => e.toLowerCase() === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist status:', error);
      return false;
    }
  }, []);

  const getWhitelistInternal = async (): Promise<string[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EMAIL_WHITELIST);
      if (!stored) {
        const defaultWhitelist = [
          'scott.merlis1@gmail.com',
          'scott.merlis4@gmail.com',
          'hemispheredancer480@gmail.com',
          'jsp22008@yahoo.com',
          'jpence90@gmail.com',
          'hemispheredancer480@icloud.com',
          'scott.a.merlis1@gmail.com',
        ];
        await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(defaultWhitelist));
        return defaultWhitelist;
      }
      return JSON.parse(stored);
    } catch {
      return [ADMIN_EMAIL];
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
      setIsAdmin(email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      
      const whitelisted = await checkWhitelistStatus(email);
      setIsWhitelisted(whitelisted);
      console.log('[AuthProvider] Loaded auth state:', { authenticated: auth === "true", email, isAdmin: email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(), isWhitelisted: whitelisted });
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
    initializeAuth();
  }, [initializeAuth]);



  const getWhitelist = async (): Promise<string[]> => {
    return getWhitelistInternal();
  };

  const addToWhitelist = async (email: string): Promise<void> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = email.toLowerCase().trim();
      if (!whitelist.some(e => e.toLowerCase() === normalizedEmail)) {
        const updated = [...whitelist, normalizedEmail];
        await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));
        console.log('[AuthProvider] Added to whitelist:', normalizedEmail);
      }
    } catch (error) {
      console.error('[AuthProvider] Error adding to whitelist:', error);
      throw error;
    }
  };

  const removeFromWhitelist = async (email: string): Promise<void> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
        throw new Error('Cannot remove admin email from whitelist');
      }
      const updated = whitelist.filter(e => e.toLowerCase() !== normalizedEmail);
      await AsyncStorage.setItem(STORAGE_KEYS.EMAIL_WHITELIST, JSON.stringify(updated));
      console.log('[AuthProvider] Removed from whitelist:', normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error removing from whitelist:', error);
      throw error;
    }
  };

  const isEmailWhitelisted = async (email: string): Promise<boolean> => {
    try {
      const whitelist = await getWhitelist();
      const normalizedEmail = email.toLowerCase().trim();
      return whitelist.some(e => e.toLowerCase() === normalizedEmail);
    } catch (error) {
      console.error('[AuthProvider] Error checking whitelist:', error);
      return false;
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail || !email.includes('@')) {
      console.error('[AuthProvider] Invalid email format');
      return false;
    }

    const isAdminEmail = normalizedEmail === ADMIN_EMAIL.toLowerCase();
    
    if (isAdminEmail) {
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
    setIsAdmin(isAdminEmail);
    setIsWhitelisted(whitelisted);
    console.log('[AuthProvider] Login successful for:', normalizedEmail, 'isAdmin:', isAdminEmail, 'isWhitelisted:', whitelisted);
    return true;
  };

  const logout = async () => {
    console.log('[AuthProvider] Logging out and clearing all user data...');
    await AsyncStorage.clear();
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
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
    login,
    logout,
    clearFreshStartFlag,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    isEmailWhitelisted,
  };
});
