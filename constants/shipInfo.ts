export interface ShipInfo {
  name: string;
  class: string;
  passengerCapacity: number;
  grossTonnage: number;
  yearBuilt: number;
  homePort: string;
  typicalItineraries: string[];
  imageUrl?: string;
}

export const ROYAL_CARIBBEAN_SHIPS: Record<string, ShipInfo> = {
  'Icon of the Seas': {
    name: 'Icon of the Seas',
    class: 'Icon Class',
    passengerCapacity: 5610,
    grossTonnage: 250800,
    yearBuilt: 2024,
    homePort: 'Miami',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Wonder of the Seas': {
    name: 'Wonder of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5734,
    grossTonnage: 236857,
    yearBuilt: 2022,
    homePort: 'Fort Lauderdale',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Symphony of the Seas': {
    name: 'Symphony of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5518,
    grossTonnage: 228081,
    yearBuilt: 2018,
    homePort: 'Miami',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Harmony of the Seas': {
    name: 'Harmony of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5479,
    grossTonnage: 226963,
    yearBuilt: 2016,
    homePort: 'Fort Lauderdale',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Allure of the Seas': {
    name: 'Allure of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5484,
    grossTonnage: 225282,
    yearBuilt: 2010,
    homePort: 'Fort Lauderdale',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Oasis of the Seas': {
    name: 'Oasis of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5400,
    grossTonnage: 225282,
    yearBuilt: 2009,
    homePort: 'Cape Liberty',
    typicalItineraries: ['Bahamas', 'Bermuda'],
  },
  'Utopia of the Seas': {
    name: 'Utopia of the Seas',
    class: 'Oasis Class',
    passengerCapacity: 5668,
    grossTonnage: 236860,
    yearBuilt: 2024,
    homePort: 'Port Canaveral',
    typicalItineraries: ['Bahamas', 'Perfect Day at CocoCay'],
  },
  'Odyssey of the Seas': {
    name: 'Odyssey of the Seas',
    class: 'Quantum Ultra Class',
    passengerCapacity: 4198,
    grossTonnage: 169379,
    yearBuilt: 2021,
    homePort: 'Fort Lauderdale',
    typicalItineraries: ['Southern Caribbean', 'ABC Islands'],
  },
  'Spectrum of the Seas': {
    name: 'Spectrum of the Seas',
    class: 'Quantum Ultra Class',
    passengerCapacity: 4246,
    grossTonnage: 169379,
    yearBuilt: 2019,
    homePort: 'Shanghai',
    typicalItineraries: ['Asia', 'Japan'],
  },
  'Quantum of the Seas': {
    name: 'Quantum of the Seas',
    class: 'Quantum Class',
    passengerCapacity: 4180,
    grossTonnage: 168666,
    yearBuilt: 2014,
    homePort: 'Singapore',
    typicalItineraries: ['Asia', 'Australia'],
  },
  'Anthem of the Seas': {
    name: 'Anthem of the Seas',
    class: 'Quantum Class',
    passengerCapacity: 4180,
    grossTonnage: 168666,
    yearBuilt: 2015,
    homePort: 'Southampton',
    typicalItineraries: ['Northern Europe', 'Mediterranean'],
  },
  'Ovation of the Seas': {
    name: 'Ovation of the Seas',
    class: 'Quantum Class',
    passengerCapacity: 4180,
    grossTonnage: 168666,
    yearBuilt: 2016,
    homePort: 'Seattle',
    typicalItineraries: ['Alaska', 'Pacific Northwest'],
  },
  'Navigator of the Seas': {
    name: 'Navigator of the Seas',
    class: 'Voyager Class',
    passengerCapacity: 3114,
    grossTonnage: 139999,
    yearBuilt: 2002,
    homePort: 'Los Angeles',
    typicalItineraries: ['Mexican Riviera', 'Baja'],
  },
  'Mariner of the Seas': {
    name: 'Mariner of the Seas',
    class: 'Voyager Class',
    passengerCapacity: 3114,
    grossTonnage: 139863,
    yearBuilt: 2003,
    homePort: 'Port Canaveral',
    typicalItineraries: ['Bahamas', 'Perfect Day at CocoCay'],
  },
  'Adventure of the Seas': {
    name: 'Adventure of the Seas',
    class: 'Voyager Class',
    passengerCapacity: 3114,
    grossTonnage: 138194,
    yearBuilt: 2001,
    homePort: 'Galveston',
    typicalItineraries: ['Western Caribbean', 'Gulf of Mexico'],
  },
  'Voyager of the Seas': {
    name: 'Voyager of the Seas',
    class: 'Voyager Class',
    passengerCapacity: 3114,
    grossTonnage: 138194,
    yearBuilt: 1999,
    homePort: 'Sydney',
    typicalItineraries: ['Australia', 'South Pacific'],
  },
  'Explorer of the Seas': {
    name: 'Explorer of the Seas',
    class: 'Voyager Class',
    passengerCapacity: 3114,
    grossTonnage: 138194,
    yearBuilt: 2000,
    homePort: 'San Juan',
    typicalItineraries: ['Southern Caribbean'],
  },
  'Freedom of the Seas': {
    name: 'Freedom of the Seas',
    class: 'Freedom Class',
    passengerCapacity: 3634,
    grossTonnage: 154407,
    yearBuilt: 2006,
    homePort: 'Port Canaveral',
    typicalItineraries: ['Bahamas', 'Western Caribbean'],
  },
  'Liberty of the Seas': {
    name: 'Liberty of the Seas',
    class: 'Freedom Class',
    passengerCapacity: 3634,
    grossTonnage: 154407,
    yearBuilt: 2007,
    homePort: 'Galveston',
    typicalItineraries: ['Western Caribbean', 'Mexico'],
  },
  'Independence of the Seas': {
    name: 'Independence of the Seas',
    class: 'Freedom Class',
    passengerCapacity: 3634,
    grossTonnage: 154407,
    yearBuilt: 2008,
    homePort: 'Fort Lauderdale',
    typicalItineraries: ['Eastern Caribbean', 'Western Caribbean'],
  },
  'Brilliance of the Seas': {
    name: 'Brilliance of the Seas',
    class: 'Radiance Class',
    passengerCapacity: 2112,
    grossTonnage: 90090,
    yearBuilt: 2002,
    homePort: 'Tampa',
    typicalItineraries: ['Western Caribbean', 'Cuba'],
  },
  'Radiance of the Seas': {
    name: 'Radiance of the Seas',
    class: 'Radiance Class',
    passengerCapacity: 2112,
    grossTonnage: 90090,
    yearBuilt: 2001,
    homePort: 'Vancouver',
    typicalItineraries: ['Alaska', 'Pacific Coast'],
  },
  'Serenade of the Seas': {
    name: 'Serenade of the Seas',
    class: 'Radiance Class',
    passengerCapacity: 2112,
    grossTonnage: 90090,
    yearBuilt: 2003,
    homePort: 'Seattle',
    typicalItineraries: ['Alaska'],
  },
  'Jewel of the Seas': {
    name: 'Jewel of the Seas',
    class: 'Radiance Class',
    passengerCapacity: 2112,
    grossTonnage: 90090,
    yearBuilt: 2004,
    homePort: 'Boston',
    typicalItineraries: ['Bermuda', 'Canada/New England'],
  },
  'Enchantment of the Seas': {
    name: 'Enchantment of the Seas',
    class: 'Vision Class',
    passengerCapacity: 2252,
    grossTonnage: 82910,
    yearBuilt: 1997,
    homePort: 'Baltimore',
    typicalItineraries: ['Bahamas', 'Bermuda'],
  },
  'Grandeur of the Seas': {
    name: 'Grandeur of the Seas',
    class: 'Vision Class',
    passengerCapacity: 1950,
    grossTonnage: 73817,
    yearBuilt: 1996,
    homePort: 'Baltimore',
    typicalItineraries: ['Bahamas', 'Bermuda', 'Canada'],
  },
  'Rhapsody of the Seas': {
    name: 'Rhapsody of the Seas',
    class: 'Vision Class',
    passengerCapacity: 2000,
    grossTonnage: 78491,
    yearBuilt: 1997,
    homePort: 'Tampa',
    typicalItineraries: ['Western Caribbean', 'Cuba'],
  },
  'Vision of the Seas': {
    name: 'Vision of the Seas',
    class: 'Vision Class',
    passengerCapacity: 2000,
    grossTonnage: 78340,
    yearBuilt: 1998,
    homePort: 'Barcelona',
    typicalItineraries: ['Mediterranean', 'Europe'],
  },
};

export const SHIP_CLASSES = [
  'Icon Class',
  'Oasis Class',
  'Quantum Ultra Class',
  'Quantum Class',
  'Freedom Class',
  'Voyager Class',
  'Radiance Class',
  'Vision Class',
];

export function getShipsByClass(className: string): ShipInfo[] {
  return Object.values(ROYAL_CARIBBEAN_SHIPS).filter(ship => ship.class === className);
}

export function getShipByName(name: string): ShipInfo | undefined {
  return ROYAL_CARIBBEAN_SHIPS[name];
}

export function getAllShipNames(): string[] {
  return Object.keys(ROYAL_CARIBBEAN_SHIPS);
}

export function getShipsByHomePort(port: string): ShipInfo[] {
  return Object.values(ROYAL_CARIBBEAN_SHIPS).filter(
    ship => ship.homePort.toLowerCase().includes(port.toLowerCase())
  );
}

export function isRoyalCaribbeanShip(shipName: string): boolean {
  const normalizedName = shipName.trim().toLowerCase();
  return Object.keys(ROYAL_CARIBBEAN_SHIPS).some(
    name => name.toLowerCase() === normalizedName
  );
}
