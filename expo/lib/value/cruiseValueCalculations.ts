import { buildLedgerFromCruise, type CruiseValueLedgerItem } from '@/lib/value/cruiseValueLedger';

type CruiseValueTotals = {
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
  freePlay: number;
  internetBenefitValue: number;
  specialtyDiningBenefitValue: number;
  spaSalonThermalBenefitValue: number;
  taxesAndFees: number;
  cashPaid: number;
  onboardCashSpend: number;
  netOutOfPocket: number;
  totalGrossValue: number;
  totalOnboardAddonValue: number;
  totalValueReceived: number;
  trueNetValue: number;
  casinoCompValue: number;
  crownAnchorValue: number;
  futureCreditApplied: number;
  warnings: string[];
};

function sum(items: CruiseValueLedgerItem[], predicate: (item: CruiseValueLedgerItem) => boolean): number {
  return items.filter(predicate).reduce((total, item) => total + (Number(item.amount) || 0), 0);
}

export function calculateCruiseValueFromLedger(items: CruiseValueLedgerItem[]): CruiseValueTotals {
  const retailFareValue = sum(items, item => item.category === 'casino-offer' || item.category === 'instant-certificate' || item.category === 'club-royale-annual-cruise' || item.category === 'crown-anchor-milestone-cruise');
  const casinoOfferValue = sum(items, item => item.category === 'casino-offer');
  const instantCertificateValue = sum(items, item => item.category === 'instant-certificate');
  const clubRoyaleAnnualCruiseValue = sum(items, item => item.category === 'club-royale-annual-cruise');
  const crownAnchorCertificateValue = sum(items, item => item.category === 'crown-anchor-milestone-cruise');
  const nextCruiseObc = sum(items, item => item.category === 'nextcruise-obc');
  const nextCruiseSavings = sum(items, item => item.category === 'nextcruise-instant-savings');
  const signatureObc = sum(items, item => item.category === 'signature-obc');
  const mastersObc = sum(items, item => item.category === 'masters-obc');
  const fccApplied = sum(items, item => item.category === 'future-cruise-credit');
  const freePlay = sum(items, item => item.category === 'freeplay');
  const internetBenefitValue = sum(items, item => item.category === 'internet' && item.paymentMethod !== 'cash' && item.paymentMethod !== 'obc');
  const specialtyDiningBenefitValue = sum(items, item => item.category === 'specialty-dining' && item.paymentMethod !== 'cash' && item.paymentMethod !== 'obc');
  const spaSalonThermalBenefitValue = sum(items, item => ['spa', 'salon', 'thermal-suite', 'fitness-class'].includes(item.category) && item.paymentMethod !== 'cash' && item.paymentMethod !== 'obc');
  const taxesAndFees = sum(items, item => item.category === 'taxes-fees');
  const cashPaid = sum(items, item => item.category === 'cash-paid');
  const onboardCashSpend = sum(items, item => item.appliesTo === 'onboard-spend' && item.paymentMethod === 'cash');
  const futureCreditApplied = fccApplied + nextCruiseSavings;
  const totalOnboardAddonValue = internetBenefitValue + specialtyDiningBenefitValue + spaSalonThermalBenefitValue;
  const totalGrossValue = retailFareValue + nextCruiseObc + signatureObc + mastersObc + freePlay + totalOnboardAddonValue;
  const netOutOfPocket = Math.max(0, cashPaid + taxesAndFees + onboardCashSpend - fccApplied);
  const casinoCompValue = casinoOfferValue + instantCertificateValue + clubRoyaleAnnualCruiseValue + freePlay + signatureObc + mastersObc + totalOnboardAddonValue;
  const crownAnchorValue = crownAnchorCertificateValue;
  const totalValueReceived = totalGrossValue;
  const trueNetValue = totalValueReceived - netOutOfPocket;

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
    freePlay,
    internetBenefitValue,
    specialtyDiningBenefitValue,
    spaSalonThermalBenefitValue,
    taxesAndFees,
    cashPaid,
    onboardCashSpend,
    netOutOfPocket,
    totalGrossValue,
    totalOnboardAddonValue,
    totalValueReceived,
    trueNetValue,
    casinoCompValue,
    crownAnchorValue,
    futureCreditApplied,
    warnings: ['FCCs reduce cash owed but are not counted as casino comp value.', 'OBC is counted once; items purchased with OBC should be tagged as spending category, not added again as separate value.'],
  };
}

export function calculateCruiseValueWithLedger(cruise: Record<string, unknown>) {
  const ledger = buildLedgerFromCruise(cruise);
  return { ledger, totals: calculateCruiseValueFromLedger(ledger) };
}
