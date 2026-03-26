export interface NextCruiseCertificateInfo {
  cruiseNights: number;
  depositValue: number;
  expirationMonths: number;
  description: string;
}

export const NCC_VALUES_BY_CRUISE_LENGTH: Record<string, NextCruiseCertificateInfo> = {
  '2-5': {
    cruiseNights: 5,
    depositValue: 50,
    expirationMonths: 12,
    description: '2-5 Night Cruise NCC',
  },
  '6-9': {
    cruiseNights: 7,
    depositValue: 100,
    expirationMonths: 12,
    description: '6-9 Night Cruise NCC',
  },
  '10+': {
    cruiseNights: 10,
    depositValue: 200,
    expirationMonths: 12,
    description: '10+ Night Cruise NCC',
  },
};

export function calculateNCCValue(cruiseNights: number): number {
  if (cruiseNights >= 10) {
    return NCC_VALUES_BY_CRUISE_LENGTH['10+'].depositValue;
  } else if (cruiseNights >= 6) {
    return NCC_VALUES_BY_CRUISE_LENGTH['6-9'].depositValue;
  } else if (cruiseNights >= 2) {
    return NCC_VALUES_BY_CRUISE_LENGTH['2-5'].depositValue;
  }
  return 0;
}

export function getNCCCategory(cruiseNights: number): string {
  if (cruiseNights >= 10) return '10+';
  if (cruiseNights >= 6) return '6-9';
  if (cruiseNights >= 2) return '2-5';
  return 'none';
}

export function getNCCInfo(cruiseNights: number): NextCruiseCertificateInfo | null {
  const category = getNCCCategory(cruiseNights);
  if (category === 'none') return null;
  return NCC_VALUES_BY_CRUISE_LENGTH[category];
}

export const RESERVATION_NUMBERS_USING_NCC = [
  '2665774',
  '9759267',
  '8023576',
  '5455777',
  '103650',
  '102141',
  '1332345',
  '1627512',
  '524978',
  '6458636',
  '8234195',
  '8153668',
  '1527742',
  '1527694',
  '4658678',
  '4623588',
  '7563285',
];

export function usedNextCruiseCertificate(reservationNumber?: string): boolean {
  if (!reservationNumber) return false;
  return RESERVATION_NUMBERS_USING_NCC.includes(reservationNumber);
}
