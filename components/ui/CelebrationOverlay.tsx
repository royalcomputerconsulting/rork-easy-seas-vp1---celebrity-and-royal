import React, { useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Trophy, Star, Sparkles, Crown, Award, Zap } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CelebrationOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  type?: 'achievement' | 'tier' | 'jackpot' | 'streak' | 'milestone';
  title: string;
  subtitle?: string;
  iconType?: 'trophy' | 'star' | 'sparkles' | 'crown' | 'award' | 'zap';
  autoHideDuration?: number;
}

export function CelebrationOverlay({
  visible,
  onDismiss,
  type = 'achievement',
  title,
  subtitle,
  iconType = 'trophy',
  autoHideDuration = 3000,
}: CelebrationOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array(12).fill(0).map(() => ({
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const triggerHaptics = useCallback(async () => {
    if (Platform.OS === 'web') return;
    
    try {
      if (type === 'jackpot') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 200);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 350);
      } else if (type === 'tier') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log('[Celebration] Haptics failed:', error);
    }
  }, [type]);

  const animateParticles = useCallback(() => {
    particleAnims.forEach((anim, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const distance = 100 + Math.random() * 50;
      const delay = index * 30;

      anim.translateX.setValue(0);
      anim.translateY.setValue(0);
      anim.opacity.setValue(0);
      anim.scale.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim.translateX, {
            toValue: Math.cos(angle) * distance,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: Math.sin(angle) * distance,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 450,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.spring(anim.scale, {
              toValue: 1,
              useNativeDriver: true,
              friction: 4,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    });
  }, [particleAnims]);

  const dismissAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [opacityAnim, scaleAnim, onDismiss]);

  useEffect(() => {
    if (visible) {
      triggerHaptics();
      
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      iconRotateAnim.setValue(0);
      shineAnim.setValue(0);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 3,
            tension: 150,
          }),
        ]),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.loop(
          Animated.timing(shineAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          })
        ),
      ]).start();

      animateParticles();

      const timer = setTimeout(() => {
        dismissAnimation();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [visible, triggerHaptics, animateParticles, dismissAnimation, autoHideDuration, scaleAnim, opacityAnim, iconScaleAnim, iconRotateAnim, shineAnim]);

  const iconRotation = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shineTranslate = shineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 150],
  });

  const getGradientColors = () => {
    switch (type) {
      case 'jackpot':
        return ['#FFD700', '#FFA500', '#FF6B00'] as const;
      case 'tier':
        return ['#9333EA', '#7C3AED', '#6366F1'] as const;
      case 'streak':
        return ['#F97316', '#FB923C', '#FBBF24'] as const;
      case 'milestone':
        return ['#10B981', '#34D399', '#6EE7B7'] as const;
      default:
        return [COLORS.beigeWarm, COLORS.goldDark, '#D4A574'] as const;
    }
  };

  const getIcon = () => {
    const iconColor = type === 'jackpot' ? '#FFD700' : COLORS.white;
    const iconSize = 48;
    
    switch (iconType) {
      case 'star':
        return <Star size={iconSize} color={iconColor} fill={iconColor} />;
      case 'sparkles':
        return <Sparkles size={iconSize} color={iconColor} />;
      case 'crown':
        return <Crown size={iconSize} color={iconColor} fill={iconColor} />;
      case 'award':
        return <Award size={iconSize} color={iconColor} />;
      case 'zap':
        return <Zap size={iconSize} color={iconColor} fill={iconColor} />;
      default:
        return <Trophy size={iconSize} color={iconColor} fill={iconColor} />;
    }
  };

  const particleColors = ['#FFD700', '#FFA500', '#FF6B00', '#9333EA', '#10B981', '#F97316'];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View 
        style={[
          styles.overlay, 
          { opacity: opacityAnim }
        ]}
      >
        <Animated.View 
          style={[
            styles.container,
            { 
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={getGradientColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Animated.View 
              style={[
                styles.shineOverlay,
                { transform: [{ translateX: shineTranslate }] },
              ]}
            />

            {particleAnims.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  {
                    backgroundColor: particleColors[index % particleColors.length],
                    transform: [
                      { translateX: anim.translateX },
                      { translateY: anim.translateY },
                      { scale: anim.scale },
                    ],
                    opacity: anim.opacity,
                  },
                ]}
              />
            ))}

            <Animated.View 
              style={[
                styles.iconContainer,
                {
                  transform: [
                    { scale: iconScaleAnim },
                    { rotate: iconRotation },
                  ],
                },
              ]}
            >
              {getIcon()}
            </Animated.View>

            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            <View style={styles.starsContainer}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={{
                    transform: [{ scale: iconScaleAnim }],
                    opacity: iconScaleAnim,
                  }}
                >
                  <Star 
                    size={16} 
                    color="#FFD700" 
                    fill="#FFD700" 
                    style={{ marginHorizontal: 4 }}
                  />
                </Animated.View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface TierUpCelebrationProps {
  visible: boolean;
  onDismiss: () => void;
  newTier: string;
  previousTier?: string;
}

export function TierUpCelebration({
  visible,
  onDismiss,
  newTier,
  previousTier,
}: TierUpCelebrationProps) {
  return (
    <CelebrationOverlay
      visible={visible}
      onDismiss={onDismiss}
      type="tier"
      title={`Welcome to ${newTier}!`}
      subtitle={previousTier ? `Upgraded from ${previousTier}` : 'You earned a new tier!'}
      iconType="crown"
      autoHideDuration={4000}
    />
  );
}

interface JackpotCelebrationProps {
  visible: boolean;
  onDismiss: () => void;
  amount: string;
}

export function JackpotCelebration({
  visible,
  onDismiss,
  amount,
}: JackpotCelebrationProps) {
  return (
    <CelebrationOverlay
      visible={visible}
      onDismiss={onDismiss}
      type="jackpot"
      title="JACKPOT!"
      subtitle={`You won ${amount}!`}
      iconType="sparkles"
      autoHideDuration={5000}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 340,
    paddingVertical: SPACING.xl * 1.5,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ skewX: '-20deg' }],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  particle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
