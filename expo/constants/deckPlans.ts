export interface DeckInfo {
  deckNumber: number;
  deckName: string;
  hasCasino: boolean;
  casinoZones?: CasinoZone[];
  amenities?: string[];
}

export interface CasinoZone {
  id: string;
  name: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  machineSlots?: MachineSlot[];
}

export interface MachineSlot {
  id: string;
  slotNumber: number;
  x: number;
  y: number;
  machineId?: string;
  notes?: string;
  lastUpdated?: string;
}

export interface ShipDeckPlan {
  shipName: string;
  shipClass: string;
  decks: DeckInfo[];
  lastUpdated: string;
}

export const OASIS_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Oasis Class',
  shipClass: 'Oasis Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 4,
      deckName: 'Royal Promenade',
      hasCasino: true,
      amenities: ['Casino Royale', 'Shopping', 'Bars', 'Entertainment'],
      casinoZones: [
        {
          id: 'oasis-casino-main',
          name: 'Main Casino Floor',
          description: 'Primary gaming area with slots and table games',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          machineSlots: Array.from({ length: 50 }, (_, i) => ({
            id: `oasis-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 10) * 10,
            y: Math.floor(i / 10) * 12,
          })),
        },
        {
          id: 'oasis-casino-vip',
          name: 'VIP Gaming Area',
          description: 'High limit slots and private gaming',
          x: 0,
          y: 65,
          width: 100,
          height: 35,
          machineSlots: Array.from({ length: 20 }, (_, i) => ({
            id: `oasis-vip-slot-${i + 1}`,
            slotNumber: i + 51,
            x: (i % 10) * 10,
            y: 65 + Math.floor(i / 10) * 17.5,
          })),
        },
      ],
    },
  ],
};

export const QUANTUM_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Quantum Class',
  shipClass: 'Quantum Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 4,
      deckName: 'Royal Esplanade',
      hasCasino: true,
      amenities: ['Casino', 'Two70', 'Music Hall'],
      casinoZones: [
        {
          id: 'quantum-casino-main',
          name: 'Main Casino',
          description: 'Central casino with slots and table games',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          machineSlots: Array.from({ length: 60 }, (_, i) => ({
            id: `quantum-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 10) * 10,
            y: Math.floor(i / 10) * 16.67,
          })),
        },
      ],
    },
  ],
};

export const VOYAGER_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Voyager Class',
  shipClass: 'Voyager Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 4,
      deckName: 'Royal Promenade',
      hasCasino: true,
      amenities: ['Casino Royale', 'Shops', 'Bars'],
      casinoZones: [
        {
          id: 'voyager-casino-main',
          name: 'Casino Royale',
          description: 'Main casino floor',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          machineSlots: Array.from({ length: 40 }, (_, i) => ({
            id: `voyager-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 8) * 12.5,
            y: Math.floor(i / 8) * 20,
          })),
        },
      ],
    },
  ],
};

export const FREEDOM_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Freedom Class',
  shipClass: 'Freedom Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 4,
      deckName: 'Royal Promenade',
      hasCasino: true,
      amenities: ['Casino', 'Shopping', 'Entertainment'],
      casinoZones: [
        {
          id: 'freedom-casino-main',
          name: 'Casino Royale',
          description: 'Main casino floor',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          machineSlots: Array.from({ length: 45 }, (_, i) => ({
            id: `freedom-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 9) * 11.11,
            y: Math.floor(i / 9) * 20,
          })),
        },
      ],
    },
  ],
};

export const RADIANCE_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Radiance Class',
  shipClass: 'Radiance Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 5,
      deckName: 'Casino Level',
      hasCasino: true,
      amenities: ['Casino', 'Bars'],
      casinoZones: [
        {
          id: 'radiance-casino-main',
          name: 'Casino Royale',
          description: 'Main casino floor',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          machineSlots: Array.from({ length: 30 }, (_, i) => ({
            id: `radiance-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 6) * 16.67,
            y: Math.floor(i / 6) * 20,
          })),
        },
      ],
    },
  ],
};

export const VISION_CLASS_DECK_PLAN: ShipDeckPlan = {
  shipName: 'Vision Class',
  shipClass: 'Vision Class',
  lastUpdated: '2025-01-01',
  decks: [
    {
      deckNumber: 5,
      deckName: 'Casino Level',
      hasCasino: true,
      amenities: ['Casino', 'Schooner Bar'],
      casinoZones: [
        {
          id: 'vision-casino-main',
          name: 'Casino Royale',
          description: 'Main casino floor',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          machineSlots: Array.from({ length: 25 }, (_, i) => ({
            id: `vision-slot-${i + 1}`,
            slotNumber: i + 1,
            x: (i % 5) * 20,
            y: Math.floor(i / 5) * 20,
          })),
        },
      ],
    },
  ],
};

export const SHIP_CLASS_DECK_PLANS: Record<string, ShipDeckPlan> = {
  'Oasis Class': OASIS_CLASS_DECK_PLAN,
  'Quantum Ultra Class': QUANTUM_CLASS_DECK_PLAN,
  'Quantum Class': QUANTUM_CLASS_DECK_PLAN,
  'Voyager Class': VOYAGER_CLASS_DECK_PLAN,
  'Freedom Class': FREEDOM_CLASS_DECK_PLAN,
  'Radiance Class': RADIANCE_CLASS_DECK_PLAN,
  'Vision Class': VISION_CLASS_DECK_PLAN,
  'Icon Class': OASIS_CLASS_DECK_PLAN,
};

export function getDeckPlanForShip(shipName: string, shipClass: string): ShipDeckPlan | undefined {
  const plan = SHIP_CLASS_DECK_PLANS[shipClass];
  if (!plan) return undefined;

  return {
    ...plan,
    shipName,
  };
}

export function getCasinoDecksForShip(shipClass: string): DeckInfo[] {
  const plan = SHIP_CLASS_DECK_PLANS[shipClass];
  if (!plan) return [];

  return plan.decks.filter(deck => deck.hasCasino);
}

export function getTotalMachineSlots(shipClass: string): number {
  const plan = SHIP_CLASS_DECK_PLANS[shipClass];
  if (!plan) return 0;

  return plan.decks.reduce((total, deck) => {
    if (!deck.casinoZones) return total;
    return total + deck.casinoZones.reduce((zoneTotal, zone) => {
      return zoneTotal + (zone.machineSlots?.length || 0);
    }, 0);
  }, 0);
}
