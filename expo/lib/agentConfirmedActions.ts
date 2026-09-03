import type { BookedCruise, CalendarEvent, CasinoOffer } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';

export type AgentActionKind = 'shortlist-offer' | 'mark-certificate-used' | 'add-reminder' | 'start-session' | 'prepare-host-brief' | 'open-cruise';
export interface AgentConfirmedAction {
  id: string;
  kind: AgentActionKind;
  label: string;
  description: string;
  payload: Record<string, string>;
}

const normalize = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';
const mentioned = (query: string, values: unknown[]): boolean => values.some((value) => {
  const text = normalize(value);
  return text.length >= 3 && query.includes(text);
});

export function parseAgentConfirmedAction(input: {
  message: string;
  offers: CasinoOffer[];
  certificates: Certificate[];
  cruises: BookedCruise[];
}): AgentConfirmedAction | null {
  const query = normalize(input.message);
  const id = `agent-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (/\b(shortlist|favorite|save)\b.*\boffer\b|\boffer\b.*\b(shortlist|favorite)\b/.test(query)) {
    const offer = input.offers.find((row) => mentioned(query, [row.offerCode, row.playerOfferId, row.offerInstanceId, row.title, row.offerName]));
    if (offer) return { id, kind: 'shortlist-offer', label: 'Shortlist offer', description: `Add ${offer.offerCode || offer.title} to your local shortlist. No booking will be made.`, payload: { offerId: offer.id } };
  }
  if (/\b(mark|set|record|use)\b.*\bcertificate\b.*\bused\b|\bused\b.*\bcertificate\b/.test(query)) {
    const certificate = input.certificates.find((row) => mentioned(query, [row.id, row.certificateCode, row.label]));
    if (certificate) return { id, kind: 'mark-certificate-used', label: 'Mark certificate used', description: `Change ${certificate.certificateCode || certificate.label} from ${certificate.status} to used in local storage.`, payload: { certificateId: certificate.id } };
  }
  if (/\b(remind|reminder|calendar reminder)\b/.test(query)) {
    const date = query.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (date) return { id, kind: 'add-reminder', label: 'Add calendar reminder', description: `Create a personal Easy Seas reminder for ${date}.`, payload: { date, title: input.message.trim().slice(0, 120) } };
  }
  if (/\b(start|begin|open)\b.*\b(casino|gambling|slot)?\s*session\b/.test(query)) {
    return { id, kind: 'start-session', label: 'Open session starter', description: 'Open the existing one-tap session form. Nothing is recorded until you finish and save the form.', payload: { route: '/(tabs)/machines?startSession=1' } };
  }
  if (/\b(prepare|create|open|generate)\b.*\bhost\b.*\bbrief\b/.test(query)) {
    return { id, kind: 'prepare-host-brief', label: 'Prepare host brief', description: 'Open the redactable Casino Host Meeting Brief built from your saved local evidence.', payload: { route: '/casino/host-meeting-brief' } };
  }
  if (/\b(open|show|view)\b.*\bcruise\b/.test(query)) {
    const cruise = input.cruises.find((row) => mentioned(query, [row.id, row.reservationNumber, row.bookingId, row.shipName, row.sailDate]));
    if (cruise) return { id, kind: 'open-cruise', label: 'Open cruise', description: `Open ${cruise.shipName} sailing ${cruise.sailDate}.`, payload: { route: `/cruise-details?id=${encodeURIComponent(cruise.id)}`, cruiseId: cruise.id } };
  }
  return null;
}

export function buildAgentReminderEvent(action: AgentConfirmedAction): CalendarEvent {
  if (action.kind !== 'add-reminder') throw new Error('Action is not a reminder.');
  return { id: `agent-reminder-${Date.now()}`, title: action.payload.title || 'Easy Seas reminder', startDate: action.payload.date, endDate: action.payload.date, type: 'personal', sourceType: 'personal', source: 'manual', allDay: true, reminder: '09:00', description: 'Created after explicit confirmation in Easy Seas Agent.' };
}
