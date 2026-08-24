export type MachineAtlasConfidence = 'verified' | 'observed' | 'stale' | 'unmapped';

export interface AtlasMachineLike {
  id: string;
  globalMachineId?: string;
  machineName: string;
  manufacturer?: string;
  denominations?: string[];
  denominationFamilies?: string[];
  userNotes?: string;
  shipAssignments?: { shipName: string; deckLocations?: string[]; notes?: string; lastSeen?: string }[];
}

export interface AtlasMappingLike {
  id: string; machineId: string; shipName: string; deckNumber: number; deckName: string;
  zoneName: string; slotNumber: number; notes?: string; lastSeen?: string; isActive: boolean; updatedAt: string;
}

export interface AtlasConditionLike {
  machineId?: string; machineName: string; shipName: string; casinoLocation: string;
  seatBankPosition: string; denomination: string; visibleMachineState: string;
  bonusMeterCondition: string; timeObserved: string; notes?: string;
}

export interface AtlasSessionLike {
  machineId?: string; machineName?: string; date: string; winLoss?: number;
  buyIn?: number; cashOut?: number; durationMinutes: number;
}

export interface VerifiedMachineAtlasEntry {
  key: string; machineId: string; machineName: string; manufacturer: string; shipName: string;
  deck: string; zone: string; bankPosition: string; denomination: string; lastSeen: string | null;
  confidence: MachineAtlasConfidence; confidenceReason: string; conditionNotes: string[];
  sessionCount: number; sessionMinutes: number; sessionNet: number; lastSessionDate: string | null;
}

const normalize = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';

function validDate(value?: string | null): number | null {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sameMachine(machine: AtlasMachineLike, row: { machineId?: string; machineName?: string }): boolean {
  return Boolean(row.machineId && (row.machineId === machine.id || row.machineId === machine.globalMachineId))
    || Boolean(row.machineName && normalize(row.machineName) === normalize(machine.machineName));
}

function daysOld(value: string | null, now: Date): number | null {
  const timestamp = validDate(value);
  return timestamp === null ? null : Math.max(0, (now.getTime() - timestamp) / 86_400_000);
}

export function buildVerifiedMachineAtlas(input: {
  machines: AtlasMachineLike[]; mappings: AtlasMappingLike[]; conditions: AtlasConditionLike[];
  sessions: AtlasSessionLike[]; now?: Date;
}): VerifiedMachineAtlasEntry[] {
  const now = input.now ?? new Date();
  const entries: VerifiedMachineAtlasEntry[] = [];

  for (const machine of input.machines) {
    const savedMappings = input.mappings.filter((row) => row.isActive && sameMachine(machine, row));
    const assignments = machine.shipAssignments ?? [];
    const locations: AtlasMappingLike[] = savedMappings.length > 0
      ? savedMappings
      : assignments.length > 0
        ? assignments.map((row, index) => ({
            id: `assignment-${index}`, machineId: machine.id, shipName: row.shipName, deckNumber: 0,
            deckName: row.deckLocations?.join(', ') || 'Deck not recorded', zoneName: 'Zone not recorded',
            slotNumber: 0, notes: row.notes, lastSeen: row.lastSeen, isActive: true, updatedAt: row.lastSeen || '',
          }))
        : [{
            id: 'unmapped', machineId: machine.id, shipName: 'Ship not recorded', deckNumber: 0,
            deckName: 'Deck not recorded', zoneName: 'Zone not recorded', slotNumber: 0,
            notes: machine.userNotes, isActive: true, updatedAt: '',
          }];

    for (const mapping of locations) {
      const conditions = input.conditions
        .filter((row) => sameMachine(machine, row) && normalize(row.shipName) === normalize(mapping.shipName))
        .sort((a, b) => b.timeObserved.localeCompare(a.timeObserved));
      const latestCondition = conditions[0];
      const lastSeen = [mapping.lastSeen, mapping.updatedAt, latestCondition?.timeObserved]
        .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
      const age = daysOld(lastSeen, now);
      const hasDeckMapping = !mapping.id.startsWith('assignment-') && mapping.id !== 'unmapped';
      let confidence: MachineAtlasConfidence = 'unmapped';
      let confidenceReason = 'No onboard location has been recorded.';

      if (hasDeckMapping && age !== null && age <= 90) {
        confidence = 'verified';
        confidenceReason = `Deck mapping observed ${Math.round(age)} day${Math.round(age) === 1 ? '' : 's'} ago.`;
      } else if (hasDeckMapping && age !== null) {
        confidence = 'stale';
        confidenceReason = `Deck mapping is ${Math.round(age)} days old and should be rechecked onboard.`;
      } else if (hasDeckMapping) {
        confidence = 'observed';
        confidenceReason = 'Deck mapping exists, but its observation date is missing.';
      } else if (mapping.id.startsWith('assignment-') && age !== null && age <= 90) {
        confidence = 'observed';
        confidenceReason = 'Ship assignment was recently observed; exact bank position is not verified.';
      } else if (mapping.id.startsWith('assignment-')) {
        confidence = age === null ? 'observed' : 'stale';
        confidenceReason = age === null ? 'Ship assignment exists without an observation date.' : `Ship assignment is ${Math.round(age)} days old.`;
      }

      const sessions = input.sessions.filter((row) => sameMachine(machine, row));
      const lastSessionDate = sessions.map((row) => row.date).filter(Boolean).sort().at(-1) ?? null;
      const conditionNotes = [
        latestCondition?.visibleMachineState && `Visible state: ${latestCondition.visibleMachineState}`,
        latestCondition?.bonusMeterCondition && `Bonus meter: ${latestCondition.bonusMeterCondition}`,
        latestCondition?.notes,
        mapping.notes,
      ].filter((value): value is string => Boolean(value && value.trim()));

      entries.push({
        key: `${machine.id}:${mapping.id}`, machineId: machine.id, machineName: machine.machineName,
        manufacturer: machine.manufacturer || 'Unknown manufacturer', shipName: mapping.shipName,
        deck: mapping.deckName, zone: mapping.zoneName,
        bankPosition: latestCondition?.seatBankPosition || (mapping.slotNumber > 0 ? `Slot #${mapping.slotNumber}` : 'Bank position not recorded'),
        denomination: latestCondition?.denomination || machine.denominations?.join(', ') || machine.denominationFamilies?.join(', ') || 'Not recorded',
        lastSeen, confidence, confidenceReason, conditionNotes: Array.from(new Set(conditionNotes)),
        sessionCount: sessions.length,
        sessionMinutes: sessions.reduce((sum, row) => sum + (Number(row.durationMinutes) || 0), 0),
        sessionNet: sessions.reduce((sum, row) => sum + (Number.isFinite(Number(row.winLoss)) ? Number(row.winLoss) : Number(row.cashOut || 0) - Number(row.buyIn || 0)), 0),
        lastSessionDate,
      });
    }
  }

  return entries.sort((a, b) => a.shipName.localeCompare(b.shipName)
    || a.deck.localeCompare(b.deck) || a.zone.localeCompare(b.zone)
    || a.bankPosition.localeCompare(b.bankPosition) || a.machineName.localeCompare(b.machineName));
}

export const MACHINE_ATLAS_EVIDENCE_NOTICE = 'Locations and conditions are saved observations, not live casino inventory. Session results are personal history and provide no prediction of future outcomes.';
