import { USER_CONFIRMED_BOOKED_CRUISE_MANIFEST } from '@/constants/confirmedBookedCruises';
import type { BookedCruise } from '@/types/models';

export const BOOKED_CRUISES_DATA: BookedCruise[] = USER_CONFIRMED_BOOKED_CRUISE_MANIFEST;

export const getCabinValueByType = (cabinType: string): { basePrice: number; category: string } => {
  const type = cabinType.toLowerCase();
  
  if (type.includes('penthouse')) return { basePrice: 8000, category: 'Penthouse Suite' };
  if (type.includes('royal suite')) return { basePrice: 6000, category: 'Royal Suite' };
  if (type.includes('owner') && type.includes('2br')) return { basePrice: 5000, category: "Owner's Suite 2BR" };
  if (type.includes('grand') && type.includes('2br')) return { basePrice: 4500, category: 'Grand Suite 2BR' };
  if (type.includes('owner')) return { basePrice: 4000, category: "Owner's Suite" };
  if (type.includes('grand suite')) return { basePrice: 3500, category: 'Grand Suite' };
  if (type.includes('junior') || type.includes('jr')) return { basePrice: 2500, category: 'Junior Suite' };
  if (type.includes('suite gty')) return { basePrice: 2000, category: 'Suite GTY' };
  if (type.includes('balcony gty') || type.includes('gty')) return { basePrice: 1200, category: 'Balcony GTY' };
  if (type.includes('balcony')) return { basePrice: 1500, category: 'Balcony' };
  if (type.includes('ocean') && type.includes('gty')) return { basePrice: 900, category: 'Oceanview GTY' };
  if (type.includes('ocean')) return { basePrice: 1100, category: 'Oceanview' };
  if (type.includes('interior gty')) return { basePrice: 600, category: 'Interior GTY' };
  if (type.includes('interior')) return { basePrice: 800, category: 'Interior' };
  
  return { basePrice: 1000, category: 'Unknown' };
};

export const calculateCabinRetailValue = (cabinType: string, nights: number): number => {
  const { basePrice } = getCabinValueByType(cabinType);
  const perNightRate = basePrice / 7;
  return Math.round(perNightRate * nights * 2);
};
