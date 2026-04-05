import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Sparkles,
  CircleDollarSign,
  Ticket,
  Gift,
} from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { getFocusTheme } from '@/constants/focusThemes';
import { useUser } from '@/state/UserProvider';

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

export const CasinoCertificatesCard = React.memo(function CasinoCertificatesCard({
  certificates,
  totalCertificates,
  availableCruises,
  onManagePress,
  onViewOffersPress,
}: CasinoCertificatesCardProps) {
  const { currentUser } = useUser();
  const theme = getFocusTheme(currentUser?.preferredBrand);

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
    <View style={[styles.container, { borderColor: theme.cardBorder }]}>
      <LinearGradient
        colors={theme.marbleGradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientOverlay}
      >
        <View pointerEvents="none" style={[styles.marbleBlobPrimary, { backgroundColor: theme.marbleVein }]} />
        <View pointerEvents="none" style={[styles.marbleBlobSecondary, { borderColor: theme.marbleVeinAlt }]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: theme.iconSurface, borderColor: theme.iconBorder }]}>
              <Sparkles size={18} color={theme.actionPrimary} />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Casino & Certificates</Text>
            <View style={[styles.countBadge, { backgroundColor: theme.pillSurface, borderColor: theme.pillBorder }]}>
              <Text style={[styles.countBadgeText, { color: theme.actionPrimary }]}>{totalCertificates} Total</Text>
            </View>
          </View>

          {onManagePress && (
            <TouchableOpacity
              style={[styles.manageButton, { backgroundColor: theme.cardSurface, borderColor: theme.pillBorder }]}
              onPress={onManagePress}
              activeOpacity={0.7}
              testID="casino-certificates-manage-button"
            >
              <Text style={[styles.manageText, { color: theme.textPrimary }]}>Manage</Text>
              <ChevronRight size={14} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.certificatesRow, { backgroundColor: theme.panelSurface, borderColor: theme.cardBorder }]}>
          {certificates.map((cert, index) => {
            const Icon = getCertIcon(cert.type);
            return (
              <View key={`${cert.type}-${index}`} style={styles.certificateItem}>
                <View style={[styles.certIconContainer, { backgroundColor: theme.pillSurface, borderColor: theme.pillBorder }]}>
                  <Icon size={18} color={theme.actionPrimary} />
                </View>
                <Text style={[styles.certValue, { color: theme.textPrimary }]}>{cert.value}</Text>
                <Text style={[styles.certLabel, { color: theme.textSecondary }]}>{cert.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.cardBorder }]}> 
          <View style={styles.availableInfo}>
            <Text style={[styles.availableLabel, { color: theme.textSecondary }]}>Available Cruises</Text>
            <Text style={[styles.availableValue, { color: theme.textPrimary }]}>{availableCruises.toLocaleString()}</Text>
          </View>

          {onViewOffersPress && (
            <TouchableOpacity
              style={[styles.viewOffersButton, { backgroundColor: theme.actionPrimary }]}
              onPress={onViewOffersPress}
              activeOpacity={0.7}
              testID="casino-certificates-view-offers-button"
            >
              <Text style={[styles.viewOffersText, { color: theme.actionText }]}>View Offers</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gradientOverlay: {
    padding: SPACING.md,
    position: 'relative',
  },
  marbleBlobPrimary: {
    position: 'absolute',
    top: -24,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  marbleBlobSecondary: {
    position: 'absolute',
    left: -48,
    bottom: -58,
    width: 220,
    height: 132,
    borderRadius: 66,
    borderWidth: 18,
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
    flexShrink: 1,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    marginLeft: SPACING.xs,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    borderWidth: 1,
  },
  manageText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  certificatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  certificateItem: {
    alignItems: 'center',
    flex: 1,
  },
  certIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
  },
  certValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  certLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  availableInfo: {},
  availableLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  availableValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  viewOffersButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  viewOffersText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
