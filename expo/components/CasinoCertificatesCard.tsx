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
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

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
  onExaminePress?: () => void;
  showHeader?: boolean;
}

export const CasinoCertificatesCard = React.memo(function CasinoCertificatesCard({
  certificates,
  totalCertificates,
  availableCruises,
  onManagePress,
  onViewOffersPress,
  onExaminePress,
  showHeader = true,
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
        source={CASINO_BG}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(243,243,242,0.94)', 'rgba(255,255,255,0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientOverlay}
        >
          {showHeader ? <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={18} color="#0E7FA7" />
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
                <ChevronRight size={14} color="#1C2F7A" />
              </TouchableOpacity>
            )}
          </View> : null}

          <View style={styles.certificatesRow}>
            {certificates.map((cert, index) => {
              const Icon = getCertIcon(cert.type);
              return (
                <View key={`${cert.type}-${index}`} style={styles.certificateItem}>
                  <View style={styles.certIconContainer}>
                    <Icon size={18} color="#0E7FA7" />
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
          </View>

          {(onViewOffersPress || onExaminePress) ? (
            <View style={styles.actionRow}>
              {onViewOffersPress ? (
                <TouchableOpacity 
                  style={styles.viewOffersButton}
                  onPress={onViewOffersPress}
                  activeOpacity={0.7}
                  testID="casino-certificates-card.view-offers-button"
                >
                  <Text style={styles.viewOffersText}>View Certificates</Text>
                </TouchableOpacity>
              ) : null}

              {onExaminePress ? (
                <TouchableOpacity 
                  style={styles.examineButton}
                  onPress={onExaminePress}
                  activeOpacity={0.7}
                  testID="casino-certificates-card.examine-certificates-button"
                >
                  <Sparkles size={16} color={COLORS.navyDeep} />
                  <Text style={styles.examineButtonText}>Examine Certificates</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
});

// Bundled artwork keeps this important Offers section photorealistic even when
// the ship is offline or a third-party image host is unavailable.
const CASINO_BG = require('../assets/images/section-themes/offers-certificates-v1.png');

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5D5D0',
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
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#333334',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  countBadge: {
    backgroundColor: '#F3F3F2',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    marginLeft: SPACING.xs,
  },
  countBadgeText: {
    fontSize: 11,
    color: '#1C2F7A',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  manageText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#1C2F7A',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  certificatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  certificateItem: {
    alignItems: 'center',
    flex: 1,
  },
  certIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  certValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#333334',
  },
  certLabel: {
    fontSize: 10,
    color: '#8E8A89',
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
  },
  availableInfo: {},
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  availableLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#8E8A89',
  },
  availableValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#333334',
  },
  viewOffersButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  viewOffersText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  examineButton: {
    flex: 1.35,
    backgroundColor: '#F3F3F2',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  examineButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
});
