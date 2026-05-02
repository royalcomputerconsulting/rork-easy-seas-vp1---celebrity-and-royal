import type { CabinetType, MachineEncyclopediaEntry, MachineVolatility, SlotManufacturer } from '@/types/models';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SHIP_SLOT_DATA = require('../assets/ship2slots.json') as {
  sheets: Array<{
    sheet_name: string;
    headers: string[];
    record_count: number;
    records: Record<string, string | number | null>[];
  }>;
};

const CATALOG_TIMESTAMP = '2026-05-02T00:00:00.000Z';

type ShipAssignment = NonNullable<MachineEncyclopediaEntry['shipAssignments']>[number];

export interface ShipSlotRecord {
  id: string;
  shipName: string;
  shipClass: string;
  estimatedShipSlotCount: number | null;
  machineId: string;
  manufacturerRaw: string;
  manufacturer: SlotManufacturer;
  machineTitle: string;
  variant: string;
  machineName: string;
  family: string;
  bank: string;
  seatInBank: string;
  confidence: number | null;
  status: string;
  apVisibilityScore: number | null;
  sourceBasis: string;
  whitelistRule: string;
  normalizedMachineKey: string;
}

let cachedRecords: ShipSlotRecord[] | null = null;
let cachedMachineEntries: MachineEncyclopediaEntry[] | null = null;

function str(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizeForMatch(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizeManufacturer(value: string): SlotManufacturer {
  const normalized = normalizeForMatch(value);
  if (normalized.includes('aristocrat')) return 'Aristocrat';
  if (normalized.includes('konami')) return 'Konami';
  if (normalized.includes('igt')) return 'IGT';
  if (normalized.includes('everi')) return 'Everi';
  if (normalized.includes('ainsworth')) return 'Ainsworth';
  if (normalized.includes('ags')) return 'AGS';
  if (normalized.includes('bally')) return 'Bally';
  if (normalized.includes('light') || normalized.includes('wms') || normalized.includes('scientific')) return 'Light & Wonder';
  return 'Other';
}

function isGenericVariant(variant: string): boolean {
  const normalized = normalizeForMatch(variant);
  return normalized === '' || normalized === 'standard' || normalized === 'original' || normalized === 'various';
}

function formatMachineName(machineTitle: string, variant: string): string {
  if (isGenericVariant(variant)) return machineTitle;
  return `${machineTitle} - ${variant}`;
}

function getMachineKey(manufacturerRaw: string, machineTitle: string, variant: string): string {
  return `${slugify(normalizeManufacturer(manufacturerRaw))}-${slugify(machineTitle)}-${slugify(variant || 'standard')}`;
}

function inferCabinetType(family: string, variant: string): CabinetType {
  const normalizedFamily = normalizeForMatch(`${family} ${variant}`);
  if (normalizedFamily.includes('reel')) return 'Mechanical';
  if (normalizedFamily.includes('link')) return 'Curved';
  if (normalizedFamily.includes('poker')) return 'Video';
  if (normalizedFamily.includes('licensed')) return 'Video';
  return 'Video';
}

function inferVolatility(records: ShipSlotRecord[]): MachineVolatility {
  const maxAp = Math.max(...records.map((record) => record.apVisibilityScore ?? 0));
  if (maxAp >= 9) return 'Medium-High';
  if (maxAp >= 7) return 'Medium';
  return 'Medium';
}

function buildDeckLocation(record: ShipSlotRecord): string {
  const parts = [record.machineId];
  if (record.bank) parts.push(record.bank);
  if (record.seatInBank) parts.push(`Seat ${record.seatInBank}`);
  if (record.status) parts.push(record.status);
  if (record.apVisibilityScore !== null) parts.push(`AP ${record.apVisibilityScore}/10`);
  return parts.join(' • ');
}

function buildAssignment(shipName: string, records: ShipSlotRecord[]): ShipAssignment {
  const locations = Array.from(new Set(records.map(buildDeckLocation))).sort();
  const statuses = new Map<string, number>();
  let confidenceTotal = 0;
  let confidenceCount = 0;
  let apTotal = 0;
  let apCount = 0;

  records.forEach((record) => {
    statuses.set(record.status, (statuses.get(record.status) ?? 0) + 1);
    if (record.confidence !== null) {
      confidenceTotal += record.confidence;
      confidenceCount += 1;
    }
    if (record.apVisibilityScore !== null) {
      apTotal += record.apVisibilityScore;
      apCount += 1;
    }
  });

  const statusText = Array.from(statuses.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${status}: ${count}`)
    .join('; ');
  const avgConfidence = confidenceCount > 0 ? Math.round(confidenceTotal / confidenceCount) : null;
  const avgAp = apCount > 0 ? Math.round((apTotal / apCount) * 10) / 10 : null;
  const notes = [
    `Ship slot catalog: ${records.length} location${records.length === 1 ? '' : 's'}`,
    statusText,
    avgConfidence !== null ? `Avg confidence ${avgConfidence}` : '',
    avgAp !== null ? `Avg AP visibility ${avgAp}/10` : '',
  ].filter(Boolean).join(' • ');

  return {
    shipName,
    deckLocations: locations,
    notes,
    lastSeen: CATALOG_TIMESTAMP,
  };
}

function makeMachineEntry(records: ShipSlotRecord[]): MachineEncyclopediaEntry {
  const first = records[0];
  const shipGroups = new Map<string, ShipSlotRecord[]>();
  records.forEach((record) => {
    const group = shipGroups.get(record.shipName) ?? [];
    group.push(record);
    shipGroups.set(record.shipName, group);
  });

  const shipAssignments = Array.from(shipGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([shipName, shipRecords]) => buildAssignment(shipName, shipRecords));
  const maxAp = Math.max(...records.map((record) => record.apVisibilityScore ?? 0));
  const totalLocations = records.length;
  const sourceBasis = Array.from(new Set(records.map((record) => record.sourceBasis).filter(Boolean))).join(', ');

  return {
    id: `ship-slot-${first.normalizedMachineKey}`,
    globalMachineId: `ship-slot-${first.normalizedMachineKey}`,
    machineName: first.machineName,
    manufacturer: first.manufacturer,
    gameSeries: first.machineTitle,
    volatility: inferVolatility(records),
    cabinetType: inferCabinetType(first.family, first.variant),
    releaseYear: null,
    theme: isGenericVariant(first.variant) ? first.family : first.variant,
    description: `Ship slot catalog entry. Found in ${totalLocations} slot location${totalLocations === 1 ? '' : 's'} across ${shipAssignments.length} ship${shipAssignments.length === 1 ? '' : 's'}.`,
    denominationFamilies: [],
    apMetadata: {
      persistenceType: maxAp >= 8 ? 'Pseudo' : 'None',
      hasMustHitBy: false,
      notesAndTips: `AP visibility score: ${maxAp}/10. Source basis: ${sourceBasis || 'Ship slot catalog'}.`,
    },
    shipAssignments,
    shipNotes: `Loaded from bundled ship2slots.json. This is shared ship-floor data, not user-specific notes.`,
    source: 'ship-slot-csv',
    isInMyAtlas: true,
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

function mergeAssignments(existingAssignments: ShipAssignment[] | undefined, incomingAssignments: ShipAssignment[] | undefined): ShipAssignment[] | undefined {
  if (!existingAssignments?.length) return incomingAssignments;
  if (!incomingAssignments?.length) return existingAssignments;

  const merged = new Map<string, ShipAssignment>();
  existingAssignments.forEach((assignment) => {
    merged.set(normalizeForMatch(assignment.shipName), { ...assignment, deckLocations: assignment.deckLocations ? [...assignment.deckLocations] : undefined });
  });

  incomingAssignments.forEach((incoming) => {
    const key = normalizeForMatch(incoming.shipName);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...incoming, deckLocations: incoming.deckLocations ? [...incoming.deckLocations] : undefined });
      return;
    }

    const deckLocations = Array.from(new Set([...(existing.deckLocations ?? []), ...(incoming.deckLocations ?? [])])).sort();
    merged.set(key, {
      ...existing,
      deckLocations,
      notes: existing.notes ?? incoming.notes,
      lastSeen: existing.lastSeen ?? incoming.lastSeen,
    });
  });

  return Array.from(merged.values()).sort((a, b) => a.shipName.localeCompare(b.shipName));
}

function findMatchingMachineIndex(machines: MachineEncyclopediaEntry[], catalogMachine: MachineEncyclopediaEntry): number {
  const catalogId = catalogMachine.globalMachineId ?? catalogMachine.id;
  const catalogName = normalizeForMatch(catalogMachine.machineName);

  return machines.findIndex((machine) => {
    const existingId = machine.globalMachineId ?? machine.id;
    if (existingId === catalogId) return true;
    return normalizeForMatch(machine.machineName) === catalogName;
  });
}

/** Parse all records from the bundled JSON synchronously — no async I/O needed. */
function parseJsonRecords(): ShipSlotRecord[] {
  if (cachedRecords) return cachedRecords;

  const records: ShipSlotRecord[] = [];

  for (const sheet of SHIP_SLOT_DATA.sheets) {
    for (const row of sheet.records) {
      const shipName = str(row['Ship']);
      const machineTitle = str(row['Machine Title']);
      const machineId = str(row['Machine ID']);
      if (!shipName || !machineTitle || !machineId) continue;

      const manufacturerRaw = str(row['Manufacturer']) || 'Other';
      const variant = str(row['Variant']) || 'Standard';
      const machineName = formatMachineName(machineTitle, variant);
      const normalizedMachineKey = getMachineKey(manufacturerRaw, machineTitle, variant);

      records.push({
        id: `${slugify(shipName)}-${slugify(machineId)}`,
        shipName,
        shipClass: str(row['Class']) || 'Unknown',
        estimatedShipSlotCount: num(row['Estimated Ship Slot Count']),
        machineId,
        manufacturerRaw,
        manufacturer: normalizeManufacturer(manufacturerRaw),
        machineTitle,
        variant,
        machineName,
        family: str(row['Family']) || 'Video Slot',
        bank: str(row['Bank']),
        seatInBank: str(row['Seat In Bank']),
        confidence: num(row['Confidence']),
        status: str(row['Status']) || 'Cataloged',
        apVisibilityScore: num(row['AP Visibility Score']),
        sourceBasis: str(row['Source Basis']),
        whitelistRule: str(row['Whitelist Rule']),
        normalizedMachineKey,
      });
    }
  }

  cachedRecords = records;
  console.log(`[ShipSlotCatalog] Loaded ${records.length} ship slot rows from JSON`);
  return records;
}

export async function loadShipSlotRecords(): Promise<ShipSlotRecord[]> {
  return parseJsonRecords();
}

export async function loadShipSlotMachineEntries(): Promise<MachineEncyclopediaEntry[]> {
  if (cachedMachineEntries) return cachedMachineEntries;

  const records = parseJsonRecords();
  const grouped = new Map<string, ShipSlotRecord[]>();
  records.forEach((record) => {
    const group = grouped.get(record.normalizedMachineKey) ?? [];
    group.push(record);
    grouped.set(record.normalizedMachineKey, group);
  });

  const entries = Array.from(grouped.values())
    .map(makeMachineEntry)
    .sort((a, b) => a.machineName.localeCompare(b.machineName));

  cachedMachineEntries = entries;
  console.log(`[ShipSlotCatalog] Built ${entries.length} machine entries from ship slot JSON`);
  return entries;
}

export function mergeShipSlotMachinesIntoLibrary(
  machines: MachineEncyclopediaEntry[],
  shipSlotMachines: MachineEncyclopediaEntry[]
): MachineEncyclopediaEntry[] {
  if (shipSlotMachines.length === 0) return machines;

  const merged = machines.map((machine) => ({ ...machine }));

  shipSlotMachines.forEach((catalogMachine) => {
    const index = findMatchingMachineIndex(merged, catalogMachine);
    if (index >= 0) {
      const existing = merged[index];
      merged[index] = {
        ...existing,
        shipAssignments: mergeAssignments(existing.shipAssignments, catalogMachine.shipAssignments),
        shipNotes: existing.shipNotes ?? catalogMachine.shipNotes,
        description: existing.description ?? catalogMachine.description,
        gameSeries: existing.gameSeries ?? catalogMachine.gameSeries,
        theme: existing.theme ?? catalogMachine.theme,
      };
      return;
    }

    merged.push(catalogMachine);
  });

  return merged.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return a.machineName.localeCompare(b.machineName);
  });
}
