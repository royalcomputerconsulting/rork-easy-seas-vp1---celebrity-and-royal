import type { 
  AlertRule, 
  AlertCondition, 
  Alert, 
  Anomaly, 
  AnomalyType,
  AlertPriority,
} from '@/types/models';

function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule_price_drop_critical',
    name: 'Major Price Drop',
    description: 'Alert when cruise price drops 25% or more',
    type: 'price_drop',
    enabled: true,
    conditions: [
      { field: 'priceDropPercent', operator: 'gte', value: 25, unit: '%' },
    ],
    priority: 'critical',
    cooldownMinutes: 0,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_price_drop_high',
    name: 'Significant Price Drop',
    description: 'Alert when cruise price drops 15-24%',
    type: 'price_drop',
    enabled: true,
    conditions: [
      { field: 'priceDropPercent', operator: 'gte', value: 15, unit: '%' },
    ],
    priority: 'high',
    cooldownMinutes: 0,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_price_drop_medium',
    name: 'Price Drop Detected',
    description: 'Alert when cruise price drops 5-14%',
    type: 'price_drop',
    enabled: true,
    conditions: [
      { field: 'priceDropPercent', operator: 'gte', value: 5, unit: '%' },
    ],
    priority: 'medium',
    cooldownMinutes: 0,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_roi_critical_low',
    name: 'Critical Negative ROI',
    description: 'Alert when cruise ROI falls below -50%',
    type: 'roi_outlier',
    enabled: true,
    conditions: [
      { field: 'roi', operator: 'lt', value: -50, unit: '%' },
    ],
    priority: 'critical',
    cooldownMinutes: 60,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_roi_warning',
    name: 'Low ROI Warning',
    description: 'Alert when cruise ROI is negative',
    type: 'roi_outlier',
    enabled: true,
    conditions: [
      { field: 'roi', operator: 'lt', value: 0, unit: '%' },
    ],
    priority: 'high',
    cooldownMinutes: 120,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_offer_expiring_critical',
    name: 'Offer Expiring Soon',
    description: 'Alert when offer expires within 3 days',
    type: 'offer_expiring',
    enabled: true,
    conditions: [
      { field: 'daysUntilExpiry', operator: 'lte', value: 3, unit: 'days' },
    ],
    priority: 'critical',
    cooldownMinutes: 1440,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_offer_expiring_warning',
    name: 'Offer Expiring Warning',
    description: 'Alert when offer expires within 7 days',
    type: 'offer_expiring',
    enabled: true,
    conditions: [
      { field: 'daysUntilExpiry', operator: 'lte', value: 7, unit: 'days' },
    ],
    priority: 'high',
    cooldownMinutes: 1440,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_tier_milestone',
    name: 'Tier Milestone Approaching',
    description: 'Alert when close to next tier (90%+)',
    type: 'tier_milestone',
    enabled: true,
    conditions: [
      { field: 'tierProgress', operator: 'gte', value: 90, unit: '%' },
    ],
    priority: 'medium',
    cooldownMinutes: 10080,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_booking_conflict',
    name: 'Booking Conflict Detected',
    description: 'Alert when two bookings overlap',
    type: 'booking_conflict',
    enabled: true,
    conditions: [
      { field: 'hasOverlap', operator: 'eq', value: 1 },
    ],
    priority: 'critical',
    cooldownMinutes: 0,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_spending_spike',
    name: 'High Spending Alert',
    description: 'Alert when daily spending exceeds $1000',
    type: 'spending_spike',
    enabled: true,
    conditions: [
      { field: 'dailySpend', operator: 'gt', value: 1000, unit: '$' },
    ],
    priority: 'high',
    cooldownMinutes: 1440,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  },

];

const VALID_ALERT_TYPES: readonly AnomalyType[] = [
  'roi_outlier',
  'spending_spike',
  'points_mismatch',
  'value_drop',
  'unusual_pattern',
  'offer_expiring',
  'tier_milestone',
  'booking_conflict',
  'back_to_back',
  'price_drop',
];

const VALID_ALERT_PRIORITIES: readonly AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_OPERATORS: readonly AlertCondition['operator'][] = ['gt', 'lt', 'eq', 'ne', 'gte', 'lte', 'between', 'outside'];
const DEFAULT_RULES_BY_ID: Readonly<Record<string, AlertRule>> = DEFAULT_ALERT_RULES.reduce<Record<string, AlertRule>>((accumulator, rule) => {
  accumulator[rule.id] = rule;
  return accumulator;
}, {});

interface CompactAlertRuleOverride {
  id: string;
  enabled?: boolean;
  conditions?: AlertCondition[];
  priority?: AlertPriority;
  cooldownMinutes?: number;
  notifyOnTrigger?: boolean;
  lastTriggeredAt?: string;
}

interface CompactAlertRulesPayload {
  version: 2;
  overrides: CompactAlertRuleOverride[];
  customRules?: AlertRule[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function truncateString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function isAlertType(value: unknown): value is AnomalyType {
  return typeof value === 'string' && VALID_ALERT_TYPES.includes(value as AnomalyType);
}

function isAlertPriority(value: unknown): value is AlertPriority {
  return typeof value === 'string' && VALID_ALERT_PRIORITIES.includes(value as AlertPriority);
}

function isOperator(value: unknown): value is AlertCondition['operator'] {
  return typeof value === 'string' && VALID_OPERATORS.includes(value as AlertCondition['operator']);
}

function sanitizeCooldown(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, 525_600) : fallback;
}

function sanitizeConditions(value: unknown, fallback: AlertCondition[]): AlertCondition[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const conditions = value
    .slice(0, 8)
    .map((condition): AlertCondition | null => {
      if (!isRecord(condition)) {
        return null;
      }
      const field = truncateString(condition.field, 80);
      const operator = condition.operator;
      const rawValue = condition.value;
      if (!field || !isOperator(operator)) {
        return null;
      }
      const normalizedValue = Array.isArray(rawValue)
        ? rawValue.slice(0, 2).filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
        : rawValue;
      if (Array.isArray(normalizedValue)) {
        if (normalizedValue.length !== 2) {
          return null;
        }
        return {
          field,
          operator,
          value: [normalizedValue[0], normalizedValue[1]],
          ...(typeof condition.unit === 'string' ? { unit: condition.unit.slice(0, 20) } : {}),
        };
      }
      if (typeof normalizedValue !== 'number' || !Number.isFinite(normalizedValue)) {
        return null;
      }
      return {
        field,
        operator,
        value: normalizedValue,
        ...(typeof condition.unit === 'string' ? { unit: condition.unit.slice(0, 20) } : {}),
      };
    })
    .filter((condition): condition is AlertCondition => condition !== null);

  return conditions.length > 0 ? conditions : fallback;
}

function applyStoredRuleFields(baseRule: AlertRule, storedRule: unknown): AlertRule {
  if (!isRecord(storedRule)) {
    return baseRule;
  }

  return {
    ...baseRule,
    enabled: typeof storedRule.enabled === 'boolean' ? storedRule.enabled : baseRule.enabled,
    conditions: sanitizeConditions(storedRule.conditions, baseRule.conditions),
    priority: isAlertPriority(storedRule.priority) ? storedRule.priority : baseRule.priority,
    cooldownMinutes: sanitizeCooldown(storedRule.cooldownMinutes, baseRule.cooldownMinutes),
    notifyOnTrigger: typeof storedRule.notifyOnTrigger === 'boolean' ? storedRule.notifyOnTrigger : baseRule.notifyOnTrigger,
    ...(typeof storedRule.lastTriggeredAt === 'string' ? { lastTriggeredAt: storedRule.lastTriggeredAt.slice(0, 40) } : {}),
  };
}

function sanitizeCustomAlertRule(value: unknown): AlertRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = truncateString(value.id, 100);
  const name = truncateString(value.name, 120);
  const description = truncateString(value.description, 240) ?? '';
  const type = value.type;
  if (!id || !name || DEFAULT_RULES_BY_ID[id] || !isAlertType(type)) {
    return null;
  }

  return {
    id,
    name,
    description,
    type,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    conditions: sanitizeConditions(value.conditions, []),
    priority: isAlertPriority(value.priority) ? value.priority : 'medium',
    cooldownMinutes: sanitizeCooldown(value.cooldownMinutes, 60),
    notifyOnTrigger: typeof value.notifyOnTrigger === 'boolean' ? value.notifyOnTrigger : true,
    createdAt: truncateString(value.createdAt, 40) ?? new Date().toISOString(),
    ...(typeof value.lastTriggeredAt === 'string' ? { lastTriggeredAt: value.lastTriggeredAt.slice(0, 40) } : {}),
  };
}

function extractRuleArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value.rules)) {
    return value.rules;
  }
  return [];
}

/**
 * Normalizes persisted alert rules so a corrupted or oversized storage payload cannot
 * be loaded back into state and repeatedly exceed browser storage quota.
 */
export function normalizeAlertRulesFromStorage(value: unknown): AlertRule[] {
  if (isRecord(value) && value.version === 2 && Array.isArray(value.overrides)) {
    const overridesById = new Map<string, unknown>(
      value.overrides
        .filter((override): override is Record<string, unknown> => isRecord(override) && typeof override.id === 'string')
        .map((override) => [String(override.id), override])
    );
    const normalizedDefaults = DEFAULT_ALERT_RULES.map((defaultRule) => applyStoredRuleFields(defaultRule, overridesById.get(defaultRule.id)));
    const customRules = Array.isArray(value.customRules)
      ? value.customRules.map(sanitizeCustomAlertRule).filter((rule): rule is AlertRule => rule !== null).slice(0, 20)
      : [];
    return [...normalizedDefaults, ...customRules];
  }

  const rawRules = extractRuleArray(value);
  const storedRulesById = new Map<string, unknown>(
    rawRules
      .filter((rule): rule is Record<string, unknown> => isRecord(rule) && typeof rule.id === 'string')
      .map((rule) => [String(rule.id), rule])
  );
  const normalizedDefaults = DEFAULT_ALERT_RULES.map((defaultRule) => applyStoredRuleFields(defaultRule, storedRulesById.get(defaultRule.id)));
  const customRules = rawRules
    .filter((rule) => isRecord(rule) && typeof rule.id === 'string' && !DEFAULT_RULES_BY_ID[String(rule.id)])
    .map(sanitizeCustomAlertRule)
    .filter((rule): rule is AlertRule => rule !== null)
    .slice(0, 20);

  return [...normalizedDefaults, ...customRules];
}

/** Stores only rule changes instead of repeatedly persisting the full default rule list. */
export function serializeAlertRulesForStorage(rules: AlertRule[]): CompactAlertRulesPayload {
  const normalizedRules = normalizeAlertRulesFromStorage(rules);
  const overrides: CompactAlertRuleOverride[] = [];
  const customRules: AlertRule[] = [];

  normalizedRules.forEach((rule) => {
    const defaultRule = DEFAULT_RULES_BY_ID[rule.id];
    if (!defaultRule) {
      customRules.push(rule);
      return;
    }

    const override: CompactAlertRuleOverride = { id: rule.id };
    if (rule.enabled !== defaultRule.enabled) override.enabled = rule.enabled;
    if (rule.priority !== defaultRule.priority) override.priority = rule.priority;
    if (rule.cooldownMinutes !== defaultRule.cooldownMinutes) override.cooldownMinutes = rule.cooldownMinutes;
    if (rule.notifyOnTrigger !== defaultRule.notifyOnTrigger) override.notifyOnTrigger = rule.notifyOnTrigger;
    if (JSON.stringify(rule.conditions) !== JSON.stringify(defaultRule.conditions)) override.conditions = rule.conditions;
    if (typeof rule.lastTriggeredAt === 'string') override.lastTriggeredAt = rule.lastTriggeredAt;
    if (Object.keys(override).length > 1) {
      overrides.push(override);
    }
  });

  return {
    version: 2,
    overrides,
    ...(customRules.length > 0 ? { customRules } : {}),
  };
}

export function evaluateCondition(
  condition: AlertCondition,
  value: number
): boolean {
  const { operator, value: threshold } = condition;

  switch (operator) {
    case 'gt':
      return value > (threshold as number);
    case 'lt':
      return value < (threshold as number);
    case 'eq':
      return value === (threshold as number);
    case 'ne':
      return value !== (threshold as number);
    case 'gte':
      return value >= (threshold as number);
    case 'lte':
      return value <= (threshold as number);
    case 'between':
      const [min, max] = threshold as [number, number];
      return value >= min && value <= max;
    case 'outside':
      const [low, high] = threshold as [number, number];
      return value < low || value > high;
    default:
      return false;
  }
}

export function evaluateRule(
  rule: AlertRule,
  dataPoint: Record<string, number>
): boolean {
  if (!rule.enabled) return false;

  return rule.conditions.every(condition => {
    const value = dataPoint[condition.field];
    if (value === undefined) return false;
    return evaluateCondition(condition, value);
  });
}

export function createAlertFromAnomaly(
  anomaly: Anomaly,
  rule?: AlertRule
): Alert {
  return {
    id: generateId(),
    ruleId: rule?.id,
    anomaly,
    type: anomaly.type,
    priority: rule?.priority || anomaly.severity,
    status: 'active',
    title: anomaly.title,
    message: anomaly.description,
    actionLabel: getActionLabel(anomaly.type),
    actionRoute: getActionRoute(anomaly),
    createdAt: new Date().toISOString(),
    relatedEntityId: anomaly.relatedEntityId,
    relatedEntityType: anomaly.relatedEntityType,
  };
}

function getActionLabel(type: AnomalyType): string {
  switch (type) {
    case 'roi_outlier':
      return 'View Cruise';
    case 'spending_spike':
      return 'View Details';
    case 'points_mismatch':
      return 'Analyze';
    case 'value_drop':
      return 'Compare Values';
    case 'offer_expiring':
      return 'Book Now';
    case 'tier_milestone':
      return 'View Progress';
    case 'booking_conflict':
      return 'Resolve Conflict';
    case 'back_to_back':
      return 'View Cruises';
    case 'unusual_pattern':
      return 'View Pattern';
    case 'price_drop':
      return 'View Deal';
    default:
      return 'View';
  }
}

function getActionRoute(anomaly: Anomaly): string {
  switch (anomaly.type) {
    case 'roi_outlier':
    case 'spending_spike':
    case 'points_mismatch':
    case 'booking_conflict':
    case 'back_to_back':
      return anomaly.relatedEntityId ? `/cruise-details?id=${anomaly.relatedEntityId}` : '/analytics';
    case 'offer_expiring':
    case 'price_drop':
      return anomaly.relatedEntityId ? `/offer-details?id=${anomaly.relatedEntityId}` : '/';
    case 'tier_milestone':
      return '/analytics';
    default:
      return '/analytics';
  }
}

export function processAnomaliesWithRules(
  anomalies: Anomaly[],
  rules: AlertRule[],
  existingAlerts: Alert[]
): Alert[] {
  const newAlerts: Alert[] = [];
  const now = Date.now();

  anomalies.forEach(anomaly => {
    const matchingRule = rules.find(r => r.type === anomaly.type && r.enabled);
    
    if (matchingRule) {
      const lastTriggered = matchingRule.lastTriggeredAt 
        ? new Date(matchingRule.lastTriggeredAt).getTime() 
        : 0;
      const cooldownMs = matchingRule.cooldownMinutes * 60 * 1000;

      if (now - lastTriggered < cooldownMs) {
        console.log(`[AlertRules] Skipping alert for ${anomaly.type} - in cooldown`);
        return;
      }

      const existingAlert = existingAlerts.find(a => 
        a.type === anomaly.type && 
        a.relatedEntityId === anomaly.relatedEntityId &&
        a.status === 'active'
      );

      if (existingAlert) {
        console.log(`[AlertRules] Alert already exists for ${anomaly.type} on ${anomaly.relatedEntityId}`);
        return;
      }
    }

    const alert = createAlertFromAnomaly(anomaly, matchingRule);
    newAlerts.push(alert);
  });

  console.log(`[AlertRules] Created ${newAlerts.length} new alerts from ${anomalies.length} anomalies`);
  return newAlerts;
}

export function dismissAlert(
  alert: Alert,
  dismiss: boolean = true
): Alert {
  return {
    ...alert,
    status: dismiss ? 'dismissed' : 'active',
    dismissedAt: dismiss ? new Date().toISOString() : undefined,
  };
}

export function snoozeAlert(
  alert: Alert,
  snoozeMinutes: number
): Alert {
  const snoozeUntil = new Date();
  snoozeUntil.setMinutes(snoozeUntil.getMinutes() + snoozeMinutes);

  return {
    ...alert,
    status: 'snoozed',
    snoozedUntil: snoozeUntil.toISOString(),
  };
}

export function resolveAlert(alert: Alert): Alert {
  return {
    ...alert,
    status: 'resolved',
  };
}

export function filterActiveAlerts(alerts: Alert[]): Alert[] {
  const now = new Date();

  return alerts.filter(alert => {
    if (alert.status === 'dismissed' || alert.status === 'resolved') {
      return false;
    }

    if (alert.status === 'snoozed' && alert.snoozedUntil) {
      const snoozeEnd = new Date(alert.snoozedUntil);
      if (snoozeEnd > now) {
        return false;
      }
    }

    return true;
  });
}

export function sortAlertsByPriority(alerts: Alert[]): Alert[] {
  const priorityOrder: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return [...alerts].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getAlertsByType(
  alerts: Alert[],
  type: AnomalyType
): Alert[] {
  return alerts.filter(a => a.type === type);
}

export function getAlertCountByPriority(
  alerts: Alert[]
): Record<AlertPriority, number> {
  const counts: Record<AlertPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  alerts.forEach(alert => {
    counts[alert.priority]++;
  });

  return counts;
}

export function createCustomRule(
  name: string,
  description: string,
  type: AnomalyType,
  conditions: AlertCondition[],
  priority: AlertPriority = 'medium'
): AlertRule {
  return {
    id: generateRuleId(),
    name,
    description,
    type,
    enabled: true,
    conditions,
    priority,
    cooldownMinutes: 60,
    notifyOnTrigger: true,
    createdAt: new Date().toISOString(),
  };
}

export function updateRule(
  rule: AlertRule,
  updates: Partial<AlertRule>
): AlertRule {
  return {
    ...rule,
    ...updates,
  };
}

export function toggleRule(rule: AlertRule): AlertRule {
  return {
    ...rule,
    enabled: !rule.enabled,
  };
}

export interface AlertSummary {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  requiresAction: boolean;
  oldestUnresolvedDate: string | null;
  byType: Partial<Record<AnomalyType, number>>;
}

export function getAlertSummary(alerts: Alert[]): AlertSummary {
  const activeAlerts = filterActiveAlerts(alerts);
  const priorityCounts = getAlertCountByPriority(activeAlerts);
  
  const byType: Partial<Record<AnomalyType, number>> = {};
  activeAlerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  });

  const sortedByDate = [...activeAlerts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    totalActive: activeAlerts.length,
    criticalCount: priorityCounts.critical,
    highCount: priorityCounts.high,
    requiresAction: priorityCounts.critical > 0 || priorityCounts.high > 0,
    oldestUnresolvedDate: sortedByDate[0]?.createdAt || null,
    byType,
  };
}
