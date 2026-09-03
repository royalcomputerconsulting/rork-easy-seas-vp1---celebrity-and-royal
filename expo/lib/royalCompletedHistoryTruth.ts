import type { BookedCruise } from '@/types/models';

function addDays(dateString: string, nights: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + nights);
  return date.toISOString().slice(0, 10);
}

const rawRoyalCompletedHistory = [
  ['2003-04-10','Monarch of the Seas',4,1,'6457271','9000','4','4 Night Western Caribbean Cruise'],
  ['2004-09-17','Majesty of the Seas',3,1,'686240','5524','5','3 Night Bahamas Cruise'],
  ['2009-09-20','Mariner of the Seas',7,1,'1037767','9292','9','7 Night Mexican Riviera Cruise'],
  ['2009-09-27','Mariner of the Seas',7,1,'3567045','2346','2','7 Night Mexican Riviera Cruise'],
  ['2009-11-02','Radiance of the Seas',5,1,'2075947','8011','8','5 Night Mexican Riviera Cruise'],
  ['2010-01-31','Mariner of the Seas',7,2,'441826','6523','6','7 Night Mexican Riviera Cruise'],
  ['2010-03-12','Radiance of the Seas',10,1,'4029771','4000','4','10 Night Mexican Riviera Cruise'],
  ['2010-06-27','Mariner of the Seas',7,2,'8798723','9248','9','7 Night Mexican Riviera Cruise'],
  ['2010-09-24','Radiance of the Seas',15,2,'1589504','8517','8','15 Night Eastbound Panama Canal Cruise'],
  ['2010-12-06','Radiance of the Seas',5,2,'1803949','9625','9','5 Night Western Caribbean Cruise'],
  ['2011-02-26','Serenade of the Seas',7,7,'5663388','9017','9','7 Night Southern Caribbean Cruise'],
  ['2012-02-12','Mariner of the Seas',7,7,'4229771','9517','9','7 Night Western Caribbean Cruise'],
  ['2013-02-25','Majesty of the Seas',4,4,'2858297','3000','3','4 Night Bahamas Cruise'],
  ['2014-12-13','Oasis of the Seas',7,7,'2674910','10293','10','7 Night Eastern Caribbean Cruise'],
  ['2017-08-12','Independence of the Seas',8,8,'6368133','6652','6','8 Night France and Spain Cruise'],
  ['2019-05-02','Ovation of the Seas',11,22,'5437247','6690','6','11 Night Hawaii Cruise'],
  ['2019-08-25','Oasis of the Seas',7,7,'1274172','6147','6','7 Night Atlantis Events Charter'],
  ['2021-09-05','Independence of the Seas',7,28,'1727064','8578','8','7 Night Western Caribbean Cruise'],
  ['2021-09-12','Independence of the Seas',7,28,'1728894','9604','9','7 Night Western Caribbean Cruise'],
  ['2021-10-01','Ovation of the Seas',7,28,'2290792','7632','7','7 Night Alaska Glacier Cruise'],
  ['2021-12-05','Liberty of the Seas',7,14,'6251642','1876','1','7 Night Western Caribbean Cruise'],
  ['2021-12-13','Navigator of the Seas',3,6,'3454592','1122','1','3 Night Ensenada Cruise'],
  ['2021-12-16','Navigator of the Seas',4,8,'3463765','1248','1','4 Night Catalina & Ensenada Cruise'],
  ['2022-06-17','Ovation of the Seas',7,14,'2734972','7708','7','7 Night Alaska Glacier Cruise'],
  ['2022-10-16','Voyager of the Seas',7,14,'8701910','1820','1','7 Night Canada Cruise'],
  ['2023-12-01','Explorer of the Seas',7,7,'9332615','3542','3','7 Night Western Caribbean Cruise'],
  ['2023-12-08','Explorer of the Seas',7,7,'9530101','2332','2','7 Night Eastern Caribbean & Perfect Day'],
  ['2024-01-22','Freedom of the Seas',4,4,'3473021','6540','6','4 Night Bahamas & Perfect Day Cruise'],
  ['2025-03-09','Wonder of the Seas',7,14,'7871133','9711','9','7 Night Western Caribbean & Perfect Day'],
  ['2025-04-20','Harmony of the Seas',7,14,'2501764','12729','12','7 Night Western Caribbean Cruise'],
  ['2025-07-29','Ovation of the Seas',3,6,'236930','10556','10','3 Night Ensenada Cruise'],
  ['2025-08-01','Navigator of the Seas',3,6,'6242276','9234','9','3 Night Ensenada Cruise'],
  ['2025-08-22','Navigator of the Seas',3,3,'1869130','2240','2','3 Night Ensenada Cruise'],
  ['2025-08-27','Star of the Seas',4,8,'2665774','10187','10','4N Star Showcase Cruise to Perfect Day'],
  ['2025-09-08','Navigator of the Seas',4,8,'3156149','9639','9','4 Night Catalina & Ensenada Cruise'],
  ['2025-09-15','Navigator of the Seas',4,8,'5207254','8511','8','4 Night Catalina & Ensenada Cruise'],
  ['2025-09-26','Radiance of the Seas',8,16,'7836829','3002','3','8 Night Pacific Coastal Cruise'],
  ['2025-10-16','Liberty of the Seas',9,18,'2755395','7389','7','9 Night Canada & New England Cruise'],
  ['2025-11-10','Quantum of the Seas',4,8,'4372586','8684','8','4 Night Ensenada Cruise'],
  ['2025-11-17','Quantum of the Seas',4,8,'29779','10122','10','4 Night Ensenada Cruise'],
  ['2025-12-01','Quantum of the Seas',4,8,'524978','7520','7','4 Night Ensenada Cruise'],
  ['2025-12-05','Quantum of the Seas',5,5,'8234195','7516','7','5 Night Cabo Overnight Cruise'],
  ['2025-12-10','Quantum of the Seas',5,10,'9759267','13206','13','5 Night Cabo & Ensenada Cruise'],
  ['2026-01-07','Quantum of the Seas',6,12,'4623588','9539','9','6 Night Cabo Overnight and Ensenada'],
  ['2026-01-13','Quantum of the Seas',3,6,'103650','13654','13','3 Night Ensenada Cruise'],
  ['2026-01-16','Quantum of the Seas',5,10,'4622209','6612','6','5 Night Cabo Overnight Cruise'],
  ['2026-02-22','Harmony of the Seas',7,14,'1627512','8604','8','7 Night Western Caribbean Cruise'],
  ['2026-03-01','Harmony of the Seas',7,7,'1332345','8572','8','7 Night Western Caribbean Cruise'],
  ['2026-03-09','Navigator of the Seas',7,14,'9351090','1270','1','7 Nt Cabo, Vallarta & Mazatlan Cruise'],
  ['2026-03-16','Navigator of the Seas',4,8,'1527742','7202','7','4 Night Catalina & Ensenada Cruise'],
  ['2026-04-07','Quantum of the Seas',3,6,'182213','10134','10','3 Night Ensenada Cruise'],
  ['2026-04-10','Quantum of the Seas',5,10,'9449386','11138','11','5 Night Cabo Overnight Cruise'],
  ['2026-04-15','Quantum of the Seas',6,12,'4913547','11540','11','6 Night Cabo Overnight and Ensenada'],
  ['2026-04-21','Quantum of the Seas',3,6,'1527694','8682','8','3 Night Ensenada Cruise'],
  ['2026-05-09','Icon of the Seas',7,14,'8223021','8102','8','7 Night Western Caribbean & Perfect Day'],
  ['2026-05-10','Symphony of the Seas',7,0,'871437','','','7 Night Western Caribbean Cruise'],
  ['2026-05-17','Symphony of the Seas',7,0,'3820089','','','7 Night Western Caribbean Cruise'],
] as const;

export const ROYAL_COMPLETED_HISTORY_TRUTH_COUNT = rawRoyalCompletedHistory.length;

function historyKey(cruise: Pick<BookedCruise, 'bookingId' | 'reservationNumber' | 'shipName' | 'sailDate'>): string {
  const booking = String(cruise.bookingId || cruise.reservationNumber || '').trim().toLowerCase();
  if (booking) return `booking:${booking}`;
  return `${String(cruise.shipName || '').trim().toLowerCase()}|${String(cruise.sailDate || '').slice(0, 10)}`;
}

export function createRoyalCompletedHistoryTruth(ownerProfileId?: string): BookedCruise[] {
  return rawRoyalCompletedHistory.map(([sailDate, shipName, nights, points, reservation, cabin, deck, itinerary]) => ({
    id: `royal-history-${reservation || String(shipName).toLowerCase().replace(/\W+/g, '-')}-${sailDate}`,
    shipName,
    sailDate,
    returnDate: addDays(sailDate, nights),
    departurePort: '',
    destination: itinerary,
    itineraryName: itinerary,
    itineraryRaw: [itinerary],
    nights,
    cabinType: '',
    cabinNumber: cabin || undefined,
    stateroomNumber: cabin || undefined,
    deckNumber: deck || undefined,
    bookingId: reservation,
    reservationNumber: reservation,
    status: 'completed',
    completionState: 'completed',
    bookingStatus: 'Completed',
    cruiseSource: 'royal',
    brand: 'Royal Caribbean',
    casinoProgram: 'club_royale',
    ownerProfileId,
    earnedPoints: points,
    casinoPoints: points,
    notes: sailDate === '2026-05-10' && shipName === 'Symphony of the Seas'
      ? 'Royal history shows this as a 0-point past sailing; user notes it was replaced by Icon of the Seas on 2026-05-09. Kept visible for Royal Past(57) reconciliation, excluded from Pinnacle math if needed.'
      : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as BookedCruise));
}

export function mergeRoyalCompletedHistoryTruth(cruises: BookedCruise[], ownerProfileId?: string): { cruises: BookedCruise[]; added: number; before: number; after: number } {
  const existingRoyalCompleted = cruises.filter((cruise) => {
    const source = String(cruise.cruiseSource || cruise.brand || '').toLowerCase();
    const status = `${cruise.status || ''} ${cruise.completionState || ''} ${cruise.bookingStatus || ''}`.toLowerCase();
    return source.includes('royal') && (status.includes('completed') || status.includes('past') || status.includes('history'));
  });

  const before = existingRoyalCompleted.length;
  if (before >= ROYAL_COMPLETED_HISTORY_TRUTH_COUNT) {
    return { cruises, added: 0, before, after: before };
  }

  const keys = new Set(cruises.map(historyKey));
  const additions = createRoyalCompletedHistoryTruth(ownerProfileId).filter((cruise) => !keys.has(historyKey(cruise)));
  return {
    cruises: [...cruises, ...additions],
    added: additions.length,
    before,
    after: before + additions.length,
  };
}
