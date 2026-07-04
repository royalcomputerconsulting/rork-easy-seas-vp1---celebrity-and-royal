import type { ItineraryDay } from '@/types/models';
import type { SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';

/** Route params used to open the detailed marine forecast screen for a specific cruise day. */
export interface MarineForecastDetailParams {
  cruiseId: string;
  dateKey: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  departurePort: string;
  destination: string;
  itineraryName: string;
  nights: string;
  itinerary: string;
  [key: string]: string;
}

/** Serializes a cruise + target day into router params for the marine forecast detail screen. */
export function buildMarineForecastDetailParams(
  cruise: SailingWeatherCruiseInput,
  dateKey: string,
): MarineForecastDetailParams {
  return {
    cruiseId: cruise.id,
    dateKey,
    shipName: cruise.shipName ?? '',
    sailDate: cruise.sailDate ?? '',
    returnDate: cruise.returnDate ?? '',
    departurePort: cruise.departurePort ?? '',
    destination: cruise.destination ?? '',
    itineraryName: cruise.itineraryName ?? '',
    nights: String(cruise.nights ?? 0),
    itinerary: cruise.itinerary ? JSON.stringify(cruise.itinerary) : '',
  };
}

/** Parses marine forecast detail route params back into a cruise input for forecast lookup. */
export function parseMarineForecastDetailParams(params: Partial<Record<string, string>>): SailingWeatherCruiseInput | null {
  const cruiseId = params.cruiseId;
  const shipName = params.shipName;
  const sailDate = params.sailDate;
  const returnDate = params.returnDate;

  if (!cruiseId || !shipName || !sailDate || !returnDate) {
    return null;
  }

  let itinerary: ItineraryDay[] | undefined;
  if (params.itinerary) {
    try {
      const parsed = JSON.parse(params.itinerary);
      if (Array.isArray(parsed)) {
        itinerary = parsed as ItineraryDay[];
      }
    } catch {
      itinerary = undefined;
    }
  }

  return {
    id: cruiseId,
    shipName,
    sailDate,
    returnDate,
    departurePort: params.departurePort || undefined,
    destination: params.destination || undefined,
    itineraryName: params.itineraryName || undefined,
    nights: Number(params.nights ?? 0) || 0,
    itinerary,
  };
}
