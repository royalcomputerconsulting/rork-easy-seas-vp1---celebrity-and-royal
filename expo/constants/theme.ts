export const SEAPASS_PALETTE = {
  previewGreen: '#55742C',
  classicBlue: '#3D87BF',
  selectOrange: '#D96B38',
  eliteGray: '#58585B',
  elitePlusRed: '#822A25',
  zenithCharcoal: '#2B2930',
  gold: '#E6B63D',
  platinum: '#BFC4CC',
  emerald: '#4EC0A5',
  diamond: '#3E84D9',
  diamondPlus: '#5A43D6',
  pinnacle: '#273D9A',
  choice: '#D87924',
  prime: '#8A1FD1',
  signature: '#2C1D9A',
  masters: '#22201E',
  pearl: '#E7E7E4',
  onyx: '#4A4A4A',
  amethyst: '#8C3FC8',
  sapphire: '#2F8EEB',
  sapphirePlus: '#5067D8',
  ruby: '#D83A4A',
  navy: '#1C2F7A',
  tealBlue: '#0E7FA7',
  deepBlue: '#123D73',
  bgLight: '#F5F5F4',
  bgSoft: '#F3F3F2',
  borderSoft: '#D5D5D0',
  textDark: '#333334',
} as const;

export const SEAPASS_CSS_VARIABLES = {
  '--preview-green': SEAPASS_PALETTE.previewGreen,
  '--classic-blue': SEAPASS_PALETTE.classicBlue,
  '--select-orange': SEAPASS_PALETTE.selectOrange,
  '--elite-gray': SEAPASS_PALETTE.eliteGray,
  '--elite-plus-red': SEAPASS_PALETTE.elitePlusRed,
  '--zenith-charcoal': SEAPASS_PALETTE.zenithCharcoal,
  '--gold': SEAPASS_PALETTE.gold,
  '--platinum': SEAPASS_PALETTE.platinum,
  '--emerald': SEAPASS_PALETTE.emerald,
  '--diamond': SEAPASS_PALETTE.diamond,
  '--diamond-plus': SEAPASS_PALETTE.diamondPlus,
  '--pinnacle': SEAPASS_PALETTE.pinnacle,
  '--choice': SEAPASS_PALETTE.choice,
  '--prime': SEAPASS_PALETTE.prime,
  '--signature': SEAPASS_PALETTE.signature,
  '--masters': SEAPASS_PALETTE.masters,
  '--pearl': SEAPASS_PALETTE.pearl,
  '--onyx': SEAPASS_PALETTE.onyx,
  '--amethyst': SEAPASS_PALETTE.amethyst,
  '--sapphire': SEAPASS_PALETTE.sapphire,
  '--sapphire-plus': SEAPASS_PALETTE.sapphirePlus,
  '--ruby': SEAPASS_PALETTE.ruby,
  '--navy': SEAPASS_PALETTE.navy,
  '--teal-blue': SEAPASS_PALETTE.tealBlue,
  '--deep-blue': SEAPASS_PALETTE.deepBlue,
  '--bg-light': SEAPASS_PALETTE.bgLight,
  '--bg-soft': SEAPASS_PALETTE.bgSoft,
  '--border-soft': SEAPASS_PALETTE.borderSoft,
  '--text-dark': SEAPASS_PALETTE.textDark,
} as const;

/**
 * User-visible identities for Easy Seas content areas. Imagery and copy give
 * each destination its purpose; the palette remains one shared Easy Seas
 * system so nested screens never feel like a separate application.
 */
export const TAB_VISUAL_THEMES = {
  offers: {
    label: 'Your Easy Seas overview',
    title: 'Home',
    subtitle: 'See what matters now across voyages, offers, loyalty, and certificates.',
    colors: ['#17324D', '#167C80', '#3D87BF'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  cruises: {
    label: 'Cruise discovery',
    title: 'Explore',
    subtitle: 'Find, compare, and watch available voyages.',
    colors: ['#17324D', '#167C80', '#3D87BF'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  booked: {
    label: 'Your voyage portfolio',
    title: 'My Voyages',
    subtitle: 'Manage reservations, itineraries, readiness, documents, and value.',
    colors: ['#17324D', '#167C80', '#3D87BF'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  calendar: {
    label: 'Voyage planning',
    title: 'Calendar',
    subtitle: 'Daily agendas, monthly plans, voyage weather, and important events.',
    colors: ['#17324D', '#167C80', '#3D87BF'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  casino: {
    label: 'Casino intelligence',
    title: 'Casino',
    subtitle: 'Understand status, play, cruise results, calculations, and strategy.',
    colors: ['#17324D', '#123D73', '#167C80'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  slots: {
    label: 'Machine guide and play records',
    title: 'Slots',
    subtitle: 'Track machines, play observations, settings, and opportunity signals.',
    colors: ['#17324D', '#123D73', '#167C80'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
  settings: {
    label: 'Account and app controls',
    title: 'Settings',
    subtitle: 'Profiles, sync, imports, backups, persistence, diagnostics, and access.',
    colors: ['#17324D', '#66737F', '#167C80'] as const,
    accent: '#167C80',
    soft: '#DFF2EF',
  },
} as const;

export type EasySeasTabThemeKey = keyof typeof TAB_VISUAL_THEMES;

export const EASY_SEAS_UX = {
  color: {
    brandNavy: '#17324D',
    oceanTeal: '#167C80',
    seafoam: '#DFF2EF',
    sand: '#F5F1E8',
    sky: '#DCECF4',
    ivory: '#FFFDF9',
    canvas: '#F7F9FA',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceMuted: '#DFF2EF',
    textStrong: '#17212B',
    textMuted: '#66737F',
    border: '#D9E1E6',
    success: '#237A4B',
    successSoft: '#E7F5EC',
    warning: '#A86B00',
    warningSoft: '#FFF4D6',
    danger: '#B53A3A',
    dangerSoft: '#FCE8E8',
    info: '#2C64A0',
    infoSoft: '#E8F1FA',
  },
  radius: { card: 14, control: 10, pill: 999 },
  pagePadding: 16,
  cardPadding: 16,
  cardGap: 16,
  sectionGap: 24,
  minimumTarget: 44,
  motion: { feedback: 150, transition: 230, dataStory: 380 },
} as const;

/**
 * Canonical visual hierarchy for every Easy Seas screen.  Screens may scale
 * these values for Dynamic Type, but should not invent another hierarchy.
 */
export const EASY_SEAS_TYPE_STYLES = {
  displayTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 38, lineHeight: 43, fontWeight: '600', letterSpacing: -0.7 },
  pageTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.4 },
  sectionTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 21, lineHeight: 27, fontWeight: '600', letterSpacing: -0.2 },
  cardTitle: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 18, lineHeight: 23, fontWeight: '600' },
  body: { fontFamily: 'SourceSerif4-Regular', fontSize: 15, lineHeight: 21, fontWeight: '400' },
  narrative: { fontFamily: 'SourceSerif4-Regular', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontFamily: 'System', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontFamily: 'System', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  metric: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 28, lineHeight: 32, fontWeight: '600' },
  badge: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  button: { fontFamily: 'System', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  evidence: { fontFamily: 'SourceSerif4-Regular', fontSize: 12, lineHeight: 18, fontWeight: '400' },
} as const;

export const EASY_SEAS_PHOTO_POLICY = {
  cardAspectRatio: 1.58,
  heroAspectRatio: 1.24,
  thumbnailAspectRatio: 1,
  resizeMode: 'cover',
  overlay: 'rgba(15, 34, 71, 0.16)',
} as const;

export const EASY_SEAS_ICON_GRAMMAR = {
  strokeWidth: 1.8,
  small: 14,
  medium: 18,
  large: 24,
  decorative: 34,
} as const;

/** Eight-point layout grid with a four-point half-step for compact metadata. */
export const EASY_SEAS_COMPONENT_TOKENS = {
  grid: 8,
  halfGrid: 4,
  pagePadding: 16,
  sectionGap: 24,
  cardGap: 16,
  cardPadding: 16,
  cardRadius: 14,
  controlRadius: 10,
  minimumTarget: 44,
  borderWidth: 1,
  dividerWidth: 1,
  shadowColor: '#0F2247',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
} as const;

export const COLORS = {
  // Primary Navy for text and displays
  navy: '#1C2F7A',
  navyDark: '#0F2247',
  navyLight: '#123D73',
  
  // Tier Colors - SIGNATURE = Purple, DIAMOND PLUS = Teal
  tierSignature: '#2C1D9A',
  tierSignatureLight: '#5A43D6',
  tierSignatureBg: 'rgba(44, 29, 154, 0.12)',
  tierDiamondPlus: '#5A43D6',
  tierDiamondPlusLight: '#725FDE',
  tierDiamondPlusBg: 'rgba(90, 67, 214, 0.12)',
  tierPrime: '#8A1FD1',
  tierPrimeBg: 'rgba(138, 31, 209, 0.12)',
  tierChoice: '#D87924',
  tierChoiceBg: 'rgba(216, 121, 36, 0.12)',
  tierMasters: '#22201E',
  tierMastersBg: 'rgba(34, 32, 30, 0.12)',
  tierPinnacle: '#273D9A',
  tierPinnacleBg: 'rgba(39, 61, 154, 0.12)',
  
  // Crown & Anchor Tiers
  tierEmerald: '#4EC0A5',
  tierEmeraldBg: 'rgba(16, 185, 129, 0.12)',
  tierDiamond: '#3E84D9',
  tierDiamondBg: 'rgba(0, 188, 212, 0.12)',
  
  // Money - Dark Bright Green
  money: '#16755F',
  moneyDark: '#16755F',
  moneyLight: '#4EC0A5',
  moneyBg: 'rgba(5, 150, 105, 0.12)',
  
  // Loyalty Status - Purple
  loyalty: '#2C1D9A',
  loyaltyDark: '#5E2270',
  loyaltyLight: '#5A43D6',
  loyaltyBg: 'rgba(123, 45, 142, 0.12)',
  
  // Club Royale Points - Teal
  points: '#0E7FA7',
  pointsDark: '#123D73',
  pointsLight: '#3D87BF',
  pointsBg: 'rgba(14, 127, 167, 0.12)',
  
  // Text Colors
  textNavy: '#1C2F7A',
  textDarkGrey: '#676A70',
  textMuted: '#8E8A89',
  textBlack: '#333334',
  textLabel: '#676A70',
  
  // Background Colors
  white: '#FFFFFF',
  bgSecondary: '#F3F3F2',
  bgTertiary: '#F5F5F4',
  
  // Tab styling
  tabSelectedBg: '#FFFFFF',
  tabUnselectedBg: 'rgba(0, 151, 167, 0.08)',
  tabSelectedText: '#1C2F7A',
  tabUnselectedText: '#676A70',
  tabShadow: 'rgba(0, 0, 0, 0.08)',
  
  // Border Colors
  borderLight: '#D5D5D0',
  borderMedium: '#D5D5D0',
  
  // Action/Button Colors
  actionPrimary: '#1C2F7A',
  actionSecondary: '#0E7FA7',
  
  // Status Colors
  success: '#16755F',
  warning: '#E6B63D',
  error: '#A52B34',
  info: '#0E7FA7',
  
  // Gold Accent
  gold: '#E6B63D',
  goldDark: '#A46000',
  goldLight: '#E6B63D',
  goldBg: 'rgba(212, 160, 10, 0.12)',
  
  // Core colors
  primary: '#1C2F7A',
  text: '#1C2F7A',
  textTertiary: '#8E8A89',
  border: '#D5D5D0',

  // Legacy support
  primaryDark: '#1C2F7A',
  primaryGradientStart: '#1C2F7A',
  primaryGradientEnd: '#2C1D9A',
  highlightAqua: '#0E7FA7',
  textPrimary: '#1C2F7A',
  textSecondary: '#676A70',
  textOnDark: '#FFFFFF',
  textOnDarkSecondary: '#D5D5D0',
  accentMagenta: '#2C1D9A',
  violetGlow: '#2C1D9A',
  royalBlueDeep: '#1C2F7A',
  electricAqua: '#0E7FA7',
  iceWhite: '#F3F3F2',
  mutedLavender: '#D5D5D0',
  neonMagenta: '#2C1D9A',
  
  navyDeep: '#1C2F7A',
  navyMedium: '#123D73',
  navyBorder: '#0E7FA7',
  oceanicBlue: '#1C2F7A',
  oceanicBlueMedium: '#123D73',
  oceanicBlueLight: '#0E7FA7',
  aquaAccent: '#0E7FA7',
  lightBlue: '#3D87BF',
  skyBlue: '#3D87BF',
  seafoam: '#4EC0A5',
  
  sectionBgLight: '#F3F3F2',
  sectionBgMedium: '#F5F5F4',
  sectionBgDark: '#D5D5D0',
  
  beigeWarm: '#E6B63D',
  beigeMuted: '#F5E6D3',
  beigeLight: '#FEF3C7',
  creamWhite: '#F3F3F2',
  
  goldAccent: '#E6B63D',
  goldRich: '#A46000',
  champagne: '#FEF3C7',
  ivory: '#FFFFF0',
  platinum: '#D5D5D0',
  coralAccent: '#D83A4A',
  tealAccent: '#0E7FA7',
  royalPurple: '#2C1D9A',
  royalPurpleLight: '#5A43D6',
  
  black: '#000000',
  transparent: 'transparent',
  
  cardBackground: '#FFFFFF',
  cardBackgroundDark: '#F3F3F2',
  cardBorder: '#D5D5D0',
  cardBorderAccent: 'rgba(123, 45, 142, 0.2)',
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(255, 255, 255, 0.1)',
  surfaceLight: '#F3F3F2',
  surfaceDark: '#1C2F7A',
  
  // Clean Design System
  cleanBg: '#FFFFFF',
  cleanBgSecondary: '#F3F3F2',
  cleanBgTertiary: '#F5F5F4',
  cleanTextNavy: '#1C2F7A',
  cleanTextDarkGrey: '#676A70',
  cleanTextMuted: '#8E8A89',
  cleanBorderLight: '#D5D5D0',
  cleanBorderMedium: '#D5D5D0',
  cleanActiveNavy: '#1C2F7A',
  cleanActiveBg: 'rgba(30, 58, 95, 0.08)',
  cleanIconGrey: '#676A70',
  cleanSearchBg: '#F3F3F2',
  cleanDivider: '#D5D5D0',
};

export const GRADIENTS = {
  primary: ['#1C2F7A', '#2C1D9A'],
  navy: ['#1C2F7A', '#123D73', '#0E7FA7'],
  navyToPurple: ['#1C2F7A', '#2C1D9A'],
  nautical: ['#0E7FA7', '#2C1D9A', '#FFFFFF', '#E6B63D'],
  nauticalCard: ['rgba(0, 151, 167, 0.08)', 'rgba(123, 45, 142, 0.05)', 'rgba(212, 160, 10, 0.03)'],
  beige: ['#E6B63D', '#FEF3C7'],
  card: ['#FFFFFF', '#F5F5F4'],
  cardDark: ['rgba(30, 58, 95, 0.98)', 'rgba(123, 45, 142, 0.92)'],
  header: ['#1C2F7A', '#123D73'],
  tabBar: ['rgba(255, 255, 255, 0.98)', 'rgba(250, 250, 250, 0.95)'],
  tabBarDark: ['rgba(30, 58, 95, 0.98)', 'rgba(46, 80, 119, 0.95)'],
  button: ['#2C1D9A', '#5A43D6'],
  buttonGold: ['#E6B63D', '#E6B63D'],
  buttonTeal: ['#0E7FA7', '#0E7FA7'],
  success: ['#16755F', '#4EC0A5'],
  danger: ['#A52B34', '#A52B34'],
  luxuryGold: ['#E6B63D', '#E6B63D', '#A46000'],
  luxuryNavy: ['#1C2F7A', '#123D73', '#0E7FA7'],
  luxuryCream: ['#F3F3F2', '#F5F5F4'],
  agentX: ['#E6B63D', '#2C1D9A'],
  hero: ['#1C2F7A', '#2C1D9A'],
  offerCard: ['rgba(30, 58, 95, 0.95)', 'rgba(123, 45, 142, 0.85)'],
  tier: {
    choice: ['#676A70', '#8E8A89'],
    prime: ['#3B82F6', '#3D87BF'],
    signature: ['#2C1D9A', '#5A43D6'],
    masters: ['#E6B63D', '#E6B63D'],
    diamondPlus: ['#0E7FA7', '#0E7FA7'],
  },
};

export const TYPOGRAPHY = {
  fontFamily: 'System' as const,
  fontFamilyBold: 'System' as const,
  fontFamilyEditorial: 'SourceSerif4-Regular' as const,
  fontFamilyEditorialSemibold: 'SourceSerif4-SemiBold' as const,
  fontFamilyEditorialBold: 'SourceSerif4-Bold' as const,
  
  fontSizeXS: 12,
  fontSizeSM: 14,
  fontSizeMD: 16,
  fontSizeLG: 18,
  fontSizeXL: 20,
  fontSizeXXL: 24,
  fontSizeTitle: 28,
  fontSizeHeader: 32,
  fontSizeHero: 40,
  
  fontWeightLight: '300' as const,
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
  fontWeightBlack: '800' as const,
  
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
  
  letterSpacingTight: -0.5,
  letterSpacingNormal: 0,
  letterSpacingWide: 0.5,
  letterSpacingExtraWide: 1.5,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

export const LUXURY_THEME = {
  background: {
    primary: '#F3F6F7',
    secondary: '#EEF5F6',
    card: '#FFFDF9',
    overlay: 'rgba(30, 58, 95, 0.6)',
    dark: '#1C2F7A',
  },
  accent: {
    primary: '#1C2F7A',
    secondary: '#2C1D9A',
    gold: '#E6B63D',
    highlight: '#0E7FA7',
    teal: '#0E7FA7',
  },
  text: {
    primary: '#1C2F7A',
    secondary: '#676A70',
    accent: '#E6B63D',
    gold: '#E6B63D',
    muted: '#8E8A89',
    light: '#FFFFFF',
    onDark: '#FFFFFF',
    onDarkSecondary: 'rgba(255, 255, 255, 0.7)',
    onLight: '#1C2F7A',
    onLightSecondary: '#676A70',
  },
  border: {
    default: '#D5D5D0',
    accent: 'rgba(123, 45, 142, 0.25)',
    gold: 'rgba(212, 160, 10, 0.4)',
    subtle: '#F5F5F4',
  },
  chip: {
    gold: { bg: '#FEF3C7', text: '#92400E', border: '#E6B63D' },
    purple: { bg: 'rgba(123, 45, 142, 0.12)', text: '#2C1D9A', border: '#5A43D6' },
    blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#3D87BF' },
    green: { bg: 'rgba(5, 150, 105, 0.12)', text: '#16755F', border: '#4EC0A5' },
    teal: { bg: 'rgba(0, 151, 167, 0.12)', text: '#0E7FA7', border: '#0E7FA7' },
  },
};

export const CLEAN_THEME = {
  background: {
    primary: '#F3F6F7',
    secondary: '#EEF5F6',
    tertiary: '#F5F1E8',
    card: '#FFFDF9',
    elevated: '#FFFFFF',
    nauticalGradient: ['rgba(0, 151, 167, 0.06)', 'rgba(123, 45, 142, 0.04)', 'rgba(212, 160, 10, 0.02)'],
  },
  text: {
    primary: '#1C2F7A',
    secondary: '#676A70',
    muted: '#8E8A89',
    label: '#676A70',
    value: '#1C2F7A',
  },
  badge: {
    signature: { bg: 'rgba(123, 45, 142, 0.12)', text: '#2C1D9A', border: '#2C1D9A' },
    diamondPlus: { bg: 'rgba(0, 151, 167, 0.12)', text: '#0E7FA7', border: '#0E7FA7' },
    emerald: { bg: 'rgba(16, 185, 129, 0.12)', text: '#4EC0A5', border: '#4EC0A5' },
    yellow: { bg: '#FEF3C7', text: '#92400E', border: '#E6B63D' },
    green: { bg: 'rgba(5, 150, 105, 0.12)', text: '#16755F', border: '#16755F' },
    blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
    achieved: { bg: '#16755F', text: '#FFFFFF', border: '#16755F' },
  },
  header: {
    yellow: '#E6B63D',
    navy: '#1C2F7A',
  },
  border: {
    light: '#D5D5D0',
    medium: '#D5D5D0',
    focus: '#1C2F7A',
  },
  tab: {
    selectedBg: '#FFFFFF',
    selectedText: '#1C2F7A',
    selectedShadow: 'rgba(0, 0, 0, 0.1)',
    unselectedBg: 'rgba(0, 151, 167, 0.08)',
    unselectedText: '#676A70',
  },
  filter: {
    inactive: '#676A70',
    active: '#1C2F7A',
    activeBg: 'rgba(30, 58, 95, 0.08)',
    hoverBg: '#F3F3F2',
  },
  action: {
    icon: '#676A70',
    iconActive: '#1C2F7A',
    label: '#676A70',
    labelActive: '#1C2F7A',
    bg: '#F3F3F2',
    bgActive: 'rgba(30, 58, 95, 0.08)',
    border: '#D5D5D0',
  },
  search: {
    bg: '#F3F3F2',
    text: '#1C2F7A',
    placeholder: '#8E8A89',
    icon: '#676A70',
    border: '#D5D5D0',
  },
  data: {
    value: '#1C2F7A',
    label: '#676A70',
    divider: '#D5D5D0',
    money: '#16755F',
    points: '#0E7FA7',
    loyalty: '#2C1D9A',
  },
  stats: {
    value: '#1C2F7A',
    label: '#676A70',
    dot: '#8E8A89',
    money: '#16755F',
    points: '#0E7FA7',
  },
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glow: {
    shadowColor: COLORS.royalPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  goldGlow: {
    shadowColor: COLORS.goldAccent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
};
