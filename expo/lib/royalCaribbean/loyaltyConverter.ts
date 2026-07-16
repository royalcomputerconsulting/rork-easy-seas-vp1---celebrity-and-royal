import {
  ExtendedLoyaltyData,
  LoyaltyApiInformation,
  LoyaltyAuthorityField,
  LoyaltyConversionContext,
  LoyaltyData,
  LoyaltyFieldAuthority,
  RoyalCaribbeanLoyaltyApiResponse,
} from './types';

function getValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9+.-]/g, '').trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function formatTierName(tier: string | undefined): string | undefined {
  if (!tier) return undefined;
  return tier
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function isCasinoPayload(loyalty: Record<string, unknown>, context: LoyaltyConversionContext): boolean {
  const url = String(context.sourceUrl || '').toLowerCase();
  if (url.includes('/api/casino/v1/loyalty-data') || url.includes('/casino/') && url.includes('loyalty')) return true;
  return Boolean(
    ('casinoLoyaltyId' in loyalty || 'evaluationPeriodStartDateForPoints' in loyalty || 'evaluationPeriodEndDateForPoints' in loyalty) &&
    ('individualPoints' in loyalty || 'tier' in loyalty)
  );
}

function isCrownAnchorPayload(loyalty: Record<string, unknown>, context: LoyaltyConversionContext): boolean {
  const url = String(context.sourceUrl || '').toLowerCase();
  if (url.includes('/guestaccounts/loyalty/info')) return true;
  return Boolean(
    'crownAndAnchorSocietyLoyaltyTier' in loyalty ||
    'crownAndAnchorSocietyLoyaltyIndividualPoints' in loyalty ||
    'crownAndAnchorTier' in loyalty ||
    'crownAndAnchorPoints' in loyalty
  );
}

function makeAuthority(
  context: LoyaltyConversionContext,
  source: LoyaltyFieldAuthority['source'],
  confidence: LoyaltyFieldAuthority['confidence'],
): LoyaltyFieldAuthority {
  return {
    source,
    confidence,
    capturedAt: context.capturedAt || new Date().toISOString(),
    accountId: context.accountId,
  };
}

function authorityForPopulatedFields(
  data: ExtendedLoyaltyData,
  context: LoyaltyConversionContext,
  casinoPayload: boolean,
  crownAnchorPayload: boolean,
): ExtendedLoyaltyData['loyaltyFieldAuthority'] {
  const authority: Partial<Record<LoyaltyAuthorityField, LoyaltyFieldAuthority>> = {};
  const apiSource: LoyaltyFieldAuthority['source'] = casinoPayload
    ? 'casino_api'
    : crownAnchorPayload
      ? 'crown_anchor_api'
      : context.sourceType === 'dom'
        ? 'dom'
        : context.sourceType === 'stored'
          ? 'stored'
          : 'generic_api';
  const confidence: LoyaltyFieldAuthority['confidence'] = context.sourceType === 'dom'
    ? 'fallback'
    : context.sourceType === 'stored'
      ? 'preserved'
      : 'authoritative';
  const stamp = () => makeAuthority(context, apiSource, confidence);

  if (data.clubRoyaleId !== undefined) authority.clubRoyaleId = stamp();
  if (data.clubRoyaleTierFromApi !== undefined) authority.clubRoyaleTier = stamp();
  if (data.clubRoyalePointsFromApi !== undefined) authority.clubRoyalePoints = stamp();
  if (data.clubRoyaleRelationshipPointsFromApi !== undefined) authority.clubRoyaleRelationshipPoints = stamp();
  if (data.clubRoyaleEvaluationPeriodStartDate !== undefined) authority.clubRoyaleEvaluationPeriodStartDate = stamp();
  if (data.clubRoyaleEvaluationPeriodEndDate !== undefined) authority.clubRoyaleEvaluationPeriodEndDate = stamp();
  if (data.crownAndAnchorId !== undefined) authority.crownAndAnchorId = stamp();
  if (data.crownAndAnchorTier !== undefined) authority.crownAndAnchorTier = stamp();
  if (data.crownAndAnchorPointsFromApi !== undefined) authority.crownAndAnchorPoints = stamp();
  if (data.crownAndAnchorRelationshipPointsFromApi !== undefined) authority.crownAndAnchorRelationshipPoints = stamp();
  if (data.crownAndAnchorNextTier !== undefined) authority.crownAndAnchorNextTier = stamp();
  if (data.crownAndAnchorRemainingPoints !== undefined) authority.crownAndAnchorRemainingPoints = stamp();
  return authority;
}

function buildExtendedLoyaltyData(
  input: LoyaltyApiInformation | Record<string, unknown> | null | undefined,
  accountId?: string,
  context: LoyaltyConversionContext = {},
): ExtendedLoyaltyData {
  const loyalty = (input ?? {}) as Record<string, unknown>;
  const effectiveContext: LoyaltyConversionContext = { ...context, accountId: context.accountId || accountId };
  const casinoPayload = isCasinoPayload(loyalty, effectiveContext);
  const crownAnchorPayload = isCrownAnchorPayload(loyalty, effectiveContext);

  const crownAndAnchorTierRaw = toStringValue(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyTier', 'crownAndAnchorSocietyTier', 'crownAndAnchorTier',
    'crownAnchorTier', 'crownAndAnchorLevel', 'crownAnchorLevel', 'caTier',
  ]));
  const crownAndAnchorPointsRaw = toNumber(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyIndividualPoints', 'crownAndAnchorPoints', 'crownAnchorPoints',
    'crownAndAnchorSocietyPoints', 'cruisePoints', 'cruiseCredits', 'loyaltyPoints',
    'currentCruisePoints', 'currentCruiseCredits',
  ]));
  const crownAndAnchorRelationshipPointsRaw = toNumber(getValue(loyalty, [
    'crownAndAnchorSocietyLoyaltyRelationshipPoints', 'crownAndAnchorRelationshipPoints',
  ]));
  const crownAndAnchorIdRaw = toStringValue(getValue(loyalty, [
    'crownAndAnchorId', 'crownAndAnchorNumber', 'crownAnchorNumber', 'crownAndAnchorSocietyId',
    'crownAndAnchorSocietyNumber', 'crownAndAnchorMembershipNumber',
    ...(casinoPayload ? ['cruiseLoyaltyId'] : []),
  ]));

  const clubRoyaleTierRaw = toStringValue(getValue(loyalty, [
    'clubRoyaleLoyaltyTier', 'clubRoyaleTier', 'clubRoyalTier', 'currentClubTier',
    'casinoTier', 'clubTier', ...(casinoPayload ? ['tier', 'currentTier'] : []),
  ]));
  const clubRoyalePointsRaw = toNumber(getValue(loyalty, [
    'clubRoyaleLoyaltyIndividualPoints', 'clubRoyalePoints', 'clubRoyalPoints',
    'clubRoyaleCurrentPoints', 'currentTierCredits', 'tierCredits', 'tierCreditBalance',
    'currentTierCreditBalance', 'currentYearTierCredits', 'currentYearPoints',
    'casinoPoints', 'casinoTierCredits', ...(casinoPayload ? ['individualPoints'] : []),
  ]));
  const clubRoyaleRelationshipPointsRaw = toNumber(getValue(loyalty, [
    'clubRoyaleLoyaltyRelationshipPoints', 'clubRoyaleRelationshipPoints',
    ...(casinoPayload ? ['relationshipPoints'] : []),
  ]));
  const clubRoyaleIdRaw = toStringValue(getValue(loyalty, [
    'clubRoyaleId', 'clubRoyaleNumber', 'casinoLoyaltyId',
  ]));

  const captainsClubTierRaw = toStringValue(getValue(loyalty, ['captainsClubLoyaltyTier', 'captainsClubTier']));
  const captainsClubPointsRaw = toNumber(getValue(loyalty, ['captainsClubLoyaltyIndividualPoints', 'captainsClubPoints']));
  const celebrityBlueChipTierRaw = toStringValue(getValue(loyalty, ['celebrityBlueChipLoyaltyTier', 'celebrityBlueChipTier']));
  const celebrityBlueChipPointsRaw = toNumber(getValue(loyalty, ['celebrityBlueChipLoyaltyIndividualPoints', 'celebrityBlueChipPoints']));

  const result: ExtendedLoyaltyData = {
    accountId: effectiveContext.accountId,
    crownAndAnchorId: crownAndAnchorIdRaw,
    crownAndAnchorLevel: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorTier: formatTierName(crownAndAnchorTierRaw),
    crownAndAnchorPoints: crownAndAnchorPointsRaw?.toString(),
    crownAndAnchorPointsFromApi: crownAndAnchorPointsRaw,
    crownAndAnchorRelationshipPointsFromApi: crownAndAnchorRelationshipPointsRaw,
    crownAndAnchorNextTier: formatTierName(toStringValue(getValue(loyalty, ['crownAndAnchorSocietyNextTier', 'crownAndAnchorNextTier']))),
    crownAndAnchorRemainingPoints: toNumber(getValue(loyalty, ['crownAndAnchorSocietyRemainingPoints', 'crownAndAnchorRemainingPoints'])),
    crownAndAnchorTrackerPercentage: toNumber(loyalty.crownAndAnchorTrackerPercentage),
    crownAndAnchorLoyaltyMatchTier: toStringValue(loyalty.crownAndAnchorLoyaltyMatchTier),

    clubRoyaleId: clubRoyaleIdRaw,
    clubRoyaleTier: formatTierName(clubRoyaleTierRaw),
    clubRoyaleTierFromApi: formatTierName(clubRoyaleTierRaw),
    clubRoyalePoints: clubRoyalePointsRaw?.toString(),
    clubRoyalePointsFromApi: clubRoyalePointsRaw,
    clubRoyaleRelationshipPointsFromApi: clubRoyaleRelationshipPointsRaw,
    clubRoyaleEvaluationPeriodStartDate: toStringValue(getValue(loyalty, ['evaluationPeriodStartDateForPoints', 'clubRoyaleEvaluationPeriodStartDate'])),
    clubRoyaleEvaluationPeriodEndDate: toStringValue(getValue(loyalty, ['evaluationPeriodEndDateForPoints', 'clubRoyaleEvaluationPeriodEndDate'])),

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
  result.loyaltyFieldAuthority = authorityForPopulatedFields(result, effectiveContext, casinoPayload, crownAnchorPayload);
  return result;
}

export function convertApiLoyaltyToExtended(
  apiResponse: RoyalCaribbeanLoyaltyApiResponse,
  context: LoyaltyConversionContext = {},
): ExtendedLoyaltyData {
  const payload = apiResponse?.payload;
  const loyalty = payload?.loyaltyInformation as LoyaltyApiInformation | undefined;
  const baseData = buildExtendedLoyaltyData(loyalty, payload?.accountId, { ...context, sourceType: context.sourceType || 'api' });
  return {
    ...baseData,
    hasCoBrandCard: payload?.coBrandCardInfo?.activeCardHolder,
    coBrandCardStatus: payload?.coBrandCardInfo?.status,
    coBrandCardErrorMessage: payload?.coBrandCardInfo?.errorMessage,
  };
}

export function convertLoyaltyInfoToExtended(
  loyalty: LoyaltyApiInformation | Record<string, unknown>,
  accountId?: string,
  context: LoyaltyConversionContext = {},
): ExtendedLoyaltyData {
  return buildExtendedLoyaltyData(loyalty, accountId, { ...context, sourceType: context.sourceType || 'api' });
}

export function convertDomLoyaltyToExtended(
  loyalty: LoyaltyData | Record<string, unknown>,
  accountId?: string,
): ExtendedLoyaltyData {
  return buildExtendedLoyaltyData(loyalty, accountId, { sourceType: 'dom', accountId });
}

function hasMeaningfulLoyaltyValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

const AUTHORITY_BY_PROPERTY: Partial<Record<keyof ExtendedLoyaltyData, LoyaltyAuthorityField>> = {
  clubRoyaleId: 'clubRoyaleId',
  clubRoyaleTier: 'clubRoyaleTier',
  clubRoyaleTierFromApi: 'clubRoyaleTier',
  clubRoyalePoints: 'clubRoyalePoints',
  clubRoyalePointsFromApi: 'clubRoyalePoints',
  clubRoyaleRelationshipPointsFromApi: 'clubRoyaleRelationshipPoints',
  clubRoyaleEvaluationPeriodStartDate: 'clubRoyaleEvaluationPeriodStartDate',
  clubRoyaleEvaluationPeriodEndDate: 'clubRoyaleEvaluationPeriodEndDate',
  crownAndAnchorId: 'crownAndAnchorId',
  crownAndAnchorLevel: 'crownAndAnchorTier',
  crownAndAnchorTier: 'crownAndAnchorTier',
  crownAndAnchorPoints: 'crownAndAnchorPoints',
  crownAndAnchorPointsFromApi: 'crownAndAnchorPoints',
  crownAndAnchorRelationshipPointsFromApi: 'crownAndAnchorRelationshipPoints',
  crownAndAnchorNextTier: 'crownAndAnchorNextTier',
  crownAndAnchorRemainingPoints: 'crownAndAnchorRemainingPoints',
};

function authorityScore(authority: LoyaltyFieldAuthority | undefined): number {
  if (!authority) return 1;
  if (authority.confidence === 'authoritative') return 30;
  if (authority.confidence === 'fallback') return 20;
  return 10;
}

export function mergeExtendedLoyaltyData(
  existing: ExtendedLoyaltyData | null | undefined,
  incoming: ExtendedLoyaltyData | null | undefined,
): ExtendedLoyaltyData | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming ?? null;
  if (!incoming) return existing;

  const merged: Record<string, unknown> = { ...existing };
  const mergedAuthority = { ...(existing.loyaltyFieldAuthority || {}) };
  for (const key of Object.keys(incoming) as Array<keyof ExtendedLoyaltyData>) {
    if (key === 'loyaltyFieldAuthority') continue;
    const incomingValue = incoming[key];
    if (!hasMeaningfulLoyaltyValue(incomingValue)) continue;
    const field = AUTHORITY_BY_PROPERTY[key];
    if (field) {
      const incomingAuthority = incoming.loyaltyFieldAuthority?.[field];
      const existingAuthority = existing.loyaltyFieldAuthority?.[field];
      if (hasMeaningfulLoyaltyValue(existing[key]) && authorityScore(incomingAuthority) < authorityScore(existingAuthority)) continue;
      if (incomingAuthority) mergedAuthority[field] = incomingAuthority;
    }
    merged[key] = incomingValue;
  }
  merged.loyaltyFieldAuthority = mergedAuthority;
  return merged as ExtendedLoyaltyData;
}

export function hasAuthoritativeLoyaltyField(
  data: ExtendedLoyaltyData | null | undefined,
  field: LoyaltyAuthorityField,
): boolean {
  return data?.loyaltyFieldAuthority?.[field]?.confidence === 'authoritative';
}

export function hasAuthoritativeClubRoyaleData(data: ExtendedLoyaltyData | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    hasAuthoritativeLoyaltyField(data, 'clubRoyaleTier') ||
    hasAuthoritativeLoyaltyField(data, 'clubRoyalePoints') ||
    hasAuthoritativeLoyaltyField(data, 'clubRoyaleId')
  );
}

export function hasAuthoritativeCrownAndAnchorData(data: ExtendedLoyaltyData | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    hasAuthoritativeLoyaltyField(data, 'crownAndAnchorTier') &&
    hasAuthoritativeLoyaltyField(data, 'crownAndAnchorPoints')
  );
}

export function buildDefinedLoyaltyStatePatch(data: ExtendedLoyaltyData): LoyaltyData {
  const patch: LoyaltyData = {};
  if (data.clubRoyaleTierFromApi !== undefined) patch.clubRoyaleTier = data.clubRoyaleTierFromApi;
  if (data.clubRoyalePointsFromApi !== undefined) patch.clubRoyalePoints = String(data.clubRoyalePointsFromApi);
  if (data.crownAndAnchorTier !== undefined) patch.crownAndAnchorLevel = data.crownAndAnchorTier;
  if (data.crownAndAnchorPointsFromApi !== undefined) patch.crownAndAnchorPoints = String(data.crownAndAnchorPointsFromApi);
  return patch;
}

export function hasLoyaltyChanges(
  extendedData: ExtendedLoyaltyData,
  currentLoyalty: { clubRoyalePoints: number; clubRoyaleTier: string; crownAnchorPoints: number; crownAnchorLevel: string },
): boolean {
  const clubPointsChanged = extendedData.clubRoyalePointsFromApi !== undefined && extendedData.clubRoyalePointsFromApi !== currentLoyalty.clubRoyalePoints;
  const crownPointsChanged = extendedData.crownAndAnchorPointsFromApi !== undefined && extendedData.crownAndAnchorPointsFromApi !== currentLoyalty.crownAnchorPoints;
  const clubTierChanged = extendedData.clubRoyaleTierFromApi !== undefined && extendedData.clubRoyaleTierFromApi !== currentLoyalty.clubRoyaleTier;
  const crownTierChanged = extendedData.crownAndAnchorTier !== undefined && extendedData.crownAndAnchorTier !== currentLoyalty.crownAnchorLevel;
  return clubPointsChanged || crownPointsChanged || clubTierChanged || crownTierChanged;
}
