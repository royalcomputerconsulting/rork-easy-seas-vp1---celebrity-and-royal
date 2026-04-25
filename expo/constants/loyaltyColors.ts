export const LOYALTY_COLOR_MEMORY = {
  clubPoints: {
    tiers: {
      Preview: '#55742C',
      Classic: '#3D87BF',
      Select: '#D96B38',
      Elite: '#58585B',
      'Elite Plus': '#822A25',
      Zenith: '#2B2930',
    },
    neutrals: {
      backgroundLight: '#F3F3F2',
      borderSoft: '#D5D5D0',
      textDark: '#333334',
    },
  },
  crownAnchor: {
    tiers: {
      Gold: '#E6B63D',
      Platinum: '#BFC4CC',
      Emerald: '#4EC0A5',
      Diamond: '#3E84D9',
      'Diamond Plus': '#5A43D6',
      'Pinnacle Club': '#273D9A',
    },
    support: {
      headerNavy: '#1C2F7A',
      backgroundWhite: '#FFFFFF',
    },
  },
  clubRoyale: {
    tiers: {
      Choice: '#D87924',
      Prime: '#8A1FD1',
      Signature: '#2C1D9A',
      Masters: '#22201E',
    },
    support: {
      backgroundLight: '#F5F5F4',
      mediumGrayText: '#8E8A89',
    },
  },
  blueChipClub: {
    tiers: {
      Pearl: '#E7E7E4',
      Onyx: '#4A4A4A',
      Amethyst: '#8C3FC8',
      Sapphire: '#2F8EEB',
      'Sapphire Plus': '#5067D8',
      Ruby: '#D83A4A',
    },
    support: {
      tealBlue: '#0E7FA7',
      deepBlue: '#123D73',
      navy: '#0F2247',
    },
  },
} as const;

export const CLUB_POINTS_TIER_COLORS = LOYALTY_COLOR_MEMORY.clubPoints.tiers;
export const CLUB_POINTS_NEUTRALS = LOYALTY_COLOR_MEMORY.clubPoints.neutrals;
export const CROWN_ANCHOR_TIER_COLORS = LOYALTY_COLOR_MEMORY.crownAnchor.tiers;
export const CROWN_ANCHOR_SUPPORT_COLORS = LOYALTY_COLOR_MEMORY.crownAnchor.support;
export const CLUB_ROYALE_TIER_COLORS = LOYALTY_COLOR_MEMORY.clubRoyale.tiers;
export const CLUB_ROYALE_SUPPORT_COLORS = LOYALTY_COLOR_MEMORY.clubRoyale.support;
export const BLUE_CHIP_CLUB_TIER_COLORS = LOYALTY_COLOR_MEMORY.blueChipClub.tiers;
export const BLUE_CHIP_CLUB_SUPPORT_COLORS = LOYALTY_COLOR_MEMORY.blueChipClub.support;

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

export function withAlpha(hex: string, alpha: number): string {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return hex;
  }

  const numericValue = Number.parseInt(normalized, 16);

  if (Number.isNaN(numericValue)) {
    return hex;
  }

  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const red = (numericValue >> 16) & 255;
  const green = (numericValue >> 8) & 255;
  const blue = numericValue & 255;

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}
