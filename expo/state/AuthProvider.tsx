import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { trpcClient } from "@/lib/trpc";
import {
  authenticateDeviceCredentialWithBiometrics,
  getDeviceCredentialMode,
  getDeviceCredentialRole,
  hasDeviceCredential,
  moveDeviceCredential,
  reserveLegacyOwner,
  verifyOrCreateDeviceCredential,
  type DeviceCredentialMode,
  type DeviceCredentialRole,
} from '@/lib/auth/deviceCredential';

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
const AUTH_BOOTSTRAP_TIMEOUT_MS = 3500;
const AUTH_BOOTSTRAP_WATCHDOG_MS = 4500;
const AUTH_CLOUD_REFRESH_TIMEOUT_MS = 6500;
const DEVICE_CREDENTIAL_TIMEOUT_MS = 1500;

function withAuthTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

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
  requiresCredentialEnrollment: boolean;
  login: (email: string, devicePin?: string) => Promise<boolean>;
  enrollDeviceCredential: (devicePin: string) => Promise<boolean>;
  getCredentialMode: (email: string) => Promise<DeviceCredentialMode>;
  unlockWithBiometrics: (email: string) => Promise<boolean>;
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
  const [requiresCredentialEnrollment, setRequiresCredentialEnrollment] = useState<boolean>(false);
  const authenticatedEmailRef = useRef<string | null>(null);

  useEffect(() => {
    authenticatedEmailRef.current = normalizeEmail(authenticatedEmail);
  }, [authenticatedEmail]);

  const getLocalWhitelistInternal = useCallback(async (): Promise<string[]> => {
    try {
      const [localWhitelist, pendingMutations] = await Promise.all([
        readStoredWhitelists(),
        readPendingWhitelistMutations(),
      ]);
      return applyPendingWhitelistMutations(localWhitelist, pendingMutations);
    } catch (error) {
      console.error('[AuthProvider] Failed loading local whitelist cache:', error);
      return [...ADMIN_EMAILS];
    }
  }, []);

  const getWhitelistInternal = useCallback(async (): Promise<string[]> => {
    const localWhitelist = await getLocalWhitelistInternal();

    try {
      return await withAuthTimeout((async () => {
        await flushPendingWhitelistMutations();
        const pendingMutations = await readPendingWhitelistMutations();
        const cloudResult = await trpcClient.access.getWhitelist.query();
        const mergedWhitelist = applyPendingWhitelistMutations(
          mergeWhitelistEmails(localWhitelist, cloudResult.whitelist),
          pendingMutations,
        );
        await writeGlobalWhitelist(mergedWhitelist);
        console.log('[AuthProvider] Loaded cloud global whitelist:', { count: cloudResult.whitelist.length });
        return mergedWhitelist;
      })(), AUTH_CLOUD_REFRESH_TIMEOUT_MS, '[AuthProvider] Cloud whitelist refresh');
    } catch (cloudError) {
      console.warn('[AuthProvider] Cloud global whitelist unavailable, using local global whitelist cache:', cloudError);
      return localWhitelist;
    }
  }, [getLocalWhitelistInternal]);

  const applyWhitelistState = useCallback((email: string | null, whitelist: string[]) => {
    const normalizedEmail = normalizeEmail(email);
    const whitelisted = !!normalizedEmail && whitelist.some((entry) => normalizeEmail(entry) === normalizedEmail);
    setIsWhitelisted(whitelisted);
    setSubscriptionLevel(whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
    return whitelisted;
  }, []);


  const checkAuthentication = useCallback(async () => {
    let bootstrapEmail: string | null = null;

    try {
      const [auth, email, freshStart, localWhitelist] = await withAuthTimeout(
        Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(AUTH_EMAIL_KEY),
          AsyncStorage.getItem(FRESH_START_KEY),
          getLocalWhitelistInternal(),
        ]),
        AUTH_BOOTSTRAP_TIMEOUT_MS,
        '[AuthProvider] Local authentication bootstrap',
      );

      bootstrapEmail = normalizeEmail(email);
      authenticatedEmailRef.current = bootstrapEmail;
      const authenticated = auth === 'true';
      let credentialPresent = false;
      let credentialRole: DeviceCredentialRole | null = null;
      if (bootstrapEmail) {
        try {
          const credentialState = await withAuthTimeout((async () => {
            const present = await hasDeviceCredential(bootstrapEmail);
            if (authenticated && !present) {
              // Preserve existing Build 394 installations and reserve their
              // local owner role until the user enrolls a device PIN.
              await reserveLegacyOwner(bootstrapEmail);
            }
            return {
              present,
              role: await getDeviceCredentialRole(bootstrapEmail),
            };
          })(), DEVICE_CREDENTIAL_TIMEOUT_MS, '[AuthProvider] Device credential bootstrap');
          credentialPresent = credentialState.present;
          credentialRole = credentialState.role;
        } catch (credentialError) {
          // Secure storage must never delay navigation. Existing authenticated
          // installations continue locally and can enroll from Settings later.
          console.warn('[AuthProvider] Device credential bootstrap unavailable; continuing legacy local session:', credentialError);
        }
      }
      const admin = authenticated && (credentialRole === 'owner' || (!credentialPresent && isAdminEmail(bootstrapEmail)));
      const whitelisted = applyWhitelistState(bootstrapEmail, localWhitelist);
      const authenticatedForThisLaunch = authenticated && !credentialPresent;

      setIsAuthenticated(authenticatedForThisLaunch);
      setRequiresCredentialEnrollment(authenticatedForThisLaunch && !!bootstrapEmail && !credentialPresent);
      setAuthenticatedEmail(bootstrapEmail);
      setIsFreshStart(freshStart === 'true');
      setIsAdmin(admin);
      console.log('[AuthProvider] Loaded local auth state without waiting for the network:', {
        authenticated: authenticatedForThisLaunch,
        email: bootstrapEmail,
        isAdmin: admin,
        deviceCredentialRequired: credentialPresent,
        isWhitelisted: whitelisted,
        subscriptionLevel: whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null,
      });
    } catch (error) {
      console.error('[AuthProvider] Local authentication bootstrap failed or timed out:', error);
      authenticatedEmailRef.current = null;
      setIsAuthenticated(false);
      setAuthenticatedEmail(null);
      setIsFreshStart(false);
      setIsAdmin(false);
      setIsWhitelisted(false);
      setSubscriptionLevel(null);
      setRequiresCredentialEnrollment(false);
    } finally {
      setIsLoading(false);
    }

    console.log('[AuthProvider] Startup completed using local authentication and access data only; no backend refresh was started.');
  }, [applyWhitelistState, getLocalWhitelistInternal]);

  const initializeAuth = useCallback(async () => {
    console.log('[AuthProvider] Initializing auth from local storage');
    await checkAuthentication();
  }, [checkAuthentication]);

  useEffect(() => {
    let settled = false;
    const watchdog = setTimeout(() => {
      if (!settled) {
        console.warn('[AuthProvider] Startup watchdog released the splash screen; local data will continue hydrating without blocking navigation.');
        setIsLoading(false);
      }
    }, AUTH_BOOTSTRAP_WATCHDOG_MS);

    void initializeAuth().finally(() => {
      settled = true;
      clearTimeout(watchdog);
    });

    return () => {
      settled = true;
      clearTimeout(watchdog);
    };
  }, [initializeAuth]);

  const getWhitelist = async (): Promise<string[]> => {
    return getWhitelistInternal();
  };

  const addToWhitelist = async (email: string): Promise<void> => {
    try {
      const adminEmail = normalizeEmail(authenticatedEmail);
      if (!isAdmin) {
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
      if (!isAdmin) {
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

  const completeLocalLogin = async (normalizedEmail: string, role: DeviceCredentialRole): Promise<boolean> => {
    const hasLaunchedBefore = await AsyncStorage.getItem(STORAGE_KEYS.HAS_LAUNCHED_BEFORE);
    const previousEmail = await AsyncStorage.getItem(AUTH_EMAIL_KEY);
    const isFirstEverLogin = !hasLaunchedBefore && !previousEmail;
    const isAccountSwitch = !!previousEmail && previousEmail.toLowerCase().trim() !== normalizedEmail;

    console.log('[AuthProvider] Secure local login context:', {
      normalizedEmail,
      previousEmail,
      hasLaunchedBefore: !!hasLaunchedBefore,
      isFirstEverLogin,
      isAccountSwitch,
      role,
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

    const localWhitelist = await getLocalWhitelistInternal();
    const whitelisted = localWhitelist.some((entry) => normalizeEmail(entry) === normalizedEmail);

    authenticatedEmailRef.current = normalizedEmail;
    setIsAuthenticated(true);
    setAuthenticatedEmail(normalizedEmail);
    setIsAdmin(role === 'owner');
    setIsWhitelisted(whitelisted);
    setSubscriptionLevel(whitelisted ? FREE_USE_SUBSCRIPTION_LEVEL : null);
    setRequiresCredentialEnrollment(false);
    console.log('[AuthProvider] Device-protected login completed from local state:', {
      email: normalizedEmail,
      role,
      isWhitelisted: whitelisted,
    });
    return true;
  };

  const login = async (email: string, devicePin?: string): Promise<boolean> => {
    const normalizedEmail = normalizeEmail(email) ?? '';
    
    if (!normalizedEmail || !email.includes('@')) {
      console.error('[AuthProvider] Invalid email format');
      return false;
    }

    const credentialResult = await verifyOrCreateDeviceCredential(normalizedEmail, devicePin ?? '');
    if (!credentialResult.success || !credentialResult.role) {
      console.warn('[AuthProvider] Device credential rejected:', {
        email: normalizedEmail,
        reason: credentialResult.error,
        retryAfterSeconds: credentialResult.retryAfterSeconds,
      });
      return false;
    }
    return completeLocalLogin(normalizedEmail, credentialResult.role);
  };

  const enrollDeviceCredential = async (devicePin: string): Promise<boolean> => {
    const normalizedEmail = normalizeEmail(authenticatedEmail) ?? '';
    if (!isAuthenticated || !normalizedEmail.includes('@')) return false;
    const result = await verifyOrCreateDeviceCredential(normalizedEmail, devicePin);
    if (!result.success || !result.role) return false;
    setIsAdmin(result.role === 'owner');
    setRequiresCredentialEnrollment(false);
    return true;
  };

  const unlockWithBiometrics = async (email: string): Promise<boolean> => {
    const normalizedEmail = normalizeEmail(email) ?? '';
    if (!normalizedEmail.includes('@')) return false;
    const result = await authenticateDeviceCredentialWithBiometrics(normalizedEmail);
    if (!result.success || !result.role) return false;
    return completeLocalLogin(normalizedEmail, result.role);
  };

  const updateEmail = async (newEmail: string) => {
    const normalizedEmail = normalizeEmail(newEmail) ?? '';
    const previousEmail = normalizeEmail(authenticatedEmail);
    console.log('[AuthProvider] Updating authenticated email to:', normalizedEmail);
    if (previousEmail && previousEmail !== normalizedEmail) {
      await moveDeviceCredential(previousEmail, normalizedEmail);
    }
    await AsyncStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
    const localWhitelist = await getLocalWhitelistInternal();
    const credentialRole = await getDeviceCredentialRole(normalizedEmail);
    authenticatedEmailRef.current = normalizedEmail;
    setAuthenticatedEmail(normalizedEmail);
    setIsAdmin(credentialRole === 'owner');
    applyWhitelistState(normalizedEmail, localWhitelist);
  };

  const logout = async () => {
    console.log('[AuthProvider] Logging out without deleting locally stored user data...');
    await AsyncStorage.multiRemove([
      AUTH_KEY,
      AUTH_EMAIL_KEY,
      FRESH_START_KEY,
      PENDING_ACCOUNT_SWITCH_KEY,
    ]);
    authenticatedEmailRef.current = null;
    setIsAuthenticated(false);
    setAuthenticatedEmail(null);
    setIsFreshStart(false);
    setIsAdmin(false);
    setIsWhitelisted(false);
    setSubscriptionLevel(null);
    setRequiresCredentialEnrollment(false);
    console.log('[AuthProvider] Logged out; all scoped cruises, offers, certificates, sessions, and settings were preserved');
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
    requiresCredentialEnrollment,
    login,
    enrollDeviceCredential,
    getCredentialMode: getDeviceCredentialMode,
    unlockWithBiometrics,
    logout,
    clearFreshStartFlag,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    isEmailWhitelisted,
    updateEmail,
  };
});
