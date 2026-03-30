import { ExtendedLoyaltyData, LoyaltyApiInformation, RoyalCaribbeanLoyaltyApiResponse } from './types';

function getValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/,/g, '').trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return undefined;
}

function buildExtendedLoyaltyData(
  input: LoyaltyApiInformation | Record<string, unknown> | null | undefined,
  accountId?: string
): ExtendedLoyaltyData {
  const loyalty = (input ?? {}) as Record<string, unknown>;

  const crownAndAnchorTierRaw = toStringValue(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyTier',
    'crownAndAnchorTier',
    'crownAnchorTier',
    'crownAndAnchorLevel',
  ]));
  const crownAndAnchorPointsRaw = toNumber(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyIndividualPoints',
    'crownAndAnchorPoints',
    'crownAnchorPoints',
    'crownAndAnchorSocietyPoints',
  ]));
  const crownAndAnchorRelationshipPointsRaw = toNumber(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyRelationshipPoints',
    'crownAndAnchorRelationshipPoints',
  ]));

  const clubRoyaleTierRaw = toStringValue(getValue(loyalty, [
    'clubRoyaleLoyaltyTier',
    'clubRoyaleTier',
    'clubRoyalTier',
  ]));
  const clubRoyalePointsRaw = toNumber(getValue(loyalty, [
    'clubRoyaleLoyaltyIndividualPoints',
    'clubRoyalePoints',
    'clubRoyalPoints',
    'clubRoyaleCurrentPoints',
  ]));
  const clubRoyaleRelationshipPointsRaw = toNumber(getValue(loyalty, [
    'clubRoyaleLoyaltyRelationshipPoints',
    'clubRoyaleRelationshipPoints',
  ]));

  const captainsClubTierRaw = toStringValue(getValue(loyalty, [
    'captainsClubLoyaltyTier',
    'captainsClubTier',
  ]));
  const captainsClubPointsRaw = toNumber(getValue(loyalty, [
    'captainsClubLoyaltyIndividualPoints',
    'captainsClubPoints',
  ]));

  const celebrityBlueChipTierRaw = toStringValue(getValue(loyalty, [
    'celebrityBlueChipLoyaltyTier',
    'celebrityBlueChipTier',
  ]));
  const celebrityBlueChipPointsRaw = toNumber(getValue(loyalty, [
    'celebrityBlueChipLoyaltyIndividualPoints',
    'celebrityBlueChipPoints',
  ]));

  return {
    accountId,
    crownAndAnchorId: toStringValue(loyalty.crownAndAnchorId),
    crownAndAnchorLevel: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorTier: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorPoints: crownAndAnchorPointsRaw?.toString(),
    crownAndAnchorPointsFromApi: crownAndAnchorPointsRaw,
    crownAndAnchorRelationshipPointsFromApi: crownAndAnchorRelationshipPointsRaw,
    crownAndAnchorNextTier: formatTierName(toStringValue(loyalty.crownAndAnchorSocietyNextTier)),
    crownAndAnchorRemainingPoints: toNumber(loyalty.crownAndAnchorSocietyRemainingPoints),
    crownAndAnchorTrackerPercentage: toNumber(loyalty.crownAndAnchorTrackerPercentage),
    crownAndAnchorLoyaltyMatchTier: toStringValue(loyalty.crownAndAnchorLoyaltyMatchTier),

    clubRoyaleTier: formatTierName(clubRoyaleTierRaw),
    clubRoyaleTierFromApi: formatTierName(clubRoyaleTierRaw),
    clubRoyalePoints: clubRoyalePointsRaw?.toString(),
    clubRoyalePointsFromApi: clubRoyalePointsRaw,
    clubRoyaleRelationshipPointsFromApi: clubRoyaleRelationshipPointsRaw,

    captainsClubId: toStringValue(loyalty.captainsClubId),
    captainsClubTier: formatTierName(captainsClubTierRaw),
    captainsClubPoints: captainsClubPointsRaw,
    captainsClubRelationshipPoints: toNumber(loyalty.captainsClubLoyaltyRelationshipPoints),
    captainsClubNextTier: formatTierName(toStringValue(loyalty.captainsClubNextTier)),
    captainsClubRemainingPoints: toNumber(loyalty.captainsClubRemainingPoints),
    captainsClubTrackerPercentage: toNumber(loyalty.captainsClubTrackerPercentage),
    captainsClubLoyaltyMatchTier: toStringValue(loyalty.captainsClubLoyaltyMatchTier),

    celebrityBlueChipTier: formatTierName(celebrityBlueChipTierRaw),
    celebrityBlueChipPoints: celebrityBlueChipPointsRaw,
    celebrityBlueChipRelationshipPoints: toNumber(loyalty.celebrityBlueChipLoyaltyRelationshipPoints),

    venetianSocietyTier: toStringValue(loyalty.venetianSocietyLoyaltyTier),
    venetianSocietyNextTier: toStringValue(loyalty.venetianSocietyNextTier),
    venetianSocietyMemberNumber: toStringValue(loyalty.vsMemberNumber),
    venetianSocietyEnrolled: typeof loyalty.venetianSocietyEnrollmentSubmitted === 'boolean' ? loyalty.venetianSocietyEnrollmentSubmitted : undefined,
    venetianSocietyLoyaltyMatchTier: toStringValue(loyalty.venetianSocietyLoyaltyMatchTier),
  };
}

export function convertApiLoyaltyToExtended(
  apiResponse: RoyalCaribbeanLoyaltyApiResponse
): ExtendedLoyaltyData {
  const payload = apiResponse?.payload;
  const loyalty = payload?.loyaltyInformation as LoyaltyApiInformation | undefined;
  const baseData = buildExtendedLoyaltyData(loyalty, payload?.accountId);

  return {
    ...baseData,
    hasCoBrandCard: payload?.coBrandCardInfo?.activeCardHolder,
    coBrandCardStatus: payload?.coBrandCardInfo?.status,
    coBrandCardErrorMessage: payload?.coBrandCardInfo?.errorMessage,
  };
}

export function convertLoyaltyInfoToExtended(
  loyalty: LoyaltyApiInformation,
  accountId?: string
): ExtendedLoyaltyData {
  return buildExtendedLoyaltyData(loyalty, accountId);
}

function formatTierName(tier: string | undefined): string | undefined {
  if (!tier) return undefined;
  
  return tier
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function hasLoyaltyChanges(
  extendedData: ExtendedLoyaltyData,
  currentLoyalty: {
    clubRoyalePoints: number;
    clubRoyaleTier: string;
    crownAnchorPoints: number;
    crownAnchorLevel: string;
  }
): boolean {
  const newClubRoyalePoints = extendedData.clubRoyalePointsFromApi ?? 0;
  const newCrownAnchorPoints = extendedData.crownAndAnchorPointsFromApi ?? 0;

  const pointsChanged = newClubRoyalePoints !== currentLoyalty.clubRoyalePoints ||
    newCrownAnchorPoints !== currentLoyalty.crownAnchorPoints;
  
  const tierChanged = (extendedData.clubRoyaleTierFromApi != null && 
    extendedData.clubRoyaleTierFromApi !== currentLoyalty.clubRoyaleTier) ||
    (extendedData.crownAndAnchorTier != null && 
    extendedData.crownAndAnchorTier !== currentLoyalty.crownAnchorLevel);

  return pointsChanged || tierChanged;
}
