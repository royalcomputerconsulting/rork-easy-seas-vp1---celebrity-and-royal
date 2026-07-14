import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

export type AdvisorCruise = Cruise | BookedCruise;

export interface OfferRecommendation {
  id: string;
  title: string;
  subtitle: string;
  offerCode: string;
  score: number;
  valueLabel: string;
  warnings: string[];
  reasons: string[];
  cruise?: Cruise;
  offer?: CasinoOffer;
}

export interface DataHealthSummary {
  royalOffers: number;
  celebrityOffers: number;
  carnivalOffers: number;
  silverseaOffers: number;
  royalAvailableCruises: number;
  celebrityAvailableCruises: number;
  carnivalAvailableCruises: number;
  silverseaAvailableCruises: number;
  activeUpcoming: number;
  courtesyHolds: number;
  completedCruises: number;
  duplicateAvailableRows: number;
  duplicateOfferCodes: number;
  possiblyMisclassifiedUpcoming: number;
}

export interface TripStackCandidate {
  id: string;
  title: string;
  subtitle: string;
  gapDays: number;
  score: number;
  reasons: string[];
  warnings: string[];
  cruise: Cruise;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeBrand(value: unknown): 'royal' | 'celebrity' | 'carnival' | 'silversea' | 'other' {
  const text = normalize(value);
  if (text.includes('celebrity') || text.includes('blue chip') || text === 'c') return 'celebrity';
  if (text.includes('carnival') || text.includes('players club') || text.includes('vifp')) return 'carnival';
  if (text.includes('silversea') || text.includes('venetian')) return 'silversea';
  if (text.includes('royal') || text.includes('club royale') || text === 'r') return 'royal';
  return 'other';
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a: Date, b: Date): number {
  const start = new Date(a);
  const end = new Date(b);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function isAvailableOfferCruise(cruise: AdvisorCruise): cruise is Cruise {
  const status = normalize((cruise as Cruise).status);
  const source = normalize((cruise as Cruise).cruiseSource || (cruise as Cruise).offerSource);
  return Boolean((cruise as Cruise).offerCode) && !('bookingId' in cruise) && (status === 'available' || source === 'royal' || source === 'celebrity' || source === 'carnival' || source === 'silversea' || status === '');
}

export function isCompletedCruise(cruise: AdvisorCruise): cruise is BookedCruise {
  const status = normalize((cruise as BookedCruise).completionState || (cruise as BookedCruise).status);
  if (status.includes('completed')) return true;
  const returnDate = toDate((cruise as BookedCruise).returnDate);
  return Boolean(returnDate && returnDate.getTime() < Date.now() - 86400000 && ('bookingId' in cruise || 'reservationNumber' in cruise));
}

export function isActiveUpcomingCruise(cruise: AdvisorCruise): cruise is BookedCruise {
  if (isCompletedCruise(cruise)) return false;
  if ((cruise as BookedCruise).isCourtesyHold) return false;
  const sailDate = toDate(cruise.sailDate);
  return Boolean(sailDate && sailDate.getTime() >= Date.now() - 86400000 && ('bookingId' in cruise || 'reservationNumber' in cruise));
}

function availableKey(cruise: Cruise): string {
  return [
    normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource),
    normalize(cruise.offerCode),
    normalize(cruise.shipName),
    normalize(cruise.sailDate),
    normalize(cruise.itineraryName || cruise.destination),
    normalize(cruise.cabinType),
    normalize(cruise.guests || cruise.guestsInfo),
  ].join('|');
}

function offerKey(offer: CasinoOffer): string {
  return [normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram), normalize(offer.offerCode || offer.id)].join('|');
}

export function buildDataHealthSummary(cruises: Cruise[], bookedCruises: BookedCruise[], offers: CasinoOffer[]): DataHealthSummary {
  const availableKeys = new Map<string, number>();
  cruises.forEach((cruise) => {
    const key = availableKey(cruise);
    availableKeys.set(key, (availableKeys.get(key) ?? 0) + 1);
  });
  const offerKeys = new Map<string, number>();
  offers.forEach((offer) => {
    const key = offerKey(offer);
    offerKeys.set(key, (offerKeys.get(key) ?? 0) + 1);
  });
  const activeUpcoming = bookedCruises.filter(isActiveUpcomingCruise).length;
  const completedCruises = bookedCruises.filter(isCompletedCruise).length;
  return {
    royalOffers: offers.filter((offer) => normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram) === 'royal').length,
    celebrityOffers: offers.filter((offer) => normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram) === 'celebrity').length,
    carnivalOffers: offers.filter((offer) => normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram) === 'carnival').length,
    silverseaOffers: offers.filter((offer) => normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram) === 'silversea').length,
    royalAvailableCruises: cruises.filter((cruise) => normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource) === 'royal').length,
    celebrityAvailableCruises: cruises.filter((cruise) => normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource) === 'celebrity').length,
    carnivalAvailableCruises: cruises.filter((cruise) => normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource) === 'carnival').length,
    silverseaAvailableCruises: cruises.filter((cruise) => normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource) === 'silversea').length,
    activeUpcoming,
    courtesyHolds: bookedCruises.filter((cruise) => cruise.isCourtesyHold).length,
    completedCruises,
    duplicateAvailableRows: Array.from(availableKeys.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    duplicateOfferCodes: Array.from(offerKeys.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    possiblyMisclassifiedUpcoming: bookedCruises.filter((cruise) => Boolean(cruise.offerCode) && !cruise.bookingId && !cruise.reservationNumber && !isCompletedCruise(cruise)).length,
  };
}

export function buildOfferRecommendations(cruises: Cruise[], bookedCruises: BookedCruise[], offers: CasinoOffer[]): OfferRecommendation[] {
  const upcoming = bookedCruises.filter(isActiveUpcomingCruise);
  const offerByCode = new Map<string, CasinoOffer>();
  offers.forEach((offer) => {
    const code = normalize(offer.offerCode || offer.id);
    const brand = normalizeBrand(offer.brand || offer.offerSource || offer.casinoProgram);
    const key = `${brand}|${code}`;
    if (code && !offerByCode.has(key)) offerByCode.set(key, offer);
  });

  return cruises
    .filter((cruise) => Boolean(cruise.offerCode))
    .map((cruise) => {
      const cruiseBrand = normalizeBrand(cruise.brand || cruise.cruiseSource || cruise.offerSource);
      const offer = offerByCode.get(`${cruiseBrand}|${normalize(cruise.offerCode)}`);
      const nights = Number(cruise.nights || 0);
      const cabinValue = Number(cruise.totalValue || cruise.retailValue || cruise.totalPrice || cruise.price || cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice || 0);
      const freePlay = Number(cruise.freePlay || offer?.freePlay || offer?.freeplayAmount || 0);
      const obc = Number(cruise.freeOBC || offer?.OBC || offer?.obcAmount || 0);
      const taxes = Number(cruise.taxes || offer?.taxesFees || offer?.portCharges || 0);
      const seaDays = Number(cruise.seaDays || 0);
      const score = Math.max(0, Math.round((nights * 8) + (seaDays * 5) + Math.min(40, cabinValue / 100) + Math.min(20, (freePlay + obc) / 25) - Math.min(20, taxes / 50)));
      const sailDate = toDate(cruise.sailDate);
      const conflicts = upcoming.filter((booking) => {
        const bookedStart = toDate(booking.sailDate);
        const bookedEnd = toDate(booking.returnDate);
        if (!sailDate || !bookedStart || !bookedEnd) return false;
        return sailDate >= bookedStart && sailDate <= bookedEnd;
      });
      const warnings = [
        ...(conflicts.length > 0 ? [`Conflicts with ${conflicts[0].shipName} on ${conflicts[0].sailDate}`] : []),
        ...(taxes > 0 ? [`Taxes/fees estimate: $${Math.round(taxes).toLocaleString()}`] : []),
        ...(nights <= 3 ? ['Short sailing: less casino time'] : []),
      ];
      const reasons = [
        `${nights || '?'} night sailing${seaDays ? ` with ${seaDays} sea day${seaDays === 1 ? '' : 's'}` : ''}`,
        cruise.cabinType ? `${cruise.cabinType} eligibility shown` : 'Cabin eligibility available in details',
        freePlay || obc ? `${freePlay ? `$${freePlay.toLocaleString()} FreePlay` : ''}${freePlay && obc ? ' + ' : ''}${obc ? `$${obc.toLocaleString()} OBC` : ''}` : 'Good candidate for casino-paid cabin value review',
        conflicts.length === 0 ? 'No direct overlap found with active bookings' : 'Review conflict before booking',
      ];
      return {
        id: `${cruise.offerCode || 'offer'}-${cruise.id}`,
        title: `${cruise.shipName || 'Cruise'} — ${cruise.sailDate || 'date TBD'}`,
        subtitle: `${cruise.itineraryName || cruise.destination || 'Itinerary TBD'} · ${cruise.departurePort || 'port TBD'}`,
        offerCode: cruise.offerCode || offer?.offerCode || 'UNKNOWN',
        score,
        valueLabel: cabinValue ? `$${Math.round(cabinValue).toLocaleString()} est. value` : `${nights || '?'} nights`,
        warnings,
        reasons,
        cruise,
        offer,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function buildTripStackCandidates(cruises: Cruise[], bookedCruises: BookedCruise[]): TripStackCandidate[] {
  const upcoming = bookedCruises.filter(isActiveUpcomingCruise);
  return cruises
    .filter((cruise) => Boolean(cruise.offerCode))
    .flatMap((cruise) => {
      const sailDate = toDate(cruise.sailDate);
      if (!sailDate) return [];
      return upcoming.map((booking) => {
        const bookingReturn = toDate(booking.returnDate);
        if (!bookingReturn) return null;
        const gapDays = daysBetween(bookingReturn, sailDate);
        if (gapDays < 0 || gapDays > 14) return null;
        const samePort = normalize(booking.departurePort) && normalize(booking.departurePort) === normalize(cruise.departurePort);
        const score = Math.max(0, 100 - (gapDays * 5) + (samePort ? 25 : 0) + Number(cruise.nights || 0));
        return {
          id: `${booking.id}-${cruise.id}`,
          title: `After ${booking.shipName}: ${cruise.shipName}`,
          subtitle: `${gapDays} day gap · ${cruise.departurePort || 'port TBD'} · ${cruise.offerCode}`,
          gapDays,
          score,
          reasons: [
            `Connects after ${booking.shipName} ending ${booking.returnDate}`,
            samePort ? 'Same departure port/region match' : 'Requires port/flight review',
            `${cruise.nights || '?'} additional night${Number(cruise.nights) === 1 ? '' : 's'} from active offer catalog`,
          ],
          warnings: [
            ...(gapDays === 0 ? ['Same-day turn: verify terminal, luggage, and check-in timing'] : []),
            ...(!samePort ? ['Different port: check flights, hotels, or transfer time'] : []),
          ],
          cruise,
        } satisfies TripStackCandidate;
      }).filter(Boolean) as TripStackCandidate[];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function getCasinoPaysForLabel(cruise: Cruise, offer?: CasinoOffer): string {
  const guests = cruise.guests || offer?.guests;
  const cabin = cruise.cabinType || offer?.roomType || 'Cabin';
  const freePlay = Number(cruise.freePlay || offer?.freePlay || offer?.freeplayAmount || 0);
  const obc = Number(cruise.freeOBC || offer?.OBC || offer?.obcAmount || 0);
  const pieces = [`${cabin}${guests ? ` for ${guests}` : ''}`];
  if (freePlay) pieces.push(`$${freePlay.toLocaleString()} FreePlay`);
  if (obc) pieces.push(`$${obc.toLocaleString()} OBC`);
  return pieces.join(' · ');
}

export function buildUpgradeMath(cruise: Cruise): { label: string; details: string[] } {
  const interior = Number(cruise.interiorPrice || 0);
  const balcony = Number(cruise.balconyPrice || 0);
  const suite = Number(cruise.suitePrice || cruise.juniorSuitePrice || 0);
  const nights = Math.max(1, Number(cruise.nights || 1));
  const details: string[] = [];
  if (interior && balcony && balcony > interior) {
    const diff = balcony - interior;
    details.push(`Balcony upgrade: $${Math.round(diff).toLocaleString()} total · $${Math.round(diff / nights).toLocaleString()}/night`);
  }
  if (balcony && suite && suite > balcony) {
    const diff = suite - balcony;
    details.push(`Suite jump: $${Math.round(diff).toLocaleString()} total · $${Math.round(diff / nights).toLocaleString()}/night`);
  }
  return {
    label: details.length ? 'Upgrade math available' : 'No upgrade spread found yet',
    details: details.length ? details : ['Open pricing/detail enrichment to compare cabin upgrade spreads.'],
  };
}
