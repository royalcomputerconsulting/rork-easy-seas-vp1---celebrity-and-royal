export interface TimeZoneEntry {
  label: string;
  value: string;
  offset: number;
  city: string;
  region: string;
}

export const TIMEZONE_LIST: TimeZoneEntry[] = [
  { label: 'Eastern (New York)', value: 'America/New_York', offset: -5, city: 'New York', region: 'US' },
  { label: 'Central (Chicago)', value: 'America/Chicago', offset: -6, city: 'Chicago', region: 'US' },
  { label: 'Mountain (Denver)', value: 'America/Denver', offset: -7, city: 'Denver', region: 'US' },
  { label: 'Pacific (Los Angeles)', value: 'America/Los_Angeles', offset: -8, city: 'Los Angeles', region: 'US' },
  { label: 'Alaska (Anchorage)', value: 'America/Anchorage', offset: -9, city: 'Anchorage', region: 'US' },
  { label: 'Hawaii (Honolulu)', value: 'America/Honolulu', offset: -10, city: 'Honolulu', region: 'US' },
  { label: 'Atlantic (Halifax)', value: 'America/Halifax', offset: -4, city: 'Halifax', region: 'Canada' },
  { label: 'Newfoundland', value: 'America/St_Johns', offset: -3.5, city: 'St. Johns', region: 'Canada' },
  { label: 'London (GMT/BST)', value: 'Europe/London', offset: 0, city: 'London', region: 'Europe' },
  { label: 'Paris (CET)', value: 'Europe/Paris', offset: 1, city: 'Paris', region: 'Europe' },
  { label: 'Rome (CET)', value: 'Europe/Rome', offset: 1, city: 'Rome', region: 'Europe' },
  { label: 'Athens (EET)', value: 'Europe/Athens', offset: 2, city: 'Athens', region: 'Europe' },
  { label: 'Istanbul', value: 'Europe/Istanbul', offset: 3, city: 'Istanbul', region: 'Europe' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai', offset: 4, city: 'Dubai', region: 'Middle East' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo', offset: 9, city: 'Tokyo', region: 'Asia' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney', offset: 10, city: 'Sydney', region: 'Oceania' },
  { label: 'Mexico City', value: 'America/Mexico_City', offset: -6, city: 'Mexico City', region: 'Caribbean' },
  { label: 'Cozumel', value: 'America/Cancun', offset: -5, city: 'Cozumel', region: 'Caribbean' },
  { label: 'Nassau (Bahamas)', value: 'America/Nassau', offset: -5, city: 'Nassau', region: 'Caribbean' },
  { label: 'San Juan (Puerto Rico)', value: 'America/Puerto_Rico', offset: -4, city: 'San Juan', region: 'Caribbean' },
  { label: 'St. Thomas (USVI)', value: 'America/Virgin', offset: -4, city: 'St. Thomas', region: 'Caribbean' },
  { label: 'Bermuda', value: 'Atlantic/Bermuda', offset: -4, city: 'Bermuda', region: 'Caribbean' },
  { label: 'Jamaica (Kingston)', value: 'America/Jamaica', offset: -5, city: 'Kingston', region: 'Caribbean' },
  { label: 'Aruba', value: 'America/Aruba', offset: -4, city: 'Aruba', region: 'Caribbean' },
  { label: 'Barbados', value: 'America/Barbados', offset: -4, city: 'Barbados', region: 'Caribbean' },
  { label: 'Juneau (Alaska)', value: 'America/Juneau', offset: -9, city: 'Juneau', region: 'Alaska' },
  { label: 'Vancouver', value: 'America/Vancouver', offset: -8, city: 'Vancouver', region: 'Canada' },
  { label: 'Buenos Aires', value: 'America/Argentina/Buenos_Aires', offset: -3, city: 'Buenos Aires', region: 'South America' },
  { label: 'São Paulo', value: 'America/Sao_Paulo', offset: -3, city: 'São Paulo', region: 'South America' },
  { label: 'Reykjavik (Iceland)', value: 'Atlantic/Reykjavik', offset: 0, city: 'Reykjavik', region: 'Europe' },
  { label: 'Barcelona', value: 'Europe/Madrid', offset: 1, city: 'Barcelona', region: 'Europe' },
  { label: 'Amsterdam', value: 'Europe/Amsterdam', offset: 1, city: 'Amsterdam', region: 'Europe' },
  { label: 'Copenhagen', value: 'Europe/Copenhagen', offset: 1, city: 'Copenhagen', region: 'Europe' },
  { label: 'Stockholm', value: 'Europe/Stockholm', offset: 1, city: 'Stockholm', region: 'Europe' },
  { label: 'Oslo', value: 'Europe/Oslo', offset: 1, city: 'Oslo', region: 'Europe' },
];
