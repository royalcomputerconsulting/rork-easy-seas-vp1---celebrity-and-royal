import type { BookedCruise, CasinoOffer, CalendarEvent } from '@/types/models';

export function generateSampleData(): {
  bookedCruises: BookedCruise[];
  casinoOffers: CasinoOffer[];
  calendarEvents: CalendarEvent[];
} {
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setMonth(pastDate.getMonth() - 2);
  
  const futureDate1 = new Date(today);
  futureDate1.setMonth(futureDate1.getMonth() + 2);
  
  const futureDate2 = new Date(today);
  futureDate2.setMonth(futureDate2.getMonth() + 4);

  const formatDate = (date: Date): string => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
  };

  const getReturnDate = (sailDate: Date, nights: number): Date => {
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + nights);
    return returnDate;
  };

  const completedCruise: BookedCruise = {
    id: 'sample-completed-nowhere-1',
    shipName: 'Wonder of the Seas',
    sailDate: formatDate(pastDate),
    returnDate: formatDate(getReturnDate(pastDate, 7)),
    departurePort: 'Port Canaveral, FL',
    destination: 'Perfect Day at CocoCay & Nassau',
    nights: 7,
    status: 'completed',
    completionState: 'completed',
    cabinType: 'Balcony',
    cabinCategory: 'Balcony',
    cabinNumber: '10234',
    reservationNumber: 'SAMPLE001',
    bookingId: 'BK-SAMPLE-001',
    guests: 2,
    guestsInfo: '2 Adults',
    price: 0,
    pricePaid: 0,
    totalPrice: 498,
    taxes: 498,
    freePlay: 200,
    freeOBC: 100,
    earnedPoints: 1250,
    casinoPoints: 1250,
    winnings: 450,
    itineraryName: 'Completed Cruise to NOWHERE - 7 Night Caribbean',
    notes: 'This is a sample completed cruise for demonstration purposes. Delete this cruise and import your real data!',
    itinerary: [
      { day: 1, port: 'Port Canaveral, FL', departure: '4:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 2, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 3, port: 'Perfect Day at CocoCay', arrival: '7:00 AM', departure: '5:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 4, port: 'Nassau, Bahamas', arrival: '8:00 AM', departure: '5:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 5, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 6, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 7, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 8, port: 'Port Canaveral, FL', arrival: '6:00 AM', isSeaDay: false, casinoOpen: false },
    ],
    seaDays: 4,
    portDays: 3,
    casinoOpenDays: 4,
    cruiseSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const upcomingCruise1: BookedCruise = {
    id: 'sample-booked-nowhere-1',
    shipName: 'Allure of the Seas',
    sailDate: formatDate(futureDate1),
    returnDate: formatDate(getReturnDate(futureDate1, 5)),
    departurePort: 'Galveston, TX',
    destination: 'Western Caribbean',
    nights: 5,
    status: 'booked',
    completionState: 'upcoming',
    cabinType: 'Oceanview',
    cabinCategory: 'Oceanview',
    reservationNumber: 'SAMPLE002',
    bookingId: 'BK-SAMPLE-002',
    guests: 2,
    guestsInfo: '2 Adults',
    price: 0,
    pricePaid: 0,
    totalPrice: 385,
    taxes: 385,
    freePlay: 150,
    freeOBC: 50,
    itineraryName: 'Cruise to NOWHERE - 5 Night Western Caribbean',
    notes: 'This is a sample booked cruise for demonstration purposes. Delete this cruise and import your real data!',
    itinerary: [
      { day: 1, port: 'Galveston, TX', departure: '4:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 2, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 3, port: 'Cozumel, Mexico', arrival: '8:00 AM', departure: '6:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 4, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 5, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 6, port: 'Galveston, TX', arrival: '6:00 AM', isSeaDay: false, casinoOpen: false },
    ],
    seaDays: 3,
    portDays: 2,
    casinoOpenDays: 3,
    cruiseSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const upcomingCruise2: BookedCruise = {
    id: 'sample-booked-nowhere-2',
    shipName: 'Harmony of the Seas',
    sailDate: formatDate(futureDate2),
    returnDate: formatDate(getReturnDate(futureDate2, 8)),
    departurePort: 'Fort Lauderdale, FL',
    destination: 'Eastern Caribbean',
    nights: 8,
    status: 'booked',
    completionState: 'upcoming',
    cabinType: 'Interior',
    cabinCategory: 'Interior',
    reservationNumber: 'SAMPLE003',
    bookingId: 'BK-SAMPLE-003',
    guests: 2,
    guestsInfo: '2 Adults',
    price: 0,
    pricePaid: 0,
    totalPrice: 612,
    taxes: 612,
    freePlay: 250,
    freeOBC: 150,
    itineraryName: 'Cruise to NOWHERE - 8 Night Eastern Caribbean',
    notes: 'This is a sample booked cruise for demonstration purposes. Delete this cruise and import your real data!',
    itinerary: [
      { day: 1, port: 'Fort Lauderdale, FL', departure: '4:30 PM', isSeaDay: false, casinoOpen: false },
      { day: 2, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 3, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 4, port: 'St. Thomas, USVI', arrival: '8:00 AM', departure: '5:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 5, port: 'St. Maarten', arrival: '8:00 AM', departure: '5:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 6, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 7, port: 'Perfect Day at CocoCay', arrival: '7:00 AM', departure: '5:00 PM', isSeaDay: false, casinoOpen: false },
      { day: 8, port: 'At Sea', isSeaDay: true, casinoOpen: true },
      { day: 9, port: 'Fort Lauderdale, FL', arrival: '6:00 AM', isSeaDay: false, casinoOpen: false },
    ],
    seaDays: 4,
    portDays: 4,
    casinoOpenDays: 4,
    cruiseSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleOfferDate = new Date(today);
  sampleOfferDate.setMonth(sampleOfferDate.getMonth() + 3);
  const offerExpiry = new Date(today);
  offerExpiry.setMonth(offerExpiry.getMonth() + 1);

  const sampleOffer1: CasinoOffer = {
    id: 'sample-offer-nowhere-1',
    offerCode: 'SAMPLE2P',
    offerName: 'Sample 2-Person Comped Offer',
    offerType: '2person',
    classification: '2person',
    title: 'Cruise to NOWHERE - Sample 2-Person Comped',
    description: 'This is a sample casino offer for demonstration. Import your real offers from Club Royale!',
    shipName: 'Symphony of the Seas',
    sailingDate: formatDate(sampleOfferDate),
    itineraryName: 'Sample Cruise to NOWHERE - 7 Night',
    nights: 7,
    roomType: 'Balcony',
    guests: 2,
    guestsInfo: '2 Guests',
    interiorPrice: 0,
    oceanviewPrice: 0,
    balconyPrice: 0,
    suitePrice: 0,
    taxesFees: 498,
    freePlay: 200,
    freeplayAmount: 200,
    OBC: 100,
    obcAmount: 100,
    retailCabinValue: 2800,
    totalValue: 3598,
    expires: formatDate(offerExpiry),
    expiryDate: formatDate(offerExpiry),
    status: 'active',
    offerSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleOffer2: CasinoOffer = {
    id: 'sample-offer-nowhere-2',
    offerCode: 'SAMPLEFP',
    offerName: 'Sample Freeplay Offer',
    offerType: 'freeplay',
    title: 'Cruise to NOWHERE - Sample Freeplay Only',
    description: 'This is a sample freeplay offer for demonstration. Import your real offers!',
    shipName: 'Oasis of the Seas',
    sailingDate: formatDate(sampleOfferDate),
    itineraryName: 'Sample Cruise to NOWHERE - 5 Night',
    nights: 5,
    roomType: 'Interior',
    guests: 2,
    guestsInfo: '2 Guests',
    interiorPrice: 799,
    oceanviewPrice: 999,
    balconyPrice: 1299,
    taxesFees: 385,
    freePlay: 500,
    freeplayAmount: 500,
    OBC: 0,
    obcAmount: 0,
    totalValue: 500,
    expires: formatDate(offerExpiry),
    expiryDate: formatDate(offerExpiry),
    status: 'active',
    offerSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const eventStartDate = new Date(futureDate1);
  const eventEndDate = getReturnDate(futureDate1, 5);

  const sampleEvent: CalendarEvent = {
    id: 'sample-event-nowhere-1',
    title: 'Sample Cruise to NOWHERE',
    startDate: eventStartDate.toISOString(),
    endDate: eventEndDate.toISOString(),
    start: eventStartDate.toISOString(),
    end: eventEndDate.toISOString(),
    type: 'cruise',
    sourceType: 'cruise',
    location: 'Galveston, TX',
    description: 'Sample cruise event - 5 Night Western Caribbean on Allure of the Seas',
    cruiseId: 'sample-booked-nowhere-1',
    color: '#001F3F',
    allDay: true,
    source: 'manual',
  };

  console.log('[SampleData] Generated sample data:', {
    bookedCruises: 3,
    casinoOffers: 2,
    calendarEvents: 1,
  });

  return {
    bookedCruises: [completedCruise, upcomingCruise1, upcomingCruise2],
    casinoOffers: [sampleOffer1, sampleOffer2],
    calendarEvents: [sampleEvent],
  };
}

export const SAMPLE_LOYALTY_POINTS = {
  clubRoyale: 1,
  crownAnchor: 1,
};
