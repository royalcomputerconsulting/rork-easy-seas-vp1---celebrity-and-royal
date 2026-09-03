export type WeatherPositionKind = 'historical' | 'today-expected' | 'planned';

export interface WeatherPositionPresentation {
  kind: WeatherPositionKind;
  label: string;
  coordinatesLabel: string;
  disclaimer: string;
  mapUrl: string;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildWeatherPositionPresentation(
  dateKey: string,
  latitude: number,
  longitude: number,
  zoneLabel: string,
  todayKey = localDateKey(new Date()),
): WeatherPositionPresentation {
  const kind: WeatherPositionKind = dateKey < todayKey
    ? 'historical'
    : dateKey === todayKey
      ? 'today-expected'
      : 'planned';
  const label = kind === 'historical'
    ? 'Historical itinerary position'
    : kind === 'today-expected'
      ? "Today's expected itinerary position"
      : 'Planned itinerary position';
  const coordinatesLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  const query = encodeURIComponent(`${zoneLabel} · ${label}`);

  return {
    kind,
    label,
    coordinatesLabel,
    disclaimer: 'Itinerary/weather lookup point — not live AIS ship tracking.',
    mapUrl: `https://maps.apple.com/?ll=${latitude},${longitude}&q=${query}`,
  };
}
