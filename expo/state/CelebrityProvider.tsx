import { useState, useCallback } from "react";
import createContextHook from "@nkzw/create-context-hook";

interface CelebrityShip {
  id: string;
  name: string;
  class: string;
  capacity: number;
  tonnage: number;
  yearBuilt: number;
  imageUrl?: string;
}

interface CelebrityDestination {
  id: string;
  name: string;
  region: string;
  ports: string[];
  seasonStart?: string;
  seasonEnd?: string;
}

interface CelebrityState {
  ships: CelebrityShip[];
  destinations: CelebrityDestination[];
  isLoading: boolean;
  
  getShipByName: (name: string) => CelebrityShip | undefined;
  getDestinationsByRegion: (region: string) => CelebrityDestination[];
  getShipClasses: () => string[];
}

const CELEBRITY_SHIPS: CelebrityShip[] = [
  { id: 'beyond', name: 'Celebrity Beyond', class: 'Edge', capacity: 3260, tonnage: 140600, yearBuilt: 2022 },
  { id: 'apex', name: 'Celebrity Apex', class: 'Edge', capacity: 2910, tonnage: 129500, yearBuilt: 2020 },
  { id: 'edge', name: 'Celebrity Edge', class: 'Edge', capacity: 2918, tonnage: 129500, yearBuilt: 2018 },
  { id: 'ascent', name: 'Celebrity Ascent', class: 'Edge', capacity: 3260, tonnage: 140600, yearBuilt: 2023 },
  { id: 'reflection', name: 'Celebrity Reflection', class: 'Solstice', capacity: 3046, tonnage: 126000, yearBuilt: 2012 },
  { id: 'silhouette', name: 'Celebrity Silhouette', class: 'Solstice', capacity: 2886, tonnage: 122000, yearBuilt: 2011 },
  { id: 'eclipse', name: 'Celebrity Eclipse', class: 'Solstice', capacity: 2850, tonnage: 122000, yearBuilt: 2010 },
  { id: 'equinox', name: 'Celebrity Equinox', class: 'Solstice', capacity: 2850, tonnage: 122000, yearBuilt: 2009 },
  { id: 'solstice', name: 'Celebrity Solstice', class: 'Solstice', capacity: 2850, tonnage: 122000, yearBuilt: 2008 },
  { id: 'constellation', name: 'Celebrity Constellation', class: 'Millennium', capacity: 2170, tonnage: 91000, yearBuilt: 2002 },
  { id: 'infinity', name: 'Celebrity Infinity', class: 'Millennium', capacity: 2170, tonnage: 91000, yearBuilt: 2001 },
  { id: 'summit', name: 'Celebrity Summit', class: 'Millennium', capacity: 2158, tonnage: 91000, yearBuilt: 2001 },
  { id: 'millennium', name: 'Celebrity Millennium', class: 'Millennium', capacity: 2158, tonnage: 91000, yearBuilt: 2000 },
  { id: 'xpedition', name: 'Celebrity Xpedition', class: 'Expedition', capacity: 100, tonnage: 2842, yearBuilt: 2001 },
  { id: 'flora', name: 'Celebrity Flora', class: 'Expedition', capacity: 100, tonnage: 5739, yearBuilt: 2019 },
];

const CELEBRITY_DESTINATIONS: CelebrityDestination[] = [
  { id: 'caribbean', name: 'Caribbean', region: 'Caribbean', ports: ['Miami', 'San Juan', 'Nassau', 'Cozumel', 'Grand Cayman'] },
  { id: 'alaska', name: 'Alaska', region: 'North America', ports: ['Seattle', 'Juneau', 'Ketchikan', 'Skagway', 'Victoria'] },
  { id: 'mediterranean', name: 'Mediterranean', region: 'Europe', ports: ['Barcelona', 'Rome', 'Naples', 'Athens', 'Santorini'] },
  { id: 'northern-europe', name: 'Northern Europe', region: 'Europe', ports: ['Copenhagen', 'Stockholm', 'Helsinki', 'St. Petersburg', 'Tallinn'] },
  { id: 'galapagos', name: 'Galapagos', region: 'South America', ports: ['Baltra', 'San Cristobal'] },
  { id: 'australia', name: 'Australia & New Zealand', region: 'Pacific', ports: ['Sydney', 'Melbourne', 'Auckland', 'Wellington'] },
  { id: 'asia', name: 'Asia', region: 'Asia', ports: ['Singapore', 'Hong Kong', 'Tokyo', 'Shanghai', 'Bangkok'] },
];

export const [CelebrityProvider, useCelebrity] = createContextHook((): CelebrityState => {
  const [ships] = useState<CelebrityShip[]>(CELEBRITY_SHIPS);
  const [destinations] = useState<CelebrityDestination[]>(CELEBRITY_DESTINATIONS);
  const [isLoading] = useState(false);

  const getShipByName = useCallback((name: string): CelebrityShip | undefined => {
    return ships.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  }, [ships]);

  const getDestinationsByRegion = useCallback((region: string): CelebrityDestination[] => {
    return destinations.filter(d => d.region.toLowerCase() === region.toLowerCase());
  }, [destinations]);

  const getShipClasses = useCallback((): string[] => {
    return [...new Set(ships.map(s => s.class))];
  }, [ships]);

  return {
    ships,
    destinations,
    isLoading,
    getShipByName,
    getDestinationsByRegion,
    getShipClasses,
  };
});
