import { convertLoyaltyInfoToExtended } from '../lib/royalCaribbean/loyaltyConverter';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const royalOffersPayload = {
  message: 'ok',
  data: {
    cards: [
      { programName: 'Club Royale', tierStatus: 'Signature', currentTierCredits: '19,363' },
    ],
  },
};
const myAccountPayload = {
  payload: {
    loyaltyInformation: {
      memberships: [
        { programName: 'Crown & Anchor Society', tierName: 'Diamond Plus', cruisePoints: 646, memberNumber: '305812247' },
      ],
    },
  },
};
const combinedPayload = {
  data: {
    loyaltyPrograms: [
      { programName: "Captain's Club", tierName: 'Elite Plus', points: 777 },
      { programName: 'Blue Chip Club', tierName: 'Amethyst', tierCredits: 888 },
    ],
  },
};

const royal = convertLoyaltyInfoToExtended(royalOffersPayload as any);
assert(royal.clubRoyaleTierFromApi === 'Signature', 'Club Royale tier should parse from offers casino payload');
assert(royal.clubRoyalePointsFromApi === 19363, 'Club Royale current tier credits should parse as 19,363');

const myAccount = convertLoyaltyInfoToExtended(myAccountPayload as any);
assert(myAccount.crownAndAnchorTier === 'Diamond Plus', 'Crown & Anchor Diamond Plus should parse from My Account payload');
assert(myAccount.crownAndAnchorPointsFromApi === 646, 'Crown & Anchor cruise points should parse as 646');

const celebrity = convertLoyaltyInfoToExtended(combinedPayload as any);
assert(celebrity.captainsClubTier === 'Elite Plus', 'Captain\'s Club should parse separately');
assert(celebrity.captainsClubPoints === 777, 'Captain\'s Club points should parse separately');
assert(celebrity.celebrityBlueChipTier === 'Amethyst', 'Blue Chip tier should parse separately');
assert(celebrity.celebrityBlueChipPoints === 888, 'Blue Chip points should parse separately');

console.log('✅ v1054 loyalty program runtime checks passed');
