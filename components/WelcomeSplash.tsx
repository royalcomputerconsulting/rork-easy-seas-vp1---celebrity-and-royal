import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';

interface WelcomeSplashProps {
  onAnimationComplete: () => void;
  duration?: number;
}

export function WelcomeSplash({ onAnimationComplete, duration = 2000 }: WelcomeSplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[WelcomeSplash] Starting animation');

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
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
  }, [fadeAnim, duration, onAnimationComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.background}>
        <Image
          source={require('@/assets/images/story-post-1080x1920.png')}
          style={styles.bannerImage}
          resizeMode="cover"
        />
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
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
