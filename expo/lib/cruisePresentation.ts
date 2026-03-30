import type { BookedCruise, CasinoOffer, Cruise, ItineraryDay } from '@/types/models';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatDate, getDaysUntil } from '@/lib/date';
import { DEFAULT_CRUISE_IMAGE, getUniqueImageForCruise } from '@/constants/cruiseImages';
import { calculateCruiseValue, calculateOfferValue, getCabinPriceFromEntity } from '@/lib/valueCalculator';

export interface DisplayField {
  key: string;
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}

type DisplayFieldTone = NonNullable<DisplayField['tone']>;

export interface DataSection {
  key: string;
  title: string;
  fields: DisplayField[];
}

type EntityRecord = Record<string, unknown>;

const LABEL_OVERRIDES: Record<string, string> = {
  id: 'ID',
  shipName: 'Ship',
  sailDate: 'Sail Date',
  returnDate: 'Return Date',
  departurePort: 'Departure Port',
  destination: 'Destination',
  nights: 'Nights',
  cabinType: 'Cabin Type',
  roomType: 'Room Type',
  guests: 'Guests',
  guestsInfo: 'Guest Info',
  bookingId: 'Booking ID',
  reservationNumber: 'Reservation #',
  offerCode: 'Offer Code',
  offerName: 'Offer Name',
  offerType: 'Offer Type',
  expiryDate: 'Expiration',
  offerExpiryDate: 'Offer Expiration',
  offerExpiry: 'Offer Expiration',
  freeOBC: 'Free OBC',
  OBC: 'OBC',
  obcAmount: 'OBC',
  freePlay: 'Free Play',
  freeplayAmount: 'Free Play',
  tradeInValue: 'Trade-In Value',
  totalValue: 'Total Value',
  retailValue: 'Retail Value',
  valueScore: 'Value Score',
  casinoPoints: 'Casino Points',
  earnedPoints: 'Earned Points',
  totalWinnings: 'Total Winnings',
  netResult: 'Net Win/Loss',
  avgBet: 'Average Bet',
  portsAndTimes: 'Ports & Times',
  itineraryName: 'Itinerary',
  cruiseSource: 'Cruise Line',
  offerSource: 'Offer Source',
  createdAt: 'Created',
  updatedAt: 'Updated',
  csvRowNumber: 'CSV Row',
  bwoNumber: 'BWO Number',
  deckNumber: 'Deck',
  stateroomNumber: 'Stateroom #',
  stateroomType: 'Stateroom Type',
  stateroomCategoryCode: 'Stateroom Category',
  cabinNumber: 'Cabin #',
  cabinCategory: 'Cabin Category',
  bookingStatus: 'Booking Status',
  packageCode: 'Package Code',
  passengerStatus: 'Passenger Status',
  musterStation: 'Muster Station',
  specialRequests: 'Special Requests',
  checkInDate: 'Check-In Date',
  depositPaid: 'Deposit Paid',
  depositDate: 'Deposit Date',
  balanceDue: 'Balance Due',
  balanceDueDate: 'Balance Due Date',
  totalRetailCost: 'Retail Cost',
  totalCasinoDiscount: 'Casino Discount',
  pricePaid: 'Price Paid',
  totalSpend: 'Total Spend',
  actualSpend: 'Actual Spend',
  theoreticalLoss: 'Theo Loss',
  actualLoss: 'Actual Loss',
  sessionsPlayed: 'Sessions',
  hoursPlayed: 'Hours Played',
  pointsGoal: 'Points Goal',
  dailyPointsGoal: 'Daily Points Goal',
  nextCruiseCertificateValue: 'Next Cruise Cert Value',
  nextCruiseCertificateId: 'Next Cruise Cert ID',
  singleOccupancy: 'Single Occupancy',
  cruiseIds: 'Linked Cruises',
  cruiseId: 'Linked Cruise',
  validFrom: 'Valid From',
  validUntil: 'Valid Until',
  requiresDeposit: 'Deposit Required',
  termsConditions: 'Terms & Conditions',
  promoCode: 'Promo Code',
  minNights: 'Min Nights',
  maxNights: 'Max Nights',
  eligibleShips: 'Eligible Ships',
  ports: 'Ports',
  perks: 'Perks',
  imageUrl: 'Image URL',
};

const SECTION_KEYS: { key: string; title: string; fields: string[] }[] = [
  {
    key: 'overview',
    title: 'Overview',
    fields: [
      'shipName',
      'sailDate',
      'returnDate',
      'departurePort',
      'destination',
      'destinationRegion',
      'itineraryName',
      'nights',
      'category',
      'status',
      'completionState',
      'cabinType',
      'roomType',
      'guests',
      'guestsInfo',
      'singleOccupancy',
      'offerCode',
      'offerName',
      'offerType',
      'offerCategory',
      'offerSource',
      'cruiseSource',
      'received',
      'notes',
    ],
  },
  {
    key: 'pricing',
    title: 'Pricing & Value',
    fields: [
      'price',
      'pricePerNight',
      'pricePaid',
      'totalPrice',
      'originalPrice',
      'priceDrop',
      'interiorPrice',
      'oceanviewPrice',
      'balconyPrice',
      'suitePrice',
      'juniorSuitePrice',
      'grandSuitePrice',
      'taxes',
      'gratuities',
      'freeOBC',
      'OBC',
      'obcAmount',
      'freePlay',
      'freeplayAmount',
      'tradeInValue',
      'offerValue',
      'value',
      'discountValue',
      'discountPercent',
      'retailValue',
      'retailCabinValue',
      'compValue',
      'totalValue',
      'totalRetailCost',
      'totalCasinoDiscount',
      'depositPaid',
      'depositDate',
      'balanceDue',
      'balanceDueDate',
      'actualSpend',
      'totalSpend',
      'portCharges',
      'taxesFees',
      'requiresDeposit',
    ],
  },
  {
    key: 'casino',
    title: 'Casino Metrics',
    fields: [
      'casinoPoints',
      'earnedPoints',
      'pointsGoal',
      'dailyPointsGoal',
      'winnings',
      'totalWinnings',
      'netResult',
      'hoursPlayed',
      'sessionsPlayed',
      'avgBet',
      'theoreticalLoss',
      'actualLoss',
      'casinoOpenDays',
      'seaDays',
      'portDays',
      'casinoLevel',
      'casinoHost',
      'casinoHostEmail',
      'casinoHostPhone',
      'roi',
      'valueScore',
    ],
  },
  {
    key: 'booking',
    title: 'Booking Details',
    fields: [
      'bookingId',
      'reservationNumber',
      'bwoNumber',
      'bookingStatus',
      'passengerStatus',
      'packageCode',
      'checkInDate',
      'isCourtesyHold',
      'holdExpiration',
      'cabinNumber',
      'cabinCategory',
      'deckNumber',
      'stateroomNumber',
      'stateroomCategoryCode',
      'stateroomType',
      'musterStation',
      'guestNames',
      'specialRequests',
      'airfare',
      'insurance',
      'excursions',
      'diningReservations',
      'documents',
      'usedNextCruiseCertificate',
      'nextCruiseCertificateValue',
      'nextCruiseCertificateId',
      'financialRecordIds',
    ],
  },
  {
    key: 'itinerary',
    title: 'Itinerary',
    fields: ['itinerary', 'itineraryRaw', 'ports', 'portsAndTimes', 'itineraryNeedsManualEntry'],
  },
  {
    key: 'offer',
    title: 'Offer & Eligibility',
    fields: [
      'perks',
      'classification',
      'description',
      'title',
      'promoCode',
      'termsConditions',
      'validFrom',
      'validUntil',
      'expiryDate',
      'offerExpiryDate',
      'offerExpiry',
      'expires',
      'cruiseLines',
      'eligibleShips',
      'minNights',
      'maxNights',
      'has2025Badge',
      'bookingLink',
      'cruiseIds',
      'cruiseId',
    ],
  },
  {
    key: 'meta',
    title: 'Data & Sync',
    fields: ['id', 'csvRowNumber', 'createdAt', 'updatedAt', 'sourcePayload', 'imageUrl'],
  },
];

const CURRENCY_KEYWORDS = ['price', 'value', 'tax', 'gratuit', 'free', 'discount', 'spend', 'deposit', 'balance', 'loss', 'winnings', 'obc', 'coin'];
const DATE_KEYWORDS = ['date', 'sail', 'return', 'expiry', 'expire', 'valid', 'received', 'created', 'updated', 'checkin', 'hold'];
const NUMBER_KEYWORDS = ['point', 'night', 'guest', 'day', 'hour', 'session', 'row'];

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function formatFieldLabel(key: string): string {
  const override = LABEL_OVERRIDES[key];
  if (override) {
    return override;
  }

  const normalized = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function maybeFormatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return formatDate(value, 'medium');
}

function formatItineraryDay(day: ItineraryDay): string {
  const segments: string[] = [`Day ${day.day}`, day.port];
  if (day.arrival) segments.push(`Arrive ${day.arrival}`);
  if (day.departure) segments.push(`Depart ${day.departure}`);
  if (day.isSeaDay) segments.push('Sea Day');
  if (day.notes) segments.push(day.notes);
  return segments.join(' • ');
}

export function formatFieldValue(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    const normalizedKey = key.toLowerCase();
    if (CURRENCY_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))) {
      return formatCurrency(value);
    }
    if (normalizedKey.includes('percent')) {
      return `${value}%`;
    }
    if (NUMBER_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))) {
      return formatNumber(value);
    }
    return formatNumber(value);
  }

  if (typeof value === 'string') {
    const normalizedKey = key.toLowerCase();
    if (DATE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))) {
      return maybeFormatDate(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }

    if (typeof value[0] === 'string' || typeof value[0] === 'number') {
      return value.map((item) => String(item)).join(' • ');
    }

    if (typeof value[0] === 'object' && value[0] !== null && 'day' in (value[0] as ItineraryDay) && 'port' in (value[0] as ItineraryDay)) {
      return (value as ItineraryDay[]).map(formatItineraryDay).join('\n');
    }

    return value
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return Object.entries(item as Record<string, unknown>)
            .filter(([, nestedValue]) => hasMeaningfulValue(nestedValue))
            .map(([nestedKey, nestedValue]) => `${formatFieldLabel(nestedKey)}: ${formatFieldValue(nestedValue, nestedKey)}`)
            .join(' • ');
        }
        return String(item);
      })
      .join('\n');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => hasMeaningfulValue(nestedValue))
      .map(([nestedKey, nestedValue]) => `${formatFieldLabel(nestedKey)}: ${formatFieldValue(nestedValue, nestedKey)}`)
      .join(' • ');
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || typeof value === 'symbol') {
    return String(value);
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  return '';
}

function extractFields(entity: EntityRecord, keys: string[], consumed: Set<string>): DisplayField[] {
  return keys
    .filter((key) => key in entity)
    .filter((key) => hasMeaningfulValue(entity[key]))
    .map((key) => {
      consumed.add(key);
      const value = formatFieldValue(entity[key], key);
      const tone: DisplayField['tone'] = key.toLowerCase().includes('warning') || key.toLowerCase().includes('balance')
        ? 'warning'
        : key.toLowerCase().includes('profit') || key.toLowerCase().includes('value') || key.toLowerCase().includes('free')
          ? 'success'
          : key.toLowerCase().includes('loss')
            ? 'danger'
            : 'default';

      return {
        key,
        label: formatFieldLabel(key),
        value,
        tone,
      };
    });
}

export function buildDataSections(entity: EntityRecord): DataSection[] {
  const consumed = new Set<string>();

  const sections = SECTION_KEYS.map((section) => ({
    key: section.key,
    title: section.title,
    fields: extractFields(entity, section.fields, consumed),
  })).filter((section) => section.fields.length > 0);

  const additionalFields = Object.keys(entity)
    .filter((key) => !consumed.has(key))
    .filter((key) => hasMeaningfulValue(entity[key]))
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      label: formatFieldLabel(key),
      value: formatFieldValue(entity[key], key),
      tone: 'default' as const,
    }));

  if (additionalFields.length > 0) {
    sections.push({
      key: 'additional',
      title: 'Additional Data',
      fields: additionalFields,
    });
  }

  return sections;
}

export function pickCruiseImage(entity: Partial<Cruise> | Partial<BookedCruise> | Partial<CasinoOffer>, fallbackId?: string): string {
  const cruiseLike = entity as Partial<Cruise>;
  const offerLike = entity as Partial<CasinoOffer>;
  const id = cruiseLike.id || offerLike.id || fallbackId || 'default-cruise';
  const destination = cruiseLike.destination || cruiseLike.itineraryName || offerLike.itineraryName || 'Cruise';
  const sailDate = cruiseLike.sailDate || offerLike.sailingDate;
  const shipName = cruiseLike.shipName || offerLike.shipName;
  return getUniqueImageForCruise(id, destination, sailDate, shipName) || DEFAULT_CRUISE_IMAGE;
}

export function buildCruiseCardFields(cruise: Cruise | BookedCruise, linkedOffer?: CasinoOffer): { primary: DisplayField[]; extra: DisplayField[] } {
  const valueBreakdown = calculateCruiseValue(cruise as BookedCruise | Cruise);
  const record: EntityRecord = {
    sailDate: cruise.sailDate,
    returnDate: cruise.returnDate,
    nights: cruise.nights,
    departurePort: cruise.departurePort,
    itineraryName: cruise.itineraryName,
    destination: cruise.destination,
    cabinType: cruise.cabinType,
    guests: cruise.guests,
    bookingId: (cruise as BookedCruise).bookingId,
    reservationNumber: (cruise as BookedCruise).reservationNumber,
    offerCode: cruise.offerCode,
    offerName: cruise.offerName || linkedOffer?.offerName || linkedOffer?.title,
    status: cruise.status,
    completionState: (cruise as BookedCruise).completionState,
    freePlay: cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount,
    freeOBC: cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount,
    tradeInValue: cruise.tradeInValue ?? linkedOffer?.tradeInValue,
    totalValue: valueBreakdown.totalValueReceived,
    retailValue: valueBreakdown.totalRetailValue,
    interiorPrice: cruise.interiorPrice,
    oceanviewPrice: cruise.oceanviewPrice,
    balconyPrice: cruise.balconyPrice,
    suitePrice: cruise.suitePrice,
    taxes: cruise.taxes,
    earnedPoints: (cruise as BookedCruise).earnedPoints ?? (cruise as BookedCruise).casinoPoints,
    netResult: (cruise as BookedCruise).netResult ?? (cruise as BookedCruise).winnings,
  };

  const orderedKeys = [
    'sailDate',
    'returnDate',
    'nights',
    'departurePort',
    'destination',
    'itineraryName',
    'cabinType',
    'guests',
    'bookingId',
    'reservationNumber',
    'offerCode',
    'offerName',
    'freePlay',
    'freeOBC',
    'tradeInValue',
    'retailValue',
    'totalValue',
    'earnedPoints',
    'netResult',
    'interiorPrice',
    'oceanviewPrice',
    'balconyPrice',
    'suitePrice',
    'taxes',
    'status',
    'completionState',
  ];

  const fields = orderedKeys
    .filter((key) => hasMeaningfulValue(record[key]))
    .map((key) => {
      const tone: DisplayFieldTone = key === 'retailValue' || key === 'totalValue' || key === 'freePlay' || key === 'freeOBC'
        ? 'success'
        : key === 'netResult'
          ? ((Number((cruise as BookedCruise).netResult ?? (cruise as BookedCruise).winnings ?? 0) >= 0) ? 'success' : 'danger')
          : 'default';

      return {
        key,
        label: formatFieldLabel(key),
        value: formatFieldValue(record[key], key),
        tone,
      };
    });

  return {
    primary: fields.slice(0, 8),
    extra: fields.slice(8),
  };
}

export function buildOfferCardFields(offer: CasinoOffer | undefined, cruises: Cruise[]): { primary: DisplayField[]; extra: DisplayField[] } {
  const fallbackCruise = cruises[0];
  const targetOffer = offer ?? {
    id: fallbackCruise?.id ?? 'offer',
    title: fallbackCruise?.offerName ?? 'Offer',
    offerType: 'comped' as const,
    offerCode: fallbackCruise?.offerCode,
    offerName: fallbackCruise?.offerName,
    nights: fallbackCruise?.nights,
    shipName: fallbackCruise?.shipName,
    itineraryName: fallbackCruise?.itineraryName,
    freePlay: fallbackCruise?.freePlay,
    OBC: fallbackCruise?.freeOBC,
    tradeInValue: fallbackCruise?.tradeInValue,
    expiryDate: fallbackCruise?.offerExpiry,
    roomType: fallbackCruise?.cabinType,
    guests: fallbackCruise?.guests,
    interiorPrice: fallbackCruise?.interiorPrice,
    oceanviewPrice: fallbackCruise?.oceanviewPrice,
    balconyPrice: fallbackCruise?.balconyPrice,
    suitePrice: fallbackCruise?.suitePrice,
    taxesFees: fallbackCruise?.taxes,
  } satisfies CasinoOffer;

  const offerValue = calculateOfferValue(targetOffer);
  const bestCabin = getCabinPriceFromEntity(targetOffer, targetOffer.roomType) ?? 0;
  const record: EntityRecord = {
    expiryDate: targetOffer.expiryDate || targetOffer.offerExpiryDate || targetOffer.expires,
    offerCode: targetOffer.offerCode,
    offerName: targetOffer.offerName || targetOffer.title,
    offerType: targetOffer.offerType,
    cruisesAvailable: cruises.length,
    shipName: targetOffer.shipName,
    itineraryName: targetOffer.itineraryName,
    nights: targetOffer.nights,
    roomType: targetOffer.roomType,
    guests: targetOffer.guests,
    freePlay: targetOffer.freePlay || targetOffer.freeplayAmount,
    OBC: targetOffer.OBC || targetOffer.obcAmount,
    tradeInValue: targetOffer.tradeInValue,
    retailValue: bestCabin > 0 ? bestCabin * (targetOffer.guests || 2) : offerValue.totalRetailValue,
    totalValue: offerValue.totalValueReceived,
    interiorPrice: targetOffer.interiorPrice,
    oceanviewPrice: targetOffer.oceanviewPrice,
    balconyPrice: targetOffer.balconyPrice,
    suitePrice: targetOffer.suitePrice,
    taxesFees: targetOffer.taxesFees,
    status: targetOffer.status,
  };

  const orderedKeys = [
    'expiryDate',
    'offerCode',
    'offerName',
    'offerType',
    'cruisesAvailable',
    'shipName',
    'itineraryName',
    'nights',
    'roomType',
    'guests',
    'freePlay',
    'OBC',
    'tradeInValue',
    'retailValue',
    'totalValue',
    'interiorPrice',
    'oceanviewPrice',
    'balconyPrice',
    'suitePrice',
    'taxesFees',
    'status',
  ];

  const fields = orderedKeys
    .filter((key) => hasMeaningfulValue(record[key]))
    .map((key) => {
      const tone: DisplayFieldTone = key === 'totalValue' || key === 'freePlay' || key === 'OBC' || key === 'tradeInValue'
        ? 'success'
        : 'default';

      return {
        key,
        label: key === 'cruisesAvailable' ? 'Cruises Available' : formatFieldLabel(key),
        value: formatFieldValue(record[key], key),
        tone,
      };
    });

  return {
    primary: fields.slice(0, 8),
    extra: fields.slice(8),
  };
}

export function getCruiseBadge(cruise: Cruise | BookedCruise): { label: string; tone: 'gold' | 'teal' | 'emerald' | 'violet' | 'rose' | 'slate' } {
  const bookedCruise = cruise as BookedCruise;
  if (bookedCruise.bookingId || bookedCruise.reservationNumber || cruise.status === 'booked') {
    return { label: 'BOOKED', tone: 'teal' };
  }

  if (cruise.status === 'completed' || bookedCruise.completionState === 'completed') {
    return { label: 'COMPLETED', tone: 'emerald' };
  }

  return { label: 'AVAILABLE', tone: 'gold' };
}

export function getOfferBadge(offer: CasinoOffer | undefined): { label: string; tone: 'gold' | 'teal' | 'emerald' | 'violet' | 'rose' | 'slate' } {
  if (!offer) {
    return { label: 'OFFER', tone: 'violet' };
  }

  if (offer.status === 'used') {
    return { label: 'USED', tone: 'slate' };
  }

  if (offer.status === 'booked') {
    return { label: 'BOOKED', tone: 'teal' };
  }

  const expiry = offer.expiryDate || offer.offerExpiryDate || offer.expires;
  if (expiry) {
    const daysLeft = getDaysUntil(expiry);
    if (daysLeft >= 0 && daysLeft <= 7) {
      return { label: 'EXPIRING', tone: 'rose' };
    }
  }

  return { label: 'ACTIVE', tone: 'gold' };
}

export function mergeCruiseWithOffer(cruise: Cruise | BookedCruise, linkedOffer?: CasinoOffer): Cruise | BookedCruise {
  if (!linkedOffer) {
    return cruise;
  }

  return {
    ...cruise,
    offerName: cruise.offerName || linkedOffer.offerName || linkedOffer.title,
    freePlay: cruise.freePlay ?? linkedOffer.freePlay ?? linkedOffer.freeplayAmount,
    freeOBC: cruise.freeOBC ?? linkedOffer.OBC ?? linkedOffer.obcAmount,
    tradeInValue: cruise.tradeInValue ?? linkedOffer.tradeInValue,
    interiorPrice: cruise.interiorPrice ?? linkedOffer.interiorPrice,
    oceanviewPrice: cruise.oceanviewPrice ?? linkedOffer.oceanviewPrice,
    balconyPrice: cruise.balconyPrice ?? linkedOffer.balconyPrice,
    suitePrice: cruise.suitePrice ?? linkedOffer.suitePrice,
    taxes: cruise.taxes ?? linkedOffer.taxesFees,
  };
}
