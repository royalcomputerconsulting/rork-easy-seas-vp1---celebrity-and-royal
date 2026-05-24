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


// Known canonical casino offer codes that Royal/Celebrity occasionally render with a
// trailing one-letter DOM suffix (e.g. 26BCP105E, 2605C03AB). Normalizing these here
// prevents the same logical offer from being counted twice, while still letting any
// unknown code flow through unchanged so it can be picked up live.
const KNOWN_CASINO_OFFER_CODES = [
  '26BCP105',
  '26JUL104',
  '26VTY104',
  '2605C03A',
  '26TOC208',
] as const;

function normalizeCasinoOfferCode(value: unknown): string {
  const code = getString(value).trim().toUpperCase();
  if (!code) return '';
  for (const canonical of KNOWN_CASINO_OFFER_CODES) {
    if (code === canonical) return canonical;
    if (code.startsWith(canonical) && /^[A-Z]$/.test(code.slice(canonical.length))) {
      return canonical;
    }
  }
  return code;
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

const MONTH_INDEX: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function normalizeYear(value: string): number | null {
  const year = String(value || '').trim();
  if (!year) {
    return null;
  }
  return year.length === 2 ? 2000 + Number.parseInt(year, 10) : Number.parseInt(year, 10);
}

function validateDateParts(year: number | null, month: number | undefined, day: number): { year: number; month: number; day: number } | null {
  if (!year || !month || !day || year < 2020 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() + 1 !== month || check.getDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function getDateParts(value: string): { year: number; month: number; day: number } | null {
  const normalized = value.trim().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!normalized) {
    return null;
  }

  let match = normalized.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})(?:[T\s].*)?$/);
  if (match) {
    return validateDateParts(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10));
  }

  match = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    return validateDateParts(normalizeYear(match[3]), Number.parseInt(match[1], 10), Number.parseInt(match[2], 10));
  }

  match = normalized.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{2,4})$/i);
  if (match) {
    return validateDateParts(normalizeYear(match[3]), MONTH_INDEX[match[1].toLowerCase().replace('.', '')], Number.parseInt(match[2], 10));
  }

  match = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?[,]?\s+(\d{2,4})$/i);
  if (match) {
    return validateDateParts(normalizeYear(match[3]), MONTH_INDEX[match[2].toLowerCase().replace('.', '')], Number.parseInt(match[1], 10));
  }

  try {
    const parsed = new Date(normalized.includes('T') ? normalized : `${normalized}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return validateDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
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


function extractExpandedSailingDates(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const formatted = formatDate(raw);
    if (!formatted || formatted === raw) return;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      out.push(formatted);
    }
  };

  values.forEach((value) => {
    const text = getString(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    add(text);

    const fullDateRe = /\b(?:20\d{2}[-\/]?\d{1,2}[-\/]?\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[,]?\s+20\d{2})\b/gi;
    let match: RegExpExecArray | null;
    while ((match = fullDateRe.exec(text)) !== null) {
      add(match[0]);
    }

    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const sharedYear = yearMatch[1];
      const afterYear = text.slice((yearMatch.index ?? 0) + yearMatch[0].length);
      const monthDayRe = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
      let md: RegExpExecArray | null;
      while ((md = monthDayRe.exec(afterYear)) !== null) {
        add(`${md[1]} ${md[2]}, ${sharedYear}`);
      }
    }
  });

  return out;
}

function formatMoney(value: unknown): string | undefined {
  const amount = getNumber(value);
  if (amount === undefined || amount <= 0) {
    return undefined;
  }

  return `$${amount.toFixed(2)}`;
}

function isOfferLikeRecord(record: UnknownRecord): boolean {
  return Boolean(
    asRecord(record.campaignOffer) ||
      asRecord(record.offer) ||
      record.offerCode ||
      record.marketingCouponCode ||
      record.reserveByDate ||
      record.expirationDate ||
      record.marketingEndDate
  );
}

function collectOfferRecords(value: unknown, depth: number = 0): UnknownRecord[] {
  if (depth > 8) {
    return [];
  }

  if (Array.isArray(value)) {
    const records = asRecordArray(value);
    if (records.some(isOfferLikeRecord)) {
      return records;
    }

    return records.flatMap((record) => collectOfferRecords(record, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const collected: UnknownRecord[] = [];
  Object.entries(record).forEach(([key, childValue]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes('offer') || normalizedKey.includes('campaign') || normalizedKey.includes('sailing') || normalizedKey.includes('cruise') || normalizedKey === 'payload' || normalizedKey === 'data' || normalizedKey === 'items' || normalizedKey === 'results') {
      collected.push(...collectOfferRecords(childValue, depth + 1));
    }
  });

  return collected;
}

function getOfferIdentityKey(offer: UnknownRecord, fallback: string): string {
  const offerRecord = getOfferRecord(offer);
  const keyParts = [
    getString(offerRecord.offerCode ?? offerRecord.marketingCouponCode ?? offerRecord.couponCode ?? offerRecord.code),
    getString(offerRecord.name ?? offerRecord.title ?? offerRecord.offerName ?? offerRecord.marketingTitle ?? offerRecord.description),
    getString(offerRecord.reserveByDate ?? offerRecord.expirationDate ?? offerRecord.marketingEndDate),
    getOfferStatus(offerRecord, offer),
  ].filter(Boolean);

  if (keyParts.length > 0) {
    return keyParts.join('|').toLowerCase();
  }

  try {
    return `${fallback}|${JSON.stringify(offer).slice(0, 500)}`;
  } catch {
    return fallback;
  }
}

function getOfferRecordsFromCandidate(candidate: unknown): UnknownRecord[] {
  if (Array.isArray(candidate)) {
    return asRecordArray(candidate);
  }

  const record = asRecord(candidate);
  if (!record) {
    return [];
  }

  return isOfferLikeRecord(record) ? [record] : collectOfferRecords(record);
}

function getOffersArray(payload: unknown): UnknownRecord[] {
  const directRecords = getOfferRecordsFromCandidate(payload);
  const record = asRecord(payload);
  if (!record) {
    return directRecords;
  }

  const nestedPayload = asRecord(record.payload);
  const nestedData = asRecord(record.data);
  const candidateValues: unknown[] = [
    record.offers,
    record.offer,
    record.casinoOffers,
    record.casinoOffer,
    record.featuredOffers,
    record.featuredOffer,
    record.featuredCasinoOffers,
    record.featuredCasinoOffer,
    record.casinoFeaturedOffers,
    record.casinoFeaturedOffer,
    record.highlightedOffers,
    record.highlightedOffer,
    record.primaryOffers,
    record.primaryOffer,
    record.moreOffers,
    record.moreOffer,
    record.availableOffers,
    record.availableOffer,
    nestedPayload?.offers,
    nestedPayload?.offer,
    nestedPayload?.casinoOffers,
    nestedPayload?.casinoOffer,
    nestedPayload?.featuredOffers,
    nestedPayload?.featuredOffer,
    nestedPayload?.featuredCasinoOffers,
    nestedPayload?.featuredCasinoOffer,
    nestedPayload?.casinoFeaturedOffers,
    nestedPayload?.casinoFeaturedOffer,
    nestedPayload?.highlightedOffers,
    nestedPayload?.highlightedOffer,
    nestedPayload?.primaryOffers,
    nestedPayload?.primaryOffer,
    nestedPayload?.moreOffers,
    nestedPayload?.moreOffer,
    nestedPayload?.availableOffers,
    nestedPayload?.availableOffer,
    nestedData?.offers,
    nestedData?.offer,
    nestedData?.casinoOffers,
    nestedData?.casinoOffer,
    nestedData?.featuredOffers,
    nestedData?.featuredOffer,
    nestedData?.moreOffers,
    nestedData?.moreOffer,
    nestedData?.availableOffers,
    nestedData?.availableOffer,
  ];

  const offerMap = new Map<string, UnknownRecord>();
  const addOffers = (offers: UnknownRecord[], source: string) => {
    offers.forEach((offer, index) => {
      const key = getOfferIdentityKey(offer, `${source}:${index}`);
      if (!offerMap.has(key)) {
        offerMap.set(key, offer);
      }
    });
  };

  addOffers(directRecords, 'direct');
  candidateValues.forEach((candidate, index) => {
    addOffers(getOfferRecordsFromCandidate(candidate), `candidate:${index}`);
  });
  addOffers(collectOfferRecords(record), 'deep');

  return Array.from(offerMap.values());
}

function getOfferRecord(entry: UnknownRecord): UnknownRecord {
  return asRecord(entry.campaignOffer) ?? asRecord(entry.offer) ?? asRecord(entry.offerDetails) ?? entry;
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
  const entryData = asRecord(entry.data);
  const entryPayload = asRecord(entry.payload);
  const entryCruiseSearch = asRecord(entry.cruiseSearch) ?? asRecord(entryData?.cruiseSearch) ?? asRecord(entryPayload?.cruiseSearch);
  const entryCruiseResults = asRecord(entryCruiseSearch?.results);
  const offerCruiseSearch = asRecord(offer.cruiseSearch);
  const offerCruiseResults = asRecord(offerCruiseSearch?.results);

  const candidateArrays: unknown[] = [
    offer.sailings,
    offer.availableSailings,
    offer.eligibleSailings,
    offer.sailingInfo,
    offer.offerSailings,
    offer.sailingList,
    offer.cruises,
    offer.voyages,
    offer.availableCruises,
    offer.cruiseOptions,
    offer.sailingOptions,
    offer.itineraries,
    offerCruiseResults?.cruises,
    offerCruiseResults?.sailings,
    entry.sailings,
    entry.availableSailings,
    entry.eligibleSailings,
    entry.sailingInfo,
    entry.offerSailings,
    entry.sailingList,
    entry.cruises,
    entry.voyages,
    entry.availableCruises,
    entry.cruiseOptions,
    entry.sailingOptions,
    entry.itineraries,
    entryCruiseResults?.cruises,
    entryCruiseResults?.sailings,
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
    const offerName = getString(offer.name ?? offer.title ?? offer.offerName ?? offer.marketingTitle ?? offer.description);
    const offerCode = normalizeCasinoOfferCode(offer.offerCode ?? offer.marketingCouponCode ?? offer.couponCode ?? offer.code);
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
      const nestedSailings = asRecordArray(sailing.sailings);
      const rowSailings = nestedSailings.length > 0 ? nestedSailings : [sailing];
      const parentCruise = nestedSailings.length > 0 ? sailing : undefined;

      rowSailings.forEach((rowSailing) => {
        const parentRecord = asRecord(parentCruise);
        const masterSailing = asRecord(rowSailing.masterSailing ?? sailing.masterSailing ?? parentRecord?.masterSailing);
        const masterItinerary = asRecord(masterSailing?.itinerary);
        const masterShip = asRecord(masterSailing?.ship ?? masterItinerary?.ship);
        const shipRecord = asRecord(rowSailing.ship ?? sailing.ship ?? parentRecord?.ship);
        const shipCode = getString(rowSailing.shipCode ?? sailing.shipCode ?? parentRecord?.shipCode ?? shipRecord?.code ?? masterShip?.code);
        const shipName = getString(rowSailing.shipName ?? sailing.shipName ?? parentRecord?.shipName ?? shipRecord?.name ?? masterShip?.name) || (shipCode ? getShipNameFromCode(shipCode) : '');
        const sailingDates = extractExpandedSailingDates(
          rowSailing.sailDate,
          rowSailing.startDate,
          rowSailing.departureDate,
          rowSailing.date,
          rowSailing.sailingDate,
          rowSailing.sailingDates,
          rowSailing.dates,
          sailing.sailDate,
          sailing.startDate,
          sailing.departureDate,
          sailing.date,
          sailing.sailingDate,
          sailing.sailingDates,
          sailing.dates,
          parentRecord?.sailDate,
          parentRecord?.startDate,
          parentRecord?.sailingDates,
          parentRecord?.dates
        );
        const datesForRows = sailingDates.length > 0 ? sailingDates : [''];
        const departurePort = extractDeparturePortName(rowSailing) || extractDeparturePortName(sailing) || extractDeparturePortName(parentRecord ?? {});
        const itinerary = extractItineraryText(rowSailing) || extractItineraryText(sailing) || extractItineraryText(parentRecord ?? {});
        const cabinType = getString(rowSailing.roomType ?? rowSailing.stateroomType ?? rowSailing.cabinType ?? sailing.roomType ?? sailing.stateroomType ?? sailing.cabinType);
        const prices = extractCabinPrices(rowSailing);
        const parentPrices = extractCabinPrices(sailing);
        const isGOBOSailing = getBoolean(rowSailing.isGOBO ?? sailing.isGOBO);
        const totalNights = extractNights(rowSailing, offer) ?? extractNights(sailing, offer);
        const portList = extractPortList(rowSailing) || extractPortList(sailing) || extractPortList(parentRecord ?? {});

        datesForRows.forEach((sailingDate) => {
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
          interiorPrice: prices.interiorPrice || parentPrices.interiorPrice,
          oceanviewPrice: prices.oceanviewPrice || parentPrices.oceanviewPrice,
          balconyPrice: prices.balconyPrice || parentPrices.balconyPrice,
          suitePrice: prices.suitePrice || parentPrices.suitePrice,
          taxesAndFees: prices.taxesAndFees || parentPrices.taxesAndFees,
          portList: portList || undefined,
          dayByDayItinerary: [],
          destinationName: undefined,
          totalNights,
          bookingLink: getString(rowSailing.bookingLink ?? sailing.bookingLink ?? asRecord(rowSailing.marketingUiAttributes)?.ctaLink ?? asRecord(sailing.marketingUiAttributes)?.ctaLink) || bookingLink || undefined,
          offerStatus: offerStatus || undefined,
          isInProgress,
          });
          totalSailings += 1;
        });
      });
    });
  });

  return {
    offerRows,
    offerCount: rawOffers.length,
    totalSailings,
  };
}
