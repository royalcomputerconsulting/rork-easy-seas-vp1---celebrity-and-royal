import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import type { GatedFeature } from '@/lib/featureGating';

interface ContextualPaywallProps {
  visible: boolean;
  onClose: () => void;
  feature: GatedFeature;
  title?: string;
  message?: string;
}

const FEATURE_TITLES: Record<GatedFeature, string> = {
  'analytics': 'Analytics',
  'agent-x': 'Agent X',
  'alerts': 'Alerts',
  'slots': 'SLOTS',
  'sync': 'Data Sync',
  'import': 'Import Data',
  'add-edit': 'Add/Edit Data',
  'sessions': 'Sessions',
  'offer-optimizer': 'Offer Optimizer',
};

const FEATURE_MESSAGES: Record<GatedFeature, string> = {
  'analytics': 'Get detailed insights and performance analytics with Pro.',
  'agent-x': 'Unlock AI-powered assistance with Pro.',
  'alerts': 'Set up custom alerts and notifications with Pro.',
  'slots': 'Access the full SLOTS experience with Pro.',
  'sync': 'Sync your data across devices with Basic or Pro.',
  'import': 'Import new data with Basic or Pro.',
  'add-edit': 'Add and edit entries with Basic or Pro.',
  'sessions': 'Track sessions with Basic or Pro.',
  'offer-optimizer': 'Optimize your offers.',
};

export function ContextualPaywall({
  visible,
  onClose,
  feature,
  title,
  message,
}: ContextualPaywallProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push('/paywall' as any);
  };

  const displayTitle = title || FEATURE_TITLES[feature] || 'Premium Feature';
  const displayMessage = message || FEATURE_MESSAGES[feature] || 'This feature requires a subscription.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="contextual-paywall"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#0B1B33', '#123A63']}
            style={styles.gradient}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
              testID="contextual-paywall.close"
            >
              <X size={24} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.iconContainer}>
              <Lock size={48} color={COLORS.money} />
            </View>

            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.message}>{displayMessage}</Text>

            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              activeOpacity={0.9}
              testID="contextual-paywall.upgrade"
            >
              <Sparkles size={20} color={COLORS.white} />
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notNowButton}
              onPress={onClose}
              activeOpacity={0.8}
              testID="contextual-paywall.not-now"
            >
              <Text style={styles.notNowText}>Not Now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.xl,
  },
  gradient: {
    padding: 24,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.money,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  notNowButton: {
    paddingVertical: 12,
  },
  notNowText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
