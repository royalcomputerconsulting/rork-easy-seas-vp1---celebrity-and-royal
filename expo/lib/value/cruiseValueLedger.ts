import { buildAnnualAndMilestoneLedgerItems } from '@/lib/value/annualCruiseBenefits';
import { buildOnboardValueLedgerItems, buildInternetValueItem } from '@/lib/value/onboardValue';
import { getExpectedBenefitOverrideAmount, SCOTT_SIGNATURE_OBC_OVERRIDE } from '@/lib/value/userBenefitOverrides';

export type CruiseValueCategory =
  | 'casino-offer' | 'instant-certificate' | 'club-royale-annual-cruise' | 'crown-anchor-milestone-cruise'
  | 'nextcruise-obc' | 'nextcruise-instant-savings' | 'future-cruise-credit' | 'signature-obc' | 'masters-obc'
  | 'shareholder-obc' | 'travel-agent-obc' | 'promo-obc' | 'freeplay' | 'internet' | 'specialty-dining'
  | 'spa' | 'fitness-class' | 'salon' | 'thermal-suite' | 'onboard-credit' | 'taxes-fees' | 'cash-paid' | 'unknown';

export type CruiseValueLedgerItem = {
  id: string;
  cruiseId: string;
  category: CruiseValueCategory;
  label: string;
  amount: number;
  currency: 'USD';
  source: 'manual' | 'invoice' | 'club-royale' | 'crown-anchor' | 'nextcruise' | 'fcc' | 'offer-parser' | 'agentx' | 'cruise-planner' | 'folio' | 'unknown';
  appliesTo: 'cruise-fare' | 'onboard-account' | 'freeplay' | 'taxes-fees' | 'deposit' | 'future-booking' | 'onboard-spend' | 'unknown';
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
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export function buildLedgerFromCruise(cruise: Record<string, unknown>): CruiseValueLedgerItem[] {
  const id = String(cruise.id ?? 'unknown-cruise');
  const now = new Date().toISOString();
  const rows: CruiseValueLedgerItem[] = [];
  const add = (category: CruiseValueCategory, label: string, amount: number, source: CruiseValueLedgerItem['source'], appliesTo: CruiseValueLedgerItem['appliesTo'], paymentMethod?: CruiseValueLedgerItem['paymentMethod'], spendingCategory?: CruiseValueCategory) => {
    if (!amount) return;
    rows.push({ id: `${id}-${category}-${rows.length}`, cruiseId: id, category, label, amount, currency: 'USD', source, appliesTo, isCashEquivalent: ['future-cruise-credit', 'cash-paid', 'taxes-fees'].includes(category), isRefundable: null, isStackable: null, paymentMethod, spendingCategory, status: 'expected', createdAt: now, updatedAt: now });
  };

  add('casino-offer', 'Casino offer / comp value', n(cruise.compValue) || n(cruise.offerValue) || n(cruise.totalCasinoDiscount), 'club-royale', 'cruise-fare', 'comp');
  add('instant-certificate', 'Instant certificate value', n(cruise.instantCertificateValue), 'club-royale', 'cruise-fare', 'comp');
  add('freeplay', 'Casino FreePlay', n(cruise.freePlay) || n(cruise.freeplayAmount), 'club-royale', 'freeplay', 'comp');
  const expectedSignatureObc = getExpectedBenefitOverrideAmount({ cruise, override: SCOTT_SIGNATURE_OBC_OVERRIDE, date: String(cruise.sailDate ?? cruise.sailingDate ?? '') });
  add('signature-obc', expectedSignatureObc.status === 'confirmed' ? 'Signature OBC confirmed' : 'Signature OBC expected', n(cruise.signatureObc) || n(cruise.signatureOBC) || expectedSignatureObc.amount, 'club-royale', 'onboard-account', 'comp');
  add('masters-obc', 'Masters OBC', n(cruise.mastersObc) || n(cruise.mastersOBC), 'club-royale', 'onboard-account', 'comp');
  add('nextcruise-instant-savings', 'NextCruise instant savings', n(cruise.nextCruiseInstantSavings), 'nextcruise', 'cruise-fare', 'comp');
  add('club-royale-annual-cruise', 'Club Royale annual cruise value', n(cruise.clubRoyaleAnnualCruiseValue) || n(cruise.annualCruiseValue), 'club-royale', 'cruise-fare', 'comp');
  add('crown-anchor-milestone-cruise', 'Crown & Anchor milestone certificate value', n(cruise.crownAnchorCertificateValue) || n(cruise.pinnacleCertificateValue), 'crown-anchor', 'cruise-fare', 'comp');
  add('future-cruise-credit', 'Future Cruise Credit applied', n(cruise.fccApplied), 'fcc', 'cruise-fare', 'fcc');
  add('nextcruise-obc', 'NextCruise OBC', n(cruise.nextCruiseCertificateValue), 'nextcruise', 'onboard-account', 'comp');
  add('internet', 'VOOM / internet benefit', n(cruise.voomValue), 'manual', 'onboard-spend', (n(cruise.voomPaidWithCash) ? 'cash' : 'comp'), 'internet');
  add('specialty-dining', 'Specialty dining benefit', n(cruise.diningValue), 'manual', 'onboard-spend', (n(cruise.diningPaidWithCash) ? 'cash' : 'comp'), 'specialty-dining');
  add('spa', 'Spa / salon / thermal value', n(cruise.spaValue), 'manual', 'onboard-spend', (n(cruise.spaPaidWithCash) ? 'cash' : 'comp'), 'spa');
  add('taxes-fees', 'Taxes and fees', n(cruise.taxes) || n(cruise.taxesFeesEstimate), 'invoice', 'taxes-fees', 'cash');
  add('cash-paid', 'Cash paid', n(cruise.amountPaid) || n(cruise.pricePaid) || n(cruise.actualSpend), 'invoice', 'cruise-fare', 'cash');

  const nights = n(cruise.nights) || 0;
  if (!n(cruise.voomValue) && nights > 0 && (cruise.freeWifi || cruise.freeInternet || cruise.signatureInternet || cruise.mastersInternet || cruise.pinnacleInternet)) {
    rows.push(...buildOnboardValueLedgerItems({
      cruiseId: id,
      internet: [buildInternetValueItem({ cruiseId: id, days: nights, devices: n(cruise.internetDevices) || 1, coveredBy: cruise.signatureInternet ? 'signature' : cruise.mastersInternet ? 'masters' : cruise.pinnacleInternet ? 'pinnacle' : 'casino-offer' })],
    }));
  }

  rows.push(...buildAnnualAndMilestoneLedgerItems({
    cruiseId: id,
    annualBenefits: Array.isArray(cruise.annualCruiseBenefits) ? cruise.annualCruiseBenefits as any : [],
    crownAnchorCertificates: Array.isArray(cruise.crownAnchorCertificates) ? cruise.crownAnchorCertificates as any : [],
  }));

  return rows;
}
