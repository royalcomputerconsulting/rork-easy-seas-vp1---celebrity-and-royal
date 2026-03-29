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
import { ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '@/constants/theme';
import { DS } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
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
  isExpanded: controlledExpanded,
  headerStyle = 'default',
  showBorder = true,
  onToggle,
}: CollapsibleSectionProps) {
  const isControlled = controlledExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = isControlled ? controlledExpanded : internalExpanded;
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

    if (!isControlled) {
      setInternalExpanded(newExpanded);
    }
    onToggle?.(newExpanded);
    console.log('[CollapsibleSection] Toggled:', title, newExpanded);
  }, [expanded, rotateAnim, title, onToggle, isControlled]);

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.container, showBorder && styles.containerBorder]}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F8F8', '#FAFAFA']}
        locations={[0, 0.5, 1]}
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
            <ChevronDown size={16} color={DS.text.secondary} />
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
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    backgroundColor: DS.bg.card,
  },
  containerBorder: {
    borderWidth: 1,
    borderColor: DS.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerBackground: {
    borderTopLeftRadius: DS.radius.xl,
    borderTopRightRadius: DS.radius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.spacing.md,
    paddingHorizontal: DS.spacing.md,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.text.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: DS.font.lobster,
    color: DS.text.primary,
    letterSpacing: 0.2,
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 13,
    color: DS.text.secondary,
    marginTop: 2,
    fontFamily: DS.font.system,
    fontWeight: '500' as const,
  },
  content: {
    paddingTop: SPACING.xs,
    backgroundColor: DS.bg.card,
  },
  chevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: DS.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
