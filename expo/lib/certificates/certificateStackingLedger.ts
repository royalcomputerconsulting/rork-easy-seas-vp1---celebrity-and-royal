import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';

export type StackingCombination = 'free_play' | 'onboard_credit' | 'next_cruise' | 'annual_tier_reward' | 'casino_rate' | 'cabin_upgrade' | 'other_offer';
export type StackingEvidenceStatus = 'verified' | 'host_confirmed' | 'terms_inferred' | 'unknown';
export type StackingOutcome = 'can_stack' | 'cannot_stack' | 'conditional' | 'unknown';

export interface CertificateStackingRule {
  id: string;
  certificateCode: string;
  combination: StackingCombination;
  status: StackingEvidenceStatus;
  outcome: StackingOutcome;
  evidence: string;
  sourceLabel?: string;
  sourceUrl?: string;
  observedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const CERTIFICATE_STACKING_LEDGER_BASE_KEY = '@easyseas_certificate_stacking_ledger_v1';

export const STACKING_COMBINATIONS: Array<{ id: StackingCombination; label: string; help: string }> = [
  { id: 'free_play', label: 'FreePlay', help: 'Whether issued or promotional FreePlay remains available.' },
  { id: 'onboard_credit', label: 'Onboard credit', help: 'Whether OBC can be retained or added.' },
  { id: 'next_cruise', label: 'NextCruise', help: 'Whether a NextCruise booking or certificate can combine.' },
  { id: 'annual_tier_reward', label: 'Annual tier reward', help: 'Whether the annual Prime, Signature, or Masters reward can combine.' },
  { id: 'casino_rate', label: 'Casino rate', help: 'Whether a separate casino fare or rate code can combine.' },
  { id: 'cabin_upgrade', label: 'Cabin upgrade', help: 'Whether a paid or promotional cabin upgrade is permitted.' },
  { id: 'other_offer', label: 'Other offer', help: 'Whether another marketing or casino offer can combine.' },
];

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getStackingRuleId(certificateCode: string, combination: StackingCombination): string {
  return `${normalizeCode(certificateCode)}::${combination}`;
}

export function createUnknownStackingRule(certificateCode: string, combination: StackingCombination, now = new Date()): CertificateStackingRule {
  const timestamp = now.toISOString();
  return {
    id: getStackingRuleId(certificateCode, combination),
    certificateCode: normalizeCode(certificateCode),
    combination,
    status: 'unknown',
    outcome: 'unknown',
    evidence: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateStackingRule(rule: CertificateStackingRule): string[] {
  const errors: string[] = [];
  if (!normalizeCode(rule.certificateCode)) errors.push('Certificate code is required.');
  if (!STACKING_COMBINATIONS.some((entry) => entry.id === rule.combination)) errors.push('Stacking combination is not recognized.');
  if (rule.status !== 'unknown' && rule.outcome === 'unknown') errors.push('Choose can stack, cannot stack, or conditional.');
  if (rule.status !== 'unknown' && rule.evidence.trim().length < 5) errors.push('Supporting evidence is required for a non-unknown status.');
  if (rule.status === 'verified' && !rule.sourceLabel?.trim() && !rule.sourceUrl?.trim()) errors.push('Verified rules require an official source label or URL.');
  if (rule.sourceUrl && !/^https:\/\//i.test(rule.sourceUrl.trim())) errors.push('Evidence URL must use HTTPS.');
  return errors;
}

export function mergeStackingLedger(certificateCodes: string[], storedRules: CertificateStackingRule[], now = new Date()): CertificateStackingRule[] {
  const byId = new Map(storedRules.map((rule) => [getStackingRuleId(rule.certificateCode, rule.combination), { ...rule, id: getStackingRuleId(rule.certificateCode, rule.combination), certificateCode: normalizeCode(rule.certificateCode) }]));
  certificateCodes.map(normalizeCode).filter(Boolean).forEach((code) => {
    STACKING_COMBINATIONS.forEach(({ id: combination }) => {
      const id = getStackingRuleId(code, combination);
      if (!byId.has(id)) byId.set(id, createUnknownStackingRule(code, combination, now));
    });
  });
  return Array.from(byId.values()).sort((left, right) => left.certificateCode.localeCompare(right.certificateCode) || STACKING_COMBINATIONS.findIndex((entry) => entry.id === left.combination) - STACKING_COMBINATIONS.findIndex((entry) => entry.id === right.combination));
}

function isStoredRule(value: unknown): value is CertificateStackingRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<CertificateStackingRule>;
  return typeof rule.certificateCode === 'string'
    && STACKING_COMBINATIONS.some((entry) => entry.id === rule.combination)
    && ['verified', 'host_confirmed', 'terms_inferred', 'unknown'].includes(String(rule.status))
    && ['can_stack', 'cannot_stack', 'conditional', 'unknown'].includes(String(rule.outcome));
}

export async function loadCertificateStackingLedger(storageKey: string): Promise<CertificateStackingRule[]> {
  return quotaSafeGetJsonItem<CertificateStackingRule[]>(storageKey, [], (value): value is CertificateStackingRule[] => Array.isArray(value) && value.every(isStoredRule));
}

export async function saveCertificateStackingLedger(storageKey: string, rules: CertificateStackingRule[]): Promise<void> {
  const invalid = rules.flatMap((rule) => validateStackingRule(rule).map((error) => `${rule.id}: ${error}`));
  if (invalid.length > 0) throw new Error(invalid[0]);
  await quotaSafeSetJsonItem(storageKey, rules);
}
