import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ship, Tag, Calendar, BarChart3, FileText } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

type EmptyStateType = 'cruises' | 'offers' | 'events' | 'analytics' | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

const TYPE_CONFIG: Record<EmptyStateType, { icon: LucideIcon; title: string; message: string }> = {
  cruises: {
    icon: Ship,
    title: 'No Cruises Found',
    message: 'Import your cruise data to see available sailings.',
  },
  offers: {
    icon: Tag,
    title: 'No Offers Found',
    message: 'Import casino offers data to see available offers.',
  },
  events: {
    icon: Calendar,
    title: 'No Events Found',
    message: 'Import your calendar or TripIt data to see events.',
  },
  analytics: {
    icon: BarChart3,
    title: 'No Analytics Data',
    message: 'Book some cruises to see analytics and insights.',
  },
  generic: {
    icon: FileText,
    title: 'No Data',
    message: 'No data available to display.',
  },
};

export function EmptyState({
  type = 'generic',
  title,
  message,
  icon: CustomIcon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const config = TYPE_CONFIG[type];
  const Icon = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={56} color={COLORS.beigeWarm} />
      </View>
      
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.beigeWarm,
    borderRadius: BORDER_RADIUS.md,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
});
