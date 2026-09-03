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

export function recordBelongsToProfile<T extends object>(record: T, profile: UserProfile | null | undefined, profiles: UserProfile[] = []): boolean {
  if (!profile) return true;
  const ownedRecord = record as T & ProfileOwnedRecord;
  const owner = norm(ownedRecord.ownerProfileId);
  const sourceEmail = normEmail(ownedRecord.sourceEmail) ?? normEmail(ownedRecord.ownerEmail) ?? normEmail(ownedRecord.dataOwnerEmail) ?? normEmail(ownedRecord.ownerProfileId);
  const profileId = norm(profile.id);
  const profileEmails = getProfileIdentityEmails(profile);

  if (owner && owner === profileId) return true;
  if (sourceEmail && profileEmails.includes(sourceEmail)) return true;

  const otherProfiles = profiles.filter((candidate) => candidate.id !== profile.id);
  const ownedByOtherProfileId = owner && otherProfiles.some((candidate) => norm(candidate.id) === owner);
  const ownedByOtherEmail = sourceEmail && otherProfiles.some((candidate) => getProfileIdentityEmails(candidate).includes(sourceEmail));
  if (ownedByOtherProfileId || ownedByOtherEmail) return false;

  const name = norm(profile.name || profile.displayName);
  const guestHaystack = [
    ...(Array.isArray(ownedRecord.guestNames) ? ownedRecord.guestNames : []),
    ...(Array.isArray(ownedRecord.passengerNames) ? ownedRecord.passengerNames : []),
    typeof ownedRecord.guests === 'string' ? ownedRecord.guests : '',
    ownedRecord.primaryGuestName || '',
  ].map(norm).join(' ');
  const currentProfileNamed = name.length > 1 && guestHaystack.includes(name);
  if (currentProfileNamed) return true;

  // Guest/passenger attribution is stronger than the legacy-primary fallback.
  // Without this check, an old reservation that names only a secondary traveler
  // would also leak into the primary traveler's private list merely because it
  // predates ownerProfileId.
  const namesAnotherProfile = guestHaystack.length > 0 && otherProfiles.some((candidate) => {
    const candidateName = norm(candidate.name || candidate.displayName);
    return candidateName.length > 1 && guestHaystack.includes(candidateName);
  });
  if (namesAnotherProfile) return false;

  const isPrimary = isPrimaryProfile(profile);
  if (isPrimary) {
    // Truly unattributed legacy app data belongs to the primary traveler only.
    return !owner && !sourceEmail;
  }

  // Secondary travelers must always be explicitly assigned or named.
  return false;
}

export function filterRecordsForProfile<T extends object>(records: T[], profile: UserProfile | null | undefined, profiles: UserProfile[] = []): T[] {
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
