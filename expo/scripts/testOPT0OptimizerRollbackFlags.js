const assert = require('assert');
const { loadTs } = require('./clubRoyaleTestBootstrap');

const {
  DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS,
  getPersonalCertificateOptimizerFeatureFlags,
} = loadTs('lib/optimization/featureFlags.ts');
const { getCertificateRecommendationAuthority } = loadTs('lib/optimization/recommendationAuthority.ts');

assert.deepStrictEqual(
  { ...DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS },
  {
    personalCertificateOptimizerEnabled: false,
    personalCertificateOptimizerLiveAdvisorEnabled: false,
    personalCertificateOptimizerLearningEnabled: false,
  },
  'All optimizer feature flags must default to disabled in OPT-0.',
);
assert.deepStrictEqual(
  { ...getPersonalCertificateOptimizerFeatureFlags() },
  { ...DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS },
  'Environment-free flag resolution must preserve disabled defaults.',
);
assert.strictEqual(getCertificateRecommendationAuthority(), 'legacy-static');
assert.deepStrictEqual(
  { ...getPersonalCertificateOptimizerFeatureFlags({ personalCertificateOptimizerLiveAdvisorEnabled: true }) },
  { ...DEFAULT_PERSONAL_CERTIFICATE_OPTIMIZER_FEATURE_FLAGS },
  'Dependent features cannot activate while the optimizer itself is disabled.',
);
assert.strictEqual(
  getCertificateRecommendationAuthority({ personalCertificateOptimizerEnabled: true }),
  'personal-optimizer',
  'Explicit future rollout override should select the personal authority.',
);

console.log('PASS testOPT0OptimizerRollbackFlags');
