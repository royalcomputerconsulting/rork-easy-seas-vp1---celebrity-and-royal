import type { UserProfile } from '@/state/UserProvider';

type ProfileOwnedRecord = {
  ownerProfileId?: string;
  sourceEmail?: string;
  ownerEmail?: string;
  dataOwnerEmail?: string;
  dataOwnerScopeId?: string;
  guestNames?: string[];
  guests?: unknown;
  passengerNames?: string[];
  primaryGuestName?: string;
};

function norm(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function normEmail(value: unknown): string | null {
  const v = norm(value);
  return v.includes('@') ? v : null;
}

export function isPrimaryProfile(profile: UserProfile | null | undefined): boolean {
  return !profile || profile.isOwner === true || profile.defaultProfile === true;
}

export function getProfileIdentityEmails(profile: UserProfile | null | undefined): string[] {
  if (!profile) return [];
  return [profile.email, profile.celebrityEmail, profile.silverseaEmail]
    .map(normEmail)
    .filter((email): email is string => email !== null);
}

export function profileHasRoyalIdentity(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return [profile.crownAnchorNumber, profile.royalCaribbeanNumber, profile.clubRoyaleId]
    .some((value) => norm(value).length > 0)
    || Number(profile.loyaltyPoints || 0) > 0
    || Number(profile.clubRoyalePoints || 0) > 0
    || norm(profile.crownAnchorLevel).length > 0
    || norm(profile.clubRoyaleTier).length > 0;
}

export function profileHasCasinoIdentity(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return profileHasRoyalIdentity(profile)
    || [profile.celebrityCaptainsClubNumber, profile.blueChipId, profile.silverseaVenetianNumber, profile.carnivalVifpNumber]
      .some((value) => norm(value).length > 0)
    || Number(profile.celebrityCaptainsClubPoints || 0) > 0
    || Number(profile.celebrityBlueChipPoints || 0) > 0
    || Number(profile.silverseaVenetianPoints || 0) > 0
    || Number(profile.carnivalPlayersClubPoints || 0) > 0;
}

export function recordBelongsToProfile<T extends ProfileOwnedRecord>(record: T, profile: UserProfile | null | undefined, profiles: UserProfile[] = []): boolean {
  if (!profile) return true;
  const owner = norm(record.ownerProfileId);
  const sourceEmail = normEmail(record.sourceEmail) ?? normEmail(record.ownerEmail) ?? normEmail(record.dataOwnerEmail) ?? normEmail(record.ownerProfileId);
  const profileId = norm(profile.id);
  const profileEmails = getProfileIdentityEmails(profile);

  if (owner && owner === profileId) return true;
  if (sourceEmail && profileEmails.includes(sourceEmail)) return true;

  const otherProfiles = profiles.filter((candidate) => candidate.id !== profile.id);
  const ownedByOtherProfileId = owner && otherProfiles.some((candidate) => norm(candidate.id) === owner);
  const ownedByOtherEmail = sourceEmail && otherProfiles.some((candidate) => getProfileIdentityEmails(candidate).includes(sourceEmail));
  if (ownedByOtherProfileId || ownedByOtherEmail) return false;

  const isPrimary = isPrimaryProfile(profile);
  if (isPrimary) {
    // Legacy app data before profile ownership belongs to the primary traveler only.
    return !owner && !sourceEmail;
  }

  // Secondary travelers must be explicitly assigned or match by guest/passenger name.
  const name = norm(profile.name || profile.displayName);
  const guestHaystack = [
    ...(Array.isArray(record.guestNames) ? record.guestNames : []),
    ...(Array.isArray(record.passengerNames) ? record.passengerNames : []),
    typeof record.guests === 'string' ? record.guests : '',
    record.primaryGuestName || '',
  ].map(norm).join(' ');
  return name.length > 1 && guestHaystack.includes(name);
}

export function filterRecordsForProfile<T extends ProfileOwnedRecord>(records: T[], profile: UserProfile | null | undefined, profiles: UserProfile[] = []): T[] {
  return records.filter((record) => recordBelongsToProfile(record, profile, profiles));
}

export function stampRecordForProfile<T extends object>(record: T, profile: UserProfile | null | undefined): T {
  if (!profile) return record;
  return {
    ...record,
    ownerProfileId: (record as any).ownerProfileId || profile.id,
    sourceEmail: (record as any).sourceEmail || profile.email,
    ownerProfileName: (record as any).ownerProfileName || profile.displayName || profile.name,
    profileType: profile.isOwner || profile.defaultProfile ? 'primary' : 'secondary',
  } as T;
}

export function stampRecordsForProfile<T extends object>(records: T[], profile: UserProfile | null | undefined): T[] {
  return records.map((record) => stampRecordForProfile(record, profile));
}
