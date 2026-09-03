import type { BookedCruise } from '@/types/models';

export type PostCruiseCloseoutInput = {
  startingCash: string;
  endingCash: string;
  hoursPlayed: string;
  explicitCoinIn: string;
  slotPointsConfirmed: boolean;
  ratedGamingDays: string;
  handpays: string;
  handpaysIncludedInEndingCash: boolean;
  pointsEarned: string;
  folioCasinoCharges: string;
  winningsBroughtHome: string;
  casinoLoss: string;
  hostComps: string;
  certificateCode: string;
  certificateValue: string;
  offerUsedCode: string;
  taxesFeesActual: string;
  satisfaction: string;
  notes: string;
};

export const EMPTY_POST_CRUISE_CLOSEOUT: PostCruiseCloseoutInput = { startingCash:'',endingCash:'',hoursPlayed:'',explicitCoinIn:'',slotPointsConfirmed:false,ratedGamingDays:'',handpays:'',handpaysIncludedInEndingCash:true,pointsEarned:'',folioCasinoCharges:'',winningsBroughtHome:'',casinoLoss:'',hostComps:'',certificateCode:'',certificateValue:'',offerUsedCode:'',taxesFeesActual:'',satisfaction:'',notes:'' };
const amount = (value: unknown): number | undefined => typeof value !== 'string' || value.trim() === '' ? undefined : Number(value.replace(/[$,]/g, ''));

export function validatePostCruiseCloseout(input: PostCruiseCloseoutInput): string[] {
  const errors: string[] = [];
  const numeric: Array<[Exclude<keyof PostCruiseCloseoutInput, 'handpaysIncludedInEndingCash' | 'slotPointsConfirmed'>, string]> = [['startingCash','Starting cash'],['endingCash','Ending cash'],['hoursPlayed','Hours played'],['explicitCoinIn','Coin-in'],['ratedGamingDays','Rated gaming days'],['handpays','Handpays'],['pointsEarned','Points'],['folioCasinoCharges','Folio casino charges'],['winningsBroughtHome','Winnings brought home'],['casinoLoss','Casino loss'],['hostComps','Host comps'],['certificateValue','Certificate value'],['taxesFeesActual','Taxes and fees'],['satisfaction','Satisfaction']];
  numeric.forEach(([key,label]) => { const parsed=amount(input[key]); if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) errors.push(`${label} must be zero or greater.`); });
  const satisfaction = amount(input.satisfaction); if (satisfaction !== undefined && (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5)) errors.push('Satisfaction must be a whole number from 1 to 5.');
  const ratedDays = amount(input.ratedGamingDays); if (ratedDays !== undefined && !Number.isInteger(ratedDays)) errors.push('Rated gaming days must be a whole number.');
  if (String(input.certificateValue ?? '').trim() && !String(input.certificateCode ?? '').trim()) errors.push('Add the earned certificate code when recording a certificate value.');
  return errors;
}

export function buildPostCruiseCloseoutPatch(input: PostCruiseCloseoutInput, w2g: { count: number; amount: number }, completedAt = new Date().toISOString(), expected?: { points: number; pointsPerHour: number; source: string }): Partial<BookedCruise> {
  const errors = validatePostCruiseCloseout(input); if (errors.length) throw new Error(errors.join(' '));
  const points = amount(input.pointsEarned); const winnings = amount(input.winningsBroughtHome); const loss = amount(input.casinoLoss);
  const startingCash = amount(input.startingCash); const endingCash = amount(input.endingCash); const handpays = amount(input.handpays) ?? 0;
  const cashResult = startingCash !== undefined && endingCash !== undefined
    ? endingCash + (input.handpaysIncludedInEndingCash ? 0 : handpays) - startingCash
    : loss === undefined ? undefined : -loss;
  return {
    ...(points === undefined ? {} : { pointsEarned: points, earnedPoints: points, casinoPoints: points }),
    ...(amount(input.folioCasinoCharges) === undefined ? {} : { casinoChargesRoomBilled: amount(input.folioCasinoCharges) }),
    ...(winnings === undefined ? {} : { winningsBroughtHome: winnings }),
    ...(startingCash === undefined ? {} : { casinoStartingCash: startingCash }),
    ...(endingCash === undefined ? {} : { casinoEndingCash: endingCash }),
    ...(amount(input.handpays) === undefined ? {} : { casinoHandpays: handpays, casinoHandpaysIncludedInEndingCash: input.handpaysIncludedInEndingCash }),
    ...(amount(input.hoursPlayed) === undefined ? {} : { hoursPlayed: amount(input.hoursPlayed) }),
    ...(amount(input.explicitCoinIn) !== undefined
      ? { coinIn: amount(input.explicitCoinIn), coinInCalculationSource: 'actual' as const }
      : points !== undefined && input.slotPointsConfirmed
        ? { coinIn: points * 5, coinInCalculationSource: 'club_royale_slot_points_estimate' as const, slotPointsConfirmed: true }
        : { slotPointsConfirmed: false }),
    ...(amount(input.ratedGamingDays) === undefined ? {} : { ratedGamingDays: amount(input.ratedGamingDays) }),
    ...(cashResult === undefined ? {} : { actualLoss: Math.max(0, -cashResult), cashResult, netResult: cashResult }),
    ...(expected ? { expectedPointsForHours: expected.points, pointsVsExpected: points === undefined ? undefined : points - expected.points, expectedPointsPerHourSource: `${expected.pointsPerHour.toFixed(1)} PPH — ${expected.source}` } : {}),
    ...(amount(input.hostComps) === undefined ? {} : { hostCompsReceived: amount(input.hostComps) }),
    ...(input.certificateCode.trim() ? { instantCertificateWon: true, instantCertificateOfferCode: input.certificateCode.trim().toUpperCase() } : {}),
    ...(amount(input.certificateValue) === undefined ? {} : { instantCertificateValue: amount(input.certificateValue) }),
    ...(input.offerUsedCode.trim() ? { offerUsedCode: input.offerUsedCode.trim().toUpperCase() } : {}),
    ...(amount(input.taxesFeesActual) === undefined ? {} : { taxesFeesActual: amount(input.taxesFeesActual) }),
    ...(amount(input.satisfaction) === undefined ? {} : { postCruiseSatisfaction: amount(input.satisfaction) }),
    postCruiseCloseoutNotes: input.notes.trim(), w2gRecordCount: w2g.count, w2gTotalAmount: w2g.amount,
    postCruiseCloseoutAt: completedAt, closeoutStatus: 'complete', completionState: 'completed', calculationConfidence: expected ? 'mixed' : 'actual',
  };
}

export function closeoutProgress(input: PostCruiseCloseoutInput): number {
  const usesNewSummary = 'startingCash' in input || 'endingCash' in input || 'hoursPlayed' in input;
  const required: Array<Exclude<keyof PostCruiseCloseoutInput, 'handpaysIncludedInEndingCash' | 'slotPointsConfirmed'>> = usesNewSummary
    ? ['startingCash','endingCash','hoursPlayed','pointsEarned','certificateCode','hostComps']
    : ['pointsEarned','folioCasinoCharges','winningsBroughtHome','casinoLoss','hostComps','certificateCode','offerUsedCode','taxesFeesActual','satisfaction'];
  return Math.round((required.filter((key) => String(input[key] ?? '').trim() !== '').length / required.length) * 100);
}
