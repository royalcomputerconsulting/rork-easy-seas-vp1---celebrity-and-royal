import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const CREDENTIAL_VERSION = 1 as const;
const CREDENTIAL_PREFIX = 'easyseas.device.credential.v1.';
const FAILURE_PREFIX = 'easyseas.device.failures.v1.';
const OWNER_KEY = 'easyseas.device.owner.v1';
const WEB_SESSION_PREFIX = 'easyseas-web-preview:';
const MAX_FAILED_ATTEMPTS = 5;
const INITIAL_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

export type DeviceCredentialRole = 'owner' | 'member';
export type DeviceCredentialMode = 'create' | 'unlock';

interface DeviceCredentialRecord {
  version: typeof CREDENTIAL_VERSION;
  email: string;
  pin: string;
  role: DeviceCredentialRole;
  createdAt: string;
  updatedAt: string;
}

interface FailureRecord {
  attempts: number;
  blockedUntil: number;
}

export interface DeviceCredentialResult {
  success: boolean;
  created?: boolean;
  role?: DeviceCredentialRole;
  error?: 'invalid_pin' | 'incorrect_pin' | 'locked' | 'unavailable' | 'cancelled';
  retryAfterSeconds?: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function accountKey(email: string): string {
  const value = normalizeEmail(email);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function credentialKey(email: string): string {
  return `${CREDENTIAL_PREFIX}${accountKey(email)}`;
}

function failureKey(email: string): string {
  return `${FAILURE_PREFIX}${accountKey(email)}`;
}

function getWebSessionStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

async function readSecret(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return getWebSessionStorage()?.getItem(`${WEB_SESSION_PREFIX}${key}`) ?? null;
  }
  if (!(await SecureStore.isAvailableAsync())) return null;
  return SecureStore.getItemAsync(key);
}

async function writeSecret(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    getWebSessionStorage()?.setItem(`${WEB_SESSION_PREFIX}${key}`, value);
    return;
  }
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure device storage is unavailable.');
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function deleteSecret(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    getWebSessionStorage()?.removeItem(`${WEB_SESSION_PREFIX}${key}`);
    return;
  }
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
  }
}

function parseCredential(raw: string | null, email: string): DeviceCredentialRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DeviceCredentialRecord>;
    if (
      value.version !== CREDENTIAL_VERSION
      || normalizeEmail(value.email ?? '') !== normalizeEmail(email)
      || !/^\d{6}$/.test(value.pin ?? '')
      || (value.role !== 'owner' && value.role !== 'member')
    ) return null;
    return value as DeviceCredentialRecord;
  } catch {
    return null;
  }
}

function parseFailures(raw: string | null): FailureRecord {
  if (!raw) return { attempts: 0, blockedUntil: 0 };
  try {
    const value = JSON.parse(raw) as Partial<FailureRecord>;
    return {
      attempts: Number.isFinite(value.attempts) ? Math.max(0, Number(value.attempts)) : 0,
      blockedUntil: Number.isFinite(value.blockedUntil) ? Math.max(0, Number(value.blockedUntil)) : 0,
    };
  } catch {
    return { attempts: 0, blockedUntil: 0 };
  }
}

function pinsMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function readCredential(email: string): Promise<DeviceCredentialRecord | null> {
  return parseCredential(await readSecret(credentialKey(email)), email);
}

async function readOwnerEmail(): Promise<string | null> {
  const owner = await readSecret(OWNER_KEY);
  return owner ? normalizeEmail(owner) : null;
}

async function assignRole(email: string): Promise<DeviceCredentialRole> {
  const normalizedEmail = normalizeEmail(email);
  const ownerEmail = await readOwnerEmail();
  if (!ownerEmail) {
    await writeSecret(OWNER_KEY, normalizedEmail);
    return 'owner';
  }
  return ownerEmail === normalizedEmail ? 'owner' : 'member';
}

async function recordFailure(email: string, previous: FailureRecord): Promise<FailureRecord> {
  const attempts = previous.attempts + 1;
  const lockoutLevel = Math.max(0, attempts - MAX_FAILED_ATTEMPTS);
  const blockedUntil = attempts >= MAX_FAILED_ATTEMPTS
    ? Date.now() + Math.min(MAX_LOCKOUT_MS, INITIAL_LOCKOUT_MS * (2 ** lockoutLevel))
    : 0;
  const next = { attempts, blockedUntil };
  await writeSecret(failureKey(email), JSON.stringify(next));
  return next;
}

export async function getDeviceCredentialMode(email: string): Promise<DeviceCredentialMode> {
  return (await readCredential(email)) ? 'unlock' : 'create';
}

export async function hasDeviceCredential(email: string): Promise<boolean> {
  return Boolean(await readCredential(email));
}

export async function reserveLegacyOwner(email: string): Promise<void> {
  if (!normalizeEmail(email)) return;
  if (!(await readOwnerEmail())) {
    await writeSecret(OWNER_KEY, normalizeEmail(email));
  }
}

export async function getDeviceCredentialRole(email: string): Promise<DeviceCredentialRole | null> {
  const credential = await readCredential(email);
  if (credential) return credential.role;
  return (await readOwnerEmail()) === normalizeEmail(email) ? 'owner' : null;
}

export async function verifyOrCreateDeviceCredential(email: string, pin: string): Promise<DeviceCredentialResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes('@') || !/^\d{6}$/.test(pin)) {
    return { success: false, error: 'invalid_pin' };
  }

  const failures = parseFailures(await readSecret(failureKey(normalizedEmail)));
  if (failures.blockedUntil > Date.now()) {
    return {
      success: false,
      error: 'locked',
      retryAfterSeconds: Math.max(1, Math.ceil((failures.blockedUntil - Date.now()) / 1000)),
    };
  }

  const existing = await readCredential(normalizedEmail);
  if (existing) {
    if (!pinsMatch(existing.pin, pin)) {
      const next = await recordFailure(normalizedEmail, failures.blockedUntil > 0 ? { attempts: 0, blockedUntil: 0 } : failures);
      return {
        success: false,
        error: next.blockedUntil > Date.now() ? 'locked' : 'incorrect_pin',
        retryAfterSeconds: next.blockedUntil > Date.now() ? Math.ceil((next.blockedUntil - Date.now()) / 1000) : undefined,
      };
    }
    await deleteSecret(failureKey(normalizedEmail));
    return { success: true, created: false, role: existing.role };
  }

  const now = new Date().toISOString();
  const role = await assignRole(normalizedEmail);
  const record: DeviceCredentialRecord = {
    version: CREDENTIAL_VERSION,
    email: normalizedEmail,
    pin,
    role,
    createdAt: now,
    updatedAt: now,
  };
  await writeSecret(credentialKey(normalizedEmail), JSON.stringify(record));
  await deleteSecret(failureKey(normalizedEmail));
  return { success: true, created: true, role };
}

export async function isBiometricUnlockAvailable(email: string): Promise<boolean> {
  if (Platform.OS === 'web' || !(await hasDeviceCredential(email))) return false;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

export async function authenticateDeviceCredentialWithBiometrics(email: string): Promise<DeviceCredentialResult> {
  const credential = await readCredential(email);
  if (!credential || !(await isBiometricUnlockAvailable(email))) {
    return { success: false, error: 'unavailable' };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Easy Seas',
    promptSubtitle: 'Protect your reservations, loyalty, and casino records',
    fallbackLabel: 'Use Device Passcode',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  if (!result.success) return { success: false, error: 'cancelled' };
  await deleteSecret(failureKey(email));
  return { success: true, created: false, role: credential.role };
}

export async function moveDeviceCredential(oldEmail: string, newEmail: string): Promise<void> {
  const existing = await readCredential(oldEmail);
  if (!existing) return;
  const normalizedNewEmail = normalizeEmail(newEmail);
  const moved: DeviceCredentialRecord = {
    ...existing,
    email: normalizedNewEmail,
    updatedAt: new Date().toISOString(),
  };
  await writeSecret(credentialKey(normalizedNewEmail), JSON.stringify(moved));
  await deleteSecret(credentialKey(oldEmail));
  await deleteSecret(failureKey(oldEmail));
  if ((await readOwnerEmail()) === normalizeEmail(oldEmail)) {
    await writeSecret(OWNER_KEY, normalizedNewEmail);
  }
}

