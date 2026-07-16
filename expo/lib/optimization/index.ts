/**
 * Public optimization boundary. UI code may import stable contracts from this
 * barrel or consume the future provider, but must not import low-level model
 * formulas directly.
 */
export * from '@/lib/optimization/featureFlags';
export * from '@/lib/optimization/recommendationAuthority';

export * from '@/lib/optimization/history';

export * from '@/lib/optimization/value';

export * from '@/lib/optimization/models';

export * from '@/lib/optimization/engine';

export * from '@/lib/optimization/live';

export * from '@/lib/optimization/dashboard';

export * from '@/lib/optimization/integration';

export * from '@/lib/optimization/alerts';

export * from '@/lib/optimization/learning';

export * from '@/lib/optimization/release';
