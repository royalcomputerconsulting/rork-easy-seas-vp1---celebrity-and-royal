import { 
  ExtendedLoyaltyData, 
  RoyalCaribbeanLoyaltyApiResponse
} from './types';

export function parseLoyaltyApiResponse(response: RoyalCaribbeanLoyaltyApiResponse): ExtendedLoyaltyData | null {
  if (response.status !== 200 || !response.payload?.loyaltyInformation) {
    console.log('[LoyaltyParser] Invalid response or missing loyalty information');
    return null;
  }

  const info = response.payload.loyaltyInformation;
  const accountId = response.payload.accountId;

  const result: ExtendedLoyaltyData = {
    accountId,
    
    crownAndAnchorLevel: formatTierName(info.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorPoints: info.crownAndAnchorSocietyLoyaltyIndividualPoints?.toString(),
    clubRoyaleTier: formatTierName(info.clubRoyaleLoyaltyTier),
    clubRoyalePoints: info.clubRoyaleLoyaltyIndividualPoints?.toString(),
    
    captainsClubId: info.captainsClubId,
    captainsClubTier: formatTierName(info.captainsClubLoyaltyTier),
    captainsClubPoints: info.captainsClubLoyaltyIndividualPoints,
    captainsClubNextTier: formatTierName(info.captainsClubNextTier),
    captainsClubRemainingPoints: info.captainsClubRemainingPoints,
    captainsClubTrackerPercentage: info.captainsClubTrackerPercentage,
    
    celebrityBlueChipTier: formatTierName(info.celebrityBlueChipLoyaltyTier),
    celebrityBlueChipPoints: info.celebrityBlueChipLoyaltyIndividualPoints,
    
    clubRoyaleTierFromApi: formatTierName(info.clubRoyaleLoyaltyTier),
    clubRoyalePointsFromApi: info.clubRoyaleLoyaltyIndividualPoints,
    
    crownAndAnchorId: info.crownAndAnchorId,
    crownAndAnchorTier: formatTierName(info.crownAndAnchorSocietyLoyaltyTier),
    crownAndAnchorPointsFromApi: info.crownAndAnchorSocietyLoyaltyIndividualPoints,
    crownAndAnchorNextTier: formatTierName(info.crownAndAnchorSocietyNextTier),
    crownAndAnchorRemainingPoints: info.crownAndAnchorSocietyRemainingPoints,
    crownAndAnchorTrackerPercentage: info.crownAndAnchorTrackerPercentage,
    
    venetianSocietyTier: info.venetianSocietyLoyaltyTier,
    venetianSocietyNextTier: info.venetianSocietyNextTier,
    venetianSocietyMemberNumber: info.vsMemberNumber,
    venetianSocietyEnrolled: info.venetianSocietyEnrollmentSubmitted,
    
    hasCoBrandCard: response.payload.coBrandCardInfo?.activeCardHolder ?? false,
  };

  console.log('[LoyaltyParser] Parsed loyalty data:', {
    accountId: result.accountId,
    clubRoyale: {
      tier: result.clubRoyaleTierFromApi,
      points: result.clubRoyalePointsFromApi,
    },
    crownAndAnchor: {
      tier: result.crownAndAnchorTier,
      points: result.crownAndAnchorPointsFromApi,
      nextTier: result.crownAndAnchorNextTier,
      remainingPoints: result.crownAndAnchorRemainingPoints,
    },
    captainsClub: {
      tier: result.captainsClubTier,
      points: result.captainsClubPoints,
      nextTier: result.captainsClubNextTier,
    },
    venetianSociety: {
      tier: result.venetianSocietyTier,
      enrolled: result.venetianSocietyEnrolled,
    },
  });

  return result;
}

function formatTierName(tier: string | undefined): string | undefined {
  if (!tier) return undefined;
  
  return tier
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function parseLoyaltyFromRawJson(jsonString: string): ExtendedLoyaltyData | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (parsed.payload?.loyaltyInformation) {
      return parseLoyaltyApiResponse(parsed as RoyalCaribbeanLoyaltyApiResponse);
    }
    
    console.log('[LoyaltyParser] Unrecognized JSON structure');
    return null;
  } catch (error) {
    console.error('[LoyaltyParser] Failed to parse JSON:', error);
    return null;
  }
}

export function mapCrownAnchorTierToLevel(tier: string | undefined): string {
  if (!tier) return 'Gold';
  
  const tierMap: Record<string, string> = {
    'gold': 'Gold',
    'platinum': 'Platinum',
    'emerald': 'Emerald',
    'diamond': 'Diamond',
    'diamond plus': 'Diamond Plus',
    'diamond+': 'Diamond Plus',
    'pinnacle': 'Pinnacle',
    'pinnacle club': 'Pinnacle',
  };
  
  const normalized = tier.toLowerCase().trim();
  return tierMap[normalized] || tier;
}

export function mapClubRoyaleTierToTier(tier: string | undefined): string {
  if (!tier) return 'Choice';
  
  const tierMap: Record<string, string> = {
    'choice': 'Choice',
    'select': 'Select',
    'select plus': 'Select Plus',
    'select+': 'Select Plus',
    'prime': 'Prime',
    'prime plus': 'Prime Plus',
    'prime+': 'Prime Plus',
    'signature': 'Signature',
    'masters': 'Masters',
  };
  
  const normalized = tier.toLowerCase().trim();
  return tierMap[normalized] || tier;
}
