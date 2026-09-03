import type { InternetValueItem, SpecialtyDiningValueItem, SpaValueItem } from '@/types/models';
import type { CruiseValueLedgerItem } from '@/lib/value/cruiseValueLedger';

export const DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY = 30;

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nowIso() {
  return new Date().toISOString();
}

export function calculateVoomValue(input: { devices?: number; days?: number; pricePerDevicePerDay?: number; confirmedTotalPrice?: number }) {
  const devices = Math.max(0, Math.floor(money(input.devices) || 1));
  const days = Math.max(0, Math.floor(money(input.days)));
  const rate = money(input.pricePerDevicePerDay) || DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY;
  const calculatedValue = money(input.confirmedTotalPrice) || devices * days * rate;
  return { devices, days, retailPricePerDevicePerDay: rate, calculatedValue, warnings: rate === DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY ? ['Using EasySeas default VOOM value: $30 per device per day.'] : [] };
}

export function buildInternetValueItem(input: Partial<InternetValueItem> & { cruiseId: string; days?: number }): InternetValueItem {
  const voom = calculateVoomValue({ devices: input.devices, days: input.days, pricePerDevicePerDay: input.retailPricePerDevicePerDay, confirmedTotalPrice: input.confirmedTotalPrice });
  return {
    id: input.id ?? `${input.cruiseId}-internet-${Date.now()}`,
    cruiseId: input.cruiseId,
    packageName: input.packageName ?? 'voom',
    devices: voom.devices,
    days: voom.days,
    retailPricePerDevicePerDay: voom.retailPricePerDevicePerDay,
    confirmedTotalPrice: input.confirmedTotalPrice,
    calculatedValue: input.calculatedValue ?? voom.calculatedValue,
    coveredBy: input.coveredBy ?? 'unknown',
    status: input.status ?? 'estimated',
    source: input.source ?? 'default-voom-rate',
    notes: input.notes,
  };
}

export function isCompedOnboardCoverage(coveredBy?: string): boolean {
  return !!coveredBy && !['none', 'obc', 'unknown'].includes(coveredBy);
}

export function buildOnboardValueLedgerItems(input: {
  cruiseId: string;
  internet?: InternetValueItem[];
  dining?: SpecialtyDiningValueItem[];
  spa?: SpaValueItem[];
}): CruiseValueLedgerItem[] {
  const createdAt = nowIso();
  const rows: CruiseValueLedgerItem[] = [];
  const add = (item: Omit<CruiseValueLedgerItem, 'currency' | 'createdAt' | 'updatedAt' | 'isRefundable' | 'isStackable'>) => rows.push({ ...item, currency: 'USD', isRefundable: null, isStackable: null, createdAt, updatedAt: createdAt });

  for (const item of input.internet ?? []) {
    const isComped = isCompedOnboardCoverage(item.coveredBy);
    add({
      id: `${item.id}-ledger`,
      cruiseId: input.cruiseId,
      category: 'internet',
      label: `VOOM internet (${item.devices} device${item.devices === 1 ? '' : 's'} × ${item.days} day${item.days === 1 ? '' : 's'})`,
      amount: money(item.confirmedTotalPrice) || money(item.calculatedValue),
      source: item.source === 'default-voom-rate' ? 'manual' : item.source,
      appliesTo: 'onboard-spend',
      isCashEquivalent: false,
      paymentMethod: item.coveredBy === 'obc' ? 'obc' : isComped ? 'comp' : 'cash',
      spendingCategory: 'internet',
      status: item.status === 'estimated' ? 'expected' : item.status,
      notes: item.notes,
    });
  }

  for (const item of input.dining ?? []) {
    const isComped = isCompedOnboardCoverage(item.coveredBy);
    add({
      id: `${item.id}-ledger`,
      cruiseId: input.cruiseId,
      category: 'specialty-dining',
      label: `Specialty dining: ${item.diningType}`,
      amount: money(item.confirmedTotalPrice) || money(item.valueAmount),
      source: item.source,
      appliesTo: 'onboard-spend',
      isCashEquivalent: false,
      paymentMethod: item.coveredBy === 'obc' || item.coveredBy === 'nextcruise-obc' || item.coveredBy === 'travel-agent-obc' ? 'obc' : isComped ? 'comp' : 'cash',
      spendingCategory: 'specialty-dining',
      status: item.status === 'estimated' ? 'expected' : item.status,
      notes: item.notes,
    });
  }

  for (const item of input.spa ?? []) {
    const category = item.serviceType === 'thermal-suite' ? 'thermal-suite' : item.serviceType === 'salon' ? 'salon' : item.serviceType === 'fitness-class' ? 'fitness-class' : 'spa';
    const isComped = isCompedOnboardCoverage(item.coveredBy);
    add({
      id: `${item.id}-ledger`,
      cruiseId: input.cruiseId,
      category,
      label: `Spa/salon/fitness: ${item.serviceType}`,
      amount: money(item.confirmedTotalPrice) || money(item.valueAmount),
      source: item.source,
      appliesTo: 'onboard-spend',
      isCashEquivalent: false,
      paymentMethod: item.coveredBy === 'obc' || item.coveredBy === 'nextcruise-obc' || item.coveredBy === 'travel-agent-obc' ? 'obc' : isComped ? 'comp' : 'cash',
      spendingCategory: category,
      status: item.status === 'estimated' ? 'expected' : item.status,
      notes: item.notes,
    });
  }
  return rows;
}
