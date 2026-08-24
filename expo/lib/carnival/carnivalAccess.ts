export interface CarnivalSyncAccessInput {
  isAuthenticated: boolean;
  isWhitelisted?: boolean;
  isAdmin?: boolean;
  authenticatedEmail?: string | null;
  platform?: string;
}

export interface CarnivalSyncAccess {
  enabled: boolean;
  eligible: boolean;
  nativeSupported: boolean;
  rolloutPercent: number;
  cohortBucket: number | null;
  reason?: 'disabled' | 'not_authenticated' | 'not_authorized' | 'outside_rollout' | 'unsupported_platform';
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseEnabled(value: string | undefined): boolean {
  if (value == null || value.trim() === '') return true;
  return !/^(0|false|off|disabled)$/i.test(value.trim());
}

function parseRollout(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function getCarnivalSyncAccess(
  input: CarnivalSyncAccessInput,
  env: Record<string, string | undefined> = process.env,
): CarnivalSyncAccess {
  const enabled = parseEnabled(env.EXPO_PUBLIC_CARNIVAL_SYNC_ENABLED);
  const rolloutPercent = parseRollout(env.EXPO_PUBLIC_CARNIVAL_SYNC_ROLLOUT_PERCENT);
  const email = String(input.authenticatedEmail || '').trim().toLowerCase();
  const authorized = Boolean(input.isWhitelisted || input.isAdmin);
  const nativeSupported = input.platform === 'ios' || input.platform === 'android';
  const cohortBucket = email ? hashText(email) % 100 : null;

  if (!enabled) {
    return { enabled, eligible: false, nativeSupported, rolloutPercent, cohortBucket, reason: 'disabled' };
  }
  if (!input.isAuthenticated || !email) {
    return { enabled, eligible: false, nativeSupported, rolloutPercent, cohortBucket, reason: 'not_authenticated' };
  }
  if (!authorized) {
    return { enabled, eligible: false, nativeSupported, rolloutPercent, cohortBucket, reason: 'not_authorized' };
  }
  if (cohortBucket == null || cohortBucket >= rolloutPercent) {
    return { enabled, eligible: false, nativeSupported, rolloutPercent, cohortBucket, reason: 'outside_rollout' };
  }
  if (!nativeSupported) {
    return { enabled, eligible: true, nativeSupported: false, rolloutPercent, cohortBucket, reason: 'unsupported_platform' };
  }
  return { enabled, eligible: true, nativeSupported: true, rolloutPercent, cohortBucket };
}

export function getCarnivalSyncAccessMessage(access: CarnivalSyncAccess): string {
  switch (access.reason) {
    case 'disabled':
      return 'Carnival sync is temporarily unavailable while EasySeas adapts to a Carnival website change.';
    case 'not_authenticated':
      return 'Sign in to EasySeas before starting Carnival sync.';
    case 'not_authorized':
      return 'This EasySeas account is not authorized to run data sync.';
    case 'outside_rollout':
      return `Carnival sync is currently available to ${access.rolloutPercent}% of eligible accounts during staged validation.`;
    case 'unsupported_platform':
      return 'Live Carnival extraction requires the EasySeas iOS or Android app. On web, import an existing Carnival CSV export instead.';
    default:
      return '';
  }
}
