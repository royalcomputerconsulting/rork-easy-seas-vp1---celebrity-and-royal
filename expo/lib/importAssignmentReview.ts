import type { BookedCruise, CalendarEvent, CasinoOffer, CasinoProgram, Cruise, ImportReviewStatus, TravelBrand } from '@/types/models';
import type { UserProfile } from '@/state/UserProvider';

export type ImportAssignmentEntity = 'offer' | 'availableCruise' | 'bookedCruise' | 'calendarEvent';

export type ImportAssignmentRecord = (CasinoOffer | Cruise | BookedCruise | CalendarEvent) & {
  ownerProfileId?: string;
  sourceEmail?: string;
  brand?: TravelBrand | string;
  casinoProgram?: CasinoProgram;
  importStatus?: ImportReviewStatus;
  reconciliationStatus?: ImportReviewStatus;
  offerSource?: string;
  cruiseSource?: string;
  status?: string;
};

export interface ImportAssignmentReviewItem {
  id: string;
  entity: ImportAssignmentEntity;
  title: string;
  subtitle: string;
  dateLabel?: string;
  sourceEmail?: string;
  ownerProfileId?: string;
  brand?: TravelBrand | string;
  casinoProgram?: CasinoProgram;
  importStatus?: ImportReviewStatus;
  reconciliationStatus?: ImportReviewStatus;
  record: ImportAssignmentRecord;
}

export interface ImportAssignmentReviewGroup {
  key: string;
  label: string;
  sourceEmail?: string;
  ownerProfileId?: string;
  items: ImportAssignmentReviewItem[];
}

export interface ImportAssignmentReviewInput {
  offers: CasinoOffer[];
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  calendarEvents: CalendarEvent[];
  users: UserProfile[];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeReviewEmail(value: unknown): string | undefined {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes('@') ? normalized : undefined;
}

function getProfileEmails(profile: UserProfile): string[] {
  return [profile.email, profile.celebrityEmail, profile.silverseaEmail]
    .map(normalizeReviewEmail)
    .filter((email): email is string => email !== undefined);
}

export function getImportProfileName(profile: UserProfile | undefined): string {
  if (!profile) return 'Unknown profile';
  return profile.displayName || profile.name || profile.email || 'Traveler';
}

export function resolveImportOwnerProfile(record: ImportAssignmentRecord, users: UserProfile[]): UserProfile | undefined {
  const ownerProfileId = normalizeText(record.ownerProfileId);
  const ownerEmail = normalizeReviewEmail(ownerProfileId);
  const sourceEmail = normalizeReviewEmail(record.sourceEmail);

  if (ownerProfileId) {
    const byId = users.find((profile) => profile.id === ownerProfileId);
    if (byId) return byId;
  }

  const candidateEmails = [sourceEmail, ownerEmail].filter((email): email is string => email !== undefined);
  if (candidateEmails.length === 0) return undefined;

  return users.find((profile) => getProfileEmails(profile).some((email) => candidateEmails.includes(email)));
}

function getRecordSourceEmail(record: ImportAssignmentRecord): string | undefined {
  return normalizeReviewEmail(record.sourceEmail) ?? normalizeReviewEmail(record.ownerProfileId);
}

function isReviewNeeded(record: ImportAssignmentRecord, users: UserProfile[]): boolean {
  const resolvedProfile = resolveImportOwnerProfile(record, users);
  const hasReviewStatus = record.importStatus === 'unassigned'
    || record.importStatus === 'reviewNeeded'
    || record.reconciliationStatus === 'reviewNeeded'
    || record.reconciliationStatus === 'unassigned';
  const hasNoResolvedOwner = !resolvedProfile;
  const hasOwnershipClue = Boolean(record.ownerProfileId || record.sourceEmail);

  return hasReviewStatus || hasNoResolvedOwner || (hasOwnershipClue && !resolvedProfile);
}

function formatDateLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getOfferTitle(offer: CasinoOffer): string {
  return offer.offerCode || offer.offerName || offer.title || offer.shipName || 'Casino offer';
}

function getCruiseTitle(cruise: Cruise | BookedCruise): string {
  return cruise.shipName || cruise.itineraryName || cruise.destination || 'Cruise sailing';
}

function toReviewItem(entity: ImportAssignmentEntity, record: ImportAssignmentRecord): ImportAssignmentReviewItem {
  const sourceEmail = getRecordSourceEmail(record);
  const brand = record.brand ?? record.offerSource ?? record.cruiseSource;

  if (entity === 'offer') {
    const offer = record as CasinoOffer;
    return {
      id: offer.id,
      entity,
      title: getOfferTitle(offer),
      subtitle: [offer.shipName, offer.itineraryName, offer.roomType].filter(Boolean).join(' • ') || 'Imported offer',
      dateLabel: formatDateLabel(offer.sailingDate ?? offer.expires ?? offer.expiryDate),
      sourceEmail,
      ownerProfileId: offer.ownerProfileId,
      brand,
      casinoProgram: offer.casinoProgram,
      importStatus: offer.importStatus,
      reconciliationStatus: offer.reconciliationStatus,
      record,
    };
  }

  if (entity === 'calendarEvent') {
    const event = record as CalendarEvent;
    return {
      id: event.id,
      entity,
      title: event.title || 'Calendar event',
      subtitle: [event.location, event.type].filter(Boolean).join(' • ') || 'Imported calendar event',
      dateLabel: formatDateLabel(event.startDate),
      sourceEmail,
      ownerProfileId: event.ownerProfileId,
      brand,
      casinoProgram: event.casinoProgram,
      importStatus: event.importStatus,
      reconciliationStatus: event.reconciliationStatus,
      record,
    };
  }

  const cruise = record as Cruise | BookedCruise;
  return {
    id: cruise.id,
    entity,
    title: getCruiseTitle(cruise),
    subtitle: [cruise.itineraryName || cruise.destination, `${cruise.nights || 0} nights`, 'reservationNumber' in cruise ? cruise.reservationNumber : undefined].filter(Boolean).join(' • '),
    dateLabel: formatDateLabel(cruise.sailDate),
    sourceEmail,
    ownerProfileId: cruise.ownerProfileId,
    brand,
    casinoProgram: cruise.casinoProgram,
    importStatus: cruise.importStatus,
    reconciliationStatus: cruise.reconciliationStatus,
    record,
  };
}

export function getImportAssignmentReviewItems(input: ImportAssignmentReviewInput): ImportAssignmentReviewItem[] {
  const records: Array<{ entity: ImportAssignmentEntity; items: ImportAssignmentRecord[] }> = [
    { entity: 'offer', items: input.offers as ImportAssignmentRecord[] },
    { entity: 'availableCruise', items: input.cruises as ImportAssignmentRecord[] },
    { entity: 'bookedCruise', items: input.bookedCruises as ImportAssignmentRecord[] },
    { entity: 'calendarEvent', items: input.calendarEvents as ImportAssignmentRecord[] },
  ];

  const reviewItems = records.flatMap(({ entity, items }) => (
    items
      .filter((record) => isReviewNeeded(record, input.users))
      .map((record) => toReviewItem(entity, record))
  ));

  console.log('[ImportAssignmentReview] Built review queue:', {
    offers: input.offers.length,
    cruises: input.cruises.length,
    bookedCruises: input.bookedCruises.length,
    calendarEvents: input.calendarEvents.length,
    reviewItems: reviewItems.length,
  });

  return reviewItems;
}

export function groupImportAssignmentReviewItems(items: ImportAssignmentReviewItem[]): ImportAssignmentReviewGroup[] {
  const groups = new Map<string, ImportAssignmentReviewGroup>();

  items.forEach((item) => {
    const sourceEmail = item.sourceEmail;
    const ownerProfileId = item.ownerProfileId;
    const key = sourceEmail ? `email:${sourceEmail}` : ownerProfileId ? `owner:${ownerProfileId}` : 'missing-owner';
    const label = sourceEmail ?? ownerProfileId ?? 'Missing owner/account';
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    groups.set(key, {
      key,
      label,
      sourceEmail,
      ownerProfileId,
      items: [item],
    });
  });

  return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length);
}

export function buildImportAssignmentPatch(profile: UserProfile): Partial<ImportAssignmentRecord> {
  return {
    ownerProfileId: profile.id,
    sourceEmail: normalizeReviewEmail(profile.email) ?? profile.email,
    importStatus: 'assigned',
    reconciliationStatus: 'matched',
  };
}

export function buildKeepUnassignedPatch(sourceEmail?: string): Partial<ImportAssignmentRecord> {
  return {
    ownerProfileId: undefined,
    sourceEmail,
    importStatus: 'unassigned',
    reconciliationStatus: 'reviewNeeded',
  };
}

export function getEntityLabel(entity: ImportAssignmentEntity): string {
  if (entity === 'offer') return 'Offer';
  if (entity === 'availableCruise') return 'Available cruise';
  if (entity === 'bookedCruise') return 'Booked cruise';
  return 'Calendar event';
}

export function getSuggestedProfileName(email: string): string {
  const localPart = email.split('@')[0] ?? 'Traveler';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Traveler';
}
