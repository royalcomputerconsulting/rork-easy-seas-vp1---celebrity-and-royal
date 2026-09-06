import type { BookedCruise, CasinoOffer } from '@/types/models';
import { addCalendarDateDays, toCalendarDateOnly, toLocalCalendarDateOnly } from '@/lib/date';

export type VoyageNotificationKind = 'embarkation' | 'check_in' | 'final_payment' | 'offer_expiry' | 'certificate_expiry';

export interface VoyageNotificationPlanItem {
  id: string;
  kind: VoyageNotificationKind;
  title: string;
  body: string;
  triggerAt: string;
  route: string;
  entityId: string;
}

export interface VoyageNotificationPlanInput {
  bookedCruises: BookedCruise[];
  offers: CasinoOffer[];
  certificates: VoyageCertificateInput[];
  now?: Date;
  horizonDays?: number;
  maxItems?: number;
}

export interface VoyageCertificateInput {
  id: string;
  expiryDate?: string;
  used?: boolean;
  status?: string;
  certificateCode?: string;
  description?: string;
  label?: string;
  type?: string;
}

const PREFIX = 'easyseas-voyage:';

function safeKey(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 90);
}

function atLocalHour(dateOnly: string, hour = 9): Date | null {
  const normalized = toCalendarDateOnly(dateOnly);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const value = new Date(year, month - 1, day, hour, 0, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
}

function appendItem(
  items: VoyageNotificationPlanItem[],
  now: Date,
  horizonEnd: Date,
  input: Omit<VoyageNotificationPlanItem, 'triggerAt'> & { triggerDate: string },
): void {
  const trigger = atLocalHour(input.triggerDate);
  if (!trigger || trigger.getTime() <= now.getTime() + 60_000 || trigger > horizonEnd) return;
  items.push({
    id: `${PREFIX}${safeKey(input.id)}`,
    kind: input.kind,
    title: input.title,
    body: input.body,
    triggerAt: trigger.toISOString(),
    route: input.route,
    entityId: input.entityId,
  });
}

function offerExpiryDate(offer: CasinoOffer): string | undefined {
  return toCalendarDateOnly(offer.offerExpiryDate || offer.expiryDate || offer.expires || offer.validUntil);
}

export function buildVoyageNotificationPlan(input: VoyageNotificationPlanInput): VoyageNotificationPlanItem[] {
  const now = input.now ?? new Date();
  const horizonDays = Math.max(1, Math.min(365, input.horizonDays ?? 180));
  const maxItems = Math.max(1, Math.min(64, input.maxItems ?? 32));
  const horizonEnd = new Date(now);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);
  const items: VoyageNotificationPlanItem[] = [];

  input.bookedCruises.forEach((cruise) => {
    const sailDate = toCalendarDateOnly(cruise.sailDate);
    if (!sailDate) return;
    const sevenDaysBefore = addCalendarDateDays(sailDate, -7);
    const oneDayBefore = addCalendarDateDays(sailDate, -1);
    if (sevenDaysBefore) appendItem(items, now, horizonEnd, {
      id: `cruise:${cruise.id}:embarkation-7`, kind: 'embarkation', entityId: cruise.id,
      title: `${cruise.shipName} sails in one week`,
      body: `Review check-in, travel documents, itinerary, and saved weather for ${sailDate}.`,
      triggerDate: sevenDaysBefore, route: `/today-on-cruise?cruiseId=${encodeURIComponent(cruise.id)}`,
    });
    if (oneDayBefore) appendItem(items, now, horizonEnd, {
      id: `cruise:${cruise.id}:embarkation-1`, kind: 'embarkation', entityId: cruise.id,
      title: `${cruise.shipName} sails tomorrow`,
      body: `Open your voyage brief for stateroom, muster, itinerary, reservations, and marine outlook.`,
      triggerDate: oneDayBefore, route: `/today-on-cruise?cruiseId=${encodeURIComponent(cruise.id)}`,
    });
    const checkInDate = toCalendarDateOnly(cruise.checkInDate);
    if (checkInDate) appendItem(items, now, horizonEnd, {
      id: `cruise:${cruise.id}:check-in`, kind: 'check_in', entityId: cruise.id,
      title: `Check-in opens for ${cruise.shipName}`,
      body: `Reservation ${cruise.reservationNumber || 'saved in Easy Seas'} is ready for online check-in.`,
      triggerDate: checkInDate, route: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
    });
    const balanceDue = toCalendarDateOnly(cruise.balanceDueDate);
    const balanceWarning = balanceDue ? addCalendarDateDays(balanceDue, -7) : undefined;
    if (balanceWarning) appendItem(items, now, horizonEnd, {
      id: `cruise:${cruise.id}:balance-7`, kind: 'final_payment', entityId: cruise.id,
      title: `Final payment due in one week`,
      body: `${cruise.shipName}${cruise.balanceDue ? ` has $${cruise.balanceDue.toLocaleString()} remaining` : ''}. Verify the amount directly with the cruise line.`,
      triggerDate: balanceWarning, route: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
    });
  });

  input.offers.forEach((offer) => {
    if (offer.status && !['active', 'reviewNeeded'].includes(offer.status)) return;
    const expiry = offerExpiryDate(offer);
    const warning = expiry ? addCalendarDateDays(expiry, -3) : undefined;
    if (!warning) return;
    appendItem(items, now, horizonEnd, {
      id: `offer:${offer.id}:expiry-3`, kind: 'offer_expiry', entityId: offer.id,
      title: `${offer.offerCode || offer.title} expires soon`,
      body: `Review eligible sailings before ${expiry}. Easy Seas will not book automatically.`,
      triggerDate: warning, route: `/offer-details?id=${encodeURIComponent(offer.id)}`,
    });
  });

  input.certificates.forEach((certificate) => {
    if (certificate.used || certificate.status === 'used' || certificate.status === 'expired') return;
    const expiry = toCalendarDateOnly(certificate.expiryDate);
    const warning = expiry ? addCalendarDateDays(expiry, -7) : undefined;
    if (!warning) return;
    const code = certificate.certificateCode || certificate.label || certificate.description || certificate.type || 'saved reward';
    appendItem(items, now, horizonEnd, {
      id: `certificate:${certificate.id}:expiry-7`, kind: 'certificate_expiry', entityId: certificate.id,
      title: `Certificate ${code} expires in one week`,
      body: `Open Certificate Lookup to review saved eligible sailings before ${expiry}.`,
      triggerDate: warning, route: '/certificate-lookup',
    });
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  return Array.from(byId.values())
    .sort((left, right) => left.triggerAt.localeCompare(right.triggerAt) || left.id.localeCompare(right.id))
    .slice(0, maxItems);
}

export function isEasySeasVoyageNotificationId(identifier: string): boolean {
  return identifier.startsWith(PREFIX);
}

export function getNotificationPlanTodayKey(now: Date = new Date()): string {
  return toLocalCalendarDateOnly(now) ?? '';
}
