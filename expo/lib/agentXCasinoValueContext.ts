import type { AskMyDataContextBlock } from '@/lib/askMyData';
import { calculateCruiseValueWithLedger } from '@/lib/value/cruiseValueCalculations';
import { buildDefaultUserBenefitOverrides } from '@/lib/value/userBenefitOverrides';
import { DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY } from '@/lib/value/onboardValue';

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function buildCasinoValueAgentXContext(input: {
  bookedCruises: Array<Record<string, unknown>>;
  userId?: string;
}): AskMyDataContextBlock[] {
  const cruises = input.bookedCruises ?? [];
  const totals = cruises.reduce((acc, cruise) => {
    const result = calculateCruiseValueWithLedger(cruise);
    acc.trueNetValue += result.totals.trueNetValue;
    acc.casinoCompValue += result.totals.casinoCompValue;
    acc.crownAnchorValue += result.totals.crownAnchorValue;
    acc.futureCreditApplied += result.totals.futureCreditApplied;
    acc.internetBenefitValue += result.totals.internetBenefitValue;
    acc.signatureObc += result.totals.signatureObc;
    acc.freePlay += result.totals.freePlay;
    acc.rows += result.ledger.length;
    return acc;
  }, { trueNetValue: 0, casinoCompValue: 0, crownAnchorValue: 0, futureCreditApplied: 0, internetBenefitValue: 0, signatureObc: 0, freePlay: 0, rows: 0 });

  const overrides = buildDefaultUserBenefitOverrides(input.userId ?? 'scott');
  const cruiseLines = cruises.slice(0, 8).map((cruise) => {
    const result = calculateCruiseValueWithLedger(cruise);
    return `- ${String(cruise.shipName ?? 'Unknown ship')} ${String(cruise.sailDate ?? cruise.sailingDate ?? '')}: true net ${money(result.totals.trueNetValue)}, casino comp ${money(result.totals.casinoCompValue)}, future credit ${money(result.totals.futureCreditApplied)}, ledger rows ${result.ledger.length}`;
  }).join('\n') || 'No booked/completed cruises loaded into this context.';

  return [
    {
      id: 'casino-value-ledger-engine',
      title: 'Casino value ledger, future wallet, and double-count guardrails',
      subtitle: `${money(totals.casinoCompValue)} casino comp · ${money(totals.trueNetValue)} true net value · ${totals.rows} ledger rows`,
      keywords: ['casino value', 'true make-out', 'future wallet', 'future cruise credit', 'fcc', 'nextcruise', 'signature obc', 'internet', 'voom', 'dining', 'spa', 'double count'],
      detail: [
        `Current ledger roll-up across ${cruises.length} cruise(s): casino comp ${money(totals.casinoCompValue)}, Crown & Anchor value ${money(totals.crownAnchorValue)}, future credit applied ${money(totals.futureCreditApplied)}, Signature OBC ${money(totals.signatureObc)}, FreePlay ${money(totals.freePlay)}, VOOM/internet benefit ${money(totals.internetBenefitValue)}, true net value ${money(totals.trueNetValue)}.`,
        `Default VOOM value rule available to AgentX: $${DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY} per device per day unless invoice, Cruise Planner, or manual value overrides it.`,
        `Loaded user benefit overrides: ${overrides.map((override) => `${override.benefitType}=${money(num(override.amount))} through ${override.validThrough ?? 'open-ended'}`).join('; ')}.`,
        `Double-count guardrails: FCCs reduce cash owed but are not casino comp value. OBC is counted once; the item purchased with OBC is tagged as a spending category, not added again as separate value. Coin-in is gambling volume and must not be treated as cost or profit.`,
        `Cruise ledger preview:\n${cruiseLines}`,
      ].join('\n'),
      actionLabel: 'Use casino value ledger',
    },
  ];
}
