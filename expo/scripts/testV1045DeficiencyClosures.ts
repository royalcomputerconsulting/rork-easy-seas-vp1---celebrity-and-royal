import { estimateCoinInForPoints, calculatePointsFromCoinIn } from '../lib/casino/pointsEarning';
import { parseInstantCertificateIndexText, NEXT_MONTH_UNAVAILABLE_MESSAGE, buildUnavailableInstantCertificateIndex } from '../lib/certificates/instantCertificateIndexParser';
import { parseInstantCertificateDetailText } from '../lib/certificates/instantCertificateDetailParser';
import { buildCertificateIndexUrl } from '../lib/certificates/instantCertificateUrls';
import { createLedgerItem, detectLedgerDoubleCountingWarnings } from '../lib/value/cruiseValueLedger';
import { buildFutureValueWallet, applyFccToCruise, getScottSignatureObcOverride, isBenefitOverrideActive } from '../lib/value/futureValueWallet';
import { calculateCruiseValueFromLedger, calculateVoomValue, createVoomValueItem } from '../lib/value/valueCalculations';
import { buildFullDailyLuckRecord, exportDailyLuckRecordToCsvRow, exportDailyLuckRecordToIcs, getChineseYearContext } from '../lib/dailyLuck/luckCalendarEngine';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const royalSlot = calculatePointsFromCoinIn({ cashCoinIn: 500, freeplayCoinIn: 500, brand: 'royal', gameCategory: 'reel-slot' });
assert(royalSlot.points === 100, 'Royal slot points should use cash coin-in only when FreePlay is present.');
assert(royalSlot.warnings.some((warning) => warning.includes('FreePlay')), 'FreePlay warning missing.');
assert(calculatePointsFromCoinIn({ coinIn: 1500, brand: 'royal', gameCategory: 'video-poker' }).points === 100, 'Royal video poker should use $15 coin-in per point.');
assert(estimateCoinInForPoints({ targetPoints: 2000, brand: 'royal', gameCategory: 'reel-slot' }).coinIn === 10000, 'Slot coin-in estimate should come from points engine.');

const index = parseInstantCertificateIndexText({
  text: 'VIP2 40,000 POINTS\n01 25,000 POINTS\n05 2,000 POINTS\n10 400 POINTS',
  monthCode: '2607',
  bank: 'C',
  sourceUrl: buildCertificateIndexUrl('2607', 'C'),
});
assert(index.status === 'partial', 'Index parser should detect partial ladder when only some codes appear.');
assert(index.levels.some((level) => level.levelCode === '05' && level.pointsRequired === 2000), 'Index parser should preserve level 05 points.');
const unavailable = buildUnavailableInstantCertificateIndex({ monthCode: '2608', bank: 'A', sourceUrl: buildCertificateIndexUrl('2608', 'A'), isNextMonth: true });
assert(unavailable.warnings.includes(NEXT_MONTH_UNAVAILABLE_MESSAGE), 'Next-month unavailable message must match requirement.');

const detail = parseInstantCertificateDetailText({
  offerCode: '2607C05',
  text: 'Wonder of the Seas Aug 24, 2026 7 Night Eastern Caribbean Balcony GTY Cruise Fare For 2 Guests FreePlay $500 OBC $75 Taxes and Fees apply',
});
assert(detail.sailings.length === 1, 'Detail parser should parse a sailing row.');
assert(detail.sailings[0].stateroomCategory === 'balcony', 'Detail parser should parse balcony.');
assert(detail.sailings[0].guestCoverage === 'cruise-fare-for-2', 'Detail parser should parse guest coverage.');
assert(detail.sailings[0].nextCruiseBonusFreeplay === 500, 'Detail parser should parse FreePlay.');

const voom = createVoomValueItem({ id: 'voom-1', cruiseId: 'cruise-1', devices: 2, days: 7, coveredBy: 'signature' });
assert(voom.calculatedValue === 420, 'VOOM default should be $30/device/day.');
assert(calculateVoomValue({ devices: 1, days: 4, confirmedTotalPrice: 99 }) === 99, 'VOOM confirmed override should win.');

const ledger = [
  createLedgerItem({ cruiseId: 'cruise-1', category: 'casino-offer', label: 'Casino comp fare', amount: 2000, source: 'club-royale', appliesTo: 'cruise-fare', paymentMethod: 'comp', isCashEquivalent: false, status: 'confirmed' }),
  createLedgerItem({ cruiseId: 'cruise-1', category: 'signature-obc', label: 'Signature OBC', amount: 75, source: 'club-royale', appliesTo: 'onboard-account', paymentMethod: 'comp', isCashEquivalent: true, status: 'confirmed' }),
  createLedgerItem({ cruiseId: 'cruise-1', category: 'specialty-dining', label: 'Chops paid with OBC', amount: 75, source: 'folio', appliesTo: 'onboard-spend', paymentMethod: 'obc', spendingCategory: 'specialty-dining', isCashEquivalent: false, status: 'used' }),
  createLedgerItem({ cruiseId: 'cruise-1', category: 'future-cruise-credit', label: 'FCC applied', amount: 100, source: 'fcc', appliesTo: 'cruise-fare', paymentMethod: 'fcc', isCashEquivalent: true, status: 'applied' }),
  createLedgerItem({ cruiseId: 'cruise-1', category: 'internet', label: 'Free VOOM', amount: 210, source: 'club-royale', appliesTo: 'onboard-account', paymentMethod: 'comp', isCashEquivalent: false, status: 'confirmed' }),
];
const calc = calculateCruiseValueFromLedger(ledger);
assert(calc.fccApplied === 100, 'FCC should apply as future credit.');
assert(calc.casinoCompValue >= 2285, 'Casino comp value should include casino offer, Signature OBC, and comped internet.');
assert(calc.specialtyDiningBenefitValue === 0, 'OBC-paid dining should not double-count as comped dining value.');
assert(detectLedgerDoubleCountingWarnings(ledger).length >= 2, 'Double-count warnings should include OBC and FCC guidance.');

const fcc = applyFccToCruise({ id: 'fcc-1', amountOriginal: 500, amountRemaining: 500, currency: 'USD', appliedCruiseIds: [], status: 'available', source: 'manual' }, 'cruise-1', 125);
assert(fcc.amountRemaining === 375 && fcc.status === 'partially-used', 'FCC partial usage should track remaining amount.');
const wallet = buildFutureValueWallet({ futureCruiseCredits: [fcc], nextCruiseCertificates: [{ id: 'nc-1', bookingType: 'book-later', createdDate: '2026-01-01', selectionDeadline: '2026-07-15', depositPaid: 200, offerType: 'obc', estimatedValue: 100, status: 'unassigned' }], today: '2026-07-01', expiringWithinDays: 30 });
assert(wallet.expiringSoon.length === 1, 'Wallet should flag expiring NextCruise certificate.');
const override = getScottSignatureObcOverride();
assert(isBenefitOverrideActive(override, '2026-02-28'), 'Scott Signature OBC override should be active through 2026-02-28.');
assert(!isBenefitOverrideActive(override, '2026-03-01'), 'Scott Signature OBC override should stop after 2026-02-28.');

assert(getChineseYearContext('2026-02-16').label === 'Wood Snake', 'Chinese year boundary before 2026 CNY should be Wood Snake.');
assert(getChineseYearContext('2026-02-17').label === 'Fire Horse', 'Chinese year boundary on 2026 CNY should be Fire Horse.');
const luck = buildFullDailyLuckRecord({
  date: '2026-07-05',
  mode: 'casino',
  profile: { id: 'scott', name: 'Scott', birthDate: '1969-04-12', westernSunSign: 'Aries', moonSign: 'Aquarius', risingSign: 'Taurus', chineseZodiac: 'Rooster', chineseElement: 'Earth' },
  context: { locationType: 'cruise', seaDay: true, casinoOpenExpected: true },
  sources: [{ sourceType: 'tarot', sourceName: 'Internal symbolic deck', retrievedAt: '2026-07-05T08:00:00-07:00' }],
});
assert(luck.luckyScore1To9 >= 1 && luck.luckyScore1To9 <= 9, 'Daily Luck 1-9 score must be valid.');
assert(luck.disclaimer.includes('does not guarantee money'), 'Daily Luck disclaimer must include no-guarantee safety.');
assert(exportDailyLuckRecordToCsvRow(luck).includes('Casino discipline'), 'Daily Luck CSV should include focus/casino context.');
assert(exportDailyLuckRecordToIcs(luck).includes('BEGIN:VEVENT'), 'Daily Luck ICS export should produce an event.');

console.log('✅ v1045 deficiency closure tests passed');
