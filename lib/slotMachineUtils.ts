import type { SlotMachine } from '@/types/models';
import { GLOBAL_SLOT_MACHINES } from '@/constants/globalSlotMachines';

export function searchSlotMachines(query: string, machines: SlotMachine[]): SlotMachine[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return machines;
  
  return machines.filter(machine => 
    machine.machineName.toLowerCase().includes(lowerQuery) ||
    machine.manufacturer.toLowerCase().includes(lowerQuery) ||
    (machine.gameSeries?.toLowerCase().includes(lowerQuery)) ||
    (machine.theme?.toLowerCase().includes(lowerQuery))
  );
}

export function filterSlotMachines(machines: SlotMachine[], filters: {
  manufacturers?: string[];
  volatility?: string[];
  persistenceType?: string[];
  hasMustHitBy?: boolean;
  hasAPPotential?: boolean;
}): SlotMachine[] {
  let filtered = [...machines];
  
  if (filters.manufacturers && filters.manufacturers.length > 0) {
    filtered = filtered.filter(m => filters.manufacturers!.includes(m.manufacturer));
  }
  
  if (filters.volatility && filters.volatility.length > 0) {
    filtered = filtered.filter(m => filters.volatility!.includes(m.volatility));
  }
  
  if (filters.persistenceType && filters.persistenceType.length > 0) {
    filtered = filtered.filter(m => 
      m.apMetadata && filters.persistenceType!.includes(m.apMetadata.persistenceType)
    );
  }
  
  if (filters.hasMustHitBy !== undefined) {
    filtered = filtered.filter(m => 
      m.apMetadata && m.apMetadata.hasMustHitBy === filters.hasMustHitBy
    );
  }
  
  if (filters.hasAPPotential) {
    filtered = filtered.filter(m => 
      m.apMetadata && (m.apMetadata.persistenceType !== 'None' || m.apMetadata.hasMustHitBy)
    );
  }
  
  return filtered;
}

export async function loadGlobalSlotMachines(): Promise<SlotMachine[]> {
  try {
    console.log(`[SlotMachineUtils] Loaded ${GLOBAL_SLOT_MACHINES.length} global machines`);
    return GLOBAL_SLOT_MACHINES;
  } catch (e) {
    console.error('[SlotMachineUtils] Failed to load global machines:', e);
    return [];
  }
}
