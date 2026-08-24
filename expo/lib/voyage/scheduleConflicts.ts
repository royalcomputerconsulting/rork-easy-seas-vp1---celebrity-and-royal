export interface VoyageAgendaItem { id: string; title: string; start: string; end: string; location?: string; kind: 'dining' | 'show' | 'excursion' | 'casino' | 'all_aboard' | 'sail_away' | 'other'; walkingMinutesAfter?: number }
export interface VoyageConflict { leftId: string; rightId: string; severity: 'warning' | 'blocking'; explanation: string }

const time = (value: string): number | null => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; };
export function findVoyageScheduleConflicts(items: VoyageAgendaItem[]): VoyageConflict[] {
  const sorted = items.map((item) => ({ item, start: time(item.start), end: time(item.end) })).filter((row): row is { item: VoyageAgendaItem; start: number; end: number } => row.start !== null && row.end !== null).sort((a, b) => a.start - b.start);
  const conflicts: VoyageConflict[] = [];
  for (let index = 0; index < sorted.length; index += 1) for (let next = index + 1; next < sorted.length; next += 1) {
    const left = sorted[index], right = sorted[next];
    const buffer = Math.max(0, left.item.walkingMinutesAfter ?? 0) * 60_000;
    if (right.start >= left.end + buffer) break;
    const boundary = ['all_aboard', 'sail_away'].includes(left.item.kind) || ['all_aboard', 'sail_away'].includes(right.item.kind);
    conflicts.push({ leftId: left.item.id, rightId: right.item.id, severity: boundary || right.start < left.end ? 'blocking' : 'warning', explanation: right.start < left.end ? `${left.item.title} overlaps ${right.item.title}.` : `${left.item.title} leaves less than ${left.item.walkingMinutesAfter} minutes to reach ${right.item.title}.` });
  }
  return conflicts;
}
