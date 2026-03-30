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
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';

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
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    
    LayoutAnimation.configureNext({
      duration: 200,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    
    Animated.timing(rotateAnim, {
      toValue: newExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
    console.log('[CollapsibleSection] Toggled:', title, newExpanded);
  }, [expanded, rotateAnim, title, onToggle]);

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const marbleConfig = MARBLE_TEXTURES.navyBlue;

  return (
    <View style={[styles.container, showBorder && styles.containerBorder]}>
      <LinearGradient
        colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
        locations={marbleConfig.gradientLocations}
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
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, headerStyle === 'compact' && styles.titleCompact]}>
                {title}
              </Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          
          <Animated.View style={[styles.chevronContainer, { transform: [{ rotate: iconRotation }] }]}>
            <ChevronUp size={18} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>
      
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  containerBorder: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  headerBackground: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
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
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  content: {
    paddingTop: SPACING.xs,
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
