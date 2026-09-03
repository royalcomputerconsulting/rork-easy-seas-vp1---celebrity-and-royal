import type { BookedCruise, CalendarEvent } from '@/types/models';
import type { SailingWeatherForecast } from '@/state/SailingWeatherProvider';

export type OfflinePackSectionKey='itinerary'|'weather'|'certificates'|'reservation'|'deckMap'|'host'|'calendar';
export interface OfflinePackSection{key:OfflinePackSectionKey;label:string;ready:boolean;count:number;expected:number;detail:string;missing:string[]}
export interface OfflineVoyagePackStatus{cruiseId:string;sections:OfflinePackSection[];readySections:number;totalSections:number;completionPercent:number;missingDays:string[];isComplete:boolean}
type Inputs={cruise:BookedCruise;forecasts:SailingWeatherForecast[];certificateCount:number;certificateDocumentCount:number;deckMappingCount:number;calendarEvents:CalendarEvent[]};
const dateRange=(start:string,end:string)=>{const result:string[]=[];let cursor=new Date(`${start}T12:00:00`),last=new Date(`${end}T12:00:00`);while(Number.isFinite(cursor.getTime())&&cursor<=last&&result.length<100){result.push(cursor.toISOString().slice(0,10));cursor=new Date(cursor.getTime()+86400000)}return result};
export function buildOfflineVoyagePackStatus(input:Inputs):OfflineVoyagePackStatus {
  const { cruise } = input;
  const days = dateRange(cruise.sailDate, cruise.returnDate);
  const canonicalByDate = new Map<string, NonNullable<BookedCruise['itinerary']>[number]>();
  (cruise.itinerary ?? []).forEach((day) => {
    const dateKey = day.date || (Number.isInteger(day.day) && day.day > 0 ? days[day.day - 1] : undefined);
    if (dateKey) canonicalByDate.set(dateKey, day);
  });
  const validForecasts = input.forecasts.filter((row) => row.cruiseId === cruise.id && !row.isStale);
  const forecastByDate = new Map(validForecasts.map((row) => [row.dateKey, row]));

  // A saved weather record contains the exact location used for that voyage day.
  // Count it as an offline route position when the provider itinerary itself did
  // not include coordinates; this prevents a truthful 6/6 weather cache from
  // incorrectly displaying 0/6 route positions.
  const hasPositionForDay = (dateKey: string): boolean => {
    const itineraryDay = canonicalByDate.get(dateKey);
    const explicitPosition = itineraryDay?.isSeaDay === true || (
      Number.isFinite(itineraryDay?.latitude) && Number.isFinite(itineraryDay?.longitude)
    );
    const weatherPosition = forecastByDate.get(dateKey);
    return explicitPosition || Boolean(
      weatherPosition && Number.isFinite(weatherPosition.latitude) && Number.isFinite(weatherPosition.longitude)
    );
  };

  const missingItinerary = days.filter((day) => !hasPositionForDay(day));
  const missingWeather = days.filter((day) => !forecastByDate.has(day));
  const linkedEvents = input.calendarEvents.filter((event) =>
    (event as CalendarEvent & { cruiseId?: string }).cruiseId === cruise.id
      || (event.startDate >= cruise.sailDate && event.startDate <= cruise.returnDate),
  );
  const reservationReady = Boolean(cruise.reservationNumber || cruise.bookingId || cruise.bwoNumber);
  const hostReady = Boolean(cruise.casinoHost && (cruise.casinoHostEmail || cruise.casinoHostPhone));
  const positionedDays = days.length - missingItinerary.length;
  const weatherDays = days.length - missingWeather.length;
  const sections: OfflinePackSection[] = [
    { key: 'itinerary', label: 'Itinerary and port coordinates', ready: days.length > 0 && missingItinerary.length === 0, count: positionedDays, expected: days.length, detail: `${positionedDays}/${days.length} voyage day positions saved from itinerary/weather route resolution`, missing: missingItinerary },
    { key: 'weather', label: 'Weather and marine forecasts', ready: days.length > 0 && missingWeather.length === 0, count: weatherDays, expected: days.length, detail: `${weatherDays}/${days.length} days cached`, missing: missingWeather },
    { key: 'certificates', label: 'Certificates and retained PDFs', ready: input.certificateCount > 0 && input.certificateDocumentCount > 0, count: input.certificateDocumentCount, expected: Math.max(1, input.certificateCount), detail: `${input.certificateCount} certificate records · ${input.certificateDocumentCount} retained documents`, missing: input.certificateDocumentCount ? [] : ['Retained certificate PDF'] },
    { key: 'reservation', label: 'Reservation information', ready: reservationReady, count: reservationReady ? 1 : 0, expected: 1, detail: reservationReady ? 'Confirmation saved locally' : 'Reservation number or booking ID missing', missing: reservationReady ? [] : ['Reservation identifier'] },
    { key: 'deckMap', label: 'Deck and machine map', ready: input.deckMappingCount > 0, count: input.deckMappingCount, expected: 1, detail: `${input.deckMappingCount} saved machine location${input.deckMappingCount === 1 ? '' : 's'} for this ship`, missing: input.deckMappingCount ? [] : ['Verified machine/deck mapping'] },
    { key: 'host', label: 'Casino host contact', ready: hostReady, count: hostReady ? 1 : 0, expected: 1, detail: hostReady ? 'Host and contact method saved' : 'Host name plus email or phone missing', missing: hostReady ? [] : ['Host contact method'] },
    { key: 'calendar', label: 'Voyage calendar details', ready: linkedEvents.length > 0, count: linkedEvents.length, expected: 1, detail: `${linkedEvents.length} linked voyage event${linkedEvents.length === 1 ? '' : 's'}`, missing: linkedEvents.length ? [] : ['Voyage calendar event'] },
  ];
  const readySections = sections.filter((section) => section.ready).length;
  return { cruiseId: cruise.id, sections, readySections, totalSections: sections.length, completionPercent: Math.round(readySections / sections.length * 100), missingDays: [...new Set([...missingItinerary, ...missingWeather])].sort(), isComplete: readySections === sections.length };
}
