import type { Cruise, CasinoOffer } from '@/types/models';
import {
  parseCSVLine,
  normalizeDateString,
  calculateReturnDate,
  getPriceForRoomType,
  detectDelimiter,
  createHeaderMap,
  getColumnIndex,
} from './csvParser';
import { isCelebrityShip } from '@/constants/shipInfo';

export interface ParsedOfferRow {
  shipName: string;
  sailingDate: string;
  itinerary: string;
  offerCode: string;
  offerName: string;
  roomType: string;
  guestsInfo: string;
  perks: string;
  shipClass: string;
  tradeInValue: number;
  offerValue: number;
  offerExpiryDate: string;
  priceInterior: number;
  priceOceanView: number;
  priceBalcony: number;
  priceSuite: number;
  taxesFees: number;
  portsAndTimes: string;
  offerType: string;
  nights: number;
  departurePort: string;
}

function mapOfferType(typeStr: string): CasinoOffer['offerType'] {
  const lower = (typeStr || '').toLowerCase();
  if (lower.includes('freeplay') || lower.includes('free play')) return 'freeplay';
  if (lower.includes('discount')) return 'discount';
  if (lower.includes('obc')) return 'obc';
  if (lower.includes('2 guest') || lower.includes('2 person') || lower.includes('2person')) return '2person';
  if (lower.includes('1+') || lower.includes('1 +')) return '1+discount';
  return 'package';
}

function getShipClassFromName(shipName: string): string {
  const name = shipName.toLowerCase();
  
  if (name.includes('oasis') || name.includes('wonder') || name.includes('symphony') || 
      name.includes('harmony') || name.includes('allure') || name.includes('utopia')) {
    return 'Oasis Class';
  }
  if (name.includes('quantum') || name.includes('anthem') || name.includes('ovation') || name.includes('spectrum')) {
    return 'Quantum Class';
  }
  if (name.includes('freedom') || name.includes('liberty') || name.includes('independence')) {
    return 'Freedom Class';
  }
  if (name.includes('voyager') || name.includes('explorer') || name.includes('adventure') || 
      name.includes('navigator') || name.includes('mariner')) {
    return 'Voyager Class';
  }
  if (name.includes('radiance') || name.includes('brilliance') || name.includes('serenade') || name.includes('jewel')) {
    return 'Radiance Class';
  }
  if (name.includes('icon')) {
    return 'Icon Class';
  }
  
  return 'Unknown Class';
}

export function parseOffersCSV(content: string): { cruises: Cruise[]; offers: CasinoOffer[]; isCelebrityImport: boolean } {
  console.log('[OffersParser] Starting to parse offers CSV');
  
  const allShipNames: string[] = [];
  
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    console.log('[OffersParser] CSV has no data rows');
    return { cruises: [], offers: [], isCelebrityImport: false };
  }

  const headerLine = lines[0];
  const isTabDelimited = detectDelimiter(headerLine) === 'tab';
  
  console.log('[OffersParser] Detected delimiter:', isTabDelimited ? 'TAB' : 'COMMA');
  
  const headers = isTabDelimited 
    ? headerLine.split('\t').map(h => h.trim().toLowerCase())
    : parseCSVLine(headerLine).map(h => h.trim().toLowerCase());
  
  console.log('[OffersParser] Headers:', headers);

  const headerMap = createHeaderMap(headers);

  const colIndices = {
    shipName: getColumnIndex(headerMap, ['ship name', 'shipname', 'ship']),
    sailingDate: getColumnIndex(headerMap, ['sailing date', 'sailingdate', 'sail date', 'saildate', 'date']),
    itinerary: getColumnIndex(headerMap, ['itinerary', 'route', 'destination']),
    offerCode: getColumnIndex(headerMap, ['offer code', 'offercode', 'code']),
    offerName: getColumnIndex(headerMap, ['real offer name', 'offer name', 'offername', 'offer', 'realoffername']),
    roomType: getColumnIndex(headerMap, ['room type', 'roomtype', 'cabin type', 'cabintype']),
    guestsInfo: getColumnIndex(headerMap, ['guests info', 'guestsinfo', 'guests']),
    perks: getColumnIndex(headerMap, ['perks', 'benefits']),
    offerValue: getColumnIndex(headerMap, ['offer value', 'offervalue', 'value']),
    shipClass: getColumnIndex(headerMap, ['ship class', 'shipclass', 'class']),
    tradeInValue: getColumnIndex(headerMap, ['trade-in value', 'tradeinvalue', 'trade in value', 'tradein']),
    offerExpiryDateAlt: getColumnIndex(headerMap, ['offer expiry date alt', 'offerexpirydatealt']),
    offerExpiryDate: getColumnIndex(headerMap, ['offer expiry date', 'offerexpirydate', 'expiry date', 'expirydate', 'expiry', 'expires']),
    offerReceivedDate: getColumnIndex(headerMap, ['offer received date', 'offerreceiveddate', 'received date', 'receiveddate', 'rcvd', 'received']),
    priceInterior: getColumnIndex(headerMap, ['price interior', 'priceinterior', 'interior price', 'interiorprice', 'interior']),
    priceOceanView: getColumnIndex(headerMap, ['price ocean view', 'priceoceanview', 'ocean view price', 'oceanviewprice', 'oceanview', 'price oceanview']),
    priceBalcony: getColumnIndex(headerMap, ['price balcony', 'pricebalcony', 'balcony price', 'balconyprice', 'balcony']),
    priceSuite: getColumnIndex(headerMap, ['price suite', 'pricesuite', 'suite price', 'suiteprice', 'suite']),
    taxesFees: getColumnIndex(headerMap, ['taxes & fees', 'taxes&fees', 'taxesfees', 'taxes', 'port taxes', 'port taxes & fees']),
    portsAndTimes: getColumnIndex(headerMap, ['ports & times', 'ports&times', 'portsandtimes', 'ports', 'port schedule']),
    offerType: getColumnIndex(headerMap, ['offer type / category', 'offertype', 'offer type', 'category', 'type']),
    nights: getColumnIndex(headerMap, ['nights', 'duration', 'length']),
    departurePort: getColumnIndex(headerMap, ['departure port', 'departureport', 'depart port', 'home port', 'port']),
  };

  console.log('[OffersParser] Column indices:', colIndices);

  const cruises: Cruise[] = [];
  const offerMap = new Map<string, CasinoOffer>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = isTabDelimited 
      ? line.split('\t').map(v => v.trim())
      : parseCSVLine(line);

    const getValue = (idx: number): string => {
      if (idx === -1 || idx >= values.length) return '';
      return values[idx] || '';
    };

    const getNumericValue = (idx: number): number => {
      const val = getValue(idx).replace(/[,$]/g, '');
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    const shipName = getValue(colIndices.shipName);
    if (shipName) {
      allShipNames.push(shipName);
    }
    const sailingDateRaw = getValue(colIndices.sailingDate);
    const itinerary = getValue(colIndices.itinerary);
    const offerCode = getValue(colIndices.offerCode);
    const offerName = getValue(colIndices.offerName);
    console.log(`[OffersParser] Row ${i}: offerCode=${offerCode}, offerName=${offerName}`);
    const roomType = getValue(colIndices.roomType);
    const guestsInfo = getValue(colIndices.guestsInfo);
    const perks = getValue(colIndices.perks);
    const offerValue = getNumericValue(colIndices.offerValue);
    const shipClass = getValue(colIndices.shipClass);
    const tradeInValue = getNumericValue(colIndices.tradeInValue);
    const offerExpiryDateAlt = getValue(colIndices.offerExpiryDateAlt);
    const offerExpiryDateRaw = getValue(colIndices.offerExpiryDate) || offerExpiryDateAlt;
    const offerReceivedDateRaw = getValue(colIndices.offerReceivedDate);
    const priceInterior = getNumericValue(colIndices.priceInterior);
    const priceOceanView = getNumericValue(colIndices.priceOceanView);
    const priceBalcony = getNumericValue(colIndices.priceBalcony);
    const priceSuite = getNumericValue(colIndices.priceSuite);
    const taxesFees = getNumericValue(colIndices.taxesFees);
    const portsAndTimes = getValue(colIndices.portsAndTimes);
    const offerType = getValue(colIndices.offerType);
    const nights = getNumericValue(colIndices.nights) || 7;
    const departurePort = getValue(colIndices.departurePort);

    if (!shipName || !sailingDateRaw) {
      console.log(`[OffersParser] Skipping row ${i}: missing ship or date`);
      continue;
    }

    const sailDate = normalizeDateString(sailingDateRaw);
    const offerExpiryDate = normalizeDateString(offerExpiryDateRaw);
    const offerReceivedDate = normalizeDateString(offerReceivedDateRaw);
    
    const finalShipClass = shipClass || getShipClassFromName(shipName);
    
    const returnDate = calculateReturnDate(sailDate, nights);

    const ports = portsAndTimes
      ? portsAndTimes.split(/[→›‚Üí]/).map(p => p.trim()).filter(Boolean)
      : [];

    const cruiseId = `cruise_${shipName.replace(/\s+/g, '_')}_${sailDate}_${Date.now()}_${i}`;
    
    const cruise: Cruise = {
      id: cruiseId,
      shipName,
      sailDate,
      returnDate,
      departurePort,
      destination: itinerary,
      nights,
      cabinType: roomType || 'Balcony',
      interiorPrice: priceInterior,
      oceanviewPrice: priceOceanView,
      balconyPrice: priceBalcony,
      suitePrice: priceSuite,
      taxes: taxesFees,
      totalPrice: getPriceForRoomType(roomType, priceInterior, priceOceanView, priceBalcony, priceSuite),
      offerCode,
      offerValue,
      offerExpiry: offerExpiryDate,
      itineraryName: itinerary,
      ports,
      guestsInfo,
      status: 'available',
      category: finalShipClass,
      createdAt: new Date().toISOString(),
    };

    cruises.push(cruise);
    console.log(`[OffersParser] Parsed cruise: ${shipName} - ${sailDate} - ${itinerary}`);

    if (offerCode && !offerMap.has(offerCode)) {
      const finalOfferName = offerName || (offerValue > 0 ? `${offerValue} Offer` : offerCode);
      const offer: CasinoOffer = {
        id: `offer_${offerCode}_${Date.now()}`,
        offerCode,
        offerName: finalOfferName,
        title: finalOfferName,
        offerType: mapOfferType(offerType),
        tradeInValue,
        offerValue,
        expiryDate: offerExpiryDate,
        offerExpiryDate,
        expires: offerExpiryDate,
        received: offerReceivedDate,
        category: offerType,
        perks: perks && perks !== '-' ? perks.split(',').map(p => p.trim()) : [],
        cruiseIds: [cruiseId],
        shipName,
        sailingDate: sailDate,
        roomType,
        guestsInfo,
        interiorPrice: priceInterior,
        oceanviewPrice: priceOceanView,
        balconyPrice: priceBalcony,
        suitePrice: priceSuite,
        taxesFees,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      offerMap.set(offerCode, offer);
    } else if (offerCode) {
      const existingOffer = offerMap.get(offerCode);
      if (existingOffer && existingOffer.cruiseIds) {
        existingOffer.cruiseIds.push(cruiseId);
      }
    }
  }

  const offersArray = Array.from(offerMap.values());
  const isCelebrityImport = allShipNames.length > 0 && allShipNames.every(ship => isCelebrityShip(ship));
  
  console.log(`[OffersParser] Parsed ${cruises.length} cruises and ${offersArray.length} unique offers`);
  console.log(`[OffersParser] Is Celebrity import: ${isCelebrityImport}`);
  
  if (isCelebrityImport) {
    console.log('[OffersParser] Celebrity cruises detected - will merge with existing data');
  }

  return { cruises, offers: offersArray, isCelebrityImport };
}

function escapeCSVField(value: string | number): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDateMMDDYYYY(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const normalized = normalizeDateString(dateStr);
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateStr;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch {
    return dateStr || '';
  }
}

export function generateOffersCSV(cruises: Cruise[], offers: CasinoOffer[]): string {

  const headers = [
    'Ship Name',
    'Sailing Date',
    'Itinerary',
    'Offer Code',
    'Real Offer Name',
    'Room Type',
    'Guests Info',
    'Perks',
    'Offer Value',
    'Offer Expiry Date Alt',
    'Offer Expiry Date',
    'Price Interior',
    'Price Ocean View',
    'Price Balcony',
    'Price Suite',
    'Taxes & Fees',
    'Ports & Times',
    'Offer Type / Category',
    'Nights',
    'Departure Port',
  ];

  const rows: string[] = [headers.join(',')];

  for (const cruise of cruises) {
    const offer = offers.find(o => o.offerCode === cruise.offerCode);
    
    const row = [
      escapeCSVField(cruise.shipName || ''),
      formatDateMMDDYYYY(cruise.sailDate),
      escapeCSVField(cruise.itineraryName || cruise.destination || ''),
      escapeCSVField(cruise.offerCode || ''),
      escapeCSVField(offer?.offerName || cruise.offerName || ''),
      escapeCSVField(cruise.cabinType || ''),
      escapeCSVField(cruise.guestsInfo || '2 Guests'),
      escapeCSVField(offer?.perks?.join(', ') || '-'),
      escapeCSVField(cruise.offerValue || 0),
      '',
      formatDateMMDDYYYY(cruise.offerExpiry),
      escapeCSVField(cruise.interiorPrice || 0),
      escapeCSVField(cruise.oceanviewPrice || 0),
      escapeCSVField(cruise.balconyPrice || 0),
      escapeCSVField(cruise.suitePrice || 0),
      escapeCSVField(cruise.taxes || 0),
      escapeCSVField(cruise.ports?.join(' → ') || ''),
      escapeCSVField(offer?.category || '2 Guests'),
      escapeCSVField(cruise.nights || 7),
      escapeCSVField(cruise.departurePort || ''),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}
