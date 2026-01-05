import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronRight, 
  Sparkles,
  CircleDollarSign,
  Ticket,
  Gift,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';

interface CertificateInfo {
  type: 'fpp' | 'nextCruise' | 'obc';
  label: string;
  value: number;
  description?: string;
}

interface CasinoCertificatesCardProps {
  certificates: CertificateInfo[];
  totalCertificates: number;
  availableCruises: number;
  onManagePress?: () => void;
  onViewOffersPress?: () => void;
}

export function CasinoCertificatesCard({
  certificates,
  totalCertificates,
  availableCruises,
  onManagePress,
  onViewOffersPress,
}: CasinoCertificatesCardProps) {
  const getCertIcon = (type: string) => {
    switch (type) {
      case 'fpp':
        return CircleDollarSign;
      case 'nextCruise':
        return Ticket;
      case 'obc':
        return Gift;
      default:
        return Sparkles;
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={{ uri: CASINO_BG }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(212, 160, 10, 0.88)', 'rgba(123, 45, 142, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientOverlay}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={18} color="#FEF3C7" />
              <Text style={styles.title}>Casino & Certificates</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalCertificates} Total</Text>
              </View>
            </View>
            
            {onManagePress && (
              <TouchableOpacity 
                style={styles.manageButton}
                onPress={onManagePress}
                activeOpacity={0.7}
              >
                <Text style={styles.manageText}>Manage</Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.certificatesRow}>
            {certificates.map((cert, index) => {
              const Icon = getCertIcon(cert.type);
              return (
                <View key={`${cert.type}-${index}`} style={styles.certificateItem}>
                  <View style={styles.certIconContainer}>
                    <Icon size={18} color="#FEF3C7" />
                  </View>
                  <Text style={styles.certValue}>{cert.value}</Text>
                  <Text style={styles.certLabel}>{cert.label}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.footer}>
            <View style={styles.availableInfo}>
              <Text style={styles.availableLabel}>Available Cruises</Text>
              <Text style={styles.availableValue}>{availableCruises.toLocaleString()}</Text>
            </View>
            
            {onViewOffersPress && (
              <TouchableOpacity 
                style={styles.viewOffersButton}
                onPress={onViewOffersPress}
                activeOpacity={0.7}
              >
                <Text style={styles.viewOffersText}>View Offers</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const CASINO_BG = 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&q=80';

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
  },
  gradientOverlay: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    marginLeft: SPACING.xs,
  },
  countBadgeText: {
    fontSize: 11,
    color: '#FEF3C7',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  manageText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  certificatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  certificateItem: {
    alignItems: 'center',
    flex: 1,
  },
  certIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  certValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  certLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  availableInfo: {},
  availableLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.7)',
  },
  availableValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  viewOffersButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  viewOffersText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
});
