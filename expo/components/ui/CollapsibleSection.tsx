import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, TAB_VISUAL_THEMES, type EasySeasTabThemeKey } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  headerStyle?: 'default' | 'compact';
  showBorder?: boolean;
  onToggle?: (expanded: boolean) => void;
  tab?: EasySeasTabThemeKey;
  emoji?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  children,
  defaultExpanded = true,
  headerStyle = 'default',
  showBorder = true,
  onToggle,
  tab,
  emoji,
}: CollapsibleSectionProps) {
  const { colors, isDark, preferences } = useExperience();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    
    if (!preferences.reducedMotion) {
      LayoutAnimation.configureNext({
        duration: 200,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
    }
    
    Animated.timing(rotateAnim, {
      toValue: newExpanded ? 1 : 0,
      duration: preferences.reducedMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
    
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
    console.log('[CollapsibleSection] Toggled:', title, newExpanded);
  }, [expanded, onToggle, preferences.reducedMotion, rotateAnim, title]);

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const tabTheme = tab ? TAB_VISUAL_THEMES[tab] : null;
  const headerColors = preferences.theme === 'high-contrast' || isDark
    ? [colors.surface, colors.surface]
    : [tabTheme?.soft ?? '#EEF5F6', colors.surface];
  const headingColor = colors.text;
  const supportingColor = colors.muted;
  const accentColor = tabTheme?.accent ?? '#0E7FA7';

  return (
    <View style={[styles.container, showBorder && styles.containerBorder, showBorder && { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <LinearGradient
        colors={headerColors as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBackground}
      >
        <TouchableOpacity
          style={[
            styles.header,
            headerStyle === 'compact' && styles.headerCompact,
          ]}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            {(icon || emoji) && <View style={[styles.iconContainer, { backgroundColor: '#F3F3F2', borderWidth: 1, borderColor: `${accentColor}66` }]}>{icon ?? <Text style={styles.emoji}>{emoji}</Text>}</View>}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: headingColor }, headerStyle === 'compact' && styles.titleCompact]}>
                {title}
              </Text>
              {subtitle && <Text style={[styles.subtitle, { color: supportingColor }]}>{subtitle}</Text>}
            </View>
          </View>
          
          <Animated.View style={[styles.chevronContainer, { transform: [{ rotate: iconRotation }] }]}>
            <ChevronUp size={18} color={accentColor} />
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>
      
      {expanded && <View style={[styles.content, { backgroundColor: colors.surface }]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    borderRadius: 24,
    overflow: 'hidden',
  },
  containerBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFCF7',
    shadowColor: '#0F2247',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  headerBackground: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  headerCompact: {
    paddingVertical: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: { fontSize: 18, lineHeight: 22 },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#333334',
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#8E8A89',
    marginTop: 2,
  },
  content: {
    paddingTop: SPACING.xs,
    backgroundColor: '#FFFDF9',
  },
  chevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
