import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  EASY_SEAS_COMPONENT_TOKENS,
  EASY_SEAS_TYPE_STYLES,
  TAB_VISUAL_THEMES,
  TYPOGRAPHY,
  type EasySeasTabThemeKey,
} from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

interface TabIdentityBandProps {
  tab: EasySeasTabThemeKey;
  detail?: string;
  compact?: boolean;
  textOnly?: boolean;
  testID?: string;
}

const TAB_ARTWORK = {
  offers: require('../../assets/images/section-themes/offers-certificates-v1.png'),
  cruises: require('../../assets/images/section-themes/cruises-discovery-v1.png'),
  booked: require('../../assets/images/section-themes/booked-voyages-v1.png'),
  calendar: require('../../assets/images/section-themes/calendar-agenda-v1.png'),
  casino: require('../../assets/images/section-themes/casino-intelligence-v1.png'),
  slots: require('../../assets/images/section-themes/slots-machines-v1.png'),
  settings: require('../../assets/images/section-themes/settings-trust-v1.png'),
} as const;

/**
 * A lightweight, non-interactive identity band. It deliberately owns no tab
 * actions, so adding it cannot remove, intercept, or relocate existing work.
 */
export function TabIdentityBand({ tab, detail, compact = false, textOnly = false, testID }: TabIdentityBandProps) {
  const theme = TAB_VISUAL_THEMES[tab];
  const { width } = useWindowDimensions();
  const { colors, isDark, preferences, textScale } = useExperience();
  const [artworkFailed, setArtworkFailed] = useState(false);
  const bandHeight = textOnly ? 136 : compact ? (width >= 768 ? 238 : 208) : (width >= 768 ? 280 : 248);

  useEffect(() => { setArtworkFailed(false); }, [tab]);

  return (
    <View
      style={[
        styles.band,
        compact && styles.bandCompact,
        textOnly && styles.bandTextOnly,
        { minHeight: bandHeight, backgroundColor: theme.colors[0], borderColor: colors.border },
      ]}
      testID={testID ?? `tab-identity-${tab}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${theme.label}. ${theme.title}. ${theme.subtitle}`}
    >
      {!textOnly && !artworkFailed ? (
        <Image
          source={TAB_ARTWORK[tab]}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={preferences.reducedMotion ? 0 : 180}
          onError={() => setArtworkFailed(true)}
          accessible={false}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <LinearGradient
        colors={preferences.theme === 'high-contrast'
          ? ['rgba(0,0,0,1)', 'rgba(0,0,0,.94)', 'rgba(0,0,0,.48)']
          : isDark
            ? ['rgba(7,22,36,.98)', 'rgba(7,22,36,.86)', 'rgba(7,22,36,.18)']
            : artworkFailed || textOnly
              ? ['rgba(255,252,247,1)', 'rgba(237,244,243,.96)', 'rgba(220,236,244,.82)']
              : ['rgba(255,252,247,.98)', 'rgba(255,252,247,.86)', 'rgba(255,252,247,.12)']}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.overlay}
      >
        <View style={[styles.accent, { backgroundColor: theme.accent }]} />
        <Text style={[styles.eyebrow, { color: isDark ? colors.accentSecondary : '#0E7FA7' }, preferences.theme === 'high-contrast' && styles.highContrastText]}>{theme.label}</Text>
        <Text style={[styles.title, { color: colors.heroText }, preferences.theme === 'high-contrast' && styles.highContrastText, { fontSize: Math.min(33, 27 * textScale), lineHeight: Math.min(39, 33 * textScale) }]}>{theme.title}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }, preferences.theme === 'high-contrast' && styles.highContrastSubtitle, { fontSize: Math.min(18, 14 * textScale), lineHeight: Math.min(23, 19 * textScale), maxWidth: width >= 768 ? '50%' : '68%' }]}>{theme.subtitle}</Text>
        {detail ? (
          <View style={[styles.detailPill, { backgroundColor: colors.surfaceRaised, borderColor: colors.accentSecondary }, preferences.theme === 'high-contrast' && styles.highContrastPill]}> 
            <Text style={[styles.detailText, { color: colors.accent }, preferences.theme === 'high-contrast' && styles.highContrastText]}>{detail}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    borderRadius: 14,
    minHeight: 248,
    marginBottom: EASY_SEAS_COMPONENT_TOKENS.cardGap,
    overflow: 'hidden',
    borderWidth: EASY_SEAS_COMPONENT_TOKENS.borderWidth,
    borderColor: '#D5D5D0',
    shadowColor: EASY_SEAS_COMPONENT_TOKENS.shadowColor,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  bandCompact: {
    borderRadius: 14,
    minHeight: 208,
    marginBottom: EASY_SEAS_COMPONENT_TOKENS.cardGap,
  },
  bandTextOnly: {
    minHeight: 148,
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 0,
  },
  eyebrow: {
    ...EASY_SEAS_TYPE_STYLES.badge,
    color: '#0E7FA7',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    ...EASY_SEAS_TYPE_STYLES.pageTitle,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    color: '#333334',
    letterSpacing: -0.35,
    marginTop: 8,
  },
  subtitle: {
    ...EASY_SEAS_TYPE_STYLES.body,
    color: '#58585B',
    marginTop: 8,
    maxWidth: '68%',
  },
  detailPill: {
    alignSelf: 'flex-start',
    borderWidth: EASY_SEAS_COMPONENT_TOKENS.borderWidth,
    borderRadius: 999,
    borderColor: 'rgba(14,127,167,.38)',
    backgroundColor: 'rgba(255,253,249,0.94)',
    paddingHorizontal: EASY_SEAS_COMPONENT_TOKENS.grid + EASY_SEAS_COMPONENT_TOKENS.halfGrid,
    paddingVertical: EASY_SEAS_COMPONENT_TOKENS.halfGrid + 2,
    marginTop: 12,
  },
  detailText: {
    ...EASY_SEAS_TYPE_STYLES.badge,
    color: '#1C2F7A',
  },
  highContrastText: { color: '#FFFFFF' },
  highContrastSubtitle: { color: 'rgba(255,255,255,.88)' },
  highContrastPill: { backgroundColor: '#000000', borderColor: '#FFFFFF' },
});
