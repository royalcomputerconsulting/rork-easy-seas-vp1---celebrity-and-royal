import type { BookedCruise, CasinoOffer, Cruise, TravelerProfile } from '@/types/models';
import {
  calculateOfferIntelligenceScore,
  getOfferExpiryDate,
  type CertificateLike,
  type OfferIntelligenceScore,
} from '@/lib/offerIntelligence';
import { getDaysUntil, toCalendarDateOnly } from '@/lib/date';

export type BookingDecisionVerdict = 'strong_candidate' | 'worth_considering' | 'compare_first' | 'weak_fit' | 'not_bookable' | 'already_booked';
export type BookingDecisionConfidence = 'high' | 'medium' | 'low';

export interface BookingDecisionFactor {
  id: 'value' | 'cash_cost' | 'schedule' | 'itinerary' | 'evidence';
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
  status: 'positive' | 'neutral' | 'warning' | 'blocking';
}

export interface ShouldIBookResult {
  verdict: BookingDecisionVerdict;
  verdictLabel: string;
  score: number;
  confidence: BookingDecisionConfidence;
  headline: string;
  candidateCruiseId: string;
  estimatedCasinoValue: number;
  estimatedCashCost: number;
  estimatedNetVacationValue: number;
  costPerNight: number | null;
  factors: BookingDecisionFactor[];
  reasons: string[];
  verifyBeforeBooking: string[];
  missingEvidence: string[];
  disclaimer: string;
  offerIntelligence: OfferIntelligenceScore;
}

export interface BookTimingResult {
  recommendation: 'book_now' | 'wait_and_monitor' | 'verify_first' | 'not_bookable';
  confidence: BookingDecisionConfidence;
  reasons: string[];
  missingEvidence: string[];
}

export function evaluateBookTiming(input: {
  decision: ShouldIBookResult;
  daysUntilOfferExpiry?: number | null;
  observedPriceChangePercent?: number | null;
  cabinAvailability?: 'plentiful' | 'limited' | 'unknown';
  alternativeOfferCount?: number;
}): BookTimingResult {
  if (input.decision.verdict === 'not_bookable' || input.decision.verdict === 'already_booked') return { recommendation: 'not_bookable', confidence: input.decision.confidence, reasons: [input.decision.headline], missingEvidence: input.decision.missingEvidence };
  const missing = [...input.decision.missingEvidence];
  if (input.daysUntilOfferExpiry == null) missing.push('offer expiration timing');
  if (input.observedPriceChangePercent == null) missing.push('comparable price trend');
  if (!input.cabinAvailability || input.cabinAvailability === 'unknown') missing.push('current cabin availability');
  const urgency = input.daysUntilOfferExpiry != null && input.daysUntilOfferExpiry <= 14;
  const rising = input.observedPriceChangePercent != null && input.observedPriceChangePercent > 3;
  const limited = input.cabinAvailability === 'limited';
  const alternatives = input.alternativeOfferCount ?? 0;
  if (input.decision.score >= 67 && (urgency || rising || limited)) return { recommendation: 'book_now', confidence: missing.length <= 1 ? 'high' : 'medium', reasons: [urgency ? 'The saved offer is nearing expiration.' : '', rising ? 'Recorded comparable pricing is rising.' : '', limited ? 'Cabin availability is recorded as limited.' : ''].filter(Boolean), missingEvidence: Array.from(new Set(missing)) };
  if (missing.length >= 3) return { recommendation: 'verify_first', confidence: 'low', reasons: ['Material timing inputs are missing; verify the official offer and current sailing before deciding.'], missingEvidence: Array.from(new Set(missing)) };
  return { recommendation: 'wait_and_monitor', confidence: input.decision.confidence, reasons: [alternatives > 1 ? `${alternatives} alternate saved offers reduce immediate urgency.` : 'No verified expiration, price, or availability pressure requires immediate action.'], missingEvidence: Array.from(new Set(missing)) };
}

function rangesOverlap(left: Cruise, right: BookedCruise): boolean {
  const leftStart = toCalendarDateOnly(left.sailDate);
  const leftEnd = toCalendarDateOnly(left.returnDate);
  const rightStart = toCalendarDateOnly(right.sailDate);
  const rightEnd = toCalendarDateOnly(right.returnDate);
  return Boolean(leftStart && leftEnd && rightStart && rightEnd && leftStart <= rightEnd && rightStart <= leftEnd);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function verdictFor(score: number): { verdict: BookingDecisionVerdict; label: string } {
  if (score >= 82) return { verdict: 'strong_candidate', label: 'Strong candidate' };
  if (score >= 67) return { verdict: 'worth_considering', label: 'Worth considering' };
  if (score >= 50) return { verdict: 'compare_first', label: 'Compare first' };
  return { verdict: 'weak_fit', label: 'Weak fit' };
}

export function evaluateShouldIBook(input: {
  offer: CasinoOffer;
  cruise: Cruise;
  bookedCruises?: BookedCruise[];
  certificates?: CertificateLike[];
  profile?: Partial<TravelerProfile> | null;
}): ShouldIBookResult {
  const bookedCruises = input.bookedCruises ?? [];
  const intelligence = calculateOfferIntelligenceScore(input.offer, [input.cruise], input.certificates ?? [], input.profile);
  const coveredValue = intelligence.casinoPaysFor.casinoCoveredValue;
  const cashCost = intelligence.casinoPaysFor.userOutOfPocket;
  const netValue = coveredValue - cashCost;
  const costPerNight = input.cruise.nights > 0 ? Math.round(cashCost / input.cruise.nights) : null;
  const exactCandidateAlreadyBooked = bookedCruises.some((booked) => booked.id === input.cruise.id || (
    booked.shipName?.trim().toLowerCase() === input.cruise.shipName?.trim().toLowerCase()
    && toCalendarDateOnly(booked.sailDate) === toCalendarDateOnly(input.cruise.sailDate)
  ));
  const conflicts = bookedCruises.filter((booked) => !exactCandidateAlreadyBooked && rangesOverlap(input.cruise, booked));
  const expiryDate = getOfferExpiryDate(input.offer);
  const expiryDays = expiryDate ? getDaysUntil(expiryDate) : null;
  const expired = expiryDays !== null && expiryDays < 0;

  const valuePoints = Math.min(45, Math.round(intelligence.score * 0.45));
  const cashPoints = cashCost === 0 ? 20 : coveredValue > 0 && cashCost / coveredValue <= 0.15 ? 17 : coveredValue > cashCost ? 12 : 4;
  const schedulePoints = conflicts.length === 0 ? 20 : 0;
  const itineraryKnown = Boolean(input.cruise.destination || input.cruise.itineraryName || input.cruise.ports?.length);
  const itineraryPoints = itineraryKnown ? 10 : 3;
  const missingEvidence = Array.from(new Set([
    ...intelligence.casinoPaysFor.missingInputs,
    ...(!input.cruise.departurePort ? ['departure port'] : []),
    ...(!itineraryKnown ? ['itinerary or destination'] : []),
    ...(expiryDays === null ? ['offer expiration date'] : []),
  ]));
  const evidencePoints = missingEvidence.length === 0 ? 5 : missingEvidence.length <= 2 ? 3 : 1;
  let score = clamp(valuePoints + cashPoints + schedulePoints + itineraryPoints + evidencePoints);

  const factors: BookingDecisionFactor[] = [
    { id: 'value', label: 'Casino value', score: valuePoints, maxScore: 45, explanation: `${coveredValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} estimated casino-covered value; underlying offer score ${intelligence.score}/100.`, status: coveredValue > cashCost ? 'positive' : 'warning' },
    { id: 'cash_cost', label: 'Cash cost', score: cashPoints, maxScore: 20, explanation: `${cashCost.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} estimated taxes, fees, and upgrades${costPerNight !== null ? ` (${costPerNight.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/night)` : ''}.`, status: cashPoints >= 12 ? 'positive' : 'warning' },
    { id: 'schedule', label: 'Calendar fit', score: schedulePoints, maxScore: 20, explanation: conflicts.length === 0 ? 'No overlap with a saved booked cruise was found.' : `Overlaps ${conflicts.map((cruise) => cruise.shipName).join(', ')}.`, status: conflicts.length === 0 ? 'positive' : 'blocking' },
    { id: 'itinerary', label: 'Itinerary evidence', score: itineraryPoints, maxScore: 10, explanation: itineraryKnown ? `${input.cruise.destination || input.cruise.itineraryName || `${input.cruise.ports?.length} saved ports`}.` : 'Destination and itinerary are not saved.', status: itineraryKnown ? 'positive' : 'warning' },
    { id: 'evidence', label: 'Data completeness', score: evidencePoints, maxScore: 5, explanation: missingEvidence.length === 0 ? 'Core decision inputs are present.' : `Still missing: ${missingEvidence.join(', ')}.`, status: missingEvidence.length === 0 ? 'positive' : 'neutral' },
  ];

  let decision = verdictFor(score);
  if (exactCandidateAlreadyBooked) {
    score = 100;
    decision = { verdict: 'already_booked', label: 'Already booked' };
  } else if (expired || conflicts.length > 0 || input.offer.status === 'expired' || input.offer.status === 'archived') {
    score = Math.min(score, 25);
    decision = { verdict: 'not_bookable', label: expired ? 'Offer expired' : conflicts.length > 0 ? 'Schedule conflict' : 'Not currently bookable' };
  }

  const reasons = [
    netValue >= 0 ? `Estimated net vacation value is ${netValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.` : `Estimated cash cost exceeds recorded casino value by ${Math.abs(netValue).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`,
    conflicts.length === 0 ? 'No saved booked-cruise overlap was found.' : `The sailing overlaps ${conflicts.length} saved booking${conflicts.length === 1 ? '' : 's'}.`,
    intelligence.reasons[0] ?? 'The assessment uses the saved offer and sailing facts.',
  ];

  return {
    verdict: decision.verdict,
    verdictLabel: decision.label,
    score,
    confidence: missingEvidence.length === 0 ? 'high' : missingEvidence.length <= 2 ? 'medium' : 'low',
    headline: `${decision.label}: ${input.cruise.shipName} on ${toCalendarDateOnly(input.cruise.sailDate) || input.cruise.sailDate}.`,
    candidateCruiseId: input.cruise.id,
    estimatedCasinoValue: coveredValue,
    estimatedCashCost: cashCost,
    estimatedNetVacationValue: netValue,
    costPerNight,
    factors,
    reasons,
    verifyBeforeBooking: [
      'Confirm the offer is still available for this exact sailing and named player.',
      'Confirm final taxes, port fees, guest eligibility, cabin category, and any upgrade charge.',
      'Confirm certificate stackability directly with the cruise line or casino desk.',
      'Consider airfare, hotel, time away, and personal itinerary preference; those are not inferred from casino value.',
    ],
    missingEvidence,
    disclaimer: 'This is transparent planning support, not a booking instruction or guarantee. Easy Seas never books automatically; verify the official terms before committing money or travel time.',
    offerIntelligence: intelligence,
  };
}
