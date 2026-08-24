export interface TravelChecklistContext { international: boolean; destinations: string[]; departureDate: string; hasFlights: boolean; hasHotel: boolean; hasTransfers: boolean; requiresTender?: boolean }
export interface TravelChecklistItem { id: string; label: string; dueDate?: string; required: boolean; reason: string }
const subtractDays = (date: string, days: number): string | undefined => { const parsed = Date.parse(date); if (!Number.isFinite(parsed)) return undefined; return new Date(parsed - days * 86_400_000).toISOString().slice(0, 10); };
export function buildTravelChecklist(context: TravelChecklistContext): TravelChecklistItem[] {
  const due60 = subtractDays(context.departureDate, 60), due30 = subtractDays(context.departureDate, 30), due7 = subtractDays(context.departureDate, 7);
  return [
    { id: 'passport', label: context.international ? 'Verify passport validity for every traveler' : 'Verify government photo ID for every traveler', dueDate: due60, required: true, reason: context.international ? 'International itinerary.' : 'Embarkation identity requirement.' },
    ...(context.international ? [{ id: 'visas', label: `Verify visa and entry rules for ${context.destinations.join(', ') || 'every destination'}`, dueDate: due60, required: true, reason: 'Entry rules vary by nationality and destination.' }] : []),
    { id: 'checkin', label: 'Complete online check-in and select arrival appointment', dueDate: due30, required: true, reason: 'Avoid embarkation delays.' },
    { id: 'luggage', label: 'Download and print luggage tags', dueDate: due7, required: true, reason: 'Prepare checked baggage.' },
    { id: 'insurance', label: 'Review travel insurance and emergency coverage', dueDate: due60, required: false, reason: 'Confirm coverage before final payment where possible.' },
    { id: 'medication', label: 'Pack medication in carry-on with extra supply', dueDate: due7, required: true, reason: 'Keep essential medication accessible.' },
    ...(context.hasFlights ? [{ id: 'flight', label: 'Reconfirm flights and safe arrival buffer', dueDate: due7, required: true, reason: 'Reduce missed-embarkation risk.' }] : []),
    ...(context.hasHotel ? [{ id: 'hotel', label: 'Reconfirm pre-cruise hotel', dueDate: due7, required: true, reason: 'Validate reservation and check-in time.' }] : []),
    ...(context.hasTransfers ? [{ id: 'transfers', label: 'Reconfirm port transfers and pickup point', dueDate: due7, required: true, reason: 'Validate ground transport.' }] : []),
    { id: 'prohibited', label: 'Review the cruise line prohibited-items list', dueDate: due7, required: true, reason: 'Rules can change; use the official cruise-line source.' },
  ];
}
