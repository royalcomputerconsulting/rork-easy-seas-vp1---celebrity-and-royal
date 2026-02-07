import { ExtendedLoyaltyData, LoyaltyApiInformation, RoyalCaribbeanLoyaltyApiResponse } from './types';

export function convertApiLoyaltyToExtended(
  apiResponse: RoyalCaribbeanLoyaltyApiResponse
): ExtendedLoyaltyData {
  const { payload } = apiResponse;
  const loyalty = payload.loyaltyInformation;

  const extendedData: ExtendedLoyaltyData = {
    accountId: payload.accountId,

    // Crown & Anchor Society (Royal Caribbean cruise loyalty)
    crownAndAnchorId: loyalty.crownAndAnchorId,
    crownAndAnchorLevel: formatTierName(loyalty.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorTier: formatTierName(loyalty.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorPoints: loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints?.toString(),
    crownAndAnchorPointsFromApi: loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints,
    crownAndAnchorRelationshipPointsFromApi: loyalty.crownAndAnchorSocietyLoyaltyRelationshipPoints,
    crownAndAnchorNextTier: formatTierName(loyalty.crownAndAnchorSocietyNextTier),
    crownAndAnchorRemainingPoints: loyalty.crownAndAnchorSocietyRemainingPoints,
    crownAndAnchorTrackerPercentage: loyalty.crownAndAnchorTrackerPercentage,
    crownAndAnchorLoyaltyMatchTier: loyalty.crownAndAnchorLoyaltyMatchTier,

    // Club Royale (Casino loyalty)
    clubRoyaleTier: formatTierName(loyalty.clubRoyaleLoyaltyTier),
    clubRoyaleTierFromApi: formatTierName(loyalty.clubRoyaleLoyaltyTier),
    clubRoyalePoints: loyalty.clubRoyaleLoyaltyIndividualPoints?.toString(),
    clubRoyalePointsFromApi: loyalty.clubRoyaleLoyaltyIndividualPoints,
    clubRoyaleRelationshipPointsFromApi: loyalty.clubRoyaleLoyaltyRelationshipPoints,

    // Captain's Club (Celebrity cruise loyalty)
    captainsClubId: loyalty.captainsClubId,
    captainsClubTier: formatTierName(loyalty.captainsClubLoyaltyTier),
    captainsClubPoints: loyalty.captainsClubLoyaltyIndividualPoints,
    captainsClubRelationshipPoints: loyalty.captainsClubLoyaltyRelationshipPoints,
    captainsClubNextTier: formatTierName(loyalty.captainsClubNextTier),
    captainsClubRemainingPoints: loyalty.captainsClubRemainingPoints,
    captainsClubTrackerPercentage: loyalty.captainsClubTrackerPercentage,
    captainsClubLoyaltyMatchTier: loyalty.captainsClubLoyaltyMatchTier,

    // Celebrity Blue Chip (Celebrity casino loyalty)
    celebrityBlueChipTier: formatTierName(loyalty.celebrityBlueChipLoyaltyTier),
    celebrityBlueChipPoints: loyalty.celebrityBlueChipLoyaltyIndividualPoints,
    celebrityBlueChipRelationshipPoints: loyalty.celebrityBlueChipLoyaltyRelationshipPoints,

    // Venetian Society
    venetianSocietyTier: loyalty.venetianSocietyLoyaltyTier,
    venetianSocietyNextTier: loyalty.venetianSocietyNextTier,
    venetianSocietyMemberNumber: loyalty.vsMemberNumber,
    venetianSocietyEnrolled: loyalty.venetianSocietyEnrollmentSubmitted,
    venetianSocietyLoyaltyMatchTier: loyalty.venetianSocietyLoyaltyMatchTier,

    // Co-brand card
    hasCoBrandCard: payload.coBrandCardInfo?.activeCardHolder,
    coBrandCardStatus: payload.coBrandCardInfo?.status,
    coBrandCardErrorMessage: payload.coBrandCardInfo?.errorMessage,
  };

  return extendedData;
}

export function convertLoyaltyInfoToExtended(
  loyalty: LoyaltyApiInformation,
  accountId?: string
): ExtendedLoyaltyData {
  const extendedData: ExtendedLoyaltyData = {
    accountId,

    // Crown & Anchor Society (Royal Caribbean cruise loyalty)
    crownAndAnchorId: loyalty.crownAndAnchorId,
    crownAndAnchorLevel: formatTierName(loyalty.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorTier: formatTierName(loyalty.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorPoints: loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints?.toString(),
    crownAndAnchorPointsFromApi: loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints,
    crownAndAnchorRelationshipPointsFromApi: loyalty.crownAndAnchorSocietyLoyaltyRelationshipPoints,
    crownAndAnchorNextTier: formatTierName(loyalty.crownAndAnchorSocietyNextTier),
    crownAndAnchorRemainingPoints: loyalty.crownAndAnchorSocietyRemainingPoints,
    crownAndAnchorTrackerPercentage: loyalty.crownAndAnchorTrackerPercentage,
    crownAndAnchorLoyaltyMatchTier: loyalty.crownAndAnchorLoyaltyMatchTier,

    // Club Royale (Casino loyalty)
    clubRoyaleTier: formatTierName(loyalty.clubRoyaleLoyaltyTier),
    clubRoyaleTierFromApi: formatTierName(loyalty.clubRoyaleLoyaltyTier),
    clubRoyalePoints: loyalty.clubRoyaleLoyaltyIndividualPoints?.toString(),
    clubRoyalePointsFromApi: loyalty.clubRoyaleLoyaltyIndividualPoints,
    clubRoyaleRelationshipPointsFromApi: loyalty.clubRoyaleLoyaltyRelationshipPoints,

    // Captain's Club (Celebrity cruise loyalty)
    captainsClubId: loyalty.captainsClubId,
    captainsClubTier: formatTierName(loyalty.captainsClubLoyaltyTier),
    captainsClubPoints: loyalty.captainsClubLoyaltyIndividualPoints,
    captainsClubRelationshipPoints: loyalty.captainsClubLoyaltyRelationshipPoints,
    captainsClubNextTier: formatTierName(loyalty.captainsClubNextTier),
    captainsClubRemainingPoints: loyalty.captainsClubRemainingPoints,
    captainsClubTrackerPercentage: loyalty.captainsClubTrackerPercentage,
    captainsClubLoyaltyMatchTier: loyalty.captainsClubLoyaltyMatchTier,

    // Celebrity Blue Chip (Celebrity casino loyalty)
    celebrityBlueChipTier: formatTierName(loyalty.celebrityBlueChipLoyaltyTier),
    celebrityBlueChipPoints: loyalty.celebrityBlueChipLoyaltyIndividualPoints,
    celebrityBlueChipRelationshipPoints: loyalty.celebrityBlueChipLoyaltyRelationshipPoints,

    // Venetian Society
    venetianSocietyTier: loyalty.venetianSocietyLoyaltyTier,
    venetianSocietyNextTier: loyalty.venetianSocietyNextTier,
    venetianSocietyMemberNumber: loyalty.vsMemberNumber,
    venetianSocietyEnrolled: loyalty.venetianSocietyEnrollmentSubmitted,
    venetianSocietyLoyaltyMatchTier: loyalty.venetianSocietyLoyaltyMatchTier,
  };

  return extendedData;
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
