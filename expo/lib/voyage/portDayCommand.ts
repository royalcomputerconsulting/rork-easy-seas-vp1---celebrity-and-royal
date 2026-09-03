export interface PortDayInput { port: string; arrival?: string; departure?: string; allAboard?: string; shipTimeZone?: string; localTimeZone?: string; tender?: boolean; walkingDistanceMiles?: number; transportNotes?: string; reservationTimes?: string[]; currency?: string; safetyBufferMinutes?: number }
export interface PortDayCommand { port: string; returnBy?: string; safetyBufferMinutes: number; timeZoneWarning: string | null; tenderWarning: string | null; facts: string[] }
export function buildPortDayCommand(input: PortDayInput): PortDayCommand {
  const buffer = Math.max(15, input.safetyBufferMinutes ?? 60), base = input.allAboard || input.departure;
  let returnBy: string | undefined;
  if (base && /^\d{1,2}:\d{2}$/.test(base)) { const [hours, minutes] = base.split(':').map(Number), total = (hours * 60 + minutes - buffer + 1440) % 1440; returnBy = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
  const timeZoneWarning = input.shipTimeZone && input.localTimeZone && input.shipTimeZone !== input.localTimeZone ? `Ship time (${input.shipTimeZone}) differs from local time (${input.localTimeZone}). Confirm which clock controls all-aboard.` : null;
  return { port: input.port, returnBy, safetyBufferMinutes: buffer, timeZoneWarning, tenderWarning: input.tender ? 'Tendering can add unpredictable transit and queue time; increase the return buffer.' : null, facts: [`Arrival: ${input.arrival || 'not saved'}`, `Departure: ${input.departure || 'not saved'}`, `All aboard: ${input.allAboard || 'not saved'}`, `Currency: ${input.currency || 'not saved'}`, input.transportNotes || 'No transport notes saved.'] };
}
