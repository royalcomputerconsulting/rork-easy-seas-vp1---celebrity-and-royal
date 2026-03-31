export interface CruiseReceipt {
  ship: string;
  sailingDate: string;
  cabinCategory: string;
  cabinNumber: string;
  roomType: string;
  pricePaid: number;
  totalRetailCost: number;
  totalCasinoDiscount: number;
}

export const CRUISE_RECEIPTS: CruiseReceipt[] = [
  {
    ship: 'NAVIGATOR OF THE SEAS',
    sailingDate: '2025-08-22',
    cabinCategory: 'ZI',
    cabinNumber: 'GTY',
    roomType: 'Interior',
    pricePaid: 116.87,
    totalRetailCost: 572.87,
    totalCasinoDiscount: 456.00,
  },
  {
    ship: 'STAR OF THE SEAS',
    sailingDate: '2025-08-27',
    cabinCategory: 'IF',
    cabinNumber: '10187',
    roomType: 'Balcony',
    pricePaid: 277.12,
    totalRetailCost: 3120.12,
    totalCasinoDiscount: 2843.00,
  },
  {
    ship: 'RADIANCE OF THE SEAS',
    sailingDate: '2025-09-26',
    cabinCategory: '2V',
    cabinNumber: '3583',
    roomType: 'Interior',
    pricePaid: 296.42,
    totalRetailCost: 1558.42,
    totalCasinoDiscount: 1262.00,
  },
  {
    ship: 'GRANDEUR OF THE SEAS',
    sailingDate: '2025-09-27',
    cabinCategory: '4N',
    cabinNumber: '3528',
    roomType: 'Oceanview',
    pricePaid: 165.28,
    totalRetailCost: 2115.28,
    totalCasinoDiscount: 1950.00,
  },
  {
    ship: 'LIBERTY OF THE SEAS',
    sailingDate: '2025-10-16',
    cabinCategory: '4V',
    cabinNumber: 'GTY',
    roomType: 'Interior',
    pricePaid: 252.50,
    totalRetailCost: 3318.50,
    totalCasinoDiscount: 3066.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2025-10-22',
    cabinCategory: 'ZI',
    cabinNumber: 'GTY',
    roomType: 'Interior',
    pricePaid: 133.06,
    totalRetailCost: 1701.06,
    totalCasinoDiscount: 1568.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2025-11-10',
    cabinCategory: '4D',
    cabinNumber: '8684',
    roomType: 'Balcony',
    pricePaid: 138.24,
    totalRetailCost: 1174.24,
    totalCasinoDiscount: 1036.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2025-12-24',
    cabinCategory: '3M',
    cabinNumber: '9110',
    roomType: 'Oceanview',
    pricePaid: 145.53,
    totalRetailCost: 5169.53,
    totalCasinoDiscount: 5024.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2026-01-07',
    cabinCategory: '4D',
    cabinNumber: '11536',
    roomType: 'Balcony',
    pricePaid: 149.47,
    totalRetailCost: 1843.47,
    totalCasinoDiscount: 1694.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2026-01-13',
    cabinCategory: 'XB-GTY',
    cabinNumber: 'GTY',
    roomType: 'Balcony',
    pricePaid: 127.81,
    totalRetailCost: 867.81,
    totalCasinoDiscount: 740.00,
  },
  {
    ship: 'QUANTUM OF THE SEAS',
    sailingDate: '2026-01-16',
    cabinCategory: '4U',
    cabinNumber: '7119',
    roomType: 'Balcony',
    pricePaid: 129.95,
    totalRetailCost: 1319.95,
    totalCasinoDiscount: 1190.00,
  },
  {
    ship: 'ODYSSEY OF THE SEAS',
    sailingDate: '2026-01-26',
    cabinCategory: '2D',
    cabinNumber: '8554',
    roomType: 'Balcony',
    pricePaid: 237.36,
    totalRetailCost: 7499.36,
    totalCasinoDiscount: 7262.00,
  },
  {
    ship: 'SYMPHONY OF THE SEAS',
    sailingDate: '2026-02-22',
    cabinCategory: '4N',
    cabinNumber: '10106',
    roomType: 'Oceanview',
    pricePaid: 168.89,
    totalRetailCost: 2970.89,
    totalCasinoDiscount: 2802.00,
  },
  {
    ship: 'HARMONY OF THE SEAS',
    sailingDate: '2026-03-01',
    cabinCategory: '2D',
    cabinNumber: '8572',
    roomType: 'Balcony',
    pricePaid: 151.17,
    totalRetailCost: 3841.17,
    totalCasinoDiscount: 3690.00,
  },
  {
    ship: 'HARMONY OF THE SEAS',
    sailingDate: '2026-03-01',
    cabinCategory: '4V',
    cabinNumber: '8437',
    roomType: 'Interior',
    pricePaid: 151.17,
    totalRetailCost: 2619.17,
    totalCasinoDiscount: 2468.00,
  },
  {
    ship: 'HARMONY OF THE SEAS',
    sailingDate: '2026-03-16',
    cabinCategory: '4N',
    cabinNumber: '7126',
    roomType: 'Oceanview',
    pricePaid: 229.19,
    totalRetailCost: 4683.19,
    totalCasinoDiscount: 4454.00,
  },
  {
    ship: 'SERENADE OF THE SEAS',
    sailingDate: '2026-05-05',
    cabinCategory: 'XB',
    cabinNumber: 'GTY',
    roomType: 'Balcony',
    pricePaid: 225.20,
    totalRetailCost: 1737.20,
    totalCasinoDiscount: 1512.00,
  },
  {
    ship: 'ANTHEM OF THE SEAS',
    sailingDate: '2026-09-29',
    cabinCategory: '2N',
    cabinNumber: 'GTY',
    roomType: 'Oceanview',
    pricePaid: 131.92,
    totalRetailCost: 4357.92,
    totalCasinoDiscount: 0,
  },
];

export function normalizeShipName(shipName: string): string {
  return shipName
    .toUpperCase()
    .replace(/\s+OF\s+THE\s+SEAS/gi, ' OF THE SEAS')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findReceiptByShipAndDate(
  shipName: string,
  sailingDate: string
): CruiseReceipt | undefined {
  const normalizedSearchShip = normalizeShipName(shipName);
  const normalizedSearchDate = sailingDate;

  return CRUISE_RECEIPTS.find((receipt) => {
    const normalizedReceiptShip = normalizeShipName(receipt.ship);
    const receiptDate = receipt.sailingDate;

    const shipMatch = normalizedReceiptShip === normalizedSearchShip;
    const dateMatch = receiptDate === normalizedSearchDate;

    return shipMatch && dateMatch;
  });
}

export function getAllReceiptsForShip(shipName: string): CruiseReceipt[] {
  const normalizedSearchShip = normalizeShipName(shipName);
  
  return CRUISE_RECEIPTS.filter((receipt) => {
    const normalizedReceiptShip = normalizeShipName(receipt.ship);
    return normalizedReceiptShip === normalizedSearchShip;
  });
}
