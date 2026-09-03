import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ship, Bookmark, Tag, Calendar } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

interface DataOverviewProps {
  cruises: number;
  booked: number;
  offers: number;
  events: number;
  compact?: boolean;
}

export function DataOverview({
  cruises,
  booked,
  offers,
  events,
  compact = false,
}: DataOverviewProps) {
  const stats = [
    { label: 'Cruises', value: cruises, icon: Ship, color: COLORS.info },
    { label: 'Booked', value: booked, icon: Bookmark, color: COLORS.success },
    { label: 'Offers', value: offers, icon: Tag, color: COLORS.beigeWarm },
    { label: 'Events', value: events, icon: Calendar, color: COLORS.warning },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Data Overview</Text>
      <View style={[styles.grid, compact && styles.gridCompact]}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statItem, compact && styles.statItemCompact]}>
            <View style={[styles.iconContainer, { backgroundColor: `${stat.color}20` }]}>
              <stat.icon size={compact ? 14 : 18} color={stat.color} />
            </View>
            <Text style={[styles.value, compact && styles.valueCompact]}>{stat.value}</Text>
            <Text style={[styles.label, compact && styles.labelCompact]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFCF7',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 24,
    lineHeight: 29,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCompact: {
    gap: SPACING.xs,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemCompact: {
    paddingHorizontal: SPACING.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: TYPOGRAPHY.fontSizeXL,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  valueCompact: {
    fontSize: TYPOGRAPHY.fontSizeLG,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  labelCompact: {
    fontSize: 10,
  },
});
