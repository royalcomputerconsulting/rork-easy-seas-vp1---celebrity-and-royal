/**
 * Rollout controls for the Personal Certificate Optimization Engine.
 *
 * All flags default to false. Build 314 therefore continues to use the
 * existing static recommendation cards until a later checkpoint explicitly
 * enables the new authority after its data, safety, and parity gates pass.
 */
export type PersonalCertificateOptimizerFeatureFlags = Readonly<{
  personalCertificateOptimizerEnabled: boolean;
  personalCertificateOptimizerLiveAdvisorEnabled: boolean;
  personalCertificateOptimizerLearningEnabled: boolean;
}>;

export const DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS: PersonalCertificateOptimizerFeatureFlags = Object.freeze({
  personalCertificateOptimizerEnabled: false,
  personalCertificateOptimizerLiveAdvisorEnabled: false,
  personalCertificateOptimizerLearningEnabled: false,
});

const ENV_KEYS = Object.freeze({
  personalCertificateOptimizerEnabled: 'EXPO_PUBLIC_EASYSEAS_PERSONAL_CERTIFICATE_OPTIMIZER_ENABLED',
  personalCertificateOptimizerLiveAdvisorEnabled: 'EXPO_PUBLIC_EASYSEAS_PERSONAL_CERTIFICATE_OPTIMIZER_LIVE_ADVISOR_ENABLED',
  personalCertificateOptimizerLearningEnabled: 'EXPO_PUBLIC_EASYSEAS_PERSONAL_CERTIFICATE_OPTIMIZER_LEARNING_ENABLED',
} as const);

function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readEnvironmentValue(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[key];
}

export function getPersonalCertificateOptimizerFeatureFlags(
  overrides: Partial<PersonalCertificateOptimizerFeatureFlags> = {},
): PersonalCertificateOptimizerFeatureFlags {
  const defaults = DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS;
  const environmentFlags: PersonalCertificateOptimizerFeatureFlags = {
    personalCertificateOptimizerEnabled: parseBooleanFlag(
      readEnvironmentValue(ENV_KEYS.personalCertificateOptimizerEnabled),
      defaults.personalCertificateOptimizerEnabled,
    ),
    personalCertificateOptimizerLiveAdvisorEnabled: parseBooleanFlag(
      readEnvironmentValue(ENV_KEYS.personalCertificateOptimizerLiveAdvisorEnabled),
      defaults.personalCertificateOptimizerLiveAdvisorEnabled,
    ),
    personalCertificateOptimizerLearningEnabled: parseBooleanFlag(
      readEnvironmentValue(ENV_KEYS.personalCertificateOptimizerLearningEnabled),
      defaults.personalCertificateOptimizerLearningEnabled,
    ),
  };

  const optimizerEnabled = overrides.personalCertificateOptimizerEnabled
    ?? environmentFlags.personalCertificateOptimizerEnabled;

  return Object.freeze({
    personalCertificateOptimizerEnabled: optimizerEnabled,
    personalCertificateOptimizerLiveAdvisorEnabled: optimizerEnabled && (
      overrides.personalCertificateOptimizerLiveAdvisorEnabled
      ?? environmentFlags.personalCertificateOptimizerLiveAdvisorEnabled
    ),
    personalCertificateOptimizerLearningEnabled: optimizerEnabled && (
      overrides.personalCertificateOptimizerLearningEnabled
      ?? environmentFlags.personalCertificateOptimizerLearningEnabled
    ),
  });
}
