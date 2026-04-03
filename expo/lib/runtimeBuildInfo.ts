import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface LooseRecord {
  [key: string]: unknown;
}

export interface RuntimeBuildInfo {
  platform: string;
  executionEnvironment: string;
  appVersion: string;
  projectId: string;
  updateId: string;
  updateCreatedAt: string;
  runtimeVersion: string;
  fingerprint: string;
}

function asRecord(value: unknown): LooseRecord | null {
  if (typeof value === 'object' && value !== null) {
    return value as LooseRecord;
  }

  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function getRuntimeBuildInfo(layoutVersion?: string): RuntimeBuildInfo {
  const constantsRecord = Constants as unknown as {
    manifest2?: unknown;
    easConfig?: unknown;
    expoConfig?: unknown;
    executionEnvironment?: string | null;
  };

  const expoConfig = asRecord(constantsRecord.expoConfig ?? null);
  const manifest2 = asRecord(constantsRecord.manifest2 ?? null);
  const manifestMetadata = asRecord(manifest2?.metadata);
  const expoExtra = asRecord(expoConfig?.extra);
  const easConfig = asRecord(constantsRecord.easConfig ?? null) ?? asRecord(expoExtra?.eas);

  const executionEnvironment = asString(constantsRecord.executionEnvironment) ?? 'unknown';
  const appVersion = asString(expoConfig?.version) ?? 'unknown';
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? asString(easConfig?.projectId) ?? 'unknown';
  const updateId =
    asString(manifest2?.id) ??
    asString(manifestMetadata?.updateGroup) ??
    asString(manifestMetadata?.revisionId) ??
    'embedded';
  const updateCreatedAt = asString(manifest2?.createdAt) ?? 'embedded';
  const runtimeVersion =
    asString(manifest2?.runtimeVersion) ??
    asString(expoConfig?.runtimeVersion) ??
    'embedded';

  const fingerprintParts = [
    Platform.OS,
    executionEnvironment,
    `app:${appVersion}`,
    layoutVersion ? `layout:${layoutVersion}` : null,
    `update:${updateId}`,
  ].filter((value): value is string => Boolean(value));

  return {
    platform: Platform.OS,
    executionEnvironment,
    appVersion,
    projectId,
    updateId,
    updateCreatedAt,
    runtimeVersion,
    fingerprint: fingerprintParts.join(' • '),
  };
}
