export type CruiseValueCategory =
  | 'casino-offer'
  | 'instant-certificate'
  | 'club-royale-annual-cruise'
  | 'crown-anchor-milestone-cruise'
  | 'nextcruise-obc'
  | 'nextcruise-instant-savings'
  | 'future-cruise-credit'
  | 'signature-obc'
  | 'masters-obc'
  | 'shareholder-obc'
  | 'travel-agent-obc'
  | 'promo-obc'
  | 'freeplay'
  | 'internet'
  | 'specialty-dining'
  | 'spa'
  | 'fitness-class'
  | 'salon'
  | 'thermal-suite'
  | 'onboard-credit'
  | 'taxes-fees'
  | 'cash-paid'
  | 'unknown';

export type CruiseValueLedgerItem = {
  id: string;
  cruiseId: string;
  category: CruiseValueCategory;
  label: string;
  amount: number;
  currency: 'USD';
  source:
    | 'manual'
    | 'invoice'
    | 'club-royale'
    | 'crown-anchor'
    | 'nextcruise'
    | 'fcc'
    | 'offer-parser'
    | 'agentx'
    | 'cruise-planner'
    | 'folio'
    | 'unknown';
  appliesTo:
    | 'cruise-fare'
    | 'onboard-account'
    | 'freeplay'
    | 'taxes-fees'
    | 'deposit'
    | 'future-booking'
    | 'onboard-spend'
    | 'unknown';
  isCashEquivalent: boolean;
  isRefundable: boolean | null;
  isStackable: boolean | null;
  paymentMethod?: 'cash' | 'obc' | 'fcc' | 'comp' | 'unknown';
  spendingCategory?: CruiseValueCategory;
  status: 'expected' | 'confirmed' | 'applied' | 'used' | 'expired' | 'unknown';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createLedgerItem(input: Partial<CruiseValueLedgerItem> & {
  cruiseId: string;
  category: CruiseValueCategory;
  label: string;
  amount: number;
}): CruiseValueLedgerItem {
  const now = nowIso();
  return {
    id: input.id ?? `${input.cruiseId}-${input.category}-${Math.random().toString(36).slice(2, 10)}`,
    cruiseId: input.cruiseId,
    category: input.category,
    label: input.label,
    amount: n(input.amount),
    currency: input.currency ?? 'USD',
    source: input.source ?? 'manual',
    appliesTo: input.appliesTo ?? 'unknown',
    isCashEquivalent: input.isCashEquivalent ?? false,
    isRefundable: input.isRefundable ?? null,
    isStackable: input.isStackable ?? null,
    paymentMethod: input.paymentMethod ?? 'unknown',
    spendingCategory: input.spendingCategory,
    status: input.status ?? 'expected',
    notes: input.notes,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function filterLedgerByCruise(items: CruiseValueLedgerItem[], cruiseId: string): CruiseValueLedgerItem[] {
  return (items ?? []).filter((item) => item.cruiseId === cruiseId);
}

export function isValueItem(item: CruiseValueLedgerItem): boolean {
  if (item.status === 'expired') return false;
  if (item.category === 'cash-paid' || item.category === 'taxes-fees' || item.category === 'future-cruise-credit') return false;
  if (item.paymentMethod === 'cash' && ['internet', 'specialty-dining', 'spa', 'salon', 'thermal-suite', 'fitness-class'].includes(item.category)) return false;
  if (item.paymentMethod === 'obc' && item.category !== 'onboard-credit') return false;
  if (item.paymentMethod === 'fcc') return false;
  return n(item.amount) > 0;
}

export function isSpendItem(item: CruiseValueLedgerItem): boolean {
  return item.category === 'cash-paid'
    || item.category === 'taxes-fees'
    || item.paymentMethod === 'cash'
    || item.appliesTo === 'onboard-spend';
}

export function sumLedgerItems(items: CruiseValueLedgerItem[], predicate?: (item: CruiseValueLedgerItem) => boolean): number {
  return (items ?? []).filter((item) => predicate ? predicate(item) : true).reduce((sum, item) => sum + n(item.amount), 0);
}

export function detectLedgerDoubleCountingWarnings(items: CruiseValueLedgerItem[]): string[] {
  const warnings: string[] = [];
  const obcValue = sumLedgerItems(items, (item) => ['onboard-credit', 'signature-obc', 'masters-obc', 'shareholder-obc', 'travel-agent-obc', 'promo-obc', 'nextcruise-obc'].includes(item.category) && item.status !== 'expired');
  const obcPaidAddOns = (items ?? []).filter((item) => item.paymentMethod === 'obc' && ['internet', 'specialty-dining', 'spa', 'salon', 'thermal-suite', 'fitness-class'].includes(item.category));
  if (obcValue > 0 && obcPaidAddOns.length > 0) {
    warnings.push('OBC-paid onboard purchases are tagged as spending categories only; EasySeas counts the OBC value once and does not double-count the purchased item as extra comp value.');
  }
  const fccItems = (items ?? []).filter((item) => item.category === 'future-cruise-credit' || item.paymentMethod === 'fcc');
  if (fccItems.length > 0) warnings.push('Future Cruise Credits reduce out-of-pocket cash owed but do not count as casino comp value.');
  return warnings;
}
