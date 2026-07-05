/**
 * EasySeas Master Design System
 *
 * Single source of truth for color, type, spacing, radius, and shadow tokens.
 * Every screen/component should import from here instead of hardcoding new
 * values. This file consolidates (and re-exports where useful) the existing
 * `theme.ts` / `loyaltyColors.ts` / `crownAnchor.ts` / `clubRoyaleTiers.ts`
 * constants rather than duplicating their values, so there is exactly one
 * place that owns each color.
 */
import { COLORS, SHADOW as LEGACY_SHADOW } from '@/constants/theme';
import {
  CLUB_POINTS_TIER_COLORS,
  CROWN_ANCHOR_TIER_COLORS,
  CLUB_ROYALE_TIER_COLORS,
  BLUE_CHIP_CLUB_TIER_COLORS,
  CLUB_POINTS_NEUTRALS,
  CROWN_ANCHOR_SUPPORT_COLORS,
  CLUB_ROYALE_SUPPORT_COLORS,
  BLUE_CHIP_CLUB_SUPPORT_COLORS,
  withAlpha,
} from '@/constants/loyaltyColors';

/** App identity palette — navy/teal/gold/purple. Controls brand, not status. */
export const EasySeasColors = {
  background: '#FFFFFF',
  backgroundSoft: COLORS.bgSecondary,
  backgroundMuted: COLORS.bgTertiary,

  navy: COLORS.navy,
  navyDeep: COLORS.navyDark,
  navySoft: 'rgba(30, 58, 95, 0.08)',

  teal: COLORS.tealAccent,
  tealSoft: 'rgba(0, 151, 167, 0.10)',

  purple: COLORS.royalPurple,
  purpleSoft: 'rgba(123, 45, 142, 0.10)',

  gold: COLORS.gold,
  goldSoft: 'rgba(212, 160, 10, 0.12)',

  success: COLORS.success,
  successSoft: 'rgba(5, 150, 105, 0.12)',

  warning: COLORS.warning,
  warningSoft: 'rgba(245, 158, 11, 0.14)',

  danger: COLORS.error,
  dangerSoft: 'rgba(220, 38, 38, 0.10)',

  textPrimary: COLORS.textNavy,
  textSecondary: COLORS.textDarkGrey,
  textMuted: COLORS.textMuted,
  textInverse: '#FFFFFF',

  border: COLORS.borderLight,
  borderStrong: COLORS.borderMedium,

  card: '#FFFFFF',
} as const;

/** Loyalty/status color language — controls tier identity, not app identity. */
export const EasySeasTierColors = {
  celebrityClubPoints: {
    preview: CLUB_POINTS_TIER_COLORS.Preview,
    classic: CLUB_POINTS_TIER_COLORS.Classic,
    select: CLUB_POINTS_TIER_COLORS.Select,
    elite: CLUB_POINTS_TIER_COLORS.Elite,
    elitePlus: CLUB_POINTS_TIER_COLORS['Elite Plus'],
    zenith: CLUB_POINTS_TIER_COLORS.Zenith,
    background: CLUB_POINTS_NEUTRALS.backgroundLight,
    border: CLUB_POINTS_NEUTRALS.borderSoft,
    textDark: CLUB_POINTS_NEUTRALS.textDark,
  },
  crownAndAnchor: {
    gold: CROWN_ANCHOR_TIER_COLORS.Gold,
    platinum: CROWN_ANCHOR_TIER_COLORS.Platinum,
    emerald: CROWN_ANCHOR_TIER_COLORS.Emerald,
    diamond: CROWN_ANCHOR_TIER_COLORS.Diamond,
    diamondPlus: CROWN_ANCHOR_TIER_COLORS['Diamond Plus'],
    pinnacleClub: CROWN_ANCHOR_TIER_COLORS['Pinnacle Club'],
    headerNavy: CROWN_ANCHOR_SUPPORT_COLORS.headerNavy,
    background: CROWN_ANCHOR_SUPPORT_COLORS.backgroundWhite,
  },
  clubRoyale: {
    choice: CLUB_ROYALE_TIER_COLORS.Choice,
    prime: CLUB_ROYALE_TIER_COLORS.Prime,
    signature: CLUB_ROYALE_TIER_COLORS.Signature,
    masters: CLUB_ROYALE_TIER_COLORS.Masters,
    background: CLUB_ROYALE_SUPPORT_COLORS.backgroundLight,
    textMedium: CLUB_ROYALE_SUPPORT_COLORS.mediumGrayText,
  },
  blueChipClub: {
    pearl: BLUE_CHIP_CLUB_TIER_COLORS.Pearl,
    onyx: BLUE_CHIP_CLUB_TIER_COLORS.Onyx,
    amethyst: BLUE_CHIP_CLUB_TIER_COLORS.Amethyst,
    sapphire: BLUE_CHIP_CLUB_TIER_COLORS.Sapphire,
    sapphirePlus: BLUE_CHIP_CLUB_TIER_COLORS['Sapphire Plus'],
    ruby: BLUE_CHIP_CLUB_TIER_COLORS.Ruby,
    tealBlue: BLUE_CHIP_CLUB_SUPPORT_COLORS.tealBlue,
    deepBlue: BLUE_CHIP_CLUB_SUPPORT_COLORS.deepBlue,
    navy: BLUE_CHIP_CLUB_SUPPORT_COLORS.navy,
  },
} as const;

export type TierProgram = 'celebrityClubPoints' | 'crownAndAnchor' | 'clubRoyale' | 'blueChipClub';

/** Typography scale — use instead of ad hoc font sizes per screen. */
export const EasySeasTypography = {
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
  small: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  heroNumber: { fontSize: 36, lineHeight: 42, fontWeight: '900' as const },
} as const;

export const EasySeasSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const EasySeasRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 18,
  section: 22,
  pill: 999,
} as const;

export const EasySeasShadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // kept for screens that already rely on the legacy shadow scale
  legacy: LEGACY_SHADOW,
} as const;

/** Resolve the current-tier accent color for a given program + tier name. */
export function resolveTierColor(program: TierProgram, tier?: string | null): string {
  const key = (tier ?? '').trim().toLowerCase();
  switch (program) {
    case 'celebrityClubPoints': {
      const map: Record<string, string> = {
        preview: EasySeasTierColors.celebrityClubPoints.preview,
        classic: EasySeasTierColors.celebrityClubPoints.classic,
        select: EasySeasTierColors.celebrityClubPoints.select,
        elite: EasySeasTierColors.celebrityClubPoints.elite,
        'elite plus': EasySeasTierColors.celebrityClubPoints.elitePlus,
        zenith: EasySeasTierColors.celebrityClubPoints.zenith,
      };
      return map[key] ?? EasySeasColors.navy;
    }
    case 'crownAndAnchor': {
      const map: Record<string, string> = {
        gold: EasySeasTierColors.crownAndAnchor.gold,
        platinum: EasySeasTierColors.crownAndAnchor.platinum,
        emerald: EasySeasTierColors.crownAndAnchor.emerald,
        diamond: EasySeasTierColors.crownAndAnchor.diamond,
        'diamond plus': EasySeasTierColors.crownAndAnchor.diamondPlus,
        pinnacle: EasySeasTierColors.crownAndAnchor.pinnacleClub,
        'pinnacle club': EasySeasTierColors.crownAndAnchor.pinnacleClub,
      };
      return map[key] ?? EasySeasColors.navy;
    }
    case 'clubRoyale': {
      const map: Record<string, string> = {
        choice: EasySeasTierColors.clubRoyale.choice,
        prime: EasySeasTierColors.clubRoyale.prime,
        signature: EasySeasTierColors.clubRoyale.signature,
        masters: EasySeasTierColors.clubRoyale.masters,
      };
      return map[key] ?? EasySeasColors.purple;
    }
    case 'blueChipClub': {
      const map: Record<string, string> = {
        pearl: EasySeasTierColors.blueChipClub.pearl,
        onyx: EasySeasTierColors.blueChipClub.onyx,
        amethyst: EasySeasTierColors.blueChipClub.amethyst,
        sapphire: EasySeasTierColors.blueChipClub.sapphire,
        'sapphire plus': EasySeasTierColors.blueChipClub.sapphirePlus,
        ruby: EasySeasTierColors.blueChipClub.ruby,
      };
      return map[key] ?? EasySeasColors.teal;
    }
    default:
      return EasySeasColors.navy;
  }
}

export { withAlpha };
