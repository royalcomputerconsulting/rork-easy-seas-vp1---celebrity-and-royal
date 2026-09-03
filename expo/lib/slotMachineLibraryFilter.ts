import type { MachineEncyclopediaEntry, SlotManufacturer } from '@/types/models';

export interface SlotMachineLibraryFilters {
  searchQuery?: string;
  favoritesOnly?: boolean;
  manufacturer?: SlotManufacturer | '';
  ship?: string;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function filterSlotMachineLibrary(
  machines: MachineEncyclopediaEntry[],
  filters: SlotMachineLibraryFilters,
): MachineEncyclopediaEntry[] {
  const query = text(filters.searchQuery).toLocaleLowerCase();
  const selectedManufacturer = text(filters.manufacturer);
  const selectedShip = text(filters.ship);

  return machines.filter((machine) => {
    if (!machine || typeof machine !== 'object') return false;
    if (query) {
      const searchable = [machine.machineName, machine.manufacturer, machine.gameSeries, machine.theme]
        .map((value) => text(value).toLocaleLowerCase());
      if (!searchable.some((value) => value.includes(query))) return false;
    }
    if (filters.favoritesOnly && machine.isFavorite !== true) return false;
    if (selectedManufacturer && text(machine.manufacturer) !== selectedManufacturer) return false;
    if (selectedShip && !(machine.shipAssignments ?? []).some((assignment) => text(assignment?.shipName) === selectedShip)) return false;
    return true;
  }).sort((left, right) => {
    if (left.isFavorite && !right.isFavorite) return -1;
    if (!left.isFavorite && right.isFavorite) return 1;
    return text(left.machineName).localeCompare(text(right.machineName));
  });
}

export function getSlotMachineListKey(machine: MachineEncyclopediaEntry): string {
  return text((machine as MachineEncyclopediaEntry & { key?: string }).key)
    || text(machine.id)
    || text(machine.globalMachineId)
    || `${text(machine.manufacturer) || 'maker'}-${text(machine.machineName) || 'machine'}`;
}
