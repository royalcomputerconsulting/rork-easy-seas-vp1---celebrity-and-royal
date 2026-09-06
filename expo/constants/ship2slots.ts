import SHIP_SLOT_RAW from '@/assets/ship2slots.json';

// Compact ship-to-machine mapping loaded from assets/ship2slots.json.
// The JSON stores ship names as keys and machine display names as values to keep the bundle small.

export interface ShipSlotMachine {
  title: string;
  variant: string;
  manufacturer: string;
  family: string;
  confidence: number;
  apScore: number;
  displayName: string;
}

export type ShipSlotData = Record<string, ShipSlotMachine[]>;
type RawShipSlotData = Record<string, string[]>;

const RAW_SHIP_SLOT_DATA: RawShipSlotData = SHIP_SLOT_RAW as RawShipSlotData;

function normaliseMachineName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function splitTitleAndVariant(machineName: string): { title: string; variant: string } {
  const normalised = normaliseMachineName(machineName);
  const separator = ' - ';
  if (!normalised.includes(separator)) {
    return { title: normalised, variant: 'Standard' };
  }

  const [title, ...variantParts] = normalised.split(separator);
  return {
    title: title?.trim() || normalised,
    variant: variantParts.join(separator).trim() || 'Standard',
  };
}

function inferManufacturer(machineName: string): string {
  const lower = machineName.toLowerCase();

  if (
    lower.includes('dragon link') ||
    lower.includes('lightning link') ||
    lower.includes('buffalo') ||
    lower.includes('mighty cash') ||
    lower.includes('wonder 4') ||
    lower.includes('spooky link') ||
    lower.includes('coin trio') ||
    lower.includes('regal riches') ||
    lower.includes('mo mummy')
  ) {
    return 'Aristocrat';
  }

  if (
    lower.includes('huff') ||
    lower.includes('lock it link') ||
    lower.includes('flaming hot pots') ||
    lower.includes('big hot flaming pots') ||
    lower.includes('dancing drum') ||
    lower.includes('quick hit') ||
    lower.includes('88 fortunes') ||
    lower.includes('bao zhu') ||
    lower.includes('duo fu duo cai') ||
    lower.includes('fire link') ||
    lower.includes('ultimate fire link') ||
    lower.includes('prosperity link') ||
    lower.includes('money gong') ||
    lower.includes('rakin') ||
    lower.includes('rich little hens') ||
    lower.includes('rising rockets') ||
    lower.includes('coin combo') ||
    lower.includes('lucky leprechauns') ||
    lower.includes('mystery of the lamp') ||
    lower.includes('jade tree') ||
    lower.includes('mighty monkey')
  ) {
    return 'Light & Wonder';
  }

  if (
    lower.includes('phoenix link') ||
    lower.includes('all aboard') ||
    lower.includes("dragon's law") ||
    lower.includes('san fa')
  ) {
    return 'Konami';
  }

  if (
    lower.includes('wheel of fortune') ||
    lower.includes('cleopatra') ||
    lower.includes('top dollar') ||
    lower.includes('double gold pinball') ||
    lower.includes('triple red hot') ||
    lower.includes('triple diamonds') ||
    lower.includes('blazing sevens') ||
    lower.includes('back to the future') ||
    lower.includes('video poker')
  ) {
    return 'IGT';
  }

  if (lower.includes('beer haus') || lower.includes('heidi')) return 'WMS / Light & Wonder';
  if (lower.includes('book of ra')) return 'Novomatic';
  if (lower.includes('red hot chile')) return 'Everi';
  if (lower.includes('video poker')) return 'Multi-vendor';

  return 'Other';
}

function inferFamily(machineName: string): string {
  const lower = machineName.toLowerCase();

  if (lower.includes('video poker')) return 'Video Poker';
  if (
    lower.includes('dragon link') ||
    lower.includes('lightning link') ||
    lower.includes('phoenix link') ||
    lower.includes('lock it link') ||
    lower.includes('buffalo link') ||
    lower.includes('prosperity link') ||
    lower.includes('fire link') ||
    lower.includes('ultimate fire link') ||
    lower.includes('spooky link') ||
    lower.includes('lion link') ||
    lower.includes('mighty cash')
  ) {
    return 'Link';
  }

  if (lower.includes('huff')) return 'Feature Slot';
  if (
    lower.includes('top dollar') ||
    lower.includes('double gold pinball') ||
    lower.includes('blazing sevens') ||
    lower.includes('triple red hot') ||
    lower.includes('triple diamonds')
  ) {
    return 'Reel';
  }

  if (
    lower.includes('monopoly') ||
    lower.includes('lord of the rings') ||
    lower.includes('back to the future') ||
    lower.includes('deal or no deal') ||
    lower.includes('aladdin')
  ) {
    return 'Licensed';
  }

  return 'Video Slot';
}

function inferApScore(machineName: string): number {
  const lower = machineName.toLowerCase();

  if (
    lower.includes('dragon link - golden century') ||
    lower.includes('dragon link - panda magic') ||
    lower.includes('dragon link - autumn moon') ||
    lower.includes('dragon link - happy & prosperous') ||
    lower.includes('phoenix link') ||
    lower.includes('huff n more puff') ||
    lower.includes('huff n even more puff') ||
    lower.includes('huff and mega puff') ||
    lower.includes('spooky link')
  ) {
    return 10;
  }

  if (
    lower.includes('dragon link') ||
    lower.includes('lightning link') ||
    lower.includes('buffalo link') ||
    lower.includes('lock it link') ||
    lower.includes('fire link') ||
    lower.includes('ultimate fire link') ||
    lower.includes('prosperity link') ||
    lower.includes('huff n puff') ||
    lower.includes('dancing drums - prosperity link')
  ) {
    return 9;
  }

  if (
    lower.includes('buffalo') ||
    lower.includes('flaming hot pots') ||
    lower.includes('big hot flaming pots') ||
    lower.includes('mighty cash') ||
    lower.includes('coin trio') ||
    lower.includes('coin combo') ||
    lower.includes('dancing drum') ||
    lower.includes('bao zhu') ||
    lower.includes('duo fu duo cai') ||
    lower.includes('wonder 4') ||
    lower.includes('lion link')
  ) {
    return 8;
  }

  if (
    lower.includes('wheel of fortune') ||
    lower.includes('all aboard') ||
    lower.includes('quick hit') ||
    lower.includes('88 fortunes') ||
    lower.includes('rakin') ||
    lower.includes('rich little hens') ||
    lower.includes('mystery of the lamp') ||
    lower.includes('temple falls')
  ) {
    return 7;
  }

  if (
    lower.includes('video poker') ||
    lower.includes('top dollar') ||
    lower.includes('blazing sevens') ||
    lower.includes('triple red hot') ||
    lower.includes('triple diamonds') ||
    lower.includes('double gold pinball')
  ) {
    return 5;
  }

  return 6;
}

function machineFromName(machineName: string): ShipSlotMachine {
  const displayName = normaliseMachineName(machineName);
  const { title, variant } = splitTitleAndVariant(displayName);

  return {
    title,
    variant,
    manufacturer: inferManufacturer(displayName),
    family: inferFamily(displayName),
    confidence: 100,
    apScore: inferApScore(displayName),
    displayName,
  };
}

export const SHIP_SLOT_DATA: ShipSlotData = Object.fromEntries(
  Object.entries(RAW_SHIP_SLOT_DATA).map(([shipName, machines]) => [
    shipName,
    Array.from(new Set((Array.isArray(machines) ? machines : []).map(normaliseMachineName)))
      .filter(Boolean)
      .map(machineFromName)
      .sort((a, b) => b.apScore - a.apScore || a.displayName.localeCompare(b.displayName)),
  ]),
);

export const SHIP_SLOT_SHIPS: string[] = Object.keys(SHIP_SLOT_DATA).sort((a, b) => a.localeCompare(b));
