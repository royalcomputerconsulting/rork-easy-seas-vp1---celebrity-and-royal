import { CARNIVAL_PLAYERS_CLUB_TIERS, CARNIVAL_VIFP_TIERS } from '@/constants/carnivalVifpClub';
import { CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { withAlpha } from '@/constants/loyaltyColors';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { SILVERSEA_VENETIAN_TIERS } from '@/constants/silverseaVenetianSociety';
import { COLORS } from '@/constants/theme';

export type SupportedBrand = 'royal' | 'celebrity' | 'silversea' | 'carnival';

export interface LoyaltyCardTheme {
  accentColor: string;
  gradientColors: [string, string, string];
  borderColor: string;
  surfaceColor: string;
  surfaceColorMuted: string;
  topTextColor: string;
  secondaryTextColor: string;
}

interface PlayerCardThemeOptions {
  brand: SupportedBrand;
  crownAnchorLevel?: string | null;
  celebrityLevel?: string | null;
  silverseaTier?: string | null;
  carnivalVifpTier?: string | null;
}

function normalizeHex(hex: string): string | null {
  const sanitized = hex.trim().replace('#', '');

  if (sanitized.length === 3) {
    return sanitized
      .split('')
      .map((character) => `${character}${character}`)
      .join('');
  }

  if (sanitized.length === 6) {
    return sanitized;
  }

  return null;
}

function mixHexColors(sourceHex: string, targetHex: string, weight: number): string {
  const normalizedSource = normalizeHex(sourceHex);
  const normalizedTarget = normalizeHex(targetHex);

  if (!normalizedSource || !normalizedTarget) {
    return sourceHex;
  }

  const safeWeight = Math.max(0, Math.min(1, weight));
  const sourceValue = Number.parseInt(normalizedSource, 16);
  const targetValue = Number.parseInt(normalizedTarget, 16);

  if (Number.isNaN(sourceValue) || Number.isNaN(targetValue)) {
    return sourceHex;
  }

  const sourceRed = (sourceValue >> 16) & 255;
  const sourceGreen = (sourceValue >> 8) & 255;
  const sourceBlue = sourceValue & 255;

  const targetRed = (targetValue >> 16) & 255;
  const targetGreen = (targetValue >> 8) & 255;
  const targetBlue = targetValue & 255;

  const red = Math.round(sourceRed + (targetRed - sourceRed) * safeWeight);
  const green = Math.round(sourceGreen + (targetGreen - sourceGreen) * safeWeight);
  const blue = Math.round(sourceBlue + (targetBlue - sourceBlue) * safeWeight);

  const mixed = (red << 16) | (green << 8) | blue;
  return `#${mixed.toString(16).padStart(6, '0').toUpperCase()}`;
}

export function createLoyaltyCardTheme(accentColor?: string | null): LoyaltyCardTheme {
  const resolvedAccent = accentColor ?? COLORS.navyDeep;
  const gradientStart = mixHexColors(resolvedAccent, '#FFFFFF', 0.18);
  const gradientMiddle = mixHexColors(resolvedAccent, '#0F172A', 0.14);
  const gradientEnd = mixHexColors(resolvedAccent, '#020617', 0.36);

  return {
    accentColor: resolvedAccent,
    gradientColors: [gradientStart, gradientMiddle, gradientEnd],
    borderColor: withAlpha(resolvedAccent, 0.34),
    surfaceColor: 'rgba(255, 255, 255, 0.18)',
    surfaceColorMuted: 'rgba(255, 255, 255, 0.12)',
    topTextColor: '#FFFFFF',
    secondaryTextColor: 'rgba(255, 255, 255, 0.82)',
  };
}

export function getPlayerCardTheme({
  brand,
  crownAnchorLevel,
  celebrityLevel,
  silverseaTier,
  carnivalVifpTier,
}: PlayerCardThemeOptions): LoyaltyCardTheme {
  const accentColor = brand === 'celebrity'
    ? CELEBRITY_CAPTAINS_CLUB_LEVELS[celebrityLevel ?? 'Preview']?.color
    : brand === 'silversea'
    ? SILVERSEA_VENETIAN_TIERS[silverseaTier ?? 'Member']?.color
    : brand === 'carnival'
    ? CARNIVAL_VIFP_TIERS[carnivalVifpTier ?? 'Blue']?.color
    : CROWN_ANCHOR_LEVELS[crownAnchorLevel ?? 'Gold']?.color;

  return createLoyaltyCardTheme(accentColor ?? COLORS.navyDeep);
}

export function getClubRoyaleTierColor(tier?: string | null): string {
  return CLUB_ROYALE_TIERS[tier ?? 'Choice']?.color ?? COLORS.navyDeep;
}

export function getCrownAnchorTierColor(level?: string | null): string {
  return CROWN_ANCHOR_LEVELS[level ?? 'Gold']?.color ?? COLORS.navyDeep;
}

export function getCelebrityCaptainsClubLevelColor(level?: string | null): string {
  return CELEBRITY_CAPTAINS_CLUB_LEVELS[level ?? 'Preview']?.color ?? COLORS.navyDeep;
}

export function getCelebrityBlueChipTierColor(tier?: string | null): string {
  return CELEBRITY_BLUE_CHIP_TIERS[tier ?? 'Pearl']?.color ?? COLORS.navyDeep;
}

export function getSilverseaTierColor(tier?: string | null): string {
  return SILVERSEA_VENETIAN_TIERS[tier ?? 'Member']?.color ?? COLORS.navyDeep;
}

export function getCarnivalVifpTierColor(tier?: string | null): string {
  return CARNIVAL_VIFP_TIERS[tier ?? 'Blue']?.color ?? COLORS.navyDeep;
}

export function getCarnivalPlayersClubTierColor(tier?: string | null): string {
  return CARNIVAL_PLAYERS_CLUB_TIERS[tier ?? 'Blue']?.color ?? COLORS.navyDeep;
}
