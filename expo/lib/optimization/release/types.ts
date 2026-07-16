import type { PersonalCertificateOptimizerFeatureFlags } from '../featureFlags';

export type OptimizerReleaseGateStatus =
  | 'release-ready'
  | 'blocked-automated-validation'
  | 'blocked-data-prerequisites'
  | 'blocked-native-validation';

export type OptimizerReleaseCheckStatus = 'pass' | 'fail' | 'blocked' | 'not-run';

export interface OptimizerReleaseCheck {
  id: string;
  label: string;
  status: OptimizerReleaseCheckStatus;
  required: boolean;
  details: string;
}

export interface OptimizerReleaseGateInput {
  generatedAt: string;
  automatedRegressionPassed: boolean;
  scenarioMatrixPassed: boolean;
  typeSyntaxPassed: boolean;
  accessibilityAuditPassed: boolean;
  protectedFilesUnchanged: boolean;
  profileIsolationPassed: boolean;
  deterministicReproducibilityPassed: boolean;
  rollbackVerified: boolean;
  privacyAuditPassed: boolean;
  archiveIntegrityPassed: boolean;
  certificateLibraryAuthoritative: boolean;
  royalAuthenticatedDataValidated: boolean;
  carnivalAuthenticatedDataValidated: boolean;
  nativeIosValidated: boolean;
  nativeAndroidValidated: boolean;
  productionDataReadbackVerified: boolean;
  requestedFlags?: Partial<PersonalCertificateOptimizerFeatureFlags>;
}

export interface OptimizerReleaseGateSnapshot {
  id: string;
  generatedAt: string;
  status: OptimizerReleaseGateStatus;
  productionEnableAllowed: boolean;
  effectiveFlags: PersonalCertificateOptimizerFeatureFlags;
  checks: OptimizerReleaseCheck[];
  blockers: string[];
  warnings: string[];
  releaseVersion: string;
}
