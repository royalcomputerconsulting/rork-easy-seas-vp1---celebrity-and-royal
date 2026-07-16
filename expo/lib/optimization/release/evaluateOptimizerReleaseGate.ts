import {
  DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS,
  type PersonalCertificateOptimizerFeatureFlags,
} from '../featureFlags';
import { stableModelFingerprint } from '../models/statistics';
import type {
  OptimizerReleaseCheck,
  OptimizerReleaseGateInput,
  OptimizerReleaseGateSnapshot,
  OptimizerReleaseGateStatus,
} from './types';

export const PERSONAL_CERTIFICATE_OPTIMIZER_RELEASE_VERSION = 'opt10.0.0';

function check(
  id: string,
  label: string,
  passed: boolean,
  details: string,
  blocked = false,
): OptimizerReleaseCheck {
  return {
    id,
    label,
    status: passed ? 'pass' : blocked ? 'blocked' : 'fail',
    required: true,
    details,
  };
}

export function evaluateOptimizerReleaseGate(input: OptimizerReleaseGateInput): OptimizerReleaseGateSnapshot {
  const automatedChecks: OptimizerReleaseCheck[] = [
    check('automated-regression', 'Automated regression suite', input.automatedRegressionPassed, 'All executable regression tests must pass.'),
    check('scenario-matrix', 'Optimizer scenario matrix', input.scenarioMatrixPassed, 'Threshold, profit, loss, fatigue, missing-data, and rollback scenarios must pass.'),
    check('type-syntax', 'TypeScript/TSX syntax validation', input.typeSyntaxPassed, 'Every TypeScript and TSX source file must syntax-transpile.'),
    check('accessibility', 'Accessibility audit', input.accessibilityAuditPassed, 'Optimizer screens and alerts must expose non-color-only labels and readable states.'),
    check('protected-files', 'Protected-file hash verification', input.protectedFilesUnchanged, 'Package, lock, Expo, React Native, native, workflow, and deployment guard files must remain unchanged.'),
    check('profile-isolation', 'Profile and brand isolation', input.profileIsolationPassed, 'No recommendation, snapshot, or learning record may cross profile or brand boundaries.'),
    check('reproducibility', 'Deterministic reproducibility', input.deterministicReproducibilityPassed, 'Identical inputs and model versions must produce identical recommendations.'),
    check('rollback', 'Legacy rollback verification', input.rollbackVerified, 'The legacy-static recommendation path must remain available with optimizer flags disabled.'),
    check('privacy', 'Privacy and data-minimization review', input.privacyAuditPassed, 'Private identifiers and raw authentication material must not appear in optimizer exports or logs.'),
    check('archive-integrity', 'Release archive integrity', input.archiveIntegrityPassed, 'The independently extracted archive must retest successfully.'),
  ];

  const dataChecks: OptimizerReleaseCheck[] = [
    check('certificate-library', 'Authoritative Certificate Library', input.certificateLibraryAuthoritative, 'Durable, versioned, page-attributed certificate evidence is required before certificate values become production authority.', true),
    check('royal-authenticated', 'Authenticated Royal data validation', input.royalAuthenticatedDataValidated, 'Royal/Club Royale/Crown & Anchor production data must be captured, persisted, and read back on a native authenticated device.', true),
    check('carnival-authenticated', 'Authenticated Carnival data validation', input.carnivalAuthenticatedDataValidated, 'Carnival identity, offers, sailings, history, and loyalty must be validated on a native authenticated device.', true),
  ];

  const nativeChecks: OptimizerReleaseCheck[] = [
    check('native-ios', 'Native iOS validation', input.nativeIosValidated, 'The release candidate must complete the native iOS protocol.', true),
    check('native-android', 'Native Android validation', input.nativeAndroidValidated, 'The release candidate must complete the native Android protocol.', true),
    check('production-readback', 'Production transaction/readback validation', input.productionDataReadbackVerified, 'Saved optimization state must survive restart and read back exactly on production storage.', true),
  ];

  const checks = [...automatedChecks, ...dataChecks, ...nativeChecks];
  const automatedFailed = automatedChecks.some(item => item.status !== 'pass');
  const dataBlocked = dataChecks.some(item => item.status !== 'pass');
  const nativeBlocked = nativeChecks.some(item => item.status !== 'pass');
  let status: OptimizerReleaseGateStatus = 'release-ready';
  if (automatedFailed) status = 'blocked-automated-validation';
  else if (dataBlocked) status = 'blocked-data-prerequisites';
  else if (nativeBlocked) status = 'blocked-native-validation';

  const productionEnableAllowed = status === 'release-ready';
  const requested = input.requestedFlags ?? {};
  const effectiveFlags: PersonalCertificateOptimizerFeatureFlags = productionEnableAllowed
    ? {
      personalCertificateOptimizerEnabled: requested.personalCertificateOptimizerEnabled === true,
      personalCertificateOptimizerLiveAdvisorEnabled: requested.personalCertificateOptimizerEnabled === true
        && requested.personalCertificateOptimizerLiveAdvisorEnabled === true,
      personalCertificateOptimizerLearningEnabled: requested.personalCertificateOptimizerEnabled === true
        && requested.personalCertificateOptimizerLearningEnabled === true,
    }
    : DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS;

  const blockers = checks
    .filter(item => item.required && item.status !== 'pass')
    .map(item => `${item.label}: ${item.details}`);
  const warnings = productionEnableAllowed
    ? []
    : ['Production optimizer flags are forcibly disabled until every required release check passes.'];
  const fingerprint = stableModelFingerprint([
    input.generatedAt,
    status,
    ...checks.map(item => `${item.id}:${item.status}`),
    PERSONAL_CERTIFICATE_OPTIMIZER_RELEASE_VERSION,
  ]);

  return {
    id: `personal-certificate-optimizer-release:${fingerprint}`,
    generatedAt: input.generatedAt,
    status,
    productionEnableAllowed,
    effectiveFlags,
    checks,
    blockers,
    warnings,
    releaseVersion: PERSONAL_CERTIFICATE_OPTIMIZER_RELEASE_VERSION,
  };
}
