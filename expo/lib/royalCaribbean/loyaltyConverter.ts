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



function normalizeKeyName(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function unwrapLoyaltyEnvelope(input: unknown): Record<string, unknown> {
  let current = (input ?? {}) as Record<string, unknown>;
  for (let i = 0; i < 6; i += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break;
    const record = current as Record<string, unknown>;
    const next =
      record.loyaltyInformation ??
      record.loyaltyInfo ??
      record.loyaltyData ??
      record.payload ??
      record.data ??
      record.result ??
      record.response;
    if (!next || next === current || typeof next !== 'object' || Array.isArray(next)) break;
    current = next as Record<string, unknown>;
  }
  return (current ?? {}) as Record<string, unknown>;
}

function collectRecords(value: unknown, depth: number = 0, output: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (depth > 6 || value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRecords(item, depth + 1, output));
    return output;
  }
  if (typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  output.push(record);
  Object.values(record).forEach((child) => {
    if (child && typeof child === 'object') collectRecords(child, depth + 1, output);
  });
  return output;
}

function recordText(record: Record<string, unknown>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}:${typeof value === 'object' ? '' : String(value)}`)
    .join(' ')
    .toLowerCase();
}

function findProgramRecord(raw: unknown, keywords: string[]): Record<string, unknown> | null {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const records = collectRecords(raw);
  return records.find((record) => {
    const text = recordText(record);
    return normalizedKeywords.some((keyword) => text.includes(keyword));
  }) ?? null;
}

function getValueDeep(source: Record<string, unknown>, keys: string[]): unknown {
  const direct = getValue(source, keys);
  if (direct !== undefined) return direct;
  const normalizedKeys = keys.map(normalizeKeyName);
  const records = collectRecords(source);
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (value === undefined || value === null || value === '') continue;
      const normalized = normalizeKeyName(key);
      if (normalizedKeys.includes(normalized)) return value;
    }
  }
  return undefined;
}

function getProgramValue(raw: unknown, programKeywords: string[], keys: string[]): unknown {
  const record = findProgramRecord(raw, programKeywords);
  if (!record) return undefined;
  return getValueDeep(record, keys);
}

function firstKnownNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function firstKnownString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = toStringValue(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function getCrownAnchorTierThreshold(tier?: string): number | undefined {
  const formatted = formatTierName(tier);
  const thresholds: Record<string, number> = {
    Gold: 3,
    Platinum: 30,
    Emerald: 55,
    Diamond: 80,
    'Diamond Plus': 175,
    Pinnacle: 700,
    'Pinnacle Club': 700,
  };
  return formatted ? thresholds[formatted] : undefined;
}

function estimateCrownAnchorPointsFromRemaining(tier?: string, remaining?: number): number | undefined {
  if (remaining === undefined || !Number.isFinite(remaining) || remaining < 0) return undefined;
  const formatted = formatTierName(tier);
  const nextThreshold = formatted === 'Pinnacle' || formatted === 'Pinnacle Club'
    ? undefined
    : formatted === 'Diamond Plus'
      ? 700
      : formatted === 'Diamond'
        ? 175
        : formatted === 'Emerald'
          ? 80
          : formatted === 'Platinum'
            ? 55
            : formatted === 'Gold'
              ? 30
              : undefined;
  if (!nextThreshold) return undefined;
  const estimated = nextThreshold - remaining;
  return estimated >= 0 ? estimated : undefined;
}

function estimateCrownAnchorPointsFromTracker(tier?: string, trackerPercentage?: number): number | undefined {
  if (trackerPercentage === undefined || !Number.isFinite(trackerPercentage) || trackerPercentage <= 0) return undefined;
  const formatted = formatTierName(tier);
  const currentThreshold = getCrownAnchorTierThreshold(formatted) ?? 0;
  const nextThreshold = formatted === 'Diamond Plus' ? 700 : formatted === 'Diamond' ? 175 : formatted === 'Emerald' ? 80 : formatted === 'Platinum' ? 55 : formatted === 'Gold' ? 30 : undefined;
  if (!nextThreshold || nextThreshold <= currentThreshold) return undefined;
  const estimated = Math.round(currentThreshold + ((nextThreshold - currentThreshold) * Math.min(100, trackerPercentage) / 100));
  return estimated >= 0 ? estimated : undefined;
}

function sumCrownAnchorPointsFromSailings(raw: unknown): number | undefined {
  const records = collectRecords(raw);
  let total = 0;
  let found = false;
  for (const record of records) {
    const text = recordText(record);
    if (!/sail|cruise|voyage|history|ship|booking/.test(text)) continue;
    const points = firstKnownNumber(
      getValue(record, ['points', 'cruisePoints', 'loyaltyPoints', 'crownAnchorPoints', 'crownAndAnchorPoints', 'pointsEarned']),
      getValueDeep(record, ['points', 'cruisePoints', 'loyaltyPoints'])
    );
    if (typeof points === 'number' && Number.isFinite(points) && points > 0 && points < 10000) {
      total += points;
      found = true;
    }
  }
  return found ? Math.round(total) : undefined;
}

function findNumberNearText(raw: unknown, textPatterns: RegExp[], numberPatterns: RegExp[] = []): number | undefined {
  try {
    const haystack = JSON.stringify(raw).replace(/\\n/g, ' ');
    for (const pattern of numberPatterns) {
      const match = haystack.match(pattern);
      if (match?.[1]) {
        const parsed = toNumber(match[1]);
        if (parsed !== undefined) return parsed;
      }
    }
    for (const textPattern of textPatterns) {
      const textMatch = textPattern.exec(haystack);
      if (!textMatch) continue;
      const start = Math.max(0, textMatch.index - 280);
      const end = Math.min(haystack.length, textMatch.index + 420);
      const windowText = haystack.slice(start, end);
      const numberMatch = windowText.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})/);
      if (numberMatch?.[1]) {
        const parsed = toNumber(numberMatch[1]);
        if (parsed !== undefined) return parsed;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function findTierNearText(raw: unknown, programPatterns: RegExp[], allowedTiers: string[]): string | undefined {
  try {
    const haystack = JSON.stringify(raw).replace(/[_-]+/g, ' ').replace(/\\n/g, ' ');
    for (const programPattern of programPatterns) {
      const textMatch = programPattern.exec(haystack);
      if (!textMatch) continue;
      const start = Math.max(0, textMatch.index - 300);
      const end = Math.min(haystack.length, textMatch.index + 500);
      const windowText = haystack.slice(start, end).toLowerCase();
      for (const tier of allowedTiers) {
        if (windowText.includes(tier.toLowerCase())) return tier;
      }
    }
    const lower = haystack.toLowerCase();
    for (const tier of allowedTiers) {
      if (lower.includes(tier.toLowerCase())) return tier;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildExtendedLoyaltyData(
  input: LoyaltyApiInformation | Record<string, unknown> | null | undefined,
  accountId?: string
): ExtendedLoyaltyData {
  const raw = input ?? {};
  const loyalty = unwrapLoyaltyEnvelope(raw);

  const crownAndAnchorTierRaw = firstKnownString(
    getValueDeep(loyalty, [
      'crownAndAnchorSocietyLoyaltyTier',
      'crownAndAnchorSocietyTier',
      'crownAndAnchorTier',
      'crownAnchorTier',
      'crownAndAnchorLevel',
      'crownAnchorLevel',
      'crownAndAnchorStatus',
    ]),
    getProgramValue(raw, ['crown & anchor', 'crown and anchor', 'crownanchor'], [
      'tier', 'tierName', 'currentTier', 'status', 'level', 'loyaltyTier', 'displayTier',
    ]),
    findTierNearText(raw, [/crown\s*(?:&|and)\s*anchor/i, /cruise\s*points/i, /myaccount/i], ['Pinnacle', 'Diamond Plus', 'Diamond', 'Emerald', 'Platinum', 'Gold', 'Pre-Gold'])
  );
  const crownAndAnchorRemainingRaw = firstKnownNumber(getValueDeep(loyalty, [
    'crownAndAnchorSocietyRemainingPoints',
    'crownAndAnchorSocietyRemainingCruisePoints',
    'crownAndAnchorRemainingPoints',
    'crownAnchorRemainingPoints',
    'remainingPoints',
    'pointsToNext',
    'pointsToNextTier',
  ]));
  const crownAndAnchorTrackerRaw = firstKnownNumber(getValueDeep(loyalty, ['crownAndAnchorTrackerPercentage', 'crownAnchorTrackerPercentage', 'trackerPercentage']));
  const crownAndAnchorPointsRaw = firstKnownNumber(
    getValueDeep(loyalty, [
      'crownAndAnchorSocietyLoyaltyIndividualPoints',
      'crownAndAnchorPoints',
      'crownAnchorPoints',
      'crownAndAnchorSocietyPoints',
      'crownAndAnchorSocietyLoyaltyPoints',
      'crownAndAnchorCruisePoints',
      'crownAnchorCruisePoints',
      'crownAndAnchorTotalPoints',
      'crownAnchorTotalPoints',
      'totalCruisePoints',
      'cruisePoints',
    ]),
    getProgramValue(raw, ['crown & anchor', 'crown and anchor', 'crownanchor'], [
      'points', 'pointBalance', 'pointsBalance', 'currentPoints', 'totalPoints', 'cruisePoints', 'loyaltyPoints', 'individualPoints',
    ]),
    estimateCrownAnchorPointsFromRemaining(crownAndAnchorTierRaw, crownAndAnchorRemainingRaw),
    estimateCrownAnchorPointsFromTracker(crownAndAnchorTierRaw, crownAndAnchorTrackerRaw),
    sumCrownAnchorPointsFromSailings(raw),
    findNumberNearText(raw, [/cruise\s*points/i, /crown\s*(?:&|and)\s*anchor/i], [/(?:cruisePoints|cruise\s*points|crownAndAnchorPoints|crownAnchorPoints)[^0-9]{0,80}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})/i])
  );
  const crownAndAnchorRelationshipPointsRaw = firstKnownNumber(getValueDeep(loyalty, [
    'crownAndAnchorSocietyLoyaltyRelationshipPoints',
    'crownAndAnchorRelationshipPoints',
  ]));

  const crownAndAnchorIdRaw = firstKnownString(getValueDeep(loyalty, [
    'crownAndAnchorId',
    'crownAndAnchorNumber',
    'crownAnchorNumber',
    'crownAndAnchorSocietyId',
    'crownAndAnchorSocietyNumber',
    'crownAndAnchorMembershipNumber',
  ]));

  const clubRoyaleTierRaw = firstKnownString(
    getValueDeep(loyalty, [
      'clubRoyaleLoyaltyTier',
      'clubRoyaleTier',
      'clubRoyalTier',
      'clubRoyaleStatus',
      'currentClubTier',
      'currentTier',
      'tierStatus',
      'tier',
    ]),
    getProgramValue(raw, ['club royale', 'clubroyale', 'casino royale'], [
      'tier', 'tierName', 'currentTier', 'status', 'level', 'loyaltyTier', 'tierStatus', 'displayTier',
    ]),
    findTierNearText(raw, [/club\s*royale/i, /current\s*club\s*tier/i, /tier\s*credits/i], ['Masters', 'Signature', 'Prime', 'Classic', 'Choice'])
  );
  const clubRoyalePointsRaw = firstKnownNumber(
    getValueDeep(loyalty, [
      'clubRoyaleLoyaltyIndividualPoints',
      'clubRoyalePoints',
      'clubRoyalPoints',
      'clubRoyaleCurrentPoints',
      'clubRoyaleTierCredits',
      'clubRoyaleCurrentTierCredits',
      'currentTierCredits',
      'tierCredits',
      'casinoPoints',
      'currentTierCredit',
      'tierCreditBalance',
      'currentBalance',
    ]),
    getProgramValue(raw, ['club royale', 'clubroyale', 'casino royale'], [
      'points', 'pointBalance', 'pointsBalance', 'currentPoints', 'totalPoints', 'tierCredits', 'currentTierCredits', 'individualPoints', 'loyaltyPoints',
    ]),
    findNumberNearText(raw, [/current\s*tier\s*credits/i, /your\s*current\s*tier\s*credits/i, /club\s*royale/i], [/(?:currentTierCredits|tierCredits|current\s*tier\s*credits)[^0-9]{0,80}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})/i])
  );
  const clubRoyaleRelationshipPointsRaw = firstKnownNumber(getValueDeep(loyalty, [
    'clubRoyaleLoyaltyRelationshipPoints',
    'clubRoyaleRelationshipPoints',
  ]));

  const captainsClubTierRaw = firstKnownString(
    getValueDeep(loyalty, [
      'captainsClubLoyaltyTier',
      'captainsClubTier',
    ]),
    getProgramValue(raw, ["captain's club", 'captains club', 'captainsclub'], [
      'tier', 'tierName', 'currentTier', 'status', 'level', 'loyaltyTier', 'displayTier',
    ])
  );
  const captainsClubPointsRaw = firstKnownNumber(
    getValueDeep(loyalty, [
      'captainsClubLoyaltyIndividualPoints',
      'captainsClubPoints',
    ]),
    getProgramValue(raw, ["captain's club", 'captains club', 'captainsclub'], [
      'points', 'pointBalance', 'pointsBalance', 'currentPoints', 'totalPoints', 'individualPoints', 'loyaltyPoints',
    ])
  );

  const celebrityBlueChipTierRaw = firstKnownString(
    getValueDeep(loyalty, [
      'celebrityBlueChipLoyaltyTier',
      'celebrityBlueChipTier',
      'blueChipTier',
    ]),
    getProgramValue(raw, ['blue chip', 'bluechip'], [
      'tier', 'tierName', 'currentTier', 'status', 'level', 'loyaltyTier', 'displayTier',
    ])
  );
  const celebrityBlueChipPointsRaw = firstKnownNumber(
    getValueDeep(loyalty, [
      'celebrityBlueChipLoyaltyIndividualPoints',
      'celebrityBlueChipPoints',
      'blueChipPoints',
      'blueChipTierCredits',
    ]),
    getProgramValue(raw, ['blue chip', 'bluechip'], [
      'points', 'pointBalance', 'pointsBalance', 'currentPoints', 'totalPoints', 'tierCredits', 'individualPoints', 'loyaltyPoints',
    ])
  );

  return {
    accountId,
    crownAndAnchorId: crownAndAnchorIdRaw,
    crownAndAnchorLevel: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorTier: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorPoints: crownAndAnchorPointsRaw?.toString(),
    crownAndAnchorPointsFromApi: crownAndAnchorPointsRaw,
    crownAndAnchorRelationshipPointsFromApi: crownAndAnchorRelationshipPointsRaw,
    crownAndAnchorNextTier: formatTierName(firstKnownString(getValueDeep(loyalty, ['crownAndAnchorSocietyNextTier', 'crownAndAnchorNextTier', 'crownAnchorNextTier']))),
    crownAndAnchorRemainingPoints: crownAndAnchorRemainingRaw,
    crownAndAnchorTrackerPercentage: crownAndAnchorTrackerRaw,
    crownAndAnchorLoyaltyMatchTier: firstKnownString(getValueDeep(loyalty, ['crownAndAnchorLoyaltyMatchTier', 'crownAnchorLoyaltyMatchTier'])),

    clubRoyaleTier: formatTierName(clubRoyaleTierRaw),
    clubRoyaleTierFromApi: formatTierName(clubRoyaleTierRaw),
    clubRoyalePoints: clubRoyalePointsRaw?.toString(),
    clubRoyalePointsFromApi: clubRoyalePointsRaw,
    clubRoyaleRelationshipPointsFromApi: clubRoyaleRelationshipPointsRaw,

    captainsClubId: firstKnownString(getValueDeep(loyalty, ['captainsClubId', 'captainsClubNumber'])),
    captainsClubTier: formatTierName(captainsClubTierRaw),
    captainsClubPoints: captainsClubPointsRaw,
    captainsClubRelationshipPoints: firstKnownNumber(getValueDeep(loyalty, ['captainsClubLoyaltyRelationshipPoints', 'captainsClubRelationshipPoints'])),
    captainsClubNextTier: formatTierName(firstKnownString(getValueDeep(loyalty, ['captainsClubNextTier']))),
    captainsClubRemainingPoints: firstKnownNumber(getValueDeep(loyalty, ['captainsClubRemainingPoints'])),
    captainsClubTrackerPercentage: firstKnownNumber(getValueDeep(loyalty, ['captainsClubTrackerPercentage'])),
    captainsClubLoyaltyMatchTier: firstKnownString(getValueDeep(loyalty, ['captainsClubLoyaltyMatchTier'])),

    celebrityBlueChipTier: formatTierName(celebrityBlueChipTierRaw),
    celebrityBlueChipPoints: celebrityBlueChipPointsRaw,
    celebrityBlueChipRelationshipPoints: firstKnownNumber(getValueDeep(loyalty, ['celebrityBlueChipLoyaltyRelationshipPoints', 'celebrityBlueChipRelationshipPoints'])),

    venetianSocietyTier: firstKnownString(getValueDeep(loyalty, ['venetianSocietyLoyaltyTier', 'venetianSocietyTier'])),
    venetianSocietyNextTier: firstKnownString(getValueDeep(loyalty, ['venetianSocietyNextTier'])),
    venetianSocietyMemberNumber: firstKnownString(getValueDeep(loyalty, ['vsMemberNumber', 'venetianSocietyMemberNumber'])),
    venetianSocietyEnrolled: typeof getValueDeep(loyalty, ['venetianSocietyEnrollmentSubmitted', 'venetianSocietyEnrolled']) === 'boolean' ? getValueDeep(loyalty, ['venetianSocietyEnrollmentSubmitted', 'venetianSocietyEnrolled']) as boolean : undefined,
    venetianSocietyLoyaltyMatchTier: firstKnownString(getValueDeep(loyalty, ['venetianSocietyLoyaltyMatchTier'])),
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

function hasMeaningfulLoyaltyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

export function mergeExtendedLoyaltyData(
  existing: ExtendedLoyaltyData | null | undefined,
  incoming: ExtendedLoyaltyData | null | undefined
): ExtendedLoyaltyData | null {
  if (!existing && !incoming) {
    return null;
  }

  if (!existing) {
    return incoming ?? null;
  }

  if (!incoming) {
    return existing;
  }

  const merged: Record<string, unknown> = {};
  const allKeys = new Set<string>([
    ...Object.keys(existing),
    ...Object.keys(incoming),
  ]);

  allKeys.forEach((key) => {
    const existingValue = (existing as Record<string, unknown>)[key];
    const incomingValue = (incoming as Record<string, unknown>)[key];
    if (!hasMeaningfulLoyaltyValue(incomingValue)) {
      merged[key] = existingValue;
      return;
    }

    // Different Royal endpoints arrive separately. Preserve the highest known numeric
    // profile totals so loyalty/history or stale cached payloads cannot downgrade
    // visible/manual truth (ex: 646 C&A points, 19,363 Club Royale credits).
    if (key === 'clubRoyalePointsFromApi' || key === 'crownAndAnchorPointsFromApi') {
      const existingNum = toNumber(existingValue);
      const incomingNum = toNumber(incomingValue);
      if (existingNum !== undefined && incomingNum !== undefined && existingNum > 0 && incomingNum > 0 && incomingNum < existingNum) {
        merged[key] = existingValue;
        return;
      }
    }

    if (key === 'clubRoyalePoints' || key === 'crownAndAnchorPoints') {
      const existingNum = toNumber(existingValue);
      const incomingNum = toNumber(incomingValue);
      if (existingNum !== undefined && incomingNum !== undefined && existingNum > 0 && incomingNum > 0 && incomingNum < existingNum) {
        merged[key] = existingValue;
        return;
      }
    }

    merged[key] = incomingValue;
  });

  return merged as ExtendedLoyaltyData;
}

function formatTierName(tier: string | undefined): string | undefined {
  if (!tier) return undefined;
  const normalized = tier
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = normalized.toLowerCase();
  const known: Record<string, string> = {
    'diamond plus': 'Diamond Plus',
    'diamondplus': 'Diamond Plus',
    'pinnacle club': 'Pinnacle',
    'pinnacle': 'Pinnacle',
    'diamond': 'Diamond',
    'emerald': 'Emerald',
    'platinum': 'Platinum',
    'gold': 'Gold',
    'pre gold': 'Pre-Gold',
    'classic': 'Classic',
    'prime': 'Prime',
    'signature': 'Signature',
    'masters': 'Masters',
    'zenith': 'Zenith',
    'elite plus': 'Elite Plus',
    'eliteplus': 'Elite Plus',
    'elite': 'Elite',
    'select': 'Select',
    'preview': 'Preview',
    'amethyst': 'Amethyst',
    'sapphire': 'Sapphire',
    'ruby': 'Ruby',
    'pearl': 'Pearl',
  };
  if (known[lower]) return known[lower];
  return normalized
    .split(' ')
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
