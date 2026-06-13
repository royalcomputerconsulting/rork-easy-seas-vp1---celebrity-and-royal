import type { CasinoProgram, ImportReviewStatus, TravelBrand } from '@/types/models';
import type { BrandFilterValue, ProfileFilterValue, ProgramFilterValue } from '@/state/IntelligenceFiltersProvider';
import type { UserProfile } from '@/state/UserProvider';

export interface IntelligenceFilterStateSnapshot {
  selectedProfileId: ProfileFilterValue;
  selectedBrand: BrandFilterValue;
  selectedProgram: ProgramFilterValue;
}

type FilterableRecord = {
  ownerProfileId?: string;
  sourceEmail?: string;
  brand?: TravelBrand | string;
  casinoProgram?: CasinoProgram;
  cruiseSource?: string;
  offerSource?: string;
  shipName?: string;
  cruiseLines?: string[];
  importStatus?: ImportReviewStatus;
  reconciliationStatus?: ImportReviewStatus;
};

const BRAND_LABELS: Record<string, string> = {
  royal: 'Royal Caribbean',
  celebrity: 'Celebrity',
  carnival: 'Carnival',
  silversea: 'Silversea',
  unknown: 'Unknown brand',
};

const PROGRAM_LABELS: Record<string, string> = {
  clubRoyale: 'Club Royale',
  blueChip: 'Blue Chip',
  playersClub: 'Players Club',
  venetianSociety: 'Venetian Society',
  none: 'No casino program',
  unknown: 'Unknown program',
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalize(value);
  return normalized.includes('@') ? normalized : null;
}

export function getProfileDisplayName(profile: UserProfile | undefined): string {
  if (!profile) return 'Unknown profile';
  return profile.displayName || profile.name || profile.email || 'Traveler';
}

export function getBrandLabel(brand: BrandFilterValue | string): string {
  if (brand === 'all') return 'All brands';
  return BRAND_LABELS[brand] ?? brand;
}

export function getProgramLabel(program: ProgramFilterValue | string): string {
  if (program === 'all') return 'All programs';
  return PROGRAM_LABELS[program] ?? program;
}

export function getProfileScopeLabel(profileId: ProfileFilterValue, profiles: UserProfile[]): string {
  if (profileId === 'all') return 'All Profiles';
  if (profileId === 'unassigned') {
    const fallbackProfile = getSecondProfileForUnassignedRecords(profiles);
    return fallbackProfile ? getProfileDisplayName(fallbackProfile) : 'Unassigned Imports';
  }
  return getProfileDisplayName(profiles.find((profile) => profile.id === profileId));
}

export function buildIntelligenceScopeLabel(filters: IntelligenceFilterStateSnapshot, profiles: UserProfile[]): string {
  return `Profile: ${getProfileScopeLabel(filters.selectedProfileId, profiles)} • Brand: ${getBrandLabel(filters.selectedBrand)} • Program: ${getProgramLabel(filters.selectedProgram)}`;
}

export function getBrandProgramSystemLabel(brand: BrandFilterValue | string, program: ProgramFilterValue | string): string {
  const brandLabel = getBrandLabel(brand);
  const programLabel = getProgramLabel(program);
  if (brand === 'all' && program === 'all') return 'Royal/Celebrity casino programs';
  if (brand === 'royal' || program === 'clubRoyale') return 'Royal Caribbean / Club Royale';
  if (brand === 'celebrity' || program === 'blueChip') return 'Celebrity / Blue Chip';
  return `${brandLabel} / ${programLabel}`;
}

export function inferRecordBrand(record: FilterableRecord): TravelBrand | 'unknown' {
  const explicit = normalize(record.brand || record.cruiseSource || record.offerSource);
  if (explicit.includes('celebrity')) return 'celebrity';
  if (explicit.includes('royal')) return 'royal';
  if (explicit.includes('carnival')) return 'carnival';
  if (explicit.includes('silversea')) return 'silversea';

  const cruiseLines = Array.isArray(record.cruiseLines) ? record.cruiseLines.map(normalize).join(' ') : '';
  const shipName = normalize(record.shipName);
  const haystack = `${cruiseLines} ${shipName}`;
  if (haystack.includes('celebrity')) return 'celebrity';
  if (haystack.includes('royal')) return 'royal';
  if (haystack.includes('carnival')) return 'carnival';
  if (haystack.includes('silversea')) return 'silversea';
  return 'unknown';
}

export function inferRecordProgram(record: FilterableRecord): CasinoProgram {
  if (record.casinoProgram) return record.casinoProgram;
  const brand = inferRecordBrand(record);
  if (brand === 'celebrity') return 'blueChip';
  if (brand === 'royal') return 'clubRoyale';
  if (brand === 'carnival') return 'playersClub';
  if (brand === 'silversea') return 'venetianSociety';
  return 'unknown';
}

function getProfileEmails(profile: UserProfile): string[] {
  return [profile.email, profile.celebrityEmail, profile.silverseaEmail]
    .map(normalizeEmail)
    .filter((email): email is string => email !== null);
}

/**
 * Legacy unassigned records must not be auto-assigned to a second traveler.
 * Older builds treated unowned rows as the second user, which leaked the primary user's cruises/status.
 */
export function getSecondProfileForUnassignedRecords(_profiles: UserProfile[]): UserProfile | undefined {
  return undefined;
}

function getMatchedProfile(record: FilterableRecord, profiles: UserProfile[]): UserProfile | undefined {
  const ownerProfileId = normalize(record.ownerProfileId);
  const ownerEmail = normalizeEmail(record.ownerProfileId);
  const recordEmail = normalizeEmail(record.sourceEmail);

  if (ownerProfileId) {
    const byId = profiles.find((profile) => profile.id === ownerProfileId);
    if (byId) return byId;
  }

  const candidateEmails = [recordEmail, ownerEmail].filter((email): email is string => email !== null);
  if (candidateEmails.length === 0) return undefined;

  return profiles.find((profile) => getProfileEmails(profile).some((email) => candidateEmails.includes(email)));
}

export function getRecordOwnerLabel(record: FilterableRecord, profiles: UserProfile[]): string {
  const matchedProfile = getMatchedProfile(record, profiles);
  if (matchedProfile) return getProfileDisplayName(matchedProfile);

  const recordEmail = normalizeEmail(record.sourceEmail) ?? normalizeEmail(record.ownerProfileId);
  if (recordEmail) return recordEmail;

  const fallbackProfile = getSecondProfileForUnassignedRecords(profiles);
  return fallbackProfile ? getProfileDisplayName(fallbackProfile) : 'Unassigned';
}

function recordMatchesProfile(record: FilterableRecord, selectedProfileId: ProfileFilterValue, profiles: UserProfile[]): boolean {
  if (selectedProfileId === 'all') return true;

  const matchedProfile = getMatchedProfile(record, profiles);

  if (selectedProfileId === 'unassigned') {
    return !matchedProfile;
  }

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  if (!selectedProfile) return true;

  if (matchedProfile) return matchedProfile.id === selectedProfile.id;
  return selectedProfile.isOwner === true || selectedProfile.defaultProfile === true;
}

export function recordMatchesIntelligenceFilters(record: FilterableRecord, filters: IntelligenceFilterStateSnapshot, profiles: UserProfile[]): boolean {
  const profileMatches = recordMatchesProfile(record, filters.selectedProfileId, profiles);
  const brandMatches = filters.selectedBrand === 'all' || inferRecordBrand(record) === filters.selectedBrand;
  const programMatches = filters.selectedProgram === 'all' || inferRecordProgram(record) === filters.selectedProgram;
  return profileMatches && brandMatches && programMatches;
}

export function filterRecordsByIntelligence<T extends FilterableRecord>(records: T[], filters: IntelligenceFilterStateSnapshot, profiles: UserProfile[]): T[] {
  const filtered = records.filter((record) => recordMatchesIntelligenceFilters(record, filters, profiles));
  console.log('[IntelligenceFilters] Filtered records:', {
    input: records.length,
    output: filtered.length,
    selectedProfileId: filters.selectedProfileId,
    selectedBrand: filters.selectedBrand,
    selectedProgram: filters.selectedProgram,
  });
  return filtered;
}
