import { getShipNameFromCode } from './apiTypes';
import { OfferRow } from './types';

type UnknownRecord = Record<string, unknown>;

export interface ParsedCasinoOffersPayload {
  offerRows: OfferRow[];
  offerCount: number;
  totalSailings: number;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function asRecordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => asRecord(item)).filter((item): item is UnknownRecord => item !== null);
}

function getString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const record = asRecord(value);
  if (record) {
    const prioritizedValue = record.name ?? record.title ?? record.description ?? record.code ?? record.value;
    if (prioritizedValue !== undefined) {
      return getString(prioritizedValue);
    }
  }

  return '';
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) {
      return undefined;
    }

    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function getOfferStatus(offer: UnknownRecord, entry: UnknownRecord): string {
  return getString(
    offer.status ??
      offer.offerStatus ??
      offer.redemptionStatus ??
      offer.progressStatus ??
      offer.state ??
      entry.status ??
      entry.offerStatus ??
      entry.redemptionStatus ??
      entry.progressStatus ??
      entry.state
  );
}

function isOfferInProgress(offer: UnknownRecord, entry: UnknownRecord): boolean {
  if (
    getBoolean(offer.isInProgress) ||
    getBoolean(offer.inProgress) ||
    getBoolean(offer.isPending) ||
    getBoolean(entry.isInProgress) ||
    getBoolean(entry.inProgress) ||
    getBoolean(entry.isPending)
  ) {
    return true;
  }

  const status = getOfferStatus(offer, entry).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  return status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning');
}

function getDateParts(value: string): { year: number; month: number; day: number } | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (match) {
    return {
      year: Number.parseInt(match[1], 10),
      month: Number.parseInt(match[2], 10),
      day: Number.parseInt(match[3], 10),
    };
  }

  match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return {
      year: Number.parseInt(match[1], 10),
      month: Number.parseInt(match[2], 10),
      day: Number.parseInt(match[3], 10),
    };
  }

  match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const yearValue = match[3].length === 2 ? `20${match[3]}` : match[3];
    return {
      year: Number.parseInt(yearValue, 10),
      month: Number.parseInt(match[1], 10),
      day: Number.parseInt(match[2], 10),
    };
  }

  try {
    const parsed = new Date(normalized.includes('T') ? normalized : `${normalized}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function formatDate(value: unknown): string {
  const input = getString(value);
  if (!input) {
    return '';
  }

  const parts = getDateParts(input);
  if (!parts) {
    return input;
  }

  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${month}/${day}/${parts.year}`;
}

function formatMoney(value: unknown): string | undefined {
  const amount = getNumber(value);
  if (amount === undefined || amount <= 0) {
    return undefined;
  }

  return `$${amount.toFixed(2)}`;
}

function getOffersArray(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return asRecordArray(payload);
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const nestedPayload = asRecord(record.payload);
  const candidateArrays: unknown[] = [
    record.offers,
    record.casinoOffers,
    nestedPayload?.offers,
    nestedPayload?.casinoOffers,
  ];

  for (const candidate of candidateArrays) {
    const offers = asRecordArray(candidate);
    if (offers.length > 0) {
      return offers;
    }
  }

  return [];
}

function getOfferRecord(entry: UnknownRecord): UnknownRecord {
  return asRecord(entry.campaignOffer) ?? entry;
}

function extractTradeInValue(offer: UnknownRecord): number | undefined {
  const directValue = getNumber(offer.tradeInValue);
  if (directValue !== undefined && directValue > 0) {
    return directValue;
  }

  const marketingPerks = asRecordArray(offer.marketingPerks);
  for (const perk of marketingPerks) {
    const price = asRecord(perk.price);
    const priceValue = getNumber(price?.value);
    if (priceValue !== undefined && priceValue > 0) {
      return priceValue;
    }
  }

  return undefined;
}

function extractPerks(offer: UnknownRecord, tradeInValue: number | undefined): string {
  const perks: string[] = [];
  const marketingPerks = asRecordArray(offer.marketingPerks);

  for (const perk of marketingPerks) {
    const descriptions = perk.description;
    if (Array.isArray(descriptions)) {
      descriptions.forEach((description) => {
        const text = getString(description);
        if (text) {
          perks.push(text);
        }
      });
      continue;
    }

    const singleDescription = getString(descriptions);
    if (singleDescription) {
      perks.push(singleDescription);
    }
  }

  if (tradeInValue !== undefined && tradeInValue > 0) {
    const tradeInText = `Trade-in value: $${tradeInValue.toFixed(2)}`;
    if (!perks.some((perk) => perk.toLowerCase().includes('trade-in'))) {
      perks.push(tradeInText);
    }
  }

  return Array.from(new Set(perks.map((perk) => perk.trim()).filter(Boolean))).join('; ');
}

function extractDeparturePortName(sailing: UnknownRecord): string {
  const departurePort = asRecord(sailing.departurePort);
  const itinerary = asRecord(sailing.itinerary);
  const itineraryDeparturePort = asRecord(itinerary?.departurePort);
  return getString(
    departurePort?.name ??
      sailing.departurePortName ??
      sailing.departurePort ??
      itineraryDeparturePort?.name
  );
}

function extractItineraryText(sailing: UnknownRecord): string {
  const sailingType = asRecord(sailing.sailingType);
  const itinerary = asRecord(sailing.itinerary);
  const masterSailing = asRecord(sailing.masterSailing);
  const masterItinerary = asRecord(masterSailing?.itinerary);
  return getString(
    sailing.itineraryDescription ??
      sailingType?.name ??
      sailing.sailingType ??
      itinerary?.description ??
      itinerary?.name ??
      masterItinerary?.description ??
      masterItinerary?.name
  );
}

function extractPortList(sailing: UnknownRecord): string {
  const itinerary = asRecord(sailing.itinerary);
  const itineraryDays = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const ports = Array.isArray(sailing.ports)
    ? sailing.ports
    : Array.isArray(itinerary?.ports)
    ? itinerary.ports
    : itineraryDays.flatMap((day) => {
        const dayRecord = asRecord(day);
        return Array.isArray(dayRecord?.ports) ? dayRecord.ports : [];
      });

  const portNames = ports
    .map((port) => {
      const portRecord = asRecord(port);
      const nestedPort = asRecord(portRecord?.port);
      return getString(nestedPort?.name ?? portRecord?.name ?? portRecord?.portName ?? port);
    })
    .filter(Boolean);

  return Array.from(new Set(portNames)).join(', ');
}

function extractSailings(entry: UnknownRecord, offer: UnknownRecord): UnknownRecord[] {
  const candidateArrays: unknown[] = [
    offer.sailings,
    offer.availableSailings,
    offer.eligibleSailings,
    offer.sailingInfo,
    entry.sailings,
    entry.availableSailings,
    entry.eligibleSailings,
    entry.sailingInfo,
  ];

  for (const candidate of candidateArrays) {
    const sailings = asRecordArray(candidate);
    if (sailings.length > 0) {
      return sailings;
    }
  }

  return [];
}

function extractNights(sailing: UnknownRecord, offer: UnknownRecord): number | undefined {
  const masterSailing = asRecord(sailing.masterSailing);
  const masterItinerary = asRecord(masterSailing?.itinerary);
  const candidates: unknown[] = [
    sailing.numberOfNights,
    sailing.duration,
    sailing.totalNights,
    masterItinerary?.totalNights,
    masterItinerary?.sailingNights,
    offer.numberOfNights,
    offer.duration,
    offer.totalNights,
  ];

  for (const candidate of candidates) {
    const value = getNumber(candidate);
    if (value !== undefined && value > 0) {
      return Math.round(value);
    }
  }

  return undefined;
}

function normalizePricingCategory(roomType: string): 'interior' | 'oceanview' | 'balcony' | 'suite' | null {
  const normalized = roomType.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes('interior') ||
    normalized.includes('inside') ||
    normalized === 'i' ||
    normalized === 'in' ||
    normalized === 'int'
  ) {
    return 'interior';
  }

  if (
    normalized.includes('oceanview') ||
    normalized.includes('ocean view') ||
    normalized.includes('outside') ||
    normalized === 'o' ||
    normalized === 'ov' ||
    normalized === 'ob' ||
    normalized === 'e'
  ) {
    return 'oceanview';
  }

  if (
    normalized.includes('balcony') ||
    normalized === 'b' ||
    normalized === 'bal' ||
    normalized === 'bk'
  ) {
    return 'balcony';
  }

  if (
    normalized.includes('suite') ||
    normalized === 's' ||
    normalized === 'su' ||
    normalized === 'js' ||
    normalized === 'dlx' ||
    normalized === 'd'
  ) {
    return 'suite';
  }

  return null;
}

function applyPriceCandidate(
  currentValue: string | undefined,
  nextValue: unknown
): string | undefined {
  const formatted = formatMoney(nextValue);
  if (!formatted) {
    return currentValue;
  }

  if (!currentValue) {
    return formatted;
  }

  const currentNumber = getNumber(currentValue);
  const nextNumber = getNumber(formatted);
  if (currentNumber === undefined) {
    return formatted;
  }
  if (nextNumber === undefined) {
    return currentValue;
  }

  return nextNumber < currentNumber ? formatted : currentValue;
}

function extractCabinPrices(sailing: UnknownRecord): {
  interiorPrice?: string;
  oceanviewPrice?: string;
  balconyPrice?: string;
  suitePrice?: string;
  taxesAndFees?: string;
} {
  const taxesAndFeesRecord = asRecord(sailing.taxesAndFees);
  const prices: {
    interiorPrice?: string;
    oceanviewPrice?: string;
    balconyPrice?: string;
    suitePrice?: string;
    taxesAndFees?: string;
  } = {
    interiorPrice: formatMoney(sailing.interiorPrice),
    oceanviewPrice: formatMoney(sailing.oceanviewPrice),
    balconyPrice: formatMoney(sailing.balconyPrice),
    suitePrice: formatMoney(sailing.suitePrice),
    taxesAndFees: formatMoney(taxesAndFeesRecord?.value ?? sailing.taxes ?? sailing.taxesAndFees),
  };

  const pricingEntries = [
    ...asRecordArray(sailing.pricing),
    ...asRecordArray(sailing.stateroomClassPricing),
  ];

  pricingEntries.forEach((entry) => {
    const stateroomClass = asRecord(entry.stateroomClass);
    const stateroomContent = asRecord(stateroomClass?.content);
    const roomType = getString(
      entry.roomType ??
        entry.cabinType ??
        entry.type ??
        stateroomContent?.code ??
        stateroomClass?.id
    ).toLowerCase();
    const priceRecord = asRecord(entry.price);
    const rawPrice = priceRecord?.value ?? entry.price ?? entry.amount ?? entry.rate;
    const category = normalizePricingCategory(roomType);

    if (category === 'interior') {
      prices.interiorPrice = applyPriceCandidate(prices.interiorPrice, rawPrice);
    } else if (category === 'oceanview') {
      prices.oceanviewPrice = applyPriceCandidate(prices.oceanviewPrice, rawPrice);
    } else if (category === 'balcony') {
      prices.balconyPrice = applyPriceCandidate(prices.balconyPrice, rawPrice);
    } else if (category === 'suite') {
      prices.suitePrice = applyPriceCandidate(prices.suitePrice, rawPrice);
    }
  });

  return prices;
}

export function parseCasinoOffersPayload(
  payload: unknown,
  sourcePage: string = 'Offers',
  defaultOfferType: string = 'Club Royale'
): ParsedCasinoOffersPayload {
  const rawOffers = getOffersArray(payload);
  const offerRows: OfferRow[] = [];
  let totalSailings = 0;

  rawOffers.forEach((entry) => {
    const offer = getOfferRecord(entry);
    const offerName = getString(offer.name ?? offer.title ?? offer.offerName ?? offer.description);
    const offerCode = getString(offer.offerCode ?? offer.marketingCouponCode ?? offer.code);
    const offerExpirationDate = formatDate(offer.reserveByDate ?? offer.expirationDate ?? offer.marketingEndDate);
    const offerType = getString(offer.type ?? offer.offerType) || defaultOfferType;
    const offerStatus = getOfferStatus(offer, entry);
    const isInProgress = isOfferInProgress(offer, entry);
    const tradeInValue = extractTradeInValue(offer);
    const perks = extractPerks(offer, tradeInValue);
    const bookingLink = getString(asRecord(offer.marketingUiAttributes)?.ctaLink ?? offer.bookingLink);
    const sailings = extractSailings(entry, offer);
    const isGOBOOffer = getBoolean(offer.isGOBO);

    if (sailings.length === 0) {
      offerRows.push({
        sourcePage,
        offerName: offerName || offerCode || defaultOfferType,
        offerCode,
        offerExpirationDate,
        offerType,
        shipName: '',
        shipCode: undefined,
        sailingDate: '',
        itinerary: getString(offer.description),
        departurePort: '',
        cabinType: '',
        numberOfGuests: isGOBOOffer ? '1' : '2',
        perks,
        loyaltyLevel: '',
        loyaltyPoints: '',
        interiorPrice: undefined,
        oceanviewPrice: undefined,
        balconyPrice: undefined,
        suitePrice: undefined,
        taxesAndFees: undefined,
        portList: undefined,
        dayByDayItinerary: [],
        destinationName: undefined,
        totalNights: undefined,
        bookingLink: bookingLink || undefined,
        offerStatus: offerStatus || undefined,
        isInProgress,
      });
      totalSailings += 1;
      return;
    }

    sailings.forEach((sailing) => {
      const shipRecord = asRecord(sailing.ship);
      const shipCode = getString(sailing.shipCode ?? shipRecord?.code);
      const shipName = getString(sailing.shipName ?? shipRecord?.name) || (shipCode ? getShipNameFromCode(shipCode) : '');
      const sailingDate = formatDate(sailing.sailDate ?? sailing.startDate ?? sailing.departureDate ?? sailing.date);
      const departurePort = extractDeparturePortName(sailing);
      const itinerary = extractItineraryText(sailing);
      const cabinType = getString(sailing.roomType ?? sailing.stateroomType ?? sailing.cabinType);
      const prices = extractCabinPrices(sailing);
      const isGOBOSailing = getBoolean(sailing.isGOBO);
      const totalNights = extractNights(sailing, offer);
      const portList = extractPortList(sailing);

      offerRows.push({
        sourcePage,
        offerName: offerName || offerCode || defaultOfferType,
        offerCode,
        offerExpirationDate,
        offerType,
        shipName,
        shipCode: shipCode || undefined,
        sailingDate,
        itinerary,
        departurePort,
        cabinType,
        numberOfGuests: isGOBOSailing || isGOBOOffer ? '1' : '2',
        perks,
        loyaltyLevel: '',
        loyaltyPoints: '',
        interiorPrice: prices.interiorPrice,
        oceanviewPrice: prices.oceanviewPrice,
        balconyPrice: prices.balconyPrice,
        suitePrice: prices.suitePrice,
        taxesAndFees: prices.taxesAndFees,
        portList: portList || undefined,
        dayByDayItinerary: [],
        destinationName: undefined,
        totalNights,
        bookingLink: getString(sailing.bookingLink ?? asRecord(sailing.marketingUiAttributes)?.ctaLink) || bookingLink || undefined,
        offerStatus: offerStatus || undefined,
        isInProgress,
      });
      totalSailings += 1;
    });
  });

  return {
    offerRows,
    offerCount: rawOffers.length,
    totalSailings,
  };
}
