import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';

function escapeCSVField(field: string | undefined): string {
  if (!field) return '';
  
  const value = String(field);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateOffersCSV(offers: OfferRow[], loyaltyData: LoyaltyData | null): string {
  const headers = [
    'Source Page',
    'Offer Name',
    'Offer Code',
    'Offer Expiration Date',
    'Offer Type',
    'Ship Name',
    'Sailing Date',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Number of Guests',
    'Perks',
    'Loyalty Level',
    'Loyalty Points',
    'Interior Price',
    'Oceanview Price',
    'Balcony Price',
    'Suite Price',
    'Port List'
  ];

  const rows = offers.map(offer => [
    escapeCSVField(offer.sourcePage),
    escapeCSVField(offer.offerName),
    escapeCSVField(offer.offerCode),
    escapeCSVField(offer.offerExpirationDate),
    escapeCSVField(offer.offerType),
    escapeCSVField(offer.shipName),
    escapeCSVField(offer.sailingDate),
    escapeCSVField(offer.itinerary),
    escapeCSVField(offer.departurePort),
    escapeCSVField(offer.cabinType),
    escapeCSVField(offer.numberOfGuests),
    escapeCSVField(offer.perks),
    escapeCSVField(offer.loyaltyLevel || loyaltyData?.crownAndAnchorLevel || ''),
    escapeCSVField(offer.loyaltyPoints || loyaltyData?.crownAndAnchorPoints || ''),
    escapeCSVField(offer.interiorPrice || ''),
    escapeCSVField(offer.oceanviewPrice || ''),
    escapeCSVField(offer.balconyPrice || ''),
    escapeCSVField(offer.suitePrice || ''),
    escapeCSVField(offer.portList || '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

export function generateBookedCruisesCSV(cruises: BookedCruiseRow[], loyaltyData: LoyaltyData | null): string {
  const headers = [
    'Source Page',
    'Ship Name',
    'Sailing Start Date',
    'Sailing End Date',
    'Sailing Date(s)',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Cabin Number/GTY',
    'Booking ID',
    'Status',
    'Loyalty Level',
    'Loyalty Points'
  ];

  const rows = cruises.map(cruise => [
    escapeCSVField(cruise.sourcePage),
    escapeCSVField(cruise.shipName),
    escapeCSVField(cruise.sailingStartDate),
    escapeCSVField(cruise.sailingEndDate),
    escapeCSVField(cruise.sailingDates),
    escapeCSVField(cruise.itinerary),
    escapeCSVField(cruise.departurePort),
    escapeCSVField(cruise.cabinType),
    escapeCSVField(cruise.cabinNumberOrGTY),
    escapeCSVField(cruise.bookingId),
    escapeCSVField(cruise.status),
    escapeCSVField(cruise.loyaltyLevel || loyaltyData?.crownAndAnchorLevel || ''),
    escapeCSVField(cruise.loyaltyPoints || loyaltyData?.crownAndAnchorPoints || '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}
