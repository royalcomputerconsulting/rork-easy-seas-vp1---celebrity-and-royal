import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface WelcomeSplashProps {
  onAnimationComplete: () => void;
  duration?: number;
}

const { width, height } = Dimensions.get('window');

export function WelcomeSplash({ onAnimationComplete, duration = 4000 }: WelcomeSplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoSlide = useRef(new Animated.Value(-30)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[WelcomeSplash] Starting animation');

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressWidth, {
      toValue: 1,
      duration: duration - 500,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      console.log('[WelcomeSplash] Animation complete');
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onAnimationComplete();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, logoSlide, textFade, progressWidth, duration, onAnimationComplete]);

  const progressBarWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.background}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: scaleAnim },
                  { translateY: logoSlide },
                ],
              },
            ]}
          >
            <Image 
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zf6f5olpoe2u2crfpswo2' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          <View style={styles.overlayContent}>
            <Animated.Text 
              style={[
                styles.tagline,
                { opacity: textFade }
              ]}
            >
              Manage your Nautical Lifestyle
            </Animated.Text>
            
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  { width: progressBarWidth }
                ]} 
              />
            </View>
            
            <Animated.Text 
              style={[
                styles.disclaimer,
                { opacity: textFade }
              ]}
            >
              DISCLAIMER: This app is for informational purposes only. Not a gambling manual. Royal Computer Consulting, Scott Merlis, and all associated parties take no responsibility for user actions. Use 100% at your own risk. If you have a gambling problem, call 1-800-522-4700 or visit www.gamblersanonymous.org
              {"\n\n"}
              TRADEMARK NOTICE: All trademarks, service marks, trade names, ship names, and logos, including but not limited to &quot;Club Royale,&quot; &quot;Blue Chip Club,&quot; &quot;Royal Caribbean,&quot; &quot;Celebrity Cruises,&quot; and all associated cruise ship names, are the property of their respective owners. Royal Computer Consulting and Scott Merlis have no affiliation, association, authorization, endorsement, or sponsorship with or by Royal Caribbean International, Celebrity Cruises, or any of their parent companies, subsidiaries, or affiliates.
            </Animated.Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  background: {
    flex: 1,
    backgroundColor: '#0077B6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '90%',
    height: '70%',
    maxWidth: width * 0.9,
    maxHeight: height * 0.7,
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: SPACING.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayContent: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  progressContainer: {
    width: width * 0.5,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  disclaimer: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
    lineHeight: 13,
  },
});
