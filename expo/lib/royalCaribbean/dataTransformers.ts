import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';
import { getDoubleOccupancyRoomRetailValue } from '@/lib/valueCalculator';
import { addCalendarDateDays, formatDateMDY, toCalendarDateOnly } from '@/lib/date';
import { createRoyalBookedCruiseIdentity, createRoyalOfferSailingIdentity, getProviderRecordId } from './syncIntegrity';

export type SyncDataSource = NonNullable<Cruise['cruiseSource']>;

export interface SyncOwnershipOptions {
  ownerProfileId?: string;
  sourceEmail?: string;
  includeUnownedRecords?: boolean;
  syncRunId?: string;
  sourceEndpoint?: string;
  sourceRetrievedAt?: string;
}

function getOwnershipFields(options: SyncOwnershipOptions | undefined, source: SyncDataSource) {
  const ownerProfileId = options?.ownerProfileId?.trim();
  const sourceEmail = options?.sourceEmail?.trim();

  return {
    ...(ownerProfileId ? { ownerProfileId, importStatus: 'assigned' as const, reconciliationStatus: 'matched' as const } : {}),
    ...(sourceEmail ? { sourceEmail } : {}),
    sourceProvider: source === 'carnival' ? 'carnivalSync' : source === 'celebrity' ? 'celebritySync' : 'royalCaribbeanSync',
    sourceAuthority: 'provider' as const,
    sourceEndpoint: options?.sourceEndpoint,
    sourceRetrievedAt: options?.sourceRetrievedAt,
    parserVersion: 'royal-sync-v2',
    syncRunId: options?.syncRunId,
    dataConfidence: 'verified' as const,
    isFallback: false,
    isStale: false,
    validationStatus: 'valid' as const,
  };
}

function getBrandOfferFallback(source: SyncDataSource): string {
  if (source === 'celebrity') {
    return 'Celebrity Cruises Offer';
  }
  if (source === 'carnival') {
    return 'Carnival Offer';
  }
  return 'Royal Caribbean Offer';
}

function parseDate(dateStr: string): string {
  const calendarDate = toCalendarDateOnly(dateStr);
  if (!calendarDate) {
    console.warn('[parseDate] Invalid calendar date:', dateStr);
    return '';
  }
  const [year, month, day] = calendarDate.split('-');
  return `${month}-${day}-${year}`;
}

function generateId(): string {
  return `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseDateString(dateStr: string): Date | null {
  const calendarDate = toCalendarDateOnly(dateStr);
  if (!calendarDate) return null;
  const [year, month, day] = calendarDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function calculateNightsFromDates(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;

  try {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);

    if (!start || !end) return null;

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 365 ? diffDays : null;
  } catch {
    return null;
  }
}

function extractNightsFromText(text: string): number | null {
  if (!text) return null;

  const nightsMatch = text.match(/(\d+)\s*[-]?\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) {
      return nights;
    }
  }

  return null;
}

function calculateReturnDate(startDate: string, nights: number): string {
  if (!startDate || !Number.isFinite(nights) || nights <= 0) return '';
  const returnDate = addCalendarDateDays(startDate, nights);
  if (!returnDate) {
    console.warn('[calculateReturnDate] Invalid start date:', startDate);
    return '';
  }
  return formatDateMDY(returnDate, '-');
}

function getKnownNights(...values: Array<number | null | undefined>): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 365);
}

function parseMoneyValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getLowestPositivePrice(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (filtered.length === 0) {
    return undefined;
  }
  return Math.min(...filtered);
}

function getBookedCabinRetailPrice(
  cabinType: string | undefined,
  prices: { interior?: number; oceanview?: number; balcony?: number; suite?: number }
): number | undefined {
  const normalized = (cabinType ?? '').toLowerCase();
  if (normalized.includes('interior') || normalized.includes('inside')) return prices.interior;
  if (normalized.includes('ocean') || normalized.includes('outside') || normalized.includes('view')) return prices.oceanview;
  if (normalized.includes('balcony') || normalized.includes('verand')) return prices.balcony;
  if (normalized.includes('suite')) return prices.suite;
  return undefined;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function firstMeaningfulText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && !/^(?:unknown|tbd|n\/?a|null|undefined)$/i.test(text)) {
      return text;
    }
  }
  return '';
}

function firstPositiveInteger(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 365) {
      return parsed;
    }
  }
  return undefined;
}

function getRawPassengers(rawBooking: UnknownRecord): UnknownRecord[] {
  const candidates = [rawBooking.passengersInStateroom, rawBooking.passengers];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const passengers = candidate.map(asRecord).filter((passenger) => Object.keys(passenger).length > 0);
      if (passengers.length > 0) return passengers;
    }
  }
  return [];
}

function titleCaseNamePart(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/(^|[-'\s])\p{L}/gu, (letter) => letter.toUpperCase());
}

function getRawGuestNames(passengers: UnknownRecord[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  passengers.forEach((passenger) => {
    const firstName = titleCaseNamePart(passenger.firstName ?? passenger.givenName);
    const lastName = titleCaseNamePart(passenger.lastName ?? passenger.surname);
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  });
  return names;
}

function getRoyalCabinLabel(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'I' || normalized.includes('INTERIOR') || normalized.includes('INSIDE')) return 'Interior';
  if (normalized === 'O' || normalized.includes('OCEAN') || normalized.includes('OUTSIDE')) return 'Ocean View';
  if (normalized === 'B' || normalized.includes('BALCONY') || normalized.includes('VERAND')) return 'Balcony';
  if (normalized === 'S' || normalized.includes('SUITE')) return 'Suite';
  return '';
}

function getProviderCabinDetails(cruise: BookedCruiseRow, rawBooking: UnknownRecord, passengers: UnknownRecord[]) {
  const leadPassenger = passengers[0] ?? {};
  const rawStateroomType = firstMeaningfulText(
    rawBooking.stateroomType,
    leadPassenger.stateroomType,
    cruise.stateroomType,
  );
  const cabinNumberOrGty = firstMeaningfulText(
    rawBooking.stateroomNumber,
    leadPassenger.stateroomNumber,
    cruise.stateroomNumber,
    cruise.cabinNumberOrGTY,
  );
  const isGty = /^GTY$/i.test(cabinNumberOrGty);
  const providerCabinLabel = getRoyalCabinLabel(rawStateroomType);
  const rowCabinLabel = getRoyalCabinLabel(cruise.cabinType);
  const baseCabinLabel = providerCabinLabel || rowCabinLabel || firstMeaningfulText(cruise.cabinType);

  return {
    cabinType: baseCabinLabel ? `${baseCabinLabel}${isGty ? ' GTY' : ''}` : undefined,
    cabinNumberOrGty,
    cabinNumber: cabinNumberOrGty && !isGty ? cabinNumberOrGty : undefined,
    category: firstMeaningfulText(
      rawBooking.stateroomCategoryCode,
      leadPassenger.stateroomCategoryCode,
      cruise.stateroomCategoryCode,
      cruise.cabinCategory,
    ) || undefined,
    deckNumber: firstMeaningfulText(rawBooking.deckNumber, cruise.deckNumber) || undefined,
    stateroomType: rawStateroomType || undefined,
  };
}

function parsePortList(portList: string | undefined): string[] | undefined {
  if (!portList) {
    return undefined;
  }

  const ports = portList
    .split(',')
    .map((port) => port.trim())
    .filter(Boolean);

  return ports.length > 0 ? ports : undefined;
}

function extractTradeInValue(perks: string): number | undefined {
  if (!perks) return undefined;

  const tradeInMatch = perks.match(/trade\s*[- ]?in\s*value[^\d$]*\$?([\d,]+)/i);
  if (tradeInMatch) {
    return parseInt(tradeInMatch[1].replace(/,/g, ''), 10);
  }

  return undefined;
}

export function transformOfferRowsToCruisesAndOffers(
  offerRows: OfferRow[],
  _loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal',
  ownershipOptions?: SyncOwnershipOptions
): { cruises: Cruise[]; offers: CasinoOffer[] } {
  const cruises: Cruise[] = [];
  const ownershipFields = getOwnershipFields(ownershipOptions, source);
  const offerMap = new Map<string, CasinoOffer>();
  const cruiseIdsByOfferKey = new Map<string, string[]>();
  const offerRowCountByKey = new Map<string, number>();

  for (const offer of offerRows) {
    const isOfferLevelOnly = !offer.shipName?.trim() && !offer.sailingDate?.trim();
    const cruiseId = generateId();
    const sailDate = parseDate(offer.sailingDate);
    const offerExpiryDate = parseDate(offer.offerExpirationDate);
    const safePerks = typeof offer.perks === 'string' ? offer.perks.trim() : '';
    const guests = parseGuestCount(offer.numberOfGuests);
    const itineraryNights = extractNightsFromText(offer.itinerary);
    const explicitNights = typeof offer.totalNights === 'number' && Number.isFinite(offer.totalNights) && offer.totalNights > 0
      ? offer.totalNights
      : null;
    const nights = getKnownNights(explicitNights, itineraryNights) ?? 0;
    const returnDate = isOfferLevelOnly ? '' : calculateReturnDate(sailDate, nights);
    const interiorPrice = parseMoneyValue(offer.interiorPrice);
    const oceanviewPrice = parseMoneyValue(offer.oceanviewPrice);
    const balconyPrice = parseMoneyValue(offer.balconyPrice);
    const suitePrice = parseMoneyValue(offer.suitePrice);
    const taxes = parseMoneyValue(offer.taxesAndFees);
    const lowestPerPersonPrice = getLowestPositivePrice([interiorPrice, oceanviewPrice, balconyPrice, suitePrice]);
    const lowestRoomPrice = getDoubleOccupancyRoomRetailValue(lowestPerPersonPrice);
    const ports = parsePortList(offer.portList);

    console.log(
      `[DataTransformer] Transforming offer row ${offer.offerCode || offer.offerName || 'unknown'} -> ${offer.shipName || 'offer-level only'} ${sailDate || 'no sailing date'} with prices`,
      { interiorPrice, oceanviewPrice, balconyPrice, suitePrice, taxes, nights, isOfferLevelOnly }
    );

    const cruise: Cruise = {
      id: cruiseId,
      shipName: offer.shipName,
      sailDate,
      returnDate,
      departurePort: offer.departurePort,
      destination: offer.itinerary,
      nights,
      price: lowestPerPersonPrice,
      interiorPrice,
      oceanviewPrice,
      balconyPrice,
      suitePrice,
      taxes,
      totalPrice: typeof lowestRoomPrice === 'number' ? lowestRoomPrice + (taxes ?? 0) : undefined,
      cabinType: offer.cabinType || undefined,
      offerCode: offer.offerCode,
      playerOfferId: offer.playerOfferId,
      offerInstanceId: offer.offerInstanceId || offer.carnivalOfferId,
      offerName: offer.offerName,
      offerExpiry: offerExpiryDate,
      itineraryName: offer.itinerary,
      itineraryRaw: offer.itinerary ? [offer.itinerary] : [],
      ports,
      guestsInfo: offer.numberOfGuests,
      guests,
      status: 'available',
      freePlay: extractFreePlay(safePerks),
      freeOBC: extractOBC(safePerks),
      tradeInValue: extractTradeInValue(safePerks),
      perks: safePerks ? [safePerks] : [],
      cruiseSource: source,
      ...ownershipFields,
      sourceRecordId: `${source}|${createRoyalOfferSailingIdentity({ ...offer, sailingDate: sailDate })}`,
      sourceEvidence: {
        rawCategory: 'offer_sailing',
        sourcePage: offer.sourcePage,
        sourceRecordId: createRoyalOfferSailingIdentity({ ...offer, sailingDate: sailDate }),
        capturedAt: ownershipFields.sourceRetrievedAt,
        authority: 'provider',
      },
      validationStatus: nights > 0 ? 'valid' : 'partial',
      dataConfidence: nights > 0 ? ownershipFields.dataConfidence : 'partial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!isOfferLevelOnly || source === 'carnival') {
      cruises.push(cruise);
    }

    const offerCodeKey = (offer.offerCode || '').trim().toUpperCase();
    const offerInstanceKey = (offer.playerOfferId || offer.carnivalOfferId || offer.offerInstanceId || '').trim().toLowerCase();
    const offerNameKey = (offer.offerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const offerExpiryKey = (offerExpiryDate || offer.offerExpirationDate || '').trim();
    // A CasinoOffer represents one provider offer instance and owns all of its
    // eligible sailings. Do not create one offer per sailing, and never combine
    // separate playerOfferIds merely because their public offer code matches.
    // This is required for codes such as 26TOR403, where Royal issued three
    // distinct offers carrying the same code.
    const fallbackOfferIdentity = [
      offerCodeKey || offerNameKey || 'unidentified-offer',
      offerNameKey,
      offerExpiryKey,
    ].join('|');
    const offerKey = `${source}|${offerInstanceKey ? `instance:${offerInstanceKey}` : `material:${fallbackOfferIdentity}`}`;
    offerRowCountByKey.set(offerKey, (offerRowCountByKey.get(offerKey) ?? 0) + 1);

    if (!offerMap.has(offerKey)) {
      const displayName = offer.offerName && offer.offerName.trim() && offer.offerName !== offer.offerCode
        ? offer.offerName
        : (offer.offerCode || getBrandOfferFallback(source));

      const casinoOffer: CasinoOffer = {
        id: `offer_${offerKey.replace(/\s+/g, '_')}_${Date.now()}`,
        cruiseId: isOfferLevelOnly && source !== 'carnival' ? undefined : cruiseId,
        cruiseIds: [],
        offerCode: offer.offerCode || '',
        playerOfferId: offer.playerOfferId,
        offerInstanceId: offer.offerInstanceId || offer.carnivalOfferId,
        offerName: displayName,
        offerType: determineOfferType(safePerks),
        title: displayName,
        description: safePerks || offer.itinerary || offer.departurePort || displayName,
        category: offer.offerType,
        perks: safePerks ? [safePerks] : [],
        shipName: offer.shipName || undefined,
        sailingDate: sailDate || undefined,
        itineraryName: offer.itinerary || undefined,
        nights,
        ports,
        roomType: offer.cabinType || undefined,
        guestsInfo: offer.numberOfGuests || undefined,
        guests,
        value: lowestRoomPrice,
        offerValue: lowestRoomPrice,
        interiorPrice,
        oceanviewPrice,
        balconyPrice,
        suitePrice,
        taxesFees: taxes,
        portCharges: taxes,
        freePlay: extractFreePlay(safePerks),
        freeplayAmount: extractFreePlay(safePerks),
        OBC: extractOBC(safePerks),
        obcAmount: extractOBC(safePerks),
        tradeInValue: extractTradeInValue(safePerks),
        expires: offerExpiryDate,
        expiryDate: offerExpiryDate,
        offerExpiryDate: offerExpiryDate,
        status: 'active',
        offerSource: source,
        bookingLink: offer.bookingLink || undefined,
        ...ownershipFields,
        sourceRecordId: [source, offerInstanceKey, offer.offerCode || displayName, offerExpiryDate].filter(Boolean).join('|'),
        sourceEvidence: {
          rawCategory: 'offer',
          sourcePage: offer.sourcePage,
          sourceRecordId: [offerInstanceKey, offer.offerCode || displayName, offerExpiryDate].filter(Boolean).join('|'),
          capturedAt: ownershipFields.sourceRetrievedAt,
          authority: 'provider',
        },
        validationStatus: nights > 0 || isOfferLevelOnly ? 'valid' : 'partial',
        dataConfidence: nights > 0 || isOfferLevelOnly ? ownershipFields.dataConfidence : 'partial',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      offerMap.set(offerKey, casinoOffer);
      cruiseIdsByOfferKey.set(offerKey, []);
    }

    const aggregatedOffer = offerMap.get(offerKey);
    if (aggregatedOffer) {
      aggregatedOffer.shipName = aggregatedOffer.shipName || offer.shipName || undefined;
      aggregatedOffer.sailingDate = aggregatedOffer.sailingDate || sailDate || undefined;
      aggregatedOffer.itineraryName = aggregatedOffer.itineraryName || offer.itinerary || undefined;
      aggregatedOffer.nights = aggregatedOffer.nights || nights;
      aggregatedOffer.roomType = aggregatedOffer.roomType || offer.cabinType || undefined;
      aggregatedOffer.guestsInfo = aggregatedOffer.guestsInfo || offer.numberOfGuests || undefined;
      aggregatedOffer.guests = aggregatedOffer.guests ?? guests;
      aggregatedOffer.ports = aggregatedOffer.ports ?? ports;
      aggregatedOffer.description = aggregatedOffer.description || safePerks || offer.itinerary || undefined;
      if (!aggregatedOffer.bookingLink && offer.bookingLink) {
        aggregatedOffer.bookingLink = offer.bookingLink;
      }

      if (interiorPrice !== undefined) {
        aggregatedOffer.interiorPrice = getLowestPositivePrice([aggregatedOffer.interiorPrice, interiorPrice]);
      }
      if (oceanviewPrice !== undefined) {
        aggregatedOffer.oceanviewPrice = getLowestPositivePrice([aggregatedOffer.oceanviewPrice, oceanviewPrice]);
      }
      if (balconyPrice !== undefined) {
        aggregatedOffer.balconyPrice = getLowestPositivePrice([aggregatedOffer.balconyPrice, balconyPrice]);
      }
      if (suitePrice !== undefined) {
        aggregatedOffer.suitePrice = getLowestPositivePrice([aggregatedOffer.suitePrice, suitePrice]);
      }
      if (taxes !== undefined) {
        aggregatedOffer.taxesFees = getLowestPositivePrice([aggregatedOffer.taxesFees, taxes]);
        aggregatedOffer.portCharges = getLowestPositivePrice([aggregatedOffer.portCharges, taxes]);
      }

      const aggregatedBestPerPersonPrice = getLowestPositivePrice([
        aggregatedOffer.interiorPrice,
        aggregatedOffer.oceanviewPrice,
        aggregatedOffer.balconyPrice,
        aggregatedOffer.suitePrice,
      ]);
      const aggregatedBestRoomPrice = getDoubleOccupancyRoomRetailValue(aggregatedBestPerPersonPrice);
      aggregatedOffer.value = aggregatedBestRoomPrice;
      aggregatedOffer.offerValue = aggregatedBestRoomPrice;
      aggregatedOffer.updatedAt = new Date().toISOString();
    }

    if (!isOfferLevelOnly || source === 'carnival') {
      cruiseIdsByOfferKey.get(offerKey)?.push(cruiseId);
    }
  }

  offerMap.forEach((offer, key) => {
    const cruiseIds = cruiseIdsByOfferKey.get(key) || [];
    offer.cruiseIds = cruiseIds;
    offer.cruiseId = cruiseIds[0];
  });

  console.log('[DataTransformer] Offer-instance aggregation complete', {
    inputRows: offerRows.length,
    offerInstances: offerMap.size,
    exportedSailings: cruises.length,
    instancesSharingCodes: Array.from(offerMap.values()).reduce<Record<string, number>>((counts, offer) => {
      const code = String(offer.offerCode || '').trim().toUpperCase();
      if (code) counts[code] = (counts[code] ?? 0) + 1;
      return counts;
    }, {}),
    rowsPerInstance: Array.from(offerRowCountByKey.entries()).slice(0, 25),
  });

  return {
    cruises,
    offers: Array.from(offerMap.values()),
  };
}

export function transformOffersToCasinoOffers(
  offers: OfferRow[],
  loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal',
  ownershipOptions?: SyncOwnershipOptions
): CasinoOffer[] {
  const { offers: casinoOffers } = transformOfferRowsToCruisesAndOffers(offers, loyaltyData, source, ownershipOptions);
  return casinoOffers;
}

export function transformBookedCruisesToAppFormat(
  cruises: BookedCruiseRow[],
  _loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal',
  ownershipOptions?: SyncOwnershipOptions
): BookedCruise[] {
  const ownershipFields = getOwnershipFields(ownershipOptions, source);

  return cruises.map((cruise) => {
    const rawBooking = asRecord(cruise.rawBooking);
    const rawPassengers = getRawPassengers(rawBooking);
    const rawGuestNames = getRawGuestNames(rawPassengers);
    const rawSailDate = firstMeaningfulText(rawBooking.sailDate, rawBooking.sailingStartDate, rawBooking.startDate);
    const startDate = parseDate(rawSailDate || cruise.sailingStartDate);
    const rowEndDate = parseDate(cruise.sailingEndDate);
    const rawApiNights = firstPositiveInteger(rawBooking.numberOfNights, rawBooking.nights);
    // Royal's booking payload supplies sailDate + numberOfNights even when the
    // display layer has a stale or tentative date range. Reconstructing the end
    // date from those provider fields avoids the observed 4-night Oasis ->
    // 3-night corruption.
    const providerEndDate = startDate && rawApiNights ? calculateReturnDate(startDate, rawApiNights) : '';
    const endDate = providerEndDate || rowEndDate;
    const providerCabin = getProviderCabinDetails(cruise, rawBooking, rawPassengers);

    let nights: number | undefined;
    let calculationMethod = 'unknown';
    const rawNights = rawApiNights ?? cruise.numberOfNights;
    const apiNights = rawNights === undefined || rawNights === null
      ? undefined
      : typeof rawNights === 'number'
        ? rawNights
        : parseInt(String(rawNights), 10);
    const hasValidApiNights = apiNights !== undefined && Number.isFinite(apiNights) && apiNights > 0 && apiNights <= 365;

    if (rawApiNights) {
      nights = rawApiNights;
      calculationMethod = 'provider';
      console.log(`[DataTransformer] ✓ Using provider booking nights for ${cruise.shipName}: ${nights}`);
    }

    if (calculationMethod === 'unknown' && startDate && endDate) {
      const dateNights = calculateNightsFromDates(startDate, endDate);
      if (dateNights !== null && dateNights > 0 && dateNights <= 365) {
        nights = dateNights;
        calculationMethod = 'dates';
        console.log(`[DataTransformer] ✓ Calculated nights from dates for ${cruise.shipName}: ${nights} nights (${startDate} to ${endDate})`);
      }
    }

    if (calculationMethod === 'unknown') {
      if (hasValidApiNights) {
        nights = apiNights as number;
        calculationMethod = 'api';
        console.log(`[DataTransformer] ✓ Using API nights for ${cruise.shipName}: ${nights}`);
      }
    }

    if (calculationMethod === 'unknown') {
      const titleNights = extractNightsFromText(cruise.cruiseTitle || '');
      if (titleNights !== null && titleNights > 0 && titleNights <= 365) {
        nights = titleNights;
        calculationMethod = 'title';
        console.log(`[DataTransformer] ✓ Extracted nights from title for ${cruise.shipName}: ${nights}`);
      } else {
        const itineraryNights = extractNightsFromText(cruise.itinerary || '');
        if (itineraryNights !== null && itineraryNights > 0 && itineraryNights <= 365) {
          nights = itineraryNights;
          calculationMethod = 'itinerary';
          console.log(`[DataTransformer] ✓ Extracted nights from itinerary for ${cruise.shipName}: ${nights}`);
        }
      }
    }

    const normalizedStatus = firstMeaningfulText(cruise.status, rawBooking.status, rawBooking.bookingStatus).trim().toLowerCase();
    const isCourtesyHold = normalizedStatus === 'courtesy hold' || normalizedStatus === 'hold' || normalizedStatus === 'offer';
    const isCompleted = normalizedStatus === 'completed' || normalizedStatus === 'past' || cruise.sourcePage?.toLowerCase().includes('past') === true;
    if (!nights) {
      console.warn(`[DataTransformer] Missing authoritative nights for ${cruise.shipName}; preserving unknown instead of defaulting to 7`);
      nights = 0;
    }

    console.log(`[DataTransformer] Final nights for ${cruise.shipName} (${startDate || 'unknown'} to ${endDate || 'unknown'}): ${nights || 'unknown'} (method: ${calculationMethod})`);

    const dateNights = startDate && endDate ? calculateNightsFromDates(startDate, endDate) : null;
    const hasExplicitDateRange = Boolean(startDate && endDate && dateNights && dateNights > 0);
    const hasDurationConflict = Boolean(hasExplicitDateRange && hasValidApiNights && dateNights !== apiNights);
    const derivedOnlyDuration = calculationMethod === 'title' || calculationMethod === 'itinerary';
    const finalEndDate = endDate || (startDate && hasValidApiNights ? calculateReturnDate(startDate, apiNights as number) : '');
    const hasCompleteSchedule = hasExplicitDateRange && !hasDurationConflict && !derivedOnlyDuration;
    const requiresCompletedReview = isCompleted && !hasCompleteSchedule;
    const validationStatus = requiresCompletedReview ? 'quarantined' : hasCompleteSchedule ? 'valid' : 'partial';
    const interiorPrice = parseMoneyValue(cruise.interiorPrice);
    const oceanviewPrice = parseMoneyValue(cruise.oceanviewPrice);
    const balconyPrice = parseMoneyValue(cruise.balconyPrice);
    const suitePrice = parseMoneyValue(cruise.suitePrice);
    const taxesAndFees = parseMoneyValue(cruise.taxesAndFees);
    const importedPerPersonCabinRetailValue = getBookedCabinRetailPrice(providerCabin.cabinType, {
      interior: interiorPrice,
      oceanview: oceanviewPrice,
      balcony: balconyPrice,
      suite: suitePrice,
    });
    const importedRoomCabinRetailValue = getDoubleOccupancyRoomRetailValue(importedPerPersonCabinRetailValue);

    const providerRecordId = getProviderRecordId(firstMeaningfulText(
      rawBooking.bookingId,
      rawBooking.masterBookingId,
      cruise.bookingId,
    ));
    const materialIdentity = createRoyalBookedCruiseIdentity({
      ...cruise,
      sailingStartDate: startDate,
      sailingEndDate: finalEndDate,
      numberOfNights: nights,
    });

    const bookedCruise: BookedCruise = {
      sourcePayload: cruise.rawBooking,
      id: generateId(),
      shipName: cruise.shipName,
      sailDate: startDate,
      returnDate: finalEndDate,
      departurePort: cruise.departurePort,
      destination: cruise.itinerary || cruise.cruiseTitle || '',
      nights,
      cabinType: providerCabin.cabinType,
      cabinNumber: providerCabin.cabinNumber,
      cabinCategory: providerCabin.category,
      price: importedPerPersonCabinRetailValue,
      interiorPrice,
      oceanviewPrice,
      balconyPrice,
      suitePrice,
      taxes: taxesAndFees,
      taxesFeesEstimate: taxesAndFees,
      retailValue: importedRoomCabinRetailValue,
      totalRetailCost: importedRoomCabinRetailValue,
      originalPrice: importedRoomCabinRetailValue,
      deckNumber: providerCabin.deckNumber,
      bookingId: providerRecordId,
      reservationNumber: providerRecordId,
      status: requiresCompletedReview ? 'reviewNeeded' : isCompleted ? 'completed' : isCourtesyHold ? 'Courtesy Hold' : 'booked',
      completionState: requiresCompletedReview ? undefined : isCompleted ? 'completed' : 'upcoming',
      isCourtesyHold,
      holdExpiration: cruise.holdExpiration || undefined,
      notes: requiresCompletedReview
        ? 'Royal completed-cruise record requires review because its provider date range or duration is incomplete or conflicting.'
        : isCompleted
        ? 'Imported from Royal Caribbean Past Trips'
        : isCourtesyHold
          ? `Courtesy Hold${cruise.holdExpiration ? ` (expires ${cruise.holdExpiration})` : ''}`
          : undefined,
      itineraryName: cruise.itinerary,
      itineraryRaw: cruise.itinerary ? [cruise.itinerary] : [],
      bookingStatus: firstMeaningfulText(rawBooking.bookingStatus, cruise.bookingStatus) || undefined,
      packageCode: firstMeaningfulText(rawBooking.packageCode, cruise.packageCode) || undefined,
      passengerStatus: firstMeaningfulText(rawPassengers[0]?.passengerStatus, cruise.passengerStatus) || undefined,
      stateroomNumber: providerCabin.cabinNumberOrGty || undefined,
      stateroomCategoryCode: providerCabin.category,
      stateroomType: providerCabin.stateroomType,
      musterStation: firstMeaningfulText(rawBooking.musterStation, cruise.musterStation) || undefined,
      guests: rawPassengers.length || parseGuestCount(cruise.numberOfGuests || ''),
      guestNames: rawGuestNames.length > 0 ? rawGuestNames : undefined,
      cruiseSource: source,
      ...ownershipFields,
      sourceRecordId: providerRecordId ? `${source}|provider:${providerRecordId}` : `${source}|${materialIdentity}`,
      sourceEvidence: {
        rawCategory: isCompleted ? 'completed_cruise' : isCourtesyHold ? 'courtesy_hold' : 'booked_cruise',
        sourcePage: cruise.sourcePage,
        sourceRecordId: providerRecordId ? `provider:${providerRecordId}` : materialIdentity,
        capturedAt: ownershipFields.sourceRetrievedAt,
        authority: 'provider',
      },
      validationStatus,
      dataConfidence: validationStatus === 'valid' ? ownershipFields.dataConfidence : 'partial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return bookedCruise;
  });
}

function determineOfferType(perks?: string): 'freeplay' | 'obc' | '2person' | 'discount' | 'package' {
  const perksLower = (perks ?? '').toLowerCase();

  if (perksLower.includes('free play') || perksLower.includes('freeplay')) {
    return 'freeplay';
  }
  if (perksLower.includes('obc') || perksLower.includes('onboard credit')) {
    return 'obc';
  }
  if (perksLower.includes('2') || perksLower.includes('two') || perksLower.includes('couple')) {
    return '2person';
  }
  if (perksLower.includes('discount') || perksLower.includes('%') || perksLower.includes('off')) {
    return 'discount';
  }

  return 'package';
}

function extractFreePlay(perks: string): number | undefined {
  if (!perks) return undefined;

  const match = perks.match(/\$?([\d,]+)\s*(free\s*play|freeplay)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  return undefined;
}

function extractOBC(perks: string): number | undefined {
  if (!perks) return undefined;

  const match = perks.match(/\$?([\d,]+)\s*(obc|onboard\s*credit)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  return undefined;
}

function parseGuestCount(guestsInfo: string): number | undefined {
  if (!guestsInfo) return undefined;

  const match = guestsInfo.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return undefined;
}
