import { detectLedgerDoubleCountingWarnings, isSpendItem, isValueItem, sumLedgerItems, type CruiseValueLedgerItem } from './cruiseValueLedger';

export type InternetValueItem = {
  id: string;
  cruiseId: string;
  packageName: 'voom' | 'unknown';
  devices: number;
  days: number;
  retailPricePerDevicePerDay: number;
  confirmedTotalPrice?: number;
  calculatedValue: number;
  coveredBy: 'signature' | 'masters' | 'pinnacle' | 'casino-offer' | 'obc' | 'manual' | 'none' | 'unknown';
  status: 'estimated' | 'confirmed' | 'applied' | 'used' | 'unknown';
  source: 'default-voom-rate' | 'manual' | 'invoice' | 'cruise-planner' | 'unknown';
  notes?: string;
};

export type SpecialtyDiningValueItem = {
  id: string;
  cruiseId: string;
  diningType: 'single-restaurant' | 'chops' | 'izumi' | 'giovannis' | 'jamies' | 'wonderland' | 'hooked' | '150-central-park' | 'chef-table' | 'three-night-package' | 'unlimited-dining-package' | 'unknown';
  guests: number;
  mealsIncluded?: number;
  retailPricePerGuest?: number;
  confirmedTotalPrice?: number;
  coveredBy: 'casino-offer' | 'obc' | 'nextcruise-obc' | 'travel-agent-obc' | 'manual' | 'none' | 'unknown';
  valueAmount: number;
  status: 'estimated' | 'confirmed' | 'applied' | 'used' | 'unknown';
  source: 'manual' | 'invoice' | 'cruise-planner' | 'offer-parser' | 'folio' | 'unknown';
  notes?: string;
};

export type SpaValueItem = {
  id: string;
  cruiseId: string;
  serviceType: 'massage' | 'facial' | 'body-treatment' | 'thermal-suite' | 'salon' | 'fitness-class' | 'personal-training' | 'unknown';
  guests: number;
  serviceCount: number;
  retailPricePerService?: number;
  confirmedTotalPrice?: number;
  coveredBy: 'casino-offer' | 'obc' | 'nextcruise-obc' | 'travel-agent-obc' | 'manual' | 'none' | 'unknown';
  valueAmount: number;
  status: 'estimated' | 'confirmed' | 'applied' | 'used' | 'unknown';
  source: 'manual' | 'invoice' | 'cruise-planner' | 'folio' | 'unknown';
  notes?: string;
};

export const DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY = 30;

function n(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export function calculateVoomValue(input: { devices?: number; days?: number; retailPricePerDevicePerDay?: number; confirmedTotalPrice?: number }): number {
  if (Number.isFinite(Number(input.confirmedTotalPrice))) return Math.max(0, Number(input.confirmedTotalPrice));
  return Math.max(0, n(input.devices) * n(input.days) * (input.retailPricePerDevicePerDay ?? DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY));
}

export function createVoomValueItem(input: Partial<InternetValueItem> & { id: string; cruiseId: string; devices: number; days: number }): InternetValueItem {
  const price = input.retailPricePerDevicePerDay ?? DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY;
  return {
    id: input.id,
    cruiseId: input.cruiseId,
    packageName: input.packageName ?? 'voom',
    devices: input.devices,
    days: input.days,
    retailPricePerDevicePerDay: price,
    confirmedTotalPrice: input.confirmedTotalPrice,
    calculatedValue: calculateVoomValue({ devices: input.devices, days: input.days, retailPricePerDevicePerDay: price, confirmedTotalPrice: input.confirmedTotalPrice }),
    coveredBy: input.coveredBy ?? 'unknown',
    status: input.status ?? 'estimated',
    source: input.source ?? 'default-voom-rate',
    notes: input.notes,
  };
}

export type CruiseValueCalculation = {
  retailFareValue: number;
  casinoOfferValue: number;
  instantCertificateValue: number;
  clubRoyaleAnnualCruiseValue: number;
  crownAnchorCertificateValue: number;
  nextCruiseObc: number;
  nextCruiseSavings: number;
  signatureObc: number;
  mastersObc: number;
  fccApplied: number;
  freeplay: number;
  internetBenefitValue: number;
  specialtyDiningBenefitValue: number;
  spaSalonThermalBenefitValue: number;
  taxesAndFees: number;
  cashPaid: number;
  onboardCashSpend: number;
  totalGrossValue: number;
  totalOnboardAddOnValue: number;
  totalOnboardSpend: number;
  totalOutOfPocket: number;
  totalValueReceived: number;
  trueNetValue: number;
  casinoCompValue: number;
  crownAnchorValue: number;
  futureCreditApplied: number;
  warnings: string[];
};

export function calculateCruiseValueFromLedger(items: CruiseValueLedgerItem[]): CruiseValueCalculation {
  const active = (items ?? []).filter((item) => item.status !== 'expired');
  const retailFareValue = sumLedgerItems(active, (i) => i.category === 'casino-offer' && i.appliesTo === 'cruise-fare');
  const casinoOfferValue = sumLedgerItems(active, (i) => i.category === 'casino-offer');
  const instantCertificateValue = sumLedgerItems(active, (i) => i.category === 'instant-certificate');
  const clubRoyaleAnnualCruiseValue = sumLedgerItems(active, (i) => i.category === 'club-royale-annual-cruise');
  const crownAnchorCertificateValue = sumLedgerItems(active, (i) => i.category === 'crown-anchor-milestone-cruise');
  const nextCruiseObc = sumLedgerItems(active, (i) => i.category === 'nextcruise-obc');
  const nextCruiseSavings = sumLedgerItems(active, (i) => i.category === 'nextcruise-instant-savings');
  const signatureObc = sumLedgerItems(active, (i) => i.category === 'signature-obc');
  const mastersObc = sumLedgerItems(active, (i) => i.category === 'masters-obc');
  const fccApplied = sumLedgerItems(active, (i) => i.category === 'future-cruise-credit' || i.paymentMethod === 'fcc');
  const freeplay = sumLedgerItems(active, (i) => i.category === 'freeplay');
  const internetBenefitValue = sumLedgerItems(active, (i) => i.category === 'internet' && i.paymentMethod !== 'cash' && i.paymentMethod !== 'obc');
  const specialtyDiningBenefitValue = sumLedgerItems(active, (i) => i.category === 'specialty-dining' && i.paymentMethod !== 'cash' && i.paymentMethod !== 'obc');
  const spaSalonThermalBenefitValue = sumLedgerItems(active, (i) => ['spa', 'salon', 'thermal-suite', 'fitness-class'].includes(i.category) && i.paymentMethod !== 'cash' && i.paymentMethod !== 'obc');
  const taxesAndFees = sumLedgerItems(active, (i) => i.category === 'taxes-fees');
  const cashPaid = sumLedgerItems(active, (i) => i.category === 'cash-paid' || i.paymentMethod === 'cash' && i.appliesTo !== 'onboard-spend');
  const onboardCashSpend = sumLedgerItems(active, (i) => i.paymentMethod === 'cash' && i.appliesTo === 'onboard-spend');
  const onboardCreditValue = sumLedgerItems(active, (i) => ['onboard-credit', 'signature-obc', 'masters-obc', 'shareholder-obc', 'travel-agent-obc', 'promo-obc', 'nextcruise-obc'].includes(i.category));
  const includedValue = sumLedgerItems(active, isValueItem);
  const totalOnboardAddOnValue = internetBenefitValue + specialtyDiningBenefitValue + spaSalonThermalBenefitValue;
  const totalOnboardSpend = onboardCashSpend;
  const totalGrossValue = includedValue;
  const totalOutOfPocket = Math.max(0, cashPaid + taxesAndFees + onboardCashSpend - fccApplied);
  const totalValueReceived = totalGrossValue;
  const casinoCompValue = casinoOfferValue + instantCertificateValue + clubRoyaleAnnualCruiseValue + freeplay + signatureObc + mastersObc + internetBenefitValue + specialtyDiningBenefitValue + spaSalonThermalBenefitValue;
  const crownAnchorValue = crownAnchorCertificateValue;
  const futureCreditApplied = fccApplied + nextCruiseSavings;
  const trueNetValue = totalValueReceived - totalOutOfPocket;
  const spendWarnings = active.filter(isSpendItem).length ? [] : ['No cash spend, taxes, or onboard spend ledger items are attached yet.'];

  return {
    retailFareValue,
    casinoOfferValue,
    instantCertificateValue,
    clubRoyaleAnnualCruiseValue,
    crownAnchorCertificateValue,
    nextCruiseObc,
    nextCruiseSavings,
    signatureObc,
    mastersObc,
    fccApplied,
    freeplay,
    internetBenefitValue,
    specialtyDiningBenefitValue,
    spaSalonThermalBenefitValue,
    taxesAndFees,
    cashPaid,
    onboardCashSpend,
    totalGrossValue,
    totalOnboardAddOnValue,
    totalOnboardSpend,
    totalOutOfPocket,
    totalValueReceived,
    trueNetValue,
    casinoCompValue,
    crownAnchorValue,
    futureCreditApplied,
    warnings: [...detectLedgerDoubleCountingWarnings(active), ...spendWarnings, ...(onboardCreditValue > 0 ? ['Onboard credit is counted once as value; OBC-paid items are spending categories, not additional comp value.'] : [])],
  };
}
