import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  TAB_VISUAL_THEMES,
  EASY_SEAS_COMPONENT_TOKENS,
  EASY_SEAS_TYPE_STYLES,
  TYPOGRAPHY,
  type EasySeasTabThemeKey,
} from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

type SectionTone = 'default' | 'info' | 'success' | 'warning' | 'casino' | 'weather';

interface ThemedSectionHeaderProps {
  tab: EasySeasTabThemeKey;
  title: string;
  subtitle?: string;
  emoji?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: SectionTone;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ThemedSectionCardProps extends ThemedSectionHeaderProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

const TONE_COLORS: Record<Exclude<SectionTone, 'default'>, { accent: string; soft: string }> = {
  info: { accent: '#3E84D9', soft: '#EDF5FC' },
  success: { accent: '#4EC0A5', soft: '#ECF8F4' },
  warning: { accent: '#E6B63D', soft: '#FFF8E5' },
  casino: { accent: '#273D9A', soft: '#F3EFFB' },
  weather: { accent: '#0E7FA7', soft: '#EAF7FA' },
};

function getSectionPalette(tab: EasySeasTabThemeKey, tone: SectionTone) {
  const theme = TAB_VISUAL_THEMES[tab];
  return tone === 'default'
    ? { accent: theme.accent, soft: theme.soft }
    : TONE_COLORS[tone];
}

/**
 * Shared editorial section heading for the seven fixed Easy Seas tabs.
 * The small visual badge gives every section its own identity while facts and
 * controls remain on a high-legibility surface. It intentionally owns no
 * interaction so existing routes, buttons, and actions remain unchanged.
 */
export function ThemedSectionHeader({
  tab,
  title,
  subtitle,
  emoji,
  icon,
  action,
  tone = 'default',
  compact = false,
  style,
  testID,
}: ThemedSectionHeaderProps) {
  const { colors, isDark, preferences, textScale } = useExperience();
  const palette = getSectionPalette(tab, tone);
  const isHighContrast = preferences.theme === 'high-contrast';
  const backgroundColors = isHighContrast || isDark
    ? [colors.surface, colors.surface]
    : [palette.soft, colors.surface];
  const titleFontSize = Math.min(30, (compact ? 19 : 22) * textScale);
  const subtitleFontSize = Math.min(20, 13 * textScale);

  return (
    <LinearGradient
      colors={backgroundColors as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.header,
        compact && styles.headerCompact,
        style,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.badge,
          compact && styles.badgeCompact,
          {
            backgroundColor: isHighContrast ? colors.background : `${palette.accent}12`,
            borderColor: isHighContrast ? colors.border : `${palette.accent}24`,
          },
        ]}
        accessible={false}
      >
        {icon ?? <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji || '⚓️'}</Text>}
      </View>
      <View style={styles.copy}>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: colors.text, fontSize: titleFontSize, lineHeight: Math.ceil(titleFontSize * 1.25) },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
            styles.subtitle,
            { color: colors.muted, fontSize: subtitleFontSize, lineHeight: Math.ceil(subtitleFontSize * 1.35) },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </LinearGradient>
  );
}

/**
 * Section shell with a themed editorial header and a separate readable fact
 * surface. Story photography belongs in PremiumVoyageArtwork, not behind dense
 * figures or controls.
 */
export function ThemedSectionCard({
  children,
  contentStyle,
  style,
  tab,
  tone = 'default',
  ...headerProps
}: ThemedSectionCardProps) {
  const { colors, isDark } = useExperience();
  const palette = getSectionPalette(tab, tone);
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }, style]}>
      <ThemedSectionHeader tab={tab} tone={tone} {...headerProps} style={[styles.cardHeader, { borderBottomColor: colors.border }]} />
      <LinearGradient
        colors={[colors.surfaceRaised, isDark ? colors.surfaceRaised : palette.soft] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.content, contentStyle]}
      >
        <View pointerEvents="none" style={[styles.contentAccent, { backgroundColor: palette.accent }]} />
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerCompact: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 11,
  },
  emoji: { fontSize: 17, lineHeight: 22 },
  emojiCompact: { fontSize: 15, lineHeight: 20 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    ...EASY_SEAS_TYPE_STYLES.sectionTitle,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...EASY_SEAS_TYPE_STYLES.caption,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
    marginTop: 2,
  },
  action: { marginLeft: 10, minHeight: 44, justifyContent: 'center' },
  card: {
    borderRadius: EASY_SEAS_COMPONENT_TOKENS.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: EASY_SEAS_COMPONENT_TOKENS.cardGap,
    shadowColor: EASY_SEAS_COMPONENT_TOKENS.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: EASY_SEAS_COMPONENT_TOKENS.shadowOffset,
    elevation: 2,
  },
  cardHeader: { borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0 },
  content: { position: 'relative', padding: EASY_SEAS_COMPONENT_TOKENS.cardPadding, paddingTop: 16, overflow: 'hidden' },
  contentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.48,
  },
});
