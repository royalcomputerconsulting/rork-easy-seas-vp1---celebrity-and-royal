export interface FreeplayOBCRecord {
  offerCode: string;
  shipName: string;
  sailDate: string;
  freePlay: number;
  obc: number;
  nccLevel?: string;
}

export const FREEPLAY_OBC_DATA: FreeplayOBCRecord[] = [
  {
    offerCode: '25BAF1404',
    shipName: 'Quantum',
    sailDate: '2025-01-07',
    freePlay: 75,
    obc: 50,
  },
  {
    offerCode: '25LVA404',
    shipName: 'Quantum',
    sailDate: '2025-01-13',
    freePlay: 0,
    obc: 50,
  },
  {
    offerCode: '25RCL906',
    shipName: 'Quantum',
    sailDate: '2025-01-16',
    freePlay: 50,
    obc: 0,
  },
  {
    offerCode: '2510C03',
    shipName: 'Odyssey',
    sailDate: '2025-01-26',
    freePlay: 750,
    obc: 200,
    nccLevel: 'LEVEL 03',
  },
  {
    offerCode: '25LNG304',
    shipName: 'Symphony',
    sailDate: '2025-02-22',
    freePlay: 0,
    obc: 0,
  },
  {
    offerCode: '25NEW304',
    shipName: 'Harmony',
    sailDate: '2025-03-01',
    freePlay: 50,
    obc: 100,
  },
  {
    offerCode: '25VAR1104',
    shipName: 'Navigator',
    sailDate: '2025-03-09',
    freePlay: 0,
    obc: 0,
  },
  {
    offerCode: '2512A04',
    shipName: 'Allure',
    sailDate: '2025-03-29',
    freePlay: 250,
    obc: 100,
    nccLevel: 'LEVEL 04',
  },
  {
    offerCode: '25LVA503',
    shipName: 'Quantum',
    sailDate: '2025-04-10',
    freePlay: 0,
    obc: 0,
  },
  {
    offerCode: '25MIX403',
    shipName: 'Quantum',
    sailDate: '2025-04-15',
    freePlay: 0,
    obc: 0,
  },
  {
    offerCode: '25MIX304',
    shipName: 'Quantum',
    sailDate: '2025-04-21',
    freePlay: 75,
    obc: 0,
  },
  {
    offerCode: '2512A07',
    shipName: 'Allure',
    sailDate: '2025-04-29',
    freePlay: 150,
    obc: 150,
    nccLevel: 'LEVEL 07',
  },
  {
    offerCode: 'A05',
    shipName: 'Allure',
    sailDate: '2025-04-29',
    freePlay: 150,
    obc: 150,
    nccLevel: 'LEVEL 07',
  },
  {
    offerCode: '25WST303',
    shipName: 'Symphony',
    sailDate: '2025-05-10',
    freePlay: 0,
    obc: 0,
  },
  {
    offerCode: '25DEP104',
    shipName: 'Symphony',
    sailDate: '2025-05-17',
    freePlay: 0,
    obc: 200,
  },
  {
    offerCode: '25WCR704',
    shipName: 'Navigator',
    sailDate: '2025-05-29',
    freePlay: 0,
    obc: 50,
  },
  {
    offerCode: '2511A03A',
    shipName: 'Anthem',
    sailDate: '2025-09-29',
    freePlay: 500,
    obc: 50,
    nccLevel: 'LEVEL 03',
  },
];

export function findFreeplayOBCByOfferCode(offerCode: string): FreeplayOBCRecord | undefined {
  if (!offerCode) return undefined;
  const normalized = offerCode.toUpperCase().trim();
  return FREEPLAY_OBC_DATA.find(record => 
    normalized.includes(record.offerCode.toUpperCase()) ||
    record.offerCode.toUpperCase().includes(normalized)
  );
}

export function findFreeplayOBCByShipAndDate(shipName: string, sailDate: string): FreeplayOBCRecord | undefined {
  if (!shipName || !sailDate) return undefined;
  const normalizedShip = shipName.toLowerCase();
  return FREEPLAY_OBC_DATA.find(record => 
    normalizedShip.includes(record.shipName.toLowerCase()) &&
    record.sailDate === sailDate
  );
}
